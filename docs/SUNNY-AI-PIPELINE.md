# How Sunny's AI pipeline works

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

Sunny may suggest up to two reviewed skills for a quick task or mission role when Codex reports them available for that project. Review each suggestion before sending. A changed or disabled skill blocks launch so the brief can be corrected. The chosen skill is saved with the task or attempt; it guides the specialist but grants no new permission and does not prove the instructions were followed. See [skill selection](skill-pipeline.md) for the exact boundary.

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

## Test the pipeline with a project

Start with a disposable copy of your test project on a clean Git branch. Keep `.env`, credentials, customer data and unrelated edits out of the mission. Pick one small, reversible change with acceptance criteria visible in the diff and existing tests. Choose **Captain reviews the result**, prepare the branch, select **Coordinator · Luffy**, and send the crew. Watch the saved attempt, Nami's plan, the specialist's actual changes, Usopp's check, Zoro's review and the resulting mission status. A finished crew reply still needs your review. If the connection becomes uncertain, inspect the existing attempt before starting another.

For the remote portion, use a separate disposable GitHub repository you control. Confirm its origin and target branch before requesting a PR preview. Sunny's own GitHub path requires a signed-in GitHub CLI in addition to the Codex sign-in; a connected GitHub app elsewhere does not sign in that CLI. Publishing, merging and deploying remain separate captain decisions. Hosted checks apply to the commit they actually ran on. Do not use Sunny's production repository as the test target.

If you also want to test X research, open Morgans' X feed and capture a small set of posts from the signed-in Chrome feed. Import the resulting briefing, retain each source URL and date, and hand one item to a disposable project for read-only research. Check that the answer separates the author's claims from facts verified through cited primary sources and states what remains unknown. Do not like, reply, repost, follow or message as part of this test. For a GPT-6 Sol/Luna comparison, give both models the same post and criteria in separate tasks, then compare attribution, evidence, uncertainty and usefulness; record which model actually ran.

For each stage, record the source of truth: mission/attempt ID, task result, file diff, check result tied to the source revision, PR/check observation if used, and your final acceptance. Animation and a green reply cannot replace those records.

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

Settings shows the live Codex model catalogue. The 2026-09-23 read-only check returned GPT-6 Astra as the default, plus GPT-6 Sol and Luna; their availability can change. Sunny validates the chosen model and reasoning level against that catalogue before dispatch. An optional Jev advisor, if explicitly enabled for a registered project, may rank bounded journal context and suggest an eligible role or model. It does not perform the work, override an explicit choice, make a Morgans report, or grant approval. [Jev setup and rollback](jev-integration.md) explain the opt-in boundary; no live Jev quality or cost result is claimed here.

Morgans has a separate, on-demand reporting path. When you press **Generate report** in his blimp, Sunny reads only saved local project, task, mission, approval, check, PR and deployment fields into a bounded evidence packet. The packet has a creation time, selected scope, record IDs/times and a truncation flag; it omits chats, prompts, raw logs and secrets. Sunny starts one read-only Codex reporter task with no tools or delegation. Its wording is a summary for review, while the saved records shown alongside remain the facts. If the provider fails or its state is uncertain, the packet remains visible; Sunny does not automatically start another turn. A passed check can be stale after the source changes, and a missing deployment is unobserved rather than successful.

The report text is an editable draft in Sunny. Nothing enters Obsidian until you press **Save draft to Obsidian Inbox**, which creates a new guarded note in `00 Inbox`; a failed save keeps the draft. Robin works in the other direction: select an existing Obsidian note and project in Library, then **Ask Robin to review** prepares an unsent, revision-scoped prompt. Robin uses that note as untrusted decision context, identifies what it supports and what needs verification, and recommends choices. She does not automatically edit the vault. Neither character can approve a mission, merge code, deploy or treat generated wording as proof of completion.

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
- **An existing file cannot be saved:** preserve the draft and inspect the exact error. An older packaged run hit a Windows write block for one externally created OneDrive fixture file. A later isolated packaged repeat saved app-created and externally created disposable files in OneDrive and Temp, including stale-write protection. That does not prove every existing file or identify the earlier cause; do not disable security protection by guesswork.

## A simple smoke test after an update

1. Open Sunny and confirm Home loads and the connection state is visible.
2. Open a known project room and its mission board. Confirm existing missions are present without starting them.
3. Open Project charts, select a harmless Markdown document and return to the room. For builds with filename filtering, search for that document too.
4. Navigate away and back. Check that the view remains usable and no unexpected task, approval or error appeared.
5. If testing an actual AI request, use a disposable project and a tiny explicit objective. That is a separate live test and uses account quota.

Keep the pre-update backup and previous package. Do not let an older binary overwrite upgraded mission data. A profile restore must preserve newer useful data and have the captain's approval.

## What has and has not been proven

The current implementation has recorded live Codex coding, coordination and creative runs, real GitHub PRs/merges and hosted checks, plus isolated native workflow tests. Those separate records do not automatically prove one continuous live journey through every screen. The chart mission reached a real PR and merge, but its mission ID was absent from the observed daily profile, so its captain acceptance was not recorded there. As of 2026-09-23, Morgans reporting and optional Jev advice are reviewed source changes awaiting merge and daily-app activation. Sunny's GitHub CLI is installed but not signed in at this checkpoint, so a new live Sunny-published PR still requires that sign-in and a chosen test project.

Project charts and its filtering follow-up are source increments after the previously activated package. Do not assume a feature is installed until the update record says so. See the [current requirement audit](master-goal-audit.md) and [implementation report](SUNNY-HQ-IMPLEMENTATION-REPORT.md) for exact evidence and remaining work.

### Review controls (2026-09-30 source update)

Finished mission conversations and coordinated stage results require **Start a new attempt** on the Mission Board before additional work or a crewmate handoff. Ordinary conversation handoffs remain available. This preserves the reviewed attempt's history.

The board discovers the registered project's available npm checks and disables absent scripts with an explanation. A rejected unavailable script adds no failed check evidence; a check that actually executes and fails still blocks acceptance. Existing saved failed checks are retained. If package scripts change after discovery, execution validates availability again.

Unsent Mission Board briefs are saved per project for the current window, including title, objective, criteria, and completion boundary. They survive navigation and reload. Closing the window ends these drafts; save a mission brief to retain it in Sunny's mission records. A failed save preserves the draft, and saving one project's brief does not clear another project's draft.
