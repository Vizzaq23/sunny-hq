# Sunny Ordered Persistence and Transcript Paging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Sunny responsive as histories grow while preserving every acknowledged save, exact result acceptance and complete accessible transcripts.

**Architecture:** Deliver two separately gated increments: A, one ordered worker owning existing profile validation/serialization/storage; B, revision-bound task summaries and transcript pages for both desktop surfaces. Electron main retains authority and trusted IPC. Increment A can ship without B only if its applicable gates pass; neither is an automatic installer or production release.

**Tech Stack:** Existing Electron 44.4.3, Node 24, CommonJS desktop services, React 19 and strict TypeScript; built-in worker_threads and current SQLite/JSON stores. No new runtime/provider/dependency.

**Spec:** `docs/superpowers/specs/2026-10-01-sunny-responsive-durability-design.md`, captured from approved Library report `libfile_2e2b4dd9af8481918de7bf792f2f7dc5`; its complete proposal is included below so this attachment is self-contained.

## Global Constraints

- Implement only after the user reviews this plan and confirms execution. Preserve the original checkout, installed app and private profile; work on a new isolated feature branch from clean `c674a29210f16bb1fb3a986c5e5990a957e75d9c`.
- Existing source-input build is `493d8e43e75f9e637dab1b2666f3e9a939f9a634383151f1141b9ef3ce6f08c0`. Inspect drift/concurrent work before execution; do not assume prior PRs are integrated.
- Unchanged **main timer excess <=100 ms** and **control acknowledgement p95 <200 ms**, including actual queue waiting; durable completion and snapshot/frame latency remain distinct. Retain all samples, maxima and failures.
- Required dispatch/acceptance/reservation-release/cue barriers await an exact durable receipt. Enqueued or coalesced is not saved; retries perform storage only.
- Preserve WAL/FULL safeguards, current state-row format, v1 verified backup/receipt behavior, v2 authority validation, opaque fields, workspace limits and complete transcripts. No schema rewrite, truncation or new profile-size limit.
- Unknown provider/check/publication outcomes retain reservations. No automatic execution, captain acceptance, merge, push, deployment or installed-app replacement.
- Maintain contextIsolation, sandbox and nodeIntegration settings; main-frame/sender, membership, argument, path and result-hash validation remain mandatory.
- Use disposable fixture databases/profiles and synthetic transport. The user has not authorized new real-provider missions for this slice.
- Run the full Node suite and production build; no configured lint command exists. Do not repeatedly run benchmarks to choose a passing sample.

## Review Focus

1. Newer stream edits arrive while a required save is pending: preserve those edits; never restore an older whole-state image. Tasks A2/A3.
2. Worker commits, then dies before its receipt reaches main: outcome is uncertain; retain reservations and reconcile storage only. Tasks A1/A3.
3. Acceptance content or revision changes across an awaited save: withhold success/cue and revalidate the exact binding. Task A2.
4. A late initial snapshot/page arrives after selection or live updates: retain the latest matching revision; no cross-task transcript overwrite. Tasks B1/B2.
5. Profiles with opaque fields, multibyte text, a huge single message or interrupted migration: preserve exact data and accessible history. Tasks A1/B1/B3.

## Delivery order and ownership

| Stage | Deliverable | Owner and dependencies |
| --- | --- | --- |
| A1 | Ordered worker and profile compatibility | Worker/storage owner |
| A2 | Main authority barriers and asynchronous consumers | Hub owner, after A1 contract review |
| A3 | Boot, shutdown, failures and recovery | Integrator, after A2 |
| A4 | Persistence/native performance gate | Validation owner; no promotion if failed |
| B1 | Summary/page protocol and trusted endpoints | Transcript backend owner; after A contract stable |
| B2 | Main/companion history UI and race handling | Renderer owner, after B1 contract review |
| B3 | Combined evidence, package smoke and rollback | Integrator + independent reviewer |

A is a substantial reliability change; B is a separate substantial data-delivery change. Do not combine them into one large unreviewed commit. The writer itself is not guaranteed to satisfy latency: a 30 MiB full transaction still took more than 200 ms overall in current evidence. If A4 fails, preserve the failing result and propose the next storage design; do not quietly change format or redefine acknowledgement to reach B.

