import {useState} from 'react';
import type {Snapshot} from '../shared';
import {CREW_BY_ID} from '../data';
type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
export function LocalCrewLiveBar({snapshot,invoke,onCaptain}:{snapshot:Snapshot;invoke:Invoke;onCaptain?:()=>void}){
 const [error,setError]=useState('');
 const council=snapshot.localCrew?.councils?.find(item=>['planning','working','reviewing','synthesizing'].includes(item.status));
 if(!council)return null;
 return <aside className="local-crew-live" aria-label="Live local crew work"><div><b>{council.status==='planning'?'Luffy is choosing the crew':council.status==='synthesizing'?'Luffy is combining the reports':council.status==='reviewing'?'Zoro is cross-checking the crew’s proposals':'Local crew at work'}</b><span>{snapshot.projects.find(project=>project.id===council.projectId)?.name??'Selected project'} · {council.objective.slice(0,160)}</span><p role="status">{council.contributions.map(member=>`${CREW_BY_ID.get(member.crewId)?.name??member.crewId}: ${member.status==='working'?'thinking':member.status==='ready'?'advice ready':member.status}`).join(' · ')||'Waiting for Luffy’s plan'}</p></div>{onCaptain?<button onClick={onCaptain}>Step in with Luffy</button>:null}<button onClick={()=>void invoke('localCouncil:stop',{id:council.id}).catch(reason=>setError(String(reason)))}>Stop crew</button>{error?<p role="alert">{error}</p>:null}</aside>;
}
