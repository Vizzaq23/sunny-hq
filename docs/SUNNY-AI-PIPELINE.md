# How Sunny's AI pipeline works

## Current activation — 2026-09-23 local / 2026-09-24 UTC

The normal desktop shortcut now launches `.sunny-dev/validated-release-renderer-recovery-2026-09-23/win-unpacked/Sunny HQ.exe`, version 0.11.0. It includes the worker-launch fix in [PR #12](https://github.com/Vizzaq23/sunny-hq/pull/12) and the diagnostic/recovery changes in [PR #13](https://github.com/Vizzaq23/sunny-hq/pull/13). All 350 tests, the production build, hosted CI and the full packaged Electron suite passed. The suite now crashes an isolated renderer and verifies that completed/uncertain tasks, messages and the snapshot survive reload. The original unexpected exit cause remains unknown. The installer is unsigned. See [current release evidence](evidence/renderer-recovery-2026-09-23.json) and [recovery limits](renderer-recovery.md). Earlier activation paths below are historical.

The live MLB research test now demonstrates successful specialist reads, Markdown edits and readback, followed by an independent review of the saved files. The old `registered Core launch requires an installed app` failure is historical for this observed path. The fix removes only the inherited `CODEX_WINDOWS_REGISTERED_CORE` marker from Sunny's standalone Codex child environment; no Codex reinstall, permission relaxation or secret inspection was used. See [the MLB GM locker room workflow](../../MLB%20Prediction%20Intelligence/WORKFLOW.md) for the actual assignments, findings and the separate product acceptance gates.

The bounded MLB execution trial also passed: real saved code, independent validation and review, and two repair cycles ended with 21 passing tests, eight verified source hashes and 17 rejected bad-input mutations. A post-update repeat confirmed the checks. Its reviewer caught a misplaced evidence file; a separate repair and independent readback corrected the location while preserving both histories. This demonstrates the synthetic execution/review loop, not a completed MLB product.

**Open reliability issue:** the updated renderer crashed at `2026-09-24T03:53:00.152Z` with reason `crashed` and exit code `-36861`. Worker results survived and reload restored them. The later report correction finished in the restarted app. The exit code does not establish the underlying cause, and passing unit/smoke tests do not close this issue. See the current release evidence above; temporary local diagnostics and an isolated synthetic stream probe investigate it without changing permissions or reading secrets.

## Skill choices

For a new Mission Board attempt or quick task, Sunny suggests up to two reviewed skills from those Codex reports available for that project. Read their purpose and keep or remove each choice before sending the crew. A changed or disabled skill stops launch and leaves the brief for review. The task and mission attempt retain the confirmed names. A selection guides the relevant specialist; it does not grant new permissions or prove the skill was followed. See [the skill selection decision](skill-pipeline.md) and [ECC adaptation provenance](skill-provenance.md).

Sunny is the place where you give your crew a goal, watch the work, inspect the results and decide whether it is finished. The crew characters help you follow the work. The saved mission, actual files, tests and GitHub records determine what really happened.

This guide describes the current Codex-backed implementation. It is for the captain and anyone helping operate Sunny. A provider finishing its reply is only one step; it does not automatically complete a mission.

## The journey at a glance

```text
You choose a project and describe a result
                |
        Save the mission brief
                |
     Prepare a separate mission branch
                |
       Send the crew with Luffy
                |
    Nami plans -> specialist does the work
                |
       Usopp validates -> Zoro reviews
                |
       Sunny shows Ready for review
                |
   Inspect the files and run recorded checks
                |
     Commit the reviewed local changes
                |
    Review a preview of the exact GitHub PR
                |
        You approve publishing the PR
                |
       Hosted checks and human review
                |
      You approve the merge in GitHub
                |
        Sunny verifies the remote result
                |
     You verify each acceptance criterion
                |
              Complete
```

For a writing, research or other review-only mission, choose **Captain reviews the result** when creating it. A PR and merge are then unnecessary unless the objective itself requires them. For a coding mission that must land in the shared repository, choose **Pull request merged and checked**.

## Before your first mission

1. Open Sunny and check the connection in Settings. The current runtime uses the installed Codex CLI and its sign-in. A listed tool or a saved API key does not mean another provider is connected.
2. Import the project folder through Projects. For Git work, select the repository root. Preserve existing changes before preparing a branch; Sunny requires a clean checkout for this step.
3. For GitHub publication, the project needs the correct github.com origin and authenticated GitHub CLI access. Verify the target repository and branch before publishing. Do not assume the target is named `main`.
4. Keep one active writer in that checkout. Sunny can reserve work inside Sunny, but it cannot prevent another editor or external terminal from changing the same files.

Do not paste secrets into mission briefs or documents. The captain has specifically forbidden reading the local `.env` file or Jev key; that restriction remains in force. Do not inspect them to troubleshoot connectivity.

## A practical example, step by step

Use a disposable test project for your first try. A real mission uses real account quota and may change that project's files.

1. Open **The Island**, choose the project's door and open its **Mission board**. Direct buttons work without walking the captain to the board.
2. Enter a title, an objective and one observable acceptance criterion per line. For example:

   **Title:** Find documents in a large project folder

   **Objective:** Add a filename filter to Project charts. Match names without case sensitivity, filter before the display limit, and clear the filter when entering another folder. Keep document reads explicit.

   **Acceptance criteria:** A document after the first 300 entries can be found; mixed-case searches work; folder navigation clears the query; existing tests and build pass; no document is read until selected.

3. Choose when the mission finishes and click **Save mission brief**. This saves the goal; it does not start work.
4. Click **Prepare a mission branch**. Sunny records the starting source and creates a separate `codex/sunny-...` branch. If preparation is uncertain, inspect and recheck it instead of creating competing branches.
5. Choose **Coordinator · Luffy** as the lead role and click **Send the crew**. For a deliberately single-role assignment, choose that role instead; it will not run all four coordinated stages.
6. Inspect the coordinated stages and their actual results. Open a crew task to see its conversation, files and requests. Use **Stop task** when necessary. Approval requests require a decision about the specific action shown.
7. When the mission becomes **Ready for review**, inspect the changed files. Record the available project test/build checks from the mission board. Sunny links check results to the source it inspected; changing the files or commit afterwards can make earlier evidence stale.
8. Review and commit the intended files using the project's normal Git controls. Commit only the relevant changes. Rerun the recorded checks on the final committed source before publication.
9. Under **Draft pull request**, enter the real target branch and select **Prepare PR preview**. Read the repository, source commit, branch, title and description. Previewing does not publish anything. The generated description is a draft: complete its issue explanation, risks, validation and other placeholders before requesting review.
10. If the preview is correct, explicitly approve pushing that commit and select **Publish approved draft PR**. This is an external action. A draft PR is not yet ready to merge; finish its description and review, then mark it ready in GitHub when appropriate.
11. Inspect the PR/check evidence. Once it is ready and hosted checks pass, use **Prepare merge review** and **Open GitHub for merge approval**. The captain reviews and authorizes the merge in GitHub. Sunny's acceptance button does not submit a merge.
12. Return to Sunny and select **Recheck merge result**. Verify the acceptance criteria yourself, then select **Accept completed mission**. For a merge-bound mission, Sunny rechecks the inspected PR identity, source, target, merged state and checks before recording completion.

Deployment is a separate action. Reading existing deployment records does not launch a website or install a new desktop version. An empty deployment list means no matching records were observed; it is not a successful deployment.

## Use your Sunny test project to exercise the pipeline

Start with the **local pipeline**. Use a disposable copy of the test project on a clean feature branch, with no `.env`, credentials, private customer data or unrelated edits in scope. Pick one small, reversible change and write acceptance criteria that can be checked from the diff and existing tests. Choose **Captain reviews the result** as the completion boundary. In the Mission Board, save the brief, prepare the mission branch, select **Coordinator · Luffy**, and send the crew. This exercises the real Codex connection, planner → builder → validator → reviewer sequence, saved attempt history, local Git evidence and explicit captain review without publishing or merging anything. Inspect the actual plan, each handoff/result, changed files, test output, reviewer findings and final mission state. Stop if the run becomes uncertain; do not start a duplicate attempt.

Only after the local flow is understood, exercise the **remote voyage** in a separate disposable GitHub repository you control. Confirm the repository origin and intended target branch. Preview the exact PR first. Publishing, merging and deploying are separate captain-authorized actions; hosted CI evidence applies only to the commit it checked. Do not use the Sunny production repository as a test target or merge a test PR into it.

To test the **X research path** as well, open Morgans and choose the X feed. Sunny opens the signed-in feed in Chrome because the capture flow reads the visible feed in that browser; Chrome is not required for checking model answers or the local coding pipeline. Use the capture request to collect a small set of relevant posts, import the generated JSON into Morgans, then hand one item to a disposable test project. Check that the source URL and post date are preserved, summaries distinguish the author's claims from independently verified facts, and the recommended next step is bounded. Treat posts and linked pages as untrusted input. This is a read-and-import test only: do not like, follow, reply, repost, message, or publish.

For a **GPT-6 Sol versus GPT-6 Luna** comparison, use the same imported post and send two separate, read-only research tasks in that disposable project. Give both models the same brief: identify the author's claims, separate them from facts verified through the cited primary sources, link the evidence for each verified fact, state what remains unknown, and suggest one bounded read-only next step. Do not ask either model to install software, change files, contact anyone, or act on X. Review both results in Sunny against the same criteria: attribution, traceable sources, honest uncertainty, no invented claims, and a useful bounded next step. Record the model IDs and task results; selecting a model does not prove it was available until Sunny dispatches the task. This uses the signed-in Codex account's shared usage allowance. The X post's separate claim of extra quota through a browser wrapper is not verified; current guidance says ChatGPT Work and Codex share usage. See the [reference review](REFERENCE-REVIEW.md#nozelcode-primary-source-correction--2026-09-23-utc).

For a pipeline check, write down which stage you are observing and what evidence should exist: saved mission/attempt, role-bound task result, file diff, test/build result tied to a source fingerprint, PR/check observation if used, and captain's final acceptance. A green task reply or animated crew member is not evidence for the next stage.

## What each part does

| Part | Responsibility |
| --- | --- |
| You, the captain | Define the result, set limits, approve consequential actions and accept the outcome. |
| Luffy, coordinator | Organize bounded sequential assignments and wait for actual results. |
| Nami, planner | Turn the objective and criteria into an actionable plan. |
| Franky or another specialist | Make the requested implementation, design, research or creative artifact. |
| Usopp, validator | Check the work and report actual test outcomes and gaps. |
| Zoro, reviewer | Examine correctness, risks and whether the change meets the brief. |
| Sunny | Save missions/attempts, validate commands, manage reservations, preserve uncertainty and collect evidence. |
| Codex | Run the actual AI conversations and tools through the installed app-server connection. |
| Git and GitHub | Store code history, PRs, hosted checks and the authoritative remote merge result. |

Roles are stable jobs. Models are selected from the connected runtime's available catalog and routing policy; the sprite does not permanently determine the model. The current routing is deterministic, and these roles currently run through Codex. Jev, Fable, Claude or OpenClaw are not silently performing work merely because they appear in a plan or tool list. Other roles include Robin for research, Sanji for design, Chopper for diagnosis, Brook for creative work and Jinbe for operations.

In **Settings**, choose the default conversation model from the models your signed-in Codex account currently exposes. Luffy can also select a model per assignment from that same live catalog and validates its supported reasoning level before dispatch. The current catalog check showed GPT-6 Astra, Sol and Luna. OpenAI positions Sol for demanding coding/agent work and Luna for focused, efficient work; availability and included usage depend on the connected account. No API key is needed for Sunny's Codex sign-in, and model choice never changes who approves consequential actions.

Each coordinated assignment gets its relevant brief and criteria. A stage needs a finished task with a real result before the next stage is considered complete. This is a bounded sequence, not an unlimited swarm working on the same checkout.

## Read the status correctly

| What you see | Meaning and next action |
| --- | --- |
| Draft | The brief exists. Prepare the branch and send the crew when ready. |
| Running | An attempt is active. Inspect its tasks for actual progress. |
| Needs your attention | A decision or approval is required. Read the specific request. |
| Ready for review | The attempt returned results. Review files, artifacts and checks; it is not accepted yet. |
| Failed / Stopped / Blocked | Preserve the result and reason. Diagnose it before deliberately starting another attempt. |
| Reconciling / unknown connection | Sunny cannot yet establish whether work ended. Inspect status; do not assume it is safe to restart. |
| Complete | The recorded acceptance boundary was satisfied and the captain accepted the mission. |

Crew movement reflects recorded activity. Ambient walking, banter and celebrations are presentation, not proof that a test passed, a PR merged or a task completed. Reduced motion retains direct controls and readable status.

## When something goes wrong

- **A test fails:** inspect its result and fix the underlying problem. Keep the failure visible. Do not disable the test to get a green result.
- **Files changed after review:** reread the diff and rerun stale evidence against the new source.
- **The connection drops:** use the task's status/recovery controls. A reserved checkout may mean work is still uncertain, not abandoned.
- **A check is unresolved:** inspect the check and its child processes. Only confirm that they stopped when you actually verified that fact. That confirmation records a failed check; run a fresh successful check before acceptance.
- **Publishing is uncertain:** inspect GitHub first and reconcile the actual PR number. Do not blindly publish again; the first request may have succeeded.
- **An existing file cannot be saved:** preserve the draft and inspect the exact error. An older packaged run hit a Windows write block for one external file in the OneDrive workspace, but the latest 0.11.0 repeat saved app-created and external-created disposable files in both the workspace and Temp fixtures. That repeat does not prove every existing project file or security state; no security protection should be disabled by guesswork.

## A simple smoke test after an update

1. Open Sunny and confirm Home loads and the connection state is visible.
2. Open a known project room and its mission board. Confirm existing missions are present without starting them.
3. Open Project charts, select a harmless Markdown document and return to the room. For builds with filename filtering, search for that document too.
4. Navigate away and back. Check that the view remains usable and no unexpected task, approval or error appeared.
5. If testing an actual AI request, use a disposable project and a tiny explicit objective. That is a separate live test and uses account quota.

Keep the pre-update backup and previous package. Do not let an older binary overwrite upgraded mission data. A profile restore must preserve newer useful data and have the captain's approval.

## What has and has not been proven

The current implementation has recorded live Codex coding, coordination and creative runs, real GitHub PRs/merges and hosted checks, plus isolated native workflow tests. Those separate records do not automatically prove one continuous live journey through every screen. PR #4 and its hosted checks are verified, but its chart-mission ID is absent from the current profile; no revision-bound captain acceptance is recorded for that mission. The current packaged two-location save check passed, while captain review of the full daily workflow and the broader world remains open.

Project charts and its filtering follow-up are source increments after the previously activated package. Do not assume a feature is installed until the update record says so. See the [current requirement audit](master-goal-audit.md) and [implementation report](SUNNY-HQ-IMPLEMENTATION-REPORT.md) for exact evidence and remaining work.

### Local activation checkpoint - 2026-09-22 UTC

This workstation now runs the verified 0.11.0 package at `.sunny-dev/validated-release-gpt6-room-play/win-unpacked/Sunny HQ.exe` (Electron 44.4.3). The launcher and running processes match that package; its archive hash and isolated startup evidence are recorded in [active-package evidence](evidence/active-package-check-2026-09-23.json). This is not a claim that every daily workflow has been captain-accepted.

The continuous live charts mission reached [PR #4](https://github.com/Vizzaq23/sunny-hq/pull/4) through Sunny's production publisher. Both hosted test/build runs passed, and Sunny's production reader recorded passing checks for the same commit. With explicit captain approval, PR #4 merged into codex/sunny-hq as 7039b46e902f004bb9b19a6d2684c9a85ad47964 on 2026-09-22 UTC. Sunny's merge verifier confirmed the exact reviewed source and target. The merged Git tree equals the installed package's source tree. Mission acceptance remains separate and pending.

### Historical existing-file save limitation - 2026-09-22 UTC

A diagnostic using the installed Sunny executable and its packaged file service found a reproducible difference: it saved both app-created and PowerShell-created fixture files in the temporary folder, and app-created files in this OneDrive workspace. Saving a PowerShell-created fixture file in this OneDrive workspace was blocked by Windows. The file was not read-only and had no explicit ACL deny rule. This narrows the observed scope but does not identify the responsible security component. Norton 360 for Gamers is installed; Defender preferences were unavailable and the checked recent Defender controlled-folder event log contained no matching event. No security setting, exclusion, permission or user project file was changed. All test files were disposable; no environment file was read.

If an existing-file save fails, retain your draft and inspect the exact error and security-product history. Do not treat the startup test or passing CI as proof that every local file can be edited. The complete 2026-09-23 packaged repeat below supersedes this partial diagnostic: all six save/stale-write checks passed across OneDrive and Temp fixtures, but the earlier cause remains unknown and arbitrary existing files are not proven.

Post-merge verification: GitHub run35673916172 passed Windows tests, typecheck and production build for merged commit7039b46. This does not resolve the local OneDrive save limitation described above.

### Voyage overview update — 2026-09-22 UTC

The installed local package now comes from commit 9fb87a9 and includes Voyage overview. Open The Island, enter a project room, then find Voyage overview below Transponder signals. Select a state count or type part of a mission title; choose a result to open that exact mission on the board. Accepted counts mean captain-accepted missions. A finished crew attempt awaiting review is counted separately.

Recorded attempt timing includes valid finished, failed and cancelled attempts, including retries. Coverage shows how many ended attempts had usable timestamps. It measures elapsed attempt time, not model latency, cost, productivity or time until captain acceptance. Missing or invalid timing is labelled Not recorded. These controls read saved mission state and do not start agents or approve anything.

Fresh locked dependency installation, 299 tests and build/typecheck passed. Native overview, document-shelf and 23 daily-workflow checks passed. A 54-file closed-profile backup was hash-verified before activation; older packages and backups remain. The actual installed executable passed an isolated sample startup check (Home, 3 task cards, sample banner, no horizontal overflow); the real daily window was separately verified responding. The package is unsigned and retains version 0.11.0. Archive SHA256: 52af5c30375ca160fe4dd1d573616966cf8f96066dcd473a6569e0ecb3e5d159.

This local increment has not been published or merged remotely. The earlier PR #4 merge remains verified. The OneDrive existing-file save restriction and full daily-workflow/captain acceptance remain unresolved; this update does not claim to fix them.

### Active package and mission-state recheck — 2026-09-23 UTC

The launcher and currently running Sunny processes point to `.sunny-dev/validated-release-gpt6-room-play/win-unpacked/Sunny HQ.exe`, version 0.11.0 / Electron 44.4.3, archive SHA256 `4a7fdf99f80b6dd4ac7aaee7a3afb132058cc4889f2a638457a73f7e48c15460`. This supersedes the earlier 9fb87a9 activation checkpoint above. The current archive contains the Project charts and Voyage overview UI bundles. An isolated packaged sample preview showed Home, three sample task cards, its preview banner and no horizontal overflow; it does not use or change the live profile. See [the exact package check](evidence/active-package-check-2026-09-23.json).

A read-only query of the current profile found 56 finished, three interrupted and one failed saved task, with no persisted working/waiting/starting tasks at the observation time. The PR #4 chart-mission ID cited in its description was not present in this profile, so the exact mission's revision-bound acceptance cannot be submitted here. PR #4 is merged and its hosted checks passed, but that still does not constitute mission acceptance. The packaged save test subsequently completed in its separate temporary profile and passed both locations; [the exact repeat](evidence/packaged-editor-save-repeat-2026-09-23.json) supersedes the previous partial run without explaining the older intermittent failure. The normal app processes and profile remained untouched.
