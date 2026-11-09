# Sunny HQ artwork

## Full roster reuse — 2026-10-05

Task17 changes renderer labels, direct destinations and state projection only.
All original image bytes, source/prompt records, atlas layouts and measured
Franky/quarters/deck geometry remain unchanged. Ten core crew retain their
existing rooms and atlases; four residents use their existing idle cell at their
saved districts; Morgans keeps the blimp and sanitized-report-only navigation.
An existing-task resident conversation now omits the room illustration element;
there is no resident room bitmap to load. The ten core conversation images keep
their original filenames. This closes an `assets/undefined` URL exposed by the
full-roster route without assigning an unmeasured room to residents.
No new source, sample, crop, exported frame or license is added. Other specialist
and resident scene entries explicitly have null rest/work anchors and no route.

Hash/container-dimension regressions preserve Chopper, Sunny and Franky source
contracts; the actual-PNG Franky extraction regression retains its independent
sole offsets. Native roster/state/reduced-motion, keyboard and 200% text visual
inspection remains pending during host crash/hang diagnosis. This record is
source reuse documentation, not fresh visual or performance admission.

Generated on 2026-09-11 with the built-in Codex `image_gen` tool. The files in this directory are project copies; the original generated outputs remain in the Codex generated-images directory.

## `thousand-sunny.png`

- Dimensions: 1536 × 1024 px
- Source: `C:\Users\Quintin\.codex\generated_images\01a08ece-a591-7ad2-b6e7-6ec26e710e62\exec-b9301eb2-61ea-41d7-9dfa-775b11c60b33.png`
- Use case: `illustration-story`

Prompt:

> A clean, detailed, hand-painted anime architectural isometric cutaway-style illustration of the actual Thousand Sunny pirate ship from One Piece. The ship is isolated on a warm cream/ivory background with a small amount of beautiful teal sea and soft isolated waves directly around the hull. The canonical Thousand Sunny is unmistakably recognizable: lion/sun figurehead at the bow/front-left, red-and-white striped hull, green grassy deck, orange tangerine trees, tall masts, cream sails bearing the Straw Hat Jolly Roger, and a red-roofed stern cabin. Preserve the actual ship's whimsical proportions and recognizable architecture. Use polished warm cel-shaded anime illustration with subtle hand-painted texture; charming, crisp, and detailed; not pixel art and not photorealistic. Use a wide 3:2 or 16:10 landscape canvas, three-quarter elevated view from above, bow pointing front-left, whole ship fully visible and filling most of the frame. Deck zones should remain visually readable and separated so transparent clickable hotspots can be overlaid by a website. Use warm sunny daylight, cheerful adventure mood, soft clean shadows, and a palette of warm ivory, teal, sunny yellow, saturated red, fresh green, and cream sails. No text, UI, labels, dashboard, interface panels, fake windows, captions, watermark, border, extra characters, or cropped ship. Keep the ocean minimal and isolated; prioritize canonical Thousand Sunny ship details and silhouette.

## `crew-sheet.png`

Studio reuse (2026-11-06): the unchanged sheet supplies `CrewPortrait` in the
Straw Hat directory and Luffy composer. CSS keeps the documented 5×2 cell
contract and 4:5 cell aspect ratio. No new extracted files, edits, commercial
license claim or changes to animated pet atlases. `thousand-sunny.png` is also
reused intact in a contained home illustration. See
[studio design](../../docs/sunny-studio-design.md).

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


## Illustrated project quarters (2026-09-21)

`project-quarters.png` is a byte-identical runtime copy of the original [project-quarters concept](../../docs/references/project-quarters-concept-2026-09-21.md), generated with the built-in Codex image_gen tool. That record contains the full prompt and original tool path. Dimensions1536 ×1024; SHA256 `1b854c869ad3bf772211d405dcfc7c26174b792396eecfc817ba163112d958d4`. No additional image editing, external download or replacement of earlier Sunny artwork occurred.

