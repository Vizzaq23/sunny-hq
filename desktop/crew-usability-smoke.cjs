// Isolated renderer checks. All model and persistence behavior belongs to the synthetic fixture.
const assert=require('node:assert/strict');
async function check({js,wait,fill,select,click,nav,screenshot,win,localFixture}){
 const key=async keyCode=>{win.focus();win.webContents.focus();win.webContents.sendInputEvent({type:'keyDown',keyCode});win.webContents.sendInputEvent({type:'keyUp',keyCode});};
 const profileButton=async label=>js(`(()=>{const button=Array.from(document.querySelectorAll('.local-crew-panel button')).find(item=>item.textContent===${JSON.stringify(label)});if(!button||button.disabled)throw Error('Unavailable profile action');for(let parent=button.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;button.focus();button.click();})()`);
 await nav('Home');
 await js('document.querySelectorAll(".toast button").forEach(button=>button.click())');
 assert.deepEqual(await js('Array.from(document.querySelectorAll(".main-nav>button span")).map(node=>node.textContent)'),['Luffy','Crew','Projects','The Sunny','The Island']);
 await click('.nav-more>button');await wait('document.querySelector(".nav-more>button").getAttribute("aria-expanded")==="true"');
 await key('Tab');await wait('document.activeElement===document.querySelector(".nav-more-links>button")');
 await key('Escape');await wait('document.querySelector(".nav-more-links").hidden');assert.equal(await js('document.activeElement===document.querySelector(".nav-more>button")'),true);
 await click('.quick-switch-trigger');await fill('.quick-switcher input','Luffy');await wait('document.querySelector(".quick-switcher [role=option]")?.textContent.includes("Luffy")');
 await key('Escape');await wait('!document.querySelector(".quick-switcher").open');
 await nav('Projects');await click('.project-card:nth-child(2) .project-captain');await wait('Boolean(document.querySelector("#luffy-objective"))');
 assert.equal(await js(`document.querySelector('[aria-label="Luffy project"]').value`),localFixture.hub.state.projects[1].id);
 await fill('#luffy-objective','Preserve this unsent request.');await click('.captain-starters button');
 assert.ok((await js('document.querySelector("#luffy-objective").value')).startsWith('Preserve this unsent request.\n\n'));
 assert.equal(localFixture.lastChat(),undefined,'starter requests do not contact a model');await fill('#luffy-objective','');
 await nav('Crew');assert.equal(await js('document.querySelectorAll(".core-crew-grid>.crew-card").length'),10);
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
  await key('Escape');await wait('!document.querySelector(".crew-journal")');assert.equal(await js('document.activeElement.className'),'journal-open');
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
