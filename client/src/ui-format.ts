import {
  DESIGN_BUDGET,
  MAX_LAUNCH_MASS,
  MIN_UPGRADES,
  RESOURCE_META,
  SCIENCE_GOALS,
  componentById,
  landingSiteById,
  roleById,
  scienceGoalById,
} from "../../shared/content";
import { buildEffects, canLaunch, formatClock } from "../../shared/rules";
import type {
  ComponentSlot,
  DesignPublic,
  MissionState,
  ObjectiveState,
  PlayerPublic,
  ResourceId,
  Resources,
  RoleId,
  RoomPublic,
  ScienceCategory,
} from "../../shared/types";
import type { GameState } from "./store";

export const SLOT_LABEL: Record<ComponentSlot, string> = {
  body: "Body",
  wheels: "Wheels",
  suspension: "Suspension",
  arm: "Robotic arm",
  camera: "Camera",
  instruments: "Mini lab",
  power: "Power",
  antenna: "Antenna",
};

export const SLOT_ORDER: ComponentSlot[] = [
  "body",
  "wheels",
  "suspension",
  "arm",
  "camera",
  "instruments",
  "power",
  "antenna",
];

export const ROLE_TAB: Record<RoleId, "build" | "landing" | "budget" | "science"> = {
  engineer: "build",
  satellite: "landing",
  finance: "budget",
  designer: "science",
};

const PORTRAIT_FILE: Record<string, string> = {
  nia: "nia_okafor",
  ren: "ren_ito",
  val: "val_ruiz",
  samir: "samir_haddad",
  voss: "dr_miriam_voss",
};

const EVENT_ICON: Record<string, string> = {
  dust: "equipment/weather.png",
  terrain: "props/mars/rock_cluster.png",
  equipment: "equipment/spectrometer.png",
  signal: "equipment/antenna.png",
  battery: "equipment/power.png",
};

export function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    if (character === "&") return "&amp;";
    if (character === "<") return "&lt;";
    if (character === ">") return "&gt;";
    if (character === '"') return "&quot;";
    return "&#39;";
  });
}

export function asset(path: string): string {
  return `/assets/${path}`;
}

export function rolePortrait(roleId: RoleId | null | undefined): string {
  const role = roleById(roleId ?? null);
  const file = PORTRAIT_FILE[role?.characterId ?? "nia"] ?? "nia_okafor";
  return asset(`portraits/${file}.png`);
}

export function roleColor(roleId: RoleId | null | undefined): string {
  return roleById(roleId ?? null)?.color ?? "#667687";
}

export function roleName(roleId: RoleId | null | undefined): string {
  return roleById(roleId ?? null)?.name ?? "No job yet";
}

export function eventIcon(visual: string): string {
  return asset(EVENT_ICON[visual] ?? "ui/marker_objective.png");
}

export function scienceIcon(category: ScienceCategory): string {
  return asset(scienceGoalById(category)?.icon ?? "ui/marker_objective.png");
}

export interface ResourceRow {
  id: ResourceId;
  label: string;
  short: string;
  value: string;
  unit: string;
  detail: string;
  icon: string;
  tone: "normal" | "warning" | "danger";
}

