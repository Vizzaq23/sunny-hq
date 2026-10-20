const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const catalog=require('../desktop/catalog.cjs');

function fixture(t){
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-catalog-'));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  return home;
}
function makeDir(directory){fs.mkdirSync(directory,{recursive:true});return directory;}
function write(file,text=''){makeDir(path.dirname(file));fs.writeFileSync(file,text,'utf8');return file;}

test('project discovery is shallow, stable, friendly, categorized, and linked to vault notes',t=>{
  const home=fixture(t);
  makeDir(path.join(home,'Documents','GitHub','my-portfolio','.git'));
  makeDir(path.join(home,'Documents','GitHub','my-site','.git'));
  makeDir(path.join(home,'Documents','GitHub','AdpativeShooter','Assets'));
  write(path.join(home,'OneDrive','Documents','GitHub','course-lab','package.json'),'{}');
  makeDir(path.join(home,'OneDrive','Documents','ChatGPT','ai aaim balncer','Assets'));
  makeDir(path.join(home,'OneDrive','Documents','ChatGPT','game','Assets'));
  makeDir(path.join(home,'Documents','GitHub','group','too-deep','.git'));
  write(path.join(home,'Documents','Obsidian','Applied AI Studio','10 Projects','Portfolio.md'),'# Portfolio');
  write(path.join(home,'Documents','Obsidian','Applied AI Studio','10 Projects','Fitness Coaching Website.md'),'# Fitness Coaching Website');
  write(path.join(home,'Documents','Obsidian','Applied AI Studio','10 Projects','AI Aim Balancer.md'),'# AI Aim Balancer');

  const first=catalog.discoverProjects(home);
  const second=catalog.discoverProjects(home);
  const portfolio=first.find(project=>project.path===path.join(home,'Documents','GitHub','my-portfolio'));
  const fitness=first.find(project=>project.path===path.join(home,'Documents','GitHub','my-site'));
  const adaptive=first.find(project=>project.path===path.join(home,'Documents','GitHub','AdpativeShooter'));
  const aimBalancer=first.find(project=>project.path===path.join(home,'OneDrive','Documents','ChatGPT','ai aaim balncer'));
  const course=first.find(project=>project.path===path.join(home,'OneDrive','Documents','GitHub','course-lab'));
  const game=first.find(project=>project.path===path.join(home,'OneDrive','Documents','ChatGPT','game'));

  assert.deepEqual(
    [portfolio?.name,portfolio?.category,portfolio?.notePath],
    ['Portfolio','development',path.join(home,'Documents','Obsidian','Applied AI Studio','10 Projects','Portfolio.md')]
  );
  assert.deepEqual(
    [fitness?.name,fitness?.notePath],
    ['Fitness Coaching Website',path.join(home,'Documents','Obsidian','Applied AI Studio','10 Projects','Fitness Coaching Website.md')]
  );
  assert.deepEqual(
    [adaptive?.name,adaptive?.notePath],
    ['AI Aim Balancer',path.join(home,'Documents','Obsidian','Applied AI Studio','10 Projects','AI Aim Balancer.md')]
  );
  assert.equal(aimBalancer?.name,'AI Aim Balancer');
  assert.notEqual(adaptive?.id,aimBalancer?.id);
  assert.equal(second.find(project=>project.path===adaptive.path).id,adaptive.id);
  assert.equal(second.find(project=>project.path===aimBalancer.path).id,aimBalancer.id);
  assert.equal(course?.category,'learning');
  assert.deepEqual([game?.name,game?.category],['Cosmic Contraband','game']);
  assert.equal(first.some(project=>project.path.endsWith(path.join('group','too-deep'))),false);
  assert.equal(second.find(project=>project.path===portfolio.path).id,portfolio.id);
  assert.equal(first.some(project=>project.path===path.resolve(process.cwd())),true);
});

