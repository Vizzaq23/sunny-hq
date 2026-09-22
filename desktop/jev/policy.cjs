'use strict';
function eligible(answer){return answer&&answer.confidence>=.80&&answer.probabilities[answer.choice]>=.80;}
function applyPolicy(input,answers){
 const selectedOptionalIds=input.candidates.map((item,index)=>({item,index,p:answers.relevance[item.id]}))
  .filter(({item,p})=>!item.mandatory&&p>.20).sort((a,b)=>b.p-a.p||a.index-b.index).map(({item})=>item.id);
 const role=answers.choices.role,execution=answers.choices.execution;
 return {selectedOptionalIds,
  roleSuggestion:!input.explicit.roleId&&eligible(role)&&Object.hasOwn(answers.roles,role.choice)?answers.roles[role.choice]:null,
  modelSuggestion:!input.explicit.modelId&&!input.explicit.effort&&eligible(execution)&&Object.hasOwn(answers.models,execution.choice)?answers.models[execution.choice]:null,
  probabilities:{relevance:answers.relevance,choices:answers.choices}};
}
module.exports={applyPolicy};

