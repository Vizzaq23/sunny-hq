// Production renderer with synthetic IPC and an isolated profile. No provider or user files.
const {app,BrowserWindow,ipcMain}=require('electron');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-charts-'));
app.setPath('userData',path.join(output,'profile'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const project={id:'charts',name:'Charts fixture',path:output,category:'development'};
const state={projects:[project],tasks:[],missions:[],approvals:[],settings:{reducedMotion:true,notifications:false},codex:{status:'disconnected'},models:[],tools:[],automations:[],world:{paused:true,residents:[],jobs:[],ledger:[]}};
let reads=0,lists=0,failRead=true,readDelay=0;const listedPaths=[];
const lateTarget={name:'Captain Late Target.md',path:path.join(output,'Captain Late Target.md'),directory:false};
const rootEntries=[{name:'README.md',path:path.join(output,'README.md'),directory:false},{name:'docs',path:path.join(output,'docs'),directory:true},...Array.from({length:304},(_,index)=>({name:`entry-${String(index+1).padStart(3,'0')}.md`,path:path.join(output,`entry-${String(index+1).padStart(3,'0')}.md`),directory:false})),lateTarget,{name:'.env.md',path:path.join(output,'.env.md'),directory:false},{name:'secrets.env',path:path.join(output,'secrets.env'),directory:false},{name:'notes.txt',path:path.join(output,'notes.txt'),directory:false}];
ipcMain.handle('sunny:invoke',async(_event,action,args)=>{
 if(action==='snapshot')return state;
 if(action==='asset:crewTexture'||action==='app:diagnostic')return null;
 if(action==='files:list'){lists++;listedPaths.push(args.path);assert.equal(args.projectId,'charts');if(args.path===path.join(output,'docs'))return [];assert.equal(args.path,'');return rootEntries;}
 if(action==='files:read'){reads++;assert.equal(args.path,path.join(output,'README.md'));if(failRead)throw Error('Fixture document unavailable');await delay(readDelay);return {path:args.path,text:'# Project chart\n<script>window.chartExecuted=true</script>',hash:'fixture'};}
 throw Error('Unexpected fixture action '+action);
});
app.whenReady().then(async()=>{
 const win=new BrowserWindow({width:1200,height:900,show:false,webPreferences:{offscreen:true,preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false}});
 const js=code=>win.webContents.executeJavaScript(code);
 const wait=async code=>{for(let i=0;i<100;i++){if(await js(code))return;await delay(50);}throw Error('Timed out: '+code);};
 try{
  await win.loadFile(path.join(__dirname,'../dist/index.html'));
  await wait('Boolean(document.querySelector(".home-page,.island-page"))');
  await js('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="The Island").click()');
  await wait('Boolean(document.querySelector(".island-project-doors button"))');
  await js('document.querySelector(".island-project-doors button").click()');
  await wait('Boolean(document.querySelector(".project-room-scene"))');
  assert.equal(await js('Boolean(document.querySelector(".project-charts"))'),true,'Room exposes project charts');
  assert.equal(lists,0,'No filesystem listing until explicitly opened');assert.equal(reads,0);
  await js('document.querySelector(".project-charts summary").click()');
  await wait('Boolean(document.querySelector(".project-charts .chart-document"))');
  assert.equal(await js('document.querySelector(".project-charts").textContent.includes(".env")'),false);
  assert.equal(reads,0,'Listing never reads document contents');
  assert.equal(await js('document.querySelector(".project-charts").textContent.includes("Captain Late Target.md")'),false,'Late target starts beyond visible limit');
  await js('(()=>{const input=document.querySelector(".project-charts input[aria-label=\'Filename filter\']");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"LATE TARGET");input.dispatchEvent(new Event("input",{bubbles:true}))})()');
  await wait('document.querySelector(".project-charts .chart-document")?.textContent.includes("Captain Late Target.md")');
  assert.equal(await js('document.querySelector(".project-charts .chart-document").textContent'),'Captain Late Target.md','Case-insensitive filename filter finds late target');
  await js('(()=>{const input=document.querySelector(".project-charts input[aria-label=\'Filename filter\']");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"does-not-exist");input.dispatchEvent(new Event("input",{bubbles:true}))})()');
  await wait('document.querySelector(".project-charts").textContent.includes("No Markdown documents match")');
  await js('(()=>{const input=document.querySelector(".project-charts input[aria-label=\'Filename filter\']");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"");input.dispatchEvent(new Event("input",{bubbles:true}))})()');
  await wait('document.querySelector(".project-charts .chart-document")?.textContent.includes("README.md")');
  await js('document.querySelector(".chart-document").click()');
  await wait('document.querySelector(".project-charts [role=alert]")?.textContent.includes("unavailable")');
  failRead=false;await js('document.querySelector(".chart-document").click()');
  await wait('document.querySelector(".chart-preview")?.textContent.includes("Project chart")');
  assert.equal(await js('Boolean(window.chartExecuted)'),false);
  assert.equal(await js('document.querySelector(".chart-preview").textContent.includes("<script>")'),true);
  assert.equal(reads,2);
  await js('(()=>{const input=document.querySelector(".project-charts input[aria-label=\'Filename filter\']");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"DOCS");input.dispatchEvent(new Event("input",{bubbles:true}))})()');
  await wait('document.querySelector(".project-charts input[aria-label=\'Filename filter\']").value==="DOCS"&&Boolean(document.querySelector(".chart-folder"))');
  await js('document.querySelector(".chart-folder").click()');
  await wait('document.querySelector(".project-charts nav").textContent.includes("docs")&&!document.querySelector(".project-charts [role=status]")');
  assert.equal(await js('document.querySelector(".project-charts input[aria-label=\'Filename filter\']").value'),'','Folder navigation clears filename filter');
  assert.equal(await js('Boolean(document.querySelector(".chart-preview"))'),false,'Folder navigation clears previous content');
  assert.equal(listedPaths.at(-1),path.join(output,'docs'),'Navigation requests selected directory');
  assert.equal(await js('document.querySelector(".project-charts").textContent.includes("No Markdown documents or docs folders here.")'),true,'Exact empty-directory message is visible');
  assert.equal(await js('document.querySelector(".project-charts").textContent.includes("documents match")'),false,'Empty directory is distinct from nonmatching names');
  await js('document.querySelector(".project-charts nav button").click()');
  await wait('!document.querySelector(".project-charts [role=status]")');
  readDelay=200;await js('document.querySelector(".chart-document").click();document.querySelector(".project-charts summary").click()');
  await delay(300);
  assert.equal(await js('Boolean(document.querySelector(".chart-preview"))'),false,'Collapsed shelf discards late content');
  await js('document.querySelector(".project-charts summary").click()');
  await wait('!document.querySelector(".project-charts [role=status]")');readDelay=0;
  await js('document.querySelector(".chart-document").click()');
  await wait('Boolean(document.querySelector(".chart-preview"))');
  await js('document.querySelector(".project-charts").scrollIntoView({block:"start"})');await delay(150);
  fs.writeFileSync(path.join(output,'charts.png'),(await win.webContents.capturePage()).toPNG());
  win.setSize(600,900);await delay(150);
  assert.equal(await js('document.documentElement.scrollWidth<=innerWidth'),true,'Narrow screen has no page overflow');
  fs.writeFileSync(path.join(output,'charts-narrow.png'),(await win.webContents.capturePage()).toPNG());
  console.log(JSON.stringify({ok:true,output,lists,reads,checks:['explicit listing','no environment entries','no automatic reads','read failure/retry','escaped text','folder navigation','late read discarded','narrow layout']}));
  win.destroy();app.exit(0);
 }catch(error){console.error(error);win.destroy();app.exit(1);}
});
