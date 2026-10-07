'use strict';
// Fixed child of copied-profile-native.c. Its stdout/stderr and TEMP are private
// from process creation. Direct invocation earns no native completion receipt.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function main(){
 if(process.argv.length!==3||process.versions.electron!=='44.4.3'||process.versions.node!=='24.21.0'||!path.isAbsolute(process.argv[2]))throw Error('CAPTURE_WORKER_ADMISSION');
 const requestBytes=fs.readFileSync(process.argv[2]);if(requestBytes.length>16384)throw Error('CAPTURE_WORKER_ADMISSION');const request=JSON.parse(requestBytes);
 assert.deepEqual(Object.keys(request).sort(),['generationRoot','nonce','sourceRoot']);
 assert.match(request.nonce,/^[a-f0-9]{64}$/);assert.equal(request.nonce,process.env.SUNNY_FIXTURE_NONCE);
 assert.equal(process.argv[2],path.join(request.generationRoot,'control','request.json'));
 for(const root of [request.sourceRoot,request.generationRoot])assert.ok(path.isAbsolute(root));
 const baseline=path.join(request.generationRoot,'baseline'),working=path.join(request.generationRoot,'working'),control=path.join(request.generationRoot,'control');
 assert.deepEqual(fs.readdirSync(baseline),[]);assert.deepEqual(fs.readdirSync(working),[]);
 const archiveBytes=fs.readFileSync(path.join(request.generationRoot,'acquisition','chatgpt-history.json'));
 const archive=require('../desktop/local-history-archive.cjs').decodeArchive(archiveBytes);
 const image=await require('../desktop/copied-database.cjs').backupDatabase(path.join(request.sourceRoot,'sunny.sqlite'),path.join(baseline,'sunny.sqlite'));
 fs.writeFileSync(path.join(baseline,'chatgpt-history.json'),archive.raw,{flag:'wx',mode:0o600});
 const descriptor=name=>{const original=fs.readFileSync(path.join(baseline,name));fs.copyFileSync(path.join(baseline,name),path.join(working,name),fs.constants.COPYFILE_EXCL);assert.deepEqual(fs.readFileSync(path.join(working,name)),original);return {bytes:original.length,sha256:sha(original)};};
 const database=descriptor('sunny.sqlite'),auxiliary=descriptor('chatgpt-history.json');
 assert.deepEqual(require('../desktop/copied-database.cjs').readDatabaseImage(path.join(working,'sunny.sqlite')),image);
 assert.deepEqual(require('../desktop/local-history-archive.cjs').decodeArchive(fs.readFileSync(path.join(working,'chatgpt-history.json'))).value,archive.value);
 const probe=new(require('node:sqlite').DatabaseSync)(path.join(baseline,'sunny.sqlite'),{readOnly:true,allowExtension:false,timeout:0});let sqlite;try{sqlite=probe.prepare('SELECT sqlite_version() AS version').get().version;}finally{probe.close();}assert.equal(sqlite,'3.53.4');
 // Full source transaction projection is private evidence, not a public digest.
 fs.writeFileSync(path.join(control,'source-projection.private.json'),JSON.stringify(image),{flag:'wx',mode:0o600});
 fs.writeFileSync(path.join(control,'capture-receipt.json'),JSON.stringify({version:1,stage:'logical-verified',nonceSha256:sha(request.nonce),fidelity:'sqlite-database',fullTree:false,archiveStatus:'present-verified',database,archive:auxiliary,runtime:{electron:process.versions.electron,node:process.versions.node,sqlite}}),{flag:'wx',mode:0o600});
 fs.writeFileSync(path.join(control,'fixture.json'),JSON.stringify({version:1,nonce:request.nonce,profileDir:working,outputDir:path.join(request.generationRoot,'consumer-output'),scenario:'stopped-profile-copy',phase:1,mib:1}),{flag:'wx',mode:0o600});
}
main().catch(error=>{console.error(error);process.exitCode=31;});
