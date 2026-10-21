// A closing companion may still have a BrowserWindow while its renderer is gone.
// Delivery to that surface must not abort backend work or other deliveries.
function broadcast(surfaces,type,data){
 broadcastEnvelope(surfaces,{type,data});
}
function broadcastEnvelope(surfaces,envelope){
 for(const surface of surfaces){
  try{if(surface&&!surface.isDestroyed()&&!surface.webContents.isDestroyed())surface.webContents.send('sunny:event',envelope);}
  catch{/* A reopened surface receives a fresh snapshot. */}
 }
}
module.exports={broadcast,broadcastEnvelope};
