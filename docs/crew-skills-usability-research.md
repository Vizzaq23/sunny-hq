# Crew skills and usability research — 2026-11-06

Status: research completed at04:10UTC; planning in progress through04:20UTC. This records observed problems and candidate improvements, not implemented capabilities or demonstrated model competence. Companion to [local crew](local-crew.md).

## Time and scope

User requested three hours, explicitly split into one hour research, ten minutes planning and the remainder implementation/verification. Window began approximately03:10 UTC: research through04:10, planning through04:20, execution through06:10. Preserve Luffy as the primary interaction, core crew first and island specialists on demand. Work branch: `codex/crew-skills-usability`, starting from `cf063c0`.

## Evidence gathered

- Actual separate development app, native window2362484, inspected Home and Crew. Home shows eleven navigation destinations, a large introductory banner, repeated Luffy entry actions and a separate empty Captain's watch. Crew cards emphasize old mission launch and XP; local skills are behind Journal → Local developer. These are observations, not a user study.
- Source: `src/components/Chrome.tsx`, `LocalCaptainPanel.tsx`, `LocalCrewPanel.tsx`, `CrewJournal.tsx`, `src/views/HomeView.tsx`, `DashboardViews.tsx` and `OpsViews.tsx`. Current skill picker exposes labels but not when to use a skill or what output to expect. It permits four selected skills. Existing model choices, personal instructions and project lessons must survive improvements.
- Actual local baseline role probes completed with `scripts/check-local-specialties.cjs qwen2.5-coder:14b`, isolated synthetic profile; log `.sunny-dev/crew-skills-baseline.log`. Findings and later comparisons appear below. Receiving a reply is not a correctness score.
- Two separate skill mechanisms exist: bounded local prompt guidance in `desktop/local-specialties.json`, and reviewed Codex `SKILL.md` selections with live discovery/content fingerprinting in `desktop/skill-catalog.cjs`. Do not imply either grants tools or that local models can execute scripts.

## Primary research sources

