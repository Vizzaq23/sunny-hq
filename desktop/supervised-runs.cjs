const {validateSupervisedRun}=require('./supervision-schema.cjs');
const {validateSupervisionCommand,validateRunCommand}=require('./supervision-commands.cjs');
const live=assignment=>['reserved','starting','working','waiting','unknown'].includes(assignment.state);
const MAX_EVENTS=1000;
const requiredActivity={implementation:'write',design:'write',creative:'write',verification:'test',review:'review',research:'research',planning:'read',diagnosis:'read',operations:'build'};
function missingScope(run){return [...new Set(run.assignments.filter(item=>!['finished','failed','interrupted','cancelled'].includes(item.state)&&!run.grant.scope.activities.includes(requiredActivity[item.capability])).map(item=>item.capability))];}
function reconcileScope(run,event){
 const hadScope=run.blockers.some(item=>item.kind==='scope'),missing=missingScope(run);run.blockers=run.blockers.filter(item=>item.kind!=='scope');
 for(const capability of missing){if(run.blockers.length>=100)throw Error('Run blocker limit reached.');run.blockers.push({id:event.id+':scope:'+run.blockers.length,kind:'scope',reason:'Missing captain scope for '+capability,time:event.time,revision:event.revision});}
 if(missing.length&&!['paused','stopping','stopped','unknown'].includes(run.phase))run.phase='blocked';
 else if(hadScope&&!run.blockers.length&&run.phase==='blocked')run.phase='waiting';
 return missing;
}
function createSupervisedRun(input,{now}){
 const a=validateSupervisionCommand('run:create',input);if(!Number.isFinite(now)||now<0)throw Error('Invalid supervision time.');
 const run={version:1,id:a.runId,projectId:a.projectId,missionIds:a.missionIds||[],revision:0,phase:'planning',grant:{...a.grant,version:1,revision:0},counters:{launches:0,repairs:0,activeMs:0,tokens:0,improvementMs:0,improvementTokens:0},assignments:[],workspaces:[],reviews:[],readiness:null,decisions:[],improvementTriggers:[],stopIntent:null,originalScope:structuredClone(a.grant.scope),criteria:a.criteria,objective:a.objective,events:[],blockers:[],grantHistory:[],coordinatorCalls:[],disagreementRounds:0};
 validateSupervisedRun(run);return run;
}
function applyRunCommand(run,command,{now,actor=['plan','decide'].includes(command?.type)?'coordinator':'captain',policyStop=false}={}){
 validateSupervisedRun(run);const a=validateRunCommand(command,actor);
 if(!Number.isFinite(now)||now<0)throw Error('Invalid supervision time.');
 if(a.runId!==run.id||a.projectId!==run.projectId||a.expectedRevision!==run.revision)throw Error('Run project or revision changed. Inspect the current run.');
 if(run.phase==='unknown'&&!(policyStop&&a.type==='stop'&&actor==='captain'))throw Error('Run authority is uncertain; reconcile before changing work.');
 if(run.phase==='stopped')throw Error('This run has stopped. Create a new run for further work.');
 if(['stopping','paused'].includes(run.phase)&&actor==='coordinator')throw Error('Run is not accepting coordinator decisions.');
 const next=structuredClone(run),effects=[],events=[];if(require('./repair-policy.cjs').repairExhausted(run))next.repairExhausted=true;
 if(next.revision===Number.MAX_SAFE_INTEGER||next.decisions.length>=1000||(next.events?.length||0)>=MAX_EVENTS)throw Error('Run record limit reached. Inspect and create a new run.');
 next.revision++;next.events??=[];next.blockers??=[];next.grantHistory??=[];next.coordinatorCalls??=[];next.disagreementRounds??=0;
 const event={id:'run-'+require('node:crypto').createHash('sha256').update(JSON.stringify([run.id,next.revision])).digest('hex'),runId:run.id,revision:next.revision,type:a.type,time:now,details:{}};
 const block=(kind,reason)=>{if(next.blockers.length>=100)throw Error('Run blocker limit reached.');next.phase='blocked';next.blockers.push({id:event.id+':'+kind+':'+next.blockers.length,kind,reason,time:now,revision:next.revision});event.details.reason=reason;};
 if(a.type==='pause'){if(next.phase==='stopping')throw Error('Stopping work cannot be paused.');next.phase='paused';effects.push({type:'pause-work',runId:run.id,revision:next.revision});}
 if(a.type==='resume'){if(next.phase!=='paused')throw Error('Only paused runs can resume.');next.phase=next.blockers.length?'blocked':'planning';effects.push({type:'resume-planning',runId:run.id,revision:next.revision});}
 if(a.type==='stop'){next.stopIntent={id:event.id,requestedBy:'captain',reason:a.reason||'Captain requested stop',time:now,revision:next.revision};next.phase=next.assignments.some(live)?'stopping':'stopped';effects.push({type:'stop-work',runId:run.id,revision:next.revision});}
 if(a.type==='redirect'){next.blockers=next.blockers.filter(item=>item.kind!=='intent');next.disagreementRounds=0;next.objective=a.objective;next.phase='paused';next.readiness=null;effects.push({type:'replan',runId:run.id,revision:next.revision});}
 if(a.type==='setGrant'){
  if(next.grantHistory.length>=100)throw Error('Grant history limit reached.');next.grantHistory.push({grant:structuredClone(next.grant),replacedAt:now,revision:next.revision,reason:a.reason});
  next.grant={...a.grant,version:1,revision:(next.grant.revision||0)+1};
  const missing=reconcileScope(next,event);
  const c=next.counters,g=next.grant;
  if(c.launches>=g.maxLaunches||c.repairs>g.maxRepairs||c.activeMs>=g.activeMs||c.tokens>=g.tokenLimit||next.assignments.filter(live).length>g.maxWorkers||missing.length&&next.assignments.some(item=>live(item)&&missing.includes(item.capability))){next.stopIntent={id:event.id,requestedBy:'policy',reason:'Captain lowered grant below consumed usage or active scope',time:now,revision:next.revision};next.phase=next.assignments.some(live)?'stopping':'stopped';effects.push({type:'stop-work',runId:run.id,revision:next.revision});}
 }
 if(a.type==='plan'){
  if(!['planning','blocked','waiting'].includes(next.phase))throw Error('Run phase does not permit a new proposal.');
  if(next.assignments.length)throw Error('Initial assignment proposal already exists.');
  if(a.assignments.length>next.grant.maxInitialAssignments)throw Error('Initial assignment limit exceeded.');
  for(const item of a.assignments){if(next.criteria&&!item.criteriaIds.every(id=>next.criteria.some(value=>value.id===id)))throw Error('Assignment criterion is outside the original criteria.');}
  next.assignments=a.assignments;
  const needed=requiredActivity;
  for(const item of next.assignments){const activity=needed[item.capability];if(!activity||!next.grant.scope.activities.includes(activity))block('scope','Missing captain scope for '+item.capability);}
  if(next.phase!=='blocked')next.phase='waiting';
  effects.push(...a.assignments.map(item=>({type:'assignment-proposed',runId:run.id,revision:next.revision,assignmentId:item.id})));
 }
 if(a.type==='decide'){
  event.details.outcome=a.outcome;
  if(a.assignmentId!==undefined&&!next.assignments.some(item=>item.id===a.assignmentId))throw Error('Decision assignment is outside this run.');
  if(a.outcome==='disagree'){if(next.disagreementRounds>=2)throw Error('Two disagreement rounds are complete. Await captain intent or reopen with evidence.');next.disagreementRounds=Math.min(2,next.disagreementRounds+1);if(next.disagreementRounds===2){if(a.evidenceRefs?.length){event.details.outcome='evidence';next.phase=next.blockers.length?'blocked':'waiting';}else block('intent','Two disagreement rounds need captain intent or new evidence');}}
  else if(a.outcome==='hold')next.phase=next.blockers.length?'blocked':'waiting';
  else if(a.outcome==='reopen'){if(!a.evidenceRefs?.length)throw Error('Reopening requires evidence references.');next.readiness=null;next.phase=next.blockers.length?'blocked':'planning';}
  else {if(missingScope(next).length)throw Error('Missing captain scope for the existing proposal.');if(next.blockers.length)throw Error('Resolve captain blockers before proceeding.');next.phase='waiting';}
  if(a.evidenceRefs?.length)event.details.sourceId=a.evidenceRefs[0];
  if(a.assignmentId)event.details.assignmentId=a.assignmentId;
 }
 if(a.decision){if(next.decisions.some(value=>value.id===a.decision.id))throw Error('Decision ID already exists.');next.decisions.push({...a.decision,runId:run.id,revision:next.revision,type:a.type,time:now,details:{...event.details}});}
 else next.decisions.push({id:event.id,runId:run.id,revision:next.revision,type:a.type,time:now,details:{},option:a.type,reason:a.reason||'Captain control',dissent:[],owner:'captain',nextAction:a.type==='stop'?'Confirm stopped work':'Inspect run',reopenEvidence:'New captain instruction'});
 if(require('./repair-policy.cjs').repairExhausted(next)){next.repairExhausted=true;next.readiness=null;if(!['paused','stopping','stopped','unknown'].includes(next.phase))next.phase='blocked';}
 next.events.push(event);events.push(event);validateSupervisedRun(next);return {next,events,effects};
}
// A failed reliability gate cannot be bypassed by profile, renderer, model, or env.
const LIVE_SUPERVISION_ADMITTED=false;
function assertExecutionAdmission({trustedFixture=false}={}){if(!trustedFixture&&!LIVE_SUPERVISION_ADMITTED)throw Error('Supervised execution is disabled pending a trusted reliability release.');}
function applyPolicyStop(run,{reason,now,activeExecutions=[]}){const transition=applyRunCommand(run,{type:'stop',runId:run.id,projectId:run.projectId,expectedRevision:run.revision,reason},{now,actor:'captain',policyStop:true});transition.next.stopIntent.requestedBy='policy';if(activeExecutions.some(task=>['starting','working','waiting','unknown'].includes(task.status)))transition.next.phase='stopping';validateSupervisedRun(transition.next);return transition;}
module.exports={applyPolicyStop,createSupervisedRun,applyRunCommand,assertExecutionAdmission,LIVE_SUPERVISION_ADMITTED};
