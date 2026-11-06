import type {CSSProperties} from 'react';
import type {Crew} from '../shared';
import type {Walker} from '../deckMotion';
import {ACTIONS,type Moment} from '../crewLife';
import type {MissionProjection} from '../missionProjection';
import {crewSceneStatus} from '../roomActivity';

const ROUTINES:Record<string,string>={luffy:'Studying a map',zoro:'Maintaining swords',nami:'Checking charts',usopp:'Tinkering',sanji:'Cooking',chopper:'Sorting supplies',robin:'Reading',franky:'Maintaining the ship',brook:'Practicing music',jinbe:'Tending the helm'};
export function DeckCrew({speechSide,crew,index,walker,state,projection,selected,moment,line,textures,onSelect,onHover}:{speechSide?:'left'|'right';crew:Crew;index:number;walker:Walker;state:string;projection?:MissionProjection;selected:boolean;moment:Moment|null;line?:{crew:string;text:string};textures:{walk?:string;pet?:string;actions?:string;fallback?:string;chopper:string};onSelect:()=>void;onHover:(hover:boolean)=>void}){
 const chopper=crew.id==='chopper',action=moment?.cast.includes(crew.id)?ACTIONS[crew.id]:undefined,performing=Boolean(action&&textures.actions&&(!projection||projection.state==='idle')),acting=performing&&!walker.moving;
 const working=state==='working'&&!walker.moving&&(!projection||crewSceneStatus(projection)==='working'&&projection.crewId===crew.id),chores=state==='idle'&&walker.mode==='chore'&&!walker.moving&&!selected&&(!projection||projection.state==='idle'&&!projection.taskId&&!projection.missionId);
 const petState=walker.moving?(walker.facing===1?'walk-right':'walk-left'):selected&&state==='idle'?'greeting':working||chores?'working':state;
 const start=-(index%2)*288,end=start-288,row=Math.floor(index/2),stateStart=start-(working||chores?144:0);
 let spriteClass='',style:CSSProperties={};
 if(chopper){spriteClass=`chopper-pet pet-${petState}`;style={backgroundImage:`url("${textures.chopper}")`};}
 else if(walker.moving&&textures.walk){spriteClass='walk-sprite';style={backgroundImage:`url("${textures.walk}")`,'--walk-start':`${start}px`,'--walk-end':`${end}px`,'--pet-row':`${-row*72}px`,'--face':walker.facing} as CSSProperties;}
 else if(acting){spriteClass='action-sprite';style={backgroundImage:`url("${textures.actions}")`,'--action-row':action!.row} as CSSProperties;}
 else if(textures.pet){spriteClass=`full-body pet-sprite ${working||chores?'pet-working-loop':'pet-idle-loop'}`;style={backgroundImage:`url("${textures.pet}")`,'--pet-start':`${stateStart}px`,'--pet-end':`${stateStart-144}px`,'--pet-blink':`${stateStart-72}px`,'--pet-row':`${-row*72}px`} as CSSProperties;}
 else{spriteClass='full-body';style={backgroundImage:`url("${textures.fallback}")`,'--sprite-x':`${(index%5)*25}%`,'--sprite-y':`${Math.floor(index/5)*100}%`} as CSSProperties;}
 const activity=projection&&projection.state!=='idle'?projection.label:state==='waiting'?'Waiting for your approval':state==='attention'?'Needs attention':walker.moving?(state==='working'?'Heading to work':'Walking on deck'):working?'Working on your mission':walker.mode==='meeting'?'Talking with the crew':chores?`Ambient deck routine · ${ROUTINES[crew.id]}`:'Taking a breather';
 const speaking=line?.crew===crew.id;
 return <button data-speech-side={speechSide} data-crew-id={crew.id} data-moving={walker.moving} data-mode={walker.mode} data-deck-x={walker.x.toFixed(3)} data-deck-y={walker.y.toFixed(3)} className={`deck-crew deck-crew-${index+1} ${state} ${selected?'selected':''} ${walker.moving?'walking':''} ${working||chores?'at-work':''} ${performing?'performing action-'+crew.id:''} ${speaking?'bantering':''}`}
  style={{left:`${walker.x}%`,top:`${walker.y}%`,zIndex:Math.round(walker.y)+(state==='working'?180:selected||speaking?100:0)}} onClick={onSelect} onMouseEnter={()=>onHover(true)} onMouseLeave={()=>onHover(false)} onFocus={()=>onHover(true)} onBlur={()=>onHover(false)} aria-label={`Talk to ${crew.name}`} title={`${crew.name} · ${activity}`}>
  <span className="deck-speech">{state==='working'?`${crew.name}: ${activity.split(' · ')[0]}`:speaking?line?.text:state==='waiting'?'Waiting.':state==='attention'?'Hit a snag.':crew.name}</span>
  <span className={`deck-sprite ${spriteClass}`} style={style}/>
  <span className="deck-name"><b>{crew.name}</b><small>{activity}</small></span>
  {working?<span className="work-sparks" aria-hidden="true">✦</span>:null}
  {acting?<span aria-hidden="true" className={`power-effect power-${crew.id}`}/>:null}
 </button>;
}
