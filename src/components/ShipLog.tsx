import {useState} from 'react';
import type {Snapshot} from '../shared';
import {CREW_BY_ID} from '../data';
import {taskLabel} from '../taskFlow';
import {delegationSignals} from '../crewDelegation';

export function ShipLog({snapshot,onTask}:{snapshot:Snapshot;onTask:(id:string)=>void}){
 const [project,setProject]=useState(''),[limit,setLimit]=useState(40);
 const scoped={...snapshot,tasks:snapshot.tasks.filter(t=>!project||t.projectId===project),localCrew:snapshot.localCrew?{...snapshot.localCrew,councils:snapshot.localCrew.councils?.filter(c=>!project||c.projectId===project)}:undefined};
 const rows:{id:string;time:number;title:string;label:string;detail:string;taskId?:string;timeLabel?:string}[]=[...delegationSignals(scoped).map(signal=>({...signal,label:signal.direction==='outbound'?`Luffy → ${CREW_BY_ID.get(signal.crewId)?.name??signal.crewId}`:`${CREW_BY_ID.get(signal.crewId)?.name??signal.crewId} → Luffy · reply ready`})),
  ...(scoped.localCrew?.councils??[]).flatMap(c=>c.review?.text?[{id:`council-review:${c.id}`,time:c.updatedAt,timeLabel:'Council last updated',title:c.objective,label:`Zoro · local review ${c.review.status}`,detail:`Council ${c.id}\n${c.review.text}`}]:[]),
  ...scoped.tasks.filter(t=>!t.external).map(task=>({id:`update:${task.id}`,time:task.updatedAt,title:task.title,label:`${CREW_BY_ID.get(task.crewId)?.name??task.crewId} · ${taskLabel(task)}`,detail:task.lastAssistantPreview??task.error??'No saved reply. Open the conversation for recorded activity.',taskId:task.id})),
  ...(snapshot.missions??[]).filter(m=>!project||m.projectId===project).flatMap(m=>[
   ...m.events.map(e=>({id:`event:${m.id}:${e.id}`,time:e.time,title:m.title,label:e.type.replaceAll('_',' ').toLowerCase(),detail:`Saved mission event ${e.id} · sequence ${e.sequence} · mission ${m.id}`,taskId:undefined})),
   ...(m.reviewDecisions??[]).map(r=>({id:`review:${m.id}:${r.id}`,time:r.time,title:m.title,label:`Captain · ${r.decision.replaceAll('-',' ')}`,detail:`${r.note??'No review note.'}\nAttempt ${r.attemptId} · reviewed revision ${r.reviewedRevision}`,taskId:m.attempts.find(a=>a.id===r.attemptId)?.taskId}))
  ])].sort((a,b)=>b.time-a.time||a.id.localeCompare(b.id));
 return <section className="ship-event-log" aria-labelledby="ship-log-title"><header><div><span className="eyebrow">Recorded aboard the Sunny</span><h3 id="ship-log-title">Ship’s log</h3></div><label>Project<select value={project} onChange={e=>{setProject(e.target.value);setLimit(40);}}><option value="">All projects</option>{snapshot.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></header><p>Saved events and latest conversation states. Returned replies still need review; this is not a completion meter.</p>
  <ol>{rows.slice(0,limit).map(row=><li key={row.id}><time dateTime={new Date(row.time).toISOString()}>{row.timeLabel?row.timeLabel+' · ':''}{new Date(row.time).toLocaleString()}</time><details><summary><strong>{row.label}</strong><span>{row.title}</span></summary><p>{row.detail}</p>{row.taskId?<button onClick={()=>onTask(row.taskId!)}>Open conversation evidence</button>:null}</details></li>)}</ol>
  {!rows.length?<p>No recorded events in this project yet.</p>:null}{rows.length>limit?<button onClick={()=>setLimit(value=>value+40)}>Show more records ({rows.length-limit} remaining)</button>:null}
 </section>;
}
