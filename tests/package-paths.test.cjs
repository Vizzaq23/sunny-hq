// Real packed-byte regression: no archive entry is executed and ASAR is not mocked.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createHash}=require('node:crypto'),asar=require('@electron/asar');
const journey=require('../desktop/journey-receipts.cjs');
const control=require('../desktop/control-receipts.cjs');
const {entryHashes}=require('../scripts/journey-package.cjs');
const {packageProof}=require('../scripts/control-package.cjs');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('package helpers hash actual nested ASAR entries while preserving slash receipt keys',async t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-package-paths-'));
 const source=path.join(temp,'source'),archive=path.join(temp,'app.asar');
 t.after(()=>{asar.uncache(archive);fs.rmSync(temp,{recursive:true,force:true});});
 const files=new Map([...new Set([...journey.ENTRIES,...control.ENTRIES])].map(file=>[file,Buffer.from(`fixture bytes: ${file}\n`)]));
 // The controller intentionally admits only these frozen fixture/protocol bytes.
 for(const file of [control.ENTRIES[2],control.ENTRIES[3]])files.set(file,fs.readFileSync(path.join(__dirname,'..',file)));
 const buildInfo={revision:'test-revision',label:'nested ASAR regression'};
 files.set('dist/build-info.json',Buffer.from(JSON.stringify(buildInfo)));
 files.set('dist/index.html',Buffer.from('<!doctype html><title>ASAR fixture</title>'));
 files.set('dist/assets/nested/app.js',Buffer.from('throw Error("Archive source must never execute");'));
 for(const [file,bytes] of files){const target=path.join(source,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
 await asar.createPackage(source,archive);
 const hashes=entries=>Object.fromEntries(entries.map(file=>[file,sha(files.get(file))]));
 assert.deepEqual(entryHashes(archive),hashes(journey.ENTRIES));
 const entries=hashes(control.ENTRIES);
 const built=[...files.keys()].filter(file=>file.startsWith('dist/')).sort().map(file=>({file,sha256:sha(files.get(file))}));
 const identity={executableSha256:'a'.repeat(64),asarSha256:sha(fs.readFileSync(archive))};
 assert.deepEqual(packageProof(archive,identity),{
  kind:'exact-package',entries,buildInfo,built,builtDigest:sha(JSON.stringify(built)),
  fixtureSha256:control.FIXTURE,protocolSha256:control.PROTOCOL,...identity,
  sourceDigest:sha(JSON.stringify({entries,...identity})),
 });
});
