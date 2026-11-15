"""Original character art for RED FRONTIER.

All characters are fictional. Sheets are authored at 24×32 per frame, six frames per
direction, with genuinely transparent backgrounds and material-aware 1 px outlines.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from pixel import (
    C,
    Canvas,
    P,
    colored_external_outline,
    darken,
    draw_text,
    lighten,
    mix,
    text_width,
)

FRAME_W = 24
FRAME_H = 32
DIRECTIONS = ("down", "left", "right", "up")


@dataclass(frozen=True)
class FrameState:
    bob: int
    blink: bool
    stride: int  # -1, 0, 1
    pass_frame: bool = False


FRAME_STATES = (
    FrameState(0, False, 0),
    FrameState(1, True, 0),
    FrameState(0, False, 1),
    FrameState(1, False, 0, True),
    FrameState(0, False, -1),
    FrameState(1, False, 0, True),
)


@dataclass(frozen=True)
class Character:
    id: str
    name: str
    short_name: str
    role: str
    file_stem: str
    skin: str
    skin_hi: str
    skin_shadow: str
    skin_dark: str
    hair: str
    hair_hi: str
    hair_dark: str
    eye: str
    top: str
    top_hi: str
    top_dark: str
    sleeve: str
    sleeve_hi: str
    pants: str
    pants_hi: str
    pants_dark: str
    boots: str
    boots_hi: str
    accent: str
    accent_dark: str
    trim: str
    role_color: str
    role_color_dark: str


CHARACTERS: dict[str, Character] = {
    "nia": Character(
        id="nia",
        name="Nia Okafor",
        short_name="NIA",
        role="Aerospace Engineer",
        file_stem="nia_okafor",
        skin="skin4",
        skin_hi="skin4_h",
        skin_shadow="skin4_s",
        skin_dark="skin4_d",
        hair="hair_black",
        hair_hi="hair_black_hi",
        hair_dark="hair_black_dark",
        eye="eye_amber",
        top="coverall",
        top_hi="coverall_light",
        top_dark="coverall_dark",
        sleeve="coverall",
        sleeve_hi="coverall_light",
        pants="coverall_dark",
        pants_hi="coverall",
        pants_dark="rust_deep",
        boots="navy1",
        boots_hi="steel_dark",
        accent="yellow",
        accent_dark="gold",
        trim="steel_light",
        role_color="orange",
        role_color_dark="rust_dark",
    ),
    "ren": Character(
        id="ren",
        name="Ren Ito",
        short_name="REN",
        role="Mars Satellite Controller",
        file_stem="ren_ito",
        skin="skin2",
        skin_hi="skin2_h",
        skin_shadow="skin2_s",
        skin_dark="skin2_d",
        hair="hair_black",
        hair_hi="hair_black_hi",
        hair_dark="hair_black_dark",
        eye="eye_teal",
        top="teal",
        top_hi="teal_light",
        top_dark="teal_dark",
        sleeve="teal",
        sleeve_hi="teal_light",
        pants="navy2",
        pants_hi="navy3",
        pants_dark="navy1",
        boots="navy0",
        boots_hi="navy3",
        accent="cyan",
        accent_dark="cyan_dark",
        trim="cream",
        role_color="teal",
        role_color_dark="teal_dark",
    ),
    "val": Character(
        id="val",
        name="Valeria Ruiz",
        short_name="VAL",
        role="Finance Administrator",
        file_stem="val_ruiz",
        skin="skin2",
        skin_hi="skin2_h",
        skin_shadow="skin2_s",
        skin_dark="skin2_d",
        hair="hair_brown",
        hair_hi="hair_brown_hi",
        hair_dark="hair_brown_dark",
        eye="eye_amber",
        top="cream",
        top_hi="white",
        top_dark="cream_dark",
        sleeve="cream",
        sleeve_hi="white",
        pants="navy2",
        pants_hi="navy3",
        pants_dark="navy1",
        boots="navy1",
        boots_hi="steel_dark",
        accent="coin",
        accent_dark="gold",
        trim="wine_light",
        role_color="wine",
        role_color_dark="wine_vest_dark",
    ),
    "samir": Character(
        id="samir",
        name="Samir Haddad",
        short_name="SAMIR",
        role="Mission Designer",
        file_stem="samir_haddad",
        skin="skin3",
        skin_hi="skin3_h",
        skin_shadow="skin3_s",
        skin_dark="skin3_d",
        hair="hair_brown",
        hair_hi="hair_brown_hi",
        hair_dark="hair_brown_dark",
        eye="eye_amber",
        top="slate_vest",
        top_hi="slate_vest_light",
        top_dark="slate_vest_dark",
        sleeve="cream",
        sleeve_hi="white",
        pants="khaki",
        pants_hi="beige",
        pants_dark="khaki_dark",
        boots="hair_brown_dark",
        boots_hi="hair_brown",
        accent="orange",
        accent_dark="rust_dark",
        trim="teal_light",
        role_color="slate_vest",
        role_color_dark="slate_vest_dark",
    ),
    "voss": Character(
        id="voss",
        name="Dr. Miriam Voss",
        short_name="DR. VOSS",
        role="Mission Scientist",
        file_stem="dr_miriam_voss",
        skin="skin1",
        skin_hi="skin1_h",
        skin_shadow="skin1_s",
        skin_dark="skin1_d",
        hair="hair_silver",
        hair_hi="hair_silver_hi",
        hair_dark="hair_silver_dark",
        eye="eye_teal",
        top="lab_coat",
        top_hi="white",
        top_dark="lab_coat_shadow",
        sleeve="lab_coat",
        sleeve_hi="white",
        pants="wine_vest_dark",
        pants_hi="wine_vest",
        pants_dark="ink_soft",
        boots="navy1",
        boots_hi="steel_dark",
        accent="teal",
        accent_dark="teal_dark",
        trim="teal",
        role_color="teal",
        role_color_dark="teal_dark",
    ),
}


# ---------------------------------------------------------------------------
# Shared construction helpers
# ---------------------------------------------------------------------------


def _seam(c: Canvas, color: str, points: list[tuple[int, int]]) -> None:
    for x, y in points:
        c.set(x, y, color)


def _draw_legs_down(c: Canvas, ch: Character, st: FrameState) -> None:
    lift_l = 1 if st.stride > 0 else 0
    lift_r = 1 if st.stride < 0 else 0
    # A four-pixel stance gap keeps both boots readable after the outline pass.
    for x, lift in ((6, lift_l), (14, lift_r)):
        h = 5 if lift else 6
        c.rect(x, 23, 4, h, ch.pants)
        c.vline(x + 1, 24, h - 1, ch.pants_hi)
        c.vline(x + 3, 24, h - 1, ch.pants_dark)
        c.rect(x, 28, 4, 1, ch.boots_hi)
        c.rect(x, 29, 4, 2, ch.boots)
        c.rect(x, 29, 3, 1, ch.boots_hi)
        c.rect(x, 30, 4, 1, darken(ch.boots, 0.76))
        c.set(x + 1, 28, ch.boots_hi)
    # Trouser crease and boot cuffs.
    _seam(c, ch.pants_hi, [(8, 24), (16, 24)])
    if ch.id in ("nia", "ren", "voss"):
        _seam(c, ch.trim, [(7, 28), (7, 29)])


def _draw_arm_down(c: Canvas, ch: Character, side: int, y_shift: int, sleeve_color: str) -> None:
    """side=-1 viewer-left, +1 viewer-right."""
    x = 4 if side < 0 else 17
    y = 15 + y_shift
    c.rect(x, y + 1, 3, 7, sleeve_color)
    c.vline(x + (0 if side < 0 else 2), y + 2, 6, ch.sleeve_hi if sleeve_color == ch.sleeve else lighten(sleeve_color, 1.08))
    c.vline(x + (2 if side < 0 else 0), y + 2, 6, ch.top_dark if sleeve_color == ch.sleeve else darken(sleeve_color, 0.7))
    c.rect(x + (0 if side < 0 else 1), y + 8, 2, 1, ch.skin_shadow)
    c.set(x + (1 if side < 0 else 2), y + 8, ch.skin)


def _draw_torso_down(c: Canvas, ch: Character, bob: int) -> None:
    y = 14 + bob
    # dark edge, inner body
    c.polygon([(6, y + 1), (17, y + 1), (18, y + 3), (17, y + 9), (7, y + 9), (6, y + 3)], ch.top_dark)
    c.polygon([(7, y + 1), (16, y + 1), (17, y + 3), (16, y + 8), (8, y + 8), (7, y + 3)], ch.top)
    # shoulder light and side shadows
    _seam(c, ch.top_hi, [(8, y + 2), (9, y + 2), (10, y + 2)])
    _seam(c, ch.top_dark, [(16, y + 3), (16, y + 4), (15, y + 8)])
    if ch.id == "nia":
        c.rect(8, y + 1, 2, 1, ch.top_hi)
        c.vline(12, y + 2, 7, ch.trim)
        c.vline(11, y + 2, 6, ch.top_dark)
        c.rect(8, y + 4, 3, 1, ch.accent_dark)
        c.rect(8, y + 5, 2, 1, ch.accent)
        c.rect(14, y + 4, 2, 1, ch.top_hi)
        c.rect(15, y + 5, 1, 1, ch.accent)
        # belt and buckle
        c.rect(7, y + 8, 10, 1, ch.navy if hasattr(ch, "navy") else "navy1")
        c.rect(11, y + 8, 2, 1, ch.accent)
        c.set(9, y + 8, ch.trim)
    elif ch.id == "ren":
        # zip and field-jacket panel
        c.rect(9, y + 1, 1, 2, ch.trim)
        c.rect(14, y + 1, 1, 2, ch.trim)
        c.vline(11, y + 3, 6, ch.top_dark)
        c.vline(12, y + 3, 6, ch.trim)
        c.rect(14, y + 5, 2, 2, ch.accent_dark)
        c.set(15, y + 5, ch.accent)
        c.rect(7, y + 8, 10, 1, ch.top_dark)
        c.set(8, y + 8, ch.accent)
        c.set(9, y + 8, ch.accent_dark)
    elif ch.id == "val":
        # wine waistcoat over an ivory blouse; the waist must read at 1×
        c.polygon([(7, y + 1), (17, y + 1), (17, y + 8), (7, y + 8)], "wine_vest")
        c.polygon([(10, y + 1), (13, y + 1), (13, y + 4), (12, y + 7), (11, y + 7), (10, y + 4)], ch.top)
        c.rect(10, y + 1, 4, 1, ch.top_hi)
        c.vline(7, y + 2, 5, "wine_vest_light")
        c.vline(16, y + 2, 5, ch.top_dark)
        c.set(9, y + 1, "wine_vest_light")
        c.set(15, y + 1, "wine_vest_light")
        c.set(10, y + 4, ch.accent)
        c.set(13, y + 5, ch.accent)
        c.set(10, y + 6, ch.accent_dark)
        c.set(14, y + 2, "wine_vest_light")
        c.rect(7, y + 8, 10, 1, "navy1")
        c.set(12, y + 8, ch.accent)
        # soft blouse collar and necklace
        c.set(9, y + 1, ch.top_hi)
        c.set(15, y + 1, ch.top_hi)
        c.set(11, y + 2, ch.accent)
        c.set(12, y + 3, ch.accent_dark)
    elif ch.id == "samir":
        # cream shirt with slate utility vest
        c.rect(10, y + 1, 4, 8, ch.sleeve)
        c.polygon([(7, y + 1), (10, y + 1), (10, y + 7), (7, y + 8)], ch.top)
        c.polygon([(14, y + 1), (17, y + 1), (17, y + 8), (14, y + 7)], ch.top)
        c.rect(10, y + 1, 4, 1, ch.sleeve_hi)
        c.vline(10, y + 2, 6, ch.top_dark)
        c.vline(14, y + 2, 6, ch.top_dark)
        c.rect(8, y + 5, 2, 1, ch.accent)
        c.set(9, y + 6, ch.top_hi)
        c.set(15, y + 6, ch.top_hi)
        c.rect(7, y + 8, 10, 1, ch.top_dark)
    elif ch.id == "voss":
        # long lab coat, visible teal turtleneck
        c.rect(10, y, 4, 3, ch.accent)
        c.rect(10, y, 4, 1, ch.accent_dark)
        c.vline(12, y + 3, 6, ch.top_dark)
        c.set(9, y + 4, ch.top_dark)
        c.set(9, y + 6, ch.top_dark)
        c.set(14, y + 4, ch.top_dark)
        c.rect(8, y + 4, 3, 1, ch.top_hi)
        c.rect(7, y + 8, 10, 1, ch.top_dark)
        c.set(15, y + 5, ch.accent_dark)
        c.set(15, y + 6, ch.accent_dark)


def _draw_face_down(c: Canvas, ch: Character, bob: int) -> None:
    y = bob
    # ears
    c.rect(5, 8 + y, 2, 3, ch.skin_shadow)
    c.set(5, 9 + y, ch.skin)
    c.rect(17, 8 + y, 2, 3, ch.skin_shadow)
    c.set(18, 9 + y, ch.skin)
    # head base
    c.polygon(
        [(7, 5 + y), (16, 5 + y), (17, 7 + y), (17, 11 + y), (15, 14 + y), (9, 14 + y), (7, 12 + y)],
        ch.skin,
    )
    # top light and side shadow
    c.rect(8, 6 + y, 5, 1, ch.skin_hi)
    _seam(c, ch.skin_shadow, [(16, 7 + y), (16, 8 + y), (16, 9 + y), (16, 10 + y), (15, 11 + y)])
    _seam(c, ch.skin_shadow, [(10, 13 + y), (11, 13 + y), (12, 13 + y), (13, 13 + y)])
    c.set(9, 13 + y, ch.skin_shadow)
    c.set(14, 13 + y, ch.skin_shadow)
    # brows
    brow = ch.hair_dark
    c.rect(8, 7 + y, 3, 1, brow)
    c.rect(13, 7 + y, 3, 1, brow)
    # eyes
    if (18 + y) <= 31:
        pass
    if ch.id == "samir":
        # stronger brows and short, neat beard along the jaw
        c.set(8, 6 + y, brow)
        c.set(14, 6 + y, brow)
        c.set(7, 11 + y, ch.hair_dark)
        c.set(7, 12 + y, ch.hair_dark)
        c.set(16, 11 + y, ch.hair_dark)
        c.set(16, 12 + y, ch.hair_dark)
        c.set(9, 13 + y, ch.hair_dark)
        c.set(14, 13 + y, ch.hair_dark)
        c.set(10, 14 + y, ch.hair_dark)
        c.set(13, 14 + y, ch.hair_dark)
    # nose / mouth
    c.set(11, 11 + y, ch.skin_shadow)
    c.set(12, 11 + y, ch.skin_shadow)
    c.rect(10, 12 + y, 3, 1, "mouth")
    c.set(10, 12 + y, "mouth_dark")
    if ch.id == "samir":
        c.set(13, 12 + y, "mouth_dark")
    # subtle cheek highlights
    c.set(8, 10 + y, ch.skin_hi)
    c.set(15, 10 + y, ch.skin_hi)


def _draw_eyes_down(c: Canvas, ch: Character, bob: int, blink: bool) -> None:
    y = bob
    if blink:
        c.rect(7, 9 + y, 3, 1, ch.skin_shadow)
        c.rect(14, 9 + y, 3, 1, ch.skin_shadow)
        return
    # Three-pixel stylised eyes: sclera, iris, sclera. No anti-aliasing.
    for x in (7, 14):
        c.set(x, 9 + y, "white")
        c.set(x + 1, 9 + y, ch.eye)
        c.set(x + 2, 9 + y, "white")
        c.set(x + 1, 10 + y, ch.skin_shadow)
    # A single upper-lash pixel keeps the gaze grounded without a heavy outline.
    c.set(8, 8 + y, ch.skin_shadow)
    c.set(15, 8 + y, ch.skin_shadow)


def _hair_cap_down(c: Canvas, ch: Character, y: int) -> None:
    """Draw role-specific hair over the standard head shape."""
    if ch.id == "nia":
        # short twists: crown bumps, close sides
        c.rect(6, 2 + y, 12, 5, ch.hair)
        c.rect(7, 1 + y, 2, 1, ch.hair)
        c.rect(11, 1 + y, 2, 1, ch.hair)
        c.rect(15, 1 + y, 2, 1, ch.hair)
        c.rect(5, 4 + y, 1, 3, ch.hair)
        c.rect(18, 4 + y, 1, 2, ch.hair)
        c.rect(6, 6 + y, 2, 2, ch.hair_dark)
        c.rect(16, 6 + y, 2, 2, ch.hair_dark)
        # forehead fringe
        c.rect(7, 6 + y, 3, 1, ch.hair_dark)
        c.rect(13, 6 + y, 4, 1, ch.hair_dark)
        c.set(10, 6 + y, ch.hair)
        c.set(12, 6 + y, ch.hair)
        _seam(c, ch.hair_hi, [(8, 3 + y), (9, 3 + y), (10, 3 + y), (14, 3 + y)])
        c.set(7, 2 + y, ch.hair_hi)
        c.set(13, 2 + y, ch.hair_hi)
        # ends of twists
        c.set(6, 7 + y, ch.hair_dark)
        c.set(17, 7 + y, ch.hair_dark)
    elif ch.id == "ren":
        # undercut with a swept fringe
        c.rect(6, 2 + y, 12, 5, ch.hair)
        c.polygon([(6, 3 + y), (7, 2 + y), (15, 2 + y), (17, 4 + y), (17, 6 + y), (14, 6 + y), (16, 4 + y), (13, 5 + y), (9, 6 + y), (7, 6 + y), (6, 5 + y)], ch.hair)
        c.rect(17, 6 + y, 1, 2, ch.hair_dark)
        c.rect(6, 6 + y, 1, 2, ch.hair_dark)
        c.rect(12, 6 + y, 5, 1, ch.hair)
        _seam(c, ch.hair_hi, [(9, 3 + y), (10, 3 + y), (11, 3 + y), (14, 3 + y), (8, 4 + y)])
        c.set(15, 4 + y, ch.hair_hi)
        c.set(6, 3 + y, ch.hair)
    elif ch.id == "val":
        # elegant high bun and side-swept waves
        c.rect(13, 0 + y, 4, 2, ch.hair_dark)
        c.rect(14, 0 + y, 3, 1, ch.hair)
        c.rect(6, 2 + y, 12, 5, ch.hair)
        c.rect(16, 2 + y, 2, 7, ch.hair_dark)
        c.rect(6, 5 + y, 2, 5, ch.hair_dark)
        c.rect(17, 3 + y, 1, 5, ch.hair)
        c.rect(7, 6 + y, 4, 1, ch.hair_dark)
        c.rect(14, 6 + y, 3, 1, ch.hair_dark)
        c.set(12, 6 + y, ch.hair)
        _seam(c, ch.hair_hi, [(8, 3 + y), (9, 3 + y), (10, 3 + y), (15, 2 + y), (16, 3 + y)])
        c.set(13, 2 + y, ch.hair_hi)
        c.set(7, 4 + y, ch.hair_dark)
        c.set(14, 1 + y, ch.hair_hi)
    elif ch.id == "samir":
        # textured curls, short fade, beard is drawn with the face
        c.rect(6, 2 + y, 12, 5, ch.hair)
        for x, yy in ((7, 1), (9, 0), (12, 1), (15, 1), (16, 2), (6, 3)):
            c.rect(x, yy + y, 2, 2, ch.hair)
        c.rect(17, 6 + y, 1, 2, ch.hair_dark)
        c.rect(6, 6 + y, 1, 3, ch.hair_dark)
        c.rect(7, 6 + y, 3, 1, ch.hair_dark)
        c.rect(13, 6 + y, 4, 1, ch.hair_dark)
        _seam(c, ch.hair_hi, [(8, 2 + y), (11, 2 + y), (14, 3 + y), (9, 1 + y)])
        c.set(12, 0 + y, ch.hair_hi)
    elif ch.id == "voss":
        # silver bob, fringe, hair tucked behind ears in front view
        c.rect(6, 2 + y, 12, 5, ch.hair)
        c.rect(5, 4 + y, 2, 8, ch.hair_dark)
        c.rect(17, 4 + y, 2, 8, ch.hair_dark)
        c.rect(6, 6 + y, 12, 1, ch.hair_dark)
        c.rect(7, 6 + y, 4, 1, ch.hair)
        c.rect(13, 6 + y, 4, 1, ch.hair)
        c.set(11, 6 + y, ch.hair)
        c.set(12, 6 + y, ch.hair)
        c.rect(5, 9 + y, 1, 3, ch.hair)
        c.rect(18, 9 + y, 1, 3, ch.hair)
        _seam(c, ch.hair_hi, [(8, 3 + y), (9, 3 + y), (10, 3 + y), (15, 3 + y)])
        c.set(7, 2 + y, ch.hair_hi)
        c.set(13, 2 + y, ch.hair_hi)
        c.rect(5, 11 + y, 1, 1, ch.hair_hi)
        c.rect(18, 11 + y, 1, 1, ch.hair_hi)


# ---------------------------------------------------------------------------
# Down / up
# ---------------------------------------------------------------------------


def _draw_face_details_down(c: Canvas, ch: Character, st: FrameState) -> None:
    _draw_face_down(c, ch, st.bob)
    _draw_eyes_down(c, ch, st.bob, st.blink)


def _draw_accessories_down(c: Canvas, ch: Character, st: FrameState) -> None:
    y = st.bob
    if ch.id == "nia":
        # safety goggles on forehead, reflective cuff stripes, tool belt
        c.rect(6, 4 + y, 12, 1, "ink_soft")
        c.rect(7, 4 + y, 4, 2, ch.accent_dark)
        c.rect(8, 4 + y, 2, 2, "teal_dark")
        c.set(8, 4 + y, "cyan")
        c.rect(13, 4 + y, 3, 2, ch.accent_dark)
        c.rect(14, 4 + y, 1, 2, "teal_dark")
        c.rect(4, 19 + y, 3, 1, ch.accent)
        c.rect(17, 19 + y, 3, 1, ch.accent)
        c.rect(7, 22 + y, 10, 1, "navy0")
        c.set(11, 22 + y, ch.accent)
        c.set(12, 22 + y, ch.accent_dark)
        c.rect(17, 21 + y, 2, 3, "steel_dark")
        c.set(18, 21 + y, "steel_light")
        c.rect(8, 23 + y, 1, 1, ch.accent_dark)
    elif ch.id == "ren":
        # headset band, ear cups, boom mic, glasses
        c.vline(5, 4 + y, 5, "ink_soft")
        c.vline(18, 4 + y, 5, "ink_soft")
        c.rect(3, 8 + y, 3, 4, "ink_soft")
        c.rect(4, 9 + y, 2, 2, ch.accent_dark)
        c.set(4, 9 + y, ch.accent)
        c.rect(18, 8 + y, 3, 4, "ink_soft")
        c.rect(18, 9 + y, 2, 2, ch.accent_dark)
        c.set(19, 9 + y, ch.accent)
        c.line(5, 12 + y, 8, 13 + y, "ink_soft")
        c.rect(8, 13 + y, 2, 1, ch.accent_dark)
        c.set(8, 13 + y, ch.accent)
        _seam(c, ch.accent, [(4, 20 + y), (18, 20 + y)])
        c.rect(7, 22 + y, 10, 1, "navy1")
    elif ch.id == "val":
        # gold earrings, tablet in left hand, pen at collar
        c.set(4, 11 + y, ch.accent)
        c.set(19, 11 + y, ch.accent)
        # tablet held low at the left side
        c.rect(2, 19 + y, 4, 5, "ink_soft")
        c.rect(3, 20 + y, 2, 3, "navy1")
        c.rect(3, 20 + y, 2, 1, ch.accent_dark)
        c.set(3, 21 + y, ch.accent)
        c.set(4, 21 + y, ch.accent)
        c.rect(3, 23 + y, 2, 1, "teal_dark")
        c.set(12, 20 + y, "white")
        c.set(12, 21 + y, "ink_soft")
        c.rect(7, 22 + y, 10, 1, "navy1")
    elif ch.id == "samir":
        # orange mission lanyard with ID, notebook, rolled map edging
        c.line(8, 16 + y, 12, 21 + y, ch.accent)
        c.line(16, 16 + y, 12, 21 + y, ch.accent_dark)
        c.rect(10, 21 + y, 4, 2, "white")
        c.rect(10, 21 + y, 4, 1, "teal")
        c.set(11, 22 + y, "ink_soft")
        c.rect(14, 17 + y, 1, 2, ch.trim)
        c.rect(18, 20 + y, 2, 3, ch.trim)
        c.set(18, 20 + y, "cream_dark")
        c.rect(7, 22 + y, 10, 1, ch.hair_brown_dark if hasattr(ch, "hair_brown_dark") else "hair_brown_dark")
    elif ch.id == "voss":
        # reading glasses live in the larger portrait; at world scale the
        # silver bob and teal identity remain cleaner without a second frame.
        c.set(4, 11 + y, ch.accent_dark)
        c.rect(14, 17 + y, 2, 2, "white")
        c.rect(14, 17 + y, 2, 1, ch.accent)
        c.rect(2, 18 + y, 4, 6, "ink_soft")
        c.rect(3, 19 + y, 2, 4, "cream")
        c.rect(3, 19 + y, 2, 1, "steel")
        c.set(13, 20 + y, ch.accent_dark)
        c.rect(7, 22 + y, 10, 1, ch.top_dark)


def draw_down(c: Canvas, ch: Character, st: FrameState) -> None:
    bob = st.bob
    # Long lab coats are drawn behind the legs.
    if ch.id == "voss":
        c.rect(6, 20 + bob, 12, 7, ch.top_dark)
        c.rect(7, 20 + bob, 10, 6, ch.top)
        c.vline(12, 21 + bob, 5, ch.top_dark)
        c.rect(7, 26 + bob, 10, 1, ch.top_hi)
    _draw_legs_down(c, ch, st)
    # Arms are behind torso roots; one arm counter-swings on contact frames.
    arm_l = -1 if st.stride > 0 else (1 if st.stride < 0 else 0)
    arm_r = -arm_l
    _draw_arm_down(c, ch, -1, bob + arm_l, ch.sleeve)
    _draw_arm_down(c, ch, 1, bob + arm_r, ch.sleeve)
    _draw_torso_down(c, ch, bob)
    # Belt overlays waist; long-coat wearers get a narrow waistband.
    if ch.id == "voss":
        c.rect(7, 22 + bob, 10, 1, ch.pants)
    # neck
    c.rect(10, 13 + bob, 4, 2, ch.skin_shadow)
    c.rect(10, 13 + bob, 2, 1, ch.skin)
    # head
    _draw_face_details_down(c, ch, st)
    _hair_cap_down(c, ch, bob)
    _draw_accessories_down(c, ch, st)
    # tuning accents applied by uniform
    if ch.id == "nia":
        c.rect(5, 17 + bob, 1, 5, ch.top_dark)
        c.rect(18, 17 + bob, 1, 5, ch.top_dark)
    if ch.id == "val":
        c.rect(6, 16 + bob, 1, 6, ch.sleeve_hi)
        c.rect(17, 16 + bob, 1, 6, ch.sleeve_hi)
    if ch.id == "samir":
        # rolled sleeves expose forearms
        c.rect(4, 21 + bob, 3, 2, ch.skin_shadow)
        c.rect(17, 21 + bob, 3, 2, ch.skin_shadow)
        c.rect(4, 21 + bob, 2, 1, ch.skin)
        c.rect(18, 21 + bob, 1, 1, ch.skin)
    if ch.id == "voss":
        # long coat hem over hips
        c.rect(6, 24 + bob, 12, 3, ch.top)
        c.rect(6, 26 + bob, 12, 1, ch.top_dark)
        c.vline(12, 24 + bob, 3, ch.top_dark)


def draw_up(c: Canvas, ch: Character, st: FrameState) -> None:
    bob = st.bob
    lift_l = 1 if st.stride > 0 else 0
    lift_r = 1 if st.stride < 0 else 0
    # back legs; keep a clear stance gap for readability from above
    for x, lift in ((6, lift_l), (14, lift_r)):
        h = 5 if lift else 6
        c.rect(x, 23, 4, h, ch.pants)
        c.vline(x + 1, 24, h - 1, ch.pants_hi)
        c.vline(x + 3, 24, h - 1, ch.pants_dark)
        c.rect(x, 28, 4, 1, ch.boots_hi)
        c.rect(x, 29, 4, 2, ch.boots)
        c.rect(x, 30, 4, 1, darken(ch.boots, 0.76))
    # far arms, torso, near arm roots
    arm_l = 1 if st.stride > 0 else (-1 if st.stride < 0 else 0)
    arm_r = -arm_l
    for side, shift in ((-1, arm_l), (1, arm_r)):
        x = 4 if side < 0 else 17
        y = 15 + bob + shift
        c.rect(x, y + 1, 3, 7, ch.sleeve)
        c.vline(x + (0 if side < 0 else 2), y + 2, 6, ch.sleeve_hi)
        c.rect(x + (0 if side < 0 else 1), y + 8, 2, 1, ch.skin_shadow)
    y = 14 + bob
    c.polygon([(6, y + 1), (17, y + 1), (18, y + 3), (17, y + 9), (7, y + 9), (6, y + 3)], ch.top_dark)
    c.polygon([(7, y + 1), (16, y + 1), (17, y + 3), (16, y + 8), (8, y + 8), (7, y + 3)], ch.top)
    _seam(c, ch.top_hi, [(8, y + 2), (9, y + 2), (10, y + 2)])
    _seam(c, ch.top_dark, [(16, y + 3), (16, y + 4), (15, y + 8)])
    # back seams / belts
    if ch.id == "nia":
        c.rect(8, y + 3, 1, 4, ch.top_dark)
        c.rect(15, y + 3, 1, 4, ch.top_dark)
        c.rect(7, y + 7, 10, 2, "navy1")
        c.set(10, y + 7, ch.accent)
        c.set(14, y + 7, ch.accent)
        c.rect(12, y + 4, 1, 2, ch.trim)
    elif ch.id == "ren":
        c.rect(9, y + 1, 1, 2, ch.trim)
        c.rect(14, y + 1, 1, 2, ch.trim)
        c.rect(7, y + 8, 10, 1, ch.top_dark)
        # comms pack
        c.rect(14, y + 3, 4, 5, "ink_soft")
        c.rect(15, y + 4, 2, 3, "navy1")
        c.set(16, y + 4, ch.accent)
        c.rect(15, y + 8, 2, 1, ch.top_dark)
    elif ch.id == "val":
        # waistcoat back with ivory sleeve caps
        c.rect(8, y + 1, 8, 7, "wine_vest")
        c.rect(7, y + 1, 2, 7, ch.sleeve)
        c.rect(15, y + 1, 2, 7, ch.sleeve)
        c.vline(12, y + 2, 6, "wine_vest_dark")
        c.rect(9, y + 1, 6, 1, "wine_vest_light")
        c.set(8, y + 4, "wine_vest_light")
        c.set(16, y + 6, "wine_vest_dark")
        c.rect(7, y + 8, 10, 1, "navy1")
        c.set(12, y + 8, ch.accent)
    elif ch.id == "samir":
        c.rect(10, y + 1, 4, 7, ch.sleeve)
        c.rect(7, y + 1, 3, 7, ch.top)
        c.rect(14, y + 1, 3, 7, ch.top)
        c.vline(10, y + 2, 6, ch.top_dark)
        c.vline(14, y + 2, 6, ch.top_dark)
        c.rect(7, y + 8, 10, 1, ch.top_dark)
        # satchel and map tube
        c.line(15, y + 2, 8, y + 8, ch.accent_dark)
        c.rect(4, y + 4, 5, 5, "khaki_dark")
        c.rect(5, y + 4, 4, 4, "khaki")
        c.rect(5, y + 3, 3, 1, "cream_dark")
        c.set(5, y + 3, ch.accent)
        c.rect(16, y + 3, 2, 5, "cream_dark")
        c.set(16, y + 3, ch.trim)
    elif ch.id == "voss":
        c.rect(7, y + 1, 10, 1, ch.top_hi)
        c.rect(11, y + 2, 2, 7, ch.accent_dark)
        c.vline(12, y + 2, 6, ch.top_dark)
        c.rect(8, y + 4, 2, 1, ch.top_dark)
        c.rect(7, y + 8, 10, 1, ch.top_dark)
    # neck nape and head
    c.rect(10, 13 + bob, 4, 2, ch.skin_shadow)
    c.rect(10, 13 + bob, 2, 1, ch.skin)
    # head silhouette: mostly hair from the back
    c.ellipse(12, 8 + bob, 5.8, 6.4, ch.skin_shadow)
    c.rect(7, 4 + bob, 10, 5, ch.skin)
    c.rect(10, 13 + bob, 4, 1, ch.skin_shadow)
    # ears
    c.rect(5, 8 + bob, 2, 3, ch.skin_shadow)
    c.set(5, 9 + bob, ch.skin)
    c.rect(17, 8 + bob, 2, 3, ch.skin_shadow)
    c.set(18, 9 + bob, ch.skin)
    _hair_back(c, ch, bob)
    _accessories_up(c, ch, st)
    # global coat / body finishing
    if ch.id in ("nia", "ren"):
        c.rect(5, 17 + bob, 1, 5, ch.top_dark)
        c.rect(18, 17 + bob, 1, 5, ch.top_dark)
    if ch.id == "voss":
        c.rect(6, 22 + bob, 12, 3, ch.top)
        c.vline(12, 22 + bob, 3, ch.top_dark)
        c.rect(6, 25 + bob, 12, 1, ch.top_dark)


def _hair_back(c: Canvas, ch: Character, bob: int) -> None:
    y = bob
    if ch.id == "nia":
        c.rect(6, 2 + y, 12, 7, ch.hair)
        c.rect(7, 1 + y, 2, 1, ch.hair)
        c.rect(11, 1 + y, 2, 1, ch.hair)
        c.rect(15, 1 + y, 2, 1, ch.hair)
        c.rect(5, 5 + y, 1, 3, ch.hair_dark)
        c.rect(18, 5 + y, 1, 2, ch.hair_dark)
        c.rect(6, 8 + y, 12, 3, ch.hair_dark)
        _seam(c, ch.hair_hi, [(8, 3 + y), (11, 4 + y), (14, 3 + y)])
        c.rect(8, 9 + y, 2, 1, ch.hair)
        c.rect(14, 9 + y, 2, 1, ch.hair)
        c.set(12, 2 + y, ch.hair_hi)
    elif ch.id == "ren":
        c.rect(6, 2 + y, 12, 7, ch.hair)
        c.rect(6, 8 + y, 12, 3, ch.hair_dark)
        c.rect(7, 9 + y, 10, 1, ch.hair)
        c.rect(17, 6 + y, 1, 3, ch.hair_dark)
        _seam(c, ch.hair_hi, [(9, 3 + y), (10, 3 + y), (11, 4 + y), (14, 3 + y)])
        c.set(12, 2 + y, ch.hair_hi)
        # headset band and cups from behind
        c.vline(5, 5 + y, 4, "ink_soft")
        c.vline(18, 5 + y, 4, "ink_soft")
        c.rect(3, 8 + y, 3, 4, "ink_soft")
        c.rect(4, 9 + y, 2, 2, ch.accent_dark)
        c.set(4, 9 + y, ch.accent)
        c.rect(18, 8 + y, 3, 4, "ink_soft")
        c.rect(18, 9 + y, 2, 2, ch.accent_dark)
        c.set(19, 9 + y, ch.accent)
    elif ch.id == "val":
        c.rect(13, 0 + y, 4, 2, ch.hair_dark)
        c.rect(14, 0 + y, 3, 1, ch.hair)
        c.rect(6, 2 + y, 12, 7, ch.hair)
        c.rect(6, 8 + y, 12, 2, ch.hair_dark)
        c.rect(17, 3 + y, 1, 6, ch.hair_dark)
        c.rect(6, 4 + y, 1, 6, ch.hair_dark)
        _seam(c, ch.hair_hi, [(8, 3 + y), (9, 3 + y), (12, 4 + y), (15, 3 + y), (16, 2 + y)])
        c.rect(7, 8 + y, 2, 1, ch.hair)
        c.set(13, 2 + y, ch.hair_hi)
    elif ch.id == "samir":
        c.rect(6, 2 + y, 12, 6, ch.hair)
        for x, yy in ((7, 1), (9, 0), (12, 1), (15, 1), (16, 2), (6, 3)):
            c.rect(x, yy + y, 2, 2, ch.hair)
        c.rect(6, 7 + y, 12, 3, ch.hair_dark)
        c.rect(7, 8 + y, 10, 1, ch.hair)
        _seam(c, ch.hair_hi, [(8, 2 + y), (10, 1 + y), (13, 2 + y), (15, 3 + y)])
        c.set(11, 2 + y, ch.hair_hi)
    elif ch.id == "voss":
        c.rect(6, 2 + y, 12, 6, ch.hair)
        c.rect(5, 4 + y, 2, 10, ch.hair_dark)
        c.rect(17, 4 + y, 2, 10, ch.hair_dark)
        c.rect(6, 7 + y, 12, 4, ch.hair_dark)
        c.rect(7, 8 + y, 10, 2, ch.hair)
        c.rect(6, 11 + y, 12, 1, ch.hair)
        _seam(c, ch.hair_hi, [(8, 3 + y), (9, 3 + y), (13, 4 + y), (15, 3 + y)])
        c.rect(5, 12 + y, 1, 1, ch.hair_hi)
        c.rect(18, 12 + y, 1, 1, ch.hair_hi)
        c.set(12, 2 + y, ch.hair_hi)


def _accessories_up(c: Canvas, ch: Character, st: FrameState) -> None:
    bob = st.bob
    y = bob
    if ch.id == "nia":
        c.rect(6, 3 + y, 12, 1, "ink_soft")
        c.rect(4, 19 + y, 3, 1, ch.accent)
        c.rect(17, 19 + y, 3, 1, ch.accent)
        c.rect(7, 22 + y, 10, 1, "navy0")
        c.set(11, 22 + y, ch.accent)
        c.set(12, 22 + y, ch.accent_dark)
        c.rect(16, 21 + y, 2, 3, "steel_dark")
        c.set(17, 21 + y, "steel_light")
    elif ch.id == "ren":
        c.set(15, 19 + y, ch.accent)
        c.set(16, 20 + y, ch.accent)
        c.rect(14, 21 + y, 4, 1, "ink_soft")
    elif ch.id == "val":
        c.set(4, 11 + y, ch.accent)
        c.set(19, 11 + y, ch.accent)
        c.rect(7, 22 + y, 10, 1, "navy1")
        c.set(12, 22 + y, ch.accent)
        c.set(13, 22 + y, ch.accent_dark)
    elif ch.id == "samir":
        c.rect(14, 17 + y, 3, 4, "cream_dark")
        c.set(14, 17 + y, ch.trim)
        c.set(15, 18 + y, ch.trim)
        c.rect(5, 18 + y, 3, 4, "khaki_dark")
        c.rect(6, 18 + y, 2, 3, "khaki")
        c.line(15, 16 + y, 8, 22 + y, ch.accent_dark)
    elif ch.id == "voss":
        c.rect(14, 18 + y, 2, 2, "white")
        c.rect(14, 18 + y, 2, 1, ch.accent)
        c.rect(7, 22 + y, 10, 1, ch.top_dark)


# ---------------------------------------------------------------------------
# Side view
# ---------------------------------------------------------------------------


def draw_side_left(c: Canvas, ch: Character, st: FrameState) -> None:
    bob = st.bob
    stride = st.stride
    far_leg_shift = 1 if stride > 0 else (-1 if stride < 0 else 0)
    near_leg_shift = -far_leg_shift
    far_arm_shift = -1 if stride > 0 else (1 if stride < 0 else 0)
    near_arm_shift = -far_arm_shift

    # coat tails behind
    if ch.id == "voss":
        c.rect(11, 19 + bob, 6, 7, ch.top_dark)
        c.rect(12, 19 + bob, 5, 6, ch.top)
        c.rect(15, 20 + bob, 1, 5, ch.top_dark)

    # far leg (behind)
    flx = 11 + far_leg_shift
    c.rect(flx, 23, 4, 6, darken(ch.pants, 0.82))
    c.rect(flx - 1, 29, 6, 2, darken(ch.boots, 0.82))
    c.set(flx, 29, darken(ch.boots_hi, 0.82))
    # near leg
    nlx = 7 + near_leg_shift
    c.rect(nlx, 23, 4, 6, ch.pants)
    c.vline(nlx + 1, 24, 5, ch.pants_hi)
    c.vline(nlx + 3, 24, 5, ch.pants_dark)
    c.rect(nlx - 1, 28, 6, 1, ch.boots_hi)
    c.rect(nlx - 1, 29, 6, 2, ch.boots)
    c.rect(nlx - 1, 30, 6, 1, ch.boots)
    # far arm
    fax = 11 + far_arm_shift
    c.rect(fax, 16 + bob, 3, 7, darken(ch.sleeve, 0.82))
    c.rect(fax, 23 + bob, 2, 1, ch.skin_shadow)
    # torso
    y = 14 + bob
    c.polygon([(7, y + 1), (16, y + 1), (17, y + 3), (16, y + 9), (8, y + 9), (6, y + 3)], ch.top_dark)
    c.polygon([(8, y + 1), (15, y + 1), (16, y + 3), (15, y + 8), (9, y + 8), (7, y + 3)], ch.top)
    _seam(c, ch.top_hi, [(9, y + 2), (10, y + 2), (11, y + 2)])
    c.vline(15, y + 3, 5, ch.top_dark)
    # near arm
    nax = 8 + near_arm_shift
    if ch.id in ("val", "voss"):
        # holding tablet or clipboard, elbow bent, near arm stays forward
        c.rect(7, 17 + bob, 3, 4, ch.sleeve)
        c.rect(6, 20 + bob, 3, 2, ch.skin_shadow)
        c.rect(6, 20 + bob, 2, 1, ch.skin)
    else:
        c.rect(nax, 16 + bob, 3, 7, ch.sleeve)
        c.vline(nax, 17 + bob, 5, ch.sleeve_hi)
        c.rect(nax - 1, 23 + bob, 2, 1, ch.skin_shadow)
    # torso uniform details
    _side_uniform(c, ch, bob, y)
    # neck
    c.rect(9, 13 + bob, 4, 2, ch.skin_shadow)
    c.rect(9, 13 + bob, 3, 1, ch.skin)
    # head profile
    _profile_head(c, ch, st)
    # backpack / accessories that sit behind shoulder
    _side_accessories(c, ch, st)


def _side_uniform(c: Canvas, ch: Character, bob: int, y: int) -> None:
    if ch.id == "nia":
        c.vline(11, y + 2, 6, ch.trim)
        c.rect(9, y + 7, 3, 1, "navy1")
        c.set(10, y + 7, ch.accent)
        c.rect(8, y + 4, 1, 2, ch.accent)
        c.rect(14, y + 8, 3, 1, "navy1")
        c.set(15, y + 7, ch.accent)
        c.rect(14, 21 + bob, 1, 3, "steel_dark")
    elif ch.id == "ren":
        c.rect(10, y + 1, 2, 2, ch.trim)
        c.rect(13, y + 5, 2, 2, ch.accent_dark)
        c.set(14, y + 5, ch.accent)
        c.rect(9, y + 8, 7, 1, ch.top_dark)
        c.set(9, y + 8, ch.accent)
    elif ch.id == "val":
        # wine waistcoat front, with a sliver of ivory blouse
        c.rect(8, y + 2, 3, 6, "wine_vest")
        c.set(8, y + 2, "wine_vest_light")
        c.set(9, y + 2, "wine_vest_light")
        c.set(10, y + 3, ch.top_hi)
        c.set(10, y + 4, ch.top)
        c.set(9, y + 4, ch.accent)
        c.set(9, y + 6, ch.accent_dark)
        c.rect(9, y + 8, 7, 1, "navy1")
        c.set(12, y + 8, ch.accent)
    elif ch.id == "samir":
        c.rect(9, y + 1, 2, 7, ch.sleeve)
        c.rect(11, y + 1, 4, 7, ch.top)
        c.vline(11, y + 2, 6, ch.top_dark)
        c.rect(9, y + 8, 7, 1, ch.top_dark)
        c.set(9, y + 5, ch.accent)
    elif ch.id == "voss":
        c.rect(9, y, 4, 3, ch.accent)
        c.rect(9, y, 4, 1, ch.accent_dark)
        c.vline(12, y + 3, 5, ch.top_dark)
        c.rect(8, y + 4, 2, 2, ch.top_hi)
        c.rect(9, y + 8, 7, 1, ch.top_dark)


def _profile_head(c: Canvas, ch: Character, st: FrameState) -> None:
    bob = st.bob
    y = bob
    # far ear / hair mass
    c.rect(13, 8 + y, 2, 3, ch.skin_shadow)
    # face silhouette points to the left
    c.polygon(
        [
            (8, 4 + y),
            (14, 3 + y),
            (16, 6 + y),
            (16, 11 + y),
            (14, 14 + y),
            (10, 14 + y),
            (8, 13 + y),
            (7, 11 + y),
            (5, 10 + y),
            (6, 8 + y),
            (6, 6 + y),
        ],
        ch.skin,
    )
    # jaw / cheek shading
    c.rect(8, 6 + y, 5, 1, ch.skin_hi)
    c.rect(14, 7 + y, 2, 5, ch.skin_shadow)
    c.rect(9, 13 + y, 4, 1, ch.skin_shadow)
    # nose and mouth
    c.set(5, 10 + y, ch.skin_shadow)
    c.set(6, 11 + y, ch.skin_shadow)
    c.rect(7, 12 + y, 2, 1, "mouth")
    if ch.id == "samir":
        c.set(6, 13 + y, ch.hair_dark)
        c.set(7, 13 + y, ch.hair_dark)
        c.set(9, 13 + y, ch.hair_dark)
        c.set(10, 13 + y, ch.hair_dark)
        c.set(11, 13 + y, ch.hair_dark)
        c.set(13, 12 + y, ch.hair_dark)
        c.set(14, 12 + y, ch.hair_dark)
    # eye and brow
    c.rect(7, 8 + y, 3, 1, ch.hair_dark)
    if st.blink:
        c.rect(8, 9 + y, 2, 1, ch.skin_shadow)
    else:
        c.set(8, 9 + y, "white")
        c.set(8, 9 + y, ch.eye)
        c.set(9, 9 + y, "ink")
        c.set(9, 10 + y, ch.eye)
    # ear detail
    c.set(13, 9 + y, ch.skin_hi)
    # hair
    if ch.id == "nia":
        c.rect(7, 2 + y, 9, 4, ch.hair)
        c.rect(8, 1 + y, 2, 1, ch.hair)
        c.rect(12, 1 + y, 2, 1, ch.hair)
        c.rect(15, 4 + y, 3, 6, ch.hair_dark)
        c.rect(16, 5 + y, 1, 4, ch.hair)
        c.rect(7, 5 + y, 2, 2, ch.hair_dark)
        c.rect(8, 5 + y, 2, 1, ch.hair)
        _seam(c, ch.hair_hi, [(8, 3 + y), (9, 3 + y), (13, 2 + y), (14, 3 + y)])
        c.set(10, 2 + y, ch.hair_hi)
        # goggle lens at forehead
        c.rect(7, 5 + y, 3, 1, ch.accent_dark)
        c.set(7, 5 + y, "cyan")
        c.rect(10, 5 + y, 2, 1, "ink_soft")
    elif ch.id == "ren":
        c.rect(7, 2 + y, 9, 4, ch.hair)
        c.polygon([(7, 3 + y), (10, 2 + y), (15, 2 + y), (16, 5 + y), (13, 5 + y), (14, 3 + y), (11, 4 + y), (8, 5 + y), (7, 5 + y)], ch.hair)
        c.rect(15, 6 + y, 2, 3, ch.hair_dark)
        c.rect(7, 5 + y, 2, 1, ch.hair_dark)
        _seam(c, ch.hair_hi, [(9, 3 + y), (10, 3 + y), (13, 3 + y), (14, 2 + y)])
        # headset cup over ear
        c.rect(12, 7 + y, 3, 5, "ink_soft")
        c.rect(12, 8 + y, 2, 3, ch.accent_dark)
        c.set(12, 8 + y, ch.accent)
        c.rect(8, 11 + y, 5, 1, "ink_soft")
        c.set(8, 11 + y, ch.accent)
    elif ch.id == "val":
        c.rect(7, 2 + y, 9, 4, ch.hair)
        c.rect(14, 0 + y, 4, 2, ch.hair_dark)
        c.rect(15, 0 + y, 3, 1, ch.hair)
        c.rect(15, 3 + y, 2, 7, ch.hair)
        c.rect(16, 4 + y, 1, 5, ch.hair_dark)
        c.rect(7, 5 + y, 3, 2, ch.hair_dark)
        c.rect(9, 5 + y, 3, 1, ch.hair)
        _seam(c, ch.hair_hi, [(8, 3 + y), (10, 3 + y), (13, 4 + y), (15, 1 + y)])
        c.set(15, 8 + y, ch.accent_dark)
        c.set(6, 10 + y, ch.accent)
    elif ch.id == "samir":
        c.rect(7, 2 + y, 9, 4, ch.hair)
        for x, yy in ((8, 1), (10, 0), (13, 1), (15, 2)):
            c.rect(x, yy + y, 2, 2, ch.hair)
        c.rect(15, 4 + y, 2, 4, ch.hair_dark)
        c.rect(7, 5 + y, 3, 1, ch.hair_dark)
        _seam(c, ch.hair_hi, [(9, 2 + y), (11, 2 + y), (13, 3 + y)])
        c.set(8, 12 + y, ch.hair_dark)
    elif ch.id == "voss":
        c.rect(7, 2 + y, 9, 4, ch.hair)
        c.rect(14, 4 + y, 3, 10, ch.hair_dark)
        c.rect(15, 4 + y, 2, 9, ch.hair)
        c.rect(7, 4 + y, 3, 3, ch.hair_dark)
        c.rect(9, 4 + y, 3, 1, ch.hair)
        c.rect(6, 7 + y, 1, 3, ch.hair_dark)
        _seam(c, ch.hair_hi, [(9, 3 + y), (10, 3 + y), (13, 4 + y), (15, 5 + y)])


def _side_accessories(c: Canvas, ch: Character, st: FrameState) -> None:
    bob = st.bob
    y = bob
    if ch.id == "nia":
        c.rect(15, 19 + bob, 2, 4, "steel_dark")
        c.set(16, 19 + bob, "steel_light")
        c.rect(14, 22 + bob, 5, 1, "navy0")
        c.rect(7, 17 + bob, 1, 2, ch.accent)
    elif ch.id == "ren":
        c.rect(14, 16 + bob, 3, 5, "ink_soft")
        c.rect(15, 17 + bob, 2, 3, "navy1")
        c.set(16, 17 + bob, ch.accent)
        c.rect(14, 21 + bob, 3, 1, ch.top_dark)
        c.set(3, 8 + bob, "ink_soft")
        c.set(2, 8 + bob, "ink_soft")
    elif ch.id == "val":
        # tablet in near hand, extending forward
        c.rect(4, 19 + bob, 4, 5, "ink_soft")
        c.rect(5, 20 + bob, 2, 3, "navy1")
        c.rect(5, 20 + bob, 2, 1, ch.accent_dark)
        c.set(5, 21 + bob, ch.accent)
        c.set(6, 22 + bob, "teal_dark")
        c.rect(14, 17 + bob, 2, 5, "wine_vest_dark")
        c.rect(7, 16 + bob, 1, 5, "wine_vest")
    elif ch.id == "samir":
        c.rect(14, 17 + bob, 4, 5, "khaki_dark")
        c.rect(15, 17 + bob, 3, 4, "khaki")
        c.rect(15, 16 + bob, 3, 1, "cream_dark")
        c.set(16, 16 + bob, ch.trim)
        c.rect(4, 18 + bob, 3, 4, "cream")
        c.rect(4, 18 + bob, 1, 4, "ink_soft")
        c.rect(4, 21 + bob, 2, 1, ch.accent)
    elif ch.id == "voss":
        c.rect(3, 18 + bob, 4, 6, "ink_soft")
        c.rect(4, 19 + bob, 2, 4, "cream")
        c.rect(4, 19 + bob, 2, 1, "steel")
        c.rect(14, 17 + bob, 2, 2, "white")
        c.rect(14, 17 + bob, 2, 1, ch.accent)
        c.rect(12, 22 + bob, 4, 3, ch.top)
        c.vline(13, 23 + bob, 2, ch.top_dark)


# ---------------------------------------------------------------------------
# Sheet assembly and export
# ---------------------------------------------------------------------------


def render_character_frame(ch: Character, direction: str, st: FrameState) -> Canvas:
    c = Canvas(FRAME_W, FRAME_H)
    if direction == "down":
        draw_down(c, ch, st)
    elif direction == "up":
        draw_up(c, ch, st)
    elif direction == "left":
        draw_side_left(c, ch, st)
    elif direction == "right":
        # Mirror the fully outlined left frame so the export is a true mirror.
        draw_side_left(c, ch, st)
        return colored_external_outline(c, 0.63).flip_h()
    else:
        raise ValueError(direction)
    return colored_external_outline(c, 0.63)


def render_character_sheet(ch: Character) -> Canvas:
    sheet = Canvas(FRAME_W * 6, FRAME_H * 4)
    for row, direction in enumerate(DIRECTIONS):
        for col, st in enumerate(FRAME_STATES):
            frame = render_character_frame(ch, direction, st)
            sheet.blit(frame, col * FRAME_W, row * FRAME_H)
    return sheet


def sheet_metadata(ch: Character) -> dict:
    animations = {}
    for row, direction in enumerate(DIRECTIONS):
        animations[f"idle-{direction}"] = {
            "frames": [row * 6 + 0, row * 6 + 1],
            "fps": 1.4,
            "repeat": -1,
        }
        animations[f"walk-{direction}"] = {
            "frames": [row * 6 + i for i in (2, 3, 4, 5)],
            "fps": 8,
            "repeat": -1,
        }
        animations[f"work-{direction}"] = {
            "frames": [row * 6 + 0, row * 6 + 2],
            "fps": 3,
            "repeat": -1,
        }
    return {
        "id": ch.id,
        "name": ch.name,
        "role": ch.role,
        "image": f"{ch.file_stem}.png",
        "frameWidth": FRAME_W,
        "frameHeight": FRAME_H,
        "columns": 6,
        "rows": 4,
        "directions": list(DIRECTIONS),
        "animations": animations,
        "origin": {"x": 0.5, "y": 1.0},
        "shadow": {"offsetX": 2, "offsetY": 31, "width": 12, "height": 3},
        "fictionalCharacter": True,
    }


# ---------------------------------------------------------------------------
# Dialogue portraits
# ---------------------------------------------------------------------------


def _portrait_common_head(c: Canvas, ch: Character) -> None:
    # ears
    c.rect(9, 21, 5, 8, ch.skin_shadow)
    c.rect(10, 22, 4, 6, ch.skin)
    c.set(11, 24, ch.skin_shadow)
    c.rect(34, 21, 5, 8, ch.skin_shadow)
    c.rect(34, 22, 4, 6, ch.skin)
    c.set(36, 24, ch.skin_shadow)
    # face
    c.polygon(
        [
            (16, 11),
            (24, 8),
            (32, 10),
            (36, 16),
            (36, 24),
            (34, 30),
            (29, 36),
            (24, 39),
            (19, 36),
            (14, 30),
            (12, 24),
            (12, 16),
        ],
        ch.skin,
    )
    # cheek / jaw shading
    c.rect(31, 19, 3, 10, ch.skin_shadow)
    c.rect(17, 33, 14, 1, ch.skin_shadow)
    c.set(15, 27, ch.skin_shadow)
    c.rect(18, 14, 5, 2, ch.skin_hi)
    c.rect(19, 24, 2, 1, ch.skin_hi)
    c.rect(30, 23, 1, 1, ch.skin_hi)
    c.set(28, 32, ch.skin_hi)
    # neck
    c.rect(20, 35, 8, 7, ch.skin_shadow)
    c.rect(21, 35, 6, 5, ch.skin)


def _portrait_eyes(c: Canvas, ch: Character) -> None:
    # eye sockets
    c.rect(16, 22, 7, 1, ch.skin_shadow)
    c.rect(26, 22, 7, 1, ch.skin_shadow)
    # sclera
    c.rect(17, 23, 5, 3, "white")
    c.rect(27, 23, 5, 3, "white")
    c.rect(17, 23, 5, 1, "cream")
    c.rect(27, 23, 5, 1, "cream")
    # iris / pupil
    iris = ch.eye
    c.rect(19, 23, 3, 3, iris)
    c.rect(29, 23, 3, 3, iris)
    c.rect(20, 23, 1, 3, "ink")
    c.rect(30, 23, 1, 3, "ink")
    c.set(19, 23, "white")
    c.set(29, 23, "white")
    c.set(19, 25, ch.skin_shadow)
    c.set(29, 25, ch.skin_shadow)
    # lids and lashes
    c.rect(17, 22, 5, 1, "ink_soft")
    c.rect(27, 22, 5, 1, "ink_soft")
    c.set(16, 23, ch.skin_shadow)
    c.set(26, 23, ch.skin_shadow)
    # brows
    c.rect(16, 18, 7, 2, ch.hair_dark)
    c.rect(26, 18, 7, 2, ch.hair_dark)
    c.set(17, 18, ch.hair)
    c.set(30, 18, ch.hair)
    if ch.id == "voss":
        c.rect(15, 17, 8, 1, ch.hair_silver_dark if hasattr(ch, "hair_silver_dark") else "hair_silver_dark")
        c.rect(26, 17, 8, 1, "hair_silver_dark")
        c.set(16, 16, ch.skin_shadow)
        c.set(31, 16, ch.skin_shadow)
    if ch.id == "samir":
        c.rect(15, 17, 8, 3, ch.hair_dark)
        c.rect(27, 17, 8, 3, ch.hair_dark)
    # nose
    c.rect(24, 25, 2, 6, ch.skin_shadow)
    c.set(23, 29, ch.skin_shadow)
    c.set(26, 29, ch.skin_shadow)
    c.rect(23, 31, 3, 1, ch.skin_shadow)
    c.set(22, 31, ch.skin_hi)
    # mouth
    c.rect(21, 34, 7, 1, "mouth_dark")
    c.rect(22, 35, 5, 1, "mouth")
    c.set(21, 33, ch.skin_shadow)
    c.set(27, 33, ch.skin_shadow)
    c.set(28, 34, ch.skin_hi)


def _portrait_hair(c: Canvas, ch: Character) -> None:
    hair, hi, dark = ch.hair, ch.hair_hi, ch.hair_dark
    if ch.id == "nia":
        c.rect(11, 9, 27, 10, dark)
        c.rect(12, 7, 25, 8, hair)
        c.rect(14, 4, 20, 6, hair)
        for x, y, w, h in ((12, 5, 4, 4), (19, 3, 4, 4), (25, 4, 4, 5), (32, 6, 4, 4), (9, 12, 4, 6), (37, 12, 4, 7)):
            c.rect(x, y, w, h, hair)
            c.rect(x, y, w, 1, hi)
        c.rect(10, 17, 3, 7, hair)
        c.rect(37, 17, 3, 6, hair)
        c.rect(13, 18, 5, 2, dark)
        c.rect(32, 18, 4, 2, dark)
        c.rect(15, 13, 8, 3, hair)
        c.rect(21, 12, 8, 2, hi)
        c.rect(29, 14, 3, 2, dark)
        c.rect(17, 8, 3, 2, hi)
        c.rect(26, 7, 4, 2, hi)
        # goggles resting above forehead
        c.rect(12, 9, 25, 2, "ink_soft")
        c.rect(14, 8, 8, 5, "gold")
        c.rect(16, 9, 5, 3, "teal_dark")
        c.rect(17, 9, 3, 2, "cyan")
        c.set(17, 9, "cyan_light")
        c.rect(27, 8, 8, 5, "gold")
        c.rect(29, 9, 5, 3, "teal_dark")
        c.rect(30, 9, 3, 2, "cyan")
        c.set(30, 9, "cyan_light")
    elif ch.id == "ren":
        c.rect(12, 8, 25, 9, dark)
        c.rect(13, 6, 24, 8, hair)
        c.rect(15, 4, 19, 5, hair)
        c.rect(12, 14, 4, 9, dark)
        c.rect(34, 12, 3, 7, dark)
        # swept fringe
        c.rect(16, 10, 13, 3, hair)
        c.polygon([(16, 10), (29, 8), (35, 13), (31, 15), (25, 12), (19, 14)], hair)
        c.rect(28, 10, 8, 2, hair)
        c.rect(13, 9, 8, 2, hi)
        c.rect(20, 6, 7, 2, hi)
        c.rect(16, 16, 3, 6, hair)
        c.rect(18, 15, 2, 3, hi)
        # shaved temple
        c.rect(10, 14, 3, 5, dark)
        c.rect(11, 15, 1, 3, ch.skin_shadow)
        c.rect(36, 14, 2, 4, dark)
        # one authoritative headset cup and boom microphone
        c.line(11, 10, 24, 5, "ink_soft")
        c.line(24, 5, 37, 10, "ink_soft")
        c.line(13, 10, 24, 7, "steel_dark")
        c.line(24, 7, 35, 10, "steel_dark")
        c.rect(8, 20, 5, 8, "ink_soft")
        c.rect(9, 21, 4, 6, "navy1")
        c.rect(10, 22, 2, 3, "teal_dark")
        c.set(10, 22, ch.accent if hasattr(ch, "accent") else "cyan")
        c.set(11, 22, "cyan")
        c.rect(13, 27, 7, 1, "ink_soft")
        c.rect(15, 27, 4, 2, "navy1")
        c.set(18, 27, "cyan")
        c.rect(38, 20, 2, 5, "ink_soft")
    elif ch.id == "val":
        # bun
        c.rect(31, 2, 11, 10, dark)
        c.rect(32, 1, 9, 9, hair)
        c.rect(34, 2, 4, 2, hi)
        c.rect(38, 4, 2, 2, dark)
        # hair cap with part
        c.rect(11, 9, 27, 8, dark)
        c.rect(12, 7, 25, 8, hair)
        c.rect(15, 5, 18, 5, hair)
        c.rect(10, 14, 6, 10, hair)
        c.rect(36, 13, 2, 7, hair)
        c.rect(13, 15, 6, 2, dark)
        c.rect(31, 14, 5, 2, dark)
        c.rect(19, 14, 10, 2, hair)
        c.rect(15, 8, 7, 2, hi)
        c.rect(26, 6, 8, 2, hi)
        c.rect(12, 16, 2, 5, hi)
        c.rect(36, 15, 1, 4, hi)
        # gold earrings
        c.rect(8, 28, 2, 5, "coin")
        c.set(8, 32, "gold")
        c.rect(38, 28, 2, 5, "coin")
        c.set(39, 32, "gold")
    elif ch.id == "samir":
        c.rect(11, 8, 27, 10, dark)
        c.rect(12, 6, 25, 9, hair)
        c.rect(14, 3, 21, 6, hair)
        for x, y, w, h in ((11, 6, 5, 5), (17, 2, 5, 5), (23, 3, 5, 4), (28, 4, 5, 5), (33, 6, 4, 4), (10, 12, 3, 6), (37, 11, 3, 5)):
            c.rect(x, y, w, h, hair)
            c.rect(x, y, w, 1, hi)
        c.rect(13, 17, 6, 2, dark)
        c.rect(31, 17, 5, 2, dark)
        c.rect(16, 9, 8, 2, hi)
        c.rect(27, 6, 7, 2, hi)
        # short, neatly edged beard: sideburns plus a chin strap, never a mask
        c.rect(13, 28, 3, 8, hair)
        c.rect(32, 27, 3, 8, hair)
        c.rect(15, 35, 4, 4, hair)
        c.rect(29, 35, 4, 4, hair)
        c.rect(18, 37, 13, 2, hair)
        c.rect(20, 38, 9, 1, dark)
        c.rect(14, 28, 1, 6, hi)
        c.rect(32, 27, 1, 6, hi)
        c.set(17, 36, hi)
        c.set(31, 36, dark)
    elif ch.id == "voss":
        c.rect(11, 8, 27, 13, dark)
        c.rect(12, 6, 25, 11, hair)
        c.rect(14, 4, 21, 5, hair)
        c.rect(9, 12, 6, 22, dark)
        c.rect(10, 13, 5, 20, hair)
        c.rect(35, 12, 6, 22, dark)
        c.rect(35, 13, 4, 20, hair)
        c.rect(13, 16, 7, 3, dark)
        c.rect(30, 15, 5, 2, dark)
        c.rect(16, 10, 7, 2, hi)
        c.rect(25, 7, 8, 2, hi)
        c.rect(11, 13, 2, 5, hi)
        c.rect(36, 14, 1, 5, hi)
        c.rect(14, 18, 3, 9, hair)
        c.rect(33, 18, 2, 7, hair)
        # round reading glasses
        c.rect(16, 21, 7, 1, "gold")
        c.rect(16, 26, 7, 1, "gold")
        c.rect(16, 21, 1, 6, "gold")
        c.rect(22, 21, 1, 6, "gold")
        c.rect(26, 21, 7, 1, "gold")
        c.rect(26, 26, 7, 1, "gold")
        c.rect(26, 21, 1, 6, "gold")
        c.rect(32, 21, 1, 6, "gold")
        c.rect(23, 23, 3, 1, "gold")
        c.rect(14, 24, 2, 1, "gold")
        # subtle age lines
        c.set(14, 32, ch.skin_shadow)
        c.set(34, 32, ch.skin_shadow)
        c.rect(29, 37, 2, 1, ch.skin_shadow)


def _portrait_body(c: Canvas, ch: Character) -> None:
    # shoulders/collar
    if ch.id == "nia":
        c.polygon([(2, 46), (6, 39), (18, 37), (30, 37), (42, 39), (46, 46), (46, 48), (2, 48)], ch.top_dark)
        c.polygon([(4, 47), (7, 41), (18, 40), (30, 40), (41, 41), (44, 47)], ch.top)
        c.rect(17, 38, 7, 2, "navy1")
        c.rect(25, 38, 7, 2, "navy1")
        c.rect(8, 42, 8, 2, ch.accent)
        c.rect(32, 42, 8, 2, ch.accent)
        c.rect(23, 41, 2, 7, "navy1")
        c.rect(20, 44, 8, 4, ch.top_hi)
        c.rect(21, 45, 6, 1, ch.top_dark)
        c.rect(15, 44, 5, 4, ch.top_dark)
        c.rect(29, 44, 5, 4, ch.top_dark)
        c.set(18, 44, ch.accent)
        c.set(29, 44, ch.accent)
    elif ch.id == "ren":
        c.polygon([(2, 46), (6, 39), (19, 37), (29, 37), (42, 39), (46, 46), (46, 48), (2, 48)], ch.top_dark)
        c.polygon([(4, 47), (7, 41), (20, 40), (28, 40), (41, 41), (44, 47)], ch.top)
        # cream shirt V
        c.polygon([(21, 39), (24, 47), (27, 39)], ch.trim)
        c.rect(23, 38, 2, 9, ch.top_dark)
        c.rect(8, 41, 7, 2, ch.accent_dark)
        c.set(9, 41, ch.accent)
        c.rect(32, 41, 6, 2, ch.accent_dark)
        c.set(33, 41, ch.accent)
        c.set(36, 42, "white")
        c.rect(8, 45, 7, 2, "navy1")
    elif ch.id == "val":
        c.polygon([(2, 46), (6, 39), (19, 37), (29, 37), (42, 39), (46, 46), (46, 48), (2, 48)], ch.sleeve_hi)
        c.polygon([(4, 47), (8, 41), (19, 40), (29, 40), (40, 41), (44, 47)], ch.sleeve)
        # waistcoat, cut high enough to read in a dialogue crop
        c.polygon([(6, 47), (10, 41), (20, 41), (20, 48), (6, 48)], "wine_vest")
        c.polygon([(42, 47), (38, 41), (28, 41), (28, 48), (42, 48)], "wine_vest")
        c.polygon([(16, 41), (24, 47), (32, 41)], ch.sleeve)
        c.polygon([(11, 41), (20, 41), (20, 46), (15, 45)], "wine_vest_light")
        c.polygon([(37, 41), (28, 41), (28, 46), (33, 45)], "wine_vest")
        c.rect(20, 43, 8, 1, "wine_vest_dark")
        c.set(23, 44, "coin")
        c.set(25, 45, "coin")
        c.set(23, 46, "coin")
        c.rect(14, 46, 5, 1, "wine_vest_dark")
        c.rect(29, 46, 5, 1, "wine_vest_dark")
        c.rect(19, 38, 10, 1, "gold")
        c.set(24, 38, "coin")
        c.rect(13, 42, 1, 5, "wine_vest_dark")
        c.rect(34, 42, 1, 5, "wine_vest_dark")
    elif ch.id == "samir":
        c.polygon([(2, 46), (6, 39), (18, 37), (30, 37), (42, 39), (46, 46), (46, 48), (2, 48)], ch.top_dark)
        c.polygon([(4, 47), (7, 41), (18, 40), (30, 40), (41, 41), (44, 47)], ch.top)
        c.polygon([(19, 38), (24, 46), (29, 38)], ch.sleeve)
        c.rect(18, 40, 2, 8, ch.top_dark)
        c.rect(28, 40, 2, 8, ch.top_dark)
        c.rect(23, 39, 2, 4, ch.sleeve_hi)
        # lanyard follows the body, with a readable ID badge
        c.line(14, 41, 24, 45, ch.accent)
        c.line(34, 41, 24, 45, ch.accent)
        c.rect(22, 44, 5, 4, "white")
        c.rect(22, 44, 5, 1, ch.trim)
        c.rect(23, 46, 2, 1, "ink_soft")
        c.rect(31, 44, 4, 1, ch.top_hi)
        c.rect(10, 44, 4, 1, ch.top_hi)
    elif ch.id == "voss":
        c.polygon([(2, 46), (5, 39), (18, 37), (30, 37), (43, 39), (46, 46), (46, 48), (2, 48)], ch.top_dark)
        c.polygon([(4, 47), (7, 41), (18, 40), (30, 40), (41, 41), (44, 47)], ch.top)
        # teal turtleneck
        c.polygon([(18, 38), (24, 44), (30, 38)], ch.accent)
        c.rect(18, 37, 12, 3, ch.accent_dark)
        c.rect(23, 39, 2, 5, ch.accent)
        c.rect(24, 40, 1, 4, ch.accent_dark)
        # lab coat lapels, folds and ID
        c.polygon([(8, 41), (17, 40), (20, 47), (10, 47)], ch.top_hi)
        c.polygon([(40, 41), (31, 40), (28, 47), (38, 47)], ch.top_hi)
        c.polygon([(10, 42), (17, 41), (19, 45), (12, 46)], ch.top_dark)
        c.polygon([(38, 42), (31, 41), (29, 45), (36, 46)], ch.top_dark)
        c.vline(14, 42, 5, ch.top_dark)
        c.vline(34, 42, 5, ch.top_dark)
        c.rect(33, 43, 5, 4, "white")
        c.rect(33, 43, 5, 1, ch.accent)
        c.rect(34, 45, 2, 1, "ink_soft")
        c.rect(17, 44, 1, 3, ch.accent_dark)
        c.rect(6, 41, 2, 6, ch.top_dark)
        c.rect(41, 41, 2, 6, ch.top_dark)
        c.rect(5, 44, 1, 4, ch.top_dark)
        c.set(15, 43, "teal")
        c.set(34, 44, ch.accent_dark)
    # necklace/collar highlights for everyone
    if ch.id in ("val", "voss"):
        c.set(23, 39, "white")
        c.set(24, 39, "white")


def render_portrait(ch: Character) -> Canvas:
    c = Canvas(48, 48)
    # clothing and neck behind the face
    _portrait_body(c, ch)
    # long back hair sits behind the head, never over the features
    if ch.id == "voss":
        c.rect(8, 10, 30, 28, ch.hair_dark)
        c.rect(9, 11, 28, 25, ch.hair)
        c.rect(10, 15, 3, 20, ch.hair_silver_dark if hasattr(ch, "hair_silver_dark") else "hair_silver_dark")
    _portrait_common_head(c, ch)
    # face features and front hair
    _portrait_eyes(c, ch)
    _portrait_hair(c, ch)
    # accessories that sit over hair/eyes
    if ch.id == "samir":
        # eyebrow scar / strong detail
        c.set(17, 17, "hair_brown_dark")
        c.set(33, 20, "hair_brown_dark")
    if ch.id == "voss":
        # small mole and reading-glass chain
        c.set(16, 30, ch.skin_dark)
        c.rect(23, 23, 3, 1, "gold")
        c.set(14, 27, "gold")
        c.set(36, 27, "gold")
    # final material-aware outline; portrait is flush at bottom by design
    outlined = colored_external_outline(c, 0.52)
    return outlined


def render_lineup(chars: list[Character], scale: int = 3) -> Canvas:
    pad = 18
    cell_w = FRAME_W * scale + pad
    label_h = 22
    c = Canvas(max(1, cell_w * len(chars) + pad), FRAME_H * scale + label_h + pad)
    # ground plate
    c.rect(0, 0, c.width, c.height, "navy1")
    c.rect(0, c.height - 7, c.width, 7, "navy2")
    for i, ch in enumerate(chars):
        frame = render_character_frame(ch, "down", FrameState(0, False, 0))
        img = frame.to_image().resize((FRAME_W * scale, FRAME_H * scale), resample=0)
        c.paste_image(img, pad // 2 + i * cell_w, pad)
        draw_text(c, ch.short_name, pad // 2 + i * cell_w + 2, FRAME_H * scale + pad + 3, "cream", 1, 1)
        c.rect(pad // 2 + i * cell_w + 1, FRAME_H * scale + pad + 13, 3, 3, C(ch.role_color))
    return c


def write_character_assets(out_root: Path) -> dict:
    char_root = out_root / "characters"
    portrait_root = out_root / "portraits"
    char_root.mkdir(parents=True, exist_ok=True)
    portrait_root.mkdir(parents=True, exist_ok=True)
    manifest = {"frameWidth": FRAME_W, "frameHeight": FRAME_H, "directions": list(DIRECTIONS), "characters": []}
    sheets: dict[str, Canvas] = {}
    portraits: dict[str, Canvas] = {}
    for ch in CHARACTERS.values():
        sheet = render_character_sheet(ch)
        sheet.save(char_root / f"{ch.file_stem}.png")
        portrait = render_portrait(ch)
        portrait.save(portrait_root / f"{ch.file_stem}.png")
        meta = sheet_metadata(ch)
        manifest["characters"].append(meta)
        sheets[ch.id] = sheet
        portraits[ch.id] = portrait
    (char_root / "characters.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return {"sheets": sheets, "portraits": portraits, "manifest": manifest}


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1] / "client" / "public" / "assets"
    data = write_character_assets(root)
    print(f"Wrote {len(data['sheets'])} character sheets to {root / 'characters'}")
