# Sunny HQ 0.11.0 activation — September 14, 2026

Activated at the user's explicit request to update and restart. The live executable is `release-workflow-0.11.0/win-unpacked/Sunny HQ.exe`. The Desktop and Start Menu shortcuts, `Launch Sunny.cmd`, and `Open Morgans Update.cmd` now target it. Source changes were applied to the existing working copy only after the update patch passed `git apply --check`; existing unrelated work remains intact.

The live UI shows **Codex Ready** and the recent Trading Agent and One Piece conversations visible before the update. No new missions were submitted. A reversible motion-preference toggle was verified on disk and restored; conversations, projects, settings, journals, and news stayed unchanged during that check. The app was returned to Home.

Validation: 137 tests pass, TypeScript checks pass, packaged preview and desktop workflows passed. Activation exposed an additional save-order problem: a disposed renderer could throw before persistence was scheduled. Saving is now scheduled before broadcasting, and per-window delivery failures are isolated. Both cases have regression coverage.

During activation an older 63-task checkpoint surfaced. A separate 104-task reconstruction from saved records plus 42 local Codex session logs was prepared as a recovery fallback. The final live database instead contains the complete recent 42-task state with original task IDs, transcripts, and assignment links, matching the pre-update live UI; it has 12 registered project entries. This authentic complete state was separately backed up and verified through a live save. The reconstructed fallback is retained separately and is not the final live dataset. Do not restore the older checkpoint or reconstruction over the current database by default.

Backups and evidence are in `.sunny-dev/activation-0.11.0-20260914/`:

- `sunny-current-complete.sqlite`: final complete recent state; preferred activation backup.
- `current-complete-state.json`: the same state exported locally.
- `sunny-before.sqlite` and `user-data-after-close/`: earlier checkpoint and full profile backup.
- `recovered-state.json` and `recovery-manifest.json`: separately retained log-reconstruction fallback and provenance.
- Original launch scripts, shortcut copies, startup logs, and test output.

The 0.10.0 executable remains in `release-workflow-0.10.0/win-unpacked/` for rollback. Before any later rollback, close Sunny and back up the current database consistently; do not replace current data with an older backup merely to change executables.

No model-work mission was launched to test the update. The live provider connection, native UI, restored recent records, and preference persistence were verified. The exact reason the older checkpoint surfaced remains unresolved; all observed states were preserved locally.
