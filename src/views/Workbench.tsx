import {ROOM_BRIEFS,appendRoomStarter} from '../roomBriefs';
import {RoomStation} from '../components/RoomStation';
import {FailedLaunchRecovery} from '../components/FailedLaunchRecovery';
import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,BookOpen,Check,ChevronDown,ChevronRight,Code2,Eye,File,FileCode2,Files,GitBranch,GitCommitHorizontal,LoaderCircle,Pause,Play,Save,Send,ShipWheel,TerminalSquare,Volume2,VolumeX,X} from 'lucide-react';
import type {Approval,CrewId,FileData,FileEntry,Project,SkillChoice,Snapshot,TaskSummary as Task} from '../shared';
import {SkillPicker} from '../components/SkillPicker';
import {ALL_CREW as CREW,CREW_BY_ID} from '../data';
import {MissionExecution} from '../components/MissionExecution';
import {MissingThreadRecovery} from '../components/MissingThreadRecovery';
import {CrewAssignments} from '../components/CrewAssignments';
const CodeEditor=lazy(()=>import('../components/CodeEditor').then(module=>({default:module.CodeEditor})));
const TerminalPane=lazy(()=>import('../components/TerminalPane').then(module=>({default:module.TerminalPane})));
import {CrewBadge,EmptyState} from '../components/Chrome';
import {taskIsBusy,taskLabel,taskGuidance} from '../taskFlow';
import {useDraft} from '../useDraft';
import {playRoomCue,ROOM_SOUND_DEFAULT_VOLUME,stopRoomAudio,unlockRoomAudio} from '../roomAudio';
import {useTaskTranscript} from '../useTaskTranscript';

type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
const ROOM_ART:Partial<Record<CrewId,string>>={luffy:'luffy-captains-den.png',zoro:'zoro-dojo-room.png',nami:'nami-chart-room.png',usopp:'usopp-inventors-workshop.png',sanji:'sanji-galley-room.png',chopper:'chopper-infirmary-room.png',robin:'robin-ship-library.png',franky:'franky-shipwright-room.png',brook:'brook-music-room.png',jinbe:'jinbe-helm-room.png'};

const subscribeTranscript=(handler:Parameters<NonNullable<Window['sunny']>['subscribe']>[0])=>window.sunny?.subscribe?.(handler)??(()=>{});

