import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {Snapshot} from '../shared';
import {freshDelegations,type DelegationSignal} from '../crewDelegation';

export function CrewMap({snapshot,captain,children}:{snapshot:Snapshot;captain:ReactNode;children:ReactNode}){
 const root=useRef<HTMLDivElement>(null),previous=useRef(snapshot);
 const [paths,setPaths]=useState<{id:string;d:string}[]>([]),[pulses,setPulses]=useState<DelegationSignal[]>([]),[paused,setPaused]=useState(false),[visible,setVisible]=useState(false),[hidden,setHidden]=useState(document.hidden),[osReduced,setOsReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const animate=!paused&&!hidden&&visible&&!osReduced&&!snapshot.settings.reducedMotion&&snapshot.persistence.state==='saved'&&!snapshot.persistence.uncertain;
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setOsReduced(media.matches),visibility=()=>setHidden(document.hidden);media.addEventListener('change',change);document.addEventListener('visibilitychange',visibility);const observer=new IntersectionObserver(entries=>setVisible(entries[0].isIntersecting));if(root.current)observer.observe(root.current);return()=>{observer.disconnect();media.removeEventListener('change',change);document.removeEventListener('visibilitychange',visibility);};},[]);
 useEffect(()=>{const next=freshDelegations(previous.current,snapshot,Date.now());previous.current=snapshot;if(animate&&next.length)setPulses(next);},[snapshot,animate]);
 useEffect(()=>{if(!animate)setPulses([]);},[animate]);
 useEffect(()=>{if(!pulses.length)return;const timer=setTimeout(()=>setPulses([]),1300);return()=>clearTimeout(timer);},[pulses]);
 useEffect(()=>{const element=root.current;if(!element)return;const measure=()=>{const box=element.getBoundingClientRect(),captain=element.querySelector('.crew-captain')?.getBoundingClientRect();if(!captain)return;const x=captain.left+captain.width/2-box.left,y=captain.bottom-box.top;setPaths(Array.from(element.querySelectorAll<HTMLElement>('.core-crew-grid>[data-crew-id]')).map(card=>{const target=card.getBoundingClientRect(),tx=target.left+target.width/2-box.left,ty=target.top-box.top;return {id:card.dataset.crewId!,d:`M ${x} ${y} C ${x} ${y+25}, ${tx} ${ty-25}, ${tx} ${ty}`};}));};const observer=new ResizeObserver(measure);observer.observe(element);measure();return()=>observer.disconnect();},[children]);
 return <section className="crew-map-section"><div className="crew-map-key"><span>Captain → specialists · beams mark new assignments and returned replies</span><button aria-pressed={paused} onClick={()=>setPaused(value=>!value)}>{paused?'Resume visuals':'Pause visuals'}</button></div><div className="crew-map" ref={root} data-motion={animate}>
  <svg className="crew-beams" aria-hidden="true">{paths.map(path=><g key={path.id}><path d={path.d}/>{pulses.filter(pulse=>pulse.crewId===path.id).map(pulse=><path key={pulse.id} d={path.d} pathLength="1" className={`crew-beam-pulse ${pulse.direction}`}/>)}</g>)}</svg>
  <section className="crew-captain">{captain}<div className="crew-ocean-porthole" aria-hidden="true"><i/></div></section>
  <div className="crew-grid core-crew-grid">{children}</div>
 </div></section>;
}
