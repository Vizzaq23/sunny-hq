# Synthetic desktop IPC performance — September 30, 2026

The native fixture `desktop/ipc-performance-smoke.cjs` uses the real broadcast helper, sandboxed preload and built React interface with its own disposable Electron profile. It never constructs the live app or starts a provider. [Raw evidence](evidence/ipc-performance-2026-09-30.json) includes build identity, samples, memory and fixture context. This is synthetic evidence, not a measurement of the captain's saved profile or proof of a crash cause.

Electron 44.4.3 embeds Node 24.21.0. The measurement was taken at 19:31:52 UTC using the candidate's built interface, source base `5b70fb24` with the dirty flag true and source fingerprint `056d039e16b4f761ad95bbde1405c6140c65885faf9961dc7de21ffb03d53993`. It is not an installed-build test or packaged executable attestation.

After a warmup, five full-snapshot sends per size were acknowledged after two renderer animation frames. Ten streamed-task updates were spaced 50 ms apart. The nearest-rank p95 is the maximum for these small samples. Acknowledgement includes rendering/frame scheduling; it is not a pure IPC-transfer duration. A 20 ms renderer heartbeat and 10 ms main-loop monitor expose observed stalls. The host was shared with normal development work.

| Synthetic workload | Serialized bytes | Send p95 | Render acknowledgement p95 | Main-loop maximum | Renderer heartbeat maximum lag |
| --- | ---: | ---: | ---: | ---: | ---: |
| 100 tasks × 16 messages | 1,739,919 | 1.88 ms | 15.50 ms | 15.54 ms | 0.70 ms |
| 1,000 tasks × 16 messages | 17,399,019 | 10.24 ms | 69.71 ms | 20.58 ms | 41.80 ms |
| 3,000 tasks × 16 messages | 52,205,019 | 38.34 ms | 207.63 ms | 49.64 ms | 157.60 ms |
| One updated 2,000-message task among 100 tasks | 2,164,065 | 2.03 ms | 32.49 ms | 17.76 ms | 11.00 ms |

The main process sampled RSS at approximately 207 MiB after these scenarios; renderer memory and transient peaks were not measured. No provider request occurred. An earlier run produced a 208.51 ms large-snapshot acknowledgement, consistent with the observed size-dependent cost.

No IPC/state architecture change was implemented. A future proposal should evaluate bounded transcript delivery, explicit paging and state revision ordering against these fixtures; preserve initial-load correctness, late-snapshot guards, task updates and recovery. It must not truncate useful history or weaken sender/frame validation. Set separate budgets for transfer, renderer responsiveness and total completion, and measure realistic profile sizes before attributing a user's hang to this mechanism.

The separate [hang diagnostic experiment](evidence/renderer-hang-experiment-2026-09-30.json) completed a nine-second busy loop in a hidden native renderer without platform unresponsive/responsive events. That negative result is retained. Handler unit coverage does not establish native hang detection; see the canonical [renderer recovery document](renderer-recovery.md).
