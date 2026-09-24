const assert=require('node:assert/strict');
const {once}=require('node:events');
const fs=require('node:fs');
const path=require('node:path');
const {app,dialog}=require('electron');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
module.exports=async({win,hub})=>{
 const residents=hub.state.world.residents;
 try{
  hub.state.world.residents=null;hub.changed();await pause(400);
  assert.match(await win.webContents.executeJavaScript('document.body.innerText'),/get your workspace back/);
 }finally{hub.state.world.residents=residents;hub.changed();}
 await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Reload Sunny').click()`);
 for(let attempt=0;attempt<40;attempt++){await pause(250);if(await win.webContents.executeJavaScript('Boolean(document.querySelector(".home-page"))').catch(()=>false))break;}
 assert.ok(await win.webContents.executeJavaScript('Boolean(document.querySelector(".home-page"))'));
 // Crash only this isolated smoke profile's renderer, never a running user's app.
 const now=Date.now();
 const fixtureIds=['recovery-unknown-fixture','recovery-finished-fixture'];
 for(const [index,status] of ['unknown','finished'].entries())hub.state.tasks.push({id:fixtureIds[index],crewId:'franky',projectId:hub.state.projects[0].id,status,title:'Synthetic renderer recovery '+status,threadId:'synthetic-thread-'+status,turnId:'synthetic-turn-'+status,createdAt:now,updatedAt:now,messages:[{id:'recovery-message-'+status,role:'assistant',text:'Synthetic saved evidence '+status,time:now}]});
 hub.changed();
 const savedTasks=JSON.stringify(hub.state.tasks);
 const originalDialog=dialog.showMessageBox;
 let recoveryPrompts=0;
 try{
  dialog.showMessageBox=async(_window,options)=>{
   recoveryPrompts++;
   assert.match(options.detail,/Electron reported:/);
   assert.equal(options.cancelId,1,'Dismissing the dialog must not reload');
   return {response:0};
  };
  const gone=once(win.webContents,'render-process-gone',{signal:AbortSignal.timeout(10000)});
  win.webContents.forcefullyCrashRenderer();
  const [,details]=await gone;
  assert.equal(recoveryPrompts,1,'The production recovery handler should offer one reload');
  for(let attempt=0;attempt<60;attempt++){
   await pause(250);
   if(await win.webContents.executeJavaScript('Boolean(document.querySelector(".home-page"))').catch(()=>false))break;
  }
  assert.ok(await win.webContents.executeJavaScript('Boolean(document.querySelector(".home-page"))'));
  assert.equal(JSON.stringify(hub.state.tasks),savedTasks,'A renderer reload must not restart or rewrite tasks');
  const rendererTasks=await win.webContents.executeJavaScript('window.sunny.invoke("snapshot").then(s=>s.tasks)');
  assert.deepEqual(rendererTasks,JSON.parse(savedTasks));
  const log=fs.readFileSync(path.join(app.getPath('userData'),'diagnostics','startup.log'),'utf8');
  assert.ok(log.includes('renderer-gone '+JSON.stringify({reason:details.reason,exitCode:details.exitCode})));
  console.log('SUNNY_RECOVERY '+JSON.stringify({renderFailureVisible:true,reloadRestoresHome:true,actualRendererExit:details,taskStatePreserved:true,reconnectedSnapshot:true}));
 }finally{dialog.showMessageBox=originalDialog;hub.state.tasks=hub.state.tasks.filter(task=>!fixtureIds.includes(task.id));hub.changed();}
};
