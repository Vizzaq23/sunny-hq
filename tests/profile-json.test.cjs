const {test}=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {captureProfile,sealProfileSnapshot,diffProfile,applyProfileUpdate}=require('../desktop/profile-snapshot.cjs');
const {encodeProfile}=require('../desktop/profile-json.cjs');
const seal=v=>sealProfileSnapshot(captureProfile(v));
function check(value,previous){const e=encodeProfile(value,previous),map=new Map(e.fragments.map(f=>[f.id,f.bytes])),bytes=Buffer.concat(e.layout.map(id=>map.get(id))),expected=Buffer.from(JSON.stringify(value));assert.deepEqual(bytes,expected);assert.equal(e.byteLength,expected.length);assert.equal(e.stateSha256,createHash('sha256').update(expected).digest('hex'));for(const f of e.fragments){assert.ok(f.bytes.length<=65536);assert.deepEqual(Buffer.from(new TextDecoder('utf-8',{fatal:true}).decode(f.bytes)),f.bytes);}return e;}
test('exact JSON bytes preserve keys, Unicode, scalar and sparse array semantics',()=>{
 const shared={a:'same'},value=seal({z:undefined,'2':'two','1':'one',text:'\u0000\n"\\🐳\ud800',array:[,undefined,NaN,Infinity,-Infinity,-0,null],shared,other:shared,nested:JSON.parse('{"__proto__":{"x":1},"":true}')});check(value);for(const v of [null,1,'🐳'.repeat(40000)])check(seal(v));
});
test('changed field reuses sealed history and appending a long string reuses prefix fragments',()=>{
 const base=seal({status:'waiting',history:Array.from({length:120},(_,i)=>({text:'🐳'+String(i)+'x'.repeat(1024)})),large:'x'.repeat(200000)}),first=check(base);const next=captureProfile(base);next.status='finished';next.large+='tail';const candidate=applyProfileUpdate(base,diffProfile(base,next,{baseGeneration:0}),{generation:0}),second=check(candidate,first),old=new Map(first.fragments.map(f=>[f.id,f.bytes]));assert.ok(second.layout.reduce((sum,id)=>{const f=second.fragments.find(f=>f.id===id);return sum+(old.get(id)===f.bytes?f.bytes.length:0);},0)>200000);
});
test('encoder refuses mutable objects and executable values',()=>{assert.throws(()=>encodeProfile({x:1}),/sealed/i);for(const value of [undefined,()=>{},Symbol('x'),1n])assert.throws(()=>encodeProfile(value));});
test('an early array edit retains later encoded history bytes',()=>{const base=seal(Array.from({length:100},(_,i)=>({id:i,text:'z'.repeat(5000)}))),a=check(base),next=captureProfile(base);next[0].text+='change';const candidate=applyProfileUpdate(base,diffProfile(base,next,{baseGeneration:1}),{generation:1}),b=check(candidate,a),ids=new Set(a.layout);assert.ok(b.fragments.filter(f=>ids.has(f.id)).reduce((n,f)=>n+f.bytes.length,0)>400000);});
test('tail edits reuse verified digest prefixes without rehashing unchanged history',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),filename=require.resolve('../desktop/profile-json.cjs');let hashed=0;
 function wrap(hash){const api={update(bytes){hashed+=Buffer.byteLength(bytes);hash.update(bytes);return api;},copy(){return wrap(hash.copy());},digest(...args){return hash.digest(...args);}};return api;}
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,Buffer,require:name=>name==='node:crypto'?{createHash:algorithm=>wrap(createHash(algorithm))}:require('../desktop/'+name.slice(2))},{filename});
 const base=seal({history:{text:'x'.repeat(2*1024*1024)},tail:0}),first=module.exports.encodeProfile(base),next=sealProfileSnapshot({...base,tail:1});hashed=0;const second=module.exports.encodeProfile(next,first);assert.equal(second.stateSha256,createHash('sha256').update(JSON.stringify(next)).digest('hex'));assert.ok(hashed<512*1024,'unchanged prefix should not be fed through SHA-256 again: '+hashed);
});
test('digest prefixes remain exact across early edits, deletions and reordered layouts',()=>{
 let state=seal({first:{text:'a'.repeat(140000)},middle:{text:'b'.repeat(140000)},tail:0}),encoding=check(state);const versions=[{...state,tail:1},{...state,first:{text:'c'.repeat(140000)}},{middle:state.middle,tail:2},{tail:3,middle:state.middle},{...state,tail:4}];for(const value of versions){state=seal(value);encoding=check(state,encoding);}
});
