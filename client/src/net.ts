import { io, type Socket } from "socket.io-client";
import type {
  Ack,
  ClientToServerEvents,
  ComponentId,
  ComponentSlot,
  LandingSiteId,
  RoomJoinResult,
  RoleId,
  ScienceCategory,
  ServerToClientEvents,
} from "../../shared/types";
import { appBus, store, toast } from "./store";

type FrontierSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const TOKEN_KEY = "red-frontier-token";
const ROOM_KEY = "red-frontier-room";
const NAME_KEY = "red-frontier-callsign";

function createToken(): string {
  try {
    const existing = sessionStorage.getItem(TOKEN_KEY);
    if (existing && existing.length > 12) return existing;
    const token =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
    sessionStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
  }
}

function request<T>(
  socket: FrontierSocket,
  emit: (callback: (result: Ack<T>) => void) => void,
  timeoutMs = 9_000,
): Promise<Ack<T>> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, error: "The game did not answer. Check your connection and try again." });
    }, timeoutMs);
    try {
      emit((result) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(result);
      });
    } catch {
      settled = true;
      window.clearTimeout(timer);
      resolve({ ok: false, error: "The game connection is unavailable." });
    }
  });
}

class NetworkClient {
  private socket: FrontierSocket;
  private token = createToken();
  private savedRoomCode: string | null = null;
  private resuming = false;
  private wasOnline = false;
  private hasShownOffline = false;

