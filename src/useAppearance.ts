import {useEffect,useState} from 'react';
const storageKey='sunny.appearance.v1';
type Appearance='dark'|'light';
export function useAppearance(){
 const [appearance,setAppearance]=useState<Appearance>(()=>{
  try{const saved=localStorage.getItem(storageKey)??localStorage.getItem('sunny.crew-appearance.v1');return saved==='light'?'light':'dark';}catch{return 'dark';}
 });
 const [unsaved,setUnsaved]=useState(false);
 useEffect(()=>{
  document.documentElement.dataset.appearance=appearance;
  try{localStorage.setItem(storageKey,appearance);setUnsaved(false);}catch{setUnsaved(true);}
  return()=>{delete document.documentElement.dataset.appearance;};
 },[appearance]);
 return {dark:appearance==='dark',toggle:()=>setAppearance(value=>value==='dark'?'light':'dark'),unsaved};
}
export type AppearanceControl=ReturnType<typeof useAppearance>;
