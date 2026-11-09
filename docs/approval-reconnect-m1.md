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

Development failures remain retained: the initial shell-quoting allowlist failed closed with zero execution; a continuation sometimes ended without asking again; the pre-fix resume-policy probe executed its bounded follow-up without a new request. These are not passing receipts.

The final clean source `0cc37423bfab7bf078f63c11625092d309b46028` passed all four live cases on November 7 local time (receipt timestamps November 8 UTC). [Reviewed redacted receipt](evidence/approval-reconnect-2026-11-07.json), SHA256 `bc04ad49d7410ad9a7c5d23dcf14c437fe0b15ef4bde3b9cf8c8db6d6567e102`:

| Real scenario | Observed result | Actual file effects |
| --- | --- | --- |
| Accept, edited answer and concurrent duplicate | Edited answer rejected with no response; one accept response | 1 |
| Decline | One decline; no execution | 0 |
| Interrupt pending approval | Old answer rejected; no approval response | 0 |
| Disconnect, saved Hub reconstruction and explicit continuation | Reservation held while unknown; reconciled interrupted; old answer rejected; fresh turn and decision despite reused RPC ID | 1 |

All probe-owned provider processes exited. Installed CLI `0.160.1` SHA256 is `9e7c59c05cc1ce5677b1f94e835b2ac038ca3be14504e78d558eacdb0ea3f55d`; generated `CommandExecutionRequestApprovalResponse.json` SHA256 is `6d0767113e22f311381809b6b236b0dde2b99b01992879c26bf7b1ea0e003cb7`. Model selection used the live catalog default, `gpt-6.1-sol`. Reconnected worker permissions returned `workspaceWrite`, `on-request`, user review. Network access inherited the existing host setting; this does not claim identical read-only/network restrictions to the initial diagnostic thread.

Complete Windows verification passed for this source in [run 42431544377](https://github.com/Vizzaq23/sunny-hq/actions/runs/42431544377): both shards and aggregate check succeeded. [Durable validation receipt](evidence/approval-reconnect-windows-2026-11-07.json) retains source/build identities, summaries, totals and test-log hashes. Shard 1 passed 892 tests in 3,440,080 ms; shard 2 passed 853 in 1,996,980 ms: **1,745 tests, zero failures/cancellations/skips**. Compared top-level name multisets against M0's hosted receipts: all 1,727 prior results remain, plus exactly eight new regressions (1,735 top-level results; ten additional nested tests).

Both hosted jobs passed clean `npm ci`, Electron installation, build/typecheck and the full hidden native workflow. Build fingerprint `169eb1e178e023172f42c380b743ae420f5681896c3b4ed462e83d653b58999a` matches the local application build/native validation. Raw hosted artifacts are retained locally at `.sunny-dev/ci-final-0cc3742/shard-1` and `shard-2`.

Earlier run 42431317207 was cancelled, not passed: a captain-resume regression stub assumed no preceding `config/read` and could wait indefinitely after throwing. The corrected stub handles the policy read, asserts read-only/never on resume, and races the boundary against early send failure. Its seven-test file passes. No product guard or test deadline was weakened.

An additional local `resume|continuation|reconnect` sweep is **not green**: adverse/missing/malformed second-reviewer cases reached the existing journey deadline before validation finished. The adverse case independently reproduced on unchanged M0 `d3371a9` in 124,072 ms (one test, one failure). Both captures have no runtime errors, finished alpha/beta production, queued reviewers and `validating` delivery state. The broad M1 sweep was stopped after these failures and the remaining matching journey cases; it has no complete-suite receipt. Logs remain at `.sunny-dev/resume-focused-fixed.log` and sibling `../windows-ci-baseline/.sunny-dev/m1-comparison-reviewer.log`. This is a pre-existing local timing failure, not evidence of a passing local full suite; no deadline adjustment was made. All three reviewer cases passed in final hosted shard 1. Local timing reliability remains a follow-up, separate from the verified approval journey.

Deterministic checks cover immutable provider snapshots, superseded/expired/cross-project approvals, same/replacement RPC IDs, old-transport frames, concurrent responses, conflicting duplicates and disconnect/resolution/supersession during a pending durable save. The native fixture checks exact read-only displayed command text, rejects an edited payload, and verifies one decision-only response through the production approval serializer. It remains synthetic transport, distinct from the live probe.

Local native preview captures at 390×844 and 200% zoom were visually inspected: command, reason and both decision controls remain readable. [Capture receipt](evidence/m1-approval-preview/design-result.json), [mobile](evidence/m1-approval-preview/design-approval-mobile.png), [200% zoom](evidence/m1-approval-preview/design-approval-zoom.png). These explicitly synthetic fixtures prove presentation/serialization, not a live provider or whole installed-app restart.

M1's observed approval/reconnect journey and hosted regression gate passed on the isolated candidate, with pending replay unverified and the local timing failure retained above. Implementation commits `0a0e13b` and `0cc3742` are pushed on `codex/approval-reconnect-20261107`; final evidence is a separate documentation-only commit. No M2 work, gate opening, merge, installed-app change by this task or production-profile change is included. Integration with other feature branches still needs combined-source validation and human merge/release authorization.
