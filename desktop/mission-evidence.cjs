const fs=require('node:fs');const path=require('node:path');const {createHash}=require('node:crypto');
const {execFile,spawn}=require('node:child_process');const {promisify}=require('node:util');
const runFile=promisify(execFile);
function npmRuntime(){
 const roots=[path.dirname(process.execPath),path.join(process.env.ProgramFiles||'C:\\Program Files','nodejs')];
 for(const root of roots){const node=path.join(root,process.platform==='win32'?'node.exe':'node'),npm=path.join(root,'node_modules/npm/bin/npm-cli.js');if(fs.existsSync(node)&&fs.existsSync(npm))return {node,npm};}
 try{return {node:process.execPath,npm:require.resolve('npm/bin/npm-cli.js')};}catch{throw Error('Node and npm are unavailable. Install the project’s supported Node runtime first.');}
}
function killTree(child,done){
 if(process.platform==='win32')execFile(path.join(process.env.SystemRoot||'C:\\Windows','System32/taskkill.exe'),['/pid',String(child.pid),'/t','/f'],{windowsHide:true,timeout:10000},done);
 else try{process.kill(-child.pid,'SIGKILL');done(null);}catch(error){done(error);}
}
function executeCheck(node,npm,script,cwd,timeout=120000,deps={}){
 return new Promise((resolve,reject)=>{
  const child=(deps.spawn||spawn)(node,[npm,'run',script],{cwd,windowsHide:true,detached:process.platform!=='win32',stdio:['ignore','ignore','ignore'],env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});
  let settled=false,timedOut=false,cleanupDone=false,closedResult,cleanupTimer;
  const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(cleanupTimer);error?reject(error):resolve(result);};
  const uncertain=()=>finish(Object.assign(Error('Check cleanup could not be verified. Inspect the process before starting more work.'),{uncertain:true}));
  const timer=setTimeout(()=>{
   timedOut=true;cleanupTimer=setTimeout(uncertain,15000);
   try{(deps.killTree||killTree)(child,error=>{if(error){uncertain();return;}cleanupDone=true;if(closedResult)finish(null,closedResult);});}catch{uncertain();}
  },timeout);
  child.once('error',error=>{if(timedOut)uncertain();else finish(error);});
  child.once('close',(exitCode,signal)=>{closedResult={exitCode:Number.isInteger(exitCode)?exitCode:null,timedOut,signal:signal||null};if(!timedOut||cleanupDone)finish(null,closedResult);});
 });
}
class MissionEvidence {
 constructor({git='git',runtime=npmRuntime,execute=executeCheck}={}){this.git=git;this.runtime=runtime;this.execute=execute;}
 async command(root,args){return (await runFile(this.git,args,{cwd:root,windowsHide:true,encoding:'utf8',maxBuffer:8*1024*1024,timeout:15000})).stdout;}
 async gitState(root){
  const actual=fs.realpathSync(root),repo=fs.realpathSync((await this.command(actual,['rev-parse','--show-toplevel'])).trim());
  const normalize=p=>process.platform==='win32'?p.toLowerCase():p;
  if(normalize(repo)!==normalize(actual))throw Error('Register the repository root before collecting mission evidence.');
  const flags=await this.command(actual,['ls-files','-v','-z']);
  if(flags.split('\0').some(row=>row&&(/^[a-z]/.test(row)||row.startsWith('S '))))throw Error('Remove assume-unchanged or skip-worktree index flags before verifying this mission.');
  const index=await this.command(actual,['ls-files','--stage','-z']);
  if(index.split('\0').some(row=>row.startsWith('160000 ')))throw Error('Submodule evidence is not supported yet. Verify the submodule repository separately.');
  const commit=(await this.command(actual,['rev-parse','HEAD'])).trim(),branch=(await this.command(actual,['branch','--show-current'])).trim();
  const status=await this.command(actual,['status','--porcelain=v1','-z','--untracked-files=all']);
  const diff=await this.command(actual,['diff','HEAD','--no-ext-diff','--no-textconv','--binary']);
  const hash=createHash('sha256').update(commit).update('\0').update(branch).update('\0').update(status).update('\0').update(diff),paths=[];
  const rows=status.split('\0');let bytes=0;
  for(let i=0;i<rows.length;i++){
   const row=rows[i];if(!row)continue;const name=row.slice(3);paths.push(name);if(paths.length>5000)throw Error('Too many changed files to verify this mission.');
   if(/[RC]/.test(row.slice(0,2)))i++;
   if(row.startsWith('??')){
    const file=path.resolve(actual,name),relative=path.relative(actual,file);
    if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('Changed path escaped its repository.');
    const info=fs.lstatSync(file);if(!info.isFile()||info.isSymbolicLink())throw Error('Untracked links or special files cannot be verified.');
    bytes+=info.size;if(bytes>16*1024*1024)throw Error('Untracked files exceed the 16 MB evidence limit. Commit or ignore generated assets first.');
    hash.update('\0'+name+'\0').update(fs.readFileSync(file));
   }
  }
  return {kind:'git',branch:branch||'(detached)',commit,dirty:paths.length>0,paths,fingerprint:hash.digest('hex'),recordedAt:Date.now()};
 }
 async runCheck(root,script,beforeEffect){
  if(!['test','build','typecheck','lint'].includes(script))throw Error('Choose a supported check.');
  const file=path.join(root,'package.json');if(!fs.existsSync(file)||fs.statSync(file).size>1024*1024)throw Error('Project package.json is unavailable.');
  const pkg=JSON.parse(fs.readFileSync(file,'utf8'));if(typeof pkg.scripts?.[script]!=='string'||!pkg.scripts[script].trim())throw Error('The '+script+' script is unavailable in this project.');
  const before=await this.gitState(root),startedAt=Date.now(),runtime=this.runtime();
  await beforeEffect?.();
  const result=await this.execute(runtime.node,runtime.npm,script,root);
  const after=await this.gitState(root);
  return {kind:'check',script,command:'npm run '+script,startedAt,recordedAt:Date.now(),durationMs:Date.now()-startedAt,...result,commit:before.commit,branch:before.branch,beforeFingerprint:before.fingerprint,fingerprint:after.fingerprint,status:result.timedOut||result.exitCode!==0?'failed':before.fingerprint!==after.fingerprint?'stale':'passed'};
 }
}
module.exports={MissionEvidence,executeCheck};
