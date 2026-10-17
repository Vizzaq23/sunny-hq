import {Fragment,useEffect,useRef,type KeyboardEvent,type ReactNode} from 'react';
import {Anchor,BookOpen,Box,Compass,Inbox,LayoutDashboard,Newspaper,Menu,Settings,ShipWheel,Sparkles,Users,X} from 'lucide-react';
import type {Crew,Project,TaskSummary as Task} from '../shared';
import {formatRelative} from '../data';
import {useCrewTexture} from '../crewTexture';
import {taskLabel,taskNeedsAttention} from '../taskFlow';

export type ViewId='home'|'news'|'island'|'ship'|'projects'|'crew'|'missions'|'library'|'tools'|'inbox'|'settings';
const nav=[
  {id:'home',label:'Home',icon:LayoutDashboard},
  {id:'projects',label:'Projects',icon:Box},
  {id:'crew',label:'Crew',icon:Users},
  {id:'missions',label:'Missions',icon:Compass},
  {id:'inbox',label:'Inbox',icon:Inbox},
  {id:'island',label:'The Island',icon:Compass},
  {id:'ship',label:'The Sunny',icon:LayoutDashboard},
  {id:'news',label:'Morgans’ blimp',icon:Newspaper},
  {id:'library',label:'Library',icon:BookOpen},
  {id:'tools',label:'Tools',icon:Sparkles},
] as const;

export function Sidebar({view,onView,projects,tasks,activeProjectId,onProject,open,onToggle}:{view:ViewId;onView:(view:ViewId)=>void;projects:Project[];tasks:Task[];activeProjectId?:string;onProject:(id:string)=>void;open:boolean;onToggle:()=>void}){
  const sidebarRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement;
    sidebarRef.current?.querySelector<HTMLButtonElement>('.mobile-close')?.focus();
    return()=>{if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};
  },[open]);
  function handleNavigationKey(event:KeyboardEvent<HTMLElement>){
    if(!open)return;
    if(event.key==='Escape'){event.preventDefault();onToggle();return;}
    if(event.key!=='Tab')return;
    const controls=Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('button,a[href],select,input,[tabindex="0"]')??[]).filter(element=>element.getClientRects().length>0);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
  return <aside id="sunny-navigation" ref={sidebarRef} onKeyDown={handleNavigationKey} className={`sidebar ${open?'is-open':''}`}>
    <div className="brand"><span className="brand-mark"><ShipWheel size={22}/></span><span><strong>Sunny HQ</strong><small>Your pirate headquarters</small></span><button className="mobile-close" onClick={onToggle} aria-label="Close menu"><X/></button></div>
    <nav className="main-nav" aria-label="Main navigation">
      <p className="nav-label">Captain’s command</p>
      {nav.map(item=><Fragment key={item.id}>{item.id==='island'?<p className="nav-label voyage-nav-group">Explore the Grand Line</p>:item.id==='library'?<p className="nav-label voyage-nav-group">Ship’s resources</p>:null}<button className={view===item.id?'active':''} aria-current={view===item.id?'page':undefined} onClick={()=>onView(item.id)}><item.icon size={18} aria-hidden="true"/><span>{item.label}</span>{item.id==='inbox'&&tasks.some(taskNeedsAttention)?<em>{tasks.filter(taskNeedsAttention).length}</em>:null}</button></Fragment>)}
    </nav>
    <div className="sidebar-projects">
      <div className="nav-section-title"><span>Project ports</span><button onClick={()=>onView('projects')}>View all</button></div>
      {projects.slice(0,4).map(project=><button key={project.id} className={`project-nav ${activeProjectId===project.id?'active':''}`} onClick={()=>onProject(project.id)}><span className="project-gem">{project.name.charAt(0).toUpperCase()}</span><span><b>{project.name}</b><small>{tasks.filter(t=>t.projectId===project.id).length} conversations</small></span></button>)}
      {projects.length===0?<p className="nav-empty">Your imported projects will live here.</p>:null}
    </div>
    <div className="sidebar-foot">
      <button onClick={()=>onView('settings')} className={view==='settings'?'active':''}><Settings size={18}/><span>Settings</span></button>
      <div className="connection"><span className="connection-dot"/> <span>Local workspace</span></div>
    </div>
  </aside>;
}

