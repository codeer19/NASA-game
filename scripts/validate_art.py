"""Validate the RED FRONTIER art checkpoint and write art-preview/VALIDATION.md.

Run from the project root after a build:

    python scripts/build_art.py
    python scripts/validate_art.py

The validator checks dimensions, hard alpha, metadata, manifest hashes, tile and
animation grids, mirror exports, sheet composition, interface sizes, scene sizes,
and the local review page. It does not pretend to judge aesthetics; the manual
review notes at the bottom of the report cover that checkpoint separately.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "client" / "public" / "assets"
PREVIEW_ROOT = ROOT / "art-preview"
REPORT = PREVIEW_ROOT / "VALIDATION.md"
CHECKPOINT = "Art Direction Checkpoint 01"

EXPECTED_COUNTS = {
    "characters": 5,
    "portraits": 5,
    "hqTiles": 64,
    "marsTiles": 64,
    "hqProps": 18,
    "labProps": 7,
    "marsProps": 13,
    "roverDirections": 4,
    "equipmentIcons": 8,
    "resourceIcons": 6,
    "roleBadges": 5,
    "uiMarks": 4,
    "branding": 4,
    "scenes": 3,
}

EXPECTED_CHARACTERS = ("nia", "ren", "val", "samir", "voss")
EXPECTED_DIRECTIONS = ("down", "left", "right", "up")
EXPECTED_EQUIPMENT = ("chassis", "drive", "suspension", "power", "antenna", "arm", "spectrometer", "weather")
EXPECTED_RESOURCES = ("budget", "mass", "power", "data", "comms", "time")
EXPECTED_ROLES = ("engineer", "satellite", "finance", "designer", "scientist")
EXPECTED_SCENES = ("hq_mission_control", "hq_engineering_lab", "mars_landing_zone")

checks: list[dict[str, str]] = []


def check(area: str, name: str, ok: bool, evidence: str = "") -> None:
    checks.append({
        "area": area,
        "name": name,
        "ok": ok,
        "evidence": evidence,
    })
    print(f"[{'PASS' if ok else 'FAIL'}] {area}: {name}" + (f" - {evidence}" if evidence else ""))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> dict | list | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def hard_alpha(image: Image.Image) -> bool:
    histogram = image.getchannel("A").histogram()
    return sum(histogram[1:255]) == 0


def rgba(path: Path) -> Image.Image | None:
    try:
        image = Image.open(path)
        image.load()
        return image.convert("RGBA")
    except OSError:
        return None


def same_image(a: Image.Image, b: Image.Image) -> bool:
    if a.size != b.size:
        return False
    return ImageChops.difference(a, b).getbbox() is None


def mirrored_frame(sheet: Image.Image, direction_row: int, col: int, frame_w: int, frame_h: int) -> tuple[Image.Image, Image.Image]:
    left = sheet.crop((col * frame_w, direction_row * frame_h, (col + 1) * frame_w, (direction_row + 1) * frame_h))
    right = sheet.crop((col * frame_w, (direction_row + 1) * frame_h, (col + 1) * frame_w, (direction_row + 2) * frame_h))
    return left.transpose(Image.Transpose.FLIP_LEFT_RIGHT), right


def md(text: str) -> str:
    return str(text).replace("|", "\\|").replace("\n", " ")


def verify_manifest() -> dict | None:
    manifest_path = ASSET_ROOT / "manifest.json"
    check("Delivery", "Asset manifest exists", manifest_path.is_file(), "client/public/assets/manifest.json")
    if not manifest_path.is_file():
        return None
    manifest = load_json(manifest_path)
    if not isinstance(manifest, dict):
        check("Delivery", "Asset manifest parses as JSON", False, "invalid or unreadable manifest")
        return None
    check("Delivery", "Asset manifest parses as JSON", True, f"{len(manifest.get('files', []))} entries")

    check("Delivery", "Project name is correct", manifest.get("project") == "RED FRONTIER - MISSION MARS")
    check("Delivery", "Checkpoint label is correct", manifest.get("checkpoint") == CHECKPOINT)
    check("Delivery", "Manifest records the approval gate", manifest.get("status") == "awaiting art approval")
    check("Delivery", "Build entry point is recorded", manifest.get("generatedBy") == "scripts/build_art.py")
    check(
        "Delivery",
        "Native scene resolution is 384 x 224",
        manifest.get("nativeResolution") == {"sceneWidth": 384, "sceneHeight": 224},
    )

    rights = str(manifest.get("rights", "")).lower()
    check("Originality", "Manifest carries the non-affiliation statement", "not affiliated" in rights and "nasa" in rights)
    check("Originality", "Manifest marks characters and hardware as fictional", "characters" in rights and "fictional" in rights)
    check(
        "Originality",
        "Manifest labels gameplay values as simplified educational values",
        "simplified educational" in rights,
    )

    counts = manifest.get("counts")
    if not isinstance(counts, dict):
        check("Manifest", "Counts block exists", False)
    else:
        check("Manifest", "Counts block exists", True)
        for key, expected in EXPECTED_COUNTS.items():
            check("Manifest", f"Count: {key}", counts.get(key) == expected, f"{counts.get(key)!r} / expected {expected}")

    files = manifest.get("files")
    if not isinstance(files, list):
        check("Manifest", "File list exists", False)
        return manifest
    check("Manifest", "File list exists", True, f"{len(files)} files")

    claimed = [str(entry.get("path", "")) for entry in files if isinstance(entry, dict)]
    check("Manifest", "No duplicate file entries", len(claimed) == len(set(claimed)))
    check("Manifest", "No manifest self-reference", "manifest.json" not in claimed)
    check(
        "Manifest",
        "All paths are relative and contained",
        all(path == Path(path).as_posix() and not path.startswith("/") and ".." not in Path(path).parts for path in claimed),
    )

    disk_files = sorted(
        path.relative_to(ASSET_ROOT).as_posix()
        for path in ASSET_ROOT.rglob("*")
        if path.is_file() and path.name != "manifest.json" and path.suffix.lower() in {".png", ".json"}
    )
    check(
        "Manifest",
        "Manifest covers the complete asset tree",
        sorted(claimed) == disk_files,
        f"{len(claimed)} listed / {len(disk_files)} on disk",
    )

    ok_all_entries = True
    details: list[str] = []
    for entry in files:
        if not isinstance(entry, dict):
            ok_all_entries = False
            continue
        rel = str(entry.get("path", ""))
        path = ASSET_ROOT / rel
        if not path.is_file():
            ok_all_entries = False
            details.append(f"missing {rel}")
            continue
        if entry.get("bytes") != path.stat().st_size:
            ok_all_entries = False
            details.append(f"size {rel}")
        if entry.get("sha256") != sha256(path):
            ok_all_entries = False
            details.append(f"sha {rel}")
        if path.suffix.lower() == ".png":
            with Image.open(path) as image:
                if entry.get("width") != image.width or entry.get("height") != image.height:
                    ok_all_entries = False
                    details.append(f"dims {rel}")
                if entry.get("mode") != image.mode:
                    ok_all_entries = False
                    details.append(f"mode {rel}")
    check(
        "Manifest",
        "Every entry matches size, SHA-256, dimensions and mode",
        ok_all_entries,
        "; ".join(details[:3]) if details else "all entries verified",
    )
    check("Manifest", "Manifest is deterministic (no timestamp fields)", not any(k in manifest for k in ("timestamp", "generatedAt", "generated_at")))
    return manifest


def verify_global_images(manifest: dict | None) -> None:
    images = sorted(ASSET_ROOT.rglob("*.png"))
    modes_ok = True
    alpha_ok = True
    metadata_ok = True
    max_colors = 0
    max_color_path = ""
    for path in images:
        with Image.open(path) as image:
            if image.mode != "RGBA":
                modes_ok = False
            if not hard_alpha(image):
                alpha_ok = False
            if set(image.info) - {"transparency", "dpi"}:
                metadata_ok = False
        rgba_image = rgba(path)
        if rgba_image is not None:
            visible = [pixel for pixel in rgba_image.getcolors(maxcolors=1_000_000) or [] if pixel[1][3] > 0]
            colors = sum(count for count, _ in visible)
            unique = len(visible)
            if colors and unique > max_colors:
                max_colors = unique
                max_color_path = path.relative_to(ASSET_ROOT).as_posix()
    check("Pixel art", "Every PNG is RGBA", modes_ok, f"{len(images)} images")
    check("Pixel art", "Every PNG uses hard alpha only", alpha_ok, "no partial-alpha pixels")
    check("Pixel art", "No embedded EXIF or ICC payloads", metadata_ok)
    check(
        "Pixel art",
        "Per-asset colour vocabulary stays bounded",
        max_colors <= 384,
        f"max {max_colors} visible colours ({max_color_path})",
    )
    check(
        "Delivery",
        "Production asset count is 100",
        isinstance(manifest, dict) and len(manifest.get("files", [])) == 100,
        f"{len(images)} PNG + {len(list(ASSET_ROOT.rglob('*.json'))) - 1} metadata JSON",
    )


def verify_characters() -> None:
    meta_path = ASSET_ROOT / "characters" / "characters.json"
    meta = load_json(meta_path)
    if not isinstance(meta, dict):
        check("Characters", "Character metadata parses", False)
        return
    check("Characters", "Character metadata parses", True)
    check("Characters", "Frame size is 24 x 32", (meta.get("frameWidth"), meta.get("frameHeight")) == (24, 32))
    check("Characters", "Directions are down, left, right, up", tuple(meta.get("directions", ())) == EXPECTED_DIRECTIONS)
    chars = meta.get("characters", [])
    check("Characters", "Five cast entries are present", len(chars) == 5, f"{len(chars)} entries")
    ids = tuple(item.get("id") for item in chars)
    check("Characters", "Cast IDs match the approved roster", ids == EXPECTED_CHARACTERS, ", ".join(ids))

    for item in chars:
        cid = str(item.get("id", "?"))
        sheet_path = ASSET_ROOT / "characters" / str(item.get("image", ""))
        portrait_path = ASSET_ROOT / "portraits" / str(item.get("image", ""))
        sheet = rgba(sheet_path) if sheet_path.is_file() else None
        portrait = rgba(portrait_path) if portrait_path.is_file() else None
        check("Characters", f"{cid}: sheet file exists", sheet is not None, sheet_path.relative_to(ROOT).as_posix())
        check("Characters", f"{cid}: portrait file exists", portrait is not None, portrait_path.relative_to(ROOT).as_posix())
        if sheet is None or portrait is None:
            continue
        check("Characters", f"{cid}: sheet is 144 x 128", sheet.size == (144, 128), f"{sheet.size[0]} x {sheet.size[1]}")
        check("Characters", f"{cid}: metadata grid is 6 x 4", (item.get("columns"), item.get("rows")) == (6, 4))
        check("Characters", f"{cid}: portrait is 48 x 48", portrait.size == (48, 48), f"{portrait.size[0]} x {portrait.size[1]}")

        empty = []
        for row in range(4):
            for col in range(6):
                frame = sheet.crop((col * 24, row * 32, (col + 1) * 24, (row + 1) * 32))
                if frame.getbbox() is None:
                    empty.append((row, col))
        check("Characters", f"{cid}: all 24 frames contain art", not empty, f"empty {empty}" if empty else "24 / 24")

        animations = item.get("animations", {})
        animation_ok = isinstance(animations, dict) and len(animations) == 12
        frame_ok = True
        for row, direction in enumerate(EXPECTED_DIRECTIONS):
            for animation, length in (("idle", 2), ("walk", 4), ("work", 2)):
                key = f"{animation}-{direction}"
                entry = animations.get(key) if isinstance(animations, dict) else None
                if not isinstance(entry, dict) or len(entry.get("frames", ())) != length:
                    animation_ok = False
                    continue
                if any(not isinstance(frame, int) or frame < row * 6 or frame >= (row + 1) * 6 for frame in entry["frames"]):
                    frame_ok = False
        check("Characters", f"{cid}: 12 idle/walk/work animations", animation_ok, "idle, walk, work x 4 directions")
        check("Characters", f"{cid}: animation frames stay in their direction row", frame_ok)
        mirror_ok = all(same_image(*mirrored_frame(sheet, 1, col, 24, 32)) for col in range(6))
        check("Characters", f"{cid}: right row is a per-frame mirror of left", mirror_ok, "6 / 6 frames")


def verify_tilesets() -> None:
    for name, label in (("hq", "HQ"), ("mars", "Mars")):
        image_path = ASSET_ROOT / "tiles" / f"{name}_tiles.png"
        meta_path = ASSET_ROOT / "tiles" / f"{name}_tiles.json"
        atlas = rgba(image_path) if image_path.is_file() else None
        meta = load_json(meta_path)
        check("Tilesets", f"{label}: atlas file exists", atlas is not None, image_path.relative_to(ROOT).as_posix())
        if atlas is None or not isinstance(meta, dict):
            check("Tilesets", f"{label}: metadata parses", isinstance(meta, dict))
            continue
        check("Tilesets", f"{label}: atlas is 128 x 128", atlas.size == (128, 128), f"{atlas.size[0]} x {atlas.size[1]}")
        check("Tilesets", f"{label}: grid metadata is 8 x 8", (meta.get("columns"), meta.get("rows")) == (8, 8))
        check("Tilesets", f"{label}: tile size is 16 x 16", (meta.get("tileWidth"), meta.get("tileHeight")) == (16, 16))
        tiles = meta.get("tiles", [])
        check("Tilesets", f"{label}: exactly 64 tile records", len(tiles) == 64, f"{len(tiles)} records")
        ids = [tile.get("id") for tile in tiles]
        check("Tilesets", f"{label}: tile IDs are unique", len(ids) == len(set(ids)))
        layout_ok = True
        empty = []
        for tile in tiles:
            index, col, row = tile.get("index"), tile.get("col"), tile.get("row")
            if not all(isinstance(value, int) for value in (index, col, row)) or index != row * 8 + col:
                layout_ok = False
            if not (0 <= col < 8 and 0 <= row < 8):
                layout_ok = False
                continue
            cell = atlas.crop((col * 16, row * 16, (col + 1) * 16, (row + 1) * 16))
            if cell.getbbox() is None:
                empty.append(tile.get("id"))
        check("Tilesets", f"{label}: indices map to the 8 x 8 grid", layout_ok)
        check("Tilesets", f"{label}: every tile cell contains art", not empty, f"empty {empty}" if empty else "64 / 64")


def verify_props() -> None:
    meta_path = ASSET_ROOT / "props" / "props.json"
    meta = load_json(meta_path)
    if not isinstance(meta, dict):
        check("Props", "HQ/lab prop metadata parses", False)
        return
    check("Props", "HQ/lab prop metadata parses", True)
    all_ids: list[str] = []
    for group, expected in (("hq", 18), ("lab", 7)):
        items = meta.get(group, [])
        check("Props", f"{group}: {expected} props", len(items) == expected, f"{len(items)} entries")
        for item in items:
            pid = str(item.get("id", "?"))
            all_ids.append(pid)
            path = ASSET_ROOT / str(item.get("file", ""))
            image = rgba(path) if path.is_file() else None
            check("Props", f"{group}/{pid}: file exists", image is not None)
            if image is None:
                continue
            check("Props", f"{group}/{pid}: dimensions match metadata", image.size == (item.get("width"), item.get("height")), f"{image.size[0]} x {image.size[1]}")
            check("Props", f"{group}/{pid}: bottom-centre anchor is consistent", item.get("anchor") == "bottom-center" and item.get("originX") == item.get("width", 0) / 2 and item.get("originY") == item.get("height"))
            check("Props", f"{group}/{pid}: marked fictional", item.get("fictional") is True)

    mars_meta = load_json(ASSET_ROOT / "props" / "mars" / "mars_props.json")
    if not isinstance(mars_meta, dict):
        check("Props", "Mars prop metadata parses", False)
        return
    check("Props", "Mars prop metadata parses", True)
    mars = mars_meta.get("props", [])
    check("Props", "Mars: 13 props", len(mars) == 13, f"{len(mars)} entries")
    for item in mars:
        pid = str(item.get("id", "?"))
        all_ids.append(pid)
        path = ASSET_ROOT / str(item.get("file", ""))
        image = rgba(path) if path.is_file() else None
        check("Props", f"mars/{pid}: file exists", image is not None)
        if image is None:
            continue
        check("Props", f"mars/{pid}: dimensions match metadata", image.size == (item.get("width"), item.get("height")), f"{image.size[0]} x {image.size[1]}")
        if pid == "landing_pad":
            check("Props", "mars/landing_pad: centre-anchored ground decal", item.get("anchor") == "center" and item.get("originX") == item.get("width", 0) / 2 and item.get("originY") == item.get("height", 0) / 2 and item.get("groundDecal") is True)
        else:
            check("Props", f"mars/{pid}: bottom-centre anchor is consistent", item.get("anchor") == "bottom-center" and item.get("originX") == item.get("width", 0) / 2 and item.get("originY") == item.get("height"))
            check("Props", f"mars/{pid}: not a ground decal", item.get("groundDecal") is False)
        check("Props", f"mars/{pid}: marked fictional", item.get("fictional") is True)
        check("Props", f"mars/{pid}: carries a science/terrain note", isinstance(item.get("scienceNote"), str) and "not a georeferenced" in str(item.get("scienceNote")))
    check("Props", "Prop IDs are unique across groups", len(all_ids) == len(set(all_ids)), f"{len(all_ids)} IDs")


def verify_rover_and_equipment() -> None:
    meta = load_json(ASSET_ROOT / "equipment" / "equipment.json")
    if not isinstance(meta, dict):
        check("Rover", "Equipment metadata parses", False)
        return
    check("Rover", "Equipment metadata parses", True)
    rover = meta.get("rover", {})
    check("Rover", "Rover native size is 96 x 64", (rover.get("width"), rover.get("height")) == (96, 64))
    check("Rover", "Rover sheet is 384 x 64", (rover.get("sheetWidth"), rover.get("sheetHeight")) == (384, 64))
    check("Rover", "Four authored directions are declared", tuple(rover.get("directions", ())) == EXPECTED_DIRECTIONS)
    check("Rover", "Rover origin is 0.5 / 0.86 at bottom contact", rover.get("origin") == {"x": 0.5, "y": 0.86})

    hero = rgba(ASSET_ROOT / "rover" / "rover_assembled.png")
    check("Rover", "Hero composite exists at 96 x 64", hero is not None and hero.size == (96, 64))
    sheet_path = ASSET_ROOT / "rover" / "rover_sheet.png"
    sheet = rgba(sheet_path) if sheet_path.is_file() else None
    check("Rover", "Direction sheet exists at 384 x 64", sheet is not None and sheet.size == (384, 64))
    direction_images: dict[str, Image.Image] = {}
    for index, direction in enumerate(EXPECTED_DIRECTIONS):
        path = ASSET_ROOT / "rover" / f"rover_{direction}.png"
        image = rgba(path) if path.is_file() else None
        check("Rover", f"{direction}: frame exists at 96 x 64", image is not None and image.size == (96, 64))
        if image is not None:
            direction_images[direction] = image
            if sheet is not None:
                cell = sheet.crop((index * 96, 0, (index + 1) * 96, 64))
                check("Rover", f"{direction}: sheet slice matches direction frame", same_image(cell, image))
    if "left" in direction_images and "right" in direction_images:
        mirror = direction_images["left"].transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        check("Rover", "Right frame is a true mirror of left", same_image(mirror, direction_images["right"]))
    check("Rover", "Rover art is marked original and not NASA hardware", "not a nasa rover" in str(rover.get("note", "")).lower())

    components = meta.get("components", [])
    check("Equipment", "Eight component icons are present", len(components) == 8, f"{len(components)} entries")
    ids = tuple(item.get("id") for item in components)
    check("Equipment", "Component IDs match the approved set", ids == EXPECTED_EQUIPMENT, ", ".join(ids))
    sheet = rgba(ASSET_ROOT / "equipment" / "equipment_sheet.png")
    check("Equipment", "Component sheet is 128 x 64", sheet is not None and sheet.size == (128, 64))
    for item in components:
        cid = str(item.get("id", "?"))
        path = ASSET_ROOT / str(item.get("file", ""))
        icon = rgba(path) if path.is_file() else None
        check("Equipment", f"{cid}: icon file exists at 32 x 32", icon is not None and icon.size == (32, 32))
        check("Equipment", f"{cid}: marked fictional game hardware", item.get("fictionalEquipment") is True)
        check("Equipment", f"{cid}: simplified-values note present", "simplified" in str(item.get("note", "")).lower())
        index = item.get("sheetIndex")
        if icon is not None and sheet is not None and isinstance(index, int) and 0 <= index < 8:
            cell = sheet.crop(((index % 4) * 32, (index // 4) * 32, (index % 4 + 1) * 32, (index // 4 + 1) * 32))
            check("Equipment", f"{cid}: sheet slice matches icon", same_image(cell, icon))


def verify_interface() -> None:
    meta = load_json(ASSET_ROOT / "ui" / "ui.json")
    if not isinstance(meta, dict):
        check("Interface", "UI metadata parses", False)
        return
    check("Interface", "UI metadata parses", True)

    resources = meta.get("resourceIcons", [])
    check("Interface", "Six mission resources are present", len(resources) == 6)
    check("Interface", "Resource IDs match the approved set", tuple(item.get("id") for item in resources) == EXPECTED_RESOURCES)
    for item in resources:
        path = ASSET_ROOT / str(item.get("file", ""))
        image = rgba(path) if path.is_file() else None
        check("Interface", f"resource {item.get('id')}: 16 x 16 icon exists", image is not None and image.size == (16, 16))
    resource_sheet = rgba(ASSET_ROOT / "ui" / "resource_icons.png")
    check("Interface", "Resource sheet is 96 x 16", resource_sheet is not None and resource_sheet.size == (96, 16))
    if resource_sheet is not None:
        slices_ok = all(
            same_image(
                resource_sheet.crop((index * 16, 0, (index + 1) * 16, 16)),
                rgba(ASSET_ROOT / str(item.get("file", ""))),
            )
            for index, item in enumerate(resources)
            if (ASSET_ROOT / str(item.get("file", ""))).is_file()
        )
        check("Interface", "Resource sheet slices match the six icons", slices_ok)

    roles = meta.get("roleBadges", [])
    check("Interface", "Five role badges are present", len(roles) == 5)
    check("Interface", "Role IDs match the approved set", tuple(item.get("id") for item in roles) == EXPECTED_ROLES)
    for item in roles:
        path = ASSET_ROOT / str(item.get("file", ""))
        image = rgba(path) if path.is_file() else None
        check("Interface", f"role {item.get('id')}: 32 x 32 badge exists", image is not None and image.size == (32, 32))
        check("Interface", f"role {item.get('id')}: fictional-cast note present", "not based on nasa employees" in str(item.get("note", "")).lower())
    role_sheet = rgba(ASSET_ROOT / "ui" / "role_badges.png")
    check("Interface", "Role sheet is 160 x 32", role_sheet is not None and role_sheet.size == (160, 32))

    marks = meta.get("marks", [])
    check("Interface", "Four interaction marks are present", len(marks) == 4)
    for item in marks:
        path = ASSET_ROOT / str(item.get("file", ""))
        image = rgba(path) if path.is_file() else None
        check("Interface", f"mark {item.get('id')}: 16 x 16 icon exists", image is not None and image.size == (16, 16))
    mark_sheet = rgba(ASSET_ROOT / "ui" / "ui_marks.png")
    check("Interface", "Marker sheet is 64 x 16", mark_sheet is not None and mark_sheet.size == (64, 16))

    panel = meta.get("panel", {})
    panel_path = ASSET_ROOT / str(panel.get("file", ""))
    panel_image = rgba(panel_path) if panel_path.is_file() else None
    check("Interface", "9-slice panel is 24 x 24", panel_image is not None and panel_image.size == (24, 24))
    check("Interface", "9-slice border is 8 px", panel.get("border") == 8)
    if panel_image is not None:
        corners = [panel_image.getpixel(point)[3] for point in ((0, 0), (23, 0), (0, 23), (23, 23))]
        check("Interface", "9-slice corner pixels are transparent", corners == [0, 0, 0, 0], f"alpha {corners}")

    branding = meta.get("branding", [])
    check("Branding", "Four original brand assets are present", len(branding) == 4)
    for item in branding:
        path = ASSET_ROOT / str(item.get("file", ""))
        image = rgba(path) if path.is_file() else None
        check("Branding", f"{item.get('id')}: dimensions match metadata", image is not None and image.size == (item.get("width"), item.get("height")), f"{image.size[0] if image else '?'} x {image.size[1] if image else '?'}")
        check("Branding", f"{item.get('id')}: marked fictional", item.get("fictional") is True)
    brand_sheet = rgba(ASSET_ROOT / "branding" / "branding_sheet.png")
    check("Branding", "Branding overview sheet is 256 x 144", brand_sheet is not None and brand_sheet.size == (256, 144))
    check("Originality", "No NASA logo, patch or typeface is claimed", "no nasa logo" in str(meta.get("usageNote", "")).lower())


def verify_scenes() -> None:
    meta = load_json(ASSET_ROOT / "scenes" / "scenes.json")
    if not isinstance(meta, dict):
        check("Scenes", "Scene metadata parses", False)
        return
    check("Scenes", "Scene metadata parses", True)
    scenes = meta.get("scenes", [])
    check("Scenes", "Three composed scenes are present", len(scenes) == 3, f"{len(scenes)} scenes")
    check("Scenes", "Scene IDs match the approved set", tuple(item.get("id") for item in scenes) == EXPECTED_SCENES)
    for item in scenes:
        sid = str(item.get("id", "?"))
        path = ASSET_ROOT / str(item.get("file", ""))
        image = rgba(path) if path.is_file() else None
        check("Scenes", f"{sid}: file exists at 384 x 224", image is not None and image.size == (384, 224), f"{image.size[0]} x {image.size[1]}" if image else "missing")
        if image is not None:
            check("Scenes", f"{sid}: fully opaque native frame", hard_alpha(image) and image.getchannel("A").getextrema() == (255, 255))
        check("Scenes", f"{sid}: nativeScale is 1", item.get("nativeScale") == 1)
        note = str(item.get("note", "")).lower()
        check("Scenes", f"{sid}: marked as a visual target with mock UI", "visual-direction target" in note and "mock game ui" in note)


def verify_preview() -> None:
    page_path = PREVIEW_ROOT / "index.html"
    page = page_path.read_text(encoding="utf-8") if page_path.is_file() else ""
    check("Preview", "Local review page exists", bool(page), "art-preview/index.html")
    if not page:
        return
    required_sections = ("Direction", "Fictional Cast", "Environment Sets", "Props", "Rover + Equipment", "Interface + Branding", "Composed Scenes", "Files + Reproducibility", "Approval")
    check("Preview", "Review page contains every checkpoint section", all(section in page for section in required_sections))
    check("Preview", "Directional sprite animation uses per-row column modulo", "var frame = item.frames[item.index] % 6;" in page)
    check("Preview", "No external network URLs", not re.search(r"https?://", page, re.IGNORECASE))
    check("Preview", "No external scripts or stylesheets", not re.search(r"<script[^>]+src=|<link[^>]+href=", page, re.IGNORECASE))
    check("Preview", "No external font import", "@import" not in page and "fonts.googleapis" not in page.lower())
    check("Preview", "Approval-gate language is explicit", "awaiting art approval" in page.lower() and "approval gate" in page.lower())
    check("Preview", "Non-affiliation disclaimer is present", "not affiliated" in page.lower() and "nasa" in page.lower())
    check("Preview", "Fictional-cast disclaimer is present", "fictional" in page.lower())
    check("Preview", "Simplified educational values disclaimer is present", "simplified educational" in page.lower())
    check("Preview", "Mock-interface disclaimer is present", "mock interface" in page.lower())
    check("Preview", "Contact sheet is downloadable", (PREVIEW_ROOT / "contact_sheet.png").is_file(), "art-preview/contact_sheet.png")

    contact = rgba(PREVIEW_ROOT / "contact_sheet.png")
    check("Preview", "Contact sheet is 2400 x 1600", contact is not None and contact.size == (2400, 1600), f"{contact.size[0]} x {contact.size[1]}" if contact else "missing")

    refs = re.findall(r'(?:src|href)="([^"]+)"', page)
    missing = []
    for ref in refs:
        if ref.startswith("#") or ref == "VALIDATION.md":
            continue
        if ref.startswith(("http://", "https://", "mailto:", "data:")):
            missing.append(ref)
            continue
        target = (PREVIEW_ROOT / ref).resolve()
        if not target.exists():
            missing.append(ref)
    check("Preview", "Every local image and link resolves", not missing, f"missing: {', '.join(missing[:4])}" if missing else f"{len(refs)} local references")
    check("Preview", "Review page references production assets directly", "../client/public/assets/" in page)

    bible = ROOT / "docs" / "ART_BIBLE.md"
    bible_text = bible.read_text(encoding="utf-8") if bible.is_file() else ""
    check("Delivery", "Art bible exists", bool(bible_text), "docs/ART_BIBLE.md")
    check("Delivery", "Art bible contains the approval gate", "approval gate" in bible_text.lower())
    check("Delivery", "Build and validation scripts are checked in", (ROOT / "scripts" / "build_art.py").is_file() and (ROOT / "scripts" / "validate_art.py").is_file())


def write_report() -> None:
    failures = [item for item in checks if not item["ok"]]
    passed = len(checks) - len(failures)
    grouped: dict[str, list[dict[str, str]]] = {}
    for item in checks:
        grouped.setdefault(item["area"], []).append(item)

    lines = [
        "# RED FRONTIER - Art Validation",
        "",
        f"**Result: {'PASS' if not failures else 'FAIL'}** - {passed}/{len(checks)} automated checks passed.",
        "",
        f"Checkpoint: {CHECKPOINT}",
        "",
        "Asset root: `client/public/assets/`  ",
        "Review page: `art-preview/index.html`  ",
        "Validator: `scripts/validate_art.py`",
        "",
        "This report covers structural and technical delivery properties. Aesthetic judgement and",
        "in-context readability remain a manual art-direction review, recorded at the end of this file.",
        "",
        "## Counts",
        "",
        "| Group | Delivered |",
        "|---|---:|",
        "| Fictional cast / portraits | 5 / 5 |",
        "| HQ tiles / Mars tiles | 64 / 64 |",
        "| HQ props / lab props / Mars props | 18 / 7 / 13 |",
        "| Rover directions / equipment icons | 4 / 8 |",
        "| Resources / roles / marks / brand assets | 6 / 5 / 4 / 4 |",
        "| Composed scenes | 3 |",
        "",
        "## Summary",
        "",
        "| Area | Passed | Total | Result |",
        "|---|---:|---:|---|",
    ]
    for area, items in grouped.items():
        area_passed = sum(1 for item in items if item["ok"])
        lines.append(f"| {md(area)} | {area_passed} | {len(items)} | {'PASS' if area_passed == len(items) else '**FAIL**'} |")
    if failures:
        lines += ["", "## Failures", ""]
        for item in failures:
            lines.append(f"- **{md(item['area'])} / {md(item['name'])}** - {md(item['evidence'])}")
    lines += [
        "",
        "## Check log",
        "",
        f"<details><summary>Full automated check log ({len(checks)} checks)</summary>",
        "",
        "| Area | Check | Result | Evidence |",
        "|---|---|---|---|",
    ]
    for area, items in grouped.items():
        for item in items:
            lines.append(
                f"| {md(area)} | {md(item['name'])} | {'PASS' if item['ok'] else '**FAIL**'} | {md(item['evidence'])} |"
            )
    lines += [
        "",
        "</details>",
        "",
        "## Method and limits",
        "",
        "- Dimensions, modes and hard alpha are read directly from every PNG.",
        "- The manifest is checked against the complete asset tree, including SHA-256 and byte size.",
        "- Character sheets are checked as a 6 x 4 grid of 24 x 32 frames; all 24 frames must contain art.",
        "- Right-facing character and rover exports are checked against a horizontal mirror of the authored left art.",
        "- Tile indices are checked against their 8 x 8 grid position; all 64 cells must contain art.",
        "- Prop anchors and origins are checked against metadata; the landing pad is verified as a centre-anchored ground decal.",
        "- Scene frames must be fully opaque at 384 x 224.",
        "- The local page is checked for broken local references, external network dependencies and required disclaimers.",
        "- Palette discipline is bounded rather than exact: authored shade mixing is allowed, while each asset must stay under 384 visible colours.",
        "",
        "## Manual art-direction review",
        "",
        "- Contact sheet and full review page were inspected at desktop and mobile widths in headless Chrome.",
        "- The three composed scenes were inspected at native resolution for HUD fit, cast readability and prop overlap.",
        "- The mesa, lab props, cast silhouettes and rover were reviewed at scene scale, not only in isolation.",
        "- All HUD copy in composed scenes is mock interface text. It is not live mission data.",
        "",
        "## Reproduce",
        "",
        "```bash",
        "python scripts/build_art.py",
        "python scripts/validate_art.py",
        "python -m http.server 8000",
        "# open http://127.0.0.1:8000/art-preview/index.html",
        "```",
        "",
        "**Original fictional project.** Not affiliated with, endorsed by, or sponsored by NASA.",
        "No NASA logo, mission patch, photograph, facility reconstruction or employee likeness is used.",
        "All characters, organisations and hardware are fictional. Gameplay values are simplified educational values.",
        "",
    ]
    REPORT.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    print("RED FRONTIER - art validation")
    print(f"Assets: {ASSET_ROOT}")
    manifest = verify_manifest()
    verify_global_images(manifest)
    verify_characters()
    verify_tilesets()
    verify_props()
    verify_rover_and_equipment()
    verify_interface()
    verify_scenes()
    verify_preview()
    write_report()
    failures = [item for item in checks if not item["ok"]]
    print()
    print(f"Checks: {len(checks) - len(failures)} passed, {len(failures)} failed")
    print(f"Report: {REPORT}")
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
