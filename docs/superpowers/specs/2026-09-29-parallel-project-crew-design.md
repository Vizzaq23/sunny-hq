# Parallel project crew — design decision, 2026-09-29

Status: proposed for captain review. The captain approved the approach, asked that the existing project and crew specialties inform the design, and requested autonomous execution with a reviewer. This document is not evidence that parallel project execution exists.

## Objective and acceptance

Let Luffy coordinate multiple specialists working on different areas of one registered Git project at the same time. Preserve their identities and specialties, provide visible assignments and cancellation, and produce one combined result with fresh verification and human acceptance. Parallelism should improve useful throughput; idle roles must not receive invented busywork.

Success means at least two real independent workers can overlap execution on the same logical project without sharing a writable checkout; the combined deliverable covers the mission criteria; conflicts, failures and uncertain execution remain visible. Support every eligible specialist through an adjustable worker capacity, without promising that the provider accepts every simultaneous request or that parallelism guarantees better quality.

## Existing implementation and affected boundaries

Reviewed README.md, foundation-design.md, agent-platform-roadmap.md, agent-routing.md, openclaw-evaluation.md and the relevant runtime, mission, UI and test files. Existing behavior is documented and enforced by:

- desktop/captain.cjs: one active or uncertain child, six assignments per message, sequential dynamic delegation; specialists cannot recursively delegate.
- desktop/core.cjs and desktop/hub.cjs: three specialist slots, overlapping-root writer exclusion; thread cwd, recovery reservations and several approval checks assume the registered project root.
- desktop/mission-workflow.cjs, mission-roles.cjs and missions.cjs: version 1 ordered plan/work/validate/review, using one matching work task; a parallel batch needs a different completion rule.
- desktop/mission-branch.cjs: clean-checkout branch preparation and fingerprint guards.
- desktop/island.cjs: separate one-to-three job capacity sharing the specialist gate.
- src/shared.ts, CrewAssignments.tsx, MissionExecution.tsx and taskFlow.ts: existing task families and attributed results should remain the projection surface.

No alternate provider is required. Model and reasoning selections continue to use the live Codex catalog.

## Alternatives and decision

1. Recommended: one managed Git worktree per worker plus a separate integration worktree. Keep one writer per physical checkout. More disk and setup work, but conflicts are explicit and the captain's checkout remains preserved.
2. Multiple workers in one checkout with file reservations. Lower disk use, but arbitrary commands, generated files, Git index operations and external editors defeat simple file ownership. Do not choose this as the first implementation.
3. Keep sequential execution and only parallelize read-only advice. Smallest change, but does not fulfill concurrent implementation in different project areas.

Choose option 1. File ownership is an assignment and integration policy, not a claim that a prompt or worktree forms an OS security boundary.

## Crew responsibilities

| Crew | Useful parallel assignment |
| --- | --- |
| Luffy | Decompose and coordinate, track dependencies and collect real results; read-only coordinator |
| Nami | Scope, acceptance criteria, dependency plan and interface agreements |
| Franky | Implementation and architecture in assigned backend/core areas |
| Sanji | Interface design, accessibility and UI implementation |
| Robin | Research and documentation grounded in the actual implementation |
| Chopper | Diagnosis, reproductions and bounded repairs |
| Brook | Requested content, creative assets and copy |
| Jinbe | Local infrastructure, development tooling and release preparation |
| Usopp | Independent tests early, then final combined-source validation |
| Zoro | Early design/security review where useful, then fresh combined-source review |

Recruited residents retain their configured roles and recruitment checks. Support them as eligible assignment workers after validating their role binding; do not quietly grant an unrecruited or unsupported role access. Nami usually plans first. Usopp and Zoro can contribute independent preparatory work concurrently, but final validation and review must inspect the combined result.

## Workflow and bounded dispatch

New parallel attempts use workflow version 2; version 1 attempts retain their existing interpretation.

