# M2 — Ship's diagnostic timeline, 2026-11-07

## Final application evidence — 2026-11-08

Implementation `b1e2d441f47691261ec937e93f4d9c2bcf076b04` passed **1,755 tests** (798 + 957), with zero failures, cancellations or skips, both clean Node 24.18 installs, builds/typechecks and hidden native workflows. All 1,735 M1 top-level tests remain, with nine diagnostic regressions and one deterministic checkpoint-race regression added. See the [final verification receipt](evidence/diagnostic-timeline-2026-11-07/verification-final.json) and its two shard summaries.

The [final real Codex receipt](evidence/diagnostic-timeline-2026-11-07/live-checkpoint-fixed.json) was captured on that clean source: all four approval/reconnect cases passed, fixture effects were 1/0/0/1, and all owned processes exited. SHA256: `c8c6b7725fdb304234434084983421bbaa313effaa1f3015f58df4efd9f795e0`. Pending approval replay remains unverified; reconstruction of the saved Hub is not an installed-desktop restart claim.

Both hosted builds have fingerprint `13f10935e05e7320b11c95035c3737f68052c6d6d0db5055066ece303f54ee13`; local build/typecheck passed with `78f59ce169e93c039b4414baf83084e93e5b56c7aa84de148529a1d4f95e5ee7`. These identify different checkout bytes; no byte-identical local/hosted build claim is made.

