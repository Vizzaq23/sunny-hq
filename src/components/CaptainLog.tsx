import {useEffect,useMemo,useState} from 'react';
import type {Snapshot,WorkContext} from '../shared';
import {workEntries} from '../taskFlow';
import {resolveReplyDisplay,resolveWorkContext} from '../workContext';
import {updateWorkspace} from '../useDraft';
import './captain-log.css';
type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
const labels:Record<string,string>={DRAFT:'Brief saved — ready to send',RUNNING:'Crew working',WAITING_FOR_REVIEW:'Ready for captain review',NEEDS_USER:'Needs your input',FAILED:'Attempt failed',CANCELLED:'Stopped',BLOCKED:'Blocked',COMPLETE:'Accepted'};
export function CaptainLog({snapshot,context,onContext,onOpenResult,onRequestChanges,invoke}:{snapshot:Snapshot;context:WorkContext|null;onContext:(context:WorkContext)=>void;onOpenResult:(taskId:string)=>void;onRequestChanges:(missionId:string)=>void;invoke:Invoke}){
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[preview,setPreview]=useState<{filePath:string;text:string;sha256:string}>(),[error,setError]=useState('');
 const mission=(snapshot.missions??[]).find(m=>m.id===context?.missionId),attempt=mission?.attempts.find(a=>a.id===context?.attemptId);
 const task=snapshot.tasks.find(t=>t.id===context?.taskId);
 const stage=attempt?.workflow?.stages.find(s=>!['finished','completed','complete'].includes(s.status));
 const owner=snapshot.tasks.find(t=>t.id===stage?.taskId);
 const entries=useMemo(()=>workEntries(snapshot.missions??[],snapshot.tasks),[snapshot.missions,snapshot.tasks]);
 const unavailable=resolveWorkContext(context,snapshot).unavailable;
 const result=mission?.selectedResult,ref=result?.ref;
 const replyTask=ref?.kind==='reply'?snapshot.tasks.find(t=>t.id===ref.taskId):undefined;
 const reply=ref?.kind==='reply'?replyTask?.messages.filter(m=>m.id===ref.messageId):undefined;
 const [replyDisplay,setReplyDisplay]=useState<{id:string;text?:string;unavailable?:string}>();
 useEffect(()=>{let cancelled=false;if(ref?.kind==='reply'&&result)void resolveReplyDisplay(ref,replyTask).then(display=>{if(!cancelled)setReplyDisplay({id:result.id,...display});}).catch(()=>{if(!cancelled)setReplyDisplay({id:result!.id,unavailable:'Selected reply could not be verified.'});});return()=>{cancelled=true;};},[result?.id,ref?.sha256,replyTask?.status,reply?.length,reply?.[0]?.text]);
 useEffect(()=>{const acceptance=mission?.acceptance;if(acceptance&&!acceptance.legacy&&acceptance.id&&window.sunny&&!snapshot.workspace.seenAcceptanceIds.includes(acceptance.id))void updateWorkspace(invoke,{seenAcceptanceId:acceptance.id}).catch(()=>{});},[mission?.acceptance,snapshot.workspace.revision]);
 useEffect(()=>{setPreview(undefined);setError('');},[result?.id,mission?.revision]);
 const inspectFile=async()=>{if(!mission||ref?.kind!=='deliverable')return;try{setPreview(await invoke('mission:previewDeliverable',{missionId:mission.id,revision:mission.revision,artifactId:ref.artifactId}));}catch(e){setError(e instanceof Error?e.message:String(e));}};
 const openMission=()=>{if(mission&&context)onContext({...context,surface:'deck',taskId:undefined});};
 return <aside className="captain-log" aria-label="Captain log">
  <header><span className="eyebrow">Aboard the Sunny</span><h2>Captain's log</h2></header>
  {unavailable?<p className="captain-unavailable" role="alert">{unavailable}</p>:null}
  {mission?<section className="captain-current" data-mission-id={mission.id} data-attempt-id={attempt?.id}>
   <small>{snapshot.projects.find(p=>p.id===mission.projectId)?.name??'Project unavailable'}</small><h3>{mission.title}</h3><p>{mission.objective}</p>
   <p className="captain-log-status" role="status" aria-live="polite">{labels[mission.status]??mission.status}{mission.connection==='reconciling'?' — Connection needs reconciliation':''}</p>
   <p className="captain-stage">{stage?`${stage.id}: ${owner?.crewId??'Awaiting assignment'} · ${stage.status}`:attempt?.workflow?.complete?'All linked stages reported results':attempt?'Inspect linked crew tasks':'No attempt started'}</p>
   <ul className="captain-criteria">{mission.acceptanceCriteria.map((criterion,i)=><li key={i}>{criterion}</li>)}</ul>
   {attempt?.workflow?<ol aria-label="Linked mission stages">{attempt.workflow.stages.map(s=><li key={s.id}><span>{s.id} · {s.status}</span>{s.taskId?<button onClick={()=>onOpenResult(s.taskId!)}>Open {snapshot.tasks.find(t=>t.id===s.taskId)?.crewId??'crew'} result</button>:null}</li>)}</ol>:null}
   {result?<section className="captain-selected-result"><h4>Selected result</h4><p>{ref?.kind==='reply'?'Crew reply':'Recorded file'} · {result.attemptId===mission.activeAttemptId?'Current attempt':'Earlier attempt'}</p><code>{ref?.sha256}</code>{ref?.kind==='reply'?<>{replyDisplay?.id===result.id&&replyDisplay.text===reply?.[0]?.text?<pre>{replyDisplay.text}</pre>:<p>{replyDisplay?.id===result.id?replyDisplay.unavailable??'Verifying selected reply…':'Verifying selected reply…'}</p>}<button className="captain-open-result" onClick={()=>onOpenResult(ref.taskId)}>Open selected reply</button></>:<><button className="captain-open-result" onClick={()=>void inspectFile()}>Preview selected file</button>{preview?<><p>{preview.filePath} · {preview.sha256}</p><pre>{preview.text}</pre></>:null}</>}</section>:mission.status==='WAITING_FOR_REVIEW'?<p>Select a crew reply or recorded file before acceptance.</p>:null}
   {mission.acceptance?<p className="captain-acceptance">{mission.acceptance.legacy?'Historical acceptance — result binding unavailable':'Captain accepted the bound result'}{mission.acceptedAt?` · ${new Date(mission.acceptedAt).toLocaleString()}`:''}</p>:null}
   <button className="captain-review-mission" disabled={Boolean(unavailable)} onClick={openMission}>{mission.status==='WAITING_FOR_REVIEW'?'Review and accept result':mission.status==='DRAFT'?'Review brief and send crew':'Open mission controls'}</button>
   {mission.status==='WAITING_FOR_REVIEW'?<button className="captain-request-changes" disabled={Boolean(unavailable)} onClick={()=>onRequestChanges(mission.id)}>Request changes</button>:null}
   <details><summary>Recent mission activity</summary><ul>{mission.events.slice(-8).reverse().map(e=><li key={e.id}>{e.type.replaceAll('_',' ')} · {new Date(e.time).toLocaleTimeString()}</li>)}</ul></details>
  </section>:task?<section className="captain-current"><small>Conversation · {snapshot.projects.find(p=>p.id===task.projectId)?.name??'Project unavailable'}</small><h3>{task.title}</h3><p className="captain-log-status" role="status">{task.crewId} · {task.status}</p><p>A conversation turn is reviewed in its thread.</p><button className="captain-open-result" disabled={Boolean(unavailable)} onClick={()=>onOpenResult(task.id)}>Open conversation</button></section>:<p className="captain-empty">Save a mission brief to set your course, or open a conversation below.</p>}
  {error?<p role="alert">{error}</p>:null}
  <section className="captain-queue"><label>Search work<input aria-label="Search captain log" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Title or project"/></label><label>Show<select aria-label="Filter captain log" value={filter} onChange={e=>setFilter(e.target.value)}>{['all','attention','active','review','accepted','conversation'].map(value=><option key={value} value={value}>{value==='all'?'All work':value.charAt(0).toUpperCase()+value.slice(1)}</option>)}</select></label>
   <div className="captain-work-list">{entries.filter(entry=>(filter==='all'||filter===entry.phase)&&(!query||`${entry.title} ${snapshot.projects.find(p=>p.id===entry.projectId)?.name??''}`.toLowerCase().includes(query.toLowerCase()))).map(entry=><button className="work-entry" data-id={entry.id} data-kind={entry.kind} data-phase={entry.phase} key={`${entry.kind}:${entry.id}`} onClick={()=>{if(entry.kind==='conversation')onOpenResult(entry.id);else onContext({projectId:entry.projectId,missionId:entry.id,attemptId:entry.mission.activeAttemptId,surface:'deck',returnTo:{view:'ship',projectId:entry.projectId,missionId:entry.id}});}}><b>{entry.title}</b><span>{entry.kind==='conversation'?'Conversation':entry.phase==='review'?'Ready for review':entry.phase==='accepted'?'Accepted':entry.phase}</span></button>)}</div>
  </section>
 </aside>;
}
