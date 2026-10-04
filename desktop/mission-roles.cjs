const registry=require('./crew-registry.cjs');
const ROLE_BINDINGS=Object.freeze(registry.CREW_ROLES.map(role=>Object.freeze({...role,capability:role.capabilities[0],provider:'codex'})));
function resolveMissionRole(input,bindings=ROLE_BINDINGS,world){
 const binding=input.roleId?bindings.find(r=>r.id===input.roleId):bindings.find(r=>r.crewId===input.crewId);
 if(!binding)throw Error('Choose an available mission role.');
 if(input.crewId&&input.crewId!==binding.crewId)throw Error('Crew choice conflicts with the selected role.');
 if(binding.provider!=='codex')throw Error('The configured role provider is unavailable. No substitute worker was started.');
 const resolved=registry.assertWorkerBinding(registry.crewBinding(binding.crewId,world));
 return {...resolved,capability:binding.capability,provider:binding.provider,source:'explicit-selection',policyVersion:1,externalAuthority:'captain-required',reason:`Captain selected ${binding.label}; use its ${binding.capability} capability through the configured ${binding.provider} adapter.`};
}
function missionContext(mission,route){
 const attempt=mission.attempts?.find(value=>value.id===mission.activeAttemptId),rework=attempt?.requestedChanges===undefined?'':`\n\nCaptain requested changes for this attempt (bounded rework; the objective and acceptance criteria still apply):\n${attempt.requestedChanges}`;
 const supervised=mission.runId?'Supervised workflow-v2: use only main-bound assignments. Independent review requires sunny_review in a fresh assigned reviewer session; prose cannot grant readiness or acceptance.':'';
 const coordination=route.roleId==='coordinator'?'Use sunny_delegate for four required sequential stages: plan with Nami; work with the appropriate implementation/design/research/creative specialist; validate with Usopp; review with Zoro. Wait for each actual result before the next stage. A missing stage or empty result prevents review readiness. Include acceptance criteria in each assignment. Return actual task IDs, changed files, checks and remaining blockers. Do not treat your plan or a finished worker turn as verified acceptance.':'Perform only the selected role’s work. Report the next required role rather than claiming to have completed work outside this assignment.';
 return `Sunny mission ${mission.id}, project ${mission.projectId}.\n${mission.branch?`Work on the prepared branch ${mission.branch.name}. Do not switch branches or merge it without captain approval.\n`:""}Assigned role: ${route.roleId}. Capability: ${route.capability}.\n${supervised||coordination}\n\nObjective:\n${mission.objective}\n\nAcceptance criteria:\n${mission.acceptanceCriteria.map((c,i)=>`${i+1}. ${c}`).join('\n')}${rework}\n\nReport evidence for each criterion. A coding turn ending does not complete the mission. Consequential external actions need captain approval.`;
}
module.exports={ROLE_BINDINGS,resolveMissionRole,missionContext};