Admitted as the project-room background after native visual/geometry checks: full3:2 image with no crop, desk lanes32/57/79 percent, clear captain floor34–78% horizontally and52–76% vertically, board approach46/52. Furniture remains outside captain movement. Existing crew atlases and accessible HTML controls supply all changing state. Illustration markings are decorative, never status. Reduced motion preserves the scene and stops crew travel/frame loops. This is local implementation admission, not captain mission acceptance or permission to publish commercially.

## Grand Line voyage map (2026-09-22)

`grand-line-voyage-map.png` is a new original generated illustration used as the island view background. Built-in Codex image generation used `island-world.png` only as a style reference; the source output remains at `C:\Users\Quintin\.codex\generated_images\01a0cb6c-4608-72d0-b747-afed9475e3e3\exec-31d55a09-8275-4d50-94db-32d8c4db526d.png`. Exported size: 1536 × 1024. SHA256: `4c42031fbba281e8960b85db3ef6f056ca13aa46609da4923760b95dea8693cf`.

Final prompt: "Create a brand-new original pixel-art Grand Line archipelago, using the existing Sunny island only as a style and color-quality reference, not preserving its single-island geography. The Sunny is anchored in a clear central sea lane. Around it are six separated islands: a scholarly island with giant tree and observatory, a canal city of shipwright workshops, a moonlit gothic haunted ship island, a festival market town, a cloud island with golden temple and sky gardens, and a white judicial fortress with bridge and waterfalls. Match Sunny's crisp, charming, high-detail hand-painted pixel-art aesthetic. Keep each island distinct with open water for HTML hotspots. No labels, text, UI, logos, emblems, characters, copied official artwork or watermark. Whole 3:2 landscape composition visible without cropping." Named destination labels and status are HTML controls, not baked into the image. This generated fan setting is not a commercial license.

## Procedural crew-room sound cues (2026-09-23)

`src/roomAudio.ts` synthesizes a brief character-specific arrival cue for each of the ten core stations with Web Audio oscillators and gain envelopes. No audio bitmap/sample is bundled, recorded, fetched, or licensed from another source. Cues are opt-in, quiet, stop immediately when muted, and run only on entering/changing a crew room; they do not indicate task activity. The user-adjustable volume is capped at 65% of the cue envelope.

## Illustrated character chat rooms — 2026-09-23

Ten original generated room illustrations now give each core crewmate a distinct chat backdrop. Each is 1536 × 1024, uses `island-world.png` only as a style reference, and remains a byte-identical copy of its generated source. The prompt set requested empty, wide elevated shipboard interiors with recognizable role props, broad calm center space for conversation readability, Sunny's colorful hand-painted pixel-art game style, and no text, interface or copied official artwork.

