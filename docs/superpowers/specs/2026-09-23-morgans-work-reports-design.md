# Morgans work reports and Robin's decision library

Status: design for captain review, 2026-09-23.

## Outcome

The captain can ask Big News Morgans for a clear account of work across registered Sunny projects and turn that account into an Obsidian note after review. The report reflects saved Sunny records. Robin remains the librarian who retrieves and reviews existing Obsidian notes so the captain can use them when deciding what to do next. Neither character gains authority to approve, merge, deploy, spend, or publish.

This design follows the captain's approved choice: Morgans creates **reviewable Obsidian drafts**; the captain decides whether to save them.

## Existing boundaries

`desktop/hub.cjs` owns tasks and exposes persisted mission, approval, check, PR, and deployment observations. `desktop/news.cjs` and `src/views/MorgansView.tsx` currently hold sourced outside news and a Luffy discussion handoff; these remain a separate section of Morgans' blimp. `desktop/mission-roles.cjs` binds the ten existing mission roles to crew identities. Robin's `src/views/OpsViews.tsx` library flow searches and reads notes, opens an unsent review prompt, and saves edits only through guarded library actions. The new work must use these records and controls rather than derive progress from world animation or conversation prose.

## Product flow

1. Morgans' blimp gains a **Work reports** section beside outside news. The captain selects a time range and any registered projects, then presses **Prepare report**. The default includes all registered projects and the last seven days of activity, with active, blocked, failed, and uncertain work always visible even if it began before the range. An empty result says which scope was searched.
2. Sunny compiles a bounded evidence packet from locally saved task and mission records. It includes project names and IDs; task/mission IDs, titles, authoritative statuses, and timestamps; outstanding approvals; current-attempt verification and publication observations; and links that open the exact task or mission. It excludes prompt bodies, chat transcripts, environment variables, credentials, raw terminal logs, and imported news. The packet records when it was assembled and where each fact came from.
3. Morgans is a named **Reporter** specialist. On demand, a Codex reporter turn receives this packet as its sole report input and instructions to summarize observed work, separate completed missions from finished turns or review-ready work, surface blockers and unknowns, and cite record IDs/times. His turn is read-only, cannot delegate or invoke project-editing tools, and cannot change mission state. If a safely restricted reporter turn cannot be established, Sunny shows the factual packet and an explicit generation failure; it does not run Morgans through the normal writable specialist path or fabricate an AI report.
4. The blimp shows the authoritative evidence beside the generated wording. The captain may edit the report text as an unsaved draft. **Save to Obsidian** opens a visible title/path review and uses the existing guarded library create/write path. Saving is a distinct captain click, with collision and revision checks; failure leaves the draft available. Closing an unsaved draft warns before discarding it. The generated report task remains in Sunny's task history so its response can be revisited.
5. Robin's library entry and **Ask Robin to review** stay the knowledge path. A Robin handoff includes only the selected note revision as untrusted reference in an unsent prompt. Robin can point to relevant notes and propose edits or decision context, but cannot silently write the vault or treat a note as verified authority.

## Truth and wording rules

The packet is assembled by Sunny, not inferred by the model. It distinguishes `working`, `waiting for approval`, `blocked`, `failed`, `interrupted`, `unknown`, `finished turn / review needed`, and `accepted mission` using the existing state model. A passed check is identified by script, source fingerprint, and observation time; a PR or deployment record is only an observation of the named source and time. Missing checks, absent deployments, stale source, and uncertain publication are stated plainly. The report never claims that a task or mission succeeded merely because a provider turn ended, a sprite moved, or the prose sounds confident.

Each project section lists the records behind its claims. Generated narrative is marked as a summary of the evidence packet, and the saved note includes the packet creation time, scope, and source references. Sunny labels the report's coverage as **saved local records within the selected period**, including the saved event-retention limit. It does not claim to reconstruct deleted or never-imported work. If a cited record is gone from the retained window or cannot be opened, Sunny marks the reference unavailable rather than silently dropping it.

## Data and failure behavior

The first release does not add an automatic reporting schedule or a separate report database. The reporter turn is an ordinary saved Sunny task with a Reporter identity, while the editable Obsidian draft is held in the visible report view until the captain saves or discards it. Existing task persistence and guarded library writes remain the durable stores. A draft created from a reporter response is never treated as a completed mission artifact without the mission's own acceptance flow.

The evidence builder validates requested project IDs and date bounds, caps item counts and text sizes, and redacts fields outside its allowlist. It takes one stable local snapshot before synthesis so a report cannot silently mix different revisions. If records change afterward, the view displays the packet time and offers a fresh report. Provider disconnect, timeout, cancellation, unsafe sandbox setup, vault conflict, or missing vault must produce a visible, retryable state without starting another possibly running provider turn automatically. Any uncertain reporter turn is reconciled through the existing task recovery path.

Because no new persisted schema is required, an existing Sunny profile opens unchanged. A package rollback retains the saved reporter task as an ordinary task; older builds may lack Morgans-specific presentation but must still preserve its record. This compatibility claim must be checked against the existing task loader before implementation. No user profile migration or backup restoration is part of this change.

## Boundaries and files

- Add a small report evidence builder in `desktop/` and a guarded IPC action in `desktop/main.cjs`; keep task and mission records authoritative in Hub.
- Add Morgans as a Reporter binding and persona in the existing crew/routing path. Reporter execution must use a read-only provider configuration with no delegation or project write capability. If that cannot be enforced by the current Codex protocol, stop at the factual report and document the limitation rather than widening authority.
- Extend `src/views/MorgansView.tsx` with report filters, evidence, generation state, and draft review. Reuse existing task navigation and Obsidian save controls rather than duplicating their path or revision logic.
- Update `src/shared.ts` for the bounded report contract, then the canonical `docs/world-bible.md` and `docs/SUNNY-AI-PIPELINE.md` for the two roles and report limits. New Morgans art is optional; the existing blimp identity suffices for this increment.

## Verification and acceptance

- Tests prove that mixed project histories produce accurate statuses and source references, including finished turns awaiting review, accepted missions, failed checks, unknown tasks, outstanding approvals, stale source, and missing deployment observations.
- Tests prove invalid scope, oversized input, secret-bearing fields, and unsupported read-only reporter setup cannot leak into or launch a report turn. Reporter turns cannot acquire workspace write, delegate, approve, or publish.
- Tests prove the vault receives no write before the captain's Save action; collision/revision failure preserves the draft. Robin's existing selected-note and unsent-review flow still works.
- `npm ci` in a clean checkout, `npm test`, `npm run build`, focused recovery/security checks, and the fixture Electron workflow pass. Native checks show the report, its evidence links, the save review, normal error/empty states, keyboard operation, and reduced-motion behavior. Any failed or unavailable check is reported exactly.
- Review the full diff for changes to authority, persistence, renderer trust, and credentials. Confirm no `.env` content or Jev key is read, logged, exported, or included in the evidence packet.
