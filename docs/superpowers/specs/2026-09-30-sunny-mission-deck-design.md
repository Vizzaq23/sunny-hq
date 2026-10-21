# Sunny mission deck and Franky's workshop

**DRAFT FOR USER REVIEW — September 30, 2026**

This is a proposed architectural design, not an implementation plan or authorization to change the application. The captain selected the living Sunny with a persistent captain's log direction in principle and selected Franky's workshop as the first room. The written spec still requires user review and approval. Only after that approval may a written implementation plan be prepared; architectural implementation requires the subsequent plan review and execution-method choice. “Fix everything” does not skip these gates.

## Problem and intended outcome

Sunny already has recognizable ship artwork, ten crew identities, real Codex work, bounded assignments, mission evidence and human controls. The current experience splits them: Home starts conversation tasks, Voyages starts tracked missions, opening Workbench replaces the navigation shell, and the room becomes a faint cropped background. A finished turn can fall into past work before its result has been accepted. The captain cannot consistently see the goal, assigned crew, actual work, result and next decision together. Reported crashes and not-responding symptoms also lack sufficient current-build attribution to select a reliable fix.

The proposed outcome is one complete journey aboard one ship: describe a goal, confirm its brief and crew assignment, follow visible real work, inspect a concrete result, request a revision if needed, and explicitly accept the current result. The ship remains the spatial anchor; a persistent captain's log retains the work context. Franky's workshop makes the same journey tangible without making motion evidence of progress.

Required sequence after the separately bounded Crew layout repairs:

1. Diagnose failures on the exact loaded build and verify recovery before architectural rollout.
2. Establish goal → crew assignment → visible work → real result → human approval as one coherent journey.
3. Admit Franky's one-room pilot: active building, pauses for Den Den Mushi/input, truthful failure and uncertainty, celebration only for an accepted result.
4. Later, consider upgraded ship/rooms/crew/lighting/motion/UI artwork through a separate concept choice first.

Success means the captain can identify objective, project, responsible crew, current truth, named result and next action at every stage, including after navigation, reload and restart. Scope is **one ship, one complete journey, one room**.

Non-goals are a new workflow engine, provider/tool/agent integration, autonomous ambient work, a general walking game, ten room pilots, more destinations, broad asset generation, art-style conversion, or automatic publication/merge/deployment. Existing destinations and tools remain accessible through direct navigation. The pilot requires no external account or service.

## Evidence and current architecture

The source baseline is `5c8c6cb99943d0be58873c353dacd7937fc504e7`. The reviewed installed archive identifies package **0.11.0**, with package SHA-256 `e70b60892095e41e03ae851d893f7be8a84bde7725e004e68cc63c4083866819`; development metadata is not the installed-build identity. Draft PR #15 at `a96cc962` is separate and unmerged. Its changes must not be described as installed or silently included in this proposal's baseline.

The [experience review](../../../../deliverables/sunny-experience-review-20260930.md) in the enclosing task workspace records exact-package sample screenshots, layout evidence and reliability limits. That relative report path is workspace-local and is not a repository-distributed dependency. Sample previews prove layout, not real provider execution. A restricted-launch GPU failure and historical lifecycle events do not establish the cause of the captain's current failures.

Grounding documents are [AGENTS.md](../../../AGENTS.md), [README](../../../README.md), [foundation design](../../foundation-design.md), [roadmap](../../agent-platform-roadmap.md), [art bible](../../art-bible.md), [world bible](../../world-bible.md) and [art provenance](../../../public/assets/ARTWORK.md). This proposal supersedes the 19%-opacity-under-chat treatment described by the art bible, world bible and ARTWORK.md only for Franky's pilot; implementation admission would update those records together. Existing assets and other room treatments remain the current baseline.

