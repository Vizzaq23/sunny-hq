# Morgans ChatGPT inbox — 2026-09-29

Status: implementation decision for the captain's requested recurring X and AI briefings. The captain switched collection from Grok Bot to ChatGPT on 2026-09-29.

## Decision

Sunny will look for completed `morgans-*.json` briefing files in the current user's Downloads directory and a configured workspace inbox while the app is open and once at startup. The launcher sets `SUNNY_MORGANS_INBOX` to `.sunny-dev/morgans-inbox`, a writable location for recurring ChatGPT tasks. Only regular files with a date in the name, a `ChatGPT` origin, and the existing Morgans JSON shape are candidates. The scan is bounded and runs every 30 seconds. The existing `News.importCapture` remains the only write path: it validates categories, text lengths, project IDs, HTTPS URLs, archive size, and deduplicates by canonical URL. Stories remain explicitly marked as unverified source claims. ChatGPT creates files; Sunny decides whether they enter its archive.

The first scan may see an already imported file. If every URL from a candidate is already present, Sunny skips it so an old download cannot advance `lastCaptureAt`. A file must be at least two seconds old, no larger than 512 KB, and unchanged across a bounded read. Symlinks and nonmatching names are ignored. The process remembers each file size and modification time it attempted, so a malformed file reports one error until it changes. Import failures are sent to Sunny's existing error channel and do not prevent other files from importing.

No persistence schema changes are needed. `news.captureMode` is an existing projection field; Sunny will show `chatgpt-auto` for this runtime, with the prior `manual` value used by old saved data and older binaries. On restart the new binary derives the mode again. Existing archived stories and status remain intact. No personal feed is fetched by Sunny itself.

## Alternatives

| Approach | Reason not chosen |
| --- | --- |
| Keep the Windows file picker for each run | Leaves the requested daily and weekly import incomplete. |
| Let the collector write to Sunny's SQLite or JSON profile | Bypasses validation and can corrupt the live profile. |
| Add a local HTTP server or account token | Creates a broader access and credential boundary for a local file handoff. |
| Watch every JSON file in Downloads | Imports unrelated or unfinished files. |

## Recovery and rollback

The scanner never removes or moves source files. A failed import leaves the file in its source directory for inspection and manual retry. Rollback is to launch the previous verified package, which still reads the same version-1 news state and supports manual import. Unit tests use isolated temporary directories and fixture Hub state; they cover old files, partial writes, oversized/malformed files, symlinks, duplicate imports, one successful new import, and failure isolation. The packaged import was checked with an isolated profile; [the evidence log](../evidence/morgans-chatgpt-2026-09-29.md) records the separate full desktop fixture limitation. The live profile is never restored from a backup for testing.

The ChatGPT research task and Chrome access are separate operational dependencies. If a scheduled run cannot read the feed or save a file in the workspace inbox, Sunny reports no new stories; this import path does not imply the feed was scanned.
