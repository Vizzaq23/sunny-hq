const {test}=require('node:test'),assert=require('node:assert/strict');
const packaged=require('../desktop/packaged-acceptance.cjs');
const {createHash}=require('node:crypto'),world=require('../desktop/run-ui-fixture.cjs');
const vm=require('node:vm'),worldEvidence=require('../desktop/run-ui-world-fixture.cjs');
const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
Module._extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {crewSceneProjection}=require('../src/roomActivity.ts');
function base(){const state=packaged.loadFrozenFixture(1),mission=state.missionBook.missions[0],task=state.tasks[0],message=task.messages.find(item=>item.role==='assistant');mission.selectedResult={id:'fixture-result',attemptId:mission.activeAttemptId,producerTaskId:task.id,ref:{kind:'reply',taskId:task.id,messageId:message.id,sha256:createHash('sha256').update(message.text).digest('hex')},selectedAt:1};return state;}
function snapshot(state){return {...state,approvals:[],missions:state.missionBook.missions,runs:state.missionBook.runs,workspace:state.missionBook.workspace,persistence:{state:'saved'}};}

test('private run UI admits only bounded production settings updates',()=>{
 const runUI={scenario:'run-ui',phase:1};
 for(const args of [{reducedMotion:true},{reducedMotion:false,roomSoundEnabled:true,roomSoundVolume:.65},{roomSoundEnabled:false,roomSoundVolume:0}])assert.doesNotThrow(()=>packaged.assertFixtureAction('settings:update',args,runUI));
 for(const args of [{},{model:'fixture'},{reducedMotion:'true'},{roomSoundEnabled:1},{roomSoundVolume:-.01},{roomSoundVolume:.651},{roomSoundVolume:Infinity},{roomSoundVolume:NaN},{reducedMotion:true,notifications:false},null,[]])assert.throws(()=>packaged.assertFixtureAction('settings:update',args,runUI));
 for(const scenario of ['playable','startup','main-restart'])assert.throws(()=>packaged.assertFixtureAction('settings:update',{reducedMotion:true},{scenario}),/blocks/i);
 assert.throws(()=>packaged.assertFixtureAction('settings:update',{reducedMotion:true},{scenario:'run-ui',phase:2}),/blocks/i);
 for(const action of ['workspace:claimAcceptanceCue','task:start','task:send','task:handoff','run:control'])assert.throws(()=>packaged.assertFixtureAction(action,{},runUI),/blocks/i);
});

test('world scenes retain coherent authority and four distinct recruited residents',()=>{
 assert.equal(world.WORLD_IDS.length,15);assert.equal(new Set(world.WORLD_IDS).size,15);
 for(const kind of world.WORLD_CASES){const state=world.seedWorldCase(base(),kind),run=state.missionBook.runs[0],mission=state.missionBook.missions[0];assert.equal(state.world.residents.length,4);assert.equal(new Set(state.world.residents.map(r=>r.district)).size,4);assert.ok(state.world.residents.every(r=>r.recruited));assert.equal(run.grant.maxWorkers,3);assert.equal(run.projectId,mission.projectId);assert.equal(mission.runId,run.id);assert.equal(state.settings.reducedMotion,kind==='reduced-motion');if(kind==='idle')assert.equal(run.assignments.some(a=>a.state==='working'),false);if(kind==='failed'){assert.equal(run.phase,'blocked');assert.equal(mission.status,'FAILED');}if(kind==='accepted')assert.equal(mission.acceptance.resultId,mission.selectedResult.id);}
 for(const kind of world.WORLD_NEGATIVES){const state=world.seedWorldCase(base(),kind);assert.equal(crewSceneProjection(snapshot(state),'franky').working,false,kind);}
 for(const [id,capability] of [['zoro','review'],['perona','review'],['perona','creative'],['law','diagnosis']]){const state=world.seedWorldRole(base(),id,capability),assignment=state.missionBook.runs[0].assignments[0];assert.equal(state.tasks[0].crewId,id);assert.equal(assignment.crewId,id);assert.equal(assignment.capability,capability);assert.equal(assignment.taskId,state.tasks[0].id);}
 for(const id of world.WORLD_IDS.slice(0,-1))assert.equal(require('../desktop/mission-profile.cjs').inspectMissionProfile(world.seedWorldRole(base(),id)).mode,'v3',id);
 const forbidden=world.seedWorldCase(base(),'working'),luffyBinding=require('../desktop/crew-registry.cjs').crewBinding('luffy',forbidden.world);forbidden.tasks[0].crewId='luffy';Object.assign(forbidden.missionBook.runs[0].assignments[0],{crewId:'luffy',roleId:luffyBinding.roleId,capability:'coordination'});assert.equal(require('../desktop/mission-profile.cjs').inspectMissionProfile(forbidden).mode,'unsupported','coordinator cannot be a specialist assignment');
 const captain=world.seedWorldRole(base(),'luffy');assert.equal(captain.missionBook.runs.length,0);assert.equal(captain.tasks[0].runId,undefined);assert.equal(crewSceneProjection(snapshot(captain),'luffy').taskId,captain.tasks[0].id);
 assert.throws(()=>world.seedWorldRole(base(),'morgans'),/false|includes/);
 const historical=world.seedWorldHistory(base()),projection=crewSceneProjection(snapshot(historical),'franky');assert.equal(projection.taskId,historical.tasks[0].id);assert.notEqual(projection.taskId,historical.tasks[2].id);assert.equal(historical.missionBook.runs[0].assignments.filter(a=>a.crewId==='franky').length,2);
});

