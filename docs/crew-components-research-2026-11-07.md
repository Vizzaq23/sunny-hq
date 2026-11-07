# Modern React components: Sunny adoption decisions

Date: 2026-11-07. Scope: six requested crew/work surfaces, branch `codex/crew-map`. Implementation and verification: [crew map decision](crew-map-2026-11-07.md).

## Research and decisions

| Reference | Finding and Sunny decision |
| --- | --- |
| [Magic UI Animated Beam](https://magicui.design/docs/components/animated-beam) | Ref-based connections fit a responsive hierarchy. Use original measured SVG paths, with finite pulses from new saved delegation signals instead of decorative looping beams. |
| [Aceternity Expandable Card](https://ui.aceternity.com/components/expandable-card) | Keep the identity of a selected poster in its larger profile. Use existing portrait, title and material; preserve native modal semantics. |
| [Motion Primitives morphing dialog source](https://github.com/ibelick/motion-primitives/blob/main/components/core/morphing-dialog.tsx) | Shared layout is attractive, but the source also owns focus and scroll handling. Retain Sunny's native dialog and focus restoration rather than installing a competing overlay. Documentation URL returned 403; source was inspected instead. |
| [Motion layout](https://motion.dev/docs/react-layout-animations) | `layoutId` connects shared elements; scrolling/fixed roots require measurement treatment. A true poster-to-dialog morph is deferred because native top-layer geometry needs dedicated validation. Do not call a short entrance fade a morph. |
| [Motion accessibility](https://motion.dev/docs/react-accessibility) | Reduced motion needs deliberate transform/layout behavior. Sunny suppresses all these decorative animations for OS or app reduction; pointer-only profile entrances avoid keyboard delays. |
| [Aceternity Timeline](https://ui.aceternity.com/components/timeline) | Adopt a readable vertical record spine and expandable evidence. Reject scroll-derived completion or staged fictional events. Add search, project scope, record type and bounded expansion. |
| [shadcn Base Command](https://ui.shadcn.com/docs/components/base/command) | Categories, empty states, shortcuts and bounded scrolling improve discovery. Extend Sunny's existing palette with missions and category labels; preserve one keyboard/result order. |
| [cmdk](https://github.com/dip/cmdk) | Composable command groups and selection management are useful reference patterns. A package migration is not required to add mission navigation to an existing palette. |
| [Base UI Combobox](https://base-ui.com/react/components/combobox), [React Aria ComboBox](https://react-aria.adobe.com/ComboBox) | Label input, expose active option and preserve stable selection during updates. Text input filters a navigation collection; it is not authorization to execute work. |
| [Base UI Dialog](https://base-ui.com/react/components/dialog), [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) | Modal focus containment, Escape and return focus are behavioral requirements, independent of skin. Keep an explicit close button and native dialog. |
| [WAI dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [WAI combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) | Validate labels, active descendant, keyboard navigation, inert background and focus return. Native fixture evidence does not substitute for a manual screen-reader audit. |
| [shadcn empty](https://ui.shadcn.com/docs/components/base/empty), [tabs](https://ui.shadcn.com/docs/components/base/tabs), [scroll area](https://ui.shadcn.com/docs/components/base/scroll-area) | Add actionable profile/log empty states and section buttons; use native scrolling. Keep pressed-button semantics rather than advertising ARIA tabs without their arrow-key pattern. |
| [Paper texture](https://shaders.paper.design/paper-texture) | Fiber/fold material can frame posters. Use an original static grain asset at low opacity, leaving text crisp and avoiding shader cost. |
| [Paper water](https://shaders.paper.design/water) | Image-based refraction/caustics are not a standalone ocean scene. Use a small original CSS ocean window; adopting the actual shader would require an image, GPU lifecycle and performance evidence. |
| [Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API), [Intersection Observer](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) | Pause for hidden document and independently offscreen ocean window. Suppressed activity is not replayed when visible again. |

## Source terms and provenance

Checked upstream [Magic UI MIT](https://github.com/magicuidesign/magicui/blob/main/LICENSE.md), [shadcn MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md), [Motion Primitives MIT](https://github.com/ibelick/motion-primitives/blob/main/LICENCE.md) and [Paper Apache-2.0](https://github.com/paper-design/shaders/blob/main/LICENSE). Aceternity's linked [licence page](https://ui.aceternity.com/licence) describes product/source redistribution restrictions; do not assume every component is blanket MIT. No third-party source, artwork or shader was copied in this pass. License observations are scoped to the pages checked, not legal clearance for all related products.

## Additional polish adopted / deferred

Adopted: work-first profile, preserved setup drafts across sections, exact-attempt evidence links, saved check records, single searchable timeline, real card status, smaller consistent cards, outer connector rails, visible ocean window, pointer-aware motion, low-contrast grain and informative empty states.

Deferred: WebGL materials, spring-heavy shared-layout dialogs, custom scrollbars and an additional component framework. They add runtime/interaction cost without improving the current work controls. No new dependency was added.
