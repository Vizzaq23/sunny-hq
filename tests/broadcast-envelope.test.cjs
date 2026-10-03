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
test('broadcast projection exposes committed run decisions without private paths or replay responses',()=>{
 const {createStateProjection}=require('../desktop/state-projection.cjs'),producer=createStateProjection({epoch:'run'}),run={id:'r',projectId:'p',revision:4,phase:'blocked',missionIds:[],assignments:[{id:'a',crewId:'franky',roleId:'builder',capability:'implementation',objective:'Inspect',state:'queued',ownedPaths:['private'],workspaceId:'private'}],decisions:[{id:'d',option:'Wait',reason:'Missing scope',dissent:['Needs review'],owner:'captain',nextAction:'Set scope',reopenEvidence:'New instruction',details:{reason:'Missing scope',secret:'private'}}],workspaces:[{canonicalRoot:'private'}],coordinatorCalls:[{response:'private'}],opaque:'private'};
 const envelope=producer.event('snapshot',{tasks:[],runs:[run]});assert.equal(envelope.data.runs[0].revision,4);assert.equal(envelope.data.runs[0].decisions[0].reason,'Missing scope');assert.ok(!JSON.stringify(envelope).includes('private'));run.revision++;assert.equal(envelope.data.runs[0].revision,4);
});
