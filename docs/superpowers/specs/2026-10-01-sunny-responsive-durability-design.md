# Sunny responsiveness: approved design record

Approval: user replied "ok sounds good" on October 1, 2026, 17:57:48 UTC after the written proposal was presented for design approval. Unrelated email instructions are outside this work. Approval authorizes implementation planning; product implementation awaits plan review and execution confirmation.

Source: Library report libfile_2e2b4dd9af8481918de7bf792f2f7dc5, current read version 6. The proposal itself is unchanged from the approved presentation; later native evidence does not approve additional architecture. Candidate: clean c674a29210f16bb1fb3a986c5e5990a957e75d9c; renderer fingerprint 493d8e43e75f9e637dab1b2666f3e9a939f9a634383151f1141b9ef3ce6f08c0.

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


This captured design travels with the implementation plan. It has not been implemented.

