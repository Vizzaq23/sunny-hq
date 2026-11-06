const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PassThrough}=require('node:stream');
const {EventEmitter}=require('node:events');
const {CodexClient}=require('../desktop/codex.cjs');

function peer(){const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>child.emit('exit',0);return child;}
function replace(client,child){client.disconnect('fixture disconnect');client.attach(child);}

test('stale approval and notification frames are ignored after reconnect',t=>{
 const old=peer(),current=peer(),client=new CodexClient(),requests=[],notifications=[];
 t.after(()=>client.close());client.on('request',m=>requests.push(m));client.on('notification',m=>notifications.push(m));client.attach(old);replace(client,current);
 old.stdout.write('{"id":77,"method":"item/commandExecution/requestApproval","params":{}}\n{"method":"turn/completed","params":{}}\n');
 assert.deepEqual(requests,[]);assert.deepEqual(notifications,[]);
 current.stdout.write('{"id":78,"method":"item/commandExecution/requestApproval","params":{}}\n{"method":"turn/completed","params":{"current":true}}\n');
 assert.equal(requests[0].id,78);assert.equal(notifications[0].params.current,true);
});

test('stale stderr cannot change diagnostics or emit diagnostic events',t=>{
 const old=peer(),current=peer(),client=new CodexClient(),diagnostics=[];
 t.after(()=>client.close());client.on('diagnostic',m=>diagnostics.push(m));client.attach(old);replace(client,current);
 old.stderr.write('stale diagnostic');assert.equal(client.diagnostic,'');assert.deepEqual(diagnostics,[]);
 current.stderr.write('current diagnostic');assert.equal(client.diagnostic,'current diagnostic');assert.deepEqual(diagnostics,['current diagnostic']);
});

test('a stale RPC reply cannot settle a current request',async t=>{
 const old=peer(),current=peer(),client=new CodexClient();t.after(()=>client.close());client.attach(old);replace(client,current);
 const result=client.request('thread/read',{},1000);old.stdout.write('{"id":1,"result":{"transport":"stale"}}\n');
 assert.equal(client.pending.size,1);current.stdout.write('{"id":1,"result":{"transport":"current"}}\n');assert.equal((await result).transport,'current');
});

test('partial protocol frames stay isolated across attachments',async t=>{
 const old=peer(),current=peer(),client=new CodexClient();t.after(()=>client.close());client.attach(old);old.stdout.write('{"id":');replace(client,current);
 const result=client.request('thread/read',{},1000);current.stdout.write('{"id":');old.stdout.write('stale bytes\n');current.stdout.write('1,"result":{"transport":"current"}}\n');
 assert.equal((await result).transport,'current');
});

test('replacement during a batch discards old frames and preserves the new partial frame',async t=>{
 const old=peer(),current=peer(),client=new CodexClient(),requests=[],notifications=[];t.after(()=>client.close());client.attach(old);client.on('request',m=>requests.push(m));
 client.on('notification',m=>{notifications.push(m.method);if(m.method==='fixture/replace'){replace(client,current);current.stdout.write('{"id":');}});
 old.stdout.write('{"method":"fixture/replace"}\n{"id":77,"method":"item/fileChange/requestApproval"}\n{"method":"turn/completed"}\n');
 assert.deepEqual(requests,[]);assert.deepEqual(notifications,['fixture/replace']);
 const result=client.request('thread/read',{},1000);current.stdout.write('1,"result":{"transport":"current"}}\n');assert.equal((await result).transport,'current');
});

test('stale process and stdin failures cannot disconnect a replacement',t=>{
 const old=peer(),current=peer(),client=new CodexClient();t.after(()=>client.close());client.attach(old);replace(client,current);
 old.emit('error',Error('old process'));old.emit('exit',1);old.stdin.emit('error',Error('old pipe'));
 assert.equal(client.connected,true);assert.equal(client.child,current);
});

test('reconnect diagnostics and exit reason belong only to the current transport',t=>{
 const old=peer(),current=peer(),client=new CodexClient(),disconnections=[];
 t.after(()=>client.close());client.on('disconnected',reason=>disconnections.push(reason));client.attach(old);
 old.stderr.write('Previous connection authentication failure');replace(client,current);
 assert.equal(client.diagnostic,'');
 current.stderr.write('Current connection pipe closed');current.emit('exit',1);
 assert.equal(disconnections.at(-1),'Codex disconnected (exit 1). Current connection pipe closed');
 assert.equal(disconnections.at(-1).includes('authentication failure'),false);
});
