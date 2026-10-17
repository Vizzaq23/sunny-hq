const {createHash}=require('node:crypto');
const {isSealedProfile}=require('./profile-snapshot.cjs');
const MAX=64*1024,PACK=64*1024,digestPrefixes=new WeakMap();
function encodeProfile(value,previous){
 if(value===undefined||['function','symbol','bigint'].includes(typeof value))throw Error('Unsupported JSON root');
 if(!isSealedProfile(value))throw Error('Profile must be sealed before encoding');
 const packCache=new Map(),cache=previous?.cache||new WeakMap(),pool=new Map(previous?.fragments.map(f=>[f.id,f])||[]);
 function fragment(bytes){const id=createHash('sha256').update(bytes).digest('hex'),existing=pool.get(id);if(existing){if(!existing.bytes.equals(bytes))throw Error('Fragment hash collision');return existing;}const result={id,bytes};pool.set(id,result);return result;}
 function text(text){const bytes=Buffer.from(text),out=[];for(let start=0;start<bytes.length;){let end=Math.min(start+MAX,bytes.length);if(end<bytes.length)while((bytes[end]&0xc0)===0x80)end--;out.push(fragment(bytes.subarray(start,end)));start=end;}return out;}
 function pack(parts){const out=[],pending=[];let length=0;const flush=()=>{if(length){if(pending.length===1)out.push(pending[0]);else{const key=pending.map(f=>f.id).join(':'),cached=previous?.packCache?.get(key)||packCache.get(key),f=cached||fragment(Buffer.concat(pending.map(p=>p.bytes),length));out.push(f);packCache.set(key,f);}pending.length=0;length=0;}};for(const part of parts){if(part.bytes.length>=PACK){flush();out.push(part);continue;}if(length+part.bytes.length>PACK)flush();pending.push(part);length+=part.bytes.length;}flush();return out;}
 function scalar(value,inArray){if(value===undefined)return inArray?text('null'):[];const serialized=JSON.stringify(value);if(serialized===undefined)throw Error('Unsupported JSON scalar');return text(serialized);}
 const object=v=>v!==null&&typeof v==='object';
 let result;if(!object(value))result=scalar(value,false);else{
  const stack=[{value,exit:false}];
  while(stack.length){const frame=stack.pop(),node=frame.value;if(cache.has(node))continue;if(!isSealedProfile(node))throw Error('Unsealed JSON subtree');
   if(!frame.exit){stack.push({value:node,exit:true});for(const key of Object.keys(node)){const child=node[key];if(object(child)&&!cache.has(child))stack.push({value:child,exit:false});}continue;}
   const array=Array.isArray(node),parts=text(array?'[':'{'),entries=array?Array.from({length:node.length},(_,i)=>i):Object.keys(node).filter(key=>node[key]!==undefined);let first=true;
   for(const key of entries){if(!first)parts.push(...text(','));first=false;if(!array)parts.push(...text(JSON.stringify(key)+':'));const child=node[key];parts.push(...(object(child)?cache.get(child):scalar(child,array)));}parts.push(...text(array?']':'}'));cache.set(node,pack(parts));
  }
  result=cache.get(value);
 }
 // Only private states from an earlier encoding can authorize prefix reuse.
 const prior=digestPrefixes.get(previous);let prefix=0;while(prior&&prefix<result.length&&prefix<prior.ids.length&&result[prefix].id===prior.ids[prefix])prefix++;
 const hash=prefix?prior.states[prefix-1].copy():createHash('sha256'),unique=new Map(),states=prior?prior.states.slice(0,prefix):[];let byteLength=0;
 for(let i=0;i<result.length;i++){const f=result[i];if(i>=prefix){hash.update(f.bytes);states.push(hash.copy());}byteLength+=f.bytes.length;unique.set(f.id,f);}
 const encoding={fragments:[...unique.values()],layout:result.map(f=>f.id),stateSha256:hash.digest('hex'),byteLength,cache,packCache};digestPrefixes.set(encoding,{ids:[...encoding.layout],states});return encoding;
}
module.exports={encodeProfile};
