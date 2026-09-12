const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('sunny',{invoke:(action,args)=>ipcRenderer.invoke('sunny:invoke',action,args),subscribe:handler=>{const listener=(_event,message)=>handler(message);ipcRenderer.on('sunny:event',listener);return()=>ipcRenderer.removeListener('sunny:event',listener);}});
