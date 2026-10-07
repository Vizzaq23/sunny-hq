const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const sessions=new WeakMap();
const fail=code=>{throw Object.assign(Error(code),{code});};
function empty(args){if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length)fail('COPIED_QUERY_INVALID');}
function assertPreserved(before,after){
 const changes=[];
 const transition=(key,old,value)=>{
  if(/^tasks\.\d+\.status$/.test(key))return ['working','waiting','starting','unknown'].includes(old)&&value==='unknown';
  if(/^tasks\.\d+\.error$/.test(key))return old===undefined&&value==='Task effect outcome remains unresolved. Reconcile it before continuing.';
  if(/^discussions\.\d+\.status$/.test(key))return old==='working'&&value==='interrupted';
  if(key==='world.paused')return value===true;
  if(/^world\.jobs\.\d+\.status$/.test(key))return ['running','stopping'].includes(old)&&value==='blocked';
  if(/^world\.jobs\.\d+\.error$/.test(key))return value==='App restarted. Reconcile the previous mission before running again.';
  if(/^missionBook\.missions\.\d+\.(revision|updatedAt|status|acceptanceRecovery)(\.|$)/.test(key))return true;
  if(/^missionBook\.missions\.\d+\.attempts\.\d+\.(status|completedAt|error)$/.test(key))return true;
  if(/^missionBook\.runs\.\d+\.(phase|revision|controlIntent|controlReport|stopIntent|completionEntitlement)(\.|$)/.test(key))return true;
  if(/^missionBook\.runs\.\d+\.accounting\.(clock|warningAt|telemetryUncertain)(\.|$)/.test(key))return true;
  if(/^missionBook\.runs\.\d+\.(counters\.(activeMs|improvementMs)|accounting\.workers\.\d+\.activeMs)$/.test(key))return typeof value==='number'&&value>=old;
  if(/^missionBook\.runs\.\d+\.feedbackOperations\.\d+\.(state|reason|generation)$/.test(key))return true;
  if(/^missionBook\.runs\.\d+\.deliveries\.\d+\.(stage|reasonCode|generation|playable\.generation|playable\.effects\.[^.]+\.state)$/.test(key))return true;
  if(/^missionBook\.runs\.\d+\.playableLaunches\.\d+\.(state|cleanup)$/.test(key))return value==='unknown';
  return false;
 };
 const additions=key=>/^(news|world|growth|discussions|settings)$/.test(key)||/^settings\.(reducedMotion|notifications|roomSoundEnabled|roomSoundVolume|routingPolicy)$/.test(key)||/^missionBook\.runs\.\d+\.(accounting|ownedEffects)$/.test(key);
 function compare(old,value,key=''){
  if(require('node:util').isDeepStrictEqual(old,value))return;
  if(transition(key,old,value)||old===undefined&&additions(key)){changes.push({path:key,before:old,after:value});return;}
  if(Array.isArray(old)&&Array.isArray(value)){
   const events=/^missionBook\.missions\.\d+\.events$/.test(key);if(value.length<old.length||!events&&value.length!==old.length)fail('COPIED_STATE_CHANGED');
   for(let i=0;i<old.length;i++)compare(old[i],value[i],key+'.'+i);if(events&&value.length>old.length)changes.push({path:key+'.append',after:value.slice(old.length)});return;
  }
  if(old&&value&&typeof old==='object'&&typeof value==='object'&&!Array.isArray(old)&&!Array.isArray(value)){for(const field of new Set([...Object.keys(old),...Object.keys(value)]))compare(old[field],value[field],key?key+'.'+field:field);return;}
  fail('COPIED_STATE_CHANGED');
 }
 compare(before,after);return changes;
}
function migratedImage(binding,profileDir){
 const source=binding.image.state,mode=require('./mission-profile.cjs').inspectMissionProfile(source).mode;if(mode==='v3')return source;
 const directory=path.join(profileDir,'mission-profile-backups'),files=fs.readdirSync(directory);if(files.length!==1)fail('COPIED_MIGRATION_BACKUP_INVALID');
 const bytes=fs.readFileSync(path.join(directory,files[0]));assert.deepEqual(JSON.parse(bytes),source,'COPIED_MIGRATION_BACKUP_INVALID');
 return require('./mission-profile.cjs').upgradeMissionProfile(source,{path:path.join(directory,files[0]),sha256:require('node:crypto').createHash('sha256').update(bytes).digest('hex')});
}
async function construct(fixture,binding,token){
 const store=await require('./persistence-lifecycle.cjs').openProfile({dataDir:fixture.profileDir});let hub;
 try{
  if(store.durability?.journalMode!=='wal'||store.durability?.synchronous!==2)fail('COPIED_DURABILITY_UNVERIFIED');
  const expected=migratedImage(binding,fixture.profileDir);assert.deepEqual(store.load(),expected,'COPIED_WORKING_IMAGE_CHANGED');
  hub=new(require('./hub.cjs').Hub)({home:fixture.profileDir,store,copiedRecovery:token});await hub.initializeRecovery();
  const session={fixture,binding,expected,local:require('./local-history-archive.cjs').createLocalHistory(binding.archive),transport:require('./public-transport.cjs').createPublicTransport(hub)};sessions.set(hub,session);assertPreserved(expected,hub.persistedImage());return hub;
 }catch(error){try{if(hub)await hub.close();else await store.close();}catch{}throw error;}
}
async function bootCopiedProfile(fixture){require('./packaged-acceptance.cjs').assertCopiedFixtureCapability(fixture);const binding=require('./copied-capture.cjs').copiedBinding(fixture),token=require('./copied-recovery.cjs').issueCopiedRecovery(fixture);return construct(fixture,binding,token);}
async function copiedQuery(hub,action,args={}){
 const session=sessions.get(hub);if(!session||!require('./copied-recovery.cjs').isCopiedRecovery(hub)||hub.closed)fail('COPIED_CAPABILITY_REQUIRED');
 switch(action){
  case 'task:history':empty(args);return session.local.index();
  case 'task:externalPage':return session.local.page(args);
  case 'workspace:get':empty(args);return structuredClone(hub.state.workspace);
  case 'transcript:page':return session.transport.page(args);
  case 'mission:resultStatus':return session.transport.resultStatus(args);
  default:fail('COPIED_ACTION_DENIED');
 }
}
function verifySegments(messages,segments,ordinal){
 for(const [index,message]of messages.entries()){const id=ordinal?String(index):message.id,parts=segments.filter(part=>part.messageId===id);if(!parts.length)fail('COPIED_CONSUMER_CHANGED');let offset=0;for(const part of parts){assert.equal(part.offset,offset);assert.equal(part.role,message.role);assert.equal(part.totalLength,message.text.length);offset+=part.text.length;}assert.equal(parts.map(part=>part.text).join(''),message.text);}
 if(segments.some(part=>!messages.some((message,index)=>(ordinal?String(index):message.id)===part.messageId)))fail('COPIED_CONSUMER_CHANGED');
}
async function consumers(hub){
 const session=sessions.get(hub),stored=session.expected;
 assert.deepEqual(await copiedQuery(hub,'workspace:get',{}),stored.missionBook.workspace);
 const index=await copiedQuery(hub,'task:history',{});assert.deepEqual(index,session.binding.archive.value.map(({id,title,projectName,external,status})=>({id,title,projectName,external,status})));
 for(const item of session.binding.archive.value){let page=await copiedQuery(hub,'task:externalPage',{threadId:item.id,direction:'newer',limit:100}),segments=[];for(;;){segments.push(...page.segments);if(!page.nextCursor){assert.equal(page.complete,true);break;}page=await copiedQuery(hub,'task:externalPage',{threadId:item.id,sessionId:page.sessionId,revision:1,cursor:page.nextCursor,direction:'newer',limit:100});}verifySegments(item.messages,segments,true);}
 for(const task of stored.tasks||[]){const summary=session.transport.taskReply(hub.task(task.id)),request={projectId:task.projectId,taskId:task.id,epoch:session.transport.producer.epoch,revision:summary.transcriptRevision,direction:'newer',limit:100};let page=await copiedQuery(hub,'transcript:page',request),segments=[];for(;;){segments.push(...page.segments);if(!page.nextCursor){assert.equal(page.complete,true);break;}page=await copiedQuery(hub,'transcript:page',{...request,cursor:page.nextCursor});}verifySegments(task.messages,segments,false);}
 assert.deepEqual(fs.readFileSync(path.join(session.fixture.profileDir,'chatgpt-history.json')),session.binding.archive.raw);return true;
}
async function runCopiedProfile(fixture){
 let hub=await bootCopiedProfile(fixture);const session=sessions.get(hub),changes=[];let first,second;
 try{await consumers(hub);changes.push(...assertPreserved(session.expected,hub.persistedImage()));await hub.persist('workspace');}finally{await hub.close();}
 first=require('./copied-database.cjs').readDatabaseImage(path.join(fixture.profileDir,'sunny.sqlite')).state;changes.push(...assertPreserved(session.expected,first));
 const token=require('./copied-recovery.cjs').renewCopiedRecovery(hub),store=await require('./persistence-lifecycle.cjs').openProfile({dataDir:fixture.profileDir});
 try{assert.deepEqual(store.load(),first);hub=new(require('./hub.cjs').Hub)({home:fixture.profileDir,store,copiedRecovery:token});await hub.initializeRecovery();sessions.set(hub,{...session,expected:first,local:require('./local-history-archive.cjs').createLocalHistory(session.binding.archive),transport:require('./public-transport.cjs').createPublicTransport(hub)});await consumers(hub);await hub.persist('workspace');}finally{if(hub?.store===store)await hub.close();else await store.close();}
 second=require('./copied-database.cjs').readDatabaseImage(path.join(fixture.profileDir,'sunny.sqlite')).state;changes.push(...assertPreserved(first,second));
 const db=new(require('node:sqlite').DatabaseSync)(path.join(fixture.profileDir,'sunny.sqlite'),{readOnly:true,allowExtension:false,timeout:0});let journalMode;try{journalMode=db.prepare('PRAGMA journal_mode').get().journal_mode;}finally{db.close();}assert.equal(journalMode,'wal');
 // FULL is verified on the actual ordered worker's initialization receipt.
 if(hub.store.durability?.synchronous!==2)fail('COPIED_DURABILITY_UNVERIFIED');
 const result={version:1,consumerEqual:true,archiveEqual:true,reopened:true,journalMode,synchronous:2,changes,first,second};fs.writeFileSync(path.join(fixture.outputDir,'copied-roundtrip.private.json'),JSON.stringify(result),{flag:'wx',mode:0o600});return result;
}
module.exports={bootCopiedProfile,copiedQuery,runCopiedProfile,assertPreserved};
