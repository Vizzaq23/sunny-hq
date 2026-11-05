const {readProjectFile}=require('./mission-deliverables.cjs');
const extensions=['.js','.jsx','.mjs','.cjs','.ts','.tsx','.json','.css','.scss','.html','.md','.txt','.py','.rs','.go','.java','.cs','.cpp','.c','.h','.hpp','.yaml','.yml','.toml','.sql','.sh','.ps1'];
const protectedParts=new Set(['.git','.codex','.agents','.ssh','.aws','.azure','.gcloud','.kube','.gnupg','.venv','node_modules','vendor','dist','release','.sunny-dev']);
const secretNames=/^\.?(?:credentials|secrets?|service[-_]?account)(?:[.-]|$)/i;
function readLocalSource(root,input,startLine=1){
 if(typeof input!=='string'||/[\x00-\x1f]/.test(input)||input.split(/[\\/]/).some(part=>part!==part.trim()||part.endsWith('.')||(part.startsWith('.')&&part!=='.github')||protectedParts.has(part.toLowerCase())||secretNames.test(part)))throw Error('Choose a source file outside private, dependency and generated folders.');
 if(!Number.isSafeInteger(startLine)||startLine<1||startLine>100000)throw Error('Choose a valid starting line.');
 const {content,...metadata}=readProjectFile(root,input,{extensions,limit:256*1024});
 let source;try{source=new TextDecoder('utf-8',{fatal:true}).decode(content);}catch{throw Error('Source must be valid UTF-8 text.');}
 if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(source))throw Error('Binary content cannot be attached as source.');
 const lines=source.split(/\r?\n/);if(startLine>lines.length)throw Error('Starting line is beyond the end of this file.');
 const excerpt=[];let characters=0;
 for(let index=startLine-1;index<lines.length&&excerpt.length<120;index++){
  const line=`${index+1}: ${lines[index]}`;
  if(characters+line.length+1>6000)break;
  excerpt.push(line);characters+=line.length+1;
 }
 if(!excerpt.length)throw Error('This line is too long to preview. Choose a shorter source line or paste a focused excerpt.');
 const endLine=startLine+excerpt.length-1;
 return {...metadata,startLine,endLine,totalLines:lines.length,truncated:startLine>1||endLine<lines.length,text:excerpt.join('\n')};
}
module.exports={readLocalSource};
