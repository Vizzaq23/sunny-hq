// Opt-in actual Sunny creator -> installed provider image tool -> local PNG review.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {Hub}=require('./hub.cjs');const {StateStore}=require('./core.cjs');const {allocatedTask}=require('./mission-live-check.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 if(process.env.SUNNY_RUN_LIVE_VISUAL!=='1')throw Error('Set SUNNY_RUN_LIVE_VISUAL=1 to use existing provider quota for this isolated visual check.');
 const {app}=require('electron');await app.whenReady();
 const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-live-visual-')),root=path.join(runtime,'project');fs.mkdirSync(root);
 const rules='Isolated Sunny visual verification project. Use only the built-in image-generation tool, never a paid API fallback or new provider. Create only mission-emblem.png and provenance.md in this project. Tool-managed generated-image outputs outside the project are allowed; copy the selected original into the project. Do not change AGENTS.md, use Git, install anything, publish or contact other services. If image generation is unavailable, report that honestly; do not draw a substitute with code.\n';
 fs.writeFileSync(path.join(root,'AGENTS.md'),rules);
 const store=new StateStore(path.join(runtime,'state.json')),hub=new Hub({home:os.homedir(),store,catalog:{discoverProjects:()=>[{id:'visual-check',name:'Isolated visual check',path:root,category:'creative'}],discoverTools:()=>[],discoverAutomations:()=>[]}});
 const errors=[],imageEvents=[];hub.on('event',e=>{if(e.type==='error')errors.push(e.data?.message||'Hub error');});
 hub.client.on('notification',e=>{if(e.params?.item?.type==='imageGeneration'){const item=e.params.item;imageEvents.push({method:e.method,id:item.id,status:item.status});console.log(JSON.stringify({stage:'image-tool',method:e.method,status:item.status}));}});
 let task,missionId;console.log(JSON.stringify({stage:'created',runtime}));
 try{
  await hub.connect();assert.equal(hub.state.codex.status,'connected');
  const objective='Generate one original square PNG concept for a Sunny HQ mission emblem using your built-in image-generation tool. Warm hand-painted/cel-shaded pirate-adventure style: a small brass compass resting on a rolled cream parchment chart, a teal ribbon and a tiny red wax seal, centered on a plain warm ivory background. Readable simple silhouette, soft sunny light, no text, letters, logos, characters, watermarks or UI. This is a review candidate, not installed product art. Save the original generated PNG unchanged as mission-emblem.png. Write provenance.md with the exact prompt used, tool name, original generated output path and any limitations. Only these two project files may be created; leave AGENTS.md unchanged. Tool-managed output files are allowed. Use no API fallback, purchases, installations, Git operations or publication. If the built-in image tool is unavailable, report it instead of creating a substitute with code. Report actual output paths and what remains for captain review.';
  const mission=hub.createMission({projectId:'visual-check',title:'Create original mission emblem',objective,acceptanceCriteria:['Original generated PNG with the requested compass/chart motif','Exact prompt and tool source recorded','Only the two requested project files created; no acceptance or publication'],completionBoundary:'review'});
  missionId=mission.id;task=await hub.startMission({missionId,revision:mission.revision,roleId:'creator'});console.log(JSON.stringify({stage:'provider-started',taskId:task.id,model:task.model}));
  const deadline=Date.now()+360000;let previous;
  while(['starting','working','waiting','unknown'].includes(task.status)){
   if(task.status!==previous){console.log(JSON.stringify({stage:'provider-state',status:task.status}));previous=task.status;}
   if(hub.state.approvals.length)throw Error('Provider requested captain approval; this check grants none.');
   if(Date.now()>deadline)throw Error('Visual check deadline reached.');await sleep(250);
  }
  assert.equal(task.status,'finished',task.error||'Provider did not finish');assert.equal(mission.status,'WAITING_FOR_REVIEW');
  assert.ok(imageEvents.some(e=>e.method==='item/completed'&&e.status==='completed'&&imageEvents.some(start=>start.method==='item/started'&&start.id===e.id)),'No completed built-in image generation was observed');
  fs.writeFileSync(path.join(runtime,'provider-result.txt'),task.messages.filter(m=>m.role==='assistant').map(m=>m.text||'').join('\n\n'));
  assert.deepEqual(fs.readdirSync(root).sort(),['AGENTS.md','mission-emblem.png','provenance.md']);assert.equal(fs.readFileSync(path.join(root,'AGENTS.md'),'utf8'),rules);
  const notes=fs.readFileSync(path.join(root,'provenance.md'),'utf8');assert.ok(notes.trim());
  const artifact=await hub.collectMissionEvidence({missionId,revision:mission.revision,imagePath:'mission-emblem.png',provenance:{source:'Actual Sunny creator mission using installed Codex built-in image generation. Exact prompt and original output path are in provenance.md.',usage:'Review candidate only; no runtime admission, publication or captain acceptance.'}});
  const preview=hub.previewMissionDeliverable({missionId,revision:mission.revision,artifactId:artifact.id});assert.equal(preview.sha256,artifact.sha256);assert.match(preview.dataUrl,/^data:image\/png;base64,/);assert.equal(artifact.dataUrl,undefined);
  await hub.collectMissionEvidence({missionId,revision:mission.revision,filePath:'provenance.md'});hub.persist();const saved=new StateStore(store.file).load();assert.equal(saved.missionBook.missions[0].status,'WAITING_FOR_REVIEW');assert.equal(saved.missionBook.missions[0].artifacts[0].sha256,artifact.sha256);assert.deepEqual(errors,[]);
  const result={passed:true,provider:'live installed Codex app-server',runtime,model:task.model,taskId:task.id,missionId,roleId:'creator',crewId:task.crewId,artifactId:artifact.id,filePath:artifact.filePath,sha256:artifact.sha256,bytes:artifact.bytes,width:artifact.width,height:artifact.height,imageEvents,missionStatus:mission.status,accepted:false,scope:'Actual Sunny creator dispatch and original PNG file review with native decoder. Generation provenance requires inspection of recorded tool events/output notes. No publication or captain acceptance.'};
  fs.writeFileSync(path.join(runtime,'result.json'),JSON.stringify(result,null,2));console.log('SUNNY_LIVE_VISUAL '+JSON.stringify(result));
 }finally{task=allocatedTask(hub,task,missionId);if(task&&['starting','working','waiting','unknown'].includes(task.status))try{await hub.interrupt(task.id);}catch(e){console.error('Interrupt could not be confirmed: '+e.message);}hub.close();}
}
if(require.main===module||(process.type==='browser'&&path.resolve(process.argv[1]||'')===__filename))main().then(()=>require('electron').app.exit(0),e=>{console.error(e.message);require('electron').app?.exit(1);process.exitCode=1;});
module.exports={main};
