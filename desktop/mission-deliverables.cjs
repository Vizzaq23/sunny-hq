const fs=require('node:fs'),path=require('node:path');const {createHash}=require('node:crypto');
const LIMIT=256*1024;
function readDeliverable(root,input){
 if(typeof input!=='string'||!input||input.length>1000||path.isAbsolute(input)||/[\0:]/.test(input))throw Error('Choose a project-relative Markdown or text file.');
 const parts=input.split(/[\\/]/);if(parts.some(part=>!part||part==='.'||part==='..'||['.git','.codex','.agents','.ssh'].includes(part.toLowerCase())||part.toLowerCase().startsWith('.env')))throw Error('Protected or invalid deliverable path.');
 if(!['.md','.txt'].includes(path.extname(input).toLowerCase()))throw Error('Written deliverables support .md and .txt files.');
 const base=fs.realpathSync(root);let file=base;
 for(const part of parts){file=path.join(file,part);if(fs.lstatSync(file).isSymbolicLink())throw Error('Deliverable links are not supported.');}
 if(!fs.lstatSync(file).isFile())throw Error('Deliverable must be a regular file.');
 const fd=fs.openSync(file,'r');
 try{
  const before=fs.fstatSync(fd);if(before.nlink!==1)throw Error('Hard-linked deliverables are not supported.');if(!before.isFile()||before.size>LIMIT)throw Error('Deliverable must be a regular file up to 256 KB.');
  const buffer=Buffer.alloc(LIMIT+1);let bytes=0,count;
  while(bytes<buffer.length&&(count=fs.readSync(fd,buffer,bytes,buffer.length-bytes,null))>0)bytes+=count;
  const after=fs.fstatSync(fd);if(after.nlink!==1)throw Error('Hard-linked deliverables are not supported.');if(bytes>LIMIT||before.size!==bytes||before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error('Deliverable changed while reading or exceeds 256 KB.');
  const content=buffer.subarray(0,bytes);let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(content);}catch{throw Error('Deliverable must contain valid UTF-8 text.');}
  if(text.includes('\0'))throw Error('Binary deliverables cannot be reviewed as text.');
  return {kind:'deliverable',filePath:parts.join('/'),bytes,sha256:createHash('sha256').update(content).digest('hex'),recordedAt:Date.now(),text};
 }finally{fs.closeSync(fd);}
}
module.exports={readDeliverable};
