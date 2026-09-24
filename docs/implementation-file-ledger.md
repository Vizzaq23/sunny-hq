# Implementation file ledger

2026-09-21. All 96 committed product/research paths changed from original base `27c5fa6` through `011ae4b`, plus the new local completion manifest in this audit refresh (97 total). This ledger excludes the preserved unrelated user overlay. Historical reports keep their own dates.

| Change | File | Purpose |
| --- | --- | --- |
| Created | `.gitattributes` | Preserve the recorded live written-output bytes across checkout normalization. |
| Created | `.github/ISSUE_TEMPLATE/architecture-art.md` | Structured architecture-art proposal with criteria, dependencies, role, risk and validation. |
| Created | `.github/ISSUE_TEMPLATE/bug.md` | Structured bug proposal with criteria, dependencies, role, risk and validation. |
| Created | `.github/ISSUE_TEMPLATE/feature.md` | Structured feature proposal with criteria, dependencies, role, risk and validation. |
| Created | `.github/PULL_REQUEST_TEMPLATE.md` | Review checklist covering objective, evidence, architecture, art/security and rollback. |
| Created | `.github/workflows/ci.yml` | Least-privilege Windows Node24 locked-install/test/build workflow; hosted execution unverified. |
| Created | `AGENTS.md` | Agent constitution: product identity, ownership, security, validation and definition of done. |
| Created | `desktop/approvals.cjs` | Bind opaque approvals to immutable task/project/turn/execution requests and reject stale/replayed replies. |
| Modified | `desktop/captain.cjs` | Enforce sequential mission stages and scoped specialist delegation/context. |
| Created | `desktop/creative-live-check.cjs` | Opt-in live written creator mission and file review. |
| Created | `desktop/deployment-evidence.cjs` | Read bounded GitHub deployment observations tied to current repository/commit. |
| Modified | `desktop/growth.cjs` | Retrieve attributed knowledge only within the exact project scope. |
| Modified | `desktop/hub.cjs` | Integrate missions, approvals, evidence, recovery, role dispatch, receipts and file/image review. |
| Created | `desktop/image-deliverables.cjs` | Bound PNG structure/dimensions, strip ancillary metadata and native-decode explicit previews. |
| Modified | `desktop/main.cjs` | Validate mission IPC actions and await Electron44 clipboard writes. |
| Created | `desktop/mission-branch.cjs` | Prepare and reconcile a mission-specific local branch without overwriting work. |
| Created | `desktop/mission-deliverables.cjs` | Protected bounded project-file reading and hash-matched plain-text review. |
| Created | `desktop/mission-evidence.cjs` | Collect source identity and bounded existing npm-script results. |
| Created | `desktop/mission-live-check.cjs` | Opt-in live builder/coordinated repair with actual provider and source/check evidence. |
| Created | `desktop/mission-merge.cjs` | Prepare captain GitHub review and verify remote merge outcome; never auto-merge. |
| Created | `desktop/mission-publisher.cjs` | Prepare exact expiring PR publication intent and reconcile uncertain publishing. |
| Created | `desktop/mission-roles.cjs` | Stable role/capability bindings and bounded mission instructions. |
| Created | `desktop/mission-smoke.cjs` | Native fixture of navigation, crew states, local Git/checks, review/evidence and persistence. |
| Created | `desktop/mission-workflow.cjs` | Require recorded plan/work/validate/review stages before readiness. |
| Created | `desktop/missions.cjs` | Version1 durable missions, attempts, revisions, bounded events, recovery and acceptance. |
| Created | `desktop/pull-request-evidence.cjs` | Validate GitHub PR repository/branch/commit and check/review observations. |
| Created | `desktop/task-commands.cjs` | Validate task launch/control arguments before privileged operations. |
| Created | `desktop/visual-live-check.cjs` | Opt-in live creator/image-generation mission and native PNG review. |
| Modified | `docs/REFERENCE-REVIEW.md` | Document REFERENCE REVIEW, including decisions, evidence and limits. |
| Created | `docs/SUNNY-HQ-CODEX-REPORT.md` | Document SUNNY HQ CODEX REPORT, including decisions, evidence and limits. |
| Created | `docs/agent-platform-roadmap.md` | Document agent platform roadmap, including decisions, evidence and limits. |
| Created | `docs/agent-routing.md` | Document agent routing, including decisions, evidence and limits. |
| Created | `docs/art-bible.md` | Document art bible, including decisions, evidence and limits. |
| Created | `docs/deployment-inspection.md` | Document deployment inspection, including decisions, evidence and limits. |
| Created | `docs/electron-runtime-upgrade.md` | Document electron runtime upgrade, including decisions, evidence and limits. |
| Created | `docs/evidence/live-coordinated-mission-2026-09-21.json` | Recorded bounded live-run evidence or original written output; scope/acceptance limits remain explicit. |
| Created | `docs/evidence/live-creative-mission-2026-09-21.json` | Recorded bounded live-run evidence or original written output; scope/acceptance limits remain explicit. |
| Created | `docs/evidence/live-creative-welcome-2026-09-21.md` | Recorded bounded live-run evidence or original written output; scope/acceptance limits remain explicit. |
| Created | `docs/evidence/live-mission-2026-09-21.json` | Recorded bounded live-run evidence or original written output; scope/acceptance limits remain explicit. |
| Created | `docs/evidence/live-visual-mission-2026-09-21.json` | Recorded bounded live-run evidence or original written output; scope/acceptance limits remain explicit. |
| Created | `docs/foundation-design.md` | Document foundation design, including decisions, evidence and limits. |
| Created | `docs/living-missions-plan.md` | Document living missions plan, including decisions, evidence and limits. |
| Created | `docs/master-goal-audit.md` | Document master goal audit, including decisions, evidence and limits. |
| Created | `docs/openclaw-evaluation.md` | Document openclaw evaluation, including decisions, evidence and limits. |
| Created | `docs/references/README.md` | Document README, including decisions, evidence and limits. |
| Created | `docs/references/mission-emblem-2026-09-21-provenance.md` | Document mission emblem 2026 09 21 provenance, including decisions, evidence and limits. |
| Created | `docs/references/mission-emblem-2026-09-21.png` | Original generated review asset; source/prompt/hash recorded alongside it. |
| Created | `docs/references/project-quarters-concept-2026-09-21.md` | Document project quarters concept 2026 09 21, including decisions, evidence and limits. |
| Created | `docs/references/project-quarters-concept-2026-09-21.png` | Original generated review asset; source/prompt/hash recorded alongside it. |
| Created | `docs/visual-deliverables.md` | Document visual deliverables, including decisions, evidence and limits. |
| Created | `docs/world-bible.md` | Document world bible, including decisions, evidence and limits. |
| Modified | `package-lock.json` | Lock patched Electron runtime and its replacement archive dependency. |
| Modified | `package.json` | Pin patched Electron44.4.3; retain committed release version separately from user overlay. |
| Modified | `public/assets/ARTWORK.md` | Record original room art provenance, exact hash and geometry admission. |
| Created | `public/assets/project-quarters.png` | Original illustrated room background, unchanged generated bytes. |
| Modified | `src/App.tsx` | Wire mission routes, selected projects and task attention into the existing desktop. |
| Created | `src/components/DeploymentObservation.tsx` | Observed deployment status/time/source and missing/older-source limits. |
| Created | `src/components/MissionImages.tsx` | PNG attachment, source/usage declarations and explicit captioned preview. |
| Created | `src/components/ProjectHealth.tsx` | Current-attempt checks, PR/deployment/file observations and next action. |
| Created | `src/components/RoomActors.tsx` | State-driven crew travel/work frames with reduced-motion support. |
| Created | `src/projectEvidence.ts` | Derive current-attempt evidence and staleness-aware next actions. |
| Created | `src/roomActivity.ts` | Project-scoped attention-first crew and saved signal projections. |
| Created | `src/roomMotion.ts` | Shared desk/floor coordinates and bounded truthful crew/captain motion. |
| Modified | `src/shared.ts` | Shared typed mission/attempt/artifact/role contract. |
| Modified | `src/views/IslandView.tsx` | Project doors into registered project quarters. |
| Created | `src/views/MissionBoard.tsx` | Mission drafting, role dispatch, attempts, evidence, review and external action controls. |
| Created | `src/views/ProjectRoom.tsx` | Illustrated room, captain movement, live crew, receipts, health and mission access. |
| Created | `src/views/mission-board.css` | Mission review, evidence, written/image and deployment presentation. |
| Created | `src/views/project-room.css` | Responsive illustrated room, crew/state/readability and project panels. |
| Created | `tests/approval-boundary.test.cjs` | Regression coverage for approval boundary. |
| Modified | `tests/captain.test.cjs` | Regression coverage for captain. |
| Created | `tests/deployment-evidence.test.cjs` | Regression coverage for deployment evidence. |
| Modified | `tests/growth.test.cjs` | Regression coverage for growth. |
| Modified | `tests/hub.test.cjs` | Regression coverage for hub. |
| Created | `tests/image-deliverables.test.cjs` | Regression coverage for image deliverables. |
| Created | `tests/mission-branch.test.cjs` | Regression coverage for mission branch. |
| Created | `tests/mission-deliverables.test.cjs` | Regression coverage for mission deliverables. |
| Created | `tests/mission-evidence.test.cjs` | Regression coverage for mission evidence. |
| Created | `tests/mission-hub.test.cjs` | Regression coverage for mission hub. |
| Created | `tests/mission-live-check.test.cjs` | Regression coverage for mission live check. |
| Created | `tests/mission-merge.test.cjs` | Regression coverage for mission merge. |
| Created | `tests/mission-publisher.test.cjs` | Regression coverage for mission publisher. |
| Created | `tests/mission-roles.test.cjs` | Regression coverage for mission roles. |
| Created | `tests/mission-workflow.test.cjs` | Regression coverage for mission workflow. |
| Created | `tests/missions.test.cjs` | Regression coverage for missions. |
| Created | `tests/project-evidence.test.cjs` | Regression coverage for project evidence. |
| Created | `tests/pull-request-evidence.test.cjs` | Regression coverage for pull request evidence. |
| Created | `tests/room-activity.test.cjs` | Regression coverage for room activity. |
| Created | `tests/room-motion.test.cjs` | Regression coverage for room motion. |
| Created | `tests/task-commands.test.cjs` | Regression coverage for task commands. |
| Created | `tests/visual-live-check.test.cjs` | Regression coverage for visual live check. |
| Created | `docs/SUNNY-HQ-IMPLEMENTATION-REPORT.md` | Current full-scope report with live/local evidence, unresolved gates and five next proposals. |
| Created | `docs/implementation-file-ledger.md` | This complete file/purpose inventory. |
| Created | `src/components/MissingThreadRecovery.tsx` | Explicit captain confirmation for unresolved local tasks missing provider identity. |
| Created | `src/components/missing-thread-recovery.css` | Readable recovery panel, confirmation and error layout. |
| Modified | `src/views/Workbench.tsx` | Mount missing-thread recovery and fix the original scroll effect's invalid React cleanup return; preserve unrelated user workbench changes. |
| Created | `docs/evidence/local-completion-2026-09-21.json` | Current-source local test/build/native evidence and explicit external-verification limit. |

