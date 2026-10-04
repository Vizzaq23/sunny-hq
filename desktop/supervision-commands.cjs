const schema=require('./supervision-schema.cjs');
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
function check(value){if(!value)throw Error('Invalid supervision command or authority.');}
function fields(value,required,optional=[]){check(object(value)&&required.every(key=>Object.hasOwn(value,key))&&Object.keys(value).every(key=>required.includes(key)||optional.includes(key)));}
function text(value,max=200){check(typeof value==='string'&&value.trim().length>0&&value.length<=max&&!value.includes('\0'));}
function list(value,max,validate){check(Array.isArray(value)&&value.length<=max);for(let i=0;i<value.length;i++){check(Object.hasOwn(value,i));validate(value[i]);}}
function unique(value){check(new Set(value).size===value.length);}
function criteria(value){list(value,100,item=>{fields(item,['id','text'],['kind','requiredChecks','requiredArtifactIds']);text(item.id);text(item.text,2000);if(item.kind!==undefined)check(['documentation','engineering','playable'].includes(item.kind));if(item.requiredChecks!==undefined){list(item.requiredChecks,5,k=>check(['test','build','typecheck','playable','documentation'].includes(k)));check(item.requiredChecks.length>0);unique(item.requiredChecks);}if(item.requiredArtifactIds!==undefined){list(item.requiredArtifactIds,256,k=>text(k));unique(item.requiredArtifactIds);}});check(value.length>0);unique(value.map(item=>item.id));}
function decision(value){fields(value,['id','option','reason','dissent','owner','nextAction','reopenEvidence']);text(value.id);for(const key of ['option','reason','owner','nextAction','reopenEvidence'])text(value[key],2000);list(value.dissent,16,item=>text(item,2000));}
function binding(args){text(args.runId);text(args.projectId);check(Number.isSafeInteger(args.expectedRevision)&&args.expectedRevision>=0&&args.expectedRevision<Number.MAX_SAFE_INTEGER);}
function validateSupervisionCommand(action,args){
 if(typeof action==='string'&&action.startsWith('result:'))return require('./playable-launches.cjs').validateCommand(action,args);
 if(!['run:ackCall','run:create','run:control','run:setGrant','run:inspect','sunny_plan','sunny_decide'].includes(action)){if(typeof action==='string'&&(action.startsWith('run:')||action.startsWith('sunny_')))throw Error('Unknown supervision command.');return args;}
 if(action==='run:ackCall'){fields(args,['runId','projectId','expectedRevision','requestId','attemptId','state']);binding(args);text(args.requestId);text(args.attemptId);check(['seen','snoozed'].includes(args.state));return structuredClone(args);}
 const base=['runId','projectId','expectedRevision'];
 if(action==='run:inspect'){fields(args,['runId','projectId']);text(args.runId);text(args.projectId);return structuredClone(args);}
 if(action==='run:create'){fields(args,[...base,'objective','criteria','grant'],['missionIds','parentTaskId']);binding(args);check(args.expectedRevision===0);text(args.objective,12000);criteria(args.criteria);schema.validateGrant(args.grant,args.projectId);check(args.grant.scope.objective===args.objective);if(args.missionIds!==undefined){list(args.missionIds,1000,item=>text(item));unique(args.missionIds);}if(args.parentTaskId!==undefined)text(args.parentTaskId);}
 if(action==='run:control'){fields(args,base,['control','action','objective','redirect','reason']);binding(args);check((args.control===undefined)!==(args.action===undefined));const control=args.control??args.action;check(['pause','resume','stop','redirect'].includes(control));if(args.reason!==undefined)text(args.reason,2000);if(control==='redirect'){if(args.action!==undefined){check(args.objective===undefined);fields(args.redirect,['objective'],['criteria']);text(args.redirect.objective,12000);if(args.redirect.criteria!==undefined)criteria(args.redirect.criteria);}else{check(args.redirect===undefined);text(args.objective,12000);}}else check(args.objective===undefined&&args.redirect===undefined);}
 if(action==='run:setGrant'){fields(args,[...base,'grant','reason']);binding(args);schema.validateGrant(args.grant,args.projectId);text(args.reason,2000);}
 if(action==='sunny_plan'){fields(args,[...base,'assignments','decision']);binding(args);decision(args.decision);list(args.assignments,16,item=>{schema.validateAssignment(item);check(item.state==='queued'&&!Object.hasOwn(item,'taskId')&&!Object.hasOwn(item,'workspaceId')&&!Object.hasOwn(item,'launchReservationId')&&!Object.hasOwn(item,'sourceResult'));});check(args.assignments.length>0);unique(args.assignments.map(item=>item.id));}
 if(action==='sunny_decide'){fields(args,[...base,'outcome','decision'],['assignmentId','evidenceRefs']);binding(args);decision(args.decision);check(['proceed','hold','reopen','disagree'].includes(args.outcome));if(args.assignmentId!==undefined)text(args.assignmentId);if(args.evidenceRefs!==undefined){list(args.evidenceRefs,16,item=>text(item,2000));unique(args.evidenceRefs);}}
 return structuredClone(args);
}
function validateRunCommand(command,actor){
 check(actor==='captain'||actor==='coordinator');check(object(command));
 const {type,...args}=command;check(['pause','resume','stop','redirect','setGrant','plan','decide'].includes(type));
 if(actor==='coordinator')check(type==='plan'||type==='decide');else check(!['plan','decide'].includes(type));
 const action=type==='plan'?'sunny_plan':type==='decide'?'sunny_decide':type==='setGrant'?'run:setGrant':'run:control';
 return {type,...validateSupervisionCommand(action,action==='run:control'?{...args,control:type}:args)};
}
module.exports={validateSupervisionCommand,validateRunCommand,criteria,decision};