export function Workbench({snapshot,initial,invoke,toast,onClose,onSettings,onOpenLibrary,embedded=false,onNavigationGuard,onTaskChange}:{snapshot:Snapshot;initial:{taskId?:string;projectId?:string;missionId?:string;attemptId?:string;crewId?:CrewId;prompt?:string;draftKey?:string};invoke:Invoke;toast:(message:string,tone?:'default'|'success'|'error')=>void;onClose:()=>void;onSettings?:()=>void;onOpenLibrary?:()=>void;embedded?:boolean;onNavigationGuard?:(guard:(()=>boolean)|null)=>void;onTaskChange?:(taskId:string)=>void}){
  const task=snapshot.tasks.find(item=>item.id===initial.taskId);
  const [projectId,setProjectId]=useState(initial.projectId??task?.projectId??'');
  const [crewId,setCrewId]=useState<CrewId>(initial.crewId??task?.crewId??'luffy');
  const [sending,setSending]=useState(false),[operationError,setOperationError]=useState(''),[showTools,setShowTools]=useState(false);
  const pending=useRef(false);
  const availableCrew=CREW.filter(member=>member.spriteRow===undefined||snapshot.world?.residents.some(resident=>resident.id===member.id&&resident.recruited));
  const [pane,setPane]=useState<'files'|'git'|'terminal'|'preview'>('files');
  const [editorDirty,setEditorDirty]=useState(false),[editorSession,setEditorSession]=useState(0);
  const [activeTaskId,setActiveTaskId]=useState(initial.taskId);
  const [selectedSkills,setSelectedSkills]=useState<SkillChoice[]>([]);
  const [skillsReady,setSkillsReady]=useState(false);
  const [prompt,setPrompt,messageDraft]=useDraft(activeTaskId?`task:${activeTaskId}`:initial.draftKey??`new:${projectId}`,activeTaskId?'':initial.prompt??'',initial.missionId&&activeTaskId?{id:'message:'+activeTaskId,projectId,taskId:activeTaskId,workspace:snapshot.workspace,invoke}:undefined);
  const activeTask=snapshot.tasks.find(item=>item.id===activeTaskId);
  const activeRun=snapshot.runs?.find(run=>run.id===activeTask?.runId||snapshot.missions?.some(m=>m.id===initial.missionId&&m.runId===run.id));
  const transcript=useTaskTranscript({projectId:activeTask?.projectId,taskId:activeTask?.id,epoch:snapshot.epoch,revision:activeTask?.transcriptRevision,sequence:snapshot.sequence,invoke,subscribe:subscribeTranscript});
  const project=snapshot.projects.find(item=>item.id===(activeTask?.projectId??projectId));
  const desiredIdentity=activeTask?.workspaceId??('original:'+project?.id);
  const toolsBinding=useRef({identity:desiredIdentity,taskId:activeTask?.id,runId:activeTask?.runId,workspaceId:activeTask?.workspaceId});
  if(!editorDirty)toolsBinding.current={identity:desiredIdentity,taskId:activeTask?.id,runId:activeTask?.runId,workspaceId:activeTask?.workspaceId};
  const binding=toolsBinding.current,executionIdentity=binding.identity;
  const toolsInvoke=useMemo<Invoke>(()=><T,>(action:string,args?:unknown)=>{const bound=args&&typeof args==='object'?{...args,...(binding.taskId?{taskId:binding.taskId,...(binding.runId?{runId:binding.runId,workspaceId:binding.workspaceId}:{})}:{})}:args;return invoke<T>(action,/^(files:|git:|terminal:create)/.test(action)?bound:args);},[invoke,binding.taskId,binding.runId,binding.workspaceId]);
  const crew=CREW_BY_ID.get(activeTask?.crewId??crewId)!;
  const roomArtName=ROOM_ART[crew.id],roomArt=roomArtName?new URL(`${import.meta.env.BASE_URL}assets/${roomArtName}`,location.href).href:undefined;
  const roomSoundEnabled=snapshot.settings.roomSoundEnabled===true;
  const roomSoundVolume=snapshot.settings.roomSoundVolume??ROOM_SOUND_DEFAULT_VOLUME;
  useEffect(()=>{stopRoomAudio();},[roomSoundVolume]);
  useEffect(()=>{if(roomSoundEnabled&&!document.hidden)void playRoomCue(crew.id,roomSoundVolume);return stopRoomAudio;},[crew.id,roomSoundEnabled]);
  useEffect(()=>{const hidden=()=>{if(document.hidden)stopRoomAudio();};document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',stopRoomAudio);return()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',stopRoomAudio);stopRoomAudio();};},[]);
  const toggleRoomSound=()=>{const enabled=!roomSoundEnabled;if(enabled)void unlockRoomAudio();else stopRoomAudio();void invoke('settings:update',{roomSoundEnabled:enabled}).catch(()=>{});};

  const submit=async()=>{
    if(crew.id==='morgans'||activeTask?.launchNotSubmitted||!prompt.trim()||!project||!activeTask&&!skillsReady||pending.current||(activeTask&&taskIsBusy(activeTask)))return;
    pending.current=true;setSending(true);setOperationError('');
    try{if(activeTask){const submitted=messageDraft?await messageDraft.save():undefined;await invoke('task:send',{taskId:activeTask.id,prompt:(submitted?.text??prompt).trim()});if(submitted)try{await messageDraft!.clear(submitted);}catch(error){setOperationError('Message sent. Draft cleanup failed; do not send it again. '+String(error));}else setPrompt('');}else{const next=await invoke<Task>('task:start',{projectId:project.id,crewId,prompt:prompt.trim(),model:snapshot.settings.model,selectedSkills});setPrompt('');setActiveTaskId(next.id);onTaskChange?.(next.id);}}
    catch(error){setOperationError(error instanceof Error?error.message:String(error));}
    finally{pending.current=false;setSending(false);}
  };
  const handoff=async(nextCrew:CrewId)=>{
    if(crew.id==='morgans'||pending.current||activeTask&&taskIsBusy(activeTask))return;
    if(!activeTask){setCrewId(nextCrew);return;}
    if(!confirmDiscard())return;
    pending.current=true;setSending(true);setOperationError('');
    try{const next=await invoke<Task>('task:handoff',{taskId:activeTask.id,crewId:nextCrew,prompt:`Continue this mission as ${CREW_BY_ID.get(nextCrew)?.role}. Review the existing context and take the next useful step.`});setEditorDirty(false);setEditorSession(value=>value+1);setActiveTaskId(next.id);onTaskChange?.(next.id);}
    catch(error){setOperationError(error instanceof Error?error.message:String(error));}
    finally{pending.current=false;setSending(false);}
  };
  const checkStatus=async()=>{if(!activeTask||pending.current)return;pending.current=true;setSending(true);setOperationError('');try{await invoke('task:checkStatus',{taskId:activeTask.id});}catch(error){setOperationError(error instanceof Error?error.message:String(error));}finally{pending.current=false;setSending(false);}};
  const interrupt=async()=>{if(!activeTask||pending.current)return;pending.current=true;setSending(true);setOperationError('');try{await invoke('task:interrupt',{taskId:activeTask.id});}catch(error){setOperationError(error instanceof Error?error.message:String(error));}finally{pending.current=false;setSending(false);}};

  const confirmDiscard=()=>!editorDirty||window.confirm('Discard your unsaved file changes?');
  useEffect(()=>{onNavigationGuard?.(()=>!pending.current&&confirmDiscard());return()=>onNavigationGuard?.(null);},[onNavigationGuard,editorDirty]);
  const changePane=(next:typeof pane)=>{if(next===pane||confirmDiscard()){setPane(next);if(next!=='files')setEditorDirty(false);}};
  const actionable=activeTask&&taskIsBusy(activeTask);
  const [roomLayout,setRoomLayout]=useState<'room'|'focus'>('room');
  const switchTask=(id:string)=>{if(!pending.current&&confirmDiscard()){setEditorDirty(false);setEditorSession(value=>value+1);setOperationError('');setActiveTaskId(id);onTaskChange?.(id);}};
  return <div className={`workbench ${embedded?'embedded-workbench':''} crew-room-${crew.id} ${showTools?'':'focused-chat'} ${snapshot.settings.reducedMotion?'reduce-motion':''}`} data-crew-id={crew.id} data-room-mode={roomLayout}><header className="workbench-head"><button className="round-button" aria-label="Back to workspace" title="Back · your message draft is kept" disabled={sending} onClick={()=>{if(confirmDiscard())onClose();}}><ArrowLeft/></button><div className="workbench-identity"><span className="project-chip">{project?.name??'Choose a project'} · {activeTask?.workspaceId?'Worker copy '+activeTask.workspaceId.slice(0,8):'Original working copy'} · {crew.station}</span><h2>{activeTask?.title??'New mission'}</h2></div><div className="workbench-crew"><CrewBadge crew={crew} size="small"/><select disabled={sending||Boolean(actionable)||crew.id==='morgans'} title={activeTask?'Hand off to another specialist':'Choose a specialist'} value={activeTask?.crewId??crewId} onChange={event=>void handoff(event.target.value as CrewId)} aria-label="Assigned crewmate">{availableCrew.map(member=><option value={member.id} key={member.id}>{member.name} · {member.role}</option>)}</select><ChevronDown size={15}/></div><button type="button" className={`workspace-tools-toggle room-sound-toggle ${roomSoundEnabled?'enabled':''}`} aria-pressed={roomSoundEnabled} aria-label={`${roomSoundEnabled?'Mute':'Enable'} room sounds`} title={`${roomSoundEnabled?'Mute':'Enable'} short ${crew.name} room arrival cues`} onClick={toggleRoomSound}>{roomSoundEnabled?<Volume2 aria-hidden="true"/>:<VolumeX aria-hidden="true"/>}<span>{roomSoundEnabled?'Sound on':'Sound off'}</span></button>{activeRun?<button type="button" className="room-stop-all" disabled={sending||activeRun.phase==='stopped'} onClick={()=>void invoke('run:control',{runId:activeRun.id,projectId:activeRun.projectId,expectedRevision:activeRun.revision,action:'stop'}).catch(error=>setOperationError(String(error)))}>Stop crew</button>:null}{crew.id==='robin'&&onOpenLibrary?<button className="workspace-tools-toggle robin-library-toggle" onClick={()=>{if(confirmDiscard())onOpenLibrary();}} title="Search, edit, or capture notes in the connected Obsidian library"><BookOpen/>Obsidian library</button>:null}<button className="workspace-tools-toggle" aria-expanded={showTools} disabled={sending} onClick={()=>{if(!showTools||confirmDiscard()){setShowTools(!showTools);setEditorDirty(false);}}}><Code2/>{showTools?'Hide tools':'Files & tools'}</button>{actionable?<button className="interrupt-button" disabled={sending||activeTask.status!=='unknown'&&!activeTask.turnId} title={activeTask.status==='unknown'?'Check provider status without stopping work':activeTask.turnId?'Stop the current Codex turn':'Waiting for the Codex turn to start'} onClick={()=>void (activeTask.status==='unknown'?checkStatus():interrupt())}><Pause size={16}/> {activeTask.status==='unknown'?'Check status':activeTask.captain?'Stop crew':'Interrupt'}</button>:null}</header>
    {roomArt?<div className="room-layout-toolbar"><span><ShipWheel/>{crew.name}’s workspace <small>{project?.name??'No project selected'}</small></span><div role="group" aria-label="Workspace layout"><button aria-pressed={roomLayout==='room'} onClick={()=>setRoomLayout('room')}>Room & conversation</button><button aria-pressed={roomLayout==='focus'} onClick={()=>setRoomLayout('focus')}>Focus conversation</button></div></div>:null}
    <div className="workbench-body">{roomArt?<RoomStation visible={roomLayout==='room'} crew={crew} art={roomArt} snapshot={snapshot} task={activeTask} project={project} onTools={next=>{if(pending.current)return;if(next===pane||confirmDiscard()){setPane(next);setShowTools(true);if(next!=='files')setEditorDirty(false);}}} onLibrary={onOpenLibrary?()=>{if(confirmDiscard())onOpenLibrary();}:undefined} onFocus={()=>document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus()}/>:null}<main className="chat-pane">{activeTask?<MissionStatus task={activeTask} tasks={snapshot.tasks} onOpen={switchTask}/>:null}{activeTask?<div className="mission-execution-bar"><MissionExecution task={activeTask}/></div>:null}{activeTask?<CrewAssignments task={activeTask} tasks={snapshot.tasks} onOpen={switchTask}/>:null}{activeTask?<><FailedLaunchRecovery task={activeTask!} owned={Boolean(activeTask?.runId||activeTask?.parentTaskId||activeTask?.jobId||initial.missionId||snapshot.missions?.some(m=>m.taskIds.includes(activeTask.id)))} disabled={sending} invoke={invoke} onOpen={id=>{setActiveTaskId(id);onTaskChange?.(id);}}/><MissingThreadRecovery key={activeTask.id+":"+activeTask.updatedAt} task={activeTask} invoke={invoke} disabled={sending}/></>:null}{activeTask?<Conversation transcript={transcript} task={activeTask} crewId={activeTask.crewId} reducedMotion={snapshot.settings.reducedMotion}/>:<MissionStart disabled={sending} crew={availableCrew} projects={snapshot.projects} projectId={projectId} setProjectId={id=>{if(!pending.current&&confirmDiscard()){setEditorDirty(false);setProjectId(id);}}} crewId={crewId} setCrewId={setCrewId} onStarter={text=>{if(!pending.current){setPrompt(appendRoomStarter(prompt,text));document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus();}}}/>}<ApprovalStack approvals={snapshot.approvals.filter(a=>!a.taskId||a.taskId===activeTask?.id||(activeTask?.captain&&snapshot.tasks.some(t=>t.id===a.taskId&&t.parentTaskId===activeTask.id)))} invoke={invoke}/><div className="composer">{operationError||activeTask?.error||activeTask?.status==='unknown'?<div className="task-recovery" role="alert"><b>{activeTask?.status==='unknown'?'Check this task before continuing':'This task needs attention'}</b><p>{operationError||activeTask?.error||'The connection was interrupted. Use Check status above to find out whether work is still running.'}</p>{onSettings?<button onClick={()=>{if(confirmDiscard())onSettings();}}>Connection settings</button>:null}</div>:null}<>{messageDraft?<div className="workspace-draft-status" role={messageDraft.error?'alert':'status'}>{messageDraft.error?`Message draft unsaved: ${messageDraft.error}`:messageDraft.saving?'Saving message draft…':messageDraft.dirty?'Message draft has unsaved edits':'Message draft saved'}{messageDraft.error?<><button onClick={()=>void messageDraft.refresh().catch(()=>{})}>Refresh saved revision</button><button onClick={()=>void messageDraft.save().catch(()=>{})}>Save my edits</button><button onClick={messageDraft.export}>Export my draft</button></>:null}</div>:null}</><textarea aria-label="Message the crew" value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void submit();}}} placeholder={actionable?`${taskLabel(activeTask!)} · you can draft your next message here`:project?'Describe the outcome you want…':'Import a project before starting a task'} disabled={!project||sending||crew.id==='morgans'||Boolean(activeTask?.launchNotSubmitted)}/>{!activeTask?<SkillPicker projectId={project?.id??""} brief={prompt} roleId={crewId} disabled={sending} invoke={invoke} value={selectedSkills} onChange={setSelectedSkills} onReadyChange={setSkillsReady}/>:null}<div className="composer-foot"><span>{crew.name} · Enter to send · Shift + Enter for a new line</span><button onClick={()=>void submit()} disabled={!project||!prompt.trim()||!activeTask&&!skillsReady||sending||Boolean(actionable)||crew.id==='morgans'||Boolean(activeTask?.launchNotSubmitted)}>{sending?<LoaderCircle className="spin"/>:<Send/>}<span>{activeTask?'Send':'Start task'}</span></button></div></div></main>{showTools?<aside className="work-pane"><div className="work-tabs"><button className={pane==='files'?'active':''} onClick={()=>changePane('files')}><Files/>Files</button><button className={pane==='git'?'active':''} onClick={()=>changePane('git')}><GitBranch/>Git</button><button className={pane==='terminal'?'active':''} onClick={()=>changePane('terminal')}><TerminalSquare/>Terminal</button><button className={pane==='preview'?'active':''} onClick={()=>changePane('preview')}><Eye/>Preview</button></div><div className="work-content">{executionIdentity!==desiredIdentity?<div role="alert">Working copy changed. Your file draft is preserved.<button onClick={()=>{if(confirmDiscard()){setEditorDirty(false);setEditorSession(value=>value+1);}}}>Discard draft and switch copy</button></div>:null}{project?<>{pane==='files'?<FilesPane locked={sending} key={executionIdentity+':'+editorSession} project={project} invoke={toolsInvoke} toast={toast} onDirtyChange={setEditorDirty}/>:null}{pane==='git'?<GitPane key={executionIdentity} project={project} invoke={toolsInvoke} toast={toast}/>:null}{pane==='terminal'?<Suspense fallback={<p>Opening terminal…</p>}><TerminalPane key={executionIdentity} project={project} invoke={toolsInvoke}/></Suspense>:null}{pane==='preview'?<PreviewPane invoke={invoke}/>:null}</>:<EmptyState title="No project selected" body="Import a local folder from Projects, then return here to use the workbench."/>}</div></aside>:null}</div>
  </div>;
}

