'use strict';
const {buildRequest,validateInput}=require('./request.cjs');
const {validateResponse}=require('./response.cjs');
const {applyPolicy}=require('./policy.cjs');
const QUESTION_REVISION='jev-workflow-1';
const boundCodes=new Set(['REQUEST_TOO_LARGE','TOO_MANY_CANDIDATES','TOO_MANY_MODELS','TOO_MANY_ROLES','NO_QUESTIONS']);
async function decide(input,{apiKey=process.env.TYPESAFE_API_KEY,model='jev-1.13.0',signal,fetchImpl=fetch}={}){
 const started=performance.now();validateInput(input);
 const result=(status,reason,extra={})=>({status,reason,revision:input.revision,questionRevision:QUESTION_REVISION,elapsedMs:Math.round((performance.now()-started)*100)/100,selectedOptionalIds:input.candidates.filter(c=>!c.mandatory).map(c=>c.id),...extra});
 if(signal?.aborted)return result('cancelled','CANCELLED');
 let built;try{built=buildRequest(input,{model});}catch(e){if(boundCodes.has(e.code))return result('fallback',e.code);throw e;}
 if(typeof apiKey!=='string'||!apiKey.trim())return result('fallback','MISSING_KEY');
 const controller=new AbortController();let timedOut=false,reader;
 const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
 let rejectAbort;const aborted=new Promise((_,reject)=>{rejectAbort=reject;});
 const onAbort=()=>rejectAbort(Object.assign(new Error('ABORTED'),{code:'ABORTED'}));
 controller.signal.addEventListener('abort',onAbort,{once:true});
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},3000);
 try{
  if(signal?.aborted)controller.abort();
  const network=Promise.resolve().then(()=>fetchImpl('https://api.typesafe.ai/v1/systemone',{method:'POST',redirect:'error',signal:controller.signal,headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify(built.body)}));
  network.then(r=>{if(controller.signal.aborted)r.body?.cancel().catch(()=>{});},()=>{});
  const response=await Promise.race([network,aborted]);
  if(!response.ok){response.body?.cancel().catch(()=>{});return result('fallback','HTTP_'+response.status);}
  if(!response.body)return result('fallback','INVALID_RESPONSE');
  reader=response.body.getReader();const chunks=[];let bytes=0;
  while(true){
   const {done,value}=await Promise.race([reader.read(),aborted]);if(done)break;
   bytes+=value.byteLength;if(bytes>262144){const e=new Error('RESPONSE_TOO_LARGE');e.code='RESPONSE_TOO_LARGE';throw e;}chunks.push(Buffer.from(value));
  }
  let json;try{json=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{const e=new Error('INVALID_JSON');e.code='INVALID_JSON';throw e;}
  const answers=validateResponse(json,built.mapping);
  if(signal?.aborted)return result('cancelled','CANCELLED');
  return result('ok','EVALUATED',{...applyPolicy(input,answers),model:answers.model,...(answers.usage?{usage:answers.usage}:{})});
 }catch(e){
  if(signal?.aborted)return result('cancelled','CANCELLED');
  return result('fallback',timedOut?'TIMEOUT':['INVALID_JSON','INVALID_RESPONSE','RESPONSE_TOO_LARGE'].includes(e.code)?e.code:'NETWORK_ERROR');
 }finally{
  clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',onAbort);
  if(reader){reader.cancel().catch(()=>{});}
 }
}
module.exports={decide,QUESTION_REVISION};

