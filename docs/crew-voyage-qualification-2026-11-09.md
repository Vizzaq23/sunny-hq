# Crew voyage qualification — 2026-11-09

Branch: `codex/finish-crew-voyage-20261108`, isolated checkout `.sunny-dev/voyage-bar-m4`. M7 is the last planned delivery stage. M4–M7 are locally implemented; this does not satisfy the separate M3 live-journey and release prerequisites.

## Final clean candidate — passed

Candidate **`ccb702cfbdfd411372563665d06ed38c4bb34149`** passed the complete clean Windows validation and all **18/18** contained package cases. Every package case confirmed cleanup. The [final qualification receipt](evidence/crew-voyage-2026-11-09/final-qualification.json) records exact source/build/package hashes, checks, timings and screenshot hashes.

- Node 24.18.0 locked installation and Electron 44.4.3 installation passed.
- **1,794 tests passed**, zero failures, skips or cancellations; full suite 1,569.487 seconds.
- Build/typecheck passed in 17.547 seconds. Clean build fingerprint: `7a3fcc070574e65f36fda0efa62b667f9ef502353c05ff399779a578a12e37eb`.
- **124 native checks passed**: 68 core plus M4 17, M5 13, M6 11 and M7 15.
- Package matrix passed all nine recovery cases, ordered controls at 1/10/30 MiB, run UI, playable results, continuous synthetic journey, user/system reduced motion and audio. At 30 MiB, Stop p95 was **93.8 ms** and approval p95 **139.4 ms**, with zero operation failures and the unchanged 200 ms limit.
- The packaged world fixture recorded 67 cases and 112 samples with no reported errors. All three enlarged quarters station controls were reachable. Final M5 disclosure, M6 table, M7 preview and scrolled 200% station captures were visually inspected and saved beside the receipt. Earlier compact idle/working/reduced-motion views were also inspected.

Raw final baseline: `.sunny-dev/pr-validation/2026-11-09T05-28-41.703Z`. Raw package matrix: `.sunny-dev/final-world-qualification`. The package matrix finished at `2026-11-09T06:05:07.674Z`. Documentation/evidence-only commits after this candidate do not claim a new binary validation. The older failures and partial checkpoints below are retained history, not outstanding local failures.

## Combined implementation baseline

Clean candidate `f84feacfab44de0488f7dfebeeb05c2c5a2b8959` passed Node 24.18.0 locked installation, all **1,794 tests** (zero failed/skipped/cancelled), build/typecheck and **68** hidden native workflow checks. Full tests took 1,582.510 seconds. Build fingerprint: `1a6aec694aac3a044ccd7a90d58f2c29fe939607ee8dd39a45f0d0beaecbd47d`. Raw receipt: `.sunny-dev/pr-validation/2026-11-09T04-43-59.851Z/summary.json` inside the isolated checkout.

Same-build supplementary fixtures passed **56 checks**: M4 17, M5 13, M6 11, M7 15. M5 covers three recorded handoffs, bounded retained payloads, attributed predecessor output, separate source/check receipts, refresh, keyboard disclosure, focus/draft preservation, scoped navigation, historical/missing evidence, compact/200% and motion preferences. See each milestone's implementation document for contracts and limits.

The exact unpacked package passed **17/18** contained cases, with cleanup observed for all 18. Recovery, playable, continuous synthetic journey, user/system motion and audio passed. Ordered-control 30 MiB passed the unchanged 200 ms limit: Stop p95 **157.2 ms**, approval p95 **183.7 ms**, zero operation failures. This result is specific to that package/run; it does not establish a causal performance improvement or a live-provider pass. Raw matrix: `.sunny-dev/final-voyage-layout-qualification/summary.json`.

## Responsive world correction

The remaining packaged `run-ui` failure was real: at 1000×700, the persistent voyage bar reduced the scroll surface while the island viewport retained a fixed 570 px height. Only 73.1% was visible, below the existing 80% requirement. After correcting the map, the same check exposed clipped quarters actor contact. An initial room-sizing correction then crowded labels at 200% text enlargement. All failed receipts remain in ignored scratch; assertions and thresholds remain unchanged.

Use the existing flex-sized journey surface as a CSS size container. Bound the map viewport to its available height minus the existing 24 px scroll padding on both sides; retain its pannable world canvas. Fit quarters and Franky's full 3:2 canvases to the same available height without changing image bytes, atlas cells, actor coordinates or foot anchors. Quarters retain an `em`-based lower bound on their maximum width so enlarged text gets room and may scroll vertically. A fixed window-height subtraction was rejected because the navigation and voyage bar wrap differently with text size.

No schema, dependency, authority or persistence change is involved. Rollback removes the four CSS adjustments. Build/typecheck and 42 focused world/motion regressions passed during diagnosis. Fresh final native/package qualification is required before claiming the corrected candidate passed.

An exploratory package download failed with HTTP 504 before UI execution. Subsequent isolated packaging uses the already installed, locked Electron 44.4.3 distribution; no daily installation is replaced.

## Still outside local fixture acceptance

- Hosted retry of workflow `42546982692` was accepted by GitHub, but all three new jobs failed before any steps. The connector did not expose current annotations; the earlier billing/spending annotation is not asserted as the new cause.
- Separately admitted stopped-profile evidence, a continuous live-provider journey and human acceptance remain prerequisites. `LIVE_SUPERVISION_ADMITTED` stays false.
- The old chat's HTTP 400 local-router rejection is not repaired by these application changes. Work was recovered in this continuation; its exact upstream cause remains unknown.
- No installation, push, merge, release, billing change or live gate opening occurred. Screen-reader testing remains unperformed.

The final exploratory responsive-world run passed packaged run-ui in 94.458 seconds with cleanup observed, including text enlargement and positive motion controls. Selected compact/working/reduced-motion captures were inspected and saved with hashes under [evidence](evidence/crew-voyage-2026-11-09/layout-exploratory.json). The final fixture additionally checks each enlarged quarters station remains reachable and captures the scrolled labels. Clean-candidate qualification follows this checkpoint.
