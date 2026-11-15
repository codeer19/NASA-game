import Phaser from "phaser";
import { ensureSparkTexture } from "./helpers";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create(): void {
    this.cameras.main.fadeIn(700, 0, 0, 0);
    this.add.image(192, 112, "scenes/hq_mission_control.png").setDepth(0);

    const shade = this.add.graphics().setDepth(1);
    shade.fillStyle(0x07101e, 0.18);
    shade.fillRect(0, 0, 384, 224);

    const rover = this.add
      .image(300, 188, "rover/rover_assembled.png")
      .setOrigin(0.5, 0.86)
      .setDepth(20)
      .setScale(1);
    rover.setAlpha(0.94);

    const roverShadow = this.add.ellipse(300, 189, 84, 20, 0x060b14, 0.35).setDepth(19);

    this.tweens.add({
      targets: rover,
      y: 186,
      duration: 2400,
      ease: "Sine.inOut",
      yoyo: true,
      repeat: -1,
    });
    this.tweens.add({
      targets: roverShadow,
      scaleX: 0.94,
      alpha: 0.3,
      duration: 2400,
      ease: "Sine.inOut",
      yoyo: true,
      repeat: -1,
    });

    ensureSparkTexture(this, "title-dust", 0xf4ead8, 1);
    const dust = this.add.particles(0, 0, "title-dust", {
      x: { min: 0, max: 384 },
      y: { min: 20, max: 224 },
      lifespan: { min: 3_500, max: 7_000 },
      speedX: { min: -4, max: 8 },
      speedY: { min: -6, max: -1 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.22, end: 0 },
      frequency: 420,
      blendMode: Phaser.BlendModes.ADD,
    });
    dust.setDepth(30);

    const signal = this.add.graphics().setDepth(31);
    signal.fillStyle(0x6adbe0, 0.8);
    signal.fillRect(326, 62, 13, 1);
    this.tweens.add({
      targets: signal,
      alpha: 0.15,
      duration: 860,
      yoyo: true,
      repeat: -1,
      ease: "Steps",
    });

    const ticks = this.add.graphics().setDepth(31);
    ticks.lineStyle(1, 0xf0b64b, 0.28);
    ticks.strokeRect(368, 8, 7, 7);
    ticks.strokeRect(8, 208, 40, 1);
  }
}
