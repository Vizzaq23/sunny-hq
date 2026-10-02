const fs=require('node:fs');
const path=require('node:path');
const {openOrderedStore}=require('./ordered-store.cjs');

async function openProfile({dataDir,openStore=openOrderedStore}){
 if(typeof dataDir!=='string'||!path.isAbsolute(dataDir)||typeof openStore!=='function')throw Error('Invalid profile startup options.');
 const sqlite=path.join(dataDir,'sunny.sqlite'),json=path.join(dataDir,'state.json'),hasSqlite=fs.existsSync(sqlite),hasJson=fs.existsSync(json);
 // A historical JSON fallback can coexist with an empty or older SQLite file.
 // Neither file's existence or timestamp proves which profile is authoritative.
 if(hasSqlite&&hasJson)throw Error('Both SQLite and JSON Sunny profiles exist. Preserve both files and resolve the format using a stopped compatible profile copy before starting Sunny.');
 const kind=hasJson?'json':'sqlite',file=hasJson?json:sqlite;
 // Worker boot validates this selected profile. A failure cannot create defaults
 // in another format and subsequently overwrite the captain's existing history.
 return openStore({kind,file,backupDir:path.join(dataDir,'mission-profile-backups')});
}

async function bootHub({dataDir,home,catalog,openStore,HubClass}){
 const store=await openProfile({dataDir,...(openStore?{openStore}:{})});let hub;
 try{
  const Constructor=HubClass||require('./hub.cjs').Hub;
  hub=new Constructor({home,store,catalog});
  await hub.initializeRecovery();
  return hub;
 }catch(error){
  try{if(hub)await hub.close();else await store.close();}catch{/* Preserve the initial startup error and the worker's uncertain file. */}
  throw error;
 }
}

function createQuitLifecycle({shutdown,onClosed,onFailed}){
 if(typeof shutdown!=='function'||typeof onClosed!=='function'||typeof onFailed!=='function')throw Error('Invalid controlled shutdown callbacks.');
 let pending,completed=false,failure;
 function beforeQuit(event){
  if(completed)return;
  event.preventDefault();
  if(!pending)pending=(async()=>{
   try{await shutdown();completed=true;await onClosed();}
   catch(error){completed=false;failure=error;try{await onFailed(error);}catch{/* A disposed surface cannot grant exit after a failed save. */}}
  })();
  return pending;
 }
 return {beforeQuit,get completed(){return completed;},get failure(){return failure;}};
}

module.exports={openProfile,bootHub,createQuitLifecycle};
