# M4 voyage bar — 2026-11-08

The captain explicitly requested M4 while M3 remains release-blocked. Develop in the isolated voyage-bar-m4 worktree from10110ca; this does not waive M3, open execution admission or authorize an announcement.

Use saved workspace context and the existing mission projection. No schema, tracker, provider or authority change. A persistent shell strip identifies the explicitly selected project/mission/attempt and recorded state. Brief/review dialogs retain the underlying room and draft; Escape/Return restores focus. Missing selections stay missing rather than choosing recent work. Existing work controls handle approvals and Stop. Verify scoped selection, stale attempts, completion versus acceptance, keyboard return, compact/enlarged layout and reduced motion with existing fixtures.

Inherited baseline10110ca completed install/build/native but failed four tests: three extracted App-handler harnesses lacked new setCaptainReturn/setView bindings, and Windows validation still expected four workspace tests after a fifth was added. Preserve assertions while correcting those harness inputs/counts. Original logs remain in ../crew-workflow-m3/.sunny-dev/pr-validation/2026-11-09T01-58-35.562Z. M3 latency and hosting blockers remain.

Local implementation validation passed on `31852db6051cd48f481d66d20197c5f2760d7e17`. M3 prerequisite and release qualification remain blocked; this is not a full milestone acceptance or an installed-app claim.

Implementation uses a native modal dialog for brief/review, retaining the mounted room and draft. No automatic mission selection. Missing/historical attempts cannot open current review. Work controls link the exact projected task. The existing MissionBoard owns review decisions; the bar grants no acceptance or execution authority.

Clean npm ci, build/typecheck and 27 focused regressions passed. Targeted hidden native fixture passed explicit selection, brief Escape/focus return, review return, approval, working/unknown/failed/stopped/review states, provider-finished-not-accepted, compact and 200% layouts under reduced motion. Screen-reader behavior has not been separately verified. The strip introduces no animation. Earlier test fixture syntax and save-observation failures remain in ignored logs.

## Recovered full validation — 2026-11-08

The previous Codex chat stopped on a router HTTP 400 while the independent validation process continued. The saved receipt was recovered and reviewed; the successful run was not repeated or relabelled as a new run. `npm run validate:windows`, using the README's direct npm CLI and Node 24.18.0, validated clean source `31852db` in this worktree:

| Check | Result | Duration |
| --- | --- | --- |
| Locked dependency install | Passed | 10.8 s |
| Electron install check | Passed | 1.1 s |
| Complete test suite | 1,771 passed; zero failures, skips or cancellations | 1,450.7 s |
| Build, including TypeScript check | Passed | 16.1 s |
| Hidden native workflow | 68 checks passed | 78.1 s |

The [full receipt](evidence/voyage-bar-m4-2026-11-08/windows-validation.json) records the exact source, runtime and build identity. The [evidence index](evidence/voyage-bar-m4-2026-11-08/evidence-index.json) records SHA-256 hashes and locations of original logs retained under `.sunny-dev/pr-validation/2026-11-09T02-33-35.332Z`. The [targeted voyage receipt](evidence/voyage-bar-m4-2026-11-08/native-targeted.json) is a separate fixture run against the same implementation. Both native runs use synthetic transport and do not prove a live provider journey.

Reviewed the full implementation diff from `10110ca`: the new shell strip consumes existing context/projection and reuses MissionBoard for decisions. The two test-harness corrections preserve assertions and supply existing App bindings/update the expected workspace-test count. No schema, dependency, privileged IPC or execution-gate changes were introduced.

Visually inspected [working](evidence/voyage-bar-m4-2026-11-08/voyage-working.png), [approval](evidence/voyage-bar-m4-2026-11-08/voyage-approval.png), [unknown connection](evidence/voyage-bar-m4-2026-11-08/voyage-unknown.png) and [ready for review](evidence/voyage-bar-m4-2026-11-08/voyage-finished.png) states. Labels and direct controls are readable above the room; provider completion says Ready to review. The [compact](evidence/voyage-bar-m4-2026-11-08/voyage-compact.png) and [200%](evidence/voyage-bar-m4-2026-11-08/voyage-200-percent.png) captures show wrapping controls and a scrollable room without page-wide horizontal overflow. These are controlled fixtures, not screenshots of the installed daily app.

## Supplemental native verification

Expanded the existing voyage fixture without changing application code, then ran hidden Electron with `desktop/workflow-smoke.cjs --voyage-bar` against the validated build. All 17 listed checks passed; see the [supplemental receipt](evidence/voyage-bar-m4-2026-11-08/native-supplemental.json) and [fixture source hashes/run location](evidence/voyage-bar-m4-2026-11-08/supplemental-source.json).

Added waiting-state coverage, historical and missing attempt review guards, native Tab order and Enter activation, opening the selected approval request, Escape/focus return and unsent draft preservation through both dialogs, task-scoped keyboard Stop, draft/selection preservation across room navigation, and retained status information with the app's reduced-motion preference disabled. This does not override or certify the OS motion preference. The first supplemental attempt failed because the test's Enter sequence omitted the character event; the corrected helper follows existing Electron fixtures. The failed receipt is retained and referenced rather than counted as a pass.

Remaining qualification: M3's continuous live journey, latency and hosted-validation prerequisites remain unresolved. Screen-reader testing remains unperformed. Do not open execution admission or announce full M4 acceptance on this receipt alone.

Rollback: revert the supplemental fixture/evidence commit first, then `31852db` to remove the bar and its fixture/harness changes. There is no data migration; existing saved workspace context remains compatible. This continuation changes only fixture coverage, documentation and evidence. The complete suite/build receipt applies to `31852db`; supplemental fixture edits were verified by the targeted native run rather than claiming another full-suite run.

2026-11-09 update: the final clean M4–M7 candidate ccb702c passed 1,794 tests, build, 124 native checks and all 18 contained package cases. Exact-package results and responsive-world corrections are recorded in the [current qualification checkpoint](crew-voyage-qualification-2026-11-09.md); the older pending statements above describe their dated checkpoints. Live/release prerequisites remain separate.
