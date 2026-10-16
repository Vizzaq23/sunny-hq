const path=require('node:path'),assert=require('node:assert/strict');
const profile=require(path.resolve(__dirname,'../../sunny-responsive-20261001/desktop/mission-profile.cjs'));
function fixture(mib,dir){
 const state={projects:[{id:'synthetic-project',path:path.join(__dirname,'synthetic-project'),name:'Synthetic only',category:'development',opaqueProject:{preserve:'yes'}}],tasks:[],settings:{reducedMotion:true,notifications:false},missionBook:{version:2,opaqueBook:{preserve:'yes'},missions:[],workspace:{version:1,revision:1,context:{projectId:'synthetic-project',surface:'workbench',returnTo:{view:'home',projectId:'synthetic-project'}},drafts:[{id:'draft-brief',kind:'brief',projectId:'synthetic-project',title:'Synthetic unsaved brief',text:'Preserve draft text. '.repeat(256),criteria:['Transcript survives'],completionBoundary:'review',revision:1,updatedAt:1}],seenAcceptanceIds:[]}},news:{items:[]},world:{paused:true,jobs:[]},growth:{enabled:false,crew:{}},discussions:[],opaqueRoot:{preserve:'synthetic future data',text:'OPAQUE'.repeat(256)}};
 let bytes=Buffer.byteLength(JSON.stringify(state)),i=0;
 while(bytes<mib*1024*1024){
  const id='synthetic-'+i;
  const task={id,threadId:'thread-'+i,projectId:'synthetic-project',crewId:'franky',title:'Synthetic transcript '+i,status:'finished',createdAt:1,updatedAt:1,opaqueTask:{keep:true},messages:Array.from({length:40},(_,n)=>({id:id+'-message-'+n,role:n%2?'assistant':'user',time:1,text:('SYNTHETIC '+i+':'+n+' — deterministic transcript. ').padEnd(1024,'x'),opaqueMessage:{keep:n}}))};
  state.tasks.push(task);bytes+=Buffer.byteLength(JSON.stringify(task))+1;i++;
 }
 const taskIds=state.tasks.slice(0,4).map(t=>t.id);for(const task of state.tasks.slice(1,4))task.parentTaskId=taskIds[0];
 state.missionBook.missions.push({id:'mission-0',projectId:'synthetic-project',title:'Synthetic crew result',objective:'Preserve synthetic history',status:'WAITING_FOR_REVIEW',revision:2,createdAt:1,updatedAt:1,taskIds,activeAttemptId:'attempt-0',attempts:[{id:'attempt-0',taskId:taskIds[0],taskIds,status:'finished',startedAt:1,completedAt:1}],acceptanceCriteria:['Review exact history'],completionBoundary:'review',events:[{id:'event-0',schemaVersion:1,type:'RESULT_READY',sequence:2,time:1}],artifacts:[],opaqueMission:{keep:true}});
 assert.equal(profile.inspectMissionProfile(state).mode,'v2');return state;
}

module.exports={fixture};