1. Nami produces a bounded plan: assignments, crew bindings, owned repository-relative paths, acceptance criteria, dependencies and shared interface agreements.
2. Luffy submits a validated assignment batch through a Sunny tool. Maximum 16 initial assignment records, including planner, final validator and reviewer; repair work follows the total attempt budget below. At most one active assignment per crew member within an attempt. No recursive worker spawning.
3. The main process validates the complete acyclic dependency graph and reserves the logical project before dispatch. Assignments with overlapping owned paths cannot run in the same wave. Shared contracts and lockfiles have a single owner; downstream workers start from a checkpoint containing those changes.
4. Persist batch and launch reservations before provider submission. Ready independent assignments run up to the configured global specialist capacity; others remain visibly queued. The scheduler, rather than individual model tool calls, owns dispatch.
5. Gather actual task results and inspect worktree diffs. Finished output alone is insufficient for integration. Reject changes outside declared ownership, changes to protected policy/metadata, missing results and unexpected branch/base changes. Preserve rejected changes for inspection.
6. Integrate accepted worker snapshots serially into the managed integration branch, recording source and resulting commit IDs. Local integration is distinct from merging a PR or changing main. Conflicts block and require a bounded resolution assignment; never silently choose one worker's content.
7. Run final validation on the combined source, followed by fresh review. Record check fingerprints and review references. Any subsequent source change invalidates affected evidence.
8. Return WAITING_FOR_REVIEW with deliverables, actual checks and remaining blockers. Human acceptance and existing consequential-action gates remain authoritative.

The assignment API must bind batch/call ID, parent task, current turn, attempt and revision. Replayed calls return saved results without new workers. Validate input sizes, path normalization, duplicate IDs, crew eligibility, dependency cycles, unknown fields and supported model/effort combinations. Text from workers cannot alter policy or broaden authority.

## Autonomous local execution and independent reviewer

The captain supplies the goal and acceptance criteria once. Within that authorized scope, Luffy automatically plans, dispatches ready assignments, gathers changes, integrates them locally, requests validation and review, and routes actionable findings back to their file owner. Routine local phases do not require repeated captain confirmation. Missing essential requirements, conflicting criteria, uncertain execution or actions beyond the authorized scope block with a clear explanation.

Zoro is the independent final reviewer and cannot be the author of the implementation being reviewed. The reviewer receives the original criteria, exact combined base/head commits, full diff, recorded deterministic checks and relevant worker results. Require a runtime-validated structured verdict: approve, request-changes or blocked, with findings tied to concrete evidence and affected paths. Missing, malformed, stale or unsupported verdicts block readiness. Reviewer text is attributed evidence; it cannot authorize an action or substitute for required checks.

Luffy assigns each actionable finding to an appropriate specialist. Fixes create new recorded assignments and local integration snapshots. Usopp reruns affected checks and the required combined-source checks; Zoro then reviews the resulting exact source again. Allow at most three repair cycles and 32 total assignment launches per attempt, including the initial maximum 16-record batch and all final validation/review tasks. Exhausting either limit blocks and reports remaining findings. Persist counters before launches so restarting cannot reset the bounds. The same worker-capacity limit applies throughout. A failed deterministic check cannot be waived by a model verdict.

After all criteria have current evidence and Zoro approves the exact combined revision, stop automatically at WAITING_FOR_REVIEW with a clear captain notification and reviewable artifacts. Autonomous execution does not silently accept the mission on the captain's behalf. Merge, production deployment, spending, external messages, publishing, credentials, significant deletion and production infrastructure retain explicit human authorization under AGENTS.md. The automated reviewer cannot grant that authorization. Existing approved action-specific flows remain separate from this local execution loop.

Add verification for reviewer independence, malformed verdicts, findings-to-owner routing, exact-source binding, stale-review rejection, three-cycle and launch-budget exhaustion, persisted counters, unresolved findings and attempts to bypass human authority. Show the current repair cycle, reviewer verdict and reason for any stop in the assignment panel.

## Capacity and provider failures

Add a global specialist worker capacity of 1–16, default 3, and expose it clearly. This is a local upper bound, not a provider entitlement. Island job capacity remains 1–3 and draws from the same worker budget; existing unrelated tasks are counted. Coordinators do not consume specialist slots, retaining the existing separate coordinator limit.

Lowering capacity permits current workers to finish and prevents excess new starts. Readiness and ownership determine which assignments can overlap. A known refusal before provider execution blocks that assignment with a clear reason. Any ambiguous submission remains unknown and reserved; do not automatically retry a possibly started turn. Stop crew cancels queued starts and attempts interruption of every live descendant, continuing through individual stop failures and reporting them all.

## Managed checkouts and trusted paths

