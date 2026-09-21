# Sunny HQ foundation decision — 2026-09-21

Status: accepted for safe Phase 1 under the captain's handoff authorization. This records design, not a claim that the future mission platform is implemented.

## Existing system

The working tree is Sunny 0.11.0: Windows Electron 38, React 19, Vite 6 and strict TypeScript in the renderer; CommonJS desktop services. `desktop/main.cjs` owns windows, trusted-frame IPC, local commands and OS integration. `preload.cjs` exposes invoke/subscribe, not Node. `hub.cjs` owns tasks and approvals; `codex.cjs` implements app-server JSON-RPC over stdio. `captain.cjs` implements bounded sequential delegation. `model-routing.cjs` validates against a live catalog. `core.cjs` owns checkout locks, path guards and SQLite/atomic JSON persistence. `growth.cjs` supplies bounded attributed recall. `island.cjs` owns local jobs, run limits and review gates. `news.cjs` manages sourced manual briefings.

`useSunny.ts` consumes snapshots and incremental task events. `shared.ts` is the existing IPC-facing type contract. `taskFlow.ts` derives task-family presentation. `deckMotion.ts` and `islandMotion.ts` visualize task state. The world is a clickable ship and island with moving crew, not a player-controlled walking game with enterable project rooms. Home opens first; the workbench is a chat/files/Git/terminal workspace. Supabase and Vercel are catalog links, not implemented backends. GitHub uses local `gh pr list`; there is no complete mission-to-PR-to-merge lifecycle yet.

Persistence is a JSON state object in one SQLite row, with a JSON fallback. There is no relational mission schema or event journal. Existing recovery deliberately reserves uncertain checkouts and does not restart work. Preserve that behavior.

## Alternatives and decision

| Approach | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Strengthen existing Hub/Codex path | Preserves tested delegation, recovery and desktop boundaries | Some provider-shaped task logic remains | Required now |
| OpenClaw sidecar through a main-process adapter | Reuses sessions, providers, scheduling, tools and channels | Another service, auth boundary, lifecycle and version matrix | Evaluate after mission contract/recovery |
| Replace Hub with a general multi-provider framework | Broad theoretical flexibility | Migration risk, duplicate state, speculative abstractions | Not recommended |

```text
Sunny world / Home / mission board / captain approvals
                     ↑ sanitized state and events
Electron preload ← trusted main-process IPC
                     ↓ validated intent
Hub: projects + missions + roles + policy + audit
      ├─ deterministic routing → optional semantic decision adapter
      ├─ existing captain orchestration + checkout ownership
      └─ runtime boundary
          ├─ existing Codex app-server
          └─ optional OpenClaw / Claude worker later
                     ↓ evidence
          local Git / tests / reviewable PR / human-authorized merge
```

Roles and Sunny identity stay stable; runtime, model and worker bindings are replaceable. Do not add a separate provider layer unless two real implementations need it. Renderer components consume Sunny state rather than polling providers. Ambient animation remains explicitly separate from work evidence.

## Smallest mission contract (design)

Extend the existing task family rather than replace conversations. A Mission needs `id`, `projectId`, `title`, `objective`, `status`, `taskIds`, `assignedRoles`, `acceptanceCriteria`, `riskLevel`, timestamps, artifact references and approval references. Tasks retain provider thread/turn IDs. Each execution attempt gets a distinct attempt ID; follow-ups must not reuse a completed attempt's evidence. Artifacts carry kind, location, commit SHA where applicable, producer and verification time. Large transcripts and artifacts are referenced, not duplicated into every mission.

Mission statuses: DRAFT → PLANNING → READY → RUNNING → WAITING_FOR_REVIEW → NEEDS_USER → COMPLETE; RUNNING can enter BLOCKED or FAILED. BLOCKED/FAILED resume only through an explicit new attempt after reconciliation. A documentation-only mission may complete after its acceptance evidence is satisfied; a mission whose objective includes merging cannot complete merely because a coding turn finished. Cancellation is explicit CANCELLED, not success. Provider `finished` means turn finished, not mission complete.

The forward sequence is the normal path, not the complete transition graph. PLANNING and WAITING_FOR_REVIEW may also enter BLOCKED or FAILED when their work fails. Reviewer-requested changes send WAITING_FOR_REVIEW or NEEDS_USER to PLANNING (scope changed) or READY (bounded rework), followed by RUNNING with a new attempt ID. Retain prior review/test/artifact evidence as historical and invalidate approvals tied to the superseded revision. A valid approval restores its recorded prior nonterminal phase, or permits COMPLETE only when acceptance evidence and all required actions are satisfied. A denied approval never executes the action: NEEDS_USER returns to BLOCKED for a decision or to PLANNING/READY for explicitly requested rework. Cancellation from any nonterminal mission state yields CANCELLED. Retrying FAILED/CANCELLED requires an explicit new attempt after reconciliation; terminal attempt evidence is immutable.

## Agent states and legal transitions (design)

| State | Allowed next states | Visual meaning |
| --- | --- | --- |
| IDLE | PLANNING, THINKING, WORKING | At ease; no active attempt |
| PLANNING | THINKING, WORKING, WAITING, BLOCKED, NEEDS_USER, FAILED | Map/planning desk |
| THINKING | PLANNING, WORKING, REVIEWING, WAITING, BLOCKED, NEEDS_USER, FAILED | Reading/thinking cue |
| WORKING | THINKING, WAITING, REVIEWING, BLOCKED, NEEDS_USER, FAILED, COMPLETE | Workstation active |
| WAITING | PLANNING, THINKING, WORKING, REVIEWING, BLOCKED, NEEDS_USER, FAILED | Waiting for dependency |
| REVIEWING | WORKING, WAITING, BLOCKED, NEEDS_USER, FAILED, COMPLETE | Inspecting evidence |
| BLOCKED | NEEDS_USER, PLANNING, WORKING, REVIEWING, FAILED | Blocker visible |
| NEEDS_USER | PLANNING, THINKING, WORKING, WAITING, REVIEWING, BLOCKED, FAILED | Captain attention cue |
| FAILED | IDLE | Failure retained; new attempt required |
| COMPLETE | IDLE | Attempt result available |