export function resourceRows(mission: MissionState): ResourceRow[] {
  const powerTone =
    mission.resources.power <= 20 ? "danger" : mission.resources.power <= 40 ? "warning" : "normal";
  const commsTone =
    mission.resources.comms <= 20 ? "danger" : mission.resources.comms <= 40 ? "warning" : "normal";
  const timeTone =
    mission.resources.time <= 45 ? "danger" : mission.resources.time <= 90 ? "warning" : "normal";
  return RESOURCE_META.map((meta) => {
    if (meta.id === "budget") {
      return {
        ...meta,
        value: `${Math.round(mission.resources.budget)}`,
        short: "Money",
        unit: "credits",
        detail: meta.explanation,
        tone: "normal" as const,
      };
    }
    if (meta.id === "mass") {
      return {
        ...meta,
        value: `${Math.round(mission.resources.mass)}`,
        short: "Weight",
        unit: "kg",
        detail: meta.explanation,
        tone: "normal" as const,
      };
    }
    if (meta.id === "power") {
      return {
        ...meta,
        value: `${Math.round(mission.resources.power)}`,
        short: "Battery",
        unit: "%",
        detail: meta.explanation,
        tone: powerTone,
      };
    }
    if (meta.id === "data") {
      return {
        ...meta,
        value: `${Math.round(mission.resources.data)}/${mission.dataTarget}`,
        short: "Science",
        unit: "results",
        detail: "Eight results finish all four science goals.",
        tone: "normal" as const,
      };
    }
    if (meta.id === "comms") {
      return {
        ...meta,
        value: `${Math.round(mission.resources.comms)}`,
        short: "Signal",
        unit: "%",
        detail: meta.explanation,
        tone: commsTone,
      };
    }
    return {
      ...meta,
      value: formatClock(mission.resources.time),
      short: "Time",
      unit: "left",
      detail: meta.explanation,
      tone: timeTone,
    };
  });
}

export function effectChips(effects: Partial<Resources>): string {
  const labels: Array<[keyof Resources, string, string, boolean]> = [
    ["budget", "Money", " cr", true],
    ["mass", "Weight", " kg", false],
    ["power", "Battery", "%", true],
    ["data", "Science", "", true],
    ["comms", "Signal", "%", true],
    ["time", "Time", "s", true],
  ];
  const chips: string[] = [];
  for (const [key, label, suffix, positiveIsGood] of labels) {
    const value = effects[key];
    if (value === undefined || value === 0) continue;
    const good = positiveIsGood ? value > 0 : value < 0;
    const sign = value > 0 ? "+" : "−";
    chips.push(
      `<span class="effect-chip ${good ? "is-good" : "is-bad"}">${label} ${sign}${Math.abs(value)}${suffix}</span>`,
    );
  }
  if (chips.length === 0) return `<span class="effect-chip">No resource change</span>`;
  return chips.join("");
}

export interface LaunchCheck {
  ok: boolean;
  label: string;
}

export function launchChecks(design: DesignPublic): LaunchCheck[] {
  const error = canLaunch(design);
  return [
    {
      ok: design.upgrades >= MIN_UPGRADES,
      label: `${design.upgrades} of ${MIN_UPGRADES} upgrades fitted`,
    },
    {
      ok: design.cost <= DESIGN_BUDGET,
      label: `${design.cost} of ${DESIGN_BUDGET} credits used`,
    },
    {
      ok: design.weight <= MAX_LAUNCH_MASS,
      label: `${design.weight} of ${MAX_LAUNCH_MASS} kg launch weight`,
    },
    {
      ok: Boolean(design.landingSite),
      label: design.landingSite
        ? `Landing: ${landingSiteById(design.landingSite)?.name ?? "chosen"}`
        : "Choose a landing place",
    },
    {
      ok: Boolean(design.scienceFocus),
      label: design.scienceFocus
        ? `Focus: ${scienceGoalById(design.scienceFocus)?.shortName ?? "chosen"}`
        : "Choose a science focus",
    },
    { ok: !error, label: error ?? "Rover is ready for launch" },
  ];
}

export function designSummary(design: DesignPublic): string {
  const site = landingSiteById(design.landingSite)?.shortName ?? "No landing place";
  const focus = design.scienceFocus
    ? scienceGoalById(design.scienceFocus)?.shortName ?? "Focus"
    : "No focus";
  return `${design.cost} credits · ${design.weight} kg · ${site} · ${focus}`;
}

export function buildHighlights(design: DesignPublic): string[] {
  const effects = buildEffects(design);
  const highlights: string[] = [];
  if (effects.speedMultiplier > 1.05) highlights.push("Drives faster over rough ground");
  if (effects.batteryDrainMultiplier < 0.95) highlights.push("Battery lasts longer");
  if (effects.stormProtection) highlights.push("Protected from dust storms");
  if (effects.roughTerrainProtection) highlights.push("Handles rocky ground");
  const actionLabels: Record<ScienceCategory, string> = {
    rocks: "Rock studies are faster",
    soil: "Soil samples are faster",
    soilResearch: "Lab tests are faster",
    weather: "Weather readings are faster",
  };
  for (const key of Object.keys(actionLabels) as ScienceCategory[]) {
    if (effects.actionMultiplier[key] < 0.9) highlights.push(actionLabels[key]);
  }
  if (highlights.length === 0) highlights.push("A simple, affordable starter rover");
  return highlights;
}

