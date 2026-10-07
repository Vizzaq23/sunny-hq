'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// This internal one-shot synchronous handshake finishes before page scripts.
// There is no public bootstrap method or generic action/channel selector.
try{
 const b=ipcRenderer.sendSync('sunny:recovery:bootstrap');
 if(!b||Object.keys(b).sort().join(',')!=='buildIdentity,capabilities,epoch,mode,version'||b.version!==1||b.mode!=='recovery-reader'||typeof b.epoch!=='string'||!b.epoch||!/^[a-f0-9]{64}$/.test(b.buildIdentity)||!b.capabilities||Object.keys(b.capabilities).sort().join(',')!=='dispatch,editing,providers,sourceWrites'||Object.values(b.capabilities).some(v=>v!==false))throw Error();
 const bootstrap=Object.freeze({...b,capabilities:Object.freeze({...b.capabilities})});
 const noargs=(action,args)=>{if(args.length)return Promise.reject(Error('RECOVERY_QUERY_INVALID'));return ipcRenderer.invoke('sunny:recovery:query',action,{});};
 const request=(action,args)=>{if(args.length!==1)return Promise.reject(Error('RECOVERY_QUERY_INVALID'));return ipcRenderer.invoke('sunny:recovery:query',action,args[0]);};
 contextBridge.exposeInMainWorld('sunnyRecovery',Object.freeze({bootstrap,
  snapshot:(...args)=>noargs('snapshot',args),workspace:(...args)=>noargs('workspace:get',args),
  transcriptPage:(...args)=>request('transcript:page',args),runInspection:(...args)=>request('run:inspect',args),
  localHistoryIndex:(...args)=>noargs('task:history',args),localHistoryPage:(...args)=>request('task:readExternalPage',args)
 }));
}catch{throw Error('RECOVERY_PRELOAD_FAILED');}
