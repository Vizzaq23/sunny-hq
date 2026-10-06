import {useEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import type {Snapshot,Crew} from '../shared';
import {CREW} from '../data';
import {useCrewTexture} from '../crewTexture';
import {roomCrew} from '../roomActivity';
import {stepRoomActor,ROOM_STATION_CREW,ROOM_STATION_X} from '../roomMotion';

export function RoomActors({snapshot,projectId,onOpen,paused=false}:{snapshot:Snapshot;projectId:string;onOpen:(id:string)=>void;paused?:boolean}){
 const asset=(name:string)=>new URL(`${import.meta.env.BASE_URL}assets/${name}`,location.href).href;
 const walk=useCrewTexture(asset('crew-walk.png'),'walk'),pet=useCrewTexture(asset('crew-pet-states.png'),'states');
 const [systemReduced,setSystemReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setSystemReduced(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
 const reduced=systemReduced||snapshot.settings.reducedMotion;
 return <div className={`room-actors ${reduced||paused?'room-motion-reduced':''}`}>{ROOM_STATION_CREW.map((id,lane)=>{const crew=CREW.find(c=>c.id===id)!;return <RoomActor key={projectId+id} crew={crew} lane={lane} activity={roomCrew(snapshot,projectId,id)} reduced={reduced} paused={paused} walk={walk} pet={pet} onOpen={onOpen}/>;})}</div>;
}
function RoomActor({crew,lane,activity,reduced,paused,walk,pet,onOpen}:{crew:Crew;lane:number;activity:ReturnType<typeof roomCrew>;reduced:boolean;paused:boolean;walk?:string;pet?:string;onOpen:(id:string)=>void}){
 const [position,setPosition]=useState(()=>({y:activity.working&&reduced?52:67,moving:false}));
 const current=useRef({activity,reduced,paused});current.current={activity,reduced,paused};
 useEffect(()=>{let previous=performance.now();const timer=setInterval(()=>{const now=performance.now(),elapsed=(now-previous)/1000;previous=now;if(document.hidden)return;setPosition(p=>{const next=stepRoomActor(p,current.current.activity,elapsed,current.current.reduced,current.current.paused);return next.y===p.y&&next.moving===p.moving?p:next;});},50);return()=>clearInterval(timer);},[]);
 const moving=position.moving&&!activity.attention&&!reduced&&!paused,working=activity.working&&!moving&&position.y<=52.001;
 const index=CREW.findIndex(c=>c.id===crew.id),start=-(index%2)*288-(working?144:0),row=Math.floor(index/2);
 const mode=moving?'walking':working?'working':'still';
 const style={'--room-frame-start':`${moving?-(index%2)*288:start}px`,'--room-frame-end':`${moving?-(index%2)*288-288:start-144}px`,backgroundImage:`url("${moving?walk??pet:pet}")`,backgroundPositionY:`${-row*72}px`} as CSSProperties;
 return <button className={`room-actor ${mode} ${activity.attention?'needs-attention':''}`} data-room-crew={crew.id} data-motion={mode} data-position={position.y.toFixed(2)} style={{left:`${ROOM_STATION_X[lane]}%`,top:`${position.y}%`}} disabled={!activity.task} onClick={()=>activity.task&&onOpen(activity.task.id)} aria-label={`${crew.name}: ${activity.state}. ${activity.task?'Open task':'No assignment'}`}><span className="room-actor-sprite" aria-hidden="true" style={style}/><b>{crew.name}</b></button>;
}
