import Phaser from "phaser";
import { formatClock } from "../../../shared/rules";
import { audio } from "../audio";
import { store } from "../store";
import { clamp, ensureSparkTexture, mulberry32 } from "./helpers";

const LAUNCH_DURATION = 14;

export class LaunchScene extends Phaser.Scene {
  private starsA: Phaser.GameObjects.Graphics | null = null;
  private starsB: Phaser.GameObjects.Graphics | null = null;
  private planet: Phaser.GameObjects.Container | null = null;
  private rocket: Phaser.GameObjects.Container | null = null;
  private flame: Phaser.GameObjects.Graphics | null = null;
  private pad: Phaser.GameObjects.Graphics | null = null;
  private surface: Phaser.GameObjects.Image | null = null;
  private lander: Phaser.GameObjects.Image | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private countdownText: Phaser.GameObjects.Text | null = null;
  private centerText: Phaser.GameObjects.Text | null = null;
  private stage = -1;
  private createdAt = 0;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor() {
    super("LaunchScene");
  }

  create(): void {
    this.createdAt = this.time.now;
    this.cameras.main.fadeIn(280, 0, 0, 0);

    this.starsA = this.add.graphics().setDepth(-20);
    this.starsB = this.add.graphics().setDepth(-21).setY(-224);
    this.drawStarLayer(this.starsA, 0x4d5e72, 54);
    this.drawStarLayer(this.starsB, 0x8798a3, 38);

    this.planet = this.add.container(292, 98).setDepth(-10).setAlpha(0).setScale(0.4);
    const planetGlow = this.add.graphics();
    planetGlow.fillStyle(0xc76537, 0.08);
    planetGlow.fillCircle(0, 0, 62);
    planetGlow.fillStyle(0xc76537, 0.12);
    planetGlow.fillCircle(0, 0, 52);
    const planetBody = this.add.graphics();
    planetBody.fillStyle(0x9a4a2f, 1);
    planetBody.fillCircle(0, 0, 42);
    planetBody.fillStyle(0xb45f3c, 1);
    planetBody.fillCircle(-10, -8, 34);
    planetBody.fillStyle(0x7b3424, 0.9);
    planetBody.fillCircle(12, 11, 8);
    planetBody.fillCircle(-19, 15, 5);
    planetBody.fillCircle(19, -18, 4);
    planetBody.fillStyle(0xdfcfb0, 0.75);
    planetBody.fillCircle(0, -36, 9);
    planetBody.fillRect(-9, -43, 18, 5);
    planetBody.lineStyle(1, 0xe8c79b, 0.28);
    planetBody.strokeCircle(0, 0, 43);
    this.planet.add([planetGlow, planetBody]);

    this.pad = this.add.graphics().setDepth(4);
    this.drawPad(this.pad);

    this.rocket = this.add.container(192, 198).setDepth(8);
    const body = this.add.graphics();
    body.fillStyle(0x344a67, 1);
    body.fillTriangle(0, -58, -10, -40, 10, -40);
    body.fillStyle(0xdfcfb0, 1);
    body.fillRect(-8, -42, 16, 44);
    body.fillStyle(0x9caaa7, 1);
    body.fillRect(-8, -42, 4, 44);
    body.fillStyle(0xc76537, 1);
    body.fillRect(-8, -17, 16, 8);
    body.fillStyle(0x23324d, 1);
    body.fillRect(-4, -35, 8, 9);
    body.fillStyle(0x6adbe0, 1);
    body.fillRect(-3, -34, 5, 4);
    body.fillStyle(0x2b2f3a, 1);
    body.fillTriangle(-8, -3, -15, 9, -8, 6);
    body.fillTriangle(8, -3, 15, 9, 8, 6);
    body.fillStyle(0xf0b64b, 1);
    body.fillRect(-8, -12, 16, 2);
    this.rocket.add(body);

    this.flame = this.add.graphics();
    this.rocket.add(this.flame);

    this.surface = this.add
      .image(192, 112, "scenes/mars_landing_zone.png")
      .setDepth(0)
      .setAlpha(0);
    this.lander = this.add
      .image(192, -50, "props/mars/lander.png")
      .setOrigin(0.5, 0.82)
      .setDepth(5)
      .setAlpha(0);

    ensureSparkTexture(this, "launch-spark", 0xf0b64b, 2);
    ensureSparkTexture(this, "launch-dust", 0xb9744d, 2);
    this.sparks = this.add
      .particles(0, 0, "launch-spark", {
        lifespan: { min: 260, max: 700 },
        speed: { min: 18, max: 92 },
        angle: { min: 74, max: 106 },
        scale: { start: 1, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xf0b64b, 0xd86549, 0xf4ead8],
        frequency: -1,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(9);
    this.dust = this.add
      .particles(0, 0, "launch-dust", {
        lifespan: { min: 700, max: 1_600 },
        speed: { min: 16, max: 84 },
        angle: { min: 205, max: 335 },
        gravityY: 8,
        scale: { start: 1.2, end: 0 },
        alpha: { start: 0.5, end: 0 },
        tint: [0xb9744d, 0x8d5439, 0xe8c79b],
        frequency: -1,
      })
      .setDepth(7);

    this.add
      .image(26, 25, "branding/patch_ares_survey.png")
      .setDepth(21)
      .setScale(0.38)
      .setAlpha(0.85);
    this.add
      .text(43, 14, "ARES SURVEY PROGRAM", {
        fontFamily: "monospace",
        fontSize: "6px",
        color: "#f4ead8",
        letterSpacing: 1,
      })
      .setDepth(21);
    this.add
      .text(43, 23, "MERIDIAN ASCENT / ATTEMPT " + String(store.current.room?.attempt ?? 1).padStart(2, "0"), {
        fontFamily: "monospace",
        fontSize: "5px",
        color: "#9caaa7",
      })
      .setDepth(21);

    this.countdownText = this.add
      .text(372, 14, "T-00:14", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#f0b64b",
        align: "right",
      })
      .setOrigin(1, 0)
      .setDepth(21);

    this.statusText = this.add
      .text(12, 208, "PRELAUNCH / SYSTEMS NOMINAL", {
        fontFamily: "monospace",
        fontSize: "6px",
        color: "#dfcfb0",
      })
      .setDepth(21);
    this.add
      .text(372, 208, "SOL 001 / ARES BASIN", {
        fontFamily: "monospace",
        fontSize: "5px",
        color: "#9caaa7",
      })
      .setOrigin(1, 0)
      .setDepth(21);

    this.centerText = this.add
      .text(192, 64, "MARS\nARES BASIN", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#f4ead8",
        align: "center",
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0.5)
      .setAlpha(0)
      .setDepth(21);

    this.updateTimeline(0, 0, true);
  }

  override update(_time: number, delta: number): void {
    const elapsed = this.elapsedNow();
    this.updateTimeline(elapsed, delta / 1000, false);
  }

  private elapsedNow(): number {
    const room = store.current.room;
    if (room?.launchAt) {
      const remaining = (room.launchAt - store.serverNow) / 1000;
      return clamp(LAUNCH_DURATION - remaining, 0, LAUNCH_DURATION);
    }
    return clamp((this.time.now - this.createdAt) / 1000, 0, LAUNCH_DURATION);
  }

  private updateTimeline(elapsed: number, dt: number, initial: boolean): void {
    const remaining = Math.max(0, LAUNCH_DURATION - elapsed);
    if (this.countdownText) {
      this.countdownText.setText(
        remaining > 0 ? `T-${formatClock(remaining)}` : "T+00:00",
      );
    }

    const stage =
      elapsed < 3.6 ? 0 : elapsed < 7.4 ? 1 : elapsed < 10.4 ? 2 : elapsed < 12.6 ? 3 : 4;
    if (stage !== this.stage) {
      this.enterStage(stage, initial);
      this.stage = stage;
    }

    const starSpeed = stage === 0 ? 7 : stage === 1 ? 92 : stage === 2 ? 18 : 9;
    if (this.starsA) {
      this.starsA.y += starSpeed * dt;
      if (this.starsA.y > 224) this.starsA.y -= 448;
    }
    if (this.starsB) {
      this.starsB.y += starSpeed * 0.62 * dt;
      if (this.starsB.y > 224) this.starsB.y -= 448;
    }

    if (this.rocket) {
      let rocketY = 198;
      if (stage === 1) rocketY = 198 - ((elapsed - 3.6) / 3.8) * 292;
      else if (stage >= 2) rocketY = -94;
      this.rocket.setY(rocketY);
      this.rocket.setVisible(stage < 2);
      this.rocket.setScale(1 + Math.min(0.16, elapsed * 0.012));
    }

    if (this.flame) {
      this.flame.clear();
      const visible = stage === 0 || stage === 1;
      if (visible) {
        const flicker = 0.82 + Math.random() * 0.35;
        const strong = stage === 1;
        this.flame.fillStyle(0xd86549, strong ? 0.85 : 0.55);
        this.flame.fillTriangle(-6, 1, 6, 1, 0, (strong ? 26 : 13) * flicker);
        this.flame.fillStyle(0xf0b64b, strong ? 1 : 0.7);
        this.flame.fillTriangle(-4, 1, 4, 1, 0, (strong ? 17 : 9) * flicker);
        this.flame.fillStyle(0xf4ead8, 0.9);
        this.flame.fillTriangle(-2, 1, 2, 1, 0, (strong ? 8 : 5) * flicker);
      }
    }

    if (this.planet) {
      const appear = clamp((elapsed - 5.6) / 2.2, 0, 1);
      const vanish = clamp((11.4 - elapsed) / 1.6, 0, 1);
      this.planet.setAlpha(Math.min(appear, vanish) * 0.95);
      this.planet.setScale(0.34 + appear * 0.7);
    }

    if (this.surface) {
      this.surface.setAlpha(clamp((elapsed - 10.1) / 1.7, 0, 1));
    }

    if (this.lander) {
      const visible = elapsed >= 10.2;
      this.lander.setVisible(visible);
      if (visible) {
        const descent = clamp((elapsed - 10.9) / 1.6, 0, 1);
        const eased = Phaser.Math.Easing.Sine.Out(descent);
        this.lander.setY(-52 + eased * 184);
        this.lander.setAlpha(clamp((elapsed - 10.2) / 0.8, 0, 1));
        if (stage === 4) {
          this.lander.setY(142);
          this.lander.setAlpha(1);
        }
      }
    }

    if (this.pad) {
      this.pad.setAlpha(clamp((elapsed - 9.6) / 1.2, 0, 1) * (1 - clamp((elapsed - 11.8) / 1.2, 0, 1)));
    }

    if (this.centerText) {
      const show = clamp((elapsed - 7.3) / 1.2, 0, 1) * clamp((11.8 - elapsed) / 1.2, 0, 1);
      this.centerText.setAlpha(show * 0.8);
    }

    if (this.flame && this.sparks) {
      const emitting = (stage === 0 || stage === 1) && this.rocket;
      if (emitting) {
        const x = this.rocket?.x ?? 192;
        const y = (this.rocket?.y ?? 198) + 5;
        if (Math.random() < 0.75) this.sparks.emitParticleAt(x, y, stage === 1 ? 2 : 1);
      }
    }

    if (this.dust && stage === 3) {
      if (Math.random() < 0.6) {
        this.dust.emitParticleAt(192 + (Math.random() - 0.5) * 42, 146, 1);
      }
    }
  }

  private enterStage(stage: number, initial: boolean): void {
    const statuses = [
      "PRELAUNCH / SYSTEMS NOMINAL",
      "ASCENT / MERIDIAN NOMINAL",
      "MARS APPROACH / ENTRY CORRIDOR",
      "ENTRY, DESCENT & LANDING",
      "TOUCHDOWN / ARES BASIN",
    ];
    this.statusText?.setText(statuses[stage] ?? statuses[0]!);
    if (stage === 1) {
      this.cameras.main.shake(700, 0.0035);
      if (!initial) audio.launch();
      if (this.pad) {
        this.tweens.add({ targets: this.pad, alpha: 0, duration: 1_200 });
      }
    }
    if (stage === 2 && !initial) {
      this.cameras.main.flash(240, 232, 199, 155, false);
    }
    if (stage === 3) {
      this.centerText?.setText("ARES BASIN\nLANDING ZONE");
    }
    if (stage === 4) {
      this.cameras.main.shake(520, 0.006);
      this.cameras.main.flash(180, 232, 199, 155, false);
      this.dust?.emitParticleAt(192, 146, 30);
      if (!initial) audio.touchdown();
      this.centerText?.setAlpha(0);
      this.add
        .text(192, 174, "TOUCHDOWN", {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#f0b64b",
          backgroundColor: "#0b1224",
          padding: { x: 5, y: 3 },
        })
        .setOrigin(0.5, 0)
        .setDepth(22)
        .setAlpha(0.92);
    }
  }

  private drawStarLayer(graphics: Phaser.GameObjects.Graphics, color: number, count: number): void {
    const random = mulberry32(0x52_46_01 + count);
    for (let index = 0; index < count; index += 1) {
      const x = Math.floor(random() * 384);
      const y = Math.floor(random() * 224);
      const size = random() > 0.82 ? 2 : 1;
      graphics.fillStyle(color, 0.35 + random() * 0.5);
      graphics.fillRect(x, y, size, size);
    }
  }

  private drawPad(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x162037, 1);
    graphics.fillRect(0, 208, 384, 16);
    graphics.fillStyle(0x344a67, 1);
    graphics.fillRect(150, 208, 84, 5);
    graphics.fillStyle(0x9caaa7, 0.6);
    graphics.fillRect(156, 206, 72, 2);
    graphics.fillStyle(0x2b2f3a, 1);
    graphics.fillRect(142, 209, 4, 14);
    graphics.fillRect(238, 209, 4, 14);
    graphics.lineStyle(1, 0xf0b64b, 0.4);
    graphics.strokeRect(158, 213, 68, 3);
    graphics.fillStyle(0xc76537, 0.55);
    graphics.fillRect(120, 213, 18, 1);
    graphics.fillRect(246, 213, 18, 1);
  }
}
