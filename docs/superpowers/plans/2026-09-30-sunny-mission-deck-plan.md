# Sunny Mission Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one durable goal-to-result-to-captain-acceptance journey aboard Sunny, followed by Franky's truthful workshop pilot.

**Architecture:** Extend existing Hub/MissionBook authority with versioned selected-result and acceptance records. Preserve the shell around an inspectable Workbench, using one durable context and a shared state projection for the log, ship and workshop. Reuse current crew workflow, art, persistence, IPC safeguards and controls.

**Tech Stack:** Windows, Node 24, Electron (current checkout 44.4.3), React 19, strict TypeScript, CommonJS desktop services, existing SQLite/JSON stores and Node test runner; no new dependencies.

**Spec:** [2026-09-30-sunny-mission-deck-design.md](../specs/2026-09-30-sunny-mission-deck-design.md). The user approved that written design on September 30 at 18:55:30 UTC. Its historical draft label does not erase the recorded approval. **This implementation plan still requires user review before architectural code.**

## Global Constraints

- Scope is **one ship, one complete journey, one room**.
- “No task, terminal, check or approval resumes automatically.”
- “Unknown state keeps checkout reservations.”
- “The renderer supplies the intended selection, never proof.”
- “No bulk conversion, inferred criteria, auto-acceptance or historical replay is allowed.”
- “A reproducible crash or hang blocks experience rollout and installed cutover until its cause and recovery are addressed with passing evidence.”
- “Reduced motion (system or Sunny setting) removes travel, frame stepping, bobbing and celebration motion.”
- “The pilot requires no external account or service.” No framework rewrite, new providers/tools/agent integrations, broad asset generation, user-app replacement, push or merge.
- Current worktree baseline is `5b70fb24f20dbc52ee321e2b4717011341e19c6f`; installed 0.11.0 and unmerged PR #15 are distinct. Record any subsequently incorporated commit explicitly.
- Keep current sender/frame/path/symlink validation, sandboxing, credentials, pre-dispatch durability, bounded orchestration, separate consequential-action approval and editor stale-write protection.

## Review Focus

1. Missing/duplicate message IDs in legacy data must not select an ambiguous reply (Task 2).
2. A disk-full/error between migration backup and acceptance must preserve the original profile and avoid false success (Tasks 1–2).
3. Two windows submitting older context/draft revisions must not overwrite newer input or clear it after a launch (Task 3).
4. Removed project/task references and a Settings round-trip must retain an explicit safe return rather than open another project (Tasks 3–4).
5. Companion/room/restart event replay must not celebrate twice or turn visual Pause into backend Stop (Task 5).

---

## Delivery window and review handoff

The current core-work window ends **20:54:36 UTC**, followed by the authorized visual-concept hour ending **21:54:36 UTC**. The time window is a prioritization boundary, not permission to bypass plan review or promise the entire vision. Preserve the user's parallel-worker preference: recommend subagent-driven execution with independent task review, parallel only for disjoint files after shared contracts are settled. The root owns integration/review/commits and reliability evidence.

First target Tasks 1–4: a bounded mission vertical slice with stable selected-result acceptance, durable context and a useful log. Task 5 follows only if those gates pass with time remaining; otherwise it is the immediate follow-on. Task 6 validates the delivered increment, including a deliberately smaller candidate if the room is not ready. Stop starting new architectural work near the boundary; report tested commits, evidence and unfinished gates. Never ship half-written schema/UI to meet the clock.

The later visual hour prepares a small set of ship/workshop/crew/UI concepts grounded in current art and the admitted geometry, then obtains concept review. It does not authorize unseen art choices, broad generation or installed cutover. Existing-art workshop composition is already within this plan; a visual-style upgrade remains a separate concept gate.

## Ownership and dependency graph

`1 → 2 → 4 → 5 → 6`, with `1 → 3 → 4`; Task 2 and Task 3 can be developed in parallel only after Task 1 interfaces are reviewed, using separate worktrees or agreed exclusive file ownership. Their shared Hub/main/shared.ts integration is serial and root-owned. Reliability profiling is an independent evidence lane; its changes to `desktop/main.cjs`, `desktop/hub.cjs` or diagnostics must be integrated before workers touch those files. One writer per subsystem.

