const {test}=require('node:test');const assert=require('node:assert/strict');const {PassThrough}=require('node:stream');const {EventEmitter}=require('node:events');
const {CodexClient,codexLaunchEnv}=require('../desktop/codex.cjs');
function peer(){const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>child.emit('exit',0);return child;}
test('standalone Codex launch drops an inherited registered-app marker without changing other environment values',()=>{
 const inherited={CODEX_WINDOWS_REGISTERED_CORE:'1',PATH:'test-path',SUNNY_TEST_VALUE:'keep'};
 assert.equal(typeof codexLaunchEnv,'function');
 assert.deepEqual(codexLaunchEnv(inherited),{PATH:'test-path',SUNNY_TEST_VALUE:'keep'});
 assert.equal(inherited.CODEX_WINDOWS_REGISTERED_CORE,'1');
});
test('RPC assembles split lines and correlates out-of-order replies',async()=>{const p=peer();const c=new CodexClient();c.attach(p);const a=c.request('first',{}),b=c.request('second',{});p.stdout.write('{"id":2,"result":{"v":"b"}}\n{"id":');p.stdout.write('1,"result":{"v":"a"}}\n');assert.equal((await b).v,'b');assert.equal((await a).v,'a');c.close();});
test('disconnect rejects pending requests instead of hanging',async()=>{const p=peer();const c=new CodexClient();c.attach(p);const promise=c.request('first',{});p.emit('exit',1);await assert.rejects(promise,/disconnect/i);});
test('provider requests stay pending until explicitly answered',async()=>{const p=peer();const c=new CodexClient();c.attach(p);let outgoing='';p.stdin.on('data',x=>outgoing+=x);const event=new Promise(r=>c.once('request',r));p.stdout.write('{"id":"permission-1","method":"item/commandExecution/requestApproval","params":{"command":"npm test"}}\n');const request=await event;assert.equal(outgoing,'');c.respond(request.id,{decision:'decline'});assert.deepEqual(JSON.parse(outgoing),{id:'permission-1',result:{decision:'decline'}});c.close();});
test('provider errors reject with the actual diagnostic',async()=>{const p=peer();const c=new CodexClient();c.attach(p);const request=c.request('first',{});p.stdout.write('{"id":1,"error":{"code":-1,"message":"Sign in required"}}\n');await assert.rejects(request,/Sign in required/);c.close();});
test('transport failure kills the disconnected provider process',()=>{const p=peer();let kills=0;p.kill=()=>{kills++;p.emit('exit',1);};const c=new CodexClient();c.attach(p);p.stdin.emit('error',Error('broken pipe'));assert.equal(kills,1);assert.equal(c.child,null);assert.equal(c.connected,false);});
test('RPC timeouts are marked as uncertain outcomes',async()=>{const p=peer();const c=new CodexClient();c.attach(p);const request=c.request('turn/start',{},5);await assert.rejects(request,error=>error.code==='RPC_TIMEOUT'&&error.uncertain===true);c.close();});

test('disconnected transports cannot replay requests, notifications or diagnostics',()=>{
 const old=peer(),current=peer(),c=new CodexClient(),requests=[],notifications=[],diagnostics=[];
 c.on('request',m=>requests.push(m));c.on('notification',m=>notifications.push(m));c.on('diagnostic',m=>diagnostics.push(m));c.attach(old);c.disconnect('fixture disconnect');c.attach(current);
 old.stdout.write('{"id":77,"method":"item/commandExecution/requestApproval","params":{}}\n{"method":"turn/completed","params":{}}\n');old.stderr.write('stale diagnostic');
 assert.deepEqual(requests,[]);assert.deepEqual(notifications,[]);assert.deepEqual(diagnostics,[]);assert.equal(c.diagnostic,'');
 current.stdout.write('{"id":77,"method":"item/commandExecution/requestApproval","params":{"fixture":true}}\n');current.stderr.write('current diagnostic');assert.equal(requests.length,1);assert.equal(requests[0].params.fixture,true);assert.deepEqual(diagnostics,['current diagnostic']);c.close();
});
test('a stale transport reply cannot settle a current RPC',async()=>{
 const old=peer(),current=peer(),c=new CodexClient();c.attach(old);c.disconnect('fixture disconnect');c.attach(current);const result=c.request('thread/read',{});
 old.stdout.write('{"id":1,"result":{"transport":"stale"}}\n');current.stdout.write('{"id":1,"result":{"transport":"current"}}\n');assert.equal((await result).transport,'current');c.close();
});
test('partial protocol frames remain isolated to the current attachment',async()=>{
 const old=peer(),current=peer(),c=new CodexClient();c.attach(old);old.stdout.write('{"id":');c.disconnect('fixture disconnect');c.attach(current);const result=c.request('thread/read',{},30);
 current.stdout.write('{"id":');old.stdout.write('stale bytes');current.stdout.write('1,"result":{"transport":"current"}}\n');assert.equal((await result).transport,'current');c.close();
});
test('replacing a transport during a data batch ignores the remaining old messages',()=>{
 const old=peer(),current=peer(),c=new CodexClient(),requests=[];c.attach(old);c.on('request',m=>requests.push(m));c.on('notification',()=>{c.disconnect('fixture disconnect');c.attach(current);});
 old.stdout.write('{"method":"fixture/disconnect","params":{}}\n{"id":77,"method":"item/fileChange/requestApproval","params":{}}\n');assert.deepEqual(requests,[]);
 current.stdout.write('{"id":78,"method":"item/fileChange/requestApproval","params":{}}\n');assert.equal(requests.length,1);assert.equal(requests[0].id,78);c.close();
});
