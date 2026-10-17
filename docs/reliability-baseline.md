# Reliability baseline — 2026-10-12

## Current reconciliation — 2026-10-14

The October 12 observations below are historical. The captain supplied the Start Menu shortcut and chose to keep changes in this repository and **plan integration of the installed app's newer work first**. No application code, installed package or daily profile was changed in this reconciliation. The integration sequence is in [the integration plan](superpowers/plans/2026-10-14-installed-workshop-integration.md).

### Exact package and source

- This checkout: `C:\Users\Quintin\Documents\GitHub\sunny-hq`, branch `codex/sunny-hq`, HEAD `ea90831d031073fee9963d248bbe659a60f2bca3`; initially clean. Today's commit already supplies reviewed-result saving and safe pre-submit launch recovery.
- Supplied shortcut: `C:\Users\Quintin\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Sunny HQ.lnk`, no arguments.
- Its executable, actually launched for these offline checks: `C:\Users\Quintin\Documents\Codex\2026-10-03\im\outputs\Sunny-HQ-Decisions-20261008\win-unpacked\Sunny HQ.exe`.
- Version: 0.11.0; Electron 44.4.3, packaged Node 24.21.0. Executable SHA-256: `a2a1907ee5f88614b239e00a65189d308bde48ebc22b2d54d78feff65853d70b`; `resources/app.asar` SHA-256: `5e00e2e70fe7fedc9aee66454972c81527517335773d354581f8cab1024fce2e`.
- Embedded `dist/build-info.json`: source commit `e061bda90a66f2ee9440dd55e9988ec8ea3390a6`, `sourceDirty: true`, source-input build ID `29271e3c2ec3cda87c05fc36f0b12cc35dd37beb4f740cc7fdaf9bc48abe7a67`. The exact dirty build delta is not established by that metadata alone.
- Matching HEAD found at `C:\Users\Quintin\Documents\Codex\2026-10-03\im\work\sunny-hq-upgrade`, branch `codex/sunny-hq-upgrade-20261003`. Existing modified files: `desktop/hub.cjs`, `docs/agent-routing.md`, `tests/jev-hub.test.cjs`. Existing untracked files: `desktop/openai-decisions.cjs`, `desktop/task-advice.cjs`, `tests/openai-decisions.test.cjs`. These were preserved; their presence today does not prove they equal the packaged dirty delta.
- Installed source and reviewed `d1779c2` diverge from merge base `c58ffc48bf943b6a27f3a9da5e58c1dba3eae0bf`; the installed-source commit was initially absent and has since been fetched locally for the isolated investigation below. Comparing `d1779c2` to `e061bda` in the other repository reports 419 changed files. This is not a safe wholesale directory replacement.
- Default daily profile inferred from packaged main code: `%USERPROFILE%\AppData\Local\Sunny HQ`. The shortcut has no override, but an inherited environment override remains possible. No daily profile data was read or modified. Tested profiles are the isolated paths below.
- All three paths in this repository's `Launch Sunny.cmd` are absent. Local development Electron exists, unlike the October 12 baseline. It is not the shortcut package.

### Ownership failure investigation — 2026-10-14 follow-up

The original checkout stays on `codex/sunny-hq` at `ea90831`, with its existing documentation edits preserved. Two managed worktrees belong to this same Git repository: `codex/workshop-integration` starts at `ea90831`; `codex/workshop-donor-recovery` starts at donor `e061bda` and contains the isolated fixes below. The original donor checkout was read only. No installed package, shortcut or daily profile was changed.

The donor commit is now available locally. All **142 packaged desktop CJS entries** match the original donor working files byte-for-byte; the detailed local hash maps are `.sunny-dev/installed-source-map-20261014.json` and `.sunny-dev/donor-delta-map-20261014.json`. Compared with clean `e061bda`, normalizing checkout CRLF, the packaged desktop delta consists of the advice-related `desktop/hub.cjs` change and added `desktop/openai-decisions.cjs` / `desktop/task-advice.cjs`. These Decisions/advice changes are excluded from source integration. Donor documentation/test edits are not desktop runtime entries. This map establishes the failure's desktop inputs, not every bundled renderer/asset input.