## Shared contract decisions

These signatures describe proposed code, not files already implemented.

- `State` means the complete persisted profile object accepted by `inspectMissionProfile`, including opaque retained fields; public renderer state is a different projection. `BarrierReason` is `workspace`, `dispatch`, `mission`, `check-intent`, `publication-intent`, `acceptance`, `reservation-release`, `cue` or `shutdown`; the caller inventory assigns each required path one explicit reason.
- `openOrderedStore({kind:'sqlite'|'json', file, backupDir, workerFactory?}): Promise<OrderedStore>`.
- `OrderedStore.load(): State` returns only the worker-validated initial cached image; `checkpoint(image:State): Promise<CommitReceipt>`; `barrier(image:State, reason:BarrierReason): Promise<CommitReceipt>`; `flush(): Promise<CommitReceipt|null>`; `close(): Promise<void>`.
- `CommitReceipt = {epoch:string, sequence:number, stateSha256:string, durableAt:number}`. The worker computes SHA-256 over the exact compact saved state; receipt identity is validated on the private worker channel. Epoch/sequence order writes within one process lifetime; they are not a new persisted schema revision or a replacement for mission/workspace revisions.
- Only the worker opens the writable store. It runs current profile preparation/validation before saving. Main owns validated intent, reservations and immutable submitted images; a receipt cannot authorize external actions by itself.
- Keep at most one in-flight full image and one waiting full image. Replace only superseded background checkpoints; required barriers are never coalesced away. Admit at most 16 waiting bounded authority intents without captured full images; saturation rejects before mutation and leaves drafts available for explicit retry. These queue values are implementation-plan choices for review, not existing product limits.
- One `AuthorityCommitQueue.run(reason, prepare): Promise<Result>` owns staged mission/workspace mutation through persistence. `prepare` supplies the proposed immutable image, expected entity revisions, result binding and post-receipt validation. No unresolved Promise may masquerade as the old synchronous save.
- Authoritative success projections and cue playback wait for the receipt. Live stream input remains retained. Conflicting authority changes serialize or invalidate the pending operation; reentrant/newer events cannot trigger an old whole-book rollback.
- Public protocol version 2: `{epoch, sequence, taskSummaries, ...nonTranscriptState}`. A `TaskSummary` retains Task fields except messages, plus `transcriptRevision` and `messageCount`. Persistent Task storage remains unchanged.
- `transcript:page({projectId,taskId,epoch,revision,cursor?,direction:'older'|'newer',limit?})` returns `{epoch,taskId,revision,segments,nextCursor?,previousCursor?,complete}`. Default page 50 messages, maximum 100, at most 256 KiB UTF-8 text per response. Oversized messages are segmented with message ID and character-offset cursors; segments reconstruct exact original text without splitting surrogate pairs. A stale revision returns an explicit stale result and current summary, not an unrelated page.
- Snapshot/event sequence is session-scoped, transcript revisions increase on every message addition/edit/replacement. A bounded `transcript:delta` carries `{epoch,sequence,taskId,baseRevision,revision,kind,messageId,offset?,text?}` with kind `appendMessage`, `appendText` or `invalidate`. Append offsets are UTF-16 character offsets that do not split surrogate pairs; text uses the same 256 KiB response-text bound. The reducer applies only a matching revision chain; missing sequence, replacement or a larger update invalidates affected history and requests a current page. Verified append-only deltas can advance the revision of unaffected older cached pages, so active streaming does not continually erase readable history. Pages cannot grant result authority; acceptance continues to resolve full messages/files in main.

---

## Increment A — ordered persistence and durability

### A1: Worker-owned storage, ordered receipts and bounded checkpoints

**Files:** Create `desktop/ordered-store.cjs`, `desktop/persistence-worker.cjs`; reuse/modify only as needed `desktop/core.cjs`, `desktop/mission-profile.cjs`; test `tests/ordered-store.test.cjs`, `tests/mission-profile.test.cjs`.

