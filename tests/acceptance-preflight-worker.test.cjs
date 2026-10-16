const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {openOrderedStore}=require('../desktop/ordered-store.cjs');
const {Hub}=require('../desktop/hub.cjs');
const {MissionBook}=require('../desktop/missions.cjs');

const invalid=[
 ['unchecked criteria',()=>({criteria:[false]})],
 ['malformed string criterion',()=>({criteria:['true']})],
 ['malformed object criterion',()=>({criteria:[{confirmed:true}]})],
 ['nonarray criteria',()=>({criteria:{0:true,length:1}})],
 ['null criteria',()=>({criteria:null})],
 ['missing criteria',()=>({})],
 ['sparse criteria',()=>({criteria:new Array(1)})],
 ['too few criteria',()=>({criteria:[]})],
 ['too many criteria',()=>({criteria:[true,true]})],
 ['unknown acceptance criteria field',()=>({criteria:[true],unknownCriteria:true})]
];
for(const kind of ['sqlite','json'])for(const [label,invalidInput] of invalid)test(`${label} refuses before real ${kind} worker submission and valid acceptance still works`,{timeout:15000},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-acceptance-preflight-')),options={kind,file:path.join(dir,kind==='sqlite'?'sunny.sqlite':'state.json'),backupDir:path.join(dir,'backups')};let store,hub,reopened;
 t.after(async()=>{await Promise.allSettled([hub?.close(),store?.close(),reopened?.close()]);fs.rmSync(dir,{recursive:true,force:true});});
 const book=new MissionBook(),mission=book.create({projectId:'p',title:'Acceptance preflight',objective:'Reject invalid captain criteria without damaging storage',acceptanceCriteria:['Reviewed exact reply']}),attempt=book.begin(mission.id,mission.revision),text='Exact retained reply 🌞',task={id:attempt.taskId,projectId:'p',crewId:'franky',status:'finished',messages:[{id:'reply',role:'assistant',text,time:1}]};book.sync([task],[]);
 mission.selectedResult={id:'selected',attemptId:attempt.id,producerTaskId:task.id,ref:{kind:'reply',taskId:task.id,messageId:'reply',sha256:createHash('sha256').update(text).digest('hex')},selectedAt:1};
 store=await openOrderedStore(options);await store.barrier({projects:[{id:'p',path:dir}],tasks:[task],missionBook:book.data},'mission');await store.close();store=await openOrderedStore(options);
 hub=new Hub({home:dir,store,catalog:{discoverProjects:()=>[],discoverTools:()=>[],discoverAutomations:()=>[]}});let providerCalls=0;hub.client.request=async()=>{providerCalls++;throw Error('No provider effect permitted');};await hub.initializeRecovery();await hub.authorityQueue.flush();
 const before=structuredClone(hub.missionBook.data),health=structuredClone(hub.state.persistence),barrier=store.barrier.bind(store),checkpoint=store.checkpoint.bind(store),submitted=[];
 store.barrier=(image,reason)=>{submitted.push({reason,image:structuredClone(image)});return barrier(image,reason);};store.checkpoint=image=>{submitted.push({reason:null,image:structuredClone(image)});return checkpoint(image);};
 const args=()=>{const current=hub.missionBook.get(mission.id);return {missionId:current.id,revision:current.revision,resultId:current.selectedResult.id,resultSha256:current.selectedResult.ref.sha256};};
 await assert.rejects(hub.acceptMission({...args(),...invalidInput()}),error=>!error.persistence&&error.code!=='STORE_FAILED'&&/criteria|mission command/i.test(error.message));
 assert.deepEqual(submitted,[],'Invalid acceptance cannot submit any profile image or pending intent');assert.deepEqual(hub.missionBook.data,before,'Rejected criteria cannot alter live audit or mission authority');assert.deepEqual(hub.state.persistence,health,'Input rejection cannot mark storage failed');assert.equal(hub.authorityQueue.uncertain,null);assert.equal(hub.gate.blocked(dir),false);assert.equal(providerCalls,0);
 const accepted=await hub.acceptMission({...args(),criteria:[true]});assert.equal(accepted.status,'COMPLETE');assert.deepEqual(accepted.acceptance.criteria,[true]);assert.equal(submitted.filter(entry=>entry.reason==='acceptance').length,2,'Valid acceptance still requires intent and final durable barriers');assert.equal(providerCalls,0);
 await hub.close();reopened=await openOrderedStore(options);const durable=reopened.load().missionBook.missions.find(value=>value.id===mission.id);assert.equal(durable.status,'COMPLETE');assert.deepEqual(durable.acceptance,accepted.acceptance);assert.equal(durable.pendingAcceptance,undefined);
});
