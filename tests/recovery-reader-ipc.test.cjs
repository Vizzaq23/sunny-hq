const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events');
test('dedicated preload has exactly immutable bootstrap and six hardcoded query methods',async()=>{
 const calls=[],exposed={},bootstrap={version:1,mode:'recovery-reader',epoch:'fixture',buildIdentity:'a'.repeat(64),capabilities:{editing:false,dispatch:false,providers:false,sourceWrites:false}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../desktop/recovery-reader-preload.cjs'),'utf8'),{require(name){assert.equal(name,'electron');return {contextBridge:{exposeInMainWorld:(name,value)=>{exposed[name]=value;}},ipcRenderer:{sendSync(channel,...args){calls.push([channel,...args]);return bootstrap;},invoke(...args){calls.push(args);return Promise.resolve({});}}};}});
 const bridge=exposed.sunnyRecovery;assert.deepEqual(Object.keys(exposed),['sunnyRecovery']);assert.deepEqual(Object.keys(bridge).sort(),['bootstrap','localHistoryIndex','localHistoryPage','runInspection','snapshot','transcriptPage','workspace']);assert.ok(Object.isFrozen(bridge)&&Object.isFrozen(bridge.bootstrap)&&Object.isFrozen(bridge.bootstrap.capabilities));
 for(const [method,action,args]of [['snapshot','snapshot',[]],['workspace','workspace:get',[]],['transcriptPage','transcript:page',[{taskId:'t'}]],['runInspection','run:inspect',[{runId:'r'}]],['localHistoryIndex','task:history',[]],['localHistoryPage','task:readExternalPage',[{threadId:'h'}]]]){await bridge[method](...args);assert.equal(calls.at(-1)[0],'sunny:recovery:query');assert.equal(calls.at(-1)[1],action);}
 await assert.rejects(bridge.snapshot('task:start'));await assert.rejects(bridge.transcriptPage({},'ordinary-channel'));assert.equal(calls.length,7);
});
test('invalid or absent bootstrap exposes no ordinary or recovery bridge',()=>{
 for(const bootstrap of [null,{}, {version:1,mode:'ordinary'}, {version:1,mode:'recovery-reader',epoch:'e',buildIdentity:'a'.repeat(64),capabilities:{editing:true}}]){let calls=0;assert.throws(()=>vm.runInNewContext(fs.readFileSync(require.resolve('../desktop/recovery-reader-preload.cjs'),'utf8'),{require:()=>({contextBridge:{exposeInMainWorld(){calls++;}},ipcRenderer:{sendSync:()=>bootstrap}})}),{message:'RECOVERY_PRELOAD_FAILED'});assert.equal(calls,0);}
});

test('bootstrap and exposure failures reach the main preload failure lifecycle with a fixed error and nonzero exit',async()=>{
 for(const failure of ['bootstrap','sync','exposure']){
  const app=new EventEmitter(),ipcMain=new EventEmitter(),paths=new Map(),exits=[],windows=[],errors=[];let closed=0;
  Object.assign(app,{setName(){},setPath:(key,value)=>paths.set(key,value),getPath:key=>paths.get(key),commandLine:{appendSwitch(){}},requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve(),exit:code=>exits.push(code)});
  ipcMain.handle=()=>{};ipcMain.removeHandler=()=>{};
  const bootstrap={version:1,mode:'recovery-reader',epoch:'e',buildIdentity:'a'.repeat(64),capabilities:{editing:false,dispatch:false,providers:false,sourceWrites:false}};
  class Window extends EventEmitter{constructor(){super();this.webContents=new EventEmitter();this.webContents.mainFrame={};this.webContents.setWindowOpenHandler=()=>{};windows.push(this);}isDestroyed(){return false;}async loadFile(){
   try{vm.runInNewContext(fs.readFileSync(require.resolve('../desktop/recovery-reader-preload.cjs'),'utf8'),{require:()=>({contextBridge:{exposeInMainWorld(){throw Error('SECRET_EXPOSURE_DETAIL');}},ipcRenderer:{sendSync(){if(failure==='sync')throw Error('SECRET_SYNC_DETAIL');return failure==='bootstrap'?null:bootstrap;}}})});}
   catch(error){errors.push(error);this.webContents.emit('preload-error',{},'fixed-preload',error);}
  }show(){}}
  const sandbox={module:{exports:{}},process:new EventEmitter(),__dirname:'/fixed/desktop',console:{error(){}},require(name){if(name==='./recovery-reader-guard.cjs')return {assertAdmission(){}};if(name==='electron')return {app,BrowserWindow:Window,ipcMain,session:{fromPartition:()=>({setPermissionRequestHandler(){},setPermissionCheckHandler(){},on(){},webRequest:{onBeforeRequest(){}}})}};if(name==='./recovery-reader.cjs')return {openRecoveryReader:()=>({metadata:bootstrap,close(){closed++;}})};if(name==='./recovery-reader-ipc.cjs')return {registerRecoveryIpc:()=>()=>{}};return require(name);}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../desktop/recovery-reader-main.cjs'),'utf8'),sandbox);sandbox.module.exports.start({runtimeDir:'/private',epoch:'e'});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(errors.length,1,failure);assert.equal(errors[0].message,'RECOVERY_PRELOAD_FAILED');assert.equal(errors[0].cause,undefined);assert.equal(sandbox.process.exitCode,75);assert.equal(exits.at(-1),75);assert.equal(closed,1);
 }
});
test('main independently denies foreign frames, pre-bootstrap requests, extra args and stale navigation',async()=>{
 const ipcMain=new EventEmitter(),handlers=new Map();ipcMain.handle=(name,handler)=>handlers.set(name,handler);ipcMain.removeHandler=name=>handlers.delete(name);
 const webContents=new EventEmitter();webContents.mainFrame={url:'file:///fixed/recovery-reader.html'};const window={webContents,isDestroyed:()=>false};let queries=0;
 const dispose=require('../desktop/recovery-reader-ipc.cjs').registerRecoveryIpc({ipcMain,window,documentUrl:webContents.mainFrame.url,reader:{metadata:{epoch:'e',buildIdentity:'a'.repeat(64)},query(action,args){queries++;assert.equal(action,'snapshot');assert.deepEqual(args,{});return {value:'inert'};}}});
 assert.deepEqual([...handlers.keys()],['sunny:recovery:query']);const query=handlers.get('sunny:recovery:query'),event={sender:webContents,senderFrame:webContents.mainFrame};
 await assert.rejects(query(event,'snapshot',{}));ipcMain.emit('sunny:recovery:bootstrap',{...event,senderFrame:{url:webContents.mainFrame.url}});await assert.rejects(query(event,'snapshot',{}));
 ipcMain.emit('sunny:recovery:bootstrap',event);assert.equal(event.returnValue.mode,'recovery-reader');assert.deepEqual(await query(event,'snapshot',{}),{value:'inert'});
 await assert.rejects(query({...event,senderFrame:{}},'snapshot',{}));await assert.rejects(query(event,'snapshot',{},'extra'));webContents.emit('did-start-navigation',{},webContents.mainFrame.url,false,true);await assert.rejects(query(event,'snapshot',{}));assert.equal(queries,1);dispose();assert.equal(handlers.size,0);
});
test('earliest recovery entry denies forged direct launch before fixture, storage and ordinary imports',()=>{
 const source=fs.readFileSync(require.resolve('../desktop/main.cjs'),'utf8'),imports=[],process={argv:['Sunny HQ.exe','--recovery-reader','--packaged-fixture=forged']};
 vm.runInNewContext(source,{process,require(name){imports.push(name);assert.equal(name,'./recovery-reader-guard.cjs');return {start(){}};}});assert.deepEqual(imports,['./recovery-reader-guard.cjs']);
 const entry=fs.readFileSync(require.resolve('../src/recovery-main.tsx'),'utf8');assert.doesNotMatch(entry,/useSunny|Companion|from ['"]\.\/App/);
});
test('terminal query failure remains sticky in main until a nonzero actual exit request',async()=>{
 const app=new EventEmitter(),ipcMain=new EventEmitter(),handlers=new Map(),paths=new Map(),exits=[],windows=[];
 Object.assign(app,{setName(){},setPath:(k,v)=>paths.set(k,v),getPath:k=>paths.get(k),commandLine:{appendSwitch(){}},requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve(),exit:code=>exits.push(code),quit(){app.emit('before-quit');},});
 ipcMain.handle=(name,handler)=>handlers.set(name,handler);ipcMain.removeHandler=name=>handlers.delete(name);
 class Window extends EventEmitter{constructor(){super();this.webContents=new EventEmitter();this.webContents.mainFrame={url:'file:///fixed/dist/recovery-reader.html'};this.webContents.setWindowOpenHandler=()=>{};windows.push(this);}isDestroyed(){return false;}async loadFile(file){this.webContents.mainFrame.url=require('node:url').pathToFileURL(file).href;}show(){}}
 let closed=0;const reader={metadata:{epoch:'e',buildIdentity:'a'.repeat(64)},close(){closed++;},query(){throw Object.assign(Error('SECRET_ERROR'),{code:'RECOVERY_QUERY_INVALID'});}};
 const sandbox={module:{exports:{}},process:new EventEmitter(),__dirname:'/fixed/desktop',console:{error(){}},require(name){if(name==='./recovery-reader-guard.cjs')return {assertAdmission(){}};if(name==='electron')return {app,BrowserWindow:Window,ipcMain,session:{fromPartition:()=>({setPermissionRequestHandler(){},setPermissionCheckHandler(){},on(){},webRequest:{onBeforeRequest(){}}})}};if(name==='./recovery-reader.cjs')return {openRecoveryReader:()=>reader};if(name==='./recovery-reader-ipc.cjs')return require('../desktop/recovery-reader-ipc.cjs');return require(name);}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../desktop/recovery-reader-main.cjs'),'utf8'),sandbox);sandbox.module.exports.start({runtimeDir:'/private',epoch:'e'});await new Promise(resolve=>setImmediate(resolve));
 const wc=windows[0].webContents,event={sender:wc,senderFrame:wc.mainFrame};ipcMain.emit('sunny:recovery:bootstrap',event);await assert.rejects(handlers.get('sunny:recovery:query')(event,'snapshot',{}));assert.equal(sandbox.process.exitCode,75);app.emit('window-all-closed');assert.equal(exits.at(-1),75);assert.equal(closed,0);app.emit('before-quit');assert.ok(closed>0);assert.equal(exits.at(-1),75);
});
