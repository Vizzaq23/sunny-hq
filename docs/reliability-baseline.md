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
