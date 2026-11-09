# Sunny and island focal-point implementation plan

Date: 2026-11-09. Status: implementation authorized and first combined implementation complete; clean final qualification and local installation pending.
Inspected source: `48a2fe4` on `codex/finish-crew-voyage-20261108`.

## Intended experience

Open Sunny to a close, elevated three-quarter view of the ship beside the selected project's island. The crew, deck and destination dominate the opening screen. A compact voyage bar identifies the actual project, mission, state and next action. Wanted posters, conversations and logbooks open from the world, with direct navigation available throughout.

This is a presentation follow-up to M1–M7, not a new execution milestone or evidence that release gates have passed. Preserve the chosen wanted-poster design and the recent dark-mode contrast and ship alignment repairs.

## Design decisions to prototype

- Desktop, panels closed: target roughly 65–75% of the usable main area for the world. Treat this as a composition target, not a fixed height that clips controls.
- Sunny occupies the foreground, with recognizable deck actors and stations. The island is a distinct destination behind/beside it, not another small dashboard tile.
- Keep the current elevated illustrated style. Start with existing assets and 2D composition; evaluate a unified harbor illustration only if the current art cannot join convincingly.
- Preserve the ship's existing aspect ratio, shared actor/art coordinates, ground anchors and station routes. A closer view must not stretch the ship or put crew off the deck.
- One principal detail panel at a time on wide screens. On compact screens use a full-width sheet/page with a clear return to the same world selection. Dense editor/terminal work can retain its full workspace.
- Keep the Grand Line chart and its existing districts reachable through Explore. Project identity uses registered IDs; selecting an island never launches work.

Proposed arrangement:

```text
Slim nav | Project / mission / state          Stop · Attention
         |---------------------------------------------------
         |                    Active project island          |
         |       SUNNY                                      |
         |       crew + deck stations        Selected detail |
         |       clickable, readable         when requested  |
         |---------------------------------------------------|
         | Talk to Luffy · Crew · Explore · Logbook           |
```

## Phase 1 — Compose the world

Build an isolated fixture preview of the opening composition using existing art and clearly labelled sample work. Capture a desktop, compact and dark-mode version before adding more movement. Compare one wider dock view with one closer deck view; choose the framing that keeps Sunny recognizable and actors selectable.

Inspect actual asset dimensions and perspective together. If new art is necessary, specify matching perspective, light, shoreline/deck anchors, export dimensions and provenance before generation. Do not assume a new camera angle can reuse old actor coordinates unchanged.

Deliverable: chosen composition, explicit scene bounds and actor/hotspot placement reference. Acceptance: ship and island are the visual focus; wanted posters remain intact; no clipped ship, illegible crew or faint text. This is the earliest useful visual review point.

## Phase 2 — Make the world the opening workspace

Integrate the selected composition with the existing Home/captain entry and command deck. Retain the captain composer and urgent watch as accessible controls/panels. Consolidate redundant headers so the world gets the recovered space. Keep the voyage context persistent while moving between world and work.

Add a shared world viewport/composition component only after identifying reusable deck content; avoid mounting two interactive decks or duplicating subscriptions. Keep draft, selected project, mission and return-focus behavior intact.

Deliverable: opening Sunny view with readable persistent work status and expandable details. Acceptance: the captain can start a brief, inspect active work, stop work and reach an approval immediately; animation or panel transitions never delay those actions. Existing workbench and M4–M7 surfaces remain reachable.

## Phase 3 — Connect crew, stations and island

Clicking a crew actor opens that person's wanted profile, including a clear action to open their actual work. Clicking a station opens the corresponding existing work surface. Clicking the project island opens that project's quarters/missions. Provide visible hover and keyboard-focus labels and a searchable/list alternative.

Switching projects changes the selected destination and relevant records together. Define empty, unavailable and removed-project states. Opening a view must not create a mission, bill a provider or imply a connection. Close/Escape returns focus to the original actor, station or destination control.

Deliverable: connected exploration with reliable return navigation. Acceptance: all ten crew are reachable by pointer and keyboard, project IDs stay correct, drafts survive navigation, and no hidden world target is required to operate the app.

## Phase 4 — Put recorded handoffs on the deck

Reuse M5's authoritative handoff report. Selecting an exchange highlights the two participants and presents a short recorded result/brief with an inspectable parcel. A bounded visual exchange can face the crew toward each other and move the parcel; walking is optional and must follow valid deck paths.