| Unit | Files and responsibility |
| --- | --- |
| Compatibility | New `desktop/mission-profile.cjs`; `desktop/missions.cjs`, `desktop/main.cjs`: verified copied-profile upgrade, version guard, preserved legacy acceptance |
| Result authority | New `desktop/mission-results.cjs`; `desktop/hub.cjs`, `desktop/missions.cjs`, `src/shared.ts`: membership/content validation, selected result and atomic acceptance |
| Presentation durability | New `desktop/workspace-state.cjs`; Hub/main/shared/useSunny wiring: context, drafts, save health and celebration-seen metadata |
| Continuous journey | New `src/workContext.ts`, `src/components/CaptainLog.tsx`, `src/components/captain-log.css`; App/Home/MissionBoard/Workbench/taskFlow: one context, log and direct controls |
| Truthful scene | New `src/missionProjection.ts`, `src/components/FrankyWorkshop.tsx`, `src/components/franky-workshop.css`; roomActivity/crewLife/DeckCrew/Companion: shared projection and acceptance-only presentation |
| Evidence | Tests named below; new `scripts/mission-deck-check.cjs`; `desktop/workflow-smoke.cjs`; evidence/docs: isolated desktop journey, geometry and candidate proof |

## Shared data contracts

These names and shapes are fixed for cross-task work; runtime validation remains mandatory.

```ts
type MissionResultRef =
 | {kind:'reply'; taskId:string; messageId:string; sha256:string}
 | {kind:'deliverable'; artifactId:string; sha256:string};
type MissionResult = {id:string; attemptId:string; producerTaskId:string;
 ref:MissionResultRef; selectedAt:number};
type MissionAcceptance = {id:string; actor:'captain'; attemptId:string;
 reviewedRevision:number; resultId:string; resultSha256:string;
 criteria:boolean[]; acceptedAt:number; prArtifactId?:string};
type WorkContext = {projectId:string; missionId?:string; attemptId?:string;
 taskId?:string; surface:'deck'|'workbench'|'franky';
 returnTo:{view:string; projectId?:string; missionId?:string; taskId?:string}};
type WorkspaceDraft = {id:string; kind:'brief'|'message'; projectId:string;
 taskId?:string; title?:string; text:string; criteria?:string[];
 completionBoundary?:'review'|'merge'; revision:number; updatedAt:number};
type WorkspaceState = {version:1; revision:number; context:WorkContext|null;
 drafts:WorkspaceDraft[]; seenAcceptanceIds:string[]};
```

MissionBook becomes `{version:2, missions:Mission[], workspace:WorkspaceState}`. `Mission` gains `selectedResult?:MissionResult`, `acceptance?:MissionAcceptance | LegacyAcceptance`, and `acceptedAt?:number`; `LegacyAcceptance` is the preserved version-1 receipt plus `legacy:true`, never a manufactured result binding. `MissionAttempt` gains `requestedChanges?:string` for explicit bounded rework. Existing `Message.id` is reused without changing transcript content. Existing deliverable/image artifacts are referenced; no new artifact kind. A selected reply must have exactly one matching nonempty assistant message in a finished active-attempt task. Missing/duplicate IDs are unavailable for selection. Bind message content by SHA-256 of UTF-8 text, not array position. A deliverable's producerTaskId must be supplied and validated against active-attempt task membership because current artifact producer text is not a task ID.

Workspace limits: at most 50 drafts, 50,000 UTF-16 code units of text per draft, 200 code units for title, 20 criteria of 2,000 code units each, 1 MiB serialized draft aggregate; at most 500 seen acceptance IDs. Reject a limit-exceeding write and keep current input in memory with export/unsaved feedback; never silently evict a useful draft. Revision is compare-and-swap. No provider/model/tool configuration is accepted in these presentation commands.

## Task 1: Versioned profile compatibility and verified backup

**Files:** Create `desktop/mission-profile.cjs`, `tests/mission-profile.test.cjs`; modify `desktop/missions.cjs:MissionBook constructor`, `desktop/main.cjs:startup/app:export`, `src/shared.ts:mission contracts`.

**Interfaces:** Export `inspectMissionProfile(saved:object): {mode:'empty'|'v1-upgrade'|'v2'|'unsupported'}`; `writeVerifiedBackup(saved:object, backupDir:string): {path:string;sha256:string}`; `upgradeMissionProfile(saved:object, receipt:{path:string;sha256:string}):object`. Upgrade returns a cloned full state with MissionBook v2 and empty workspace. MissionBook accepts v2 only; this module handles v1 before construction. Fresh profiles create v2 without a migration backup. Existing v1 profiles require a verified full-state backup before their first upgraded write. Unknown/newer data is preserved and startup offers a recovery error with no writable Hub.

