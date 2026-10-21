// Provider-free native renderer regression: run with electron scripts/crew-layout-check.cjs.
// Exported function is self-contained for CDP evaluation against an isolated packaged preview.
function measureCrewLayout(){
 const rect=e=>e.getBoundingClientRect().toJSON();
 const cards=Array.from(document.querySelectorAll('.crew-card')).map(card=>{const badge=card.querySelector('.crew-badge');return{name:card.querySelector('h3').textContent,card:rect(card),badge:rect(badge),hasArtwork:getComputedStyle(badge).backgroundImage!=='none',description:rect(card.querySelector('p')),buttons:Array.from(card.querySelectorAll(':scope > button')).map(b=>({text:b.textContent,rect:rect(b)}))};});
 const failures=[];
 if(cards.length!==10)failures.push(`Expected ten core Crew cards; found ${cards.length}`);
 for(const card of cards){
  if(card.badge.width!==82||card.badge.height!==82||!card.hasArtwork)failures.push(`${card.name} badge has no visible 82px artwork`);
  if(card.buttons.length!==2){failures.push(`${card.name} must have Journal and Start controls`);continue;}
  const [journal,start]=card.buttons.map(button=>button.rect);
  if(!(journal.width>0&&start.width>0&&journal.bottom+4<=start.top))failures.push(`${card.name} Journal and Start overlap or lack separation`);
  if(card.description.bottom>journal.top)failures.push(`${card.name} description overlaps Journal`);
  for(const button of card.buttons)if(button.rect.left<card.card.left||button.rect.right>card.card.right||button.rect.bottom>card.card.bottom)failures.push(`${card.name} control leaves card bounds`);
 }
 return{cards,failures};
}
module.exports={measureCrewLayout};
const isElectronEntry=Boolean(process.versions.electron)&&process.argv.slice(1).some(argument=>require('node:path').resolve(argument).toLowerCase()===__filename.toLowerCase());
if(require.main===module||isElectronEntry){
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const output=path.resolve(process.env.SUNNY_CREW_CHECK_OUTPUT||path.join(root,'.sunny-dev','crew-layout-check'));
fs.mkdirSync(output,{recursive:true});
console.log('CREW_FIXTURE_ENTRY '+JSON.stringify({electron:process.versions.electron,argv:process.argv,entry:__filename}));
app.setPath('userData',path.join(output,'isolated-profile'));
const watchdog=setTimeout(()=>{console.error('Crew fixture timed out after 30 seconds');app.exit(1);},30000);
app.on('will-quit',()=>clearTimeout(watchdog));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
 const win=new BrowserWindow({width:1440,height:1000,show:false,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});
 win.showInactive();
 win.webContents.on('console-message',(_event,level,message)=>console.log(`CREW_RENDERER_CONSOLE ${level}: ${String(message).slice(0,400)}`));
 const js=async code=>{try{return await win.webContents.executeJavaScript(code);}catch(error){throw Error(`Crew renderer evaluation failed: ${code.slice(0,500)}\n${error.message}`);}};
 const wait=async code=>{for(let i=0;i<100;i++){if(await js(code))return;await delay(50);}throw Error('UI wait timed out: '+code);};
 const failures=[],scenarios=[];
 try{
  await win.loadFile(path.join(root,'dist','index.html'));
  await wait('Boolean(document.querySelector(".home-page"))');
  assert.equal(await js('Boolean(window.sunny)'),false,'fixture has no privileged or provider bridge');
  await js('Array.from(document.querySelectorAll(".main-nav button")).find(b=>b.textContent.trim()==="Crew").click()');
  await wait('document.querySelectorAll(".crew-card").length===10');
  for(const [name,width,textScale] of [['desktop',1440,1],['minimum-desktop',1080,1],['narrow',320,1],['enlarged-text',1080,2]]){
   win.setContentSize(width,1000);
   await js(`(()=>{document.querySelector('#crew-check-text')?.remove();if(${textScale}>1){const style=document.createElement('style');style.id='crew-check-text';style.textContent='.crew-card .crew-station{font-size:18px}.crew-card h3{font-size:44px}.crew-card h4,.crew-card p,.crew-card>button{font-size:20px}';document.head.append(style);}})()`);
   await delay(180);
   const {cards,failures:layoutFailures}=await js(`(${measureCrewLayout.toString()})()`);
   scenarios.push({name,width,textScale,cards});
   failures.push(...layoutFailures.map(failure=>`${name}: ${failure}`));
   fs.writeFileSync(path.join(output,`${name}.json`),JSON.stringify({cards,failures:layoutFailures},null,2));
   fs.writeFileSync(path.join(output,`${name}.png`),(await win.webContents.capturePage()).toPNG());
  }
  fs.writeFileSync(path.join(output,'geometry.json'),JSON.stringify({bridge:false,scenarios,failures},null,2));
  assert.equal(failures.length,0,failures.join('\n'));
  await js('document.querySelector("#crew-check-text")?.remove()');win.setContentSize(1440,1000);await delay(120);
  await js('document.querySelector(".crew-card .journal-open").click()');
  await wait('Boolean(document.querySelector(".crew-journal"))');
  await delay(120);
  fs.writeFileSync(path.join(output,'journal.png'),(await win.webContents.capturePage()).toPNG());
  await js('document.querySelector(".crew-journal>header>button").click()');
  await wait('!document.querySelector(".crew-journal")');
  win.focus();
  win.webContents.focus();
  await js('document.querySelector(".crew-card .journal-open").focus()');
  await delay(100);
  const nativeFocus={windowFocused:win.isFocused(),webContentsFocused:win.webContents.isFocused(),...await js('({documentFocused:document.hasFocus(),activeTag:document.activeElement?.tagName,activeClass:document.activeElement?.className,journalFocused:document.activeElement===document.querySelector(".crew-card .journal-open")})')};
  fs.writeFileSync(path.join(output,'native-focus.json'),JSON.stringify(nativeFocus,null,2));
  console.log('CREW_NATIVE_FOCUS '+JSON.stringify(nativeFocus));
  const enter=()=>{win.webContents.sendInputEvent({type:'keyDown',keyCode:'Enter'});win.webContents.sendInputEvent({type:'char',keyCode:'\r'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Enter'});};
  enter();
  await wait('Boolean(document.querySelector(".crew-journal"))');
  const journalBadge=await js('document.querySelector(".crew-journal .crew-badge").getBoundingClientRect().toJSON()');
  if(journalBadge.width!==42||journalBadge.height!==42)failures.push('normal journal badge changed dimensions');
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
  await wait('!document.querySelector(".crew-journal")');
  assert.equal(await js('document.activeElement===document.querySelector(".crew-card .journal-open")'),true,'journal restores keyboard focus');
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'Tab'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Tab'});
  assert.equal(await js('document.activeElement===document.querySelector(".crew-card>button:last-child")'),true,'Start follows Journal in keyboard order');
  enter();
  await wait('Boolean(document.querySelector(".workbench"))');
  const report={bridge:false,scenarios,journalBadge,keyboard:{journalEnter:true,escapeFocusReturn:true,startTabEnter:true},failures};
  fs.writeFileSync(path.join(output,'geometry.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({scenarios:scenarios.map(s=>s.name),cardsPerScenario:10,keyboard:report.keyboard,failures}));
  assert.equal(failures.length,0,failures.join('\n'));
  app.exit(0);
 }catch(error){console.error(error);app.exit(1);}
}).catch(error=>{console.error(error);app.exit(1);});
}