| Existing boundary/behavior | Proposed responsibility |
| --- | --- |
| Electron main/preload own trusted IPC, windows and privileged operations; Hub/core own task truth, approvals, checkout locks and persistence | Preserve ownership. The scene and log submit validated intents and consume sanitized authoritative state. |
| Home launches `task:start`; MissionBoard uses `mission:create`/`mission:start` | One primary goal journey creates a tracked mission; ordinary conversations remain explicitly conversations. No competing mission lifecycle. |
| Missions already have stable IDs, revisions, attempts, task links, artifacts, bounded events and acceptance; review acceptance currently permits no attached artifact and binds no selected result identity | Reuse those services and add an authoritative result-selection/acceptance binding, alongside durable presentation context. Do not replace them with a second mission store. |
| App conditionally replaces its shell with Workbench | A continuous shell owns the selected work context and return target; conversation/files/tools become an inspectable work surface within that context. |
| `roomActivity` prioritizes approval/unknown/waiting and distinguishes ready-to-review from mission complete | Shared projection supplies the deck, log and room, with explicit selected attempt and attention precedence. |
| `useDraft` is session-scoped; MissionBoard brief fields are component-local | Mission brief/message drafts and return context survive unmount/reload/restart through bounded local persistence. Unsaved editor files retain their separate stale-write/discard protections. |
| Current completion entertainment can follow a finished turn | Mission celebration follows a persisted acceptance receipt for the current result revision. Ambient entertainment remains separately labelled. |

## Design choice and alternatives

Recommend a living Sunny command deck with a persistent log and direct controls. It reuses the strongest existing art and makes the ship useful while keeping work legible. A compact mission-studio arrangement is the responsive form of the same design, with the log first and a collapsible scene. A world-first explorer would require more navigation and art while leaving the split journey unresolved; defer it.

The ship is the opening work anchor. Its scene, accessible mission list, goal entry and attention summary share one shell. Clicking Franky opens the workshop instantly; any approach animation may follow without delaying inspection. Choosing work from a list opens the identical mission context. Navigation to Settings or other existing destinations retains the selected mission and supplies “Return to mission” with its title.

## One work identity and complete journey

The authoritative relationship is project → mission → attempt → crew tasks → artifacts/approval references. Provider thread and turn IDs stay on their existing tasks. The selected renderer context contains project ID, optional mission ID, selected attempt/task ID, room or work-pane target, and originating return target. A root conversation outside a mission has task-family context and is labelled “Conversation”; it never receives mission-complete semantics.

The goal form collects project, objective, observable acceptance criteria and completion boundary. Luffy can help refine the brief, but advice alone creates no executing assignment. The captain confirms the saved brief and existing supported role path before starting. The pilot uses the existing coordinated workflow: Luffy coordinates, Nami plans, Franky builds, Usopp validates and Zoro reviews, in that order. Each stage has an actual linked task and result in the active attempt, visible in the log; no new delegation capability is assumed. Franky's workshop visualizes his active building stage, while the log preserves the other stages and responsible crew. A writing result may use review acceptance; engineering controls appear only when the requested boundary and actual artifacts require them.

The captain sees the saved objective and criteria while execution starts. The crew roster identifies active responsibility; the activity stream distinguishes recorded tool/check events from generated claims. A result card names its file/diff/reply or other supported artifact, producing task/attempt, revision and verification evidence. A finished turn supplies “Ready to review” only as far as evidence supports it; missing result evidence is visible and prevents acceptance. “Open result” and “Request changes” are adjacent to the criteria. Requesting changes starts explicit bounded rework with a new attempt after reconciliation; old evidence remains historical and cannot satisfy the newer result's criteria.

Acceptance records the captain's review of current criteria and a selected, authoritative result revision through the mission authority boundary. It never performs a consequential action as a side effect. A merge-bound mission also needs the existing verified merge/check evidence; accepting a writing result needs no PR checklist. Results awaiting review remain in an actionable review queue, separate from accepted history.

### Proposed authoritative result and acceptance contract

This requires a backend contract change, not just presentation metadata. Current `Hub.acceptMission` checks artifacts when present but permits review-bound acceptance with none. Current `MissionBook.accept` records the active attempt, criteria and reviewed mission revision, plus merge proof when applicable; it does not bind a selected result artifact or message. The artifact contract has no reply-artifact kind. The proposal must not imply those guarantees already exist.

