// Native UI + real Git/Hub/persistence; provider and all GitHub transport are labelled fixtures.
const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {Hub}=require('./hub.cjs');const {StateStore}=require('./core.cjs');
const output=path.join(__dirname,'../.sunny-dev/mission-check',String(Date.now()));fs.mkdirSync(output,{recursive:true});const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-mission-'));app.setPath('userData',path.join(runtime,'profile'));
app.whenReady().then(async()=>{
 const projectRoot=path.join(runtime,'project');fs.mkdirSync(projectRoot);const git=(...args)=>execFileSync('git',args,{cwd:projectRoot,windowsHide:true,stdio:'pipe'});
 git('init');git('config','user.email','fixture@example.invalid');git('config','user.name','Sunny fixture');
 const fixturePng=process.env.SUNNY_SMOKE_IMAGE?fs.readFileSync(process.env.SUNNY_SMOKE_IMAGE):require('electron').nativeImage.createFromBitmap(Buffer.alloc(128*96*4,220),{width:128,height:96}).toPNG();fs.writeFileSync(path.join(projectRoot,'concept.png'),fixturePng);const imageWidth=require('electron').nativeImage.createFromBuffer(fixturePng).getSize().width;
 fs.writeFileSync(path.join(projectRoot,'welcome.md'),'# Welcome aboard\nFixture creative note.\n<script>window.sunnyDeliverableExecuted=true</script>');
 fs.writeFileSync(path.join(projectRoot,'package.json'),JSON.stringify({scripts:{test:'node -e "process.exit(0)"'}}));git('add','.');git('commit','-m','Fixture check');git('remote','add','origin','https://github.com/fixture/sunny.git');
 const store=new StateStore(path.join(runtime,'state.json'));
 const hub=new Hub({home:runtime,store,catalog:{discoverProjects:()=>[{id:'fixture',name:'Fixture project',path:projectRoot,category:'development'}],discoverTools:()=>[],discoverAutomations:()=>[]}});
 const win=new BrowserWindow({width:1280,height:900,show:false,webPreferences:{offscreen:true,backgroundThrottling:false,preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 // All publishing transport is intercepted here: this fixture never pushes or creates a remote PR.
 const mergeViaUi=process.env.SUNNY_SMOKE_MERGE_UI==='1';let fixtureMerged=process.env.SUNNY_SMOKE_MERGE==='1'&&!mergeViaUi;const publicationCalls=[];hub.publisher.run=async(exe,args)=>{publicationCalls.push({exe,args,...(args[0]==='pr'?{body:fs.readFileSync(args[args.indexOf('--body-file')+1],'utf8')}:{})});assert.notEqual(args[0],'api','No remote merge submission is allowed');return args[0]==='pr'?'https://github.com/fixture/sunny/pull/1\n':'';};
 const openedUrls=[];
 let failure;const mergeBound=process.env.SUNNY_SMOKE_MERGE==='1';const coordinated=process.env.SUNNY_SMOKE_COORDINATED==='1';let threadSequence=0,failNextBrief=true;
 hub.pullRequests.read=async()=>({number:1,url:'https://github.com/fixture/sunny/pull/1',state:fixtureMerged?'MERGED':'OPEN',mergedAt:fixtureMerged?'2026-09-21T12:00:00Z':null,headRefOid:git('rev-parse','HEAD').toString().trim(),headRefName:git('branch','--show-current').toString().trim(),baseRefName:'main',isDraft:false,reviewDecision:'APPROVED',statusCheckRollup:mergeBound?[{__typename:'CheckRun',status:'COMPLETED',conclusion:'SUCCESS'}]:[]});
 const deploymentCalls=[];hub.deployments.read=async args=>{deploymentCalls.push(args);assert.equal(args[args.indexOf('--method')+1],'GET');const base='https://api.github.com/repos/fixture/sunny',url=base+'/deployments/42';return args.at(-1).includes('/statuses?')?[{id:43,url:url+'/statuses/43',deployment_url:url,state:'success',created_at:'2026-09-21T12:00:00Z'}]:[{id:42,url,repository_url:base,statuses_url:url+'/statuses',environment:'fixture-preview',sha:git('rev-parse','HEAD').toString().trim(),created_at:'2026-09-21T11:00:00Z'}];};
 hub.client.connected=true;hub.state.codex.status='connected';hub.state.settings.reducedMotion=true;
 hub.client.request=async method=>{if(method==='config/read')return {config:{}};if(method==='thread/start')return {thread:{id:'fixture-thread-'+(++threadSequence)}};if(method==='turn/start')return {turn:{id:'fixture-turn-'+threadSequence}};throw Error('Unexpected fixture call '+method);};
 const appErrors=[];hub.on('event',event=>{if(event.type==='error')appErrors.push(event.data);win.webContents.send('sunny:event',event);});
 win.webContents.on('console-message',event=>{if(event.level==='error'){appErrors.push({message:event.message});console.error('Renderer:',event.message);}});
 ipcMain.handle('sunny:invoke',async(_e,action,args)=>{
  if(action==='skills:suggest')return {available:[],suggested:[]};
  if(action==='snapshot')return hub.state;
  if(action==='task:resolveMissingThread')return hub.resolveMissingThread(args);
  if(action==='files:list')return [];
  if(action==='asset:crewTexture'||action==='app:diagnostic')return null;
  if(action==='mission:signalSeen')return hub.markMissionSignalSeen(args);
  if(action==='mission:prepareMerge')return hub.merger.act(args,'prepare');
  if(action==='mission:recheckMerge')return hub.merger.act(args,'recheck');
  if(action==='dialog:openExternal'){openedUrls.push(args);return null;}
  if(action==='mission:preparePr')return hub.publication.act(args,'prepare');
  if(action==='mission:editPr')return hub.publication.act(args,'edit');
  if(action==='mission:publishPr')return hub.publication.act(args,'publish');
  if(action==='mission:create'){if(failNextBrief){failNextBrief=false;throw Error('Fixture brief save unavailable');}return hub.createMission(args);}
  if(action==='mission:prepareBranch')return hub.prepareMissionBranch(args);
  if(action==='mission:start')return hub.startMission(args);
  if(action==='mission:accept')return hub.acceptMission(args);
  if(action==='mission:previewDeliverable')return hub.previewMissionDeliverable(args);
  if(action==='mission:checks')return hub.missionCheckCapabilities(args);
  if(action==='mission:evidence')return hub.collectMissionEvidence(args);
  if(action==='mission:reconcileCheck')return hub.reconcileMissionCheck(args);
  throw Error('Unexpected fixture command '+action);
 });
 const js=async code=>{try{return await win.webContents.executeJavaScript(code);}catch(error){throw Error(code+'\n'+error.message);}};
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 const wait=async code=>{for(let i=0;i<100;i++){if(await js(code))return;await delay(50);}throw Error('UI timeout: '+code);};
 const fill=async(selector,value)=>js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 try{
  await win.loadFile(path.join(__dirname,'../dist/index.html'));
  await js('window.addEventListener("error",event=>console.error(event.error?.stack||event.message))');
  await js('(()=>{const report=console.error;console.error=(...args)=>report(...args.map(arg=>arg instanceof Error?arg.stack:arg));})()');
  console.log('SCROLL_RETURNS_PROMISE',await js('Boolean(document.body.scrollIntoView({behavior:"instant"})?.then)'));
  await wait('Boolean(document.querySelector(".home-page,.island-page"))');
  await js('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="The Island").click()');
  await wait('Boolean(document.querySelector(".island-project-doors button"))');
  await js('document.querySelector(".island-project-doors button").click()');await wait('Boolean(document.querySelector(".project-room-scene"))');
  await wait('document.querySelector(".room-illustration")?.naturalWidth===1536');
  await js('document.querySelector(".project-room-scene").scrollIntoView({block:"center"})');await delay(200);fs.writeFileSync(path.join(output,'illustrated-room.png'),(await win.webContents.capturePage()).toPNG());
  win.setSize(600,900);await delay(200);await js('document.querySelector(".project-room-scene").scrollIntoView({block:"center"})');await delay(200);
  assert.equal(await js('(()=>{const r=document.querySelector(".project-room-scene");return Math.abs((r.clientWidth/r.clientHeight)-1.5)<.03;})()'),true);
  fs.writeFileSync(path.join(output,'illustrated-room-narrow.png'),(await win.webContents.capturePage()).toPNG());win.setSize(1280,900);await delay(200);
  // These injected statuses are labelled UI fixtures, not real provider failures.
  const attentionFixture={id:'attention-fixture',projectId:'fixture',crewId:'franky',title:'Fixture connection recovery',status:'unknown',messages:[],createdAt:Date.now(),updatedAt:Date.now()};hub.state.tasks.push(attentionFixture);hub.changed();
  for(const [status,label] of [['unknown','Check connection'],['failed','Failed']]){
   attentionFixture.status=status;hub.changed();await wait(`document.querySelector('[data-room-crew="franky"]').textContent.includes(${JSON.stringify(label)})`);
   assert.equal(await js('document.querySelector("[data-room-crew=franky]").dataset.motion'),'still');assert.equal(await js('document.querySelector("[data-room-crew=franky]").disabled'),false);
   assert.equal(await js('getComputedStyle(document.querySelector("[data-room-crew=franky] .room-actor-sprite")).animationName'),'none');
   await js('document.querySelector(".project-room-scene").scrollIntoView({block:"center"})');await delay(200);fs.writeFileSync(path.join(output,`crew-${status}.png`),(await win.webContents.capturePage()).toPNG());
  }
  attentionFixture.status='unknown';hub.reserveWriter(attentionFixture);hub.changed();await js('document.querySelector("[data-room-crew=franky]").click()');await wait('Boolean(document.querySelector(".missing-thread-recovery"))');
  assert.equal(await js('document.querySelector(".missing-thread-recovery button").disabled'),true);assert.equal(hub.gate.blocked(projectRoot),true);
  await delay(200);fs.writeFileSync(path.join(output,'missing-thread-recovery.png'),(await win.webContents.capturePage()).toPNG());
  await js('document.querySelector(".missing-thread-recovery input").click()');await wait('!document.querySelector(".missing-thread-recovery button").disabled');await js('document.querySelector(".missing-thread-recovery button").click()');await wait('!document.querySelector(".missing-thread-recovery")');assert.equal(attentionFixture.status,'interrupted');assert.equal(hub.gate.blocked(projectRoot),false);
  await js('document.querySelector(".workbench-head .round-button").click()');await wait('Boolean(document.querySelector(".project-room-scene"))');
  hub.state.tasks=hub.state.tasks.filter(t=>t.id!==attentionFixture.id);hub.changed();await wait('document.querySelector("[data-room-crew=franky]").textContent.includes("Idle")');
  assert.deepEqual(await js('Array.from(document.querySelectorAll("[data-station-crew]")).map(e=>e.dataset.stationCrew)'),await js('Array.from(document.querySelectorAll("[data-room-crew]")).map(e=>e.dataset.roomCrew)'));
  await js('(()=>{const room=document.querySelector(".project-room-scene");room.focus();for(let i=0;i<8;i++)room.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowUp",bubbles:true}));})()');
  await wait('document.querySelector(".room-position").textContent.includes("Press Enter")');
  await js('document.querySelector(".project-room-scene").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}))');
  await wait('Boolean(document.querySelector(".mission-board"))');
  assert.equal(await js('document.querySelector(".mission-board").getBoundingClientRect().top<window.innerHeight'),true,"Opening the board must reveal it without manual scrolling");
  assert.equal(await js('document.querySelector(".mission-brief select").options.length'),1);
  await delay(300);fs.writeFileSync(path.join(output,'project-room.png'),(await win.webContents.capturePage()).toPNG());
  await fill('[aria-label="Mission title"]','Fixture inventory');await fill('[aria-label="Mission objective"]','Track the captain inventory');await fill('[aria-label="Acceptance criteria"]','Items survive reload');
  await js('(()=>{const e=document.querySelectorAll(".mission-brief select")[1];e.value="merge";e.dispatchEvent(new Event("change",{bubbles:true}));})()');
  await js('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Missions").click()');await wait('Boolean(document.querySelector(".mission-board"))');
  assert.equal(await js('document.querySelector(".mission-brief input").value'),'Fixture inventory','mission title survives room-to-board navigation');
  hub.state.projects.push({id:'draft-other',name:'Other draft fixture',path:projectRoot,category:'development'});hub.changed();await wait('document.querySelector(".mission-brief select").options.length===2');
  await js('(()=>{const e=document.querySelector(".mission-brief select");e.value="draft-other";e.dispatchEvent(new Event("change",{bubbles:true}));})()');await delay(50);
  assert.equal(await js('document.querySelector(".mission-brief input").value'),'');await fill('[aria-label="Mission title"]','Other project draft');
  await js('(()=>{const e=document.querySelector(".mission-brief select");e.value="fixture";e.dispatchEvent(new Event("change",{bubbles:true}));})()');await delay(50);
  assert.equal(await js('document.querySelector(".mission-brief input").value'),'Fixture inventory');
  await win.reload();await wait('Boolean(document.querySelector(".home-page"))');await js('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Missions").click()');await wait('Boolean(document.querySelector(".mission-board"))');
  assert.equal(await js('document.querySelectorAll(".mission-brief textarea")[0].value'),'Track the captain inventory');assert.equal(await js('document.querySelectorAll(".mission-brief textarea")[1].value'),'Items survive reload');assert.equal(await js('document.querySelectorAll(".mission-brief select")[1].value'),'merge');
  hub.state.projects=hub.state.projects.filter(p=>p.id!=='draft-other');hub.changed();
  await js('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="The Island").click()');await wait('Boolean(document.querySelector(".island-project-doors button"))');await js('document.querySelector(".island-project-doors button").click()');await wait('Boolean(document.querySelector(".project-room-scene"))');await js('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Open mission board").click()');await wait('Boolean(document.querySelector(".mission-board"))');
  if(!mergeBound)await js('(()=>{const e=document.querySelectorAll(".mission-brief select")[1];e.value="review";e.dispatchEvent(new Event("change",{bubbles:true}));})()');
  await js('document.querySelector(".mission-create").click()');await wait('document.querySelector(".mission-error")?.textContent.includes("Fixture brief save unavailable")');assert.equal(await js('document.querySelector(".mission-brief input").value'),'Fixture inventory');assert.equal(hub.state.missions.length,0);
  await js('document.querySelector(".mission-create").click()');await wait('document.querySelector(".mission-board").textContent.includes("Fixture inventory")');
  assert.equal(await js('document.querySelector(".mission-brief input").value'),'');assert.equal(await js('document.querySelectorAll(".mission-brief textarea")[0].value'),'');assert.equal(await js('document.querySelectorAll(".mission-brief textarea")[1].value'),'');assert.equal(await js('sessionStorage.getItem("sunny:draft:v1:mission:brief:draft-other:title")'),'Other project draft');
  await fill('[aria-label="Mission title"]','Keep this unfinished brief');await js('document.querySelector(".room-health-mission").click()');await delay(100);assert.equal(await js(`document.querySelector('[aria-label="Mission title"]').value`),'Keep this unfinished brief');
  await js('document.querySelector(".mission-prepare-branch").click()');await wait('document.querySelector(".mission-detail").textContent.includes("ready")');assert.match(hub.state.missions[0].branch.name,/^codex\/sunny-/);
  await js(`(()=>{const e=document.querySelector(".mission-launch-controls select");e.value=${JSON.stringify(coordinated?'coordinator':'builder')};e.dispatchEvent(new Event("change",{bubbles:true}));})()`);await delay(50);
  await wait('!document.querySelector(".mission-launch").disabled');await js('document.querySelector(".mission-launch").click()');await wait('document.querySelector(".mission-board").textContent.includes("Running")');
  assert.equal(hub.state.missions[0].status,'RUNNING');
  const rootTask=hub.state.tasks[0];
  const completeTask=task=>{hub.notification({method:'item/completed',params:{threadId:task.threadId,item:{id:'result-'+task.id,type:'agentMessage',text:'Labelled fixture stage result'}}});hub.notification({method:'turn/completed',params:{threadId:task.threadId,turn:{id:task.turnId,status:'completed'}}});};
  const motionCheck=process.env.SUNNY_SMOKE_ROOM_MOTION==='1';if(motionCheck){hub.state.settings.reducedMotion=false;hub.changed();}
  if(coordinated){hub.client.respond=()=>{};for(const [index,crewId] of ['nami','franky','usopp','zoro'].entries()){
   const pending=hub.request({id:100+index,method:'item/tool/call',params:{threadId:rootTask.threadId,turnId:rootTask.turnId,callId:'stage-'+index,tool:'sunny_delegate',arguments:{crewId,title:'Fixture '+crewId,objective:'Provide the bounded fixture stage result'}}});
   await delay(50);const child=hub.state.tasks.find(t=>t.parentTaskId===rootTask.id&&t.status==='working');assert.ok(child);await wait(`document.querySelector('[data-crew="${crewId}"]').dataset.state===${JSON.stringify(crewId==='nami'?'Planning':crewId==='usopp'?'Validating':crewId==='zoro'?'Reviewing':'Working')}`);
   if(motionCheck&&crewId==='nami'){
    await wait('document.querySelector("[data-room-crew=nami]").dataset.motion==="walking"');
    child.status='waiting';hub.changed();await wait('document.querySelector("[data-room-crew=nami]").dataset.motion==="still"');
    const stopped=await js('document.querySelector("[data-room-crew=nami]").dataset.position');await delay(200);assert.equal(await js('document.querySelector("[data-room-crew=nami]").dataset.position'),stopped);
    assert.equal(await js('getComputedStyle(document.querySelector("[data-room-crew=nami] .room-actor-sprite")).animationName'),'none');
    await js('document.querySelector(".project-room-scene").scrollIntoView({block:"center"})');await delay(300);fs.writeFileSync(path.join(output,'crew-waiting.png'),(await win.webContents.capturePage()).toPNG());
    child.status='working';hub.changed();await wait('document.querySelector("[data-room-crew=nami]").dataset.motion==="working"');
    await delay(300);fs.writeFileSync(path.join(output,'crew-working.png'),(await win.webContents.capturePage()).toPNG());
    hub.state.settings.reducedMotion=true;hub.changed();await wait('getComputedStyle(document.querySelector("[data-room-crew=nami] .room-actor-sprite")).animationName==="none"');
    assert.equal(await js('document.querySelector("[data-room-crew=nami]").dataset.position'),'52.00');
   }
   completeTask(child);assert.equal((await pending).success,true);
  }}
  completeTask(rootTask);
  await wait('Boolean(document.querySelector(".mission-accept"))');if(coordinated){assert.equal(await js('document.querySelectorAll(".mission-attempt ol li").length'),4);}
  const originalCheck=hub.evidence.runCheck.bind(hub.evidence);hub.evidence.runCheck=async()=>{throw Object.assign(Error('Fixture uncertain cleanup'),{uncertain:true});};
  await wait('!document.querySelector(".mission-run-test")?.disabled');
  assert.equal(await js('document.querySelector(".mission-run-lint").disabled'),true);
  assert.equal(await js('document.querySelector(".mission-run-typecheck").disabled'),true);
  assert.match(await js('document.querySelector(".mission-check-capabilities").textContent'),/lint.*typecheck|typecheck.*lint/);
  await js('document.querySelector(".mission-run-test").click()');await wait('Boolean(document.querySelector(".mission-check-recovery"))');await wait('document.querySelector(".mission-error")?.textContent.includes("Fixture uncertain cleanup")');
  assert.equal(hub.gate.blocked(projectRoot),true);assert.equal(await js('document.querySelector(".mission-check-recovery button").disabled'),true);
  await js('document.querySelector(".mission-check-recovery").scrollIntoView({block:"center"})');await delay(150);fs.writeFileSync(path.join(output,'check-recovery.png'),(await win.webContents.capturePage()).toPNG());
  await js('document.querySelector(".mission-check-recovery input").click()');await wait('!document.querySelector(".mission-check-recovery button").disabled');await js('document.querySelector(".mission-check-recovery button").click()');await wait('!document.querySelector(".mission-check-recovery")');assert.equal(hub.gate.blocked(projectRoot),false);hub.evidence.runCheck=originalCheck;
  await wait('!document.querySelector(".mission-run-test")?.disabled');await js('document.querySelector(".mission-run-test").click()');
  await wait('document.querySelector(".mission-evidence")?.textContent.includes("passed")');
  assert.equal(hub.state.missions[0].artifacts.findLast(a=>a.kind==='check').status,'passed');await wait('document.querySelector(".room-health").textContent.includes("passed")');
  await wait(`document.querySelector(".mission-detail").dataset.revision===${JSON.stringify(String(hub.state.missions[0].revision))}`);
  await wait('!document.querySelector(".mission-prepare-pr").disabled');assert.equal(await js('document.querySelectorAll(".mission-prepare-pr").length'),1);await js('document.querySelector(".mission-prepare-pr").click()');await wait('Boolean(document.querySelector(".mission-publish-pr"))');
  assert.equal(publicationCalls.length,0);assert.equal(await js('document.querySelector(".mission-publish-pr").disabled'),true);
  const originalPreview=structuredClone(hub.state.missions[0].prPublication);
  await js('document.querySelector(".mission-publication input[type=checkbox]").click()');await wait('!document.querySelector(".mission-publish-pr").disabled');
  const editedTitle='Captain literal $(command) `title`',editedBody=originalPreview.body+'\n\nCaptain literal review: $(command), `ticks`, \\n, and ${value}.\n';
  await fill('[aria-label="PR title"]',editedTitle);await fill('[aria-label="PR description"]',editedBody);
  assert.equal(await js('document.querySelector(".mission-publish-pr").disabled'),true);assert.equal(await js('document.querySelector(".mission-publication input[type=checkbox]").checked'),false);assert.equal(publicationCalls.length,0);
  await js('document.querySelector(".mission-save-pr-preview").click()');await wait('!document.querySelector(".mission-save-pr-preview")');
  const editedPreview=hub.state.missions[0].prPublication;assert.notEqual(editedPreview.id,originalPreview.id);assert.equal(editedPreview.title,editedTitle);assert.equal(editedPreview.body,editedBody);
  for(const key of ['repository','branch','base','commit','fingerprint','attemptId'])assert.equal(editedPreview[key],originalPreview[key]);assert.equal(publicationCalls.length,0);assert.equal(await js('document.querySelector(".mission-publish-pr").disabled'),true);
  await js('document.querySelector(".mission-publication").scrollIntoView({block:"center"})');await delay(200);fs.writeFileSync(path.join(output,'editable-pr-preview.png'),(await win.webContents.capturePage()).toPNG());
  await js('document.querySelector(".mission-publication input[type=checkbox]").click()');await wait('!document.querySelector(".mission-publish-pr").disabled');await js('document.querySelector(".mission-publish-pr").click()');await wait('document.querySelector(".mission-publication").textContent.includes("· published")');
  assert.equal(publicationCalls.length,2);assert.equal(hub.state.missions[0].prPublication.state,'published');assert.equal(publicationCalls[1].body,editedBody);assert.equal(publicationCalls[1].args[publicationCalls[1].args.indexOf('--title')+1],editedTitle);
  await fill('[aria-label="Pull-request number"]','1');await js('document.querySelector(".mission-inspect-pr").click()');await wait('document.querySelector(".mission-evidence")?.textContent.includes("PR #1")');assert.equal(hub.state.missions[0].artifacts.findLast(a=>a.kind==='pull-request').checkStatus,mergeBound?'passed':'unavailable');
  if(mergeViaUi){
   await wait(`document.querySelector(".mission-detail").dataset.revision===${JSON.stringify(String(hub.state.missions[0].revision))}`);
   await wait('!document.querySelector(".mission-prepare-merge").disabled');await js('document.querySelector(".mission-prepare-merge").click()');await wait('Boolean(document.querySelector(".mission-open-merge"))');
   assert.equal(await js('Boolean(document.querySelector(".mission-submit-merge"))'),false);
   await js('document.querySelector(".mission-merge-control").scrollIntoView({block:"center"})');await delay(300);fs.writeFileSync(path.join(output,'merge-approval.png'),(await win.webContents.capturePage()).toPNG());
   await js('document.querySelector(".mission-open-merge").click()');assert.deepEqual(openedUrls,[{url:'https://github.com/fixture/sunny/pull/1'}]);assert.equal(fixtureMerged,false);
   // Simulate the captain approving on GitHub; opening the URL itself does not merge.
   await wait('!document.querySelector(".mission-recheck-merge").disabled');
   fixtureMerged=true;
   await js('document.querySelector(".mission-recheck-merge").click()');await wait('document.querySelector(".mission-merge-control").textContent.includes("Merge verified")');assert.equal(publicationCalls.length,2);assert.equal(hub.state.missions[0].mergeRequest.state,'merged');

  }
  await wait('!document.querySelector(".mission-inspect-deployments").disabled');await js('document.querySelector(".mission-inspect-deployments").click()');
  await wait('document.querySelector(".mission-deployments").textContent.includes("fixture-preview · success")');await wait('document.querySelector(".room-health").textContent.includes("fixture-preview · success")');assert.equal(deploymentCalls.length,2);assert.equal(hub.state.missions[0].status,'WAITING_FOR_REVIEW');
  await js('document.querySelector(".mission-deployments").scrollIntoView({block:"center"})');await delay(300);fs.writeFileSync(path.join(output,'deployment-observation.png'),(await win.webContents.capturePage()).toPNG());
  await fill('[aria-label="Image path"]','concept.png');await fill('[aria-label="Image source"]',process.env.SUNNY_SMOKE_IMAGE?'External original image_gen concept imported for review verification; no Sunny generator connection':'Synthetic native PNG fixture; no creative provider');await fill('[aria-label="Image usage"]','Test preview only; not product artwork');await js('document.querySelector(".mission-attach-image").click()');
  await wait('Boolean(document.querySelector(".mission-preview-image"))');await wait('!document.querySelector(".mission-preview-image").disabled');await js('document.querySelector(".mission-preview-image").click()');await wait(`document.querySelector(".mission-image-preview img")?.naturalWidth===${imageWidth}`);assert.equal(hub.state.missions[0].artifacts.find(a=>a.kind==='image').dataUrl,undefined);
  await js('document.querySelector(".mission-image-preview").scrollIntoView({block:"center"})');await delay(300);fs.writeFileSync(path.join(output,'visual-deliverable.png'),(await win.webContents.capturePage()).toPNG());
  await fill('[aria-label="Deliverable path"]','welcome.md');await js('document.querySelector(".mission-attach-deliverable").click()');
  await wait('Boolean(document.querySelector(".mission-preview-deliverable"))');
  await wait('document.querySelector(".room-health").textContent.includes("welcome.md")');
  await wait('!document.querySelector(".mission-preview-deliverable").disabled');await js('document.querySelector(".mission-preview-deliverable").click()');
  await wait('document.querySelector(".mission-deliverable-preview pre")?.textContent.includes("Welcome aboard")');
  assert.equal(await js('Boolean(window.sunnyDeliverableExecuted)'),false);assert.equal(await js('document.querySelectorAll(".mission-deliverable-preview script").length'),0);
  await js('document.querySelector(".mission-deliverables").scrollIntoView({block:"center"})');await delay(300);fs.writeFileSync(path.join(output,'written-deliverable.png'),(await win.webContents.capturePage()).toPNG());
  assert.equal(await js('document.querySelector(".mission-accept").disabled'),true);
  await js('document.querySelector(".mission-criteria input").click()');
  await js('document.querySelector(".mission-accept").click()');await wait('document.querySelector(".mission-board").textContent.includes("Complete")');
  assert.equal(JSON.parse(fs.readFileSync(store.file,'utf8')).missionBook.missions[0].status,'COMPLETE');
  await wait('document.querySelector(".room-crew-roster").textContent.includes("Mission complete")');
  await js('document.querySelector(".room-crew-roster").scrollIntoView({block:"start"})');await delay(300);fs.writeFileSync(path.join(output,'crew-stations.png'),(await win.webContents.capturePage()).toPNG());
  const acceptanceBefore=JSON.stringify(hub.state.missions[0].acceptance);await wait('!document.querySelector(".mission-inspect-deployments").disabled');await js('document.querySelector(".mission-inspect-deployments").click()');await wait('!document.querySelector(".mission-inspect-deployments").disabled');assert.equal(deploymentCalls.length,4);assert.equal(hub.state.missions[0].status,'COMPLETE');assert.equal(JSON.stringify(hub.state.missions[0].acceptance),acceptanceBefore);
  const signalId=hub.state.missions[0].events.at(-1).id;
  await wait(`Boolean(document.querySelector('[data-signal-id="${signalId}"]'))`);
  await js(`Array.from(document.querySelector('[data-signal-id="${signalId}"]').querySelectorAll('button')).find(b=>b.textContent==='Mark seen').click()`);
  await wait(`document.querySelector('[data-signal-id="${signalId}"]')?.dataset.seen==='true'`);
  assert.equal(hub.state.missions[0].status,'COMPLETE');assert.ok(hub.state.missions[0].seenEventIds.includes(signalId));
  assert.ok(JSON.parse(fs.readFileSync(store.file,'utf8')).missionBook.missions[0].seenEventIds.includes(signalId));
  await js('Array.from(document.querySelectorAll(".room-event-log button")).find(b=>b.textContent==="Show unseen signals").click()');
  await wait(`!document.querySelector('[data-signal-id="${signalId}"]')`);
  await js('Array.from(document.querySelectorAll(".room-event-log button")).find(b=>b.textContent==="Show recent signals").click()');
  await wait(`document.querySelector('[data-signal-id="${signalId}"]')?.dataset.seen==='true'`);
  await js(`document.querySelector('[data-signal-id="${signalId}"] button').click()`);
  await wait('document.querySelector(".mission-board")?.textContent.includes("Fixture inventory")');
  await js('document.querySelector(".room-event-log").scrollIntoView({block:"center"})');await delay(300);fs.writeFileSync(path.join(output,'transponder-signals.png'),(await win.webContents.capturePage()).toPNG());
  await js('document.querySelector(".room-health").scrollIntoView({block:"center"})');await delay(300);fs.writeFileSync(path.join(output,'project-health.png'),(await win.webContents.capturePage()).toPNG());
  await win.reload();await wait('Boolean(document.querySelector(".home-page,.island-page"))');await js('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Missions").click()');await wait('document.querySelector(".mission-board")?.textContent.includes("Complete")');
  assert.equal(await js('document.querySelector(".mission-brief input").value'),'Keep this unfinished brief');
  await delay(300);fs.writeFileSync(path.join(output,'mission-board.png'),(await win.webContents.capturePage()).toPNG());
  assert.deepEqual(appErrors,[],'No app errors may be hidden by later successful persistence');
  console.log('SUNNY_MISSION '+JSON.stringify({passed:true,output,runtime,imageInput:process.env.SUNNY_SMOKE_IMAGE?'external-image':'synthetic-fixture',motionCheck,coordinated,mergeBound,mergeViaUi,checks:['missing-thread-confirmation','uncertain-check-confirmation','unknown-failed-attention-projection','illustrated-room-full-and-narrow','enter-project-room','keyboard-movement','open-room-board','create','prepare-real-branch','launch-through-hub','await-review','real-npm-check','fixture-pr-evidence','fixture-deployment-observation','post-acceptance-deployment-refresh','criteria-gate','written-deliverable-preview','native-image-deliverable-preview','explicit-acceptance','signal-acknowledgment','unseen-filter','signal-mission-navigation','persist','reload','project-scoped-brief-drafts','draft-navigation-and-reload','submitted-brief-clearing','editable-exact-pr-preview','unsaved-preview-publication-block','edited-preview-fresh-confirmation']}));
 }catch(error){failure=error;console.error(error);fs.writeFileSync(path.join(output,'failure.png'),(await win.webContents.capturePage()).toPNG());}
 finally{hub.close();win.destroy();app.exit(failure?1:0);}
}).catch(error=>{console.error(error);app.exit(1);});
