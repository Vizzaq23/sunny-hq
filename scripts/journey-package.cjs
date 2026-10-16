// Read packed bytes only. The acceptance worker never executes archive entries.
const path=require('node:path');
const {ENTRIES}=require('../desktop/journey-receipts.cjs');
function entryHashes(archive){
 const asar=require('@electron/asar'),{createHash}=require('node:crypto');asar.uncache(archive);
 return Object.fromEntries(ENTRIES.map(file=>{const stat=asar.statFile(archive,path.normalize(file),false);if(stat.link||stat.unpacked||!Number.isSafeInteger(stat.size)||stat.size<=0||stat.size>262144)throw Error('Journey entry must be bounded packed source');const bytes=asar.extractFile(archive,path.normalize(file),false);if(bytes.length!==stat.size)throw Error('Journey entry size changed');return [file,createHash('sha256').update(bytes).digest('hex')];}));
}
module.exports={entryHashes};
