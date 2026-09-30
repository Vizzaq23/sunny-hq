# Bounded reliability repairs — 2026-09-30

Scope: existing Hub persistence and Codex message processing; renderer diagnosis and recovery are described in the canonical [renderer recovery document](renderer-recovery.md). No architecture replacement, state-schema migration, provider execution retry or permission expansion.

## Idle persistence failure

The reproduced defect was `Hub.savePending`: it cleared both scheduled saves before attempting persistence, then emitted an error without scheduling another attempt. When the captain stopped interacting after a failed write, the latest state remained in memory indefinitely.

A failed background save now leaves one retry timer. Retry delays are 1, 2, 4, 8, 16 and then 30 seconds; the delay remains capped at 30 seconds while the app is open. Each attempt serializes the latest authoritative state. Success clears the timer and failure streak, and shutdown cancels it before the existing final synchronous save. The initial failure remains visible without repeating the same toast on every background retry. A permanently unavailable store still cannot guarantee durability; the app does not silently report a successful save.

The retry only writes state. Mandatory synchronous persistence before provider dispatch remains in place and still rejects dispatch on save failure. Nothing resubmits a task or automatically resumes uncertain work. Fixture tests verify a real JSON StateStore eventually contains the latest idle state, one scheduled retry with backoff, successful/closed cancellation and zero provider requests.

## Provider message consumer failure

The reproduced defect was one catch covering JSON decoding and delivery to Sunny's event handlers. A valid provider message whose consumer threw was misclassified as unreadable JSON, and the client remained connected. Async consumer rejection could also escape as an unhandled rejection. Independent review additionally reproduced an exception in a diagnostic observer preventing disconnect, and a late rejected consumer from an old connection disconnecting its replacement.

Decoding and consumer delivery now have separate private-safe categories. Malformed JSON/object input produces `provider-decode-failed`; the next valid reply still correlates. A synchronous throw or asynchronous listener rejection from the current connection produces `provider-handler-failed` and follows existing disconnect recovery: pending RPCs reject with uncertain outcome, active tasks become unknown, approvals are cleared and checkout reservations remain held. Hub consumes these categories, displays a generic error and sends only the allowlisted category to local diagnostics. Raw provider stderr is not forwarded to the startup diagnostic log. Diagnostic/disconnect observers are isolated from transport cleanup, and a late consumer rejection tied to an old connection cannot disconnect a replacement.

This is bounded handling, not transactional rollback of arbitrary application callbacks. An event consumer could have changed state before throwing; reconcile authoritative provider status before continuing. No execution retry or automatic historical resumption was added.

## Evidence and limits

Tests were RED before changes and the full Node suite subsequently passed 358/358 in the shared worktree. Root coordinates final build, native fixtures, independent review and packaging. No production profile or real provider mission was used.

Synchronous aggregate serialization/persistence, full task IPC updates and synchronous file search/import/inbox work remain unchanged. Their cost under the captain's real workload has not been measured. No evidence here establishes these paths as the renderer-exit cause or justifies a broad process/data-model refactor.