**Root cause:** the finite offline provider matched the first `Bounded Sunny assignment ...` in the combined prompt. Growth recall contained the previous alpha assignment before the current beta instruction. Both retained worker commits therefore edited `src/alpha.cjs`; beta was legitimately rejected by the production ownership guard. This was a fixture assignment-selection defect, not evidence that the guard should accept unowned paths.

- `3ebdd6d` changes `desktop/journey-provider.cjs` to select the assignment anchored immediately after the final `Current captain message` boundary. Its regression executes the actual admitted finite provider and real Git writes: recalled alpha cannot replace current beta, and missing/unplanned current assignments write nothing. Observed red before the fix, then green. No path-validation logic changed.
- A first separate verification copy passed alpha/beta and combined checks, then exposed reviewer workspace preparation incorrectly treating temporary checkout contention as permanent `ASSIGNMENT_ADMISSION_FAILED`. `a993ebf` checks the existing gate before workspace reservation and emits the scheduler's existing capacity-pending outcome. The actual Hub regression verifies the next assignment stays queued without a workspace/launch reservation, then starts once after automatic release/wake. Observed red then green; lock enforcement and uncertain-state handling are unchanged.
- Clean donor reproduction `npm ci` and TypeScript/Vite build passed (large-bundle warning). Ownership/integration/receipt tests passed **22/22**; scheduler, provider, admission and capacity tests passed **27/27**, zero skipped. An overlapping full-suite run was interrupted and is not a pass. Independent review found no substantive issue in either fix. Additional coverage for a recalled episode containing its own current-message boundary is deferred; basic recalled/missing/unplanned cases are covered.

The first verification copy is `.sunny-dev/alpha-verification-hS5jX9/win-unpacked/Sunny HQ.exe`, ASAR SHA-256 `7840515a3d91c3844a3e508100375cdfb7fcb3cda6db0bdc28c189ba9cb4f457`. Only the provider and build identity differed from the installed archive. Its supervisor reported `accepted:false`, cleanup observed, 200,191 ms, with the reviewer contention above. A second copy includes both fixes and separate build identity: `.sunny-dev/alpha-verification-OPm7Gz/win-unpacked/Sunny HQ.exe`, ASAR SHA-256 `294bdd7e9df0f1f5986bd33667d5fcf13161190bb3569142c7584c9b14012522`. Each copy has a byte-level `identity.json`; the original archive hash was checked again. They are explicitly identified overlays of the installed package, not clean builds of the integration branch.

The second copy then completed both reviews and the first playable interaction/confirmed stop, but failed after feedback (`accepted:false`, cleanup observed, 224,868 ms): the fixture's `sourceReviewed` predicate reused the prior completed delivery while the new attempt had no selected result. Commit `dd98789` binds that observation to the active attempt and selected result. The new regression failed against the old predicate and passed after the fix; observation/admission/receipt checks passed **11/11**. A clean build at `540f3f33e54bb89458962f9a8b0f160c1c20c5af` passed, build ID `d8eea79790ecbe407beb0092e3f581483da793f7a113c29be63a6e274aeb1a93` (large-bundle warning only).

