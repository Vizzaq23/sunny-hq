const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const helperPath = path.join(__dirname, '../desktop/project-search.cjs');
const skipped = new Set(['.git', 'node_modules', '.next', 'dist', 'release', '.sunny-dev', '.obsidian', '70 Attachments', '99 Archive', '80 Templates']);
function fixture(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sunny-project-search-test-')); t.after(() => { assert.equal(path.dirname(dir), path.resolve(os.tmpdir())); fs.rmSync(dir, { recursive: true, force: true }); }); return dir; }
function runner(counts) {
 const wrap = target => new Proxy(target, { get(object, key) { if (!['readdir', 'stat', 'readFile', 'open'].includes(key)) return object[key]; return (...args) => { counts[key] = (counts[key] || 0) + 1; return object[key](...args); }; } });
 const { searchProjectFiles } = require(helperPath); return (root, query) => searchProjectFiles(root, query, { skipped, fileSystem: wrap(fs.promises) });
}
test('search stops at exactly 4000 files across flat siblings', async t => {
 const dir = fixture(t), counts = {}; for (let i = 0; i < 5000; i++) fs.writeFileSync(path.join(dir, `${String(i).padStart(5, '0')}.txt`), i < 4000 ? 'no match' : 'needle');
 const result = await runner(counts)(dir, 'needle'); assert.equal(result.length, 0); assert.equal(counts.open || counts.readFile, 4000);
});
test('search stops globally across nested directory siblings', async t => {
 const dir = fixture(t), counts = {}; for (let group = 0; group < 50; group++) { const folder = path.join(dir, `group-${String(group).padStart(3, '0')}`); fs.mkdirSync(folder); for (let i = 0; i < 100; i++) fs.writeFileSync(path.join(folder, `${i}.txt`), 'no match'); }
 await runner(counts)(dir, 'needle'); assert.equal(counts.open || counts.readFile, 4000); assert.equal(counts.readdir, 41);
});
test('empty directory traversal stops at 4000 visits including the root', async t => {
 const dir = fixture(t), counts = {}; for (let i = 0; i < 5000; i++) fs.mkdirSync(path.join(dir, `${i}`));
 await runner(counts)(dir, 'needle'); assert.equal(counts.readdir, 4000);
});
test('file search yields to the event loop during a large traversal', async t => {
 const dir = fixture(t), counts = {}; for (let i = 0; i < 100; i++) fs.writeFileSync(path.join(dir, `${i}.txt`), 'no match');
 let ticks = 0; const timer = setInterval(() => ticks++, 1); try { await runner(counts)(dir, 'needle'); } finally { clearInterval(timer); } assert.ok(ticks > 0, 'Timers should run before traversal completes');
});
test('preserves matching lines, text truncation, exclusions, binary and size limits', async t => {
 const dir = fixture(t), counts = {}; fs.writeFileSync(path.join(dir, 'valid.txt'), `first\nNeedle ${'x'.repeat(300)}\nlast`); fs.writeFileSync(path.join(dir, 'binary.txt'), 'needle\0'); fs.writeFileSync(path.join(dir, 'large.txt'), 'needle'.padEnd(256001, 'x')); fs.writeFileSync(path.join(dir, '.env.local'), 'needle'); fs.mkdirSync(path.join(dir, 'node_modules')); fs.writeFileSync(path.join(dir, 'node_modules', 'secret.txt'), 'needle');
 const result = await runner(counts)(dir, 'NEEDLE'); assert.equal(result.length, 1); assert.equal(result[0].path, path.join(dir, 'valid.txt')); assert.equal(result[0].line, 2); assert.equal(result[0].text.length, 200);
});
test('retains the 100 matching-line cap and propagates unavailable roots', async t => {
 const dir = fixture(t); fs.writeFileSync(path.join(dir, 'many.txt'), 'needle\n'.repeat(200)); assert.equal((await runner({})(dir, 'needle')).length, 100);
 await assert.rejects(async () => runner({})(path.join(dir, 'missing'), 'needle'), { code: 'ENOENT' });
});
test('rejects a file replaced between metadata validation and opening', async t => {
 const dir = fixture(t), file = path.join(dir, 'candidate.txt'); fs.writeFileSync(file, 'original');
 const io = new Proxy(fs.promises, { get(target, key) { if (!['open', 'readFile'].includes(key)) return target[key]; return async (...args) => { fs.renameSync(file, path.join(dir, 'removed.txt')); fs.writeFileSync(file, 'needle from replacement'); return target[key](...args); }; } });
 const { searchProjectFiles } = require(helperPath); assert.equal((await searchProjectFiles(dir, 'needle', { fileSystem: io })).length, 0);
});
test('does not follow a directory replaced by an outside junction during traversal', async t => {
 const dir = fixture(t), outside = fixture(t), folder = path.join(dir, 'folder'); fs.mkdirSync(folder); fs.writeFileSync(path.join(outside, 'outside.txt'), 'needle');
 const io = new Proxy(fs.promises, { get(target, key) { if (key !== 'readdir') return target[key]; return async (...args) => { const entries = await target.readdir(...args); if (args[0] === dir) { fs.rmdirSync(folder); try { fs.symlinkSync(outside, folder, process.platform === 'win32' ? 'junction' : 'dir'); } catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('Directory links unavailable'); fs.mkdirSync(folder); } else throw error; } } return entries; }; } });
 const { searchProjectFiles } = require(helperPath); assert.equal((await searchProjectFiles(dir, 'needle', { fileSystem: io })).length, 0);
});
test('limits bytes read when a validated file grows during reading', async t => {
 const dir = fixture(t), file = path.join(dir, 'candidate.txt'); fs.writeFileSync(file, 'original'); let requested = 0;
 const io = new Proxy(fs.promises, { get(target, key) { if (key === 'readFile') return async (...args) => { fs.appendFileSync(file, 'needle'.repeat(50000)); requested = fs.statSync(file).size; return target.readFile(...args); }; if (key !== 'open') return target[key]; return async (...args) => { const handle = await target.open(...args); return { async stat() { const result = await handle.stat(); fs.appendFileSync(file, 'needle'.repeat(50000)); return result; }, async read(...readArgs) { requested += readArgs[2]; return handle.read(...readArgs); }, close: () => handle.close() }; }; } });
 const { searchProjectFiles } = require(helperPath); const result = await searchProjectFiles(dir, 'needle', { fileSystem: io }); assert.equal(result.length, 0); assert.ok(requested <= 9, 'Read at most original size plus one growth-detection byte');
});
