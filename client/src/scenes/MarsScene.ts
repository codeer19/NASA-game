import Phaser from "phaser";
import { LANDER_POSITION, SPAWN_POINTS, WORLD, roleById } from "../../../shared/content";
import { buildEffects } from "../../../shared/rules";
import type {
  MissionState,
  ObjectiveKind,
  ObjectiveState,
  PlayerPublic,
  RoomPublic,
} from "../../../shared/types";
import { assets } from "../assets";
import { audio } from "../audio";
import {
  consumeActionPulse,
  directionFromTouch,
  type Direction,
} from "../controls";
import { net } from "../net";
import {
  clearLocalPresence,
  localPresence,
  setLocalInteraction,
  updateLocalPresence,
} from "../presence";
import { store, toast } from "../store";
import {
  characterTexture,
  clamp,
  ensureSparkTexture,
  mulberry32,
  playIdle,
  playWalk,
  playWork,
} from "./helpers";

const TILE = 16;
const WORLD_WIDTH = WORLD.width;
const WORLD_HEIGHT = WORLD.height;
const MOVE_SPEED = 84;
const SEND_INTERVAL = 0.075;
const INTERACT_RANGE = 52;
const INTERACT_BREAK = 72;

const OBJECTIVE_STYLE: Record<
  ObjectiveKind,
  { color: number; icon: string; size: number }
> = {
  rocks: { color: 0xf0b64b, icon: "props/mars/sample_rock.png", size: 18 },
  soil: { color: 0xe0a15a, icon: "equipment/arm.png", size: 17 },
  soilResearch: { color: 0x6adbe0, icon: "equipment/spectrometer.png", size: 17 },
  weather: { color: 0xcfe9f0, icon: "equipment/weather.png", size: 17 },
  transmit: { color: 0x8fc8a8, icon: "equipment/antenna.png", size: 17 },
};

interface CrewView {
  id: string;
  character: string;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  targetX: number;
  targetY: number;
  dir: Direction;
  moving: boolean;
}

interface ObjectiveView {
  container: Phaser.GameObjects.Container;
  marker: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  ring: Phaser.GameObjects.Graphics;
}

interface Obstacle {
  x: number;
  y: number;
  radius: number;
}

export class MarsScene extends Phaser.Scene {
  private unsubscribe: (() => void) | null = null;
  private tileIndex = new Map<string, number>();
  private tileKey = "tiles/mars_tiles.png";
  private objectiveViews = new Map<string, ObjectiveView>();
  private crewViews = new Map<string, CrewView>();
  private crewSignature = "";
  private localId: string | null = null;
  private localView: CrewView | null = null;
  private localX: number = SPAWN_POINTS[0]?.x ?? 296;
  private localY: number = SPAWN_POINTS[0]?.y ?? 520;
  private localDir: Direction = "down";
  private interacting: string | null = null;
  private sendTimer = 0;
  private lastSentMoving = false;
  private dustTimer = 0;
  private obstacles: Obstacle[] = [];
  private keys: Record<string, Phaser.Input.Keyboard.Key> | null = null;
  private dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private lastCompleted = -1;
  private lastMissionId = "";
  private missionSnapshotSeen = false;
  private announcedCompletions = new Set<string>();
  private frozen = false;

  constructor() {
    super("MarsScene");
  }

  private resetRunState(): void {
    this.crewViews.clear();
    this.objectiveViews.clear();
    this.crewSignature = "";
    this.localId = null;
    this.localView = null;
    this.localDir = "down";
    this.localX = SPAWN_POINTS[0]?.x ?? 296;
    this.localY = SPAWN_POINTS[0]?.y ?? 520;
    this.interacting = null;
    this.sendTimer = 0;
    this.lastSentMoving = false;
    this.dustTimer = 0;
    this.obstacles = [];
    this.keys = null;
    this.dustEmitter = null;
    this.lastCompleted = -1;
    this.lastMissionId = "";
    this.missionSnapshotSeen = false;
    this.announcedCompletions.clear();
    this.frozen = false;
  }

