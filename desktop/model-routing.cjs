const policies={efficient:'Token saver: choose a lighter capable model for routine work and low reasoning for clear bounded tasks. Escalate only for concrete complexity, ambiguity, risk or a failed simpler approach. Keep briefs and returned results concise; avoid redundant assignments.',balanced:'Balanced: balance capability and effort. Prefer medium reasoning for normal implementation, lower for simple tasks and higher for complex investigation.',thorough:'Deep work: prioritize difficult-task quality. Choose stronger capabilities and high reasoning when the task warrants it; simple tasks still do not need maximum effort.'};
function selectExecution(models,choice={},policy='efficient'){
 const visible=models.filter(m=>!m.hidden),requested=choice.model;
 const model=requested?visible.find(m=>m.model===requested||m.id===requested):visible.find(m=>m.isDefault)||visible[0];
 if(requested&&!model)throw Error('Choose a model available in the current Codex catalog.');
 if(!model){if(choice.effort)throw Error('Reconnect to load the model catalog before choosing reasoning.');return {};}
 const supported=(model.supportedReasoningEfforts||[]).map(e=>e.reasoningEffort);
 if(choice.effort&&!supported.includes(choice.effort))throw Error(`${model.model||model.id} does not support ${choice.effort} reasoning. Supported: ${supported.join(', ')||'provider default only'}.`);
 const order=policy==='thorough'?['high','medium','low']:policy==='balanced'?['medium','low','high']:['low','minimal','none','medium','high'];
 const effort=choice.effort||order.find(e=>supported.includes(e))||(supported.includes(model.defaultReasoningEffort)?model.defaultReasoningEffort:supported[0]);
 return {model:model.model||model.id,...(effort?{effort}:{})};
}
function routingContext(models,policy='efficient'){
 const catalog=models.filter(m=>!m.hidden).map(m=>({model:m.model||m.id,description:m.description||m.displayName,supportedReasoning:(m.supportedReasoningEfforts||[]).map(e=>({effort:e.reasoningEffort,description:e.description})),defaultReasoning:m.defaultReasoningEffort}));
 return `Execution preference: ${policies[policy]||policies.efficient}\nFor every sunny_delegate call choose model, effort, and a short selectionReason based on the task and this live catalog. Use only listed model IDs and their supported reasoning. Respect any explicit user model/effort request; if unavailable explain the limitation. Higher reasoning is not automatically better. Do not promise prices, monetary savings, account quota savings or a mathematically optimal choice; the catalog does not provide prices or quota multipliers. This policy is a heuristic, not a hard token budget.\nAvailable models and supported reasoning (capability data):\n${JSON.stringify(catalog)}`;
}
module.exports={selectExecution,routingContext,policies};
