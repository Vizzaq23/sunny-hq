const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');

const plain=value=>JSON.parse(JSON.stringify(value));
function snapshot(extra={}){
 return {protocolVersion:2,epoch:'session',sequence:0,workspace:{version:1,revision:0,context:null,drafts:[],seenAcceptanceIds:[]},persistence:{state:'saved',failures:0},projects:[],taskSummaries:[],approvals:[],...extra};
}
function hookFixture(){
 const states=[],reads=[];let subscriber;
 const react={
  useState(value){const index=states.length;states.push(value);return [value,next=>{states[index]=typeof next==='function'?next(states[index]):next;}];},
  useEffect(run){run();},useRef:value=>({current:value}),useCallback:callback=>callback
 };
 const source=fs.readFileSync(path.join(__dirname,'../src/useSunny.ts'),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(code,{exports,require(name){if(name==='react')return react;if(name==='./data')return {EMPTY_SNAPSHOT:{...snapshot(),tasks:[]}};if(name==='./transcriptState')return require('../src/transcriptState.ts');if(name==='./useMissionResultStatus')return {useMissionResultStatuses:()=>({})};throw Error('Unexpected hook dependency: '+name);},window:{sunny:{invoke:()=>new Promise(resolve=>reads.push(resolve)),subscribe:callback=>{subscriber=callback;return()=>{};}},setTimeout(){} }});
 exports.useSunny();
 return {get current(){return states[0];},get readCount(){return reads.length;},emit:event=>subscriber(event),async deliverInitial(value){reads[0](value);await new Promise(resolve=>setImmediate(resolve));},async deliverLatest(value){reads.at(-1)(value);await new Promise(resolve=>setImmediate(resolve));}};
}

test('early persistence health survives initial snapshot while initial projects and newer tasks are retained',async()=>{
 const f=hookFixture(),project={id:'p',name:'Saved project'},oldTask={id:'t',status:'working',transcriptRevision:1,messageCount:1},newTask={id:'t',status:'unknown',transcriptRevision:2,messageCount:1};
 f.emit({type:'task',epoch:'session',sequence:1,data:newTask});
 f.emit({type:'persistence',epoch:'session',sequence:2,data:{state:'unsaved',failures:2}});
 assert.equal(f.current.persistence.state,'unsaved');
 await f.deliverInitial(snapshot({projects:[project],taskSummaries:[oldTask]}));
 assert.deepEqual(plain(f.current.projects),[project]);
 assert.deepEqual(plain(f.current.tasks),[newTask]);
 assert.deepEqual(plain(f.current.persistence),{state:'unsaved',failures:2});
});
test('sequence gap during pending initial read requests a current snapshot after that read settles',async()=>{
 const f=hookFixture();f.emit({type:'task',epoch:'session',sequence:3,data:{id:'t',status:'finished',transcriptRevision:4,messageCount:2}});
 await f.deliverInitial(snapshot());assert.equal(f.readCount,2);
 await f.deliverLatest(snapshot({sequence:3,taskSummaries:[{id:'t',status:'finished',transcriptRevision:4,messageCount:2}]}));assert.equal(f.current.sequence,3);assert.equal(f.current.tasks[0].transcriptRevision,4);
});
test('a newer full snapshot remains authoritative over the pending initial response',async()=>{
 const f=hookFixture(),latest=snapshot({sequence:3,projects:[{id:'latest'}],taskSummaries:[{id:'t',status:'unknown',transcriptRevision:2,messageCount:1}],persistence:{state:'unsaved',failures:3}});
 f.emit({type:'snapshot',epoch:'session',sequence:3,data:latest});
 await f.deliverInitial(snapshot({projects:[{id:'stale'}],taskSummaries:[]}));
 assert.equal(f.current.sequence,3);assert.deepEqual(plain(f.current.tasks),latest.taskSummaries);assert.deepEqual(plain(f.current.projects),latest.projects);assert.deepEqual(plain(f.current.persistence),latest.persistence);
});
test('initial stored acceptance is historical while new broadcast receipt is eligible for a live cue',async()=>{
 const f=hookFixture();const stored={id:'m',acceptance:{legacy:false,id:'stored'},status:'COMPLETE'};
 await f.deliverInitial(snapshot({missions:[stored]}));assert.deepEqual(plain(f.current.liveAcceptanceIds),[]);
 f.emit({type:'snapshot',epoch:'session',sequence:1,data:snapshot({sequence:1,missions:[stored,{id:'next',status:'COMPLETE',acceptance:{legacy:false,id:'new-receipt'}}]})});
 assert.deepEqual(plain(f.current.liveAcceptanceIds),['new-receipt']);
});

test('gap snapshot and recovery snapshot never grant live receipt cues',async()=>{
 for(const priorGap of [false,true]){
  const f=hookFixture();await f.deliverInitial(snapshot({missions:[]}));
  if(priorGap)f.emit({type:'persistence',epoch:'session',sequence:2,data:{state:'saved',failures:0}});
  f.emit({type:'snapshot',epoch:'session',sequence:3,data:snapshot({sequence:3,missions:[{id:'m',acceptance:{id:'historical',legacy:false}}]})});
  assert.deepEqual(plain(f.current.liveAcceptanceIds),[]);
  f.emit({type:'snapshot',epoch:'session',sequence:4,data:snapshot({sequence:4,missions:[{id:'m',acceptance:{id:'historical',legacy:false}},{id:'next',acceptance:{id:'consecutive',legacy:false}}]})});
  assert.deepEqual(plain(f.current.liveAcceptanceIds),['consecutive']);
 }
});
test('uncertain receipt remains historical after storage recovery while ordinary pending permits consecutive receipt',async()=>{
 const f=hookFixture();await f.deliverInitial(snapshot({missions:[]}));
 f.emit({type:'snapshot',epoch:'session',sequence:1,data:snapshot({sequence:1,persistence:{state:'unsaved',uncertain:true,failures:1},missions:[{id:'m',acceptance:{id:'uncertain',legacy:false}}]})});
 assert.deepEqual(plain(f.current.liveAcceptanceIds),[]);
 f.emit({type:'snapshot',epoch:'session',sequence:2,data:snapshot({sequence:2,missions:[{id:'m',acceptance:{id:'uncertain',legacy:false}}]})});
 assert.deepEqual(plain(f.current.liveAcceptanceIds),[]);
 f.emit({type:'snapshot',epoch:'session',sequence:3,data:snapshot({sequence:3,persistence:{state:'pending',failures:0},missions:[{id:'m',acceptance:{id:'uncertain',legacy:false}},{id:'next',acceptance:{id:'ordinary',legacy:false}}]})});
 assert.deepEqual(plain(f.current.liveAcceptanceIds),['ordinary']);
});
