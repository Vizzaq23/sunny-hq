# Projects screen refresh — 2026-11-06

Requested by the captain: make Projects more modern, simpler and easier to follow. The screen retains Sunny's navy, cream and cargo-hold identity while replacing the large decorative card covers with compact folder icons and readable project names.

## Interaction

- Search matches project name, category and full folder path, without changing saved project order.
- Each card leads with Talk to Luffy, retaining the selected project. Workbench remains directly available.
- Activity comes from existing task summaries: attention takes precedence over working, otherwise the card says Saved activity or Fresh start. A saved or completed turn does not claim mission acceptance.
- Folder paths and removal sit inside a native keyboard-accessible disclosure. Removing a project requires confirmation; local files remain untouched by the existing registration-removal operation.
- Empty libraries and searches have distinct recovery actions. Cards wrap long names and collapse to one column on small screens.

No provider, model, persistence, IPC or permission changes. No new dependencies, remote resources or artwork. Projects has its own presentation component and scoped stylesheet; the other dashboard views retain their implementation.

## Validation

Evidence is recorded under ignored `.sunny-dev/projects-refresh-*` directories. The existing hidden Electron fixture now exercises search/no-results/reset, full folder disclosure, large libraries, long names, empty libraries, compact layout, 200% zoom and project-specific Luffy entry. These use synthetic projects and transport; they do not modify the daily profile or invoke a live model.

Final validation results will be recorded after the running checks complete. The installed app remains on the previous merged version while this feature is reviewed on `codex/projects-refresh`.

## Rollback

Revert the Projects component extraction, stylesheet and its dashboard re-export. No data rollback or migration is necessary. The fixture additions can be reverted independently. No issue was opened: this is a direct user-requested local UI change.
