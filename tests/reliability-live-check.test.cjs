const {test}=require('node:test');
const assert=require('node:assert/strict');
test('live reliability probe requires explicit opt-in before creating data or starting a worker',async()=>{
 const previous=process.env.SUNNY_RUN_LIVE_RECOVERY;delete process.env.SUNNY_RUN_LIVE_RECOVERY;
 try{await assert.rejects(require('../desktop/reliability-live-check.cjs').main(),/SUNNY_RUN_LIVE_RECOVERY=1/);}
 finally{if(previous!==undefined)process.env.SUNNY_RUN_LIVE_RECOVERY=previous;}
});
test('live report journey requires explicit opt-in',async()=>{
 const previous=process.env.SUNNY_RUN_LIVE_REPORT;delete process.env.SUNNY_RUN_LIVE_REPORT;
 try{await assert.rejects(require('../desktop/report-journey-live-check.cjs').main(),/SUNNY_RUN_LIVE_REPORT=1/);}
 finally{if(previous!==undefined)process.env.SUNNY_RUN_LIVE_REPORT=previous;}
});
