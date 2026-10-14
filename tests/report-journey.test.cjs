const {test}=require('node:test'),assert=require('node:assert/strict');
const {verifyReport}=require('../desktop/report-journey-live-check.cjs');
const facts={project:'Synthetic project',completed:'Ready',blocked:'Awaiting captain',next:'Mobile review'};
const report='# Synthetic project\nSource: facts.json\n## Completed\nReady\n## Blocked\nAwaiting captain\n## Next\nMobile review\n';
test('journey acceptance requires source facts, readable sections and a resolved review',()=>{
 assert.doesNotThrow(()=>verifyReport(report+'Follow-up: captain review remains required.\n',facts,{revised:true,recommendation:'Recommendation: accept'}));
 assert.throws(()=>verifyReport(report.trim()+' Follow-up: captain review remains required.',facts,{revised:true}),/own line/);
 assert.throws(()=>verifyReport(report,facts,{recommendation:'Recommendation: request changes'}),/did not recommend/);
 assert.throws(()=>verifyReport(report.replace('## Blocked','Blocked'),facts),/section/);
 assert.throws(()=>verifyReport(report.replace('Awaiting captain','Done'),facts),/Missing source fact/);
});
