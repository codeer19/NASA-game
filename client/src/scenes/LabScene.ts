import Phaser from "phaser";
import { COMPONENT_SLOTS, componentById, roleById } from "../../../shared/content";
import type { ComponentSlot } from "../../../shared/types";
import type { GameState } from "../store";
import { store } from "../store";
import { characterTexture, ensureSparkTexture, playIdle } from "./helpers";

interface CrewUi {
  objects: Phaser.GameObjects.GameObject[];
}

const DESIGN_SLOTS = [
  { x: 46, y: 216, dir: "right" as const },
  { x: 86, y: 216, dir: "right" as const },
  { x: 296, y: 216, dir: "left" as const },
  { x: 336, y: 216, dir: "left" as const },
];

const LOBBY_SLOTS = [
  { x: 110, y: 156, dir: "down" as const },
  { x: 166, y: 156, dir: "down" as const },
  { x: 250, y: 156, dir: "down" as const },
  { x: 304, y: 156, dir: "down" as const },
];

const PART_ANCHORS: Record<ComponentSlot, { x: number; y: number }> = {
  body: { x: 116, y: 116 },
  wheels: { x: 101, y: 139 },
  suspension: { x: 95, y: 163 },
  arm: { x: 268, y: 116 },
  camera: { x: 283, y: 139 },
  instruments: { x: 289, y: 163 },
  power: { x: 137, y: 195 },
  antenna: { x: 247, y: 195 },
};

export class LabScene extends Phaser.Scene {
  private unsubscribe: (() => void) | null = null;
  private background: Phaser.GameObjects.Image | null = null;
  private crew: CrewUi = { objects: [] };
  private crewSignature = "";
  private phaseSignature = "";
  private partIcons = new Map<ComponentSlot, Phaser.GameObjects.Image>();
  private partLabels = new Map<ComponentSlot, Phaser.GameObjects.Text>();
  private partRings = new Map<ComponentSlot, Phaser.GameObjects.Arc>();
  private partLayer: Phaser.GameObjects.Container | null = null;
  private scanLine: Phaser.GameObjects.Rectangle | null = null;
  private rover: Phaser.GameObjects.Image | null = null;
  private voss: Phaser.GameObjects.Sprite | null = null;
  private glow: Phaser.GameObjects.Ellipse | null = null;

  constructor() {
    super("LabScene");
  }

