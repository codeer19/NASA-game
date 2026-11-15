"""Mars terrain tileset: 16×16 authored tiles, 8×8 atlas."""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

from pixel import Canvas, darken, lighten, mix

TILE = 16
SAND = "sand"
SAND_LIGHT = "sand_light"
SAND_DARK = "sand_dark"
REGOLITH = mix("sand_dark", "mauve_shadow", 0.24)
DUST_DARK = mix("rust_dark", "basalt", 0.22)
RUST_ROCK = "rust"
BASALT = "basalt"
BASALT_DARK = "basalt_dark"
BASALT_LIGHT = "basalt_light"


def _base(seed: int, base, n: int = 20) -> tuple[Canvas, random.Random]:
    rng = random.Random(seed)
    c = Canvas(TILE, TILE, base)
    return c, rng


def _speckles(c: Canvas, rng: random.Random, colors, count: int) -> None:
    for _ in range(count):
        c.set(rng.randrange(TILE), rng.randrange(TILE), rng.choice(colors))


def _wind_lines(c: Canvas, seed: int, strengthen: bool = False) -> None:
    rng = random.Random(seed)
    for y in (3, 8, 13):
        start = rng.randrange(0, 5)
        length = rng.randrange(9, 15)
        for x in range(start, min(TILE, start + length)):
            c.set(x, y, SAND_LIGHT if strengthen else mix(SAND_LIGHT, SAND, 0.35))
        for x in range(start + 1, min(TILE, start + length - 1)):
            if x % 3:
                c.set(x, y + 1, mix(SAND_DARK, SAND, 0.35))
        # broken crests avoid a stripe pattern
        if start + length < TILE:
            c.set(start + length, y + 1, SAND_LIGHT)


def _sand(seed: int, variant: int) -> Canvas:
    if variant == 5:
        base = mix(SAND, SAND_LIGHT, 0.22)
    elif variant == 6:
        base = mix(SAND, SAND_DARK, 0.26)
    else:
        base = mix(SAND, SAND_LIGHT, 0.04 * (variant % 3))
    c, rng = _base(seed, base, 20)
    if variant in (4, 5):
        _wind_lines(c, seed, strengthen=variant == 5)
    elif variant == 6:
        for y in range(0, TILE, 2):
            for x in range(TILE):
                if (x * 2 + y) % 7 == 0:
                    c.set(x, y, mix(base, "beige", 0.35))
    _speckles(c, rng, (mix(base, "beige", 0.45), mix(base, "ink", 0.25), SAND_DARK), 16)
    if variant == 7:
        for _ in range(7):
            x, y = rng.randrange(1, 14), rng.randrange(1, 14)
            c.set(x, y, "basalt_light")
            c.set(x + 1, y, "basalt")
            c.set(x + 1, y + 1, "basalt_dark")
    c.hline(0, 0, TILE, mix(base, SAND_LIGHT, 0.12))
    c.hline(0, 15, TILE, mix(base, SAND_DARK, 0.12))
    return c


def _regolith(seed: int, variant: int) -> Canvas:
    base = mix(REGOLITH, SAND_DARK, 0.08 * variant)
    c, rng = _base(seed, base, 18)
    _speckles(c, rng, (mix(base, "beige", 0.35), mix(base, "ink", 0.35), "mauve_shadow"), 26)
    if variant in (0, 2):
        for _ in range(5):
            x, y = rng.randrange(0, 15), rng.randrange(0, 15)
            c.rect(x, y, 2, 1, "basalt")
            c.set(x, y, "basalt_light")
    if variant == 2:
        # small wind-scoured hollow
        c.ellipse(9, 9, 4, 2.5, mix(base, "ink", 0.22))
        c.ellipse(9, 8, 3, 1.5, base)
        c.set(7, 8, SAND_DARK)
    return c


