// Isolated diagnostic experiment: no main app, provider, user profile or project.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const diagnostics=require('./diagnostics.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-hang-diagnostic-'));
app.setPath('userData',path.join(root,'profile'));let win;const records=[];
const watchdog=setTimeout(()=>{console.error('Hang diagnostic exceeded 25 seconds');app.exit(1);},25000);
app.whenReady().then(async()=>{
 win=new BrowserWindow({show:false,width:500,height:300,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false}});
 diagnostics.watchRenderer(win.webContents,{surface:'hub',window:win,record:(event,details)=>{records.push({event,details});diagnostics.record(path.join(root,'diagnostics'),event,details);},onGone:()=>{throw Error('Unexpected renderer exit');}});
 await win.loadURL('data:text/html,<title>Sunny isolated hang diagnostic</title><p>Diagnostic fixture</p>');
 await win.webContents.executeJavaScript('const until=performance.now()+9000;while(performance.now()<until){};true');
 await new Promise(resolve=>setTimeout(resolve,1000));
 const result={passed:true,fixtureDirectory:root,electronVersion:process.versions.electron,nodeVersion:process.versions.node,syntheticBusyLoopMs:9000,platformHangEventObserved:records.some(item=>item.event==='renderer-unresponsive'),platformRecoveryEventObserved:records.some(item=>item.event==='renderer-responsive'),records,providerRequests:0};
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(result,null,2));console.log('SUNNY_HANG_DIAGNOSTIC '+JSON.stringify(result));
}).catch(error=>{process.exitCode=1;console.error(error);}).finally(()=>{clearTimeout(watchdog);if(win&&!win.isDestroyed())win.destroy();app.exit(process.exitCode||0);});
