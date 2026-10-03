// Frozen sources copied byte-for-byte from sunny-responsive-session-20261001:
// worker-diagnostic/fixture.cjs (219f75242146fb32b8ed8452a0b792b1c76207311b67f74b947b267cc8581590)
// A4-measurement-protocol.md (cfbf13474db6cfd574cd072e386a9db405168e587eb0ac9be4f0297650a63afd)
// Only the fixture's original mission-profile dependency is rebound to this checkout.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto'),{Script}=require('node:vm');
function loadFrozenControlFixture(fixtureFile,root){
 const bytes=fs.readFileSync(fixtureFile);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'219f75242146fb32b8ed8452a0b792b1c76207311b67f74b947b267cc8581590','Frozen fixture source hash must match before loading');
 const originalProfile=path.resolve(path.dirname(fixtureFile),'../../sunny-responsive-20261001/desktop/mission-profile.cjs');
 const frozenRequire=id=>{
  if(id==='node:path')return path;
  if(id==='node:assert/strict')return assert;
  if(id===originalProfile)return require(path.join(root,'desktop/mission-profile.cjs'));
  throw Error('Unexpected frozen fixture dependency: '+id);
 };
 const module={exports:{}};
 const evaluate=new Script('(function(require,module,exports,__dirname){\n'+bytes.toString('utf8')+'\n})',{filename:fixtureFile}).runInThisContext();
 evaluate(frozenRequire,module,module.exports,path.dirname(fixtureFile));
 return module.exports;
}
function inspectFrozenWorkload(state){
 assert.ok(state.tasks.length>0);
 const first=state.tasks[0].messages[0];
 const metadata={messagesPerTask:state.tasks[0].messages.length,charactersPerMessage:first.text.length,utf8BytesPerMessage:Buffer.byteLength(first.text,'utf8')};
 for(const task of state.tasks){
  assert.equal(task.messages.length,metadata.messagesPerTask);
  for(const message of task.messages){assert.equal(message.text.length,metadata.charactersPerMessage);assert.equal(Buffer.byteLength(message.text,'utf8'),metadata.utf8BytesPerMessage);}
 }
 return metadata;
}
module.exports={loadFrozenControlFixture,inspectFrozenWorkload};
