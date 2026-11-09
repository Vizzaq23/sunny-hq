# Sunny studio UI — November 6, 2026

## Outcome and scope

Captain-requested interface refresh using the saved UI resource library and the
existing One Piece review. Based on Projects refresh `728a1f6`, isolated at
`.sunny-dev/ui-complete` on `codex/sunny-ui-complete`. The primary checkout and
installed daily profile remain separate.

The home dashboard separates the Luffy composer from Captain's watch at wide
sizes and stacks them on compact screens. A contained ship illustration and
brief three-step guide establish place and purpose. Setup, tracked-work controls
and older conversations retain their existing disclosures. The crew directory
adds name/specialty search with explicit empty/reset states. All existing crew
profiles and world routes remain available. Supporting pages share navy/cream
surfaces, readable header scrims, consistent controls and quieter borders.
Tools adds name/purpose/category search and an explicit launch-project selector.
Launches now use that selected project rather than always the first project;
rejected launch promises surface through the existing error toast.

The existing generated portrait sheet supplies directory portraits and Luffy's
composer identity. The animated world keeps its existing pet sprites, atlas
geometry, ground anchors and state rules. No bitmap is modified. Code and
transcript text retain their existing readable treatment; Bangers is reserved
for short titles and Barlow for interface text.

Motion is original CSS: one 260ms, 8px page entrance and 150ms button press
feedback. It respects both system and Sunny reduced motion. There are no new
ambient loops, fake progress counters or work/acceptance signals. Existing
world/room pause controls remain in place.

## References and decisions

