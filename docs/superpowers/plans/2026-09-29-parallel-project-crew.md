# Parallel Project Crew Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Run independent specialists concurrently on one project, then automatically integrate, validate, review and repair within captain-authorized scope.

**Architecture:** Keep the Hub authoritative. Introduce managed execution workspaces, a persisted assignment graph and a bounded scheduler; version 2 attempts use these services while legacy sequential attempts retain their behavior. Independent reviewers inspect exact combined-source revisions.

**Tech Stack:** Node 24, CommonJS Electron services, existing Codex app-server adapter, Git worktrees, strict TypeScript/React, node:test; no new dependencies.

**Spec:** ../specs/2026-09-29-parallel-project-crew-design.md

## Global Constraints

- Global specialist capacity 1–16, default 3; island job capacity remains 1–3, sharing worker capacity.
- Maximum 16 initial assignments, 32 total launches and three repair cycles per attempt; one active assignment per crew within an attempt.
- No automatic retry or historical resume of ambiguous work; unknown submissions retain reservations.
- One writer per physical checkout; exclusive logical-project reservation during parallel attempts.
- Final result remains WAITING_FOR_REVIEW; consequential actions require captain authorization.
- Preserve Node 24, existing character roles, live model validation, trusted IPC, reduced motion and all user work.

## Review Focus

- External branch changes between inspection and integration must fail without overwriting work (Task 2/5).
- Queued workers cancelled during asynchronous launch must never escape Stop crew (Task 4).
- Restart during local integration must reconcile observed Git state rather than applying twice (Task 5).
- Reviewer finding paths containing traversal or pointing outside ownership must fail closed (Task 6).
- Capacity reductions and pending approvals must not starve or oversubscribe other missions (Task 4/7).

## File and service boundaries

Create desktop/parallel-contract.cjs for schemas and graph validation; desktop/execution-workspaces.cjs for managed Git workspace lifecycle; desktop/parallel-crew.cjs for dispatch and repair state; desktop/parallel-integration.cjs for serial integration; desktop/parallel-review.cjs for structured verdicts. Extend existing Hub, Captain, mission book/workflow, shared renderer contracts and assignment components without unrelated restructuring. Main-process-only services resolve all trusted paths.

### Task 1: Versioned parallel records and migration

Files: create desktop/parallel-contract.cjs and tests/parallel-contract.test.cjs; modify desktop/missions.cjs, desktop/core.cjs and src/shared.ts. Document concrete schemas in the existing design before code.

Interfaces: validateBatch(input, eligibleCrew) returns normalized assignments; validateParallelRecord(record) returns a validated persisted record; migrateMissionData(saved) returns version 2 mission data preserving legacy workflow versions. Assignment fields: id, crewId, roleId, title, objective, ownedPaths, acceptanceCriteria, dependsOn, model, effort, selectionReason. Parallel record fields: batchId, attemptId, assignments, workspaceIds, launches, repairCycle, integration, review, state.

- [ ] Write tests asserting unknown fields, duplicate IDs, cycles, invalid capacity and overlapping ownership are rejected; legacy missions preserve IDs/events/workflow; unsupported versions and malformed recovery records preserve the source.
- [ ] Run the new test file with README's Node executable; confirm failures are the missing interfaces.
- [ ] Implement bounded schemas and backup-before-atomic-migration; backup failure prevents upgrade. Test isolated JSON and SQLite stores, never the active profile.
- [ ] Run new tests plus tests/missions.test.cjs, tests/upgrade.test.cjs and tests/reconciliation.test.cjs; expect all pass. Commit explicit files.

### Task 2: Managed worker and integration workspaces

Files: create desktop/execution-workspaces.cjs and tests/execution-workspaces.test.cjs; modify desktop/mission-branch.cjs only where shared Git observations are needed.

