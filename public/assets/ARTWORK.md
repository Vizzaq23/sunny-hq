# Sunny HQ artwork

Generated on 2026-09-11 with the built-in Codex `image_gen` tool. The files in this directory are project copies; the original generated outputs remain in the Codex generated-images directory.

## `thousand-sunny.png`

- Dimensions: 1536 × 1024 px
- Source: `C:\Users\Quintin\.codex\generated_images\01a08ece-a591-7ad2-b6e7-6ec26e710e62\exec-b9301eb2-61ea-41d7-9dfa-775b11c60b33.png`
- Use case: `illustration-story`

Prompt:

> A clean, detailed, hand-painted anime architectural isometric cutaway-style illustration of the actual Thousand Sunny pirate ship from One Piece. The ship is isolated on a warm cream/ivory background with a small amount of beautiful teal sea and soft isolated waves directly around the hull. The canonical Thousand Sunny is unmistakably recognizable: lion/sun figurehead at the bow/front-left, red-and-white striped hull, green grassy deck, orange tangerine trees, tall masts, cream sails bearing the Straw Hat Jolly Roger, and a red-roofed stern cabin. Preserve the actual ship's whimsical proportions and recognizable architecture. Use polished warm cel-shaded anime illustration with subtle hand-painted texture; charming, crisp, and detailed; not pixel art and not photorealistic. Use a wide 3:2 or 16:10 landscape canvas, three-quarter elevated view from above, bow pointing front-left, whole ship fully visible and filling most of the frame. Deck zones should remain visually readable and separated so transparent clickable hotspots can be overlaid by a website. Use warm sunny daylight, cheerful adventure mood, soft clean shadows, and a palette of warm ivory, teal, sunny yellow, saturated red, fresh green, and cream sails. No text, UI, labels, dashboard, interface panels, fake windows, captions, watermark, border, extra characters, or cropped ship. Keep the ocean minimal and isolated; prioritize canonical Thousand Sunny ship details and silhouette.

## `crew-sheet.png`

- Dimensions: 1774 × 887 px
- Source: `C:\Users\Quintin\.codex\generated_images\01a08ece-a591-7ad2-b6e7-6ec26e710e62\exec-0db0730b-0744-4d15-b959-81fa10f214e3.png`
- Use case: `illustration-story`

Prompt:

> One coherent character portrait sheet containing exactly 10 equal portrait medallions in a precise 5-column by 2-row grid on a warm ivory flat background with clean generous gaps. Exact order, top row left to right: Monkey D. Luffy, Roronoa Zoro, Nami, Usopp, Sanji. Bottom row left to right: Tony Tony Chopper, Nico Robin, Franky, Brook, Jinbe. Each character appears exactly once as a centered head-and-shoulders anime portrait and is canonically recognizable through distinctive features: Luffy straw hat and cheek scar; Zoro green hair and closed scarred eye; Nami orange hair; Usopp long nose and headgear/goggles; Sanji blond hair covering one eye and curled eyebrow; Chopper pink hat with white X and antlers; Robin long black hair; Franky blue pompadour and angular features; Brook skeleton face with afro; Jinbe blue fish-man features and tusk-like lower teeth. Use crisp, charming, warm cel-shaded anime illustration with consistent linework and lighting across all portraits. Exact 5 columns × 2 rows, equal-size cells, identical portrait scale, consistent circular or softly rounded medallion framing, all heads fully inside their cells, generous uniform gutters, aligned for deterministic CSS background-position atlas cropping. Landscape canvas. No names, labels, words, numbers, UI, watermark, border, duplicate or missing character, merged cells, or cropped hats, antlers, afro, or faces.

Existing pet reused unchanged: chopper-pet.webp copied from the user's installed chopper/spritesheet.webp. V2 atlas, 1536x2288, 8x11 cells at192x208. This is the user's requested style anchor.

## `crew-deck-sprites.png`

- Dimensions: 1983 × 793 px
- Atlas geometry: 5 columns × 2 rows; each logical cell is 20% × 50% of the image (approximately 396.6 × 396.5 px, square aspect)
- Exact order: Luffy, Zoro, Nami, Usopp, Sanji / Chopper, Robin, Franky, Brook, Jinbe
- Source: `C:\Users\Quintin\.codex\generated_images\01a08ece-a591-7ad2-b6e7-6ec26e710e62\exec-c161ae91-1f27-42e2-a380-1e69c9b53d52.png`
- Reference: installed `C:\Users\Quintin\.codex\pets\chopper\spritesheet.webp`
- Use case: `stylized-concept`
- Background: opaque near-white RGB (`Format24bppRgb`, alpha 255). The generator repeatedly rendered a checkerboard instead of real alpha, so this selected raw asset uses the requested plain-white fallback for CSS `mix-blend-mode: multiply` on a light deck.

