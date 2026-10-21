const {digest}=require('./mission-context.cjs');
const {sameSource}=require('./review-verdicts.cjs');
const graph=require('./assignment-graph.cjs');
const author=a=>['implementation','design','creative','operations'].includes(a?.capability);
const fields=['id','crewId','roleId','capability','objective','ownedPaths','dependencies','criteriaIds','baseCommit'];
const snapshot=a=>Object.fromEntries(fields.map(k=>[k,structuredClone(a[k])]));
function derive(assignments){
 const original=assignments.map(snapshot),byId=new Map(original.map(a=>[a.id,a])),ranks=new Map(),visiting=new Set();
 function rank(a){if(ranks.has(a.id))return ranks.get(a.id);if(visiting.has(a.id))throw Error('Assignment dependency cycle');visiting.add(a.id);let n=0;for(const id of a.dependencies){const prior=byId.get(id);if(!prior)throw Error('Unknown dependency');n=Math.max(n,rank(prior)+(author(prior)?1:0));}visiting.delete(a.id);ranks.set(a.id,n);return n;}
 const production=original.filter(a=>!require('./crew-registry.cjs').reviewAssignment(a));production.forEach(rank);const waves=Array.from({length:1+Math.max(...production.map(a=>ranks.get(a.id)))},(_,i)=>production.filter(a=>ranks.get(a.id)===i).map(a=>a.id));
 return {version:1,original,digest:digest(original),waves};
}
function plan(run,id=run.currentEpoch?.id){return require('./feedback-epochs.cjs').epoch(run,id)?.productionWaves;}
function delivery(run,id=run.currentEpoch?.id){return run.deliveries?.find(d=>d.epochId===id);}
function matchesCheckpoint(a,d,cp){return !!(a&&a.baseCommit===cp.source.headCommit&&sameSource(a.checkpointBinding,{version:1,epochId:d.epochId,deliveryId:d.id,checkpointId:cp.id,generation:cp.generation,digest:cp.digest,wave:cp.wave+1,workspaceId:cp.workspaceId,workspaceIdentity:cp.workspaceIdentity,sourceHead:cp.source.headCommit}));}
function binding(run,a){const d=delivery(run,a?.checkpointBinding?.epochId),cp=d?.productionWave?.checkpoints.find(c=>c.id===a?.checkpointBinding?.checkpointId);return !!(cp&&cp.state==='completed'&&cp.digest===digest({...cp,digest:undefined})&&matchesCheckpoint(a,d,cp)&&plan(run,d.epochId)?.waves[cp.wave+1]?.includes(a.id)&&cp.successorIds.includes(a.id));}
function installedWave(run,d,cp){
 try{
  if(cp.state!=='completed'||cp.digest!==digest({...cp,digest:undefined})||!sameSource(cp.successorIds,plan(run,d.epochId)?.waves[cp.wave+1]))return false;
  const byId=new Map(run.assignments.map(a=>[a.id,a]));
  return cp.successorIds.every(id=>{const next=byId.get(id);if(!matchesCheckpoint(next,d,cp))return false;if(!author(next))return true;
   return [...graph.ancestors(next,byId)].every(id=>{const old=byId.get(id);if(!next.ownedPaths.some(x=>old.ownedPaths.some(y=>graph.overlap(graph.normalized(x),graph.normalized(y)))))return true;
    const item=cp.prefix.find(p=>p.id===id);return !!(item&&old.state==='finished'&&old.workspaceId===item.workspaceId&&sameSource(old.sourceResult,item.source)&&old.baseCommit!==cp.source.headCommit&&next.ownershipTransfers?.some(t=>sameSource(t,{fromAssignmentId:old.id,fromWorkspaceId:item.workspaceId,source:item.source,newBase:cp.source.headCommit})));
   });
  });
 }catch{return false;}
}
function allowed(run,a){
 if(!require('./feedback-epochs.cjs').current(run,a)&&!require('./conflict-resolution.cjs').binding(run,a))return false;
 if(!run.ordinary?.checkpointWaves)return true;
 if(require('./crew-registry.cjs').reviewAssignment(a))return true;
 const p=plan(run);if(!p)return false;const d=delivery(run),w=d?.productionWave;let id=a?.id;
 if(w&&(w.checkpoints.length!==w.active||!w.checkpoints.every(cp=>installedWave(run,d,cp))))return false;
 const conflict=require('./conflict-resolution.cjs').binding(run,a);if(conflict)id=conflict.assignmentId;
 const rank=p.waves.findIndex(ids=>ids.includes(id)),active=w?.active||0;
 return rank===active&&(!d||['collecting','integrating'].includes(d.stage))&&(rank===0||conflict||binding(run,a));
}
function assertOriginal(run,d){
 const p=plan(run,d.epochId);if(!p||p.digest!==digest(p.original)||!sameSource(derive(p.original),p)||d.productionWave?.planDigest!==p.digest)throw Error('Immutable production wave plan changed');
 if(!d.productionWave.checkpoints.every(cp=>installedWave(run,d,cp)))throw Error('Production checkpoint wave installation changed');
 for(const original of p.original){const a=run.assignments.find(a=>a.id===original.id);if(!a)throw Error('Production membership changed');const now=snapshot(a);if(require('./crew-registry.cjs').reviewAssignment(a)){now.baseCommit=original.baseCommit;now.objective=original.objective;}else if(a.checkpointBinding){if(!binding(run,a))throw Error('Production checkpoint binding changed');now.baseCommit=original.baseCommit;}if(!sameSource(now,original))throw Error('Immutable production graph changed');}
}
function prefixIds(run,d){const p=plan(run,d.epochId);assertOriginal(run,d);const initial=p.waves.slice(0,d.productionWave.active+1).flat();return [...initial,...(run.integrations||[]).filter(op=>initial.includes(op.assignmentId)).map(op=>op.resolution?.assignmentId).filter(Boolean)];}
function transferReceipt(hub,run,old,next,newBase,source){
 const task=hub.state.tasks.find(t=>t.id===old?.taskId);
 if(!old||!next||old.state!=='finished'||task?.status!=='finished'||hub.hasTaskRecoveryIntent(task)||!old.workspaceId||!sameSource(old.sourceResult,source)||next.state!=='queued'||next.taskId||next.workspaceId||next.launchReservationId||newBase===old.baseCommit||(next.ownershipTransfers?.length?newBase!==next.baseCommit:newBase===next.baseCommit)||next.ownershipTransfers?.some(t=>t.fromAssignmentId===old.id)||!graph.ancestors(next,new Map(run.assignments.map(a=>[a.id,a]))).has(old.id)||!next.ownedPaths.some(x=>old.ownedPaths.some(y=>graph.overlap(graph.normalized(x),graph.normalized(y)))))throw Error('Ownership transfer requires completed reconciled predecessor and a new base');
 return {fromAssignmentId:old.id,fromWorkspaceId:old.workspaceId,source:structuredClone(source),newBase};
}
module.exports={derive,plan,delivery,allowed,binding,installedWave,assertOriginal,prefixIds,transferReceipt,author};
