import {useEffect,useRef,useState} from 'react';
import type {CrewMemory,Snapshot} from '../shared';
type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
export function LocalRecallPreview({crewId,projectId,query,growth,invoke}:{crewId:string;projectId:string;query:string;growth:Snapshot['growth'];invoke:Invoke}){
 const generation=useRef(0);
 const [preview,setPreview]=useState<{enabled:boolean;memories:CrewMemory[]}>(),[loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{generation.current++;setPreview(undefined);setError('');setLoading(false);return()=>{generation.current++;};},[crewId,projectId,query,growth]);
 const inspect=async()=>{const request=++generation.current;setLoading(true);setError('');try{const result=await invoke<{enabled:boolean;memories:CrewMemory[]}>('localCrew:recall',{crewId,projectId,query});if(generation.current===request)setPreview(result);}catch(e){if(generation.current===request)setError(e instanceof Error?e.message:String(e));}finally{if(generation.current===request)setLoading(false);}};
 return <details className="local-recall-preview">
  <summary>Memories for this question</summary>
  <p>Inspect your pinned lessons eligible for this question. Past generated answers are not used as journal guidance. This uses no model calls. Changing the question, project, or journal clears the preview.</p>
  <button disabled={!projectId||loading} onClick={()=>void inspect()}>{loading?'Checking memories…':'Preview recall'}</button>
  {preview?<><p role="status">{preview.enabled?`${preview.memories.length} journal ${preview.memories.length===1?'memory':'memories'} selected within the recall budget.`:'Memory recall is off. No journal entries will be included.'}</p><small>Recent completed conversation pairs are included separately. Unanswered questions are excluded.</small>{preview.memories.map(memory=><article key={memory.id}><strong>{memory.kind==='note'?'Pinned lesson':'Attributed conversation'}</strong><small>{memory.source?.projectId?'This project':'Global crew preference'} · {memory.source?.localOnly?'Local recall only':'Available to crew missions'}</small><p>{memory.text}</p></article>)}</>:null}
  {error?<p role="alert" className="journal-error">{error}</p>:null}
 </details>;
}
