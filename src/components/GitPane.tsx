import {useEffect,useRef,useState} from 'react';
import {GitBranch,GitCommitHorizontal,RefreshCw} from 'lucide-react';
import type {Project} from '../shared';
import {requestSequence} from '../noteDrafts';
type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
type GitState={branch:string;files:{path:string;status:string}[];diff:string};
export function GitPane({project,invoke,toast}:{project:Project;invoke:Invoke;toast:(message:string,tone?:'default'|'success'|'error')=>void}){
 const [git,setGit]=useState<GitState|null>(null),[selected,setSelected]=useState<string[]>([]),[diff,setDiff]=useState(''),[file,setFile]=useState(''),[message,setMessage]=useState('');
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[diffBusy,setDiffBusy]=useState(false),[diffError,setDiffError]=useState(''),[committing,setCommitting]=useState(false);
 const statusRequests=useRef(requestSequence()),diffRequests=useRef(requestSequence()),pending=useRef(false);
 const refresh=async()=>{
  const id=statusRequests.current.next();diffRequests.current.cancel();setLoading(true);setError('');setDiffBusy(false);setDiffError('');setFile('');setDiff('');
  try{const data=await invoke<GitState>('git:status',{projectId:project.id});if(!statusRequests.current.current(id))return;setGit(data);setDiff(data.diff);setSelected(old=>old.filter(path=>data.files.some(item=>item.path===path)));}
  catch(cause){if(statusRequests.current.current(id))setError(String(cause));}
  finally{if(statusRequests.current.current(id))setLoading(false);}
 };
 useEffect(()=>{void refresh();return()=>{statusRequests.current.cancel();diffRequests.current.cancel();};},[project.id,invoke]);
 const choose=async(path:string)=>{
  const id=diffRequests.current.next();setFile(path);setDiff('');setDiffBusy(true);setDiffError('');
  try{const result=await invoke<string>('git:diff',{projectId:project.id,path});if(diffRequests.current.current(id))setDiff(result);}
  catch(cause){if(diffRequests.current.current(id))setDiffError(String(cause));}
  finally{if(diffRequests.current.current(id))setDiffBusy(false);}
 };
 const commit=async()=>{
  if(pending.current||loading||error||!message.trim()||!selected.length)return;
  pending.current=true;setCommitting(true);setError('');
  try{await invoke('git:commit',{projectId:project.id,paths:selected,message:message.trim()});toast('Commit created.','success');setSelected([]);setMessage('');await refresh();}
  catch(cause){setError(String(cause));}
  finally{pending.current=false;setCommitting(false);}
 };
 return <div className="git-pane"><div className="git-sidebar"><div className="git-branch"><GitBranch/>{git?.branch??(loading?'Loading branch…':'Branch unavailable')}</div><button className="small-button" disabled={loading||committing} onClick={()=>void refresh()}><RefreshCw/>Refresh changes</button>
 {loading?<p role="status">Reading working copy…</p>:null}{error?<div role="alert" className="file-load-error">{error}{git?<p>Last known changes shown. Refresh before committing.</p>:null}</div>:null}
 <span className="pane-label">Changes</span>{git?.files.map(item=><div className="git-file" key={item.path}><input type="checkbox" aria-label={'Include '+item.path+' in commit'} disabled={loading||committing||Boolean(error)} checked={selected.includes(item.path)} onChange={()=>setSelected(old=>old.includes(item.path)?old.filter(p=>p!==item.path):[...old,item.path])}/><button aria-pressed={file===item.path} disabled={loading||committing} onClick={()=>void choose(item.path)}><span>{item.path}</span><em>{item.status}</em></button></div>)}{git&&!loading&&!error&&!git.files.length?<p className="clean-tree">Working tree is clean.</p>:null}
 <label className="commit-message-label">Commit message<textarea placeholder="Describe the change" disabled={committing} value={message} onChange={e=>setMessage(e.target.value)}/></label><button className="commit-button" disabled={loading||Boolean(error)||committing||!selected.length||!message.trim()} onClick={()=>void commit()}><GitCommitHorizontal/>{committing?'Creating commit…':'Commit '+(selected.length||'')}</button></div>
 <section className="git-diff-panel" aria-label="Change preview"><header className="pane-toolbar">{file||'Working copy diff'}</header>{diffError?<div className="file-load-error" role="alert">{diffError}<button onClick={()=>void choose(file)}>Retry diff</button></div>:null}<pre className="diff-view" aria-busy={diffBusy}>{diffBusy?'Loading '+file+'…':diff||(file?'No text diff returned for this file.':'Select a changed file to inspect its diff.')}</pre></section></div>;
}
