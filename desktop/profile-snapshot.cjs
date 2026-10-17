const sealed=new WeakSet(),MAX_PATCH_BYTES=1024*1024;
const object=value=>value!==null&&typeof value==='object';
const own=(value,key)=>Object.hasOwn(value,key);
function scalar(value){if(['function','symbol','bigint'].includes(typeof value))throw Error('Unsupported profile value');return value;}
function keys(value){const proto=Object.getPrototypeOf(value);if(!Array.isArray(value)&&proto!==Object.prototype&&proto!==null)throw Error('Unsupported profile object');const result=Object.keys(value);for(const key of result){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!own(d,'value'))throw Error('Profile accessors are not supported');}return result;}
function put(target,key,value){Object.defineProperty(target,key,{value,enumerable:true,writable:true,configurable:true});}
function captureProfile(value){
 if(!object(value))return scalar(value);
 const copies=new WeakMap(),active=new WeakSet(),root=Array.isArray(value)?new Array(value.length):{},stack=[{source:value,target:root,keys:keys(value),index:0}];copies.set(value,root);active.add(value);
 while(stack.length){const frame=stack.at(-1);if(frame.index===frame.keys.length){active.delete(frame.source);stack.pop();continue;}const key=frame.keys[frame.index++],child=frame.source[key];if(!object(child)){put(frame.target,key,scalar(child));continue;}if(active.has(child))throw Error('Cyclic profile');if(copies.has(child)){put(frame.target,key,copies.get(child));continue;}const childKeys=keys(child),target=Array.isArray(child)?new Array(child.length):{};put(frame.target,key,target);copies.set(child,target);active.add(child);stack.push({source:child,target,keys:childKeys,index:0});}
 return root;
}
function sealProfileSnapshot(value){
 if(!object(value))return scalar(value);if(sealed.has(value))return value;
 // Validate before freezing so a failed seal never publishes partially owned data.
 const active=new WeakSet(),visited=new WeakSet(),order=[],stack=[{value,exit:false}];
 while(stack.length){const frame=stack.pop(),item=frame.value;if(!object(item)){scalar(item);continue;}if(sealed.has(item))continue;if(frame.exit){active.delete(item);visited.add(item);order.push(item);continue;}if(active.has(item))throw Error('Cyclic profile');if(visited.has(item))continue;active.add(item);stack.push({value:item,exit:true});for(const key of keys(item))stack.push({value:item[key],exit:false});}
 for(const item of order){Object.freeze(item);sealed.add(item);}return value;
}
function isSealedProfile(value){return !object(value)||sealed.has(value);}
function generation(value){if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid profile generation');}
function diffProfile(base,next,{baseGeneration}){
 generation(baseGeneration);const ops=[],stack=[{base,next,path:[]}];let bytes=64;
 while(stack.length){const item=stack.pop(),a=item.base,b=item.next;if(Object.is(a,b))continue;
 const aObject=object(a),bObject=object(b);let replace=!aObject||!bObject||Array.isArray(a)!==Array.isArray(b);
 let ak,bk;if(!replace){ak=keys(a);bk=keys(b);replace=(Array.isArray(a)&&a.length!==b.length)||ak.length!==bk.length||ak.some((key,i)=>key!==bk[i]);}
 if(replace){const value=captureProfile(b),op={op:'set',path:item.path,value};bytes+=Buffer.byteLength(JSON.stringify(op));if(bytes>MAX_PATCH_BYTES)return {kind:'full',baseGeneration,image:captureProfile(next)};ops.push(op);continue;}
 for(let i=bk.length-1;i>=0;i--){const key=bk[i];stack.push({base:a[key],next:b[key],path:[...item.path,Array.isArray(b)&&/^(0|[1-9]\d*)$/.test(key)?Number(key):key]});}
 }
 return {kind:'patch',baseGeneration,ops};
}
function exact(value,allowed){if(!object(value)||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw Error('Invalid profile update');}
function applyProfileUpdate(base,update,{generation:currentGeneration}){
 generation(currentGeneration);exact(update,update?.kind==='full'?['kind','baseGeneration','image']:['kind','baseGeneration','ops']);generation(update.baseGeneration);if(update.baseGeneration!==currentGeneration)throw Error('Stale profile generation');
 if(update.kind==='full'){if(!own(update,'image'))throw Error('Missing profile image');return sealProfileSnapshot(captureProfile(update.image));}
 if(update.kind!=='patch'||!Array.isArray(update.ops)||Buffer.byteLength(JSON.stringify(update))>MAX_PATCH_BYTES)throw Error('Invalid profile patch');
 let candidate=base;
 for(const op of update.ops){exact(op,['op','path','value']);if(!['set','delete'].includes(op.op)||!Array.isArray(op.path)||op.op==='set'&&!own(op,'value')||op.op==='delete'&&own(op,'value'))throw Error('Invalid patch operation');
 const value=op.op==='set'?captureProfile(op.value):undefined;
 if(!op.path.length){if(op.op!=='set')throw Error('Cannot delete profile root');candidate=value;continue;}
 const parents=[];let current=candidate;
 for(let i=0;i<op.path.length;i++){const key=op.path[i];if(!object(current)||!(typeof key==='string'||Number.isSafeInteger(key)&&key>=0))throw Error('Invalid patch path');if(Array.isArray(current)&&(!Number.isSafeInteger(key)||key<0||key>=current.length||op.op==='delete'&&i===op.path.length-1))throw Error('Invalid array patch');if(i<op.path.length-1&&!own(current,key))throw Error('Inherited or missing patch path');parents.push({current,key});current=own(current,key)?current[key]:undefined;}
 let changed=value;for(let i=parents.length-1;i>=0;i--){const {current,key}=parents[i],copy=Array.isArray(current)?current.slice():Object.fromEntries(Object.entries(current));if(i===parents.length-1&&op.op==='delete')delete copy[key];else put(copy,key,changed);changed=copy;}candidate=changed;
 }
 return sealProfileSnapshot(candidate);
}
module.exports={captureProfile,sealProfileSnapshot,isSealedProfile,diffProfile,applyProfileUpdate,MAX_PATCH_BYTES};
