import { describe, expect, it } from "vitest";
import {
  BASE_SYSTEM_MASS,
  COMPONENTS,
  COMPONENT_SLOTS,
  DEFAULT_BUILD,
  DESIGN_BUDGET,
  EVENTS,
  FIELD_OBJECTIVES,
  MAX_LAUNCH_MASS,
  MIN_UPGRADES,
  MISSION_TIME_SECONDS,
  STARTING_BUDGET,
  STARTING_COMMS,
  STARTING_POWER,
  TRANSMIT_POSITION,
  componentsForSlot,
} from "../shared/content";
import {
  MAX_MISSION_TIME,
  applyEffects,
  buildEffects,
  canLaunch,
  computeResult,
  createActiveEvent,
  createMission,
  createObjectives,
  designStats,
  failureOutcome,
  formatClock,
  initialResources,
  makeDesign,
  objectiveDuration,
  refreshObjectiveLocks,
  resolveEventEffects,
  scienceCollected,
  scienceStatus,
  validateBuild,
} from "../shared/rules";
import type { MissionState, RoleId, RoverBuild } from "../shared/types";

const UPGRADED_BUILD: RoverBuild = {
  ...DEFAULT_BUILD,
  wheels: "wheels_allterrain",
  arm: "arm_sample",
};

const HEAVY_BUILD: RoverBuild = {
  ...DEFAULT_BUILD,
  body: "body_armored",
  wheels: "wheels_allterrain",
  suspension: "suspension_rocker",
  arm: "arm_sample",
  camera: "camera_research",
  antenna: "antenna_longrange",
};

const MAXED_BUILD: RoverBuild = {
  body: "body_armored",
  wheels: "wheels_allterrain",
  suspension: "suspension_rocker",
  arm: "arm_sample",
  camera: "camera_research",
  instruments: "instruments_lab",
  power: "power_longlife",
  antenna: "antenna_longrange",
};

const READY_DESIGN = makeDesign(UPGRADED_BUILD, "rocky", "rocks");

function complete(mission: MissionState, ids: string[]): void {
  for (const objective of mission.objectives) {
    if (!ids.includes(objective.id)) continue;
    objective.completed = true;
    objective.progress = 1;
  }
}

