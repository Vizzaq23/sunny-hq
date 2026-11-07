// Isolated renderer checks. All model and persistence behavior belongs to the synthetic fixture.
const assert=require('node:assert/strict');
async function check({js,wait,fill,select,click,nav,screenshot,win,localFixture}){
 const key=async keyCode=>{win.focus();win.webContents.focus();win.webContents.sendInputEvent({type:'keyDown',keyCode});if(keyCode==='Enter')win.webContents.sendInputEvent({type:'char',keyCode:'\r'});win.webContents.sendInputEvent({type:'keyUp',keyCode});};
 const profileButton=async label=>js(`(()=>{const button=Array.from(document.querySelectorAll('.local-crew-panel button')).find(item=>item.textContent===${JSON.stringify(label)});if(!button||button.disabled)throw Error('Unavailable profile action');for(let parent=button.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;button.focus();button.click();})()`);
 await nav('Home');
 await js('document.querySelectorAll(".toast button").forEach(button=>button.click())');
 assert.deepEqual(await js('Array.from(document.querySelectorAll(".main-nav>button span")).map(node=>node.textContent)'),['Luffy','Crew','Projects','The Sunny','The Island']);
 await click('.nav-more>button');await wait('document.querySelector(".nav-more>button").getAttribute("aria-expanded")==="true"');
 await key('Tab');await wait('document.activeElement===document.querySelector(".nav-more-links>button")');
 await key('Escape');await wait('document.querySelector(".nav-more-links").hidden');assert.equal(await js('document.activeElement===document.querySelector(".nav-more>button")'),true);
 await click('.quick-switch-trigger');await fill('.quick-switcher input','Luffy');await wait('document.querySelector(".quick-switcher [role=option]")?.textContent.includes("Luffy")');
 await key('Escape');await wait('!document.querySelector(".quick-switcher").open');
 await nav('Projects');
 await screenshot('projects-overview.png');
 const projectCount=await js('document.querySelectorAll(".project-card").length');
 await fill('[aria-label="Search projects"]','no-project-matches-this-query');
 await wait('document.querySelectorAll(".project-card").length===0');
 assert.match(await js('document.querySelector(".projects-empty").textContent'),/No matching projects/);
 await click('.projects-empty button');
 assert.equal(await js('document.querySelectorAll(".project-card").length'),projectCount);
 await fill('[aria-label="Search projects"]',localFixture.hub.state.projects[1].name.toUpperCase());
 await wait('document.querySelectorAll(".project-card").length===1');
 await click('.project-details summary');
 assert.equal(await js('document.querySelector(".project-details p").textContent'),localFixture.hub.state.projects[1].path);
 await screenshot('projects-search-and-details.png');
 await click('[aria-label="Clear project search"]');
 const savedProjects=localFixture.hub.state.projects;
 try{
  localFixture.hub.state.projects=[];localFixture.hub.changed();
  await wait('document.querySelector(".projects-empty")?.textContent.includes("Bring your first project aboard")');
  await screenshot('projects-empty.png');
  localFixture.hub.state.projects=[...savedProjects,...Array.from({length:10},(_,index)=>({id:'project-preview-'+index,name:index===0?'A very long project name that still needs to remain readable':'Example project '+(index+1),path:'C:/Fixture/Projects/example-'+index,category:index%2?'creative':'development'}))];localFixture.hub.changed();
  await wait('document.querySelectorAll(".project-card").length===12');
  await screenshot('projects-library.png');
  win.webContents.setZoomFactor(2);await wait('innerWidth<800');
  assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'project library fits at 200 percent zoom');
  await screenshot('projects-zoom.png');
 }finally{win.webContents.setZoomFactor(1);localFixture.hub.state.projects=savedProjects;localFixture.hub.changed();await wait('innerWidth>1000');}
 const projectSize=win.getSize();
 try{
  win.setSize(480,800);await wait('innerWidth<500');
  assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'project cards fit compact screens');
  await screenshot('projects-compact.png');
 }finally{win.setSize(...projectSize);await wait('innerWidth>1000');}
 await js('document.querySelector(".project-captain").focus()');
 await key('Enter');await wait('Boolean(document.querySelector("#luffy-objective"))');
 assert.equal(await js(`document.querySelector('[aria-label="Luffy project"]').value`),localFixture.hub.state.projects[0].id);
 await nav('Projects');await click('.project-card:nth-child(2) .project-captain');await wait('Boolean(document.querySelector("#luffy-objective"))');
 assert.equal(await js(`document.querySelector('[aria-label="Luffy project"]').value`),localFixture.hub.state.projects[1].id);
 await fill('#luffy-objective','Preserve this unsent request.');await click('.captain-starters button');
 assert.ok((await js('document.querySelector("#luffy-objective").value')).startsWith('Preserve this unsent request.\n\n'));
 assert.equal(localFixture.lastChat(),undefined,'starter requests do not contact a model');await fill('#luffy-objective','');
 await nav('Crew');assert.equal(await js('document.querySelectorAll(".core-crew-grid>.crew-card").length'),9);
 await screenshot('crew-primary-roster.png');
 assert.equal(await js('document.querySelector(".crew-extra-roster").open'),false);assert.equal(await js('document.querySelectorAll(".crew-extra-roster .crew-card").length'),4);
 assert.match(await js('document.querySelector(".crew-reporter").textContent'),/Morgans.*sanitized/s);
 await js('(()=>{const card=Array.from(document.querySelectorAll(".core-crew-grid>.crew-card")).find(card=>card.querySelector("h3").textContent==="Brook");card.querySelector(".journal-open").focus();card.querySelector(".journal-open").click();})()');
 await wait('Boolean(document.querySelector(".local-crew-panel"))');
 await screenshot('crew-profile-purpose.png');
 assert.ok(await js(`Boolean(document.querySelector('[aria-label="Ask Brook"]'))`),'profile opens directly to its specialist conversation');
 assert.match(await js('document.querySelector(".local-specialty-output").textContent'),/wording/);
 await profileButton('Refresh local models');await wait(`document.querySelector('[aria-label="Local model"]').options.length===2`);
 await select('[aria-label="Local model"]','fixture:local');await fill('[aria-label="Personal instructions"]','Keep my own voice and concise preferences.');
 await profileButton('Use Brook’s recommended skills');assert.equal(await js(`document.querySelector('[aria-label="Personal instructions"]').value`),'Keep my own voice and concise preferences.');
 await profileButton('Save local setup');await wait('document.querySelector(".local-crew-panel").textContent.includes("Model and skills saved")');
 assert.equal(localFixture.hub.state.localCrew.profiles.brook.instructions,'Keep my own voice and concise preferences.');
 assert.equal(await js('document.querySelector(".local-other-skills").open'),false);
 await screenshot('crew-specialist-profile.png');
 const request=localFixture.hub.localCrew.request;
 try{
  localFixture.hub.localCrew.request=async(route,...args)=>{if(route==='tags')throw Error('Synthetic model catalog unavailable. Retry after checking the local runtime.');return request(route,...args);};
  await profileButton('Refresh local models');await wait('Boolean(document.querySelector(".toast.error"))');await new Promise(resolve=>setTimeout(resolve,3800));
  assert.match(await js('document.querySelector(".toast.error")?.textContent??""'),/Synthetic model catalog unavailable/,'errors remain until dismissed');
  assert.equal(await js('document.querySelector(".toast.error span").getAttribute("role")'),'alert');
  await key('Escape');await wait('!document.querySelector(".crew-journal")');assert.equal(await js('document.activeElement===document.querySelector("[data-crew-id=brook] .journal-open")'),true);
  await click('.toast.error button');await wait('!document.querySelector(".toast.error")');
 }finally{localFixture.hub.localCrew.request=request;}
 await wait('!document.querySelector(".crew-journal")');
 const [width,height]=win.getSize();
 try{
  win.setSize(1000,750);await wait('innerWidth<=1000');await nav('Home');
  assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'minimum desktop width has no horizontal document overflow');
  await click('.nav-more>button');await screenshot('crew-navigation-1000.png');await key('Escape');
  win.setSize(480,800);await wait('innerWidth<500');
  assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'compact captain layout has no horizontal document overflow');
  await screenshot('crew-captain-compact.png');
 }finally{win.setSize(width,height);await wait('innerWidth>1000');}
 await nav('Settings');await click('.settings-section button.small-button');await wait('Boolean(document.querySelector(".crew-page"))');
 await nav('Home');
}
module.exports={check};
