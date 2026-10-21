---
name: sunny-ui-validation
description: Validate Sunny HQ interface changes using its existing Electron fixture, focused regression tests, screenshots, keyboard flows, and reduced-motion checks. Use for Sunny UI changes or UI verification requests.
---

# Sunny UI validation

Work from the selected Sunny checkout. Read its AGENTS.md, package.json, and the affected UI before choosing checks. Preserve its current uncommitted work. Source checkouts, fixture windows, and the installed Sunny app may differ; identify which one was tested.

## Choose the checks

Use the checkout's existing tests and fixture instead of adding a browser framework solely for validation. Relevant starting points are tests/deck-motion.test.cjs, tests/room-motion.test.cjs, and tests/mission-workflow.test.cjs. Inspect their coverage and select cases relevant to the change. Apply the project's required test/build gates; a focused pass does not replace a required full suite.

On this Windows setup, README.md documents a broken npm shim. If needed invoke the installed CLI directly from the repository root:

```powershell
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run build
& 'C:\Program Files\nodejs\node.exe' --test tests/room-motion.test.cjs
```

Choose the relevant test file rather than treating that example as universal coverage. Use Node 24 per AGENTS.md; check available runtimes and dependencies before running. Do not package or replace the installed application to perform a UI check.

## Exercise the actual UI

Inspect desktop/workflow-smoke.cjs before invoking it, especially if locally modified. It loads dist/index.html against controlled IPC, uses an isolated fixture profile, and writes screenshots plus result.json beneath .sunny-dev/workflow-check. Build first so dist matches the intended source.

Run the existing fixture with the checkout's Electron executable. Keep fixture windows hidden by setting SUNNY_SMOKE_HIDDEN=1 for that process, and restore any previous environment value afterward. The invocation shape is:

```powershell
& '.\node_modules\electron\dist\electron.exe' '.\desktop\workflow-smoke.cjs'
```

Verify that executable exists. Read the current result.json and process output, check the exit result, and inspect the relevant newly generated screenshots. An old result file is not evidence for the current run. Do not substitute account-dependent live checks for the isolated fixture unless the task actually requires and authorizes them.

For affected interactions, check keyboard reachability and activation, visible focus, labels/errors, dialog Escape and focus return where applicable, and layout at the affected window sizes. Verify normal motion and reduced motion, plus Sunny's pause setting for animated surfaces. The fixture starts with reduced motion enabled; its pass alone does not establish normal-motion coverage. Supplement it with a scoped UI check when needed, and state any untested screen-reader behavior.

Check working, waiting/approval, interrupted or unknown, failed, and completed presentations only where the change affects them. State must come from fixture events or actual application state; animation and a finished model turn do not prove mission completion. Avoid real missions, user-profile changes, or external messages just to populate a screenshot.

For world or sprite changes, also use sunny-world-art-review and the checkout's docs/art-bible.md, docs/world-bible.md, and public/assets/ARTWORK.md. Preserve the existing Sunny identity; this skill is validation guidance, not a redesign brief.

## Report evidence

Identify the checkout and tested revision/worktree changes, commands and outcomes, screenshot locations, interactions visually inspected, and anything unverified. Separate fixture results from installed-app or live-provider results. Report failures as failures; a build pass is not proof the interaction works. If the runtime is unavailable, give the exact blocker and complete unaffected checks without inventing a pass.
