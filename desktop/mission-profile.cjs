const fs=require('node:fs');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const unsupported='Unsupported or invalid mission profile. Preserve the saved data for recovery and use a compatible Sunny version.';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const id=value=>typeof value==='string'&&value.trim().length>0&&value.length<=200&&!value.includes('\0');
const revision=value=>Number.isSafeInteger(value)&&value>=0;
const timestamp=value=>Number.isFinite(value)&&value>=0;
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
// Array iteration methods skip holes; JSON turns them into null on disk.
const denseArray=value=>Array.isArray(value)&&Object.keys(value).filter(key=>/^(0|[1-9]\d*)$/.test(key)&&Number(key)<value.length).length===value.length;
function emptyWorkspace(){return {version:1,revision:0,context:null,drafts:[],seenAcceptanceIds:[]};}
function keys(value,allowed){return object(value)&&Object.keys(value).every(key=>allowed.includes(key));}
function optionalIds(value,names){return names.every(name=>value[name]===undefined||id(value[name]));}
function validContext(context){
 return keys(context,['projectId','missionId','attemptId','taskId','surface','returnTo'])&&id(context.projectId)&&optionalIds(context,['missionId','attemptId','taskId'])&&['deck','workbench','franky'].includes(context.surface)&&keys(context.returnTo,['view','projectId','missionId','taskId'])&&id(context.returnTo.view)&&optionalIds(context.returnTo,['projectId','missionId','taskId']);
}
function validateWorkspace(workspace){
 if(!keys(workspace,['version','revision','context','drafts','seenAcceptanceIds'])||workspace.version!==1||!revision(workspace.revision)||(workspace.context!==null&&!validContext(workspace.context))||!denseArray(workspace.drafts)||workspace.drafts.length>50||!denseArray(workspace.seenAcceptanceIds)||workspace.seenAcceptanceIds.length>500||workspace.seenAcceptanceIds.some(value=>!id(value))||new Set(workspace.seenAcceptanceIds).size!==workspace.seenAcceptanceIds.length)throw Error('Invalid saved workspace data. Preserve the profile for recovery.');
 const ids=new Set();
 for(const draft of workspace.drafts){
  if(!keys(draft,['id','kind','projectId','taskId','title','text','criteria','completionBoundary','revision','updatedAt'])||!id(draft.id)||ids.has(draft.id)||!['brief','message'].includes(draft.kind)||!id(draft.projectId)||!optionalIds(draft,['taskId'])||typeof draft.text!=='string'||draft.text.length>50000||draft.text.includes('\0')||(draft.title!==undefined&&(typeof draft.title!=='string'||draft.title.length>200||draft.title.includes('\0')))||(draft.criteria!==undefined&&(!denseArray(draft.criteria)||draft.criteria.length>20||draft.criteria.some(value=>typeof value!=='string'||value.length>2000||value.includes('\0'))))||(draft.completionBoundary!==undefined&&!['review','merge'].includes(draft.completionBoundary))||!revision(draft.revision)||!timestamp(draft.updatedAt))throw Error('Invalid saved workspace draft. Preserve the profile for recovery.');
  ids.add(draft.id);
 }
 if(Buffer.byteLength(JSON.stringify(workspace.drafts),'utf8')>1024*1024)throw Error('Saved workspace drafts exceed the 1 MiB limit. Preserve the profile for recovery.');
}
function validateMissionAuthority(mission){
 if(!object(mission)||!id(mission.id)||!id(mission.projectId)||!['DRAFT','RUNNING','NEEDS_USER','WAITING_FOR_REVIEW','BLOCKED','FAILED','CANCELLED','COMPLETE'].includes(mission.status)||!revision(mission.revision)||!denseArray(mission.taskIds)||mission.taskIds.some(value=>!id(value))||new Set(mission.taskIds).size!==mission.taskIds.length||!denseArray(mission.attempts)||!denseArray(mission.events)||!denseArray(mission.acceptanceCriteria)||(mission.artifacts!==undefined&&!denseArray(mission.artifacts))||(mission.seenEventIds!==undefined&&!denseArray(mission.seenEventIds)))throw Error('Invalid saved mission data. Restore a verified backup.');
 const attempts=new Set();
 for(const attempt of mission.attempts){if(!object(attempt)||!id(attempt.id)||attempts.has(attempt.id)||!id(attempt.taskId)||!['starting','working','waiting','unknown','finished','failed','interrupted'].includes(attempt.status)||!denseArray(attempt.taskIds)||!attempt.taskIds.includes(attempt.taskId)||attempt.taskIds.some(value=>!id(value)||!mission.taskIds.includes(value))||new Set(attempt.taskIds).size!==attempt.taskIds.length||(attempt.requestedChanges!==undefined&&(typeof attempt.requestedChanges!=='string'||!attempt.requestedChanges.trim()||attempt.requestedChanges.length>50000||attempt.requestedChanges.includes('\0'))))throw Error('Invalid saved mission attempt.');attempts.add(attempt.id);}
 if(mission.activeAttemptId!==undefined&&!attempts.has(mission.activeAttemptId))throw Error('Invalid saved active attempt.');
 if(mission.acceptedAt!==undefined&&!timestamp(mission.acceptedAt))throw Error('Invalid saved mission acceptance time.');
 const result=mission.selectedResult;
 if(result!==undefined){
  const attempt=mission.attempts.find(value=>value.id===result?.attemptId),ref=result?.ref;
  if(!object(result)||!id(result.id)||!attempt||result.attemptId!==mission.activeAttemptId||!id(result.producerTaskId)||!attempt.taskIds.includes(result.producerTaskId)||!timestamp(result.selectedAt)||!object(ref)||!sha(ref.sha256)||!((ref.kind==='reply'&&id(ref.taskId)&&ref.taskId===result.producerTaskId&&id(ref.messageId))||(ref.kind==='deliverable'&&id(ref.artifactId)&&mission.artifacts?.some(artifact=>artifact.id===ref.artifactId&&artifact.attemptId===result.attemptId&&['deliverable','image'].includes(artifact.kind)))))throw Error('Invalid saved selected mission result.');
 }
 const acceptance=mission.acceptance;
 if(mission.status==='COMPLETE'&&acceptance===undefined)throw Error('Invalid saved completed mission without acceptance evidence.');
 if(acceptance!==undefined){
  if(!object(acceptance)||mission.status!=='COMPLETE'||acceptance.actor!=='captain'||acceptance.attemptId!==mission.activeAttemptId||!mission.attempts.some(attempt=>attempt.id===acceptance.attemptId&&attempt.status==='finished')||!revision(acceptance.reviewedRevision)||acceptance.reviewedRevision>mission.revision||!denseArray(acceptance.criteria)||acceptance.criteria.length!==mission.acceptanceCriteria.length||!acceptance.criteria.every(value=>value===true)||(acceptance.prArtifactId!==undefined&&!id(acceptance.prArtifactId)))throw Error('Invalid saved mission acceptance.');
  if(acceptance.legacy!==true&&(!id(acceptance.id)||!timestamp(acceptance.acceptedAt)||!result||acceptance.attemptId!==result.attemptId||acceptance.resultId!==result.id||acceptance.resultSha256!==result.ref.sha256))throw Error('Invalid saved mission result acceptance.');
 }
}
function validateMissionBookAuthority(book){
 if(!denseArray(book.missions))throw Error('Invalid saved mission list.');
 const ids=new Set();for(const mission of book.missions){validateMissionAuthority(mission);if(ids.has(mission.id))throw Error('Invalid saved duplicate mission identity.');ids.add(mission.id);}
}
function upgradeClone(saved){
 const upgraded=structuredClone(saved);upgraded.missionBook.version=3;upgraded.missionBook.runs=[];
 if(saved.missionBook.version===1){upgraded.missionBook.workspace=emptyWorkspace();
 for(const mission of upgraded.missionBook.missions)if(mission.acceptance!==undefined)mission.acceptance={...mission.acceptance,legacy:true};
 }
 return upgraded;
}
function inspectMissionProfile(saved){
 try{
  if(!object(saved))return {mode:'unsupported'};
  if(saved.missionBook===undefined){
   require('./supervision-schema.cjs').validateSupervisedTasks({runs:[],missions:[]},saved.tasks);
   return {mode:'empty'};
  }
  const book=saved.missionBook;if(!object(book)||!Array.isArray(book.missions)||![1,2,3].includes(book.version))return {mode:'unsupported'};
  if(book.version<3&&(book.runs!==undefined||book.missions.some(mission=>mission?.runId!==undefined)||saved.tasks?.some(task=>task&&(task.runId!==undefined||task.assignmentId!==undefined||task.workspaceId!==undefined))))return {mode:'unsupported'};
  const candidate=book.version<3?upgradeClone(saved).missionBook:book;
  validateMissionBookAuthority(candidate);
  if(book.version===1&&(book.workspace!==undefined||book.missions.some(mission=>mission.selectedResult!==undefined||mission.acceptance?.legacy!==undefined)))return {mode:'unsupported'};
  new (require('./missions.cjs').MissionBook)(candidate);
  require('./supervision-schema.cjs').validateSupervisedTasks(candidate,saved.tasks);
  return {mode:book.version===1?'v1-upgrade':book.version===2?'v2-upgrade':'v3'};
 }catch{return {mode:'unsupported'};}
}
function stateBytes(saved){if(!object(saved))throw Error(unsupported);return Buffer.from(JSON.stringify(saved,null,2),'utf8');}
function hash(bytes){return createHash('sha256').update(bytes).digest('hex');}
function readBackup(file){
 const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Invalid migration backup file.');
 const descriptor=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{const opened=fs.fstatSync(descriptor);if(!opened.isFile()||opened.ino!==stat.ino||opened.dev!==stat.dev)throw Error('Migration backup changed during verification.');return fs.readFileSync(descriptor);}finally{fs.closeSync(descriptor);}
}
function writeVerifiedBackup(saved,backupDir){
 if(!['v1-upgrade','v2-upgrade'].includes(inspectMissionProfile(saved).mode))throw Error(unsupported);
 const bytes=stateBytes(saved);fs.mkdirSync(backupDir,{recursive:true});const stat=fs.lstatSync(backupDir);
 if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Invalid migration backup directory.');
 const file=path.join(fs.realpathSync(backupDir),'mission-profile-v'+saved.missionBook.version+'-'+Date.now()+'-'+randomUUID()+'.json');
 const descriptor=fs.openSync(file,'wx',0o600);
 try{fs.writeFileSync(descriptor,bytes);fs.fsyncSync(descriptor);}finally{fs.closeSync(descriptor);}
 const verified=readBackup(file);if(!verified.equals(bytes))throw Error('Migration backup could not be verified.');
 return {path:file,sha256:hash(verified)};
}
function upgradeMissionProfile(saved,receipt){
 if(!['v1-upgrade','v2-upgrade'].includes(inspectMissionProfile(saved).mode))throw Error(unsupported);
 if(!object(receipt)||typeof receipt.path!=='string'||!path.isAbsolute(receipt.path)||!sha(receipt.sha256))throw Error('A verified full-state migration backup receipt is required.');
 const bytes=readBackup(receipt.path);if(hash(bytes)!==receipt.sha256||!bytes.equals(stateBytes(saved)))throw Error('Migration backup receipt does not match the exact saved profile.');
 return upgradeClone(saved);
}
function prepareMissionProfileStore(store,backupDir){
 const saved=store.load(),mode=inspectMissionProfile(saved).mode;
 if(mode==='unsupported')throw Error(unsupported);
 let receipt=['v1-upgrade','v2-upgrade'].includes(mode)?writeVerifiedBackup(saved,backupDir):null;
 let current=receipt?upgradeMissionProfile(saved,receipt):structuredClone(saved);
 return {get recovery(){return store.recovery;},load:()=>structuredClone(current),save(value){
  const next={...current,...structuredClone(value)};if(inspectMissionProfile(next).mode!=='v3')throw Error(unsupported);
  if(receipt)upgradeMissionProfile(saved,receipt);
  store.save(next);current=next;receipt=null;
 },close:()=>store.close()};
}
module.exports={inspectMissionProfile,writeVerifiedBackup,upgradeMissionProfile,prepareMissionProfileStore,emptyWorkspace,validateWorkspace,validateMissionAuthority,validateMissionBookAuthority};
