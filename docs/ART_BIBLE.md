# RED FRONTIER — ART BIBLE

Version 0.1 · Art-direction checkpoint · November 2026

## 1. North Star

**RED FRONTIER** looks like a lost 16-bit adventure cartridge made by a contemporary
aerospace design studio. The world is warm, tactile and hand-built; the interfaces are
crisp, technical and calm. Mars is not a red rectangle. NASA headquarters is not a
generic office. Every room should tell the player what people do there before a single
line of dialogue is read.

The visual promise:

> Stepping into mission control should feel like stepping into a place where careful
> people solve difficult problems together.

### References and boundaries

- 16-bit top-down RPG composition grammar: readable silhouettes, authored tiles,
  short walk cycles, environmental storytelling.
- Contemporary human spaceflight graphics: technical labels, restrained instrument
  colors, tolerances and checklists.
- Real Mars photography as a **color and texture reference only**. No NASA photograph,
  logo, mission patch, instrument render or other protected graphic is traced or
  incorporated into the artwork.
- No Pokémon characters, maps, interface layouts, sprites, logos, music or other
  copyrighted material. No cinematic or franchise references.
- No generative texture soup, anti-aliased "pixel art" filters, mixed pixel densities,
  baked-in backgrounds, or placeholder geometric characters.

## 2. Technical Specification

| Property | Value |
|---|---|
| Native tile size | 16 × 16 px |
| Character frame | 24 × 32 px (transparent) |
| Character animation grid | 6 columns × 4 rows, 144 × 128 px sheet |
| Character directions | `down`, `left`, `right`, `up` (top to bottom) |
| Character frames | idle A, idle B, walk contact A, walk pass A, walk contact B, walk pass B |
| Dialogue portrait | 48 × 48 px |
| Item / resource icon | 16 × 16 px |
| Instrument card icon | 32 × 32 px |
| Rover assembly | 96 × 64 px (transparent), component art at 32 × 32 px |
| Camera scale | Integer only. 2× or 3× in game; 3× default on desktop |
| Filtering | Nearest-neighbour. CSS `image-rendering: pixelated` for previews |
| Rotation | Never rotate pixel art. Authored directional frames only |
| Texture format | PNG, lossless, sRGB, RGBA with real transparency |

### Rendering rules

1. Never scale a sprite by a non-integer amount in the game camera.
2. Keep all source art at native resolution. The browser applies integer scaling.
3. No anti-aliasing, feathering, soft shadows, gradients or noise brushes.
4. Shadows are authored with 1–2 px offset and cool, translucent color. Character
   sheets do **not** bake shadows; the game draws a ground shadow entity.
5. Avoid single isolated pixels unless they are intentional eye catchlights, dust
   motes, panel screws, or stars.
6. Every sprite must read as a silhouette at 1× before internal detail is considered.

### Perspective and lighting

- Top-down, three-quarter view. Floors are seen from above; front faces of furniture
  and walls are visible.
- Characters stand upright with a slightly oversized head and expressive hands.
- Global light source: upper-left. Highlights go up/left; form shadows go down/right.
- Outlines are selective, never pure black. Interior detail may omit outlines where
  color separation is sufficient.
- Interiors use a cool ambient key with warm task-light pools (teal/cyan against amber).
- Mars uses a warm low-angle key with cool mauve shadows. Sky effects never wash out
  terrain readability.
- Dithering is allowed only in deliberate 1–2 px bands on large surfaces. No random
  full-surface noise.

## 3. Master Palette

The palette is deliberately limited, role-coded and drawing-friendly. These hex values
are the source of truth in `scripts/pixel.py`.

### Neutrals and interfaces

