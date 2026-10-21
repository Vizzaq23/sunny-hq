import type {Task} from './shared';

// A retry retains the original report packet, but its result belongs to the replacement.
export function resolveReportTask<T extends Pick<Task,'id'|'projectId'|'crewId'|'retryTaskId'|'recoveryOfTaskId'>>(tasks:T[],original:T|undefined):T|undefined{
 if(!original)return undefined;
 let current=tasks.find(task=>task.id===original.id)??original;
 const visited=new Set<string>();
 while(current.retryTaskId&&!visited.has(current.id)){
  visited.add(current.id);
  const next=tasks.find(task=>task.id===current.retryTaskId);
  if(!next||visited.has(next.id)||next.recoveryOfTaskId!==current.id||next.projectId!==current.projectId||next.crewId!==current.crewId)break;
  current=next;
 }
 return current;
}
