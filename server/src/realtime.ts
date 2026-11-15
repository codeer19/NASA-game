import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import express from "express";
import { Server } from "socket.io";
import {
  COMPONENTS,
  DEFAULT_BUILD,
  EVENTS,
  FIELD_OBJECTIVES,
  LANDER_POSITION,
  QUICK_COMMS,
  ROLES,
  SPAWN_POINTS,
  WORLD,
  componentById,
} from "../../shared/content";
import {
  actionLabel,
  allScienceComplete,
  applyEffects,
  buildEffects,
  canLaunch,
  computeResult,
  createActiveEvent,
  createMission,
  failureOutcome,
  makeDesign,
  nextEventDefinition,
  objectiveDuration,
  refreshObjectiveLocks,
  resolveEventEffects,
  scienceCollected,
  scienceStatus,
  validateBuild,
} from "../../shared/rules";
import type {
  Ack,
  ActiveEventPublic,
  ClientToServerEvents,
  ComponentId,
  ComponentSlot,
  DesignPublic,
  EventOutcome,
  LandingSiteId,
  MissionEventDefinition,
  MissionLogEntry,
  MissionState,
  MovePayload,
  Phase,
  PlayerPublic,
  PositionState,
  Resources,
  RoleId,
  RoomJoinResult,
  RoomPublic,
  RoverBuild,
  ScienceCategory,
  ServerToClientEvents,
} from "../../shared/types";
import { MAX_PLAYERS } from "../../shared/types";

const LAUNCH_DURATION_MS = 10_000;
const TICK_MS = 100;
const MISSION_BROADCAST_MS = 250;
const VOTE_LOCK_DELAY_MS = 1_200;
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
  design: RoverBuild;
  landingSite: LandingSiteId | null;
  scienceFocus: ScienceCategory | null;
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

function isComponentId(value: unknown): value is ComponentId {
  return typeof value === "string" && COMPONENTS.some((component) => component.id === value);
}

function isComponentSlot(value: unknown): value is ComponentSlot {
  return (
    value === "body" ||
    value === "wheels" ||
    value === "suspension" ||
    value === "arm" ||
    value === "camera" ||
    value === "instruments" ||
    value === "power" ||
    value === "antenna"
  );
}

function isLandingSite(value: unknown): value is LandingSiteId {
  return value === "sunny" || value === "rocky" || value === "dunes";
}

function isScienceCategory(value: unknown): value is ScienceCategory {
  return (
    value === "rocks" ||
    value === "soil" ||
    value === "soilResearch" ||
    value === "weather"
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

function designPublic(room: Room): DesignPublic {
  return makeDesign(room.design, room.landingSite, room.scienceFocus);
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
    design: designPublic(room),
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
  const design = designPublic(room);
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
    "The rover is safely on Mars. Walk to a marker and hold E to start collecting science.",
  );
  addLog(
    runtime,
    "crew",
    "DR. VOSS: Welcome, explorers. Let's find out what this place can teach us.",
  );
  room.phase = "mission";
  room.launchAt = null;
  room.mission = runtime;
  room.updatedAt = now;
}

function finishMission(
  room: Room,
  runtime: MissionRuntime,
  outcome: "success" | "partial" | "failure",
  reason: string,
  now: number,
): void {
  const result = computeResult(runtime.state, outcome, reason, now);
  runtime.state.result = result;
  runtime.state.activeEvent = null;
  runtime.interactions.clear();
  addLog(
    runtime,
    outcome === "success" ? "success" : outcome === "partial" ? "warning" : "danger",
    reason,
  );
  room.phase = "debrief";
  room.updatedAt = now;
}

function checkFailure(room: Room, runtime: MissionRuntime, now: number): boolean {
  if (runtime.state.result) return true;
  const collected = scienceCollected(runtime.state.objectives);
  if (runtime.state.resources.power <= 0) {
    runtime.state.resources.power = 0;
    const outcome = failureOutcome(runtime.state);
    finishMission(
      room,
      runtime,
      outcome,
      `The rover battery ran out. The team collected ${collected} of ${runtime.state.dataTarget} science results.`,
      now,
    );
    return true;
  }
  if (runtime.state.resources.time <= 0) {
    runtime.state.resources.time = 0;
    const outcome = failureOutcome(runtime.state);
    finishMission(
      room,
      runtime,
      outcome,
      `The mission timer ran out. The team collected ${collected} of ${runtime.state.dataTarget} science results.`,
      now,
    );
    return true;
  }
  return false;
}

function maybeOpenEvent(room: Room, runtime: MissionRuntime, now: number): void {
  if (runtime.state.activeEvent || runtime.state.result) return;
  const completedField = runtime.state.objectives.filter(
    (objective) => objective.completed && objective.kind !== "transmit",
  ).length;
  if (runtime.state.elapsed < 15 && completedField === 0) return;
  const threshold = Math.min(EVENTS.length, 1 + Math.floor(completedField / 2));
  if (runtime.openedEvents >= threshold) return;
  const definition = nextEventDefinition(runtime.openedEvents);
  if (!definition) return;
  runtime.state.activeEvent = createActiveEvent(definition, now);
  runtime.openedEvents += 1;
  runtime.interactions.clear();
  for (const position of Object.values(runtime.positions)) position.interacting = null;
  addLog(runtime, "warning", `${definition.title} — the crew needs to decide what to do.`);
}

function voteCounts(event: ActiveEventPublic, room: Room): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const choice of event.choices) counts[choice.id] = 0;
  for (const player of connectedPlayers(room)) {
    const choiceId = event.votes[player.id];
    if (choiceId && counts[choiceId] !== undefined) counts[choiceId] += 1;
  }
  return counts;
}

