"""Authored NASA headquarters and engineering-lab props."""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

from pixel import Canvas, mix


def T(w: int, h: int) -> Canvas:
    return Canvas(w, h)


def _bevel(c: Canvas, x: int, y: int, w: int, h: int, light, dark) -> None:
    c.hline(x, y, w, light)
    c.vline(x, y, h, light)
    c.hline(x, y + h - 1, w, dark)
    c.vline(x + w - 1, y, h, dark)


def _screen(c: Canvas, x: int, y: int, w: int, h: int, accent="cyan", seed: int = 1) -> None:
    """Compact abstract data display. No invented values as real NASA measurements."""
    if w < 6 or h < 5:
        return
    rng = random.Random(seed)
    c.rect(x, y, w, h, "navy0")
    c.frame(x, y, w, h, "steel_dark")
    c.hline(x + 1, y + 1, w - 2, mix(accent, "navy1", 0.50))
    if w > 12:
        # score-line graph
        points = []
        px = x + 3
        for i in range(w - 7):
            yy = y + h - 3 - (i * 3 + seed * 5) % max(1, h - 6)
            points.append((px + i, yy))
        for i in range(1, len(points)):
            c.line(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], accent)
        c.hline(x + 2, y + h - 3, w - 4, "steel_dark")
    else:
        for i in range(3):
            c.rect(x + 2, y + 2 + i * 2, max(1, (w - 5) // (i + 1)), 1, accent if i != 1 else "gold")
    c.set(x + 2, y + h - 2, "teal_light")
    c.set(x + w - 3, y + 2, "gold")
    if rng.random() > 0.4:
        c.rect(x + 3, y + 2, 1, 2, "rust_light")


def _small_graph(c: Canvas, x: int, y: int, w: int, h: int, seed: int) -> None:
    rng = random.Random(seed)
    for i in range(w):
        v = (i * 5 + seed) % max(1, h)
        c.vline(x + i, y + h - v, v, "teal" if i % 3 else "gold")


def main_display() -> Canvas:
    c = T(96, 48)
    # frame
    c.rect(1, 1, 94, 46, "ink_soft")
    c.rect(2, 2, 92, 43, "steel_dark")
    c.hline(3, 3, 90, "steel_light")
    c.hline(4, 4, 88, "navy2")
    c.rect(5, 5, 86, 37, "navy0")
    c.frame(5, 5, 86, 37, "steel")
    # screen header and scanline
    c.hline(7, 7, 82, "gold")
    c.hline(7, 8, 30, "rust")
    # left: stylized screen-space Mars operations map
    earth = (17, 19)
    c.ellipse(earth[0], earth[1], 4, 4, "teal_dark")
    c.set(earth[0] - 2, earth[1] - 2, "teal_light")
    # orbit cues
    for i in range(0, 9):
        xx = 25 + i * 2
        yy = 17 + int(math.sin(i * 0.7) * 4) + 4
        if i % 2 == 0:
            c.set(xx, yy, "cyan_dark")
    # mars disc
    cx, cy = 53, 25
    c.ellipse(cx, cy, 14, 14, "rust_dark")
    c.ellipse(cx, cy - 1, 13, 12, "rust")
    c.ellipse(cx - 3, cy - 4, 7, 5, "rust_light")
    c.ellipse(cx + 7, cy + 3, 4, 3, "rust_dark")
    # map contour marks
    for y in (16, 20, 24, 28, 32):
        c.hline(44, y, 16, mix("rust", "rust_dark", 0.35))
    # target reticle
    c.rect(57, 22, 7, 5, "cyan_dark")
    c.frame(56, 21, 9, 7, "cyan")
    c.set(59, 24, "cyan_light")
    # dashed descent path
    for i in range(7):
        c.set(34 + i * 2, 15 + i, "gold" if i % 2 else "cream")
    # data blocks on right
    panel_x = 70
    c.rect(panel_x, 10, 20, 10, "navy1")
    c.frame(panel_x, 10, 20, 10, "steel_dark")
    _small_graph(c, panel_x + 2, 13, 16, 5, 5)
    c.rect(panel_x, 22, 20, 7, "navy1")
    c.hline(panel_x + 2, 24, 14, "cyan_dark")
    c.hline(panel_x + 2, 26, 9, "teal")
    c.rect(panel_x, 31, 20, 8, "navy1")
    for i in range(6):
        c.set(panel_x + 3 + i * 3, 35 + (i % 3), "gold")
    c.hline(panel_x + 2, 38, 15, "steel_dark")
    # bezel and status lights
    c.hline(4, 43, 88, "navy1")
    c.rect(6, 44, 2, 1, "teal_light")
    c.rect(10, 44, 2, 1, "gold")
    c.rect(14, 44, 2, 1, "rust")
    c.set(90, 44, "steel")
    c.set(88, 44, "steel_dark")
    # top-left reflection
    c.hline(6, 6, 17, "steel_light")
    c.set(6, 7, "cyan_dark")
    return c


def console_wide() -> Canvas:
    c = T(64, 34)
    # monitors
    for i, x in enumerate((3, 23, 43)):
        c.rect(x, 1, 18, 17, "ink_soft")
        c.rect(x + 1, 2, 16, 14, "steel_dark")
        _screen(c, x + 2, 3, 14, 11, "cyan" if i != 2 else "gold", 11 + i)
        c.rect(x + 7, 17, 4, 2, "navy2")
        c.rect(x + 5, 19, 8, 1, "steel_dark")
    # desk top
    c.rect(1, 21, 62, 6, "steel_dark")
    c.hline(2, 21, 60, "steel_light")
    c.rect(2, 23, 60, 4, "navy2")
    c.rect(4, 24, 17, 2, "navy0")
    for i in range(5):
        c.set(6 + i * 3, 25, "steel")
    c.rect(25, 24, 8, 3, "navy0")
    c.set(27, 25, "teal")
    c.set(30, 25, "cyan_dark")
    c.rect(51, 23, 4, 3, "cream")
    c.set(52, 24, "rust_dark")
    c.set(55, 23, "gold")
    # front face
    c.rect(1, 27, 62, 6, "navy1")
    _bevel(c, 1, 27, 62, 6, "steel", "ink")
    for y in range(29, 32, 2):
        for x in range(5, 59, 4):
            c.set(x, y, "steel_dark")
    c.rect(28, 29, 8, 2, "cyan_dark")
    c.rect(30, 29, 4, 1, "cyan")
    c.hline(4, 33, 56, "navy0")
    return c


def console_single() -> Canvas:
    c = T(32, 32)
    c.rect(3, 1, 26, 15, "ink_soft")
    c.rect(4, 2, 24, 12, "steel_dark")
    _screen(c, 5, 3, 22, 9, "cyan", 18)
    c.rect(14, 15, 4, 2, "navy2")
    c.rect(2, 18, 28, 8, "steel_dark")
    c.hline(2, 18, 28, "steel_light")
    c.rect(4, 20, 11, 2, "navy0")
    for i in range(4):
        c.set(6 + i * 2, 21, "steel")
    c.rect(18, 20, 6, 2, "navy0")
    c.set(20, 21, "gold")
    c.rect(2, 26, 28, 5, "navy1")
    c.hline(3, 27, 26, "steel")
    c.hline(3, 30, 26, "ink_soft")
    c.rect(14, 28, 4, 1, "cyan_dark")
    return c


def workstation() -> Canvas:
    c = T(48, 30)
    for i, x in enumerate((4, 25)):
        c.rect(x, 1, 18, 13, "ink_soft")
        c.rect(x + 1, 2, 16, 10, "steel_dark")
        _screen(c, x + 2, 3, 14, 8, "cyan" if i == 0 else "gold", 31 + i)
        c.rect(x + 7, 13, 4, 2, "navy2")
    c.rect(1, 17, 46, 5, "steel_dark")
    c.hline(2, 17, 44, "steel_light")
    c.rect(3, 19, 22, 1, "navy0")
    for i in range(6):
        c.set(5 + i * 3, 19, "steel")
    c.rect(30, 18, 7, 3, "navy0")
    c.set(33, 19, "teal")
    c.rect(1, 22, 46, 7, "navy1")
    _bevel(c, 1, 22, 46, 7, "steel", "ink")
    c.rect(19, 24, 9, 2, "cyan_dark")
    c.hline(4, 29, 40, "ink_soft")
    return c


def chair() -> Canvas:
    c = T(16, 22)
    c.rect(4, 1, 8, 4, "navy0")
    c.rect(5, 2, 6, 2, "steel_dark")
    c.rect(3, 5, 10, 11, "navy1")
    _bevel(c, 3, 5, 10, 11, "steel", "ink")
    c.rect(5, 8, 6, 6, "navy2")
    c.set(7, 10, "teal")
    c.set(8, 10, "teal_light")
    c.rect(5, 16, 2, 3, "steel_dark")
    c.rect(9, 16, 2, 3, "steel_dark")
    c.rect(2, 19, 12, 2, "navy0")
    c.set(3, 21, "steel_dark")
    c.set(12, 21, "steel_dark")
    return c


def meeting_table() -> Canvas:
    c = T(80, 40)
    # floor shadow is deliberately left to the scene renderer
    c.polygon([(3, 10), (10, 3), (70, 3), (77, 10), (77, 30), (70, 37), (10, 37), (3, 30)], "ink_soft")
    c.polygon([(4, 11), (11, 5), (69, 5), (75, 11), (75, 29), (69, 35), (11, 35), (4, 29)], "steel_dark")
    c.polygon([(6, 12), (12, 7), (68, 7), (73, 12), (73, 28), (68, 33), (12, 33), (6, 28)], "navy2")
    c.hline(13, 8, 54, "steel_light")
    c.hline(14, 9, 42, mix("navy2", "steel", 0.25))
    # inset map display
    c.rect(25, 12, 30, 16, "ink_soft")
    c.rect(26, 13, 28, 14, "navy0")
    c.frame(26, 13, 28, 14, "steel_dark")
    c.ellipse(40, 20, 7, 6, "rust_dark")
    c.ellipse(40, 20, 6, 5, "rust")
    c.hline(38, 18, 6, "rust_light")
    for i in range(6):
        c.set(31 + i * 4, 24 + (i % 2), "cyan_dark")
    c.set(49, 16, "cyan")
    c.set(49, 17, "cyan_dark")
    # papers, mugs, pins
    c.rect(7, 12, 11, 8, "cream")
    c.frame(7, 12, 11, 8, "cream_dark")
    for y in (14, 16):
        c.hline(9, y, 7, "steel_dark")
    c.rect(61, 12, 9, 7, "cream_dark")
    c.frame(61, 12, 9, 7, "warm_gray")
    c.hline(63, 14, 5, "steel_dark")
    c.hline(63, 16, 4, "steel_dark")
    c.rect(12, 26, 5, 3, "cream")
    c.set(12, 26, "rust_dark")
    c.set(16, 26, "cream_dark")
    c.rect(64, 26, 4, 3, "teal_dark")
    c.set(65, 26, "teal_light")
    c.rect(54, 29, 5, 2, "wine_vest")
    c.set(55, 29, "gold")
    c.rect(20, 29, 6, 2, "navy0")
    c.set(22, 29, "gold")
    return c


def server_rack() -> Canvas:
    c = T(24, 40)
    c.rect(1, 1, 22, 37, "ink_soft")
    c.rect(2, 2, 20, 34, "navy1")
    _bevel(c, 2, 2, 20, 34, "steel", "ink_soft")
    c.rect(4, 4, 16, 3, "navy0")
    c.hline(5, 5, 14, "steel_dark")
    for row in range(6, 31, 4):
        c.rect(4, row, 16, 3, "steel_dark")
        c.hline(5, row, 14, mix("steel_dark", "steel", 0.35))
        for x in range(7, 18, 4):
            c.set(x, row + 1, "ink_soft")
        led = random.Random(row).choice(("teal", "gold", "rust"))
        c.set(6, row + 1, led)
        c.set(18, row + 1, "steel")
    for x in (4, 19):
        c.vline(x, 30, 5, "navy0")
    c.rect(4, 35, 16, 2, "ink_soft")
    for x in (5, 18):
        c.set(x, 38, "steel_dark")
        c.set(x + 1, 38, "steel")
    return c


def plant(big: bool = False) -> Canvas:
    w, h = (24, 36) if big else (16, 26)
    c = T(w, h)
    cx = w // 2
    # pot
    c.rect(cx - 4, h - 9, 9, 8, "ink_soft")
    c.polygon([(cx - 4, h - 9), (cx + 5, h - 9), (cx + 3, h - 2), (cx - 2, h - 2)], "rust_dark")
    c.rect(cx - 3, h - 8, 7, 1, "rust")
    c.rect(cx - 2, h - 7, 5, 5, "rust_dark")
    c.set(cx - 1, h - 7, "rust_light")
    # leaves are simple hard-edged ellipses at varied angles
    leaves = (
        (-5, -12, 3, 7),
        (4, -14, 3, 8),
        (-7, -6, 4, 3),
        (6, -7, 4, 3),
        (0, -17, 3, 8),
        (-2, -9, 4, 5),
        (3, -10, 4, 5),
    )
    for i, (dx, dy, rx, ry) in enumerate(leaves):
        base = "green" if i % 2 else "green_dark"
        hi = "green_light" if i % 3 != 1 else "green"
        c.ellipse(cx + dx, h - 12 + dy, rx, ry, base)
        c.ellipse(cx + dx - 1, h - 13 + dy, max(1, rx - 2), max(1, ry - 3), hi)
    c.vline(cx, h - 14, 7, "green_dark")
    return c


def whiteboard() -> Canvas:
    c = T(48, 32)
    c.rect(1, 1, 46, 27, "ink_soft")
    c.rect(2, 2, 44, 24, "steel_dark")
    c.rect(3, 3, 42, 22, "white")
    c.frame(3, 3, 42, 22, "cream_dark")
    # abstract mission architecture diagram
    c.line(7, 19, 14, 9, "teal")
    c.line(14, 9, 25, 14, "teal")
    c.line(25, 14, 35, 7, "teal")
    c.line(35, 7, 41, 17, "teal")
    c.rect(11, 7, 6, 4, "navy1")
    c.frame(11, 7, 6, 4, "teal")
    c.rect(31, 5, 7, 4, "navy1")
    c.frame(31, 5, 7, 4, "gold")
    c.rect(23, 12, 4, 4, "rust")
    c.frame(23, 12, 4, 4, "rust_dark")
    for i in range(4):
        c.set(19 + i * 3, 21, "gold" if i % 2 else "cyan_dark")
    c.hline(7, 23, 12, "steel")
    c.hline(7, 24, 8, "steel")
    c.rect(14, 27, 4, 2, "steel_dark")
    c.rect(20, 27, 4, 2, "steel_dark")
    c.rect(26, 27, 3, 2, "steel_dark")
    return c


def window_bank() -> Canvas:
    c = T(64, 32)
    # dusk sky in four hard bands
    c.rect(1, 1, 62, 30, "steel_dark")
    c.rect(3, 3, 58, 26, "navy0")
    c.rect(3, 3, 58, 7, "navy0")
    c.rect(3, 10, 58, 6, "navy1")
    c.rect(3, 16, 58, 6, "mauve_shadow")
    c.rect(3, 22, 58, 4, "rust_dark")
    # stars and distant clouds
    for x, y in ((7, 5), (17, 4), (28, 6), (38, 5), (52, 4), (59, 6), (13, 9), (45, 8)):
        c.set(x, y, "cyan_light" if x % 3 else "cream")
    for x, y, w in ((6, 13, 13), (31, 12, 21), (47, 14, 10), (4, 19, 18), (26, 20, 16)):
        c.hline(x, y, w, mix("mauve_shadow", "fog", 0.25))
        c.hline(x + 3, y + 1, max(2, w - 6), "mauve")
    # horizon light and city silhouette (fictional HQ, not a NASA facility)
    c.hline(3, 20, 58, mix("rust_light", "gold", 0.25))
    for x, w, h in ((5, 4, 5), (12, 3, 8), (18, 5, 4), (26, 4, 9), (33, 3, 5), (40, 6, 7), (49, 4, 4), (55, 3, 8)):
        c.rect(x, 24 - h, w, h, "navy1")
        c.set(x + 1, 24 - h + 1, "gold")
    # mullions
    c.rect(32, 1, 2, 30, "steel_dark")
    c.hline(1, 17, 62, "steel_dark")
    c.hline(1, 2, 62, "steel_light")
    c.hline(1, 30, 62, "ink_soft")
    c.vline(1, 1, 30, "steel_light")
    c.vline(62, 1, 30, "steel_dark")
    c.set(4, 4, "white")
    return c


def reception_desk() -> Canvas:
    c = T(64, 30)
    c.polygon([(2, 8), (9, 3), (55, 3), (62, 8), (62, 22), (9, 22), (2, 16)], "ink_soft")
    c.polygon([(3, 8), (10, 4), (54, 4), (61, 8), (61, 21), (10, 21), (3, 16)], "steel_dark")
    c.polygon([(5, 8), (11, 6), (53, 6), (59, 8), (59, 18), (11, 18), (5, 14)], "cream")
    # front fascia with fictional mission emblem
    c.rect(8, 18, 48, 8, "navy1")
    c.hline(8, 18, 48, "steel")
    c.ellipse(32, 22, 7, 3, "rust_dark")
    c.ellipse(32, 22, 5, 2, "rust")
    c.hline(30, 21, 5, "rust_light")
    c.set(37, 22, "gold")
    # terminal and small plant
    c.rect(15, 7, 11, 8, "navy1")
    c.rect(16, 8, 9, 5, "steel_dark")
    _screen(c, 17, 9, 7, 3, "cyan", 90)
    c.rect(19, 15, 3, 1, "navy0")
    c.rect(44, 6, 6, 3, "navy0")
    c.set(46, 5, "green")
    c.set(47, 4, "green_light")
    c.set(48, 6, "green_dark")
    c.rect(45, 7, 4, 3, "rust_dark")
    return c


def coffee_station() -> Canvas:
    c = T(24, 28)
    c.rect(2, 4, 20, 19, "ink_soft")
    c.rect(3, 5, 18, 16, "steel_dark")
    c.rect(4, 6, 10, 11, "navy1")
    c.frame(4, 6, 10, 11, "steel")
    c.rect(6, 8, 6, 2, "navy0")
    c.set(7, 11, "rust")
    c.set(10, 11, "teal")
    c.rect(15, 7, 4, 3, "cream")
    c.set(16, 6, "cream_dark")
    c.rect(16, 11, 2, 4, "steel")
    for y, x in ((14, 17), (16, 18), (18, 16)):
        c.set(x, y, "fog")
        c.set(x + 1, y - 1, "fog")
    for x, y in ((5, 8), (7, 8), (9, 8)):
        c.set(x, y, "cream")
    c.rect(2, 23, 20, 3, "navy1")
    c.hline(3, 23, 18, "steel")
    return c


def water_cooler() -> Canvas:
    c = T(16, 28)
    c.rect(4, 1, 8, 7, "cyan_dark")
    c.rect(5, 2, 6, 5, "cyan")
    c.set(6, 3, "cyan_light")
    c.rect(3, 8, 10, 16, "ink_soft")
    c.rect(4, 9, 8, 14, "cream")
    c.vline(4, 9, 14, "white")
    c.rect(6, 13, 4, 2, "steel_dark")
    c.rect(7, 16, 2, 2, "teal_dark")
    c.rect(4, 23, 8, 3, "steel_dark")
    c.set(11, 11, "gold")
    return c


def mission_clock() -> Canvas:
    c = T(32, 18)
    c.rect(1, 1, 30, 16, "ink_soft")
    c.rect(2, 2, 28, 14, "steel_dark")
    c.rect(3, 3, 26, 11, "navy0")
    c.hline(4, 4, 24, "steel_dark")
    # segment display glyphs, intentionally generic mission elapsed-time bars
    for row in range(3):
        for col in range(3):
            c.rect(6 + col * 8, 6 + row * 2, 5, 1, "gold" if (row + col) % 2 else "coin")
    c.rect(5, 13, 22, 1, "navy1")
    c.set(4, 15, "teal")
    c.set(27, 15, "gold")
    return c


def wall_screen_small() -> Canvas:
    c = T(32, 24)
    c.rect(1, 1, 30, 20, "ink_soft")
    c.rect(2, 2, 28, 17, "steel_dark")
    c.hline(3, 3, 26, "steel_light")
    _screen(c, 3, 4, 26, 13, "cyan", 27)
    c.rect(8, 21, 16, 2, "navy1")
    c.set(10, 21, "gold")
    c.set(22, 21, "cyan_dark")
    return c


def banner_frontier() -> Canvas:
    c = T(24, 48)
    c.rect(2, 1, 20, 42, "ink_soft")
    c.rect(3, 2, 18, 40, "rust_dark")
    c.rect(4, 3, 16, 38, "rust")
    c.hline(4, 3, 16, "rust_light")
    c.vline(12, 6, 9, "gold")
    c.ellipse(12, 11, 6, 5, "rust_dark")
    c.ellipse(12, 10, 4, 4, "orange")
    c.hline(9, 9, 6, "beige")
    c.rect(8, 20, 8, 2, "navy1")
    c.rect(6, 25, 12, 1, "cream")
    c.rect(8, 28, 8, 1, "cream")
    c.rect(6, 34, 12, 1, "gold")
    c.rect(8, 36, 8, 1, "gold")
    c.rect(2, 43, 20, 2, "steel_dark")
    c.set(4, 47, "steel")
    c.set(19, 47, "steel")
    return c


def airlock_door() -> Canvas:
    c = T(32, 48)
    c.rect(1, 1, 30, 45, "ink_soft")
    c.rect(3, 3, 26, 42, "steel_dark")
    c.hline(4, 4, 24, "steel_light")
    c.rect(6, 6, 20, 32, "navy2")
    c.frame(6, 6, 20, 32, "navy1")
    c.ellipse(16, 16, 6, 6, "navy0")
    c.ellipse(16, 16, 4, 4, "cyan_dark")
    c.ellipse(16, 16, 2, 2, "cyan")
    c.hline(9, 27, 14, "steel_dark")
    c.hline(9, 30, 9, "steel_dark")
    c.rect(12, 34, 8, 2, "steel")
    c.rect(6, 39, 20, 4, "ink_soft")
    for y in (39, 40):
        for x in range(7, 25):
            if (x + y) % 6 < 3:
                c.set(x, y, "gold")
    c.rect(24, 18, 2, 5, "gold")
    return c


# ---------------------------------------------------------------------------
# Engineering laboratory props
# ---------------------------------------------------------------------------


def lab_bench() -> Canvas:
    c = T(64, 32)
    c.rect(1, 9, 62, 19, "ink_soft")
    c.rect(2, 10, 60, 17, "steel_dark")
    c.hline(3, 11, 58, "steel_light")
    c.rect(2, 10, 60, 5, "navy2")
    _bevel(c, 2, 10, 60, 5, "steel", "navy1")
    # pegboard and tools
    c.rect(5, 2, 54, 10, "navy1")
    c.frame(5, 2, 54, 10, "steel_dark")
    for x in range(8, 56, 7):
        c.set(x, 4, "steel_dark")
        c.vline(x, 5, 4, "steel")
    c.rect(10, 5, 1, 4, "steel_light")
    c.set(11, 5, "gold")
    c.rect(22, 5, 4, 2, "rust_light")
    c.rect(24, 7, 1, 3, "steel_dark")
    c.ellipse(35, 7, 3, 2, "steel")
    c.ellipse(35, 7, 1, 1, "navy0")
    c.rect(46, 5, 4, 4, "teal_dark")
    c.rect(47, 6, 2, 2, "cyan")
    c.rect(55, 4, 2, 5, "steel")
    # bench items
    c.rect(7, 13, 13, 4, "navy0")
    c.frame(7, 13, 13, 4, "steel")
    _screen(c, 8, 14, 11, 2, "cyan", 61)
    c.rect(25, 13, 9, 3, "cream_dark")
    c.frame(25, 13, 9, 3, "warm_gray")
    c.rect(39, 13, 7, 5, "steel_dark")
    c.set(41, 14, "gold")
    c.set(44, 16, "rust")
    c.rect(50, 13, 8, 3, "teal_dark")
    c.set(52, 14, "teal_light")
    c.rect(2, 24, 60, 6, "navy1")
    _bevel(c, 2, 24, 60, 6, "steel", "ink_soft")
    c.rect(7, 26, 14, 2, "ink_soft")
    c.hline(8, 26, 12, "steel_dark")
    c.rect(28, 26, 12, 2, "ink_soft")
    c.hline(29, 26, 10, "steel_dark")
    return c


def rover_jig() -> Canvas:
    c = T(64, 42)
    # floor rails
    c.hline(2, 34, 60, "ink_soft")
    c.hline(3, 35, 58, "steel_dark")
    c.hline(3, 37, 58, "steel")
    c.hline(3, 39, 58, "navy0")
    # uprights
    for x in (6, 54):
        c.rect(x, 6, 4, 30, "steel_dark")
        c.vline(x, 7, 28, "steel_light")
        c.vline(x + 3, 7, 28, "ink_soft")
        c.rect(x - 2, 34, 8, 3, "navy1")
    c.rect(6, 5, 52, 4, "steel_dark")
    c.hline(7, 5, 50, "steel_light")
    c.hline(7, 8, 50, "navy1")
    # warning strip on beam
    for x in range(10, 56):
        if (x // 3) % 2 == 0:
            c.set(x, 6, "gold")
    # hoist cable and suspended bay
    c.vline(32, 9, 9, "steel")
    c.rect(24, 18, 16, 2, "steel_dark")
    c.set(24, 18, "gold")
    c.set(39, 18, "gold")
    # generic rover chassis cradle
    c.rect(15, 22, 34, 8, "ink_soft")
    c.rect(16, 22, 32, 7, "rust_dark")
    c.rect(18, 22, 28, 4, "rust")
    c.hline(20, 23, 22, "rust_light")
    c.rect(27, 26, 10, 4, "navy1")
    c.rect(29, 27, 6, 2, "steel_dark")
    c.set(32, 27, "cyan")
    # components on cart
    c.rect(47, 28, 10, 5, "navy1")
    c.rect(48, 29, 4, 3, "steel_dark")
    c.rect(52, 30, 3, 2, "gold")
    c.rect(10, 29, 7, 4, "navy1")
    c.ellipse(13, 30, 2, 2, "steel")
    # hazard floor marking bits
    for x in range(4, 60, 6):
        c.set(x, 40, "gold")
    return c


def tool_cart() -> Canvas:
    c = T(32, 28)
    c.rect(2, 7, 28, 18, "ink_soft")
    c.rect(3, 8, 26, 16, "steel_dark")
    c.hline(4, 9, 24, "steel_light")
    c.rect(4, 9, 24, 4, "navy2")
    for y in (14, 19, 24):
        c.hline(3, y, 26, "ink_soft")
        c.rect(5, y + 1, 20, 2, "navy1")
        c.rect(19, y + 1, 2, 1, "steel_light")
    c.rect(24, 9, 2, 2, "gold")
    c.rect(9, 3, 14, 2, "steel")
    c.rect(11, 1, 10, 2, "steel_dark")
    c.vline(12, 3, 5, "steel_light")
    c.vline(22, 3, 5, "steel_light")
    c.rect(4, 25, 4, 2, "navy0")
    c.rect(23, 25, 4, 2, "navy0")
    c.set(6, 27, "steel_dark")
    c.set(24, 27, "steel_dark")
    return c


def component_bin() -> Canvas:
    c = T(32, 24)
    c.rect(2, 4, 28, 17, "ink_soft")
    c.rect(3, 5, 26, 15, "navy2")
    c.frame(3, 5, 26, 15, "steel_dark")
    c.hline(4, 6, 24, "steel_light")
    c.hline(4, 19, 24, "ink_soft")
    c.rect(5, 8, 10, 9, "navy1")
    c.rect(6, 9, 8, 5, "steel_dark")
    c.ellipse(10, 12, 2, 2, "gold")
    c.rect(8, 20, 6, 1, "cream")
    c.rect(18, 8, 9, 9, "navy1")
    c.rect(19, 9, 7, 3, "steel_dark")
    c.rect(19, 13, 7, 3, "wine_vest_dark")
    c.set(20, 14, "gold")
    c.set(24, 10, "cyan_dark")
    return c


def wheel_rack() -> Canvas:
    """Spare rover wheels stored upright in a compact service rack."""
    c = T(40, 40)
    # weighted feet and floor rail
    c.rect(2, 35, 36, 3, "ink_soft")
    c.hline(3, 35, 34, "steel_dark")
    c.hline(4, 36, 32, "steel")
    c.set(3, 38, "gold")
    c.set(36, 38, "gold")
    # welded frame
    for x in (4, 33):
        c.rect(x, 5, 3, 32, "steel_dark")
        c.vline(x, 6, 30, "steel_light")
        c.vline(x + 2, 6, 30, "ink_soft")
    c.rect(4, 4, 32, 4, "steel_dark")
    c.hline(5, 4, 30, "steel_light")
    c.hline(5, 7, 30, "navy1")
    for x in range(7, 34, 5):
        c.set(x, 5, "gold")
    # three treaded wheels hooked onto the rack
    for cx, cy in ((12, 17), (27, 17), (20, 28)):
        c.ellipse(cx, cy, 6, 6, "ink_soft")
        c.ellipse(cx, cy, 5, 5, "steel_dark")
        c.ellipse(cx, cy, 4, 4, "navy1")
        c.ellipse(cx, cy, 2, 2, "steel")
        c.ellipse(cx, cy, 1, 1, "steel_light")
        for dx, dy in ((0, -5), (0, 5), (-5, 0), (5, 0), (-4, -4), (4, 4), (-4, 4), (4, -4)):
            c.set(cx + dx, cy + dy, "warm_gray" if (dx + dy) % 2 else "ink_soft")
        c.set(cx - 1, cy - 1, "cream")
    # small service tag and a hanging wrench
    c.rect(33, 11, 3, 5, "gold")
    c.set(34, 12, "ink_soft")
    c.vline(8, 26, 5, "steel")
    c.rect(7, 30, 3, 2, "steel_light")
    return c


def cable_reel() -> Canvas:
    """Cable drum on a steel cradle, with a loose tether end."""
    c = T(28, 24)
    # cradle and floor rail
    c.rect(3, 20, 22, 3, "ink_soft")
    c.hline(4, 20, 20, "steel_dark")
    c.hline(5, 21, 18, "steel")
    c.set(4, 23, "gold")
    c.set(23, 23, "gold")
    c.vline(6, 13, 7, "steel_dark")
    c.vline(21, 13, 7, "steel_dark")
    c.set(6, 13, "steel_light")
    c.set(21, 13, "steel_light")
    # wooden drum cheeks, clear of any radial spokes
    c.ellipse(14, 11, 9, 8, "ink_soft")
    c.ellipse(14, 11, 8, 7, "khaki_dark")
    c.ellipse(14, 11, 7, 6, "khaki")
    c.hline(8, 11, 12, "khaki_dark")
    # neatly wound cable core inside a visible wooden flange
    c.ellipse(14, 11, 5, 4, "rust_dark")
    c.ellipse(14, 11, 4, 3, "rust")
    c.ellipse(14, 11, 3, 2, "sand_dark")
    c.ellipse(14, 11, 2, 1, "rust")
    c.ellipse(14, 11, 1, 1, "steel_light")
    for x, y in ((8, 7), (20, 7), (6, 14), (22, 14)):
        c.set(x, y, "steel_dark")
    c.set(10, 7, "beige")
    c.set(16, 15, "rust_light")
    # tether end coils off the drum and ends in a clipped connector
    c.line(20, 16, 23, 19, "rust")
    c.set(23, 19, "gold")
    c.set(24, 19, "yellow")
    return c


def gantry_crane() -> Canvas:
    c = T(80, 50)
    c.hline(5, 44, 70, "ink_soft")
    c.hline(7, 45, 66, "steel_dark")
    c.hline(7, 47, 66, "steel")
    for x in (8, 66):
        c.rect(x, 8, 6, 36, "steel_dark")
        c.vline(x, 9, 34, "steel_light")
        c.vline(x + 5, 9, 34, "ink_soft")
        c.rect(x - 2, 42, 10, 3, "navy1")
    c.rect(8, 7, 64, 6, "steel_dark")
    c.hline(9, 7, 62, "steel_light")
    c.hline(9, 11, 62, "navy1")
    c.rect(31, 12, 18, 5, "ink_soft")
    c.rect(32, 13, 16, 3, "navy2")
    c.set(33, 14, "gold")
    c.set(46, 14, "rust")
    c.vline(40, 17, 17, "steel")
    c.rect(35, 33, 10, 4, "steel_dark")
    c.rect(37, 34, 6, 2, "gold")
    c.rect(58, 19, 6, 9, "navy0")
    c.rect(59, 20, 4, 7, "cyan_dark")
    c.set(60, 21, "cyan")
    # hazard
    for x in range(10, 64, 5):
        c.set(x, 13, "gold")
    return c


HQ_PROPS = {
    "main_display": main_display,
    "console_wide": console_wide,
    "console_single": console_single,
    "workstation": workstation,
    "chair": chair,
    "meeting_table": meeting_table,
    "server_rack": server_rack,
    "plant": lambda: plant(False),
    "plant_big": lambda: plant(True),
    "whiteboard": whiteboard,
    "window_bank": window_bank,
    "reception_desk": reception_desk,
    "coffee_station": coffee_station,
    "water_cooler": water_cooler,
    "mission_clock": mission_clock,
    "wall_screen_small": wall_screen_small,
    "banner_frontier": banner_frontier,
    "airlock_door": airlock_door,
}

LAB_PROPS = {
    "lab_bench": lab_bench,
    "rover_jig": rover_jig,
    "tool_cart": tool_cart,
    "component_bin": component_bin,
    "gantry_crane": gantry_crane,
    "wheel_rack": wheel_rack,
    "cable_reel": cable_reel,
}


def write_props(out_root: Path) -> dict:
    manifest = {"hq": [], "lab": []}
    for category, props in (("hq", HQ_PROPS), ("lab", LAB_PROPS)):
        folder = out_root / "props" / category
        folder.mkdir(parents=True, exist_ok=True)
        for prop_id, fn in props.items():
            image = fn()
            image.save(folder / f"{prop_id}.png")
            manifest[category].append(
                {
                    "id": prop_id,
                    "file": f"props/{category}/{prop_id}.png",
                    "width": image.width,
                    "height": image.height,
                    "anchor": "bottom-center",
                    "originX": image.width / 2,
                    "originY": image.height,
                    "fictional": True,
                }
            )
    (out_root / "props" / "props.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest
