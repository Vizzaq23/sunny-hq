# Sunny HQ Codex Report

2026-09-21. Safe Phase 1 is complete. Sunny now has a source-backed architecture decision, crew development constitution, art/world rules, runtime/routing evaluations, review templates and Windows CI. Application behavior, artwork, dependencies and live user data were preserved. This is a foundation for a real mission workflow, not a claim that the future autonomous headquarters has shipped.

## What Sunny actually is today

The current working tree identifies as 0.11.0; the previously committed package identifies as 0.9.0, and README contains older version language. Those pre-existing changes were not rewritten or swept into this work. Sunny is an Electron desktop application with a React Home screen, a real task workbench, clickable ship and island, animated crew, project registration, local terminal/files/Git tools, captain delegation, approvals, recovery, memory and manually imported Morgans briefings. The warm illustrated island and compact pet characters already give it a strong identity. It is not yet a player-controlled walking game with enterable project rooms.

Codex app-server is the real execution path. The Hub owns tasks, approvals and persistence; existing recovery keeps uncertain checkout reservations and does not automatically restart work. Renderer snapshots and task events drive UI. SQLite stores a JSON state object, with atomic JSON fallback. There is no relational mission ledger, complete mission-to-PR lifecycle or implemented Supabase/Vercel backend. A provider turn finishing means it is ready for inspection, not that the user's whole mission succeeded.

The important engineering advantage is what already works: bounded delegation, live model catalog checks, isolated desktop boundaries and explicit recovery. The next step should strengthen those rather than replace them with a universal agent framework. [The design decision](foundation-design.md) records source modules, alternatives and consequences.

## Supplied browser references

All five primary links were opened in signed-in Chrome; primary text/replies were read and available video frames inspected. This was not a full audio or frame-by-frame video audit. [The detailed reference review](REFERENCE-REVIEW.md) records effort, dependencies, location and evidence limits for every source.

