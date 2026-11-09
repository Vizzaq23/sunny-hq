# M3 — Continuous crew workflow (2026-11-08)

## Local release qualification — completed run, release blocked

The separately packaged candidate from clean `50bb8c432d1dc87004ab23af41a516a0bb5f2670` completed the local matrix: **12 accepted, 6 failed, all 18 with observed cleanup and zero remaining owned processes**. This is a failed release qualification, not completion of M3. The execution gate remains closed in both source and the actual archive. No M4 work, installation, daily-profile change, provider connection, test weakening or application-code change was made during this qualification.

[Machine-readable qualification evidence](evidence/crew-workflow-m3-2026-11-08/release-qualification.json) contains supervisor/job receipts, phase outcomes, raw timing metrics, assertion outcomes, bounded progress and hashes/locations of retained raw artifacts. The candidate is `.sunny-dev/m3-release-candidate/win-unpacked`; raw evidence and disposable profiles are `.sunny-dev/m3-release-qualification`. All cases ran sequentially through the existing `scripts/packaged-supervisor.cjs` and atomic Windows Job harness. No failed batch was replaced with a selected passing rerun.

Fresh build/typecheck and unpacked Windows x64 packaging passed. Application fingerprint remains `7e152a4211b00556ecdc5b11fcfef2330604d32a31365c69b4231d551f57be10`, matching the previously validated application. The prior 1,762-test/full-native evidence below still applies to unchanged application inputs; the full source suite was not rerun for documentation-only changes. Electron is 44.4.3; the candidate's Authenticode status is **NotSigned**, so no signed-installer qualification is claimed.

- EXE SHA-256: `eb8f6085fe5c438fa75d75ef95a49a6eeb994a217626e7fcf0255032a6dc6a67`.
- ASAR SHA-256: `d05918304e26e0c78340c68b8fa3039b757c776292d97f3490b4fda81f56016f`.
- Packed closed-gate module SHA-256: `92b0fa1237bcc772160abd0555bb40dfbb45cada1c2924899fca6f66bf0855c8`.

| Qualification | Result |
| --- | --- |
| Startup, renderer crash, main restart, worker loss, write failure, lost acknowledgement, pending approval, pending check, normal quit | All nine accepted; real packaged persistence/IPC with offline provider boundary |
| Playable result | Accepted across two processes: real local fixture interaction, Stop, feedback retention and restart; synthetic review metadata, no human mission acceptance |
| Run-status UI | Failed in phase one: `.run-status` never showed `Crew working`; later states/restart not reached |
| User reduced motion, OS reduced motion, audio | All three failed restoring Franky room after source review; acceptance/cue/motion/audio conclusions not earned |
| Two-build journey/cue | Failed at unchanged 300,000 ms deadline (supervisor elapsed 300,080 ms); first reviewed runtime stopped and feedback attempt started, second full journey not completed |
| Ordered controls, 1 / 10 MiB | Both accepted with all 20 Stop + 20 approval measurements, six warmups and full-state readback |
| Ordered controls, 30 MiB | Failed approval p95 limit; all 40 operations and correctness checks completed, no control-effect failures |

| History | Stop p95 (ms) | Approval p95 (ms) | Maximum continuous main timer excess (ms) | Outcome |
| --- | ---: | ---: | ---: | --- |
| 1 MiB | 65.0 | 64.2 | 17.01 | Pass |
| 10 MiB | 69.6 | 93.3 | 30.29 | Pass |
| 30 MiB | 191.9 | 263.2 | 81.68 | Fail: approval p95 must be <200 |

Supplementary timer maxima also stayed below 100 ms. Historical failures are retained; these fresh results do not imply a paired performance speedup or waive the failed 30 MiB gate. The evidence writer correctly refused a passing phase receipt for that case. Expected rejection logs within the passing playable scenario are separate from its accepted supervisor result.

### Findings and remaining work within M3

Source inspection explains the room-restoration failure: `src/App.tsx` initializes the view to Home and restores a saved workbench on startup, but does not select Ship for saved `surface: franky`; `inFrankyRoom` requires Ship. The three failed cases reached `source-reviewed` at 98.128, 91.689 and 93.077 seconds respectively, then timed out in `waitForRenderer` after setting Franky context and reloading. This was an inner readiness failure, not their 120-second outer limit. Separately, the run UI fixture expects the status panel immediately after reload while the current app only renders that panel on Missions. Fix and verify navigation/restoration and explicit fixture navigation without removing the behavior assertions; these are not accepted UI checks.