- [ ] Write `v1_upgrade_preserves_tasks_and_legacy_acceptance`, `backup_failure_writes_nothing`, `unknown_version_never_starts_hub`, `old_reader_rejects_v2_before_save` in `tests/mission-profile.test.cjs`. Assert deep equality of transcript/project/artifact data, `legacy === true`, no selected result, original input unchanged, zero store writes after backup failure. Execute the baseline v1 MissionBook from `git show 5b70fb2:desktop/missions.cjs` in an isolated test helper; assert it throws on version 2 before any save is called.
- [ ] Run `node --test tests/mission-profile.test.cjs`; expect failures for missing exports/v2 handling, not an unrelated environment failure.
- [ ] Implement profile inspection, exclusive backup write/read/hash verification and pure v1 upgrade in `desktop/mission-profile.cjs`. Verify receipt bytes equal the exact pre-upgrade state before returning it. Preserve unsupported fields/data; fail closed on unsupported mission version or malformed authority data. Integrate before Hub construction, and include v2 workspace in `app:export`. A backup is application-state recovery evidence; separately preserve a stopped SQLite/WAL/JSON profile directory copy before any real cutover. Never copy a live DB as a rollback proof.
- [ ] Run profile tests plus `tests/core.test.cjs`, `tests/missions.test.cjs`, `tests/mission-hub.test.cjs`; update only version-specific fixtures, preserving their behavior assertions. Expect all pass, including failed migration and backup-tampering cases.
- [ ] Root reviews exact diff, schema/backup/rollback note and compatibility evidence; commit only this task's files with `feat: version mission profile with verified upgrade backup`.

**Deliverable:** Independently tested v2 loader/export with non-destructive v1 upgrade and baseline older-reader rejection. No installed-profile migration.

Test assertion anchors after constructing the named fixtures:
```js
assert.equal(upgraded.missionBook.version,2);
assert.deepEqual(upgraded.tasks,original.tasks);
assert.equal(upgraded.missionBook.missions[0].acceptance.legacy,true);
assert.throws(()=>new BaselineMissionBook(upgraded.missionBook),/Unsupported/);
assert.equal(writesAfterBackupFailure,0);
```

## Task 2: Selected result and atomic captain acceptance

**Files:** Create `desktop/mission-results.cjs`, `tests/mission-results.test.cjs`; modify `desktop/hub.cjs:acceptMission/new selectMissionResult/startMission`, `desktop/missions.cjs:begin/accept`, `desktop/mission-roles.cjs:missionContext`, `desktop/main.cjs:mission actions`, `src/shared.ts`; extend `tests/mission-hub.test.cjs`, `tests/approval-boundary.test.cjs`.

**Interfaces:** `resolveMissionResult({mission,tasks,ref,producerTaskId,readArtifact}):Promise<{producerTaskId:string;ref:MissionResultRef}>` validates membership and content; readArtifact returns fresh `{sha256:string}` through existing guarded deliverable/image readers. `Hub.selectMissionResult({missionId,revision,ref,producerTaskId}):Promise<Mission>` creates a stable result ID and persists selection. IPC `mission:selectResult` accepts exactly that input. `mission:accept` becomes `{missionId,revision,resultId,resultSha256,criteria}`. `MissionBook.accept(id,revision,criteria,resultProof,mergedProof?)` consumes Hub-resolved proof for the exact selected result, persists the receipt and completion together; all existing merge/check requirements remain. Existing `mission:start` additionally accepts optional `requestedChanges:string` (nonempty, max 50,000 code units), only for explicit rework from WAITING_FOR_REVIEW; store it on the new attempt before dispatch and include it in `missionContext(mission,route)` as attributed captain changes, keeping objective/criteria unchanged. A changed objective requires a new brief rather than pretending bounded rework changed acceptance scope.

