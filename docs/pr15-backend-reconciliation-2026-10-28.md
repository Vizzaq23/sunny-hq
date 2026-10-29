# PR #15 reconciliation with the installed backend — 2026-10-28

## Scope and source

Review-only forward port of PR #15 (`a96cc962680010d3a18e62f30dcde71551513c16`) onto default branch `codex/sunny-hq` at PR #16's merge (`021b9cc902a75677633d6044b8391f4b122b2480`). No issue: the captain requested this integration investigation directly. The original PR is retained for comparison; this candidate does not merge, deploy, install, launch the daily app, or touch live profiles.

PR #15 was based on `d1779c29086003cd1f390aae27ad04cfa6900cc8`, before the installed backend integration. A three-way file reconciliation found conflicts in 14 existing files, plus the new draft-storage test. These are semantic conflicts, not just formatting: old synchronous mission mutation and session-only brief handling would regress the current durable authority queue, isolated execution workspaces and revisioned workspace drafts. Historical 391-test evidence on #15 does not validate this integration.

## File decisions

| Files | Resolution |
| --- | --- |
| `desktop/codex.cjs` | Keep current backend byte-for-byte. It already has child-local buffers and current-child guards, plus `receiveLine`, isolated diagnostic observers and handler-failure disconnects. Replacing it with #15 would lose those protections. |
| `desktop/hub.cjs` | Keep the existing handoff restriction and tracked operation lifecycle. Add mission-scoped check discovery through `missionProject` and workspace identity verification. Preserve manual-check admission, process controllers, owned reservation identity, shutdown handling and uncertain storage fences. Only host preflight before the effect callback can record `CHECK_NOT_STARTED` without failed execution evidence. |
| `desktop/mission-evidence.cjs` | Add supported-script discovery and typed preparation errors. Preserve `beforeEffect`, runtime identity validation, process controls and timeout behavior. Errors after execution remain failures. |
| `desktop/mission-publisher.cjs` | Add bounded exact-text validation and preview editing. Use detached `MissionBook` candidates and await durable receipts; retain checkout ownership until save finishes. Revalidate source/workspace during the barrier. Renew preview ID and remove old authorization. Preserve existing publication-intent, before-effect, uncertainty and explicit reconciliation barriers. |
| `desktop/main.cjs`, `desktop/mission-smoke.cjs` | Route the new read-only check and edit-preview commands through existing trusted boundaries; add the routes to the isolated native fixture. Keep hidden/offscreen native-window configuration. |
| `src/useDraft.ts` | Preserve revisioned persistent workspace drafts, serialized updates, export and failed-save recovery. Add exact submitted-value clearing only to the existing session fallback; storage denial/quota errors do not turn successful submission into a retry. |
| `src/shared.ts` | Retain current approval bindings, task summaries, run/result/playable contracts. Add only optional preview fingerprint. |
| `src/views/MissionBoard.tsx`, `mission-board.css` | Preserve goal:start, explicit coordinator confirmation, skills review, result selection and acceptance controls. Disable unavailable checks. Preserve edited PR text across unrelated mission revisions, but reset confirmation and invalidate on preview/source/target identity changes. Keep push/publication explicit. |
| Tests | Retain newer async/persistence tests. Port #15 cases to awaited mission APIs and selected-result acceptance. Update publication stubs with valid title/body so failure tests reach their intended durability barrier. Add held-receipt, workspace-root and post-execution classification regressions. |

No schema version or dependency changes. Existing preview records with missing/invalid text must be edited into a valid new preview before publication; they cannot authorize an external effect. No automatic provider command replay was introduced. No art or world redesign.

## Validation

