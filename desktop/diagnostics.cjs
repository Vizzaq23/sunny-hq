const fs=require('node:fs');const path=require('node:path');
const allowed=new Set(['starting','window-loaded','load-failed','renderer-gone','renderer-error','startup-failed','provider-decode-failed','provider-handler-failed']);
const reasons=new Set(['clean-exit','abnormal-exit','killed','crashed','oom','launch-failed','integrity-failure','memory-eviction']);
function safeDetails(event,input={}){
 const details={};if(!input||typeof input!=='object')input={};
 if(['hub','companion','backend'].includes(input.surface))details.surface=input.surface;
 for(const key of ['appVersion','electronVersion'])if(typeof input[key]==='string'&&/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(input[key])&&input[key].length<=60)details[key]=input[key];
 if(typeof input.buildId==='string'&&/^[a-f0-9]{64}$/.test(input.buildId))details.buildId=input.buildId;
 if(typeof input.sourceCommit==='string'&&/^[a-f0-9]{40,64}$/.test(input.sourceCommit))details.sourceCommit=input.sourceCommit;
 if(typeof input.sourceDirty==='boolean')details.sourceDirty=input.sourceDirty;
 if(event==='renderer-gone'){details.reason=reasons.has(input.reason)?input.reason:'unknown';if(Number.isSafeInteger(input.exitCode))details.exitCode=input.exitCode;}
 if(event==='load-failed'&&Number.isSafeInteger(input.code))details.code=input.code;
 return details;
}
function record(directory,event,input){
 if(!allowed.has(event))throw Error('Unknown diagnostic event');
 fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'startup.log');
 if(fs.existsSync(file)&&fs.statSync(file).size>128*1024)fs.renameSync(file,path.join(directory,'startup.previous.log'));
 const details=safeDetails(event,input);fs.appendFileSync(file,`${new Date().toISOString()} ${event}${Object.keys(details).length?' '+JSON.stringify(details):''}\n`);
}
function watchRenderer(contents,{surface,record,onGone}){
 contents.on('did-finish-load',()=>record('window-loaded',{surface}));
 contents.on('did-fail-load',(_event,code,_description,_url,isMainFrame)=>{if(isMainFrame&&code!==-3)record('load-failed',safeDetails('load-failed',{surface,code}));});
 contents.on('render-process-gone',(_event,input)=>{const details=safeDetails('renderer-gone',{...input,surface});record('renderer-gone',details);Promise.resolve().then(()=>onGone(details)).catch(()=>{/* Surface closure must not crash the main process. */});});
}
async function offerReload(win,{surface,reason,exitCode,isQuitting,showMessageBox}){
 if(isQuitting()||win.isDestroyed())return;
 const details=safeDetails('renderer-gone',{reason,exitCode});
 const result=await showMessageBox(win,{type:'error',buttons:['Reload Sunny','Keep closed'],defaultId:0,cancelId:1,message:surface==='companion'?'Sunny\'s desktop crew stopped responding.':'Sunny\'s interface stopped responding.',detail:`Renderer exit: ${details.reason}${details.exitCode===undefined?'':` (code ${details.exitCode})`}. Saved data has not been reset. Active missions may still be running. Reload the interface to reconnect.`});
 if(result.response===0&&!isQuitting()&&!win.isDestroyed())win.reload();
}
function readBuildInfo(file){try{if(fs.statSync(file).size>4096)return {};return safeDetails('starting',JSON.parse(fs.readFileSync(file,'utf8')));}catch{return {};}}
module.exports={record,safeDetails,watchRenderer,offerReload,readBuildInfo};