The two-build case recorded first source review at 206.223 seconds, runtime stopped at 214.517 seconds and feedback started at 219.683 seconds. The outer deadline expired before the second completion. A [bounded read-only observation](evidence/crew-workflow-m3-2026-11-08/qualification-cue-observation.json) records the first completed delivery and second collecting delivery; it contains identities/status only, no prompts. It is an intermediate observation, not a restart or completion claim. Investigate the time distribution before attempting a performance repair; keep the existing deadline.

Remaining release requirements include repairing/requalifying these six failures, a separately admitted native stopped-profile capture, real-provider containment/pending-request replay proof, hosted CI eligibility, and the separate human release decision. `stopped-profile-copy` uses a distinct native capture protocol and is not admitted by the ordinary packaged wrapper; no capability was fabricated and no daily profile was stopped/copied for this run. The saved GitHub billing/account-admission annotation remains an external blocker; this local qualification did not recheck billing or modify account settings. No new real-provider or continuous human-accepted crew journey is claimed.

Reproduction: build with the documented direct Node/npm CLI, then `node node_modules/electron-builder/cli.js --dir --win --x64 --config.directories.output=.sunny-dev/m3-release-candidate`. For each case create fresh disjoint profile/output directories and invoke `node scripts/packaged-supervisor.cjs` with absolute `--exe`, `--asar`, `--profile`, `--out`, plus `--scenario`, `--mib`, and `--timeout-ms`. This matrix used 300000 for ordered controls and journey-cue, 120000 for other cases; controls used 1/10/30 MiB, other cases 1 MiB. Never reuse a consumed fixture profile or install this failed candidate as a qualification step.

## Verified handoff milestone; live M3 remains blocked

Clean implementation `df3288ac1dcdfd3a38a4528efecdf09569896bb3` passed **1,762 local tests**, zero failures/cancellations/skips, clean dependency installation, build/typecheck, all **68 native workflow checks**, and the dedicated council UI fixture. All 1,745 M2 top-level results remain, with seven handoff regressions added. Native results are explicitly synthetic; the clean-candidate mobile screenshot was visually inspected. [Final receipt](evidence/crew-workflow-m3-2026-11-08/verification-final.json), [test parity](evidence/crew-workflow-m3-2026-11-08/test-parity.json), [saved brief screenshot](evidence/crew-workflow-m3-2026-11-08/council-handoff-snapshot-mobile.png). Build fingerprint: `7e152a4211b00556ecdc5b11fcfef2330604d32a31365c69b4231d551f57be10`.