A reviewable result needs a stable identity, mission/active-attempt and producer-task membership, result kind and revision/content identity. A file/image result may reference an existing supported deliverable artifact and its recorded hash, then undergo the existing fresh-read validation. A reply result must reference a specific retained assistant message in a specific task belonging to that attempt, with a durable message identity and content revision/hash; “latest reply” and a transient array position are insufficient. If current messages lack a stable identity, the additive contract must supply one without rewriting transcript content or attributing a historical reply to new work. No new public reply-artifact kind is assumed by this draft; the approved plan must choose the concrete representation of the stable reply reference.

The mission holds its selected current result reference. An acceptance receipt has its own stable identity and binds captain actor, mission, active attempt, reviewed mission revision, selected result identity/content revision, criteria decisions and acceptance time, plus existing merge proof when required. Hub resolves and validates the submitted reference against authoritative stored data and fresh deliverable evidence before atomically persisting acceptance and completion. The renderer supplies the intended selection, never proof. Missing, changed, superseded, wrong-project/wrong-attempt or unavailable results cannot be accepted. A new attempt or result revision invalidates the previous selection for current acceptance while retaining historical evidence. Mere criterion checkboxes cannot substitute for selecting a real result. Concrete versioned schema, command arguments and migration shape are deferred to the written plan after this spec is approved.

### State and authority

Mission phase, task execution, connection health, approval request and local save health are distinct dimensions. Preserve existing mission statuses and task protocol; user-facing labels are projections, not new backend facts.

| Authoritative condition | Log/room meaning | Allowed next interaction |
| --- | --- | --- |
| Saved draft, no running attempt | Brief ready | Edit brief or explicitly start |
| Starting | Starting; no duplicate submission | Inspect or Stop |
| Confirmed active task, no blocker | Working, or evidenced planning/review/validation | Inspect activity; draft follow-up; Stop |
| Real pending approval/input | Needs your approval / Needs your input | Open exact request; respond through existing control |
| Dependency wait, no request | Waiting, with known reason | Inspect; Stop where supported |
| Unknown/reconciling connection | Status uncertain; last known phase retained | Check/reconcile; no automatic restart or lock release |
| Failed or stopped attempt | Failure/Stopped, with retained result and reason | Inspect, reconcile, then explicitly request new attempt |
| Current result ready, mission unaccepted | Ready to review | Open result; request changes; review criteria |
| Persisted current-result acceptance and mission COMPLETE | Accepted | Open accepted evidence; optional new mission |

Approval or uncertainty overrides purposeful work animation. If multiple tasks exist, the selected mission's active attempt is the room's context; urgent requests from other tasks appear in the global attention list without silently switching the result being reviewed. Unknown state keeps checkout reservations. Stale, duplicate and wrong-attempt events cannot update the current attempt or authorize acceptance.

Hub is authoritative. Existing normalized events/snapshots feed one presentation projection consumed by the ship, log and workshop. The renderer does not infer phases from chat wording, query providers independently, release locks, manufacture artifacts or complete a mission. Animation consumes projection and emits only presentation interactions. Frame completion, reaching a bench, ambient dialogue, signature actions and audio grant no authority. Notifications refer to persisted requests/events; a Den Den Mushi picture cannot itself approve anything.

## Persistent captain's log and direct controls

At a normal wide window, the recognizable ship/room occupies the scene area beside an opaque parchment work log. Conversation text is never placed over busy artwork. The log contains, in reading order: mission title/project and phase; objective/criteria summary; crew assignment with active-attempt identity; recent actual activity; named result/evidence; the next captain decision. Advanced Git/check/history material expands when relevant. A searchable list exposes attention, active work, ready-to-review and accepted history.

Stop, open approval/input, check uncertain status, open result and return to the selected mission remain direct controls independent of walking, animation or camera position. Files, Git, terminal and preview retain existing controls and permissions. In compact or short windows the log leads, the scene collapses, and navigation remains reachable. Opening an artifact and returning restores the same mission, attempt, draft and review position; changing selected work deliberately changes context rather than guessing by crew name or recency.

