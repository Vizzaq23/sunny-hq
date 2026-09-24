# Agent routing and authority

Research established 2026-09-21; live model catalog rechecked 2026-09-23. The existing `desktop/model-routing.cjs` live-catalog validation remains the running implementation. This document defines the next boundary; it does not claim new providers are connected.

## Role bindings

| Stable role | Preferred binding | Current/fallback | Risk | Approval |
| --- | --- | --- | --- | --- |
| Coordinator | Fable 5.1 preference | Existing Luffy/Codex coordinator; account catalog | Routine planning; high if it dispatches consequential work | Cannot authorize external actions |
| Planner | Fable 5.1 preference | Nami/Codex, supported general model | Low/routine | Local plans automatic |
| General reasoning | GPT-6 Sol for work needing judgment; GPT-6 Luna for routine, well-scoped tasks | Exact model/effort must come from the live Codex catalog | Routine reasoning | Depends on action, not model |
| Builder | Codex now; Claude Code optional | Franky/Codex; stop if no capable worker | Local scoped writes routine | Human for consequential external steps |
| Architecture/review | GPT-6 Astra preference | Zoro/Codex; human when unavailable | High uncertainty | Review is evidence, never authorization |
| Research | Supported reasoning model | Robin/Codex | Read-only low; sources untrusted | No external communications by default |
| Visual design | Opus/Fable preference | Sanji/Brook with available tool | Local art routine | Human for publication/spending |
| Vision inspection | Gemini vision-class preference | Human or verified available vision tool | Read-only evaluation | No new data transfer by default |
| Validator | Deterministic tests/CI first | Usopp/Codex for investigation | Routine isolated checks | Production probes need authorization |
| Decision router | Rules first; Jev candidate | Existing catalog policy and planner | Semantic uncertainty varies | Never approves consequential actions |
| Operator | Jinbe with bounded tools | Human | High external consequences | Explicit action-bound human approval |
| Captain | Human | None | Final authority | Merge/deploy/spend/publish/delete/credentials |

Fable/Opus/Gemini bindings remain preferences until the selected runtime reports usable IDs/capabilities. Do not silently substitute an unavailable explicitly requested model.

### Live Codex catalog check — 2026-09-23 UTC

A read-only `model/list` request through the installed, signed-in Codex app-server returned visible `gpt-6-astra` (default), `gpt-6-sol`, and `gpt-6-luna`, along with GPT-5.6 models. Sol and Luna therefore already appear in Sunny's Settings selector and Luffy's delegation catalog; no hard-coded model list or API-key integration is needed. The returned reasoning choices differed by model: Sol included `ultra`, while Luna did not. Sunny validates the exact selected ID and effort against the current catalog before dispatch, so availability remains account/runtime-dependent. This check did not start a provider task or incur a model turn. No `.env` file or Jev key was read. OpenAI's current [model guidance](https://learn.chatgpt.com/docs/models) recommends GPT-6 Sol for complex coding and agentic workflows, and GPT-6 Luna for focused, repeatable, high-volume work. Its [pricing guidance](https://learn.chatgpt.com/docs/pricing) says ChatGPT Work and Codex share pricing, credits and usage limits. These recommendations guide model choice but neither increase quota nor change Sunny's action/approval rules.

## Routing order

1. Validate project, attempt, capability, checkout ownership and permission profile in code.
2. Apply deterministic rules for explicit role requests, exact tool eligibility, budgets, deadlines and mandatory approvals.
3. Use semantic classification only when rules cannot determine a useful role. Candidate set includes `abstain`; a model cannot invent an executable tool or model ID.
4. Use a supported capable model for normal reasoning; escalate ambiguous/high-impact design to the architecture reviewer. Human authority is separate from reviewer confidence.
5. Before execution recheck the attempt revision, permission and any action-bound approval. Reject stale decisions. Record the decision source, version, selected candidate, evidence reference and outcome.

## Jev: verified primary-source findings

