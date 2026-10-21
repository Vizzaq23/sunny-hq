const fs=require('node:fs'),path=require('node:path');
const STAGES=new Set(['app-ready','store-open-enter','store-open-exit','seed-enter','seed-exit','store-close-enter','store-close-exit','store-reopen-enter','store-reopen-exit','hub-created','recovery-enter','recovery-exit','window-enter','window-created','load-enter','load-exit','acceptance-enter','acceptance-exit','readiness-probe','startup-failed','cleanup-enter','cleanup-exit','cleanup-unresolved']);
function createStages({outputDir,phase}){
 if(!path.isAbsolute(outputDir)||![1,2].includes(phase))throw Error('Invalid fixture stage destination');
 const file=path.join(outputDir,`stages-${phase}.jsonl`),start=performance.now();let count=0;
 return (stage,...payload)=>{if(!STAGES.has(stage))throw Error('Invalid fixture stage');if(payload.length)throw Error('Fixture stage payload forbidden');if(count++>=96)return;fs.appendFileSync(file,JSON.stringify({version:1,phase,stage,utc:new Date().toISOString(),elapsedMs:Math.round(performance.now()-start)})+'\n',{mode:0o600});};
}
async function bounded(promise,timeoutMs=15000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Fixture operation timed out.')),timeoutMs);})]);}finally{clearTimeout(timer);}}
async function waitUntilReady(probe,{timeoutMs=12000,probeMs=1000,intervalMs=100}={}){
 const deadline=performance.now()+timeoutMs;
 while(performance.now()<deadline){if(await bounded(Promise.resolve().then(probe),Math.min(probeMs,Math.max(1,deadline-performance.now()))).catch(()=>false))return;const remaining=deadline-performance.now();if(remaining>0)await new Promise(resolve=>setTimeout(resolve,Math.min(intervalMs,remaining)));}
 throw Error('Fixture renderer readiness timed out.');
}
async function withFailureStage(operation,cleanup,stage,cleanupMs=5000){try{return await operation();}catch(error){stage('startup-failed');stage('cleanup-enter');try{await bounded(Promise.resolve().then(cleanup),cleanupMs);stage('cleanup-exit');}catch{stage('cleanup-unresolved');}throw error;}}
module.exports={createStages,bounded,waitUntilReady,withFailureStage};