Later corrections strengthen the existing Hub/mission/approval/deliverable boundaries, add durable check and task recovery, reveal the board on opening, and extend native fixtures to cover those controls and fail on renderer errors. Their regression coverage and exact evidence are recorded in `living-missions-plan.md`. No additional dependency was added by these corrections.

Island exploration update: `src/islandControls.ts` defines bounded keyboard/touch movement and zoom limits; `src/islandMotion.ts` projects the selected avatar without touching task state; `src/views/IslandView.tsx` and `src/island.css` provide the optional controls and visible focus; `desktop/island-smoke.cjs` verifies the full Straw Hat roster, a recruited resident, input methods and zoom. `desktop/main.cjs` adds bounded retry for the final Electron smoke screenshot after observed `UnknownVizError`. `Launch Sunny.cmd` targets the isolated-profile-tested 0.11.0 candidate. Related user-facing and requirement documentation is updated in `README.md`, `docs/world-bible.md`, `docs/master-goal-audit.md`, `docs/living-missions-plan.md`, `docs/SUNNY-HQ-IMPLEMENTATION-REPORT.md`, the JSON evidence record and this ledger.

Character workspace increment — 2026-09-23: `src/App.tsx` passes selected Obsidian note context into a Robin workspace with an isolated revision-scoped draft key; `src/views/Workbench.tsx` assigns static station-themed presentation and exposes Robin's Library shortcut; `src/views/OpsViews.tsx` provides the bounded Ask Robin review action and explicit manual-save path; `src/styles.css` defines each core crew's room cues. `desktop/workflow-smoke.cjs` covers theme/identity, note lookup, prefilled unsent Robin review, draft isolation and long-note refusal. `Launch Sunny.cmd` now targets the locally verified and activated 0.11.0 candidate. The 25-check result, screenshots, source hashes, package SHA256, active package path and verified pre-update profile backup are in `docs/evidence/character-chat-rooms-2026-09-23.json`. No user project file or credential was included in the evidence record.

