export const MAX_PLAYERS = 4;
export const NATIVE_WIDTH = 384;
export const NATIVE_HEIGHT = 224;
export const WORLD_WIDTH = 1024;
export const WORLD_HEIGHT = 640;

export type RoleId = "engineer" | "satellite" | "finance" | "designer";
export type ModuleId = "suspension" | "arm" | "spectrometer" | "weather";
export type Phase = "lobby" | "design" | "launch" | "mission" | "debrief";
export type ResourceId = "budget" | "mass" | "power" | "data" | "comms" | "time";
export type ObjectiveKind = "sample" | "relay" | "cache" | "transmit";

export interface RoleDefinition {
  id: RoleId;
  name: string;
  shortName: string;
  characterId: "nia" | "ren" | "val" | "samir";
  color: string;
  accent: string;
  ability: {
    name: string;
    description: string;
    cooldownSeconds: number;
  };
  passive: string;
  brief: string;
}

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  category: string;
  description: string;
  effect: string;
  cost: number;
  mass: number;
  file: string;
}

export interface PlayerPublic {
  id: string;
  name: string;
  role: RoleId | null;
  ready: boolean;
  connected: boolean;
  host: boolean;
  character: string | null;
}

export interface DesignPublic {
  modules: ModuleId[];
  cost: number;
  mass: number;
}

export interface ObjectiveState {
  id: string;
  kind: ObjectiveKind;
  name: string;
  shortName: string;
  description: string;
  x: number;
  y: number;
  progress: number;
  completed: boolean;
  unlocked: boolean;
  duration: number;
  dataReward: number;
  powerCost: number;
  interactingCount: number;
}

export interface Resources {
  budget: number;
  mass: number;
  power: number;
  data: number;
  comms: number;
  time: number;
}

export interface MissionLogEntry {
  id: string;
  at: number;
  tone: "info" | "success" | "warning" | "danger" | "crew";
  text: string;
}

export interface EventChoice {
  id: string;
  label: string;
  detail: string;
  effects: Partial<Resources>;
}

export interface MissionEventDefinition {
  id: string;
  order: number;
  title: string;
  code: string;
  body: string;
  fieldNote: string;
  source: string;
  roleAdvisory: {
    role: RoleId;
    text: string;
  };
  choices: EventChoice[];
}

export interface ActiveEventPublic {
  id: string;
  title: string;
  code: string;
  body: string;
  fieldNote: string;
  source: string;
  roleAdvisory: {
    role: RoleId;
    text: string;
  };
  choices: EventChoice[];
  votes: Record<string, string>;
  opensAt: number;
  deadline: number;
  resolveAt: number | null;
  resolution: "open" | "resolving";
}

export interface EventOutcome {
  eventId: string;
  title: string;
  choiceId: string;
  choiceLabel: string;
  effects: Partial<Resources>;
  modifiers: string[];
  at: number;
}

export interface MissionStats {
  objectivesComplete: number;
  objectivesTotal: number;
  dataCollected: number;
  eventsResolved: number;
  samples: number;
  powerRemaining: number;
  timeRemaining: number;
  budgetRemaining: number;
  massMargin: number;
}

export interface MissionResult {
  success: boolean;
  reason: string;
  headline: string;
  score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  stats: MissionStats;
  completedAt: number;
}

export interface MissionState {
  missionId: string;
  startedAt: number;
  elapsed: number;
  resources: Resources;
  objectives: ObjectiveState[];
  dataTarget: number;
  activeEvent: ActiveEventPublic | null;
  eventOutcome: EventOutcome | null;
  eventsResolved: number;
  eventsTotal: number;
  abilityReadyAt: Record<string, number>;
  speedUntil: number;
  log: MissionLogEntry[];
  result: MissionResult | null;
  serverNow: number;
  design: DesignPublic;
}

export interface PositionState {
  x: number;
  y: number;
  dir: "down" | "left" | "right" | "up";
  moving: boolean;
  interacting: string | null;
}

export interface RoomPublic {
  code: string;
  phase: Phase;
  hostId: string;
  players: PlayerPublic[];
  design: DesignPublic;
  launchAt: number | null;
  attempt: number;
  mission: MissionState | null;
  positions: Record<string, PositionState>;
  serverNow: number;
}

export type Ack<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface RoomJoinResult {
  playerId: string;
  room: RoomPublic;
}

export interface MovePayload {
  x: number;
  y: number;
  dir: "down" | "left" | "right" | "up";
  moving: boolean;
}

export type ServerToClientEvents = {
  "room:state": (room: RoomPublic) => void;
  "mission:state": (payload: {
    mission: MissionState;
    positions: Record<string, PositionState>;
    serverNow: number;
  }) => void;
  "crew:positions": (payload: {
    positions: Record<string, PositionState>;
    serverNow: number;
  }) => void;
  "comm:message": (payload: {
    id: string;
    playerId: string;
    name: string;
    text: string;
    at: number;
  }) => void;
  "server:error": (payload: { message: string }) => void;
};

export type ClientToServerEvents = {
  "room:create": (
    payload: { name: string; token: string },
    ack: (result: Ack<RoomJoinResult>) => void,
  ) => void;
  "room:join": (
    payload: { code: string; name: string; token: string },
    ack: (result: Ack<RoomJoinResult>) => void,
  ) => void;
  "room:resume": (
    payload: { code: string; token: string },
    ack: (result: Ack<RoomJoinResult>) => void,
  ) => void;
  "room:leave": (ack: (result: Ack) => void) => void;
  "player:role": (payload: { role: RoleId }, ack: (result: Ack) => void) => void;
  "player:ready": (payload: { ready: boolean }, ack: (result: Ack) => void) => void;
  "design:toggle": (
    payload: { moduleId: ModuleId },
    ack: (result: Ack) => void,
  ) => void;
  "game:toDesign": (ack: (result: Ack) => void) => void;
  "game:start": (ack: (result: Ack) => void) => void;
  "mission:move": (payload: MovePayload) => void;
  "mission:interact": (
    payload: { targetId: string | null },
    ack: (result: Ack) => void,
  ) => void;
  "mission:ability": (ack: (result: Ack) => void) => void;
  "event:vote": (
    payload: { choiceId: string },
    ack: (result: Ack) => void,
  ) => void;
  "comm:quick": (
    payload: { text: string },
    ack: (result: Ack) => void,
  ) => void;
  "mission:retry": (ack: (result: Ack) => void) => void;
  "room:lobby": (ack: (result: Ack) => void) => void;
};
