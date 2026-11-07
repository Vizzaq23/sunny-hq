const {test}=require('node:test');const assert=require('node:assert/strict');
const {delegationSignals,freshDelegations}=require('../src/crewDelegation.ts');
const now=100000;
const captain={id:'captain',crewId:'luffy',projectId:'p',createdAt:1,updatedAt:1,status:'working'};
const worker={id:'worker',crewId:'franky',projectId:'p',parentTaskId:'captain',createdAt:now,updatedAt:now,status:'working'};
const snapshot=(tasks=[captain],sequence=1)=>({tasks,epoch:'live',sequence,persistence:{state:'saved'}});
test('only explicit same-project Luffy delegation produces outbound signals',()=>{
 assert.equal(delegationSignals(snapshot([captain,worker])).length,1);
 for(const changes of [{external:true},{parentTaskId:undefined},{projectId:'other'},{parentTaskId:'absent'}])assert.equal(delegationSignals(snapshot([captain,{...worker,...changes}])).length,0);
});
test('fresh assignments pulse once, never on duplicate, stale or recovered snapshots',()=>{
 const before=snapshot(),after=snapshot([captain,worker],2);
 assert.equal(freshDelegations(before,after,now).length,1);
 assert.equal(freshDelegations(after,{...after,sequence:3},now).length,0);
 for(const changes of [{epoch:'reconnected'},{sequence:1},{persistence:{state:'uncertain'}},{persistence:{state:'saved',uncertain:true}}])assert.equal(freshDelegations(before,{...after,...changes},now).length,0);
 assert.equal(freshDelegations(before,after,now+10001).length,0);
});
test('only finished saved replies produce inbound cues; failure and unknown are not results',()=>{
 for(const status of ['working','failed','unknown','interrupted','waiting'])assert.equal(delegationSignals(snapshot([captain,{...worker,status,lastAssistantPreview:'proposal'}])).filter(s=>s.direction==='inbound').length,0);
 const before=snapshot([captain,worker]),after=snapshot([captain,{...worker,status:'finished',lastAssistantPreview:'proposal',turnId:'turn-1'}],2);
 assert.equal(freshDelegations(before,after,now)[0].direction,'inbound');
 assert.equal(freshDelegations(after,{...after,sequence:3},now).length,0);
});
test('local councils use real queued assignment and ready contribution states',()=>{
 const council={id:'c',objective:'Goal',updatedAt:now,contributions:[{crewId:'nami',objective:'Plan',status:'queued',text:''}]};
 const before=snapshot(),assigned={...snapshot([],2),localCrew:{councils:[council]}};
 assert.equal(freshDelegations(before,assigned,now)[0].direction,'outbound');
 const returned={...assigned,sequence:3,localCrew:{councils:[{...council,contributions:[{...council.contributions[0],status:'ready',text:'Actual proposal'}]}]}};
 assert.deepEqual(freshDelegations(assigned,returned,now).map(s=>s.direction),['inbound']);
});

test('a metadata refresh cannot replay a finished reply with no turn ID',()=>{
 const task={...worker,status:'finished',lastAssistantPreview:'Already returned'};
 assert.deepEqual(freshDelegations(snapshot([captain,task]),snapshot([captain,{...task,updatedAt:now+1}],2),now+1),[]);
});
