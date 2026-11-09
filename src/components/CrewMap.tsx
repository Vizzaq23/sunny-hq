import {AnimatedBeam} from './vendor/animated-beam';
import {OceanWindow} from './ShipMaterials';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {Snapshot} from '../shared';
import {freshDelegations,type DelegationSignal} from '../crewDelegation';

export function CrewMap({snapshot,captain,children}:{snapshot:Snapshot;captain:ReactNode;children:ReactNode}){
 const root=useRef<HTMLDivElement>(null),previous=useRef(snapshot),captainRef=useRef<HTMLElement>(null);
 const [targets,setTargets]=useState<{id:string;ref:{current:HTMLElement}}[]>([]),[pulses,setPulses]=useState<DelegationSignal[]>([]),[paused,setPaused]=useState(false),[visible,setVisible]=useState(false),[hidden,setHidden]=useState(document.hidden),[osReduced,setOsReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const animate=!paused&&!hidden&&visible&&!osReduced&&!snapshot.settings.reducedMotion&&snapshot.persistence.state==='saved'&&!snapshot.persistence.uncertain;
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setOsReduced(media.matches),visibility=()=>setHidden(document.hidden);media.addEventListener('change',change);document.addEventListener('visibilitychange',visibility);const observer=new IntersectionObserver(entries=>setVisible(entries[0].isIntersecting));if(root.current)observer.observe(root.current);return()=>{observer.disconnect();media.removeEventListener('change',change);document.removeEventListener('visibilitychange',visibility);};},[]);
 useEffect(()=>{const next=freshDelegations(previous.current,snapshot,Date.now());previous.current=snapshot;if(animate&&next.length)setPulses(next);},[snapshot,animate]);
 useEffect(()=>{if(!animate)setPulses([]);},[animate]);
 useEffect(()=>{if(!pulses.length)return;const timer=setTimeout(()=>setPulses([]),1300);return()=>clearTimeout(timer);},[pulses]);
 useEffect(()=>{if(root.current)setTargets(Array.from(root.current.querySelectorAll<HTMLElement>('.core-crew-grid>[data-crew-id]')).map(element=>({id:element.dataset.crewId!,ref:{current:element}})));},[children]);
 return <section className="crew-map-section"><div className="crew-map-key"><span>Captain → specialists · beams mark new assignments and returned replies</span><button aria-pressed={paused} onClick={()=>setPaused(value=>!value)}>{paused?'Resume visuals':'Pause visuals'}</button></div><div className="crew-map" ref={root} data-motion={animate}>
  <div className="crew-beams" aria-hidden="true">{targets.map(target=><AnimatedBeam key={target.id} containerRef={root} fromRef={captainRef} toRef={target.ref} route="crew" pathColor="#af9470" pathOpacity={.7} pathWidth={1.5} className="crew-beam-base"/>)}{pulses.map(pulse=>{const target=targets.find(t=>t.id===pulse.crewId);return target?<AnimatedBeam key={pulse.id} containerRef={root} fromRef={captainRef} toRef={target.ref} route="crew" active reverse={pulse.direction==='inbound'} repeat={0} duration={1.2} pathOpacity={0} pathWidth={3} gradientStartColor={pulse.direction==='inbound'?'#257c85':'#ba5832'} gradientStopColor="#ecc46f" className={`crew-beam-pulse ${pulse.direction}`}/>:null;})}</div>
  <section className="crew-captain" ref={captainRef}>{captain}<OceanWindow animate={animate}/></section>
  <div className="crew-grid core-crew-grid">{children}</div>
 </div></section>;
}
