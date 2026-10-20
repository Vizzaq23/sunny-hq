const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inboxLane,searchLocalTasks}=require('../src/workNavigation.ts');
const task=(id,status,extra={})=>({id,title:'Review landing page',status,projectId:'p',crewId:'robin',updatedAt:1,...extra});
test('pending approval and errors outrank finished and active status',()=>{
 assert.equal(inboxLane(task('a','finished'),[{taskId:'a'}]),'attention');
 assert.equal(inboxLane(task('a','working',{error:'lost connection'}),[]),'attention');
 assert.equal(inboxLane(task('a','unknown'),[]),'attention');
 assert.equal(inboxLane(task('a','working'),[]),'active');
 assert.equal(inboxLane(task('a','finished'),[]),'review');
 assert.equal(inboxLane(task('a','completed'),[]),'review');
 assert.equal(inboxLane(task('a','interrupted'),[]),'history');
});
test('local search combines all terms across task, project and crew without mutating input',()=>{
 const tasks=[task('b','working'),task('a','finished'),task('external','finished',{external:true}),task('other','working',{projectId:'q'})];
 const projects=[{id:'p',name:'Sunny Studio'}],crew=[{id:'robin',name:'Robin'}];
 assert.deepEqual(searchLocalTasks(tasks,projects,crew,'ROBIN studio landing').map(t=>t.id),['a','b']);
 assert.deepEqual(tasks.map(t=>t.id),['b','a','external','other']);
 assert.equal(searchLocalTasks(tasks,projects,crew,'','q','robin').length,1);
 assert.equal(searchLocalTasks(tasks,projects,crew,'missing').length,0);
});
test('search includes older tasks beyond the former twelve-item cutoff',()=>{
 const tasks=Array.from({length:45},(_,i)=>task(String(i),'finished',{title:'Saved task '+i,updatedAt:i}));
 assert.equal(searchLocalTasks(tasks,[],[],'').length,45);
 assert.ok(searchLocalTasks(tasks,[],[],'Saved task 0').some(t=>t.id==='0'));
 assert.equal(searchLocalTasks(tasks,[],[],'').at(-1).id,'0');
});
