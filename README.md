# Sunny HQ

A personal Windows AI studio aboard the Thousand Sunny. Click a Straw Hat station to start a real Codex mission, then work with its conversation, files, Git changes, terminal and local preview.

Read the [start-to-finish AI pipeline guide](docs/SUNNY-AI-PIPELINE.md) for mission setup, crew roles, checks, approvals, recovery and a simple post-update test.

## Open it

Double-click **Launch Sunny.cmd** in this folder. The upgraded app is in `release-workflow-0.10.0/win-unpacked/Sunny HQ.exe` (0.10.0); the launcher falls back to the older `release` build if the upgrade is missing. If Sunny is already running, finish any active work and choose **Quit** from its tray menu before launching the update. Closing its window only hides it to the tray. The previous build is preserved.

Sunny uses the installed Codex CLI and your existing sign-in. Settings shows connection status and the models returned by that account. Usage remains subject to your normal account limits. Closing the window leaves Sunny in the system tray; use the tray's Quit action to exit.

Version 0.10 opens on **Home**: describe a goal, choose a project, and start with Luffy or a specialist. Search and filter tasks, see linked assignments, and open anything needing attention. Conversations keep drafts across navigation and expose the editor/terminal through **Files & tools**. See [the workflow upgrade notes](docs/WORKFLOW-UPGRADE.md) for the changes, verification, and the remaining Windows save-permission limitation.

## Included

- Ten Straw Hat specialist roles with distinct conversation personalities, clickable deck characters, in-scene chat, real task status, saved conversations, approval prompts and explicit handoffs.
- Codex app-server integration, streaming assistant output, tool activity records, interrupt and uncertain-connection recovery.
- Local project discovery/import, file tree, Monaco editor with stale-save protection, file search service, Git diff and selected-file commits. Selecting a file for commit includes its whole working contents; unrelated staged files remain outside that commit.
- Real PowerShell terminals and isolated localhost preview windows.
- Searchable tool directory: installed tools, configured MCP entries, skills, connected Codex apps and web shortcuts are labelled separately. Connected-app actions happen inside crew conversations; listed tools do not imply every provider is connected.
- Docker container controls and GitHub PR listing when their local CLIs/services are available.
- Applied AI Studio Obsidian search, Markdown editing and inbox capture.
- Job, learning, TCG and creative mission templates; existing automation metadata.
- Read-only existing Codex history. Import ChatGPT's `conversations.json` from Settings; imported history stays read-only and local. The importer keeps the selected conversation branch and text messages, not binary attachments.
- SQLite persistence with JSON fallback, recovery preservation, settings, backup export and Windows Win+H dictation.

## Current boundaries

This first release runs Codex missions. Other providers, continuous autonomous crew routing, voice conversation, mobile access, embedding-based semantic memory, free rearrangement of deck stations are not implemented. The crew walks along fixed deck paths and uses animated idle/work sprites; Chopper reuses the original animated pet atlas. Other crew sprites are game assets, not separately installed Codex pets. Existing Codex tasks remain managed in the original app. History is a bounded recent list from Codex plus imported ChatGPT conversations.

Use one active writer per checkout in Sunny. It cannot lock edits made by a separate editor, terminal, or external Codex task. Review changes before committing. The editor also refuses to overwrite files that changed after being opened.

Data lives in `%LOCALAPPDATA%\Sunny HQ`; it includes local task transcripts and imported history. Settings' backup exports Sunny tasks/projects/settings; imported history is stored separately as `chatgpt-history.json`. Credentials remain with the installed Codex tooling. This is a local unsigned personal build with no deployment or publishing step.

## Development

Use Node 24. This machine has a broken global npm shim; invoke the bundled npm CLI directly:

```powershell
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' install
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --noEmit
& 'C:\Program Files\nodejs\node.exe' node_modules/vite/bin/vite.js build
& 'C:\Program Files\nodejs\node.exe' --test tests/*.test.cjs
& 'C:\Program Files\nodejs\node.exe' node_modules/electron-builder/cli.js --win nsis --x64
```

