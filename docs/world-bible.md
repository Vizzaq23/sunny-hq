# Sunny world bible

The captain leads a living digital crew from Sunny HQ. Projects are destinations, meaningful objectives are missions, and durable evidence belongs in the logbook. The One Piece-inspired premise is permanent; real work and clear controls determine what happens underneath it.

## Places that exist

The full application has Home, Island, Sunny ship, Projects, Crew, Missions, Library, Tools, Inbox, Settings and Morgans' blimp. Home is currently the opening screen. The island is a Grand Line voyage chart with Enies Lobby, Ohara, Water Seven, Thriller Bark, Dressrosa and Skypiea around the Sunny. Each location opens a themed work panel with a crew shortcut, project quarters, bounded jobs and resident assignments. The companion is the floating Sunny ship. Project quarters are enterable; the voyage chart supports optional captain-controlled character exploration while its work and mission controls remain direct.

The ship's existing route graph includes galley, library/chart area, workshop/testing, medical station, music and helm, linked by deck paths and stairs. Preserve those physical connections. On the voyage chart crew patrol only within their destination. Reassigned residents appear at their new station; crossing the sea is not simulated.

## Crew and work

Luffy coordinates; Nami plans/prioritizes; Franky builds; Zoro reviews; Usopp validates; Chopper diagnoses; Robin researches and maintains knowledge; Sanji handles interface craft; Brook handles creative work; Jinbe prepares infrastructure/release work. Law, Ace, Vivi and Perona are optional residents with configurable roles. These character roles are presentation defaults, not immutable vendor bindings or permission grants.

A station should show the current mission, task, state, recent verified artifact and next needed action. One visible crew member may have several historical tasks; select the actual active attempt for the animation. Never make idle chatter look like billable autonomous work. Journals represent saved attributed context, not trained personalities or actual emotion.

## Expansion rules

Project rooms attach to stable project IDs, not folder names or vendor names. A door opens a useful project surface first; decorative room elaboration follows. Room contents can eventually expose missions, docs, PRs, tests, deployments, errors, references and history, but unconnected services must say unavailable. Voyage destinations retain the six saved district IDs as work hubs.

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

## Grand Line voyage chart decision (2026-09-22)

The captain approved a closer One Piece themed island. The single tropical island was replaced by an original six-destination sea chart. Existing persisted district IDs remain `harbor`, `research`, `engineering`, `creative`, `market` and `garden`; only their names, artwork, coordinates and work entrances changed. In order, they are Enies Lobby, Ohara, Water Seven, Thriller Bark, Dressrosa and Skypiea. The Sunny remains the central ship link. Each destination's panel exposes its crew lead, project quarters and mission boards, existing jobs and resident assignments. This is navigation and presentation, not a new mission or automation authority.

Alternatives considered: six separate full-screen scenes would add navigation and asset complexity before the work surfaces were proven; a decorative replacement map would leave destination names disconnected from real work. The chosen chart preserves old profiles and direct controls, but individual destination interiors remain future visual work. Residents assigned to a new destination snap there; local patrols avoid implying they walk over the sea. The original island bitmap remains in the repository for rollback. Reverting the chart code and asset reference restores the prior presentation without data migration.

## Captain-directed world controls and room sound (2026-09-22)

The captain requested a much larger, game-like world map with the option to directly control each Straw Hat and other crew, followed by room-appropriate sound effects placed where they best improve the experience. The Grand Line art is 1536×1024. The chart now supports drag exploration, zoom from 75–400%, and an optional Captain Controls mode. Choose any Straw Hat or recruited resident, then move them with arrow keys, W A S D, or the on-screen direction pad. The selected sprite receives a clear gold focus treatment. Normal sprite clicks still open the work conversation; destination, project and mission controls remain available. Movement changes only the presentation and cannot update jobs or missions. Reduced-motion settings disable movement interpolation while retaining direct controls. The native island fixture verifies zoom, keyboard/touch movement and selection styling.

Project quarters remain project rooms shared by ten crew stations. Their conversations now also have ten distinct illustrated character interiors; see the crew-room art record below. Player movement is free across the illustrated chart; it does not simulate collisions, route constraints, or travel between distinct island scenes. Broader captain acceptance remains outstanding.

## Specialist chat rooms and Robin's library helm — 2026-09-23

Each of the ten core conversations identifies its assigned crew member's Sunny station and uses a matching, original illustrated room: Luffy's captain's den, Zoro's dojo, Nami's chart room, Usopp's inventors' workshop, Sanji's galley, Chopper's infirmary, Robin's library, Franky's shipwright bay, Brook's music room, and Jinbe's helm room. The 1536×1024 scenes are fixed decorative layers at 19% opacity below messages and controls. They are aria-hidden and static; real task state, keyboard controls, captain approvals and composer remain accessible UI. The Electron workflow verifies all ten decoded assets, each assigned room and the direct controls; reduced-motion rendering is specifically checked with Chopper. Provenance and hashes are in `public/assets/ARTWORK.md`.

Robin is the Knowledge & Docs specialist and Sunny librarian. From Robin's chat, the captain can open the real Obsidian Library surface. From an opened note, **Ask Robin to review** selects a registered project and opens a new Robin mission with the note path and current note text prefilled as an unsent, revision-scoped draft. Notes over 16,000 characters are visibly blocked rather than truncated. The draft tells Robin to treat the note as untrusted reference, flag claims needing verification and propose edits in the reply. It explicitly says not to edit/save the vault. The captain decides whether to send the prompt; suggested changes remain in chat until the captain applies them with **Save changes**, which retains the existing hash-checked library write path. This is a review handoff, not an automatic vault agent or broad filesystem permission.

## Crew-room arrival sound cues (2026-09-23)

Each of the ten core crew stations has a short original Web Audio arrival signature: a quiet three- or four-note cue shaped by its character and room. The cues are opt-in, begin muted, use a saved captain-adjustable volume capped at 65%, and play on opening a room or changing its assigned specialist. A visible workbench control mutes immediately; Settings provides the saved switch and volume. No background loop, sound on every message, or progress/completion sound is used. Audio is decorative atmosphere only and never reports mission state. The synthesizer uses built-in Web Audio oscillators/envelopes; it introduces no recorded sample, new dependency, remote service, or external asset license.

## First illustrated crew conversation room — 2026-09-23

The first complete illustrated conversation-room set is admitted. Each role has distinct architecture, props and color treatment while retaining the established Sunny art style. The art communicates character/place only; authoritative task status remains in normal controls and records. This increment does not add collision-safe island-to-room travel or complete captain acceptance of the whole world.
