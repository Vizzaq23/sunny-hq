import {useCallback,useEffect,useRef,useState} from 'react';
import type {PublicSnapshot,Snapshot} from './shared';
import {EMPTY_SNAPSHOT} from './data';
import {publicStateReducer} from './transcriptState';
import type {PublicState} from './transcriptState';
import {useMissionResultStatuses} from './useMissionResultStatus';
import {stopRoomAudio} from './roomAudio';

export type Toast={id:number;message:string;tone?:'default'|'success'|'error'};

export function useSunny(){
  const [snapshot,setSnapshot]=useState<Snapshot>(EMPTY_SNAPSHOT);
  const [ready,setReady]=useState(false);
  const [loadError,setLoadError]=useState('');
  const [toasts,setToasts]=useState<Toast[]>([]);
  const toastId=useRef(0);
  const desktop=Boolean(window.sunny);

  const toast=useCallback((message:string,tone:Toast['tone']='default')=>{
    const id=++toastId.current;
    setToasts(items=>[...items,{id,message,tone}]);
    window.setTimeout(()=>setToasts(items=>items.filter(item=>item.id!==id)),3600);
  },[]);

  const invoke=useCallback(async<T=unknown>(action:string,args?:unknown):Promise<T>=>{
    const control=args&&typeof args==='object'?args as Record<string,unknown>:undefined;
    if(action==='run:control'&&(control?.action==='stop'||control?.control==='stop')||action==='settings:update'&&(control?.roomSoundEnabled===false||control?.roomSoundVolume!==undefined))stopRoomAudio();
    if(!window.sunny){
      toast('This action is available in the Sunny HQ desktop app.');
      throw new Error('Desktop app required');
    }
    try{return await window.sunny.invoke(action,args) as T;}
    catch(error){const message=error instanceof Error?error.message:String(error);toast(message,'error');throw error;}
  },[toast]);

  useEffect(()=>{
    let alive=true;
    if(!window.sunny){setReady(true);return;}
    let state:PublicState|null=null,reading=false,resyncBudget=1;
    let baselineEpoch:string|undefined,knownAcceptanceIds=new Set<string>(),liveAcceptanceIds:string[]=[];
    const publish=(live=false)=>{
      if(!state)return;
      const {taskSummaries,...rest}=state.snapshot;
      if(Array.isArray(rest.missions)&&!state.earlyEvents){
        const ids=new Set<string>(rest.missions.map(m=>m.acceptance?.legacy===false||m.acceptance?.legacy===undefined?m.acceptance?.id:undefined).filter((id):id is string=>typeof id==='string'));
        if(baselineEpoch!==rest.epoch){baselineEpoch=rest.epoch;knownAcceptanceIds=ids;liveAcceptanceIds=[];}
        else{const health=rest.persistence as Snapshot['persistence'];if(health?.uncertain||health?.state==='uncertain')liveAcceptanceIds=[];else if(live&&!state.needsSnapshot)liveAcceptanceIds=[...liveAcceptanceIds,...[...ids].filter(id=>!knownAcceptanceIds.has(id))].slice(-100);knownAcceptanceIds=ids;}
      }
      setSnapshot({...EMPTY_SNAPSHOT,...rest,tasks:taskSummaries,liveAcceptanceIds} as Snapshot);
    };
    const refresh=async()=>{if(reading||!alive)return;reading=true;let retry=false;try{const next=await window.sunny!.invoke('snapshot') as PublicSnapshot;if(!alive)return;if(next.protocolVersion!==2)throw Error('Sunny transcript protocol changed. Reload the desktop app.');state=publicStateReducer(state,{type:'snapshot',snapshot:next as unknown as PublicState['snapshot']});publish();setLoadError('');retry=Boolean(state?.needsSnapshot);if(retry&&resyncBudget===0)setLoadError('Sunny history changed during loading. Reload to recover its current state.');}catch(error){if(alive)setLoadError(error instanceof Error?error.message:String(error));}finally{reading=false;if(alive)setReady(true);if(alive&&retry&&resyncBudget>0){resyncBudget--;void refresh();}}};
    const onRefresh=()=>{resyncBudget=1;void refresh();};
    window.addEventListener?.('sunny:refresh-snapshot',onRefresh);
    const unsubscribe=window.sunny.subscribe(event=>{
      if(!alive)return;
      if(typeof event.epoch==='string'&&typeof event.sequence==='number'){
        const consecutive=Boolean(state&&!state.earlyEvents&&!state.needsSnapshot&&state.snapshot.epoch===event.epoch&&event.sequence===state.snapshot.sequence+1);
        state=publicStateReducer(state,{type:'event',event:{...event,epoch:event.epoch,sequence:event.sequence}});publish(event.type==='snapshot'&&consecutive);
        if(event.type==='snapshot'){setLoadError('');setReady(true);}
        if(state?.needsSnapshot){resyncBudget=1;void refresh();}
      }
      if(event.type==='error')toast(event.data?.message??'Sunny HQ encountered an error.','error');
    });
    void refresh();
    return()=>{alive=false;unsubscribe?.();window.removeEventListener?.('sunny:refresh-snapshot',onRefresh);};
  },[toast]);

  const mergeSnapshot=useCallback((partial:Partial<Snapshot>)=>setSnapshot(prev=>({...prev,...partial})),[]);
  const resultStatuses=useMissionResultStatuses(snapshot,invoke);
  return{snapshot:{...snapshot,resultStatuses},setSnapshot,mergeSnapshot,ready,loadError,desktop,invoke,toast,toasts};
}
