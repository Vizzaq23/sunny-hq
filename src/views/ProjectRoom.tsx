import {useEffect,useRef,useState} from 'react';
import type {Snapshot} from '../shared';
import {CREW} from '../data';
import {RoomActors} from '../components/RoomActors';
import {WorldRoster} from '../components/WorldRoster';
import {ProjectHealth} from '../components/ProjectHealth';
import {ProjectCharts} from '../components/ProjectCharts';
import {ROOM_STATION_CREW,ROOM_STATION_X,ROOM_BOARD_X,moveRoomCaptain,nearRoomBoard} from '../roomMotion';
import {roomCrew,roomSignals} from '../roomActivity';
import {MissionBoard} from './MissionBoard';
import './project-room.css';
type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
export function ProjectRoom({backLabel="Return to the island",projectId,snapshot,invoke,onBack,onOpen,onCrew,onBriefings}:{backLabel?:string;projectId:string;snapshot:Snapshot;invoke:Invoke;onBack:()=>void;onOpen:(taskId:string)=>void;onCrew:(crewId:string)=>void;onBriefings:()=>void}){
 const project=snapshot.projects.find(p=>p.id===projectId),[board,setBoard]=useState(false),[position,setPosition]=useState({x:ROOM_BOARD_X,y:74}),[error,setError]=useState('');
 const [paused,setPaused]=useState(false);
 const [markingSignal,setMarkingSignal]=useState(false),[onlyUnseen,setOnlyUnseen]=useState(false);
 const [focusMission,setFocusMission]=useState<{id:string;sequence:number}>();
 const boardRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(board){boardRef.current?.scrollIntoView({block:'start'});boardRef.current?.focus({preventScroll:true});}},[board,focusMission]);
 const openMission=(id:string)=>{setFocusMission(previous=>({id,sequence:(previous?.sequence??0)+1}));setBoard(true);};
 const tasks=snapshot.tasks.filter(t=>t.projectId===projectId),missions=(snapshot.missions??[]).filter(m=>m.projectId===projectId);
 const signals=roomSignals(snapshot,projectId,Number.MAX_SAFE_INTEGER).filter(e=>!onlyUnseen||!e.seen).slice(0,8),unseen=missions.reduce((count,m)=>count+m.events.filter(e=>!m.seenEventIds?.includes(e.id)).length,0);
 const markSeen=async(signal:typeof signals[number])=>{setMarkingSignal(true);setError('');try{await invoke('mission:signalSeen',{missionId:signal.missionId,revision:signal.revision,eventId:signal.id});}catch(e){setError(String(e));}finally{setMarkingSignal(false);}};
 const approvals=snapshot.approvals.filter(a=>tasks.some(t=>t.id===a.taskId));
 const active=tasks.filter(t=>['starting','working','waiting','unknown'].includes(t.status));
 const move=(dx:number,dy:number)=>setPosition(p=>moveRoomCaptain(p,dx,dy));
 if(!project)return <section className="page"><h2>Project unavailable</h2><button className="small-button project-room-back" onClick={onBack}>{backLabel}</button></section>;
 return <section className="page project-room"><header className="page-intro"><div><span className="eyebrow">Project quarters</span><h2>{project.name}</h2><p>{active.length} active crew tasks · {missions.length} missions · {approvals.length} requests need you</p></div><button className="small-button project-room-back" onClick={onBack}>{backLabel}</button></header>
  <div className="room-signals" aria-label="Project attention">{approvals.map(a=><button key={a.id} onClick={()=>a.taskId&&onOpen(a.taskId)}>Review crew request</button>)}{active.map(t=><div key={t.id}><button onClick={()=>onOpen(t.id)}>{t.title} · {t.status}</button><button onClick={()=>void invoke('task:interrupt',{taskId:t.id}).catch(e=>setError(String(e)))}>Stop task</button></div>)}</div>
  {error?<p role="alert">{error}</p>:null}
  <div className="project-room-scene" tabIndex={0} aria-label="Project room. Arrow keys move the captain. Enter near the board opens missions." onKeyDown={e=>{if(e.target!==e.currentTarget)return;const steps:Record<string,[number,number]>={ArrowLeft:[-4,0],ArrowRight:[4,0],ArrowUp:[0,-4],ArrowDown:[0,4]};if(steps[e.key]){e.preventDefault();move(...steps[e.key]);}else if(e.key==='Enter'&&nearRoomBoard(position)){e.preventDefault();setBoard(true);}}}>
   <img className="room-illustration" src={new URL(`${import.meta.env.BASE_URL}assets/project-quarters.png`,location.href).href} alt="Sunlit timber project quarters with a map desk, shipwright bench, review desk and clear walking floor." draggable={false}/>
   <button style={{left:`${ROOM_BOARD_X}%`}} className="room-mission-board" onClick={()=>setBoard(true)}><b>Mission board</b><span>{missions.filter(m=>m.status==='WAITING_FOR_REVIEW').length} ready for review</span></button>
   <div className="room-stations">{ROOM_STATION_CREW.map((id,lane)=>{const c=CREW.find(c=>c.id===id)!;const activity=roomCrew(snapshot,projectId,c.id),task=activity.task;return <button key={c.id} data-station-crew={c.id} style={{left:`${ROOM_STATION_X[lane]}%`}} disabled={!task} className={`room-station ${activity.working?'occupied':''}`} onClick={()=>task&&onOpen(task.id)}><strong>{c.name}</strong><span>{c.role}</span><small>{activity.state}</small></button>;})}</div>
   <RoomActors snapshot={snapshot} projectId={projectId} onOpen={onOpen} paused={paused}/>
   <div className="room-captain" style={{left:`${position.x}%`,top:`${position.y}%`}} aria-hidden="true"><span>☀</span><b>You · Captain</b></div>
   <span className="room-position" role="status">{nearRoomBoard(position)?'Press Enter to open the mission board':'Walk toward the board, or select it directly.'}</span>
  </div>
  <div className="room-movement" aria-label="Captain movement"><button aria-pressed={paused} onClick={()=>setPaused(value=>!value)}>{paused?'Resume visuals':'Pause visuals'}</button><button aria-label="Walk left" onClick={()=>move(-4,0)}>←</button><button aria-label="Walk forward" onClick={()=>move(0,-4)}>↑</button><button aria-label="Walk back" onClick={()=>move(0,4)}>↓</button><button aria-label="Walk right" onClick={()=>move(4,0)}>→</button><button onClick={()=>setBoard(b=>!b)}>{board?'Close mission board':'Open mission board'}</button></div>
  <WorldRoster snapshot={snapshot} projectId={projectId} onCrew={onCrew} onBriefings={onBriefings} onOpen={onOpen}/>
  <section className="panel room-event-log" aria-label="Transponder signals"><h3>Transponder signals · {unseen} unseen</h3><p>Showing up to eight {onlyUnseen?'unseen':'recent'} signals. Marking seen does not approve requests or resolve blockers.</p><button aria-pressed={onlyUnseen} onClick={()=>setOnlyUnseen(value=>!value)}>{onlyUnseen?'Show recent signals':'Show unseen signals'}</button>{signals.length?<ol>{signals.map(e=><li key={e.id} data-signal-id={e.id} data-seen={e.seen}><time dateTime={new Date(e.time).toISOString()}>{new Date(e.time).toLocaleTimeString()}</time><span><strong>{e.title}</strong><small>{e.type.replaceAll('_',' ').toLowerCase()} · {e.seen?'Seen':'New'}</small></span><button onClick={()=>openMission(e.missionId)}>Inspect mission</button>{!e.seen?<button disabled={markingSignal} onClick={()=>void markSeen(e)}>Mark seen</button>:null}</li>)}</ol>:<p>{onlyUnseen?'No unseen signals.':'No mission signals yet.'}</p>}</section>
  <ProjectHealth missions={missions} projectId={projectId} onMission={openMission}/>
  <ProjectCharts key={projectId} project={project} invoke={invoke}/>
  {board?<div ref={boardRef} tabIndex={-1} role="region" aria-label="Project mission board"><MissionBoard focusMission={focusMission} snapshot={{...snapshot,projects:[project],missions}} invoke={invoke} onOpen={onOpen}/></div>:null}
  <section className="panel room-logbook"><h3>Project logbook</h3>{missions.length?missions.map(m=><button key={m.id} onClick={()=>openMission(m.id)}>{m.title} · {m.status.replaceAll('_',' ').toLowerCase()}</button>):<p>No missions yet. Open the board to give the crew its first objective.</p>}<p>Deployment observations are available in the project health log after inspection.</p></section>
 </section>;
}
