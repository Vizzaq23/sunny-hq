# Sunny world bible

The captain leads a living digital crew from Sunny HQ. Projects are destinations, meaningful objectives are missions, and durable evidence belongs in the logbook. The One Piece-inspired premise is permanent; real work and clear controls determine what happens underneath it.

## Places that exist

The full application has Home, Island, Sunny ship, Projects, Crew, Missions, Library, Tools, Inbox, Settings and Morgans' blimp. Home is currently the opening screen. The island has Sunny harbor, Observatory, The forge, Creative house, Market square and Growth garden. It is a zoomable map with moving crew and clickable districts. The companion is the floating Sunny ship. These are not yet enterable project interiors or a player-controlled avatar game.

The ship's existing route graph includes galley, library/chart area, workshop/testing, medical station, music and helm, linked by deck paths and stairs. Preserve those physical connections. Island movement presently travels between district homes and the plaza; it is not a general collision/pathfinding simulation.

## Crew and work

Luffy coordinates; Nami plans/prioritizes; Franky builds; Zoro reviews; Usopp validates; Chopper diagnoses; Robin researches and maintains knowledge; Sanji handles interface craft; Brook handles creative work; Jinbe prepares infrastructure/release work. Law, Ace, Vivi and Perona are optional residents with configurable roles. These character roles are presentation defaults, not immutable vendor bindings or permission grants.

A station should show the current mission, task, state, recent verified artifact and next needed action. One visible crew member may have several historical tasks; select the actual active attempt for the animation. Never make idle chatter look like billable autonomous work. Journals represent saved attributed context, not trained personalities or actual emotion.

## Expansion rules

Future project rooms attach to stable project IDs, not folder names or vendor names. A door opens a useful project surface first; decorative room elaboration follows. Room contents can eventually expose missions, docs, PRs, tests, deployments, errors, references and history, but unconnected services must say unavailable. Keep the current island districts as hubs rather than replacing them with unrelated maps.

Navigation must retain a direct searchable list and keyboard path to every mission and approval. Walking can enrich arrival but cannot delay stop, failure inspection or urgent approval. The user must be able to tell who is working, what finished, what failed, what is blocked and what needs attention without deciphering lore.

| Metaphor | Actual meaning |
| --- | --- |
| Mission/bounty | Objective with explicit acceptance criteria |
| Crew station | Role entry and current task inspection |
| Logbook | Sourced durable decisions and outcomes |
| Project island/room | Registered project and its real work |
| Den-den-mushi signal | Notification tied to a persisted event |
| Captain's approval | Authorization for a specific consequential action |
| Treasure/progression | Clearly labelled achievements; never invented earnings |
| Morgans' blimp | Imported sourced briefing; not an unattended connected feed |

## Canon and implementation

Sunny identity, warm adventure, crew camaraderie and the captain's authority are product canon. Model IDs, SQLite layout, Electron components, providers and graph coordinates are implementation details. A coding turn finishing is not a launched voyage completing. The backend owns mission truth and approvals; the scene reads projections. Preserve error/unknown states even when they interrupt the story.

A world change requires matching [art guidance](art-bible.md), a navigation/scale check and screenshots of relevant normal, working, blocked and reduced-motion states. Project-room and playable-navigation work is future scope in the [roadmap](agent-platform-roadmap.md), not claimed by this foundation.

## Implemented project-room increment (2026-09-21)

The island now has a direct project-door list. Doors open project-specific quarters with a bounded keyboard/button-controlled captain marker, mission board, three task-status stations, logbook and direct stop/approval inspection controls. This supersedes the foundation-era statement above that no project interiors/player navigation exist. Current room geometry keeps the walkable floor below the furniture; movement is a simple bounded floor, not a general pathfinding engine. Rich crew sprite motion, physical island-to-door travel and full project health remain future work. The prototype room uses original CSS shapes in the existing palette; it does not claim a finished art pass.

## Crew station and signal increment (2026-09-21)

