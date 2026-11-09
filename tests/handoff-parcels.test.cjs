const {test}=require('node:test');
const assert=require('node:assert/strict');
const {query}=require('../desktop/handoff-parcels.cjs');
function fixture(){
 const roles=['nami','franky','usopp','zoro'],stages=['plan','work','validate','review'];
 const tasks=roles.map((crewId,i)=>({id:stages[i],projectId:'p',crewId,status:'finished',parentTaskId:'root',messages:[{id:'brief-'+i,role:'user',text:'Exact assignment '+i,time:10+i},{id:'reply-'+i,role:'assistant',text:'Generated result '+i,time:20+i}],secret:'must-not-leak'}));
 const attempt={id:'a',taskId:'root',taskIds:['root',...stages],workflow:{stages:stages.map(id=>({id,taskId:id,status:'complete'}))}};
 const mission={id:'m',projectId:'p',revision:4,activeAttemptId:'a',taskIds:[...attempt.taskIds],attempts:[attempt],artifacts:[{id:'files',projectId:'p',attemptId:'a',kind:'git',commit:'commit-a',fingerprint:'fp-a',paths:['src/real.ts'],recordedAt:1},{id:'check',projectId:'p',attemptId:'a',kind:'check',script:'test',status:'passed',exitCode:0,durationMs:80,commit:'commit-a',command:'PRIVATE COMMAND',stdout:'PRIVATE OUTPUT'}]};
 return {state:{projects:[{id:'p'},{id:'other'}],tasks,missions:[mission],runs:[]},args:{projectId:'p',missionId:'m',attemptId:'a',revision:4},mission,attempt,tasks};
}
test('three recorded stage relationships retain exact recipient messages and attributed results',()=>{
 const f=fixture(),before=JSON.stringify(f.state),r=query(f.state,f.args);
 assert.deepEqual(r.parcels.map(p=>[p.from.crewId,p.to.crewId]),[['nami','franky'],['franky','usopp'],['usopp','zoro']]);
 assert.equal(r.parcels[0].brief.text,'Exact assignment 1');assert.equal(r.parcels[0].brief.messageId,'brief-1');
 assert.equal(r.parcels[0].result.text,'Generated result 0');assert.match(r.parcels[0].result.attribution,/not verified/);
 assert.equal(r.evidence[0].commit,'commit-a');assert.deepEqual(r.evidence[0].paths,['src/real.ts']);
 assert.equal(r.evidence[1].exitCode,0);assert.doesNotMatch(JSON.stringify(r),/PRIVATE|must-not-leak/);
 assert.equal(JSON.stringify(f.state),before);assert.deepEqual(query(JSON.parse(before),f.args),r,'restart/replay does not create or reorder parcels');
});
test('requests reject stale revisions, wrong projects, unknown attempts and malformed shapes',()=>{
 const f=fixture();for(const args of [null,[],{}, {...f.args,revision:3},{...f.args,projectId:'other'},{...f.args,attemptId:'absent'},{...f.args,extra:true},{...f.args,revision:1.5},{...f.args,missionId:'m\0'}])assert.throws(()=>query(f.state,args));
});
test('historical selection never substitutes current attempt tasks or artifacts',()=>{
 const f=fixture();f.mission.activeAttemptId='new';f.mission.attempts.push({id:'new',taskIds:['foreign']});f.mission.taskIds.push('foreign');
 f.state.tasks.push({id:'foreign',projectId:'p',crewId:'nami',messages:[{role:'assistant',text:'NEW ATTEMPT PRIVATE'}]});
 f.attempt.workflow.stages[0].taskId='foreign';f.mission.artifacts.push({id:'new-files',projectId:'p',attemptId:'new',kind:'git',paths:['new-private.ts']});
 const r=query(f.state,f.args);assert.equal(r.historical,true);assert.equal(r.parcels[0].from,null);assert.equal(r.parcels[0].result,null);assert.doesNotMatch(JSON.stringify(r),/NEW ATTEMPT|new-private/);
});
test('missing and cross-project tasks remain explicit gaps without disclosure',()=>{
 const f=fixture();f.tasks[0].projectId='other';f.tasks[1].messages=[];f.tasks[2].external=true;
 const r=query(f.state,f.args);assert.equal(r.parcels[0].from,null);assert.equal(r.parcels[0].brief,null);assert.equal(r.parcels[1].to,null);
 f.attempt.workflow=undefined;assert.deepEqual(query(f.state,f.args).parcels,[]);
});
test('payload previews are bounded and truncation is explicit',()=>{
 const f=fixture();f.tasks[0].messages[1].text='x'.repeat(9000);f.tasks[1].messages[0].text='y'.repeat(9000);f.mission.artifacts[0].paths=Array.from({length:50},(_,i)=>'file-'+i);
 const r=query(f.state,f.args);assert.equal(r.parcels[0].result.text.length,2000);assert.equal(r.parcels[0].result.limited,true);assert.equal(r.parcels[0].brief.text.length,4000);assert.equal(r.parcels[0].brief.limited,true);assert.equal(r.evidence[0].paths.length,32);assert.equal(r.evidence[0].limited,true);
});
test('supervised dependencies are deduplicated and bound to attempt workers',()=>{
 const f=fixture();f.mission.runId='r';f.attempt.taskIds=['root'];f.mission.taskIds=['root'];
 f.state.runs=[{id:'r',projectId:'p',missionIds:['m'],revision:8,assignments:f.tasks.map((t,i)=>({id:'assignment-'+i,taskId:t.id,crewId:t.crewId,objective:'Recorded objective '+i,dependencies:i?['assignment-'+(i-1),'assignment-'+(i-1)]:[],sourceResult:{headCommit:'head-'+i,fingerprint:'fp-'+i,artifactHashes:[{path:'src/a.ts',sha256:'a'.repeat(64)}]}}))}];
 f.tasks.forEach((t,i)=>Object.assign(t,{runId:'r',assignmentId:'assignment-'+i}));f.tasks[1].messages=[];
 const r=query(f.state,f.args);assert.equal(r.parcels.length,3);assert.equal(r.parcels[0].brief.source,'assignment-objective');assert.equal(r.parcels[0].source.commit,'head-0');
 f.tasks[0].parentTaskId='old-attempt-root';const guarded=query(f.state,f.args);assert.equal(guarded.parcels[0].from,null);assert.equal(guarded.parcels[0].source,null);
});
