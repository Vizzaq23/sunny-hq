const fs=require('node:fs'),os=require('node:os'),path=require('node:path');const {randomUUID}=require('node:crypto');const {execFile}=require('node:child_process');const {promisify}=require('node:util');const exec=promisify(execFile);
class MissionPublisher{
 constructor({evidence,git='git',gh='gh',run}={}){this.evidence=evidence;this.git=git;this.gh=gh;this.run=run|| (async(exe,args,root)=>(await exec(exe,args,{cwd:root,windowsHide:true,timeout:60000,maxBuffer:2*1024*1024,encoding:'utf8',env:{...process.env,GH_PROMPT_DISABLED:'1',GIT_TERMINAL_PROMPT:'0'}})).stdout);}
 async repository(root){const raw=(await this.evidence.command(root,['remote','get-url','origin'])).trim();const match=/^(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(raw);if(!match)throw Error('A github.com origin repository is required.');return match[1]+'/'+match[2];}
 async prepare(root,mission,base){
  if(typeof base!=='string'||!base||base.length>200||base.startsWith('-')||/\s|\0/.test(base))throw Error('Choose a valid target branch.');
  await this.evidence.command(root,['check-ref-format','--branch',base]);
  const source=await this.evidence.gitState(root);if(!mission.branch||mission.branch.state!=='ready'||source.branch!==mission.branch.name||!source.branch.startsWith('codex/sunny-'))throw Error('Prepare and select this mission branch first.');
  if(source.dirty||base===source.branch)throw Error('Commit the changes and choose a different target branch before publishing.');
  const repository=await this.repository(root);
  const latestChecks=new Map();
  for(const artifact of mission.artifacts)if(artifact.attemptId===mission.activeAttemptId&&artifact.kind==='check')latestChecks.set(artifact.script,artifact);
  const checks=[...latestChecks.values()].map(a=>`- ${a.command}: ${a.status} (${a.commit?.slice(0,12)||'unknown commit'}; ${a.fingerprint===source.fingerprint?'matches preview source':'different source or unverified source; rerun required'})`).join('\n');
  const body=`## Objective and context

Linked issue: not supplied; captain must add an issue or explain its absence.

${mission.objective}

Affected subsystem and files touched: review the PR diff and complete before requesting review.

## Acceptance criteria

${mission.acceptanceCriteria.map(c=>'- [ ] '+c).join('\n')}

Criteria are not accepted by generating this draft.

## Review evidence

Latest recorded check per script for this attempt (append order, not clock order):
${checks||'No local check evidence recorded.'}

Tests/build/typecheck/lint not listed above have no recorded result for this attempt. Recorded success on a different source does not validate this preview. Remote CI is not verified by this draft.

- Screenshots/video for visual changes (normal, working, blocked, reduced motion): not attached; provide or explain why not applicable.
- Architecture impact and decision link: not assessed; complete before review.
- Security/IPC/permissions impact: not assessed; complete before review.
- Database migration/backup/compatibility impact: not assessed; complete before review.
- Risk level and rollback steps: not assessed; complete before review.
- Docs and affected contracts updated: not verified.
- Art bible and world bible compliance: not verified; check or explain why not applicable.

## Completion

- [ ] Relevant tests and build were run; failures are visible.
- [ ] Docs and affected contracts were updated.
- [ ] Art bible and world bible compliance checked or explained as not applicable.
- [ ] No secrets, private profiles, fake integrations or unrelated user work included.
- [ ] Provider turn completion is not presented as mission acceptance.
- [ ] Consequential external actions remain human-authorized.

Human merge approval is still required. CI passing does not authorize merge or deployment.

Mission: ${mission.id}
Attempt: ${mission.activeAttemptId}
Source commit: ${source.commit}`;
  return {id:randomUUID(),attemptId:mission.activeAttemptId,repository,branch:source.branch,base,title:mission.title,body,commit:source.commit,fingerprint:source.fingerprint,state:'prepared',createdAt:Date.now(),expiresAt:Date.now()+15*60*1000};
 }
 async revise(root,preview,title,body){
  if(typeof title!=='string'||!title.trim()||title.length>200||/[\r\n\0]/.test(title))throw Error('Invalid PR title. Use 1-200 characters on one line.');
  if(typeof body!=='string'||!body.trim()||body.length>100000||body.includes('\0'))throw Error('Invalid PR body. Use 1-100000 characters without null bytes.');
  if(preview.state!=='prepared')throw Error('Only a prepared PR preview can be edited.');
  await this.validate(root,preview);
  const {authorizedAt,...previous}=preview;
  return {...previous,id:randomUUID(),title,body,state:'prepared',createdAt:Date.now(),expiresAt:Date.now()+15*60*1000};
 }
 async validate(root,preview){const source=await this.evidence.gitState(root),repository=await this.repository(root);if(source.dirty||source.commit!==preview.commit||source.branch!==preview.branch||source.fingerprint!==preview.fingerprint||repository!==preview.repository)throw Error('Source or repository changed. Prepare and review a new PR preview.');}
 async publish(root,preview){
  await this.validate(root,preview);
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-pr-')),bodyFile=path.join(folder,'body.md');
  try{
   fs.writeFileSync(bodyFile,preview.body,'utf8');
   await this.run(this.git,['push',`https://github.com/${preview.repository}.git`,`${preview.commit}:refs/heads/${preview.branch}`],root);
   const url=(await this.run(this.gh,['pr','create','--repo','github.com/'+preview.repository,'--draft','--base',preview.base,'--head',preview.branch,'--title',preview.title,'--body-file',bodyFile],root)).trim();
   const prefix=`https://github.com/${preview.repository}/pull/`,number=Number(url.slice(prefix.length));if(!url.startsWith(prefix)||!Number.isSafeInteger(number)||number<1)throw Error('Publication response could not be verified.');return {url,number};
  }finally{fs.rmSync(bodyFile,{force:true});fs.rmdirSync(folder);}
 }
}
class MissionPublication{
 constructor(hub){this.hub=hub;}
 async act(input,mode){
  const hub=this.hub;hub.validateMissionAction(input,mode==='prepare'?['missionId','revision','base']:mode==='edit'?['missionId','revision','previewId','title','body']:mode==='publish'?['missionId','revision','previewId','confirmed']:['missionId','revision','prNumber']);
  const mission=hub.missionBook.get(input.missionId);hub.missionBook.check(mission,input.revision);if(mission.status!=='WAITING_FOR_REVIEW')throw Error('Finish the attempt before preparing a pull request.');
  if(hub.missionActions.has(mission.id))throw Error('Wait for the current mission action.');
  const project=hub.project(mission.projectId),lock='mission-publication:'+mission.id;
  hub.gate.acquire(lock,project.path);hub.missionActions.add(mission.id);
  try{
   if(mode==='prepare'){
    if(mission.prPublication&&mission.prPublication.state!=='prepared')throw Error('Reconcile the existing publication before preparing another.');
    const preview=await hub.publisher.prepare(project.path,mission,input.base);
    return hub.missionMutation(()=>{hub.missionBook.check(mission,input.revision);mission.prPublication=preview;hub.missionBook.record(mission,'PR_PREPARED',{previewId:preview.id});return preview;});
   }
   const preview=mission.prPublication;
   if(!preview||preview.attemptId!==mission.activeAttemptId)throw Error('Prepare a PR preview for this attempt first.');
   if(mode==='edit'){
    if(input.previewId!==preview.id||preview.state!=='prepared')throw Error('Edit the current prepared PR preview. Reconcile publication before changing text.');
    const revised=await hub.publisher.revise(project.path,preview,input.title,input.body);if(hub.closed)throw Error('Sunny closed before the edited preview could be saved.');
    return hub.missionMutation(()=>{hub.missionBook.check(mission,input.revision);mission.prPublication=revised;hub.missionBook.record(mission,'PR_PREPARED',{previewId:revised.id,actor:'captain',reason:'edited-preview'});return revised;});
   }
   if(mode==='publish'){
    if(input.confirmed!==true||input.previewId!==preview.id||preview.state!=='prepared'||Date.now()>preview.expiresAt)throw Error('Review and confirm the current unexpired PR preview.');
    await hub.publisher.validate(project.path,preview);if(hub.closed)throw Error('Sunny closed before publication.');
    hub.missionMutation(()=>{hub.missionBook.check(mission,input.revision);preview.state='publishing';preview.authorizedAt=Date.now();hub.missionBook.record(mission,'PR_PUBLISH_AUTHORIZED',{previewId:preview.id,actor:'captain'});});
    try{const result=await hub.publisher.publish(project.path,preview);return hub.missionMutation(()=>{preview.state='published';Object.assign(preview,result);hub.missionBook.record(mission,'PR_CREATED',{previewId:preview.id,url:result.url});return preview;});}
    catch(error){hub.missionMutation(()=>{preview.state='uncertain';hub.missionBook.record(mission,'PR_PUBLICATION_UNCERTAIN',{previewId:preview.id});});throw Error('Publication may have reached GitHub. Inspect the repository and reconcile the PR; Sunny will not retry automatically.');}
   }
   if(!Number.isSafeInteger(input.prNumber)||input.prNumber<1)throw Error('Enter the published PR number.');
   const evidence=await hub.pullRequests.inspect(project.path,input.prNumber);
   if(evidence.repository!==preview.repository||evidence.commit!==preview.commit||evidence.baseBranch!==preview.base)throw Error('That PR does not match the publication preview.');
   return hub.missionMutation(()=>{hub.missionBook.check(mission,input.revision);preview.state='published';preview.url=evidence.url;preview.number=evidence.number;mission.artifacts.push({...evidence,id:randomUUID(),attemptId:mission.activeAttemptId,projectId:project.id,producer:'sunny-local-verifier'});hub.missionBook.record(mission,'PR_RECONCILED',{previewId:preview.id,url:evidence.url});return preview;});
  }finally{hub.gate.release(lock);hub.missionActions.delete(mission.id);}
 }
}
module.exports={MissionPublisher,MissionPublication};
