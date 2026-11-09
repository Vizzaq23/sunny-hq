const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),{promisify}=require('node:util');
test('workspace identity reads make progress during a delayed Git reply and still reject metadata drift',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-verify-delay-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:5}));const root=path.join(dir,'original');fs.mkdirSync(root);const git=args=>cp.execFileSync('git',args,{cwd:root,windowsHide:true,encoding:'utf8'}).trim();
 git(['init']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);fs.writeFileSync(path.join(root,'base'),'base');git(['add','.']);git(['commit','-m','base']);const project={id:'p',path:root},modulePath=require.resolve('../desktop/execution-workspaces.cjs');
 const ref=await require(modulePath).createWorkspace({project,runId:'r',assignmentId:'a',baseCommit:git(['rev-parse','HEAD']),kind:'worker'},{storageRoot:path.join(dir,'managed'),persist:async()=>{}});
 const original=cp.execFile,real=promisify(original);let release,entered;const hold=new Promise(resolve=>release=resolve),first=new Promise(resolve=>entered=resolve),calls=[];
 function wrapped(){throw Error('Only async verification expected');}Object.defineProperty(wrapped,promisify.custom,{value:async(...args)=>{calls.push(args[1]);const firstCall=calls.length===1;const result=await real(...args);if(firstCall){entered();await hold;}return result;}});
 cp.execFile=wrapped;delete require.cache[modulePath];const verification=require(modulePath).verifyWorkspace(ref,project);verification.catch(()=>{});
 try{await Promise.race([first,verification.then(()=>{throw Error('Verification completed before the delayed reply');})]);assert.ok(calls.length>1,'independent ownership reads must not wait for the delayed first reply');const gitFile=path.join(ref.canonicalRoot,'.git'),bytes=fs.readFileSync(gitFile);fs.renameSync(gitFile,gitFile+'.retained');fs.writeFileSync(gitFile,bytes);release();await assert.rejects(verification,/identity|metadata|changed/i);}
 finally{release();await Promise.allSettled([verification]);cp.execFile=original;delete require.cache[modulePath];}
});

for(const target of ['managed','project'])test(target==='managed'?'managed common-directory pointer is rechecked after Git replies before returning ownership':'original project common-directory pointer is rechecked after Git replies',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-common-fence-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:5}));
 const root=path.join(dir,'original');fs.mkdirSync(root);const git=args=>cp.execFileSync('git',args,{cwd:root,windowsHide:true,encoding:'utf8'}).trim();
 git(['init']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);fs.writeFileSync(path.join(root,'base'),'base');git(['add','.']);git(['commit','-m','base']);
 const project={id:'p',path:root},modulePath=require.resolve('../desktop/execution-workspaces.cjs');
 const ref=await require(modulePath).createWorkspace({project,runId:'r',assignmentId:'a',baseCommit:git(['rev-parse','HEAD']),kind:'worker'},{storageRoot:path.join(dir,'managed'),persist:async()=>{}});
 const pointer=target==='project'?path.join(root,'.git','commondir'):path.join(fs.realpathSync(path.resolve(ref.canonicalRoot,fs.readFileSync(path.join(ref.canonicalRoot,'.git'),'utf8').trim().slice(8))),'commondir');
 const original=cp.execFile,real=promisify(original);let release,entered,completed=0,started=0;const hold=new Promise(resolve=>release=resolve),allReplies=new Promise(resolve=>entered=resolve);
 function wrapped(){throw Error('Only async verification expected');}Object.defineProperty(wrapped,promisify.custom,{value:async(...args)=>{started++;const result=await real(...args);if(++completed===started)entered();await hold;return result;}});
 cp.execFile=wrapped;delete require.cache[modulePath];const verification=require(modulePath).verifyWorkspace(ref,project);verification.catch(()=>{});
 try{await allReplies;fs.writeFileSync(pointer,root+'\n');release();await assert.rejects(verification,target==='project'?/changed|git|repository/i:/changed/);}
 finally{release();await Promise.allSettled([verification]);cp.execFile=original;delete require.cache[modulePath];}
});
