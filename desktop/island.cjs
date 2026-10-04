const {randomUUID}=require('node:crypto');const path=require('node:path');const {inside}=require('./core.cjs');
const residents=require('./island-residents.json');
const core=['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe'];
const districts=['harbor','research','engineering','creative','market','garden'];
const active=t=>['working','waiting','starting','unknown'].includes(t?.status);
function initialWorld(saved={}){return {...saved,version:1,paused:true,maxConcurrentJobs:Number.isInteger(saved.maxConcurrentJobs)&&saved.maxConcurrentJobs>=1&&saved.maxConcurrentJobs<=3?saved.maxConcurrentJobs:1,residents:residents.map(r=>({...r,recruited:false,...(saved.residents||[]).find(x=>x.id===r.id),id:r.id})),jobs:(saved.jobs||[]).map(j=>({...j,status:['running','stopping'].includes(j.status)?'blocked':j.status,error:['running','stopping'].includes(j.status)?'App restarted. Reconcile the previous mission before running again.':j.error})),ledger:saved.ledger||[]};}
function bounded(value,min,max,label){if(!Number.isInteger(value)||value<min||value>max)throw Error(`${label} must be ${min}–${max}.`);return value;}
class Island{
 constructor(hub,now=()=>Date.now()){this.hub=hub;this.now=now;this.launching=false;this.ticking=false;this.closed=false;this.timer=setInterval(()=>void this.tick().catch(e=>{this.hub.state.world.error=e.message;this.hub.changed();}),15000);this.timer.unref?.();}
 setConcurrency(value){this.data.maxConcurrentJobs=bounded(value,1,3,'Parallel island jobs');this.hub.changed();}
 get data(){return this.hub.state.world;}
 job(id){const j=this.data.jobs.find(j=>j.id===id);if(!j)throw Error('Job not found.');return j;}
 resident({id,recruited,role,district}){const r=this.data.residents.find(r=>r.id===id);if(!r)throw Error('Choose a resident from the catalog.');if(role!==undefined&&(typeof role!=='string'||!role.trim()||role.length>180))throw Error('Write a role of 1-180 characters.');if(district!==undefined&&!districts.includes(district))throw Error('Choose an island district.');if(typeof recruited==='boolean')r.recruited=recruited;if(role!==undefined)r.role=role.trim();if(district!==undefined)r.district=district;this.hub.changed();return r;}
 saveJob(input){const previous=input.id?this.job(input.id):null;if(previous&&['running','stopping'].includes(previous.status))throw Error('Stop the job before editing it.');if(previous&&this.hub.state.tasks.some(t=>t.jobId===previous.id&&active(t)))throw Error('Reconcile the previous job mission before editing.');if(!previous&&this.data.jobs.length>=100)throw Error('The island supports 100 job definitions.');
  this.hub.project(input.projectId);if(!core.includes(input.crewId)&&!this.data.residents.some(r=>r.id===input.crewId&&r.recruited))throw Error('Recruit this resident first.');
  if(typeof input.name!=='string'||!input.name.trim()||input.name.length>120||typeof input.objective!=='string'||!input.objective.trim()||input.objective.length>12000)throw Error('Provide a name (120 characters) and a concrete objective (12,000 characters).');if(!districts.includes(input.district))throw Error('Choose an island district.');
  const next={id:previous?.id||randomUUID(),name:input.name.trim(),crewId:input.crewId,projectId:input.projectId,district:input.district,objective:input.objective.trim(),intervalMinutes:bounded(input.intervalMinutes,15,10080,'Interval in minutes'),maxRunsPerDay:bounded(input.maxRunsPerDay,1,24,'Daily runs'),maxTotalRuns:bounded(input.maxTotalRuns,1,1000,'Total runs'),maxRunMinutes:bounded(input.maxRunMinutes,1,120,'Run minutes'),dailyTokenLimit:bounded(input.dailyTokenLimit,1000,10000000,'Reported-token threshold'),requiresReview:input.requiresReview!==false,enabled:false,status:previous?.status==='review'?'review':'paused',runs:previous?.runs||[],createdAt:previous?.createdAt||this.now(),nextAt:null};
  if(previous)Object.assign(previous,next);else this.data.jobs.push(next);this.hub.changed();return previous||next;
 }
 enable(id,enabled){if(typeof enabled!=='boolean')throw Error('Choose enabled or paused.');const j=this.job(id);if(['running','stopping'].includes(j.status))throw Error('Use Stop to pause an active job.');if(enabled&&j.status==='review')throw Error('Review this result before enabling another run.');if(this.hub.state.tasks.some(t=>t.jobId===id&&active(t)))throw Error('Reconcile the previous job mission first.');j.enabled=enabled;j.status=j.status==='review'?'review':enabled?'ready':'paused';j.nextAt=enabled?this.now()+j.intervalMinutes*60000:null;this.hub.changed();}
 review(id){const j=this.job(id);if(j.status!=='review')throw Error('This job has no completed result awaiting review.');j.status=j.enabled?'ready':'paused';j.nextAt=j.enabled?this.now()+j.intervalMinutes*60000:null;this.hub.changed();}
 tokens(j){const day=new Date(this.now()).toISOString().slice(0,10);return this.hub.state.tasks.filter(t=>t.jobId===j.id&&new Date(t.createdAt).toISOString().slice(0,10)===day).reduce((sum,t)=>sum+Math.max(0,Number(t.tokenUsage?.total?.totalTokens)||0),0);}
 canRun(j){if(this.closed||this.launching)return 'An island job is starting. Try again shortly.';if(this.data.jobs.filter(x=>['running','stopping'].includes(x.status)).length>=this.data.maxConcurrentJobs)return 'All parallel island job slots are busy.';const root=path.resolve(this.hub.project(j.projectId).path).toLowerCase();if(this.data.jobs.some(x=>x.id!==j.id&&['running','stopping'].includes(x.status)&&(()=>{const other=path.resolve(this.hub.project(x.projectId).path).toLowerCase();return inside(root,other)||inside(other,root);})()))return 'Another island job is using this project.';if(this.hub.globalExecutionCapacity&&!this.hub.globalExecutionCapacity().admit)return this.hub.globalExecutionCapacity().reason;if(this.hub.gate.active?.size>=this.hub.gate.limit)return 'All specialist task slots are busy.';if(j.status==='review')return 'Review the previous result first.';if(this.hub.state.codex.status!=='connected')return 'Connect Codex first.';if(this.hub.state.tasks.some(t=>t.jobId===j.id&&active(t)))return 'Reconcile the previous mission first.';if(j.runs.length>=j.maxTotalRuns)return 'Total run limit reached.';const day=new Date(this.now()).toISOString().slice(0,10);if(j.runs.filter(r=>new Date(r.startedAt).toISOString().slice(0,10)===day).length>=j.maxRunsPerDay)return 'Daily run limit reached (UTC).';if(this.tokens(j)>=j.dailyTokenLimit)return 'Daily reported-token threshold reached (UTC).';if(this.hub.gate.blocked(this.hub.project(j.projectId).path)||this.hub.state.tasks.some(t=>{if(t.captain||!active(t))return false;const other=this.hub.state.projects.find(p=>p.id===t.projectId);if(!other)return false;const a=path.resolve(this.hub.project(j.projectId).path).toLowerCase(),b=path.resolve(other.path).toLowerCase();return inside(a,b)||inside(b,a);}))return 'Another mission is writing in this project.';return '';}
 async run(id){const j=this.job(id),blocked=this.canRun(j);if(blocked)throw Error(blocked);this.launching=true;j.cancelRequested=false;const taskId=randomUUID();j.status='running';j.activeTaskId=taskId;j.startedAt=this.now();j.error=undefined;j.runs.push({taskId,startedAt:j.startedAt,status:'running'});this.hub.changed();
  try{const task=await this.hub.start({projectId:j.projectId,crewId:j.crewId,title:j.name,prompt:`Scheduled island job: ${j.name}\nObjective authorized by the user:\n${j.objective}\n\nComplete one bounded pass and return reviewable results, files changed, verification and blockers. Do not invent customers, revenue or completed actions. Do not purchase, publish, deploy, send outreach, move money, or accept terms under this job. Prepare drafts and local deliverables for the user to review. Do not keep running or schedule additional work yourself. If information or approval is missing, stop and ask. Respect repository instructions and existing changes.`},{id:taskId,jobId:j.id,cancelled:()=>j.cancelRequested||this.closed});if(j.cancelRequested&&active(task))await this.hub.interrupt(task.id);return task;}
  catch(e){j.status='blocked';j.enabled=false;j.error=e.message;j.runs.at(-1).status='blocked';throw e;}
  finally{this.launching=false;this.hub.changed();}
 }
 async stop(id,reason='Paused by you.'){const j=this.job(id);j.cancelRequested=true;j.enabled=false;j.status='stopping';this.hub.changed();try{const task=this.hub.state.tasks.find(t=>t.id===j.activeTaskId);if(task&&active(task))await this.hub.interrupt(task.id);j.error=reason;}catch(e){j.error='Stop needs attention: '+e.message;}finally{j.status='blocked';if(j.runs.length)j.runs.at(-1).status='stopped';this.hub.changed();await this.hub.persist('reservation-release');}}
 async setPaused(paused){if(typeof paused!=='boolean')throw Error('Choose paused or running.');this.data.paused=paused;this.hub.changed();if(paused)for(const j of this.data.jobs.filter(j=>['running','stopping'].includes(j.status)))await this.stop(j.id);await this.hub.persist('mission');}
 async tick(){
  if(this.closed||this.ticking)return;this.ticking=true;
  try{
   await this.hub.pollRunBudgets?.();
   for(const j of this.data.jobs.filter(j=>j.status==='running')){
    const task=this.hub.state.tasks.find(t=>t.id===j.activeTaskId);
    // Reconcile terminal results before applying limits to still-running work.
    if(task&&!active(task)){
     await this.hub.taskDurable(task);
     j.status=task.status==='finished'?(j.requiresReview?'review':j.enabled?'ready':'paused'):'blocked';
     if(task.status!=='finished')j.enabled=false;
     j.error=task.error;if(j.runs.length)j.runs.at(-1).status=task.status;
     j.nextAt=j.enabled&&j.status==='ready'?this.now()+j.intervalMinutes*60000:null;this.hub.changed();await this.hub.persist('reservation-release');continue;
    }
    if(task?.status==='unknown'){j.status='blocked';j.enabled=false;j.error='Mission status is uncertain. Reconcile it before continuing.';this.hub.changed();continue;}
    if(this.now()-j.startedAt>=j.maxRunMinutes*60000){await this.stop(j.id,'Run time limit reached.');continue;}
    if(this.tokens(j)>=j.dailyTokenLimit)await this.stop(j.id,'Daily reported-token threshold reached.');
   }
   if(this.data.paused||this.launching)return;
   for(const j of this.data.jobs){
    if(this.data.paused||this.closed)break;
    if(!j.enabled||j.status!=='ready'||j.nextAt>this.now())continue;
    const blocked=this.canRun(j);if(blocked){if(j.error!==blocked){j.error=blocked;this.hub.changed();}continue;}
    try{await this.run(j.id);}catch{/* run records the failure; other independent jobs may proceed. */}
   }
  }finally{this.ticking=false;}
 }
 addRevenue({amount,note}){if(typeof amount!=='number'||!Number.isFinite(amount)||amount<=0||amount>1000000||typeof note!=='string'||!note.trim()||note.length>500)throw Error('Enter a positive USD amount and source note.');const entry={id:randomUUID(),amount:Math.round(amount*100)/100,note:note.trim(),time:this.now(),source:'manual'};this.data.ledger.push(entry);this.hub.changed();return entry;}
 close(){this.closed=true;clearInterval(this.timer);}
}
module.exports={Island,initialWorld,districts};