Persist brief drafts by project plus unique draft identity, and message drafts by task identity. Multiple unsent briefs must not collide. Preserve the source draft until a durable successful operation is confirmed; a changed draft must not be cleared by an older submission response. A failed persistence acknowledgement shows a persistent unsaved indicator and offers retry/export of the draft. Never resend started provider work to repair draft storage. Draft text is local user content, not runtime policy or a verified memory.

On restart, reopen valid selected context as inspection only. Deleted/unavailable project, task or attempt references resolve to a labelled unavailable entry and safe mission/list return; never fall back silently to another project's work. No task, terminal, check or approval resumes automatically. Unsaved editor buffers remain separately governed; this spec does not promise file edits survive a restart.

## Franky's workshop pilot

Use `franky-shipwright-room.png` at its recorded 1536 × 1024, 3:2 composition, with the existing Franky idle/walk/work atlas cells. The room's workbench, blueprints, brass tools and industrial blue accents supply its identity. Provenance remains [ARTWORK.md](../../../public/assets/ARTWORK.md), including source `exec-8e2e25ad-e504-4d60-95c3-6feb18962c19.png` and SHA-256 `E29915E79F9A279AF61EF490E51527190A87BBE7AF941F962D6702419D051A8C`. No new image or commercial reference is needed.

The scene contains one Franky actor, one bench anchor, a clear arrival/rest position and a short unobstructed approach lane. Use coordinates normalized to the full uncropped illustration and a consistent foot anchor/ground shadow. The project-quarters 32/57/79% station coordinates belong to a different image and must not be copied into this room. Geometry admission requires a contact overlay on this exact illustration showing actor bounds, rest/bench feet, approach lane and furniture occlusion before any motion is admitted. This design intentionally does not claim unmeasured pixel coordinates are correct.

The room and log are adjacent surfaces; preserve the entire illustration with letterboxing rather than cropping out the bench to fit a transcript. The sprite must not clip its hair/hands/feet or float on furniture at supported sizes. Actual controls and labels are HTML; the image is decorative. If the scene cannot fit legibly, it collapses while work controls remain usable.

| Pilot state | Franky's behavior and cue |
| --- | --- |
| Idle / saved brief | Rest pose; no purposeful building |
| Starting | Static starting label; no claim of building before active work |
| Active building | Short approach to the calibrated bench, then existing work frames while the task is authoritatively active |
| Input or approval | Work stops; static Den Den Mushi “Needs your input/approval” cue with direct request control |
| Dependency waiting | Work stops; reason and waiting label; no invented request |
| Failed / unknown / stopped | Still pose and explicit distinct label; error/status inspection remains available |
| Ready to review | Still/result pose and named result; “Ready to review”, no victory cue |
| Accepted | One short local celebration after persisted current-result acceptance; accepted label and artifact remain |

Celebration is deduplicated by acceptance identity/result revision across both hub and companion. Restoring state, replaying an event, reopening a room or receiving a finished provider turn never replays it. Existing saved COMPLETE missions do not retroactively celebrate. A seen receipt is presentation metadata and cannot create or revoke acceptance. If its durable receipt cannot be safely recorded, skip the motion and retain the accepted label. Franky has no signature row in the five-character action atlas: reuse his existing frames with a restrained local pose cue, without borrowing another character's action or generating an atlas.

Reduced motion (system or Sunny setting) removes travel, frame stepping, bobbing and celebration motion. Place Franky directly at a truthful stationary anchor and keep all labels, notification controls and result/acceptance feedback. Pause crew pauses entertainment and visual movement only; it never cancels backend work. “Stop work” is the distinct execution control. Sound remains opt-in and can be muted immediately, using the existing local arrival cues; no soundtrack or progress sound is introduced.

## Persistence, compatibility and safety decision

