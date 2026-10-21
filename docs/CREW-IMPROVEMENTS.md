# Event-bound improvements (2026-10-03)

Version 1 runs retain the legacy trigger shape. New receipts add optional
`revision`, `baseCommit`, `evidenceRef`, `state` (queued/backlog/consumed),
`assignmentId` and `proposal`. Identity hashes kind, source and exact revision;
256 receipts and 32 assignments bound storage. Full queues reject new admission
without evicting dedup history. No timer or recurring discovery is enabled.

Standing authority means the original and current standingImprovement strings
match exactly and both grants allow read. Assessments only read; they do not
implement their suggestions or change accepted results. Missing standing authority
produces a ranked proposal with fixed benefit, evidence and estimated cost.
Feedback is a main-only trusted receipt hook for Task16, never arbitrary chat.

An assessment is canonical Nami planning with empty owned paths. Its trigger ID
is an additive assignment field. Scheduler reservations consume the trigger in
the same durable transaction. Main binds provider/thread identities to the
assignment in optional improvementUsage records (provider/threadId/assignmentId).
The ordinary cumulative usage high-water charges both ledgers once. Active time
charges once per interval when any reserved improvement worker remains active.
Counters never reset on feedback, resume, thread replacement or recovery.

Old profiles need no migration. Existing profile backup/export retains additive
fields. Back up before opening a new build. Rollback preserves the new profile
for recovery; an older strict validator must reject additive fields instead of
silently discarding receipts. Recovery keeps existing unknown/paused admission
fences. Frozen live reliability gates remain false.

Morgans receives pure ReportPacket version 1 containing run/project/revision/time
and separate confirmedEvidence, attributedClaims, failedChecks and
unavailableServices. Entries contain bounded identifiers, source revision, time
and fixed main-derived descriptions. No arbitrary transcript, tool configuration,
thread/session identity or command output is copied. Formatting uses no provider.
Imported news remains an independent archive.

Reviewed correction: completion assessments pin the captured completed head.
For a head not yet integrated, main resolves the original completed worker and
its managed workspace from the durable receipt, verifies exact source and clean
Git identity, and rechecks ownership/admission after awaits. Only this canonical
read-only assessment may use that source workspace to create its pinned view;
ordinary workspace sources remain restricted to the integration checkout.
No new profile fields or general source-root authority are added.

Report generation time is distinct from each evidence event time. Reviews retain
their own source/time; checks use their source and corresponding combined-check
receipt time. Missing trustworthy event time is null and rendered as unavailable.
Acceptance cites its own receipt identity/time instead of a current Git head.
Assessment resume resolves config first, then rechecks captured task/thread,
assignment identity, open/control/live gates and budget immediately before resume.