| Name | Hex | Use |
|---|---|---|
| Ink | `#1A1422` | Darkest selective outline |
| Void | `#0B1224` | Space, deep interface background |
| Navy 1 | `#162037` | Panels, night surfaces |
| Navy 2 | `#23324D` | Mission-control walls, fabric |
| Navy 3 | `#344A67` | Raised metal, vests |
| Steel dark | `#3C4A5C` | Equipment shadow form |
| Steel | `#667687` | Metal midtone |
| Steel light | `#9CAAA7` | Metal highlight |
| Off-white | `#F4EAD8` | Type, coat, highlight |
| Cream | `#DFCFB0` | Paper, shirt, UI text tier 2 |
| Sand light | `#E8C79B` | Warm neutral |
| Fog | `#AAB4B2` | Secondary interface text |

### Mission role colors

| Role | Primary | Accent | Identity |
|---|---|---|---|
| Aerospace Engineer | Rust `#C76537` | Safety yellow `#F0B64B` | Practical, heat, hands-on |
| Mars Satellite Controller | Teal `#2E8C80` | Signal cyan `#6ADBE0` | Orbital data, signals |
| Finance Administrator | Wine `#6F3344` | Coin gold `#E7B34B` | Stewardship, paper, precision |
| Mission Designer | Slate `#344A67` | Cream `#DFCFB0` + rust lanyard | Systems thinking, planning |
| Mission Scientist (NPC) | Lab white `#EDE6D8` | Deep teal `#14544F` | Experience, guidance |

### Mars

| Name | Hex | Use |
|---|---|---|
| Rust dark | `#6D2F22` | Deep shadow, crater interior |
| Mars rust | `#A74A2E` | Bedrock, dramatic landform |
| Rust light | `#D06B3C` | Lithified soil, sunlit rock |
| Sand dark | `#9A5A3B` | Dune shadow |
| Sand | `#C17A4F` | Regolith base |
| Sand light | `#DDA16C` | Sunlit dust, wind streaks |
| Beige | `#E8C79B` | Fine dust highlight, sample targets |
| Mauve shadow | `#5A3540` | Cool terrain shadow |
| Basalt | `#3A3038` | Volcanic rock |
| Basalt light | `#5D4E51` | Rock planes |

### Skin, hair, and accents

Six authored skin ramps (`skin_01`–`skin_06`), three hair ramps (black, brown, silver),
teal/cyan signal ramps, muted greens for plants, and gold/wine accents support the cast.
Skin is never a flat fill: each character uses a base, shadow and highlight from the
same ramp. No hue-shifting to unrelated neon colors.

### Color discipline

- Teal/cyan is reserved for information, science instruments and active signals.
- Warm yellow is reserved for objectives, hazards and actionable prompts.
- Red wine is used for finance and warning states, distinct from Mars rust.
- Avoid magenta, pure black, pure white and saturated RGB primaries.
- All UI text is off-white or cream. Secondary labels use fog. Color alone never
  communicates state.

## 4. Character Specification

### Proportion and construction

- 24 × 32 px frame; body center at x=12.
- Head: roughly 11 × 12 px including hair, from y=2 to y=14. The head is intentionally
  large enough for directional expression.
- Torso: 12–14 px wide, y=15 to y=23. Legs: 2 × 5 px, y=24 to y=29. Boots: 2 px.
- One-pixel shoulder slope and jaw chamfer give a natural silhouette.
- Arms move independently of the torso. Hands are 1–2 px blocks with a visible cuff.
- Each role has one silhouette-defining accessory and one color cue, readable at 1×.
- Character sheets contain **no floor, no shadow, no labels and no backgrounds**.

### Cast

| Character | Role | Silhouette | Signature |
|---|---|---|---|
| **Nia Okafor** | Aerospace Engineer | Short twists, compact frame | Safety goggles on forehead, rust coveralls, tool belt |
| **Ren Ito** | Mars Satellite Controller | Undercut, headset ear cups | Teal field jacket, cyan headset boom, comms pack |
| **Valeria "Val" Ruiz** | Finance Administrator | High bun, neat profile | Wine waistcoat, gold jewelry, held tablet |
| **Samir Haddad** | Mission Designer | Curly top, short beard | Slate utility vest, mission lanyard, map tube/satchel |
| **Dr. Miriam Voss** | Mission Scientist | Silver bob, reading glasses | Long lab coat over plum, clipboard, teal ID |

