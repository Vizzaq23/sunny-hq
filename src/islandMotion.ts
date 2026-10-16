import {useEffect,useRef,useState} from 'react';
import type {Crew,CrewId,Snapshot} from './shared';
import type {Walker} from './deckMotion';
import type {IslandPoint} from './islandControls';
import {crewStatus} from './useDeckMotion';
// IDs are persisted on island jobs and residents. Only their presentation changes.
export const DISTRICTS=[
 {id:'harbor',name:'Enies Lobby',x:16,y:64,crewId:'luffy',theme:'justice',tagline:'Mission command',description:'Open project quarters, inspect mission evidence and decide what the crew should do next.'},
 {id:'research',name:'Ohara',x:23,y:23,crewId:'robin',theme:'scholar',tagline:'Research and knowledge',description:'Gather sources, investigate questions and keep useful findings in the logbook.'},
 {id:'engineering',name:'Water Seven',x:69,y:19,crewId:'franky',theme:'shipwright',tagline:'Build and repair',description:'Shape prototypes, implement features and verify the work with Franky.'},
 {id:'creative',name:'Thriller Bark',x:84,y:40,crewId:'brook',theme:'moonlit',tagline:'Stories and visual craft',description:'Draft stories, explore art and review creative deliverables with Brook.'},
 {id:'market',name:'Dressrosa',x:81,y:70,crewId:'nami',theme:'festival',tagline:'Markets and opportunities',description:'Study customer needs and prepare offers for captain review.'},
 {id:'garden',name:'Skypiea',x:48,y:72,crewId:'chopper',theme:'sky',tagline:'Care and steady growth',description:'Tend repeatable jobs, diagnose blockers and improve the crew’s work.'}
] satisfies ReadonlyArray<{id:string;name:string;x:number;y:number;crewId:CrewId;theme:string;tagline:string;description:string}>;
const homes:Record<string,string>={luffy:'harbor',zoro:'engineering',nami:'market',usopp:'engineering',sanji:'creative',chopper:'garden',robin:'research',franky:'engineering',brook:'creative',jinbe:'harbor'};
export function useIslandMotion(crew:Crew[],snapshot:Snapshot,paused:boolean,held:string|null,control:{id:string;position:IslandPoint}|null=null){
 const [positions,setPositions]=useState<Walker[]>([]),live=useRef({crew,snapshot,paused,held,control});live.current={crew,snapshot,paused,held,control};
 useEffect(()=>{let previous=performance.now();const timer=setInterval(()=>{const now=performance.now(),dt=Math.min(.1,(now-previous)/1000);previous=now;const s=live.current;if(document.hidden)return;const quiet=s.paused||s.snapshot.settings.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;
  setPositions(old=>s.crew.map((c,i)=>{const district=DISTRICTS.find(d=>d.id===(s.snapshot.world?.residents.find(r=>r.id===c.id)?.district||homes[c.id]))||DISTRICTS[0];const home={x:district.x+(i%3-1)*2,y:district.y+(i%2)*2};let w=old.find(w=>w.id===c.id);if(!w||w.node!==district.id)w={id:c.id,...home,node:district.id,target:'home',path:[],facing:1,moving:false,mode:'idle',rest:2+i*.4,visits:0};w={...w};const status=crewStatus(s.snapshot,c.id);w.moving=false;if(s.control?.id===c.id)return {...w,...s.control.position,node:'captain-controlled',target:'captain-controlled',path:[],mode:'captain'};if(['waiting','attention'].includes(status)){w.mode=status;return w;}if(quiet||s.held===c.id||c.spriteRow!==undefined){w.mode=status==='working'?'working':'idle';return w;}if(status==='working'){w.target='home';w.mode='working';}else{w.rest-=dt;if(w.rest<=0){w.target=w.target==='home'?'plaza':'home';w.rest=12+(i%4)*2;}w.mode='chore';}const end=w.target==='home'?home:{x:home.x+(i%2?2:-2),y:home.y+2};const dx=end.x-w.x,dy=end.y-w.y,d=Math.hypot(dx,dy),step=dt*3.5;if(d>.2){w.moving=true;w.facing=dx<0?-1:1;w.x+=dx/d*Math.min(d,step);w.y+=dy/d*Math.min(d,step);}return w;}));
 },60);return()=>clearInterval(timer);},[]);return positions;
}
