// Explicitly opt-in: real installed provider, existing sign-in/account quota, isolated local project.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {Hub}=require('./hub.cjs');const {StateStore}=require('./core.cjs');const {allocatedTask}=require('./mission-live-check.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 if(process.env.SUNNY_RUN_LIVE_CREATIVE!=='1')throw Error('Set SUNNY_RUN_LIVE_CREATIVE=1 to run this live-provider check using existing account quota.');
 const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-live-creative-')),root=path.join(runtime,'project');fs.mkdirSync(root);
 const rules='This is an isolated Sunny creative verification project. Create only welcome.md. Do not change AGENTS.md, create any other files, run Git operations, contact external services, publish, or use other providers. Write original prose from the supplied mission brief. Report the created file and any limitations.\n';
 fs.writeFileSync(path.join(root,'AGENTS.md'),rules);
 const store=new StateStore(path.join(runtime,'state.json')),hub=new Hub({home:os.homedir(),store,catalog:{discoverProjects:()=>[{id:'creative-check',name:'Isolated creative check',path:root,category:'creative'}],discoverTools:()=>[],discoverAutomations:()=>[]}});
 const errors=[];hub.on('event',event=>{if(event.type==='error')errors.push(event.data?.message||'Hub error');});let task,missionId;
 console.log(JSON.stringify({stage:'created',runtime}));
 try{
  await hub.connect();assert.equal(hub.state.codex.status,'connected');
  const mission=hub.createMission({projectId:'creative-check',title:'Write Sunny welcome note',objective:'Create welcome.md in this isolated project: an original 150–250 word welcome for a captain entering Sunny HQ. Use exactly these three Markdown headings: # Welcome aboard; ## Your first voyage; ## Captain review. Explain choosing a project, giving the crew a mission with observable criteria, inspecting actual results, and personally authorizing consequential actions. Keep a warm pirate-adventure tone, plain language, and no invented connected services, claims of finished work, quotations or copied lyrics. This is a written product-copy draft, not a fictional task-status report. Do not modify AGENTS.md or create any other files, use Git, contact external services, publish, or install anything. Report the file you created and the word count.',acceptanceCriteria:['Original 150–250 word draft with the three requested headings','Clear mission/result/review guidance without invented integrations','Only welcome.md created; project instructions unchanged'],completionBoundary:'review'});
  missionId=mission.id;task=await hub.startMission({missionId,revision:mission.revision,roleId:'creator'});console.log(JSON.stringify({stage:'provider-started',taskId:task.id,model:task.model}));
  const deadline=Date.now()+150000;let previous;
  while(['starting','working','waiting','unknown'].includes(task.status)){
   if(task.status!==previous){console.log(JSON.stringify({stage:'provider-state',status:task.status}));previous=task.status;}
   if(hub.state.approvals.length)throw Error('Provider requested human approval; this harness grants none.');
   if(Date.now()>deadline)throw Error('Creative verification deadline reached.');await sleep(250);
  }
  assert.equal(task.status,'finished',task.error||'Provider did not finish');assert.equal(mission.status,'WAITING_FOR_REVIEW');
  assert.deepEqual(fs.readdirSync(root).sort(),['AGENTS.md','welcome.md']);assert.equal(fs.readFileSync(path.join(root,'AGENTS.md'),'utf8'),rules);
  const artifact=await hub.collectMissionEvidence({missionId,revision:mission.revision,filePath:'welcome.md'});
  const preview=hub.previewMissionDeliverable({missionId,revision:mission.revision,artifactId:artifact.id});
  assert.deepEqual(preview.text.split(/\r?\n/).filter(line=>/^#{1,6} /.test(line)),['# Welcome aboard','## Your first voyage','## Captain review']);
  const words=preview.text.trim().split(/\s+/).length;assert.ok(words>=150&&words<=250,'Word count must meet the brief');assert.deepEqual(errors,[]);
  hub.persist();const saved=new StateStore(store.file).load();assert.equal(saved.missionBook.missions[0].status,'WAITING_FOR_REVIEW');assert.equal(saved.missionBook.missions[0].artifacts[0].sha256,artifact.sha256);assert.equal(artifact.text,undefined);
  const result={passed:true,provider:'live installed Codex app-server',runtime,model:task.model,crewId:task.crewId,roleId:'creator',taskId:task.id,missionId,artifactId:artifact.id,filePath:artifact.filePath,sha256:artifact.sha256,bytes:artifact.bytes,words,missionStatus:mission.status,accepted:false,scope:'One real written creative mission in an isolated non-Git project; original file inspected through Sunny; no media-provider or publication claim.'};
  fs.writeFileSync(path.join(runtime,'result.json'),JSON.stringify(result,null,2));console.log('SUNNY_LIVE_CREATIVE '+JSON.stringify(result));
 }finally{task=allocatedTask(hub,task,missionId);if(task&&['starting','working','waiting','unknown'].includes(task.status))try{await hub.interrupt(task.id);}catch(error){console.error('Interrupt could not be confirmed: '+error.message);}hub.close();}
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={main};
