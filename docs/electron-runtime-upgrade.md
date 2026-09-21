# Electron security upgrade — 2026-09-21

The full-goal audit reproduced two high-severity vulnerable packages in the existing locked dependency tree: Electron 38.8.6 and its `extract-zip` dependency. Upgrade the development runtime to exact Electron 44.4.3, preserving the captain's unrelated version/package edits. Do not run a blind force fix or replace the installed Sunny application/profile as part of this source change.

## Sources and compatibility decision

- [Official Electron 44.4.3 release](https://github.com/electron/electron/releases/tag/v44.4.3), verified against the official repository and npm package metadata. The package uses `@electron-internal/extract-zip` instead of the vulnerable `extract-zip` package.
- [Reviewed extraction advisory](https://github.com/advisories/GHSA-jmr9-qjv8-65gv): affected `extract-zip` releases have no listed patched version. The upgrade removes that package from Sunny's locked tree rather than suppressing the finding.
- [Official breaking changes](https://www.electronjs.org/docs/latest/breaking-changes), versions 39–44: Sunny targets Windows x64 and uses an isolated preload. The capture-request clipboard write now awaits its asynchronous result. No direct renderer Electron clipboard API is used. Offscreen rendering's new scale default is covered by the native fixture. No shared-texture paint handler, cookie observer or PDF guest-WebContents dependency was found in the inspected app paths.

Electron 42+ downloads its runtime on first CLI use instead of npm postinstall. `npm run desktop` uses that CLI. For checks invoking `node_modules/electron/dist/electron.exe` directly, first run `node node_modules/electron/install.js` after the locked install. This is the installed official package's downloader; no new global installer or account is required. Node 24 meets this package's `>=22.12.0` install requirement.

Windows dialogs without an explicit initial folder now start at Downloads. This documented upstream default is accepted; no extra application preference/state is introduced. The app's explicit context isolation, sandbox, disabled Node integration and trusted-frame checks remain unchanged.

## Verification

Isolated committed-source candidate: `sunny-electron-upgrade-49ea0510e0164974a80240edef53caf5` in OS temporary storage.

- Dependency install succeeded; `npm audit --json` exited 0 with zero known vulnerabilities. This is the registry advisory result at verification time, not a guarantee against unknown vulnerabilities.
- 243 Node tests passed, zero skipped. Production build and TypeScript check passed; Vite 18.45 seconds, existing large CodeEditor chunk warning.
- Actual Electron 44.4.3 native mission fixture passed the full coordinated project-room/branch/local-check/synthetic-PR/review/acceptance/receipt/reload path, including crew motion and written-file preview. Provider and GitHub transports remain synthetic; no account calls were made.
- Native runtime probe confirmed Electron 44.4.3 / Node 24.21.0, an actual SQLite round trip through Sunny's `SqliteStore`, and a real node-pty/ConPTY PowerShell child with captured output and clean exit.
- Electron Builder 26.15.3 produced an unpacked Windows x64 app using Electron 44.4.3. Signing and executable resource editing were explicitly disabled for this temporary packaging check; no installer, signed release, publication or installed-profile migration is claimed. The first CLI invocation failed because PowerShell split an unquoted configuration argument; quoting the full argument corrected the invocation.

Native screenshots and logs are local validation artifacts, not remote workflow proof. Optional package install-script warnings remain under the user's existing policy; no policy override was introduced. Before release, run the normal signed packaging/release process and validate the installed app separately.

The integrated working tree with the user's preserved 0.11.0 overlay also passes all 260 tests and the build/typecheck (17.55 seconds). The curated staged package/lock objects and main-process source match the isolated candidate after line-ending normalization. Independent upgrade review found no actionable defect; its noted Downloads-dialog default is documented above.

## Rollback and ownership

This is a runtime/lockfile update plus one awaited API call, with no Sunny persistence schema change. Existing mission backup/rollback rules still apply. Do not open a live upgraded Chromium profile with an older runtime as a casual rollback experiment; tests use temporary profiles.

The user's working version 0.11.0 remains intact. The security commit must retain HEAD's original version metadata in its staged package files so it does not claim the user's pending release bump. The only newly staged main-process change is awaiting the clipboard call; pre-existing Home/preview/broadcast changes remain outside this commit.
