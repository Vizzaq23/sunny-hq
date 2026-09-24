# Sunny HQ implementation report

## Latest local package — complete illustrated crew rooms — 2026-09-23 UTC

Sunny now has ten distinct original illustrated chat rooms, one per core crewmate. The production Electron workflow passed all 29 checks, all 328 Node tests passed, and TypeScript plus the production Vite build passed (with the existing large CodeEditor chunk warning). Packaged smoke passed all native groups; each of the ten PNGs was byte-matched inside `app.asar`. The updated 0.11.0 app is active at `.sunny-dev/validated-release-ten-crew-rooms/win-unpacked/Sunny HQ.exe`. Before switching, 58 profile files (65,064,544 bytes) were copied and every SHA256 verified. The existing 60 task records remain, with no nonterminal task. No live provider task was started. Exact package, screenshot, art and backup evidence is in [the ten-room record](evidence/ten-crew-rooms-2026-09-23.json). The master PDF goal remains incomplete: collision/pathfinding, complete reference-media review and captain acceptance remain open.

## Current launcher/process reconciliation — 2026-09-23 UTC

The present `Launch Sunny.cmd` points to `.sunny-dev/validated-release-ten-crew-rooms`, while Sunny processes observed in this session run from `release-workflow-0.11.0`. A separate room-audio activation record proves a packaged smoke and launch of `.sunny-dev/validated-release-crew-room-sfx`, but that is not the current launcher target. The records do not establish which source revision the currently running workflow package contains. Preserve the existing launcher and profile; do not claim the room-audio candidate is the active daily app until package identity and current task state are reconciled. The fresh Node suite/build below verify source, not the installed package.

## Current verified update — 2026-09-23 UTC

The production renderer passed all 21 checks in the isolated Electron workflow fixture, and the full Node suite passed (324 passed, 0 failed, 0 skipped). The fixture covered Home search/navigation, project and task drafts, approval/start deduplication, recovery, file navigation and editor safety, the island view, compact layout, and delayed-response races. Its editor check now waits for the complete rendered fixture line before capture. [Exact evidence and artifact hashes](evidence/daily-workflow-smoke-2026-09-23.json). Tests used synthetic IPC and a blank TypeSafe key in the test process; they did not read an `.env` file or API key value, call Codex, write user project files, or verify the active user's profile. The packaged editor-save repeat is still partial as described below.

## Remote/runtime verification checkpoint — 2026-09-22 UTC

