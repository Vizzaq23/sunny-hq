# Deployment observations

Sunny can inspect GitHub deployment records for a registered project's exact current Git commit. Use **Inspect GitHub deployments** on a mission that is ready for review or already accepted. The same saved observation appears in project health. This action never starts, changes, cancels or approves a deployment.

The main-process adapter uses GitHub CLI with explicit GET requests to the official [deployment list](https://docs.github.com/en/rest/deployments/deployments#list-deployments) and [deployment status list](https://docs.github.com/en/rest/deployments/statuses#list-deployment-statuses) endpoints. Private repositories require a signed-in CLI with deployment-read access. Sunny does not extract credentials, start a sign-in flow or add a Vercel connection. Providers that publish GitHub deployment records can appear through this shared source; others remain outside its coverage.

## What a record means

Each observation identifies repository, commit, inspection time, environment, deployment ID, reported state and status time. The reader queries at most five deployments for the exact HEAD and100 statuses per deployment. It selects the newest returned status by timestamp/ID and flags a full page as potentially incomplete. It validates deployment/status IDs, URLs, commit and bounded labels before storing selected metadata; arbitrary payloads, creator profiles, log URLs and response bodies are not copied into the app's snapshot.

No results means no records were returned for that commit, not that the application was never deployed. Missing status remains unavailable. Success is a provider-reported observation, not a live site-health check. Inactive, pending, queued, in-progress, error and failure remain distinct. Later evidence for another commit marks the observation as older source in both board and health views. Uncommitted changes are explicitly excluded from what the deployment record describes.

There is no automatic polling. Old observations keep their timestamps and always tell the captain to recheck before relying on them. If a read fails, Sunny reports the failure, retains the prior historical evidence and releases its local operation lock. A new observation after mission acceptance changes neither the acceptance record nor the mission outcome.

## Persistence and limits

Deployment is an additive version1 mission-artifact kind attached to the current attempt. Existing snapshot/backup persistence retains it. The collector uses the same project checkout reservation, mission-action guard, revision check, attempt check and save-before-broadcast path as other evidence. Current Git state and origin are rechecked after the API reads. The artifact intentionally carries no test fingerprint and never counts as a passing test, a merge proof or a criterion approval.

Older app versions do not understand this artifact kind; follow the existing pre-upgrade-backup rollback rule. Evidence is bounded historical metadata, not a complete deployment inventory. No production action or external account change is authorized by an observation.

## Verification scope

Adapter regressions cover GET-only endpoint construction, exact repository/commit binding, malformed/foreign responses, empty statuses, source changes, generic authentication errors, limited queries and metadata filtering. Hub tests cover attempt binding, persistence, mutually exclusive inputs, post-acceptance refresh and failure cleanup. Projection tests cover old attempts and later-source mismatch. The native fixture uses the real adapter with labelled synthetic GitHub responses, real local Git, saved state and UI controls.

The local GitHub CLI remained unsigned-in at this checkpoint. Live private-repository deployment proof is still outstanding. These tests must not be described as a live deployment or a connected hosting account.

Checkpoint: 268 tests and build/typecheck passed in the integrated working tree; 251 tests and build/typecheck passed in the isolated staged-source export. Both native mission fixtures passed, including observation display and refresh after acceptance. Independent review confirmed the older-source warning is shared by both views. The final staged deployment screenshot was visually inspected.
