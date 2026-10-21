const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {admitFixture}=require('../desktop/packaged-acceptance.cjs');
const assets=require('../desktop/fixtures/journey-assets.cjs');

async function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-assignment-recall-'));
 const profileDir=path.join(root,'profile'),outputDir=path.join(root,'out'),managedRoot=path.join(root,'managed');
 for(const dir of [profileDir,outputDir,managedRoot])fs.mkdirSync(dir);
 const nonce='a'.repeat(64),manifestPath=path.join(root,'manifest.json');
 fs.writeFileSync(manifestPath,JSON.stringify({version:1,nonce,profileDir,outputDir,scenario:'journey-cue',phase:1,mib:1}));
 const manifest=admitFixture({manifestPath,nonce,defaultProfile:path.join(root,'unused-live'),env:{}});
 const provider=require('../desktop/journey-provider.cjs').create(manifest,{managedRoot});
 t.after(()=>{provider.client.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
 const completed=new Set(),plans=[];
 const context={session:{role:'production-coordinator',bindingState:'bound'},run:{id:'run',projectId:'project',revision:1},mission:{id:'mission',attemptId:'attempt'},checkpoint:{headCommit:'a'.repeat(40)},criteria:[{id:'criterion'}],deliverable:{descriptorPath:'playable.json'}};
 provider.attach({request:async event=>{
  const {tool,arguments:args}=event.params;let result;
  if(tool==='sunny_status')result={context};
  else if(tool==='sunny_plan'){plans.push(args.assignments);result={status:'planned'};}
  else if(tool==='sunny_deliver')result={status:'delivered'};
  else throw Error('Unexpected fixture tool '+tool);
  return {contentItems:[{text:JSON.stringify(result)}]};
 },notify:async event=>{if(event.method==='turn/completed')completed.add(event.params.turn.id);}});
 const git=(cwd,args)=>execFileSync('git',args,{cwd,windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 function workspace(name){const cwd=path.join(managedRoot,name);fs.mkdirSync(path.join(cwd,'src'),{recursive:true});git(cwd,['init']);git(cwd,['config','core.autocrlf','false']);for(const file of ['alpha.cjs','beta.cjs'])fs.writeFileSync(path.join(cwd,'src',file),assets.initial['src/'+file]);git(cwd,['add','--','.']);git(cwd,['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','base']);return cwd;}
 async function turn(cwd,text,tools=[]){const {thread}=await provider.client.request('thread/start',{cwd,dynamicTools:tools.map(name=>({name}))});const {turn}=await provider.client.request('turn/start',{threadId:thread.id,cwd,input:[{type:'text',text}]});const end=Date.now()+5000;while(!completed.has(turn.id)&&!provider.failure&&Date.now()<end)await new Promise(resolve=>setTimeout(resolve,10));if(provider.failure)throw provider.failure;assert.ok(completed.has(turn.id),'Finite provider must complete');return turn;}
 await turn(workspace('coordinator'),'<sunnyContext>'+JSON.stringify(context)+'</sunnyContext>',['sunny_status','sunny_plan','sunny_deliver']);
 return {provider,workspace,turn,git,plans};
}

test('finite journey beta follows the current assignment after recalled alpha work',async t=>{
 const f=await fixture(t),cwd=f.workspace('beta');
 const recalled='Remembered episode: Bounded Sunny assignment journey-1-alpha. Work on src/alpha.cjs.';
 await f.turn(cwd,recalled+'\n\nCurrent captain message:\n\nBounded Sunny assignment journey-1-beta. Do not spawn agents. Work only on owned paths ["src/beta.cjs"].');
 assert.equal(fs.readFileSync(path.join(cwd,'src/alpha.cjs'),'utf8'),assets.initial['src/alpha.cjs'],'Recalled alpha must not become the current assignment');
 assert.equal(fs.readFileSync(path.join(cwd,'src/beta.cjs'),'utf8'),assets.beta(1));
 assert.equal(f.git(cwd,['diff-tree','--no-commit-id','--name-only','-r','HEAD']),'src/beta.cjs');
});

test('finite journey refuses recalled work when the current assignment is absent or unplanned',async t=>{
 for(const suffix of ['', '\n\nCurrent captain message:\n\nBounded Sunny assignment journey-2-beta. Do not spawn agents.']){
  await t.test(suffix?'unplanned current assignment':'missing current boundary',async t=>{
   const f=await fixture(t),cwd=f.workspace('refused'),head=f.git(cwd,['rev-parse','HEAD']);
   await assert.rejects(f.turn(cwd,'Remembered episode: Bounded Sunny assignment journey-1-alpha.'+suffix),/unplanned author|current assignment/);
   assert.equal(f.git(cwd,['rev-parse','HEAD']),head);assert.equal(f.git(cwd,['status','--porcelain']),'');
  });
 }
});