The latest separately launched copy is `.sunny-dev/alpha-verification-K3gk33/win-unpacked/Sunny HQ.exe`, ASAR SHA-256 `e261932efb84f2c70ac45b90d8dda7f04d2cd977abe467ad44b151de9b8865f3`. Its four changed entries are Hub, journey provider, journey observer and build identity. The contained supervisor **timed out at 300,052 ms**, `accepted:false`, cleanup observed, zero active owned processes. Both first-attempt reviewers and playable interaction/stop finished; feedback started once, both second-attempt authors finished, and the second delivery was still integrating with reviewers queued. No stored blocker or fixture exception was present at termination. The full source suite was running concurrently, so this is not an isolated performance benchmark. Acceptance, cue replay and restart remain unverified. The runner's existing deadline and receipt requirements were retained.
Full-suite status: `npm test -- --test-concurrency=4` was interrupted at this failed native reliability checkpoint while `checkpoint-journey-faults.test.cjs` and `supervised-journey.test.cjs` were still running. It has no complete test-summary receipt and **is not a pass**. Log: managed donor-recovery worktree `integration-baseline-tests.log`. The rejected `NODE_OPTIONS=--test-concurrency=4` invocation ran no tests; the subsequent CLI flag worked. Owned test descendants were checked absent after termination. Targeted completed logs are `ownership-regressions.log` (22/22), `followup-regressions.log` (27/27), and `final-build.log`; the separate observation/admission/receipt invocation passed 11/11. No lint command is configured or claimed.
Final branch HEAD is `dd98789` (the built `540f3f3` amended only to remove an extra EOF blank line in a test). Full source diff whitespace check passes.

**Integration boundary:** these fixes are committed in the same repository's donor-recovery worktree because their owning modules do not yet exist at `ea90831`. They have not been transplanted into the integration branch along with their dependency closure. Storage/save/retry reconciliation and the workshop remain pending; no complete integrated mission or new visual implementation is claimed. Retain the newer reviewed-result save and safe retry behavior before importing donor Hub/main contracts. Revert the three recovery-branch commits to undo these source fixes; no installed-app/profile rollback is necessary.

### Historical findings reconciled before edits

| Finding | Current status | Evidence and boundary |
| --- | --- | --- |
| P1: installed identity unknown | Fixed for the supplied shortcut; dirty source delta unverified | Exact launched executable, archive hashes and embedded source identity above. Version 0.11.0 alone cannot distinguish the builds. |
| P2: mission usage receipt | Still present in this checkout; installed completeness unverified | `MissionExecution.tsx` still displays per-thread reported tokens; `CrewAssignments.tsx` renders those individually. No new aggregation or budget is claimed. Unknown usage must remain unknown. |
| P3: understand/verify recovery and acceptance | Source checks pass; complete installed journey still fails | 33 focused tests passed. Actual package restart and renderer-crash fixtures passed; end-to-end journey failed below. Worker completion is not captain acceptance. |
| P4: compare optional routing | Unverified | No new routing experiment or live call. Existing explicit-choice/fallback tests are included in source validation; they do not establish improved outcomes or savings. |
| Franky's art at 19% opacity | Still present in this checkout; addressed in installed workshop | `src/styles.css` sets `.conversation-room-art` to `.19`. Fresh installed screenshot shows a separate full-opacity workshop. |
| Opening work replaces ship | Still present in this checkout; newer installed layout exists | `src/App.tsx` returns `Workbench` early when workspace is selected. Installed package has embedded workspace/Franky components; all navigation paths are not freshly certified. |

### Fresh verification and limitations

