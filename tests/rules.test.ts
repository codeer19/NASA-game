import { describe, expect, it } from "vitest";
import {
  BASE_SYSTEM_MASS,
  DATA_TARGET,
  DESIGN_BUDGET,
  EVENTS,
  FIELD_OBJECTIVES,
  MISSION_TIME_SECONDS,
  STARTING_COMMS,
  STARTING_POWER,
  TRANSMIT_POSITION,
} from "../shared/content";
import {
  applyEffects,
  canLaunch,
  computeScore,
  createActiveEvent,
  createMission,
  createObjectives,
  designStats,
  formatClock,
  initialResources,
  MAX_MISSION_TIME,
  moduleEffects,
  objectiveDuration,
  resolveEventEffects,
  validateModuleSelection,
} from "../shared/rules";
import type { DesignPublic, ModuleId, RoleId } from "../shared/types";

const DESIGN: DesignPublic = designStats(["suspension", "arm", "weather"]);

describe("payload design rules", () => {
  it("sums module cost and mass", () => {
    expect(DESIGN).toEqual({ modules: ["suspension", "arm", "weather"], cost: 27, mass: 27 });
  });

  it("rejects unknown, duplicate, and oversized payloads", () => {
    expect(validateModuleSelection(["suspension", "suspension"])).toMatch(/twice/);
    expect(validateModuleSelection(["suspension", "laser" as ModuleId])).toMatch(/Unknown/);
    expect(
      validateModuleSelection(["suspension", "arm", "spectrometer", "weather"]),
    ).toMatch(/at most/);
    expect(validateModuleSelection(["suspension", "arm", "weather"])).toBeNull();
  });

  it("keeps every legal three-module payload inside the credit cap", () => {
    const ids: ModuleId[] = ["suspension", "arm", "spectrometer", "weather"];
    for (let a = 0; a < ids.length; a += 1) {
      for (let b = a + 1; b < ids.length; b += 1) {
        for (let c = b + 1; c < ids.length; c += 1) {
          const selection = [ids[a]!, ids[b]!, ids[c]!];
          expect(designStats(selection).cost).toBeLessThanOrEqual(DESIGN_BUDGET);
          expect(canLaunch(selection)).toBeNull();
        }
      }
    }
  });

  it("requires at least two modules before launch", () => {
    expect(canLaunch(["suspension"])).toMatch(/at least/);
    expect(canLaunch(["suspension", "arm"])).toBeNull();
  });

  it("derives starting resources from the payload design", () => {
    const resources = initialResources(DESIGN.modules);
    expect(resources.budget).toBe(100 - DESIGN.cost);
    expect(resources.mass).toBe(100 - BASE_SYSTEM_MASS - DESIGN.mass);
    expect(resources.power).toBe(STARTING_POWER);
    expect(resources.comms).toBe(STARTING_COMMS);
    expect(resources.time).toBe(MISSION_TIME_SECONDS);
    expect(resources.data).toBe(0);
  });

  it("applies module multipliers and only speeds up sample objectives", () => {
    const effects = moduleEffects(DESIGN.modules);
    expect(effects.speedMultiplier).toBeCloseTo(1.18);
    expect(effects.sampleDurationMultiplier).toBeCloseTo(0.65);
    expect(effects.commsDrainMultiplier).toBeCloseTo(0.75);
    expect(effects.weatherProtection).toBe(true);

    const objectives = createObjectives();
    const sample = objectives.find((objective) => objective.kind === "sample");
    const relay = objectives.find((objective) => objective.kind === "relay");
    expect(sample).toBeDefined();
    expect(relay).toBeDefined();
    expect(objectiveDuration(sample!, DESIGN.modules)).toBeCloseTo(sample!.duration * 0.65);
    expect(objectiveDuration(relay!, DESIGN.modules)).toBe(relay!.duration);
  });
});

describe("mission setup", () => {
  it("creates five field objectives and a locked lander downlink", () => {
    const objectives = createObjectives();
    expect(objectives).toHaveLength(FIELD_OBJECTIVES.length + 1);
    expect(objectives.filter((objective) => objective.kind !== "transmit")).toHaveLength(5);
    const transmit = objectives.find((objective) => objective.kind === "transmit");
    expect(transmit).toMatchObject({
      unlocked: false,
      completed: false,
      x: TRANSMIT_POSITION.x,
      y: TRANSMIT_POSITION.y,
    });
  });

  it("snapshots the design and starts a clean mission log", () => {
    const now = 1_750_000_000_000;
    const mission = createMission("mission-test", DESIGN, now);
    expect(mission.missionId).toBe("mission-test");
    expect(mission.startedAt).toBe(now);
    expect(mission.elapsed).toBe(0);
    expect(mission.dataTarget).toBe(DATA_TARGET);
    expect(mission.eventsTotal).toBe(EVENTS.length);
    expect(mission.eventsResolved).toBe(0);
    expect(mission.activeEvent).toBeNull();
    expect(mission.result).toBeNull();
    expect(mission.design).toEqual(DESIGN);
    expect(mission.log).toEqual([]);
  });

  it("formats the mission clock with a floor and a zero floor", () => {
    expect(formatClock(360)).toBe("6:00");
    expect(formatClock(59.9)).toBe("0:59");
    expect(formatClock(-4)).toBe("0:00");
  });
});

