const {test}=require('node:test');
const assert=require('node:assert/strict');
const {companionBounds,validWorkspaceRequest}=require('../desktop/companion.cjs');
test('companion stays inside negative-coordinate and small monitor work areas',()=>{
 for(const area of [{x:-1920,y:0,width:1920,height:1040},{x:0,y:0,width:640,height:480}]){
  const b=companionBounds(area,900);
  assert.ok(b.x>=area.x&&b.y>=area.y&&b.x+b.width<=area.x+area.width&&b.y+b.height<=area.y+area.height);
 }
});
test('only known crew and bounded workspace IDs cross the companion bridge',()=>{
 assert.deepEqual(validWorkspaceRequest({crewId:'zoro',projectId:'p',prompt:'Review this'}),{crewId:'zoro',projectId:'p',prompt:'Review this'});
 assert.throws(()=>validWorkspaceRequest({crewId:'unknown'}));
 assert.throws(()=>validWorkspaceRequest({prompt:'x'.repeat(200001)}));
 assert.deepEqual(validWorkspaceRequest({unexpected:'drop'}),{});
});
