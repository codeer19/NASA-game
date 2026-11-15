export const MAX_PLAYERS = 4;
export const NATIVE_WIDTH = 384;
export const NATIVE_HEIGHT = 224;
export const WORLD_WIDTH = 1024;
export const WORLD_HEIGHT = 640;

export type RoleId = "engineer" | "satellite" | "finance" | "designer";
export type Phase = "lobby" | "design" | "launch" | "mission" | "debrief";
export type ResourceId = "budget" | "mass" | "power" | "data" | "comms" | "time";
export type ScienceCategory = "rocks" | "soil" | "soilResearch" | "weather";
export type ObjectiveKind = ScienceCategory | "transmit";
export type LandingSiteId = "sunny" | "rocky" | "dunes";
export type MissionOutcome = "success" | "partial" | "failure";
export type EventVisual = "dust" | "terrain" | "equipment" | "signal" | "battery";

export type ComponentSlot =
  | "body"
  | "wheels"
  | "suspension"
  | "arm"
  | "camera"
  | "instruments"
  | "power"
  | "antenna";

export type ComponentId =
  | "body_light"
  | "body_armored"
  | "wheels_standard"
  | "wheels_allterrain"
  | "suspension_basic"
  | "suspension_rocker"
  | "arm_basic"
  | "arm_sample"
  | "camera_basic"
  | "camera_research"
  | "instruments_basic"
  | "instruments_lab"
  | "power_standard"
  | "power_longlife"
  | "antenna_basic"
  | "antenna_longrange";

export type RoverBuild = Record<ComponentSlot, ComponentId>;

export interface RoleDefinition {
  id: RoleId;
  name: string;
  shortName: string;
  characterId: "nia" | "ren" | "val" | "samir";
  color: string;
  accent: string;
  tagline: string;
  description: string;
  firstTask: string;
  ability: {
    name: string;
    description: string;
    cooldownSeconds: number;
  };
  passive: string;
  brief: string;
}

export interface ComponentDefinition {
  id: ComponentId;
  slot: ComponentSlot;
  name: string;
  shortName: string;
  description: string;
  benefit: string;
  tradeoff: string;
  cost: number;
  mass: number;
  level: 0 | 1;
  file: string;
  slotIcon: string;
}

export interface ComponentSlotDefinition {
  id: ComponentSlot;
  name: string;
  question: string;
}

export interface LandingSiteDefinition {
  id: LandingSiteId;
  name: string;
  shortName: string;
  description: string;
  pros: string[];
  cons: string[];
  scienceNote: string;
  risk: "Low" | "Medium" | "High";
  x: number;
  y: number;
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
  components: RoverBuild;
  cost: number;
  weight: number;
  upgrades: number;
  landingSite: LandingSiteId | null;
  scienceFocus: ScienceCategory | null;
}

export interface ScienceGoalStatus {
  id: ScienceCategory;
  complete: number;
  target: number;
  done: boolean;
}

export interface ObjectiveState {
  id: string;
  kind: ObjectiveKind;
  category: ScienceCategory | null;
  name: string;
  shortName: string;
  description: string;
  x: number;
  y: number;
  progress: number;
  completed: boolean;
  unlocked: boolean;
  unlockHint: string;
  duration: number;
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
  bullets: string[];
  effects: Partial<Resources>;
}

export interface RoleInsight {
  role: RoleId;
  text: string;
}

export interface MissionEventDefinition {
  id: string;
  order: number;
  title: string;
  question: string;
  body: string;
  visual: EventVisual;
  roleAdvisory: {
    role: RoleId;
    text: string;
  };
  roleInsights: RoleInsight[];
  recommendedChoiceId: string;
  choices: EventChoice[];
  learnMore: string;
}

export interface ActiveEventPublic {
  id: string;
  title: string;
  question: string;
  body: string;
  visual: EventVisual;
  roleAdvisory: {
    role: RoleId;
    text: string;
  };
  roleInsights: RoleInsight[];
  recommendedChoiceId: string;
  choices: EventChoice[];
  votes: Record<string, string>;
  opensAt: number;
  deadline: number;
  resolveAt: number | null;
  resolution: "open" | "resolving";
  finalizedBy: string | null;
  learnMore: string;
}

export interface EventOutcome {
  eventId: string;
  title: string;
  choiceId: string;
  choiceLabel: string;
  bullets: string[];
  effects: Partial<Resources>;
  modifiers: string[];
  at: number;
}

export interface MissionStats {
  objectivesComplete: number;
  objectivesTotal: number;
  rocks: number;
  soil: number;
  soilResearch: number;
  weather: number;
  scienceCollected: number;
  scienceTarget: number;
  eventsResolved: number;
  eventsTotal: number;
  samples: number;
  powerRemaining: number;
  timeRemaining: number;
  budgetRemaining: number;
  weight: number;
  landingSite: LandingSiteId | null;
  scienceFocus: ScienceCategory | null;
}

export interface MissionResult {
  outcome: MissionOutcome;
  success: boolean;
  reason: string;
  headline: string;
  score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  stats: MissionStats;
  decisions: EventOutcome[];
  completedAt: number;
}

export interface MissionState {
  missionId: string;
  startedAt: number;
  elapsed: number;
  resources: Resources;
  objectives: ObjectiveState[];
  science: ScienceGoalStatus[];
  dataTarget: number;
  landingSite: LandingSiteId | null;
  scienceFocus: ScienceCategory | null;
  activeEvent: ActiveEventPublic | null;
  eventOutcome: EventOutcome | null;
  decisions: EventOutcome[];
  eventsResolved: number;
  eventsTotal: number;
  abilityReadyAt: Record<string, number>;
  boostUntil: number;
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
  "design:component": (
    payload: { slot: ComponentSlot; componentId: ComponentId },
    ack: (result: Ack) => void,
  ) => void;
  "design:site": (payload: { siteId: LandingSiteId }, ack: (result: Ack) => void) => void;
  "design:focus": (
    payload: { category: ScienceCategory },
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
  "event:finalize": (ack: (result: Ack) => void) => void;
  "comm:quick": (
    payload: { text: string },
    ack: (result: Ack) => void,
  ) => void;
  "mission:retry": (ack: (result: Ack) => void) => void;
  "room:lobby": (ack: (result: Ack) => void) => void;
};
