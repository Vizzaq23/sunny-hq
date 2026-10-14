import {useState} from 'react';
import type {ResultSave,WorkReportItem} from '../shared';
import './result-save-history.css';

type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
export function ResultSaveHistory({records,invoke,onSource}:{records:ResultSave[];invoke:Invoke;onSource:(item:WorkReportItem)=>void}){
 const [pending,setPending]=useState<string>(),[error,setError]=useState('');
 const recover=async(record:ResultSave)=>{
  if(pending)return;setPending(record.id);setError('');
  try{await invoke('result:recover',{saveId:record.id});}catch(reason){setError(reason instanceof Error?reason.message:String(reason));}finally{setPending(undefined);}
 };
 if(!records.length)return null;
 return <section className="result-save-history" aria-label="Obsidian save history"><h4>Reviewed results in Obsidian</h4><p>Receipts record the exact note and when Sunny verified it. Check a note again if it may have changed.</p>
  {error?<p role="alert">{error}</p>:null}
  {records.map(record=><article key={record.id} data-save-id={record.id}>
   <h5>{record.title}</h5><p role="status"><strong>{record.status==='needs-recovery'?'Needs recovery':record.status==='saved'?'Saved':record.status==='failed'?'Failed':'Saving'}</strong> · reviewed {new Date(record.reviewedAt).toLocaleString()}</p>
   <p className="result-save-path">{record.path}</p>{record.error?<p role="alert">{record.error}</p>:null}
   <details><summary>Inspect reviewed result and receipt</summary><pre>{record.text}</pre>{record.receipt?<dl><dt>Receipt</dt><dd>{record.receipt.id}</dd><dt>Verified</dt><dd>{new Date(record.receipt.verifiedAt).toLocaleString()}</dd><dt>SHA-256</dt><dd>{record.receipt.sha256}</dd><dt>Bytes</dt><dd>{record.receipt.bytes}</dd></dl>:<p>No confirmed receipt yet. Recovery checks this exact destination before writing.</p>}</details>
   <button disabled={Boolean(pending)||record.status==='saving'} onClick={()=>void recover(record)}>{pending===record.id?'Checking…':record.status==='saved'?'Check saved note':'Recover this save'}</button>
   <button onClick={()=>onSource({projectId:record.projectId,kind:'task',id:record.taskId,title:record.title,status:record.status,observedAt:record.updatedAt,target:{view:'task',id:record.taskId},sourceId:record.taskId,sourceTime:record.reviewedAt})}>Open source task</button>
  </article>)}
 </section>;
}
