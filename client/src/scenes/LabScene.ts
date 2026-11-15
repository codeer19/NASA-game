import Phaser from "phaser";
import { MODULES, roleById } from "../../../shared/content";
import type { GameState } from "../store";
import { store } from "../store";
import { characterTexture, playIdle } from "./helpers";

interface CrewUi {
  objects: Phaser.GameObjects.GameObject[];
}

const DESIGN_SLOTS = [
  { x: 120, y: 184, dir: "right" as const },
  { x: 264, y: 184, dir: "left" as const },
  { x: 142, y: 204, dir: "down" as const },
  { x: 242, y: 204, dir: "down" as const },
];

const LOBBY_SLOTS = [
  { x: 110, y: 156, dir: "down" as const },
  { x: 166, y: 156, dir: "down" as const },
  { x: 250, y: 156, dir: "down" as const },
  { x: 304, y: 156, dir: "down" as const },
];

const MODULE_ANCHORS: Record<string, { x: number; y: number }> = {
  suspension: { x: 118, y: 118 },
  arm: { x: 266, y: 118 },
  spectrometer: { x: 118, y: 176 },
  weather: { x: 266, y: 176 },
};

export class LabScene extends Phaser.Scene {
  private unsubscribe: (() => void) | null = null;
  private background: Phaser.GameObjects.Image | null = null;
  private crew: CrewUi = { objects: [] };
  private crewSignature = "";
  private phaseSignature = "";
  private moduleIcons = new Map<string, Phaser.GameObjects.Image>();
  private moduleLinks = new Map<string, Phaser.GameObjects.Graphics>();
  private selectedModules = new Set<string>();
  private moduleLayer: Phaser.GameObjects.Container | null = null;
  private scanLine: Phaser.GameObjects.Rectangle | null = null;
  private rover: Phaser.GameObjects.Image | null = null;
  private voss: Phaser.GameObjects.Sprite | null = null;

  constructor() {
    super("LabScene");
  }

