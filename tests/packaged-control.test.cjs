const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const acceptance=require('../desktop/packaged-acceptance.cjs');
const runner=require('../scripts/ordered-control-check.cjs');
function manifestCase(change={},run){
 const root=fs.mkdtempSync(path.join(__dirname,'../.sunny-dev/control-admission-'));
 try{const profileDir=path.join(root,'profile'),outputDir=path.join(root,'output');fs.mkdirSync(profileDir);fs.mkdirSync(outputDir);const value={version:1,nonce:'a'.repeat(64),profileDir,outputDir,scenario:'ordered-control',phase:1,mib:1,...change},manifestPath=path.join(root,'private.json');fs.writeFileSync(manifestPath,JSON.stringify(value));return run({manifestPath,nonce:value.nonce,defaultProfile:path.join(root,'live'),env:{}});}finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('private admission permits only ordered-control phase one and the three frozen sizes',()=>{
 for(const mib of [1,10,30])manifestCase({mib},args=>assert.equal(acceptance.assertFixtureCapability(acceptance.admitFixture(args)).mib,mib));
 for(const change of [{phase:2},{mib:2},{script:'caller.cjs'},{latencyProbe:true}])manifestCase(change,args=>assert.throws(()=>acceptance.admitFixture(args)));
 assert.throws(()=>acceptance.validateFixtureArguments(['exe','--packaged-fixture=x','--mib=1']));
});
test('shared runner and adapter imports are inert and both reject a fabricated capability',async()=>{
 assert.equal(typeof runner.runAdmittedControl,'function');
 const adapter=require('../desktop/packaged-control.cjs');
 await assert.rejects(runner.runAdmittedControl({scenario:'ordered-control',phase:1,mib:1}),/capability/);
 await assert.rejects(adapter.runPackagedControl({scenario:'ordered-control',phase:1,mib:1}),/capability/);
 assert.equal(Object.keys(require.cache).some(file=>/desktop[\\/]hub\.cjs$/.test(file)),false);
});
test('one finalizer writes completed raw evidence before summary and exits only once',async()=>{
 const calls=[],evidence={passed:true,errors:[]};
 await runner.finalizeAndExit({cleanup:async()=>calls.push('cleanup'),evidence,write:()=>calls.push('raw'),summary:()=>calls.push('hash-and-summary'),beforeExit:()=>calls.push('before-exit'),exit:code=>calls.push('exit:'+code)});
 assert.deepEqual(calls,['cleanup','raw','hash-and-summary','before-exit','exit:0']);
});
test('raw write failure cannot publish a passing summary',async()=>{
 const calls=[],evidence={passed:true,errors:[]};
 await runner.finalizeAndExit({cleanup:async()=>{},evidence,write:()=>{throw Error('disk failure');},summary:()=>calls.push('summary'),exit:code=>calls.push(code)});
 assert.equal(evidence.passed,false);assert.deepEqual(calls,[1]);
});
test('completion just before deadline cannot pass with cleanup after the absolute deadline',async()=>{
 const {supervise}=require('../scripts/packaged-supervisor.cjs');
 const result=await supervise({start:async()=>({completion:Promise.resolve({evidence:{scenario:'ordered-control'}})}),inspect:async()=>({}),validate:()=>{},close:()=>new Promise(resolve=>setTimeout(()=>resolve({cleanupObserved:true,activeProcesses:0}),45))},{timeoutMs:20,cleanupMs:70,intervalMs:5});
 assert.equal(result.accepted,false);assert.equal(result.status,'timeout');
});
test('ordered-control selects the fixed 300 second ceiling',()=>{
 const {parseArgs}=require('../scripts/packaged-supervisor.cjs');
 const args=['exe','asar','profile','out'].map(key=>'--'+key+'='+path.resolve(key));
 assert.equal(parseArgs([...args,'--scenario=ordered-control']).timeoutMs,300000);
 assert.throws(()=>parseArgs([...args,'--scenario=ordered-control','--timeout-ms=120000']));
});
test('main routes ordered-control exactly once before ordinary bootstrap imports or readiness',async()=>{
 const {Script}=require('node:vm'),calls=[],admitted={scenario:'ordered-control',profileDir:'C:\\synthetic'};
 const source=fs.readFileSync(path.join(__dirname,'../desktop/main.cjs'),'utf8');
 const boundedRequire=id=>{
  if(id==='electron')return {app:{exit:code=>calls.push('exit:'+code),whenReady:()=>{throw Error('Ordinary readiness called');}}};
  if(id==='./packaged-acceptance.cjs')return {validateFixtureArguments:()=>calls.push('validate'),admitFixture:()=>{calls.push('admit');return admitted;}};
  if(id==='./fixture-stages.cjs')return {createStages:()=>()=>{}};
  if(id==='./packaged-control.cjs')return {runPackagedControl:async value=>{assert.equal(value,admitted);calls.push('control');}};
  if(id.startsWith('node:'))return require(id);
  throw Error('Unexpected ordinary bootstrap import: '+id);
 };
 new Script(source).runInNewContext({require:boundedRequire,process:{argv:['exe','--packaged-fixture=C:\\private.json'],env:{}},console});await Promise.resolve();assert.deepEqual(calls,['validate','admit','control']);
});
test('synthetic request responses and inert scheduler are installed before Hub constructor',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../scripts/ordered-control-check.cjs'),'utf8'),a=source.indexOf('  const dependencies='),b=source.indexOf('  await hub.initializeRecovery()',a);
 assert.ok(a>0&&b>a);let observed;const evidence={providerCalls:[],errors:[]};
 const context={require,Hub:function(options){observed=options;assert.equal(options.fixtureDependencies.client.connected,false);this.client=options.fixtureDependencies.client;this.state={tasks:[{threadId:'thread',turnId:'turn'}]};},evidence,currentSample:null,runtime:'synthetic',store:{},latencyProbe:false,assert,structuredClone};
 require('node:vm').runInNewContext(source.slice(a,b),context);
 assert.ok(observed);const client=observed.fixtureDependencies.client;
 assert.equal(JSON.stringify(await client.request('turn/interrupt',{threadId:'thread',turnId:'turn'})),'{}');
 assert.equal((await client.request('thread/read',{threadId:'thread'})).thread.turns[0].status,'inProgress');
 assert.equal((await client.request('thread/start',{})).thread.id,'offline-thread');assert.equal((await client.request('turn/start',{})).turn.id,'offline-turn');
 await assert.rejects(client.request('unexpected',{}));assert.equal(evidence.errors[0].phase,'unexpected-synthetic-method');
 assert.throws(()=>client.connect(),/Offline/);assert.throws(()=>observed.fixtureDependencies.islandFactory({state:{world:{}}}).run(),/disabled/);
});
test('external denial and owned readonly IPC are installed before renderer load',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../scripts/ordered-control-check.cjs'),'utf8'),load=source.indexOf('await win.loadFile(');
 for(const statement of ['webRequest.onBeforeRequest','setPermissionRequestHandler','setWindowOpenHandler',"on('will-navigate'","ipcMain.handle('sunny:invoke'"])assert.ok(source.indexOf(statement)<load);
 assert.ok(source.includes('contextIsolation:true,sandbox:true,nodeIntegration:false'));
});
