import {MissionImages} from '../components/MissionImages';
import {projectEvidence} from '../projectEvidence';
import {DeploymentObservation} from '../components/DeploymentObservation';
import {useEffect,useRef,useState} from 'react';
import {clearSubmittedDraft,useDraft} from '../useDraft';
import type {Mission,Snapshot,Task} from '../shared';
import {CREW} from '../data';
import './mission-board.css';
type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
const labels:Record<string,string>={DRAFT:'Draft',RUNNING:'Running',NEEDS_USER:'Needs your attention',WAITING_FOR_REVIEW:'Ready for review',FAILED:'Failed',CANCELLED:'Stopped',BLOCKED:'Blocked',COMPLETE:'Complete'};
export function MissionBoard({snapshot,invoke,onOpen,focusMission}:{snapshot:Snapshot;invoke:Invoke;onOpen:(taskId:string)=>void;focusMission?:{id:string;sequence:number}}){
 const [projectId,setProjectId]=useDraft('mission:last-project',snapshot.projects[0]?.id??'');
 const project=snapshot.projects.find(p=>p.id===projectId)??snapshot.projects[0];
 const draftKey=`mission:brief:${project?.id??'unselected'}`;
 const [title,setTitle]=useDraft(`${draftKey}:title`),[objective,setObjective]=useDraft(`${draftKey}:objective`),[criteria,setCriteria]=useDraft(`${draftKey}:criteria`);
 const [boundaryDraft,setBoundary]=useDraft(`${draftKey}:boundary`,'review');const boundary=boundaryDraft==='merge'?'merge':'review';
 const [selectedId,setSelectedId]=useState<string>(),[crewId,setCrewId]=useState('luffy'),[roleId,setRoleId]=useState('coordinator'),[prNumber,setPrNumber]=useState('');
 const availableRoles=snapshot.missionRoles?.filter(role=>role.id!=='reporter');
 useEffect(()=>{if(focusMission)setSelectedId(focusMission.id);},[focusMission]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const busyRef=useRef(false);
 const missions=snapshot.missions??[],selected=missions.find(m=>m.id===selectedId)??missions[0];
 const deploymentEvidence=selected?projectEvidence([selected],selected.projectId)[0]:undefined;
 const publicationKey=selected?JSON.stringify(['publish',selected.id,selected.activeAttemptId,selected.prPublication?.id,selected.prPublication?.commit,selected.prPublication?.fingerprint,selected.prPublication?.repository,selected.prPublication?.branch,selected.prPublication?.base]):undefined;

 const [checkCapabilities,setCheckCapabilities]=useState<{missionId:string;revision:number;scripts:string[];error?:string}>();
 useEffect(()=>{
  let current=true;setCheckCapabilities(undefined);
  if(selected?.status==='WAITING_FOR_REVIEW'){
   const {id:missionId,revision}=selected;
   void invoke<string[]>('mission:checks',{missionId}).then(scripts=>{if(current)setCheckCapabilities({missionId,revision,scripts});}).catch(e=>{if(current)setCheckCapabilities({missionId,revision,scripts:[],error:e instanceof Error?e.message:String(e)});});
  }
  return()=>{current=false;};
 },[selected?.id,selected?.revision,selected?.status,invoke]);
 const checksReady=checkCapabilities?.missionId===selected?.id&&checkCapabilities?.revision===selected?.revision;


 const run=async(action:()=>Promise<void>)=>{if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{busyRef.current=false;setBusy(false);}};
 const create=()=>run(async()=>{const mission=await invoke<Mission>('mission:create',{projectId:project?.id,title,objective,acceptanceCriteria:criteria.split('\n').map(c=>c.trim()).filter(Boolean),completionBoundary:boundary});setSelectedId(mission.id);clearSubmittedDraft(`${draftKey}:title`,title);clearSubmittedDraft(`${draftKey}:objective`,objective);clearSubmittedDraft(`${draftKey}:criteria`,criteria);clearSubmittedDraft(`${draftKey}:boundary`,boundaryDraft);});
 const launch=()=>run(async()=>{if(selected)await invoke<Task>('mission:start',{missionId:selected.id,revision:selected.revision,...(availableRoles?.length?{roleId}:{crewId})});});
 const collect=(args:object)=>run(async()=>{if(selected)await invoke('mission:evidence',{missionId:selected.id,revision:selected.revision,...args});});
 return <section className="page mission-board" aria-label="Mission board">
  <header className="page-intro"><div><span className="eyebrow">Captain’s logbook</span><h2>Mission board</h2><p>Give the crew a clear objective. Review the evidence before calling the voyage complete.</p></div></header>
  <div className="mission-board-layout">
   <section className="mission-brief panel"><h3>Set a course</h3>
    <label>Project<select aria-label="Mission project" disabled={busy} value={project?.id??''} onChange={e=>setProjectId(e.target.value)}>{snapshot.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Mission title<input aria-label="Mission title" disabled={busy} maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Build the inventory screen"/></label>
    <label>Objective<textarea aria-label="Mission objective" disabled={busy} maxLength={50000} value={objective} onChange={e=>setObjective(e.target.value)} placeholder="Describe the change and who it helps."/></label>
    <label>Acceptance criteria<textarea aria-label="Acceptance criteria" disabled={busy} value={criteria} onChange={e=>setCriteria(e.target.value)} placeholder={'One observable result per line\nItems survive a reload'}/></label>
    <label>Mission finishes after<select aria-label="Completion boundary" disabled={busy} value={boundary} onChange={e=>setBoundary(e.target.value)}><option value="review">Captain reviews the result</option><option value="merge">Pull request merged and checked</option></select></label><button className="primary-button mission-create" disabled={busy||!project||!title.trim()||!objective.trim()||!criteria.trim()} onClick={()=>void create()}>Save mission brief</button>
    {!project?<p>Import a project before creating a mission.</p>:null}
   </section>
   <section className="mission-log panel"><h3>Voyages</h3>
    {missions.length?<div className="mission-entries">{missions.map(m=><button key={m.id} aria-pressed={selected?.id===m.id} onClick={()=>setSelectedId(m.id)}><strong>{m.title}</strong><span>{labels[m.status]??m.status}</span></button>)}</div>:<p>No missions yet. Start with a brief and a result you can verify.</p>}
    {selected?<article className="mission-detail" data-revision={selected.revision} key={selected.id}>
     <span className="eyebrow">{snapshot.projects.find(p=>p.id===selected.projectId)?.name??'Unavailable project'}</span><h3>{selected.title}</h3><p>{selected.objective}</p>
     <p className="mission-current" role="status">{labels[selected.status]??selected.status}{selected.connection==='reconciling'?' · Check the crew task to reconcile its connection.':''}</p>
     {selected.checkExecution?<CheckRecovery key={selected.checkExecution.id} mission={selected} busy={busy} invoke={invoke} run={run}/>:null}
     {selected.branch?<p>Mission branch: <b>{selected.branch.name}</b> · {selected.branch.state}</p>:null}{selected.status==='DRAFT'?<button className="mission-prepare-branch small-button" disabled={busy} onClick={()=>void run(async()=>{await invoke('mission:prepareBranch',{missionId:selected.id,revision:selected.revision});})}>{selected.branch?'Recheck prepared branch':'Prepare a mission branch'}</button>:null}
     {['DRAFT','FAILED','CANCELLED','WAITING_FOR_REVIEW'].includes(selected.status)?<div className="mission-launch-controls"><label>Lead role<select aria-label="Mission lead" disabled={busy} value={availableRoles?.length?roleId:crewId} onChange={e=>availableRoles?.length?setRoleId(e.target.value):setCrewId(e.target.value)}>{availableRoles?.length?availableRoles.map(r=><option key={r.id} value={r.id}>{r.label} · {CREW.find(c=>c.id===r.crewId)?.name??r.crewId}</option>):CREW.map(c=><option key={c.id} value={c.id}>{c.name} · {c.role}</option>)}</select></label><button className="small-button mission-launch" disabled={busy||Boolean(selected.checkExecution)} onClick={()=>void launch()}>{selected.attempts.length?'Start a new attempt':'Send the crew'}</button></div>:null}
     {selected.attempts.map((attempt,index)=><section className="mission-attempt" key={attempt.id}><b>Attempt {index+1} · {attempt.status}</b>{attempt.routing?<p>{attempt.routing.roleId} · {attempt.routing.provider}<small>{attempt.routing.reason}</small></p>:null}{attempt.workflow?<ol aria-label="Coordinated stages">{attempt.workflow.stages.map(stage=><li key={stage.id}>{stage.id} · {stage.status}{stage.taskId?<button className="text-button" onClick={()=>onOpen(stage.taskId!)}>Inspect result</button>:null}</li>)}</ol>:null}{attempt.error?<p role="alert">{attempt.error}</p>:null}<div>{attempt.taskIds.map(id=>{const task=snapshot.tasks.find(t=>t.id===id);return task?<button className="text-button" key={id} onClick={()=>onOpen(id)}>{task.title} · {task.status} →</button>:null;})}</div></section>)}
     {selected.status==='WAITING_FOR_REVIEW'?<MissionPublish key={publicationKey} mission={selected} busy={busy} invoke={invoke} run={run}/>:null}
     {selected.status==='WAITING_FOR_REVIEW'?<MissionMergeControl key={`merge:${selected.id}:${selected.revision}`} mission={selected} busy={busy} invoke={invoke} run={run}/>:null}
     <MissionImages key={`images:${selected.id}:${selected.revision}`} mission={selected} busy={busy} invoke={invoke} run={run} collect={collect}/>
     <MissionDeliverables key={`deliverables:${selected.id}:${selected.revision}`} mission={selected} busy={busy} invoke={invoke} run={run} collect={collect}/>
     <section className="mission-deployments"><h4>Deployment observations</h4><p>Read up to five GitHub deployment records for the project's current commit. This never starts a deployment.</p>{['WAITING_FOR_REVIEW','COMPLETE'].includes(selected.status)?<button className="mission-inspect-deployments" disabled={busy} onClick={()=>void collect({deployment:true})}>Inspect GitHub deployments</button>:null}<DeploymentObservation artifact={deploymentEvidence?.deployment} olderSource={deploymentEvidence?.deploymentOlderSource}/></section>
     <section className="mission-evidence"><h4>Source, checks & pull request</h4>
      {selected.status==='WAITING_FOR_REVIEW'?<><p>Run the project’s existing npm scripts in its registered folder. Results belong to this attempt and this version of the source.</p><p className="mission-check-capabilities" role="status">{!checksReady?"Checking available project scripts...":checkCapabilities?.error?`Project checks unavailable: ${checkCapabilities.error}`:`Unavailable scripts: ${(["test","build","typecheck","lint"]).filter(script=>!checkCapabilities?.scripts.includes(script)).join(", ")||"none"}. Disabled checks do not count as failed evidence.`}</p><div className="mission-evidence-actions"><button disabled={busy} onClick={()=>void collect({})}>Inspect Git</button>{(['test','build','typecheck','lint'] as const).map(script=><button className={`mission-run-${script}`} key={script} disabled={busy||!checksReady||!checkCapabilities?.scripts.includes(script)} title={checksReady&&!checkCapabilities?.scripts.includes(script)?`The ${script} script is unavailable in this project.`:undefined} onClick={()=>void collect({script})}>Run npm {script}</button>)}</div><label>Pull-request number<input aria-label="Pull-request number" type="number" min="1" value={prNumber} disabled={busy} onChange={e=>setPrNumber(e.target.value)}/></label><button className="mission-inspect-pr" disabled={busy||!Number.isSafeInteger(Number(prNumber))||Number(prNumber)<1} onClick={()=>void collect({prNumber:Number(prNumber)})}>Inspect pull request</button></>:null}
      {busy?<p role="status">Working…</p>:null}
      {selected.artifacts.some(a=>a.kind!=='deliverable'&&a.kind!=='deployment'&&a.kind!=='image')?<ul>{selected.artifacts.filter(a=>a.kind!=='deliverable'&&a.kind!=='deployment'&&a.kind!=='image').map(artifact=><li key={artifact.id}><strong>{artifact.kind==='check'?`${artifact.command} · ${artifact.status}`:artifact.kind==='pull-request'?`PR #${artifact.number} · ${artifact.state}`:`Git · ${artifact.branch}`}</strong><small>{artifact.commit?.slice(0,12)} · {new Date(artifact.recordedAt).toLocaleString()}{artifact.attemptId!==selected.activeAttemptId?' · Earlier attempt':''}{artifact.kind==='check'?` · exit ${artifact.exitCode??'unavailable'}`:''}</small>{artifact.kind==='pull-request'?<span>Checks: {artifact.checkStatus} · Review: {artifact.reviewDecision}<button className="text-button" onClick={()=>void run(async()=>{await invoke('dialog:openExternal',{url:artifact.url});})}>Open pull request →</button></span>:null}{artifact.kind==='git'?<span>{artifact.dirty?`${artifact.paths?.length??0} changed files`:'Clean working tree'}</span>:null}</li>)}</ul>:<p>No check evidence collected yet.</p>}
     </section>
     {selected.status==='WAITING_FOR_REVIEW'?<MissionAcceptance key={`acceptance:${selected.id}:${selected.revision}`} mission={selected} busy={busy||Boolean(selected.checkExecution)} onAccept={checks=>run(async()=>{await invoke('mission:accept',{missionId:selected.id,revision:selected.revision,criteria:checks});})}/>:<ul>{selected.acceptanceCriteria.map((c,i)=><li key={i}>{c}</li>)}</ul>}
     <details><summary>Mission history</summary><ol>{selected.events.slice(-15).reverse().map(event=><li key={event.id}>{event.type.replaceAll('_',' ').toLowerCase()} · {new Date(event.time).toLocaleString()}</li>)}</ol></details>
    </article>:null}
   </section>
  </div>
  {error?<p className="mission-error" role="alert">{error}</p>:null}
 </section>;
}
function MissionAcceptance({mission,busy,onAccept}:{mission:Mission;busy:boolean;onAccept:(checks:boolean[])=>Promise<void>}){
 const [checks,setChecks]=useState(mission.acceptanceCriteria.map(()=>false));
 return <section className="mission-criteria"><h4>Captain’s acceptance</h4><p>Open the crew’s result and verify each item. Checking these records your review; it does not run tests.</p>{mission.acceptanceCriteria.map((criterion,index)=><label key={index}><input type="checkbox" checked={checks[index]} disabled={busy} onChange={e=>setChecks(previous=>previous.map((value,i)=>i===index?e.target.checked:value))}/><span>{criterion}</span></label>)}<button className="primary-button mission-accept" disabled={busy||!checks.every(Boolean)} onClick={()=>void onAccept(checks)}>Accept completed mission</button>{mission.completionBoundary==='merge'?<p>Acceptance rechecks the inspected pull request. It must match this source, be merged, and have passing checks. Use the separate merge review above to open GitHub for approval. Acceptance never submits a merge.</p>:null}</section>;
}

function CheckRecovery({mission,busy,invoke,run}:{mission:Mission;busy:boolean;invoke:Invoke;run:(action:()=>Promise<void>)=>Promise<void>}){
 const [confirmed,setConfirmed]=useState(false);const check=mission.checkExecution!;
 return <section className="mission-check-recovery" aria-label="Unresolved project check"><h4>Project check has not been resolved</h4><p>The {check.script} check started {new Date(check.startedAt).toLocaleString()}. Sunny is keeping this project reserved. If the check is still running, wait. After a restart or uncertain cleanup, inspect the check and its child processes before releasing the reservation.</p><label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>I verified that this check and all its child processes have stopped.</label><button className="small-button" disabled={busy||!confirmed} onClick={()=>void run(async()=>{await invoke('mission:reconcileCheck',{missionId:mission.id,revision:mission.revision,executionId:check.id,confirmedStopped:true});})}>Record stopped check</button><p>This records your confirmation, not an automated process check. The check will be marked failed; run it again before accepting the mission.</p></section>;
}

function MissionPublish({mission,busy,invoke,run}:{mission:Mission;busy:boolean;invoke:Invoke;run:(action:()=>Promise<void>)=>Promise<void>}){
 const preview=mission.prPublication;
 const [base,setBase]=useState(preview?.base??(mission.branch?.baseBranch==='(detached)'?'':mission.branch?.baseBranch??'')),[confirmed,setConfirmed]=useState(false),[number,setNumber]=useState('');
 const [prTitle,setPrTitle]=useState(preview?.title??mission.title),[prBody,setPrBody]=useState(preview?.body??'');
 const dirty=preview?.state==='prepared'&&(prTitle!==preview.title||prBody!==preview.body);
 const targetDirty=preview?.state==='prepared'&&base!==preview.base;
 const textValid=Boolean(prTitle.trim()&&prTitle.length<=200&&!/[\r\n\0]/.test(prTitle)&&prBody.trim()&&prBody.length<=60000&&!prBody.includes('\0'));
 useEffect(()=>{setConfirmed(false);},[mission.revision]);



 const act=(action:string,args:object)=>run(async()=>{await invoke(action,{missionId:mission.id,revision:mission.revision,...args});});
 return <section className="mission-publication"><h4>Draft pull request</h4>{!preview||preview.state==='prepared'?<><label>Target branch<input aria-label="PR target branch" value={base} disabled={busy} onChange={e=>{setBase(e.target.value);setConfirmed(false);}}/></label><button className="mission-prepare-pr" disabled={busy||!base.trim()||dirty} onClick={()=>void act('mission:preparePr',{base})}>Prepare PR preview</button></>:null}
 {preview?<><p>{preview.repository} · {preview.branch} → {preview.base}</p><p>Commit {preview.commit.slice(0,12)} · {preview.state}</p>{preview.state==='prepared'?<>{!textValid?<p role="status">Use a nonempty title of up to 200 characters on one line and a nonempty description of up to 60000 characters. Edit this preview before publication.</p>:null}<label>PR title<input aria-label="PR title" maxLength={200} disabled={busy} value={prTitle} onChange={e=>{setPrTitle(e.target.value);setConfirmed(false);}}/></label><label>PR description<textarea className="mission-pr-body" aria-label="PR description" maxLength={60000} disabled={busy} value={prBody} onChange={e=>{setPrBody(e.target.value);setConfirmed(false);}}/></label>{dirty?<><p role="status">Save your edits as a new preview, then review and confirm the exact text before publication.</p><button className="mission-save-pr-preview" disabled={busy||!textValid} onClick={()=>void act('mission:editPr',{previewId:preview.id,title:prTitle,body:prBody})}>Save revised PR preview</button><button disabled={busy} onClick={()=>{setPrTitle(preview.title);setPrBody(preview.body);setConfirmed(false);}}>Discard unsaved PR edits</button></>:null}</>:<><h5>{preview.title}</h5><pre className="mission-pr-body">{preview.body}</pre></>}{preview.state==='prepared'?<>{targetDirty?<p role="status">Prepare a new preview for the changed target branch before confirming publication. The saved preview targets {preview.base}.</p>:null}<label><input type="checkbox" checked={confirmed} disabled={busy||dirty||targetDirty||!textValid} onChange={e=>setConfirmed(e.target.checked)}/>I approve pushing this commit and publishing this draft PR to the repository shown above.</label><button className="mission-publish-pr" disabled={busy||dirty||targetDirty||!textValid||!confirmed} onClick={()=>void act('mission:publishPr',{previewId:preview.id,confirmed:true})}>Publish approved draft PR</button></>:<><p>{preview.url??'Publication may have reached GitHub. Inspect the repository before continuing.'}</p><label>Published PR number<input aria-label="Published PR number" type="number" min="1" value={number} onChange={e=>setNumber(e.target.value)}/></label><button disabled={busy||!Number.isSafeInteger(Number(number))||Number(number)<1} onClick={()=>void act('mission:reconcilePr',{prNumber:Number(number)})}>Verify published PR</button></>}</>:<p>Requires a clean, committed mission branch. Previewing does not publish anything.</p>}</section>;
}

function MissionMergeControl({mission,busy,invoke,run}:{mission:Mission;busy:boolean;invoke:Invoke;run:(action:()=>Promise<void>)=>Promise<void>}){
 const request=mission.mergeRequest;
 const act=(action:string,args:object={})=>run(async()=>{await invoke(action,{missionId:mission.id,revision:mission.revision,...args});});
 return <section className="mission-merge-control"><h4>Captain’s merge review</h4>{!request||['prepared','open','closed'].includes(request.state)?<button className="mission-prepare-merge" disabled={busy} onClick={()=>void act('mission:prepareMerge')}>Prepare merge review</button>:null}{request?<><p>PR #{request.number} · {request.repository}</p><p>Commit {request.commit.slice(0,12)} into {request.baseBranch} · {request.state}</p>{request.state!=='merged'?<><p>Review the target branch and approve the merge in GitHub. Then return here to verify the result.</p><button className="mission-open-merge" disabled={busy} onClick={()=>void run(async()=>{await invoke('dialog:openExternal',{url:request.url});})}>Open GitHub for merge approval</button><button className="mission-recheck-merge" disabled={busy} onClick={()=>void act('mission:recheckMerge')}>Recheck merge result</button></>:<p>Merge verified. Review the mission criteria below to complete the voyage.</p>}</>:<p>Inspect the PR first. It must be ready for review with passing checks.</p>}</section>;
}

function MissionDeliverables({mission,busy,invoke,run,collect}:{mission:Mission;busy:boolean;invoke:Invoke;run:(action:()=>Promise<void>)=>Promise<void>;collect:(args:object)=>Promise<void>}){
 const [filePath,setFilePath]=useState(''),[preview,setPreview]=useState<{filePath:string;sha256:string;text:string}>();
 const artifacts=mission.artifacts.filter(a=>a.kind==='deliverable');
 return <section className="mission-deliverables"><h4>Written deliverables</h4><p>Attach a project-local .md or .txt file (up to 256 KB). Preview shows plain text; attachment verifies the file, not its quality. Acceptance rechecks the latest attached version.</p>{mission.status==='WAITING_FOR_REVIEW'?<><label>Project-relative file<input aria-label="Deliverable path" value={filePath} disabled={busy} onChange={e=>setFilePath(e.target.value)} placeholder="deliverables/welcome.md"/></label><button className="mission-attach-deliverable" disabled={busy||!filePath.trim()} onClick={()=>void collect({filePath})}>Attach written deliverable</button></>:null}
 {artifacts.length?<ul>{artifacts.map(a=><li key={a.id}><strong>{a.filePath}</strong><small>{a.bytes} bytes · SHA256 {a.sha256?.slice(0,12)} · {new Date(a.recordedAt).toLocaleString()}{a.attemptId!==mission.activeAttemptId?' · Earlier attempt':''}</small><button className="mission-preview-deliverable" disabled={busy} onClick={()=>void run(async()=>{setPreview(undefined);setPreview(await invoke('mission:previewDeliverable',{missionId:mission.id,revision:mission.revision,artifactId:a.id}));})}>Preview recorded file</button></li>)}</ul>:<p>No written deliverables attached.</p>}
 {preview?<div className="mission-deliverable-preview"><h5>{preview.filePath}</h5><p>Verified file SHA256: {preview.sha256}</p><pre>{preview.text}</pre><button onClick={()=>setPreview(undefined)}>Close preview</button></div>:null}</section>;
}
