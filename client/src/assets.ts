export interface ManifestEntry {
  path: string;
  bytes: number;
  sha256: string;
  width?: number;
  height?: number;
  mode?: string;
}

export interface Manifest {
  project: string;
  status: string;
  counts: Record<string, number>;
  files: ManifestEntry[];
  rights?: string;
}

export interface TileDefinition {
  index: number;
  id: string;
  kind: string;
  col: number;
  row: number;
}

export interface TileSetMeta {
  image: string;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  rows: number;
  tiles: TileDefinition[];
}

export interface CharacterMeta {
  frameWidth: number;
  frameHeight: number;
  directions: string[];
  characters: Array<{
    id: string;
    name: string;
    role: string;
    image: string;
    columns: number;
    rows: number;
    animations: Record<
      string,
      { frames: number[]; fps: number; repeat: number }
    >;
  }>;
}

export interface AssetCatalog {
  manifest: Manifest | null;
  characters: CharacterMeta | null;
  equipment: {
    rover: {
      image: string;
      sheet: string;
      width: number;
      height: number;
      origin: { x: number; y: number };
    };
    components: Array<{ id: string; name: string; file: string }>;
  } | null;
  ui: {
    resourceIcons: Array<{ id: string; name: string; file: string }>;
    roleBadges: Array<{ id: string; name: string; file: string }>;
  } | null;
  marsTiles: TileSetMeta | null;
  hqTiles: TileSetMeta | null;
}

export const assets: AssetCatalog = {
  manifest: null,
  characters: null,
  equipment: null,
  ui: null,
  marsTiles: null,
  hqTiles: null,
};

export async function loadAssetCatalog(onProgress?: (value: number, label: string) => void): Promise<void> {
  const jsonFiles: Array<[keyof AssetCatalog, string]> = [
    ["characters", "characters/characters.json"],
    ["equipment", "equipment/equipment.json"],
    ["ui", "ui/ui.json"],
    ["marsTiles", "tiles/mars_tiles.json"],
    ["hqTiles", "tiles/hq_tiles.json"],
  ];

  const manifestResponse = await fetch("/assets/manifest.json", { cache: "no-cache" });
  if (!manifestResponse.ok) {
    throw new Error(`Asset manifest failed: ${manifestResponse.status}`);
  }
  const manifest = (await manifestResponse.json()) as Manifest;
  assets.manifest = manifest;
  onProgress?.(0.1, "MANIFEST VERIFIED");

  let index = 0;
  for (const [key, file] of jsonFiles) {
    const response = await fetch(`/assets/${file}`, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Asset metadata failed: ${file}`);
    const data = (await response.json()) as unknown;
    if (key === "characters") assets.characters = data as CharacterMeta;
    if (key === "equipment") assets.equipment = data as AssetCatalog["equipment"];
    if (key === "ui") assets.ui = data as AssetCatalog["ui"];
    if (key === "marsTiles") assets.marsTiles = data as TileSetMeta;
    if (key === "hqTiles") assets.hqTiles = data as TileSetMeta;
    index += 1;
    onProgress?.(
      0.1 + index * 0.02,
      index === jsonFiles.length ? "ART RECORDS LINKED" : "CREW RECORDS LINKED",
    );
  }
}

export function imageEntries(): ManifestEntry[] {
  return (assets.manifest?.files ?? []).filter((entry) => entry.path.endsWith(".png"));
}

export function assetUrl(path: string): string {
  return `/assets/${path}`;
}

export function character(catalogId: string): CharacterMeta["characters"][number] | undefined {
  return assets.characters?.characters.find((entry) => entry.id === catalogId);
}

export function characterSheet(catalogId: string): string | null {
  const entry = character(catalogId);
  return entry ? `characters/${entry.image}` : null;
}

export const PORTRAIT_FILES: Record<string, string> = {
  nia: "portraits/nia_okafor.png",
  ren: "portraits/ren_ito.png",
  val: "portraits/val_ruiz.png",
  samir: "portraits/samir_haddad.png",
  voss: "portraits/dr_miriam_voss.png",
};
