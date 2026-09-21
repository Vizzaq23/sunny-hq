const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {execFileSync}=require('node:child_process');
const {MissionEvidence,executeCheck}=require('../desktop/mission-evidence.cjs');
function repo(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-evidence-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const git=(...args)=>execFileSync('git',args,{cwd:root,windowsHide:true,stdio:'pipe'});
 git('init');git('config','user.email','fixture@example.invalid');git('config','user.name','Sunny fixture');
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({scripts:{test:'node check.cjs',build:'node -e "process.exit(1)"'}}));
 fs.writeFileSync(path.join(root,'check.cjs'),'process.exit(0)');git('add','.');git('commit','-m','fixture');return {root,git};
}
test('Git evidence fingerprints actual dirty and untracked content',async t=>{
 const {root}=repo(t);const evidence=new MissionEvidence();const clean=await evidence.gitState(root);
 assert.equal(clean.dirty,false);assert.match(clean.commit,/^[a-f0-9]{40,64}$/);
 fs.writeFileSync(path.join(root,'notes.txt'),'one');const dirty=await evidence.gitState(root);
 assert.equal(dirty.dirty,true);assert.ok(dirty.paths.includes('notes.txt'));
 fs.writeFileSync(path.join(root,'notes.txt'),'two');const changed=await evidence.gitState(root);assert.notEqual(changed.fingerprint,dirty.fingerprint);
 fs.appendFileSync(path.join(root,'check.cjs'),'\n// changed');assert.notEqual((await evidence.gitState(root)).fingerprint,changed.fingerprint);
});
test('Git evidence refuses nested project roots',async t=>{
 const {root}=repo(t);fs.mkdirSync(path.join(root,'nested'));await assert.rejects(new MissionEvidence().gitState(path.join(root,'nested')),/repository root/i);
});

test('Git evidence identifies a Windows short-path repository without accepting its child', {skip:process.platform!=='win32'},async t=>{
 const {root}=repo(t);
 // This read-only shell expansion uses only the generated fixture path.
 assert.ok(!/["%\r\n]/.test(root));
 const short=execFileSync('cmd.exe',['/d','/c',`for %I in ("${root}") do @echo %~sI`],{encoding:'utf8',windowsHide:true,windowsVerbatimArguments:true}).trim();
 const evidence=new MissionEvidence();
 assert.equal((await evidence.gitState(short)).fingerprint,(await evidence.gitState(root)).fingerprint);
 fs.mkdirSync(path.join(short,'nested'));
 await assert.rejects(evidence.gitState(path.join(short,'nested')),/repository root/i);
});
test('check runner preserves exit status and refuses nonexistent scripts',async t=>{
 const {root}=repo(t);const evidence=new MissionEvidence();
 const pass=await evidence.runCheck(root,'test');assert.equal(pass.status,'passed');assert.equal(pass.exitCode,0);assert.equal(pass.command,'npm run test');
 const fail=await evidence.runCheck(root,'build');assert.equal(fail.status,'failed');assert.equal(fail.exitCode,1);
 await assert.rejects(evidence.runCheck(root,'lint'),/script.*unavailable/i);
 await assert.rejects(evidence.runCheck(root,'test;echo bad'),/supported check/i);
});
test('zero exit after source mutation is stale evidence, not passing evidence',async t=>{
 const {root}=repo(t);fs.writeFileSync(path.join(root,'check.cjs'),"require('fs').writeFileSync('changed.txt','changed during check')");
 const result=await new MissionEvidence().runCheck(root,'test');assert.equal(result.status,'stale');assert.equal(result.exitCode,0);assert.notEqual(result.beforeFingerprint,result.fingerprint);
});
test('index flags that hide changed source cannot produce verification evidence',async t=>{
 const {root,git}=repo(t);git('update-index','--assume-unchanged','check.cjs');fs.writeFileSync(path.join(root,'check.cjs'),'changed');
 await assert.rejects(new MissionEvidence().gitState(root),/index flag|assume|skip.worktree/i);
});
test('submodule work cannot be reduced to an unchanged pointer',async t=>{
 const {root,git}=repo(t);const commit=git('rev-parse','HEAD').toString().trim();git('update-index','--add','--cacheinfo','160000,'+commit+',nested');
 await assert.rejects(new MissionEvidence().gitState(root),/submodule/i);
});
test('timeout cleanup failure rejects even when the process never closes',async()=>{
 const {EventEmitter}=require('node:events');const child=new EventEmitter();child.pid=123;
 await assert.rejects(executeCheck('node','npm','test','unused',5,{spawn:()=>child,killTree:(_child,done)=>done(Error('denied'))}),error=>error.uncertain===true);
});
test('process exit during timeout still waits for cleanup result',async()=>{
 const {EventEmitter}=require('node:events');const child=new EventEmitter();child.pid=123;
 await assert.rejects(executeCheck('node','npm','test','unused',5,{spawn:()=>child,killTree:(_child,done)=>{child.emit('close',0,null);setTimeout(()=>done(Error('denied')),5);}}),error=>error.uncertain===true);
});

test('verified timeout cleanup reports failure and settles after process exit',async()=>{
 const {EventEmitter}=require('node:events');const child=new EventEmitter();child.pid=123;
 const result=await executeCheck('node','npm','test','unused',5,{spawn:()=>child,killTree:(_child,done)=>{done(null);setTimeout(()=>child.emit('close',null,'SIGKILL'),5);}});
 assert.equal(result.timedOut,true);assert.equal(result.exitCode,null);assert.equal(result.signal,'SIGKILL');
});

test('skip-worktree files cannot silently bypass source verification',async t=>{
 const {root,git}=repo(t);git('update-index','--skip-worktree','check.cjs');
 await assert.rejects(new MissionEvidence().gitState(root),/skip.worktree/i);
});