`desktop/smoke.cjs` exercises the real packaged desktop with `--smoke-test` and a separate `SUNNY_DATA_DIR`. It checks fixture file saves/path guards, PowerShell output, navigation and editor load, and writes screenshots under `.sunny-dev`.

Reference scan: [Munder Difflin notes](docs/REFERENCE-REVIEW.md). Generated artwork provenance: [ARTWORK.md](public/assets/ARTWORK.md).


Observed on this PC: the packaged app can create and update its own files, but Windows returns EPERM when it updates some files created by other programs. Norton 360 for Gamers is installed; its history should be checked for a Sunny HQ block before changing settings. The underlying cause has not been confirmed from a Norton event. No security protection or exclusions were changed. Crew conversations, discovery, file reading, terminals and the fresh-fixture packaged checks work. Existing-file saves need this local permission issue resolved.
## Desktop ship and crew life

Minimize the hub, close it to the tray, or click **Ship on desktop** to leave the Thousand Sunny and its crew floating above your desktop. The full workspace remains loaded; active tasks continue. Drag the ship's top handle to move it, use minus/plus to resize, and use the expand button or tray menu to restore Sunny HQ. The ship's X hides it to the tray; choose Quit in the tray to exit the app. Clicking a crew member still opens their conversation.

**Crew actions** plays Luffy's four-frame Gear 5 transformation, Zoro's bandana/sword/purple-haki sequence, Nami's wink and hair flip, Robin's blooming hands, and Sanji's fiery kick. **Sanji × Zoro** brings the pair together for a timed comic exchange. Every 30 seconds, crew life selects a short local scene; completed tasks can trigger a celebration. Pause crew stops ambient scenes and animation. Reduced Motion in Settings (or Windows) disables motion while retaining dialogue. Crew banter is scripted entertainment, not autonomous AI conversation or evidence of task progress; it uses no model calls. Task replies still come from real Codex with character-specific instructions.

Implementation follows Electron's [custom window interactions](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions): frameless transparent companion, draggable handle, and mouse forwarding outside interactive areas. The full hub and companion share the backend; external previews receive no app bridge. `desktop/companion-smoke.cjs` verifies transparency, all five action sets, alternating Sanji/Zoro speakers, pause, resizing and restore on Windows.
## Crew growth and relationships (0.3.0)

Open **Crew → Journal**, or click a deck character and choose **Memories & relationships**. Completed Sunny conversations now add an attributed episode to that crewmate's persistent journal. Later messages retrieve up to ten relevant notes/episodes within a 6,500-character recall budget. Pinned preferences rank first; recent relevant episodes follow. User wording and crew replies remain distinguished; replies are not promoted to verified facts. Existing pre-upgrade history is not bulk-imported into memory.

Pin a preference, edit it, or forget a memory. A global journal toggle stops automatic learning and recall. Forgotten episode IDs remain deduplicated so a replayed completion event cannot recreate them. Original task transcripts, provider conversation context and backups remain; forgetting is not a provider-side deletion. At most 50 pinned notes and 150 recent episodes are retained per crewmate. Journal data is stored in Sunny's existing local state and included in manual backup export. Relevant memory is supplied to Codex when you continue a real conversation; disabling recall prevents future context injection.

The **Crew relationships** tab lets you choose a second crewmate and a topic. **Let them talk** runs exactly two sequential Codex replies: the second sees the first speaker's actual reply, and each receives their own relevant journal context. Both remember a completed exchange. No continuous model chatter is enabled; each discussion is user-triggered, consumes Codex usage, supports Stop, and allows only one discussion at a time. Pending discussions reopen as interrupted after a restart. At most 100 discussion transcripts are retained. The separate temporary conversation sessions use read-only sandboxing, disable configured MCP servers/plugins/apps and command/web features, and stop on a detected tool attempt. They do not share task-writing access.

Experience is a transparent progression counter: 10 points per completed captain conversation, 6 per completed crew exchange for each participant. It reflects shared history, not model training, actual emotion, or proven ability. Their base character traits remain stable while remembered preferences and experiences inform future replies. Relationship stages reflect completed discussion counts. Scripted ambient banter adds no memory or experience.

