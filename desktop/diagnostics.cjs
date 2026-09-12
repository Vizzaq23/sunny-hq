const fs=require('node:fs');const path=require('node:path');
const allowed=new Set(['starting','window-loaded','load-failed','renderer-gone','renderer-error','startup-failed']);
function record(directory,event){
 if(!allowed.has(event))throw Error('Unknown diagnostic event');
 fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'startup.log');
 if(fs.existsSync(file)&&fs.statSync(file).size>128*1024)fs.renameSync(file,path.join(directory,'startup.previous.log'));
 fs.appendFileSync(file,`${new Date().toISOString()} ${event}\n`);
}
module.exports={record};
