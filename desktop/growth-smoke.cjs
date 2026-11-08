const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async({win,hub,handle})=>{
 const note=await handle('crew:note',{crewId:'chopper',text:'Synthetic fixture: prefer short explanations.'});
 await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.sidebar button')).find(b=>b.textContent.trim()==='Crew').click()`);await pause(250);
 await win.webContents.executeJavaScript(`document.querySelector('.crew-card[data-crew-id=chopper]').querySelector('.journal-open').click()`);await pause(250);
 assert.match(await win.webContents.executeJavaScript(`document.querySelector('.crew-journal').innerText`),/short explanations/);
 await handle('crew:note',{crewId:'chopper',id:note.id,text:'Synthetic correction: detailed explanations.'});await pause(150);
 const corrected=await win.webContents.executeJavaScript(`document.querySelector('.crew-journal').innerText`);assert.match(corrected,/detailed explanations/);assert.doesNotMatch(corrected,/prefer short/);
 fs.writeFileSync(path.join(process.cwd(),'.sunny-dev','crew-journal.png'),(await win.webContents.capturePage()).toPNG());
 await handle('crew:memoryEnabled',{enabled:false});assert.equal(hub.growth.context('chopper','explanations'),'');await handle('crew:memoryEnabled',{enabled:true});
 await win.webContents.executeJavaScript(`document.querySelectorAll('.crew-journal nav button')[1].click()`);await pause(150);
 assert.match(await win.webContents.executeJavaScript(`document.querySelector('.crew-journal').innerText`),/Let them talk/);
 fs.writeFileSync(path.join(process.cwd(),'.sunny-dev','crew-relationships.png'),(await win.webContents.capturePage()).toPNG());
 await handle('crew:forget',{crewId:'chopper',id:note.id});assert.equal(hub.growth.profile('chopper').memories.length,0);
 await win.webContents.executeJavaScript(`document.querySelector('[aria-label="Close journal"]').click();Array.from(document.querySelectorAll('.sidebar button')).find(b=>b.textContent.trim()==='The Sunny').click()`);await pause(100);
 console.log('SUNNY_GROWTH '+JSON.stringify({journal:true,correction:true,forget:true,disableRecall:true,relationshipsUI:true}));
};