Keep the existing Hub/core local persistence boundary: aggregate SQLite storage with JSON fallback, the current MissionBook version-1 baseline, existing recovery reservations and export behavior. The proposed result references and acceptance receipts are additive authoritative data and require an explicit version/compatibility decision in the approved plan; this draft does not assert version 1 can safely store them unchanged. Navigation context, bounded drafts and celebration-seen receipts are separately versioned presentation metadata. Do not introduce relational migration, an event broker or full event sourcing for this slice. The current renderer session drafts may be adopted into the new local draft storage only with explicit identity matching; they never become missions or execution attempts.

Existing saved conversation tasks remain conversations. No bulk conversion, inferred criteria, auto-acceptance or historical replay is allowed. Mission/attempt/artifact identities and existing event limits are retained. Previously accepted missions retain a labelled legacy acceptance record; no selected result is invented and no new celebration is emitted. Existing unaccepted missions require an explicit valid result selection before acceptance under the new contract. Only an explicitly confirmed new primary goal uses the tracked mission journey. Existing imported/external histories stay read-only and outside this conversion.

Before implementation, the written plan must document the concrete additive schema and bounded retention policy, backup/export contents, version negotiation and compatibility tests. The architectural choice is fail-closed and non-destructive: preserve unsupported/newer data, do not overwrite it with defaults, and open a recovery/read-only surface when authority-bearing data cannot be loaded. Metadata additions must round-trip through the supported candidate; an older package must not be allowed to silently discard them. Draft quota/size exhaustion preserves current text in memory with an unsaved/export path and no dispatch side effect.

All migration validation uses copies and isolated fixture profiles. Backups are verified before candidate profile adoption; no old backup is restored over the current profile. A persistence failure retains dirty state visibly with bounded retries; it cannot release reservations or acknowledge acceptance as saved. Pre-dispatch durability and cancellation remain mandatory. Runtime input validation, trusted sender/main-frame checks, path/symlink safeguards, context isolation, sandboxing and credential separation remain unchanged requirements.

## Reliability and rollout boundary

The first reliability evidence must identify executable/package hash, source relationship, app version, profile fixture identity, session and surface for a current reproduction. Bounded redacted diagnostics distinguish renderer-gone reason/exit code, load failure, safe exception class and provider/parser/persistence failures, with task/attempt correlation and durations where relevant. Exclude transcript/terminal/file contents, secrets and private paths. Existing local diagnostics suffice; no new telemetry provider is proposed.

Crash recovery must preserve backend ownership and work reservations. Reloading a renderer resubscribes to authoritative state; it does not resubmit commands. Main-process restart marks unresolved work uncertain and demands reconciliation. Exact evidence determines the fix. A screenshot or native-preview `Runtime.evaluate` timeout alone cannot be diagnosed as a window hang; the newly observed preview timeout remains undiagnosed. Disabling GPU/security protections is not an assumed remedy.

A reproducible crash or hang blocks experience rollout and installed cutover until its cause and recovery are addressed with passing evidence. Failure to reproduce the captain's reported symptom is an explicit limitation, never proof of a fix. Written design/plan review may continue despite that uncertainty. After the required recovery and representative-load checks pass, an isolated candidate may be built and evaluated with the captain's unreproduced report clearly recorded; it cannot be described as having fixed that report or used for installed cutover on that evidence alone. The captain must review the remaining limitation and explicitly authorize any later cutover. Candidate testing must stop promotion if it reveals a reproducible crash/hang.

Create a separately identifiable candidate package only after the design/plan gates and implementation validation. Validate with an isolated profile first. The launcher continues to identify the installed 0.11.0 package until an explicitly authorized installation/cutover. Package evidence must name the exact source commit, included changes, executable/archive hash, profile/schema compatibility and limitations; PR #15 is handled explicitly rather than treated as already merged.

Rollback preserves candidate/profile backups and returns to a validated executable with a compatible profile copy. If the older reader cannot preserve new metadata, use its pre-upgrade profile copy separately; never point it at current data or overwrite current data with that copy. Active/uncertain work must be reconciled before cutover or rollback. Closing a window may only hide it to the tray, so executable switching must account for actual process ownership. A green test/build is not installation, merge or release authorization.

