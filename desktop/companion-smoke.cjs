const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async({win,handle,getCompanion})=>{
 await handle('companion:show');const pet=getCompanion();
 assert.ok(win.isMinimized(),'Main app is minimized');assert.ok(pet.isVisible(),'Ship stays visible');assert.ok(pet.isAlwaysOnTop());
 await pause(2500);
 const info=await pet.webContents.executeJavaScript(`({crew:document.querySelectorAll('.deck-crew').length,background:getComputedStyle(document.body).backgroundColor,source:document.querySelector('.ship-art img').src})`);
 assert.equal(info.crew,10);assert.equal(info.background,'rgba(0, 0, 0, 0)');assert.ok(info.source.startsWith('data:image/png'));
 const alpha=await pet.webContents.executeJavaScript(`(()=>{const im=document.querySelector('.ship-art img'),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);return {corner:ctx.getImageData(0,0,1,1).data[3],center:ctx.getImageData(c.width/2,c.height/2,1,1).data[3]};})()`);
 assert.equal(alpha.corner,0);assert.equal(alpha.center,255);
 const trigger=id=>pet.webContents.executeJavaScript(`(()=>{const el=document.querySelector('[aria-label="Play a crew animation"]');el.value=${JSON.stringify(id)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await trigger('luffy');await pause(800);assert.equal(await pet.webContents.executeJavaScript(`Boolean(document.querySelector('.action-luffy .action-sprite'))`),true);
 fs.writeFileSync(path.join(process.cwd(),'.sunny-dev','companion-gear5.png'),(await pet.webContents.capturePage()).toPNG());
 await trigger('rivalry');await pause(1600);assert.equal(await pet.webContents.executeJavaScript(`document.querySelectorAll('.performing').length`),2);
 const first=await pet.webContents.executeJavaScript(`document.querySelector('.bantering')?.getAttribute('data-crew-id')`);assert.equal(first,'sanji');await pause(2000);
 const second=await pet.webContents.executeJavaScript(`document.querySelector('.bantering')?.getAttribute('data-crew-id')`);assert.equal(second,'zoro');
 fs.writeFileSync(path.join(process.cwd(),'.sunny-dev','companion-rivalry.png'),(await pet.webContents.capturePage()).toPNG());
 for(const id of ['nami','robin','sanji']){await trigger(id);await pause(250);assert.ok(await pet.webContents.executeJavaScript(`Boolean(document.querySelector('.action-${id} .action-sprite'))`),id+' signature pose appears');}
 await pet.webContents.executeJavaScript(`document.querySelector('.crew-life-controls button').click()`);await pause(100);assert.equal(await pet.webContents.executeJavaScript(`document.querySelectorAll('.performing').length`),0);
 const width=pet.getBounds().width;await handle('companion:resize',{delta:-100});assert.ok(pet.getBounds().width<width);
 await handle('companion:restore');assert.ok(win.isVisible()&&!win.isMinimized());assert.equal(pet.isVisible(),false);
 console.log('SUNNY_COMPANION '+JSON.stringify({transparent:alpha,crew:info.crew,gear5:true,rivalry:[first,second],allActions:true,pause:true,resize:true,restore:true}));
};