Interfaces: ExecutionWorkspaces.create({project,attemptId,assignmentId,baseCommit}) returns {id,projectId,attemptId,assignmentId,path,branch,baseCommit,state}; inspect(record) returns verified Git state; resolve(record, project) returns a canonical trusted root or throws. Records are allocated and persisted before commands; cleanup requires explicit preservation-aware action.

- [ ] Write fixtures asserting separate same-repository roots and branches, clean-base requirement, rejection of dirty/non-Git sources, outside-root junctions, wrong Git common directory and unexpected branch/base changes; creation never modifies the source checkout.
- [ ] Run fixtures and confirm missing-service failures.
- [ ] Implement bounded argument-array Git operations in a verified local managed directory outside OneDrive. Persist creation intent and distinguish uncertain creation from confirmed failure; no destructive cleanup on exceptions.
- [ ] Run new tests and tests/mission-branch.test.cjs; expect pass. Commit explicit files.

### Task 3: Workspace-aware task operations and reservations

Files: modify desktop/hub.cjs, desktop/core.cjs, desktop/main.cjs, desktop/approvals.cjs, desktop/mission-evidence.cjs and src/shared.ts; create tests/parallel-workspace-boundary.test.cjs.

Interfaces: Hub.executionRoot(task) resolves a validated execution workspace or legacy project root; TaskGate acquires physical writer and logical-project reservations separately. Persist task.workspaceId before thread submission; renderer requests identify tasks, never arbitrary roots.

- [ ] Write tests proving thread/start cwd, continuation, approvals, editor, terminal, Git and evidence resolve the selected workspace while retaining logical project membership; forged workspace IDs and mismatched sender/attempt fail.
- [ ] Confirm new failures before implementation.
- [ ] Route trusted operations through executionRoot; rebuild reservations at startup, including uncertain submissions without thread IDs. Audit effective Codex/tool write boundaries and block configurations where the required boundary cannot be enforced; record this capability outcome without secrets.
- [ ] Run boundary fixtures and existing hub, approval-boundary, task-commands, reconciliation and missing-thread recovery tests; expect pass. Commit explicit files.

### Task 4: Parallel batch dispatch and capacity

Files: create desktop/parallel-crew.cjs and tests/parallel-crew.test.cjs; modify desktop/captain.cjs, desktop/hub.cjs, desktop/island.cjs, desktop/mission-roles.cjs and desktop/mission-workflow.cjs.

Interfaces: ParallelCrew.submit({parent,attempt,batch,callId,turnId,revision}) returns persisted batch result; tick() launches eligible records; stop(attemptId) cancels queued starts and interrupts all descendants; reconcile(attemptId) observes without resubmitting. Main process alone increments persisted launch counters.

- [ ] Write tests for two overlapping live workers in distinct workspaces, serialized owned-path overlaps, dependency readiness, crew recruitment, capacity sharing, pending approvals, lowered capacity, stale tool calls and duplicate call IDs.
- [ ] Write cancellation-during-launch and partial-stop-failure tests; assert no queued child starts after stop and all live children receive interruption attempts.
- [ ] Confirm failures, then implement validated batch tool, capacity scheduler and durable dispatch reservations. Preserve sequential tool/version 1 semantics and the existing prohibition on recursive delegation.
- [ ] Run new tests and captain, island, mission-workflow and model-routing regressions; expect pass. Commit explicit files.

### Task 5: Serial local integration and exact-source evidence

Files: create desktop/parallel-integration.cjs and tests/parallel-integration.test.cjs; modify desktop/missions.cjs and desktop/mission-evidence.cjs.

Interfaces: ParallelIntegration.collect(assignment,workspace) returns verified snapshot metadata; apply(snapshot,integrationWorkspace) returns sourceCommit/resultCommit evidence; reconcile(operation) returns observed resolved or uncertain state. Every operation is persisted before execution.

