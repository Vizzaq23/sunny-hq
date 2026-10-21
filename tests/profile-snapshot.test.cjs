const {test}=require('node:test'),assert=require('node:assert/strict');
const {captureProfile,sealProfileSnapshot,isSealedProfile,diffProfile,applyProfileUpdate}=require('../desktop/profile-snapshot.cjs');
test('capture isolates in-place unversioned edits, aliases and sparse arrays',()=>{
 const shared={text:'original'},source={tasks:[{messages:[shared]}],alias:shared,array:[,undefined,NaN,-0]};const copy=captureProfile(source);shared.text='changed';source.array.push(1);assert.equal(copy.tasks[0].messages[0].text,'original');assert.equal(copy.alias,copy.tasks[0].messages[0]);assert.equal(copy.array.length,4);assert.equal(0 in copy.array,false);assert.ok(Number.isNaN(copy.array[2]));assert.ok(Object.is(copy.array[3],-0));
});
test('patch detects in-place changes and preserves untouched sealed subtrees',()=>{
 const base=sealProfileSnapshot(captureProfile({tasks:[{messages:[{text:'original'}]}],opaque:{keep:1}}));const next=captureProfile(base);next.tasks[0].messages[0].text='new';const patch=diffProfile(base,next,{baseGeneration:7});assert.equal(patch.kind,'patch');const out=applyProfileUpdate(base,patch,{generation:7});assert.deepEqual(out,next);assert.equal(out.opaque,base.opaque);assert.equal(base.tasks[0].messages[0].text,'original');assert.throws(()=>applyProfileUpdate(base,patch,{generation:6}),/generation/i);assert.ok(isSealedProfile(out));assert.ok(Object.isFrozen(out.tasks[0]));
});
test('property order, prototype keys, insertion and deletion survive patching',()=>{
 const base=sealProfileSnapshot(captureProfile(JSON.parse('{"a":1,"__proto__":{"safe":true},"tasks":[1,2],"drop":1}')));const next=JSON.parse('{"tasks":[0,1,2],"__proto__":{"safe":false},"a":1}');const out=applyProfileUpdate(base,diffProfile(base,next,{baseGeneration:0}),{generation:0});assert.equal(JSON.stringify(out),JSON.stringify(next));assert.equal(Object.getPrototypeOf(out),Object.prototype);assert.equal({}.safe,undefined);
});
test('large update uses full replacement and is isolated before caller mutation',()=>{
 const base=sealProfileSnapshot(captureProfile({text:''})),next={text:'x'.repeat(1024*1024)};const update=diffProfile(base,next,{baseGeneration:2});assert.equal(update.kind,'full');next.text='changed';assert.equal(applyProfileUpdate(base,update,{generation:2}).text.length,1024*1024);
});
test('malformed and inherited patch paths fail without mutating base',()=>{
 const base=sealProfileSnapshot(captureProfile({a:[1],b:{x:1}})),before=JSON.stringify(base);
 for(const ops of [[{op:'set',path:['constructor','prototype','polluted'],value:true}],[{op:'set',path:['a',-1],value:3}],[{op:'delete',path:['a',0]}],[{op:'oops',path:[]}],[{op:'set',path:['b','x'],value:2,extra:1}]])assert.throws(()=>applyProfileUpdate(base,{kind:'patch',baseGeneration:0,ops},{generation:0}));assert.equal(JSON.stringify(base),before);assert.equal({}.polluted,undefined);
});
test('cycles, accessors and executable values are rejected without invoking getters',()=>{
 const cycle={};cycle.self=cycle;for(const value of [cycle,{x:()=>{}},{x:Symbol('x')},{x:1n}])assert.throws(()=>captureProfile(value));let read=false;assert.throws(()=>captureProfile({get x(){read=true;return 1;}}));assert.equal(read,false);
});
test('adding control metadata does not resend unchanged transcript text',()=>{const base=sealProfileSnapshot(captureProfile({task:{messages:[{text:'x'.repeat(200000)}]}})),next=captureProfile(base);next.task.intent={state:'prepared'};const update=diffProfile(base,next,{baseGeneration:0});assert.ok(Buffer.byteLength(JSON.stringify(update))<500);assert.deepEqual(applyProfileUpdate(base,update,{generation:0}),next);});
test('many small operations include separators in the transport byte limit',()=>{
 const base=sealProfileSnapshot(Object.fromEntries(Array.from({length:25900},(_,i)=>['k'+i,0]))),next=Object.fromEntries(Object.keys(base).map(key=>[key,1]));
 const update=diffProfile(base,next,{baseGeneration:0});assert.equal(update.kind,'full');assert.deepEqual(applyProfileUpdate(base,update,{generation:0}),next);
});
test('delete-only updates also fall back when their envelope exceeds the limit',()=>{
 const base=sealProfileSnapshot(Object.fromEntries(Array.from({length:35000},(_,i)=>['key'+i,0]))),next={};
 const update=diffProfile(base,next,{baseGeneration:0});assert.equal(update.kind,'full');assert.deepEqual(applyProfileUpdate(base,update,{generation:0}),next);
});

test('captures supported native values with their existing JSON representation',()=>{
 const source={date:new Date(0),invalid:new Date(NaN),typed:new Uint8Array([1,2])},copy=captureProfile(source);source.date.setTime(123);source.typed[0]=9;assert.equal(JSON.stringify(copy),'{"date":"1970-01-01T00:00:00.000Z","invalid":null,"typed":{"0":1,"1":2}}');const base=sealProfileSnapshot(copy),next={...source,date:new Date(1000)};assert.equal(JSON.stringify(applyProfileUpdate(base,diffProfile(base,next,{baseGeneration:0}),{generation:0})),JSON.stringify(next));
});
test('deep changed profiles fall back safely without overflowing the diff stack',()=>{
 const root={};let cursor=root;for(let i=0;i<1500;i++)cursor=cursor.child={};cursor.value='old';const base=sealProfileSnapshot(captureProfile(root));cursor.value='new';const update=diffProfile(base,root,{baseGeneration:3});assert.equal(update.kind,'full');const result=applyProfileUpdate(base,update,{generation:3});let leaf=result;for(let i=0;i<1500;i++)leaf=leaf.child;assert.equal(leaf.value,'new');
});
