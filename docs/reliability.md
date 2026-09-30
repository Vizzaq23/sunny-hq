# Bounded reliability repairs — 2026-09-30

Scope: existing Hub persistence and Codex message processing; renderer diagnosis and recovery are described in the canonical [renderer recovery document](renderer-recovery.md). No architecture replacement, state-schema migration, provider execution retry or permission expansion.

## Idle persistence failure

The reproduced defect was `Hub.savePending`: it cleared both scheduled saves before attempting persistence, then emitted an error without scheduling another attempt. When the captain stopped interacting after a failed write, the latest state remained in memory indefinitely.

A failed background save now leaves one retry timer. Retry delays are 1, 2, 4, 8, 16 and then 30 seconds; the delay remains capped at 30 seconds while the app is open. Each attempt serializes the latest authoritative state. Success clears the timer and failure streak, and shutdown cancels it before the existing final synchronous save. The initial failure remains visible without repeating the same toast on every background retry. A permanently unavailable store still cannot guarantee durability; the app does not silently report a successful save.

The retry only writes state. Mandatory synchronous persistence before provider dispatch remains in place and still rejects dispatch on save failure. Nothing resubmits a task or automatically resumes uncertain work. Fixture tests verify a real JSON StateStore eventually contains the latest idle state, one scheduled retry with backoff, successful/closed cancellation and zero provider requests.

## Provider message consumer failure

The reproduced defect was one catch covering JSON decoding and delivery to Sunny's event handlers. A valid provider message whose consumer threw was misclassified as unreadable JSON, and the client remained connected. Async consumer rejection could also escape as an unhandled rejection. Independent review additionally reproduced an exception in a diagnostic observer preventing disconnect, and a late rejected consumer from an old connection disconnecting its replacement.

Decoding and consumer delivery now have separate private-safe categories. Malformed JSON/object input produces `provider-decode-failed`; the next valid reply still correlates. A synchronous throw or asynchronous listener rejection from the current connection produces `provider-handler-failed` and follows existing disconnect recovery: pending RPCs reject with uncertain outcome, active tasks become unknown, approvals are cleared and checkout reservations remain held. Hub consumes these categories, displays a generic error and sends only the allowlisted category to local diagnostics. Raw provider stderr is not forwarded to the startup diagnostic log. Diagnostic/disconnect observers are isolated from transport cleanup, and a late consumer rejection tied to an old connection cannot disconnect a replacement.

This is bounded handling, not transactional rollback of arbitrary application callbacks. An event consumer could have changed state before throwing; reconcile authoritative provider status before continuing. No execution retry or automatic historical resumption was added.

## Evidence and limits

Tests were RED before changes and the full Node suite subsequently passed 358/358 in the shared worktree. Root coordinates final build, native fixtures, independent review and packaging. No production profile or real provider mission was used.

Aggregate serialization/persistence and full task IPC updates remain synchronous. This follow-up removes a redundant checkpoint, replaces blocking project search with guarded async I/O, and gives bounded inbox scans fair rotation; see [search/import/inbox profiling](search-import-inbox-profiling-2026-09-30.md). Their cost under the captain's real workload has not been measured. Synthetic persistence profiling is recorded below. No evidence here establishes these paths as the renderer-exit cause or justifies a broad process/data-model refactor.

## Synthetic persistence profiling and duplicate checkpoint — 2026-09-30

Source baseline `5b70fb2`; reproducible script `scripts/persistence-profile.cjs`, full raw [evidence](evidence/persistence-profile-2026-09-30.json). The fixtures contain 25/240/720 synthetic tasks, each with 40 messages of 1024 characters / 1026 UTF-8 bytes, including U+2014 (em dash, code point 8212). Direct Node code-point and byte inspection of the current generator matches all recorded fixture sizes; this validation did not rerun the benchmark. Initial compact states are 1,091,804 / 10,488,949 / 31,475,989 bytes; pretty JSON is 1,160,350 / 11,145,950 / 33,446,750 bytes. Each measured save appends 64 ASCII characters to the newest task, matching the existing task insertion order. Forty samples per case follow 3 warmups; each size/kind uses a fresh Node process and one pre-batch GC. All databases/files are disposable Temp fixtures; no real transcripts/profile/provider work.

