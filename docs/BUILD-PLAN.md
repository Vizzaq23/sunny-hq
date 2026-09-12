# Sunny HQ implementation record

Approved: Windows Electron/React studio, actual Thousand Sunny 2D ship, ten persistent Straw Hat specialists, Codex-first, editable files, terminals, previews, Git, tools, Obsidian, personal workflows, user-selected handoffs, existing subscriptions and dictation.

## Boundaries
Frontend owns src except shared.ts; backend owns desktop; artwork owns public/assets. Parent owns packaging, shared contract, integration and verification. There is no previous code or baseline suite.

## Tasks
- [x] Codex stdio adapter, local projects/files/notes/Git/tool services, isolated IPC, persistence.
- [x] Illustrated ship and crew, polished usable workspace and personal studio navigation.
- [x] Generate ship and Straw Hat character art, reuse Chopper where appropriate.
- [x] Integrate and exercise real Windows runtime, test safety and recovery boundaries.
- [x] Package installer and document verified capabilities and limitations.

Final packaged verification: 38 unit tests passed; Windows desktop checks passed for fresh-file saves, path guards, selected-file Git commits, PowerShell terminal, Monaco, all eight views, ten deck characters, Chopper dialogue and animation. Codex connected with 11 projects, 111 tool entries and six models. Windows still blocks some externally created file saves with EPERM; README documents this unresolved local permission/security issue. No protection settings were changed.

## Decisions
Work in the current empty repository on codex/sunny-hq: an unborn repository has no existing base commit or other work to isolate.
No automatic dispatch or external publication. Existing app sessions must never be resumed automatically. Explicit user start launches new Sunny work; history retrieval is read-only.
Backend operations validate project paths. Credentials stay with Codex/OS. Remote preview has no app bridge. No fake live tasks, metrics or connected badges.
If SQLite isn't supported by the Electron embedded Node version, use atomic local JSON persistence and document it rather than ship an incompatible native database binding.

User visual refinement: show full-body pixel characters aboard an open Thousand Sunny deck, matching the existing Chopper pet. Preserve Chopper's actual atlas and animation states. Keep the ship visible during character conversations; each specialist should speak with a distinct personality while reporting real task evidence.


## Desktop companion extension (0.2.0)
Implemented a separate transparent always-on-top Windows ship, minimize/restore and tray controls, bounded resize, main-workspace preservation, five four-frame signature action sets, timed local crew exchanges, pause and reduced motion. Real task personality instructions now include the requested character traits. No automatic AI-to-AI delegation added. Native verification covers alpha transparency, visible companion with minimized hub, every action set, alternating rivalry dialogue, pause, resize, and restoration. Unit suite: 40 passing tests.

## Persistent growth extension (0.3.0)
Implemented per-crew attributed conversation episodes, editable pinned preferences, bounded relevance-based recall on later task turns, replay-safe experience, relationship records, and local persistence/backup inclusion. Added two-reply user-triggered Codex crew discussions with cancellation, isolated read-only sessions and disabled integrations; completed discussions teach both participants. Scripted ambient scenes do not award experience. Journals open from crew cards or deck dialogue, with correction/forget/disable controls.

Verification: 52 unit tests pass; native journal controls, memory corrections, forgetting, recall toggle and relationship UI pass. A neutral fictional Zoro/Sanji live discussion passed, with each speaker generated independently and the second responding to the first. Automatic approval review rejected a preference-bearing live probe; it was replaced with the neutral topic, while preference recall was verified locally without transmitting those notes. No personal preference data was sent by the replacement live probe.

## Walking and pet sprites (0.4.0)
Implemented shared crew motion for the hub and companion, weighted shortest paths over explicit deck/stair waypoints, staggered idle routes, real-task station return, discussion gathering, selection/hover hold, waiting stops, pause and reduced motion. Added four-frame walk and two-frame idle/work atlases for the crew while preserving original Chopper frames. Six route tests extend the suite to 58 passing tests. Native and packaged verification results are recorded after execution.

Final verification: 58 tests passed, TypeScript and production build passed, and both native and packaged Windows checks passed for all ten sprites, movement, station return, working frames, waiting stops, pause, transparent companion, all five signature actions, journal controls, editor, terminal and Git fixtures. Version 0.4.0 packaged successfully.

## Captain delegation (0.5.0)
The user enabled Luffy as the central coordinator. This supersedes the original no-dispatch decision for explicitly requested Sunny work. Implemented a typed dynamic delegation tool, linked specialist missions, sequential checkout locking, bounded assignments, real result return, stop propagation, duplicate-call protection and uncertain-run recovery. Luffy remains read-only while specialists perform project work. Ship and workbench surfaces expose mission links and child approvals. Existing Luffy logs migrate on the next user message; no task is auto-resumed at startup.

