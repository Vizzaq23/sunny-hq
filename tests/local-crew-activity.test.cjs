const test=require('node:test');const assert=require('node:assert/strict');
const {localCrewActivity}=require('../src/localCrewActivity.ts');
const {crewSceneProjection}=require('../src/roomActivity.ts');
function fixture(){return {tasks:[],projects:[{id:'p'}],approvals:[],persistence:{state:'saved'},localCrew:{profiles:{franky:{model:'fixture:local',sessions:[]}},councils:[{id:'c',projectId:'p',status:'working',contributions:[{crewId:'franky',status:'working'},{crewId:'zoro',status:'ready'},{crewId:'law',status:'queued'}]}]}};}
test('live local replies drive honest ship/island states without mission acceptance',()=>{
 const s=fixture();assert.equal(crewSceneProjection(s,'franky').working,true);assert.match(crewSceneProjection(s,'franky').label,/Thinking locally/);
 assert.equal(crewSceneProjection(s,'luffy').working,false);assert.match(crewSceneProjection(s,'luffy').label,/Waiting/);
 assert.equal(crewSceneProjection(s,'zoro').working,false);assert.match(crewSceneProjection(s,'zoro').label,/not executed/);assert.equal(crewSceneProjection(s,'zoro').acceptanceCueEligible,undefined);
 assert.match(crewSceneProjection(s,'law').label,/Queued/);assert.equal(crewSceneProjection(s,'robin').working,false);
});
test('local activity cannot override selected missions, other projects or unknown execution',()=>{
 const s=fixture();assert.equal(localCrewActivity(s,'franky',{projectId:'q'}),undefined);assert.equal(localCrewActivity(s,'franky',{projectId:'p',taskId:'t'}),undefined);
 s.tasks.push({id:'t',crewId:'franky',status:'unknown'});assert.equal(localCrewActivity(s,'franky'),undefined);assert.equal(localCrewActivity(s,'morgans'),undefined);
});
test('stopping, failed storage and idle council do not animate continued work',()=>{
 const s=fixture();s.persistence.state='uncertain';assert.equal(crewSceneProjection(s,'franky').working,false);
 s.persistence.state='saved';s.localCrew.councils[0].status='interrupted';assert.equal(crewSceneProjection(s,'franky').working,false);
});
test('Luffy planning/synthesis and direct local chats derive only from real status',()=>{
 const s=fixture();s.localCrew.councils[0].status='planning';assert.equal(localCrewActivity(s,'luffy').working,true);
 s.localCrew.councils[0].status='synthesizing';assert.match(localCrewActivity(s,'luffy').label,/actual crew reports/);
 s.localCrew.councils=[];s.localCrew.profiles.franky.sessions=[{projectId:'p',status:'working'}];assert.match(localCrewActivity(s,'franky').label,/personal conversation/);
});

test('Morgans only appears working for an actual sanitized report, with storage and project scope intact',()=>{
 const s=fixture();s.localCrew.councils[0].status='ready';s.localCrew.councils[0].report={status:'working'};
 assert.equal(crewSceneProjection(s,'morgans').working,true);assert.match(crewSceneProjection(s,'morgans').label,/sanitized/);assert.equal(localCrewActivity(s,'morgans',{projectId:'other'}),undefined);
 s.persistence.state='uncertain';assert.equal(crewSceneProjection(s,'morgans').working,false);s.persistence.state='saved';s.localCrew.councils[0].report.status='ready';assert.equal(crewSceneProjection(s,'morgans').working,false);
});
