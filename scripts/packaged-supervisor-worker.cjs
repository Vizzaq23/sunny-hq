const {parentPort,workerData:config}=require('node:worker_threads');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
let child,closed=false,control,report,stageTimer,stageRead=false;
const send=(type,value)=>parentPort.postMessage({type,...value});
function canonical(file,directory){const resolved=path.resolve(file),stat=fs.statSync(file);if(stat.isDirectory()!==directory||resolved.toLowerCase()!==fs.realpathSync.native(file).toLowerCase())throw Error('Noncanonical fixture path');for(let at=resolved;;at=path.dirname(at)){if(fs.lstatSync(at).isSymbolicLink())throw Error('Fixture alias');if(at===path.dirname(at))break;}return resolved;}
function target(file){let at=path.resolve(file),parts=[];while(!fs.existsSync(at)){parts.unshift(path.basename(at));at=path.dirname(at);}return path.join(fs.realpathSync.native(at),...parts);}
function inside(parent,child){const relative=path.relative(parent.toLowerCase(),child.toLowerCase());return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));}
async function readReport(){if(!control)return null;try{const file=path.join(control,'job-report.json');if((await fs.promises.stat(file)).size>4096)return null;return JSON.parse(await fs.promises.readFile(file,'utf8'));}catch{return null;}}
parentPort.on('message',async message=>{
 if(message.type!=='close')return;closed=true;clearInterval(stageTimer);
 // Retained ChildProcess uses its own Windows process handle; never reopen a PID.
 // The launcher's unnamed noninherited kill-on-close job contains all fixture children.
 if(child&&child.exitCode===null&&child.signalCode===null){
  // Let the launcher's already-armed absolute deadline terminate and observe its
  // job first. The outer supervisor independently caps this cleanup at 5 seconds.
  await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2500))]);
  if(child.exitCode===null&&child.signalCode===null)child.kill();
 }
 report=report||await readReport();if(report&&control)await fs.promises.copyFile(path.join(control,'job-report.json'),path.join(config.out,'job-report.json')).catch(()=>{});send('cleanup',{value:{cleanupObserved:report?.cleanupObserved===true,activeProcesses:report?.activeProcesses??null}});
});
async function run(){
 const exe=canonical(config.exe,false),asar=canonical(config.asar,false),profile=canonical(config.profile,true),out=canonical(config.out,true);
 if(asar.toLowerCase()!==path.join(path.dirname(exe),'resources','app.asar').toLowerCase()||fs.readdirSync(out).length||fs.readdirSync(profile).length)throw Error('Exact package and empty private directories required');
 const live=target(path.join(process.env.USERPROFILE||require('node:os').homedir(),'AppData','Local','Sunny HQ'));
 if(inside(live,profile)||inside(profile,live)||inside(live,out)||inside(out,live)||inside(profile,out)||inside(out,profile))throw Error('Private fixture directories overlap');
 const hash=async file=>crypto.createHash('sha256').update(await fs.promises.readFile(file)).digest('hex');
 const expected={scenario:config.scenario,exeSha256:await hash(exe),asarSha256:await hash(asar),...(config.scenario.startsWith('journey-')?{entryHashes:require('./journey-package.cjs').entryHashes(asar)}:{})};
 if(config.scenario==='ordered-control'){expected.mib=config.mib;expected.packageProof=require('./control-package.cjs').packageProof(asar,{executableSha256:expected.exeSha256,asarSha256:expected.asarSha256});}
 send('expected',{expected});
 if(closed||Date.now()>=config.deadlineUnixMs)throw Error('Deadline expired before platform launch');
 const candidates=[path.join(process.env.USERPROFILE||'','.cache','codex-runtimes','codex-primary-runtime','dependencies','native','powershell','pwsh.exe'),path.join(process.env.ProgramFiles||'C:\\Program Files','PowerShell','7','pwsh.exe')];
 const pwsh=candidates.find(file=>fs.existsSync(file));if(!pwsh)throw Error('Approved PowerShell runtime unavailable');canonical(pwsh,false);
 control=fs.mkdtempSync(path.join(path.dirname(out),'.sunny-supervisor-'));
 const request=path.join(control,'request.json');fs.writeFileSync(request,JSON.stringify({...config,exe,asar,profile,out}),{flag:'wx',mode:0o600});
 if(closed||Date.now()>=config.deadlineUnixMs)throw Error('Deadline expired before platform launch');
 send('stage',{stage:'platform-launch-requested'});
 child=spawn(pwsh,['-NoLogo','-NoProfile','-NonInteractive','-File',path.join(__dirname,'run-packaged-job.ps1'),'-Request',request],{windowsHide:true,stdio:'ignore'});
 stageTimer=setInterval(async()=>{if(closed||stageRead)return;stageRead=true;try{const records=[];for(const name of ['driver-stages.jsonl','stages-1.jsonl','stages-2.jsonl']){const file=path.join(out,name);try{if((await fs.promises.stat(file)).size>32768)continue;const lines=(await fs.promises.readFile(file,'utf8')).trim().split('\n');records.push(JSON.parse(lines.at(-1)));}catch{}}records.sort((a,b)=>String(a.utc).localeCompare(String(b.utc)));const last=records.at(-1);if(!closed&&typeof last?.stage==='string'&&/^[a-z-]{1,40}$/.test(last.stage))send('stage',{stage:last.stage});}finally{stageRead=false;}},2000);
 const exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
 clearInterval(stageTimer);
 report=await readReport();if(closed)return;
 if(exit.code!==0||!report)throw Error('Contained helper failed');
 const evidenceFile=path.join(out,'evidence.json');if((await fs.promises.stat(evidenceFile)).size>4*1024*1024)throw Error('Oversize fixture receipt');
 const evidence=JSON.parse(await fs.promises.readFile(evidenceFile,'utf8')),registrations=[];
 for(let phase=1;phase<=evidence.phases.length;phase++){const file=path.join(out,`root-registration-${phase}.json`);if((await fs.promises.stat(file)).size>4096)throw Error('Oversize root registration');registrations.push(JSON.parse(await fs.promises.readFile(file,'utf8')));}
 if(await hash(exe)!==expected.exeSha256||await hash(asar)!==expected.asarSha256)throw Error('Package changed during contained run');
 if(expected.entryHashes)require('node:assert/strict').deepEqual(require('./journey-package.cjs').entryHashes(asar),expected.entryHashes);
 let controlArtifacts;
 if(config.scenario==='ordered-control'){
  const read=async name=>{const file=path.join(out,name),stat=await fs.promises.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size<=0||stat.size>64*1024*1024)throw Error('Invalid raw ordered control artifact');return fs.promises.readFile(file);};
  controlArtifacts={resultBytes:await read('result.json'),eventBytes:await read('events.jsonl')};
  require('node:assert/strict').deepEqual(require('./control-package.cjs').packageProof(asar,{executableSha256:expected.exeSha256,asarSha256:expected.asarSha256}),expected.packageProof);
 }
 send('completed',{value:{exitCode:report.exitCode,job:report,evidence,registrations,...(controlArtifacts?{controlArtifacts}:{})}});
}
run().catch(()=>send('failed',{}));
