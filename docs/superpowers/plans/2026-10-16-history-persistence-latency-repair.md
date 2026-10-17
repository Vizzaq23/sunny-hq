# History Persistence Latency Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the captain chooses that method. Implement task-by-task with one writer per subsystem. Steps use checkbox syntax for tracking.

**Goal:** Remove whole-history rewrite latency, pass unchanged 1/10/30 MiB control gates, and safely update the installed Sunny app.

**Architecture:** Preserve the ordered worker and authority barriers. Capture isolated snapshots without duplicating string bytes; transport generation-bound patches; encode unchanged JSON subtrees once; transactionally persist immutable fragments with a read-only exact-JSON compatibility view.

**Tech Stack:** Node 24, existing CommonJS desktop, built-in SQLite/crypto/worker threads, Electron 44.4.3, current test runner. No new dependency.

**Spec:** [Approved storage design](../specs/2026-10-16-history-persistence-latency-design.md), approved by the captain on October 16 after commit `ef98eb3`.

## Global Constraints

- Use `codex/integrate-local-sunny` in the existing managed integration worktree; preserve the original checkout's unrelated changes. Never merge or push main without explicit authorization.
- Stop/approval p95 below 200 ms; main timer excess at most 100 ms; frozen 1/10/30 MiB workloads, warmups, sample counts and independent raw readback remain unchanged.
- Preserve complete history, drafts, opaque fields, JSON fallback, SQLite WAL/FULL and ordered intent/receipt barriers. No success before durable commit and no automatic replay after uncertainty.
- Fragment format version 1; fragments at most 64 KiB at UTF-8-safe boundaries; patch payload at most 1 MiB, otherwise validated full replacement.
- Profile migration requires a verified backup. The active daily profile is never a test fixture. Downgrade uses a separate backup copy; never overwrite current work.
- Installed activation is already authorized, but occurs only after correctness/performance gates, normal shutdown and a hash-verified full-profile backup.
- Invoke Node/npm directly using `C:/Program Files/nodejs/node.exe` and `C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js` if the Windows npm shim fails.

## Review Focus

1. In-place transcript edits without revision bumps and task insertion/reordering must survive capture and patching (Tasks 1, 4).
2. Literal `__proto__`, empty keys, numeric-looking keys and shared references must not corrupt property order or prototypes (Tasks 1, 2).
3. UTF-8 fragment boundaries, lone surrogates and long-string appends must retain exact native JSON bytes (Task 2).
4. Active WAL contents, future formats and unexpected compatibility-view definitions must not be silently migrated or defaulted (Task 3).
5. A committed write with a lost acknowledgement must remain uncertain, and a reused/superseded patch base must never apply (Tasks 3, 4).

## File Ownership and Interfaces

One implementer owns the new persistence modules and their integration; reviews are read-only. Existing authority decisions remain in `hub.cjs` and `persistence-barriers.cjs`.

