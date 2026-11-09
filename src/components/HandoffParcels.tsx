import {useEffect,useState} from 'react';
import type {HandoffExcerpt,HandoffReport} from '../shared';
import {CREW,CREW_BY_ID} from '../data';
import {CrewPortrait} from './Chrome';
import './handoff-parcels.css';

type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
function Payload({value}:{value:HandoffExcerpt|null}){
 return value?<><p className="handoff-payload">{value.text}</p>{value.limited?<p className="muted">Preview shortened. Open the recorded task for retained context.</p>:null}</>:<p className="muted">Not recorded</p>;
}
function crewName(id:string|undefined){return CREW.find(crew=>crew.id===id)?.name??id??'Not recorded';}
function HandoffConversation({report,onOpen}:{report:HandoffReport;onOpen:(taskId:string)=>void}){
 const [selected,setSelected]=useState('');
 const [replay,setReplay]=useState(0),[playing,setPlaying]=useState(false);
 useEffect(()=>{setPlaying(false);setReplay(0);},[selected]);
 useEffect(()=>{if(!playing)return;const timer=setTimeout(()=>setPlaying(false),1800);return()=>clearTimeout(timer);},[playing,replay]);
 const index=Math.max(0,report.parcels.findIndex(parcel=>parcel.id===selected));
 const parcel=report.parcels[index];
 if(!parcel)return null;
 const from=parcel.from?CREW_BY_ID.get(parcel.from.crewId):undefined,to=parcel.to?CREW_BY_ID.get(parcel.to.crewId):undefined;
 return <section className="crew-conversation" aria-label="Crew handoff conversation">
  <header><span className="eyebrow">On deck · Recorded exchange</span><h3>Pass it to the crew.</h3><p>Step through saved results and briefs. These are recorded excerpts, not a live chat.</p></header>
  <nav className="relay-chapters" aria-label="Choose a recorded handoff">{report.parcels.map((item,i)=><button key={item.id} type="button" aria-pressed={item.id===parcel.id} onClick={()=>setSelected(item.id)}>{i+1}. {crewName(item.from?.crewId)} → {crewName(item.to?.crewId)}</button>)}</nav>
  <div className="relay-deck" aria-label="Recorded handoff replay" data-playing={playing} key={parcel.id+':'+replay}>
   <img className="relay-deck-art" src={import.meta.env.BASE_URL+'assets/ship-deck.png'} alt="" aria-hidden="true"/>
   <span className="relay-replay-label">Recorded exchange · {report.historical?'historical attempt':'current attempt'}</span>
   <div className="relay-actor relay-sender">{from?<CrewPortrait crew={from}/>:<span>?</span>}<strong>{crewName(parcel.from?.crewId)}</strong><span className="relay-short-bubble">{parcel.result?'Result excerpt: '+parcel.result.text.slice(0,100)+(parcel.result.text.length>100?'…':''):'No result recorded.'}</span></div>
   <span className="relay-parcel-icon" aria-hidden="true">✉</span>
   <div className="relay-actor relay-recipient">{to?<CrewPortrait crew={to}/>:<span>?</span>}<strong>{crewName(parcel.to?.crewId)}</strong><span className="relay-short-bubble">{parcel.brief?'Brief excerpt: '+parcel.brief.text.slice(0,100)+(parcel.brief.text.length>100?'…':''):'No brief recorded.'}</span></div>
   <button className="relay-replay" type="button" disabled={!from||!to} onClick={()=>{setReplay(n=>n+1);setPlaying(true);}}>Replay parcel exchange</button>
  </div>
  <p className="relay-replay-note">Visual replay of saved records. Read the attributed excerpts below; shortened excerpts do not represent a new conversation.</p>
  <div className="relay-scene" aria-live="polite" aria-atomic="true">
   <article className="relay-speaker relay-from"><div className="relay-portrait">{from?<CrewPortrait crew={from}/>:<span className="relay-unknown">?</span>}<strong>{crewName(parcel.from?.crewId)}</strong></div><div className="relay-bubble"><span className="eyebrow">Recorded result</span><Payload value={parcel.result}/>{parcel.result?<small>{parcel.result.attribution}</small>:null}</div></article>
   <div className="relay-pass" aria-hidden="true">↓ &nbsp; HANDOFF &nbsp; ↓</div>
   <article className="relay-speaker relay-to"><div className="relay-portrait">{to?<CrewPortrait crew={to}/>:<span className="relay-unknown">?</span>}<strong>{crewName(parcel.to?.crewId)}</strong></div><div className="relay-bubble"><span className="eyebrow">{parcel.brief?.source==='recipient-message'?'Recorded recipient message':'Recorded assignment brief'}</span><Payload value={parcel.brief}/><small>Recorded task status: {parcel.to?.status??'Not recorded'}</small></div></article>
  </div>
  <footer><button type="button" disabled={index===0} onClick={()=>setSelected(report.parcels[index-1].id)}>← Previous handoff</button><span>{index+1} / {report.parcels.length}</span><button type="button" disabled={index===report.parcels.length-1} onClick={()=>setSelected(report.parcels[index+1].id)}>Next handoff →</button>{parcel.to?<button type="button" onClick={()=>onOpen(parcel.to!.id)}>Open {crewName(parcel.to.crewId)}’s work</button>:null}</footer>
 </section>;
}
export function HandoffParcels({projectId,missionId,attemptId,revision,invoke,onOpen}:{projectId:string;missionId:string;attemptId:string;revision:number;invoke:Invoke;onOpen:(taskId:string)=>void}){
 const [result,setResult]=useState<{key:string;report?:HandoffReport;error?:string}>(),[refresh,setRefresh]=useState(0);
 const key=JSON.stringify([projectId,missionId,attemptId,revision,refresh]);
 useEffect(()=>{let active=true;void invoke<HandoffReport>('mission:handoffs',{projectId,missionId,attemptId,revision}).then(report=>{if(active)setResult({key,report});},error=>{if(active)setResult({key,error:error instanceof Error?error.message:String(error)});});return()=>{active=false;};},[projectId,missionId,attemptId,revision,refresh,invoke,key]);
 const current=result?.key===key?result:undefined,report=current?.report;
 return <section className="handoff-parcels" aria-label="Recorded crew handoffs"><header><div><h2>Crew handoffs</h2><p>Inspect what was recorded between crew assignments.</p></div><button onClick={()=>setRefresh(value=>value+1)}>Refresh handoffs</button></header>
  {!current?<p role="status">Loading recorded handoffs…</p>:current.error?<p role="alert">Handoffs unavailable: {current.error}</p>:report?<>
   <p className="handoff-identity">{report.historical?'Historical attempt':'Current attempt'} · {report.attemptId} · mission revision {report.revision}{report.runRevision!==null?` · run revision ${report.runRevision}`:''}</p>
   <p className="muted">{report.coverage}</p>{report.limited?<p role="status">Some retained records exceed this view’s display limit.</p>:null}
   {report.parcels.length?<HandoffConversation key={report.attemptId} report={report} onOpen={onOpen}/>:null}
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
