# Munder Difflin reference scan

User supplied this reference during the build: https://github.com/chaitanyagiri/munder-difflin

Reviewed its README, package manifest, design system and architecture document on 2026-09-11. This was a documentation/architecture scan, not a full source security audit. No code or assets were copied.

Useful patterns:
- Separate real process/terminal execution from the scene's event-driven status display.
- Keep filesystem, terminal and Git operations behind the desktop IPC bridge.
- Make characters clickable entrances to the corresponding work.
- Persist task context and use explicit lifecycle events, not decorative activity, for status.

Sunny's first build already follows those patterns with Codex app-server JSON-RPC, isolated Electron IPC, SQLite state, real terminal sessions and crew stations. The reference's autonomous routing, semantic memory, multi-provider adapters and walking-sprite engine are larger capabilities beyond this release. They remain possible later additions rather than claims about this build.

Sources:
- https://github.com/chaitanyagiri/munder-difflin/blob/main/docs/ARCHITECTURE.md
- https://github.com/chaitanyagiri/munder-difflin/blob/main/DESIGN.md
- https://github.com/chaitanyagiri/munder-difflin/blob/main/README.md