- [ ] Write `reply_reference_requires_unique_finished_attempt_message`, `changed_reply_or_file_cannot_accept`, `unattached_result_cannot_accept`, `acceptance_save_failure_rolls_back`, `new_attempt_clears_selection`, `rework_prompt_persists_on_new_attempt_before_dispatch` tests. Use existing mission-hub fixtures: assert missing/duplicate IDs, user/system messages, external task, wrong project/attempt, changed SHA and absent producer membership reject; a specific finished reply and fresh deliverable each accept with matching receipt/result IDs. Empty artifact arrays plus criteria alone now reject. Save failure leaves WAITING_FOR_REVIEW, no acceptance/completion event and no released uncertain reservation. Rework creates a distinct attempt with exact requestedChanges in saved state/provider context, leaves old artifacts/objective/criteria unchanged, and rejects invalid phase or stale revision.
- [ ] Run `node --test tests/mission-results.test.cjs tests/mission-hub.test.cjs`; expect missing result API/old acceptance behavior failures.
- [ ] Implement resolver and exact-field IPC/Hub validation. Selection/acceptance acquire the existing mission/project gate; recheck mission revision after async reads. Accept only the active selected result proof and current sha; use `missionMutation` for rollback. Preserve v1 legacy receipts; clear selection on explicit new attempt without deleting historical artifacts/acceptance. Tighten message-selection errors without rewriting messages or adding provider runs.
- [ ] Run result, mission-hub, missions, mission-workflow, approval-boundary, mission-merge and image/deliverable tests. Update prior acceptance fixtures to explicitly select their result instead of weakening the new requirement. Assert existing coordinated order remains Nami plan → Franky work → Usopp validate → Zoro review beneath Luffy.
- [ ] Root reviews authority, stale/race/replay cases and commits `feat: bind captain acceptance to selected result`.

**Deliverable:** Real reply/file identity binding; no criterion-only acceptance, false completion or publication side effect. Task 4 consumes the APIs unchanged.

```js
assert.equal(accepted.acceptance.resultId,accepted.selectedResult.id);
assert.equal(accepted.acceptance.resultSha256,accepted.selectedResult.ref.sha256);
assert.equal(failedSaveMission.status,'WAITING_FOR_REVIEW');
assert.equal(failedSaveMission.acceptance,undefined);
assert.notEqual(reworkAttempt.id,previousAttempt.id);
assert.equal(reworkAttempt.requestedChanges,'Keep the saved items after reload');
```

## Task 3: Durable context, drafts and receipt ownership

**Files:** Create `desktop/workspace-state.cjs`, `tests/workspace-state.test.cjs`; modify `desktop/hub.cjs:persist/new workspace methods`, `desktop/main.cjs:workspace IPC/publicState/app:export`, `src/shared.ts:Snapshot`, `src/useSunny.ts:event handling`; extend `tests/reliability.test.cjs`.

**Interfaces:** Pure `applyWorkspaceUpdate(current:WorkspaceState, update:{expectedRevision:number;context?:WorkContext|null;draft?:WorkspaceDraft;deleteDraft?:{id:string;expectedDraftRevision:number};seenAcceptanceId?:string}, state:Snapshot):WorkspaceState`. `Hub.updateWorkspace(input):WorkspaceState` validates, persists atomically and broadcasts. IPC `workspace:update` accepts exactly the update shape; `workspace:get` returns state. Snapshot adds `workspace:WorkspaceState` and `persistence:{state:'saved'|'unsaved';failures:number}`. `Hub.claimAcceptanceCue({acceptanceId}):{play:boolean}` / IPC `workspace:claimAcceptanceCue` persists first and returns true to only the first caller; false for legacy/seen/unknown IDs or reduced motion. Capture saved/unsaved via existing persistence retries, not another timer system.

- [ ] Write `two_windows_cannot_overwrite_newer_draft`, `older_launch_response_cannot_clear_edited_draft`, `restart_keeps_draft_without_dispatch`, `deleted_reference_is_explicitly_unavailable`, `limits_keep_input_without_dispatch`, `receipt_claim_is_atomic_across_surfaces`. Assert CAS rejection, draft-delete revision check, exact limits above, workspace export/restore equality, zero provider/terminal calls on restore, one cue claim, and no saved acknowledgement on disk failure.
- [ ] Run `node --test tests/workspace-state.test.cjs tests/reliability.test.cjs`; expect missing APIs/state assertions to fail.
- [ ] Implement bounded workspace state and identity checks. Invalid/deleted references retain their IDs for labelled unavailable UI; do not substitute another project. Store workspace inside MissionBook v2 so old-reader rejection protects it too. Save via rollback-aware Hub mutation; draft writes never launch work. Reject stale windows with latest state for a user-visible retry; preserve in-memory edits rather than automatically overwriting the newer draft. Export a single unsaved draft locally through existing safe save dialog with a new exact action `workspace:exportDraft {draft:WorkspaceDraft}` (no project file write).
- [ ] Run workspace/reliability/profile/upgrade tests. Add persistent unsaved-state snapshot/event tests after retry success, while retaining current 250 ms/1000 ms checkpoint and bounded retry behavior until measured profiling justifies another change.
- [ ] Root reviews persistence/privacy/retention and commits `feat: persist mission context and bounded drafts`.

