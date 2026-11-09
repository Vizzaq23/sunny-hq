# Crew appearance preference — 2026-11-07

Scope: renderer-only Crew page dark mode, requested to improve text below wanted posters. Default dark; a visible native toggle switches to light. Preserve sourced poster pixels and all authoritative work state.

Persistence: optional localStorage key sunny.crew-appearance.v1, values dark/light only. Missing/invalid/unreadable value uses dark. No SQLite/shared IPC schema migration, credentials or task data. Write failure leaves the in-session choice working and displays a small status message. Existing profile/database is untouched by this preference; ordinary pre-install SQLite backup remains separate. Rollback: remove the preference key or revert this UI change; older builds ignore the new key. No migration or mandatory storage write. Tests cover switching, navigation restoration, keyboard activation, and effective text contrast. Native profile dialogs retain their existing readable light surfaces.

## App-wide correction — 2026-11-07
User clarified that appearance must cover the entire app. Move ownership to App and control to Settings > Experience. New renderer preference sunny.appearance.v1 accepts dark/light; if absent, read the previous sunny.crew-appearance.v1 value, otherwise default dark. Preserve old key for rollback; write only the new key. No database migration. All pages, native profile dialogs, command menu, workbench and startup surfaces use the chosen palette; artwork stays unfiltered. Storage denial retains the current session choice with a Settings status. Older builds ignore the new key. Validate navigation, both palettes, keyboard activation and storage failure using the isolated fixture.

## Local crew banner contrast — 2026-11-09
The local-advice banner retained a pale background while app-wide dark typography made its heading and status light. Give .local-crew-live the existing navy surface, light inherited text and visible border in dark appearance. Light appearance, labels, controls, motion and saved work are unchanged. This is a CSS-only correction with no schema or authority change. Validate rendered heading, objective, status and button contrast in both themes and compact layout before updating the installed app.

