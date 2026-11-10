# Approval storage latency — 2026-11-10

The installed smooth48ba1a0 package failed the frozen 30 MiB approval-response
gate at 292.2 ms p95 (<200 ms required). Both durable intent and submitted-outcome
receipts remain required; provider response ordering, WAL/FULL and thresholds
must not change.

An instrumented unchanged-storage run recorded commit spikes up to 149 ms
during approval warmups, while preparation took about 3 ms. Its measured batch
passed at 170.4 ms p95. This demonstrates variability, not a repair or proof that
one SQL statement explains every spike. Raw evidence remains in
`.sunny-dev/ordered-control-check/2026-11-10T05-47-00-620Z-30MiB`.

Every fragment commit previously deleted obsolete rows with a table-wide
`NOT IN` scan. The validated prior layout already identifies every owned row.
Use the difference between prior and next fragment IDs to delete retired rows
through the primary-key index within the existing transaction. Retained history
does not need scanning. Keep generation/digest validation and atomic metadata,
insert and delete publication unchanged. Optional worker timing diagnostics use
the existing latency-probe flag and emit durations only.

Alternatives rejected: relaxing latency limits, omitting durable receipts,
changing synchronous settings, or altering profile schema. There is no schema,
migration or backup-format change. Reverting the focused optimization restores
the previous algorithm; existing profiles remain compatible. Tests cover exact
bytes, shared/retired fragments, index use, restart and crash transaction points.
Final performance and package evidence will be recorded after validation.
