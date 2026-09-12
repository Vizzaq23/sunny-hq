const fs=require('node:fs');
const path=require('node:path');
const core=require('./core.cjs');

const PROJECT_NAMES={
  'adpativeshooter':'AI Aim Balancer',
  'my-portfolio':'Portfolio',
  'my-site':'Fitness Coaching Website',
  'neetcode_submissions-':'NeetCode Submissions',
  'neetcode-submissions':'NeetCode Submissions',
  'one-piece-tcg-coach':'One Piece TCG Coach',
  'tcg':'TCG Shop',
  'ai aaim balncer':'AI Aim Balancer',
  'ai game balancer':'AI Game Balancer',
  'ai workflow':'AI Workflow',
  'game':'Cosmic Contraband'
};
const NOTE_ALIASES={
  'AI Workflow':['Sunny HQ'],
  'Portfolio':['Portfolio'],
  'TCG Shop':['TCG Shop'],
  'One Piece TCG Coach':['One Piece TCG Coach'],
  'NeetCode Submissions':['NeetCode Submissions'],
  'AI Aim Balancer':['AI Aim Balancer'],
  'AI Game Balancer':['AI Game Balancer'],
  'Cosmic Contraband':['Cosmic Contraband']
};
const EXCLUDED_VAULT_DIRS=new Set(['.obsidian','70 attachments','80 templates','99 archive']);
const WEBSITES=[
  ['github-web','GitHub','https://github.com','Source hosting and collaboration.'],
  ['vercel','Vercel','https://vercel.com/dashboard','Web deployments and hosting.'],
  ['supabase','Supabase','https://supabase.com/dashboard','Database and backend services.'],
  ['stripe','Stripe','https://dashboard.stripe.com','Payments and billing.'],
  ['sentry','Sentry','https://sentry.io','Application monitoring.'],
  ['figma','Figma','https://www.figma.com','Product design workspace.'],
  ['higgsfield','Higgsfield','https://higgsfield.ai','Creative media workspace.'],
  ['chatgpt','ChatGPT','https://chatgpt.com','AI workspace.'],
  ['gmail','Gmail','https://mail.google.com','Email.'],
  ['indeed','Indeed','https://www.indeed.com','Job search.'],
  ['google-drive','Google Drive','https://drive.google.com','Cloud files and documents.']
];

function existsFile(file){
  try{return fs.statSync(file).isFile();}catch{return false;}
}
function existsDir(directory){
  try{return fs.statSync(directory).isDirectory();}catch{return false;}
}
function normalized(file){
  const absolute=path.normalize(path.resolve(file));
  return process.platform==='win32'?absolute.toLowerCase():absolute;
}
function friendlyName(name){
  const key=name.trim().toLowerCase();
  if(PROJECT_NAMES[key])return PROJECT_NAMES[key];
  return name.replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().replace(/\b\w/g,letter=>letter.toUpperCase());
}
function safeEntries(directory){
  try{return fs.readdirSync(directory,{withFileTypes:true});}catch{return [];}
}
function projectCategory(directory,name){
  if(existsDir(path.join(directory,'Assets')))return 'game';
  if(/learn|course|study|school|tutorial|neetcode|leetcode/i.test(name))return 'learning';
  return 'development';
}
function hasGitMarker(directory){return existsDir(path.join(directory,'.git'))||existsFile(path.join(directory,'.git'));}
function isSourceCheckout(directory){
  if(directory.split(/[\\/]+/).some(part=>part.toLowerCase()==='app.asar'))return false;
  if(hasGitMarker(directory))return true;
  if(!existsFile(path.join(directory,'package.json'))||!existsDir(path.join(directory,'src')))return false;
  return true;
}

function vaultPath(home){
  const candidates=[
    path.join(home,'Documents','Obsidian','Applied AI Studio'),
    path.join(home,'OneDrive','Documents','Obsidian','Applied AI Studio'),
    path.join(home,'OneDrive','Documents','Applied AI Studio'),
    path.join(home,'Documents','Applied AI Studio')
  ];
  return candidates.find(existsDir)||candidates[0];
}

function noteForProject(home,name){
  const projectNotes=path.join(vaultPath(home),'10 Projects');
  if(!existsDir(projectNotes))return undefined;
  const aliases=new Set([name,...(NOTE_ALIASES[name]||[])].map(value=>value.toLowerCase()));
  for(const entry of safeEntries(projectNotes)){
    if(!entry.isFile()||path.extname(entry.name).toLowerCase()!=='.md')continue;
    if(aliases.has(path.basename(entry.name,'.md').toLowerCase()))return path.join(projectNotes,entry.name);
  }
  return undefined;
}

