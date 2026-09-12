const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async({win,hub,handle})=>{
 const saved=JSON.parse(JSON.stringify(hub.state.news)),motion=hub.state.settings.reducedMotion,taskCount=hub.state.tasks.length;
 const js=s=>win.webContents.executeJavaScript(s);
 const click=text=>js(`Array.from(document.querySelectorAll('.morgans-page button')).find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
 try{
  hub.state.news=require('./news.cjs').initialNews();
  hub.news.importCapture({origin:'Synthetic UI verification',items:[{title:'A useful project source',url:'https://example.com/project',summary:'A bounded source summary.',why:'Useful to evaluate a project.',nextStep:'Verify the source before implementation.',category:'projects',source:'Test fixture'},{title:'A career source',url:'https://example.com/career',summary:'An example role.',why:'Compare requirements.',nextStep:'Assess fit without submitting an application.',category:'careers',source:'Test fixture'}]});await pause(300);
  for(let i=0;i<30;i++){if(await js(`Boolean(document.querySelector('.morgans-blimp img')?.src.startsWith('data:'))`))break;await pause(100);}
  assert.equal(await js(`(()=>{const i=document.querySelector('.morgans-blimp img'),c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);return x.getImageData(0,0,1,1).data[3];})()`),0);
  assert.match(await js(`document.querySelector('.morgans-blimp').innerText`),/2 new/);
  await handle('settings:update',{reducedMotion:true});await pause(150);assert.equal(await js(`getComputedStyle(document.querySelector('.morgans-blimp')).animationName`),'none');await handle('settings:update',{reducedMotion:motion});
  fs.writeFileSync(path.join(process.cwd(),'.sunny-dev','morgans-island.png'),(await win.webContents.capturePage()).toPNG());
  await js(`document.querySelector('.morgans-blimp').click()`);await pause(250);assert.equal(await js(`document.querySelectorAll('.morgans-story').length`),2);
  await click('Careers');await pause(100);assert.equal(await js(`document.querySelectorAll('.morgans-story').length`),1);assert.match(await js(`document.querySelector('.morgans-story h3').textContent`),/career/);
  await click('All dispatches');await pause(100);await click('Save');await pause(150);assert.equal(hub.state.news.items[0].status,'saved');
  fs.writeFileSync(path.join(process.cwd(),'.sunny-dev','morgans-briefing.png'),(await win.webContents.capturePage()).toPNG());
  await click('Discuss with Luffy ↗');await pause(1200);assert.match(await js(`document.querySelector('.composer textarea').value`),/Morgans brought this story/);assert.equal(hub.state.tasks.length,taskCount);
  await js(`document.querySelector('.workbench-head .round-button').click()`);await pause(150);await click('Back to the island');await pause(150);
  console.log('SUNNY_NEWS '+JSON.stringify({transparentBlimp:true,reducedMotion:true,unreadCount:true,categories:true,savedState:true,sourceProvenance:true,luffyDraft:true,noMissionStarted:true}));
 }finally{hub.state.news=saved;hub.state.settings.reducedMotion=motion;hub.changed();}
};