def _basalt(seed: int, variant: int) -> Canvas:
    base = mix(BASALT, BASALT_LIGHT, 0.04 * variant)
    c, rng = _base(seed, base, 18)
    # coarse rock planes
    for y in range(0, TILE, 5):
        if rng.random() < 0.8:
            c.hline(rng.randrange(0, 4), y + rng.randrange(0, 2), rng.randrange(7, 16), mix(BASALT_LIGHT, base, 0.32))
    _speckles(c, rng, (BASALT_DARK, BASALT_LIGHT, mix("rust_dark", BASALT, 0.35)), 22)
    if variant in (2, 5):
        # fracture
        x = rng.randrange(3, 9)
        for i in range(6):
            c.set(x + (i // 2), 9 - i, "basalt_dark")
            c.set(x + (i // 2) + 1, 9 - i, mix(base, "beige", 0.12))
    if variant == 6:
        c.rect(2, 4, 5, 1, BASALT_DARK)
        c.rect(9, 10, 4, 1, BASALT_DARK)
    return c


def _edge(direction: str, kind: str) -> Canvas:
    base = SAND if kind == "sand" else REGOLITH
    other = BASALT if kind == "sand" else SAND_DARK
    stable_seed = {"n": 1, "e": 2, "s": 3, "w": 4}[direction] + (10 if kind == "sand" else 20)
    c, rng = _base(stable_seed, base, 18)
    # ragged 5–8 px band on requested side
    depth = 6
    for i in range(16):
        w = depth + rng.choice((-2, -1, 0, 0, 1, 2))
        for d in range(max(0, min(16, w))):
            if direction == "n":
                x, y = i, d
            elif direction == "s":
                x, y = i, 15 - d
            elif direction == "w":
                x, y = d, i
            else:
                x, y = 15 - d, i
            c.set(x, y, other)
            if d == max(0, min(16, w)) - 1:
                c.set(x, y, mix(other, base, 0.40))
    _speckles(c, rng, (SAND_LIGHT if kind == "sand" else BASALT_LIGHT, SAND_DARK), 10)
    # dither transition
    for i in range(16):
        for d in range(8, 11):
            if (i * 3 + d) % 4 == 0:
                if direction == "n":
                    x, y = i, d
                elif direction == "s":
                    x, y = i, 15 - d
                elif direction == "w":
                    x, y = d, i
                else:
                    x, y = 15 - d, i
                c.set(x, y, other)
    return c


def _crater_canvas() -> Canvas:
    c = Canvas(48, 48)
    # fill with sand
    base = mix(SAND, SAND_LIGHT, 0.10)
    for y in range(48):
        for x in range(48):
            if (x * 3 + y * 5) % 17 == 0:
                c.set(x, y, mix(base, "beige", 0.4))
            else:
                c.set(x, y, base)
    # ejecta crown
    c.ellipse(24, 25, 22, 20, mix(SAND_LIGHT, base, 0.30))
    c.ellipse(24, 25, 20, 18, mix(base, SAND, 0.5))
    # outer rim
    c.ellipse(24, 25, 17, 14, "rust_dark")
    c.ellipse(24, 24, 16, 13, "rust")
    c.ellipse(24, 24, 14, 11, "rust_light")
    # interior
    c.ellipse(24, 25, 13, 10, "rust_dark")
    c.ellipse(24, 26, 11, 8, "rust_deep")
    c.ellipse(25, 27, 9, 6, mix("rust_deep", "basalt", 0.35))
    # inner shadow crescent on upper-left, lit lower-right wall
    for i in range(80):
        a = math.radians(-160 + i * 1.6)
        x = round(24 + math.cos(a) * 12)
        y = round(25 + math.sin(a) * 9)
        c.set(x, y, mix("rust_deep", "ink", 0.35))
        c.set(x, y + 1, mix("rust_dark", "mauve_shadow", 0.25))
    for i in range(60):
        a = math.radians(15 + i * 1.5)
        x = round(24 + math.cos(a) * 15)
        y = round(24 + math.sin(a) * 12)
        c.set(x, y, "rust_light")
        c.set(x - 1, y, mix("rust_light", "rust", 0.35))
    # floor streaks and rocks
    rng = random.Random(707)
    for _ in range(18):
        x, y = rng.randrange(18, 31), rng.randrange(23, 32)
        c.set(x, y, mix("rust_deep", "beige", 0.28))
    for _ in range(9):
        x, y = rng.randrange(9, 40), rng.randrange(8, 42)
        c.set(x, y, "basalt_light")
        c.set(x + 1, y, "basalt_dark")
    return c


def mars_tiles() -> list[tuple[str, Canvas, str]]:
    tiles: list[tuple[str, Canvas, str]] = []
    # Row 0 — sand family
    names0 = (
        "mars_sand_a",
        "mars_sand_b",
        "mars_sand_c",
        "mars_sand_d",
        "mars_sand_ripple_a",
        "mars_sand_ripple_b",
        "mars_sand_coarse",
        "mars_sand_pebbles",
    )
    for i, name in enumerate(names0):
        tiles.append((name, _sand(100 + i, i), "floor"))

    # Row 1 — regolith and wind scours
    names1 = (
        "mars_regolith_a",
        "mars_regolith_b",
        "mars_regolith_c",
        "mars_dust_dark",
        "mars_dust_rust",
        "mars_gravel_a",
        "mars_gravel_b",
        "mars_wind_patch",
    )
    for i, name in enumerate(names1[:3]):
        tiles.append((name, _regolith(120 + i, i), "floor"))
    for i, name in ((3, "mars_dust_dark"), (4, "mars_dust_rust")):
        base = mix(DUST_DARK, "sand_dark", 0.22 if i == 3 else 0.38)
        c, rng = _base(130 + i, base, 16)
        _wind_lines(c, 130 + i)
        _speckles(c, rng, (mix(base, "beige", 0.20), "basalt_dark", "rust_dark"), 16)
        tiles.append((name, c, "floor"))
    for i, name in ((5, "mars_gravel_a"), (6, "mars_gravel_b")):
        base = mix(REGOLITH, SAND_DARK, 0.25)
        c, rng = _base(140 + i, base, 16)
        for _ in range(22):
            x, y = rng.randrange(0, 15), rng.randrange(0, 15)
            c.rect(x, y, 2, 1, rng.choice(("basalt", "basalt_light", "sand_dark")))
            c.set(x, y, rng.choice(("beige", "basalt_light")))
        tiles.append((name, c, "floor"))
    c, rng = _base(147, mix(SAND, SAND_DARK, 0.25), 16)
    _wind_lines(c, 147, strengthen=True)
    c.ellipse(5, 6, 3, 2, mix(SAND_DARK, "rust_dark", 0.25))
    c.ellipse(5, 5, 2, 1, mix(SAND, SAND_DARK, 0.30))
    _speckles(c, rng, (SAND_LIGHT, "basalt"), 8)
    tiles.append(("mars_wind_patch", c, "floor"))

    # Row 2 — basalt and dune forms
    names2 = (
        "mars_basalt_a",
        "mars_basalt_b",
        "mars_basalt_fracture",
        "mars_basalt_gravel",
        "mars_rock_shelf",
        "mars_rock_shelf_cracked",
        "mars_dune_shadow",
        "mars_dune_crest",
    )
    for i, name in enumerate(names2[:3]):
        tiles.append((name, _basalt(160 + i, i), "floor"))
    c, rng = _base(163, mix(BASALT, BASALT_LIGHT, 0.12), 18)
    _speckles(c, rng, (REGOLITH, "rust_dark", BASALT_LIGHT), 30)
    tiles.append(("mars_basalt_gravel", c, "floor"))
    c, rng = _base(164, mix(BASALT, RUST_ROCK, 0.18), 18)
    for x in range(0, 16, 4):
        c.line(x, 2, x + 3, 13, "basalt_dark")
        c.line(x + 1, 2, x + 4, 13, "basalt_light")
    tiles.append(("mars_rock_shelf", c, "floor"))
    c = c.clone()
    c.line(2, 5, 9, 3, "basalt_dark")
    c.line(7, 11, 13, 12, "basalt_dark")
    c.set(4, 8, "rust_dark")
    tiles.append(("mars_rock_shelf_cracked", c, "floor"))
    c, rng = _base(166, mix(SAND_DARK, "mauve_shadow", 0.22), 16)
    _wind_lines(c, 166, strengthen=True)
    _speckles(c, rng, (mix(SAND_DARK, "ink", 0.28), SAND), 12)
    tiles.append(("mars_dune_shadow", c, "floor"))
    c, rng = _base(167, mix(SAND_LIGHT, SAND, 0.30), 16)
    for y in (3, 5, 11, 13):
        c.hline(0, y, 16, mix(SAND_LIGHT, "white", 0.18))
        c.hline(0, y + 1, 16, mix(SAND_DARK, SAND, 0.20))
    tiles.append(("mars_dune_crest", c, "floor"))

    # Row 3 — transitions
    for i, d in enumerate(("mars_transition_sand_n", "mars_transition_sand_e", "mars_transition_sand_s", "mars_transition_sand_w")):
        direction = ("n", "e", "s", "w")[i]
        tiles.append((d, _edge(direction, "sand"), "floor"))
    for i, d in enumerate(("mars_transition_dust_n", "mars_transition_dust_e", "mars_transition_dust_s", "mars_transition_dust_w")):
        direction = ("n", "e", "s", "w")[i]
        tiles.append((d, _edge(direction, "dust"), "floor"))

    # Row 4 — a 3×3 authored crater. It is composed from one deterministic canvas,
    # so the nine tiles align pixel-perfectly.
    crater = _crater_canvas()
    crater_names = (
        ("mars_crater_nw", 0, 0),
        ("mars_crater_n", 1, 0),
        ("mars_crater_ne", 2, 0),
        ("mars_crater_w", 0, 1),
        ("mars_crater_center", 1, 1),
        ("mars_crater_e", 2, 1),
        ("mars_crater_sw", 0, 2),
        ("mars_crater_s", 1, 2),
        ("mars_crater_se", 2, 2),
    )
    for name, col, row in crater_names:
        crop = Canvas(16, 16)
        for y in range(16):
            for x in range(16):
                crop.set(x, y, crater.get(col * 16 + x, row * 16 + y))
        tiles.append((name, crop, "floor"))

    # Row 5 — terrain overlays
    def overlay() -> Canvas:
        return Canvas(TILE, TILE)

    c = overlay()
    for y in (3, 9, 14):
        for x in range(16):
            if x % 7 not in (3, 4):
                c.set(x, y, mix(SAND_LIGHT, "white", 0.18))
            if x % 5 == 0:
                c.set(x, y + 1, mix(SAND_DARK, "ink", 0.10))
    tiles.append(("mars_wind_h", c, "overlay"))
    c = overlay()
    for x in (4, 11):
        for y in range(16):
            if y % 6 not in (2, 3):
                c.set(x, y, mix(SAND_LIGHT, "white", 0.12))
        c.set(x + 1, 8, mix(SAND_DARK, "ink", 0.12))
    tiles.append(("mars_wind_v", c, "overlay"))
    rng = random.Random(301)
    c = overlay()
    for _ in range(12):
        x, y = rng.randrange(1, 15), rng.randrange(1, 15)
        c.set(x, y, "basalt_light")
        c.set(x + 1, y, "basalt_dark")
        if rng.random() > 0.5:
            c.set(x, y + 1, "sand_dark")
    tiles.append(("mars_pebbles", c, "overlay"))
    c = overlay()
    c.line(2, 13, 7, 8, "rust_dark")
    c.line(7, 8, 11, 10, "rust_dark")
    c.line(11, 10, 14, 4, "rust_dark")
    c.set(9, 6, "rust_light")
    tiles.append(("mars_cracks", c, "overlay"))
    c = overlay()
    for y in (4, 11):
        for x in range(3, 14, 3):
            c.rect(x, y, 2, 1, mix("rust_deep", "sand_dark", 0.30))
            c.set(x + 1, y + 1, mix("rust_deep", "ink", 0.30))
    tiles.append(("mars_track_h", c, "overlay"))
    c = overlay()
    for x in (4, 11):
        for y in range(3, 14, 3):
            c.rect(x, y, 1, 2, mix("rust_deep", "sand_dark", 0.30))
            c.set(x + 1, y + 1, mix("rust_deep", "ink", 0.30))
    tiles.append(("mars_track_v", c, "overlay"))
    c = overlay()
    for i in range(64):
        a = i / 64 * math.tau
        x = round(8 + math.cos(a) * 6)
        y = round(8 + math.sin(a) * 6)
        if i % 2:
            c.set(x, y, "cyan")
        else:
            c.set(x, y, "teal_dark")
    c.rect(7, 1, 2, 1, "cyan_light")
    c.rect(7, 14, 2, 1, "cyan_light")
    c.rect(1, 7, 1, 2, "cyan_light")
    c.rect(14, 7, 1, 2, "cyan_light")
    tiles.append(("mars_scan_patch", c, "overlay"))
    c = overlay()
    haze_rng = random.Random(352)
    for _ in range(26):
        x, y = haze_rng.randrange(16), haze_rng.randrange(16)
        c.set(x, y, mix(SAND_LIGHT, "white", 0.35))
    tiles.append(("mars_dust_haze", c, "overlay"))

    # Row 6 — compacted routes and landing zone
    names6 = (
        "mars_compacted_a",
        "mars_compacted_b",
        "mars_path_h",
        "mars_path_v",
        "mars_landing_pad_center",
        "mars_landing_pad_edge",
        "mars_rover_park",
        "mars_sample_ground",
    )
    for i, name in enumerate(names6[:2]):
        c, rng = _base(320 + i, mix(SAND_DARK, SAND, 0.24), 16)
        _speckles(c, rng, ("rust_dark", "sand_light"), 18)
        tiles.append((name, c, "floor"))
    c, rng = _base(322, mix(SAND_DARK, SAND, 0.18), 16)
    for y in (3, 12):
        c.hline(0, y, 16, mix("rust_deep", "sand_dark", 0.25))
        c.hline(0, y + 1, 16, mix(SAND, SAND_LIGHT, 0.28))
    tiles.append(("mars_path_h", c, "floor"))
    c, rng = _base(323, mix(SAND_DARK, SAND, 0.18), 16)
    for x in (3, 12):
        c.vline(x, 0, 16, mix("rust_deep", "sand_dark", 0.25))
        c.vline(x + 1, 0, 16, mix(SAND, SAND_LIGHT, 0.28))
    tiles.append(("mars_path_v", c, "floor"))
    c, rng = _base(324, mix(SAND, SAND_DARK, 0.30), 16)
    c.ellipse(8, 8, 5, 5, mix("steel_dark", "sand_dark", 0.50))
    c.ellipse(8, 8, 3, 3, "navy1")
    c.rect(7, 3, 2, 1, "cyan_dark")
    c.rect(7, 12, 2, 1, "cyan_dark")
    c.rect(3, 7, 1, 2, "cyan_dark")
    c.rect(12, 7, 1, 2, "cyan_dark")
    tiles.append(("mars_landing_pad_center", c, "floor"))
    c, rng = _base(325, mix(SAND, SAND_DARK, 0.30), 16)
    c.line(0, 4, 15, 4, "steel_dark")
    c.line(0, 11, 15, 11, "steel_dark")
    c.rect(7, 2, 2, 1, "gold")
    tiles.append(("mars_landing_pad_edge", c, "floor"))
    c, rng = _base(326, mix(SAND_DARK, SAND, 0.20), 16)
    for x in range(4, 12, 3):
        c.rect(x, 8, 1, 5, mix("rust_deep", "ink", 0.25))
    c.rect(2, 7, 10, 1, mix("rust_deep", "ink", 0.18))
    tiles.append(("mars_rover_park", c, "floor"))
    c, rng = _base(327, mix(SAND, "beige", 0.16), 16)
    c.ellipse(8, 9, 4, 2, mix(SAND_DARK, "rust_dark", 0.25))
    c.set(7, 8, "cyan")
    c.set(8, 8, "cyan_light")
    c.set(9, 8, "cyan")
    tiles.append(("mars_sample_ground", c, "floor"))

    # Row 7 — varied ground and dune features
    c, rng = _base(330, mix(SAND, "beige", 0.22), 16)
    _wind_lines(c, 330)
    _speckles(c, rng, ("sand_light", "beige", "sand_dark"), 15)
    tiles.append(("mars_sand_bright", c, "floor"))
    c, rng = _base(331, mix(SAND, "mauve_shadow", 0.18), 16)
    _speckles(c, rng, ("rust_dark", "sand_dark", "basalt"), 18)
    tiles.append(("mars_sand_shadow", c, "floor"))
    c, rng = _base(332, mix(BASALT, RUST_ROCK, 0.16), 16)
    for _ in range(16):
        x, y = rng.randrange(0, 15), rng.randrange(0, 15)
        c.rect(x, y, 2, 1, "basalt_light")
        c.set(x, y, "rust")
        c.set(x + 1, y + 1, "basalt_dark")
    tiles.append(("mars_basalt_rubble", c, "floor"))
    c, rng = _base(333, mix(BASALT, SAND_DARK, 0.18), 16)
    _speckles(c, rng, ("basalt_dark", "basalt_light", "rust_dark"), 26)
    tiles.append(("mars_gravel_dark", c, "floor"))
    c, rng = _base(334, mix(SAND_DARK, "rust_dark", 0.18), 16)
    for y in (4, 5, 12):
        c.hline(0, y, 16, "sand_light")
        for x in range(16):
            if (x + y) % 4:
                c.set(x, y + 1, "sand_dark")
    tiles.append(("mars_dune_ridge_h", c, "floor"))
    c = c.clone().flip_h()
    tiles.append(("mars_dune_ridge_v", c, "floor"))
    c = overlay()
    for y in range(0, 16, 3):
        for x in range(0, 16, 5):
            if (x + y) % 7 == 0:
                c.set(x, y, "beige")
    tiles.append(("mars_dust_edge", c, "overlay"))
    assert len(tiles) == 64, f"expected 64 Mars tiles, got {len(tiles)}"
    return tiles


def build_mars_atlas(out_root: Path) -> tuple[Canvas, dict]:
    tiles = mars_tiles()
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
                "scienceNote": "gameplay terrain, not a georeferenced Mars dataset",
            }
        )
    meta = {
        "image": "mars_tiles.png",
        "tileWidth": TILE,
        "tileHeight": TILE,
        "columns": 8,
        "rows": 8,
        "tiles": meta_tiles,
        "craterFootprint": {
            "tiles": ["mars_crater_nw", "mars_crater_n", "mars_crater_ne", "mars_crater_w", "mars_crater_center", "mars_crater_e", "mars_crater_sw", "mars_crater_s", "mars_crater_se"],
            "size": [48, 48],
        },
        "note": "Original stylised terrain. Colors are inspired by Mars, not sampled from NASA imagery.",
    }
    out = out_root / "tiles"
    out.mkdir(parents=True, exist_ok=True)
    atlas.save(out / "mars_tiles.png")
    (out / "mars_tiles.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return atlas, meta
