const {test}=require('node:test');
const assert=require('node:assert/strict');
const {resolveWorkContext}=require('../src/workContext.ts');
const snapshot={projects:[{id:'p'}],tasks:[{id:'t',projectId:'p'}],missions:[{id:'m',projectId:'p',taskIds:['t'],activeAttemptId:'new',attempts:[{id:'old',taskIds:['t']},{id:'new',taskIds:[]}]}]};
const context={projectId:'p',missionId:'m',attemptId:'old',taskId:'t',surface:'workbench',returnTo:{view:'ship',projectId:'p',missionId:'m',taskId:'t'}};
test('settings_return_preserves_selected_attempt',()=>{const returned=resolveWorkContext(context,snapshot);assert.deepEqual(returned.context,context);assert.equal(returned.unavailable,undefined);});
test('missing_project_never_opens_first_project',()=>{const original={...context,projectId:'removed-project'};const returned=resolveWorkContext(original,snapshot);assert.equal(returned.context.projectId,'removed-project');assert.match(returned.unavailable,/unavailable/i);});
test('missing attempt and mismatched task stay unavailable',()=>{assert.match(resolveWorkContext({...context,attemptId:'missing'},snapshot).unavailable,/attempt/i);assert.match(resolveWorkContext({...context,attemptId:'new'},snapshot).unavailable,/task/i);});
test('ordinary_conversation_stays_conversation',()=>{const ordinary={projectId:'p',taskId:'t',surface:'workbench',returnTo:{view:'home'}};assert.deepEqual(resolveWorkContext(ordinary,snapshot),{context:ordinary});assert.deepEqual(resolveWorkContext(null,snapshot),{context:null});});
test('selected reply display requires exact main-held status and refuses unavailable or changed content',async()=>{
 const {resolveReplyDisplay}=require('../src/workContext.ts');assert.equal(typeof resolveReplyDisplay,'function');
 const text='Reviewed result',sha256=require('node:crypto').createHash('sha256').update(text).digest('hex'),ref={kind:'reply',taskId:'t',messageId:'reply',sha256};
 const status={available:true,ref,preview:text};
 assert.deepEqual(await resolveReplyDisplay(ref,status),{text});
 assert.match((await resolveReplyDisplay(ref,{...status,available:false,unavailable:'Selected reply unavailable: duplicate IDs'})).unavailable,/unavailable/i);
 assert.match((await resolveReplyDisplay(ref,{...status,ref:{...ref,sha256:'b'.repeat(64)}})).unavailable,/changed/i);
 assert.match((await resolveReplyDisplay(ref,undefined)).unavailable,/unavailable/i);
});

test('result status binding rejects stale epoch revision attempt result ref and producer revision',()=>{
 const {boundResultStatus,resultStatusKey}=require('../src/workContext.ts');assert.equal(typeof boundResultStatus,'function');
 const ref={kind:'reply',taskId:'t',messageId:'reply',sha256:'a'.repeat(64)},result={id:'r',attemptId:'a',producerTaskId:'t',ref},mission={id:'m',projectId:'p',revision:3,activeAttemptId:'a',selectedResult:result};
 const s={epoch:'e',tasks:[{id:'t',transcriptRevision:2}]};const status={epoch:'e',missionId:'m',revision:3,attemptId:'a',resultId:'r',producerTaskId:'t',ref,available:true,preview:'display'};
 s.resultStatuses={m:{key:resultStatusKey(s,mission),state:'ready',status}};assert.equal(boundResultStatus(s,mission).available,true);
 for(const change of [{epoch:'old'},{missionId:'other'},{revision:2},{attemptId:'old'},{resultId:'old'},{ref:{...ref,sha256:'b'.repeat(64)}}]){s.resultStatuses.m.status={...status,...change};assert.equal(boundResultStatus(s,mission),undefined);}
 s.resultStatuses.m.status=status;s.tasks[0].transcriptRevision=3;assert.equal(boundResultStatus(s,mission),undefined);
});

test('new Home conversation does not inherit another ordinary task return target',()=>{
 const {workspaceReturnTarget}=require('../src/workContext.ts');assert.equal(typeof workspaceReturnTarget,'function');
 const note={projectId:'p',taskId:'note',surface:'deck',returnTo:{view:'library',projectId:'p'}};
 assert.deepEqual(workspaceReturnTarget(note,{projectId:'p',taskId:'research'},'home',false),{view:'home',projectId:'p'});
 assert.deepEqual(workspaceReturnTarget(note,{projectId:'p',taskId:'note'},'home',false),{view:'home',projectId:'p'});
 assert.deepEqual(workspaceReturnTarget(note,{projectId:'p',taskId:'note'},'ship',true),note.returnTo);
 const mission={...note,missionId:'m',returnTo:{view:'missions',projectId:'p',missionId:'m'}};
 assert.deepEqual(workspaceReturnTarget(mission,{projectId:'p',missionId:'m',taskId:'other-stage'},'ship',true),mission.returnTo);
 assert.deepEqual(workspaceReturnTarget(note,{projectId:'p'},'home',false),{view:'home',projectId:'p'});
});

test('same mission opened from a visible new origin owns Back while embedded task switches retain their origin',()=>{
 const {workspaceReturnTarget}=require('../src/workContext.ts');
 const context={projectId:'p',runId:'r',missionId:'m',attemptId:'a',surface:'deck',returnTo:{view:'ship',projectId:'p',runId:'r',missionId:'m',attemptId:'a'}};
 const selection={projectId:'p',runId:'r',missionId:'m',attemptId:'a',taskId:'zoro'};
 for(const view of ['island','home','missions'])assert.deepEqual(workspaceReturnTarget(context,selection,view,false),{...context.returnTo,view},view+' must replace the old ship origin');
 const embedded={...context,surface:'workbench',returnTo:{...context.returnTo,view:'island'}};
 assert.deepEqual(workspaceReturnTarget(embedded,{...selection,taskId:'nami'},'ship',true),embedded.returnTo,'an in-workbench task switch must still return to the original island');
});
