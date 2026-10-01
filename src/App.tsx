import './island.css';
import {MorgansView} from './views/MorgansView';
import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {FolderPlus,Plus} from 'lucide-react';
import type {CrewId,Project,WorkContext} from './shared';
import {useSunny} from './useSunny';
import {Sidebar,Toasts,Topbar,type ViewId} from './components/Chrome';
import {CrewView,InboxView,MissionsView,ProjectsView,ShipView} from './views/DashboardViews';
import {IslandView} from './views/IslandView';
import {HomeView} from './views/HomeView';
import {ProjectRoom} from './views/ProjectRoom';
import {MissionBoard} from './views/MissionBoard';
import {LibraryView,SettingsView,ToolsView} from './views/OpsViews';
import {CaptainLog} from './components/CaptainLog';
import {FrankyWorkshop} from './components/FrankyWorkshop';
import {projectMission} from './missionProjection';
import {roomRequest} from './roomActivity';
import {resolveWorkContext,workspaceReturnTarget} from './workContext';
import {updateWorkspace} from './useDraft';
const Workbench=lazy(()=>import('./views/Workbench').then(module=>({default:module.Workbench})));
type WorkspaceInit={taskId?:string;projectId?:string;missionId?:string;attemptId?:string;crewId?:CrewId;prompt?:string;draftKey?:string};
const viewTitles:Record<ViewId,{title:string;subtitle:string}>={home:{title:'Home',subtitle:'Your daily workspace'},news:{title:"Morgans' blimp",subtitle:'The flying press'},island:{title:'The Island',subtitle:'Your growing AI world'},ship:{title:'The Sunny',subtitle:'Command deck'},projects:{title:'Projects',subtitle:'Local cargo'},crew:{title:'Crew',subtitle:'Your specialists'},missions:{title:'Missions',subtitle:'Templates & routes'},library:{title:'Library',subtitle:'Obsidian knowledge'},tools:{title:'Tools',subtitle:'Workshop'},inbox:{title:'Inbox',subtitle:'Mission signals'},settings:{title:'Settings',subtitle:"Captain's quarters"}};
export default function App(){
 const sunny=useSunny(),{snapshot,invoke,toast}=sunny;
 const [sceneExpanded,setSceneExpanded]=useState(()=>!window.matchMedia('(max-width:1180px),(max-height:760px)').matches);
 const [frankyPaused,setFrankyPaused]=useState(false);
 const [roomStop,setRoomStop]=useState<{taskId?:string;pending:boolean;error:string;requested:boolean}>({pending:false,error:'',requested:false}),roomStopInFlight=useRef(false);
 const [roomProjectId,setRoomProjectId]=useState<string>(),[view,setView]=useState<ViewId>('ship'),[menu,setMenu]=useState(false),[launchPending,setLaunchPending]=useState(false);
 const [workspace,setWorkspace]=useState<WorkspaceInit|null>(null),[workspaceSession,setWorkspaceSession]=useState(0),[context,setContext]=useState<WorkContext|null>(null),[activeProjectId,setActiveProjectId]=useState<string>(),[contextError,setContextError]=useState('');
 useEffect(()=>{const media=window.matchMedia('(max-width:1180px),(max-height:760px)');const resize=()=>setSceneExpanded(!media.matches);media.addEventListener('change',resize);return()=>media.removeEventListener('change',resize);},[]);
 const initialized=useRef(false),guard=useRef<()=>boolean>(()=>true),opener=useRef<HTMLElement|null>(null),returnView=useRef<ViewId>('ship');
 const restoreFocus=()=>requestAnimationFrame(()=>{if(opener.current?.isConnected)opener.current.focus();else document.querySelector<HTMLElement>('.captain-review-mission,.work-entry,.workspace-return')?.focus();});
 const persistContext=(next:WorkContext|null)=>{setContext(next);setActiveProjectId(next?.projectId);setContextError('');if(window.sunny)void updateWorkspace(invoke,{context:next}).catch(error=>setContextError(`Navigation is unsaved: ${error instanceof Error?error.message:String(error)}`));};
 useEffect(()=>{if(!sunny.ready||initialized.current)return;initialized.current=true;const saved=snapshot.workspace?.context??null;setContext(saved);setActiveProjectId(saved?.projectId);if(saved?.surface==='workbench')setWorkspace({projectId:saved.projectId,missionId:saved.missionId,attemptId:saved.attemptId,taskId:saved.taskId});},[sunny.ready,snapshot.workspace]);
 const navigate=(next:ViewId)=>{if(!guard.current())return;if(workspace){returnView.current=view;setWorkspace(null);}setView(next);setRoomProjectId(undefined);setMenu(false);};
 const openWorkspace=(init:WorkspaceInit)=>{
  if(!guard.current())return;opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const task=snapshot.tasks.find(t=>t.id===init.taskId),mission=(snapshot.missions??[]).find(m=>m.id===init.missionId||Boolean(init.taskId&&m.taskIds.includes(init.taskId)));
  const attempt=mission?.attempts.find(a=>init.attemptId?a.id===init.attemptId:Boolean(init.taskId&&a.taskIds.includes(init.taskId)))??(!init.taskId?mission?.attempts.find(a=>a.id===mission.activeAttemptId):undefined);
  const projectId=init.projectId??task?.projectId??mission?.projectId;
  const next=projectId?{projectId,missionId:init.missionId??mission?.id,attemptId:init.attemptId??attempt?.id,taskId:init.taskId,surface:'workbench' as const,returnTo:workspaceReturnTarget(context,{projectId,missionId:init.missionId??mission?.id,taskId:init.taskId},view,Boolean(workspace))}:null;
  persistContext(next);setWorkspace({...init,projectId,missionId:next?.missionId,attemptId:next?.attemptId});setWorkspaceSession(n=>n+1);setView('ship');setMenu(false);
 };
 const selectContext=(next:WorkContext)=>{if(!guard.current())return;opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;persistContext(next);setWorkspace(null);setView(next.missionId?'missions':'ship');setMenu(false);};
 const closeWorkspace=()=>{const target=context?.returnTo.view;setWorkspace(null);setView(target&&target in viewTitles?target as ViewId:'ship');if(context)persistContext({...context,taskId:context.returnTo.taskId,surface:'deck'});restoreFocus();};
 const returnToWork=()=>{if(!guard.current())return;if(context?.surface==='franky'){setWorkspace(null);setView('ship');restoreFocus();return;}if(context?.taskId){setWorkspace({projectId:context.projectId,missionId:context.missionId,attemptId:context.attemptId,taskId:context.taskId});setWorkspaceSession(n=>n+1);setView('ship');}else setView(context?.missionId?'missions':returnView.current);restoreFocus();};
 useEffect(()=>window.sunny?.subscribe(event=>{if(event.type==='workspace:open')openWorkspace(event.data);}),[context,view,snapshot]);
 const importProject=async()=>{try{const project=await invoke<Project|null>('project:add');if(!project)return;sunny.setSnapshot(prev=>({...prev,projects:prev.projects.some(p=>p.id===project.id)?prev.projects:[...prev.projects,project]}));toast(`${project.name} is aboard.`,'success');setActiveProjectId(project.id);}catch{}};
 const removeProject=async(projectId:string)=>{await invoke('project:remove',{projectId});sunny.setSnapshot(prev=>({...prev,projects:prev.projects.filter(p=>p.id!==projectId)}));toast('Project removed from Sunny HQ.','success');};
 const topActions=useMemo(()=>view==='projects'?<button className="top-action" onClick={()=>void importProject()}><FolderPlus/>Import</button>:<button className="top-action" onClick={()=>navigate('home')}><Plus/>New goal</button>,[view,workspace]);
 const resolved=resolveWorkContext(context,snapshot);
 const projection=context?projectMission(snapshot,context):undefined;
 const inFrankyRoom=Boolean(context?.surface==='franky'&&view==='ship'&&!workspace);
 const openFrankyRoom=()=>{if(!context||!guard.current())return;opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;persistContext({...context,surface:'franky',returnTo:workspaceReturnTarget(context,context,view,Boolean(workspace))});setWorkspace(null);setView('ship');};
 const inspectRoom=()=>{if(projection?.taskId)openWorkspace({projectId:context?.projectId,missionId:projection.missionId,attemptId:projection.attemptId,taskId:projection.taskId});else if(context)selectContext({...context,surface:'deck'});};
 const inspectRoomApproval=()=>{const request=projection?roomRequest(snapshot,projection):undefined;if(request?.taskId)openWorkspace({taskId:request.taskId,projectId:context?.projectId,missionId:projection?.missionId,attemptId:projection?.attemptId});else inspectRoom();};
 const stopRoomWork=async()=>{const taskId=projection?.taskId;if(!taskId||roomStopInFlight.current)return;roomStopInFlight.current=true;setRoomStop({taskId,pending:true,error:'',requested:false});try{await invoke('task:interrupt',{taskId});setRoomStop({taskId,pending:false,error:'',requested:true});}catch(error){setRoomStop({taskId,pending:false,error:`Stop could not be confirmed: ${error instanceof Error?error.message:String(error)}`,requested:false});}finally{roomStopInFlight.current=false;}};
 const workspaceUnavailable=resolved.unavailable??(workspace?.taskId&&!snapshot.tasks.some(t=>t.id===workspace.taskId)?'Task unavailable. Your selected task ID is retained.':workspace?.missionId&&!snapshot.missions?.some(m=>m.id===workspace.missionId)?'Mission unavailable. Your selected mission ID is retained.':undefined);
 if(!sunny.ready)return <div className="loading-deck" role="status"><span/><h2>Getting your workspace ready.</h2></div>;
 if(sunny.loadError)return <div className="loading-deck" role="alert"><h2>Your workspace couldn't load</h2><p>{sunny.loadError}</p><button className="primary-button" onClick={()=>window.location.reload()}>Reload Sunny</button></div>;
 return <div className={`app-shell continuous-shell ${snapshot.settings.reducedMotion?'reduce-motion':''}`}>
  <Sidebar view={view} onView={navigate} projects={snapshot.projects} tasks={snapshot.tasks} activeProjectId={activeProjectId} onProject={id=>openWorkspace({projectId:id})} open={menu} onToggle={()=>setMenu(value=>!value)}/>
  {menu?<button className="mobile-scrim" onClick={()=>setMenu(false)} aria-label="Close navigation"/>:null}
  <div className="main-shell"><Topbar title={viewTitles[view].title} subtitle={viewTitles[view].subtitle} desktop={sunny.desktop} codexStatus={snapshot.codex.status} onMenu={()=>setMenu(true)} actions={<>{sunny.desktop?<button className="float-ship-button" onClick={()=>void invoke('companion:show').catch(()=>{})}>Ship on desktop</button>:null}{['settings','library','tools'].includes(view)&&context?<button className="workspace-return" onClick={returnToWork}>Return to work</button>:null}{topActions}</>}/>
   {contextError?<div className="workspace-draft-status" role="alert">{contextError}<button onClick={()=>persistContext(context)}>Save navigation again</button></div>:null}
   {snapshot.persistence?.state==='unsaved'?<div className="workspace-draft-status" role="alert">Sunny has unsaved changes. Keep this window open and export important drafts.</div>:null}
   <div className="continuous-content"><div className="journey-surface">
    {context&&!inFrankyRoom&&['ship','missions'].includes(view)?<button className="workspace-return" onClick={openFrankyRoom}>Open Franky's workshop</button>:null}
    {inFrankyRoom&&projection?<FrankyWorkshop projection={projection} reducedMotion={snapshot.settings.reducedMotion} paused={frankyPaused} onPause={()=>setFrankyPaused(value=>!value)} onInspect={inspectRoom} onApproval={inspectRoomApproval} onStop={()=>void stopRoomWork()} stopPending={roomStop.pending} stopError={roomStop.taskId===projection.taskId?roomStop.error:''} stopRequested={roomStop.taskId===projection.taskId&&roomStop.requested} claimAcceptanceCue={async()=>projection.acceptanceId?Boolean((await invoke<{play:boolean}>('workspace:claimAcceptanceCue',{acceptanceId:projection.acceptanceId})).play):false} onBack={()=>{if(context)persistContext({...context,surface:'deck'});restoreFocus();}}/>:workspace?workspaceUnavailable?<div className="page" role="alert"><p>{workspaceUnavailable}</p><button className="workspace-return" onClick={closeWorkspace}>Return to deck</button></div>:<Suspense fallback={<div className="loading-deck"><h2>Opening the workbench.</h2></div>}><Workbench key={workspaceSession} embedded snapshot={snapshot} initial={workspace} invoke={invoke} toast={toast} onClose={closeWorkspace} onSettings={()=>{setWorkspace(null);setView('settings');}} onOpenLibrary={()=>{setWorkspace(null);setView('library');}} onNavigationGuard={fn=>{guard.current=fn??(()=>true);}} onTaskChange={taskId=>{if(context){const mission=(snapshot.missions??[]).find(m=>m.taskIds.includes(taskId));const attempt=mission?.attempts.find(a=>a.taskIds.includes(taskId));persistContext({...context,taskId,missionId:mission?.id,attemptId:attempt?.id});setWorkspace(previous=>previous?{...previous,taskId}:previous);}}}/></Suspense>:<>
     {view==='home'?<HomeView launchPending={launchPending} onLaunchPending={setLaunchPending} snapshot={snapshot} invoke={invoke} onWorkspace={openWorkspace} onImport={()=>void importProject()} onExplore={()=>navigate('island')} onSettings={()=>navigate('settings')} onMission={mission=>selectContext({projectId:mission.projectId,missionId:mission.id,attemptId:mission.activeAttemptId,surface:'deck',returnTo:{view:'ship',projectId:mission.projectId,missionId:mission.id}})}/>:null}
     {view==='ship'?<><details className="journey-scene" open={sceneExpanded} onToggle={e=>setSceneExpanded(e.currentTarget.open)}><summary>The Sunny deck</summary><ShipView compact context={context} snapshot={snapshot} onWorkspace={openWorkspace} onNavigate={navigate} onImport={()=>void importProject()} invoke={invoke} toast={toast}/></details><HomeView launchPending={launchPending} onLaunchPending={setLaunchPending} snapshot={snapshot} invoke={invoke} onWorkspace={openWorkspace} onImport={()=>void importProject()} onExplore={()=>navigate('island')} onSettings={()=>navigate('settings')} onMission={mission=>selectContext({projectId:mission.projectId,missionId:mission.id,attemptId:mission.activeAttemptId,surface:'deck',returnTo:{view:'ship',projectId:mission.projectId,missionId:mission.id}})}/></>:null}
     {view==='missions'?<><MissionBoard snapshot={snapshot} invoke={invoke} onOpen={(taskId,selection)=>openWorkspace({taskId,...selection})} focusMission={context?.missionId?{id:context.missionId,sequence:0}:undefined} onSelectMission={mission=>persistContext({projectId:mission.projectId,missionId:mission.id,attemptId:mission.activeAttemptId,surface:'deck',returnTo:{view:'ship',projectId:mission.projectId,missionId:mission.id}})}/><details><summary>Conversation starters</summary><MissionsView automations={snapshot.automations} onStart={(crewId,prompt)=>openWorkspace({projectId:activeProjectId,crewId,prompt})}/></details></>:null}
     {view==='island'&&roomProjectId?<ProjectRoom projectId={roomProjectId} snapshot={snapshot} invoke={invoke} onBack={()=>setRoomProjectId(undefined)} onOpen={taskId=>openWorkspace({taskId})}/>:null}
     {view==='island'&&!roomProjectId?<IslandView onProjectRoom={id=>setRoomProjectId(id)} snapshot={snapshot} invoke={invoke} onWorkspace={openWorkspace} onShip={()=>navigate('ship')} onNews={()=>navigate('news')}/>:null}
     {view==='news'?<MorgansView snapshot={snapshot} invoke={invoke} onWorkspace={openWorkspace} onBack={()=>navigate('island')}/>:null}
     {view==='projects'?<ProjectsView projects={snapshot.projects} tasks={snapshot.tasks} onImport={()=>void importProject()} onOpen={id=>openWorkspace({projectId:id})} onRemove={id=>void removeProject(id)}/>:null}
     {view==='crew'?<CrewView snapshot={snapshot} invoke={invoke} onSelect={crewId=>openWorkspace({projectId:activeProjectId,crewId})}/>:null}
     {view==='library'?<LibraryView projects={snapshot.projects} activeProjectId={activeProjectId} invoke={invoke} toast={toast} onAskRobin={(projectId,prompt,draftKey)=>openWorkspace({projectId,crewId:'robin',prompt,draftKey})}/>:null}
     {view==='tools'?<ToolsView tools={snapshot.tools} projects={snapshot.projects} desktop={sunny.desktop} invoke={invoke} toast={toast}/>:null}
     {view==='inbox'?<InboxView tasks={snapshot.tasks} automations={snapshot.automations} desktop={sunny.desktop} invoke={invoke} onOpen={taskId=>openWorkspace({taskId})}/>:null}
     {view==='settings'?<SettingsView snapshot={snapshot} invoke={invoke} mergeSnapshot={sunny.mergeSnapshot} toast={toast}/>:null}
    </>}
   </div><CaptainLog snapshot={snapshot} context={context} onContext={selectContext} onOpenResult={taskId=>openWorkspace({taskId})} onRequestChanges={missionId=>{const mission=snapshot.missions?.find(m=>m.id===missionId);if(mission)selectContext({projectId:mission.projectId,missionId,attemptId:mission.activeAttemptId,surface:'deck',returnTo:{view:'ship',missionId,projectId:mission.projectId}});}} invoke={invoke}/></div>
  </div><Toasts items={sunny.toasts}/>
 </div>;
}
