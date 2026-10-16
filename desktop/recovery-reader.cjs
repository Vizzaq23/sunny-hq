'use strict';
// Pure snapshot creation is also used by isolated tests. It grants no source
// access. Only openRecoveryReader accepts the guard's private native capability.
const fail=code=>{throw Object.assign(Error(code),{code});};
const frozen=value=>{const pending=[value];while(pending.length){const item=pending.pop();if(item&&typeof item==='object'){for(const child of Object.values(item))if(child&&typeof child==='object')pending.push(child);Object.freeze(item);}}return value;};
const empty=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===0;
function decode(bytes){if(!Buffer.isBuffer(bytes)||bytes.length<2||bytes.length>256*1024*1024)fail('RECOVERY_SOURCE_INVALID');try{return JSON.parse(new(require('node:util').TextDecoder)('utf-8',{fatal:true}).decode(bytes));}catch{fail('RECOVERY_SOURCE_INVALID');}}
function createRecoverySnapshot({raw,archiveBytes,archiveStatus,epoch,buildIdentity}){
 const bytes=Buffer.from(raw),saved=decode(bytes),mode=require('./mission-profile.cjs').inspectMissionProfile(saved).mode;
 if(mode!=='v3')fail(['v1-upgrade','v2-upgrade'].includes(mode)?'RECOVERY_MIGRATION_REQUIRED':'RECOVERY_SCHEMA_UNSUPPORTED');
 if(typeof epoch!=='string'||!epoch||!/^[a-f0-9]{64}$/.test(buildIdentity))fail('RECOVERY_SOURCE_INVALID');
 const projects=saved.projects,tasks=saved.tasks;
 if(!Array.isArray(projects)||!Array.isArray(tasks))fail('RECOVERY_SOURCE_INVALID');
 for(const [items,kind]of [[projects,'project'],[tasks,'task']]){const seen=new Set();for(const item of items){if(!item||typeof item.id!=='string'||!item.id||seen.has(item.id))fail('RECOVERY_SOURCE_INVALID');seen.add(item.id);if(kind==='task'&&(!projects.some(p=>p.id===item.projectId)||!Array.isArray(item.messages)))fail('RECOVERY_SOURCE_INVALID');}}
 let local,archiveRaw;
 if(archiveStatus==='present-verified'){const archive=require('./local-history-archive.cjs').decodeArchive(archiveBytes);archiveRaw=archive.raw;local=require('./local-history-archive.cjs').createLocalHistory(archive);}
 else if(archiveStatus!=='absent-at-epoch'||archiveBytes!=null)fail('RECOVERY_ARCHIVE_UNAVAILABLE');
 frozen(saved);const state={...saved,missions:saved.missionBook.missions,runs:saved.missionBook.runs,workspace:saved.missionBook.workspace};
 const projection=require('./state-projection.cjs').createStateProjection({epoch});for(const task of tasks)projection.summary(task);
 const metadata=frozen({mode:'recovery-reader',epoch,buildIdentity,archiveStatus,finalSourceVerification:'pending-close',status:'Saved status unverified in recovery reader',artifactStatus:'Artifact not reverified in reader',capabilities:{editing:false,dispatch:false,providers:false,sourceWrites:false}});
 let closed=false;
 function member(projectId){if(projects.filter(p=>p.id===projectId).length!==1)fail('RECOVERY_QUERY_INVALID');}
 function query(action,args){
  if(closed)fail('RECOVERY_CLOSED');
  if(!['snapshot','workspace:get','transcript:page','run:inspect','task:history','task:readExternalPage'].includes(action))fail('RECOVERY_READ_ONLY');
  try{
   if(['snapshot','workspace:get','task:history'].includes(action)&&!empty(args))fail('RECOVERY_QUERY_INVALID');
   if(action==='snapshot')return {...projection.snapshot(state),recovery:metadata};
   if(action==='workspace:get')return structuredClone(state.workspace);
   if(action==='transcript:page')return projection.page(state,args);
   if(action==='run:inspect'){
    require('./supervision-commands.cjs').validateSupervisionCommand(action,args);member(args.projectId);const run=state.runs.find(r=>r.id===args.runId&&r.projectId===args.projectId);if(!run)fail('RECOVERY_QUERY_INVALID');
    // Entire strictly validated stored run remains inspectable as inert JSON;
    // no path resolver, report mutation or current-result probe is invoked.
    return {saved:structuredClone(run),status:metadata.status,artifactStatus:metadata.artifactStatus};
   }
   if(action==='task:history')return {local:tasks.map(t=>projection.summary(t)),imported:local?local.index():[],remoteHistory:'unavailable',archiveStatus};
   if(action==='task:readExternalPage'){
    require('./external-history-pages.cjs').validateExternalPageRequest(args);if(!local||!local.index().some(item=>item.id===args.threadId))return Promise.reject(Object.assign(Error('RECOVERY_QUERY_INVALID'),{code:'RECOVERY_QUERY_INVALID'}));
    return local.page(args).catch(()=>fail('RECOVERY_QUERY_INVALID'));
   }
  }catch(error){if(error?.code==='RECOVERY_READ_ONLY')throw error;fail('RECOVERY_QUERY_INVALID');}
 }
 return Object.freeze({metadata,query,close(){closed=true;},retainedImage(){if(closed)fail('RECOVERY_CLOSED');return {raw:Buffer.from(bytes),state:structuredClone(saved),archiveRaw:archiveRaw?Buffer.from(archiveRaw):undefined};}});
}
function readSqlite(file){
 const {DatabaseSync}=require('node:sqlite');let database;
 try{
  database=new DatabaseSync(file,{readOnly:true,allowExtension:false,timeout:0});database.exec('BEGIN');
  const schema=database.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name').all();
  if(schema.length!==1||schema[0].type!=='table'||schema[0].name!=='state'||schema[0].tbl_name!=='state'||schema[0].sql.replace(/\s+/g,'').toLowerCase()!=='createtablestate(idintegerprimarykeycheck(id=1),valuetextnotnull)')fail('RECOVERY_SCHEMA_UNSUPPORTED');
  if(database.prepare('PRAGMA user_version').get().user_version!==0||database.prepare('PRAGMA application_id').get().application_id!==0||database.prepare('PRAGMA encoding').get().encoding!=='UTF-8')fail('RECOVERY_SCHEMA_UNSUPPORTED');
  const rows=database.prepare('SELECT id,typeof(value) AS kind,value FROM state ORDER BY id').all();if(rows.length!==1||rows[0].id!==1||rows[0].kind!=='text')fail('RECOVERY_SCHEMA_UNSUPPORTED');
  const raw=Buffer.from(rows[0].value,'utf8');database.exec('COMMIT');return raw;
 }finally{if(database)database.close();}
}
function openRecoveryReader(admission){
 require('./recovery-reader-guard.cjs').assertAdmission(admission);
 const raw=admission.sourceFormat==='json'?admission.raw:admission.sourceFormat==='sqlite'?readSqlite(admission.sqlitePath):fail('RECOVERY_SOURCE_INVALID');
 return createRecoverySnapshot({...admission,raw});
}
module.exports={createRecoverySnapshot,openRecoveryReader};