describe("component and rover build rules", () => {
  it("stocks two parts in every slot", () => {
    for (const slot of COMPONENT_SLOTS) {
      const options = componentsForSlot(slot.id);
      expect(options, slot.id).toHaveLength(2);
      expect(options.map((option) => option.level).sort()).toEqual([0, 1]);
      for (const option of options) {
        expect(option.cost).toBeGreaterThan(0);
        expect(option.mass).toBeGreaterThan(0);
        expect(option.file.length).toBeGreaterThan(0);
      }
    }
    expect(new Set(COMPONENTS.map((component) => component.id)).size).toBe(COMPONENTS.length);
  });

  it("sums cost, launch weight, and upgrades from the eight slots", () => {
    expect(designStats(DEFAULT_BUILD)).toEqual({ cost: 28, weight: BASE_SYSTEM_MASS + 23, upgrades: 0 });
    expect(designStats(UPGRADED_BUILD)).toEqual({ cost: 37, weight: BASE_SYSTEM_MASS + 26, upgrades: 2 });
    expect(designStats(HEAVY_BUILD)).toEqual({ cost: 54, weight: BASE_SYSTEM_MASS + 36, upgrades: 6 });
  });

  it("copies the build into the shared public design", () => {
    const design = makeDesign(UPGRADED_BUILD, "sunny", "soil");
    expect(design).toMatchObject({ cost: 37, weight: 46, upgrades: 2, landingSite: "sunny", scienceFocus: "soil" });
    design.components.arm = "arm_basic";
    expect(UPGRADED_BUILD.arm).toBe("arm_sample");
  });

  it("rejects misplaced, unknown, overweight, and over-budget builds", () => {
    expect(validateBuild(DEFAULT_BUILD)).toBeNull();
    expect(validateBuild(UPGRADED_BUILD)).toBeNull();
    expect(validateBuild({ ...DEFAULT_BUILD, wheels: "arm_sample" })).toMatch(/does not fit/);
    expect(validateBuild({ ...DEFAULT_BUILD, camera: "mystery_cam" as never })).toMatch(/not available/);
    expect(validateBuild(HEAVY_BUILD)).toBe(
      `The rover weighs ${BASE_SYSTEM_MASS + 36} kg. The launch limit is ${MAX_LAUNCH_MASS} kg. Remove something heavy.`,
    );
    expect(validateBuild(MAXED_BUILD)).toBe(
      `That build costs ${designStats(MAXED_BUILD).cost} credits. The spending limit is ${DESIGN_BUDGET}. Pick a cheaper part.`,
    );
  });

  it("requires upgrades, a landing place, and a science focus before launch", () => {
    expect(canLaunch(makeDesign(DEFAULT_BUILD, "sunny", "rocks"))).toMatch(
      new RegExp(`at least ${MIN_UPGRADES} upgrades`),
    );
    expect(canLaunch(makeDesign(UPGRADED_BUILD, null, "rocks"))).toMatch(/landing place/);
    expect(canLaunch(makeDesign(UPGRADED_BUILD, "rocky", null))).toMatch(/science focus/);
    expect(canLaunch(READY_DESIGN)).toBeNull();
    expect(canLaunch(makeDesign(HEAVY_BUILD, "sunny", "rocks"))).toMatch(/launch limit/);
  });

  it("derives starting money, weight, battery, and time from the design", () => {
    expect(initialResources(makeDesign(UPGRADED_BUILD, "sunny", "rocks"))).toEqual({
      budget: STARTING_BUDGET - 37,
      mass: 46,
      power: STARTING_POWER,
      data: 0,
      comms: STARTING_COMMS,
      time: MISSION_TIME_SECONDS,
    });
    expect(initialResources(makeDesign(UPGRADED_BUILD, "dunes", "weather")).power).toBe(
      STARTING_POWER - 8,
    );
  });
});

describe("build effects and science timing", () => {
  it("turns upgrades and science focus into concrete benefits", () => {
    const basic = buildEffects(makeDesign(DEFAULT_BUILD, "sunny", null));
    expect(basic.speedMultiplier).toBe(1);
    expect(basic.batteryDrainMultiplier).toBe(1);
    expect(basic.commsDrainMultiplier).toBe(1);
    expect(basic.stormProtection).toBe(false);
    expect(basic.roughTerrainProtection).toBe(false);
    expect(basic.actionMultiplier).toEqual({ rocks: 1, soil: 1, soilResearch: 1, weather: 1 });

    const upgraded = buildEffects(makeDesign(MAXED_BUILD, "sunny", "rocks"));
    expect(upgraded.speedMultiplier).toBeCloseTo(1.16);
    expect(upgraded.batteryDrainMultiplier).toBeCloseTo(0.8 * 0.92);
    expect(upgraded.commsDrainMultiplier).toBeCloseTo(0.72);
    expect(upgraded.stormProtection).toBe(true);
    expect(upgraded.roughTerrainProtection).toBe(true);
    expect(upgraded.actionMultiplier.rocks).toBeCloseTo(0.92 * 0.94 * 0.85 * 0.78 * 0.82);
    expect(upgraded.actionMultiplier.soil).toBeCloseTo(0.92 * 0.8);
    expect(upgraded.actionMultiplier.soilResearch).toBeCloseTo(0.7);
    expect(upgraded.actionMultiplier.weather).toBeCloseTo(0.95);
  });

  it("shortens work from parts, landing-site bonuses, and the planner boost", () => {
    const mission = createMission("mission-1", READY_DESIGN, 1_000);
    const rock = mission.objectives.find((objective) => objective.id === "rock_crater")!;
    const transmit = mission.objectives.find((objective) => objective.kind === "transmit")!;

    expect(objectiveDuration(transmit, mission, 1_000)).toBe(transmit.duration);
    expect(objectiveDuration(rock, mission, 1_000)).toBeCloseTo(
      3.2 * 0.92 * 0.85 * 0.82 * 0.82,
    );

    mission.boostUntil = 2_000;
    expect(objectiveDuration(rock, mission, 1_500)).toBeCloseTo(
      3.2 * 0.92 * 0.85 * 0.82 * 0.82 * 0.62,
    );
    expect(objectiveDuration(rock, mission, 2_500)).toBeCloseTo(
      3.2 * 0.92 * 0.85 * 0.82 * 0.82,
    );

    const rockMission = createMission("mission-2", makeDesign(DEFAULT_BUILD, "rocky", null), 0);
    expect(objectiveDuration(rockMission.objectives[0]!, rockMission, 0)).toBeCloseTo(3.2 * 0.82);

    const weatherMission = createMission("mission-3", makeDesign(DEFAULT_BUILD, "dunes", null), 0);
    const weather = weatherMission.objectives.find((objective) => objective.id === "weather_ridge")!;
    expect(objectiveDuration(weather, weatherMission, 0)).toBeCloseTo(2.6 * 0.82);
  });
});

