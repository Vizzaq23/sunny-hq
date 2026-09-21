// Runs the production UI against a controlled IPC boundary; never starts Codex or uses real user data.
const {app,BrowserWindow,ipcMain}=require('electron');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),output=path.join(root,'.sunny-dev','workflow-check');
fs.mkdirSync(output,{recursive:true});app.setPath('userData',path.join(output,'profile-'+Date.now()));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const now=Date.now();
const task=(id,title,status,crewId='luffy',extra={})=>({id,title,status,crewId,projectId:'studio',createdAt:now-300000,updatedAt:now-30000,messages:[],threadId:'thread-'+id,turnId:'turn-'+id,...extra});
const state={projects:[{id:'studio',name:'Sunny Studio',path:output,category:'development'},{id:'launch',name:'Launch planning',path:output,category:'creative'}],tasks:[
 task('captain','Polish the customer dashboard','working','luffy',{captain:true}),
 task('design','Refresh the dashboard layout','waiting','sanji',{parentTaskId:'captain'}),
 task('research','Compare three launch ideas','working','robin',{projectId:'launch'}),
 task('unknown','Recover the settings update','unknown','chopper',{error:'The connection was interrupted.'}),
 task('done','Write the onboarding guide','finished','robin',{messages:[{id:'reply',role:'assistant',text:'The onboarding guide is ready. It covers setup, first tasks, and reviewing the crew’s results.',time:now-60000}]})
],settings:{reducedMotion:true,notifications:false},codex:{status:'connected'},approvals:[{id:'permission',taskId:'design',method:'item/commandExecution/requestApproval',params:{command:'npm test',reason:'Verify the updated dashboard.'}}],models:[],tools:[],automations:[],usage:null,world:{paused:true,residents:[],jobs:[],ledger:[]}};
 let win,failStart=true,starts=0,answers=0,failSnapshot=false,raceSnapshot=true,startDelay=150,stops=0,failCheck=true,taskRace=false;
