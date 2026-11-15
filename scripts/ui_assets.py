"""Original interface art: resource icons, role badges, fictional branding.

No NASA insignia, mission patch or typeface is reproduced. The wordmark, patch
and UI marks are original project assets. Interface assets use hard alpha only.
"""

from __future__ import annotations

import json
from pathlib import Path

from pixel import Canvas, colored_external_outline, draw_text, mix, text_width

ICON = 16
ROLE = 32

RESOURCES = (
    ("budget", "Budget", "coin"),
    ("mass", "Mass", "cargo"),
    ("power", "Power", "battery"),
    ("data", "Data", "drive"),
    ("comms", "Comms", "dish"),
    ("time", "Time", "clock"),
)


# ---------------------------------------------------------------------------
# Resource icons (16 x 16, transparent, readable at 4x and 1x)
# ---------------------------------------------------------------------------


def icon_budget(c: Canvas | None = None) -> Canvas:
    c = c or Canvas(ICON, ICON)
    # small coin edge tucked behind
    c.ellipse(11, 4, 3, 2, "ink_soft")
    c.ellipse(11, 3, 2, 1, "gold")
    c.set(10, 3, "yellow")
    # large stamped coin
    c.ellipse(7, 9, 6, 5, "ink_soft")
    c.ellipse(7, 8, 5, 4, "gold")
    c.ellipse(6, 7, 3, 2, "coin")
    c.set(4, 6, "yellow")
    # stamped S, readable as a currency face
    c.hline(6, 7, 3, "rust_dark")
    c.set(5, 8, "rust_dark")
    c.hline(6, 8, 2, "rust_dark")
    c.set(8, 9, "rust_dark")
    c.hline(6, 10, 3, "rust_dark")
    c.set(5, 9, "coin")
    c.set(12, 11, "gold")
    c.set(2, 13, "gold")
    return colored_external_outline(c, 0.70)


def icon_mass(c: Canvas | None = None) -> Canvas:
    c = c or Canvas(ICON, ICON)
    # lift handle, top facet and a dense front face
    c.rect(5, 2, 6, 1, "ink_soft")
    c.rect(5, 3, 1, 3, "ink_soft")
    c.rect(10, 3, 1, 3, "ink_soft")
    c.set(6, 3, "steel_light")
    c.polygon([(4, 5), (11, 5), (14, 8), (4, 8), (2, 7)], "cream_dark")
    c.hline(4, 5, 7, "cream")
    c.polygon([(2, 7), (4, 8), (14, 8), (14, 13), (4, 14), (2, 11)], "ink_soft")
    c.polygon([(3, 8), (13, 8), (13, 12), (4, 13), (3, 11)], "steel_dark")
    c.hline(4, 8, 9, "steel")
    c.vline(3, 9, 2, "steel_light")
    # downward mass cue and corner bolts
    c.hline(7, 9, 3, "gold")
    c.rect(8, 9, 1, 3, "gold")
    c.line(7, 11, 8, 13, "gold")
    c.line(9, 11, 8, 13, "gold")
    c.set(4, 12, "cream")
    c.set(12, 12, "cyan_dark")
    c.set(11, 4, "gold")
    c.set(3, 4, "steel_light")
    return colored_external_outline(c, 0.70)


def icon_power(c: Canvas | None = None) -> Canvas:
    c = c or Canvas(ICON, ICON)
    c.rect(4, 2, 8, 2, "ink_soft")
    c.rect(6, 1, 4, 2, "steel_dark")
    c.set(7, 1, "steel_light")
    c.rect(3, 4, 10, 11, "ink_soft")
    c.rect(4, 5, 8, 9, "navy0")
    c.frame(4, 5, 8, 9, "steel_dark")
    c.hline(5, 5, 3, "steel_light")
    c.hline(5, 7, 6, "teal_dark")
    c.hline(5, 8, 6, "teal")
    c.hline(5, 10, 6, "teal_dark")
    c.polygon([(8, 5), (5, 10), (7, 10), (6, 13), (11, 8), (9, 8), (10, 5)], "gold")
    c.set(7, 10, "yellow")
    c.set(9, 8, "yellow")
    c.set(12, 13, "cyan_dark")
    return colored_external_outline(c, 0.70)


