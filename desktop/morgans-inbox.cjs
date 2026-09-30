const fs=require('node:fs');
const path=require('node:path');
const {sourceUrl}=require('./news.cjs');

const maxBytes=512*1024;
const briefingName=/^morgans-[a-z0-9-]*20\d{2}-\d{2}-\d{2}(?: \(\d+\))?\.json$/i;
// Ephemeral position belongs to the caller's existing per-inbox seen map.
// Rotate inspections, including unchanged files, so both older files and edits get a turn.
const scanPositions=new WeakMap();

function scanMorgansInbox({dir,news,seen=new Map(),now=Date.now()}){
 const result={added:0,imported:0,errors:[]};
 let entries;
 try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch(error){if(error.code!=='ENOENT')result.errors.push({file:'Downloads',message:error.message});return result;}
 const candidates=entries.filter(entry=>entry.isFile()&&!entry.isSymbolicLink()&&briefingName.test(entry.name)).sort((a,b)=>b.name.localeCompare(a.name));
 const previous=scanPositions.get(seen);
 let start=previous?.dir===dir?candidates.findIndex(entry=>entry.name.localeCompare(previous.name)<0):0;
 if(start<0)start=0;
 const batchSize=Math.min(100,candidates.length);
 if(batchSize)scanPositions.set(seen,{dir,name:candidates[(start+batchSize-1)%candidates.length].name});
 for(let index=0;index<batchSize;index++){
  const entry=candidates[(start+index)%candidates.length];
  const file=path.join(dir,entry.name);
  let fingerprint;
  try{
   const before=fs.lstatSync(file);
   if(!before.isFile()||before.isSymbolicLink()||now-before.mtimeMs<2000)continue;
   fingerprint=`${before.size}:${before.mtimeMs}`;
   if(seen.get(entry.name)===fingerprint)continue;
   if(before.size>maxBytes)throw Error('Briefing exceeds 512 KB.');
   const handle=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
   let raw,opened;
   try{
    opened=fs.fstatSync(handle);
    if(!opened.isFile()||opened.dev!==before.dev||opened.ino!==before.ino||opened.size!==before.size||opened.mtimeMs!==before.mtimeMs)continue;
    const buffer=Buffer.alloc(before.size+1);let offset=0;
    while(offset<buffer.length){const count=fs.readSync(handle,buffer,offset,buffer.length-offset,null);if(!count)break;offset+=count;}
    if(offset!==before.size)continue;
    raw=buffer.toString('utf8',0,offset);
   }
   finally{fs.closeSync(handle);}
   const after=fs.lstatSync(file);
   if(!after.isFile()||after.isSymbolicLink()||after.size!==before.size||after.mtimeMs!==before.mtimeMs)continue;
   const capture=JSON.parse(raw);
   if(!capture||typeof capture.origin!=='string'||!/^ChatGPT(?:\b|[ —-])/.test(capture.origin)){
    seen.set(entry.name,fingerprint);continue;
   }
   if(!Array.isArray(capture.items)||capture.items.length<1||capture.items.length>50)throw Error('Import 1–50 stories per capture.');
   const urls=capture.items.map(item=>sourceUrl(item?.url));
   if(urls.every(url=>news.data.items.some(existing=>existing.url===url))){seen.set(entry.name,fingerprint);continue;}
   const imported=news.importCapture(capture);
   result.added+=imported.added;result.imported++;
   seen.set(entry.name,fingerprint);
  }catch(error){
   if(fingerprint){seen.set(entry.name,fingerprint);result.errors.push({file:entry.name,message:error.message});}
  }
 }
 return result;
}

module.exports={scanMorgansInbox};
