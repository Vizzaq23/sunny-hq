import {useMemo,useState} from 'react';
import {BookOpen,Search,ArrowUpRight,GitBranch,ClipboardCheck,MessageSquare,Flag} from 'lucide-react';
import type {Snapshot} from '../shared';
import {ALL_CREW,CREW_BY_ID} from '../data';
import {shipLogEntries,filterShipLog,type ShipLogKind} from '../shipLog';
const kinds:{id:ShipLogKind|'all';label:string}[]=[{id:'all',label:'All records'},{id:'delegation',label:'Delegation'},{id:'review',label:'Reviews'},{id:'check',label:'Checks'},{id:'work',label:'Conversations'},{id:'mission',label:'Mission events'}];
const icons={delegation:GitBranch,work:MessageSquare,review:ClipboardCheck,check:ClipboardCheck,mission:Flag};
const names=new Map(ALL_CREW.map(c=>[c.id,c.name]));
export function ShipLog({snapshot,onTask,onMission}:{snapshot:Snapshot;onTask:(id:string)=>void;onMission?:(id:string,attemptId?:string)=>void}){
 const [project,setProject]=useState(''),[limit,setLimit]=useState(30),[query,setQuery]=useState(''),[kind,setKind]=useState<ShipLogKind|'all'>('all');
 const records=useMemo(()=>shipLogEntries(snapshot),[snapshot]);
 const rows=filterShipLog(records,query,project,kind,names);
 return <section className="ship-event-log" aria-labelledby="ship-log-title">
  <header><div><span className="eyebrow">Evidence, not estimates</span><h3 id="ship-log-title"><BookOpen aria-hidden="true"/>Ship’s log</h3></div><label>Project<select value={project} onChange={e=>{setProject(e.target.value);setLimit(30);}}><option value="">All projects</option>{snapshot.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></header>
  <p>Saved events and latest conversation states. Replies remain ready for review until you accept the work.</p>
  <div className="ship-log-tools"><label className="ship-log-search"><Search size={17} aria-hidden="true"/><input aria-label="Search ship log" value={query} onChange={e=>{setQuery(e.target.value);setLimit(30);}} placeholder="Find a crewmate, result or check…"/></label><label className="sr-only" htmlFor="ship-log-kind">Record type</label><select id="ship-log-kind" value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setLimit(30);}}>{kinds.map(k=><option key={k.id} value={k.id}>{k.label}</option>)}</select></div>
  <div className="ship-log-count" role="status">{rows.length} {rows.length===1?'record':'records'}{rows.length>limit?` · showing ${limit}`:''}</div>
  {rows.length?<ol aria-label="Recorded work">{rows.slice(0,limit).map(row=>{
   const Icon=icons[row.kind],mission=snapshot.missions?.find(m=>m.id===row.missionId);
   const targetAvailable=mission&&(!row.attemptId||mission.attempts.some(a=>a.id===row.attemptId));
   return <li key={row.id} data-kind={row.kind}><span className="log-entry-icon" aria-hidden="true"><Icon size={15}/></span><div><time dateTime={new Date(row.time).toISOString()}>{row.timeLabel?row.timeLabel+' · ':''}{new Date(row.time).toLocaleString()}</time><details><summary><span className="log-entry-label">{row.crewId?<b>{CREW_BY_ID.get(row.crewId)?.name??row.crewId}</b>:null}{row.label}</span><strong>{row.title}</strong></summary><p>{row.detail}</p><small className="log-record-source">{snapshot.projects.find(p=>p.id===row.projectId)?.name??'Project unavailable'} · {row.source}</small>{row.taskId?<button onClick={()=>onTask(row.taskId!)}>Open conversation evidence <ArrowUpRight size={15}/></button>:row.missionId&&onMission&&targetAvailable?<button onClick={()=>onMission(row.missionId!,row.attemptId)}>Inspect mission evidence <ArrowUpRight size={15}/></button>:row.missionId?<small>Mission evidence unavailable</small>:null}</details></div></li>;
  })}</ol>:<div className="ship-log-empty"><BookOpen size={28}/><h4>{records.length?'No matching records':'A fresh page in the log'}</h4><p>{records.length?'Try another project, record type or search.':'Assignments, checks and your review decisions will appear here when they are recorded.'}</p>{records.length?<button onClick={()=>{setQuery('');setProject('');setKind('all');}}>Clear filters</button>:null}</div>}
  {rows.length>limit?<button className="ship-log-more" onClick={()=>setLimit(value=>value+30)}>Show 30 more records</button>:null}
 </section>;
}
