const {test}=require('node:test');const assert=require('node:assert/strict');
const {MissionPublisher}=require('../desktop/mission-publisher.cjs');
const source={branch:'codex/sunny-fixture',commit:'a'.repeat(40),fingerprint:'source',dirty:false};
const mission={id:'fixture',title:'Build inventory',objective:'Persist inventory',activeAttemptId:'attempt',acceptanceCriteria:['Reload items'],artifacts:[],branch:{name:source.branch,state:'ready'}};
function setup(){const calls=[];const evidence={gitState:async()=>({...source}),command:async(_root,args)=>args[0]==='remote'?'https://github.com/crew/sunny.git\n':''};const publisher=new MissionPublisher({evidence,run:async(exe,args)=>{calls.push({exe,args});return args[0]==='pr'?'https://github.com/crew/sunny/pull/7\n':'';}});return {publisher,calls,evidence};}
test('preview binds exact source and target without remote mutation',async()=>{const {publisher,calls}=setup();const preview=await publisher.prepare('fixture',mission,'main');assert.equal(preview.commit,source.commit);assert.equal(preview.base,'main');assert.match(preview.body,/Reload items/);assert.equal(calls.length,0);});
test('publish uses exact commit, canonical remote and draft body file',async()=>{const {publisher,calls}=setup();const preview=await publisher.prepare('fixture',mission,'main');const result=await publisher.publish('fixture',preview);assert.equal(result.number,7);assert.deepEqual(calls[0].args,['push','https://github.com/crew/sunny.git',source.commit+':refs/heads/'+source.branch]);assert.ok(calls[1].args.includes('--draft'));assert.ok(calls[1].args.includes('--body-file'));});
test('stale source or remote rejects before any publication',async()=>{const {publisher,calls,evidence}=setup();const preview=await publisher.prepare('fixture',mission,'main');evidence.gitState=async()=>({...source,fingerprint:'changed'});await assert.rejects(publisher.publish('fixture',preview),/changed/i);assert.equal(calls.length,0);});
test('unowned branches and unsafe target input cannot produce previews',async()=>{const {publisher}=setup();await assert.rejects(publisher.prepare('fixture',{...mission,branch:undefined},'main'),/mission branch/i);await assert.rejects(publisher.prepare('fixture',mission,'--delete'),/target/i);});
test('draft describes review gaps and source-bound latest checks without claiming completion',async()=>{
 const {publisher}=setup();
 const artifacts=[
  {kind:'check',attemptId:'old',script:'lint',command:'npm run lint',status:'passed'},
  {kind:'check',attemptId:'attempt',script:'test',command:'npm run test',status:'passed',fingerprint:'source',commit:source.commit,recordedAt:200},
  {kind:'check',attemptId:'attempt',script:'test',command:'npm run test',status:'failed',fingerprint:'source',commit:source.commit,recordedAt:100},
  {kind:'check',attemptId:'attempt',script:'build',command:'npm run build',status:'passed',fingerprint:'earlier',commit:source.commit}
 ];
 const {body}=await publisher.prepare('fixture',{...mission,artifacts},'main');
 assert.match(body,/npm run test: failed/);assert.doesNotMatch(body,/npm run test: passed|npm run lint/);
 assert.match(body,/npm run build: passed.*different source/);
 for(const field of ['Affected subsystem and files touched','Architecture impact','Security/IPC/permissions impact','Database migration','Risk level and rollback','Screenshots/video','Docs','Art bible and world bible'])assert.ok(body.includes(field),field);
 assert.match(body,/\[ \] Reload items/);assert.match(body,/Human merge approval is still required/);
});


test('revised preview preserves exact captain text and immutable source while renewing identity',async()=>{
 const {publisher,calls}=setup();const preview=await publisher.prepare('fixture',mission,'main');preview.authorizedAt=1;
 const title='  Captain `literal` $title  ',body='## Reviewed\r\nLiteral $(command), `ticks`, \\n and ${value}\n\n';
 const revised=await publisher.revise('fixture',preview,title,body);
 assert.equal(revised.title,title);assert.equal(revised.body,body);assert.notEqual(revised.id,preview.id);assert.equal(revised.authorizedAt,undefined);
 for(const key of ['repository','branch','base','commit','fingerprint','attemptId'])assert.equal(revised[key],preview[key]);assert.equal(calls.length,0);
});
test('preview text validation and stale source prevent revisions without external commands',async()=>{
 const {publisher,calls,evidence}=setup();const preview=await publisher.prepare('fixture',mission,'main');
 for(const [title,body] of [['','body'],['x'.repeat(201),'body'],['bad\ntitle','body'],['Title',''],['Title','x'.repeat(100001)],['Title','nul\0body'],[17,'body'],['Title',{}]])await assert.rejects(publisher.revise('fixture',preview,title,body),/invalid.*PR/i);
 evidence.gitState=async()=>({...source,commit:'b'.repeat(40)});await assert.rejects(publisher.revise('fixture',preview,'Title','Reviewed body'),/changed/i);assert.equal(calls.length,0);
});
test('publication passes edited multiline text literally through title argv and UTF-8 body file',async()=>{
 const fs=require('node:fs');const {publisher}=setup();const original=await publisher.prepare('fixture',mission,'main');
 const title='Captain $(literal) `title`',body='## Review\r\n$(literal) `ticks` \\n\n日本語 ⚓\n';const preview=await publisher.revise('fixture',original,title,body);let sawBody=false;
 publisher.run=async(_exe,args)=>{if(args[0]==='pr'){assert.equal(args[args.indexOf('--title')+1],title);assert.equal(fs.readFileSync(args[args.indexOf('--body-file')+1],'utf8'),body);sawBody=true;return 'https://github.com/crew/sunny/pull/7';}return '';};
 await publisher.publish('fixture',preview);assert.equal(sawBody,true);
});
test('generated invalid or oversized previews stay repairable but cannot publish directly',async()=>{
 const {publisher,calls}=setup();const generated=await publisher.prepare('fixture',{...mission,title:'Multiline\nmission title',objective:'x'.repeat(50000),acceptanceCriteria:Array(20).fill('y'.repeat(1000))},'main');
 assert.ok(generated.body.length>60000);assert.equal(generated.state,'prepared');await assert.rejects(publisher.publish('fixture',generated),/invalid.*PR/i);assert.equal(calls.length,0);
 const repaired=await publisher.revise('fixture',generated,'Single line title','Reviewed body');assert.notEqual(repaired.id,generated.id);await publisher.publish('fixture',repaired);assert.equal(calls.length,2);
});
test('PR description application cap is enforced before any remote operation',async()=>{
 const {publisher,calls}=setup();const preview=await publisher.prepare('fixture',mission,'main');
 await assert.rejects(publisher.revise('fixture',preview,'Title','x'.repeat(60001)),/invalid.*PR/i);
 await assert.rejects(publisher.publish('fixture',{...preview,body:'x'.repeat(60001)}),/invalid.*PR/i);assert.equal(calls.length,0);
 const boundary=await publisher.revise('fixture',preview,'Title','x'.repeat(60000));assert.equal(boundary.body.length,60000);
});