def icon_data(c: Canvas | None = None) -> Canvas:
    c = c or Canvas(ICON, ICON)
    # industrial data cartridge with notch, label strip and contacts
    c.polygon([(2, 3), (12, 3), (14, 5), (14, 12), (12, 14), (2, 14)], "ink_soft")
    c.polygon([(3, 4), (11, 4), (13, 6), (13, 11), (11, 13), (3, 13)], "steel_dark")
    c.polygon([(4, 5), (11, 5), (12, 6), (12, 10), (10, 12), (4, 12)], "navy2")
    c.hline(4, 5, 6, "steel_light")
    c.rect(4, 7, 7, 2, "cyan_dark")
    c.rect(5, 7, 4, 1, "cyan")
    c.set(11, 7, "gold")
    c.rect(5, 10, 2, 1, "cyan")
    c.rect(8, 10, 2, 1, "cyan")
    for x in range(4, 12, 2):
        c.set(x, 13, "gold")
    c.set(13, 12, "cyan_light")
    c.set(3, 12, "steel")
    return colored_external_outline(c, 0.70)


def icon_comms(c: Canvas | None = None) -> Canvas:
    c = c or Canvas(ICON, ICON)
    # compact relay mast with clean, directional signal arcs
    c.rect(4, 5, 3, 8, "ink_soft")
    c.vline(5, 6, 7, "steel")
    c.vline(4, 8, 4, "steel_light")
    c.hline(2, 14, 8, "ink_soft")
    c.hline(3, 13, 6, "steel_dark")
    c.set(4, 12, "gold")
    c.rect(5, 2, 2, 2, "ink_soft")
    c.set(5, 2, "gold")
    c.set(6, 2, "yellow")
    c.hline(2, 7, 2, "steel_dark")
    c.hline(8, 7, 2, "steel_dark")
    c.set(1, 7, "cyan_dark")
    c.set(10, 7, "cyan_dark")
    for x, y in ((9, 5), (11, 4), (12, 5), (13, 7), (9, 9), (11, 10), (12, 9)):
        c.set(x, y, "cyan" if (x + y) % 2 else "cyan_light")
    c.set(14, 6, "cyan_dark")
    c.set(2, 4, "teal")
    return colored_external_outline(c, 0.70)


def icon_time(c: Canvas | None = None) -> Canvas:
    c = c or Canvas(ICON, ICON)
    c.ellipse(8, 8, 6, 6, "ink_soft")
    c.ellipse(8, 8, 5, 5, "steel_dark")
    c.ellipse(8, 8, 4, 4, "cream")
    c.ellipse(7, 7, 2, 2, "white")
    for x, y in ((8, 2), (8, 13), (2, 8), (13, 8)):
        c.set(x, y, "gold")
    c.line(8, 8, 8, 4, "ink_soft")
    c.line(8, 8, 11, 10, "ink_soft")
    c.set(8, 8, "rust")
    c.set(8, 4, "gold")
    c.set(11, 10, "gold")
    c.set(11, 4, "steel_dark")
    return colored_external_outline(c, 0.70)


RESOURCE_FNS = {
    "budget": icon_budget,
    "mass": icon_mass,
    "power": icon_power,
    "data": icon_data,
    "comms": icon_comms,
    "time": icon_time,
}


# ---------------------------------------------------------------------------
# Role badges (32 x 32)
# ---------------------------------------------------------------------------


def _role_shield(rim: str, rim_dark: str, fill: str) -> Canvas:
    c = Canvas(ROLE, ROLE)
    c.polygon([(4, 2), (27, 2), (30, 5), (30, 22), (16, 30), (2, 22), (2, 5)], "ink_soft")
    c.polygon([(5, 3), (26, 3), (29, 6), (29, 21), (16, 29), (3, 21), (3, 6)], rim_dark)
    c.polygon([(6, 4), (25, 4), (28, 7), (27, 20), (16, 27), (4, 20), (4, 7)], rim)
    c.polygon([(7, 5), (24, 5), (26, 8), (26, 19), (16, 25), (5, 19), (5, 8)], fill)
    c.hline(7, 5, 17, mix(fill, "white", 0.18))
    c.vline(5, 8, 12, mix(fill, "white", 0.10))
    return c


def badge_engineer() -> Canvas:
    c = _role_shield("coverall_light", "rust_dark", "coverall_dark")
    # wrench and gear
    c.ellipse(13, 14, 5, 5, "ink_soft")
    c.ellipse(13, 14, 4, 4, "steel_dark")
    c.ellipse(13, 14, 2, 2, "navy1")
    for x, y in ((13, 8), (13, 19), (7, 14), (18, 14)):
        c.rect(x - 1, y - 1, 3, 2 if y != 14 else 3, "steel")
    c.set(12, 13, "steel_light")
    c.line(17, 18, 24, 25, "steel_dark")
    c.line(18, 18, 25, 25, "steel_light")
    c.rect(23, 23, 3, 3, "ink_soft")
    c.rect(24, 23, 2, 2, "gold")
    c.set(9, 9, "yellow")
    c.set(24, 10, "cyan")
    return c


