# Installed backend integration — 2026-10-20

The captain explicitly selected the installed application's newer backend for merge; older mission-reliability PR #15 remains separate. Baseline is clean installed source 1ebaf84, including its existing renderer/shared contracts. The separately approved frontend redesign b9515f9 is excluded from this integration. Original default revision:98c0abd.

Merge reconciliation preserves both dated reliability histories. The newer 56-check workflow keeps bounded renderer evaluation and an always-hidden window; the default branch's optional offscreen flag and visibility evidence are retained. Existing default-branch report-journey fixture and result-save package checks are preserved. No production execution, approval, profile or schema behavior is changed by the merge resolution.

The preceding full suite completed1593 tests with1582 passes/11failures in3563seconds. One failure came from the test adapter retaining the extracted GitPane under stale hooks; its adapter now reloads that component and represents its current ready state. Five handoff tests pass, preserving real status/diff/commit workspace-ID assertions. The other ten are rerun separately with fresh checkout-local temporary repositories; their original failures remain evidence. This is not a full-green claim.

CI job allowance increases from20 to90minutes because the observed serial suite needs about59minutes locally. No tests, assertions, concurrency limits or per-test deadlines are removed or relaxed. No security policy is changed.

Historical backend changes include incremental durable profile fragments and migration verification; their existing design, backup, migration, recovery and rollback records remain authoritative. This merge performs no production migration and does not launch the daily profile. To roll back code, revert the merge; profile rollback must follow those versioned migration records, never overwrite current user data with an old backup.
