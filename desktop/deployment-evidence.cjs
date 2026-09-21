const {execFile}=require('node:child_process');const {promisify}=require('node:util');const run=promisify(execFile);
const states=new Set(['error','failure','inactive','pending','queued','in_progress','success']);
function validId(id){return Number.isSafeInteger(id)&&id>0;}
function timestamp(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)&&Number.isFinite(Date.parse(value));}
function label(value){return typeof value==='string'&&value.trim()&&value.length<=200&&!/[\x00-\x1f\x7f]/.test(value);}
class DeploymentEvidence{
 constructor({evidence,gh='gh',read}={}){this.evidence=evidence;this.read=read|| (async(args,root)=>JSON.parse((await run(gh,args,{cwd:root,windowsHide:true,timeout:10000,maxBuffer:1024*1024,encoding:'utf8',env:{...process.env,GH_PROMPT_DISABLED:'1'}})).stdout));}
 async request(endpoint,root){try{return await this.read(['api','--hostname','github.com','--method','GET','-H','Accept: application/vnd.github+json','-H','X-GitHub-Api-Version: 2026-03-10',endpoint],root);}catch{throw Error('GitHub deployment lookup failed. Check GitHub CLI sign-in and repository deployment-read access.');}}
 async inspect(root){
  const before=await this.evidence.gitState(root);
  if(!/^[a-f0-9]{40}$/i.test(before.commit))throw Error('Deployment inspection requires a committed Git HEAD.');
  const origin=(await this.evidence.command(root,['remote','get-url','origin'])).trim();const match=/^(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(origin);
  if(!match)throw Error('Deployment evidence requires a github.com origin remote.');
  const repository=match[1]+'/'+match[2],endpoint='repos/'+repository+'/deployments',base='https://api.github.com/repos/'+repository;
  const rows=await this.request(endpoint+'?sha='+before.commit+'&per_page=5&page=1',root);
  if(!Array.isArray(rows)||rows.length>5)throw Error('Invalid deployment response.');
  let limited=rows.length===5;const deployments=[],seen=new Set();
  for(const row of rows){
   if(!row||!validId(row.id)||seen.has(row.id)||row.sha!==before.commit||row.repository_url!==base||row.url!==base+'/deployments/'+row.id||row.statuses_url!==base+'/deployments/'+row.id+'/statuses'||!label(row.environment)||!timestamp(row.created_at))throw Error('Deployment identity or source could not be verified.');
   seen.add(row.id);const url=base+'/deployments/'+row.id;const statuses=await this.request(endpoint+'/'+row.id+'/statuses?per_page=100&page=1',root);
   if(!Array.isArray(statuses)||statuses.length>100)throw Error('Invalid deployment status response.');
   const ids=new Set();for(const s of statuses){if(!s||!validId(s.id)||ids.has(s.id)||s.deployment_url!==url||s.url!==url+'/statuses/'+s.id||!states.has(s.state)||!timestamp(s.created_at)||(s.environment!==undefined&&!label(s.environment)))throw Error('Deployment status identity could not be verified.');ids.add(s.id);}
   const latest=[...statuses].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id-a.id)[0];limited||=statuses.length===100;
   deployments.push({id:row.id,environment:latest?.environment??row.environment,state:latest?.state??'unavailable',createdAt:row.created_at,statusAt:latest?.created_at??null,statusId:latest?.id??null,url,production:row.production_environment===true});
  }
  const after=await this.evidence.gitState(root);const afterOrigin=(await this.evidence.command(root,['remote','get-url','origin'])).trim();
  if(after.fingerprint!==before.fingerprint||afterOrigin!==origin)throw Error('Source changed while reading deployment evidence.');
  return {kind:'deployment',repository,commit:before.commit,branch:before.branch,dirty:before.dirty===true,deployments,limited,recordedAt:Date.now()};
 }
}
module.exports={DeploymentEvidence};