def badge_satellite() -> Canvas:
    c = _role_shield("teal_light", "teal_dark", "navy1")
    # satellite body with hard-edged solar wings and orbital arc
    c.rect(12, 12, 8, 8, "steel_dark")
    c.rect(13, 13, 6, 6, "cream_dark")
    c.hline(14, 14, 4, "white")
    c.rect(9, 14, 3, 2, "cyan_dark")
    c.rect(20, 14, 3, 2, "cyan_dark")
    c.rect(6, 13, 3, 5, "navy0")
    c.rect(7, 14, 1, 3, "cyan")
    c.rect(23, 13, 3, 5, "navy0")
    c.rect(24, 14, 1, 3, "cyan")
    c.line(16, 11, 16, 7, "steel_dark")
    c.ellipse(16, 6, 3, 2, "ink_soft")
    c.ellipse(16, 6, 2, 1, "cream")
    for x, y in ((6, 21), (9, 24), (14, 26), (20, 26), (25, 23)):
        c.set(x, y, "cyan")
    c.set(13, 16, "cyan_light")
    c.set(16, 16, "gold")
    return c


def badge_finance() -> Canvas:
    c = _role_shield("wine_light", "wine_vest_dark", "wine_vest_dark")
    # ledger and coin columns
    c.rect(7, 9, 12, 14, "ink_soft")
    c.rect(8, 8, 11, 14, "cream_dark")
    c.rect(9, 9, 9, 12, "cream")
    c.hline(9, 12, 6, "wine")
    c.hline(9, 15, 7, "steel_dark")
    c.hline(9, 18, 5, "steel_dark")
    c.rect(19, 8, 7, 10, "ink_soft")
    c.ellipse(22, 9, 3, 2, "gold")
    c.rect(20, 9, 5, 6, "coin")
    c.ellipse(22, 15, 3, 2, "gold")
    c.hline(21, 10, 3, "yellow")
    c.set(23, 13, "gold")
    c.set(9, 22, "gold")
    c.set(24, 21, "cyan_dark")
    return c


def badge_designer() -> Canvas:
    c = _role_shield("slate_vest_light", "slate_vest_dark", "navy1")
    # route nodes and a check-mark trajectory
    c.line(8, 22, 13, 14, "steel_dark")
    c.line(13, 14, 21, 16, "steel_dark")
    c.line(21, 16, 24, 8, "steel_dark")
    for x, y in ((8, 22), (13, 14), (21, 16), (24, 8)):
        c.rect(x - 2, y - 2, 5, 5, "ink_soft")
        c.rect(x - 1, y - 1, 3, 3, "gold" if (x, y) != (13, 14) else "cyan")
    c.set(12, 13, "cyan_light")
    c.set(23, 7, "yellow")
    c.set(9, 10, "teal_light")
    c.set(23, 22, "gold")
    c.set(8, 9, "cream")
    return c


def badge_scientist() -> Canvas:
    c = _role_shield("teal", "teal_dark", "navy0")
    # microscope / specimen lens
    c.rect(10, 23, 13, 3, "ink_soft")
    c.hline(11, 23, 11, "steel_light")
    c.line(12, 21, 12, 15, "steel_dark")
    c.line(13, 20, 18, 12, "steel_dark")
    c.line(13, 20, 18, 12, "steel_light")
    c.ellipse(19, 11, 4, 4, "ink_soft")
    c.ellipse(19, 11, 3, 3, "steel_dark")
    c.ellipse(19, 11, 1, 1, "cyan")
    c.rect(7, 9, 5, 7, "cyan_dark")
    c.rect(8, 10, 3, 5, "cyan")
    c.set(9, 11, "cyan_light")
    c.set(12, 8, "cream")
    c.set(23, 19, "gold")
    return c


ROLE_BADGES = {
    "engineer": ("Aerospace Engineer", badge_engineer),
    "satellite": ("Mars Satellite Controller", badge_satellite),
    "finance": ("Finance Administrator", badge_finance),
    "designer": ("Mission Designer", badge_designer),
    "scientist": ("Mission Scientist", badge_scientist),
}


# ---------------------------------------------------------------------------
# Branding
# ---------------------------------------------------------------------------


