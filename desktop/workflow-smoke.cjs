// Runs the production UI against a controlled IPC boundary; never starts Codex or uses real user data.
const {app,BrowserWindow,ipcMain}=require('electron');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),output=path.join(root,'.sunny-dev','workflow-check');
fs.mkdirSync(output,{recursive:true});app.setPath('userData',path.join(output,'profile-'+Date.now()));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const now=Date.now();
const task=(id,title,status,crewId='luffy',extra={})=>({id,title,status,crewId,projectId:'studio',createdAt:now-300000,updatedAt:now-30000,messages:[],threadId:'thread-'+id,turnId:'turn-'+id,...extra});
const skillOption={id:'ecc-frontend-a11y',name:'ecc-frontend-a11y',category:'Engineering',purpose:'Check interactive UI access.',roles:['builder','designer','reviewer'],revision:'a'.repeat(64)};
const state={projects:[{id:'studio',name:'Sunny Studio',path:output,category:'development'},{id:'launch',name:'Launch planning',path:output,category:'creative'}],tasks:[
 task('captain','Polish the customer dashboard','working','luffy',{captain:true}),
 task('design','Refresh the dashboard layout','waiting','sanji',{parentTaskId:'captain'}),
 task('research','Compare three launch ideas','working','robin',{projectId:'launch'}),
 task('unknown','Recover the settings update','unknown','chopper',{error:'The connection was interrupted.'}),
 task('done','Write the onboarding guide','finished','robin',{messages:[{id:'reply',role:'assistant',text:'The onboarding guide is ready. It covers setup, first tasks, and reviewing the crew’s results.',time:now-60000}]})
],settings:{reducedMotion:true,notifications:false},codex:{status:'connected'},approvals:[{id:'permission',taskId:'design',method:'item/commandExecution/requestApproval',params:{command:'npm test',reason:'Verify the updated dashboard.'}}],models:[],tools:[],automations:[],usage:null,world:{paused:true,residents:[],jobs:[],ledger:[]}};
 let win,failStart=true,starts=0,answers=0,failSnapshot=false,raceSnapshot=true,startDelay=150,stops=0,failCheck=true,taskRace=false,reportRequests=0,captures=0,failCapture=true;
