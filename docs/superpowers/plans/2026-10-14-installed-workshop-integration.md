# Installed Workshop Integration Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task, with one writer per subsystem. Do not start parallel editors in the shared checkout.

**Goal:** Bring the installed app's verified recovery and workshop behavior into `sunny-hq`, preserving `ea90831`'s reviewed-result saving and launch recovery, then prove one bounded offline mission through restart, tests and captain acceptance.

**Architecture:** Reconcile two diverged source histories instead of replacing folders or rebuilding orchestration. Integrate storage and mission contracts before their renderer projections. The installed archive is immutable comparison evidence; its dirty build metadata is not a reproducible source checkout.

**Tech Stack:** Existing CommonJS Electron 44.4.3 desktop, strict TypeScript/React renderer, Node 24, existing SQLite/JSON fixture tests. No new dependency is proposed.

**Spec:** [Current reconciliation, failure evidence and milestone](../../reliability-baseline.md#current-reconciliation--2026-10-14); [foundation authority boundaries](../../foundation-design.md). Captain direction on October 14: keep edits in `sunny-hq`; plan integration of the installed app's newer work first. This plan is not a claim that integration or the workshop milestone is complete.

## Global constraints

- Preserve the clean starting revision `ea90831d031073fee9963d248bbe659a60f2bca3` and all subsequently discovered edits. Keep the other checkout's six changed/untracked paths untouched.
- Work on a `codex/` feature branch. No reset to the reviewed revision; no direct main push, deployment, installer activation, live payment, provider quota use or migration of the daily profile.
- Use local fixtures. Animation never grants authority; Luffy presents controls and the human captain accepts. Pause requested and confirmed stopped remain distinct. Celebrate accepted outcomes only.
- Preserve credential isolation, sender/frame/action validation, cancellation and uncertain checkout reservations.
- Usage is reported tokens, not verified dollars or subscription percentage; missing values stay unknown.
- No Decisions API, new agents, rooms, external routing experiment or broad visual polish in this milestone. External visual references and licenses need checking only if a later change actually adopts their code/assets.

## Review focus

- Dirty build inputs must not be silently attributed to the clean installed commit.
- An asynchronous store must not acknowledge a reviewed save or retry reservation before its durable checkpoint.
- Windows path normalization must not admit another worktree, junction or unowned file while fixing `src/alpha.cjs`.
- Recovery must not replay an uncertain submission, approval, accepted cue or partial file write.
- Long transcripts and compact layout must preserve visible stop/approval controls without implying progress from movement.

## Task 1: Reproducible source map and failing installed journey

**Files to inspect:** installed source `scripts/write-build-info.cjs`, `scripts/packaged-supervisor.cjs`, `desktop/journey-provider.cjs`, `desktop/journey-bootstrap.cjs`, `desktop/execution-workspaces.cjs`, and the delivery/path validation module identified by tracing `Worker path outside owned paths`. Record findings in `docs/reliability-baseline.md`; retain this plan as the integration sequence.

- [x] In an isolated integration checkout based on this repository's current feature HEAD, obtain the local donor history read-only. Record commit/tree IDs and the merge base before importing any file. Do not transplant all 419 differing files.
- [x] Hash the donor tracked/untracked files against matching archive entries. Produce an exact included/excluded list for the dirty build delta. Exclude `desktop/openai-decisions.cjs` and `desktop/task-advice.cjs` from this milestone unless a demonstrated required dependency exists; do not import them just because they shipped.
- [x] Use the donor's contained supervisor, immutable supplied executable and new empty profile to reproduce `journey-cue` failure. Keep the failed receipt and owned-process cleanup evidence.
- [x] Trace the declared owned paths, actual worktree root and requested `src/alpha.cjs` at the failing boundary. Add a narrowly scoped regression to `tests/execution-workspaces.test.cjs` or the actual owning delivery test. Demonstrate failure before any fix. Include Windows slash/case variants, traversal, sibling worktree, junction and an actually unowned path.
- [x] Fix only the demonstrated cause in the integration checkout; rerun the focused regression. A fixture setup bug should be fixed in the fixture, not by weakening production ownership checks. Document remaining uncertainty if it cannot be reproduced from matching source.

**Exit:** a source-to-package mapping and an explained, regression-covered journey failure. Installed build remains unchanged.

**Execution note (October 14):** source mapping and the original ownership defect are complete in `codex/workshop-donor-recovery`, an isolated worktree of this repository based on `e061bda`. The `ea90831` integration branch is preserved separately. This is a deliberate refinement: the failing fixture/mission modules are absent from `ea90831`; wholesale import before diagnosis would defeat this task. The original failure was historical prompt selection, so regressions exercise the finite provider rather than modifying Windows path guards; existing workspace/integration security tests were rerun. Commits `3ebdd6d`, `a993ebf`, and `dd98789` also address two newly reproduced blockers (temporary preparation capacity and stale feedback observation). The complete contained journey is a separate gate and remains unproven until its supervisor accepts; see the authoritative reliability baseline for receipts and exact package identities.
## Task 2: Durable storage and current recovery coexist

**Candidate donor files:** `desktop/ordered-store.cjs`, `desktop/persistence-worker.cjs`, `desktop/persistence-barriers.cjs`, `desktop/persistence-lifecycle.cjs`, `desktop/mission-profile.cjs`, plus their actual dependency closure. Coordinate changes in `desktop/main.cjs`, `desktop/hub.cjs` and `desktop/core.cjs`.

**Preserve current behavior:** `desktop/result-saves.cjs`, `desktop/backup.cjs`, `desktop/codex.cjs`, safe `Hub.retryFailedLaunch`, mission review decisions, and trusted `result:save` / `result:recover` IPC.

**Compatibility inspection (October 14, not implemented):** clean donor lacks `desktop/result-saves.cjs`, `desktop/backup.cjs`, `Hub.retryFailedLaunch`, and the current result-save state/IPC. Donor storage uses `openOrderedStore` plus `AuthorityCommitQueue` with explicit asynchronous receipt barriers; replacing the store alone would make the current synchronous save/retry code unsafe. Its mission profile adapter accepts absent/versions 1–3, writes a verified full-state JSON backup before a v1/v2 upgrade, and persists version 3. Unknown top-level fields survive the adapter's merge, but Hub image construction, renderer snapshots and manual export must also preserve the save/retry fields. These are required integration points, not evidence that compatibility already works. Read `mission-profile.cjs`, `persistence-worker.cjs` and both Hub image builders before choosing the import closure; keep the daily profile closed.
**Tests:** donor `tests/ordered-store.test.cjs`, `tests/persistence-barriers.test.cjs`, `tests/persistence-recovery.test.cjs`, `tests/run-recovery.test.cjs`; current `tests/result-saves.test.cjs`, `tests/failed-launch-recovery.test.cjs`, `tests/mission-review.test.cjs` and their crash fixtures.

- [ ] Before code/schema changes, extend `docs/reviewed-result-saving.md` with exact optional-field compatibility, old/new profile versions, backup location, migration, failure handling and rollback. Determine whether downgrade is supported; never open a migrated daily profile with old code as a test.
- [ ] Add isolated regression cases for a reviewed note written before its receipt, a retry reservation before submission, persistence-worker loss and a lost commit acknowledgement. Prove no duplicate note or task and no false success.
- [ ] Integrate storage with explicit awaited durability barriers at those boundaries. Retain attributed result content and review decisions across reopen.
- [ ] Run the combined tests on fixture SQLite and JSON profiles, then repeat abrupt-exit recovery. No real profile migration.

**Exit:** both the installed storage contract and this checkout's newer save/retry behavior pass together. Avoid an intermediate build that merely compiles while losing durable receipts.

## Task 3: One mission contract, then the existing workshop

**Candidate donor files:** `desktop/supervised-runs.cjs`, `desktop/supervision-schema.cjs`, `desktop/supervision-commands.cjs`, `desktop/workspace-state.cjs`, `desktop/workspace-routing.cjs`, `desktop/public-transport.cjs`; coordinate `desktop/hub.cjs`, `desktop/main.cjs`, `src/shared.ts`, `src/useSunny.ts` and `src/App.tsx` together.

**Renderer files:** donor `src/components/FrankyWorkshop.tsx`, `franky-workshop.css`, `CrewRunPanel.tsx`, `crew-run.css`, `DenDenCalls.tsx`, `src/missionProjection.ts`, `src/frankyFrames.ts`, plus directly required projections/assets. Preserve current `src/components/FailedLaunchRecovery.tsx`, `SaveReviewedResult.tsx`, `ResultSaveHistory.tsx`, `src/views/MorgansView.tsx` and `src/views/MissionBoard.tsx` behavior.

**Tests:** current `tests/jev-hub.test.cjs`, `tests/mission-workflow.test.cjs`; donor `tests/supervised-journey.test.cjs`, `tests/supervision-commands.test.cjs`, `tests/workspace-state.test.cjs`, `tests/workspace-routing.test.cjs`, `tests/franky-workshop.test.cjs`, `tests/franky-frames.test.cjs`, `tests/run-ui.test.cjs`.

- [ ] Inventory contract incompatibilities before edits: mission storage shape/version, run identity, acceptance binding, async persistence and snapshot/transcript transport. Reuse the donor implementations needed by the one journey; do not retain two competing orchestrators.
- [ ] Add regressions that a finished worker and failed test cannot grant acceptance; stale approvals fail; uncertain turns reconcile without retry; pause remains requested until authoritative stop confirmation.
- [ ] Integrate the minimal backend dependency closure, preserving the existing bounded delegation behavior and latest save/retry tests.
- [ ] Read art/world bibles and provenance before bringing renderer/assets across. Port the existing full-opacity workshop and side panel; do not regenerate art. Keep direct task, diff, test, approval and stop access.
- [ ] Verify queued, working, blocked, review, failed and accepted projections from actual fixture state. Assert no celebration before captain acceptance or replay after restart. Test user and OS reduced motion.

**Exit:** the workshop consumes the integrated authoritative state and current recovery/save controls remain reachable. No extra rooms or providers.

## Task 4: Package, prove and leave ready for review

**Files:** integrate `scripts/write-build-info.cjs` and `package.json` build hook; reuse donor contained fixture supervisor/dependencies and current `desktop/workflow-smoke.cjs` where compatible. Update `README.md`, `docs/reliability-baseline.md` and the current implementation report only after evidence exists.

- [ ] Run Node 24 `npm ci` in a clean integration checkout, full `npm test`, `npm run build`, focused security/recovery regressions and the fixture Electron workflow. A skipped or interrupted check is not a pass.
- [ ] Build a separate local verification package, record source commit plus complete dirty delta, build ID, executable/archive hashes, exact launched path and fixture profile. Do not replace the supplied shortcut or package.
- [ ] Run the bounded goal → assignments → real local diff → deliberate failed check → interruption/restart → reconciliation → passed checks → review → captain acceptance journey. Assert one logical submission, retained evidence and no automatic acceptance.
- [ ] Use the contained runner for renderer crash, main restart, pending approval/check, worker loss, write failure and lost acknowledgement. Verify cleanup and phase receipts, not just screenshots.
- [ ] Complete 1/10/30 MiB history checks, keyboard navigation, compact 1000×700 layout, enlarged text and both reduced-motion modes. Capture comparable before/after workshop screenshots with exact package identity; label display seeds as synthetic.
- [ ] Review the full integration diff and source map. Report branch, focused commits, uncommitted files, actual test results, limitations and rollback. No lint script exists; do not claim lint passed.

**Stop condition:** one bounded fixture mission survives interruption and completes the requested workshop review/approval journey. Later work: trusted usage aggregation and routing evaluation, broader visual polish and any separately authorized activation. If a reliability gate fails, stop visual expansion and retain the exact failing evidence.
