import {useState} from 'react';
import type {Snapshot} from '../shared';
import {useDraft,clearSubmittedDraft} from '../useDraft';
import {LocalSourcePicker} from './LocalSourcePicker';
import {LocalRecallPreview} from './LocalRecallPreview';
import {CREW_BY_ID} from '../data';
import specialties from '../../desktop/local-specialties.json';

type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
const skills=Object.entries(specialties.skills).map(([id,value])=>({id,...value}));
const crewSpecialties:Record<string,{role:string;skills:string[];guidelines:string;useWhen:string;deliverable:string;starter:string}>=specialties.crew;

export function LocalCrewPanel({initialProjectId,crewId,name,snapshot,invoke}:{initialProjectId?:string;crewId:string;name:string;snapshot:Snapshot;invoke:Invoke}){
 const profile=snapshot.localCrew?.profiles[crewId];
 const specialty=crewSpecialties[crewId];
 const [projectId,setProjectId]=useState(initialProjectId??snapshot.projects[0]?.id??'');
 const [model,setModel]=useState(profile?.model??'');
 const [instructions,setInstructions]=useDraft(`local-crew:${crewId}:instructions`,profile?.instructions??specialty.guidelines);
 const [selected,setSelected]=useState(profile?.skills??specialty.skills);
 const [models,setModels]=useState<{name:string;size:number}[]>([]);
 const [busy,setBusy]=useState(false),[sending,setSending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const draftKey=`local-crew:${crewId}:${projectId}`;
 const [prompt,setPrompt]=useDraft(draftKey);
 const [lesson,setLesson]=useDraft(`${draftKey}:lesson`);
 const session=profile?.sessions.find(s=>s.projectId===projectId);
 const activeRun=Object.entries(snapshot.localCrew?.profiles??{}).flatMap(([id,p])=>p.sessions.filter(s=>s.status==='working').map(s=>({crewId:id,projectId:s.projectId})))[0];
 const council=snapshot.localCrew?.councils?.find(record=>['planning','working','reviewing','synthesizing'].includes(record.status));
 const reporter=snapshot.localCrew?.councils?.find(record=>record.report?.status==='working');
 const active=Boolean(activeRun||council||reporter);
 const otherRun=activeRun&&(activeRun.crewId!==crewId||activeRun.projectId!==projectId)?activeRun:undefined;
 const dirty=instructions!==(profile?.instructions??specialty.guidelines)||model!==profile?.model||JSON.stringify(selected)!==JSON.stringify(profile?.skills);
 const perform=async(work:()=>Promise<void>)=>{setBusy(true);setError('');setNotice('');try{await work();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 const ask=async()=>{const submitted=prompt;setSending(true);setError('');setNotice('');try{await invoke('localCrew:ask',{crewId,projectId,prompt:submitted});clearSubmittedDraft(draftKey,submitted);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setSending(false);}};
 const renderSkill=(skill:typeof skills[number])=><label key={skill.id} className="local-skill-choice"><input type="checkbox" checked={selected.includes(skill.id)} disabled={!selected.includes(skill.id)&&selected.length>=4} onChange={event=>setSelected(event.target.checked?[...selected,skill.id]:selected.filter(id=>id!==skill.id))}/><span><b>{skill.label}</b><small>{skill.description}</small></span></label>;
 const primarySkills=skills.filter(skill=>specialty.skills.includes(skill.id)||selected.includes(skill.id));
 const otherSkills=skills.filter(skill=>!primarySkills.includes(skill));
 return <div className="local-crew-panel">
  <h4>{name} · {specialty.role}</h4>
  <p>{specialty.useWhen}</p><p className="local-specialty-output"><b>What to expect:</b> {specialty.deliverable}</p>
  <small>This profile gives local advice from what you share. It does not edit files, browse or run checks.</small>
  <label>Project<select aria-label="Specialist project" disabled={sending} value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="" disabled>Choose a project</option>{snapshot.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
  <details open={!profile?.model||dirty}>
   <summary>Model and skills{profile?.model?` · ${profile.model}`:''}</summary>
   <p>Start Ollama on this computer with a downloaded model. Sunny connects to port 11434 and never downloads a model or falls back to cloud.</p>
   <button disabled={busy||active} onClick={()=>void perform(async()=>{const found=await invoke<{name:string;size:number}[]>('localCrew:models',{});setModels(found);setNotice(found.length?`${found.length} local model(s) found.`:'No downloaded local models found. Add one in Ollama, then refresh.');})}>Refresh local models</button>
   <label>Local model<select aria-label="Local model" value={model} disabled={busy||active} onChange={e=>setModel(e.target.value)}><option value="">Choose an installed model</option>{model&&!models.some(m=>m.name===model)?<option value={model}>{model} (saved; refresh to check)</option>:null}{models.map(m=><option key={m.name} value={m.name}>{m.name} · {(m.size/1024**3).toFixed(1)} GB</option>)}</select></label>
   <fieldset disabled={busy||active}><legend>Skills · {selected.length} of four selected</legend>{primarySkills.map(renderSkill)}<details className="local-other-skills"><summary>Other skills</summary>{otherSkills.map(renderSkill)}</details></fieldset>
   <button disabled={busy||active} onClick={()=>{setSelected([...specialty.skills]);setNotice('Recommended skills selected. Your personal instructions are unchanged. Save local setup to apply.');}}>Use {name}’s recommended skills</button>
   <label>Your personal instructions<textarea aria-label="Personal instructions" maxLength={4000} value={instructions} disabled={busy||active} onChange={e=>setInstructions(e.target.value)} placeholder="Tell me your preferred level of detail, working style and constraints."/></label>
   <small>These preferences belong to {name} across local projects. Save project-specific conventions as lessons below.</small>
   <button disabled={busy||active||!model||!selected.length} onClick={()=>void perform(async()=>{const saved=await invoke<{instructions?:string}>('localCrew:configure',{crewId,model,skills:selected,instructions});setInstructions(saved.instructions??'');setNotice('Model and skills saved for '+name+'.');})}>Save local setup</button>
  </details>
  <p className="local-crew-state" role="status">{session?.status==='working'?'Preparing a local reply…':session?.status==='finished'?'Reply ready · advice only':session?.status==='interrupted'?'Reply interrupted':session?.status==='failed'?'Reply failed':profile?.model?'Ready for a local conversation.':'Choose a local model to start.'} {snapshot.growth?.enabled===false?'Memory learning and recall are off.':'Saved project lessons guide future replies. Past answers stay in the journal.'}</p>
  {otherRun?<div className="local-crew-busy"><p role="status">{CREW_BY_ID.get(otherRun.crewId)?.name??otherRun.crewId} is using the local model for {snapshot.projects.find(p=>p.id===otherRun.projectId)?.name??'another project'}.</p><button disabled={busy} onClick={()=>void perform(async()=>{await invoke('localCrew:stop',otherRun);setNotice('Stopped the other local reply.');})}>Stop other local reply</button></div>:null}
  {council||reporter?<p className="local-crew-busy" role="status">{council?'A crew council is working.':'Morgans is preparing a bulletin.'} Close this profile and open Luffy to watch or stop it before starting another local reply.</p>:null}
  {session?.error?<p role="alert" className="journal-error">{session.error}</p>:null}
  <div className="local-crew-messages" aria-label={`Conversation with ${name}`}>{session?.messages.map(m=><article key={m.id}><strong>{m.role==='user'?'You':name}</strong>{m.model?<small> · {m.model}</small>:null}<p>{m.text}</p></article>)}</div>
  <LocalSourcePicker key={`${crewId}:${projectId}`} crewId={crewId} projectId={projectId} prompt={prompt} onPrompt={setPrompt} invoke={invoke}/>
  <LocalRecallPreview crewId={crewId} projectId={projectId} query={prompt} growth={snapshot.growth} invoke={invoke}/>
  <form onSubmit={e=>{e.preventDefault();void ask();}}>
   <label>Ask {name}<textarea id={`local-question-${crewId}`} aria-label={`Ask ${name}`} value={prompt} maxLength={16000} onChange={e=>setPrompt(e.target.value)} placeholder={specialty.starter}/></label>
   <button type="button" disabled={prompt.length+specialty.starter.length+2>16000} onClick={()=>{setPrompt(prompt+(prompt?'\n\n':'')+specialty.starter);document.getElementById(`local-question-${crewId}`)?.focus();}}>Add a starter question</button>
   <div className="local-crew-actions"><button type="submit" disabled={busy||sending||active||!projectId||!prompt.trim()||!profile?.model||dirty}>{sending?'Waiting for reply…':'Ask locally'}</button>{session?.status==='working'?<button type="button" onClick={()=>void perform(async()=>{await invoke('localCrew:stop',{crewId,projectId});})}>Stop local reply</button>:null}<button type="button" disabled={busy||sending||active||!session} onClick={()=>{if(window.confirm('Clear this local conversation? Journal memories remain until you forget them separately.'))void perform(async()=>{await invoke('localCrew:clear',{crewId,projectId});setNotice('Conversation cleared.');});}}>Clear conversation</button></div>
  </form>
  {dirty?<small>Save the model, skills, and guidelines before sending a question.</small>:null}
  <details className="local-teaching"><summary>Teach a preference or correction</summary><label>Lesson for this project<textarea aria-label="Project lesson" maxLength={2000} value={lesson} onChange={e=>setLesson(e.target.value)} placeholder="A verified fact, project convention or preference you want this member to remember."/></label>
  <button disabled={busy||!projectId||!lesson.trim()} onClick={()=>void perform(async()=>{const submitted=lesson;await invoke('localCrew:teach',{crewId,projectId,text:submitted});clearSubmittedDraft(`${draftKey}:lesson`,submitted);setNotice('Project lesson saved. Edit or forget it in Memories.');})}>Remember correction</button>
  <small>Local lessons stay out of cloud mission recall. Memory changes future context, not model weights. Correct or forget lessons in Memories. Settings → Export includes local profiles and conversations.</small></details>
  {notice?<p role="status">{notice}</p>:null}{error?<p role="alert" className="journal-error">{error}</p>:null}
 </div>;
}
