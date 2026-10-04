import {useEffect,useMemo,useState} from 'react';
import type {Snapshot,WorkContext} from '../shared';
import {workEntries} from '../taskFlow';
import {boundResultStatus,resolveWorkContext,storageOutcomeUncertain} from '../workContext';
import {projectMission} from '../missionProjection';
import {projectRun} from '../runProjection';
import {requestMissionResultStatus} from '../useMissionResultStatus';
import './captain-log.css';
type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
const labels:Record<string,string>={DRAFT:'Brief saved — ready to send',RUNNING:'Crew working',WAITING_FOR_REVIEW:'Ready for captain review',NEEDS_USER:'Needs your input',FAILED:'Attempt failed',CANCELLED:'Stopped',BLOCKED:'Blocked',COMPLETE:'Accepted'};
export function CaptainLog({snapshot,context,onContext,onOpenResult,onRequestChanges,invoke}:{snapshot:Snapshot;context:WorkContext|null;onContext:(context:WorkContext)=>void;onOpenResult:(taskId:string)=>void;onRequestChanges:(missionId:string)=>void;invoke:Invoke}){
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[preview,setPreview]=useState<{filePath:string;text:string;sha256:string}>(),[error,setError]=useState('');
 const mission=(snapshot.missions??[]).find(m=>m.id===context?.missionId),attempt=mission?.attempts.find(a=>a.id===context?.attemptId);
 useEffect(()=>{if(mission)requestMissionResultStatus(mission.id);},[mission?.id]);
 const task=snapshot.tasks.find(t=>t.id===context?.taskId);
 const longGoal=Boolean(mission&&(mission.objective.length>300||mission.objective.split(/\r?\n/).length>3));
 const goalPreview=mission?.objective.split(/\r?\n/).slice(0,3).join('\n').slice(0,300);
 const stage=attempt?.workflow?.stages.find(s=>!['finished','completed','complete'].includes(s.status));
 const owner=snapshot.tasks.find(t=>t.id===stage?.taskId);
 const entries=useMemo(()=>workEntries(snapshot.missions??[],snapshot.tasks,snapshot),[snapshot.missions,snapshot.tasks,snapshot.resultStatuses]);
 const unavailable=resolveWorkContext(context,snapshot).unavailable;
 const result=mission?.selectedResult,ref=result?.ref;
 const verification=mission?boundResultStatus(snapshot,mission):undefined;
 const verificationEntry=mission?snapshot.resultStatuses?.[mission.id]:undefined;
 const projection=mission&&context?projectMission(snapshot,context):undefined;
 const verificationText=storageOutcomeUncertain(snapshot)?'Storage outcome is uncertain. Keep this window open to copy or export drafts, then restart Sunny to recover saved work.':verification?verification.available?'Selected result verified in main.':verification.unavailable??'Selected result unavailable.':verificationEntry?.state==='error'?verificationEntry.error??'Selected result could not be verified.':'Verifying selected result...';
 useEffect(()=>{setPreview(undefined);setError('');},[result?.id,mission?.revision]);
 const inspectFile=async()=>{if(!mission||ref?.kind!=='deliverable')return;try{setPreview(await invoke('mission:previewDeliverable',{missionId:mission.id,revision:mission.revision,artifactId:ref.artifactId}));}catch(e){setError(e instanceof Error?e.message:String(e));}};
 const openMission=()=>{if(mission&&context)onContext({...context,surface:'deck',taskId:undefined});};
 return <aside className="captain-log" aria-label="Captain log">
  <header><span className="eyebrow">Aboard the Sunny</span><h2>Captain's log</h2></header>
  {unavailable?<p className="captain-unavailable" role="alert">{unavailable}</p>:null}
  {mission?<section className="captain-current" data-mission-id={mission.id} data-attempt-id={attempt?.id}>
   <small>{snapshot.projects.find(p=>p.id===mission.projectId)?.name??'Project unavailable'}</small><h3>{mission.title}</h3>
   <p className="captain-log-status" role="status" aria-live="polite">{mission.runId?projectRun(snapshot,mission.runId).label:mission.status==='COMPLETE'?(projection?.state==='accepted'?'Accepted by captain':verificationText):labels[mission.status]??mission.status}{mission.connection==='reconciling'?' — Connection needs reconciliation':''}</p>
   <p className="captain-stage">{stage?`${stage.id}: ${owner?.crewId??'Awaiting assignment'} · ${stage.status}`:attempt?.workflow?.complete?'All linked stages reported results':attempt?'Inspect linked crew tasks':'No attempt started'}</p>
   <ul className="captain-criteria">{mission.acceptanceCriteria.map((criterion,i)=><li key={i}>{criterion}</li>)}</ul>
   {attempt?.workflow?<ol aria-label="Linked mission stages">{attempt.workflow.stages.map(s=><li key={s.id}><span>{s.id} · {s.status}</span>{s.taskId?<button onClick={()=>onOpenResult(s.taskId!)}>Open {snapshot.tasks.find(t=>t.id===s.taskId)?.crewId??'crew'} result</button>:null}</li>)}</ol>:null}
   {longGoal?<><p className="captain-goal-preview">{goalPreview+'…'}</p><details className="captain-goal-details" key={mission.id}><summary>Read full goal</summary><p className="captain-goal-full">{mission.objective}</p></details></>:<p className="captain-goal">{mission.objective}</p>}
   {result?<section className="captain-selected-result"><h4>Selected result</h4><p>{ref?.kind==='reply'?'Crew reply':ref?.kind==='playable'?'Playable build':'Recorded file'} · {result.attemptId===mission.activeAttemptId?'Current attempt':'Earlier attempt'}</p><code>{ref?.sha256}</code>{!verification?.available?<button type="button" onClick={verificationEntry?.retry} disabled={!verificationEntry?.retry||verificationEntry.state==='loading'}>Retry result verification</button>:null}{ref?.kind==='reply'?<>{verification?.available?<pre>{verification.preview}</pre>:<p role="status">{verificationText}</p>}<button className="captain-open-result" onClick={()=>onOpenResult(ref.taskId)}>Open selected reply</button></>:ref?.kind==='playable'?<>{verification?.available&&verification.playable?<><p>{verification.playable.runtime} · {verification.playable.toolchain} · {verification.playable.artifactCount} verified files</p><p>Source {verification.playable.source?.headCommit} · clean at inspection</p><p>{verification.playable.candidateEligible?'Candidate available for validation':'Candidate needs source verification and independent review'}</p><p>{verification.playable.ready?'All required evidence is ready for captain review':'Final evidence pending: '+verification.playable.readinessBlockers.join('; ')}</p>{verification.playable.limitations.map((value,i)=><p key={i}>{value}</p>)}</>:<p role="status">{verificationText}</p>}</>:<><button className="captain-open-result" onClick={()=>void inspectFile()}>Preview selected file</button>{preview&&verification?.available&&preview.sha256===ref?.sha256?<><p>{preview.filePath} · {preview.sha256}</p><pre>{preview.text}</pre></>:null}</>}</section>:mission.status==='WAITING_FOR_REVIEW'?<p>Select a crew reply or recorded file before acceptance.</p>:null}
   {mission.acceptance?<p className="captain-acceptance">{mission.acceptance.legacy?'Historical acceptance — result binding unavailable':projection?.state==='accepted'?'Captain accepted the bound result':verificationText}{mission.acceptedAt?` · ${new Date(mission.acceptedAt).toLocaleString()}`:''}</p>:null}
   <button className="captain-review-mission" disabled={Boolean(unavailable)} onClick={openMission}>{mission.status==='WAITING_FOR_REVIEW'?'Review and accept result':mission.status==='DRAFT'?'Review brief and send crew':'Open mission controls'}</button>
   {mission.status==='WAITING_FOR_REVIEW'?<button className="captain-request-changes" disabled={Boolean(unavailable)} onClick={()=>onRequestChanges(mission.id)}>Request changes</button>:null}
   <details><summary>Recent mission activity</summary><ul>{mission.events.slice(-8).reverse().map(e=><li key={e.id}>{e.type.replaceAll('_',' ')} · {new Date(e.time).toLocaleTimeString()}</li>)}</ul></details>
  </section>:task?<section className="captain-current"><small>Conversation · {snapshot.projects.find(p=>p.id===task.projectId)?.name??'Project unavailable'}</small><h3>{task.title}</h3><p className="captain-log-status" role="status">{task.crewId} · {task.status}</p><p>A conversation turn is reviewed in its thread.</p><button className="captain-open-result" disabled={Boolean(unavailable)} onClick={()=>onOpenResult(task.id)}>Open conversation</button></section>:<p className="captain-empty">Save a mission brief to set your course, or open a conversation below.</p>}
  {error?<p role="alert">{error}</p>:null}
  <section className="captain-queue"><label>Search work<input aria-label="Search captain log" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Title or project"/></label><label>Show<select aria-label="Filter captain log" value={filter} onChange={e=>setFilter(e.target.value)}>{['all','attention','active','review','accepted','conversation'].map(value=><option key={value} value={value}>{value==='all'?'All work':value.charAt(0).toUpperCase()+value.slice(1)}</option>)}</select></label>
   <div className="captain-work-list">{entries.filter(entry=>(filter==='all'||filter===entry.phase)&&(!query||`${entry.title} ${snapshot.projects.find(p=>p.id===entry.projectId)?.name??''}`.toLowerCase().includes(query.toLowerCase()))).map(entry=><button className="work-entry" data-id={entry.id} data-kind={entry.kind} data-phase={entry.phase} key={`${entry.kind}:${entry.id}`} onClick={()=>{if(entry.kind==='conversation')onOpenResult(entry.id);else onContext({projectId:entry.projectId,runId:entry.mission.runId,missionId:entry.id,attemptId:entry.mission.activeAttemptId,surface:'deck',returnTo:{view:'ship',projectId:entry.projectId,missionId:entry.id}});}}><b>{entry.title}</b><span>{entry.kind==='conversation'?'Conversation':entry.phase==='review'?'Ready for review':entry.phase==='accepted'?'Accepted':entry.phase}</span></button>)}</div>
  </section>
 </aside>;
}