| Reference | Demonstration / useful idea | Adoption decision |
| --- | --- | --- |
| [SONIA](https://x.com/s0n_ia/status/2101325466313367697?s=46), quoting [Draven](https://x.com/dravenip/status/2101323428473041054) | Pixel trading office makes specialist desks and activity visible. | Adopt role stations backed by real events later. Trading profits and replacement-cost claims are unverified and irrelevant to Sunny acceptance. |
| [Nozelcode](https://x.com/nozelcode/status/2101687753503096880?s=46) / [Chat On Steroids](https://github.com/totec448-spec/chat-on-steroids) | Local tools and continued task context through ChatGPT/MCP. | Adopt durable context; retain supported Codex execution. Do not rely on quota multiplication or replace it with browser automation. Repository security notes expose broad local command privileges. |
| [Ricker](https://x.com/0xricker/status/2101705843200721203?s=46) / [Jev article](https://x.com/0xRicker/article/2101292455391809670) | Structured decisions separate routing from expensive generation. | Rules first now; evaluate Jev later in shadow mode. Confidence never authorizes actions. Advertised speedups were not reproduced. |
| [Avid](https://x.com/av1dlive/status/2100625342520262709?s=46) / [Union Crew](https://github.com/codejunkie99/union-crew) | Separate orchestration and worker models; existing authenticated routes required. | Adopt replaceable bindings. No installation: README says end-to-end orchestration is not yet fully tested; free-period claim was corrected by author. |
| [Professor Glitch](https://www.tiktok.com/@pro.glitch/video/7684994524959001869) | Eight-step caption describes scoped worker folders, rules, corrections, handoffs, board, schedules and permissions. | Adopt scoped briefs and recorded handoffs now. Folders do not enforce security; unattended scheduling/worker creation remains later. |

Avid's [quoted memory article](https://x.com/Av1dlive/article/2100262476898243052) and its [experimental repository](https://github.com/codejunkie99/continual-memory-policy-model/tree/8977cc46865b09c91a39318387d4940e7eeb79a0) reinforce runtime-level evaluation: strong isolated results can fail when interfaces change, and rules can nearly match learned policies. Use revisioned accepted notes before training or adding a memory service. Second-level Draven/GitLab quote previews were not fully reviewed; no recommendation depends on their promises. No commercial assets were copied.

## Runtime and tool decisions

**OpenClaw:** Already installed as `2026.9.5 (ec9c1a1)`; a read-only version check confirmed it. No service, onboarding, update or channels were started. [Official architecture](https://docs.openclaw.ai/concepts/architecture), [protocol](https://docs.openclaw.ai/gateway/protocol) and [security](https://docs.openclaw.ai/gateway/security) document typed WebSocket sessions, scoped identity, provider/tool execution and schedules. Events do not replay: reconnect requires authoritative reconciliation. It could replace commodity session/provider/tool/scheduling infrastructure later. Sunny must retain world, mission acceptance, role identity and captain authority. Keep credentials in main, use an isolated profile and least privilege; default local execution is not proof of sandboxing or local-only model data. Current docs may describe a newer release than the installed binary. [The evaluation](openclaw-evaluation.md) classifies every capability as SUNNY_OWNED, OPENCLAW_OWNED, SHARED or NOT_NEEDED and defines the adoption gate.

**Jev:** Official [TypeSafe API](https://docs.typesafe.ai/api) provides authenticated `/v1/systemone`; [JavaScript SDK](https://docs.typesafe.ai/sdk/javascript) is `@typesafe-ai/sdk`. Choice/Score/Noul answer structured questions rather than code. Inspected [model docs](https://docs.typesafe.ai/models) list `jev-1.13.0`, $0.042 per million input tokens and no output-token charge, shared state, 64k total request and 32k state-plus-longest-question limits. Published rate limits/prices are dated claims to recheck before use. No paid call, SDK install or benchmark was performed. Proposed role: bounded semantic routing only after deterministic checks, with abstention, deadlines and measured quality/cost. [Known limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13) include literal interpretation, arithmetic/date comparison and irrelevant/adversarial context. Confidence is not reliability or authorization. See [routing](agent-routing.md) for the adapter and evaluation contract.

**Claude Code:** Not found on PATH or the normal user-local executable path. Not installed because Codex already supports the first workflow. [Official setup](https://code.claude.com/docs/en/setup) documents supported native Windows installation and account requirements; Git Bash is currently optional, and native Windows lacks its native OS sandbox. Its value would be an independent coding/review worker or fallback, with substantial overlap with Codex. Maintain both only if task outcomes justify the added integration. Authentication, cancellation, recovery and permission behavior remain untested here.

**Other useful primary resources:** [Electron security](https://www.electronjs.org/docs/latest/tutorial/security) supports retaining sender validation, isolation and sandboxing. [Grok Bot](https://x.ai/bot), read in Chrome, demonstrates named jobs, draft review and handoffs but established no Sunny embedding API. [Sentry Electron](https://docs.sentry.io/platforms/javascript/guides/electron/) is a later crash-diagnostics candidate; extraction was inconsistent and no integration was verified. [PostHog configuration](https://posthog.com/docs/libraries/js/config) exposes capture/recording controls: analytics is optional and must exclude prompts, terminals and private work. Existing local redacted diagnostics are sufficient now. No new global tool or project dependency was installed; locked dependencies were installed only into ignored validation copies.

## Smallest useful architecture

```text
Sunny world / Home / mission board / captain
                    ↑ sanitized authoritative state
Renderer → isolated preload → validated main-process commands
                    ↓
Hub: projects, missions, attempts, policy, evidence, approvals
  ├─ deterministic role routing → optional Jev decision later
  ├─ existing bounded captain + checkout ownership
  └─ existing Codex execution → optional runtime adapter later
                    ↓
        Git branch → change → tests → PR → review
                    ↓
             captain-authorized merge
```

Do not create a general provider layer until a second real implementation needs it. The [role table](agent-routing.md#role-bindings) specifies preferred binding, fallback, risk and approval for coordinator, planner, general reasoning, builder, architecture/reviewer, researcher, visual designer, vision inspector, validator, router, operator and captain. Fable/Opus/Gemini are preferences, not installed integrations; Sunny must validate its own runtime catalog. Sol/Astra availability in this development session does not establish Sunny account access.

Minimum Mission fields: project/objective, task and attempt IDs, assigned stable roles, acceptance criteria, risk, status, timestamps, artifacts and approval references. Evidence is tied to its producing attempt and revision. Keep transcripts/artifacts referenced rather than copied into every context. Context follows constitution → project decisions → mission evidence → bounded task brief → role instructions, with provenance, scope and revision.

Initial events: MISSION_CREATED, MISSION_STARTED, TASK_CREATED, TASK_ASSIGNED, AGENT_ASSIGNED, AGENT_STARTED, AGENT_WORKING, AGENT_WAITING, AGENT_BLOCKED, AGENT_FAILED, AGENT_COMPLETE, PR_CREATED, PR_UPDATED, REVIEW_STARTED, REVIEW_COMPLETE, TEST_STARTED, TEST_FAILED, TEST_PASSED, DEPLOY_STARTED, DEPLOY_FAILED, DEPLOY_COMPLETE, APPROVAL_REQUESTED, APPROVAL_GRANTED, APPROVAL_REJECTED, MISSION_COMPLETE, MISSION_FAILED, ATTEMPT_CANCELLED and CONNECTION_UNCERTAIN. These are a design, not the current IPC protocol.

Agent states: IDLE, PLANNING, THINKING, WORKING, WAITING, REVIEWING, BLOCKED, NEEDS_USER, FAILED and COMPLETE. Connection health is independent. The [legal transition table](foundation-design.md#agent-states-and-legal-transitions-design) specifies transitions and visual meaning. Mission's normal path is DRAFT → PLANNING → READY → RUNNING → WAITING_FOR_REVIEW → NEEDS_USER → COMPLETE. Rework creates a new attempt and invalidates stale approvals; denied approval never executes its action; blocked/failed/uncertain work requires reconciliation. Cancellation is not success. This design was corrected during review to include rework, planning/review failure and approval-resume paths.

## Priority and risks

Required now: the completed constitution, decisions, bibles, source research, templates and CI. Required soon: validate expanded IPC and approvals; durable mission/attempt evidence; one real Codex branch/test/PR flow. Required later: project rooms tied to that lifecycle and evaluated multi-runtime autonomy. Optional: Jev, OpenClaw, Claude, analytics, vector retrieval, creative providers and new animation tooling. [Roadmap](agent-platform-roadmap.md) gives phase exit evidence.

| Risk | Mitigation / remaining limit |
| --- | --- |
| Broad action strings and implicit IPC argument shapes | Add per-action schemas before new privileged commands; preserve trusted sender/path checks. |
| Stale approvals or a completed old attempt | Bind authorization/evidence to exact action, target, revision and attempt; reject replays. |
| Socket loss causes duplicate work | Preserve unknown state and checkout reservation; reconcile before retry. |
| Two runtimes/schedulers both own a job | One orchestrator and scheduler per mission/job; optional explicit adapter. |
| Art/style drifts into unrelated generated assets | Preserve inspected Sunny/Chopper anchors and atlas geometry; contact-sheet and runtime review. |
| Unverified vendor availability/cost or viral claims | Live capability checks and isolated held-out evaluation; no consequential action from model confidence. |
| Sensitive telemetry/context leaves the machine | Main-process credentials, minimal scoped context, redacted local diagnostics; deliberate network integrations only. |
| Checked-in CI mistaken for enforced protection | Hosted run and branch protection remain unverified; no remote settings changed. |

## Every repository file changed

| File | Change and purpose |
| --- | --- |
| `AGENTS.md` | Created crew constitution, boundaries, review/testing/security/context and done rules. |
| `docs/foundation-design.md` | Created architecture decision, mission/attempt/event/state design and completed Phase 1 plan. |
| `docs/art-bible.md` | Created art anchors, proportions, exports, animation and consistency rules. |
| `docs/world-bible.md` | Created places, roles, metaphors and separation of canon from implementation. |
| `docs/agent-routing.md` | Created role/provider/fallback/authority table and Jev/Claude evaluations. |
| `docs/openclaw-evaluation.md` | Created evidence, ownership, comparison, security and adoption gates. |
| `docs/agent-platform-roadmap.md` | Created phases, observability/CI decisions and exactly five next issue proposals. |
| `docs/references/README.md` | Created research provenance and retention conventions. |
| `docs/REFERENCE-REVIEW.md` | Modified: retained historical scan and appended dated source-backed research. Existing filename retained for Windows case-insensitivity. |
| `.github/ISSUE_TEMPLATE/feature.md` | Created bounded feature/mission request template. |
| `.github/ISSUE_TEMPLATE/bug.md` | Created reproducible failure/recovery template. |
| `.github/ISSUE_TEMPLATE/architecture-art.md` | Created architecture/world/art decision template. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Created evidence, risk, migration, art/security and rollback review checklist. |
| `.github/workflows/ci.yml` | Created least-privilege Windows Node 24 install/test/build workflow with SHA-pinned actions. |
| `docs/SUNNY-HQ-CODEX-REPORT.md` | Created this completion report. |

Ignored `.sunny-dev/foundation-research` retains local logs and initial hashes; `foundation-clean` is the fresh dependency copy of current working files; `foundation-committed` checks the committed snapshot; `workflow-check` contains isolated fixture profiles/screenshots. They contain no delivered application changes and are not committed. Existing generated `dist` was rebuilt by validation.

## Validation evidence

Environment: Windows, Node 24.18.0, npm 11.16.0. The direct Node/npm CLI was used because the documented npm shim is unreliable on this machine.

| Check | Exact result and scope |
| --- | --- |
| Current-tree `node --test tests/*.test.cjs` | Exit 0; 137 passed, 0 failed. |
| Fresh current-tree dependency installation | `npm ci --no-audit --no-fund`, exit 0; 389 packages. No original lockfile changed. |
| Fresh current-tree `npm test` | Exit 0; 137 passed, 0 failed, 0 skipped. |
| Committed snapshot `npm ci`, `npm test`, `npm run build` | Separately exported `8f92363`: all exit 0; 120 tests passed, 0 failed; typecheck passed and Vite built in 14.52 s. This confirms the checked-in workflow commands also work without the user's uncommitted upgrades. |
| Current and fresh-copy `npm run build` | Exit 0 for both; TypeScript `tsc --noEmit` passed, followed by Vite build. Fresh build 16.39 s. |
| Typecheck | Passed within both production builds; no separate typecheck script exists. |
| Lint / formatting | No configured lint or format script. Not reported as passing. `git diff --check` and staged whitespace checks passed. |
| Native `electron desktop/workflow-smoke.cjs` | Waited process exit 0, result `passed:true`; all 21 checks passed. Production UI uses controlled IPC and isolated profile; no real provider call. Screenshot inspected. |
| CI static validation | YAML parsed with existing `js-yaml`; PR trigger, Windows runner and npm install/test/build commands verified. Official action SHAs resolved. No hosted run or branch protection claim. |
| Documentation | 14 local Markdown links checked, none missing before this report; foundation diff reviewed and targeted credential-pattern scan found no matches. |
| Preservation | SHA-256 comparison of all 32 initially modified/untracked user files: zero changed. |
| Independent review | One state-transition finding corrected; no runtime rewrites, fake integrations, new dependencies or unsafe migrations found. |

The UI fixture covers snapshot races, family search, specialist/duplicate approvals, drafts, failed/duplicate starts, lazy tools, folder boundaries, editor load, reconciliation, inbox, compact layout, island navigation, startup retry, late launch navigation and dirty-buffer preservation. Its intentional connection-unavailable error is a tested recovery case, not a failed run.

Warnings: existing 3.35 MB CodeEditor output exceeds the configured chunk warning threshold; build succeeds. npm reports deprecated `boolean` and four packages with install scripts not yet covered by its allowScripts policy. Installation/tests/build succeeded without approving additional scripts. These are pre-existing dependency/toolchain warnings; this foundation does not silently change dependency or install policy. No packaging, installed-app replacement, account-dependent provider smoke, live PR flow or production deployment was performed.

## Git and remaining decisions

Branch: `codex/sunny-architecture-foundation`, based on `27c5fa6`. Foundation commit: `8f92363` — “Establish Sunny HQ architecture and development foundation”. This report is recorded in a separate “Document Sunny HQ foundation validation report” commit; its exact ID is in the final response and `git log`. No push, merge, PR or deployment was performed.

The original 32 changed files remain uncommitted and byte-for-byte preserved: `.gitignore`; `Launch Sunny.cmd`; `Open Morgans Update.cmd`; `README.md`; `desktop/captain-smoke.cjs`; `desktop/hub.cjs`; `desktop/main.cjs`; `desktop/recovery-smoke.cjs`; `desktop/smoke.cjs`; `package-lock.json`; `package.json`; `src/App.tsx`; `src/components/Chrome.tsx`; `src/useSunny.ts`; `src/views/DashboardViews.tsx`; `src/views/Workbench.tsx`; `Review Sunny Upgrade.cmd`; `desktop/broadcast.cjs`; `desktop/preview.cjs`; `desktop/workflow-smoke.cjs`; `docs/2026-09-12-workflow-package.json`; `docs/ACTIVATION-0.11.0.md`; `docs/SUNNY-HQ-IMPROVEMENT-RESEARCH-2026-09-13.md`; `docs/SUNNY-HQ-PROMPT-PACK.md`; `docs/WORKFLOW-UPGRADE.md`; `src/components/TerminalPane.tsx`; `src/taskFlow.ts`; `src/useDraft.ts`; `src/views/HomeView.tsx`; `src/views/home.css`; `tests/task-flow.test.cjs`; `tests/upgrade.test.cjs`.

Genuine open choices: a separate pixel-reference sheet was not located, so existing artwork anchors governed this pass; a future unified pixel conversion needs an explicit art decision. OpenClaw/Jev adoption depends on measured benefit after the baseline workflow. Claude installation depends on a real second-worker need. Required branch protections can be selected after hosted CI proves its check name. None prevents completion of this local foundation.

## Exactly five next issues — not started

The [five complete proposals](agent-platform-roadmap.md#exactly-five-next-issues-proposals-not-started) each contain Goal, Why now, Scope, Acceptance criteria, Suggested Agent Role, Dependencies and Risk Level, ordered by dependency:

1. Validate mission and approval commands at the desktop boundary.
2. Add minimal Mission and Attempt evidence to current task families.
3. Complete one Codex Build Feature mission through a reviewable PR.
4. Open a project room onto the real mission lifecycle.
5. Compare Jev routing and OpenClaw runtime adapters in isolated evaluations.

These are documented proposals only; no issue execution or remote issue creation occurred.
