const {test}=require('node:test');const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const diagnostics=require('../desktop/diagnostics.cjs');
test('native hang lifecycle records one episode and monotonic recovery duration',()=>{
 const contents=new EventEmitter(),window=new EventEmitter(),records=[];let now=100;
 diagnostics.watchRenderer(contents,{window,surface:'hub',now:()=>now,record:(event,details)=>records.push({event,details}),onGone(){}});
 window.emit('responsive');window.emit('unresponsive');now=200;window.emit('unresponsive');now=275;window.emit('responsive');window.emit('responsive');
 assert.deepEqual(records,[{event:'renderer-unresponsive',details:{surface:'hub'}},{event:'renderer-responsive',details:{surface:'hub',durationMs:175}}]);
});
test('renderer exit and reload cannot attribute an old hang to a new renderer',async()=>{
 const contents=new EventEmitter(),window=new EventEmitter(),records=[];let now=100;
 diagnostics.watchRenderer(contents,{window,surface:'companion',now:()=>now,record:(event,details)=>records.push({event,details}),onGone(){}});
 window.emit('unresponsive');contents.emit('render-process-gone',{}, {reason:'crashed',exitCode:2});await Promise.resolve();window.emit('responsive');
 assert.equal(records.filter(r=>r.event==='renderer-responsive').length,0);
 window.emit('unresponsive');contents.emit('did-finish-load');window.emit('responsive');assert.equal(records.filter(r=>r.event==='renderer-responsive').length,0);
 window.emit('unresponsive');window.emit('closed');window.emit('responsive');assert.equal(records.filter(r=>r.event==='renderer-responsive').length,0);
 assert.equal(records.filter(r=>r.event==='renderer-unresponsive').length,3);
});
test('hang duration and surface are bounded and private properties excluded',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-hang-log-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 diagnostics.record(dir,'renderer-responsive',{surface:'companion',durationMs:1500,prompt:'SECRET',url:'SECRET'});
 const line=fs.readFileSync(path.join(dir,'startup.log'),'utf8');assert.match(line,/"durationMs":1500/);assert.doesNotMatch(line,/SECRET|prompt|url/);
 for(const value of [-1,Infinity,NaN,86400001,'1500'])assert.equal(diagnostics.safeDetails('renderer-responsive',{durationMs:value}).durationMs,undefined);
});
