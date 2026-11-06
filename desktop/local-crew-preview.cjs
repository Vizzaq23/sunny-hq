// Real local inference in a separate profile. No cloud client or command/file-write IPC.
const {app,BrowserWindow,ipcMain,dialog}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {randomUUID}=require('node:crypto');
const {Hub}=require('./hub.cjs');
const {openOrderedStore}=require('./ordered-store.cjs');
const {createPublicTransport}=require('./public-transport.cjs');
const {createQuitLifecycle}=require('./persistence-lifecycle.cjs');
const root=path.resolve(__dirname,'..'),checking=process.argv.includes('--preview-check');
const profile=path.join(root,'.sunny-dev',checking?'local-crew-preview-check-'+randomUUID():'local-crew-preview-profile');
const modelIndex=process.argv.indexOf('--model'),model=modelIndex<0?'':process.argv[modelIndex+1];
if(modelIndex>=0&&(typeof model!=='string'||!model||model.startsWith('--')))throw Error('Supply a downloaded model after --model.');
const liveCheck=process.argv.includes('--live-reply-check');
if(liveCheck&&(!checking||!model))throw Error('A live reply check requires --preview-check and an explicit downloaded --model.');
app.setName('Sunny · Local Developer Preview');app.setPath('userData',profile);
let hub,win,transport;
if(!app.requestSingleInstanceLock())app.exit(0);app.on('second-instance',()=>{if(win&&!win.isDestroyed()){win.show();win.focus();}});
const quit=createQuitLifecycle({shutdown:async()=>{await hub?.close();},onClosed:()=>app.exit(0),onFailed:error=>dialog.showErrorBox('Local preview could not save',error.message)});
app.on('before-quit',quit.beforeQuit);
ipcMain.handle('sunny:invoke',async(event,action,args={})=>{
 if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Untrusted preview window.');
 if(action==='snapshot')return transport.snapshot();
 if(hub.quiescing)throw Error('The local preview is saving before closing.');
 if(action==='localCrew:models'){
  if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length)throw Error('Invalid model catalog request.');
  return hub.localCrew.models();
 }
 const localActions=new Set(['configure','source','recall','ask','stop','teach','clear']);
 if(typeof action==='string'&&action.startsWith('localCrew:')&&localActions.has(action.slice(10)))return hub.localCrew[action.slice(10)](args);
 if(action==='localCouncil:setup')return hub.localCouncil.setup(args);
 if(action==='localCouncil:report')return hub.localCouncil.report(args);
 if(action==='localCouncil:stopReport')return hub.localCouncil.stopReport(args);
 if(action==='localCouncil:start')return hub.localCouncil.start(args);
 if(action==='localCouncil:stop')return hub.localCouncil.stop(args);
 if(action==='localCouncil:roster'){if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length)throw Error('Invalid roster request.');return hub.localCouncil.roster();}
 if(action==='workspace:get')return hub.state.workspace;
 if(action==='workspace:update')return hub.updateWorkspace(args);
 if(['task:history','library:search','tools:refresh'].includes(action))return [];
 if(['app:diagnostic','asset:crewTexture'].includes(action))return null;
 if(action==='crew:note'){const result=hub.growth.note(args.crewId,args.text,args.id);hub.markDirty();await hub.persist();hub.changed();return result;}
 if(action==='crew:forget'){hub.growth.forget(args.crewId,args.id);hub.markDirty();await hub.persist();hub.changed();return;}
 if(action==='crew:memoryEnabled'){if(typeof args.enabled!=='boolean')throw Error('Choose on or off.');hub.growth.data.enabled=args.enabled;hub.markDirty();await hub.persist();hub.changed();return;}
 if(action==='app:export'){
  const result=await dialog.showSaveDialog(win,{defaultPath:'sunny-local-preview-backup.json',filters:[{name:'Sunny local preview',extensions:['json']}]});
  if(result.canceled)return {};fs.writeFileSync(result.filePath,JSON.stringify({...hub.persistedImage(),exportedAt:new Date().toISOString()},null,2));return {path:result.filePath};
 }
 throw Error('This separate preview supports Crew → Local developer and journal controls. Missions, commands and file edits are available in the main Sunny app.');
});
app.whenReady().then(async()=>{
 fs.mkdirSync(profile,{recursive:true});
 const store=await openOrderedStore({kind:'json',file:path.join(profile,'state.json'),backupDir:path.join(profile,'backups')});
 const client=new EventEmitter();client.connected=false;client.close=()=>{};
 hub=new Hub({home:profile,store,catalog:{discoverProjects:()=>[{id:'sunny-source',name:'Sunny source · read-only advice',path:root}],discoverTools:()=>[],discoverAutomations:()=>[]},fixtureDependencies:{client,islandFactory:()=>({close(){}})}});
 hub.state.world.paused=true;await hub.initializeRecovery();
 if(model){
  if(!(await hub.localCrew.models()).some(entry=>entry.name===model))throw Error('The requested preview model is not downloaded in the running Ollama server.');
  for(const crewId of ['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe'])if(!hub.localCrew.profile(crewId).model)await hub.localCrew.configure({crewId,model,...require('./local-crew.cjs').defaults(crewId)});
 }
 transport=createPublicTransport(hub);hub.on('event',event=>{if(win&&!win.isDestroyed())win.webContents.send('sunny:event',transport.event(event.type,event.data));});
 win=new BrowserWindow({title:'Sunny · Local developer preview · Separate profile',width:1440,height:1000,show:false,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,offscreen:checking}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());win.webContents.session.setPermissionRequestHandler((_wc,_permission,done)=>done(false));
 win.on('close',event=>{if(!quit.completed){event.preventDefault();app.quit();}});
 await win.loadFile(path.join(root,'dist/index.html'));
 await win.webContents.executeJavaScript(`const banner=document.createElement('div');banner.textContent='LOCAL DEVELOPER PREVIEW · Separate saved profile · Real Ollama replies · Read-only source previews';banner.id='local-preview-banner';banner.style.cssText='height:34px;display:flex;align-items:center;justify-content:center;background:#183d31;color:#fff7d8;font:13px Segoe UI';document.body.prepend(banner);const style=document.createElement('style');style.textContent='#root .app-shell,#root .workbench{height:calc(100vh - 34px)}';document.head.append(style);`);
 await win.webContents.executeJavaScript(`(async()=>{const wait=async find=>{for(let n=0;n<100;n++){const result=find();if(result)return result;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Local developer view did not become ready.');};(await wait(()=>Array.from(document.querySelectorAll('.sidebar .main-nav button')).find(button=>button.querySelector('span')?.textContent==='Crew'))).click();(await wait(()=>Array.from(document.querySelectorAll('.crew-card')).find(card=>card.querySelector('h3')?.textContent==='Franky')?.querySelector('.journal-open'))).click();(await wait(()=>Array.from(document.querySelectorAll('.crew-journal nav button')).find(button=>button.textContent==='Local developer'))).click();await wait(()=>document.querySelector('.local-crew-panel'));})()`);
 if(checking){
  if(liveCheck){
   await win.webContents.executeJavaScript(`(async()=>{const input=document.querySelector('[aria-label="Ask your developer"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Synthetic UI check: explain in at most 80 words why a code review needs an empty-input test. Do not claim to run tests or edit files.');input.dispatchEvent(new Event('input',{bubbles:true}));for(let n=0;n<100;n++){const button=document.querySelector('.local-crew-panel button[type=submit]');if(!button.disabled){button.click();return;}await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Local question did not become sendable.');})()`);
   const deadline=Date.now()+130000;let finished=false;
   while(Date.now()<deadline){const session=hub.state.localCrew.profiles.franky.sessions.find(session=>session.projectId==='sunny-source');if(session?.status==='finished'){finished=true;break;}if(session&&['failed','interrupted'].includes(session.status))throw Error(session.error||'Live UI reply did not finish.');await new Promise(resolve=>setTimeout(resolve,100));}
   if(!finished)throw Error('Live UI reply check timed out.');
   await win.webContents.executeJavaScript(`(async()=>{for(let n=0;n<100;n++){if(document.querySelectorAll('.local-crew-messages article').length===2)return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Completed local reply did not render.');})()`);
  }
  const result=await win.webContents.executeJavaScript(`(async()=>{const state=await window.sunny.invoke('snapshot');let commandDenied=false;try{await window.sunny.invoke('terminal:create',{projectId:'sunny-source'});}catch{commandDenied=true;}return {banner:!!document.querySelector('#local-preview-banner'),projects:state.projects.length,cloudStatus:state.codex.status,profiles:Object.keys(state.localCrew.profiles).length,commandDenied};})()`);
  if(!result.banner||result.projects!==1||result.cloudStatus!=='disconnected'||!result.commandDenied)throw Error('Local preview isolation check failed.');
  if(liveCheck){const session=hub.state.localCrew.profiles.franky.sessions.find(session=>session.projectId==='sunny-source');if(session.messages.length!==2||session.messages[1].model!==model)throw Error('Live reply attribution failed.');result.liveReply={syntheticPrompt:true,model,messages:2,answer:session.messages[1].text};}
  await new Promise(resolve=>setTimeout(resolve,300));fs.writeFileSync(path.join(profile,'preview.png'),(await win.webContents.capturePage()).toPNG());
  fs.writeFileSync(path.join(profile,'preview-check.json'),JSON.stringify({...result,passed:true,model,profile},null,2));console.log('SUNNY_LOCAL_PREVIEW '+JSON.stringify({...result,passed:true,profile}));app.quit();
 }else win.show();
}).catch(async error=>{console.error(error);await hub?.close().catch(()=>{});app.exit(1);});
app.on('window-all-closed',()=>app.quit());
