# Actual upstream crew components — 2026-11-07

Captain clarified that the linked components themselves must be used, not custom approximations. This decision supersedes the earlier reference-only implementation and research-pass alternatives in [crew map](crew-map-2026-11-07.md) and [research](crew-components-research-2026-11-07.md).

## Integrated source

| Requested experience | Actual implementation | Sunny integration |
| --- | --- | --- |
| Crew beams | [Magic UI Animated Beam official registry](https://magicui.design/r/animated-beam.json), vendored `src/components/vendor/animated-beam.tsx` | Original ref measurement and Motion linear-gradient animation; optional crew gutter routing and `active` switch. Base lines never animate. Only fresh authoritative delegation/result signals mount an active instance, `repeat=0`, duration 1.2 seconds. |
| Expandable profiles | [Motion Primitives Morphing Dialog source](https://github.com/ibelick/motion-primitives/blob/main/components/core/morphing-dialog.tsx), vendored `morphing-dialog.tsx` | Actual provider, trigger/content shared layout IDs, MotionConfig, title and portal composition. Controlled crew selection; whole poster trigger. Native Sunny dialog owns focus, Escape, inert background and return focus. Keyboard/OS/app reduction removes shared-layout animation. |
| Ship log | [Aceternity Timeline official registry](https://ui.aceternity.com/registry/timeline.json), vendored `timeline.tsx` | Actual data/title/content timeline composition and sticky marker/spine. Saved evidence rows supply data; semantic list, stable IDs, ResizeObserver, local scroll area. Upstream scroll-derived fill is deliberately static so scrolling never implies completed work. |
| Captain's Orders | [shadcn base-nova Command official registry](https://ui.shadcn.com/r/styles/base-nova/command.json), vendored `command.tsx`, backed by `cmdk@1.1.1` | Actual Command/Input/List/Item wrappers and cmdk navigation/ARIA. Existing native modal host; Sunny search/scope/stable IDs use `shouldFilter=false`. Only navigation, never automatic approval/resume. |
| Parchment | `PaperTexture` from `@paper-design/shaders-react@0.0.82` | Real static shader on visible wanted posters, ship log, mission brief and Zoro station. Low contrast, capped pixels, behind readable HTML text. Old static grain asset removed. |
| Ocean window | `Water` from `@paper-design/shaders-react@0.0.82` | Real WebGL water shader over original local ocean SVG. Speed zero for pause/reduced motion; shader unmounted offscreen/hidden; still image remains if WebGL is unavailable or context is lost. |

The registry components are copied source, as their installation model expects. They are not installed as fictitious `magicui` or `aceternity` npm packages. Paper and cmdk are actual pinned npm dependencies, recorded with integrity in package-lock.json. No Tailwind framework was added to Sunny: component class treatment is mapped to scoped existing CSS, and the shadcn utility/icon/input wrappers are adapted to local class composition and Lucide. Core component behavior is retained as described above.

## Accessibility and authority

The native profile dialog retains dynamic focus containment and close/focus return, including its unsaved memory-note guard. The upstream hand-written focus trap is replaced by that existing native host. Controlled provider IDs are unique; trigger names are readable and controls point to real content IDs. Setup drafts survive switching profile sections. Every crew member has the same poster level; Luffy retains the separate captain area.

The upstream command menu handles active descendants and arrow selection. Stable result values preserve the selected item when streamed ordering changes. IME composition cannot submit a command. Ctrl/Cmd+K retains Sunny's shortcut; cmdk's competing Vim bindings are disabled. Existing dirty-work guards still own navigation.

Renderer event projection, IPC contracts, provider execution, acceptance and persistence schemas are unchanged. Beam eligibility retains no replay on initial mount, duplicate snapshots, old/reconnected epochs, stale records or uncertain persistence. Replies and passed checks do not prove mission acceptance. Evidence navigation retains exact task/mission/attempt identity.

Shader layers are aria-hidden and ignore pointer events. Paper does not animate. Water is small, uses a bundled local image, and has a static fallback; neither shader draws work controls or text. Canvas budgets are 240,000 physical pixels per visible paper surface and 40,000 for water; offscreen surfaces release their mount.

## Provenance and terms

Exact original source URLs and SHA256 hashes are in [sources.json](licenses/crew-components/sources.json). The adapted code files identify their origin. MIT notices for Magic UI, Motion Primitives and shadcn, and Paper's Apache license and NOTICE files are retained in `docs/licenses/crew-components` and included in Electron's packaged files.

Aceternity is recorded under its [published Aceternity License](https://ui.aceternity.com/licence), not presumed MIT. Its terms permit use and modification in end products and restrict redistribution as standalone source/items or marketplace templates. This integration is for Sunny as an end product, not a component library/template. No public push or source redistribution is performed in this task. Preserve the terms when preparing any future source release.

## Rollback

Revert this integration commit and restore its package-lock.json, then npm ci/build. No database backup/migration or user-profile change is involved. Previous custom implementation is preserved in Git history through `3fdeeb5`; the installed application remains separate.

## Verification

Validation receipts and current limits are recorded in `docs/evidence/crew-components-upstream-2026-11-07/README.md` once final checks complete. Earlier screenshot directories describe the older reference-only versions and must not be used as evidence of actual upstream integration.
