export type CrewId=string;
export interface IslandResident extends Crew {recruited:boolean;district:string;}
export interface IslandJob {id:string;name:string;crewId:CrewId;projectId:string;district:string;objective:string;intervalMinutes:number;maxRunsPerDay:number;maxTotalRuns:number;maxRunMinutes:number;dailyTokenLimit:number;requiresReview:boolean;enabled:boolean;status:string;error?:string;activeTaskId?:string;nextAt?:number|null;runs:{taskId:string;startedAt:number;status:string}[];}
export interface IslandWorld {paused:boolean;maxConcurrentJobs?:number;residents:IslandResident[];jobs:IslandJob[];error?:string;ledger:{id:string;amount:number;note:string;time:number;source:string}[];}
export interface Crew {spriteRow?:number;district?:string;id:CrewId;name:string;role:string;color:string;station:string;description:string;}
export interface Project {id:string;name:string;path:string;category:string;notePath?:string;}
export interface Task {jobId?:string;model?:string;effort?:string;selectionReason?:string;tokenUsage?:{total:{totalTokens:number;inputTokens:number;outputTokens:number;cachedInputTokens:number;reasoningOutputTokens:number}};captain?:boolean;parentTaskId?:string;id:string;title:string;projectId:string;crewId:CrewId;threadId?:string;status:string;createdAt:number;updatedAt:number;messages:Message[];turnId?:string;external?:boolean;error?:string;}
export interface Message {id:string;role:'user'|'assistant'|'system';text:string;time:number;}
export interface Tool {id:string;name:string;category:string;description:string;status:string;url?:string;path?:string;}
export interface Approval {id:string;method:string;params:any;taskId?:string;}
export interface MissionRole {id:string;label:string;crewId:string;capability:string;provider:string;}
export interface MissionAttempt {workflowVersion?:number;workflow?:{complete:boolean;stages:{id:string;status:string;taskId?:string}[]};routing?:{roleId:string;crewId:string;provider:string;reason:string};id:string;taskId:string;taskIds:string[];status:string;startedAt:number;completedAt?:number;error?:string;}
export interface MissionArtifact {id:string;attemptId:string;projectId:string;producer:string;kind:'git'|'check'|'pull-request'|'deliverable';filePath?:string;bytes?:number;sha256?:string;number?:number;url?:string;state?:string;checkStatus?:string;reviewDecision?:string;recordedAt:number;commit?:string;branch?:string;fingerprint?:string;dirty?:boolean;paths?:string[];script?:string;command?:string;status?:'passed'|'failed'|'stale';exitCode?:number|null;durationMs?:number;}
export interface Mission {seenEventIds?:string[];mergeRequest?:{id:string;attemptId:string;repository:string;number:number;url:string;commit:string;baseBranch:string;method:string;state:string;expiresAt:number};prPublication?:{id:string;attemptId:string;repository:string;branch:string;base:string;commit:string;title:string;body:string;state:string;url?:string;number?:number;expiresAt:number};branch?:{name:string;baseCommit:string;baseBranch:string;state:string};id:string;projectId:string;title:string;objective:string;acceptanceCriteria:string[];completionBoundary:'review'|'merge';status:string;connection:'connected'|'reconciling';revision:number;createdAt:number;updatedAt:number;taskIds:string[];activeAttemptId?:string;attempts:MissionAttempt[];artifacts:MissionArtifact[];events:{id:string;type:string;time:number;sequence:number}[];}
export interface CrewMemory {id:string;kind:'note'|'conversation'|'exchange';text:string;time:number;source?:{taskId?:string;messageId?:string;projectId?:string;exchangeId?:string;otherCrew?:CrewId};}
export interface CrewProgress {xp:number;conversations:number;memories:CrewMemory[];relationships:Partial<Record<CrewId,{exchanges:number;lastTopic:string;lastAt:number}>>;}
export interface CrewDiscussion {id:string;crew:CrewId[];topic:string;status:string;time:number;error?:string;messages:{crewId:CrewId;text:string;time:number}[];}
export interface NewsItem {id:string;url:string;title:string;summary:string;why:string;nextStep:string;source:string;category:string;projectId:string;publishedAt:string|null;capturedAt:number;origin:string;verification:string;status:string;}
export interface NewsState {items:NewsItem[];captureMode:string;lastCaptureAt:number|null;lastOrigin:string;preferences:{roles:string;location:string;topics:string};}
export interface Snapshot {missionRoles?:MissionRole[];missions?:Mission[];news?:NewsState;world?:IslandWorld;growth?:{enabled:boolean;profiles:Record<CrewId,CrewProgress>};discussions?:CrewDiscussion[];projects:Project[];tasks:Task[];tools:Tool[];settings:{reducedMotion:boolean;notifications:boolean;model?:string;routingPolicy?:'efficient'|'balanced'|'thorough'};codex:{status:string;version?:string;account?:string;error?:string};approvals:Approval[];models:any[];usage:any;automations:any[];}
export interface FileEntry {name:string;path:string;directory:boolean;}
export interface FileData {path:string;text:string;hash:string;}
export interface SunnyAPI {invoke:(action:string,args?:any)=>Promise<any>;subscribe:(handler:(event:{type:string;data:any})=>void)=>()=>void;}
declare global {interface Window {sunny?:SunnyAPI;}}

// IPC action contract (all return promises; failures reject with readable Error):
// snapshot -> Snapshot; project:add -> Project (native folder dialog); project:remove {projectId}
// task:start {projectId,crewId,prompt,title?,model?} -> Task
// task:send {taskId,prompt} -> void; task:interrupt {taskId}; task:handoff {taskId,crewId,prompt} -> Task
// task:history {} -> external read-only thread summaries; task:readExternal {threadId} -> provider history
// codex:connect {}; codex:login {} -> {authUrl?}; approval:respond {id,decision:'accept'|'decline',answers?}
// files:list {projectId,path?} -> FileEntry[]; files:read {projectId,path} -> FileData
// files:write {projectId,path,text,hash} -> FileData; files:search {projectId,query} -> {path,line,text}[]
// git:status {projectId} -> {branch,files:{path,status}[],diff}; git:diff {projectId,path?} -> string
// git:commit {projectId,paths,message} -> string; git:branches {projectId} -> string
// terminal:create {projectId} -> {id}; terminal:write {id,data}; terminal:resize {id,cols,rows}; terminal:close {id}
// tools:open {toolId,projectId?}; tools:refresh {}; tools:call {taskId,server,name,arguments}
// library:search {query} -> {path,title,excerpt}[]; library:read {path} -> FileData
// library:write {path,text,hash} -> FileData; library:capture {title,text,projectId?} -> {path}
// settings:update {...partialSettings}; dialog:openExternal {url}; preview:open {url}; app:export -> {path?}
// docker:list -> any[]; docker:action {id,action:'start'|'stop'|'logs'}; github:prs {projectId} -> any[]
// events: snapshot (full Snapshot), task (Task), terminal:data {id,data}, terminal:exit {id,exitCode}, approval (Approval), error {message}