- Node 24.18.0 source checks: focused `jev-hub`, `mission-workflow`, `failed-launch-recovery`, `mission-review`: **33/33 passed**. Full `npm test`: **417/417 passed, zero skipped**. `npm run build`: **passed**, including TypeScript; Vite reports a large-chunk warning. Initial sandboxed suite/build failed on filesystem permissions (including rename and `realpath src/main.tsx`); rerunning outside the sandbox passed without code edits. Logs: `.sunny-dev/workshop-gate-{tests,build}-unrestricted.log`.
- Exact installed package, offline `main-restart`: phase 1 exited 73 intentionally; phase 2 exited 0 with the same saved draft hash and selected result reference. `fixture-uncertain` remained `unknown` and reserved. Both phases reported zero provider effects. Profile/evidence root: `.sunny-dev/installed-gate-AeePDe/main-restart/`.
- Exact installed package, offline `renderer-crash`: actual renderer crash exit code 2, reload succeeded, identity retained, zero provider effects. Profile/evidence root: `.sunny-dev/installed-gate-AeePDe/renderer-crash/`. This fixture explicitly reloads; it does not certify the interactive production recovery dialog.
- Installed `run-ui` display fixture produced full/compact workshop and reduced-motion screenshots, but **did not finish or produce its phase receipt**. Its temporary driver was interrupted before the next scenario to switch to the existing contained supervisor. Last recorded display progress was `capture:world-inspect-robin`. Treat keyboard, long-history, all layout cases and restart completion as **unverified**, not passed. Root: `.sunny-dev/installed-gate-7qIbFg/run-ui/`. Subsequent exact-manifest process lookup found no active fixture root.
- Installed `journey-cue`, run through the existing `scripts/packaged-supervisor.cjs` with a new isolated profile: **failed**, `accepted:false`, cleanup observed, 45,586 ms. Durable fixture delivery reason: `Worker path outside owned paths: src/alpha.cjs`, code `DELIVERY_BLOCKED`, mission `17dfdfc2-6ae4-42ee-8bbe-cb1dc4355c96`, attempt `574ab056-eebd-40ee-b03e-9bdf732a1d50`. Last completed progress marker: `renderer-ready`; no accepted mission or phase-completion receipt. Root: `.sunny-dev/contained-journey-83f0d43e8ef3406dbf70e4bd87188b7f/`. Diagnose the path ownership failure before visual integration; do not weaken its guard. This does not yet distinguish a fixture defect from a product defect.
- `npm ci` in a clean checkout, the current checkout's Electron workflow suite, 10/30 MiB history benchmarks, a complete interrupted-to-accepted journey, and before/after screenshots of a new implementation were **not completed**. No new UI implementation is claimed. No live provider mission was started.

Fresh installed display evidence (synthetic state, not a completed mission):

![Installed Franky workshop, working display fixture](../.sunny-dev/installed-gate-7qIbFg/run-ui/evidence/run-ui/world-working-workshop-full.png)

### Walkthrough and acceptance boundary

The installed restart fixture saves a draft/result and an uncertain task, exits the main process, and opens the same isolated profile in a new process. The draft/result identities remain identical, and uncertain work keeps its reservation rather than being silently retried. The renderer fixture separately crashes the rendering process and restores the saved projection. Neither proves the requested complete mission: the subsequent genuine local fixture journey reaches a blocked delivery before tests/review/acceptance. The next integration step must reproduce and explain that failure, preserve the current branch's recovery tests, and only then verify a goal-to-approved-result workshop journey.

No issue or PR was created: this is a local reconciliation and integration plan. Rollback is limited to reverting these documentation edits; fixtures are isolated and no package/profile rollback is needed.

---

Scope: priorities 1–2, durable reviewed-result saving and recovery. Report acceptance is gated on recovery; workshop behavior and visual polish remain gated. Shared browser/Obsidian navigation, routing expansion and local voice are later work.

## Reproducible source baseline

- Checkout: `C:\Users\Quintin\Documents\GitHub\sunny-hq`.
- Branch: `codex/sunny-hq`; source revision: `01edef1253ec2376fd5dc6e3ef99ffb0ee061019`.
- Working tree was clean before this baseline document.
- Source package: Sunny HQ 0.11.0; declared Electron dependency: 44.4.3; observed Node: v24.18.0.
- `Launch Sunny.cmd` tries `.sunny-dev/validated-release-integration-2026-09-22/win-unpacked/Sunny HQ.exe`, then `release-workflow-0.11.0/win-unpacked/Sunny HQ.exe`, then `release/win-unpacked/Sunny HQ.exe`. None exists in this checkout. `node_modules/electron/dist/electron.exe` is also absent. No Sunny HQ process was returned by the process check. This does not rule out installations elsewhere.
- README's 0.10.0 launch instructions are stale relative to the launcher. No installed build version was verified, and no live profile was opened or changed.