const emit=()=>win.webContents.send('sunny:event',{type:'snapshot',data:structuredClone(state)});
ipcMain.handle('sunny:invoke',async(_event,action,args)=>{
 if(action==='skills:suggest')return args.brief.includes('dashboard')?{available:[skillOption],suggested:[skillOption]}:{available:[],suggested:[]};
 if(action==='snapshot'){
  if(failSnapshot)throw Error('Fixture: connection unavailable');
  if(raceSnapshot){raceSnapshot=false;const stale={...structuredClone(state),tasks:[]};setTimeout(emit,20);await delay(180);return stale;}
  if(taskRace){taskRace=false;const stale=structuredClone(state);setTimeout(()=>{state.tasks[0].title='Latest streamed task';win.webContents.send('sunny:event',{type:'task',data:state.tasks[0]});},20);await delay(180);return stale;}
  return state;
 }
 if(action==='task:start'){starts++;await delay(startDelay);if(failStart)throw Error('Fixture: unable to connect');const next=task('new-'+starts,args.prompt,'working',args.crewId,{projectId:args.projectId,captain:args.crewId==='luffy',selectedSkills:args.selectedSkills?.map(choice=>({...skillOption,...choice})),messages:[{id:'user',role:'user',text:args.prompt,time:Date.now()}]});state.tasks.unshift(next);emit();return next;}
 if(action==='task:send'){const target=state.tasks.find(task=>task.id===args.taskId);target.status='working';target.messages.push({id:'followup',role:'user',text:args.prompt,time:Date.now()});emit();return;}
 if(action==='approval:respond'){answers++;await delay(150);state.approvals=[];state.tasks.find(task=>task.id==='design').status='working';emit();return;}
 if(action==='task:checkStatus'){if(failCheck)throw Error('Fixture: status check offline');const target=state.tasks.find(task=>task.id===args.taskId);target.status='working';target.error=undefined;emit();return target;}
 if(action==='task:interrupt'){stops++;state.tasks.find(task=>task.id===args.taskId).status='interrupted';state.tasks.find(task=>task.id===args.taskId).error=undefined;emit();return;}
 if(action==='files:list')return args.path===path.join(output,'nested')?[{name:'notes.txt',path:path.join(output,'nested','notes.txt'),directory:false}]:[{name:'nested',path:path.join(output,'nested'),directory:true},{name:'hello.txt',path:path.join(output,'hello.txt'),directory:false}];
 if(action==='files:read')return {path:args.path,text:'Hello Sunny\n',hash:'fixture'};
 if(action==='library:search')return [{path:'00 Projects/Launch Notes.md',title:'Launch Notes',excerpt:'A useful saved project note.'},{path:'00 Projects/Long Notes.md',title:'Long Notes',excerpt:'A large reference note.'}];
 if(action==='library:read')return {path:args.path,text:args.path.includes('Long Notes')?'x'.repeat(16001):'Keep the launch focused on a small, verifiable first release.',hash:'fixture-note'};
 if(action==='library:capture'){captures++;if(failCapture)throw Error('Fixture: Obsidian vault unavailable');return {path:'00 Inbox/Morgans work report.md'};}
 if(action==='report:create'){
  reportRequests++;assert.equal(args.projectIds,undefined,'default includes all projects');assert.ok(Math.abs(Date.now()-args.since-7*86400000)<5000,'default is seven days');
  if(reportRequests>1){const packet={createdAt:now,scope:{projectIds:['studio','launch'],since:args.since,until:now},coverage:{source:'saved-local-records',truncated:true,retainedEventLimit:500},projects:[{id:'studio',name:'Sunny Studio',tasks:[],missions:[],observations:[]},{id:'launch',name:'Launch planning',tasks:[],missions:[],observations:[]}],attention:[]};const reportTask=task('morgans-unknown','Morgans work report','unknown','morgans',{error:'Provider status uncertain.'});state.tasks.unshift(reportTask);emit();return {packet,task:reportTask};}
  state.tasks.unshift(task('failed-fixture','Failed build review','failed','zoro'));
  state.missions=[{id:'review-fixture',projectId:'launch',title:'Review the launch',objective:'Review saved launch evidence.',acceptanceCriteria:['Captain checks the result'],completionBoundary:'review',status:'WAITING_FOR_REVIEW',connection:'connected',revision:1,createdAt:now,updatedAt:now,taskIds:[],attempts:[],artifacts:[],events:[]}];
  const reportTask=task('morgans-report','Morgans work report','working','morgans');state.tasks.unshift(reportTask);emit();
  const item=(kind,id,title,status,target,projectId='studio')=>({kind,id,title,status,projectId,observedAt:now,sourceId:id,sourceTime:now,target:{view:kind==='task'?'task':'mission',id:target}});
  const failed=item('task','failed-fixture','Failed build review','failed','failed-fixture');
  const mission=item('mission','review-fixture','Review the launch','review-needed','review-fixture','launch');
  const deployment=item('deployment','review-fixture:deployment','Deployment observation','unobserved','review-fixture','launch');
  const packet={createdAt:now,scope:{projectIds:['studio','launch'],since:args.since,until:now},coverage:{source:'saved-local-records',truncated:false,retainedEventLimit:500},projects:[{id:'studio',name:'Sunny Studio',tasks:[failed],missions:[],observations:[]},{id:'launch',name:'Launch planning',tasks:[],missions:[mission],observations:[deployment]}],attention:[failed,mission]};
  setTimeout(()=>{reportTask.status='finished';reportTask.messages=[{id:'morgans-reply',role:'assistant',text:'The build review failed. The launch mission awaits review.',time:Date.now()}];emit();},250);
  return {packet,task:reportTask};
 }
 if(action==='settings:update'){if(Object.hasOwn(args,'roomSoundEnabled'))state.settings.roomSoundEnabled=args.roomSoundEnabled;if(Object.hasOwn(args,'roomSoundVolume'))state.settings.roomSoundVolume=args.roomSoundVolume;emit();return state.settings;}
 if(action==='task:history')return [];
 if(action==='app:diagnostic'||action==='asset:crewTexture')return null;
 throw Error('Unexpected smoke IPC: '+action);
});
app.whenReady().then(async()=>{
 win=new BrowserWindow({width:1440,height:1050,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 win.showInactive();
 const js=async code=>{try{return await win.webContents.executeJavaScript(code);}catch(error){throw Error(code+'\n'+error.message);}};
 const wait=async(code)=>{for(let i=0;i<120;i++){if(await js(code))return;await delay(50);}throw Error('UI wait timed out: '+code);};
 const click=async selector=>{await js(`document.querySelector(${JSON.stringify(selector)}).click()`);await delay(70);};
 const fill=(selector,value)=>js(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const select=(selector,value)=>js(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});element.value=${JSON.stringify(value)};element.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const nav=async label=>{await js(`Array.from(document.querySelectorAll('.sidebar .main-nav button')).find(button=>button.querySelector('span').textContent===${JSON.stringify(label)}).click()`);await delay(70);};
 const screenshot=async name=>{
  let lastError;
  for(let attempt=1;attempt<=3;attempt++){
   try{
    await delay(150*attempt);
    const image=await win.webContents.capturePage();
    fs.writeFileSync(path.join(output,name),image.toPNG());
    return;
   }catch(error){lastError=error;}
  }
  throw lastError;
 };
 try{
  await win.loadFile(path.join(root,'dist','index.html'));await wait('Boolean(document.querySelector(".home-page"))');await delay(250);
  assert.equal(await js('document.querySelectorAll(".home-task").length'),4,'newer snapshot wins over stale initial response');
  await delay(250);await screenshot('home-desktop.png');
  await nav('Morgans’ blimp');await wait('Boolean(document.querySelector(".morgans-page"))');
  assert.ok(await js('Boolean(document.querySelector(".morgans-report"))'),'Morgans has a saved-work report section');
  assert.equal(await js('document.querySelector(".morgans-report-controls select").value'),'all');
  assert.equal(await js('document.querySelectorAll(".morgans-report-controls select")[1].value'),'7');
  await js('document.querySelector(".morgans-report-generate").focus()');assert.equal(await js('document.activeElement.classList.contains("morgans-report-generate")'),true,'report action is keyboard reachable');
  await click('.morgans-report-generate');await wait('document.querySelectorAll(".morgans-source").length===3');
  assert.equal(reportRequests,1);assert.equal(captures,0,'generation and viewing never write to Obsidian');
  assert.ok(await js('document.querySelector(".morgans-report-evidence").textContent.includes("failed")'));
  assert.ok(await js('document.querySelector(".morgans-report-evidence").textContent.includes("review needed")'));
  assert.ok(await js('document.querySelector(".morgans-report-evidence").textContent.includes("unobserved")'));
  await wait('document.querySelector(".morgans-report-draft textarea").value.includes("The build review failed")');
  assert.ok(await js('document.querySelector(".morgans-report-draft textarea").value.includes("failed-fixture")'),'generated wording appends saved source IDs');
  await fill('[aria-label="Report draft"]','Captain-edited report with saved evidence.');assert.equal(captures,0,'editing stays local');
  await click('.morgans-report-draft>button');await wait('Boolean(document.querySelector(".morgans-report-error"))');assert.equal(captures,1);
  assert.equal(await js('document.querySelector(".morgans-report-draft textarea").value'),'Captain-edited report with saved evidence.','failed save keeps draft');
  failCapture=false;await click('.morgans-report-draft>button');await wait('document.querySelector(".morgans-report-draft>button").disabled');assert.equal(captures,2);
  await click('.morgans-report-draft>button');assert.equal(captures,2,'saved draft cannot be duplicated by another click');
  await screenshot('morgans-report-saved.png');
  await click('.morgans-report-task button');await wait('document.querySelector(".workbench")?.dataset.crewId==="morgans"');
  assert.ok(await js('document.querySelector(".conversation-room-art").src.endsWith("/assets/morgans-blimp.png")'),'reporter task uses packaged blimp art');
  assert.ok(await js('document.querySelector(".workbench-crew .crew-badge").style.backgroundImage.includes("morgans-blimp-key.png")'),'reporter badge uses Morgans artwork');
  assert.equal(await js('document.querySelector(".composer textarea").disabled'),true,'reporter task is read-only after its sourced turn');
  await click('[aria-label="Back to workspace"]');await nav('Morgans’ blimp');await wait('Boolean(document.querySelector(".morgans-report-draft"))');
  await fill('[aria-label="Report draft"]','Keep this unsaved draft while checking the source.');
  await js('Array.from(document.querySelectorAll(".morgans-source")).find(button=>button.textContent.includes("Failed build review")).click()');await wait('document.querySelector(".workbench")?.dataset.crewId==="zoro"');
  await click('[aria-label="Back to workspace"]');await nav('Morgans’ blimp');await wait('Boolean(document.querySelector(".morgans-report-draft"))');
  assert.equal(await js('document.querySelector(".morgans-report-draft textarea").value'),'Keep this unsaved draft while checking the source.','source navigation keeps draft');
  await js('Array.from(document.querySelectorAll(".morgans-source")).find(button=>button.textContent.includes("Review the launch")).click()');await wait('Boolean(document.querySelector(".mission-board"))');
  assert.ok(await js('document.querySelector(".mission-entries button[aria-pressed=true]")?.textContent.includes("Review the launch")'),'mission source opens exact mission');
  await nav('Morgans’ blimp');await wait('Boolean(document.querySelector(".morgans-report-draft"))');
  assert.equal(await js('document.querySelector(".morgans-report-draft textarea").value'),'Keep this unsaved draft while checking the source.');
  await js('window.confirm=()=>false;undefined');await click('.morgans-report-generate');assert.equal(reportRequests,1,'unsaved draft replacement requires confirmation');
  await js('window.confirm=()=>true;undefined');state.settings.reducedMotion=true;emit();await click('.morgans-report-generate');await wait('document.querySelector(".morgans-report-coverage")?.textContent.includes("truncated")');
  assert.equal(reportRequests,2);assert.equal(captures,2,'uncertain report and empty evidence do not save automatically');
  assert.ok(await js('document.querySelector(".morgans-report-task").textContent.includes("uncertain")'));
  assert.ok(await js('document.querySelector(".morgans-report-evidence").textContent.includes("No saved task")'));
  assert.equal(await js('getComputedStyle(document.querySelector(".morgans-report")).animationName'),'none','report remains usable with reduced motion');
  await screenshot('morgans-report-uncertain.png');
  await nav('Crew');await wait('Boolean(document.querySelector(".crew-grid"))');assert.equal(await js('document.querySelectorAll(".crew-card").length'),10,'Morgans reporter stays separate from the ten Straw Hats');
  await nav('Home');
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
  await wait('Boolean(document.querySelector(".launch-options .skill-options input"))');assert.equal(await js('document.querySelector(".launch-options .skill-options input").checked'),true,'matching skill is suggested');
  await click('.launch-options .skill-options input');assert.equal(await js('document.querySelector(".launch-options .skill-options input").checked'),false,'captain can remove a suggestion');
  await click('.launch-options .skill-options input');assert.equal(await js('document.querySelector(".launch-options .skill-options input").checked'),true,'captain can confirm a skill again');
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
  assert.ok(await js('document.querySelector(".composer textarea").value.includes("Note revision: fixture-note")'),'Robin handoff cites exact note revision');
  assert.ok(await js('document.querySelector(".composer textarea").value.includes("captain’s project decision")'),'Robin handoff asks for decision context');
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
  await click('[aria-label="Back to workspace"]');await wait('Boolean(document.querySelector(".home-page"))');await win.reload();await wait('Boolean(document.querySelector(".home-page"))');
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
  await nav('Inbox');await wait('Boolean(document.querySelector(".inbox-layout"))');await nav('Home');
  await fill('[aria-label="Search tasks"]','');
  win.setSize(1000,740);await delay(150);await screenshot('home-compact.png');assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'));
  await nav('The Island');await wait('Boolean(document.querySelector(".island-scene"))');
  assert.ok(await js('document.querySelector(".island-art").src.includes("grand-line-voyage-map.png")'),'Grand Line chart asset is loaded');
  await click('[aria-label="Toggle captain controls"]');await wait(`Boolean(document.querySelector('[aria-label="Captain character"]'))`);await select('[aria-label="Captain character"]','zoro');
  for(let index=0;index<13;index++)await click('[aria-label="Zoom in"]');assert.ok(await js('[...document.querySelectorAll(".island-map-toolbar button")].some(button=>button.textContent.includes("400%"))'),'chart zoom reaches 400%');await click('[aria-label="Reset map zoom"]');
  const beforeMove=await js(`parseFloat([...document.querySelectorAll('.island-actors [data-crew-id]')].find(item=>item.dataset.crewId==='zoro').style.left)`);await js('document.querySelector(".island-viewport").focus();document.querySelector(".island-viewport").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}))');await wait(`parseFloat([...document.querySelectorAll('.island-actors [data-crew-id]')].find(item=>item.dataset.crewId==='zoro').style.left)>${beforeMove}`);
  const beforeSouth=await js(`parseFloat([...document.querySelectorAll('.island-actors [data-crew-id]')].find(item=>item.dataset.crewId==='zoro').style.top)`);await click('[aria-label="Move south"]');await wait(`parseFloat([...document.querySelectorAll('.island-actors [data-crew-id]')].find(item=>item.dataset.crewId==='zoro').style.top)>${beforeSouth}`);await screenshot('island-captain-controls.png');await click('[aria-label="Toggle captain controls"]');
  await nav('Home');
  // A late launcher response must not steal navigation or erase a newer draft.
  failStart=false;startDelay=650;await select('[aria-label="Task project"]','studio');await fill('[aria-label="Task brief"]','A launch that finishes after navigation');await wait('!document.querySelector(".launch-submit").disabled');await click('.launch-submit');await nav('Projects');await nav('Home');
  assert.equal(await js('document.querySelector(".launch-submit").disabled'),true,'launch remains pending across navigation');
  await delay(750);assert.ok(await js('Boolean(document.querySelector(".home-page"))'),'late result does not force navigation');
  assert.equal(await js('document.querySelector(".launch-main>textarea").value'),'','late successful launch clears only the submitted brief');
  assert.ok(await js('document.querySelector(".launch-receipt").textContent.includes("A launch that finishes after navigation")'),'late launch has a visible receipt');
  await fill('[aria-label="Task brief"]','Submit only this brief');await wait('!document.querySelector(".launch-submit").disabled');await click('.launch-submit');await nav('Projects');
  await js('sessionStorage.setItem("sunny:draft:v1:home:studio","A newer draft for later")');await nav('Home');await delay(750);
  assert.equal(await js('document.querySelector(".launch-main>textarea").value'),'A newer draft for later','successful launch preserves a newer draft across remount');
  startDelay=150;await nav('The Island');await click('.destination-work-button');await wait('Boolean(document.querySelector(".mission-start"))');await click('.workbench-head [aria-expanded]');await wait('document.querySelector(".file-tree").textContent.includes("hello.txt")');
  await js('Array.from(document.querySelectorAll(".file-tree button")).find(button=>button.textContent==="hello.txt").click()');await wait('Boolean(document.querySelector(".monaco-editor"))');
  win.focus();win.webContents.focus();const point=await js('(()=>{const r=document.querySelector(".monaco-editor .view-lines").getBoundingClientRect();return {x:Math.round(r.x+12),y:Math.round(r.y+10)};})()');win.webContents.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1});await delay(100);await win.webContents.insertText('Unsaved file buffer');await wait('document.querySelector(".pane-toolbar").textContent.includes("Unsaved")');
  await js('window.confirm=()=>false;undefined');await select('.start-fields label:first-child select','launch');assert.equal(await js('document.querySelector(".start-fields label:first-child select").value'),'studio','project change protects dirty editor');
  await fill('.composer textarea','Start without losing my open file');await wait('!document.querySelector(".composer-foot button").disabled');await click('.composer-foot button');await wait('!document.querySelector(".mission-start")');
  assert.ok(await js('document.querySelector(".pane-toolbar").textContent.includes("Unsaved")'),'starting a task keeps dirty file');
  assert.ok(await js('document.querySelector(".monaco-editor").textContent.replaceAll(String.fromCharCode(160)," ").includes("Unsaved file buffer")'),'editor buffer survives task creation');
  assert.equal(await js('document.querySelector(".composer textarea").value'),'','sent template does not reappear as a follow-up');
  await js('window.confirm=()=>true;undefined');await click('[aria-label="Back to workspace"]');await nav('Home');await wait('Boolean(document.querySelector(".home-page"))');
  failSnapshot=true;win.reload();await wait('document.body.innerText.includes("Your workspace couldn’t load")');assert.ok(await js('document.body.innerText.includes("Fixture: connection unavailable")'));failSnapshot=false;
  await click('.primary-button');await wait('Boolean(document.querySelector(".home-page"))');
  taskRace=true;await win.reload();await wait('Boolean(document.querySelector(".home-page"))');await delay(250);
  assert.ok(await js('document.querySelector(".home-task-title").textContent.includes("Latest streamed task")'),'early streamed task is preserved over initial snapshot');
  const roomAssets={luffy:'luffy-captains-den.png',zoro:'zoro-dojo-room.png',nami:'nami-chart-room.png',usopp:'usopp-inventors-workshop.png',sanji:'sanji-galley-room.png',chopper:'chopper-infirmary-room.png',robin:'robin-ship-library.png',franky:'franky-shipwright-room.png',brook:'brook-music-room.png',jinbe:'jinbe-helm-room.png'};failStart=false;
  for(const [crewId,asset] of Object.entries(roomAssets)){state.settings.reducedMotion=crewId==='chopper';emit();await nav('Missions');await click('.top-action');await wait('Boolean(document.querySelector(".workbench"))');await select('[aria-label="Assigned crewmate"]',crewId);await wait(`document.querySelector(".workbench").dataset.crewId==="${crewId}"`);await fill('.composer textarea',`Fixture-only ${crewId} room preview`);await wait('!document.querySelector(".composer-foot button").disabled');await click('.composer-foot button');await wait('Boolean(document.querySelector(".conversation-room-art"))');await wait('document.querySelector(".conversation-room-art").complete&&document.querySelector(".conversation-room-art").naturalWidth===1536');
   assert.ok(await js(`document.querySelector(".conversation-room-art").src.endsWith("/assets/${asset}")`),`${crewId} opens its own packaged room art`);assert.equal(await js('document.querySelector(".conversation-room-art").getAttribute("aria-hidden")'),'true',`${crewId} art remains decorative`);assert.equal(await js('getComputedStyle(document.querySelector(".conversation-room-art")).opacity'),'0.19',`${crewId} scene stays subdued below chat content`);assert.ok(await js('Boolean(document.querySelector(".composer textarea")&&Array.from(document.querySelectorAll("button")).some(button=>button.getAttribute("aria-label")==="Back to workspace"))'),`${crewId} keeps direct work controls available`);
   if(crewId==='zoro')await screenshot('zoro-dojo-room-working.png');if(crewId==='chopper'){assert.ok(await js('document.querySelector(".workbench").classList.contains("reduce-motion")'),'reduced motion keeps Chopper room static and usable');await screenshot('chopper-infirmary-reduced-motion.png');}await click('[aria-label="Back to workspace"]');await wait('!document.querySelector(".workbench")');
  }
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true}));console.log('SUNNY_WORKFLOW '+JSON.stringify({passed:true,checks:['snapshot-race','family-search','specialist-approval','duplicate-approval','draft-per-task','home-draft-navigation','failed-start-draft','duplicate-start','lazy-tools','folder-parent','editor-load','draft-reload','reconcile','inbox','compact-layout','island-navigation','captain-controlled-map-zoom-keyboard-touch','startup-retry','pending-launch-navigation','dirty-project-switch','dirty-file-task-start','template-cleared-after-start','character-room-theme','room-audio-toggle','room-audio-settings','robin-obsidian-library-route','note-context-unsent-robin-review','robin-note-revision-decision-context','morgans-saved-work-report','morgans-source-navigation','morgans-explicit-obsidian-save','morgans-uncertain-truncated-state','oversized-note-boundary','all-ten-illustrated-crew-rooms','reduced-motion-illustrated-room'],screenshots:output}));
 }catch(error){await screenshot('failure.png').catch(()=>{});fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:false,error:error.stack}));console.error(error);process.exitCode=1;}
 finally{win.destroy();app.exit(process.exitCode||0);}
}).catch(error=>{console.error(error);app.exit(1);});
