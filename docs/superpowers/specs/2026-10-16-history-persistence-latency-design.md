# History persistence latency repair — design, 2026-10-16

Status: approved by the captain on 2026-10-16; implementation has not started. The implementation plan is awaiting review. Scope: fix the measured control latency blocker on `codex/integrate-local-sunny`, then complete the already-authorized installed update after validation and a closed-profile backup. This is an architectural storage change, not a relaxation of acceptance limits.

## Requirement and evidence

Stop and approval completion must remain below 200 ms p95 with 1, 10 and 30 MiB histories under pending background persistence; main timer excess must remain at most 100 ms. All history, drafts, opaque fields, ordered intent/receipt barriers, uncertain reservations and WAL/FULL durability remain mandatory. The renderer must never receive a successful durable result before commit. See `docs/reliability-baseline.md` and `docs/evidence/integration-validation-2026-10-16.json` for the failed packaged measurements and successful recovery/journey checks.

A new isolated synthetic probe (`.sunny-dev/integration/mutated-timing.cjs`, retained JSONL) changes the frozen history by 64 characters and then changes a control status. At 30 MiB, observed whole-image cloning took 49–68 ms, preparation 64–99 ms, SHA-256 31–43 ms, and SQLite writes 152–229 ms per receipt. These diagnostic samples are not acceptance evidence. They demonstrate that eliminating UI rendering or one redundant validation cannot satisfy a control path requiring multiple whole-history durable writes.

## Decision

Retain one ordered persistence worker and SQLite WAL/FULL. Replace physical whole-document rewrites with transactional storage of immutable JSON text fragments and a small ordered layout. Keep a read-only `state` compatibility view whose `value` reconstructs the exact current compact JSON. Existing independent readers continue to inspect complete logical state; no fixture transcript truncation or optimistic acknowledgements are introduced.

Use an incremental JSON encoder inside the worker. It retains serialized unchanged subtrees and yields ordered UTF-8 fragments, dividing large strings/arrays into fragments of at most 64 KiB at UTF-8-safe boundaries. Reuse unchanged prefix/suffix fragments when a long string changes; appending a small suffix must not rewrite the preceding string fragments. A tiny task status or message edit replaces only its affected fragments and layout. The exact whole-state SHA-256 is streamed over all current fragments in order before commit; no flattened full-document copy or full JSON parse is required on each commit. Hashing remains real work in the measured path. Fragment IDs identify immutable bytes, never mutable object identities alone.

Main-process snapshot capture must preserve value isolation without copying unchanged string bytes. An iterative object/array copy retains immutable primitive strings, rejects unsupported values consistently with the persisted JSON contract, and handles aliases/cycles without exposing mutable references. It compares captured values against the last submitted snapshot to produce bounded, generation-bound patches for the worker. It must detect in-place edits even when no task revision was bumped. First boot/full replacement sends complete state; later commits send changed values. Patch messages are capped at 1 MiB; larger imports use the validated full-replacement route and retain normal durability guarantees. Ordinary control edits use small patches. Queue saturation, capture timing, required barrier ordering and uncertain-worker behavior retain their existing semantics.

## SQLite representation and atomicity

- `profile_meta`: singleton format version 1, monotonic generation, exact state SHA-256 and ordered fragment layout.
- `profile_fragments`: immutable fragment ID and exact UTF-8 text bytes. Repeated fragments may be referenced more than once.
- `state` view: one row with `id=1` and the ordered concatenation of referenced fragment bytes as `value`. The view must reproduce `JSON.stringify` compact bytes, including non-ASCII text, escaping, property ordering and omitted object `undefined` fields. Tests compare independent raw bytes and digest, not only semantic object equality.

Each required save uses one SQLite transaction: insert missing fragments, replace metadata/layout, and remove only fragments no longer reachable from the committed layout. A crash yields the entire old or entire new generation. Publication waits for transaction commit under synchronous FULL. Existing worker epoch/sequence/prepared hash/committed hash checks remain. Missing fragments, invalid layout, generation mismatch, digest mismatch or a lost acknowledgement fail closed and retain recovery state; startup never silently supplies defaults.

