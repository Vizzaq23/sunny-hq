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

## Outcome: unresolved, no installation

[Diagnostic evidence](../evidence/approval-latency-2026-11-10/diagnostics.json)
retains all five trials. Indexed deletion alone still failed at287.2ms p95.
Additional timing diagnostics recorded208.3ms and215.6ms p95. One slow commit
spent about0.31ms updating rows but185.97ms inside SQLite COMMIT; other spikes
occurred below the auto-checkpoint threshold. This isolates the blocking stage,
not the underlying OS/filesystem cause. It does not establish faulty hardware.
A 256-page automatic-checkpoint experiment worsened p95 to364.5ms and was
reverted. Default checkpoint configuration and WAL/FULL remain unchanged.

The indexed-delete correctness/complexity improvement and optional timing probe
remain on the draft branch; they are not claimed as a latency repair. The final
92 focused storage, crash, ordered-capture and approval-boundary tests passed.
The installed smooth48ba1a0 package remains untouched. No full package acceptance
or production-ready claim. Next investigation must explain durable COMMIT stalls
or design a measured optimization that preserves required pre-dispatch and
post-response receipts; neither threshold relaxation nor a lucky passing rerun
is an acceptable completion criterion.

Final clean source58517a6 passed locked installation, build/typecheck and hidden native workflow. Local full-suite run was stopped incomplete (owned validator/process tree observed absent); hosted full validation42765100281 remains in progress at this checkpoint. No full-suite pass is claimed for this candidate.

## Shared immutable capture follow-up

The next candidate reduces synchronous work around the mandatory receipts.
`captureSharedProfile` traverses every live field and validates descriptors,
compares it to a privately sealed prior snapshot, and reuses only equal branches.
It never assumes mutable object identity or dirty-generation tracking implies no
change. Cycles/accessors remain rejected; sparse arrays, key order, aliases,
opaque data and deep fallback retain the existing capture semantics.

Background saves, approval-intent preparation and durable task outcomes use this
capture. Intent and mission mutations copy their affected branches; live intent
objects are not frozen. Ordered storage retains the privately sealed submitted
image as its comparison base, avoiding a second complete-history comparison on
subsequent saves. Mutable callers retain the original capture path. Sequence,
prepared/committed hash binding, uncertain-state failure, both approval receipts,
WAL/FULL and default checkpoints remain unchanged. This is memory ownership and
CPU optimization; no schema or migration changes. Revert these focused changes
to roll back; saved profile bytes remain compatible.

Exploratory frozen30MiB batch in
`.sunny-dev/ordered-control-check/2026-11-10T06-04-53-885Z-30MiB`
passed all assertions: approval p95=124.5ms, max=133.3ms, unchanged <200ms gate.
Store synchronous handoff dropped from about15-20ms to0.1-0.2ms per save in the
trace. This is exploratory evidence; final clean build/package qualification
is still required. Initial edit with a missing helper return failed tests and
was repaired before this batch; failed logs are retained in `.sunny-dev`.
