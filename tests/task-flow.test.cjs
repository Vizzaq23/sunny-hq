const {test}=require('node:test');
const assert=require('node:assert/strict');
const {taskIsBusy,taskNeedsAttention,taskFamilies,filterFamilies,taskGuidance}=require('../src/taskFlow.ts');
const task=(id,status,extra={})=>({id,status,title:id,crewId:'luffy',projectId:'p1',createdAt:1,updatedAt:1,transcriptRevision:1,messageCount:0,...extra});
test('ready_review_stays_actionable and accepted history is separate',()=>{
 const {missionPhase,workEntries}=require('../src/taskFlow.ts');
 assert.equal(typeof missionPhase,'function');
 assert.equal(missionPhase({status:'WAITING_FOR_REVIEW'}),'review');
 assert.equal(missionPhase({status:'COMPLETE',acceptance:{legacy:true}}),'review','historical acceptance lacks current result binding');
 assert.equal(missionPhase({status:'COMPLETE',acceptance:{id:'receipt'}}),'review','missing main result status never projects success');
 const missions=[{id:'m',title:'Mission',projectId:'p1',status:'WAITING_FOR_REVIEW',taskIds:['t'],updatedAt:2}];
 const entries=workEntries(missions,[task('t','finished'),task('ordinary','finished')]);
 assert.deepEqual(entries.map(e=>[e.kind,e.phase]),[['mission','review'],['conversation','conversation']]);
});

test('stopped tasks offer continuation rather than claiming a result is ready',()=>{
 assert.equal(typeof taskGuidance,'function');assert.equal(taskGuidance(task('stopped','interrupted')).action,'Continue task');
 assert.equal(taskGuidance(task('unknown','unknown')).action,'Check status');
 assert.equal(taskGuidance(task('done','finished')).action,'Open result');
 assert.match(taskGuidance(task('failed','failed')).detail,/failed/i);
});

test('approval waits and uncertain tasks stay blocked and visible for attention',()=>{
 for(const status of ['waiting','awaiting-approval','unknown']){
  assert.equal(taskIsBusy(task('t',status)),true,status);
  assert.equal(taskNeedsAttention(task('t',status)),true,status);
 }
 assert.equal(taskIsBusy(task('t','starting')),true);
 assert.equal(taskNeedsAttention(task('t','starting')),false);
 assert.equal(taskIsBusy(task('t','finished')),false);
});
test('a specialist needing approval raises its captain family into attention without duplicating tasks',()=>{
 const tasks=[task('captain','working'),task('child','waiting',{parentTaskId:'captain',crewId:'franky',updatedAt:8}),task('done','finished')];
 const families=taskFamilies(tasks);
 assert.equal(families.length,2);
 assert.equal(families[0].task.id,'captain');
 assert.equal(families[0].phase,'attention');
 assert.equal(families[0].updatedAt,8);
 assert.deepEqual(families[0].children.map(t=>t.id),['child']);
 assert.equal(tasks[0].status,'working');
});
test('active children keep a completed captain family active and orphan assignments remain accessible',()=>{
 const families=taskFamilies([task('captain','finished'),task('child','starting',{parentTaskId:'captain'}),task('orphan','unknown',{parentTaskId:'missing'})]);
 assert.equal(families.find(f=>f.task.id==='captain').phase,'active');
 assert.equal(families.find(f=>f.task.id==='orphan').phase,'attention');
});
test('search finds specialist work and project names while respecting project and phase filters',()=>{
 const families=taskFamilies([task('captain','working'),task('child','working',{parentTaskId:'captain',title:'Fix checkout form',crewId:'franky'}),task('other','finished',{projectId:'p2'})]);
 const projects=[{id:'p1',name:'Storefront'},{id:'p2',name:'Portfolio'}];
 assert.deepEqual(filterFamilies(families,{query:'checkout',projectId:'p1',phase:'active'},projects).map(f=>f.task.id),['captain']);
 assert.equal(filterFamilies(families,{query:'storefront'},projects).length,1);
 assert.equal(filterFamilies(families,{query:'checkout',projectId:'p2'},projects).length,0);
});
