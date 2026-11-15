import {
  BASE_SYSTEM_MASS,
  COMPONENTS,
  DESIGN_BUDGET,
  EVENT_DISCUSSION_MS,
  EVENTS,
  FIELD_OBJECTIVES,
  LANDING_SITES,
  MAX_LAUNCH_MASS,
  MIN_UPGRADES,
  MISSION_TIME_SECONDS,
  STARTING_BUDGET,
  STARTING_COMMS,
  STARTING_POWER,
  TRANSMIT_POSITION,
  componentById,
} from "./content";
import type {
  ActiveEventPublic,
  ComponentId,
  DesignPublic,
  EventChoice,
  EventOutcome,
  LandingSiteId,
  MissionEventDefinition,
  MissionOutcome,
  MissionResult,
  MissionState,
  ObjectiveKind,
  ObjectiveState,
  Resources,
  RoleId,
  RoverBuild,
  ScienceCategory,
  ScienceGoalStatus,
} from "./types";

export const MAX_MISSION_TIME = MISSION_TIME_SECONDS + 120;
export const SCIENCE_TARGET = FIELD_OBJECTIVES.length;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatClock(seconds: number): string {
  const bounded = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(bounded / 60);
  const remainder = bounded % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function scienceStatus(objectives: readonly ObjectiveState[]): ScienceGoalStatus[] {
  const categories: ScienceCategory[] = ["rocks", "soil", "soilResearch", "weather"];
  return categories.map((category) => {
    const relevant = objectives.filter((objective) => objective.kind === category);
    const complete = relevant.filter((objective) => objective.completed).length;
    return {
      id: category,
      complete,
      target: relevant.length,
      done: relevant.length > 0 && complete >= relevant.length,
    };
  });
}

export function scienceCollected(objectives: readonly ObjectiveState[]): number {
  return objectives.filter(
    (objective) => objective.completed && objective.kind !== "transmit",
  ).length;
}

export function allScienceComplete(objectives: readonly ObjectiveState[]): boolean {
  return scienceStatus(objectives).every((goal) => goal.done);
}

export function designStats(build: RoverBuild): {
  cost: number;
  weight: number;
  upgrades: number;
} {
  let cost = 0;
  let parts = 0;
  let upgrades = 0;
  for (const componentId of Object.values(build)) {
    const component = componentById(componentId);
    if (!component) continue;
    cost += component.cost;
    parts += component.mass;
    upgrades += component.level;
  }
  return { cost, weight: BASE_SYSTEM_MASS + parts, upgrades };
}

export function makeDesign(
  build: RoverBuild,
  landingSite: LandingSiteId | null,
  scienceFocus: ScienceCategory | null,
): DesignPublic {
  const stats = designStats(build);
  return {
    components: { ...build },
    cost: stats.cost,
    weight: stats.weight,
    upgrades: stats.upgrades,
    landingSite,
    scienceFocus,
  };
}

export function validateBuild(build: RoverBuild): string | null {
  for (const [slot, componentId] of Object.entries(build)) {
    const component = componentById(componentId);
    if (!component) return "One of the rover parts is not available.";
    if (component.slot !== slot) return "That part does not fit in this slot.";
  }
  const stats = designStats(build);
  if (stats.cost > DESIGN_BUDGET) {
    return `That build costs ${stats.cost} credits. The spending limit is ${DESIGN_BUDGET}. Pick a cheaper part.`;
  }
  if (stats.weight > MAX_LAUNCH_MASS) {
    return `The rover weighs ${stats.weight} kg. The launch limit is ${MAX_LAUNCH_MASS} kg. Remove something heavy.`;
  }
  return null;
}

export function canLaunch(design: DesignPublic): string | null {
  const invalid = validateBuild(design.components);
  if (invalid) return invalid;
  if (design.upgrades < MIN_UPGRADES) {
    return `Choose at least ${MIN_UPGRADES} upgrades before launch.`;
  }
  if (!design.landingSite) return "The team still needs to choose a landing place.";
  if (!design.scienceFocus) return "The team still needs to choose a science focus.";
  return null;
}

export function initialResources(design: DesignPublic): Resources {
  const stats = designStats(design.components);
  return {
    budget: Math.max(0, STARTING_BUDGET - stats.cost),
    mass: stats.weight,
    power: design.landingSite === "sunny" ? STARTING_POWER : STARTING_POWER - 8,
    data: 0,
    comms: STARTING_COMMS,
    time: MISSION_TIME_SECONDS,
  };
}

export interface BuildEffects {
  speedMultiplier: number;
  batteryDrainMultiplier: number;
  commsDrainMultiplier: number;
  stormProtection: boolean;
  roughTerrainProtection: boolean;
  actionMultiplier: Record<ScienceCategory, number>;
}

export function buildEffects(design: DesignPublic): BuildEffects {
  const build = design.components;
  const has = (id: ComponentId): boolean => Object.values(build).includes(id);
  const actionMultiplier: Record<ScienceCategory, number> = {
    rocks: 1,
    soil: 1,
    soilResearch: 1,
    weather: 1,
  };

  if (has("wheels_allterrain")) {
    actionMultiplier.soil *= 0.92;
    actionMultiplier.rocks *= 0.92;
  }
  if (has("suspension_rocker")) {
    actionMultiplier.rocks *= 0.94;
    actionMultiplier.weather *= 0.95;
  }
  if (has("arm_sample")) {
    actionMultiplier.rocks *= 0.85;
    actionMultiplier.soil *= 0.8;
  }
  if (has("camera_research")) actionMultiplier.rocks *= 0.78;
  if (has("instruments_lab")) actionMultiplier.soilResearch *= 0.7;
  if (design.scienceFocus) actionMultiplier[design.scienceFocus] *= 0.82;

  return {
    speedMultiplier:
      1 +
      (has("wheels_allterrain") ? 0.12 : 0) +
      (has("suspension_rocker") ? 0.04 : 0),
    batteryDrainMultiplier:
      (has("power_longlife") ? 0.8 : 1) * (has("body_armored") ? 0.92 : 1),
    commsDrainMultiplier: has("antenna_longrange") ? 0.72 : 1,
    stormProtection: has("body_armored"),
    roughTerrainProtection: has("wheels_allterrain") || has("suspension_rocker"),
    actionMultiplier,
  };
}

export function objectiveDuration(
  objective: ObjectiveState,
  mission: MissionState,
  now: number,
): number {
  if (objective.kind === "transmit") return objective.duration;
  const effects = buildEffects(mission.design);
  let multiplier = effects.actionMultiplier[objective.kind];
  if (mission.landingSite === "rocky" && objective.kind === "rocks") multiplier *= 0.82;
  if (mission.landingSite === "dunes" && objective.kind === "weather") multiplier *= 0.82;
  if (mission.boostUntil > now) multiplier *= 0.62;
  return Math.max(0.9, objective.duration * multiplier);
}

export function createObjectives(): ObjectiveState[] {
  const field = FIELD_OBJECTIVES.map((objective) => ({
    id: objective.id,
    kind: objective.kind,
    category: objective.kind,
    name: objective.name,
    shortName: objective.shortName,
    description: objective.description,
    x: objective.x,
    y: objective.y,
    progress: 0,
    completed: false,
    unlocked: objective.kind !== "soilResearch",
    unlockHint: objective.unlockHint,
    duration: objective.duration,
    powerCost: objective.powerCost,
    interactingCount: 0,
  }));
  const transmit: ObjectiveState = {
    id: "transmit",
    kind: "transmit",
    category: null,
    name: "Send the Results Home",
    shortName: "Send results",
    description: "All four science goals are complete. Return to the lander and send the results home.",
    x: TRANSMIT_POSITION.x,
    y: TRANSMIT_POSITION.y,
    progress: 0,
    completed: false,
    unlocked: false,
    unlockHint: "Finish all four science goals first.",
    duration: 2.5,
    powerCost: 0,
    interactingCount: 0,
  };
  return [...field, transmit];
}

export function refreshObjectiveLocks(mission: MissionState): void {
  const status = scienceStatus(mission.objectives);
  const soilDone = status.find((goal) => goal.id === "soil")?.done ?? false;
  const everythingDone = status.every((goal) => goal.done);
  for (const objective of mission.objectives) {
    if (objective.kind === "soilResearch") objective.unlocked = soilDone;
    if (objective.kind === "transmit") objective.unlocked = everythingDone;
  }
}

export function createMission(
  missionId: string,
  design: DesignPublic,
  serverNow: number,
): MissionState {
  const objectives = createObjectives();
  return {
    missionId,
    startedAt: serverNow,
    elapsed: 0,
    resources: initialResources(design),
    objectives,
    science: scienceStatus(objectives),
    dataTarget: SCIENCE_TARGET,
    landingSite: design.landingSite,
    scienceFocus: design.scienceFocus,
    activeEvent: null,
    eventOutcome: null,
    decisions: [],
    eventsResolved: 0,
    eventsTotal: EVENTS.length,
    abilityReadyAt: {},
    boostUntil: 0,
    log: [],
    result: null,
    serverNow,
    design: {
      ...design,
      components: { ...design.components },
    },
  };
}

export function createActiveEvent(
  definition: MissionEventDefinition,
  now: number,
): ActiveEventPublic {
  return {
    id: definition.id,
    title: definition.title,
    question: definition.question,
    body: definition.body,
    visual: definition.visual,
    roleAdvisory: { ...definition.roleAdvisory },
    roleInsights: definition.roleInsights.map((insight) => ({ ...insight })),
    recommendedChoiceId: definition.recommendedChoiceId,
    choices: definition.choices.map((choice) => ({
      ...choice,
      bullets: [...choice.bullets],
      effects: { ...choice.effects },
    })),
    votes: {},
    opensAt: now,
    deadline: now + EVENT_DISCUSSION_MS,
    resolveAt: null,
    resolution: "open",
    finalizedBy: null,
    learnMore: definition.learnMore,
  };
}

export function nextEventDefinition(eventsResolved: number): MissionEventDefinition | undefined {
  return EVENTS[eventsResolved];
}

export interface EventModifierContext {
  roles: ReadonlySet<RoleId>;
  design: DesignPublic;
  eventId: string;
  now: number;
}

function addModifier(modifiers: string[], message: string): void {
  if (!modifiers.includes(message)) modifiers.push(message);
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
  const build = context.design.components;
  const has = (id: ComponentId): boolean => Object.values(build).includes(id);
  const stormEvent = event.id === "dust_storm";

  for (const [key, raw] of Object.entries(choice.effects) as [keyof Resources, number][]) {
    let value = raw;

    if (stormEvent && context.design.landingSite === "dunes" && value < 0) {
      value *= 1.2;
      addModifier(modifiers, "Dusty Dunes made the storm a little worse.");
    }
    if (stormEvent && build.body === "body_armored" && value < 0) {
      value *= 0.82;
      addModifier(modifiers, "The armored body protected the rover.");
    }
    if (event.id === "rocky_slope" && build.wheels === "wheels_allterrain" && value < 0) {
      value *= 0.82;
      addModifier(modifiers, "The all-terrain wheels handled the rocks well.");
    }
    if (event.id === "scanner_fault" && build.instruments === "instruments_lab" && key === "time" && value < 0) {
      value *= 0.8;
      addModifier(modifiers, "The mini lab made the repair quicker.");
    }
    if (event.id === "weak_signal" && build.antenna === "antenna_longrange" && key === "comms" && value > 0) {
      value *= 1.2;
      addModifier(modifiers, "The long-range antenna boosted the signal.");
    }
    if (event.id === "low_battery" && build.power === "power_longlife" && key === "power" && value > 0) {
      value *= 1.15;
      addModifier(modifiers, "The long-life battery recovered extra power.");
    }
    if (context.roles.has("engineer") && (key === "power" || key === "budget") && value < 0) {
      value *= 0.9;
      addModifier(modifiers, "The Rover Builder found a cheaper fix.");
    }
    if (context.roles.has("satellite") && (event.id === "dust_storm" || event.id === "weak_signal") && value < 0) {
      value *= 0.92;
      addModifier(modifiers, "The Mars Explorer read the weather and signal.");
    }
    if (context.roles.has("finance") && key === "budget" && value < 0) {
      value *= 0.8;
      addModifier(modifiers, "The Budget Manager kept the repair affordable.");
    }
    if (context.roles.has("designer") && key === "time" && value < 0) {
      value *= 0.9;
      addModifier(modifiers, "The Mission Planner found time in the schedule.");
    }

    (effects as Record<string, number>)[key] = Math.round(value);
  }

  const outcome: EventOutcome = {
    eventId: event.id,
    title: event.title,
    choiceId: choice.id,
    choiceLabel: choice.label,
    bullets: [...choice.bullets],
    effects,
    modifiers: modifiers.length > 0 ? modifiers : ["The crew handled it together."],
    at: context.now,
  };
  return { outcome, effects, modifiers: outcome.modifiers };
}

export function applyEffects(resources: Resources, effects: Partial<Resources>): Resources {
  return {
    budget: clamp(resources.budget + (effects.budget ?? 0), 0, 999),
    mass: clamp(resources.mass + (effects.mass ?? 0), 0, MAX_LAUNCH_MASS + 8),
    power: clamp(resources.power + (effects.power ?? 0), 0, 100),
    data: Math.max(0, resources.data + (effects.data ?? 0)),
    comms: clamp(resources.comms + (effects.comms ?? 0), 0, 100),
    time: clamp(resources.time + (effects.time ?? 0), 0, MAX_MISSION_TIME),
  };
}

export function countCategory(
  objectives: readonly ObjectiveState[],
  category: ScienceCategory,
): number {
  return objectives.filter(
    (objective) => objective.completed && objective.kind === category,
  ).length;
}

export function failureOutcome(mission: MissionState): MissionOutcome {
  return scienceCollected(mission.objectives) >= 4 ? "partial" : "failure";
}

export function computeResult(
  mission: MissionState,
  outcome: MissionOutcome,
  reason: string,
  now: number,
): MissionResult {
  const status = scienceStatus(mission.objectives);
  const rocks = status.find((goal) => goal.id === "rocks")?.complete ?? 0;
  const soil = status.find((goal) => goal.id === "soil")?.complete ?? 0;
  const soilResearch = status.find((goal) => goal.id === "soilResearch")?.complete ?? 0;
  const weather = status.find((goal) => goal.id === "weather")?.complete ?? 0;
  const collected = scienceCollected(mission.objectives);
  const objectivesComplete = mission.objectives.filter(
    (objective) => objective.completed && objective.kind !== "transmit",
  ).length;
  const samples = rocks + soil;
  const objectivePoints = objectivesComplete * 110;
  const sciencePoints = mission.resources.data * 25;
  const systemsPoints = Math.round(
    mission.resources.power * 1.5 +
      mission.resources.comms * 1.1 +
      (MAX_LAUNCH_MASS - mission.resources.mass) * 6 +
      mission.resources.budget * 0.4,
  );
  const timePoints = Math.round(Math.max(0, mission.resources.time) * 2);
  const eventPoints = mission.eventsResolved * 35;
  const outcomeBonus = outcome === "success" ? 700 : outcome === "partial" ? 220 : 0;
  const score = Math.round(
    objectivePoints + sciencePoints + systemsPoints + timePoints + eventPoints + outcomeBonus,
  );
  const grade: MissionResult["grade"] =
    score >= 2300 ? "S" : score >= 1850 ? "A" : score >= 1400 ? "B" : score >= 950 ? "C" : "D";
  const headline =
    outcome === "success"
      ? "MISSION SUCCESS!"
      : outcome === "partial"
        ? "PARTIAL SUCCESS"
        : "MISSION FAILED";

  return {
    outcome,
    success: outcome === "success",
    reason,
    headline,
    score,
    grade,
    stats: {
      objectivesComplete,
      objectivesTotal: FIELD_OBJECTIVES.length,
      rocks,
      soil,
      soilResearch,
      weather,
      scienceCollected: collected,
      scienceTarget: SCIENCE_TARGET,
      eventsResolved: mission.eventsResolved,
      eventsTotal: mission.eventsTotal,
      samples,
      powerRemaining: Math.round(mission.resources.power),
      timeRemaining: Math.round(mission.resources.time),
      budgetRemaining: Math.round(mission.resources.budget),
      weight: Math.round(mission.resources.mass),
      landingSite: mission.landingSite,
      scienceFocus: mission.scienceFocus,
    },
    decisions: mission.decisions.map((decision) => ({ ...decision })),
    completedAt: now,
  };
}

export function eventDefinitionById(id: string): MissionEventDefinition | undefined {
  return EVENTS.find((event) => event.id === id);
}

export function eventByOrder(order: number): MissionEventDefinition | undefined {
  return EVENTS.find((event) => event.order === order);
}

export function landingSiteLabel(id: LandingSiteId | null): string {
  return LANDING_SITES.find((site) => site.id === id)?.name ?? "Not chosen";
}

export function actionLabel(kind: ObjectiveKind): string {
  if (kind === "rocks") return "Scan the rocks";
  if (kind === "soil") return "Collect soil";
  if (kind === "soilResearch") return "Test the soil";
  if (kind === "transmit") return "Send results home";
  return "Explore";
}

export function effectSummary(choice: EventChoice): string[] {
  const result: string[] = [];
  for (const [key, value] of Object.entries(choice.effects) as [keyof Resources, number][]) {
    if (value === 0) continue;
    if (key === "budget") result.push(value > 0 ? "Money recovered" : "Money spent");
    if (key === "power") result.push(value > 0 ? "Battery recovered" : "Battery used");
    if (key === "comms") result.push(value > 0 ? "Signal improved" : "Signal weakened");
    if (key === "time") result.push(value > 0 ? "Time gained" : "Time lost");
    if (key === "data") result.push(value > 0 ? "Science gained" : "Science lost");
    if (key === "mass") result.push(value > 0 ? "Rover heavier" : "Rover lighter");
  }
  return result;
}

export function totalUpgradeCount(build: RoverBuild): number {
  return Object.values(build).reduce((sum, componentId) => {
    const component = COMPONENTS.find((entry) => entry.id === componentId);
    return sum + (component?.level ?? 0);
  }, 0);
}
