# Sunny art bible

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
