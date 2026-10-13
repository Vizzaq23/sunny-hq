import {useEffect,useState} from 'react';

export function clearSubmittedDraft(key:string,submitted:string){
 try{const storageKey=`sunny:draft:v1:${key}`;if(sessionStorage.getItem(storageKey)===submitted)sessionStorage.setItem(storageKey,'');}catch{/* A failed storage write must not turn a successful launch into a retry. */}
 window.dispatchEvent(new CustomEvent('sunny:draft-submitted',{detail:{key,submitted}}));
}

// Session-scoped drafts survive navigation and reloads, and clear when the window closes.
export function useDraft(key:string,initial='',seedEmptyOnMount=false){
 const read=()=>{try{return sessionStorage.getItem(`sunny:draft:v1:${key}`)??initial;}catch{return initial;}};
 const [stored,setStored]=useState(()=>{const text=read();return {key,text:seedEmptyOnMount&&!text?initial:text};});
 useEffect(()=>{
  const change=(event:Event)=>{if((event as CustomEvent).detail===key)setStored({key,text:read()});};
  const clear=(event:Event)=>{const detail=(event as CustomEvent<{key:string;submitted:string}>).detail;if(detail.key===key)setStored(previous=>previous.key===key&&previous.text===detail.submitted?{key,text:''}:previous);};
  window.addEventListener('sunny:draft-change',change);window.addEventListener('sunny:draft-submitted',clear);
  return()=>{window.removeEventListener('sunny:draft-change',change);window.removeEventListener('sunny:draft-submitted',clear);};
 },[key]);
 let text=stored.text;
 if(stored.key!==key){text=read();setStored({key,text});}
 const setText=(value:string)=>{
  setStored({key,text:value});
  try{sessionStorage.setItem(`sunny:draft:v1:${key}`,value);window.dispatchEvent(new CustomEvent('sunny:draft-change',{detail:key}));}catch{/* The in-memory draft remains usable when storage is unavailable. */}
 };
 return [text,setText] as const;
}
