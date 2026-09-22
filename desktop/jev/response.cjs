'use strict';
const {plain}=require('./request.cjs');
const invalid=()=>{const e=new Error('INVALID_RESPONSE');e.code='INVALID_RESPONSE';throw e;};
const probability=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1;
function exact(v,keys){return plain(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));}
function validateResponse(json,mapping){
 if(!plain(json)||typeof json.model!=='string'||!/^jev-[a-zA-Z0-9.-]{1,60}$/.test(json.model)||!exact(json.answers,Object.keys(mapping.questions)))invalid();
 const relevance=Object.create(null),choices=Object.create(null);
 for(const [key,definition] of Object.entries(mapping.questions)){
  const a=json.answers[key];if(!plain(a)||a.type!==definition.type)invalid();
  if(a.type==='noul'){if(!probability(a.noul))invalid();relevance[definition.id]=a.noul;}
  else{
   if(!exact(a.probabilities,definition.options)||!definition.options.includes(a.choice)||!probability(a.confidence))invalid();
   const values=Object.values(a.probabilities);
   if(!values.every(probability)||Math.abs(values.reduce((x,y)=>x+y,0)-1)>.001)invalid();
   choices[key]={choice:a.choice,confidence:a.confidence,probabilities:{...a.probabilities}};
  }
 }
 let usage;
 if(json.usage!==undefined){if(!plain(json.usage))invalid();usage={};for(const k of ['input_tokens','output_tokens'])if(json.usage[k]!=null){if(!Number.isSafeInteger(json.usage[k])||json.usage[k]<0)invalid();usage[k]=json.usage[k];}}
 return {relevance,choices,roles:mapping.roles,models:mapping.models,model:json.model,usage};
}
module.exports={validateResponse};
