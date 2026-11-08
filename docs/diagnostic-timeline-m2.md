# M2 — Ship's diagnostic timeline, 2026-11-07

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
