const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createHash}=require('node:crypto');
const control=require('../scripts/ordered-control-check.cjs');
const root=path.resolve(__dirname,'..');
const hashFile=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fixtureHash='219f75242146fb32b8ed8452a0b792b1c76207311b67f74b947b267cc8581590';
const protocolHash='cfbf13474db6cfd574cd072e386a9db405168e587eb0ac9be4f0297650a63afd';
function isolated(t){
 const moved=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-portable-control-'));
 t.after(()=>fs.rmSync(moved,{recursive:true,force:true}));
 fs.cpSync(path.join(root,'desktop'),path.join(moved,'desktop'),{recursive:true});
 for(const relative of ['tests/helpers/frozen-control-fixture.cjs','docs/evidence/protocols/ordered-control-2026-10-02.md','desktop/mission-profile.cjs']){
  const destination=path.join(moved,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});
  if(fs.existsSync(path.join(root,relative)))fs.copyFileSync(path.join(root,relative),destination);
 }
 return moved;
}
test('portable inputs preserve the frozen workload',t=>{
 assert.equal(typeof control.resolveControlInputs,'function','Portable input resolution must exist');
 const moved=isolated(t),inputs=control.resolveControlInputs(moved);
 assert.equal(hashFile(inputs.fixtureFile),fixtureHash);
 assert.equal(hashFile(inputs.protocolFile),protocolHash);
 const {loadFrozenControlFixture,inspectFrozenWorkload}=require('./helpers/frozen-control-loader.cjs');
 const fixture=inspectFrozenWorkload(loadFrozenControlFixture(inputs.fixtureFile,moved).fixture(1,moved));
 assert.equal(fixture.messagesPerTask,40);
 assert.equal(fixture.charactersPerMessage,1024);
 assert.equal(fixture.utf8BytesPerMessage,1026);
});
test('moved isolated checkout resolves inputs without its former sibling',t=>{
 assert.equal(typeof control.resolveControlInputs,'function','Portable input resolution must exist');
 const moved=isolated(t),inputs=control.resolveControlInputs(moved);
 assert.equal(inputs.fixtureFile,path.join(moved,'tests/helpers/frozen-control-fixture.cjs'));
 assert.equal(inputs.protocolFile,path.join(moved,'docs/evidence/protocols/ordered-control-2026-10-02.md'));
 assert.equal(inputs.fixtureSha256,fixtureHash);assert.equal(inputs.protocolSha256,protocolHash);
 const {loadFrozenControlFixture}=require('./helpers/frozen-control-loader.cjs');
 assert.equal(loadFrozenControlFixture(inputs.fixtureFile,moved).fixture(1,moved).missionBook.missions[0].status,'WAITING_FOR_REVIEW');
});
test('mutated fixture fails before loading or sampling',t=>{
 assert.equal(typeof control.resolveControlInputs,'function','Portable input resolution must exist');
 const moved=isolated(t),fixtureFile=path.join(moved,'tests/helpers/frozen-control-fixture.cjs');
 fs.appendFileSync(fixtureFile,'\nthrow Error("must never execute");\n');
 assert.throws(()=>control.resolveControlInputs(moved),/Frozen fixture source hash must match/);
 const {loadFrozenControlFixture}=require('./helpers/frozen-control-loader.cjs');
 assert.throws(()=>loadFrozenControlFixture(fixtureFile,moved),/Frozen fixture source hash must match before loading/);
});
test('mutated protocol fails before loading or sampling',t=>{
 assert.equal(typeof control.resolveControlInputs,'function','Portable input resolution must exist');
 const moved=isolated(t);fs.appendFileSync(path.join(moved,'docs/evidence/protocols/ordered-control-2026-10-02.md'),'altered');
 assert.throws(()=>control.resolveControlInputs(moved),/Frozen protocol source hash must match/);
});
