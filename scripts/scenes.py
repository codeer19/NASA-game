"""Composed visual-target scenes for the RED FRONTIER art checkpoint.

384 x 224 native frames. These are documentation targets, not in-game
screenshots: they show how the authored tiles, props, cast and UI language fit
together. All scene content is fictional; no NASA facility, vehicle or data is
depicted.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from characters import CHARACTERS, FrameState, render_character_frame, render_portrait
from equipment import rover_down, rover_left, rover_right, rover_up
from pixel import Canvas, draw_text, mix, text_width, with_alpha
from props_hq import HQ_PROPS, LAB_PROPS
from props_mars import MARS_PROPS
from tiles_hq import hq_tiles
from tiles_mars import mars_tiles
from ui_assets import RESOURCES, RESOURCE_FNS, marker_objective, marker_scan

SCENE_W = 384
SCENE_H = 224
TILE = 16
COLS = SCENE_W // TILE
ROWS = SCENE_H // TILE


@lru_cache(maxsize=1)
def _hq_tiles() -> dict[str, Canvas]:
    return {tile_id: image for tile_id, image, _ in hq_tiles()}


@lru_cache(maxsize=1)
def _mars_tiles() -> dict[str, Canvas]:
    return {tile_id: image for tile_id, image, _ in mars_tiles()}


@lru_cache(maxsize=1)
def _hq_props() -> dict[str, Canvas]:
    props = {key: fn() for key, fn in HQ_PROPS.items()}
    props.update({key: fn() for key, fn in LAB_PROPS.items()})
    return props


@lru_cache(maxsize=1)
def _mars_props() -> dict[str, Canvas]:
    return {key: fn() for key, fn in MARS_PROPS.items()}


@lru_cache(maxsize=6)
def _portrait(char_id: str) -> Canvas:
    return render_portrait(CHARACTERS[char_id])


def _tile(c: Canvas, tile_id: str, atlas: dict[str, Canvas], col: int, row: int) -> None:
    c.blit(atlas[tile_id], col * TILE, row * TILE)


def _shadow(c: Canvas, cx: int, base_y: int, width: int, strength: int = 108) -> None:
    """Hard-edged pooled shadow. Uses alpha while composing onto opaque floors."""
    color = with_alpha(mix("navy0", "ink", 0.36), strength)
    c.ellipse(cx, base_y - 2, width / 2, 2, color)
    c.hline(cx - width // 2 + 2, base_y - 1, max(1, width - 4), with_alpha(mix("navy0", "ink", 0.20), strength))
    c.set(cx - width // 2 + 1, base_y - 2, with_alpha(mix("navy0", "ink", 0.30), strength))


def _prop(c: Canvas, prop_id: str, cx: int, base_y: int, shadow_w: int | None = None) -> None:
    image = _hq_props()[prop_id]
    if shadow_w is None:
        shadow_w = max(12, min(64, int(image.width * 0.66)))
    _shadow(c, cx, base_y, shadow_w)
    c.blit(image, cx - image.width // 2, base_y - image.height)


def _mars_prop(c: Canvas, prop_id: str, cx: int, base_y: int, shadow_w: int | None = None) -> None:
    image = _mars_props()[prop_id]
    if shadow_w is None:
        shadow_w = max(12, min(96, int(image.width * 0.72)))
    _shadow(c, cx, base_y, shadow_w)
    c.blit(image, cx - image.width // 2, base_y - image.height)


def _mars_decal(c: Canvas, prop_id: str, cx: int, cy: int) -> None:
    image = _mars_props()[prop_id]
    c.blit(image, cx - image.width // 2, cy - image.height // 2)


def _character(c: Canvas, char_id: str, direction: str, x: int, base_y: int, state: int = 0) -> None:
    ch = CHARACTERS[char_id]
    frame = render_character_frame(ch, direction, FrameState(*(
        (0, False, 0) if state == 0 else
        (1, False, 0) if state == 1 else
        (0, False, 1) if state == 2 else
        (1, False, -1)
    )))
    _shadow(c, x, base_y, 13, 110)
    c.blit(frame, x - 12, base_y - 32)


def _panel(c: Canvas, x: int, y: int, w: int, h: int, *, fill="navy1", edge="steel_dark", accent="cyan") -> None:
    c.polygon(
        [(x + 2, y), (x + w - 3, y), (x + w - 1, y + 2), (x + w - 1, y + h - 3), (x + w - 3, y + h - 1), (x + 2, y + h - 1), (x, y + h - 3), (x, y + 2)],
        "ink",
    )
    c.polygon(
        [(x + 3, y + 1), (x + w - 4, y + 1), (x + w - 2, y + 3), (x + w - 2, y + h - 4), (x + w - 4, y + h - 2), (x + 3, y + h - 2), (x + 1, y + h - 4), (x + 1, y + 3)],
        fill,
    )
    c.hline(x + 2, y + 1, w - 5, edge)
    c.vline(x + 2, y + 1, h - 4, edge)
    c.hline(x + 2, y + h - 2, w - 5, "ink")
    c.vline(x + w - 2, y + 1, h - 4, "ink")
    c.set(x + 2, y + 1, accent)
    c.set(x + w - 3, y + 1, "gold")
    c.set(x + 2, y + h - 2, "steel")


def _hq_wall(c: Canvas, *, top_trim: bool = True) -> None:
    atlas = _hq_tiles()
    for row in range(5):
        for col in range(COLS):
            if row == 0 and top_trim:
                tile = "hq_wall_trim_top"
            elif row == 4:
                tile = "hq_wall_base"
            elif (col + row) % 11 == 0:
                tile = "hq_wall_panel_c"
            elif (col * 5 + row * 7) % 9 == 0:
                tile = "hq_wall_panel_b"
            else:
                tile = "hq_wall_panel_a"
            _tile(c, tile, atlas, col, row)
    for col in range(COLS):
        c.blit(atlas["hq_wall_shadow"], col * TILE, 5 * TILE)


def _carpet_floor(c: Canvas) -> None:
    atlas = _hq_tiles()
    for row in range(5, ROWS):
        for col in range(COLS):
            roll = (col * 7 + row * 13) % 23
            if roll == 0:
                tile = "hq_carpet_c"
            elif roll in (1, 2):
                tile = "hq_carpet_b"
            else:
                tile = "hq_carpet_a"
            _tile(c, tile, atlas, col, row)


def _lab_floor(c: Canvas) -> None:
    atlas = _hq_tiles()
    for row in range(4, ROWS):
        for col in range(COLS):
            if col in (0, 1) or col in (COLS - 2, COLS - 1):
                tile = "hq_steel_floor" if (col + row) % 5 else "hq_steel_grate"
            elif (col * 3 + row * 5) % 11 == 0:
                tile = "hq_lab_tile_b"
            else:
                tile = "hq_lab_tile"
            _tile(c, tile, atlas, col, row)


def _dialogue_box(c: Canvas, char_id: str, name: str, lines: list[str], prompt: str = "SPACE  >") -> None:
    x, y, w, h = 8, 166, SCENE_W - 16, 52
    _panel(c, x, y, w, h, fill="navy1", edge="steel_dark", accent="cyan")
    portrait = _portrait(char_id)
    c.rect(x + 6, y + 4, 50, 46, "navy0")
    c.frame(x + 6, y + 4, 50, 46, "steel_dark")
    c.blit(portrait, x + 7, y + 3)
    c.vline(x + 61, y + 6, 40, "navy2")
    draw_text(c, name.upper(), x + 70, y + 7, "gold", 1, 1)
    for i, line in enumerate(lines[:2]):
        draw_text(c, line, x + 70, y + 22 + i * 11, "cream", 1, 1)
    prompt_w = text_width(prompt, 1, 1)
    draw_text(c, prompt, x + w - 12 - prompt_w, y + h - 12, "fog", 1, 1)


def _title_plate(c: Canvas, x: int, y: int, title: str, subtitle: str, accent: str = "cyan") -> None:
    width = max(text_width(title, 1, 1), text_width(subtitle, 1, 1)) + 18
    _panel(c, x, y, width, 30, fill="navy1", edge="steel_dark", accent=accent)
    draw_text(c, title, x + 8, y + 6, "cream", 1, 1)
    draw_text(c, subtitle, x + 8, y + 17, "fog", 1, 1)


# ---------------------------------------------------------------------------
# HQ / Mission Control
# ---------------------------------------------------------------------------


def hq_mission_control() -> Canvas:
    c = Canvas(SCENE_W, SCENE_H)
    _hq_wall(c)
    _carpet_floor(c)
    atlas = _hq_tiles()
    props = _hq_props()

    # wall instrumentation: one dominant display, balanced side clusters
    c.blit(props["banner_frontier"], 8, 14)
    c.blit(props["window_bank"], 32, 26)
    c.blit(props["whiteboard"], 96, 24)
    c.blit(props["main_display"], 144, 12)
    c.blit(props["wall_screen_small"], 248, 18)
    c.blit(props["mission_clock"], 248, 46)
    c.blit(props["window_bank"], 280, 26)
    c.blit(props["airlock_door"], 344, 14)

    # conference rug and a steel route from the airlock
    for row in range(7, 10):
        for col in range(8, 16):
            if row in (7, 9) or col in (8, 15):
                _tile(c, "hq_rug_edge", atlas, col, row)
            else:
                _tile(c, "hq_rug_red_a" if (col + row) % 3 else "hq_rug_red_b", atlas, col, row)
    for row in range(8, ROWS):
        _tile(c, "hq_steel_floor" if row % 3 else "hq_steel_grate", atlas, 22, row)
        _tile(c, "hq_steel_floor" if row % 2 else "hq_steel_grate", atlas, 23, row)
    for row in range(5, 8):
        _tile(c, "hq_steel_floor" if row % 2 else "hq_steel_grate", atlas, 22, row)
        _tile(c, "hq_steel_floor" if row % 3 else "hq_steel_grate", atlas, 23, row)
    _tile(c, "hq_floor_dec_arrow", atlas, 22, 11)
    _tile(c, "hq_carpet_seal", atlas, 2, 9)
    _tile(c, "hq_cable_run_h", atlas, 3, 10)
    _tile(c, "hq_cable_run_h", atlas, 4, 10)
    _tile(c, "hq_access_panel", atlas, 19, 11)

    items: list[tuple[int, callable]] = []

    def add_prop(prop_id: str, cx: int, base_y: int, shadow_w: int | None = None) -> None:
        items.append((base_y, lambda p=prop_id, x=cx, y=base_y, s=shadow_w: _prop(c, p, x, y, s)))

    def add_character(char_id: str, direction: str, x: int, base_y: int, state: int = 0) -> None:
        items.append((base_y, lambda i=char_id, d=direction, xx=x, yy=base_y, st=state: _character(c, i, d, xx, yy, st)))

    # left break area
    add_prop("plant_big", 14, 122, 18)
    add_prop("server_rack", 35, 158, 20)
    add_prop("coffee_station", 66, 156, 20)
    add_prop("water_cooler", 92, 160, 15)

    # central operations desk and meeting table
    add_prop("console_wide", 160, 144, 58)
    add_prop("console_wide", 224, 144, 58)
    add_prop("meeting_table", 304, 160, 68)
    add_prop("chair", 272, 162, 14)
    add_prop("plant", 368, 132, 14)

    add_character("ren", "up", 146, 160, 1)
    add_character("nia", "up", 240, 160, 2)
    add_character("voss", "down", 304, 144, 0)
    add_character("val", "left", 352, 163, 1)
    add_character("samir", "right", 112, 162, 0)

    # warm task pools under the active work surfaces
    for cx, cy, rx, ry in ((160, 130, 40, 7), (224, 130, 40, 7), (304, 146, 34, 6), (66, 146, 20, 4)):
        for offset in range(3):
            c.ellipse(cx, cy + offset, rx - offset * 6, max(1, ry - offset * 2), with_alpha(mix("gold", "orange", 0.35), 10 - offset * 2))

    # hard amber/cyan screen spill on the desk edges
    c.hline(132, 125, 38, with_alpha("gold", 60))
    c.hline(214, 125, 38, with_alpha("cyan", 52))

    for _, draw in sorted(items, key=lambda pair: pair[0]):
        draw()

    _dialogue_box(
        c,
        "voss",
        "Dr. Miriam Voss",
        ["MERIDIAN, THIS IS OUR ONE SHOT.", "WALK THE CREW THROUGH THE PLAN."],
    )
    return c


# ---------------------------------------------------------------------------
# HQ / Engineering Laboratory
# ---------------------------------------------------------------------------


def hq_engineering_lab() -> Canvas:
    c = Canvas(SCENE_W, SCENE_H)
    atlas = _hq_tiles()
    props = _hq_props()

    # wall shell with a broad observation window and a service door
    for row in range(4):
        for col in range(COLS):
            if row == 0:
                tile = "hq_wall_trim_top"
            elif row == 3:
                tile = "hq_wall_base"
            elif (col * 3 + row) % 10 == 0:
                tile = "hq_wall_panel_c"
            else:
                tile = "hq_wall_panel_a"
            _tile(c, tile, atlas, col, row)
    for col in range(COLS):
        c.blit(atlas["hq_wall_shadow"], col * TILE, 4 * TILE)
    c.blit(props["whiteboard"], 32, 6)
    c.blit(props["window_bank"], 96, 4)
    c.blit(props["wall_screen_small"], 184, 8)
    c.blit(props["banner_frontier"], 224, 6)
    c.blit(props["airlock_door"], 344, 4)

    # hand-lettered bay sign
    draw_text(c, "BAY 02", 268, 12, "cream", 2, 1, shadow="ink")
    c.hline(268, 29, 60, "gold")
    c.hline(268, 30, 33, "rust")

    _lab_floor(c)

    # hazard-bordered steel rover bay
    for col in range(7, 18):
        for row in range(5, 13):
            tile = "hq_steel_floor" if (col + row) % 4 else "hq_steel_grate"
            _tile(c, tile, atlas, col, row)
    for col in range(7, 18):
        c.blit(atlas["hq_hazard_edge_h"], col * TILE, 5 * TILE)
        c.blit(atlas["hq_hazard_edge_h"], col * TILE, 13 * TILE)
    for row in range(5, 13):
        c.blit(atlas["hq_hazard_edge_v"], 7 * TILE, row * TILE)
        c.blit(atlas["hq_hazard_edge_v"], 17 * TILE, row * TILE)
    _tile(c, "hq_floor_warning", atlas, 6, 8)
    _tile(c, "hq_floor_ladder", atlas, 21, 6)
    _tile(c, "hq_marked_corner", atlas, 19, 4)
    _tile(c, "hq_floor_hatch", atlas, 3, 12)

    items: list[tuple[int, callable]] = []

    def add_prop(prop_id: str, cx: int, base_y: int, shadow_w: int | None = None) -> None:
        items.append((base_y, lambda p=prop_id, x=cx, y=base_y, s=shadow_w: _prop(c, p, x, y, s)))

    def add_character(char_id: str, direction: str, x: int, base_y: int, state: int = 0) -> None:
        items.append((base_y, lambda i=char_id, d=direction, xx=x, yy=base_y, st=state: _character(c, i, d, xx, yy, st)))

    add_prop("gantry_crane", 192, 112, 72)
    add_prop("lab_bench", 46, 118, 56)
    add_prop("wheel_rack", 24, 186, 34)
    add_prop("cable_reel", 94, 180, 21)
    add_prop("component_bin", 286, 122, 26)
    add_prop("tool_cart", 112, 198, 26)
    add_prop("tool_cart", 280, 198, 26)
    add_prop("plant", 366, 204, 14)
    add_prop("chair", 80, 142, 13)

    def add_rover(center_x: int, base_y: int, direction: str = "down") -> None:
        frame = {"down": rover_down, "left": rover_left, "right": rover_right, "up": rover_up}[direction]()
        items.append((base_y, lambda f=frame, x=center_x, y=base_y: (_shadow(c, x, y, 70, 130), c.blit(f, x - 48, y - 64))))

    add_rover(192, 200, "down")
    add_character("nia", "right", 128, 208, 0)
    add_character("voss", "left", 260, 208, 2)
    add_character("samir", "left", 312, 172, 1)

    for _, draw in sorted(items, key=lambda pair: pair[0]):
        draw()

    # work-lamp pool over the rover, hard-edged and restrained
    for i in range(3):
        c.ellipse(192, 182 + i, 74 - i * 12, 11 - i * 2, with_alpha(mix("gold", "orange", 0.55), 9 - i))

    return c


# ---------------------------------------------------------------------------
# Mars / Ares Basin landing zone
# ---------------------------------------------------------------------------


def _mars_ground(c: Canvas) -> None:
    atlas = _mars_tiles()
    # calm base fields: contiguous 2x2 patches rather than per-tile confetti
    for row in range(ROWS):
        for col in range(COLS):
            field = ((col // 3) * 5 + (row // 2) * 3) % 17
            if row >= 9 and col <= 8:
                tile = "mars_regolith_a" if field % 3 else "mars_regolith_b"
            elif row <= 3 and col >= 17:
                tile = "mars_basalt_a"
            elif field in (0, 1):
                tile = "mars_sand_b"
            elif field in (2, 3):
                tile = "mars_sand_c"
            elif field == 4:
                tile = "mars_dune_crest"
            else:
                tile = "mars_sand_a"
            _tile(c, tile, atlas, col, row)

    # basalt shelf with a clean, readable edge
    for row in range(0, 4):
        for col in range(17, COLS):
            if row == 3:
                tile = "mars_basalt_gravel"
            elif (col + row * 3) % 7 == 0:
                tile = "mars_basalt_fracture"
            elif (col * 5 + row) % 11 == 0:
                tile = "mars_rock_shelf_cracked"
            else:
                tile = "mars_basalt_b"
            _tile(c, tile, atlas, col, row)
    for col in range(17, COLS):
        _tile(c, "mars_transition_sand_s", atlas, col, 4)
    for row in range(0, 5):
        _tile(c, "mars_transition_sand_w", atlas, 16, row)

    # regolith basin at the south-west, with a broken transition
    for row in range(10, ROWS):
        for col in range(0, 6):
            if (col + row) % 4 == 0:
                tile = "mars_regolith_c"
            elif (col * 3 + row) % 5 == 0:
                tile = "mars_gravel_a"
            else:
                tile = "mars_regolith_a"
            _tile(c, tile, atlas, col, row)
    for col in range(0, 6):
        _tile(c, "mars_transition_dust_n", atlas, col, 9)
    for row in range(9, ROWS):
        _tile(c, "mars_transition_dust_e", atlas, 5, row)

    # compacted traverse lane from the south edge to the lander
    for row in range(7, ROWS):
        _tile(c, "mars_compacted_a" if row % 2 else "mars_compacted_b", atlas, 7, row)
        _tile(c, "mars_compacted_b" if row % 2 else "mars_compacted_a", atlas, 8, row)
    for col in range(9, 13):
        _tile(c, "mars_path_h" if col % 2 else "mars_compacted_a", atlas, col, 8)
    _tile(c, "mars_path_h", atlas, 13, 8)
    _tile(c, "mars_compacted_b", atlas, 14, 8)

    # authored crater is shown in the tileset; keep this scene clear of clutter

    # sparse, deliberate surface overlays only
    for tile, col, row in (
        ("mars_wind_h", 1, 3),
        ("mars_wind_h", 11, 6),
        ("mars_wind_v", 15, 10),
        ("mars_wind_v", 22, 7),
        ("mars_pebbles", 10, 11),
        ("mars_pebbles", 14, 5),
        ("mars_pebbles", 21, 8),
        ("mars_cracks", 3, 7),
        ("mars_cracks", 12, 3),
        ("mars_track_h", 9, 9),
        ("mars_track_v", 7, 11),
        ("mars_dust_edge", 2, 5),
        ("mars_dust_edge", 16, 12),
    ):
        _tile(c, tile, atlas, col, row)

    # landing-zone hardstand and sample ground
    for col in range(11, 15):
        for row in range(5, 7):
            _tile(c, "mars_landing_pad_center" if (col + row) % 2 else "mars_landing_pad_edge", atlas, col, row)
    _tile(c, "mars_sample_ground", atlas, 4, 11)
    _tile(c, "mars_rover_park", atlas, 6, 12)


def mars_landing_zone() -> Canvas:
    c = Canvas(SCENE_W, SCENE_H)
    _mars_ground(c)
    items: list[tuple[int, callable]] = []

    def add_prop(prop_id: str, cx: int, base_y: int, shadow_w: int | None = None) -> None:
        items.append((base_y, lambda p=prop_id, x=cx, y=base_y, s=shadow_w: _mars_prop(c, p, x, y, s)))

    def add_character(char_id: str, direction: str, x: int, base_y: int, state: int = 0) -> None:
        items.append((base_y, lambda i=char_id, d=direction, xx=x, yy=base_y, st=state: _character(c, i, d, xx, yy, st)))

    # landing pad is a ground decal, drawn before every standing object
    _mars_decal(c, "landing_pad", 214, 140)

    # landmark mesa at the rear, then the mission hardware
    add_prop("mesa", 62, 102, 104)
    add_prop("rock_b", 146, 92, 34)
    add_prop("lander", 214, 140, 58)
    add_prop("solar_array", 334, 114, 46)
    add_prop("field_habitat", 320, 184, 72)
    add_prop("relay", 274, 132, 20)
    add_prop("cargo_crate", 276, 198, 18)
    add_prop("beacon", 252, 178, 16)
    add_prop("rock_cluster", 368, 214, 42)
    add_prop("sample_rock", 62, 196, 19)
    add_prop("rover_marker", 62, 172, 14)
    add_prop("rock_a", 30, 212, 20)

    def add_rover(center_x: int, base_y: int) -> None:
        frame = rover_right()
        items.append((base_y, lambda f=frame, x=center_x, y=base_y: (_shadow(c, x, y, 72, 118), c.blit(f, x - 48, y - 64))))

    add_rover(118, 190)
    add_character("nia", "left", 182, 202, 0)
    add_character("ren", "right", 212, 204, 2)

    for _, draw in sorted(items, key=lambda pair: pair[0]):
        draw()

    # scan marker over the sample site
    c.blit(marker_scan(), 54, 158)
    c.blit(marker_objective(), 54, 140)
    # foreground wind flecks, sparse and horizontal
    for x, y in ((24, 184), (150, 216), (176, 190), (246, 208), (298, 216), (350, 200)):
        c.set(x, y, "sand_light")
        c.set(x + 1, y, "beige")

    # compact field HUD: title and resource strip share one top rail
    c.rect(0, 0, SCENE_W, 24, "navy1")
    c.hline(0, 0, SCENE_W, "steel_dark")
    c.hline(0, 1, SCENE_W, "navy3")
    c.hline(0, 23, SCENE_W, "ink")
    draw_text(c, "ARES BASIN", 8, 4, "cream", 1, 1)
    draw_text(c, "SOL 001 / TRAVERSE ACTIVE", 8, 14, "fog", 1, 1)
    c.rect(196, 5, 2, 2, "cyan")
    draw_text(c, "LINK", 202, 4, "teal_light", 1, 1)
    c.rect(196, 14, 30, 2, "navy0")
    c.rect(197, 15, 22, 1, "cyan_dark")
    for i, (key, _, _) in enumerate(RESOURCES):
        c.blit(RESOURCE_FNS[key](), 274 + i * 18, 4)

    # compact scan prompt
    _panel(c, 8, 194, 164, 22, fill="navy1", edge="steel_dark", accent="gold")
    draw_text(c, "E", 16, 201, "gold", 1, 1)
    draw_text(c, "SCAN SAMPLE", 30, 201, "cream", 1, 1)
    c.blit(marker_scan(), 111, 197)
    draw_text(c, "SITE 01", 130, 201, "fog", 1, 1)
    return c


SCENES = {
    "hq_mission_control": ("HQ Mission Control", hq_mission_control),
    "hq_engineering_lab": ("Engineering Laboratory", hq_engineering_lab),
    "mars_landing_zone": ("Mars / Ares Basin Landing Zone", mars_landing_zone),
}


def write_scenes(out_root: Path) -> dict:
    scene_root = out_root / "scenes"
    scene_root.mkdir(parents=True, exist_ok=True)
    items = []
    for scene_id, (title, fn) in SCENES.items():
        image = fn()
        image.save(scene_root / f"{scene_id}.png")
        items.append(
            {
                "id": scene_id,
                "title": title,
                "file": f"scenes/{scene_id}.png",
                "width": image.width,
                "height": image.height,
                "nativeScale": 1,
                "note": "Composed visual-direction target. HUD elements are mock game UI, not live data.",
            }
        )
    meta = {
        "scenes": items,
        "note": "Documentation targets rendered from the authored assets. No screenshot or NASA source imagery is used.",
    }
    (scene_root / "scenes.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1] / "client" / "public" / "assets"
    data = write_scenes(root)
    print(f"Wrote {len(data['scenes'])} scenes to {root / 'scenes'}")
