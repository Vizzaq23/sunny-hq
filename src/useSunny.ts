import {useCallback,useEffect,useRef,useState} from 'react';
import type {Snapshot,Task} from './shared';
import {EMPTY_SNAPSHOT} from './data';

export type Toast={id:number;message:string;tone?:'default'|'success'|'error'};

export function useSunny(){
  const [snapshot,setSnapshot]=useState<Snapshot>(EMPTY_SNAPSHOT);
  const [ready,setReady]=useState(false);
  const [toasts,setToasts]=useState<Toast[]>([]);
  const toastId=useRef(0);
  const desktop=Boolean(window.sunny);

  const toast=useCallback((message:string,tone:Toast['tone']='default')=>{
    const id=++toastId.current;
    setToasts(items=>[...items,{id,message,tone}]);
    window.setTimeout(()=>setToasts(items=>items.filter(item=>item.id!==id)),3600);
  },[]);

  const invoke=useCallback(async<T=unknown>(action:string,args?:unknown):Promise<T>=>{
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
    void window.sunny.invoke('snapshot').then((next:Snapshot)=>{if(alive)setSnapshot(next);}).catch((error)=>toast(error instanceof Error?error.message:String(error),'error')).finally(()=>{if(alive)setReady(true);});
    const unsubscribe=window.sunny.subscribe(event=>{
      if(event.type==='snapshot')setSnapshot(event.data as Snapshot);
      if(event.type==='task')setSnapshot(prev=>({...prev,tasks:upsertTask(prev.tasks,event.data as Task)}));
      if(event.type==='approval')setSnapshot(prev=>({...prev,approvals:[...prev.approvals.filter(a=>a.id!==event.data.id),event.data]}));
      if(event.type==='error')toast(event.data?.message??'Sunny HQ encountered an error.','error');
    });
    return()=>{alive=false;unsubscribe?.();};
  },[toast]);

  const mergeSnapshot=useCallback((partial:Partial<Snapshot>)=>setSnapshot(prev=>({...prev,...partial})),[]);
  return{snapshot,setSnapshot,mergeSnapshot,ready,desktop,invoke,toast,toasts};
}

function upsertTask(tasks:Task[],task:Task){const index=tasks.findIndex(item=>item.id===task.id);if(index<0)return[task,...tasks];const next=[...tasks];next[index]=task;return next;}
