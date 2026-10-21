# Sunny frontend design

Updated 2026-10-20. Scope: renderer work surfaces and navigation. The captain explicitly requested a completely different palette and smoother interface after the installed research reliability increment. The One Piece crew, ship, room illustrations, provenance and task-state authority remain unchanged.

## Direction contract

Thesis: an open-water work headquarters. Persistent navigation supports frequent movement between work and world; artwork leads the ship surface while task controls remain readable.

Own world: navy #172844 navigation, cool #f1f4fa canvas, white working surfaces, blue #2859c5 primary actions, restrained coral attention. Segoe UI operational typography, 8–14px control/panel corners, thin cool borders. No ornamental brass edges on forms.

Story: choose a destination, locate current work, act on explicit status. Ambient crew movement never establishes task progress.

First viewport: 216px left navigation at desktop, broad work area, compact page heading. The Sunny uses a world pane and 300px crew inspector with the crew strip below. Below 900px navigation becomes a focus-managed drawer and content stacks.

Form: direct implementation of the captain-approved redesign; no concept lottery. Existing artwork and room compositions retained. Header duplication removed from Home's embedded mission form.

Finish: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Implementation and accessibility

`src/frontend-system.css` is the final imported presentation layer, scoped to Sunny's app shell. Existing room styles retain their geometry and themed content; new shared controls replace old chrome. No dependencies, IPC, persistence schema, provider behavior or image bytes changed. Future component migrations should consume these tokens rather than add new literal palettes.

Body controls use 13–15px operational text, visible keyboard focus, explicit disabled states, and themed selection/caret/scrollbars. Only one short shell entrance is added and respects both OS and application reduced motion. Existing Motion state transitions remain; no repeated page-entry animations are introduced.

## Verification and limits

Visual review: desktop 1280x720 and narrow 390x844; ship, Home, Tools and Library inspected. Narrow ship document width equals viewport width (390px); drawer navigation reaches destinations and closes. Layout detector reports no findings in the new stylesheet. Browser previews have no live provider connection. Native fixture results and final build are recorded separately in the frontend evidence directory. This document does not claim a backend merge or installed release.

No raster assets were created or modified; existing provenance remains `public/assets/ARTWORK.md`. Rollback: revert this presentation commit; there is no data migration.

Final verification: configured TypeScript/Vite build passed; final isolated Electron workflow passed all 56 checks, including all ten rooms, 200% zoom, keyboard navigation, draft guards and reduced motion. A second rendered sweep reached all ten non-ship destinations with 1280px document width matching the viewport. Franky header contrast was corrected after visual inspection. No claim of screen-reader validation or complete contrast audit. Evidence: C:/Users/Quintin/.codex/visualizations/2026/10/16/01a14706-5967-7c80-af6b-b460eba42f42/sunny-frontend-2026-10-20/.

The preceding full regression run completed 1,593 tests: 1,582 passed, 11 failed. The extracted Git-pane test harness was corrected separately in 4085a86; its five focused tests now pass. The other ten failures remain unresolved; this visual pass does not establish a green backend release. Backend merge target clarification remains pending because the installed integration and older draft PR #15 are divergent histories.

Release follow-up: backend PR #16 merged; frontend 87fa598 installed and verified. The prior unresolved-test paragraph above records the earlier checkpoint. All remaining cases passed targeted rechecks; full hosted CI remains pending. See docs/frontend-open-water-release-2026-10-20.md for exact evidence and rollback.
