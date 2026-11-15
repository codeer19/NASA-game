import {
  BASE_SYSTEM_MASS,
  DATA_TARGET,
  DESIGN_BUDGET,
  EVENTS,
  FIELD_OBJECTIVES,
  MAX_MODULES,
  MIN_MODULES,
  MISSION_TIME_SECONDS,
  MODULES,
  STARTING_COMMS,
  STARTING_POWER,
  TRANSMIT_POSITION,
} from "./content";
import type {
  ActiveEventPublic,
  DesignPublic,
  EventOutcome,
  MissionEventDefinition,
  MissionResult,
  MissionState,
  ModuleId,
  ObjectiveState,
  Resources,
  RoleId,
} from "./types";

export const MAX_MISSION_TIME = MISSION_TIME_SECONDS + 120;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatClock(seconds: number): string {
  const bounded = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(bounded / 60);
  const remainder = bounded % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function designStats(moduleIds: readonly ModuleId[]): DesignPublic {
  let cost = 0;
  let mass = 0;
  for (const id of moduleIds) {
    const module = MODULES.find((entry) => entry.id === id);
    if (!module) continue;
    cost += module.cost;
    mass += module.mass;
  }
  return { modules: [...moduleIds], cost, mass };
}

export function validateModuleSelection(moduleIds: readonly ModuleId[]): string | null {
  if (new Set(moduleIds).size !== moduleIds.length) {
    return "A module cannot be installed twice.";
  }
  if (!moduleIds.every((id) => MODULES.some((module) => module.id === id))) {
    return "Unknown module.";
  }
  if (moduleIds.length > MAX_MODULES) {
    return `Payload bay holds at most ${MAX_MODULES} modules.`;
  }
  const { cost } = designStats(moduleIds);
  if (cost > DESIGN_BUDGET) {
    return `Payload credits exceeded (${cost}/${DESIGN_BUDGET}).`;
  }
  return null;
}

export function canLaunch(moduleIds: readonly ModuleId[]): string | null {
  if (moduleIds.length < MIN_MODULES) {
    return `Install at least ${MIN_MODULES} payload modules.`;
  }
  return validateModuleSelection(moduleIds);
}

export function initialResources(moduleIds: readonly ModuleId[]): Resources {
  const { cost, mass } = designStats(moduleIds);
  return {
    budget: Math.max(0, 100 - cost),
    mass: clamp(100 - BASE_SYSTEM_MASS - mass, 0, 100),
    power: STARTING_POWER,
    data: 0,
    comms: STARTING_COMMS,
    time: MISSION_TIME_SECONDS,
  };
}

export function moduleEffects(moduleIds: readonly ModuleId[]): {
  speedMultiplier: number;
  sampleDurationMultiplier: number;
  sampleDataBonus: number;
  commsDrainMultiplier: number;
  weatherProtection: boolean;
  armInstalled: boolean;
  spectrometerInstalled: boolean;
} {
  const modules = new Set(moduleIds);
  return {
    speedMultiplier: modules.has("suspension") ? 1.18 : 1,
    sampleDurationMultiplier: modules.has("arm") ? 0.65 : 1,
    sampleDataBonus:
      (modules.has("arm") ? 2 : 0) + (modules.has("spectrometer") ? 4 : 0),
    commsDrainMultiplier: modules.has("weather") ? 0.75 : 1,
    weatherProtection: modules.has("weather"),
    armInstalled: modules.has("arm"),
    spectrometerInstalled: modules.has("spectrometer"),
  };
}

export function objectiveDuration(objective: ObjectiveState, modules: readonly ModuleId[]): number {
  if (objective.kind === "sample" && modules.includes("arm")) {
    return objective.duration * 0.65;
  }
  return objective.duration;
}

export function createObjectives(): ObjectiveState[] {
  const field = FIELD_OBJECTIVES.map((objective) => ({
    id: objective.id,
    kind: objective.kind,
    name: objective.name,
    shortName: objective.shortName,
    description: objective.description,
    x: objective.x,
    y: objective.y,
    progress: 0,
    completed: false,
    unlocked: true,
    duration: objective.duration,
    dataReward: objective.dataReward,
    powerCost: objective.powerCost,
    interactingCount: 0,
  }));
  const transmit: ObjectiveState = {
    id: "transmit",
    kind: "transmit",
    name: "Transmit Science Package",
    shortName: "TRANSMIT",
    description:
      "All field objectives are complete. Return to the lander and send the science package to the orbital relay.",
    x: TRANSMIT_POSITION.x,
    y: TRANSMIT_POSITION.y,
    progress: 0,
    completed: false,
    unlocked: false,
    duration: 2.5,
    dataReward: 0,
    powerCost: 0,
    interactingCount: 0,
  };
  return [...field, transmit];
}

export function createMission(
  missionId: string,
  design: DesignPublic,
  serverNow: number,
): MissionState {
  return {
    missionId,
    startedAt: serverNow,
    elapsed: 0,
    resources: initialResources(design.modules),
    objectives: createObjectives(),
    dataTarget: DATA_TARGET,
    activeEvent: null,
    eventOutcome: null,
    eventsResolved: 0,
    eventsTotal: EVENTS.length,
    abilityReadyAt: {},
    speedUntil: 0,
    log: [],
    result: null,
    serverNow,
    design: { ...design, modules: [...design.modules] },
  };
}

export function createActiveEvent(
  definition: MissionEventDefinition,
  now: number,
): ActiveEventPublic {
  return {
    id: definition.id,
    title: definition.title,
    code: definition.code,
    body: definition.body,
    fieldNote: definition.fieldNote,
    source: definition.source,
    roleAdvisory: definition.roleAdvisory,
    choices: definition.choices.map((choice) => ({
      ...choice,
      effects: { ...choice.effects },
    })),
    votes: {},
    opensAt: now,
    deadline: now + 30_000,
    resolveAt: null,
    resolution: "open",
  };
}

export function nextEventDefinition(eventsResolved: number): MissionEventDefinition | undefined {
  return EVENTS[eventsResolved];
}

export interface EventModifierContext {
  roles: ReadonlySet<RoleId>;
  modules: readonly ModuleId[];
  eventId: string;
}

export function resolveEventEffects(
  event: MissionEventDefinition,
  choiceId: string,
  context: EventModifierContext,
): { outcome: EventOutcome; effects: Partial<Resources>; modifiers: string[] } | null {
  const choice = event.choices.find((entry) => entry.id === choiceId);
  if (!choice) return null;
  const effects: Partial<Resources> = {};
  const modifiers: string[] = [];
  const hasWeather = context.modules.includes("weather");
  const weatherSensitive = event.id === "dust_front" || event.id === "solar_flare";

  for (const [key, raw] of Object.entries(choice.effects) as [
    keyof Resources,
    number,
  ][]) {
    let value = raw;
    const negative = value < 0;

    if (negative) {
      if (key === "time" && context.roles.has("designer")) {
        value *= 0.8;
        modifiers.push("DESIGNER — route control trims 20% of lost time.");
      }
      if (key === "power" && context.roles.has("engineer")) {
        value *= 0.8;
        modifiers.push("ENGINEER — field protocols trim 20% of power loss.");
      }
      if (key === "budget" && context.roles.has("finance")) {
        value *= 0.8;
        modifiers.push("FINANCE — reserve control trims 20% of budget loss.");
      }
      if (key === "comms" && context.roles.has("satellite")) {
        value *= 0.75;
        modifiers.push("SATELLITE — link discipline trims 25% of comms loss.");
      }
      if (weatherSensitive && hasWeather && (key === "time" || key === "power" || key === "comms")) {
        value *= 0.8;
        modifiers.push("WEATHER MAST — storm telemetry softens the penalty.");
      }
    } else if (value > 0) {
      if (key === "comms" && context.roles.has("satellite")) {
        value *= 1.25;
        modifiers.push("SATELLITE — clean uplink boosts comms recovery.");
      }
      if (key === "budget" && context.roles.has("finance")) {
        value *= 1.2;
        modifiers.push("FINANCE — efficient release boosts recovered credits.");
      }
      if (key === "time" && context.roles.has("designer")) {
        value *= 1.1;
        modifiers.push("DESIGNER — schedule control stretches recovered time.");
      }
    }

    (effects as Record<string, number>)[key] = Math.round(value);
  }

  if (modifiers.length === 0) {
    modifiers.push("No crew bonus applied.");
  }
  const uniqueModifiers = [...new Set(modifiers)];

  const outcome: EventOutcome = {
    eventId: event.id,
    title: event.title,
    choiceId: choice.id,
    choiceLabel: choice.label,
    effects,
    modifiers: uniqueModifiers,
    at: Date.now(),
  };
  return { outcome, effects, modifiers: uniqueModifiers };
}

export function applyEffects(resources: Resources, effects: Partial<Resources>): Resources {
  return {
    budget: clamp(resources.budget + (effects.budget ?? 0), 0, 200),
    mass: clamp(resources.mass + (effects.mass ?? 0), 0, 100),
    power: clamp(resources.power + (effects.power ?? 0), 0, 100),
    data: Math.max(0, resources.data + (effects.data ?? 0)),
    comms: clamp(resources.comms + (effects.comms ?? 0), 0, 100),
    time: clamp(resources.time + (effects.time ?? 0), 0, MAX_MISSION_TIME),
  };
}

export function computeScore(
  mission: MissionState,
  success: boolean,
  reason: string,
  now: number,
): MissionResult {
  const objectivesComplete = mission.objectives.filter(
    (objective) => objective.completed && objective.kind !== "transmit",
  ).length;
  const samples = mission.objectives.filter(
    (objective) => objective.completed && objective.kind === "sample",
  ).length;
  const dataCollected = mission.resources.data;
  const objectivePoints = objectivesComplete * 120;
  const sciencePoints = dataCollected * 15;
  const systemsPoints = Math.round(
    mission.resources.power * 2 +
      mission.resources.comms * 1.5 +
      mission.resources.mass +
      mission.resources.budget * 0.5,
  );
  const timePoints = Math.round(Math.max(0, mission.resources.time) * 3);
  const eventPoints = mission.eventsResolved * 30;
  const successBonus = success ? 600 : 0;
  const score = Math.round(
    objectivePoints + sciencePoints + systemsPoints + timePoints + eventPoints + successBonus,
  );
  const grade =
    score >= 2400 ? "S" : score >= 1900 ? "A" : score >= 1450 ? "B" : score >= 1000 ? "C" : "D";
  const headline = success ? "SCIENCE PACKAGE RECEIVED" : "MISSION WINDOW CLOSED";

  return {
    success,
    reason,
    headline,
    score,
    grade,
    stats: {
      objectivesComplete,
      objectivesTotal: FIELD_OBJECTIVES.length,
      dataCollected,
      eventsResolved: mission.eventsResolved,
      samples,
      powerRemaining: Math.round(mission.resources.power),
      timeRemaining: Math.round(mission.resources.time),
      budgetRemaining: Math.round(mission.resources.budget),
      massMargin: Math.round(mission.resources.mass),
    },
    completedAt: now,
  };
}

export function eventDefinitionById(id: string): MissionEventDefinition | undefined {
  return EVENTS.find((event) => event.id === id);
}

export function eventByOrder(order: number): MissionEventDefinition | undefined {
  return EVENTS.find((event) => event.order === order);
}