Host: Windows x64, Node 24.18.0, Ryzen 9 9950X3D, 32 logical CPUs, 68,302,811,136 bytes RAM. SQLite 3.53.1, WAL, synchronous 2, 4096-byte pages, 1000-page auto-checkpoint; no settings changed in production. Filesystem caches were warm and other local development work could affect timing. Values below are wall-time p50/p95 in milliseconds; percentiles use nearest rank.

| Compact fixture | Compact stringify | JSON StateStore save | SQLite save | SQLite write only |
| --- | ---: | ---: | ---: | ---: |
| ~1 MiB | 2.30 /2.55 | 3.95 /4.28 | 5.96 /9.71 | 3.51 /7.06 |
| ~10 MiB | 18.87 /19.75 | 29.28 /30.48 | 72.27 /81.53 | 57.19 /65.51 |
| ~30 MiB | 49.30 /52.72 | 91.91 /98.62 | 208.69 /223.02 | 153.53 /167.02 |

All 40 large SQLite saves exceeded the 100 ms diagnostic budget; the largest was 258.12ms. Its 1 ms probe timer had p95 deadline delay 222.07ms. Large SQLite write-only calls also all exceeded 100 ms, so serialization is only part of this synchronous stall. The no-operation timer control had p95 around 14.5 ms from Windows scheduling; tiny timer delays are not pure application cost. An independent first run measured large SQLite p95=241.45ms, confirming the size-dependent effect with ordinary run-to-run variation. This establishes a synthetic main-thread stall, not the user's crash cause or the captain's actual profile size.

Peak sampled RSS for complete saves was 58.84/ 113.77/ 260.30 MiB for JSON and 62.44/ 125.81/ 288.46 MiB for SQLite at the three sizes. Heap/RSS/external/array-buffer baselines and peaks are in the evidence; sampling after an operation can miss higher transient allocations. These results do not establish an out-of-memory incident.

Five-second Hub streaming trials requested deltas every 20 ms. The no-save control delivered 161 inputs / 81 task events on this host; large SQLite delivered 137 / 68, with five saves and heartbeat deadline drift up to 217.19 ms. Aggregate heartbeat p95 stayed near 10.6 ms because only a few of the hundreds of heartbeat samples overlapped a save; the maxima and per-save timings reveal the pauses. The 1000 ms checkpoint timer is rearmed after a blocking save, so observed large SQLite starts were roughly 1.21 s apart. This is not an absolute real-time one-second delivery guarantee. Final latest transcript text persisted, and no provider request occurred.

Forced background failures used a directory blocking JSON's temporary file or SQLite `query_only` on the fixture connection. Each 10 / 30 MiB trial failed three times, then recovered on the fourth attempt after the 1 / 2 / 4-second idle backoff plus synchronous call time. Only one error was emitted per failure streak; latest state persisted with zero provider requests. Final shutdown saves are reported separately. The no-save controls intentionally do not persist and are not durability results.

A verified bounded defect was an already scheduled background save surviving a successful explicit checkpoint. Real 30 MiB SQLite timing showed a 195.56 ms changed checkpoint followed by an unnecessary 84.42 ms identical save. The regression was RED with two real StateStore writes instead of one. `Hub.persist()` now cancels existing debounce/checkpoint timers only after `store.save()` succeeds. The same fixture then made one 199.45 ms write, with latest state durable. A newer mutation still rearms persistence, continuous streaming still reaches its scheduled checkpoint, a failed explicit save retains its background save/retry, and mandatory synchronous pre-dispatch persistence remains unchanged. Focused 93 tests and the shared full 380-test run passed; root owns final integration checks.

A SQL-only experiment avoided counting unchanged row updates with a conditional UPSERT, but p95 changed only 92.24→90.89 ms. That small result did not justify changing SQL. No cache, worker store, schema change, PRAGMA weakening, fallback switch or transcript truncation was implemented.

Future architecture work requires a separate approved plan. Acceptance should cover a bounded persistence queue with latest-state coalescing, explicit awaited durability before provider dispatch, shutdown flush/failure semantics, isolated restart/corruption/uncertain-task recovery, and event-loop p95/max against representative 1 / 10 / 30 MiB states. Moving the database write alone would leave up to 53 ms of measured large serialization on main; the full serialization/write boundary and large-state memory must be evaluated. No recommendation here authorizes such a migration.
