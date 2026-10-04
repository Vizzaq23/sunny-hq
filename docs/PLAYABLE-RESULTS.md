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
