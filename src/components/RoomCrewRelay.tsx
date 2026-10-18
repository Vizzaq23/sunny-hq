import {motion} from 'motion/react';
import {ArrowUpRight,GitBranch} from 'lucide-react';
import type {Snapshot,SupervisedRunSummary} from '../shared';
import {roomRelay} from '../roomRelay';

type Props={snapshot:Snapshot;run:SupervisedRunSummary;animate:boolean;onOpen:(id:string)=>void};
export function RoomCrewRelay({snapshot,run,animate,onOpen}:Props){
 const relay=roomRelay(snapshot,run.id,run.projectId);
 if(!relay)return null;
 return <div className="station-relay" data-motion={animate} aria-label="Crew assignment flow">
  <header><GitBranch aria-hidden="true"/><div><span className="station-stamp">CREW RELAY</span><strong>{relay.label}</strong></div></header>
  <p className="station-relay-next">{relay.nextAction}</p>
  <ul>{relay.nodes.slice(0,6).map(node=><motion.li layout="position" initial={false} key={node.id} data-active={node.active} data-state={node.state}>
   <div className="station-relay-node"><i aria-hidden="true"/><span>{node.crewId}</span><b>{node.label.replaceAll('-',' ')}</b></div>
   <p>{node.objective}</p>
   {node.dependencies.length?<div className="station-relay-dependencies"><GitBranch aria-hidden="true"/><span>After {node.dependencies.map(dependency=>dependency.crewId?dependency.crewId+' ('+dependency.id+')':dependency.id+' (unavailable)').join(', ')}</span></div>:<small className="station-relay-root">No prior assignment required</small>}
   {node.taskId?<button onClick={()=>onOpen(node.taskId!)} aria-label={'Inspect '+node.crewId+' assignment: '+node.objective}>Inspect work <ArrowUpRight aria-hidden="true"/></button>:null}
  </motion.li>)}</ul>
  {relay.nodes.length>6?<p className="station-evidence-note">Showing 6 of {relay.nodes.length} assignments. Open Crew work for the full run.</p>:null}
  <p className="station-relay-key"><i aria-hidden="true"/>Motion marks confirmed working crew. Finished turns still need review.</p>
 </div>;
}