**Interfaces:** Produces OrderedStore/CommitReceipt above. Worker owns both SQLite and fallback JSON; missing worker/invalid profile fails initialization clearly, rather than silently returning to synchronous main-thread saves.

- [ ] Write failing tests named `barriers_are_ordered_and_receipts_match_exact_images`, `background_coalescing_preserves_required_barriers`, `inflight_mutation_cannot_change_saved_image`, `commit_without_receipt_is_uncertain`, `opaque_unicode_profile_and_backup_receipt_roundtrip`. Assert exact persisted equality after reopen, no barrier dropped, latest background image survives, and v1 tamper fails before first overwrite.
- [ ] Run `node --test tests/ordered-store.test.cjs tests/mission-profile.test.cjs`; verify the new contract tests fail before implementation.
- [ ] Implement the private worker protocol and queue using existing storage/profile validation. Record pending versus durable state; reject forged/stale epoch/sequence receipts. Close the database only after its accepted barriers drain or a reported failure.
- [ ] Repeat the focused command, including 1/10/30 MiB images and multibyte content correctness. Assert no SQLite/JSON writes run on main after initialization and no journal/durability setting is weakened.
- [ ] Review and commit only these explicit paths as `feat: add ordered worker-owned profile persistence`.

### A2: Preserve main authority across asynchronous durability boundaries

**Files:** Create `desktop/persistence-barriers.cjs`; modify `desktop/hub.cjs`, `desktop/captain.cjs`, `desktop/mission-publisher.cjs`, `desktop/mission-merge.cjs` and actual persist callers found in bounded search; tests `tests/persistence-barriers.test.cjs`, `tests/mission-hub.test.cjs`, `tests/workspace-hub.test.cjs`, `tests/mission-results.test.cjs`.

**Interfaces:** Consumes OrderedStore. Produces AuthorityCommitQueue and Promise-returning Hub persistence/mission/workspace methods; existing IPC action names remain. Document every former synchronous call site and whether it is a background checkpoint or required barrier.

- [ ] Write failing tests `no_dispatch_or_acceptance_before_durable_receipt`, `newer_stream_and_reentrant_edits_survive_barrier_failure`, `changed_result_during_pending_acceptance_withholds_cue`, `authority_sync_after_barrier_is_not_discarded`, `queue_saturation_rejects_before_mutation`. Delay worker responses; assert zero dispatch/acceptance/cue before durability and no older whole-state rollback.
- [ ] Run `node --test tests/persistence-barriers.test.cjs tests/mission-hub.test.cjs tests/workspace-hub.test.cjs tests/mission-results.test.cjs`; verify meaningful pre-implementation failures.
- [ ] Convert required paths to awaited barriers: task/thread/turn start, mission attempt, check/branch/publication/merge intent, workspace save, result acceptance, reservation-release claims and atomic acceptance-cue ownership. Preserve existing provider/action locks and cancellation. Stage authority changes until receipt and revalidate current revision/result binding after awaits; unresolved or superseded work remains visibly pending/blocked.
- [ ] Audit direct and indirect consumers: Captain delegation, provider callbacks, task status/recovery, Island/News/CrewChat writers and native test harnesses. Retain newer stream data and ordered authority reconciliation; every rejected async operation has a handled error. Test approval/Stop under slow persistence without releasing uncertain reservations. Remove only duplicate checkpoints proven to contain already durable state; authority sync/new edits still schedule saves.
- [ ] Pass focused tests plus affected publisher/merge/task suites, independently review the caller inventory and commit explicit paths as `fix: await exact durability before consequential actions`.

### A3: Startup, recoverable failure, shutdown and truthful persistence UI

**Files:** Modify `desktop/main.cjs`, `desktop/hub.cjs`, `src/shared.ts` and existing persistence-status component; create `tests/persistence-recovery.test.cjs`; update relevant native fixture boot/close adapters.

**Interfaces:** Main awaits openOrderedStore before Hub initialization. Controlled shutdown awaits Hub/worker flush and close. Preserve existing visible saved/unsaved semantics and drafts; pending storage is not saved success.

