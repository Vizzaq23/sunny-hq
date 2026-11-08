# Crew appearance preference — 2026-11-07

Scope: renderer-only Crew page dark mode, requested to improve text below wanted posters. Default dark; a visible native toggle switches to light. Preserve sourced poster pixels and all authoritative work state.

Persistence: optional localStorage key sunny.crew-appearance.v1, values dark/light only. Missing/invalid/unreadable value uses dark. No SQLite/shared IPC schema migration, credentials or task data. Write failure leaves the in-session choice working and displays a small status message. Existing profile/database is untouched by this preference; ordinary pre-install SQLite backup remains separate. Rollback: remove the preference key or revert this UI change; older builds ignore the new key. No migration or mandatory storage write. Tests cover switching, navigation restoration, keyboard activation, and effective text contrast. Native profile dialogs retain their existing readable light surfaces.
