const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createHash}=require('node:crypto');
const {readLocalSource}=require('../desktop/local-source.cjs');
function project(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-local-source-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
test('source previews retain exact line numbers and full-file provenance within an excerpt budget',t=>{
 const root=project(t),text=Array.from({length:200},(_,i)=>`const value${i} = ${i};`).join('\r\n');fs.writeFileSync(path.join(root,'sample.ts'),text);
 const preview=readLocalSource(root,'sample.ts',10);
 assert.equal(preview.filePath,'sample.ts');assert.equal(preview.startLine,10);assert.equal(preview.endLine,129);assert.equal(preview.totalLines,200);assert.equal(preview.truncated,true);
 assert.match(preview.text,/^10: const value9 = 9;/);assert.equal(preview.sha256,createHash('sha256').update(text).digest('hex'));assert.ok(preview.text.length<=6000);assert.ok(preview.recordedAt<=Date.now());
 assert.throws(()=>readLocalSource(root,'sample.ts',201),/beyond/);assert.throws(()=>readLocalSource(root,'sample.ts',1.5),/starting line/);
});
test('source reader rejects protected paths, traversal and filename aliases before reading',t=>{
 const root=project(t);
 for(const name of ['../outside.ts','.git/config.json','.env.json','.aws/config.json','node_modules/package/index.js','secrets.json','.secrets.json','src/credentials.json','src/service-account.json','src /file.ts','src./file.ts','C:\\file.ts','PROGRA~1/file.ts','private.key','.vscode/settings.json'])assert.throws(()=>readLocalSource(root,name),undefined,name);
 fs.mkdirSync(path.join(root,'.github'));fs.writeFileSync(path.join(root,'.github','workflow.yml'),'name: fixture');assert.match(readLocalSource(root,'.github/workflow.yml').text,/fixture/);
});
test('invalid UTF-8, binary content, oversized files and unbounded lines cannot become previews',t=>{
 const root=project(t),file=path.join(root,'sample.ts');
 fs.writeFileSync(file,Buffer.from([0xff,0xfe]));assert.throws(()=>readLocalSource(root,'sample.ts'),/UTF-8/);
 fs.writeFileSync(file,'text\0binary');assert.throws(()=>readLocalSource(root,'sample.ts'),/Binary/);
 fs.writeFileSync(file,'x'.repeat(256*1024+1));assert.throws(()=>readLocalSource(root,'sample.ts'),/size limit/);
 fs.writeFileSync(file,'x'.repeat(6001));assert.throws(()=>readLocalSource(root,'sample.ts'),/too long/);
});
test('source previews cannot follow hard links or directory links',t=>{
 const root=project(t),outside=project(t);fs.writeFileSync(path.join(outside,'private.ts'),'private source');
 fs.linkSync(path.join(outside,'private.ts'),path.join(root,'alias.ts'));assert.throws(()=>readLocalSource(root,'alias.ts'),/Hard-linked/);
 fs.symlinkSync(outside,path.join(root,'linked'),process.platform==='win32'?'junction':'dir');assert.throws(()=>readLocalSource(root,'linked/private.ts'),/links/);
});
