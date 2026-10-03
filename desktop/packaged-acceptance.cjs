const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash,timingSafeEqual}=require('node:crypto');const {EventEmitter}=require('node:events');
const SCENARIOS=Object.freeze(['startup','renderer-crash','main-restart','worker-loss','write-failure','lost-ack','pending-approval','pending-check','normal-quit']);
const FROZEN_SHA='219f75242146fb32b8ed8452a0b792b1c76207311b67f74b947b267cc8581590';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function validateFixtureArguments(argv){
 if(argv.filter(value=>value.startsWith('--packaged-fixture=')).length!==1||argv.slice(1).some(value=>!value.startsWith('--packaged-fixture=')))throw Error('Fixture launch accepts only its private manifest argument.');
}
function canonical(directory){
 if(typeof directory!=='string'||!path.isAbsolute(directory)||!fs.statSync(directory).isDirectory())throw Error('Fixture directories must be absolute existing directories.');
 const resolved=path.resolve(directory),real=fs.realpathSync.native(directory);
 if(resolved.toLowerCase()!==real.toLowerCase())throw Error('Fixture alias must use its canonical path.');
 for(let current=resolved;;current=path.dirname(current)){if(fs.lstatSync(current).isSymbolicLink())throw Error('Fixture path contains a link or junction.');if(path.dirname(current)===current)break;}
 return resolved;
}
function assertOwnedTree(directory){
 let count=0;function inspect(current){if(++count>256)throw Error('Fixture tree exceeds owned path bound.');const stat=fs.lstatSync(current);if(stat.isSymbolicLink()||(!stat.isDirectory()&&stat.nlink>1))throw Error('Fixture files cannot alias another profile.');if(stat.isDirectory())for(const entry of fs.readdirSync(current))inspect(path.join(current,entry));}inspect(directory);
}
function canonicalTarget(target){let ancestor=path.resolve(target),suffix=[];while(!fs.existsSync(ancestor)){suffix.unshift(path.basename(ancestor));const next=path.dirname(ancestor);if(next===ancestor)throw Error('Default profile path unavailable.');ancestor=next;}return path.join(fs.realpathSync.native(ancestor),...suffix);}
function overlaps(a,b){const relative=path.relative(a,b);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));}
function admitFixture({manifestPath,nonce,defaultProfile,env=process.env}){
 if(typeof nonce!=='string'||!/^[a-f0-9]{64}$/.test(nonce))throw Error('Private per-run fixture nonce required.');
 if(typeof manifestPath!=='string'||!path.isAbsolute(manifestPath)||fs.lstatSync(manifestPath).isSymbolicLink()||fs.statSync(manifestPath).size>4096)throw Error('Invalid private fixture manifest.');
 canonical(path.dirname(manifestPath));const value=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 const keys=['version','nonce','profileDir','outputDir','scenario','phase','mib'];
 if(!value||Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key))||value.version!==1||!SCENARIOS.includes(value.scenario)||![1,2].includes(value.phase)||![1,10,30].includes(value.mib)||typeof value.nonce!=='string'||value.nonce.length!==nonce.length||!timingSafeEqual(Buffer.from(value.nonce),Buffer.from(nonce)))throw Error('Invalid fixture manifest or nonce.');
 if(env.ELECTRON_RUN_AS_NODE||env.SUNNY_DEV_URL||env.SUNNY_PROVIDER_MISSION||env.SUNNY_LIVE_MISSION)throw Error('Fixture runtime rejects provider/dev/runtime opt-ins.');
 const profileDir=canonical(value.profileDir),outputDir=canonical(value.outputDir),live=canonicalTarget(defaultProfile).toLowerCase();
 if(overlaps(live,profileDir.toLowerCase())||overlaps(profileDir.toLowerCase(),live)||overlaps(profileDir,outputDir)||overlaps(outputDir,profileDir)||overlaps(profileDir,manifestPath)||overlaps(outputDir,manifestPath))throw Error('Fixture profile must be isolated from default/live profile and evidence.');
 const outputMarker=path.join(outputDir,'.sunny-packaged-output.json'),nonceSha256=sha(nonce);
 if(!fs.existsSync(outputMarker)){if(fs.readdirSync(outputDir).length)throw Error('Evidence directory must be empty or fixture-manifested.');fs.writeFileSync(outputMarker,JSON.stringify({version:1,nonceSha256}),{flag:'wx',mode:0o600});}
 const outputOwner=JSON.parse(fs.readFileSync(outputMarker,'utf8'));if(outputOwner.version!==1||outputOwner.nonceSha256!==nonceSha256)throw Error('Evidence directory is not owned by this fixture.');
 const marker=path.join(profileDir,'.sunny-packaged-fixture.json');
 if(value.phase===1){if(fs.readdirSync(profileDir).length)throw Error('Fixture profile must be empty and manifested.');fs.writeFileSync(marker,JSON.stringify({version:1,nonceSha256,scenario:value.scenario}),{flag:'wx',mode:0o600});}
 else{assertOwnedTree(profileDir);const owned=JSON.parse(fs.readFileSync(marker,'utf8'));if(owned.nonceSha256!==nonceSha256||owned.scenario!==value.scenario||owned.version!==1)throw Error('Profile is not owned by this fixture manifest.');}
 return Object.freeze({...value,profileDir,outputDir});
}
function createOfflineClient(){const client=new EventEmitter();client.connected=false;let blocked=0;Object.defineProperty(client,'fixtureEffects',{get:()=>Object.freeze({blockedAttempts:blocked,providerEffects:0})});const deny=()=>{blocked++;throw Error('Offline fixture forbids provider effects.');};for(const method of ['connect','request','respond','start','turn','rejectRequest'])client[method]=deny;client.close=()=>{};return client;}
function loadFrozenFixture(mib){
 const file=path.join(__dirname,'fixtures/frozen-control-fixture.cjs'),bytes=fs.readFileSync(file);assert.equal(sha(bytes),FROZEN_SHA,'Packaged frozen control bytes changed');
 const original=path.resolve(path.dirname(file),'../../sunny-responsive-20261001/desktop/mission-profile.cjs');
 const module={exports:{}};const boundedRequire=id=>{if(id==='node:path')return path;if(id==='node:assert/strict')return assert;if(id===original)return require('./mission-profile.cjs');throw Error('Unexpected frozen dependency.');};
 const evaluate=new(require('node:vm').Script)('(function(require,module,exports,__dirname){\n'+bytes.toString('utf8')+'\n})',{filename:file}).runInThisContext();evaluate(boundedRequire,module,module.exports,path.dirname(file));return module.exports.fixture(mib);
}
function fixtureCatalog(){return Object.freeze({discoverProjects:()=>[],discoverTools:()=>[],discoverAutomations:()=>[],getExecutable:()=>undefined});}
function fixtureDependencies(){return {client:createOfflineClient(),islandFactory:hub=>({data:hub.state.world,close(){},setConcurrency(){throw Error('Offline fixture scheduler is disabled.');},run(){throw Error('Offline fixture scheduler is disabled.');}})};}
function assertFixtureAction(action){if(!['snapshot','workspace:get','workspace:update','transcript:page','mission:resultStatus','app:reload','app:diagnostic','approval:respond','mission:reconcileCheck'].includes(action))throw Error('Offline fixture blocks this action.');}
function seedState(manifest){
 const state=loadFrozenFixture(manifest.mib);const project=path.join(manifest.profileDir,'synthetic-project');fs.mkdirSync(project);state.projects[0].path=project;
 const mission=state.missionBook.missions[0],task=state.tasks[0],message=task.messages.find(item=>item.role==='assistant');
 mission.selectedResult={id:'fixture-result',attemptId:mission.activeAttemptId,producerTaskId:task.id,ref:{kind:'reply',taskId:task.id,messageId:message.id,sha256:sha(message.text)},selectedAt:1};
 if(['main-restart','pending-approval','pending-check','lost-ack','worker-loss'].includes(manifest.scenario)){
  const uncertain={id:'fixture-uncertain',threadId:'fixture-thread',turnId:'fixture-turn',executionId:'fixture-execution',projectId:state.projects[0].id,crewId:'franky',status:'working',title:'Synthetic uncertain reservation',createdAt:1,updatedAt:1,messages:[]};state.tasks.push(uncertain);
 }
 if(manifest.scenario==='pending-check')mission.checkExecution={id:'fixture-check',attemptId:mission.activeAttemptId,script:'test',startedAt:1};
 return state;
}
async function bootFixtureHub(manifest){
 const {openOrderedStore}=require('./ordered-store.cjs'),{Hub}=require('./hub.cjs');
 const options={kind:'sqlite',file:path.join(manifest.profileDir,'sunny.sqlite'),backupDir:path.join(manifest.profileDir,'mission-profile-backups')};let store=await openOrderedStore(options),hub;
 try{if(manifest.phase===1){await store.barrier(seedState(manifest),'mission');await store.close();store=await openOrderedStore(options);}hub=new Hub({home:manifest.profileDir,store,catalog:fixtureCatalog(),fixtureDependencies:fixtureDependencies()});await hub.initializeRecovery();return hub;}catch(error){if(hub)await hub.close().catch(()=>{});else await store.close().catch(()=>{});throw error;}
}
function durableIdentity(hub){const workspace=hub.state.workspace,mission=hub.state.missions[0];return {draftSha256:sha(JSON.stringify(workspace.drafts)),resultRef:mission.selectedResult?.ref,uncertainReservation:hub.gate.active.has('fixture-uncertain'),uncertainStatus:hub.state.tasks.find(task=>task.id==='fixture-uncertain')?.status};}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function bounded(promise,timeoutMs=15000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Fixture operation timed out.')),timeoutMs);})]);}finally{clearTimeout(timer);}}
async function trustedInvoke(win,action,args={}){return bounded(win.webContents.executeJavaScript(`window.sunny.invoke(${JSON.stringify(action)},${JSON.stringify(args)})`));}
async function waitForHome(win){for(let pass=0;pass<120;pass++){if(await win.webContents.executeJavaScript('Boolean(document.querySelector(".home-page,.island-scene"))').catch(()=>false))return;await pause(100);}throw Error('Production renderer did not show Home.');}
async function faultStore(profileDir,scenario){
 // Fault only this additional owned real SQLite worker, independently from Hub's store.
 const {Worker}=require('node:worker_threads'),{openOrderedStore}=require('./ordered-store.cjs');let native;
 const factory=(file,options)=>{native=new Worker(file,options);const proxy=new EventEmitter();native.on('error',error=>proxy.emit('error',error));native.on('exit',code=>proxy.emit('exit',code));native.on('message',message=>{if(scenario==='lost-ack'&&message.type==='committed')return;proxy.emit('message',message);});proxy.terminate=()=>native.terminate();proxy.postMessage=message=>{if(scenario==='worker-loss'&&message.type==='commit'){void native.terminate();return;}native.postMessage(message);};return proxy;};
 const file=path.join(profileDir,'fault.sqlite'),options={kind:'sqlite',file,backupDir:path.join(profileDir,'fault-backups'),timeoutMs:1200,workerFactory:factory};
 const store=await openOrderedStore(options);let error;
 if(scenario==='write-failure'){
  // A separate owned SQLite connection holds the write lock. SQLite refuses
  // the real worker's write; the previous durable image must survive.
  await store.barrier(loadFrozenFixture(1),'mission');
  const {DatabaseSync}=require('node:sqlite'),lock=new DatabaseSync(file);lock.exec('BEGIN IMMEDIATE');
  try{await store.barrier({...loadFrozenFixture(1),faultSentinel:'not committed'},'mission');}catch(cause){error=cause;}finally{lock.exec('ROLLBACK');lock.close();}
 }else try{await store.barrier(loadFrozenFixture(1),'mission');}catch(cause){error=cause;}
 await store.close().catch(()=>{});assert.ok(error,'Injected fault must reject');
 if(scenario==='write-failure'){const reopened=await openOrderedStore({kind:'sqlite',file,backupDir:options.backupDir});assert.equal(reopened.load().faultSentinel,undefined);await reopened.close();}
 if(scenario==='lost-ack'){assert.equal(error.code,'COMMIT_UNCERTAIN');const reopened=await openOrderedStore({kind:'sqlite',file,backupDir:options.backupDir});assert.ok(reopened.load().tasks.length);await reopened.close();}
 return {faultCode:['COMMIT_UNCERTAIN','STORE_FAILED','WORKER_EXIT'].includes(error.code)?error.code:'rejected'};
}
async function runPackagedAcceptance({app,profileDir,outputDir,scenario,fixtureTransport}){
 const {win,hub,manifest,buildInfo,diagnosticEvents=[]}=fixtureTransport;if(profileDir!==manifest.profileDir||outputDir!==manifest.outputDir||scenario!==manifest.scenario)throw Error('Fixture transport does not match admission.');
 await waitForHome(win);const start=performance.now();const snapshot=await trustedInvoke(win,'snapshot');assert.ok(snapshot.workspace);const invokeMs=performance.now()-start;
 let workspace=await trustedInvoke(win,'workspace:get');assert.equal(workspace.drafts[0].id,'draft-brief');
 if(manifest.phase===1){const writeStart=performance.now();await trustedInvoke(win,'workspace:update',{expectedRevision:workspace.revision,draft:workspace.drafts[0]});workspace=await trustedInvoke(win,'workspace:get');fixtureTransport.workspaceWriteMs=performance.now()-writeStart;}
 const identity=durableIdentity(hub),evidence={version:1,scenario,phase:manifest.phase,pid:process.pid,executableSha256:sha(fs.readFileSync(process.execPath)),asarSha256:sha(fs.readFileSync(path.join(process.resourcesPath,'app.asar'))),frozenFixtureSha256:FROZEN_SHA,identity,rendererInvokeMs:invokeMs,...(fixtureTransport.workspaceWriteMs===undefined?{}:{workspaceWriteMs:fixtureTransport.workspaceWriteMs})};
 // A blocked provider request is observed at the real client boundary.
 assert.throws(()=>hub.client.request('turn/start'),/offline/i);
 if(scenario==='renderer-crash'){
  const gone=new Promise(resolve=>win.webContents.once('render-process-gone',(_event,details)=>resolve(details)));win.webContents.forcefullyCrashRenderer();const reason=await bounded(gone);assert.ok(['crashed','abnormal-exit'].includes(reason.reason));win.reload();await waitForHome(win);await trustedInvoke(win,'snapshot');assert.deepEqual(durableIdentity(hub),identity);evidence.rendererRecovered=true;
 }
 if(['worker-loss','write-failure','lost-ack'].includes(scenario))Object.assign(evidence,await faultStore(profileDir,scenario));
 if(scenario==='pending-approval'){
  const task=hub.state.tasks.find(item=>item.id==='fixture-uncertain');task.status='working';hub.request({id:'fixture-rpc',method:'item/commandExecution/requestApproval',params:{threadId:task.threadId,turnId:task.turnId,command:'synthetic unavailable command'}});assert.equal(hub.state.approvals.length,1);await hub.persist('mission');const observed=await trustedInvoke(win,'snapshot');assert.equal(observed.approvals.length,1);const approval=observed.approvals[0];await assert.rejects(trustedInvoke(win,'approval:respond',{id:approval.id,decision:'decline'}),/offline/i);assert.equal(task.approvalResponseIntent.state,'prepared');evidence.pendingApprovalVisible=true;evidence.approvalResponseRetained=true;
 }
 if(scenario==='pending-check'){assert.equal(hub.missionBook.get('mission-0').checkExecution.id,'fixture-check');assert.ok(hub.gate.active.has('mission-evidence:mission-0'));const current=hub.missionBook.get('mission-0');await assert.rejects(trustedInvoke(win,'mission:reconcileCheck',{projectId:current.projectId,missionId:current.id,revision:current.revision,executionId:current.checkExecution.id,confirmedStopped:false}),/Confirm/i);assert.ok(current.checkExecution);evidence.pendingCheckRetained=true;}
 const {createIncidentManifest}=require('./diagnostics.cjs');evidence.incident=createIncidentManifest({buildInfo,exeHash:evidence.executableSha256,asarHash:evidence.asarSha256,runtime:process.versions,events:diagnosticEvents});
 // Persist proof before driver-triggered process exit; phase two independently reads the DB.
 await hub.persist('workspace');evidence.identity=durableIdentity(hub);Object.assign(evidence,hub.client.fixtureEffects);fs.writeFileSync(path.join(outputDir,`phase-${manifest.phase}.json`),JSON.stringify(evidence,null,2),{flag:'wx',mode:0o600});
 return evidence;
}
module.exports={SCENARIOS,FROZEN_SHA,validateFixtureArguments,admitFixture,createOfflineClient,fixtureCatalog,fixtureDependencies,assertFixtureAction,loadFrozenFixture,seedState,bootFixtureHub,durableIdentity,faultStore,runPackagedAcceptance};