[TypeSafe's API](https://docs.typesafe.ai/api) accepts `POST https://api.typesafe.ai/v1/systemone` with Bearer authentication, `state`, typed `questions` and an optional model. Choice returns a chosen option and distribution; Score returns an ordered-level score; Noul returns a yes probability. Choice/Score include confidence; Noul does not. This is a hosted decision model, not a coding worker or orchestrator. No local model distribution was established in the reviewed docs.

[JavaScript SDK](https://docs.typesafe.ai/sdk/javascript): `@typesafe-ai/sdk`, Node 20+, ESM/CommonJS/TypeScript, `TypeSafeClient.systemOne` and typed question helpers. Python is also documented. Keys belong in the main process, never a Vite environment variable exposed to the renderer. Official docs link SDK source at [typesafe-ai/typesafe-sdk-js](https://github.com/typesafe-ai/typesafe-sdk-js).

[Model documentation](https://docs.typesafe.ai/models), inspected directly: `jev-1.13.0`, $0.042 per million input tokens, no output-token charge; published limits 250,000 tokens/second and 1,200 requests/minute, explicitly subject to change. Budget is 64k total request tokens and 32k for state plus the longest question. Questions share state. Responses report token usage; no claim that requests consume zero tokens is valid. English is the strongest documented language; other languages require evaluation. Pin model version and record the returned version. No paid calls, account creation or SDK installation were performed.

[Confidence](https://docs.typesafe.ai/confidence) is derived from the response distribution, not proof of correctness or authorization. Do not copy universal 0.5/0.9 thresholds from examples. Calibrate against Sunny-labelled tasks and cost-weighted error outcomes. High confidence never skips a required human gate. [Known limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13) include literal interpretation, arithmetic/date comparison, indirection, irrelevant context and adversarial inputs. Numeric rules remain code. Vendor throughput and social speedup claims are not Sunny end-to-end latency measurements; no independent uptime/SLA or production reliability result was established here.

### Picture-guided engineering lanes — 2026-09-24

An optional, separately flagged decision now classifies a selected project's next task brief as NOT_ENGINEERING, SMALL, MEDIUM, HIGH or ESCALATE before `turn/start`. SMALL/MEDIUM/HIGH request Luna low/medium/high; ESCALATE requests Sol high. The live catalog must support the exact model and effort. Explicit execution choices win; unavailable or low-confidence decisions leave the existing route in place and display a fallback. The classifier sees the bounded current brief, not the repository, and cannot authorize actions or certify completion. Its three-second read-only deadline never triggers a worker retry. See [activation and data scope](jev-integration.md).

The worker receives a fixed instruction to inspect real repository state and diff, run relevant deterministic checks, and report failures. HIGH and ESCALATE request fresh Sol High review before mission COMPLETE, but this prompt alone cannot prove the review happened. Coordinator missions already have an ordered reviewer stage; the mission board's actual check artifacts and human acceptance remain the authority. Direct conversations still end as provider turns, not accepted missions. Because a second Jev call adds latency, token use and data transfer with no measured Sunny benefit, `SUNNY_JEV_ENGINEERING_ROUTING` stays off by default under the captain's “only benefits” direction. Evaluation on representative tasks is required before default activation.

## Earlier adapter proposal and evaluation boundary

The foundation proposal called for decisionId, attemptId, stateRevision, a sanitized brief, permitted candidates, a deadline and policy version. The implemented optional decision uses the current task-preparation revision and project guard, a bounded brief, current catalog candidates and a three-second deadline. It records selected lane or fallback in task activity without a new persistence schema. Only prevalidated model/effort pairs are applied. Timeouts, malformed results, stale task state and missing credentials do not start a second worker turn. The proposed richer decision record and cross-attempt evaluation are still future work.

Evaluate on synthetic or explicitly approved redacted tasks. Compare rules, existing captain routing and Jev on held-out examples. Measure role correctness, unsafe false-allow rate, abstention coverage, p50/p95 latency, actual tokens/cost, stale result rejection and end-to-end task quality. Enable by default only if it materially improves quality or cost without weakening permissions.

## Claude Code evaluation

Not found on PATH or at `%USERPROFILE%\.local\bin\claude.exe`. No installation was needed for this foundation: existing Codex already supplies the first worker path. [Official setup](https://code.claude.com/docs/en/setup) documents native Windows support, Git Bash and native installer/WinGet routes; the stable PowerShell installer is hosted at `https://claude.ai/install.ps1`. Review the downloaded installer and published integrity checks before execution rather than piping an unknown script into a shell. Authentication requires a supported Claude account or provider credentials; no subscription purchase or credential setup was performed.

Potential value: an independent implementation/review worker for cross-provider evaluation and fallback. It overlaps with Codex on files, commands and coding tasks. Both are useful only if actual task quality, availability or independent review merits maintaining two integrations. A future adapter must test cancellation, tool permissions, streamed events, recovery and authentication separately; a successful CLI launch alone is insufficient.

The inspected setup requirements are Windows 10 1809+/Server 2019+, 4 GB RAM and x64/ARM64. Git Bash is optional in current documentation, with PowerShell fallback; native Windows does not provide Claude Code's native OS sandbox. Do not treat Windows support as a sandbox guarantee. These requirements and available account plans should be rechecked at installation time.

## Implemented mission routing (2026-09-21)

The mission board now uses stable role IDs through `desktop/mission-roles.cjs`. The selected capability, crew/provider binding, reason and policy version are saved before dispatch and shown on each attempt. Codex is the only connected implementation; unsupported provider bindings reject, not fallback silently. This supplements the live model/effort selector and existing read-only coordinator's six-assignment sequential delegation limit. Scoped mission context includes objective and acceptance criteria without the full saved ledger. Automated semantic role choice, provider configuration UI, guaranteed planner/reviewer stage enforcement and Jev evaluation remain future work; explicit role selection is not evidence of those capabilities.

New coordinator-led mission attempts now enforce ordered plan/work/validate/review stages at the Captain tool boundary (workflow version 1). Each requires a finished child task with a provider result. Early coordinator completion fails the attempt with the missing-stage explanation. The board projects real stage/task references. This supersedes the earlier future-work note about stage enforcement for newly created coordinator attempts only. Agent text remains attributed output, not proof of correctness; local checks and human criteria review still matter.

## Live worker verification (2026-09-21)

Sunny's actual Codex app-server adapter has now completed one bounded builder mission in an isolated local Git repository. The signed-in live catalog selected the default gpt-6-astra model through existing efficient routing. The provider repaired an intentionally failing implementation; unchanged tests then passed through Sunny's evidence collector, with exact branch/source evidence and durable WAITING_FOR_REVIEW. See [the recorded result](evidence/live-mission-2026-09-21.json). This establishes one live worker path; multi-agent handoffs and GitHub integration remain separately unverified live. No alternate providers were connected or represented as available.

Live coordinated verification subsequently completed all four mission stages through the actual Sunny delegation tool (planner, builder, validator, reviewer), with distinct provider task/result IDs. [Evidence](evidence/live-coordinated-mission-2026-09-21.json). The coordinator selected available models from the live catalog and the mission remained awaiting review. Project journal retrieval now filters by exact project before relevance ranking, and specialists receive their own role brief/task ID instead of coordinator instructions. These changes retain bounded, attributed recall without a new memory service.
