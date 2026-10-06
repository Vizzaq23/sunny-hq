const {test}=require('node:test'),assert=require('node:assert/strict');
const packaged=require('../desktop/packaged-acceptance.cjs');
const {createHash}=require('node:crypto'),world=require('../desktop/run-ui-fixture.cjs');
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
 assert.throws(()=>world.seedWorldRole(base(),'morgans'),/false|includes/);
 const historical=world.seedWorldHistory(base()),projection=crewSceneProjection(snapshot(historical),'franky');assert.equal(projection.taskId,historical.tasks[0].id);assert.notEqual(projection.taskId,historical.tasks[2].id);assert.equal(historical.missionBook.runs[0].assignments.filter(a=>a.crewId==='franky').length,2);
});

test('main-owned scene seeds project idle, waiting, failure and review without work claims',()=>{
 for(const [kind,expected,working] of [['idle','idle',false],['working','working',true],['waiting','waiting',false],['unknown','unknown',false],['failed','failed',false],['ready','review',false]]){const state=world.seedWorldCase(base(),kind),scene=crewSceneProjection(snapshot(state),'franky');assert.equal(scene.state,expected,kind);assert.equal(scene.working,working,kind);}
 for(const [id,capability,working] of [['zoro','review',false],['perona','review',false],['perona','creative',true]]){const state=world.seedWorldRole(base(),id,capability),scene=crewSceneProjection(snapshot(state),id);assert.equal(scene.working,working,id+' '+capability);if(capability==='review')assert.equal(scene.label,'Reviewing');}
});