function MissionStart({disabled,crew,projects,projectId,setProjectId,crewId,setCrewId,onStarter}:{disabled:boolean;crew:typeof CREW;projects:Project[];projectId:string;setProjectId:(id:string)=>void;crewId:CrewId;setCrewId:(id:CrewId)=>void;onStarter:(text:string)=>void}){
  const brief=ROOM_BRIEFS[crewId]??ROOM_BRIEFS.luffy;
  return <div className="mission-start"><span className="start-emblem"><ShipWheel/></span><span className="eyebrow">Brief {CREW_BY_ID.get(crewId)?.name??'the crew'}</span><h3 className="room-brief-heading">{brief.heading}</h3><p>{brief.body}</p><div className="start-fields"><label><span>Project</span><select disabled={disabled} value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">Choose a project…</option>{projects.map(project=><option value={project.id} key={project.id}>{project.name}</option>)}</select></label><label><span>Lead specialist</span><select disabled={disabled} value={crewId} onChange={e=>setCrewId(e.target.value as CrewId)}>{crew.map(crew=><option value={crew.id} key={crew.id}>{crew.name} · {crew.role}</option>)}</select></label></div><div className="room-starters" aria-label="Add a starting point to your draft">{brief.starters.map(starter=><button key={starter.label} disabled={disabled||!projectId} onClick={()=>onStarter(starter.text)}>{starter.label}<ChevronRight/></button>)}</div><small className="room-starter-hint">Starting points add to your draft. You decide when to send.</small></div>;
}

