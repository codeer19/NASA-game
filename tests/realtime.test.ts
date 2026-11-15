import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as createClient, type Socket } from "socket.io-client";
import { createRealtimeServer, type RealtimeServer } from "../server/src/realtime";
import type {
  Ack,
  ClientToServerEvents,
  RoomJoinResult,
  RoomPublic,
  ServerToClientEvents,
} from "../shared/types";

type FrontierSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface Client {
  socket: FrontierSocket;
  latest: () => RoomPublic | null;
  close: () => void;
}

interface Crew {
  host: Client;
  guest: Client;
  code: string;
  hostToken: string;
  guestToken: string;
  hostId: string;
  guestId: string;
}

let server: RealtimeServer;
let baseUrl: string;

beforeAll(async () => {
  server = createRealtimeServer({ serveClient: false });
  await new Promise<void>((resolve) => server.httpServer.listen(0, "127.0.0.1", resolve));
  const address = server.httpServer.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind a port.");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await server.close();
});

async function connect(): Promise<Client> {
  const socket: FrontierSocket = createClient(baseUrl, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  const states: RoomPublic[] = [];
  socket.on("room:state", (room) => states.push(room));
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Socket connection timed out.")), 4_000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  return {
    socket,
    latest: () => states.at(-1) ?? null,
    close: () => socket.disconnect(),
  };
}

