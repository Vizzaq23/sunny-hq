# Open-water frontend release — 2026-10-20

The captain selected the installed backend for integration. PR #16 merged as 021b9cc902a75677633d6044b8391f4b122b2480 into codex/sunny-hq. Older PR #15 remains separate. Frontend code is committed as 87fa59850b94de455dbab566e0e543a631c3e45f on codex/frontend-open-water-20261020, based on the integrated backend head.

The frontend replaces top navigation with a navy desktop rail and mobile drawer, cool white/blue surfaces, compact headings, readable shared controls and reduced-motion-aware entrance. Existing artwork and room compositions remain. DESIGN.md contains the implementation and visual review contract. No new dependencies, production backend logic or schema changes accompany this frontend.

## Verification

- Clean dependency install and TypeScript/Vite build passed.
- Fresh native workflow: 56 checks passed, hidden window, synthetic transport.
- Seven exact packaged-app acceptance scenarios passed: startup, worker loss, write failure, lost acknowledgement, normal quit, renderer crash and main restart. Cleanup was observed.
- 290 packaged source/build files and runtime manifest fields match the clean source. All 251 installed files match the package hashes. Installed executable startup passed with an isolated profile.
- Backend regression recheck: 12/12 passed, covering the ten remaining failures from the prior full run plus two neighboring cases. The separate GitPane harness fix passed all five focused tests. Intermittent fixture Git-write errors still occurred during existing bounded retries; cause remains unconfirmed.
- Prior full local suite: 1,582/1,593 passed. Hosted full-suite run 39532481486 remained in progress at release; this is not a fresh full-green claim.

## Installation and rollback

Installed under %LOCALAPPDATA%/Programs/Sunny HQ/versions/0.11.0-open-water-87fa598. Start Menu shortcut points there; previous 0.11.0-research-1ebaf84 version and a shortcut backup are retained. Daily profile was not opened or migrated for verification. For UI rollback, point the shortcut back to the retained previous version. Never restore an old database over current user data.

Build ID: ddc06828eb2cdf61f12e67f23ddaefd0fbe81f5f276b77dc4e5c379a0916dd79.
ASAR SHA256: d9d9b4ee06165f801ce989e407a465cd19dd81957ffbd411ad841cc7ca599503.
Evidence: C:/Users/Quintin/.codex/visualizations/2026/10/16/01a14706-5967-7c80-af6b-b460eba42f42/sunny-backend-merge-2026-10-20/.

Frontend remote merge is separate from the authorized backend merge. Three pre-existing documentation edits in the original UI worktree were preserved.
