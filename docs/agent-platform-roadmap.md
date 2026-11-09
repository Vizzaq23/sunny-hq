# Agent platform roadmap

## Current delivery roadmap — 2026-11-07

**Status: local implementation through M7; milestone/release acceptance remains gated.** The captain originally requested all seven parts in dependency order, then authorized M4–M7 implementation while M3 remained blocked. See the [combined qualification checkpoint](crew-voyage-qualification-2026-11-09.md) for exact revisions, passes and unresolved prerequisites. This section is the current delivery plan; older phases below remain historical context. Preserve Sunny's crew identity and existing runtime. No additional agent framework is needed.

### Verified baseline and CI failures

- Planning source: `05cc5cf`, originally `codex/projects-refresh`; documentation branch: `codex/crew-voyage-roadmap-20261107`. The integrated/installed candidate is separately recorded as `c6aa0ca`. Reconcile the implementation base before editing code.
- [Windows run 42331703723](https://github.com/Vizzaq23/sunny-hq/actions/runs/42331703723) tested `c6aa0cab7893068c73a07ca16f12e6d4c9fe75b2`, Node 24.22.2, Git 2.56.0.windows.4, Windows Server 2025. Artifact `13560002433` was downloaded to `.sunny-dev/timeout-investigation-42331703723/`.
- Locked install, Electron install and production build passed. Tests hit `ETIMEDOUT` after **4,500,186 ms**. Before termination, TAP contained **1,335 passes and 100 failures across 1,435 reported results**. This is an incomplete suite, not its final total.
- Repeated scheduler failures spent approximately 60 seconds waiting and reported `Offline fixture timed out: ["Workspace Git ownership changed."]`. Early checkpoint-collection failures included `started === true` assertions. Root causes remain unverified; not all failures necessarily share a cause.
- Native workflow separately failed with `UI wait timed out: document.querySelector(".helm-workspace").dataset.motion==="full"`. An OS motion-preference assumption is a hypothesis requiring reproduction.
- Fresh local `pending-approval-replay.test.cjs` and `approval-boundary.test.cjs`: **23/23 passed**, zero skips/cancellations, 315.6 ms. These are synthetic transport checks on the planning source, not live reconnect or edited-command proof.
- Preserve original failures. Increasing the 75-minute timeout alone cannot fix the already-recorded failures. No application code, release gate or installed profile was changed during this investigation.

### Dependency order

| Milestone | Requested part | Depends on | Deliverable |
| --- | --- | --- | --- |
| M0 | Validation prerequisite | None | Explained failures and clean Windows baseline |
| M1 | 6. Reconnects and approvals | M0 | Exact-request safety and live reconnect evidence |
| M2 | 7. Ship's diagnostic log | M1 | Bounded, redacted timeline of real records |
| M3 | 1. Crew-to-Codex workflow | M1, M2 | One continuous council-to-work-to-human-review journey |
| M4 | 2. Voyage bar | M3 | Persistent mission context and attention controls |
| M5 | 3. Visible handoffs | M3, M4 | Inspectable briefs, changes and check receipts |
| M6 | 4. Zoro's review table | M3, M5 | Criteria-to-evidence review and captain decisions |
| M7 | 5. Robin's accepted-work shelf | M6 | Searchable accepted snapshots with provenance |

M2 is a minimal diagnostic view, not an observability platform. M3 proves the journey using existing review controls and records handoff references; M5 and M6 improve those same surfaces. Design work can begin earlier, but a milestone cannot pass without its prerequisite evidence.

### M0 — Explain and repair Windows validation

Inspect the exact failed commit in a clean isolated checkout. Group all 100 failures by fixture, error and duration. Reproduce the earliest ownership mismatch and compare Git/worktree identity and path normalization between local and hosted environments. Investigate the native motion failure independently.

Acceptance criteria:

- Every failure group has a documented cause and repair or an explicit unresolved blocker; distinguish primary errors from cascading waits.
- On one identified final candidate, clean Node 24 `npm ci`, full `npm test`, `npm run build` and hidden fixture Electron workflow pass locally and in hosted Windows validation. Save SHA, versions, durations and logs.
- Ownership tests reject genuinely changed Git ownership while accepting valid fixtures. No security guard is weakened to pass CI.
- Native tests deterministically cover OS and application reduced-motion combinations without altering the user's OS preference or expecting animation under reduced motion.
- No skipped tests, hidden errors, `continue-on-error`, fabricated success or unexplained timeout increase. No lint pass is claimed: no lint command is configured.

Exit: a reviewed baseline receipt. Hosted unavailability remains a blocker to hosted proof.

### M1 — Reconnects and approvals (part 6)

Trace renderer preview → IPC → Hub → provider response, including editable command presentation. Inspect installed CLI-generated schemas and current official approval documentation before implementation. Existing `desktop/approvals.cjs` returns a decision for command approval; editable presentation must not imply replacement of the provider command.

Acceptance criteria:

- Acceptance binds to request identity, project, task/execution, turn and current transport/validity. Stale, expired, duplicate, cross-project and superseded responses send no unauthorized provider output.
- Editing displayed command text can never approve a different original command. If replacement is unsupported, decline and request a newly issued action or remove the misleading edit-and-approve flow. Test displayed text and outgoing wire response together.
- An isolated real-provider probe observes a pending approval, connection interruption, authoritative reconciliation and a fresh explicit decision. Record actual replay if observed; no replay means that behavior remains unverified.
- Harmless fixture accept/decline cases verify actual side-effect count. Duplicate responses cannot execute twice; uncertain execution retains its reservation and is never automatically retried.
- Deterministic regressions cover restart, same/replacement RPC IDs, stale UI responses and cancellation races. Synthetic permutations remain distinguished from actual provider observations.
- Save redacted protocol/version receipts, correlation IDs and cleanup results; no credentials or private prompts. Approval is explicitly limited to the harmless fixture action.

Exit: live evidence plus adversarial regressions. An in-memory replay is insufficient.

### M2 — Ship's diagnostic log (part 7)

Project existing mission events, task/attempt records, approvals and execution receipts into a bounded timeline. Reuse `desktop/run-presentation.cjs` and mission projections where suitable; do not create a second lifecycle tracker.

Acceptance criteria:

- Entries identify project, mission, attempt, source record, time and observed outcome; unknown ordering and missing facts are labelled.
- The captain can trace why work waits, which request was decided, what execution was observed and where its result lives, without reading private transcripts.
- Duplicate/replayed events do not create duplicate actions or misleading transitions. Recovery distinguishes last-known state from reconciled state.
- Default views/exports omit private prompts, command bodies, credentials and sensitive paths; test redaction and access to any restricted detail.
- Document retention, size bounds, restart behavior and logging failure behavior. Missing diagnostics cannot manufacture success or grant authority.

Exit: M1's reconnect/failure journey is understandable through retained records. OpenTelemetry export is deferred; no new service or telemetry dependency is required.

### M3 — Crew-to-Codex workflow (part 1)

Use one registered synthetic project with explicit success criteria. Luffy receives the goal, Nami plans, the captain reviews the selected handoff, Franky implements, Usopp checks, and Zoro returns a result for acceptance or changes. Build on council, mission, delegation and result services. Preserve older direct Codex task paths.

Acceptance criteria:

- One continuous journey links council, reviewed brief, mission, attempt, specialist tasks, branch/source revision, changed files, check receipts and review result. Do not splice historical probes into claimed continuous proof.
- Only selected context reaches Codex; private journal recall is not silently exported. Scope, project, budgets and checkout ownership are revalidated at dispatch.
- Duplicate launches and ambiguous dispatch acknowledgements cannot create duplicate execution. Pending/unknown outcomes survive restart and require reconciliation.
- Demonstrate success → waiting for review → captain acceptance, and changes requested → explicitly initiated rework → fresh review. Preserve old attempt evidence; provider completion and green checks never auto-accept.
- Demonstrate stop, blocked approval and reconnect within this same workflow with actual receipts and preserved reservations.
- Inventory and satisfy every existing trusted-release gate prerequisite independently. Normal admission remains closed until a separate release decision; no bypass is allowed to obtain a successful demo. A blocked probe remains blocked evidence.
- Regressions preserve direct Codex tasks, advice-only councils and existing saved data. Production installation, merge and deployment remain separately authorized.

Exit: reviewed continuous-journey evidence and a separate explicit release/admission decision. If the gate prerequisites remain unmet, M3 is incomplete.

### M4 — Voyage bar (part 2)

Add one shared strip across full-app rooms/work views, showing selected project, mission, current attempt, actual active crew and attention needed. Use canonical mission state; navigation selection is not a new work tracker.

2026-11-08 local implementation checkpoint: `31852db` passed clean Windows installation, all 1,771 tests, build and the hidden native workflow. Supplemental voyage checks cover historical/missing attempts, keyboard actions and dialog/navigation draft preservation. See [M4 evidence and qualification limits](voyage-bar-m4.md). The captain authorized this implementation while M3 was blocked; M3 prerequisites and release admission remain unresolved, so local validation is not full milestone acceptance.

Acceptance criteria:

- Room navigation preserves selected mission/attempt, draft and return location. Original brief and review are directly reachable with a reliable return action.
- Running, waiting, reconnecting/unknown, failed, cancelled and awaiting acceptance remain distinct; provider completion cannot appear as mission acceptance.
- Multiple missions require explicit selection; no action silently targets another project. No selection has an honest empty state.
- Approval, stop and review are keyboard accessible without walking through the world. Focus, compact layouts and 200% zoom remain usable.
- Reduced motion retains all information. Native fixtures and screenshots cover running, approval, recovery and review states from M3.

### M5 — Visible handoff parcels (part 3)

2026-11-08 implementation: local commit b978883, 83 focused regressions and 13 hidden native checks passed. See [M5 implementation and evidence](handoff-parcels-m5.md). The combined implementation baseline passed; see the [current qualification checkpoint](crew-voyage-qualification-2026-11-09.md) for later layout checks and unresolved M3 prerequisites.

Present recorded transitions as compact parcels referencing sender/recipient roles, attempt/revision, bounded brief and actual changed files/check receipts. Link existing detail views instead of duplicating transcripts.

Acceptance criteria:

- Nami → Franky, Franky → Usopp and Usopp → Zoro expose their actual recorded payloads and provenance.
- Missing evidence says **Not recorded**. Generated summaries are attributed and link to underlying evidence; inferred content is not presented as fact.
- Retry, superseded attempt and changed scope remain distinguishable. Replay cannot duplicate or reassign parcels.
- Files identify their source revision; checks retain safely redacted execution/result metadata. Missing/broken artifacts have explicit states.
- Parcels work without animation and with keyboard/screen-reader access. Opening and returning preserves voyage context.

### M6 — Zoro's review table (part 4)

2026-11-08 implementation: local commit a952863, 78 focused regressions and 11 hidden native checks passed. See [M6 implementation and evidence](review-table-m6.md). Captain acceptance remains explicit. See the [current combined qualification checkpoint](crew-voyage-qualification-2026-11-09.md).

Map every original criterion to the reviewed attempt's file/source revision, check receipt, reviewer observation and unresolved issue. Reuse acceptance/revision guards in `desktop/missions.cjs` and existing result binding.

Acceptance criteria:

- Every criterion has a row, including those lacking evidence. Automated outcomes, generated reviewer claims and captain judgments are distinct.
- Green tests never automatically satisfy criteria or accept a mission. The captain explicitly confirms criteria against the bound result.
- Changed source, selected result or attempt invalidates stale acceptance. Missing/tampered results fail closed with recovery information.
- Request changes records actionable notes against the reviewed attempt; rework preserves the old review and produces fresh evidence.
- Decisions survive restart; duplicate submissions are safe. Persistence failure or pending acceptance cannot appear complete.
- Native fixtures cover missing/failing/stale evidence and unresolved issues, plus keyboard access, compact layout and 200% zoom.

### M7 — Robin's accepted-work shelf (part 5)

2026-11-08 implementation: read-only hash-bound shelf implemented without a storage migration; 29 focused tests and 13 hidden native checks passed. See [M7 snapshot contract and evidence](accepted-work-m7.md). It verifies retained accepted bytes and reports changed/missing content; it does not create an independent byte archive. See the [current combined qualification checkpoint](crew-voyage-qualification-2026-11-09.md) for passes and outstanding prerequisites.

Index only captain-accepted results, searchable and grouped by project, using existing durable acceptance/result references and integrity hashes. The shelf index is rebuildable, not an independent acceptance database.

Acceptance criteria:

- Entries show project, mission, accepted attempt/date, source/result identity, safe preview and a link to the exact review decision.
- Unaccepted, rejected and merely provider-finished work is excluded. Legacy acceptance without snapshot proof is explicitly distinguished or excluded.
- Accepted snapshots are immutable. Later working-file changes display **Changed since acceptance**; missing/unverifiable content displays unavailable/unverified. Never substitute current file contents for the accepted snapshot.
- Search respects project boundaries, works after restart/index rebuild and meets a documented performance target on a representative fixture size selected before implementation.
- Preview types/sizes are bounded; untrusted content receives no privileged bridge. Preserve path/symlink checks and exclude secrets from indexing.
- Test changed/deleted files, corrupt snapshots, repeated acceptance events and restored profiles. Removing index data never deletes source files.

### Delivery, persistence and release rules

- One writer per subsystem; focused changes in milestone order. This plan does not require subagents or authorize concurrent checkout edits.
- Before adding persisted fields/storage, document schema, compatibility, backup, migration, rollback and failure tests. Confirm gaps before adding data; reuse existing IDs, snapshots and events where possible.
- Use isolated fixture databases/profiles. Never restore a backup over the active daily profile to pass validation. Separately authorized activation must retain the prior app/profile.
- Each milestone records exact source, focused regressions, full tests/build and reviewed diff. UI milestones also require hidden native workflow and visual/accessibility evidence. Verify the final combined candidate rather than assembling receipts from incompatible revisions.
- Preserve existing art/tokens, atlas geometry, crew identity, reduced motion and direct controls. New artwork, if needed, requires provenance and updated visual references.
- Unresolved failures remain blockers. Revert focused feature commits for code rollback; storage rollback follows the documented migration contract without discarding history.
- This planning request does not authorize default-branch pushes, merges, installation, production deployment, paid service setup or external messages. Optional telemetry and new frameworks stay outside this delivery scope.

Completion means all seven parts share the verified mission journey, final Windows validation passes, the captain accepts exact evidence, and the shelf distinguishes accepted work from later changes. No implementation milestone is claimed complete by this roadmap.

2026-09-21. This roadmap began with the foundation session and is retained as the dependency plan. The captain subsequently authorized implementation beyond Phase 1. See the [current full-PDF audit](master-goal-audit.md) and [implementation evidence](living-missions-plan.md) for present status; the complete goal is still open. See also [design](foundation-design.md), [routing](agent-routing.md), [world](world-bible.md), [art](art-bible.md), and [reference review](REFERENCE-REVIEW.md).

Current checkpoint: PRs #2 and #3 are merged with captain authority; hosted checks passed on merge c792b527. The preserved 0.11.0 daily workspace is integrated and the verified unsigned Electron 44.4.3 package was activated after a closed-profile backup. The visible app is responding. Authenticated deployment inspection returned zero records. The continuous Sunny publication/acceptance journey, daily acceptance and broader project/world requirements remain incomplete. See the [current implementation report](SUNNY-HQ-IMPLEMENTATION-REPORT.md) and [requirement audit](master-goal-audit.md) for exact source, evidence and limits. Separate live worker runs and synthetic native fixtures must not be presented as one continuous live mission. Optional vendor adoption remains conditional.

## Phases and gates

| Phase | Work | Exit evidence |
| --- | --- | --- |
| 1 — Foundation | Research, constitution, bibles, architecture, real CI, issue/PR templates, security/context rules | Reviewed docs and locally reproduced project checks |
| 2 — Mission truth | Small role registry, attempt lifecycle, mission acceptance, canonical events and approvals | Recovery/replay/stale approval tests; compatibility with current tasks |
| 3 — One real voyage | Sunny → Mission → Codex → branch → implementation → tests → PR → Sunny result | Traceable commit/PR/check evidence; human merge gate |
| 4 — Living world | Project room entry, mission board, state-driven sprites/stations/notifications | Same mission survives navigation/restart; accessibility and reduced motion |
| 5 — Evaluated autonomy | Optional Jev and OpenClaw adapters; planner → router → workers → reviewer → human | Held-out quality/cost results, least privilege and cancellation/recovery proof |
| 6 — Creative crew | Select useful image/design/video/audio systems | One authorized workflow and coherent art; no catalogue of fake integrations |

## Observability decision

Use existing local lifecycle diagnostics first, then a bounded redacted operational journal with mission/attempt/correlation IDs. Record crash category, provider/tool failure codes, durations, completion outcomes, routing version/choice, queue latency, retries and provider reliability. Keep actual vs estimated usage distinct. UI events should be a tiny explicit set (mission started, blocker opened, approval viewed), not full conversation replay.

[Sentry Electron](https://docs.sentry.io/platforms/javascript/guides/electron/) is a later crash-diagnostics candidate; verify current SDK requirements and main/renderer initialization before adoption. It would add a network destination and operational account; local logs currently meet this personal foundation's need. [PostHog configuration](https://posthog.com/docs/libraries/js/config) supports analytics, autocapture and replay, with controls to disable capture and filter outbound events. Product analytics is optional; leave autocapture, session replay, terminal contents and transcripts out. If adopted, use opt-in explicit sanitized events and test redaction. Neither is installed. OpenTelemetry-compatible local traces are a later alternative when cross-runtime correlation is needed; do not build an observability platform now.

## CI and PR gates

The workflow runs locked installation, existing tests and the production build/typecheck on Windows/Node 24 without provider credentials. SHA-pinned actions were resolved from official repositories. Local fixture UI checks supplement CI; full account-dependent desktop smoke is not suitable for untrusted PRs. No lint/format script currently exists.

After the workflow has actually run remotely, the captain may make `Windows tests and build` a required branch check with human review and no direct main pushes. Repository rules were not changed remotely. Until then this is a checked-in workflow, not proof of enforced branch protection or a hosted green run. Keep failures blocking; do not add continue-on-error or credentials to PR validation. Installer/release/production deployment remains separately authorized.

## Original five next issues (historical proposals)

These were the foundation report's proposals, not five newly queued tasks. The expanded goal subsequently authorized work on this sequence: issues 1–2 are implemented, issue 3 is locally implemented but lacks the live GitHub proof, issue 4 has a functional room slice, and issue 5 remains conditional on a useful evaluation. Preserve their original acceptance criteria below; use the current audit for outstanding work. The final expanded-goal report must supply five current next proposals.

### 1. Validate mission and approval commands at the desktop boundary

**Goal:** Establish runtime-checked inputs and action-bound approvals before expanding autonomy.

**Why now:** The current sender guard is sound but the preload accepts arbitrary action strings and many argument shapes are implicit.

**Scope:** Explicit schemas for the mission-related IPC surface, capability allowlist, approval binding to action/target/attempt/revision, expiry/replay checks. Preserve current trusted-frame and path guards; no broad main-process rewrite.

**Acceptance criteria:** Invalid actions/arguments, forged senders, cross-project targets, stale approvals and duplicate responses fail closed; valid existing flows and all current tests pass; no secrets enter renderer state.

**Suggested Agent Role:** Builder with security reviewer. **Dependencies:** Phase 1 design/routing rules. **Risk Level:** Medium; security-sensitive local boundary.

### 2. Add minimal Mission and Attempt evidence to current task families

**Goal:** Make acceptance, failure and unknown execution durable and unambiguous.

**Why now:** Provider turn completion currently lacks mission-level acceptance and artifact evidence.

**Scope:** Stable role bindings, task-linked mission/attempt records, canonical event normalization and versioned persistence migration. Retain conversation IDs and current recovery behavior; no workflow engine.

**Acceptance criteria:** Existing saved tasks migrate without loss; duplicate/stale/out-of-order events cannot complete a newer attempt; disconnected work retains its checkout reservation; finished coding remains awaiting acceptance/review; cancellation is not success.

**Suggested Agent Role:** Architecture reviewer + builder. **Dependencies:** Issue 1. **Risk Level:** Medium; persistence and recovery.

### 3. Complete one Codex Build Feature mission through a reviewable PR

**Goal:** Deliver a real branch/change/test/PR workflow with traceable Sunny status.

**Why now:** It proves the foundation before adding runtimes or decorative agents.

**Scope:** One registered fixture project, isolated feature branch or worktree, bounded planner/builder/validator sequence, explicit artifact links, PR/check status refresh and captain merge approval. Use existing Codex integration.

**Acceptance criteria:** A requested feature produces a tested diff and actual PR with commit SHA; failures/blockers surface honestly; stop/reconnect does not duplicate work; no automatic main merge; mission completion matches the requested acceptance boundary.

**Suggested Agent Role:** Coordinator, builder, validator, reviewer, human captain. **Dependencies:** Issues 1–2; authenticated GitHub access for the chosen fixture repository. **Risk Level:** Medium; external PR creation, with merge held for human approval.

### 4. Open a project room onto the real mission lifecycle

**Goal:** Let the captain navigate from the island to a useful project room and inspect the proven workflow.

**Why now:** Real evidence from Issue 3 can drive meaningful world behavior.

**Scope:** One room/door, mission board, workstation, blocked/needs-user indicators and direct artifact access; accessible list alternative and reduced motion. Coherent existing art; no world rebuild.

**Acceptance criteria:** Room identity uses project ID; sprite/desk states match actual attempt events; urgent stop/approval is accessible without walking; normal/error/recovery/reduced-motion screenshots pass art/world review.

**Suggested Agent Role:** World/UI builder + visual reviewer. **Dependencies:** Issue 3 and art/world bibles. **Risk Level:** Low to medium; presentation must not distort state.

### 5. Compare Jev routing and OpenClaw runtime adapters in isolated evaluations

**Goal:** Decide from evidence whether either external layer improves Sunny.

**Why now:** A stable baseline and actual mission evidence now make comparison meaningful.

**Scope:** Separate synthetic Jev shadow-routing corpus and isolated OpenClaw lifecycle probe behind the documented boundaries. Verify installed/current version compatibility, cost, latency, quality, scopes, cancellation and event gaps. No automatic production migration or personal channels.

**Acceptance criteria:** Published evaluation artifact compares rules/current Codex with candidates, includes failure/abstention rates and real usage, proves human gates cannot be bypassed, and records adopt/defer/reject separately for each tool. Paid execution requires the captain's authorization.

**Suggested Agent Role:** Researcher + architecture/security reviewer. **Dependencies:** Issues 1–3; Issue 4 provides the later visual integration target; test credentials if authorized. **Risk Level:** Medium; additional process/provider trust boundaries.