**Deliverable:** Restart-safe inspection context and drafts, explicit unsaved health and globally claimed acceptance cues. No automatic resume or file-buffer guarantee.

```js
assert.deepEqual(restored.workspace.drafts,saved.workspace.drafts);
assert.equal(providerCallsOnRestore,0);
assert.deepEqual(cueClaims.map(x=>x.play),[true,false]);
assert.equal(diskFailureSnapshot.persistence.state,'unsaved');
assert.equal(draftAfterStaleClear.text,'Newer captain input');
```

## Task 4: Continuous shell, captain log and complete mission journey

**Files:** Create `src/workContext.ts`, `src/components/CaptainLog.tsx`, `src/components/captain-log.css`, `tests/work-context.test.cjs`; modify `src/App.tsx`, `src/views/HomeView.tsx`, `src/views/MissionBoard.tsx`, `src/views/Workbench.tsx`, `src/taskFlow.ts`, `src/useDraft.ts`, `src/components/Chrome.tsx`; extend `tests/task-flow.test.cjs`; create `scripts/mission-deck-check.cjs` using current native fixture harness patterns.

**Interfaces:** `resolveWorkContext(context:WorkContext|null,snapshot:Snapshot):{context:WorkContext|null;unavailable?:string}` never silently substitutes IDs. `CaptainLog({snapshot,context,onContext,onOpenResult,onRequestChanges,invoke})` consumes Tasks 2–3 contracts and renders title/project/objective/criteria, actual stage owner, activity, selected result and next action. `Workbench.initial` gains missionId/attemptId and `embedded?:boolean`; `onClose` restores `context.returnTo`, preserving existing tools/editor protections. `useDraft` gains an optional workspace-backed draft identity while existing nonmission session behavior remains supported.

- [ ] Write pure tests `settings_return_preserves_selected_attempt`, `missing_project_never_opens_first_project`, `ready_review_stays_actionable`, `ordinary_conversation_stays_conversation`; assert IDs/return target retained and review queue separate from accepted history. In the native check, add named assertions for mission brief persistence, keyboard open/return, selected reply/file display, direct Stop/approval and no second task on reload. Capture baseline failures before UI edits.
- [ ] Run `node --test tests/work-context.test.cjs tests/task-flow.test.cjs` and the isolated native check; expect new context/log assertions to fail, while harness connectivity failure is reported separately.
- [ ] Implement the continuous App shell: default deck, embedded Workbench, persistent CaptainLog, searchable attention/active/review/accepted list. Keep direct Settings/Files/Git/terminal/preview and return control. Primary goal saves a tracked brief, then starts existing `mission:start` with `roleId:'coordinator'` after explicit confirmation/skills readiness. Use existing MissionBoard criteria/start/recovery controls rather than duplicate authority logic. Luffy coordinates real Nami/Franky/Usopp/Zoro stages. Show ordinary tasks as Conversation. Result selection uses Task 2; requesting changes uses its `mission:start` requestedChanges contract after explicit confirmation and existing launch/recovery restrictions. Revision input is persisted as a message draft without mutating immutable old evidence.
- [ ] Move brief/message draft use to Task 3 APIs for the primary journey, preserving local text on rejected writes and clearing only the exact submitted draft revision after durable success. Preserve unsaved editor confirmation when navigating away; do not claim file-buffer restart survival. Compose opaque log beside scene; compact/short mode leads with log and collapses scene. Keyboard focus returns to opener; aria status announces phase changes, not every stream token. Relevant engineering checks/publish/merge remain expandable and retain distinct approvals.
- [ ] Run focused tests, `npm run build` and isolated native check at 1424×961, minimum supported window measured from current BrowserWindow settings, short window and 200% text. Verify no horizontal overflow/overlapping targets; all workflow actions reachable without scene walking. If native `Runtime.evaluate` times out, retain the artifact/error and verify process health separately; do not mark assertions passed.
- [ ] Root reviews rendered evidence and mission authority boundaries; commit `feat: keep captain log across mission navigation`.

