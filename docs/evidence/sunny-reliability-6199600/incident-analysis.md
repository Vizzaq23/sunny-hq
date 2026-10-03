# Sunny reliability diagnosis — 6199600

Slice A: **BLOCKED**. Task 3 follows its evidence-only hard branch. No causal spontaneous-crash reproduction exists, and a passing harness suite cannot make this task GREEN. Tasks 4–18 remain unimplemented under this branch. No production repair or installation promotion is authorized by this evidence.

## Incident and causal limits

Installed diagnostics classify three September 24 renderer exits as `oom` (-536870904) and one as `crashed` (-36861). Their records do not identify build/source/runtime, workload, payload, memory trend or user trigger. Current executable/ASAR hashes cannot identify an older incident retroactively. The user has not supplied the crash trigger. `spontaneousCrashCauseVerified` remains false. The existing summary projection, 256 KiB/100-segment transcript pages and three cached renderer pages are bounded local mitigations, not a renderer-wide memory cap or proof of the incident's cause.

## Frozen timing evidence

Historical frozen results are preserved as a labelled baseline, not replacement fresh evidence. All sizes contain 20 Stop and 20 approval samples with zero recorded control failures and exact history checks. Historical 10 MiB Stop/approval p95 were 417.6/595.7 ms; 30 MiB were 1176.4/1756.2 ms, with timer excess 132.045 ms. They fail the unchanged <200 ms control and <=100 ms timer gates. These measurements establish responsiveness failures, not the spontaneous OOM mechanism. Fresh raw source-runtime results and queue/durability waits are indexed in the measurement manifest; none may be selected out because it fails.

## Native evidence and boundaries

The reviewed Task 2 native matrix at source 619960007870bd2e1c2a2020dd449d55eebffef9 passed startup, renderer-crash, worker-loss, write-failure, lost-ack, pending-approval, pending-check, main-restart and normal-quit, with providerEffects=0 and owned-process exit proof. Executable SHA-256 d4aa6029e89f6052c6eefeecc517fa6b6898c6bb66f1a1bcd75ed1f9bb184fbb; ASAR SHA-256 8ec5842ec661c70bd0b89b4aff6a53aaec7a5ea1f00537a5e99b6d5cd38a8556. Runtime Electron 44.4.3 / Node 24.21.0 / Chromium 152.0.7977.130. Prior ba82be7, e27fbaa and 8bacf79 failed native evidence remains retained; subsequent harness corrections do not erase those failures.

Injected renderer death establishes controlled recovery, not spontaneous crash causality. Native worker fault scenarios use a separate real worker. Pending approval/check scenarios are not standalone restart proofs. A consistent stopped-profile copy/backup scenario is absent. Native individual invoke/workspace timings are not the frozen 1/10/30 MiB Stop/approval A4 workload. Source-runtime complete SQLite close/reopen proofs must be reported as source-runtime A4 only; no exact-package A4 proof is claimed. Missing full-state/no-history-loss raw proof or providerEffects=0 remains a blocker.

## Bounded next proposal

Run an isolated exact-package synthetic transcript mechanism probe only after a scoped probe addendum and independent review. Record numeric process working-set/private bytes, renderer heap used/total, serialized snapshot/event payload bytes, transcript-page byte/count totals, cached page count and sample timestamps; capture executable/ASAR/source/build/runtime hashes, frozen synthetic workload size and surface. Exercise startup, history navigation, live updates and reload on hub and companion, with no provider calls. Keep text, commands, paths, tokens and transcript content out of counters. Record all exits and all samples, including failed attempts. Compare original/new builds only if the original incident build can be established; otherwise label the result a synthetic mechanism experiment.

No causal production file/function/test/rollback can yet be named honestly. If a reproducible mechanism isolates a boundary, write a repair addendum identifying that exact file/function, causal regression, smallest diff, complete-state preservation checks, rollback and independent review before production edits. Repeated serialization/clone cost is a candidate to measure, not an established crash cause or sufficient latency cure. Storage-schema and GPU/security changes have no causal basis here.

## Gate evaluator scope

The test-only gate evaluates required fact completeness and frozen thresholds. It rejects false/unknown/missing causal, raw-native, full-state, no-provider-effects or timing facts, and historical 10/30 MiB failures. It does not authenticate a report, certify a package, reproduce a crash or grant promotion. A synthetic complete test report is labelled as such and earns no real gate proof.

Fresh matrix (milliseconds, nearest-rank p95; raw source/runtime/build identities and all values remain in the manifest):

| Size | Stop p95 | Approval p95 | Main timer max | Result |
| --- | ---: | ---: | ---: | --- |
| 1 MiB | 64.5 | 83.4 | 16.2022 | Timing PASS |
| 10 MiB | 394.3 | 569.7 | 44.4848 | Timing FAIL |
| 30 MiB | 1157.6 | 1721.9 | 101.1048 | Timing FAIL |

Each size retains all 20 actual Stop and 20 approval samples, six warmups, zero semantic failures, all sample complete-state checks and complete-state close/reopen receipt matching. Queue waits and required durable barriers remain included in control RTT. These source-runtime SQLite proofs establish no observed history loss for this fixture; they cannot fill the absent package A4 proof. No responsiveness repair is made.

Fresh source-runtime mission-deck journey: 33 assertions, zero errors, passed=true, coverageComplete=true; its exact raw receipt and digest are indexed. Product commit 6199600 passed 815 source tests, build and package before this documentation/test-only task. Package scenarios remain bound to that product commit. Original three protected checkouts retain HEAD/status/index hashes, installed ASAR remains E70B60892095E41E03AE851D893F7BE8A84BDE7725E004E68CC63C4083866819, and zero candidate runtime processes remain. Only allowlisted installed diagnostics were read; no live profile/database copy or mutation occurred. The raw final protection receipt is indexed rather than inferred from a clean task checkout.

Task-only verification: the final named evaluator contract RED run retained 25 tests, 21 passed / 4 intended failures; GREEN passed 25/25. Complete source suite after the docs/test-only diff passed 819/819, zero failed/cancelled/skipped. The initial sandbox attempt also retains an existing Windows private-manifest ACL environment failure; the normal desktop rerun isolates the four intended missing-evaluator failures. No new native package launch or rebuild occurred. These passing regressions prove rejection behavior; Slice A and Task 3 remain BLOCKED.
