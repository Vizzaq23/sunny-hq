const {EventEmitter}=require('node:events');const {randomUUID}=require('node:crypto');const path=require('node:path');
const {CodexClient}=require('./codex.cjs');const {Growth}=require('./growth.cjs');const {CrewChat}=require('./crew-chat.cjs');const {TaskGate,deriveStatus}=require('./core.cjs');
const {selectExecution,routingContext}=require('./model-routing.cjs');
const {createApproval,approvalResult}=require('./approvals.cjs');
const {MissionBook}=require('./missions.cjs');
const {ROLE_BINDINGS,resolveMissionRole,missionContext}=require('./mission-roles.cjs');
const roles={luffy:'General assistant and mission planning',zoro:'Code review and security review',nami:'Planning and prioritization',usopp:'Tests and browser checks',sanji:'Interface design and product polish',chopper:'Debugging and failure investigation',robin:'Research and documentation',franky:'Feature implementation and architecture',brook:'Creative content and media workflows',jinbe:'Infrastructure and release preparation'};
Object.assign(roles,Object.fromEntries(require('./island-residents.json').map(r=>[r.id,r.role])));
class Hub extends EventEmitter {
 constructor({home,store,catalog}){super();this.home=home;this.store=store;this.catalog=catalog;this.client=new CodexClient();this.gate=new TaskGate(3);this.loaded=new Set();this.taskActions=new Set();this.captain=new (require('./captain.cjs').Captain)(this);this.saveTimer=null;
  const saved=store.load();this.growth=new Growth(saved.growth);this.discussionRun=null;this.state={news:require('./news.cjs').initialNews(saved.news),world:require('./island.cjs').initialWorld(saved.world),growth:this.growth.data,discussions:(saved.discussions||[]).map(e=>({...e,status:e.status==='working'?'interrupted':e.status})),projects:saved.projects||catalog.discoverProjects(home),tasks:(saved.tasks||[]).map(t=>({...t,status:['working','waiting','starting'].includes(t.status)?'unknown':t.status})),tools:catalog.discoverTools(home),settings:{reducedMotion:false,notifications:true,routingPolicy:'efficient',...saved.settings},codex:{status:'disconnected'},approvals:[],models:[],usage:null,automations:catalog.discoverAutomations(home)};
  this.missionBook=new MissionBook(saved.missionBook);this.state.missions=this.missionBook.data.missions;this.state.missionRoles=ROLE_BINDINGS;this.missionPersistencePending=this.missionBook.recover(this.state.tasks);
  this.evidence=new (require('./mission-evidence.cjs').MissionEvidence)({git:catalog.getExecutable?.('git',home)||'git'});this.branches=new (require('./mission-branch.cjs').MissionBranch)(this.evidence);this.missionActions=new Set();this.pullRequests=new (require('./pull-request-evidence.cjs').PullRequestEvidence)({evidence:this.evidence,gh:catalog.getExecutable?.('gh',home)||'gh'});
  this.deployments=new (require('./deployment-evidence.cjs').DeploymentEvidence)({evidence:this.evidence,gh:catalog.getExecutable?.('gh',home)||'gh'});
  this.imageReader=require('./image-deliverables.cjs').readImageDeliverable;
  const {MissionPublisher,MissionPublication}=require('./mission-publisher.cjs');this.publisher=new MissionPublisher({evidence:this.evidence,git:catalog.getExecutable?.('git',home)||'git',gh:catalog.getExecutable?.('gh',home)||'gh'});this.publication=new MissionPublication(this);this.merger=new (require('./mission-merge.cjs').MissionMerge)(this);
  this.taskRevisions=new Map();for(const task of this.state.tasks)if(['unknown','working','waiting','starting'].includes(task.status))this.reserveWriter(task);
  this.island=new (require('./island.cjs').Island)(this);this.news=new (require('./news.cjs').News)(this);
  this.client.on('notification',e=>this.notification(e));this.client.on('request',e=>this.request(e));this.client.on('disconnected',error=>{this.state.codex={...this.state.codex,status:'disconnected',error};this.loaded.clear();for(const t of this.state.tasks)if(['working','waiting','starting'].includes(t.status)){t.status='unknown';this.bumpTask(t);}this.state.approvals=[];this.captain.disconnect();this.changed();});
 }
 changed(){if(this.closed)return;clearTimeout(this.streamTimer);this.streamTimer=null;this.streamTasks?.clear();this.missionPersistencePending=this.missionBook.sync(this.state.tasks,this.state.approvals)||this.missionPersistencePending;if(this.missionPersistencePending){try{this.persist();}catch(error){this.scheduleSave();this.emit('event',{type:'error',data:{message:error.message}});return;}}this.scheduleSave();this.emit('event',{type:'snapshot',data:this.state});}
 scheduleSave(){if(this.closed)return;clearTimeout(this.saveTimer);this.saveTimer=setTimeout(()=>this.savePending(),250);if(!this.checkpointTimer)this.checkpointTimer=setTimeout(()=>this.savePending(),1000);}
 savePending(){clearTimeout(this.saveTimer);clearTimeout(this.checkpointTimer);this.saveTimer=null;this.checkpointTimer=null;if(this.closed)return;try{this.persist();}catch(e){this.emit('event',{type:'error',data:{message:e.message}});}}
 streamChanged(task){if(this.closed)return;this.streamTasks??=new Map();this.streamTasks.set(task.id,task);if(!this.streamTimer)this.streamTimer=setTimeout(()=>{this.streamTimer=null;for(const next of this.streamTasks.values())this.emit('event',{type:'task',data:next});this.streamTasks.clear();},50);this.scheduleSave();}
 persist(){this.store.save({missionBook:this.missionBook.data,news:this.state.news,world:this.state.world,projects:this.state.projects,tasks:this.state.tasks,settings:this.state.settings,growth:this.growth.data,discussions:this.state.discussions});this.missionPersistencePending=false;}
 missionMutation(run){
  const previous=structuredClone(this.missionBook.data);
  let result;try{result=run();this.persist();}catch(error){this.missionBook=new MissionBook(previous);this.state.missions=this.missionBook.data.missions;throw error;}
  this.changed();return result;
 }
 markMissionSignalSeen(input){this.validateMissionAction(input,['missionId','revision','eventId']);if(this.missionActions.has(input.missionId))throw Error('Wait for the current mission action before marking this signal seen.');return this.missionMutation(()=>this.missionBook.markSignalSeen(input.missionId,input.revision,input.eventId));}
 createMission(input){this.project(input?.projectId);return this.missionMutation(()=>this.missionBook.create(input));}
 async prepareMissionBranch(input){
  this.validateMissionAction(input,['missionId','revision']);
  const mission=this.missionBook.get(input.missionId);this.missionBook.check(mission,input.revision);
  if(mission.status!=='DRAFT'||mission.attempts.length)throw Error('Prepare the branch before the first mission attempt.');
  if(this.missionActions.has(mission.id))throw Error('Wait for the current mission action.');
  const project=this.project(mission.projectId),lock='mission-branch:'+mission.id;
  this.gate.acquire(lock,project.path);this.missionActions.add(mission.id);
  try{
   if(mission.branch){
    const observed=await this.branches.inspect(project.path,mission.branch);
    if(!observed.ready)throw Error('Branch preparation is unresolved. Inspect the checkout; Sunny will not repeat or overwrite the switch.');
   }else{
    const plan=await this.branches.plan(project.path,mission.id);
    this.missionMutation(()=>{this.missionBook.check(mission,input.revision);mission.branch=plan;this.missionBook.record(mission,'BRANCH_PREPARING',{branch:plan.name,baseCommit:plan.baseCommit});});
    await this.branches.create(project.path,plan);
   }
   if(this.closed)throw Error('Sunny closed during branch preparation. Reconcile it before launch.');
   return this.missionMutation(()=>{mission.branch.state='ready';this.missionBook.record(mission,'BRANCH_READY',{branch:mission.branch.name,baseCommit:mission.branch.baseCommit});return mission.branch;});
  }finally{this.gate.release(lock);this.missionActions.delete(mission.id);}
 }
 async startMission(input){
  this.validateMissionAction(input,['missionId','revision','crewId','roleId']);
  if(this.missionActions.has(input.missionId))throw Error('Wait for the mission evidence check to finish.');
  const route=resolveMissionRole(input);
  const mission=this.missionBook.get(input.missionId);if(['submitting','uncertain'].includes(mission.mergeRequest?.state))throw Error('Reconcile the merge request before starting another attempt.');if(['publishing','uncertain'].includes(mission.prPublication?.state))throw Error('Reconcile the uncertain PR publication before starting another attempt.');const project=this.project(mission.projectId);if(mission.branch)await this.branches.validate(project.path,mission.branch);
  const attempt=this.missionMutation(()=>{const next=this.missionBook.begin(mission.id,input.revision);next.routing=route;if(route.roleId==='coordinator')next.workflowVersion=1;this.missionBook.record(mission,'ROUTING_DECIDED',{roleId:route.roleId,crewId:route.crewId,provider:route.provider,reason:route.reason});return next;});
  try{return await this.start({projectId:mission.projectId,crewId:route.crewId,title:mission.title,selectionReason:route.reason,prompt:missionContext(mission,route)},{id:attempt.taskId,mission:true});}
  catch(error){if(!this.state.tasks.some(t=>t.id===attempt.taskId))this.missionMutation(()=>this.missionBook.launchFailed(mission.id,attempt.id,error.message));throw error;}
 }
 async acceptMission(input){
  this.validateMissionAction(input,['missionId','revision','criteria']);
  if(this.missionActions.has(input.missionId))throw Error('Wait for the mission evidence check to finish.');
  const mission=this.missionBook.get(input.missionId);this.missionBook.check(mission,input.revision);
  if(['submitting','uncertain'].includes(mission.mergeRequest?.state))throw Error('Reconcile the merge request before accepting the mission.');if(['publishing','uncertain'].includes(mission.prPublication?.state))throw Error('Reconcile PR publication before accepting the mission.');
  const project=this.project(mission.projectId),lock='mission-accept:'+mission.id;
  this.gate.acquire(lock,project.path);this.missionActions.add(mission.id);
  try{
   const checks=new Map();for(const artifact of mission.artifacts)if(artifact.attemptId===mission.activeAttemptId&&artifact.kind==='check')checks.set(artifact.script,artifact);
   if([...checks.values()].some(check=>check.status!=='passed'))throw Error('Every recorded latest check must have passed before acceptance.');
   if(checks.size){const current=await this.evidence.gitState(project.path);if([...checks.values()].some(check=>check.fingerprint!==current.fingerprint))throw Error('Source changed since verification. Run the stale checks again.');}
   const deliverables=new Map();for(const artifact of mission.artifacts)if(artifact.attemptId===mission.activeAttemptId&&['deliverable','image'].includes(artifact.kind))deliverables.set(process.platform==='win32'?artifact.filePath.toLowerCase():artifact.filePath,artifact);
   let merged;
   if(mission.completionBoundary==='merge'){
    const prior=mission.artifacts.findLast(a=>a.attemptId===mission.activeAttemptId&&a.kind==='pull-request');
    if(!prior)throw Error('Inspect the merged pull request before completing this mission.');
    merged=await this.pullRequests.inspect(project.path,prior.number);
    if(merged.url!==prior.url||merged.commit!==prior.commit||merged.fingerprint!==prior.fingerprint)throw Error('Pull-request source or identity changed. Inspect it and review the new evidence first.');
    if(merged.state!=='MERGED'||!Number.isFinite(Date.parse(merged.mergedAt)))throw Error('The pull request has not been verified as merged.');
    if(merged.checkStatus!=='passed')throw Error('The merged pull request must have passing checks before completion.');
   }
   if(this.closed)throw Error('Sunny closed before acceptance could be saved.');
   return this.missionMutation(()=>{
    const current=this.missionBook.get(input.missionId);this.missionBook.check(current,input.revision);
    let proof;if(merged){proof={...merged,id:randomUUID(),attemptId:current.activeAttemptId,projectId:project.id,producer:'sunny-local-verifier'};current.artifacts.push(proof);}
   for(const artifact of deliverables.values())if((artifact.kind==='image'?require('./mission-deliverables.cjs').readProjectFile(project.path,artifact.filePath,{extensions:['.png'],limit:8*1024*1024}):require('./mission-deliverables.cjs').readDeliverable(project.path,artifact.filePath)).sha256!==artifact.sha256)throw Error('Deliverable changed since review. Attach and review its current version.');
    return this.missionBook.accept(input.missionId,input.revision,input.criteria,proof);
   });
  }finally{this.gate.release(lock);this.missionActions.delete(mission.id);}
 }
 async collectMissionEvidence(input){
  this.validateMissionAction(input,['missionId','revision','script','prNumber','filePath','deployment','imagePath','provenance']);
  if(['script','prNumber','filePath','deployment','imagePath'].filter(key=>input[key]!==undefined).length>1)throw Error('Choose one evidence action.');
  if(input.provenance!==undefined&&input.imagePath===undefined)throw Error('Image notes require an image file.');
  const provenance=input.imagePath!==undefined?require('./image-deliverables.cjs').imageProvenance(input.provenance):undefined;
  if(input.deployment!==undefined&&(input.deployment!==true||input.filePath!==undefined||input.script!==undefined||input.prNumber!==undefined))throw Error('Choose one deployment inspection or check.');
  if(input.filePath!==undefined&&(typeof input.filePath!=='string'||input.script!==undefined||input.prNumber!==undefined))throw Error('Choose one deliverable file or check.');
  if(input.prNumber!==undefined&&(!Number.isSafeInteger(input.prNumber)||input.prNumber<1||input.script!==undefined))throw Error('Choose one check or a positive pull-request number.');
  if(input.script!==undefined&&!['test','build','typecheck','lint'].includes(input.script))throw Error('Choose a supported check.');
  if(this.missionActions.has(input.missionId))throw Error('A mission evidence check is already running.');
  const mission=this.missionBook.get(input.missionId);this.missionBook.check(mission,input.revision);
  if(mission.status!=='WAITING_FOR_REVIEW'&&!(input.deployment===true&&mission.status==='COMPLETE'))throw Error('Finish the crew attempt before collecting review evidence.');
  const project=this.project(mission.projectId),lock='mission-evidence:'+mission.id,attemptId=mission.activeAttemptId;
  this.gate.acquire(lock,project.path);this.missionActions.add(mission.id);let uncertain=false;
  try{
   this.missionMutation(()=>this.missionBook.record(mission,input.script?'TEST_STARTED':'EVIDENCE_STARTED',{script:input.script||null}));
   const revision=mission.revision;
   const evidence=input.imagePath!==undefined?(({dataUrl,...metadata})=>({...metadata,provenance}))(this.imageReader(project.path,input.imagePath)):input.deployment===true?await this.deployments.inspect(project.path):input.filePath!==undefined?(({text,...metadata})=>metadata)(require('./mission-deliverables.cjs').readDeliverable(project.path,input.filePath)):input.prNumber!==undefined?await this.pullRequests.inspect(project.path,input.prNumber):input.script?await this.evidence.runCheck(project.path,input.script):await this.evidence.gitState(project.path);
   if(this.closed)throw Error('Sunny closed before the check result could be attached.');
   return this.missionMutation(()=>{
    const current=this.missionBook.get(mission.id);this.missionBook.check(current,revision);
    if(current.activeAttemptId!==attemptId)throw Error('The mission attempt changed during verification.');
    const artifact={...evidence,id:randomUUID(),attemptId,projectId:project.id,producer:'sunny-local-verifier'};current.artifacts.push(artifact);
    this.missionBook.record(current,evidence.kind==='check'?(evidence.status==='passed'?'TEST_PASSED':'TEST_FAILED'):evidence.kind==='pull-request'?'PR_UPDATED':['deliverable','image'].includes(evidence.kind)?'DELIVERABLE_ATTACHED':evidence.kind==='deployment'?'DEPLOYMENT_INSPECTED':'GIT_INSPECTED',{artifactId:artifact.id});return artifact;
   });
  }catch(error){uncertain=Boolean(error.uncertain);if(!this.closed)this.missionMutation(()=>this.missionBook.record(this.missionBook.get(mission.id),'EVIDENCE_FAILED',{message:String(error.message).slice(0,1000)}));throw error;}
  finally{if(!uncertain){this.gate.release(lock);this.missionActions.delete(mission.id);}}
 }
 previewMissionDeliverable(input){
  this.validateMissionAction(input,['missionId','revision','artifactId']);
  if(typeof input.artifactId!=='string')throw Error('Choose a recorded deliverable.');
  const mission=this.missionBook.get(input.missionId);this.missionBook.check(mission,input.revision);
  const artifact=mission.artifacts.find(a=>a.id===input.artifactId&&['deliverable','image'].includes(a.kind));if(!artifact)throw Error('Deliverable not found in this mission.');
  const project=this.project(mission.projectId),lock='deliverable-preview:'+mission.id;this.gate.acquire(lock,project.path);
  try{const result=artifact.kind==='image'?this.imageReader(project.path,artifact.filePath):require('./mission-deliverables.cjs').readDeliverable(project.path,artifact.filePath);if(result.sha256!==artifact.sha256)throw Error('Deliverable changed. Attach and review its current version.');return {artifactId:artifact.id,...result};}finally{this.gate.release(lock);}
 }
 validateMissionAction(input,keys){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!keys.includes(key))||typeof input.missionId!=='string'||!Number.isSafeInteger(input.revision)||input.revision<1)throw Error('Invalid mission command.');}
 project(id){const p=this.state.projects.find(p=>p.id===id);if(!p)throw Error('Select a registered project first.');return p;}
 task(id){const t=this.state.tasks.find(t=>t.id===id);if(!t)throw Error('Task was not found.');return t;}
 async connect(){this.state.codex={status:'connecting'};this.changed();try{const init=await this.client.connect(this.home);const account=await this.client.request('account/read',{refreshToken:false});this.state.codex={status:account.account?'connected':'sign-in required',version:init?.userAgent,account:account.account?.planType||account.account?.type};
  const results=await Promise.allSettled([this.client.request('model/list',{}),this.client.request('account/rateLimits/read',{}),this.refreshTools()]);if(results[0].status==='fulfilled')this.state.models=results[0].value.data||[];if(results[1].status==='fulfilled')this.state.usage=results[1].value;this.changed();return this.state.codex;
 }catch(e){this.state.codex={status:'disconnected',error:e.message};this.changed();throw e;}}
 async refreshTools(){const tools=this.catalog.discoverTools(this.home);if(this.client.connected){try{const r=await this.client.request('app/installed',{});for(const a of r.apps||[])tools.push({id:'app:'+a.id,name:a.runtimeName||a.id,category:'Connected apps',description:'Available to Codex tasks through your existing account. Ask the crew to use this connection.',status:a.callable?'available in Codex':a.enabled?'needs setup':'disabled'});}catch(e){tools.push({id:'app-discovery',name:'Connected apps',category:'Connected apps',description:e.message,status:'unavailable'});}
 try{const r=await this.client.request('skills/list',{cwds:this.state.projects.slice(0,12).map(p=>p.path)},15000);for(const scope of r.data||[]){for(const skill of scope.skills||[]){const id='skill:'+skill.path;if(!tools.some(t=>t.id===id||t.path===skill.path))tools.push({id,name:skill.name,category:'Skills',description:skill.description||'Codex skill',status:skill.enabled===false?'disabled':'available in Codex',path:skill.path});}}}catch{/* Local discovery remains an explicit installed-only fallback. */}}
 this.state.tools=tools;this.changed();return tools;}
 async ensure(){if(!this.client.connected)await this.connect();if(this.state.codex.status!=='connected')throw Error('Sign in to Codex from Settings before starting work.');}
 async start({projectId,crewId,prompt,title,model,effort,selectionReason},internal={}){
  if(!roles[crewId])throw Error('Choose a crew member.');if(require('./island-residents.json').some(r=>r.id===crewId)&&!this.state.world.residents.some(r=>r.id===crewId&&r.recruited))throw Error('Recruit this resident on the island first.');this.validatePrompt(prompt);const p=this.project(projectId);await this.ensure();if(this.closed||internal.cancelled?.())throw Error('Job cancelled before launch.');
  const execution=selectExecution(this.state.models,{model:model||this.state.settings.model,effort},this.state.settings.routingPolicy);
  const captain=crewId==='luffy'&&!internal.parentTaskId;if(captain&&this.state.tasks.filter(t=>t.captain&&['starting','working','waiting','unknown'].includes(t.status)).length>=3)throw Error('Finish or reconcile an active captain conversation first.');const task={id:internal.id||randomUUID(),title:title||prompt.slice(0,65),projectId,crewId,captain,captainVersion:captain?3:undefined,...execution,selectionReason,parentTaskId:internal.parentTaskId,jobId:internal.jobId,status:'starting',createdAt:Date.now(),updatedAt:Date.now(),messages:[]};if(!captain)this.gate.acquire(task.id,p.path);this.state.tasks.unshift(task);this.changed();
  try{if(internal.mission)this.persist();const r=await this.client.request('thread/start',{cwd:p.path,...(task.model?{model:task.model}:{}),sandbox:'workspace-write',approvalPolicy:'on-request',...(captain?await this.captain.options(p):{}),developerInstructions:require('./crew.cjs').characterInstructions(crewId,this.state.world.residents.find(r=>r.id===crewId)?.role||roles[crewId])+(captain?'\n'+require('./captain.cjs').instructions:'')});task.threadId=r.thread.id;task.model=r.model||task.model;task.effort=task.effort||r.reasoningEffort||undefined;this.loaded.add(task.id);if(internal.cancelled?.()){task.status='interrupted';this.gate.release(task.id);this.changed();return task;}await this.send(task.id,prompt,true);return task;
  }catch(e){if(!(e.uncertain&&task.threadId)){task.status='failed';this.gate.release(task.id);}task.error=e.message;this.changed();throw e;}
 }
 validatePrompt(prompt){if(typeof prompt!=='string'||!prompt.trim())throw Error('Write a message first.');if(prompt.length>100000)throw Error('Message is too long. Attach a file or shorten it.');}
 reserveWriter(task){if(task.captain||task.external||!task.threadId)return;const project=this.state.projects.find(p=>p.id===task.projectId);if(project?.path)this.gate.active.set(task.id,path.resolve(project.path).toLowerCase());}
 bumpTask(task){this.taskRevisions.set(task.id,(this.taskRevisions.get(task.id)||0)+1);}
 async reconcile(task){
  await this.ensure();const revision=this.taskRevisions.get(task.id)||0;
  const result=await this.client.request('thread/read',{threadId:task.threadId,includeTurns:true});
  // Lifecycle notifications received during the read are newer than its response.
  if((this.taskRevisions.get(task.id)||0)!==revision){
   if(task.status==='unknown')throw Error('The connection changed during this check. Check status again after reconnecting.');
   return ['working','waiting','starting'].includes(task.status);
  }
  const thread=result.thread||result,status=deriveStatus(thread.status),turns=Array.isArray(thread.turns)?thread.turns:[];
  const latest=turns[turns.length-1],activeTurn=[...turns].reverse().find(turn=>turn.status==='inProgress');
  if(status==='working'||status==='waiting'||activeTurn){task.turnId=activeTurn?.id;task.status=status==='waiting'?'waiting':'working';task.error=undefined;this.reserveWriter(task);task.updatedAt=Date.now();this.changed();return true;}
  if(latest?.status==='completed')task.status='finished';else if(latest?.status==='interrupted')task.status='interrupted';else if(latest?.status==='failed'||status==='failed')task.status='failed';else task.status=status==='idle'?'idle':'unknown';
  if(task.status==='unknown'){task.error='Provider state is unknown and could not be reconciled.';this.reserveWriter(task);task.updatedAt=Date.now();this.changed();throw Error(task.error);}
  this.gate.release(task.id);this.state.approvals=this.state.approvals.filter(a=>a.taskId!==task.id);task.error=latest?.error?.message;
  for(const item of latest?.items||[]){if(item.type!=='agentMessage'||!item.id||!item.text)continue;const message=task.messages.find(m=>m.id===item.id);if(message)message.text=item.text;else task.messages.push({id:item.id,role:'assistant',text:item.text,time:Date.now()});}
  task.updatedAt=Date.now();this.captain.settle(task);this.changed();return false;
 }
 async taskAction(id,run){if(this.taskActions.has(id))throw Error("This task already has a recovery or send operation in progress. Wait for it to finish.");this.taskActions.add(id);try{return await run();}finally{this.taskActions.delete(id);}}
 assertMissionSendAllowed(id){
  if(this.state.missions.some(m=>m.attempts.some(a=>a.taskIds.includes(id)&&['finished','failed','interrupted'].includes(a.status))))throw Object.assign(Error('Start a new attempt from the mission board to preserve the reviewed evidence.'),{code:'MISSION_REVIEW_LOCK'});
 }
 async send(id,prompt,alreadyAcquired=false){
  this.assertMissionSendAllowed(id);
  return this.taskAction(id,()=>this.sendUnlocked(id,prompt,alreadyAcquired));
 }
 async sendUnlocked(id,prompt,alreadyAcquired=false){this.validatePrompt(prompt);const task=this.task(id);if(task.external)throw Error('This task is managed in the original Codex app.');await this.ensure();if(!task.threadId)throw Error('This task did not start. Create a new task to retry.');const p=this.project(task.projectId);if(!alreadyAcquired&&['starting','working','waiting'].includes(task.status))throw Error('This task is still running. Stop it before sending another message.');if(task.captain){for(const child of this.state.tasks.filter(t=>t.parentTaskId===task.id&&t.status==='unknown'))await this.taskAction(child.id,()=>this.reconcile(child));}if(task.captain&&this.state.tasks.some(t=>t.parentTaskId===task.id&&['starting','working','waiting','unknown'].includes(t.status)))throw Error('Stop or reconcile the active crew assignment before continuing.');if(!alreadyAcquired){if(task.status==='unknown'){let active;try{active=await this.reconcile(task);}catch(e){task.error=e.message;this.changed();throw Error('This task may still be running and could not be reconciled. Reconnect, then interrupt it before retrying.');}if(active)throw Error('This task is still running. Interrupt it before sending another message.');}this.assertMissionSendAllowed(id);if(!task.captain)this.gate.acquire(id,p.path);}
  this.assertMissionSendAllowed(id);
  try{if(task.crewId==='luffy'&&(!task.captain||task.captainVersion!==3)){Object.assign(task,selectExecution(this.state.models,{model:task.model||this.state.settings.model,effort:task.effort},this.state.settings.routingPolicy));const previous=task.threadId;const r=await this.client.request('thread/start',{cwd:p.path,...((task.model||this.state.settings.model)?{model:task.model||this.state.settings.model}:{}),...await this.captain.options(p),developerInstructions:require('./crew.cjs').characterInstructions('luffy',roles.luffy)+'\n'+require('./captain.cjs').instructions});task.threadId=r.thread.id;task.model=r.model||task.model;task.effort=task.effort||r.reasoningEffort||undefined;task.captain=true;task.captainVersion=3;task.captainNeedsContext=true;task.tokenUsage=undefined;task.previousThreadId=previous;this.gate.release(id);this.loaded.add(id);this.captain.log(task,'Captain model routing enabled. Earlier messages remain in this log; the recent conversation will accompany your next message.');}if(task.captain)this.captain.reset(task);if(!this.loaded.has(id)){await this.client.request('thread/resume',{threadId:task.threadId});this.loaded.add(id);}this.assertMissionSendAllowed(id);task.messages.push({id:randomUUID(),role:'user',text:prompt,time:Date.now()});task.status='working';task.executionId=randomUUID();task.turnId=undefined;task.error=undefined;task.updatedAt=Date.now();this.changed();const result=await this.client.request('turn/start',{threadId:task.threadId,...(task.model?{model:task.model}:{}),...(task.effort?{effort:task.effort}:{}),input:[{type:'text',text:[this.growth.context(task.crewId,prompt,task.projectId),task.captain?routingContext(this.state.models,this.state.settings.routingPolicy)+'\nRecruited island specialists (only these island residents may receive delegated work): '+JSON.stringify(this.state.world.residents.filter(r=>r.recruited).map(r=>({id:r.id,role:r.role}))):'',task.captainNeedsContext?'Recent conversation for continuity (context only):\n'+task.messages.filter(m=>m.role!=='system').slice(-7,-1).map(m=>m.role+': '+m.text).join('\n').slice(-14000):'', 'Current captain message:',prompt].filter(Boolean).join('\n\n')}]},45000);task.turnId=result.turn.id;task.captainNeedsContext=false;this.changed();}
  catch(e){if(e.code==='MISSION_REVIEW_LOCK'){this.gate.release(id);throw e;}task.status='unknown';task.error=e.message;if(e.uncertain){try{await this.reconcile(task);}catch(reconcileError){task.error=e.message+' '+reconcileError.message;}}else this.gate.release(id);this.changed();throw e;}
 }
 async checkStatus(id){return this.taskAction(id,async()=>{const task=this.task(id);if(task.external||!task.threadId)throw Error('This task has no Sunny conversation to check.');try{await this.reconcile(task);return task;}catch(e){task.error=e.message;this.changed();throw e;}});}
 async interrupt(id){return this.taskAction(id,()=>this.interruptUnlocked(id));}
 async interruptUnlocked(id){const task=this.task(id);if(task.captain)await this.captain.stop(task);if(!task.threadId)throw Error('No active turn to interrupt.');if(task.status==='unknown'||!task.turnId){const active=await this.reconcile(task);if(!active)return;if(!task.turnId)throw Error('No active turn to interrupt.');}await this.client.request('turn/interrupt',{threadId:task.threadId,turnId:task.turnId});task.status='interrupted';this.gate.release(id);this.state.approvals=this.state.approvals.filter(a=>a.taskId!==id);this.captain.settle(task);this.changed();}
 async discuss({crew,topic}){
  if(!Array.isArray(crew)||crew.length!==2||crew[0]===crew[1]||!crew.every(id=>roles[id]))throw Error('Choose two different crewmates.');
  if(typeof topic!=='string'||!topic.trim()||topic.length>2000)throw Error('Write a discussion topic of up to 2,000 characters.');
  if(this.discussionRun)throw Error('One crew discussion is already underway.');
  const runner=new CrewChat();this.discussionRun=runner;
  const entry={id:randomUUID(),crew,topic:topic.trim(),messages:[],status:'working',time:Date.now()};this.state.discussions.unshift(entry);this.state.discussions=this.state.discussions.slice(0,100);this.changed();
  try{const cwd=path.join(this.home,'AppData','Local','Sunny HQ','crew-lounge');require('node:fs').mkdirSync(cwd,{recursive:true});
   await runner.run({home:this.home,cwd,crew,topic:entry.topic,model:this.state.settings.model,context:id=>this.growth.context(id,entry.topic),onMessage:message=>{entry.messages.push(message);this.emit('event',{type:'crew:line',data:{discussionId:entry.id,...message}});this.changed();}});
   entry.status='finished';this.growth.exchange(entry);return entry;
  }catch(e){entry.status=runner.cancelled?'interrupted':'failed';entry.error=e.message;throw e;}
  finally{this.discussionRun=null;this.changed();}
 }
 cancelDiscussion(){this.discussionRun?.cancel();}
 async handoff({taskId,crewId,prompt}){const task=this.task(taskId);if(['working','starting','waiting'].includes(task.status))throw Error('Finish or interrupt this task before handing it off.');const latest=[...task.messages].reverse().find(m=>m.role==='assistant')?.text||'';return this.start({projectId:task.projectId,crewId,title:'Handoff: '+task.title,prompt:`Handoff from ${task.crewId}: ${task.title}\n\nPrevious result (verify against current files):\n${latest.slice(-14000)}\n\nYour objective:\n${prompt||'Review the previous work and report the next useful step.'}`});}
 notification({method,params:p={}}){
 if(method==='account/updated'){this.state.codex.account=p.planType||p.authMode;this.state.codex.status=p.authMode?'connected':'sign-in required';this.changed();return;}
 if(method==='account/rateLimits/updated'){this.state.usage=p;this.changed();return;}
  if(method==='serverRequest/resolved'){const approval=this.state.approvals.find(a=>a.rpcId===p.requestId&&a.threadId===p.threadId);if(approval)this.resolveApproval(approval);return;}
  const task=this.state.tasks.find(t=>t.threadId===(p.threadId||p.thread?.id));if(!task)return;
  if(method==='thread/tokenUsage/updated'&&p.tokenUsage){const total=p.tokenUsage.total;if(total&&Number.isFinite(total.totalTokens)&&total.totalTokens>=0){task.tokenUsage=p.tokenUsage;this.changed();}return;}
  if(['turn/started','turn/completed','thread/status/changed','error'].includes(method))this.bumpTask(task);
  if(method==='turn/started'){task.turnId=p.turn?.id;task.status='working';}
  if(method==='item/agentMessage/delta'){let m=task.messages.find(m=>m.id===p.itemId);if(!m){m={id:p.itemId,role:'assistant',text:'',time:Date.now()};task.messages.push(m);}m.text+=p.delta||'';}
  if(method==='item/completed'&&p.item?.type==='agentMessage'){const item=p.item;let m=task.messages.find(m=>m.id===item.id);if(!m)task.messages.push({id:item.id,role:'assistant',text:item.text||'',time:Date.now()});else if(item.text)m.text=item.text;}
  if(['item/started','item/completed'].includes(method)&&p.item&&['commandExecution','fileChange','mcpToolCall','webSearch'].includes(p.item.type)){const item=p.item;const description=item.type==='commandExecution'?('Command: '+item.command+'\n'+(item.aggregatedOutput||'')):item.type==='fileChange'?('Files: '+(item.changes||[]).map(c=>c.path).join(', ')):item.type==='mcpToolCall'?('Tool: '+item.server+'/'+item.tool):('Web search: '+(item.query||''));const id='activity:'+item.id;const text=(method==='item/started'?'Started · ':'Completed · ')+description.slice(-16000);const existing=task.messages.find(m=>m.id===id);if(existing)existing.text=text;else task.messages.push({id,role:'system',text,time:Date.now()});}
  if(method==='thread/status/changed'&&['working','waiting','starting'].includes(task.status)){const next=deriveStatus(p.status);if(next==='working'||next==='waiting'||next==='failed')task.status=next;}
  if(method==='turn/completed'&&p.turn?.id&&task.turnId&&p.turn.id!==task.turnId)return;
  if(method==='turn/completed'){task.status=p.turn?.status==='completed'?'finished':p.turn?.status==='interrupted'?'interrupted':'failed';task.error=p.turn?.error?.message;this.gate.release(task.id);this.state.approvals=this.state.approvals.filter(a=>a.taskId!==task.id);this.growth.learn(task,p.turn?.id);this.emit('event',{type:'completed',data:{taskId:task.id,title:task.title,status:task.status}});}
  if(method==='error'){task.error=p.error?.message||p.message;if(!p.willRetry){task.status='failed';this.gate.release(task.id);}}
  if(task.status==='working'&&this.state.approvals.some(a=>a.taskId===task.id))task.status='waiting';
  if(method==='turn/completed'||(method==='error'&&!p.willRetry)){this.captain.settle(task);if(task.captain)this.captain.stop(task).catch(e=>{task.error=e.message;this.changed();});}task.updatedAt=Date.now();if(method==='item/agentMessage/delta')this.streamChanged(task);else this.changed();
 }
 request(request){if(request.method==='item/tool/call')return this.captain.call(request);const supported=['item/commandExecution/requestApproval','item/fileChange/requestApproval','item/permissions/requestApproval','item/tool/requestUserInput','mcpServer/elicitation/request'];if(!supported.includes(request.method)){this.client.rejectRequest(request.id,'Sunny does not support this request type yet. Use a supported tool.');return;}
  const task=this.state.tasks.find(t=>t.threadId===request.params?.threadId);
  if(this.state.approvals.some(a=>a.rpcId===request.id))return;
  let approval;try{approval=createApproval(request,task);}catch(error){this.client.rejectRequest(request.id,error.message);return;}
  this.state.approvals.push(approval);task.status='waiting';this.bumpTask(task);this.changed();
 }
 resolveApproval(approval){
  this.state.approvals=this.state.approvals.filter(a=>a.id!==approval.id);
  const task=this.state.tasks.find(t=>t.id===approval.taskId);
  if(task?.status==='waiting'&&task.threadId===approval.threadId&&task.executionId===approval.executionId&&(approval.turnId===null||task.turnId===approval.turnId)&&!this.state.approvals.some(a=>a.taskId===task.id))task.status='working';
  this.changed();
 }
 respond(input){const a=this.state.approvals.find(a=>a.id===input?.id);if(!a)throw Error('This request is no longer pending.');
  const result=approvalResult(a,input,this.state.tasks.find(t=>t.id===a.taskId));
  this.client.respond(a.rpcId,result);this.resolveApproval(a);
 }
 close(){this.closed=true;this.island.close();this.captain.disconnect();this.discussionRun?.cancel();clearTimeout(this.streamTimer);this.streamTasks?.clear();clearTimeout(this.checkpointTimer);clearTimeout(this.saveTimer);this.client.close();clearTimeout(this.saveTimer);this.persist();this.store.close();}
}
module.exports={Hub,roles};
