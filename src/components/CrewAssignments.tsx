import type {Task} from '../shared';
import {CREW_BY_ID} from '../data';
import {MissionExecution} from './MissionExecution';
import {CrewBadge} from './Chrome';
export function CrewAssignments({task,tasks,onOpen}:{task:Task;tasks:Task[];onOpen:(id:string)=>void}){
 const parent=tasks.find(t=>t.id===task.parentTaskId),children=tasks.filter(t=>t.parentTaskId===task.id).sort((a,b)=>a.createdAt-b.createdAt);
 if(!parent&&!task.captain&&!children.length)return null;
 return <section className="crew-assignments" aria-label="Crew assignments">
  {parent?<button className="captain-return" onClick={()=>onOpen(parent.id)}>← Back to Luffy · {parent.title}</button>:<header><b>Luffy’s crew assignments</b><small>{children.length?'Open a mission to talk directly to its specialist.':'Tell Luffy what you need. He’ll choose the right crewmate and bring back their results.'}</small></header>}
  {children.map(child=><button key={child.id} className="crew-assignment" onClick={()=>onOpen(child.id)}><CrewBadge crew={CREW_BY_ID.get(child.crewId)!} size="small"/><span><b>{CREW_BY_ID.get(child.crewId)?.name} · {child.title}</b><small>{child.status==='finished'?'Reported back':child.status==='unknown'?'Needs reconciliation':child.status==='waiting'?'Needs your approval':child.status}{child.error?' · '+child.error:''}</small><MissionExecution task={child}/></span><span aria-hidden="true">↗</span></button>)}
 </section>;
}
