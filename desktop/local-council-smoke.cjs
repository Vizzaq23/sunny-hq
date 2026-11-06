// Isolated production-renderer interaction check with explicitly synthetic model replies.
const assert=require('node:assert/strict');
async function check({js,wait,fill,select,click,nav,screenshot,win,localFixture}){
 await nav('Home');await wait('Boolean(document.querySelector(".local-captain"))');
 const button=async text=>{await js(`(()=>{const button=Array.from(document.querySelectorAll('.local-captain button')).find(item=>item.textContent.trim()===${JSON.stringify(text)});if(!button||button.disabled)throw Error('Unavailable council button '+${JSON.stringify(text)});let parent=button.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}button.focus();button.click();})()`);};
 await button('Find local models');await wait('document.querySelector(".local-captain").textContent.includes("1 downloaded local models")');
 await button('Prepare crew specialties');await wait('document.querySelector(".local-captain").textContent.includes("Crew specialties prepared")');
 assert.equal(Object.keys(localFixture.hub.state.localCrew.profiles).length,15);
 assert.deepEqual(localFixture.hub.state.localCrew.profiles.robin.skills,['research','documentation','planning']);
 assert.deepEqual(localFixture.hub.state.localCrew.profiles.morgans.skills,['writing','documentation']);
 await select('[aria-label="Luffy project"]','studio');await fill('#luffy-objective','Synthetic fixture: review an empty-input bug and propose checks.');await button('Ask Luffy & crew');
 await wait('document.querySelector(".local-council-progress").textContent.includes("Crew advice is ready")');
 assert.equal(await js('document.querySelectorAll(".local-council-members>details").length'),2);
 assert.match(await js('document.querySelector(".local-council-progress").textContent'),/Franky.*Usopp/s);
 await button('Ask Morgans for a local bulletin');await wait('document.querySelector(".local-captain").textContent.includes("Bulletin: ready")');
 assert.ok(!localFixture.lastChat().messages.at(-1).content.includes('empty-input bug'),'Morgans receives no objective or source');
 await js('document.querySelector(".local-captain").scrollIntoView({block:"start"});document.querySelector(".local-captain>details").open=false;');await screenshot('local-captain-desktop.png');
 const [width,height]=win.getSize();win.setSize(480,850);await wait('innerWidth<500');
 assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'captain fits narrow viewport');await screenshot('local-captain-compact.png');win.setSize(width,height);await wait('innerWidth>1000');
 await js('document.querySelector("#luffy-objective").focus()');assert.equal(await js('document.activeElement.id'),'luffy-objective');
 // Read-only local work must stay visible after navigation; actual task activity retains priority.
 const state=localFixture.hub.state,oldTasks=state.tasks,oldApprovals=state.approvals,oldContext=state.workspace.context;
 state.tasks=[];state.approvals=[];state.workspace.context=null;localFixture.hub.changed();
 try{
  localFixture.hold(true);await fill('#luffy-objective','Synthetic cancellation check.');await button('Ask Luffy & crew');await wait('document.querySelector(".local-council-progress").textContent.includes("Luffy is choosing")');
  await nav('The Island');await wait('Boolean(document.querySelector(".local-crew-live"))');
  assert.match(await js('document.querySelector(".local-crew-live").textContent'),/Luffy is choosing/);await screenshot('local-council-island-working.png');
  await click('.local-crew-live button');await wait('Boolean(document.querySelector(".local-captain"))');
  assert.equal(state.localCrew.councils.at(-1).status,'planning','stepping in preserves active work');
  await button('Stop crew');await wait('document.querySelector(".local-council-progress").textContent.includes("Council stopped")');
  await nav('Home');await wait('document.querySelector(".local-council-progress").textContent.includes("Council stopped")');
  assert.equal(state.localCrew.councils.at(-1).status,'interrupted');
 }finally{localFixture.hold(false);state.tasks=oldTasks;state.approvals=oldApprovals;state.workspace.context=oldContext;localFixture.hub.changed();}
 await screenshot('local-council-stopped.png');
}
module.exports={check};