Validation: 74 automated tests, TypeScript, production build, native interface checks and a live neutral fictional Luffy/Robin delegation exchange. The provider actually generated Robin’s response and returned it to Luffy. No saved memories were supplied to that live probe.

Final 0.5.0 packaged Windows verification passed: linked missions, direct specialist navigation, return to Luffy, child approvals, Stop crew control, and all existing desktop, companion, journal and walking checks.

## Adaptive execution (0.6.0)
Added per-assignment model, reasoning and rationale; validated combinations against the live account catalog; added Token saver/Balanced/Deep work preferences. Applied the selected model at thread start and selected effort at turn start, preserving both on follow-up. Captain schema migration keeps visible history while upgrading dynamic tools. Provider cumulative token totals persist and display without estimating price or quota savings. Removed repeated recent-history injection from ordinary captain follow-ups.

Verified 84 automated tests, TypeScript, and a live Luffy → Robin → Luffy exchange selecting GPT-5.6 Luna with low reasoning. Test context was fictional and used no saved memories.

Final packaged 0.6.0 checks passed: model and reasoning labels, rationale, reported token totals, execution preference updates, linked crew missions and all existing ship/workspace checks.

## Island expansion (0.7.0)

Implemented the full-app island while retaining the desktop ship, six districts, zoom/pan, shared core sprites and four recruitable resident sprites. Residents use editable roles, persistent journals and Luffy delegation. Added persisted local jobs with explicit schedule enablement, restart disarming, review gates, run limits, soft reported-token/time thresholds and stop propagation. Added draft-oriented business templates and a clearly manual receipt log. Distributed workers and connected business channels remain in the expansion roadmap.

Verification: 96 automated tests, TypeScript and production build passed. Native Electron checks passed for island movement, sprite sizing, zoom, recruitment, role edits, paused jobs, global pause and manual receipt handling, plus all previous workspace/ship checks. A live isolated Law job completed with a real reply and entered review while automation remained paused. Visual QA caught and corrected shared sprite CSS and stale resident positions after roster changes.

Final Windows 0.7.0 installer built successfully. Packaged verification passed with Codex connected, all island checks and the final restored roster rendering correctly. Test jobs and receipts remained in isolated fixture storage.

## Workflow reliability (0.8.0)

User reported that Sunny did not open or showed a blank window. The current packaged 0.7 executable opened and connected with real user data during the audit; its taskbar shortcut pointed to the correct executable. Existing crashpad pipe errors did not establish a renderer failure cause. Added a static boot screen, React error boundary, Electron-driven reload, renderer-crash reload dialog and bounded lifecycle-only startup logs. No saved history was reset. Desktop and Start menu shortcuts point to the canonical workspace build.

Fixed pending reviews being cleared by job edits/pause and successful tasks being relabeled stopped after delayed threshold checks. Added configurable one-to-three island jobs, independent-project reservations including captain jobs, scheduler reentrancy protection, capacity waiting, all-district job visibility and next-run labels. Default concurrency remains one and automation remains paused. Regression tests reproduced the previous failures before fixes. Existing reconciliation changes from other work were retained.

Verification completed: 112 automated tests, TypeScript, production build, native and packaged desktop suites. Forced rendering failure displayed the recovery screen and Electron reload restored the island. Windows 0.8.0 installer built successfully. Two old unknown missions were read from the provider and confirmed interrupted before updating the idle app. No live missions were restarted or new schedules enabled.

## Morgans’ flying press (0.9.0)

Implemented a floating blimp entry with reduced-motion support, sourced briefing panel, searchable categories and saved/dismissed archive, atomic bounded JSON capture import, source links, preferences and draft-only Luffy handoff. Personal feed collection remains an explicit Chrome/Codex capture and import flow. No background feed integration or autonomous news agent is claimed. First real sample is kept in local user data, not shipped as a fixture. Verification covers persistence, deduplication, malformed imports, untrusted-source framing and project validation.

Final verification: 120/120 Node tests; TypeScript and Vite build passed. Native and packaged Electron checks passed, including transparent blimp rendering, reduced motion, unread counts, category filtering, saved state and Luffy draft handoff without launching a mission. Packaged smoke exited 0, and its isolated SQLite retained the four real partial Chrome stories after fixtures were removed. Windows NSIS packaging exited 0.

Activation is deferred: the normal app reported two working missions at final verification. Its executable and user database were not replaced or edited. `Open Morgans Update.cmd` launches the verified `release-morgans/win-unpacked/Sunny HQ.exe` and imports the prepared four-item briefing after the existing app is quit. Installer: `release-morgans/Sunny HQ Setup 0.9.0.exe`. Personal source capture remains local in `.sunny-dev/morgans-first-capture.json`, excluded from the distributable. The prior long-history workbench layout concern in the separate reconciliation report is outside this feature's verification; these checks do not establish that it is resolved.
