# Agent platform roadmap

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
