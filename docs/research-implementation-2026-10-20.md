# Research implementation — 2026-10-20

Baseline: installed UI e9bdc8b, branch codex/immersive-sunny-ui. Preserve current art and palette and existing documentation edits.

First increment: Library draft retention during navigation, contained editor, current-request search and Git responses, explicit errors/retry, accessible capture dialog, and workspace geometry. No new dependencies or authority changes.

Library drafts initially live in renderer memory, keyed by normalized note path and retaining the original file hash. They survive room navigation, not app restart. A window-close warning protects nonempty drafts. No vault or persisted schema migration; no automatic save. External changes retain the old hash so the existing backend conflict check refuses overwrite. Discard is explicit and reloads the current file. Successful saves only clear the submitted draft when no newer edit exists. Pending capture text survives dismiss/reopen in the same renderer session. Rollback restores renderer source; no production data migration is needed.

Validation must include deferred response ordering, save failure and concurrent edits, keyboard dialog behavior, populated tool containment at 1280x720 and narrow layouts. Known prior full-suite failures remain recorded in the research report; new focused results do not replace them.

## Search response compatibility
`library:search` keeps its existing array response unless `includeCoverage: true` is requested. The opt-in response contains results, scanned count, bounded coverage, and skipped count. Missing/inaccessible vaults return an explicit error in this response. Limits and synchronous scan remain unchanged for this increment; background indexing is deferred. No stored schema changes, migration, or data writes. Reverting renderer/main/catalog together restores the prior contract.

## Implemented and checked
- Session note recovery retains base hashes and newer edits, including save responses after leaving Library. Recovery is not crash/restart persistence.
- Capture uses a named native dialog, explicit keyboard cycling, retained draft, pending state and inline errors.
- Search and diff responses are generation-checked. Git distinguishes loading/error/verified-empty and exposes retry; commit controls have persistent labels and duplicate-submit protection.
- Opening tools promotes the artifact beside chat on wide screens and above chat on compact screens. At 1280x720 both panes measured 450px high with zero overlap; the former full-width editor grew from 103px to 426px before the artifact-first composition. 390px and 1000px layouts had no page overflow. The 768px navigation breakpoint now uses the intended vertical drawer.
- Crew status projection is memoized independently of ambient ticks. Paused frames preserve object identity until real status changes.
- The timeout regression now waits for the real worker to initialize with the production deadline, holds its real durable commit receipt, then advances the mocked commit deadline. Production behavior is unchanged.

Focused checks: catalog, note recovery, response ordering, navigation, deck motion and the isolated timeout case passed. TypeScript and configured build passed. Native fixture passed all 56 named workflow checks, including all ten rooms, 200% zoom and reduced motion; no live provider ran. Native first launch stalled without a result; the properly waited retry exposed the removed note-length feedback class, which was restored before the passing run. Final recovery helper refinements received focused tests after that native build.

Browser evidence uses fictional data only. Artifact directory: C:/Users/Quintin/.codex/visualizations/2026/10/16/01a14706-5967-7c80-af6b-b460eba42f42/sunny-implementation-2026-10-20/. Impeccable detector reported four incumbent CSS advisories (side borders, existing display face and a blueprint grid); new components had no detector findings. Preserving the captain's current identity takes precedence over changing those styles incidentally.

Full regression suite remains in progress at this checkpoint, with its complete output in .sunny-dev/research-implementation-tests.log. No full-suite or release claim yet. Background indexing, restart-persistent note drafts, source-tracked startup brief and dependency-major migrations are deferred; this increment does not launch autonomous work.

### Packaged fault fixture correction
The first exact-package worker-loss check failed during initialization, before injection, under the fixture-only 1,200ms timeout. Removed that override so the additional isolated worker uses production's existing 30-second deadline. Actual worker termination, locked SQLite writes, held acknowledgement, uncertain outcome and durable-image assertions remain. The lost-ack regression now deliberately takes approximately 30 seconds. All packaged-acceptance tests passed after the correction. Production ordered-store code and deadlines are unchanged.

The exact clean 47534c4 renderer passed the 56-check native workflow. A separate synthetic native capture test passed reverse/forward Tab wrapping, Escape, focus return and reopening a retained capture draft. Its initial harness incorrectly expected Home on startup and clicked without focusing the trigger; those harness assumptions were corrected, without further product changes.
