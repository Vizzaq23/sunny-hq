import './island.css';
import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {FolderPlus,Plus} from 'lucide-react';
import type {CrewId,Project,WorkReportPacket,WorkReportResult,WorkReportItem} from './shared';
import {useSunny} from './useSunny';
import {Sidebar,Toasts,Topbar,type ViewId} from './components/Chrome';
import {HomeView} from './views/HomeView';
import {ProjectRoom} from './views/ProjectRoom';
import {MissionBoard} from './views/MissionBoard';

const Workbench=lazy(()=>import('./views/Workbench').then(module=>({default:module.Workbench})));
const MorgansView=lazy(()=>import('./views/MorgansView').then(module=>({default:module.MorgansView})));
const IslandView=lazy(()=>import('./views/IslandView').then(module=>({default:module.IslandView})));
const ShipView=lazy(()=>import('./views/DashboardViews').then(module=>({default:module.ShipView})));
const CrewView=lazy(()=>import('./views/DashboardViews').then(module=>({default:module.CrewView})));
const InboxView=lazy(()=>import('./views/DashboardViews').then(module=>({default:module.InboxView})));
const MissionsView=lazy(()=>import('./views/DashboardViews').then(module=>({default:module.MissionsView})));
const ProjectsView=lazy(()=>import('./views/DashboardViews').then(module=>({default:module.ProjectsView})));
const LibraryView=lazy(()=>import('./views/OpsViews').then(module=>({default:module.LibraryView})));
const ToolsView=lazy(()=>import('./views/OpsViews').then(module=>({default:module.ToolsView})));
const SettingsView=lazy(()=>import('./views/OpsViews').then(module=>({default:module.SettingsView})));
type WorkspaceInit={taskId?:string;projectId?:string;crewId?:CrewId;prompt?:string;draftKey?:string};
export type ReportViewState={result:WorkReportResult|null;draft:string;dirty:boolean;saved:boolean;title:string};
function appendReportSources(answer:string,packet:WorkReportPacket){
  const items=packet.projects.flatMap(project=>[...project.tasks,...project.missions,...project.observations]);
  const sources=items.map(item=>`- ${item.kind} ${item.sourceId} · ${new Date(item.sourceTime).toISOString()} · project ${item.projectId}`).join('\n');
  return `${answer.trim()}\n\n## Saved Sunny sources\nPacket: ${new Date(packet.createdAt).toISOString()}\nScope: ${packet.scope.projectIds.join(', ')||'none'}\n${sources||'No saved records in this scope.'}`;
}
const viewTitles:Record<ViewId,{title:string;subtitle:string}>={home:{title:'Home',subtitle:'Your daily workspace'},news:{title:'Morgans’ blimp',subtitle:'The flying press'},island:{title:'The Island',subtitle:'Your growing AI world'},ship:{title:'The Sunny',subtitle:'Command deck'},projects:{title:'Projects',subtitle:'Local cargo'},crew:{title:'Crew',subtitle:'Your specialists'},missions:{title:'Missions',subtitle:'Templates & routes'},library:{title:'Library',subtitle:'Obsidian knowledge'},tools:{title:'Tools',subtitle:'Workshop'},inbox:{title:'Inbox',subtitle:'Mission signals'},settings:{title:'Settings',subtitle:'Captain’s quarters'}};

