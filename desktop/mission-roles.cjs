const ROLE_BINDINGS=Object.freeze([
 ['coordinator','Coordinator','luffy','coordination'],['planner','Planner','nami','planning'],['builder','Builder','franky','implementation'],['reviewer','Reviewer','zoro','review'],['validator','Validator','usopp','verification'],['researcher','Researcher','robin','research'],['designer','Visual designer','sanji','design'],['diagnostician','Diagnostician','chopper','diagnosis'],['creator','Creative worker','brook','creative'],['operator','Operator','jinbe','operations']
].map(([id,label,crewId,capability])=>Object.freeze({id,label,crewId,capability,provider:'codex'})));
function resolveMissionRole(input,bindings=ROLE_BINDINGS){
 const binding=input.roleId?bindings.find(r=>r.id===input.roleId):bindings.find(r=>r.crewId===input.crewId);
 if(!binding)throw Error('Choose an available mission role.');
 if(input.crewId&&input.crewId!==binding.crewId)throw Error('Crew choice conflicts with the selected role.');
 if(binding.provider!=='codex')throw Error('The configured role provider is unavailable. No substitute worker was started.');
 return {roleId:binding.id,crewId:binding.crewId,capability:binding.capability,provider:binding.provider,source:'explicit-selection',policyVersion:1,externalAuthority:'captain-required',reason:`Captain selected ${binding.label}; use its ${binding.capability} capability through the configured ${binding.provider} adapter.`};
}
function missionContext(mission,route){
 const coordination=route.roleId==='coordinator'?'Use sunny_delegate for four required sequential stages: plan with Nami; work with the appropriate implementation/design/research/creative specialist; validate with Usopp; review with Zoro. Wait for each actual result before the next stage. A missing stage or empty result prevents review readiness. Include acceptance criteria in each assignment. Return actual task IDs, changed files, checks and remaining blockers. Do not treat your plan or a finished worker turn as verified acceptance.':'Perform only the selected role’s work. Report the next required role rather than claiming to have completed work outside this assignment.';
 return `Sunny mission ${mission.id}, project ${mission.projectId}.\n${mission.branch?`Work on the prepared branch ${mission.branch.name}. Do not switch branches or merge it without captain approval.\n`:""}Assigned role: ${route.roleId}. Capability: ${route.capability}.\n${coordination}\n\nObjective:\n${mission.objective}\n\nAcceptance criteria:\n${mission.acceptanceCriteria.map((c,i)=>`${i+1}. ${c}`).join('\n')}\n\nReport evidence for each criterion. A coding turn ending does not complete the mission. Consequential external actions need captain approval.`;
}
module.exports={ROLE_BINDINGS,resolveMissionRole,missionContext};
