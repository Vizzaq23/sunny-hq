const path=require('node:path');
const activity={implementation:'write',design:'write',creative:'write',verification:'test',review:'review',research:'research',planning:'read',diagnosis:'read',operations:'build'};
const live=a=>['reserved','starting','working','waiting','unknown'].includes(a.state);
function normalized(value){if(typeof value!=='string'||!value||value.includes('\0')||path.win32.isAbsolute(value)||path.posix.isAbsolute(value))throw Error('Unsafe owned path');const p=value.replace(/\\/g,'/').toLowerCase();if(p.split('/').some(v=>!v||v==='.'||v==='..')||p.includes(':'))throw Error('Unsafe owned path');return p.replace(/\/$/,'');}
function overlap(a,b){return a===b||a.startsWith(b+'/')||b.startsWith(a+'/');}
function ancestors(a,byId,seen=new Set()){for(const id of a.dependencies){if(seen.has(id))continue;seen.add(id);const dependency=byId.get(id);if(!dependency)throw Error('Unknown dependency');ancestors(dependency,byId,seen);}return seen;}
function validateAssignmentGraph(assignments,{registry=require('./crew-registry.cjs'),scope,base}={}){
 if(!Array.isArray(assignments)||assignments.length<1||assignments.length>16||assignments.some((_,i)=>!(i in assignments)))throw Error('Initial graph limit is sixteen');
 const byId=new Map();for(const a of assignments){require('./supervision-schema.cjs').validateAssignment(a);if(byId.has(a.id))throw Error('Duplicate assignment ID');byId.set(a.id,a);if(!registry.canonicalAssignment(a))throw Error('Invalid canonical role');if(!scope?.activities.includes(activity[a.capability]))throw Error('Missing assignment scope');if(a.baseCommit!==base)throw Error('Assignment base changed');const paths=a.ownedPaths.map(normalized);if(new Set(paths).size!==paths.length)throw Error('Duplicate normalized path');}
 const visiting=new Set(),visited=new Set();function visit(a){if(visiting.has(a.id))throw Error('Assignment dependency cycle');if(visited.has(a.id))return;visiting.add(a.id);for(const id of a.dependencies){if(!byId.has(id))throw Error('Unknown dependency');visit(byId.get(id));}visiting.delete(a.id);visited.add(a.id);}assignments.forEach(visit);
 for(let i=0;i<assignments.length;i++)for(let j=i+1;j<assignments.length;j++){const a=assignments[i],b=assignments[j];if(a.ownedPaths.some(x=>b.ownedPaths.some(y=>overlap(normalized(x),normalized(y))))&&!ancestors(a,byId).has(b.id)&&!ancestors(b,byId).has(a.id))throw Error('Unordered owned path overlap');}
 return {assignments:structuredClone(assignments),base};
}
function receiptMatches(owner,target){return (target.resolutionOwnership?.fromAssignmentId===owner.id&&target.resolutionOwnership.fromWorkspaceId===owner.workspaceId&&require('./review-verdicts.cjs').sameSource(target.resolutionOwnership.source,owner.sourceResult))||target.ownershipTransfers?.some(t=>t.fromAssignmentId===owner.id&&t.fromWorkspaceId===owner.workspaceId&&t.newBase===target.baseCommit&&target.baseCommit!==owner.baseCommit&&require('./review-verdicts.cjs').sameSource(t.source,owner.sourceResult));}
function covers(owned,region){return owned===region||region.startsWith(owned+'/');}
function transferredRegion(owner,target,region,byId,seen=new Set()){
 const key=owner.id+'\0'+target.id;if(owner.state!=='finished'||seen.has(key))return false;
 if(receiptMatches(owner,target))return true;
 const visited=new Set(seen);visited.add(key);
 for(const id of ancestors(target,byId)){const middle=byId.get(id);if(middle.id===owner.id||middle.state!=='finished'||!middle.ownedPaths.some(p=>covers(normalized(p),region)))continue;
  if(transferredRegion(owner,middle,region,byId,visited)&&transferredRegion(middle,target,region,byId,visited))return true;
 }
 return false;
}
function readyAssignments(run,state={}){const byId=new Map(run.assignments.map(a=>[a.id,a]));return run.assignments.filter(a=>a.state==='queued'&&require('./production-waves.cjs').allowed(run,a)&&!a.launchReservationId&&!a.taskId&&!run.assignments.some(b=>live(b)&&b.crewId===a.crewId)&&a.dependencies.every(id=>byId.get(id)?.state==='finished')&&[...ancestors(a,byId)].every(id=>{const old=byId.get(id);return a.ownedPaths.every(x=>old.ownedPaths.every(y=>{const current=normalized(x),previous=normalized(y);if(!overlap(current,previous))return true;const region=current.length>=previous.length?current:previous;return transferredRegion(old,a,region,byId);}));})&&!state.tasks?.some(t=>t.crewId===a.crewId&&['starting','working','waiting','unknown'].includes(t.status)));}
module.exports={validateAssignmentGraph,readyAssignments,normalized,overlap,live,ancestors};
