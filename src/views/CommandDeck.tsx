import {useState} from 'react';
import {ArrowUpRight,Radio,Compass,Plus,Anchor} from 'lucide-react';
import type {CrewId,Snapshot,WorkContext} from '../shared';
import {CREW} from '../data';
import {crewSceneProjection} from '../roomActivity';
import {workEntries} from '../taskFlow';
import {commandSignals} from '../commandActivity';
import {CrewBadge,type ViewId} from '../components/Chrome';
import {CrewRunPanel} from '../components/CrewRunPanel';
import {ShipView} from './DashboardViews';
type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
type Props={snapshot:Snapshot;context:WorkContext|null;invoke:Invoke;onContext:(context:WorkContext)=>void;onWorkspace:(value:{taskId?:string;crewId?:CrewId;projectId?:string})=>void;onNavigate:(view:ViewId)=>void;onImport:()=>void};
export function CommandDeck({snapshot,context,invoke,onContext,onWorkspace,onNavigate,onImport}:Props){
 const [filter,setFilter]=useState<'all'|'working'|'attention'>('all');
 const members=CREW.map(crew=>({crew,projection:crewSceneProjection(snapshot,crew.id,context)}));
 const working=members.filter(member=>member.projection.working).length;
 const entries=workEntries(snapshot.missions??[],snapshot.tasks,snapshot);
 const attention=entries.filter(entry=>entry.phase==='attention'||entry.phase==='review');
 const signals=commandSignals(snapshot,context);
 const visible=members.filter(({projection})=>filter==='all'||(filter==='working'?projection.working:['approval','input','waiting','unknown','failed','review'].includes(projection.state)));
 const openMission=(mission:NonNullable<Snapshot['missions']>[number])=>onContext({projectId:mission.projectId,runId:mission.runId,missionId:mission.id,attemptId:mission.activeAttemptId,surface:'deck',returnTo:{view:'ship',projectId:mission.projectId,missionId:mission.id}});
 return <div className="command-deck">
  <header className="command-heading"><div><span className="command-kicker">STRAW HAT OPERATIONS / 01</span><h2>The crew. In motion.</h2><p>Watch the work unfold. Take the helm when it needs you.</p></div><button className="command-launch" onClick={()=>onNavigate('home')}><Plus size={18}/>Set a new course</button></header>
  <div className="command-readout" aria-label="Workspace status"><span><Radio size={15}/>{window.sunny?'Desktop workspace':'Preview · no live connection'}</span><span><b>{working.toString().padStart(2,'0')}</b> crew working {context?'in selection':'across projects'}</span><button onClick={()=>onNavigate('missions')}><b>{attention.length.toString().padStart(2,'0')}</b> need review <ArrowUpRight size={14}/></button><span><b>{snapshot.projects.length.toString().padStart(2,'0')}</b> project ports</span></div>
  <div className="command-layout"><section className="command-world" aria-label="Living Sunny deck"><div className="command-world-title"><span><Compass size={16}/>THOUSAND SUNNY</span><span>CREW STATIONS / LIVE STATE</span></div><div className="command-canvas"><ShipView compact snapshot={snapshot} context={context} invoke={invoke} onWorkspace={onWorkspace} onNavigate={onNavigate} onImport={onImport}/></div><footer><span>Choose a crewmate to inspect their work.</span><span>Wandering & chatter are ambient.</span></footer></section>
   <aside className="command-signal" aria-label="Live work activity"><header><Radio size={18}/><h3>From the crew</h3><span>{signals.length}</span></header><p className="signal-caption">Task updates & mission events · newest first</p>{signals.length?<ol>{signals.map(event=><li key={event.id}><time dateTime={new Date(event.time).toISOString()}>{new Date(event.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time><button onClick={()=>{if(event.taskId)onWorkspace({taskId:event.taskId});else{const mission=snapshot.missions?.find(m=>m.id===event.missionId);if(mission)openMission(mission);}}}><strong>{event.label}</strong><span>{event.title}</span>{event.detail?<p>{event.detail}</p>:null}</button></li>)}</ol>:<div className="signal-empty"><Radio size={32}/><h4>The airwaves are quiet.</h4><p>Real mission events appear here as the crew works. Start a course to bring the deck to life.</p><button onClick={()=>onNavigate('home')}>Write a mission <ArrowUpRight size={16}/></button></div>}<button className="signal-log" onClick={()=>onNavigate('missions')}>Open mission board <ArrowUpRight size={16}/></button></aside>
  </div>
  <section className="command-roster" aria-label="Crew activity"><header><div><span className="command-kicker">ON DECK</span><h3>Every station, accounted for.</h3></div><div className="command-filters" aria-label="Filter crew">{(['all','working','attention'] as const).map(value=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value==='all'?'All crew':value==='working'?'Working':'Needs you'}</button>)}</div></header><div className="command-stations">{visible.map(({crew,projection})=>{const task=snapshot.tasks.find(task=>task.id===projection.taskId);return <button className="command-station" key={crew.id} data-state={projection.state} data-working={projection.working} onClick={()=>onWorkspace(task?{taskId:task.id}:{crewId:crew.id,projectId:context?.projectId??snapshot.projects[0]?.id})}><CrewBadge crew={crew}/><span className="station-identity"><b>{crew.name}</b><small>{crew.role}</small></span><span className="station-state"><i/>{projection.label}</span><span className="station-task">{task?.title??'No assigned work'}</span><ArrowUpRight className="station-arrow" size={16}/></button>})}</div>{!visible.length?<p className="command-no-results">No crew match this view. Their state updates when Sunny receives work events.</p>:null}</section>
  {attention.length?<section className="command-review"><h3>Your decision moves the voyage forward.</h3>{attention.slice(0,5).map(entry=><button key={entry.id} onClick={()=>entry.kind==='mission'?openMission(entry.mission):onWorkspace({taskId:entry.task.id})}><Anchor size={16}/><span>{entry.title}<small>{entry.phase==='review'?'Ready for your review':'Needs attention'}</small></span><ArrowUpRight size={16}/></button>)}</section>:null}
  <details className="command-run"><summary>Run controls, budgets & saved selections</summary><CrewRunPanel snapshot={snapshot} context={context} invoke={invoke} onContext={onContext} onOpen={taskId=>onWorkspace({taskId})}/></details>
 </div>;
}