| Source inspected | Application |
| --- | --- |
| [Navbar Gallery](https://www.navbar.gallery/) | Keep the established compact primary navigation, clear current-page marker and disclosed secondary destinations; no new navigation framework. |
| [CTA Gallery](https://www.cta.gallery/) | Strong action hierarchy: red captain submit, quieter secondary exploration and profile actions. |
| [Refero Styles](https://styles.refero.design/), [warm editorial example](https://styles.refero.design/style/12255b63-e506-4bc1-a4cd-d05487de32f3) | Calm warm surfaces, consistent spacing and restrained accent use. This is Refero's interpreted reference, not first-party Intercom specification or copied components. |
| [Footer Design](https://www.footer.design/) | Retain the compact persistent captain log as the app's useful bottom destination. A marketing footer would add clutter to a workbench. |
| [Scrolltide](https://scrolltide.co/) | Fetch unavailable; its advertised prompts/components were not inspected or copied. No scroll hijacking or 3D dependency added. |
| [Existing One Piece review](shipboard-design-2026-11-06.md#references-and-rights) | Ink/navy, sail cream, red/gold, short expressive titles and character hierarchy. Preserve the previously inspected official reference findings and access limits. |
| [Art bible](art-bible.md), [world bible](world-bible.md), [provenance](../public/assets/ARTWORK.md) | Reuse admitted ship, room and portrait art. No official manga/card/brand assets copied. |

Skills used: `ui-reference-library`, `better-ui`, `sunny-ui-validation`,
`sunny-world-art-review`, and `obsidian-engineering`. No new dependency, remote
asset request, provider integration, persistence schema or authority change.

Alternative considered: an entirely new shell would discard the recently
verified crew/navigation work. This pass keeps those interactions and consolidates
presentation in `src/studio.css`, plus small semantic component changes. The
stylesheet is explicitly scoped to the main Sunny UI; companion actor code is
untouched.

## Verification

Fresh clean locked install passed with Node 24.18.0 after the sandbox denied npm
directory creation. Electron's exact locked 44.4.3 installer completed separately.
Build/typecheck passed. The first hidden native workflow passed all 68 recorded
checks, including approvals, draft/editor preservation, world/room motion,
all ten room images and 200% zoom. Dedicated studio checks passed home and
supporting destinations at desktop/phone sizes, crew search/empty/reset, draft
preservation, loaded ship artwork and live OS/user reduced-motion handling.

The broader workflow rerun also passed all 68 checks after the layout, contrast
and Tools changes. A final studio rerun passed after clipping the top portrait
row's bottom 9% to hide artwork intruding from the adjacent row. This is a CSS
display correction; source atlas bytes and geometry are unchanged. Its nine
recorded checks include tool search/reset and an assertion that a synthetic
launch receives the selected project's ID. Build/typecheck passed again.

[Reviewed screenshots and native receipts](evidence/studio-2026-11-06/README.md)
are retained with the change. The required full serial suite completed 1,732
tests: 1,731 passed, one inherited test-host failure described below, zero skipped
or cancelled, in 4,073 seconds. All fixture content is synthetic. No installed-app/live-provider
or screen-reader acceptance is claimed.

The serial suite exposed an inherited renderer-test loader issue in
`external-history-ui.test.cjs`: importing the Projects view caused Node to parse
`projects.css` as JavaScript (`Unexpected token '.'`). The same failure was
reproduced in the parent checkout. This branch incorporates the Projects fix
from `37bba58`: load Projects CSS centrally in `src/main.tsx`, immediately before
the studio stylesheet, instead of importing it from the component. No tests or
assertions are changed. The affected test plus transcript and workbench handoff
suites passed 10/10 after the correction. The original failing full-run result
is retained. The full suite was not repeated after this import-only correction; the affected
suite and related renderer checks were rerun. There are no unresolved observed
failures, but this is not a claim of a completely green second full run.
After incorporating the shared import fix, build/typecheck and both native
fixtures passed again (9 studio checks and 68 workflow checks, exit 0). The
retained screenshots and receipts are from these integrated final runs.

## Rollback

Revert this focused presentation commit (or remove the studio import and revert
the listed component changes). No database restore or migration is needed.
Fixture checks can remain independently. No merge, push or installed-app update
has been performed as part of this work.

## Wanted posters, ship alignment and recorded conversations — 2026-11-09

Captain explicitly requested the planned wanted-poster identity, repaired Sunny
ship scene, interactive visual handoffs, screenshots and installation. The
renderer now adds parchment crew posters with large existing portraits, ink
mastheads, red profile actions and mission notices. Home uses the complete Sunny
illustration on warm sail-paper; sea-green navigation and logbook framing unify
the screens. No invented bounty amounts or status stamps imply completed work.

M5 adds a selectable conversation presentation above the retained detailed
receipts. Each chapter shows the predecessor's recorded result and recipient's
recorded message/assignment with their crew portraits. Next/previous and chapter
buttons work by keyboard; no autoplay, generated dialogue, provider call or
synthetic progress is introduced. Missing payloads remain explicitly unavailable.
The existing task navigation, draft guards, evidence and acceptance remain intact.

Ship diagnosis: the Helm board combined viewport-derived width with max-height,
which could break its 3:2 ratio. The contained image then letterboxed while
percentage-positioned crew still used the wider board. Fit the board to the
scene's actual width and height in the original 3:2 ratio. Both layers keep the
same rectangle. Show the original ship-deck asset while the transparent texture
loads; previously the image had no source during that interval. No bitmap,
atlas coordinates, route nodes or companion geometry changes. The native fixture
now waits for loaded ship art and asserts shared layer bounds and aspect ratio.

Validation pending on this candidate. Required: clean Windows full suite/build,
native workflow, poster/search/draft checks at desktop/phone/200%, handoff keyboard
navigation and missing records, ship geometry at desktop/compact/phone, inspected
screenshots and exact installed-package identity. Rollback: prior version folder
and shortcut remain available; no schema migration or profile restoration needed.

### Integration correction — existing captain-selected design
The captain confirmed using the existing planned design from b31f959 on
codex/sunny-hq. Integrate its full crew map, sourced wanted sheets, native profile
dialogs, event-bound beams, ship log and saved app-wide appearance alongside the
M1–M7 branch. The initial CSS-only crew poster reconstruction is superseded;
retain the new home/mission framing, ship geometry/loading fix and recorded
handoff conversation. No new poster download, recoloring or crop. Preserve the
source attribution and rights limitations already recorded in
wanted-poster-references.md and public/assets/wanted/sources.json.

The previously installed voyage package omitted this separate branch. This
integration is the correction; neither prior branch's tests alone qualify the
combined app. The preliminary 7968827 suite was stopped after installation and
partial tests, with observed owned-process cleanup; it is not a pass. Fresh
combined-source validation and installation evidence follows below.

### Verified combined update — 2026-11-09

Application candidate `ca4b7373f02ff8aa8d1e751d781da5cf25d96d54` combines the
captain-selected posters, crew map and appearance with M1–M7, repaired ship
geometry/loading and selectable recorded handoff conversations. The newer
combined build's diagnostic and acceptance dark surfaces are also preserved.

[Machine evidence](evidence/wanted-2026-11-09/qualification.json) records:

- Clean Node 24.18.0 locked installation and Electron installation passed.
  The full test invocation was interrupted by a machine restart, not a reported
  test failure. Completed files account for 1,563 top-level and 10 nested passing
  tests. The interrupted `supervised-journey.test.cjs` and every later test file
  were rerun in full: 229 passed, zero failed. Combined coverage is 1,802 tests;
  this is explicitly not an uninterrupted green full-suite run. Exact log hashes
  and the resume boundary are retained in the evidence.
- `npm run build` passed, including TypeScript, with the exact clean candidate
  identity. Core native workflow passed 68 checks. Studio captures (11), handoffs
  (16), voyage (17), review (11), accepted work (15) and the crew-map fixture passed.
- All 18 exact-package recovery/control/interface/playable/journey/motion/audio
  scenarios passed with owned-process cleanup observed; no threshold changed.
- Inspected final fixture screenshots show full sourced posters, aligned ship and
  actors, speech bubbles with navigation, compact layout and enlarged text.
  Screenshots remain local under `.sunny-dev/wanted-final-3/`; their hashes and
  paths are recorded. They show labelled sample work, not live provider activity.
- Installed `0.11.0-wanted-ca4b737` alongside prior versions; all 253 application
  files matched the qualified package. Backed up 107 profile files with denied
  writes during copying and verified hashes. Desktop and Start Menu targets were
  reread. Native Computer Use confirmed the installed file URL, rendered Home,
  moving crew on the repaired ship and wanted-poster Crew screen. No mission was
  started for verification.

Rollback: quit Sunny normally and point the shortcuts back to the retained
`0.11.0-combined-1b9ca0d` executable. Do not restore old profile data over newer
work. Local installation receipts and backup location are in
`.sunny-dev/local-wanted-install.json`. No storage migration or authority change.

The local-advice banner's weak secondary-text contrast in dark mode was corrected
in the subsequent `ff08a25` update; see [appearance verification](crew-appearance.md).
Screen-reader testing,
hosted CI, separately admitted native recovery and continuous real-provider
release acceptance remain unverified. `LIVE_SUPERVISION_ADMITTED=false` remains
unchanged. This update is not a production-release claim.
