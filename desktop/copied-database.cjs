// Only the fixed native capture worker calls this against a source profile.
// Native held handles, private startup and the independent deadline are
// prerequisites; this module's readOnly option is not their replacement.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {DatabaseSync,backup}=require('node:sqlite');
const failure=code=>Object.assign(Error(code),{code});
const objects=rows=>rows.map(row=>({...row}));
function snapshot(database,{allowFragments=false}={}){
 const schema=objects(database.prepare('SELECT type,name,tbl_name,rootpage,sql FROM sqlite_schema ORDER BY type,name').all());
 const expected='createtablestate(idintegerprimarykeycheck(id=1),valuetextnotnull)';
 if(schema.length!==1||schema[0].type!=='table'||schema[0].name!=='state'||schema[0].tbl_name!=='state'||schema[0].sql.replace(/\s+/g,'').toLowerCase()!==expected){if(!allowFragments)throw failure('SOURCE_SCHEMA_UNSUPPORTED');const checked=require('./fragment-store.cjs').readProfile(database);if(checked.format!=='fragments')throw failure('SOURCE_SCHEMA_UNSUPPORTED');}
 const columns=objects(database.prepare('PRAGMA table_xinfo(state)').all()),rows=objects(database.prepare('SELECT id,typeof(value) AS storageType,hex(CAST(value AS BLOB)) AS bytes,value FROM state ORDER BY id').all());
 const versions={user:database.prepare('PRAGMA user_version').get().user_version,application:database.prepare('PRAGMA application_id').get().application_id,encoding:database.prepare('PRAGMA encoding').get().encoding};
 if(rows.length!==1||rows[0].id!==1||rows[0].storageType!=='text'||versions.user!==0||versions.application!==0||versions.encoding!=='UTF-8')throw failure('SOURCE_SCHEMA_UNSUPPORTED');
 const raw=rows[0].value;let state;try{state=JSON.parse(raw);}catch{throw failure('SOURCE_PROFILE_UNSUPPORTED');}
 if(!['v1-upgrade','v2-upgrade','v3'].includes(require('./mission-profile.cjs').inspectMissionProfile(state).mode))throw failure('SOURCE_PROFILE_UNSUPPORTED');
 return {schema,columns,rows,versions,raw,state};
}
function readDatabaseImage(file,options){
 const database=new DatabaseSync(file,{readOnly:true,allowExtension:false,timeout:0});
 try{database.exec('BEGIN');const image=snapshot(database,options),integrity=database.prepare('PRAGMA integrity_check').all();if(integrity.length!==1||integrity[0].integrity_check!=='ok')throw failure('BACKUP_INTEGRITY_FAILED');database.exec('COMMIT');return image;}finally{database.close();}
}
async function backupDatabase(sourceFile,destination){
 if(fs.existsSync(destination))throw failure('BACKUP_DESTINATION_EXISTS');
 let source,transaction=false,image;
 try{
  source=new DatabaseSync(sourceFile,{readOnly:true,allowExtension:false,timeout:0});source.exec('BEGIN');transaction=true;image=snapshot(source);
  // Reserve a new destination, never overwrite an admitted baseline or partial.
  const descriptor=fs.openSync(destination,'wx',0o600);fs.closeSync(descriptor);
  await backup(source,destination,{source:'main',target:'main',rate:100});
  source.exec('COMMIT');transaction=false;
 }finally{if(source){try{if(transaction)source.exec('ROLLBACK');}finally{source.close();}}}
 // Source is already closed. Normalize only our new backup to a self-contained
 // baseline; the working ordered store will separately establish WAL/FULL.
 // Let SQLite finalize its own destination sidecars; never delete them here.
 const target=new DatabaseSync(destination,{allowExtension:false,timeout:0});
 try{if(target.prepare('PRAGMA journal_mode=DELETE').get().journal_mode!=='delete')throw failure('BACKUP_NORMALIZATION_FAILED');}finally{target.close();}
 assert.deepEqual(readDatabaseImage(destination),image,'BACKUP_VERIFICATION_FAILED');return image;
}
module.exports={backupDatabase,readDatabaseImage};