test('main-owned scene seeds project idle, waiting, failure and review without work claims',()=>{
 for(const [kind,expected,working] of [['idle','idle',false],['working','working',true],['waiting','waiting',false],['unknown','unknown',false],['failed','failed',false],['ready','review',false]]){const state=world.seedWorldCase(base(),kind),scene=crewSceneProjection(snapshot(state),'franky');assert.equal(scene.state,expected,kind);assert.equal(scene.working,working,kind);}
 for(const [id,capability,working] of [['zoro','review',false],['perona','review',false],['perona','creative',true]]){const state=world.seedWorldRole(base(),id,capability),scene=crewSceneProjection(snapshot(state),id);assert.equal(scene.working,working,id+' '+capability);if(capability==='review')assert.equal(scene.label,'Reviewing');}
});

test('same-context working to unknown to failed remains a strict saved mission profile',()=>{
 const state=world.seedWorldCase(base(),'working');
 const valid=()=>assert.equal(require('../desktop/mission-profile.cjs').inspectMissionProfile(state).mode,'v3');
 valid();
 state.tasks[0].status='unknown';state.missionBook.runs[0].assignments[0].state='unknown';valid();
 state.tasks[0].status='failed';state.missionBook.runs[0].assignments[0].state='failed';state.missionBook.runs[0].phase='blocked';state.missionBook.missions[0].status='FAILED';state.missionBook.missions[0].attempts.find(a=>a.id===state.missionBook.missions[0].activeAttemptId).status='failed';valid();
});

test('renderer asset sample crosses the bridge as bounded scalars before receipt writing',()=>{
 const inline='data:image/png;base64,'+'A'.repeat(5*1024*1024),images=[inline,'file:///synthetic/app/assets/franky-shipwright-room.png'].map(src=>({currentSrc:src,src,offsetParent:{},complete:true,naturalWidth:128,naturalHeight:128,getAttribute:()=>src}));
 const clip={parentElement:null,getBoundingClientRect:()=>({left:100,top:100,right:105,bottom:200})};
 const actor={dataset:{frame:'F'.repeat(500),secret:'Z'.repeat(1024*1024)},parentElement:clip,getBoundingClientRect:()=>({left:100,top:100,right:200,bottom:200,x:100,y:100,width:100,height:100})};
 const document={visibilityState:'visible',documentElement:{scrollWidth:1000},images,querySelector:selector=>selector==='.franky-actor'?actor:null,querySelectorAll:()=>[]};
 const sample=vm.runInNewContext(worldEvidence.RENDERER_SAMPLE_SCRIPT,{document,innerWidth:1000,innerHeight:700,getComputedStyle:element=>({visibility:'visible',overflowX:element===clip?'hidden':'visible',overflowY:element===clip?'hidden':'visible',backgroundPosition:'0px',animationPlayState:'running',opacity:'1',objectFit:'contain'})});
 assert.equal(sample.assets[0].sourceKind,'inline');assert.equal(sample.assets[0].assetName,null);assert.equal(sample.assets[0].sourceLength,inline.length);
 assert.equal(sample.assets[1].assetName,'franky-shipwright-room.png');assert.equal(sample.actor.dataset.frame.length,160);assert.equal(sample.actor.dataset.secret,undefined);assert.equal(sample.actor.visibleFraction,.05);assert.ok(Buffer.byteLength(JSON.stringify(sample))<2048);assert.ok(!JSON.stringify(sample).includes('AAAA'));
 assert.ok(Buffer.byteLength(worldEvidence.progressJSON({samples:[sample]}))<3072);assert.throws(()=>worldEvidence.progressJSON({samples:['A'.repeat(4*1024*1024)]}),/4 MiB/);
});

test('native scene receipts require visible art and actor rather than document visibility alone',()=>{
 const visible={visibleFraction:.8},clipped={visibleFraction:.05};
 for(const [surface,art,actor] of [['island','island','deck'],['quarters','quarter','roomActor'],['workshop','roomArt','actor']]){
  assert.deepEqual(worldEvidence.sceneVisibility({[art]:visible,[actor]:visible},surface),{artVisibleFraction:.8,actorVisibleFraction:.8});
  assert.throws(()=>worldEvidence.sceneVisibility({[art]:visible,[actor]:clipped},surface),/actor is below/);
  assert.throws(()=>worldEvidence.sceneVisibility({[art]:clipped,[actor]:visible},surface),/art is clipped/);
 }
});

test('positive motion is admitted only after all three visible actor controls change',()=>{
 const cases=['island','quarters','franky'].map(surface=>({check:surface+'-positive',actorVisible:true,moved:true}));
 assert.equal(worldEvidence.motionGate(cases),'passed');
 assert.equal(worldEvidence.motionGate(cases.slice(0,2)),'partial');
 assert.equal(worldEvidence.motionGate(cases.map((value,index)=>index?value:{...value,actorVisible:false})),'partial');
 assert.equal(worldEvidence.motionGate(cases.map((value,index)=>index?value:{...value,moved:false})),'partial');
});

test('temporary user motion setting restores through the production action on observation failure',async()=>{
 const actions=[],win={};
 const invoke=async(target,action,args)=>{assert.equal(target,win);assert.equal(action,'settings:update');actions.push(args.reducedMotion);};
 const wait=async()=>{};
 await assert.rejects(worldEvidence.withTemporaryReducedMotion(invoke,win,wait,async()=>{throw Error('renderer sample failed');}),/renderer sample failed/);
 assert.deepEqual(actions,[true,false]);
});