test('module location is added only for a source checkout outside app.asar',t=>{
  const home=fixture(t);
  const install=makeDir(path.join(home,'installed-app'));
  makeDir(path.join(install,'desktop'));
  fs.copyFileSync(path.join(__dirname,'..','desktop','catalog.cjs'),path.join(install,'desktop','catalog.cjs'));
  fs.copyFileSync(path.join(__dirname,'..','desktop','core.cjs'),path.join(install,'desktop','core.cjs'));
  write(path.join(install,'package.json'),'{}');
  const installedCatalog=require(path.join(install,'desktop','catalog.cjs'));
  assert.equal(installedCatalog.discoverProjects(home).some(project=>project.path===install),false);
  makeDir(path.join(install,'src'));
  assert.equal(installedCatalog.discoverProjects(home).some(project=>project.path===install),true);

  const packaged=makeDir(path.join(home,'resources','app.asar'));
  makeDir(path.join(packaged,'desktop'));
  makeDir(path.join(packaged,'src'));
  fs.copyFileSync(path.join(__dirname,'..','desktop','catalog.cjs'),path.join(packaged,'desktop','catalog.cjs'));
  fs.copyFileSync(path.join(__dirname,'..','desktop','core.cjs'),path.join(packaged,'desktop','core.cjs'));
  write(path.join(packaged,'package.json'),'{}');
  const packagedCatalog=require(path.join(packaged,'desktop','catalog.cjs'));
  assert.equal(packagedCatalog.discoverProjects(home).some(project=>project.path===packaged),false);
});

test('project discovery ignores an immediate symlink that escapes a scan root',t=>{
  const home=fixture(t);
  const root=makeDir(path.join(home,'Documents','GitHub'));
  const outside=makeDir(path.join(home,'outside-project'));
  makeDir(path.join(outside,'.git'));
  try{fs.symlinkSync(outside,path.join(root,'linked'),'junction');}
  catch(error){t.skip(`junction unavailable: ${error.code}`);return;}
  assert.equal(catalog.discoverProjects(home).some(project=>project.path===path.join(root,'linked')),false);
});

test('vaultPath resolves the Applied AI Studio vault location',t=>{
  const home=fixture(t);
  const vault=makeDir(path.join(home,'Documents','Obsidian','Applied AI Studio'));
  assert.equal(catalog.vaultPath(home),vault);
});

test('tool discovery reports only present desktop tools, shortcuts, skills, and configured MCP names',t=>{
  const home=fixture(t);
  const previousPath=process.env.PATH;
  const previousProgramFiles=process.env.ProgramFiles;
  const previousProgramFilesX86=process.env['ProgramFiles(x86)'];
  process.env.PATH='';
  process.env.ProgramFiles=path.join(home,'Program Files');
  process.env['ProgramFiles(x86)']=path.join(home,'Program Files (x86)');
  t.after(()=>{
    process.env.PATH=previousPath;
    process.env.ProgramFiles=previousProgramFiles;
    process.env['ProgramFiles(x86)']=previousProgramFilesX86;
  });
  const docker=write(path.join(home,'AppData','Local','Docker','Docker','resources','bin','docker.exe'));
  makeDir(path.join(home,'.agents','skills','review-security'));
  makeDir(path.join(home,'.codex','skills','imagegen'));
  makeDir(path.join(home,'.codex','skills','.system','internal-skill'));
  write(path.join(home,'.codex','config.toml'),[
    '[mcp_servers.github]',
    'token = "DO_NOT_EXPOSE"',
    '[mcp_servers."design helper"]',
    'api_key = "ALSO_SECRET"',
    '[unrelated]',
    'password = "NOPE"'
  ].join('\n'));

  const tools=catalog.discoverTools(home);
  assert.equal(tools.find(tool=>tool.id==='docker')?.path,docker);
  assert.equal(tools.some(tool=>tool.id==='unity'),false);
  assert.deepEqual(
    tools.filter(tool=>tool.category==='Website').map(tool=>tool.status),
    Array(11).fill('opens externally')
  );
  assert.equal(tools.find(tool=>tool.name==='review-security')?.status,'installed');
  assert.equal(tools.find(tool=>tool.name==='imagegen')?.status,'installed');
  assert.equal(tools.some(tool=>tool.name==='.system'),false);
  assert.equal(tools.find(tool=>tool.name==='github')?.status,'configured');
  assert.equal(tools.find(tool=>tool.name==='design helper')?.status,'configured');
  assert.equal(JSON.stringify(tools).includes('DO_NOT_EXPOSE'),false);
  assert.equal(JSON.stringify(tools).includes('ALSO_SECRET'),false);
});