## Accessibility and performance

The scene is optional to every action. Keyboard and screen-reader users can start, select crew/work, inspect activity/artifacts, respond to requests, Stop and accept through named controls. Focus returns to the originating control when a pane closes. State uses text/icons as well as color; streamed logs do not announce each token. Contrast, visible focus, target separation, 200% text, minimum supported window and short-window behavior are acceptance evidence, not claims inherited from the review's 1424 × 961 sample.

Measure responsiveness using isolated representative streaming transcripts, task/mission counts, large saved state and wide/slow folders. Proposed local acceptance budget is p95 direct-control acknowledgement below 200 ms and no measured main event-loop stall over 100 ms under the recorded fixture load. Report machine/load and duration so those figures have meaning. Stop must remain reachable during save, import and stream activity; stopping an external process is measured separately from UI acknowledgement. Bound stream rendering, scene loops and persistence/IPC work; hidden scenes and reduced motion run no unnecessary animation loops. No dependency or renderer rewrite is justified merely by this budget.

## Phased acceptance evidence

These are review/acceptance boundaries, not an implementation task list. Each boundary must pass before the next experience increment is admitted.

| Boundary | Required evidence and criterion |
| --- | --- |
| Written design | User explicitly approves this written draft after any requested revision. No architectural code or implementation plan before that approval. |
| Exact-build reliability | A current attributable reproduction or clearly recorded inability to reproduce; measured fixture load; targeted fix only for demonstrated causes; renderer reload/main restart preserve ownership; no duplicate dispatch; uncertain lock and cancellation behavior verified; persistent unsaved-state failure/retry visible. A reproducible crash/hang blocks rollout. An unreproduced report permits isolated candidate evaluation only after those recovery/load checks pass, with no fixed claim or implied cutover approval. |
| Complete mission journey | One actual authorized fixture goal proceeds through saved brief, Luffy coordination and linked Nami plan → Franky work → Usopp validation → Zoro review stages, visible real work, selected current result, criteria review, explicit revision/new attempt if requested and persisted result-bound captain acceptance. Navigation/reload/restart retain identity/drafts/return target without execution. Ordinary conversations stay labelled and historical data is preserved. |
| Truth and safety | Pending, denied, expired/stale approval; wrong-attempt/out-of-order/duplicate events; failure, stop and unknown connection cannot produce acceptance or celebration. Missing or changed selected result, stale reply reference and absent deliverable cannot satisfy acceptance. Reply and file results each prove stable identity/revision binding. Review-ready result stays actionable. Consequential actions use their existing separate human gates. |
| Franky room admission | Exact-art geometry overlay and rendered normal/minimum/200%-text captures prove foot anchors, unclipped sprite, unobstructed approach and legible adjacent log. Working/approval/input/waiting/failure/unknown/ready/accepted states match authoritative evidence; hub/companion/restart replay produces no duplicate celebration. Reduced motion and paused visuals preserve all direct controls. |
| Candidate and cutover | Relevant tests, production build/typecheck and isolated native desktop workflow pass; authoritative result/acceptance schema plus presentation metadata, export/recovery/old-reader compatibility and rollback are demonstrated; exact candidate source/hash/profile are recorded. Any unreproduced crash report and undiagnosed preview timeout are disclosed; a reproducible crash/hang blocks promotion. Installed build is reported separately and changes only through explicit cutover authorization after limitation review. |
| Later visual expansion | Captain reviews and chooses a concept for any art/style/lighting/motion/UI upgrade before new generation or broad visual implementation. One-room proof does not approve other rooms or world rebuild. |

The current unresolved technical evidence is the captain's exact crash cause and the measured Franky-room anchors; neither is a missing product-direction choice. Franky's room and the living ship/log direction are selected. Concrete schema detail and geometry measurements belong to the later approved plan/validation, while the preservation and authority requirements above are fixed for this proposal. No implementation plan, product edits, external requests or installation are authorized by this draft.
