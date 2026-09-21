// Opt-in live-provider check. Uses existing sign-in and account quota; no remote Git actions.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');const {Hub}=require('./hub.cjs');const {StateStore}=require('./core.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function verifyRepository(git,head,branch){assert.equal(git('rev-parse','HEAD'),head,'Provider must not create commits');assert.equal(git('branch','--show-current'),branch,'Provider must not switch branches');assert.equal(git('diff','HEAD','--name-only'),'sum.cjs','Only implementation may differ from the fixture commit');assert.equal(git('ls-files','--others','--exclude-standard'),'','No untracked deliverables allowed');}
function allocatedTask(hub,task,missionId){if(task)return task;const mission=hub.state.missions.find(m=>m.id===missionId),attempt=mission?.attempts.find(a=>a.id===mission.activeAttemptId);return hub.state.tasks.find(t=>t.id===attempt?.taskId);}
async function main(){
 if(process.env.SUNNY_RUN_LIVE_MISSION!=='1')throw Error('Set SUNNY_RUN_LIVE_MISSION=1 to explicitly run this live-provider check. It uses your existing account quota.');
 const coordinated=process.env.SUNNY_LIVE_COORDINATED==='1';
 const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-live-mission-')),projectRoot=path.join(runtime,'project');fs.mkdirSync(projectRoot);
 const git=(...args)=>execFileSync('git',args,{cwd:projectRoot,windowsHide:true,stdio:'pipe'}).toString().trim();
 const files={
  'package.json':JSON.stringify({name:'sunny-live-check',private:true,scripts:{test:'node --test sum.test.cjs'}}),
  'sum.cjs':"module.exports = function sum(numbers) { throw new Error('Implement me'); };\n",
  'sum.test.cjs':"const {test}=require('node:test');const assert=require('node:assert/strict');const sum=require('./sum.cjs');test('sum handles empty and signed decimal inputs without mutating them',()=>{assert.equal(sum([]),0);const input=[1,-2,3.5];assert.equal(sum(input),2.5);assert.deepEqual(input,[1,-2,3.5]);});\n",
  'AGENTS.md':'This is an isolated Sunny integration test. Only edit sum.cjs. Do not edit tests/configuration, create commits, switch branches, use external tools or contact any service. Implement the requested function and report the test result.\n'
 };
 for(const [name,content] of Object.entries(files))fs.writeFileSync(path.join(projectRoot,name),content);
 git('init');git('config','user.email','fixture@example.invalid');git('config','user.name','Sunny live verification');git('add','.');git('commit','-m','Deliberately failing isolated fixture');const initialHead=git('rev-parse','HEAD');
 const store=new StateStore(path.join(runtime,'state.json'));const hub=new Hub({home:os.homedir(),store,catalog:{discoverProjects:()=>[{id:'live-check',name:'Isolated live check',path:projectRoot,category:'development'}],discoverTools:()=>[],discoverAutomations:()=>[]}});
 const errors=[];hub.on('event',event=>{if(event.type==='error')errors.push(event.data?.message||'Hub error');});let task,missionId;
 console.log(JSON.stringify({stage:'created',runtime}));
 try{
  const before=await hub.evidence.runCheck(projectRoot,'test');assert.equal(before.status,'failed');
  await hub.connect();assert.equal(hub.state.codex.status,'connected');
  const mission=hub.createMission({projectId:'live-check',title:'Live provider: implement sum',objective:'In this isolated test project, implement sum(numbers) in sum.cjs as CommonJS. Return the sum of finite numbers, return zero for an empty array, and do not mutate the input. Only change sum.cjs. Run the existing npm test command and report its outcome. Do not edit tests/configuration, commit, switch branches, access any external service, or publish anything.',acceptanceCriteria:['Existing test passes unchanged','Only sum.cjs changed'],completionBoundary:'review'});
  missionId=mission.id;
  await hub.prepareMissionBranch({missionId:mission.id,revision:mission.revision});
  task=await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:coordinated?'coordinator':'builder'});console.log(JSON.stringify({stage:'provider-started',taskId:task.id,model:task.model}));
  const deadline=Date.now()+(coordinated?480000:150000);let lastProgress='';
  while(['starting','working','waiting','unknown'].includes(task.status)||hub.state.tasks.some(t=>t.parentTaskId===task.id&&['starting','working','waiting','unknown'].includes(t.status))){
   const progress=hub.state.tasks.filter(t=>t.parentTaskId===task.id).map(t=>({crewId:t.crewId,status:t.status}));const key=JSON.stringify(progress);if(key!==lastProgress){lastProgress=key;console.log(JSON.stringify({stage:'crew-progress',tasks:progress}));}
   if(hub.state.approvals.length)throw Error('Live task requested approval; no approval was granted by this check.');
   if(Date.now()>deadline)throw Error('Live task deadline reached; interrupting this isolated attempt.');
   await sleep(250);
  }
  assert.equal(task.status,'finished',task.error||'Provider did not finish');assert.equal(mission.status,'WAITING_FOR_REVIEW');
  const workflow=coordinated?mission.attempts.at(-1).workflow:undefined;if(coordinated){assert.equal(workflow?.complete,true);assert.deepEqual(workflow.stages.map(s=>s.id),['plan','work','validate','review']);assert.ok(workflow.stages.every(s=>s.status==='complete'&&hub.state.tasks.some(t=>t.id===s.taskId&&t.status==='finished'&&t.messages.some(m=>m.role==='assistant'&&m.text?.trim()))));}
  for(const [name,content] of Object.entries(files))if(name!=='sum.cjs')assert.equal(fs.readFileSync(path.join(projectRoot,name),'utf8'),content,name+' must stay unchanged');
  verifyRepository(git,initialHead,mission.branch.name);
  await hub.collectMissionEvidence({missionId:mission.id,revision:mission.revision,script:'test'});
  const check=mission.artifacts.at(-1);assert.equal(check.status,'passed');assert.equal(mission.status,'WAITING_FOR_REVIEW');assert.deepEqual(errors,[]);
  hub.persist();const saved=JSON.parse(fs.readFileSync(store.file,'utf8'));assert.equal(saved.missionBook.missions[0].status,'WAITING_FOR_REVIEW');
  const result={passed:true,coordinated,workflow,provider:'live installed Codex app-server',runtime,model:task.model,taskId:task.id,missionId:mission.id,branch:git('branch','--show-current'),changedFiles:['sum.cjs'],test:check.status,missionStatus:mission.status,accepted:false,remoteGitActions:false};
  fs.writeFileSync(path.join(runtime,'result.json'),JSON.stringify(result,null,2));console.log('SUNNY_LIVE_MISSION '+JSON.stringify(result));
 }finally{
  task=allocatedTask(hub,task,missionId);
  if(task?.captain)await hub.captain.stop(task).catch(error=>console.error('Crew stop could not be confirmed: '+error.message));
  if(task&&['starting','working','waiting','unknown'].includes(task.status)){try{await hub.interrupt(task.id);}catch(error){console.error('Interrupt could not be confirmed: '+error.message);}}
  hub.close();
 }
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={main,verifyRepository,allocatedTask};
