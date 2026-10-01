const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function fixture(){
 const file=require('node:path').join(__dirname,'../src/useMissionResultStatus.ts');assert.ok(fs.existsSync(file),'bound main result status loader exists');
 const slots=[],effects=[];let index=0;const react={useRef(v){const i=index++;return slots[i]??(slots[i]={current:v});},useState(v){const i=index++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useEffect(fn,deps){const i=index++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j]))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}};
 const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>id==='react'?react:require('../src/workContext.ts')});
 return{render(snapshot,invoke){index=0;const view=module.exports.useMissionResultStatuses(snapshot,invoke);while(effects.length)effects.shift()();return view;}};
}
const ref={kind:'reply',taskId:'t',messageId:'reply',sha256:'a'.repeat(64)};
const mission={id:'m',projectId:'p',revision:3,activeAttemptId:'a',selectedResult:{id:'r',attemptId:'a',producerTaskId:'t',ref}};
const snapshot={epoch:'e',workspace:{context:{missionId:'m'}},missions:[mission],tasks:[{id:'t',status:'finished',transcriptRevision:1}]};
const status={epoch:'e',missionId:'m',revision:3,attemptId:'a',resultId:'r',producerTaskId:'t',ref,available:true,preview:'Full result verified in main'};
test('late main result read cannot verify newer mission or transcript binding',async()=>{
 const f=fixture(),pending=[],invoke=async(action,args)=>new Promise(resolve=>pending.push({action,args,resolve}));
 f.render(snapshot,invoke);assert.equal(pending[0].action,'mission:resultStatus');
 const newer={...snapshot,tasks:[{...snapshot.tasks[0],transcriptRevision:2}]};let view=f.render(newer,invoke);assert.notEqual(view.m?.state,'ready');
 pending[0].resolve(status);await new Promise(setImmediate);view=f.render(newer,invoke);assert.notEqual(view.m?.state,'ready');
 pending[1].resolve({...status,available:false,unavailable:'Selected reply changed'});await new Promise(setImmediate);view=f.render(newer,invoke);assert.equal(view.m.state,'ready');assert.equal(view.m.status.available,false);
});
test('main result read error remains recoverable without manufactured available status',async()=>{
 const f=fixture(),invoke=async()=>{throw Error('Storage temporarily unavailable');};f.render(snapshot,invoke);await new Promise(setImmediate);const view=f.render(snapshot,invoke);assert.equal(view.m.state,'error');assert.match(view.m.error,/unavailable/);assert.equal(view.m.status,undefined);
});
test('result verification reads only explicit selection and retains at most two adjacent prior entries',async()=>{
 const f=fixture(),missions=Array.from({length:8},(_,i)=>({...mission,id:'m'+i})),calls=[];
 const invoke=async(action,args)=>{calls.push(args.missionId);return {...status,missionId:args.missionId};};
 for(let i=0;i<5;i++){
  const selected={...snapshot,missions,workspace:{context:{missionId:'m'+i}}};f.render(selected,invoke);f.render(selected,invoke);await new Promise(setImmediate);const view=f.render(selected,invoke);
  assert.equal(view['m'+i].state,'ready');assert.ok(Object.keys(view).length<=3);
 }
 assert.deepEqual(calls,['m0','m1','m2','m3','m4']);
});
