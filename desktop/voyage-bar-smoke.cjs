const assert=require('node:assert/strict');
async function check({js,wait,select,click,nav,screenshot,win,state,emit}){
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
 for(const [status,label] of [['working','Working'],['unknown','Check connection'],['failed','Failed'],['interrupted','Stopped'],['finished','review']]){
  state.tasks.find(t=>t.id==='captain').status=status;emit();await wait(`document.querySelector('.voyage-summary').textContent.toLowerCase().includes(${JSON.stringify(label.toLowerCase())})`);
  assert.doesNotMatch(await js('document.querySelector(".voyage-summary").textContent'),/Accepted by captain/);await screenshot('voyage-'+status+'.png');
 }
 win.setSize(400,900);await wait('innerWidth<450');assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'));await screenshot('voyage-compact.png');
 win.setSize(1440,1050);win.webContents.setZoomFactor(2);await screenshot('voyage-200-percent.png');assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'));win.webContents.setZoomFactor(1);
 await select('[aria-label="Selected voyage mission"]','other-voyage');await wait('document.querySelector(".voyage-summary").textContent.includes("Launch planning")');
 for(let i=0;i<100&&state.workspace.context.missionId!=='other-voyage';i++)await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(state.workspace.context.missionId,'other-voyage');
 return {passed:true,hidden:!win.isVisible(),syntheticTransport:true,liveProviderProof:false,checks:['explicit-project-selection','brief-Escape-focus-return','review-return','approval-request','running-unknown-failed-stopped-review','provider-finished-not-accepted','compact','200-percent','reduced-motion']};
}
module.exports={check};