- [ ] Write tests integrating disjoint changes and rejecting out-of-ownership edits, protected metadata changes, missing results and unexpected source changes. Conflicts preserve both contributions and block.
- [ ] Inject interruption before/after integration command and assert restart never reapplies ambiguously; verify deterministic source fingerprints bind check artifacts.
- [ ] Confirm failures; implement serial integration in a separate managed branch, accepting only inspected snapshots. No PR/main merge. Block unresolved workers, conflicts and invalid evidence.
- [ ] Run new tests and mission-evidence, mission-hub and mission-deliverables regressions; expect pass. Commit explicit files.

### Task 6: Independent review and automatic repair

Files: create desktop/parallel-review.cjs and tests/parallel-review.test.cjs; modify desktop/parallel-crew.cjs, desktop/captain.cjs, desktop/missions.cjs and desktop/mission-workflow.cjs.

Interfaces: validateVerdict(input,{attemptId,baseCommit,headCommit,reviewerTaskId}) returns {verdict,findings,evidence}; verdict enum approve/request-changes/blocked; finding fields id, path, explanation, evidenceRef. Repair routing consumes normalized findings and assignment ownership.

- [ ] Write tests rejecting author-as-reviewer, stale/malformed verdicts, traversal finding paths, unowned findings and model approval of failed checks. Assert all required assignments and current checks precede readiness.
- [ ] Write tests for findings routed to correct specialist, three repair cycles, 32 launches, persisted counters across restart and a fourth cycle blocked; approval binds exact combined source.
- [ ] Confirm failures; implement automatic local fix/test/review loop, fresh Usopp checks and Zoro review, stopping at WAITING_FOR_REVIEW. Missing requirements, uncertain state and consequential actions block with explanation; no automatic human acceptance.
- [ ] Run new tests plus mission-workflow, mission-hub, approval-boundary and reconciliation regressions; expect pass. Commit explicit files.

### Task 7: Accessible progress and capacity controls

Files: modify src/shared.ts, src/components/CrewAssignments.tsx, src/components/MissionExecution.tsx, src/taskFlow.ts, src/App.tsx and existing styles; modify trusted settings validation in desktop/main.cjs/hub.cjs. Extend desktop/workflow-smoke.cjs and tests/task-flow.test.cjs.

Interfaces: snapshots expose validated assignment state, owned area, dependencies, workspace label, integration status, reviewer verdict and repair cycle; workerCapacity settings command accepts integer 1–16 only.

- [ ] Write meaningful projection tests for queued, blocked, uncertain and review states and capacity bounds. Preserve assignment opening, Back to Luffy and stop controls.
- [ ] Implement labels and keyboard controls using current components, without new art. Actual running task state alone drives work animations; honor reduced motion.
- [ ] Run renderer tests and fixture Electron workflow covering simultaneous workers, approval, partial stop, conflict, reviewer changes and reduced motion; capture fixture evidence without private data. Commit explicit files.

### Task 8: Combined verification and delivery

Files: update README.md, docs/agent-routing.md and docs/agent-platform-roadmap.md, linking the design rather than creating competing policy docs; save dated isolated evidence under docs/evidence/.

- [ ] In a clean isolated checkout run Node 24 npm ci, npm test and npm run build with README's direct npm CLI; run focused security/recovery tests and fixture Electron workflow. Report exact unresolved failures; no lint command exists.
- [ ] Run one bounded live two-worker synthetic project mission through Sunny. Record actual overlapping execution, task/workspace/result IDs, combined diff, deterministic checks and independent review. Do not use production data or fabricate live evidence.
- [ ] Review the full branch diff and security/persistence boundaries, resolve introduced issues, then update implementation docs and commit explicit files. Report branch, commits, uncommitted work and limitations. Do not merge, publish or activate a replacement executable without applicable authorization.

## Execution handoff

Recommended: native implementation in this chat, with a fresh independent final review. Tasks depend closely on shared persistence and workspace interfaces; keeping one implementation owner minimizes inconsistent contracts. Captain reviews this plan and selects the execution method before product-code changes.
