import {useEffect,useRef,useState} from 'react';
import {Anchor,ArrowUpRight,Compass,MapPin,MessageCircle,Users} from 'lucide-react';
import type {CrewId,Snapshot,WorkContext} from '../shared';
import {CREW} from '../data';
import {ShipView} from '../views/DashboardViews';
import {CrewJournal} from './CrewJournal';
import {HandoffParcels} from './HandoffParcels';
import {taskNeedsAttention} from '../taskFlow';

type Props={snapshot:Snapshot;context:WorkContext|null;projectId?:string;onProject:(id:string)=>void;onContext:(context:WorkContext)=>void;onProjectRoom:(id:string)=>void;onCaptain:()=>void;onExplore:()=>void;onImport:()=>void;onWorkspace:(value:{projectId?:string;crewId?:CrewId;taskId?:string})=>void;invoke:<T=unknown>(action:string,args?:unknown)=>Promise<T>};
export function HarborWorld({snapshot,context,projectId,onProject,onContext,onProjectRoom,onCaptain,onExplore,onImport,onWorkspace,invoke}:Props){
 const [crewId,setCrewId]=useState<CrewId|null>(null),[panel,setPanel]=useState<'crew'|'handoffs'|null>(null);
 const panelTrigger=useRef<HTMLElement|null>(null);
 const detail=useRef<HTMLElement|null>(null);
 const [hidden,setHidden]=useState(document.hidden);
 useEffect(()=>{const update=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
 useEffect(()=>{if(panel)detail.current?.querySelector<HTMLButtonElement>('header button')?.focus({preventScroll:true});},[panel]);
 const project=snapshot.projects.find(p=>p.id===projectId);
 const missions=(snapshot.missions??[]).filter(m=>m.projectId===project?.id);
 const mission=missions.find(m=>m.id===context?.missionId);
 const attempt=mission?.attempts.find(a=>a.id===(context?.attemptId??mission.activeAttemptId));
 const attention=snapshot.tasks.find(t=>snapshot.approvals.some(a=>a.taskId===t.id))??snapshot.tasks.find(t=>!t.external&&taskNeedsAttention(t));
 const openPanel=(next:'crew'|'handoffs')=>{panelTrigger.current=document.activeElement as HTMLElement;setPanel(current=>current===next?null:next);};
 const closePanel=()=>{setPanel(null);panelTrigger.current?.focus();};
 return <section className="harbor-world" data-hidden={hidden} aria-label="Sunny harbor workspace">
  <header className="harbor-heading"><div><span className="eyebrow">Aboard the Thousand Sunny</span><h2>Your crew. Your next adventure.</h2></div><label className="harbor-project"><MapPin size={16}/><span>Destination</span><select aria-label="Harbor project" value={project?.id??''} onChange={event=>onProject(event.target.value)}><option value="">Choose a project…</option>{snapshot.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></header>
  <div className="harbor-scene" inert={Boolean(panel)} data-panel-open={Boolean(panel)}>
   <div className="harbor-water" aria-hidden="true"/>
   <div className="harbor-island-art" aria-hidden="true"><img src={import.meta.env.BASE_URL+'assets/island-world.png'} alt="" onError={event=>{event.currentTarget.style.visibility='hidden';}}/></div>
   <button className="harbor-destination" disabled={!project} onClick={()=>project&&onProjectRoom(project.id)}><span><Anchor size={16}/> Your project island</span><strong>{project?.name??(projectId?'Project unavailable':'Choose your destination')}</strong><small>{project?'Open quarters & missions':'Choose or import a project above'} <ArrowUpRight size={14}/></small></button>
   <div className="harbor-ship helm-scene"><ShipView compact snapshot={snapshot} context={context?.projectId===project?.id?context:null} invoke={invoke} onSelectCrew={setCrewId} onWorkspace={onWorkspace} onNavigate={onExplore} onImport={onImport}/></div>
   <div className="harbor-caption"><span>THOUSAND SUNNY</span><small>Choose a crewmate to open their wanted profile.</small></div>
  </div>
  <nav className="harbor-actions" aria-label="Harbor controls"><button className="harbor-captain" onClick={onCaptain}><MessageCircle size={18}/> Talk to Luffy</button><button onClick={()=>openPanel('crew')} aria-expanded={panel==='crew'} aria-controls="harbor-detail"><Users size={18}/> Crew & stations</button><button onClick={()=>openPanel('handoffs')} aria-expanded={panel==='handoffs'} aria-controls="harbor-detail">✉ Recorded handoffs</button><button onClick={onExplore}><Compass size={18}/> Explore the Grand Line</button>{attention?<button className="harbor-attention" onClick={()=>onWorkspace({taskId:attention.id})}>Needs attention · {attention.crewId} ↗</button>:null}{!project?<button onClick={onImport}>Import project</button>:null}</nav>
  {panel?<section ref={detail} id="harbor-detail" className="harbor-detail" aria-label={panel==='crew'?'Crew and stations':'Recorded deck exchanges'} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();closePanel();}}}><header><h3>{panel==='crew'?'Meet the crew, visit a station':'The crew’s recorded exchanges'}</h3><button onClick={closePanel} aria-label="Close harbor details">Close ×</button></header>
   {panel==='crew'?<div className="harbor-roster">{CREW.map(crew=><article key={crew.id}><button onClick={()=>setCrewId(crew.id)}><strong>{crew.name}</strong><span>Wanted profile ↗</span></button><button onClick={()=>onWorkspace({crewId:crew.id,projectId:project?.id})}>Visit {crew.station} <ArrowUpRight size={14}/></button></article>)}</div>:<><label className="harbor-mission">Recorded mission<select aria-label="Harbor handoff mission" value={mission?.id??''} onChange={event=>{const selected=missions.find(m=>m.id===event.target.value);if(selected)onContext({projectId:selected.projectId,runId:selected.runId,missionId:selected.id,attemptId:selected.activeAttemptId,surface:'deck',returnTo:{view:'home',projectId:selected.projectId}});}}><option value="">Choose a mission…</option>{missions.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}</select></label>{mission&&attempt?<HandoffParcels key={attempt.id} projectId={mission.projectId} missionId={mission.id} attemptId={attempt.id} revision={mission.revision} invoke={invoke} onOpen={taskId=>onWorkspace({taskId})}/>:<p>{project?'Choose a mission to explore its recorded crew exchanges.':'Choose a project to view its recorded handoffs.'}</p>}</>}
  </section>:null}
  {crewId?<CrewJournal key={crewId} showWanted initialTab="overview" initialProjectId={project?.id} crewId={crewId} snapshot={snapshot} invoke={invoke} onClose={()=>setCrewId(null)} onOpenTask={taskId=>onWorkspace({taskId})} onOpenRoom={id=>onWorkspace({crewId:id as CrewId,projectId:project?.id})}/>:null}
 </section>;
}