export function componentCount(design: DesignPublic): string {
  const levels = Object.values(design.components).map(
    (id) => componentById(id)?.level ?? 0,
  );
  return `${levels.filter((level) => level > 0).length} of 8 parts upgraded`;
}

export function voteSummary(
  votes: Record<string, string>,
  players: PlayerPublic[],
): string {
  const connected = players.filter((player) => player.connected);
  const voted = connected.filter((player) => votes[player.id] !== undefined).length;
  return `${voted} of ${connected.length} voted`;
}

export interface ScienceGoalRow {
  id: ScienceCategory;
  name: string;
  shortName: string;
  question: string;
  action: string;
  icon: string;
  complete: number;
  target: number;
  done: boolean;
}

export function scienceGoalRows(mission: MissionState): ScienceGoalRow[] {
  return SCIENCE_GOALS.map((goal) => {
    const status = mission.science.find((entry) => entry.id === goal.id);
    return {
      ...goal,
      complete: status?.complete ?? 0,
      target: status?.target ?? 2,
      done: status?.done ?? false,
    };
  });
}

export function scienceTotal(mission: MissionState): string {
  const collected = mission.science.reduce((sum, goal) => sum + goal.complete, 0);
  return `${collected} of ${mission.dataTarget}`;
}

export function localPosition(state: GameState): { x: number; y: number } | null {
  if (!state.playerId) return null;
  return state.positions[state.playerId] ?? null;
}

export function storeMe(state: GameState): PlayerPublic | null {
  if (!state.room || !state.playerId) return null;
  return state.room.players.find((player) => player.id === state.playerId) ?? null;
}

export function nearestObjective(
  state: GameState,
): { objective: ObjectiveState; distance: number | null } | null {
  const mission = state.mission;
  const from = localPosition(state);
  if (!mission) return null;
  let best: { objective: ObjectiveState; distance: number | null } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const objective of mission.objectives) {
    if (!objective.unlocked || objective.completed) continue;
    if (!from) {
      if (!best) best = { objective, distance: null };
      continue;
    }
    const raw = Math.hypot(from.x - objective.x, from.y - objective.y);
    if (raw < bestDistance) {
      bestDistance = raw;
      best = { objective, distance: Math.max(1, Math.round(raw / 2)) };
    }
  }
  return best;
}

export function actionVerb(kind: ObjectiveState["kind"]): string {
  if (kind === "rocks") return "Scan the rocks";
  if (kind === "soil") return "Collect soil";
  if (kind === "soilResearch") return "Run a soil test";
  if (kind === "weather") return "Take a weather reading";
  return "Send the results home";
}

export interface NextAction {
  text: string;
  hint: string;
  targetId: string | null;
}

function waitingForHost(room: RoomPublic): string {
  const host = room.players.find((player) => player.host);
  return host ? host.name : "the host";
}

