import type {TaskSummary as Task} from '../shared';
export function MissionExecution({task}:{task:Task}){
 const tokens=task.tokenUsage?.total.totalTokens;
 return <span className="mission-execution">{task.model?<span>{task.model} · {task.effort?`${task.effort} reasoning`:'provider reasoning default'}</span>:null}{task.selectionReason?<small>{task.selectionReason}</small>:null}{tokens!==undefined?<small>{tokens.toLocaleString()} reported session tokens</small>:null}</span>;
}
