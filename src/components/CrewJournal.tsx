import {useEffect,useRef,useState} from 'react';
import {X,BookOpen,MessageCircle,Trash2,Pencil,Send} from 'lucide-react';
import type {CrewId,Snapshot} from '../shared';
import {ALL_CREW as CREW,CREW_BY_ID} from '../data';
import {CrewBadge} from './Chrome';
import {LocalCrewPanel} from './LocalCrewPanel';
type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
export function CrewJournal({initialProjectId,initialTab='memory',crewId,snapshot,invoke,onClose}:{initialProjectId?:string;initialTab?:'memory'|'relationships'|'local';crewId:CrewId;snapshot:Snapshot;invoke:Invoke;onClose:()=>void}){
 const crew=CREW_BY_ID.get(crewId)!;
 const profile=snapshot.growth?.profiles[crewId];
 const [tab,setTab]=useState<'memory'|'relationships'|'local'>(initialTab),[note,setNote]=useState(''),[editId,setEditId]=useState<string>(),[saving,setSaving]=useState(false);
 const [partner,setPartner]=useState<CrewId>(crewId==='zoro'?'sanji':'zoro'),[topic,setTopic]=useState('What have you learned about working with our captain, and how can you help each other?');
 const [starting,setStarting]=useState(false),[error,setError]=useState('');
 const busy=starting||Boolean(snapshot.discussions?.some(e=>e.status==='working'));
 const level=1+Math.floor(Math.sqrt((profile?.xp??0)/20));
 const save=async()=>{setSaving(true);setError('');try{await invoke('crew:note',{crewId,text:note,id:editId});setNote('');setEditId(undefined);}catch(e){setError(String(e));}finally{setSaving(false);}};
 const discuss=async()=>{setStarting(true);setError('');try{await invoke('crew:discuss',{crew:[crewId,partner],topic});}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setStarting(false);}};
 const close=()=>{if(note.trim()&&!window.confirm('Discard this unsaved journal note?'))return;onClose();};
 const closeRef=useRef(close);closeRef.current=close;const dialogRef=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement;const dialog=dialogRef.current;dialog?.showModal();dialog?.querySelector<HTMLButtonElement>('.crew-journal>header>button:last-child')?.focus();return()=>{if(dialog?.open)dialog.close();if(previous?.isConnected)previous.focus();};},[]);
 const exchanges=(snapshot.discussions??[]).filter(e=>e.crew.includes(crewId)&&e.crew.includes(partner)).slice(0,8);
 return <dialog ref={dialogRef} className="journal-backdrop" data-interactive="true" aria-label={`${crew.name}'s growth journal`} onCancel={event=>{event.preventDefault();closeRef.current();}}><section className="crew-journal">
  <header><CrewBadge crew={crew}/><div><span className="eyebrow">Growing together</span><h3>{crew.name}’s journal</h3><p>Level {level} · {profile?.xp??0} experience · {profile?.conversations??0} conversations</p></div><button aria-label="Close journal" onClick={close}><X/></button></header>
  <div className="growth-meter"><span style={{width:`${Math.min(100,((profile?.xp??0)-20*(level-1)**2)/(20*level**2-20*(level-1)**2)*100)}%`}}/></div>
  <nav><button className={tab==='memory'?'active':''} onClick={()=>setTab('memory')}><BookOpen/>Memories</button><button className={tab==='relationships'?'active':''} onClick={()=>setTab('relationships')}><MessageCircle/>Crew relationships</button><button className={tab==='local'?'active':''} onClick={()=>setTab('local')}>Local developer</button></nav>
  <div className="journal-scroll">
   <p className="journal-explanation">Experience reflects shared conversations, not a more powerful model. {crew.name} keeps their core personality while using remembered preferences and past discussions.</p>
   {tab==='local'?<LocalCrewPanel initialProjectId={initialProjectId} key={crewId} crewId={crewId} name={crew.name} snapshot={snapshot} invoke={invoke}/>:tab==='memory'?<>
    <label className="memory-toggle"><input type="checkbox" checked={snapshot.growth?.enabled!==false} onChange={e=>void invoke('crew:memoryEnabled',{enabled:e.target.checked}).catch(()=>{})}/>Learn and recall memories for the whole crew</label>
    <label className="journal-note"><b>{editId?'Correct a pinned memory':'Teach '+crew.name+' something to remember'}</b><textarea maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="I prefer short answers first, then details when I ask."/><div>{editId?<button onClick={()=>{setEditId(undefined);setNote('');}}>Cancel edit</button>:null}<button disabled={!note.trim()||saving} onClick={()=>void save()}>{saving?'Saving…':editId?'Save correction':'Remember this'}</button></div></label>
    <div className="journal-memories">{profile?.memories.length?profile.memories.map(memory=><article key={memory.id}><header><span>{memory.kind==='note'?'Pinned by you':memory.kind==='exchange'?'Crew conversation':'Conversation with you'} · {new Date(memory.time).toLocaleDateString()}</span><div>{memory.kind==='note'?<button aria-label="Edit memory" onClick={()=>{setEditId(memory.id);setNote(memory.text);}}><Pencil/></button>:null}<button aria-label="Forget memory" onClick={()=>{if(window.confirm('Remove this from future cross-task recall? The original conversation will remain.'))void invoke('crew:forget',{crewId,id:memory.id}).catch(()=>{});}}><Trash2/></button></div></header><p>{memory.text}</p>{memory.source?.localOnly?<small>Local crew recall only</small>:null}{memory.source?.projectId?<small>Project: {snapshot.projects.find(p=>p.id===memory.source?.projectId)?.name??'Unavailable project'}</small>:null}{memory.source?.taskId?<small>{memory.source.taskId.startsWith('local:')?'Source: local developer conversation':'Source: mission '+memory.source.taskId.slice(0,8)}</small>:null}</article>):<p className="journal-empty">A fresh journal. Complete a conversation or pin a preference to start building memories.</p>}</div>
    <small className="journal-footnote">Forgetting stops future cross-task recall. Existing conversation transcripts and their current context remain. Recollections of crew replies are opinions, not verified facts.</small>
   </>:<>
    <label className="journal-partner">Talk with<select value={partner} onChange={e=>setPartner(e.target.value as CrewId)}>{CREW.filter(c=>c.id!==crewId).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <div className="relationship-card"><b>{crew.name} + {CREW_BY_ID.get(partner)?.name}</b><span>{profile?.relationships[partner]?.exchanges??0} shared discussions</span><p>{(profile?.relationships[partner]?.exchanges??0)>=8?'Seasoned crewmates':(profile?.relationships[partner]?.exchanges??0)>=3?'Finding their rhythm':(profile?.relationships[partner]?.exchanges??0)>0?'Getting acquainted':'First introductions'}</p></div>
    <label className="journal-note"><b>Give them something to discuss</b><textarea maxLength={2000} value={topic} onChange={e=>setTopic(e.target.value)}/><div><button disabled={busy||!topic.trim()} onClick={()=>void discuss()}><Send/>{busy?'Crew discussion underway…':'Let them talk'}</button>{busy?<button onClick={()=>void invoke('crew:cancelDiscussion').catch(()=>{})}>Stop</button>:null}</div></label>
    <small className="journal-footnote">Two real Codex replies per discussion. Each sees their own relevant memories and the other’s reply. Completed discussions are remembered by both; automatic scripted banter adds no experience.</small>
    <div className="journal-discussions">{exchanges.map(e=><article key={e.id}><header><b>{e.topic}</b><span>{e.status}</span></header>{e.messages.map((m,i)=><p key={i}><strong>{CREW_BY_ID.get(m.crewId)?.name}</strong>{m.text}</p>)}{e.error?<small>{e.error}</small>:null}{e.status==='working'?<p>Waiting for the next crewmate…</p>:null}</article>)}</div>
   </>}{error?<p className="journal-error" role="alert">{error}</p>:null}
  </div>
 </section></dialog>;
}
