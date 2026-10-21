const path=require('node:path');
async function runCopiedWindow(fixture,{app,BrowserWindow,ipcMain}){
 require('./packaged-acceptance.cjs').assertCopiedFixtureCapability(fixture);
 app.setPath('userData',fixture.profileDir);await app.whenReady();
 let win,activeHub;const keepAlive=()=>{};app.on('window-all-closed',keepAlive);
 require('./trusted-ipc.cjs').registerTrustedIpc({ipcMain,surfaces:()=>[win],dispatch:(action,args)=>require('./copied-profile-acceptance.cjs').copiedQuery(activeHub,action,args)});
 try{return await require('./copied-profile-acceptance.cjs').runCopiedProfile(fixture,{connect:async hub=>{
  activeHub=hub;win=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());win.webContents.session.setPermissionRequestHandler((_sender,_permission,callback)=>callback(false));
  await win.loadFile(path.join(__dirname,'copied-window.html'));
  return {invoke:(action,args)=>win.webContents.executeJavaScript('window.sunny.invoke('+JSON.stringify(action)+','+JSON.stringify(args)+')'),close:()=>{activeHub=undefined;win.destroy();win=undefined;}};
 }});}finally{activeHub=undefined;if(win&&!win.isDestroyed())win.destroy();ipcMain.removeHandler('sunny:invoke');app.removeListener('window-all-closed',keepAlive);}
}
module.exports={runCopiedWindow};
