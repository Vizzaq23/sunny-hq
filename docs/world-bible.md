# Sunny world bible

## Studio dashboard — 2026-11-06

Home places the captain's brief beside the existing authoritative watch on wide
screens and stacks both on compact screens. The three-step course is guidance,
not a progress tracker. Crew directory search finds the ten Straw Hats by name
or specialty; optional residents remain in their existing disclosure. Static
portraits identify people; world sprites still visualize recorded work. The
short page entrance and button feedback stop under either reduced-motion
preference. No provider, approval, acceptance or persistence behavior changes.
See [studio evidence and limits](sunny-studio-design.md).

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

## Immersive interface refresh — 2026-10-16

The captain approved a whole-interface refresh with larger existing world art and stronger nautical navigation. `src/voyage-ui.css` supplies the shared parchment, deep-teal and brass presentation across Home, projects, crew, missions, inbox, library, tools, settings, Morgans and the workbench. Destination headers reuse the existing ship, project quarters and specialist room illustrations. The ship's existing 3:2 deck and actor anchors are unchanged; it opens by default above 640 px and retains its disclosure control.

Captain's log is now a native expandable dock below the main workspace, with an attention count derived from the existing work-entry projection, including missions awaiting review. This replaces the prior narrow/short-window layout that placed the full log above every destination. The main workspace has a skip link. The compact navigation closes with Escape, returns focus, cycles focus while open, and removes hidden links from keyboard access. Sidebar identity and Settings stay anchored while destinations scroll.

Browser preview checks covered all eleven navigation destinations at 1280x720 and 390x844, plus the empty workbench, menu focus and logbook keyboard activation. These checks use the explicitly labelled browser preview and do not establish connected-provider behavior. Desktop working/blocked/reduced-motion screenshots and the native fixture workflow are pending: the captain requested no desktop interaction while gaming. See [UI evidence](evidence/ui-revamp-2026-10-16.json). Installation remains subject to the separate integration gates.

## Command deck and room separation — 2026-10-16

Supersedes the earlier beige presentation pass. The main Sunny screen keeps the existing animated ship beside a selected-crew inspector, with Station, Activity and Run controls panels. Horizontal navigation frames the world and a compact crew dock sits beneath it. The newest saved work update remains visible under the ship and opens the bounded activity feed. An indexed crew roster uses the same `crewSceneProjection` as the ship, including run-stop, uncertainty, selected-attempt and persistence gates. Filters reveal working and attention states without hiding direct mission and run controls. Ambient crew life is explicitly distinguished from work. The feed is bounded to twelve records and respects selected project/run; it never creates work.

The helm shell uses deep sea teal, sail cream and brass, with restrained green for actual working state. A room has its own illustration panel beside the workbench conversation; chat no longer uses the art as a background. Franky's animated workshop keeps the 3:2 canvas and actor geometry, with status and controls alongside at wide widths and below on narrow screens. No new renderer framework, shader dependency, provider or persistence contract was introduced. Existing reduced motion and pause controls remain authoritative for visuals.

Evidence: `docs/evidence/ui-revamp-2026-10-16.json`. The hidden native workflow passed, including a streamed-snapshot consistency check and ten room-art visibility checks. Exact-package performance/journey acceptance and installed-app rollout remain separate gates. The browser's synthetic fixtures are visual checks, not evidence of a real provider run.

## Interactive motion refinement — 2026-10-17
React 19, TypeScript and Vite remain the renderer foundation. Motion 14.3.0 supplies interruptible shared selection markers and crew layout transitions, with a pinned dependency/lockfile. Panel entrances use short opacity/position transitions; buttons have restrained hover/press feedback. The saved activity feed keeps a static timeline hierarchy. No task state, authority or progress is synthesized.

The sea uses two low-opacity CSS layers with a direct Pause/Resume sea motion control; it is decorative and does not move the ship artwork or its actor geometry. Both the Sunny setting and live OS reduced-motion changes suppress movement. The native regression exposed a non-reactive library preference hook; a matchMedia change listener now updates immediately. No WebGL shader, network service or new art asset is needed. Existing workbench lifecycle and input state are retained outside the selected inspector content.

Reference: Motion's official React accessibility and layout documentation (`https://motion.dev/docs/react-accessibility`). Verification evidence: `.sunny-dev/ui-revamp/motion-build-3.log`, `motion-focused-tests.log`, and `workflow-motion-3/result.json`. The failed earlier native preference check is retained at `workflow-motion-2/result.json` rather than erased. Browser keyboard activation, sea pause and 390px horizontal-overflow checks passed. Source verification of this motion refinement does not resolve the previously recorded package latency/journey failures.

## Distinct crew workstations — 2026-10-17

The crew rooms now share only their navigation and evidence rules. Luffy has an objective sheet and crew roster; Zoro a review ledger; Nami a continuous criteria route; Usopp a test bench; Sanji a service ticket; Chopper a diagnostic observation; Robin a reading desk; Franky a build console; Brook a composition sheet; and Jinbe an operations watch. These are read-only projections of the selected conversation, project, mission attempt and run. Historical tasks cannot borrow a newer attempt's artifacts or review decision. Criteria are requirements, not a completion meter. Saved replies are not captain acceptance.

The latest saved task update opens the room's activity panel. Draft starting points append to the unsent composer without launching work. Room/conversation and conversation-focus layouts preserve the mounted editor, transcript and draft. Tool shortcuts use the existing dirty-buffer guard and execution identity. The illustration can expand independently of chat. Tablet rooms place art and station content side by side; narrow layouts stack them with readable controls.

Original CSS ambience gives each room a different quiet texture (light, chart rings, steam, dust, leaves, resonance or water). It has an explicit pause control and stops for either reduced-motion preference, page hiding or conversation-focus mode. Motion supplies only a short panel entrance. No new provider, persistence schema, renderer framework, asset, shader dependency or progress simulation was introduced.

The captain and watch stations include a crew relay when their selected task belongs to a recorded run. Nodes show recorded assignment objectives and explicit predecessor IDs; visual adjacency never invents dependencies. A pulse means the existing run projection currently confirms work, not a progress percentage. Pending approvals, uncertain effects, pause/stop and storage recovery suppress that pulse. Inspect actions use the workbench's existing dirty-editor guard.

## Captain's shipboard panel pass — 2026-11-06

The current Luffy-first home, captain's watch, crew roster, ten rooms and captain log gain shared ink framing, blue/cream surfaces and locally bundled display/UI type. The Den Den Mushi approval label uses a phone icon, readable evidence and larger approve/decline controls; response semantics do not change. Existing task/mission/attempt projections remain authoritative. No new route percentage, celebration, simulated work, world actor or backend action is introduced. The installed open-water package is separate and unchanged. See [isolated source-build evidence and limitations](shipboard-design-2026-11-06.md).


## Crew coordination map — 2026-11-07

The [crew map decision](crew-map-2026-11-07.md) records Luffy’s separate captain area, equal core specialists, native profile evidence, ship log and Captain’s Orders navigation. Explicit Luffy child tasks and saved council contributions drive brief delegation/reply pulses. Persistent lines indicate hierarchy only. Returned replies are not acceptance; council last-updated times are labelled rather than invented as per-event timestamps.
