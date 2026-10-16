# Sunny world bible

The captain leads a living digital crew from Sunny HQ. Projects are destinations, meaningful objectives are missions, and durable evidence belongs in the logbook. The One Piece-inspired premise is permanent; real work and clear controls determine what happens underneath it.

## Places that exist

The full application has Home, Island, Sunny ship, Projects, Crew, Missions, Library, Tools, Inbox, Settings and Morgans' blimp. Home is currently the opening screen. The Grand Line chart has six clickable destinations, zoom and drag exploration, and optional control of a selected crew member. Project doors open useful project quarters. The companion is the floating Sunny ship. Movement is a presentation control, not a general collision-based game world.

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
| Morgans' blimp | Imported sourced outside briefing and captain-requested reports from saved Sunny work |

## Canon and implementation

Sunny identity, warm adventure, crew camaraderie and the captain's authority are product canon. Model IDs, SQLite layout, Electron components, providers and graph coordinates are implementation details. A coding turn finishing is not a launched voyage completing. The backend owns mission truth and approvals; the scene reads projections. Preserve error/unknown states even when they interrupt the story.

A world change requires matching [art guidance](art-bible.md), a navigation/scale check and screenshots of relevant normal, working, blocked and reduced-motion states. The implemented room and character-control increments are described below; seamless full-world travel remains future scope in the [roadmap](agent-platform-roadmap.md).

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

The chart can expand across the content area for a larger map. A visible District desk control moves keyboard focus to the selected district's work surface, and Return to chart moves focus back to the map. Compact chart restores the side-by-side layout. This is a view choice only; the same direct district, project, job, and approval controls remain available, and the map does not imply any work has started or finished.

Character workbenches now carry ten distinct static room illustrations. Robin's room includes a direct Obsidian library route, and note review prepares a draft for Robin without editing the vault. Room arrival cues are original synthesized audio, opt-in, adjustable, immediately muteable, and unrelated to task status. Reduced-motion settings preserve readable status and direct controls.

## Morgans reports and Robin decisions (2026-09-23)

Morgans is a reporter on his blimp, separate from the ten core Straw Hats. On captain request, Sunny builds a bounded packet from saved tasks, missions, approvals, checks, pull requests and deployment observations across selected registered projects. The default covers all projects and seven days; older unresolved work remains visible. The blimp shows exact source IDs and times beside Morgans' generated wording. A finished provider turn is still review-needed work, absent deployment evidence remains unobserved, and truncated coverage is labelled. The reporter turn has read-only, no-tool authority. The captain can edit its summary and explicitly save one new note to Obsidian `00 Inbox`; viewing, generating and editing do not write the vault.

Robin remains the librarian. The captain selects an existing Obsidian note and project, then Robin receives its path, revision and JSON-quoted content in an unsent draft to inform a decision. Robin should identify supported facts, uncertainties, choices and a recommendation. Neither a vault note nor Morgans' prose grants approval, proves acceptance or changes mission state.

## Project document shelf (2026-09-22)

Project quarters contain collapsible Project charts below the health log. The captain explicitly browses root/docs Markdown files and selects a read-only source preview. File content is never treated as mission evidence or an instruction to act. This adds useful project information without changing the immediate stop/approval controls.

## Fifteen direct scene destinations — 2026-10-05

Island and project quarters expose a keyboard-focusable roster of ten core crew,
four residents and Morgans. Crew buttons open the existing conversation path;
Morgans opens the news blimp's read-only briefings. Inspect controls open the exact
selected crew task without waiting for travel. Reporter access remains excluded
from task-capable crew. Resident districts remain saved choices.

The read-only scene projection now follows the selected supervised run's current
assignment, retains historical selections, suppresses ambiguous assignments and
checks worker ancestry against an explicit mission attempt. Run stop, recovery,
waiting, block and ready states cannot borrow a working task's animation. A
review stage or exact selected review-capability assignment uses a still pose,
including ordinary run children without a workflow stage. A creative-reviewer
using creative/design capability remains authored work; review phase alone never
relabels an author as a reviewer. Scene pause changes presentation only; task and
run authority continue updating. Decorative room illustrations remain static;
only existing measured Franky/quarters/deck geometry is reused. No new world,
game, provider, persistence schema, dependency or artwork is introduced.
Existing-task resident conversations intentionally omit room art because only
the ten core crew have admitted room illustrations; resident identity and work
controls remain available without an invalid `assets/undefined` image request.

Native state/reduced-motion captures, keyboard journeys, 200% text and exact
package proof are pending while host crash/hang diagnosis is open. Source checks
do not admit installed rollout or waive the Stage A performance gate.

The captain leads a living digital crew from Sunny HQ. Projects are destinations, meaningful objectives are missions, and durable evidence belongs in the logbook. The One Piece-inspired premise is permanent; real work and clear controls determine what happens underneath it.


## Franky's honest one-room pilot — 2026-10-01

The selected persisted work context can open Franky's shipwright workshop while keeping the captain log opaque and directly accessible. The shared mission projection follows the exact selected mission/attempt/task and structured stage owner. A newer unrelated assignment cannot replace it; approval and unknown state stop purposeful work. Nami planning, Usopp validation and Zoro review remain their own stages with Franky still. Missing/conflicting selections stay unavailable. A finished provider turn remains ready for captain review; only a modern captain receipt bound to the selected result represents accepted work.

The one room reuses the existing uncropped3:2 illustration and existing Franky atlas; root-reviewed measured floor anchors/route and in-memory padded silhouette extraction are recorded in the art bible and ARTWORK.md. Franky holds a wrench beside the bench without a fabricated tabletop strike. Inspect work, input/approval and Stop work remain direct controls. Pause visuals calls no interrupt. System/Sunny reduced motion removes travel, frame loops and the acceptance glow. The room and companion compete through one backend durable first-claim command for a brief live-acceptance cue; mount/reload/history never manufactures a reward. The captain log displays the receipt without consuming its cue.

Automatic crew victory on a finished provider turn has been removed. Captain-requested/timed deck scenes remain explicitly labelled ambient entertainment and cannot alter mission state. This isolated source pilot remains subject to native visual/truth review and the independent performance promotion gates; it does not replace the installed app or claim packaged rollout.
