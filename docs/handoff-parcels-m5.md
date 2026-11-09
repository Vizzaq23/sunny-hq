# M5 — Recorded crew handoffs — 2026-11-08

The captain prioritized M5 while M3 remains release-blocked. Work continues on `codex/finish-crew-voyage-20261108` from M4 `0bc09d9`. No release admission, installation or merge is authorized by this implementation.

## Decision and boundaries

Add an on-demand, read-only `mission:handoffs` query and a Crew handoffs dialog in the voyage bar. Bind every query to project, mission, selected attempt and observed mission revision. The main process validates these identities before reading records; stale revisions fail visibly. Sender/frame validation remains at the existing IPC entry point.

Derive parcels from recorded workflow stage pairs or supervised assignment dependencies, never from recency or generated narrative. Only tasks belonging to the selected attempt (including its explicitly bound supervised workers) can contribute. Distinguish recorded dependency/stage order from proof that a predecessor's text was actually forwarded. Show the recorded recipient prompt or assignment objective, attributed predecessor output, task/source identities, source revision and safely selected file/check metadata. Missing payloads and missing references say Not recorded or Unavailable. Do not silently assign current run evidence to a historical attempt.

The dialog is a private work view and may show bounded user-authored assignment text. It does not export data or copy credential/environment fields, raw command output, provider metadata or arbitrary task fields. Render text as text, never HTML; paths are labels rather than automatic file reads. Maximum 32 parcels; per parcel prompt 4,000 characters, result 2,000 characters and 32 file references. Up to 32 attempt-level Git/check receipts are shown separately, so they are not falsely attributed as transmitted payloads. Limits are visible.

## Persistence and alternatives

No schema or persisted fields are added. Existing tasks, attempts, assignments, source results and check artifacts remain authoritative. No migration, backup rewrite or new retention policy is needed. A saved parcel table was rejected because it would duplicate authority and could drift on replay/recovery. Full transcripts in snapshots were rejected for privacy and size. The query reads retained records and never runs tools or resumes work.

Rollback removes the dialog, query route and module. Existing profiles remain compatible. Verify malformed/cross-project/stale requests, task membership, duplicate dependencies, old attempts, missing records, bounded payloads and redaction. Native fixtures must exercise three role handoffs, no-record states, keyboard disclosure/return, draft preservation, compact/200% layouts and reduced motion. Full Node 24 tests/build and native workflow remain required for the final combined candidate. M3 prerequisites remain separate.

## Implementation checkpoint

The read-only query and voyage-bar dialog are implemented. Build/typecheck and 83 focused boundary, IPC, handoff and projection regressions passed. The dedicated hidden native run passed 13 checks, including all three crew transitions, exact retained payloads, refresh/replay, keyboard disclosure, Escape/focus/draft return, source-task navigation, historical/missing records, compact/200% layout and motion-preference information. [Native receipt and screenshots](evidence/handoff-parcels-m5-2026-11-08/result.json) are controlled fixtures; all three captures were visually inspected.

An initial unit fixture accidentally shared the mission/attempt task-ID array; correcting that fixture preserved the cross-attempt rejection assertion. The initial native revision-refresh wait dereferenced the intentionally removed old report during loading; the wait now tolerates the loading state. Neither failure changed application authority or assertions. Raw failed runs remain in ignored scratch.

Full combined-source tests/native validation remain pending. No live execution, release qualification, installation or M5 prerequisite acceptance is claimed.

2026-11-09 update: the final clean M4–M7 candidate ccb702c passed 1,794 tests, build, 124 native checks and all 18 contained package cases. Exact-package results and responsive-world corrections are recorded in the [current qualification checkpoint](crew-voyage-qualification-2026-11-09.md); the older pending statements above describe their dated checkpoints. Live/release prerequisites remain separate.
