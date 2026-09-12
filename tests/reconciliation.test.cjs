const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Hub}=require('../desktop/hub.cjs');

function fixture(t,read){
 const hub=new Hub({home:process.cwd(),store:{load:()=>({}),save(){},close(){}},catalog:{discoverProjects:()=>[{id:'p',path:process.cwd()}],discoverTools:()=>[],discoverAutomations:()=>[]}});
 t.after(()=>hub.close());hub.client.connected=true;hub.state.codex.status='connected';
 const parent={id:'parent',threadId:'captain-thread',projectId:'p',crewId:'luffy',captain:true,captainVersion:3,status:'unknown',messages:[]};
 const child={id:'child',threadId:'child-thread',projectId:'p',crewId:'chopper',parentTaskId:parent.id,status:'unknown',messages:[]};
 hub.state.tasks.push(parent,child);hub.gate.acquire(child.id,process.cwd());hub.loaded.add(parent.id);
 const calls=[];hub.client.request=async(method,params)=>{calls.push({method,params});if(method==='thread/read')return {thread:await read(params.threadId)};if(method==='turn/interrupt')return {};if(method==='turn/start')return {turn:{id:'new-turn'}};throw Error('Unexpected '+method);};
 return {hub,parent,child,calls};
}
const stopped=status=>({status:{type:'notLoaded'},turns:[{id:'old-turn',status,items:[]}]});

test('reconciling an already interrupted captain and child succeeds without another interrupt',async t=>{
 const {hub,parent,child,calls}=fixture(t,()=>stopped('interrupted'));
 await hub.interrupt(parent.id);
 assert.equal(parent.status,'interrupted');assert.equal(child.status,'interrupted');assert.equal(hub.gate.active.size,0);
 assert.deepEqual(calls.map(c=>c.method),['thread/read','thread/read']);
});

test('captain continuation resolves stopped unknown assignments and starts exactly one turn',async t=>{
 const {hub,parent,child,calls}=fixture(t,id=>stopped(id==='child-thread'?'completed':'interrupted'));
 await hub.send(parent.id,'Continue the verified work');
 assert.equal(child.status,'finished');assert.equal(parent.status,'working');assert.equal(parent.turnId,'new-turn');
 assert.equal(calls.filter(c=>c.method==='turn/start').length,1);assert.equal(calls.some(c=>c.method==='turn/interrupt'),false);
 assert.deepEqual(parent.messages.filter(m=>m.role==='user').map(m=>m.text),['Continue the verified work']);
});

test('an in-progress turn prevents continuation even when the outer thread says idle',async t=>{
 const {hub,parent,child,calls}=fixture(t,()=>({status:{type:'idle'},turns:[{id:'live-turn',status:'inProgress'}]}));
 await assert.rejects(hub.send(parent.id,'Continue'),/active|running/i);
 assert.equal(child.status,'working');assert.equal(child.turnId,'live-turn');assert.equal(hub.gate.active.has(child.id),true);
 assert.equal(calls.some(c=>c.method==='turn/start'),false);assert.equal(parent.messages.length,0);
});

test('unknown provider state keeps the checkout locked and cannot be reconciled as stopped',async t=>{
 const {hub,child,calls}=fixture(t,()=>({status:{type:'notLoaded'},turns:[]}));
 await assert.rejects(hub.interrupt(child.id),/could not be reconciled|uncertain|unknown/i);
 assert.equal(child.status,'unknown');assert.equal(hub.gate.active.has(child.id),true);
 assert.equal(calls.some(c=>c.method==='turn/interrupt'),false);
});

test('an unresolved captain cannot start a turn after its child is resolved',async t=>{
 const {hub,parent,calls}=fixture(t,id=>id==='child-thread'?stopped('completed'):{status:{type:'notLoaded'},turns:[]});
 await assert.rejects(hub.send(parent.id,'Continue'),/could not be reconciled|uncertain|unknown/i);
 assert.equal(parent.status,'unknown');assert.equal(parent.messages.length,0);assert.equal(calls.some(c=>c.method==='turn/start'),false);
});

test('a disconnected child read blocks continuation and preserves the checkout lock',async t=>{
 const {hub,parent,child,calls}=fixture(t,()=>{throw Error('Connection unavailable');});
 await assert.rejects(hub.send(parent.id,'Continue'));
 assert.equal(child.status,'unknown');assert.equal(hub.gate.active.has(child.id),true);assert.equal(parent.messages.length,0);
 assert.equal(calls.some(c=>c.method==='turn/start'),false);
});

test('concurrent captain sends cannot both resume the same stopped turn',async t=>{
 let release;const held=new Promise(resolve=>{release=resolve;});
 const {hub,parent,calls}=fixture(t,async()=>{await held;return stopped('interrupted');});
 const first=hub.send(parent.id,'First');const second=hub.send(parent.id,'Second');
 const outcomes=Promise.allSettled([first,second]);release();const results=await outcomes;
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(calls.filter(c=>c.method==='turn/start').length,1);
 assert.equal(parent.messages.filter(m=>m.role==='user').length,1);
});

test('an active thread without an identified active turn cannot interrupt a cached old turn',async t=>{
 const {hub,child,calls}=fixture(t,()=>({status:{type:'active',activeFlags:[]},turns:[{id:'old',status:'completed'}]}));
 child.turnId='old';await assert.rejects(hub.interrupt(child.id));
 assert.equal(child.status,'working');assert.equal(child.turnId,undefined);
 assert.equal(hub.gate.active.has(child.id),true);assert.equal(calls.some(c=>c.method==='turn/interrupt'),false);
});

test('a concurrent stop prevents continuation until its reconciliation finishes',async t=>{
 let release;const held=new Promise(resolve=>{release=resolve;});
 const {hub,parent,calls}=fixture(t,async()=>{await held;return stopped('interrupted');});
 const stop=hub.interrupt(parent.id);const send=hub.send(parent.id,'Continue');
 const outcomes=Promise.allSettled([stop,send]);release();const results=await outcomes;
 assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');
 assert.equal(calls.some(c=>c.method==='turn/start'),false);assert.equal(parent.messages.length,0);
});