| Source | Relevant principle | Application to investigate |
| --- | --- | --- |
| [Agent Skills specification](https://agentskills.io/specification) | Describe applicability and keep detailed instructions separate from discovery metadata. | Make role skills understandable and load only bounded relevant guidance; retain runtime permission checks. |
| [NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Present common actions first and expose advanced options on demand. | Luffy, crew and watch remain easy to reach; specialist tools stay discoverable in a secondary group. |
| [W3C form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/) | Give understandable feedback near the affected control with recovery guidance. | Explain unavailable setup, preserve drafts and provide a clear next action. |
| [Google code review](https://google.github.io/eng-practices/review/reviewer/looking-for.html) | Review design, behavior, complexity, tests and user impact. | Zoro checks the stated contract independently; Franky supplies a focused proposed patch. |
| [Google SRE troubleshooting](https://sre.google/sre-book/effective-troubleshooting/) | Use system knowledge and evidence to discriminate hypotheses. | Chopper/Law request the smallest useful observation; Jinbe preserves ambiguous outcomes. |
| [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) | Validate syntax and semantics at trust boundaries; validation is not the only defense. | Security skills distinguish parsing from validation and authority. |
| [GOV.UK research planning](https://www.gov.uk/service-manual/user-research/plan-round-of-user-research) | Define questions, assumptions and decisions before selecting research methods. | Vivi/Ace propose bounded evidence gathering without invented users or metrics. |
| [Testing Library principles](https://testing-library.com/docs/guiding-principles/) | Test behavior in a way that resembles actual use. | Usopp covers the user-visible contract, not implementation-shaped assertions. |
| [Diátaxis](https://www.diataxis.fr/start-here/) | Different documentation needs call for different forms. | Robin/Brook distinguish a task guide from an explanation or reference. |

Source-derived guidance will be original concise Sunny wording with links, not copied packages or executable third-party scripts. Popularity alone is not evidence a skill is useful. Selection criteria: role fit, concrete workflow, checkable output, compatibility with local advice, manageable prompt size and provenance.

## Role coverage to evaluate

| Character | Most useful candidate skill focus | Evidence expected from practice |
| --- | --- | --- |
| Luffy | Intent clarification, small-team routing, evidence synthesis | Correct small team or direct answer; no invented contributions |
| Nami | Prioritization, dependencies, acceptance criteria, resource tradeoffs | Feasible ordered plan within stated constraints |
| Zoro | Contract review, threat boundaries, independent counterexamples | Concrete defect or justified no-finding; literal expected values |
| Usopp | Regression design, edge cases, recovery and usability tests | Runnable framework-correct tests with correct assertions |
| Sanji | Task flow, hierarchy, accessibility, error recovery | Concrete usable flow; no claimed visual checks without evidence |
| Chopper | Minimal reproduction, hypothesis testing, safe support | Cause separated from hypothesis and missing contract clarified |
| Robin | Source evaluation, knowledge organization, decision records | Attributed facts, uncertainty and a useful next source |
| Franky | Small patches, architecture boundaries, testable contracts | Correct proposed patch without broad unrelated changes |
| Brook | Clear product copy, teaching, documentation structure | Useful audience-specific text and explicit next action |
| Jinbe | Operational preconditions, reconciliation, rollback | Unknown writes preserved; no blind replay or backup overwrite |
| Law | Systems diagnosis, causal reasoning, performance experiments | Competing hypotheses and discriminating measurements |
| Ace | Reversible prototypes, experiment design, stop criteria | Bounded experiment without invented baseline/significance |
| Vivi | User needs, interview design, product prioritization | Questions that test assumptions without fabricated demand |
| Perona | Editorial critique, visual coherence, constructive alternatives | Specific revisions grounded in supplied material |
| Morgans | Evidence-based status summaries and privacy | No inferred task contents, success or private details |

## Boundaries

Training here means role instruction refinement, deliberate practice and verified saved corrections. No weight fine-tuning is promised. Use separate baseline and transfer cases; record failures as well as successes. The trusted supervised-execution release gate remains closed. Research and examples do not authorize publication, deployment or data changes. No claim of whole-app accessibility certification; inspected routes, states and limitations must be explicit.

## Baseline observations — first trial

All15 replies arrived in isolated run `2f4c69bf-700b-4160-8734-73e7f1b99243` under `.sunny-dev/local-specialty-check`. Reviewed the actual text, not just the transport flag. One trial is diagnostic, not a reliability estimate; prompts sometimes explicitly name desired behavior and therefore do not establish independent transfer.

| Member | Observed result | Target for improvement |
| --- | --- | --- |
| Luffy | Relevant clarification and Sanji/Nami selection; did not invent replies. | Keep clarification to one focused question and avoid premature feature scope. |
| Nami | Prioritized data loss over confetti/redesign. Long response and weak two-afternoon allocation. | Explicit time-box, smaller milestones and concise checks. |
| Zoro | Correctly caught null-versus-empty-string assertion and proposed changing the test. | Verify on a different contract without a leading prompt. |
| Usopp | Correct expected values but used unimported `describe`/`it` despite requesting node:test. | Framework-complete examples and final import/assertion check. |
| Sanji | Reasonable hierarchy and destructive-action confirmation; omitted focus entry/return. | Concrete keyboard lifecycle and fewer equally prominent actions. |
| Chopper | Correct cause and requested missing empty-input contract, then supplied an illustrative empty-string fallback. | Keep unresolved behavior explicitly undecided rather than appearing to choose it. |
| Robin | Separated observations and unsupported payment claim. Proposed broad survey with weak decision focus. | One focused research question with source scope and limits. |
| Franky | Correct minimal patch and expected whitespace result; explicitly unexecuted. | Transfer to a different edge-case contract and preserve existing work. |
| Brook | Friendly drafts, but promised retry would fix a failed save. | Calm recovery copy without unverified success promises. |
| Jinbe | Started with inspection but suggested timestamp/versioning as duplicate protection and backup restoration without sufficient conditions. | Durable idempotency evidence, retain unknown state and current data. |
| Law | Proposed lock/disk comparisons but conflated low CPU utilization with lack of CPU resources. | Keep observations literal and distinguish saturation from waiting. |
| Ace | Assumed current users, ten-percent rollout and a statistically meaningful24-hour experiment despite unknown traffic. | Local reversible prototype and qualitative observation before live testing. |
| Vivi | Assumed saved-lessons feature exists, invented ten-percent criterion and proposed deployment. | Ask implementation state; use a bounded observed task without fabricated baselines. |
| Perona | Replaced shaming copy with unsupported Premium feature promises rather than a useful empty state. | No invented benefits; neutral description and one real next action. |
| Morgans | Kept supplied statuses and did not invent task content; unnecessary handoff advice. | Short status-only bulletin with uncertainty retained. |

Further sources: [Node test runner](https://nodejs.org/docs/latest-v24.x/api/test.html) for framework exports; [agent evaluation guidance](https://www.anthropic.com/research/demystifying-evals-for-ai-agents) for trials, explicit graders and outcome evidence. A response that contains the right keywords may still contradict them later. Manual semantic review and executable contract checks where safe must remain distinct from simple text checks.

## Additional observed interface issues

Native Settings, Tools and Projects were inspected after Home/Crew. Settings exposes Codex models but provides no route to local crew models; the top bar says Codex Ready while supervised crew execution is gated. Projects offers an old workbench entry, with no direct project-specific Luffy action. The project banner's Import folder text is visually faint against its background; exact rendered contrast still needs measurement. Tools uses large category blocks and lists installed applications; tool availability is not equivalent to model capability. Preserve those distinctions while improving discovery. Screens inspected at1506×973; narrow/error/keyboard coverage remains pending.

The remaining main destinations were then inspected: Missions, Inbox, Library, Morgans' blimp, The Sunny and The Island. Missions opens the tracked board, not the older template component. Inbox says all work/conversations while local councils live elsewhere; its empty state does not explain that distinction. Library has clear search/open guidance and does not need a new workflow. Ship has working Return to Luffy controls and retained status; avoid disturbing its state projection. The island keeps direct station controls, but several routes still enter the old workbench. Morgans' main report is separate from his local sanitized bulletin; both need clear labels. This covers all eleven main entry screens in their observed current state, not all nested tools, dialogs or failure states.

Second diagnostic trial `6aa87f22-bb66-439b-927a-bc3727a0b8b3` repeated seven weak roles with unchanged prompts/settings. Usopp again missed imports and now also reversed empty-string expectations; Jinbe still suggested insufficient duplicate protection; Ace again assumed an available user sample and exceeded the afternoon time box; Vivi again assumed implementation. Law improved; Perona removed fabricated Premium benefits but inferred recent study inactivity; Brook removed the guaranteed retry-success claim. Variability is itself evidence against certifying a role from one good reply. Node24.18.0 independently confirmed `describe` and `it` are undefined globals and `require('node:test').describe` is a function.

Candidate installed workflows reviewed as research: `investigate-first` (Chopper/Law), `surgical-patch` (Franky), `verify-and-stop` (Usopp/Zoro), `lean-build` (Nami/Franky), and the existing ECC accessibility/research/writing adaptations (Sanji/Robin/Brook/Vivi/Perona). These are candidates, not newly activated skills. Broad architecture vocabulary and framework-specific React rules should only be offered when the task warrants them, not injected into every character. Official [Vercel skills](https://github.com/vercel-labs/agent-skills) and [Anthropic skills](https://github.com/anthropics/skills) were compared as source collections; no installer, hook, script or external account was added.

[Ollama Modelfiles](https://docs.ollama.com/modelfile) define base weights, parameters, system prompts and message examples; creating a named character model from those settings would not itself train weights. [Model import](https://docs.ollama.com/import) loads prepared weights. Sunny's existing per-character profiles already supply the personalization layer without duplicating model names or claiming a training job occurred.

## Different-case evaluation and instruction fit

Synthetic run `26877b33-c384-40ab-afc3-a315e453f235` received all fifteen replies without executing generated code. It used different contracts and scenarios from the first trial. Zoro and Franky preserved the supplied undefined-only fallback contract. Usopp again omitted the node:test imports despite an explicit request. Chopper correctly diagnosed an empty list, then incorrectly said reading a missing name property on an existing object throws (it returns undefined). Sanji omitted Escape and focus containment while calling the modal fully accessible. Robin attributed the source statements but promoted an unsourced generated satisfaction claim into an inference and invented a fifty-response target. Jinbe grouped evidence of a processed request with evidence permitting retry; those mean different things. Law's hypotheses overlapped, weakening the proposed discriminating measurement. Vivi checked feature existence but then asked questions presupposing use of the feature. Ace substituted an AI crew member for a recruited human participant. Perona avoided shaming and invented paid features.

Luffy, Nami, Brook and Morgans substantially over-expanded simple requests. Source inspection shows every selected skill's instructions are injected for every response. Brook's creative skill explicitly asks for value, cost and an experiment, which appears as extra sections beneath each short copy draft. This supports testing conditional application of skills, not merely adding more prompt text. A research-only process is comparing a conditional applicability prefix on five roles using isolated stores; it does not change application files or personal profiles. These different-case results have now informed research and must not be described as untouched held-out validation later.

Conditional-prefix trial `387e8ed9-d70e-4580-bff5-1445a482929a` made Brook and Morgans concise, but Nami still overscoped and Robin still treated an unsupported generated claim as evidence about users. Full role-guidance candidate trial `21c8e9d6-814b-4ef4-9df1-a84be839ac7e` retained those important failures; Usopp supplied ESM despite CommonJS being requested, and Jinbe still allowed health checks to justify retrying an uncertain write. The saved isolated state was checked to confirm the candidate instructions actually applied. This is negative evidence: more detailed instructions alone do not establish reliable specialist behavior. Law gave more discriminating measurements and Vivi improved conditional questions, but each still needs broader evaluation.

Additional primary references: [Agent Skills authoring practices](https://github.com/agentskills/agentskills/blob/main/docs/skill-creation/best-practices.mdx) supports concise guidance grounded in actual tasks; [AWS retry/idempotency design](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) explains uncertain side effects and request-identity contracts; [GOV.UK moderated usability testing](https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing) distinguishes observed participant tasks from assumptions about users. These are sources for original role guidance, not imported scripts or new runtime integrations.

Native nested-profile inspection confirmed Journal → Local developer → Model and skills hides the principal customization controls. Skills have names but no applicability/help. Escape closed the dialog and visibly returned focus to the Journal trigger; preserve that behavior. No model choice, saved guideline, lesson or preference was changed by inspection. Further UI checks should cover [status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages), [textual error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification) and [target size/spacing](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) without claiming comprehensive WCAG conformance.

Native Ctrl+K search for Luffy returned no matches in the separate app. Search should recognize the main captain destination. Escape restored the previous focus without changing any saved data.

Focused-role-only trial `f9a56198-946e-49e9-813e-90e3bd77ae80` omitted generic skill instruction bodies in process memory, preserving the same transport and identity. Luffy gave a useful concise clarification and Robin stopped promoting the generated sentiment claim, but Nami still overscoped, Usopp used ESM and omitted an active implementation, and Jinbe's retry criterion contradicted itself. These results support more selective context, not a claim that prompt reduction fixes reasoning.

The same five tasks and focused guidance were compared using already-installed models, without downloading or changing personal bindings. `qwen3-coder:30b` run `6c1085a0-925c-4d1a-ad43-0c17f2978c35` produced empty test bodies for Usopp, a Nami budget that added contingency beyond the time box, and unnecessary invented survey targets. Larger is not established as better. `qwen3.5:9b-q4_K_M` run `7c7a69a2-4903-406f-8c2e-805aa5c7e3e4` produced a correct CommonJS test example for Usopp, but Robin wrongly inferred user error from successful calls and Jinbe explicitly treated confirmed success as permission to retry. No model earns blanket reliability from these samples.

Usopp's 9B test block was manually reviewed (only Node test/assert modules and a pure synthetic function), then executed in `.sunny-dev/usopp-research-execution`. The proposed implementation passed; substituting the known defective truthiness implementation caused the same tests to fail. Receipt `result.json` distinguishes this safe generated-code execution from the original transport probe, whose generation phase executed no code. This validates that one example, not all Usopp responses or production code.

Remaining ten roles on 9B completed in `45322a19-29c1-441d-8928-3dbaccdb5259`. Zoro and Franky proposed the correct narrow patch, although Franky's explanation incorrectly called falsy values truthy. Chopper kept the missing contract open. Sanji covered Escape/containment but inaccurately described aria-invalid as moving focus and over-prescribed initial focus. Brook invented an export path and a music domain. Law added unsupported CPU/wait and race-condition interpretations. Ace correctly separated prototype mechanics from real-user effectiveness, with extra unneeded study scope. Vivi asked more useful conditional questions; Perona again invented recent inactivity. Morgans stayed near supplied states with unnecessary advice and misspelled Franky. These samples do not justify a blanket model replacement. User profiles remain unchanged.

## Captain routing research

The research harness uses the actual council planner/parser in an isolated profile, then intentionally rejects specialist inference. Its expected downstream failure is not a model transport failure or completed council. Baseline `2c83427d-9004-4f6d-bf92-8cf59d782785` over-selected Usopp for non-testing work, dispatched an unclear usability request instead of clarifying, inverted parts of an accessibility assignment, and produced rejected four-worker and Morgans assignments. The parser correctly rejected those last two; empty recorded assignments on a rejected plan are not a successful direct reply.

Explicit role/deliverable guidance improved several routes in `6bbeea28-a4d7-422e-9902-aa8b6941271c`, but Luffy's direct editorial answer invented upgrade benefits. A revised prompt plus [Ollama schema-constrained output](https://docs.ollama.com/capabilities/structured-outputs) in `0874465b-6c80-4fa6-a819-05ac0f9a1a50` selected Brook for copy, Sanji for accessibility, Chopper for diagnosis, Nami for planning and Jinbe for recovery; some unnecessary second members and questionable owner choices remained. Schemas constrain shape and eligible IDs, not the semantic correctness of a plan; the existing runtime parser must remain authoritative.

9B routing run `f8c60294-ae9a-4cee-b3c8-df640b1f43ba` stopped making model requests after a real Windows EPERM atomic-state rename failure. Later harness rows repeated the previous record and are invalid routing evidence. The process exited1. The harness was corrected to stop on persistence uncertainty and never label an old record as a new case. A fresh isolated repeat `3ff1fbed-9bfa-4b72-b092-366a78d81287` completed; it still over-assigned secondary specialists and sometimes answered requests for specialist deliverables directly. The failed store was preserved, not repaired, overwritten or silently retried.

Catalog applicability/deliverable metadata trial `40c6a7ef-4ea8-4db8-a7ee-91c32198ad96` kept useful routes for code, accessibility, diagnosis, evidence, prioritization and prototyping, but recovery went to Law and several concrete writing/research requests were answered directly. Metadata will improve discoverability and routing context but is not sufficient proof of correct selection by itself.

Short worked-example trials on14B (`3f000562-b98f-4ebb-8a87-e1b6015514ac`, `574b3663-bb71-416e-81df-d65c9fc66b19`) improved explicit CommonJS imports and the known-success recovery answer. They still produced wrong strict-identity assertions, a contradictory zero-value test, unrealistic time budgets and ambiguous retry guidance for an unknown outcome. Retain the specific useful lessons without claiming the role is trained or the generated checks are sound.

Worked examples on9B (`72f1ca2d-c129-4753-b5f4-e03bf18bfdc5`, `3fb48ce5-9233-4e91-97e5-377f8130f9d2`) gave safe answers to both sampled recovery cases, but Nami still minimized an unreproduced data-loss report and one Usopp example left its implementation import commented out. On14B with temperature0 and seed1234 (`264a676f-6cc0-47a8-8182-43068a1f31d7`, `163ade7b-5092-472b-b4f9-bb2def8da7ee`), both recovery answers were safe while test assertions and scope still failed. Neither sampler settings nor example injection establishes dependable competence. These additional generated examples were reviewed, not executed.

## Personal memory verification

Isolated real-SQLite run `9cbd6094-f3dc-4f1e-89ac-b1e921b0dd3a` prepared all15 profiles, saved a distinct synthetic project codename for each of the14 non-reporter characters, closed and reopened the store, then asked each through the actual local chat route. All14 returned their own exact codename; cross-project recall was empty, all15 profiles survived restart, and Morgans' private-memory teach route was rejected. Receipt: `.sunny-dev/memory-research/9cbd6094-f3dc-4f1e-89ac-b1e921b0dd3a/result.json`. This verifies scoped context delivery and persistence, not weight training, autonomous learning quality or general reasoning reliability. No personal app profile was changed.

## Consolidated interface review

Priority is based on observed task friction and misleading state, not a measured user study. Coverage: all11 main entry screens at1506×973, local profile nesting, modal Escape/focus return and Ctrl+K. A native resize attempt did not resize the window; minimum-size layout is **not** verified. Error states, complete keyboard paths, screen readers and reduced-motion behavior still require implementation-stage checks.

| Priority | Finding | Recommended outcome |
| --- | --- | --- |
| High | Eleven equal navigation choices compete with the captain workflow. | Five primary destinations and a clearly named secondary disclosure; retain attention badges and every route. |
| High | Local character setup is hidden behind Journal and generic developer labels. | Direct specialist profile entry, role purpose, relevant starter request and skill explanations. |
| High | Applying a recommended specialty overwrites personal guidelines. | Apply recommended skills independently; preserve custom instructions, model and lessons. |
| High | Codex Ready implies more than a connection while execution remains gated. | Say connected and explain execution availability at the relevant action. |
| High | Project cards enter the older workbench; searching Luffy yields no result. | Project-specific Talk to Luffy action and captain/search aliases. |
| Medium | Large repeated Home introduction pushes the main conversation down. | Compact themed introduction and visible prompt label; keep live work controls close. |
| Medium | Core crew and recruited extras share a misleading ten-specialist grid. | Core crew first, optional island specialists separately, distinct reporter entry. |
| Medium | Settings has no local-model route; Inbox scope excludes councils without saying so. | Clear local setup entry and accurate conversation labels. |
| Medium | All toasts disappear after3.6seconds, including failures. | Persistent dismissible errors with an accessible announcement. |
| Medium | Individual profile busy state misses councils and reporter inference. | Explain the actual competing local work and direct users to its existing controls. |
| Medium | Tool PR-project select and external icon link lack clear accessible names in source. | Name those controls and retain existing tool capability boundaries. |
| Low | Project import action appears faint; exact contrast is unmeasured. | Check rendered contrast and improve the action treatment if needed. |

Preserve the established world art, real-state ship/island activity, direct stop/step-in controls, existing library search, dirty-draft protection and modal focus restoration. The research does not support a new navigation framework, new model download, blanket model replacement or claims that all roles are now reliable.

For the secondary navigation, [W3C disclosure navigation guidance](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/) favors ordinary navigation semantics over a menu widget unless the full menu behavior is intended. Keep Tab navigation, a named expansion control and Escape/focus return. [Modal dialog guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) informs the profile check: appropriate initial focus, containment, Escape and restoration, with no claim of assistive-technology certification from DOM assertions alone.

Research receipt inventory: `.sunny-dev/crew-research-manifest.json` records22 result-file hashes observed since03:10UTC. It is an integrity inventory, not a count of passing evaluations. Canonical roster was rechecked against `desktop/island-residents.json` and `desktop/crew-bindings.json`: ten Straw Hats, four recruitable residents (Law, Ace, Vivi, Perona), and sanitized-only Morgans. No additional executable island identity is missing from this review.

## Planning outcome — 04:10–04:20UTC

The authoritative compatibility/acceptance decision is in [local crew](local-crew.md#role-skills-and-simpler-navigation-decision--2026-11-06). Implementation order: role metadata and bounded guidance; planner context and explicit recommendation refresh; navigation and profile access; focused regressions/build/native checks; clean full-history install and full suite; actual per-role practice and separate-profile activation with backup. Start broad verification early enough to accommodate the previous approximately53-minute suite, targeting about05:00UTC rather than leaving it to the end.

UI details: keep five primary destinations plus More and Settings; treat More as a disclosure, not an ARIA menu widget. Show recommended and currently selected skills first, with other choices collapsed. A recommended-skill action must never replace personal instructions. Use role-specific prompts instead of developer wording for writers/researchers. Put Luffy's completed answer before optional detailed reports while retaining named live member states during work. Show optional residents separately and keep Morgans' dedicated privacy boundary.

Different post-change practice questions and manual criteria were fixed before implementation in `.sunny-dev/crew-postchange-cases.json`, SHA256 `d38d988b3e6d9b5fbf4c072029f242e48e847381197c082ff2b715b31f2c5939`. They cover all15 roles. They are a small diagnostic set informed by this research, not a representative benchmark or independent certification. Any later edits or repeated attempts must be reported rather than presented as untouched validation.

Prompt-budget check: all15 role/applicability/deliverable rows occupy5372 characters with current recommended selections, leaving4628 characters for planner instructions when the captain uses the full6000-character objective. Keep the planner brief within16000 characters and retain existing bounded previous-context handling. Preserve concise routing metadata; never inject full skill files or transcripts into the roster.

## Implementation diagnostics — 2026-11-06, 04:44 UTC

All15 fixed post-change cases received actual14B replies in run e47a85f2-f1b7-4c39-ac02-24f18afbf851. Receipt: .sunny-dev/local-specialty-check/e47a85f2-f1b7-4c39-ac02-24f18afbf851/result.json. This is not a quality pass: Luffy misread the TCG Coach request; Nami overscoped the time budget; Zoro omitted a zero-limit counterexample; Sanji added an arbitrary error timeout; Chopper omitted a concrete regression plan; Robin generalized weak evidence; Ace added unsupported implementation assumptions; Vivi used a leading premise; Perona invented an unavailable action. Brook and Morgans stayed closer to the supplied facts with minor unsupported framing. Franky's patch, Jinbe's no-resend recovery advice and Law's discriminating hypotheses were useful. No blanket model change or training claim follows.

Usopp's manually reviewed pure CommonJS clamp example passed4 checks. The same checks rejected an intentionally defective negative clamp (exit1). Receipt: .sunny-dev/postchange-usopp-execution/result.json. This verifies one generated example, not general reliability.

Actual schema-constrained planner run ddccef91-4b2d-47ac-9414-a349a368a466 selected Brook for copy, Sanji/Usopp for accessibility, Chopper for diagnosis, Franky/Usopp for a patch, Robin/Vivi for evidence, Nami/Usopp/Franky for prioritization, Jinbe/Law/Chopper for recovery, Law/Chopper for systems, Ace/Usopp for prototyping, Vivi for interview questions and Perona for editorial work. Clarification, reporter requests and greetings used direct replies. Some teams remain unnecessarily large. This harness intentionally rejects subsequent workers; it does not demonstrate completed councils.

Focused checks:80 passed. Broader regressions:109 passed and one sandbox EPERM hard-link fixture failure; the affected four-test module passed with normal scoped filesystem permissions. Build/typecheck passed. Full hidden native workflow and separate council fixture passed, including recommendation refresh preserving personal instructions. Latest Home ordering/crew spacing changes await the next native check. Native checks use synthetic models and are not live-provider proof. Windows validation now removes inherited ELECTRON_RUN_AS_NODE (including case variants); an empty value incorrectly enables Node mode. No Electron sandbox setting changed.
