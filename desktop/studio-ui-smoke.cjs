// Presentation checks against workflow-smoke's isolated synthetic transport.
const assert=require('node:assert/strict');
async function check({js,wait,fill,select,click,nav,screenshot,win,state,emit,toolLaunches}){
 await nav('Home');
 await wait('Boolean(document.querySelector(".captain-dashboard"))');
 await js('document.getElementById("sunny-main").scrollTo({top:0,behavior:"instant"})');
 assert.equal(await js('document.querySelectorAll(".captain-watch").length'),1);
 assert.ok(await js('document.querySelector(".captain-hero-art img").complete&&document.querySelector(".captain-hero-art img").naturalWidth>0'));
 const originalMotion=state.settings.reducedMotion;
 try{
  state.settings.reducedMotion=false;emit();
  await wait('!document.querySelector(".voyage-ui").classList.contains("reduce-motion")');
  assert.equal(await js('getComputedStyle(document.querySelector(".home-page")).animationName'),'studio-arrive');
  win.webContents.debugger.attach('1.3');
  try{
   await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
   await wait('getComputedStyle(document.querySelector(".home-page")).animationName==="none"');
  }finally{await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});win.webContents.debugger.detach();}
  state.settings.reducedMotion=true;emit();
  await wait('getComputedStyle(document.querySelector(".home-page")).animationName==="none"');
  await fill('#luffy-objective','Keep this design review draft.');
  for(const [width,height,label] of [[1440,1050,'desktop'],[1280,800,'laptop'],[390,844,'phone']]){
   win.setSize(width,height);await wait(`innerWidth<=${width}`);
   await js('document.getElementById("sunny-main").scrollTo({top:0,behavior:"instant"})');
   assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'home fits '+label);
   await screenshot('studio-home-'+label+'.png');
   await js('document.querySelector(".local-captain").scrollIntoView({block:"start",behavior:"instant"})');
   await screenshot('studio-compose-'+label+'.png');
   await js('document.querySelector(".captain-watch").scrollIntoView({block:"start",behavior:"instant"})');
   await screenshot('studio-watch-'+label+'.png');
  }
  win.setSize(1440,1050);await wait('innerWidth>1000');
  await nav('Crew');await fill('[aria-label="Find a Straw Hat specialist"]','accessibility');
  await wait('document.querySelectorAll(".core-crew-grid>.crew-card").length===1');
  assert.equal(await js('document.querySelector(".core-crew-grid h3").textContent'),'Sanji');
  await fill('[aria-label="Find a Straw Hat specialist"]','no-such-specialist');
  await wait('Boolean(document.querySelector(".crew-page .projects-empty"))');
  await click('.crew-page .projects-empty button');
  assert.equal(await js('document.querySelectorAll(".core-crew-grid>.crew-card").length'),9);
  await screenshot('studio-crew-desktop.png');
  await js('document.querySelector(".core-crew-grid>.crew-card:last-child").scrollIntoView({block:"end",behavior:"instant"})');
  await screenshot('studio-crew-second-row.png');
  win.setSize(390,844);await wait('innerWidth<400');
  await js('document.getElementById("sunny-main").scrollTo({top:0,behavior:"instant"})');
  assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'crew fits phone');
  await screenshot('studio-crew-phone.png');
  win.setSize(1440,1050);await wait('innerWidth>1000');
  await nav('Tools');
  await select('[aria-label="Tool launch project"]','launch');
  await fill('[aria-label="Search tools"]','Terminal');
  await wait('document.querySelectorAll(".tool-card").length===1');
  await click('.tool-card');
  assert.equal(toolLaunches.at(-1)?.projectId,'launch','tool launch uses the explicitly selected project');
  await fill('[aria-label="Search tools"]','no-such-tool');
  await wait('Boolean(document.querySelector(".projects-empty"))');
  await click('.projects-empty button');
  assert.ok(await js('document.querySelectorAll(".tool-card").length>1'));
  for(const name of ['Projects','Missions','Inbox','Library','Tools','Settings']){
   await nav(name);await js('document.getElementById("sunny-main").scrollTo({top:0,behavior:"instant"})');
   assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),name+' fits desktop');
   await screenshot('studio-'+name.toLowerCase()+'-desktop.png');
   win.setSize(390,844);await wait('innerWidth<400');
   assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),name+' fits phone');
   await screenshot('studio-'+name.toLowerCase()+'-phone.png');
   win.setSize(1440,1050);await wait('innerWidth>1000');
  }
  await nav('Home');assert.equal(await js('document.querySelector("#luffy-objective").value'),'Keep this design review draft.');
  win.webContents.setZoomFactor(2);await wait('innerWidth<800');
  assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'home fits 200 percent zoom');
  await screenshot('studio-home-zoom.png');
 }finally{win.webContents.setZoomFactor(1);state.settings.reducedMotion=originalMotion;emit();}
}
module.exports={check};
