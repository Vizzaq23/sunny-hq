const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync,spawnSync}=require('node:child_process');
const {validationEnvironment}=require('../scripts/validate-windows.cjs');

test('validation expands short TEMP paths before real workspace and fixture admission',t=>{
 const dir=fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()),'sunny validation temporary directory-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100}));
 const alias=process.platform==='win32'?execFileSync('cmd.exe',['/d','/c',`for %I in ("${dir}") do @echo %~sI`],{encoding:'utf8',windowsHide:true,windowsVerbatimArguments:true}).trim():dir;
 const original={...process.env,Temp:alias,TMP:alias};
 const env=validationEnvironment(original,alias);
 assert.equal(env.TEMP,fs.realpathSync.native(dir));assert.equal(env.TMP,env.TEMP);
 assert.equal(Object.hasOwn(env,'Temp'),false);assert.equal(original.Temp,alias);
 delete env.NODE_TEST_CONTEXT; // Launch an independent test runner, not a child harness worker.
 const result=spawnSync(process.execPath,['--test','--test-reporter=tap','tests/execution-workspaces.test.cjs'],{cwd:path.resolve(__dirname,'..'),env,encoding:'utf8',windowsHide:true,timeout:90000});
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 assert.match(result.stdout,/# tests 4\b/);assert.match(result.stdout,/# pass 4\b/);
 // Admission still rejects actual junctions in the nested workspace regressions.
 const packaged=require('../desktop/packaged-acceptance.cjs'),root=env.TEMP;
 const profile=path.join(root,'profile'),output=path.join(root,'output');fs.mkdirSync(profile);fs.mkdirSync(output);
 const nonce='c'.repeat(64),manifest=path.join(root,'fixture.json');
 fs.writeFileSync(manifest,JSON.stringify({version:1,nonce,profileDir:profile,outputDir:output,scenario:'startup',phase:1,mib:1}));
 assert.equal(packaged.admitFixture({manifestPath:manifest,nonce,defaultProfile:path.join(root,'live'),env:{}}).profileDir,profile);
});

test('headless playable runtime permits relocated approved bytes but rejects changed bytes',t=>{
 const root=fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()),'sunny-runtime-pin-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100}));
 const executable=path.join(root,path.basename(process.execPath));fs.copyFileSync(process.execPath,executable);
 const modulePath=path.resolve(__dirname,'../desktop/playable-launches.cjs');
 const actual=JSON.parse(execFileSync(executable,['-e',`console.log(JSON.stringify(require(${JSON.stringify(modulePath)}).runtimeIdentity()))`],{encoding:'utf8',windowsHide:true,timeout:15000}));
 assert.equal(actual.executable,fs.realpathSync.native(executable));assert.equal(actual.version,'24.18.0');
 assert.equal(actual.sha256,require('../desktop/playable-launches.cjs').POLICY.sha256);
 fs.writeFileSync(executable,'not the approved executable');
 const rejected=spawnSync(process.execPath,['-e',`Object.defineProperty(process,'execPath',{value:${JSON.stringify(executable)}});require(${JSON.stringify(modulePath)}).runtimeIdentity()`],{encoding:'utf8',windowsHide:true,timeout:15000});
 assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/Approved Node executable bytes changed/);
});
