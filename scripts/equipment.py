"""Original rover assembly and 32x32 equipment icons for RED FRONTIER.

The rover is a fictional six-wheel field-science vehicle. Its silhouette and
instrument layout are authored for this game; it is not a reconstruction of a
NASA rover. Icon plates use the same chamfered interface language as the UI.
"""

from __future__ import annotations

import json
from pathlib import Path

from pixel import Canvas, colored_external_outline, mix

ROVER_W = 96
ROVER_H = 64
ICON = 32

DIRECTIONS = ("down", "left", "right", "up")


# ---------------------------------------------------------------------------
# Small drawing helpers
# ---------------------------------------------------------------------------


def _bevel(c: Canvas, x: int, y: int, w: int, h: int, light, dark) -> None:
    c.hline(x, y, w, light)
    c.vline(x, y, h, light)
    c.hline(x, y + h - 1, w, dark)
    c.vline(x + w - 1, y, h, dark)


def _chamfer_plate(c: Canvas, x: int, y: int, w: int, h: int, fill, edge, inner=None) -> None:
    c.polygon(
        [(x + 2, y), (x + w - 3, y), (x + w - 1, y + 2), (x + w - 1, y + h - 3), (x + w - 3, y + h - 1), (x + 2, y + h - 1), (x, y + h - 3), (x, y + 2)],
        edge,
    )
    c.polygon(
        [(x + 3, y + 1), (x + w - 4, y + 1), (x + w - 2, y + 3), (x + w - 2, y + h - 4), (x + w - 4, y + h - 2), (x + 3, y + h - 2), (x + 1, y + h - 4), (x + 1, y + 3)],
        inner or fill,
    )


def _wheel(c: Canvas, x: int, y: int, w: int = 9, h: int = 13, hub: str = "steel") -> None:
    """A chunky top-down wheel. Origin is the upper-left of its dark tyre."""
    c.rect(x + 2, y, w - 4, h, "ink_soft")
    c.rect(x + 1, y + 1, w - 2, h - 2, "ink_soft")
    c.rect(x, y + 3, w, h - 6, "basalt_dark")
    c.rect(x + 1, y + 2, w - 2, h - 4, "basalt")
    c.rect(x + 2, y + 1, w - 4, h - 2, "basalt_dark")
    c.hline(x + 2, y + 1, w - 4, "basalt_light")
    # tread blocks
    for yy in range(y + 3, y + h - 2, 3):
        c.hline(x + 1, yy, 2, "ink_soft")
        c.hline(x + w - 3, yy + 1, 2, "ink_soft")
    hx = x + w // 2 - 2
    hy = y + h // 2 - 2
    c.rect(hx, hy, 4, 4, "steel_dark")
    c.rect(hx + 1, hy + 1, 2, 2, hub)
    c.set(hx, hy, "steel_light")


def _dish(c: Canvas, cx: int, cy: int, rx: int = 10, ry: int = 6) -> None:
    # support and rim
    c.rect(cx - 1, cy + ry, 3, 7, "steel_dark")
    c.set(cx - 2, cy + ry + 6, "steel")
    c.ellipse(cx, cy, rx, ry, "ink_soft")
    c.ellipse(cx - 1, cy - 1, rx - 1, ry - 1, "steel_dark")
    c.ellipse(cx - 1, cy - 1, rx - 2, ry - 2, "cream_dark")
    c.ellipse(cx - 2, cy - 2, rx - 5, ry - 3, "cream")
    # feed arm and receiver
    c.line(cx, cy, cx + 2, cy - ry + 1, "steel")
    c.rect(cx + 1, cy - ry, 3, 3, "gold")
    c.set(cx + 2, cy - ry, "yellow")
    c.set(cx - rx + 2, cy - 2, "white")


