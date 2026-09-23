---
name: ecc-frontend-a11y
description: Use when building or reviewing an interactive React interface, form, modal, or keyboard flow.
metadata:
  origin: ECC adaptation
---

# Frontend accessibility

Inspect the actual component and its rendered behavior. Use native elements first. Connect each form control to a visible label and any error message. Give icon buttons an accessible name. Check focus order, keyboard activation, escape and focus return for dialogs, and announcements for meaningful state changes. Respect reduced motion.

Test the affected interaction with keyboard and the project's available fixture UI check. Report the observed result and any untested screen reader behavior separately. Do not add a dependency just to satisfy a checklist; use one only when the interaction needs it and the project allows it.

Source and adaptation: see `docs/skill-provenance.md` in Sunny HQ.
