// Synthetic-only local benchmark. Does not inspect user projects or Downloads.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const { execFileSync } = require('node:child_process');
const { News, initialNews } = require('../desktop/news.cjs');
const { searchProjectFiles } = require('../desktop/project-search.cjs');
const mainSource = execFileSync('git', ['show', '5b70fb2:desktop/main.cjs'], { cwd: path.join(__dirname, '..'), encoding: 'utf8', windowsHide: true });
const legacySource = mainSource.match(/^function searchFiles\(.*$/m)?.[0];
if (!legacySource) throw Error('Legacy search function not found; pass a saved baseline when profiling an extracted helper.');
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sunny-search-import-inbox-'));
const skipped = new Set(['.git', 'node_modules', '.next', 'dist', 'release', '.sunny-dev', '.obsidian', '70 Attachments', '99 Archive', '80 Templates']);
let counts;
const countedFs = new Proxy(fs, { get(target, key) {
 const original = target[key];
 if (!['readdirSync', 'statSync', 'lstatSync', 'readFileSync', 'openSync', 'readSync'].includes(key)) return original;
 return (...args) => { counts[key] = (counts[key] || 0) + 1; const result = original(...args); if (key === 'readdirSync') counts.enumeratedEntries = (counts.enumeratedEntries || 0) + result.length; if (key === 'readFileSync') counts.bytesRead = (counts.bytesRead || 0) + Buffer.byteLength(result); if (key === 'readSync') counts.bytesRead = (counts.bytesRead || 0) + result; return result; };
}});
const countedAsyncFs = new Proxy(fs.promises, { get(target, key) {
 const original = target[key];
 if (!['readdir', 'stat', 'lstat', 'realpath', 'readFile', 'open'].includes(key)) return original;
 return async (...args) => { counts[key] = (counts[key] || 0) + 1; const result = await original(...args); if (key === 'readdir') counts.enumeratedEntries = (counts.enumeratedEntries || 0) + result.length; if (key === 'readFile') counts.bytesRead = (counts.bytesRead || 0) + Buffer.byteLength(result); if (key === 'open') return new Proxy(result, { get(handle, method) { if (typeof handle[method] !== 'function') return handle[method]; return async (...handleArgs) => { counts[`handle:${method}`] = (counts[`handle:${method}`] || 0) + 1; const response = await handle[method](...handleArgs); if (method === 'read') counts.bytesRead = (counts.bytesRead || 0) + response.bytesRead; return response; }; } }); return result; };
}});
const search = vm.runInNewContext(`(${legacySource})`, { fs: countedFs, path, skipped, registered: root => ({ path: root }), textArg: value => { if (typeof value !== 'string' || !value.trim()) throw Error('Invalid query'); } });
const inboxModule = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../desktop/morgans-inbox.cjs'), 'utf8'), { module: inboxModule, require: name => name === 'node:fs' ? countedFs : name === './news.cjs' ? require('../desktop/news.cjs') : require(name), Buffer });
const scanInbox = inboxModule.exports.scanMorgansInbox;
function news() { return new News({ state: { news: initialNews(), projects: [] }, changed() {} }); }
function capture(count = 50) { return { origin: 'ChatGPT synthetic fixture', items: Array.from({ length: count }, (_, index) => ({ title: `Synthetic ${index}`, url: `https://example.com/synthetic/${index}`, category: 'learning', summary: 's'.repeat(3000), why: 'w'.repeat(1500), nextStep: 'n'.repeat(1500), source: 'Fixture' })) }; }
function directory(name) { const result = path.join(fixtureRoot, name); fs.mkdirSync(result); return result; }
function files(root, count, bytes, nested = false) { const content = 'synthetic nonmatching text\n'.padEnd(bytes, 'x'); for (let index = 0; index < count; index++) { let folder = root; if (nested) { folder = path.join(root, `folder-${String(Math.floor(index / 100)).padStart(3, '0')}`); fs.mkdirSync(folder, { recursive: true }); } fs.writeFileSync(path.join(folder, `file-${String(index).padStart(5, '0')}.txt`), content); } }
function percentile(values, fraction) { return [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1]; }
async function measure(name, action, trials = 9) { const elapsed = [], delay = [], observations = []; for (let trial = 0; trial < trials; trial++) { counts = {}; const start = performance.now(); const timer = new Promise(resolve => setTimeout(() => resolve(performance.now() - start), 0)); const result = await action(); elapsed.push(performance.now() - start); delay.push(await timer); observations.push({ ...counts, resultCount: Array.isArray(result) ? result.length : result }); } return { name, trials, elapsedMs: { p50: percentile(elapsed, .5), p95: percentile(elapsed, .95) }, timerDelayMs: { p50: percentile(delay, .5), p95: percentile(delay, .95) }, counts: observations[0], countsStable: observations.every(value => JSON.stringify(value) === JSON.stringify(observations[0])) }; }
async function run() {
 const results = [];
 async function compare(name, root) { results.push(await measure(`baseline:${name}`, () => search(root, 'absent-search-token'))); results.push(await measure(`async:${name}`, () => searchProjectFiles(root, 'absent-search-token', { skipped, fileSystem: countedAsyncFs }))); }
 for (const [name, count, bytes, nested] of [['flat-4000-4KiB', 4000, 4096, false], ['flat-5000-4KiB', 5000, 4096, false], ['nested-5000-4KiB', 5000, 4096, true], ['flat-100-256000bytes', 100, 256000, false]]) { const root = directory(name); files(root, count, bytes, nested); await compare(name, root); }
 const empty = directory('empty-directories-5000'); for (let index = 0; index < 5000; index++) fs.mkdirSync(path.join(empty, `folder-${index}`)); await compare('empty-directories-5000', empty);
 const padded = capture(); padded.padding = 'p'.repeat(512 * 1024 - Buffer.byteLength(JSON.stringify(padded)) - 13); const raw = JSON.stringify(padded); results.push(await measure('import-50-near512KiB', () => news().importCapture(JSON.parse(raw)))); results[results.length - 1].inputBytes = Buffer.byteLength(raw);
 const inbox = directory('synthetic-inbox'); files(inbox, 5000, 1); for (let index = 0; index < 100; index++) { const file = path.join(inbox, `morgans-synthetic-${String(index).padStart(3, '0')}-2026-09-30.json`); const valid = capture(1); valid.items[0].url = `https://example.com/inbox/${index}`; fs.writeFileSync(file, JSON.stringify(valid)); fs.utimesSync(file, new Date(0), new Date(0)); } results.push(await measure('inbox-5000-irrelevant-100-briefings', () => scanInbox({ dir: inbox, news: news(), seen: new Map() })));
 const steadyNews = news(), steadySeen = new Map(); scanInbox({ dir: inbox, news: steadyNews, seen: steadySeen }); results.push(await measure('inbox-5100-entries-unchanged', () => scanInbox({ dir: inbox, news: steadyNews, seen: steadySeen })));
 const archive = news(); for (let batch = 0; batch < 10; batch++) { const incoming = capture(); incoming.items.forEach((item, index) => { item.url = `https://example.com/archive/${batch * 50 + index}`; }); archive.importCapture(incoming); } results.push(await measure('import-50-at500-capacity-rejected', () => { try { return archive.importCapture(capture()); } catch (error) { return { error: error.message, retainedItems: archive.data.items.length }; } }));
 console.log(JSON.stringify({ generatedAt: new Date().toISOString(), baselineRevision: '5b70fb2', node: process.version, platform: process.platform, fixtureOnly: true, method: 'Nine warm filesystem trials; timerDelay measures zero-delay timer dispatch after operation begins, not monitorEventLoopDelay distribution. p95 with n=9 is the maximum sample. Async traversal may take longer overall while allowing timer dispatch.', results }, null, 2));
}
run().finally(() => { const resolved = path.resolve(fixtureRoot); if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('sunny-search-import-inbox-')) throw Error('Unsafe cleanup target'); fs.rmSync(resolved, { recursive: true, force: true }); });
