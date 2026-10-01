const reasons=new Set(['workspace','dispatch','mission','check-intent','publication-intent','acceptance','reservation-release','cue','shutdown']);
const storageUncertain=error=>error?.code==='COMMIT_UNCERTAIN'||(error?.persistence===true&&error?.uncertain===true);
function receiptMatches(receipt){
 // OrderedStore validates prepared/committed SHA identity on its private channel.
 // Re-serializing the complete image here would put the worker's work back in main.
 return !!(receipt&&typeof receipt.epoch==='string'&&receipt.epoch.length>0&&Number.isSafeInteger(receipt.sequence)&&receipt.sequence>0&&Number.isFinite(receipt.durableAt)&&receipt.durableAt>0&&typeof receipt.stateSha256==='string'&&/^[a-f0-9]{64}$/.test(receipt.stateSha256));
}
class AuthorityCommitQueue{
 constructor({store,limit=16}){this.store=store;this.limit=limit;this.waiting=[];this.active=false;this.background=null;this.closed=false;this.uncertain=null;this.idle=[];this.receiptEpoch=null;this.receiptSequence=0;}
 run(reason,prepare){
  if(!reasons.has(reason)||typeof prepare!=='function')return Promise.reject(Error('Invalid authority persistence intent.'));
  if(this.closed)return Promise.reject(Error('Sunny authority queue is closed.'));
  if(this.uncertain)return Promise.reject(this.uncertain);
  if(this.active&&this.waiting.length>=this.limit)return Promise.reject(Object.assign(Error('Sunny is busy saving authority changes. Preserve the draft and retry after pending saves.'),{code:'AUTHORITY_SATURATED'}));
  return new Promise((resolve,reject)=>{this.waiting.push({reason,prepare,resolve,reject});this.drain();});
 }
 checkpoint(prepare){
  if(this.closed)return Promise.reject(Error('Sunny authority queue is closed.'));
  if(this.uncertain)return Promise.reject(this.uncertain);
  if(this.background)this.background.reject(Object.assign(Error('Background checkpoint superseded.'),{code:'CHECKPOINT_SUPERSEDED'}));
  return new Promise((resolve,reject)=>{this.background={reason:null,prepare,resolve,reject};this.drain();});
 }
 async drain(){
  if(this.active)return;const entry=this.waiting.shift()||this.background;if(!entry){for(const resolve of this.idle.splice(0))resolve();return;}if(entry===this.background)this.background=null;
  this.active=true;let prepared,receipt;
  try{
   if(this.uncertain)throw this.uncertain;
   prepared=await entry.prepare();await prepared.validate?.('before');
   if(prepared.skip){entry.resolve(await prepared.publish?.());return;}
   receipt=await (entry.reason===null?this.store.checkpoint(prepared.image):this.store.barrier(prepared.image,entry.reason));
   if(!receiptMatches(receipt)||this.receiptEpoch&&receipt.epoch!==this.receiptEpoch||receipt.sequence<=this.receiptSequence)throw Object.assign(Error('Storage receipt does not bind the submitted authority image.'),{code:'COMMIT_UNCERTAIN',uncertain:true});
   this.receiptEpoch=receipt.epoch;this.receiptSequence=receipt.sequence;
   try{await prepared.validate?.('after',receipt);}catch(error){if(prepared.compensate)await prepared.compensate(error,receipt);else throw Object.assign(error,{durable:true});throw error;}
   const result=await prepared.publish?.(receipt);entry.resolve(result===undefined?receipt:result);
  }catch(error){
   if(storageUncertain(error)){this.uncertain=error;for(const waiting of this.waiting.splice(0))waiting.reject(error);if(this.background){this.background.reject(error);this.background=null;}}
   try{prepared?.failed?.(error);}catch{/* Observers cannot replace the storage outcome. */}entry.reject(error);
  }finally{this.active=false;this.drain();}
 }
 async flush(){if(this.active||this.waiting.length||this.background)await new Promise(resolve=>this.idle.push(resolve));if(this.uncertain)throw this.uncertain;return this.store.flush?.();}
 stopAdmission(){this.closed=true;}
}
module.exports={AuthorityCommitQueue,receiptMatches,storageUncertain};
