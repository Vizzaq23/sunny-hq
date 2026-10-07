'use strict';
const failure=()=>Object.assign(Error('RECOVERY_READ_ONLY'),{code:'RECOVERY_READ_ONLY'});
function registerRecoveryIpc({ipcMain,window,documentUrl,reader,onFailure=()=>{}}){
 const webContents=window.webContents;
 let bootstrapped=false,disposed=false;
 const trusted=event=>!disposed&&!window.isDestroyed()&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&event.senderFrame.url===documentUrl;
 const bootstrap={version:1,mode:'recovery-reader',epoch:reader.metadata.epoch,buildIdentity:reader.metadata.buildIdentity,capabilities:{editing:false,dispatch:false,providers:false,sourceWrites:false}};
 const handshake=(event,...args)=>{if(!trusted(event)||bootstrapped||args.length){event.returnValue=null;return;}bootstrapped=true;event.returnValue=bootstrap;};
 const navigation=(_event,_url,inPlace,mainFrame)=>{if(mainFrame&&!inPlace)bootstrapped=false;};
 ipcMain.on('sunny:recovery:bootstrap',handshake);
 ipcMain.handle('sunny:recovery:query',async(event,...args)=>{
  if(!trusted(event)||!bootstrapped||args.length!==2)throw failure();
  try{return await reader.query(args[0],args[1]);}catch(error){onFailure();if(['RECOVERY_READ_ONLY','RECOVERY_CLOSED','RECOVERY_QUERY_INVALID'].includes(error?.code))throw Error(error.code);throw Error('RECOVERY_QUERY_INVALID');}
 });
 webContents.on('did-start-navigation',navigation);
 return ()=>{if(disposed)return;disposed=true;bootstrapped=false;ipcMain.removeListener('sunny:recovery:bootstrap',handshake);ipcMain.removeHandler('sunny:recovery:query');webContents.removeListener('did-start-navigation',navigation);};
}
module.exports={registerRecoveryIpc};
