# Reliability Implementation Plan

Goal: retain selected skills and durable reviewed-result receipts with explicit recovery and no duplicate note on retry.

Architecture: extend existing Hub persistence with optional result-save records. Keep guarded vault operations in a small CommonJS service and render authoritative state through existing IPC. Spec: [reviewed-result-saving.md](reviewed-result-saving.md).

Execution: inline in the captain-authorized work session. Use the executing-plans and test-driven-development skills; preserve the existing feature branch and baseline document. No unrelated writer or installed-profile changes.

## Tasks

- [ ] Add failing isolated `tests/result-saves.test.cjs` for durable intent, receipts, lost replies, failures, identity/input validation, conflicting paths and repeated restart recovery. Implement `desktop/result-saves.cjs` with `ResultSaves(hub)`, `save(input)` and `recover(input)`; persist `state.resultSaves` in Hub. Expose `result:save` and `result:recover` from trusted main IPC. Run focused tests.
- [ ] Reuse SkillPicker in MissionBoard with mission/role scope and readiness guard; pass `selectedSkills`, display confirmed attempt skills. Add mission fixture coverage to demonstrate the UI sends the selected revision and backend preserves it.
- [ ] Add durable result-save history/receipt and recovery controls to Morgans. Save reviewed content bound to the final reporter message and discard React-only saved truth. Test actual service integration in the Electron workflow fixture, including reload and failed-save recovery.
- [ ] Install locked dependencies in a clean checkout, run Node 24 full suite and build, run isolated Electron fixture workflows and three repeated save-recovery trials. Do not treat fixture provider responses as live evidence. Review full diff and document exact results, commands, unresolved issues and rollback.

Review focus: ambiguous writes, failure of the receipt checkpoint, stale source result, changed vault/symlink, and UI scope changes during asynchronous skill discovery. Each gets a targeted regression in the owning task. Saved receipts describe verification at a recorded time, not continuous vault monitoring.

## Execution ledger

2026-10-12: baseline source clean except the prior baseline document. Ruling: the captain's instruction to work for three hours authorizes progressing the proposed reliability design inline, without repeating intermediate scope confirmations. The design is recorded before schema implementation. No package activation is included without fresh source and runtime evidence.

2026-10-12: durable saves pass JSON/SQLite tests and three abrupt process-exit trials at each of three save boundaries. Mission skill selection passes the real Hub desktop fixture. A live interrupted worker recovered its checkpoint and report, but the first failed-request restart exposed a provider thread with no rollout. Added proven-pre-submit recovery with reserved replacement identity and preserved launch prompt; generic and uncertain failures stay ineligible. The corrected live probe passed three consecutive interruption and pre-submit-failure trials. The report-journey gate may now be attempted; workshop and visual polish remain excluded.
