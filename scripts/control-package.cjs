// Controller-side packed byte inspection only; archive entries are never executed.
const {ENTRIES,FIXTURE,PROTOCOL,sha}=require('../desktop/control-receipts.cjs');
function packageProof(archive,identity){
 const asar=require('@electron/asar');asar.uncache(archive);
 const read=file=>{const stat=asar.statFile(archive,file,false);if(stat.link||stat.unpacked||!Number.isSafeInteger(stat.size)||stat.size<=0||stat.size>64*1024*1024)throw Error('Invalid fixed packed control asset');const bytes=asar.extractFile(archive,file,false);if(bytes.length!==stat.size)throw Error('Packed asset size changed');return bytes;};
 const entries=Object.fromEntries(ENTRIES.map(file=>[file,sha(read(file))]));
 if(entries[ENTRIES[2]]!==FIXTURE||entries[ENTRIES[3]]!==PROTOCOL)throw Error('Frozen control bytes changed');
 const built=asar.listPackage(archive).map(file=>file.replaceAll('\\','/').replace(/^\//,'')).filter(file=>file.startsWith('dist/')&&!asar.statFile(archive,file,false).files).sort().map(file=>({file,sha256:sha(read(file))}));
 if(!built.some(item=>item.file==='dist/index.html'))throw Error('Packaged renderer missing');
 const buildInfo=JSON.parse(read('dist/build-info.json'));
 return {kind:'exact-package',entries,buildInfo,built,builtDigest:sha(JSON.stringify(built)),fixtureSha256:FIXTURE,protocolSha256:PROTOCOL,...identity,sourceDigest:sha(JSON.stringify({entries,...identity}))};
}
module.exports={packageProof};
