const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const sessions=new WeakMap();
const fail=code=>{throw Object.assign(Error(code),{code});};
function empty(args){if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length)fail('COPIED_QUERY_INVALID');}
const {assertPreserved}=require('./copied-preservation.cjs');
const clockRecords=new WeakMap();
function recordClock(hub,binding,phase){
 const trace={version:1,nonceSha256:binding.receipt.nonceSha256,phase,samples:[]},record={trace,stage:'initialize'},original=hub.budgetNow;
 clockRecords.set(hub,record);const close=hub.close;hub.close=function(){record.stage='close';return close.call(this);};hub.budgetNow=()=>{const clock=original.call(hub);if(trace.samples.length>=2||trace.samples.some(s=>s.stage===record.stage))fail('COPIED_CLOCK_INVALID');trace.samples.push({stage:record.stage,clock:structuredClone(clock)});return clock;};return trace;
}
function proof(hub,binding){const trace=clockRecords.get(hub).trace;return {trace,nonceSha256:binding.receipt.nonceSha256,phase:trace.phase};}
async function closeCopied(hub){const record=clockRecords.get(hub);if(record)record.stage='close';await hub.close();}
function migratedImage(binding,profileDir){
 const source=binding.image.state,mode=require('./mission-profile.cjs').inspectMissionProfile(source).mode;if(mode==='v3')return source;
 const directory=path.join(profileDir,'mission-profile-backups'),files=fs.readdirSync(directory).filter(name=>name!=='storage-format');if(files.length!==1)fail('COPIED_MIGRATION_BACKUP_INVALID');
 const bytes=fs.readFileSync(path.join(directory,files[0]));assert.deepEqual(JSON.parse(bytes),source,'COPIED_MIGRATION_BACKUP_INVALID');
 return require('./mission-profile.cjs').upgradeMissionProfile(source,{path:path.join(directory,files[0]),sha256:require('node:crypto').createHash('sha256').update(bytes).digest('hex')});
}
async function construct(fixture,binding,token){
 const store=await require('./persistence-lifecycle.cjs').openProfile({dataDir:fixture.profileDir});let hub;
 try{
  if(store.durability?.journalMode!=='wal'||store.durability?.synchronous!==2)fail('COPIED_DURABILITY_UNVERIFIED');
  const expected=migratedImage(binding,fixture.profileDir);assert.deepEqual(store.load(),expected,'COPIED_WORKING_IMAGE_CHANGED');
  hub=new(require('./hub.cjs').Hub)({home:fixture.profileDir,store,copiedRecovery:token});const trace=recordClock(hub,binding,'initial');await hub.initializeRecovery();
  const session={fixture,binding,expected,trace,local:require('./copied-capture.cjs').copiedLocalHistory(binding),transport:require('./public-transport.cjs').createPublicTransport(hub)};sessions.set(hub,session);assertPreserved(expected,hub.persistedImage(),proof(hub,binding));return hub;
 }catch(error){try{if(hub)await closeCopied(hub);else await store.close();}catch{}throw error;}
}
async function bootCopiedProfile(fixture){require('./packaged-acceptance.cjs').assertCopiedFixtureCapability(fixture);const binding=require('./copied-capture.cjs').copiedBinding(fixture),token=require('./copied-recovery.cjs').issueCopiedRecovery(fixture);return construct(fixture,binding,token);}
async function copiedQuery(hub,action,args={}){
 const session=sessions.get(hub);if(!session||!require('./copied-recovery.cjs').isCopiedRecovery(hub)||hub.closed)fail('COPIED_CAPABILITY_REQUIRED');
 switch(action){
  case 'task:history':empty(args);return session.local.index();
  case 'task:readExternalPage':return session.local.page(args);
  case 'workspace:get':empty(args);return structuredClone(hub.state.workspace);
  case 'transcript:page':return session.transport.page(args);
  case 'mission:resultStatus':return session.transport.resultStatus(args);
  default:fail('COPIED_ACTION_DENIED');
 }
}
function verifySegments(messages,segments,ordinal){
 let cursor=0;for(const [index,message]of messages.entries()){
  const id=ordinal?String(index):message.id;let offset=0;
  do{const part=segments[cursor++];if(!part||part.messageId!==id||part.offset!==offset||part.role!==message.role||part.totalLength!==message.text.length||typeof part.text!=='string'||message.text.length>0&&!part.text.length||part.text!==message.text.slice(offset,offset+part.text.length)||offset+part.text.length>message.text.length)fail('COPIED_CONSUMER_CHANGED');offset+=part.text.length;}while(offset<message.text.length);
 }
 if(cursor!==segments.length)fail('COPIED_CONSUMER_CHANGED');
}
async function consumers(hub,invoke=(action,args)=>copiedQuery(hub,action,args)){
 const session=sessions.get(hub),stored=session.expected;
 assert.deepEqual(await invoke('workspace:get',{}),stored.missionBook.workspace);
 const index=await invoke('task:history',{});assert.deepEqual(index,(session.binding.archive?.value||[]).map(({id,title,projectName,external,status})=>({id,title,projectName,external,status})));
 for(const item of (session.binding.archive?.value||[])){let page=await invoke('task:readExternalPage',{threadId:item.id,direction:'newer',limit:100}),segments=[];for(;;){segments.push(...page.segments);if(!page.nextCursor){assert.equal(page.complete,true);break;}page=await invoke('task:readExternalPage',{threadId:item.id,sessionId:page.sessionId,revision:1,cursor:page.nextCursor,direction:'newer',limit:100});}verifySegments(item.messages,segments,true);}
 for(const task of stored.tasks||[]){const summary=session.transport.taskReply(hub.task(task.id)),request={projectId:task.projectId,taskId:task.id,epoch:session.transport.producer.epoch,revision:summary.transcriptRevision,direction:'newer',limit:100};let page=await invoke('transcript:page',request),segments=[];for(;;){segments.push(...page.segments);if(!page.nextCursor){assert.equal(page.complete,true);break;}page=await invoke('transcript:page',{...request,cursor:page.nextCursor});}verifySegments(task.messages,segments,false);}
 if(session.binding.archive)assert.deepEqual(fs.readFileSync(path.join(session.fixture.profileDir,'chatgpt-history.json')),session.binding.archive.raw);else assert.equal(fs.readdirSync(session.fixture.profileDir).some(name=>name.toLowerCase()==='chatgpt-history.json'),false);return true;
}
async function runCopiedProfile(fixture,{connect}={}){
 let hub=await bootCopiedProfile(fixture);const session=sessions.get(hub),changes=[];let first,second;
 let transport;try{transport=await connect?.(hub);await consumers(hub,transport?.invoke);changes.push(...assertPreserved(session.expected,hub.persistedImage(),proof(hub,session.binding)));await hub.persist('workspace');}finally{transport?.close();await closeCopied(hub);}
 first=require('./copied-database.cjs').readDatabaseImage(path.join(fixture.profileDir,'sunny.sqlite'),{allowFragments:true}).state;changes.push(...assertPreserved(session.expected,first,proof(hub,session.binding)));
 const token=require('./copied-recovery.cjs').renewCopiedRecovery(hub),store=await require('./persistence-lifecycle.cjs').openProfile({dataDir:fixture.profileDir});
 let reopenTrace;transport=undefined;try{assert.deepEqual(store.load(),first);hub=new(require('./hub.cjs').Hub)({home:fixture.profileDir,store,copiedRecovery:token});reopenTrace=recordClock(hub,session.binding,'reopen');await hub.initializeRecovery();sessions.set(hub,{...session,expected:first,trace:reopenTrace,local:require('./copied-capture.cjs').copiedLocalHistory(session.binding),transport:require('./public-transport.cjs').createPublicTransport(hub)});transport=await connect?.(hub);await consumers(hub,transport?.invoke);await hub.persist('workspace');}finally{transport?.close();if(hub?.store===store)await closeCopied(hub);else await store.close();}
 second=require('./copied-database.cjs').readDatabaseImage(path.join(fixture.profileDir,'sunny.sqlite'),{allowFragments:true}).state;changes.push(...assertPreserved(first,second,proof(hub,session.binding)));
 const db=new(require('node:sqlite').DatabaseSync)(path.join(fixture.profileDir,'sunny.sqlite'),{readOnly:true,allowExtension:false,timeout:0});let journalMode;try{journalMode=db.prepare('PRAGMA journal_mode').get().journal_mode;}finally{db.close();}assert.equal(journalMode,'wal');
 // FULL is verified on the actual ordered worker's initialization receipt.
 if(hub.store.durability?.synchronous!==2)fail('COPIED_DURABILITY_UNVERIFIED');
 const result={version:1,consumerEqual:true,archiveEqual:true,reopened:true,journalMode,synchronous:2,changes,first,second,clockTraces:[session.trace,reopenTrace]};fs.writeFileSync(path.join(fixture.outputDir,'copied-roundtrip.private.json'),JSON.stringify(result),{flag:'wx',mode:0o600});return result;
}
module.exports={bootCopiedProfile,copiedQuery,runCopiedProfile,assertPreserved,verifySegments};