def logo_red_frontier() -> Canvas:
    c = Canvas(192, 64)
    # vertical lockup: heavy RED over tracked FRONTIER
    draw_text(c, "RED", 8, 2, "rust_light", 5, 1, shadow="wine_vest_dark", outline="ink")
    c.polygon([(8, 38), (86, 38), (82, 40), (8, 40)], "rust_dark")
    c.hline(9, 38, 76, "rust")
    c.hline(10, 38, 32, "rust_light")
    draw_text(c, "FRONTIER", 8, 41, "cream", 3, 1, shadow="ink", outline="ink")
    c.set(89, 43, "gold")
    c.set(89, 51, "cyan_dark")
    # fictional Mars operations mark, clear of the wordmark
    cx, cy = 171, 31
    c.ellipse(cx, cy, 16, 16, "ink")
    c.ellipse(cx, cy, 14, 14, "navy1")
    c.ellipse(cx - 1, cy - 1, 11, 11, "rust_dark")
    c.ellipse(cx - 2, cy - 2, 10, 10, "rust")
    c.ellipse(cx - 5, cy - 6, 5, 4, "rust_light")
    c.ellipse(cx + 5, cy + 5, 3, 2, "rust_dark")
    c.ellipse(cx + 2, cy - 6, 2, 1, "rust_light")
    c.ellipse(cx + 6, cy - 2, 1, 2, "rust_deep")
    c.ellipse(cx - 3, cy + 6, 2, 1, "rust_deep")
    # orbit, scan ticks and a single target pip
    for points in (
        ((153, 42), (154, 40), (155, 38), (157, 36)),
        ((157, 34), (159, 32), (160, 30), (161, 27)),
        ((183, 35), (185, 33), (186, 31)),
    ):
        for x, y in points:
            if x < 192:
                c.set(x, y, "cyan_dark")
    c.rect(171, 12, 1, 3, "cyan")
    c.rect(171, 47, 1, 3, "steel")
    c.hline(152, 31, 2, "steel")
    c.hline(188, 31, 2, "steel")
    c.set(185, 24, "gold")
    c.set(186, 24, "yellow")
    c.set(157, 49, "teal")
    return c


def logo_mission_mars() -> Canvas:
    c = Canvas(160, 32)
    c.rect(0, 0, 160, 32, "navy1")
    c.hline(0, 0, 160, "steel_dark")
    c.hline(0, 31, 160, "ink")
    c.rect(0, 0, 4, 32, "rust")
    c.hline(2, 4, 2, "gold")
    draw_text(c, "MISSION MARS", 10, 5, "cream", 2, 1, shadow="ink")
    draw_text(c, "ARES SURVEY / MERIDIAN", 11, 21, "fog", 1, 1)
    c.rect(154, 7, 2, 2, "cyan")
    c.rect(154, 23, 2, 2, "gold")
    return c


