import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import express from "express";
import { Server } from "socket.io";
import {
  DATA_TARGET,
  EVENTS,
  FIELD_OBJECTIVES,
  LANDER_POSITION,
  MAX_MODULES,
  QUICK_COMMS,
  ROLES,
  SPAWN_POINTS,
  STARTING_COMMS,
  STARTING_POWER,
  WORLD,
} from "../../shared/content";
import {
  applyEffects,
  canLaunch,
  computeScore,
  createActiveEvent,
  createMission,
  designStats,
  eventDefinitionById,
  initialResources,
  nextEventDefinition,
  resolveEventEffects,
  validateModuleSelection,
} from "../../shared/rules";
import type {
  Ack,
  ActiveEventPublic,
  ClientToServerEvents,
  DesignPublic,
  MissionEventDefinition,
  MissionLogEntry,
  MissionState,
  ModuleId,
  MovePayload,
  Phase,
  PlayerPublic,
  PositionState,
  ResourceId,
  Resources,
  RoleId,
  RoomJoinResult,
  RoomPublic,
  ServerToClientEvents,
} from "../../shared/types";
import { MAX_PLAYERS } from "../../shared/types";

const LAUNCH_DURATION_MS = 14_000;
const TICK_MS = 100;
const MISSION_BROADCAST_MS = 250;
const EMPTY_POSITION = (index: number): PositionState => {
  const spawn = SPAWN_POINTS[index % SPAWN_POINTS.length] ?? SPAWN_POINTS[0]!;
  return {
    x: spawn.x + (index % 2) * 14,
    y: spawn.y + Math.floor(index / 2) * 10,
    dir: "down",
    moving: false,
    interacting: null,
  };
};

interface ServerPlayer {
  id: string;
  token: string;
  socketId: string | null;
  name: string;
  role: RoleId | null;
  ready: boolean;
  connected: boolean;
  joinedAt: number;
  disconnectedAt: number | null;
}

interface MissionRuntime {
  state: MissionState;
  positions: Record<string, PositionState>;
  interactions: Map<string, string>;
  openedEvents: number;
  lastTickAt: number;
  lastBroadcastAt: number;
}

interface Room {
  code: string;
  hostId: string;
  phase: Phase;
  players: Map<string, ServerPlayer>;
  design: ModuleId[];
  launchAt: number | null;
  attempt: number;
  mission: MissionRuntime | null;
  createdAt: number;
  updatedAt: number;
  lastRoomEmitAt: number;
  lastNameEmitAt: number;
}

interface SocketData {
  roomCode?: string;
  playerId?: string;
  moveWindowStart?: number;
  moveCount?: number;
}

interface RealtimeOptions {
  clientDir?: string;
  serveClient?: boolean;
}

export interface RealtimeServer {
  app: express.Express;
  httpServer: http.Server;
  io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
  close: () => Promise<void>;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const NAME_MAX = 18;

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  if (cleaned.length < 2 || cleaned.length > NAME_MAX) return null;
  return cleaned;
}

