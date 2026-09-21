# Visual deliverable review

The mission board can attach and preview a project-local PNG alongside written outputs. Supply a relative path, source/creation notes, and intended usage/review notes. These are attributed declarations, not automated copyright clearance or approval to use the image. Review the actual image and Sunny's art bible before accepting a mission or admitting an asset to the world.

The original file remains untouched. Main-process collection records its byte hash, size, dimensions and notes on the current attempt; snapshots do not contain image bytes. Explicit preview re-reads the file and requires the saved hash. The patched Electron native image decoder produces a fresh PNG preview after ancillary metadata is removed. Profiles/text metadata are omitted, so the preview is not a color-management or archival proof. Acceptance rechecks the latest recorded original bytes for each current-attempt file; changed output requires reattachment and review. Images from older attempts remain historical.

Limits: PNG only, 8 MiB source, 4096 × 4096 pixels, 4096 chunks, 32 MiB re-encoded preview. Animated PNG is rejected. Paths share the written-deliverable boundary: no traversal, absolute path, protected metadata/environment folders, symlink/junction or hard-link alias, directories, oversized files or changing reads. Dimensions/chunk bounds are checked before native decoding; ancillary metadata is not passed to that decoder. The [PNG specification](https://www.w3.org/TR/png-3/) informs the signature/chunk/header checks; Electron remains the image decoder.

Image is an additive version1 mission-artifact kind. Existing backup rules apply; restore a pre-upgrade backup before rolling back to an older app. Attachment does not replace existing artwork, publish files, activate a media subscription or claim a connected generator. This is an explicit local-file boundary for outputs from the captain's chosen creative tools.

## Actual creative output and verification limits

An original [project-quarters concept](references/project-quarters-concept-2026-09-21.md) was generated with the built-in image_gen tool in Codex and saved unchanged in the reference library. Its prompt, source, dimensions and original hash are recorded with the asset. This proves an actual selected tool output; it does not mean Sunny itself dispatched that generator.

The native mission fixture supports an explicitly selected `SUNNY_SMOKE_IMAGE` path, copying that input into its isolated project for real attachment/decode/preview/hash verification. Provider and GitHub transport in that fixture remain synthetic, and its acceptance is a fixture assertion, not the captain's approval of the artwork. Synthetic default PNG coverage is kept separately. No daily profile or runtime world art is changed by these checks.

The concept subsequently passed local runtime admission for project quarters: its full image, three desk lanes and clear captain floor are aligned in the scene. See the reference record and ARTWORK.md for geometry and provenance. It remains a single illustrated interior, not a general collision map or sprite atlas. The existing Chopper and crew originals remain unchanged.

Verification on 2026-09-21: native Electron 44.4.3 run `.sunny-dev/mission-check/1790022310925` imported the actual 1536 × 1024 original (2,724,389 bytes; SHA256 `1b854c869ad3bf772211d405dcfc7c26174b792396eecfc817ba163112d958d4`). Attachment, explicit native-decoded preview, metadata-only artifact storage, criteria gating, persistence and reload passed. The captured preview was visually inspected: complete image, readable captions and bounded layout. Provider/GitHub responses and captain acceptance in this run were fixtures.


## Live Sunny-dispatched image workflow (2026-09-21)

The [live visual mission](evidence/live-visual-mission-2026-09-21.json) now proves dispatch through the actual Hub/creator route, not only importing an image generated in this development task. Installed Codex selected `gpt-6-astra`; Brook's real task invoked the built-in `image_gen__imagegen` tool. Matched `item/started` and `item/completed` imageGeneration records identify the generation call. The task copied the original PNG and wrote [its exact prompt/provenance](references/mission-emblem-2026-09-21-provenance.md). Sunny collected the image and notes through the production evidence boundary, native-decoded a hash-matched preview and persisted both artifacts. Mission remains `WAITING_FOR_REVIEW`, with no captain acceptance or publication.

[Original output](references/mission-emblem-2026-09-21.png):1254 ×1254,1,750,990 bytes; source and workspace SHA256 both `8ebbc7bd6e36f88b84af3634733ff487ea590af8d8f239e070716fec84a07b4b`. Independent visual inspection confirmed the compass/chart, teal ribbon, red wax and cream palette. Compass/seal proportions are larger than the requested small/tiny treatment; decorative sun markings need art review. It is a review candidate, not admitted runtime art. No global originality/license guarantee or model-version/seed claim is made.

### Captain workflow

1. Open a registered project and create a mission describing the desired visual, output PNG path, source-note file and observable review criteria.
2. Select Creative worker (Brook) and start. Ask for the built-in image tool explicitly, with no API fallback or purchase. Availability depends on the installed runtime/account; a feature flag alone is not proof of a successful call.
3. Inspect the actual task result and generated files. Sunny logs image-tool activity without copying image payloads or revised prompts into activity entries. Tool completion does not accept the mission.
4. Attach the project-relative PNG with source/usage notes and attach its written provenance. Preview the recorded image, compare it against the brief/art bible, then decide whether to accept or request another attempt.

The opt-in `desktop/visual-live-check.cjs` runs this bounded live path in an isolated project under Electron with `SUNNY_RUN_LIVE_VISUAL=1`. It uses existing account quota, requires observed image-tool completion, grants no approval requests, and interrupts unfinished allocated work on exit. Node offline tests do not start a provider. The first launch exposed Electron's entry-point difference (`require.main` is `electron`); an isolated probe confirmed it, the idle test process was stopped, and explicit script-path startup fixed it before any mission ran. The later activity-log feature was verified separately by regression tests; the already completed live run does not prove that later code was loaded.
