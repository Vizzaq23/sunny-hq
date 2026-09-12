const assert=require('node:assert/strict');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
module.exports=async({win,hub})=>{
 const residents=hub.state.world.residents;
 try{
  hub.state.world.residents=null;hub.changed();await pause(400);
  assert.match(await win.webContents.executeJavaScript('document.body.innerText'),/get your workspace back/);
 }finally{hub.state.world.residents=residents;hub.changed();}
 await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Reload Sunny').click()`);
 for(let attempt=0;attempt<40;attempt++){await pause(250);if(await win.webContents.executeJavaScript('Boolean(document.querySelector(".island-scene"))').catch(()=>false))break;}
 assert.ok(await win.webContents.executeJavaScript('Boolean(document.querySelector(".island-scene"))'));
 console.log('SUNNY_RECOVERY '+JSON.stringify({renderFailureVisible:true,reloadRestoresIsland:true}));
};
