# RED FRONTIER - Art Validation

**Result: PASS** - 415/415 automated checks passed.

Checkpoint: Art Direction Checkpoint 01

Asset root: `client/public/assets/`  
Review page: `art-preview/index.html`  
Validator: `scripts/validate_art.py`

This report covers structural and technical delivery properties. Aesthetic judgement and
in-context readability remain a manual art-direction review, recorded at the end of this file.

## Counts

| Group | Delivered |
|---|---:|
| Fictional cast / portraits | 5 / 5 |
| HQ tiles / Mars tiles | 64 / 64 |
| HQ props / lab props / Mars props | 18 / 7 / 13 |
| Rover directions / equipment icons | 4 / 8 |
| Resources / roles / marks / brand assets | 6 / 5 / 4 / 4 |
| Composed scenes | 3 |

## Summary

| Area | Passed | Total | Result |
|---|---:|---:|---|
| Delivery | 11 | 11 | PASS |
| Originality | 4 | 4 | PASS |
| Manifest | 22 | 22 | PASS |
| Pixel art | 4 | 4 | PASS |
| Characters | 50 | 50 | PASS |
| Tilesets | 16 | 16 | PASS |
| Props | 183 | 183 | PASS |
| Rover | 17 | 17 | PASS |
| Equipment | 35 | 35 | PASS |
| Interface | 33 | 33 | PASS |
| Branding | 10 | 10 | PASS |
| Scenes | 15 | 15 | PASS |
| Preview | 15 | 15 | PASS |

## Check log

<details><summary>Full automated check log (415 checks)</summary>

