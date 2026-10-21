const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {guardedPath,hash}=require('./core.cjs');

function command(input,keys){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!keys.includes(key)))throw Error('Invalid result save command.');
}
function text(value,label,max){
 if(typeof value!=='string'||!value.trim()||value.includes('\0')||Buffer.byteLength(value,'utf8')>max)throw Error('Invalid '+label+'.');
 return value;
}
function samePath(a,b){return process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;}
function noteBody(record){
 return `---\ntype: reviewed-result\nsource: Sunny HQ\nsunny_save_id: ${record.id}\ndate: ${new Date(record.createdAt).toISOString()}\n---\n\n# ${record.title}\n\n${record.text}\n`;
}
// No links inside the pinned vault may redirect a reserved note, even within that vault.
function notePath(record){
 const expected=path.join(record.vault,'00 Inbox',`Sunny-${record.id}.md`);
 if(!/^[0-9a-f-]{36}$/.test(record.id)||!samePath(expected,record.path))throw Error('Saved note destination is invalid.');
 for(const candidate of [record.vault,path.dirname(expected),expected]){
  try{if(fs.lstatSync(candidate).isSymbolicLink())throw Error('A symbolic link replaced the note destination. Inspect it before recovery.');}catch(error){if(error.code!=='ENOENT')throw error;}
 }
 return guardedPath(record.vault,expected);
}