function pickWinningChoice(event: ActiveEventPublic, room: Room): string {
  const counts = voteCounts(event, room);
  const entries = Object.entries(counts);
  const best = Math.max(...entries.map(([, count]) => count));
  const tied = entries.filter(([, count]) => count === best).map(([id]) => id);
  if (best === 0) return event.recommendedChoiceId || event.choices[0]?.id || "";
  if (tied.length === 1) return tied[0]!;
  const adviser = connectedPlayers(room).find(
    (player) => player.role === event.roleAdvisory.role,
  );
  const adviserVote = adviser ? event.votes[adviser.id] : undefined;
  if (adviserVote && tied.includes(adviserVote)) return adviserVote;
  const hostVote = event.votes[room.hostId];
  if (hostVote && tied.includes(hostVote)) return hostVote;
  if (tied.includes(event.recommendedChoiceId)) return event.recommendedChoiceId;
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
    design: runtime.state.design,
    eventId: definition.id,
    now,
  });
  if (result) {
    runtime.state.resources = applyEffects(runtime.state.resources, result.effects);
    runtime.state.eventOutcome = result.outcome;
    runtime.state.decisions.push(result.outcome);
    runtime.state.eventsResolved += 1;
    addLog(runtime, "info", `${definition.title}: ${result.outcome.choiceLabel}.`);
    addLog(runtime, "crew", result.modifiers.join(" "));
  }
  runtime.state.activeEvent = null;
  runtime.state.serverNow = now;
  checkFailure(room, runtime, now);
}

function eventDefinitionById(id: string): MissionEventDefinition | undefined {
  return EVENTS.find((event) => event.id === id);
}

function completeObjective(
  room: Room,
  runtime: MissionRuntime,
  objectiveId: string,
  now: number,
): void {
  const objective = runtime.state.objectives.find((entry) => entry.id === objectiveId);
  if (!objective || objective.completed) return;
  const state = runtime.state;

  if (objective.kind === "transmit") {
    if (!allScienceComplete(state.objectives)) {
      addLog(runtime, "warning", "The team still needs to finish all four science goals.");
      return;
    }
    objective.completed = true;
    objective.progress = 1;
    finishMission(
      room,
      runtime,
      "success",
      "All four science goals are complete, and the results are safely on their way home.",
      now,
    );
    return;
  }

  objective.completed = true;
  objective.progress = 1;
  objective.interactingCount = 0;
  const field = FIELD_OBJECTIVES.find((entry) => entry.id === objective.id);
  if (!field) return;
  state.resources.data += 1;
  state.resources.power = Math.max(0, state.resources.power - field.powerCost);
  if (objective.kind === "rocks" || objective.kind === "soil") {
    state.resources.mass = Math.min(62, state.resources.mass + 0.4);
  }
  state.science = scienceStatus(state.objectives);
  refreshObjectiveLocks(state);

  const collected = scienceCollected(state.objectives);
  addLog(
    runtime,
    "success",
    `${objective.name}: ${actionLabel(objective.kind)} complete. Science ${collected} of ${state.dataTarget}.`,
  );

  const freshSoilGoal = state.science.find((goal) => goal.id === "soil")?.done;
  if (freshSoilGoal) {
    addLog(runtime, "info", "Both soil samples are ready. The mini lab tests are now open.");
  }
  if (allScienceComplete(state.objectives)) {
    addLog(runtime, "success", "All four science goals are complete! Return to the lander to send the results home.");
  }

  if (checkFailure(room, runtime, now)) return;
  maybeOpenEvent(room, runtime, now);
}