Patch messages bind their base generation and have strict operation/path/value validation. A stale, duplicate or malformed patch cannot partially mutate the worker's committed image. Apply into an isolated candidate; validate complete mission authority and task bindings, generate bytes, commit, then replace the worker's current image. Failure before commit discards the candidate. No concurrent writer, renderer bridge expansion or new dependency is required.

## Compatibility, migration and backup

Before implementation, extend the authoritative persistence documentation with this format and supported transitions. The normal worker recognizes legacy SQLite and the new format explicitly. Legacy JSON profiles continue using their existing atomic JSON writer; no performance claim is made for that fallback.

For legacy SQLite, first validate the complete existing profile read-only and make a separate verified SQLite backup of the closed logical database, recording its SHA-256 and source format. WAL data must be included by the SQLite backup mechanism or by a closed/checkpointed complete-profile copy; copying only an active main database file is forbidden. Migration then creates fragment tables and the compatibility view atomically. Verify the reconstructed bytes, logical state and digest against the pre-migration profile before publishing the new format. A failed migration leaves the original format usable and the verified backup preserved. Opening an already migrated profile validates its format and integrity without migrating again.

Old binaries may read the compatibility view, but their INSERT/UPDATE into `state` must fail visibly. Do not provide write triggers that silently accept an old whole-state save or allow an older app to drop new fields. Downgrade is supported only with the prior executable and a separate verified pre-update profile copy. Never replace the current active profile with an older backup. The installed update still requires normal shutdown, hash-verified full-profile backup, copied-profile validation, exact package identity and a new durable release directory.

## Verification before promotion

1. Reproduce snapshot aliasing/in-place-edit and patch-generation failures before implementing their fixes. Preserve capture at submission, queued snapshot isolation, supersession and required-barrier saturation tests.
2. Verify encoder bytes against native `JSON.stringify` over Unicode (including surrogate pairs and lone surrogates), escape sequences, integer-like keys, arrays, null, non-finite numbers using native JSON null semantics, negative zero, omitted/undefined values, repeated references and unsupported/cyclic data. Preserve opaque nested values and full transcripts.
3. Exercise migration from supported mission versions and existing SQLite, JSON fallback, repeat open, failed backup, interrupted migration, corrupt/missing fragments, stale patches and unknown future formats on isolated profiles. Verify old writers cannot modify the new representation.
4. Crash before fragment insertion, before layout commit, after commit/before acknowledgement and during cleanup. Reopen with an independent reader; prove exactly old or new full state and no replay of provider effects or note writes. Repeat key crash windows three times.
5. Run focused save/retry/approval/mission/recovery checks, the complete source suite, build, production-transport workflow and nine contained packaged recovery scenarios. Re-run the isolated full mission/restart/acceptance journey on the exact final package.
6. Run the original frozen 1/10/30 MiB workload, all warmups and 40 controls per size, unchanged thresholds and exact whole-state readback. The view must allow the existing raw `SELECT value FROM state WHERE id=1` proof to remain independent of the optimized writer. Retain every failed batch; do not select a passing sample set or subtract queue waiting.
7. Review the full diff, schema migration and package evidence before the authorized backup/update. If the new architecture still misses limits, preserve evidence and reassess; do not promote it.

## Alternatives and consequences

Moving the existing full rewrite to a worker already prevents some main-thread blocking but leaves control completion too slow. Removing durable barriers, acknowledging early, truncating history or changing WAL/FULL would violate authority or durability and is rejected. A delta journal over a stale `state` row would mislead independent readers and older apps and is rejected. A general new database/framework adds unnecessary dependencies and migration surface.

The selected representation adds encoder, patch and fragment-integrity complexity. The compatibility view can be slower to read because it reconstructs the document; full reads are startup/export/proof operations, not control writes. Initial migration and full imports remain proportional to total history. Repeated small commits must not grow storage without bound; transactional reachability cleanup is required. The measured full SHA-256 cost remains a lower bound and must be included in final performance evidence.