- `desktop/profile-snapshot.cjs`: `captureProfile(value) -> snapshot`, `sealProfileSnapshot(snapshot) -> sealedSnapshot`, `isSealedProfile(value) -> boolean`, `diffProfile(base,next,{baseGeneration}) -> {kind:'patch',baseGeneration,ops}|{kind:'full',baseGeneration,image}`, `applyProfileUpdate(base,update,{generation}) -> candidate`. Operations are `{op:'set'|'delete',path:Array<string|number>,value?}`. A root set replaces the entire value. Array length/reordering changes replace the affected array; same-length arrays permit indexed updates. Object key-order changes replace that object. Reject inherited paths and invalid array indices. Define own properties safely, including literal `__proto__`. Candidate application uses copy-on-write ancestors; unchanged immutable subtrees retain identity. Seal worker-owned candidates recursively with a module-private WeakSet and frozen objects, skipping already sealed subtrees. Main-process captures remain mutable for Hub candidate construction; only sealed worker candidates enter the encoder.
- `desktop/profile-json.cjs`: `encodeProfile(value,previous?) -> encoding`, where encoding exposes `fragments:Array<{id:string,bytes:Buffer}>`, `layout:Array<string>`, `stateSha256:string`, `byteLength:number`, and an internal subtree cache. IDs are SHA-256 of exact fragment bytes. Same ID/different bytes is a fatal collision. Encoding streams the full state digest in layout order without flattening.
- `desktop/fragment-store.cjs`: `openFragmentStore({file,backupDir}) -> Promise<backend>`, with `load()`, `prepare(candidate,previousEncoding?) -> prepared`, `close()`, and `durability`. `prepared` exposes `stateSha256` and `commit()`. It owns format detection, verified migration, integrity checks and the single SQLite transaction.
- `desktop/ordered-store.cjs`, `persistence-worker.cjs`: retain the public store and epoch/sequence receipt interfaces; private commit messages carry the update and base generation. Increment generation only on a committed state transition. A waiting snapshot is diffed when dispatched against the last submitted snapshot, not when queued.
- `desktop/hub.cjs`: replace only whole-profile capture in `persistedImage`; preserve synchronous isolated image ownership required by mission candidate mutations.
- `desktop/mission-profile.cjs`: retain existing authority validation/upgrade functions; expose validation for a candidate independently of monolithic serialization. JSON fallback keeps its current writer.
- `docs/reviewed-result-saving.md`: authoritative format/migration/rollback contract. `docs/reliability-baseline.md`: dated implementation and verification evidence.

### Task 1: Isolated snapshots and generation-bound patches

**Files:** Create `desktop/profile-snapshot.cjs`, `tests/profile-snapshot.test.cjs`; read existing ordered capture tests before implementation.

- [ ] Write failing tests named `captures in-place edits without task revisions`, `queued image survives caller mutation`, `patch rejects stale generation without changing base`, `preserves property order and literal prototype keys`, and `large patch falls back to full replacement`. Include task insertion/reordering, array holes, deleted properties, shared references, cycles and unsupported executable values.

```js
const submitted=captureProfile(source);
const before=JSON.stringify(submitted);
source.tasks[0].messages[0].text='later';
assert.equal(submitted.tasks[0].messages[0].text,'original');
const next=captureProfile({...submitted,opaque:{keep:true}});
const update=diffProfile(submitted,next,{baseGeneration:7});
assert.deepEqual(applyProfileUpdate(submitted,update,{generation:7}),next);
assert.throws(()=>applyProfileUpdate(submitted,update,{generation:6}));
assert.equal(JSON.stringify(submitted),before);
```

- [ ] Run `node --test tests/profile-snapshot.test.cjs`; confirm failures identify the missing behavior.
- [ ] Implement iterative value capture retaining immutable strings, bounded patch construction and copy-on-write application. Reject cyclic/executable values before any storage effect. Keep JSON-compatible undefined/non-finite handling consistent with Task 2. Capture must not freeze or mutate caller objects.
- [ ] Run the new tests; require all pass. Commit explicit module/test paths with `Add isolated profile capture and generation-bound updates`.

### Task 2: Exact incremental JSON encoding

**Files:** Create `desktop/profile-json.cjs`, `tests/profile-json.test.cjs`; consume Task 1 immutable candidates.

- [ ] Write failing exact-byte tests comparing concatenated fragments with `Buffer.from(JSON.stringify(input))`. Cover nested arrays/objects, integer-like keys, omitted object undefined, array undefined/holes, non-finite numbers, negative zero, escaping, emoji, lone surrogates, empty strings and shared references. Reject cycles/functions/symbols/BigInt rather than silently emitting unsupported data.
- [ ] Add `small edit reuses unaffected fragment bytes`, `append to long string retains complete prefix fragments`, and `changed early array element preserves later subtree fragments`. Assert every fragment is at most `64*1024` bytes, independently decodes as valid UTF-8, and the full digest equals crypto SHA-256 of native compact JSON. Verify cached subtrees cannot be reused after an in-place mutation of a non-captured input: encoder accepts only internally owned immutable candidates, enforced by its interface tests.
- [ ] Run `node --test tests/profile-json.test.cjs`; record the expected failures.
- [ ] Implement subtree serialization caches and fragment reuse. Cache by immutable owned subtree identity, not arbitrary caller references. Native scalar JSON serialization supplies escaping and numeric semantics. Stream digest in layout order; do not parse/stringify the whole profile for each changed field.
- [ ] Run both Task 1 and Task 2 tests. Commit with `Encode exact profile JSON using reusable immutable fragments`.

