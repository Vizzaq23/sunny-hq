# Crew map evidence — 2026-11-07

Isolated worktree: sunny-hq/.sunny-dev/crew-map; branch codex/crew-map; base c6aa0ca. All displayed work is synthetic fixture data. Installed Sunny and its profile are unchanged.

- [Captain area](crew-map-desktop.png) and [equal core cards](crew-map-cards.png).
- [Expanded Franky profile with saved output](crew-map-profile-output.png).
- [Ship log](crew-map-log.png) and [Captain’s Orders](captains-orders.png).
- [390px layout](crew-map-phone.png), [200% zoom](crew-map-zoom.png).
- [Dedicated native receipt](crew-map-result.json): finite outbound/inbound signals, no history/duplicate replay, focus return, pause, user/system reduced motion, exact assignment navigation, sizes/zoom.
- [Focused tests](focused-tests.txt): 14 passed, including five delegation cases, activity/navigation and external-history renderer regression.
- [Full-suite attempt](node-suite-result.json): 167 passed, 2 failed before deliberate stop; incomplete, not green.
- [Untouched c6aa0ca reproduction](baseline-checkpoint.txt): same readonly-binding checkpoint Journey deadline. Backend source/tests unchanged by this UI task. Full raw TAP remains at worktree tests.log.

Production build/typecheck passed on Node 24.18.0; receipt in build-verified.log. Clean npm ci completed; Electron install.js supplied its runtime after npm withheld lifecycle scripts. No lint command exists. [Final full native workflow](workflow-result.json) passed all 68 checks on the final build. Build fingerprint: `9d420cf1e12667f7b6cfd07e4bd805d1e394640f1c63373cbdd38507660ed171`.

Initial dedicated attempts are retained under worktree .sunny-dev/crew-map-check-1 and -2: the first lacked fixture transcript invalidation; the second used an invalid CSS ID selector. Fixture corrections led to successful -3 and final runs. Screen-reader speech and live provider events were not exercised.
