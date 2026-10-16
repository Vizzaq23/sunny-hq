const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
test('build source fingerprint changes with runtime inputs and excludes private/generated files',t=>{
 const script=path.join(__dirname,'../scripts/write-build-info.cjs');assert.ok(fs.existsSync(script),'build stamp generator exists');const {writeBuildInfo}=require(script);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-build-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'desktop'));fs.mkdirSync(path.join(root,'src'));fs.mkdirSync(path.join(root,'public'));
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'0.11.0'}));fs.writeFileSync(path.join(root,'desktop','main.cjs'),'runtime one');fs.writeFileSync(path.join(root,'src','main.ts'),'renderer one');fs.writeFileSync(path.join(root,'public','image.png'),'asset');
 const first=writeBuildInfo(root);assert.match(first.buildId,/^[a-f0-9]{64}$/);assert.equal(first.fingerprintKind,'source-inputs-sha256');assert.equal(first.appVersion,'0.11.0');assert.equal(first.sourceCommit,'unknown');assert.equal(first.sourceDirty,null);
 fs.writeFileSync(path.join(root,'.env'),'SECRET');fs.writeFileSync(path.join(root,'desktop','.env.json'),'SECRET');fs.writeFileSync(path.join(root,'dist','generated.json'),'ignored');fs.mkdirSync(path.join(root,'node_modules'));fs.writeFileSync(path.join(root,'node_modules','private.json'),'SECRET');
 assert.equal(writeBuildInfo(root).buildId,first.buildId);fs.writeFileSync(path.join(root,'src','main.ts'),'renderer two');assert.notEqual(writeBuildInfo(root).buildId,first.buildId);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'dist','build-info.json'),'utf8')),writeBuildInfo(root));
});
test('the authorized worktree build stamp retains its exact Git revision without global configuration',()=>{
 const root=path.resolve(__dirname,'..');const {execFileSync}=require('node:child_process');const expected=execFileSync('git',['-c','safe.directory='+root,'rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
 const previous=process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER;process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER='1';try{assert.equal(require('../scripts/write-build-info.cjs').writeBuildInfo(root).sourceCommit,expected);}finally{if(previous===undefined)delete process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER;else process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER=previous;}
});
