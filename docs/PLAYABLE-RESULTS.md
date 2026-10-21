# Playable result contract — 2026-10-04

Task15 adds `playable` artifact/result references without changing workflow-v1,
reply/file results, or historical acceptance receipts. A playable reference is
`{kind:'playable',artifactId,sha256}`; the digest covers the exact UTF-8 manifest
bytes. No launcher or new persistence store is introduced.

Manifest version 1 has exactly: version, runId, missionId, attemptId,
producerTaskId, workspaceId, source, build, toolchain, runtime, artifacts,
entrypoint, cwd, environment, requiredCheckIds, limitations, producedAt.
Source uses the existing SourceIdentity. Build is descriptive `{program:'node',
args:[relativeScript]}`; toolchain is `{name:'node',version:'24.x.x'}`. The only
initial runtime is `node-http`. Environment is an empty allowlist. Cwd is `.`.
Paths are canonical forward-slash relative names; entrypoint and build script
must be declared artifacts. Each artifact is `{path,sha256}`. All runtime bytes
must be declared, with 256 files, 16 MiB/file, 64 MiB total, and 256 KiB manifest
limits. Unknown fields, duplicate/case-alias paths, links/hardlinks, protected
paths, traversal and command strings fail closed. Every source artifact hash
must match the complete declared artifact list. Build descriptions never grant
execution authority.

Main retains the manifest artifact's full SourceIdentity privately. New manifest
paths must be distinct; attachment rejects reusing prior runtime paths with
different hashes. External modification is detected, never treated as a new
accepted build. Combined verification stores optional `playable` metadata with
artifactId, exact manifest sha256 and requiredCheckIds. SourceIdentity hashes
cover runtime bytes; the separate selected result digest covers the manifest,
avoiding a self-referential manifest digest. Final readiness checks every manifest
check ID as well as all criterion check kinds. Candidate inspection can precede
those launch-derived checks. Run revision participates in renderer status binding
so a new review/check invalidates an old status even at unchanged mission revision.

Only main attaches a manifest from an already verified managed integration
workspace, binding the active finished producer/attempt/run. Inspection verifies
workspace ownership, clean source HEAD/fingerprint and every declared byte both
before and after inspection. Selection establishes an integrity-bound result;
combined verification/review then binds that result. Candidate launch eligibility
requires independent exact-source review with complete authorship/integration,
stable findings clear, and all non-playable mandatory checks. Missing startup or
gameplay proof remains explicit and blocks final readiness/acceptance. Play is
never acceptance. This ordering avoids requiring the first launch's own proof.

Task16 must call Hub.inspectSelectedPlayableResult with exact project/mission/
revision/result ID/hash immediately before use. Its returned proof contains
manifest/source/artifact hashes and candidate/final readiness summaries, never
an executable selected by the renderer. Task16 owns controlled Node runtime
selection, effect registry admission, immutable owned staging plus rehash at
spawn, health/session proof and cleanup. Descriptor-bound inspection detects
observed races; it does not sandbox code or securely bind a later path spawn.

Exact main-only signatures: `Hub.attachPlayableManifest({missionId,revision,
producerTaskId,filePath})` and `Hub.inspectSelectedPlayableResult({missionId,
revision,resultId,resultSha256})`. Project/run/workspace come from main membership,
never call arguments. The low-level inspector additionally takes a main-held
`authority` identity/source and the evidence service. No new IPC action is exposed
for attachment or launch in Task15. Renderer result selection uses the existing
validated `mission:selectResult` action. Inspection does not mutate readiness or
acceptance. Task16 must revalidate candidate.eligible and use only its own trusted
Node runner/declared immutable asset serving policy; `manifest.build` and
`entrypoint` are descriptive data, never authority to execute arbitrary Node code.
Task12 registerRunEffect/beforeEffect/settleRunEffect governs any actual launch;
Task13 recordImprovementFeedback is the trusted build/session feedback handoff.

Compatibility is additive in the current mission-book version. Older binaries
must not open a profile containing playable refs; preserve a consistent backup
before downgrade. Rollback requires retaining that backup or removing only new
unaccepted fixture results through a compatible binary; never rewrite historical
acceptance or restore an old backup over a live profile. No migration is needed
for profiles without playable results. Failure tests cover altered source/bytes,
missing assets, foreign identity, invalid schema, links and review freshness.

## Task16 launch and feedback receipts (2026-10-04)

Runs may retain `playableLaunches` (at most 32). Each strict version1 receipt
binds id, project/run/mission/attempt/producer/workspace/result/artifact IDs,
missionRevision, resultSha256, SourceIdentity, complete artifact hashes,
runtime executable/version/SHA256 and trusted runner SHA256, stageKey,
sessionSha256, state, startup, cleanup, createdAt and up to32 feedback receipts.
Optional observed PID, startup/exit times, exit code/signal, bounded diagnostics
and failure text describe observations, never recovered kill authority.
Feedback binds its original launch/result/manifest/source, text digest and up
to8 explicit project-local attachment paths/digests/sizes (1MiB each). A receipt
may retain an explicit new-attempt request and its outcome; retries deduplicate
the exact content and do not refill budgets or move acceptance.
New-attempt outcome is requested before the improvement handoff, pending at the
durable dispatch fence, then started, blocked (pre-dispatch denial), or unknown
(dispatch started but response unresolved). Only requested may dispatch on an
explicit receipt retry; pending and unknown never automatically retry.

IPC `result:play` accepts only resultId and expectedRevision (mission revision).
Stop accepts launchId and expectedRevision (run revision); feedback additionally
accepts resultId, text, attachments and optional requestNewAttempt. Main resolves
all membership and historical bindings. No command, cwd, environment, URL, port
or process identity is caller authority. The pending receipt is durable before
registerRunEffect's durable budget/effect barrier; spawn follows its synchronous
beforeEffect fence. A crash between barriers leaves a pending receipt, which
recovery marks unknown and reserves without manufacturing a process handle.
Final receipts and settlement are captured owned operations drained by shutdown.

Only the locally approved Node24 executable (24.18.0, SHA256
9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de)
runs a fixed packaged HTTP server. Manifest program metadata is descriptive.
Every asset is staged exclusively, rehashed, loaded and verified in server
memory before readiness. Preview has its own nonpersistent session, exact
launch origin, no Sunny bridge, permissions, downloads or popups. Node retains
the OS account's privileges: hashing and these runtime restrictions are not an
OS sandbox. This pilot does not execute arbitrary project Node scripts.

Backup/export includes these receipts with the authority profile and workspaces.
There is no migration for old profiles. Older strict binaries must reject these
new fields; downgrade requires a preserved consistent backup, never replacement
of live authority or deletion of unknown receipts. Owned staged builds and old
feedback remain inspectable. Failure tests cover source/asset races, missing or
denied launch, exit uncertainty, PID reuse, stale selection and receipt replay.
