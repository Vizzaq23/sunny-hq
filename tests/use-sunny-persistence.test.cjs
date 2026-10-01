const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');

const plain=value=>JSON.parse(JSON.stringify(value));
function snapshot(extra={}){
 return {workspace:{version:1,revision:0,context:null,drafts:[],seenAcceptanceIds:[]},persistence:{state:'saved',failures:0},projects:[],tasks:[],approvals:[],...extra};
}
function hookFixture(){
 const states=[];let resolveInitial,subscriber;
 const react={
  useState(value){const index=states.length;states.push(value);return [value,next=>{states[index]=typeof next==='function'?next(states[index]):next;}];},
  useEffect(run){run();},useRef:value=>({current:value}),useCallback:callback=>callback
 };
 const source=fs.readFileSync(path.join(__dirname,'../src/useSunny.ts'),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(code,{exports,require(name){if(name==='react')return react;if(name==='./data')return {EMPTY_SNAPSHOT:snapshot()};throw Error('Unexpected hook dependency: '+name);},window:{sunny:{invoke:()=>new Promise(resolve=>{resolveInitial=resolve;}),subscribe:callback=>{subscriber=callback;return()=>{};}},setTimeout(){} }});
 exports.useSunny();
 return {get current(){return states[0];},emit:event=>subscriber(event),async deliverInitial(value){resolveInitial(value);await new Promise(resolve=>setImmediate(resolve));}};
}

test('early persistence health survives initial snapshot while initial projects and newer tasks are retained',async()=>{
 const f=hookFixture(),project={id:'p',name:'Saved project'},oldTask={id:'t',status:'working'},newTask={id:'t',status:'unknown',messages:[{id:'m',text:'Newest checkpoint'}]};
 f.emit({type:'task',data:newTask});
 f.emit({type:'persistence',data:{state:'unsaved',failures:2}});
 assert.equal(f.current.persistence.state,'unsaved');
 await f.deliverInitial(snapshot({projects:[project],tasks:[oldTask]}));
 assert.deepEqual(plain(f.current.projects),[project]);
 assert.deepEqual(plain(f.current.tasks),[newTask]);
 assert.deepEqual(plain(f.current.persistence),{state:'unsaved',failures:2});
});
test('a newer full snapshot remains authoritative over the pending initial response',async()=>{
 const f=hookFixture(),latest=snapshot({projects:[{id:'latest'}],tasks:[{id:'t',status:'unknown'}],persistence:{state:'unsaved',failures:3}});
 f.emit({type:'snapshot',data:latest});
 await f.deliverInitial(snapshot({projects:[{id:'stale'}],tasks:[]}));
 assert.deepEqual(plain(f.current),latest);
});
