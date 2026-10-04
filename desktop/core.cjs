const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
function inside(root,target){const relative=path.relative(root,target);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));}
function guardedPath(root,input=''){
 if(typeof input!=='string'||input.includes('\0'))throw Error('Invalid file path');
 const base=fs.realpathSync(root);const target=path.resolve(base,input);
 if(!inside(base,target))throw Error('File is outside this project');
 let ancestor=target;while(!fs.existsSync(ancestor)){const next=path.dirname(ancestor);if(next===ancestor)throw Error('Invalid file path');ancestor=next;}
 if(!inside(base,fs.realpathSync(ancestor)))throw Error('Symbolic link escapes this project');
 return target;
}
function hash(text){return crypto.createHash('sha256').update(text).digest('hex');}
function readText(root,input){const file=guardedPath(root,input);if(fs.statSync(file).size>3*1024*1024)throw Error('File is too large for the editor (3 MB limit)');const text=fs.readFileSync(file,'utf8');if(text.includes('\0'))throw Error('Binary files cannot be edited as text');return {path:file,text,hash:hash(text)};}
function writeText(root,input,text,expectedHash){
 const file=guardedPath(root,input);const rel=path.relative(fs.realpathSync(root),file).split(path.sep);
 if(rel.some(p=>['.git','.codex','.agents'].includes(p.toLowerCase())))throw Error('This project metadata is protected; use its original tool');
 if(typeof text!=='string'||Buffer.byteLength(text)>3*1024*1024)throw Error('Text exceeds the editor size limit');
 const previous=fs.existsSync(file)?readText(root,file):{hash:null};
 if(previous.hash!==expectedHash)throw Error('File changed on disk. Reload and compare before saving your edits.');
 try{fs.writeFileSync(file,text,'utf8');}catch(e){if(['EPERM','EACCES'].includes(e.code))throw Error('Windows blocked this save. Check the folder permissions and your security app history for Sunny HQ, then try again.');throw e;}return readText(root,file);
}
function deriveStatus(status){if(!status)return 'unknown';const type=typeof status==='string'?status:status.type;if(type==='active')return status.activeFlags?.length?'waiting':'working';if(type==='idle')return 'idle';if(type==='systemError')return 'failed';return 'unknown';}
class TaskGate{
 constructor(limit=3,fixtureScopeEnforcement){this.limit=limit;this.active=new Map();this.logical=new Map();this.fixtureScopeEnforcement=fixtureScopeEnforcement;}
 root(root){return path.resolve(fs.existsSync(root)?fs.realpathSync(root):root).toLowerCase();}
 reserve(id,root,scope={}){this.active.set(id,this.root(root));this.logical.set(id,{...scope});}
 blocked(root,scope={}){const normalized=this.root(root);return [...this.active.values()].some(other=>inside(other,normalized)||inside(normalized,other))||[...this.logical.entries()].some(([id,other])=>scope.projectId&&other.projectId===scope.projectId&&!(scope.runId&&scope.runId===other.runId&&this.fixtureScopeEnforcement?.({root:normalized,otherRoot:this.active.get(id),scope,other})===true));}
 acquire(id,root,scope={}){const normalized=this.root(root);if(this.active.has(id))throw Error('This task is already running');if(this.blocked(root,scope))throw Error('A task is already writing in this checkout. Finish or interrupt it first.');if(this.active.size>=this.limit)throw Error('The active-run limit is reached. Finish or interrupt a task first.');this.reserve(id,normalized,scope);}
 release(id){this.active.delete(id);this.logical.delete(id);}
}
class StateStore{
 constructor(file){this.file=file;fs.mkdirSync(path.dirname(file),{recursive:true});}
 load(){if(!fs.existsSync(this.file))return {};try{return JSON.parse(fs.readFileSync(this.file,'utf8'));}catch{const backup=this.file+'.corrupt-'+Date.now();fs.copyFileSync(this.file,backup);this.recovery=backup;return {};}}
 save(value){const temp=this.file+'.'+process.pid+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2),'utf8');fs.renameSync(temp,this.file);}
 close(){}
}
class SqliteStore{
 constructor(file){const {DatabaseSync}=require('node:sqlite');fs.mkdirSync(path.dirname(file),{recursive:true});this.db=new DatabaseSync(file);this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL)');}
 load(){const row=this.db.prepare('SELECT value FROM state WHERE id=1').get();if(!row)return {};try{return JSON.parse(row.value);}catch{this.db.exec('CREATE TABLE IF NOT EXISTS recovery (saved_at TEXT, value TEXT)');this.db.prepare('INSERT INTO recovery VALUES(?,?)').run(new Date().toISOString(),row.value);this.recovery='Preserved in the SQLite recovery table';return {};}}
 save(value,probe){
  if(!probe){this.db.prepare('INSERT INTO state(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(JSON.stringify(value));return;}
  const started=performance.now();let tick=started;
  try{
   // The original expression looks up run before evaluating its argument.
   const statement=this.db.prepare('INSERT INTO state(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value'),run=statement.run;
   let now=performance.now();probe.sqlPrepare=now-tick;tick=now;probe.sqlStage=1;
   const serialized=JSON.stringify(value);
   now=performance.now();probe.sqlStringify=now-tick;tick=now;probe.sqlStage=2;
   Reflect.apply(run,statement,[serialized]);
   now=performance.now();probe.sqlRun=now-tick;probe.sqlStage=3;
  }catch(error){probe.sqlFailed=1;throw error;}finally{probe.sqlTotal=performance.now()-started;}
 }
 close(){this.db.close();}
}
module.exports={guardedPath,readText,writeText,deriveStatus,TaskGate,StateStore,SqliteStore,hash,inside};

// Trusted worker construction only; public object save retains its original order.
function prepareWorkerSqliteStore(file){
 const raw=new SqliteStore(file);
 return {raw,writeCompact(compact){
  if(typeof compact!=='string')throw TypeError('Compact profile must be a string');
  raw.db.prepare('INSERT INTO state(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(compact);
 }};
}
module.exports.prepareWorkerSqliteStore=prepareWorkerSqliteStore;