All named characters are fictional. Their roles are inspired by real mission-team
disciplines, not by specific NASA employees.

### Animation

- **Idle:** 2 frames; one-pixel breathing shift, occasional blink on the second frame.
- **Walk:** 4 frames at 8 fps; contact, passing, contact, passing. Arms oppose legs.
- **Directions:** four authored row directions. Right-facing frames are mirrored from
  left only at export time; asymmetry is acceptable because the character is turning.
- **Interaction/work animation:** 2 frames, reserved for workstation interactions.
- **NPC portraits:** 48 × 48, frontal three-quarter, cutting off at the collarbone.
  They use the same ramps as the world sprites.

## 5. Environment Language

### NASA Headquarters

**Feeling:** purposeful, inhabited, humane. Navy acoustic panels and warm indirect light
meet whiteboards, cable trays, plants and worn carpet. The facility is fictional and
original; it is not a reconstruction of a real NASA building.

- Floors: charcoal carpet tiles, steel diamond plate, pale lab tile, wine wayfinding.
- Walls: navy acoustic panels, cream upper trim, glass partitions, orange hazard edges.
- Task lighting: warm desktop pools against teal screen glow.
- Props: sit/stand desks, curved control consoles, server racks, meeting table,
  whiteboard, water cooler, potted plants, cable runs, mission clocks.
- Screens contain abstract UI shapes and graphs, never fake readable NASA data.
- Branding is fictional: **RED FRONTIER**, **Ares Survey Program**, **MERIDIAN** team.

### Engineering Laboratory

- Cool steel floors with hazard-bordered service bays; warm work lamps.
- Overhead gantry, tool carts, component bins, rover chassis on jacks, wheel rack.
- Visual hierarchy: the rover project is always the brightest and most assembled object
  in the room.

### Mars Surface

Mars is authored from four terrain families instead of one red noise field:

1. **Dune sand** — warm rust base, wind-combed highlights, low contrast.
2. **Regolith flats** — sandy beige with fine gravel and dusty mottling.
3. **Basalt shelf** — cool charcoal planes, fractured edges, blue-mauve shadows.
4. **Crater and rim** — layered rust rings, dark interior, directional lighting.

Additional details: isolated pebbles, rock clusters, wind streaks, rover tracks, sample
targets with cyan scan rings, landing zone beacons. Dust is an animated particle layer,
never baked into terrain. The horizon is implied by darker edge shading, not a skybox
within top-down levels.

### Additional environments

Launch complex, orbital transit, EDL visualization, and debrief share the same palette.
Space scenes use navy with warm gold/cyan accents and crisp stars. The launch sequence
uses large silhouette shapes and hard-edged light, not photorealistic gradients.

## 6. Rover and Equipment Language

- Industrial scientific realism: six-wheel rocker-bogie architecture, flat warm-white
  radiator deck, rust service panels, teal instrument caps, navy shadows.
- View: three-quarter top-down. The mast, high-gain antenna and arm create a distinctive
  silhouette from above.
- Component icons: 32 × 32, dark navy chamfered background plate, warm metal object,
  single cyan or gold interaction cue. Icons remain readable on both light and dark UI.
- Instrument cards use **representational abstraction**, not NASA logos. PIXL, SuperCam
  and MEDA-inspired tools are labeled as simplified game interpretations.
- No official NASA instrument photography or logos are used directly.

### Equipment names shown in-game

Component art is original. Educational cards cite instrument families and real published
specifications in the final UI. All game stats are clearly marked as simplified gameplay
values, not real mission specifications.

## 7. UI and Typography

- Interface style: compact mission-ops console crossed with a field notebook. Chamfered
  corners, 1 px inset highlights, dark translucent panels, no web-style pills or cards.
