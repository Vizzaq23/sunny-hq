const fs=require('node:fs');const path=require('node:path');
const allowed=new Set(['starting','window-loaded','load-failed','renderer-gone','renderer-error','startup-failed']);
const exitReasons=new Set(['clean-exit','abnormal-exit','killed','crashed','oom','launch-failed','integrity-failure','memory-eviction']);
function rendererExit(details){
 const result={reason:exitReasons.has(details?.reason)?details.reason:'unknown'};
 if(Number.isSafeInteger(details?.exitCode))result.exitCode=details.exitCode;
 return result;
}
function record(directory,event,details){
 if(!allowed.has(event))throw Error('Unknown diagnostic event');
 fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'startup.log');
 if(fs.existsSync(file)&&fs.statSync(file).size>128*1024)fs.renameSync(file,path.join(directory,'startup.previous.log'));
 const suffix=event==='renderer-gone'?' '+JSON.stringify(rendererExit(details)):'';
 fs.appendFileSync(file,`${new Date().toISOString()} ${event}${suffix}\n`);
}
module.exports={record,rendererExit};
