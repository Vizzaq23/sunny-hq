import type {Snapshot} from './shared';
import {projectRun} from './runProjection.ts';

/** Reuse the authoritative run presentation guards; decoration never infers work. */
export function roomRelay(snapshot:Snapshot,runId:string,projectId:string){
 const run=snapshot.runs?.find(value=>value.id===runId&&value.projectId===projectId);
 if(!run)return undefined;
 const view=projectRun({...snapshot,tasks:snapshot.tasks.filter(value=>value.projectId===projectId&&value.runId===run.id)},run.id);
 return {label:view.label,nextAction:view.nextAction,nodes:run.assignments.map(assignment=>{
  const crew=view.crew.find(value=>value.id===assignment.crewId);
  const task=snapshot.tasks.find(value=>value.id===assignment.taskId&&value.projectId===projectId&&value.runId===run.id);
  const current=Boolean(task&&crew?.taskId===assignment.taskId);
  return {id:assignment.id,crewId:assignment.crewId,objective:assignment.objective,state:assignment.state,
   label:current?crew!.label:assignment.state==='working'?'Work not confirmed':assignment.state,active:Boolean(task&&current&&crew?.working),taskId:task?.id,
   dependencies:assignment.dependencies.map(id=>({id,crewId:run.assignments.find(value=>value.id===id)?.crewId}))};
 })};
}
