// Entry is private to an admitted packaged scenario. Imports follow the capability check.
async function boot(manifest,stage){
 require('./packaged-acceptance.cjs').assertFixtureCapability(manifest);
 const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process');
 const projectRoot=path.join(manifest.profileDir,'journey-project'),managedRoot=path.join(manifest.profileDir,'execution-workspaces');
 if(manifest.phase===1){
  fs.mkdirSync(projectRoot);fs.mkdirSync(path.join(projectRoot,'src'));fs.mkdirSync(managedRoot);
  for(const [relative,bytes]of Object.entries(require('./fixtures/journey-assets.cjs').initial))fs.writeFileSync(path.join(projectRoot,relative),bytes,{flag:'wx'});
  const git=args=>new Promise((resolve,reject)=>execFile('git',args,{cwd:projectRoot,windowsHide:true,timeout:20000,maxBuffer:65536},error=>error?reject(error):resolve()));
  for(const args of [['init'],['config','core.autocrlf','false'],['config','user.name','Finite journey'],['config','user.email','fixture@example.invalid'],['add','--','.'],['commit','-m','Fixed genuine journey baseline']])await git(args);
 }
 const provider=require('./journey-provider.cjs').create(manifest,{managedRoot}),{openOrderedStore}=require('./ordered-store.cjs'),{Hub}=require('./hub.cjs');
 const catalog=Object.freeze({discoverProjects:()=>[{id:'journey-project',name:'Private genuine journey',path:projectRoot}],discoverTools:()=>[],discoverAutomations:()=>[],getExecutable:()=>undefined});
 let store,hub;return require('./fixture-stages.cjs').withFailureStage(async()=>{
  stage('store-open-enter');store=await openOrderedStore({kind:'sqlite',file:path.join(manifest.profileDir,'sunny.sqlite'),backupDir:path.join(manifest.profileDir,'mission-profile-backups')});stage('store-open-exit');
  if(manifest.phase===1&&Object.keys(store.load()).length)throw Error('Genuine journey requires an empty profile');
  const denyExternal=async()=>{throw Error('Private journey forbids external routing');};hub=new Hub({home:manifest.profileDir,store,catalog,jevPrepare:denyExternal,engineeringRoute:denyExternal,fixtureDependencies:{client:provider.client,supervision:true,scopeEnforcingProvider:provider.scopeEnforcingProvider,islandFactory:()=>({close(){}})}});
  hub.managedWorkspaceRoot=managedRoot;hub.jevEnabled=()=>false;hub.routeEnabled=()=>false;hub.state.codex.status=manifest.phase===1?'connected':'disconnected';
  provider.attach({request:event=>hub.request(event),notify:event=>hub.notification(event)});
  stage('recovery-enter');await hub.initializeRecovery();stage('recovery-exit');
  require('./journey-actions.cjs').register(manifest,hub);Object.defineProperty(hub,'journeyFixture',{value:Object.freeze({provider,projectRoot,managedRoot})});return hub;
 },async()=>{if(hub)await hub.close();else if(store)await store.close();},stage);
}
module.exports={boot};
