const {test}=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {Hub}=require('../desktop/hub.cjs');
const {receiptStore}=require('./helpers/receipt-store.cjs');
const {initialCouncils}=require('../desktop/local-council.cjs');
const handoffs=require('../desktop/council-handoff.cjs');
const brief={title:'Selected utility change',objective:'Only this reviewed scope.',acceptanceCriteria:['One verified result'],completionBoundary:'review'};
function fixture(t,{trusted=false,saved={}}={}){
 let stored=saved,calls=0;const client=new EventEmitter();client.connected=true;client.request=async()=>{calls++;throw Error('No provider calls in this fixture');};client.close=()=>{};
 const hub=new Hub({home:process.cwd(),store:receiptStore({load:()=>stored,save:image=>{stored=structuredClone(image);},close:()=>{}}),catalog:{discoverProjects:()=>[{id:'p',path:process.cwd()}],discoverTools:()=>[],discoverAutomations:()=>[]},...(trusted?{fixtureDependencies:{client,supervision:true,scopeEnforcingProvider:()=>false,islandFactory:()=>({close(){}})}}:{})});
 t.after(()=>hub.close());hub.state.codex.status='connected';
 const record={id:'c',projectId:'p',objective:'PRIVATE original goal',status:'ready',summary:'PRIVATE council and journal content',contributions:[],createdAt:1,updatedAt:1};
 if(!saved.localCrew){hub.state.localCrew.profiles.luffy={...require('../desktop/local-crew.cjs').defaults('luffy'),model:'fixture:local',sessions:[]};hub.state.localCrew.councils=[record];}
 return {hub,record:hub.localCouncil.record('c'),saved:()=>stored,calls:()=>calls};
}
const args={id:'c',title:brief.title,objective:brief.objective,acceptanceCriteria:brief.acceptanceCriteria};
test('reserved council identity reaches actual Hub mission and run creation without exporting advice',async t=>{
 const f=fixture(t,{trusted:true});f.hub.evidence.gitState=async()=>{throw Error('Offline fixture stops before workspace effects');};
 const start=f.hub.startGoal.bind(f.hub);let pending;
 f.hub.startGoal=async(input,options)=>{pending=structuredClone(f.saved().localCrew.councils[0].handoff);assert.equal(pending.status,'pending');assert.deepEqual(input,{projectId:'p',...brief});return start(input,options);};
 const result=await f.hub.localCouncil.handoff(args);
 assert.equal(result.status,'blocked');assert.equal(f.hub.state.missions.length,1);assert.equal(f.hub.state.runs.length,1);
 assert.equal(f.hub.state.missions[0].id,pending.missionId);assert.equal(f.hub.state.runs[0].id,pending.runId);assert.equal(f.hub.state.missions[0].runId,pending.runId);
 assert.deepEqual(result.reviewedBrief,brief);assert.equal(f.calls(),0);assert.equal(f.hub.state.tasks.length,0);
 assert.doesNotMatch(JSON.stringify(f.hub.state.missions),/PRIVATE/);
 await assert.rejects(f.hub.localCouncil.handoff(args),/already has/);
 const restored=fixture(t,{saved:f.saved()});assert.deepEqual(restored.record.handoff.reviewedBrief,brief);assert.equal(restored.record.handoff.missionId,pending.missionId);
});
test('lost goal reply retains one reserved identity and brief across restart',async t=>{
 const f=fixture(t,{trusted:true});let calls=0;
 f.hub.evidence.gitState=async()=>{throw Error('Offline fixture stops before workspace effects');};const start=f.hub.startGoal.bind(f.hub);
 f.hub.startGoal=async(input,options)=>{calls++;await start(input,options);throw Error('Fixture reply lost after possible creation');};
 await assert.rejects(f.hub.localCouncil.handoff(args),/reply lost/);const identity=structuredClone(f.record.handoff);
 assert.equal(identity.status,'unknown');assert.deepEqual(identity.reviewedBrief,brief);assert.ok(handoffs.uuid(identity.missionId));
 const restored=fixture(t,{saved:f.saved()});assert.deepEqual(restored.record.handoff,identity);
 assert.equal(restored.hub.state.missions.length,1);assert.equal(restored.hub.state.missions[0].id,identity.missionId);assert.equal(restored.hub.state.runs[0].id,identity.runId);
 await assert.rejects(restored.hub.localCouncil.handoff(args),/already has/);assert.equal(calls,1);
});
test('mismatched goal result cannot replace the reserved handoff identity',async t=>{
 const f=fixture(t,{trusted:true});let identity;
 f.hub.startGoal=async()=>{identity=structuredClone(f.record.handoff);return {started:true,mission:{id:'foreign'},run:{id:'foreign'}};};
 await assert.rejects(f.hub.localCouncil.handoff(args),/different handoff identity/);
 assert.equal(f.record.handoff.status,'unknown');assert.equal(f.record.handoff.missionId,identity.missionId);assert.equal(f.record.handoff.runId,identity.runId);
});
test('malformed saved reviewed brief remains fenced and legacy history is not backfilled',()=>{
 const valid=handoffs.create(brief);for(const change of [{briefSha256:'wrong'},{reviewedBrief:{...brief,objective:'changed'}},{missionId:'bad'},{version:3}]){
  const [r]=initialCouncils([{id:'c',projectId:'p',status:'ready',handoff:{...valid,...change}}]);assert.equal(r.handoff.status,'unknown');assert.equal(r.handoff.reviewedBrief,undefined);
 }
 const [legacy]=initialCouncils([{id:'c',projectId:'p',status:'ready',handoff:{status:'pending',missionId:'old'}}]);assert.equal(legacy.handoff.status,'unknown');assert.equal(legacy.handoff.reviewedBrief,undefined);
});
test('private goal binding rejects edited scope, collisions and public identity injection',async t=>{
 const f=fixture(t,{trusted:true});f.record.handoff=handoffs.create(brief);const input={projectId:'p',...brief};
 await assert.rejects(f.hub.startGoal({...input,objective:'changed'},{councilId:'c'}),/handoff changed/);
 await assert.rejects(f.hub.startGoal({...input,missionId:f.record.handoff.missionId}),/Invalid bounded goal/);
 await assert.rejects(f.hub.createMission({...input,id:f.record.handoff.missionId}),/Unknown mission field/);
 await f.hub.createMission(input,f.record.handoff.missionId);
 await assert.rejects(f.hub.startGoal(input,{councilId:'c'}),/already exists/);
 await assert.rejects(f.hub.createMission(input,f.record.handoff.missionId),/existing reserved/);
 assert.equal(f.hub.state.missions.length,1);assert.equal(f.hub.state.runs.length,0);assert.equal(f.calls(),0);
});
test('normal closed admission creates no council receipt, mission, run or task',async t=>{
 const f=fixture(t);await assert.rejects(f.hub.localCouncil.handoff(args),/disabled pending a trusted reliability release/);
 assert.equal(f.record.handoff,undefined);for(const key of ['missions','runs','tasks'])assert.equal(f.hub.state[key].length,0);
 assert.equal(require('../desktop/supervised-runs.cjs').LIVE_SUPERVISION_ADMITTED,false);
});
test('renderer receives the reviewed snapshot but diagnostics never export its private text',async t=>{
 const f=fixture(t),h=handoffs.create(brief);f.record.handoff={...h,privateExtra:'not in renderer'};
 const state=require('../desktop/state-projection.cjs').createStateProjection().snapshot(f.hub.state);
 assert.deepEqual(state.localCrew.councils[0].handoff.reviewedBrief,brief);
 assert.equal(state.localCrew.councils[0].handoff.privateExtra,undefined);
 assert.doesNotMatch(JSON.stringify(f.hub.diagnosticTimeline({projectId:'p'})),/Only this reviewed scope|Selected utility change|not in renderer/);
});