- [ ] Write failing tests `restart_preserves_every_acknowledged_barrier`, `worker_crash_retains_unknown_reservations_and_never_replays`, `shutdown_during_save_preserves_pending_drafts`, `disk_failure_storage_retry_has_zero_external_calls`, `failed_boot_never_overwrites_unsupported_profile`.
- [ ] Run `node --test tests/persistence-recovery.test.cjs tests/workspace-hub.test.cjs`; observe failures before implementation.
- [ ] Wire awaited boot/quit lifecycle without installing/replacing the app. A failed or timed-out flush does not claim success or discard unsaved text. Reopen a worker only through a controlled storage reconciliation path; do not reconnect/replay a possibly started external operation.
- [ ] Pass focused tests with disposable SQLite/JSON, force worker death before/after commit, reopen exact data and validate backup hashes. Update affected fixtures to await close; assert no worker/service remains after test completion.
- [ ] Independent recovery review, then commit explicit paths as `fix: preserve durable recovery across persistence worker failures`.

### A4: Measure the actual increment and retain the release restriction if needed

**Files:** Update `scripts/persistence-profile.cjs`, `scripts/mission-deck-check.cjs`, bounded IPC/native fixture; add source-bound results under `docs/evidence/` and a concise README status.

**Interfaces:** Consumes production A1–A3 APIs. Record main queue/handoff, worker serialize/write, exact durable completion and actual renderer control RTT separately.

- [ ] Add failing regression checks for the synchronous-write regression and missing queue-wait accounting; do not alter the existing <=100 ms and <200 ms limits.
- [ ] Run focused regressions, then full `npm test` and `npm run build`; expected zero failures/skips introduced and a fresh identifiable source build.
- [ ] Freeze one candidate and predeclare one comparable 1/10/30 MiB sample matrix. Retain every timer and receipt, use meaningful p95 sample counts, and measure real Stop/approval end-to-end acknowledgement under slow storage. Do not substitute quick “request admitted” feedback for the existing completion acknowledgement.
- [ ] Run the native journey **including `--room`** in the supported normal desktop context with owned profiles/watchdogs, synthetic transport and unchanged security/GPU settings. Include cross-surface cue/replay and recovery. Preserve prior failures and report exact workload/build differences.
- [ ] If any required performance/correctness gate fails, stop promotion and write a measured follow-on design request; do not change schema or metrics under this plan. Otherwise independently review results and commit the evidence/status update.

---

## Increment B — revision-bound summaries and complete transcript paging

### B1: Trusted summaries, paged history and event ordering

**Files:** Create `desktop/transcript-pages.cjs`, `desktop/state-projection.cjs`; modify `desktop/main.cjs`, `desktop/broadcast.cjs`, `desktop/hub.cjs`; tests `tests/transcript-pages.test.cjs`, `tests/state-projection.test.cjs`, trusted IPC tests.

**Interfaces:** Produces public protocol version 2, TaskSummary and transcript:page above. Storage and main result resolver retain complete Task.messages. One main producer owns epoch/sequence ordering.

- [ ] Write failing tests `summary_has_no_transcript_or_private_rpc_fields`, `page_rejects_wrong_project_frame_and_revision`, `pages_reconstruct_complete_unicode_and_huge_message`, `replacement_increments_revision`, `deleted_task_invalidates_cursor`, `bounded_append_delta_preserves_older_history`. Check limits, exact concatenated history and no cross-project leakage; stable cursors anchor message identity/character offset rather than a shifting array index.
- [ ] Run `node --test tests/transcript-pages.test.cjs tests/state-projection.test.cjs` plus trusted IPC regressions; verify failures before implementation.
- [ ] Implement per-task summaries and size-bounded pages; validate all fields, membership and sender in main. Opaque full profile data remains stored, not broadly exposed. Initial/public updates carry epoch/sequence; transcript-free events invalidate or update visible history without sending the entire task.
- [ ] Pass tests over 100/1000/3000 tasks and giant multibyte messages. Keep full-message/file resolution in main for selection, exact hashes and acceptance; untrusted page content cannot substitute for that proof.
- [ ] Review the contract with the renderer owner before commit `feat: expose revision-bound transcript summaries and pages`.