Verification includes persistence/replay deduplication, corrections, forget behavior, disabled recall, bounded recall, prompt injection into the intended crewmate's next turn, discussion cancellation and tool-attempt guards. A live neutral Zoro–Sanji fictional exchange passed; preference transmission was not used in that live probe. Protocol references: [Codex App Server](https://learn.chatgpt.com/docs/app-server), [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).

## Walking crew (0.4.0)

All ten crewmates now use compact full-body pet-style idle, walking and working animations. Chopper keeps the original installed sprite sheet. Idle crew roam between deck locations and perform labelled deck routines. A crewmate assigned a real running task walks back to their specialist station and works there; waiting or uncertain tasks stop their work animation. Group scenes gather on deck. Selecting or hovering a crewmate holds them still for interaction.

Routes follow connected walkways around the central deck and use the stairs for the lower library and workshop. These are fixed waypoint paths, not a general collision simulation. Pause and reduced motion stop movement and frame animation. The same crew renderer runs in the full hub and floating ship. Six route tests and native desktop checks cover movement, station return, frame selection, waiting and pause.

## Talk to Luffy and delegate (0.5.0)

Click **Talk to Luffy** or his sprite, choose a project, and describe the outcome you want. Luffy can recommend who to talk to or use a real delegation tool to assign a bounded mission to the appropriate specialist. Recommendation-only questions should receive advice without launching work. For example: “Have Franky implement the settings screen, then ask Usopp to verify it.” Luffy waits for each actual result before proceeding or reporting back.

Assignments appear in Luffy’s conversation and the ship dialogue. Open any assignment to talk directly with that crewmate, then use **Back to Luffy**. Pending specialist approvals also appear in Luffy’s full workspace. **Stop crew** interrupts active child work and Luffy; failed stops remain visible. Existing idle Luffy conversations switch to a fresh coordinator session on their next message, retaining the visible log and recent context.

Luffy coordinates in read-only mode with external integrations disabled in his own session; specialists use the usual project tools and approval flow. Assignments stay in the selected project and run sequentially under the existing checkout writer lock. Six assignments per user message bound automatic work. Delegation uses normal Codex account usage. It does not grant extra authority for destructive operations, external communications or publication. On disconnect/restart, uncertain missions require reconciliation; assignments are not silently retried.

