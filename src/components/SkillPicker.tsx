import {useEffect,useRef,useState} from 'react';
import type {SkillChoice,SkillOption} from '../shared';
import './skill-picker.css';

type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
type Result={available:SkillOption[];suggested:SkillOption[]};

export function SkillPicker({projectId,brief,roleId,disabled,invoke,value,onChange,onReadyChange}:{projectId:string;brief:string;roleId:string;disabled:boolean;invoke:Invoke;value:SkillChoice[];onChange:(next:SkillChoice[])=>void;onReadyChange:(ready:boolean)=>void}){
 const [result,setResult]=useState<Result>({available:[],suggested:[]});
 const [error,setError]=useState('');
 const change=useRef(onChange),readyChange=useRef(onReadyChange),scope=useRef(`${projectId}:${roleId}`);
 change.current=onChange;readyChange.current=onReadyChange;
 useEffect(()=>{const next=`${projectId}:${roleId}`;if(scope.current===next)return;scope.current=next;change.current([]);setResult({available:[],suggested:[]});setError('');},[projectId,roleId]);
 useEffect(()=>{
  if(!projectId||!brief.trim()){setResult({available:[],suggested:[]});readyChange.current(true);return;}
  readyChange.current(false);
  let active=true;
  const timer=window.setTimeout(()=>{
   void invoke<Result>('skills:suggest',{projectId,brief:brief.slice(0,12000),roleId}).then(next=>{
    if(!active)return;setResult(next);setError('');readyChange.current(true);
   }).catch(reason=>{if(active){setError(reason instanceof Error?reason.message:String(reason));setResult({available:[],suggested:[]});readyChange.current(true);}});
  },300);
  return()=>{active=false;window.clearTimeout(timer);};
 },[projectId,brief,roleId,invoke]);
 const toggle=(skill:SkillOption)=>{
  const exists=value.some(item=>item.id===skill.id);
  if(exists&&value.find(item=>item.id===skill.id)?.revision!==skill.revision)onChange(value.map(item=>item.id===skill.id?{id:skill.id,revision:skill.revision}:item));
  else if(exists)onChange(value.filter(item=>item.id!==skill.id));
  else if(value.length<2)onChange([...value,{id:skill.id,revision:skill.revision}]);
 };
 if(!projectId||!brief.trim())return null;
 return <fieldset className="skill-picker" disabled={disabled}><legend>Skills for this task</legend>
  <p>Suggestions are not enabled until you choose their checkboxes. Select up to two skills for the crew to use.</p>
  {error?<small role="alert">Skills unavailable: {error}</small>:result.available.length?<div className="skill-options">{result.available.map(skill=>{
   const selected=value.find(item=>item.id===skill.id),stale=selected&&selected.revision!==skill.revision;
   return <label key={skill.id}><input type="checkbox" checked={Boolean(selected&&!stale)} disabled={disabled||!selected&&value.length>=2} onChange={()=>toggle(skill)}/><span><b>{skill.name}</b><small>{skill.purpose} · {skill.category}{result.suggested.some(item=>item.id===skill.id)?' · Suggested':''}</small>{stale?<small role="alert">Changed since selection. Select it again.</small>:null}</span></label>;
  })}</div>:<small>No reviewed skill matches this task in the connected Codex runtime.</small>}
 </fieldset>;
}
