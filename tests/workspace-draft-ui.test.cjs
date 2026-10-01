const {test}=require('node:test');const assert=require('node:assert/strict');
const {saveWorkspaceDraft,deleteWorkspaceDraft}=require('../src/useDraft.ts');
test('workspace draft writes use stored draft revision and exact clearing revision',async()=>{
 assert.equal(typeof saveWorkspaceDraft,'function');
 const draft={id:'brief:p',kind:'brief',projectId:'p',text:'unsent',revision:3,updatedAt:1};
 const state={version:1,revision:7,context:null,drafts:[draft],seenAcceptanceIds:[]};const calls=[];
 const invoke=async(action,args)=>{calls.push([action,args]);if(action==='workspace:get')return state;return {...state,revision:8,drafts:args.draft?[{...args.draft,revision:4}]:[]};};
 const result=await saveWorkspaceDraft(invoke,{...draft,text:'newer'});
 assert.equal(calls[1][1].expectedRevision,7);assert.equal(calls[1][1].draft.revision,3);assert.equal(result.drafts[0].text,'newer');
 await deleteWorkspaceDraft(invoke,draft.id,4);assert.deepEqual(calls[3][1].deleteDraft,{id:draft.id,expectedDraftRevision:4});
});
test('rejected workspace persistence never mutates supplied local draft or retries',async()=>{
 assert.equal(typeof saveWorkspaceDraft,'function');const draft={id:'message:t',kind:'message',projectId:'p',taskId:'t',text:'Keep me',revision:2,updatedAt:1};let writes=0;
 const invoke=async action=>{if(action==='workspace:get')return {revision:9};writes++;throw Error('stale revision');};
 await assert.rejects(saveWorkspaceDraft(invoke,draft),/stale revision/);assert.equal(draft.text,'Keep me');assert.equal(draft.revision,2);assert.equal(writes,1);
});
test('submitted draft matching includes revision, criteria and completion boundary',()=>{
 const {sameSubmittedDraft}=require('../src/useDraft.ts');assert.equal(typeof sameSubmittedDraft,'function');
 const draft={id:'brief:p',kind:'brief',projectId:'p',title:'Brief',text:'Goal',criteria:['Reviewed'],completionBoundary:'review',revision:4};
 assert.equal(sameSubmittedDraft(draft,{...draft}),true);
 for(const change of [{revision:5},{text:'New input'},{criteria:['New criterion']},{completionBoundary:'merge'}])assert.equal(sameSubmittedDraft({...draft,...change},draft),false);
});
