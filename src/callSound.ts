import type {CallBinding} from './shared';
export const callSoundKey=(binding:CallBinding)=>JSON.stringify([binding.projectId,binding.runId,binding.attemptId,binding.requestId]);
// Notification audio owns no response authority. Muting never cancels its durable acknowledgment.
export function createCallSound(createAudio:()=>AudioContext=()=>new AudioContext()){
 let enabled=false,generation=0;const played=new Set<string>(),active=new Map<AudioContext,OscillatorNode>();
 const stop=()=>{generation++;for(const [audio,tone] of active){tone.onended=null;try{tone.stop();}catch{/* It may already have ended. */}void audio.close().catch(()=>{});}active.clear();};
 return {
  setEnabled(value:boolean){if(enabled===value)return;enabled=value;if(!enabled)stop();},
  dispose(){enabled=false;stop();},
  async notify(key:string,acknowledge:()=>Promise<void>,stillPending:()=>boolean=()=>true){
   if(!enabled||played.has(key))return;played.add(key);const current=generation;await acknowledge();
   if(!enabled||current!==generation||!stillPending())return;
   const audio=createAudio(),tone=audio.createOscillator(),gain=audio.createGain();active.set(audio,tone);
   tone.frequency.value=440;gain.gain.value=.04;tone.connect(gain);gain.connect(audio.destination);tone.onended=()=>{active.delete(audio);void audio.close().catch(()=>{});};tone.start();tone.stop(audio.currentTime+.18);
  }
 };
}