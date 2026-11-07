import {useMemo,useState} from 'react';
import {ArrowUpRight,Compass} from 'lucide-react';
import type {Mission,Snapshot} from '../shared';
import {CREW_BY_ID,formatRelative} from '../data';
import {captainWatch,type WatchLane} from '../captainWatch';
import './captain-watch.css';
const lanes=[{id:'attention',name:'Needs you'},{id:'active',name:'Crew at work'},{id:'review',name:'Captain review'}] as const;
export function CaptainWatch({snapshot,onOpen,onMission}:{snapshot:Snapshot;onOpen:(selection:{taskId?:string;projectId?:string;missionId?:string;attemptId?:string})=>void;onMission?:(mission:Mission)=>void}){
 const items=useMemo(()=>captainWatch(snapshot),[snapshot]),[lane,setLane]=useState<WatchLane|'all'>('all'),[limit,setLimit]=useState(6);
 const visible=items.filter(item=>lane==='all'||item.lane===lane);
 return <section className="captain-watch" aria-label="Captain’s watch"><header><div><span className="eyebrow">Your next move</span><h3><Compass size={20} aria-hidden="true"/> Captain’s watch</h3><p>Requests to answer. Work to follow. Results to review.</p></div><span className="watch-source">{snapshot.codex.status==='connected'?'Codex connected':snapshot.codex.status==='connecting'?'Codex connecting':'Codex offline'}</span></header>
  <div className="watch-filters" aria-label="Filter captain’s watch"><button aria-pressed={lane==='all'} onClick={()=>{setLane('all');setLimit(6);}}>All <b>{items.length}</b></button>{lanes.map(group=><button key={group.id} aria-pressed={lane===group.id} onClick={()=>{setLane(group.id);setLimit(6);}}>{group.name} <b>{items.filter(item=>item.lane===group.id).length}</b></button>)}</div>
  {visible.length?<ul className="watch-list">{visible.slice(0,limit).map(item=><li key={item.id} data-watch-id={item.id} data-state={item.lane}><div className="watch-copy"><span className="watch-label">{item.label}{item.requestCount>1?` · ${item.requestCount} requests`:''}</span><h4>{item.title}</h4><small>{snapshot.projects.find(p=>p.id===item.projectId)?.name??'Project unavailable'} · {item.crewId?CREW_BY_ID.get(item.crewId)?.name??item.crewId:'Mission'} · {formatRelative(item.updatedAt)}</small><p>{item.detail}</p></div><button className="watch-open" aria-label={`${item.action}: ${item.title}`} onClick={()=>{const mission=snapshot.missions?.find(m=>m.id===item.missionId);if(!item.taskId&&mission&&onMission)onMission(mission);else onOpen({taskId:item.taskId,projectId:item.projectId,missionId:item.missionId,attemptId:item.attemptId});}}>{item.action}<ArrowUpRight size={15} aria-hidden="true"/></button></li>)}</ul>:<p className="watch-empty">{items.length?'No work in this view. Choose another filter.':'All quiet on deck. Start with Luffy; requests and tracked work will appear here.'}</p>}
  {visible.length>limit?<button className="watch-more" onClick={()=>setLimit(n=>n+6)}>Show more ({visible.length-limit} remaining)</button>:null}
  <p className="watch-boundary">You’re at the helm. Review a request before approving it.</p>
 </section>;
}
