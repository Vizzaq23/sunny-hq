const {EventEmitter}=require('node:events');
const {Hub}=require('../../desktop/hub.cjs');
async function fixture(t,saved={}, {trustedSupervision=true}={}){
 let stored=structuredClone(saved),sequence=0;const calls=[],client=new EventEmitter();client.connected=true;client.close=()=>{};client.request=async(method,args)=>{calls.push({method,args});return {thread:{status:'idle',turns:[{status:'interrupted',id:args?.turnId||'turn'}]}};};
 const commit=async image=>{stored=structuredClone(image);return {epoch:'control-fixture',sequence:++sequence,stateSha256:'a'.repeat(64),durableAt:1};};
 const hub=new Hub({home:process.cwd(),store:{load:()=>stored,barrier:commit,checkpoint:commit,flush:async()=>{},close:async()=>{}},catalog:{discoverProjects:()=>[{id:'p',path:process.cwd()}],discoverTools:()=>[],discoverAutomations:()=>[]},fixtureDependencies:{client,supervision:trustedSupervision,islandFactory:()=>({close(){}})}});hub.state.codex.status='connected';
 t.after(()=>{hub.closed=true;clearTimeout(hub.saveTimer);clearTimeout(hub.checkpointTimer);clearTimeout(hub.saveRetryTimer);});
 if(!saved.missionBook)await hub.createRun({runId:'r',projectId:'p',expectedRevision:0,objective:'Build local evidence',criteria:[{id:'c',text:'Verified local change'}],grant:{id:'g',createdBy:'captain',scope:{projectId:'p',objective:'Build local evidence',activities:['read','write','test','review']},maxWorkers:3,maxInitialAssignments:16,maxLaunches:32,maxRepairs:3,workerMs:900000,activeMs:3600000,tokenLimit:100000,improvementMs:0,improvementTokens:0}});
 const task=(id,extra={})=>{const value={id,projectId:'p',crewId:'robin',status:'working',threadId:'thread-'+id,turnId:'turn-'+id,updatedAt:1,messages:[],...extra};hub.state.tasks.push(value);return value;};
 const own=async value=>hub.missionMutation(book=>{book.data.runs[0].coordinator={taskId:value.id,threadId:value.threadId,turnId:value.turnId};});
 return {hub,client,calls,task,own,get stored(){return structuredClone(stored);}};
}
module.exports={fixture};