function updateMission(room: Room, runtime: MissionRuntime, now: number): void {
  if (runtime.state.result) return;
  const dt = Math.min(0.35, (now - runtime.lastTickAt) / 1000);
  runtime.lastTickAt = now;
  if (dt <= 0) return;
  const state = runtime.state;

  const active = state.activeEvent;
  if (active) {
    if (active.resolution === "resolving" && active.resolveAt && now >= active.resolveAt) {
      resolveEvent(room, runtime, now);
      return;
    }
    if (now >= active.deadline) {
      resolveEvent(room, runtime, now);
    }
    state.serverNow = now;
    return;
  }

  state.elapsed += dt;
  state.serverNow = now;
  const roles = activeRoles(room);
  const players = connectedPlayers(room);
  const positions = runtime.positions;
  const effects = buildEffects(state.design);

  const movingCount = players.filter((player) => positions[player.id]?.moving).length;
  const powerDrain =
    (0.055 + movingCount * 0.018) * effects.batteryDrainMultiplier;
  let commsDrain = 0;
  for (const player of players) {
    const position = positions[player.id];
    if (!position) continue;
    const distance = Math.hypot(position.x - LANDER_POSITION.x, position.y - LANDER_POSITION.y);
    if (distance > 520) commsDrain = Math.max(commsDrain, 0.2);
    else if (distance > 260) commsDrain = Math.max(commsDrain, 0.1);
  }
  commsDrain *= effects.commsDrainMultiplier;
  if (roles.has("satellite")) commsDrain *= 0.92;

  state.resources.power = Math.max(0, state.resources.power - powerDrain * dt);
  state.resources.comms = Math.max(0, state.resources.comms - commsDrain * dt);
  state.resources.time = Math.max(0, state.resources.time - dt);

  if (state.resources.power <= 0 || state.resources.time <= 0) {
    checkFailure(room, runtime, now);
    return;
  }

  for (const objective of state.objectives) {
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
    const signalFactor = state.resources.comms < 20 ? 0.75 : 1;
    const duration = objectiveDuration(objective, state, now);
    objective.progress = Math.min(1, objective.progress + (dt / duration) * crewBoost * signalFactor);
    if (objective.progress >= 1) {
      completeObjective(room, runtime, objective.id, now);
      if (room.phase !== "mission") return;
    }
  }

  maybeOpenEvent(room, runtime, now);
  if (room.phase === "mission") checkFailure(room, runtime, now);
}

