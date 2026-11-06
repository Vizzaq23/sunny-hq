# Shipboard visual pass — 2026-11-06

## Decision and scope

Build on the current Luffy-first workflow with sea-blue chrome, sail-cream reading surfaces, ink panel borders, restrained red/gold emphasis, existing room art, and short comic display headings. The implementation is `src/shipboard.css`, one stylesheet import, and the existing approval card's icon/label. No backend, IPC, persistence, role, animation-state or acceptance logic changes.

The existing captain's watch and log remain the source of activity, decisions, result review and acceptance. Existing room-specific station layouts and route/dependency projections remain intact. This pass adds no invented journey percentage, achievement, work animation or automatic completion.

Alternatives considered: replacing the shell would discard recent crew usability work; returning to a universal parchment treatment would conflict with the requested navy/white direction. A scoped presentation layer preserves behavior and provides a small rollback boundary. Dense transcripts retain readable Barlow text; Bangers is reserved for short headings, crew names and the brand.

## Local identity and isolation

- Original checkout: `C:/Users/Quintin/Documents/GitHub/sunny-hq`, branch `codex/crew-skills-usability`, source `1fc7b80191509e8b013034131b7adc6ab79dbe9b` at inspection. Existing edits to `docs/crew-skills-usability-research.md` and `docs/local-crew.md` were left in place.
- Another chat, **Explore independent Sunny character…**, was active in that checkout. This work uses a separate worktree: `.sunny-dev/shipboard-design`, branch `codex/shipboard-design-20261106`. No edits, branch switch or dependency install were made in the other chat's working tree.
- The older `codex/frontend-open-water-20261020` worktree exists at `6ff6a27`. It is not an ancestor of the current checkout. No merge/reset was performed.
- Start Menu shortcut points to `C:/Users/Quintin/AppData/Local/Programs/Sunny HQ/versions/0.11.0-open-water-87fa598/Sunny HQ.exe`. Read-only inspection of its ASAR reports clean source `87fa59850b94de455dbab566e0e543a631c3e45f`, fingerprint `ddc06828eb2cdf61f12e67f23ddaefd0fbe81f5f276b77dc4e5c379a0916dd79`.
- `DESIGN.md` is absent. Foundation design, platform roadmap, art/world bibles, asset provenance and affected React/CSS code were inspected instead.
- Screenshots and UI checks concern isolated source builds with synthetic IPC, not the installed package or live providers. The installed app was not replaced or relaunched.

## Implemented treatment

1. Luffy home: ship illustration under a navy scrim, cream goal panel, existing captain's den accent, stronger title/control hierarchy.
2. Crew: existing portraits, names, roles, setup state and actions receive ink frames and distinct existing crew accent colors. All ten destinations are preserved.
3. Rooms: original uncropped artwork, existing layouts and real-state labels remain; shared panel framing and short display titles tie the rooms together.
4. Captain's watch/log: stronger section hierarchy and restrained state-aware rules, retaining the existing review-versus-acceptance distinction.
5. Approvals: Den Den Mushi label and existing Lucide phone icon; larger explanation, code evidence and action text; taller bounded request area. Exact action, reason, approval binding, buttons and duplicate-submit guard remain unchanged.
6. Accessibility: visible keyboard focus, stacked phone top-bar controls without overlap, wrapping approval evidence and actions. No new motion or sound.

## References and rights

Reference pages were inspected on November 6, 2026. No official artwork, manga panel, logo, card bitmap or DynaFont file was added to Sunny.

