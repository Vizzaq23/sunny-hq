import {useRef,useState} from 'react';
import type {TaskSummary as Task} from '../shared';
import './missing-thread-recovery.css';

export function MissingThreadRecovery({task,invoke,disabled=false}:{task:Task;invoke:<T=unknown>(action:string,args?:unknown)=>Promise<T>;disabled?:boolean}){
 const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const pending=useRef(false);
 if(task.external||task.status!=='unknown'||task.threadId)return null;
 const resolve=async()=>{if(pending.current||disabled||!confirmed)return;pending.current=true;setBusy(true);setError('');try{await invoke('task:resolveMissingThread',{taskId:task.id,expectedUpdatedAt:task.updatedAt??0,confirmedStopped:true});}catch(e){setError(e instanceof Error?e.message:String(e));}finally{pending.current=false;setBusy(false);}};
 return <section className="missing-thread-recovery" aria-label="Missing conversation recovery"><h3>Saved conversation ID is missing</h3><p>Sunny cannot ask the provider whether this older task is still running. Its project remains reserved. Inspect the provider and any related processes before confirming that the work has stopped.</p><label><input type="checkbox" checked={confirmed} disabled={busy||disabled} onChange={e=>setConfirmed(e.target.checked)}/>I verified that this task and its processes have stopped.</label><button className="small-button" disabled={!confirmed||busy||disabled} onClick={()=>void resolve()}>Record interrupted task</button><p>This records your confirmation, not a verified provider result. It preserves the log and allows a new task or mission attempt after active child assignments are resolved.</p>{error?<p role="alert">{error}</p>:null}</section>;
}
