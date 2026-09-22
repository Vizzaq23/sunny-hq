# Jev advice in Sunny

Jev optionally ranks existing crew-journal context and suggests an eligible specialist/model to Luffy. Codex still executes the work. Jev cannot authorize actions, change the selected direct crewmate, bypass mission stages or mark a mission complete.

## Enable selected projects

Requires a TypeSafe API key already configured in the launching process environment. No key is bundled. In the same PowerShell session used to start the candidate app:

```powershell
$env:SUNNY_JEV_ENABLED = '1'
$env:SUNNY_JEV_PROJECT_IDS = 'registered-project-id-1,registered-project-id-2'
# TYPESAFE_API_KEY must already be set through your local secret environment.
# Start the candidate Sunny HQ.exe from this session.
```

Use exact registered Sunny project IDs, not folder names. Without the flag or an allowed project, no Jev request is made. With no key, Sunny records a fallback and uses the previous context path. Remove SUNNY_JEV_ENABLED to disable.

Selected objective and at most ten locally retrieved journal candidates from the same project may be sent to TypeSafe. Pinned note content remains local and mandatory; only optional candidate content is scored. The current task message, mission criteria and project instructions remain intact. Global pinned notes retain their existing Sunny semantics.

A service failure uses original retrieval. Stop during preparation cancels before provider turn submission. Disconnect or stale task state retains an uncertain task for reconciliation. Provider work already submitted is not retried. Routing advice is attributed and still subject to current catalog, recruited residents and mission stage. Explicit UI model/effort selections suppress model advice; direct user instructions always take precedence.

## Source and verification

The canonical library is in the Jev project. Its four files are vendored in desktop/jev, with SHA-256 hashes and a question revision. Run from the Jev repository:

```powershell
node scripts/vendor.cjs '<Sunny source path>/desktop/jev' --check
node --test tests/*.test.cjs
node scripts/evaluate.cjs
```

Offline evaluation validates twelve synthetic cases and reports not_run. It is not a live accuracy test. Live activation requires running the same evaluation with --live after configuring TYPESAFE_API_KEY. No real project transmission is needed for that evaluation.

The initial decision model is jev-1.13.0; JEV_MODEL may explicitly override it. The request deadline is three seconds including body reading, with no retry. Provisional relevance and recommendation thresholds require evaluation on your task distribution.

No database migration is required. An optional task metadata boolean records an explicit model/effort selection to preserve it on subsequent turns; old tasks remain readable. No credentials enter saved task data.

The separately packaged candidate does not replace the existing launcher/executable. Roll back operationally by removing SUNNY_JEV_ENABLED. Source rollback removes the Jev integration diff and restores the previous context builder. Preserve unrelated working-tree changes.
