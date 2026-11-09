import {useState} from 'react';
import {ArrowUpRight,ClipboardList,DoorOpen,MessageSquare} from 'lucide-react';
import type {Crew,Snapshot} from '../shared';
import {taskIsBusy,taskLabel} from '../taskFlow';

export function CrewProfileOverview({crew,snapshot,initialProjectId,onTask,onRoom}:{crew:Crew;snapshot:Snapshot;initialProjectId?:string;onTask?:(id:string)=>void;onRoom?:()=>void}){
 const [project,setProject]=useState(initialProjectId??'');
 const tasks=snapshot.tasks.filter(t=>!t.external&&t.crewId===crew.id&&(!project||t.projectId===project)).sort((a,b)=>Number(taskIsBusy(b))-Number(taskIsBusy(a))||b.updatedAt-a.updatedAt);
 const councils=(snapshot.localCrew?.councils??[]).filter(c=>(!project||c.projectId===project)&&(crew.id==='luffy'||c.contributions.some(item=>item.crewId===crew.id)||crew.id==='zoro'&&Boolean(c.review))).sort((a,b)=>b.updatedAt-a.updatedAt);
 const sessions=(snapshot.localCrew?.profiles[crew.id]?.sessions??[]).filter(s=>(!project||s.projectId===project)&&s.messages.length);
 const available=crew.spriteRow===undefined||snapshot.world?.residents.some(r=>r.id===crew.id&&r.recruited);
 return <div className="crew-profile-overview"><div className="profile-overview-toolbar"><label>Work in<select aria-label="Profile work project" value={project} onChange={e=>setProject(e.target.value)}><option value="">All projects</option>{snapshot.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{onRoom?<button disabled={!available} onClick={onRoom}><DoorOpen size={17}/>Open {crew.name}’s room</button>:null}</div>
  {!available?<p className="profile-record-note">Recruit this specialist on the island to open their workbench.</p>:null}
  <section className="profile-assignment"><h4><ClipboardList size={17}/>Assignments &amp; output</h4><p className="profile-record-note">Active conversations first. Saved replies are not captain acceptance.</p>
   {!tasks.length&&!councils.length&&!sessions.length?<div className="profile-work-empty"><MessageSquare size={28}/><strong>No recorded work here yet</strong><p>Open the room for a new brief, or use Local profile to set up this crewmate.</p></div>:null}
   {tasks.slice(0,5).map((task,index)=><details className="profile-work-record" key={task.id} open={index===0}><summary><span className={`profile-state ${task.status}`}>{taskLabel(task)}</span><strong>{task.title}</strong></summary><small>{snapshot.projects.find(p=>p.id===task.projectId)?.name??'Project unavailable'} · {new Date(task.updatedAt).toLocaleString()}</small><p>{task.error||task.lastAssistantPreview||'No saved reply yet.'}</p>{onTask?<button onClick={()=>onTask(task.id)}>Open assignment evidence <ArrowUpRight size={15}/></button>:null}</details>)}
   {tasks.length>5?<p className="profile-record-note">Showing five of {tasks.length} conversations. Captain’s Orders can find the others.</p>:null}
   {councils.slice(0,3).map(c=>{const item=c.contributions.find(value=>value.crewId===crew.id);const text=crew.id==='luffy'?c.summary||c.plan:crew.id==='zoro'&&c.review?c.review.text:item?.text;return <details className="profile-work-record" key={c.id}><summary><span className="profile-state">Local council · {crew.id==='luffy'?c.status:crew.id==='zoro'&&c.review?c.review.status:item?.status??c.status}</span><strong>{item?.objective??c.objective}</strong></summary><small>{snapshot.projects.find(p=>p.id===c.projectId)?.name??'Project unavailable'} · Last updated {new Date(c.updatedAt).toLocaleString()}</small><p>{text||item?.error||c.error||'No saved contribution yet.'}</p><small>Source: {c.id}. Local advice has not executed changes.</small></details>;})}
   {sessions.slice(0,3).map(session=>{const reply=[...session.messages].reverse().find(m=>m.role==='assistant');return <details className="profile-work-record" key={session.projectId}><summary><span className="profile-state">Local conversation · {session.status}</span><strong>{snapshot.projects.find(p=>p.id===session.projectId)?.name??'Project unavailable'}</strong></summary><p>{session.error||reply?.text||'No saved reply yet.'}</p>{reply?<time dateTime={new Date(reply.time).toISOString()}>{new Date(reply.time).toLocaleString()}</time>:null}</details>;})}
  </section>
 </div>;
}
