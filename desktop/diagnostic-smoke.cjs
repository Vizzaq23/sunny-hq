// Explicitly synthetic UI proof using the production redaction projector.
const assert=require('node:assert/strict');
async function check({js,wait,select,click,screenshot,win,state,copy,captures=false}){
 const {observe}=require('./diagnostic-timeline.cjs'),task=state.tasks.find(t=>t.id==='design'),before=structuredClone(task.diagnosticObservations),now=Date.now();
 observe(task,'approval-requested','old',{requestId:'old',turnId:'old-turn',now:now-6000,outcome:'waiting'});
 observe(task,'connection-lost','loss',{turnId:'old-turn',now:now-5000,outcome:'unknown'});
 observe(task,'reconciled','read',{turnId:'old-turn',now:now-4000,outcome:'interrupted'});
 observe(task,'approval-requested','fresh',{requestId:'fresh',now:now-3000,outcome:'waiting'});
 observe(task,'approval-submitted','decision',{requestId:'fresh',now:now-2000,outcome:'accept'});
 observe(task,'command-completed','item',{itemId:'item',now:now-1000,outcome:'completed',exitCode:0});
 await js('document.querySelector(".logbook-dock").open=true;document.querySelector(".ship-diagnostics").open=true');await wait('Boolean(document.querySelector(".diagnostic-entries"))');
 await select('[aria-label="Diagnostic conversation"]','design');await wait('Boolean(document.querySelector("[data-kind=connection-lost]"))');
 assert.equal(await js('document.querySelectorAll("[data-kind=approval-submitted]").length'),1);
 assert.ok(await js('document.querySelector(".diagnostic-coverage").textContent.includes("not captain acceptance")'));
 await js('document.querySelector(".diagnostic-actions button").focus()');
 win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});win.webContents.debugger.detach();
 assert.equal(await js('document.activeElement.textContent'),'Copy redacted JSON');assert.notEqual(await js('getComputedStyle(document.activeElement).outlineStyle'),'none');await click('.diagnostic-actions button:nth-child(2)');await wait('document.querySelector(".ship-diagnostics [role=status]").textContent.includes("copied")');
 assert.ok(copy());for(const privateText of ['Polish the customer dashboard','npm test','Verify the updated dashboard',task.title])assert.ok(!copy().includes(privateText));
 if(captures){for(const [width,height,label,zoom] of [[1280,900,'desktop',1],[390,844,'mobile',1],[1280,900,'zoom',2]]){win.webContents.setZoomFactor(zoom);win.setSize(width,height);await new Promise(r=>setTimeout(r,180));await js('document.querySelector(".ship-diagnostics").scrollIntoView({block:"start",behavior:"instant"})');assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'diagnostics fits '+label);await screenshot('diagnostics-'+label+'.png');await js('document.querySelector(".diagnostic-entries li").scrollIntoView({block:"start",behavior:"instant"})');await screenshot('diagnostics-events-'+label+'.png');}win.webContents.setZoomFactor(1);win.setSize(1440,1050);}
 await select('[aria-label="Diagnostic project"]','launch');await wait('!document.querySelector("[data-kind=approval-submitted]")');
 await js('document.querySelector(".ship-diagnostics").open=false;document.querySelector(".logbook-dock").open=false');
 if(before===undefined)delete task.diagnosticObservations;else task.diagnosticObservations=before;
 return {passed:true,syntheticTransport:true,liveProviderProof:false,checks:['scoped-recovery-history','decision-distinct-from-execution','redacted-export','keyboard-focus-and-tab','project-switch-clears-stale-data',...(captures?['desktop-phone-200-percent-layout']:[])]};
}
module.exports={check};
