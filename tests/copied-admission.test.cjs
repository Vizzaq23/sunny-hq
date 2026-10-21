const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const packaged=require('../desktop/packaged-acceptance.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const {capture}=require('./helpers/copied-capture-fixture.cjs');
test('exact nonempty copy admission consumes the capture once, and a plain copied object cannot issue recovery authority',t=>{const f=capture(t),admitted=packaged.admitFixture(f.args);assert.equal(admitted.scenario,'stopped-profile-copy');assert.equal(typeof packaged.assertCopiedFixtureCapability,'function');packaged.assertCopiedFixtureCapability(admitted);assert.throws(()=>packaged.assertCopiedFixtureCapability({...admitted}));assert.throws(()=>packaged.admitFixture(f.args),/COPIED_CAPTURE_REPLAY/);assert.deepEqual(fs.readFileSync(path.join(f.root,'working','chatgpt-history.json')),f.archive);assert.equal(fs.existsSync(path.join(f.root,'working','synthetic-project')),false);});
test('receipt without native completion, changed bytes, wrong phase and extra members fail without default or marker writes',t=>{
 for(const change of [f=>fs.unlinkSync(path.join(f.root,'control','native-complete.bin')),f=>fs.appendFileSync(path.join(f.root,'working','sunny.sqlite'),'tamper'),f=>fs.appendFileSync(path.join(f.root,'control','capture-receipt.json'),' '),f=>{f.manifest.phase=2;fs.writeFileSync(f.manifestPath,JSON.stringify(f.manifest));},f=>fs.writeFileSync(path.join(f.root,'working','state.json'),'{}')]){const f=capture(t);change(f);assert.throws(()=>packaged.admitFixture(f.args));assert.equal(fs.existsSync(path.join(f.root,'working','.sunny-packaged-fixture.json')),false);}
});
test('copied adapter requires admitted authority and never falls through to a default bootstrap',async()=>{await assert.rejects(packaged.bootFixtureHub({scenario:'stopped-profile-copy'}));});
module.exports={capture};
