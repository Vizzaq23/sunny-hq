# M1 — Real Codex approvals and reconnect, 2026-11-07

Scope: the existing direct Sunny task path, real Codex app-server stdio transport, isolated fixture project and worker-owned SQLite profile. The supervised execution release gate remains closed. Base is M0 documentation commit `d3371a9`, whose implementation `614b923` passed hosted validation. Other feature worktrees and the primary roadmap remain separate.

## Protocol and design

Inspected the installed `codex-cli 0.160.1` generated experimental JSON schemas and the [official approval protocol](https://learn.chatgpt.com/docs/app-server#approvals). A command response carries a decision about the provider request; it does not replace command text. Sunny's current Workbench preview is read-only. The Inbox routes to that same Workbench.

Observed and corrected three gaps:

1. Nonempty command `answers` were accepted but ignored, so an attempted edited command could still approve the original request. Reject nonempty answers for command/file/permission decisions; input and elicitation retain their supported answers. Unknown top-level replacement fields already reject. Empty answers remain compatible with existing UI callers.
2. The legacy resume call omitted permission settings. A real read-only probe resumed as `dangerFullAccess`, and its explicitly requested follow-up executed without a new approval. This was confined to the generated harmless fixture. Start and resume now share `Hub.threadOptions`: workers use `workspace-write`, `on-request`, user review; captain/reviewer/assessment options retain their narrower read-only policies. No host settings are changed.
3. A repeated pending RPC ID with different parameters silently retained the earlier preview. Identical duplicates remain deduplicated; conflicting duplicates disconnect, invalidate pending approvals and require reconciliation. Neither request is approved automatically.

No persistence schema or migration changes. Existing task/execution/turn identity, expiry, durability barriers and checkout reservations remain authoritative. Rollback is a focused revert; no profile restoration is required. Do not replace permission checks with a provider-version guess or cache old approvals across connections.

## Live probe contract

Run only with explicit authorization for harmless fixture actions; never in credential-free CI:

```powershell
& 'C:\Program Files\nodejs\node.exe' scripts/probe-live-approvals.cjs --allow-fixture-actions .sunny-dev/live-m1-final
```

The probe uses the installed account through `CodexClient`, selects the live catalog default, and creates fresh temporary projects and isolated actual SQLite stores. It approves only a known local PowerShell invocation of an intact generated script, whose sole effect appends one character in that fixture. It never grants session-wide approval or policy amendments. Each scenario has bounded waits, records owned-process exit and counts actual file effects. Existing evidence directories cannot be overwritten.

The four cases are: accept plus concurrent duplicate responses and edited-answer rejection; decline; interrupt while approval is pending; and transport loss plus saved Hub reconstruction, authoritative `thread/read`, old-response rejection, then an explicitly requested new turn and fresh decision through `Hub.send`/`Hub.respond`. No continuation is automatically dispatched by reconnection.

Receipts contain source/CLI identity, model, request/thread/turn correlation IDs, command hashes, decision-only responses, state transitions and cleanup outcomes. They omit prompts, command bodies, account data and credentials. Private fixture databases and complete schema bundles remain under ignored `.sunny-dev`; only reviewed redacted receipts belong in `docs/evidence`.

## Evidence and limits

Development probes observed real accepts executing once, declines/interrupts executing zero times, stale decisions rejected, and reservations retained until reconciliation. The corrected reconnect probe resumed with workspace-write permissions, received a fresh approval with reused RPC ID `0` and a different turn/local approval ID, rejected the old decision, and executed the new action once. The saved Hub was reconstructed against its actual SQLite profile; this is not a claim that the installed desktop app was restarted.

No pending approval replay was observed: closing the stdio process caused the provider to report the old turn interrupted. The probe observes for 15 seconds before an explicit new turn. Same-ID/replacement-ID replay permutations are deterministic tests only. **Pending replay remains unverified live** and cannot be claimed from a synthetic replay or a newly issued request.

Development failures remain retained: the initial shell-quoting allowlist failed closed with zero execution; a continuation sometimes ended without asking again; the pre-fix resume-policy probe executed its bounded follow-up without a new request. These are not passing receipts. Final clean-candidate live matrix and complete Windows verification are pending.

Deterministic checks cover immutable provider snapshots, superseded/expired/cross-project approvals, same/replacement RPC IDs, old-transport frames, concurrent responses, conflicting duplicates and disconnect/resolution/supersession during a pending durable save. The native fixture checks exact read-only displayed command text, rejects an edited payload, and verifies one decision-only response through the production approval serializer. It remains synthetic transport, distinct from the live probe.

Final evidence must identify the tested source, full suite/build/native results, live matrix outcomes and remaining replay limitation. No M2 work, gate opening, merge, installed-app change or production-profile change is included.