Project quarters now include all ten core crew stations with existing artwork, task/mission context, attention-first assignment selection and direct inspection. Scene shortcuts share that projection. Specialized work phases require recorded workflow/role evidence; character identity alone never implies planning or review. Completed turns show ready for review until the current mission is accepted. The transponder log contains the eight latest persisted project mission events. These controls are static and reduced-motion compatible; crew travel/working-frame animation remains future work.

## Station motion increment (2026-09-21)

Nami, Franky and Zoro now occupy three matching room station lanes using existing original Sunny walk/work atlases. They approach their stations only when the project task is working; work frames begin on arrival. Approval, waiting, unknown and failed state freeze travel and work frames. Labels continue to show authoritative state. Finished/idle crew return to rest. App/system reduced motion suppresses frame loops and places crew directly. A separate captain aisle reaches the mission board. This supersedes the previous static-room limitation for these three short paths; full world navigation and an illustrated interior remain outstanding.

## Project health log (2026-09-21)

Quarters expose current-attempt saved checks and PR observations with source/time and next action. Missing deployment or check evidence stays unavailable. Later saved source changes can invalidate a recorded pass; no continuous monitoring is implied. Health links focus the correct mission board entry while preserving an unfinished brief. Failed checks and uncertain publication/connection outcomes are visible before generic review guidance.

Project-room transponder receipts (2026-09-21): saved mission signals expose New/Seen, an explicit acknowledgment, unseen filtering, and exact mission-board navigation. Marking seen records awareness only: it does not approve a crew request, resolve a blocker or accept a mission. Live attention controls remain independently visible. Receipts share the bounded retained event window and survive restart; they do not imply delivery of an OS or external notification.

Written mission outputs (2026-09-21): the mission board can attach project-local .md/.txt deliverables and preview their recorded content as plain text. File identity is verified, while creative quality and art/world compliance remain captain review criteria. Changing a recorded file requires reattachment and review before mission acceptance. This local written-output path does not imply image, audio or video generation is connected.

Deployment observations (2026-09-21): mission review and project health now show explicitly inspected GitHub deployment records for a commit, with environment, observed status and time. Empty records and earlier source stay visible. This supersedes the earlier blanket unavailable placeholder; uninspected projects still have no deployment evidence. A successful historical record is not a live health check, deployed uncommitted work or captain authorization to deploy. See [deployment inspection](deployment-inspection.md) for boundaries and verification limits.


## Illustrated quarters admission (2026-09-21)

The project-room CSS prototype now uses the original generated timber/teal room background recorded in ARTWORK.md. This supersedes the illustrated-interior limitation above. A full3:2 canvas preserves perspective without responsive cropping. Three existing crew sprites approach lanes aligned with the desks; the captain stays in a central clear-floor rectangle and reaches a board approach. Direct board/task/stop controls remain usable without walking. State remains entirely sourced from Hub projections. This is one useful illustrated interior, not seamless island-to-door travel or general furniture pathfinding.

## Grand Line and character-room update (2026-09-23)

The Grand Line chart is active in the current worktree: six distinct One Piece-inspired destinations retain the saved district identifiers and each opens its existing work surface. The captain may optionally control a Straw Hat or recruited resident using keyboard or touch movement, with zoom and drag exploration. This changes presentation only; missions, jobs, approvals, and completion evidence still come from saved work state. Destination labels and action buttons remain accessible DOM controls outside the artwork. Room art, sprite behavior, sound cues, and source provenance are recorded in `public/assets/ARTWORK.md`.

Character workbenches now carry ten distinct static room illustrations. Robin's room includes a direct Obsidian library route, and note review prepares a draft for Robin without editing the vault. Room arrival cues are original synthesized audio, opt-in, adjustable, immediately muteable, and unrelated to task status. Reduced-motion settings preserve readable status and direct controls.

## Project document shelf (2026-09-22)

Project quarters contain collapsible Project charts below the health log. The captain explicitly browses root/docs Markdown files and selects a read-only source preview. File content is never treated as mission evidence or an instruction to act. This adds useful project information without changing the immediate stop/approval controls.
