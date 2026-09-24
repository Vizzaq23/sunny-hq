# Sunny skill selection decision — 2026-09-22

Status: implemented locally for review. Sunny suggests at most two reviewed skills from the connected Codex runtime for a saved mission or new quick task. The captain can change the selection before launch. Skills guide the worker; Sunny's existing authorization, evidence and acceptance rules still decide what actions and mission states are allowed.

## Decision and alternatives

Use an explicit, small catalog in `desktop/skill-catalog.cjs`, intersected with Codex `skills/list` for the registered project. Return only metadata and a fingerprint to the renderer. At launch, re-read the runtime list and the selected `SKILL.md` files. Reject disabled, missing, duplicate or changed choices before starting a task or mission attempt. Codex receives confirmed skills as structured skill input items with the validated name and path; full skill instructions load in Codex only when used. Coordinated tasks keep the selection on the lead task and pass each skill only to a matching specialist.

Alternatives considered: exposing every installed skill would put unreviewed instructions in the launch UI; copying all skill bodies into every prompt would increase context and bypass native discovery; adopting ECC's hooks or autonomous loop would duplicate Sunny's authority and recovery logic. The chosen catalog requires periodic review when skills or Codex discovery change.

## Saved data and compatibility

`Task.selectedSkills` and `MissionAttempt.selectedSkills` are optional arrays of at most two `{id,name,path,category,purpose,revision,roles}` records. `revision` is a SHA-256 fingerprint of the canonical skill path and file content seen at selection. No existing field or mission-book version changes. Old profiles load with the fields absent, and old tasks cannot retroactively claim skill use. Restart preserves selection and the existing provider result in task history. New writes use the current JSON state row; no migration or live-profile rewrite is required.

Before installing a build, retain the normal closed-profile backup. Rolling back to an older compatible package leaves these optional records in saved JSON; it will ignore them. If the runtime skill list or a file read fails, keep the brief and show the error. If a skill changes after a mission begins, a later specialist launch rejects it and the existing attempt remains reviewable; Sunny does not silently substitute a skill or retry a possibly started command. Tests cover absent legacy fields, changed/disabled selections and launch-before-attempt rejection on isolated fixture stores.

## Availability and limits

The four new project skills live in `.agents/skills/` and appear only where the connected Codex runtime discovers them for the registered project. Other reviewed global skills can appear when installed and enabled. The UI never claims an unavailable skill is running. Selection is task-level metadata and an explicit instruction; Codex's returned messages and Sunny's saved checks remain the evidence of actual work. No ECC MCPs, commands, agents, hooks, global rules or profile-wide installation are part of this change.