**Deliverable:** Tested existing-art vertical slice. Before room work, demonstrate saved brief → real linked stages → selected result → revision/new attempt → result-bound acceptance through the log. Provider account-dependent live proof is a separate explicitly initiated fixture run; synthetic transport must be labelled synthetic.

```js
assert.equal(returned.context.missionId,original.context.missionId);
assert.equal(returned.context.attemptId,original.context.attemptId);
assert.equal(missingProject.context.projectId,'removed-project');
assert.match(missingProject.unavailable,/unavailable/i);
assert.equal(dispatchCountAfterReload,dispatchCountBeforeReload);
```

## Task 5: Shared projection and Franky's one-room pilot

**Files:** Create `src/missionProjection.ts`, `src/components/FrankyWorkshop.tsx`, `src/components/franky-workshop.css`, `tests/mission-projection.test.cjs`, `tests/franky-workshop.test.cjs`; modify `src/roomActivity.ts`, `src/crewLife.ts`, `src/components/DeckCrew.tsx`, `src/Companion.tsx`, `src/App.tsx`; extend native check; update `docs/art-bible.md`, `docs/world-bible.md`, `public/assets/ARTWORK.md` only with admission evidence.

**Interfaces:** `projectMission(snapshot:Snapshot, context:WorkContext):MissionProjection`, where projection is `{missionId?:string;attemptId?:string;taskId?:string;crewId?:string;state:'idle'|'starting'|'working'|'input'|'approval'|'waiting'|'unknown'|'failed'|'stopped'|'review'|'accepted';label:string;working:boolean;acceptanceId?:string;result?:MissionResult;stage?:'plan'|'work'|'validate'|'review'}`. Explicit context wins; approvals/unknown override active motion; no text inference. `FrankyWorkshop({projection,reducedMotion,paused,onInspect,onApproval,onStop,claimAcceptanceCue})` uses this contract. `FRANKY_ROOM_GEOMETRY` declares measured normalized `rest`, `bench`, `path`, `actorBounds`, tied to image sha and full 3:2 canvas; no quarter-room coordinates.

- [ ] Write projection/scene tests for every state, selected attempt versus unrelated newer task, approval/unknown precedence, Nami/Usopp/Zoro stages without Franky building, finished-turn-without-acceptance, receipt replay, reduced motion, and visual Pause. Assert `working === false` for all attention/review/accepted states, no crew animation completion changes backend state, pause triggers zero interrupt calls, and only successful first cue claim allows celebration.
- [ ] Run scene tests; expect absent projection/component helpers to fail. Produce a contact overlay for exact `franky-shipwright-room.png` SHA `E29915E79F9A279AF61EF490E51527190A87BBE7AF941F962D6702419D051A8C`: measure workbench/floor bounds, clear approach, rest/bench foot anchors, sprite extents. Root visually reviews overlay before motion geometry is admitted. No fabricated guessed coordinates.
- [ ] Implement uncropped letterboxed room beside opaque log using existing Franky atlas. Animate only authoritatively active Franky work; stop for Den Den Mushi input/approval, wait, fail, unknown or stopped state. Ready to review is still and labelled. Claim persisted acceptance cue before one restrained local celebration; no borrowed signature atlas row. In reduced motion use stationary truthful anchors and no loops/cue motion. Pause stops only visuals. Use shared projection in relevant deck/room/companion; remove finished-turn mission victory trigger while preserving separately labelled ambient entertainment.
- [ ] Run focused scene tests and native captures for idle/starting/work/input/approval/wait/failure/unknown/review/accepted, then repeat reduced motion, pause, companion claim and restart/replay. Verify unclipped head/hands/feet, attached ground shadow, no crossing furniture, focus and labels readable at Task 4 sizes. Update all three art/world/provenance records with exact geometry/admission evidence, retaining original art hash/source.
- [ ] Root performs visual/truth review and commits `feat: visualize accepted work in Franky workshop`.

