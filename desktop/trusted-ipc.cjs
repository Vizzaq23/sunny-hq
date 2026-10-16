// One sender/main-frame boundary for the ordinary and admitted copied windows.
function registerTrustedIpc({ipcMain,surfaces,dispatch,companion=()=>undefined}){
 ipcMain.handle('sunny:invoke',async(event,action,args)=>{
  const sender=surfaces().find(surface=>surface&&!surface.isDestroyed()&&event.sender===surface.webContents&&event.senderFrame===surface.webContents.mainFrame);
  if(!sender)throw Error('Untrusted window');
  if(action==='companion:mouse'&&sender!==companion())throw Error('Companion only');
  return dispatch(action,args,sender===companion()?'companion':'hub');
 });
}
module.exports={registerTrustedIpc};
