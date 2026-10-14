import {useRef,useState} from 'react';
import type {Task} from '../shared';
import './missing-thread-recovery.css';

export function FailedLaunchRecovery({task,owned,disabled,invoke,onOpen}:{task:Task;owned:boolean;disabled:boolean;invoke:<T=unknown>(action:string,args?:unknown)=>Promise<T>;onOpen:(id:string)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const pending=useRef(false);
 if(task.external||task.status!=='failed'||!task.launchNotSubmitted)return null;
 const retry=async()=>{
  if(pending.current||disabled)return;pending.current=true;setBusy(true);setError('');
  try{const next=await invoke<Task>('task:retryLaunch',{taskId:task.id,expectedUpdatedAt:task.updatedAt});onOpen(next.id);}
  catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
  finally{pending.current=false;setBusy(false);}
 };
 return <section className="missing-thread-recovery failed-launch-recovery" aria-label="Failed launch recovery"><h3>This launch was not submitted</h3><p>Sunny kept your goal and confirmed that the launch did not reach the worker. Retrying creates one linked replacement and preserves this failure record.</p>
  {owned?<p>Use the mission board, job or coordinator to start its next attempt.</p>:<button disabled={busy||disabled} onClick={()=>void retry()}>{busy?'Starting recovery…':task.retryTaskId?'Open recovery task':'Retry failed launch'}</button>}
  {error?<p role="alert">{error}</p>:null}
 </section>;
}
