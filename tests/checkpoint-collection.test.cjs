const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup}=require('./helpers/checkpoint-journey.cjs');
for(const mode of ['dirty','unknown-effect'])test('checkpoint collection fences '+mode+' before any integration effect',{timeout:180000},async t=>{
 const f=await setup(t);await f.finish({dirty:mode==='dirty'});let effects=0;const integrate=f.hub.integration().execute.bind(f.hub.integration());f.hub.integration().execute=(...args)=>{effects++;return integrate(...args);};
 if(mode==='unknown-effect')f.hub.integration().commands.set('unresolved-owned-check',{id:'unresolved-owned-check',runId:f.hub.state.runs[0].id,workspaceId:f.hub.state.runs[0].workspaces.find(w=>w.integration).id,kind:'check',state:'unknown',exited:false}); // Negative lost-controller/receipt relationship: no external child is fabricated.
 const out=await f.deliver();assert.equal(effects,0,'collection must finish before serial integration begins');assert.equal(out.code,mode==='dirty'?'CHECKPOINT_PREDECESSOR_CHANGED':'OUTCOME_UNKNOWN');await f.until(()=>f.hub.state.runs[0].deliveries[0].stage===(mode==='dirty'?'blocked':'unknown'));assert.equal(f.hub.state.runs[0].deliveries[0].reasonCode,mode==='dirty'?'CHECKPOINT_PREDECESSOR_CHANGED':'CHECKPOINT_NOT_QUIESCENT');f.noSuccessors();assert.equal(f.hub.state.runs[0].combinedChecks?.length||0,0);
});
