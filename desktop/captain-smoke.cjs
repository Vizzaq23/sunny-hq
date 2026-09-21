const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async({win,hub,handle})=>{
 const now=Date.now(),parent={id:'captain-ui-fixture',captain:true,crewId:'luffy',projectId:hub.state.projects[0].id,title:'Build the fictional compass',status:'working',turnId:'fixture-turn',createdAt:now,updatedAt:now,messages:[{id:'captain-msg',role:'assistant',text:'Franky is building the compass. I’ll bring his results back here.',time:now}]};
 const child={id:'captain-child-fixture',parentTaskId:parent.id,crewId:'franky',projectId:parent.projectId,title:'Build the compass',status:'waiting',model:'fixture-model',effort:'low',selectionReason:'Simple fixture uses light reasoning.',tokenUsage:{total:{totalTokens:1234}},createdAt:now+1,updatedAt:now+1,messages:[]};
 hub.state.tasks.unshift(parent,child);hub.state.approvals.push({id:'captain-approval-fixture',taskId:child.id,method:'item/commandExecution/requestApproval',params:{reason:'Synthetic crew permission check'}});hub.changed();await pause(200);
 try{
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Talk to Luffy').click()`);await pause(200);
  assert.match(await win.webContents.executeJavaScript(`document.querySelector('.deck-dialog').innerText`),/Luffy’s crew assignments/);
  assert.match(await win.webContents.executeJavaScript(`document.querySelector('.deck-dialog .crew-assignments').innerText`),/Franky/);
  await win.webContents.executeJavaScript(`document.querySelector('.deck-dialog .open-workspace').click()`);await pause(1200);
  assert.match(await win.webContents.executeJavaScript(`document.querySelector('.interrupt-button').innerText`),/Stop crew/);assert.match(await win.webContents.executeJavaScript(`document.querySelector('.crew-assignment').innerText`),/fixture-model · low reasoning/);assert.match(await win.webContents.executeJavaScript(`document.querySelector('.crew-assignment').innerText`),/1,234 reported session tokens/);
  assert.match(await win.webContents.executeJavaScript(`document.querySelector('.approval-stack').innerText`),/Synthetic crew permission check/);
  assert.equal(await win.webContents.executeJavaScript(`document.querySelector('.composer-foot button').disabled`),true);
  fs.writeFileSync(path.join(process.cwd(),'.sunny-dev','captain-assignments.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript(`document.querySelector('.crew-assignment').click()`);await pause(200);
  assert.match(await win.webContents.executeJavaScript(`document.querySelector('.workbench-head h2').innerText`),/^Build the compass$/);
  await win.webContents.executeJavaScript(`document.querySelector('.captain-return').click()`);await pause(200);
  assert.match(await win.webContents.executeJavaScript(`document.querySelector('.workbench-head h2').innerText`),/fictional compass/);
  await win.webContents.executeJavaScript(`document.querySelector('.workbench-head .round-button').click()`);await pause(150);
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.sidebar button')).find(b=>b.textContent.trim()==='Settings').click()`);await pause(180);assert.equal(await win.webContents.executeJavaScript(`document.querySelector('[aria-label="Crew execution preference"]').value`),'efficient');await handle('settings:update',{routingPolicy:'thorough'});await pause(150);assert.equal(await win.webContents.executeJavaScript(`document.querySelector('[aria-label="Crew execution preference"]').value`),'thorough');await handle('settings:update',{routingPolicy:'efficient'});await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.sidebar button')).find(b=>b.textContent.trim()==='The Sunny').click()`);await pause(150);console.log('SUNNY_CAPTAIN '+JSON.stringify({entry:true,linkedMissions:true,directSpecialist:true,returnToLuffy:true,childApprovals:true,stopCrew:true,modelChoice:true,reasoning:true,reportedTokens:true,executionPreference:true}));
 }finally{hub.state.tasks=hub.state.tasks.filter(t=>![parent.id,child.id].includes(t.id));hub.state.approvals=hub.state.approvals.filter(a=>a.id!=='captain-approval-fixture');hub.changed();}
};