def _mast(c: Canvas, x: int, y: int, facing: str = "down") -> None:
    """Camera mast with an original boxy sensor head."""
    c.rect(x + 5, y + 15, 3, 14, "steel_dark")
    c.vline(x + 5, y + 16, 12, "steel")
    c.set(x + 5, y + 25, "steel_light")
    c.rect(x + 2, y + 5, 12, 11, "ink_soft")
    c.rect(x + 3, y + 4, 10, 10, "steel_dark")
    c.rect(x + 4, y + 5, 8, 7, "cream_dark")
    c.hline(x + 4, y + 5, 8, "cream")
    c.hline(x + 4, y + 6, 6, "white")
    if facing == "up":
        c.rect(x + 6, y + 8, 4, 3, "steel_dark")
        c.set(x + 7, y + 8, "cyan_dark")
    else:
        c.rect(x + 6, y + 8, 4, 3, "navy0")
        c.rect(x + 7, y + 8, 2, 2, "cyan")
        c.set(x + 7, y + 8, "cyan_light")
    c.set(x + 10, y + 11, "gold")
    c.rect(x + 3, y + 14, 10, 2, "navy2")


def _arm(c: Canvas, facing: str = "down") -> None:
    if facing in ("down", "left", "right"):
        if facing == "down":
            # stowed forward arm, folded just above the bumper
            c.rect(42, 47, 4, 8, "steel_dark")
            c.rect(42, 47, 2, 8, "steel")
            c.rect(43, 54, 12, 3, "steel_dark")
            c.hline(44, 54, 9, "steel_light")
            c.rect(53, 51, 3, 7, "gold")
            c.rect(52, 57, 5, 3, "steel_dark")
            c.set(54, 58, "cyan")
            c.set(44, 48, "gold")
        else:
            # arm reaches out toward the facing edge
            sx = 20 if facing == "left" else 56
            ex = 8 if facing == "left" else 88
            c.rect(sx, 40, 3, 8, "steel_dark")
            c.rect(sx + 1, 40, 1, 7, "steel")
            c.rect(min(sx, ex), 44, abs(ex - sx), 3, "steel_dark")
            c.hline(min(sx, ex), 44, abs(ex - sx), "steel_light")
            c.rect(ex - (2 if facing == "left" else 0), 43, 3, 5, "gold")
            c.rect(ex - (4 if facing == "left" else 1), 42, 5, 2, "steel_dark")
            c.set(ex - (3 if facing == "left" else 0), 45, "cyan")


# ---------------------------------------------------------------------------
# Rover directional frames
# ---------------------------------------------------------------------------


