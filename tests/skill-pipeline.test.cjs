const {receiptStore}=require('./helpers/receipt-store.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Hub}=require('../desktop/hub.cjs');

function setup(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-pipeline-'));
 const skillFile=path.join(root,'.agents','skills','ecc-article-writing','SKILL.md');
 fs.mkdirSync(path.dirname(skillFile),{recursive:true});
 fs.writeFileSync(skillFile,'---\nname: ecc-article-writing\ndescription: Write a long article.\n---\n\nDraft carefully.\n');
 const saves=[];const store={load:()=>({projects:[{id:'p',path:root,name:'Test'}]}),save:value=>saves.push(structuredClone(value)),close:()=>{}};
 const hub=new Hub({home:root,store:receiptStore(store),catalog:{discoverProjects:()=>[],discoverTools:()=>[],discoverAutomations:()=>[]}});
 t.after(async ()=>{await hub.close();fs.rmSync(root,{recursive:true,force:true});});
 hub.client.connected=true;hub.state.codex.status='connected';
 let skills=[{name:'ecc-article-writing',path:skillFile,enabled:true}];const calls=[];
 hub.client.request=async(method,args)=>{
  calls.push({method,args});
  if(method==='skills/list')return {data:[{cwd:root,skills}]};
  if(method==='thread/start')return {thread:{id:'thread-'+calls.length}};
  if(method==='turn/start')return {turn:{id:'turn-'+calls.length}};
  if(method==='config/read')return {config:{}};
  return {};
 };
 return {hub,root,skillFile,saves,calls,disable:()=>{skills=[{...skills[0],enabled:false}];}};
}

test('quick task retains confirmed skill and invokes it without changing the saved brief',async t=>{
 const {hub,calls,saves,skillFile}=setup(t);
 const [skill]=await hub.suggestSkills({projectId:'p',brief:'Write an article about the island',crewId:'brook'}).then(result=>result.suggested);
 const task=await hub.start({projectId:'p',crewId:'brook',prompt:'Write an article about the island',selectedSkills:[{id:skill.id,revision:skill.revision}]});
 assert.equal(task.selectedSkills[0].id,skill.id);
 assert.equal(saves.at(-1).tasks[0].selectedSkills[0].revision,skill.revision);
 assert.equal(task.messages[0].text,'Write an article about the island');
 assert.deepEqual(calls.find(call=>call.method==='turn/start').args.input[1],{type:'skill',name:'ecc-article-writing',path:skillFile});
});

test('mission selection is saved with the attempt and an unavailable skill cannot begin a new attempt',async t=>{
 const {hub,disable,saves}=setup(t);
 const mission=await hub.createMission({projectId:'p',title:'Article',objective:'Write a long article',acceptanceCriteria:['A draft exists'],completionBoundary:'review'});
 const [skill]=await hub.suggestSkills({projectId:'p',brief:mission.objective,roleId:'creator'}).then(result=>result.suggested);
 disable();
 await assert.rejects(hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'creator',selectedSkills:[{id:skill.id,revision:skill.revision}]}),/unavailable/i);
 assert.equal(mission.attempts.length,0);
 assert.equal(hub.state.tasks.length,0);
 assert.equal(saves.at(-1).missionBook.missions[0].status,'DRAFT');
});

test('a coordinator passes a confirmed skill only to a matching specialist',async t=>{
 const {hub}=setup(t);
 const [skill]=await hub.suggestSkills({projectId:'p',brief:'Write an article',roleId:'coordinator'}).then(result=>result.suggested);
 const parent=await hub.start({projectId:'p',crewId:'luffy',prompt:'Write an article',selectedSkills:[{id:skill.id,revision:skill.revision}]});
 const writer=await hub.start({projectId:'p',crewId:'brook',prompt:'Write the article'},{parentTaskId:parent.id});
 assert.deepEqual(writer.selectedSkills.map(item=>item.id),['ecc-article-writing']);
});

test('a completed mission keeps confirmed skills and provider result after restart',async t=>{
 const {hub,root,saves}=setup(t);
 const mission=await hub.createMission({projectId:'p',title:'Article',objective:'Write an article',acceptanceCriteria:['A draft exists'],completionBoundary:'review'});
 const [skill]=await hub.suggestSkills({projectId:'p',brief:mission.objective,roleId:'creator'}).then(result=>result.suggested);
 const task=await hub.startMission({missionId:mission.id,revision:mission.revision,roleId:'creator',selectedSkills:[{id:skill.id,revision:skill.revision}]});
 await hub.notification({method:'item/completed',params:{threadId:task.threadId,item:{id:'reply',type:'agentMessage',text:'Draft delivered.'}}});
 await hub.notification({method:'turn/completed',params:{threadId:task.threadId,turn:{id:task.turnId,status:'completed'}}});
 await hub.persist();
 const saved=saves.at(-1);
 const restored=new Hub({home:root,store:receiptStore({load:()=>saved,save:()=>{},close:()=>{}}),catalog:{discoverProjects:()=>[],discoverTools:()=>[],discoverAutomations:()=>[]}});
 t.after(()=>restored.close());
 assert.equal(restored.state.missions[0].attempts[0].selectedSkills[0].id,skill.id);
 assert.equal(restored.state.tasks[0].selectedSkills[0].revision,skill.revision);
 assert.match(restored.state.tasks[0].messages.at(-1).text,/Draft delivered/);
});
