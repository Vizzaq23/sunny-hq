const {test}=require('node:test');
const assert=require('node:assert/strict');
const {rememberNote,recoverNote,discardNote,acceptNoteSave,requestSequence}=require('../src/noteDrafts.ts');
const base={path:'Notes/Alpha.md',hash:'original',text:'saved'};
test('note drafts survive navigation and preserve the original conflict hash',()=>{
 rememberNote(base,'unsaved');const disk={...base,path:'notes\\alpha.md',hash:'external',text:'external edit'};
 assert.deepEqual(recoverNote(disk),{base,text:'unsaved'});discardNote(base.path);assert.deepEqual(recoverNote(disk),{base:disk,text:disk.text});
});
test('save acceptance retains newer edits and rebases them on the accepted hash',()=>{
 rememberNote(base,'submitted');rememberNote(base,'newer');const saved={...base,hash:'saved-hash',text:'submitted'};
 assert.deepEqual(acceptNoteSave(base,'submitted',saved),{base:saved,text:'newer'});discardNote(base.path);
});
test('reverting text during a pending save remains an unsaved edit against the new disk value',()=>{
 rememberNote(base,'submitted');rememberNote(base,base.text);const saved={...base,hash:'saved-hash',text:'submitted'};
 assert.deepEqual(acceptNoteSave(base,'submitted',saved,base.text),{base:saved,text:'saved'});discardNote(base.path);
});
test('successful save clears only its own draft',()=>{
 const other={...base,path:'Beta.md'};rememberNote(base,'submitted');rememberNote(other,'other');const saved={...base,hash:'new',text:'submitted'};
 assert.deepEqual(acceptNoteSave(base,'submitted',saved),{base:saved,text:'submitted'});assert.equal(recoverNote(other).text,'other');discardNote(other.path);
});
test('older deferred replies and errors cannot replace the current request',async()=>{
 const sequence=requestSequence(),values=[];let first,second;
 const run=async(promise)=>{const id=sequence.next();try{const value=await promise;if(sequence.current(id))values.push(value);}catch{if(sequence.current(id))values.push('error');}};
 const a=run(new Promise((resolve,reject)=>{first=reject;})),b=run(new Promise(resolve=>{second=resolve;}));second('new');await b;first(Error('old'));await a;assert.deepEqual(values,['new']);
 const pending=sequence.next();sequence.cancel();assert.equal(sequence.current(pending),false);
});
test('save completion from an unmounted view retains edits made in the next view',()=>{
 rememberNote(base,'submitted');rememberNote(base,'edited after reopening');const saved={...base,hash:'new',text:'submitted'};
 assert.equal(acceptNoteSave(base,'submitted',saved,'submitted').text,'edited after reopening');discardNote(base.path);
});
