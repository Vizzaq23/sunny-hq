import {useEffect,useRef,useState} from 'react';
import type {CrewId,Snapshot,WorkContext} from './shared';
import {projectMission,type MissionProjection} from './missionProjection';
import {createWalkers,stepWalkers} from './deckMotion';
import type {Moment} from './crewLife';
export function crewProjection(snapshot:Snapshot,id:CrewId,context:WorkContext|null|undefined=snapshot.workspace?.context):MissionProjection{
 if(context){const selected=projectMission(snapshot,context);return selected.crewId===id?selected:{missionId:selected.missionId,attemptId:selected.attemptId,crewId:id,state:'idle',label:'Standing by for selected work',working:false};}
 const tasks=snapshot.tasks.filter(t=>t.crewId===id&&!t.external),rank=(status:string)=>['awaiting-approval','unknown','waiting','input'].includes(status)?3:['working','running','in-progress','starting'].includes(status)?2:1;
 const task=tasks.slice().sort((a,b)=>rank(b.status)-rank(a.status)||b.updatedAt-a.updatedAt)[0];
 return task?projectMission(snapshot,{projectId:task.projectId,taskId:task.id,surface:'deck',returnTo:{view:'ship'}}):{crewId:id,state:'idle',label:'Idle',working:false};
}
export function crewStatus(snapshot:Snapshot,id:CrewId,context?:WorkContext|null){const projection=crewProjection(snapshot,id,context);if(id==='franky'&&projection.working&&projection.stage&&projection.stage!=='work')return 'waiting';return projection.state==='working'&&projection.working?'working':['input','approval','waiting','starting'].includes(projection.state)?'waiting':['unknown','failed'].includes(projection.state)?'attention':'idle';}
export function useDeckMotion(snapshot:Snapshot,moment:Moment|null,paused:boolean,selected:CrewId|null,hovered:CrewId|null,context?:WorkContext|null){
 const [walkers,setWalkers]=useState(createWalkers),settings=useRef({snapshot,moment,paused,selected,hovered,context});settings.current={snapshot,moment,paused,selected,hovered,context};
 const [systemReduced,setSystemReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setSystemReduced(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
 useEffect(()=>{let previous=performance.now();const timer=setInterval(()=>{const now=performance.now(),elapsed=(now-previous)/1000;previous=now;const s=settings.current;
  if(document.hidden)return;
  const meeting=s.snapshot.discussions?.find(d=>d.status==='working')?.crew??((s.moment?.cast.length??0)>1?s.moment!.cast:[]);
  const held=[s.selected,s.hovered,...(s.moment?.cast.length===1?s.moment.cast:[])].filter(Boolean) as CrewId[];
  setWalkers(current=>stepWalkers(current,elapsed,{statuses:Object.fromEntries(current.map(w=>[w.id,crewStatus(s.snapshot,w.id,s.context)])),meeting,held,paused:s.paused||s.snapshot.settings.reducedMotion||systemReduced}));
 },50);return()=>clearInterval(timer);},[systemReduced]);
 return walkers;
}
