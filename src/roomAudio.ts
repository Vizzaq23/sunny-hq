import type {CrewId} from './shared';

export const ROOM_SOUND_DEFAULT_VOLUME = 0.32;
export const ROOM_SOUND_MAX_VOLUME = 0.65;

type Cue = {wave:OscillatorType;notes:number[];durations:number[];tone:number};

export const ROOM_CUES:Record<CrewId,Cue>={
  luffy:{wave:'triangle',notes:[392,523,659],durations:[.11,.12,.2],tone:.62},
  zoro:{wave:'sine',notes:[587,440,659],durations:[.08,.09,.19],tone:.52},
  nami:{wave:'sine',notes:[659,784,988],durations:[.07,.09,.16],tone:.48},
  usopp:{wave:'triangle',notes:[392,494,392,587],durations:[.08,.08,.08,.18],tone:.42},
  sanji:{wave:'triangle',notes:[330,494,659],durations:[.12,.1,.2],tone:.45},
  chopper:{wave:'sine',notes:[523,659,784],durations:[.12,.12,.2],tone:.38},
  robin:{wave:'sine',notes:[587,698,880],durations:[.14,.12,.24],tone:.4},
  franky:{wave:'triangle',notes:[196,392,587],durations:[.1,.1,.2],tone:.5},
  brook:{wave:'sine',notes:[784,659,988,1175],durations:[.1,.1,.1,.22],tone:.36},
  jinbe:{wave:'sine',notes:[220,330,440],durations:[.17,.16,.28],tone:.55},
};

type AudioContextLike={state:string;currentTime:number;destination:AudioNode;resume:()=>Promise<void>;createOscillator:()=>OscillatorNode;createGain:()=>GainNode};

export function createRoomCuePlayer(createContext:()=>AudioContextLike){
  let context:AudioContextLike|undefined;
  let lastPlayedAt=-Infinity;
  const active=new Set<OscillatorNode>();
  const getContext=()=>context??(context=createContext());

  async function unlock(){
    try{const audio=getContext();if(audio.state!=='running')await audio.resume();return audio.state==='running';}
    catch{return false;}
  }

  async function play(crewId:CrewId,volume=ROOM_SOUND_DEFAULT_VOLUME){
    const cue=ROOM_CUES[crewId];
    if(!cue||!Number.isFinite(volume)||volume<=0||volume>ROOM_SOUND_MAX_VOLUME)return false;
    let audio:AudioContextLike;
    try{audio=getContext();if(audio.state!=='running')await audio.resume();}catch{return false;}
    if(audio.state!=='running')return false;
    const now=audio.currentTime;
    if(now-lastPlayedAt<.18)return false;
    lastPlayedAt=now;
    let offset=.015;
    cue.notes.forEach((frequency,index)=>{
      const oscillator=audio.createOscillator(),envelope=audio.createGain();
      const duration=cue.durations[index]??.12,start=now+offset;
      oscillator.type=cue.wave;oscillator.frequency.setValueAtTime(frequency,start);
      envelope.gain.setValueAtTime(0,start);
      envelope.gain.linearRampToValueAtTime(volume*cue.tone,start+.012);
      envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);
      oscillator.connect(envelope);envelope.connect(audio.destination);
      active.add(oscillator);oscillator.onended=()=>active.delete(oscillator);
      oscillator.start(start);oscillator.stop(start+duration+.015);
      offset+=duration+.035;
    });
    return true;
  }

  function stop(){
    if(!context)return;
    for(const oscillator of active){try{oscillator.stop(context.currentTime+.008);}catch{/* already ended */}}
    active.clear();
  }

  return{unlock,play,stop};
}

let player:ReturnType<typeof createRoomCuePlayer>|undefined;
function getPlayer(){
  if(!player)player=createRoomCuePlayer(()=>{
    const AudioContextConstructor=window.AudioContext;
    if(!AudioContextConstructor)throw new Error('Room audio is unavailable in this runtime.');
    return new AudioContextConstructor();
  });
  return player;
}

export function unlockRoomAudio(){return getPlayer().unlock();}
export function playRoomCue(crewId:CrewId,volume=ROOM_SOUND_DEFAULT_VOLUME){return getPlayer().play(crewId,volume);}
export function stopRoomAudio(){player?.stop();}
