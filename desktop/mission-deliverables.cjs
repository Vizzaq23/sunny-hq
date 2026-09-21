const fs=require('node:fs'),path=require('node:path');const {createHash}=require('node:crypto');
function readProjectFile(root,input,{extensions,limit}){
 if(typeof input!=='string'||!input||input.length>1000||path.isAbsolute(input)||/[\0:]/.test(input))throw Error('Choose a project-relative file.');
 const parts=input.split(/[\\/]/);if(parts.some(part=>!part||part==='.'||part==='..'||['.git','.codex','.agents','.ssh'].includes(part.toLowerCase())||part.toLowerCase().startsWith('.env')))throw Error('Protected or invalid deliverable path.');
 if(!extensions.includes(path.extname(input).toLowerCase()))throw Error('Unsupported deliverable file type.');
 const base=fs.realpathSync(root);let file=base;
 for(const part of parts){file=path.join(file,part);if(fs.lstatSync(file).isSymbolicLink())throw Error('Deliverable links are not supported.');}
 if(!fs.lstatSync(file).isFile())throw Error('Deliverable must be a regular file.');
 const fd=fs.openSync(file,'r');
 try{
  const before=fs.fstatSync(fd);if(before.nlink!==1)throw Error('Hard-linked deliverables are not supported.');if(!before.isFile()||before.size>limit)throw Error('Deliverable must be a regular file up to the file size limit.');
  const buffer=Buffer.alloc(limit+1);let bytes=0,count;
  while(bytes<buffer.length&&(count=fs.readSync(fd,buffer,bytes,buffer.length-bytes,null))>0)bytes+=count;
  const after=fs.fstatSync(fd);if(after.nlink!==1)throw Error('Hard-linked deliverables are not supported.');if(bytes>limit||before.size!==bytes||before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error('Deliverable changed while reading or exceeds the file size limit.');
  const content=buffer.subarray(0,bytes);
  return {filePath:parts.join('/'),bytes,sha256:createHash('sha256').update(content).digest('hex'),recordedAt:Date.now(),content};
 }finally{fs.closeSync(fd);}
}
function readDeliverable(root,input){
 const {content,...metadata}=readProjectFile(root,input,{extensions:['.md','.txt'],limit:256*1024});
 let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(content);}catch{throw Error('Deliverable must contain valid UTF-8 text.');}
 if(text.includes('\0'))throw Error('Binary deliverables cannot be reviewed as text.');
 return {kind:'deliverable',...metadata,text};
}
module.exports={readDeliverable,readProjectFile};