function roomCode(): string {
  let result = "";
  for (let index = 0; index < 4; index += 1) {
    result += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return result;
}

function isRoleId(value: unknown): value is RoleId {
  return typeof value === "string" && ROLES.some((role) => role.id === value);
}

function isModuleId(value: unknown): value is ModuleId {
  return (
    typeof value === "string" &&
    (["suspension", "arm", "spectrometer", "weather"] as const).includes(value as ModuleId)
  );
}

function roleFree(room: Room, role: RoleId, playerId: string): boolean {
  return ![...room.players.values()].some(
    (player) => player.id !== playerId && player.role === role,
  );
}

function firstFreeRole(room: Room): RoleId | null {
  for (const role of ROLES) {
    if (roleFree(room, role.id, "")) return role.id;
  }
  return null;
}

function connectedPlayers(room: Room): ServerPlayer[] {
  return [...room.players.values()].filter((player) => player.connected);
}

function chooseHost(room: Room): void {
  if (room.players.has(room.hostId) && room.players.get(room.hostId)?.connected) return;
  const next = connectedPlayers(room)[0] ?? [...room.players.values()][0];
  if (next) room.hostId = next.id;
}

function playerPublic(room: Room, player: ServerPlayer): PlayerPublic {
  return {
    id: player.id,
    name: player.name,
    role: player.role,
    ready: player.ready,
    connected: player.connected,
    host: room.hostId === player.id,
    character: ROLES.find((role) => role.id === player.role)?.characterId ?? null,
  };
}

function designPublic(modules: readonly ModuleId[]): DesignPublic {
  return designStats(modules);
}

function publicRoom(room: Room, now: number): RoomPublic {
  if (room.mission) room.mission.state.serverNow = now;
  return {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    players: [...room.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((player) => playerPublic(room, player)),
    design: designPublic(room.design),
    launchAt: room.launchAt,
    attempt: room.attempt,
    mission: room.mission ? room.mission.state : null,
    positions: room.mission ? { ...room.mission.positions } : {},
    serverNow: now,
  };
}

function makeLog(tone: MissionLogEntry["tone"], text: string): MissionLogEntry {
  return {
    id: crypto.randomUUID(),
    at: Date.now(),
    tone,
    text,
  };
}

function addLog(runtime: MissionRuntime, tone: MissionLogEntry["tone"], text: string): void {
  runtime.state.log.push(makeLog(tone, text));
  if (runtime.state.log.length > 40) runtime.state.log.splice(0, runtime.state.log.length - 40);
}

function activeRoles(room: Room): Set<RoleId> {
  return new Set(
    connectedPlayers(room)
      .map((player) => player.role)
      .filter((role): role is RoleId => role !== null),
  );
}

function allConnectedReady(room: Room): boolean {
  const players = connectedPlayers(room);
  return players.length > 0 && players.every((player) => player.ready);
}

function respawnPositions(room: Room): Record<string, PositionState> {
  const result: Record<string, PositionState> = {};
  [...room.players.values()].forEach((player, index) => {
    result[player.id] = EMPTY_POSITION(index);
  });
  return result;
}

function startLaunch(room: Room, now: number): void {
  room.phase = "launch";
  room.launchAt = now + LAUNCH_DURATION_MS;
  room.attempt += 1;
  room.mission = null;
  for (const player of room.players.values()) {
    player.ready = false;
  }
  room.updatedAt = now;
}

function beginMission(room: Room, now: number): void {
  const design = designPublic(room.design);
  const runtime: MissionRuntime = {
    state: createMission(crypto.randomUUID(), design, now),
    positions: respawnPositions(room),
    interactions: new Map(),
    openedEvents: 0,
    lastTickAt: now,
    lastBroadcastAt: 0,
  };
  runtime.state.abilityReadyAt = Object.fromEntries(
    [...room.players.keys()].map((id) => [id, 0]),
  );
  addLog(
    runtime,
    "info",
    "MERIDIAN is on the surface. Complete five field objectives, then transmit from the lander.",
  );
  addLog(
    runtime,
    "crew",
    "DR. VOSS: Surface link is yours, MERIDIAN. Keep the clock and the bus in mind.",
  );
  room.phase = "mission";
  room.launchAt = null;
  room.mission = runtime;
  room.updatedAt = now;
}

function finishMission(
  room: Room,
  runtime: MissionRuntime,
  success: boolean,
  reason: string,
  now: number,
): void {
  const result = computeScore(runtime.state, success, reason, now);
  runtime.state.result = result;
  runtime.state.activeEvent = null;
  runtime.interactions.clear();
  addLog(
    runtime,
    success ? "success" : "danger",
    success ? "Science package received in orbit." : reason,
  );
  room.phase = "debrief";
  room.updatedAt = now;
}

function checkFailure(room: Room, runtime: MissionRuntime, now: number): boolean {
  if (runtime.state.result) return true;
  if (runtime.state.resources.power <= 0) {
    runtime.state.resources.power = 0;
    finishMission(room, runtime, false, "Rover bus power depleted.", now);
    return true;
  }
  if (runtime.state.resources.time <= 0) {
    runtime.state.resources.time = 0;
    finishMission(room, runtime, false, "Surface mission window closed.", now);
    return true;
  }
  return false;
}

function maybeOpenEvent(room: Room, runtime: MissionRuntime, now: number): void {
  if (runtime.state.activeEvent || runtime.state.result) return;
  const completedField = runtime.state.objectives.filter(
    (objective) => objective.completed && objective.kind !== "transmit",
  ).length;
  const threshold = Math.min(EVENTS.length, 1 + completedField);
  if (runtime.state.elapsed < 12 && completedField === 0) return;
  if (runtime.openedEvents >= threshold) return;
  const definition = nextEventDefinition(runtime.openedEvents);
  if (!definition) return;
  runtime.state.activeEvent = createActiveEvent(definition, now);
  runtime.openedEvents += 1;
  runtime.interactions.clear();
  for (const position of Object.values(runtime.positions)) position.interacting = null;
  addLog(runtime, "warning", `EVENT ${definition.order}/5 — ${definition.title}.`);
}

function voteCounts(event: ActiveEventPublic): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const choice of event.choices) counts[choice.id] = 0;
  for (const choiceId of Object.values(event.votes)) {
    if (counts[choiceId] !== undefined) counts[choiceId] += 1;
  }
  return counts;
}