function maybeLockVote(room: Room, runtime: MissionRuntime, now: number): void {
  const event = runtime.state.activeEvent;
  if (!event || event.resolution !== "open") return;
  const players = connectedPlayers(room);
  if (players.length === 0) return;
  if (players.every((player) => event.votes[player.id] !== undefined)) {
    event.resolution = "resolving";
    event.resolveAt = now + VOTE_LOCK_DELAY_MS;
  }
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
    if (typeof ack === "function") ack({ ok: false, error: "The game could not complete that action." });
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
        if (!name) return { ok: false, error: "Use a name between 2 and 18 characters." };
        if (token.length < 12) return { ok: false, error: "Invalid client token." };
        if (socket.data.roomCode) return { ok: false, error: "Leave your current room first." };
        if (rooms.size >= 250) return { ok: false, error: "Too many games are running right now. Try again in a moment." };

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
          design: { ...DEFAULT_BUILD },
          landingSite: null,
          scienceFocus: null,
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
        if (!name) return { ok: false, error: "Use a name between 2 and 18 characters." };
        if (token.length < 12) return { ok: false, error: "Invalid client token." };
        const room = rooms.get(code);
        if (!room) return { ok: false, error: "No game found for that room code." };

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

        if (room.phase !== "lobby") return { ok: false, error: "That game has already started." };
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
        if (!room) return { ok: false, error: "That game is no longer available." };
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
          if (room.mission) {
            maybeLockVote(room, room.mission, Date.now());
            broadcastMission(room);
          }
          broadcastRoom(room);
        }
        return { ok: true, value: undefined };
      });
    });

    socket.on("player:role", (payload, ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to the game." };
        const { room, player } = context;
        if (room.phase !== "lobby") return { ok: false, error: "Jobs are locked after the workshop opens." };
        if (!isRoleId(payload?.role)) return { ok: false, error: "Unknown job." };
        const role = payload.role;
        if (!roleFree(room, role, player.id)) return { ok: false, error: "That job is already taken." };
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
        if (!context) return { ok: false, error: "Reconnect to the game." };
        const { room, player } = context;
        if (room.phase !== "lobby" && room.phase !== "design") {
          return { ok: false, error: "The crew is no longer getting ready." };
        }
        player.ready = Boolean(payload?.ready);
        room.updatedAt = Date.now();
        broadcastRoom(room);
        return { ok: true, value: undefined };
      });
    });

    socket.on("design:component", (payload, ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to the game." };
        const { room } = context;
        if (room.phase !== "design") return { ok: false, error: "The workshop is not open." };
        if (!isComponentSlot(payload?.slot) || !isComponentId(payload?.componentId)) {
          return { ok: false, error: "That rover part is not available." };
        }
        const component = componentById(payload.componentId);
        if (!component || component.slot !== payload.slot) {
          return { ok: false, error: "That part does not fit in this slot." };
        }
        const next: RoverBuild = { ...room.design, [payload.slot]: payload.componentId };
        const invalid = validateBuild(next);
        if (invalid) return { ok: false, error: invalid };
        room.design = next;
        for (const entry of room.players.values()) entry.ready = false;
        room.updatedAt = Date.now();
        broadcastRoom(room);
        return { ok: true, value: undefined };
      });
    });

    socket.on("design:site", (payload, ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to the game." };
        const { room } = context;
        if (room.phase !== "design") return { ok: false, error: "The workshop is not open." };
        if (!isLandingSite(payload?.siteId)) return { ok: false, error: "Unknown landing place." };
        room.landingSite = payload.siteId;
        for (const entry of room.players.values()) entry.ready = false;
        room.updatedAt = Date.now();
        broadcastRoom(room);
        return { ok: true, value: undefined };
      });
    });

    socket.on("design:focus", (payload, ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to the game." };
        const { room } = context;
        if (room.phase !== "design") return { ok: false, error: "The workshop is not open." };
        if (!isScienceCategory(payload?.category)) return { ok: false, error: "Unknown science goal." };
        room.scienceFocus = payload.category;
        for (const entry of room.players.values()) entry.ready = false;
        room.updatedAt = Date.now();
        broadcastRoom(room);
        return { ok: true, value: undefined };
      });
    });

    socket.on("game:toDesign", (ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to the game." };
        const { room, player } = context;
        if (room.hostId !== player.id) return { ok: false, error: "Only the host can open the workshop." };
        if (room.phase !== "lobby") return { ok: false, error: "The workshop is already open." };
        if (!allConnectedReady(room)) return { ok: false, error: "Everyone connected needs to be ready first." };
        if ([...room.players.values()].some((entry) => entry.role === null)) {
          return { ok: false, error: "Everyone needs to pick a job first." };
        }
        room.phase = "design";
        room.design = { ...DEFAULT_BUILD };
        room.landingSite = null;
        room.scienceFocus = null;
        for (const entry of room.players.values()) entry.ready = false;
        room.updatedAt = Date.now();
        broadcastRoom(room);
        return { ok: true, value: undefined };
      });
    });

    socket.on("game:start", (ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to the game." };
        const { room, player } = context;
        if (room.hostId !== player.id) return { ok: false, error: "Only the host can start the launch." };
        if (room.phase !== "design") return { ok: false, error: "Open the workshop before launch." };
        if (!allConnectedReady(room)) return { ok: false, error: "Everyone connected needs to be ready for launch." };
        const invalid = canLaunch(designPublic(room));
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
        if (!context) return { ok: false, error: "Reconnect to the game." };
        const { room, player } = context;
        if (room.phase !== "mission" || !room.mission) return { ok: false, error: "The mission is not active." };
        if (room.mission.state.activeEvent || room.mission.state.result) {
          return { ok: false, error: "The game is paused for a crew decision." };
        }
        const targetId = payload?.targetId ?? null;
        if (targetId === null) {
          room.mission.interactions.delete(player.id);
          const pos = room.mission.positions[player.id];
          if (pos) pos.interacting = null;
          return { ok: true, value: undefined };
        }
        const objective = room.mission.state.objectives.find((entry) => entry.id === targetId);
        if (!objective || objective.completed) {
          return { ok: false, error: "That science site is already finished." };
        }
        if (!objective.unlocked) {
          return { ok: false, error: objective.unlockHint || "That science site is not open yet." };
        }
        const pos = room.mission.positions[player.id];
        if (!pos) return { ok: false, error: "Your crew marker is not ready yet." };
        if (Math.hypot(pos.x - objective.x, pos.y - objective.y) > 60) {
          return { ok: false, error: "Move closer to the marker." };
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
        if (!context) return { ok: false, error: "Reconnect to the game." };
        const { room, player } = context;
        if (room.phase !== "mission" || !room.mission) return { ok: false, error: "The mission is not active." };
        if (!player.role) return { ok: false, error: "No job assigned." };
        if (room.mission.state.activeEvent || room.mission.state.result) {
          return { ok: false, error: "The game is paused for a crew decision." };
        }
        const now = Date.now();
        const readyAt = room.mission.state.abilityReadyAt[player.id] ?? 0;
        if (readyAt > now) {
          return { ok: false, error: `Your job tool is ready again in ${Math.ceil((readyAt - now) / 1000)} seconds.` };
        }
        const role = ROLES.find((entry) => entry.id === player.role);
        if (!role) return { ok: false, error: "Unknown job." };
        const runtime = room.mission;
        let message = "";
        if (player.role === "engineer") {
          runtime.state.resources.power = Math.min(100, runtime.state.resources.power + 18);
          message = `${player.name} repaired the rover. Battery recovered 18%.`;
        } else if (player.role === "satellite") {
          runtime.state.resources.comms = Math.min(100, runtime.state.resources.comms + 18);
          message = `${player.name} checked the weather. Signal recovered 18%.`;
        } else if (player.role === "finance") {
          runtime.state.resources.budget += 12;
          message = `${player.name} released 12 credits from the reserve.`;
        } else if (player.role === "designer") {
          runtime.state.boostUntil = now + 20_000;
          message = `${player.name} focused the team. Science actions are faster for 20 seconds.`;
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
        if (!context) return { ok: false, error: "Reconnect to the game." };
        const { room, player } = context;
        if (room.phase !== "mission" || !room.mission) return { ok: false, error: "No crew decision is open." };
        const event = room.mission.state.activeEvent;
        if (!event) return { ok: false, error: "No crew decision is open." };
        if (event.resolution !== "open") return { ok: false, error: "The decision is already locked." };
        const choiceId = String(payload?.choiceId ?? "");
        if (!event.choices.some((choice) => choice.id === choiceId)) {
          return { ok: false, error: "Unknown choice." };
        }
        event.votes[player.id] = choiceId;
        const now = Date.now();
        maybeLockVote(room, room.mission, now);
        room.updatedAt = now;
        broadcastMission(room, now);
        return { ok: true, value: undefined };
      });
    });

    socket.on("event:finalize", (ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to the game." };
        const { room, player } = context;
        if (room.hostId !== player.id) return { ok: false, error: "Only the host can lock in the decision." };
        if (room.phase !== "mission" || !room.mission) return { ok: false, error: "No crew decision is open." };
        const event = room.mission.state.activeEvent;
        if (!event) return { ok: false, error: "No crew decision is open." };
        if (event.resolution !== "open") return { ok: false, error: "The decision is already locked." };
        event.resolution = "resolving";
        event.resolveAt = Date.now() + 650;
        event.finalizedBy = player.id;
        broadcastMission(room, Date.now());
        return { ok: true, value: undefined };
      });
    });

    socket.on("comm:quick", (payload, ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to the game." };
        const { room, player } = context;
        if (room.phase !== "mission" || !room.mission) return { ok: false, error: "The mission is not active." };
        const text = String(payload?.text ?? "").slice(0, 100);
        if (!QUICK_COMMS.includes(text as (typeof QUICK_COMMS)[number])) {
          return { ok: false, error: "Unknown quick message." };
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
        if (!context) return { ok: false, error: "Reconnect to the game." };
        const { room, player } = context;
        if (room.hostId !== player.id) return { ok: false, error: "Only the host can restart the mission." };
        if (room.phase !== "debrief") return { ok: false, error: "The mission is still running." };
        startLaunch(room, Date.now());
        broadcastRoom(room);
        return { ok: true, value: undefined };
      });
    });

    socket.on("room:lobby", (ack) => {
      safeHandler(ack, () => {
        const context = currentContext(socket);
        if (!context) return { ok: false, error: "Reconnect to the game." };
        const { room, player } = context;
        if (room.hostId !== player.id) return { ok: false, error: "Only the host can return everyone to the lobby." };
        if (room.phase !== "debrief") return { ok: false, error: "The mission is still running." };
        room.phase = "lobby";
        room.mission = null;
        room.launchAt = null;
        room.design = { ...DEFAULT_BUILD };
        room.landingSite = null;
        room.scienceFocus = null;
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
        maybeLockVote(room, room.mission, Date.now());
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
