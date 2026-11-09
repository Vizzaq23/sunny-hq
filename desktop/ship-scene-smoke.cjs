// Real rendered geometry: image and actors must share the original 3:2 atlas.
const assert=require('node:assert/strict');
async function check({js,wait}){
 await wait('Boolean(document.querySelector(".ship-art img")?.complete&&document.querySelector(".ship-art img")?.naturalWidth)');
 const scene=await js(`(()=>{
  const image=document.querySelector('.ship-art img'),art=image.getBoundingClientRect(),crew=document.querySelector('.crew-deck').getBoundingClientRect();
  return {loaded:image.naturalWidth>0,width:art.width,height:art.height,crew:{x:crew.x,y:crew.y,width:crew.width,height:crew.height},art:{x:art.x,y:art.y},display:getComputedStyle(image).display};
 })()`);
 assert.ok(scene.loaded&&scene.width>100&&scene.height>50&&scene.display!=='none','Sunny deck is visibly loaded');
 assert.ok(Math.abs(scene.width/scene.height-1.5)<.01,'ship image must not letterbox inside a differently shaped crew plane');
 for(const axis of ['width','height'])assert.ok(Math.abs(scene[axis]-scene.crew[axis])<1,'art and crew share '+axis);
 for(const axis of ['x','y'])assert.ok(Math.abs(scene.art[axis]-scene.crew[axis])<1,'art and crew share '+axis);
}
module.exports={check};
