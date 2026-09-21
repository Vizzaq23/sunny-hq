# Sunny HQ implementation report

2026-09-21. Current implementation through `011ae4b`, including whole-branch review corrections and durable check/task recovery. Final combined native verification is recorded below. **The expanded master-PDF goal remains incomplete.** Sunny now has a real local mission and creative workflow, an illustrated interactive project interior, and source-bound review controls. Actual authenticated PR publication, hosted CI and approved merge remain outstanding. GitHub CLI sign-in and a live read-only deployment lookup are now verified (see the checkpoint below). Nothing here claims an installed-app upgrade or production release.

This report supersedes the foundation report as the current implementation summary. The [foundation report](SUNNY-HQ-CODEX-REPORT.md) remains dated historical evidence. The [33-page audit](master-goal-audit.md) is the requirement index; the [implementation plan](living-missions-plan.md) contains detailed checkpoint records. Every created/modified file and its purpose is in the [file ledger](implementation-file-ledger.md).

## What the captain can do now

Open the existing island, enter a registered project's illustrated quarters, move the captain on the clear floor, and open its mission board by walking or direct control. Create an objective with explicit criteria, select a stable crew role, prepare a local branch and start real Codex work. Coordinator missions enforce sequential planner, specialist, validator and reviewer results. The room projects authoritative activity into crew travel, working frames, attention labels and task inspection. Waiting, failure and connection uncertainty do not animate as productive work. App/system reduced motion retains usable controls.

Inspect attempts, source fingerprints, real local npm checks, PR/check observations, written outputs and PNG previews. Current-attempt project health suggests the next useful action. Saved transponder receipts track awareness without authorizing anything. File changes invalidate recorded review; later source evidence can mark checks stale. A finished provider turn means ready for review, not mission completion.

PR publication has a concrete expiring preview and explicit confirmation; uncertainty must be reconciled before retry. Merge review opens the exact GitHub PR for the captain; Sunny verifies the resulting merge instead of submitting it automatically. GitHub deployment inspection is read-only and source-bound. Publication and merge paths have synthetic transport coverage; the deployment reader has additionally completed a live authenticated empty-result lookup. A full authenticated PR voyage remains outstanding.

Brook's live creative mission used the installed provider's built-in image tool to generate an original PNG, record its exact prompt/source, and pass Sunny's native preview/hash/persistence boundary. The selected original-image workflow is real. No audio/video provider, broad media catalog or commercial rights guarantee is implied.

The existing ship, island, companion, task workbench, journals, local jobs, manual Morgans briefings and user upgrades remain. The room is one illustrated, bounded interior; seamless island-to-room walking, general furniture pathfinding and every future project analytics panel are not implemented.

## Reference research and adoption

All five supplied references were inspected through logged-in browser access during the foundation work. Full posts, available context and rendered media frames informed the decisions. Complete audio/video analysis is not claimed. The separately mentioned pixel-art sheet was not located; the existing Chopper/crew assets governed art decisions. See [reference review](REFERENCE-REVIEW.md) for access and evidence limits.