def rover_down() -> Canvas:
    c = Canvas(ROVER_W, ROVER_H)
    # suspension links behind the wheels
    for y in (29, 40, 50):
        c.hline(23, y + 3, 9, "steel_dark")
        c.hline(64, y + 3, 9, "steel_dark")
        c.hline(24, y + 3, 7, "steel")
        c.hline(65, y + 3, 7, "steel")

    # six wheels
    for x, y in ((13, 23), (15, 34), (18, 46)):
        _wheel(c, x, y)
    for x, y in ((74, 23), (72, 34), (69, 46)):
        _wheel(c, x, y)

    # low chassis and undercarriage
    c.polygon([(25, 27), (71, 27), (76, 32), (75, 46), (68, 51), (28, 51), (20, 46), (19, 32)], "ink_soft")
    c.polygon([(27, 29), (69, 29), (73, 33), (72, 44), (66, 48), (30, 48), (23, 44), (22, 33)], "rust_dark")
    c.hline(30, 45, 36, "rust_deep")
    c.hline(31, 46, 34, "ink_soft")

    # main warm-white instrument deck
    c.polygon([(29, 22), (66, 22), (73, 27), (73, 40), (66, 44), (29, 44), (23, 40), (23, 27)], "ink_soft")
    c.polygon([(30, 23), (65, 23), (71, 28), (71, 39), (65, 42), (30, 42), (25, 39), (25, 28)], "cream_dark")
    c.polygon([(31, 24), (64, 24), (69, 29), (69, 37), (64, 40), (31, 40), (27, 37), (27, 29)], "cream")
    c.hline(32, 25, 32, "white")
    c.hline(29, 29, 3, "white")
    c.hline(30, 39, 3, "cream_dark")
    c.hline(63, 39, 5, "cream_dark")

    # deck details: radiator grille, instrument bay, hazard corners
    c.rect(33, 27, 13, 8, "navy1")
    c.frame(33, 27, 13, 8, "steel_dark")
    for y in (29, 32):
        for x in range(35, 45, 3):
            c.set(x, y, "steel")
    c.set(34, 28, "cyan_dark")
    c.rect(49, 26, 10, 7, "steel_dark")
    c.rect(50, 27, 8, 5, "navy2")
    c.rect(52, 28, 4, 3, "cyan_dark")
    c.set(53, 28, "cyan")
    c.hline(32, 37, 8, "steel_dark")
    c.hline(33, 37, 6, "steel_light")
    c.hline(61, 26, 5, "rust")
    c.hline(61, 27, 3, "rust_light")
    c.set(67, 28, "gold")
    c.set(68, 28, "yellow")
    c.set(30, 31, "gold")
    c.set(31, 31, "yellow")
    # front bumper and lamps
    c.polygon([(25, 42), (68, 42), (65, 48), (30, 48)], "rust_dark")
    c.hline(29, 43, 34, "rust")
    c.rect(30, 45, 4, 2, "gold")
    c.rect(32, 44, 2, 1, "yellow")
    c.rect(58, 45, 4, 2, "cyan_dark")
    c.set(59, 45, "cyan")

    # mast and high-gain dish rise above the deck
    _mast(c, 33, 2, "down")
    _dish(c, 68, 14, 10, 6)
    # low-gain whip
    c.vline(74, 4, 18, "steel_dark")
    c.set(74, 3, "gold")

    # arm and front sample tool
    _arm(c, "down")
    # side instrument pod
    c.rect(58, 34, 10, 6, "steel_dark")
    c.rect(59, 34, 8, 5, "teal_dark")
    c.rect(61, 35, 4, 3, "cyan_dark")
    c.set(62, 35, "cyan")
    c.set(63, 35, "cyan_light")
    c.set(59, 38, "gold")

    return colored_external_outline(c, 0.62)


def rover_up() -> Canvas:
    c = Canvas(ROVER_W, ROVER_H)
    for y in (29, 40, 50):
        c.hline(23, y + 3, 9, "steel_dark")
        c.hline(64, y + 3, 9, "steel_dark")
        c.hline(24, y + 3, 7, "steel")
        c.hline(65, y + 3, 7, "steel")
    for x, y in ((13, 23), (15, 34), (18, 46)):
        _wheel(c, x, y)
    for x, y in ((74, 23), (72, 34), (69, 46)):
        _wheel(c, x, y)

    c.polygon([(25, 27), (71, 27), (76, 32), (75, 46), (68, 51), (28, 51), (20, 46), (19, 32)], "ink_soft")
    c.polygon([(27, 29), (69, 29), (73, 33), (72, 44), (66, 48), (30, 48), (23, 44), (22, 33)], "rust_dark")
    c.polygon([(29, 22), (66, 22), (73, 27), (73, 40), (66, 44), (29, 44), (23, 40), (23, 27)], "ink_soft")
    c.polygon([(30, 23), (65, 23), (71, 28), (71, 39), (65, 42), (30, 42), (25, 39), (25, 28)], "cream_dark")
    c.polygon([(31, 24), (64, 24), (69, 29), (69, 37), (64, 40), (31, 40), (27, 37), (27, 29)], "cream")
    c.hline(32, 25, 31, "white")
    c.hline(28, 29, 3, "white")

    # rear deck: service hatch, power radiator and sample port
    c.rect(32, 27, 18, 10, "steel_dark")
    c.rect(33, 28, 16, 8, "navy2")
    for y in (29, 31, 33):
        c.hline(35, y, 12, "steel_dark")
        c.hline(35, y, 8, "steel")
    c.rect(55, 26, 10, 12, "steel_dark")
    c.rect(56, 27, 8, 10, "navy1")
    for y in (28, 30, 32, 34):
        c.hline(57, y, 6, "gold" if y % 4 == 0 else "steel_dark")
    c.set(64, 28, "cyan_dark")
    c.set(64, 35, "rust_light")
    c.rect(37, 39, 12, 3, "rust_dark")
    c.hline(38, 39, 10, "rust_light")
    c.rect(50, 39, 6, 2, "steel_dark")
    c.set(52, 39, "teal")

    # mast viewed from behind, with dish to the right
    _mast(c, 66, 2, "up")
    _dish(c, 36, 14, 10, 6)
    c.vline(20, 4, 18, "steel_dark")
    c.set(20, 3, "gold")
    # stowed arm is a slim mechanical shadow along the right edge
    c.rect(71, 33, 3, 10, "steel_dark")
    c.rect(71, 33, 1, 9, "steel")
    c.set(72, 42, "cyan")

    return colored_external_outline(c, 0.62)


