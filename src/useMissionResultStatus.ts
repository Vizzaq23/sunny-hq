import {useEffect,useRef,useState} from 'react';
import type {MissionResultStatus,ResultStatusEntry,Snapshot} from './shared';
import {boundResultStatus,resultStatusKey,storageOutcomeUncertain} from './workContext';

// One bounded cache per mounted public state consumer; main and companion use the same contract.
export function requestMissionResultStatus(missionId:string){window.dispatchEvent(new CustomEvent('sunny:result-selection',{detail:{missionId}}));}
export function useMissionResultStatuses(snapshot:Snapshot,invoke:(action:string,args?:unknown)=>Promise<unknown>){
 const [entries,setEntries]=useState<Record<string,ResultStatusEntry>>({});
 const [generation,setGeneration]=useState(0);
 const [requestedId,setRequestedId]=useState<string|undefined>(snapshot.workspace?.context?.missionId);
 const latest=useRef(snapshot);latest.current=snapshot;
 useEffect(()=>setRequestedId(snapshot.workspace?.context?.missionId),[snapshot.workspace?.context?.missionId]);
 useEffect(()=>{if(typeof window==='undefined')return;const select=(event:Event)=>{const id=(event as CustomEvent).detail?.missionId;if(typeof id==='string')setRequestedId(id);};window.addEventListener('sunny:result-selection',select);return()=>window.removeEventListener('sunny:result-selection',select);},[]);
 const selected=(snapshot.missions??[]).filter(m=>m.id===requestedId&&m.selectedResult);
 const signature=JSON.stringify([requestedId,...selected.map(m=>resultStatusKey(snapshot,m))]);
 const read=useRef(invoke);read.current=invoke;
 useEffect(()=>{
  let alive=true;
  const pending=selected.filter(m=>generation>0||entries[m.id]?.state==='loading'||entries[m.id]?.key!==resultStatusKey(snapshot,m));
  const retained:Record<string,ResultStatusEntry>=Object.fromEntries(Object.entries(entries).filter(([id])=>id!==requestedId).slice(-2));
  if(storageOutcomeUncertain(snapshot)){
   const recovery:Record<string,ResultStatusEntry>={};
   for(const mission of selected)recovery[mission.id]={key:resultStatusKey(snapshot,mission),state:'error',error:'Storage outcome is uncertain. Keep this window open to copy or export drafts, then restart Sunny to recover saved work.'};
   setEntries(recovery);return()=>{alive=false;};
  }
  for(const mission of selected){const key=resultStatusKey(snapshot,mission);retained[mission.id]=pending.includes(mission)?{key,state:'loading'}:entries[mission.id];}
  setEntries(retained);
  // Limit concurrent read-only full-result resolutions. No transcript or file body is cached here.
  let index=0;
  const worker=async()=>{while(alive&&index<pending.length){const mission=pending[index++],key=resultStatusKey(snapshot,mission);
   try{
    const status=await read.current('mission:resultStatus',{projectId:mission.projectId,missionId:mission.id,revision:mission.revision}) as MissionResultStatus;
    if(!alive)continue;
    const current=latest.current.missions?.find(m=>m.id===mission.id);
    if(!current||resultStatusKey(latest.current,current)!==key)continue;
    const candidate:ResultStatusEntry={key,state:'ready',status};
    if(!boundResultStatus({...latest.current,resultStatuses:{[mission.id]:candidate}},current))throw Error('Selected result status changed; refresh and retry.');
    setEntries(previous=>({...previous,[mission.id]:candidate}));
   }catch(error){if(alive)setEntries(previous=>({...previous,[mission.id]:{key,state:'error',error:error instanceof Error?error.message:String(error)}}));}
  }};
  for(let i=0;i<Math.min(4,pending.length);i++)void worker();
  return()=>{alive=false;};
 },[signature,generation]);
 const visible:Record<string,ResultStatusEntry>={};
 for(const [id,entry] of Object.entries(entries)){const mission=snapshot.missions?.find(m=>m.id===id);if(mission&&entry.key===resultStatusKey(snapshot,mission))visible[id]={...entry,retry:()=>{setRequestedId(id);setGeneration(value=>value+1);}};}
 for(const mission of selected){const key=resultStatusKey(snapshot,mission);visible[mission.id]={...(entries[mission.id]?.key===key?entries[mission.id]:{key,state:'loading' as const}),retry:()=>setGeneration(value=>value+1)};}
 return visible;
}
