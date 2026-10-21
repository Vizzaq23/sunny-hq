const test=require('node:test');
const assert=require('node:assert/strict');

class FakeAudioContext{
 constructor(){this.state='suspended';this.currentTime=0;this.destination={};this.oscillators=[];this.resumeCount=0;}
 async resume(){this.resumeCount++;this.state='running';}
 createOscillator(){const node={type:'',frequency:{setValueAtTime(value){node.frequencyValue=value;}},connect(){},start(time){node.startedAt=time;},stop(time){node.stoppedAt=time;},onended:null};this.oscillators.push(node);return node;}
 createGain(){const gain={value:0,setValueAtTime(value,time){gain.value=value;gain.setAt=time;},linearRampToValueAtTime(value,time){gain.ramp=value;gain.rampAt=time;},exponentialRampToValueAtTime(value,time){gain.end=value;gain.endAt=time;}};return{gain,connect(){}};}
}

test('each Sunny specialist has a distinct short room-arrival signature',async()=>{
 const {ROOM_CUES}=await import('../src/roomAudio.ts');
 const ids=['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe'];
 assert.deepEqual(Object.keys(ROOM_CUES).sort(),ids.slice().sort());
 const signatures=ids.map(id=>`${ROOM_CUES[id].wave}:${ROOM_CUES[id].notes.join(',')}:${ROOM_CUES[id].durations.join(',')}`);
 assert.equal(new Set(signatures).size,ids.length);
 for(const cue of Object.values(ROOM_CUES)){
  assert.ok(cue.notes.length>=3&&cue.notes.length<=4);
  assert.equal(cue.notes.length,cue.durations.length);
  assert.ok(cue.durations.every(value=>value>0&&value<=.3));
 }
});

test('room cue player resumes only on request, uses the selected safe volume, and stops active cues',async()=>{
 const {createRoomCuePlayer,ROOM_SOUND_MAX_VOLUME}=await import('../src/roomAudio.ts');
 const context=new FakeAudioContext(),player=createRoomCuePlayer(()=>context);
 assert.equal(await player.unlock(),true);
 assert.equal(context.resumeCount,1);
 assert.equal(await player.play('robin',.4),true);
 assert.equal(context.oscillators.length,3);
 assert.deepEqual(context.oscillators.map(node=>node.frequencyValue),[587,698,880]);
 assert.ok(context.oscillators.every(node=>node.startedAt>=0));
 assert.equal(await player.play('brook',ROOM_SOUND_MAX_VOLUME+.01),false);
 assert.equal(await player.play('brook',0),false);
 context.currentTime=.5;
 assert.equal(await player.play('brook',.2),true);
 assert.equal(context.oscillators.length,7);
 player.stop();
 assert.ok(context.oscillators.every(node=>Number.isFinite(node.stoppedAt)));
});

test('room audio stays unavailable without a running audio context',async()=>{
 const {createRoomCuePlayer}=await import('../src/roomAudio.ts');
 const context=new FakeAudioContext();context.resume=async()=>{};
 const player=createRoomCuePlayer(()=>context);
 assert.equal(await player.unlock(),false);
 assert.equal(await player.play('zoro'),false);
 assert.equal(context.oscillators.length,0);
});

test('stop cancels playback awaiting native resume and a later explicit play can start',async()=>{
 const {createRoomCuePlayer}=await import('../src/roomAudio.ts');const context=new FakeAudioContext();let resume;
 context.resume=()=>new Promise(resolve=>{resume=()=>{context.state='running';resolve();};});
 const player=createRoomCuePlayer(()=>context),pending=player.play('franky');player.stop();resume();
 assert.equal(await pending,false);assert.equal(context.oscillators.length,0);
 assert.equal(await player.play('franky'),true);assert.equal(context.oscillators.length,3);
});

test('active voices remain owned until real ended cleanup and repeated stop still cancels them',async()=>{
 const {createRoomCuePlayer}=await import('../src/roomAudio.ts');const context=new FakeAudioContext(),player=createRoomCuePlayer(()=>context);
 await player.play('jinbe');const calls=[];for(const node of context.oscillators){node.stop=time=>calls.push({node,time});node.disconnect=()=>{node.disconnected=true;};}
 context.currentTime=.02;player.stop();assert.equal(calls.length,3);assert.ok(calls.every(v=>v.time<=.028));
 context.currentTime=.03;player.stop();assert.equal(calls.length,6,'a JS set clear is not native ended cleanup');
 for(const node of context.oscillators)node.onended();player.stop();assert.equal(calls.length,6);assert.ok(context.oscillators.every(node=>node.disconnected));
});
