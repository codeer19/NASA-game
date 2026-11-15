"""Deterministic pixel-art drawing helpers for RED FRONTIER.

The project intentionally avoids image-generation models for final in-game art.
Every raster asset is authored here and exported at native resolution.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image, ImageDraw

RGBA = tuple[int, int, int, int]
ColorLike = str | RGBA

# ---------------------------------------------------------------------------
# Master palette. Keep this in sync with docs/ART_BIBLE.md.
# ---------------------------------------------------------------------------
P: dict[str, RGBA] = {
    # Neutrals / UI
    "ink": (26, 20, 34, 255),
    "ink_soft": (45, 34, 47, 255),
    "void": (11, 18, 36, 255),
    "navy0": (10, 16, 29, 255),
    "navy1": (22, 32, 55, 255),
    "navy2": (35, 50, 77, 255),
    "navy3": (52, 74, 103, 255),
    "steel_dark": (60, 74, 92, 255),
    "steel": (102, 118, 135, 255),
    "steel_light": (156, 170, 167, 255),
    "white": (244, 234, 216, 255),
    "cream": (223, 207, 176, 255),
    "cream_dark": (183, 162, 131, 255),
    "fog": (170, 180, 178, 255),
    "warm_gray": (122, 112, 104, 255),
    "black_warm": (18, 14, 18, 255),
    # Mars
    "rust_dark": (109, 47, 34, 255),
    "rust_deep": (79, 37, 31, 255),
    "rust": (167, 74, 46, 255),
    "rust_light": (208, 107, 60, 255),
    "orange": (225, 122, 63, 255),
    "gold": (240, 182, 75, 255),
    "yellow": (255, 218, 122, 255),
    "sand_dark": (154, 90, 59, 255),
    "sand": (193, 122, 79, 255),
    "sand_light": (221, 161, 108, 255),
    "beige": (232, 199, 155, 255),
    "mauve": (125, 74, 71, 255),
    "mauve_shadow": (90, 53, 64, 255),
    "basalt": (58, 48, 56, 255),
    "basalt_light": (93, 78, 81, 255),
    "basalt_dark": (39, 33, 42, 255),
    # Signals / science
    "teal_dark": (20, 84, 79, 255),
    "teal": (46, 140, 128, 255),
    "teal_light": (88, 194, 174, 255),
    "cyan_dark": (45, 113, 131, 255),
    "cyan": (106, 219, 224, 255),
    "cyan_light": (184, 245, 242, 255),
    # Finance / warning
    "wine": (111, 51, 68, 255),
    "wine_light": (161, 80, 98, 255),
    "coin": (231, 179, 75, 255),
    "warning": (255, 178, 64, 255),
    # Greenery
    "green_dark": (46, 74, 57, 255),
    "green": (79, 123, 84, 255),
    "green_light": (127, 166, 108, 255),
    # Materials
    "coverall": (184, 92, 54, 255),
    "coverall_light": (214, 123, 73, 255),
    "coverall_dark": (137, 63, 37, 255),
    "wine_vest": (119, 58, 75, 255),
    "wine_vest_dark": (82, 38, 51, 255),
    "wine_vest_light": (155, 80, 99, 255),
    "slate_vest": (52, 74, 103, 255),
    "slate_vest_dark": (36, 51, 73, 255),
    "slate_vest_light": (73, 97, 127, 255),
    "khaki": (138, 106, 74, 255),
    "khaki_dark": (98, 73, 51, 255),
    "lab_coat": (237, 230, 216, 255),
    "lab_coat_shadow": (196, 184, 162, 255),
    "lab_coat_outline": (127, 116, 104, 255),
    # Skin ramps
    "skin1_h": (255, 224, 188, 255),
    "skin1": (240, 196, 159, 255),
    "skin1_s": (212, 148, 112, 255),
    "skin1_d": (181, 110, 85, 255),
    "skin2_h": (246, 199, 154, 255),
    "skin2": (222, 154, 109, 255),
    "skin2_s": (178, 109, 78, 255),
    "skin2_d": (140, 79, 61, 255),
    "skin3_h": (215, 155, 114, 255),
    "skin3": (183, 116, 80, 255),
    "skin3_s": (142, 81, 58, 255),
    "skin3_d": (109, 58, 44, 255),
    "skin4_h": (185, 122, 88, 255),
    "skin4": (145, 82, 56, 255),
    "skin4_s": (106, 55, 41, 255),
    "skin4_d": (77, 39, 31, 255),
    "skin5_h": (141, 87, 62, 255),
    "skin5": (102, 58, 43, 255),
    "skin5_s": (73, 39, 30, 255),
    "skin5_d": (52, 25, 18, 255),
    # Hair ramps
    "hair_black": (42, 35, 48, 255),
    "hair_black_hi": (74, 61, 80, 255),
    "hair_black_dark": (26, 20, 34, 255),
    "hair_brown": (80, 53, 45, 255),
    "hair_brown_hi": (124, 89, 72, 255),
    "hair_brown_dark": (51, 32, 29, 255),
    "hair_silver": (196, 197, 189, 255),
    "hair_silver_hi": (240, 237, 224, 255),
    "hair_silver_dark": (133, 139, 139, 255),
    # Misc
    "eye": (31, 23, 33, 255),
    "eye_teal": (53, 116, 118, 255),
    "eye_amber": (117, 78, 45, 255),
    "mouth": (125, 65, 60, 255),
    "mouth_dark": (84, 42, 43, 255),
    "glass": (120, 211, 215, 255),
    "glass_dark": (53, 105, 124, 255),
}


def C(color: ColorLike) -> RGBA:
    if isinstance(color, tuple):
        return color
    return P[color]


def mix(a: ColorLike, b: ColorLike, t: float) -> RGBA:
    """Linear palette mix. Intended for authored, intentional tones only."""
    ca, cb = C(a), C(b)
    return (
        round(ca[0] + (cb[0] - ca[0]) * t),
        round(ca[1] + (cb[1] - ca[1]) * t),
        round(ca[2] + (cb[2] - ca[2]) * t),
        round(ca[3] + (cb[3] - ca[3]) * t),
    )


def with_alpha(color: ColorLike, alpha: int) -> RGBA:
    c = C(color)
    return (c[0], c[1], c[2], alpha)


class Canvas:
    """Small native-resolution RGBA canvas with hard-edged drawing primitives."""

    def __init__(self, width: int, height: int, fill: ColorLike | None = None):
        self.width = width
        self.height = height
        self.data = bytearray(width * height * 4)
        if fill is not None:
            self.rect(0, 0, width, height, fill)

    @classmethod
    def from_image(cls, image: Image.Image) -> "Canvas":
        image = image.convert("RGBA")
        c = cls(image.width, image.height)
        c.data = bytearray(image.tobytes())
        return c

    def _offset(self, x: int, y: int) -> int:
        return (y * self.width + x) * 4

    def set(self, x: int, y: int, color: ColorLike) -> None:
        if 0 <= x < self.width and 0 <= y < self.height:
            r, g, b, a = C(color)
            i = self._offset(x, y)
            if a == 255:
                self.data[i : i + 4] = bytes((r, g, b, a))
            elif a == 0:
                return
            else:
                br, bg, bb, ba = self.data[i : i + 4]
                out_a = a / 255
                inv = 1 - out_a
                self.data[i] = round(r * out_a + br * inv)
                self.data[i + 1] = round(g * out_a + bg * inv)
                self.data[i + 2] = round(b * out_a + bb * inv)
                self.data[i + 3] = max(ba, a)

    def get(self, x: int, y: int) -> RGBA:
        if not (0 <= x < self.width and 0 <= y < self.height):
            return (0, 0, 0, 0)
        i = self._offset(x, y)
        return tuple(self.data[i : i + 4])  # type: ignore[return-value]

    def px(self, x: int, y: int, color: ColorLike) -> None:
        self.set(x, y, color)

    def hline(self, x: int, y: int, length: int, color: ColorLike) -> None:
        for i in range(length):
            self.set(x + i, y, color)

    def vline(self, x: int, y: int, length: int, color: ColorLike) -> None:
        for i in range(length):
            self.set(x, y + i, color)

    def rect(self, x: int, y: int, w: int, h: int, color: ColorLike) -> None:
        for yy in range(y, y + h):
            self.hline(x, yy, w, color)

    def frame(self, x: int, y: int, w: int, h: int, color: ColorLike) -> None:
        self.hline(x, y, w, color)
        self.hline(x, y + h - 1, w, color)
        self.vline(x, y, h, color)
        self.vline(x + w - 1, y, h, color)

    def line(self, x0: int, y0: int, x1: int, y1: int, color: ColorLike) -> None:
        dx = abs(x1 - x0)
        sx = 1 if x0 < x1 else -1
        dy = -abs(y1 - y0)
        sy = 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            self.set(x0, y0, color)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def polygon(self, points: Sequence[tuple[int, int]], color: ColorLike) -> None:
        """Scanline polygon fill. Edges are drawn inclusively."""
        if not points:
            return
        ys = [p[1] for p in points]
        y_min, y_max = min(ys), max(ys)
        for y in range(y_min, y_max + 1):
            intersections: list[float] = []
            for i, (x1, y1) in enumerate(points):
                x2, y2 = points[(i + 1) % len(points)]
                if y1 == y2:
                    continue
                if min(y1, y2) <= y < max(y1, y2):
                    t = (y - y1) / (y2 - y1)
                    intersections.append(x1 + (x2 - x1) * t)
            intersections.sort()
            for i in range(0, len(intersections) - 1, 2):
                x_start = round(intersections[i])
                x_end = round(intersections[i + 1])
                self.hline(x_start, y, x_end - x_start + 1, color)

    def ellipse(self, cx: float, cy: float, rx: float, ry: float, color: ColorLike) -> None:
        x0 = round(cx - rx)
        x1 = round(cx + rx)
        y0 = round(cy - ry)
        y1 = round(cy + ry)
        for y in range(y0, y1 + 1):
            dy = (y - cy) / ry if ry else 0
            for x in range(x0, x1 + 1):
                dx = (x - cx) / rx if rx else 0
                if dx * dx + dy * dy <= 1.0:
                    self.set(x, y, color)

    def dither_rect(
        self,
        x: int,
        y: int,
        w: int,
        h: int,
        color: ColorLike,
        phase: int = 0,
        density: int = 2,
    ) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if (xx + yy * 2 + phase) % density == 0:
                    self.set(xx, yy, color)

    def blit(self, other: "Canvas", x: int, y: int) -> None:
        for yy in range(other.height):
            for xx in range(other.width):
                c = other.get(xx, yy)
                if c[3] > 0:
                    self.set(x + xx, y + yy, c)

    def paste_image(self, image: Image.Image, x: int, y: int) -> None:
        self.blit(Canvas.from_image(image), x, y)

    def clone(self) -> "Canvas":
        c = Canvas(self.width, self.height)
        c.data = bytearray(self.data)
        return c

    def flip_h(self) -> "Canvas":
        c = Canvas(self.width, self.height)
        for y in range(self.height):
            for x in range(self.width):
                c.set(self.width - x - 1, y, self.get(x, y))
        return c

    def mask_alpha(self) -> bytearray:
        return bytearray(self.data[3::4])

    def trim(self) -> "Canvas":
        """Return tightly cropped canvas. Useful for previews only, never sheets."""
        min_x, min_y = self.width, self.height
        max_x, max_y = -1, -1
        for y in range(self.height):
            for x in range(self.width):
                if self.get(x, y)[3] > 0:
                    min_x = min(min_x, x)
                    min_y = min(min_y, y)
                    max_x = max(max_x, x)
                    max_y = max(max_y, y)
        if max_x < 0:
            return Canvas(1, 1)
        c = Canvas(max_x - min_x + 1, max_y - min_y + 1)
        c.blit(self, -min_x, -min_y)
        return c

    def to_image(self) -> Image.Image:
        return Image.frombytes("RGBA", (self.width, self.height), bytes(self.data))

    def save(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.to_image().save(path)


def load(path: str | Path) -> Canvas:
    return Canvas.from_image(Image.open(path))


def colored_external_outline(canvas: Canvas, ink_amount: float = 0.58) -> Canvas:
    """Add a 1 px material-aware outline around the current silhouette.

    Each new outline pixel takes its hue from the nearest opaque neighbour and is
    pushed toward ink. This keeps skin edges warm and clothing edges role-coded while
    preserving a single readable silhouette. Content must leave a 1 px margin.
    """
    result = canvas.clone()
    for y in range(canvas.height):
        for x in range(canvas.width):
            if canvas.get(x, y)[3] != 0:
                continue
            neighbours: list[RGBA] = []
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                c = canvas.get(nx, ny)
                if c[3] == 255:
                    neighbours.append(c)
            if not neighbours:
                continue
            base = min(neighbours, key=lambda c: c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11)
            result.set(x, y, mix(base, P["ink"], ink_amount))
    return result


def darken(color: ColorLike, factor: float = 0.72) -> RGBA:
    c = C(color)
    return (round(c[0] * factor), round(c[1] * factor), round(c[2] * factor), c[3])


def lighten(color: ColorLike, factor: float = 1.16) -> RGBA:
    c = C(color)
    return (
        min(255, round(c[0] * factor)),
        min(255, round(c[1] * factor)),
        min(255, round(c[2] * factor)),
        c[3],
    )


# ---------------------------------------------------------------------------
# A deliberately blocky 5×7 display font. Used for original wordmarks and signs.
# ---------------------------------------------------------------------------
FONT_5X7: dict[str, tuple[str, ...]] = {
    "A": (".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"),
    "B": ("####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."),
    "C": (".####", "#....", "#....", "#....", "#....", "#....", ".####"),
    "D": ("####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."),
    "E": ("#####", "#....", "#....", "####.", "#....", "#....", "#####"),
    "F": ("#####", "#....", "#....", "####.", "#....", "#....", "#...."),
    "G": (".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."),
    "H": ("#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"),
    "I": ("#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"),
    "J": ("..###", "...#.", "...#.", "...#.", "#..#.", "#..#.", ".##.."),
    "K": ("#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"),
    "L": ("#....", "#....", "#....", "#....", "#....", "#....", "#####"),
    "M": ("#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"),
    "N": ("#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"),
    "O": (".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."),
    "P": ("####.", "#...#", "#...#", "####.", "#....", "#....", "#...."),
    "Q": (".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"),
    "R": ("####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"),
    "S": (".####", "#....", "#....", ".###.", "....#", "....#", "####."),
    "T": ("#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."),
    "U": ("#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."),
    "V": ("#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."),
    "W": ("#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"),
    "X": ("#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"),
    "Y": ("#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."),
    "Z": ("#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"),
    "0": (".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."),
    "1": ("..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."),
    "2": ("####.", "....#", "....#", ".###.", "#....", "#....", "#####"),
    "3": ("####.", "....#", "....#", ".###.", "....#", "....#", "####."),
    "4": ("#...#", "#...#", "#...#", "#####", "....#", "....#", "....#"),
    "5": ("#####", "#....", "#....", "####.", "....#", "....#", "####."),
    "6": (".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."),
    "7": ("#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."),
    "8": (".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."),
    "9": (".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."),
    " ": (".....", ".....", ".....", ".....", ".....", ".....", "....."),
    "-": (".....", ".....", ".....", "#####", ".....", ".....", "....."),
    ".": (".....", ".....", ".....", ".....", ".....", ".##..", ".##.."),
    ",": (".....", ".....", ".....", ".....", ".##..", "..#..", ".#..."),
    ":": (".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."),
    "/": ("....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."),
    ">": ("#....", ".#...", "..#..", "...#.", "..#..", ".#...", "#...."),
    "<": ("....#", "...#.", "..#..", ".#...", "..#..", "...#.", "....#"),
    "+": (".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."),
    "!": ("..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."),
    "?": (".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."),
    "·": (".....", ".....", ".##..", ".##..", ".....", ".....", "....."),
    "'": ("..#..", "..#..", ".#...", ".....", ".....", ".....", "....."),
    "&": (".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"),
    "©": (".###.", "#...#", "#.##.", "#.##.", "#....", "#...#", ".###."),
}


def text_width(text: str, scale: int = 1, tracking: int = 1) -> int:
    if not text:
        return 0
    return (len(text) * 5 + (len(text) - 1) * tracking) * scale


def draw_text(
    canvas: Canvas,
    text: str,
    x: int,
    y: int,
    color: ColorLike,
    scale: int = 1,
    tracking: int = 1,
    shadow: ColorLike | None = None,
    outline: ColorLike | None = None,
) -> None:
    """Draw uppercase pixel type. Unknown glyphs render as a dot."""
    text = text.upper()

    def stamp(offset_x: int, offset_y: int, col: ColorLike) -> None:
        cx = x + offset_x
        for ch in text:
            glyph = FONT_5X7.get(ch, FONT_5X7["."])
            for gy, row in enumerate(glyph):
                for gx, bit in enumerate(row):
                    if bit == "#":
                        canvas.rect(cx + gx * scale, y + gy * scale + offset_y, scale, scale, col)
            cx += (5 + tracking) * scale

    if outline is not None:
        for ox, oy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1)):
            stamp(ox, oy, outline)
    if shadow is not None:
        stamp(1, 1, shadow)
    stamp(0, 0, color)


def checker(size: int, a: ColorLike = (34, 32, 42, 255), b: ColorLike = (45, 43, 55, 255)) -> Canvas:
    c = Canvas(size, size, a)
    half = max(1, size // 2)
    c.rect(0, 0, half, half, b)
    c.rect(half, half, half, half, b)
    return c


def upscale_nearest(image: Image.Image, factor: int) -> Image.Image:
    return image.resize((image.width * factor, image.height * factor), Image.Resampling.NEAREST)


def write_contact_sheet(
    out_path: str | Path,
    title: str,
    sections: Iterable[tuple[str, Image.Image, str | None]],
    *,
    width: int = 1500,
    padding: int = 28,
) -> Image.Image:
    """Compose a documentation contact sheet. Labels are documentation-only."""
    from PIL import ImageDraw, ImageFont

    font_paths = [
        Path("C:/Windows/Fonts/consola.ttf"),
        Path("C:/Windows/Fonts/cour.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"),
    ]
    font_path = next((p for p in font_paths if p.exists()), None)
    title_font = ImageFont.truetype(str(font_path), 34) if font_path else ImageFont.load_default()
    label_font = ImageFont.truetype(str(font_path), 16) if font_path else ImageFont.load_default()
    small_font = ImageFont.truetype(str(font_path), 13) if font_path else ImageFont.load_default()

    sections = list(sections)
    y = 0
    layout: list[tuple[str, Image.Image, str | None, int, int]] = []
    y += 90
    for title_text, image, caption in sections:
        section_h = 38 + image.height + (28 if caption else 12)
        layout.append((title_text, image, caption, padding, y))
        y += section_h + padding
    total_h = y + 30

    sheet = Image.new("RGBA", (width, total_h), C("void"))
    d = ImageDraw.Draw(sheet)
    d.rectangle((0, 0, width, 10), fill=C("rust"))
    d.rectangle((0, 10, width, 12), fill=C("gold"))
    d.text((padding, 28), title.upper(), font=title_font, fill=C("white"))
    d.text(
        (padding, 68),
        "RED FRONTIER / ORIGINAL PIXEL-ART ASSET REVIEW / NATIVE-RESOLUTION ART, 1PX MINIMUM DETAIL",
        font=small_font,
        fill=C("fog"),
    )

    for section_title, image, caption, x, y0 in layout:
        d.text((x, y0), section_title.upper(), font=label_font, fill=C("gold"))
        frame_y = y0 + 24
        image_w, image_h = image.size
        d.rectangle((x - 6, frame_y - 6, x + image_w + 5, frame_y + image_h + 5), fill=C("navy1"))
        d.rectangle((x - 6, frame_y - 6, x + image_w + 5, frame_y + image_h + 5), outline=C("steel_dark"))
        sheet.alpha_composite(image, (x, frame_y))
        if caption:
            d.text((x, frame_y + image_h + 8), caption, font=small_font, fill=C("fog"))
    sheet.convert("RGB").save(out_path)
    return sheet
