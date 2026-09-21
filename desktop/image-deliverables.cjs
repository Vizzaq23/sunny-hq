const {readProjectFile}=require('./mission-deliverables.cjs');
function readImageDeliverable(root,input,decode=buffer=>require('electron').nativeImage.createFromBuffer(buffer)){
 const {content,...metadata}=readProjectFile(root,input,{extensions:['.png'],limit:8*1024*1024});
 if(content.length<33||!content.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||content.readUInt32BE(8)!==13||content.toString('ascii',12,16)!=='IHDR')throw Error('Choose a valid PNG image.');
 const width=content.readUInt32BE(16),height=content.readUInt32BE(20);if(!width||!height||width>4096||height>4096)throw Error('Image dimensions must be within 4096 × 4096 pixels.');
 const pixelChunks=[content.subarray(0,8)];let offset=8,ended=false,data=false,chunks=0;while(offset<content.length){
  if(++chunks>4096)throw Error('PNG has too many chunks for bounded preview.');
  if(offset+12>content.length)throw Error('Truncated PNG chunk.');const size=content.readUInt32BE(offset),type=content.toString('ascii',offset+4,offset+8);if(size>content.length-offset-12)throw Error('Truncated PNG content.');
  if(['acTL','fcTL','fdAT'].includes(type))throw Error('Animated PNG files are not supported.');
  if(type==='IHDR'&&offset!==8)throw Error('Duplicate PNG header.');if(type==='IDAT')data=true;
  if(['IHDR','PLTE','tRNS','IDAT','IEND'].includes(type))pixelChunks.push(content.subarray(offset,offset+size+12));else if(/^[A-Z]/.test(type))throw Error('Unsupported PNG critical chunk.');
  offset+=size+12;if(type==='IEND'){if(size!==0||offset!==content.length)throw Error('Invalid PNG end.');ended=true;break;}
 }
 if(!ended||!data)throw Error('Incomplete PNG image.');
 // Strip ancillary metadata before native decoding, including compressed profiles/text.
 const image=decode(Buffer.concat(pixelChunks));if(!image||image.isEmpty())throw Error('PNG could not be decoded.');const actual=image.getSize();if(actual.width!==width||actual.height!==height)throw Error('Decoded image dimensions do not match the PNG header.');
 const preview=image.toPNG();if(!preview.length||preview.length>32*1024*1024)throw Error('Image preview exceeds the size limit.');
 return {kind:'image',...metadata,width,height,mimeType:'image/png',dataUrl:'data:image/png;base64,'+preview.toString('base64')};
}
function imageProvenance(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['source','usage'].includes(k)))throw Error('Add image source and usage notes.');
 const result={};for(const key of ['source','usage']){if(typeof value[key]!=='string'||!value[key].trim()||value[key].length>2000||value[key].includes('\0'))throw Error('Add bounded image source and usage notes.');result[key]=value[key].trim();}
 return result;
}
module.exports={readImageDeliverable,imageProvenance};