def rover_left() -> Canvas:
    c = Canvas(ROVER_W, ROVER_H)
    # long suspension spine
    c.hline(17, 39, 64, "steel_dark")
    c.hline(18, 40, 60, "steel")
    # three large wheels with a hint of rear wheel
    _wheel(c, 66, 44, 12, 12)
    _wheel(c, 42, 46, 12, 13)
    _wheel(c, 18, 44, 12, 12)
    # a fourth wheel peeks above the chassis on the far side
    c.rect(26, 28, 9, 6, "ink_soft")
    c.rect(27, 29, 7, 4, "basalt")
    c.set(28, 29, "basalt_light")
    c.rect(56, 28, 9, 6, "ink_soft")
    c.rect(57, 29, 7, 4, "basalt")
    c.set(58, 29, "basalt_light")

    # low rust chassis
    c.polygon([(17, 26), (74, 26), (81, 31), (79, 44), (70, 49), (23, 49), (15, 43), (14, 33)], "ink_soft")
    c.polygon([(19, 28), (72, 28), (77, 32), (75, 42), (67, 46), (25, 46), (18, 41), (17, 33)], "rust_dark")
    c.hline(24, 44, 46, "rust_deep")

    # warm-white deck seen at an angle
    c.polygon([(22, 22), (70, 22), (79, 27), (78, 38), (68, 43), (26, 43), (18, 38), (18, 28)], "ink_soft")
    c.polygon([(23, 23), (69, 23), (77, 28), (76, 37), (67, 41), (27, 41), (20, 37), (20, 28)], "cream_dark")
    c.polygon([(24, 24), (67, 24), (75, 28), (74, 36), (66, 39), (28, 39), (22, 36), (22, 29)], "cream")
    c.hline(26, 25, 36, "white")
    c.hline(23, 29, 2, "white")

    # top deck instruments, oriented left
    c.rect(29, 27, 13, 9, "navy1")
    c.frame(29, 27, 13, 9, "steel_dark")
    for y in (29, 32):
        for x in range(31, 40, 3):
            c.set(x, y, "steel")
    c.rect(45, 26, 9, 8, "steel_dark")
    c.rect(46, 27, 7, 6, "navy2")
    c.rect(48, 28, 3, 3, "cyan_dark")
    c.set(49, 28, "cyan")
    c.hline(31, 38, 26, "steel_dark")
    c.hline(32, 38, 22, "steel_light")
    c.rect(61, 25, 8, 5, "rust")
    c.rect(62, 26, 6, 2, "rust_light")
    c.set(67, 29, "gold")
    c.set(25, 31, "gold")

    # side camera mast and dish
    _mast(c, 38, 2, "left")
    _dish(c, 68, 13, 9, 6)
    c.vline(77, 3, 16, "steel_dark")
    c.set(77, 2, "gold")

    # forward arm reaches left
    c.rect(16, 34, 3, 7, "steel_dark")
    c.rect(17, 34, 1, 6, "steel")
    c.hline(5, 38, 12, "steel_dark")
    c.hline(6, 38, 10, "steel_light")
    c.rect(2, 37, 4, 5, "gold")
    c.rect(1, 36, 3, 2, "steel_dark")
    c.set(2, 39, "cyan")
    # headlights on the leading edge
    c.rect(17, 29, 2, 3, "gold")
    c.set(17, 30, "yellow")
    # rear antenna
    c.set(81, 34, "rust_light")

    return colored_external_outline(c, 0.62)


