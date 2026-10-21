const fs = require('node:fs');
const path = require('node:path');

// The caller validates query shape and registered project membership.
async function searchProjectFiles(root, query, { skipped = new Set(), fileSystem = fs.promises } = {}) {
 const results = [];
 const needle = query.toLowerCase();
 let filesVisited = 0;
 let directoriesVisited = 0;
 const canonicalRoot = await fileSystem.realpath(root);
 function contained(candidate) { const relative = path.relative(canonicalRoot, candidate); return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`); }
 function unchanged(before, after) { return after.isFile() && !after.isSymbolicLink() && before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mtimeMs === after.mtimeMs; }
 async function boundedText(target) {
  const before = await fileSystem.lstat(target);
  if (!before.isFile() || before.isSymbolicLink() || before.size > 256000) return null;
  const canonicalFile = await fileSystem.realpath(target);
  if (!contained(canonicalFile)) return null;
  const handle = await fileSystem.open(target, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  let content;
  try {
   if (!unchanged(before, await handle.stat()) || await fileSystem.realpath(target) !== canonicalFile) return null;
   const buffer = Buffer.alloc(before.size + 1);
   let offset = 0;
   while (offset < buffer.length) { const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, null); if (!bytesRead) break; offset += bytesRead; }
   if (offset !== before.size) return null;
   content = buffer.toString('utf8', 0, offset);
  } finally { await handle.close(); }
  if (!unchanged(before, await fileSystem.lstat(target)) || await fileSystem.realpath(target) !== canonicalFile) return null;
  return content;
 }
 function exhausted() { return filesVisited >= 4000 || directoriesVisited >= 4000 || results.length >= 100; }
 async function walk(directory, depth) {
  if (depth > 10 || exhausted()) return;
  directoriesVisited++;
  const metadata = await fileSystem.lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) return;
  const canonicalDirectory = await fileSystem.realpath(directory);
  if (!contained(canonicalDirectory)) return;
  const entries = await fileSystem.readdir(canonicalDirectory, { withFileTypes: true });
  for (const entry of entries) {
   // File and directory budgets apply across all recursion levels and siblings.
   if (filesVisited >= 4000 || results.length >= 100) break;
   if (skipped.has(entry.name) || entry.isSymbolicLink() || entry.name.startsWith('.env')) continue;
   const target = path.join(canonicalDirectory, entry.name);
   if (entry.isDirectory()) {
    if (directoriesVisited >= 4000) continue;
    await walk(target, depth + 1);
   } else {
    filesVisited++;
    try {
     const content = await boundedText(target);
     if (content === null || content.includes('\0')) continue;
     const lines = content.split('\n');
     for (let index = 0; index < lines.length && results.length < 100; index++) {
      if (lines[index].toLowerCase().includes(needle)) results.push({ path: target, line: index + 1, text: lines[index].slice(0, 200) });
     }
    } catch { /* Preserve best-effort behavior for unreadable files. */ }
   }
  }
 }
 await walk(root, 0);
 return results;
}

module.exports = { searchProjectFiles };
