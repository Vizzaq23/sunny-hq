const fs=require('node:fs');const path=require('node:path');const {createHash}=require('node:crypto');const {execFileSync}=require('node:child_process');
const extensions=new Set(['.cjs','.mjs','.js','.jsx','.ts','.tsx','.json','.css','.html','.svg','.png','.webp','.jpg','.jpeg','.gif','.ico','.mp3','.wav','.ogg','.woff','.woff2','.ttf']);
const files=['package.json','package-lock.json','index.html','vite.config.ts','tsconfig.json','scripts/write-build-info.cjs'];
function sourceInputs(root){
 const inputs=[];
 function add(relative){const file=path.join(root,relative);if(!fs.existsSync(file))return;const stat=fs.lstatSync(file);if(stat.isSymbolicLink())return;if(stat.isDirectory()){for(const entry of fs.readdirSync(file).sort())if(!entry.startsWith('.')&&entry!=='node_modules')add(path.join(relative,entry));}else if(extensions.has(path.extname(file).toLowerCase()))inputs.push(relative);}
 for(const relative of [...files,'desktop','src','public'])add(relative);
 return inputs.sort();
}
function writeBuildInfo(root){
 const hash=createHash('sha256');for(const relative of sourceInputs(root)){const data=fs.readFileSync(path.join(root,relative));hash.update(relative.split(path.sep).join('/'));hash.update('\0'+data.length+'\0');hash.update(data);}
 let sourceCommit='unknown',sourceDirty=null;
 const gitScope=['-c','safe.directory='+fs.realpathSync(root).split(path.sep).join('/')];
 try{
  // A copied export inside another checkout does not own that checkout's revision.
  const top=execFileSync('git',[...gitScope,'rev-parse','--show-toplevel'],{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore'],timeout:5000}).trim();
  const canonical=value=>{const resolved=fs.realpathSync(value);return process.platform==='win32'?resolved.toLowerCase():resolved;};
  if(canonical(top)!==canonical(root))throw Error('Source root is not the repository root.');
  const commit=execFileSync('git',[...gitScope,'rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore'],timeout:5000}).trim();if(/^[a-f0-9]{40,64}$/.test(commit))sourceCommit=commit;sourceDirty=!!execFileSync('git',[...gitScope,'status','--porcelain','--untracked-files=normal'],{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore'],timeout:5000}).trim();}catch{}
 const info={appVersion:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,buildId:hash.digest('hex'),fingerprintKind:'source-inputs-sha256',sourceCommit,sourceDirty};
 fs.mkdirSync(path.join(root,'dist'),{recursive:true});fs.writeFileSync(path.join(root,'dist','build-info.json'),JSON.stringify(info,null,2)+'\n','utf8');return info;
}
if(require.main===module){const info=writeBuildInfo(path.resolve(__dirname,'..'));console.log('SUNNY_BUILD '+JSON.stringify(info));}
module.exports={writeBuildInfo};
