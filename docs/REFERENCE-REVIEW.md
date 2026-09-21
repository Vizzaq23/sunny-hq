# Munder Difflin reference scan

> Current Sunny foundation review: see the dated section below. This historical scan is retained for provenance. This existing filename is canonical on Windows; do not add a second `reference-review.md` differing only by case.

User supplied this reference during the build: https://github.com/chaitanyagiri/munder-difflin

Reviewed its README, package manifest, design system and architecture document on 2026-09-11. This was a documentation/architecture scan, not a full source security audit. No code or assets were copied.

Useful patterns:
- Separate real process/terminal execution from the scene's event-driven status display.
- Keep filesystem, terminal and Git operations behind the desktop IPC bridge.
- Make characters clickable entrances to the corresponding work.
- Persist task context and use explicit lifecycle events, not decorative activity, for status.

Sunny's first build already follows those patterns with Codex app-server JSON-RPC, isolated Electron IPC, SQLite state, real terminal sessions and crew stations. The reference's autonomous routing, semantic memory, multi-provider adapters and walking-sprite engine are larger capabilities beyond this release. They remain possible later additions rather than claims about this build.

Sources:
- https://github.com/chaitanyagiri/munder-difflin/blob/main/docs/ARCHITECTURE.md
- https://github.com/chaitanyagiri/munder-difflin/blob/main/DESIGN.md
- https://github.com/chaitanyagiri/munder-difflin/blob/main/README.md

## Foundation research — 2026-09-21

All five supplied links were opened directly in the signed-in Chrome session. Full primary post text and available surrounding replies were read. Video frames were inspected where rendered; this was not a frame-by-frame or audio-transcript audit. No social interaction, purchase, account change, asset download or installation from a post occurred. Linked repositories were inspected as source documentation, not executed or security-certified.

