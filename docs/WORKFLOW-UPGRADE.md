# Sunny HQ 0.10 — a clearer daily workspace

Home now opens first. Describe the goal, choose a project, and start with Luffy or choose a specialist. Home starts the actual task in one step. Quick prompts help with building, fixing, research, and planning; they remain editable before submission.

The task list groups Luffy and his assignments together. Search includes assignment titles, crew names, and project names. Filter by project and progress. A specialist waiting for input raises the whole task into attention, and its action opens that specialist directly. Interrupted and uncertain tasks remain accessible. Nothing is silently retried.

Conversations open with a focused chat layout. Files, Git, terminal, and preview open with **Files & tools**. The editor and terminal JavaScript load only when used. The editor still has its existing large dependency bundle; it no longer delays an ordinary conversation. Scrolling follows new messages only when the reader is near the bottom and never scrolls the entire workspace to a message.

Message drafts are retained separately for projects and tasks in this window's session storage. They survive navigation and UI reloads and end with the window session; they are not permanent backups. Switching routing modes keeps the same brief. Failed starts retain the brief and show an inline error. Pending operations cannot launch twice, change project, or discard newly typed file edits. Late Home launch responses do not take over navigation.

File browsing has an **Up one folder** control that stops at the registered project root. Errors stay visible and unsaved file changes survive starting a task. Changing the project or leaving edited files requires the existing discard confirmation. Startup shows loading and a retry screen if the snapshot fails, and an older initial snapshot cannot replace a newer full update.

## Verification

- Node suite: 124 passing tests, including family grouping, status classification, and filtering regressions.
- TypeScript check and production build.
- `desktop/workflow-smoke.cjs`: production UI with controlled IPC fixtures, no model calls or real user data. Covers launch/approval deduplication, error recovery, drafts across navigation/reload, separate captain/specialist drafts, late launch responses, lazy tool loading, absolute-path file navigation, Monaco input, dirty-file preservation, template clearing, island navigation, and compact layout. Screenshots and logs are under `.sunny-dev/workflow-check`.
- Independent code review found and prompted fixes for asynchronous draft and editor-loss paths.
- Final native suite passed all nine groups: files/Git/terminal/editor/navigation, companion, journals, walking crew, captain assignments, island controls, news drafts, renderer recovery, and connected startup. This used the production UI in Electron with an isolated profile. The packaged fresh-file check independently passed file/Git/terminal/editor/navigation and companion/journal/walking checks before its old drafting assertion was updated.
- Final release archive matches 14 tested runtime, UI, and smoke-test files byte for byte. Version, archive hash, and the 21 workflow checks are recorded in `2026-09-12-workflow-package.json`.

Run the workflow check with `ELECTRON_RUN_AS_NODE` unset and `node_modules/electron/dist/electron.exe desktop/workflow-smoke.cjs` after building. The existing `--smoke-test` packaged suite uses an isolated `SUNNY_DATA_DIR`; its file fixture is now unique to each run.

## Activation and limitations

Use **Quit** from Sunny's tray menu, then **Launch Sunny.cmd**. The upgrade uses the existing Sunny data location and sign-in. The older executable and the currently running session are preserved. No user tasks were reconciled, interrupted, or reassigned as part of this upgrade.

Windows still blocked the packaged test from overwriting an older fixture file created by another process, returning EPERM. The file was not read-only. This is the previously documented local permission issue; its underlying Windows/security-software cause remains unconfirmed. No protection settings were changed. The editor keeps its readable save error and preserves the unsaved buffer. A fresh-fixture test is separate evidence and does not establish that all existing project files can be saved.

Delegation continues through the existing verified Luffy tool, specialist permissions, and checkout writer locks. This release simplifies access and visibility; it does not add unlimited parallel writing or bypass approvals.
