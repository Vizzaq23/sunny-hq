const {test}=require('node:test');
const assert=require('node:assert/strict');
const {broadcast,broadcastEnvelope}=require('../desktop/broadcast.cjs');
const surface=send=>({isDestroyed:()=>false,webContents:{isDestroyed:()=>false,send}});
test('both surfaces receive the same producer envelope without losing epoch or sequence',()=>{
 assert.equal(typeof broadcastEnvelope,'function');const received=[];
 const envelope={type:'transcript:delta',epoch:'fixture',sequence:4,data:{taskId:'t',revision:2}};
 broadcastEnvelope([surface((channel,event)=>received.push({channel,event})),surface((channel,event)=>received.push({channel,event}))],envelope);
 assert.equal(received.length,2);assert.ok(received.every(({channel,event})=>channel==='sunny:event'&&event===envelope));
});
test('closing surfaces cannot abort the common event for another window',()=>{
 assert.equal(typeof broadcastEnvelope,'function');let received;
 const envelope={type:'snapshot',epoch:'fixture',sequence:1,data:{protocolVersion:2}};
 broadcastEnvelope([undefined,surface(()=>{throw Error('Destroyed renderer');}),{isDestroyed:()=>true},surface((_channel,event)=>received=event)],envelope);
 assert.equal(received,envelope);
});
test('legacy unsequenced private navigation delivery remains compatible',()=>{
 let received;broadcast([surface((_channel,event)=>received=event)],'workspace:open',{taskId:'t'});
 assert.deepEqual(received,{type:'workspace:open',data:{taskId:'t'}});
});
