const assert=require('node:assert/strict');
async function check({js,wait,fill,click,nav,screenshot,win,state,emit,projection}){
 await nav('Crew');
 await wait('document.querySelectorAll(".crew-beams g").length===9');
 assert.equal(await js('document.querySelectorAll(".crew-captain").length'),1);
 assert.equal(await js('document.querySelectorAll(".core-crew-grid>.crew-card").length'),9);
 assert.equal(await js('document.querySelectorAll(".crew-beam-pulse").length'),0,'history does not replay');
 assert.ok(await js('(()=>{const cards=[...document.querySelectorAll(".core-crew-grid>.crew-card")].map(c=>c.getBoundingClientRect());return cards.every(c=>Math.abs(c.width-cards[0].width)<1&&Math.abs(c.height-cards[0].height)<1)})()'),'equal card sizes');
 await screenshot('crew-map-desktop.png');
 await js('document.querySelector(".core-crew-grid").scrollIntoView({block:"start",behavior:"instant"})');await screenshot('crew-map-cards.png');
 await js('document.querySelector("[data-crew-id=franky] .journal-open").focus();document.querySelector("[data-crew-id=franky] .journal-open").click()');
 await wait('Boolean(document.querySelector(".journal-backdrop[open] .profile-assignment"))');
 await screenshot('crew-map-profile.png');
 await js('document.querySelector(".journal-backdrop").dispatchEvent(new Event("cancel",{cancelable:true}))');
 await wait('!document.querySelector(".journal-backdrop")');
 assert.equal(await js('document.activeElement.closest("[data-crew-id]")?.dataset.crewId'),'franky','dialog restores focus');
 state.settings.reducedMotion=false;emit();
 await js('document.querySelector(".crew-captain").scrollIntoView({block:"center",behavior:"instant"})');
 await wait('document.querySelector(".crew-map").dataset.motion==="true"');
 const stamp=Date.now();state.tasks.push({id:'map-captain',crewId:'luffy',captain:true,projectId:'studio',title:'Fixture captain',status:'working',createdAt:stamp,updatedAt:stamp,messages:[]});emit();
 state.tasks.push({id:'map-worker',crewId:'franky',parentTaskId:'map-captain',projectId:'studio',title:'Fixture delegated change',status:'working',createdAt:Date.now(),updatedAt:Date.now(),messages:[]});emit();
 await wait('Boolean(document.querySelector(".crew-beam-pulse.outbound"))');
 await screenshot('crew-map-assignment.png');
 await wait('!document.querySelector(".crew-beam-pulse")');
 const worker=state.tasks.find(t=>t.id==='map-worker');worker.status='finished';worker.updatedAt=Date.now();worker.messages.push({id:'map-reply',role:'assistant',text:'Fixture returned proposal; not accepted.',time:Date.now()});projection.transcriptChanged(worker);emit();
 await wait('Boolean(document.querySelector(".crew-beam-pulse.inbound"))');
 await wait('!document.querySelector(".crew-beam-pulse")');emit();
 assert.equal(await js('document.querySelectorAll(".crew-beam-pulse").length'),0,'duplicate snapshot does not replay');
 await click('.crew-map-key button');await wait('document.querySelector(".crew-map").dataset.motion==="false"');
 await click('.crew-map-key button');
 state.settings.reducedMotion=true;emit();await wait('document.querySelector(".crew-map").dataset.motion==="false"');
 win.webContents.debugger.attach('1.3');try{state.settings.reducedMotion=false;emit();await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await wait('document.querySelector(".crew-map").dataset.motion==="false"');}finally{await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});win.webContents.debugger.detach();state.settings.reducedMotion=true;emit();}
 await js('document.querySelector(".ship-event-log").scrollIntoView({block:"start",behavior:"instant"});document.querySelector(".ship-event-log details").open=true');
 await screenshot('crew-map-log.png');
 await click('.quick-switch-trigger');await fill('.quick-switcher input','Franky');await wait('Boolean(document.getElementById("switch-crew%3Afranky"))');
 await screenshot('captains-orders.png');await js('document.querySelector(".quick-switcher").close()');
 await js('document.querySelector("[data-crew-id=franky] .journal-open").click()');
 await wait('document.querySelector(".profile-assignment").textContent.includes("Fixture delegated change")');
 await js('document.querySelector(".profile-assignment details").open=true');await screenshot('crew-map-profile-output.png');
 await click('.profile-assignment details button');await wait('document.querySelector(".workbench")?.dataset.crewId==="franky"');
 await nav('Crew');await wait('document.querySelectorAll(".crew-beams g").length===9');assert.equal(await js('document.querySelectorAll(".crew-beam-pulse").length'),0,'return navigation never replays history');
 for(const [width,height,label] of [[1280,800,'laptop'],[390,844,'phone']]){win.setSize(width,height);await wait(`innerWidth<=${width}`);await js('document.getElementById("sunny-main").scrollTo({top:0,behavior:"instant"})');assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'no overflow '+label);await screenshot('crew-map-'+label+'.png');}
 win.setSize(1440,1050);win.webContents.setZoomFactor(2);await wait('innerWidth<800');assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'200 percent zoom');await screenshot('crew-map-zoom.png');win.webContents.setZoomFactor(1);
 state.tasks=state.tasks.filter(t=>!t.id.startsWith('map-'));emit();
}
module.exports={check};
