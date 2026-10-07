'use strict';
function start(admission){
 require('./recovery-reader-guard.cjs').assertAdmission(admission);
 const {app,BrowserWindow,session,ipcMain}=require('electron'),path=require('node:path'),{pathToFileURL}=require('node:url');
 let failed=false,reader,window,dispose;
 const rememberFailure=()=>{failed=true;process.exitCode=75;};
 const fail=error=>{rememberFailure();if(error instanceof Error)console.error(error);try{dispose?.();reader?.close();}finally{app.exit(75);}};
 // All directories were created and admitted by native before Electron ready.
 app.setName('Sunny Recovery');
 for(const [key,name]of Object.entries({userData:'userData',sessionData:'cache',temp:'temp',logs:'logs',crashDumps:'crash'})){const value=path.join(admission.runtimeDir,name);app.setPath(key,value);if(app.getPath(key)!==value)throw Error('RECOVERY_RUNTIME_INVALID');}
 app.commandLine.appendSwitch('disable-breakpad');app.commandLine.appendSwitch('disable-component-update');
 if(!app.requestSingleInstanceLock()){process.exitCode=76;app.exit(76);return;}
 process.on('uncaughtException',fail);process.on('unhandledRejection',fail);
 app.on('before-quit',()=>{dispose?.();dispose=undefined;reader?.close();if(failed)app.exit(75);});
 app.on('window-all-closed',()=>{if(failed)app.exit(75);else app.quit();});
 // Any constructed database closes synchronously in the adapter's finally.
 try{reader=require('./recovery-reader.cjs').openRecoveryReader(admission);}catch{return fail();}
 void app.whenReady().then(async()=>{
  const partition=session.fromPartition('sunny-recovery-'+admission.epoch,{cache:false}),dist=path.resolve(__dirname,'../dist'),document=path.join(dist,'recovery-reader.html'),documentUrl=pathToFileURL(document).href,assetPrefix=pathToFileURL(path.join(dist,'assets')+path.sep).href;
  partition.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));partition.setPermissionCheckHandler(()=>false);
  partition.on('will-download',event=>event.preventDefault());
  partition.webRequest.onBeforeRequest((details,callback)=>callback({cancel:details.url!==documentUrl&&!details.url.startsWith(assetPrefix)}));
  window=new BrowserWindow({title:'Sunny Recovery — saved logbook',width:1150,height:820,show:false,webPreferences:{preload:path.join(__dirname,'recovery-reader-preload.cjs'),session:partition,contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true,devTools:false}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());window.webContents.on('will-attach-webview',event=>event.preventDefault());
  window.webContents.on('render-process-gone',fail);window.webContents.on('preload-error',fail);window.on('unresponsive',fail);
  window.webContents.on('console-message',details=>{if(details.level==='error')rememberFailure();});
  dispose=require('./recovery-reader-ipc.cjs').registerRecoveryIpc({ipcMain,window,documentUrl,reader,onFailure:rememberFailure});
  await window.loadFile(document);window.show();
 }).catch(fail);
}
module.exports={start};