def patch_ares_survey() -> Canvas:
    c = Canvas(64, 64)
    # hexagonal expedition patch, original geometry
    c.polygon([(32, 1), (58, 15), (58, 44), (32, 62), (6, 44), (6, 15)], "ink")
    c.polygon([(32, 3), (56, 16), (56, 42), (32, 59), (8, 42), (8, 16)], "rust_dark")
    c.polygon([(32, 5), (54, 17), (54, 40), (32, 57), (10, 40), (10, 17)], "navy1")
    c.polygon([(32, 7), (52, 18), (52, 39), (32, 55), (12, 39), (12, 18)], "navy0")
    # orbital path
    for x, y in ((18, 38), (19, 34), (21, 30), (24, 27), (28, 24), (32, 22), (37, 21), (42, 22), (46, 25), (49, 29)):
        c.set(x, y, "cyan_dark")
    # planet with a hard terminator
    c.ellipse(32, 33, 15, 15, "rust_dark")
    c.ellipse(32, 33, 14, 14, "rust")
    c.ellipse(28, 29, 8, 7, "rust_light")
    c.ellipse(39, 38, 4, 3, "rust_deep")
    c.ellipse(26, 38, 3, 2, "rust_dark")
    c.ellipse(38, 27, 2, 2, "rust_light")
    # tiny lander mark and stars
    c.rect(28, 26, 3, 3, "cream")
    c.set(29, 25, "gold")
    c.line(26, 29, 24, 32, "cream")
    c.line(33, 29, 35, 32, "cream")
    c.set(19, 15, "cyan_light")
    c.set(45, 17, "gold")
    c.set(22, 50, "cream")
    c.set(43, 48, "cyan")
    # banner text, deliberately tiny but original
    draw_text(c, "ARES", 32 - text_width("ARES", 1, 1) // 2, 9, "cream", 1, 1)
    draw_text(c, "SURVEY", 32 - text_width("SURVEY", 1, 1) // 2, 51, "gold", 1, 1)
    return c


def wordmark_small() -> Canvas:
    c = Canvas(152, 24)
    draw_text(c, "RED FRONTIER", 2, 3, "cream", 2, 1, shadow="ink")
    c.hline(2, 19, 147, "rust_dark")
    c.hline(2, 18, 63, "rust")
    c.rect(147, 3, 2, 2, "cyan")
    c.rect(2, 15, 2, 2, "gold")
    return c


# ---------------------------------------------------------------------------
# Interface marks and panel
# ---------------------------------------------------------------------------


def marker_objective() -> Canvas:
    c = Canvas(16, 16)
    c.polygon([(8, 1), (15, 8), (8, 15), (1, 8)], "ink_soft")
    c.polygon([(8, 2), (14, 8), (8, 14), (2, 8)], "gold")
    c.polygon([(8, 4), (12, 8), (8, 12), (4, 8)], "ink_soft")
    c.rect(7, 6, 2, 4, "yellow")
    c.rect(7, 11, 2, 1, "yellow")
    return c


def marker_scan() -> Canvas:
    c = Canvas(16, 16)
    for i in range(16):
        # broken scan ring with deliberate cardinal gaps
        if i in (4, 5, 6, 9, 10, 11):
            continue
        c.set(8, 1, "cyan")
        c.set(8, 14, "cyan")
        c.set(1, 8, "cyan")
        c.set(14, 8, "cyan")
    for x, y in ((4, 3), (5, 2), (11, 3), (12, 4), (3, 12), (4, 13), (12, 11), (11, 12)):
        c.set(x, y, "cyan_dark")
    c.rect(7, 7, 2, 2, "cyan_light")
    c.rect(7, 7, 1, 1, "white")
    return c


def marker_talk() -> Canvas:
    c = Canvas(16, 16)
    c.polygon([(2, 2), (13, 2), (15, 4), (15, 10), (13, 12), (7, 12), (3, 15), (3, 12), (2, 11)], "ink_soft")
    c.polygon([(3, 3), (12, 3), (14, 5), (14, 9), (12, 11), (6, 11), (4, 13), (4, 11), (3, 10)], "cream")
    c.set(6, 6, "ink_soft")
    c.set(8, 6, "ink_soft")
    c.set(10, 6, "ink_soft")
    c.set(6, 8, "steel_dark")
    c.set(8, 8, "steel_dark")
    c.set(10, 8, "steel_dark")
    return c


def panel_nine_slice() -> Canvas:
    """24 x 24 source with an 8 px border, designed for 9-slice scaling."""
    c = Canvas(24, 24)
    # A true chamfer keeps the corner pixels transparent for clean stretching.
    c.polygon([(2, 0), (21, 0), (23, 2), (23, 21), (21, 23), (2, 23), (0, 21), (0, 2)], "ink")
    c.polygon([(2, 1), (21, 1), (22, 2), (22, 21), (21, 22), (2, 22), (1, 21), (1, 2)], "steel_dark")
    c.polygon([(3, 2), (20, 2), (21, 3), (21, 20), (20, 21), (3, 21), (2, 20), (2, 3)], "navy1")
    c.hline(3, 3, 17, "navy3")
    c.vline(3, 3, 16, "navy3")
    c.hline(3, 3, 11, "steel_dark")
    c.vline(3, 3, 11, "steel_dark")
    c.hline(3, 20, 17, "ink")
    c.vline(20, 3, 17, "ink")
    c.set(2, 2, "gold")
    c.set(21, 2, "steel")
    c.set(2, 21, "cyan_dark")
    return c


def nav_arrow() -> Canvas:
    c = Canvas(16, 16)
    c.polygon([(2, 7), (8, 2), (8, 6), (14, 6), (14, 10), (8, 10), (8, 14)], "ink_soft")
    c.polygon([(3, 7), (8, 4), (8, 7), (13, 7), (13, 9), (8, 9), (8, 12)], "gold")
    c.hline(8, 7, 3, "yellow")
    return c


UI_MARKS = {
    "marker_objective": ("Objective marker", marker_objective),
    "marker_scan": ("Scan target marker", marker_scan),
    "marker_talk": ("Dialogue marker", marker_talk),
    "nav_arrow": ("Wayfinding arrow", nav_arrow),
}


# ---------------------------------------------------------------------------
# Preview sheets and export
# ---------------------------------------------------------------------------


def resource_sheet() -> Canvas:
    sheet = Canvas(ICON * 6, ICON)
    for i, (key, _, _) in enumerate(RESOURCES):
        sheet.blit(RESOURCE_FNS[key](), i * ICON, 0)
    return sheet


def role_sheet() -> Canvas:
    sheet = Canvas(ROLE * 5, ROLE)
    for i, (_, (_, fn)) in enumerate(ROLE_BADGES.items()):
        sheet.blit(fn(), i * ROLE, 0)
    return sheet


def ui_marks_sheet() -> Canvas:
    sheet = Canvas(16 * 4, 16)
    for i, (key, (_, fn)) in enumerate(UI_MARKS.items()):
        sheet.blit(fn(), i * 16, 0)
    return sheet


def branding_sheet() -> Canvas:
    sheet = Canvas(256, 144)
    sheet.hline(0, 0, 256, "steel_dark")
    sheet.blit(logo_red_frontier(), 0, 0)
    sheet.hline(0, 68, 256, "navy2")
    sheet.blit(logo_mission_mars(), 8, 74)
    sheet.hline(8, 110, 122, "steel_dark")
    sheet.blit(wordmark_small(), 8, 112)
    sheet.blit(patch_ares_survey(), 184, 72)
    sheet.hline(0, 140, 256, "ink")
    return sheet


def write_ui(out_root: Path) -> dict:
    ui_dir = out_root / "ui"
    brand_dir = out_root / "branding"
    ui_dir.mkdir(parents=True, exist_ok=True)
    brand_dir.mkdir(parents=True, exist_ok=True)

    resources = []
    for key, name, glyph in RESOURCES:
        icon = RESOURCE_FNS[key]()
        icon.save(ui_dir / f"resource_{key}.png")
        resources.append(
            {
                "id": key,
                "name": name,
                "glyph": glyph,
                "file": f"ui/resource_{key}.png",
                "width": ICON,
                "height": ICON,
                "transparent": True,
            }
        )
    resource_sheet().save(ui_dir / "resource_icons.png")

    roles = []
    for key, (name, fn) in ROLE_BADGES.items():
        icon = fn()
        icon.save(ui_dir / f"role_{key}.png")
        roles.append(
            {
                "id": key,
                "name": name,
                "file": f"ui/role_{key}.png",
                "width": ROLE,
                "height": ROLE,
                "transparent": False,
                "note": "Original role mark; the fictional cast is not based on NASA employees.",
            }
        )
    role_sheet().save(ui_dir / "role_badges.png")

    marks = []
    for key, (name, fn) in UI_MARKS.items():
        icon = fn()
        icon.save(ui_dir / f"{key}.png")
        marks.append({"id": key, "name": name, "file": f"ui/{key}.png", "width": 16, "height": 16})
    ui_marks_sheet().save(ui_dir / "ui_marks.png")

    panel_nine_slice().save(ui_dir / "panel_9slice.png")

    branding = []
    for file_name, display_name, fn in (
        ("logo_red_frontier.png", "Primary wordmark", logo_red_frontier),
        ("logo_mission_mars.png", "Mission lockup", logo_mission_mars),
        ("patch_ares_survey.png", "Fictional Ares Survey patch", patch_ares_survey),
        ("wordmark_small.png", "Compact wordmark", wordmark_small),
    ):
        image = fn()
        image.save(brand_dir / file_name)
        branding.append(
            {
                "id": file_name.removesuffix(".png"),
                "name": display_name,
                "file": f"branding/{file_name}",
                "width": image.width,
                "height": image.height,
                "fictional": True,
            }
        )
    branding_sheet().save(brand_dir / "branding_sheet.png")

    meta = {
        "resourceIcons": resources,
        "roleBadges": roles,
        "marks": marks,
        "panel": {
            "file": "ui/panel_9slice.png",
            "width": 24,
            "height": 24,
            "border": 8,
            "note": "Use a 9-slice border of 8 px; corner pixels are transparent.",
        },
        "branding": branding,
        "usageNote": "Original RED FRONTIER interface art. No NASA logo, typeface, patch or icon is reproduced.",
    }
    (out_root / "ui" / "ui.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1] / "client" / "public" / "assets"
    data = write_ui(root)
    print(f"Wrote {len(data['resourceIcons'])} resources, {len(data['roleBadges'])} role badges, and branding to {root}")
