const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {ROLE_BINDINGS}=require('../desktop/mission-roles.cjs');
test('full roster shares one capability contract',()=>{
 assert.equal(ROLE_BINDINGS.length,15);assert.equal(new Set(ROLE_BINDINGS.map(r=>r.crewId)).size,15);
 const legacy={luffy:'coordinator',nami:'planner',franky:'builder',zoro:'reviewer',usopp:'validator',robin:'researcher',sanji:'designer',chopper:'diagnostician',brook:'creator',jinbe:'operator'};
 for(const [crew,id]of Object.entries(legacy))assert.equal(ROLE_BINDINGS.find(r=>r.crewId===crew).id,id);
 const registry=require('../desktop/crew-registry.cjs');
 for(const r of ROLE_BINDINGS){const binding=registry.crewBinding(r.crewId,{residents:[{id:r.crewId,recruited:true}]});assert.equal(binding.roleId,r.id);assert.ok(binding.capabilities.includes(r.capability));assert.equal(binding.eligible,true);assert.equal(typeof binding.roleRevision,'string');}
});
test('resident bindings preserve custom descriptions and district without granting tools',()=>{
 const file=path.join(__dirname,'../desktop/crew-registry.cjs');assert.ok(fs.existsSync(file),'crew binding registry exists');const {crewBinding,assertCrewBinding}=require(file);
 const world=require('../desktop/island.cjs').initialWorld({residents:[{id:'law',role:'Reviewer with all tools',district:'creative',recruited:true}]});
 const before=structuredClone(world),binding=crewBinding('law',world);assert.equal(world.residents[0].role,'Reviewer with all tools');assert.equal(world.residents[0].district,'creative');assert.equal(world.residents.find(r=>r.id==='ace').role,'Prototypes & experiments');assert.equal(binding.roleId,'systems-analyst');assert.deepEqual(binding.capabilities,['diagnosis','research']);assert.deepEqual(world,before);
 const queued={...binding};assert.throws(()=>assertCrewBinding({...queued,roleRevision:'0'.repeat(64)},world),/changed|revision/i);world.residents[0].role='New saved specialty';assert.throws(()=>assertCrewBinding(queued,world),/changed|revision/i);assert.equal(queued.roleId,'systems-analyst');
 world.residents[0].recruited=false;assert.equal(crewBinding('law',world).eligible,false);assert.throws(()=>assertCrewBinding(crewBinding('law',world),world),/recruit/i);
 for(const [id,role]of [['ace','experimenter'],['vivi','product-researcher'],['perona','creative-reviewer']])assert.equal(crewBinding(id,world).roleId,role);
});
test('reporter cannot inherit writing or execution skills or specialist configuration',()=>{
 assert.equal(require('../desktop/skill-catalog.cjs').roleOf('morgans'),'reporter');
 const registry=require('../desktop/crew-registry.cjs'),binding=registry.crewBinding('morgans');assert.equal(binding.access,'sanitized-report');assert.deepEqual(binding.capabilities,['reporting']);assert.throws(()=>registry.assertWorkerBinding(binding),/report/i);
 assert.equal(require('../desktop/captain.cjs').tools[0].inputSchema.properties.crewId.enum.includes('morgans'),false);
 const skills=require('../desktop/skill-catalog.cjs');assert.deepEqual(skills.skillsForRole(skills.REVIEWED,'reporter'),[]);assert.throws(()=>require('../desktop/crew.cjs').characterInstructions('morgans','Writer with all tools'),/report/i);
});
