import './island.css';
import {MorgansView} from './views/MorgansView';
import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {FolderPlus,Plus} from 'lucide-react';
import type {CrewId,Project} from './shared';
import {useSunny} from './useSunny';
import {Sidebar,Toasts,Topbar,type ViewId} from './components/Chrome';
import {CrewView,InboxView,MissionsView,ProjectsView,ShipView} from './views/DashboardViews';
import {IslandView} from './views/IslandView';
import {LibraryView,SettingsView,ToolsView} from './views/OpsViews';

const Workbench=lazy(()=>import('./views/Workbench').then(module=>({default:module.Workbench})));
type WorkspaceInit={taskId?:string;projectId?:string;crewId?:CrewId;prompt?:string};
const viewTitles:Record<ViewId,{title:string;subtitle:string}>={news:{title:'Morgans’ blimp',subtitle:'The flying press'},island:{title:'The Island',subtitle:'Your growing AI world'},ship:{title:'The Sunny',subtitle:'Command deck'},projects:{title:'Projects',subtitle:'Local cargo'},crew:{title:'Crew',subtitle:'Your specialists'},missions:{title:'Missions',subtitle:'Templates & routes'},library:{title:'Library',subtitle:'Obsidian knowledge'},tools:{title:'Tools',subtitle:'Workshop'},inbox:{title:'Inbox',subtitle:'Mission signals'},settings:{title:'Settings',subtitle:'Captain’s quarters'}};

export default function App(){
  const sunny=useSunny();
  const {snapshot,invoke,toast}=sunny;
  const [view,setView]=useState<ViewId>('island');
  const [menu,setMenu]=useState(false);
  const [workspace,setWorkspace]=useState<WorkspaceInit|null>(null);
  const [activeProjectId,setActiveProjectId]=useState<string>();
  useEffect(()=>window.sunny?.subscribe(event=>{if(event.type==='workspace:open'){if(workspace&&!window.confirm('Switch workspaces? Unsaved drafts and file edits in the current workspace will be discarded.'))return;setWorkspace(event.data);}}),[workspace]);
  const titles=viewTitles[view];
  const navigate=(next:ViewId)=>{setView(next);setMenu(false);};
  const openWorkspace=(init:WorkspaceInit)=>{setActiveProjectId(init.projectId??snapshot.tasks.find(task=>task.id===init.taskId)?.projectId);setWorkspace(init);};
  const importProject=async()=>{try{const project=await invoke<Project|null>('project:add');if(!project)return;sunny.setSnapshot(previous=>({...previous,projects:previous.projects.some(item=>item.id===project.id)?previous.projects:[...previous.projects,project]}));toast(`${project.name} is aboard.`,'success');setActiveProjectId(project.id);}catch{/* invoke reports errors */}};
  const removeProject=async(projectId:string)=>{await invoke('project:remove',{projectId});sunny.setSnapshot(previous=>({...previous,projects:previous.projects.filter(project=>project.id!==projectId)}));toast('Project removed from Sunny HQ.','success');};
  const topActions=useMemo(()=>view==='projects'?<button className="top-action" onClick={()=>void importProject()}><FolderPlus/>Import</button>:view==='ship'?<button className="top-action" onClick={()=>openWorkspace({projectId:snapshot.projects[0]?.id,crewId:'luffy'})}><Plus/>Mission</button>:null,[view,snapshot.projects]);

  if(workspace)return <><Suspense fallback={<div className="loading-deck"><span/><h2>Opening the workbench…</h2></div>}><Workbench key={JSON.stringify(workspace)} snapshot={snapshot} initial={workspace} invoke={invoke} toast={toast} onClose={()=>setWorkspace(null)}/></Suspense><Toasts items={sunny.toasts}/></>;
  return <div className={`app-shell ${snapshot.settings.reducedMotion?'reduce-motion':''}`}>
    {sunny.desktop?<button className="float-ship-button" onClick={()=>void invoke('companion:show').catch(()=>{})}>↗ Ship on desktop</button>:null}
    <Sidebar view={view} onView={navigate} projects={snapshot.projects} tasks={snapshot.tasks} activeProjectId={activeProjectId} onProject={id=>openWorkspace({projectId:id})} open={menu} onToggle={()=>setMenu(value=>!value)}/>
    {menu?<button className="mobile-scrim" onClick={()=>setMenu(false)} aria-label="Close navigation"/>:null}
    <div className="main-shell"><Topbar title={titles.title} subtitle={titles.subtitle} desktop={sunny.desktop} codexStatus={snapshot.codex.status} onMenu={()=>setMenu(true)} actions={topActions}/><div className="page-scroll">
      {view==='island'?<IslandView snapshot={snapshot} invoke={invoke} onWorkspace={openWorkspace} onShip={()=>navigate('ship')} onNews={()=>navigate('news')}/>:null}
      {view==='news'?<MorgansView snapshot={snapshot} invoke={invoke} onWorkspace={openWorkspace} onBack={()=>navigate('island')}/>:null}
      {view==='ship'?<ShipView snapshot={snapshot} onWorkspace={openWorkspace} onNavigate={navigate} onImport={()=>void importProject()} invoke={invoke} toast={toast}/>:null}
      {view==='projects'?<ProjectsView projects={snapshot.projects} tasks={snapshot.tasks} onImport={()=>void importProject()} onOpen={id=>openWorkspace({projectId:id})} onRemove={id=>void removeProject(id)}/>:null}
      {view==='crew'?<CrewView snapshot={snapshot} invoke={invoke} onSelect={crewId=>openWorkspace({projectId:snapshot.projects[0]?.id,crewId})}/>:null}
      {view==='missions'?<MissionsView automations={snapshot.automations} onStart={(crewId,prompt)=>openWorkspace({projectId:snapshot.projects[0]?.id,crewId,prompt})}/>:null}
      {view==='library'?<LibraryView projects={snapshot.projects} invoke={invoke} toast={toast}/>:null}
      {view==='tools'?<ToolsView tools={snapshot.tools} projects={snapshot.projects} desktop={sunny.desktop} invoke={invoke} toast={toast}/>:null}
      {view==='inbox'?<InboxView tasks={snapshot.tasks} automations={snapshot.automations} desktop={sunny.desktop} invoke={invoke} onOpen={taskId=>openWorkspace({taskId})}/>:null}
      {view==='settings'?<SettingsView snapshot={snapshot} invoke={invoke} mergeSnapshot={sunny.mergeSnapshot} toast={toast}/>:null}
    </div></div><Toasts items={sunny.toasts}/>
  </div>;
}
