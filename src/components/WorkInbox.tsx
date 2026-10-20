import {useState} from 'react';
import {ArrowUpRight,Search} from 'lucide-react';
import type {Approval,Project,TaskSummary} from '../shared';
import {ALL_CREW,CREW_BY_ID,formatRelative} from '../data';
import {taskGuidance,taskLabel} from '../taskFlow';
import {inboxLane,inboxLanes,searchLocalTasks,type InboxLane} from '../workNavigation';
export function WorkInbox({tasks,projects,approvals,onOpen}:{tasks:TaskSummary[];projects:Project[];approvals:Approval[];onOpen:(id:string)=>void}){
 const [query,setQuery]=useState(''),[project,setProject]=useState(''),[crew,setCrew]=useState(''),[lane,setLane]=useState<InboxLane|'all'>('all'),[limit,setLimit]=useState(24);
 const matched=searchLocalTasks(tasks,projects,ALL_CREW,query,project,crew);
 const filtered=matched.filter(task=>lane==='all'||inboxLane(task,approvals)===lane).sort((a,b)=>inboxLanes.findIndex(l=>l.id===inboxLane(a,approvals))-inboxLanes.findIndex(l=>l.id===inboxLane(b,approvals)));
 const visible=filtered.slice(0,limit);
 const reset=()=>setLimit(24);
 return <section className="work-inbox" aria-label="Local work inbox">
  <div className="work-inbox-tools"><label className="work-search"><Search size={18} aria-hidden="true"/><span className="sr-only">Search local work</span><input type="search" value={query} onChange={e=>{setQuery(e.target.value);reset();}} placeholder="Find a task, project or crew member…"/></label>
   <label><span>Project</span><select value={project} onChange={e=>{setProject(e.target.value);reset();}}><option value="">All projects</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <label><span>Crew</span><select value={crew} onChange={e=>{setCrew(e.target.value);reset();}}><option value="">Everyone</option>{ALL_CREW.filter(c=>tasks.some(t=>!t.external&&t.crewId===c.id)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
  </div>
  <div className="work-inbox-filters" aria-label="Filter work by state"><button aria-pressed={lane==='all'} onClick={()=>{setLane('all');reset();}}>All work <b>{matched.length}</b></button>{inboxLanes.map(item=><button key={item.id} data-lane={item.id} aria-pressed={lane===item.id} onClick={()=>{setLane(item.id);reset();}}>{item.label} <b>{matched.filter(t=>inboxLane(t,approvals)===item.id).length}</b></button>)}</div>
  <p className="work-inbox-count" role="status">Showing {visible.length} of {filtered.length} matching conversations</p>
  <div className="work-inbox-groups">{inboxLanes.filter(item=>lane==='all'||lane===item.id).map(item=>{
   const members=visible.filter(task=>inboxLane(task,approvals)===item.id);if(!members.length)return null;
   return <section key={item.id} data-lane={item.id} className="work-inbox-group"><header><h3>{item.label}</h3><p>{item.description}</p></header>{members.map(task=>{
    const pending=approvals.some(a=>a.taskId===task.id),guidance=taskGuidance(task);
    return <button className="work-inbox-row" key={task.id} onClick={()=>onOpen(task.id)}><span className="work-inbox-person" aria-hidden="true">{(CREW_BY_ID.get(task.crewId)?.name??'Crew').slice(0,1)}</span><span className="work-inbox-copy"><strong>{task.title}</strong><small>{projects.find(p=>p.id===task.projectId)?.name??'Project unavailable'} · {CREW_BY_ID.get(task.crewId)?.name??'Crew'} · {formatRelative(task.updatedAt)}</small><span>{pending?'A permission request needs your review.':task.error?'Review the saved error before continuing.':guidance.detail}</span></span><span className="work-inbox-action"><em>{pending?'Needs approval':task.error?'Needs attention':taskLabel(task)}</em><span>{pending?'Review request':task.error?'Review issue':guidance.action}<ArrowUpRight size={15} aria-hidden="true"/></span></span></button>;
   })}</section>;
  })}</div>
  {!filtered.length?<div className="work-inbox-empty"><h3>{tasks.some(t=>!t.external)?'No work matches these filters':'All quiet on deck'}</h3><p>{tasks.some(t=>!t.external)?'Try another phrase or reset your filters.':'Start a conversation with your crew to see real updates here.'}</p>{query||project||crew||lane!=='all'?<button onClick={()=>{setQuery('');setProject('');setCrew('');setLane('all');reset();}}>Reset filters</button>:null}</div>:null}
  {filtered.length>visible.length?<button className="work-inbox-more" onClick={()=>setLimit(n=>n+24)}>Show more work ({filtered.length-visible.length} remaining)</button>:null}
 </section>;
}
