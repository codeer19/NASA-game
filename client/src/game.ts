import Phaser from "phaser";
import type { RoomPublic } from "../../shared/types";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { LabScene } from "./scenes/LabScene";
import { LaunchScene } from "./scenes/LaunchScene";
import { MarsScene } from "./scenes/MarsScene";

export type VisualScene = "title" | "lobby" | "design" | "launch" | "mission" | "debrief";

const SCENE_KEYS: Record<VisualScene, string> = {
  title: "TitleScene",
  lobby: "LabScene",
  design: "LabScene",
  launch: "LaunchScene",
  mission: "MarsScene",
  debrief: "MarsScene",
};

class GameDirector {
  private game: Phaser.Game | null = null;
  private ready = false;
  private desired: string = "BootScene";

  create(parent: HTMLElement): Phaser.Game {
    if (this.game) return this.game;
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: 384,
      height: 224,
      backgroundColor: "#0b1224",
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      disableContextMenu: true,
      scale: {
        mode: Phaser.Scale.NONE,
        autoCenter: Phaser.Scale.NO_CENTER,
        width: 384,
        height: 224,
      },
      render: {
        powerPreference: "high-performance",
      },
      scene: [BootScene, TitleScene, LabScene, LaunchScene, MarsScene],
    });
    return this.game;
  }

  syncRoom(room: RoomPublic | null): void {
    this.desired = SCENE_KEYS[this.sceneFor(room)];
    this.apply();
  }

  markReady(): void {
    this.ready = true;
    this.apply();
  }

  get scene(): VisualScene {
    const scene = this.desired.replace("TitleScene", "title");
    if (scene === "LabScene") {
      return "lobby";
    }
    if (scene === "LaunchScene") return "launch";
    if (scene === "MarsScene") return "mission";
    return "title";
  }

  private sceneFor(room: RoomPublic | null): VisualScene {
    if (!room) return "title";
    if (room.phase === "lobby") return "lobby";
    if (room.phase === "design") return "design";
    if (room.phase === "launch") return "launch";
    if (room.phase === "mission") return "mission";
    return "debrief";
  }

  private apply(): void {
    if (!this.game || !this.ready) return;
    const manager = this.game.scene;
    const activeScenes = manager.getScenes(true);
    const targetActive = activeScenes.some((scene) => scene.scene.key === this.desired);
    if (targetActive) {
      for (const scene of activeScenes) {
        if (scene.scene.key !== this.desired) manager.stop(scene.scene.key);
      }
      return;
    }
    for (const scene of activeScenes) {
      manager.stop(scene.scene.key);
    }
    manager.start(this.desired);
  }
}

export const gameDirector = new GameDirector();