def rover_right() -> Canvas:
    # Mirrored only at export, per the art bible's turning convention.
    return rover_left().flip_h()


# ---------------------------------------------------------------------------
# Equipment card icons
# ---------------------------------------------------------------------------


def _icon_plate() -> Canvas:
    c = Canvas(ICON, ICON)
    _chamfer_plate(c, 1, 1, 30, 30, "navy1", "ink", "navy1")
    c.hline(4, 2, 24, "steel_dark")
    c.vline(2, 4, 24, "steel_dark")
    c.hline(4, 29, 24, "ink")
    c.vline(29, 4, 24, "ink")
    c.polygon([(3, 3), (6, 3), (3, 6)], "steel_dark")
    c.set(27, 3, "gold")
    c.set(3, 27, "cyan_dark")
    return c


def icon_chassis() -> Canvas:
    c = _icon_plate()
    # axles
    c.hline(5, 17, 22, "steel_dark")
    c.hline(7, 16, 18, "steel")
    c.rect(7, 10, 18, 12, "ink_soft")
    c.polygon([(8, 9), (23, 9), (27, 13), (26, 21), (22, 24), (9, 24), (5, 20), (5, 13)], "rust_dark")
    c.polygon([(9, 10), (22, 10), (25, 14), (24, 19), (21, 22), (10, 22), (7, 19), (7, 14)], "rust")
    c.polygon([(10, 8), (22, 8), (26, 11), (26, 18), (22, 21), (10, 21), (6, 18), (7, 11)], "cream_dark")
    c.polygon([(11, 9), (21, 9), (24, 12), (24, 17), (21, 19), (11, 19), (8, 17), (9, 12)], "cream")
    c.hline(12, 10, 8, "white")
    c.rect(13, 12, 6, 4, "navy1")
    c.set(14, 13, "cyan")
    c.set(21, 12, "gold")
    return c


def icon_drive() -> Canvas:
    c = _icon_plate()
    # one hero wheel with a second tucked behind
    c.ellipse(20, 19, 9, 10, "ink_soft")
    c.ellipse(19, 18, 8, 9, "basalt_dark")
    c.ellipse(19, 18, 6, 7, "basalt")
    c.ellipse(18, 17, 3, 4, "steel_dark")
    c.ellipse(18, 17, 2, 3, "steel")
    c.set(17, 16, "steel_light")
    for y in (11, 15, 19, 23):
        c.rect(11, y, 2, 2, "ink_soft")
        c.rect(25, y + 1, 2, 2, "ink_soft")
    c.ellipse(12, 12, 4, 5, "basalt_dark")
    c.ellipse(12, 12, 2, 3, "steel_dark")
    c.set(11, 11, "steel")
    c.hline(6, 8, 6, "cyan_dark")
    c.hline(7, 6, 3, "cyan")
    # motion ticks
    c.set(9, 25, "gold")
    c.set(6, 22, "gold")
    return c


def icon_suspension() -> Canvas:
    c = _icon_plate()
    # rocker-bogie triangle
    c.line(7, 24, 16, 9, "steel_dark")
    c.line(7, 24, 16, 9, "steel_light")
    c.line(16, 9, 25, 24, "steel_dark")
    c.line(15, 10, 24, 23, "steel")
    c.line(9, 22, 24, 22, "steel_dark")
    c.line(10, 21, 23, 21, "steel")
    c.ellipse(7, 24, 3, 3, "ink_soft")
    c.ellipse(7, 24, 2, 2, "gold")
    c.ellipse(16, 9, 3, 3, "ink_soft")
    c.ellipse(16, 9, 2, 2, "rust_light")
    c.ellipse(25, 24, 3, 3, "ink_soft")
    c.ellipse(25, 24, 2, 2, "gold")
    c.hline(13, 27, 7, "cyan_dark")
    c.set(12, 5, "steel_light")
    return c


