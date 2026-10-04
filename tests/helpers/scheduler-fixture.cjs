// Explicit offline provider enforces main-held roots; this never attests live containment.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process'),{EventEmitter}=require('node:events');
const {Hub}=require('../../desktop/hub.cjs'),registry=require('../../desktop/crew-registry.cjs');
async function schedulerFixture(t,{onTurn,onThread,onBase}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-scheduler-fix-')),original=path.join(dir,'original');fs.mkdirSync(original);
 const gitAt=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim();gitAt(original,['init']);gitAt(original,['config','user.name','Fixture']);gitAt(original,['config','user.email','fixture@example.invalid']);fs.mkdirSync(path.join(original,'src'));fs.writeFileSync(path.join(original,'src','base.txt'),'original');onBase?.(original);gitAt(original,['add','.']);gitAt(original,['commit','-m','base']);const base=gitAt(original,['rev-parse','HEAD']);
 let hub,stored={},sequence=0;const starts=[],turns=[],errors=[],enforced=new Set([original.toLowerCase()]),client=new EventEmitter();client.connected=true;client.close=()=>{};
 client.request=async(method,p)=>{
  if(method==='skills/list')return {data:[]};
  if(method==='thread/start'){const run=hub.state.runs.find(r=>r.workspaces.some(w=>w.canonicalRoot===p.cwd)),ref=run?.workspaces.find(w=>w.canonicalRoot===p.cwd&&w.assignmentId);if(!ref||!enforced.has(p.cwd.toLowerCase()))throw Error('Offline provider rejected unowned root');const task=hub.state.tasks.find(t=>t.workspaceId===ref.id);task.tokenUsage={total:{totalTokens:0}};starts.push({id:ref.assignmentId,runId:run.id,cwd:p.cwd,head:gitAt(p.cwd,['rev-parse','HEAD'])});await onThread?.({hub,run,ref,task,p});return {thread:{id:'thread-'+run.id+'-'+ref.assignmentId}};}
  if(method==='turn/start'){const task=hub.state.tasks.find(t=>t.threadId===p.threadId),run=hub.state.runs.find(r=>r.id===task.runId),a=run.assignments.find(a=>a.id===task.assignmentId),ref=run.workspaces.find(w=>w.id===a.workspaceId);if(p.cwd!==ref.canonicalRoot||!enforced.has(p.cwd.toLowerCase()))throw Error('Offline provider rejected turn root');turns.push(a.id);await onTurn?.({hub,run,ref,task,assignment:a,p});return {turn:{id:'turn-'+run.id+'-'+a.id}};}
  return {};
 };
 const commit=async image=>{stored=structuredClone(image);return {epoch:'scheduler-fix-fixture',sequence:++sequence,stateSha256:'a'.repeat(64),durableAt:1};};
 hub=new Hub({home:dir,store:{load:()=>({}),barrier:commit,checkpoint:commit,flush:async()=>{},close:async()=>{}},catalog:{discoverProjects:()=>[{id:'p',path:original}],discoverTools:()=>[],discoverAutomations:()=>[]},fixtureDependencies:{client,supervision:true,scopeEnforcingProvider:({root,otherRoot})=>enforced.has(root)&&enforced.has(otherRoot)&&root!==otherRoot,islandFactory:()=>({})}});
 hub.managedWorkspaceRoot=path.join(dir,'managed');hub.jevEnabled=()=>false;hub.state.codex.status='connected';hub.reportAsync=error=>errors.push(error.message);
 const create=hub.createExecutionWorkspace.bind(hub);hub.createExecutionWorkspace=async input=>{const ref=await create(input);enforced.add(ref.canonicalRoot.toLowerCase());return ref;};
 t.after(async()=>{hub.closed=true;clearTimeout(hub.saveTimer);clearTimeout(hub.checkpointTimer);clearTimeout(hub.saveRetryTimer);await Promise.allSettled([...hub.scheduler().pending.values()].map(entry=>entry.promise));fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
 const parent={id:'parent',captain:true,crewId:'luffy',projectId:'p',threadId:'parent-thread',turnId:'parent-turn',status:'working',messages:[]};hub.state.tasks.push(parent);
 const makeAssignment=(id,{crewId='franky',ownedPaths=['src/'+id],dependencies=[]}={})=>{const binding=registry.crewBinding(crewId,hub.state.world);return {id,crewId,roleId:binding.roleId,capability:binding.capabilities[0],objective:'Bounded offline regression '+id,ownedPaths,dependencies,criteriaIds:['criterion'],baseCommit:base,state:'queued'};};
 async function plan(assignments,runId='r'){
  const grant={id:'g-'+runId,createdBy:'captain',scope:{projectId:'p',objective:'Offline scheduler regression',activities:['read','write','test','review','research','build']},maxWorkers:3,maxInitialAssignments:16,maxLaunches:32,maxRepairs:3,workerMs:900000,activeMs:3600000,tokenLimit:100000,improvementMs:0,improvementTokens:0};
  await hub.createRun({runId,projectId:'p',expectedRevision:0,parentTaskId:parent.id,objective:'Offline scheduler regression',criteria:[{id:'criterion',text:'Actual dispatch evidence'}],grant});
  await hub.captain.supervise({threadId:parent.threadId,turnId:parent.turnId,callId:'plan-'+runId,tool:'sunny_plan',arguments:{runId,projectId:'p',expectedRevision:0,assignments,decision:{id:'decision-'+runId,option:'Bounded work',reason:'Offline regression',dissent:[],owner:'franky',nextAction:'Check actual dispatch',reopenEvidence:'Changed source'}}});
 }
 async function until(predicate,timeout=20000){const deadline=Date.now()+timeout;while(!predicate()&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));if(!predicate())throw Error('Offline fixture timed out: '+JSON.stringify(errors));}
 async function complete(id,runId='r'){const task=hub.state.tasks.find(t=>t.assignmentId===id&&t.runId===runId);await hub.notification({method:'turn/completed',params:{threadId:task.threadId,turn:{id:task.turnId||'turn-'+runId+'-'+id,status:'completed'}}});}
 async function integrationProof(runId='r'){const project=hub.runSourceProject(runId),actual=await hub.evidence.gitState(project.path),source={baseCommit:base,headCommit:actual.commit,fingerprint:actual.fingerprint,artifactHashes:[]};await hub.missionMutation(book=>{const run=book.data.runs.find(r=>r.id===runId);run.verification={source,resultId:'offline-result',resultSha256:'a'.repeat(64),workspaceVerified:true,integrationVerified:true,authors:[],authorSessions:[],authorshipComplete:false,checks:[],artifacts:[]};run.revision++;});return source;}
 return {hub,dir,original,base,gitAt,makeAssignment,plan,until,complete,integrationProof,starts,turns,errors,get stored(){return structuredClone(stored);}};
}
module.exports={schedulerFixture};