GitHub [run42527426476](https://github.com/Vizzaq23/sunny-hq/actions/runs/42527426476) did not start its jobs: the authenticated annotation reports failed recent account payments or a spending-limit restriction. The same restriction explains M2's aggregate job failure; its actual test shards passed. [Saved hosting annotation](evidence/crew-workflow-m3-2026-11-08/hosting-annotation.json). No billing setting was changed, and no hosted-green claim is made.

The continuity repair and its UI are verified. **The full M3 milestone is not complete:** no continuous real council→execution→checks→captain acceptance/rework journey was run. Normal admission remains closed. Source/fixture checks cannot replace the separate release qualification and human decision, and no fixture capability was used with a real provider. No M4, installed-app update, daily-profile mutation, merge or deployment occurred.

Base: M2 evidence8fa4e79, applicationb1e2d44. Branch codex/crew-workflow-m3-20261108. The captain requested M3 after final M2 evidence was saved. The canonical seven-part roadmap is docs/agent-platform-roadmap.md; its existing primary-checkout edit is copied here, not overwritten there.

## Admission and evidence boundary

Normal supervised execution remains disabled by desktop/supervised-runs.cjs. No profile, environment switch, renderer action or real provider probe may bypass it. Existing constructor-injected offline fixtures stay explicitly synthetic. Completing this development work is not M3 live acceptance or release authorization.

| Prerequisite | Current evidence | Remaining requirement |
| --- | --- | --- |
| Full source baseline | M2:1755tests and both hosted installs/build/native passed; M3:1762 local tests/build/native passed | GitHub account eligibility blocks jobs, including the M2 aggregate; billing/spending-limit annotation saved |
| Approval/reconnect | M1/M2 real-provider isolated journey passed | Live pending-request replay not observed; do not imply replay proof |
| Recovery and containment | Existing bounded-work, uncertainty, restart, owned-process tests | Fresh exact-package containment/control/recovery qualification; historical package failures are not waived |
| Continuous crew journey | Separate council and supervised journey fixtures exist | One linked real journey through selected brief, execution, checks, review and explicit acceptance/rework |
| Human release decision | None | Separate review of complete prerequisites; gate remains closed |

## Verified continuity gap and bounded implementation

LocalCouncil.handoff currently persists pending before calling startGoal, but only learns mission/run IDs after the call returns. A lost response can leave a real mission with an unlinked council. The selected edited brief is also absent from the pending record. Existing duplicate refusal prevents retries, but does not supply the missing correlation.

Reserve main-generated mission/run identities and an immutable copy of the reviewed brief in the pending handoff before calling the existing goal path. Pass identities through a private main-process option, never a renderer-supplied goal field. Mission creation rejects an existing reserved identity. Successful results must match those identities; mismatches remain unknown. A pending/unknown handoff retains its identities and selected brief after restart without automatically submitting or reconciling work. The mission/run/task/attempt/branch/check/result remain owned by existing services.

Only the edited title/objective/criteria reach startGoal. Do not append council transcripts, journal recall, other contributions or prior topics. Default diagnostics continue to omit these private fields. The existing release gate runs before any pending handoff receipt or goal creation.

## Additive persistence and rollback, before code

Optional handoff version2 fields: missionId/runId (main-generated UUIDs already reserved before dispatch), reviewedBrief {title,objective,acceptanceCriteria,completionBoundary:review}, and briefSha256. Existing status/time/task/error fields remain. Loader validates version2 brief/digest/identities; malformed records remain fenced unknown and never acquire execution authority. Old handoffs retain their original limited evidence; never backfill a reviewed snapshot.

No database/schema-version migration or production-profile edit. Use isolated fixture stores. Existing profile backups include the optional fields; keep a current export before any later installation. Older code may ignore the new fields but still preserves pending as unknown and duplicate refusal; downgrade loses the extra reviewed-brief view, not permission to retry. Roll back source without restoring an older profile.

## Acceptance and validation

- Pending persistence contains exact reviewed brief and reserved IDs before any goal call; definite save failure causes zero calls, uncertain failure stays fenced.
- Return loss, duplicate click, mismatched result IDs and restart retain one identity; no fallback launch or automatic replay.
- Real Hub mission creation uses the reserved identity and rejects collisions; normal public goal/mission inputs cannot choose IDs.
- Closed gate rejects before receipt, mission, provider or workspace effects. Existing direct tasks/advice-only councils remain covered.
- Build and relevant persistence/council/mission regressions; explicit synthetic integration evidence is separate from live evidence.
- Full M3 remains incomplete until a single real continuous success/rework/stop/reconnect journey and all release prerequisites are reviewed. Do not open admission to manufacture that evidence.

## Implementation checkpoint

Pending handoffs now retain main-generated IDs and the exact selected brief/digest. Hub binds the private council option to that pending record and rejects edited scope/collisions; public goal/mission arguments still reject identity injection. Normal closed admission rejects before all effects. The renderer exposes the saved brief via an ordinary keyboard-operable disclosure; the public projection includes only explicit fields, and M2 diagnostics still omit private brief text.

Clean npm ci, build/typecheck and105focused tests passed; after strengthening the reply-loss test to create actual Hub records before losing the response, all7handoff regressions passed again. Dedicated native council fixture passed, including closed launch, keyboard disclosure and narrow layout. Mobile screenshot visually inspected and saved with synthetic-model receipt under docs/evidence/crew-workflow-m3-2026-11-08. Earlier native failures found a missing renderer projection field (fixed and regression-tested), then an incorrect fixture key/focus sequence (corrected to existing Enter handling). Initial unit fixtures lacked configured local profiles and expected absent taskId rather than loader normalization; corrected fixture setup, not application authority assertions. Failure logs retained in ignored scratch.

This implementation checkpoint's pending source validation is superseded by the final evidence above. No live crew execution, captain acceptance, rework loop or release qualification is claimed. M3 live exit criteria remain unmet; no gate change, installation or merge.

### Remaining exact-package qualification inventory

The existing private packaged-acceptance entry point supplies `startup`, `renderer-crash`, `main-restart`, `worker-loss`, `write-failure`, `lost-ack`, `pending-approval`, `pending-check`, `normal-quit`, `ordered-control`, `run-ui`, `playable`, `stopped-profile-copy`, and the fixed `journey-cue`, `journey-motion-user`, `journey-motion-system`, `journey-audio` scenarios. Their existing scenario/phase/size/nonce and cleanup rules remain authoritative. This was the inventory before qualification; the fresh exact-package outcomes and remaining requirements are recorded above. Ordinary native workflow success does not replace them.

## 2026-11-08 qualification repair candidate

The failed exact-package measurements above remain retained. Restore the saved Franky/workbench host on startup and preserve the selected run. The run-UI fixture now enters Missions after reload and opens the island roster with Enter before testing its real tab order; all status, geometry, focus, scope and keyboard assertions remain.

Performance repairs batch independent Git identity reads while retaining fresh metadata/common-directory fences, stream runtime hashes in at most 1 MiB buffers with the same path/identity/mutation checks, and capture ordinary shallow profile trees without per-node traversal frames. Deep trees fall back to the existing iterative capture. No schema, timeout, percentile threshold or admission change. These are candidate optimizations, not a claimed release pass.

Focused checks: 9 work-context, 18 world-fixture and 41 snapshot/JSON/store/playable/workspace regression tests passed. New cases cover deep alias/accessor handling, bounded complete-file hashing and mutation rejection, and common-directory changes after Git replies. Logs remain in ignored .sunny-dev-m3-*-tests.log and .sunny-dev-m3-perf-regressions.log.

An intermediate package passed journey-motion-user in 95.431 seconds, but run-ui still failed at the then-closed island roster and journey-cue still exceeded its unchanged 300-second deadline. That package predates the final roster, streaming, capture and metadata-fence changes; it is not final qualification. Latest source needs fresh full tests/build/native and exact-package qualification.

Captain confirmed hosting billing eligibility is resolved and authorized retrying CI when fixes are ready. Hold the public announcement until full release qualification; proceed to M4 only after M3 prerequisites. LIVE_SUPERVISION_ADMITTED remains false. No install, merge or live admission is claimed.

Follow-up from c6c5f5c exact-package probing: 30 MiB ordered controls accepted (Stop p95 128.2 ms, approval p95 189.9 ms, zero operation failures), with observed contained cleanup. Run UI advanced through the status/room/disclosure checks but found that direct Luffy navigation now opens Home, not a workbench, and offers no return to the roster. Add a Back to crew action retaining its originating view/project room; restore focus by reopening ancestor disclosures. Update the native fixture to exercise that actual captain route while retaining Tab, Enter, return-focus and no-authority-effect assertions. This follow-up still needs qualification; the prior failure is retained.

The 9831ab2 package verified all 30 direct roster keyboard destinations and return focus, then exposed an obsolete task-art selector: room artwork now lives outside the conversation in RoomStation. Point the existing decoded-core/resident-absence checks at `.workspace-room-view > img`; do not remove image assertions or revert the independent room panel. New mission-evidence batching combines index flags/stages and full symbolic branch/commit reads, reducing seven Git children to five per source collection without caching. All 16 mission-evidence regressions pass, including detached and ambiguous-short-ref fingerprints, hidden index flags, submodules, nested roots and child draining. Two-build qualification still needs a new exact-package run.

Visual review of the passing 67b702c run-UI receipt found clipped primary navigation at 200% text: the fixed 70px desktop header could not contain enlarged labels. Keep the passing raw receipt but do not treat it as complete visual qualification. Let the desktop header grow, wrap navigation buttons with whole labels, and add an explicit native 200% label-containment assertion. Normal mobile navigation remains governed by its existing breakpoint. Fresh package and full validation are required for this visual correction.

The 67b702c two-build probe completed both source reviews (second at290.356s) but exceeded300s before the remaining runtime/acceptance/restart steps; cleanup observed. Combine managed workspace branch identity with its existing rev-parse read, leaving three independent ownership/ancestry children plus the fresh physical metadata fence. Ten workspace/routing/fence regressions passed, including ambiguous short refs, mismatched owner branch and detached HEAD rejection. No cached authority, lost ancestry guard or deadline change.

64f9571 run-UI rejected the first header repair: inherited `width:100%` made each non-shrinking navigation button consume a whole row, pushing the island map below its visibility requirement. This is an introduced CSS regression, not a pre-existing failure. Set explicit auto width for desktop navigation buttons; retain wrapping and the new enlarged-label assertion. The failed candidate receipt and screenshot remain under .sunny-dev/m3-64-qualification/run-ui-1. The continuing matrix identifies the old exact package; subsequent clean baseline validation will identify the corrected source independently.

Final bounded overhead follow-up: plain repositories resolve their existing non-linked .git directory through fresh filesystem identity checks; linked/unusual layouts retain Git resolution. Verification now rechecks the original project's common directory after all child reads as well as the managed-worktree fence. A new held-reply regression rejects a newly introduced original-project commondir pointer. Shallow snapshot capture uses one WeakMap with an active sentinel to detect cycles and preserve completed aliases, retaining the iterative deep fallback. All15snapshot/ownership fence regressions passed, including deep accessors and both managed/original pointer changes.

64f9571 control results:1/10MiB passed,30MiB approval p95 207.5ms failed (Stop133ms). A17.3-second focused regression run overlapped part of the30MiB measurement; retain this failed run and do not claim a paired isolated speed comparison. Final exact-package controls will run without other local tests. First journey phase completed at291.433s, including two source reviews and synthetic acceptance; the overall300s deadline still prevented restart qualification. These failures remain failures.
