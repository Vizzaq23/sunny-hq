// Explicit local-model probe. Synthetic source only; generated code is never executed.
const fs=require('node:fs');const path=require('node:path');const {randomUUID}=require('node:crypto');const {EventEmitter}=require('node:events');const assert=require('node:assert/strict');
const {Hub}=require('../desktop/hub.cjs');const {openOrderedStore}=require('../desktop/ordered-store.cjs');
async function check(model){
 const output=path.resolve(__dirname,'../.sunny-dev/local-council-check',randomUUID());fs.mkdirSync(output,{recursive:true});
 const catalog={discoverProjects:()=>[{id:'fixture',name:'Synthetic council check',path:output}],discoverTools:()=>[],discoverAutomations:()=>[]};
 async function boot(){const store=await openOrderedStore({kind:'json',file:path.join(output,'state.json'),backupDir:path.join(output,'backups')});const client=new EventEmitter();client.connected=false;client.close=()=>{};const hub=new Hub({home:output,store,catalog,fixtureDependencies:{client,islandFactory:()=>({close(){}})}});await hub.initializeRecovery();return hub;}
 let hub;const report={model,output,startedAt:new Date().toISOString(),synthetic:true,generatedCodeExecuted:false};
 try{
  hub=await boot();await hub.localCouncil.setup({model});assert.equal(Object.keys(hub.state.localCrew.profiles).length,15);
  let previous='';hub.on('event',()=>{const record=hub.localCouncil.active?.record;if(!record)return;const state=record.status+': '+record.contributions.map(item=>item.crewId+'='+item.status).join(', ');if(state!==previous){previous=state;console.log(state);}});
  report.council=await hub.localCouncil.start({projectId:'fixture',objective:'Help improve this synthetic TypeScript utility with a small correct fix and runnable Vitest checks. Supplied implementation: export function first(items: string[]) { return items[0].trim(); } Desired contract: return null for an empty array; otherwise return the trimmed first string. No repository or test execution has occurred. Ask only the specialists needed for this code problem; keep each reply below 300 words.',concurrency:2});
  assert.ok(['ready','partial'].includes(report.council.status));assert.ok(report.council.contributions.length>0);assert.ok(report.council.summary);
  report.bulletin=await hub.localCouncil.report({id:report.council.id});assert.equal(report.bulletin.status,'ready');
  await hub.close();hub=await boot();assert.equal(hub.state.localCrew.councils[0].summary,report.council.summary);assert.equal(hub.state.localCrew.profiles.morgans.model,model);
  report.passed=true;
 }catch(error){report.error=error.stack;throw error;}
 finally{await hub?.close().catch(error=>{report.closeError=error.message;});report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));console.log('SUNNY_LOCAL_COUNCIL '+JSON.stringify({passed:report.passed??false,output,error:report.error}));}
}
if(require.main===module){const model=process.argv[2];if(!model){console.error('Supply an already downloaded local model.');process.exitCode=1;}else check(model).catch(error=>{console.error(error.message);process.exitCode=1;});}
module.exports={check};