def icon_power() -> Canvas:
    c = _icon_plate()
    # compact radioisotope-style generator with fins (fictional game unit)
    c.ellipse(16, 12, 7, 7, "ink_soft")
    c.ellipse(16, 11, 6, 6, "steel_dark")
    c.ellipse(15, 10, 4, 4, "cream_dark")
    c.ellipse(15, 9, 2, 2, "cream")
    c.rect(10, 14, 12, 7, "steel_dark")
    c.rect(11, 15, 10, 5, "navy1")
    for x in (6, 9, 22, 25):
        c.rect(x, 12, 2, 8, "steel_dark")
        c.rect(x, 13, 1, 5, "gold")
    c.rect(14, 22, 4, 4, "steel_dark")
    c.hline(13, 26, 6, "steel")
    c.line(15, 17, 17, 19, "yellow")
    c.line(17, 19, 15, 21, "yellow")
    c.set(16, 18, "cyan")
    return c


def icon_antenna() -> Canvas:
    c = _icon_plate()
    # dish, feed and clear signal arcs
    c.ellipse(14, 17, 8, 6, "ink_soft")
    c.ellipse(14, 16, 7, 5, "steel_dark")
    c.ellipse(14, 15, 6, 4, "cream_dark")
    c.ellipse(13, 14, 4, 2, "cream")
    c.line(14, 16, 17, 9, "steel_light")
    c.rect(17, 8, 3, 3, "gold")
    c.set(18, 8, "yellow")
    c.line(14, 20, 20, 27, "steel_dark")
    c.line(18, 23, 10, 27, "steel_dark")
    # authored dotted arcs toward the upper-right
    for x, y in ((22, 9), (24, 12), (25, 15), (23, 18), (21, 6), (24, 8), (26, 12), (27, 16)):
        c.set(x, y, "cyan" if (x + y) % 3 else "cyan_dark")
    c.set(6, 8, "cyan_light")
    return c


def icon_arm() -> Canvas:
    c = _icon_plate()
    # shoulder, elbow, wrist and drill
    c.rect(8, 7, 6, 6, "ink_soft")
    c.rect(9, 8, 4, 4, "gold")
    c.line(12, 11, 18, 17, "steel_dark")
    c.line(13, 11, 19, 17, "steel_light")
    c.rect(16, 16, 6, 5, "ink_soft")
    c.rect(17, 17, 4, 3, "steel_dark")
    c.rect(20, 20, 3, 4, "steel_dark")
    c.rect(19, 23, 5, 3, "steel")
    c.rect(20, 25, 3, 3, "gold")
    c.rect(21, 27, 1, 3, "cyan")
    c.set(9, 8, "gold")
    c.set(8, 21, "rust_light")
    c.hline(7, 24, 5, "cyan_dark")
    return c


def icon_spectrometer() -> Canvas:
    c = _icon_plate()
    # sensor block with a cyan analysis beam and broken return spectra
    c.rect(8, 8, 10, 10, "ink_soft")
    c.rect(9, 9, 8, 8, "steel_dark")
    c.rect(10, 10, 6, 4, "cream_dark")
    c.rect(11, 11, 4, 2, "cyan_dark")
    c.ellipse(17, 13, 3, 3, "gold")
    c.set(17, 12, "yellow")
    for i, (x, y) in enumerate(((21, 10), (24, 9), (22, 13), (26, 13), (23, 16), (25, 18))):
        c.set(x, y, "cyan" if i % 2 else "cyan_dark")
    c.line(15, 20, 9, 25, "steel_dark")
    c.line(21, 20, 25, 26, "steel_dark")
    c.hline(7, 27, 18, "steel_dark")
    c.set(8, 26, "rust_light")
    return c


