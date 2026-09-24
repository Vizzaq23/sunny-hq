# Renderer exit diagnosis and recovery

Decision, 2026-09-23: preserve Electron's bounded process-exit evidence and verify actual renderer recovery before attributing an unexplained interface exit to permissions, installation, memory pressure or another cause.

The observed MLB execution trial completed in the main process while Sunny's interface exited. Reload restored the saved result. The original handler discarded Electron's reason and exit code, so the original exit's cause remains unknown. Windows event inspection did not establish a cause. A successful recovery is not proof that a spontaneous crash has been fixed.

`desktop/diagnostics.cjs` now records an allowlisted Electron reason and a safe integer exit code for `renderer-gone`. Unknown reasons become `unknown`; arbitrary properties and text are discarded. Existing bounded log rotation remains. Prompts, replies, URLs, credentials and file paths are not logged. The dialog reports the same sanitized evidence and offers reload or leaving the interface closed. Dismissing it does not select reload. Quitting while the dialog is open prevents a later reload.

Reload reconnects the renderer to the existing main-process Hub. It does not restart tasks, reset state, or authorize another attempt. If work may still be running, reconcile its saved status rather than resubmitting the prompt. No permissions, provider configuration or process memory limits change.

## Verification

The diagnostic regression first failed because the exit details were absent. Unit checks cover retaining the reason/code and rejecting arbitrary private fields and log injection. The isolated Electron recovery smoke deliberately crashes its own renderer, takes the production recovery path, confirms Home and the authoritative snapshot reconnect, and compares saved task state before/after. It retains the existing React error-boundary recovery check.

Use `--smoke-test` only with an isolated `SUNNY_DATA_DIR`. The smoke test's dialog responder is confined to that test; the normal app always lets the captain choose. Never force a crash in the normal profile to test this path.

## Alternatives, compatibility and rollback

Reinstalling Codex, broadening permissions, increasing memory limits or switching off rendering features were rejected without causal evidence. Full crash dumps and transcript logging were rejected as unnecessary private-data collection. Automatic task retry remains prohibited.

There is no persisted state/schema migration. Existing diagnostic lines remain readable; new renderer-exit lines append a small JSON object. Rollback is the previous package or reverting this focused change. Keep the same profile; do not restore an older profile over current mission data. If another exit occurs, retain its timestamp/reason/code and the exact package revision for diagnosis.
