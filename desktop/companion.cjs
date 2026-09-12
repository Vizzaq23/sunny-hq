const crews=new Set(['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe']);
require('./island-residents.json').forEach(r=>crews.add(r.id));
function companionBounds(area,requested=760){
 const width=Math.min(Math.max(440,requested),area.width),height=Math.min(Math.round(width*2/3)+54,area.height);
 return {width,height,x:area.x+Math.max(0,area.width-width-24),y:area.y+Math.max(0,area.height-height-24)};
}
function validWorkspaceRequest(input={}){
 const result={};
 for(const key of ['taskId','projectId','crewId','prompt'])if(input[key]!==undefined){
  if(typeof input[key]!=='string'||input[key].length>(key==='prompt'?200000:200)||input[key].includes('\0'))throw Error('Invalid workspace request');
  result[key]=input[key];
 }
 if(result.crewId&&!crews.has(result.crewId))throw Error('Unknown crewmate');
 return result;
}
module.exports={companionBounds,validWorkspaceRequest};
