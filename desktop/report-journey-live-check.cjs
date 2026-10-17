// Real provider stages; synthetic project/vault. Captain decisions are simulated by this test harness.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {Hub}=require('./hub.cjs');const {StateStore,hash}=require('./core.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function verifyReport(text,facts,{revised=false,recommendation}={}){
 for(const value of Object.values(facts))assert.ok(text.toLowerCase().includes(value.toLowerCase()),'Missing source fact: '+value);
 assert.match(text,/facts\.json/);assert.ok(text.trim().split(/\s+/).length<500,'Report exceeds its word bound');
 for(const section of ['completed','blocked','next'])assert.match(text,new RegExp('^#{1,6}\\s+'+section+'\\b','im'),'Missing report section: '+section);
 if(revised)assert.match(text,/^Follow-up: captain review remains required\.[ \t]*$/m,'Requested follow-up must be its own line');
 if(recommendation!==undefined)assert.match(recommendation,/Recommendation:\s*(?:\*\*)?accept\b/i,'Coordinator did not recommend acceptance; retain for captain review');
}
async function main(){
 if(process.env.SUNNY_RUN_LIVE_REPORT!=='1')throw Error('Set SUNNY_RUN_LIVE_REPORT=1 to use existing account quota for three isolated report journeys.');
 const npmCli=path.join(path.dirname(process.execPath),'node_modules','npm','bin','npm-cli.js');
 assert.ok(fs.existsSync(npmCli),'The documented direct npm CLI must exist before starting the live fixture');
 const psQuote=value=>"'"+value.replaceAll("'","''")+"'";
 const testCommand=`& ${psQuote(process.execPath)} ${psQuote(npmCli)} test`;
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-live-report-'));
 const evidence={root,startedAt:new Date().toISOString(),provider:'installed Codex app-server',reviewActor:'test harness simulating captain decisions',trials:[],passed:false};
 const record=()=>fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(evidence,null,2));record();console.log(JSON.stringify({stage:'created',root}));
 for(let trial=1;trial<=3;trial++){
  const runtime=path.join(root,'trial-'+trial),project=path.join(runtime,'project'),vault=path.join(runtime,'vault');fs.mkdirSync(project,{recursive:true});fs.mkdirSync(vault);
  const facts={project:'Fixture launch '+trial,completed:'Draft homepage approved',blocked:'Payment setup awaiting captain decision',next:'Verify mobile navigation',asOf:'2026-10-12'};
  const source=JSON.stringify(facts,null,2),agents='This is a synthetic local report test. Only report.md may change. Do not edit facts.json, tests, package.json or AGENTS.md. No web, external services, commits, publication, credentials, purchases or background work. Use the provided local facts. Keep the report concise. Read-only planning/review steps must not edit files.\n'+`The Windows npm shim is broken on this machine. Run the unchanged package.json test script in PowerShell with this verified direct CLI command: ${testCommand}\nDo not repair or replace the test or npm installation.\n`;
  const check="const fs=require('node:fs'),assert=require('node:assert/strict');const facts=JSON.parse(fs.readFileSync('facts.json','utf8')),report=fs.readFileSync('report.md','utf8');for(const value of Object.values(facts))assert.ok(report.toLowerCase().includes(value.toLowerCase()),'Missing fact: '+value);assert.match(report,/facts\\.json/);assert.match(report,/#/);console.log('Report facts verified');\n";
  fs.writeFileSync(path.join(project,'facts.json'),source);fs.writeFileSync(path.join(project,'AGENTS.md'),agents);fs.writeFileSync(path.join(project,'report.test.cjs'),check);const manifest=JSON.stringify({private:true,scripts:{test:'node report.test.cjs'}});fs.writeFileSync(path.join(project,'package.json'),manifest);
  const git=(...args)=>execFileSync('git',args,{cwd:project,windowsHide:true,stdio:'pipe'}).toString().trim();git('init');git('config','user.email','fixture@example.invalid');git('config','user.name','Sunny report fixture');git('add','.');git('commit','-m','Synthetic report facts');
  const catalog={discoverProjects:()=>[{id:'report',name:'Synthetic report',path:project,category:'development'}],discoverTools:()=>[],discoverAutomations:()=>[],vaultPath:()=>vault};
  const stateFile=path.join(runtime,'state.json'),open=()=>new Hub({home:os.homedir(),store:new StateStore(stateFile),catalog});let hub=open(),mission,activeTask,stage='connect';
  const result={trial,steps:[],passed:false};evidence.trials.push(result);
  const step=(name,detail={})=>{stage=name;result.lastSuccessfulStep=name;result.steps.push({name,time:new Date().toISOString(),...detail});record();console.log(JSON.stringify({trial,stage:name,...detail}));};
  const verifyInputs=()=>{assert.equal(fs.readFileSync(path.join(project,'facts.json'),'utf8'),source);assert.equal(fs.readFileSync(path.join(project,'AGENTS.md'),'utf8'),agents);assert.equal(fs.readFileSync(path.join(project,'report.test.cjs'),'utf8'),check);assert.equal(fs.readFileSync(path.join(project,'package.json'),'utf8'),manifest);assert.equal(git('diff','HEAD','--name-only'),'');assert.equal(git('ls-files','--others','--exclude-standard'),'report.md');};
  const runAttempt=async()=>{
   const task=await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'coordinator'});activeTask=task;step('coordinator-started',{taskId:task.id,attemptId:mission.activeAttemptId,model:task.model});
   const end=Date.now()+480000;let prior='';
   while(['RUNNING','NEEDS_USER'].includes(mission.status)){
    if(hub.state.approvals.length)throw Error('Provider requested human approval; this probe grants none.');
    if(Date.now()>end)throw Error('Coordinated report deadline reached.');
    const stages=mission.attempts.at(-1).workflow?.stages||[];const next=JSON.stringify(stages.map(item=>({id:item.id,status:item.status,taskId:item.taskId})));
    if(next!==prior){prior=next;console.log(JSON.stringify({trial,stage:'crew-progress',stages:JSON.parse(next)}));}
    await pause(250);
   }
   assert.equal(mission.status,'WAITING_FOR_REVIEW',mission.attempts.at(-1).error);assert.equal(task.status,'finished');
   assert.equal(mission.attempts.at(-1).workflow.complete,true);verifyInputs();
   const recommendation=task.messages.findLast(message=>message.role==='assistant')?.text;assert.ok(recommendation?.trim());
   await hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,script:'test'});assert.equal(mission.artifacts.at(-1).status,'passed');
   await hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,filePath:'report.md'});const artifact=mission.artifacts.at(-1);
   const preview=hub.previewMissionDeliverable({missionId:mission.id,revision:mission.revision,artifactId:artifact.id});assert.ok(preview.text.length>80);
   step('report-inspected',{taskId:task.id,attemptId:mission.activeAttemptId,reportHash:preview.sha256,stages:mission.attempts.at(-1).workflow.stages,recommendation});stage='quality-check';
   verifyReport(preview.text,facts,{revised:Boolean(mission.reviewDecisions?.some(item=>item.decision==='changes-requested')),recommendation});
   return {task,preview};
  };
  try{
   await hub.connect();mission=hub.createMission({projectId:'report',title:'Create a project-status report',objective:'Create report.md from facts.json. Include every exact source value and cite facts.json. Keep it under 500 words with Markdown headings Completed, Blocked and Next. Use Nami to plan, Robin to write the report, Usopp to verify with the existing npm test, and Zoro to review. All four stages are required. Only report.md may change. Return Luffy’s decision as the exact line Recommendation: accept or Recommendation: request changes, followed by exact task IDs and report path; do not claim human acceptance.',acceptanceCriteria:['Report contains every supplied project fact and cites facts.json','Only report.md changed and the original deterministic test passes','All four crew stages returned inspectable results'],completionBoundary:'review'});result.missionId=mission.id;
   await hub.prepareMissionBranch({missionId:mission.id,revision:mission.revision});const first=await runAttempt();const oldRevision=mission.revision;
   const feedback='Add a standalone final line to report.md, separated by a newline from all other text: Follow-up: captain review remains required. Keep every existing source fact and cite facts.json.';
   hub.requestMissionChanges({missionId:mission.id,revision:oldRevision,note:feedback});assert.equal(mission.status,'BLOCKED');
   await assert.rejects(hub.acceptMission({missionId:mission.id,revision:oldRevision,criteria:[true,true,true]}),/changed/);step('changes-requested',{attemptId:mission.activeAttemptId,note:feedback});
   const missionId=mission.id;hub.close();hub=open();mission=hub.missionBook.get(missionId);assert.equal(mission.status,'BLOCKED');assert.equal(mission.reviewDecisions.at(-1).note,feedback);step('review-decision-survived-restart');
   const revised=await runAttempt();assert.notEqual(first.task.id,revised.task.id);assert.match(revised.preview.text,/Follow-up: captain review remains required\./);
   await hub.acceptMission({missionId:mission.id,revision:mission.revision,criteria:[true,true,true]});assert.equal(mission.status,'COMPLETE');
   const message=revised.task.messages.findLast(item=>item.role==='assistant');const saved=hub.resultSaves.save({taskId:revised.task.id,messageId:message.id,title:mission.title,text:revised.preview.text,reviewed:true});assert.equal(saved.missionId,mission.id);assert.equal(saved.attemptId,mission.activeAttemptId);
   hub.close();hub=open();mission=hub.missionBook.get(missionId);assert.equal(mission.status,'COMPLETE');assert.deepEqual(mission.reviewDecisions.map(item=>item.decision),['changes-requested','accepted']);assert.equal(hub.resultSaves.recover({saveId:saved.id}).status,'saved');
   assert.equal(hash(fs.readFileSync(saved.path)),saved.receipt.sha256);assert.equal(fs.readdirSync(path.join(vault,'00 Inbox')).length,1);assert.equal(hub.state.approvals.length,0);
   step('accepted-and-saved-after-restart',{acceptedAttemptId:mission.activeAttemptId,saveId:saved.id,notePath:saved.path});result.passed=true;record();
  }catch(error){result.failure={stage,missionId:mission?.id,taskId:activeTask?.id,error:error.message};record();throw error;}
  finally{for(const task of hub.state.tasks.filter(item=>item.captain&&['starting','working','waiting','unknown'].includes(item.status)))await hub.captain.stop(task).catch(error=>{result.cleanupError=error.message;record();});for(const task of hub.state.tasks.filter(item=>['starting','working','waiting','unknown'].includes(item.status)))await hub.interrupt(task.id).catch(error=>{result.cleanupError=error.message;record();});hub.close();}
 }
 evidence.passed=true;evidence.finishedAt=new Date().toISOString();record();console.log('SUNNY_LIVE_REPORT '+JSON.stringify({passed:true,root,trials:evidence.trials.map(trial=>({trial:trial.trial,missionId:trial.missionId,passed:trial.passed})),reviewActor:evidence.reviewActor}));return evidence;
}
if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={main,verifyReport};
