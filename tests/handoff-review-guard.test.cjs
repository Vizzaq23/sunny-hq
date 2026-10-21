const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Hub}=require('../desktop/hub.cjs');
function fixture({reviewed=false,recovery=false}={}){
 const task={id:'t',projectId:'p',crewId:'franky',title:'Prior work',status:'finished',messages:[{id:'reply',role:'assistant',text:'Saved result'}],...(recovery?{toolDispatchIntent:{id:'unknown'}}:{})};
 const hub=Object.create(Hub.prototype);hub.state={tasks:[task],runs:[],missions:reviewed?[{attempts:[{taskIds:['t'],status:'finished'}]}]:[]};let calls=0;
 hub.start=async args=>{calls++;return args;};return {hub,get calls(){return calls;}};
}
test('backend handoff cannot bypass a reviewed mission attempt',async()=>{
 const f=fixture({reviewed:true});await assert.rejects(f.hub.handoff({taskId:'t',crewId:'robin',prompt:'Review'}),{code:'MISSION_REVIEW_LOCK'});assert.equal(f.calls,0);
});
test('backend handoff cannot launch new work from an unresolved tool effect',async()=>{
 const f=fixture({recovery:true});await assert.rejects(f.hub.handoff({taskId:'t',crewId:'robin',prompt:'Review'}),{code:'TASK_RECOVERY_REQUIRED'});assert.equal(f.calls,0);
});
test('finished standalone task still hands its result to another crew member',async()=>{
 const f=fixture(),reply=await f.hub.handoff({taskId:'t',crewId:'robin',prompt:'Review the result'});assert.equal(f.calls,1);assert.equal(reply.projectId,'p');assert.equal(reply.crewId,'robin');assert.match(reply.prompt,/Saved result/);assert.match(reply.prompt,/Review the result/);
});
