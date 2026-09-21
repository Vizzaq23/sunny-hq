const {test}=require('node:test');const assert=require('node:assert/strict');const {stepRoomActor}=require('../src/roomMotion.ts');
test('work travels to station then begins work frames',()=>{const start={y:67,moving:false};const next=stepRoomActor(start,{working:true,attention:false},.1,false);assert.ok(next.y<67&&next.y>52);assert.equal(next.moving,true);let actor=next;for(let i=0;i<30;i++)actor=stepRoomActor(actor,{working:true,attention:false},.1,false);assert.deepEqual(actor,{y:52,moving:false});});
test('blocked crew stop immediately without reaching or leaving a station',()=>{assert.deepEqual(stepRoomActor({y:60,moving:true},{working:false,attention:true},.1,false),{y:60,moving:false});});
test('reduced motion snaps with no travel and idle returns to rest',()=>{assert.deepEqual(stepRoomActor({y:67,moving:true},{working:true,attention:false},.1,true),{y:52,moving:false});assert.deepEqual(stepRoomActor({y:52,moving:false},{working:false,attention:false},.1,true),{y:67,moving:false});});
test('clock jumps never teleport animated crew and negative time does not reverse them',()=>{assert.equal(stepRoomActor({y:67,moving:false},{working:true,attention:false},99,false).y,65);assert.equal(stepRoomActor({y:67,moving:false},{working:true,attention:false},-1,false).y,67);});

const {moveRoomCaptain,nearRoomBoard}=require('../src/roomMotion.ts');
test('captain remains on the clear illustrated floor and can reach the board approach',()=>{
 let p={x:46,y:74};for(let i=0;i<20;i++)p=moveRoomCaptain(p,0,-4);
 assert.equal(nearRoomBoard(p),true);assert.ok(p.y>=52);
 for(let i=0;i<100;i++)p=moveRoomCaptain(p,-4,0);assert.ok(p.x>=34);
 for(let i=0;i<100;i++)p=moveRoomCaptain(p,4,4);assert.ok(p.x<=78&&p.y<=76);
 assert.equal(nearRoomBoard(p),false);
});
