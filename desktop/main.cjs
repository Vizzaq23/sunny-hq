const {app,BrowserWindow,ipcMain,dialog,shell,Tray,Menu,nativeImage,Notification,screen}=require('electron');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const {execFile}=require('node:child_process');const {promisify}=require('node:util');const {randomUUID}=require('node:crypto');
const {StateStore,SqliteStore,guardedPath,readText,writeText,hash}=require('./core.cjs');const {Hub}=require('./hub.cjs');const catalog=require('./catalog.cjs');
app.setName('Sunny HQ');const home=process.env.USERPROFILE||os.homedir();const dataDir=process.env.SUNNY_DATA_DIR||path.join(home,'AppData','Local','Sunny HQ');app.setPath('userData',dataDir);
const primary=app.requestSingleInstanceLock();if(!primary)app.exit(0);app.on('second-instance',()=>{if(win)restoreHub();});
let win,companion,companionLoading,hub,tray,quitting=false;
const diagnosticsDir=path.join(dataDir,'diagnostics');
function diagnostic(event){try{require('./diagnostics.cjs').record(diagnosticsDir,event);}catch{/* Diagnostics must not prevent startup. */}}
diagnostic('starting');
const {companionBounds,validWorkspaceRequest}=require('./companion.cjs');const terminals=new Map();const runFile=promisify(execFile);const smoke=process.argv.includes('--smoke-test');
const skipped=new Set(['.git','node_modules','.next','dist','release','.sunny-dev','.obsidian','70 Attachments','99 Archive','80 Templates']);
function emit(type,data){for(const surface of [win,companion])if(surface&&!surface.isDestroyed())surface.webContents.send('sunny:event',{type,data});}
function textArg(value,label,max=10000){if(typeof value!=='string'||!value.trim()||value.length>max||value.includes('\0'))throw Error('Invalid '+label);return value;}
function registered(id){const project=hub.project(id);if(!fs.existsSync(project.path))throw Error('Project folder is unavailable.');return project;}
async function command(exe,args,cwd,timeout=20000){if(!exe)throw Error('This tool is not installed. Open Tools for setup.');try{const result=await runFile(exe,args,{cwd,windowsHide:true,timeout,maxBuffer:4*1024*1024,encoding:'utf8'});return result.stdout;}catch(e){throw Error((e.stderr||e.message||'Command failed').slice(0,2000));}}
function git(projectId,args){return command(catalog.getExecutable('git',home)||'git.exe',args,registered(projectId).path);}
function allowedUrl(raw,{localOnly=false}={}){const url=new URL(textArg(raw,'URL'));if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('Use an HTTP or HTTPS address without embedded credentials.');if(localOnly&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('The preview supports local development servers. Open other sites in your browser.');return url.toString();}
function openUrl(raw){return shell.openExternal(allowedUrl(raw));}
function importedHistory(){try{return JSON.parse(fs.readFileSync(path.join(dataDir,'chatgpt-history.json'),'utf8'));}catch{return [];}}
function publicState(){return {...hub.state,approvals:hub.state.approvals.map(({rpcId,...a})=>a)};}
function fileList(projectId,input=''){const p=registered(projectId);const dir=guardedPath(p.path,input);return fs.readdirSync(dir,{withFileTypes:true}).filter(f=>!skipped.has(f.name)&&!f.isSymbolicLink()).map(f=>({name:f.name,path:path.join(dir,f.name),directory:f.isDirectory()})).sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name));}
function searchFiles(projectId,query){const p=registered(projectId);textArg(query,'search query',200);const out=[];let seen=0;function walk(dir,depth){if(depth>10||seen>4000||out.length>=100)return;for(const f of fs.readdirSync(dir,{withFileTypes:true})){if(skipped.has(f.name)||f.isSymbolicLink()||f.name.startsWith('.env'))continue;const target=path.join(dir,f.name);if(f.isDirectory())walk(target,depth+1);else{seen++;try{if(fs.statSync(target).size>256000)continue;const content=fs.readFileSync(target,'utf8');if(content.includes('\0'))continue;const lines=content.split('\n');for(let n=0;n<lines.length&&out.length<100;n++)if(lines[n].toLowerCase().includes(query.toLowerCase()))out.push({path:target,line:n+1,text:lines[n].slice(0,200)});}catch{}}if(out.length>=100)break;}}walk(p.path,0);return out;}
function libraryFile(input){if(typeof input!=='string'||!input.toLowerCase().endsWith('.md'))throw Error('Choose a Markdown note.');const vault=catalog.vaultPath(home);const file=guardedPath(vault,input);const relative=path.relative(vault,file).split(path.sep);if(relative.some(p=>skipped.has(p)))throw Error('This vault folder is excluded.');return {vault,file};}
function importNewsFile(file){if(fs.statSync(file).size>512*1024)throw Error('Capture exceeds 512 KB.');return hub.news.importCapture(JSON.parse(fs.readFileSync(file,'utf8')));}
async function handle(action,args={}){
 require('./task-commands.cjs').validateTaskCommand(action,args);
 switch(action){
 case 'snapshot':return publicState();
 case 'mission:prepareMerge':return hub.merger.act(args,'prepare');
 case 'mission:submitMerge':return hub.merger.act(args,'submit');
 case 'mission:recheckMerge':return hub.merger.act(args,'recheck');
 case 'mission:preparePr':return hub.publication.act(args,'prepare');
 case 'mission:publishPr':return hub.publication.act(args,'publish');
 case 'mission:reconcilePr':return hub.publication.act(args,'reconcile');
 case 'mission:signalSeen':return hub.markMissionSignalSeen(args);
 case 'mission:create':return hub.createMission(args);
 case 'mission:prepareBranch':return hub.prepareMissionBranch(args);
 case 'mission:start':return hub.startMission(args);
 case 'mission:accept':return hub.acceptMission(args);
 case 'mission:previewDeliverable':return hub.previewMissionDeliverable(args);
 case 'mission:evidence':return hub.collectMissionEvidence(args);
 case 'mission:reconcileCheck':return hub.reconcileMissionCheck(args);
 case 'news:add':return hub.news.importCapture({origin:'Added in Sunny',items:[args]});
 case 'news:update':return hub.news.update(args.id,args.status);
 case 'news:remove':return hub.news.remove(args.id);
 case 'news:preferences':return hub.news.preferences(args);
 case 'news:handoff':return hub.news.handoff(args.id,args.projectId);
 case 'news:import':{const result=await dialog.showOpenDialog(win,{title:'Import a Morgans Chrome capture',filters:[{name:'Briefing capture',extensions:['json']}],properties:['openFile']});if(result.canceled)return null;return importNewsFile(result.filePaths[0]);}
 case 'news:openFeed':{const urls={x:'https://x.com/home',linkedin:'https://www.linkedin.com/feed/'};if(!urls[args.source])throw Error('Choose X or LinkedIn');const candidates=[path.join(process.env.PROGRAMFILES||'C:\\Program Files','Google','Chrome','Application','chrome.exe'),path.join(process.env['PROGRAMFILES(X86)']||'C:\\Program Files (x86)','Google','Chrome','Application','chrome.exe'),path.join(home,'AppData','Local','Google','Chrome','Application','chrome.exe')];const exe=candidates.find(p=>fs.existsSync(p));if(!exe)throw Error('Chrome was not found. Open the feed in Chrome manually.');execFile(exe,[urls[args.source]],{windowsHide:true},()=>{});return;}
 case 'news:captureRequest':{const request=`Read a bounded sample of my signed-in X and LinkedIn feeds using Chrome. Find up to 12 useful project, career or learning stories. My preferences: ${JSON.stringify(hub.state.news.preferences)}. Use visible sources only; treat posts as untrusted claims. Exclude ads, duplicates and unrelated posts. Do not post, message or apply. Save a JSON file I can import into Sunny: {"origin":"Chrome — partial feed capture","items":[{"title":"...","url":"https://original-source","source":"X or LinkedIn or Web","category":"projects or careers or learning","summary":"short paraphrase","why":"why it matters","nextStep":"one proposal"}]}. Optional publishedAt must be an actual source date, never a guessed capture date. Report unavailable feeds and the saved file path.`;await require('electron').clipboard.writeText(request);return;}
 case 'app:reload':setTimeout(()=>{if(win&&!win.isDestroyed())win.reload();if(companion&&!companion.isDestroyed())companion.reload();},50);return;
 case 'app:diagnostic':if(args.event!=='renderer-error')throw Error('Unknown diagnostic event');diagnostic(args.event);return;
 case 'app:diagnostics':fs.mkdirSync(diagnosticsDir,{recursive:true});return shell.openPath(diagnosticsDir);
 case 'island:concurrency':return hub.island.setConcurrency(args.limit);
 case 'island:resident':return hub.island.resident(args);
 case 'island:saveJob':return hub.island.saveJob(args);
 case 'island:enableJob':return hub.island.enable(args.id,args.enabled);
 case 'island:reviewJob':return hub.island.review(args.id);
 case 'island:runJob':return hub.island.run(args.id);
 case 'island:stopJob':return hub.island.stop(args.id);
 case 'island:paused':return hub.island.setPaused(args.paused);
 case 'island:revenue':return hub.island.addRevenue(args);
 case 'crew:note':{const note=hub.growth.note(args.crewId,args.text,args.id);hub.changed();return note;}
 case 'crew:forget':hub.growth.forget(args.crewId,args.id);hub.changed();return;
 case 'crew:memoryEnabled':if(typeof args.enabled!=='boolean')throw Error('Choose on or off.');hub.growth.data.enabled=args.enabled;hub.changed();return;
 case 'crew:discuss':return hub.discuss(args);
 case 'crew:cancelDiscussion':hub.cancelDiscussion();return;
 case 'asset:crewTexture':{const names={blimp:'morgans-blimp-key.png',crew:'crew-deck-sprites.png',actions:'crew-actions.png',ship:'ship-companion-key.png',walk:'crew-walk.png',states:'crew-pet-states.png',residents:'island-residents.png'};const name=names[args.kind||'crew'];if(!name)throw Error('Unknown texture');return 'data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'../dist/assets',name)).toString('base64');}
 case 'companion:show':await showCompanion();win.minimize();return;
 case 'companion:restore':{const request=args.workspace?validWorkspaceRequest(args.workspace):null;restoreHub();if(request)win.webContents.send('sunny:event',{type:'workspace:open',data:request});return;}
 case 'companion:hide':companion?.hide();return;
 case 'companion:mouse':if(companion&&!companion.isDestroyed())companion.setIgnoreMouseEvents(args.ignore===true,{forward:true});return;
 case 'companion:resize':{if(!companion)return;const b=companion.getBounds(),area=screen.getDisplayMatching(b).workArea;const delta=args.delta===100?100:args.delta===-100?-100:0;const next=companionBounds(area,b.width+delta);next.x=Math.max(area.x,Math.min(b.x,area.x+area.width-next.width));next.y=Math.max(area.y,Math.min(b.y,area.y+area.height-next.height));companion.setBounds(next);return;}
 case 'codex:connect':return hub.connect();
 case 'codex:login':{if(!hub.client.connected)await hub.client.connect(home);const result=await hub.client.request('account/login/start',{type:'chatgpt'});if(result.authUrl)await openUrl(result.authUrl);return result;}
 case 'project:add':{const result=await dialog.showOpenDialog(win,{title:'Bring a project aboard',properties:['openDirectory']});if(result.canceled)return null;const root=fs.realpathSync(result.filePaths[0]);const existing=hub.state.projects.find(p=>p.path.toLowerCase()===root.toLowerCase());if(existing)return existing;const project={id:hash(root.toLowerCase()).slice(0,16),name:path.basename(root),path:root,category:'development'};hub.state.projects.push(project);hub.changed();return project;}
 case 'project:remove':{const p=registered(args.projectId);if(hub.gate.blocked(p.path)||hub.state.tasks.some(t=>t.projectId===p.id&&['working','waiting','starting'].includes(t.status)))throw Error('Finish active tasks before removing this project.');hub.state.projects=hub.state.projects.filter(x=>x.id!==p.id);hub.changed();return;}
 case 'task:start':return hub.start(args);
 case 'task:send':return hub.send(args.taskId,args.prompt);
 case 'task:interrupt':return hub.interrupt(args.taskId);
 case 'task:handoff':return hub.handoff(args);
 case 'task:history':{const imported=importedHistory().map(({messages,...summary})=>summary);try{await hub.ensure();const r=await hub.client.request('thread/list',{limit:100,useStateDbOnly:true,sourceKinds:['cli','vscode','appServer','exec']});return [...imported,...(r.data||[]).filter(t=>!hub.state.tasks.some(own=>own.threadId===t.id)).map(t=>({id:t.id,title:t.name||t.preview||'Codex task',cwd:t.cwd,status:'externally managed',external:true}))];}catch{return imported;}}
 case 'task:readExternal':{if(String(args.threadId).startsWith('chatgpt:')){const item=importedHistory().find(c=>c.id===args.threadId);if(!item)throw Error('Imported conversation not found');return {messages:item.messages};}await hub.ensure();return hub.client.request('thread/read',{threadId:textArg(args.threadId,'task ID',200),includeTurns:true});}
 case 'approval:respond':return hub.respond(args);
 case 'files:list':return fileList(args.projectId,args.path);
 case 'files:read':return readText(registered(args.projectId).path,args.path);
 case 'files:write':{const p=registered(args.projectId);if(hub.gate.blocked(p.path))throw Error('An agent is writing in this checkout. Interrupt it before saving manual changes.');return writeText(p.path,args.path,args.text,args.hash);}
 case 'files:search':return searchFiles(args.projectId,args.query);
 case 'git:status':{const raw=await git(args.projectId,['status','--porcelain=v1','-z']);const entries=raw.split('\0');const files=[];for(let i=0;i<entries.length;i++){const row=entries[i];if(!row)continue;files.push({status:row.slice(0,2),path:row.slice(3)});if(/[RC]/.test(row.slice(0,2)))i++;}let branch='No commits yet';try{branch=(await git(args.projectId,['branch','--show-current'])).trim();}catch{}return {branch,files,diff:await git(args.projectId,['diff','--no-ext-diff'])};}
 case 'git:diff':{if(args.path)guardedPath(registered(args.projectId).path,args.path);const staged=await git(args.projectId,['diff','--cached','--no-ext-diff','--',...(args.path?[args.path]:[])]);const working=await git(args.projectId,['diff','--no-ext-diff','--',...(args.path?[args.path]:[])]);return [staged&&'STAGED\n'+staged,working&&'WORKING TREE\n'+working].filter(Boolean).join('\n')||'No tracked changes. New untracked files appear in the file explorer.';}
 case 'git:branches':return git(args.projectId,['branch','--all']);
 case 'git:commit':{const p=registered(args.projectId);if(hub.gate.blocked(p.path))throw Error('Finish active work before committing.');if(!Array.isArray(args.paths)||!args.paths.length)throw Error('Select files to commit.');const paths=args.paths.map(f=>{const absolute=guardedPath(p.path,textArg(f,'file path'));if(fs.existsSync(absolute)&&fs.statSync(absolute).isDirectory())throw Error('Select individual files, not entire directories.');return path.relative(p.path,absolute);});const message=textArg(args.message,'commit message',2000);const index=path.resolve(p.path,(await git(args.projectId,['rev-parse','--git-path','index'])).trim());const original=fs.existsSync(index)?fs.readFileSync(index):null;try{await git(args.projectId,['add','--',...paths]);return await git(args.projectId,['commit','--only','-m',message,'--',...paths]);}catch(e){if(original)fs.writeFileSync(index,original);else if(fs.existsSync(index))fs.unlinkSync(index);throw e;}}
 case 'git:stage':{const p=registered(args.projectId);if(hub.gate.blocked(p.path))throw Error('Finish active work before staging.');if(!Array.isArray(args.paths)||!args.paths.length)throw Error('Select files to stage.');const names=args.paths.map(f=>path.relative(p.path,guardedPath(p.path,f)));return git(args.projectId,['add','--',...names]);}
 case 'terminal:create':{const p=registered(args.projectId);let pty;try{pty=require('node-pty');}catch{throw Error('The terminal runtime is unavailable. Reinstall Sunny or open the project in Cursor.');}const id=randomUUID();const exe=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');const proc=pty.spawn(exe,['-NoLogo'],{name:'xterm-256color',cols:100,rows:28,cwd:p.path,env:{...process.env},useConpty:true,useConptyDll:true});terminals.set(id,proc);proc.onData(data=>emit('terminal:data',{id,data}));proc.onExit(({exitCode})=>{terminals.delete(id);emit('terminal:exit',{id,exitCode});});return {id};}
 case 'terminal:write':{if(typeof args.data!=='string'||args.data.length>100000)throw Error('Invalid terminal input');const t=terminals.get(args.id);if(!t)throw Error('Terminal is closed');t.write(args.data);return;}
 case 'terminal:resize':{const t=terminals.get(args.id);if(t)t.resize(Math.max(2,Math.min(500,Number(args.cols)||80)),Math.max(2,Math.min(200,Number(args.rows)||24)));return;}
 case 'terminal:close':{terminals.get(args.id)?.kill();terminals.delete(args.id);return;}
 case 'tools:refresh':return hub.refreshTools();
 case 'tools:open':{const tool=hub.state.tools.find(t=>t.id===args.toolId);if(!tool)throw Error('Tool not found');if(tool.url)return openUrl(tool.url);if(tool.path){if(args.projectId&&/cursor/i.test(tool.name)){const project=registered(args.projectId);return shell.openExternal('cursor://file/'+project.path.replace(/\\/g,'/'));}const err=await shell.openPath(tool.path);if(err)throw Error(err);return;}throw Error(tool.status==='available in Codex'?'This connection is available inside crew conversations. Mention its name in your task.':'This tool needs setup in its original application.');}
 case 'tools:call':{const t=hub.task(args.taskId);if(!t.threadId)throw Error('Start a task first');return hub.client.request('mcpServer/tool/call',{threadId:t.threadId,server:textArg(args.server,'server',100),name:textArg(args.name,'tool name',200),arguments:args.arguments||{}});}
 case 'library:search':return catalog.searchLibrary(home,typeof args.query==='string'?args.query:'');
 case 'library:read':{const {vault,file}=libraryFile(args.path);return readText(vault,file);}
 case 'library:write':{const {vault,file}=libraryFile(args.path);return writeText(vault,file,args.text,args.hash);}
 case 'library:capture':{const vault=catalog.vaultPath(home);if(!fs.existsSync(vault))throw Error('The Applied AI Studio vault was not found.');const title=textArg(args.title,'note title',180);const text=textArg(args.text,'note text',200000);const name=title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').slice(0,100);const dir=guardedPath(vault,'00 Inbox');fs.mkdirSync(dir,{recursive:true});const file=guardedPath(vault,path.join('00 Inbox',new Date().toISOString().slice(0,10)+' '+name+' '+Date.now().toString(36)+'.md'));const project=args.projectId?registered(args.projectId):null;const body=`---\ntype: capture\nsource: Sunny HQ\ndate: ${new Date().toISOString()}\n---\n\n# ${title}\n\n${text}\n${project?`\nProject: ${project.name}\n`:''}`;fs.writeFileSync(file,body,{encoding:'utf8',flag:'wx'});return {path:file};}
 case 'settings:update':{if(Object.hasOwn(args,'routingPolicy')){if(!['efficient','balanced','thorough'].includes(args.routingPolicy))throw Error('Choose a supported execution preference.');hub.state.settings.routingPolicy=args.routingPolicy;}if(typeof args.reducedMotion==='boolean')hub.state.settings.reducedMotion=args.reducedMotion;if(typeof args.notifications==='boolean')hub.state.settings.notifications=args.notifications;if(Object.hasOwn(args,'model')){if(args.model&&!hub.state.models.some(m=>m.model===args.model||m.id===args.model))throw Error('Choose an available model');hub.state.settings.model=args.model||undefined;}hub.changed();return hub.state.settings;}
 case 'dialog:openExternal':return openUrl(args.url);
 case 'preview:open':{const url=allowedUrl(args.url,{localOnly:true});const preview=new BrowserWindow({title:'Sunny · Local preview',width:1100,height:780,parent:win,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});preview.webContents.setWindowOpenHandler(()=>({action:'deny'}));preview.webContents.on('will-navigate',(event,target)=>{try{allowedUrl(target,{localOnly:true});}catch{event.preventDefault();}});preview.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));await preview.loadURL(url);return;}
 case 'app:importChatGPT':{const result=await dialog.showOpenDialog(win,{title:'Import ChatGPT conversations.json',filters:[{name:'ChatGPT export',extensions:['json']}],properties:['openFile']});if(result.canceled)return null;const file=result.filePaths[0];if(fs.statSync(file).size>150*1024*1024)throw Error('Export exceeds the 150 MB import limit.');const imported=require('./import.cjs').importConversations(JSON.parse(fs.readFileSync(file,'utf8')));const merged=new Map(importedHistory().map(c=>[c.id,c]));for(const item of imported)merged.set(item.id,item);const target=path.join(dataDir,'chatgpt-history.json');fs.writeFileSync(target+'.tmp',JSON.stringify([...merged.values()]),'utf8');fs.renameSync(target+'.tmp',target);return {count:imported.length};}
 case 'app:export':{const result=await dialog.showSaveDialog(win,{defaultPath:'sunny-hq-backup.json',filters:[{name:'Sunny backup',extensions:['json']}]});if(result.canceled)return {};const backup={version:1,missionBook:hub.missionBook.data,news:hub.state.news,world:hub.state.world,exportedAt:new Date().toISOString(),projects:hub.state.projects,tasks:hub.state.tasks,settings:hub.state.settings,growth:hub.growth.data,discussions:hub.state.discussions};fs.writeFileSync(result.filePath,JSON.stringify(backup,null,2),'utf8');return {path:result.filePath};}
 case 'docker:list':{const raw=await command(catalog.getExecutable('docker',home),['ps','-a','--format','{{json .}}'],home);return raw.trim()?raw.trim().split('\n').map(s=>JSON.parse(s)):[];}
 case 'docker:action':{if(!/^[a-zA-Z0-9_.-]+$/.test(args.id||'')||!['start','stop','logs'].includes(args.action))throw Error('Invalid container action');return command(catalog.getExecutable('docker',home),args.action==='logs'?['logs','--tail','100',args.id]:[args.action,args.id],home);}
 case 'github:prs':return JSON.parse(await command(catalog.getExecutable('gh',home),['pr','list','--json','number,title,state,url,headRefName,statusCheckRollup'],registered(args.projectId).path));
 default:throw Error('Unsupported action: '+action);
 }
}
function restoreHub(){if(companion&&!companion.isDestroyed())companion.hide();if(win?.isMinimized())win.restore();win?.show();win?.focus();}
async function showCompanion(){
 if(companionLoading)return companionLoading;
 if(companion&&!companion.isDestroyed()){companion.setIgnoreMouseEvents(false);companion.showInactive();return;}
 companionLoading=(async()=>{
  const bounds=companionBounds(screen.getPrimaryDisplay().workArea);
  companion=new BrowserWindow({...bounds,title:'Thousand Sunny · Desktop crew',frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,alwaysOnTop:true,skipTaskbar:true,resizable:false,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  companion.webContents.setWindowOpenHandler(()=>({action:'deny'}));companion.webContents.on('will-navigate',e=>e.preventDefault());
  companion.on('close',e=>{if(!quitting){e.preventDefault();companion.hide();}});
  const dev=process.env.SUNNY_DEV_URL;
  if(dev){const url=new URL(allowedUrl(dev,{localOnly:true}));url.searchParams.set('companion','1');await companion.loadURL(url.href);}else await companion.loadFile(path.join(__dirname,'../dist/index.html'),{query:{companion:'1'}});
  companion.showInactive();
 })();
 try{await companionLoading;}catch(e){companion?.destroy();companion=undefined;throw e;}finally{companionLoading=undefined;}
}
async function createWindow(){win=new BrowserWindow({title:'Sunny HQ',width:1520,height:980,minWidth:1000,minHeight:700,show:!smoke,backgroundColor:'#f7f5ef',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),backgroundThrottling:!smoke,contextIsolation:true,nodeIntegration:false,sandbox:true}});win.webContents.setWindowOpenHandler(({url})=>{openUrl(url).catch(()=>{});return {action:'deny'};});win.webContents.on('will-navigate',event=>event.preventDefault());win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
 win.webContents.on('did-finish-load',()=>diagnostic('window-loaded'));
 win.webContents.on('did-fail-load',(_event,code,_description,_url,isMainFrame)=>{if(isMainFrame&&code!==-3)diagnostic('load-failed');});
 win.webContents.on('render-process-gone',async()=>{diagnostic('renderer-gone');if(quitting||smoke)return;const result=await dialog.showMessageBox(win,{type:'error',buttons:['Reload Sunny','Keep closed'],defaultId:0,message:'Sunny’s interface stopped responding.',detail:'Saved data has not been reset. Active missions may still be running. Reload the interface to reconnect.'});if(result.response===0&&!win.isDestroyed())win.reload();});
 ipcMain.handle('sunny:invoke',async(event,action,args)=>{const sender=[win,companion].find(surface=>surface&&!surface.isDestroyed()&&event.sender===surface.webContents&&event.senderFrame===surface.webContents.mainFrame);if(!sender)throw Error('Untrusted window');if(action==='companion:mouse'&&sender!==companion)throw Error('Companion only');return handle(action,args);});
 hub.on('event',event=>{if(event.type==='snapshot')emit('snapshot',publicState());else emit(event.type,event.data);if(event.type==='completed'&&hub.state.settings.notifications&&!win.isFocused()&&Notification.isSupported())new Notification({title:event.data.status==='finished'?'Work ready to review':'Your crew needs attention',body:event.data.title}).show();});
 win.on('minimize',()=>{if(!quitting&&!smoke)void showCompanion().catch(e=>emit('error',{message:e.message}));});win.on('restore',()=>companion?.hide());
 win.on('close',event=>{if(!quitting&&!smoke){event.preventDefault();win.hide();void showCompanion().catch(e=>emit('error',{message:e.message}));}});
 const dev=process.env.SUNNY_DEV_URL;if(dev)await win.loadURL(allowedUrl(dev,{localOnly:true}));else await win.loadFile(path.join(__dirname,'../dist/index.html'));
 const icon=nativeImage.createFromPath(path.join(__dirname,'../dist/assets/thousand-sunny.png')).resize({width:32,height:32});tray=new Tray(icon);tray.setToolTip('Sunny HQ');tray.setContextMenu(Menu.buildFromTemplate([{label:'Open Sunny HQ',click:()=>restoreHub()},{label:'Ship on desktop',click:()=>{void showCompanion().then(()=>win.minimize()).catch(e=>emit('error',{message:e.message}));}},{label:'Quit',click:async()=>{const active=hub.state.tasks.filter(t=>['working','waiting','starting'].includes(t.status));if(active.length||hub.discussionRun){const r=await dialog.showMessageBox(win,{type:'question',buttons:['Keep working','Interrupt and quit'],defaultId:0,cancelId:0,message:`${active.length} task(s) are still active.${hub.discussionRun?' A crew discussion is also underway.':''}`});if(r.response===0)return;await Promise.allSettled(active.map(t=>hub.interrupt(t.id)));}hub.cancelDiscussion();quitting=true;app.quit();}}]));tray.on('click',()=>restoreHub());
 try{await hub.connect();}catch(e){console.error('Codex connection:',e.message);}
 if(smoke){win.showInactive();await require('./smoke.cjs')({win,hub,handle,terminals});await require('./companion-smoke.cjs')({win,handle,getCompanion:()=>companion});await require('./growth-smoke.cjs')({win,hub,handle});await require('./walking-smoke.cjs')({win,hub});await require('./captain-smoke.cjs')({win,hub,handle});await require('./island-smoke.cjs')({win,hub,handle});await require('./news-smoke.cjs')({win,hub,handle});await require('./recovery-smoke.cjs')({win,hub});await new Promise(r=>setTimeout(r,1800));const state=publicState();const checks={title:await win.webContents.getTitle(),projects:state.projects.length,tools:state.tools.length,codex:state.codex.status,models:state.models.length,body:await win.webContents.executeJavaScript('document.body.innerText.slice(0,900)'),images:await win.webContents.executeJavaScript('Array.from(document.images).map(i=>({src:i.src,width:i.naturalWidth}))')};if(!checks.body.trim()||!checks.images.length)throw Error('The final app view did not render.');const screenshot=await win.webContents.capturePage();const output=path.join(process.cwd(),'.sunny-dev','desktop-smoke.png');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,screenshot.toPNG());console.log('SUNNY_SMOKE '+JSON.stringify({...checks,screenshot:output}));quitting=true;app.quit();}
}
app.whenReady().then(async()=>{let store;try{store=new SqliteStore(path.join(dataDir,'sunny.sqlite'));}catch(e){console.warn('SQLite unavailable, using atomic JSON:',e.message);store=new StateStore(path.join(dataDir,'state.json'));}hub=new Hub({home,store,catalog});if(store.recovery&&!smoke)await dialog.showMessageBox({type:"info",title:"Sunny recovered local data",message:"Unreadable saved data was preserved for recovery. Sunny will open with defaults.",detail:store.recovery});const newsArg=process.argv.find(a=>a.startsWith('--import-briefing='));if(newsArg)importNewsFile(newsArg.slice('--import-briefing='.length));await createWindow();}).catch(e=>{diagnostic('startup-failed');console.error(e);if(!smoke)dialog.showErrorBox('Sunny could not start',e.message);quitting=true;app.exit(1);});
app.on('before-quit',()=>{quitting=true;for(const terminal of terminals.values())try{terminal.kill();}catch{}if(hub)hub.close();});
app.on('window-all-closed',()=>{if(quitting)app.quit();});app.on('activate',()=>restoreHub());





