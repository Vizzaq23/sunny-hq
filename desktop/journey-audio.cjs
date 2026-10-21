async function run({win,hub,manifest,js,invoke,probe,click,clickText,wait,pause,context}){
 require('./packaged-acceptance.cjs').assertFixtureCapability(manifest);const assert=require('node:assert/strict');assert.equal(manifest.scenario,'journey-audio');assert.ok(hub.state.missions[0].acceptance);
 const author=hub.state.runs[0].assignments.find(a=>a.capability==='implementation');await context('workbench',author.taskId);await wait(()=>js("Boolean(document.querySelector('.room-sound-toggle'))"));const cases=[];
 for(const action of ['mute','hide-restore','settings-unmount','saved-disable','stop-all']){
  if(hub.state.settings.roomSoundEnabled)await invoke('settings:update',{roomSoundEnabled:false});await pause(220);
  await click('[aria-label="Enable room sounds"]');await wait(async()=>{const p=await probe();return p.active.length>0&&p.contexts.some(c=>c.state==='running');},3000);
  let hidden;const before=await js(`window.__sunnyJourneyProbe.mark(${JSON.stringify(action)})`);assert.ok(before.active.length);assert.ok(before.active.every(v=>v.state==='running'));
  if(action==='mute')await click('[aria-label="Mute room sounds"]');
  if(action==='hide-restore'){win.hide();await wait(()=>js('document.hidden'));await pause(40);hidden=await probe();win.showInactive();await wait(()=>js('!document.hidden'));}
  if(action==='settings-unmount'){await clickText('Settings');await wait(()=>js("Boolean(document.querySelector('.settings-page'))"));}
  if(action==='saved-disable')await invoke('settings:update',{roomSoundEnabled:false});
  if(action==='stop-all')await click('.room-stop-all');
  await wait(async()=>{const p=await probe();return before.active.every(n=>p.rows.some(row=>row.kind==='ended'&&row.id===n.id));},3000);
  await pause(220);const after=await probe(),rows=after.rows.slice(before.rowCount);for(const node of before.active){const stopped=rows.find(v=>v.kind==='stop'&&v.id===node.id);assert.ok(stopped,'A real cancellation must precede native ended cleanup');assert.ok(stopped.when<=stopped.at+.008001);assert.ok(rows.some(v=>v.kind==='ended'&&v.id===node.id));}assert.equal(after.active.length,0);assert.ok(after.rows.filter(v=>v.kind==='gain').every(v=>v.value>=0&&v.value<=.65));const late={active:after.active,newStarts:rows.filter(v=>v.kind==='start').length};assert.equal(late.newStarts,0);cases.push({action,late,...(hidden?{hidden:{active:hidden.active,contexts:hidden.contexts}}:{}),before:{active:before.active,contexts:before.contexts},after:{active:after.active,contexts:after.contexts},rows:rows.filter(row=>['stop','ended'].includes(row.kind))});
  if(action==='settings-unmount'){await invoke('settings:update',{roomSoundEnabled:false});await clickText('Return to work');await wait(()=>js("Boolean(document.querySelector('.room-sound-toggle'))"));}
 }
 await wait(()=>hub.state.runs[0].phase==='stopped');assert.equal(hub.state.runs[0].phase,'stopped');const observation=await probe();assert.ok(observation.rows.length<=256&&JSON.stringify(observation).length<=65536);return {version:1,cases,observation,nativeNodes:true,hardwareAudibilityClaim:false};
}
module.exports={run};
