const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const core=require('../desktop/core.cjs');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('file access cannot escape project through parent traversal',t=>{const dir=fixture(t);assert.throws(()=>core.guardedPath(dir,'../private.txt'),/outside|escape/i);});
test('file access rejects sibling paths sharing project prefix',t=>{const dir=fixture(t);assert.throws(()=>core.guardedPath(dir,dir+'-other/file.txt'),/outside|escape/i);});
test('stale editor writes preserve newer on-disk content',t=>{const dir=fixture(t);fs.writeFileSync(path.join(dir,'a.txt'),'first');const initial=core.readText(dir,'a.txt');fs.writeFileSync(path.join(dir,'a.txt'),'external');assert.throws(()=>core.writeText(dir,'a.txt','mine',initial.hash),/changed/i);assert.equal(fs.readFileSync(path.join(dir,'a.txt'),'utf8'),'external');});
test('saving unchanged base produces new content and version',t=>{const dir=fixture(t);fs.writeFileSync(path.join(dir,'a.txt'),'first');const initial=core.readText(dir,'a.txt');const result=core.writeText(dir,'a.txt','next',initial.hash);assert.equal(result.text,'next');assert.notEqual(result.hash,initial.hash);});
test('queue rejects a second writer in the same checkout',()=>{const gate=new core.TaskGate(3);gate.acquire('one','C:/repo');assert.throws(()=>gate.acquire('two','C:/repo'),/already/i);gate.release('one');gate.acquire('two','C:/repo');});
test('queue rejects the fourth active run and frees interrupted slots',()=>{const gate=new core.TaskGate(3);for(let i=0;i<3;i++)gate.acquire('t'+i,'C:/repo'+i);assert.throws(()=>gate.acquire('four','C:/four'),/limit/i);gate.release('t1');gate.acquire('four','C:/four');});
test('provider idle does not falsely mark a task completed',()=>{assert.equal(core.deriveStatus({type:'idle'}),'idle');assert.equal(core.deriveStatus({type:'active',activeFlags:['waitingOnApproval']}),'waiting');assert.equal(core.deriveStatus({type:'notLoaded'}),'unknown');});
test('persisted tasks and settings survive reopen',t=>{const dir=fixture(t);const file=path.join(dir,'state.json');const a=new core.StateStore(file);a.save({tasks:[{id:'t1'}],settings:{reducedMotion:true}});a.close();const b=new core.StateStore(file);assert.equal(b.load().tasks[0].id,'t1');assert.equal(b.load().settings.reducedMotion,true);b.close();});
test('restricted project metadata cannot be edited via the normal editor',t=>{const dir=fixture(t);fs.mkdirSync(path.join(dir,'.git'));fs.writeFileSync(path.join(dir,'.git','config'),'protected');assert.throws(()=>core.writeText(dir,'.git/config','oops',core.readText(dir,'.git/config').hash),/protected/i);});
test('nested project roots cannot bypass active checkout protection',()=>{const gate=new core.TaskGate();gate.acquire('a','C:/repo');assert.throws(()=>gate.acquire('b','C:/repo/packages/app'),/already/);assert.equal(gate.blocked('C:/repo/packages/app'),true);assert.equal(gate.blocked('C:/other'),false);});
test('corrupt JSON is preserved while defaults recover',t=>{const dir=fixture(t);const file=path.join(dir,'state.json');fs.writeFileSync(file,'broken json');const store=new core.StateStore(file);assert.deepEqual(store.load(),{});assert.equal(fs.readFileSync(store.recovery,'utf8'),'broken json');});