| Reference | Demonstrated idea | Decision and implementation |
| --- | --- | --- |
| [Sonia](https://x.com/s0n_ia/status/2101325466313367697?s=46) | Visible specialist desks and activity in an agent office | Adopted state-backed stations, crew roles and attention. Trading-profit/replacement-cost claims were not verified or used as success criteria. |
| [Nozelcode](https://x.com/nozelcode/status/2101687753503096880?s=46), [Chat On Steroids](https://github.com/totec448-spec/chat-on-steroids) | Local tools and durable working context | Adopted project-scoped attributed context; retained supported Codex execution. No quota-multiplication or browser-chat runtime dependency. |
| [Ricker/Jev](https://x.com/0xricker/status/2101705843200721203?s=46) | Separate structured routing from generation | Deterministic eligibility and role routing now; optional measured semantic decisions later. Confidence never grants authority. |
| [Avid](https://x.com/av1dlive/status/2100625342520262709?s=46), [Union Crew](https://github.com/codejunkie99/union-crew) | Separate orchestration and specialist workers | Implemented bounded sequential crew handoffs with actual results; retained replaceable bindings. Did not install its unverified full orchestration stack. |
| [Professor Glitch](https://www.tiktok.com/@pro.glitch/video/7684994524959001869) | Scoped workers, handoffs, boards, rules and schedules | Adopted scoped briefs, durable attempts and controlled local jobs. Folder separation is not represented as a security sandbox. |

Independent primary-source research covered [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [OpenClaw architecture](https://docs.openclaw.ai/concepts/architecture), [OpenClaw security](https://docs.openclaw.ai/gateway/security), [TypeSafe API](https://docs.typesafe.ai/api), [Claude setup](https://code.claude.com/docs/en/setup), and the experimental [continual-memory repository](https://github.com/codejunkie99/continual-memory-policy-model/tree/8977cc46865b09c91a39318387d4940e7eeb79a0). These supported retaining the smallest working architecture, narrow context and explicit evaluation gates.

## Runtime, provider and observability decisions

**OpenClaw:** Existing local version `2026.9.5 (ec9c1a1)` was found; no gateway, onboarding, channels or replacement runtime was activated. Its documented sessions/providers/tools/schedules could replace commodity plumbing later. Sunny retains mission acceptance, crew/world identity, project state and captain authority. Reconnect/event gaps, scopes, permissions and lifecycle must be tested before adoption. The [ownership evaluation](openclaw-evaluation.md) classifies capabilities as SUNNY_OWNED, OPENCLAW_OWNED, SHARED or NOT_NEEDED. No migration benefit has yet justified adding a second running control plane.

**Jev/TypeSafe:** A hosted structured-decision API, not a coding model. The inspected API is `/v1/systemone`; SDK `@typesafe-ai/sdk`; Choice/Score/Noul answer bounded questions. The [routing research](agent-routing.md) records the dated `jev-1.13.0` pricing, token limits, confidence semantics and limitations. Those vendor figures are not measured Sunny cost/latency and must be rechecked before paid use. No API key, paid call, SDK dependency or benchmark was introduced. Rules remain preferable for exact eligibility and permissions. Optional shadow evaluation must include abstention, unsafe-allow rate, stale responses, real usage and end-to-end value.

**Claude Code:** Not found in the checked PATH/user-local locations and not installed. It could supply an independent builder/reviewer or fallback, but overlaps substantially with the now-live Codex path. Official Windows setup/security/authentication findings are in the routing document. Installation alone would not establish usable cancellation, recovery or sandbox behavior.

**Codex and media:** The installed app-server is the actual worker runtime. Model IDs are selected from its live catalog. Recorded live coding, four-stage coordination, written creation and built-in image generation succeeded through Sunny. Other named model/provider preferences remain replaceable candidates, not connected services. Existing account access/quota was used; no new subscription or API purchase was made.

**Observability:** Existing local diagnostics, task errors, mission history, evidence timings and source identities are retained. Sentry/PostHog were evaluated as later options; no telemetry SDK or external capture was enabled. A saved deployment success is not continuous site health. Local schedules remain bounded and captain-controlled; they do not authorize unattended publication or spending.

## Architecture and roles

```text
Captain / illustrated world / mission board / workbench
                     ↑ projections, never backend authority
Renderer → isolated preload → validated main-process commands
                     ↓
Hub: projects, missions, attempts, checkout reservations, approvals
  ├─ stable role selection → live model catalog
  ├─ coordinator → planner → specialist → validator → reviewer
  ├─ existing Codex app-server → scoped provider tools
  ├─ local Git/npm + bounded GitHub observations/publication intent
  └─ written/PNG artifact identity + explicit captain criteria review
                     ↓
Versioned saved state, bounded events, attributed project context
                     ↓
Captain-authorized external action → observed result → acceptance
```

| Role / crew | Current binding | Preferred/fallback and authority |
| --- | --- | --- |
| Coordinator / Luffy | Codex, live catalog | Fable is a preference; stop when no valid model. Plans/dispatch cannot authorize external consequences. |
| Planner / Nami | Codex | Supported planning model; routine local plans. |
| Builder / Franky | Codex | Claude/other worker only after a real adapter; scoped local edits, captain for external consequences. |
| Reviewer / Zoro | Codex | Astra preference when available; review is evidence, never permission. |
| Validator / Usopp | Existing checks plus Codex | Deterministic checks first; no invented CI or unauthorized production probe. |
| Researcher / Robin | Codex | Read-only source work; untrusted sources cannot change policy. |
| Designer / Sanji | Codex | Opus/Fable preference unconnected; original art/UI review rules apply. |
| Diagnostician / Chopper | Codex | Bounded investigation; sensitive remediation retains approval. |
| Creator / Brook | Codex with available built-in image tool | Live written/image output verified; no silent paid fallback. |
| Operator / Jinbe | Codex | Prepare and inspect; deployment, billing and publication remain captain actions. |
| Router | Deterministic code | Jev optional; no confidence-based authorization. |
| Captain | Human | No substitute for consequential approval. |

Exact risks and proposed fallbacks are in the [role table](agent-routing.md#role-bindings). General reasoning prefers Sol and hard architecture prefers Astra when actually available. Role selection is explicit; the app does not claim automatic semantic classification of every mission.

## Mission, state, events and context

Version1 missions retain ID/project/title/objective/criteria, completion boundary, revision, times, task IDs, durable attempt history, artifacts, events and seen receipts. A new attempt is recorded before provider submission. Unknown work keeps checkout ownership until reconciled. Invalid saved versions fail visibly instead of silently deleting history.

The normal mission path is DRAFT → RUNNING → WAITING_FOR_REVIEW → COMPLETE, with attention/failure/cancellation outcomes and separate connection reconciliation. Tasks preserve starting/working/waiting/unknown/finished/failed/interrupted. Planning, reviewing and validating visual labels require recorded stage/role evidence; character identity alone does not invent them. Earlier attempts cannot borrow a newer completion.

Persisted activity includes mission creation/start/outcome, stage/assignment progress, test start/pass/fail, Git/PR observations, deployment inspections, deliverable attachment, acceptance and signal receipts. Provider image-tool start/completion appears as bounded task activity without copying image payloads or revised prompts. This implements the relevant current vocabulary, not every hypothetical DEPLOY_STARTED or future runtime event in the PDF.

Context follows project → mission → assigned task/role. Retrieval filters exact project before relevance; structured briefs preserve all supplied criteria within declared limits and reject oversize input. Journals and results are attributed artifacts, not trained memory. No giant shared transcript or embedding service was added.

## Security, persistence and rollback

Electron retains context isolation, sandboxed renderer, no renderer Node integration and validated trusted-frame IPC. Approval IDs bind exact requests, task/project/thread/turn/execution and expiry; stale/reused replies fail. Consequential merge/deploy/billing/messages/publication/credentials remain human decisions. Local checkout reservations do not control unrelated external editors or constitute a full OS tool sandbox.

File review rejects traversal, protected paths, link/hard-link aliases, Windows short-name syntax (tilde-bearing components), size violations and detected changing reads. Use full names without tildes. Text is plain UTF-8. PNG input is bounded to8MiB/4096×4096, with bounded chunks, no APNG, and ancillary metadata removed before native decoding. Saved artifacts hold identity/notes rather than image bytes; explicit preview and acceptance recheck originals. Declared source/usage is not copyright verification.

PR/check evidence belongs to repository/branch/commit/source and current attempt. Expired intent, changed source and uncertain submission cannot be treated as success. GitHub deployment GETs collect bounded validated observations and never deploy. Secrets remain outside renderer-facing evidence.

Back up the current profile before installing a version with mission data. Rollback requires the pre-upgrade backup; do not let an older app save upgraded mission state or casually open an upgraded Chromium profile with an older Electron. No daily profile was migrated by these checks.

Unknown project checks now checkpoint an execution marker before dispatch and retain checkout reservations across restart. Captain confirmation is bound to the exact check/revision, rejected during a pending call, and saved as failed evidence before releasing the reservation; a fresh successful check is required. Older local tasks lacking a saved provider thread have a separate exact-task confirmation, with launch/descendant checks and durable interrupted outcome. Both are explicitly human attestations, not automated process verification. Provider dispatch checkpoints thread/execution identity before a turn; completed stages cannot receive unreviewed follow-ups, delayed starts cannot resurrect terminal tasks, and acceptance binds the reviewed PR target branch. PR publication records are archived on a new attempt while uncertain publication still blocks retry.

## Installed tools and validation

Installed the official portable GitHub CLI2.101.0 in the user-local Programs directory, with archive integrity verified; no PATH/admin/credential change. The captain subsequently authorized browser sign-in and completed authentication as Vizzaq23, verified using `gh auth status`; credentials are stored in the OS keyring. The connected Codex GitHub connector is a separate authentication surface and its token was not copied.

Pinned project Electron44.4.3 and lockfile to remove the two previously reported high-severity runtime/archive advisories. The recorded audit returned zero known vulnerabilities at that checkpoint. Native SQLite/ConPTY and unsigned unpacked Windows packaging passed. No installer, signing, deployment or daily-app replacement occurred. No OpenClaw/Claude/Jev/telemetry dependency was added. See [runtime verification](electron-runtime-upgrade.md).

| Evidence | Result and practical scope |
| --- | --- |
| Latest full working-tree Node suite |295 passed,0 failed,0 skipped at the `011ae4b` audit; includes preserved user overlay. |
| Latest exact staged-source Node suite |278 passed,0 failed,0 skipped; excludes unrelated user files. |
| Latest renderer build/typecheck | Working build14.46s; exact-source build14.13s; `tsc --noEmit` passed. Exact-source Workbench includes the verified scroll-effect correction. |
| Native illustrated journey | Exact-source full/narrow600px, keyboard, crew working/waiting/reduced motion, review/evidence, persistence/reload passed; screenshots inspected. |
| Final combined native journey | Isolated run `1790024428383` passed coordinated plan/work/validate/review, working/waiting/reduced motion, unknown/failed attention, missing-thread and uncertain-check confirmation, PR/merge-review UI, real Git/npm, written/PNG review, signals, persistence and reload. Provider/GitHub responses are synthetic. |
| Additional attention review | `.sunny-dev/mission-check/1790022998219`: unknown and failed crew labels/inspection/no-animation passed; both screenshots inspected. Full coordinated native fixture also passed. |
| Live builder / coordinated missions | Actual source repair and real tests; four actual planner/worker/validator/reviewer results. [Evidence](evidence/live-coordinated-mission-2026-09-21.json). No remote PR or acceptance. |
| Live written creator |227-word file, three headings, hash-matched review/persistence; wording caveat recorded. [Evidence](evidence/live-creative-mission-2026-09-21.json). |
| Live image creator | Actual built-in generation events, original1254×1254 PNG, prompt/source/hash and native preview/persistence. [Evidence](evidence/live-visual-mission-2026-09-21.json). Proportion deviations await review. |
| Dependency/packaging checkpoint | Clean locked install; audit0 known vulnerabilities; Electron44 SQLite/PTY and unsigned unpacked app verified. Exact dated scope in runtime note. |
| CI | Workflow defines Windows Node24 `npm ci`, `npm test`, `npm run build`; local commands verified. Hosted execution and enforced branch rules unverified. |
| Lint/format | No configured scripts. Whitespace checks passed; no invented lint result. |
| Review | Whole-branch review found concrete defects; `61393d8`, `d405d53`, and `011ae4b` correct them with regression tests. Follow-up lifecycle/security reviews and final scoped audit found no additional material gap. This is not a guarantee of absence of all defects. |

Native provider/GitHub fixtures are deliberately synthetic; local Git/npm/files/UI/persistence are real. Separate live runs establish the specific provider paths only. Existing large CodeEditor bundle warning remains. New test success does not retroactively prove every previous live run exercised later source.

The [local completion manifest](evidence/local-completion-2026-09-21.json) records the exact source commit, current test totals, build outcomes, combined native result and external gate. It is a local verification checkpoint, not a completed-goal claim.

## Git and ownership

Current branch `codex/sunny-living-missions`, original base `27c5fa6`. Commits: `8f92363` foundation, `4692b84` foundation report, `e2275f4` mission/evidence services, `b44f4f0` mission/room components, `b22f9b2` integrated workflow, `9f3f017` audit/live evidence, `af80e71` runtime patch, `41deaf8` deployment observation, `fa47c9a` image review, `dfeed95` illustrated room, `74c4c81` live visual workflow. Subsequent commits: `61f0a06` implementation report, `61393d8` review boundaries/dispatch checkpoints, `d405d53` durable uncertain-check recovery, `011ae4b` missing-thread recovery and native conversation fix. This audit refresh is a later documentation commit.

Rechecked original32-file hashes at this audit:25 remain byte-identical. Seven documented overlaps are `desktop/hub.cjs`, `desktop/main.cjs`, `src/App.tsx`, `tests/upgrade.test.cjs`, `package.json`, `package-lock.json`, and now `src/views/Workbench.tsx` for the recovery component. The original baselines remain preserved. Saved baselines and explicit path/hunk staging preserve ownership. The working package retains the user's0.11.0 version; committed metadata remains0.9.0. Unrelated Home/workbench/launch/news upgrades remain unstaged/untracked. No blanket cleanup, push, PR, merge or production deployment was performed.

## Remaining gates and exactly five next proposals

The current implementation is reviewed and verified locally. Full completion still requires actual authorized GitHub/CI/merge proof. A live deployment lookup now confirms an empty result for the unpublished implementation commit. Whole-branch findings were fixed and independently rechecked; the final combined native journey passed. Any future change still requires its own verification. Browser CLI authentication is complete; publication and merge still require their own authority. The missing separate art-reference sheet and complete video/audio reference analysis remain evidence limits. Optional vendors are not mandatory installs.

These are current dependency-ordered proposals, not remote issues or automatic authorization of their external steps:

1. **Prove the authenticated coding voyage.** Goal: one real Sunny mission reaches a reviewable GitHub PR and passing hosted checks. Why now: local/live-worker paths are proven. Scope: captain-authorized CLI sign-in, exact source/branch preview, PR and CI observation. Acceptance: actual URLs/commit/check records; failed/uncertain outcomes remain visible; merge stays pending captain action. Role: operator/builder. Dependencies: account authorization and repository access. Risk: medium, remote publication.
2. **Verify captain-approved merge and deployment records.** Goal: close the first real voyage against remote truth. Why now: follows PR/check proof. Scope: captain merges through GitHub; Sunny rechecks exact merged commit and reads existing deployment records. Acceptance: identity/source match, acceptance evidence, honest empty/failed deployment state; no new deployment without approval. Role: reviewer/operator. Dependencies: proposal1 and explicit merge authority. Risk: high for merge, read-only for observations.
3. **Validate a release candidate against the daily workflow.** Goal: package and install only after approval with backup/rollback. Why now: Electron and mission data changed. Scope: clean signed release process, isolated upgrade/recovery rehearsal, final whole-diff/security review and captain acceptance. Acceptance: profile backup/recovery evidence, production UI checks, no user-data loss. Role: diagnostician/validator. Dependencies:1–2 and release decision. Risk: medium/high, installed data.
4. **Extend world navigation from measured use.** Goal: make project arrival and attention useful across the existing island/room boundary. Why now: one illustrated interior is established. Scope: evaluate actual captain friction, then one coherent navigation improvement. Acceptance: no delayed stop/approval, matching geometry/art, keyboard/reduced motion, normal/error screenshots. Role: designer/builder. Dependencies: release-candidate feedback and art bible. Risk: low/medium.
5. **Evaluate an optional routing/runtime replacement only for a demonstrated gap.** Goal: decide adopt/defer/reject from measured value. Why now: the baseline now has live coding/creative evidence. Scope: isolated Jev shadow decisions or OpenClaw lifecycle comparison, one justified question at a time. Acceptance: quality/abstention/latency/usage, security/recovery and maintenance comparison; no paid call or migration without authority. Role: researcher/reviewer. Dependencies: a concrete limitation from1–4, optional authorized credentials. Risk: medium.


## Preserved user overlay at report checkpoint

These existing files remain outside the implementation/report commit (M modified, ?? untracked):

```text
 M .gitignore
 M "Launch Sunny.cmd"
 M "Open Morgans Update.cmd"
 M README.md
 M desktop/captain-smoke.cjs
 M desktop/main.cjs
 M desktop/recovery-smoke.cjs
 M desktop/smoke.cjs
 M package-lock.json
 M package.json
 M src/App.tsx
 M src/components/Chrome.tsx
 M src/useSunny.ts
 M src/views/DashboardViews.tsx
 M src/views/Workbench.tsx
?? "Review Sunny Upgrade.cmd"
?? desktop/broadcast.cjs
?? desktop/preview.cjs
?? desktop/workflow-smoke.cjs
?? docs/2026-09-12-workflow-package.json
?? docs/ACTIVATION-0.11.0.md
?? docs/SUNNY-HQ-IMPROVEMENT-RESEARCH-2026-09-13.md
?? docs/SUNNY-HQ-PROMPT-PACK.md
?? docs/WORKFLOW-UPGRADE.md
?? src/components/TerminalPane.tsx
?? src/taskFlow.ts
?? src/useDraft.ts
?? src/views/HomeView.tsx
?? src/views/home.css
?? tests/task-flow.test.cjs
?? tests/upgrade.test.cjs
```

## Authenticated GitHub integration checkpoint — 2026-09-21

The captain completed the authorized GitHub CLI device login as Vizzaq23. Read-only repository verification confirmed private `Vizzaq23/sunny-hq`, default branch `codex/sunny-hq`, tip `2e266501d3222433e3c3bf08a279372fd27bea2a`. Its already-merged performance PR was integrated locally into an isolated clean clone, resulting in `651fbe1825ef2ecba0e21a9056688ed7f5247a92`. The App conflict resolution preserves the project room, mission board and navigation while retaining remote lazy loading and Suspense. The original workspace and its unrelated user edits were untouched.

A clean locked install reported zero known vulnerabilities. All 278 automated tests passed and build/typecheck passed (13.50-second Vite build; existing large CodeEditor warning). The production deployment reader authenticated against GitHub and returned zero deployments for the exact unpublished merge commit: [observation](evidence/live-github-deployment-2026-09-21.json). This proves authenticated read and honest empty handling, not a deployed environment. No token was copied into artifacts. No branch push, PR publication, remote merge or deployment occurred at this checkpoint.

The integrated native workflow also passed with process exit 0 in run `1790032831408`: coordinated stages, room motion/reduced motion, both uncertain-operation recovery paths, full/narrow room views, source-bound synthetic PR/merge/deployment review, deliverable previews, acceptance, signals and reload. The expected injected `Fixture uncertain cleanup` error exercised recovery and was not an unhandled renderer failure. GitHub/provider transport in this native check remains synthetic.
