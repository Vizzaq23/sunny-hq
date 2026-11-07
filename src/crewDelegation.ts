import type {Snapshot} from './shared';

export interface DelegationSignal {id:string;crewId:string;direction:'outbound'|'inbound';time:number;title:string;detail:string;taskId?:string;timeLabel?:string;}
// Only explicit Luffy ancestry or saved local-council contributions establish delegation.
export function delegationSignals(snapshot:Snapshot):DelegationSignal[]{
 const signals:DelegationSignal[]=[];
 for(const task of snapshot.tasks){
  const parent=snapshot.tasks.find(parent=>parent.id===task.parentTaskId&&!parent.external&&parent.crewId==='luffy'&&parent.projectId===task.projectId);
  if(task.external||task.crewId==='luffy'||!parent)continue;
  signals.push({id:`task:${task.id}:assigned`,crewId:task.crewId,direction:'outbound',time:task.createdAt,title:task.title,detail:'Luffy assigned this conversation.',taskId:task.id});
  if(task.status==='finished'&&task.lastAssistantPreview)signals.push({id:`task:${task.id}:returned:${task.turnId??task.updatedAt}`,crewId:task.crewId,direction:'inbound',time:task.updatedAt,title:task.title,detail:task.lastAssistantPreview,taskId:task.id});
 }
 for(const council of snapshot.localCrew?.councils??[]){
  for(const contribution of council.contributions){
   const base={crewId:contribution.crewId,time:council.updatedAt,timeLabel:'Council last updated',title:contribution.objective,detail:`Council ${council.id}: ${council.objective}\nContribution state: ${contribution.status}. Individual assignment timestamps are not recorded.`};
   if(['queued','working','ready','failed','interrupted'].includes(contribution.status))signals.push({...base,id:`council:${council.id}:${contribution.crewId}:assigned`,direction:'outbound'});
   if(contribution.status==='ready'&&contribution.text)signals.push({...base,id:`council:${council.id}:${contribution.crewId}:returned`,direction:'inbound',detail:contribution.text});
  }
 }
 return signals;
}

export function freshDelegations(previous:Snapshot,next:Snapshot,now:number):DelegationSignal[]{
 if(previous.epoch!==next.epoch||next.sequence<=previous.sequence||next.persistence.state!=='saved'||next.persistence.uncertain)return [];
 const seen=new Set(delegationSignals(previous).map(signal=>signal.id));
 return delegationSignals(next).filter(signal=>{
  if(seen.has(signal.id)||signal.time<=now-10000||signal.time>now+1000)return false;
  if(signal.direction==='inbound'&&signal.taskId){
   const old=previous.tasks.find(task=>task.id===signal.taskId),current=next.tasks.find(task=>task.id===signal.taskId);
   if(old?.status==='finished'&&old.turnId===current?.turnId&&old.lastAssistantPreview===current?.lastAssistantPreview)return false;
  }
  return true;
 });
}
