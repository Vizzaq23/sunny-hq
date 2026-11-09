import {useEffect,useState} from 'react';
import type {CriterionEvidenceReport,Mission} from '../shared';
import './criterion-evidence.css';
type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
export function CriterionEvidence({mission,invoke,onOpen}:{mission:Mission;invoke:Invoke;onOpen:(taskId:string)=>void}){
 const [result,setResult]=useState<{key:string;report?:CriterionEvidenceReport;error?:string}>(),[refresh,setRefresh]=useState(0);
 const attemptId=mission.activeAttemptId,key=JSON.stringify([mission.projectId,mission.id,attemptId,mission.revision,refresh]);
 useEffect(()=>{if(!attemptId)return;let active=true;void invoke<CriterionEvidenceReport>('mission:reviewEvidence',{projectId:mission.projectId,missionId:mission.id,attemptId,revision:mission.revision}).then(report=>{if(active)setResult({key,report});},error=>{if(active)setResult({key,error:String(error)});});return()=>{active=false;};},[mission.projectId,mission.id,attemptId,mission.revision,refresh,invoke,key]);
 const current=result?.key===key?result:undefined,report=current?.report;
 return <section className="criterion-evidence" aria-label="Zoro’s review table"><header><h3>Zoro’s review table</h3><button onClick={()=>setRefresh(value=>value+1)}>Refresh evidence</button></header><p>Check each criterion against its recorded evidence. Automated checks and reviewer claims do not make the captain’s decision.</p>
  {!attemptId?<p>No attempt recorded.</p>:!current?<p role="status">Loading criterion evidence…</p>:current.error?<p role="alert">Evidence unavailable: {current.error}</p>:report?<>
   <p className="muted">Attempt {report.attemptId} · result {report.resultId??'Not selected'} · source {report.source?.commit??'Not recorded'}</p>
   {!report.evidenceBound?<p role="status">No verification bound to this selected result. Generic passing checks do not establish criterion coverage.</p>:null}
   {report.limited?<p>Criterion list shortened.</p>:null}
   <div className="criterion-rows">{report.rows.map(row=><article key={row.index} className="criterion-row"><h4>{row.index+1}. {row.criterion}</h4><div className="criterion-columns">
    <section><h5>Automated evidence</h5>{row.checks.length?<ul>{row.checks.map(check=><li key={check.id}><strong>{check.kind} · {check.status}</strong><p>{check.sourceMatches?'Matches recorded source':'Stale source — inspect before review'}</p><p>Receipt {check.id} · {check.commit??'Source not recorded'}</p><p>{check.evidenceRef??'Evidence reference not recorded'}</p>{check.justification?<p>{check.justification}</p>:null}</li>)}</ul>:<p>Not recorded</p>}</section>
    <section><h5>Reviewer observations</h5>{row.reviews.length?<ul>{row.reviews.map(review=><li key={review.id}><strong>Generated review · {review.decision}</strong><p>{review.sourceMatches?'Matches recorded source':'Stale or unbound source'}</p>{review.findings.length?<ul>{review.findings.map(finding=><li key={finding.id}>{finding.severity} · {finding.status}<p><code>{finding.path}</code> · {finding.text}</p></li>)}</ul>:<p>No findings recorded for this criterion.</p>}{review.limited?<p>Findings shortened.</p>:null}<button onClick={()=>onOpen(review.taskId)}>Open reviewer work</button></li>)}</ul>:<p>Not recorded</p>}</section>
    <section><h5>Captain’s recorded decision</h5>{row.captain?<><p>{row.captain.confirmed?'Confirmed by captain':row.captain.decision}</p><p>{row.captain.note}</p><small>Decision {row.captain.id} · revision {row.captain.reviewedRevision}</small></>:<p>Not decided. Use the acceptance controls below after reviewing the result.</p>}</section>
   </div>{row.limited?<p>Some evidence exceeds the display limit.</p>:null}</article>)}</div>
  </>:null}
 </section>;
}
