# OpenClaw evaluation

2026-09-21. Recommendation: retain Sunny's working Codex path for the first vertical slice; evaluate OpenClaw as a replaceable main-process sidecar after mission/attempt contracts exist. Do not migrate the current Hub or install a second scheduler now.

## Evidence and local status

Primary sources: [official repository](https://github.com/openclaw/openclaw), [architecture](https://docs.openclaw.ai/concepts/architecture), [Gateway protocol](https://docs.openclaw.ai/gateway/protocol), [transport](https://docs.openclaw.ai/gateway/protocol/transport), [handshake](https://docs.openclaw.ai/gateway/protocol/handshake), [security](https://docs.openclaw.ai/gateway/security), [automations](https://docs.openclaw.ai/automation/cron-jobs).

Already installed locally through the user's npm directory: `OpenClaw 2026.9.5 (ec9c1a1)` from a read-only version command. Its installed manifest requires Node `>=24.16.0 <25 || >=26.1.0`. No install, update, onboarding, service start, credential read or channel activation was performed. Current website/repository can describe features newer than this binary; a future spike must use the installed release's exact schemas, not assume current-main compatibility.

The documented Gateway manages sessions, tools, provider connections and event delivery. External clients use typed WebSocket requests/responses/events; device identity, pairing, roles and scopes are explicit. Official `@openclaw/gateway-client` and `@openclaw/gateway-protocol` packages exist. Package versions and wire versions are distinct. This is a viable desktop boundary without importing runtime internals into React. The architecture docs explicitly state that events are not replayed: gap recovery requires a fresh authoritative snapshot.

## Ownership if adopted

| Capability | Classification | Boundary |
| --- | --- | --- |
| World, rooms, sprites, crew identity and navigation | SUNNY_OWNED | Never delegate Sunny's experience to a runtime UI |
| Projects, mission acceptance and artifact evidence | SUNNY_OWNED | Provider sessions map to Sunny attempt IDs |
| Visual state and notification semantics | SUNNY_OWNED | Derived from validated canonical events |
| Sessions, agent loop and provider execution | OPENCLAW_OWNED | Only for work dispatched to that adapter |
| Provider/model plugins and auth mechanisms | OPENCLAW_OWNED | No secrets in renderer |
| Skills, tools, plugins and external integrations | SHARED | Runtime executes; Sunny selects approved scope and shows availability |
| Agent lifecycle, state, stop and recovery | SHARED | Runtime reports facts; Sunny reconciles its mission state |
| Cron/background jobs | SHARED | One scheduler owns each job; never double-schedule |
| Multi-agent coordination | SHARED | One orchestrator per mission; Sunny retains ownership/acceptance |
| Browser/computer use and remote nodes | SHARED | Explicit capabilities and permissions; platform support verified per release |
| Memory/context | SHARED | Runtime session context plus Sunny's scoped accepted artifacts |
| Approval, audit, rate and budget controls | SHARED | Runtime enforcement plus Sunny action-bound human authority |
| Personal messaging channels for first coding slice | NOT_NEEDED | Leave disconnected |
| Runtime's own dashboard/theme | NOT_NEEDED | Useful operational tool, not Sunny's product surface |

## Comparison

| Option | Fit | Burden and tradeoff |
| --- | --- | --- |
| Existing Codex + Sunny Hub | Best now: already tested streaming, delegation, locks and recovery | Provider-shaped logic; fewer commodity runtime features |
| OpenClaw behind adapter | Best later candidate for multi-provider/background/channel needs | Service supervision, protocol/auth compatibility, duplicated scheduling risk |
| Build custom universal Sunny runtime | Poor now | Must recreate lifecycle, retries, integrations, security and maintenance |

OpenClaw can replace future commodity session/provider/tool/scheduling plumbing, not mission acceptance, artwork, rooms or captain authority. Its API surface and schema validation are stronger evidence than a viral demo. Electron should connect from main (or a narrowly supervised utility process); expose sanitized projections through existing preload. A browser-safe SDK does not justify giving the renderer Gateway credentials.

Local execution is the default architecture; models may be local or hosted and remote nodes/cloud worker capabilities are documented. Local Gateway does not mean prompts never leave the computer. Authentication and permissions need configuration per provider and node. Current docs include browser/computer tools, plugins/MCP, skills, cron and background work; actual Windows/runtime parity must be probed, not inferred from the feature list. GitHub work still needs authenticated tooling and scoped authority; a generic tool capability is not a verified PR integration.

Security docs describe one trust boundary per Gateway, not hostile multi-tenant isolation. Host tools may execute outside a sandbox unless configured. Keep loopback binding and authentication, least scopes, approved plugins and a separate fixture profile. Read-only audit and sandbox explanation precede any execution spike. Avoid broad admin scopes, automatically trusted messaging, and tunnelling the Gateway merely to connect Sunny. Preserve an immediate stop/disconnect control.

Reliability needs tests for accepted-but-disconnected requests, cancellation races, event gaps, stale attempts and restart reconciliation. Idempotency keys reduce duplicate side effects but short-lived runtime deduplication is not durable exactly-once mission execution. Observability can use runtime diagnostics plus Sunny correlation IDs; never log tokens or full private transcripts. Latency and maintenance overhead were not benchmarked. The repository is MIT, but model usage, compute and hosting can cost money. There is no measured Sunny cost saving yet.

## Adoption gate

Use an isolated synthetic fixture, pinned compatible versions, no personal channels and no production credentials. Prove handshake, scoped read, one bounded task, event normalization, stop, restart and gap recovery; record process cleanup and resource use. Then compare the same task through existing Codex. Adopt only when a needed capability wins enough to justify the service and security burden. Keep the adapter optional; unavailable runtime must show disconnected and preserve work, not silently reroute a possibly running task.
