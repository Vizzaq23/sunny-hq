const {test}=require('node:test'),assert=require('node:assert/strict');
const {publicCopiedOutcome}=require('../desktop/copied-outcome.cjs');
const passed=()=>({version:1,scope:'sqlite-database-and-imported-history',fullTree:false,archiveStatus:'present-verified',outcome:'passed',sourceUnchanged:true,databaseEqual:true,historyEqual:true,consumerEqual:true,cleanup:'observed-empty'});
test('public copied outcomes are fixed scalar projections and reject private fields or values',()=>{
 const original=passed(),result=publicCopiedOutcome(original);assert.deepEqual(result,original);assert.notEqual(result,original);assert.equal(Object.isFrozen(result),true);
 const secret='PRIVATE_SENTINEL C:\\private\\profile';
 for(const extra of ['path','nonce','hash','error','title','messages','receipt'])assert.throws(()=>publicCopiedOutcome({...passed(),[extra]:secret}),/^Error: INVALID_PUBLIC_COPIED_OUTCOME$/);
 for(const field of Object.keys(original))assert.throws(()=>publicCopiedOutcome({...passed(),[field]:secret}),/^Error: INVALID_PUBLIC_COPIED_OUTCOME$/);
});
test('passing outcome requires every preservation and cleanup proof, and never claims full-tree backup',()=>{
 for(const field of ['sourceUnchanged','databaseEqual','historyEqual','consumerEqual'])assert.throws(()=>publicCopiedOutcome({...passed(),[field]:false}));
 for(const change of [{archiveStatus:'absence-unproven'},{cleanup:'unconfirmed'},{fullTree:true},{outcome:'unknown'}])assert.throws(()=>publicCopiedOutcome({...passed(),...change}));
 const failure={...passed(),outcome:'absence-unproven',archiveStatus:'absence-unproven',sourceUnchanged:false,databaseEqual:false,historyEqual:false,consumerEqual:false,cleanup:'unconfirmed'};assert.deepEqual(publicCopiedOutcome(failure),failure);
});
test('only explicit v2 native-point-epoch absence can enter the fixed public scalar projection',()=>{
 const value={...passed(),version:2,archiveStatus:'absent-verified',absenceMethod:'native-point-epoch'};assert.deepEqual(publicCopiedOutcome(value),value);
 for(const change of [{version:1},{absenceMethod:'immutable'},{absenceMethod:undefined},{archiveStatus:'present-verified'},{path:'PRIVATE_ABSENCE_SENTINEL'},{receipt:{private:true}},{nonce:'PRIVATE_ABSENCE_SENTINEL'},{sourceUnchanged:false},{databaseEqual:false},{historyEqual:false},{consumerEqual:false},{cleanup:'unconfirmed'}])assert.throws(()=>publicCopiedOutcome({...value,...change}),/^Error: INVALID_PUBLIC_COPIED_OUTCOME$/);
 const missing={...value};delete missing.absenceMethod;assert.throws(()=>publicCopiedOutcome(missing));assert.throws(()=>publicCopiedOutcome({...passed(),archiveStatus:'absent-verified'}));
});