### B2: Main and companion consume pages without losing selection or drafts

**Files:** Create `src/transcriptState.ts`, `src/useTaskTranscript.ts`; modify `src/shared.ts`, `src/useSunny.ts`, `src/views/Workbench.tsx`, `src/Companion.tsx` and actual full-message consumers identified in a bounded inventory; tests `tests/transcript-state.test.cjs` and existing workspace/mission UI regressions.

**Interfaces:** Consumes protocol v2 and page action. Produces `useTaskTranscript({projectId,taskId,epoch,revision})` with `segments, loading, error, loadOlder, loadNewer`; loading state does not manufacture a Message[] or a result.

- [ ] Write failing reducer/UI regressions `late_initial_snapshot_does_not_replace_newer_event`, `old_page_cannot_replace_new_selection`, `stream_edit_during_load_invalidates_stale_page`, `transcript_navigation_preserves_unsent_draft`, `missing_history_has_visible_recovery`, `append_chain_preserves_readable_older_pages_and_gap_resyncs`.
- [ ] Run `node --test tests/transcript-state.test.cjs tests/workspace-draft-ui.test.cjs`; confirm failures before implementation.
- [ ] Replace renderer full-task message assumptions with summaries and the selected-task loader. Show clear loading/retry/older-history controls, retain keyboard focus and readable state; cache only current selected pages plus adjacent pages, clearing stale epochs/revisions. Main and companion share the same reducer/contract.
- [ ] Pass reducer and native navigation tests: complete older history can be reached, oversized message segments read in order, reply selection resolves exact main-held content, reload/selection cannot cross-bind pages, drafts survive failures and reduced motion remains intact.
- [ ] Independent renderer review and full typecheck/build; commit explicit paths as `feat: load complete task history through revision-bound pages`.

### B3: Combined acceptance, packaged smoke and rollback proof

**Files:** Native fixture/evidence and README status; existing package configuration only if worker-file inclusion needs an explicit change. No production profile or installer replacement.

**Interfaces:** A and B production contracts, exact build identity and backup receipt.

- [ ] Pin regressions for worker packaging, history reconstruction, mismatched protocol startup and retained uncertain reservations; verify they fail against missing/broken behavior.
- [ ] Run full `npm test`, `npm run build`, independent whole-branch review and explicit diff/secret exclusions.
- [ ] Freeze one final candidate; measure comparable transcript-shaped 1/10/30 MiB persistence and 1.7/17.4/52.2 MB snapshot workloads, including acknowledged-save durability and actual Stop/approval under combined load. Retain all samples and source/runtime/workload metadata; compare like-for-like, not historical dirty builds as if current.
- [ ] Only after those gates pass, package to a new output path. Run package boot/renderer+main recovery on a **stopped copied** owned profile with verified full-state backup; preserve unknown reservations, no automatic dispatch and full accessible history. Verify worker startup from ASAR and clean owned-process shutdown.
- [ ] Commit reviewed evidence and a rollback note. Keep the candidate local. User installation approval is separate; no push/merge/deployment is implied.

## Rollback and stop conditions

Increment A initially preserves the existing state row and current profile format; B changes public IPC only. Rollback means close the candidate, verify no writer remains and launch the previous candidate on a stopped verified **copy** whose content/schema that candidate supports. Never run two writers against one profile, copy a live WAL, restore an older backup over newer work, or assume format compatibility alone proves runtime safety.

If a barrier outcome is unknown, retain reservations and inspect saved state; do not replay its external command. If queue/handoff or durable latency misses budget, record failure and request a separate storage/delivery design. If any change requires a new schema, relaxing safeguards or replacing the installed app, stop that part for approval.

## Recommended execution

Use the user's preserved parallel-agent preference: a high-reasoning owner for worker/authority correctness; medium-reasoning owners for bounded renderer and test work; low effort for mechanical logs/inventory. Give A2 and A3 **one Hub/main integration owner**, so workers do not edit the same subsystem. After A's contracts are reviewed, B1 backend and B2 renderer may work in separate worktrees against the frozen interface; the coordinator integrates and an independent reviewer checks each increment and the final branch. Performance runs are serialized.

