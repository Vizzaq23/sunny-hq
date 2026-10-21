import {useEffect,useRef,useState} from 'react';
import {GripHorizontal,Maximize2,Minus,Plus,X} from 'lucide-react';
import {ShipView} from './views/DashboardViews';
import {Toasts} from './components/Chrome';
import {useSunny} from './useSunny';
import {projectMission,type MissionProjection} from './missionProjection';
import {claimLiveAcceptanceCue} from './frankyFrames';

export default function Companion(){
 const sunny=useSunny();
 const context=sunny.snapshot.workspace?.context,projection=context?projectMission(sunny.snapshot,context):undefined,previous=useRef<MissionProjection|undefined>(undefined),[acceptedCue,setAcceptedCue]=useState(false),[systemReduced,setSystemReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setSystemReduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 useEffect(()=>{if(!sunny.ready)return;let alive=true;const prior=previous.current;previous.current=projection;if(projection)void claimLiveAcceptanceCue(prior,projection,async()=>Boolean((await sunny.invoke<{play:boolean}>('workspace:claimAcceptanceCue',{acceptanceId:projection.acceptanceId})).play),sunny.snapshot.settings.reducedMotion||systemReduced).then(play=>{if(alive&&play)setAcceptedCue(true);}).catch(()=>{});return()=>{alive=false;};},[sunny.ready,projection?.state,projection?.acceptanceId,projection?.missionId,projection?.attemptId]);
 useEffect(()=>{if(!acceptedCue)return;const timer=window.setTimeout(()=>setAcceptedCue(false),1200);return()=>clearTimeout(timer);},[acceptedCue]);
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
 return <main className={`companion-shell ${sunny.snapshot.settings.reducedMotion||systemReduced?'reduce-motion':''} ${acceptedCue&&!systemReduced&&!sunny.snapshot.settings.reducedMotion?'companion-acceptance-cue':''}`}>
  <header className="companion-toolbar"><span className="ship-drag" title="Drag to move the ship"><GripHorizontal size={15}/> Thousand Sunny</span><button title="Smaller ship" aria-label="Smaller ship" onClick={()=>void sunny.invoke('companion:resize',{delta:-100}).catch(()=>{})}><Minus/></button><button title="Larger ship" aria-label="Larger ship" onClick={()=>void sunny.invoke('companion:resize',{delta:100}).catch(()=>{})}><Plus/></button><button title="Restore full hub" aria-label="Restore full hub" onClick={()=>restore()}><Maximize2/></button><button title="Hide ship to tray" aria-label="Hide ship to tray" onClick={()=>void sunny.invoke('companion:hide').catch(()=>{})}><X/></button></header>
  <ShipView compact snapshot={sunny.snapshot} invoke={sunny.invoke} toast={sunny.toast} onWorkspace={restore} onNavigate={()=>restore()} onImport={()=>restore()}/>
  <Toasts items={sunny.toasts}/>
 </main>;
}
