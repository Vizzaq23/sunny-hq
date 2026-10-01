import type {MissionProjection} from './missionProjection';

const point=(x:number,y:number)=>({x:x/1536,y:y/1024});
export const FRANKY_ROOM_GEOMETRY={
 imageSha256:'E29915E79F9A279AF61EF490E51527190A87BBE7AF941F962D6702419D051A8C',
 atlasSha256:'4B5E1BAF34F3CBF29AB16BCD94F70A94221356513E276DC7CFB889DA5FF6782C',
 canvas:{width:1536,height:1024},rest:point(650,680),bench:point(1150,590),
 path:[point(650,680),point(820,640),point(1040,550),point(1150,590)],
 actorBounds:{width:240/1536,height:240/1024},
 floor:[[165,590],[735,380],[1400,640],[935,850],[535,820]].map(([x,y])=>point(x,y)),
 tableTop:[[940,274],[1095,264],[1450,360],[1340,417],[1020,330]].map(([x,y])=>point(x,y)),
} as const;
export type FrankyFrame={width:number;height:number;pixels:Uint8ClampedArray;bounds:{x:number;y:number;right:number;bottom:number};column:number};

// Same edge-connected neutral-white key as crewTexture; source artwork stays immutable.
function keyAtlas(source:Uint8ClampedArray,width:number,height:number){
 const pixels=new Uint8ClampedArray(source),visited=new Uint8Array(width*height),queue=new Int32Array(width*height);
 const background=(n:number)=>{const i=n*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];return r>=238&&g>=238&&b>=238&&Math.max(r,g,b)-Math.min(r,g,b)<18;};
 for(let row=0;row<5;row++)for(let col=0;col<8;col++){
  const x0=Math.floor(col*width/8),x1=Math.floor((col+1)*width/8)-1,y0=Math.floor(row*height/5),y1=Math.floor((row+1)*height/5)-1;let head=0,tail=0;
  const add=(x:number,y:number)=>{if(x<x0||x>x1||y<y0||y>y1)return;const n=y*width+x;if(visited[n]||!background(n))return;visited[n]=1;queue[tail++]=n;};
  for(let x=x0;x<=x1;x++){add(x,y0);add(x,y1);}for(let y=y0+1;y<y1;y++){add(x0,y);add(x1,y);}
  while(head<tail){const n=queue[head++],x=n%width,y=Math.floor(n/width);pixels[n*4+3]=0;add(x-1,y);add(x+1,y);add(x,y-1);add(x,y+1);}
 }
 return pixels;
}
export function extractFrankyFrames(source:Uint8ClampedArray,width:number,height:number):FrankyFrame[]{
 if(width!==1586||height!==992||source.length!==width*height*4)throw Error('Franky atlas dimensions are unavailable.');
 const keyed=keyAtlas(source,width,height),size=216;
 return [4,5,6,7].map(column=>{
  const x0=Math.floor(column*width/8)-9,y0=Math.floor(3*height/5),labels=new Int32Array(size*size),queue=new Int32Array(size*size);let serial=0,largest=0,largestCount=0;
  const alpha=(x:number,y:number)=>x+x0<width&&keyed[((y+y0)*width+x+x0)*4+3]>0;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const start=y*size+x;if(labels[start]||!alpha(x,y))continue;serial++;let head=0,tail=1;queue[0]=start;labels[start]=serial;
   const add=(xx:number,yy:number)=>{if(xx<0||yy<0||xx>=size||yy>=size)return;const n=yy*size+xx;if(labels[n]||!alpha(xx,yy))return;labels[n]=serial;queue[tail++]=n;};
   while(head<tail){const n=queue[head++],xx=n%size,yy=Math.floor(n/size);add(xx-1,yy);add(xx+1,yy);add(xx,yy-1);add(xx,yy+1);}
   if(tail>largestCount){largest=serial;largestCount=tail;}
  }
  if(largestCount<1000)throw Error('Franky atlas silhouette is unavailable.');
  const pixels=new Uint8ClampedArray(size*size*4),bounds={x:size,y:size,right:0,bottom:0};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(labels[y*size+x]===largest){const to=(y*size+x)*4,from=((y+y0)*width+x+x0)*4;pixels.set(keyed.subarray(from,from+4),to);bounds.x=Math.min(bounds.x,x);bounds.y=Math.min(bounds.y,y);bounds.right=Math.max(bounds.right,x+1);bounds.bottom=Math.max(bounds.bottom,y+1);}
  return {width:size,height:size,pixels,bounds,column};
 });
}
export type FrankyScene={progress:number;frame:number;moving:boolean;clock?:number};
export function frankyBuilding(projection:MissionProjection){return projection.state==='working'&&projection.working&&projection.crewId==='franky'&&(!projection.stage||projection.stage==='work');}
export function frankyBuildCaption(projection:MissionProjection,scene:FrankyScene,paused:boolean){
 if(paused)return 'Visuals paused; work status unchanged.';
 if(!frankyBuilding(projection))return;
 return scene.progress<1?'Franky is heading to the workbench.':'Franky is building beside the workbench.';
}
export function stepFrankyScene(scene:FrankyScene,projection:MissionProjection,elapsed:number,reducedMotion:boolean,paused:boolean):FrankyScene{
 const building=frankyBuilding(projection);
 if(reducedMotion)return {progress:building?1:0,frame:building?2:0,moving:false,clock:0};
 if(paused)return {...scene,moving:false};
 if(!building)return {...scene,frame:0,moving:false,clock:0};
 const dt=Math.min(.1,Math.max(0,elapsed)),progress=Math.min(1,scene.progress+dt/3),clock=progress===1?(scene.clock??0)+dt:0;
 return {progress,frame:progress===1?2+Math.floor(clock/.65)%2:0,moving:progress<1,clock};
}
export function frankyFoot(progress:number){
 const path=FRANKY_ROOM_GEOMETRY.path,clamped=Math.max(0,Math.min(1,progress));
 const lengths=path.slice(1).map((p,i)=>Math.hypot((p.x-path[i].x)*1536,(p.y-path[i].y)*1024));let distance=clamped*lengths.reduce((a,b)=>a+b,0);
 for(let i=0;i<lengths.length;i++){if(distance<=lengths[i]){const t=distance/lengths[i];return {x:path[i].x+(path[i+1].x-path[i].x)*t,y:path[i].y+(path[i+1].y-path[i].y)*t};}distance-=lengths[i];}
 return FRANKY_ROOM_GEOMETRY.bench;
}
export async function claimLiveAcceptanceCue(previous:MissionProjection|undefined,current:MissionProjection,claim:()=>Promise<boolean>,reducedMotion=false){
 if(reducedMotion||!previous||current.state!=='accepted'||current.acceptanceCueEligible!==true||!current.acceptanceId||!current.result||previous.missionId!==current.missionId||previous.attemptId!==current.attemptId||previous.acceptanceId===current.acceptanceId)return false;
 return claim();
}