- Node 24.22.1; clean `npm ci --no-audit --no-fund` succeeded.
- `npm run build` passed (TypeScript and Vite). This connector-reconstructed checkout contains source and test assets, but not the repository's large artwork binaries: Vite reports missing artwork URLs. This is source-build evidence, not a complete packaged release or visual sign-off.
- Focused run: 219 tests, 218 passed, 1 existing Windows-only short-path test skipped. Files: `codex`, `codex-transport-isolation`, `approval-boundary`, `mission-publisher`, `mission-evidence`, `mission-hub`, `draft-storage`, `persistence-barriers`, `persistence-recovery`, `handoff-review-guard`, `workspace-draft-ui`, `workspace-hub`, `playable-manual-check`, `acceptance-harness` (all `.test.cjs`).
- After the final post-execution classification guard: 106/106 passed across `mission-hub`, `persistence-barriers`, `playable-manual-check`. This includes a forged typed preflight error raised during actual execution: failed evidence remains and the event is `EVIDENCE_FAILED`.
- Reconnect approval replay uses labelled in-memory streams and actual CodexClient/Hub handling. It proves old-transport frames and old approval IDs cannot authorize the replacement connection, and a freshly replayed current request needs an explicit decision. It does not prove the real provider replays pending requests.
- Linux runtime discovery needed a temporary `ProgramFiles` directory containing symlinks to this environment's installed Node/npm layout. No application runtime discovery code was weakened for tests.
- Initial fixture hash failures were caused by snapshot reconstruction normalizing mixed line endings. Original frozen bytes were restored from GitHub without changing their expected hashes. A 46-test copied-profile/harness rerun passed 45; the remaining `copied-roundtrip` oracle failure reproduced on the unchanged backend.
- Baseline comparison of `copied-roundtrip`, `playable-launches`, `playable-ordinary`: 29 tests, 14 passed, 15 failed on the unchanged backend. Examples include `COPIED_RESERVATION_INVALID`, protected playable paths in this Linux layout, and blocked playable delivery. Do not label all broader-suite failures pre-existing based only on this sample.
- Full initial `npm test`: 1,622 tests, 1,525 passed, 96 failed, 1 skipped (452 seconds). That run overlapped snapshot-byte corrections and subsequent test edits; it is not a final-source release pass. Re-running every failing test file after restoring exact bytes: 189 tests, 157 passed, 32 failed. Remaining failures include missing historic Git objects (`5b70fb2`, `289731d`), omitted artwork, Electron-dependent fixtures, the reproduced copied-profile oracle failure and playable runtime/delivery cases. Full failure names and counts are retained in `docs/evidence/pr15-backend-reconciliation-2026-10-28.json`. No tests were disabled.
- Native Electron could not start normally under this root Linux executor (Electron requires sandbox configuration). No sandbox was disabled. Hidden native workflow, complete artwork rendering, screen-reader behavior, Windows paths, packaged recovery and real provider replay still require validation on the supported desktop environment.

## Remaining review checks

On a clean Windows checkout of the candidate with Node 24:

1. Run `npm ci`, `npm test`, `npm run build`. Record actual failures and the commit tested; do not reuse #15 or #16's historic counts.
2. Run `node_modules/.bin/electron desktop/workflow-smoke.cjs` in its isolated fixture profile, retaining hidden windows and bounded evaluation. The older mission smoke journey may need adaptation to the current goal-start/selected-result flow; new action routes alone are not a passing UI result.
3. Exercise a review-ready fixture: unavailable lint cannot execute or create failed evidence; removing a script after durable reservation records `CHECK_NOT_STARTED`; executed/uncertain checks still block acceptance as appropriate.
4. Edit preview title/body with multiline Unicode and literal shell characters; trigger unrelated snapshots. Verify exact text remains, confirmation resets, source/target changes invalidate authorization, failed saves preserve the old preview, and a held save keeps the checkout reserved. Use intercepted publication transport.
5. With an explicitly authorized isolated real-provider test, disconnect while an approval is pending. Reconcile status, observe whether the provider actually replays it, reject the old UI approval ID, and require a fresh captain decision. Never automatically resume/replay commands to obtain a green test.
6. Require human approval for merge or installation. Keep Windows CI and native/provider gaps visible on the PR.

Rollback before integration: close the candidate PR. If later merged with approval, revert only its code commit; do not restore stale production profile data. Existing backend migration and backup guidance remains authoritative in `docs/installed-backend-merge-2026-10-20.md`.