function pickWinningChoice(event: ActiveEventPublic, room: Room): string {
  const counts = voteCounts(event);
  const entries = Object.entries(counts);
  const best = Math.max(...entries.map(([, count]) => count));
  const tied = entries.filter(([, count]) => count === best).map(([id]) => id);
  if (tied.length === 1) return tied[0]!;
  const advisory = event.roleAdvisory.role;
  const adviser = [...room.players.values()].find(
    (player) => player.role === advisory && player.connected,
  );
  const adviserVote = adviser ? event.votes[adviser.id] : undefined;
  if (adviserVote && tied.includes(adviserVote)) return adviserVote;
  return tied[0] ?? event.choices[0]?.id ?? "";
}

function resolveEvent(room: Room, runtime: MissionRuntime, now: number): void {
  const active = runtime.state.activeEvent;
  if (!active) return;
  const definition = eventDefinitionById(active.id);
  if (!definition) {
    runtime.state.activeEvent = null;
    return;
  }
  const choiceId = pickWinningChoice(active, room);
  const result = resolveEventEffects(definition, choiceId, {
    roles: activeRoles(room),
    modules: room.design,
    eventId: definition.id,
  });
  if (result) {
    runtime.state.resources = applyEffects(runtime.state.resources, result.effects);
    result.outcome.at = now;
    runtime.state.eventOutcome = result.outcome;
    runtime.state.eventsResolved += 1;
    addLog(
      runtime,
      "info",
      `${definition.title}: ${result.outcome.choiceLabel}. ${formatEffects(result.effects)}`,
    );
    if (result.modifiers[0] !== "No crew bonus applied.") {
      addLog(runtime, "crew", result.modifiers.join(" "));
    }
  }
  runtime.state.activeEvent = null;
  runtime.state.serverNow = now;
  checkFailure(room, runtime, now);
}

function formatEffects(effects: Partial<Resources>): string {
  const labels: Record<ResourceId, string> = {
    budget: "budget",
    mass: "mass",
    power: "power",
    data: "data",
    comms: "comms",
    time: "time",
  };
  return (Object.entries(effects) as [ResourceId, number][])
    .filter(([, value]) => value !== 0)
    .map(([key, value]) => {
      const shown = key === "time" ? `${Math.abs(value)}s` : `${Math.abs(value)}`;
      return `${value > 0 ? "+" : "-"}${shown} ${labels[key]}`;
    })
    .join(" · ");
}

function completeObjective(
  room: Room,
  runtime: MissionRuntime,
  objectiveId: string,
  now: number,
): void {
  const objective = runtime.state.objectives.find((entry) => entry.id === objectiveId);
  if (!objective || objective.completed) return;
  if (objective.kind === "transmit") {
    if (runtime.state.resources.data < runtime.state.dataTarget) {
      addLog(
        runtime,
        "warning",
        `Downlink threshold not met. ${runtime.state.dataTarget} data required before transmission.`,
      );
      return;
    }
    objective.completed = true;
    objective.progress = 1;
    finishMission(room, runtime, true, "Science package downlinked before the window closed.", now);
    return;
  }

  objective.completed = true;
  objective.progress = 1;
  objective.interactingCount = 0;
  const field = FIELD_OBJECTIVES.find((entry) => entry.id === objective.id);
  if (!field) return;
  const hasArm = room.design.includes("arm");
  const hasSpectrometer = room.design.includes("spectrometer");
  const sampleBonus =
    objective.kind === "sample" ? (hasArm ? 2 : 0) + (hasSpectrometer ? 4 : 0) : 0;
  runtime.state.resources.data += field.dataReward + sampleBonus;
  runtime.state.resources.power = Math.max(
    0,
    runtime.state.resources.power - field.powerCost,
  );
  if (field.commsGain) {
    runtime.state.resources.comms = Math.min(
      100,
      runtime.state.resources.comms + field.commsGain,
    );
  }
  if (field.budgetGain) runtime.state.resources.budget += field.budgetGain;
  if (field.timeGain) {
    runtime.state.resources.time = Math.min(420, runtime.state.resources.time + field.timeGain);
  }
  if (objective.kind === "sample") {
    runtime.state.resources.mass = Math.max(0, runtime.state.resources.mass - 2);
  }
  addLog(
    runtime,
    "success",
    `${objective.name} complete · +${field.dataReward + sampleBonus} data${
      field.commsGain ? ` · +${field.commsGain} comms` : ""
    }`,
  );

  const fieldComplete = runtime.state.objectives.filter(
    (entry) => entry.completed && entry.kind !== "transmit",
  ).length;
  if (fieldComplete === FIELD_OBJECTIVES.length) {
    const transmit = runtime.state.objectives.find((entry) => entry.kind === "transmit");
    if (transmit) transmit.unlocked = true;
    addLog(runtime, "success", "All field objectives complete. Return to the lander to transmit.");
  }

  if (checkFailure(room, runtime, now)) return;
  maybeOpenEvent(room, runtime, now);
}