Label historical exchanges as recorded/replay. Distinguish a recorded assignment brief from an actual recipient reply. Preserve attribution, missing-data states and access to full source work. Animation completion never changes task status, review or acceptance. Unknown participants use a readable fallback rather than an invented speaker.

Avoid moving a worker away from their current real-state position to replay history: use a separate replay layer or temporary scene presentation clearly marked as historical. Do not replay old exchanges automatically after reconnect/navigation. Provide previous/next and explicit replay controls; reduced motion shows the same information immediately.

Deliverable: interactive, truthful deck conversation. Acceptance: handoff content matches the retained report, blocked/unknown states stay explicit, navigation does not duplicate work, and the full exchange is readable without animation.

## Phase 5 — Polish, qualify and update locally

Add restrained ocean motion, actor emphasis and scene transitions after the geometry and controls pass. Respect both system and app reduced-motion settings and the existing pause control. Keep audio opt-in. Suspend unnecessary world animation when hidden and avoid duplicate animation loops.

Validate light/dark appearance, keyboard navigation, focus return, normal/reduced motion and 200% text/zoom. Capture at least 1440×900, 1000×700 and 390×844 fixture layouts, including open panels, long text, pending approval, blocked work, missing art and no selected project. Measure text contrast: normal text at least 4.5:1, large text and meaningful control boundaries at least 3:1.

Use the existing native world geometry and workflow checks; extend them for visible target bounds, panel obstruction, project switching and recorded replay behavior. Establish a scene performance baseline before changes, compare the same workload afterward, and preserve existing control-response thresholds. Final Node 24 clean installation, full tests, build/typecheck and fixture Electron workflow must pass or exact failures remain documented. Do not suppress the two previously unexplained delivery failures if they recur.

Qualify the exact packaged candidate with the applicable existing contained UI/workflow scenarios. Inspect screenshots rather than relying only on geometry assertions. Update the design/world/art references and record source/build identity. For the requested eventual local update, check app quiescence, preserve current data with a verified backup, retain the prior package, update shortcuts and inspect the installed app. Never restore an old database over newer work as a visual rollback.

Deliverable: tested local package and before/after screenshots of the opening world, wanted profile and deck handoff. Report exact passing checks, unresolved limitations and installed version separately from source completion.

## Implementation map and boundaries

| Area | Existing integration points / intended responsibility |
| --- | --- |
| Opening shell and navigation | `src/App.tsx`, `src/views/HomeView.tsx`, `src/components/VoyageBar.tsx`: world entry, current context and urgent controls |
| Ship and world geometry | `src/views/CommandDeck.tsx`, `ShipView` in `src/views/DashboardViews.tsx`, `src/components/DeckCrew.tsx`, existing deck motion: one coordinate system and reusable scene composition |
| Destination and project access | `src/views/IslandView.tsx`, existing project-quarter routing: selected-project identity and return navigation |
| Wanted profiles | `src/components/CrewJournal.tsx`, existing directory/profile components: retain poster presentation and work actions |
| Recorded exchange | `src/components/HandoffParcels.tsx`, `src/components/RoomCrewRelay.tsx`: shared handoff data, attributed presentation and replay controls |
| Appearance | Existing studio/world styles: scoped layout and readable surfaces; avoid another broad override layer |
| Evidence | Existing native fixture scripts and world/motion tests; new focused assertions only where behavior changes |

No new provider, backend, database migration, game engine or 3D dependency is planned. If implementation discovers a need to change stored state or privileged behavior, document that separately before expanding scope. Preserve the companion ship and independent work controls.

## Sequence, risks and completion

Implement phases in order, with one coordinated writer for the affected renderer subsystem. Keep changes on a feature branch; preserve existing work and review the full diff. Phase 1 establishes the visual direction; phases 2–3 establish a useful vertical slice; phase 4 adds handoff presentation; phase 5 qualifies the exact combined candidate.

Primary risks are mismatched art perspective, clipped coordinates at zoom, distracting motion, panel focus/draft regressions and confusing historical replay with live work. Their checks are included above. Reuse current art first, retain direct controls and separate recorded replay explicitly.

Done means the opening scene visibly centers Sunny and the destination, every interaction remains usable without animation, M1–M7 work controls remain intact, evidence covers the combined candidate, and the installed local build has been verified. Planning does not resolve the outstanding delivery root-cause investigation or grant production release admission.

References: [studio design](sunny-studio-design.md), [world bible](world-bible.md), [art bible](art-bible.md), [art provenance](../public/assets/ARTWORK.md), [roadmap](agent-platform-roadmap.md), [Windows validation](windows-validation.md).