| Area | Check | Result | Evidence |
|---|---|---|---|
| Delivery | Asset manifest exists | PASS | client/public/assets/manifest.json |
| Delivery | Asset manifest parses as JSON | PASS | 100 entries |
| Delivery | Project name is correct | PASS |  |
| Delivery | Checkpoint label is correct | PASS |  |
| Delivery | Manifest records the approval gate | PASS |  |
| Delivery | Build entry point is recorded | PASS |  |
| Delivery | Native scene resolution is 384 x 224 | PASS |  |
| Delivery | Production asset count is 100 | PASS | 92 PNG + 8 metadata JSON |
| Delivery | Art bible exists | PASS | docs/ART_BIBLE.md |
| Delivery | Art bible contains the approval gate | PASS |  |
| Delivery | Build and validation scripts are checked in | PASS |  |
| Originality | Manifest carries the non-affiliation statement | PASS |  |
| Originality | Manifest marks characters and hardware as fictional | PASS |  |
| Originality | Manifest labels gameplay values as simplified educational values | PASS |  |
| Originality | No NASA logo, patch or typeface is claimed | PASS |  |
| Manifest | Counts block exists | PASS |  |
| Manifest | Count: characters | PASS | 5 / expected 5 |
| Manifest | Count: portraits | PASS | 5 / expected 5 |
| Manifest | Count: hqTiles | PASS | 64 / expected 64 |
| Manifest | Count: marsTiles | PASS | 64 / expected 64 |
| Manifest | Count: hqProps | PASS | 18 / expected 18 |
| Manifest | Count: labProps | PASS | 7 / expected 7 |
| Manifest | Count: marsProps | PASS | 13 / expected 13 |
| Manifest | Count: roverDirections | PASS | 4 / expected 4 |
| Manifest | Count: equipmentIcons | PASS | 8 / expected 8 |
| Manifest | Count: resourceIcons | PASS | 6 / expected 6 |
| Manifest | Count: roleBadges | PASS | 5 / expected 5 |
| Manifest | Count: uiMarks | PASS | 4 / expected 4 |
| Manifest | Count: branding | PASS | 4 / expected 4 |
| Manifest | Count: scenes | PASS | 3 / expected 3 |
| Manifest | File list exists | PASS | 100 files |
| Manifest | No duplicate file entries | PASS |  |
| Manifest | No manifest self-reference | PASS |  |
| Manifest | All paths are relative and contained | PASS |  |
| Manifest | Manifest covers the complete asset tree | PASS | 100 listed / 100 on disk |
| Manifest | Every entry matches size, SHA-256, dimensions and mode | PASS | all entries verified |
| Manifest | Manifest is deterministic (no timestamp fields) | PASS |  |
| Pixel art | Every PNG is RGBA | PASS | 92 images |
| Pixel art | Every PNG uses hard alpha only | PASS | no partial-alpha pixels |
| Pixel art | No embedded EXIF or ICC payloads | PASS |  |
| Pixel art | Per-asset colour vocabulary stays bounded | PASS | max 281 visible colours (scenes/hq_engineering_lab.png) |
| Characters | Character metadata parses | PASS |  |
| Characters | Frame size is 24 x 32 | PASS |  |
| Characters | Directions are down, left, right, up | PASS |  |
| Characters | Five cast entries are present | PASS | 5 entries |
| Characters | Cast IDs match the approved roster | PASS | nia, ren, val, samir, voss |
| Characters | nia: sheet file exists | PASS | client/public/assets/characters/nia_okafor.png |
| Characters | nia: portrait file exists | PASS | client/public/assets/portraits/nia_okafor.png |
| Characters | nia: sheet is 144 x 128 | PASS | 144 x 128 |
| Characters | nia: metadata grid is 6 x 4 | PASS |  |
| Characters | nia: portrait is 48 x 48 | PASS | 48 x 48 |
| Characters | nia: all 24 frames contain art | PASS | 24 / 24 |
| Characters | nia: 12 idle/walk/work animations | PASS | idle, walk, work x 4 directions |
| Characters | nia: animation frames stay in their direction row | PASS |  |
| Characters | nia: right row is a per-frame mirror of left | PASS | 6 / 6 frames |
| Characters | ren: sheet file exists | PASS | client/public/assets/characters/ren_ito.png |
| Characters | ren: portrait file exists | PASS | client/public/assets/portraits/ren_ito.png |
| Characters | ren: sheet is 144 x 128 | PASS | 144 x 128 |
| Characters | ren: metadata grid is 6 x 4 | PASS |  |
| Characters | ren: portrait is 48 x 48 | PASS | 48 x 48 |
| Characters | ren: all 24 frames contain art | PASS | 24 / 24 |
| Characters | ren: 12 idle/walk/work animations | PASS | idle, walk, work x 4 directions |
| Characters | ren: animation frames stay in their direction row | PASS |  |
| Characters | ren: right row is a per-frame mirror of left | PASS | 6 / 6 frames |
| Characters | val: sheet file exists | PASS | client/public/assets/characters/val_ruiz.png |
| Characters | val: portrait file exists | PASS | client/public/assets/portraits/val_ruiz.png |
| Characters | val: sheet is 144 x 128 | PASS | 144 x 128 |
| Characters | val: metadata grid is 6 x 4 | PASS |  |
| Characters | val: portrait is 48 x 48 | PASS | 48 x 48 |
| Characters | val: all 24 frames contain art | PASS | 24 / 24 |
| Characters | val: 12 idle/walk/work animations | PASS | idle, walk, work x 4 directions |
| Characters | val: animation frames stay in their direction row | PASS |  |
| Characters | val: right row is a per-frame mirror of left | PASS | 6 / 6 frames |
| Characters | samir: sheet file exists | PASS | client/public/assets/characters/samir_haddad.png |
| Characters | samir: portrait file exists | PASS | client/public/assets/portraits/samir_haddad.png |
| Characters | samir: sheet is 144 x 128 | PASS | 144 x 128 |
| Characters | samir: metadata grid is 6 x 4 | PASS |  |
| Characters | samir: portrait is 48 x 48 | PASS | 48 x 48 |
| Characters | samir: all 24 frames contain art | PASS | 24 / 24 |
| Characters | samir: 12 idle/walk/work animations | PASS | idle, walk, work x 4 directions |
| Characters | samir: animation frames stay in their direction row | PASS |  |
| Characters | samir: right row is a per-frame mirror of left | PASS | 6 / 6 frames |
| Characters | voss: sheet file exists | PASS | client/public/assets/characters/dr_miriam_voss.png |
| Characters | voss: portrait file exists | PASS | client/public/assets/portraits/dr_miriam_voss.png |
| Characters | voss: sheet is 144 x 128 | PASS | 144 x 128 |
| Characters | voss: metadata grid is 6 x 4 | PASS |  |
| Characters | voss: portrait is 48 x 48 | PASS | 48 x 48 |
| Characters | voss: all 24 frames contain art | PASS | 24 / 24 |
| Characters | voss: 12 idle/walk/work animations | PASS | idle, walk, work x 4 directions |
| Characters | voss: animation frames stay in their direction row | PASS |  |
| Characters | voss: right row is a per-frame mirror of left | PASS | 6 / 6 frames |
| Tilesets | HQ: atlas file exists | PASS | client/public/assets/tiles/hq_tiles.png |
| Tilesets | HQ: atlas is 128 x 128 | PASS | 128 x 128 |
| Tilesets | HQ: grid metadata is 8 x 8 | PASS |  |
| Tilesets | HQ: tile size is 16 x 16 | PASS |  |
| Tilesets | HQ: exactly 64 tile records | PASS | 64 records |
| Tilesets | HQ: tile IDs are unique | PASS |  |
| Tilesets | HQ: indices map to the 8 x 8 grid | PASS |  |
| Tilesets | HQ: every tile cell contains art | PASS | 64 / 64 |
| Tilesets | Mars: atlas file exists | PASS | client/public/assets/tiles/mars_tiles.png |
| Tilesets | Mars: atlas is 128 x 128 | PASS | 128 x 128 |
| Tilesets | Mars: grid metadata is 8 x 8 | PASS |  |
| Tilesets | Mars: tile size is 16 x 16 | PASS |  |
| Tilesets | Mars: exactly 64 tile records | PASS | 64 records |
| Tilesets | Mars: tile IDs are unique | PASS |  |
| Tilesets | Mars: indices map to the 8 x 8 grid | PASS |  |
| Tilesets | Mars: every tile cell contains art | PASS | 64 / 64 |
| Props | HQ/lab prop metadata parses | PASS |  |
| Props | hq: 18 props | PASS | 18 entries |
| Props | hq/main_display: file exists | PASS |  |
| Props | hq/main_display: dimensions match metadata | PASS | 96 x 48 |
| Props | hq/main_display: bottom-centre anchor is consistent | PASS |  |
| Props | hq/main_display: marked fictional | PASS |  |
| Props | hq/console_wide: file exists | PASS |  |
| Props | hq/console_wide: dimensions match metadata | PASS | 64 x 34 |
| Props | hq/console_wide: bottom-centre anchor is consistent | PASS |  |
| Props | hq/console_wide: marked fictional | PASS |  |
| Props | hq/console_single: file exists | PASS |  |
| Props | hq/console_single: dimensions match metadata | PASS | 32 x 32 |
| Props | hq/console_single: bottom-centre anchor is consistent | PASS |  |
| Props | hq/console_single: marked fictional | PASS |  |
| Props | hq/workstation: file exists | PASS |  |
| Props | hq/workstation: dimensions match metadata | PASS | 48 x 30 |
| Props | hq/workstation: bottom-centre anchor is consistent | PASS |  |
| Props | hq/workstation: marked fictional | PASS |  |
| Props | hq/chair: file exists | PASS |  |
| Props | hq/chair: dimensions match metadata | PASS | 16 x 22 |
| Props | hq/chair: bottom-centre anchor is consistent | PASS |  |
| Props | hq/chair: marked fictional | PASS |  |
| Props | hq/meeting_table: file exists | PASS |  |
| Props | hq/meeting_table: dimensions match metadata | PASS | 80 x 40 |
| Props | hq/meeting_table: bottom-centre anchor is consistent | PASS |  |
| Props | hq/meeting_table: marked fictional | PASS |  |
| Props | hq/server_rack: file exists | PASS |  |
| Props | hq/server_rack: dimensions match metadata | PASS | 24 x 40 |
| Props | hq/server_rack: bottom-centre anchor is consistent | PASS |  |
| Props | hq/server_rack: marked fictional | PASS |  |
| Props | hq/plant: file exists | PASS |  |
| Props | hq/plant: dimensions match metadata | PASS | 16 x 26 |
| Props | hq/plant: bottom-centre anchor is consistent | PASS |  |
| Props | hq/plant: marked fictional | PASS |  |
| Props | hq/plant_big: file exists | PASS |  |
| Props | hq/plant_big: dimensions match metadata | PASS | 24 x 36 |
| Props | hq/plant_big: bottom-centre anchor is consistent | PASS |  |
| Props | hq/plant_big: marked fictional | PASS |  |
| Props | hq/whiteboard: file exists | PASS |  |
| Props | hq/whiteboard: dimensions match metadata | PASS | 48 x 32 |
| Props | hq/whiteboard: bottom-centre anchor is consistent | PASS |  |
| Props | hq/whiteboard: marked fictional | PASS |  |
| Props | hq/window_bank: file exists | PASS |  |
| Props | hq/window_bank: dimensions match metadata | PASS | 64 x 32 |
| Props | hq/window_bank: bottom-centre anchor is consistent | PASS |  |
| Props | hq/window_bank: marked fictional | PASS |  |
| Props | hq/reception_desk: file exists | PASS |  |
| Props | hq/reception_desk: dimensions match metadata | PASS | 64 x 30 |
| Props | hq/reception_desk: bottom-centre anchor is consistent | PASS |  |
| Props | hq/reception_desk: marked fictional | PASS |  |
| Props | hq/coffee_station: file exists | PASS |  |
| Props | hq/coffee_station: dimensions match metadata | PASS | 24 x 28 |
| Props | hq/coffee_station: bottom-centre anchor is consistent | PASS |  |
| Props | hq/coffee_station: marked fictional | PASS |  |
| Props | hq/water_cooler: file exists | PASS |  |
| Props | hq/water_cooler: dimensions match metadata | PASS | 16 x 28 |
| Props | hq/water_cooler: bottom-centre anchor is consistent | PASS |  |
| Props | hq/water_cooler: marked fictional | PASS |  |
| Props | hq/mission_clock: file exists | PASS |  |
| Props | hq/mission_clock: dimensions match metadata | PASS | 32 x 18 |
| Props | hq/mission_clock: bottom-centre anchor is consistent | PASS |  |
| Props | hq/mission_clock: marked fictional | PASS |  |
| Props | hq/wall_screen_small: file exists | PASS |  |
| Props | hq/wall_screen_small: dimensions match metadata | PASS | 32 x 24 |
| Props | hq/wall_screen_small: bottom-centre anchor is consistent | PASS |  |
| Props | hq/wall_screen_small: marked fictional | PASS |  |
| Props | hq/banner_frontier: file exists | PASS |  |
| Props | hq/banner_frontier: dimensions match metadata | PASS | 24 x 48 |
| Props | hq/banner_frontier: bottom-centre anchor is consistent | PASS |  |
| Props | hq/banner_frontier: marked fictional | PASS |  |
| Props | hq/airlock_door: file exists | PASS |  |
| Props | hq/airlock_door: dimensions match metadata | PASS | 32 x 48 |
| Props | hq/airlock_door: bottom-centre anchor is consistent | PASS |  |
| Props | hq/airlock_door: marked fictional | PASS |  |
| Props | lab: 7 props | PASS | 7 entries |
| Props | lab/lab_bench: file exists | PASS |  |
| Props | lab/lab_bench: dimensions match metadata | PASS | 64 x 32 |
| Props | lab/lab_bench: bottom-centre anchor is consistent | PASS |  |
| Props | lab/lab_bench: marked fictional | PASS |  |
| Props | lab/rover_jig: file exists | PASS |  |
| Props | lab/rover_jig: dimensions match metadata | PASS | 64 x 42 |
| Props | lab/rover_jig: bottom-centre anchor is consistent | PASS |  |
| Props | lab/rover_jig: marked fictional | PASS |  |
| Props | lab/tool_cart: file exists | PASS |  |
| Props | lab/tool_cart: dimensions match metadata | PASS | 32 x 28 |
| Props | lab/tool_cart: bottom-centre anchor is consistent | PASS |  |
| Props | lab/tool_cart: marked fictional | PASS |  |
| Props | lab/component_bin: file exists | PASS |  |
| Props | lab/component_bin: dimensions match metadata | PASS | 32 x 24 |
| Props | lab/component_bin: bottom-centre anchor is consistent | PASS |  |
| Props | lab/component_bin: marked fictional | PASS |  |
| Props | lab/gantry_crane: file exists | PASS |  |
| Props | lab/gantry_crane: dimensions match metadata | PASS | 80 x 50 |
| Props | lab/gantry_crane: bottom-centre anchor is consistent | PASS |  |
| Props | lab/gantry_crane: marked fictional | PASS |  |
| Props | lab/wheel_rack: file exists | PASS |  |
| Props | lab/wheel_rack: dimensions match metadata | PASS | 40 x 40 |
| Props | lab/wheel_rack: bottom-centre anchor is consistent | PASS |  |
| Props | lab/wheel_rack: marked fictional | PASS |  |
| Props | lab/cable_reel: file exists | PASS |  |
| Props | lab/cable_reel: dimensions match metadata | PASS | 28 x 24 |
| Props | lab/cable_reel: bottom-centre anchor is consistent | PASS |  |
| Props | lab/cable_reel: marked fictional | PASS |  |
| Props | Mars prop metadata parses | PASS |  |
| Props | Mars: 13 props | PASS | 13 entries |
| Props | mars/rock_a: file exists | PASS |  |
| Props | mars/rock_a: dimensions match metadata | PASS | 28 x 20 |
| Props | mars/rock_a: bottom-centre anchor is consistent | PASS |  |
| Props | mars/rock_a: not a ground decal | PASS |  |
| Props | mars/rock_a: marked fictional | PASS |  |
| Props | mars/rock_a: carries a science/terrain note | PASS |  |
| Props | mars/rock_b: file exists | PASS |  |
| Props | mars/rock_b: dimensions match metadata | PASS | 44 x 28 |
| Props | mars/rock_b: bottom-centre anchor is consistent | PASS |  |
| Props | mars/rock_b: not a ground decal | PASS |  |
| Props | mars/rock_b: marked fictional | PASS |  |
| Props | mars/rock_b: carries a science/terrain note | PASS |  |
| Props | mars/rock_cluster: file exists | PASS |  |
| Props | mars/rock_cluster: dimensions match metadata | PASS | 68 x 42 |
| Props | mars/rock_cluster: bottom-centre anchor is consistent | PASS |  |
| Props | mars/rock_cluster: not a ground decal | PASS |  |
| Props | mars/rock_cluster: marked fictional | PASS |  |
| Props | mars/rock_cluster: carries a science/terrain note | PASS |  |
| Props | mars/mesa: file exists | PASS |  |
| Props | mars/mesa: dimensions match metadata | PASS | 128 x 80 |
| Props | mars/mesa: bottom-centre anchor is consistent | PASS |  |
| Props | mars/mesa: not a ground decal | PASS |  |
| Props | mars/mesa: marked fictional | PASS |  |
| Props | mars/mesa: carries a science/terrain note | PASS |  |
| Props | mars/sample_rock: file exists | PASS |  |
| Props | mars/sample_rock: dimensions match metadata | PASS | 24 x 20 |
| Props | mars/sample_rock: bottom-centre anchor is consistent | PASS |  |
| Props | mars/sample_rock: not a ground decal | PASS |  |
| Props | mars/sample_rock: marked fictional | PASS |  |
| Props | mars/sample_rock: carries a science/terrain note | PASS |  |
| Props | mars/beacon: file exists | PASS |  |
| Props | mars/beacon: dimensions match metadata | PASS | 20 x 32 |
| Props | mars/beacon: bottom-centre anchor is consistent | PASS |  |
| Props | mars/beacon: not a ground decal | PASS |  |
| Props | mars/beacon: marked fictional | PASS |  |
| Props | mars/beacon: carries a science/terrain note | PASS |  |
| Props | mars/relay: file exists | PASS |  |
| Props | mars/relay: dimensions match metadata | PASS | 28 x 40 |
| Props | mars/relay: bottom-centre anchor is consistent | PASS |  |
| Props | mars/relay: not a ground decal | PASS |  |
| Props | mars/relay: marked fictional | PASS |  |
| Props | mars/relay: carries a science/terrain note | PASS |  |
| Props | mars/solar_array: file exists | PASS |  |
| Props | mars/solar_array: dimensions match metadata | PASS | 64 x 34 |
| Props | mars/solar_array: bottom-centre anchor is consistent | PASS |  |
| Props | mars/solar_array: not a ground decal | PASS |  |
| Props | mars/solar_array: marked fictional | PASS |  |
| Props | mars/solar_array: carries a science/terrain note | PASS |  |
| Props | mars/cargo_crate: file exists | PASS |  |
| Props | mars/cargo_crate: dimensions match metadata | PASS | 28 x 22 |
| Props | mars/cargo_crate: bottom-centre anchor is consistent | PASS |  |
| Props | mars/cargo_crate: not a ground decal | PASS |  |
| Props | mars/cargo_crate: marked fictional | PASS |  |
| Props | mars/cargo_crate: carries a science/terrain note | PASS |  |
| Props | mars/field_habitat: file exists | PASS |  |
| Props | mars/field_habitat: dimensions match metadata | PASS | 96 x 68 |
| Props | mars/field_habitat: bottom-centre anchor is consistent | PASS |  |
| Props | mars/field_habitat: not a ground decal | PASS |  |
| Props | mars/field_habitat: marked fictional | PASS |  |
| Props | mars/field_habitat: carries a science/terrain note | PASS |  |
| Props | mars/lander: file exists | PASS |  |
| Props | mars/lander: dimensions match metadata | PASS | 80 x 64 |
| Props | mars/lander: bottom-centre anchor is consistent | PASS |  |
| Props | mars/lander: not a ground decal | PASS |  |
| Props | mars/lander: marked fictional | PASS |  |
| Props | mars/lander: carries a science/terrain note | PASS |  |
| Props | mars/landing_pad: file exists | PASS |  |
| Props | mars/landing_pad: dimensions match metadata | PASS | 112 x 72 |
| Props | mars/landing_pad: centre-anchored ground decal | PASS |  |
| Props | mars/landing_pad: marked fictional | PASS |  |
| Props | mars/landing_pad: carries a science/terrain note | PASS |  |
| Props | mars/rover_marker: file exists | PASS |  |
| Props | mars/rover_marker: dimensions match metadata | PASS | 24 x 20 |
| Props | mars/rover_marker: bottom-centre anchor is consistent | PASS |  |
| Props | mars/rover_marker: not a ground decal | PASS |  |
| Props | mars/rover_marker: marked fictional | PASS |  |
| Props | mars/rover_marker: carries a science/terrain note | PASS |  |
| Props | Prop IDs are unique across groups | PASS | 38 IDs |
| Rover | Equipment metadata parses | PASS |  |
| Rover | Rover native size is 96 x 64 | PASS |  |
| Rover | Rover sheet is 384 x 64 | PASS |  |
| Rover | Four authored directions are declared | PASS |  |
| Rover | Rover origin is 0.5 / 0.86 at bottom contact | PASS |  |
| Rover | Hero composite exists at 96 x 64 | PASS |  |
| Rover | Direction sheet exists at 384 x 64 | PASS |  |
| Rover | down: frame exists at 96 x 64 | PASS |  |
| Rover | down: sheet slice matches direction frame | PASS |  |
| Rover | left: frame exists at 96 x 64 | PASS |  |
| Rover | left: sheet slice matches direction frame | PASS |  |
| Rover | right: frame exists at 96 x 64 | PASS |  |
| Rover | right: sheet slice matches direction frame | PASS |  |
| Rover | up: frame exists at 96 x 64 | PASS |  |
| Rover | up: sheet slice matches direction frame | PASS |  |
| Rover | Right frame is a true mirror of left | PASS |  |
| Rover | Rover art is marked original and not NASA hardware | PASS |  |
| Equipment | Eight component icons are present | PASS | 8 entries |
| Equipment | Component IDs match the approved set | PASS | chassis, drive, suspension, power, antenna, arm, spectrometer, weather |
| Equipment | Component sheet is 128 x 64 | PASS |  |
| Equipment | chassis: icon file exists at 32 x 32 | PASS |  |
| Equipment | chassis: marked fictional game hardware | PASS |  |
| Equipment | chassis: simplified-values note present | PASS |  |
| Equipment | chassis: sheet slice matches icon | PASS |  |
| Equipment | drive: icon file exists at 32 x 32 | PASS |  |
| Equipment | drive: marked fictional game hardware | PASS |  |
| Equipment | drive: simplified-values note present | PASS |  |
| Equipment | drive: sheet slice matches icon | PASS |  |
| Equipment | suspension: icon file exists at 32 x 32 | PASS |  |
| Equipment | suspension: marked fictional game hardware | PASS |  |
| Equipment | suspension: simplified-values note present | PASS |  |
| Equipment | suspension: sheet slice matches icon | PASS |  |
| Equipment | power: icon file exists at 32 x 32 | PASS |  |
| Equipment | power: marked fictional game hardware | PASS |  |
| Equipment | power: simplified-values note present | PASS |  |
| Equipment | power: sheet slice matches icon | PASS |  |
| Equipment | antenna: icon file exists at 32 x 32 | PASS |  |
| Equipment | antenna: marked fictional game hardware | PASS |  |
| Equipment | antenna: simplified-values note present | PASS |  |
| Equipment | antenna: sheet slice matches icon | PASS |  |
| Equipment | arm: icon file exists at 32 x 32 | PASS |  |
| Equipment | arm: marked fictional game hardware | PASS |  |
| Equipment | arm: simplified-values note present | PASS |  |
| Equipment | arm: sheet slice matches icon | PASS |  |
| Equipment | spectrometer: icon file exists at 32 x 32 | PASS |  |
| Equipment | spectrometer: marked fictional game hardware | PASS |  |
| Equipment | spectrometer: simplified-values note present | PASS |  |
| Equipment | spectrometer: sheet slice matches icon | PASS |  |
| Equipment | weather: icon file exists at 32 x 32 | PASS |  |
| Equipment | weather: marked fictional game hardware | PASS |  |
| Equipment | weather: simplified-values note present | PASS |  |
| Equipment | weather: sheet slice matches icon | PASS |  |
| Interface | UI metadata parses | PASS |  |
| Interface | Six mission resources are present | PASS |  |
| Interface | Resource IDs match the approved set | PASS |  |
| Interface | resource budget: 16 x 16 icon exists | PASS |  |
| Interface | resource mass: 16 x 16 icon exists | PASS |  |
| Interface | resource power: 16 x 16 icon exists | PASS |  |
| Interface | resource data: 16 x 16 icon exists | PASS |  |
| Interface | resource comms: 16 x 16 icon exists | PASS |  |
| Interface | resource time: 16 x 16 icon exists | PASS |  |
| Interface | Resource sheet is 96 x 16 | PASS |  |
| Interface | Resource sheet slices match the six icons | PASS |  |
| Interface | Five role badges are present | PASS |  |
| Interface | Role IDs match the approved set | PASS |  |
| Interface | role engineer: 32 x 32 badge exists | PASS |  |
| Interface | role engineer: fictional-cast note present | PASS |  |
| Interface | role satellite: 32 x 32 badge exists | PASS |  |
| Interface | role satellite: fictional-cast note present | PASS |  |
| Interface | role finance: 32 x 32 badge exists | PASS |  |
| Interface | role finance: fictional-cast note present | PASS |  |
| Interface | role designer: 32 x 32 badge exists | PASS |  |
| Interface | role designer: fictional-cast note present | PASS |  |
| Interface | role scientist: 32 x 32 badge exists | PASS |  |
| Interface | role scientist: fictional-cast note present | PASS |  |
| Interface | Role sheet is 160 x 32 | PASS |  |
| Interface | Four interaction marks are present | PASS |  |
| Interface | mark marker_objective: 16 x 16 icon exists | PASS |  |
| Interface | mark marker_scan: 16 x 16 icon exists | PASS |  |
| Interface | mark marker_talk: 16 x 16 icon exists | PASS |  |
| Interface | mark nav_arrow: 16 x 16 icon exists | PASS |  |
| Interface | Marker sheet is 64 x 16 | PASS |  |
| Interface | 9-slice panel is 24 x 24 | PASS |  |
| Interface | 9-slice border is 8 px | PASS |  |
| Interface | 9-slice corner pixels are transparent | PASS | alpha [0, 0, 0, 0] |
| Branding | Four original brand assets are present | PASS |  |
| Branding | logo_red_frontier: dimensions match metadata | PASS | 192 x 64 |
| Branding | logo_red_frontier: marked fictional | PASS |  |
| Branding | logo_mission_mars: dimensions match metadata | PASS | 160 x 32 |
| Branding | logo_mission_mars: marked fictional | PASS |  |
| Branding | patch_ares_survey: dimensions match metadata | PASS | 64 x 64 |
| Branding | patch_ares_survey: marked fictional | PASS |  |
| Branding | wordmark_small: dimensions match metadata | PASS | 152 x 24 |
| Branding | wordmark_small: marked fictional | PASS |  |
| Branding | Branding overview sheet is 256 x 144 | PASS |  |
| Scenes | Scene metadata parses | PASS |  |
| Scenes | Three composed scenes are present | PASS | 3 scenes |
| Scenes | Scene IDs match the approved set | PASS |  |
| Scenes | hq_mission_control: file exists at 384 x 224 | PASS | 384 x 224 |
| Scenes | hq_mission_control: fully opaque native frame | PASS |  |
| Scenes | hq_mission_control: nativeScale is 1 | PASS |  |
| Scenes | hq_mission_control: marked as a visual target with mock UI | PASS |  |
| Scenes | hq_engineering_lab: file exists at 384 x 224 | PASS | 384 x 224 |
| Scenes | hq_engineering_lab: fully opaque native frame | PASS |  |
| Scenes | hq_engineering_lab: nativeScale is 1 | PASS |  |
| Scenes | hq_engineering_lab: marked as a visual target with mock UI | PASS |  |
| Scenes | mars_landing_zone: file exists at 384 x 224 | PASS | 384 x 224 |
| Scenes | mars_landing_zone: fully opaque native frame | PASS |  |
| Scenes | mars_landing_zone: nativeScale is 1 | PASS |  |
| Scenes | mars_landing_zone: marked as a visual target with mock UI | PASS |  |
| Preview | Local review page exists | PASS | art-preview/index.html |
| Preview | Review page contains every checkpoint section | PASS |  |
| Preview | Directional sprite animation uses per-row column modulo | PASS |  |
| Preview | No external network URLs | PASS |  |
| Preview | No external scripts or stylesheets | PASS |  |
| Preview | No external font import | PASS |  |
| Preview | Approval-gate language is explicit | PASS |  |
| Preview | Non-affiliation disclaimer is present | PASS |  |
| Preview | Fictional-cast disclaimer is present | PASS |  |
| Preview | Simplified educational values disclaimer is present | PASS |  |
| Preview | Mock-interface disclaimer is present | PASS |  |
| Preview | Contact sheet is downloadable | PASS | art-preview/contact_sheet.png |
| Preview | Contact sheet is 2400 x 1600 | PASS | 2400 x 1600 |
| Preview | Every local image and link resolves | PASS | 111 local references |
| Preview | Review page references production assets directly | PASS |  |

