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
 const [selected,setSelected]=useState<CrewId>('luffy');
 const [panel,setPanel]=useState<'crew'|'activity'|'controls'>('crew');
 const [filter,setFilter]=useState<'all'|'working'|'attention'>('all');
 const members=CREW.map(crew=>({crew,projection:crewSceneProjection(snapshot,crew.id,context)}));
 const working=members.filter(member=>member.projection.working).length;
 const attention=workEntries(snapshot.missions??[],snapshot.tasks,snapshot).filter(entry=>entry.phase==='attention'||entry.phase==='review');
 const signals=commandSignals(snapshot,context);
 const visible=members.filter(({projection})=>filter==='all'||(filter==='working'?projection.working:['approval','input','waiting','unknown','failed','review'].includes(projection.state)));
 const member=members.find(value=>value.crew.id===selected)??members[0];
 const task=snapshot.tasks.find(value=>value.id===member.projection.taskId);
 const selectCrew=(crewId:CrewId)=>{setSelected(crewId);setPanel('crew');};
 const inspectWorld=({taskId,crewId}:{taskId?:string;crewId?:CrewId})=>{const id=crewId??snapshot.tasks.find(value=>value.id===taskId)?.crewId;if(id&&members.some(value=>value.crew.id===id))selectCrew(id);else if(taskId)onWorkspace({taskId});};
 const openMission=(mission:NonNullable<Snapshot['missions']>[number])=>onContext({projectId:mission.projectId,runId:mission.runId,missionId:mission.id,attemptId:mission.activeAttemptId,surface:'deck',returnTo:{view:'ship',projectId:mission.projectId,missionId:mission.id}});
 return <div className="helm-workspace">
  <header className="helm-bar"><div><Compass size={21}/><span><small>GRAND LINE / CREW HEADQUARTERS</small><h2>Thousand Sunny</h2></span></div><div className="helm-readout"><span><i/>{working} working</span><button onClick={()=>onNavigate('missions')}>{attention.length} need you <ArrowUpRight size={14}/></button></div><button className="helm-launch" onClick={()=>onNavigate('home')}><Plus size={17}/>New mission</button></header>
  <div className="helm-body"><section className="helm-world" aria-label="Living Sunny deck"><div className="helm-world-label"><span>THE UPPER DECK</span><span>{window.sunny?'Saved workspace state':'Browser preview · no live connection'}</span></div><div className="helm-scene"><ShipView compact onSelectCrew={selectCrew} snapshot={snapshot} context={context} invoke={invoke} onWorkspace={inspectWorld} onNavigate={onNavigate} onImport={onImport}/></div><footer><span>Select a crewmate to inspect their station.</span><span>Wandering & chatter are ambient.</span></footer></section>
   <aside className="helm-inspector" aria-label="Crew command center"><div className="helm-tabs" aria-label="Command center panels">{(['crew','activity','controls'] as const).map(value=><button key={value} aria-pressed={panel===value} onClick={()=>setPanel(value)}>{value==='crew'?'Station':value==='activity'?'Activity':'Run controls'}</button>)}</div>
   {panel==='crew'?<div className="helm-station"><header><CrewBadge crew={member.crew} size="large"/><div><small>{member.crew.station}</small><h3>{member.crew.name}</h3><p>{member.crew.role}</p></div></header><div className="helm-state" data-working={member.projection.working}><i/>{member.projection.label}</div><h4>{task?.title??'Ready at the station'}</h4><p className="helm-task-detail">{task?.lastAssistantPreview??(task?'Open the conversation to inspect the latest saved work.':`${member.crew.name} is ready for your next assignment. Choose a project and describe the outcome.`)}</p><button className="helm-primary" onClick={()=>onWorkspace(task?{taskId:task.id}:{crewId:member.crew.id,projectId:context?.projectId??snapshot.projects[0]?.id})}>{task?'Open conversation':`Brief ${member.crew.name}`}<ArrowUpRight size={17}/></button><section className="helm-decisions"><h4><Anchor size={15}/>Captain’s attention</h4>{attention.length?attention.slice(0,3).map(entry=><button key={entry.id} onClick={()=>entry.kind==='mission'?openMission(entry.mission):onWorkspace({taskId:entry.task.id})}><span>{entry.title}<small>{entry.phase==='review'?'Ready for review':'Needs attention'}</small></span><ArrowUpRight size={15}/></button>):<p>No decisions waiting. New requests appear here.</p>}</section></div>:null}
   {panel==='activity'?<section className="helm-activity" aria-label="Live work activity"><h3><Radio size={18}/>From the crew</h3><p>Saved task updates & mission events</p>{signals.length?<ol>{signals.map(event=><li key={event.id}><time dateTime={new Date(event.time).toISOString()}>{new Date(event.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time><button onClick={()=>{if(event.taskId)onWorkspace({taskId:event.taskId});else{const mission=snapshot.missions?.find(m=>m.id===event.missionId);if(mission)openMission(mission);}}}><strong>{event.label}</strong><span>{event.title}</span>{event.detail?<p>{event.detail}</p>:null}</button></li>)}</ol>:<div className="helm-quiet"><Radio size={32}/><h4>The airwaves are quiet.</h4><p>Start a mission to follow its real updates here.</p></div>}</section>:null}
   {panel==='controls'?<section className="helm-controls"><h3>Run controls</h3><p>Select a saved run to inspect its limits and controls.</p><CrewRunPanel snapshot={snapshot} context={context} invoke={invoke} onContext={onContext} onOpen={taskId=>onWorkspace({taskId})}/></section>:null}
   </aside></div>
  <section className="helm-roster" aria-label="Crew activity"><header><b>YOUR CREW <span>{members.length} aboard</span></b><div aria-label="Filter crew">{(['all','working','attention'] as const).map(value=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value==='all'?'All crew':value==='working'?'Working':'Needs you'}</button>)}</div></header><div className="helm-crew-strip">{visible.map(({crew,projection})=><button className="helm-crew" key={crew.id} aria-pressed={selected===crew.id} data-working={projection.working} onClick={()=>selectCrew(crew.id)}><CrewBadge crew={crew}/><span><b>{crew.name}</b><small>{projection.label}</small></span></button>)}{!visible.length?<p>No crew match this view.</p>:null}</div></section>
 </div>;
}