function updateMission(room: Room, runtime: MissionRuntime, now: number): void {
  if (runtime.state.result) return;
  const dt = Math.min(0.35, (now - runtime.lastTickAt) / 1000);
  runtime.lastTickAt = now;
  if (dt <= 0) return;

  const active = runtime.state.activeEvent;
  if (active) {
    if (active.resolution === "resolving" && active.resolveAt && now >= active.resolveAt) {
      resolveEvent(room, runtime, now);
      return;
    }
    if (now >= active.deadline) {
      resolveEvent(room, runtime, now);
    }
    runtime.state.serverNow = now;
    return;
  }

  runtime.state.elapsed += dt;
  runtime.state.serverNow = now;
  const roles = activeRoles(room);
  const players = connectedPlayers(room);
  const positions = runtime.positions;

  const movingCount = players.filter((player) => positions[player.id]?.moving).length;
  let powerDrain = 0.055 * (roles.has("engineer") ? 0.85 : 1) + movingCount * 0.018;
  let commsDrain = 0;
  for (const player of players) {
    const position = positions[player.id];
    if (!position) continue;
    const distance = Math.hypot(position.x - LANDER_POSITION.x, position.y - LANDER_POSITION.y);
    if (distance > 520) commsDrain = Math.max(commsDrain, 0.2);
    else if (distance > 260) commsDrain = Math.max(commsDrain, 0.1);
  }
  if (roles.has("satellite")) commsDrain *= 0.75;
  if (room.design.includes("weather")) commsDrain *= 0.75;

  runtime.state.resources.power = Math.max(
    0,
    runtime.state.resources.power - powerDrain * dt,
  );
  runtime.state.resources.comms = Math.max(0, runtime.state.resources.comms - commsDrain * dt);
  runtime.state.resources.time = Math.max(0, runtime.state.resources.time - dt);

  if (runtime.state.resources.power <= 0 || runtime.state.resources.time <= 0) {
    checkFailure(room, runtime, now);
    return;
  }

  for (const objective of runtime.state.objectives) {
    if (!objective.unlocked || objective.completed) {
      objective.interactingCount = 0;
      continue;
    }
    const contributors: ServerPlayer[] = [];
    for (const player of players) {
      const requested = runtime.interactions.get(player.id);
      if (requested !== objective.id) continue;
      const position = positions[player.id];
      if (!position) continue;
      const distance = Math.hypot(position.x - objective.x, position.y - objective.y);
      if (distance > 68) {
        runtime.interactions.delete(player.id);
        position.interacting = null;
        continue;
      }
      contributors.push(player);
    }
    objective.interactingCount = contributors.length;
    if (contributors.length === 0) continue;
    const crewBoost = Math.min(1.9, 1 + (contributors.length - 1) * 0.35);
    const commsFactor = runtime.state.resources.comms < 20 ? 0.72 : 1;
    objective.progress = Math.min(
      1,
      objective.progress +
        (dt / objective.duration) * crewBoost * commsFactor,
    );
    if (objective.progress >= 1) {
      completeObjective(room, runtime, objective.id, now);
      if (room.phase !== "mission") return;
    }
  }

  maybeOpenEvent(room, runtime, now);
  if (room.phase === "mission") checkFailure(room, runtime, now);
}

function removePlayer(room: Room, playerId: string): void {
  room.players.delete(playerId);
  if (room.mission) {
    delete room.mission.positions[playerId];
    room.mission.interactions.delete(playerId);
    delete room.mission.state.abilityReadyAt[playerId];
  }
  if (room.hostId === playerId) chooseHost(room);
}

function safeHandler<T>(
  ack: ((value: Ack<T>) => void) | undefined,
  fn: () => Ack<T>,
): void {
  try {
    if (typeof ack === "function") ack(fn());
  } catch (error) {
    console.error("[red-frontier] room handler failed", error);
    if (typeof ack === "function") ack({ ok: false, error: "Server could not process that action." });
  }
}

