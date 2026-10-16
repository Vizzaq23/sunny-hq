# Compatible saved-data recovery reader

The dedicated recovery mode is an inspection fallback for the current v3 saved
schema. It has no Hub, provider, executor, persistence worker, migration, normal
renderer hooks or editable controls. It retains complete state/history/drafts
and compatible opaque fields privately, while exposing six fixed local queries.
Saved project and artifact paths remain historical strings and are never probed.

The supported entry is the versioned application-owned `Sunny Recovery.exe`
bootstrap, without arguments. Direct `Sunny HQ.exe --recovery-reader` is denied
unless the fixed native, process-bound, consume-once admission succeeds. The
bootstrap establishes protected private raw streams before descriptor access or
child creation, pins the EXE/raw ASAR/unpacked bridge and fixed launch settings,
and owns the child's atomic Windows Job. Production uses Windows OS APIs and the
existing Electron Node-API ABI; PowerShell is only a development/test wrapper.

The private release descriptor is a strict version1 object with exactly these
fields: `version`, `mode`, `buildIdentity`, `sourceRoot`, `sourceSchema`,
`sourceFormat`, `archiveExpectation`, `privateBase`, `exeSha256`, `asarSha256`,
`bridgeSha256`, `bootstrapSha256`, `electron`, `node`, `napi`. Launch/runtime paths
and mode must match the fixed compiled release constants. Only Root's protected
descriptor binds the source path; argv, environment and native parameters cannot
select it. It cannot select a command, module or cwd. Expected schema is `v3`; expected source format
is `json` or `sqlite`; archive expectation is `present` or `optional-at-epoch`.
The descriptor and detailed receipts belong in the protected private handoff.

The native module has one zero-argument method. After authenticating the live
launcher, its consumed tail binds source/ancestor handles with read-only access
and no write/delete sharing. SQLite requires its existing main/WAL/SHM trio and
the exact runtime's read-only transaction support under those holds. JSON is read
through its existing held handle. The complete initial state baseline precedes
the archive lookup. A missing optional archive has only the reviewed native
point-epoch meaning, not absence at close or throughout the session.

SQLite closes on success and every reachable failure before the renderer opens
or teardown begins. Paging uses the retained immutable image. Native source
handles remain held until environment teardown, where full identity/length/hash
comparison precedes final receipt flush and handle disposal. The UI labels the
initial protected snapshot and final comparison as pending until close. Native
comparison alone is not a clean-reader result: the bootstrap also requires the
actual successful child exit, bound completion object and empty owned tree.
Any terminal JavaScript/renderer failure remains nonpassing. A crash or missing
cleanup receipt is a failure, even if a later source comparison happens to match.

The recovery document uses a separate renderer entry. Its sandboxed preload
exposes only a frozen `sunnyRecovery.bootstrap`, `snapshot`, `workspace`,
`transcriptPage`, `runInspection`, `localHistoryIndex` and `localHistoryPage`.
Main independently checks window/main-frame/navigation/bootstrap membership and
query shape. There is no ordinary `sunny` bridge, provider history fallback,
autosave, acceptance cue, Play, artifact verification or resume toggle.

Release order is final bootstrap bytes → verifier pin → final package and
unpacked bridge → descriptor seal. Generated native binaries are ignored build
outputs under `desktop/native`; packaging places the bootstrap beside the EXE
and unpacks the admission module. They must be built from the reviewed fixed
private release header before packaging. The old package is historical evidence,
not a compatible v3 rollback. No fallback is available until independent source
review, exact-package native security/nonmutation/lifecycle proof and the
concrete private handoff pass. Current source and unit tests do not establish
that release gate by themselves.
