# Actual upstream component evidence — 2026-11-07

Source branch: codex/crew-map, based on 3fdeeb5. Production source fingerprint: edb157eea85035601ecf1a08bb2f1092511b86f5e68a9bd9d7a3fafef5cfcedc (build captured before integration commit).

- Clean dependency install (npm ci): passed with Node 24.18.0. Electron's explicitly requested runtime install restored the binary after npm withheld lifecycle scripts.
- Production build and TypeScript: passed; existing large-chunk warning remains. See build.txt.
- Focused delegation, ship-log, navigation, command-activity and external-history tests: 17 passed, zero failed. See focused-tests.txt.
- Dedicated native Electron crew-map fixture: passed. Actual registry component markers, live Paper shader instances, finite real-event pulses/no history replay, equal cards, profile evidence/drafts/focus, exact mission-attempt navigation, app/OS reduced motion, 390px and 200% zoom, real pointer morph transform frames, repeated offscreen shader cleanup/remount, forced GPU-loss still fallback, mission-brief PaperTexture. See crew-map-result.json and crew-map.txt.
- Complete native Electron workflow fixture: 68 checks passed, including command keyboard/IME/stable selection/dirty guard, native profile focus return, ten room layouts, zoom and reduced motion. Additional real PaperTexture check on Zoro's ledger passed. See workflow-result.json and workflow.txt.
- Full serial npm test: **1,740 passed, zero failed/cancelled/skipped**, exit 0, 5,546,803 ms (about 92 minutes). See full-tests.txt for final TAP totals, individual outcomes and the SHA256 of the retained local raw log. No backend changes, retries or weakened checks were needed for this run.

Screenshots were inspected directly: crew-map-desktop.png, upstream-morph-pointer.png, captains-orders.png, crew-map-log.png, crew-map-phone.png, crew-map-zoom.png, upstream-mission-paper.png, upstream-zoro-paper.png and upstream-water-fallback.png. Materials stay behind readable HTML controls. Saved fixture evidence is explicitly synthetic, not a live-provider or acceptance claim.

No installed-app/release validation, screen-reader speech audit, push, merge or application installation was performed. Source and licensing adaptations are documented in ../../crew-components-upstream.md and ../../licenses/crew-components/sources.json. Aceternity source-release restrictions remain applicable.

## User-authorized installation

On 2026-11-07 the captain explicitly requested build and installation. Clean source5684601 packaged successfully with fingerprint10dc08f2e7e2bdb919d3e958e548d83073d4592e017a2a8848d4415f25dc3afa. Versioned installation,252file hash verification, source/license packaging, atomic SQLite backup integrity and Start Menu/Desktop targets verified. Exact-package startup, renderer-crash and pending-approval checks passed. See [install.json](install.json). The older studio instance remains running; Quit through its tray menu and reopen the updated shortcut to activate the new version. No forced termination or real mission was performed.
