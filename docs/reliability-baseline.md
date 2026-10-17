# Reliability baseline — 2026-10-12

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

## Integrated candidate validation — 2026-10-16

The newer committed local work is integrated on `codex/integrate-local-sunny`. Source commits are `fb97855` (integration), `a86da50` (profile fidelity and clean-checkout fixtures), and `5940758` (exact serialized control evidence). The original checkout's existing README, baseline and untracked plan edits were preserved; nothing was pushed or merged to main.

The packaged source is `5940758280f39d941939090f925a90a65d10ec27`, clean at build time; version 0.11.0, build ID `5123e84ec8f7ac57d833a8c83dd01cf1e71875fcbab8d49e6e4f8cd726931a65`. Executable SHA-256: `6543d89a778353a558bb391454ce4b9756617663c461474543461173f4abfd21`; archive SHA-256: `468182ade957bf3d1fe083b343a039c8191a6f63da03fa1e843622d3ea9c6516`. Package: `release/win-unpacked` in the integration worktree. This is a candidate, not the daily installation.

Fresh checks: clean Node 24 dependency install, TypeScript/Vite build, 70 compatibility regressions, 56 additional compatibility/fixture tests, 12 copied-profile/IPC tests, 34 receipt/control regressions, and the native production-transport workflow fixture passed. The full run completed 1,520 tests: 1,505 passed and 15 failed; it started before the final fixes. All fifteen failures have passing targeted reruns, including the complete seven-case playable file (7/7) after fixing its assumption that an external sibling evidence directory exists. Do not describe the original full run as green.

All nine latest-package contained scenarios passed with observed process cleanup: startup, renderer crash, main restart, worker loss, write failure, lost acknowledgement, pending approval, pending check and normal quit. All use isolated synthetic profiles and zero real-provider effects.

### Promotion blocker: large-history control latency

The unchanged frozen control protocol uses 20 measured Stop and 20 approval operations per size, under pending background persistence, SQLite WAL/FULL, full history and exact durable receipts. Measurements below retain the failed batches; no thresholds or workload were changed.

| History | Stop p95 | Approval p95 | Maximum main timer excess | Gate |
| --- | ---: | ---: | ---: | --- |
| 1 MiB | 92.4 ms | 77.5 ms | 16.3 ms | Pass |
| 10 MiB | 421.3 ms | 728.4 ms | 57.1 ms | Fail: control RTT |
| 30 MiB | 1,040.2 ms | 1,483.9 ms | 148.5 ms | Fail: control RTT and main timer |

All 120 measured operations completed with correct effect/reservation semantics and exact whole-state preservation. This does not satisfy the required p95 below 200 ms and timer excess at most 100 ms. Failed run receipts report cleanup observed. The control evidence writer correctly refuses a passing package receipt when performance assertions fail.

The 10 MiB first Stop sample spent 187.6 ms waiting for the required save to start; its background and required receipts awaited 172.8 and 179.5 ms respectively. This locates a material delay in whole-image durable persistence/queue waiting. It does not isolate all time to disk or establish a speedup comparison. A separate synthetic store probe also confirms that serialization and SQLite write costs both contribute; those diagnostic samples are not substituted for native acceptance measurements.

Per the [frozen protocol](evidence/protocols/ordered-control-2026-10-02.md), these violations prevent promotion. Next design work should measure per-stage costs with the exact mutated workload and assess reducing full-image copying and redundant writes while preserving ordered intent/receipt barriers. Schema changes or incremental storage need their own compatibility, backup, rollback and failure design. Returning before durability, truncating history, changing WAL/FULL, relaxing thresholds, or cherry-picking reruns are rejected alternatives.

Evidence resides under `.sunny-dev/integration/` in the integration worktree: `verification-summary.json`, `receipt-control-{1,10,30}/output`, `current-<scenario>/output`, `full-tests.log`, targeted rerun logs and `workflow-transport/result.json`. Failed earlier receipt-format and timed-out journey evidence is retained. The daily profile has not been migrated and the prior executable remains the Start Menu target. No installation success is claimed.

Final journey: the isolated latest-package journey-cue run passed in 264,313 ms within the unchanged 300-second limit, with distinct restart phases, zero provider effects and observed cleanup. It completed source review, stopped preview, requested feedback, second review, captain acceptance and restart/no-replay checks. Evidence: .sunny-dev/integration/isolated-journey-cue/output. The earlier timeout remains failed historical evidence. Windows retargeted the Start Menu shortcut during fixture launches; it was restored and verified against the existing daily executable. Large-history latency still blocks installation. The compact [versioned evidence manifest](evidence/integration-validation-2026-10-16.json) binds the tested package and receipts.

### History-repair validation follow-up — 2026-10-16

Candidate `6f0f39d` passed the unchanged 1/10/30 MiB control gates and nine packaged recovery scenarios. Its isolated mission journey failed while integrating finished worker results. A separate diagnostic package traced `git rev-list` interpreting a commit range as a possible filename in a 177-character Windows workspace path; a read-only reproduction on that failed fixture succeeded with an explicit `--` revision/path separator. The resulting numeric process exit code also violated the delivery failure-code schema, preventing the blocked state from being persisted.

The follow-up adds that separator to integration, conflict-resolution and verification range reads, and normalizes invalid delivery error codes to `DELIVERY_BLOCKED`. Uncertainty classification and retained reservations are unchanged. Both reproducing regressions failed before the fix and passed afterward. An independent read-only review found no introduced correctness or authority defects. The fixed package still requires fresh acceptance and a complete source run before installation; prior failures and partial runs remain retained under `.sunny-dev/history-repair/`.