| Asset | Generated source | SHA256 | Character-specific room direction |
| --- | --- | --- | --- |
| `luffy-captains-den.png` | `exec-5c04807e-e0dd-4c05-95b1-226392122934.png` | `59F066B491F2C5136E1C9B4B38EA96697606A605A5AF0C20FE9694BADC2D5D33` | Sunny captain's den, warm red/gold accents, open planning table and porthole |
| `zoro-dojo-room.png` | `exec-63f535c6-fc52-47d7-8e5e-ae161f2640a5.png` | `2AFADEC0E42A55A94082B88E27DEC558340EA008A39997ECBBC8D24F8BC9845E` | Timber dojo, tatami, three practice swords, straw target, sea-facing porthole |
| `nami-chart-room.png` | `exec-76719ea4-6100-49b9-87f1-372e2fc5f332.png` | `21F07BCFEB1B93F90E48908F6294A6917D9AB643427E227E09E70A9596238392` | Navigation chart room, maps, compass, brass instruments and orange accents |
| `usopp-inventors-workshop.png` | `exec-a518b4ce-fef9-48b3-bdea-4d8271409e65.png` | `0291C6522607AF49378BCD49189D1E04DFF58A81DA078F78098638ED61684C94` | Inventor's workshop, tools, slingshot materials, prototypes and bright green details |
| `sanji-galley-room.png` | `exec-904cf7a0-6940-484c-aa26-1be1b8b7c667.png` | `4116D12FE70F743AF4A6C229B8366FC7230FED3E130C02A4D0CB553EA7B8CEC3` | Ship galley, copper cookware, service counter, warm cream and red details |
| `chopper-infirmary-room.png` | `exec-5cc280f0-b421-4b52-a717-71e7e2f5a154.png` | `467462489FA619F3736F578277550211F9C502C580989757688F477D778F6E70` | Compact infirmary, medicine cabinet, examination bed, pink and mint accents |
| `robin-ship-library.png` | `exec-3db2123f-9894-4686-925a-93f770875ce9.png` | `E8230861A07E65C02C3A931388BA37D4CA98DA57EC8965AFF45B9BBABC17EA3A` | Quiet library, tall shelves, research desk, books and deep violet accents |
| `franky-shipwright-room.png` | `exec-8e2e25ad-e504-4d60-95c3-6feb18962c19.png` | `E29915E79F9A279AF61EF490E51527190A87BBE7AF941F962D6702419D051A8C` | Shipwright bay, workbench, blueprints, brass tools and industrial blue accents |
| `brook-music-room.png` | `exec-0671d1a7-9a3d-4acb-b744-6619e355c132.png` | `C5BC9C225B7AC21973DC3F4C608F8478FEBBDF1DFF86264452EC51038DB3B68B` | Music room, violin, sheet music, stage details and plum/ivory palette |
| `jinbe-helm-room.png` | `exec-b4d989a7-44ce-4e93-8e43-fda33df7ba06.png` | `8AA7B6658264FA9FC2E9B39A964E2C3491E453F90590F018B4599023F1B8EB1F` | Helm and lookout room, ship wheel, sea charts, teal wood and brass |

The exact prompt outputs are retained in the generated-images directory shown above (same directory as the Zoro source). All ten were decoded and checked in fixture conversations; the Electron workflow captured Zoro and Chopper rooms. Runtime art is aria-hidden, static, and rendered at 19% opacity under direct chat content. It contains no mission status or actionable controls. Reduced motion is verified with Chopper. These are stylized fan-room illustrations, not a commercial license.

## Franky one-room measured runtime admission — 2026-10-01

No artwork bytes or generated source records changed. The root reviewed both the raw nominal-atlas overlay and the clean padded-silhouette overlay in `sunny-session-20261001` before admitting source geometry. Room `franky-shipwright-room.png`:1536×1024, SHA256 `E29915E79F9A279AF61EF490E51527190A87BBE7AF941F962D6702419D051A8C`. Existing `crew-pet-states.png`:1586×992, SHA256 `4B5E1BAF34F3CBF29AB16BCD94F70A94221356513E276DC7CFB889DA5FF6782C`. Original generated source/provenance above remain authoritative.

Full-canvas rest feet(650,680), bench feet(1150,590), route(650,680)→(820,640)→(1040,550)→(1150,590); logical actor240×240 source-room pixels. Green floor/table/furniture bounds and all source-pixel/normalized coordinates are preserved in the session geometry review. No quarter-room coordinates, art crop or literal tabletop strike is admitted.

Nominal row3 cols4/5 idle and6/7 work contain neighboring sprites and clip extremities. Runtime-only extraction uses the existing neutral-white key, padded216×216 windows x784/982/1180/1378,y595 (last source width208 padded to216), then each largest4-connected alpha component. Local retained bounds (exclusive right/bottom): idle4(6,14)–(192,203), idle5(17,14)–(195,203), work6(20,15)–(189,203), work7(3,14)–(202,206). Independent frame sole offsets203/203/203/206 preserve ground contact. The detached decorative sparkle is omitted. Original PNGs remain unchanged; no new exported sprite asset exists.

Admission evidence: raw overlay SHA256 `E7F9DF750D2876A6F9350BEE82184A9A94D198037266A73F031EE9284B2FBB44`, final geometry overlay SHA256 `8D29E2886E0DD726A8D3665F80386ACA0A03605CFDBCDF1122E290582C6186F4`; actual decoded-PNG bounds/hashes tested in `tests/franky-frames.test.cjs`. This is measured source-pilot admission; native scene captures and performance rollout gates are separate evidence, not inferred from the contact sheet.