**CI status limitation:** [run 42446494984](https://github.com/Vizzaq23/sunny-hq/actions/runs/42446494984) is still marked failed because its separate aggregate job recorded no steps and had no retrievable logs, both initially and on an aggregate-only retry. Both actual validation shards are successful. The cause is unverified: the available connector cannot read check annotations and the browser is signed out. No check was disabled or bypassed; the workflow itself is not reported green. This outstanding hosting status must be resolved before any release decision.

The execution gate remains false. No installation, merge, deployment or daily-profile changes were made. M3 may begin its separately authorized audit/development with this limitation recorded; it receives no execution-release authorization. The sections below retain the design and investigation history; earlier pending checkpoints are superseded by this final evidence.

Implementation decision, before code: extend the verified M1 source `7d82c77` in an isolated worktree. Keep `LIVE_SUPERVISION_ADMITTED=false`. No new provider, service, telemetry dependency or lifecycle authority.

## Sources and privacy boundary

Project mission events, pending approvals, approval-response intents, selected results and task state from the existing Hub records. Reuse run-presentation binding where available. Direct tasks currently lose approval/reconnect history; add optional `task.diagnosticObservations` as bounded observations of existing boundary operations, not a second state machine. Never read transcript text to infer an event. Older history is explicitly incomplete.

The main-process projection is an allowlist: static labels, enumerated outcomes, numeric times/exit codes and hashed record references. No prompts, titles, command bodies, output, raw errors, file paths, account data or credentials enter the timeline/export. No detail-expansion endpoint. Opening the selected conversation is an explicit departure to Sunny's existing transcript view, with its existing navigation guard. Copy exports only the same redacted projection.

## Additive record compatibility and failure behavior

`diagnosticObservations` is optional, version 1 per record, at most 128 observations per task. Fields: stable hashed observation ID, kind, observed time, hashed execution/turn/request/item references, allowlisted outcome and optional integer exit code. Old records need no migration or backfill. Unrecognized/malformed fields are omitted at read; absence is not success. A dropped-count records bounded eviction. Task deletion deletes its observations; existing profile retention governs task lifetime. Mission events retain their existing 500-event bound.

Observations use the existing task persistence path and existing backups; no separate log file or database. A crash may lose observations not yet flushed, so the view reports current persistence health and incomplete coverage. Diagnostic collection must not throw into execution, release reservations, retry, approve, or change mission state. Submitted decisions mean written to the transport, not proof of execution. Provider item/turn observations remain distinct from captain acceptance. Recovery records explicitly distinguish connection loss/restored uncertainty from authoritative thread reconciliation.

Rollback: revert M2 source; older builds ignore the optional task fields. No profile replacement, destructive migration or restoration is needed. Test isolated stores, malformed records, retention, save failure, restart, duplicates and stale events. No production-profile edits.

## Presentation and validation plan

Captain's log gains a read-only Ship's diagnostics disclosure with project/task/mission scope, manual refresh, chronological bounded entries, source/attempt references, missing-time/ordering labels and redacted JSON copy. A conversation/result is opened only through existing navigation. No new animated status or progress meter.

Verify redaction with private sentinels, exact scope/membership validation, deterministic deduplication and bounded exports. Exercise the M1 approval/reconnect cases through real Hub boundaries, retaining synthetic-versus-live attribution. Run focused regressions, clean install, full Windows tests/build/native checks and inspect mobile/zoom screenshots. Save final source identity, receipts and limitations here. Pending provider replay remains unverified unless actually observed.

## Implementation checkpoint

The read-only projection and copy action use the existing trusted IPC boundary. Pending approval scope also uses `run-presentation.callBinding`; no transcript text is parsed. Current mission/task snapshots, recorded checks, selected results and acceptance receipts retain separate source labels. Observations record request/submission, conflicts, connection loss, restart, reconciliation, local stop requests, provider turns/command items and reply references. Stale item notifications do not attach to a new execution; missing turn identity stays unknown.

Clean Node24 installation, build/typecheck and 83 focused boundary/projection tests passed during development. The dedicated native check passed after fixing two fixture mistakes: its generic click helper opened then closed the disclosure; programmatic focus was incorrectly expected to show a keyboard-only ring. The corrected fixture uses actual Tab input to check visible focus. Earlier failures remain in `.sunny-dev/m2-native-initial` and `m2-native-second`; passing development capture is `m2-native-third`. Final clean-candidate live and complete Windows checks are pending; development captures alone do not establish the final candidate.

## Clean-candidate live evidence

Implementation `a5faedb236c43ed5bef8708355de68be5c626669`, Codex CLI `0.160.1`, live-catalog default `gpt-6.1-sol`. The [reviewed live receipt](evidence/diagnostic-timeline-2026-11-07/live.json) has SHA256 `60e53b8bd077b683a85910d6e5a171b5cc1d309a4863563873199b059978688a`. All four cases passed with real Hub boundaries and isolated SQLite stores, and all owned provider processes exited. Diagnostic reports show saved storage and contain only redacted fields.

| Live case | Recorded diagnostic evidence | Actual fixture effects |
| --- | --- | --- |
| Accept, duplicate and edited answer | One decision submission; matching approval/item references; completed item with exit 0 | 1 |
| Decline | Decline submission; closed command item explicitly `declined`, no exit code | 0 |
| Interrupt pending | Permission request, local stop request and interrupted provider turn | 0 |
| Disconnect and explicit continuation | Connection loss, restored unknown task, authoritative reconciliation, fresh request/decision and matching command result | 1 |

The provider emits command-item start **before** permission is decided. Labels now explicitly say that opening an item does not prove execution; closing an item is accompanied by its actual outcome. The installed generated `ServerNotification` schema confirms `inProgress`, `completed`, `failed` and `declined` statuses. Approval/item correlation uses provider `itemId`, hashed before retention/export. No command body is needed to distinguish a declined item from executed work.

No pending approval replay was observed in the 15-second reconnect observation. It remains unverified live; a fresh request is not a replay. Saved Hub reconstruction against SQLite is not a claim that the installed desktop was restarted. The first development matrix on `38126a9` stopped after the model ended its explicit continuation without issuing a fresh request (zero effects); its failing receipt remains at `.sunny-dev/m2-live-38126a9`. The final fresh matrix passed without changing approval checks or retrying a possibly started command.

Final focused suite: **84 passed**, zero failures/skips/cancellations. Clean local build/typecheck passed with fingerprint `4f4a99f8becc72d80982a7bd23f0624fd0b22ece27ede63b549d69890464d04f`. The [native diagnostic receipt](evidence/diagnostic-timeline-2026-11-07/diagnostics-result.json) and [mobile events](evidence/diagnostic-timeline-2026-11-07/diagnostics-events-mobile.png), [200% zoom events](evidence/diagnostic-timeline-2026-11-07/diagnostics-events-zoom.png), [desktop controls](evidence/diagnostic-timeline-2026-11-07/diagnostics-desktop.png) cover the production renderer with explicitly synthetic data. Screenshots were visually inspected; no screen-reader speech or installed-app verification is claimed. The full local native workflow passed on the preceding implementation; exact final-source full validation is running in [Windows run 42438032794](https://github.com/Vizzaq23/sunny-hq/actions/runs/42438032794). Earlier run 42437840598 was cancelled for the command-item wording/correlation correction, not passed.

No M3, gate opening, merge, deployment, installation or daily-profile change by this task. Final full-suite evidence remains pending below.

## Hosted recovery correction

Run 42438032794 shard 2 failed two unchanged copied-profile recovery tests with `COPIED_STATE_CHANGED`; install/build/native passed. The new restart observation mutated an inert recovery copy, violating its deliberately lossless contract. Commit `851a5cd` suppresses collection during that existing capability-scoped recovery mode; it does not relax the independent preservation oracle or any assertion. All 20 copied-roundtrip and diagnostic tests then passed locally. Ordinary Hub restart observations still pass. Failed hosted logs are retained at `.sunny-dev/m2-ci-a5faedb/shard-2`; the remaining shard is superseded, not green.

Local new/edited source had LF bytes while the hosted Windows checkout used CRLF. Build fingerprints therefore differed despite the same clean Git source. The corrected worktree's owned source files were re-materialized from the index using its existing `core.autocrlf=true` setting; no attributes or verification rules changed. Final receipts must identify both exact source and build bytes. A fresh clean-candidate live probe and complete hosted validation follow this correction; the preceding live receipt remains evidence for its stated source.

## Scheduler validation correction

Run 42440275473 shard 2 passed install/build/native but failed one scheduler assertion: independent workers arrived in order `b,a` rather than `a,b`. The scheduler deliberately awaits these scoped starts together; neither assignment depends on the other. The test now compares exact sorted membership for start and turn arrivals, retaining duplicate detection, two concurrently starting workers, durable reservations, separate-root file effects, unchanged original checkout, and dependent-work blocking. Production scheduling is unchanged. The failed receipt is retained in `evidence/diagnostic-timeline-2026-11-07/failed-ci-d34ef71-shard-2.json`.

Fresh real-provider verification on clean `d34ef71f8cf9d70efabace550fe94dd700e51597` passed all four cases with effects 1/0/0/1 and all owned processes exited. The final receipt is `evidence/diagnostic-timeline-2026-11-07/live-final.json`, SHA256 `86269ff5bd0c2f67acdf4c0f3ba958144a55bd0ffdd12a6d91bd0e3558e21af2`. Pending replay remains unverified. Subsequent scheduler test changes do not modify application code. The d34 local and hosted build fingerprints differ; each receipt identifies its own bytes, and no matching-build claim is made.

## Checkpoint recovery race investigation (2026-11-08)

Full run 42443042042 completed: shard 1 failed unchanged metadata/grant checkpoint-fault assertions with `Run changed during persistence`; shard 2 passed. Both installs/builds/native workflows passed. Focused reruns of those two cases passed on both M2 and unchanged M1, so these reruns do not establish absence of the hosted race.

Root-cause hypothesis from authority flow: `mission-checkpoints.advance` handles failed receipt validation by directly changing `combinedChecks` and `run.phase`, then calling `persist`. A waiting delivery-response commit can already have captured that run and be awaiting validation. The direct recovery write invalidates that commit. A new regression queues and yields a legitimate authority commit at the failed check receipt to make this overlap deterministic; existing fault assertions remain unchanged.

Planned correction: retain the unknown check/control and checkout reservation, but publish run recovery through `missionMutation`, behind existing authority commits. No schema change, retry, effect replay or release-gate change. If recovery persistence fails, preserve uncertainty and the reservation; never turn it into success. Rollback is a source revert, with no data migration. Verify the new regression fails before the fix, then rerun original fault cases, full fault suite, shutdown/recovery checks, full Windows validation and live M2 evidence on the corrected application source.

The new deterministic overlap regression failed on unchanged application code with the exact hosted `Run changed during persistence` error (111.8s); log `.sunny-dev-m2-checkpoint-race-before.log`. Correction queues the unknown run/check mutation, retains the unknown controller/reservation immediately, and increments the revision only on publication. Existing fault assertions and authority validation remain unchanged. Recovery-save failure leaves uncertainty and reservations intact. Focused post-fix checks pending.

Post-fix evidence: all 3 targeted cases passed (unchanged metadata/grant cases plus deterministic overlap), 341.2s total; `checkpoint-race-after.txt` is retained beside the failing before receipt. All 48 persistence-barrier/diagnostic/copied-roundtrip tests passed. Full Windows validation will include the complete unchanged fault suite and new regression (expected total 1755 tests). No checkpoint test was deleted or relaxed.