### Task 3: Durable fragment database and verified migration

**Files:** Create `desktop/fragment-store.cjs`, `tests/fragment-store.test.cjs`, `tests/fragment-store-recovery.test.cjs`, `tests/helpers/fragment-store-crash.cjs`; modify the persistence contract in `docs/reviewed-result-saving.md` before product code.

- [ ] Document format version 1, legacy SQLite/mission-version transitions, backup receipts, independent `state` view, failure handling and separate-profile downgrade. Record this architecture decision with alternatives in that authoritative document, linking the approved spec.
- [ ] Write failing tests for legacy migration including committed WAL contents, empty/new database, mission versions 1–3, repeat open, verified backup failure, unknown versions, corrupt layout, missing/altered fragment bytes, incompatible view SQL and old-writer refusal. Use isolated fixture files only.
- [ ] Pin physical schema: `profile_meta(id INTEGER PRIMARY KEY CHECK(id=1),format_version INTEGER,generation INTEGER,state_sha256 TEXT,layout TEXT)` and `profile_fragments(id TEXT PRIMARY KEY,value TEXT NOT NULL)`. Define a read-only `state` view that concatenates fragment TEXT by numeric index from `json_each(layout)`, retaining duplicate references and exact byte order. Validate expected schema/view definitions before reads or writes. Do not add compatibility write triggers.
- [ ] Run `node --test tests/fragment-store.test.cjs`; confirm expected failures.
- [ ] Implement read-only preflight and SQLite's online backup API to a unique backup file. Hash and independently compare the backup's complete logical state before migration. Atomically create the new representation and replace the legacy table with the compatibility view; verify exact bytes before committing migration. Reuse mission-profile backup/upgrade validation rather than dropping its verified backups.
- [ ] Implement candidate validation, encoding, insertion of missing fragments, layout/generation/digest update and deletion of only unreachable fragments in one `BEGIN IMMEDIATE` transaction. Preserve WAL/FULL, single-writer ownership and prepared/committed receipt ordering. On initialization validate all referenced bytes and the whole-state digest; fail closed on corruption.
- [ ] Add fault-injection tests at fragment insertion, layout update, before commit, after commit/before acknowledgement and cleanup. Kill only fixture children, reopen independently and assert exact old-or-new JSON/digest. Repeat each crash window three times. Assert partial migrations leave either intact legacy schema or complete new schema and preserve the verified backup.
- [ ] Run `node --test tests/fragment-store.test.cjs tests/fragment-store-recovery.test.cjs`; require all pass. Commit with `Persist profile fragments atomically with verified legacy migration`.

### Task 4: Integrate worker transport and Hub capture

**Files:** Modify `desktop/ordered-store.cjs`, `desktop/persistence-worker.cjs`, `desktop/hub.cjs`, `desktop/mission-profile.cjs`; extend `tests/ordered-store.test.cjs`, `tests/ordered-store-capture.test.cjs`, `tests/persistence-recovery.test.cjs`, `tests/persistence-barriers.test.cjs`.

