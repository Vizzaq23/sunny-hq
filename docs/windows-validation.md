# Windows validation baseline — M0, 2026-11-07

Scope: repair the Windows validation environment and prove the integrated baseline. The supervised execution release gate remains closed; no M1/live-provider work is included. Base: `c6aa0cab7893068c73a07ca16f12e6d4c9fe75b2` (PR #20 integration). Work occurs on `codex/windows-ci-baseline-20261107` in an isolated checkout. The separate saved seven-part roadmap is preserved in the planning checkout.

## Original failure

[Run 42331703723](https://github.com/Vizzaq23/sunny-hq/actions/runs/42331703723), artifact `13560002433`: Windows Server 2025, Git 2.56.0.windows.4, Node 24.22.2. Installation and build passed. Tests timed out after 4,500,186 ms, with 1,335 passing and 100 failing reported results before truncation (not the complete suite total). Native workflow separately timed out waiting for full motion.

Downloaded original receipts are retained at the primary checkout's `.sunny-dev/timeout-investigation-42331703723/`; `failures.json` inventories the 100 reported failures. They include 28 scheduler waits explicitly reporting Git ownership mismatch, five direct ownership errors, 17 direct fixture-alias errors, 11 executable-byte errors, and cascading assertions/errors. Nested TAP failures and their parent failure are not independent causes.

## Causes and bounded changes

1. **Short temporary paths.** The hosted search-test diff explicitly compares `C:\Users\RUNNER~1\...` with `C:\Users\runneradmin\...`. Node's non-native realpath and Git/native path resolution disagree on that spelling. Setting local TEMP/TMP to an actual 8.3 alias reproduces workspace ownership and packaged-admission failures; the same unmodified tests pass with canonical TEMP. Git 2.56.0.windows.4 also passes locally with canonical paths. Validation now expands the temporary directory with native realpath before spawning child steps, removing case-variant TEMP/TMP keys. Application ownership, junction and fixture admission guards are unchanged.
2. **Runtime mismatch.** Playable acceptance deliberately pins Node 24.18.0 x64 and SHA-256 `9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de`; CI previously selected a moving Node 24 release and the implementation assumed a developer-machine installation path. CI now selects 24.18.0. Headless invocation uses its explicitly launched executable, still checking the exact pinned hash/version before launch. Electron retains its existing installed-runtime path. Preflight checks this requirement before the long suite. No arbitrary runtime, environment override, or unverified executable is admitted.
3. **Host motion preference.** The fixture expected full motion after disabling the app preference without setting the OS preference. Full motion is not valid when the host requests reduced motion. The native fixture now emulates both OS preferences in its own window, tests app-only/OS-only/both reduction and full motion, and restores emulation afterward. Host accessibility settings and product behavior are unchanged.
4. **Sequential evidence-read latency.** After correcting the environment, local full validation reached a genuine checkpoint handoff but exceeded its existing wait. A diagnostic-only observation (not a passing validation receipt) completed the same case in 160,986 ms, with 1,748 asynchronous Git calls and 82 evidence snapshots. A snapshot's six independent metadata reads were sequential, repeatedly paying Windows subprocess startup costs. `MissionEvidence.gitState` now starts those six reads together after repository membership is checked, waits for every child even when one rejects, and retains every existing flags/submodule/content check and later freshness boundary. No snapshot is cached and no timeout is raised. A deterministic regression verifies concurrent progress and draining before rejection.

Alternatives rejected: increasing the global timeout without fixing failures; weakening canonical/ownership checks; accepting any installed Node binary; changing the host's accessibility settings. No dependencies or persistence schema changed. Rollback is a focused revert of these code/workflow changes; no profile restoration is needed.

## Validation contract

Use Windows x64 and the pinned Node 24.18.0 executable. Run through its matching npm CLI:

```powershell
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run validate:windows
```

Tool-cache installations can invoke their own Node/npm paths. Preflight requires clean tracked source, complete history and matching approved runtime bytes. The runner performs locked installation, Electron installation, full serial tests, production build/typecheck and the hidden synthetic native workflow. The 75-minute test limit is unchanged. Receipts include source/runtime identity and separate step results; a provider turn or synthetic fixture is never live provider proof.

New regressions exercise a real short-path temporary root through real workspace/admission checks, relocation of the exact approved executable, and rejection of altered executable bytes. Existing junction and ownership-negative checks remain enabled.

## Evidence status

Local unmodified reproduction: normal TEMP passes execution-workspace checks (4/4), including with CI's Git version. Short-path TEMP causes the same ownership error and fixture canonical-path rejection; original failure output remains retained in the investigation session. Initial clean dependency installation and production build passed. Eleven playable-launch tests and two validation regressions passed. Hidden native workflow completed successfully with forced reduced motion; its receipt explicitly reports synthetic transport and no live-provider proof.

Candidate `9c28e94` local full validation was stopped after the checkpoint deadline failure; its original log is retained at `.sunny-dev/pr-validation/2026-11-07T21-53-21.462Z/`. An earlier local validation was deliberately interrupted to avoid using an unusually deep diagnostic temp directory; it is not a completed check. [Hosted candidate run 42417861104](https://github.com/Vizzaq23/sunny-hq/actions/runs/42417861104) was cancelled for replacement after the additional latency diagnosis, with 174 passing results and no recorded failures at cancellation. Partial successes do not establish a green baseline.

Diagnostic profile: `.sunny-dev/checkpoint-profile.json` and `.sunny-dev/checkpoint-profile.log`. After concurrent reads, the original readonly-binding checkpoint regression passed in 126,247 ms with unchanged deadlines, retained strict rejection and no successor launch. All 15 mission-evidence regressions passed, including index flags, submodule refusal, stale evidence and draining failures. Final revised-candidate full-suite and hosted evidence are pending and must be recorded before M0 is called complete. M1 remains out of scope.
