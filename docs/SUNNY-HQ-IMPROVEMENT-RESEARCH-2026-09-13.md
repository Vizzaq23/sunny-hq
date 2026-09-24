# Sunny HQ: improve the workflow before expanding the farm

Research date: September 13, 2026. Scope: local source inspection, existing unit tests, and current primary-source research. This is a proposal, not an implemented upgrade. The accompanying prompt pack is ready for manual use: [SUNNY-HQ-PROMPT-PACK.md](SUNNY-HQ-PROMPT-PACK.md).

## Recommendation

Make Sunny excellent at completing one verifiable project milestone, then scale that proven workflow across independent projects. Start with compact handoffs and explicit acceptance evidence. Measure usable results, time spent reviewing, and reported usage before adding workers or increasing frequency.

Three approaches are available:

| Approach | Benefit | Tradeoff | Recommendation |
| --- | --- | --- | --- |
| Improve prompts and project checkpoints | Usable immediately with current Sunny | Consistency depends on agents following the contract | Start here |
| Add structured assignments, evidence and evaluation to Sunny | Makes the workflow visible and enforceable | Requires schema, persistence, UI and recovery changes | Next product increment |
| Build distributed workers and remote queues | Can expand capacity beyond one PC | Introduces worker ownership, isolation, integration and recovery complexity | Defer until measured demand justifies it |

These rankings are engineering judgments based on this checkout. No prompt A/B trial, performance improvement, revenue, or live account capacity was measured.

## What the current implementation establishes

| Area | Observed behavior | Evidence |
| --- | --- | --- |
| Coordinator | Luffy is read-only; uses `sunny_delegate`; children run sequentially; maximum six assignments per user message | `desktop/captain.cjs`, `instructions`, `delegate` |
| Specialists | Core crew are built in; Law, Ace, Vivi and Perona are catalog residents and require recruitment for delegation | `desktop/captain.cjs`, `desktop/island-residents.json` |
| Scheduling | One to three island jobs can run; overlapping project paths block concurrent work; global specialist capacity also applies | `desktop/island.cjs`, `canRun`, `setConcurrency` |
| Recovery | Unknown work blocks reuse; restart disarms scheduling; calls and linked results have duplicate/recovery handling | `desktop/captain.cjs`, `desktop/island.cjs`, reconciliation notes |
| Routing | Explicit model/effort choices are validated against the live catalog; when no model is chosen the selector uses the default/first visible model | `desktop/model-routing.cjs`, `selectExecution` |
| Completion | Provider turn completion sets task status to `finished`; Home labels this “Ready to review.” Job review advances the schedule | `desktop/hub.cjs`, completion event; `src/taskFlow.ts`; `desktop/island.cjs`, `review` |
| Context | Recall is bounded to ten selected memories and 6,500 characters; pinned notes rank first; same-project episodes receive a score boost | `desktop/growth.cjs`, `context` |
| Search | Home searches project names, task/child titles and crew IDs using one substring; it does not search transcript bodies | `src/taskFlow.ts`, `filterFamilies` |
| Starter prompts | Home supplies four short prefixes for build, fix, research and planning | `src/views/HomeView.tsx`, `starters` |

The island roadmap still contains older statements about a single running job. Current source and the newer README describe up to three. Future work should reconcile these documents so agents do not act on obsolete limits.

## Ranked improvements

### 1. A durable project checkpoint and explicit assignment contract

Today, the specialist receives the tail of the current user request plus Luffy's assignment. Journal recall can add earlier conversation excerpts. This preserves context, but long repeated briefs make it harder to identify the one next action.

Use one existing project checkpoint where available. Otherwise establish a small checkpoint containing the current objective, checkout path, accepted baseline, candidate changes, evidence, unresolved findings and next action. Pass only the relevant paths and a concise assignment to each specialist.

For the later product upgrade, store `objective`, `acceptanceCriteria`, `allowedPaths`, `contextReferences`, `baseline`, `dependencies`, `executionLimits` and `result` as structured fields. Keep status and links outside any clipped prose. A prompt asks for this discipline; a schema and validation can enforce it.

Acceptance example: after interruption, a new specialist identifies the current candidate and next unfinished criterion without repeating an accepted step. Test both dirty checkouts and repositories with no initial commit; a commit ID alone is insufficient.

### 2. Separate execution completion from accepted output

Preserve provider execution state and add an independent acceptance record. Suggested acceptance values: unreviewed, accepted, changes requested, blocked. Record who accepted which artifact revision and the evidence used. If relevant source changes, the earlier acceptance remains historical and the new candidate is unreviewed.

The current UI already says “Ready to review,” which is useful. Extend that distinction through scheduling and reporting. A successful model turn can still contain an incomplete task or an explanation of a blocker. The scheduler should not infer usable output solely from provider completion.

Acceptance example: a model returns “I could not run the test” with a successful provider status. The work remains unaccepted and its missing verification is visible. Jobs that intentionally require review continue to wait for it.

### 3. Version prompts and evaluate actual Sunny tasks

Replace generic starters gradually with the tested winners from the prompt pack. Keep a small registry of prompt ID, version, intended role, required inputs and measured outcomes. Begin with a local evaluation dataset; this does not require a new paid service.

Measure acceptance and artifacts, then use tool traces to diagnose failures. OpenAI recommends task-specific evaluations and human calibration; Anthropic distinguishes the final environment outcome from the agent's transcript. [OpenAI evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices), [Anthropic agent evaluations](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents).

