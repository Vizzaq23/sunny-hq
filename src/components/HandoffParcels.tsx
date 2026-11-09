import {useEffect,useState} from 'react';
import type {HandoffExcerpt,HandoffReport} from '../shared';
import {CREW} from '../data';
import './handoff-parcels.css';

type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
function Payload({value}:{value:HandoffExcerpt|null}){
 return value?<><p className="handoff-payload">{value.text}</p>{value.limited?<p className="muted">Preview shortened. Open the recorded task for retained context.</p>:null}</>:<p className="muted">Not recorded</p>;
}
function crewName(id:string|undefined){return CREW.find(crew=>crew.id===id)?.name??id??'Not recorded';}
export function HandoffParcels({projectId,missionId,attemptId,revision,invoke,onOpen}:{projectId:string;missionId:string;attemptId:string;revision:number;invoke:Invoke;onOpen:(taskId:string)=>void}){
 const [result,setResult]=useState<{key:string;report?:HandoffReport;error?:string}>(),[refresh,setRefresh]=useState(0);
 const key=JSON.stringify([projectId,missionId,attemptId,revision,refresh]);
 useEffect(()=>{let active=true;void invoke<HandoffReport>('mission:handoffs',{projectId,missionId,attemptId,revision}).then(report=>{if(active)setResult({key,report});},error=>{if(active)setResult({key,error:error instanceof Error?error.message:String(error)});});return()=>{active=false;};},[projectId,missionId,attemptId,revision,refresh,invoke,key]);
 const current=result?.key===key?result:undefined,report=current?.report;
 return <section className="handoff-parcels" aria-label="Recorded crew handoffs"><header><div><h2>Crew handoffs</h2><p>Inspect what was recorded between crew assignments.</p></div><button onClick={()=>setRefresh(value=>value+1)}>Refresh handoffs</button></header>
  {!current?<p role="status">Loading recorded handoffs…</p>:current.error?<p role="alert">Handoffs unavailable: {current.error}</p>:report?<>
   <p className="handoff-identity">{report.historical?'Historical attempt':'Current attempt'} · {report.attemptId} · mission revision {report.revision}{report.runRevision!==null?` · run revision ${report.runRevision}`:''}</p>
   <p className="muted">{report.coverage}</p>{report.limited?<p role="status">Some retained records exceed this view’s display limit.</p>:null}
   {report.requestedChanges?<section><h3>Changes requested for this attempt</h3><Payload value={report.requestedChanges}/></section>:null}
   {report.parcels.length?<ol className="handoff-list">{report.parcels.map(parcel=><li key={parcel.id}><details className="handoff-parcel"><summary><strong>{crewName(parcel.from?.crewId)} → {crewName(parcel.to?.crewId)}</strong><span>{parcel.to?.status??'Recipient not recorded'}</span></summary><div className="handoff-detail">
    <p>{parcel.basis}</p><p className="muted">Source task: {parcel.from?.id??'Not recorded'} · Recipient task: {parcel.to?.id??'Not recorded'}{parcel.assignmentId?` · Assignment: ${parcel.assignmentId}`:''}</p>
    <h3>Recorded brief</h3><p className="muted">{parcel.brief?.source==='recipient-message'?'Retained recipient message':parcel.brief?'Recorded assignment objective':'Not recorded'}{parcel.brief?.messageId?` · ${parcel.brief.messageId}`:''}</p><Payload value={parcel.brief}/>
    <h3>Predecessor result</h3>{parcel.result?<p className="muted">{parcel.result.attribution} · {parcel.result.messageId??'Message identity unavailable'}</p>:null}<Payload value={parcel.result}/>
    <h3>Source file references</h3>{parcel.source?<><p>Commit: {parcel.source.commit??'Not recorded'} · fingerprint: {parcel.source.fingerprint??'Not recorded'}</p>{parcel.source.files.length?<ul>{parcel.source.files.map((file,index)=><li key={index}><code>{file.path}</code> · {file.sha256??'Hash not recorded'}</li>)}</ul>:<p>Not recorded</p>}{parcel.source.limited?<p>File list shortened.</p>:null}</>:<p>Not recorded</p>}
    <div className="handoff-actions">{parcel.from?<button onClick={()=>onOpen(parcel.from!.id)}>Open predecessor work</button>:null}{parcel.to?<button onClick={()=>onOpen(parcel.to!.id)}>Open recipient work</button>:null}</div>
   </div></details></li>)}</ol>:<p className="handoff-empty">No crew handoffs recorded for this attempt.</p>}
   <section className="handoff-evidence"><h3>Attempt files and checks</h3><p className="muted">Evidence recorded for this attempt; this does not establish which payload was sent to a recipient. Missing references have not been reconstructed from current files.</p>
    {report.evidence.length?report.evidence.map(item=><details key={item.id}><summary>{item.kind==='check'?`Check: ${item.script??'Not recorded'} · ${item.status??'Unavailable'}`:'Recorded changed files'}</summary><p>Receipt: {item.id} · commit: {item.commit??'Not recorded'} · fingerprint: {item.fingerprint??'Not recorded'}</p>{item.kind==='check'?<p>Exit: {item.exitCode??'Not recorded'} · duration: {item.durationMs===null?'Not recorded':`${item.durationMs} ms`}</p>:item.paths.length?<ul>{item.paths.map((path,index)=><li key={index}><code>{path}</code></li>)}</ul>:<p>Not recorded</p>}{item.limited?<p>File list shortened.</p>:null}</details>):<p>Not recorded</p>}
   </section>
  </>:null}
 </section>;
}