Planning does not start those workers or product edits. **Review this plan and confirm parallel execution before implementation.** This follows the writing-plans gate; the user's earlier parallel preference is preserved rather than treated as permission to skip review.

## Planning self-review

Approved constraints map to A1–A4 and B1–B3: ordering/receipts and compatibility (A1), effect barriers/CAS/newer edits (A2), failure/restart/shutdown (A3), unchanged measurements (A4), full history and trusted ordering (B1), both surfaces/drafts/accessibility (B2), package/rollback/combined proof (B3). All five Review Focus items have named tests. Shared signatures and property names are consistent. No architecture was implemented and no current passing performance result is promised.

## Approved design carried with this plan

### Proposed next reliability slice — written review required

**Recommendation: design an ordered persistence worker first, with the current storage format retained initially.** Required SQLite writes already exceed the budget; reducing redundant checkpoints cannot resolve that mechanism. Then assess revision-bound transcript paging as a separate slice for the independent full-snapshot limit. These are proposals for review, not an approved implementation plan.

| Approach | Benefit | Limitation / relative effort |
| --- | --- | --- |
| Keep synchronous storage and remove only proven duplicate checkpoints | Fewer repeated pauses, smallest behavior change | Required large saves still fail; low-to-medium effort with revision/reentrant-edit tests |
| Ordered persistence worker, explicit durable receipts | Removes serialization/database work from the main event loop while preserving authority | New asynchronous failure/ordering boundary; high effort; clone/handoff cost still needs measurement |
| Task summaries and revision-bound transcript pages | Bounds startup/broadcast/visible-history delivery without discarding history | Separate shared main/companion contract; high effort; does not fix synchronous storage by itself |

The worker design should keep validated mission/task authority in main, use exact revision identities and immutable payload ownership, and acknowledge a save only after its required transaction is durably committed. Provider dispatch, captain acceptance acknowledgement, reservation-release claims and acceptance celebration must await that exact receipt. A queued write is not saved work. Background edits may coalesce only when no required barrier or newer state is discarded. Queue memory/backpressure must be bounded and surfaced; retries perform storage only, never replay provider commands, checks or approvals.

Worker death, disk failure and shutdown must preserve visible unsaved state and newer input. Unknown provider outcomes retain reservations. Restart must recover the last acknowledged revision without inventing success, silently reexecuting a mission or replaying accepted celebrations. Keep WAL/FULL safeguards, backup/receipt verification, opaque fields and installed-profile rollback boundaries. Do not remove full-state cloning without replacing its ownership guarantee.

For paging, summaries and pages must share a stable revision/selection identity. Late pages cannot replace a newer selected task or result; live updates must reconcile with the initial page. Complete older history stays accessible, result/hash authority stays in main, and both the main app and companion must agree. Truncation to satisfy a benchmark is unacceptable.

Acceptance before promotion:
- Comparable transcript-shaped 1/10/30 MiB persistence and 1.7/17.4/52.2 MB snapshot workloads on one identified candidate; all raw samples, maxima and failures retained.
- Unchanged **main timer excess <=100 ms** and **control acknowledgement p95 <200 ms**, with queue wait included for actual controls; durable completion and snapshot/frame latency reported separately.
- Write failure, worker death, backpressure, concurrent edits, reentrant callbacks, shutdown/restart and unknown reservations tested; every acknowledged required save survives and no automatic dispatch/acceptance occurs.
- Exact full history, stale-page rejection, drafts/context, accepted-result bindings and both surfaces verified.
- Finally, a separately identified packaged candidate smoke/recovery test on a stopped copied profile; installation remains a separate user decision.

This introduces architecture beyond the earlier mission-deck plan. The [brainstorming skill](skill://plugins~Plugin_60aea7460bd4819199fd97a9553a5e12/brainstorming/SKILL.md) requires the user to "review and approve the written spec, then review the written implementation plan and select its execution method." The parent's explicit instructions preserve the same gate. No architecture implementation or plan execution is being inferred from broad reliability approval.