def icon_weather() -> Canvas:
    c = _icon_plate()
    # mast, anemometer cups and temperature probe
    c.vline(15, 9, 17, "steel_dark")
    c.vline(16, 9, 15, "steel_light")
    c.rect(12, 25, 8, 3, "steel_dark")
    c.hline(11, 27, 10, "steel")
    c.line(8, 11, 24, 11, "steel_dark")
    for x, y in ((7, 9), (23, 9), (8, 13), (22, 13)):
        c.ellipse(x, y, 2, 2, "rust_light")
        c.set(x, y, "gold")
    c.rect(13, 6, 5, 3, "steel_dark")
    c.set(14, 6, "cyan")
    c.rect(19, 16, 5, 7, "steel_dark")
    c.rect(20, 17, 3, 5, "cream_dark")
    c.set(24, 18, "gold")
    c.set(24, 21, "gold")
    c.set(24, 20, "cyan")
    return c


COMPONENTS = {
    "chassis": ("Rigid Chassis", "Structural frame and sample bays", icon_chassis),
    "drive": ("Drive Assembly", "Six torque-managed wheels", icon_drive),
    "suspension": ("Rocker-Bogie", "Independent suspension linkage", icon_suspension),
    "power": ("Power Core", "Simplified thermal generator", icon_power),
    "antenna": ("High-Gain Antenna", "Uplink to the mission team", icon_antenna),
    "arm": ("Sample Arm", "Drill, scoop and close-up imaging", icon_arm),
    "spectrometer": ("Spectrometer", "Simplified mineral composition scan", icon_spectrometer),
    "weather": ("Weather Mast", "Wind, pressure and temperature", icon_weather),
}


# ---------------------------------------------------------------------------
# Assembly and export
# ---------------------------------------------------------------------------


def rover_frames() -> list[tuple[str, Canvas]]:
    return [
        ("down", rover_down()),
        ("left", rover_left()),
        ("right", rover_right()),
        ("up", rover_up()),
    ]


def rover_sheet() -> Canvas:
    frames = rover_frames()
    sheet = Canvas(ROVER_W * len(frames), ROVER_H)
    for i, (_, frame) in enumerate(frames):
        sheet.blit(frame, i * ROVER_W, 0)
    return sheet


def _icon_sheet() -> Canvas:
    sheet = Canvas(ICON * 4, ICON * 2)
    for i, (component_id, (_, _, fn)) in enumerate(COMPONENTS.items()):
        sheet.blit(fn(), (i % 4) * ICON, (i // 4) * ICON)
    return sheet


def write_equipment(out_root: Path) -> dict:
    rover_dir = out_root / "rover"
    equipment_dir = out_root / "equipment"
    rover_dir.mkdir(parents=True, exist_ok=True)
    equipment_dir.mkdir(parents=True, exist_ok=True)

    frames = rover_frames()
    for direction, frame in frames:
        frame.save(rover_dir / f"rover_{direction}.png")
    frames[0][1].save(rover_dir / "rover_assembled.png")
    sheet = rover_sheet()
    sheet.save(rover_dir / "rover_sheet.png")

    components = []
    for i, (component_id, (name, description, fn)) in enumerate(COMPONENTS.items()):
        icon = fn()
        icon.save(equipment_dir / f"{component_id}.png")
        components.append(
            {
                "id": component_id,
                "name": name,
                "description": description,
                "file": f"equipment/{component_id}.png",
                "width": ICON,
                "height": ICON,
                "sheetIndex": i,
                "fictionalEquipment": True,
                "note": "Original game hardware; all performance values in the game are simplified, non-operational gameplay values.",
            }
        )
    _icon_sheet().save(equipment_dir / "equipment_sheet.png")

    meta = {
        "rover": {
            "image": "rover/rover_assembled.png",
            "sheet": "rover/rover_sheet.png",
            "width": ROVER_W,
            "height": ROVER_H,
            "sheetWidth": ROVER_W * 4,
            "sheetHeight": ROVER_H,
            "directions": list(DIRECTIONS),
            "origin": {"x": 0.5, "y": 0.86},
            "view": "three-quarter top-down",
            "subject": "Fictional six-wheel field science rover, MERIDIAN class",
            "note": "Original design. Not a NASA rover, instrument, logo or mission patch.",
        },
        "components": components,
    }
    (out_root / "equipment" / "equipment.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1] / "client" / "public" / "assets"
    data = write_equipment(root)
    print(f"Wrote rover frames and {len(data['components'])} equipment icons to {root}")
