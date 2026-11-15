"""NASA headquarters tileset: 16×16 authored tiles, 8×8 atlas."""

from __future__ import annotations

import json
import random
from pathlib import Path

from pixel import C, Canvas, darken, lighten, mix

TILE = 16

HQ_FLOOR = mix("navy1", "navy2", 0.50)
HQ_FLOOR_DARK = mix("navy1", "ink", 0.32)
HQ_FLOOR_LIGHT = mix("navy2", "steel", 0.35)
HQ_CARPET_WINE = mix("wine_vest_dark", "navy1", 0.35)
HQ_LAB = mix("cream", "steel_light", 0.45)


def _speckle(c: Canvas, rng: random.Random, colors, count: int) -> None:
    for _ in range(count):
        c.set(rng.randrange(TILE), rng.randrange(TILE), rng.choice(colors))


def _noise_floor(seed: int, base, hi, lo, n: int = 12) -> Canvas:
    rng = random.Random(seed)
    c = Canvas(TILE, TILE, base)
    for _ in range(n):
        c.set(rng.randrange(TILE), rng.randrange(TILE), rng.choice((hi, lo)))
    return c


def _carpet(seed: int, accent: bool = False) -> Canvas:
    rng = random.Random(seed)
    c = Canvas(TILE, TILE, HQ_FLOOR)
    # tile seam and low-contrast weave
    c.hline(0, 0, TILE, HQ_FLOOR_DARK)
    c.vline(0, 0, TILE, HQ_FLOOR_DARK)
    c.hline(1, 1, TILE - 1, HQ_FLOOR_LIGHT)
    for y in range(3, TILE, 4):
        for x in range(2, TILE, 4):
            c.set(x + (y // 4) % 2, y, mix(HQ_FLOOR, "steel", 0.18))
    _speckle(c, rng, (HQ_FLOOR_DARK, HQ_FLOOR_LIGHT), 9)
    if accent:
        c.rect(6, 6, 4, 1, "rust")
        c.rect(7, 5, 2, 3, "rust_light")
        c.rect(6, 8, 4, 1, "rust_dark")
        c.set(11, 6, "gold")
        c.set(4, 7, "gold")
    return c


def _panel_floor(base, seed: int) -> Canvas:
    rng = random.Random(seed)
    c = Canvas(TILE, TILE, base)
    c.hline(0, 0, TILE, mix(base, "ink", 0.45))
    c.hline(0, 1, TILE, mix(base, "white", 0.20))
    c.vline(0, 0, TILE, mix(base, "ink", 0.45))
    c.vline(1, 0, TILE, mix(base, "white", 0.16))
    for x, y in ((2, 2), (13, 2), (2, 13), (13, 13)):
        c.set(x, y, "steel_light")
        c.set(x + 1, y + 1, "steel_dark")
    c.hline(4, 8, 8, mix(base, "white", 0.10))
    _speckle(c, rng, (mix(base, "white", 0.15), mix(base, "ink", 0.24)), 8)
    return c


def _hazard(seed: int = 1) -> Canvas:
    c = Canvas(TILE, TILE, "ink_soft")
    for y in range(TILE):
        for x in range(TILE):
            if (x + y) % 8 < 3:
                c.set(x, y, "gold")
            elif (x + y) % 8 == 3:
                c.set(x, y, "yellow")
    rng = random.Random(seed)
    for _ in range(6):
        c.set(rng.randrange(TILE), rng.randrange(TILE), "rust_dark")
    return c


def _overlay() -> Canvas:
    return Canvas(TILE, TILE)


def _wall_panel(seed: int, variant: int = 0) -> Canvas:
    rng = random.Random(seed)
    base = mix("navy2", "navy1", 0.20 + variant * 0.10)
    c = Canvas(TILE, TILE, base)
    c.hline(0, 0, TILE, mix(base, "white", 0.10))
    c.hline(0, TILE - 1, TILE, mix(base, "ink", 0.40))
    # acoustic felt seams
    c.vline(0, 0, TILE, mix(base, "ink", 0.30))
    c.vline(8, 0, TILE, mix(base, "ink", 0.20))
    c.hline(0, 8, TILE, mix(base, "ink", 0.18))
    for y in range(2, TILE, 3):
        for x in range(2, TILE, 3):
            if (x + y + variant) % 5 == 0:
                c.set(x, y, mix(base, "steel", 0.16))
    _speckle(c, rng, (mix(base, "ink", 0.2), mix(base, "white", 0.12)), 5)
    return c


def hq_tiles() -> list[tuple[str, Canvas, str]]:
    """Return (id, image, layer_kind) for 64 HQ tiles."""
    tiles: list[tuple[str, Canvas, str]] = []

    # Row 0 — carpets and primary floors
    tiles.append(("hq_carpet_a", _carpet(11), "floor"))
    tiles.append(("hq_carpet_b", _carpet(12), "floor"))
    tiles.append(("hq_carpet_c", _carpet(13, accent=True), "floor"))
    c = _carpet(14)
    c.rect(5, 5, 6, 6, "rust_dark")
    c.ellipse(8, 8, 2.6, 2.6, "rust")
    c.rect(7, 7, 2, 2, "rust_light")
    c.hline(8, 8, 4, "gold")
    c.set(11, 7, "gold")
    tiles.append(("hq_carpet_seal", c, "floor"))
    c = Canvas(TILE, TILE, HQ_CARPET_WINE)
    c.hline(0, 7, TILE, mix(HQ_CARPET_WINE, "wine_light", 0.25))
    c.hline(0, 8, TILE, mix(HQ_CARPET_WINE, "ink", 0.30))
    tiles.append(("hq_carpet_wine", c, "floor"))
    c = _noise_floor(21, mix(HQ_FLOOR, "steel_dark", 0.5), HQ_FLOOR_LIGHT, HQ_FLOOR_DARK, 9)
    c.polygon([(10, 0), (16, 0), (16, 9), (13, 16), (0, 16), (0, 13)], HQ_FLOOR)
    c.line(0, 13, 13, 16, HQ_FLOOR_DARK)
    tiles.append(("hq_carpet_transition", c, "floor"))
    tiles.append(("hq_steel_floor", _panel_floor(mix("steel_dark", "navy1", 0.35), 31), "floor"))
    c = Canvas(TILE, TILE, "navy0")
    for y in range(2, TILE, 4):
        c.rect(1, y, 14, 2, "steel_dark")
        c.hline(1, y + 2, 14, "ink")
        c.hline(1, y, 14, "steel")
    c.hline(0, 0, TILE, "navy2")
    tiles.append(("hq_steel_grate", c, "floor"))

    # Row 1 — floor details
    tiles.append(("hq_lab_tile", _noise_floor(41, HQ_LAB, "white", "steel", 5), "floor"))
    c = _noise_floor(42, mix(HQ_LAB, "steel", 0.25), "cream", "steel", 7)
    c.vline(0, 0, TILE, "steel")
    c.hline(0, 0, TILE, "steel_light")
    tiles.append(("hq_lab_tile_b", c, "floor"))
    tiles.append(("hq_hazard_floor", _hazard(43), "floor"))
    c = _panel_floor(mix("steel_dark", "navy1", 0.35), 44)
    c.rect(3, 3, 10, 10, "navy1")
    c.frame(3, 3, 10, 10, "steel")
    c.hline(5, 5, 6, "steel_dark")
    c.set(5, 10, "gold")
    c.set(10, 10, "cyan_dark")
    tiles.append(("hq_access_panel", c, "floor"))
    c = _panel_floor(mix("steel_dark", "navy1", 0.35), 45)
    c.hline(2, 7, 12, "navy0")
    c.hline(2, 8, 12, "cyan_dark")
    c.set(13, 7, "cyan")
    c.set(4, 8, "rust_light")
    tiles.append(("hq_cable_run_h", c, "floor"))
    c = _panel_floor(mix("steel_dark", "navy1", 0.35), 46)
    c.vline(7, 2, 12, "navy0")
    c.vline(8, 2, 12, "cyan_dark")
    c.set(7, 3, "rust_light")
    c.set(8, 13, "cyan")
    tiles.append(("hq_cable_run_v", c, "floor"))
    c = _overlay()
    for y in range(6):
        density = 6 - y
        for x in range(TILE):
            if (x + y * 3) % density == 0:
                c.set(x, y, mix("navy0", "ink", 0.4))
        c.hline(0, y, TILE, mix("navy0", "ink", 0.45)) if y < 3 else None
    tiles.append(("hq_floor_shadow", c, "overlay"))
    c = _overlay()
    for y in range(TILE):
        for x in range(TILE):
            if (x * 3 + y * 5) % 13 == 0:
                c.set(x, y, "gold")
            elif (x * 7 + y) % 19 == 0:
                c.set(x, y, "yellow")
    tiles.append(("hq_floor_light", c, "overlay"))

    # Row 2 — walls
    tiles.append(("hq_wall_panel_a", _wall_panel(51, 0), "wall"))
    tiles.append(("hq_wall_panel_b", _wall_panel(52, 1), "wall"))
    tiles.append(("hq_wall_panel_c", _wall_panel(53, 2), "wall"))
    c = _wall_panel(54)
    c.rect(0, 0, TILE, 3, "cream_dark")
    c.hline(0, 0, TILE, "white")
    c.hline(0, 3, TILE, "steel_dark")
    tiles.append(("hq_wall_trim_top", c, "wall"))
    c = _wall_panel(55)
    c.rect(0, 5, TILE, 2, "steel_dark")
    c.hline(0, 5, TILE, "steel_light")
    c.hline(0, 7, TILE, "ink_soft")
    tiles.append(("hq_wall_trim_mid", c, "wall"))
    c = _wall_panel(56)
    c.vline(0, 0, TILE, "steel_light")
    c.vline(1, 0, TILE, "cream_dark")
    c.vline(2, 0, TILE, "ink_soft")
    tiles.append(("hq_wall_corner_l", c, "wall"))
    c = _wall_panel(57)
    c.vline(14, 0, TILE, "ink_soft")
    c.vline(15, 0, TILE, "steel_dark")
    tiles.append(("hq_wall_corner_r", c, "wall"))
    c = Canvas(TILE, TILE, mix("navy1", "ink", 0.2))
    c.rect(0, 0, TILE, 8, "navy2")
    c.hline(0, 8, TILE, "steel_dark")
    c.rect(0, 11, TILE, 5, "steel_dark")
    c.hline(0, 11, TILE, "steel_light")
    c.hline(0, 15, TILE, "ink_soft")
    c.set(2, 13, "steel")
    c.set(13, 13, "steel")
    tiles.append(("hq_wall_base", c, "wall"))

    # Row 3 — window bank and door frames
    def window_piece(kind: str) -> Canvas:
        c = Canvas(TILE, TILE, "navy1")
        # frame
        c.rect(0, 0, TILE, TILE, "steel_dark")
        c.hline(0, 0, TILE, "steel")
        c.hline(0, 1, TILE, "navy1")
        c.hline(0, 15, TILE, "ink_soft")
        # sky bands
        sky_top, sky_mid, horizon = "navy0", "navy1", "mauve_shadow"
        c.rect(2, 2, 12, 12, sky_mid)
        c.hline(2, 2, 12, sky_top)
        c.hline(2, 10, 12, horizon)
        c.hline(2, 11, 12, mix(horizon, "gold", 0.20))
        c.hline(2, 12, 12, "navy1")
        # lit / mullion variant
        if kind == "lit":
            c.rect(3, 7, 10, 3, mix("rust_light", "gold", 0.28))
            c.hline(3, 10, 10, "rust")
        if kind in ("left", "right"):
            edge = 0 if kind == "left" else 12
            c.rect(edge, 0, 4, TILE, "steel_dark")
            c.vline(edge + (3 if kind == "left" else 0), 0, TILE, "steel_light")
        for x, y in ((5, 4), (10, 3), (12, 7), (4, 8), (9, 6)):
            c.set(x, y, "cyan_light" if kind != "lit" else "gold")
        c.hline(4, 13, 8, "steel_dark")
        return c

    tiles.append(("hq_window_left", window_piece("left"), "wall"))
    tiles.append(("hq_window_glass", window_piece("glass"), "wall"))
    tiles.append(("hq_window_right", window_piece("right"), "wall"))
    tiles.append(("hq_window_glass_lit", window_piece("lit"), "wall"))

    def door_frame(side: int) -> Canvas:
        c = _wall_panel(60 + side)
        c.rect(0, 0, TILE, TILE, "steel_dark")
        c.rect(2 if side == 0 else 10, 0, 4, TILE, "navy2")
        c.vline(2 if side == 0 else 13, 0, TILE, "steel_light")
        c.vline(7 if side == 0 else 8, 0, TILE, "steel_dark")
        ghost = "gold" if side == 0 else "rust_light"
        c.set(1, 3, ghost)
        c.set(1, 12, ghost)
        return c

    tiles.append(("hq_door_frame_l", door_frame(0), "wall"))
    tiles.append(("hq_door_frame_r", door_frame(1), "wall"))
    c = _wall_panel(64)
    c.rect(0, 0, TILE, TILE, "navy2")
    c.rect(2, 2, 12, 12, "navy0")
    c.frame(2, 2, 12, 12, "steel_dark")
    c.rect(7, 2, 2, 12, "steel")
    c.rect(3, 7, 11, 2, "steel_dark")
    tiles.append(("hq_airlock_tile", c, "wall"))
    c = _wall_panel(65)
    c.rect(0, 5, TILE, 6, "ink_soft")
    for y in range(5, 11):
        for x in range(TILE):
            if (x + y) % 8 < 3:
                c.set(x, y, "gold")
    tiles.append(("hq_wall_hazard", c, "wall"))

    # Row 4 — wall details
    c = _wall_panel(71)
    c.rect(3, 4, 10, 7, "navy0")
    c.frame(3, 4, 10, 7, "steel")
    for y in range(6, 10, 2):
        for x in range(5, 11, 2):
            c.set(x, y, "steel_dark")
    c.hline(2, 12, 12, "ink_soft")
    tiles.append(("hq_wall_vent", c, "wall"))
    c = _wall_panel(72)
    c.rect(2, 3, 12, 10, mix("navy3", "steel_dark", 0.3))
    c.frame(2, 3, 12, 10, "steel_light")
    c.rect(4, 5, 8, 1, "cream")
    c.rect(4, 8, 6, 1, "steel")
    tiles.append(("hq_wall_panel_light", c, "wall"))
    c = _wall_panel(73)
    c.rect(2, 4, 12, 8, "navy0")
    c.frame(2, 4, 12, 8, "steel_dark")
    c.vline(8, 4, 8, "navy1")
    tiles.append(("hq_wall_panel_dark", c, "wall"))
    c = _wall_panel(74)
    c.ellipse(8, 8, 5, 5, "navy0")
    c.ellipse(8, 8, 4, 4, "rust")
    c.rect(7, 6, 3, 3, "rust_light")
    c.line(10, 4, 13, 3, "cream")
    c.set(13, 3, "gold")
    tiles.append(("hq_wall_emblem", c, "wall"))
    c = _wall_panel(75)
    c.rect(0, 9, TILE, 3, "steel_dark")
    c.hline(0, 9, TILE, "steel_light")
    c.hline(0, 12, TILE, "navy0")
    for x in range(2, TILE, 5):
        c.vline(x, 7, 6, "steel_dark")
    tiles.append(("hq_wall_cable_tray", c, "wall"))
    c = _wall_panel(76)
    c.rect(1, 3, 14, 10, "white")
    c.frame(1, 3, 14, 10, "steel_dark")
    c.line(3, 9, 7, 6, "teal")
    c.line(7, 6, 10, 8, "teal")
    c.line(10, 8, 13, 5, "teal")
    c.rect(3, 5, 3, 1, "gold")
    c.set(12, 10, "rust")
    tiles.append(("hq_wall_board", c, "wall"))
    c = _wall_panel(77)
    c.rect(2, 3, 12, 4, "steel_light")
    c.frame(2, 3, 12, 4, "steel_dark")
    c.rect(4, 4, 8, 2, mix("gold", "white", 0.4))
    c.set(3, 9, "steel_dark")
    c.set(12, 9, "steel_dark")
    c.hline(6, 11, 4, "steel_dark")
    tiles.append(("hq_wall_light", c, "wall"))
    c = _wall_panel(78)
    c.rect(5, 3, 6, 2, "steel_dark")
    c.rect(6, 4, 4, 3, "gold")
    c.rect(7, 4, 2, 2, "yellow")
    c.vline(8, 7, 4, "steel_dark")
    tiles.append(("hq_wall_sconce", c, "wall"))

    # Row 5 — engineering / marked floors
    c = _noise_floor(81, HQ_LAB, "white", "steel", 5)
    c.rect(5, 5, 6, 6, "steel_dark")
    c.rect(6, 6, 4, 4, "navy1")
    for y in range(7, 10, 2):
        c.hline(7, y, 2, "cyan_dark")
    tiles.append(("hq_lab_drain", c, "floor"))
    c = _panel_floor(mix("steel_dark", "navy1", 0.35), 82)
    c.line(1, 10, 1, 1, "gold")
    c.line(1, 1, 10, 1, "gold")
    c.set(2, 2, "yellow")
    tiles.append(("hq_marked_corner", c, "floor"))
    c = _overlay()
    c.rect(0, 0, TILE, 3, "gold")
    for x in range(TILE):
        c.set(x, 3, "ink_soft")
        if x % 4 == 0:
            c.set(x, 1, "ink_soft")
    tiles.append(("hq_hazard_edge_h", c, "overlay"))
    c = _overlay()
    c.rect(0, 0, 3, TILE, "gold")
    for y in range(TILE):
        c.set(3, y, "ink_soft")
        if y % 4 == 0:
            c.set(1, y, "ink_soft")
    tiles.append(("hq_hazard_edge_v", c, "overlay"))
    c = _overlay()
    c.rect(0, 11, TILE, 5, "steel_dark")
    c.hline(0, 11, TILE, "steel_light")
    c.hline(0, 15, TILE, "ink_soft")
    tiles.append(("hq_carpet_edge", c, "overlay"))
    c = _panel_floor(mix("steel_dark", "navy1", 0.35), 85)
    c.rect(2, 2, 12, 12, "navy1")
    c.frame(2, 2, 12, 12, "steel")
    c.hline(6, 7, 4, "steel_dark")
    c.hline(6, 8, 4, "steel_dark")
    tiles.append(("hq_floor_hatch", c, "floor"))
    c = _overlay()
    for y in range(1, TILE, 4):
        c.hline(5, y, 6, "steel")
        c.hline(5, y + 1, 6, "steel_dark")
    c.vline(4, 0, TILE, "steel_dark")
    c.vline(11, 0, TILE, "steel_dark")
    tiles.append(("hq_floor_ladder", c, "overlay"))
    c = _panel_floor(mix("steel_dark", "navy1", 0.35), 87)
    c.line(4, 3, 12, 3, "gold")
    c.line(4, 3, 8, 12, "gold")
    c.line(12, 3, 8, 12, "gold")
    c.line(8, 6, 8, 11, "gold")
    c.set(8, 8, "ink_soft")
    tiles.append(("hq_floor_warning", c, "floor"))

    # Row 6 — glass partitions and ceiling overlays
    c = _overlay()
    c.rect(0, 0, TILE, 5, "steel_dark")
    c.hline(0, 0, TILE, "steel_light")
    c.hline(0, 4, TILE, "navy1")
    c.vline(0, 0, TILE, "steel_dark")
    c.vline(15, 0, TILE, "steel_dark")
    for x in (4, 9, 14):
        c.set(x, 7, "cyan_dark")
        c.set(x - 1, 8, "teal_dark")
    tiles.append(("hq_glass_top", c, "overlay"))
    c = _overlay()
    c.vline(0, 0, TILE, "steel_dark")
    c.vline(15, 0, TILE, "steel_dark")
    for y in range(0, TILE, 4):
        c.set(4, y, "cyan_dark")
        c.set(9, y + 2, "teal_dark")
        c.set(14, y + 1, "steel")
    tiles.append(("hq_glass_mid", c, "overlay"))
    c = _overlay()
    c.rect(0, 11, TILE, 5, "steel_dark")
    c.hline(0, 11, TILE, "steel_light")
    c.hline(0, 15, TILE, "ink_soft")
    c.vline(0, 0, TILE, "steel_dark")
    c.vline(15, 0, TILE, "steel_dark")
    tiles.append(("hq_glass_bottom", c, "overlay"))
    c = _overlay()
    c.rect(0, 6, TILE, 4, "steel_dark")
    c.hline(0, 6, TILE, "steel_light")
    c.hline(0, 9, TILE, "navy1")
    tiles.append(("hq_glass_rail", c, "overlay"))
    c = _overlay()
    c.rect(2, 2, 12, 1, "gold")
    c.rect(2, 3, 12, 1, "yellow")
    for x in range(3, 13):
        if x % 3:
            c.set(x, 2, "cream")
    tiles.append(("hq_ceiling_light", c, "overlay"))
    c = _overlay()
    for y in range(3, 13, 3):
        for x in range(3, 13, 3):
            c.set(x, y, "steel_dark")
    tiles.append(("hq_ceiling_vent", c, "overlay"))
    c = _panel_floor(mix("steel_dark", "navy1", 0.35), 94)
    c.rect(0, 5, TILE, 6, "ink")
    c.rect(0, 6, TILE, 4, "navy0")
    c.hline(0, 5, TILE, "steel_light")
    c.hline(0, 10, TILE, "steel_dark")
    c.set(4, 8, "cyan_dark")
    c.set(11, 8, "rust")
    tiles.append(("hq_floor_trench", c, "floor"))
    c = _panel_floor(mix("steel_dark", "navy1", 0.35), 95)
    c.rect(0, 6, 9, 4, "steel_dark")
    c.rect(2, 7, 5, 2, "gold")
    c.line(9, 8, 15, 8, "gold")
    c.line(13, 5, 15, 8, "gold")
    c.line(13, 11, 15, 8, "gold")
    tiles.append(("hq_nav_stripe", c, "floor"))

    # Row 7 — rug, wall overlays, pipes
    c = Canvas(TILE, TILE, mix("wine_vest_dark", "navy1", 0.35))
    for y in range(2, TILE, 3):
        for x in range(2, TILE, 6):
            c.set(x, y, "wine_vest")
    c.hline(0, 0, TILE, "gold")
    c.hline(0, 1, TILE, "wine_vest")
    tiles.append(("hq_rug_red_a", c, "floor"))
    c = c.clone()
    for x in range(TILE):
        c.set(x, 4, "gold")
        c.set(x, 11, "gold")
    c.rect(5, 5, 6, 6, mix("wine_vest", "rust", 0.3))
    c.line(7, 8, 9, 6, "cream")
    tiles.append(("hq_rug_red_b", c, "floor"))
    c = _overlay()
    c.hline(0, 0, TILE, "gold")
    c.hline(0, 1, TILE, "wine_vest")
    c.hline(0, 15, TILE, "gold")
    c.hline(0, 14, TILE, "wine_vest")
    tiles.append(("hq_rug_edge", c, "overlay"))
    c = _overlay()
    for y in range(7):
        d = 7 - y
        for x in range(TILE):
            if (x * 3 + y) % max(1, d) == 0:
                c.set(x, y, "navy0")
    tiles.append(("hq_wall_shadow", c, "overlay"))
    c = _wall_panel(103)
    c.ellipse(8, 7, 4.6, 4.6, "rust_dark")
    c.ellipse(8, 7, 3.6, 3.6, "rust")
    c.rect(7, 5, 2, 2, "rust_light")
    c.hline(3, 12, 10, "gold")
    c.hline(4, 13, 8, "cream")
    tiles.append(("hq_wall_seal", c, "wall"))
    c = _wall_panel(104)
    c.rect(2, 2, 12, 12, "navy0")
    c.frame(2, 2, 12, 12, "steel_dark")
    c.ellipse(8, 8, 3, 3, "rust")
    c.hline(5, 8, 6, "rust_light")
    c.set(12, 4, "cyan")
    c.set(4, 12, "gold")
    tiles.append(("hq_wall_poster", c, "wall"))
    c = _wall_panel(105)
    c.vline(3, 0, TILE, "steel")
    c.vline(4, 0, TILE, "steel_dark")
    c.vline(12, 0, TILE, "steel_light")
    c.vline(13, 0, TILE, "steel_dark")
    c.hline(3, 5, 2, "steel")
    c.hline(12, 10, 2, "steel")
    tiles.append(("hq_wall_pipe", c, "wall"))
    c = _panel_floor(mix("steel_dark", "navy1", 0.35), 106)
    c.rect(3, 3, 10, 10, "navy1")
    c.frame(3, 3, 10, 10, "gold")
    c.line(5, 8, 8, 5, "gold")
    c.line(8, 5, 11, 8, "gold")
    c.line(8, 5, 8, 11, "gold")
    tiles.append(("hq_floor_dec_arrow", c, "floor"))
    return tiles


def build_hq_atlas(out_root: Path) -> tuple[Canvas, dict]:
    tiles = hq_tiles()
    assert len(tiles) == 64, f"expected 64 HQ tiles, got {len(tiles)}"
    atlas = Canvas(TILE * 8, TILE * 8)
    meta_tiles = []
    for i, (tile_id, image, kind) in enumerate(tiles):
        col, row = i % 8, i // 8
        atlas.blit(image, col * TILE, row * TILE)
        meta_tiles.append(
            {
                "index": i,
                "id": tile_id,
                "col": col,
                "row": row,
                "kind": kind,
                "subject": "fictional NASA headquarters",
            }
        )
    meta = {
        "image": "hq_tiles.png",
        "tileWidth": TILE,
        "tileHeight": TILE,
        "columns": 8,
        "rows": 8,
        "tiles": meta_tiles,
        "note": "Original fictional mission-control environment. No NASA building is reconstructed.",
    }
    out = out_root / "tiles"
    out.mkdir(parents=True, exist_ok=True)
    atlas.save(out / "hq_tiles.png")
    (out / "hq_tiles.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return atlas, meta
