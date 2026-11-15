import Phaser from "phaser";
import { characterSheet, PORTRAIT_FILES } from "../assets";
import type { Direction } from "../controls";

export function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ensureSparkTexture(
  scene: Phaser.Scene,
  key: string,
  color: number,
  size = 2,
): void {
  if (scene.textures.exists(key)) return;
  const graphics = scene.add.graphics();
  graphics.fillStyle(color, 1);
  graphics.fillRect(0, 0, size, size);
  graphics.generateTexture(key, size, size);
  graphics.destroy();
}

export function characterTexture(catalogId: string | null | undefined): string {
  if (!catalogId) return characterSheet("nia") ?? "characters/nia_okafor.png";
  return characterSheet(catalogId) ?? characterSheet("nia") ?? "characters/nia_okafor.png";
}

export function portraitFor(catalogId: string | null | undefined): string {
  if (!catalogId) return PORTRAIT_FILES.voss ?? "portraits/dr_miriam_voss.png";
  return PORTRAIT_FILES[catalogId] ?? PORTRAIT_FILES.nia ?? "portraits/nia_okafor.png";
}

export function playIdle(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  catalogId: string,
  direction: Direction,
): void {
  const key = `${catalogId}-idle-${direction}`;
  if (scene.anims.exists(key)) sprite.play(key, true);
}

export function playWalk(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  catalogId: string,
  direction: Direction,
): void {
  const key = `${catalogId}-walk-${direction}`;
  if (scene.anims.exists(key)) sprite.play(key, true);
}

export function playWork(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  catalogId: string,
  direction: Direction,
): void {
  const key = `${catalogId}-work-${direction}`;
  if (scene.anims.exists(key)) sprite.play(key, true);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerpAngle(current: number, target: number, t: number): number {
  return current + (target - current) * t;
}
