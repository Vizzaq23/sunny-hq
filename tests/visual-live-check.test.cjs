const {test}=require('node:test');const assert=require('node:assert/strict');
test('visual live check refuses provider activity without explicit opt-in',async()=>{
 const before=process.env.SUNNY_RUN_LIVE_VISUAL;delete process.env.SUNNY_RUN_LIVE_VISUAL;
 try{await assert.rejects(require('../desktop/visual-live-check.cjs').main(),/SUNNY_RUN_LIVE_VISUAL=1/);}finally{if(before===undefined)delete process.env.SUNNY_RUN_LIVE_VISUAL;else process.env.SUNNY_RUN_LIVE_VISUAL=before;}
});
