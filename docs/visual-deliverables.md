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
