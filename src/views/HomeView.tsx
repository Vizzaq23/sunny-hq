import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,CheckCircle2,ChevronRight,Compass,FolderPlus,LoaderCircle,Search,Send,Sparkles,Users} from 'lucide-react';
import type {CrewId,Mission,SkillChoice,Snapshot,Task} from '../shared';
import {SkillPicker} from '../components/SkillPicker';
import {ALL_CREW,CREW_BY_ID,formatRelative} from '../data';
import {CrewBadge} from '../components/Chrome';
import {filterFamilies,taskFamilies,taskLabel,taskGuidance,type TaskFamily} from '../taskFlow';
import {clearSubmittedDraft,useDraft} from '../useDraft';
import './home.css';
import {MissionBoard} from './MissionBoard';

type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
const starters=[
 {label:'Build a feature',prompt:'Help me build this feature: ',crew:'franky'},
 {label:'Fix a problem',prompt:'Investigate and fix this problem: ',crew:'chopper'},
 {label:'Research an idea',prompt:'Research this idea and give me a practical recommendation: ',crew:'robin'},
 {label:'Plan my next steps',prompt:'Help me prioritize and complete these tasks: ',crew:'nami'},
];
export function HomeView({launchPending,onLaunchPending,snapshot,invoke,onWorkspace,onImport,onExplore,onSettings,onMission}:{launchPending:boolean;onLaunchPending:(pending:boolean)=>void;snapshot:Snapshot;invoke:Invoke;onWorkspace:(init:{taskId?:string;projectId?:string;crewId?:CrewId;prompt?:string})=>void;onImport:()=>void;onExplore:()=>void;onSettings:()=>void;onMission?:(mission:Mission)=>void}){
 const [projectId,setProjectId]=useState(()=>{try{return sessionStorage.getItem('sunny:last-project')??snapshot.projects[0]?.id??'';}catch{return snapshot.projects[0]?.id??'';}});
 const selectedProject=snapshot.projects.find(project=>project.id===projectId);
 const [mode,setMode]=useDraft('home:routing','delegate'),[crewId,setCrewId]=useDraft('home:specialist','franky');
 const [launchedId,setLaunchedId]=useDraft('home:last-launch');
 const launchedTask=snapshot.tasks.find(task=>task.id===launchedId);
 const [prompt,setPrompt]=useDraft(`home:${projectId}`);
 const [skillDraft,setSkillDraft]=useDraft(`home:skills:${projectId}`,'[]');
 const selectedSkills=useMemo<SkillChoice[]>(()=>{try{const value=JSON.parse(skillDraft);return Array.isArray(value)?value:[];}catch{return [];}},[skillDraft]);
 const [skillsReady,setSkillsReady]=useState(false);
 const sending=launchPending,setSending=onLaunchPending;
 const [error,setError]=useState('');
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const pending=useRef(false),input=useRef<HTMLTextAreaElement>(null);
 const [query,setQuery]=useDraft('home:search'),[phase,setPhase]=useDraft('home:phase','all'),[filterProject,setFilterProject]=useDraft('home:filter-project');
 const families=useMemo(()=>taskFamilies(snapshot.tasks.filter(task=>!task.external)),[snapshot.tasks]);
 const visible=useMemo(()=>filterFamilies(families,{query,phase,projectId:filterProject},snapshot.projects),[families,query,phase,filterProject,snapshot.projects]);
 const [limit,setLimit]=useState(12);
 const crew=ALL_CREW.filter(member=>member.spriteRow===undefined||snapshot.world?.residents.some(resident=>resident.id===member.id&&resident.recruited));
 const counts={attention:families.filter(f=>f.phase==='attention').length,active:families.filter(f=>f.phase==='active').length,done:families.filter(f=>f.phase==='done').length};
 const submit=async()=>{
  if(!prompt.trim()||!selectedProject||!skillsReady||pending.current||launchPending)return;
  pending.current=true;setSending(true);setError('');
  try{
   const task=await invoke<Task>('task:start',{projectId:selectedProject.id,crewId:mode==='delegate'?'luffy':crewId,prompt:prompt.trim(),model:snapshot.settings.model,selectedSkills});
   clearSubmittedDraft(`home:${projectId}`,prompt);setSkillDraft('[]');setLaunchedId(task.id);
   if(mounted.current){setPrompt('');onWorkspace({taskId:task.id,projectId:task.projectId,crewId:task.crewId});}
  }catch(error){if(mounted.current)setError(error instanceof Error?error.message:String(error));}
  finally{pending.current=false;setSending(false);}
 };
 const choosePhase=(next:string)=>{setPhase(next);setLimit(12);document.querySelector('.home-tasks')?.scrollIntoView({behavior:snapshot.settings.reducedMotion?'auto':'smooth',block:'start'});};
 return <div className="page home-page">
  <section className="home-heading"><div><span className="eyebrow">Your crew. One clear course.</span><h2>What are we getting done?</h2><p>Bring the goal. Your crew will help you get there.</p></div><button className="home-explore" onClick={onExplore}><Compass size={18}/> Visit the island <ArrowRight size={16}/></button></section>
  {window.sunny&&snapshot.codex.status!=='connected'?<div className="home-connection" role="status"><span><b>{snapshot.codex.status==='Sample data'?'Review the upgrade safely':snapshot.codex.status==='connecting'?'Connecting to Codex…':'Your crew needs a connection'}</b><small>{snapshot.codex.error??'Your draft is safe here. Check Settings to connect or sign in.'}</small></span><button onClick={onSettings}>Open Settings <ChevronRight size={16}/></button></div>:null}
  {launchedTask?<div className="launch-receipt" role="status"><span><b>Task created</b><small>{launchedTask.title} · {taskLabel(launchedTask)}</small></span><button onClick={()=>onWorkspace({taskId:launchedTask.id})}>Open task <ArrowRight size={16}/></button></div>:null}
  <MissionBoard briefOnly snapshot={snapshot} invoke={invoke} onOpen={(taskId,selection)=>onWorkspace({taskId,...selection})} onSelectMission={onMission}/>
  <details className="home-conversations"><summary>Conversations and past turns</summary>
  <section className="launch-card" aria-label="Start a task">
   <div className="launch-main"><div className="launch-heading"><span className="launch-icon"><Sparkles size={21}/></span><div><h3>Give your crew a goal</h3><p>A sentence is enough to get started.</p></div></div>
    <textarea ref={input} aria-label="Task brief" maxLength={100000} value={prompt} disabled={sending} onChange={event=>setPrompt(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!event.nativeEvent.isComposing){event.preventDefault();void submit();}}} placeholder="What should we build, fix, research, or organize? Add what a good result looks like."/>
    <div className="launch-starters">{starters.map(starter=><button key={starter.label} disabled={sending} onClick={()=>{setPrompt(prompt?`${prompt}\n${starter.prompt}`:starter.prompt);input.current?.focus();}}>{starter.label}<span>↗</span></button>)}</div>
    {error?<div className="launch-error" role="alert"><b>Couldn’t start this task</b><p>{error}</p><small>Your brief is preserved. If a task appeared below, open it to check its status before trying again.</small></div>:null}
   </div>
   <div className="launch-options"><label className="home-field"><span>1. Choose your project</span><select aria-label="Task project" value={selectedProject?.id??''} disabled={sending} onChange={event=>{setProjectId(event.target.value);try{sessionStorage.setItem('sunny:last-project',event.target.value);}catch{}}}><option value="">Choose a project…</option>{snapshot.projects.map(project=><option value={project.id} key={project.id}>{project.name}</option>)}</select></label><button className="import-inline" disabled={sending} onClick={onImport}><FolderPlus size={15}/> Import a folder</button>
    <fieldset className="routing-choice" disabled={sending}><legend>2. Choose how to work</legend><label className={mode==='delegate'?'selected':''}><input type="radio" name="routing" value="delegate" checked={mode==='delegate'} onChange={()=>setMode('delegate')}/><span><b>Let Luffy delegate <em>Recommended</em></b><small>He picks specialists and brings their results back.</small></span></label><label className={mode==='direct'?'selected':''}><input type="radio" name="routing" value="direct" checked={mode==='direct'} onChange={()=>setMode('direct')}/><span><b>Work with one specialist</b><small>Choose exactly who takes the task.</small></span></label></fieldset>
    {mode==='direct'?<label className="home-field"><span>Specialist</span><select aria-label="Task specialist" value={crewId} disabled={sending} onChange={event=>setCrewId(event.target.value)}>{crew.filter(member=>member.id!=='luffy').map(member=><option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}</select></label>:null}
    <SkillPicker projectId={selectedProject?.id??''} brief={prompt} roleId={mode==='delegate'?'coordinator':crewId} disabled={sending} invoke={invoke} value={selectedSkills} onChange={next=>setSkillDraft(JSON.stringify(next))} onReadyChange={setSkillsReady}/>
    <button className="launch-submit" disabled={!selectedProject||!prompt.trim()||!skillsReady||sending||!window.sunny} onClick={()=>void submit()}>{sending?<LoaderCircle size={18} className="spin"/>:<Send size={18}/>} {sending?'Starting your task…':mode==='delegate'?'Start with Luffy':'Start task'} {!sending?<ArrowRight size={18}/>:null}</button><small className="launch-hint">{!window.sunny?'Open Sunny HQ on desktop to run tasks.':!selectedProject?'Choose or import a project to begin.':'Ctrl + Enter to start · Draft kept in this window'}</small>
   </div>
  </section>
  <div className="home-stats" aria-label="Task overview">{([{id:'attention',label:'Need your attention',icon:Sparkles},{id:'active',label:'In progress',icon:Users},{id:'done',label:'Past tasks',icon:CheckCircle2}] as const).map(item=><button key={item.id} className={`home-stat ${item.id} ${phase===item.id?'selected':''}`} onClick={()=>choosePhase(phase===item.id?'all':item.id)} aria-pressed={phase===item.id}><item.icon size={20}/><strong>{counts[item.id]}</strong><span>{item.label}</span><ChevronRight size={16}/></button>)}</div>
  <section className="home-tasks" aria-label="Your tasks"><header><div><span className="eyebrow">The work, at a glance</span><h3>Your tasks <span>{families.length}</span></h3></div><label className="task-search"><Search size={17}/><input aria-label="Search tasks" placeholder="Search tasks, crew, projects…" value={query} onChange={event=>{setQuery(event.target.value);setLimit(12);}}/></label></header>
   <div className="task-filters"><div aria-label="Filter tasks">{[{id:'all',label:'All tasks'},{id:'attention',label:'Needs attention'},{id:'active',label:'In progress'},{id:'done',label:'Past tasks'}].map(item=><button key={item.id} aria-pressed={phase===item.id} className={phase===item.id?'selected':''} onClick={()=>choosePhase(item.id)}>{item.label}</button>)}</div><select aria-label="Filter by project" value={filterProject} onChange={event=>{setFilterProject(event.target.value);setLimit(12);}}><option value="">All projects</option>{snapshot.projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
   {visible.length?<div className="home-task-list">{visible.slice(0,limit).map(family=><FamilyCard key={family.task.id} family={family} snapshot={snapshot} onOpen={taskId=>onWorkspace({taskId})}/>)}</div>:<div className="home-empty"><CheckCircle2 size={30}/><h4>{families.length?'Nothing in this view':'A fresh start for your next idea'}</h4><p>{families.length?'Try another filter or search.':'Write a goal above. Your task and crew assignments will appear here.'}</p>{families.length?<button onClick={()=>{setQuery('');setFilterProject('');choosePhase('all');}}>Show all tasks</button>:null}</div>}
   {visible.length>limit?<button className="load-tasks" onClick={()=>setLimit(value=>value+12)}>Show more tasks ({visible.length-limit} remaining)</button>:null}
  </section>
 </details></div>;
}
function FamilyCard({family,snapshot,onOpen}:{family:TaskFamily;snapshot:Snapshot;onOpen:(id:string)=>void}){
 const {task,children,phase}=family,crew=CREW_BY_ID.get(task.crewId);
 const attention=children.find(child=>['waiting','awaiting-approval','unknown','failed'].includes(child.status)||child.error);
 const target=attention??task;
 const guidance=taskGuidance(target);
 const latest=[...task.messages].reverse().find(message=>message.role==='assistant'&&message.text.trim());
 return <article className={`home-task ${phase}`}><div className="home-task-top">{crew?<CrewBadge crew={crew} size="small"/>:<Users size={22}/>}<button className="home-task-title" onClick={()=>onOpen(task.id)}><h4>{task.title}</h4><span>{snapshot.projects.find(project=>project.id===task.projectId)?.name??'Project unavailable'} <i>·</i> {crew?.name??task.crewId} <i>·</i> {formatRelative(family.updatedAt)}</span></button><span className={`task-label ${phase}`}>{attention?`${CREW_BY_ID.get(attention.crewId)?.name??'Crew'} needs attention`:phase==='active'?'In progress':taskLabel(task)}</span></div>
  {task.error?<p className="home-task-error">{task.error}</p>:latest?<p className="home-task-preview">{latest.text}</p>:<p className="home-task-preview">{guidance.detail}</p>}
  <footer><div className="family-crew">{children.length?<><span>{children.length} assignment{children.length===1?'':'s'}</span>{children.map(child=><button key={child.id} onClick={()=>onOpen(child.id)} title={`${CREW_BY_ID.get(child.crewId)?.name}: ${child.title} · ${taskLabel(child)}`}><span className={`task-state ${child.status}`}/>{CREW_BY_ID.get(child.crewId)?.name??child.crewId}</button>)}</>:<span>{task.captain?'Luffy coordinates this conversation':'Conversation'}</span>}</div><button className="home-task-open" onClick={()=>onOpen(attention?.id??task.id)}>{phase==='active'?'Follow progress':guidance.action}<ArrowRight size={15}/></button></footer>
 </article>;
}
