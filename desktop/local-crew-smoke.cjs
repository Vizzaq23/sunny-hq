// Synthetic model transport; exercises production local service and renderer without Ollama.
const assert=require('node:assert/strict');
const {Growth}=require('./growth.cjs');
const {LocalCrew,initialLocalCrew}=require('./local-crew.cjs');
const fs=require('node:fs'),path=require('node:path');
function fixture(state,emit){
 const growth=new Growth();state.growth=growth.data;state.localCrew=initialLocalCrew();
 const hub={state,growth,project(id){const p=state.projects.find(p=>p.id===id);if(!p)throw Error('Unknown project');return p;},persist(){},changed:emit};
 fs.writeFileSync(path.join(state.projects[0].path,'local-review-example.ts'),'export function first(items: string[]) {\n  return items[0].trim();\n}\n');
 let hold=false,lastChat,recallDelay=0;
 const service=new LocalCrew(hub,{request:async(route,_body,signal)=>{
  if(route==='tags')return {models:[{name:'fixture:local',size:1024**3,details:{format:'gguf'}}]};
  if(route==='show')return {details:{format:'gguf'}};
  lastChat=_body;
  if(hold)await new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('Fixture cancelled')),{once:true}));
  if(_body.messages.at(-1).content.startsWith('Plan a local advisory council'))return {done:true,message:{role:'assistant',content:JSON.stringify({summary:'Franky drafts a fix; Usopp checks edge cases.',assignments:[{crewId:'franky',objective:'Propose the fix.'},{crewId:'usopp',objective:'Plan regression checks.'}]})}};
  return {done:true,message:{role:'assistant',content:'Fixture advice: add a null guard and verify the empty-input case. No tests were run.'}};
 }});
 hub.localCrew=service;hub.localCouncil=new (require('./local-council.cjs').LocalCouncil)(hub);
 return {hub,hold(value){hold=value;},delayRecall(value){recallDelay=value;},lastChat:()=>lastChat,invoke(action,args){const method=action.split(':')[1];if(action.startsWith('localCouncil:')){if(!['setup','roster','start','stop','report','stopReport'].includes(method))throw Error('Unknown council fixture action');return hub.localCouncil[method](args);}if(!['models','configure','ask','stop','teach','clear','source','recall'].includes(method))throw Error('Unknown fixture action');const result=service[method](...(method==='models'?[]:[args]));return method==='recall'&&recallDelay?new Promise(resolve=>setTimeout(()=>resolve(result),recallDelay)):result;}};
}
async function check({js,wait,fill,select,click,nav,screenshot,win,localFixture}){
 await nav('Crew');
 await wait('Boolean(document.querySelector(".crew-grid"))');
 const open=()=>js(`(()=>{const button=document.querySelector('.crew-card[data-crew-id=franky]').querySelector('.journal-open');button.focus();button.click();})()`);
 await open();
 await wait('Boolean(document.querySelector(".crew-journal"))');
 assert.ok(await js('(()=>{const rect=document.querySelector(".crew-journal").getBoundingClientRect();return rect.top>=0&&rect.bottom<=innerHeight&&document.querySelector("dialog.journal-backdrop").matches(":modal");})()'),'journal stays in the viewport and makes the background inert');
 assert.equal(await js('document.activeElement.getAttribute("aria-label")'),'Close profile');
 await js(`Array.from(document.querySelectorAll('.crew-journal nav button')).find(b=>b.textContent==='Local profile').click()`);
 await select('[aria-label="Specialist project"]','studio');
 const button=async label=>{await js(`Array.from(document.querySelectorAll('.local-crew-panel button')).find(b=>b.textContent===${JSON.stringify(label)}).click()`);};
 await button('Refresh local models');await wait(`document.querySelector('[aria-label="Local model"]').options.length===2`);
 await select('[aria-label="Local model"]','fixture:local');await fill('[aria-label="Personal instructions"]','  Explain the tradeoffs before proposing a patch.  ');await button('Save local setup');await wait('document.querySelector(".local-crew-panel").textContent.includes("Model and skills saved")');
 assert.equal(await js(`document.querySelector('[aria-label="Personal instructions"]').value`),'Explain the tradeoffs before proposing a patch.','saved guidelines use canonical text without a permanently dirty setup');
 await js('document.querySelector(".local-crew-panel>details summary").focus()');win.focus();win.webContents.focus();win.webContents.sendInputEvent({type:'keyDown',keyCode:'Tab'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Tab'});await new Promise(resolve=>setTimeout(resolve,50));
 assert.ok(await js('document.activeElement===document.querySelector(".local-source-picker summary")'),'Tab skips controls in collapsed model setup');
 await fill('[aria-label="Project lesson"]','Use explicit null checks for this project.');await button('Remember correction');await wait(`document.querySelector('[aria-label="Project lesson"]').value===""`);
 const originalQuestion='    if value is None:\n        return []\n';
 await fill('[aria-label="Ask Franky"]',originalQuestion);
 await js('document.querySelector(".local-source-picker").open=true');
 await fill('[aria-label="Source file path"]','local-review-example.ts');await button('Preview source');
 await wait(`Boolean(document.querySelector('[aria-label="Source preview"]'))`);
 assert.match(await js(`document.querySelector('[aria-label="Source preview"]').value`),/2:   return items\[0\].trim/);
 assert.equal(localFixture.lastChat(),undefined,'preview does not contact the model');
 if(process.argv.includes('--local-crew-only')){
  await js('document.querySelector(".local-source-picker").scrollIntoView({block:"center"})');await screenshot('local-crew-source-preview.png');
  const [width,height]=win.getSize();win.setSize(480,800);await new Promise(resolve=>setTimeout(resolve,150));
  assert.ok(await js('(()=>{const panel=document.querySelector(".local-source-picker").getBoundingClientRect();return panel.left>=0&&panel.right<=innerWidth;})()'),'source preview fits a narrow window');
  await screenshot('local-crew-source-preview-compact.png');win.setSize(width,height);
 }
 await button('Add preview to question');await wait(`document.querySelector('[aria-label="Ask Franky"]').value.includes('Source snapshot')`);
 assert.ok((await js(`document.querySelector('[aria-label="Ask Franky"]').value`)).startsWith(originalQuestion+'\n\nSource snapshot'),'attaching source preserves the original code indentation and trailing newline');
 await js('document.querySelector(".local-recall-preview").open=true');localFixture.delayRecall(150);await button('Preview recall');
 const withSource=await js(`document.querySelector('[aria-label="Ask Franky"]').value`);await fill('[aria-label="Ask Franky"]',withSource+'\nFocus on empty input.');
 await new Promise(resolve=>setTimeout(resolve,200));assert.equal(await js('document.querySelectorAll(".local-recall-preview article").length'),0,'changed question rejects late recall preview');localFixture.delayRecall(0);
 await button('Preview recall');await wait('document.querySelectorAll(".local-recall-preview article").length===1');
 assert.match(await js('document.querySelector(".local-recall-preview").textContent'),/Use explicit null checks/);assert.equal(localFixture.lastChat(),undefined,'recall preview does not contact the model');
 if(process.argv.includes('--local-crew-only')){await js('document.querySelector(".local-recall-preview").scrollIntoView({block:"center"})');await screenshot('local-crew-recall-preview.png');}
 await wait('!document.querySelector(".local-crew-panel button[type=submit]").disabled');
 await js('document.querySelector(".local-crew-panel button[type=submit]").focus()');
 win.focus();win.webContents.focus();await new Promise(resolve=>setTimeout(resolve,100));
 win.webContents.sendInputEvent({type:'keyDown',keyCode:'Enter'});win.webContents.sendInputEvent({type:'char',keyCode:'\r'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Enter'});
 await wait('document.querySelectorAll(".local-crew-messages article").length===2');
 await wait(`document.querySelector('[aria-label="Ask Franky"]').value===""`);
 assert.match(await js('document.querySelector(".local-crew-messages").textContent'),/No tests were run/);
 assert.match(JSON.stringify(localFixture.lastChat().messages),/local-review-example.ts/);assert.match(localFixture.lastChat().messages[0].content,/Explain the tradeoffs before proposing a patch/);
 await screenshot(process.argv.includes('--local-crew-only')?'local-crew-developer.png':'local-crew-hidden-capture.png');
 await select('[aria-label="Specialist project"]','launch');assert.equal(await js('document.querySelectorAll(".local-crew-messages article").length'),0,'other project does not inherit messages');
 assert.equal(await js(`document.querySelector('[aria-label="Source file path"]').value`),'','project switch resets source selection');
 await fill('[aria-label="Ask Franky"]','Unsent project draft');await fill('[aria-label="Personal instructions"]','Unsent developer guidelines');
 await click('[aria-label="Close profile"]');
 await open();
 await js(`Array.from(document.querySelectorAll('.crew-journal nav button')).find(b=>b.textContent==='Local profile').click()`);
 await select('[aria-label="Specialist project"]','launch');assert.equal(await js(`document.querySelector('[aria-label="Ask Franky"]').value`),'Unsent project draft');
 assert.equal(await js(`document.querySelector('[aria-label="Personal instructions"]').value`),'Unsent developer guidelines');assert.ok(await js('document.querySelector(".local-crew-panel button[type=submit]").disabled'),'unsaved guidelines gate inference');await button('Save local setup');await wait('!document.querySelector(".local-crew-panel button[type=submit]").disabled');
 localFixture.hold(true);await button('Ask locally');await wait('document.querySelector(".local-crew-panel").textContent.includes("Stop local reply")');
 await click('[aria-label="Close profile"]');await open();await js(`Array.from(document.querySelectorAll('.crew-journal nav button')).find(b=>b.textContent==='Local profile').click()`);
 await wait('document.querySelector(".local-crew-panel").textContent.includes("Stop other local reply")');await button('Stop other local reply');
 await select('[aria-label="Specialist project"]','launch');await wait('document.querySelector(".local-crew-panel").textContent.includes("Reply interrupted")');localFixture.hold(false);
 assert.equal(await js('document.querySelectorAll(".local-crew-messages article").length'),1,'cancelled reply adds no assistant message');
 await js(`document.querySelector('[aria-label="Close profile"]').focus()`);
 win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
 await wait('!document.querySelector(".crew-journal")');assert.equal(await js('document.activeElement===document.querySelector("[data-crew-id=franky] .journal-open")'),true,'Escape returns focus');
 await nav('Home');
}
module.exports={fixture,check};
