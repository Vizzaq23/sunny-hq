const fs=require('node:fs');const path=require('node:path');const {execFile}=require('node:child_process');const {promisify}=require('node:util');const runFile=promisify(execFile);const {randomUUID}=require('node:crypto');const {inside}=require('./core.cjs');
const same=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
async function git(root,args){const physical=canonical(root);const stamp=identity(root);const result=(await runFile('git',args,{cwd:root,encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:4*1024*1024})).stdout.trim();if(!same(canonical(root),physical)||identity(root)!==stamp)throw Error('Workspace identity changed during Git operation.');return result;}
function identity(root){return [root,path.join(root,'.git')].map(file=>{const stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw Error('Workspace metadata is a symbolic alias.');return [stat.dev,stat.ino,stat.birthtimeMs,stat.isFile()?fs.readFileSync(file,'utf8'):null];}).map(JSON.stringify).join(':');}
function canonical(root){const resolved=path.resolve(root),physical=fs.realpathSync(resolved);if(!same(resolved,physical))throw Error('Workspace root is a junction or symbolic alias.');return physical;}
async function common(root){return fs.realpathSync(path.resolve(root,await git(root,['rev-parse','--git-common-dir'])));}
async function verifyWorkspace(ref,project){
 if(!ref||ref.projectId!==project.id||!['ready','active'].includes(ref.state))throw Error('Execution workspace is missing or unresolved.');
 const root=canonical(ref.canonicalRoot);if(ref.legacy){if(!same(root,canonical(project.path)))throw Error('Original workspace changed.');return;}
 const stamp=identity(root),metadata=metadataSignature(ref);if(same(root,canonical(project.path))||!same(await common(root),ref.gitCommonDir)||!same(await common(project.path),ref.gitCommonDir))throw Error('Workspace Git ownership changed.');
 if((await git(root,['rev-parse','--show-toplevel'])).toLowerCase()!==root.replace(/\\/g,'/').toLowerCase())throw Error('Workspace root changed.');
 if((await git(root,['branch','--show-current']))!==ref.branch)throw Error('Workspace branch ownership changed.');
 if(!/^[a-f0-9]{40,64}$/.test(ref.baseCommit)||await git(root,['rev-parse',ref.baseCommit+'^{commit}'])!==ref.baseCommit)throw Error('Workspace base changed.');
 await git(root,['merge-base','--is-ancestor',ref.baseCommit,'HEAD']);if(!same(canonical(ref.canonicalRoot),root)||!same(await common(root),ref.gitCommonDir)||identity(root)!==stamp||metadataSignature(ref)!==metadata)throw Error('Workspace changed during verification.');
}
function resolveExecutionRoot(selection,state){
 if(!selection||Object.keys(selection).some(k=>!['projectId','taskId','workspaceId','runId'].includes(k))||Object.values(selection).some(v=>typeof v!=='string'||!v||v.length>200||v.includes('\0')))throw Error('Invalid execution selection.');
 const project=state.projects.find(p=>p.id===selection.projectId);if(!project)throw Error('Registered project is missing.');
 const task=selection.taskId?state.tasks.find(t=>t.id===selection.taskId):undefined;if(selection.taskId&&(!task||task.projectId!==project.id))throw Error('Execution task membership changed.');
 const runId=selection.runId||task?.runId,workspaceId=selection.workspaceId||task?.workspaceId;
 if(task&&(selection.runId&&selection.runId!==task.runId||selection.workspaceId&&selection.workspaceId!==task.workspaceId))throw Error('Execution task workspace changed.');
 if(!runId&&!workspaceId){const ref={id:'original:'+project.id,projectId:project.id,canonicalRoot:canonical(project.path),legacy:true,state:'ready'};return ref;}
 const run=state.runs.find(r=>r.id===runId&&r.projectId===project.id),ref=run?.workspaces.find(w=>w.id===workspaceId);
 if(!ref||ref.runId!==run.id||task&&(!ref.assignmentId||ref.assignmentId!==task.assignmentId||!run.assignments.some(a=>a.id===task.assignmentId&&a.taskId===task.id&&a.workspaceId===ref.id)))throw Error('Exact managed workspace binding is missing.');
 if(run.workspaces.some(w=>w.id!==ref.id&&same(w.canonicalRoot,ref.canonicalRoot)))throw Error('Workspace case alias collision.');if(!['ready','active'].includes(ref.state)||!same(canonical(ref.canonicalRoot),ref.canonicalRoot))throw Error('Execution workspace is unresolved.');return structuredClone(ref);
}
async function createWorkspace({project,runId,assignmentId,baseCommit,kind},deps){
 if(!['worker','integration'].includes(kind)||!project?.id||!runId||(kind==='worker'&&!assignmentId)||(kind==='integration'&&assignmentId)||!/^[a-f0-9]{40,64}$/.test(baseCommit)||typeof deps.persist!=='function')throw Error('Invalid managed workspace creation.');
 const original=canonical(project.path),gitCommonDir=await common(original);let sourceRoot=original;if(deps.sourceProject?.executionWorkspace){const held=deps.sourceProject.executionWorkspace;if(held.integration!==true||held.runId!==runId||held.projectId!==project.id)throw Error('Workspace creation source binding changed');await verifyWorkspace(held,project);sourceRoot=canonical(held.canonicalRoot);}if((await git(sourceRoot,['status','--porcelain'])).length)throw Error('A clean committed base is required.');if((await git(sourceRoot,['rev-parse','HEAD']))!==baseCommit)throw Error('Committed base changed.');
 fs.mkdirSync(deps.storageRoot,{recursive:true});const storage=canonical(deps.storageRoot);if(/(^|[\\/])OneDrive(?:[ -][^\\/]*)?([\\/]|$)/i.test(storage)||inside(original,storage)||inside(storage,original))throw Error('Managed storage must be local and separate from the original project.');
 const id=randomUUID(),root=path.join(storage,id),ref={id,projectId:project.id,runId,...(kind==='integration'?{integration:true}:{assignmentId}),canonicalRoot:root,gitCommonDir,branch:'codex/sunny-'+id,baseCommit,state:'reserved',creationIntent:{id:randomUUID(),time:Date.now(),state:'pending'}};
 if((deps.workspaces||[]).some(w=>same(w.canonicalRoot,root)))throw Error('Workspace root is already reserved.');
 await deps.persist(structuredClone(ref)); // No Git effects precede the durable reservation.
 try{if(!same(canonical(deps.storageRoot),storage)||!same(await common(original),gitCommonDir)||await git(sourceRoot,['rev-parse','HEAD'])!==baseCommit||(await git(sourceRoot,['status','--porcelain'])).length)throw Error('Workspace creation source changed during persistence.');deps.beforeEffect?.();await git(original,['worktree','add','-b',ref.branch,root,baseCommit]);ref.state='ready';ref.creationIntent.state='completed';await verifyWorkspace(ref,project);await deps.persist(structuredClone(ref));await verifyWorkspace(ref,project);return ref;}
 catch(error){ref.state='unknown';ref.creationIntent.state='unknown';try{await deps.persist(structuredClone(ref));}catch(cause){error.persistenceCause=cause;}throw error;}
}
function metadataSignature(ref){const root=canonical(ref.canonicalRoot),gitFile=fs.readFileSync(path.join(root,'.git'),'utf8');const match=/^gitdir: (.+)\s*$/.exec(gitFile);if(!match)throw Error('Managed Git metadata changed.');const gitDir=fs.realpathSync(path.resolve(root,match[1]));const files=[path.join(gitDir,'HEAD'),path.join(gitDir,'commondir'),path.join(ref.gitCommonDir,'packed-refs'),path.join(ref.gitCommonDir,...('refs/heads/'+ref.branch).split('/'))];return JSON.stringify([identity(root),gitDir,...files.map(file=>fs.existsSync(file)?fs.readFileSync(file,'utf8'):null)]);}
module.exports={resolveExecutionRoot,createWorkspace,verifyWorkspace,canonical,same,metadataSignature};