- Panels use navy 1 at 92–97% opacity with a 1 px steel dark border and a 1 px inner
  highlight. Active elements use a 1 px cyan/amber line, not glow bloom.
- Primary typography will be a custom bitmap-style face/wordmark; body copy uses a
  legible condensed sans/mono fallback. No external web fonts required at runtime.
- All caps for labels and section headers; sentence case for explanatory copy.
- Resource icons: coin stack (budget), mass blocks (mass), battery (power), data drive
  (data), dish/radio arcs (comms), rotating clock (time).
- Numeric data always includes units. Color is redundant with icon and text.
- Motion is short, stepped, and purposeful: 80–160 ms interface slides, 120 ms cursor
  blinks, no floating SaaS cards.

## 8. Effects Palette

- Scan: cyan stepped ring with 1 px gaps.
- Dust: 1–2 px sand/beige particles with long horizontal wind streaks.
- Sparks: warm yellow 1 px ticks, short arcs, no blur.
- Signal: 1 px cyan dotted arcs radiating from dishes.
- Warnings: amber border pulse at 2 fps, never a full-screen red flash.
- Launch: hard-edged cream/gold flame shapes, navy smoke puffs with mauve shadow.
- Failure: desaturated rust and navy, upright type, no gore.

## 9. Composition and Level-Readability Rules

1. Walkable routes must remain lighter than collision masses in the same area.
2. Interactive objects get a warm yellow or cyan micro-indicator, not a floating blob.
3. Characters may overlap props but never become indistinguishable from floor colors.
4. Use negative space. Clutter is authored as narrative clusters, not sprinkles.
5. Landmark props are oversized and unique; the central mission display should be
   recognizable from a minimap thumbnail.
6. Mars traversability is communicated through tone and edge language: compacted dust
   paths, gravel fields, fractured shelves.
7. No UI panel may cover more than 30% of the game viewport during exploration.

## 10. Asset Naming and Delivery

```
client/public/assets/
  characters/<character>.png       # 144×128 directional sheet
  portraits/<character>.png        # 48×48 dialogue portrait
  tiles/hq_tiles.png               # 16px tile atlas
  tiles/mars_tiles.png             # 16px tile atlas
  props/hq/<prop>.png              # authored, transparent
  props/mars/<prop>.png            # authored, transparent
  rover/rover_assembled.png        # 96×64 hero composite
  equipment/<component>.png        # 32×32 icon + optional larger art
  ui/<icon>.png                    # 16×16 or 24×24
  branding/logo_red_frontier.png   # pixel wordmark
```

Every sheet is accompanied by JSON metadata: frame dimensions, animation names, origin,
directions, tile IDs and collision notes. Source art is generated by
`scripts/generate_art.py`, which is checked in and can regenerate every raster asset
deterministically.

## 11. Validation Checklist

- [ ] Transparent backgrounds on all character, prop, rover and UI assets.
- [ ] No anti-aliased edge pixels; alpha is 0 or 255.
- [ ] Palette colors appear exactly as authored in source art.
- [ ] Character frames align to the 24 × 32 grid from the bottom-center origin.
- [ ] Direction rows and animation ordering match metadata.
- [ ] Every portrait is distinguishable at 24 px and 48 px.
- [ ] Tiles tile without seams where marked as repeatable.
- [ ] Icons remain legible on navy 1 and cream panels.
- [ ] Contact sheet inspected at 1×, 3× and 4×.
- [ ] No text baked into spritesheets.
- [ ] No NASA logos, mission patches, or third-party characters.
- [ ] Gameplay-critical interactables have a distinct warm cue.
- [ ] Art is reviewed and approved before production integration.

## 12. Approval Gate

Production integration is intentionally paused after this checkpoint. The approver will
review:

- `art-preview/index.html`
- `art-preview/contact_sheet.png`
- the character lineup and four-direction animation strips,
- HQ and Mars tilesets plus composed visual targets,
- rover/equipment art,
- UI icons and wordmark.

No chapter implementation begins until the direction is approved.
