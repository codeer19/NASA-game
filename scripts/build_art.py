"""Build the complete RED FRONTIER art checkpoint deterministically.

Run from the project root:

    python scripts/build_art.py

The script regenerates every raster asset in client/public/assets, writes a
content manifest, builds the one-page contact sheet, and generates the local
review page at art-preview/index.html.

All art is authored by the checked-in Pillow scripts. No image-generation model,
third-party sprite pack, NASA photograph, logo or mission patch is used.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from characters import CHARACTERS, FRAME_H, FRAME_W, render_lineup, write_character_assets
from equipment import write_equipment
from pixel import Canvas, draw_text, text_width
from props_hq import write_props
from props_mars import write_mars_props
from scenes import SCENE_H, SCENE_W, write_scenes
from tiles_hq import build_hq_atlas
from tiles_mars import build_mars_atlas
from ui_assets import write_ui

ASSET_ROOT = ROOT / "client" / "public" / "assets"
PREVIEW_ROOT = ROOT / "art-preview"
CHECKPOINT = "Art Direction Checkpoint 01"
PALETTE_NOTE = "Master palette defined in scripts/pixel.py and docs/ART_BIBLE.md."

ROLE_COLORS = {
    "nia": "#C76537",
    "ren": "#2E8C80",
    "val": "#6F3344",
    "samir": "#344A67",
    "voss": "#14544F",
}

SILHOUETTES = {
    "nia": "Short twists, safety goggles on forehead, rust coveralls, tool belt.",
    "ren": "Undercut, headset ear cups and boom, teal field jacket, comms pack.",
    "val": "High bun, neat profile, wine waistcoat, gold jewelry, held tablet.",
    "samir": "Curly top, short beard, slate utility vest, mission lanyard and satchel.",
    "voss": "Silver bob, reading glasses, long lab coat over plum, clipboard.",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_assets() -> dict:
    ASSET_ROOT.mkdir(parents=True, exist_ok=True)
    characters = write_character_assets(ASSET_ROOT)
    hq_atlas, hq_meta = build_hq_atlas(ASSET_ROOT)
    mars_atlas, mars_meta = build_mars_atlas(ASSET_ROOT)
    props = write_props(ASSET_ROOT)
    mars_props = write_mars_props(ASSET_ROOT)
    equipment = write_equipment(ASSET_ROOT)
    ui = write_ui(ASSET_ROOT)
    scenes = write_scenes(ASSET_ROOT)
    return {
        "characters": characters,
        "hq_tiles": hq_meta,
        "mars_tiles": mars_meta,
        "props": props,
        "mars_props": mars_props,
        "equipment": equipment,
        "ui": ui,
        "scenes": scenes,
    }


def build_manifest(data: dict) -> dict:
    files = []
    for path in sorted(ASSET_ROOT.rglob("*")):
        if not path.is_file():
            continue
        if path.name == "manifest.json":
            continue
        if path.suffix.lower() not in {".png", ".json"}:
            continue
        rel = path.relative_to(ASSET_ROOT).as_posix()
        item = {
            "path": rel,
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        }
        if path.suffix.lower() == ".png":
            with Image.open(path) as image:
                item["width"] = image.width
                item["height"] = image.height
                item["mode"] = image.mode
        files.append(item)

    counts = {
        "characters": len(data["characters"]["sheets"]),
        "portraits": len(data["characters"]["portraits"]),
        "hqTiles": len(data["hq_tiles"]["tiles"]),
        "marsTiles": len(data["mars_tiles"]["tiles"]),
        "hqProps": len(data["props"]["hq"]),
        "labProps": len(data["props"]["lab"]),
        "marsProps": len(data["mars_props"]["props"]),
        "roverDirections": len(data["equipment"]["rover"]["directions"]),
        "equipmentIcons": len(data["equipment"]["components"]),
        "resourceIcons": len(data["ui"]["resourceIcons"]),
        "roleBadges": len(data["ui"]["roleBadges"]),
        "uiMarks": len(data["ui"]["marks"]),
        "branding": len(data["ui"]["branding"]),
        "scenes": len(data["scenes"]["scenes"]),
    }
    manifest = {
        "project": "RED FRONTIER - MISSION MARS",
        "checkpoint": CHECKPOINT,
        "status": "awaiting art approval",
        "generatedBy": "scripts/build_art.py",
        "palette": PALETTE_NOTE,
        "nativeResolution": {"sceneWidth": SCENE_W, "sceneHeight": SCENE_H},
        "counts": counts,
        "files": files,
        "rights": (
            "Original fictional project. Not affiliated with, endorsed by, or sponsored by NASA. "
            "No NASA logo, mission patch, photograph, facility reconstruction or employee likeness is used. "
            "All characters, organisations and hardware are fictional. Gameplay values are simplified educational values."
        ),
    }
    (ASSET_ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


# ---------------------------------------------------------------------------
# Contact sheet
# ---------------------------------------------------------------------------


def _checker(c: Canvas, x: int, y: int, w: int, h: int, cell: int = 8) -> None:
    for yy in range(y, y + h, cell):
        for xx in range(x, x + w, cell):
            if ((xx - x) // cell + (yy - y) // cell) % 2 == 0:
                c.rect(xx, yy, min(cell, x + w - xx), min(cell, y + h - yy), "navy2")
            else:
                c.rect(xx, yy, min(cell, x + w - xx), min(cell, y + h - yy), "navy1")


def _paste_scaled(c: Canvas, path: Path, x: int, y: int, scale: int) -> tuple[int, int]:
    with Image.open(path) as image:
        image = image.convert("RGBA")
        image = image.resize((image.width * scale, image.height * scale), Image.NEAREST)
        c.paste_image(image, x, y)
        return image.width, image.height


def _label(c: Canvas, text: str, x: int, y: int, color: str = "fog", scale: int = 1) -> int:
    draw_text(c, text, x, y, color, scale, 1)
    return text_width(text, scale, 1)


def _section(c: Canvas, number: str, title: str, x: int, y: int, width: int) -> None:
    draw_text(c, number, x, y, "gold", 2, 1)
    draw_text(c, title, x + 34, y - 2, "white", 2, 1)
    c.hline(x, y + 20, width, "steel_dark")
    c.hline(x, y + 21, max(40, width // 3), "rust")
    c.set(x + width - 1, y + 20, "cyan_dark")


def build_contact_sheet(data: dict) -> Path:
    c = Canvas(2400, 1600, "navy1")
    # backdrop texture: subtle authored bands, no gradients
    for y in range(0, c.height, 64):
        c.hline(0, y, c.width, "navy2" if (y // 64) % 2 else "navy1")
    for y in range(0, c.height, 64):
        c.hline(0, y + 63, c.width, "ink_soft")

    # header
    draw_text(c, "RED FRONTIER", 56, 30, "cream", 4, 1, shadow="ink")
    draw_text(c, "ART DIRECTION CHECKPOINT 01", 58, 90, "gold", 2, 1)
    draw_text(c, "MISSION MARS / NATIVE 384 X 224", 58, 112, "fog", 1, 1)
    note = "FICTIONAL PROJECT - NOT AFFILIATED WITH NASA"
    draw_text(c, note, 2344 - text_width(note, 1, 1), 34, "fog", 1, 1)
    draw_text(c, "AWAITING ART APPROVAL", 2344 - text_width("AWAITING ART APPROVAL", 2, 1), 62, "warning", 2, 1)
    draw_text(c, "ORIGINAL ART AUTHORED IN CODE - NO GENERATIVE IMAGERY", 2344 - text_width("ORIGINAL ART AUTHORED IN CODE - NO GENERATIVE IMAGERY", 1, 1), 92, "steel_light", 1, 1)
    c.hline(56, 134, 2288, "steel_dark")
    c.hline(56, 135, 760, "rust")

    # scenes
    _section(c, "01", "VISUAL TARGETS", 56, 154, 2288)
    scene_paths = [
        (ASSET_ROOT / "scenes" / "hq_mission_control.png", "HQ MISSION CONTROL", "DIALOGUE / MISSION BRIEFING"),
        (ASSET_ROOT / "scenes" / "hq_engineering_lab.png", "ENGINEERING LABORATORY", "ROVER BAY / ASSEMBLY"),
        (ASSET_ROOT / "scenes" / "mars_landing_zone.png", "ARES BASIN LANDING ZONE", "TRAVERSE / SAMPLE OPERATIONS"),
    ]
    sx = 56
    for path, title, subtitle in scene_paths:
        _checker(c, sx - 4, 198 - 4, 768 + 8, 448 + 8, 8)
        _paste_scaled(c, path, sx, 198, 2)
        draw_text(c, title, sx, 654, "cream", 1, 1)
        draw_text(c, subtitle, sx, 666, "fog", 1, 1)
        sx += 768 + 28

    # cast
    _section(c, "02", "FICTIONAL CAST", 56, 706, 2288)
    lineup = render_lineup(list(CHARACTERS.values()), scale=3).to_image()
    c.paste_image(lineup, 56, 744)
    _label(c, "24 X 32 FRAMES / 6 COLUMNS X 4 DIRECTIONS", 56, 884, "steel_light", 1)

    px = 620
    for ch in CHARACTERS.values():
        _checker(c, px - 4, 744 - 4, 48 * 2 + 8, 48 * 2 + 8, 6)
        _paste_scaled(c, ASSET_ROOT / "portraits" / f"{ch.file_stem}.png", px, 744, 2)
        draw_text(c, ch.short_name, px, 848, "cream", 1, 1)
        draw_text(c, {"nia":"ENGINEER","ren":"SATELLITE","val":"FINANCE","samir":"DESIGNER","voss":"SCIENTIST"}.get(ch.id, ch.role.split()[0]).upper(), px, 860, "fog", 1, 1)
        px += 124
    draw_text(c, "UNIQUE SILHOUETTE + ROLE COLOR PER CREW MEMBER", 620, 884, "steel_light", 1, 1)
    _checker(c, 1250 - 4, 744 - 4, 192 + 8, 128 + 8, 8)
    _paste_scaled(c, ASSET_ROOT / "rover" / "rover_assembled.png", 1250, 744, 2)
    draw_text(c, "MERIDIAN FIELD ROVER", 1250, 884, "cream", 1, 1)
    draw_text(c, "96 X 64 / FOUR AUTHORED DIRECTIONS", 1250, 896, "fog", 1, 1)
    draw_text(c, "SELECTIVE OUTLINES", 1640, 752, "gold", 1, 1)
    for i, line in enumerate((
        "UPPER-LEFT KEY LIGHT",
        "HARD ALPHA - NO ANTI-ALIASING",
        "NO BAKED SHADOWS ON SHEETS",
        "INTEGER-SCALE DELIVERY",
        "TEAL = INFORMATION",
        "GOLD = ACTION / OBJECTIVE",
    )):
        draw_text(c, line, 1640, 776 + i * 18, "cream" if i < 2 else "fog", 1, 1)
    _label(c, "ALL NAMED CHARACTERS ARE FICTIONAL.", 1640, 892, "steel_light", 1)

    # environments + gear
    _section(c, "03", "ENVIRONMENT SETS", 56, 952, 1080)
    _checker(c, 52, 990, 512 + 8, 512 + 8, 8)
    _paste_scaled(c, ASSET_ROOT / "tiles" / "hq_tiles.png", 56, 994, 4)
    draw_text(c, "HQ / LAB ATLAS - 64 TILES", 56, 1516, "cream", 1, 1)
    _checker(c, 616, 990, 512 + 8, 512 + 8, 8)
    _paste_scaled(c, ASSET_ROOT / "tiles" / "mars_tiles.png", 620, 994, 4)
    draw_text(c, "MARS ATLAS - 64 TILES", 620, 1516, "cream", 1, 1)
    draw_text(c, "16 X 16 SOURCE TILES / AUTHORED COLLISION NOTES IN JSON", 56, 1540, "fog", 1, 1)

    _section(c, "04", "ROVER + INTERFACE", 1210, 952, 1134)
    _checker(c, 1206, 990, 192 * 2 + 8, 128 * 2 + 8, 8)
    _paste_scaled(c, ASSET_ROOT / "rover" / "rover_assembled.png", 1210, 994, 2)
    draw_text(c, "ROVER HERO", 1210, 1128, "cream", 1, 1)
    draw_text(c, "96 X 64 / FOUR DIRECTIONS", 1210, 1140, "fog", 1, 1)

    ex = 1460
    ey = 994
    for i, component in enumerate(data["equipment"]["components"]):
        col, row = i % 4, i // 4
        x, y = ex + col * 104, ey + row * 112
        _checker(c, x - 4, y - 4, 96 + 8, 96 + 8, 6)
        _paste_scaled(c, ASSET_ROOT / component["file"], x, y, 3)
        draw_text(c, component["id"].upper().replace("_", " "), x, y + 96, "fog", 1, 1)
    draw_text(c, "RIGID CHASSIS / DRIVE / ROCKER-BOGIE / POWER / ANTENNA / ARM / SPECTROMETER / WEATHER", 1460, 1228, "steel_light", 1, 1)
    draw_text(c, "ALL VALUES IN GAME ARE SIMPLIFIED EDUCATIONAL GAMEPLAY VALUES.", 1460, 1242, "fog", 1, 1)

    ux = 1900
    uy = 994
    for i, resource in enumerate(data["ui"]["resourceIcons"]):
        col, row = i % 3, i // 3
        x, y = ux + col * 58, uy + row * 72
        _checker(c, x - 4, y - 4, 48 + 8, 48 + 8, 5)
        _paste_scaled(c, ASSET_ROOT / resource["file"], x, y, 3)
        draw_text(c, resource["name"].upper(), x, y + 48, "fog", 1, 1)
    draw_text(c, "SIX MISSION RESOURCES", 1900, 1138, "cream", 1, 1)

    # role marks and branding share the lower band
    for i, role in enumerate(data["ui"]["roleBadges"]):
        x = 1210 + i * 76
        y = 1290
        _checker(c, x - 4, y - 4, 64 + 8, 64 + 8, 5)
        _paste_scaled(c, ASSET_ROOT / role["file"], x, y, 2)
    draw_text(c, "FIVE ROLE MARKS", 1210, 1360, "cream", 1, 1)

    _checker(c, 1636, 1286, 192 + 8, 64 + 8, 6)
    _paste_scaled(c, ASSET_ROOT / "branding" / "logo_red_frontier.png", 1640, 1290, 1)
    _checker(c, 1846, 1286, 320 + 8, 64 + 8, 6)
    _paste_scaled(c, ASSET_ROOT / "branding" / "logo_mission_mars.png", 1850, 1294, 2)
    _checker(c, 2186, 1286, 64 + 8, 64 + 8, 6)
    _paste_scaled(c, ASSET_ROOT / "branding" / "patch_ares_survey.png", 2190, 1290, 1)
    draw_text(c, "ORIGINAL WORDMARKS + FICTIONAL PATCH", 1640, 1360, "cream", 1, 1)
    draw_text(c, "NO NASA INSIGNIA, TYPEFACE OR MISSION PATCH.", 1640, 1374, "fog", 1, 1)

    _checker(c, 1636, 1396, 152 + 8, 24 + 8, 5)
    _paste_scaled(c, ASSET_ROOT / "branding" / "wordmark_small.png", 1640, 1400, 1)
    draw_text(c, "COMPACT WORDMARK", 1640, 1430, "fog", 1, 1)
    _checker(c, 1830, 1396, 72 + 8, 72 + 8, 5)
    _paste_scaled(c, ASSET_ROOT / "ui" / "panel_9slice.png", 1834, 1400, 3)
    draw_text(c, "9-SLICE PANEL / 8 PX BORDER", 1830, 1482, "fog", 1, 1)

    draw_text(c, "SELECTIVE OUTLINES / UPPER-LEFT KEY / HARD ALPHA", 1210, 1470, "steel_light", 1, 1)
    draw_text(c, "TEAL = INFORMATION / GOLD = ACTION", 1210, 1484, "steel_light", 1, 1)

    # footer
    c.hline(56, 1560, 2288, "steel_dark")
    draw_text(c, "RED FRONTIER - MISSION MARS", 56, 1570, "gold", 1, 1)
    foot = "ORIGINAL FICTIONAL GAME ART / ART CHECKPOINT 01 / BUILD VIA SCRIPTS/BUILD_ART.PY"
    draw_text(c, foot, 2344 - text_width(foot, 1, 1), 1570, "fog", 1, 1)

    out = PREVIEW_ROOT / "contact_sheet.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    c.save(out)
    return out


# ---------------------------------------------------------------------------
# Review page
# ---------------------------------------------------------------------------


CSS = r"""
:root{
  --ink:#1A1422; --void:#0B1224; --navy0:#0A101D; --navy1:#162037; --navy2:#23324D;
  --navy3:#344A67; --steel-dark:#3C4A5C; --steel:#667687; --steel-light:#9CAAA7;
  --cream:#DFCFB0; --white:#F4EAD8; --fog:#AAB4B2;
  --rust:#A74A2E; --rust-dark:#6D2F22; --rust-light:#D06B3C; --gold:#F0B64B;
  --yellow:#FFDA7A; --cyan:#6ADBE0; --cyan-dark:#2D7183; --teal:#2E8C80; --wine:#6F3344;
  --line:#3C4A5C;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0;color:var(--cream);background:
    linear-gradient(180deg,rgba(11,18,36,.96),rgba(10,16,29,.99)),
    repeating-linear-gradient(0deg,transparent 0 3px,rgba(244,234,216,.018) 3px 4px);
  font-family:"Segoe UI",system-ui,-apple-system,sans-serif;line-height:1.55;
  -webkit-font-smoothing:antialiased;
}
a{color:var(--cyan);text-decoration:none}
a:hover{text-decoration:underline}
img{max-width:100%}
.pixel{image-rendering:pixelated}
.mono{font-family:"Courier New",ui-monospace,monospace}
.eyebrow{font:700 11px/1.4 "Courier New",monospace;letter-spacing:.22em;text-transform:uppercase;color:var(--gold)}
.status{display:inline-block;border:1px solid var(--gold);color:var(--gold);font:700 11px/1 "Courier New",monospace;letter-spacing:.18em;text-transform:uppercase;padding:9px 12px;background:rgba(240,182,75,.06);clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)}
.wrap{max-width:1420px;margin:0 auto;padding:0 24px}
header.hero{padding:46px 0 0;border-bottom:1px solid var(--line);position:relative;overflow:hidden}
header.hero:before{content:"";position:absolute;inset:0;background:
  linear-gradient(90deg,transparent 0 49.8%,rgba(106,219,224,.06) 49.8% 50.2%,transparent 50.2%),
  radial-gradient(ellipse at 78% 0%,rgba(208,107,60,.12),transparent 58%);
  pointer-events:none}
