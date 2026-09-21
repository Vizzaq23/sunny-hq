const {execFile}=require('node:child_process');const {promisify}=require('node:util');const run=promisify(execFile);
const fields='number,url,state,headRefOid,headRefName,baseRefName,isDraft,reviewDecision,mergedAt,statusCheckRollup';
function checkStatus(checks){
 if(!Array.isArray(checks)||!checks.length)return 'unavailable';
 const states=checks.map(c=>c.__typename==='CheckRun'?(c.status!=='COMPLETED'?'pending':c.conclusion==='SUCCESS'?'passed':['NEUTRAL','SKIPPED'].includes(c.conclusion)?'unavailable':'failed'):c.__typename==='StatusContext'?(c.state==='SUCCESS'?'passed':c.state==='PENDING'?'pending':'failed'):'unavailable');
 return states.includes('failed')?'failed':states.includes('unavailable')?'unavailable':states.includes('pending')?'pending':'passed';
}
class PullRequestEvidence {
 constructor({evidence,gh='gh',read}={}){this.evidence=evidence;this.read=read|| (async(args,root)=>JSON.parse((await run(gh,args,{cwd:root,windowsHide:true,timeout:30000,maxBuffer:2*1024*1024,encoding:'utf8',env:{...process.env,GH_PROMPT_DISABLED:'1'}})).stdout));}
 async inspect(root,number){
  if(!Number.isSafeInteger(number)||number<1)throw Error('Enter a positive pull-request number.');
  const before=await this.evidence.gitState(root);if(before.dirty)throw Error('Commit local changes before matching a pull request to this source.');
  const origin=(await this.evidence.command(root,['remote','get-url','origin'])).trim();
  const match=/^(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(origin);
  if(!match)throw Error('PR evidence currently requires a github.com origin remote.');
  const repository=match[1]+'/'+match[2];
  const pr=await this.read(['pr','view',String(number),'--repo','github.com/'+repository,'--json',fields],root);
  if(pr.number!==number||pr.url!==`https://github.com/${repository}/pull/${number}`||!['OPEN','CLOSED','MERGED'].includes(pr.state))throw Error('Pull-request identity could not be verified.');
  if(pr.headRefOid!==before.commit||pr.headRefName!==before.branch)throw Error('Pull-request source does not match the current branch and HEAD.');
  const after=await this.evidence.gitState(root);if(after.fingerprint!==before.fingerprint)throw Error('Source changed while reading pull-request evidence.');
  return {kind:'pull-request',repository,number,url:pr.url,state:pr.state,commit:before.commit,branch:before.branch,fingerprint:before.fingerprint,baseBranch:pr.baseRefName,isDraft:pr.isDraft===true,reviewDecision:pr.reviewDecision||'UNAVAILABLE',mergedAt:pr.mergedAt||null,checkStatus:checkStatus(pr.statusCheckRollup),recordedAt:Date.now()};
 }
}
module.exports={PullRequestEvidence};
