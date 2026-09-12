import {useEffect,useState} from 'react';

const cache=new Map<string,Promise<string>>();

export function useCrewTexture(source:string,kind:'crew'|'actions'|'ship'|'walk'|'states'|'residents'|'blimp'='crew'){
  const [texture,setTexture]=useState<string>();
  useEffect(()=>{let alive=true;const key=kind+source;if(!cache.has(key))cache.set(key,crewSource(source,kind).then(value=>transparentCrewTexture(value,kind)).catch(error=>{cache.delete(key);throw error;}));void cache.get(key)!.then(value=>{if(alive)setTexture(value);}).catch(()=>{});return()=>{alive=false;};},[source,kind]);
  return texture;
}

async function crewSource(fallback:string,kind:string){
  if(!window.sunny)return fallback;
  try{const result=await window.sunny.invoke('asset:crewTexture',{kind});if(typeof result==='string')return result;if(typeof result?.dataUrl==='string')return result.dataUrl;}catch{/* fall through to the local asset */}
  return fallback;
}

function transparentCrewTexture(source:string,kind:string):Promise<string>{
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>{
      try{
        const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
        const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('Canvas unavailable');
        context.drawImage(image,0,0);const imageData=context.getImageData(0,0,canvas.width,canvas.height),pixels=imageData.data;
        const visited=new Uint8Array(canvas.width*canvas.height),queue=new Int32Array(canvas.width*canvas.height);
        const background=(pixel:number)=>{const offset=pixel*4,r=pixels[offset],g=pixels[offset+1],b=pixels[offset+2];return kind==='ship'||kind==='blimp'?r>150&&b>130&&g<140&&r-g>65&&b-g>65:r>=238&&g>=238&&b>=238&&Math.max(r,g,b)-Math.min(r,g,b)<18;};
        if(kind==='blimp'){for(let pixel=0;pixel<canvas.width*canvas.height;pixel++)if(background(pixel))pixels[pixel*4+3]=0;context.putImageData(imageData,0,0);resolve(canvas.toDataURL('image/png'));return;}
        const rows=kind==='residents'?4:kind==='crew'?2:kind==='ship'?1:5,columns=kind==='residents'?4:kind==='crew'?5:kind==='actions'?4:kind==='ship'?1:8;
        for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
          const x0=Math.floor(column*canvas.width/columns),x1=Math.floor((column+1)*canvas.width/columns)-1,y0=Math.floor(row*canvas.height/rows),y1=Math.floor((row+1)*canvas.height/rows)-1;
          let head=0,tail=0;
          const enqueue=(x:number,y:number)=>{const pixel=y*canvas.width+x;if(x<x0||x>x1||y<y0||y>y1||visited[pixel]||!background(pixel))return;visited[pixel]=1;queue[tail++]=pixel;};
          for(let x=x0;x<=x1;x++){enqueue(x,y0);enqueue(x,y1);}for(let y=y0+1;y<y1;y++){enqueue(x0,y);enqueue(x1,y);}
          while(head<tail){const pixel=queue[head++],x=pixel%canvas.width,y=Math.floor(pixel/canvas.width);pixels[pixel*4+3]=0;enqueue(x-1,y);enqueue(x+1,y);enqueue(x,y-1);enqueue(x,y+1);}
        }
        context.putImageData(imageData,0,0);resolve(canvas.toDataURL('image/png'));
      }catch(error){reject(error);}
    };
    image.onerror=()=>reject(new Error('Crew texture could not be loaded'));
    image.src=source;
  });
}