  create(): void {
    this.crewSignature = "";
    this.phaseSignature = "";
    this.partIcons.clear();
    this.partLabels.clear();
    this.partRings.clear();
    this.crew.objects = [];

    this.cameras.main.fadeIn(380, 0, 0, 0);

    this.background = this.add
      .image(192, 112, "scenes/hq_mission_control.png")
      .setDepth(0)
      .setAlpha(0.98);

    const grade = this.add.graphics().setDepth(1);
    grade.fillStyle(0x1d1017, 0.12);
    grade.fillRect(0, 0, 384, 224);

    const warmLight = this.add
      .rectangle(192, 78, 384, 150, 0xf0b64b, 0.055)
      .setDepth(2)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: warmLight,
      alpha: 0.1,
      duration: 3_200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });

    this.add
      .image(192, 170, "props/lab/rover_jig.png")
      .setOrigin(0.5, 0.85)
      .setDepth(40)
      .setAlpha(0.9);

    this.glow = this.add.ellipse(192, 174, 128, 34, 0xf0b64b, 0.12).setDepth(41);
    this.tweens.add({
      targets: this.glow,
      alpha: 0.22,
      scaleX: 1.08,
      duration: 2_100,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });

    const roverShadow = this.add.ellipse(192, 177, 112, 22, 0x1a0d0b, 0.4).setDepth(42);
    this.rover = this.add
      .image(192, 168, "rover/rover_assembled.png")
      .setOrigin(0.5, 0.82)
      .setDepth(50)
      .setScale(1.14);
    roverShadow.setScale(1.08);

    this.tweens.add({
      targets: this.rover,
      y: 165,
      duration: 2_200,
      ease: "Sine.inOut",
      yoyo: true,
      repeat: -1,
    });

    this.scanLine = this.add
      .rectangle(192, 126, 126, 1, 0x6adbe0, 0.4)
      .setDepth(60)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: this.scanLine,
      y: 180,
      alpha: { from: 0.12, to: 0.55 },
      duration: 2_000,
      ease: "Sine.inOut",
      yoyo: true,
      repeat: -1,
    });

    this.add
      .image(72, 55, "props/hq/wall_screen_small.png")
      .setDepth(5)
      .setAlpha(0.95)
      .setScale(1.3);
    const screenShade = this.add
      .rectangle(72, 55, 34, 21, 0x2e8c80, 0.22)
      .setDepth(6)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: screenShade,
      alpha: 0.42,
      duration: 1_400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });

    this.add
      .image(326, 42, "props/hq/mission_clock.png")
      .setDepth(8)
      .setAlpha(0.95);
    const clockLight = this.add.rectangle(326, 39, 27, 2, 0xf0b64b, 0.55).setDepth(9);
    this.tweens.add({
      targets: clockLight,
      alpha: 0.12,
      duration: 750,
      yoyo: true,
      repeat: -1,
    });

    this.voss = this.add
      .sprite(332, 210, characterTexture("voss"))
      .setOrigin(0.5, 1)
      .setDepth(210);
    playIdle(this, this.voss, "voss", "left");
    this.add.ellipse(332, 211, 15, 5, 0x060b14, 0.34).setDepth(209);

    this.partLayer = this.add.container(0, 0).setDepth(80);
    for (const slot of COMPONENT_SLOTS) {
      const anchor = PART_ANCHORS[slot.id];
      const ring = this.add
        .circle(anchor.x, anchor.y, 13, 0x0b1224, 0.58)
        .setStrokeStyle(1, 0x34465f, 0.9);
      const icon = this.add
        .image(anchor.x, anchor.y, "equipment/chassis.png")
        .setScale(0.7)
        .setAlpha(0.32);
      const label = this.add
        .text(anchor.x, anchor.y + 14, slot.name, {
          fontFamily: "monospace",
          fontSize: "4px",
          color: "#9caaa7",
          align: "center",
        })
        .setOrigin(0.5, 0);
      this.partLayer.add([ring, icon, label]);
      this.partRings.set(slot.id, ring);
      this.partIcons.set(slot.id, icon);
      this.partLabels.set(slot.id, label);
    }

    const len = this.cameras.main.width;
    const dust = this.add.graphics().setDepth(70).setAlpha(0.5);
    for (let index = 0; index < 52; index += 1) {
      dust.fillStyle(0xf4ead8, 0.12 + (index % 5) * 0.04);
      dust.fillRect((index * 73) % len, (index * 39) % 220, 1, 1);
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
    const design = room?.design;
    const phaseKey = `${phase}:${JSON.stringify(design?.components ?? {})}`;
    if (this.phaseSignature !== phaseKey) {
      this.phaseSignature = phaseKey;
      const designing = phase === "design";
      this.background?.setTexture(
        designing ? "scenes/hq_engineering_lab.png" : "scenes/hq_mission_control.png",
      );
      this.partLayer?.setVisible(designing);
      this.scanLine?.setVisible(designing);
      this.rover?.setVisible(designing);
      this.glow?.setVisible(designing);
      this.voss?.setVisible(designing);
      if (this.voss) {
        this.voss.setPosition(designing ? 332 : 322, designing ? 210 : 196);
        playIdle(this, this.voss, "voss", designing ? "left" : "down");
      }
    }

    if (design) {
      for (const slot of COMPONENT_SLOTS) {
        const component = componentById(design.components[slot.id]);
        const icon = this.partIcons.get(slot.id);
        const label = this.partLabels.get(slot.id);
        const ring = this.partRings.get(slot.id);
        if (!component || !icon || !label || !ring) continue;
        icon.setTexture(component.file);
        const upgraded = component.level > 0;
        icon.setAlpha(upgraded ? 1 : 0.58);
        icon.setTint(upgraded ? 0xffe1a6 : 0xb8c6c3);
        label.setText(component.shortName);
        label.setColor(upgraded ? "#f0b64b" : "#b7c4c2");
        if (upgraded) {
          ring.setStrokeStyle(1.5, 0xf0b64b, 0.95);
          ring.setFillStyle(0x3a2218, 0.62);
        } else {
          ring.setStrokeStyle(1, 0x526575, 0.7);
          ring.setFillStyle(0x0b1224, 0.52);
        }
      }
    }

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
      const shadow = this.add
        .ellipse(slot.x, slot.y - 1, 16, 5, 0x060b14, 0.34)
        .setDepth(slot.y - 2);
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
