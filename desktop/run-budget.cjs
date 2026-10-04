// Private durable resource ledger. Provider telemetry is cumulative, never credit.
const {validateSupervisedRun}=require('./supervision-schema.cjs');
const MAX_WORKERS=3;
const safe=value=>Number.isSafeInteger(value)&&value>=0;
const add=(a,b)=>Math.min(Number.MAX_SAFE_INTEGER,a+b);
function instant(now){const value=typeof now==='number'?{wall:now}:now;if(!value||!safe(value.wall)||(value.monotonic!==undefined&&!safe(value.monotonic))||(value.epoch!==undefined&&(typeof value.epoch!=='string'||!value.epoch)))throw Error('Invalid accounting clock.');return value;}
function ledger(run){const next=structuredClone(run);next.accounting??={usage:[],launchReservations:[],workers:[],clock:null,warningAt:null,telemetryUncertain:false};return next;}
function advanceActiveTime(run,{now,confirmedQuiescent=false}){
 validateSupervisedRun(run);const t=instant(now),next=ledger(run),a=next.accounting,c=a.clock;
 if(c?.quiescent&&confirmedQuiescent===true&&t.wall>=c.wall)return next;
 let delta=0,uncertain=c?.uncertain||false;
 if(c){const wall=t.wall-c.wall;uncertain||=wall<0;delta=Math.max(0,wall);if(t.epoch&&t.epoch===c.epoch&&t.monotonic!==undefined&&c.monotonic!==undefined){const mono=t.monotonic-c.monotonic;uncertain||=mono<0;delta=Math.max(delta,Math.max(0,mono));}else if(!c.quiescent||!confirmedQuiescent)uncertain=true;const restartUncertain=c.quiescent&&t.epoch&&c.epoch&&t.epoch!==c.epoch&&!confirmedQuiescent;if(!c.quiescent||restartUncertain){next.counters.activeMs=add(next.counters.activeMs,delta);for(const worker of a.workers)if(worker.active)worker.activeMs=add(worker.activeMs,delta);}}
 a.clock={wall:Math.max(t.wall,c?.wall||0),quiescent:confirmedQuiescent===true,uncertain,...(t.epoch?{epoch:t.epoch}:{}),...(t.monotonic!==undefined?{monotonic:t.monotonic}:{})};validateSupervisedRun(next);return next;
}
function observeUsage(run,{provider,threadId,totalTokens,now}){
 if(typeof provider!=='string'||!provider.trim()||provider.length>200||typeof threadId!=='string'||!threadId.trim()||threadId.length>200||!safe(totalTokens))throw Error('Invalid provider resource telemetry.');
 let next=advanceActiveTime(run,{now,confirmedQuiescent:run.accounting?.clock?.quiescent===true});const a=next.accounting;let entry=a.usage.find(value=>value.provider===provider&&value.threadId===threadId);if(!entry){if(a.usage.length>=256)throw Error('Resource telemetry record limit reached.');entry={provider,threadId,totalTokens:0};a.usage.push(entry);}if(totalTokens<entry.totalTokens)a.telemetryUncertain=true;const high=Math.max(entry.totalTokens,totalTokens);next.counters.tokens=add(next.counters.tokens,high-entry.totalTokens);entry.totalTokens=high;validateSupervisedRun(next);return next;
}
function globalCapacity(activeExecutions=[],{excludeId}={}){const active=activeExecutions.filter(item=>item.id!==excludeId&&item.external!==true&&!item.captain&&['starting','working','waiting','unknown'].includes(item.status));const limit=active.some(item=>item.status==='unknown'||!safe(item.tokenUsage?.total?.totalTokens))?1:MAX_WORKERS;return {admit:active.length<limit,reason:active.length>=limit?(limit===1?'Unknown telemetry permits only one active execution.':'All three global execution slots are busy.'):'',limit,active:active.length};}
function budgetStatus(run,{now,activeExecutions=[],excludeId,reserved=false}={}){
 const current=advanceActiveTime(run,{now:now??0,confirmedQuiescent:run.accounting?.clock?.quiescent===true}),c=current.counters,g=current.grant;
 let reason='';if(c.tokens>=g.tokenLimit)reason='Run token limit reached.';else if(c.activeMs>=g.activeMs)reason='Run active time limit reached.';else if((c.launches>g.maxLaunches||c.launches>=g.maxLaunches&&!reserved))reason='Run launch limit reached.';else if(c.repairs>g.maxRepairs)reason='Run repair limit reached.';else if(current.accounting.workers.some(worker=>worker.active&&worker.activeMs>=g.workerMs))reason='Worker time limit reached.';else if(['paused','stopping','stopped','unknown','blocked','ready'].includes(current.phase))reason='Run is not admitting work.';
 const capacity=globalCapacity(activeExecutions,{excludeId});if(current.accounting.telemetryUncertain&&capacity.active>=1){capacity.admit=false;capacity.reason="Uncertain telemetry permits only one active execution.";}if(!reason&&!capacity.admit)reason=capacity.reason;if(!reason&&activeExecutions.filter(item=>item.id!==excludeId&&item.runId===run.id&&['starting','working','waiting','unknown'].includes(item.status)).length>=g.maxWorkers)reason='Run worker slots are busy.';
 return {admit:!reason,reason,warning:current.accounting.warningAt===null&&(c.tokens>=g.tokenLimit*.8||c.activeMs>=g.activeMs*.8||c.launches>=g.maxLaunches*.8||current.accounting.workers.some(worker=>worker.active&&worker.activeMs>=g.workerMs*.8)),remaining:{tokens:Math.max(0,g.tokenLimit-c.tokens),activeMs:Math.max(0,g.activeMs-c.activeMs),launches:Math.max(0,g.maxLaunches-c.launches)},uncertain:current.accounting.clock.uncertain};
}
function reserveLaunch(run,{reservationId,assignmentId,now}){
 if(typeof reservationId!=='string'||!reservationId.trim()||reservationId.length>200)throw Error('Invalid launch reservation.');
 const next=advanceActiveTime(run,{now,confirmedQuiescent:false}),a=next.accounting,existing=a.launchReservations.find(value=>value.id===reservationId);
 if(existing){if(existing.assignmentId!==assignmentId)throw Error('Conflicting launch reservation.');return next;}
 if(assignmentId!==undefined&&!next.assignments.some(item=>item.id===assignmentId))throw Error('Launch assignment is outside this run.');
 const status=budgetStatus(next,{now});if(!status.admit)throw Error(status.reason);if(a.launchReservations.length>=32)throw Error('Launch reservation limit reached.');
 next.counters.launches=add(next.counters.launches,1);a.launchReservations.push({id:reservationId,...(assignmentId!==undefined?{assignmentId}:{}),time:instant(now).wall});a.workers.push({id:reservationId,activeMs:0,active:true});if(assignmentId!==undefined)next.assignments.find(item=>item.id===assignmentId).launchReservationId=reservationId;if(budgetStatus(next,{now,reserved:true}).warning)a.warningAt=instant(now).wall;validateSupervisedRun(next);return next;
}
module.exports={budgetStatus,reserveLaunch,observeUsage,advanceActiveTime,globalCapacity};
