const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateTaskCommand}=require('../desktop/task-commands.cjs');
test('task launch rejects implicit privilege and malformed arguments',()=>{
 const valid={projectId:'p',crewId:'franky',prompt:'Build this',model:'catalog-model',effort:'high'};
 assert.deepEqual(validateTaskCommand('task:start',valid),valid);
 for(const bad of [null,[],{...valid,parentTaskId:'bypass'},{...valid,prompt:''},{...valid,model:{}},{...valid,projectId:'p\0evil'}])assert.throws(()=>validateTaskCommand('task:start',bad),/Invalid|Unknown/);
});
test('task control only accepts the task identifier and declared fields',()=>{
 for(const action of ['task:interrupt','task:checkStatus']){
  assert.deepEqual(validateTaskCommand(action,{taskId:'task'}),{taskId:'task'});
  assert.throws(()=>validateTaskCommand(action,{taskId:'task',projectId:'other'}),/Unknown/);
 }
 assert.throws(()=>validateTaskCommand('task:send',{taskId:'task',prompt:'x'.repeat(100001)}),/Invalid/);
 assert.throws(()=>validateTaskCommand('task:handoff',{taskId:'task',crewId:'franky'}),/Invalid/);
});