describe("science goals and unlocking", () => {
  it("builds eight field goals plus the final transmission", () => {
    const objectives = createObjectives();
    expect(objectives).toHaveLength(FIELD_OBJECTIVES.length + 1);
    expect(objectives.filter((objective) => objective.kind === "soilResearch")).toHaveLength(2);
    expect(objectives.filter((objective) => objective.kind === "transmit")).toHaveLength(1);

    const transmit = objectives.find((objective) => objective.kind === "transmit")!;
    expect(transmit).toMatchObject({
      x: TRANSMIT_POSITION.x,
      y: TRANSMIT_POSITION.y,
      completed: false,
      unlocked: false,
    });

    for (const lab of objectives.filter((objective) => objective.kind === "soilResearch")) {
      expect(lab.unlocked).toBe(false);
      expect(lab.unlockHint).toMatch(/soil samples/);
    }
    for (const objective of objectives.filter((entry) => entry.kind !== "soilResearch" && entry.kind !== "transmit")) {
      expect(objective.unlocked).toBe(true);
    }
  });

  it("reports progress for each of the four science goals", () => {
    const mission = createMission("mission-4", READY_DESIGN, 0);
    expect(scienceStatus(mission.objectives).map((goal) => [goal.id, goal.complete, goal.target, goal.done])).toEqual([
      ["rocks", 0, 2, false],
      ["soil", 0, 2, false],
      ["soilResearch", 0, 2, false],
      ["weather", 0, 2, false],
    ]);

    complete(mission, ["rock_crater", "soil_dune", "weather_ridge"]);
    const partial = scienceStatus(mission.objectives);
    expect(partial.find((goal) => goal.id === "rocks")).toMatchObject({ complete: 1, target: 2, done: false });
    expect(partial.find((goal) => goal.id === "soil")).toMatchObject({ complete: 1, target: 2, done: false });
    expect(partial.find((goal) => goal.id === "weather")).toMatchObject({ complete: 1, target: 2, done: false });
    expect(scienceCollected(mission.objectives)).toBe(3);
  });

  it("opens the lab after both soil samples and transmission after all science", () => {
    const mission = createMission("mission-5", READY_DESIGN, 0);
    const fieldIds = FIELD_OBJECTIVES.map((objective) => objective.id);
    const soilIds = FIELD_OBJECTIVES.filter((objective) => objective.kind === "soil").map(
      (objective) => objective.id,
    );

    complete(mission, soilIds);
    refreshObjectiveLocks(mission);
    for (const lab of mission.objectives.filter((objective) => objective.kind === "soilResearch")) {
      expect(lab.unlocked).toBe(true);
    }
    expect(mission.objectives.find((objective) => objective.kind === "transmit")?.unlocked).toBe(false);

    complete(mission, soilIds);
    refreshObjectiveLocks(mission);
    expect(mission.objectives.find((objective) => objective.kind === "transmit")?.unlocked).toBe(false);

    complete(mission, fieldIds);
    refreshObjectiveLocks(mission);
    expect(mission.objectives.find((objective) => objective.kind === "transmit")?.unlocked).toBe(true);
    expect(scienceStatus(mission.objectives).every((goal) => goal.done)).toBe(true);
  });
});

