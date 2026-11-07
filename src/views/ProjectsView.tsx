import {useState} from 'react';
import {ArrowRight,Folder,FolderPlus,Search,X} from 'lucide-react';
import type {Project,TaskSummary} from '../shared';
import {taskIsBusy,taskNeedsAttention} from '../taskFlow';

type Props={projects:Project[];tasks:TaskSummary[];onImport:()=>void;onOpen:(id:string)=>void;onRemove:(id:string)=>void;onCaptain:(id:string)=>void};

export function ProjectsView({projects,tasks,onImport,onOpen,onRemove,onCaptain}:Props){
  const [query,setQuery]=useState('');
  const search=query.trim().toLocaleLowerCase();
  const visible=projects.filter(project=>[project.name,project.path,project.category].join(' ').toLocaleLowerCase().includes(search));
  return <div className="page projects-page">
    <header className="projects-heading">
      <div><span className="eyebrow">Your cargo hold</span><h2>Pick a project. Set a course.</h2><p>Tell Luffy what’s next. He’ll bring the right crew.</p></div>
      <button className="primary-button" onClick={onImport}><FolderPlus size={18}/> Add project</button>
    </header>
    {projects.length>0?<>
      <div className="projects-toolbar">
        <label className="projects-search"><Search size={18} aria-hidden="true"/><input type="search" aria-label="Search projects" placeholder="Find a project…" value={query} onChange={event=>setQuery(event.target.value)}/>{query?<button aria-label="Clear project search" onClick={()=>setQuery('')}><X size={16}/></button>:null}</label>
        <span role="status">{search?`${visible.length} of ${projects.length}`:projects.length} project{projects.length===1?'':'s'}</span>
      </div>
      {visible.length?<div className="project-grid">{visible.map(project=>{
        const activity=tasks.filter(task=>task.projectId===project.id);
        const latest=activity.reduce<TaskSummary|undefined>((current,task)=>!current||task.updatedAt>current.updatedAt?task:current,undefined);
        const attention=activity.filter(taskNeedsAttention).length;
        const working=activity.filter(task=>taskIsBusy(task)&&!taskNeedsAttention(task)).length;
        return <article className="project-card" key={project.id}>
          <div className="project-identity"><span className="project-folder"><Folder size={23} aria-hidden="true"/></span><span className="project-category">{project.category||'Local project'}</span></div>
          <h3>{project.name}</h3>
          <div className="project-activity"><span className={`project-activity-label ${attention?'attention':working?'working':''}`}>{attention?`${attention} need${attention===1?'s':''} attention`:working?`${working} working`:latest?'Saved activity':'Fresh start'}</span><p title={latest?.title}>{latest?.title||'Your next idea starts here.'}</p></div>
          <div className="project-actions"><button className="project-captain" onClick={()=>onCaptain(project.id)} aria-label={`Talk to Luffy about ${project.name}`}>Talk to Luffy <ArrowRight size={16}/></button><button className="project-workbench" onClick={()=>onOpen(project.id)} aria-label={`Open ${project.name} workbench`}>Workbench</button></div>
          <details className="project-details"><summary>Folder & options</summary><p>{project.path}</p><button className="ghost-button danger" onClick={()=>{if(window.confirm(`Remove “${project.name}” from Sunny? The folder and its files stay on your computer.`))onRemove(project.id);}}>Remove from Sunny</button></details>
        </article>;
      })}</div>:<section className="projects-empty"><Search size={32}/><h3>No matching projects</h3><p>Try a different name, category or folder path.</p><button className="small-button" onClick={()=>setQuery('')}>Clear search</button></section>}
    </>:<section className="projects-empty"><FolderPlus size={40}/><h3>Bring your first project aboard</h3><p>Choose a folder on your computer, then tell Luffy what you want to build.</p><button className="primary-button" onClick={onImport}>Choose a folder <ArrowRight size={16}/></button></section>}
  </div>;
}