export function createRealtimeServer(options: RealtimeOptions = {}): RealtimeServer {
  const app = express();
  const httpServer = http.createServer(app);
  const io: RealtimeServer["io"] = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: false,
    },
    maxHttpBufferSize: 64 * 1024,
  });

  const rooms = new Map<string, Room>();
  const playerRooms = new Map<string, string>();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.get("/healthz", (_request, response) => {
    response.json({
      ok: true,
      service: "red-frontier-mission-mars",
      rooms: rooms.size,
      players: playerRooms.size,
      now: new Date().toISOString(),
    });
  });

  if (options.serveClient !== false && options.clientDir) {
    app.use(express.static(options.clientDir, { extensions: ["html"] }));
    app.use((request, response, next) => {
      if (request.method !== "GET" || request.path.startsWith("/socket.io")) {
        next();
        return;
      }
      response.sendFile(path.join(options.clientDir!, "index.html"), (error) => {
        if (error) next();
      });
    });
  }

  function broadcastRoom(room: Room, now = Date.now()): void {
    room.lastRoomEmitAt = now;
    io.to(room.code).emit("room:state", publicRoom(room, now));
  }

  function broadcastMission(room: Room, now = Date.now()): void {
    if (!room.mission) return;
    room.mission.lastBroadcastAt = now;
    room.mission.state.serverNow = now;
    io.to(room.code).emit("mission:state", {
      mission: room.mission.state,
      positions: room.mission.positions,
      serverNow: now,
    });
  }

  function currentContext(socket: import("socket.io").Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>): {
    room: Room;
    player: ServerPlayer;
  } | null {
    const code = socket.data.roomCode;
    const playerId = socket.data.playerId;
    if (!code || !playerId) return null;
    const room = rooms.get(code);
    const player = room?.players.get(playerId);
    if (!room || !player || player.socketId !== socket.id) return null;
    return { room, player };
  }

  function attach(
    socket: import("socket.io").Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
    room: Room,
    player: ServerPlayer,
  ): void {
    socket.data.roomCode = room.code;
    socket.data.playerId = player.id;
    player.socketId = socket.id;
    player.connected = true;
    player.disconnectedAt = null;
    playerRooms.set(player.id, room.code);
    void socket.join(room.code);
    room.updatedAt = Date.now();
  }

  io.on("connection", (socket) => {
    socket.on("room:create", (payload, ack) => {
      safeHandler(ack, () => {
        const name = normalizeName(payload?.name);
        const token = typeof payload?.token === "string" ? payload.token.slice(0, 80) : "";
        if (!name) return { ok: false, error: "Use a crew name between 2 and 18 characters." };
        if (token.length < 12) return { ok: false, error: "Invalid client token." };
        if (socket.data.roomCode) return { ok: false, error: "Leave your current room first." };
        if (rooms.size >= 250) return { ok: false, error: "Mission control is at capacity." };

        let code = roomCode();
        while (rooms.has(code)) code = roomCode();
        const now = Date.now();
        const playerId = crypto.randomUUID();
        const player: ServerPlayer = {
          id: playerId,
          token,
          socketId: socket.id,
          name,
          role: null,
          ready: false,
          connected: true,
          joinedAt: now,
          disconnectedAt: null,
        };
        player.role = firstFreeRole({ players: new Map([[playerId, player]]) } as Room);
        const room: Room = {
          code,
          hostId: playerId,
          phase: "lobby",
          players: new Map([[playerId, player]]),
          design: [],
          launchAt: null,
          attempt: 0,
          mission: null,
          createdAt: now,
          updatedAt: now,
          lastRoomEmitAt: 0,
          lastNameEmitAt: 0,
        };
        rooms.set(code, room);
        attach(socket, room, player);
        const result: RoomJoinResult = { playerId, room: publicRoom(room, now) };
        broadcastRoom(room, now);
        return { ok: true, value: result };
      });
    });

    socket.on("room:join", (payload, ack) => {
      safeHandler(ack, () => {
        const code = String(payload?.code ?? "").toUpperCase().trim();
        const name = normalizeName(payload?.name);
        const token = typeof payload?.token === "string" ? payload.token.slice(0, 80) : "";
        if (!name) return { ok: false, error: "Use a crew name between 2 and 18 characters." };
        if (token.length < 12) return { ok: false, error: "Invalid client token." };
        const room = rooms.get(code);
        if (!room) return { ok: false, error: "No mission found for that crew code." };

        const existing = [...room.players.values()].find((player) => player.token === token);
        if (existing) {
          attach(socket, room, existing);
          const result: RoomJoinResult = {
            playerId: existing.id,
            room: publicRoom(room, Date.now()),
          };
          broadcastRoom(room);
          return { ok: true, value: result };
        }

        if (room.phase !== "lobby") return { ok: false, error: "That crew has already left the lobby." };
        if (room.players.size >= MAX_PLAYERS) return { ok: false, error: "That crew is full." };
        if (socket.data.roomCode) return { ok: false, error: "Leave your current room first." };

        const now = Date.now();
        const playerId = crypto.randomUUID();
        const player: ServerPlayer = {
          id: playerId,
          token,
          socketId: socket.id,
          name,
          role: firstFreeRole(room),
          ready: false,
          connected: true,
          joinedAt: now,
          disconnectedAt: null,
        };
        room.players.set(playerId, player);
        attach(socket, room, player);
        room.updatedAt = now;
        const result: RoomJoinResult = { playerId, room: publicRoom(room, now) };
        broadcastRoom(room, now);
        return { ok: true, value: result };
      });
    });

    socket.on("room:resume", (payload, ack) => {
      safeHandler(ack, () => {
        const code = String(payload?.code ?? "").toUpperCase().trim();
        const token = typeof payload?.token === "string" ? payload.token.slice(0, 80) : "";
        const room = rooms.get(code);
        if (!room) return { ok: false, error: "That mission is no longer available." };
        const player = [...room.players.values()].find((entry) => entry.token === token);
        if (!player) return { ok: false, error: "Crew token did not match." };
        if (socket.data.roomCode && socket.data.roomCode !== room.code) {
          return { ok: false, error: "Leave your current room first." };
        }
        const previousSocketId = player.socketId;
        attach(socket, room, player);
        if (previousSocketId && previousSocketId !== socket.id) {
          const previous = io.sockets.sockets.get(previousSocketId);
          if (previous) {
            previous.data.roomCode = undefined;
            previous.data.playerId = undefined;
            previous.disconnect(true);
          }
        }
        room.updatedAt = Date.now();
        const result: RoomJoinResult = { playerId: player.id, room: publicRoom(room, Date.now()) };
        broadcastRoom(room);
        if (room.mission) broadcastMission(room);
        return { ok: true, value: result };
      });
    });

    socket.on("room:leave", (ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "No active room." };
        const { room, player } = context;
        removePlayer(room, player.id);
        playerRooms.delete(player.id);
        void socket.leave(room.code);
        socket.data.roomCode = undefined;
        socket.data.playerId = undefined;
        if (room.players.size === 0) rooms.delete(room.code);
        else {
          broadcastRoom(room);
          if (room.mission) broadcastMission(room);
        }
        return { ok: true, value: undefined };
      });
    });

    socket.on("player:role", (payload, ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to mission control." };
        const { room, player } = context;
        if (room.phase !== "lobby") return { ok: false, error: "Roles are locked after the crew link opens." };
        if (!isRoleId(payload?.role)) return { ok: false, error: "Unknown mission role." };
        const role = payload.role;
        if (!roleFree(room, role, player.id)) return { ok: false, error: "That station is already crewed." };
        player.role = role;
        player.ready = false;
        room.updatedAt = Date.now();
        broadcastRoom(room);
        return { ok: true, value: undefined };
      });
    });

    socket.on("player:ready", (payload, ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to mission control." };
        const { room, player } = context;
        if (room.phase !== "lobby" && room.phase !== "design") {
          return { ok: false, error: "The crew is no longer assembling." };
        }
        player.ready = Boolean(payload?.ready);
        room.updatedAt = Date.now();
        broadcastRoom(room);
        return { ok: true, value: undefined };
      });
    });

    socket.on("design:toggle", (payload, ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to mission control." };
        const { room } = context;
        if (room.phase !== "design") return { ok: false, error: "The rover bay is not open." };
        if (!isModuleId(payload?.moduleId)) return { ok: false, error: "Unknown payload module." };
        const moduleId = payload.moduleId;
        const present = room.design.includes(moduleId);
        const next = present
          ? room.design.filter((id) => id !== moduleId)
          : [...room.design, moduleId];
        if (next.length > MAX_MODULES) {
          return { ok: false, error: "Payload bay is full. Remove a module first." };
        }
        const invalid = next.length > 0 ? validateModuleSelection(next) : null;
        if (invalid) return { ok: false, error: invalid };
        room.design = next;
        for (const entry of room.players.values()) entry.ready = false;
        room.updatedAt = Date.now();
        broadcastRoom(room);
        return { ok: true, value: undefined };
      });
    });

    socket.on("game:toDesign", (ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to mission control." };
        const { room, player } = context;
        if (room.hostId !== player.id) return { ok: false, error: "Only the flight director can open the rover bay." };
        if (room.phase !== "lobby") return { ok: false, error: "The rover bay is already open." };
        if (!allConnectedReady(room)) return { ok: false, error: "Every connected crew member must be ready." };
        if ([...room.players.values()].some((entry) => entry.role === null)) {
          return { ok: false, error: "Every crew member needs a station." };
        }
        room.phase = "design";
        room.design = ["suspension", "arm", "weather"];
        for (const entry of room.players.values()) entry.ready = false;
        room.updatedAt = Date.now();
        broadcastRoom(room);
        return { ok: true, value: undefined };
      });
    });

    socket.on("game:start", (ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to mission control." };
        const { room, player } = context;
        if (room.hostId !== player.id) return { ok: false, error: "Only the flight director can begin the launch." };
        if (room.phase !== "design") return { ok: false, error: "Open the rover bay before launch." };
        if (!allConnectedReady(room)) return { ok: false, error: "Every connected crew member must certify the design." };
        const invalid = canLaunch(room.design);
        if (invalid) return { ok: false, error: invalid };
        startLaunch(room, Date.now());
        broadcastRoom(room);
        return { ok: true, value: undefined };
      });
    });

    socket.on("mission:move", (payload) => {
      const context = currentContext(socket);
      if (!context || context.room.phase !== "mission") return;
      const { room, player } = context;
      const now = Date.now();
      if (room.mission?.state.activeEvent) return;
      if (
        !payload ||
        !Number.isFinite(payload.x) ||
        !Number.isFinite(payload.y) ||
        !["down", "left", "right", "up"].includes(payload.dir)
      ) {
        return;
      }
      const position = room.mission?.positions[player.id];
      if (!position) return;
      const x = Math.max(10, Math.min(WORLD.width - 10, payload.x));
      const y = Math.max(12, Math.min(WORLD.height - 4, payload.y));
      position.x = x;
      position.y = y;
      position.dir = payload.dir;
      position.moving = Boolean(payload.moving);
      room.mission!.lastTickAt = room.mission!.lastTickAt || now;
      io.to(room.code).except(socket.id).emit("crew:positions", {
        positions: { [player.id]: position },
        serverNow: now,
      });
    });

    socket.on("mission:interact", (payload, ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to mission control." };
        const { room, player } = context;
        if (room.phase !== "mission" || !room.mission) return { ok: false, error: "Surface link is not active." };
        if (room.mission.state.activeEvent || room.mission.state.result) {
          return { ok: false, error: "Mission is holding." };
        }
        const targetId = payload?.targetId ?? null;
        if (targetId === null) {
          room.mission.interactions.delete(player.id);
          const pos = room.mission.positions[player.id];
          if (pos) pos.interacting = null;
          return { ok: true, value: undefined };
        }
        const objective = room.mission.state.objectives.find((entry) => entry.id === targetId);
        if (!objective || !objective.unlocked || objective.completed) {
          return { ok: false, error: "That field objective is not available." };
        }
        const pos = room.mission.positions[player.id];
        if (!pos) return { ok: false, error: "Crew position is not synchronised." };
        if (Math.hypot(pos.x - objective.x, pos.y - objective.y) > 60) {
          return { ok: false, error: "Move closer to the objective." };
        }
        room.mission.interactions.set(player.id, targetId);
        pos.interacting = targetId;
        room.mission.lastTickAt = Date.now();
        return { ok: true, value: undefined };
      });
    });

    socket.on("mission:ability", (ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to mission control." };
        const { room, player } = context;
        if (room.phase !== "mission" || !room.mission) return { ok: false, error: "Surface link is not active." };
        if (!player.role) return { ok: false, error: "No station assigned." };
        if (room.mission.state.activeEvent || room.mission.state.result) {
          return { ok: false, error: "Mission is holding." };
        }
        const now = Date.now();
        const readyAt = room.mission.state.abilityReadyAt[player.id] ?? 0;
        if (readyAt > now) {
          return { ok: false, error: `Station tool recharges in ${Math.ceil((readyAt - now) / 1000)}s.` };
        }
        const role = ROLES.find((entry) => entry.id === player.role);
        if (!role) return { ok: false, error: "Unknown station role." };
        const runtime = room.mission;
        let message = "";
        if (player.role === "engineer") {
          runtime.state.resources.power = Math.min(100, runtime.state.resources.power + 20);
          message = `${player.name} completed a field repair. +20 power.`;
        } else if (player.role === "satellite") {
          runtime.state.resources.comms = Math.min(100, runtime.state.resources.comms + 28);
          message = `${player.name} reacquired the orbital relay. +28 comms.`;
        } else if (player.role === "finance") {
          runtime.state.resources.budget += 15;
          message = `${player.name} released an emergency reserve. +15 budget.`;
        } else if (player.role === "designer") {
          runtime.state.speedUntil = now + 15_000;
          message = `${player.name} shared a route pulse. Crew speed +25% for 15 seconds.`;
        }
        runtime.state.abilityReadyAt[player.id] = now + role.ability.cooldownSeconds * 1000;
        addLog(runtime, "crew", message);
        room.updatedAt = now;
        broadcastMission(room, now);
        return { ok: true, value: undefined };
      });
    });

    socket.on("event:vote", (payload, ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to mission control." };
        const { room, player } = context;
        if (room.phase !== "mission" || !room.mission) return { ok: false, error: "No active event." };
        const event = room.mission.state.activeEvent;
        if (!event) return { ok: false, error: "No active event." };
        if (event.resolution !== "open") return { ok: false, error: "The crew is already resolving this event." };
        const choiceId = String(payload?.choiceId ?? "");
        if (!event.choices.some((choice) => choice.id === choiceId)) {
          return { ok: false, error: "Unknown event response." };
        }
        event.votes[player.id] = choiceId;
        const activePlayers = connectedPlayers(room);
        const now = Date.now();
        if (activePlayers.every((entry) => event.votes[entry.id] !== undefined)) {
          event.resolution = "resolving";
          event.resolveAt = now + 1_200;
        }
        room.updatedAt = now;
        broadcastMission(room, now);
        return { ok: true, value: undefined };
      });
    });

    socket.on("comm:quick", (payload, ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to mission control." };
        const { room, player } = context;
        if (room.phase !== "mission" || !room.mission) return { ok: false, error: "Surface link is not active." };
        const text = String(payload?.text ?? "").slice(0, 100);
        if (!QUICK_COMMS.includes(text as (typeof QUICK_COMMS)[number])) {
          return { ok: false, error: "Unknown quick transmission." };
        }
        const now = Date.now();
        io.to(room.code).emit("comm:message", {
          id: crypto.randomUUID(),
          playerId: player.id,
          name: player.name,
          text,
          at: now,
        });
        addLog(room.mission, "crew", `${player.name}: ${text}`);
        broadcastMission(room, now);
        return { ok: true, value: undefined };
      });
    });

    socket.on("mission:retry", (ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to mission control." };
        const { room, player } = context;
        if (room.hostId !== player.id) return { ok: false, error: "Only the flight director can restart the mission." };
        if (room.phase !== "debrief") return { ok: false, error: "The mission is still active." };
        startLaunch(room, Date.now());
        broadcastRoom(room);
        return { ok: true, value: undefined };
      });
    });

    socket.on("room:lobby", (ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to mission control." };
        const { room, player } = context;
        if (room.hostId !== player.id) return { ok: false, error: "Only the flight director can recall the crew." };
        if (room.phase !== "debrief") return { ok: false, error: "Mission is still active." };
        room.phase = "lobby";
        room.mission = null;
        room.launchAt = null;
        for (const entry of room.players.values()) entry.ready = false;
        room.updatedAt = Date.now();
        broadcastRoom(room);
        return { ok: true, value: undefined };
      });
    });

    socket.on("disconnect", () => {
      const context = currentContext(socket);
      if (!context) return;
      const { room, player } = context;
      player.connected = false;
      player.disconnectedAt = Date.now();
      player.socketId = null;
      room.updatedAt = Date.now();
      if (room.mission) {
        room.mission.interactions.delete(player.id);
        const position = room.mission.positions[player.id];
        if (position) {
          position.interacting = null;
          position.moving = false;
        }
      }
      chooseHost(room);
      broadcastRoom(room);
      if (room.mission) broadcastMission(room);
    });
  });

  const ticker = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (room.phase === "launch" && room.launchAt && now >= room.launchAt) {
        beginMission(room, now);
        broadcastRoom(room, now);
        broadcastMission(room, now);
      }

      if (room.phase === "mission" && room.mission) {
        const phaseBefore = room.phase;
        updateMission(room, room.mission, now);
        if (phaseBefore !== room.phase) {
          broadcastMission(room, now);
          broadcastRoom(room, now);
        } else if (now - room.mission.lastBroadcastAt >= MISSION_BROADCAST_MS) {
          broadcastMission(room, now);
        }
      }

      if (
        now - room.updatedAt > 30_000 &&
        now - room.lastRoomEmitAt > 5_000 &&
        room.phase !== "mission"
      ) {
        broadcastRoom(room, now);
      }

      if (now - room.updatedAt > 5 * 60_000) {
        const anyoneConnected = connectedPlayers(room).length > 0;
        if (!anyoneConnected) {
          rooms.delete(room.code);
          for (const player of room.players.values()) playerRooms.delete(player.id);
        }
      }
    }
  }, TICK_MS);

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      for (const player of [...room.players.values()]) {
        if (
          !player.connected &&
          player.disconnectedAt &&
          now - player.disconnectedAt > 90_000 &&
          (room.phase === "lobby" || room.phase === "design" || room.phase === "debrief")
        ) {
          removePlayer(room, player.id);
          playerRooms.delete(player.id);
          broadcastRoom(room);
        }
      }
      if (room.players.size === 0) rooms.delete(room.code);
    }
  }, 30_000);

  const close = async (): Promise<void> => {
    clearInterval(ticker);
    clearInterval(cleanup);
    await new Promise<void>((resolve) => {
      io.close(() => resolve());
    });
    if (httpServer.listening) {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };

  return { app, httpServer, io, close };
}
