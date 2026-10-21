// Synthetic native responsiveness measurements; no provider, real project or user profile.
const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {performance,monitorEventLoopDelay}=require('node:perf_hooks');
const {broadcast}=require('./broadcast.cjs');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-ipc-performance-'));
app.setPath('userData',path.join(directory,'profile'));
const watchdog=setTimeout(()=>{console.error('Synthetic IPC fixture exceeded60seconds');app.exit(1);},60000);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pending=new Map();let win,sequence=0,requests=0;
const state={projects:[{id:'fixture',name:'Synthetic performance fixture',path:directory,category:'development'}],tasks:[],settings:{reducedMotion:true,notifications:false},codex:{status:'fixture',error:'Synthetic performance fixture — no provider runs'},approvals:[],models:[],tools:[],automations:[],usage:null,world:{paused:true,residents:[],jobs:[],ledger:[]}};
function tasks(count,messages=16){return Array.from({length:count},(_,i)=>({id:'fixture-'+i,title:'Synthetic goal '+i,projectId:'fixture',crewId:'franky',status:i===0?'unknown':'finished',createdAt:i,updatedAt:i,messages:Array.from({length:messages},(_,n)=>({id:'message-'+n,role:'assistant',text:'Synthetic '.repeat(102).slice(0,1024),time:n}))}));}
ipcMain.handle('sunny:invoke',async(event,action,args={})=>{
 if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Untrusted fixture sender');
 if(action==='snapshot')return state;
 if(action==='asset:crewTexture'||action==='app:diagnostic')return null;
 if(action==='fixture:ack'){const entry=pending.get(args.token);if(entry){pending.delete(args.token);clearTimeout(entry.timer);entry.resolve(performance.now()-entry.start);}return;}
 requests++;throw Error('No provider or privileged work permitted in performance fixture');
});
function percentile(values,p){const sorted=[...values].sort((a,b)=>a-b);return Number(sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)].toFixed(3));}
async function send(type,data){const token=++sequence;const result=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(token);reject(Error('Renderer acknowledgement timed out'));},10000);pending.set(token,{resolve,reject,timer,start:performance.now()});});const start=performance.now();broadcast([win],type,data);const sendMs=performance.now()-start;win.webContents.send('sunny:event',{type:'fixture:measure',data:{token}});return{sendMs,ackMs:await result};}
app.whenReady().then(async()=>{
 win=new BrowserWindow({width:1440,height:1000,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 await win.loadFile(path.join(__dirname,'../dist/index.html'));win.showInactive();
 await delay(300);
 await win.webContents.executeJavaScript(`window.__fixtureLags=[];let last=performance.now();window.__fixtureHeartbeat=setInterval(()=>{const now=performance.now();window.__fixtureLags.push(Math.max(0,now-last-20));last=now;},20);window.__fixtureSubscribe=window.sunny.subscribe(event=>{if(event.type==='fixture:measure')requestAnimationFrame(()=>requestAnimationFrame(()=>window.sunny.invoke('fixture:ack',{token:event.data.token})));});void 0;`);
 const loop=monitorEventLoopDelay({resolution:10});loop.enable();const scenarios=[];
 for(const count of [100,1000,3000]){
  state.tasks=tasks(count);const bytes=Buffer.byteLength(JSON.stringify(state));await send('snapshot',state);await delay(150);loop.reset();await win.webContents.executeJavaScript('window.__fixtureLags=[]');
  const samples=[];for(let i=0;i<5;i++)samples.push(await send('snapshot',state));
  const rendererLags=await win.webContents.executeJavaScript('window.__fixtureLags');
  scenarios.push({kind:'full-snapshot',tasks:count,messagesPerTask:16,bytes,samples,sendP50Ms:percentile(samples.map(s=>s.sendMs),.5),sendP95Ms:percentile(samples.map(s=>s.sendMs),.95),renderAckP50Ms:percentile(samples.map(s=>s.ackMs),.5),renderAckP95Ms:percentile(samples.map(s=>s.ackMs),.95),mainLoopMaxMs:Number((loop.max/1e6).toFixed(3)),rendererHeartbeatMaxLagMs:Number(Math.max(0,...rendererLags).toFixed(3))});
 }
 state.tasks=tasks(100);const streamed=tasks(1,2000)[0];state.tasks[0]=streamed;await send('snapshot',state);await delay(150);loop.reset();await win.webContents.executeJavaScript('window.__fixtureLags=[]');
 const samples=[];for(let i=0;i<10;i++){streamed.messages.at(-1).text+=' fixture delta';samples.push(await send('task',streamed));await delay(50);}
 scenarios.push({kind:'stream-task',tasks:100,messagesInUpdatedTask:2000,bytes:Buffer.byteLength(JSON.stringify(streamed)),samples,sendP95Ms:percentile(samples.map(s=>s.sendMs),.95),renderAckP95Ms:percentile(samples.map(s=>s.ackMs),.95),mainLoopMaxMs:Number((loop.max/1e6).toFixed(3)),rendererHeartbeatMaxLagMs:await win.webContents.executeJavaScript('Math.max(0,...window.__fixtureLags)')});
 const result={measuredUtc:new Date().toISOString(),synthetic:true,providerRequests:requests,electron:process.versions.electron,node:process.versions.node,sourceBuild:JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/build-info.json'),'utf8')),scenarios,memory:process.memoryUsage(),fixtureDirectory:directory};
 fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify(result,null,2));console.log('SUNNY_IPC_PERFORMANCE '+JSON.stringify(result));loop.disable();
}).catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{clearTimeout(watchdog);for(const p of pending.values())clearTimeout(p.timer);if(win&&!win.isDestroyed())win.destroy();app.exit(process.exitCode||0);});