## Destination header reuse — 2026-10-16

`src/voyage-ui.css` reuses the existing `thousand-sunny.png`, `ship-deck.png`, `project-quarters.png`, `nami-chart-room.png`, `robin-ship-library.png`, `usopp-inventors-workshop.png`, `jinbe-helm-room.png` and `luffy-captains-den.png` as decorative header backgrounds. Existing provenance above applies. No asset bytes or actor geometry changed. Header crops are decorative and are not walkable scene geometry. Morgans retains the existing keyed/alpha blimp texture path.

### Command deck reuse — 2026-10-16
The command deck reuses the existing ship-companion texture and crew assets at their established 3:2 geometry. Workbench rooms render their existing images in a dedicated panel rather than behind conversation text. Franky's room and frame/foot contracts are unchanged. No new images, copied reference assets or third-party shaders were added in this pass.

### 2026-11-05 — local council activity projection

Reused existing crew and island artwork without changing asset bytes, licensing, atlases or frame geometry. Local council/report states drive named activity labels; decorative movement does not establish progress. The roster is collapsed by default to keep the island visible, with direct Luffy/Stop controls retained. Native fixtures include desktop,480px and island working-state screenshots; no new visual provenance is required.

## Shipboard typography and header reuse — 2026-11-06

The existing `luffy-captains-den.png` is reused as a decorative goal-panel header accent; existing ship art remains in the home header. No image, atlas or room geometry bytes changed. Official Shueisha/VIZ/Toei/card-game material was reference only; no official images or logo fonts were bundled. Existing Lucide supplies the phone-call approval icon.

New local fonts are unmodified Bangers Regular and Barlow Regular/SemiBold under SIL OFL 1.1, with full notices, exact upstream links and SHA256 values in [font provenance](../fonts/README.md). These are not official One Piece fonts. DynaFont Sōgeitai, optional textures and third-party pirate artwork were not added. Runtime font loading remains local/offline. See [visual decision and evidence](../../docs/shipboard-design-2026-11-06.md).


## Crew map treatment — 2026-11-07

Existing studio CrewPortrait and crew badges are reused unchanged. The crew map, parchment fibers and decorative sea porthole are original authored SVG/CSS; no image/shader/font bytes or atlas geometry changed, and no third-party component source was copied. See [decision and references](../../docs/crew-map-2026-11-07.md).

## 2026-11-07 — original parchment grain

`parchment-grain.svg` is an original SVG fractal-noise material authored for Sunny's crew component research pass. No external image or shader source was copied. Static low-opacity use on posters, logs and work briefs preserves text contrast. Existing portrait atlas geometry is unchanged. See `docs/crew-components-research-2026-11-07.md` for reference and license research; the sea window is original CSS, not a vendored Paper shader.

## 2026-11-07 — actual Paper shader integration

The earlier `parchment-grain.svg` custom approximation is removed. `PaperTexture` and `Water` are imported from the real Apache-2.0 `@paper-design/shaders-react` package. `crew-ocean.svg` is original Sunny vector art authored as the local image input for Water and its GPU-loss still fallback; no external artwork is fetched at runtime. Existing crew portraits and atlas geometry are unchanged. Upstream source/terms and packaged notices: [actual component integration](../../docs/crew-components-upstream.md).

## 2026-11-07 — wanted-poster directory

Original CSS/HTML poster framing and serif typography reuse existing crew-sheet.png unchanged. No manga panels, new third-party images or fake monetary/status data are introduced. Existing PaperTexture and Motion Primitives profile components remain in use; see docs/art-bible.md.

