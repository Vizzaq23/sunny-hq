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