export default function App(){
  const sunny=useSunny();
  const {snapshot,invoke,toast}=sunny;
  const [roomProjectId,setRoomProjectId]=useState<string>();
  const [view,setView]=useState<ViewId>('home');
  const [menu,setMenu]=useState(false);
  const [launchPending,setLaunchPending]=useState(false);
  const [workspace,setWorkspace]=useState<WorkspaceInit|null>(null);
  const [activeProjectId,setActiveProjectId]=useState<string>();
  const [reportView,setReportView]=useState<ReportViewState>({result:null,draft:'',dirty:false,saved:false,title:'Morgans work report'});
  const [focusMission,setFocusMission]=useState<{id:string;sequence:number}>();
  const reporterTask=snapshot.tasks.find(task=>task.id===reportView.result?.task?.id);
  useEffect(()=>{if(!reportView.dirty||reportView.saved)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[reportView.dirty,reportView.saved]);
  useEffect(()=>{if(reporterTask?.status!=='finished')return;setReportView(current=>{
    if(!current.result||current.dirty||current.draft||current.result.task?.id!==reporterTask.id)return current;
    const answer=[...reporterTask.messages].reverse().find(message=>message.role==='assistant')?.text;
    return answer?{...current,draft:appendReportSources(answer,current.result.packet)}:current;
  });},[reporterTask?.status,reporterTask?.messages]);
  useEffect(()=>window.sunny?.subscribe(event=>{if(event.type==='workspace:open'){if(workspace&&!window.confirm('Switch workspaces? Unsaved drafts and file edits in the current workspace will be discarded.'))return;setWorkspace(event.data);}}),[workspace]);
  const titles=viewTitles[view];
  const navigate=(next:ViewId)=>{setView(next);setRoomProjectId(undefined);setMenu(false);};
  const openWorkspace=(init:WorkspaceInit)=>{setActiveProjectId(init.projectId??snapshot.tasks.find(task=>task.id===init.taskId)?.projectId);setWorkspace(init);};
  const openReportSource=(item:WorkReportItem)=>{if(item.target.view==='task')openWorkspace({taskId:item.target.id});else{setFocusMission(previous=>({id:item.target.id,sequence:(previous?.sequence??0)+1}));navigate('missions');}};
  const importProject=async()=>{try{const project=await invoke<Project|null>('project:add');if(!project)return;sunny.setSnapshot(previous=>({...previous,projects:previous.projects.some(item=>item.id===project.id)?previous.projects:[...previous.projects,project]}));toast(`${project.name} is aboard.`,'success');setActiveProjectId(project.id);}catch{/* invoke reports errors */}};
  const removeProject=async(projectId:string)=>{await invoke('project:remove',{projectId});sunny.setSnapshot(previous=>({...previous,projects:previous.projects.filter(project=>project.id!==projectId)}));toast('Project removed from Sunny HQ.','success');};
  const topActions=useMemo(()=>view==='projects'?<button className="top-action" onClick={()=>void importProject()}><FolderPlus/>Import</button>:view!=='home'?<button className="top-action" onClick={()=>openWorkspace({projectId:activeProjectId??snapshot.projects[0]?.id,crewId:'luffy'})}><Plus/>New task</button>:null,[view,snapshot.projects,activeProjectId]);

  if(!sunny.ready)return <div className="loading-deck" role="status"><span/><h2>Getting your workspace ready…</h2></div>;
  if(sunny.loadError)return <div className="loading-deck" role="alert"><h2>Your workspace couldn’t load</h2><p>{sunny.loadError}</p><button className="primary-button" onClick={()=>window.location.reload()}>Reload Sunny</button></div>;
  if(workspace)return <><Suspense fallback={<div className="loading-deck"><span/><h2>Opening the workbench…</h2></div>}><Workbench key={JSON.stringify(workspace)} snapshot={snapshot} initial={workspace} invoke={invoke} toast={toast} onClose={()=>setWorkspace(null)} onSettings={()=>{setWorkspace(null);navigate('settings');}} onOpenLibrary={()=>{setWorkspace(null);navigate('library');}}/></Suspense><Toasts items={sunny.toasts}/></>;
  return <div className={`app-shell ${snapshot.settings.reducedMotion?'reduce-motion':''}`}>
    {sunny.desktop?<button className="float-ship-button" onClick={()=>void invoke('companion:show').catch(()=>{})}>↗ Ship on desktop</button>:null}
    <Sidebar view={view} onView={navigate} projects={snapshot.projects} tasks={snapshot.tasks} activeProjectId={activeProjectId} onProject={id=>openWorkspace({projectId:id})} open={menu} onToggle={()=>setMenu(value=>!value)}/>
    {menu?<button className="mobile-scrim" onClick={()=>setMenu(false)} aria-label="Close navigation"/>:null}
    <div className="main-shell"><Topbar title={titles.title} subtitle={titles.subtitle} desktop={sunny.desktop} codexStatus={snapshot.codex.status} onMenu={()=>setMenu(true)} actions={topActions}/><Suspense key={view} fallback={<div className="page-scroll"><div className="loading-deck"><span/><h2>Loading the deck…</h2></div></div>}><div className="page-scroll">
      {view==='home'?<HomeView launchPending={launchPending} onLaunchPending={setLaunchPending} snapshot={snapshot} invoke={invoke} onWorkspace={openWorkspace} onImport={()=>void importProject()} onExplore={()=>navigate('island')} onSettings={()=>navigate('settings')}/>:null}
      {view==='island'&&roomProjectId?<ProjectRoom projectId={roomProjectId} snapshot={snapshot} invoke={invoke} onBack={()=>setRoomProjectId(undefined)} onOpen={taskId=>openWorkspace({taskId})}/>:null}
      {view==='island'&&!roomProjectId?<IslandView onProjectRoom={id=>setRoomProjectId(id)} snapshot={snapshot} invoke={invoke} onWorkspace={openWorkspace} onShip={()=>navigate('ship')} onNews={()=>navigate('news')}/>:null}
      {view==='news'?<MorgansView snapshot={snapshot} invoke={invoke} onWorkspace={openWorkspace} onBack={()=>navigate('island')} reportView={reportView} setReportView={setReportView} onReportSource={openReportSource}/>:null}
      {view==='ship'?<ShipView snapshot={snapshot} onWorkspace={openWorkspace} onNavigate={navigate} onImport={()=>void importProject()} invoke={invoke} toast={toast}/>:null}
      {view==='projects'?<ProjectsView projects={snapshot.projects} tasks={snapshot.tasks} onImport={()=>void importProject()} onOpen={id=>openWorkspace({projectId:id})} onRemove={id=>void removeProject(id)}/>:null}
      {view==='crew'?<CrewView snapshot={snapshot} invoke={invoke} onSelect={crewId=>openWorkspace({projectId:snapshot.projects[0]?.id,crewId})}/>:null}
      {view==='missions'?<><MissionBoard snapshot={snapshot} invoke={invoke} onOpen={taskId=>openWorkspace({taskId})} focusMission={focusMission}/><MissionsView automations={snapshot.automations} onStart={(crewId,prompt)=>openWorkspace({projectId:snapshot.projects[0]?.id,crewId,prompt})}/></>:null}
      {view==='library'?<LibraryView projects={snapshot.projects} activeProjectId={activeProjectId} invoke={invoke} toast={toast} onAskRobin={(projectId,prompt,draftKey)=>openWorkspace({projectId,crewId:'robin',prompt,draftKey})}/>:null}
      {view==='tools'?<ToolsView tools={snapshot.tools} projects={snapshot.projects} desktop={sunny.desktop} invoke={invoke} toast={toast}/>:null}
      {view==='inbox'?<InboxView tasks={snapshot.tasks} automations={snapshot.automations} desktop={sunny.desktop} invoke={invoke} onOpen={taskId=>openWorkspace({taskId})}/>:null}
      {view==='settings'?<SettingsView snapshot={snapshot} invoke={invoke} mergeSnapshot={sunny.mergeSnapshot} toast={toast}/>:null}
    </div></Suspense></div><Toasts items={sunny.toasts}/>
  </div>;
}
