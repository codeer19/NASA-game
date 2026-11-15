import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as createClient, type Socket } from "socket.io-client";
import { createRealtimeServer, type RealtimeServer } from "../server/src/realtime";
import type {
  Ack,
  ClientToServerEvents,
  MissionState,
  PositionState,
  RoomJoinResult,
  RoomPublic,
  ServerToClientEvents,
} from "../shared/types";

type FrontierSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface MissionSnapshot {
  mission: MissionState;
  positions: Record<string, PositionState>;
  serverNow: number;
}

interface Client {
  socket: FrontierSocket;
  latest: () => RoomPublic | null;
  latestMission: () => MissionSnapshot | null;
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
  let mission: MissionSnapshot | null = null;
  socket.on("room:state", (room) => states.push(room));
  socket.on("mission:state", (payload) => {
    mission = payload;
  });
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
    latestMission: () => mission,
    close: () => socket.disconnect(),
  };
}

function request<T>(client: Client, event: string, payload: unknown): Promise<Ack<T>> {
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
  timeoutMs = 6_000,
): Promise<RoomPublic> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const room = client.latest();
    if (room && predicate(room)) return room;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function waitForMission(
  client: Client,
  predicate: (snapshot: MissionSnapshot) => boolean,
  label: string,
  timeoutMs = 6_000,
): Promise<MissionSnapshot> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snapshot = client.latestMission();
    if (snapshot && predicate(snapshot)) return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function setupCrew(tag: string): Promise<Crew> {
  const hostToken = `test-token-host-${tag}`.slice(0, 80);
  const guestToken = `test-token-guest-${tag}`.slice(0, 80);
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

async function readyUp(crew: Crew): Promise<void> {
  expect((await request(crew.host, "player:ready", { ready: true })).ok).toBe(true);
  expect((await request(crew.guest, "player:ready", { ready: true })).ok).toBe(true);
  await waitForRoom(crew.host, (room) => room.players.every((player) => player.ready), "ready checks");
}

describe("crew link over real Socket.IO", () => {
  it(
    "shares a rover design, validates launch, and runs live mission science",
    async () => {
      const crew = await setupCrew("alpha-0001");
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
        if (!conflict.ok) expect(conflict.error).toMatch(/already taken/);

        const guestOpen = await requestNoPayload(crew.guest, "game:toDesign");
        expect(guestOpen.ok).toBe(false);
        if (!guestOpen.ok) expect(guestOpen.error).toMatch(/Only the host/);

        await readyUp(crew);
        const opened = await requestNoPayload(crew.host, "game:toDesign");
        expect(opened.ok).toBe(true);
        const designRoom = await waitForRoom(
          crew.guest,
          (room) => room.phase === "design",
          "the rover workshop",
        );
        expect(designRoom.design).toMatchObject({
          cost: 28,
          weight: 43,
          upgrades: 0,
          landingSite: null,
          scienceFocus: null,
        });
        expect(Object.keys(designRoom.design.components)).toHaveLength(8);
        expect(designRoom.players.every((player) => !player.ready)).toBe(true);

        const wrongSlot = await request(crew.host, "design:component", {
          slot: "wheels",
          componentId: "arm_sample",
        });
        expect(wrongSlot.ok).toBe(false);
        if (!wrongSlot.ok) expect(wrongSlot.error).toMatch(/does not fit/);

        for (const change of [
          { slot: "body", componentId: "body_armored" },
          { slot: "wheels", componentId: "wheels_allterrain" },
          { slot: "suspension", componentId: "suspension_rocker" },
          { slot: "arm", componentId: "arm_sample" },
        ] as const) {
          const result = await request(crew.host, "design:component", change);
          expect(result.ok, change.componentId).toBe(true);
        }
        const built = await waitForRoom(
          crew.guest,
          (room) =>
            room.design.components.body === "body_armored" &&
            room.design.components.arm === "arm_sample",
          "the shared armored build",
        );
        expect(built.design).toMatchObject({ cost: 47, weight: 54, upgrades: 4 });
        expect(built.players.every((player) => !player.ready)).toBe(true);

        const overweight = await request(crew.guest, "design:component", {
          slot: "camera",
          componentId: "camera_research",
        });
        expect(overweight.ok).toBe(false);
        if (!overweight.ok) expect(overweight.error).toMatch(/launch limit/);
        expect(crew.guest.latest()!.design.components.camera).toBe("camera_basic");

        const site = await request(crew.guest, "design:site", { siteId: "dunes" });
        expect(site.ok).toBe(true);
        await waitForRoom(crew.host, (room) => room.design.landingSite === "dunes", "the landing place");

        await readyUp(crew);
        const noFocus = await requestNoPayload(crew.host, "game:start");
        expect(noFocus.ok).toBe(false);
        if (!noFocus.ok) expect(noFocus.error).toMatch(/science focus/);

        const focus = await request(crew.guest, "design:focus", { category: "weather" });
        expect(focus.ok).toBe(true);
        const focusRoom = await waitForRoom(
          crew.host,
          (room) => room.design.scienceFocus === "weather",
          "the science focus",
        );
        expect(focusRoom.players.every((player) => !player.ready)).toBe(true);

        await readyUp(crew);
        const guestStart = await requestNoPayload(crew.guest, "game:start");
        expect(guestStart.ok).toBe(false);
        if (!guestStart.ok) expect(guestStart.error).toMatch(/Only the host/);

        const launchStartedAt = Date.now();
        const launched = await requestNoPayload(crew.host, "game:start");
        expect(launched.ok).toBe(true);
        const hostLaunch = await waitForRoom(
          crew.host,
          (room) => room.phase === "launch",
          "launch on the host",
        );
        const guestLaunch = await waitForRoom(
          crew.guest,
          (room) => room.phase === "launch",
          "launch on the guest",
        );
        expect(hostLaunch.mission).toBeNull();
        expect(hostLaunch.attempt).toBe(1);
        expect(hostLaunch.launchAt).not.toBeNull();
        expect((hostLaunch.launchAt ?? 0) - launchStartedAt).toBeGreaterThan(8_500);
        expect((hostLaunch.launchAt ?? 0) - launchStartedAt).toBeLessThan(11_500);
        expect(Math.abs((hostLaunch.launchAt ?? 0) - (guestLaunch.launchAt ?? 0))).toBeLessThanOrEqual(50);

        const missionRoom = await waitForRoom(
          crew.host,
          (room) => room.phase === "mission" && room.mission !== null,
          "touchdown",
          15_000,
        );
        const mission = missionRoom.mission!;
        expect(mission.objectives).toHaveLength(9);
        expect(mission.objectives.filter((objective) => objective.unlocked)).toHaveLength(6);
        expect(mission.resources.budget).toBe(53);
        expect(mission.resources.mass).toBe(54);
        expect(mission.resources.power).toBeLessThanOrEqual(92);
        expect(mission.resources.power).toBeGreaterThan(85);
        expect(mission.resources.time).toBeGreaterThan(350);
        expect(mission.landingSite).toBe("dunes");
        expect(mission.scienceFocus).toBe("weather");
        expect(mission.eventsTotal).toBe(5);

        crew.host.socket.emit("mission:move", { x: 176, y: 158, dir: "up", moving: false });
        await waitForMission(
          crew.host,
          (snapshot) =>
            Math.abs((snapshot.positions[crew.hostId]?.x ?? 0) - 176) < 1 &&
            Math.abs((snapshot.positions[crew.hostId]?.y ?? 0) - 158) < 1,
          "the crew marker at the crater",
        );
        const interact = await request(crew.host, "mission:interact", { targetId: "rock_crater" });
        expect(interact.ok).toBe(true);
        const scanned = await waitForMission(
          crew.guest,
          (snapshot) =>
            snapshot.mission.objectives.find((objective) => objective.id === "rock_crater")?.completed === true,
          "the first rock scan",
          8_000,
        );
        expect(scanned.mission.resources.data).toBe(1);
        expect(scanned.mission.science.find((goal) => goal.id === "rocks")).toMatchObject({
          complete: 1,
          target: 2,
          done: false,
        });
        expect(scanned.mission.log.some((entry) => entry.text.includes("Crater Rim Rocks"))).toBe(true);

        const event = scanned.mission.activeEvent;
        expect(event?.id).toBe("dust_storm");
        expect(event?.votes).toEqual({});
        expect(event?.choices.map((choice) => choice.id)).toEqual(["shelter", "push", "scan_sky"]);

        const pausedAbility = await requestNoPayload(crew.host, "mission:ability");
        expect(pausedAbility.ok).toBe(false);
        if (!pausedAbility.ok) expect(pausedAbility.error).toMatch(/paused/);

        const guestFinalize = await requestNoPayload(crew.guest, "event:finalize");
        expect(guestFinalize.ok).toBe(false);
        if (!guestFinalize.ok) expect(guestFinalize.error).toMatch(/Only the host/);

        const vote = await request(crew.host, "event:vote", { choiceId: "shelter" });
        expect(vote.ok).toBe(true);
        await waitForMission(
          crew.guest,
          (snapshot) => snapshot.mission.activeEvent?.votes[crew.hostId] === "shelter",
          "the host vote",
        );

        const finalize = await requestNoPayload(crew.host, "event:finalize");
        expect(finalize.ok).toBe(true);
        const locking = await waitForMission(
          crew.guest,
          (snapshot) =>
            snapshot.mission.activeEvent?.resolution === "resolving" &&
            snapshot.mission.activeEvent.finalizedBy === crew.hostId,
          "the locked crew decision",
        );
        expect(locking.mission.activeEvent?.resolveAt).not.toBeNull();

        const lateVote = await request(crew.guest, "event:vote", { choiceId: "push" });
        expect(lateVote.ok).toBe(false);
        if (!lateVote.ok) expect(lateVote.error).toMatch(/already locked/);

        const decided = await waitForMission(
          crew.guest,
          (snapshot) => snapshot.mission.activeEvent === null && snapshot.mission.eventsResolved === 1,
          "the dust storm outcome",
          4_000,
        );
        expect(decided.mission.decisions).toHaveLength(1);
        expect(decided.mission.decisions[0]).toMatchObject({
          eventId: "dust_storm",
          choiceId: "shelter",
          choiceLabel: "Wait it out",
        });
        expect(decided.mission.decisions[0]!.modifiers).toContain(
          "The Rover Builder found a cheaper fix.",
        );
        expect(decided.mission.decisions[0]!.modifiers).toContain(
          "The Mars Explorer read the weather and signal.",
        );

        const beforeBoost = decided.mission.resources.power;
        const ability = await requestNoPayload(crew.host, "mission:ability");
        expect(ability.ok).toBe(true);
        const boosted = await waitForMission(
          crew.host,
          (snapshot) => (snapshot.mission.abilityReadyAt[crew.hostId] ?? 0) > 0,
          "the Rover Builder repair",
        );
        expect(boosted.mission.resources.power).toBeGreaterThan(beforeBoost);

        const strayVote = await request(crew.host, "event:vote", { choiceId: "shelter" });
        expect(strayVote.ok).toBe(false);
        if (!strayVote.ok) expect(strayVote.error).toMatch(/No crew decision/);

        const earlyRetry = await requestNoPayload(crew.host, "mission:retry");
        expect(earlyRetry.ok).toBe(false);
        if (!earlyRetry.ok) expect(earlyRetry.error).toMatch(/still running/);

        const earlyLobby = await requestNoPayload(crew.host, "room:lobby");
        expect(earlyLobby.ok).toBe(false);
        if (!earlyLobby.ok) expect(earlyLobby.error).toMatch(/still running/);
      } finally {
        await closeCrew(crew);
      }
    },
    30_000,
  );

  it("rejects a late join and restores a dropped station with its token", async () => {
    const crew = await setupCrew("bravo-0001");
    const late = await connect();
    try {
      await readyUp(crew);
      expect((await requestNoPayload(crew.host, "game:toDesign")).ok).toBe(true);
      await waitForRoom(crew.guest, (room) => room.phase === "design", "the rover workshop");

      const rejected = await request<RoomJoinResult>(late, "room:join", {
        code: crew.code,
        name: "LATE-9",
        token: "test-token-late-0001",
      });
      expect(rejected.ok).toBe(false);
      if (!rejected.ok) expect(rejected.error).toMatch(/already started/);

      const guestRole = crew.guest.latest()!.players.find((player) => player.id === crew.guestId)!.role;
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
          expect(resumed.value.room.players).toHaveLength(2);
          expect(resumed.value.room.players.filter((player) => player.id === crew.guestId)).toHaveLength(1);
        }
        const restored = await waitForRoom(
          crew.host,
          (room) => room.players.some((player) => player.id === crew.guestId && player.connected),
          "the restored guest",
        );
        expect(restored.players).toHaveLength(2);
        expect(restored.players.find((player) => player.id === crew.guestId)?.role).toBe(guestRole);
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