describe("crew decisions", () => {
  it("deep-copies event content and starts with a 60 second discussion", () => {
    const event = createActiveEvent(EVENTS[0]!, 5_000);
    expect(event).toMatchObject({
      id: EVENTS[0]!.id,
      votes: {},
      opensAt: 5_000,
      deadline: 65_000,
      resolveAt: null,
      resolution: "open",
      finalizedBy: null,
    });
    expect(event.choices).toHaveLength(3);
    expect(event.choices.map((choice) => choice.id)).toContain(event.recommendedChoiceId);
    event.choices[0]!.bullets.push("changed in a test");
    expect(EVENTS[0]!.choices[0]!.bullets).not.toContain("changed in a test");
  });

  it("keeps the five events understandable and internally consistent", () => {
    expect(EVENTS).toHaveLength(5);
    expect(EVENTS.map((event) => event.order)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(EVENTS.map((event) => event.id)).size).toBe(5);
    const roles = new Set<RoleId>(["engineer", "satellite", "finance", "designer"]);
    for (const event of EVENTS) {
      expect(event.choices).toHaveLength(3);
      expect(event.roleAdvisory.text.length).toBeGreaterThan(10);
      expect(roles.has(event.roleAdvisory.role)).toBe(true);
      expect(event.choices.some((choice) => choice.id === event.recommendedChoiceId)).toBe(true);
      for (const choice of event.choices) {
        expect(choice.label.length).toBeGreaterThan(2);
        expect(choice.detail.length).toBeGreaterThan(10);
        expect(choice.bullets.length).toBeGreaterThan(0);
        expect(Object.keys(choice.effects).length).toBeGreaterThan(0);
      }
    }
  });

  it("applies plain choice effects with no crew bonuses", () => {
    const context = {
      roles: new Set<RoleId>(),
      design: makeDesign(DEFAULT_BUILD, "sunny", null),
      eventId: "dust_storm",
      now: 7_000,
    };
    const result = resolveEventEffects(EVENTS[0]!, "push", context);
    expect(result).not.toBeNull();
    expect(result!.effects).toEqual({ power: -12, comms: -10 });
    expect(result!.outcome).toMatchObject({
      eventId: "dust_storm",
      choiceId: "push",
      choiceLabel: "Keep driving",
      modifiers: ["The crew handled it together."],
      at: 7_000,
    });
    expect(resolveEventEffects(EVENTS[0]!, "not-a-choice", context)).toBeNull();
  });

  it("lets parts and jobs soften or strengthen the same choice", () => {
    const fortified = resolveEventEffects(EVENTS[0]!, "shelter", {
      roles: new Set<RoleId>(),
      design: makeDesign({ ...DEFAULT_BUILD, body: "body_armored" }, "dunes", null),
      eventId: "dust_storm",
      now: 0,
    });
    expect(fortified!.effects).toEqual({ time: -25, power: -2, comms: 5 });
    expect(fortified!.modifiers).toContain("Dusty Dunes made the storm a little worse.");
    expect(fortified!.modifiers).toContain("The armored body protected the rover.");

    const rugged = resolveEventEffects(EVENTS[1]!, "cross", {
      roles: new Set<RoleId>(["engineer"]),
      design: makeDesign({ ...DEFAULT_BUILD, wheels: "wheels_allterrain" }, "sunny", null),
      eventId: "rocky_slope",
      now: 0,
    });
    // Wheels soften every loss; the builder softens power losses again.
    expect(rugged!.effects).toEqual({ power: -7, comms: -3, time: -4 });
    expect(rugged!.modifiers).toContain("The all-terrain wheels handled the rocks well.");

    const antenna = resolveEventEffects(EVENTS[3]!, "priority", {
      roles: new Set<RoleId>(["designer"]),
      design: makeDesign({ ...DEFAULT_BUILD, antenna: "antenna_longrange" }, "sunny", null),
      eventId: "weak_signal",
      now: 0,
    });
    expect(antenna!.effects).toEqual({ comms: 26, time: -13 });
    expect(antenna!.modifiers).toContain("The long-range antenna boosted the signal.");
    expect(antenna!.modifiers).toContain("The Mission Planner found time in the schedule.");

    const battery = resolveEventEffects(EVENTS[4]!, "rest", {
      roles: new Set<RoleId>(),
      design: makeDesign({ ...DEFAULT_BUILD, power: "power_longlife" }, "sunny", null),
      eventId: "low_battery",
      now: 0,
    });
    expect(battery!.effects).toEqual({ power: 23, time: -30 });
    expect(battery!.modifiers).toContain("The long-life battery recovered extra power.");
  });

  it("clamps resources after applying an outcome", () => {
    expect(
      applyEffects(
        { budget: 10, mass: 50, power: 95, data: 7, comms: 98, time: 470 },
        { budget: -20, mass: 20, power: 20, data: -9, comms: 10, time: 40 },
      ),
    ).toEqual({
      budget: 0,
      mass: MAX_LAUNCH_MASS + 8,
      power: 100,
      data: 0,
      comms: 100,
      time: MAX_MISSION_TIME,
    });
  });
});

