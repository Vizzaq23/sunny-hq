const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const {Hub}=require('../desktop/hub.cjs');
const {receiptStore}=require('./helpers/receipt-store.cjs');

function fixtureHub(t,saved={}){
 const writes=[],hub=new Hub({home:process.cwd(),store:receiptStore({load:()=>saved,save:image=>writes.push(structuredClone(image)),close(){}}),catalog:{discoverProjects:()=>[{id:'p',path:process.cwd()}],discoverTools:()=>[],discoverAutomations:()=>[]}});
 t.after(()=>hub.close());return {hub,writes};
}
function actualMain(hub){
 const file=path.join(__dirname,'../desktop/main.cjs'),nativeRequire=createRequire(file);let startup;
 const app={setName(){},setPath(){},getPath:()=>process.cwd(),getVersion:()=> 'fixture',requestSingleInstanceLock:()=>true,on(){},whenReady:()=>({then:callback=>{startup=callback;return {catch(){}};}})};
 const context={require:id=>id==='electron'?{app,ipcMain:{handle(){}},dialog:{}}:id==='./diagnostics.cjs'?{readBuildInfo:()=>({}),record(){}}:id==='./persistence-lifecycle.cjs'?{...nativeRequire(id),bootHub:async()=>hub}:nativeRequire(id),__dirname:path.dirname(file),process:{argv:[],env:{USERPROFILE:process.cwd()},versions:process.versions},console,URL,Buffer,structuredClone,setTimeout,clearTimeout,setInterval:()=>0,clearInterval};
 // Expose the real handler without executing Electron startup or changing its code.
 const source=fs.readFileSync(file,'utf8').replace('async function handle(',"globalThis.mainFixture={handle,setHub:value=>{hub=value},setWindowCreation:callback=>{createWindow=callback;scanMorgansBriefings=()=>{};}};\nasync function handle(");
 vm.runInNewContext(source,context,{filename:file});context.mainFixture.setHub(hub);return {...context.mainFixture,startup:()=>startup()};
}
const early={routingPolicy:'thorough',reducedMotion:true,notifications:false,roomSoundEnabled:true};
for(const [field,value,error] of [['roomSoundVolume',NaN,/volume/],['model','missing-model',/available model/],['roomSoundEnabled','yes',/true or false/]])test(`actual settings handler rejects invalid ${field} atomically`,async t=>{
 const {hub}=fixtureHub(t),main=actualMain(hub),settings=hub.state.settings,before=structuredClone(settings),generation=hub.dirtyGeneration;
 await assert.rejects(main.handle('settings:update',{...early,[field]:value}),error);assert.deepEqual(settings,before,'Rejected batch cannot silently alter earlier valid fields');assert.equal(hub.state.settings,settings);assert.equal(hub.dirtyGeneration,generation);
});
test('actual settings handler preserves accepted and ignored field semantics',async t=>{
 const {hub}=fixtureHub(t),main=actualMain(hub);hub.state.models=[{id:'available'}];const settings=hub.state.settings,before=hub.dirtyGeneration;
 const result=await main.handle('settings:update',{...early,roomSoundVolume:.65,model:'available'});assert.equal(result,settings);assert.deepEqual({...settings},{...early,roomSoundVolume:.65,model:'available'});assert.ok(hub.dirtyGeneration>before);
 await main.handle('settings:update',{reducedMotion:'ignored',notifications:null,model:''});assert.equal(settings.reducedMotion,true);assert.equal(settings.notifications,false);assert.equal(settings.model,undefined);
});
test('captain reset is dirty before failed resume await can hide the persisted change',async t=>{
 const task={id:'captain',projectId:'p',crewId:'luffy',captain:true,captainVersion:3,status:'finished',threadId:'thread',turnId:'old',delegationCount:5,messages:[]}, {hub,writes}=fixtureHub(t,{tasks:[task]});hub.client.connected=true;hub.state.codex.status='connected';const captain=hub.task(task.id),generation=hub.dirtyGeneration;let rejectResume,announce;
 const reached=new Promise(resolve=>{announce=resolve;});hub.client.request=async method=>{assert.equal(method,'thread/resume');announce();return new Promise((_resolve,reject)=>{rejectResume=reject;});};hub.captain.stopping.add(captain.id);
 const pending=hub.send(captain.id,'Continue the captain conversation');pending.catch(()=>{});await reached;const atResume={generation:hub.dirtyGeneration,count:captain.delegationCount,stopping:hub.captain.stopping.has(captain.id)};rejectResume(Error('SYNTHETIC resume refusal'));await assert.rejects(pending,/resume refusal/);
 assert.equal(atResume.count,0);assert.equal(atResume.stopping,false);assert.ok(atResume.generation>generation,'Reset must enter the dirty generation before the next provider await');assert.equal(captain.delegationCount,0);assert.equal(writes.at(-1).tasks.find(value=>value.id===captain.id).delegationCount,0);
});
test('actual startup marks automatic news capture dirty before creating the first window',async t=>{
 const {hub,writes}=fixtureHub(t),main=actualMain(hub),generation=hub.dirtyGeneration;let atWindow;main.setWindowCreation(async()=>{atWindow={mode:hub.state.news.captureMode,generation:hub.dirtyGeneration};});await main.startup();assert.equal(atWindow.mode,'chatgpt-auto');assert.ok(atWindow.generation>generation,'Startup captureMode mutation must enter persistence before any window await');assert.ok(hub.saveTimer,'Startup mutation must schedule its durability without another user action');await hub.savePending();assert.equal(writes.at(-1).news.captureMode,'chatgpt-auto');
});
test('failed captain result save marks alias deletion dirty after its awaited failure',async t=>{
 const record={callId:'delegation',childId:'child',crewId:'franky'},parent={id:'parent',projectId:'p',crewId:'luffy',captain:true,status:'finished',delegations:[record],messages:[]},{hub}=fixtureHub(t,{tasks:[parent]});const live=hub.task(parent.id),entry={parentId:parent.id,record:live.delegations[0],resolve:()=>{}};hub.captain.pending.set(record.childId,entry);let rejectSave,announce;
 const reached=new Promise(resolve=>{announce=resolve;});hub.taskDurable=async()=>{announce();return new Promise((_resolve,reject)=>{rejectSave=reject;});};const result={success:true,contentItems:[{type:'inputText',text:'Saved assignment result'}]},pending=hub.captain.finish(record.childId,result);await reached;const generation=hub.dirtyGeneration;assert.equal(live.delegations[0].result,result);clearTimeout(hub.saveTimer);clearTimeout(hub.checkpointTimer);hub.saveTimer=null;hub.checkpointTimer=null;rejectSave(Error('SYNTHETIC result save failure'));await pending;
 assert.equal(live.delegations[0].result,undefined);assert.ok(hub.dirtyGeneration>generation,'Deleting persisted delegation result after failure must advance its generation');assert.ok(hub.saveTimer,'Rollback must restore background durability even if an earlier receipt cleared timers');assert.equal(hub.captain.pending.has(record.childId),false);
});