export function nextAction(state: GameState): NextAction {
  const room = state.room;
  if (!room) {
    return {
      text: "Host a game or join a crew.",
      hint: "Share the room code with up to three friends, or play alone.",
      targetId: null,
    };
  }
  const me = storeMe(state);
  if (room.phase === "lobby") {
    if (!me?.role) {
      return {
        text: "Pick the job that sounds most fun.",
        hint: "Each job has one important task before and during the mission.",
        targetId: null,
      };
    }
    if (!me.ready) {
      return {
        text: `You're the ${roleName(me.role)}. Press Ready when you're set.`,
        hint: roleById(me.role)?.firstTask ?? "Your job card explains what to do.",
        targetId: null,
      };
    }
    return {
      text: "You're ready. Waiting for the crew.",
      hint: me.host
        ? "When everyone is ready, open the rover workshop."
        : `${waitingForHost(room)} will open the rover workshop.`,
      targetId: null,
    };
  }
  if (room.phase === "design") {
    const design = room.design;
    if (design.upgrades < MIN_UPGRADES) {
      return {
        text: `Choose at least ${MIN_UPGRADES} rover upgrades.`,
        hint: "Open the workshop and tap a glowing part of the rover.",
        targetId: null,
      };
    }
    if (!design.landingSite) {
      return {
        text: "Choose where the rover should land.",
        hint: "Open the Landing tab. The Mars Explorer can compare the places.",
        targetId: null,
      };
    }
    if (!design.scienceFocus) {
      return {
        text: "Choose a science focus for the crew.",
        hint: "Open the Science tab. Focus makes one kind of science finish faster.",
        targetId: null,
      };
    }
    if (!me?.ready) {
      return {
        text: "The rover is ready. Press Ready for launch.",
        hint: "Every connected player needs to be ready.",
        targetId: null,
      };
    }
    return {
      text: me.host ? "Launch when the whole crew is ready." : "Waiting for the host to launch.",
      hint: me.host
        ? "You can still change parts until you press Launch to Mars."
        : `${waitingForHost(room)} starts the launch.`,
      targetId: null,
    };
  }
  if (room.phase === "launch") {
    const now = Date.now() + state.clockOffsetMs;
    const remaining = room.launchAt
      ? Math.max(0, Math.ceil((room.launchAt - now) / 1000))
      : 0;
    return {
      text: `Launching in ${formatClock(remaining)}.`,
      hint: "The rover is on its way to Mars. Get ready to explore.",
      targetId: null,
    };
  }
  if (room.phase === "debrief" || state.mission?.result) {
    return {
      text: "Read the mission debrief.",
      hint: "See what the crew learned and what to try next.",
      targetId: null,
    };
  }
  const mission = state.mission;
  if (!mission) {
    return { text: "The mission is getting ready.", hint: "", targetId: null };
  }
  if (mission.activeEvent) {
    return {
      text: `Crew decision: ${mission.activeEvent.title}`,
      hint: "Read the choices, vote, then the host can lock it in.",
      targetId: null,
    };
  }
  if (state.playerId) {
    const interacting = state.positions[state.playerId]?.interacting ?? null;
    const active = interacting
      ? mission.objectives.find((objective) => objective.id === interacting)
      : null;
    if (active && !active.completed) {
      return {
        text: `Keep working on ${active.shortName}.`,
        hint: "Stay close to the marker. Nearby crew members help it finish faster.",
        targetId: active.id,
      };
    }
  }
  const nearest = nearestObjective(state);
  if (nearest) {
    const distance = nearest.distance === null ? "" : ` · ${nearest.distance} m away`;
    return {
      text: `${actionVerb(nearest.objective.kind)} at ${nearest.objective.shortName}${distance}`,
      hint: "Walk to the glowing marker, then press E or tap Action.",
      targetId: nearest.objective.id,
    };
  }
  const soilDone = mission.science.find((goal) => goal.id === "soil")?.done ?? false;
  if (!soilDone) {
    return {
      text: "Find both soil samples to open the mini lab.",
      hint: "Dune soil and Old supply soil are out in the basin.",
      targetId: null,
    };
  }
  const transmit = mission.objectives.find((objective) => objective.id === "transmit");
  if (transmit?.unlocked && !transmit.completed) {
    return {
      text: "All four science goals are done. Send the results home.",
      hint: "Return to the lander and use the Send Results marker.",
      targetId: transmit.id,
    };
  }
  return {
    text: "Finish the remaining science goals before the clock runs out.",
    hint: "Open the Science tab to see exactly what is missing.",
    targetId: null,
  };
}

export function roleTask(roleId: RoleId | null | undefined): string {
  return roleById(roleId ?? null)?.firstTask ?? "Pick a job to see your first task.";
}

export function roomPlayersLabel(players: PlayerPublic[]): string {
  return `${players.filter((player) => player.connected).length} of 4 connected`;
}