  create(): void {
    // Phaser reuses the scene instance across restarts (retry/debrief), so
    // objects from the previous run are already destroyed. Clear the retained
    // view maps and signatures before rebuilding.
    this.resetRunState();

    this.cameras.main.setBackgroundColor("#241310");
    this.cameras.main.fadeIn(650, 0, 0, 0);
    this.tileKey = assets.marsTiles ? `tiles/${assets.marsTiles.image}` : "tiles/mars_tiles.png";
    this.tileIndex = new Map(
      (assets.marsTiles?.tiles ?? []).map((tile) => [tile.id, tile.index]),
    );

    this.buildTerrain();
    this.buildProps();
    this.buildObjectiveMarkers();
    this.buildCrew();
    this.buildAtmosphere();

    this.keys =
      (this.input.keyboard?.addKeys(
        "W,A,S,D,UP,DOWN,LEFT,RIGHT,E,Q",
      ) as unknown as Record<string, Phaser.Input.Keyboard.Key> | undefined) ?? null;
    this.input.keyboard?.addCapture([
      Phaser.Input.Keyboard.KeyCodes.W,
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.S,
      Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.E,
      Phaser.Input.Keyboard.KeyCodes.Q,
    ]);

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    if (this.localView) {
      this.cameras.main.startFollow(this.localView.sprite, true, 0.12, 0.12);
    } else {
      this.cameras.main.centerOn(this.localX, this.localY);
    }
    this.cameras.main.roundPixels = true;

    this.unsubscribe = store.subscribe((state) => this.syncState(state.room, state.playerId));
    this.syncState(store.current.room, store.current.playerId);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
      this.stopScan();
      clearLocalPresence();
    });
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    const state = store.current;
    const mission = state.mission;
    const room = state.room;
    const eventOpen = Boolean(mission?.activeEvent) || Boolean(mission?.result);
    this.frozen = room?.phase !== "mission" || !mission || eventOpen;

    if (!this.localView) return;

    const keys = this.keys;
    let dx = 0;
    let dy = 0;
    if (keys) {
      if (keys.A?.isDown || keys.LEFT?.isDown) dx -= 1;
      if (keys.D?.isDown || keys.RIGHT?.isDown) dx += 1;
      if (keys.W?.isDown || keys.UP?.isDown) dy -= 1;
      if (keys.S?.isDown || keys.DOWN?.isDown) dy += 1;
    }
    const touchDirection = directionFromTouch();
    if (touchDirection === "left") dx -= 1;
    if (touchDirection === "right") dx += 1;
    if (touchDirection === "up") dy -= 1;
    if (touchDirection === "down") dy += 1;

    if (eventOpen) {
      dx = 0;
      dy = 0;
    }

    const length = Math.hypot(dx, dy);
    const moving = length > 0 && !this.frozen;
    if (moving) {
      dx /= length;
      dy /= length;
      if (Math.abs(dx) > Math.abs(dy)) this.localDir = dx < 0 ? "left" : "right";
      else this.localDir = dy < 0 ? "up" : "down";

      const effects = mission ? buildEffects(mission.design) : null;
      const boosted = Boolean(mission && mission.boostUntil > store.serverNow);
      const speed = MOVE_SPEED * (effects?.speedMultiplier ?? 1) * (boosted ? 1.2 : 1);
      const nextX = clamp(this.localX + dx * speed * dt, 12, WORLD_WIDTH - 12);
      const nextY = clamp(this.localY + dy * speed * dt, 18, WORLD_HEIGHT - 6);
      if (!this.blocked(nextX, this.localY)) this.localX = nextX;
      if (!this.blocked(this.localX, nextY)) this.localY = nextY;
    }

    this.updateLocalView(moving);
    this.updateInteractionState(dt, moving);
    this.checkActionKeys();
    this.updateRemoteViews(dt);
    this.sendMovement(dt, moving);
    this.emitDust(dt, moving);

    if (this.localView) {
      this.localView.sprite.setDepth(this.localY);
      this.localView.shadow.setPosition(this.localX, this.localY - 1).setDepth(this.localY - 1);
      this.localView.label.setPosition(this.localX, this.localY - 33).setDepth(8000);
    }
    updateLocalPresence(this.localId, this.localX, this.localY, true, this.interacting);
  }

  private syncState(room: RoomPublic | null, playerId: string | null): void {
    if (!room) return;
    const mission = room.mission;
    this.localId = playerId;
    this.syncObjectives(mission?.objectives ?? []);
    this.syncCrew(room);

    if (playerId && mission) {
      const local = this.crewViews.get(playerId);
      if (local && !this.localView) {
        this.localView = local;
        this.localX = local.sprite.x;
        this.localY = local.sprite.y;
        this.cameras.main.startFollow(local.sprite, true, 0.12, 0.12);
      }
    }

    if (mission) {
      if (mission.missionId !== this.lastMissionId) {
        this.lastMissionId = mission.missionId;
        this.lastCompleted = -1;
        this.interacting = null;
        this.stopScan();
      }
      const completed = mission.objectives.filter(
        (objective) => objective.completed && objective.kind !== "transmit",
      ).length;
      if (this.lastCompleted >= 0 && completed > this.lastCompleted) {
        this.cameras.main.flash(190, 143, 200, 168, false);
      }
      this.lastCompleted = completed;
      this.detectCompletions(mission);

      if (mission.activeEvent || mission.result) {
        if (this.interacting) this.stopScan();
      }
    } else if (this.interacting) {
      this.stopScan();
    }

    if (this.localView) {
      const localState = this.crewViews.get(playerId ?? "");
      if (localState) this.localView = localState;
    }
  }

  private detectCompletions(mission: MissionState): void {
    if (!this.missionSnapshotSeen) {
      this.missionSnapshotSeen = true;
      for (const objective of mission.objectives) {
        if (objective.completed) this.announcedCompletions.add(objective.id);
      }
      return;
    }
    for (const objective of mission.objectives) {
      if (!objective.completed || this.announcedCompletions.has(objective.id)) continue;
      this.announcedCompletions.add(objective.id);
      this.sampleBurst(objective.x, objective.y - 8, objective.kind);
    }
  }

  private sampleBurst(x: number, y: number, kind: ObjectiveKind): void {
    const style = OBJECTIVE_STYLE[kind];
    const texture = `burst-${kind}`;
    ensureSparkTexture(this, texture, style.color, 3);
    const emitter = this.add
      .particles(x, y, texture, {
        lifespan: { min: 320, max: 780 },
        speed: { min: 20, max: 66 },
        angle: { min: 195, max: 345 },
        gravityY: 62,
        scale: { start: 1.25, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [style.color, 0xffffff, 0xf4ead8],
        emitting: false,
      })
      .setDepth(7600);
    emitter.explode(kind === "transmit" ? 38 : 22);
    this.time.delayedCall(1_200, () => emitter.destroy());

    const pulse = this.add.circle(x, y - 4, 18, style.color, 0.16).setDepth(7500);
    pulse.setStrokeStyle(2, style.color, 0.75);
    this.tweens.add({
      targets: pulse,
      scale: 3,
      alpha: 0,
      duration: 650,
      ease: "Cubic.out",
      onComplete: () => pulse.destroy(),
    });

    if (kind === "transmit") {
      this.cameras.main.flash(260, 143, 200, 168, false);
    }
  }

  private syncObjectives(objectives: ObjectiveState[]): void {
    for (const objective of objectives) {
      let view = this.objectiveViews.get(objective.id);
      if (!view) {
        view = this.createObjectiveMarker(objective);
        this.objectiveViews.set(objective.id, view);
      }
      const style = OBJECTIVE_STYLE[objective.kind];
      const visible = objective.unlocked && !objective.completed;
      view.container.setVisible(visible);
      view.marker.setTexture(style.icon);
      view.marker.setDisplaySize(style.size, style.size);
      view.marker.setTint(style.color);
      view.ring.clear();
      view.ring.lineStyle(1, style.color, 0.55);
      view.ring.strokeEllipse(0, 2, 30, 11);
      view.label.setText(objective.shortName);
      view.label.setColor(objective.unlocked ? "#f4ead8" : "#a89c90");
    }
  }

  private createObjectiveMarker(objective: ObjectiveState): ObjectiveView {
    const style = OBJECTIVE_STYLE[objective.kind];
    const ring = this.add.graphics();
    ring.lineStyle(1, style.color, 0.55);
    ring.strokeEllipse(0, 2, 30, 11);

    const marker = this.add
      .image(0, -13, style.icon)
      .setDisplaySize(style.size, style.size)
      .setTint(style.color);
    const label = this.add
      .text(0, -24, objective.shortName, {
        fontFamily: "monospace",
        fontSize: "5px",
        color: "#f4ead8",
        backgroundColor: "#0b1224",
        padding: { x: 2, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setAlpha(0.92);

    const container = this.add
      .container(objective.x, objective.y, [ring, marker, label])
      .setDepth(5000);
    this.tweens.add({
      targets: marker,
      y: -15,
      duration: 1_100,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    this.tweens.add({
      targets: ring,
      alpha: { from: 0.35, to: 0.8 },
      duration: 1_200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    return { container, marker, label, ring };
  }

  private syncCrew(room: RoomPublic): void {
    const signature = room.players
      .map((player) => `${player.id}:${player.role ?? "none"}:${player.name}:${player.connected}`)
      .join("|");
    if (signature === this.crewSignature) {
      this.updateCrewTargets(room);
      return;
    }
    this.crewSignature = signature;

    const seen = new Set<string>();
    for (const player of room.players) {
      seen.add(player.id);
      if (this.crewViews.has(player.id)) continue;
      this.createCrewView(player);
    }
    for (const [id, view] of [...this.crewViews.entries()]) {
      if (seen.has(id)) continue;
      view.sprite.destroy();
      view.shadow.destroy();
      view.label.destroy();
      this.crewViews.delete(id);
    }
    this.localId = store.current.playerId;
    this.localView = this.localId ? this.crewViews.get(this.localId) ?? null : null;
    if (this.localView) {
      this.localX = this.localView.targetX;
      this.localY = this.localView.targetY;
    }
    this.updateCrewTargets(room);
  }

  private createCrewView(player: PlayerPublic): void {
    const role = roleById(player.role);
    const characterId = role?.characterId ?? "nia";
    const texture = characterTexture(characterId);
    const isLocal = player.id === store.current.playerId;
    const position = store.current.positions[player.id];
    const spawn = SPAWN_POINTS[this.crewViews.size % SPAWN_POINTS.length] ?? SPAWN_POINTS[0]!;
    const x = position?.x ?? (isLocal ? spawn.x : LANDER_POSITION.x + 70 + this.crewViews.size * 18);
    const y = position?.y ?? (isLocal ? spawn.y : LANDER_POSITION.y + 54 + this.crewViews.size * 10);
    const dir = (position?.dir ?? "down") as Direction;

    const shadow = this.add.ellipse(x, y - 1, 16, 5, 0x100907, 0.38).setDepth(y - 1);
    const sprite = this.add
      .sprite(x, y, texture)
      .setOrigin(0.5, 1)
      .setDepth(y)
      .setAlpha(player.connected ? 1 : 0.4);
    playIdle(this, sprite, characterId, dir);

    const label = this.add
      .text(x, y - 33, player.name, {
        fontFamily: "monospace",
        fontSize: "5px",
        color: isLocal ? "#f0b64b" : "#f4ead8",
        backgroundColor: "#0b1224",
        padding: { x: 2, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(8000)
      .setAlpha(0.88);

    this.crewViews.set(player.id, {
      id: player.id,
      character: characterId,
      sprite,
      shadow,
      label,
      targetX: x,
      targetY: y,
      dir,
      moving: false,
    });
    if (isLocal) {
      this.localView = this.crewViews.get(player.id) ?? null;
      this.localX = x;
      this.localY = y;
      this.localDir = dir;
    }
  }

  private updateCrewTargets(room: RoomPublic): void {
    for (const [id, view] of this.crewViews) {
      const position = store.current.positions[id];
      if (!position) continue;
      view.targetX = position.x;
      view.targetY = position.y;
      view.dir = position.dir;
      view.moving = position.moving;
      const player = room.players.find((entry) => entry.id === id);
      if (player) {
        view.sprite.setAlpha(player.connected ? 1 : 0.4);
        view.label.setAlpha(player.connected ? 0.88 : 0.4);
      }
      if (!this.localView || id !== this.localView.id) {
        const distance = Math.hypot(view.sprite.x - position.x, view.sprite.y - position.y);
        if (distance > 240) {
          view.sprite.setPosition(position.x, position.y);
          view.shadow.setPosition(position.x, position.y - 1);
          view.label.setPosition(position.x, position.y - 33);
        }
      }
    }
  }

  private updateRemoteViews(dt: number): void {
    this.updatePlayers(dt);
  }

  private updatePlayers(dt: number): void {
    if (!this.localView) return;
    const t = 1 - Math.exp(-12 * dt);
    for (const view of this.crewViews.values()) {
      if (view.id === this.localView.id) continue;
      view.sprite.x = Phaser.Math.Linear(view.sprite.x, view.targetX, t);
      view.sprite.y = Phaser.Math.Linear(view.sprite.y, view.targetY, t);
      view.shadow.setPosition(view.sprite.x, view.sprite.y - 1);
      view.shadow.setDepth(view.sprite.y - 1);
      view.sprite.setDepth(view.sprite.y);
      view.label.setPosition(view.sprite.x, view.sprite.y - 33);
      if (this.frozen || !view.moving) {
        playIdle(this, view.sprite, view.character, view.dir);
      } else {
        playWalk(this, view.sprite, view.character, view.dir);
      }
    }
  }

  private updateLocalView(moving: boolean): void {
    if (!this.localView) return;
    this.localView.sprite.setPosition(this.localX, this.localY);
    this.localView.dir = this.localDir;
    this.localView.moving = moving;
    const target = this.currentTarget();
    if (this.interacting && target) {
      playWork(this, this.localView.sprite, this.localView.character, this.localDir);
    } else if (moving) {
      playWalk(this, this.localView.sprite, this.localView.character, this.localDir);
    } else {
      playIdle(this, this.localView.sprite, this.localView.character, this.localDir);
    }
  }

  private checkActionKeys(): void {
    const keys = this.keys;
    if (!keys) return;
    const actionPressed =
      (keys.E ? Phaser.Input.Keyboard.JustDown(keys.E) : false) || consumeActionPulse();
    if (actionPressed) this.toggleInteraction();
    if (keys.Q && Phaser.Input.Keyboard.JustDown(keys.Q)) this.useAbility();
  }

  private toggleInteraction(): void {
    if (this.frozen) return;
    if (this.interacting) {
      void this.stopInteraction();
      return;
    }
    const target = this.currentTarget(INTERACT_RANGE);
    if (!target) {
      toast("No field objective in range.", "warning", 2_600);
      audio.denied();
      return;
    }
    void net.interact(target.id).then((result) => {
      if (!result.ok) {
        toast(result.error, "warning");
        audio.denied();
        return;
      }
      this.interacting = target.id;
      setLocalInteraction(target.id);
      audio.scanStart();
    });
  }

  private async stopInteraction(): Promise<void> {
    this.interacting = null;
    setLocalInteraction(null);
    this.stopScan();
    await net.interact(null);
  }

  private stopScan(): void {
    this.interacting = null;
    setLocalInteraction(null);
    audio.scanStop();
  }

  private useAbility(): void {
    if (this.frozen) return;
    void net.ability().then((result) => {
      if (result.ok) {
        audio.ability();
      } else {
        toast(result.error, "warning", 3_500);
        audio.denied();
      }
    });
  }

  private updateInteractionState(_dt: number, moving: boolean): void {
    if (!this.interacting) return;
    const mission = store.current.mission;
    if (!mission || mission.activeEvent || mission.result || this.frozen) {
      this.stopScan();
      return;
    }
    const objective = mission.objectives.find((entry) => entry.id === this.interacting);
    const distance = objective ? Math.hypot(this.localX - objective.x, this.localY - objective.y) : 999;
    if (
      !objective ||
      objective.completed ||
      !objective.unlocked ||
      distance > INTERACT_BREAK ||
      moving
    ) {
      void this.stopInteraction();
    }
  }

  private currentTarget(range = INTERACT_RANGE): ObjectiveState | null {
    const objectives = store.current.mission?.objectives ?? [];
    let best: ObjectiveState | null = null;
    let bestDistance = range;
    for (const objective of objectives) {
      if (!objective.unlocked || objective.completed) continue;
      const distance = Math.hypot(this.localX - objective.x, this.localY - objective.y);
      if (distance <= bestDistance) {
        best = objective;
        bestDistance = distance;
      }
    }
    return best;
  }

  private sendMovement(dt: number, moving: boolean): void {
    this.sendTimer += dt;
    const shouldSend = moving || this.lastSentMoving;
    if (this.sendTimer < SEND_INTERVAL || !shouldSend) return;
    this.sendTimer = 0;
    this.lastSentMoving = moving;
    net.move({
      x: Math.round(this.localX * 10) / 10,
      y: Math.round(this.localY * 10) / 10,
      dir: this.localDir,
      moving,
    });
  }

  private emitDust(dt: number, moving: boolean): void {
    if (!this.dustEmitter || !moving) return;
    this.dustTimer += dt;
    if (this.dustTimer < 0.11) return;
    this.dustTimer = 0;
    this.dustEmitter.emitParticleAt(
      this.localX + (Math.random() - 0.5) * 8,
      this.localY - 2,
      1,
    );
  }

  private blocked(x: number, y: number): boolean {
    for (const obstacle of this.obstacles) {
      if (Math.hypot(x - obstacle.x, y - obstacle.y) < obstacle.radius + 6) return true;
    }
    return false;
  }

  private buildTerrain(): void {
    const random = mulberry32(0x4d_41_52_53);
    const render = this.add.renderTexture(0, 0, WORLD_WIDTH, WORLD_HEIGHT).setOrigin(0, 0).setDepth(-100);
    const columns = Math.ceil(WORLD_WIDTH / TILE);
    const rows = Math.ceil(WORLD_HEIGHT / TILE);

    const frame = (id: string): number => this.tileIndex.get(id) ?? 0;
    const draw = (x: number, y: number, id: string, alpha = 1): void => {
      render.drawFrame(this.tileKey, frame(id), x * TILE, y * TILE, alpha);
    };

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const roll = random();
        let id = "mars_sand_a";
        if (roll < 0.2) id = "mars_sand_b";
        else if (roll < 0.36) id = "mars_sand_c";
        else if (roll < 0.5) id = "mars_sand_d";
        else if (roll < 0.58) id = "mars_sand_ripple_a";
        else if (roll < 0.64) id = "mars_sand_ripple_b";
        else if (roll < 0.7) id = "mars_sand_coarse";
        else if (roll < 0.75) id = "mars_sand_pebbles";
        else if (roll < 0.8) id = "mars_regolith_a";
        else if (roll < 0.85) id = "mars_regolith_b";
        else if (roll < 0.9) id = "mars_dust_rust";
        else if (roll < 0.94) id = "mars_wind_patch";
        else if (roll < 0.97) id = "mars_sand_shadow";
        else id = "mars_gravel_a";
        draw(x, y, id);
      }
    }

    const path = (x1: number, y1: number, x2: number, y2: number): void => {
      const fromX = Math.min(x1, x2);
      const toX = Math.max(x1, x2);
      const fromY = Math.min(y1, y2);
      const toY = Math.max(y1, y2);
      if (fromY === toY) {
        for (let x = fromX; x <= toX; x += 1) draw(x, fromY, "mars_path_h");
      } else if (fromX === toX) {
        for (let y = fromY; y <= toY; y += 1) draw(fromX, y, "mars_path_v");
      }
    };

    path(11, 13, 11, 31);
    path(11, 11, 30, 11);
    path(29, 5, 29, 11);
    path(30, 11, 52, 11);
    path(11, 31, 50, 31);
    path(6, 23, 11, 23);
    path(6, 23, 6, 31);

    for (let y = 3; y <= 9; y += 1) {
      for (let x = 27; x <= 34; x += 1) {
        draw(x, y, random() > 0.55 ? "mars_rock_shelf" : "mars_rock_shelf_cracked");
      }
    }
    for (let y = 27; y <= 34; y += 1) {
      for (let x = 47; x <= 54; x += 1) {
        const roll = random();
        draw(
          x,
          y,
          roll < 0.35
            ? "mars_basalt_a"
            : roll < 0.6
              ? "mars_basalt_b"
              : roll < 0.8
                ? "mars_basalt_fracture"
                : "mars_basalt_gravel",
        );
      }
    }
    for (let y = 8; y <= 15; y += 1) {
      for (let x = 48; x <= 57; x += 1) {
        draw(x, y, random() > 0.5 ? "mars_dune_crest" : "mars_dune_shadow");
      }
    }
    for (let y = 20; y <= 26; y += 1) {
      for (let x = 3; x <= 9; x += 1) {
        draw(x, y, random() > 0.5 ? "mars_compacted_a" : "mars_compacted_b");
      }
    }

    for (let y = 26; y <= 34; y += 1) {
      for (let x = 7; x <= 17; x += 1) {
        const roll = random();
        draw(
          x,
          y,
          roll < 0.24
            ? "mars_gravel_a"
            : roll < 0.38
              ? "mars_compacted_b"
              : "mars_compacted_a",
        );
      }
    }
    for (let y = 27; y <= 31; y += 1) {
      for (let x = 8; x <= 14; x += 1) {
        const edge = x === 8 || x === 14 || y === 27 || y === 31;
        draw(x, y, edge ? "mars_landing_pad_edge" : "mars_landing_pad_center");
      }
    }
    for (let y = 30; y <= 32; y += 1) {
      for (let x = 14; x <= 16; x += 1) draw(x, y, "mars_rover_park");
    }

    const crater: string[][] = [
      ["mars_sand_coarse", "mars_transition_sand_n", "mars_sand_coarse"],
      ["mars_transition_sand_w", "mars_crater_center", "mars_transition_sand_e"],
      ["mars_sand_coarse", "mars_transition_sand_s", "mars_sand_coarse"],
    ];
    const craterIds: string[][] = [
      ["mars_crater_nw", "mars_crater_n", "mars_crater_ne"],
      ["mars_crater_w", "mars_crater_center", "mars_crater_e"],
      ["mars_crater_sw", "mars_crater_s", "mars_crater_se"],
    ];
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const x = 11 + dx;
        const y = 10 + dy;
        const edge = Math.abs(dx) === 2 || Math.abs(dy) === 2;
        draw(x, y, edge ? (random() > 0.5 ? "mars_sand_pebbles" : "mars_sand_coarse") : "mars_sand_b");
      }
    }
    for (let dy = 0; dy < 3; dy += 1) {
      for (let dx = 0; dx < 3; dx += 1) {
        const row = crater[dy];
        const rowIds = craterIds[dy];
        if (!row || !rowIds) continue;
        const outer = row[dx];
        const inner = rowIds[dx];
        if (outer) draw(10 + dx, 9 + dy, outer);
        if (inner && !(dy === 1 && dx === 1)) draw(10 + dx, 9 + dy, inner);
      }
    }

    for (let index = 0; index < 120; index += 1) {
      const x = Math.floor(random() * columns);
      const y = Math.floor(random() * rows);
      const roll = random();
      if (roll < 0.3) draw(x, y, "mars_pebbles", 0.5);
      else if (roll < 0.55) draw(x, y, "mars_cracks", 0.35);
      else if (roll < 0.72) draw(x, y, "mars_wind_h", 0.35);
      else if (roll < 0.86) draw(x, y, "mars_wind_v", 0.3);
      else draw(x, y, "mars_dust_haze", 0.16);
    }

    const edge = this.add.graphics().setDepth(-90);
    edge.fillStyle(0x2a1410, 0.55);
    edge.fillRect(0, 0, WORLD_WIDTH, 8);
    edge.fillRect(0, WORLD_HEIGHT - 10, WORLD_WIDTH, 10);
    edge.fillRect(0, 0, 8, WORLD_HEIGHT);
    edge.fillRect(WORLD_WIDTH - 8, 0, 8, WORLD_HEIGHT);
  }

  private buildProps(): void {
    const random = mulberry32(0x52_4f_56_52);
    const addShadow = (x: number, y: number, width: number): void => {
      this.add.ellipse(x, y, width, width * 0.24, 0x140b08, 0.3).setDepth(y - 2);
    };
    const addProp = (
      file: string,
      x: number,
      y: number,
      scale = 1,
      shadowWidth = 0,
      depth?: number,
    ): Phaser.GameObjects.Image => {
      if (shadowWidth) addShadow(x, y - 1, shadowWidth);
      return this.add
        .image(x, y, `props/mars/${file}`)
        .setOrigin(0.5, 1)
        .setScale(scale)
        .setDepth(depth ?? y);
    };

    addProp("landing_pad.png", LANDER_POSITION.x, LANDER_POSITION.y + 24, 1.05, 0, 300);
    addProp("lander.png", LANDER_POSITION.x, LANDER_POSITION.y - 4, 1, 90);
    this.obstacles.push({ x: LANDER_POSITION.x, y: LANDER_POSITION.y - 30, radius: 26 });

    // The rover artwork lives outside the props folder.
    this.add
      .image(250, 505, "rover/rover_assembled.png")
      .setOrigin(0.5, 0.86)
      .setDepth(505)
      .setScale(0.98);
    addShadow(250, 506, 82);

    addProp("field_habitat.png", 330, 590, 1, 110);
    addProp("solar_array.png", 404, 566, 1, 64);
    addProp("cargo_crate.png", 286, 548, 1, 20);
    addProp("cargo_crate.png", 270, 558, 0.9, 18);
    addProp("beacon.png", 196, 514, 1, 10);
    // Collide with the habitat footprint, not the roof, so the crew spawn
    // points beside the rover stay walkable.
    this.obstacles.push({ x: 330, y: 580, radius: 32 });

    addProp("relay.png", 472, 110, 1, 20);
    addProp("relay.png", 912, 332, 0.95, 18);
    addProp("sample_rock.png", 176, 171, 1, 16);
    addProp("sample_rock.png", 832, 191, 1, 18);
    addProp("sample_rock.png", 800, 506, 1, 16);
    addProp("cargo_crate.png", 96, 375, 1, 20);
    addProp("beacon.png", 110, 368, 0.9, 8);

    for (const labX of [216, 368]) {
      addShadow(labX, 547, 24);
      this.add
        .image(labX, 548, "equipment/spectrometer.png")
        .setOrigin(0.5, 1)
        .setScale(1.15)
        .setDepth(548);
    }

    addProp("mesa.png", 700, 160, 1, 120);
    addProp("mesa.png", 946, 438, 0.9, 108);
    addProp("rock_cluster.png", 420, 310, 1, 52);
    addProp("rock_cluster.png", 560, 470, 1, 50);
    addProp("rock_cluster.png", 70, 116, 1, 48);
    addProp("rock_cluster.png", 912, 238, 1, 50);
    addProp("rock_b.png", 660, 530, 1, 34);
    addProp("rock_b.png", 360, 88, 1, 34);
    addProp("rock_a.png", 540, 206, 1, 22);

    this.obstacles.push(
      { x: 700, y: 118, radius: 54 },
      { x: 946, y: 400, radius: 48 },
      { x: 420, y: 290, radius: 24 },
      { x: 560, y: 450, radius: 22 },
      { x: 70, y: 96, radius: 20 },
      { x: 912, y: 218, radius: 22 },
    );

    const avoid = [
      LANDER_POSITION,
      { x: 250, y: 505 },
      { x: 330, y: 590 },
      ...SPAWN_POINTS,
      ...(store.current.mission?.objectives ?? []).map((objective) => ({
        x: objective.x,
        y: objective.y,
      })),
    ];
    const rockFiles = ["rock_a.png", "rock_b.png", "rock_cluster.png", "sample_rock.png"];
    for (let index = 0; index < 26; index += 1) {
      const x = 46 + random() * (WORLD_WIDTH - 92);
      const y = 96 + random() * (WORLD_HEIGHT - 160);
      const tooClose = avoid.some((point) => Math.hypot(point.x - x, point.y - y) < 92);
      if (tooClose) continue;
      const file = rockFiles[Math.floor(random() * rockFiles.length)] ?? "rock_a.png";
      const scale = 0.65 + random() * 0.5;
      addProp(file, x, y, scale, 0);
    }
  }

  private buildObjectiveMarkers(): void {
    this.syncObjectives(store.current.mission?.objectives ?? []);
  }

  private buildCrew(): void {
    const room = store.current.room;
    if (room) this.syncCrew(room);
  }

  private buildAtmosphere(): void {
    ensureSparkTexture(this, "mars-dust", 0xc98a5c, 2);
    this.dustEmitter = this.add
      .particles(0, 0, "mars-dust", {
        lifespan: { min: 260, max: 620 },
        speed: { min: 8, max: 26 },
        angle: { min: 210, max: 330 },
        scale: { start: 1, end: 0 },
        alpha: { start: 0.32, end: 0 },
        frequency: -1,
        tint: [0xc98a5c, 0x9a6a4a, 0xe8c79b],
      })
      .setDepth(7000);
    this.add
      .particles(0, 0, "mars-dust", {
        x: { min: 0, max: WORLD_WIDTH },
        y: { min: 0, max: WORLD_HEIGHT },
        lifespan: { min: 4_000, max: 8_000 },
        speedX: { min: 6, max: 18 },
        speedY: { min: -3, max: 3 },
        scale: { start: 1, end: 0.2 },
        alpha: { start: 0.1, end: 0 },
        frequency: 220,
      })
      .setDepth(7200);
    this.add
      .rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 0xffa864, 0.06)
      .setDepth(7085)
      .setBlendMode(Phaser.BlendModes.ADD);
    const landerGlow = this.add
      .ellipse(LANDER_POSITION.x, LANDER_POSITION.y + 4, 142, 58, 0xf0b64b, 0.08)
      .setDepth(299)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: landerGlow,
      alpha: 0.15,
      scaleX: 1.06,
      duration: 2_600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    const haze = this.add.graphics().setDepth(7100).setScrollFactor(0);
    haze.fillStyle(0xd28a5e, 0.025);
    haze.fillRect(0, 0, 384, 224);
  }
}
