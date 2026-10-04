// Main-derived pending identity. Provider text never creates a call.
function callBinding(state,approval){
 const task=state.tasks?.find(t=>t.id===approval.taskId);if(!task)return;
 const mission=state.missions?.find(m=>m.taskIds?.includes(task.id)&&m.runId);
 const run=state.runs?.find(r=>r.id===(task.runId||mission?.runId)||r.coordinator?.taskId===task.id||r.coordinatorHistory?.some(c=>c.taskId===task.id));
 if(!run||run.projectId!==task.projectId)return;
 const attempt=mission?.attempts?.find(a=>a.taskIds.includes(task.id));
 return {requestId:approval.id,projectId:run.projectId,runId:run.id,attemptId:attempt?.id||'none',revision:run.revision};
}
function assertBinding(actual,input){if(!actual||actual.requestId!==input.requestId||actual.projectId!==input.projectId||actual.runId!==input.runId||actual.attemptId!==input.attemptId||actual.revision!==(input.expectedRevision??input.revision))throw Error('Call binding or revision changed. Review the current request.');}
function validatePresentation(run,{fields,check,array,string,integer,time}){if(run.presentation===undefined)return;fields(run.presentation,['calls']);array(run.presentation.calls,1000);const seen=new Set();for(const c of run.presentation.calls){fields(c,['requestId','projectId','runId','attemptId','revision','state','time'],['taskId','type','resolved']);check((c.taskId===undefined||string(c.taskId))&&(c.type===undefined||['input','permission'].includes(c.type))&&(c.resolved===undefined||typeof c.resolved==='boolean'));check(string(c.requestId)&&c.projectId===run.projectId&&c.runId===run.id&&string(c.attemptId)&&integer(c.revision)&&c.revision<=run.revision&&['seen','snoozed'].includes(c.state)&&time(c.time));const key=JSON.stringify([c.requestId,c.attemptId,c.revision]);check(!seen.has(key));seen.add(key);}}
module.exports={callBinding,assertBinding,validatePresentation};