function discoverProjects(home){
  const roots=[
    path.join(home,'Documents','GitHub'),
    path.join(home,'OneDrive','Documents','GitHub'),
    path.join(home,'OneDrive','Documents','ChatGPT')
  ];
  const candidates=[];
  for(const root of roots){
    if(!existsDir(root))continue;
    for(const entry of safeEntries(root)){
      if(!entry.isDirectory()||entry.isSymbolicLink())continue;
      let directory;
      try{directory=core.guardedPath(root,entry.name);}catch{continue;}
      if(!hasGitMarker(directory)&&!existsFile(path.join(directory,'package.json'))&&!existsDir(path.join(directory,'Assets')))continue;
      candidates.push(directory);
    }
  }
  const workspace=path.resolve(__dirname,'..');
  if(isSourceCheckout(workspace))candidates.push(workspace);
  const seen=new Set();
  const projects=[];
  for(const directory of candidates){
    let real;
    try{real=fs.realpathSync(directory);}catch{continue;}
    const key=normalized(real);
    if(seen.has(key))continue;
    seen.add(key);
    const rawName=path.basename(real);
    const name=friendlyName(rawName);
    const project={
      id:`project-${core.hash(key).slice(0,16)}`,
      name,
      path:real,
      category:projectCategory(real,rawName)
    };
    const notePath=noteForProject(home,name);
    if(notePath)project.notePath=notePath;
    projects.push(project);
  }
  return projects.sort((left,right)=>left.name.localeCompare(right.name)||left.path.localeCompare(right.path));
}

function knownExecutableCandidates(name,home){
  const local=path.join(home,'AppData','Local');
  const roaming=path.join(home,'AppData','Roaming');
  const programFiles=process.env.ProgramFiles||'C:\\Program Files';
  const programFilesX86=process.env['ProgramFiles(x86)']||'C:\\Program Files (x86)';
  const candidates={
    git:[path.join(programFiles,'Git','cmd','git.exe'),path.join(programFiles,'Git','bin','git.exe'),path.join(programFilesX86,'Git','cmd','git.exe')],
    docker:[path.join(local,'Docker','Docker','resources','bin','docker.exe'),path.join(programFiles,'Docker','Docker','resources','bin','docker.exe')],
    gh:[path.join(programFiles,'GitHub CLI','gh.exe'),path.join(local,'Programs','GitHub CLI','gh.exe')],
    cursor:[path.join(local,'Programs','cursor','Cursor.exe'),path.join(local,'Programs','Cursor','Cursor.exe'),path.join(local,'Programs','cursor','resources','app','bin','cursor.cmd')],
    unity:[path.join(local,'Programs','Unity Hub','Unity Hub.exe'),path.join(programFiles,'Unity Hub','Unity Hub.exe')],
    obsidian:[path.join(local,'Obsidian','Obsidian.exe'),path.join(local,'Programs','Obsidian','Obsidian.exe'),path.join(roaming,'Obsidian','Obsidian.exe')]
  };
  return candidates[name]||[];
}
function pathNames(name){
  const base={git:['git.exe','git.cmd','git'],docker:['docker.exe','docker.cmd','docker'],gh:['gh.exe','gh.cmd','gh'],cursor:['cursor.exe','cursor.cmd','cursor'],unity:['unity.exe','Unity.exe','unity'],obsidian:['obsidian.exe','Obsidian.exe','obsidian']}[name];
  return base||[];
}
function getExecutable(name,home){
  const key=typeof name==='string'?name.toLowerCase():'';
  if(!pathNames(key).length)return null;
  for(const candidate of knownExecutableCandidates(key,home))if(existsFile(candidate))return candidate;
  const directories=(process.env.PATH||'').split(path.delimiter).map(value=>value.replace(/^"|"$/g,'')).filter(Boolean);
  for(const directory of directories){
    for(const fileName of pathNames(key)){
      const candidate=path.join(directory,fileName);
      if(existsFile(candidate))return candidate;
    }
  }
  return null;
}