export function Topbar({title,subtitle,desktop,codexStatus,onMenu,actions,menuOpen=false}:{title:string;subtitle?:string;desktop:boolean;codexStatus:string;onMenu:()=>void;actions?:ReactNode;menuOpen?:boolean}){
  return <header className="topbar"><button className="menu-button" onClick={onMenu} aria-label="Open menu" aria-expanded={menuOpen} aria-controls="sunny-navigation"><Menu/></button><div className="topbar-title"><span className="topbar-kicker">{subtitle}</span><h1>{title}</h1></div><div className="topbar-actions">{actions}<span className={`status-pill ${desktop&&codexStatus==='connected'?'online':'offline'}`}><span/>{desktop?(codexStatus==='connected'?'Codex ready':codexStatus):'Browser preview'}</span></div></header>;
}

export function EmptyState({icon='anchor',title,body,action}:{icon?:'anchor'|'compass'|'book';title:string;body:string;action?:ReactNode}){
  const Icon=icon==='compass'?Compass:icon==='book'?BookOpen:Anchor;
  return <div className="empty-state"><span className="empty-icon"><Icon size={26}/></span><h3>{title}</h3><p>{body}</p>{action}</div>;
}

export function CrewBadge({crew,size='normal',onClick}:{crew:Crew;size?:'small'|'normal'|'large';onClick?:()=>void}){
  const Tag=onClick?'button':'span';
  const crewIndex=['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe'].indexOf(crew.id);
  const x=crew.spriteRow!==undefined?0:(crewIndex%2)*4*100/7,y=crew.spriteRow!==undefined?crew.spriteRow*100/3:Math.floor(crewIndex/2)*25;
  const resident=crew.spriteRow!==undefined;
  const residentUrl=new URL(`${import.meta.env.BASE_URL}assets/island-residents.png`,window.location.href).href;const residentTexture=useCrewTexture(residentUrl,'residents');
  const crewSheetUrl=new URL(`${import.meta.env.BASE_URL}assets/crew-sheet.png`,window.location.href).href;
  const spriteUrl=new URL(`${import.meta.env.BASE_URL}assets/crew-pet-states.png`,window.location.href).href;
  const chopperUrl=new URL(`${import.meta.env.BASE_URL}assets/chopper-pet.webp`,window.location.href).href;
  const texture=useCrewTexture(spriteUrl,'states');
  const chopper=crew.id==='chopper',pixel=chopper||Boolean(resident?residentTexture:texture);
  return <Tag className={`crew-badge ${size} ${pixel?'pixel':'portrait'} ${chopper?'chopper':''}`} style={{'--crew':crew.color,'--crew-x':`${x}%`,'--crew-y':`${y}%`,backgroundImage:`url("${resident?residentTexture??residentUrl:chopper?chopperUrl:texture??crewSheetUrl}")`,backgroundSize:resident?'400% 400%':chopper?'800% 1100%':texture?'800% 500%':undefined} as React.CSSProperties} onClick={onClick} title={`${crew.name} · ${crew.role}`} aria-label={`${crew.name}, ${crew.role}`}><span>{crew.name}</span></Tag>;
}

export function TaskRow({task,crew,onClick}:{task:Task;crew?:Crew;onClick:()=>void}){
  return <button className="task-row" onClick={onClick}><span className={`task-state ${task.status}`}/><span className="task-main"><b>{task.title}</b><small>{crew?.name??'Crew'} · {formatRelative(task.updatedAt)}</small></span><span className="task-status">{taskLabel(task)}</span></button>;
}

export function Toasts({items}:{items:{id:number;message:string;tone?:string}[]}){return <div className="toast-stack" aria-live="polite">{items.map(item=><div key={item.id} className={`toast ${item.tone??''}`}>{item.message}</div>)}</div>}
