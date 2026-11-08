import {useEffect,useState} from 'react';

const storageKey='sunny.crew-appearance.v1';
type Appearance='dark'|'light';

export function useCrewAppearance(){
 const [appearance,setAppearance]=useState<Appearance>(()=>{
  try{return localStorage.getItem(storageKey)==='light'?'light':'dark';}catch{return 'dark';}
 });
 const [unsaved,setUnsaved]=useState(false);
 useEffect(()=>{
  document.documentElement.dataset.crewAppearance=appearance;
  try{localStorage.setItem(storageKey,appearance);setUnsaved(false);}catch{setUnsaved(true);}
  return()=>{delete document.documentElement.dataset.crewAppearance;};
 },[appearance]);
 return {dark:appearance==='dark',toggle:()=>setAppearance(value=>value==='dark'?'light':'dark'),unsaved};
}
