import {useEffect,useRef,useState} from 'react';
import type {LocalCrewProfile} from '../shared';
import {useDraft} from '../useDraft';
import specialties from '../../desktop/local-specialties.json';

type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
export function LocalReporterSettings({profile,disabled,invoke}:{profile?:LocalCrewProfile;disabled:boolean;invoke:Invoke}){
 const [model,setModel]=useState(profile?.model??'');
 const [instructions,setInstructions]=useDraft('local-reporter:instructions',profile?.instructions??specialties.crew.morgans.guidelines);
 const [models,setModels]=useState<{name:string}[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const pending=useRef(false);
 useEffect(()=>{setModel(profile?.model??'');},[profile?.model]);
 const perform=async(work:()=>Promise<void>)=>{if(pending.current)return;pending.current=true;setBusy(true);setNotice('');try{await work();}catch(error){setNotice(error instanceof Error?error.message:String(error));}finally{pending.current=false;setBusy(false);}};
 return <details><summary>Reporter model and style</summary>
  <p>Morgans has his own local model binding and writing guidelines. He still receives only sanitized status packets, with no private journal recall.</p>
  <fieldset disabled={disabled||busy}>
   <legend>Morgans’ local setup</legend>
   <button onClick={()=>void perform(async()=>{const found=await invoke<{name:string}[]>('localCrew:models',{});setModels(found);setNotice(`${found.length} downloaded models found.`);})}>Find reporter models</button>
   <label>Local reporter model<select aria-label="Morgans local model" value={model} onChange={event=>setModel(event.target.value)}><option value="">Choose a downloaded model</option>{model&&!models.some(item=>item.name===model)?<option value={model}>{model} · saved</option>:null}{models.map(item=><option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
   <label>Reporting guidelines<textarea aria-label="Morgans reporting guidelines" maxLength={4000} value={instructions} onChange={event=>setInstructions(event.target.value)}/></label>
   <button disabled={!model} onClick={()=>void perform(async()=>{const saved=await invoke<LocalCrewProfile>('localCrew:configure',{crewId:'morgans',model,skills:profile?.skills??specialties.crew.morgans.skills,instructions});setInstructions(saved.instructions??'');setNotice('Morgans’ local reporting setup saved.');})}>Save reporter setup</button>
  </fieldset>
  {notice?<p role="status">{notice}</p>:null}
 </details>;
}
