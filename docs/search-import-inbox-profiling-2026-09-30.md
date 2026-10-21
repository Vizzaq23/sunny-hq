# Search, briefing import and inbox profiling

2026-09-30. Scope: the isolated follow-up checkout, starting at `5b70fb2`, Node 24.18.0 on Windows. All filesystem measurements use generated files under a newly allocated Temp directory, removed after each run. No registered user projects, real Downloads, provider, feed, profile or credentials were read.

## Findings and corrections

The former `desktop/main.cjs` search checked `seen > 4000` only when entering recursion. A flat 5,000-file directory read all 5,000 files; a 50-by-100 nested fixture read 4,100. A fixture containing 5,000 empty directories performed 5,001 directory reads because directories never consumed the file budget. Automated regressions failed on those exact behaviors and on the absence of event-loop timer progress before the correction.

`desktop/project-search.cjs` now performs asynchronous filesystem operations, with a global 4,000-file budget and a new explicit 4,000-directory budget including the root. It retains depth 10, at most 100 matching lines, the existing 256,000-byte file threshold, case-insensitive text matching and 200-character snippets. The main-process caller continues to enforce project registration and query validation and supplies the existing excluded-folder set. Traversal order follows filesystem enumeration as before; reaching a budget returns a partial result without introducing a new renderer contract.

Async I/O creates more opportunities for replacement while awaiting a filesystem operation. The helper checks directory metadata and canonical containment; files use `lstat`, canonical containment, no-follow opening where supported, descriptor identity/size/mtime checks, an original-size-plus-one-byte read, and a final identity/path recheck. Replacement, outside-directory junction and file-growth regressions failed against the initial async version, then passed against the bounded descriptor implementation. This protects the tested replacement windows; it is not a claim of atomic filesystem snapshots under arbitrary hostile concurrent parent-directory changes.

The former inbox scanner selected the newest 100 names before checking prior fingerprints. With 101 completed captures carrying unique URLs, successive scans added 100, 0 and 0 stories, permanently starving the oldest capture. The scanner now rotates up to 100 candidate inspections per call, including unchanged candidates. Its ephemeral cursor is associated with the caller's per-inbox `seen` Map and remembers a filename boundary, so deleted cursor names do not break rotation. A stable directory is covered within `ceil(candidateCount / 100)` scans. New or modified files may wait for their batch; this is not an immediate-import guarantee. Rotation restarts after process restart. It retains settling time, size and item limits, URL validation, descriptor checks, symbolic-link exclusion and once-per-fingerprint error suppression. No persistence schema changes.

No bug was demonstrated in `News.importCapture`; it remains unchanged.

## Measurements

Reproduce with `node scripts/benchmark-search-import-inbox.cjs`. The benchmark loads baseline search from Git revision `5b70fb2` without starting Electron, compares it to the current helper, and executes imports/inbox scans against isolated in-memory News state. Results are in [comparison JSON](evidence/search-import-inbox-comparison-2026-09-30.json). The [initial baseline JSON](evidence/search-import-inbox-baseline-2026-09-30.json) records the first read-only investigation.

Each scenario has nine warm-filesystem trials. Below, timer delay is the dispatch delay of a zero-delay timer queued immediately before an operation; it measures whether the operation permits other event-loop work to start. It is not a `monitorEventLoopDelay` histogram or a full packaged-IPC latency measurement. With nine observations, reported p95 is the largest sample. Runs have machine/cache/scheduling variability and are evidence of these fixtures rather than universal latency guarantees.

| Fixture | Baseline elapsed p50/p95 ms | Async elapsed p50/p95 ms | Baseline timer p50/p95 ms | Async timer p50/p95 ms | Work count |
| --- | --- | --- | --- | --- | --- |
| 4,000 flat files, 4 KiB | 259.18 / 265.92 | 2,232.28 / 2,295.89 | 259.30 / 265.96 | 1.36 / 1.64 | Both read 4,000 files |
| 5,000 flat files, 4 KiB | 318.25 / 347.58 | 2,177.51 / 2,215.52 | 318.37 / 347.60 | 1.70 / 2.04 | 5,000 baseline; 4,000 async |
| 5,000 nested files, 4 KiB | 267.45 / 271.85 | 2,274.78 / 2,346.33 | 267.47 / 271.87 | 0.44 / 1.06 | 4,100 baseline; 4,000 async |
| 100 flat files, 256,000 bytes | 44.35 / 45.22 | 91.30 / 94.31 | 44.38 / 45.24 | 0.63 / 0.88 | Both read 25.6 MB |
| 5,000 empty directories | 243.14 / 247.51 | 1,103.92 / 1,130.37 | 243.28 / 247.55 | 1.59 / 1.84 | 5,001 baseline; 4,000 async directory reads |

The async version takes longer overall, especially with descriptor and canonical-path checks on each file, while allowing timers to run during the traversal. It does not promise sub-100-ms search completion. Memory from a single `readdir` listing remains proportional to that directory's entry count; directory enumeration is asynchronous but no new streaming directory API or worker architecture was introduced.

Importing 50 validated stories from a JSON input of exactly 524,288 bytes took 0.48 / 1.22 ms p50/p95. Importing a new 50-story batch into an already full 500-story archive rejected atomically and retained 500 items (0.18 / 0.25 ms). An inbox containing 5,000 irrelevant entries and 100 distinct completed briefings imported 100 stories in 12.62 / 21.05 ms, with 100 descriptor opens, 200 `lstat` checks and 618,590 bytes read. An unchanged rescan took 3.52 / 3.80 ms, with 100 pre-read metadata checks and no descriptor reads. Inbox directory enumeration and sorting still depend on directory size, while expensive candidate inspection stays capped at 100 per call.

## Verification and rollback

Focused verification: nine project-search regressions passed; seven inbox regressions and eight existing news tests passed. The parent coordinator owns full-suite, build, packaged-IPC and complete-diff gates. No dependency installation, provider call or production scan was used in this lane.

Rollback consists of reverting the main-process helper integration and `desktop/project-search.cjs`, then reverting the inbox rotation change. Saved News state and `seen` fingerprints retain their existing schema; the new cursor is ephemeral.
