const {test}=require('node:test'),assert=require('node:assert/strict');
const {captainWatch}=require('../src/captainWatch.ts');
const task=(id,status='working',extra={})=>({id,title:id,status,projectId:'p',crewId:'franky',createdAt:1,updatedAt:1,transcriptRevision:1,messageCount:0,...extra});
const snapshot=extra=>({tasks:[task('t')],projects:[{id:'p',name:'Project'}],missions:[],approvals:[],runs:[],codex:{status:'connected'},persistence:{state:'saved'},...extra});
const request=(method='item/commandExecution/requestApproval')=>({id:'request',taskId:'t',method,params:{command:'npm test',questions:[{question:'Which file?'}]}});
const mission=(extra={})=>({id:'m',title:'Goal',projectId:'p',status:'RUNNING',connection:'connected',activeAttemptId:'a2',taskIds:['old','t'],attempts:[{id:'a1',taskIds:['old']},{id:'a2',taskIds:['t']}],updatedAt:1,...extra});
test('real permissions and questions are separate; removed request does not leave a phantom approval',()=>{
 const s=snapshot({approvals:[request()]});assert.equal(captainWatch(s)[0].label,'Permission requested');assert.equal(captainWatch(s)[0].detail,'npm test');
 s.approvals=[request('item/tool/requestUserInput')];delete s.approvals[0].params.command;assert.equal(captainWatch(s)[0].action,'Answer crew');assert.equal(captainWatch(s)[0].detail,'Which file?');
 s.approvals=[];s.tasks[0].status='waiting';assert.equal(captainWatch(s)[0].label,'Waiting — no request received');assert.equal(captainWatch(s)[0].action,'Inspect work');
});
test('offline, unknown and uncertain storage override pending permissions and working signals',()=>{
 for(const extra of [{codex:{status:'disconnected'}},{tasks:[task('t','unknown')]},{persistence:{state:'uncertain'}},{persistence:{state:'unsaved'}}]){
  const item=captainWatch(snapshot({approvals:[request()],...extra}))[0];assert.equal(item.lane,'attention');assert.equal(item.action,'Inspect recovery');assert.notEqual(item.label,'Permission requested');
 }
});
test('old attempts stay hidden unless they retain a request that needs reconciliation',()=>{
 const s=snapshot({tasks:[task('old','failed'),task('t')],missions:[mission()]});assert.deepEqual(captainWatch(s).map(x=>x.taskId),['t']);
 s.approvals=[{...request(),taskId:'old'}];const old=captainWatch(s).find(x=>x.taskId==='old');assert.equal(old.action,'Inspect recovery');assert.equal(old.attemptId,undefined);assert.equal(captainWatch(s).find(x=>x.taskId==='t').attemptId,'a2');
});
test('finished tools and assistant prose do not mark a running goal ready',()=>{
 const item=captainWatch(snapshot({tasks:[task('t','working',{latestActivity:'Completed · Command: npm test',lastAssistantPreview:'Everything is done!'})],missions:[mission()]}))[0];assert.equal(item.lane,'active');assert.equal(item.label,'Working');
});
test('only explicit goal review state creates a review row, with exact attempt, never acceptance',()=>{
 const s=snapshot({tasks:[task('t','finished')],missions:[mission()]});assert.equal(captainWatch(s).length,0);
 s.missions[0].status='WAITING_FOR_REVIEW';const item=captainWatch(s)[0];assert.equal(item.lane,'review');assert.equal(item.missionId,'m');assert.equal(item.attemptId,'a2');assert.match(item.detail,/acceptance is separate/);
 s.missions[0].status='COMPLETE';assert.equal(captainWatch(s).length,0);
});
test('run pause and unknown effects suppress task working display',()=>{
 for(const run of [{id:'r',phase:'paused'},{id:'r',phase:'unknown'},{id:'r',phase:'executing',controlReport:{unknownEffects:['x']}}]){const item=captainWatch(snapshot({tasks:[task('t','working',{runId:'r'})],runs:[run]}))[0];assert.equal(item.lane,'attention');assert.notEqual(item.label,'Working');}
});
test('external history is excluded, multiple requests count once, projection is immutable',()=>{
 const s=snapshot({tasks:[task('external','working',{external:true}),task('t')],approvals:[request(),{...request(),id:'second'}]}),before=structuredClone(s),items=captainWatch(s);assert.equal(items.length,1);assert.equal(items[0].requestCount,2);assert.deepEqual(s,before);
});
test('an old error on working task is contextual, not terminal failure',()=>{const item=captainWatch(snapshot({tasks:[task('t','working',{error:'Retrying earlier transient error'})]}))[0];assert.equal(item.label,'Working');});
test('goal review replaces stale active task row and clearly marks offline saved results',()=>{
 const s=snapshot({missions:[mission({status:'WAITING_FOR_REVIEW'})]});let items=captainWatch(s);assert.equal(items.length,1);assert.equal(items[0].id,'mission:m');
 s.tasks=[];s.codex.status='connecting';items=captainWatch(s);assert.equal(items[0].label,'Saved result — offline');assert.match(items[0].detail,/not connected/);
 s.missions[0].runId='r';s.runs=[{id:'r',phase:'unknown'}];assert.equal(captainWatch(s)[0].lane,'attention');assert.equal(captainWatch(s)[0].label,'Inspect saved goal');
});
