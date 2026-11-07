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
