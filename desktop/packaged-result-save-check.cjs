// Offline, hidden Electron fixture against an explicit package's modules and renderer.
// This checks package contents, not the daily installation or production recovery dialog.
const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {once}=require('node:events');
const [packageRoot,fixtureRoot,phase]=process.argv.slice(2);
if(!packageRoot||!fixtureRoot||!['write','verify'].includes(phase))throw Error('Provide package root, disposable fixture root, and write/verify phase.');
const archive=path.join(path.resolve(packageRoot),'resources','app.asar'),root=path.resolve(fixtureRoot);
assert.ok(fs.existsSync(archive));fs.mkdirSync(root,{recursive:true});app.setPath('userData',path.join(root,'electron'));
const {Hub}=require(path.join(archive,'desktop/hub.cjs'));
const {SqliteStore,hash}=require(path.join(archive,'desktop/core.cjs'));
const vault=path.join(root,'vault');fs.mkdirSync(vault,{recursive:true});
const store=new SqliteStore(path.join(root,'fixture.sqlite'));
if(phase==='write'){
 assert.equal(store.load().tasks,undefined,'Write phase requires a new isolated profile');
 store.save({projects:[{id:'fixture',name:'Synthetic package recovery',path:root}],tasks:[{id:'result',projectId:'fixture',crewId:'morgans',title:'Reviewed fixture report',status:'finished',createdAt:1,updatedAt:1,messages:[{id:'answer',role:'assistant',text:'Synthetic reviewed report.',time:1}]},{id:'uncertain',projectId:'fixture',crewId:'franky',title:'Synthetic uncertain task',status:'working',threadId:'fixture-thread',createdAt:1,updatedAt:1,messages:[]}]});
}
const hub=new Hub({home:root,store,catalog:{discoverProjects:()=>[],discoverTools:()=>[],discoverAutomations:()=>[],vaultPath:()=>vault}});
let providerCalls=0;hub.client.request=async()=>{providerCalls++;throw Error('Offline package fixture forbids provider requests');};
let win;
const watchdog=setTimeout(()=>{console.error('Package fixture exceeded 60 seconds');app.exit(1);},60000);
app.whenReady().then(async()=>{
 if(phase==='write'){
  const saved=hub.resultSaves.save({taskId:'result',messageId:'answer',title:'Package recovery report',text:'Synthetic captain-reviewed report.',reviewed:true});
  fs.writeFileSync(path.join(root,'intent.json'),JSON.stringify({id:saved.id,path:saved.path,receipt:saved.receipt}));
  console.log('PACKAGED_SAVE_CHECKPOINT '+saved.id);app.exit(73);return;
 }
 const expected=JSON.parse(fs.readFileSync(path.join(root,'intent.json'),'utf8'));
 assert.equal(hub.task('uncertain').status,'unknown');assert.equal(hub.gate.active.has('uncertain'),true);
 const saved=hub.resultSaves.recover({saveId:expected.id});assert.deepEqual(saved.receipt,expected.receipt);
 assert.equal(saved.path,expected.path);const original=fs.readFileSync(saved.path);assert.equal(hash(original),saved.receipt.sha256);
 const backup=require(path.join(archive,'desktop/backup.cjs')).createBackup(hub);assert.deepEqual(backup.resultSaves[0].receipt,saved.receipt);
 win=new BrowserWindow({width:1200,height:900,show:false,webPreferences:{offscreen:true,backgroundThrottling:false,contextIsolation:true,sandbox:true,nodeIntegration:false,preload:path.join(archive,'desktop/preload.cjs')}});
 ipcMain.handle('sunny:invoke',(event,action,args)=>{
  assert.equal(event.sender,win.webContents);assert.equal(event.senderFrame,win.webContents.mainFrame);
  if(action==='snapshot')return hub.state;
  if(action==='result:recover')return hub.resultSaves.recover(args);
  if(action==='app:diagnostic'||action==='asset:crewTexture')return null;
  throw Error('Unexpected fixture action: '+action);
 });
 hub.on('event',event=>win.webContents.send('sunny:event',event));
 const js=code=>win.webContents.executeJavaScript(code);
 const wait=async expression=>{for(let i=0;i<100;i++){if(await js(expression))return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('UI timeout: '+expression);};
 const openHistory=async()=>{await wait('Boolean(document.querySelector(".home-page"))');await js('Array.from(document.querySelectorAll(".sidebar button")).find(b=>b.textContent.includes("Morgans")).click()');await wait('Boolean(document.querySelector(".result-save-history"))');};
 await win.loadFile(path.join(archive,'dist/index.html'));await openHistory();
 assert.ok((await js('document.querySelector(".result-save-history").textContent')).includes(expected.path));
 fs.writeFileSync(saved.path,'Synthetic external edit');assert.throws(()=>hub.resultSaves.recover({saveId:saved.id}),/conflict|changed/);
 await wait('document.querySelector(".result-save-history").textContent.includes("Needs recovery")');
 fs.writeFileSync(saved.path,original);hub.resultSaves.recover({saveId:saved.id});
 await wait('document.querySelector(".result-save-history strong").textContent==="Saved"');
 const before=JSON.stringify(hub.state.tasks);const gone=once(win.webContents,'render-process-gone',{signal:AbortSignal.timeout(10000)});
 win.webContents.forcefullyCrashRenderer();const [,exit]=await gone;await win.loadFile(path.join(archive,'dist/index.html'));await openHistory();
 assert.equal(JSON.stringify(hub.state.tasks),before);assert.equal(fs.readdirSync(path.join(vault,'00 Inbox')).length,1);assert.equal(providerCalls,0);assert.equal(win.isVisible(),false);
 const result={passed:true,packageRoot:path.resolve(packageRoot),asarSha256:hash(require('original-fs').readFileSync(archive)),saveId:saved.id,notePath:saved.path,receipt:saved.receipt,providerCalls,rendererExit:exit,hidden:true,checks:['SQLite process restart','exact receipt and backup','uncertain task reservation','visible saved and needs recovery','conflict recovery without duplicate','renderer crash and reload']};
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(result,null,2));console.log('PACKAGED_RESULT_SAVE '+JSON.stringify(result));hub.close();clearTimeout(watchdog);app.exit(0);
}).catch(error=>{console.error(error.stack);try{hub.close();}catch{}app.exit(1);});