.hero-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(320px,.95fr);gap:36px;align-items:center;position:relative}
h1{font-family:"Courier New",monospace;font-size:clamp(54px,8.2vw,118px);line-height:.86;letter-spacing:.04em;margin:18px 0 8px;color:var(--white);text-shadow:4px 4px 0 var(--ink)}
h1 .red{color:var(--rust-light);display:block}
h1 .frontier{display:block;font-size:.62em;letter-spacing:.07em;margin-top:12px}
.hero-sub{color:var(--fog);max-width:60ch;font-size:15px}
.hero-meta{display:flex;flex-wrap:wrap;gap:10px 22px;margin:20px 0 0;font:11px/1.5 "Courier New",monospace;letter-spacing:.13em;text-transform:uppercase;color:var(--steel-light)}
.hero-art{position:relative;border:1px solid var(--line);background:var(--navy0);padding:8px;clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)}
.hero-art img{display:block;width:100%;image-rendering:pixelated;border:1px solid #26364e}
.hero-art .tag{display:block;margin-top:9px;padding:9px 2px 1px;border-top:1px solid var(--line);color:var(--gold);font:700 10px/1.4 "Courier New",monospace;letter-spacing:.15em;text-transform:uppercase}
nav{position:sticky;top:0;z-index:20;background:rgba(11,18,36,.94);border-bottom:1px solid var(--line);backdrop-filter:blur(6px)}
nav .wrap{display:flex;gap:22px;padding:12px 24px;overflow-x:auto;scrollbar-width:thin}
nav a{font:700 10px/1.4 "Courier New",monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--fog);white-space:nowrap}
nav a:hover{color:var(--cyan);text-decoration:none}
main{padding-bottom:60px}
section{padding-top:64px}
.section-head{display:flex;align-items:baseline;gap:16px;border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:26px}
.section-head .num{font:700 13px/1 "Courier New",monospace;color:var(--gold);letter-spacing:.14em}
.section-head h2{font-family:"Courier New",monospace;font-size:clamp(20px,2.6vw,32px);letter-spacing:.08em;text-transform:uppercase;margin:0;color:var(--white)}
.section-head .note{margin-left:auto;color:var(--fog);font:10px/1.4 "Courier New",monospace;letter-spacing:.12em;text-transform:uppercase;text-align:right}
.lede{color:var(--fog);max-width:78ch;margin:0 0 24px;font-size:15px}
.panel{background:rgba(22,32,55,.9);border:1px solid var(--line);box-shadow:inset 0 0 0 1px rgba(156,170,167,.07);position:relative}
.panel:before{content:"";position:absolute;left:0;top:0;width:9px;height:2px;background:var(--gold)}
.checker{background-color:#162037;background-image:
  linear-gradient(45deg,#23324D 25%,transparent 25%,transparent 75%,#23324D 75%),
  linear-gradient(45deg,#23324D 25%,transparent 25%,transparent 75%,#23324D 75%);
  background-size:16px 16px;background-position:0 0,8px 8px}
.cast-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(350px,1fr));gap:18px}
.cast-card{display:grid;grid-template-columns:96px minmax(0,1fr);gap:16px;padding:16px}
.cast-card .portrait{width:96px;height:96px;image-rendering:pixelated;border:1px solid var(--line);display:block}
.cast-card h3{margin:0;color:var(--white);font-size:17px;letter-spacing:.02em}
.cast-card .role{font:700 10px/1.5 "Courier New",monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin:4px 0 8px}
.cast-card p{margin:0;color:var(--fog);font-size:13px}
.sprite-stage{display:block;background-repeat:no-repeat;image-rendering:pixelated;margin:10px auto 0}
.dir-row{display:flex;gap:12px;align-items:flex-end;margin-top:12px;flex-wrap:wrap}
.dir{text-align:center;font:9px/1.4 "Courier New",monospace;letter-spacing:.12em;color:var(--fog);text-transform:uppercase}
.dir .sprite-stage{margin:4px auto 0}
.anim-box{display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap;padding:12px;border:1px solid rgba(60,74,92,.6);background:rgba(10,16,29,.5);margin-top:12px}
.sheet-details{margin-top:10px}
.sheet-details summary{cursor:pointer;color:var(--cyan);font:10px/1.4 "Courier New",monospace;letter-spacing:.12em;text-transform:uppercase}
.sheet-details img{display:block;margin-top:10px;width:288px;max-width:100%;image-rendering:pixelated;border:1px solid var(--line);background:#162037}
.tiles-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:20px}
.tile-card{padding:16px}
.tile-card h3{margin:0 0 4px;color:var(--white);font:700 12px/1.4 "Courier New",monospace;letter-spacing:.14em;text-transform:uppercase}
.tile-card p{margin:0 0 12px;color:var(--fog);font-size:13px}
.tile-card img{display:block;width:100%;max-width:512px;image-rendering:pixelated;border:1px solid var(--line);background:#162037}
details.tile-list{margin-top:12px}
details.tile-list summary{cursor:pointer;color:var(--cyan);font:10px/1.4 "Courier New",monospace;letter-spacing:.1em;text-transform:uppercase}
.tile-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px;max-height:160px;overflow:auto;padding-right:6px}
.tile-tags span{font:9px/1.2 "Courier New",monospace;color:var(--steel-light);border:1px solid rgba(60,74,92,.8);padding:3px 5px;background:rgba(10,16,29,.45)}
.scene-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:20px}
.scene-card{padding:12px}
.scene-card img{display:block;width:100%;image-rendering:pixelated;border:1px solid var(--line);background:#0a101d}
.scene-card h3{margin:12px 0 2px;color:var(--white);font:700 12px/1.4 "Courier New",monospace;letter-spacing:.12em;text-transform:uppercase}
.scene-card p{margin:0;color:var(--fog);font-size:12px}
.prop-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.prop{min-height:150px;padding:10px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:8px;overflow:hidden}
.prop img{max-width:100%;max-height:104px;image-rendering:pixelated}
.prop .name{font:700 9px/1.3 "Courier New",monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--cream);text-align:center}
.prop .dims{font:9px/1 "Courier New",monospace;color:var(--fog)}
.group-label{color:var(--gold);font:700 10px/1.4 "Courier New",monospace;letter-spacing:.17em;text-transform:uppercase;margin:26px 0 12px}
.gear-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}
.gear-card{padding:16px}
.gear-card h3{margin:0 0 4px;color:var(--white);font:700 12px/1.4 "Courier New",monospace;letter-spacing:.12em;text-transform:uppercase}
.gear-card p{margin:0 0 14px;color:var(--fog);font-size:12px}
.rover-row{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end}
.rover-row figure{margin:0;text-align:center;font:9px/1.5 "Courier New",monospace;letter-spacing:.1em;color:var(--fog);text-transform:uppercase}
.rover-row img{display:block;width:288px;max-width:100%;image-rendering:pixelated}
.icon-row{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}
.icon-item{text-align:center;font:9px/1.3 "Courier New",monospace;color:var(--fog);text-transform:uppercase;letter-spacing:.08em}
.icon-item img{display:block;image-rendering:pixelated;margin:0 auto 6px}
.contrast{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.contrast .swatch{padding:10px;border:1px solid var(--line)}
.contrast .dark{background:#162037}
.contrast .light{background:#DFCFB0;color:#1A1422}
.contrast .swatch .icon-row{gap:8px}
.brand-stack{display:grid;gap:10px}
.brand-stack img{display:block;max-width:100%;image-rendering:pixelated}
.brand-stack .logo{background:#162037;padding:8px;border:1px solid var(--line)}
.nine-slice{
  border:24px solid transparent;
  border-image:url(../client/public/assets/ui/panel_9slice.png) 8 fill / 24px / 0 stretch;
  width:min(100%,420px);min-height:86px;padding:6px 10px;image-rendering:pixelated;
  font:11px/1.5 "Courier New",monospace;color:var(--cream);
}
.nine-slice b{color:var(--gold)}
.manifest-card{padding:16px}
.manifest-card table{width:100%;border-collapse:collapse;font:10px/1.5 "Courier New",monospace}
.manifest-card th{text-align:left;color:var(--gold);font-weight:700;letter-spacing:.08em;border-bottom:1px solid var(--line);padding:7px 6px}
.manifest-card td{border-bottom:1px solid rgba(60,74,92,.45);padding:5px 6px;color:var(--fog);vertical-align:top;word-break:break-all}
.manifest-card td:first-child{color:var(--cream)}
details.manifest{max-height:520px;overflow:auto;margin-top:12px}
.downloads{display:flex;flex-wrap:wrap;gap:12px;margin-top:16px}
.downloads a{border:1px solid var(--line);background:rgba(22,32,55,.8);padding:10px 12px;font:700 10px/1.4 "Courier New",monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--cream)}
.downloads a:hover{border-color:var(--cyan);color:var(--cyan);text-decoration:none}
.checklist{display:grid;gap:10px;margin-top:8px}
.checklist label{display:flex;gap:12px;align-items:flex-start;padding:11px 12px;border:1px solid rgba(60,74,92,.65);background:rgba(10,16,29,.4);font-size:13px;color:var(--cream)}
.checklist input{margin-top:2px;accent-color:#2E8C80}
.checklist span small{display:block;color:var(--fog);font-size:11px;margin-top:2px}
.approval-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:20px;align-items:start}
.approval-side{padding:18px}
.approval-side h3{margin:0 0 8px;color:var(--white);font:700 12px/1.4 "Courier New",monospace;letter-spacing:.12em;text-transform:uppercase}
.approval-side p{color:var(--fog);font-size:13px;margin:0 0 12px}
.approval-side .stamp{border:1px dashed var(--gold);color:var(--gold);padding:12px;font:700 11px/1.6 "Courier New",monospace;letter-spacing:.14em;text-transform:uppercase;text-align:center}
.disclaimer{border-top:1px solid var(--line);margin-top:64px;padding:26px 0 40px;color:var(--fog);font-size:12px}
.disclaimer strong{color:var(--cream)}
.footer-row{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;font:10px/1.6 "Courier New",monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--steel-light)}
.corner{position:absolute;width:12px;height:12px;border-color:var(--gold);border-style:solid}
.corner.tl{left:-1px;top:-1px;border-width:1px 0 0 1px}.corner.tr{right:-1px;top:-1px;border-width:1px 1px 0 0}
.corner.bl{left:-1px;bottom:-1px;border-width:0 0 1px 1px}.corner.br{right:-1px;bottom:-1px;border-width:0 1px 1px 0}
@media (max-width:900px){
  .hero-grid{grid-template-columns:1fr;gap:22px}
  .approval-grid{grid-template-columns:1fr}
  .contrast{grid-template-columns:1fr}
  header.hero{padding-top:28px}
  section{padding-top:48px}
  .section-head .note{display:none}
}
@media (max-width:640px){
  .wrap{padding:0 18px}
  .cast-grid,.tiles-grid,.scene-grid,.gear-grid{grid-template-columns:minmax(0,1fr)}
  .cast-card{grid-template-columns:80px minmax(0,1fr);gap:12px;padding:14px}
  .cast-card .portrait{width:80px;height:80px}
  .anim-box{gap:12px}
  .hero-meta{gap:8px 16px}
}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
"""

JS = r"""
(function(){
  var demos = Array.prototype.slice.call(document.querySelectorAll('.sprite-stage'));
  var items = demos.map(function(el){
    var scale = parseInt(el.getAttribute('data-scale') || '3', 10);
    var fw = parseInt(el.getAttribute('data-fw') || '24', 10);
    var fh = parseInt(el.getAttribute('data-fh') || '32', 10);
    var row = parseInt(el.getAttribute('data-row') || '0', 10);
    var frames = (el.getAttribute('data-frames') || '0,1').split(',').map(Number);
    var fps = parseFloat(el.getAttribute('data-fps') || '6');
    var sheet = el.getAttribute('data-sheet');
    el.style.width = (fw * scale) + 'px';
    el.style.height = (fh * scale) + 'px';
    el.style.backgroundImage = 'url("' + sheet + '")';
    el.style.backgroundSize = (fw * 6 * scale) + 'px ' + (fh * 4 * scale) + 'px';
    return {el:el, fw:fw, fh:fh, row:row, frames:frames, fps:fps, scale:scale, index:0, next:performance.now()};
  });
  function frameFor(item, now){
    if(now >= item.next){
      item.index = (item.index + 1) % item.frames.length;
      item.next = now + (1000 / Math.max(0.1, item.fps));
    }
    var frame = item.frames[item.index] % 6;
    var x = -frame * item.fw * item.scale;
    var y = -item.row * item.fh * item.scale;
    item.el.style.backgroundPosition = x + 'px ' + y + 'px';
  }
  function tick(now){
    for(var i=0;i<items.length;i++){ frameFor(items[i], now); }
    requestAnimationFrame(tick);
  }
  if(items.length){ requestAnimationFrame(tick); }
})();
"""


def _character_cards(characters: list[dict]) -> str:
    cards = []
    for ch in characters:
        cid = ch["id"]
        stem = ch["image"].removesuffix(".png")
        portrait = f"../client/public/assets/portraits/{ch['image']}"
        sheet = f"../client/public/assets/characters/{ch['image']}"
        color = ROLE_COLORS.get(cid, "#DFCFB0")
        note = SILHOUETTES.get(cid, "")
        dirs = []
        for row, (label, frames) in enumerate((
            ("DOWN", "2,3,4,5"),
            ("LEFT", "8,9,10,11"),
            ("RIGHT", "14,15,16,17"),
            ("UP", "20,21,22,23"),
        )):
            dirs.append(
                f'<div class="dir">{label}<div class="sprite-stage" data-sheet="{sheet}" '
                f'data-row="{row}" data-frames="{frames}" data-fps="8" data-scale="2"></div></div>'
            )
        cards.append(
            f'''<article class="cast-card panel">
  <span class="corner tl"></span><span class="corner br"></span>
  <img class="portrait checker" src="{portrait}" width="96" height="96" alt="{ch['name']} dialogue portrait">
  <div>
    <h3>{ch['name']}</h3>
    <div class="role" style="color:{color}">{ch['role']}</div>
    <p>{note}</p>
    <div class="anim-box">
      <div class="dir">WALK<div class="sprite-stage" data-sheet="{sheet}" data-row="0" data-frames="2,3,4,5" data-fps="8" data-scale="3"></div></div>
      <div class="dir">IDLE<div class="sprite-stage" data-sheet="{sheet}" data-row="0" data-frames="0,1" data-fps="1.4" data-scale="3"></div></div>
    </div>
    <div class="dir-row">{''.join(dirs)}</div>
    <details class="sheet-details"><summary>Open full 6 x 4 sheet</summary>
      <img src="{sheet}" width="288" height="256" alt="{ch['name']} character sheet at 2x">
    </details>
  </div>
</article>'''
        )
    return "\n".join(cards)


def _tile_card(title: str, subtitle: str, image: str, meta: dict) -> str:
    kind_counts: dict[str, int] = {}
    for tile in meta["tiles"]:
        kind_counts[tile["kind"]] = kind_counts.get(tile["kind"], 0) + 1
    counts = " / ".join(f"{k.upper()} {v}" for k, v in sorted(kind_counts.items()))
    tags = "".join(f"<span>{tile['id']}</span>" for tile in meta["tiles"])
    return f'''<article class="tile-card panel">
  <h3>{title}</h3>
  <p>{subtitle}<br>{counts}</p>
  <img class="pixel checker" src="{image}" width="512" height="512" alt="{title} tile atlas at 4x">
  <details class="tile-list"><summary>Inspect all 64 tile IDs</summary><div class="tile-tags">{tags}</div></details>
</article>'''


def _prop_gallery(title: str, items: list[dict]) -> str:
    cards = []
    for item in items:
        w = item["width"] * 2
        h = item["height"] * 2
        label = item["id"].replace("_", " ").upper()
        cards.append(
            f'<figure class="prop checker"><img class="pixel" src="../client/public/assets/{item["file"]}" '
            f'width="{w}" height="{h}" alt="{label}"><figcaption class="name">{label}</figcaption>'
            f'<span class="dims">{item["width"]} X {item["height"]}</span></figure>'
        )
    return f'<div class="group-label">{title}</div><div class="prop-grid">{"".join(cards)}</div>'


def _manifest_rows(files: list[dict]) -> str:
    rows = []
    for item in files:
        dims = f'{item.get("width", "-")} x {item.get("height", "-")}' if "width" in item else "-"
        rows.append(
            f'<tr><td>{item["path"]}</td><td>{dims}</td><td>{item["bytes"]:,}</td>'
            f'<td>{item["sha256"][:16]}</td></tr>'
        )
    return "".join(rows)


def build_preview(data: dict, manifest: dict) -> Path:
    chars = data["characters"]["manifest"]["characters"]
    hq_meta = data["hq_tiles"]
    mars_meta = data["mars_tiles"]
    props = data["props"]
    mars_props = data["mars_props"]["props"]
    equipment = data["equipment"]
    ui = data["ui"]
    scenes = data["scenes"]["scenes"]
    counts = manifest["counts"]

    scene_cards = []
    scene_notes = {
        "hq_mission_control": "Mission briefing. Central double console, meeting table, Voss portrait and a 52 px dialogue box. Mock HUD copy is not live mission data.",
        "hq_engineering_lab": "Rover assembly bay. Gantry, tooling, wheel rack, component storage, work-lamp pool and the assembled MERIDIAN rover.",
        "mars_landing_zone": "Ares Basin. Landing pad decal, fictional lander, habitat, solar array, relay, sample site and compact field HUD.",
    }
    for scene in scenes:
        path = f"../client/public/assets/{scene['file']}"
        scene_cards.append(
            f'''<article class="scene-card panel"><span class="corner tl"></span><span class="corner br"></span>
  <a href="{path}" target="_blank" rel="noopener"><img class="pixel" src="{path}" width="768" height="448" alt="{scene['title']} at 2x"></a>
  <h3>{scene['title']}</h3>
  <p>{scene_notes.get(scene['id'], scene['note'])}</p>
  <p class="mono" style="margin-top:8px;color:#9CAAA7">{scene['width']} X {scene['height']} NATIVE / OPEN FOR 1X</p>
</article>'''
        )

    rover_frames = []
    for direction in equipment["rover"]["directions"]:
        path = f"../client/public/assets/rover/rover_{direction}.png"
        rover_frames.append(
            f'<figure><img class="pixel" src="{path}" width="288" height="192" alt="Rover facing {direction}"><figcaption>{direction}</figcaption></figure>'
        )

    equipment_cards = []
    for item in equipment["components"]:
        path = f"../client/public/assets/{item['file']}"
        equipment_cards.append(
            f'<div class="icon-item"><img class="pixel" src="{path}" width="128" height="128" alt="{item["name"]}">'
            f'{item["id"].replace("_", " ")}</div>'
        )

    resource_cards = []
    for item in ui["resourceIcons"]:
        path = f"../client/public/assets/{item['file']}"
        resource_cards.append(
            f'<div class="icon-item"><img class="pixel" src="{path}" width="64" height="64" alt="{item["name"]}">'
            f'{item["name"]}</div>'
        )

    role_cards = []
    for item in ui["roleBadges"]:
        path = f"../client/public/assets/{item['file']}"
        role_cards.append(
            f'<div class="icon-item"><img class="pixel" src="{path}" width="96" height="96" alt="{item["name"]}">'
            f'{item["name"]}</div>'
        )

    mark_cards = []
    for item in ui["marks"]:
        path = f"../client/public/assets/{item['file']}"
        mark_cards.append(
            f'<div class="icon-item"><img class="pixel" src="{path}" width="64" height="64" alt="{item["name"]}">'
            f'{item["id"].replace("_", " ")}</div>'
        )

    html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RED FRONTIER - Art Direction Checkpoint 01</title>
<meta name="description" content="Original 16-bit mission art for RED FRONTIER - MISSION MARS. Art-direction approval checkpoint.">
<style>{CSS}</style>
</head>
<body>
<header class="hero">
  <div class="wrap">
    <div class="hero-grid">
      <div>
        <div class="eyebrow">NASA Space Apps Challenge 2026 / original game project</div>
        <h1><span class="red">RED</span><span class="frontier">FRONTIER</span></h1>
        <p class="hero-sub">A cooperative Mars mission game about careful people solving difficult problems together. This page is the complete art-direction checkpoint: cast, environments, rover, equipment, interface and composed visual targets.</p>
        <div class="hero-meta">
          <span>Native 384 x 224</span><span>16 x 16 tiles</span><span>24 x 32 cast frames</span><span>Integer scaling</span>
        </div>
        <p style="margin:22px 0 0"><span class="status">Awaiting art approval / production paused</span></p>
      </div>
      <div class="hero-art">
        <img class="pixel" src="../client/public/assets/scenes/mars_landing_zone.png" width="384" height="224" alt="Mars landing zone visual target">
        <span class="tag">Visual target / Ares Basin / documentation only</span>
      </div>
    </div>
  </div>
</header>

<nav><div class="wrap">
  <a href="#direction">Direction</a>
  <a href="#cast">Cast</a>
  <a href="#environments">Environments</a>
  <a href="#props">Props</a>
  <a href="#gear">Rover + Gear</a>
  <a href="#interface">Interface</a>
  <a href="#scenes">Scenes</a>
  <a href="#manifest">Files</a>
  <a href="#approval">Approval</a>
</div></nav>

<main class="wrap">

<section id="direction">
  <div class="section-head"><span class="num">00</span><h2>Direction</h2><span class="note">Checkpoint 01 / November 2026</span></div>
  <p class="lede">A lost 16-bit adventure cartridge made by a contemporary aerospace design studio: warm, tactile and hand-built, with interfaces that are crisp, technical and calm. The palette is limited, outlines are selective, and every room explains what people do there before a line of dialogue is read.</p>
  <div class="tiles-grid">
    <article class="gear-card panel"><h3>What this checkpoint proves</h3>
      <p>One coherent visual language across three authored environments, five fictional characters, two 64-tile atlases, a six-wheel rover, instrument art and a complete interface kit.</p>
      <p class="mono" style="color:#9CAAA7">SELECTIVE OUTLINES / UPPER-LEFT KEY LIGHT / HARD ALPHA / NO BAKED SHADOWS ON CHARACTERS</p>
    </article>
    <article class="gear-card panel"><h3>Originality boundary</h3>
      <p>Every raster asset is drawn by checked-in Pillow scripts. No generative image model, third-party sprite pack, NASA photograph, logo, typeface, mission patch or employee likeness is used. Mars colour is a reference, not sampled imagery.</p>
      <p class="mono" style="color:#9CAAA7">FICTIONAL CAST / FICTIONAL HARDWARE / SIMPLIFIED EDUCATIONAL GAMEPLAY VALUES</p>
    </article>
    <article class="gear-card panel"><h3>Approval gate</h3>
      <p>Production integration is deliberately paused. If this direction is approved, implementation continues from these assets instead of restarting planning or replacing the art direction.</p>
      <p class="mono" style="color:#9CAAA7">REPLY APPROVED OR REQUEST CHANGES WITH NOTES</p>
    </article>
  </div>
</section>

<section id="cast">
  <div class="section-head"><span class="num">01</span><h2>Fictional Cast</h2><span class="note">5 characters / 4 directions / idle + walk + work</span></div>
  <p class="lede">Each character has one silhouette-defining accessory and one role colour. Animation strips are authored, not tweened or rotated. Right-facing frames are mirrored from the authored left row at export, as permitted by the art bible.</p>
  <div class="cast-grid">{_character_cards(chars)}</div>
</section>

<section id="environments">
  <div class="section-head"><span class="num">02</span><h2>Environment Sets</h2><span class="note">64 + 64 authored 16 px tiles</span></div>
  <p class="lede">The HQ atlas supplies navy acoustic panels, carpet, lab tile, steel service floor, hazard borders, cable runs, rugs and transition pieces. The Mars atlas separates dune sand, regolith, basalt shelf and crater families so the surface reads as geology rather than one red noise field.</p>
  <div class="tiles-grid">
    {_tile_card("HQ / LAB ATLAS", "Mission control and engineering bay. Fictional facility; not a reconstruction of a NASA building.", "../client/public/assets/tiles/hq_tiles.png", hq_meta)}
    {_tile_card("MARS ATLAS", "Ares Basin terrain families. Stylised gameplay terrain, not a georeferenced Mars dataset.", "../client/public/assets/tiles/mars_tiles.png", mars_meta)}
  </div>
</section>

<section id="props">
  <div class="section-head"><span class="num">03</span><h2>Props</h2><span class="note">18 HQ / 7 lab / 13 Mars / transparent</span></div>
  <p class="lede">Landmark props carry the narrative: the central mission display, double console, meeting table, gantry crane, rover jig, wheel rack, lander, habitat, solar array and the butte landmark. Metadata records bottom-centre anchors, with the landing pad marked as a centre-anchored ground decal.</p>
  {_prop_gallery("HQ / MISSION CONTROL", props["hq"])}
  {_prop_gallery("ENGINEERING LAB", props["lab"])}
  {_prop_gallery("MARS SURFACE", mars_props)}
</section>

<section id="gear">
  <div class="section-head"><span class="num">04</span><h2>Rover + Equipment</h2><span class="note">96 x 64 hero / 4 directions / 8 components</span></div>
  <p class="lede">The MERIDIAN rover is a fictional six-wheel rocker-bogie field science platform. The mast, high-gain antenna and arm create a distinctive top-down silhouette. Component cards use representational abstraction; none reproduces a NASA instrument, logo or photograph.</p>
  <div class="gear-grid">
    <article class="gear-card panel" style="grid-column:1/-1">
      <h3>MERIDIAN field rover / four authored directions</h3>
      <p>Hero composite at 3x, then native-direction exports. Right-facing art is mirrored from the authored left frame at export.</p>
      <div class="rover-row">{''.join(rover_frames)}</div>
      <p class="mono" style="margin-top:14px;color:#9CAAA7">ORIGIN 0.5 / 0.86 / BOTTOM-CENTRE CONTACT / NO BAKED SHADOW</p>
    </article>
    <article class="gear-card panel" style="grid-column:1/-1">
      <h3>Instrument and component icons / 32 x 32</h3>
      <p>Original game hardware. All performance values in the finished game will be labelled as simplified educational gameplay values, not operational specifications.</p>
      <div class="icon-row">{''.join(equipment_cards)}</div>
    </article>
  </div>
</section>

<section id="interface">
  <div class="section-head"><span class="num">05</span><h2>Interface + Branding</h2><span class="note">6 resources / 5 roles / 4 marks / 4 brand assets</span></div>
  <p class="lede">Compact mission-ops console crossed with a field notebook: chamfered panels, 1 px inset highlights, no glow bloom, no web-style pills. Colour is always redundant with icon and text. The wordmark, mission lockup and Ares Survey patch are original.</p>
  <div class="gear-grid">
    <article class="gear-card panel">
      <h3>Mission resources</h3>
      <p>Budget, mass, power, data, comms and time. Readable at 1x and 4x on both dark and cream panels.</p>
      <div class="icon-row">{''.join(resource_cards)}</div>
      <div class="contrast">
        <div class="swatch dark"><div class="icon-row">{''.join(f'<div class="icon-item"><img class="pixel" src="../client/public/assets/{item["file"]}" width="32" height="32" alt="{item["name"]} on navy"><span>{item["id"]}</span></div>' for item in ui["resourceIcons"])}</div></div>
        <div class="swatch light"><div class="icon-row">{''.join(f'<div class="icon-item"><img class="pixel" src="../client/public/assets/{item["file"]}" width="32" height="32" alt="{item["name"]} on cream"><span>{item["id"]}</span></div>' for item in ui["resourceIcons"])}</div></div>
      </div>
    </article>
    <article class="gear-card panel">
      <h3>Role marks</h3>
      <p>Original role badges. The cast is fictional and is not based on NASA employees.</p>
      <div class="icon-row">{''.join(role_cards)}</div>
      <h3 style="margin-top:22px">Interaction marks</h3>
      <p>Objective, scan, dialogue and wayfinding cues.</p>
      <div class="icon-row">{''.join(mark_cards)}</div>
    </article>
    <article class="gear-card panel">
      <h3>Panel behaviour</h3>
      <p>The 24 x 24 source panel uses an 8 px 9-slice border. Corner pixels are transparent so the frame stretches without softening.</p>
      <div class="nine-slice">MISSION CLOCK <b>T-04:12:30</b><br>SAMPLE SEAL VERIFIED<br><span style="color:#AAB4B2">MOCK INTERFACE COPY / NOT LIVE MISSION DATA</span></div>
    </article>
    <article class="gear-card panel">
      <h3>Branding</h3>
      <p>Primary wordmark, mission lockup and the fictional Ares Survey patch.</p>
      <div class="brand-stack">
        <img class="logo pixel" src="../client/public/assets/branding/logo_red_frontier.png" width="384" height="128" alt="RED FRONTIER fictional wordmark">
        <img class="logo pixel" src="../client/public/assets/branding/logo_mission_mars.png" width="320" height="64" alt="MISSION MARS fictional mission lockup">
        <img class="pixel" src="../client/public/assets/branding/patch_ares_survey.png" width="192" height="192" alt="Fictional Ares Survey patch">
      </div>
    </article>
  </div>
</section>

<section id="scenes">
  <div class="section-head"><span class="num">06</span><h2>Composed Scenes</h2><span class="note">384 x 224 native / documentation targets</span></div>
  <p class="lede">These are composed visual-direction targets built from the delivered assets, not in-game screenshots. They prove that the tiles, props, cast and HUD language fit together at native resolution. All HUD copy is mock interface text, not live mission data.</p>
  <div class="scene-grid">{''.join(scene_cards)}</div>
</section>

<section id="manifest">
  <div class="section-head"><span class="num">07</span><h2>Files + Reproducibility</h2><span class="note">{len(manifest["files"])} delivered files / SHA-256 recorded</span></div>
  <p class="lede">Every raster asset is regenerated by <span class="mono">python scripts/build_art.py</span> and validated by <span class="mono">python scripts/validate_art.py</span>. The production asset root is <span class="mono">client/public/assets/</span>; metadata JSON sits beside each group.</p>
  <div class="gear-grid">
    <article class="manifest-card panel">
      <h3 style="margin:0 0 8px;color:#F4EAD8;font:700 12px/1.4 'Courier New',monospace;letter-spacing:.12em;text-transform:uppercase">Delivery counts</h3>
      <table><tbody>
        <tr><td>Fictional cast</td><td>{counts["characters"]}</td></tr>
        <tr><td>Dialogue portraits</td><td>{counts["portraits"]}</td></tr>
        <tr><td>HQ tiles</td><td>{counts["hqTiles"]}</td></tr>
        <tr><td>Mars tiles</td><td>{counts["marsTiles"]}</td></tr>
        <tr><td>HQ / lab / Mars props</td><td>{counts["hqProps"]} / {counts["labProps"]} / {counts["marsProps"]}</td></tr>
        <tr><td>Rover directions</td><td>{counts["roverDirections"]}</td></tr>
        <tr><td>Equipment icons</td><td>{counts["equipmentIcons"]}</td></tr>
        <tr><td>Resource icons / role badges</td><td>{counts["resourceIcons"]} / {counts["roleBadges"]}</td></tr>
        <tr><td>UI marks / brand assets</td><td>{counts["uiMarks"]} / {counts["branding"]}</td></tr>
        <tr><td>Composed scenes</td><td>{counts["scenes"]}</td></tr>
      </tbody></table>
      <div class="downloads">
        <a href="contact_sheet.png">Contact sheet PNG</a>
        <a href="../client/public/assets/manifest.json">Asset manifest JSON</a>
        <a href="VALIDATION.md">Validation report</a>
      </div>
    </article>
    <article class="manifest-card panel">
      <h3 style="margin:0 0 8px;color:#F4EAD8;font:700 12px/1.4 'Courier New',monospace;letter-spacing:.12em;text-transform:uppercase">Build commands</h3>
      <p class="mono" style="color:#AAB4B2;font-size:11px">python scripts/build_art.py<br>python scripts/validate_art.py<br>python -m http.server 8000</p>
      <p style="color:#AAB4B2;font-size:12px">This page uses no external fonts, libraries or network requests. Open it directly, or serve the repository root over HTTP for the most predictable local review.</p>
    </article>
  </div>
  <details class="panel manifest-card manifest" style="margin-top:14px"><summary style="cursor:pointer;color:var(--cyan);font:700 10px/1.4 'Courier New',monospace;letter-spacing:.12em;text-transform:uppercase">Open full file manifest</summary>
    <table><thead><tr><th>Path</th><th>Native size</th><th>Bytes</th><th>SHA-256 prefix</th></tr></thead><tbody>{_manifest_rows(manifest["files"])}</tbody></table>
  </details>
</section>

<section id="approval">
  <div class="section-head"><span class="num">08</span><h2>Approval Checklist</h2><span class="note">Production remains paused until sign-off</span></div>
  <div class="approval-grid">
    <div class="panel" style="padding:18px">
      <p class="lede" style="margin-bottom:10px">The approver reviews the direction and marks each item. These controls are local and do not change the project state.</p>
      <div class="checklist">
        <label><input type="checkbox"><span>Cast direction approved<small>Five fictional characters, silhouettes, role colours, portraits and four-direction animation.</small></span></label>
        <label><input type="checkbox"><span>Environment language approved<small>Mission control, engineering lab, Mars landing zone and both 64-tile atlases.</small></span></label>
        <label><input type="checkbox"><span>Rover + equipment approved<small>MERIDIAN rover, eight component icons and their representational style.</small></span></label>
        <label><input type="checkbox"><span>Interface + branding approved<small>Resource icons, role marks, 9-slice panel, wordmark, mission lockup and patch.</small></span></label>
        <label><input type="checkbox"><span>Scenes + palette approved<small>Three composed visual targets, lighting, contrast and readability at 384 x 224.</small></span></label>
        <label><input type="checkbox"><span>Originality + rights boundary approved<small>No NASA insignia, mission patch, photograph, employee likeness or third-party character art.</small></span></label>
        <label><input type="checkbox"><span>Permission to continue implementation<small>Proceed from these assets into game systems, missions, sound and deployment without restarting art direction.</small></span></label>
      </div>
    </div>
    <aside class="approval-side panel">
      <h3>Decision</h3>
      <p>Reply with <strong style="color:var(--gold)">APPROVED</strong> to unlock production, or <strong style="color:var(--gold)">REQUEST CHANGES</strong> with the specific asset and direction note.</p>
      <div class="stamp">STATUS<br>PENDING ART APPROVAL<br>PRODUCTION PAUSED</div>
      <p style="margin-top:14px">If changes are requested, only the named assets are revised. The approved direction is not re-planned or replaced.</p>
    </aside>
  </div>
</section>

<footer class="disclaimer">
  <div class="footer-row"><span>RED FRONTIER / MISSION MARS</span><span>Art Direction Checkpoint 01</span></div>
  <p><strong>Fictional project notice.</strong> RED FRONTIER is an original fictional game project. It is not affiliated with, endorsed by, or sponsored by NASA. No NASA logo, mission patch, photograph, facility reconstruction or employee likeness is used. All named characters, organisations and hardware are fictional. Mission statistics, resources and instrument performance are simplified educational gameplay values, not operational data or real mission specifications.</p>
  <p><strong>Art provenance.</strong> Every raster asset on this page is authored by checked-in drawing code in <span class="mono">scripts/</span> and rendered deterministically. No generative image model, third-party sprite pack or traced protected graphic is used.</p>
</footer>

</main>
<script>{JS}</script>
</body>
</html>
'''
    out = PREVIEW_ROOT / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    return out


def main() -> None:
    data = build_assets()
    manifest = build_manifest(data)
    sheet = build_contact_sheet(data)
    page = build_preview(data, manifest)
    print(f"Art assets:    {ASSET_ROOT}")
    print(f"Asset files:   {len(manifest['files'])}")
    print(f"Contact sheet: {sheet}")
    print(f"Review page:   {page}")


if __name__ == "__main__":
    main()