Read-only GitHub records confirm PRs [#2](https://github.com/Vizzaq23/sunny-hq/pull/2), [#3](https://github.com/Vizzaq23/sunny-hq/pull/3), and [#4](https://github.com/Vizzaq23/sunny-hq/pull/4) are merged. Their Windows test/build runs succeeded (`35667498997`, `35668947318`, `35673393083`), and post-merge run [`35673916172`](https://github.com/Vizzaq23/sunny-hq/actions/runs/35673916172) passed. Deployment inspection found zero records for the relevant merged implementation; no production deployment is claimed. Branch-protection settings were not verified.

The active process is running the unsigned local 0.11.0 package at `.sunny-dev/validated-release-gpt6-room-play` (app.asar SHA256 `4a7fdf99f80b6dd4ac7aaee7a3afb132058cc4889f2a638457a73f7e48c15460`). The 2026-09-22 native check passed its OneDrive cases but timed out before a temp save. A complete repeat on 2026-09-23 passed app-created and PowerShell-created file saves plus stale-write rejection in both OneDrive and Temp; see [the latest packaged evidence](evidence/packaged-editor-save-repeat-2026-09-23.json). The earlier intermittent block remains unexplained, but it did not reproduce in that repeat.

The expanded master-PDF goal remains incomplete. The full requirement-by-requirement status is in the [33-page audit](master-goal-audit.md).

## Crew workspace and librarian increment — 2026-09-23 UTC

All ten core crew chats now identify their station and use distinct, restrained static atmosphere. Robin's chat opens Sunny's Obsidian Library view; from a selected note the captain can prepare a Robin mission with note text as an unsent, revision-scoped draft. The prompt treats note contents as untrusted reference, asks Robin to propose changes and forbids automatic vault writes. Notes over 16,000 characters are blocked instead of silently truncated. The captain reviews the prompt before sending, and Robin's proposal stays in chat until the captain explicitly saves a revised note through the existing hash-checked library write. The production build and full Node suite passed (325/325); the Electron workflow fixture passed all 25 checks, including note search/read, Robin routing, note context, unsent state, draft isolation, size limit and no implicit task start. A screenshot, hashes and exact test result are recorded in [character chat-room evidence](evidence/character-chat-rooms-2026-09-23.json). Individual illustrated interiors and room sound are still open; the expanded PDF goal remains incomplete.

The env-locked 0.11.0 candidate is at `.sunny-dev/validated-release-crew-rooms-env-locked`; its packaged archive passed all native smoke groups in a unique isolated profile (app.asar SHA256 `45953B61CFAB3300F62D9966565D82A388CF69180F4F1402BE62A8A2D4103041`). Before switching, a verified 55-file/54,682,160-byte copy of `%LOCALAPPDATA%\Sunny HQ` was saved at `.sunny-dev/profile-backup-before-env-locked-rebuild-20260923` (SQLite SHA256 `782AF7067DF88F3799C10114351FB4ACA6182FAB79453157553E15397CFD5837`). `Launch Sunny.cmd` targets the new candidate, now running with the existing profile. No provider task was started during activation. Package, screenshot and backup evidence are recorded in the [chat-room test record](evidence/character-chat-rooms-2026-09-23.json).

## Island-control candidate — 2026-09-22

The 0.11.0 unpacked Windows candidate at `.sunny-dev/validated-release-island-controls` was built with electron-builder. Its packaged `app.asar` passed the complete native Electron smoke suite in an isolated profile. After a verified local backup, the old process set was closed and the updated launcher opened the candidate with the existing profile; the Home view showed 1 item needing attention, 0 in progress and 8 past tasks. No task was started through a provider. [Control screenshots, package hash, profile backup and exact checks](evidence/island-controls-2026-09-22.json).

2026-09-21 historical checkpoint. Implementation through `011ae4b`, including whole-branch review corrections and durable check/task recovery. Its final combined native verification is recorded below. At that checkpoint, authenticated PR publication, hosted CI, approved merge and live deployment-record verification remained outstanding; the 2026-09-22 section above supersedes those remote-status statements. **The expanded master-PDF goal remains incomplete.**

This report supersedes the foundation report as the current implementation summary. The [foundation report](SUNNY-HQ-CODEX-REPORT.md) remains dated historical evidence. The [33-page audit](master-goal-audit.md) is the requirement index; the [implementation plan](living-missions-plan.md) contains detailed checkpoint records. Every created/modified file and its purpose is in the [file ledger](implementation-file-ledger.md).

## What the captain can do now

On the Grand Line chart, optionally control any Straw Hat or recruited resident with arrows/W A S D or the on-screen direction pad. Drag to pan, explore up to 400% zoom, and use the island roster and direct work controls alongside movement. This only moves the illustration; jobs and mission state remain authoritative in the backend. This change is built and verified locally but has not been installed into the active profile.

Open the existing island, enter a registered project's illustrated quarters, move the captain on the clear floor, and open its mission board by walking or direct control. Create an objective with explicit criteria, select a stable crew role, prepare a local branch and start real Codex work. Coordinator missions enforce sequential planner, specialist, validator and reviewer results. The room projects authoritative activity into crew travel, working frames, attention labels and task inspection. Waiting, failure and connection uncertainty do not animate as productive work. App/system reduced motion retains usable controls.

Inspect attempts, source fingerprints, real local npm checks, PR/check observations, written outputs and PNG previews. Current-attempt project health suggests the next useful action. Saved transponder receipts track awareness without authorizing anything. File changes invalidate recorded review; later source evidence can mark checks stale. A finished provider turn means ready for review, not mission completion.

PR publication has a concrete expiring preview and explicit confirmation; uncertainty must be reconciled before retry. Merge review opens the exact GitHub PR for the captain; Sunny verifies the resulting merge instead of submitting it automatically. GitHub deployment inspection is read-only and source-bound. These GitHub paths have synthetic transport coverage, but have not completed a live authenticated voyage on this machine.

Brook's live creative mission used the installed provider's built-in image tool to generate an original PNG, record its exact prompt/source, and pass Sunny's native preview/hash/persistence boundary. The selected original-image workflow is real. No audio/video provider, broad media catalog or commercial rights guarantee is implied.

The existing ship, island, companion, task workbench, journals, local jobs, manual Morgans briefings and user upgrades remain. The island permits free player movement on its six-destination chart; collisions, route constraints, distinct illustrated physical interiors and room-specific sound effects are not implemented. Ten conversation screens now have distinct static room treatments, which do not replace those interiors. The project room remains one illustrated, bounded interior; seamless island-to-room walking, general furniture pathfinding and every future project analytics panel are also not implemented.

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

Installed the official portable GitHub CLI2.101.0 in the user-local Programs directory, with archive integrity verified; no PATH/admin/credential change. It is recognized but unsigned-in at the 2026-09-21 completion audit (`gh auth status` via its actual executable). The connected Codex GitHub connector is a separate authentication surface and its token was not copied.

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

The authorized GitHub voyage is verified through merged PRs #2–4 and passing hosted Windows checks. Deployment lookup returned no records; no production deployment is claimed. The latest 0.11.0 local package includes station-themed rooms, Robin/Obsidian review, room arrival sound and the env-file-safe Vite build. Full completion still requires a current captain review, complete source-reference analysis, individual illustrated character spaces and whole-world acceptance. The earlier Vite build may have parsed local env files internally; its guard and mitigation are documented above. Optional vendors remain conditional.

These are current dependency-ordered proposals, not remote issues or automatic authorization of their external steps:

1. **Review the live captain workflow and current mission evidence.** Goal: confirm the exact active package and inspect any revision-bound mission acceptance that actually exists. Scope: read-only live-profile walkthrough; no task starts and no inferred acceptance for missing records. Acceptance: package identity, displayed state and any exact mission/revision recorded accurately. Role: validator/reviewer. Dependencies: active package and captain availability. Risk: low.
2. **Complete the PDF reference review.** Goal: close the separate pixel-art-sheet and video/audio evidence gaps. Scope: locate the supplied sheet if it exists and inspect referenced media at a documented sample rate, keeping quoted claims attributed. Acceptance: asset provenance and source/time-coded observations recorded; unavailable material stays explicitly unresolved. Role: researcher/visual designer. Dependencies: actual source files/links. Risk: low.
3. **Build distinct illustrated character rooms and connected world travel.** Goal: move from station-themed chat panels to genuinely enterable character interiors and coherent navigation. Scope: derive a production sequence from measured daily use, reuse existing art/atlas contracts, then implement collision-safe routes and directly accessible room controls. Acceptance: each room fits its character/station, normal and reduced-motion states work, and work status remains backend-derived. Role: designer/builder. Dependencies: art references and captain review of the current map. Risk: medium.
4. **Exercise the real X-to-Sunny research handoff.** Goal: validate captured source provenance and the same-brief GPT-6 Sol/Luna comparison on a disposable test project. Scope: read-only X capture/import and two separate research tasks; no social actions or file changes. Acceptance: preserve source URL/date, model IDs, factual attribution, primary-source links and uncertainty. Role: researcher/validator. Dependencies: a captain-started test window and the signed-in feed. Risk: medium; uses account quota.
5. **Measure a concrete runtime gap before changing providers.** Goal: decide whether Jev, OpenClaw or another runtime fills a demonstrated limitation. Scope: compare quality/abstention, latency, recovery and maintenance from safe evidence; do not read `.env` or the Jev API key. Acceptance: adopt/defer/reject with evidence and no paid calls, credential change or migration unless separately authorized. Role: researcher/reviewer. Dependencies: results from proposals 1–4. Risk: medium.


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
Build-process incident: before the Vite env-file guard was added, an earlier `vite build` used Vite's default env-loading path, which may have parsed local `.env` files internally. I did not open or print any `.env` file, and no credential value was exposed in output or passed to an AI task. The Vite config now sets `envFile:false`; typecheck, clean Vite build, package build and packaged smoke were rerun with this guard in place. Do not interpret the earlier build as evidence that env files were never read.
## Crew-room arrival sound cues (2026-09-23)

All ten core crew rooms now have original short synthesized arrival signatures. The captain can turn them on in Settings and adjust the saved level from 0–65%, or mute immediately in the room header. The preference starts off. A cue can play when entering a room or changing specialists; messages and task state have no sound, so the atmosphere cannot imply work progress. This uses Web Audio only, with no audio download, package, or paid generation. Validation: 3 focused cue/player tests, all 328 Node tests, TypeScript, production Vite build, 26 Electron workflow checks, and the packaged Windows smoke (including settings IPC boundaries and rendered control attributes) passed. The candidate archive and profile backup are hash-recorded in [audio evidence](evidence/room-audio-2026-09-23.json); current daily-package identity remains unverified as described above. The wider PDF goal remains incomplete.

## Zoro's first illustrated chat interior (2026-09-23 UTC)

The initial Zoro-specific addition was expanded to a distinct illustrated room for each of the ten core crewmates. The generated scenes are static, decorative backgrounds at 19% opacity beneath the actual conversation. Native workflow validation confirms every assignment and image decode, decorative accessibility state, direct controls and Chopper reduced-motion rendering. Full Node tests: 328 passed; TypeScript/Vite build passed; Electron workflow: 29 checks passed. Packaged Electron smoke passed, and all ten images were byte-matched in app.asar. [ARTWORK.md](../public/assets/ARTWORK.md) records generated sources, descriptions and SHA256 values. Island collision/pathfinding and full world acceptance remain incomplete.
