const {test}=require('node:test');
const assert=require('node:assert/strict');
const {resolveWorkContext}=require('../src/workContext.ts');
const snapshot={projects:[{id:'p'}],tasks:[{id:'t',projectId:'p'}],missions:[{id:'m',projectId:'p',taskIds:['t'],activeAttemptId:'new',attempts:[{id:'old',taskIds:['t']},{id:'new',taskIds:[]}]}]};
const context={projectId:'p',missionId:'m',attemptId:'old',taskId:'t',surface:'workbench',returnTo:{view:'ship',projectId:'p',missionId:'m',taskId:'t'}};
test('settings_return_preserves_selected_attempt',()=>{const returned=resolveWorkContext(context,snapshot);assert.deepEqual(returned.context,context);assert.equal(returned.unavailable,undefined);});
test('missing_project_never_opens_first_project',()=>{const original={...context,projectId:'removed-project'};const returned=resolveWorkContext(original,snapshot);assert.equal(returned.context.projectId,'removed-project');assert.match(returned.unavailable,/unavailable/i);});
test('missing attempt and mismatched task stay unavailable',()=>{assert.match(resolveWorkContext({...context,attemptId:'missing'},snapshot).unavailable,/attempt/i);assert.match(resolveWorkContext({...context,attemptId:'new'},snapshot).unavailable,/task/i);});
test('ordinary_conversation_stays_conversation',()=>{const ordinary={projectId:'p',taskId:'t',surface:'workbench',returnTo:{view:'home'}};assert.deepEqual(resolveWorkContext(ordinary,snapshot),{context:ordinary});assert.deepEqual(resolveWorkContext(null,snapshot),{context:null});});
test('selected reply display refuses duplicate IDs and changed content',async()=>{
 const {resolveReplyDisplay}=require('../src/workContext.ts');assert.equal(typeof resolveReplyDisplay,'function');
 const text='Reviewed result',sha256=require('node:crypto').createHash('sha256').update(text).digest('hex'),ref={kind:'reply',taskId:'t',messageId:'reply',sha256};
 const task={id:'t',status:'finished',messages:[{id:'reply',role:'assistant',text}]};
 assert.deepEqual(await resolveReplyDisplay(ref,task),{text});
 assert.match((await resolveReplyDisplay(ref,{...task,messages:[...task.messages,...task.messages]})).unavailable,/unavailable/i);
 assert.match((await resolveReplyDisplay(ref,{...task,messages:[{...task.messages[0],text:'Changed'}]})).unavailable,/changed/i);
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
