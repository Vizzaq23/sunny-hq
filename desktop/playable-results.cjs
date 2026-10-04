const fs=require('node:fs'),path=require('node:path');const {createHash}=require('node:crypto');
const {sameSource,evaluateReadiness}=require('./review-verdicts.cjs');
const LIMITS=Object.freeze({manifest:256*1024,file:16*1024*1024,total:64*1024*1024,count:256});
const text=(v,max=200)=>typeof v==='string'&&!!v.trim()&&v.length<=max&&!/[\0\r\n]/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function fields(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))throw Error('Invalid playable manifest fields.');}
function list(v,max){if(!Array.isArray(v)||v.length>max||Array.from({length:v.length},(_,i)=>i).some(i=>!Object.hasOwn(v,i)))throw Error('Invalid playable manifest list.');}
function relative(v){if(!text(v,1000)||v.includes('\\')||/[\0:~]/.test(v)||path.isAbsolute(v)||v.split('/').some(p=>!p||p==='.'||p==='..'||/[. ]$/.test(p)||/^(\.git|\.codex|\.agents|\.ssh|\.aws|node_modules)$/i.test(p)||/^\.env/i.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))throw Error('Protected or invalid playable path.');return v;}
const stamp=s=>JSON.stringify([s.dev,s.ino,s.birthtimeMs,s.size,s.mtimeMs,s.ctimeMs,s.nlink]);
function readBinary(root,name,limit=LIMITS.file){
 relative(name);const base=require('./execution-workspaces.cjs').canonical(root),chain=[];let file=base;
 const rootStat=fs.lstatSync(base);chain.push([base,stamp(rootStat)]);
 for(const part of name.split('/')){file=path.join(file,part);const s=fs.lstatSync(file);if(s.isSymbolicLink()||!require('./execution-workspaces.cjs').same(fs.realpathSync(file),file))throw Error('Playable links or junctions are not supported.');chain.push([file,stamp(s)]);}
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{const before=fs.fstatSync(fd);if(!before.isFile()||before.nlink!==1||before.size>limit||stamp(fs.lstatSync(file))!==stamp(before))throw Error('Playable file is linked, changed or exceeds bounds.');
 const content=Buffer.alloc(before.size+1);let bytes=0,n;while(bytes<content.length&&(n=fs.readSync(fd,content,bytes,content.length-bytes,null)))bytes+=n;
 if(bytes!==before.size||stamp(fs.fstatSync(fd))!==stamp(before)||chain.some(([p,s])=>stamp(fs.lstatSync(p))!==s||fs.lstatSync(p).isSymbolicLink()||!require('./execution-workspaces.cjs').same(fs.realpathSync(p),p)))throw Error('Playable path or bytes changed during reading.');
 return {filePath:name,bytes,sha256:createHash('sha256').update(content.subarray(0,bytes)).digest('hex'),content:content.subarray(0,bytes)};
 }finally{fs.closeSync(fd);}
}
function validateManifest(m,authority){
 fields(m,['version','runId','missionId','attemptId','producerTaskId','workspaceId','source','build','toolchain','runtime','artifacts','entrypoint','cwd','environment','requiredCheckIds','limitations','producedAt']);
 if(m.version!==1||m.runtime!=='node-http'||m.cwd!=='.'||!Number.isSafeInteger(m.producedAt)||m.producedAt<0)throw Error('Unsupported playable runtime or version.');
 for(const k of ['runId','missionId','attemptId','producerTaskId','workspaceId'])if(!text(m[k])||m[k]!==authority?.[k])throw Error('Playable identity changed: '+k);
 require('./supervision-schema.cjs').validateSource(m.source);if(!sameSource(m.source,authority.source))throw Error('Playable source identity changed.');
 if(!/^[a-f0-9]{40,64}$/.test(m.source.baseCommit)||!/^[a-f0-9]{40,64}$/.test(m.source.headCommit)||!hash(m.source.fingerprint))throw Error('Invalid playable source fingerprint or commit.');
 fields(m.build,['program','args']);list(m.build.args,1);fields(m.toolchain,['name','version']);if(m.build.program!=='node'||m.build.args.length!==1||m.toolchain.name!=='node'||!/^24\.\d+\.\d+$/.test(m.toolchain.version))throw Error('Unsupported playable build description or toolchain.');relative(m.build.args[0]);relative(m.entrypoint);
 list(m.environment,0);list(m.artifacts,LIMITS.count);if(!m.artifacts.length)throw Error('Playable artifacts missing.');const paths=new Set();for(const a of m.artifacts){fields(a,['path','sha256']);relative(a.path);const key=a.path.toLowerCase();if(paths.has(key)||!hash(a.sha256))throw Error('Duplicate playable path or invalid hash.');paths.add(key);}
 if(!m.artifacts.some(a=>a.path===m.entrypoint)||!m.artifacts.some(a=>a.path===m.build.args[0])||!sameSource([...m.artifacts].sort((a,b)=>a.path.localeCompare(b.path)),[...m.source.artifactHashes].sort((a,b)=>a.path.localeCompare(b.path))))throw Error('Playable entrypoint or complete source artifact hashes missing.');
 for(const [key,max] of [['requiredCheckIds',1000],['limitations',32]]){list(m[key],max);if(m[key].some(v=>!text(v,key==='limitations'?2000:200))||new Set(m[key]).size!==m[key].length)throw Error('Invalid playable '+key);}if(!m.requiredCheckIds.length)throw Error('Playable required checks missing.');return m;
}
function validatePlayableArtifact(a,mission){fields(a,['id','kind','missionId','projectId','attemptId','runId','workspaceId','producerTaskId','producer','filePath','sha256','bytes','source','recordedAt']);if(a.kind!=='playable'||!['id','missionId','projectId','attemptId','runId','workspaceId','producerTaskId','producer'].every(k=>text(a[k]))||a.missionId!==mission.id||a.projectId!==mission.projectId||a.runId!==mission.runId||!mission.attempts.some(v=>v.id===a.attemptId&&v.taskIds.includes(a.producerTaskId))||!hash(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<1||a.bytes>LIMITS.manifest||!Number.isSafeInteger(a.recordedAt)||a.recordedAt<0)throw Error('Invalid saved playable artifact identity.');relative(a.filePath);require('./supervision-schema.cjs').validateSource(a.source);}
function inspectPlayableBytes({project,workspace,manifest,authority}){
 if(!workspace||workspace.legacy||workspace.integration!==true||workspace.projectId!==project?.id||workspace.runId!==authority?.runId||workspace.id!==authority?.workspaceId||!['ready','active'].includes(workspace.state))throw Error('Playable needs an exact managed integration workspace.');
 const read=readBinary(workspace.canonicalRoot,manifest.filePath,LIMITS.manifest);if(!hash(manifest.sha256)||read.sha256!==manifest.sha256)throw Error('Playable manifest bytes changed.');let m;try{m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(read.content));}catch{throw Error('Playable manifest must be valid UTF-8 JSON.');}validateManifest(m,authority);
 let total=0;const artifacts=m.artifacts.map(a=>{const actual=readBinary(workspace.canonicalRoot,a.path);total+=actual.bytes;if(total>LIMITS.total||actual.sha256!==a.sha256)throw Error('Playable artifact bytes changed or exceed total bounds.');return {path:a.path,sha256:actual.sha256,bytes:actual.bytes};});
 // Repeat the set to catch mutations of an earlier file while a later one is read.
 for(const a of artifacts)if(readBinary(workspace.canonicalRoot,a.path).sha256!==a.sha256)throw Error('Playable artifacts changed during inspection.');if(readBinary(workspace.canonicalRoot,manifest.filePath,LIMITS.manifest).sha256!==read.sha256)throw Error('Playable manifest changed during inspection.');
 return {sha256:read.sha256,bytes:read.bytes,source:structuredClone(m.source),artifacts,manifest:structuredClone(m),summary:{source:structuredClone(m.source),build:structuredClone(m.build),runtime:m.runtime,toolchain:m.toolchain.name+' '+m.toolchain.version,entrypoint:m.entrypoint,artifactCount:artifacts.length,totalBytes:total,limitations:[...m.limitations]}};
}
async function inspectPlayableManifest({project,workspace,manifest,authority,evidence=new (require('./mission-evidence.cjs').MissionEvidence)()}){
 const original=project.originalProject||project;await require('./execution-workspaces.cjs').verifyWorkspace(workspace,original);const expected=JSON.stringify({workspace,authority}),before=await evidence.gitState(workspace.canonicalRoot);
 const current=s=>!s.dirty&&s.commit===authority.source.headCommit&&s.fingerprint===authority.source.fingerprint;if(!current(before))throw Error('Playable source is dirty or stale.');
 const proof=inspectPlayableBytes({project,workspace,manifest,authority});await require('./execution-workspaces.cjs').verifyWorkspace(workspace,original);const after=await evidence.gitState(workspace.canonicalRoot);if(!current(after)||expected!==JSON.stringify({workspace,authority}))throw Error('Playable source changed during inspection.');return proof;
}
function evaluateCandidate({run,source,tasks}){
 if(!run?.verification)return {eligible:false,blockers:['Missing independent source verification.']};
 const evaluation=evaluateReadiness({run,...run.verification,source,reviews:run.reviews||[],tasks});
 // Only the evidence obtained through the first validation launch may be absent.
 const blockers=evaluation.blockers.filter(b=>!/^Missing passing playable evidence: |^Missing manifest check: /.test(b));return {eligible:!blockers.length,blockers};
}
module.exports={LIMITS,readBinary,validateManifest,validatePlayableArtifact,inspectPlayableBytes,inspectPlayableManifest,evaluateCandidate};
