import {useRef,useState} from 'react';
import type {Snapshot,WorkContext} from '../shared';
import {projectMission} from '../missionProjection';
import {MissionBoard} from '../views/MissionBoard';
import './voyage-bar.css';

type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
export function VoyageBar({snapshot,context,onSelect,onOpen,invoke}:{snapshot:Snapshot;context:WorkContext|null;onSelect:(context:WorkContext)=>void;onOpen:(taskId:string)=>void;invoke:Invoke}){
 const dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLElement|null>(null);
 const [panel,setPanel]=useState<'brief'|'review'>('brief');
 const mission=snapshot.missions?.find(m=>m.id===context?.missionId&&m.projectId===context.projectId);
 const project=snapshot.projects.find(p=>p.id===context?.projectId);
 const projection=context?projectMission(snapshot,context):undefined;
 const attempt=mission?.attempts.find(a=>a.id===(context?.attemptId??mission.activeAttemptId));
 const task=projection?.taskId?snapshot.tasks.find(t=>t.id===projection.taskId&&t.projectId===context?.projectId):undefined;
 const show=(next:'brief'|'review')=>{opener.current=document.activeElement as HTMLElement;setPanel(next);dialog.current?.showModal();};
 const close=()=>dialog.current?.close();
 return <section className="voyage-bar" aria-label="Current voyage">
  <label>Mission<select aria-label="Selected voyage mission" value={mission?.id??''} onChange={event=>{const next=snapshot.missions?.find(m=>m.id===event.target.value);if(next)onSelect({projectId:next.projectId,missionId:next.id,runId:next.runId,attemptId:next.activeAttemptId,surface:'deck',returnTo:{view:'missions',projectId:next.projectId,missionId:next.id}});}}>
   <option value="" disabled>{context?.missionId?'Selected mission unavailable':'Choose a mission'}</option>
   {(snapshot.missions??[]).map(m=><option key={m.id} value={m.id}>{snapshot.projects.find(p=>p.id===m.projectId)?.name??'Unavailable project'} · {m.title}</option>)}
  </select></label>
  <div className="voyage-summary"><strong>{project?.name??(context?'Project unavailable':'No voyage selected')}</strong><span>{mission?attempt?`Attempt ${mission.attempts.indexOf(attempt)+1}${attempt.id!==mission.activeAttemptId?' · historical':''}`:'No recorded attempt':'Choose a mission to keep its context across rooms.'}</span><span role="status">{projection?.label??'No work selected'}{task?` · ${task.crewId}`:''}</span></div>
  <div className="voyage-actions"><button disabled={!mission} onClick={()=>show('brief')}>Original brief</button><button disabled={!mission||Boolean(context?.attemptId&&!attempt)||Boolean(attempt&&attempt.id!==mission.activeAttemptId)} onClick={()=>show('review')}>Review mission</button>{task?<button onClick={()=>onOpen(task.id)}>{projection?.state==='approval'||projection?.state==='input'?'Open request':'Work controls'}</button>:null}</div>
  <dialog ref={dialog} className="voyage-dialog" aria-label={panel==='brief'?'Original mission brief':'Mission review'} onClose={()=>opener.current?.focus()}>
   <button className="voyage-return" onClick={close}>Return to room</button>
   {!mission?<p role="alert">Selected mission unavailable. Return to your room to choose a mission.</p>:panel==='brief'?<><h2>{mission.title}</h2><p className="voyage-brief">{mission.objective}</p><h3>Success criteria</h3><ul>{mission.acceptanceCriteria.map((criterion,i)=><li key={i}>{criterion}</li>)}</ul></>:<MissionBoard snapshot={snapshot} invoke={invoke} focusMission={{id:mission.id,sequence:0}} onOpen={taskId=>{close();onOpen(taskId);}}/>}
  </dialog>
 </section>;
}