function MissionStatus({task,tasks,onOpen}:{task:Task;tasks:Task[];onOpen:(id:string)=>void}){
 const children=tasks.filter(child=>child.parentTaskId===task.id);
 const waiting=children.find(child=>['waiting','awaiting-approval','unknown','failed'].includes(child.status));
 const target=waiting??task,guide=taskGuidance(target);
 const activity=task.latestActivity;
 return <section className="mission-status" aria-label="Mission status"><div className="mission-status-heading" role="status"><strong>{waiting?CREW_BY_ID.get(waiting.crewId)?.name+' · ':''}{taskLabel(target)}</strong>{children.length?<span>{children.filter(child=>['finished','completed'].includes(child.status)).length} of {children.length} assignments finished</span>:null}</div><p>{guide.detail}</p>{task.selectedSkills?.length?<p>Confirmed skills: {task.selectedSkills.map(skill=>skill.name).join(", ")}</p>:null}{activity?<details><summary>Latest activity</summary><pre>{activity.slice(-1500)}</pre></details>:null}{waiting?<button disabled={false} onClick={()=>onOpen(waiting.id)}>{guide.action} <ChevronRight size={14}/></button>:null}</section>;
}

export function Conversation({task,transcript,crewId,reducedMotion,roomArt}:{task:Task;transcript:ReturnType<typeof useTaskTranscript>;crewId:CrewId;reducedMotion:boolean;roomArt?:string}){
 const container=useRef<HTMLDivElement>(null),follow=useRef(true),anchor=useRef<{height:number;top:number;messageId?:string;offset?:string;anchorTop?:number}|null>(null);
 useEffect(()=>{follow.current=true;anchor.current=null;},[task.id]);
 useEffect(()=>{const element=container.current;if(!element)return;if(anchor.current){const before=anchor.current,item=Array.from(element.querySelectorAll<HTMLElement>('[data-message-id]')).find(item=>item.dataset.messageId===before.messageId&&item.dataset.messageOffset===before.offset);element.scrollTop=before.top+(item&&before.anchorTop!==undefined?item.offsetTop-before.anchorTop:element.scrollHeight-before.height);anchor.current=null;}else if(follow.current)element.scrollTo({top:element.scrollHeight,behavior:reducedMotion?'instant':'auto'});},[task.id,transcript.revision,transcript.segments.length,transcript.segments[0]?.messageId,transcript.segments[0]?.offset,transcript.segments.at(-1)?.text,reducedMotion]);
 const older=()=>{const element=container.current;if(element){const item=Array.from(element.querySelectorAll<HTMLElement>('[data-message-id]')).find(item=>item.offsetTop+item.offsetHeight>=element.scrollTop);anchor.current={height:element.scrollHeight,top:element.scrollTop,messageId:item?.dataset.messageId,offset:item?.dataset.messageOffset,anchorTop:item?.offsetTop};}follow.current=false;transcript.loadOlder();};
 return <div className="conversation" aria-label={`${CREW_BY_ID.get(crewId)?.name??'Crew'} conversation`} ref={container} onScroll={event=>{const element=event.currentTarget;follow.current=element.scrollHeight-element.scrollTop-element.clientHeight<100;}}>{roomArt?<img className="conversation-room-art" src={roomArt} alt="" aria-hidden="true" draggable={false}/>:null}
  {transcript.hasOlder?<button type="button" disabled={transcript.loading} onClick={older}>Load older history</button>:null}
  {transcript.loading?<p role="status">Loading conversation history...</p>:null}
  {transcript.error?<div role="alert"><p>{transcript.error}</p><button type="button" onClick={transcript.retry}>Retry history</button></div>:null}
  {transcript.segments.map(message=><article key={message.messageId+':'+message.offset} data-message-id={message.messageId} data-message-offset={message.offset} className={`message ${message.role}`}><div className="message-avatar">{message.role==='user'?'YOU':message.role==='system'?'HQ':CREW_BY_ID.get(crewId)?.name.slice(0,2).toUpperCase()}</div><div><header><b>{message.role==='user'?'You':message.role==='system'?'Sunny HQ':CREW_BY_ID.get(crewId)?.name}</b><span>{new Date(message.time).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span>{message.offset>0?<small>Continued reply</small>:null}</header><div className="message-text">{message.text||<span className="typing"><i/><i/><i/></span>}</div></div></article>)}
  {!transcript.loading&&!transcript.error&&!transcript.segments.length?(task.messageCount===0?<EmptyState icon="compass" title="Mission opened" body="Send a message to begin the log."/>:<div role="alert"><p>Conversation history is unavailable.</p><button type="button" onClick={transcript.reload}>Reload history</button></div>):null}
  {transcript.hasNewer?<button type="button" disabled={transcript.loading} onClick={transcript.loadNewer}>Load newer history</button>:null}
 </div>;
}

function ApprovalStack({approvals,invoke}:{approvals:Approval[];invoke:Invoke}){
  return approvals.length?<div className="approval-stack">{approvals.map(approval=><ApprovalCard key={approval.id} approval={approval} invoke={invoke}/>)}</div>:null;
}
function ApprovalCard({approval,invoke}:{approval:Approval;invoke:Invoke}){
  const questions=Array.isArray(approval.params?.questions)?approval.params.questions:[];
  const [answerDraft,setAnswerDraft]=useDraft('call-answers:'+approval.id+':'+(approval.binding?.revision??'legacy'),'{}');
  const answers:Record<string,string>=useMemo(()=>{try{return JSON.parse(answerDraft);}catch{return {};}},[answerDraft]);const setAnswers=(update:(prev:Record<string,string>)=>Record<string,string>)=>setAnswerDraft(JSON.stringify(update(answers)));
  const [responding,setResponding]=useState(false),[responseError,setResponseError]=useState('');const respondingRef=useRef(false);
  const respond=async(decision:'accept'|'decline')=>{if(respondingRef.current)return;respondingRef.current=true;setResponding(true);setResponseError('');try{await invoke('approval:respond',{id:approval.id,decision,answers,...(approval.binding?{binding:approval.binding}:{})});}catch(error){setResponseError(error instanceof Error?error.message:String(error));}finally{respondingRef.current=false;setResponding(false);}};
  const evidence=[['Command',approval.params?.command],['Reason',approval.params?.reason],['File changes',approval.params?.changes],['Permission paths',approval.params?.permissions]].filter(([,value])=>value!==undefined&&value!==null);
  return <section className="approval-card"><div className="approval-icon"><Check/></div><div><span className="eyebrow">Crew needs permission</span><h4>{approval.params?.title??({'item/commandExecution/requestApproval':'Run a command','item/fileChange/requestApproval':'Apply file changes','item/permissions/requestApproval':'Grant requested access','item/tool/requestUserInput':'Your input is needed','mcpServer/elicitation/request':'Connected tool request'} as Record<string,string>)[approval.method]??'Review requested action'}</h4><p>{approval.params?.description??'Review this requested action before the mission continues.'}</p>{evidence.length?<div className="approval-evidence">{evidence.map(([label,value])=><div key={String(label)}><b>{String(label)}</b><pre>{typeof value==='string'?value:JSON.stringify(value,null,2)}</pre></div>)}</div>:null}{questions.map((question:any,index:number)=>{const key=question.id??String(index),label=question.question??question.title??question.label??`Answer ${index+1}`,options=Array.isArray(question.options)?question.options:[];return <label key={key}><span>{label}</span>{options.length?<select value={answers[key]??''} onChange={e=>setAnswers(prev=>({...prev,[key]:e.target.value}))}><option value="">Choose…</option>{options.map((option:any)=><option key={String(option.value??option.label??option)} value={String(option.value??option.label??option)}>{String(option.label??option)}</option>)}</select>:<input value={answers[key]??''} onChange={e=>setAnswers(prev=>({...prev,[key]:e.target.value}))}/>}</label>})}<div className="approval-actions"><button disabled={responding} onClick={()=>void respond('accept')} className="approve">{responding?'Sending…':'Approve'}</button><button disabled={responding} onClick={()=>void respond('decline')}>Decline</button></div>{responseError?<p role="alert">{responseError}</p>:null}</div></section>;
}

function FilesPane({locked,project,invoke,toast,onDirtyChange}:{locked:boolean;project:Project;invoke:Invoke;toast:(message:string,tone?:'default'|'success'|'error')=>void;onDirtyChange:(dirty:boolean)=>void}){
  const [files,setFiles]=useState<FileEntry[]>([]),[openFile,setOpenFile]=useState<FileData|null>(null),[text,setText]=useState(''),[loading,setLoading]=useState(true),[directory,setDirectory]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const operation=useRef(false),revision=useRef(0),textRef=useRef(text);textRef.current=text;
  const dirty=Boolean(openFile&&text!==openFile.text);
  useEffect(()=>{onDirtyChange(dirty);const block=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',block);return()=>window.removeEventListener('beforeunload',block);},[dirty,onDirtyChange]);
  const list=async(next:string)=>{
    const request=++revision.current;setLoading(true);setError('');
    try{const result=await invoke<FileEntry[]>('files:list',{projectId:project.id,path:next});if(request===revision.current){setFiles(result);setDirectory(next);}}
    catch(error){if(request===revision.current)setError(error instanceof Error?error.message:String(error));}
    finally{if(request===revision.current)setLoading(false);}
  };
  useEffect(()=>{void list('');return()=>{revision.current++;};},[project.id,invoke]);
  const open=async(file:FileEntry)=>{
    if(operation.current||saving||locked)return;
    if(file.directory){await list(file.path);return;}
    if(dirty&&!window.confirm('Discard your unsaved file changes?'))return;
    operation.current=true;setError('');
    try{const data=await invoke<FileData>('files:read',{projectId:project.id,path:file.path});setOpenFile(data);setText(data.text);}
    catch(error){setError(error instanceof Error?error.message:String(error));}
    finally{operation.current=false;}
  };
  const save=async()=>{
    if(!openFile||operation.current||locked)return;
    operation.current=true;setSaving(true);setError('');const submitted=text;
    try{const data=await invoke<FileData>('files:write',{projectId:project.id,path:openFile.path,text:submitted,hash:openFile.hash});setOpenFile(data);if(textRef.current===submitted)setText(data.text);toast('File saved.','success');}
    catch(error){setError(error instanceof Error?error.message:String(error));}
    finally{operation.current=false;setSaving(false);}
  };
  const normalizePath=(value:string)=>value.replaceAll('\\','/').replace(/\/$/,'').toLowerCase();
  const atRoot=!directory||directory==='.'||normalizePath(directory)===normalizePath(project.path);
  const parent=directory.replace(/\\/g,'/').split('/').slice(0,-1).join('/');
  return <div className="files-pane"><div className="pane-toolbar"><span><FileCode2/> {openFile?.path??project.name}{dirty?' · Unsaved':''}</span>{openFile?<button onClick={()=>void save()} disabled={!dirty||saving||locked}><Save/>{saving?'Saving…':'Save'}</button>:null}</div>{error?<div className="file-load-error" role="alert">{error}</div>:null}<div className="file-workspace"><div className="file-tree"><button className="file-up" disabled={atRoot||loading} onClick={()=>void list(parent)}><ArrowLeft/><span>{atRoot?'Project files':'Up one folder'}</span></button>{loading?<LoaderCircle className="spin"/>:files.map(file=><button key={file.path} onClick={()=>void open(file)} className={openFile?.path===file.path?'active':''}>{file.directory?<ChevronRight/>:<File/>}<span>{file.name}</span></button>)}</div><div className="editor-wrap">{openFile?<Suspense fallback={<p className="file-load-error">Opening editor…</p>}><CodeEditor readOnly={locked} path={project.id+'/'+openFile.path} value={text} onChange={setText}/></Suspense>:<EmptyState title="Choose a file" body="Open a file to edit it. Use Up one folder to return to its parent folder."/>}</div></div></div>;
}

function GitPane({project,invoke,toast}:{project:Project;invoke:Invoke;toast:(message:string,tone?:'default'|'success'|'error')=>void}){
  type GitState={branch:string;files:{path:string;status:string}[];diff:string};
  const [git,setGit]=useState<GitState|null>(null),[selected,setSelected]=useState<string[]>([]),[diff,setDiff]=useState(''),[message,setMessage]=useState('');
  const refresh=()=>invoke<GitState>('git:status',{projectId:project.id}).then(data=>{setGit(data);setDiff(data.diff);});useEffect(()=>{void refresh();},[project.id]);
  const choose=async(path:string)=>{setDiff(await invoke<string>('git:diff',{projectId:project.id,path}));};
  const commit=async()=>{if(!message.trim()||!selected.length)return;await invoke('git:commit',{projectId:project.id,paths:selected,message:message.trim()});toast('Commit created.','success');setSelected([]);setMessage('');await refresh();};
  return <div className="git-pane"><div className="git-sidebar"><div className="git-branch"><GitBranch/>{git?.branch??'Loading…'}</div><span className="pane-label">Changes</span>{git?.files.length?git.files.map(file=><div className="git-file" key={file.path}><input type="checkbox" checked={selected.includes(file.path)} onChange={()=>setSelected(prev=>prev.includes(file.path)?prev.filter(p=>p!==file.path):[...prev,file.path])}/><button onClick={()=>void choose(file.path)}><span>{file.path}</span><em>{file.status}</em></button></div>):<p className="clean-tree">Working tree is clean.</p>}<textarea placeholder="Commit message" value={message} onChange={e=>setMessage(e.target.value)}/><button className="commit-button" disabled={!selected.length||!message.trim()} onClick={()=>void commit()}><GitCommitHorizontal/>Commit {selected.length||''}</button></div><pre className="diff-view">{diff||'Select a changed file to inspect its diff.'}</pre></div>;
}


function PreviewPane({invoke}:{invoke:Invoke}){
  const [url,setUrl]=useState('http://127.0.0.1:5173');const safe=useMemo(()=>/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(url),[url]);
  return <div className="preview-pane"><div className="preview-bar"><button onClick={()=>void invoke('preview:open',{url})} disabled={!safe}><Play/>Open</button><input value={url} onChange={e=>setUrl(e.target.value)} aria-label="Local preview URL"/><button onClick={()=>void invoke('dialog:openExternal',{url})} disabled={!safe}><Eye/>Browser</button></div><div className="preview-empty"><span className="preview-window"><i/><i/><i/></span><Code2/><h3>Local preview</h3><p>Enter a localhost URL, then open the live app in Sunny HQ. Preview launch is handled by the desktop runtime.</p></div></div>;
}