function localTool(id,name,category,description,executable){
  return executable?{id,name,category,description,status:'installed',path:executable}:null;
}
function skillTools(home){
  const tools=[];
  const roots=[path.join(home,'.agents','skills'),path.join(home,'.codex','skills')];
  const seen=new Set();
  for(const root of roots){
    for(const entry of safeEntries(root)){
      if(!entry.isDirectory()||entry.isSymbolicLink())continue;
      const key=entry.name.toLowerCase();
      if(key==='.system')continue;
      if(seen.has(key))continue;
      seen.add(key);
      tools.push({id:`skill-${core.hash(key).slice(0,12)}`,name:entry.name,category:'Skill',description:'Installed local skill metadata.',status:'installed',path:path.join(root,entry.name)});
    }
  }
  return tools;
}
function unquoteTomlName(value){
  const trimmed=value.trim();
  if((trimmed.startsWith('"')&&trimmed.endsWith('"'))||(trimmed.startsWith("'")&&trimmed.endsWith("'")))return trimmed.slice(1,-1).replace(/\\"/g,'"');
  return trimmed;
}
function mcpTools(home){
  const file=path.join(home,'.codex','config.toml');
  if(!existsFile(file))return [];
  let text;
  try{if(fs.statSync(file).size>2*1024*1024)return [];text=fs.readFileSync(file,'utf8');}catch{return [];}
  const names=new Set();
  for(const line of text.split(/\r?\n/)){
    const match=line.match(/^\s*\[\s*mcp_servers\.((?:"(?:[^"\\]|\\.)*")|(?:'[^']*')|(?:[A-Za-z0-9_-]+))\s*\]\s*(?:#.*)?$/);
    if(match)names.add(unquoteTomlName(match[1]));
  }
  return [...names].sort((a,b)=>a.localeCompare(b)).map(name=>({id:`mcp-${core.hash(name.toLowerCase()).slice(0,12)}`,name,category:'MCP',description:'Configured MCP server.',status:'configured'}));
}
function discoverTools(home){
  const local=[
    localTool('cursor','Cursor','Development','Code editor.',getExecutable('cursor',home)),
    localTool('unity','Unity','Game development','Game engine and editor.',getExecutable('unity',home)),
    localTool('docker','Docker','Development','Local container tooling.',getExecutable('docker',home)),
    localTool('obsidian','Obsidian','Knowledge','Local knowledge base.',getExecutable('obsidian',home))
  ].filter(Boolean);
  const websites=WEBSITES.map(([id,name,url,description])=>({id,name,category:'Website',description,status:'opens externally',url}));
  return [...local,...websites,...skillTools(home),...mcpTools(home)];
}

function parseTomlScalar(line,key){
  const match=line.match(new RegExp(`^\\s*${key}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*"|'[^']*'|[^#\\r\\n]+?)\\s*(?:#.*)?$`));
  if(!match)return undefined;
  const raw=match[1].trim();
  if(raw.startsWith('"')){try{return JSON.parse(raw);}catch{return undefined;}}
  if(raw.startsWith("'")&&raw.endsWith("'"))return raw.slice(1,-1);
  return raw;
}
function automationMetadata(file,directoryName){
  let text;
  try{if(fs.statSync(file).size>1024*1024)return null;text=fs.readFileSync(file,'utf8');}catch{return null;}
  const metadata={};
  for(const line of text.split(/\r?\n/)){
    for(const key of ['id','name','status','rrule']){
      if(metadata[key]===undefined){const value=parseTomlScalar(line,key);if(value!==undefined)metadata[key]=value;}
    }
  }
  return {
    id:String(metadata.id||directoryName),
    name:String(metadata.name||friendlyName(directoryName)),
    status:String(metadata.status||'unknown'),
    schedule:String(metadata.rrule||'unscheduled')
  };
}
function discoverAutomations(home){
  const root=path.join(home,'.codex','automations');
  const automations=[];
  for(const entry of safeEntries(root)){
    if(!entry.isDirectory()||entry.isSymbolicLink())continue;
    const file=path.join(root,entry.name,'automation.toml');
    if(!existsFile(file))continue;
    const metadata=automationMetadata(file,entry.name);
    if(metadata)automations.push(metadata);
  }
  return automations.sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}

function markdownFiles(root){
  const files=[];
  const pending=[''];
  let visitedDirectories=0;
  let visitedEntries=0;
  while(pending.length&&files.length<500&&visitedDirectories<250&&visitedEntries<5000){
    const relativeDirectory=pending.shift();
    let directory;
    try{directory=core.guardedPath(root,relativeDirectory);}catch{continue;}
    visitedDirectories++;
    for(const entry of safeEntries(directory)){
      visitedEntries++;
      if(entry.isSymbolicLink())continue;
      const relative=path.join(relativeDirectory,entry.name);
      if(entry.isDirectory()){
        if(!EXCLUDED_VAULT_DIRS.has(entry.name.toLowerCase()))pending.push(relative);
      }else if(entry.isFile()&&path.extname(entry.name).toLowerCase()==='.md')files.push(relative);
      if(files.length>=500||visitedEntries>=5000)break;
    }
  }
  return files.sort((a,b)=>a.localeCompare(b));
}
function excerptFor(text,needle){
  const single=text.replace(/\s+/g,' ').trim();
  const adjusted=Math.max(0,single.toLowerCase().indexOf(needle.toLowerCase()));
  const start=Math.max(0,adjusted-60);
  const end=Math.min(single.length,adjusted+needle.length+120);
  return `${start?'…':''}${single.slice(start,end).trim()}${end<single.length?'…':''}`;
}
function searchLibrary(home,query){
  const needle=typeof query==='string'?query.trim():'';
  if(!needle)return [];
  const configured=vaultPath(home);
  if(!existsDir(configured))return [];
  let root;
  try{root=core.guardedPath(configured,'');}catch{return [];}
  const results=[];
  for(const relative of markdownFiles(root)){
    let file;
    try{file=core.guardedPath(root,relative);if(fs.statSync(file).size>1024*1024)continue;}catch{continue;}
    let text;
    try{text=fs.readFileSync(file,'utf8');}catch{continue;}
    if(text.includes('\0'))continue;
    const index=text.toLowerCase().indexOf(needle.toLowerCase());
    if(index<0)continue;
    const heading=text.match(/^#\s+(.+?)\s*$/m);
    results.push({path:relative,title:heading?heading[1].trim():path.basename(relative,'.md'),excerpt:excerptFor(text,needle)});
    if(results.length>=50)break;
  }
  return results;
}

module.exports={discoverProjects,vaultPath,discoverTools,discoverAutomations,searchLibrary,getExecutable};
