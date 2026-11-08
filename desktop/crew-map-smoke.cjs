const assert=require('node:assert/strict');
async function check({js,wait,fill,click,nav,screenshot,win,state,emit,projection}){
 await nav('Crew');
 await wait('document.documentElement.dataset.crewAppearance==="dark"');
 assert.equal(await js('document.querySelector(".crew-appearance-toggle").getAttribute("aria-pressed")'),'true');
 await js('document.querySelector(".crew-appearance-toggle").focus()');
 win.webContents.sendInputEvent({type:'keyDown',keyCode:'Space'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Space'});
 await wait('document.documentElement.dataset.crewAppearance==="light"');
 assert.equal(await js('localStorage.getItem("sunny.crew-appearance.v1")'),'light','keyboard toggle saves appearance');
 await nav('Home');assert.equal(await js('document.documentElement.dataset.crewAppearance'),undefined,'Crew appearance does not leak into other pages');
 await nav('Crew');await wait('document.documentElement.dataset.crewAppearance==="light"');
 await js('document.querySelector(".crew-appearance-toggle").click()');await wait('document.documentElement.dataset.crewAppearance==="dark"');
 assert.equal(await js('localStorage.getItem("sunny.crew-appearance.v1")'),'dark');
 await js('window.__appearanceSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error("fixture storage denied")};document.querySelector(".crew-appearance-toggle").click()');
 await wait('document.querySelector(".crew-appearance-control [role=status]")?.textContent.includes("could not be saved")');
 await js('Storage.prototype.setItem=window.__appearanceSetItem;delete window.__appearanceSetItem;document.querySelector(".crew-appearance-toggle").click()');
 await wait('document.documentElement.dataset.crewAppearance==="dark"&&!document.querySelector(".crew-appearance-control [role=status]")');
 assert.ok(await js(`(()=>{const linear=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4},lum=c=>{const rgb=c.match(/[\\d.]+/g).slice(0,3).map(Number).map(linear);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]},selectors=['.wanted-work h4','.wanted-work p','.wanted-work>small','.profile-open-label','.crew-card-state','.crew-advanced>summary'];return [...document.querySelectorAll(selectors.map(x=>'.core-crew-grid '+x).join(','))].every(el=>{let parent=el,bg;while(parent){bg=getComputedStyle(parent).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')break;parent=parent.parentElement;}const a=lum(getComputedStyle(el).color),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5;});})()`),'poster work text has at least 4.5:1 effective contrast');
 await wait('document.querySelectorAll(".crew-beams .crew-beam-base").length===9');
 assert.equal(await js('document.querySelectorAll(".crew-captain").length'),1);
 assert.equal(await js('document.querySelectorAll(".core-crew-grid>.crew-card").length'),9);
 assert.equal(await js('document.querySelectorAll(".crew-beam-pulse").length'),0,'history does not replay');
 assert.ok(await js('(()=>{const cards=[...document.querySelectorAll(".core-crew-grid>.crew-card")].map(c=>c.getBoundingClientRect());return cards.every(c=>Math.abs(c.width-cards[0].width)<1&&Math.abs(c.height-cards[0].height)<1)})()'),'equal card sizes');
 assert.equal(await js('document.querySelectorAll(".ship-event-log").length'),1,'exactly one ship log');
 try{await wait('Boolean(document.querySelector("[data-component=paper-water] canvas"))');}catch(error){console.log('WATER_STATE '+await js('document.querySelector("[data-component=paper-water]").dataset.materialState'));throw error;}
 assert.ok(await js('Boolean(document.querySelector("[data-component=paper-water] [data-paper-shader]")?.paperShaderMount)'),'actual Paper Water mount');
 await js('document.querySelector(".ship-event-log").scrollIntoView({block:"center",behavior:"instant"})');
 await wait('Boolean(document.querySelector(".ship-event-log [data-component=paper-texture] canvas"))');
 await js('document.querySelector(".crew-captain").scrollIntoView({block:"center",behavior:"instant"})');
 assert.equal(await js('document.querySelectorAll("[data-upstream=magic-ui-animated-beam]").length'),9);
 await wait('document.querySelectorAll(".crew-beam-base mask [data-crew-occluder]").length===90');
 assert.ok(await js(`(()=>{const root=document.querySelector('.crew-map').getBoundingClientRect(),cards=[...document.querySelectorAll('.crew-captain,.core-crew-grid>[data-crew-id]')];return [...document.querySelectorAll('.crew-beam-base')].every(beam=>beam.querySelector('g').hasAttribute('mask')&&cards.every((card,index)=>{const bounds=card.getBoundingClientRect(),mask=beam.querySelectorAll('[data-crew-occluder]')[index];return Math.abs(+mask.getAttribute('x')-(bounds.left-root.left))<1&&Math.abs(+mask.getAttribute('y')-(bounds.top-root.top))<1&&+mask.getAttribute('width')>=bounds.width-.5&&+mask.getAttribute('height')>=bounds.height-.5;}));})()`),'beam masks exclude entire captain and specialist cards, including transparent controls');
 await js('document.fonts.ready');
 await wait('Array.from(document.querySelectorAll(".core-crew-grid .sourced-wanted-poster")).every(img=>img.complete&&img.naturalWidth>0)');
 assert.equal(await js('document.querySelectorAll(".core-crew-grid .sourced-wanted-poster").length'),9,'all nine specialists use complete sourced posters');
 assert.ok(await js('Array.from(document.querySelectorAll(".core-crew-grid .wanted-sheet")).every(sheet=>sheet.scrollWidth<=sheet.clientWidth+1)'), 'sourced sheets do not overflow');
 await js('document.getElementById("sunny-main").scrollTo({top:0,behavior:"instant"})');await screenshot('crew-map-desktop.png');
 await js('document.querySelector(".core-crew-grid").scrollIntoView({block:"start",behavior:"instant"})');await screenshot('crew-map-cards.png');
 for(const id of ['sanji','franky']){await js(`document.querySelector('[data-crew-id=${id}]').scrollIntoView({block:'start',behavior:'instant'})`);await screenshot('crew-posters-'+id+'-row.png');}
 await js('document.querySelector(".crew-extra-roster").open=true;document.querySelector(".crew-extra-roster").scrollIntoView({block:"start",behavior:"instant"})');
 await wait('Array.from(document.querySelectorAll(".crew-extra-roster .sourced-wanted-poster")).every(img=>img.complete&&img.naturalWidth>0)');
 assert.equal(await js('document.querySelectorAll(".crew-extra-roster .sourced-wanted-poster").length'),2,'Law and Ace have sourced posters');
 assert.equal(await js('document.querySelectorAll(".crew-extra-roster .poster-unverified").length'),2,'unknown canon posters are clearly labelled');
 await screenshot('crew-posters-allies.png');await js('document.querySelector("[data-crew-id=perona]").scrollIntoView({block:"start",behavior:"instant"})');await screenshot('crew-posters-perona.png');await js('document.querySelector(".crew-extra-roster").open=false');
 await js('document.querySelector("[data-crew-id=franky] .journal-open").focus();document.querySelector("[data-crew-id=franky] .journal-open").click()');
 await wait('Boolean(document.querySelector(".journal-backdrop[open] .profile-assignment"))');
 assert.equal(await js('document.querySelector(".crew-journal nav button[aria-pressed=true]").textContent'),'Overview');
 assert.equal(await js('getComputedStyle(document.querySelector(".crew-journal")).animationName'),'none','keyboard opening does not animate');
 assert.ok(await js('document.querySelector(".journal-backdrop").matches(":modal")'),'native modal remains authoritative');
 assert.ok(await js('Boolean(document.querySelector("[data-upstream=motion-primitives-morphing-dialog]"))'));
 assert.ok(await js('(()=>{const ids=[...document.querySelectorAll("[id]")].map(el=>el.id);return new Set(ids).size===ids.length})()'),'unique accessible IDs');
 await screenshot('crew-map-profile.png');
 await js('Array.from(document.querySelectorAll(".crew-journal nav button")).find(b=>b.textContent==="Local profile").click()');await fill('[aria-label="Personal instructions"]','Fixture unsaved profile draft');await js('Array.from(document.querySelectorAll(".crew-journal nav button")).find(b=>b.textContent==="Overview").click()');await js('Array.from(document.querySelectorAll(".crew-journal nav button")).find(b=>b.textContent==="Local profile").click()');assert.equal(await js(`document.querySelector('[aria-label="Personal instructions"]').value`),'Fixture unsaved profile draft');

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
 await fill('[aria-label="Search ship log"]','Fixture delegated change');
 assert.ok(await js('document.querySelectorAll(".ship-event-log li").length>0'));
 assert.ok(await js('Boolean(document.querySelector("[data-upstream=aceternity-timeline]"))'),'actual adapted Aceternity Timeline');
 await screenshot('crew-map-log.png');
 await fill('[aria-label="Search ship log"]','');
 await click('.quick-switch-trigger');await fill('.quick-switcher input','Franky');await wait('Boolean(Array.from(document.querySelectorAll("[data-sunny-result]")).find(el=>el.dataset.sunnyResult==="crew:franky"))');
 assert.ok(await js('Boolean(document.querySelector(".quick-switcher [cmdk-root] [cmdk-input]"))'),'actual shadcn/cmdk command');
 await screenshot('captains-orders.png');await js('document.querySelector(".quick-switcher").close()');
 await js('document.querySelector("[data-crew-id=franky] .journal-open").click()');
 await wait('document.querySelector(".profile-assignment").textContent.includes("Fixture delegated change")');
 await js('document.querySelector(".profile-assignment details").open=true');await screenshot('crew-map-profile-output.png');
 await click('.profile-assignment details button');await wait('document.querySelector(".workbench")?.dataset.crewId==="franky"');
 await nav('Crew');await wait('document.querySelectorAll(".crew-beams .crew-beam-base").length===9');assert.equal(await js('document.querySelectorAll(".crew-beam-pulse").length'),0,'return navigation never replays history');
 const mission={id:'map-mission',projectId:'studio',title:'Fixture compass mission',objective:'Inspect evidence',acceptanceCriteria:['Review saved check'],completionBoundary:'review',status:'working',connection:'connected',revision:1,createdAt:stamp,updatedAt:stamp,taskIds:[],activeAttemptId:'map-attempt',attempts:[{id:'map-attempt',taskIds:[],status:'working',startedAt:stamp}],artifacts:[{id:'map-check',attemptId:'map-attempt',projectId:'studio',producer:'map-worker',kind:'check',script:'Fixture check',status:'failed',exitCode:1,recordedAt:Date.now()}],events:[],reviewDecisions:[]};state.missions.push(mission);emit();
 await click('.quick-switch-trigger');await fill('.quick-switcher input','Fixture compass mission');await wait('Boolean(Array.from(document.querySelectorAll("[data-sunny-result]")).find(el=>el.dataset.sunnyResult==="mission:map-mission"))');await js('Array.from(document.querySelectorAll("[data-sunny-result]")).find(el=>el.dataset.sunnyResult==="mission:map-mission").click()');await wait('document.querySelector(".app-shell").dataset.view==="missions"');await wait('(async()=> (await window.sunny.invoke("workspace:get")).context?.missionId==="map-mission")()');assert.equal(state.workspace.context?.missionId,'map-mission');assert.equal(state.workspace.context?.attemptId,'map-attempt');
 await nav('Crew');await wait('Boolean(document.querySelector("#ship-log-kind"))');await js('(()=>{const input=document.querySelector("#ship-log-kind");input.value="check";input.dispatchEvent(new Event("change",{bubbles:true}));})()');await wait('document.querySelector(".ship-event-log").textContent.includes("Check · failed")');await js('document.querySelector(".ship-event-log details").open=true');await click('.ship-event-log details button');await wait('document.querySelector(".app-shell").dataset.view==="missions"');assert.equal(state.workspace.context?.attemptId,'map-attempt');state.missions=state.missions.filter(m=>m.id!=='map-mission');emit();await nav('Crew');await wait('Boolean(document.querySelector(".crew-map"))');
 for(const [width,height,label] of [[1280,800,'laptop'],[390,844,'phone']]){win.setSize(width,height);await wait(`innerWidth<=${width}`);await js('document.getElementById("sunny-main").scrollTo({top:0,behavior:"instant"})');assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'no overflow '+label);await screenshot('crew-map-'+label+'.png');}
 win.setSize(1440,1050);win.webContents.setZoomFactor(2);await wait('innerWidth<800');assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'200 percent zoom');await screenshot('crew-map-zoom.png');win.webContents.setZoomFactor(1);
 // Exercise a real pointer-triggered shared layout, then GPU-loss fallback.
 state.settings.reducedMotion=false;emit();await js('document.querySelector("[data-crew-id=nami] .journal-open").scrollIntoView({block:"center",behavior:"instant"})');
 await wait('document.querySelector(".crew-map").dataset.motion==="true"');
 const point=await js('(()=>{const r=document.querySelector("[data-crew-id=nami] .journal-open").getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+30)}})()');
 await js('window.__profileFrames=[];window.__profileSampling=true;requestAnimationFrame(function sample(){const el=document.querySelector(".crew-journal");if(el)window.__profileFrames.push(getComputedStyle(el).transform);if(window.__profileSampling)requestAnimationFrame(sample)})');
 win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point});await wait('Boolean(document.querySelector(".journal-backdrop[open]"))');assert.equal(await js('document.querySelector(".crew-journal").dataset.layoutMotion'),"true");
 await screenshot('upstream-morph-pointer.png');
 await new Promise(resolve=>setTimeout(resolve,400));const transforms=await js('window.__profileSampling=false;window.__profileFrames');assert.ok(transforms.some(value=>value!=='none'),'pointer opens with real shared-layout transform frames');console.log('MORPH_FRAMES '+JSON.stringify([...new Set(transforms)]));

 await js('document.querySelector(".journal-backdrop").dispatchEvent(new Event("cancel",{cancelable:true}))');await wait('!document.querySelector(".journal-backdrop")');
 await js('document.querySelector(".crew-captain").scrollIntoView({block:"center",behavior:"instant"})');try{await wait('Boolean(document.querySelector("[data-component=paper-water] canvas"))');}catch(error){console.log('WATER_STATE '+await js('document.querySelector("[data-component=paper-water]").dataset.materialState'));throw error;}await wait('document.querySelector("[data-component=paper-water]").dataset.motion==="true"');
 await js('document.querySelector(".ship-event-log").scrollIntoView({block:"start",behavior:"instant"})');await wait('!document.querySelector("[data-component=paper-water] canvas")');
 await js('document.querySelector(".crew-captain").scrollIntoView({block:"center",behavior:"instant"})');try{await wait('Boolean(document.querySelector("[data-component=paper-water] canvas"))');}catch(error){console.log('WATER_STATE '+await js('document.querySelector("[data-component=paper-water]").dataset.materialState'));throw error;}
 for(let round=0;round<3;round++){await js('document.querySelector(".ship-event-log").scrollIntoView({block:"start",behavior:"instant"})');await wait('!document.querySelector("[data-component=paper-water] canvas")');await js('document.querySelector(".crew-captain").scrollIntoView({block:"center",behavior:"instant"})');await wait('Boolean(document.querySelector("[data-component=paper-water] canvas"))');}
 await js('document.querySelector("[data-component=paper-water] canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()');await wait('!document.querySelector("[data-component=paper-water] canvas")');
 assert.ok(await js('getComputedStyle(document.querySelector("[data-component=paper-water]")).backgroundImage.includes("crew-ocean")'),'context loss retains still ocean');await screenshot('upstream-water-fallback.png');
 state.settings.reducedMotion=true;state.tasks=state.tasks.filter(t=>!t.id.startsWith('map-'));emit();
 await nav('Home');await wait('Boolean(document.querySelector(".home-tracked-work"))');await js('document.querySelector(".home-tracked-work").open=true;document.querySelector(".mission-brief").scrollIntoView({block:"center",behavior:"instant"})');await wait('Boolean(document.querySelector(".mission-brief [data-component=paper-texture] canvas"))');await screenshot('upstream-mission-paper.png');

}
module.exports={check};
