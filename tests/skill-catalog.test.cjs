const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {catalogForProject,suggestSkills,resolveSelectedSkills,skillInputs}=require('../desktop/skill-catalog.cjs');

function fixture(t,names){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-skills-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const skills=names.map(name=>{
  const file=path.join(root,name,'SKILL.md');fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,`---\nname: ${name}\ndescription: Fixture for ${name}.\n---\n\nUse this skill.`);
  return {name,path:file,enabled:true,description:`Fixture for ${name}.`};
 });
 return {root,skills,client:{request:async(method,args)=>{assert.equal(method,'skills/list');assert.deepEqual(args,{cwds:[root]});return {data:[{cwd:root,skills}]};}}};
}

test('suggests at most two reviewed, available skills for the brief and role',async t=>{
 const {root,client,skills}=fixture(t,['ecc-frontend-a11y','ecc-market-research','ecc-article-writing','sunny-world-art-review']);
 skills.push({name:'unreviewed-skill',path:skills[0].path,enabled:true});
 const catalog=await catalogForProject(client,root,root);
 assert.equal(catalog.some(skill=>skill.id==='unreviewed-skill'),false);
 const picks=suggestSkills(catalog,'Research competitor markets and write an article','coordinator');
 assert.equal(picks.length,2);
 assert.deepEqual(picks.map(skill=>skill.id),['ecc-market-research','ecc-article-writing']);
 assert.deepEqual(suggestSkills(catalog,'Review keyboard accessibility of this form','designer').map(skill=>skill.id),['ecc-frontend-a11y']);
 assert.deepEqual(suggestSkills(catalog,'Research an idea','coordinator'),[]);
 assert.deepEqual(suggestSkills(catalog,'A general task with no skill fit','coordinator'),[]);
});

test('disabled, changed, duplicate and missing selections fail before launch',async t=>{
 const {root,client,skills}=fixture(t,['ecc-article-writing']);
 const [choice]=await catalogForProject(client,root,root);
 assert.deepEqual((await resolveSelectedSkills(client,root,root,[{id:choice.id,revision:choice.revision}])).map(s=>s.id),[choice.id]);
 await assert.rejects(resolveSelectedSkills(client,root,root,[{id:choice.id,revision:choice.revision},{id:choice.id,revision:choice.revision}]),/duplicate/i);
 fs.appendFileSync(skills[0].path,'\nChanged');
 await assert.rejects(resolveSelectedSkills(client,root,root,[{id:choice.id,revision:choice.revision}]),/changed/i);
 skills[0].enabled=false;
 await assert.rejects(resolveSelectedSkills(client,root,root,[{id:choice.id,revision:choice.revision}]),/unavailable/i);
 await assert.rejects(resolveSelectedSkills(client,root,root,[{id:'missing',revision:choice.revision}]),/unavailable/i);
});

test('selected skill becomes an explicit Codex skill input',async t=>{
 const {root,client}=fixture(t,['ecc-article-writing']);
 const [skill]=await catalogForProject(client,root,root);
 assert.deepEqual(skillInputs([skill]),[{type:'skill',name:'ecc-article-writing',path:skill.path}]);
});
test('resident skills follow canonical capabilities while reporter accepts none',async t=>{const {root,client}=fixture(t,['ecc-market-research','sunny-world-art-review','review-security','imagegen','deploy-with-vercel']);const catalog=await catalogForProject(client,root,root),{skillsForRole}=require('../desktop/skill-catalog.cjs');assert.deepEqual(skillsForRole(catalog,'vivi').map(s=>s.id),['ecc-market-research']);assert.deepEqual(skillsForRole(catalog,'perona').map(s=>s.id),['sunny-world-art-review','review-security','imagegen']);assert.deepEqual(skillsForRole(catalog,'morgans'),[]);assert.deepEqual(skillsForRole(catalog,'All tools'),[]);});
