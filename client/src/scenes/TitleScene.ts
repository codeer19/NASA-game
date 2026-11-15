import Phaser from "phaser";
import { ensureSparkTexture } from "./helpers";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create(): void {
    this.cameras.main.fadeIn(700, 0, 0, 0);
    this.add.image(192, 112, "scenes/mars_landing_zone.png").setDepth(0);

    const shade = this.add.graphics().setDepth(2);
    shade.fillStyle(0x1c0f0c, 0.18);
    shade.fillRect(0, 0, 384, 224);

    const warm = this.add
      .rectangle(192, 120, 384, 224, 0xffa864, 0.08)
      .setDepth(3)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.add
      .image(142, 191, "props/mars/lander.png")
      .setOrigin(0.5, 0.86)
      .setDepth(10)
      .setScale(0.9);

    const rover = this.add
      .image(274, 190, "rover/rover_assembled.png")
      .setOrigin(0.5, 0.86)
      .setDepth(20)
      .setScale(1);
    rover.setAlpha(0.96);

    const roverShadow = this.add.ellipse(274, 191, 84, 20, 0x1a0d0b, 0.38).setDepth(19);

    this.tweens.add({
      targets: rover,
      y: 188,
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
    this.add
      .particles(0, 0, "title-dust", {
        x: { min: 0, max: 384 },
        y: { min: 20, max: 224 },
        lifespan: { min: 3_500, max: 7_000 },
        speedX: { min: -4, max: 8 },
        speedY: { min: -6, max: -1 },
        scale: { start: 1, end: 0 },
        alpha: { start: 0.24, end: 0 },
        frequency: 380,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(30);

    this.tweens.add({
      targets: warm,
      alpha: 0.14,
      duration: 3_400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
  }
}