  create(): void {
    // Clear view signatures and cached handles from a previous run. Scene
    // instances are reused when the crew returns to the lobby after a mission.
    this.crewSignature = "";
    this.phaseSignature = "";
    this.selectedModules.clear();
    this.moduleIcons.clear();
    this.moduleLinks.clear();
    this.crew.objects = [];

    this.cameras.main.fadeIn(400, 0, 0, 0);

    this.background = this.add
      .image(192, 112, "scenes/hq_engineering_lab.png")
      .setDepth(0)
      .setAlpha(0.98);

    const grade = this.add.graphics().setDepth(1);
    grade.fillStyle(0x07101e, 0.16);
    grade.fillRect(0, 0, 384, 224);

    this.add
      .image(192, 166, "props/lab/rover_jig.png")
      .setOrigin(0.5, 0.85)
      .setDepth(40)
      .setAlpha(0.8);

    const roverShadow = this.add.ellipse(192, 176, 104, 20, 0x060b14, 0.32).setDepth(41);
    this.rover = this.add
      .image(192, 166, "rover/rover_assembled.png")
      .setOrigin(0.5, 0.82)
      .setDepth(50)
      .setScale(1.1);
    roverShadow.setScale(1.05);

    this.tweens.add({
      targets: this.rover,
      y: 164,
      duration: 2200,
      ease: "Sine.inOut",
      yoyo: true,
      repeat: -1,
    });

    this.scanLine = this.add
      .rectangle(192, 126, 112, 1, 0x6adbe0, 0.35)
      .setDepth(60)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: this.scanLine,
      y: 174,
      alpha: { from: 0.1, to: 0.5 },
      duration: 1800,
      ease: "Sine.inOut",
      yoyo: true,
      repeat: -1,
    });

    this.add
      .image(72, 55, "props/hq/wall_screen_small.png")
      .setDepth(5)
      .setAlpha(0.9)
      .setScale(1.25);
    const screenShade = this.add
      .rectangle(72, 55, 32, 20, 0x2e8c80, 0.18)
      .setDepth(6)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: screenShade,
      alpha: 0.35,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });

    this.add
      .image(326, 42, "props/hq/mission_clock.png")
      .setDepth(8)
      .setAlpha(0.92);
    const clockLight = this.add.rectangle(326, 39, 27, 2, 0xf0b64b, 0.45).setDepth(9);
    this.tweens.add({
      targets: clockLight,
      alpha: 0.1,
      duration: 750,
      yoyo: true,
      repeat: -1,
    });

    this.voss = this.add
      .sprite(318, 202, characterTexture("voss"))
      .setOrigin(0.5, 1)
      .setDepth(210);
    playIdle(this, this.voss, "voss", "left");
    this.add.ellipse(318, 203, 15, 5, 0x060b14, 0.3).setDepth(209);

    this.moduleLayer = this.add.container(0, 0).setDepth(80);
    for (const module of MODULES) {
      const anchor = MODULE_ANCHORS[module.id];
      if (!anchor) continue;

      const link = this.add.graphics();
      link.lineStyle(1, 0x34465f, 0.75);
      link.beginPath();
      link.moveTo(anchor.x, anchor.y + 12);
      link.lineTo(anchor.x < 192 ? 150 : 234, anchor.y + 12);
      link.lineTo(anchor.x < 192 ? 162 : 222, 156);
      link.strokePath();
      this.moduleLayer.add(link);
      this.moduleLinks.set(module.id, link);

      const icon = this.add
        .image(anchor.x, anchor.y, module.file)
        .setScale(0.82)
        .setAlpha(0.3);
      this.moduleLayer.add(icon);
      this.moduleIcons.set(module.id, icon);

      const tag = this.add
        .text(anchor.x, anchor.y + 17, module.category, {
          fontFamily: "monospace",
          fontSize: "4px",
          color: "#9caaa7",
          align: "center",
        })
        .setOrigin(0.5, 0);
      this.moduleLayer.add(tag);
    }

    this.unsubscribe = store.subscribe((state) => this.sync(state));
    this.sync(store.current);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
    });
  }

  private sync(state: GameState): void {
    const room = state.room;
    const phase = room?.phase ?? "lobby";
    const phaseKey = `${phase}:${room?.design.modules.join(",") ?? ""}`;
    if (this.phaseSignature !== phaseKey) {
      this.phaseSignature = phaseKey;
      this.background?.setTexture(
        phase === "design" ? "scenes/hq_engineering_lab.png" : "scenes/hq_mission_control.png",
      );
      this.moduleLayer?.setVisible(phase === "design");
      this.scanLine?.setVisible(phase === "design");
      this.rover?.setVisible(phase === "design");
      this.voss?.setVisible(phase === "design");
      if (this.voss) {
        this.voss.setPosition(phase === "design" ? 318 : 322, phase === "design" ? 202 : 196);
        playIdle(this, this.voss, "voss", phase === "design" ? "left" : "down");
      }
    }

    const designSet = new Set(room?.design.modules ?? []);
    for (const module of MODULES) {
      const icon = this.moduleIcons.get(module.id);
      const link = this.moduleLinks.get(module.id);
      const selected = designSet.has(module.id);
      icon?.setAlpha(selected ? 1 : 0.26);
      icon?.setTint(selected ? 0xffffff : 0x6d7c88);
      link?.clear();
      const anchor = MODULE_ANCHORS[module.id];
      if (anchor) {
        link?.lineStyle(1, selected ? 0xf0b64b : 0x34465f, selected ? 0.85 : 0.55);
        link?.beginPath();
        link?.moveTo(anchor.x, anchor.y + 12);
        link?.lineTo(anchor.x < 192 ? 150 : 234, anchor.y + 12);
        link?.lineTo(anchor.x < 192 ? 162 : 222, 156);
        link?.strokePath();
      }
      if (icon && this.selectedModules.has(module.id) !== selected) {
        this.tweens.killTweensOf(icon);
        icon.setScale(0.82);
        if (selected) {
          this.tweens.add({
            targets: icon,
            scale: { from: 0.82, to: 0.88 },
            duration: 420,
            ease: "Sine.inOut",
            yoyo: true,
            repeat: -1,
          });
        }
      }
    }
    this.selectedModules = designSet;

    const players = room?.players ?? [];
    const playerSignature = `${phase}:${players
      .map((player) => `${player.id}:${player.role ?? "none"}:${player.connected}`)
      .join("|")}`;
    if (playerSignature !== this.crewSignature) {
      this.crewSignature = playerSignature;
      this.rebuildCrew(phase);
    }
  }

  private rebuildCrew(phase: string): void {
    for (const object of this.crew.objects) object.destroy();
    this.crew.objects = [];
    const room = store.current.room;
    if (!room) return;
    const slots = phase === "design" ? DESIGN_SLOTS : LOBBY_SLOTS;

    room.players.slice(0, 4).forEach((player, index) => {
      const slot = slots[index];
      if (!slot) return;
      const role = roleById(player.role);
      const characterId = role?.characterId ?? "nia";
      const shadow = this.add.ellipse(slot.x, slot.y - 1, 16, 5, 0x060b14, 0.32).setDepth(slot.y - 2);
      const sprite = this.add
        .sprite(slot.x, slot.y, characterTexture(characterId))
        .setOrigin(0.5, 1)
        .setDepth(slot.y);
      playIdle(this, sprite, characterId, slot.dir);
      sprite.setAlpha(player.connected ? 1 : 0.4);
      this.crew.objects.push(shadow, sprite);
    });
  }
}
