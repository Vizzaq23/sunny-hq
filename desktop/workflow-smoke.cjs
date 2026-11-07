// Runs the production UI against explicitly synthetic IPC transport; never starts Codex or uses real user data.
const {app,BrowserWindow,ipcMain}=require('electron');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {emptyWorkspace}=require('./mission-profile.cjs');
const {applyWorkspaceUpdate}=require('./workspace-state.cjs');
const root=path.resolve(__dirname,'..'),output=path.resolve(process.env.SUNNY_WORKFLOW_CHECK_OUTPUT||path.join(root,'.sunny-dev','workflow-check',new Date().toISOString().replaceAll(':','-')));
fs.mkdirSync(output,{recursive:true});app.setPath('userData',path.join(output,'profile-'+Date.now()));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const now=Date.now();
const task=(id,title,status,crewId='luffy',extra={})=>({id,title,status,crewId,projectId:'studio',createdAt:now-300000,updatedAt:now-30000,messages:[],threadId:'thread-'+id,turnId:'turn-'+id,...extra});
const skillOption={id:'ecc-frontend-a11y',name:'ecc-frontend-a11y',category:'Engineering',purpose:'Check interactive UI access.',roles:['builder','designer','reviewer'],revision:'a'.repeat(64)};
const state={runs:[],workspace:emptyWorkspace(),persistence:{state:'saved',failures:0},missions:[],missionRoles:[],projects:[{id:'studio',name:'Sunny Studio',path:output,category:'development'},{id:'launch',name:'Launch planning',path:output,category:'creative'}],tasks:[
 task('captain','Polish the customer dashboard','working','luffy',{captain:true}),
 task('design','Refresh the dashboard layout','waiting','sanji',{parentTaskId:'captain'}),
 task('research','Compare three launch ideas','working','robin',{projectId:'launch'}),
 task('unknown','Recover the settings update','unknown','chopper',{error:'The connection was interrupted.'}),
 task('done','Write the onboarding guide','finished','robin',{messages:[{id:'reply',role:'assistant',text:'The onboarding guide is ready. It covers setup, first tasks, and reviewing the crew’s results.',time:now-60000}]})
],settings:{reducedMotion:true,notifications:false},codex:{status:'connected'},approvals:[{id:'permission',taskId:'design',method:'item/commandExecution/requestApproval',params:{command:'npm test',reason:'Verify the updated dashboard.'}}],models:[],tools:[],automations:[],usage:null,world:{paused:true,residents:[],jobs:[],ledger:[]}};
const watchdog=setTimeout(()=>{const health={mainPid:process.pid,mainAlive:true,windowDestroyed:win?.isDestroyed()??true,rendererPid:win&&!win.isDestroyed()?win.webContents.getOSProcessId():null};fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:false,syntheticTransport:true,liveProviderProof:false,error:'Fixture watchdog exceeded 150 seconds',health}));console.error('SUNNY_WORKFLOW_WATCHDOG '+JSON.stringify(health));app.exit(1);},150000);
app.on('will-quit',()=>clearTimeout(watchdog));
 let win,failStart=true,starts=0,answers=0,failSnapshot=false,raceSnapshot=true,startDelay=150,stops=0,failCheck=true,taskRace=false;
