import {useEffect,useRef,useState} from 'react';
import type {FileData,FileEntry,Project} from '../shared';

type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;

// A read-only shelf over the existing registered-project file boundary.
export function ProjectCharts({project,invoke}:{project:Project;invoke:Invoke}){
 const [entries,setEntries]=useState<FileEntry[]>([]),[folders,setFolders]=useState<FileEntry[]>([]);
 const [preview,setPreview]=useState<FileData|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
 const request=useRef(0);
 useEffect(()=>()=>{request.current++;},[]);
 const list=async(next:FileEntry[])=>{
  const revision=++request.current;setBusy(true);setError('');setPreview(null);setLoaded(false);setFolders(next);setEntries([]);
  try{
   const files=await invoke<FileEntry[]>('files:list',{projectId:project.id,path:next.at(-1)?.path??''});
   if(revision!==request.current)return;
   setEntries(files.filter(file=>!file.name.startsWith('.')&&!/(^env$|\.env(?:\.|$))/i.test(file.name)&&(file.directory?(next.length>0||file.name.toLowerCase()==='docs'):/\.md$/i.test(file.name))));setLoaded(true);
  }catch(reason){if(revision===request.current)setError(String(reason));}
  finally{if(revision===request.current)setBusy(false);}
 };
 const open=async(file:FileEntry)=>{
  const revision=++request.current;setBusy(true);setError('');setPreview(null);
  try{const data=await invoke<FileData>('files:read',{projectId:project.id,path:file.path});if(revision===request.current)setPreview(data);}
  catch(reason){if(revision===request.current)setError(String(reason));}
  finally{if(revision===request.current)setBusy(false);}
 };
 return <details className="panel project-charts" onToggle={event=>{
  if(event.currentTarget.open){void list([]);}else{request.current++;setPreview(null);setBusy(false);setError('');}
 }}><summary>Project charts · Documents</summary>
  <p>Read Markdown notes from this project's root and docs folder. Select a document to load its current text. These notes are source material, not verified mission evidence.</p>
  <nav aria-label="Document folders"><button disabled={busy} onClick={()=>void list([])}>Project root</button>{folders.map((folder,index)=><button key={folder.path} disabled={busy} onClick={()=>void list(folders.slice(0,index+1))}>{folder.name}</button>)}<button disabled={busy} onClick={()=>void list(folders)}>Refresh list</button></nav>
  {error?<p role="alert">{error}</p>:null}{busy?<p role="status">Loading project charts…</p>:null}
  {loaded&&!entries.length?<p>No Markdown documents or docs folders here.</p>:null}
  {entries.length>300?<p>Showing the first 300 entries. Open a folder to narrow the list.</p>:null}
  <ul>{entries.slice(0,300).map(file=><li key={file.path}><button className={file.directory?'chart-folder':'chart-document'} disabled={busy} onClick={()=>file.directory?void list([...folders,file]):void open(file)}>{file.directory?'Folder: ':''}{file.name}</button></li>)}</ul>
  {preview?<section aria-label="Document preview"><h4>{preview.path.split(/[\\/]/).at(-1)}</h4><p>Read-only text as loaded. Select the document again to reload changes.</p><pre className="chart-preview" tabIndex={0}>{preview.text}</pre></section>:null}
 </details>;
}