## wanted-allies.png — 2026-11-07
Generated original portrait atlas, 1254×1254, 2 columns × 2 rows: Law, Ace / Vivi, Perona. Source: C:/Users/Quintin/.codex/generated_images/01a1b7ef-2f6d-7933-b1d7-ba8c4f8b8d3b/exec-58def0c7-c170-4adf-857c-f8c4b7e29857.png. Image-generation prompt requested full-bleed chest-up manga/anime ink portraits, sky/ocean backgrounds, warm restrained colors and no text/margins/circular masks. No commercial reference asset copied. Used only in poster frames; existing animated atlases unchanged. Main-crew replacement generation was rejected; the existing crew-sheet.png remains unchanged and is cropped via CSS to fill the rectangular frames. See docs/wanted-poster-references.md for canonical bounty data and distinctions from official poster photographs.

2026-11-07 print refinement: original CSS paper edge/fold/stain treatment and SVG text layout over existing portrait art, with locally bundled OFL Alfa Slab One/IM Fell English (not official anime fonts). No new copied reference images. See public/fonts/README.md and docs/wanted-poster-references.md.


## Sourced Gear 5 poster — 2026-11-07
User explicitly requested using the actual online poster instead of generation. For this local build, the entire unmodified 600×878 JPEG from https://gear5world.com/cdn/shop/files/affiche_wanted_one_piece_luffy_gear_5.jpg?v=1737373110&width=600 replaces the captain HTML reconstruction. Source page: https://gear5world.com/en/products/affiche-one-piece-wanted-luffy-gear-5. SHA256: 6c5acd1ed60094787f970994f983ffd4ca5c15e29d37be63558cf6083f417ce1. This is a sourced retailer reproduction, not a verified pixel-identical manga scan or original Sunny art. No open redistribution license was found; this specific user-directed local asset exception does not authorize publication or general commercial-asset scraping. Do not publish this image as MIT/Apache/OFL or claim ownership. Official comparison: https://store.toei-anim.co.jp/shop/g/gMOVONP065224/ (sample-watermarked preview, not used); rights notice credits Eiichiro Oda/Shueisha/Fuji Television/Toei Animation.
The image is served locally, never hotlinked; full content is preserved without cropping, recoloring, watermark removal or generated text. Descriptive alt text includes name, Gear 5 and story bounty. Captain controls, beam masks and event semantics are unchanged. Supersedes the previous missing-Gear-5-art limitation for this local build.


## Remaining sourced crew posters — 2026-11-07
At the captain’s explicit request to do the same for everyone, nine Straw Hat specialist sheets plus Law and Ace now use complete unmodified retailer JPEGs. Sources and SHA256 values: public/assets/wanted/sources.json. All eleven source images were visually inspected: Zoro 1,111,000,000; Nami 366,000,000; Usopp 500,000,000; Sanji 1,032,000,000; Chopper 1,000; Robin 930,000,000; Franky 394,000,000 (Sunny photograph); Brook 383,000,000 (concert design); Jinbe 1,100,000,000; Law 3,000,000,000; Ace 550,000,000 (last known). Luffy’s existing sourced image remains. These are retailer reproductions, not verified exact manga scans. No open redistribution license found; scoped user-directed local use only, no publication authorization. No generated artwork, cropping, recoloring, watermark removal, external runtime fetches or atlas changes.
No verified canon poster was found for Vivi or Perona; their existing art is explicitly labelled CREW PROFILE / No verified canon wanted poster / Bounty not published, without pretending to be official wanted sheets. Full sheets retain equal core card dimensions and readable alt text; work controls and authoritative event masks remain. Actual PaperTexture remains on logs, mission briefs and fallback profile sheets; it no longer overlays sourced artwork.

## Harbor reuse — 2026-11-09

The opening harbor reuses island-world.png, ship-deck.png, the existing keyed ship texture and crew atlases without changing their bytes. CSS crops/masks the island and fits ship art/actors in one3:2 frame. Explicit handoff replay reuses the ship-deck background and existing portrait sheet. Wanted profile overlays reuse admitted full posters unchanged. Existing source/rights limitations still apply. See [world-focus plan](../../docs/world-focus-plan.md) and [studio implementation](../../docs/sunny-studio-design.md#harbor-opening-workspace--2026-11-09).