| Supplied source | What it demonstrates and useful concept | Architecture location / effort / dependencies | Decision |
| --- | --- | --- | --- |
| [SONIA](https://x.com/s0n_ia/status/2101325466313367697?s=46) | Quotes [Draven's pixel trading office](https://x.com/dravenip/status/2101323428473041054): visible desks, specialist roles, coordinator and activity/reward cues. Full quoted post and replies read; later playback rendered a warm office, desks, small characters and charts. The claimed trading returns and replacement cost are not execution evidence. | World projection and station inspection; moderate; needs real normalized task/artifact events | Adopt visible role/workstation cues later. Reject simulated earnings as proof and do not adopt a trading system. No runtime change required. |
| [Nozelcode](https://x.com/nozelcode/status/2101687753503096880?s=46) | Chat On Steroids: local files/commands, workers and durable continuation through ChatGPT/MCP. Read full post, repo reply and quoted GitLab-trial preview; inspected the local-coding UI video frame. [Repository](https://github.com/totec448-spec/chat-on-steroids) documents browser automation/recording, local privileges and ongoing provider limits. | Runtime adapter/context continuity; high for integration; requires supported account/MCP, extension, local service and security review | Reuse the idea of durable task context; do not replace supported Codex app-server with browser automation. The “100× limit” claim is not established. Quoted GitLab trial setup was not used or verified. |
| [Ricker](https://x.com/0xricker/status/2101705843200721203?s=46) | Separates structured decision routing from generation and execution. Read full post/replies and [10-step article](https://x.com/0xRicker/article/2101292455391809670), including state design, batching, filtering, confidence and advertised costs. Article diagrams were linked; primary TypeSafe API/SDK/model docs were checked independently. | Decision adapter inside main-process policy boundary; moderate; held-out task corpus, credentials, measured error/cost/latency | Adopt rules-first separation now; Jev shadow evaluation later. Never use probabilistic output as final permission. Social speedup ratios not reproduced. |
| [Avid](https://x.com/av1dlive/status/2100625342520262709?s=46) | Union Alpha orchestrator with DeepSeek workers. Read full post and author replies, including correction that the free period ended; inspected setup video frame. [Union Crew README](https://github.com/codejunkie99/union-crew) requires existing authenticated routes and says full orchestration is not yet tested end-to-end. | Replaceable role bindings and bounded worker ownership; moderate; actual model access and integration tests | Adopt role/worker separation; do not install or rely on temporary pricing/performance claims. Current Codex path suffices. |
| [TikTok / Professor Glitch](https://www.tiktok.com/t/ZTUCn6RpA/) → [canonical video](https://www.tiktok.com/@pro.glitch/video/7684994524959001869) | Complete eight-step caption read: per-worker job/playbooks/notes, common company rules, shared corrections, handoffs, task board, clocks, permissions and worker creation. Animated cream-background explainer rendered. No downloadable implementation linked in the caption; the community product was not accessed. | AGENTS/context/mission registry/scheduler; low for docs, substantial for enforcement; real tool policy and lifecycle | Adopt scoped briefs, shared accepted rules and explicit handoff records now. Folders alone are not security boundaries; automatic hiring and unattended jobs remain later. |

### Further quoted-source investigation

Avid's [memory article](https://x.com/Av1dlive/article/2100262476898243052) was read through its implementation/evaluation discussion. It distinguishes stored facts from model training and reports a strong isolated score collapsing at runtime due to interface mismatch. The rules baseline nearly matched the trained policy. The linked [Continual Memory Policy Model at the article revision](https://github.com/codejunkie99/continual-memory-policy-model/tree/8977cc46865b09c91a39318387d4940e7eeb79a0) explicitly labels itself experimental. Adopt revisioned notes, runtime-level evaluations and correction provenance; do not add model training or a second memory database to Sunny now.

Draven's second-level “God Mode” article was visible as a quoted preview, not fully reviewed; no recommendation relies on its prompts. Nozelcode's second-level GitLab offer was also only a preview. These limits do not establish any claimed pricing or model availability. No visual design is copied from either source.

### Additional primary resources

- [OpenClaw official repository](https://github.com/openclaw/openclaw), also open in the user's Chrome tabs: typed Gateway/lifecycle candidate. See [evaluation](openclaw-evaluation.md).
- [TypeSafe API](https://docs.typesafe.ai/api), [SDK](https://docs.typesafe.ai/sdk/javascript), [models](https://docs.typesafe.ai/models), [confidence](https://docs.typesafe.ai/confidence), [known limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13): official sources resolve Jev's actual product identity. The similarly named community site `jevai.org` was not treated as authoritative. Web extraction failed on Markdown endpoints, but direct HTTPS document reads succeeded.
- [Claude Code setup](https://code.claude.com/docs/en/setup): optional second worker, not Sunny's architecture. See [routing](agent-routing.md).
- [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security): preserve isolation, sandboxing and sender validation. Existing source follows these boundaries; broader IPC schemas remain future work.
- [Official Grok Bot page](https://x.ai/bot), inspected in the existing Chrome tab: demonstrates named worker jobs, reviewable drafts, handoffs, routines and its own computers. Useful interaction reference; no verified Sunny integration API was established, so no new adapter or install. The product page does not validate a user's trading-profit claim.
- [Sentry Electron](https://docs.sentry.io/platforms/javascript/guides/electron/) and [PostHog configuration](https://posthog.com/docs/libraries/js/config): evaluate crash diagnostics separately from product analytics. Sentry's page extraction was inconsistent; do not claim an installed/tested integration. Prefer local redacted diagnostics now; PostHog's autocapture/recording options make a deliberate opt-in policy necessary before adoption.

### Art and UI evidence

Inspected current island artwork and crew-state sheet directly, and the fresh native workflow screenshot during validation. The island is warm, lush, elevated and detailed; characters are compact illustrated pets rather than a uniform strict pixel grid. Preserve this coherent baseline. A separate supplied pixel reference sheet was not found in the attachment or project inventory; its path was requested while work continued. See [art bible](art-bible.md) and [world bible](world-bible.md).

Research changes the next architecture through explicit mission evidence, stable roles, scoped context and a replaceable runtime boundary. It does not justify replacing the current world, installing every provider, or claiming a full autonomous platform already exists.
