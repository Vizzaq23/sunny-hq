// Opt-in live inference check. Only synthetic prompts; never executes generated code.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {EventEmitter}=require('node:events');
const {Hub}=require('../desktop/hub.cjs');
const {openOrderedStore}=require('../desktop/ordered-store.cjs');

async function check(model){
 const output=path.resolve(__dirname,'../.sunny-dev/local-crew-check',randomUUID());
 fs.mkdirSync(output,{recursive:true});
 const scope={crewId:'franky',projectId:'local-check'};
 const catalog={discoverProjects:()=>[{id:scope.projectId,name:'Synthetic local AI check',path:output}],discoverTools:()=>[],discoverAutomations:()=>[]};
 async function boot(){
  const store=await openOrderedStore({kind:'json',file:path.join(output,'state.json'),backupDir:path.join(output,'backups')});
  const client=new EventEmitter();client.connected=false;client.close=()=>{};
  const hub=new Hub({home:output,store,catalog,fixtureDependencies:{client,islandFactory:()=>({close(){}})}});
  try{await hub.initializeRecovery();return hub;}catch(error){await hub.close().catch(()=>{});throw error;}
 }
 let hub;
 const report={model,startedAt:new Date().toISOString(),syntheticPrompts:true,liveInference:true,generatedCodeExecuted:false,output};
 try{
  hub=await boot();
  assert.ok((await hub.localCrew.models()).some(entry=>entry.name===model),'Requested model must already be downloaded in Ollama.');
  await hub.localCrew.configure({crewId:scope.crewId,model,skills:['review','testing']});
  await hub.localCrew.teach({...scope,text:"This fixture uses CommonJS .cjs and node:test. Standalone examples use const {test}=require('node:test'); const assert=require('node:assert/strict');. Tests finish by returning or resolving; TestContext has no end method. Empty input returns null."});
  const prompt='Give one complete CommonJS node:test file with a minimal fix and tests for empty and nonempty input. Keep it below 250 words. Do not claim to have run it. Supplied code: function first(items) { return items[0].trim(); }';
  const started=Date.now();
  const answer=await hub.localCrew.ask({...scope,prompt});
  report.reply={elapsedMs:Date.now()-started,prompt,text:answer.text};
  await hub.close();hub=await boot();
  const profile=hub.state.localCrew.profiles[scope.crewId];
  assert.equal(profile.model,model);assert.equal(profile.sessions[0].messages.length,2);
  assert.equal(hub.growth.context(scope.crewId,'empty input',scope.projectId),'');
  const recall=hub.localCrew.recall({...scope,query:'empty input'});
  assert.equal(recall.memories.length,1);assert.equal(recall.memories[0].kind,'note');
  report.restart={messages:2,pinnedLessons:1,cloudRecallEmpty:true};
  let dispatch;
  const dispatched=new Promise(resolve=>dispatch=resolve),request=hub.localCrew.request;
  hub.localCrew.request=(route,body,signal)=>{const result=request(route,body,signal);if(route==='chat')dispatch();return result;};
  const reply=hub.localCrew.ask({...scope,prompt:'Cancellation fixture: write a detailed 100-item code review checklist.'});
  // Attach rejection handling before waiting for dispatch, including preflight failures.
  const settlement=reply.then(value=>({value}),error=>({error}));
  await Promise.race([dispatched,settlement.then(result=>{throw result.error||Error('Reply finished before cancellation dispatch.');})]);
  const stopped=Date.now();await hub.localCrew.stop(scope);
  const cancelled=await settlement;assert.ok(cancelled.error,'Cancellation must reject the unfinished reply.');
  assert.equal(hub.localCrew.active,null);assert.equal(profile.sessions[0].status,'interrupted');
  assert.equal(hub.growth.profile(scope.crewId).conversations,1);
  report.cancellation={settlementMs:Date.now()-stopped,status:'interrupted',learnedInterruptedReply:false};
  report.passed=true;
 }catch(error){report.passed=false;report.error=error.message;throw error;}
 finally{
  try{await hub?.close();}catch(error){report.passed=false;report.shutdownError=error.message;throw error;}
  finally{fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));console.log('Local crew evidence: '+path.join(output,'result.json'));}
 }
 console.log('Live transport, persistence, recall isolation and cancellation passed. Review the generated example separately; these checks do not certify code quality.');
}

const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--model'||!args[1]||args[1].length>200){console.error('Usage: node scripts/check-local-crew.cjs --model <already-downloaded-model>');process.exitCode=1;}
else check(args[1]).catch(error=>{console.error(error.message);process.exitCode=1;});
