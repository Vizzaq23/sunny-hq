// Interactive review mode: sample data only. Never constructs Hub or connects to a provider.
const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const profile=process.env.SUNNY_REVIEW_DATA_DIR||path.join(app.getPath('temp'),'sunny-hq-review-0.11.0');
app.setName('Sunny HQ · Upgrade preview');app.setPath('userData',profile);
const now=Date.now();
const task=(id,title,status,crewId,extra={})=>({id,title,status,crewId,projectId:'sample',createdAt:now-300000,updatedAt:now,threadId:'sample-'+id,turnId:'sample-turn-'+id,messages:[],...extra});
const state={projects:[{id:'sample',name:'Sunny Studio · sample',path:profile,category:'development'}],tasks:[
 task('captain','Make the project dashboard easier to use','working','luffy',{captain:true}),
 task('design','Check the dashboard changes','waiting','sanji',{parentTaskId:'captain',messages:[{id:'activity:review',role:'system',text:'Started · Review the dashboard layout',time:now}]}),
 task('recovery','Recover a paused workspace update','unknown','chopper',{error:'Sample connection interrupted. Check status to recover the saved result.'}),
 task('done','Prepare the project handoff','finished','robin',{messages:[{id:'result',role:'assistant',time:now,text:'Sample result: the handoff is ready. Review the project notes, then send the next step. This preview uses sample conversations and never launches AI agents.'}]})
],settings:{reducedMotion:true,notifications:false,routingPolicy:'efficient'},codex:{status:'Sample data',error:'Try sample missions, approvals, and recovery. No agents run and your active Sunny stays separate.'},approvals:[{id:'sample-approval',taskId:'design',method:'item/commandExecution/requestApproval',params:{command:'npm test',reason:'Sample approval for reviewing the flow. No command will run.'}}],models:[],tools:[],automations:[],usage:null,world:{paused:true,residents:[],jobs:[],ledger:[]}};
let win;
const emit=()=>{if(win&&!win.isDestroyed())win.webContents.send('sunny:event',{type:'snapshot',data:state});};
const complete=target=>{setTimeout(()=>{if(target.status!=='working')return;target.status='finished';target.updatedAt=Date.now();target.messages.push({id:'reply-'+Date.now(),role:'assistant',time:Date.now(),text:'Preview result: your request was received. In the live app, your selected crew would work here. No agent, command, or paid service ran in this sample.'});emit();},900);};
ipcMain.handle('sunny:invoke',async(event,action,args={})=>{
 if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Untrusted window');
 if(action==='snapshot')return state;
 if(['app:diagnostic','asset:crewTexture'].includes(action))return null;
 if(['task:history','library:search','tools:refresh'].includes(action))return [];
 if(action==='task:start'){const next=task('sample-'+Date.now(),args.prompt,'working',args.crewId,{captain:args.crewId==='luffy',messages:[{id:'user-'+Date.now(),role:'user',text:args.prompt,time:Date.now()}]});state.tasks.unshift(next);emit();complete(next);return next;}
 if(action==='task:send'){const target=state.tasks.find(t=>t.id===args.taskId);target.status='working';target.messages.push({id:'user-'+Date.now(),role:'user',text:args.prompt,time:Date.now()});emit();complete(target);return;}
 if(action==='task:checkStatus'){const target=state.tasks.find(t=>t.id===args.taskId);target.status='finished';target.error=undefined;target.messages.push({id:'recovered',role:'assistant',text:'Sample recovered result. Checking status did not stop any work.',time:Date.now()});emit();return target;}
 if(action==='task:interrupt'){state.tasks.find(t=>t.id===args.taskId).status='interrupted';emit();return;}
 if(action==='approval:respond'){state.approvals=[];const target=state.tasks.find(t=>t.id==='design');target.status='working';emit();complete(target);return;}
 if(action==='files:list')return [{name:'preview-notes.txt',path:'preview-notes.txt',directory:false}];
 if(action==='files:read')return {path:'preview-notes.txt',text:'Sunny HQ upgrade preview\nSample files only. Your real projects remain in the running app.\n',hash:'sample'};
 if(action==='settings:update'){Object.assign(state.settings,args);emit();return state.settings;}
 throw Error('This is a sample preview. This action is available when the upgrade is activated.');
});
app.whenReady().then(async()=>{
 win=new BrowserWindow({title:'Sunny HQ 0.11.0 · Sample preview',width:1440,height:1000,minWidth:1000,minHeight:700,show:false,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
 await win.loadFile(path.join(__dirname,'../dist/index.html'));
 const banner=`const banner=document.createElement('div');banner.id='review-banner';banner.textContent='LOCAL UPGRADE PREVIEW · Sample data · No agents run · Your active Sunny stays separate';banner.style.cssText='height:30px;display:flex;align-items:center;justify-content:center;background:#183d31;color:#fff7d8;font:12px Segoe UI;';document.body.prepend(banner);const style=document.createElement('style');style.textContent='#root .app-shell,#root .workbench{height:calc(100vh - 30px)}';document.head.append(style);`;
 await win.webContents.executeJavaScript(banner);win.showInactive();
 if(process.argv.includes('--preview-check')){await new Promise(r=>setTimeout(r,600));const status=await win.webContents.executeJavaScript('({home:!!document.querySelector(".home-page"),tasks:document.querySelectorAll(".home-task").length,banner:!!document.querySelector("#review-banner"),overflow:document.documentElement.scrollWidth>innerWidth})');fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(path.join(profile,'preview-check.json'),JSON.stringify(status,null,2));fs.writeFileSync(path.join(profile,'preview.png'),(await win.webContents.capturePage()).toPNG());app.exit(status.home&&status.tasks===3&&status.banner&&!status.overflow?0:1);}
}).catch(error=>{console.error(error);app.exit(1);});
app.on('window-all-closed',()=>app.quit());
