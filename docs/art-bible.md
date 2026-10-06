# Sunny art bible

## Full roster source extension — 2026-10-05

The shared scene catalog exposes fifteen distinct destinations: ten core crew,
four residents, and Morgans' read-only news blimp. Each configuration records
station, atlas reference, state cues and direct navigation. Only the specialist
Franky scene has admitted rest/work feet and a route. All other specialist and
resident configurations explicitly retain null anchors and empty routes; their
decorative room art is not an actor floor. Existing quarters lanes and deck
geometry remain unchanged. Residents keep their saved districts and a static
idle atlas cell; no unmeasured work-prop cell or new room travel is admitted.

Scene work follows the authoritative selected run and current assignment, with
retained historical attempts kept distinct. Review, uncertainty, failed work and
run stop/pause/block gates stop purposeful work. Visual pause freezes travel and
frame animation while status still updates; an obsolete Franky work frame clears
even while paused. System/user reduced motion and the existing opt-in arrival
audio and durable acceptance-cue contracts remain in force. No bitmap, atlas
geometry, sound sample, dependency or provenance changed.

Task17 source and tests are separate from native art admission. Exact-package
captures for the state matrix, all destinations, keyboard routing and 200% text
remain pending while native crash/hang diagnosis is open. The existing performance
protocol and failed Stage A promotion gate remain binding.

Established 2026-09-21 from inspected `island-world.png`, `crew-pet-states.png`, existing rendering code and [artwork provenance](../public/assets/ARTWORK.md). A separately named supplied pixel-art sheet was not located; the existing Chopper atlas is the documented user-selected anchor. Do not claim an unseen sheet was reviewed.

## Identity and current reality

Sunny is permanently a One Piece fan headquarters: warm tropical adventure, timber, cream sails, gold fittings, red accents, teal water, tangerine trees and distinct crew silhouettes. The current assets mix richly painted/pixel-textured environments with compact cel-shaded pet characters. They are not a uniform low-resolution pixel tileset. Preserve that working visual language; future strict pixel-art conversion needs one coordinated art direction decision, not independent regeneration of each room.

Style anchors: `ship-deck.png` for the cutaway ship; `island-world.png` for the elevated island; `chopper-pet.webp` for compact animated character scale; `crew-pet-states.png` for shared silhouettes and work props. Historical screenshots in `.sunny-dev` are layout evidence, not distributable artwork. New art should be original Sunny work or licensed with provenance; generated fan art is not a commercial asset license.

## Characters, scale and silhouettes

Keep full bodies readable at roughly 70 × 100 CSS pixels on the deck; actual island sprites scale with the world. Compare a new character beside Chopper, Luffy and Franky at runtime size. Heads are expressive and large, bodies compact, hands/props readable, feet share a consistent ground anchor. Preserve identifying hats, hair, antlers and body shapes. Do not stretch different atlas cells to force uniform anatomy. A role's workstation prop should communicate the activity without branding the character as a model vendor.

Environment perspective stays elevated three-quarter/top-down consistent with existing paths. Workstations and doors need enough space for feet, labels and selection targets. The current world uses one illustrated background and percentage coordinates, not tiles. For a future tile system, choose a single logical grid and camera scale together; do not impose guessed tile dimensions on current assets. Room collision and navigation geometry must agree with stairs, doors and props.

## Color, light, UI and icons

Use warm daylight, gentle directional shading and compact ground shadows. Keep ocean/vegetation saturated while parchment panels provide calm reading space. No neon cyberpunk replacement, photorealistic inserts, inconsistent camera angles or unrelated visual effects. Proposed palette tokens should derive from existing CSS before adding a new palette.

UI panels resemble clean logbooks and mission notices: cream surfaces, restrained green/teal controls, warm gold emphasis and red for failure. Reserve wanted-poster motifs for objective/status cards without obscuring names and evidence. Use the existing system typography for text and monospace for code; pixel display lettering may decorate short titles but not dense task transcripts. Use consistent icon stroke weights, with readable labels for unfamiliar den-den-mushi, map and bounty metaphors. Color alone never communicates state.

## Animation and exports

Current contracts (preserve unless code, tests and provenance change together):

| Asset | Layout | Behavior |
| --- | --- | --- |
| `chopper-pet.webp` | 1536 × 2288, 8 × 11, cells 192 × 208 | Original pet atlas; preserve unchanged |
| `crew-deck-sprites.png` | 5 × 2; fractional cells in existing source | Legacy still sprites; do not silently recrop |
| `crew-walk.png` | 8 × 5 | Four walk frames per character; paired characters per row |
| `crew-pet-states.png` | 8 × 5 | Two idle/two work frames per character |
| `crew-actions.png` | 4 × 5 | Four frames for each of five signature actions |
| `island-residents.png` | 4 × 4 | One resident per row; idle/two walks/work |