function request<T>(
  client: Client,
  event: string,
  payload: unknown,
): Promise<Ack<T>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No response to ${event}.`)), 4_000);
    const raw = client.socket as unknown as {
      emit: (name: string, data: unknown, callback: (result: Ack<T>) => void) => void;
    };
    raw.emit(event, payload, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

function requestNoPayload<T>(client: Client, event: string): Promise<Ack<T>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No response to ${event}.`)), 4_000);
    const raw = client.socket as unknown as {
      emit: (name: string, callback: (result: Ack<T>) => void) => void;
    };
    raw.emit(event, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

async function waitForRoom(
  client: Client,
  predicate: (room: RoomPublic) => boolean,
  label: string,
): Promise<RoomPublic> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const room = client.latest();
    if (room && predicate(room)) return room;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function setupCrew(): Promise<Crew> {
  const hostToken = "test-token-host-0001";
  const guestToken = "test-token-guest-0001";
  const host = await connect();
  const guest = await connect();

  const created = await request<RoomJoinResult>(host, "room:create", {
    name: "CDP ONE",
    token: hostToken,
  });
  if (!created.ok) throw new Error(created.error);

  const joined = await request<RoomJoinResult>(guest, "room:join", {
    code: created.value.room.code,
    name: "VEGA-7",
    token: guestToken,
  });
  if (!joined.ok) throw new Error(joined.error);

  await waitForRoom(host, (room) => room.players.length === 2, "the second crew member");
  await waitForRoom(guest, (room) => room.players.length === 2, "the host crew state");

  return {
    host,
    guest,
    code: created.value.room.code,
    hostToken,
    guestToken,
    hostId: created.value.playerId,
    guestId: joined.value.playerId,
  };
}

async function closeCrew(crew: Crew): Promise<void> {
  crew.host.close();
  crew.guest.close();
  await new Promise((resolve) => setTimeout(resolve, 80));
}

describe("crew link over real Socket.IO", () => {
  it("creates a room, assigns distinct stations, and shares the payload design", async () => {
    const crew = await setupCrew();
    try {
      const lobby = crew.host.latest()!;
      expect(lobby.phase).toBe("lobby");
      expect(lobby.hostId).toBe(crew.hostId);
      const roles = lobby.players.map((player) => player.role);
      expect(new Set(roles).size).toBe(2);
      expect(roles).not.toContain(null);

      const takenRole = lobby.players.find((player) => player.id !== crew.hostId)!.role!;
      const conflict = await request(crew.host, "player:role", { role: takenRole });
      expect(conflict.ok).toBe(false);
      if (!conflict.ok) expect(conflict.error).toMatch(/already crewed/);

      expect((await request(crew.guest, "player:ready", { ready: true })).ok).toBe(true);
      expect((await request(crew.host, "player:ready", { ready: true })).ok).toBe(true);
      await waitForRoom(crew.host, (room) => room.players.every((player) => player.ready), "ready checks");

      const opened = await requestNoPayload(crew.host, "game:toDesign");
      expect(opened.ok).toBe(true);
      const designRoom = await waitForRoom(crew.guest, (room) => room.phase === "design", "the rover bay");
      expect(designRoom.design.modules).toEqual(["suspension", "arm", "weather"]);

      const removed = await request(crew.guest, "design:toggle", { moduleId: "weather" });
      expect(removed.ok).toBe(true);
      const afterRemoval = await waitForRoom(
        crew.host,
        (room) => !room.design.modules.includes("weather"),
        "the shared weather-mast removal",
      );
      expect(afterRemoval.players.every((player) => !player.ready)).toBe(true);

      const added = await request(crew.guest, "design:toggle", { moduleId: "spectrometer" });
      expect(added.ok).toBe(true);
      const afterAdd = await waitForRoom(
        crew.host,
        (room) => room.design.modules.includes("spectrometer"),
        "the shared spectrometer install",
      );
      expect(afterAdd.design.cost).toBeLessThanOrEqual(30);

      expect((await request(crew.host, "player:ready", { ready: true })).ok).toBe(true);
      expect((await request(crew.guest, "player:ready", { ready: true })).ok).toBe(true);
      await waitForRoom(crew.host, (room) => room.players.every((player) => player.ready), "design certification");

      const launched = await requestNoPayload(crew.host, "game:start");
      expect(launched.ok).toBe(true);
      const hostLaunch = await waitForRoom(crew.host, (room) => room.phase === "launch", "launch on the host");
      const guestLaunch = await waitForRoom(crew.guest, (room) => room.phase === "launch", "launch on the guest");
      expect(hostLaunch.mission).toBeNull();
      expect(hostLaunch.attempt).toBe(1);
      expect(hostLaunch.launchAt).not.toBeNull();
      expect(Math.abs((hostLaunch.launchAt ?? 0) - (guestLaunch.launchAt ?? 0))).toBeLessThanOrEqual(50);
    } finally {
      await closeCrew(crew);
    }
  });

  it("rejects a late join and restores a dropped station with its token", async () => {
    const crew = await setupCrew();
    const late = await connect();
    try {
      expect((await request(crew.host, "player:ready", { ready: true })).ok).toBe(true);
      expect((await request(crew.guest, "player:ready", { ready: true })).ok).toBe(true);
      await waitForRoom(crew.host, (room) => room.players.every((player) => player.ready), "ready checks");
      expect((await requestNoPayload(crew.host, "game:toDesign")).ok).toBe(true);
      await waitForRoom(crew.guest, (room) => room.phase === "design", "the rover bay");

      const rejected = await request<RoomJoinResult>(late, "room:join", {
        code: crew.code,
        name: "LATE-9",
        token: "test-token-late-0001",
      });
      expect(rejected.ok).toBe(false);
      if (!rejected.ok) expect(rejected.error).toMatch(/left the lobby/);

      crew.guest.close();
      await waitForRoom(
        crew.host,
        (room) => room.players.some((player) => player.id === crew.guestId && !player.connected),
        "the dropped guest",
      );

      const resumedClient = await connect();
      try {
        const resumed = await request<RoomJoinResult>(resumedClient, "room:resume", {
          code: crew.code,
          token: crew.guestToken,
        });
        expect(resumed.ok).toBe(true);
        if (resumed.ok) {
          expect(resumed.value.playerId).toBe(crew.guestId);
          expect(resumed.value.room.phase).toBe("design");
        }
        await waitForRoom(
          crew.host,
          (room) => room.players.some((player) => player.id === crew.guestId && player.connected),
          "the restored guest",
        );
      } finally {
        resumedClient.close();
      }
    } finally {
      late.close();
      crew.host.close();
      crew.guest.close();
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  });
});
