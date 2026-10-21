import {useEffect,useMemo,useRef,useState} from 'react';
import type {CrewId,Snapshot,WorkContext} from './shared';
import type {MissionProjection} from './missionProjection';
import {crewSceneProjection,crewSceneStatus} from './roomActivity';
import {createWalkers,stepWalkers} from './deckMotion';
import type {Moment} from './crewLife';
export function crewProjection(snapshot:Snapshot,id:CrewId,context:WorkContext|null|undefined=snapshot.workspace?.context):MissionProjection{
 return crewSceneProjection(snapshot,id,context);
}
export function crewStatus(snapshot:Snapshot,id:CrewId,context?:WorkContext|null){return crewSceneStatus(crewProjection(snapshot,id,context));}
export function useDeckMotion(snapshot:Snapshot,moment:Moment|null,paused:boolean,selected:CrewId|null,hovered:CrewId|null,context?:WorkContext|null){
 const statuses=useMemo(()=>Object.fromEntries(createWalkers().map(w=>[w.id,crewStatus(snapshot,w.id,context)])),[snapshot,context]);
 const [walkers,setWalkers]=useState(createWalkers),settings=useRef({snapshot,moment,paused,selected,hovered,context,statuses});settings.current={snapshot,moment,paused,selected,hovered,context,statuses};
 const [systemReduced,setSystemReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setSystemReduced(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
 useEffect(()=>{let previous=performance.now();const timer=setInterval(()=>{const now=performance.now(),elapsed=(now-previous)/1000;previous=now;const s=settings.current;
  if(document.hidden)return;
  const meeting=s.snapshot.discussions?.find(d=>d.status==='working')?.crew??((s.moment?.cast.length??0)>1?s.moment!.cast:[]);
  const held=[s.selected,s.hovered,...(s.moment?.cast.length===1?s.moment.cast:[])].filter(Boolean) as CrewId[];
  setWalkers(current=>stepWalkers(current,elapsed,{statuses:s.statuses,meeting,held,paused:s.paused||s.snapshot.settings.reducedMotion||systemReduced}));
 },50);return()=>clearInterval(timer);},[systemReduced]);
 return walkers;
}
