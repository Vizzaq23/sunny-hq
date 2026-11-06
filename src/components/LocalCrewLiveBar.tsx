import {useState} from 'react';
import type {Snapshot} from '../shared';
import {CREW_BY_ID} from '../data';
type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
export function LocalCrewLiveBar({snapshot,invoke,onCaptain}:{snapshot:Snapshot;invoke:Invoke;onCaptain?:(projectId:string)=>void}){
 const [error,setError]=useState('');
 const active=snapshot.localCrew?.councils?.find(item=>['planning','working','reviewing','synthesizing'].includes(item.status));
 const council=active??snapshot.localCrew?.councils?.at(-1);
 if(!council)return null;
 const settledLabel=council.status==='ready'?(council.contributions.length?'Crew advice is ready':'Luffy replied'):council.status==='partial'?'Crew advice is ready with gaps':council.status==='interrupted'?'Crew stopped':'Local council needs attention';
 return <aside className="local-crew-live" aria-label="Live local crew work"><div><b>{!active?settledLabel:council.status==='planning'?'Luffy is choosing the crew':council.status==='synthesizing'?'Luffy is combining the reports':council.status==='reviewing'?'Zoro is cross-checking the crew’s proposals':'Local crew at work'}</b><span>{snapshot.projects.find(project=>project.id===council.projectId)?.name??'Selected project'} · {council.objective.slice(0,160)}</span><p role="status">{active?(council.contributions.map(member=>`${CREW_BY_ID.get(member.crewId)?.name??member.crewId}: ${member.status==='working'?'thinking':member.status==='ready'?'advice ready':member.status}`).join(' · ')||'Waiting for Luffy’s plan'):'Local advice only. No implementation or acceptance is implied.'}</p></div>{onCaptain?<button onClick={()=>onCaptain(council.projectId)}>{active?'Step in with Luffy':'Return to Luffy'}</button>:null}{active?<button onClick={()=>void invoke('localCouncil:stop',{id:council.id}).catch(reason=>setError(String(reason)))}>Stop crew</button>:null}{error?<p role="alert">{error}</p>:null}</aside>;
}