describe("mission results", () => {
  it("calls a stopped mission partial if four or more results were collected", () => {
    const empty = createMission("mission-6", READY_DESIGN, 0);
    expect(failureOutcome(empty)).toBe("failure");
    complete(empty, ["rock_crater", "rock_shelf", "soil_dune", "soil_cache"]);
    expect(failureOutcome(empty)).toBe("partial");
  });

  it("builds distinct success, partial, and failure debriefs with real stats", () => {
    const mission = createMission("mission-7", READY_DESIGN, 1_000);
    complete(
      mission,
      mission.objectives.map((objective) => objective.id),
    );
    mission.resources = { budget: 40, mass: 46, power: 50, data: 8, comms: 60, time: 120 };
    mission.eventsResolved = 2;
    const decision = resolveEventEffects(EVENTS[0]!, "shelter", {
      roles: new Set<RoleId>(),
      design: mission.design,
      eventId: "dust_storm",
      now: 0,
    })!.outcome;
    mission.decisions.push(decision);

    const success = computeResult(mission, "success", "All four science goals are complete.", 9_000);
    expect(success).toMatchObject({
      outcome: "success",
      success: true,
      headline: "MISSION SUCCESS!",
      reason: "All four science goals are complete.",
      score: 2_295,
      grade: "A",
      completedAt: 9_000,
    });
    expect(success.stats).toEqual({
      objectivesComplete: 8,
      objectivesTotal: 8,
      rocks: 2,
      soil: 2,
      soilResearch: 2,
      weather: 2,
      scienceCollected: 8,
      scienceTarget: 8,
      eventsResolved: 2,
      eventsTotal: 5,
      samples: 4,
      powerRemaining: 50,
      timeRemaining: 120,
      budgetRemaining: 40,
      weight: 46,
      landingSite: "rocky",
      scienceFocus: "rocks",
    });
    expect(success.decisions).toHaveLength(1);
    expect(success.decisions[0]!.choiceLabel).toBe("Wait it out");

    const partial = computeResult(mission, "partial", "The timer ran out.", 9_500);
    expect(partial).toMatchObject({ outcome: "partial", success: false, headline: "PARTIAL SUCCESS" });
    expect(partial.score).toBe(success.score - 480);

    const failure = computeResult(mission, "failure", "The battery ran out.", 10_000);
    expect(failure).toMatchObject({ outcome: "failure", success: false, headline: "MISSION FAILED" });
    expect(failure.score).toBeLessThan(partial.score);
  });

  it("formats the mission clock without negative times", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(MISSION_TIME_SECONDS)).toBe("6:00");
    expect(formatClock(-12)).toBe("0:00");
  });
});
