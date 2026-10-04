# Run presentation and goal entry — 2026-10-04

Task14 extends v3 additively. Optional run `presentation.calls` contains bounded
request receipts: requestId, projectId, runId, attemptId, revision, state
(seen/snoozed), time, optional taskId/type/resolved. A recovered unresolved receipt stays listed as requiring reconciliation, with no live answer authority. An absent attempt is represented by the literal `none` for
coordinator calls before a mission attempt exists. These are presentation receipts
only; they cannot answer, approve, accept, dispatch or change a run revision.
`run:ackCall` requires the exact current request binding and expectedRevision;
the ordered required barrier persists it. Repeats replace the same receipt, never
remove the pending request. Snooze silences that request until it changes; there is
no timer or provider wakeup. The public boundary exposes only these fields.

Pending request binding is derived in main from its task and retained run/mission
ownership. Answers keep `approval:respond` and must include this binding for
supervised requests; revision changes reject stale answers before any provider
effect. Recovery keeps receipts but requires reconciliation for lost live requests.

WorkContext gains optional runId in current and return selection, validated against
project/mission membership. Missing IDs remain retained and unavailable. The pure
run and attention projections consume public state, never assistant prose.
Unknown or failed storage overrides working animation; readiness requires the
existing selected-result verifier and captain acceptance remains a separate receipt.

Goal entry saves a mission and bounded captain grant/run before attempting actual
integration-workspace/coordinator setup. The default disabled supervision gate
returns a visible blocked saved run without claiming execution. Trusted offline
fixtures exercise the actual setup path. Ordinary conversation remains explicit.

Compatibility: optional fields preserve old v3 profiles and workflow-v1 history.
The existing profile backup/ordered barrier is reused; no automatic migration,
budget refill or destructive rollback. Rollback uses a preserved pre-upgrade
fixture/profile copy, never overwrites a current profile. Failure tests cover
strict fields, stale binding, unchanged authority, restart dedup and storage failure.

Native run-ui states are hardcoded labelled display fixtures only; seeded ready
and accepted receipts prove rendering, not actual acceptance. Actual actions are
covered separately with the trusted offline Hub. The frozen fixture and zero-effect
offline transport remain unchanged.
