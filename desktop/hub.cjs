const {EventEmitter}=require('node:events');const {randomUUID}=require('node:crypto');const path=require('node:path');
const {CodexClient}=require('./codex.cjs');const {Growth}=require('./growth.cjs');const {CrewChat}=require('./crew-chat.cjs');const {TaskGate,deriveStatus}=require('./core.cjs');
const {selectExecution,routingContext}=require('./model-routing.cjs');
const {createApproval,approvalResult}=require('./approvals.cjs');
const {MissionBook}=require('./missions.cjs');
const {AuthorityCommitQueue,storageUncertain,receiptMatches}=require('./persistence-barriers.cjs');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const terminalStorage=error=>['STORE_FAILED','WORKER_EXIT','WORKER_TIMEOUT','WORKER_PROTOCOL','STORE_CLOSED'].includes(error?.code)||storageUncertain(error);
const {applyWorkspaceUpdate,claimAcceptanceCue}=require('./workspace-state.cjs');
const {ROLE_BINDINGS,resolveMissionRole,missionContext}=require('./mission-roles.cjs');
const crewRegistry=require('./crew-registry.cjs');
const skillCatalog=require('./skill-catalog.cjs');
const roles={luffy:'General assistant and mission planning',zoro:'Code review and security review',nami:'Planning and prioritization',usopp:'Tests and browser checks',sanji:'Interface design and product polish',chopper:'Debugging and failure investigation',robin:'Research and documentation',franky:'Feature implementation and architecture',brook:'Creative content and media workflows',jinbe:'Infrastructure and release preparation'};
Object.assign(roles,Object.fromEntries(require('./island-residents.json').map(r=>[r.id,r.role])));
class Hub extends EventEmitter {
 constructor({home,store,catalog,jevPrepare,engineeringRoute,fixtureDependencies}){super();if(fixtureDependencies&&(!fixtureDependencies.client||typeof fixtureDependencies.islandFactory!=='function'))throw Error('Invalid fixture dependencies.');this.home=home;this.store=store;this.catalog=catalog;this.client=fixtureDependencies?.client||new CodexClient();this.gate=new TaskGate(3);this.loaded=new Set();this.taskActions=new Set();this.captain=new (require('./captain.cjs').Captain)(this);this.saveTimer=null;this.preparingTurns=new Map();this.jevPrepare=jevPrepare||require('./jev-context.cjs').prepareJevContext;this.engineeringRoute=engineeringRoute||require('./engineering-routing.cjs').routeEngineering;this.routeEnabled=engineeringRoute?()=>true:require('./engineering-routing.cjs').engineeringRoutingEnabled;this.jevEnabled=jevPrepare?()=>true:require('./jev-context.cjs').enabledFor;
  const saved=store.load();this.savedProfile=structuredClone(saved);this.dirtyGeneration=0;this.savedGeneration=0;this.authorityQueue=new AuthorityCommitQueue({store});this.growth=new Growth(saved.growth);this.discussionRun=null;this.state={news:require('./news.cjs').initialNews(saved.news),world:require('./island.cjs').initialWorld(saved.world),growth:this.growth.data,discussions:(saved.discussions||[]).map(e=>({...e,status:e.status==='working'?'interrupted':e.status})),projects:saved.projects||catalog.discoverProjects(home),tasks:(saved.tasks||[]).map(t=>({...t,status:['working','waiting','starting'].includes(t.status)?'unknown':t.status})),tools:catalog.discoverTools(home),settings:{reducedMotion:false,notifications:true,roomSoundEnabled:false,roomSoundVolume:.32,routingPolicy:'efficient',...saved.settings},codex:{status:'disconnected'},approvals:[],models:[],usage:null,automations:catalog.discoverAutomations(home)};
  this.missionBook=new MissionBook(saved.missionBook);this.state.missions=this.missionBook.data.missions;this.state.workspace=this.missionBook.data.workspace;this.state.persistence={state:'saved',failures:0};this.state.missionRoles=ROLE_BINDINGS;this.missionPersistencePending=this.missionBook.recover(this.state.tasks);
  this.evidence=new (require('./mission-evidence.cjs').MissionEvidence)({git:catalog.getExecutable?.('git',home)||'git'});this.branches=new (require('./mission-branch.cjs').MissionBranch)(this.evidence);this.missionActions=new Set();this.pullRequests=new (require('./pull-request-evidence.cjs').PullRequestEvidence)({evidence:this.evidence,gh:catalog.getExecutable?.('gh',home)||'gh'});
  this.deployments=new (require('./deployment-evidence.cjs').DeploymentEvidence)({evidence:this.evidence,gh:catalog.getExecutable?.('gh',home)||'gh'});
  this.imageReader=require('./image-deliverables.cjs').readImageDeliverable;
  const {MissionPublisher,MissionPublication}=require('./mission-publisher.cjs');this.publisher=new MissionPublisher({evidence:this.evidence,git:catalog.getExecutable?.('git',home)||'git',gh:catalog.getExecutable?.('gh',home)||'gh'});this.publication=new MissionPublication(this);this.merger=new (require('./mission-merge.cjs').MissionMerge)(this);
  this.taskRevisions=new Map();for(const task of this.state.tasks)if(['unknown','working','waiting','starting'].includes(task.status))this.reserveWriter(task);
  this.launchingTasks=new Set();this.checkRuns=new Set();for(const mission of this.state.missions)if(mission.checkExecution){const project=this.project(mission.projectId);this.gate.active.set('mission-evidence:'+mission.id,path.resolve(project.path).toLowerCase());this.missionActions.add(mission.id);}
  this.island=fixtureDependencies?fixtureDependencies.islandFactory(this):new (require('./island.cjs').Island)(this);this.news=new (require('./news.cjs').News)(this);
  this.client.on('diagnostic',(message,details)=>{if(!['provider-decode-failed','provider-handler-failed'].includes(details?.event))return;this.emit('event',{type:'diagnostic',data:{event:details.event}});this.emit('event',{type:'error',data:{message}});});
  this.client.on('notification',e=>{Promise.resolve(this.notification(e)).catch(error=>this.reportAsync(error));});this.client.on('request',e=>{Promise.resolve(this.request(e)).catch(error=>this.reportAsync(error));});this.client.on('disconnected',error=>{for(const entry of this.preparingTurns.values())entry.controller.abort();this.state.codex={...this.state.codex,status:'disconnected',error};this.loaded.clear();for(const t of this.state.tasks)if(['working','waiting','starting'].includes(t.status)){t.status='unknown';this.bumpTask(t);}this.state.approvals=[];this.captain.disconnect();this.changed();});
 }
 initializeRecovery(){
  if(this.initializationPromise)return this.initializationPromise;
  this.initializationPromise=(async()=>{
   for(const task of this.state.tasks)if(this.hasTaskRecoveryIntent(task)){this.retainTaskRecovery(task);this.bumpTask(task);}
   this.missionBook.recover(this.state.tasks);
   const reserve=(mission,name)=>{this.gate.active.set(name+mission.id,path.resolve(this.project(mission.projectId).path).toLowerCase());this.missionActions.add(mission.id);};
   for(const mission of this.state.missions){
    if(mission.pendingAcceptance||mission.acceptanceRecovery)reserve(mission,'mission-accept:');
    if(mission.branch?.state==='preparing')reserve(mission,'mission-branch:');
    if(['publishing','uncertain'].includes(mission.prPublication?.state))reserve(mission,'mission-publication:');
    if(['submitting','uncertain'].includes(mission.mergeRequest?.state))reserve(mission,'mission-merge:');
   }
   const fenceCompleted=async()=>{
    let changed=false;
    for(const mission of this.state.missions){
     if(mission.status!=='COMPLETE'||mission.acceptance?.legacy===true||mission.acceptanceRecovery)continue;
     const status=await require('./mission-result-status.cjs').getMissionResultStatus({getState:()=>this.state,readArtifact:artifact=>this.readMissionResultArtifact(this.project(mission.projectId),artifact)},{projectId:mission.projectId,missionId:mission.id,revision:mission.revision});
     if(!status.available){const acceptance=mission.acceptance;mission.acceptanceRecovery={version:1,acceptanceId:acceptance.id,resultId:acceptance.resultId,resultSha256:acceptance.resultSha256,reason:'result-binding',detectedAt:Date.now()};this.missionBook.record(mission,'ACCEPTANCE_RECOVERY_REQUIRED',{acceptanceId:acceptance.id});reserve(mission,'mission-accept:');changed=true;}
    }
    if(changed)this.markDirty();return changed;
   };
   this.markDirty();await fenceCompleted();
   for(let pass=0;pass<16;pass++){await this.persist('mission');if(!await fenceCompleted()){this.recoveryReady=true;return this;}}
   throw Error('Results kept changing during startup recovery. Preserve the profile and inspect the selected files before restarting Sunny.');
  })();return this.initializationPromise;
 }
 async retryPersistence(){
  if(this.closed||this.quiescing||this.authorityQueue.uncertain||terminalStorage(this.lastPersistenceError))throw Error('Storage recovery requires a restart. Keep this window open to copy or export drafts, then restart Sunny; external work will not be replayed.');
  return this.persist('mission');
 }
 assertOpenForEffect(){if(this.closed||this.quiescing||this.authorityQueue.uncertain||terminalStorage(this.lastPersistenceError))throw Error('Sunny is stopping or storage needs recovery. Copy or export drafts before restarting.');}
 changed(){if(this.closed)return;this.markDirty();clearTimeout(this.streamTimer);this.streamTimer=null;this.streamTasks?.clear();this.queueMissionSync();this.scheduleSave();this.publishSnapshot();}
 markDirty(){this.dirtyGeneration++;this.state.persistence={...this.state.persistence,state:this.state.persistence.state==='unsaved'?'unsaved':'pending'};}
 reportAsync(error){try{this.emit('event',{type:'error',data:{message:error.message}});}catch{/* A failed surface cannot escape a provider/timer callback. */}}
 queueMissionSync(){if(this.syncQueued||(this.closed||this.quiescing))return;this.syncQueued=true;const generation=this.dirtyGeneration;this.missionMutation(book=>book.sync(this.state.tasks,this.state.approvals),'mission',{skipUnchanged:true}).catch(error=>{this.scheduleSave();this.reportAsync(error);}).finally(()=>{this.syncQueued=false;if(this.dirtyGeneration!==generation&&!(this.closed||this.quiescing))this.queueMissionSync();});}
 awaitMissionSync(){return this.missionMutation(book=>book.sync(this.state.tasks,this.state.approvals),'reservation-release',{skipUnchanged:true});}
 scheduleSave(){if(this.closed||this.quiescing||terminalStorage(this.lastPersistenceError))return;clearTimeout(this.saveTimer);this.saveTimer=setTimeout(()=>this.savePending(),250);if(!this.checkpointTimer)this.checkpointTimer=setTimeout(()=>this.savePending(),1000);}
 async savePending(){clearTimeout(this.saveTimer);clearTimeout(this.checkpointTimer);clearTimeout(this.saveRetryTimer);this.saveTimer=null;this.checkpointTimer=null;this.saveRetryTimer=null;if((this.closed||this.quiescing))return;try{await this.persist(null);}catch(error){if(error.code==='CHECKPOINT_SUPERSEDED')return;this.saveFailures=(this.saveFailures||0)+1;if(!(this.closed||this.quiescing)&&!terminalStorage(error))this.saveRetryTimer=setTimeout(()=>void this.savePending(),Math.min(30000,1000*2**Math.min(this.saveFailures-1,5)));if(this.saveFailures===1)this.reportAsync(error);}}
 streamChanged(task){if(this.closed)return;this.markDirty();this.bumpTask(task);if(this.quiescing){this.publishSnapshot();return;}this.streamTasks??=new Map();this.streamTasks.set(task.id,task);if(!this.streamTimer)this.streamTimer=setTimeout(()=>{this.streamTimer=null;for(const next of this.streamTasks.values())this.emit('event',{type:'task',data:next});this.streamTasks.clear();},50);this.scheduleSave();}
 persistedImage(book=this.missionBook.data){return structuredClone({...this.savedProfile,missionBook:book,news:this.state.news,world:this.state.world,projects:this.state.projects,tasks:this.state.tasks,settings:this.state.settings,growth:this.growth.data,discussions:this.state.discussions});}
 persistenceFailed(error){if(error.code==='CHECKPOINT_SUPERSEDED')return;error.persistence=true;this.lastPersistenceError=error;this.state.persistence={state:'unsaved',failures:this.state.persistence.failures+1,...(this.state.persistence.uncertain||storageUncertain(error)?{uncertain:true}:{})};this.publishPersistence();}
 persistenceSaved(image,generation,receipt){const recovering=this.state.persistence.state==='unsaved';this.savedProfile=image;this.savedGeneration=generation;this.lastReceipt=receipt;this.lastPersistenceError=null;this.saveFailures=0;this.state.persistence={state:generation===this.dirtyGeneration?'saved':'pending',failures:0};if(generation===this.dirtyGeneration){this.missionPersistencePending=false;clearTimeout(this.saveTimer);clearTimeout(this.checkpointTimer);clearTimeout(this.saveRetryTimer);this.saveTimer=null;this.checkpointTimer=null;this.saveRetryTimer=null;}else this.scheduleSave();this.publishPersistence();if(recovering)this.publishSnapshot();}
 persist(reason='mission',validate){
  const queuedBackground=reason===null&&this.authorityQueue.active;
  const prepare=()=>{
   // Initial generations are equal before recovered/default state is durable.
   // Only a queued background save covered by the latest published receipt can
   // avoid capturing. Required barriers, validation, errors and shutdown cannot.
   if(queuedBackground&&!validate&&this.recoveryReady===true&&!this.closed&&!this.quiescing&&!this.lastPersistenceError&&!this.authorityQueue.uncertain&&this.state.persistence.state==='saved'&&this.savedGeneration===this.dirtyGeneration&&receiptMatches(this.lastReceipt)&&this.lastReceipt.epoch===this.authorityQueue.receiptEpoch&&this.lastReceipt.sequence===this.authorityQueue.receiptSequence)return {skip:true,publish:()=>this.lastReceipt};
   const image=this.persistedImage(),generation=this.dirtyGeneration;return {image,validate:()=>validate?.(image),publish:receipt=>{this.persistenceSaved(image,generation,receipt);return receipt;},failed:error=>this.persistenceFailed(error)};
  };
  return reason===null?this.authorityQueue.checkpoint(prepare):this.authorityQueue.run(reason,prepare);
 }
 async taskDurable(task,reason='reservation-release'){for(let i=0;i<16;i++){try{return await this.authorityQueue.run(reason,()=>{const revision=this.taskRevisions.get(task.id)||0,binding={status:task.status,threadId:task.threadId,turnId:task.turnId,executionId:task.executionId,projectId:task.projectId,parentTaskId:task.parentTaskId},image=this.persistedImage(),generation=this.dirtyGeneration;return {image,validate:()=>{if((this.taskRevisions.get(task.id)||0)!==revision||Object.keys(binding).some(key=>task[key]!==binding[key]))throw Object.assign(Error('Task changed while saving its durable outcome.'),{code:'TASK_CHANGED'});},publish:receipt=>{this.persistenceSaved(image,generation,receipt);return receipt;},failed:error=>this.persistenceFailed(error)};});}catch(error){if(error.code!=='TASK_CHANGED')throw error;}}throw Error('Task is still changing. Reconcile its current outcome before releasing the reservation.');}
 prepareDispatch(task,prompt,prepared){this.pendingDispatches??=new Map();const dispatch={cancelled:false,executionId:null,threadId:task.threadId};this.pendingDispatches.set(task.id,dispatch);return this.authorityQueue.run('dispatch',()=>{if(dispatch.cancelled||(this.closed||this.quiescing))return {skip:true,publish:()=>dispatch};this.assertMissionSendAllowed(task.id);this.appendTaskMessage(task,{id:randomUUID(),role:'user',text:prompt,time:Date.now()});if(prepared?.activity)this.appendTaskMessage(task,{id:randomUUID(),role:'system',text:prepared.activity,time:Date.now()});task.status='working';task.executionId=randomUUID();task.turnId=undefined;task.error=undefined;task.updatedAt=Date.now();this.bumpTask(task);dispatch.executionId=task.executionId;this.changed();const image=this.persistedImage(),generation=this.dirtyGeneration;return {image,validate:()=>{if(dispatch.cancelled||(this.closed||this.quiescing)||task.status!=='working'||task.executionId!==dispatch.executionId||task.threadId!==dispatch.threadId||!this.client.connected)throw Object.assign(Error('Turn cancelled or changed before provider dispatch.'),{code:'DISPATCH_CANCELLED'});},publish:receipt=>{this.persistenceSaved(image,generation,receipt);return dispatch;},failed:error=>this.persistenceFailed(error)};});}
 missionMutation(run,reason='mission',options={}){
  return this.authorityQueue.run(reason,()=>{
   const base=this.missionBook.data,book=new MissionBook(base),result=run(book),changes=[];
   for(const next of book.data.missions){const prior=base.missions.find(m=>m.id===next.id);if(!same(prior,next))changes.push({prior:prior&&structuredClone(prior),next});}
   if(options.skipUnchanged&&!changes.length&&same(base.workspace,book.data.workspace))return {skip:true,publish:()=>result};
   const workspaceChanged=!same(base.workspace,book.data.workspace),workspaceBase=structuredClone(base.workspace),image=this.persistedImage(book.data),generation=this.dirtyGeneration;
   const validate=()=>{if((this.closed||this.quiescing)&&reason!=='shutdown')throw Error('Sunny closed before authority commit.');for(const {prior,next} of changes){const current=this.missionBook.data.missions.find(m=>m.id===next.id);if(prior?(current?.revision!==prior.revision||!same(current.activeAttemptId,prior.activeAttemptId)):current)throw Error('Mission changed during persistence. Review the current revision.');}if(workspaceChanged&&this.state.workspace.revision!==workspaceBase.revision)throw Error('Workspace changed during persistence. Preserve the newer draft.');options.validate?.();};
   const publish=receipt=>{for(const {prior,next} of changes){const current=this.missionBook.data.missions.find(m=>m.id===next.id);if(!prior)this.missionBook.data.missions.unshift(next);else for(const key of new Set([...Object.keys(prior),...Object.keys(next)]))if(!same(prior[key],next[key])){if(next[key]===undefined)delete current[key];else current[key]=structuredClone(next[key]);}}if(workspaceChanged){this.missionBook.data.workspace=book.data.workspace;this.state.workspace=book.data.workspace;}this.persistenceSaved(image,generation,receipt);this.publishSnapshot();if(result&&changes.some(change=>change.next===result))return this.missionBook.get(result.id);return result;};
   return {image,validate,publish,failed:error=>this.persistenceFailed(error),compensate:async error=>{const corrected=this.persistedImage();for(const {prior,next} of changes){let current=corrected.missionBook.missions.find(m=>m.id===next.id);if(!current&&prior){current=structuredClone(prior);corrected.missionBook.missions.unshift(current);}if(current){if(!prior)corrected.missionBook.missions=corrected.missionBook.missions.filter(m=>m.id!==next.id);else {for(const key of new Set([...Object.keys(prior),...Object.keys(next)]))if(!same(prior[key],next[key])&&same(current[key],next[key])){if(prior[key]===undefined)delete current[key];else current[key]=structuredClone(prior[key]);}}}}const correctiveGeneration=this.dirtyGeneration;let receipt;try{receipt=await this.store.barrier(corrected,reason);if(!receiptMatches(receipt,corrected))throw Error('Corrective receipt mismatch');}catch(cause){throw Object.assign(Error('Authority correction is unresolved: '+cause.message),{code:'COMMIT_UNCERTAIN',uncertain:true,cause});}this.persistenceSaved(corrected,correctiveGeneration,receipt);throw error;}};
  });
 }
 publishSnapshot(){try{this.emit('event',{type:'snapshot',data:this.state});}catch{/* A surface cannot change durable authority. */}}
 publishPersistence(){try{this.emit('event',{type:'persistence',data:this.state.persistence});}catch{/* A disposed surface cannot change the outcome of a durable save. */}}
 updateWorkspace(input){if((this.closed||this.quiescing))return Promise.reject(Error('Sunny is closed. Preserve your draft and reopen it.'));input=structuredClone(input);return this.missionMutation(book=>{book.data.workspace=applyWorkspaceUpdate(book.data.workspace,input,this.state);return book.data.workspace;},'workspace');}
 claimAcceptanceCue(input){if((this.closed||this.quiescing))return Promise.resolve({play:false});let binding;return this.missionMutation(book=>{const claim=claimAcceptanceCue(book.data.workspace,input,this.state);if(claim.play){const mission=this.state.missions.find(m=>m.acceptance?.id===input.acceptanceId);if(mission.pendingAcceptance||mission.acceptanceRecovery||this.state.persistence.uncertain)throw Error('Acceptance persistence is unresolved.');binding={missionId:mission.id,revision:mission.revision,acceptanceId:mission.acceptance.id};book.data.workspace=claim.workspace;}return {play:claim.play};},'cue',{skipUnchanged:true,validate:()=>{if(!binding)return;const mission=this.missionBook.get(binding.missionId);if(mission.revision!==binding.revision||mission.acceptance?.id!==binding.acceptanceId||mission.pendingAcceptance||mission.acceptanceRecovery)throw Error('Acceptance changed before cue ownership was saved.');const project=this.project(mission.projectId);require('./mission-results.cjs').verifyMissionResultCurrent({mission:{...mission,status:'WAITING_FOR_REVIEW'},tasks:this.state.tasks,ref:mission.selectedResult.ref,producerTaskId:mission.selectedResult.producerTaskId,readArtifact:artifact=>this.readMissionResultArtifact(project,artifact)});}});}
 async markMissionSignalSeen(input){this.validateMissionAction(input,['missionId','revision','eventId']);if(this.missionActions.has(input.missionId))throw Error('Wait for the current mission action before marking this signal seen.');return this.missionMutation(book=>book.markSignalSeen(input.missionId,input.revision,input.eventId));}
 async createMission(input){this.project(input?.projectId);input=structuredClone(input);return this.missionMutation(book=>book.create(input));}
 async prepareMissionBranch(input){
  this.validateMissionAction(input,['missionId','revision']);
  const mission=this.missionBook.get(input.missionId);this.missionBook.check(mission,input.revision);
  if(mission.status!=='DRAFT'||mission.attempts.length)throw Error('Prepare the branch before the first mission attempt.');
  const project=this.project(mission.projectId),lock='mission-branch:'+mission.id;
  this.branchRuns??=new Set();const recovering=mission.branch?.state==='preparing'&&this.gate.active.has(lock)&&!this.branchRuns.has(mission.id);
  if(this.missionActions.has(mission.id)&&!recovering)throw Error('Wait for the current mission action.');
  if(!recovering)this.gate.acquire(lock,project.path);this.missionActions.add(mission.id);this.branchRuns.add(mission.id);
  let switched=Boolean(mission.branch?.state==='preparing'),durableResult=false;
  try{
   if(mission.branch){
    const observed=await this.branches.inspect(project.path,mission.branch);
    if(!observed.ready)throw Error('Branch preparation is unresolved. Inspect the checkout; Sunny will not repeat or overwrite the switch.');
   }else{
    const plan=await this.branches.plan(project.path,mission.id);
    await this.missionMutation(book=>{const current=book.get(mission.id);book.check(current,input.revision);current.branch=plan;book.record(current,'BRANCH_PREPARING',{branch:plan.name,baseCommit:plan.baseCommit});});
    switched=true;
    this.assertOpenForEffect();await this.branches.create(project.path,plan,()=>this.assertOpenForEffect());
   }
   if((this.closed||this.quiescing))throw Error('Sunny closed during branch preparation. Reconcile it before launch.');
   const result=await this.missionMutation(book=>{const current=book.get(mission.id);current.branch.state='ready';book.record(current,'BRANCH_READY',{branch:current.branch.name,baseCommit:current.branch.baseCommit});return current.branch;},'reservation-release');durableResult=true;return result;
  }finally{this.branchRuns.delete(mission.id);if(durableResult||(!switched&&!this.authorityQueue.uncertain)){this.gate.release(lock);this.missionActions.delete(mission.id);}}
 }
 async startMission(input){
  this.validateMissionAction(input,['missionId','revision','crewId','roleId','selectedSkills','requestedChanges']);
  if(this.missionActions.has(input.missionId)){const pending=this.missionBook.get(input.missionId);if(pending.branch?.state==='preparing')throw Error('Reconcile the prepared branch before another mission attempt.');if(['publishing','uncertain'].includes(pending.prPublication?.state))throw Error('Reconcile the existing publication before another mission attempt.');throw Error('Wait for the mission evidence check to finish.');}
  const route=resolveMissionRole(input,ROLE_BINDINGS,this.state.world);
  const mission=this.missionBook.get(input.missionId);this.missionBook.check(mission,input.revision);
  if(input.requestedChanges!==undefined){if(typeof input.requestedChanges!=='string'||!input.requestedChanges.trim()||input.requestedChanges.length>50000||input.requestedChanges.includes('\0'))throw Error('Provide nonempty bounded captain requested changes.');if(mission.status!=='WAITING_FOR_REVIEW')throw Error('Captain rework changes require a mission waiting for review.');}
  if(['submitting','uncertain'].includes(mission.mergeRequest?.state))throw Error('Reconcile the merge request before starting another attempt.');if(['publishing','uncertain'].includes(mission.prPublication?.state))throw Error('Reconcile the uncertain PR publication before starting another attempt.');const project=this.project(mission.projectId);if(mission.branch)await this.branches.validate(project.path,mission.branch);
  await this.ensure();const selectedSkills=await skillCatalog.resolveSelectedSkills(this.client,project.path,this.home,input.selectedSkills);
  crewRegistry.assertCrewBinding(route,this.state.world);if(route.roleId!=='coordinator'&&selectedSkills.some(skill=>!skillCatalog.skillFitsRole(skill,route.roleId)))throw Error('The selected skill does not fit this mission role. Review the skill choices.');
  const {mission:launchMission,attempt}=await this.missionMutation(book=>{const current=book.get(input.missionId);const next=book.begin(current.id,input.revision,input.requestedChanges);next.routing=route;next.selectedSkills=selectedSkills.map(skill=>({...skill}));if(route.roleId==='coordinator')next.workflowVersion=1;book.record(current,'ROUTING_DECIDED',{roleId:route.roleId,crewId:route.crewId,provider:route.provider,reason:route.reason,skills:selectedSkills.map(skill=>skill.id)});return {mission:current,attempt:next};});
  try{return await this.start({projectId:launchMission.projectId,crewId:route.crewId,title:launchMission.title,selectionReason:route.reason,prompt:missionContext(launchMission,route)},{id:attempt.taskId,mission:true,resolvedSkills:selectedSkills,crewBinding:route});}
  catch(error){if(!this.state.tasks.some(t=>t.id===attempt.taskId)&&!storageUncertain(error))await this.missionMutation(book=>book.launchFailed(input.missionId,attempt.id,error.message));throw error;}
 }
 readMissionResultArtifact(project,artifact){return artifact.kind==='image'?require('./mission-deliverables.cjs').readProjectFile(project.path,artifact.filePath,{extensions:['.png'],limit:8*1024*1024}):require('./mission-deliverables.cjs').readDeliverable(project.path,artifact.filePath);}
 async selectMissionResult(input){
  this.validateMissionAction(input,['missionId','revision','ref','producerTaskId']);
  const {resolveMissionResult,validateMissionResultRef}=require('./mission-results.cjs'),ref=validateMissionResultRef(input.ref);
  if(this.missionActions.has(input.missionId))throw Error('Wait for the current mission action before selecting its result.');
  const mission=this.missionBook.get(input.missionId);this.missionBook.check(mission,input.revision);
  if(mission.status!=='WAITING_FOR_REVIEW')throw Error('Mission is not ready for review.');
  const project=this.project(mission.projectId),lock='mission-result:'+mission.id,attemptId=mission.activeAttemptId;
  this.gate.acquire(lock,project.path);this.missionActions.add(mission.id);
  try{
   const result=await resolveMissionResult({mission,tasks:this.state.tasks,ref,producerTaskId:input.producerTaskId,readArtifact:artifact=>this.readMissionResultArtifact(project,artifact)});
   if((this.closed||this.quiescing))throw Error('Sunny closed before result selection could be saved.');
   return await this.missionMutation(book=>{const current=book.get(mission.id);book.check(current,input.revision);if(current.activeAttemptId!==attemptId)throw Error('Mission attempt changed during result review.');require('./mission-results.cjs').verifyMissionResultCurrent({mission:current,tasks:this.state.tasks,...result,readArtifact:artifact=>this.readMissionResultArtifact(project,artifact)});current.selectedResult={id:randomUUID(),attemptId,...result,selectedAt:Date.now()};book.record(current,'RESULT_SELECTED',{resultId:current.selectedResult.id,producerTaskId:result.producerTaskId});return current;},'mission',{validate:()=>require('./mission-results.cjs').verifyMissionResultCurrent({mission:this.missionBook.get(mission.id),tasks:this.state.tasks,...result,readArtifact:artifact=>this.readMissionResultArtifact(project,artifact)})});
  }finally{if(!this.authorityQueue.uncertain){this.gate.release(lock);this.missionActions.delete(mission.id);}}
 }
 async acceptMission(input){
  this.validateMissionAction(input,['missionId','revision','resultId','resultSha256','criteria']);
  input={...input,criteria:Array.isArray(input.criteria)?[...input.criteria]:input.criteria};
  if(this.missionActions.has(input.missionId))throw Error('Wait for the mission evidence check to finish.');
  const mission=this.missionBook.get(input.missionId);this.missionBook.check(mission,input.revision);
  if(mission.status!=='WAITING_FOR_REVIEW')throw Error('Mission is not ready for review.');
  if(mission.checkExecution)throw Error('Resolve the project check before acceptance.');
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
    if(merged.url!==prior.url||merged.commit!==prior.commit||merged.fingerprint!==prior.fingerprint||merged.baseBranch!==prior.baseBranch)throw Error('Pull-request source, target or identity changed. Inspect it and review the new evidence first.');
    if(merged.state!=='MERGED'||!Number.isFinite(Date.parse(merged.mergedAt)))throw Error('The pull request has not been verified as merged.');
    if(merged.checkStatus!=='passed')throw Error('The merged pull request must have passing checks before completion.');
   }
   const selected=mission.selectedResult;
   if(!selected||typeof input.resultId!=='string'||input.resultId!==selected.id||typeof input.resultSha256!=='string'||input.resultSha256!==selected.ref.sha256)throw Error('Review and select the exact mission result before acceptance.');
   const result=await require('./mission-results.cjs').resolveMissionResult({mission,tasks:this.state.tasks,ref:selected.ref,producerTaskId:selected.producerTaskId,readArtifact:artifact=>this.readMissionResultArtifact(project,artifact)});
   if((this.closed||this.quiescing))throw Error('Sunny closed before acceptance could be saved.');
   // Apply the same acceptance rules before submitting a durable pending intent.
   // Invalid captain input must not reach the worker's terminal profile validator.
   const preflightBook=new MissionBook(this.missionBook.data),preflightMission=preflightBook.get(input.missionId);let preflightProof;
   if(merged){preflightProof={...merged,id:randomUUID(),attemptId:preflightMission.activeAttemptId,projectId:project.id,producer:'sunny-local-verifier'};preflightMission.artifacts.push(preflightProof);}
   preflightBook.accept(input.missionId,input.revision,input.criteria,{...result,resultId:selected.id,attemptId:selected.attemptId},preflightProof);
   const validateBinding=async(expectedRevision)=>{
    const current=this.missionBook.get(input.missionId);this.missionBook.check(current,expectedRevision);
    if(current.activeAttemptId!==selected.attemptId||current.selectedResult?.id!==selected.id||!same(current.selectedResult?.ref,result.ref))throw Error('Selected mission result changed during acceptance.');
    require('./mission-results.cjs').verifyMissionResultCurrent({mission:{...current,status:'WAITING_FOR_REVIEW'},tasks:this.state.tasks,...result,readArtifact:artifact=>this.readMissionResultArtifact(project,artifact)});
    for(const artifact of deliverables.values())if(this.readMissionResultArtifact(project,artifact).sha256!==artifact.sha256)throw Error('Deliverable changed since review. Attach and review its current version.');
    if(checks.size){const source=await this.evidence.gitState(project.path);if([...checks.values()].some(check=>check.fingerprint!==source.fingerprint))throw Error('Source changed during acceptance. Run the stale checks again.');}
    if(merged){const fresh=await this.pullRequests.inspect(project.path,merged.number);if(!same({url:fresh.url,commit:fresh.commit,fingerprint:fresh.fingerprint,baseBranch:fresh.baseBranch,state:fresh.state,mergedAt:fresh.mergedAt,checkStatus:fresh.checkStatus},{url:merged.url,commit:merged.commit,fingerprint:merged.fingerprint,baseBranch:merged.baseBranch,state:merged.state,mergedAt:merged.mergedAt,checkStatus:merged.checkStatus}))throw Error('Merged proof changed during acceptance.');}
    const latest=this.missionBook.get(input.missionId);this.missionBook.check(latest,expectedRevision);require('./mission-results.cjs').verifyMissionResultCurrent({mission:{...latest,status:'WAITING_FOR_REVIEW'},tasks:this.state.tasks,...result,readArtifact:artifact=>this.readMissionResultArtifact(project,artifact)});for(const artifact of deliverables.values())if(this.readMissionResultArtifact(project,artifact).sha256!==artifact.sha256)throw Error('Deliverable changed during acceptance.');if((this.closed||this.quiescing))throw Error('Sunny closed during acceptance.');
   };
   const intent={id:randomUUID(),attemptId:selected.attemptId,reviewedRevision:input.revision,resultId:selected.id,resultSha256:selected.ref.sha256,producerTaskId:selected.producerTaskId,ref:structuredClone(selected.ref),criteria:[...input.criteria],createdAt:Date.now()};
   let ownAcceptanceId;
   const rejectIntent=async error=>{
    const book=new MissionBook(this.missionBook.data),current=book.get(input.missionId);
    if(current.pendingAcceptance?.id===intent.id)delete current.pendingAcceptance;
    if(current.acceptance?.id===ownAcceptanceId&&ownAcceptanceId){delete current.acceptance;delete current.acceptedAt;current.status='WAITING_FOR_REVIEW';}
    book.record(current,'ACCEPTANCE_REJECTED',{intentId:intent.id,message:String(error.message).slice(0,1000)});
    const image=this.persistedImage(book.data),generation=this.dirtyGeneration;let receipt;
    try{receipt=await this.store.barrier(image,'acceptance');if(!receiptMatches(receipt,image))throw Error('Corrective receipt mismatch');}catch(cause){throw Object.assign(Error('Acceptance correction is unresolved: '+cause.message),{code:'COMMIT_UNCERTAIN',uncertain:true,cause});}
    const live=this.missionBook.get(input.missionId);if(live.revision!==current.revision-1)throw Object.assign(Error('Acceptance correction was superseded; reconciliation remains unresolved.'),{code:'COMMIT_UNCERTAIN',uncertain:true});if(live.pendingAcceptance?.id===intent.id)delete live.pendingAcceptance;if(live.acceptance?.id===ownAcceptanceId&&ownAcceptanceId){delete live.acceptance;delete live.acceptedAt;live.status='WAITING_FOR_REVIEW';}live.events=current.events;live.revision=current.revision;live.updatedAt=current.updatedAt;this.persistenceSaved(image,generation,receipt);
   };
   return await this.authorityQueue.run('acceptance',async()=>{
    await validateBinding(input.revision);const book=new MissionBook(this.missionBook.data),candidate=book.get(input.missionId);candidate.pendingAcceptance=intent;book.record(candidate,'ACCEPTANCE_PENDING',{intentId:intent.id});const image=this.persistedImage(book.data),generation=this.dirtyGeneration;
    return {image,validate:()=>validateBinding(input.revision),failed:error=>this.persistenceFailed(error),compensate:rejectIntent,publish:async receipt=>{
     const live=this.missionBook.get(input.missionId);live.pendingAcceptance=structuredClone(intent);live.revision=candidate.revision;live.updatedAt=candidate.updatedAt;live.events=candidate.events;this.persistenceSaved(image,generation,receipt);
     try{
      await validateBinding(live.revision);const finalBook=new MissionBook(this.missionBook.data),finalMission=finalBook.get(input.missionId);let proof;if(merged){proof={...merged,id:randomUUID(),attemptId:finalMission.activeAttemptId,projectId:project.id,producer:'sunny-local-verifier'};finalMission.artifacts.push(proof);}
      delete finalMission.pendingAcceptance;finalBook.accept(input.missionId,finalMission.revision,input.criteria,{...result,resultId:selected.id,attemptId:selected.attemptId},proof);ownAcceptanceId=finalMission.acceptance.id;
      const finalImage=this.persistedImage(finalBook.data),finalGeneration=this.dirtyGeneration,revision=live.revision,finalReceipt=await this.store.barrier(finalImage,'acceptance');if(!receiptMatches(finalReceipt,finalImage))throw Object.assign(Error('Final acceptance receipt mismatch.'),{code:'COMMIT_UNCERTAIN',uncertain:true});
      await validateBinding(revision);Object.assign(live,finalMission);delete live.pendingAcceptance;this.persistenceSaved(finalImage,finalGeneration,finalReceipt);this.publishSnapshot();return live;
     }catch(error){if(!storageUncertain(error))await rejectIntent(error);throw error;}
    }};
   });
  }finally{if(!this.authorityQueue.uncertain&&!this.missionBook.get(mission.id).pendingAcceptance){this.gate.release(lock);this.missionActions.delete(mission.id);}}
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
  this.gate.acquire(lock,project.path);this.missionActions.add(mission.id);if(input.script)this.checkRuns.add(mission.id);
  let effectStarted=false;
  try{
   await this.missionMutation(book=>{const current=book.get(mission.id);book.check(current,input.revision);if(input.script)current.checkExecution={id:randomUUID(),attemptId,script:input.script,startedAt:Date.now()};book.record(current,input.script?'TEST_STARTED':'EVIDENCE_STARTED',{script:input.script||null});},input.script?'check-intent':'mission');
   const revision=mission.revision;
   this.assertOpenForEffect();effectStarted=true;
   const evidence=input.imagePath!==undefined?(({dataUrl,...metadata})=>({...metadata,provenance}))(this.imageReader(project.path,input.imagePath)):input.deployment===true?await this.deployments.inspect(project.path):input.filePath!==undefined?(({text,...metadata})=>metadata)(require('./mission-deliverables.cjs').readDeliverable(project.path,input.filePath)):input.prNumber!==undefined?await this.pullRequests.inspect(project.path,input.prNumber):input.script?await this.evidence.runCheck(project.path,input.script,()=>this.assertOpenForEffect()):await this.evidence.gitState(project.path);
   if((this.closed||this.quiescing))throw Error('Sunny closed before the check result could be attached.');
   return await this.missionMutation(book=>{
    const current=book.get(mission.id);book.check(current,revision);
    if(current.activeAttemptId!==attemptId)throw Error('The mission attempt changed during verification.');
    const artifact={...evidence,id:randomUUID(),attemptId,projectId:project.id,producer:'sunny-local-verifier'};current.artifacts.push(artifact);
    if(input.script)current.checkExecution=undefined;
    book.record(current,evidence.kind==='check'?(evidence.status==='passed'?'TEST_PASSED':'TEST_FAILED'):evidence.kind==='pull-request'?'PR_UPDATED':['deliverable','image'].includes(evidence.kind)?'DELIVERABLE_ATTACHED':evidence.kind==='deployment'?'DEPLOYMENT_INSPECTED':'GIT_INSPECTED',{artifactId:artifact.id});return artifact;
   },'reservation-release');
  }catch(error){if(!(this.closed||this.quiescing)&&!storageUncertain(error))await this.missionMutation(book=>{const current=book.get(mission.id);if(input.script&&effectStarted&&!error.uncertain&&!error.persistence&&current.checkExecution){current.artifacts.push({id:randomUUID(),kind:'check',attemptId,projectId:project.id,producer:'sunny-local-verifier',script:input.script,command:'npm run '+input.script,status:'failed',exitCode:null,recordedAt:Date.now()});delete current.checkExecution;}book.record(current,'EVIDENCE_FAILED',{message:String(error.message).slice(0,1000),uncertain:Boolean(error.persistence&&effectStarted)});});throw error;}
  finally{this.checkRuns.delete(mission.id);if(!this.missionBook.get(mission.id).checkExecution){this.gate.release(lock);this.missionActions.delete(mission.id);}}
 }
 async reconcileMissionCheck(input){
  this.validateMissionAction(input,['missionId','revision','executionId','confirmedStopped']);
  const mission=this.missionBook.get(input.missionId);this.missionBook.check(mission,input.revision);const execution=mission.checkExecution;
  if(!execution||execution.id!==input.executionId||input.confirmedStopped!==true)throw Error('Confirm the current unresolved check after verifying all its processes have stopped.');
  if(this.checkRuns.has(mission.id))throw Error('This check call is still running. Wait for it to finish before reconciling.');
  await this.missionMutation(book=>{const current=book.get(mission.id);book.check(current,input.revision);if(current.checkExecution?.id!==execution.id)throw Error('Check execution changed during persistence.');current.artifacts.push({id:randomUUID(),kind:'check',attemptId:execution.attemptId,projectId:current.projectId,producer:'captain-stop-confirmation',script:execution.script,command:'npm run '+execution.script,status:'failed',exitCode:null,recordedAt:Date.now()});delete current.checkExecution;book.record(current,'CHECK_STOP_CONFIRMED',{executionId:execution.id,actor:'captain',verification:'human-attestation'});},'reservation-release');
  this.gate.release('mission-evidence:'+mission.id);this.missionActions.delete(mission.id);
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
 async connect(){if(this.closed||this.quiescing)throw Error('Sunny is stopping. Copy or export drafts before restarting.');this.state.codex={status:'connecting'};this.changed();try{const init=await this.client.connect(this.home);const account=await this.client.request('account/read',{refreshToken:false});this.state.codex={status:account.account?'connected':'sign-in required',version:init?.userAgent,account:account.account?.planType||account.account?.type};
  const results=await Promise.allSettled([this.client.request('model/list',{}),this.client.request('account/rateLimits/read',{}),this.refreshTools()]);if(results[0].status==='fulfilled')this.state.models=results[0].value.data||[];if(results[1].status==='fulfilled')this.state.usage=results[1].value;this.changed();return this.state.codex;
 }catch(e){this.state.codex={status:'disconnected',error:e.message};this.changed();throw e;}}
 async refreshTools(){const tools=this.catalog.discoverTools(this.home);if(this.client.connected){try{const r=await this.client.request('app/installed',{});for(const a of r.apps||[])tools.push({id:'app:'+a.id,name:a.runtimeName||a.id,category:'Connected apps',description:'Available to Codex tasks through your existing account. Ask the crew to use this connection.',status:a.callable?'available in Codex':a.enabled?'needs setup':'disabled'});}catch(e){tools.push({id:'app-discovery',name:'Connected apps',category:'Connected apps',description:e.message,status:'unavailable'});}
 try{const r=await this.client.request('skills/list',{cwds:this.state.projects.slice(0,12).map(p=>p.path)},15000);for(const scope of r.data||[]){for(const skill of scope.skills||[]){const id='skill:'+skill.path;if(!tools.some(t=>t.id===id||t.path===skill.path))tools.push({id,name:skill.name,category:'Skills',description:skill.description||'Codex skill',status:skill.enabled===false?'disabled':'available in Codex',path:skill.path});}}}catch{/* Local discovery remains an explicit installed-only fallback. */}}
 this.state.tools=tools;this.changed();return tools;}
 async ensure(){if(this.closed||this.quiescing)throw Error('Sunny is stopping. Copy or export drafts before restarting.');if(!this.client.connected)await this.connect();if(this.state.codex.status!=='connected')throw Error('Sign in to Codex from Settings before starting work.');}
 async suggestSkills(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['projectId','brief','roleId','crewId'].includes(key))||typeof input.projectId!=='string'||typeof input.brief!=='string'||input.brief.length>12000||typeof (input.roleId||input.crewId)!=='string')throw Error('Invalid skill suggestion request.');
  const project=this.project(input.projectId);await this.ensure();const catalog=await skillCatalog.catalogForProject(this.client,project.path,this.home);
  const role=skillCatalog.roleOf(input.roleId||input.crewId);
  const available=catalog.filter(skill=>role==='coordinator'||skillCatalog.skillFitsRole(skill,role));
  return {available,suggested:skillCatalog.suggestSkills(available,input.brief,role)};
 }
 async start({projectId,crewId,prompt,title,model,effort,selectionReason,selectedSkills},internal={}){
  const crewBinding=internal.crewBinding||crewRegistry.assertWorkerBinding(crewRegistry.crewBinding(crewId,this.state.world));if(crewBinding.crewId!==crewId)throw Error('Crew choice conflicts with the selected role.');crewRegistry.assertCrewBinding(crewBinding,this.state.world);this.validatePrompt(prompt);const p=this.project(projectId);await this.ensure();if((this.closed||this.quiescing)||internal.cancelled?.())throw Error('Job cancelled before launch.');
  const inherited=internal.parentTaskId&&!selectedSkills?skillCatalog.skillsForRole(this.state.tasks.find(task=>task.id===internal.parentTaskId)?.selectedSkills||[],crewId).map(skill=>({id:skill.id,revision:skill.revision})):undefined;
  const confirmed=internal.resolvedSkills||await skillCatalog.resolveSelectedSkills(this.client,p.path,this.home,selectedSkills??inherited);
  crewRegistry.assertCrewBinding(crewBinding,this.state.world);if(crewId!=='luffy'&&confirmed.some(skill=>!skillCatalog.skillFitsRole(skill,crewId)))throw Error('The selected skill does not fit this specialist. Review the skill choices.');
  const execution=selectExecution(this.state.models,{model:model||this.state.settings.model,effort},this.state.settings.routingPolicy);
  const captain=crewId==='luffy'&&!internal.parentTaskId;if(captain&&this.state.tasks.filter(t=>t.captain&&['starting','working','waiting','unknown'].includes(t.status)).length>=3)throw Error('Finish or reconcile an active captain conversation first.');const task={id:internal.id||randomUUID(),title:title||prompt.slice(0,65),projectId,crewId,crewBinding:structuredClone(crewBinding),captain,captainVersion:captain?3:undefined,...execution,explicitExecution:Boolean(model||effort||this.state.settings.model),selectionReason,selectedSkills:confirmed.map(skill=>({...skill})),parentTaskId:internal.parentTaskId,jobId:internal.jobId,status:'starting',createdAt:Date.now(),updatedAt:Date.now(),messages:[]};let admitted=false,externalStarted=false;this.launchControls??=new Map();const launchControl={cancelled:false,dispatched:false};
  try{
   await this.authorityQueue.run('dispatch',()=>{crewRegistry.assertCrewBinding(crewBinding,this.state.world);if((this.closed||this.quiescing)||internal.cancelled?.())throw Error('Job cancelled before launch.');if(!captain)this.gate.acquire(task.id,p.path);admitted=true;this.launchControls.set(task.id,launchControl);this.launchingTasks.add(task.id);this.state.tasks.unshift(task);this.seedTranscript(task);this.markDirty();const image=this.persistedImage(),generation=this.dirtyGeneration;return {image,validate:()=>{crewRegistry.assertCrewBinding(crewBinding,this.state.world);if((this.closed||this.quiescing)||launchControl.cancelled||internal.cancelled?.()||task.status!=='starting'||!this.client.connected)throw Error('Task changed or cancelled before provider dispatch.');if(internal.parentTaskId){const parent=this.task(internal.parentTaskId);if(!['working','waiting'].includes(parent.status)||this.captain.stopping.has(parent.id))throw Error('Captain turn stopped before assignment dispatch.');}},publish:receipt=>this.persistenceSaved(image,generation,receipt),failed:error=>this.persistenceFailed(error)};});
   const options=captain?await this.captain.options(p):{};crewRegistry.assertCrewBinding(crewBinding,this.state.world);if((this.closed||this.quiescing)||internal.cancelled?.()||task.status!=='starting'||!this.client.connected)throw Error('Task cancelled before provider dispatch.');externalStarted=true;launchControl.dispatched=true;
   const r=await this.client.request('thread/start',{cwd:p.path,...(task.model?{model:task.model}:{}),sandbox:'workspace-write',approvalPolicy:'on-request',...options,developerInstructions:require('./crew.cjs').characterInstructions(crewId,this.state.world.residents.find(r=>r.id===crewId)?.role||roles[crewId])+(captain?'\n'+require('./captain.cjs').instructions:'')});task.threadId=r.thread.id;task.model=r.model||task.model;task.effort=task.effort||r.reasoningEffort||undefined;this.loaded.add(task.id);this.markDirty();await this.taskDurable(task,'dispatch');if(launchControl.cancelled||internal.cancelled?.()||(this.closed||this.quiescing)){task.status='interrupted';this.changed();await this.taskDurable(task);await this.releaseTaskReservation(task);return task;}await this.send(task.id,prompt,true);return task;
  }catch(error){if(admitted){if(launchControl.cancelled&&!externalStarted)task.status='interrupted';else if(!(error.uncertain&&task.threadId&&['working','waiting'].includes(task.status)))task.status=storageUncertain(error)||error.uncertain||(error.persistence&&externalStarted)?'unknown':'failed';task.error=error.message;this.changed();if(!storageUncertain(error)&&!error.uncertain&&!(error.persistence&&externalStarted)){await this.taskDurable(task);await this.releaseTaskReservation(task);}}throw error;}finally{this.launchControls.delete(task.id);this.launchingTasks.delete(task.id);}
 }
 validatePrompt(prompt){if(typeof prompt!=='string'||!prompt.trim())throw Error('Write a message first.');if(prompt.length>100000)throw Error('Message is too long. Attach a file or shorten it.');}
 hasTaskRecoveryIntent(task){return Boolean(task?.toolDispatchIntent||task?.replacementThreadIntent||(task?.approvalResponseIntent&&task.approvalResponseIntent.state!=='submitted'));}
 reserveWriter(task){if(task.external||(task.captain&&!this.hasTaskRecoveryIntent(task)))return;const project=this.state.projects.find(p=>p.id===task.projectId);if(project?.path)this.gate.active.set(task.id,path.resolve(project.path).toLowerCase());}
 retainTaskRecovery(task){if(!this.hasTaskRecoveryIntent(task))return false;const changed=task.status!=='unknown'||!task.error;task.status='unknown';task.error||='Task effect outcome remains unresolved. Reconcile it before continuing.';this.reserveWriter(task);if(changed){this.markDirty();this.scheduleSave();}return true;}
 async releaseTaskReservation(task){if(this.retainTaskRecovery(task)){this.bumpTask(task);this.changed();await this.taskDurable(task);await this.awaitMissionSync();return false;}this.gate.release(task.id);return true;}
 seedTranscript(task){this.emit('transcript:seed',task);}
 transcriptMutation(task,change){this.emit('transcript:mutation',task,change);}
 appendTaskMessage(task,message){this.seedTranscript(task);task.messages.push(message);this.transcriptMutation(task,{kind:'appendMessage',messageId:message.id});return message;}
 bumpTask(task){this.taskRevisions.set(task.id,(this.taskRevisions.get(task.id)||0)+1);}
 async reconcile(task){
  if(this.retainTaskRecovery(task))throw Error('Reconcile the unresolved task effect before using provider task status to release this checkout.');
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
  this.state.approvals=this.state.approvals.filter(a=>a.taskId!==task.id);task.error=latest?.error?.message;
  for(const item of latest?.items||[]){if(item.type!=='agentMessage'||!item.id||!item.text)continue;const message=task.messages.find(m=>m.id===item.id);if(message){message.text=item.text;this.transcriptMutation(task,{kind:'invalidate'});}else this.appendTaskMessage(task,{id:item.id,role:'assistant',text:item.text,time:Date.now()});}
  task.updatedAt=Date.now();this.bumpTask(task);this.changed();await this.taskDurable(task);await this.awaitMissionSync();await this.releaseTaskReservation(task);if(!this.hasTaskRecoveryIntent(task))await this.captain.settle(task);return false;
 }
 async taskAction(id,run){if(this.taskActions.has(id))throw Error("This task already has a recovery or send operation in progress. Wait for it to finish.");this.taskActions.add(id);try{return await run();}finally{this.taskActions.delete(id);}}
 assertMissionSendAllowed(id){
  const task=this.state.tasks.find(t=>t.id===id),terminal=status=>['finished','failed','interrupted'].includes(status);
  if(this.hasTaskRecoveryIntent(task))throw Object.assign(Error('Reconcile the unresolved task effect outcome before sending another turn.'),{code:'TASK_RECOVERY_REQUIRED'});
  if(this.state.missions.some(m=>m.attempts.some(a=>a.taskIds.includes(id)&&(terminal(a.status)||(a.workflowVersion===1&&id!==a.taskId&&terminal(task?.status))))))throw Object.assign(Error('Start a new attempt from the mission board to preserve the reviewed evidence.'),{code:'MISSION_REVIEW_LOCK'});
 }
 async send(id,prompt,alreadyAcquired=false){
  this.assertMissionSendAllowed(id);
  return this.taskAction(id,()=>this.sendUnlocked(id,prompt,alreadyAcquired));
 }
 async sendUnlocked(id,prompt,alreadyAcquired=false){this.validatePrompt(prompt);const task=this.task(id);if(task.external)throw Error('This task is managed in the original Codex app.');await this.ensure();if(!task.threadId)throw Error('This task did not start. Create a new task to retry.');const p=this.project(task.projectId);if(!alreadyAcquired&&['starting','working','waiting'].includes(task.status))throw Error('This task is still running. Stop it before sending another message.');if(task.captain){for(const child of this.state.tasks.filter(t=>t.parentTaskId===task.id&&t.status==='unknown'))await this.taskAction(child.id,()=>this.reconcile(child));}if(task.captain&&this.state.tasks.some(t=>t.parentTaskId===task.id&&['starting','working','waiting','unknown'].includes(t.status)))throw Error('Stop or reconcile the active crew assignment before continuing.');if(!alreadyAcquired){if(task.status==='unknown'){let active;try{active=await this.reconcile(task);}catch(e){task.error=e.message;this.changed();throw Error('This task may still be running and could not be reconciled. Reconnect, then interrupt it before retrying.');}if(active)throw Error('This task is still running. Interrupt it before sending another message.');}this.assertMissionSendAllowed(id);if(!task.captain)this.gate.acquire(id,p.path);}
  this.assertMissionSendAllowed(id);let turnDispatched=false;
  try{if(task.crewId==='luffy'&&(!task.captain||task.captainVersion!==3)){Object.assign(task,selectExecution(this.state.models,{model:task.model||this.state.settings.model,effort:task.effort},this.state.settings.routingPolicy));const previous=task.threadId;task.replacementThreadIntent={id:randomUUID(),previousThreadId:previous,createdAt:Date.now()};this.markDirty();await this.taskDurable(task,'dispatch');if((this.closed||this.quiescing)||!this.client.connected)throw Error('Captain replacement cancelled before dispatch.');const replacementOptions=await this.captain.options(p);this.assertOpenForEffect();const r=await this.client.request('thread/start',{cwd:p.path,...((task.model||this.state.settings.model)?{model:task.model||this.state.settings.model}:{}),...replacementOptions,developerInstructions:require('./crew.cjs').characterInstructions('luffy',roles.luffy)+'\n'+require('./captain.cjs').instructions});task.threadId=r.thread.id;task.model=r.model||task.model;task.effort=task.effort||r.reasoningEffort||undefined;task.captain=true;task.captainVersion=3;task.captainNeedsContext=true;task.tokenUsage=undefined;task.previousThreadId=previous;delete task.replacementThreadIntent;this.markDirty();await this.taskDurable(task,'reservation-release');await this.releaseTaskReservation(task);this.loaded.add(id);this.captain.log(task,'Captain model routing enabled. Earlier messages remain in this log; the recent conversation will accompany your next message.');}if(task.captain)this.captain.reset(task);if(!this.loaded.has(id)){await this.client.request('thread/resume',{threadId:task.threadId});this.loaded.add(id);}this.assertMissionSendAllowed(id);let prepared;
   if(this.jevEnabled(this,task)){const pending=await this.prepareTurnContext(task,prompt);if(!this.finishTurnPreparation(task,pending))return task;prepared=pending.result;
    if(pending.route?.status==='selected'){
     if(pending.route.execution&&!task.explicitExecution){try{Object.assign(task,selectExecution(this.state.models,pending.route.execution,this.state.settings.routingPolicy));this.markDirty();}catch{pending.route={status:'fallback',reason:'CATALOG_CHANGED'};}}
     if(pending.route.status==='selected'){
      if(!task.explicitExecution){task.selectionReason=pending.route.reason||`Jev selected ${pending.route.lane} coding lane.`;this.markDirty();this.scheduleSave();}
      prepared.activity=[prepared.activity,`Jev routing: ${pending.route.lane}.`].filter(Boolean).join(' ');
      prepared.suggestion=[prepared.suggestion,require('./engineering-routing.cjs').guidanceForLane(pending.route.lane)].filter(Boolean).join('\n');
     }
    }
    if(pending.route?.status==='fallback')prepared.activity=[prepared.activity,`Jev routing unavailable (${pending.route.reason}); using current execution.`].filter(Boolean).join(' ');
   }
   const selectedInputs=alreadyAcquired?skillCatalog.skillInputs(skillCatalog.skillsForRole(task.selectedSkills||[],task.crewId)):[];
   if(alreadyAcquired&&task.crewBinding)crewRegistry.assertCrewBinding(task.crewBinding,this.state.world);const dispatch=await this.prepareDispatch(task,prompt,prepared);if(dispatch.cancelled||(this.closed||this.quiescing)||task.status!=='working'||task.executionId!==dispatch.executionId||task.threadId!==dispatch.threadId||!this.client.connected)return task;this.assertMissionSendAllowed(id);if(alreadyAcquired&&task.crewBinding)crewRegistry.assertCrewBinding(task.crewBinding,this.state.world);turnDispatched=true;this.pendingDispatches.delete(id);const result=await this.client.request('turn/start',{threadId:task.threadId,...(task.model?{model:task.model}:{}),...(task.effort?{effort:task.effort}:{}),input:[{type:'text',text:[prepared?prepared.journal:this.growth.context(task.crewId,prompt,task.projectId),prepared?.suggestion,task.captain?routingContext(this.state.models,this.state.settings.routingPolicy)+'\nRecruited island specialists (only these island residents may receive delegated work): '+JSON.stringify(this.state.world.residents.filter(r=>r.recruited).map(r=>({id:r.id,role:r.role}))):'',task.captainNeedsContext?'Recent conversation for continuity (context only):\n'+task.messages.filter(m=>m.role!=='system').slice(-7,-1).map(m=>m.role+': '+m.text).join('\n').slice(-14000):'', 'Current captain message:',prompt].filter(Boolean).join('\n\n')},...selectedInputs]},45000);task.turnId=result.turn.id;task.captainNeedsContext=false;this.changed();}
  catch(e){if(e.code==='AUTHORITY_SATURATED'){await this.releaseTaskReservation(task);throw e;}if(e.code==='DISPATCH_CANCELLED'&&this.pendingDispatches?.get(id)?.cancelled){await this.taskDurable(task);await this.awaitMissionSync();await this.releaseTaskReservation(task);return task;}if(e.code==='MISSION_REVIEW_LOCK'){await this.taskDurable(task);await this.awaitMissionSync();await this.releaseTaskReservation(task);throw e;}task.status='unknown';task.error=e.message;this.changed();if(e.uncertain&&!storageUncertain(e)){try{await this.reconcile(task);}catch(reconcileError){task.error=e.message+' '+reconcileError.message;this.changed();}}if(e.code==='MISSION_REVIEW_LOCK'||(!storageUncertain(e)&&!e.uncertain&&!(e.persistence&&turnDispatched))){await this.taskDurable(task);await this.releaseTaskReservation(task);}else this.reserveWriter(task);throw e;}finally{this.pendingDispatches?.delete(id);}
 }
 async prepareTurnContext(task,prompt){
  const controller=new AbortController();this.bumpTask(task);
  const entry={controller,revision:this.taskRevisions.get(task.id)||0,projectId:task.projectId,projectPath:this.project(task.projectId).path};
  this.preparingTurns.set(task.id,entry);task.status='starting';task.turnId=undefined;this.changed();
  let resolveAbort;const aborted=new Promise(resolve=>resolveAbort=resolve);
  const onAbort=()=>resolveAbort({status:'cancelled'});controller.signal.addEventListener('abort',onAbort,{once:true});
  try{
   entry.result=await Promise.race([Promise.resolve().then(()=>this.jevPrepare({hub:this,task,prompt,signal:controller.signal,revision:String(entry.revision)})),aborted]);
   if(this.routeEnabled(this,task)&&!controller.signal.aborted&&entry.result?.status!=='cancelled'){
    try{entry.route=await Promise.race([Promise.resolve().then(()=>this.engineeringRoute({prompt,models:this.state.models,signal:controller.signal,explicit:task.explicitExecution})),aborted]);}
    catch{entry.route={status:'fallback',reason:'ROUTER_ERROR'};}
   }
  }catch{
   entry.result={status:'fallback',journal:this.growth.context(task.crewId,prompt,task.projectId),suggestion:'',activity:'Jev advice unavailable; using existing context.'};
  }finally{controller.signal.removeEventListener('abort',onAbort);}
  return entry;
 }
 finishTurnPreparation(task,entry){
  const current=this.preparingTurns.get(task.id)===entry;
  if(current)this.preparingTurns.delete(task.id);
  if((this.closed||this.quiescing))return false;
  const project=this.state.projects.find(p=>p.id===entry.projectId);
  const valid=current&&!entry.controller.signal.aborted&&entry.result?.status!=='cancelled'
   &&task.status==='starting'&&(this.taskRevisions.get(task.id)||0)===entry.revision
   &&task.projectId===entry.projectId&&project?.path===entry.projectPath&&this.client.connected
   &&(task.captain||this.gate.active.get(task.id)===path.resolve(project.path).toLowerCase());
  if(!valid){
   if(task.status!=='interrupted'){task.status='unknown';this.reserveWriter(task);}
   this.changed();return false;
  }
  this.assertMissionSendAllowed(task.id);return true;
 }
 async cancelTurnPreparation(id){
  const entry=this.preparingTurns.get(id);if(!entry)return false;
  this.preparingTurns.delete(id);entry.controller.abort();const task=this.task(id);
  task.status='interrupted';task.updatedAt=Date.now();this.bumpTask(task);this.changed();await this.taskDurable(task);await this.awaitMissionSync();await this.releaseTaskReservation(task);
  if(!this.hasTaskRecoveryIntent(task))await this.captain.settle(task);return true;
 }
 async checkStatus(id){return this.taskAction(id,async()=>{const task=this.task(id);if(task.external||!task.threadId)throw Error('This task has no Sunny conversation to check.');try{await this.reconcile(task);return task;}catch(e){task.error=e.message;this.changed();throw e;}});}
 async resolveMissingThread(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['taskId','expectedUpdatedAt','confirmedStopped'].includes(k))||typeof input.taskId!=='string'||!input.taskId||!Number.isFinite(input.expectedUpdatedAt)||input.confirmedStopped!==true)throw Error('Confirm that this task and its processes have stopped.');
  return this.taskAction(input.taskId,async()=>{
   const task=this.task(input.taskId);
   if(task.external)throw Error('Only local Sunny tasks can use this recovery.');
   if(this.hasTaskRecoveryIntent(task))throw Error('Stopped processes cannot certify the unresolved task effect outcome. Reconcile it before releasing this checkout.');
   if(task.status!=='unknown'||task.threadId)throw Error('Recovery requires an unknown task without a saved thread.');
   if((task.updatedAt??0)!==input.expectedUpdatedAt)throw Error('Task changed. Inspect it again before confirming.');
   if(this.launchingTasks.has(task.id))throw Error('A launch is still pending. Wait before resolving this task.');
   const family=new Set([task.id]);let added=true;while(added){added=false;for(const child of this.state.tasks)if(family.has(child.parentTaskId)&&!family.has(child.id)){family.add(child.id);added=true;}}
   if(this.state.tasks.some(child=>child.id!==task.id&&family.has(child.id)&&['starting','working','waiting','unknown'].includes(child.status)))throw Error('Resolve the active descendant assignments first.');
   await this.authorityQueue.run('reservation-release',()=>{
    if(task.status!=='unknown'||task.threadId||(task.updatedAt??0)!==input.expectedUpdatedAt)throw Error('Task changed before stopped confirmation.');
    const candidate=structuredClone(task);candidate.status='interrupted';delete candidate.error;candidate.updatedAt=Date.now();candidate.messages.push({id:randomUUID(),role:'system',time:candidate.updatedAt,text:'Captain confirmed that this task and its processes have stopped. Provider execution could not be verified because the saved thread ID is missing. Recorded as interrupted; start a new task or mission attempt.'});const book=new MissionBook(this.missionBook.data),tasks=this.state.tasks.map(t=>t.id===task.id?candidate:t);book.sync(tasks,this.state.approvals);const image=this.persistedImage(book.data);image.tasks=structuredClone(tasks);const generation=this.dirtyGeneration,revision=this.taskRevisions.get(task.id)||0;
    return {image,validate:()=>{if((this.taskRevisions.get(task.id)||0)!==revision||task.status!=='unknown'||task.threadId)throw Error('Task changed during stopped confirmation.');},publish:receipt=>{task.status=candidate.status;delete task.error;task.updatedAt=candidate.updatedAt;this.appendTaskMessage(task,candidate.messages.at(-1));for(const next of book.data.missions){const current=this.missionBook.get(next.id);if(current.revision!==next.revision)Object.assign(current,next);}this.persistenceSaved(image,generation,receipt);this.publishSnapshot();return task;},failed:error=>this.persistenceFailed(error)};
   });
   await this.releaseTaskReservation(task);this.bumpTask(task);return task;
  });
 }
 async interrupt(id){const launch=this.launchControls?.get(id);if(launch&&!launch.dispatched){launch.cancelled=true;const task=this.task(id);task.status='interrupted';this.bumpTask(task);this.changed();await this.taskDurable(task);await this.awaitMissionSync();await this.releaseTaskReservation(task);return task;}if(this.preparingTurns.has(id)&&await this.cancelTurnPreparation(id))return this.task(id);const pending=this.pendingDispatches?.get(id);if(pending){pending.cancelled=true;const task=this.task(id);task.status='interrupted';this.bumpTask(task);this.changed();await this.taskDurable(task);await this.awaitMissionSync();await this.releaseTaskReservation(task);return task;}return this.taskAction(id,()=>this.interruptUnlocked(id));}
 async interruptUnlocked(id){const task=this.task(id);if(task.captain)await this.captain.stop(task);if(this.retainTaskRecovery(task)){if(!task.threadId||!task.turnId)throw Error('No known turn can be interrupted; the task effect outcome remains unresolved.');await this.client.request('turn/interrupt',{threadId:task.threadId,turnId:task.turnId});this.state.approvals=this.state.approvals.filter(a=>a.taskId!==id);task.updatedAt=Date.now();this.bumpTask(task);this.changed();await this.taskDurable(task);await this.awaitMissionSync();return task;}if(!task.threadId)throw Error('No active turn to interrupt.');if(task.status==='unknown'||!task.turnId){const active=await this.reconcile(task);if(!active)return;if(!task.turnId)throw Error('No active turn to interrupt.');}await this.client.request('turn/interrupt',{threadId:task.threadId,turnId:task.turnId});task.status='interrupted';this.state.approvals=this.state.approvals.filter(a=>a.taskId!==id);this.bumpTask(task);this.changed();await this.taskDurable(task);await this.awaitMissionSync();await this.releaseTaskReservation(task);if(!this.hasTaskRecoveryIntent(task))await this.captain.settle(task);}
 async discuss({crew,topic}){
  if(!Array.isArray(crew)||crew.length!==2||crew[0]===crew[1]||!crew.every(id=>roles[id]))throw Error('Choose two different crewmates.');
  if(typeof topic!=='string'||!topic.trim()||topic.length>2000)throw Error('Write a discussion topic of up to 2,000 characters.');
  if(this.discussionRun)throw Error('One crew discussion is already underway.');
  const runner=new CrewChat();this.discussionRun=runner;
  const entry={id:randomUUID(),crew,topic:topic.trim(),messages:[],status:'working',time:Date.now()};this.state.discussions.unshift(entry);this.state.discussions=this.state.discussions.slice(0,100);this.changed();
  try{const cwd=path.join(this.home,'AppData','Local','Sunny HQ','crew-lounge');require('node:fs').mkdirSync(cwd,{recursive:true});
   await runner.run({home:this.home,cwd,crew,topic:entry.topic,model:this.state.settings.model,context:id=>this.growth.context(id,entry.topic),beforeDispatch:async binding=>{entry.dispatchIntent={id:randomUUID(),...binding,createdAt:Date.now()};this.changed();await this.persist('dispatch',()=>{if((this.closed||this.quiescing)||runner.cancelled||this.discussionRun!==runner||entry.status!=='working')throw Error('Discussion cancelled before dispatch.');});},onMessage:message=>{entry.messages.push(message);this.emit('event',{type:'crew:line',data:{discussionId:entry.id,...message}});this.changed();}});
   entry.status='finished';delete entry.dispatchIntent;this.growth.exchange(entry);this.changed();await this.persist('reservation-release');return entry;
  }catch(e){entry.status=runner.cancelled?'interrupted':'failed';entry.error=e.message;throw e;}
  finally{this.discussionRun=null;this.changed();if(!(this.closed||this.quiescing)&&!this.authorityQueue.uncertain)await this.persist('reservation-release');}
 }
 cancelDiscussion(){this.discussionRun?.cancel();}
 async handoff({taskId,crewId,prompt}){this.assertMissionSendAllowed(taskId);const task=this.task(taskId);if(['working','starting','waiting'].includes(task.status))throw Error('Finish or interrupt this task before handing it off.');const latest=[...task.messages].reverse().find(m=>m.role==='assistant')?.text||'';return this.start({projectId:task.projectId,crewId,title:'Handoff: '+task.title,prompt:`Handoff from ${task.crewId}: ${task.title}\n\nPrevious result (verify against current files):\n${latest.slice(-14000)}\n\nYour objective:\n${prompt||'Review the previous work and report the next useful step.'}`});}
 async notification({method,params:p={}}){
 if(method==='account/updated'){this.state.codex.account=p.planType||p.authMode;this.state.codex.status=p.authMode?'connected':'sign-in required';this.changed();return;}
 if(method==='account/rateLimits/updated'){this.state.usage=p;this.changed();return;}
  if(method==='serverRequest/resolved'){const approval=this.state.approvals.find(a=>a.rpcId===p.requestId&&a.threadId===p.threadId);if(approval)this.resolveApproval(approval);return;}
  const threadId=p.threadId||p.thread?.id;if(typeof threadId!=='string'||!threadId.trim())return;
  const task=this.state.tasks.find(t=>t.threadId===threadId);if(!task)return;
  if(method==='turn/started'&&(!['starting','working','waiting','unknown'].includes(task.status)||typeof p.turn?.id!=='string'||!p.turn.id||(task.turnId&&task.turnId!==p.turn.id)))return;
  if(method==='thread/tokenUsage/updated'&&p.tokenUsage){const total=p.tokenUsage.total;if(total&&Number.isFinite(total.totalTokens)&&total.totalTokens>=0){task.tokenUsage=p.tokenUsage;this.changed();}return;}
  if(['turn/started','turn/completed','thread/status/changed','error'].includes(method))this.bumpTask(task);
  if(method==='turn/started'){task.turnId=p.turn?.id;task.status='working';}
  if(method==='item/agentMessage/delta'){let m=task.messages.find(m=>m.id===p.itemId);if(!m){m={id:p.itemId,role:'assistant',text:'',time:Date.now()};this.appendTaskMessage(task,m);}const offset=m.text.length,delta=p.delta||'';m.text+=delta;if(delta)this.transcriptMutation(task,{kind:'appendText',messageId:m.id,offset,text:delta});}
  if(method==='item/completed'&&p.item?.type==='agentMessage'){const item=p.item;let m=task.messages.find(m=>m.id===item.id);if(!m)this.appendTaskMessage(task,{id:item.id,role:'assistant',text:item.text||'',time:Date.now()});else if(item.text){m.text=item.text;this.transcriptMutation(task,{kind:'invalidate'});}}
  if(['item/started','item/completed'].includes(method)&&p.item?.type==='imageGeneration'){
   const status=['in_progress','completed','failed','cancelled'].includes(p.item.status)?p.item.status.replaceAll('_',' '):'status unavailable';
   const id='activity:'+p.item.id,text=(method==='item/started'?'Started':'Completed')+' · Image generation · '+status+'. Inspect any output before attaching it for review.';
   const existing=task.messages.find(m=>m.id===id);if(existing){existing.text=text;this.transcriptMutation(task,{kind:'invalidate'});}else this.appendTaskMessage(task,{id,role:'system',text,time:Date.now()});
  }
  if(['item/started','item/completed'].includes(method)&&p.item&&['commandExecution','fileChange','mcpToolCall','webSearch'].includes(p.item.type)){const item=p.item;const description=item.type==='commandExecution'?('Command: '+item.command+'\n'+(item.aggregatedOutput||'')):item.type==='fileChange'?('Files: '+(item.changes||[]).map(c=>c.path).join(', ')):item.type==='mcpToolCall'?('Tool: '+item.server+'/'+item.tool):('Web search: '+(item.query||''));const id='activity:'+item.id;const text=(method==='item/started'?'Started · ':'Completed · ')+description.slice(-16000);const existing=task.messages.find(m=>m.id===id);if(existing){existing.text=text;this.transcriptMutation(task,{kind:'invalidate'});}else this.appendTaskMessage(task,{id,role:'system',text,time:Date.now()});}
  if(method==='thread/status/changed'&&['working','waiting','starting'].includes(task.status)){const next=deriveStatus(p.status);if(next==='working'||next==='waiting'||next==='failed')task.status=next;}
  if(method==='turn/completed'&&p.turn?.id&&task.turnId&&p.turn.id!==task.turnId)return;
  if(method==='turn/completed'){task.status=p.turn?.status==='completed'?'finished':p.turn?.status==='interrupted'?'interrupted':'failed';task.error=p.turn?.error?.message;this.state.approvals=this.state.approvals.filter(a=>a.taskId!==task.id);if(!this.hasTaskRecoveryIntent(task))this.growth.learn(task,p.turn?.id);}
  if(method==='error'){task.error=p.error?.message||p.message;if(!p.willRetry)task.status='failed';}
  if(['turn/started','turn/completed','thread/status/changed','error'].includes(method))this.retainTaskRecovery(task);
  if(task.status==='working'&&this.state.approvals.some(a=>a.taskId===task.id))task.status='waiting';
  task.updatedAt=Date.now();this.bumpTask(task);if(method==='item/agentMessage/delta')this.streamChanged(task);else this.changed();
  if(method==='turn/completed'||(method==='error'&&!p.willRetry)){try{await this.taskDurable(task);await this.awaitMissionSync();if(!(await this.releaseTaskReservation(task)))return;this.emit('event',{type:'completed',data:{taskId:task.id,title:task.title,status:task.status}});if(!this.hasTaskRecoveryIntent(task))await this.captain.settle(task);if(task.captain)await this.captain.stop(task);this.publishSnapshot();}catch(error){this.reserveWriter(task);task.error='Outcome persistence needs attention: '+error.message;this.changed();this.reportAsync(error);throw error;}}
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
 async respond(input){const a=this.state.approvals.find(a=>a.id===input?.id);if(!a)throw Error('This request is no longer pending.');
  input=structuredClone(input);const task=this.task(a.taskId),result=approvalResult(a,input,task),intent={id:randomUUID(),approvalId:a.id,threadId:a.threadId,turnId:a.turnId,executionId:a.executionId,decision:input.decision,result:structuredClone(result),state:'prepared',createdAt:Date.now()};
  await this.authorityQueue.run('dispatch',()=>{const image=this.persistedImage(),candidate=image.tasks.find(t=>t.id===task.id),generation=this.dirtyGeneration;candidate.approvalResponseIntent=intent;return {image,validate:()=>{if(!this.state.approvals.includes(a)||(this.closed||this.quiescing))throw Error('This request is no longer pending.');approvalResult(a,input,task);},publish:receipt=>{task.approvalResponseIntent=intent;this.persistenceSaved(image,generation,receipt);},failed:error=>this.persistenceFailed(error)};});
  if(!this.state.approvals.includes(a)||(this.closed||this.quiescing))throw Error('This request is no longer pending.');approvalResult(a,input,task);this.client.respond(a.rpcId,result);intent.state='submitted';intent.submittedAt=Date.now();this.resolveApproval(a);await this.taskDurable(task,'mission');
 }
 async callTool({taskId,server,name,arguments:args={}}){
  const task=this.task(taskId);if(!task.threadId||task.external)throw Error('Start a local Sunny task first.');if(typeof server!=='string'||!server||server.length>100||typeof name!=='string'||!name||name.length>200||!args||typeof args!=='object'||Array.isArray(args))throw Error('Invalid tool call.');args=structuredClone(args);
  return this.taskAction(taskId,async()=>{
   if(this.hasTaskRecoveryIntent(task))throw Error('Reconcile the unresolved task effect before another tool call.');const threadId=task.threadId,executionId=task.executionId,intent={id:randomUUID(),server,name,threadId,arguments:args,createdAt:Date.now()},root=path.resolve(this.project(task.projectId).path).toLowerCase();let temporaryReservation=false,effectStarted=false;
   const validate=()=>{if((this.closed||this.quiescing)||task.threadId!==threadId||task.executionId!==executionId||!this.client.connected)throw Error('Task changed before tool dispatch.');};
   try{
    await this.authorityQueue.run('dispatch',()=>{validate();if(this.hasTaskRecoveryIntent(task))throw Error('Reconcile the unresolved task effect before tool dispatch.');if(this.gate.active.has(task.id)){if(this.gate.active.get(task.id)!==root)throw Error('Task checkout reservation changed before tool dispatch.');}else{this.gate.acquire(task.id,root);temporaryReservation=true;}const image=this.persistedImage(),candidate=image.tasks.find(t=>t.id===task.id),generation=this.dirtyGeneration;candidate.toolDispatchIntent=intent;return {image,validate,publish:receipt=>{task.toolDispatchIntent=intent;this.persistenceSaved(image,generation,receipt);},failed:error=>this.persistenceFailed(error)};});
    validate();effectStarted=true;const result=await this.client.request('mcpServer/tool/call',{threadId,server,name,arguments:args});await this.authorityQueue.run('reservation-release',()=>{if(task.toolDispatchIntent?.id!==intent.id)throw Error('Tool dispatch intent changed.');const image=this.persistedImage(),generation=this.dirtyGeneration;delete image.tasks.find(t=>t.id===task.id).toolDispatchIntent;return {image,validate:()=>{if(task.toolDispatchIntent?.id!==intent.id)throw Error('Tool dispatch intent changed.');},publish:receipt=>{delete task.toolDispatchIntent;this.persistenceSaved(image,generation,receipt);if(temporaryReservation&&this.gate.active.get(task.id)===root&&!['unknown','working','waiting','starting'].includes(task.status))this.gate.release(task.id);},failed:error=>this.persistenceFailed(error)};});return result;
   }catch(error){if(effectStarted||storageUncertain(error)||error.durable){task.toolDispatchIntent??=intent;task.error='Tool outcome needs reconciliation: '+error.message;this.retainTaskRecovery(task);this.bumpTask(task);this.changed();}else if(temporaryReservation&&!this.hasTaskRecoveryIntent(task)&&this.gate.active.get(task.id)===root)this.gate.release(task.id);throw error;}
  });
 }
 close(){
  if(this.closePromise)return this.closePromise;
  this.quiescing=true;this.authorityQueue.stopAdmission();
  this.closePromise=(async()=>{
   let savedGeneration;
   try{
    for(const entry of this.preparingTurns.values())entry.controller.abort();for(const control of this.launchControls?.values()||[])control.cancelled=true;for(const dispatch of this.pendingDispatches?.values()||[])dispatch.cancelled=true;
    this.island.close();this.captain.disconnect();this.discussionRun?.cancel();clearTimeout(this.streamTimer);this.streamTimer=null;this.streamTasks?.clear();clearTimeout(this.checkpointTimer);clearTimeout(this.saveTimer);clearTimeout(this.saveRetryTimer);this.client.close();
    // An unpublished committed image can be newer than this live Hub. A failed
    // or uncertain flush must reject before any latest-live-image write occurs.
    await this.authorityQueue.flush();
    for(let pass=0;pass<16;pass++){
     const book=new MissionBook(this.missionBook.data);book.recover(this.state.tasks);const image=this.persistedImage(book.data),generation=this.dirtyGeneration,receipt=await this.store.barrier(image,'shutdown');
     if(!receiptMatches(receipt))throw Object.assign(Error('Shutdown storage receipt is unresolved.'),{code:'COMMIT_UNCERTAIN',uncertain:true});
     for(const candidate of book.data.missions)Object.assign(this.missionBook.get(candidate.id),candidate);
     this.persistenceSaved(image,generation,receipt);savedGeneration=generation;
     if(generation===this.dirtyGeneration)break;
    }
    if(savedGeneration!==this.dirtyGeneration)throw Error('Drafts kept changing during shutdown. Copy or export the latest text before restarting Sunny.');
    await this.store.flush();
   }catch(error){this.persistenceFailed(error);throw error;}
   finally{try{await this.store.close();}catch(error){this.persistenceFailed(error);throw error;}}
   if(savedGeneration!==this.dirtyGeneration){const error=Error('New text arrived while storage closed. Keep this window open to copy or export it before restarting Sunny.');this.persistenceFailed(error);throw error;}
   this.closed=true;
  })();return this.closePromise;
 }
}
module.exports={Hub,roles};
