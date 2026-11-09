import {useEffect,useRef,useState} from 'react';
import {PaperTexture,Water} from '@paper-design/shaders-react';

let supported:boolean|undefined;
function supportsWebGL(){
 if(supported!==undefined)return supported;
 try{const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2');supported=Boolean(gl);gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch{supported=false;}
 return supported;
}
function useVisibleShader(){
 const ref=useRef<HTMLDivElement>(null),[visible,setVisible]=useState(false),[hidden,setHidden]=useState(document.hidden),[failed,setFailed]=useState(false);
 useEffect(()=>{const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting));if(ref.current)observer.observe(ref.current);const visibility=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',visibility);return()=>{observer.disconnect();document.removeEventListener('visibilitychange',visibility);};},[]);
 useEffect(()=>{const element=ref.current;if(!element)return;const lost=(event:Event)=>{const canvas=event.target as HTMLCanvasElement;const parent=canvas.parentElement as (HTMLElement & {paperShaderMount?:{canvasElement:HTMLCanvasElement}})|null;
 // Paper deliberately loses the old context during dispose. Only a still-live mount is a GPU failure.
 if(canvas.isConnected&&parent?.paperShaderMount?.canvasElement===canvas)setFailed(true);};element.addEventListener('webglcontextlost',lost,true);return()=>element.removeEventListener('webglcontextlost',lost,true);},[]);
 return {ref,active:visible&&!hidden&&!failed&&supportsWebGL(),status:JSON.stringify({visible,hidden,failed,supported:supportsWebGL()})};
}
/** Real Paper shader, mounted only for a visible material surface; flat color survives GPU failure. */
export function PaperSurface(){
 const {ref,active,status}=useVisibleShader();
 return <div ref={ref} data-material-state={status} className="paper-material" aria-hidden="true" data-component="paper-texture">{active?<PaperTexture width="100%" height="100%" colorBack="#f6efdf" colorPaper="#f6efdf" colorShadow="#b6a47d" roughness={.15} fiber={.2} fiberSize={.25} folds={.08} wrinkles={.1} crumples={0} drops={0} seed={4} minPixelRatio={1} maxPixelCount={240000}/>:null}</div>;
}
export function OceanWindow({animate}:{animate:boolean}){
 const {ref,active,status}=useVisibleShader();
 const image=new URL(`${import.meta.env.BASE_URL}assets/crew-ocean.svg`,window.location.href).href;
 return <div ref={ref} data-material-state={status} className="crew-ocean-porthole" aria-hidden="true" data-component="paper-water" data-motion={active&&animate} style={{backgroundImage:`url("${image}")`}}>{active?<Water width="100%" height="100%" image={image} colorBack="#387b89" colorHighlight="#d5efe5" highlights={.13} layering={.35} edges={.1} waves={.12} caustic={.2} size={1.5} speed={animate?.35:0} frame={1200} fit="cover" minPixelRatio={1} maxPixelCount={40000}/>:null}</div>;
}
