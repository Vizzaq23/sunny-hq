const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {Hub}=require('../desktop/hub.cjs');
function fixture(t){
 let sequence=0;
 const store={load:()=>({projects:[{id:'p',path:process.cwd()}],tasks:[{id:'t',projectId:'p',crewId:'franky',threadId:'th',turnId:'turn',status:'idle',messages:[]}]}),barrier:async image=>({epoch:'test',sequence:++sequence,stateSha256:createHash('sha256').update(JSON.stringify(image)).digest('hex'),durableAt:Date.now()}),checkpoint:async function(image){return this.barrier(image);},flush:async()=>null,close:async()=>{}};
 const hub=new Hub({home:process.cwd(),store,catalog:{discoverProjects:()=>[],discoverTools:()=>[],discoverAutomations:()=>[]}});
 hub.ensure=async()=>{};hub.client.connected=true;hub.state.codex.status='connected';hub.loaded.add('t');
 const calls=[];hub.client.request=async method=>{calls.push(method);if(method==='mcpServer/tool/call')throw Object.assign(Error('Synthetic lost tool result'),{uncertain:true});if(method==='turn/start')return {turn:{id:'new-turn'}};return {};};
 t.after(()=>hub.close());return {hub,calls,task:hub.task('t'),store};
}
for(const terminal of ['completed','error'])test('unresolved tool survives '+terminal+' without completion or reservation release',async t=>{
 const {hub,task,calls}=fixture(t),events=[];hub.on('event',event=>events.push(event));
 await assert.rejects(hub.callTool({taskId:'t',server:'fixture',name:'tool',arguments:{}}));
 await hub.notification(terminal==='completed'?{method:'turn/completed',params:{threadId:'th',turn:{id:'turn',status:'completed'}}}:{method:'error',params:{threadId:'th',message:'Synthetic provider error',willRetry:false}});
 assert.equal(task.status,'unknown');assert.ok(task.toolDispatchIntent);assert.ok(hub.gate.active.has('t'));assert.equal(events.filter(e=>e.type==='completed').length,0);
 await assert.rejects(hub.send('t','Do not dispatch'),/unresolved|reconcil|outcome/i);assert.equal(calls.includes('turn/start'),false);
});
test('explicit Stop can interrupt known turn but cannot prove unresolved tool outcome',async t=>{
 const {hub,task,calls}=fixture(t);await assert.rejects(hub.callTool({taskId:'t',server:'fixture',name:'tool',arguments:{}}));
 await hub.interrupt('t');assert.ok(calls.includes('turn/interrupt'));assert.equal(task.status,'unknown');assert.ok(task.toolDispatchIntent);assert.ok(hub.gate.active.has('t'));
});
test('idle direct tool holds checkout while effect runs and releases only after known saved outcome',async t=>{
 const {hub,task}=fixture(t);let release;hub.client.request=async method=>{if(method==='mcpServer/tool/call')return new Promise(resolve=>release=resolve);return {};};
 const pending=hub.callTool({taskId:'t',server:'fixture',name:'tool',arguments:{}});pending.catch(()=>{});while(!release)await new Promise(resolve=>setImmediate(resolve));
 assert.ok(hub.gate.active.has('t'));assert.throws(()=>hub.gate.acquire('another',process.cwd()),/active|checkout|working|busy/i);
 release({synthetic:true});assert.deepEqual(await pending,{synthetic:true});assert.equal(task.toolDispatchIntent,undefined);assert.equal(hub.gate.active.has('t'),false);
});
test('known tool outcome keeps an already-owned active turn reservation',async t=>{
 const {hub,task}=fixture(t);task.status='working';hub.gate.acquire('t',process.cwd());hub.client.request=async()=>({synthetic:true});
 await hub.callTool({taskId:'t',server:'fixture',name:'tool',arguments:{}});assert.equal(task.status,'working');assert.ok(hub.gate.active.has('t'));
});
test('direct tool conflicts with another checkout writer before intent or effect',async t=>{
 const {hub,task,calls}=fixture(t);hub.gate.acquire('other',process.cwd());await assert.rejects(hub.callTool({taskId:'t',server:'fixture',name:'tool',arguments:{}}),/checkout|writing/i);assert.equal(task.toolDispatchIntent,undefined);assert.deepEqual(calls,[]);assert.ok(hub.gate.active.has('other'));assert.equal(hub.gate.active.has('t'),false);
});
test('temporary direct tool reservation awaits exact saved known outcome',async t=>{
 const {hub,task,store}=fixture(t),barrier=store.barrier;let release,held=false;store.barrier=async image=>{if(!held&&!image.tasks[0].toolDispatchIntent){held=true;await new Promise(resolve=>release=resolve);}return barrier(image);};hub.client.request=async()=>({synthetic:true});const pending=hub.callTool({taskId:'t',server:'fixture',name:'tool',arguments:{}});pending.catch(()=>{});while(!release)await new Promise(resolve=>setImmediate(resolve));try{assert.ok(task.toolDispatchIntent);assert.ok(hub.gate.active.has('t'));}finally{release();}await pending;assert.equal(task.toolDispatchIntent,undefined);assert.equal(hub.gate.active.has('t'),false);store.barrier=barrier;
});
for(const intent of ['toolDispatchIntent','replacementThreadIntent','approvalResponseIntent'])test('captain '+intent+' blocks terminal send and terminal release',async t=>{
 const {hub,task,calls}=fixture(t);task.captain=true;task.crewId='luffy';task.status='finished';task[intent]={id:'unresolved',state:'prepared'};await assert.rejects(hub.send(task.id,'Do not dispatch'),/unresolved|reconcil|outcome/i);assert.deepEqual(calls,[]);await hub.notification({method:'turn/completed',params:{threadId:'th',turn:{id:'turn',status:'completed'}}});assert.equal(task.status,'unknown');assert.ok(hub.gate.active.has(task.id));assert.equal(hub.hasTaskRecoveryIntent(task),true);
});
test('submitted approval response is not an unresolved effect fence',async t=>{
 const {hub,task}=fixture(t);task.approvalResponseIntent={id:'submitted',state:'submitted'};assert.equal(hub.hasTaskRecoveryIntent(task),false);await hub.notification({method:'turn/completed',params:{threadId:'th',turn:{id:'turn',status:'completed'}}});assert.equal(task.status,'finished');assert.equal(hub.gate.active.has(task.id),false);
});