const emit=()=>win.webContents.send('sunny:event',{type:'snapshot',data:structuredClone(state)});
ipcMain.handle('sunny:invoke',async(_event,action,args)=>{
 if(action==='snapshot'){
  if(failSnapshot)throw Error('Fixture: connection unavailable');
  if(raceSnapshot){raceSnapshot=false;const stale={...structuredClone(state),tasks:[]};setTimeout(emit,20);await delay(180);return stale;}
  if(taskRace){taskRace=false;const stale=structuredClone(state);setTimeout(()=>{state.tasks[0].title='Latest streamed task';win.webContents.send('sunny:event',{type:'task',data:state.tasks[0]});},20);await delay(180);return stale;}
  return state;
 }
 if(action==='task:start'){starts++;await delay(startDelay);if(failStart)throw Error('Fixture: unable to connect');const next=task('new-'+starts,args.prompt,'working',args.crewId,{projectId:args.projectId,captain:args.crewId==='luffy',messages:[{id:'user',role:'user',text:args.prompt,time:Date.now()}]});state.tasks.unshift(next);emit();return next;}
 if(action==='task:send'){const target=state.tasks.find(task=>task.id===args.taskId);target.status='working';target.messages.push({id:'followup',role:'user',text:args.prompt,time:Date.now()});emit();return;}
 if(action==='approval:respond'){answers++;await delay(150);state.approvals=[];state.tasks.find(task=>task.id==='design').status='working';emit();return;}
 if(action==='task:checkStatus'){if(failCheck)throw Error('Fixture: status check offline');const target=state.tasks.find(task=>task.id===args.taskId);target.status='working';target.error=undefined;emit();return target;}
 if(action==='task:interrupt'){stops++;state.tasks.find(task=>task.id===args.taskId).status='interrupted';state.tasks.find(task=>task.id===args.taskId).error=undefined;emit();return;}
 if(action==='files:list')return args.path===path.join(output,'nested')?[{name:'notes.txt',path:path.join(output,'nested','notes.txt'),directory:false}]:[{name:'nested',path:path.join(output,'nested'),directory:true},{name:'hello.txt',path:path.join(output,'hello.txt'),directory:false}];
 if(action==='files:read')return {path:args.path,text:'Hello Sunny\n',hash:'fixture'};
 if(action==='task:history')return [];
 if(action==='app:diagnostic'||action==='asset:crewTexture')return null;
 throw Error('Unexpected smoke IPC: '+action);
});
app.whenReady().then(async()=>{
 win=new BrowserWindow({width:1440,height:1050,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,offscreen:true}});
 // Offscreen rendering keeps capture independent of the desktop compositor.
 const js=async code=>{try{return await win.webContents.executeJavaScript(code);}catch(error){throw Error(code+'\n'+error.message);}};
 const wait=async(code)=>{for(let i=0;i<120;i++){if(await js(code))return;await delay(50);}throw Error('UI wait timed out: '+code);};
 const click=async selector=>{await js(`document.querySelector(${JSON.stringify(selector)}).click()`);await delay(70);};
 const fill=(selector,value)=>js(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const select=(selector,value)=>js(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});element.value=${JSON.stringify(value)};element.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const nav=async label=>{await js(`Array.from(document.querySelectorAll('.sidebar .main-nav button')).find(button=>button.querySelector('span').textContent===${JSON.stringify(label)}).click()`);await delay(70);};
 const screenshot=async name=>fs.writeFileSync(path.join(output,name),(await win.webContents.capturePage()).toPNG());
 try{
  await win.loadFile(path.join(root,'dist','index.html'));await wait('Boolean(document.querySelector(".home-page"))');await delay(250);
  assert.equal(await js('document.querySelectorAll(".home-task").length'),4,'newer snapshot wins over stale initial response');
  await delay(250);await screenshot('home-desktop.png');
  assert.equal(await js('document.querySelectorAll("button button").length'),0,'no nested buttons');
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
  await nav('Projects');await nav('Home');await wait('Boolean(document.querySelector(".home-page"))');
  assert.equal(await js('document.querySelector(".launch-main>textarea").value'),'Build a clearer task dashboard');
  await click('input[value="direct"]');await select('[aria-label="Task specialist"]','robin');await nav('Projects');await nav('Home');
  assert.equal(await js('document.querySelector("input[value=direct]").checked'),true,'routing survives navigation');
  assert.equal(await js('document.querySelectorAll(".launch-options select")[1].value'),'robin');
  await click('input[value="delegate"]');
  await js('document.querySelector(".launch-submit").click();document.querySelector(".launch-submit").click()');await wait('Boolean(document.querySelector(".launch-error"))');assert.equal(starts,1);
  assert.equal(await js('document.querySelector(".launch-main>textarea").value'),'Build a clearer task dashboard','failed start retains draft');
  failStart=false;await click('.launch-submit');await wait('Boolean(document.querySelector(".workbench"))');assert.equal(starts,2);
  assert.equal(await js('Boolean(document.querySelector(".work-pane"))'),false,'tools hidden initially');
  const resources=await js('performance.getEntriesByType("resource").map(entry=>entry.name)');assert.ok(!resources.some(name=>/assets\/(CodeEditor|TerminalPane)-.*\.js/.test(name)),'heavy tools not loaded for chat');
  await fill('.composer textarea','Save this for after the first result');await screenshot('focused-conversation.png');
  await click('.workspace-tools-toggle');await wait('Boolean(document.querySelector(".file-up"))');
  await js('Array.from(document.querySelectorAll(".file-tree button")).find(button=>button.textContent==="nested").click()');await wait('document.querySelector(".file-tree").textContent.includes("notes.txt")');
  await click('.file-up');await wait('document.querySelector(".file-tree").textContent.includes("hello.txt")');assert.equal(await js('document.querySelector(".file-up").disabled'),true,'parent navigation stops at registered project root');
  await js('Array.from(document.querySelectorAll(".file-tree button")).find(button=>button.textContent==="hello.txt").click()');await wait('Boolean(document.querySelector(".monaco-editor"))');await screenshot('files-workspace.png');
  await click('[aria-label="Back to workspace"]');await wait('Boolean(document.querySelector(".home-page"))');await win.reload();await wait('Boolean(document.querySelector(".home-page"))');
  await click('.home-task-title');await wait('Boolean(document.querySelector(".workbench"))');assert.equal(await js('document.querySelector(".composer textarea").value'),'Save this for after the first result','task draft survives UI reload');
  await click('[aria-label="Back to workspace"]');await wait('Boolean(document.querySelector(".home-page"))');
  await fill('[aria-label="Search tasks"]','Recover the settings');await wait('document.querySelectorAll(".home-task").length===1');await click('.home-task-open');await wait('Boolean(document.querySelector(".task-recovery"))');
  assert.equal(await js('document.querySelector(".interrupt-button").textContent.trim()'),'Check status');
  await click('.interrupt-button');await wait('document.querySelector(".task-recovery").textContent.includes("status check offline")');assert.equal(stops,0);
  failCheck=false;await click('.interrupt-button');await wait('!document.querySelector(".task-recovery")');assert.equal(stops,0,'checking running work never stops it');
  assert.equal(await js('document.querySelector(".mission-status strong").textContent'),'Working');
  await click('.interrupt-button');await wait('!document.querySelector(".interrupt-button")');await fill('.composer textarea','Continue after recovery');assert.equal(await js('document.querySelector(".composer-foot button").disabled'),false);
  await screenshot('stopped-task.png');
  await click('[aria-label="Back to workspace"]');await wait('Boolean(document.querySelector(".home-page"))');
  await nav('Inbox');await wait('Boolean(document.querySelector(".inbox-layout"))');await nav('Home');
  await fill('[aria-label="Search tasks"]','');
  win.setSize(1000,740);await delay(150);await screenshot('home-compact.png');assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'));
  await nav('The Island');await wait('Boolean(document.querySelector(".island-scene"))');await nav('Home');
  // A late launcher response must not steal navigation or erase a newer draft.
  startDelay=650;await select('[aria-label="Task project"]','studio');await fill('[aria-label="Task brief"]','A launch that finishes after navigation');await click('.launch-submit');await nav('Projects');await nav('Home');
  assert.equal(await js('document.querySelector(".launch-submit").disabled'),true,'launch remains pending across navigation');
  await delay(750);assert.ok(await js('Boolean(document.querySelector(".home-page"))'),'late result does not force navigation');
  assert.equal(await js('document.querySelector(".launch-main>textarea").value'),'','late successful launch clears only the submitted brief');
  assert.ok(await js('document.querySelector(".launch-receipt").textContent.includes("A launch that finishes after navigation")'),'late launch has a visible receipt');
  await fill('[aria-label="Task brief"]','Submit only this brief');await click('.launch-submit');await nav('Projects');
  await js('sessionStorage.setItem("sunny:draft:v1:home:studio","A newer draft for later")');await nav('Home');await delay(750);
  assert.equal(await js('document.querySelector(".launch-main>textarea").value'),'A newer draft for later','successful launch preserves a newer draft across remount');
  startDelay=150;await nav('Missions');await wait('Boolean(document.querySelector(".mission-card button"))');await click('.mission-card button');await wait('Boolean(document.querySelector(".mission-start"))');await click('.workspace-tools-toggle');await wait('document.querySelector(".file-tree").textContent.includes("hello.txt")');
  await js('Array.from(document.querySelectorAll(".file-tree button")).find(button=>button.textContent==="hello.txt").click()');await wait('Boolean(document.querySelector(".monaco-editor"))');
  win.focus();win.webContents.focus();const point=await js('(()=>{const r=document.querySelector(".monaco-editor .view-lines").getBoundingClientRect();return {x:Math.round(r.x+12),y:Math.round(r.y+10)};})()');win.webContents.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1});await delay(100);await win.webContents.insertText('Unsaved file buffer');await wait('document.querySelector(".pane-toolbar").textContent.includes("Unsaved")');
  await js('window.confirm=()=>false;undefined');await select('.start-fields label:first-child select','launch');assert.equal(await js('document.querySelector(".start-fields label:first-child select").value'),'studio','project change protects dirty editor');
  await fill('.composer textarea','Start without losing my open file');await click('.composer-foot button');await wait('!document.querySelector(".mission-start")');
  assert.ok(await js('document.querySelector(".pane-toolbar").textContent.includes("Unsaved")'),'starting a task keeps dirty file');
  assert.ok(await js('document.querySelector(".monaco-editor").textContent.replaceAll(String.fromCharCode(160)," ").includes("Unsaved file buffer")'),'editor buffer survives task creation');
  assert.equal(await js('document.querySelector(".composer textarea").value'),'','sent template does not reappear as a follow-up');
  await js('window.confirm=()=>true;undefined');await click('[aria-label="Back to workspace"]');await nav('Home');await wait('Boolean(document.querySelector(".home-page"))');
  await nav('Missions');await wait('Boolean(document.querySelector(".mission-card button"))');await click('.mission-card button');await wait('Boolean(document.querySelector(".mission-start"))');
  assert.ok((await js('document.querySelector(".composer textarea").value')).trim(),'new template seeds a previously cleared project draft');
  await fill('.composer textarea','Keep my existing draft');await click('[aria-label="Back to workspace"]');await nav('Missions');await wait('Boolean(document.querySelector(".mission-card button"))');await click('.mission-card button');await wait('Boolean(document.querySelector(".mission-start"))');
  assert.equal(await js('document.querySelector(".composer textarea").value'),'Keep my existing draft','explicit template preserves a nonempty saved draft');
  await click('[aria-label="Back to workspace"]');await nav('Home');await wait('Boolean(document.querySelector(".home-page"))');
  failSnapshot=true;win.reload();await wait('document.body.innerText.includes("Your workspace couldn’t load")');assert.ok(await js('document.body.innerText.includes("Fixture: connection unavailable")'));failSnapshot=false;
  await click('.primary-button');await wait('Boolean(document.querySelector(".home-page"))');
  taskRace=true;await win.reload();await wait('Boolean(document.querySelector(".home-page"))');await delay(250);
  assert.ok(await js('document.querySelector(".home-task-title").textContent.includes("Latest streamed task")'),'early streamed task is preserved over initial snapshot');
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true}));console.log('SUNNY_WORKFLOW '+JSON.stringify({passed:true,checks:['snapshot-race','family-search','specialist-approval','duplicate-approval','draft-per-task','home-draft-navigation','failed-start-draft','duplicate-start','lazy-tools','folder-parent','editor-load','draft-reload','reconcile','inbox','compact-layout','island-navigation','startup-retry','pending-launch-navigation','dirty-project-switch','dirty-file-task-start','template-cleared-after-start','template-after-empty-draft','existing-draft-preserved'],screenshots:output}));
 }catch(error){await screenshot('failure.png').catch(()=>{});fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:false,error:error.stack}));console.error(error);process.exitCode=1;}
 finally{win.destroy();app.exit(process.exitCode||0);}
}).catch(error=>{console.error(error);app.exit(1);});
