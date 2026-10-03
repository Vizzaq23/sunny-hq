const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');

// Only reviewed workflows belong in the launch picker. Codex remains the source of availability.
const REVIEWED=Object.freeze([
 {id:'ecc-frontend-a11y',category:'Engineering',purpose:'Check forms and interactive UI for keyboard and screen reader access.',roles:['builder','designer','reviewer'],terms:[/accessib|keyboard|screen reader|\baria\b/i,/form|modal|menu|interface|\bui\b|component/i]},
 {id:'ecc-market-research',category:'Research',purpose:'Compare markets, competitors and vendors with attributed evidence.',roles:['researcher','planner'],terms:[/market|competitor|industry|vendor|investor/i,/research|compare|trend|sizing/i]},
 {id:'ecc-article-writing',category:'Writing',purpose:'Draft a sourced, structured article, guide or newsletter in the requested voice.',roles:['creator','researcher'],terms:[/article|blog|newsletter|essay|guide|long.form/i,/write|draft|publish|content/i]},
 {id:'sunny-world-art-review',category:'Visual',purpose:'Review Sunny world and character art against its style, provenance and access rules.',roles:['designer','creator','reviewer'],terms:[/sunny|island|ship|crew|sprite|atlas/i,/art|visual|animation|world|room|character/i]},
 {id:'review-security',category:'Engineering',purpose:'Review code changes for concrete security risks.',roles:['reviewer','builder'],terms:[/security|secret|auth|permission|injection|vulnerab/i]},
 {id:'imagegen',category:'Visual',purpose:'Create or revise an image for the requested visual artifact.',roles:['designer','creator'],terms:[/image|illustrat|texture|thumbnail|portrait/i]},
 {id:'documents',category:'Writing',purpose:'Create or edit a reviewable document.',roles:['creator','researcher','planner'],terms:[/document|report|brief|proposal|\.docx\b/i]},
 {id:'deploy-with-vercel',category:'Operations',purpose:'Prepare and verify a Vercel deployment through its scoped tools.',roles:['operator'],terms:[/vercel|deploy|release|publish site/i]}
]);
const BY_ID=new Map(REVIEWED.map(skill=>[skill.id,skill]));
const {roleOf,skillFitsRole}=require('./crew-registry.cjs');
function inside(root,target){const relative=path.relative(root,target);return relative===''||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);}
function skillFile(value,projectPath,home){
 if(typeof value!=='string'||!path.isAbsolute(value))return null;
 let real;try{real=fs.realpathSync(value);}catch{return null;}
 if(fs.statSync(real).isDirectory())real=path.join(real,'SKILL.md');
 if(path.basename(real).toLowerCase()!=='skill.md')return null;
 try{real=fs.realpathSync(real);if(![projectPath,home].some(root=>inside(fs.realpathSync(root),real)))return null;
  const stat=fs.statSync(real);return stat.isFile()&&stat.size>0&&stat.size<=64*1024?real:null;
 }catch{return null;}
}
async function catalogForProject(client,projectPath,home){
 const result=await client.request('skills/list',{cwds:[projectPath]});
 const scopes=Array.isArray(result?.data)?result.data:[];
 const available=[];const seen=new Set();
 for(const scope of scopes){
  if(scope.cwd&&path.resolve(scope.cwd).toLowerCase()!==path.resolve(projectPath).toLowerCase())continue;
  for(const entry of Array.isArray(scope.skills)?scope.skills:[]){
   const def=BY_ID.get(entry.name);if(!def||entry.enabled===false||seen.has(def.id))continue;
   const file=skillFile(entry.path,projectPath,home);if(!file)continue;
   let content;try{content=fs.readFileSync(file,'utf8');}catch{continue;}
   if(!new RegExp(`^name:\\s*["']?${def.id}["']?\\s*$`,'m').test(content))continue;
   const revision=createHash('sha256').update(file.toLowerCase()).update('\0').update(content).digest('hex');
   available.push({id:def.id,name:entry.name,path:file,category:def.category,purpose:def.purpose,revision,roles:def.roles});seen.add(def.id);
  }
 }
 return available;
}
function suggestSkills(catalog,brief,roleId){
 const role=roleOf(roleId),text=typeof brief==='string'?brief.slice(0,12000):'';
 return catalog.map((skill,index)=>{
  const def=BY_ID.get(skill.id),hits=def?.terms[0].test(text)?1+def.terms.slice(1).filter(term=>term.test(text)).length:0;
  return {skill,index,hits};
 }).filter(({skill,hits})=>hits>0&&(role==='coordinator'||skillFitsRole(skill,role)))
  .sort((a,b)=>b.hits-a.hits||a.index-b.index).slice(0,2).map(item=>item.skill);
}
async function resolveSelectedSkills(client,projectPath,home,selected){
 if(selected===undefined)return [];
 if(!Array.isArray(selected)||selected.length>2)throw Error('Choose up to two reviewed skills.');
 const ids=new Set();for(const entry of selected){
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).some(key=>!['id','revision'].includes(key))||typeof entry.id!=='string'||typeof entry.revision!=='string'||!/^[a-f0-9]{64}$/.test(entry.revision))throw Error('Invalid skill selection.');
  if(ids.has(entry.id))throw Error('Duplicate skill selection.');ids.add(entry.id);
 }
 if(!selected.length)return [];
 const catalog=await catalogForProject(client,projectPath,home);
 return selected.map(entry=>{
  const skill=catalog.find(item=>item.id===entry.id);
  if(!skill)throw Error(`${entry.id} is unavailable in Codex for this project. Review the skill choices before launch.`);
  if(skill.revision!==entry.revision)throw Error(`${entry.id} changed after selection. Review and select it again before launch.`);
  return skill;
 });
}
function skillsForRole(skills,roleId){return skills.filter(skill=>skillFitsRole(skill,roleId));}
function skillInputs(skills){return skills.map(skill=>({type:'skill',name:skill.name,path:skill.path}));}
module.exports={REVIEWED,catalogForProject,suggestSkills,resolveSelectedSkills,skillsForRole,skillInputs,roleOf,skillFitsRole};
