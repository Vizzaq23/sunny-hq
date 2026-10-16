const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {capture}=require('./helpers/copied-capture-fixture.cjs'),packaged=require('../desktop/packaged-acceptance.cjs');
test('actual preload invokes copied local routes through shared trusted sender and main-frame checks',async t=>{
 const {registerTrustedIpc}=require('../desktop/trusted-ipc.cjs'),copied=require('../desktop/copied-profile-acceptance.cjs');
 const fixture=packaged.admitFixture(capture(t).args),hub=await copied.bootCopiedProfile(fixture);let api,handler,probes=0;
 hub.ensure=async()=>{probes++;throw Error('FORBIDDEN_PROVIDER');};hub.client.request=hub.ensure;
 const frame={},webContents={mainFrame:frame},surface={webContents,isDestroyed:()=>false},event={sender:webContents,senderFrame:frame};
 registerTrustedIpc({ipcMain:{handle(channel,fn){assert.equal(channel,'sunny:invoke');handler=fn;}},surfaces:()=>[surface],dispatch:(action,args)=>copied.copiedQuery(hub,action,args)});
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../desktop/preload.cjs'),'utf8'),{require(name){assert.equal(name,'electron');return {contextBridge:{exposeInMainWorld(name,value){assert.equal(name,'sunny');api=value;}},ipcRenderer:{invoke(channel,...args){assert.equal(channel,'sunny:invoke');return handler(event,...args);}}};}});
 try{assert.equal((await api.invoke('task:history',{}))[0].id,'chatgpt:archive-only');assert.equal((await api.invoke('task:readExternalPage',{threadId:'chatgpt:archive-only'})).segments[0].text,'Archive only');assert.deepEqual(await api.invoke('workspace:get',{}),hub.state.workspace);
 for(const action of ['task:externalPage','snapshot','codex:connect','app:importChatGPT','workspace:update','file:read','run:create'])await assert.rejects(api.invoke(action,{}),{code:'COPIED_ACTION_DENIED'});
 await assert.rejects(api.invoke('workspace:get',{extra:true}));await assert.rejects(api.invoke('task:readExternalPage',{threadId:'remote'}),{code:'LOCAL_HISTORY_NOT_FOUND'});
 for(const bad of [{sender:{},senderFrame:frame},{sender:webContents,senderFrame:{} }])await assert.rejects(handler(bad,'workspace:get',{}),/Untrusted window/);assert.equal(probes,0);
 }finally{await hub.close();}
});
