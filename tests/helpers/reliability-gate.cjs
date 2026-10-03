'use strict';
// Test-only completeness/threshold evaluation. Facts require independent raw review;
// FACTS_COMPLETE is never a promotion receipt or proof of a real reproduction.
function evaluateReliabilityGate(report){
 const reasons=[],r=report&&typeof report==='object'?report:{};
 for(const key of ['spontaneousCrashCauseVerified','nativeRawProofComplete','exactPackageA4RawProofComplete','fullStateRawProofComplete'])
  if(r[key]!==true)reasons.push(key);
 for(const key of ['providerEffects','historyLoss'])if(r[key]!==0)reasons.push(key);
 const rows=Array.isArray(r.measurements)?r.measurements:[];
 if(rows.length!==3)reasons.push('complete 1/10/30MiB matrix');
 for(const size of [1,10,30]){
  const matches=rows.filter(row=>row&&row.sizeMiB===size),row=matches[0],prefix=size+'MiB ';
  if(matches.length!==1){reasons.push(prefix+'unique measurement');continue;}
  for(const key of ['stopSamples','approvalSamples'])if(row[key]!==20)reasons.push(prefix+key);
  for(const key of ['stopFailures','approvalFailures'])if(row[key]!==0)reasons.push(prefix+key);
  for(const [key,label] of [['stopP95Ms','stop p95'],['approvalP95Ms','approval p95']])
   if(!Number.isFinite(row[key])||row[key]<0||row[key]>=200)reasons.push(prefix+label);
  if(!Number.isFinite(row.mainTimerExcessMaxMs)||row.mainTimerExcessMaxMs<0||row.mainTimerExcessMaxMs>100)reasons.push(prefix+'timer excess');
  if(row.queueDurabilityRawProofComplete!==true)reasons.push(prefix+'queue/durability raw proof');
 }
 return {status:reasons.length?'BLOCKED':'FACTS_COMPLETE',reasons};
}
module.exports={evaluateReliabilityGate};
