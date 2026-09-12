import {useEffect} from 'react';
import {GripHorizontal,Maximize2,Minus,Plus,X} from 'lucide-react';
import {ShipView} from './views/DashboardViews';
import {Toasts} from './components/Chrome';
import {useSunny} from './useSunny';

export default function Companion(){
 const sunny=useSunny();
 useEffect(()=>{
  document.documentElement.classList.add('companion-document');
  let previous=false;
  const move=(e:MouseEvent)=>{
   const target=e.target as Element;
   const ignore=!target.closest('button,select,textarea,input,.crew-journal,.deck-dialog,.companion-toolbar,.ship-art,.crew-life-controls');
   if(ignore!==previous){previous=ignore;void window.sunny?.invoke('companion:mouse',{ignore}).catch(()=>{});}
  };
  document.addEventListener('mousemove',move);
  return()=>{document.removeEventListener('mousemove',move);document.documentElement.classList.remove('companion-document');};
 },[]);
 const restore=(workspace?:unknown)=>void sunny.invoke('companion:restore',{workspace}).catch(()=>{});
 return <main className={`companion-shell ${sunny.snapshot.settings.reducedMotion?'reduce-motion':''}`}>
  <header className="companion-toolbar"><span className="ship-drag" title="Drag to move the ship"><GripHorizontal size={15}/> Thousand Sunny</span><button title="Smaller ship" aria-label="Smaller ship" onClick={()=>void sunny.invoke('companion:resize',{delta:-100}).catch(()=>{})}><Minus/></button><button title="Larger ship" aria-label="Larger ship" onClick={()=>void sunny.invoke('companion:resize',{delta:100}).catch(()=>{})}><Plus/></button><button title="Restore full hub" aria-label="Restore full hub" onClick={()=>restore()}><Maximize2/></button><button title="Hide ship to tray" aria-label="Hide ship to tray" onClick={()=>void sunny.invoke('companion:hide').catch(()=>{})}><X/></button></header>
  <ShipView compact snapshot={sunny.snapshot} invoke={sunny.invoke} toast={sunny.toast} onWorkspace={restore} onNavigate={()=>restore()} onImport={()=>restore()}/>
  <Toasts items={sunny.toasts}/>
 </main>;
}
