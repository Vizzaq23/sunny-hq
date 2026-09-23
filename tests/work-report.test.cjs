const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createWorkReport}=require('../desktop/work-report.cjs');

const fixture={
 projects:[{id:'alpha',name:'Alpha'},{id:'beta',name:'Beta'}],
 tasks:[
  {id:'t-finished',projectId:'alpha',title:'Finished worker',status:'finished',createdAt:100,updatedAt:3000,messages:[{text:'PRIVATE_CHAT'}],prompt:'PRIVATE_PROMPT'},
  {id:'t-unknown',projectId:'beta',title:'Uncertain worker',status:'unknown',createdAt:100,updatedAt:3500,error:'PRIVATE_ERROR'},
  {id:'t-working',projectId:'beta',title:'Long run',status:'working',createdAt:100,updatedAt:500},
 ],
 missions:[
  {id:'m-review',projectId:'alpha',title:'Review this',status:'WAITING_FOR_REVIEW',connection:'connected',createdAt:100,updatedAt:4000,activeAttemptId:'a-review',attempts:[{id:'a-review',status:'finished'}],events:[],artifacts:[]},
  {id:'m-accepted',projectId:'beta',title:'Accepted voyage',status:'COMPLETE',connection:'connected',createdAt:100,updatedAt:5000,acceptedAt:4900,activeAttemptId:'a-accepted',attempts:[{id:'a-accepted',status:'finished'}],events:[],artifacts:[]},
 ],
 approvals:[],
};

test('reports saved work across projects without equating a finished turn to an accepted mission',()=>{
 const packet=createWorkReport(fixture,{projectIds:['alpha','beta'],since:1000,until:9000},9000);
 assert.deepEqual(packet.scope.projectIds,['alpha','beta']);
 assert.equal(packet.projects.find(p=>p.id==='alpha').missions[0].status,'review-needed');
 assert.equal(packet.projects.find(p=>p.id==='beta').missions[0].status,'accepted');
 assert.equal(packet.projects.find(p=>p.id==='alpha').tasks[0].status,'review-needed');
 assert.equal(packet.attention.some(x=>x.status==='unknown'),true);
 assert.equal(packet.projects.find(p=>p.id==='beta').tasks.some(x=>x.id==='t-working'),true);
 assert.equal(packet.coverage.source,'saved-local-records');
 assert.equal(packet.coverage.truncated,false);
 assert.doesNotMatch(JSON.stringify(packet),/PRIVATE_CHAT|PRIVATE_PROMPT|PRIVATE_ERROR/);
});

test('check, PR, deployment and approval observations retain source and uncertainty',()=>{
 const input=structuredClone(fixture);
 input.approvals=[{id:'approval-1',taskId:'t-finished',method:'item/commandExecution/requestApproval',params:{secret:'PRIVATE_APPROVAL'}}];
 input.missions[0].artifacts=[
  {id:'git-new',kind:'git',attemptId:'a-review',fingerprint:'new-source',recordedAt:5000},
  {id:'check-old',kind:'check',attemptId:'a-review',script:'test',status:'passed',fingerprint:'old-source',recordedAt:4500},
  {id:'check-failed',kind:'check',attemptId:'a-review',script:'build',status:'failed',fingerprint:'new-source',recordedAt:4600},
  {id:'pr-1',kind:'pull-request',attemptId:'a-review',number:42,state:'OPEN',checkStatus:'pending',recordedAt:4700,url:'https://example.com/pr/42'},
 ];
 const packet=createWorkReport(input,{projectIds:['alpha'],since:1000,until:9000},9000);
 const observations=packet.projects[0].observations;
 assert.equal(observations.find(item=>item.id==='check-old').status,'stale');
 assert.equal(observations.find(item=>item.id==='check-old').sourceTime,4500);
 assert.equal(observations.find(item=>item.id==='check-failed').status,'failed');
 assert.equal(observations.find(item=>item.id==='pr-1').status,'pending');
 assert.equal(observations.find(item=>item.kind==='deployment').status,'unobserved');
 assert.equal(observations.find(item=>item.id==='approval-1').status,'waiting-approval');
 assert.doesNotMatch(JSON.stringify(packet),/PRIVATE_APPROVAL/);
});

test('scope and packet bounds reject invalid requests and state truncation',()=>{
 assert.throws(()=>createWorkReport(fixture,{projectIds:['missing']},9000),/registered projects/);
 assert.throws(()=>createWorkReport(fixture,{since:9000,until:1000},9000),/valid report period/);
 assert.throws(()=>createWorkReport(fixture,{since:0,until:366*86400000},366*86400000),/at most one year/);
 assert.throws(()=>createWorkReport(fixture,{secret:'do-not-accept'},9000),/Invalid report scope/);
 const full=structuredClone(fixture);
 full.tasks=Array.from({length:1200},(_,index)=>({id:`task-${index}`,projectId:'alpha',title:'Work',status:'finished',createdAt:1000,updatedAt:9000}));
 const packet=createWorkReport(full,{projectIds:['alpha'],since:1000,until:9000},9000);
 assert.equal(packet.coverage.truncated,true);
 assert.ok(packet.projects[0].tasks.length<1200);
});

test('pre-range unresolved mission keeps its current-attempt observations visible',()=>{
 const input=structuredClone(fixture);
 input.missions[0].updatedAt=500;
 input.missions[0].artifacts=[{id:'old-check',kind:'check',attemptId:'a-review',script:'test',status:'passed',fingerprint:'source',recordedAt:450}];
 const packet=createWorkReport(input,{projectIds:['alpha'],since:1000,until:9000},9000);
 assert.equal(packet.projects[0].missions[0].id,'m-review');
 assert.equal(packet.projects[0].observations.find(item=>item.id==='old-check').status,'passed');
 assert.equal(packet.projects[0].observations.find(item=>item.kind==='deployment').status,'unobserved');
});
