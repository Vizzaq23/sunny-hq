# Sunny reconciliation repair

The interrupted captain could not continue because reconciling an already stopped child threw “No active turn to interrupt.” Captain continuation also rejected unknown children without checking their current provider state.

`desktop/hub.cjs` now accepts confirmed terminal reconciliation without another interrupt, checks unknown linked assignments before continuation, and retains the checkout lock when provider state cannot be resolved. An in-progress turn overrides an inconsistent outer idle status; an unidentified active turn clears the cached turn ID rather than interrupting old work. Per-task exclusion prevents overlapping send/stop/recovery operations from starting duplicate turns or overwriting newer state.

## Verification

- Six initial regression cases: five failed before the first source change; the disconnected-read protection already passed.
- Three independent race/stale-ID findings were reproduced by new failing tests, then fixed.
- Final 105 Node tests and TypeScript checks exited 0. Source and test hashes remained unchanged; full output is in `2026-09-12-reconciliation-verification.json`. The report-writing wrapper subsequently failed printing Unicode to the Windows console; the complete saved child results were read back successfully, without rerunning or changing their disposition.
- Vite production build exited 0, with its existing large-chunk warning.
- Independent read-only reviewer reran all three original race/stale-ID reproductions against final hub SHA256 `3682c6151c1088f41e67b4ac1a00cadd9465aa80eb81b99d5d9837cd2b5415d8`: one start for concurrent sends, no stale-ID interrupt, and no send overtaking an in-flight stop. Source hash unchanged. No further introduced issue identified in this bounded review.

## Activation and remaining UI issue

Computer Use was stopped with Escape. No subsequent GUI control, live Sunny database edit, captain message, or trading assignment was performed. A separate local packaged candidate completed successfully at `C:/Users/Quintin/.cache/sunny-reconciliation-20260912/win-unpacked/Sunny HQ.exe`. The archived hub.cjs hash exactly matches the independently reviewed source; see `2026-09-12-reconciliation-package.json`. It has not been launched. The running/release app has not been replaced.

The off-screen workbench remains unverified and unchanged. Static inspection of source and the old packaged assets identifies conversation `scrollIntoView` as a plausible ancestor-scrolling cause with the long captain history. This is not an executed layout reproduction. After user resumes Computer Use, verify the long-history renderer and fix its exact layout/scrolling cause before claiming complete visual recovery. Then load the verified app update and reconcile the original captain and child through Sunny. Preserve any unsent draft.