Cancellation ends the attempt and returns the crew to IDLE with a retained cancellation outcome. Connection health is a separate `connected/reconciling/disconnected` dimension: do not manufacture FAILED or IDLE from a socket loss. Unknown work holds its checkout lock until authoritative reconciliation. An approval overlays the active attempt and determines NEEDS_USER; the prior phase is retained for a valid response. Sprite movement never changes these states.

Current projection: `starting` → WORKING with starting detail; `working` → WORKING; `waiting`/`awaiting-approval` → NEEDS_USER if an actual approval exists, otherwise WAITING; `unknown` → preserve last known phase plus reconciling; `finished` → completed attempt awaiting mission review; `failed` → FAILED; `interrupted` → cancelled attempt. PLANNING/THINKING/REVIEWING require explicit evidence, not text guesses.

## Canonical events (design)

MISSION_CREATED, MISSION_STARTED, TASK_CREATED, TASK_ASSIGNED, AGENT_ASSIGNED, AGENT_STARTED, AGENT_WORKING, AGENT_WAITING, AGENT_BLOCKED, AGENT_FAILED, AGENT_COMPLETE, PR_CREATED, PR_UPDATED, REVIEW_STARTED, REVIEW_COMPLETE, TEST_STARTED, TEST_FAILED, TEST_PASSED, DEPLOY_STARTED, DEPLOY_FAILED, DEPLOY_COMPLETE, APPROVAL_REQUESTED, APPROVAL_GRANTED, APPROVAL_REJECTED, MISSION_COMPLETE, MISSION_FAILED. Add ATTEMPT_CANCELLED and CONNECTION_UNCERTAIN for honest recovery.

Envelope: schemaVersion, eventId, projectId, missionId, taskId/attemptId when relevant, source, sourceEventId when available, occurredAt, receivedAt, per-attempt sequence, type and validated payload. Provider events are normalized in the main process. Deduplicate on stable source identity; reject stale attempt IDs. Unknown fields must not expand authority. Persist accepted events and state atomically before broadcasting. On reconnect fetch authoritative state; never assume a socket replays events. A bounded audit journal is useful; a distributed event broker and full event-sourcing rewrite are unnecessary.

Current transport remains `snapshot`, `task`, `approval`, `completed`, terminal and error events. This document does not silently redefine that live contract.

## Security and context

Keep context isolation, sandboxing, nodeIntegration off, trusted-main-frame checks, URL validation and path/symlink guards. The broad string-based preload contract needs per-action runtime schemas before new privileged actions. Renderer types alone do not validate IPC. Approval records must bind actor, action, target, exact parameters, attempt, expiry and evidence revision; a stale approval cannot authorize new work. Human approval is mandatory for merge, production deploy, spending, messaging/publication, credential changes and destructive external actions. Neither model confidence nor a policy prompt grants authority. See [routing](agent-routing.md).

Use least-privilege runtime credentials held outside the renderer. Maintain stop controls, bounded attempts, timeouts, tool allowlists and rate limits. Distinguish a soft usage threshold from an enforced spend cap. Do not connect third-party channels or send real project context during evaluation without a specific need and authorization.

Context hierarchy: Sunny constitution → project decisions → mission objective/evidence → task brief → role-specific instructions. Each item has source, revision, timestamp, scope and retention rule. Retrieve relevant accepted notes; always include current safety constraints. Store failures, test summaries, PR summaries, accepted references and user decisions as durable artifacts. Do not promote generated claims into verified facts. Keep user corrections authoritative; tombstone forgotten items; stale summaries point back to evidence. Reuse existing bounded recall before introducing embeddings or a memory service.

## Required now, soon, later

Now: constitution, source-backed research, bibles, local validation, CI and review templates. Soon: validated IPC additions, attempt/mission evidence and approval binding, then one Codex branch/test/PR workflow. Later: project-room navigation, canonical event projection, optional runtime adapters and evaluated semantic routing. Optional: Sentry, PostHog, Rive, vector retrieval, remote workers and creative providers. Do not add them simply to populate the map.

## Phase 1 implementation plan

Using the writing-plans workflow, adapted to the captain's specified deliverable paths and authorization to proceed without intermediate approval.

- [x] Add `AGENTS.md`, art/world bibles, reference review, OpenClaw evaluation, routing and platform roadmap; preserve historical docs and label proposals.
- [x] Add feature/bug/architecture-art issue templates and a PR template with evidence, risk and rollback requirements.
- [x] Add Windows CI using Node 24, `npm ci` and the real test/build commands; validate the native fixture locally because hosted GUI execution is not established. No account-dependent smoke test or secrets on PRs.
- [x] Validate clean dependency installation in isolated scratch space, current tests/build/typecheck, workflow syntax, fixture UI and documentation links. Report missing lint/format scripts honestly.
- [x] Review the complete foundation diff; verify pre-existing work hashes; commit only this session's foundation files; report exact remaining user changes.

No application behavior, database, live profile, provider credentials or deployed executable changes are planned. No extra runtime types are added before a consumer exists. Review focus: uncertain sessions, stale approvals, mixed attempt events, case-insensitive documentation names, and CI checks that accidentally require a real account.
