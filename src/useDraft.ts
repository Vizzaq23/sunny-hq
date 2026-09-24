import {useEffect,useState} from 'react';

export function clearSubmittedDraft(key:string,submitted:string){
 try{const storageKey=`sunny:draft:v1:${key}`;if(sessionStorage.getItem(storageKey)!==submitted)return;sessionStorage.setItem(storageKey,'');window.dispatchEvent(new CustomEvent('sunny:draft-change',{detail:key}));}catch{/* A failed storage write must not turn a successful launch into a retry. */}
}

// Session-scoped drafts survive navigation and reloads, and clear when the window closes.
export function useDraft(key:string,initial=''){
 const read=()=>{try{return sessionStorage.getItem(`sunny:draft:v1:${key}`)??initial;}catch{return initial;}};
 const [stored,setStored]=useState(()=>({key,text:read()}));
 useEffect(()=>{const clear=(event:Event)=>{if((event as CustomEvent).detail===key)setStored({key,text:read()});};window.addEventListener('sunny:draft-change',clear);return()=>window.removeEventListener('sunny:draft-change',clear);},[key]);
 let text=stored.text;
 if(stored.key!==key){text=read();setStored({key,text});}
 const setText=(value:string)=>{
  setStored({key,text:value});
  try{sessionStorage.setItem(`sunny:draft:v1:${key}`,value);window.dispatchEvent(new CustomEvent('sunny:draft-change',{detail:key}));}catch{/* The in-memory draft remains usable when storage is unavailable. */}
 };
 return [text,setText] as const;
}
