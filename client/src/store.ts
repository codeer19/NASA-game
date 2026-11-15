import type {
  MissionState,
  PositionState,
  RoomPublic,
} from "../../shared/types";

export type ConnectionState = "connecting" | "online" | "offline";

export interface CommMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
}

export interface GameState {
  connection: ConnectionState;
  assetsReady: boolean;
  room: RoomPublic | null;
  mission: MissionState | null;
  positions: Record<string, PositionState>;
  playerId: string | null;
  clockOffsetMs: number;
  latestComm: CommMessage | null;
  resuming: boolean;
}

type Listener = (state: GameState) => void;

class GameStore {
  private state: GameState = {
    connection: "connecting",
    assetsReady: false,
    room: null,
    mission: null,
    positions: {},
    playerId: null,
    clockOffsetMs: 0,
    latestComm: null,
    resuming: false,
  };

  private listeners = new Set<Listener>();

  get current(): GameState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state);
  }

  private patch(partial: Partial<GameState>): void {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  setConnection(connection: ConnectionState): void {
    this.patch({ connection });
  }

  setAssetsReady(assetsReady: boolean): void {
    this.patch({ assetsReady });
  }

  setResuming(resuming: boolean): void {
    this.patch({ resuming });
  }

  setPlayer(playerId: string | null): void {
    this.patch({ playerId });
  }

  setRoom(room: RoomPublic | null): void {
    this.patch({
      room,
      mission: room?.mission ?? null,
      positions: room?.positions ?? {},
      playerId: this.state.playerId,
      clockOffsetMs: room ? room.serverNow - Date.now() : this.state.clockOffsetMs,
    });
  }

  setMission(mission: MissionState, positions?: Record<string, PositionState>): void {
    const room = this.state.room;
    this.patch({
      mission,
      positions: positions ?? this.state.positions,
      // Keep the lower-frequency room snapshot aligned with the live mission
      // feed. Rail panels and signatures render from `room` and would
      // otherwise stay frozen at the mission-start snapshot.
      room: room ? { ...room, mission } : null,
      clockOffsetMs: mission.serverNow - Date.now(),
    });
  }

  mergePositions(positions: Record<string, PositionState>, serverNow?: number): void {
    this.patch({
      positions: { ...this.state.positions, ...positions },
      clockOffsetMs:
        typeof serverNow === "number" ? serverNow - Date.now() : this.state.clockOffsetMs,
    });
  }

  setComm(latestComm: CommMessage): void {
    this.patch({ latestComm });
  }

  clearRoom(): void {
    this.patch({
      room: null,
      mission: null,
      positions: {},
      playerId: null,
      latestComm: null,
      resuming: false,
    });
  }

  get serverNow(): number {
    return Date.now() + this.state.clockOffsetMs;
  }

  get me() {
    if (!this.state.room || !this.state.playerId) return null;
    return (
      this.state.room.players.find((player) => player.id === this.state.playerId) ?? null
    );
  }

  get myPosition(): PositionState | null {
    if (!this.state.playerId) return null;
    return this.state.positions[this.state.playerId] ?? null;
  }

  get isHost(): boolean {
    return this.state.room?.hostId === this.state.playerId;
  }
}

export const store = new GameStore();

export type ToastTone = "info" | "success" | "warning" | "error";

export interface ToastDetail {
  message: string;
  tone?: ToastTone;
  ttl?: number;
}

export const appBus = new EventTarget();

export function toast(message: string, tone: ToastTone = "info", ttl = 5200): void {
  appBus.dispatchEvent(
    new CustomEvent<ToastDetail>("toast", { detail: { message, tone, ttl } }),
  );
}

export function sessionMessage(message: string): void {
  appBus.dispatchEvent(new CustomEvent<string>("session-message", { detail: message }));
}