Keep registered projectId as the logical identity. Add a main-process-owned execution workspace record for each task, bound to project, attempt, assignment, branch, base commit and canonical worktree path. Renderer input cannot nominate arbitrary execution roots.

Create worktrees in a verified managed local directory outside OneDrive. Require a clean committed base for the initial parallel mode; preserve and report dirty user work instead of stashing, switching or copying it silently. Non-Git projects retain sequential mode with a clear explanation.

Validate canonical paths, symlinks/junctions, Git common-directory identity, branch and saved attempt binding on creation, resume and every privileged operation. Workers use their assigned worktree cwd and bounded workspace-write sandbox. Audit configured tool capabilities: arbitrary tools may reach outside that sandbox, so do not claim worktree isolation enforces all tool permissions. If the installed adapter cannot enforce the required write boundary for the effective configuration, block parallel writing and explain the limitation.

Update file/editor/terminal/Git/evidence actions to resolve the selected task's execution workspace while retaining project membership checks. Show which working copy the captain is inspecting. Retain existing overlap exclusions per physical checkout, plus an exclusive logical-project reservation preventing unrelated Sunny writers or a second integration attempt. External editors remain outside Sunny's lock authority; source fingerprints detect changes at integration and acceptance boundaries.

## Persistence, compatibility and rollback

Before product code, define version 2 mission persistence with optional parallel execution records: batch IDs, assignment graph, ownership paths, role/model route, workspace IDs, launch state, result references, integration snapshots and reservations. Task workspace references and global capacity settings must have runtime schemas. Store no credentials.

Create and verify a pre-migration backup before atomically writing the upgraded data. Migrate legacy missions and tasks without fabricating workspaces or changing their workflowVersion. Reject unsupported future versions and malformed records without destructive repair. New parallel attempts explicitly opt into workflow version 2; existing conversations and sequential attempts remain usable.

After restart or disconnect, pending provider submissions and integration commands become uncertain and keep their reservations. Reconstruct workspace reservations before allowing dispatch. Compare provider thread/turn state, filesystem and Git observations; never automatically resume historical work. A planned but demonstrably unsubmitted assignment may be marked not-started; an ambiguous assignment requires explicit reconciliation.

Rollback disables new parallel attempts and preserves version 2 records and worktrees for a compatible build. Do not point an old executable at upgraded data or restore an old backup over the active profile. Verify restoration only with an isolated fixture profile. Cleanup is explicit, preserving uncommitted and untracked deliverables; no automatic recursive deletion of useful worktrees.

## Interface and world projection

Extend Luffy's existing assignment panel and mission board to show crew, assigned area, dependencies, working copy, queued/running/waiting/blocked/uncertain/result states, integration state and evidence. Preserve direct conversations, Back to Luffy, individual Stop and Stop crew. Keep controls keyboard accessible and labels readable; no new artwork is required.

Use the existing ship/island characters and room identity. Work animations derive from real provider tasks; queued dependencies and uncertain work do not animate as productive execution. Preserve reduced motion and direct controls independent of themed navigation.

## Verification and delivery gates

- Isolated Git fixtures prove two same-project workers overlap in distinct worktrees, serialize overlapping ownership, and integrate disjoint changes without touching the source checkout.
- Test capacity accounting with manual tasks and island jobs; dependency order, cycle rejection, one active assignment per crew, capacity changes and duplicate tool calls.
- Test stale attempts/turns, traversal and junction escapes, workspace substitution, unexpected Git bases, out-of-scope changes and unauthorized integrations.
- Inject failure at workspace creation, persistence, provider submission and integration boundaries; prove restart reservations and no duplicate submissions/integration. Test Stop crew with multiple children and partial failures.
- Verify all required batch members plus final validation/review before review readiness; stale fingerprints and missing outputs cannot complete the attempt.
- Test migration, corrupt/unknown versions, backup failure and rollback in isolated profiles.
- Run Node 24 clean installation, npm test and npm run build using README's direct npm CLI where needed; run focused security/recovery tests and the fixture Electron workflow for UI changes. Do not report nonexistent lint checks.
- Run a bounded live two-worker synthetic mission through Sunny after fixture success, recording actual concurrency and provider/worktree/result identities. Failure or lack of live evidence remains explicit.

Update README, agent routing and roadmap references when implemented. Review the full diff, report branch/commits/uncommitted work and preserve merge/publication/deployment approval boundaries. Implementation planning follows captain review of this written spec.
