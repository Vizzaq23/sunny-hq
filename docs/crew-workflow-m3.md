# M3 — Continuous crew workflow (2026-11-08)

Base: M2 evidence8fa4e79, applicationb1e2d44. Branch codex/crew-workflow-m3-20261108. The captain requested M3 after final M2 evidence was saved. The canonical seven-part roadmap is docs/agent-platform-roadmap.md; its existing primary-checkout edit is copied here, not overwritten there.

## Admission and evidence boundary

Normal supervised execution remains disabled by desktop/supervised-runs.cjs. No profile, environment switch, renderer action or real provider probe may bypass it. Existing constructor-injected offline fixtures stay explicitly synthetic. Completing this development work is not M3 live acceptance or release authorization.

| Prerequisite | Current evidence | Remaining requirement |
| --- | --- | --- |
| Full source baseline | M2:1755tests, both installs/build/native passed | Aggregate GitHub job fails before recording steps; cause unverified, see M2 final receipt |
| Approval/reconnect | M1/M2 real-provider isolated journey passed | Live pending-request replay not observed; do not imply replay proof |
| Recovery and containment | Existing bounded-work, uncertainty, restart, owned-process tests | Fresh exact-package containment/control/recovery qualification; historical package failures are not waived |
| Continuous crew journey | Separate council and supervised journey fixtures exist | One linked real journey through selected brief, execution, checks, review and explicit acceptance/rework |
| Human release decision | None | Separate review of complete prerequisites; gate remains closed |

## Verified continuity gap and bounded implementation

LocalCouncil.handoff currently persists pending before calling startGoal, but only learns mission/run IDs after the call returns. A lost response can leave a real mission with an unlinked council. The selected edited brief is also absent from the pending record. Existing duplicate refusal prevents retries, but does not supply the missing correlation.

Reserve main-generated mission/run identities and an immutable copy of the reviewed brief in the pending handoff before calling the existing goal path. Pass identities through a private main-process option, never a renderer-supplied goal field. Mission creation rejects an existing reserved identity. Successful results must match those identities; mismatches remain unknown. A pending/unknown handoff retains its identities and selected brief after restart without automatically submitting or reconciling work. The mission/run/task/attempt/branch/check/result remain owned by existing services.

Only the edited title/objective/criteria reach startGoal. Do not append council transcripts, journal recall, other contributions or prior topics. Default diagnostics continue to omit these private fields. The existing release gate runs before any pending handoff receipt or goal creation.

## Additive persistence and rollback, before code

Optional handoff version2 fields: missionId/runId (main-generated UUIDs already reserved before dispatch), reviewedBrief {title,objective,acceptanceCriteria,completionBoundary:review}, and briefSha256. Existing status/time/task/error fields remain. Loader validates version2 brief/digest/identities; malformed records remain fenced unknown and never acquire execution authority. Old handoffs retain their original limited evidence; never backfill a reviewed snapshot.

No database/schema-version migration or production-profile edit. Use isolated fixture stores. Existing profile backups include the optional fields; keep a current export before any later installation. Older code may ignore the new fields but still preserves pending as unknown and duplicate refusal; downgrade loses the extra reviewed-brief view, not permission to retry. Roll back source without restoring an older profile.

## Acceptance and validation

- Pending persistence contains exact reviewed brief and reserved IDs before any goal call; definite save failure causes zero calls, uncertain failure stays fenced.
- Return loss, duplicate click, mismatched result IDs and restart retain one identity; no fallback launch or automatic replay.
- Real Hub mission creation uses the reserved identity and rejects collisions; normal public goal/mission inputs cannot choose IDs.
- Closed gate rejects before receipt, mission, provider or workspace effects. Existing direct tasks/advice-only councils remain covered.
- Build and relevant persistence/council/mission regressions; explicit synthetic integration evidence is separate from live evidence.
- Full M3 remains incomplete until a single real continuous success/rework/stop/reconnect journey and all release prerequisites are reviewed. Do not open admission to manufacture that evidence.

## Implementation checkpoint

Pending handoffs now retain main-generated IDs and the exact selected brief/digest. Hub binds the private council option to that pending record and rejects edited scope/collisions; public goal/mission arguments still reject identity injection. Normal closed admission rejects before all effects. The renderer exposes the saved brief via an ordinary keyboard-operable disclosure; the public projection includes only explicit fields, and M2 diagnostics still omit private brief text.

Clean npm ci, build/typecheck and105focused tests passed; after strengthening the reply-loss test to create actual Hub records before losing the response, all7handoff regressions passed again. Dedicated native council fixture passed, including closed launch, keyboard disclosure and narrow layout. Mobile screenshot visually inspected and saved with synthetic-model receipt under docs/evidence/crew-workflow-m3-2026-11-08. Earlier native failures found a missing renderer projection field (fixed and regression-tested), then an incorrect fixture key/focus sequence (corrected to existing Enter handling). Initial unit fixtures lacked configured local profiles and expected absent taskId rather than loader normalization; corrected fixture setup, not application authority assertions. Failure logs retained in ignored scratch.

Full source validation is pending. No live crew execution, captain acceptance, rework loop or release qualification is claimed. M2's separate aggregate-job failure remains documented. M3 live exit criteria remain unmet; no gate change, installation or merge.
