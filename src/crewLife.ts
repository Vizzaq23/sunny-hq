import {useEffect,useRef,useState} from 'react';
import type {CrewId,Task} from './shared';

export const ACTIONS:Partial<Record<CrewId,{label:string;row:number}>>={luffy:{label:'Gear 5',row:0},zoro:{label:'Bandana & haki',row:1},nami:{label:'Wink & hair flip',row:2},robin:{label:'Bloom hands',row:3},sanji:{label:'Diable Jambe',row:4}};
export type Moment={real?:boolean;id:number;cast:CrewId[];lines:{crew:CrewId;text:string}[];title:string};
export const SCENES:Omit<Moment,'id'>[]=[
 {title:'Galley rivalry',cast:['sanji','zoro'],lines:[{crew:'sanji',text:'Oi, moss-head! Swords OFF my kitchen counter!'},{crew:'zoro',text:'Then stop leaving your pans in my training spot.'},{crew:'sanji',text:'It’s called a KITCHEN!'},{crew:'nami',text:'Both of you! Any damage comes out of your share.'}]},
 {title:'Drums of liberation',cast:['luffy'],lines:[{crew:'luffy',text:'Hahaha! Gear Fiiiive! This is getting fun!'},{crew:'usopp',text:'I taught him that. Mostly. From a safe distance.'},{crew:'chopper',text:'Your hair turned white! Does it hurt?!'}]},
 {title:'Navigator’s charm',cast:['nami'],lines:[{crew:'nami',text:'Like the view, Captain? Navigation fees still apply. ♥'},{crew:'sanji',text:'A fresh tangerine drink for our brilliant navigator!'},{crew:'nami',text:'Good. Put it on the table and let me work.'}]},
 {title:'A few helping hands',cast:['robin'],lines:[{crew:'robin',text:'A few extra hands make light work.'},{crew:'franky',text:'Now THAT is a SUPER filing system!'},{crew:'robin',text:'Do try not to reorganize it with a cannon.'}]},
 {title:'Lost on his own ship',cast:['zoro'],lines:[{crew:'zoro',text:'Bandana on. No distractions.'},{crew:'sanji',text:'The training deck is the OTHER way, marimo.'},{crew:'zoro',text:'I’m taking the scenic route.'}]},
 {title:'Sunny jam session',cast:['brook','franky','jinbe'],lines:[{crew:'brook',text:'A little music for the voyage? Yohohoho!'},{crew:'franky',text:'SUPER! Turn it up!'},{crew:'jinbe',text:'A steady rhythm. Just what the crew needs.'}]},
 {title:'A little heat',cast:['sanji'],lines:[{crew:'sanji',text:'A little heat, a little style. Dinner is almost ready.'}]},
 {title:'Brave doctor',cast:['chopper','usopp'],lines:[{crew:'usopp',text:'Eight thousand followers once asked for my autograph.'},{crew:'chopper',text:'Eight THOUSAND?! That’s amazing!'},{crew:'robin',text:'How fortunate that they all fit in one story.'}]}
];
export function useCrewLife(tasks:Task[],paused:boolean){
 const [moment,setMoment]=useState<Moment|null>(null),[beat,setBeat]=useState(0);
 const serial=useRef(0),scene=useRef(0),lastStatuses=useRef(new Map<string,string>());
 useEffect(()=>window.sunny?.subscribe(event=>{if(event.type==='crew:line'){setBeat(0);setMoment({id:++serial.current,real:true,cast:[event.data.crewId],lines:[{crew:event.data.crewId,text:event.data.text.slice(0,180)+(event.data.text.length>180?'…':'')}],title:'From the crew lounge'});}}),[]);
 const play=(id:CrewId|'rivalry')=>{
  const chosen=id==='rivalry'?SCENES[0]:SCENES.find(s=>s.cast[0]===id&&s.cast.length===1)??SCENES.find(s=>s.cast[0]===id)??SCENES.find(s=>s.cast.includes(id))!;
  setBeat(0);setMoment({...chosen,id:++serial.current});
 };
 useEffect(()=>{
  if(paused){setMoment(null);return;}
  const timer=window.setInterval(()=>{if(!document.hidden){const chosen=SCENES[scene.current++%SCENES.length];setBeat(0);setMoment({...chosen,id:++serial.current});}},30000);
  return()=>clearInterval(timer);
 },[paused]);
 useEffect(()=>{
  if(!moment)return;
  const timer=window.setInterval(()=>setBeat(b=>b+1),3200);
  const end=window.setTimeout(()=>setMoment(null),moment.lines.length*3200+300);
  return()=>{clearInterval(timer);clearTimeout(end);};
 },[moment]);
 useEffect(()=>{
  for(const task of tasks){const before=lastStatuses.current.get(task.id);if(!paused&&before&&before!==task.status&&task.status==='finished'){play(task.crewId);break;}}
  lastStatuses.current=new Map(tasks.map(t=>[t.id,t.status]));
 },[tasks,paused]);
 return {moment,line:moment?.lines[Math.min(beat,moment.lines.length-1)],play,stop:()=>setMoment(null)};
}
