// Private compiled scenario, never a provider selected by settings or manifest code.
// No Hub state is available here: inputs are actual outbound protocol and roots.
// Hub appends this boundary after recalled episodes. History must never select a worker.
function currentAssignment(text){
 const boundary='Current captain message:\n\n',start=text.lastIndexOf(boundary);
 if(start<0)return undefined;
 return /^Bounded Sunny assignment (journey-[12]-(?:alpha|beta|author))\./.exec(text.slice(start+boundary.length))?.[1];
}
function create(manifest,{managedRoot}){
 require('./packaged-acceptance.cjs').assertFixtureCapability(manifest);
 const {EventEmitter}=require('node:events'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
 const assets=require('./fixtures/journey-assets.cjs'),{execFile}=require('node:child_process');
 const client=new EventEmitter(),threads=new Map(),turns=new Map(),assignments=new Map(),pending=new Map(),responses=new Set(),children=new Set(),counts={requests:0,git:0,production:0,validation:0,authors:0,reviews:0};
 const cue=manifest.scenario==='journey-cue',epochs=cue?2:1,maxTurns=cue?12:5;let serial=0,bridge,closed=false,failure;
 client.connected=manifest.phase===1;
 const deny=message=>{throw Error('Finite offline fixture: '+message);};
 const live=()=>{if(closed||failure||manifest.phase!==1)deny('inactive or failed');};
 const root=cwd=>{if(typeof cwd!=='string'||!path.isAbsolute(cwd))deny('absolute root required');const actual=fs.realpathSync.native(cwd),relative=path.relative(managedRoot,actual);if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||actual.toLowerCase()!==path.resolve(cwd).toLowerCase())deny('root outside owned managed tree');return actual;};
 async function git(cwd,args){live();root(cwd);counts.git++;if(counts.git>24)deny('Git effect bound');return new Promise((resolve,reject)=>{const child=execFile('git',args,{cwd,windowsHide:true,timeout:20000,maxBuffer:65536,encoding:'utf8'},(error,stdout)=>{children.delete(child);if(error)reject(error);else resolve(stdout.trim());});children.add(child);});}
 const pause=()=>new Promise(r=>setTimeout(r,25));
 async function call(t,tool,args){live();if(!t.tools.includes(tool))deny('unavailable tool');if(++counts.requests>1000)deny('request bound');const id='journey-call-'+(++serial);responses.add(id);return bridge.request({id,method:'item/tool/call',params:{threadId:t.threadId,turnId:t.id,callId:id,tool,arguments:args}}).then(result=>{const text=result?.contentItems?.[0]?.text;let value;try{value=JSON.parse(text);}catch{deny('unstructured tool response '+String(text).slice(0,160));}return value;});}
 async function context(t){for(let i=0;i<160;i++){const r=await call(t,'sunny_status',{runId:t.context.run.id,projectId:t.context.run.projectId});if(r.context?.session.bindingState==='bound')return r.context;if(r.code!=='SESSION_BINDING_PENDING')deny('status rejected '+r.code);await pause();}deny('binding did not settle');}
 const bind=c=>({runId:c.run.id,projectId:c.run.projectId,expectedRevision:c.run.revision});
 async function mutate(t,tool,make){for(let i=0;i<80;i++){const c=await context(t),r=await call(t,tool,make(c));if(r.code==='STALE_REVISION'||r.status==='pending'){await pause();continue;}if(r.status==='unknown'||r.status==='blocked'||r.status==='rejected'||r.error)deny('operation rejected '+JSON.stringify(r).slice(0,500));return r;}deny('finite operation did not settle');}
 async function done(t,text){live();await bridge.notify({method:'item/completed',params:{threadId:t.threadId,item:{id:'journey-message-'+t.id,type:'agentMessage',text}}});await bridge.notify({method:'turn/completed',params:{threadId:t.threadId,turn:{id:t.id,status:'completed'}}});}
 async function drive(t){await bridge.notify({method:'thread/tokenUsage/updated',params:{threadId:t.threadId,tokenUsage:{total:{totalTokens:1}}}});
  if(t.context?.session.role==='production-coordinator'){
   const n=++counts.production;if(n>epochs)deny('extra production epoch');const prefix='journey-'+n+'-',authorIds=cue?[prefix+'alpha',prefix+'beta']:[prefix+'author'];
   await mutate(t,'sunny_plan',c=>{const make=(id,crewId,capability,ownedPaths)=>({id,crewId,roleId:capability==='review'?'reviewer':'builder',capability,ownedPaths,dependencies:capability==='review'?authorIds:[],objective:'Finite native journey '+id,criteriaIds:c.criteria.map(v=>v.id),baseCommit:c.checkpoint.headCommit,state:'queued'}),items=[...(cue?[make(authorIds[0],'franky','implementation',['src/alpha.cjs']),make(authorIds[1],'franky','implementation',['src/beta.cjs'])]:[make(authorIds[0],'franky','implementation',['src'])]),make(prefix+'review-one','zoro','review',[]),make(prefix+'review-two','zoro','review',[])];for(const a of items)assignments.set(a.id,{...a,epoch:n});return {...bind(c),decision:{id:prefix+'plan',option:'Execute fixed useful work',reason:'Exercise actual ordinary delivery',dissent:[],owner:'luffy',nextAction:'Commit and review',reopenEvidence:'Any source drift'},assignments:items};});
   const receipt=await mutate(t,'sunny_deliver',c=>({...bind(c),missionId:c.mission.id,attemptId:c.mission.attemptId,producerAssignmentId:authorIds[0],result:cue?{kind:'playable',descriptorPath:c.deliverable.descriptorPath}:{kind:'reply'}}));assert.equal(receipt.status,'delivered');await done(t,'Useful native journey source committed and integrated.');return;
  }
  if(t.context?.session.role==='validation-coordinator'){if(++counts.validation>epochs)deny('extra validation');const receipt=await mutate(t,'sunny_validate',c=>({...bind(c),continuationId:c.continuationId}));assert.equal(receipt.status,'validated');await done(t,'Fixed suite and independent reviews completed.');return;}
  if(t.context?.session.role==='reviewer'){
   if(++counts.reviews>epochs*2)deny('extra reviewer');const c=await context(t),a=assignments.get(c.reviewAssignmentId);if(!a||a.capability!=='review')deny('unplanned reviewer');
   for(const [file,expected]of [['alpha.cjs',assets.alpha(a.epoch)],['beta.cjs',assets.beta(a.epoch)]])assert.equal(fs.readFileSync(path.join(t.cwd,'src',file),'utf8'),expected,'Independent semantic source review');
   assert.ok(c.criteria.every(v=>['test','build'].every(kind=>c.checkReceipts.some(r=>r.criterionId===v.id&&r.kind===kind&&r.status==='passed'))));
   await mutate(t,'sunny_review',c=>({...bind(c),verdict:{id:a.id+'-verdict',source:c.source,decision:'approve',findings:[],criteriaIds:c.criteria.map(v=>v.id)}}));await done(t,'Independently inspected the actual counter implementation and suite receipts.');return;
  }
  const match=currentAssignment(t.text),a=assignments.get(match);if(!a||a.capability!=='implementation'||++counts.authors>(cue?4:1))deny('unplanned author');
  const files=a.id.endsWith('alpha')?['alpha.cjs']:a.id.endsWith('beta')?['beta.cjs']:['alpha.cjs','beta.cjs'];for(const file of files){const target=path.join(t.cwd,'src',file);if(fs.lstatSync(target).isSymbolicLink())deny('source alias');fs.writeFileSync(target,file==='alpha.cjs'?assets.alpha(a.epoch):assets.beta(a.epoch));}await git(t.cwd,['add','--',...files.map(f=>'src/'+f)]);await git(t.cwd,['-c','user.name=Finite journey','-c','user.email=fixture@example.invalid','commit','-m','Useful fixed journey '+a.id]);await done(t,'Committed useful counter behavior for '+a.id);
 }
 client.request=async(method,p={})=>{live();if(method==='skills/list')return {data:[]};if(method==='config/read')return {config:{}};
  if(method==='thread/start'){if(threads.size>=maxTurns)deny('thread bound');const id='journey-thread-'+(++serial),cwd=root(p.cwd),tools=(p.dynamicTools||[]).map(t=>t.name);threads.set(id,{cwd,tools});return {thread:{id}};}
  if(method==='turn/start'){const thread=threads.get(p.threadId);if(!thread||root(p.cwd)!==thread.cwd||turns.size>=maxTurns||[...turns.values()].some(t=>t.threadId===p.threadId))deny('unexpected turn');const text=p.input.filter(i=>i.type==='text').map(i=>i.text).join('\n'),match=text.match(/<sunnyContext>([\s\S]*?)<\/sunnyContext>/),t={...thread,id:'journey-turn-'+(++serial),threadId:p.threadId,text,context:match?JSON.parse(match[1]):null};turns.set(t.id,t);setImmediate(()=>{const promise=drive(t).catch(error=>{failure=error;client.emit('diagnostic',error.message,{event:'provider-handler-failed'});});pending.set(t.id,promise);promise.finally(()=>pending.delete(t.id));});return {turn:{id:t.id}};}
  deny('unexpected provider method '+method);
 };
 client.respond=id=>{if(!responses.delete(id))deny('unexpected response channel');};client.rejectRequest=()=>deny('unexpected rejection');client.connect=()=>deny('external connection');client.close=()=>{closed=true;client.connected=false;for(const child of children)if(child.exitCode===null&&child.signalCode===null)child.kill();};
 Object.defineProperty(client,'fixtureEffects',{get:()=>({providerEffects:0,realProviderEffects:0,providerMode:'finite-offline',liveSupervisionAdmitted:false,localRequests:counts.requests,localGit:counts.git,turns:turns.size,...counts})});
 return {client,attach(value){if(bridge||typeof value.request!=='function'||typeof value.notify!=='function')deny('bridge');bridge=Object.freeze({request:value.request,notify:value.notify});},assertHealthy(){if(failure)throw failure;if(children.size)deny('Git still active');},scopeEnforcingProvider:({root:one,otherRoot:two})=>one!==two&&[one,two].every(r=>r.toLowerCase().startsWith(path.resolve(managedRoot).toLowerCase()+path.sep)),get failure(){return failure;}};
}
module.exports={create};