- [ ] Add failing tests for native idle/queued capture, patch dispatch against the correct preceding generation, superseded background snapshots, a saturated required barrier, duplicate/stale acknowledgements, worker loss, and postMessage failure before/after forwarding. Verify a later update cannot clear a prior uncertain commit or release a reservation.
- [ ] Add a sequence with an unversioned in-place transcript edit, a task inserted at the front, a changed approval intent and a deleted optional field. Independently read `SELECT value FROM state WHERE id=1`; assert exact JSON bytes/digest and full data retention after every receipt.
- [ ] Run the focused tests and record failures. Existing tests asserting a particular `structuredClone` call count should be replaced only with stronger ownership/transport-volume assertions; preserve all original caller-mutation and queue isolation cases.
- [ ] Use `captureProfile` for Hub whole-profile images and store queue ownership. Build full/patch updates at actual dispatch. Keep first/full replacement and JSON fallback valid. Initialize transport generation from the worker's verified ready message; require matching base on every candidate.
- [ ] Use fragment storage only for SQLite. Seal each worker-owned candidate before encoding. Validate complete candidate mission authority and task bindings before the fragment commit. Replace the worker's committed image only after success; retain exact epoch/sequence/hash receipts and uncertain-state fencing. Do not change stop/approval semantics or remove their durability barriers.
- [ ] Run snapshot/encoder/fragment tests plus ordered-store, persistence, result-save, failed-launch, mission-review and copied-profile regressions. Search callers of `SqliteStore`, `SELECT value FROM state`, and `prepareOwned` to verify compatible reads and explicitly refused legacy writes; add tests for discovered consumers.
- [ ] Commit with `Integrate incremental durable profiles without weakening authority barriers`.

### Task 5: Verification, review and installed update

**Files:** Update `docs/reliability-baseline.md`, `docs/evidence/history-persistence-validation-2026-10-16.json`, README installed facts after activation. Retain raw evidence under a new `.sunny-dev/history-repair/` directory.

- [ ] Run Node 24 `npm ci` in a clean integration checkout, `npm test`, and `npm run build`. Record complete results; do not substitute targeted reruns for a claimed green full run. Run the native workflow fixture with production projection/transport.
- [ ] Commit reviewed source and build an exact clean package with the existing electron-builder configuration. Record source commit, build ID, exe/asar SHA-256 and exact paths. Do not rebuild that package while its checks run.
- [ ] Run the unchanged contained `ordered-control` supervisor separately for 1, 10 and 30 MiB, using absolute exe/asar paths and newly created empty profile/output directories with `--timeout-ms=300000`. Require all 20 Stop and 20 approval samples plus warmups, all correctness assertions, p95 <200 ms, timers <=100 ms, exact raw readback and observed process cleanup. Retain failures and investigate; no threshold/fixture changes or selection of passing batches.
- [ ] Run contained startup, renderer-crash, main-restart, worker-loss, write-failure, lost-ack, pending-approval, pending-check and normal-quit. Run `journey-cue` in isolation with the unchanged 300-second limit. Run user/OS reduced-motion fixtures and preserve compact/keyboard checks. Require supervisor acceptance and cleanup, not only screenshots.
- [ ] Obtain one independent read-only whole-branch review covering migration, patches, encoder bytes, authority ordering and test adequacy. Resolve findings with reproductions and focused reruns, rebuilding/rechecking affected package gates after product changes. Interrupt the reviewer when finished.
- [ ] Inspect the running daily app for active work; normally quit it, verify all its processes exited, and copy/hash-verify the complete closed profile to a separate dated backup. Validate migration/reopen on another copy first without provider connections. Retain the original backup untouched.
- [ ] Copy the validated package to a new durable release directory keyed by its source commit, verify exe/asar hashes, save and update the Start Menu shortcut, then launch the new app. Verify displayed build, preserved tasks/drafts/news (including Morgans stories), visible controls and normal restart. Do not launch live missions or send reports merely for verification.
- [ ] Record installed path, backup location, exact checks, clean branch/commit state and remaining limitations. Review final diff; commit documentation explicitly. If any required gate fails, preserve the existing installation and record the exact blocker instead of claiming success.

## Execution Handoff

Recommended method: native execution in this chat, one writer throughout these tightly coupled persistence interfaces, followed by an independent whole-branch review. Subagent-driven execution is available if the captain prefers separate implementation/review gates per task. The written plan awaits the captain's review and method selection; product code remains unchanged.