describe("event resolution", () => {
  const dustFront = EVENTS.find((event) => event.id === "dust_front")!;
  const uplinkShadow = EVENTS.find((event) => event.id === "comm_shadow")!;

  it("trims negative effects with crew roles, weather, and rounding", () => {
    const result = resolveEventEffects(dustFront, "shelter", {
      roles: new Set<RoleId>(["engineer", "satellite"]),
      modules: ["weather"],
      eventId: dustFront.id,
    });
    expect(result).not.toBeNull();
    // -40s time softened 20% by the weather mast, -4 power softened 20% by the engineer.
    expect(result!.effects.time).toBe(-32);
    expect(result!.effects.power).toBe(-3);
    expect(result!.modifiers).toEqual(
      expect.arrayContaining([
        "ENGINEER — field protocols trim 20% of power loss.",
        "WEATHER MAST — storm telemetry softens the penalty.",
      ]),
    );
    expect(new Set(result!.modifiers).size).toBe(result!.modifiers.length);
  });

  it("boosts positive comms recovery for the satellite controller", () => {
    const result = resolveEventEffects(uplinkShadow, "burst", {
      roles: new Set<RoleId>(["satellite"]),
      modules: [],
      eventId: uplinkShadow.id,
    });
    expect(result!.effects.power).toBe(-15);
    expect(result!.effects.comms).toBe(38);
    expect(result!.modifiers).toContain("SATELLITE — clean uplink boosts comms recovery.");
  });

  it("applies no weather bonus outside storm events", () => {
    const result = resolveEventEffects(uplinkShadow, "window", {
      roles: new Set<RoleId>(),
      modules: ["weather"],
      eventId: uplinkShadow.id,
    });
    expect(result!.effects).toEqual({ time: -45, data: 6, power: 6 });
    expect(result!.modifiers).toEqual(["No crew bonus applied."]);
  });

  it("reports when no crew bonus applies and rejects unknown choices", () => {
    const result = resolveEventEffects(dustFront, "push", {
      roles: new Set<RoleId>(),
      modules: [],
      eventId: dustFront.id,
    });
    expect(result!.modifiers).toEqual(["No crew bonus applied."]);
    expect(resolveEventEffects(dustFront, "teleport", {
      roles: new Set<RoleId>(),
      modules: [],
      eventId: dustFront.id,
    })).toBeNull();
  });

  it("opens an event with a thirty second vote window", () => {
    const now = 1_750_000_000_000;
    const active = createActiveEvent(dustFront, now);
    expect(active.deadline).toBe(now + 30_000);
    expect(active.opensAt).toBe(now);
    expect(active.resolveAt).toBeNull();
    expect(active.resolution).toBe("open");
    expect(active.votes).toEqual({});
    expect(active.choices).toHaveLength(dustFront.choices.length);
  });
});

describe("resource and scoring rules", () => {
  it("clamps resources to gameplay ranges", () => {
    const next = applyEffects(
      { budget: 10, mass: 5, power: 95, data: 2, comms: 3, time: MAX_MISSION_TIME - 5 },
      { budget: -100, mass: 20, power: 30, data: -20, comms: -50, time: 90 },
    );
    expect(next).toEqual({
      budget: 0,
      mass: 25,
      power: 100,
      data: 0,
      comms: 0,
      time: MAX_MISSION_TIME,
    });
  });

  it("scores a successful mission above a failed one with equal state", () => {
    const mission = createMission("mission-score", DESIGN, 0);
    mission.resources = { budget: 40, mass: 60, power: 55, data: 49, comms: 80, time: 90 };
    mission.eventsResolved = 4;
    mission.objectives[0]!.completed = true;
    mission.objectives[1]!.completed = true;

    const success = computeScore(mission, true, "Science package downlinked.", 1);
    const failure = computeScore(mission, false, "Mission clock expired.", 1);
    expect(success.success).toBe(true);
    expect(success.headline).toBe("SCIENCE PACKAGE RECEIVED");
    expect(success.stats.objectivesComplete).toBe(2);
    expect(success.stats.samples).toBe(1);
    expect(success.score - failure.score).toBe(600);
    expect(["S", "A", "B", "C", "D"]).toContain(success.grade);
  });
});