Verified with a live fictional Luffy → Robin → Luffy exchange, 74 automated tests, and native interface checks for mission links, return navigation, child approvals and stop controls. Protocol: [Codex App Server dynamic tools](https://learn.chatgpt.com/docs/app-server); exact tool schema checked against this PC’s installed CLI-generated bindings.

## Adaptive model and reasoning selection (0.6.0)

Luffy now selects a model and supported reasoning level for each assignment, with a short explanation. The available model catalog comes from the signed-in Codex account; unsupported combinations are rejected before starting work. Each assignment and its workspace show the chosen model, effort, rationale and provider-reported session token total when available. You can ask Luffy for a specific model or reasoning level in your message.

Settings → **Crew execution preference** offers **Token saver** (default), **Balanced**, and **Deep work**. Token saver favors lighter capable models and lower reasoning for clear, bounded work; Luffy can choose stronger reasoning for difficult or risky tasks. These are decision guidelines, not a hard token cap or a guarantee of optimal cost. The catalog does not supply model prices or Codex quota multipliers. Session token totals include provider-reported input/output usage, including cached input where counted by the provider; they are not dollar charges or remaining subscription usage. Missing usage stays undisplayed. Duplicate cumulative notifications are not added twice.

The default conversation model still controls direct missions and Luffy’s initial coordinator session. Delegated missions can choose a different model. Their effort is sent on actual Codex turns and retained for follow-ups. Existing captain sessions upgrade their tool schema on the next message while retaining the visible conversation log and recent context. Normal later messages no longer repeat the recent conversation excerpt, avoiding unnecessary context duplication.

Verification: 84 tests and a live fictional routing probe. Luffy chose GPT-5.6 Luna at low effort for a simple Robin naming task and returned her actual answer. Supported model/effort metadata and turn fields were checked against the installed CLI bindings and [official App Server documentation](https://learn.chatgpt.com/docs/app-server).

## Island expansion (0.7.0)

The full app opens onto a zoomable island with six work districts; the floating desktop companion remains the Thousand Sunny. The ten core crewmates walk around the island. Recruit Law, Ace, Vivi and Perona, edit their specialist roles and districts, and talk to them directly or delegate through Luffy. Their journals use the same persistent memory system as the ship crew. Residents are defined in `desktop/island-residents.json`; further expansion needs catalog entries and matching artwork.

Create a job against a registered project, choose its specialist, objective, interval, daily and lifetime run limits, maximum duration and reported daily token threshold. New jobs start paused. Enable a job and the global automation switch to schedule it; **Run once** starts an explicit manual pass. Review is required after successful runs by default. The local scheduler permits one island job at a time, supports up to 100 job definitions and retains the existing checkout writer lock. The app must remain open and the PC awake. Restart disarms automation, and uncertain work requires reconciliation. Missed intervals do not trigger catch-up bursts.

Time and token limits are checked every 15 seconds. Provider reporting and interruption delays can cause overshoot; these are soft thresholds, not a dollar spending cap. Daily limits use UTC. Stop and Pause all interrupt island work, including linked delegated tasks. Existing unrelated conversations remain separate.

Product discovery, digital draft and client deliverable templates prepare bounded local work. They do not create an operating business or guarantee income. Job instructions require drafts/local deliverables and prohibit autonomous outreach, publishing, deployment, purchases and money movement; tool approvals still apply. Revenue is a manual USD receipt log, not connected account data or a profit calculation. See [the expansion roadmap](docs/ISLAND-ROADMAP.md) for the path beyond this local foundation.

## Reliability and parallel jobs (0.8.0)

The island automation panel now offers one to three parallel jobs (default one). Jobs in overlapping project folders still run one at a time, including Luffy-coordinated jobs. The existing three-specialist global limit also applies. Due jobs wait for available capacity; missed intervals do not create catch-up bursts. Lowering concurrency lets existing jobs finish and limits new starts. Changing this setting does not enable automation.

Use **Show jobs from every district** to see the whole island queue. Cards show their project, district, schedule state and next eligible run time. Editing or pausing a job retains any pending review; uncertain work must be reconciled before editing. A completed result is processed before time/token stop checks, so a delayed scheduler check cannot relabel successful work as stopped.

The interface now includes an error recovery screen with **Reload Sunny**, plus a visible loading page if the UI bundle cannot start. A crashed renderer offers a reload dialog. Startup diagnostics store timestamps and predefined lifecycle event names, plus an allowlisted renderer exit reason and integer exit code, in `%LOCALAPPDATA%\Sunny HQ\diagnostics`; they do not record prompts or replies. Reloading the interface does not reset saved data or interrupt backend tasks. See [renderer recovery](docs/renderer-recovery.md) for crash testing, limits and rollback. These controls improve recovery; the previously reported intermittent launch failure was not reproduced during the audit. The current build opened and connected successfully with normal user data.


## Morgans’ blimp (0.9.0)

Click the floating blimp above the island, or **Morgans’ blimp** in the sidebar. Browse Projects, Careers and Learning dispatches, search, save, mark read or dismiss stories. Dismissed items can be permanently removed. Every story retains its source, import/capture timestamp and publication date when supplied. Source claims are explicitly unverified. Select a project and choose **Discuss with Luffy** to open a draft; this does not start a mission.

For a fresh personal briefing, use **Copy Chrome briefing request**, paste it into Codex, then **Import Chrome capture** to select its JSON output. X and LinkedIn buttons open the installed Chrome browser. These are imported, bounded snapshots, not continuously connected feeds. Set target roles, location and topics before requesting career-focused captures. No background collection, automatic applications or outreach is enabled.

Imports accept 1–50 items (512 KB maximum JSON file); the archive holds 500. Required story fields: `title`, HTTPS `url`, `summary`, `why`, `nextStep`, `category` (`projects`, `careers`, `learning`). Optional fields: `source`, registered `projectId`, actual `publishedAt`. Wrap stories in `{ "origin": "Chrome — partial capture", "items": [...] }`. Imports validate the whole batch before changing saved data and merge duplicate URLs while preserving saved/read status. News is included in local backups.
