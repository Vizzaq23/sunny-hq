const {test}=require('node:test');const assert=require('node:assert/strict');
const {resolveReportTask}=require('../src/reportTask.ts');
const task=(id,extra={})=>({id,projectId:'p',crewId:'morgans',...extra});
test('report follows a verified recovery chain to the finished result',()=>{
 const original=task('a'),first=task('a',{retryTaskId:'b'}),second=task('b',{recoveryOfTaskId:'a',retryTaskId:'c'}),last=task('c',{recoveryOfTaskId:'b',status:'finished'});
 assert.equal(resolveReportTask([first,second,last],original),last);
 assert.equal(resolveReportTask([],original),original);
 assert.equal(resolveReportTask([],undefined),undefined);
});
test('report never follows unrelated replacements or cycles',()=>{
 const first=task('a',{retryTaskId:'b'});
 for(const invalid of [{recoveryOfTaskId:'other'},{recoveryOfTaskId:'a',projectId:'other'},{recoveryOfTaskId:'a',crewId:'franky'}])assert.equal(resolveReportTask([first,task('b',invalid)],first),first);
 const second=task('b',{recoveryOfTaskId:'a',retryTaskId:'a'});first.recoveryOfTaskId='b';
 assert.equal(resolveReportTask([first,second],first),second);
});
