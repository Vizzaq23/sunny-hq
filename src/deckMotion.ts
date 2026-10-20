import type {CrewId} from './shared';
export type Point={x:number;y:number};
export const NODES:Record<string,Point>={
 north:{x:50,y:35},ne:{x:58,y:38},east:{x:59,y:47},se:{x:56,y:58},south:{x:48,y:59},sw:{x:40,y:54},west:{x:38,y:45},nw:{x:38,y:36},
 galleyDoor:{x:51,y:30},galley:{x:50,y:25},portSteps:{x:33,y:32},port:{x:28,y:35},bow:{x:24,y:47},
 stairTop:{x:48,y:64},stairBottom:{x:48,y:76},northPass:{x:38,y:30},galleyApron:{x:46,y:30},libraryDoor:{x:43,y:76},library:{x:27,y:66},charts:{x:36,y:72},workshopDoor:{x:57,y:76},testing:{x:63,y:71},workshop:{x:72,y:66},
 starboardSteps:{x:66,y:32},music:{x:72,y:29},helmDoor:{x:80,y:34},helm:{x:88,y:42},medical:{x:58,y:51},meetLeft:{x:44,y:54},meetRight:{x:51,y:55}
};
// Hand-authored floor routes use the stairways and room openings in ship-deck.png.
// The ring around the central hatch avoids the hatch and the two orange trees.
export const EDGES:[string,string][]=[['north','ne'],['ne','east'],['east','medical'],['medical','se'],['se','south'],['south','sw'],['sw','west'],['west','nw'],['nw','northPass'],['northPass','galleyApron'],['galleyApron','north'],['north','galleyDoor'],['galleyDoor','galley'],['nw','portSteps'],['portSteps','port'],['port','bow'],['south','stairTop'],['stairTop','stairBottom'],['stairBottom','libraryDoor'],['charts','library'],['libraryDoor','charts'],['stairBottom','workshopDoor'],['workshopDoor','testing'],['testing','workshop'],['ne','starboardSteps'],['starboardSteps','music'],['music','helmDoor'],['helmDoor','helm'],['sw','meetLeft'],['meetLeft','meetRight'],['meetRight','south']];
export const HOMES:Record<CrewId,string>={luffy:'south',zoro:'west',nami:'charts',usopp:'testing',sanji:'galley',chopper:'medical',robin:'library',franky:'workshop',brook:'music',jinbe:'helm'};
export function route(start:string,end:string):string[]{
 if(!NODES[start]||!NODES[end])throw Error('Unknown deck location');if(start===end)return [];
 const distances:Record<string,number>={[start]:0},previous:Record<string,string>={},pending=new Set(Object.keys(NODES));
 while(pending.size){const current=[...pending].sort((a,b)=>(distances[a]??Infinity)-(distances[b]??Infinity))[0];pending.delete(current);if(current===end)break;
  for(const [a,b]of EDGES){const next=a===current?b:b===current?a:null;if(!next||!pending.has(next))continue;const d=(distances[current]??Infinity)+Math.hypot((NODES[current].x-NODES[next].x)*1.5,NODES[current].y-NODES[next].y);if(d<(distances[next]??Infinity)){distances[next]=d;previous[next]=current;}}
 }
 const result:string[]=[];let current=end;while(current!==start){result.unshift(current);current=previous[current];if(!current)throw Error('No connected deck route');}return result;
}
export type Walker={id:CrewId;x:number;y:number;node:string;target:string;path:string[];facing:1|-1;moving:boolean;mode:string;rest:number;visits:number};
export function createWalkers():Walker[]{return Object.entries(HOMES).map(([id,node],i)=>({id:id as CrewId,...NODES[node],node,target:node,path:[],facing:1,moving:false,mode:'idle',rest:1.2+i*.45,visits:i}));}
type Options={statuses?:Partial<Record<CrewId,string>>;meeting?:CrewId[];held?:CrewId[];paused?:boolean};
const destinations=['north','bow','sw','se','nw','east','port','south'];
function target(w:Walker,end:string){if(w.target===end)return;w.target=end;const anchor=w.path[0]??w.node;w.path=[...(w.path.length?[anchor]:[]),...route(anchor,end)];}
export function stepWalkers(current:Walker[],elapsed:number,{statuses={},meeting=[],held=[],paused=false}:Options):Walker[]{
 if(paused){
  const modeFor=(id:CrewId)=>{const status=statuses[id];return status==='waiting'||status==='attention'?status:status==='working'?'working':'idle';};
  if(current.every(w=>!w.moving&&w.mode===modeFor(w.id)))return current;
  return current.map(w=>!w.moving&&w.mode===modeFor(w.id)?w:{...w,moving:false,mode:modeFor(w.id)});
 }
 const dt=Math.min(.1,Math.max(0,elapsed));
 return current.map((old,index)=>{const w={...old,path:[...old.path]};const status=statuses[w.id]??'idle';w.moving=false;
  if(status==='waiting'||status==='attention'){w.mode=status;return w;}
  if(paused){w.mode=status==='working'?'working':'idle';return w;}
  if(held.includes(w.id)){w.mode=status==='working'?'working':'idle';return w;}
  if(status==='working'){target(w,HOMES[w.id]);w.mode='working';}
  else if(meeting.includes(w.id)){target(w,meeting.indexOf(w.id)%2?'meetRight':'meetLeft');w.mode='meeting';}
  else{w.mode=w.path.length?'walking':'chore';w.rest-=dt;if(!w.path.length&&w.rest<=0){const destination=w.visits%3===0?HOMES[w.id]:destinations[(w.visits*3+index)%destinations.length];w.visits++;target(w,destination);w.rest=3+(index%4);}}
  if(w.path.length){const next=NODES[w.path[0]],dx=next.x-w.x,dy=next.y-w.y,distance=Math.hypot(dx*1.5,dy);const stride=dt*(9+(index%3));if(Math.abs(dx)>.02)w.facing=dx<0?-1:1;
   w.moving=true;if(distance<=stride){w.x=next.x;w.y=next.y;w.node=w.path.shift()!;if(!w.path.length){w.moving=false;w.rest=3+(index%4);}}
   else{w.x+=dx/distance*stride;w.y+=dy/distance*stride;}
  }
  return w;
 });
}
