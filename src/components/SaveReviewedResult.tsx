import {useRef,useState} from 'react';
import type {ResultSave,Task,TaskSummary} from '../shared';

export function SaveReviewedResult({task,title,text,records,disabled,invoke}:{task?:(Task|TaskSummary)&{messages:Task['messages']};title:string;text:string;records:ResultSave[];disabled:boolean;invoke:<T=unknown>(action:string,args?:unknown)=>Promise<T>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const pending=useRef(false);
 const message=task?.messages.filter(item=>item.role==='assistant'&&item.text.trim()).at(-1);
 const saved=records.find(record=>record.taskId===task?.id&&record.messageId===message?.id&&record.title===title.trim()&&record.text===text&&record.status==='saved');
 const save=async()=>{
  if(disabled||pending.current||saved||!task||!message||task.status!=='finished')return;
  pending.current=true;setBusy(true);setError('');
  try{await invoke('result:save',{taskId:task.id,messageId:message.id,title:title.trim(),text,reviewed:true});}
  catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
  finally{pending.current=false;setBusy(false);}
 };
 return <div><button className="save-reviewed-result" disabled={disabled||busy||Boolean(saved)||task?.status!=='finished'||!message} onClick={()=>void save()}>{saved?'Saved to Obsidian':busy?'Saving…':'Save accepted report to Obsidian'}</button>{saved?<p role="status" className="save-reviewed-path">Saved at {saved.path}</p>:<p>This saves the exact accepted text shown above. The receipt stays linked to this task and attempt.</p>}{error?<p role="alert">{error}</p>:null}</div>;
}