  constructor() {
    try {
      this.savedRoomCode = sessionStorage.getItem(ROOM_KEY);
    } catch {
      this.savedRoomCode = null;
    }
    this.socket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 700,
      reconnectionDelayMax: 4_000,
      timeout: 8_000,
      transports: ["websocket", "polling"],
    });
    this.bind();
  }

  get connected(): boolean {
    return this.socket.connected;
  }

  savedCallsign(): string {
    try {
      return localStorage.getItem(NAME_KEY) ?? "";
    } catch {
      return "";
    }
  }

  rememberCallsign(name: string): void {
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      // Optional convenience only.
    }
  }

  async createRoom(name: string): Promise<Ack<RoomJoinResult>> {
    const result = await request<RoomJoinResult>(this.socket, (callback) =>
      this.socket.emit("room:create", { name, token: this.token }, callback),
    );
    if (result.ok) await this.acceptRoom(result.value);
    return result;
  }

  async joinRoom(code: string, name: string): Promise<Ack<RoomJoinResult>> {
    const result = await request<RoomJoinResult>(this.socket, (callback) =>
      this.socket.emit("room:join", { code, name, token: this.token }, callback),
    );
    if (result.ok) await this.acceptRoom(result.value);
    return result;
  }

  async leaveRoom(): Promise<Ack> {
    const result = await request<undefined>(this.socket, (callback) =>
      this.socket.emit("room:leave", callback),
    );
    this.clearSession();
    store.clearRoom();
    return result;
  }

  async setRole(role: RoleId): Promise<Ack> {
    return request(this.socket, (callback) =>
      this.socket.emit("player:role", { role }, callback),
    );
  }

  async setReady(ready: boolean): Promise<Ack> {
    return request(this.socket, (callback) =>
      this.socket.emit("player:ready", { ready }, callback),
    );
  }

  async setComponent(slot: ComponentSlot, componentId: ComponentId): Promise<Ack> {
    return request(this.socket, (callback) =>
      this.socket.emit("design:component", { slot, componentId }, callback),
    );
  }

  async setLandingSite(siteId: LandingSiteId): Promise<Ack> {
    return request(this.socket, (callback) =>
      this.socket.emit("design:site", { siteId }, callback),
    );
  }

  async setScienceFocus(category: ScienceCategory): Promise<Ack> {
    return request(this.socket, (callback) =>
      this.socket.emit("design:focus", { category }, callback),
    );
  }

  async toDesign(): Promise<Ack> {
    return request(this.socket, (callback) => this.socket.emit("game:toDesign", callback));
  }

  async startMission(): Promise<Ack> {
    return request(this.socket, (callback) => this.socket.emit("game:start", callback));
  }

  async retryMission(): Promise<Ack> {
    return request(this.socket, (callback) => this.socket.emit("mission:retry", callback));
  }

  async returnToLobby(): Promise<Ack> {
    return request(this.socket, (callback) => this.socket.emit("room:lobby", callback));
  }

  move(payload: { x: number; y: number; dir: "down" | "left" | "right" | "up"; moving: boolean }): void {
    if (!this.socket.connected) return;
    this.socket.volatile.emit("mission:move", payload);
  }

  async interact(targetId: string | null): Promise<Ack> {
    return request(
      this.socket,
      (callback) => this.socket.emit("mission:interact", { targetId }, callback),
      3_500,
    );
  }

  async ability(): Promise<Ack> {
    return request(this.socket, (callback) => this.socket.emit("mission:ability", callback));
  }

  async vote(choiceId: string): Promise<Ack> {
    return request(this.socket, (callback) =>
      this.socket.emit("event:vote", { choiceId }, callback),
    );
  }

  async finalizeEvent(): Promise<Ack> {
    return request(this.socket, (callback) => this.socket.emit("event:finalize", callback));
  }

  async quickComm(text: string): Promise<Ack> {
    return request(this.socket, (callback) =>
      this.socket.emit("comm:quick", { text }, callback),
    );
  }

  reconnect(): void {
    if (!this.socket.connected) {
      store.setConnection("connecting");
      this.socket.connect();
    }
  }

  private bind(): void {
    this.socket.on("connect", () => {
      store.setConnection("online");
      this.wasOnline = true;
      this.hasShownOffline = false;
      if (this.savedRoomCode) void this.resumeSavedRoom();
    });

    this.socket.on("disconnect", () => {
      store.setConnection("offline");
      if (!this.hasShownOffline) {
        this.hasShownOffline = true;
        toast("Connection interrupted. Trying to reconnect…", "warning", 6_000);
      }
    });

    this.socket.on("connect_error", () => {
      store.setConnection("offline");
      if (!this.hasShownOffline) {
        this.hasShownOffline = true;
        toast("Cannot reach the game server. Is it running?", "error", 7_000);
      }
    });

    this.socket.on("room:state", (room) => {
      store.setRoom(room);
      if (room.phase !== "debrief") this.savedRoomCode = room.code;
    });

    this.socket.on("mission:state", ({ mission, positions }) => {
      store.setMission(mission, positions);
    });

    this.socket.on("crew:positions", ({ positions, serverNow }) => {
      store.mergePositions(positions, serverNow);
    });

    this.socket.on("comm:message", (message) => {
      store.setComm(message);
      appBus.dispatchEvent(new CustomEvent("comm", { detail: message }));
    });

    this.socket.on("server:error", ({ message }) => {
      toast(message, "error");
    });
  }

  private async resumeSavedRoom(): Promise<void> {
    if (this.resuming) return;
    const code = this.savedRoomCode;
    if (!code) return;
    this.resuming = true;
    store.setResuming(true);
    const result = await request<RoomJoinResult>(this.socket, (callback) =>
      this.socket.emit("room:resume", { code, token: this.token }, callback),
    );
    this.resuming = false;
    store.setResuming(false);
    if (result.ok) {
      await this.acceptRoom(result.value);
    } else {
      this.clearSession();
      store.clearRoom();
      if (this.wasOnline) {
        appBus.dispatchEvent(
          new CustomEvent<string>("session-message", {
            detail: "Your old game has ended. Start or join a new one.",
          }),
        );
      }
    }
  }

  private async acceptRoom(result: RoomJoinResult): Promise<void> {
    store.setPlayer(result.playerId);
    store.setRoom(result.room);
    this.savedRoomCode = result.room.code;
    try {
      sessionStorage.setItem(ROOM_KEY, result.room.code);
    } catch {
      // Session recovery is optional.
    }
  }

  private clearSession(): void {
    this.savedRoomCode = null;
    try {
      sessionStorage.removeItem(ROOM_KEY);
    } catch {
      // Ignore storage restrictions.
    }
  }
}

export const net = new NetworkClient();