class ResultSaves{
 constructor(hub){this.hub=hub;this.pending=Promise.resolve();}
 serialize(operation){const next=this.pending.then(()=>{this.hub.assertOpenForEffect?.();return operation();});this.pending=next.catch(()=>{});return next;}
 save(input){return this.serialize(()=>this.saveUnlocked(input));}
 recover(input){return this.serialize(()=>this.recoverUnlocked(input));}
 reserveVault(){
  const configured=this.hub.catalog.vaultPath?.(this.hub.home);
  if(typeof configured!=='string'||!path.isAbsolute(configured))throw Error('The Obsidian vault is not configured.');
  const target=path.resolve(configured);let ancestor=target;
  while(!fs.existsSync(ancestor)){const parent=path.dirname(ancestor);if(parent===ancestor)throw Error('The Obsidian vault location is unavailable.');ancestor=parent;}
  return path.resolve(fs.realpathSync(ancestor),path.relative(ancestor,target));
 }
 vault(){
  const configured=this.hub.catalog.vaultPath?.(this.hub.home);
  if(!configured||!fs.existsSync(configured)||!fs.statSync(configured).isDirectory())throw Error('The Obsidian vault is unavailable. Restore it before saving.');
  return fs.realpathSync(configured);
 }
 async saveUnlocked(input){
  command(input,['taskId','messageId','title','text','reviewed']);
  text(input.taskId,'task ID',200);text(input.messageId,'result ID',200);
  const title=text(input.title,'note title',480).trim();if(title.length>120)throw Error('Note title exceeds 120 characters.');
  const content=text(input.text,'reviewed result (200 KB maximum)',200000);
  if(input.reviewed!==true)throw Error('Review the exact result before saving.');
  const task=this.hub.task(input.taskId);this.hub.project(task.projectId);
  if(task.external)throw Error('Choose a local Sunny task.');
  if(task.status!=='finished')throw Error('Wait for a finished task before reviewing its result.');
  const candidates=task.messages.filter(item=>item.role==='assistant'&&item.id===input.messageId&&item.text?.trim());
  const accepted=candidates.length===1&&this.hub.state.missions.some(m=>m.status==='COMPLETE'&&!m.pendingAcceptance&&!m.acceptanceRecovery&&m.acceptance?.attemptId===m.activeAttemptId&&m.selectedResult?.attemptId===m.activeAttemptId&&m.acceptance?.resultId===m.selectedResult?.id&&m.selectedResult?.producerTaskId===task.id&&m.selectedResult?.ref.kind==='reply'&&m.selectedResult.ref.taskId===task.id&&m.selectedResult.ref.messageId===input.messageId&&m.selectedResult.ref.sha256===hash(candidates[0].text)&&m.acceptance.resultSha256===m.selectedResult.ref.sha256&&content===candidates[0].text);
  const message=accepted?candidates[0]:task.messages.findLast(item=>item.role==='assistant'&&item.text?.trim());
  if(!message||message.id!==input.messageId)throw Error('The task result changed. Review the latest result before saving.');
  const sourceHash=hash(message.text),key=hash(JSON.stringify([task.id,message.id,sourceHash,title,content]));
  const previous=this.hub.state.resultSaves.find(record=>record.key===key);
  if(previous)return this.recoverUnlocked({saveId:previous.id});
  const vault=this.reserveVault(),id=randomUUID(),createdAt=Date.now();
  const mission=this.hub.state.missions.find(item=>item.attempts.some(attempt=>attempt.taskIds.includes(task.id)));
  const attempt=mission?.attempts.find(item=>item.taskIds.includes(task.id));
  const record={id,key,taskId:task.id,projectId:task.projectId,messageId:message.id,sourceHash,executionId:task.executionId,missionId:mission?.id,attemptId:attempt?.id,title,text:content,reviewedAt:createdAt,createdAt,updatedAt:createdAt,vault,path:path.join(vault,'00 Inbox',`Sunny-${id}.md`),status:'saving'};
  record.sha256=hash(noteBody(record));
  this.hub.state.resultSaves.unshift(record);
  try{await this.hub.persist();}catch(error){if(error.uncertain||error.durable){record.status="needs-recovery";}else this.hub.state.resultSaves=this.hub.state.resultSaves.filter(value=>value.id!==record.id);throw error;}
  return this.finish(record);
 }
 async recoverUnlocked(input){
  command(input,['saveId']);text(input.saveId,'save ID',200);
  const record=this.hub.state.resultSaves.find(item=>item.id===input.saveId);
  if(!record)throw Error('Saved result was not found.');
  this.hub.project(record.projectId);
  return this.finish(record);
 }
 async finish(record){
  if(this.hub.closed)throw Error('Sunny is closed. Reopen it before recovering the save.');
  let writeAttempted=false;
  try{
   if(!samePath(this.vault(),record.vault))throw Error('The Obsidian vault changed. Restore the original vault before recovery.');
   const file=notePath(record),body=noteBody(record);
   if(hash(body)!==record.sha256)throw Error('The saved intent changed. Inspect it before recovery.');
   let exists=fs.existsSync(file);
   if(!exists){
    if(record.receipt)throw Error('The previously saved note is missing or was removed. Inspect the original path; Sunny will not recreate it.');
    // Checkpoint again before a retry's first side effect. Failed checkpoints never write.
    record.status='saving';record.error=undefined;await this.hub.persist();
    fs.mkdirSync(path.dirname(file),{recursive:true});notePath(record);
    let fd;
    try{writeAttempted=true;fd=fs.openSync(file,'wx');fs.writeFileSync(fd,body,'utf8');fs.fsyncSync(fd);}
    catch(error){if(error.code!=='EEXIST')throw error;}
    finally{if(fd!==undefined)fs.closeSync(fd);}
    exists=true;
   }
   notePath(record);
   if(!exists||!fs.statSync(file).isFile()||fs.statSync(file).size>201000||hash(fs.readFileSync(file))!==record.sha256)throw Error('The note changed or contains a partial/conflicting save. Inspect the exact path; Sunny will not overwrite it.');
   const oldReceipt=record.receipt;
   record.receipt=oldReceipt||{id:record.id,path:file,sha256:record.sha256,bytes:Buffer.byteLength(body),verifiedAt:Date.now()};
   record.status='saved';record.error=undefined;record.updatedAt=Date.now();
   try{await this.hub.persist();}catch(error){record.receipt=oldReceipt;throw Error('The note exists, but its receipt could not be saved: '+error.message);}
   this.hub.changed();return record;
  }catch(error){
   // A possible write or an existing receipt/file requires reconciliation, never a new path.
   record.status=writeAttempted||record.receipt||fs.existsSync(record.path)?'needs-recovery':'failed';
   record.error=String(error.message).slice(0,1000);record.updatedAt=Date.now();
   try{await this.hub.persist();}catch{/* The previously checkpointed intent remains recoverable after restart. */}
   this.hub.changed();throw error;
  }
 }
}
function validRecord(record){
 if(!record||typeof record!=='object'||Array.isArray(record))return false;
 const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=200&&!value.includes('\0');
 const digest=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
 const timestamp=value=>Number.isSafeInteger(value)&&value>=0&&value<=8640000000000000;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(record.id)||!['taskId','projectId','messageId'].every(key=>identifier(record[key])))return false;
 if(!['executionId','missionId','attemptId'].every(key=>record[key]===undefined||identifier(record[key])))return false;
 if(!['createdAt','updatedAt','reviewedAt'].every(key=>timestamp(record[key]))||!['saving','saved','failed','needs-recovery'].includes(record.status))return false;
 if(typeof record.title!=='string'||!record.title.trim()||record.title!==record.title.trim()||record.title.length>120||Buffer.byteLength(record.title)>480||record.title.includes('\0'))return false;
 if(typeof record.text!=='string'||!record.text.trim()||record.text.includes('\0')||Buffer.byteLength(record.text)>200000)return false;
 if(typeof record.vault!=='string'||!path.isAbsolute(record.vault)||record.vault.includes('\0')||typeof record.path!=='string'||!samePath(path.join(record.vault,'00 Inbox',`Sunny-${record.id}.md`),record.path))return false;
 if(!digest(record.sourceHash)||!digest(record.key)||!digest(record.sha256)||record.key!==hash(JSON.stringify([record.taskId,record.messageId,record.sourceHash,record.title,record.text])))return false;
 const body=noteBody(record);if(hash(body)!==record.sha256)return false;
 const receipt=record.receipt;
 if(record.status==='saved'&&!receipt)return false;
 if(receipt&&(typeof receipt!=='object'||Array.isArray(receipt)||receipt.id!==record.id||typeof receipt.path!=='string'||!samePath(receipt.path,record.path)||receipt.sha256!==record.sha256||receipt.bytes!==Buffer.byteLength(body)||!timestamp(receipt.verifiedAt)))return false;
 return true;
}
function restoreResultSaves(saved){
 if(saved===undefined)return [];
 if(!Array.isArray(saved))throw Error('Saved result receipts are invalid. Preserve the profile before recovery.');
 const ids=new Set(),keys=new Set();
 return saved.map(record=>{
  if(!validRecord(record)||ids.has(record.id)||keys.has(record.key))throw Error('Saved result receipt is invalid or duplicated. Preserve the profile before recovery.');
  ids.add(record.id);keys.add(record.key);
  return {...record,status:record.status==='saving'?'needs-recovery':record.status};
 });
}
module.exports={ResultSaves,restoreResultSaves};
