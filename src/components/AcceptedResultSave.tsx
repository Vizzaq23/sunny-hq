import {useEffect,useState} from 'react';
import type {Mission,Snapshot} from '../shared';
import {useTaskTranscript} from '../useTaskTranscript';
import {SaveReviewedResult} from './SaveReviewedResult';
import {ResultSaveHistory} from './ResultSaveHistory';
import {boundResultStatus,storageOutcomeUncertain} from '../workContext';
const subscribe=(handler:Parameters<NonNullable<Window['sunny']>['subscribe']>[0])=>window.sunny?.subscribe?.(handler)??(()=>{});
export function AcceptedResultSave({mission,snapshot,invoke,onOpen}:{mission:Mission;snapshot:Snapshot;onOpen:(taskId:string)=>void;invoke:<T=unknown>(action:string,args?:unknown)=>Promise<T>}){
 const ref=mission.selectedResult?.ref,task=snapshot.tasks.find(t=>ref?.kind==='reply'&&t.id===ref.taskId);
 const transcript=useTaskTranscript({projectId:task?.projectId,taskId:task?.id,epoch:snapshot.epoch,revision:task?.transcriptRevision,sequence:snapshot.sequence,invoke,subscribe});
 const parts=transcript.segments.filter(p=>ref?.kind==='reply'&&p.messageId===ref.messageId).sort((a,b)=>a.offset-b.offset);let text='',end=0;
 for(const part of parts){if(part.offset!==end)break;text+=part.text;end=part.offset+part.text.length;}
 const complete=parts.length>0&&end===parts[0].totalLength;
 const [verified,setVerified]=useState<{text:string;sha256:string}>();
 useEffect(()=>{if(!complete||ref?.kind!=='reply')return;let active=true;const expected=ref.sha256;void crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)).then(bytes=>{const actual=Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('');if(active&&actual===expected)setVerified({text,sha256:expected});}).catch(()=>{});return()=>{active=false;};},[complete,text,ref]);
 useEffect(()=>{if(!complete&&!transcript.loading&&!transcript.error&&transcript.hasOlder)transcript.loadOlder();},[complete,transcript]);
 if(!task||ref?.kind!=='reply')return null;
 const records=(snapshot.resultSaves||[]).filter(r=>r.missionId===mission.id);
 const accepted=mission.status==='COMPLETE'&&mission.acceptance&&'resultSha256' in mission.acceptance&&mission.acceptance.resultSha256===ref.sha256&&!storageOutcomeUncertain(snapshot)&&boundResultStatus(snapshot,mission)?.available===true&&verified?.text===text&&verified.sha256===ref.sha256;
 return <section aria-label="Save accepted report"><h4>Accepted report</h4>{complete&&accepted?<><pre>{text}</pre><SaveReviewedResult task={{...task,messages:[{id:ref.messageId,role:'assistant',text,time:task.updatedAt}]}} title={mission.title} text={text} records={records} disabled={!accepted} invoke={invoke}/></>:<p role="status">{transcript.error||(complete?'Accepted content unavailable or awaiting hash verification. Changed text is not an accepted report.':'Loading the complete accepted reply…')}</p>}{transcript.error?<button onClick={transcript.retry}>Retry loading report</button>:null}<ResultSaveHistory records={records} invoke={invoke} onSource={item=>onOpen(item.id)}/></section>;
}
