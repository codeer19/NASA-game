import Phaser from "phaser";
import { assetUrl, assets, imageEntries } from "../assets";
import { appBus } from "../store";

interface BootProgressDetail {
  value: number;
  label: string;
}

function announceProgress(value: number, label: string): void {
  appBus.dispatchEvent(
    new CustomEvent<BootProgressDetail>("boot-progress", {
      detail: { value, label },
    }),
  );
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    const characterMeta = assets.characters;
    const entries = imageEntries();

    this.load.on("progress", (progress: number) => {
      announceProgress(0.22 + progress * 0.7, `LOADING ORIGINAL ART · ${Math.round(progress * 100)}%`);
    });

    for (const entry of entries) {
      const key = entry.path;
      if (entry.path.startsWith("characters/")) {
        this.load.spritesheet(key, assetUrl(key), {
          frameWidth: characterMeta?.frameWidth ?? 24,
          frameHeight: characterMeta?.frameHeight ?? 32,
        });
        continue;
      }
      if (entry.path === "rover/rover_sheet.png") {
        this.load.spritesheet(key, assetUrl(key), { frameWidth: 96, frameHeight: 64 });
        continue;
      }
      if (entry.path.startsWith("tiles/")) {
        const tileMeta = entry.path.includes("mars") ? assets.marsTiles : assets.hqTiles;
        this.load.spritesheet(key, assetUrl(key), {
          frameWidth: tileMeta?.tileWidth ?? 16,
          frameHeight: tileMeta?.tileHeight ?? 16,
        });
        continue;
      }
      this.load.image(key, assetUrl(key));
    }
  }

  create(): void {
    const characterMeta = assets.characters;
    if (characterMeta) {
      for (const character of characterMeta.characters) {
        const sheet = `characters/${character.image}`;
        for (const [name, animation] of Object.entries(character.animations)) {
          const key = `${character.id}-${name}`;
          if (this.anims.exists(key)) continue;
          this.anims.create({
            key,
            frames: this.anims.generateFrameNumbers(sheet, { frames: animation.frames }),
            frameRate: animation.fps,
            repeat: animation.repeat,
          });
        }
      }
    }

    announceProgress(0.94, "SURFACE SYSTEMS NOMINAL");
    this.time.delayedCall(60, () => {
      appBus.dispatchEvent(new CustomEvent("boot-ready"));
    });
  }
}
