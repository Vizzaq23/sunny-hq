const {test}=require('node:test');const assert=require('node:assert/strict');
const {clearSubmittedDraft}=require('../src/useDraft.ts');
function browser(t,storage){const oldWindow=global.window,oldStorage=global.sessionStorage;global.window=new EventTarget();global.sessionStorage=storage;t.after(()=>{if(oldWindow===undefined)delete global.window;else global.window=oldWindow;if(oldStorage===undefined)delete global.sessionStorage;else global.sessionStorage=oldStorage;});const submissions=[];window.addEventListener('sunny:draft-submitted',event=>submissions.push(event.detail));return submissions;}
test('successful submission clears only matching persisted text and signals exact authored value',t=>{
 const values=new Map([['sunny:draft:v1:brief','Literal $(draft) `text`\r\n']]);const submissions=browser(t,{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)});
 clearSubmittedDraft('brief','Literal $(draft) `text`\r\n');assert.equal(values.get('sunny:draft:v1:brief'),'');assert.deepEqual(submissions,[{key:'brief',submitted:'Literal $(draft) `text`\r\n'}]);
 values.set('sunny:draft:v1:brief','Newer draft');clearSubmittedDraft('brief','Older submitted text');assert.equal(values.get('sunny:draft:v1:brief'),'Newer draft');
});
for(const mode of ['denied','quota'])test(`${mode} storage still signals exact successful submission without failing the save`,t=>{
 const submissions=browser(t,{getItem:()=>{if(mode==='denied')throw Error('Denied');return 'Submitted';},setItem:()=>{throw Error('Quota full');}});
 assert.doesNotThrow(()=>clearSubmittedDraft('brief','Submitted'));assert.deepEqual(submissions,[{key:'brief',submitted:'Submitted'}]);
});