const projection=require('./state-projection.cjs').createStateProjection();
const emit=()=>win.webContents.send('sunny:event',projection.event('snapshot',state));
const localFixture=require('./local-crew-smoke.cjs').fixture(state,emit);
const toolLaunches=[];
ipcMain.handle('sunny:invoke',async(_event,action,args)=>{
 if(action==='tools:open'){toolLaunches.push({...args});return;}
 if(action.startsWith('localCrew:')||action.startsWith('localCouncil:'))return localFixture.invoke(action,args);
 if(action==='transcript:page')return projection.page(state,args);
 if(action==='workspace:get')return structuredClone(state.workspace);
 if(action==='workspace:update'){state.workspace=applyWorkspaceUpdate(state.workspace,structuredClone(args),structuredClone(state));emit();return structuredClone(state.workspace);}
 if(action==='skills:suggest')return args.brief.includes('dashboard')?{available:[skillOption],suggested:[skillOption]}:{available:[],suggested:[]};
 if(action==='snapshot'){
  if(failSnapshot)throw Error('Fixture: connection unavailable');
  if(raceSnapshot){raceSnapshot=false;const stale=projection.snapshot({...structuredClone(state),tasks:[]});setTimeout(emit,20);await delay(180);return stale;}
  if(taskRace){taskRace=false;const stale=projection.snapshot(state);setTimeout(()=>{state.tasks[0].title='Latest streamed task';win.webContents.send('sunny:event',projection.event('task',state.tasks[0]));},20);await delay(180);return stale;}
  return projection.snapshot(state);
 }
 if(action==='task:start'){starts++;await delay(startDelay);if(failStart)throw Error('Fixture: unable to connect');const next=task('new-'+starts,args.prompt,'working',args.crewId,{projectId:args.projectId,captain:args.crewId==='luffy',selectedSkills:args.selectedSkills?.map(choice=>({...skillOption,...choice})),messages:[{id:'user',role:'user',text:args.prompt,time:Date.now()}]});state.tasks.unshift(next);emit();return next;}
 if(action==='task:send'){const target=state.tasks.find(task=>task.id===args.taskId);target.status='working';target.messages.push({id:'followup',role:'user',text:args.prompt,time:Date.now()});const delta=projection.transcriptChanged(target);win.webContents.send('sunny:event',{type:'transcript:delta',epoch:delta.epoch,sequence:delta.sequence,data:delta});emit();return;}
 if(action==='approval:respond'){answers++;await delay(150);state.approvals=[];state.tasks.find(task=>task.id==='design').status='working';emit();return;}
 if(action==='task:checkStatus'){if(failCheck)throw Error('Fixture: status check offline');const target=state.tasks.find(task=>task.id===args.taskId);target.status='working';target.error=undefined;emit();return target;}
 if(action==='task:interrupt'){stops++;state.tasks.find(task=>task.id===args.taskId).status='interrupted';state.tasks.find(task=>task.id===args.taskId).error=undefined;emit();return;}
 if(action==='files:list')return args.path===path.join(output,'nested')?[{name:'notes.txt',path:path.join(output,'nested','notes.txt'),directory:false}]:[{name:'nested',path:path.join(output,'nested'),directory:true},{name:'hello.txt',path:path.join(output,'hello.txt'),directory:false}];
 if(action==='files:read')return {path:args.path,text:'Hello Sunny\n',hash:'fixture'};
 if(action==='library:search')return [{path:'00 Projects/Launch Notes.md',title:'Launch Notes',excerpt:'A useful saved project note.'},{path:'00 Projects/Long Notes.md',title:'Long Notes',excerpt:'A large reference note.'}];
 if(action==='library:read')return {path:args.path,text:args.path.includes('Long Notes')?'x'.repeat(16001):'Keep the launch focused on a small, verifiable first release.',hash:'fixture-note'};
 if(action==='settings:update'){if(Object.hasOwn(args,'roomSoundEnabled'))state.settings.roomSoundEnabled=args.roomSoundEnabled;if(Object.hasOwn(args,'roomSoundVolume'))state.settings.roomSoundVolume=args.roomSoundVolume;emit();return state.settings;}
 if(action==='task:history')return [];
 if(action==='app:diagnostic'||action==='asset:crewTexture')return null;
 throw Error('Unexpected smoke IPC: '+action);
});
app.whenReady().then(async()=>{
 win=new BrowserWindow({width:1440,height:1050,show:false,webPreferences:{offscreen:process.env.SUNNY_SMOKE_HIDDEN==='1'||(process.argv.includes('--local-crew-only')||process.argv.includes('--local-council-only')),preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 assert.equal(win.isVisible(),false); // Always hidden; retain optional offscreen rendering.
 const js=async code=>{let timer;try{return await Promise.race([win.webContents.executeJavaScript(code),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Runtime.evaluate timed out after 10 seconds')),10000);})]);}catch(error){throw Error(code+'\n'+error.message);}finally{clearTimeout(timer);}};
 const wait=async(code)=>{for(let i=0;i<120;i++){if(await js(code))return;await delay(50);}throw Error('UI wait timed out: '+code);};
 const revealConversations=async()=>{await js('(()=>{const details=document.querySelector(".home-conversations");if(details&&!details.open)details.querySelector("summary").click();})()');};
 const prepare=async selector=>{await js(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw Error('Missing fixture target '+${JSON.stringify(selector)});let parent=element.parentElement;while(parent){if(parent.tagName==='DETAILS'&&!parent.open)parent.querySelector(':scope > summary').click();parent=parent.parentElement;}element.scrollIntoView({block:'center',behavior:'instant'});})()`);await delay(40);};
 const click=async selector=>{await prepare(selector);await wait(`!document.querySelector(${JSON.stringify(selector)}).disabled`);await js(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});element.focus();element.click();})()`);await delay(70);await revealConversations();};
 const fill=async(selector,value)=>{await prepare(selector);return js(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}));})()`);};
 const select=async(selector,value)=>{await prepare(selector);return js(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});element.value=${JSON.stringify(value)};element.dispatchEvent(new Event('change',{bubbles:true}));})()`);};
 const nav=async label=>{const visibleLabel=label==='Home'?'Luffy':label;await js(`(()=>{const button=Array.from(document.querySelectorAll('.sidebar .main-nav button,.sidebar-foot>button')).find(button=>button.querySelector('span')?.textContent===${JSON.stringify(visibleLabel)});if(!button)throw Error('Missing navigation target');const more=button.closest('.nav-more');if(more&&more.querySelector('[hidden]'))more.querySelector(':scope > button').click();button.focus();button.click();})()`);await delay(70);if(label==='Home')await revealConversations();};
 const reload=async()=>{const loaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.reload();await loaded;await wait('Boolean(document.querySelector(".helm-workspace,.workbench,.home-page,.loading-deck[role=alert]"))');if(await js('Boolean(document.querySelector(".helm-workspace"))'))await nav('Home');await revealConversations();};
 const conversationStarters=async()=>{await wait('Boolean(document.querySelector(".mission-board"))');await js('(()=>{const details=Array.from(document.querySelectorAll(".journey-surface > details")).find(d=>d.querySelector("summary").textContent.trim()==="Conversation starters");if(!details)throw Error("Missing conversation starters disclosure");if(!details.open)details.querySelector("summary").click();})()');await wait('Boolean(document.querySelector(".mission-card button"))');};
 const newConversation=async(projectId)=>{const name=state.projects.find(p=>p.id===projectId)?.name;await js(`(()=>{const button=Array.from(document.querySelectorAll('.sidebar .project-nav')).find(button=>button.querySelector('b').textContent===${JSON.stringify(name)});button.focus();button.click();})()`);await wait('Boolean(document.querySelector(".workbench .mission-start"))');assert.equal(await js('document.querySelector(".start-fields label:first-child select").value'),projectId,'direct project shortcut opens that exact project');};
 const screenshot=async name=>{
  let lastError;
  for(let attempt=1;attempt<=3;attempt++){
   try{
    await delay(150*attempt);
    // Hidden Chromium can return its previous compositor surface on the first read.
    // Warm that surface, then capture the rendered frame after the DOM settled.
    await win.webContents.capturePage();await delay(250);
    const image=await win.webContents.capturePage();
    fs.writeFileSync(path.join(output,name),image.toPNG());
    return;
   }catch(error){lastError=error;}
  }
  throw lastError;
 };
 try{
  await win.loadFile(path.join(root,process.argv.includes('--shipboard-baseline')?'.sunny-dev/baseline-dist':'dist','index.html'));await wait('Boolean(document.querySelector(".local-captain"))');await nav('The Sunny');await wait('Boolean(document.querySelector(".helm-workspace"))');await screenshot('command-deck.png');
  if(process.argv.includes('--studio-captures')){
   await require('./studio-ui-smoke.cjs').check({js,wait,fill,select,click,nav,screenshot,win,state,emit,toolLaunches});
   fs.writeFileSync(path.join(output,'studio-result.json'),JSON.stringify({passed:true,syntheticTransport:true,liveProviderProof:false,checks:['crew-specialty-search-and-reset','tool-search-and-reset','tool-launch-selected-project','home-draft-preservation','desktop-laptop-phone-layout','supporting-destination-layouts','home-200-percent-zoom','user-and-system-reduced-motion','local-ship-art-loaded']}));
   return;
  }
  if(process.argv.includes('--shipboard-captures')){
   if(!process.argv.includes('--shipboard-baseline')){
    assert.ok(await js('document.fonts.load("16px Barlow").then(fonts=>fonts.length>0&&fonts.every(font=>font.status==="loaded"))'),'bundled Barlow loads');
    assert.ok(await js('document.fonts.load("16px Bangers").then(fonts=>fonts.length>0&&fonts.every(font=>font.status==="loaded"))'),'bundled Bangers loads');
    assert.equal(await js('performance.getEntriesByType("resource").filter(entry=>/^https?:/.test(entry.name)).length'),0,'fixture loads no remote resources');
   }
   const captureSizes=async(name,selector)=>{
    for(const [width,height,label] of [[1280,720,'desktop'],[390,844,'mobile']]){
     win.setSize(width,height);await delay(200);
     await js(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start',behavior:'instant'})`);
     assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),name+' fits '+label);
     if(name==='design-approval')await js('document.querySelector(".approval-actions").scrollIntoView({block:"end",behavior:"instant"})');
     await screenshot(name+'-'+label+'.png');
    }
    win.setSize(1280,720);win.webContents.setZoomFactor(2);await delay(200);
    assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),name+' fits 200 percent');
    await js(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start',behavior:'instant'})`);
    if(name==='design-approval'){
     await js('document.querySelector(".approval-actions").scrollIntoView({block:"end",behavior:"instant"})');
     assert.ok(await js('(()=>{const rect=document.querySelector(".approve").getBoundingClientRect();return rect.top>=0&&rect.bottom<=innerHeight;})()'),'approval action visible at 200 percent');
    }
    await screenshot(name+'-zoom.png');win.webContents.setZoomFactor(1);win.setSize(1440,1050);await delay(200);
   };
   await nav('Home');await js('document.querySelectorAll(".home-page details[open]").forEach(d=>d.open=false)');
   await captureSizes('design-home','.home-heading');
   await click('[data-watch-id="task:design"] .watch-open');await wait('Boolean(document.querySelector(".approval-card"))');
   await captureSizes('design-approval','.approval-card');
   win.webContents.debugger.attach('1.3');
   await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
   await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
   win.webContents.debugger.detach();
   await js('document.querySelector(".approve").focus()');
   assert.equal(await js('document.activeElement.className'),'approve');
   assert.notEqual(await js('getComputedStyle(document.querySelector(".approve")).outlineStyle'),'none');
   assert.equal(answers,0,'capturing and focusing permission never approves');
   await captureSizes('design-room','.workbench-head');
   await fill('.composer textarea','Keep my unsent shipboard draft');
   const longTask=state.tasks.find(task=>task.id==='design');
   longTask.messages.push({id:'shipboard-long-reply',role:'assistant',text:'Fixture long transcript. Review the recorded evidence before accepting this work.\n'.repeat(1000),time:Date.now()});
   const longDelta=projection.transcriptChanged(longTask);
   win.webContents.send('sunny:event',{type:'transcript:delta',epoch:longDelta.epoch,sequence:longDelta.sequence,data:longDelta});emit();
   await wait('document.querySelector(".conversation").textContent.includes("Fixture long transcript")');
   win.setSize(390,844);await delay(200);
   assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'long transcript fits phone');
   assert.equal(await js('document.querySelector(".composer textarea").value'),'Keep my unsent shipboard draft');
   await js('document.querySelector(".conversation").scrollIntoView({block:"start",behavior:"instant"})');
   await screenshot('design-long-transcript-mobile.png');
   fs.writeFileSync(path.join(output,'design-result.json'),JSON.stringify({passed:true,syntheticTransport:true,sizes:[[1280,720],[390,844]],zoom:2,approvalResponses:answers,longTranscriptCharacters:longTask.messages.at(-1).text.length,draftPreserved:true}));
   return;
  }
  assert.equal(await js('document.querySelector(".helm-workspace").dataset.motion'),'reduced');
  assert.equal(await js('getComputedStyle(document.querySelector(".helm-scene"),"::before").animationName'),'none');
  win.webContents.debugger.attach('1.3');
  try{
   // The hosted desktop may already request reduced motion. Explicitly exercise
   // both OS preferences in this fixture window, never change the host setting.
   const motion=async value=>win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value}]});
   await motion('no-preference');
   assert.equal(await js('document.querySelector(".helm-workspace").dataset.motion'),'reduced','application preference wins with OS motion enabled');
   state.settings.reducedMotion=false;emit();await wait('document.querySelector(".helm-workspace").dataset.motion==="full"');
   assert.equal(await js('getComputedStyle(document.querySelector(".helm-scene"),"::before").animationName'),'helm-tide');
   await click('.helm-sea-toggle');assert.equal(await js('getComputedStyle(document.querySelector(".helm-scene"),"::before").animationName'),'none');
   await click('.helm-sea-toggle');
   await motion('reduce');await wait('document.querySelector(".helm-workspace").dataset.motion==="reduced"');assert.equal(await js('getComputedStyle(document.querySelector(".helm-scene"),"::before").animationName'),'none');
   state.settings.reducedMotion=true;emit();await wait('document.querySelector(".helm-workspace").dataset.motion==="reduced"');
   assert.equal(await js('getComputedStyle(document.querySelector(".helm-scene"),"::before").animationName'),'none','both preferences reduce motion');
  }
  finally{await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});win.webContents.debugger.detach();}
  state.settings.reducedMotion=true;emit();await wait('document.querySelector(".helm-workspace").dataset.motion==="reduced"');
  const originalDeckTask={title:state.tasks[0].title,updatedAt:state.tasks[0].updatedAt};state.tasks[0].title='Fixture live deck update';state.tasks[0].updatedAt=Date.now();emit();
  await wait('document.querySelector(".helm-live-update strong")?.textContent==="Fixture live deck update"');await click('[aria-label="Open saved work activity"]');
  await wait('Boolean(document.querySelector(".helm-activity"))');assert.ok(await js('document.querySelector(".helm-activity").textContent.includes("Fixture live deck update")'),'deck update and activity use the same streamed snapshot');
  Object.assign(state.tasks[0],originalDeckTask);emit();await nav('Home');await wait('Boolean(document.querySelector(".home-page"))');await revealConversations();await delay(250);
  if(process.argv.includes('--crew-usability-only')){await require('./crew-usability-smoke.cjs').check({js,wait,fill,select,click,nav,screenshot,win,localFixture});fs.writeFileSync(path.join(output,'crew-usability-result.json'),JSON.stringify({passed:true,syntheticModel:true}));console.log('SUNNY_CREW_USABILITY passed (synthetic model)');return;}
  if(process.argv.includes('--local-council-only')){await require('./local-council-smoke.cjs').check({js,wait,fill,select,click,nav,screenshot,win,localFixture});fs.writeFileSync(path.join(output,'local-council-result.json'),JSON.stringify({passed:true,syntheticModel:true}));console.log('SUNNY_LOCAL_COUNCIL_UI passed (synthetic model)');return;}
  if(process.argv.includes('--local-crew-only')){await require('./local-crew-smoke.cjs').check({js,wait,fill,select,click,nav,screenshot,win,localFixture});fs.writeFileSync(path.join(output,'local-crew-result.json'),JSON.stringify({passed:true,syntheticModel:true}));console.log('SUNNY_LOCAL_CREW passed (synthetic model)');return;}
  assert.equal(await js('document.querySelectorAll(".home-task").length'),4,'newer snapshot wins over stale initial response');
  // Captain's watch follows streamed facts and only navigates to the guarded request.
  await wait('Boolean(document.querySelector(".captain-watch"))');
  assert.equal(await js('document.querySelectorAll(".watch-list li").length'),4);
  assert.equal(await js('document.querySelector("[data-watch-id$=design] .watch-label").textContent'),'Permission requested');
  assert.equal(await js('document.querySelector("[data-watch-id$=design] .watch-copy p").textContent'),'npm test');
  assert.equal(await js('document.querySelector("[data-watch-id$=unknown] .watch-label").textContent'),'Check connection');
  const watchApproval=state.approvals[0];state.approvals=[];emit();
  await wait('document.querySelector("[data-watch-id$=design] .watch-label").textContent==="Waiting — no request received"');
  state.approvals=[watchApproval];state.codex.status='disconnected';emit();
  await wait('Array.from(document.querySelectorAll(".watch-label")).every(x=>x.textContent==="Check connection")');
  assert.equal(answers,0);state.codex.status='connected';emit();
  await wait('document.querySelector("[data-watch-id$=design] .watch-label").textContent==="Permission requested"');
  state.tasks[0].messages.push({id:'watch-event',role:'system',text:'Completed · Command: fixture test',time:Date.now()});projection.transcriptChanged(state.tasks[0]);emit();
  await wait('document.querySelector("[data-watch-id$=captain] .watch-copy p").textContent.includes("fixture test")');
  assert.equal(await js('document.querySelector("[data-watch-id$=captain] .watch-label").textContent'),'Working');
  state.tasks[0].messages=state.tasks[0].messages.filter(m=>m.id!=='watch-event');projection.transcriptChanged(state.tasks[0]);emit();
  await screenshot('captain-watch-desktop.png');win.setSize(390,844);await wait('innerWidth<400');
  await js('document.querySelector(".captain-watch").scrollIntoView({block:"start"})');
  assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'captain watch fits phone');
  await screenshot('captain-watch-mobile.png');win.setSize(1440,1050);await wait('innerWidth>1000');
  await js('document.querySelector("[data-watch-id$=design] .watch-open").focus()');
  assert.equal(await js('document.activeElement.className'),'watch-open');
  await click('[data-watch-id="task:design"] .watch-open');
  await wait('Boolean(document.querySelector(".approval-card"))');
  assert.equal(await js('document.querySelector(".workbench-head h2").textContent'),'Refresh the dashboard layout');
  assert.equal(answers,0,'opening request must never approve');
  await click('[aria-label="Back to workspace"]');await wait('Boolean(document.querySelector(".home-page"))');

  if(process.env.SUNNY_WATCH_PREVIEW==='1'){
   clearTimeout(watchdog);
   await js(`(()=>{document.title='Sunny HQ — Captain’s Watch — isolated fixture preview';const banner=document.createElement('div');banner.textContent='ISOLATED PREVIEW · Synthetic task events · No live provider or daily profile';banner.setAttribute('role','status');Object.assign(banner.style,{position:'fixed',bottom:'0',left:'0',right:'0',zIndex:'99999',padding:'10px',background:'#163d35',color:'#fff',font:'12px system-ui',textAlign:'center'});document.body.append(banner);document.querySelector('.captain-watch').scrollIntoView({block:'start'});})()`);
   win.setTitle('Sunny HQ — Captain’s Watch — isolated fixture preview');win.show();win.focus();
   await screenshot('captain-watch-preview.png');
   fs.writeFileSync(path.join(output,'preview.json'),JSON.stringify({preview:true,visible:win.isVisible(),syntheticTransport:true,liveProviderProof:false,pid:process.pid}));
   await new Promise(resolve=>win.once('closed',resolve));return;
  }
  await delay(250);await screenshot('home-desktop.png');
  assert.equal(await js('document.querySelectorAll("button button").length'),0,'no nested buttons');
  const contractBefore=structuredClone(state.workspace),probe={id:'workflow-contract-probe',kind:'message',projectId:'studio',taskId:'done',text:'Keep exact fixture input',revision:0,updatedAt:Date.now()};
  const probeSaved=await js(`window.sunny.invoke('workspace:update',${JSON.stringify({expectedRevision:contractBefore.revision,draft:probe})})`);assert.equal(probeSaved.drafts.find(d=>d.id===probe.id).revision,1,'fixture uses actual draft revision increment');
  await assert.rejects(js(`window.sunny.invoke('workspace:update',${JSON.stringify({expectedRevision:contractBefore.revision,draft:{...probe,text:'Stale overwrite'}})})`),/revision changed/i);
  assert.equal(state.workspace.drafts.find(d=>d.id===probe.id).text,probe.text,'stale fixture write preserves useful draft');
  await assert.rejects(js(`window.sunny.invoke('workspace:update',${JSON.stringify({expectedRevision:state.workspace.revision,deleteDraft:{id:probe.id,expectedDraftRevision:0}})})`),/draft revision changed/i);
  await js(`window.sunny.invoke('workspace:update',${JSON.stringify({expectedRevision:state.workspace.revision,deleteDraft:{id:probe.id,expectedDraftRevision:1}})})`);assert.equal(state.workspace.drafts.some(d=>d.id===probe.id),false,'only exact fixture revision is deleted');assert.equal(starts,0,'presentation contract probe dispatches no task');
  await fill('[aria-label="Search tasks"]','dashboard layout');await wait('document.querySelectorAll(".home-task").length===1');
  await click('.home-task-open');await wait('Boolean(document.querySelector(".approval-card"))');
  assert.equal(await js('document.querySelector(".workbench-head h2").textContent'),'Refresh the dashboard layout');
  await fill('.composer textarea','Keep this follow-up for Sanji');
  assert.equal(await js('document.querySelector(".composer-foot button").disabled'),true,'waiting task cannot send');
  await js('document.querySelector(".approve").click();document.querySelector(".approve").click()');await wait('!document.querySelector(".approval-card")');assert.equal(answers,1);
  await click('.captain-return');await wait('document.querySelector(".workbench-head h2").textContent==="Polish the customer dashboard"');
  await fill('.composer textarea','Keep a separate captain draft');await click('.crew-assignment');
  await wait('document.querySelector(".composer textarea").value==="Keep this follow-up for Sanji"');
  await click('[aria-label="Back to workspace"]');await wait('Boolean(document.querySelector(".home-page"))');
  assert.equal(await js('document.querySelector(".task-search input").value'),'dashboard layout','task search survives opening a conversation');
  await fill('[aria-label="Search tasks"]','');
  await select('[aria-label="Task project"]','studio');await fill('[aria-label="Task brief"]','Build a clearer task dashboard');await click('input[value="direct"]');assert.equal(await js('document.querySelector(".launch-main>textarea").value'),'Build a clearer task dashboard');await click('input[value="delegate"]');
  await wait('Boolean(document.querySelector(".launch-options .skill-options input"))');assert.equal(await js('document.querySelector(".launch-options .skill-options input").checked'),false,'matching skill is suggested but not enabled');
  await click('.launch-options .skill-options input');assert.equal(await js('document.querySelector(".launch-options .skill-options input").checked'),true,'captain explicitly enables a suggestion');
  await click('.launch-options .skill-options input');assert.equal(await js('document.querySelector(".launch-options .skill-options input").checked'),false,'captain can remove an explicit choice');
  await click('.launch-options .skill-options input');assert.equal(await js('document.querySelector(".launch-options .skill-options input").checked'),true,'captain confirms skill before navigation');
  await nav('Projects');await nav('Home');await wait('Boolean(document.querySelector(".home-page"))');
  assert.equal(await js('document.querySelector(".launch-main>textarea").value'),'Build a clearer task dashboard');
  await click('input[value="direct"]');await select('[aria-label="Task specialist"]','robin');await nav('Projects');await nav('Home');
  assert.equal(await js('document.querySelector("input[value=direct]").checked'),true,'routing survives navigation');
  assert.equal(await js('document.querySelectorAll(".launch-options select")[1].value'),'robin');
  await click('input[value="delegate"]');
  await wait('!document.querySelector(".launch-submit").disabled');
  await js('document.querySelector(".launch-submit").click();document.querySelector(".launch-submit").click()');await wait('Boolean(document.querySelector(".launch-error"))');assert.equal(starts,1);
  assert.equal(await js('document.querySelector(".launch-main>textarea").value'),'Build a clearer task dashboard','failed start retains draft');
  await js('Array.from(document.querySelectorAll(".home-task-title")).find(button=>button.textContent.includes("Compare three launch ideas")).click()');await wait('Boolean(document.querySelector(".workbench"))');
  assert.equal(await js('document.querySelector(".workbench").dataset.crewId'),'robin','workbench identifies its assigned crewmate');
  assert.equal(await js('document.querySelector(".project-chip").textContent.includes("Library")'),true,'character room is named in the chat header');
  assert.equal(await js('getComputedStyle(document.querySelector(".workbench")).getPropertyValue("--room-accent").trim()'),'#80629b','Robin receives her distinct library palette');
  assert.equal(await js('document.querySelector(".room-sound-toggle").getAttribute("aria-pressed")'),'false','room sounds begin opt-in');
  await js(`window.__sunnySfxStarts=0;window.AudioContext=class{constructor(){this.state='suspended';this.currentTime=1;this.destination={};}resume(){this.state='running';return Promise.resolve();}createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}createOscillator(){return{frequency:{setValueAtTime(){}},connect(){},start(){window.__sunnySfxStarts++;},stop(){},set onended(value){}};}};true`);
  await click('.room-sound-toggle');await wait('document.querySelector(".room-sound-toggle").getAttribute("aria-pressed")==="true"');await wait('window.__sunnySfxStarts===3');
  assert.equal(await js('document.querySelector(".room-sound-toggle").getAttribute("aria-label")'),'Mute room sounds','room sound switch exposes its accessible state');
  assert.equal(state.settings.roomSoundEnabled,true,'room sound preference saves through the desktop boundary');
  await click('.room-sound-toggle');await wait('document.querySelector(".room-sound-toggle").getAttribute("aria-pressed")==="false"');
  assert.equal(await js('Boolean(document.querySelector(".robin-library-toggle"))'),true,'Robin can open the connected Obsidian library');
  await click('.robin-library-toggle');await wait('Boolean(document.querySelector(".library-page"))');
  assert.equal(await js('document.querySelector(".library-page h2").textContent'),'Obsidian library','Robin control opens real library search/edit/capture surface');
  await fill('.search-box input','launch');await wait('document.querySelectorAll(".search-results button").length===2');await click('.search-results button');await wait('Boolean(document.querySelector(".library-note-actions"))');
  assert.equal(await js('document.querySelector(".library-note-actions select").value'),'launch','Robin inherits the project of the originating conversation');
  await js('sessionStorage.setItem("sunny:draft:v1:new:launch","Older unrelated draft")');await click('.library-note-actions .secondary-button');await wait('Boolean(document.querySelector(".workbench .mission-start"))');
  assert.equal(await js('document.querySelector(".workbench").dataset.crewId'),'robin','selected Obsidian note opens with Robin');
  assert.ok(await js('document.querySelector(".composer textarea").value.includes("Keep the launch focused on a small, verifiable first release.")'),'selected note content is attached as a reviewable draft');
  assert.ok(await js('document.querySelector(".composer textarea").value.includes("Do not edit or save the Obsidian vault")'),'Robin is asked to propose changes without automatic vault writes');
  assert.equal(await js('document.querySelector(".composer textarea").value.includes("Older unrelated draft")'),false,'Robin note context has an isolated draft key');
  assert.equal(starts,1,'preparing Robin review does not start or send a task');
  await click('[aria-label="Back to workspace"]');await wait('Boolean(document.querySelector(".library-page"))');await fill('.search-box input','launch');await wait('document.querySelectorAll(".search-results button").length===2');await click('.search-results button:nth-child(2)');await wait('Boolean(document.querySelector(".robin-note-limit"))');assert.equal(await js('document.querySelector(".library-note-actions .secondary-button").disabled'),true,'oversized note is not silently truncated into Robin context');await nav('Home');await wait('Boolean(document.querySelector(".home-page"))');await js('Array.from(document.querySelectorAll(".sidebar button")).find(button=>button.textContent.trim()==="Settings").click()');await wait('Boolean(document.querySelector(".settings-page"))');
  assert.equal(await js('document.querySelectorAll(".settings-section .setting-row button.toggle")[1].getAttribute("aria-pressed")'),'false','settings sound control exposes its saved off state');await screenshot('room-sound-settings.png');
  await fill('[aria-label="Room sound volume"]','45');await wait('document.querySelector(".room-sound-volume input").value==="45"');assert.equal(state.settings.roomSoundVolume,.45,'settings slider saves a bounded room volume');
  await js('document.querySelectorAll(".settings-section .setting-row button.toggle")[1].click()');await wait('document.querySelectorAll(".settings-section .setting-row button.toggle")[1].getAttribute("aria-pressed")==="true"');assert.equal(state.settings.roomSoundEnabled,true,'settings switch saves the opt-in preference');
  await js('document.querySelectorAll(".settings-section .setting-row button.toggle")[1].click()');await wait('document.querySelectorAll(".settings-section .setting-row button.toggle")[1].getAttribute("aria-pressed")==="false"');await nav('Home');await wait('Boolean(document.querySelector(".home-page"))');await js('Array.from(document.querySelectorAll(".home-task-title")).find(button=>button.textContent.includes("Compare three launch ideas")).click()');await wait('Boolean(document.querySelector(".workbench"))');
  assert.equal(await js('Boolean(document.querySelector(".work-pane"))'),false,'tools hidden initially');
  const resources=await js('performance.getEntriesByType("resource").map(entry=>entry.name)');assert.ok(!resources.some(name=>/assets\/(CodeEditor|TerminalPane)-.*\.js/.test(name)),'heavy tools not loaded for chat');
  await fill('.composer textarea','Save this for after the first result');await delay(2200);await screenshot('focused-conversation.png');
  await click('.workbench-head button[aria-expanded]');await wait('Boolean(document.querySelector(".file-up"))');
  await js('Array.from(document.querySelectorAll(".file-tree button")).find(button=>button.textContent==="nested").click()');await wait('document.querySelector(".file-tree").textContent.includes("notes.txt")');
  await click('.file-up');await wait('document.querySelector(".file-tree").textContent.includes("hello.txt")');assert.equal(await js('document.querySelector(".file-up").disabled'),true,'parent navigation stops at registered project root');
  await js('Array.from(document.querySelectorAll(".file-tree button")).find(button=>button.textContent==="hello.txt").click()');await wait('Boolean(document.querySelector(".monaco-editor"))');await wait('document.querySelector(".monaco-editor .view-lines")?.textContent.replaceAll(String.fromCharCode(160)," ").includes("Hello Sunny")');await screenshot('files-workspace.png');
  await click('[aria-label="Back to workspace"]');await wait('Boolean(document.querySelector(".home-page"))');await reload();await wait('Boolean(document.querySelector(".home-page"))');
  await js('Array.from(document.querySelectorAll(".home-task-title")).find(button=>button.textContent.includes("Compare three launch ideas")).click()');await wait('Boolean(document.querySelector(".workbench"))');assert.equal(await js('document.querySelector(".composer textarea").value'),'Save this for after the first result','task draft survives UI reload');
  await click('[aria-label="Back to workspace"]');await wait('Boolean(document.querySelector(".home-page"))');
  await fill('[aria-label="Search tasks"]','Recover the settings');await wait('document.querySelectorAll(".home-task").length===1');await click('.home-task-open');await wait('Boolean(document.querySelector(".task-recovery"))');
  assert.equal(await js('document.querySelector(".interrupt-button").textContent.trim()'),'Check status');
  await click('.interrupt-button');await wait('document.querySelector(".task-recovery").textContent.includes("status check offline")');assert.equal(stops,0);
  failCheck=false;await click('.interrupt-button');await wait('!document.querySelector(".task-recovery")');assert.equal(stops,0,'checking running work never stops it');
  assert.equal(await js('document.querySelector(".mission-status strong").textContent'),'Working');
  await click('.interrupt-button');await wait('!document.querySelector(".interrupt-button")');await fill('.composer textarea','Continue after recovery');assert.equal(await js('document.querySelector(".composer-foot button").disabled'),false);
  await screenshot('stopped-task.png');
  await click('[aria-label="Back to workspace"]');await wait('Boolean(document.querySelector(".home-page"))');
  await nav('Inbox');await wait('Boolean(document.querySelector(".work-inbox"))');
  await fill('.work-inbox input[type=search]','onboarding');await wait('document.querySelectorAll(".work-inbox-row").length===1');
  assert.ok(await js('document.querySelector(".work-inbox-group[data-lane=review]").textContent.includes("onboarding")'));
  await fill('.work-inbox input[type=search]','no-such-task');await wait('Boolean(document.querySelector(".work-inbox-empty"))');
  await click('.work-inbox-empty button');await js('document.getElementById("sunny-main").scrollTo(0,0)');await screenshot('searchable-inbox.png');
  const originalTasks=[...state.tasks];state.tasks.push(...Array.from({length:65},(_,i)=>task('nav-'+i,'Navigation check '+i,'idle','robin',{updatedAt:now-i})));emit();await wait('document.querySelectorAll(".work-inbox-row").length===24');await click('.work-inbox-more');await wait('document.querySelectorAll(".work-inbox-row").length===48');await click('.work-inbox-more');await wait('document.querySelectorAll(".work-inbox-row").length===70');
  await select('.work-inbox-tools select','launch');await wait('document.querySelectorAll(".work-inbox-row").length===1');await select('.work-inbox-tools select','');
  win.setSize(390,844);await delay(100);await click('.menu-button');await click('.quick-switch-trigger');await wait('document.querySelector(".quick-switcher").open&&document.querySelector(".quick-switcher").getBoundingClientRect().width>0');await wait('document.activeElement===document.querySelector(".quick-switcher input")');await screenshot('quick-switch-mobile.png');await click('.quick-switcher header button');await wait('document.activeElement===document.querySelector(".menu-button")');assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'));await screenshot('inbox-mobile.png');win.setSize(1440,1050);
  await click('.quick-switch-trigger');await fill('.quick-switcher input','Navigation check');await wait('document.querySelectorAll(".quick-switcher [role=option]").length===60');await js('document.querySelector(".quick-switcher input").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowUp",bubbles:true}))');const stableSelection=await js('document.querySelector(".quick-switcher input").getAttribute("aria-activedescendant")');state.tasks.push(task('nav-new','Navigation check newest','working','luffy',{updatedAt:now+10000}));emit();await wait('document.querySelector(".quick-switcher [role=option]").textContent.includes("newest")');assert.equal(await js('document.querySelector(".quick-switcher input").getAttribute("aria-activedescendant")'),stableSelection,'streamed ordering preserves selected identity');await click('.quick-switcher header button');state.tasks=originalTasks;emit();
  await click('.quick-switch-trigger');await wait('document.querySelector(".quick-switcher").open');
  await fill('.quick-switcher input','onboarding');await wait('document.querySelectorAll(".quick-switcher [role=option]").length===1');
  await js('document.querySelector(".quick-switcher input").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true,isComposing:true}))');
  assert.ok(await js('document.querySelector(".quick-switcher").open'),'IME enter must not navigate');
  await screenshot('quick-switcher.png');
  await js('document.querySelector(".quick-switcher input").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}))');
  await wait('Boolean(document.querySelector(".workbench"))');
  assert.ok(await js('document.querySelector(".workbench").textContent.includes("onboarding")'),'Enter opens the displayed result');
  await nav('Home');
  await fill('[aria-label="Search tasks"]','');
  win.setSize(1000,740);await delay(150);await screenshot('home-compact.png');assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'));
  await nav('The Island');await wait('Boolean(document.querySelector(".island-scene"))');await nav('Home');
  // A late launcher response must not steal navigation or erase a newer draft.
  failStart=false;startDelay=650;await select('[aria-label="Task project"]','studio');await fill('[aria-label="Task brief"]','A launch that finishes after navigation');await wait('!document.querySelector(".launch-submit").disabled');await click('.launch-submit');await nav('Projects');await nav('Home');
  assert.equal(await js('document.querySelector(".launch-submit").disabled'),true,'launch remains pending across navigation');
  await delay(750);assert.ok(await js('Boolean(document.querySelector(".home-page"))'),'late result does not force navigation');
  assert.equal(await js('document.querySelector(".launch-main>textarea").value'),'','late successful launch clears only the submitted brief');
  assert.ok(await js('document.querySelector(".launch-receipt").textContent.includes("A launch that finishes after navigation")'),'late launch has a visible receipt');
  await fill('[aria-label="Task brief"]','Submit only this brief');await wait('!document.querySelector(".launch-submit").disabled');await click('.launch-submit');await nav('Projects');
  await js('sessionStorage.setItem("sunny:draft:v1:home:studio","A newer draft for later")');await nav('Home');await delay(750);
  assert.equal(await js('document.querySelector(".launch-main>textarea").value'),'A newer draft for later','successful launch preserves a newer draft across remount');
  startDelay=150;await nav('Missions');await conversationStarters();await click('.mission-card button');await wait('Boolean(document.querySelector(".mission-start"))');await click('.workbench-head [aria-expanded]');await wait('document.querySelector(".file-tree").textContent.includes("hello.txt")');
  await js('Array.from(document.querySelectorAll(".file-tree button")).find(button=>button.textContent==="hello.txt").click()');await wait('Boolean(document.querySelector(".monaco-editor"))');
  await prepare('.monaco-editor .view-lines');win.webContents.focus();const point=await js('(()=>{const r=document.querySelector(".monaco-editor .view-lines").getBoundingClientRect();return {x:Math.round(r.x+12),y:Math.round(r.y+10)};})()');win.webContents.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1});await delay(100);await js('document.querySelector(".monaco-editor textarea").focus()');await win.webContents.insertText('Unsaved file buffer');await wait('document.querySelector(".pane-toolbar").textContent.includes("Unsaved")');
  await js('window.confirm=()=>false;undefined');const dirtyContext=structuredClone(state.workspace.context);await click('.quick-switch-trigger');await fill('.quick-switcher input','settings');await wait('document.querySelector(".quick-switcher [role=option][aria-selected=true]").textContent.includes("Settings")');await js('document.querySelector(".quick-switcher input").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}))');assert.ok(await js('Boolean(document.querySelector(".workbench .monaco-editor"))'),'quick switcher respects declined dirty-buffer navigation');assert.deepEqual(state.workspace.context,dirtyContext);await js('document.querySelector(".sidebar-foot > button").click()');await delay(90);assert.equal(await js('Boolean(document.querySelector(".workbench .monaco-editor"))'),true,'global Settings navigation protects the dirty editor');assert.equal(await js('Boolean(document.querySelector(".settings-page"))'),false,'declining discard keeps Settings closed');assert.deepEqual(state.workspace.context,dirtyContext,'declining Settings navigation retains exact workspace selection');await prepare('.monaco-editor .view-lines');await wait('document.querySelector(".monaco-editor").textContent.replaceAll(String.fromCharCode(160)," ").includes("Unsaved file buffer")');await select('.start-fields label:first-child select','launch');assert.equal(await js('document.querySelector(".start-fields label:first-child select").value'),'studio','project change protects dirty editor');
  await fill('.composer textarea','Start without losing my open file');await wait('!document.querySelector(".composer-foot button").disabled');await click('.composer-foot button');await wait('!document.querySelector(".mission-start")');
  assert.ok(await js('document.querySelector(".pane-toolbar").textContent.includes("Unsaved")'),'starting a task keeps dirty file');
  assert.ok(await js('document.querySelector(".monaco-editor").textContent.replaceAll(String.fromCharCode(160)," ").includes("Unsaved file buffer")'),'editor buffer survives task creation');
  assert.equal(await js('document.querySelector(".composer textarea").value'),'','sent template does not reappear as a follow-up');
  await js('window.confirm=()=>true;undefined');await click('[aria-label="Back to workspace"]');await nav('Home');await wait('Boolean(document.querySelector(".home-page"))');
  failSnapshot=true;await reload();await wait("document.querySelector(\".loading-deck[role=alert] h2\")?.textContent===\"Your workspace couldn't load\"");assert.ok(await js('document.body.innerText.includes("Fixture: connection unavailable")'));failSnapshot=false;
  await click('.primary-button');await wait('Boolean(document.querySelector(".local-captain"))');await nav('Home');await wait('Boolean(document.querySelector(".home-page"))');
  taskRace=true;await reload();await wait('Boolean(document.querySelector(".home-page"))');await delay(250);
  assert.ok(await js('document.querySelector(".home-task-title").textContent.includes("Latest streamed task")'),'early streamed task is preserved over initial snapshot');
  win.setSize(1440,1050);
  const roomAssets={luffy:'luffy-captains-den.png',zoro:'zoro-dojo-room.png',nami:'nami-chart-room.png',usopp:'usopp-inventors-workshop.png',sanji:'sanji-galley-room.png',chopper:'chopper-infirmary-room.png',robin:'robin-ship-library.png',franky:'franky-shipwright-room.png',brook:'brook-music-room.png',jinbe:'jinbe-helm-room.png'};failStart=false;
  for(const [crewId,asset] of Object.entries(roomAssets)){state.settings.reducedMotion=crewId==='chopper';emit();await nav('Missions');await conversationStarters();await newConversation('studio');await select('[aria-label="Assigned crewmate"]',crewId);await wait(`document.querySelector(".workbench").dataset.crewId==="${crewId}"`);const startsBefore=starts;await fill('.composer textarea','Captain constraints.');await click('.room-starters button:first-child');assert.ok(await js('document.querySelector(".composer textarea").value.startsWith("Captain constraints.\\n\\n")'),'starter appends instead of replacing draft');assert.equal(starts,startsBefore,'starter never submits task');await fill('.composer textarea',`Fixture-only ${crewId} room preview`);await wait('!document.querySelector(".composer-foot button").disabled');await click('.composer-foot button');await wait('!document.querySelector(".mission-start")');await wait(`document.querySelector(".workbench").dataset.crewId==="${crewId}"`);await wait('Boolean(document.querySelector(".workspace-room-view>img"))');await wait('document.querySelector(".workspace-room-view>img").complete&&document.querySelector(".workspace-room-view>img").naturalWidth===1536');
   assert.ok(await js(`document.querySelector(".workspace-room-view>img").src.endsWith("/assets/${asset}")`),`${crewId} opens its own packaged room art`);assert.ok(await js('Boolean(document.querySelector(".workspace-room-view>img").alt)'),`${crewId} room art has a readable description`);assert.ok(await js('(()=>{const art=document.querySelector(".workspace-room-view>img"),chat=document.querySelector(".chat-pane");if(!art||!chat||!art.complete||art.naturalWidth!==1536)return false;const a=art.getBoundingClientRect(),c=chat.getBoundingClientRect();return a.width>100&&a.height>100&&(a.right<=c.left||a.bottom<=c.top);})()'),`${crewId} room art stays visible outside the chat pane`);assert.ok(await js('Boolean(document.querySelector(".composer textarea")&&Array.from(document.querySelectorAll("button")).some(button=>button.getAttribute("aria-label")==="Back to workspace"))'),`${crewId} keeps direct work controls available`);
   assert.equal(await js('document.querySelector(".crew-station-panel").dataset.roomLayout'),crewId,'dedicated station layout');
   const stationTask=state.tasks.find(value=>value.id==='new-'+starts),attemptId='station-attempt-'+crewId;
   stationTask.messages.push({id:'station-activity-'+crewId,role:'system',text:'Fixture: saved work update received',time:Date.now()});stationTask.updatedAt=Date.now();stationTask.messages.push({id:'station-reply-'+crewId,role:'assistant',text:'Fixture only: the first draft is ready for inspection. Check the recorded output and remaining criteria before accepting it.',time:Date.now()});
   if(crewId==='chopper')stationTask.error='Fixture: the build could not resolve a local import. Review the diagnostic receipt before retrying.';
   const stationMission={id:'station-mission-'+crewId,projectId:'studio',title:'Fixture: improve the customer workspace',objective:'Make the customer workspace readable, responsive and easy to review.',acceptanceCriteria:['The primary task stays visible at compact widths.','Keyboard users can reach every work control.','Saved evidence supports the final review.'],completionBoundary:'review',status:'working',connection:'connected',revision:1,createdAt:now,updatedAt:Date.now(),taskIds:[stationTask.id],activeAttemptId:attemptId,attempts:[{id:attemptId,taskId:stationTask.id,taskIds:[stationTask.id],status:'working',startedAt:now}],artifacts:[{id:'station-check-'+crewId,attemptId,projectId:'studio',producer:stationTask.id,kind:'check',script:'Fixture responsive check',status:crewId==='chopper'?'failed':'passed',exitCode:crewId==='chopper'?1:0,recordedAt:Date.now()},{id:'station-output-'+crewId,attemptId,projectId:'studio',producer:stationTask.id,kind:'deliverable',filePath:'fixture/workspace-review.md',recordedAt:Date.now()}],events:[],reviewDecisions:crewId==='zoro'?[{id:'review-fixture',attemptId,decision:'changes-requested',note:'Fixture: check keyboard reachability.',reviewedRevision:1,time:now,actor:'captain'}]:[]};
   if(['luffy','jinbe'].includes(crewId)){stationTask.runId='station-run-'+crewId;state.runs.push({id:stationTask.runId,projectId:'studio',phase:'executing',missionIds:[],assignments:[{id:'context',crewId:'robin',state:'finished',objective:'Fixture: gather context',dependencies:[],criteriaIds:[]},{id:'build',crewId,taskId:stationTask.id,state:'working',objective:'Fixture: coordinate the workspace update',dependencies:['context'],criteriaIds:[]},{id:'verify',crewId:'usopp',state:'queued',objective:'Fixture: verify the updated workspace',dependencies:['build'],criteriaIds:[]}],grant:{maxWorkers:3,maxLaunches:20,maxRepairs:4,activeMs:600000,tokenLimit:100000},counters:{launches:1,repairs:0,activeMs:100,tokens:50},budget:{},stopIntent:null});}
   state.missions.push(stationMission);const stationDelta=projection.transcriptChanged(stationTask);win.webContents.send('sunny:event',{type:'transcript:delta',epoch:stationDelta.epoch,sequence:stationDelta.sequence,data:stationDelta});emit();await wait('document.querySelector(".station-latest")?.textContent.includes("Fixture: saved work update received")');await click('.station-latest');await wait('document.querySelector(".station-activity")?.textContent.includes("Fixture: saved work update received")');await click('.station-tabs button:first-child');await wait('!document.querySelector(".station-activity")');
   if(['luffy','jinbe'].includes(crewId)){
    await wait('document.querySelectorAll(".station-relay li").length===3');assert.equal(await js('document.querySelectorAll(".station-relay li[data-active=true]").length'),1,'only confirmed current work is animated');assert.ok(await js('document.querySelector(".station-relay").textContent.includes("robin (context)")'),'dependency identity is visible');
    stationTask.status='unknown';emit();await wait('document.querySelectorAll(".station-relay li[data-active=true]").length===0');stationTask.status='working';emit();await wait('document.querySelectorAll(".station-relay li[data-active=true]").length===1');
    state.approvals.push({id:'station-call',taskId:stationTask.id,method:'item/commandExecution/requestApproval',params:{command:'fixture only'}});emit();await wait('document.querySelectorAll(".station-relay li[data-active=true]").length===0');state.approvals=state.approvals.filter(value=>value.id!=='station-call');emit();await wait('document.querySelectorAll(".station-relay li[data-active=true]").length===1');
   }
   const draft='Unsent '+crewId+' station draft';await fill('.composer textarea',draft);
   await click('.room-layout-toolbar button:last-child');assert.equal(await js('getComputedStyle(document.querySelector(".crew-station-panel")).display'),'none','focus mode hides scenery');assert.equal(await js('document.querySelector(".composer textarea").value'),draft,'focus mode keeps draft');await click('.room-layout-toolbar button:first-child');
   await click('.station-scene-controls button');assert.equal(await js('document.querySelector(".crew-station-panel").dataset.ambient'),'false','ambience pause is immediate');await click('.station-scene-controls button');
   await click('.station-tabs button:last-child');await wait('Boolean(document.querySelector(".station-activity"))');assert.equal(await js('document.querySelector(".composer textarea").value'),draft,'station switch keeps draft');
   await click('.station-tabs button:first-child');await wait('!document.querySelector(".station-activity")');
   const compactArtHeight=await js('document.querySelector(".crew-station-panel>img").getBoundingClientRect().height');await click('[aria-label="Expand room artwork"]');assert.ok(await js('document.querySelector(".crew-station-panel>img").getBoundingClientRect().height')>compactArtHeight,'expanded artwork increases visible scene area');await click('[aria-label="Compact room artwork"]');
   if(crewId==='franky'){
    win.webContents.debugger.attach('1.3');
    try{await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await wait('document.querySelector(".crew-station-panel").dataset.ambient==="false"');assert.equal(await js('getComputedStyle(document.querySelector(".station-atmosphere i")).animationName'),'none','OS preference stops room effects without remounting');assert.equal(await js('document.querySelector(".composer textarea").value'),draft);}
    finally{await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});win.webContents.debugger.detach();}
   }
   await js('document.querySelector(".workbench-head").scrollIntoView({block:"start",behavior:"instant"})');await screenshot('station-'+crewId+'.png');assert.ok(await js('(()=>{const r=document.querySelector(".workspace-room-state>.crew-badge").getBoundingClientRect();return r.width===r.height&&r.width>=32&&r.width<=64;})()'),'room badge preserves square atlas geometry');await js('document.querySelector(".station-content").scrollIntoView({block:"center",behavior:"instant"})');await screenshot('station-'+crewId+'-workspace.png');
   win.webContents.setZoomFactor(2);try{await wait('innerWidth<800');assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'200 percent zoom has no page overflow');assert.equal(await js('document.querySelector(".composer textarea").value'),draft,'200 percent zoom keeps unsent draft');assert.ok(await js('document.querySelector(".crew-station-panel>img").naturalWidth===1536'),'zoom retains loaded artwork');if(crewId==='franky')await screenshot('station-franky-200-percent.png');}finally{win.webContents.setZoomFactor(1);await wait('innerWidth>1000');}
   if(['luffy','jinbe'].includes(crewId)){win.setSize(360,900);await wait('innerWidth<400');assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'populated crew relay fits a narrow phone');assert.equal(await js('document.querySelectorAll(".station-relay li").length'),3);if(crewId==='jinbe')await screenshot('station-jinbe-relay-mobile.png');win.setSize(1440,1050);await wait('innerWidth>1000');}
   if(crewId==='zoro')await screenshot('zoro-dojo-room-working.png');if(crewId==='chopper'){assert.ok(await js('document.querySelector(".workbench").classList.contains("reduce-motion")'),'reduced motion keeps Chopper room static and usable');await screenshot('chopper-infirmary-reduced-motion.png');}state.missions=state.missions.filter(value=>value.id!==stationMission.id);state.runs=state.runs.filter(value=>value.id!==stationTask.runId);await click('[aria-label="Back to workspace"]');await wait('!document.querySelector(".workbench")');
  }
  await require('./crew-usability-smoke.cjs').check({js,wait,fill,select,click,nav,screenshot,win,localFixture});
  await require('./local-crew-smoke.cjs').check({js,wait,fill,select,click,nav,screenshot,win,localFixture});
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,hidden:!win.isVisible(),syntheticTransport:true,liveProviderProof:false}));console.log('SUNNY_WORKFLOW '+JSON.stringify({passed:true,hidden:!win.isVisible(),syntheticTransport:true,liveProviderProof:false,checks:['luffy-primary-navigation','more-keyboard-and-focus','luffy-search-and-project-entry','crew-direct-specialist-profiles','recommended-skills-preserve-instructions','persistent-dismissible-errors','crew-desktop-and-compact-layout','captain-watch-streamed-requests','captain-watch-disconnect-precedence','captain-watch-tool-completion-not-done','captain-watch-phone-layout','captain-watch-request-navigation-no-authority','inbox-show-more','inbox-project-filter','quick-switch-mobile','quick-switch-stable-selection','quick-switch-dirty-guard','searchable-local-inbox','inbox-review-state','quick-switch-enter-target','quick-switch-ime','helm-user-and-system-reduced-motion','helm-sea-pause','streamed-deck-activity','snapshot-race','family-search','specialist-approval','duplicate-approval','draft-per-task','home-draft-navigation','failed-start-draft','duplicate-start','lazy-tools','folder-parent','editor-load','draft-reload','reconcile','inbox','compact-layout','island-navigation','startup-retry','pending-launch-navigation','dirty-project-switch','dirty-global-settings-navigation','workspace-draft-cas-helper','dirty-file-task-start','template-cleared-after-start','character-room-theme','room-audio-toggle','room-audio-settings','robin-obsidian-library-route','note-context-unsent-robin-review','oversized-note-boundary','all-ten-illustrated-crew-rooms','distinct-station-layouts','square-room-badge','all-rooms-200-percent-zoom','station-tabs-preserve-drafts','room-focus-keeps-draft','room-starters-unsent','room-ambience-pause','room-art-expansion','room-streamed-saved-update','recorded-crew-relay-dependencies','crew-relay-input-and-uncertainty','crew-relay-mobile-layout','room-system-reduced-motion-live','reduced-motion-illustrated-room'],screenshots:output}));
 }catch(error){await screenshot('failure.png').catch(()=>{});fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:false,syntheticTransport:true,liveProviderProof:false,error:error.stack,health:{mainPid:process.pid,mainAlive:true,windowDestroyed:win.isDestroyed(),rendererPid:win.isDestroyed()?null:win.webContents.getOSProcessId()}}));console.error(error);process.exitCode=1;}
 finally{if(!win.isDestroyed())win.destroy();app.exit(process.exitCode||0);}
}).catch(error=>{console.error(error);app.exit(1);});