**Deliverable:** One honest room with accepted-result-only celebration. Other rooms, new art/style concepts and generation remain follow-on.

```js
assert.equal(approvalProjection.state,'approval');
assert.equal(approvalProjection.working,false);
assert.equal(finishedUnacceptedProjection.state,'review');
assert.equal(reducedMotionFrame.moving,false);
assert.equal(interruptCallsAfterVisualPause,0);
assert.equal(celebrationsAcrossRoomCompanionRestart,1);
```

## Task 6: Candidate validation and rollback proof

**Files:** Extend `scripts/mission-deck-check.cjs`, `desktop/workflow-smoke.cjs`; add `docs/evidence/sunny-mission-deck-candidate-2026-09-30.json`, `docs/evidence/sunny-mission-deck-candidate-2026-09-30.md`; update README only to describe a validated candidate without switching the installed launcher.

**Interfaces:** Evidence JSON identifies source commit, executable/archive SHA, runtime/package versions, fixture profile/schema, synthetic versus actual provider execution, each assertion's pass/fail/not-run status, migration backup receipt, recovery/load measurements, room geometry and rollback paths. Candidate report links raw results and preserves all unresolved reliability limitations. Do not store private transcript/terminal/file contents or secrets.

- [ ] Extend native fixture to assert reload/main restart preserves uncertain reservations/context and never dispatches again; disk failure cannot accept; file/reply result change rejects; v1 backup→v2→export/restore preserves data; old reader refuses copied v2; pre-upgrade copy opens independently; two surfaces/restart do not duplicate celebration. Use owned isolated processes/profile paths; no installed-app interruption or external send/publish.
- [ ] Run locked installation (if missing/changed dependencies), `npm test`, `npm run build` with README's direct Node/npm CLI on this machine. Run isolated fixture Electron workflow check. No lint script exists; do not invent a passed lint check. The current native timeout is a blocker to affected evidence until independently diagnosed or the check genuinely passes.
- [ ] Measure fixture control p95 acknowledgement (<200 ms) and main event-loop stalls (none >100 ms), with machine/load/duration recorded; distinguish Stop acknowledgement from process termination. Reuse root reliability profiling to avoid duplicate broad scans. If budget fails, stop promotion and record a separately bounded measured fix rather than rewrite persistence unreviewed.
- [ ] Package an identifiable candidate under a new output path only if implemented increment and recovery/load gates pass. Validate exact archive and isolated profile; demonstrate rollback on copies with all tasks stopped/reconciled. Never reuse old-reader profile path for v2. Do not edit launcher, replace installed executable, restore backups onto current profile, push or merge. Unreproduced user crash may permit isolated candidate evaluation after recovery verification, but no fixed claim or cutover on that basis alone. Reproducible crash/hang blocks promotion.
- [ ] Root reviews whole diff and evidence, records delivered/unfinished tasks and commits `test: validate mission deck candidate and recovery`. Request installed-cutover approval only if it is later desired, with current limitations explicit; candidate completion is not install/merge authorization.

**Deliverable:** Reviewable exact candidate evidence or a precise blocked/partial result. If Task 5 is deferred, explicitly label the candidate as mission-flow-only and do not claim workshop acceptance.

```js
assert.equal(reservedAfterRestart,true);
assert.equal(duplicateDispatches,0);
assert.ok(controlAckP95Ms<200);
assert.ok(mainStallsMs.every(ms=>ms<=100));
assert.equal(installedLauncherHashAfterValidation,installedLauncherHashBeforeValidation);
```

## Self-review and execution gate

Coverage: schema/legacy compatibility and backup Task 1; result authority Task 2; durable drafts/context/receipt ownership Task 3; complete journey/direct controls/accessibility Task 4; geometry/truth/motion/art records Task 5; load/recovery/candidate/rollback Task 6. Five Review Focus conditions have named assertions in their owning tasks. Interfaces share the contract names above; no new runtime, framework or dependency is proposed. Follow-on visual concept choice and installed cutover remain separate gates. This plan is comparable in length to its design and contains interfaces/test assertions rather than application bodies.

**Plan review requested before implementation.** Preserve the previously chosen parallel-worker method and use subagent-driven task/reviewer gates with serial integration of shared files. The root asks whether this plan captures the captain's intent; it does not ask the captain to reselect Franky or repeat the already approved direction. No architectural application changes are authorized by merely saving this plan.