| Reference | Use / access |
| --- | --- |
| [Shueisha series page](https://www.shonenjump.com/j/rensai/onepiece/) | Crew identities, official series/cover presentation; page loaded. |
| [VIZ chapter 1](https://www.viz.com/shonenjump/one-piece-chapter-1/chapter/5090) | Reader visually inspected: clean gutters, strong ink boundaries, restrained dramatic type. |
| [Official Straw Hat card list](https://en.onepiece-cardgame.com/cardlist/?series=569001) | Page visually inspected: portrait/name hierarchy and distinct color accents. No card art copied. |
| [Official Thousand Sunny profile](https://one-piece.com/character/Thousand_Sunny/index.html) | HTTP 403; could not inspect. Existing Sunny artwork was used. |
| [Toei series page](https://www.toei-animation.com/catalog/one-piece/) | Official series/color reference page loaded; copyright attribution retained as reference only. |
| [DynaFont adoption story](https://www.dynacw.co.jp/fontstory/fontstory_detail.aspx?s=488) | Names Sōgeitai as used in One Piece. This is not an English logo-font identification or a redistribution license. Not installed. |
| [Fontsource Bangers](https://fontsource.org/fonts/bangers/download), [Barlow](https://fontsource.org/fonts/barlow/download) | Bangers page loaded; Barlow download page unavailable through web tool. Font files and licenses obtained from Google Fonts' upstream repository instead. |

Added files: Bangers Regular, Barlow Regular and Barlow SemiBold, unmodified, locally bundled under SIL OFL 1.1 with both full license notices. See [font provenance](../public/fonts/README.md). They are not official One Piece fonts. Existing Lucide dependency supplies the phone icon; no dependency added. Optional paper textures, Kenney assets and additional fonts were unnecessary and were not added.

## Verification and screenshots

Node `v24.18.0`; clean isolated `npm ci` passed (390 packages). It reported 12 dependency vulnerabilities (7 moderate, 5 high); no dependency versions were changed in this visual task. npm did not populate an Electron executable in the clean worktree, so fixtures used the existing verified `44.4.3` executable from the parent checkout, matching the locked package version.

Baseline production build and full hidden native workflow passed. Baseline responsive screenshots were rebuilt from an isolated `git archive` of exact source `1fc7b80`; no current source files were reverted. The initial attempted reuse of another worktree's dist was rejected because only its build-info file remained.

Current evidence beneath this worktree's `.sunny-dev/`:

- `design-before/`: original full workflow and screenshots; receipt passed.
- `design-before-sized-2/`: before home, approval and Sanji room at 1280×720, 390×844 and 200% zoom; receipt passed.
- `design-final-captures/`: final responsive captures (superseded if later receipt named in final verification below).
- `design-final-workflow/`: full UI workflow, all ten room images, 200% zoom, draft/editor preservation, duplicate approval prevention, navigation, reduced motion and motion/pause checks; passed.
- `design-focused-tests.log`: 84 tests passed, zero failures/skips. Includes room state/evidence/relay, deck motion, captain watch, attention, call sound, mission workflow, long-transcript rendering and transcript state.
- `design-build.log`: production build/typecheck, with existing large-chunk warning.
- `design-tests.log`: sandbox run, 1,512 pass / 217 fail / 3 skipped, 1,732 total. Sample failures are denied temporary Git config writes and atomic file renames. This is a failed environment-bound run, not a green suite.
- `design-tests-native.log`: full suite rerun with normal permissions; final result recorded below when complete.

`--shipboard-captures` extends the existing hidden Electron fixture with the three requested views/sizes, 200% overflow checks, native keyboard-mode focus, no implicit approval, local font loading and no remote resource fetches. `--shipboard-baseline` selects the explicitly prepared baseline dist for comparison. Both use isolated synthetic profiles.

Limitations: no installed-app/live-provider acceptance claim, screen-reader certification, commercial character-art license, or end-to-end executed local-crew mission. The existing trusted execution release gate remains closed. The long-transcript check is the existing rendered regression, not an exhaustive manual screen-reader reading.

## Rollback and review

Revert the dedicated visual commit to remove the stylesheet import, presentation rules, added font files and approval label/icon. No database migration or profile rollback is needed. Fixture/report changes may remain independently. Installing, deploying, merging, pushing or publishing requires the captain's separate approval; none is performed here.

## Final verification

Pending completion of the normal-permission full suite and final evidence review.
