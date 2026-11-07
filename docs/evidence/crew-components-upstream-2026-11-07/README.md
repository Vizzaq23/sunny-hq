# Actual upstream component evidence — 2026-11-07

Source branch: codex/crew-map, based on 3fdeeb5. Production source fingerprint: edb157eea85035601ecf1a08bb2f1092511b86f5e68a9bd9d7a3fafef5cfcedc (build captured before integration commit).

- Clean dependency install (npm ci): passed with Node 24.18.0. Electron's explicitly requested runtime install restored the binary after npm withheld lifecycle scripts.
- Production build and TypeScript: passed; existing large-chunk warning remains. See build.log.
- Focused delegation, ship-log, navigation, command-activity and external-history tests: 17 passed, zero failed. See focused-tests.log.
- Dedicated native Electron crew-map fixture: passed. Actual registry component markers, live Paper shader instances, finite real-event pulses/no history replay, equal cards, profile evidence/drafts/focus, exact mission-attempt navigation, app/OS reduced motion, 390px and 200% zoom, real pointer morph transform frames, repeated offscreen shader cleanup/remount, forced GPU-loss still fallback, mission-brief PaperTexture. See crew-map-result.json and crew-map.log.
- Complete native Electron workflow fixture: 68 checks passed, including command keyboard/IME/stable selection/dirty guard, native profile focus return, ten room layouts, zoom and reduced motion. Additional real PaperTexture check on Zoro's ledger passed. See workflow-result.json and workflow.log.
- Full serial npm test is running; final outcome will be recorded after completion. No whole-suite green claim yet.

Screenshots were inspected directly: crew-map-desktop.png, upstream-morph-pointer.png, captains-orders.png, crew-map-log.png, crew-map-phone.png, crew-map-zoom.png, upstream-mission-paper.png, upstream-zoro-paper.png and upstream-water-fallback.png. Materials stay behind readable HTML controls. Saved fixture evidence is explicitly synthetic, not a live-provider or acceptance claim.

No installed-app/release validation, screen-reader speech audit, push, merge or application installation was performed. Source and licensing adaptations are documented in ../../crew-components-upstream.md and ../../licenses/crew-components/sources.json. Aceternity source-release restrictions remain applicable.
