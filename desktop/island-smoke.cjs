const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async({win,hub,handle})=>{
 const saved=JSON.parse(JSON.stringify(hub.state.world));
 try{
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.sidebar button')).find(b=>b.textContent.trim()==='The Island').click()`);await pause(1000);
  assert.equal(await win.webContents.executeJavaScript(`document.querySelectorAll('.island-district').length`),6);
  assert.ok(await win.webContents.executeJavaScript(`document.querySelector('.island-art').naturalWidth>1000`));
  await win.webContents.executeJavaScript(`(()=>{const s=document.querySelector('[aria-label="Parallel island jobs"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'3');s.dispatchEvent(new Event('change',{bubbles:true}));})()`);await pause(150);assert.equal(hub.state.world.maxConcurrentJobs,3);
  await handle('island:concurrency',{limit:1});await pause(150);assert.equal(await win.webContents.executeJavaScript(`document.querySelector('[aria-label="Parallel island jobs"]').value`),'1');
  const before=await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.island-actors .deck-crew')).map(c=>c.style.left)`);await pause(3500);const after=await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.island-actors .deck-crew')).map(c=>c.style.left)`);assert.notDeepEqual(after,before);
  await win.webContents.executeJavaScript(`document.querySelector('[aria-label="Zoom in"]').click()`);await pause(150);assert.equal(await win.webContents.executeJavaScript(`document.querySelector('.island-scene').style.width`),'125%');
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.island-map-toolbar button')).find(b=>b.textContent.includes('%')).click()`);
  for(const id of ['law','ace','vivi','perona'])await handle('island:resident',{id,recruited:true});await pause(500);
  assert.equal(await win.webContents.executeJavaScript(`document.querySelectorAll('.island-resident').length`),4);assert.equal(await win.webContents.executeJavaScript(`getComputedStyle(document.querySelector('.island-actors .pet-sprite,.island-actors .walk-sprite')).backgroundSize`),'576px 360px');
  await handle('island:resident',{id:'law',role:'Fixture diagnostic specialist'});assert.equal(hub.state.world.residents.find(r=>r.id==='law').role,'Fixture diagnostic specialist');
  const job=await handle('island:saveJob',{name:'Island verification brief',crewId:'law',projectId:hub.state.projects[0].id,district:'engineering',objective:'Synthetic fixture. No model run requested.',intervalMinutes:60,maxRunsPerDay:1,maxTotalRuns:2,maxRunMinutes:5,dailyTokenLimit:1000,requiresReview:true});await pause(180);
  assert.match(await win.webContents.executeJavaScript(`document.querySelector('.island-job-list').innerText`),/Island verification brief/);assert.equal(job.enabled,false);assert.equal(hub.state.world.paused,true);
  const other=await handle('island:saveJob',{...job,id:undefined,name:'Other district job',district:'research'});await pause(150);assert.doesNotMatch(await win.webContents.executeJavaScript(`document.querySelector('.island-job-list').innerText`),/Other district job/);
  await win.webContents.executeJavaScript(`document.querySelector('.all-jobs-toggle input').click()`);await pause(150);assert.match(await win.webContents.executeJavaScript(`document.querySelector('.island-job-list').innerText`),/Other district job/);
  await win.webContents.executeJavaScript(`document.querySelector('.island-autonomy button').click()`);await pause(150);assert.equal(hub.state.world.paused,false);await win.webContents.executeJavaScript(`document.querySelector('.island-autonomy button').click()`);await pause(150);assert.equal(hub.state.world.paused,true);
  fs.writeFileSync(path.join(process.cwd(),'.sunny-dev','island-world.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.island-control nav button')).find(b=>b.textContent.includes('Recruit')).click()`);await pause(150);assert.equal(await win.webContents.executeJavaScript(`document.querySelectorAll('.island-resident-list article').length`),4);
  await handle('island:revenue',{amount:12.34,note:'Synthetic verification receipt'});assert.equal(hub.state.world.ledger.at(-1).source,'manual');
  console.log('SUNNY_ISLAND '+JSON.stringify({districts:6,residents:4,movement:true,zoom:true,recruitment:true,editableRoles:true,pausedJobs:true,pauseSwitch:true,manualRevenue:true}));
 }finally{hub.state.world=saved;hub.changed();}
};