Crew-room audio increment — 2026-09-23: `src/roomAudio.ts` supplies ten short, distinct synthesized station cues using Web Audio only; `src/views/Workbench.tsx` adds an accessible mute switch and plays on room/specialist entry only; `src/views/OpsViews.tsx`, `src/shared.ts`, `src/data.ts`, and `desktop/hub.cjs` persist captain sound/volume preferences; `desktop/main.cjs` validates those settings; `tests/room-audio.test.cjs`, `desktop/smoke.cjs`, and `desktop/workflow-smoke.cjs` verify cue definitions, safe volume, stop/mute, IPC persistence, UI and opt-in behavior. README and art/world/audit documentation describe its limits. No sound sample, paid generation, new package, or user-data migration is introduced.

## First illustrated character-room increment — 2026-09-23 UTC

| Change | File | Purpose |
| --- | --- | --- |
| Created | `public/assets/zoro-dojo-room.png` | Original generated dojo interior admitted as Zoro's subdued chat background; prompt/hash in ARTWORK.md. |
| Created | `docs/evidence/zoro-dojo-room-2026-09-23.json` | Hash-matched source, test, package and profile-backup evidence for this increment. |
| Modified | `src/views/Workbench.tsx` | Resolve the Zoro room asset into the conversation as decorative art. |
| Modified | `src/styles.css` | Position the room art beneath chat content without moving controls. |
| Modified | `desktop/workflow-smoke.cjs` | Verify decoded asset, accessibility, opacity, direct controls and screenshot in a fixture-only Zoro conversation. |
| Modified | `Launch Sunny.cmd` | Activate the verified Zoro-room Windows package. |
| Modified | `README.md` | Document the active package and accurately state that nine physical rooms remain. |
| Modified | `public/assets/ARTWORK.md`, `docs/world-bible.md`, `docs/master-goal-audit.md`, `docs/living-missions-plan.md`, `docs/SUNNY-HQ-IMPLEMENTATION-REPORT.md` | Preserve original-art provenance, world behavior, requirement status and validation limits. |

## Complete illustrated crew-room set — 2026-09-23 UTC

Created nine generated room illustrations alongside Zoro's dojo; `src/views/Workbench.tsx` selects all ten by assigned crew identity and `src/styles.css` places each decorative scene below chat content. The Electron workflow now validates each image mapping, decode, accessibility boundary and direct control, plus reduced-motion Chopper rendering. `Launch Sunny.cmd` points to the separately built and packaged-verified `.sunny-dev/validated-release-ten-crew-rooms` candidate. README, art/world bibles and goal/implementation reports record the result and remaining limits. Exact hashes, screenshots, package checks and profile backup are in `docs/evidence/ten-crew-rooms-2026-09-23.json`. Existing profile backup has 58 files and 65,064,544 bytes; all file hashes matched before launch. No live provider work was started.

\n