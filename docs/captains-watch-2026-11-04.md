# Captain’s watch — 2026-11-04

Home now exposes pending requests, recovery, active crew work and goal review before the collapsed ordinary conversation history. This is a read-only snapshot projection, not a second scheduler or approval authority.

`src/captainWatch.ts` distinguishes provider permissions from questions, removes resolved requests, shows waiting without a received request honestly, excludes external history and old mission attempts, and binds navigation to task/project/current attempt. Storage uncertainty, disconnected providers, unknown effects and paused runs suppress working/approval claims. Finished tool output or assistant prose does not complete a goal. A saved goal awaiting review is separate from captain acceptance; offline saved results are labelled. Opening a row only navigates to existing guarded workbench/mission controls.

Pattern references (no upstream code or services adopted): [whatsmyagentdoing](https://github.com/Charonyuu/whatsmyagentdoing) for event-derived states, [Open Duet](https://github.com/Anil-matcha/open-duet) for attention-first navigation, and [Latch](https://github.com/Balanov/latch) for keeping action review separate from mere display/content binding. A matching digest does not establish human approval. Existing Sunny transport, durable mutation queues, art and permissions remain authoritative.

## Verification

- Nine new pure projection regressions; combined focused recovery/projection/approval suite 125/125 passed.
- TypeScript/Vite build passed with existing bundle-size warning; final build ID 122c0021d583bc0dfc6e9bf5f0983797e92075d1d710b46d9a3ac2771f56f7e7 at dirty 8f04528.
- Existing hidden native workflow passed all 61 named checks, including five added Captain’s watch checks. Initial added fixture attempts failed on selector quoting and incorrect direct metadata mutation; fixed to use real state projection/transcript invalidation. Failures retained.
- After the final scroll-margin adjustment, the visible preview repeated Captain’s watch native assertions and produced desktop/390px screenshots. The full 61-check run preceded that CSS-only adjustment.
- Full serial suite completed: 1,638 tests passed, zero failures/cancellations/skips, in 3,970.274 seconds. Final TAP log is `sunny-full-suite-2.log` in the evidence directory below. The runner exited. Clean locked-install validation, exact-package and live-provider replay remain separate gates.

Evidence in C:/Users/Quintin/Documents/Codex/2026-11-04/files-pasted-by-the-user-act/outputs/: sunny-watch-focused.log, sunny-watch-build.log, sunny-watch-native-3/result.json, sunny-watch-preview/preview.json and captain-watch-preview.png. Preview is explicitly synthetic, uses production dist/preload, has an isolated profile, and never connects Codex or reads the daily profile.

For an interactive isolated preview, set SUNNY_WATCH_PREVIEW=1, clear ELECTRON_RUN_AS_NODE and SUNNY_SMOKE_HIDDEN, set a fresh SUNNY_WORKFLOW_CHECK_OUTPUT directory, then run node_modules/electron/dist/electron.exe desktop/workflow-smoke.cjs. The fixture checks the watch first, opens a labelled visible window, and waits for normal close. Default workflow stays hidden and bounded. No installation or shortcut changes.