Generated Chopper cells in the shared atlases are unused. Existing white/magenta backgrounds are removed through the bounded runtime texture pipeline. Preserve originals. New exports should use genuine alpha, exact integer cell dimensions, identical canvas size/foot anchors per frame, and a manifest recording columns, rows, frame order, duration and intended runtime scale. Prefer PNG for new pixel sprites and lossless WebP where already supported. Do not paint fake checkerboards, labels or shadows outside the declared frame bounds.

Name assets in lowercase kebab-case by subject and purpose (`crew-walk`, `morgans-blimp-key`). Record exact exported dimensions and source/prompt/license in ARTWORK.md; do not derive dimensions from an image-generation request alone. Nearest-neighbor scaling is appropriate for genuinely discrete pixel art; inspect existing painted atlases before changing their filtering.

Walking follows paths and direction, working starts at a station, blocked/waiting pauses purposeful work, completion celebrates once per verified attempt. Scripted banter and signature actions are entertainment. Reduced motion retains state labels and interactivity while stopping travel/bobbing/frame stepping. Never imply backend work through random animation.

Acceptable variation: room props, role-specific tools, controlled district accent colors and character proportions matching their silhouette. Prohibited drift: six unrelated generated styles, unreviewed replacement of the Chopper anchor, clipped hats/feet, unstable scale, baked text, vendor logos as crew identities, and commercial artwork scraped from references. Review a contact sheet and the rendered world before admitting any new atlas.

## Voyage chart extension (2026-09-22)

`grand-line-voyage-map.png` replaces the visible single-island background while retaining the original bitmap as an art reference and rollback option. Six separate landforms use the same elevated, richly painted pixel-textured perspective as the previous island. Percent-based hotspots and local crew patrols must remain on the pictured landforms; the Sunny link sits in the central sea. Text labels, job counts, focus states and direct work controls remain HTML. The moonlit Thriller Bark landform has a local purple palette; the rest of the chart retains warm daylight and saturated teal sea. Reduced motion stops crew and blimp movement without hiding task state.

## Specialist chat-room treatments (2026-09-23)

Conversation workspaces use ten original character-specific 1536×1024 room illustrations, recorded with generated source paths, SHA256 hashes and prompt summaries in `public/assets/ARTWORK.md`. Zoro's dojo, Robin's library, Nami's chart room and the other seven rooms each use distinct props and palette. Keep the fixed scene subdued at 19% opacity beneath all text and controls; the image is decorative and aria-hidden. Rooms remain static for reduced motion. Native fixture captures in `.sunny-dev/workflow-check/` are implementation evidence, not distributable art.

Audio identity can reinforce those same station materials without becoming a soundtrack: use brief, low-volume, original synthesized arrival cues with distinct intervals and timbres for each crew room. Keep audio off until the captain enables it, provide a saved volume control and an immediate mute, and never attach sounds to mission progress. Current implementation uses small Web Audio note sequences and no recorded or third-party samples.

## Franky one-room source pilot — 2026-10-01

The root visually reviewed the raw contact overlay and corrected diagnostic contact sheet before admitting the measured Franky room geometry. Existing `franky-shipwright-room.png` remains byte-identical: SHA256 `E29915E79F9A279AF61EF490E51527190A87BBE7AF941F962D6702419D051A8C`, full1536×1024 (3:2), uncropped and proportionally letterboxed beside the opaque captain log. Rest feet are(650,680), bench feet(1150,590); the clear-floor route is(650,680)→(820,640)→(1040,550)→(1150,590), normalized to that full canvas in `FRANKY_ROOM_GEOMETRY`.

The original1586×992 crew-pet-states atlas is unchanged. Its nominal Franky row3 columns4–7 contain adjacent-row feet/prop fragments and clip soles/wrenches. The admitted in-memory extraction keeps the existing edge-connected neutral-white key, examines padded216×216 windows at x784/982/1180/1378,y595, and independently retains each largest4-connected alpha component. Column7 pads its208px source width to216. Measured sole bottoms are203/203/203/206; each frame grounds against its own bottom, keeping the shadow attached. Retained extents and source hashes are tested against the actual decoded PNG. No new bitmap, generated art or borrowed signature-action row is introduced.

Franky uses the existing viewer-facing wrench poses while working beside the bench; this does not depict or prove a literal tabletop strike. Authoritatively selected Franky build work permits travel and work frames; attention, review, acceptance and other specialist stages keep him still. Visual Pause affects only presentation. System/Sunny reduced motion suppresses travel, frame stepping and acceptance glow. A brief restrained glow requires the backend's durable first claim of a live modern result-bound acceptance; historical mounts/reloads and finished provider turns never earn it. Ambient deck entertainment remains separately labelled.

Evidence: session contact overlays/measurements in `../../sunny-session-20261001/franky-geometry-review.md`; actual-PNG and scene/state tests in `tests/franky-frames.test.cjs`, `tests/franky-workshop.test.cjs` and `tests/mission-projection.test.cjs`. Source pilot admission does not assert installed cutover, packaged rollout or passing pending native scene/accessibility captures. Strict timing/large-profile promotion gates remain independent.
