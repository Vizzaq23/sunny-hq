const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {record}=require('../desktop/diagnostics.cjs');

test('renderer exit diagnostics retain the OS reason and code but discard private details',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-exit-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 record(dir,'renderer-gone',{reason:'oom',exitCode:-536870904,url:'private-file',message:'private-prompt'});
 const log=fs.readFileSync(path.join(dir,'startup.log'),'utf8');
 assert.match(log,/renderer-gone \{"reason":"oom","exitCode":-536870904\}/);
 assert.doesNotMatch(log,/private|url|message/);
});

test('diagnostics cannot inject arbitrary reasons, codes or detail on unrelated events',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-exit-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 record(dir,'renderer-gone',{reason:'secret\nforged-event',exitCode:'secret'});
 record(dir,'starting',{reason:'crashed',exitCode:1,message:'secret'});
 const log=fs.readFileSync(path.join(dir,'startup.log'),'utf8');
 assert.match(log,/renderer-gone \{"reason":"unknown"\}/);
 assert.match(log,/starting\n$/);
 assert.doesNotMatch(log,/secret|forged|crashed/);
});
