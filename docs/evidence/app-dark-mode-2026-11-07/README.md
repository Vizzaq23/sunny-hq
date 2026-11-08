# App-wide dark appearance — 2026-11-07

The captain clarified that dark mode must apply throughout Sunny. Source2a023a5 on codex/crew-map, clean build fingerprint65ae6d2f68920e0f638ddd93eb732925d14f448b7677a351034bc799406596c1.

App owns the persisted preference; Settings > Experience contains the only Dark mode control. Legacy Crew preference carries over without deletion. Shared dark surfaces cover main pages, profiles, command menu, library, crew rooms, ship/island controls, workbench, Captain’s log and Monaco editor. Artwork remains unfiltered; embedded previews retain their own document styling. See ../../crew-appearance.md for persistence and rollback. No backend/IPC/schema/dependency changes.

Passed final TypeScript/Vite build, Windows packaging, native appearance/Crew fixture and68-check full native workflow, including editor vs-dark assertion. Appearance fixture covers legacy migration through renderer reload, Space activation, navigation persistence, storage-denied feedback, no remaining Crew toggle, and large light-surface detection on10main destinations. Existing Crew checks retain >=4.5:1 work-text contrast, beam masking/event pulses, modal behavior, phone/zoom and motion checks. Screenshots are fixture data, not live provider evidence. Final Home, Settings, Library, Island, profile and editor screenshots visually inspected. Not a complete WCAG/screen-reader audit.

Broader backend limitation retained from preceding6067fe5 validation: npm test passed167cases then failed test168 in checkpoint-journey-faults.test.cjs with Journey deadline; stopped after the bounded run. Not repeated for this renderer-only correction, and no full-suite green claim. Cause/pre-existence remains unproven. No npm ci rerun; existing locked dependencies used.

Installed0.11.0-appdark-2a023a5 side-by-side; all252files SHA256verified; online SQLite backup integrity ok; Desktop/Start Menu shortcuts verified; previous exact-version processes stopped. New installed URL confirmed, native Home screenshot visibly dark, then Settings opened and Dark mode On visually verified. Previous versions retained. No live tasks/providers initiated, public push or merge.