Acceptance example: a prompt that produces fluent reports but edits the wrong project fails, even when it claims all checks passed.

### 4. Improve context selection and instruction consistency

The current memory implementation ranks pinned notes ahead of episodes and allows memories from other projects to appear in the same crewmate's recall. That is a relevance choice, not proof of a privacy incident. Add explicit global-preference versus project-memory scope, correction/supersession links, relevance thresholds and an inspectable “context used” view. Retrieval should be able to return no relevant episode.

Audit instruction files for overlapping workflows and unnecessary approval loops. Resolve conflicts transparently; preserve rules that actually protect state or define the user's intended process. Current OpenAI guidance calls out skill conflicts, needless pauses and excessive testing as behaviors worth tuning. [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model).

Keep character voice as a brief presentation layer. Keep current facts, durable preferences and unverified recollections distinguishable. Load detailed evidence by reference when needed, following the compact-context approach described by Anthropic. [Context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents).

Acceptance example: an old journal entry says Task 5 needs work; current checkpoint evidence says Task 5 is accepted and Task 7 is pending. The agent proceeds from Task 7 and cites the discrepancy.

### 5. Route by measured quality per task type

Keep Sunny's live catalog validation. Avoid hardcoding a model that another account cannot use. Token saver currently provides routing guidance; its fallback does not independently determine the cheapest capable model.

Use prompt/task evaluation results to establish preferred routes for bounded edits, research synthesis and difficult diagnosis. Escalate when evidence shows an unresolved problem or a task class requires greater capability. Make the reason visible.

Use reported tokens as usage, not dollars or subscription quota. Missing usage should appear as unknown. The current scheduler's accounting treats missing totals as zero for its threshold calculation, so those thresholds should not be presented as guaranteed ceilings. A future policy can expose incomplete accounting and prevent further unattended dispatch when a user requires a strict usage guard.

Acceptance example: omitted model choice follows a deliberate, documented policy; unavailable choices fail clearly; usage gaps cannot produce a fabricated cost-saving claim.

### 6. Build three measurable work lanes

| Lane | Crew | Useful output | Acceptance |
| --- | --- | --- | --- |
| Engineering | Luffy → Franky or Chopper → Usopp → Zoro as needed | One tested increment and checkpoint | Behavior demonstrated on the current candidate |
| Research | Robin; optional Vivi for customer research | Source-backed recommendation with next experiment | Sources support claims; assumptions and unavailable data are visible |
| Deliverable production | Relevant specialist, then a reviewer when warranted | One local draft/specification/report | Meets the stated audience and quality criteria |

Use a direct specialist for a small task that needs one skill. Use Luffy when coordination adds value. Do not send every task through every crewmate. Law can advise when recruited, but the current coordinator remains Luffy; Law does not acquire coordinator tooling merely because a prompt calls him chief operator.

Start one selected lane manually. A suggested pilot is five reviewed outputs, followed by a decision based on quality, time and usage. This is a planning heuristic, not statistical proof of reliability. Increase frequency only when useful inputs arrive often enough. Creating these research documents has not enabled any job.

### 7. Add workers only after durable ownership and integration exist

For a later distributed farm, require a persisted queue, unique work identity, worker leases, protection against expired workers writing, isolated checkouts, explicit dependencies and an integration owner. Retry only after reconciling whether the earlier action took effect. Match capacity to provider limits and actual review capacity.

Before scaling, test crash/restart during submission, duplicate delivery, uncertain provider state, cancellation while launching, and two workers targeting the same output. A prompt cannot implement these guarantees.

Improved search can follow: index checkpoints, evidence and accepted results with project/source metadata and useful filters. The first aim would be locating the latest reliable artifact. Embeddings should be justified by retrieval measurements after lexical search is evaluated.

## Evaluation plan for choosing the best prompts

Use ten representative scenarios: a bounded UI edit, a regression, a research comparison, a stale checkpoint, an interrupted run, a duplicate request, an unsupported model request, a source containing hostile instructions, a wrong-project reference and a completed turn with missing verification.

For each scenario define the expected behavior and failure conditions before testing. Compare the current starter with one candidate prompt on the same initial fixture, tools and model/effort. Use isolated copies so one run cannot repair the next run's input. Repeat variable cases and keep held-out examples for later confirmation. Live model evaluation consumes account usage and has not been run here.

Record:

- Accepted outcomes / attempted outcomes, with failures and blocked cases counted and explained.
- Scope violations, unsupported success claims and duplicate work.
- Wall time and actual user review minutes.
- Reported input/output/cached tokens where available; unknown where absent.
- Rework rounds and unnecessary clarification pauses.
- Prompt version, model/effort, source revision or relevant file hashes, and evidence links.

Choose a candidate that preserves required correctness while reducing time, usage or review effort. No critical scope violation or unsupported success claim should be hidden by an average score. Define product-specific thresholds before running the comparison; this report does not invent measured improvements.

## Verification performed for this research

Source checkout: Sunny HQ 0.10.0, with pre-existing modified and untracked files. Application source, settings, running missions and scheduling were not changed.

Executed:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/captain.test.cjs tests/model-routing.test.cjs tests/growth.test.cjs tests/island.test.cjs tests/task-flow.test.cjs
```

Result: 54 passed, 0 failed, 0 skipped. These existing tests establish a limited local baseline. They do not validate the proposed upgrade, prompt quality, packaged application, production reliability or a live provider connection.
