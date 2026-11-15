"""Authored Mars surface props for RED FRONTIER.

Every object is original game art. The field habitat, relay and lander are
fictional MERIDIAN-program hardware, not NASA vehicles or instruments.
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

from pixel import Canvas, colored_external_outline, mix


def T(w: int, h: int) -> Canvas:
    return Canvas(w, h)


def _faceted_rock(w: int, h: int, seed: int, palette: tuple[str, str, str, str]) -> Canvas:
    """An angular boulder built from layered authored facets."""
    c = T(w, h)
    dark, mid, light, shadow = palette
    rng = random.Random(seed)
    # deliberately asymmetric silhouette, with a low broken base
    points = [
        (3, h - 5),
        (4, h - 12),
        (8, h - 17),
        (15, h - 19),
        (w - 12, h - 17),
        (w - 5, h - 11),
        (w - 3, h - 5),
        (w - 10, h - 2),
        (11, h - 2),
    ]
    c.polygon(points, "ink_soft")
    c.polygon([(4, h - 6), (5, h - 13), (9, h - 17), (15, h - 18), (w - 13, h - 16), (w - 6, h - 10), (w - 4, h - 6), (w - 11, h - 3), (12, h - 3)], dark)
    # broad top-left plane
    c.polygon([(5, h - 13), (9, h - 17), (16, h - 18), (w - 14, h - 16), (w - 20, h - 11), (w // 2, h - 12), (8, h - 10)], mid)
    # sunlit crown
    c.polygon([(7, h - 14), (11, h - 17), (17, h - 18), (w - 16, h - 16), (w - 22, h - 13), (13, h - 14)], light)
    c.hline(10, h - 17, max(4, w - 28), mix(light, "beige", 0.32))
    # near face and blue-shadowed underside
    c.polygon([(8, h - 10), (w // 2, h - 12), (w - 6, h - 10), (w - 10, h - 5), (15, h - 5)], shadow)
    c.hline(11, h - 4, w - 23, mix(shadow, "ink", 0.22))
    c.set(w - 9, h - 9, "rust_light")
    c.set(w - 12, h - 8, "rust_dark")
    # angular cracks / facets
    c.line(12, h - 15, 17, h - 8, "basalt_dark")
    c.line(17, h - 8, 21, h - 6, "basalt_dark")
    c.line(w // 2 - 2, h - 17, w // 2 + 2, h - 11, "basalt_dark")
    c.set(w // 2 + 2, h - 11, "rust_deep")
    for _ in range(max(3, w // 12)):
        x = rng.randrange(6, w - 7)
        y = rng.randrange(h - 18, h - 8)
        if c.get(x, y)[3]:
            c.set(x, y, rng.choice(("rust_light", "gold", "beige")))
    return colored_external_outline(c, 0.66)


def rock_a() -> Canvas:
    return _faceted_rock(28, 20, 11, ("rust_dark", "rust", "rust_light", "mauve_shadow"))


def rock_b() -> Canvas:
    return _faceted_rock(44, 28, 18, ("basalt_dark", "rust_dark", "rust", "mauve_shadow"))


def rock_cluster() -> Canvas:
    c = T(68, 42)
    # rear small stones read first, main boulder last
    c.blit(_faceted_rock(30, 20, 21, ("basalt_dark", "basalt", "basalt_light", "mauve_shadow")), 3, 18)
    c.blit(_faceted_rock(24, 16, 22, ("rust_dark", "rust", "rust_light", "mauve_shadow")), 42, 22)
    c.blit(_faceted_rock(44, 28, 23, ("rust_dark", "rust", "rust_light", "mauve_shadow")), 15, 12)
    c.set(5, 31, "beige")
    c.set(61, 36, "gold")
    return colored_external_outline(c, 0.62)


def mesa() -> Canvas:
    """An asymmetric flat-topped butte complex: main table, west terrace, east spire."""
    c = T(128, 80)
    # ground shadow and a low, broken talus fan
    c.ellipse(64, 72, 52, 3, "mauve_shadow")
    c.polygon(
        [(12, 66), (24, 63), (38, 66), (52, 63), (66, 66), (80, 63),
         (94, 66), (108, 64), (120, 67), (122, 72), (108, 75), (88, 77),
         (64, 77), (42, 75), (24, 72), (14, 69)],
        "ink_soft",
    )
    c.polygon(
        [(18, 67), (30, 64), (44, 66), (58, 64), (72, 67), (86, 64),
         (100, 67), (114, 65), (117, 69), (104, 72), (86, 74), (64, 74),
         (44, 72), (28, 70)],
        "rust_dark",
    )
    c.hline(30, 68, 16, "rust")
    c.hline(56, 68, 14, mix("rust_dark", "rust", 0.40))
    c.hline(86, 68, 14, "rust")
    c.hline(42, 72, 18, mix("rust", "sand_dark", 0.28))
    c.hline(70, 72, 20, "rust_dark")
    # detached foot slabs
    c.polygon([(28, 66), (33, 62), (39, 64), (38, 69), (32, 71)], "ink_soft")
    c.polygon([(30, 66), (34, 63), (37, 65), (36, 68), (32, 69)], "rust_dark")
    c.set(33, 63, "rust_light")
    c.polygon([(104, 68), (109, 64), (114, 66), (113, 71), (107, 72)], "ink_soft")
    c.polygon([(106, 68), (110, 65), (112, 67), (111, 70), (107, 70)], "rust_dark")
    c.set(109, 65, "rust_light")

    # west terrace: a low, clearly stepped flat-top block
    c.polygon(
        [(2, 46), (6, 38), (14, 33), (28, 34), (36, 40), (38, 52),
         (34, 63), (21, 68), (8, 62), (3, 54)],
        "ink_soft",
    )
    c.polygon(
        [(5, 46), (8, 40), (15, 35), (27, 36), (33, 41), (35, 52),
         (31, 61), (21, 65), (10, 60), (5, 53)],
        "rust_dark",
    )
    # terrace cliff, sunlit from the west
    c.polygon(
        [(7, 48), (29, 46), (32, 53), (28, 61), (20, 64), (10, 59), (6, 54)],
        "rust",
    )
    c.polygon(
        [(9, 47), (21, 45), (26, 48), (25, 57), (20, 61), (13, 58), (9, 54)],
        "rust_light",
    )
    c.polygon([(27, 46), (31, 48), (30, 55), (26, 60), (23, 58)], "rust_deep")
    c.hline(12, 51, 12, mix("rust_light", "sand_light", 0.26))
    c.vline(18, 45, 14, "rust_deep")
    # terrace tabletop
    c.polygon(
        [(6, 36), (28, 36), (34, 44), (32, 50), (4, 50), (2, 43)],
        "ink_soft",
    )
    c.polygon(
        [(8, 39), (27, 39), (31, 44), (29, 47), (6, 47), (5, 43)],
        "sand_dark",
    )
    c.polygon(
        [(11, 41), (25, 41), (29, 44), (26, 45), (9, 45)],
        "sand",
    )
    c.hline(14, 42, 9, "sand_light")
    c.set(12, 44, "beige")
    c.line(20, 39, 19, 45, "rust_dark")
    c.set(31, 42, "rust_light")

    # east spire: a narrow, shadowed rock tower behind the main cliff
    c.polygon(
        [(99, 44), (102, 31), (108, 24), (114, 28), (117, 40), (118, 52),
         (114, 62), (106, 68), (100, 60), (98, 52)],
        "ink_soft",
    )
    c.polygon(
        [(102, 44), (104, 33), (109, 27), (112, 31), (114, 41), (115, 52),
         (111, 60), (106, 64), (102, 58), (100, 51)],
        "rust_dark",
    )
    c.polygon(
        [(103, 45), (106, 34), (109, 29), (111, 33), (112, 42), (112, 53),
         (108, 59), (104, 56), (102, 50)],
        "rust",
    )
    c.polygon(
        [(109, 31), (112, 34), (114, 43), (114, 52), (110, 59), (107, 58),
         (109, 50), (109, 39)],
        "rust_deep",
    )
    c.polygon(
        [(111, 37), (113, 41), (113, 49), (110, 55), (108, 52), (109, 44)],
        "mauve_shadow",
    )
    c.hline(104, 48, 5, "rust_light")
    c.vline(106, 36, 18, "rust_deep")
    # spire tabletop
    c.polygon(
        [(102, 26), (114, 26), (118, 35), (116, 42), (100, 42), (98, 34)],
        "ink_soft",
    )
    c.polygon(
        [(105, 29), (112, 29), (115, 35), (113, 39), (103, 39), (102, 34)],
        "sand_dark",
    )
    c.polygon(
        [(107, 31), (111, 31), (113, 35), (111, 37), (105, 37)],
        "sand",
    )
    c.hline(107, 32, 4, "sand_light")
    c.set(109, 35, "beige")

    # main cliff mass: flat top, near-vertical walls, no rounded shoulders
    c.polygon(
        [(30, 30), (38, 14), (44, 8), (86, 8), (94, 16), (100, 30),
         (103, 44), (102, 58), (98, 66), (88, 70), (42, 70), (34, 64),
         (28, 52), (26, 38)],
        "ink_soft",
    )
    c.polygon(
        [(32, 30), (40, 16), (46, 10), (85, 10), (92, 18), (98, 31),
         (101, 44), (100, 57), (96, 64), (87, 68), (43, 68), (36, 62),
         (30, 51), (28, 38)],
        "rust_dark",
    )
    # west wall, sunlit
    c.polygon(
        [(32, 32), (40, 18), (47, 12), (59, 11), (62, 11), (62, 65),
         (52, 68), (42, 63), (34, 54), (30, 42)],
        "rust",
    )
    c.polygon(
        [(35, 32), (42, 21), (48, 15), (56, 14), (59, 14), (59, 53),
         (51, 59), (43, 55), (37, 47), (33, 39)],
        "rust_light",
    )
    c.polygon(
        [(38, 33), (44, 24), (49, 18), (54, 17), (56, 17), (56, 42),
         (50, 47), (44, 43), (39, 38)],
        "sand_dark",
    )
    c.hline(34, 36, 15, mix("rust_light", "sand_light", 0.20))
    c.hline(34, 44, 16, mix("rust_light", "sand_light", 0.14))
    c.hline(35, 52, 14, "rust_dark")
    c.hline(37, 60, 12, mix("rust", "sand_dark", 0.25))
    c.vline(43, 21, 41, "rust_deep")
    c.vline(52, 17, 47, "rust_deep")
    # central cleft and shadowed east wall
    c.polygon(
        [(63, 10), (85, 10), (92, 18), (98, 31), (101, 44), (100, 57),
         (96, 64), (87, 68), (63, 68)],
        "rust_deep",
    )
    c.polygon(
        [(68, 12), (84, 13), (90, 20), (96, 32), (99, 44), (98, 55),
         (94, 62), (86, 65), (68, 65)],
        "mauve_shadow",
    )
    c.polygon(
        [(75, 14), (84, 16), (89, 23), (94, 34), (96, 45), (96, 55),
         (92, 61), (85, 63), (76, 61), (74, 51), (74, 33)],
        "basalt",
    )
    c.polygon(
        [(79, 18), (84, 20), (87, 27), (91, 37), (92, 47), (90, 55),
         (86, 58), (81, 55), (79, 45), (79, 30)],
        "basalt_light",
    )
    c.hline(68, 34, 17, mix("rust_deep", "mauve_shadow", 0.38))
    c.hline(72, 46, 15, mix("rust_deep", "mauve_shadow", 0.30))
    c.hline(76, 58, 12, mix("mauve_shadow", "ink_soft", 0.30))
    c.vline(84, 20, 38, "basalt_dark")
    c.vline(94, 32, 26, "mauve_shadow")
    c.polygon([(60, 11), (63, 11), (64, 65), (60, 64)], "rust_deep")
    c.vline(62, 16, 46, "mauve_shadow")
    c.set(61, 21, "rust_light")

    # summit plane: flat back edge, hard trapezoid, broad pale top
    c.polygon(
        [(40, 10), (90, 10), (100, 34), (30, 34)],
        "ink_soft",
    )
    c.polygon(
        [(44, 14), (87, 14), (95, 31), (35, 31)],
        "sand_dark",
    )
    c.polygon(
        [(48, 18), (84, 18), (90, 28), (40, 28)],
        "sand",
    )
    c.polygon(
        [(52, 21), (67, 21), (69, 26), (44, 26)],
        "sand_light",
    )
    c.polygon(
        [(71, 21), (81, 21), (86, 26), (72, 26)],
        "sand_dark",
    )
    # irregular sunlit rock patches, not window-like bands
    c.polygon([(48, 19), (59, 18), (65, 21), (58, 23), (47, 22)], "sand_light")
    c.polygon([(67, 19), (79, 19), (86, 23), (79, 25), (68, 24)], "beige")
    c.polygon([(55, 25), (69, 24), (76, 27), (66, 28), (54, 27)], "sand_light")
    c.polygon([(43, 25), (50, 24), (53, 26), (45, 27)], "beige")
    c.hline(50, 15, 16, "rust_dark")
    c.hline(72, 15, 14, "sand_dark")
    c.line(59, 16, 55, 29, "rust_dark")
    c.line(73, 16, 75, 27, "rust_dark")
    c.line(83, 17, 82, 27, "sand_dark")
    c.line(47, 25, 60, 22, "sand_dark")
    c.line(64, 23, 72, 26, "sand_dark")
    c.line(77, 23, 86, 21, "rust_dark")
    c.set(63, 20, "beige")
    c.set(78, 20, "beige")
    c.set(70, 25, "sand_light")
    c.set(84, 22, "beige")
    # a broken slab notch in the front lip
    c.polygon([(62, 34), (70, 34), (69, 37), (63, 37)], "rust_dark")
    c.set(65, 35, "sand_dark")
    # rim stones and the bright lip
    c.polygon([(54, 19), (58, 17), (59, 21), (55, 22)], "rust_dark")
    c.set(57, 17, "rust_light")
    c.polygon([(77, 18), (81, 16), (82, 20), (78, 21)], "rust_dark")
    c.set(80, 16, "rust_light")
    for x0, x1, col in ((32, 55, "beige"), (57, 68, "sand_light"), (71, 88, "beige"), (90, 98, "sand_light")):
        c.hline(x0, 34, x1 - x0, col)
        c.hline(x0, 35, x1 - x0, "sand_light" if col == "beige" else "beige")
    c.hline(32, 37, 58, "rust_deep")
    c.hline(72, 37, 26, "rust_deep")

    return colored_external_outline(c, 0.46)


def landing_pad() -> Canvas:
    """A ground decal: compacted dust ring, guidance marks and no baked shadow."""
    c = T(112, 72)
    cx, cy = 56, 36
    # scuffed compacted disc with a broken, dithered edge
    c.ellipse(cx, cy, 48, 28, "rust_dark")
    c.ellipse(cx, cy, 45, 25, "sand_dark")
    c.ellipse(cx, cy, 42, 22, "rust_dark")
    c.dither_rect(10, 14, 92, 44, "sand_dark", phase=2, density=3)
    # outer dashed ring
    for i in range(72):
        a = i / 72 * math.tau
        if i % 3:
            c.set(round(cx + math.cos(a) * 45), round(cy + math.sin(a) * 26), "steel_dark")
    # strong cardinal chevrons in warning gold
    for x0, y0, x1, y1, x2, y2 in (
        (56, 7, 50, 13, 62, 13),
        (56, 65, 50, 59, 62, 59),
        (7, 36, 13, 30, 13, 42),
        (105, 36, 99, 30, 99, 42),
    ):
        c.polygon([(x0, y0), (x1, y1), (x2, y2)], "gold")
        c.set(x0, y0, "yellow")
    # inner guidance ring and approach ticks
    for i in range(48):
        a = i / 48 * math.tau
        if i % 4 < 2:
            c.set(round(cx + math.cos(a) * 32), round(cy + math.sin(a) * 17), "sand_light")
    for dx in (-18, 18):
        c.hline(cx + dx, cy - 2, 6, "steel_dark")
        c.hline(cx + dx, cy + 2, 6, "steel_dark")
    c.rect(cx - 2, cy - 2, 4, 4, "sand_light")
    c.rect(cx - 1, cy - 1, 2, 2, "gold")
    # faint tyre scuffs leading south
    for y in range(50, 70, 4):
        c.set(cx - 30 + (y % 6), y, "rust_deep")
        c.set(cx - 26 + (y % 6), y + 1, "rust_deep")
        c.set(cx + 24 - (y % 5), y, "rust_deep")
        c.set(cx + 28 - (y % 5), y + 1, "rust_deep")
    return c


def sample_rock() -> Canvas:
    c = T(24, 20)
    c.polygon([(2, 16), (3, 9), (8, 4), (16, 3), (22, 7), (22, 14), (17, 18), (7, 18)], "ink_soft")
    c.polygon([(3, 15), (4, 9), (9, 5), (16, 4), (21, 8), (21, 13), (16, 17), (8, 17)], "basalt_dark")
    c.polygon([(5, 13), (6, 9), (10, 6), (16, 5), (19, 8), (17, 11), (9, 14)], "basalt")
    c.hline(9, 5, 6, "basalt_light")
    # mineral veins: the warm cue is the exposed sample, the cyan is scan-readable
    c.line(7, 13, 11, 10, "cyan_dark")
    c.line(11, 10, 15, 9, "cyan")
    c.set(13, 12, "cyan_light")
    c.set(9, 9, "cyan")
    c.line(16, 15, 20, 12, "gold")
    c.set(18, 12, "yellow")
    c.set(5, 16, "rust_dark")
    c.hline(3, 19, 15, "rust_dark")
    return colored_external_outline(c, 0.64)


def beacon() -> Canvas:
    c = T(20, 32)
    # tripod
    c.line(9, 17, 3, 30, "steel_dark")
    c.line(10, 17, 16, 30, "steel_dark")
    c.vline(9, 17, 13, "steel")
    c.hline(2, 30, 6, "ink_soft")
    c.hline(14, 30, 5, "ink_soft")
    # receiver box
    c.rect(5, 11, 10, 8, "ink_soft")
    c.rect(6, 11, 8, 7, "steel_dark")
    c.hline(6, 11, 8, "steel_light")
    c.rect(8, 13, 4, 2, "gold")
    c.set(9, 13, "yellow")
    c.rect(8, 16, 4, 1, "cyan_dark")
    # mast and hard-edged lamp
    c.vline(9, 3, 9, "steel_dark")
    c.vline(10, 3, 9, "steel")
    c.rect(8, 1, 5, 4, "ink_soft")
    c.rect(9, 1, 3, 3, "gold")
    c.set(10, 1, "yellow")
    c.set(9, 3, "orange")
    # warning pennant and small cable
    c.polygon([(13, 3), (17, 5), (13, 8)], "rust")
    c.set(13, 3, "rust_light")
    c.line(6, 18, 3, 23, "navy0")
    return c


def relay() -> Canvas:
    c = T(28, 40)
    # folded tripod
    c.line(13, 25, 4, 38, "ink_soft")
    c.line(14, 25, 24, 38, "ink_soft")
    c.line(13, 25, 14, 38, "ink_soft")
    c.line(13, 25, 5, 38, "steel_dark")
    c.line(14, 25, 23, 38, "steel")
    c.line(13, 25, 14, 37, "steel_dark")
    c.hline(3, 38, 6, "navy0")
    c.hline(21, 38, 5, "navy0")
    # equipment box
    c.rect(7, 20, 14, 8, "ink_soft")
    c.rect(8, 21, 12, 6, "rust_dark")
    c.hline(9, 21, 10, "rust")
    c.rect(10, 22, 3, 2, "gold")
    c.rect(15, 22, 3, 2, "cyan_dark")
    c.set(16, 22, "cyan")
    # mast and dish
    c.vline(13, 9, 12, "ink_soft")
    c.vline(14, 10, 10, "steel")
    c.ellipse(17, 9, 7, 5, "ink_soft")
    c.ellipse(17, 8, 6, 4, "steel_dark")
    c.ellipse(17, 8, 4, 3, "cream_dark")
    c.ellipse(17, 8, 2, 1, "cream")
    c.line(17, 8, 22, 3, "steel_dark")
    c.rect(22, 2, 2, 2, "gold")
    c.set(22, 2, "yellow")
    # survey sensor
    c.rect(5, 14, 3, 5, "navy0")
    c.frame(5, 14, 3, 5, "steel_dark")
    c.set(6, 16, "cyan")
    return colored_external_outline(c, 0.60)


def solar_array() -> Canvas:
    c = T(64, 34)
    # folded twin panels on a low turret
    for x, w in ((2, 28), (34, 28)):
        c.polygon([(x + 3, 8), (x + w - 3, 4), (x + w - 1, 9), (x + w - 5, 23), (x + 1, 23), (x, 11)], "ink_soft")
        c.polygon([(x + 4, 9), (x + w - 4, 5), (x + w - 2, 9), (x + w - 6, 21), (x + 2, 21), (x + 1, 11)], "navy0")
        # cell rows, alternating signal blue
        for row in range(4):
            yy = 10 + row * 3
            c.line(x + 5, yy - row, x + w - 6, yy - 4, "navy2")
            for k in range(4):
                xx = x + 8 + k * 5
                c.set(xx, yy - (k % 2), "cyan_dark" if (row + k) % 3 else "cyan")
        c.hline(x + 4, 21, 21, "steel_dark")
        c.set(x + 2, 10, "steel_light")
    # turret and hub
    c.rect(28, 20, 8, 8, "ink_soft")
    c.rect(29, 21, 6, 6, "steel_dark")
    c.hline(30, 21, 4, "steel_light")
    c.vline(31, 22, 3, "gold")
    c.rect(26, 26, 12, 4, "navy1")
    c.hline(27, 26, 10, "steel")
    c.hline(27, 29, 10, "ink_soft")
    c.set(32, 24, "cyan")
    # tie-down cables
    c.line(8, 23, 4, 32, "navy0")
    c.line(55, 23, 60, 32, "navy0")
    c.hline(2, 32, 6, "steel_dark")
    c.hline(58, 32, 5, "steel_dark")
    return colored_external_outline(c, 0.58)


def cargo_crate() -> Canvas:
    c = T(28, 22)
    c.rect(2, 5, 24, 15, "ink_soft")
    c.polygon([(4, 3), (25, 3), (27, 6), (24, 19), (3, 19), (1, 15), (1, 6)], "rust_dark")
    c.hline(5, 3, 19, "rust")
    c.polygon([(3, 6), (24, 6), (23, 17), (4, 17)], "rust")
    c.hline(4, 7, 19, "rust_light")
    c.rect(7, 9, 14, 7, "ink_soft")
    c.frame(7, 9, 14, 7, "steel_dark")
    c.hline(9, 10, 10, "gold")
    c.set(11, 9, "yellow")
    c.rect(5, 4, 3, 12, "steel_dark")
    c.rect(23, 4, 2, 12, "steel_dark")
    c.set(4, 18, "beige")
    c.set(25, 18, "cyan_dark")
    return colored_external_outline(c, 0.62)


def field_habitat() -> Canvas:
    c = T(96, 68)
    # ground pad and service skirt
    c.ellipse(48, 58, 40, 8, "mauve_shadow")
    c.polygon([(12, 49), (20, 56), (76, 56), (86, 49), (80, 62), (18, 62)], "ink_soft")
    c.polygon([(16, 51), (23, 57), (73, 57), (82, 51), (77, 59), (21, 59)], "rust_dark")
    # low supply deck
    c.rect(13, 46, 70, 6, "steel_dark")
    c.hline(15, 46, 66, "steel_light")
    for x in range(18, 80, 8):
        c.set(x, 49, "steel")
    # cylindrical module body
    c.polygon([(17, 28), (28, 19), (68, 19), (80, 28), (80, 45), (69, 51), (27, 51), (16, 45)], "ink_soft")
    c.polygon([(19, 29), (29, 21), (67, 21), (78, 29), (78, 43), (68, 49), (28, 49), (18, 43)], "lab_coat_outline")
    c.polygon([(21, 30), (30, 23), (66, 23), (76, 30), (76, 41), (66, 47), (30, 47), (20, 41)], "lab_coat_shadow")
    c.polygon([(23, 30), (31, 25), (65, 25), (74, 31), (74, 39), (64, 45), (32, 45), (22, 39)], "lab_coat")
    # roof ribs and solar strip
    for x in (31, 45, 59, 69):
        c.vline(x, 24, 21, "lab_coat_shadow")
        c.set(x, 23, "white")
    c.rect(37, 25, 22, 9, "navy0")
    c.frame(37, 25, 22, 9, "steel_dark")
    for x in range(39, 57, 5):
        for y in range(27, 33, 3):
            c.set(x, y, "cyan_dark")
            c.set(x + 1, y, "cyan")
    c.hline(41, 26, 14, "steel")
    # docking module and hatch
    c.rect(76, 32, 11, 15, "ink_soft")
    c.rect(77, 33, 9, 13, "steel_dark")
    c.ellipse(82, 39, 4, 5, "navy0")
    c.ellipse(82, 39, 3, 4, "teal_dark")
    c.ellipse(82, 39, 2, 3, "teal")
    c.set(81, 37, "teal_light")
    c.rect(78, 33, 7, 1, "steel_light")
    # entrance and handrails
    c.polygon([(33, 38), (40, 34), (52, 34), (60, 38), (60, 49), (52, 53), (40, 53), (33, 49)], "ink_soft")
    c.polygon([(35, 39), (41, 36), (51, 36), (58, 39), (58, 48), (51, 51), (41, 51), (35, 48)], "navy1")
    c.rect(39, 39, 15, 9, "navy0")
    c.frame(39, 39, 15, 9, "steel_dark")
    c.rect(42, 42, 9, 6, "teal_dark")
    c.rect(43, 43, 3, 3, "teal")
    c.set(44, 44, "cyan_light")
    # roof equipment
    c.rect(23, 13, 18, 7, "steel_dark")
    c.rect(24, 14, 16, 5, "navy2")
    c.hline(26, 16, 12, "gold")
    c.vline(68, 9, 12, "steel_dark")
    c.ellipse(72, 9, 6, 4, "ink_soft")
    c.ellipse(72, 8, 5, 3, "cream_dark")
    c.ellipse(72, 8, 3, 2, "cream")
    c.rect(70, 4, 3, 2, "gold")
    # side tanks, skids and service lights
    c.rect(14, 34, 5, 17, "steel_dark")
    c.rect(15, 35, 3, 15, "cream_dark")
    c.rect(79, 43, 5, 6, "gold")
    c.set(81, 44, "yellow")
    c.set(21, 33, "cyan")
    c.set(75, 47, "gold")
    c.hline(18, 57, 8, "steel")
    c.hline(70, 57, 8, "steel")
    return colored_external_outline(c, 0.54)


def lander() -> Canvas:
    c = T(80, 64)
    # four splayed legs, drawn first
    for sx, sy, ex, ey in ((25, 39, 9, 59), (55, 39, 71, 59), (19, 36, 13, 52), (61, 36, 67, 52)):
        c.line(sx, sy, ex, ey, "ink_soft")
        c.line(sx, sy, ex, ey - 1, "steel_dark")
        c.hline(ex - 3, ey, 7, "steel_dark")
        c.hline(ex - 2, ey, 4, "steel")
    # descent stage shadow
    c.polygon([(16, 31), (25, 21), (54, 21), (64, 31), (61, 44), (19, 44)], "ink_soft")
    # gold foil body
    c.polygon([(18, 30), (26, 22), (53, 22), (62, 30), (59, 42), (21, 42)], "rust_dark")
    c.polygon([(20, 30), (27, 24), (52, 24), (60, 31), (57, 40), (23, 40)], "gold")
    c.hline(23, 26, 30, "yellow")
    c.hline(25, 28, 20, "coin")
    for x, y in ((27, 32), (33, 35), (43, 31), (49, 36), (53, 29)):
        c.set(x, y, "rust_light")
        c.set(x + 1, y + 1, "rust_dark")
    # cream upper deck
    c.polygon([(27, 18), (52, 18), (59, 24), (52, 29), (27, 29), (20, 24)], "ink_soft")
    c.polygon([(28, 19), (51, 19), (57, 24), (51, 27), (28, 27), (22, 24)], "cream_dark")
    c.polygon([(30, 20), (49, 20), (54, 24), (49, 25), (30, 25), (25, 24)], "cream")
    c.hline(32, 20, 15, "white")
    c.rect(35, 22, 8, 3, "navy0")
    c.frame(35, 22, 8, 3, "steel_dark")
    c.set(37, 23, "cyan")
    c.rect(46, 22, 4, 2, "gold")
    # mast, dish and landing radar
    c.rect(34, 10, 3, 9, "steel_dark")
    c.rect(35, 10, 1, 8, "steel_light")
    c.rect(31, 7, 9, 5, "ink_soft")
    c.rect(32, 7, 7, 4, "steel_dark")
    c.rect(33, 8, 4, 2, "cream")
    c.set(34, 8, "cyan")
    c.vline(61, 7, 16, "steel_dark")
    c.ellipse(66, 7, 6, 4, "ink_soft")
    c.ellipse(66, 6, 5, 3, "cream_dark")
    c.ellipse(66, 6, 3, 2, "cream")
    c.rect(64, 3, 3, 2, "gold")
    c.set(62, 24, "gold")
    # engine bell hidden under body and underside status strips
    c.ellipse(40, 44, 5, 3, "navy0")
    c.ellipse(40, 44, 3, 2, "steel_dark")
    c.ellipse(40, 44, 1, 1, "ink")
    c.rect(27, 42, 4, 3, "steel_dark")
    c.set(28, 43, "cyan")
    c.rect(49, 42, 4, 3, "steel_dark")
    c.set(50, 43, "gold")
    # fictional ID bars, no words
    c.hline(33, 39, 13, "navy0")
    c.hline(34, 39, 4, "cream")
    c.set(40, 39, "gold")
    return colored_external_outline(c, 0.58)


def rover_marker() -> Canvas:
    c = T(24, 20)
    # A ground target that reads as a survey site, not a real map symbol
    c.ellipse(12, 14, 9, 4, "rust_deep")
    c.ellipse(12, 13, 8, 3, "sand_dark")
    c.polygon([(12, 2), (20, 10), (12, 18), (4, 10)], "ink_soft")
    c.polygon([(12, 3), (18, 10), (12, 16), (6, 10)], "cyan_dark")
    c.polygon([(12, 5), (16, 10), (12, 14), (8, 10)], "navy0")
    c.rect(11, 7, 2, 4, "cyan")
    c.set(11, 8, "cyan_light")
    c.set(12, 12, "gold")
    return c


MARS_PROPS = {
    "rock_a": rock_a,
    "rock_b": rock_b,
    "rock_cluster": rock_cluster,
    "mesa": mesa,
    "sample_rock": sample_rock,
    "beacon": beacon,
    "relay": relay,
    "solar_array": solar_array,
    "cargo_crate": cargo_crate,
    "field_habitat": field_habitat,
    "lander": lander,
    "landing_pad": landing_pad,
    "rover_marker": rover_marker,
}


def write_mars_props(out_root: Path) -> dict:
    folder = out_root / "props" / "mars"
    folder.mkdir(parents=True, exist_ok=True)
    items = []
    for prop_id, fn in MARS_PROPS.items():
        image = fn()
        image.save(folder / f"{prop_id}.png")
        items.append(
            {
                "id": prop_id,
                "file": f"props/mars/{prop_id}.png",
                "width": image.width,
                "height": image.height,
                "anchor": "center" if prop_id == "landing_pad" else "bottom-center",
                "originX": image.width / 2,
                "originY": image.height / 2 if prop_id == "landing_pad" else image.height,
                "groundDecal": prop_id == "landing_pad",
                "fictional": True,
                "scienceNote": "Stylised original terrain object; not a georeferenced Mars feature.",
            }
        )
    meta = {
        "environment": "Mars surface",
        "props": items,
        "note": "Original RED FRONTIER environment art. No NASA imagery or mission hardware is reproduced.",
    }
    (out_root / "props" / "mars" / "mars_props.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1] / "client" / "public" / "assets"
    data = write_mars_props(root)
    print(f"Wrote {len(data['props'])} Mars props to {root}")
