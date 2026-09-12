const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async({win,hub})=>{
 const read=()=>win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.deck-crew')).map(c=>({id:c.dataset.crewId,x:Number(c.dataset.deckX),y:Number(c.dataset.deckY),moving:c.dataset.moving,mode:c.dataset.mode,sprite:c.querySelector('.deck-sprite').className}))`);
 const before=await read();await pause(2500);let after=await read();assert.equal(after.length,10);assert.ok(after.some((c,i)=>Math.hypot(c.x-before[i].x,c.y-before[i].y)>.2),'Crew positions change along deck routes');
 assert.ok(after.some(c=>c.sprite.includes('walk-sprite')||c.sprite.includes('pet-walk-')),'Walking uses animation frames');
 const fixture={id:'walking-fixture',crewId:'franky',projectId:hub.state.projects[0]?.id,status:'working',title:'Synthetic movement check',createdAt:Date.now(),updatedAt:Date.now(),messages:[]};hub.state.tasks.push(fixture);hub.changed();
 try{
  let franky;for(let i=0;i<100;i++){after=await read();franky=after.find(c=>c.id==='franky');if(franky.mode==='working'&&franky.moving==='false')break;await pause(250);}
  assert.equal(franky.mode,'working');assert.equal(franky.moving,'false');assert.ok(Math.abs(franky.x-72)<.1&&Math.abs(franky.y-66)<.1,'Busy Franky returns to the workshop');assert.match(franky.sprite,/pet-working-loop/);
  fs.writeFileSync(path.join(process.cwd(),'.sunny-dev','walking-crew.png'),(await win.webContents.capturePage()).toPNG());
  fixture.status='waiting';hub.changed();await pause(200);const waiting=(await read()).find(c=>c.id==='franky');assert.equal(waiting.mode,'waiting');assert.equal(waiting.moving,'false');
 }finally{hub.state.tasks=hub.state.tasks.filter(t=>t.id!==fixture.id);hub.changed();}
 await win.webContents.executeJavaScript(`document.querySelector('.crew-life-controls button').click()`);await pause(150);const stopped=await read();await pause(500);const still=await read();assert.deepEqual(still.map(c=>[c.x,c.y]),stopped.map(c=>[c.x,c.y]));
 await win.webContents.executeJavaScript(`document.querySelector('.crew-life-controls button').click()`);
 console.log('SUNNY_WALKING '+JSON.stringify({crew:10,walkingFrames:true,positionChanges:true,workstationReturn:true,workingFrames:true,waitingStops:true,pauseStops:true}));
};
