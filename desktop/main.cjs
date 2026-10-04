if(process.argv.some(value=>value.startsWith('--packaged-fixture=')))require('./packaged-acceptance.cjs').validateFixtureArguments(process.argv);
if(process.argv.includes('--review-preview')){require('./preview.cjs');}else{
const {app,BrowserWindow,ipcMain,dialog,shell,Tray,Menu,nativeImage,Notification,screen}=require('electron');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const {execFile}=require('node:child_process');const {promisify}=require('node:util');const {randomUUID}=require('node:crypto');
const fixtureArg=process.argv.find(value=>value.startsWith('--packaged-fixture='));
const packagedFixture=fixtureArg?require('./packaged-acceptance.cjs'):null;
const fixture=packagedFixture?packagedFixture.admitFixture({manifestPath:fixtureArg.slice('--packaged-fixture='.length),nonce:process.env.SUNNY_FIXTURE_NONCE,defaultProfile:path.join(process.env.USERPROFILE||os.homedir(),'AppData','Local','Sunny HQ')}):null;
if(fixture&&process.env.SUNNY_DATA_DIR&&path.resolve(process.env.SUNNY_DATA_DIR).toLowerCase()!==fixture.profileDir.toLowerCase())throw Error('Fixture cannot use a live profile override.');
const {guardedPath,readText,writeText,hash}=require('./core.cjs');const catalog=fixture?packagedFixture.fixtureCatalog():require('./catalog.cjs');
const {scanMorgansInbox}=require('./morgans-inbox.cjs');
const {searchProjectFiles}=require('./project-search.cjs');
const {bootHub,createQuitLifecycle}=require('./persistence-lifecycle.cjs');
app.setName('Sunny HQ');const home=process.env.USERPROFILE||os.homedir();const dataDir=fixture?.profileDir||process.env.SUNNY_DATA_DIR||path.join(home,'AppData','Local','Sunny HQ');app.setPath('userData',dataDir);
const primary=app.requestSingleInstanceLock();if(!primary)app.exit(0);app.on('second-instance',()=>{if(win)restoreHub();});
let win,companion,companionLoading,hub,tray,quitting=false,morgansScanTimer,publicTransport;
const diagnosticsDir=path.join(dataDir,'diagnostics');
const diagnostics=require('./diagnostics.cjs');const buildInfo={...diagnostics.readBuildInfo(path.join(__dirname,'../dist/build-info.json')),appVersion:app.getVersion(),electronVersion:process.versions.electron};
const fixtureDiagnosticEvents=[];
function diagnostic(event,details={}){if(fixture)fixtureDiagnosticEvents.push({event,...diagnostics.safeDetails(event,details)});try{diagnostics.record(diagnosticsDir,event,{...buildInfo,...details});}catch{/* Diagnostics must not prevent startup. */}}
function watchSurface(surface,kind){diagnostics.watchRenderer(surface.webContents,{window:surface,surface:kind,record:diagnostic,onGone:details=>{if(quitting||smoke||fixture)return;return diagnostics.offerReload(surface,{...details,isQuitting:()=>quitting,showMessageBox:(window,options)=>dialog.showMessageBox(window,options)});}});}
async function captureSmokePage(){let lastError;for(let attempt=1;attempt<=3;attempt++){try{await new Promise(resolve=>setTimeout(resolve,150*attempt));return await win.webContents.capturePage();}catch(error){lastError=error;}}throw lastError;}
diagnostic('starting');
const {companionBounds,validWorkspaceRequest}=require('./companion.cjs');const terminals=new Map();const runFile=promisify(execFile);const smoke=process.argv.includes('--smoke-test');
const skipped=new Set(['.git','node_modules','.next','dist','release','.sunny-dev','.obsidian','70 Attachments','99 Archive','80 Templates']);
function emitEnvelope(envelope){require('./broadcast.cjs').broadcastEnvelope([win,companion],envelope);}
function emit(type,data){emitEnvelope(publicTransport?publicTransport.event(type,data):{type,data});}
function textArg(value,label,max=10000){if(typeof value!=='string'||!value.trim()||value.length>max||value.includes('\0'))throw Error('Invalid '+label);return value;}
function executionSelection(args){const selection={};for(const key of ['projectId','taskId','workspaceId','runId'])if(args[key]!==undefined)selection[key]=args[key];return selection;}
async function executionProject(args){const selection=executionSelection(args);const ref=await require('./workspace-routing.cjs').routeWorkspace(selection,hub.state,async ref=>ref);return {...registered(selection.projectId),path:ref.canonicalRoot,executionWorkspace:ref};}
async function assertExecution(project){await require('./execution-workspaces.cjs').verifyWorkspace(project.executionWorkspace,registered(project.id));const ref=require('./execution-workspaces.cjs').resolveExecutionRoot({projectId:project.id,...(project.executionWorkspace.legacy?{}:{runId:project.executionWorkspace.runId,workspaceId:project.executionWorkspace.id})},hub.state);if(JSON.stringify(ref)!==JSON.stringify(project.executionWorkspace))throw Error('Execution workspace changed during operation.');}
async function invalidateWorkspaceSource(project){if(project.executionWorkspace.runId){hub.verifiedWorkspaceReads?.delete(project.executionWorkspace.id);await hub.invalidateRunSource(project.executionWorkspace.runId);}}
async function manualWrite(project){await assertExecution(project);if(hub.gate.blocked(project.path,{projectId:project.id}))throw Error('An agent is writing in this project. Finish or interrupt it first.');}
function registered(id){const project=hub.project(id);if(!fs.existsSync(project.path))throw Error('Project folder is unavailable.');return project;}
async function command(exe,args,cwd,timeout=20000){if(fixture)throw Error('Offline fixture forbids shell commands.');if(!exe)throw Error('This tool is not installed. Open Tools for setup.');try{const result=await runFile(exe,args,{cwd,windowsHide:true,timeout,maxBuffer:4*1024*1024,encoding:'utf8'});return result.stdout;}catch(e){throw Error((e.stderr||e.message||'Command failed').slice(0,2000));}}
async function git(selection,args,reservation){const project=await executionProject(selection);await assertExecution(project);if(reservation){if(hub.gate.active.get(reservation.id)!==hub.gate.root(project.path)||project.id!==reservation.project.id||JSON.stringify(project.executionWorkspace)!==JSON.stringify(reservation.project.executionWorkspace))throw Error('Manual Git reservation changed.');}else if(['add','commit'].includes(args[0]))throw Error('Manual Git mutation requires its operation reservation.');if(reservation&&['add','commit'].includes(args[0]))reservation.mutated=true;const result=await command(catalog.getExecutable('git',home)||'git.exe',args,project.path);await assertExecution(project);return result;}
async function withManualGit(selection,operation){const project=await executionProject(selection);await assertExecution(project);const id='manual-git:'+randomUUID();hub.gate.acquire(id,project.path,{projectId:project.id,runId:project.executionWorkspace.runId});const reservation={id,project};try{return await operation(project,reservation);}finally{try{if(reservation.mutated)await invalidateWorkspaceSource(project);}finally{hub.gate.release(id);}}}
function allowedUrl(raw,{localOnly=false}={}){const url=new URL(textArg(raw,'URL'));if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('Use an HTTP or HTTPS address without embedded credentials.');if(localOnly&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('The preview supports local development servers. Open other sites in your browser.');return url.toString();}
function openUrl(raw){if(fixture)throw Error('Offline fixture forbids external navigation.');return shell.openExternal(allowedUrl(raw));}
function importedHistory(){try{return JSON.parse(fs.readFileSync(path.join(dataDir,'chatgpt-history.json'),'utf8'));}catch{return [];}}
const externalHistoryPager=require('./external-history-pages.cjs').createExternalHistoryPager();
async function loadExternalHistory(threadId){
 textArg(threadId,'task ID',200);
 if(threadId.startsWith('chatgpt:')){const item=importedHistory().find(c=>c.id===threadId);if(!item)throw Error('Imported conversation not found');return {messages:item.messages};}
 await hub.ensure();return hub.client.request('thread/read',{threadId,includeTurns:true});
}
function publicState(){return publicTransport.snapshot();}
async function fileList(selection,input=''){const p=await executionProject(selection);const dir=guardedPath(p.path,input);return fs.readdirSync(dir,{withFileTypes:true}).filter(f=>!skipped.has(f.name)&&!f.isSymbolicLink()).map(f=>({name:f.name,path:p.executionWorkspace.legacy?path.join(dir,f.name):path.relative(p.path,path.join(dir,f.name)),directory:f.isDirectory()})).sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name));}
async function searchFiles(selection,query){const p=await executionProject(selection);textArg(query,'search query',200);return searchProjectFiles(p.path,query,{skipped});}
function libraryFile(input){if(typeof input!=='string'||!input.toLowerCase().endsWith('.md'))throw Error('Choose a Markdown note.');const vault=catalog.vaultPath(home);const file=guardedPath(vault,input);const relative=path.relative(vault,file).split(path.sep);if(relative.some(p=>skipped.has(p)))throw Error('This vault folder is excluded.');return {vault,file};}
function importNewsFile(file){if(fs.statSync(file).size>512*1024)throw Error('Capture exceeds 512 KB.');return hub.news.importCapture(JSON.parse(fs.readFileSync(file,'utf8')));}
function scanMorgansBriefings(){for(const [dir,seen] of morgansInboxes){const result=scanMorgansInbox({dir,news:hub.news,seen});for(const error of result.errors)emit('error',{message:`Morgans could not import ${error.file}: ${error.message}`});}}
let morgansInboxes=[];
async function handle(action,args={},surface='hub'){
 if(fixture)packagedFixture.assertFixtureAction(action,args);
 require('./workspace-routing.cjs').validateWorkspaceRoute(action,args);
 require('./task-commands.cjs').validateTaskCommand(action,args);
 require('./supervision-commands.cjs').validateSupervisionCommand(action,args);
 if(hub?.quiescing&&!['snapshot','workspace:get','app:export','mission:resultStatus','transcript:page','run:inspect'].includes(action))throw Error('Sunny is stopping and storage needs attention. Keep this window open to copy or export drafts before restarting.');
 switch(action){
 case 'snapshot':return publicState();
 case 'run:ackCall':return hub.ackCall(args);
 case 'goal:start':{const result=await hub.startGoal(args);return {...result,run:publicTransport.runReply(result.run),task:result.task?publicTransport.taskReply(result.task):undefined};}
 case 'run:create':return publicTransport.runReply(await hub.createRun(args));
 case 'run:control':{const result=await hub.controlRun(args),run=publicTransport.runReply(result.run,result.report);return args.action!==undefined?{run,report:run.controlReport}:run;}
 case 'run:setGrant':return publicTransport.runReply((await hub.setRunGrant(args)).run);
 case 'run:inspect':return publicTransport.runReply(hub.inspectRun(args));
 case 'transcript:page':return publicTransport.page(args);
 case 'mission:resultStatus':return publicTransport.resultStatus(args);
 case 'mission:prepareMerge':return hub.merger.act(args,'prepare');
 case 'mission:submitMerge':return hub.merger.act(args,'submit');
 case 'mission:recheckMerge':return hub.merger.act(args,'recheck');
 case 'mission:preparePr':return hub.publication.act(args,'prepare');
 case 'mission:publishPr':return hub.publication.act(args,'publish');
 case 'mission:reconcilePr':return hub.publication.act(args,'reconcile');
 case 'mission:signalSeen':return hub.markMissionSignalSeen(args);
 case 'mission:create':return hub.createMission(args);
 case 'mission:prepareBranch':return hub.prepareMissionBranch(args);
 case 'mission:start':return publicTransport.taskReply(await hub.startMission(args));
 case 'skills:suggest':return hub.suggestSkills(args);
 case 'mission:accept':return hub.acceptMission(args);
 case 'mission:selectResult':return hub.selectMissionResult(args);
 case 'workspace:get':if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length)throw Error('Invalid workspace query.');return hub.state.workspace;
 case 'workspace:update':return hub.updateWorkspace(args);
 case 'workspace:claimAcceptanceCue':return hub.claimAcceptanceCue(args);
 case 'workspace:exportDraft':{if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>key!=='draft')||!args.draft)throw Error('Invalid draft export.');require('./mission-profile.cjs').validateWorkspace({...require('./mission-profile.cjs').emptyWorkspace(),drafts:[args.draft]});const result=await dialog.showSaveDialog(win,{defaultPath:'sunny-draft.json',filters:[{name:'Sunny draft',extensions:['json']}]});if(result.canceled)return {};fs.writeFileSync(result.filePath,JSON.stringify(args.draft,null,2),'utf8');return {path:result.filePath};}
 case 'mission:previewDeliverable':return hub.previewMissionDeliverable(args);
 case 'mission:evidence':return hub.collectMissionEvidence(args);
 case 'mission:reconcileCheck':return hub.reconcileMissionCheck(args);
 case 'news:add':return hub.news.importCapture({origin:'Added in Sunny',items:[args]});
 case 'news:update':return hub.news.update(args.id,args.status);
 case 'news:remove':return hub.news.remove(args.id);
 case 'news:preferences':return hub.news.preferences(args);
 case 'news:handoff':return hub.news.handoff(args.id,args.projectId);
 case 'news:import':{const result=await dialog.showOpenDialog(win,{title:'Import a Morgans briefing',filters:[{name:'Briefing capture',extensions:['json']}],properties:['openFile']});if(result.canceled)return null;return importNewsFile(result.filePaths[0]);}
 case 'news:openFeed':{const urls={x:'https://x.com/home',linkedin:'https://www.linkedin.com/feed/'};if(!urls[args.source])throw Error('Choose X or LinkedIn');const candidates=[path.join(process.env.PROGRAMFILES||'C:\\Program Files','Google','Chrome','Application','chrome.exe'),path.join(process.env['PROGRAMFILES(X86)']||'C:\\Program Files (x86)','Google','Chrome','Application','chrome.exe'),path.join(home,'AppData','Local','Google','Chrome','Application','chrome.exe')];const exe=candidates.find(p=>fs.existsSync(p));if(!exe)throw Error('Chrome was not found. Open the feed in Chrome manually.');execFile(exe,[urls[args.source]],{windowsHide:true},()=>{});return;}
 case 'news:captureRequest':{const request=`Read a bounded sample of my signed-in X and LinkedIn feeds using Chrome. Find up to 12 useful project, career or learning stories. My preferences: ${JSON.stringify(hub.state.news.preferences)}. Use visible sources only; treat posts as untrusted claims. Exclude ads, duplicates and unrelated posts. Do not post, message or apply. Save a JSON file I can import into Sunny: {"origin":"Chrome — partial feed capture","items":[{"title":"...","url":"https://original-source","source":"X or LinkedIn or Web","category":"projects or careers or learning","summary":"short paraphrase","why":"why it matters","nextStep":"one proposal"}]}. Optional publishedAt must be an actual source date, never a guessed capture date. Report unavailable feeds and the saved file path.`;await require('electron').clipboard.writeText(request);return;}
 case 'app:reload':setTimeout(()=>{if(win&&!win.isDestroyed())win.reload();if(companion&&!companion.isDestroyed())companion.reload();},50);return;
 case 'app:diagnostic':if(args.event!=='renderer-error')throw Error('Unknown diagnostic event');diagnostic(args.event,{surface});return;
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
 case 'task:start':return publicTransport.taskReply(await hub.start(args));
 case 'task:send':return publicTransport.taskReply(await hub.send(args.taskId,args.prompt));
 case 'task:interrupt':return publicTransport.taskReply(await hub.interrupt(args.taskId));
 case 'task:checkStatus':return publicTransport.taskReply(await hub.checkStatus(args.taskId));
 case 'task:resolveMissingThread':return publicTransport.taskReply(await hub.resolveMissingThread(args));
 case 'task:handoff':return publicTransport.taskReply(await hub.handoff(args));
 case 'task:history':{const imported=importedHistory().map(({messages,...summary})=>summary);try{await hub.ensure();const r=await hub.client.request('thread/list',{limit:100,useStateDbOnly:true,sourceKinds:['cli','vscode','appServer','exec']});return [...imported,...(r.data||[]).filter(t=>!hub.state.tasks.some(own=>own.threadId===t.id)).map(t=>({id:t.id,title:t.name||t.preview||'Codex task',cwd:t.cwd,status:'externally managed',external:true}))];}catch{return imported;}}
 case 'task:readExternal':case 'task:readExternalPage':return externalHistoryPager.readExternalPage(args,{loadHistory:loadExternalHistory});
 case 'approval:respond':return hub.respond(args);
 case 'files:list':return fileList(args,args.path);
 case 'files:read':return readText((await executionProject(args)).path,args.path);
 case 'files:write':{const p=await executionProject(args);await manualWrite(p);const result=writeText(p.path,args.path,args.text,args.hash);await invalidateWorkspaceSource(p);return result;}
 case 'files:search':return searchFiles(args,args.query);
 case 'git:status':{const raw=await git(args,['status','--porcelain=v1','-z']);const entries=raw.split('\0');const files=[];for(let i=0;i<entries.length;i++){const row=entries[i];if(!row)continue;files.push({status:row.slice(0,2),path:row.slice(3)});if(/[RC]/.test(row.slice(0,2)))i++;}let branch='No commits yet';try{branch=(await git(args,['branch','--show-current'])).trim();}catch{}return {branch,files,diff:await git(args,['diff','--no-ext-diff'])};}
 case 'git:diff':{if(args.path)guardedPath((await executionProject(args)).path,args.path);const staged=await git(args,['diff','--cached','--no-ext-diff','--',...(args.path?[args.path]:[])]);const working=await git(args,['diff','--no-ext-diff','--',...(args.path?[args.path]:[])]);return [staged&&'STAGED\n'+staged,working&&'WORKING TREE\n'+working].filter(Boolean).join('\n')||'No tracked changes. New untracked files appear in the file explorer.';}
 case 'git:branches':return git(args,['branch','--all']);
 case 'git:commit':return withManualGit(args,async(p,reservation)=>{if(!Array.isArray(args.paths)||!args.paths.length)throw Error('Select files to commit.');const paths=args.paths.map(f=>{const absolute=guardedPath(p.path,textArg(f,'file path'));if(fs.existsSync(absolute)&&fs.statSync(absolute).isDirectory())throw Error('Select individual files, not entire directories.');return path.relative(p.path,absolute);});const message=textArg(args.message,'commit message',2000);const index=path.resolve(p.path,(await git(args,['rev-parse','--git-path','index'],reservation)).trim());const original=fs.existsSync(index)?fs.readFileSync(index):null;try{await git(args,['add','--',...paths],reservation);return await git(args,['commit','--only','-m',message,'--',...paths],reservation);}catch(e){await assertExecution(p);if(hub.gate.active.get(reservation.id)!==hub.gate.root(p.path))throw Error('Manual Git rollback ownership changed; inspect the index before continuing.');if(original)fs.writeFileSync(index,original);else if(fs.existsSync(index))fs.unlinkSync(index);throw e;}});
 case 'git:stage':return withManualGit(args,async(p,reservation)=>{if(!Array.isArray(args.paths)||!args.paths.length)throw Error('Select files to stage.');const names=args.paths.map(f=>path.relative(p.path,guardedPath(p.path,f)));return git(args,['add','--',...names],reservation);});
 case 'terminal:create':{const p=await executionProject(args);await manualWrite(p);if(!p.executionWorkspace.legacy)throw Error('Managed terminal tool sandbox capability is unverified; terminal execution remains blocked.');let pty;try{pty=require('node-pty');}catch{throw Error('The terminal runtime is unavailable. Reinstall Sunny or open the project in Cursor.');}const id=randomUUID();const exe=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');const proc=pty.spawn(exe,['-NoLogo'],{name:'xterm-256color',cols:100,rows:28,cwd:p.path,env:{...process.env},useConpty:true,useConptyDll:true});proc.sunnyProject=p;terminals.set(id,proc);proc.onData(data=>emit('terminal:data',{id,data}));proc.onExit(({exitCode})=>{terminals.delete(id);emit('terminal:exit',{id,exitCode});});return {id};}
 case 'terminal:write':{if(typeof args.data!=='string'||args.data.length>100000)throw Error('Invalid terminal input');const t=terminals.get(args.id);if(!t)throw Error('Terminal is closed');await manualWrite(t.sunnyProject);t.write(args.data);return;}
 case 'terminal:resize':{const t=terminals.get(args.id);if(t)t.resize(Math.max(2,Math.min(500,Number(args.cols)||80)),Math.max(2,Math.min(200,Number(args.rows)||24)));return;}
 case 'terminal:close':{terminals.get(args.id)?.kill();terminals.delete(args.id);return;}
 case 'tools:refresh':return hub.refreshTools();
 case 'tools:open':{const tool=hub.state.tools.find(t=>t.id===args.toolId);if(!tool)throw Error('Tool not found');if(tool.url)return openUrl(tool.url);if(tool.path){if(args.projectId&&/cursor/i.test(tool.name)){const project=await executionProject(args);return shell.openExternal('cursor://file/'+project.path.replace(/\\/g,'/'));}const err=await shell.openPath(tool.path);if(err)throw Error(err);return;}throw Error(tool.status==='available in Codex'?'This connection is available inside crew conversations. Mention its name in your task.':'This tool needs setup in its original application.');}
 case 'tools:call':return hub.callTool({taskId:args.taskId,server:textArg(args.server,'server',100),name:textArg(args.name,'tool name',200),arguments:args.arguments||{}});
 case 'library:search':return catalog.searchLibrary(home,typeof args.query==='string'?args.query:'');
 case 'library:read':{const {vault,file}=libraryFile(args.path);return readText(vault,file);}
 case 'library:write':{const {vault,file}=libraryFile(args.path);return writeText(vault,file,args.text,args.hash);}
 case 'library:capture':{const vault=catalog.vaultPath(home);if(!fs.existsSync(vault))throw Error('The Applied AI Studio vault was not found.');const title=textArg(args.title,'note title',180);const text=textArg(args.text,'note text',200000);const name=title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').slice(0,100);const dir=guardedPath(vault,'00 Inbox');fs.mkdirSync(dir,{recursive:true});const file=guardedPath(vault,path.join('00 Inbox',new Date().toISOString().slice(0,10)+' '+name+' '+Date.now().toString(36)+'.md'));const project=args.projectId?registered(args.projectId):null;const body=`---\ntype: capture\nsource: Sunny HQ\ndate: ${new Date().toISOString()}\n---\n\n# ${title}\n\n${text}\n${project?`\nProject: ${project.name}\n`:''}`;fs.writeFileSync(file,body,{encoding:'utf8',flag:'wx'});return {path:file};}
 case 'settings:update':{const settings={...hub.state.settings};if(Object.hasOwn(args,'routingPolicy')){if(!['efficient','balanced','thorough'].includes(args.routingPolicy))throw Error('Choose a supported execution preference.');settings.routingPolicy=args.routingPolicy;}if(typeof args.reducedMotion==='boolean')settings.reducedMotion=args.reducedMotion;if(typeof args.notifications==='boolean')settings.notifications=args.notifications;if(Object.hasOwn(args,'roomSoundEnabled')){if(typeof args.roomSoundEnabled!=='boolean')throw Error('Room sound setting must be true or false.');settings.roomSoundEnabled=args.roomSoundEnabled;}if(Object.hasOwn(args,'roomSoundVolume')){if(typeof args.roomSoundVolume!=='number'||!Number.isFinite(args.roomSoundVolume)||args.roomSoundVolume<0||args.roomSoundVolume>.65)throw Error('Room sound volume must be between 0 and 0.65.');settings.roomSoundVolume=args.roomSoundVolume;}if(Object.hasOwn(args,'model')){if(args.model&&!hub.state.models.some(m=>m.model===args.model||m.id===args.model))throw Error('Choose an available model');settings.model=args.model||undefined;}Object.assign(hub.state.settings,settings);hub.changed();return hub.state.settings;}
 case 'dialog:openExternal':return openUrl(args.url);
 case 'preview:open':{const url=allowedUrl(args.url,{localOnly:true});const preview=new BrowserWindow({title:'Sunny · Local preview',width:1100,height:780,parent:win,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});preview.webContents.setWindowOpenHandler(()=>({action:'deny'}));preview.webContents.on('will-navigate',(event,target)=>{try{allowedUrl(target,{localOnly:true});}catch{event.preventDefault();}});preview.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));await preview.loadURL(url);return;}
 case 'app:importChatGPT':{const result=await dialog.showOpenDialog(win,{title:'Import ChatGPT conversations.json',filters:[{name:'ChatGPT export',extensions:['json']}],properties:['openFile']});if(result.canceled)return null;const file=result.filePaths[0];if(fs.statSync(file).size>150*1024*1024)throw Error('Export exceeds the 150 MB import limit.');const imported=require('./import.cjs').importConversations(JSON.parse(fs.readFileSync(file,'utf8')));const merged=new Map(importedHistory().map(c=>[c.id,c]));for(const item of imported)merged.set(item.id,item);const target=path.join(dataDir,'chatgpt-history.json');fs.writeFileSync(target+'.tmp',JSON.stringify([...merged.values()]),'utf8');fs.renameSync(target+'.tmp',target);return {count:imported.length};}
 case 'persistence:retry':return hub.retryPersistence();
 case 'app:export':{const result=await dialog.showSaveDialog(win,{defaultPath:'sunny-hq-backup.json',filters:[{name:'Sunny backup',extensions:['json']}]});if(result.canceled)return {};const backup={...hub.persistedImage(),exportedAt:new Date().toISOString(),exportPersistence:{...hub.state.persistence}};fs.writeFileSync(result.filePath,JSON.stringify(backup,null,2),'utf8');return {path:result.filePath};}
 case 'docker:list':{const raw=await command(catalog.getExecutable('docker',home),['ps','-a','--format','{{json .}}'],home);return raw.trim()?raw.trim().split('\n').map(s=>JSON.parse(s)):[];}
 case 'docker:action':{if(!/^[a-zA-Z0-9_.-]+$/.test(args.id||'')||!['start','stop','logs'].includes(args.action))throw Error('Invalid container action');return command(catalog.getExecutable('docker',home),args.action==='logs'?['logs','--tail','100',args.id]:[args.action,args.id],home);}
 case 'github:prs':return JSON.parse(await command(catalog.getExecutable('gh',home),['pr','list','--json','number,title,state,url,headRefName,statusCheckRollup'],(await executionProject(args)).path));
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
  watchSurface(companion,'companion');
  companion.webContents.setWindowOpenHandler(()=>({action:'deny'}));companion.webContents.on('will-navigate',e=>e.preventDefault());
  companion.on('close',e=>{if(!quitting){e.preventDefault();companion.hide();}});
  const dev=process.env.SUNNY_DEV_URL;
  if(dev){const url=new URL(allowedUrl(dev,{localOnly:true}));url.searchParams.set('companion','1');await companion.loadURL(url.href);}else await companion.loadFile(path.join(__dirname,'../dist/index.html'),{query:{companion:'1'}});
  companion.showInactive();
 })();
 try{await companionLoading;}catch(e){companion?.destroy();companion=undefined;throw e;}finally{companionLoading=undefined;}
}
async function createWindow(){win=new BrowserWindow({title:'Sunny HQ',width:1520,height:980,minWidth:1000,minHeight:700,show:!smoke&&!fixture,backgroundColor:'#f7f5ef',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),backgroundThrottling:!smoke,contextIsolation:true,nodeIntegration:false,sandbox:true}});win.webContents.setWindowOpenHandler(({url})=>{if(fixture)return {action:'deny'};openUrl(url).catch(()=>{});return {action:'deny'};});win.webContents.on('will-navigate',event=>event.preventDefault());win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
 watchSurface(win,'hub');
 ipcMain.handle('sunny:invoke',async(event,action,args)=>{const sender=[win,companion].find(surface=>surface&&!surface.isDestroyed()&&event.sender===surface.webContents&&event.senderFrame===surface.webContents.mainFrame);if(!sender)throw Error('Untrusted window');if(action==='companion:mouse'&&sender!==companion)throw Error('Companion only');return handle(action,args,sender===companion?'companion':'hub');});
 hub.on('event',event=>{if(event.type==='diagnostic'){diagnostic(event.data.event,{surface:'backend'});return;}if(event.type==='snapshot')emit('snapshot');else emit(event.type,event.data);if(event.type==='completed'&&hub.state.settings.notifications&&!win.isFocused()&&Notification.isSupported())new Notification({title:event.data.status==='finished'?'Work ready to review':'Your crew needs attention',body:event.data.title}).show();});
 win.on('minimize',()=>{if(!quitting&&!smoke)void showCompanion().catch(e=>emit('error',{message:e.message}));});win.on('restore',()=>companion?.hide());
 win.on('close',event=>{if(!quitting&&!smoke){event.preventDefault();win.hide();void showCompanion().catch(e=>emit('error',{message:e.message}));}});
 const dev=process.env.SUNNY_DEV_URL;if(dev)await win.loadURL(allowedUrl(dev,{localOnly:true}));else await win.loadFile(path.join(__dirname,'../dist/index.html'));
 const icon=nativeImage.createFromPath(path.join(__dirname,'../dist/assets/thousand-sunny.png')).resize({width:32,height:32});tray=new Tray(icon);tray.setToolTip('Sunny HQ');tray.setContextMenu(Menu.buildFromTemplate([{label:'Open Sunny HQ',click:()=>restoreHub()},{label:'Ship on desktop',click:()=>{void showCompanion().then(()=>win.minimize()).catch(e=>emit('error',{message:e.message}));}},{label:'Quit',click:async()=>{if(quitLifecycle.failure){await offerFailedQuit(quitLifecycle.failure);return;}const active=hub.state.tasks.filter(t=>['working','waiting','starting'].includes(t.status));if(active.length||hub.discussionRun){const r=await dialog.showMessageBox(win,{type:'question',buttons:['Keep working','Interrupt and quit'],defaultId:0,cancelId:0,message:`${active.length} task(s) are still active.${hub.discussionRun?' A crew discussion is also underway.':''}`});if(r.response===0)return;await Promise.allSettled(active.map(t=>hub.interrupt(t.id)));}hub.cancelDiscussion();quitting=true;app.quit();}}]));tray.on('click',()=>restoreHub());
 if(!fixture)try{await hub.connect();}catch(e){console.error('Codex connection:',e.message);}
 if(fixture){await packagedFixture.runPackagedAcceptance({app,profileDir:fixture.profileDir,outputDir:fixture.outputDir,scenario:fixture.scenario,fixtureTransport:{win,hub,manifest:fixture,buildInfo,diagnosticEvents:fixtureDiagnosticEvents}});quitting=true;if(['main-restart','run-ui'].includes(fixture.scenario)&&fixture.phase===1)app.exit(73);else app.quit();}
 if(smoke){win.showInactive();await require('./smoke.cjs')({win,hub,handle,terminals});await require('./companion-smoke.cjs')({win,handle,getCompanion:()=>companion});await require('./growth-smoke.cjs')({win,hub,handle});await require('./walking-smoke.cjs')({win,hub});await require('./captain-smoke.cjs')({win,hub,handle});await require('./island-smoke.cjs')({win,hub,handle});await require('./news-smoke.cjs')({win,hub,handle});await require('./recovery-smoke.cjs')({win,hub});await new Promise(r=>setTimeout(r,1800));const state=publicState();const checks={title:await win.webContents.getTitle(),projects:state.projects.length,tools:state.tools.length,codex:state.codex.status,models:state.models.length,body:await win.webContents.executeJavaScript('document.body.innerText.slice(0,900)'),images:await win.webContents.executeJavaScript('Array.from(document.images).map(i=>({src:i.src,width:i.naturalWidth}))')};if(!checks.body.trim()||!await win.webContents.executeJavaScript('Boolean(document.querySelector(".home-page,.island-scene"))'))throw Error('The final app view did not render.');const screenshot=await captureSmokePage();const output=path.join(process.cwd(),'.sunny-dev','desktop-smoke.png');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,screenshot.toPNG());console.log('SUNNY_SMOKE '+JSON.stringify({...checks,screenshot:output}));quitting=true;app.quit();}
}
app.whenReady().then(async()=>{hub=fixture?await packagedFixture.bootFixtureHub(fixture):await bootHub({home,dataDir,catalog});hub.managedWorkspaceRoot=path.join(fixture?.profileDir||path.join(home,'AppData','Local','Sunny HQ'),'execution-workspaces');publicTransport=require('./public-transport.cjs').createPublicTransport(hub);publicTransport.bindTranscript(emitEnvelope);const store=hub.store;if(!smoke&&!fixture){hub.state.news.captureMode='chatgpt-auto';hub.markDirty();hub.scheduleSave();morgansInboxes=[[app.getPath('downloads'),new Map()]];if(process.env.SUNNY_MORGANS_INBOX&&path.isAbsolute(process.env.SUNNY_MORGANS_INBOX))morgansInboxes.push([process.env.SUNNY_MORGANS_INBOX,new Map()]);}if(store.recovery&&!smoke&&!fixture)await dialog.showMessageBox({type:"info",title:"Sunny recovered local data",message:"Unreadable saved data was preserved for recovery. Sunny will open with defaults.",detail:store.recovery});const newsArg=process.argv.find(a=>a.startsWith('--import-briefing='));if(newsArg&&!fixture)importNewsFile(newsArg.slice('--import-briefing='.length));await createWindow();if(!smoke&&!fixture){scanMorgansBriefings();morgansScanTimer=setInterval(scanMorgansBriefings,30000);}}).catch(async e=>{if(hub)try{await hub.close();}catch{}diagnostic('startup-failed');console.error(e);if(!smoke&&!fixture)dialog.showErrorBox('Sunny could not start',e.message);quitting=true;app.exit(1);});
async function offerFailedQuit(error){
 quitting=false;restoreHub();
 const result=await dialog.showMessageBox(win,{type:'warning',title:'Sunny still has unsaved work',buttons:['Keep window open','Quit without saving'],defaultId:0,cancelId:0,message:'Storage did not finish saving. Keep this window open to copy or export drafts before restarting Sunny.',detail:String(error.message).slice(0,1500)});
 if(result.response===1){quitting=true;app.exit(1);}
}
const quitLifecycle=createQuitLifecycle({
 shutdown:async()=>{quitting=true;if(morgansScanTimer)clearInterval(morgansScanTimer);if(hub)await hub.close();},
 onClosed:()=>{for(const terminal of terminals.values())try{terminal.kill();}catch{}app.quit();},
 onFailed:async error=>{diagnostic('shutdown-failed');console.error('Sunny shutdown did not save:',error);if(smoke||fixture){app.exit(1);return;}await offerFailedQuit(error);}
});
app.on('before-quit',event=>{void quitLifecycle.beforeQuit(event);});
app.on('window-all-closed',()=>{if(quitting)app.quit();});app.on('activate',()=>restoreHub());






}