Prompt summary:

> Create exactly ten compact full-body Straw Hat crew game sprites matching the installed Chopper pet's crisp dark outlines, fine painted/pixel texture, compact proportions, soft shading, and small desktop-pet scale. Arrange an exact 5 × 2 grid in the order Luffy, Zoro, Nami, Usopp, Sanji / Chopper, Robin, Franky, Brook, Jinbe. Give each a tiny work prop: map, laptop, navigation chart and compass, tool, tray and notebook, medical book, history book, wrench and blueprint, violin, and helm wheel. Keep every figure head-to-toe, centered, isolated, and readable at roughly 70 × 100 CSS pixels. The final correction replaces the generator's fake transparency checkerboard with a perfectly flat white background while preserving the characters and atlas positions.

Final runtime rendering: src/crewTexture.ts loads the raw generated white-background atlas and removes only edge-connected near-white pixels per cell in an offscreen canvas. The shared data URL preserves enclosed whites and full character colors. The original PNG remains unchanged; multiply blending is disabled. Chopper uses the original alpha atlas directly.

## Crew life extension
- `crew-actions.png`: generated four-column/five-row action atlas, rows Luffy Gear 5, Zoro bandana/haki, adult Nami wink/hair flip, Robin extra hands, Sanji angry/flaming kick. Original generated PNG preserved. Runtime edge-connected neutral-white removal uses the same bounded texture pipeline as the idle sprites.
- `ship-companion-key.png`: generated edit of `ship-deck.png` replacing the sea with magenta for desktop compositing. Original PNG preserved; the renderer removes edge-connected magenta at runtime. An initial checkerboard extraction was rejected and is not bundled.
- Existing Chopper atlas is untouched. Crew banter is a local timed script. Motion uses four-frame atlas stepping plus CSS aura effects, honors reduced motion, and does not imply autonomous backend activity.

## Pet animation extension (0.4.0)

- `crew-walk.png`: generated 8-column × 5-row atlas, four walking frames per character. Source: `C:\Users\Quintin\.codex\generated_images\01a08ebc-5a9e-76f0-9e0a-2d2285d63872\exec-fdc2b937-1d6f-482f-acd4-b797692aec34.png`.
- `crew-pet-states.png`: generated 8-column × 5-row atlas, two idle and two work frames per character, referencing the original Chopper pet and crew identities. Source: same generated-images directory, `exec-3bc7787e-5b03-400a-b788-7b68155da735.png`.
- Each row pairs two characters: Luffy/Zoro, Nami/Usopp, Sanji/Chopper, Robin/Franky, Brook/Jinbe. Generated Chopper cells are unused; the original Chopper atlas supplies all of his states.
- Raw generated assets remain unchanged. Runtime per-cell edge-connected white removal preserves enclosed whites. Frame stepping and left/right facing accompany waypoint movement.

## Island artwork extension (0.7.0)
- `island-world.png`: built-in image generation, referencing `ship-deck.png`. Prompt requested a 3:2 tropical pixel-art island with the Sunny harbor, northern observatory and forge, purple creative house, market, garden, central plaza, waterfall and connected clear paths. Source: `C:\Users\Quintin\.codex\generated_images\01a08ebc-5a9e-76f0-9e0a-2d2285d63872\exec-24bf1982-5d25-48a3-832a-3cda93cffe45.png`.
- `island-residents.png`: built-in image generation referencing `crew-pet-states.png`. Prompt requested a precise four-column/four-row pet-style atlas: Law, Ace, Vivi and Perona; each row idle, two walking poses and a work-prop pose, isolated on flat white. Source: the same generated-images directory, `exec-a6312a99-83f7-4dcb-96a0-30a954f04190.png`.
- Generated PNGs are preserved. Runtime edge-connected white removal supplies resident transparency. Character movement and frame stepping are authored in the app.

## Morgans blimp (0.9.0)

`morgans-blimp-key.png` was created with built-in image generation and then edited with the same tool. Original prompt: whimsical cream, gold and red pixel-style flying newspaper blimp; wooden newspaper-house gondola; Morgans with a black top hat; three-quarter left-facing view; no lettering. Final edit prompt: replace only the surrounding background, including spaces between ropes, with solid magenta #FF00FF; preserve the airship and remove external shadows/glow. Mode: built-in imagegen reference edit. Source: `C:\Users\Quintin\.codex\generated_images\01a08ebc-5a9e-76f0-9e0a-2d2285d63872\exec-134e1bc9-4477-4db9-a986-dd0586e4a9c6.png`.

The generated bitmap is preserved. Runtime chroma-key compositing supplies transparency, including enclosed rope gaps. Gentle bobbing is authored in CSS and disabled by Quiet map/reduced motion. Earlier opaque variants are not used in the interface.
