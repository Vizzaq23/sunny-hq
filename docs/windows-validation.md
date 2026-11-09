# Windows validation baseline — M0, 2026-11-07

Scope: repair the Windows validation environment and prove the integrated baseline. The supervised execution release gate remains closed; no M1/live-provider work is included. Base: `c6aa0cab7893068c73a07ca16f12e6d4c9fe75b2` (PR #20 integration). Work occurs on `codex/windows-ci-baseline-20261107` in an isolated checkout. The separate saved seven-part roadmap is preserved in the planning checkout.

**M0 passed.** Implementation candidate `614b9233b335d687446da7e2e2aebb49e9d53bc8` passed complete hosted Windows validation. This establishes the baseline only; it does not admit supervised execution or establish real-provider approval/reconnect reliability.

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

Tool-cache installations can invoke their own Node/npm paths. Preflight requires clean tracked source, complete history and matching approved runtime bytes. The default runner performs locked installation, Electron installation, full serial tests, production build/typecheck and the hidden synthetic native workflow. CI runs Node's two disjoint test shards on separate Windows machines (`--test-shard=1/2` and `--test-shard=2/2`), keeping file concurrency at one on each machine. Both shards run build/native checks and must pass the stable aggregate `Windows tests and build` check. Each receipt identifies its shard; one shard alone is not full-suite proof. The 75-minute per-job test limit is unchanged. Receipts include source/runtime identity and separate step results; a provider turn or synthetic fixture is never live provider proof.

New regressions exercise a real short-path temporary root through real workspace/admission checks, relocation of the exact approved executable, and rejection of altered executable bytes. Existing junction and ownership-negative checks remain enabled.

## Evidence status

Local unmodified reproduction: normal TEMP passes execution-workspace checks (4/4), including with CI's Git version. Short-path TEMP causes the same ownership error and fixture canonical-path rejection; original failure output remains retained in the investigation session. Initial clean dependency installation and production build passed. Eleven playable-launch tests and two validation regressions passed. Hidden native workflow completed successfully with forced reduced motion; its receipt explicitly reports synthetic transport and no live-provider proof.

Candidate `9c28e94` local full validation was stopped after the checkpoint deadline failure; its original log is retained at `.sunny-dev/pr-validation/2026-11-07T21-53-21.462Z/`. An earlier local validation was deliberately interrupted to avoid using an unusually deep diagnostic temp directory; it is not a completed check. [Hosted candidate run 42417861104](https://github.com/Vizzaq23/sunny-hq/actions/runs/42417861104) was cancelled for replacement after the additional latency diagnosis, with 174 passing results and no recorded failures at cancellation. Partial successes do not establish a green baseline.

Diagnostic profile: `.sunny-dev/checkpoint-profile.json` and `.sunny-dev/checkpoint-profile.log`. After concurrent reads, the original readonly-binding checkpoint regression passed in 126,247 ms with unchanged deadlines, retained strict rejection and no successor launch. All 15 mission-evidence regressions passed, including index flags, submodule refusal, stale evidence and draining failures.

Candidate `49afc8e` completed local clean validation: 1,735 tests passed, zero failures/cancellations/skips, tests 4,337,232 ms; install, build/typecheck and native all passed. Receipt: `.sunny-dev/pr-validation/2026-11-07T22-07-17.712Z/summary.json`. [Hosted run 42418976564](https://github.com/Vizzaq23/sunny-hq/actions/runs/42418976564) passed installation, build and native but tests timed out at 4,500,401 ms after 1,509 reported top-level results, with one manifest ACL failure. Downloaded receipts: `.sunny-dev/ci-final-49afc8e/`. This is not a green hosted baseline.

The remaining manifest failure occurs at the strict owner/ACL check: newly created files did not explicitly set their owner, and elevated Windows tokens can default to Administrators. The creation path now sets the current user as owner on the new empty file before private content is written. Existing-file validation remains strict; no ownership repair occurs on restart. Final hosted validation verifies this fix. The remaining suite exceeded the single hosted runner's capacity despite continued progress; two isolated CI shards retain every test and serial execution within each checkout, rather than increasing deadlines or sharing a concurrently mutated checkout. A regression verifies both shards cover disjoint fixture files exactly once and rejects invalid shard selections. Another verifies current-user ownership and rejection of widened existing permissions without changing content or repairing the ACL.

## Final baseline receipts

[Hosted run 42425354801](https://github.com/Vizzaq23/sunny-hq/actions/runs/42425354801) passed both matrix jobs and the aggregate `Windows tests and build` check on implementation candidate `614b923`. Each job independently passed clean locked installation, Electron installation, tests, production build/typecheck and hidden native workflow.

| Receipt | Tests passed | Test duration | Failures / cancelled / skipped |
| --- | ---: | ---: | --- |
| Windows shard 1/2 | 781 | 3,437,964 ms (57m 18s) | 0 / 0 / 0 |
| Windows shard 2/2 | 956 | 1,644,232 ms (27m 24s) | 0 / 0 / 0 |
| Complete suite | **1,737** | Separate isolated machines | **0 / 0 / 0** |

Compared the multiset of top-level passing test names with the earlier complete local run: all 1,725 prior results remain, plus exactly the two new manifest/shard regressions, producing 1,727 top-level results and 1,737 tests including nested tests. No prior result is missing. Both receipts identify Node 24.18.0 with the approved hash, the exact clean source commit, and build fingerprint `24d28ba29fe404d99900b488d3209528e2b9293d620bce2f62cd33ee1a474bbc`.

Downloaded hosted receipts, complete TAP logs and native screenshots: `.sunny-dev/ci-final-614b923/shard-1/` and `shard-2/` in this worktree. Hosted artifact retention is 14 days; these local copies retain the evidence beyond that window. The final candidate also passed local production build/typecheck and the full 68-check native workflow at `.sunny-dev/m0-native-614b923/`. Native receipts explicitly state `hidden: true`, `syntheticTransport: true`, `liveProviderProof: false`.

No tests were disabled and no deadlines increased. The default unsharded validation still runs the full serial test command. `LIVE_SUPERVISION_ADMITTED=false` is unchanged. No M1 work, merge, installed-app update or production-profile change occurred. The planning checkout's 150-line roadmap addition and other worktrees remain untouched. Next milestone, only when requested: M1 real-provider approval/reconnect verification; keep the separate execution release gate closed.

## Intermittent fixture investigation — 2026-11-09

The contrast candidate ff08a25 recorded 1,799 passes and three failures in its full 1,802-test run. A mission-evidence fixture failed before exercising the application because Windows denied rewriting its newly created `.git/config`. That fixture now passes its synthetic author identity through Git command options instead of rewriting the config twice. This removes the unnecessary setup writes; it does not retry commands or weaken runtime filesystem checks.

The other two failures returned `blocked` before the malformed-review and durable-selection assertions were reached. Successful unchanged reruns did not establish their cause. Delivery assertions now retain the outcome, recorded reason code/reason, and fixture errors so a recurrence identifies the failed prerequisite. Assertions and recovery guarantees remain unchanged. Diagnostic artifacts are in `.sunny-dev/delivery-investigation/`; the investigation is not yet a claim that all three causes are fixed.

Candidate `538acd7` completed clean Node 24 validation with 1,802/1,802 tests, build/typecheck and the hidden native workflow passing. The original three failing tests all passed in that run. Additional diagnostic runs passed: 16 evidence tests, all 40 journey tests, 12 malformed-review repeats, 24 production-delivery probes alternating request timing, and 100 immediate committed-source reads. A controlled Windows read handle reproduced the original config-write denial; the new command-scoped identity committed successfully under that same lock. This establishes the fixture repair without attributing the real denial to an unobserved process. The two original delivery causes remain unconfirmed despite the passing runs.

The preceding hosted run `42682932550` on `197dcae` exposed a separate native fixture race: shard 1's unit tests/build passed, but the profile test timed out waiting for **Stop other local reply**; shard 2 passed. The fixture closed and reopened the profile before observing its unmount, so it could retain the active `launch` project instead of starting a fresh profile. Reducing the isolated renderer to one frame per second reproduced that exact failure. The fixture now waits for actual dialog absence before reopening and presence before interacting. This also makes the saved-draft assertion exercise a fresh profile. Expected outcomes, deadlines, application code, permissions and persistence remain unchanged. The focused slow-rendering and complete native checks qualify this change separately from the preceding unit-test candidate.