</details>

## Method and limits

- Dimensions, modes and hard alpha are read directly from every PNG.
- The manifest is checked against the complete asset tree, including SHA-256 and byte size.
- Character sheets are checked as a 6 x 4 grid of 24 x 32 frames; all 24 frames must contain art.
- Right-facing character and rover exports are checked against a horizontal mirror of the authored left art.
- Tile indices are checked against their 8 x 8 grid position; all 64 cells must contain art.
- Prop anchors and origins are checked against metadata; the landing pad is verified as a centre-anchored ground decal.
- Scene frames must be fully opaque at 384 x 224.
- The local page is checked for broken local references, external network dependencies and required disclaimers.
- Palette discipline is bounded rather than exact: authored shade mixing is allowed, while each asset must stay under 384 visible colours.

## Manual art-direction review

- Contact sheet and full review page were inspected at desktop and mobile widths in headless Chrome.
- The three composed scenes were inspected at native resolution for HUD fit, cast readability and prop overlap.
- The mesa, lab props, cast silhouettes and rover were reviewed at scene scale, not only in isolation.
- All HUD copy in composed scenes is mock interface text. It is not live mission data.

## Reproduce

```bash
python scripts/build_art.py
python scripts/validate_art.py
python -m http.server 8000
# open http://127.0.0.1:8000/art-preview/index.html
```

**Original fictional project.** Not affiliated with, endorsed by, or sponsored by NASA.
No NASA logo, mission patch, photograph, facility reconstruction or employee likeness is used.
All characters, organisations and hardware are fictional. Gameplay values are simplified educational values.
