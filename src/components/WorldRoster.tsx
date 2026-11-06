import type {Snapshot} from '../shared';
import {WORLD_SCENES,worldScene} from '../data';
import {crewSceneProjection,crewSceneStatus,roomCrew} from '../roomActivity';

export function WorldRoster({snapshot,projectId,onCrew,onBriefings,onOpen}:{snapshot:Snapshot;projectId?:string;onCrew:(id:string)=>void;onBriefings:()=>void;onOpen:(taskId:string)=>void}){
 return <nav className="world-roster" aria-label="Crew and blimp destinations">{WORLD_SCENES.map(base=>{const scene=worldScene(snapshot,base.crewId)!,projection=projectId?roomCrew(snapshot,projectId,scene.crewId).projection:crewSceneProjection(snapshot,scene.crewId),reported=scene.access==='sanitized-report',status=crewSceneStatus(projection),task=snapshot.tasks.find(t=>t.id===projection.taskId&&t.crewId===scene.crewId&&(!projectId||t.projectId===projectId));return <div key={scene.crewId} className={`world-roster-card ${status}`} data-world-state={projection.state}>
  <button data-world-destination={scene.crewId} onClick={()=>reported?onBriefings():onCrew(scene.crewId)}><strong>{scene.name}</strong><span>{scene.station}{scene.district?` · ${scene.district}`:''}</span><small>{reported?(projection.state==='idle'?'Read-only reports · Open briefings':projection.label):projection.label}</small></button>
  {!reported&&task?<button className="world-inspect" onClick={()=>onOpen(task.id)}>Inspect {scene.name}'s work</button>:null}
 </div>;})}</nav>;
}