Reproduce focused source checks in PowerShell from the checkout:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/skill-pipeline.test.cjs
1..3 | ForEach-Object {
  & 'C:\Program Files\nodejs\node.exe' --test tests/hub.test.cjs tests/mission-hub.test.cjs
  if ($LASTEXITCODE -ne 0) { throw "Recovery regression trial $_ failed" }
}
```

Observed: skill pipeline 4/4 passed; recovery regressions 54/54 passed in each of three consecutive runs. These use isolated fixtures and mocked provider requests. They do not establish live worker crash recovery or a complete report journey. Dependency installation, full suite, build and Electron workflow checks were not run in this baseline inspection.

## Confirmed gaps

1. `src/views/MissionBoard.tsx` sends mission ID, revision and role/crew to `mission:start`, but no selected skills. `desktop/hub.cjs` already resolves and persists selected skills and delivers structured skill inputs; focused tests exercise that backend path.
2. `src/views/MorgansView.tsx` invokes `library:capture` with title/text, discards the returned path, and sets a React-only saved boolean. `src/App.tsx` initializes report state empty. No durable report-to-note receipt is saved by this flow.
3. `desktop/main.cjs` creates capture filenames using the current timestamp with exclusive creation. A repeated request is not keyed to its original task/result and can create another note. There is no reconciliation of a note written before its reply was lost.

These are source findings, not observed live-task failures. Task ID: not applicable; no real task launched. Last successful step: focused source regressions. Startup blocker: launcher targets and local Electron executable absent. No fabricated task/error record substitutes for the required live evidence.

## Next implementation and acceptance boundary

Extend the existing Hub persistence and guarded vault writer with a reviewed-result save record, binding task/mission attempt where present, exact reviewed content revision, operation ID, exact destination and receipt. Persist intent before writing. Reconcile interrupted operations at their original destination; verify identity/content before claiming saved and never overwrite conflicting notes. Show saved, failed and needs recovery from durable state. Saving a draft must not imply mission acceptance.

Before implementation, document optional-field compatibility, backup, rollback and failure cases. Old records must remain unsaved/unknown unless a receipt proves otherwise. No bulk matching of old notes or automatic retry of worker commands.

Required fresh evidence: record build hash, isolated profile, task ID, last successful step, injected failure, visible error and explicit recovery action for each trial. Interrupt a worker and fail a request in three consecutive trials; verify preserved goals/results, no duplicate work/approvals and no silent stuck state. Separately interrupt save before write, after write/before receipt, and after receipt/before response; restart and prove one note per reviewed result. Include conflict and changed-vault handling. Only then attempt three complete report journeys with accept/request-changes and restart persistence.

Installed-build activation remains a separate step after source validation and a closed-profile backup; never restore an older backup over current data to pass a test.

## Resumed original reliability work — 2026-10-17

Scope: `codex/sunny-hq`, runtime revision `ea90831`. This is separate from the newer donor/UI worktrees and installation candidates recorded above. Pre-existing README, baseline and integration-plan edits were preserved. The daily application, shortcut and normal profile were not changed.

The October 13 worker-crash run stopped in trial 2 after restart reconciliation. Its packaged composite smoke stopped after `SUNNY_COMPANION`, and the strict report run stopped during the first review. None has a final completion receipt; they are interrupted evidence, not passes.

Fresh checks:

- Clean checkout `.sunny-dev/reliability-clean-20261017` at `ea90831`: Node 24.18.0 `npm ci`, **417/417 tests, zero skipped**, and TypeScript/Vite build passed. Existing dependency audit: 9 moderate/3 high findings; Vite large-bundle warning. No dependencies or security settings changed. Logs: `.sunny-dev/reliability-clean-{ci,tests,build}-20261017.log`.
- **Three consecutive live abrupt provider crashes and failed-request recovery trials passed.** Original tasks: `3932a049-6a0c-4e4e-b449-96a68b4ace43`, `d588e3ce-144c-4191-90b0-873d4eb5b5a3`, `e8f52e98-d193-4b1a-a937-9029675b53b0`. Each preserved the checkpoint, reconciled unknown to interrupted after restart, continued the same task/thread, and retained one reviewed note. Each injected pre-submit failure required one explicit linked replacement and created no duplicate submission or approvals. Root: `C:/Users/Quintin/AppData/Local/Temp/sunny-live-recovery-izaWER`; log: `.sunny-dev/recovery-resume-20261017.log`.
- The preserved package, ASAR SHA-256 `1517070cb7bd7875fd101fb57f8ff642a45d0644d1b983717c5a11c84054ad90`, passed the hidden offline package fixture: SQLite process exit/reopen, exact note/receipt, backup inclusion, uncertain-task reservation, conflict recovery without duplication, renderer crash/reload, zero provider calls. Receipt: `.sunny-dev/package-receipt-20261017/result.json`. Its desktop comparison matches 55 entries; three differences are validation scripts. Renderer bundles differ from the fresh clean build, so it is not claimed as an exact build of `ea90831`.
- Hidden renderer workflow passed with `hidden:true`: `.sunny-dev/resume-workflow-final-20261017.log` and `.sunny-dev/workflow-check/result.json`. Existing approval, draft, editor, reporter retry, receipt reload and conflict checks remain enabled.
- A newly packaged **clean `ea90831` checkout** also passed the full targeted package check. ASAR SHA-256: `ee5052ff774220a6f269ad5f83084ad12f52f97a4f652a472e61119bb74a7d4e`; package: `.sunny-dev/reliability-clean-package-20261017/win-unpacked`; receipt: `.sunny-dev/clean-package-receipt-20261017/result.json`. The deliberate writer exit was 73, verification exit was 0, and provider calls were zero.
- The offscreen mission fixture passed with final `SUNNY_MISSION` receipt in `.sunny-dev/resume-mission-final-20261017.log`: selected-skill launch, acceptance gate, accepted-report save, persistence and reload. Synthetic provider/GitHub transport is explicitly labelled; this is not a live report-journey pass.

The package fixture loads actual packaged Hub/SQLite/preload/renderer code through a controlled IPC fixture. It does **not** certify the production main-process startup, interactive renderer-recovery dialog, or the newer daily installation. Its first verification attempt hit an Electron ASAR hashing error after the behavior checks; using `original-fs` for the archive bytes fixed the harness, and the complete check then passed. No runtime assertion was removed.

The fresh strict report run correctly rejected mission `ad7ca0b4-8544-499a-8464-4776fc4c99f2` because Luffy reported the Windows npm shim failed before running the test. Coordinator task: `35bbc071-09da-449a-a963-b7094d6cc87d`; last successful work: all four crew stages and report collection; failure: `Coordinator did not recommend acceptance`. Root: `C:/Users/Quintin/AppData/Local/Temp/sunny-live-report-8RaXC0`. The fixture now supplies the verified direct Node/npm CLI command in its project instructions, preserving the original package test and all quality/review gates. Automated acceptance in this fixture is explicitly a test-harness decision, never a claim of human acceptance.

The first corrected run (`sunny-live-report-Sjlda0`, mission `a8948222-b0d7-4ab6-9a8c-52eb738c4c85`) passed initial review and persisted request-changes across restart, then was interrupted during revised-attempt validation. Its process disappeared and it has no completion receipt. The next setup (`sunny-live-report-N4QbiY`) failed at `git add .` with a loose-object permission denial before any Hub or task existed. Both remain distinct from product recovery failures. The following fresh fixture successfully passed that setup unchanged; no ACL or security setting was altered.

The final corrected run **passed three consecutive complete live report journeys**, exit 0, root `C:/Users/Quintin/AppData/Local/Temp/sunny-live-report-ZnuDCd`, log `.sunny-dev/report-verified-20261017.log`. Missions: `ecb36dfc-bc0d-4981-b854-702f816e6fa2`, `b761ed1e-ea74-4bc0-bd77-d4247f2bb2d6`, `9f06b4fb-982c-47a6-898e-caffa2af5349`. Each executed all four real crew stages twice, passed the unchanged original test and strict report checks, preserved request-changes across restart, accepted only after the revised attempt, and preserved exactly one note with a verified receipt after restart. No provider approval was granted. This establishes the bounded synthetic journey on this runtime; captain decisions were simulated by the harness. It does not authorize installation, later workshop work, or external publication.

Structured evidence, including exact task IDs, note receipts, package hashes and incomplete/failed runs, is retained in `docs/evidence/reliability-resume-2026-10-17.json`. Raw logs and disposable packages remain under `.sunny-dev/`; synthetic live profiles remain at their recorded temporary paths. The captain subsequently requested committing all current work; validation scripts, documentation and the UI validation skill are committed on `codex/sunny-hq`.

### Installation readback after the captain's update request

At `2026-10-17T05:46:27Z`, a concurrent installation had already copied the newer UI candidate `8b1096e` to `C:/Users/Quintin/AppData/Local/Programs/Sunny HQ/versions/0.11.0-helm-8b1096e` and changed the Start Menu shortcut. This task independently compared all **251 files** against `.sunny-dev/ui-revamp/package-admission/win-unpacked` in the UI worktree; every hash matched. EXE SHA-256: `2ff9465e73764326bc9b6a821ba5c6e383751125dbf5ea1b91919fbc03947df3`; ASAR: `0f7b9632deb442b14e51fdf852ce45ebf7a8faaf390223d7f2257f4a58c49008`. Shortcut readback matched. The online SQLite backup at `C:/Users/Quintin/AppData/Local/Sunny HQ Backups/before-helm-2026-10-17/sunny.sqlite` matched its recorded checksum and its integrity receipt says `ok`. Verification receipt: `.sunny-dev/installed-copy-verified-20261017.json`. No app was launched or force-closed by this task.

Installation is not a new green-release claim: that UI candidate has 12/15 accepted package checks, failed 10/30 MiB control latency and two-build cue timeout, and an interrupted complete suite. Its installation receipt records the captain's explicit update request as a release exception. The passing 417-test reliability baseline above applies to `ea90831`, not the newer installed UI package. Keep the prior executable and backup; resolve the recorded UI release failures separately.

Reproduce the hidden package check from this checkout with Electron, a package directory and a **new disposable** profile path:

```powershell
$env:ELECTRON_RUN_AS_NODE=$null
$package='.sunny-dev/reliability-clean-package-20261017/win-unpacked'
$profile='.sunny-dev/package-check-'+[guid]::NewGuid().ToString('N')
foreach($phase in @('write','verify')) {
  $probe=Start-Process node_modules/electron/dist/electron.exe -ArgumentList @('desktop/packaged-result-save-check.cjs',$package,$profile,$phase) -WindowStyle Hidden -Wait -PassThru
  $expected=if($phase -eq 'write'){73}else{0}
  if($probe.ExitCode -ne $expected){throw "Package check failed in $phase"}
}
```

`SUNNY_RUN_LIVE_RECOVERY=1` plus `SUNNY_RECOVERY_CRASH_WORKER=1` opts into the live recovery probe; `SUNNY_RUN_LIVE_REPORT=1` opts into the live report probe. They use account quota only when explicitly run. `SUNNY_SMOKE_HIDDEN=1` keeps `desktop/workflow-smoke.cjs` offscreen and records visibility proof. Live checks use synthetic projects/vaults, preserve failure evidence, and grant no provider approvals.
