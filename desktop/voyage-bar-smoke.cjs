const assert=require('node:assert/strict');
async function check({js,wait,fill,select,click,nav,screenshot,win,state,emit}){
 assert.match(await js('document.querySelector(".voyage-bar").textContent'),/No voyage selected/);
 const mission={id:'voyage-fixture',projectId:'studio',title:'Fixture voyage',objective:'Original bounded brief',acceptanceCriteria:['Inspect recorded evidence'],completionBoundary:'review',status:'RUNNING',connection:'connected',revision:1,createdAt:1,updatedAt:1,taskIds:['captain'],activeAttemptId:'voyage-attempt',attempts:[{id:'voyage-attempt',taskId:'captain',taskIds:['captain'],status:'running',startedAt:1}],artifacts:[],events:[]};
 state.missions.push(mission,{...mission,id:'other-voyage',projectId:'launch',title:'Other project',taskIds:[],activeAttemptId:undefined,attempts:[]});emit();
 await select('[aria-label="Selected voyage mission"]',mission.id);await wait('document.querySelector(".voyage-summary").textContent.includes("Attempt 1")');
 await nav('The Sunny');await wait('Boolean(document.querySelector(".helm-workspace"))');
 await click('.voyage-actions button:first-child');await wait('document.querySelector(".voyage-dialog").open');
 assert.equal(await js('document.querySelector(".voyage-brief").textContent'),mission.objective);
 win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
 await wait('!document.querySelector(".voyage-dialog").open');assert.equal(await js('document.activeElement.textContent'),'Original brief');
 assert.equal(await js('document.querySelector(".voyage-bar select").value'),mission.id);
 await click('.voyage-actions button:nth-child(2)');await wait('document.querySelector(".voyage-dialog").open');assert.ok(await js('Boolean(document.querySelector(".voyage-dialog .mission-board"))'));await click('.voyage-return');
 const permission={id:'voyage-permission',taskId:'captain',method:'item/commandExecution/requestApproval',params:{command:'npm test'}};state.approvals.push(permission);emit();await wait('document.querySelector(".voyage-summary").textContent.includes("Needs approval")');assert.match(await js('document.querySelector(".voyage-actions").textContent'),/Open request/);await screenshot('voyage-approval.png');state.approvals=state.approvals.filter(a=>a.id!==permission.id);
 for(const [status,label] of [['working','Working'],['waiting','Waiting'],['unknown','Check connection'],['failed','Failed'],['interrupted','Stopped'],['finished','review']]){
  state.tasks.find(t=>t.id==='captain').status=status;emit();await wait(`document.querySelector('.voyage-summary').textContent.toLowerCase().includes(${JSON.stringify(label.toLowerCase())})`);
  assert.doesNotMatch(await js('document.querySelector(".voyage-summary").textContent'),/Accepted by captain/);await screenshot('voyage-'+status+'.png');
 }
 win.setSize(400,900);await wait('innerWidth<450');assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'));await screenshot('voyage-compact.png');
 win.setSize(1440,1050);win.webContents.setZoomFactor(2);await screenshot('voyage-200-percent.png');assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'));win.webContents.setZoomFactor(1);
 // Saved historical or missing attempts cannot expose the current review.
 const originalAttempts=mission.attempts;mission.activeAttemptId='newer-attempt';emit();
 await wait('document.querySelector(".voyage-summary").textContent.includes("historical")');
 assert.equal(await js('document.querySelector(".voyage-actions button:nth-child(2)").disabled'),true);
 mission.attempts=[];emit();await wait('document.querySelector(".voyage-summary").textContent.includes("Attempt unavailable")');
 assert.equal(await js('document.querySelector(".voyage-actions button:nth-child(2)").disabled'),true);
 assert.equal(await js('document.querySelector(".voyage-actions button:nth-child(3)")'),null);
 mission.attempts=originalAttempts;mission.activeAttemptId='voyage-attempt';emit();
 await wait('!document.querySelector(".voyage-actions button:nth-child(2)").disabled');
 const key=keyCode=>{win.webContents.sendInputEvent({type:'keyDown',keyCode});if(keyCode==='Enter')win.webContents.sendInputEvent({type:'char',keyCode:'\r'});win.webContents.sendInputEvent({type:'keyUp',keyCode});};
 const keyboardActivate=async selector=>{await js(`document.querySelector(${JSON.stringify(selector)}).focus()`);key('Enter');};
 await js('document.querySelector(".voyage-bar select").focus()');key('Tab');
 await wait('document.activeElement.textContent==="Original brief"');key('Tab');
 await wait('document.activeElement.textContent==="Review mission"');key('Tab');
 await wait('document.activeElement.textContent==="Work controls"');
 state.approvals.push(permission);emit();await wait('document.activeElement.textContent==="Open request"');key('Enter');
 await wait('Boolean(document.querySelector(".workbench .composer textarea"))');
 await wait('Boolean(document.querySelector(".approval-card"))');
 await fill('.composer textarea','Preserve this voyage draft');
 for(const [position,label] of [[1,'Original brief'],[2,'Review mission']]){
  await keyboardActivate(`.voyage-actions button:nth-child(${position})`);await wait('document.querySelector(".voyage-dialog").open');
  key('Escape');await wait('!document.querySelector(".voyage-dialog").open');
  await wait(`document.activeElement.textContent===${JSON.stringify(label)}`);
  assert.equal(await js('document.querySelector(".composer textarea").value'),'Preserve this voyage draft');
 }
 state.approvals=state.approvals.filter(a=>a.id!==permission.id);state.tasks.find(t=>t.id==='captain').status='working';emit();
 await wait('Boolean(document.querySelector(".interrupt-button"))');await keyboardActivate('.interrupt-button');
 await wait('document.querySelector(".voyage-summary").textContent.includes("Stopped")');
 assert.equal(state.tasks.find(t=>t.id==='research').status,'working','Stop stays scoped to the selected project task');
 await nav('The Sunny');await wait('Boolean(document.querySelector(".helm-workspace"))');
 assert.equal(await js('document.querySelector(".voyage-bar select").value'),mission.id);
 await keyboardActivate('.voyage-actions button:nth-child(3)');await wait('Boolean(document.querySelector(".composer textarea"))');
 assert.equal(await js('document.querySelector(".composer textarea").value'),'Preserve this voyage draft');
 state.settings.reducedMotion=false;state.world.paused=false;emit();
 await wait('!document.querySelector(".app-shell").classList.contains("reduce-motion")');
 assert.match(await js('document.querySelector(".voyage-summary").textContent'),/Stopped/);
 await select('[aria-label="Selected voyage mission"]','other-voyage');await wait('document.querySelector(".voyage-summary").textContent.includes("Launch planning")');
 for(let i=0;i<100&&state.workspace.context.missionId!=='other-voyage';i++)await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(state.workspace.context.missionId,'other-voyage');
 return {passed:true,hidden:!win.isVisible(),syntheticTransport:true,liveProviderProof:false,checks:['explicit-project-selection','brief-Escape-focus-return','review-return','approval-request','running-waiting-unknown-failed-stopped-review','provider-finished-not-accepted','compact','200-percent','reduced-motion','historical-review-disabled','missing-attempt-disabled','keyboard-action-order','keyboard-open-request','dialog-draft-focus-return','keyboard-scoped-stop','navigation-draft-return','normal-motion-information']};
}
module.exports={check};
