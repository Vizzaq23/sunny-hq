class MissionBranch {
 constructor(evidence){this.evidence=evidence;}
 async plan(root,missionId){
  if(typeof missionId!=='string'||! /^[a-zA-Z0-9-]{1,80}$/.test(missionId))throw Error('Invalid mission branch identity.');
  const source=await this.evidence.gitState(root);if(source.dirty)throw Error('Commit or preserve your changes before preparing a mission branch. A clean checkout is required.');
  return {name:'codex/sunny-'+missionId,baseCommit:source.commit,baseBranch:source.branch,baseFingerprint:source.fingerprint,state:'preparing'};
 }
 async create(root,plan){
  const source=await this.evidence.gitState(root);if(source.fingerprint!==plan.baseFingerprint)throw Error('Project changed after branch preparation. No switch was made.');
  await this.evidence.command(root,['switch','--no-guess','-c',plan.name,plan.baseCommit]);
  const result=await this.inspect(root,plan);if(!result.ready)throw Error('Branch preparation could not be verified. Inspect the checkout before continuing.');return result;
 }
 async inspect(root,plan){const source=await this.evidence.gitState(root);return {ready:source.branch===plan.name&&source.commit===plan.baseCommit&&!source.dirty,source};}
 async validate(root,plan){const source=await this.evidence.gitState(root);if(plan.state!=='ready'||source.branch!==plan.name)throw Error('Return to the prepared mission branch before launching work.');await this.evidence.command(root,['merge-base','--is-ancestor',plan.baseCommit,'HEAD']);return source;}
}
module.exports={MissionBranch};