test('automation discovery returns metadata without prompts or logs',t=>{
  const home=fixture(t);
  write(path.join(home,'.codex','automations','morning','automation.toml'),[
    'id = "brief-1"',
    'name = "Morning Brief"',
    'status = "ACTIVE"',
    'rrule = "FREQ=DAILY;BYHOUR=8"',
    'prompt = "PRIVATE PROMPT"'
  ].join('\n'));
  write(path.join(home,'.codex','automations','morning','run.log'),'PRIVATE LOG');

  const automations=catalog.discoverAutomations(home);
  assert.deepEqual(automations,[{id:'brief-1',name:'Morning Brief',status:'ACTIVE',schedule:'FREQ=DAILY;BYHOUR=8'}]);
  assert.equal(JSON.stringify(automations).includes('PRIVATE'),false);
});

test('library search scans Markdown case-insensitively and excludes private vault sections',t=>{
  const home=fixture(t);
  const vault=makeDir(path.join(home,'Documents','Obsidian','Applied AI Studio'));
  write(path.join(vault,'10 Projects','Alpha.md'),'# Alpha Project\n\nA concise Sunny architecture decision.');
  write(path.join(vault,'10 Projects','Beta.md'),'No heading here\n\nSUNNY appears in this note.');
  write(path.join(vault,'.obsidian','private.md'),'Sunny secret');
  write(path.join(vault,'70 Attachments','attachment.md'),'Sunny attachment');
  write(path.join(vault,'80 Templates','template.md'),'Sunny template');
  write(path.join(vault,'99 Archive','old.md'),'Sunny archived');
  write(path.join(vault,'10 Projects','binary.md'),'Sunny\0binary');

  const results=catalog.searchLibrary(home,'sunny');
  assert.deepEqual(results.map(result=>result.path),[
    path.join('10 Projects','Alpha.md'),
    path.join('10 Projects','Beta.md')
  ]);
  assert.deepEqual(results.map(result=>result.title),['Alpha Project','Beta']);
  assert.equal(results[0].excerpt.includes('Sunny architecture'),true);
  assert.deepEqual(catalog.searchLibrary(home,'   '),[]);
});

test('library search rejects symlinked Markdown outside the vault',t=>{
  const home=fixture(t);
  const vault=makeDir(path.join(home,'Documents','Obsidian','Applied AI Studio','10 Projects'));
  const outside=makeDir(path.join(home,'outside'));
  write(path.join(outside,'linked.md'),'# Outside\nSunny should stay outside.');
  try{fs.symlinkSync(outside,path.join(vault,'linked'),'junction');}
  catch(error){t.skip(`junction unavailable: ${error.code}`);return;}
  assert.deepEqual(catalog.searchLibrary(home,'sunny'),[]);
});

test('getExecutable resolves supported commands from PATH without a shell',t=>{
  const home=fixture(t);
  const bin=makeDir(path.join(home,'bin'));
  const gh=write(path.join(bin,'gh.exe'));
  const previous=process.env.PATH;
  const previousProgramFiles=process.env.ProgramFiles,previousProgramFilesX86=process.env['ProgramFiles(x86)'];
  process.env.ProgramFiles=path.join(home,'Program Files');
  process.env['ProgramFiles(x86)']=path.join(home,'Program Files (x86)');
  process.env.PATH=bin;
  t.after(()=>{process.env.PATH=previous;for(const [key,value] of [['ProgramFiles',previousProgramFiles],['ProgramFiles(x86)',previousProgramFilesX86]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}});

  assert.equal(catalog.getExecutable('gh',home),gh);
  assert.equal(catalog.getExecutable('unsupported',home),null);
});

test('coverage response distinguishes unavailable vault and keeps the legacy array contract',t=>{
 const home=fixture(t);assert.deepEqual(catalog.searchLibrary(home,'needle'),[]);assert.throws(()=>catalog.searchLibrary(home,'needle',true),/vault is unavailable/);
 const vault=makeDir(catalog.vaultPath(home));write(path.join(vault,'Alpha.md'),'# Alpha\nneedle');write(path.join(vault,'Large.md'),'needle'+ 'x'.repeat(1024*1024));
 const result=catalog.searchLibrary(home,'needle',true);assert.equal(result.results.length,1);assert.equal(result.scanned,2);assert.equal(result.skipped,1);assert.equal(result.partial,true);assert.deepEqual(catalog.searchLibrary(home,'needle'),result.results);
 assert.deepEqual(catalog.searchLibrary(home,'',true),{results:[],scanned:0,partial:false,skipped:0});
});
