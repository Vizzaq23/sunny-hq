# Report review journey — 2026-10-12

Scope: priority 3 after three successful live recovery trials. Use existing coordinator stages (Luffy, planner, worker, validator, reviewer), project-local Markdown deliverables, inspectable evidence and human acceptance. Luffy's recommendation is evidence from the coordinator, never human authorization.

## Decision and persistence

Add explicit request-changes to the current mission review flow. `mission:requestChanges {missionId,revision,note}` accepts a nonempty note of at most 4,000 characters only while WAITING_FOR_REVIEW with no unresolved check, publication or merge operation. It records a captain review decision for that exact attempt/revision, changes mission status to existing BLOCKED, and does not launch work. UI labels this case Changes requested and exposes the same new-attempt control. Acceptance from the superseded revision fails.

Persist optional `Mission.reviewDecisions` as records `{id,attemptId,decision,note?,criteria?,reviewedRevision,time,actor:'captain'}`. Decisions are append-only; accepted decisions also retain the existing `acceptance` field and event. A new attempt gets a new identity and receives the most recent requested changes in its brief. Old attempts, artifacts and decisions remain inspectable; no acceptance or checks carry over as current evidence. Renderer shows the latest decision and history, and still marks COMPLETE only through existing acceptance checks.

This is an additive field in mission-book version 1's existing JSON object; absent means no new review history. Existing acceptance remains valid and is not retrospectively converted into a fabricated review record. No profile migration, bulk import, dependency or state-store change. Normal closed-profile backup applies before installation. Rollback ignores the new field; preserve a current export before older software writes it. No old profile restore and no note deletion.

Alternative: telling the captain to start another attempt already permits rework, but loses an explicit decision and its requested changes. A separate approval subsystem is unnecessary; the existing revision-bound mission mutation owns the transition.

## Acceptance evidence

Unit tests cover empty/stale requests, wrong phase, unresolved side effects, failed persistence rollback, restart preservation, new-attempt context and inability to accept a rejected revision. Desktop fixture tests request changes, observe the label and retained note after reload, start another attempt, attach/inspect its result and accept only current criteria. Real isolated report trials must produce usable Markdown with the fixture's actual facts, all four crew-stage results and a Luffy recommendation; repeat three times. Any automated review decisions in those isolated trials are labelled test-harness decisions, not real captain approval. User's normal profile, personal vault, remote repositories and installed launcher remain untouched.
