import type {
  ComponentDefinition,
  ComponentId,
  ComponentSlot,
  ComponentSlotDefinition,
  LandingSiteDefinition,
  MissionEventDefinition,
  RoleDefinition,
  RoverBuild,
  ScienceCategory,
} from "./types";
import { WORLD_HEIGHT, WORLD_WIDTH } from "./types";

export const ROLES: readonly RoleDefinition[] = [
  {
    id: "engineer",
    name: "Rover Builder",
    shortName: "BUILDER",
    characterId: "nia",
    color: "#c76537",
    accent: "#f0b64b",
    tagline: "You build the rover that will explore Mars.",
    description:
      "Pick the parts, keep the rover light enough to launch, and repair it when the road gets rough.",
    firstTask: "Open the Rover tab and choose at least two upgrades.",
    ability: {
      name: "Quick Repair",
      description: "Fix the rover and get 18% battery back.",
      cooldownSeconds: 40,
    },
    passive: "Your careful repairs also make every battery action a little safer.",
    brief: "Build a tough, light rover and keep it running in the field.",
  },
  {
    id: "satellite",
    name: "Mars Explorer",
    shortName: "EXPLORER",
    characterId: "ren",
    color: "#2e8c80",
    accent: "#6adbe0",
    tagline: "You choose where to land and how to explore.",
    description:
      "Compare landing places, watch the weather, and help the team find a safe route across the basin.",
    firstTask: "Open the Landing tab and compare the three landing places.",
    ability: {
      name: "Weather Check",
      description: "Read the sky and recover 18% signal for the team.",
      cooldownSeconds: 45,
    },
    passive: "You spot safe routes, so rough ground is a little less risky.",
    brief: "Pick a safe landing place and keep an eye on the Martian sky.",
  },
  {
    id: "finance",
    name: "Budget Manager",
    shortName: "BUDGET",
    characterId: "val",
    color: "#6f3344",
    accent: "#e7b34b",
    tagline: "You make sure the team can afford the mission.",
    description:
      "Watch the price of every part, keep some money in reserve, and approve a rover the team can actually pay for.",
    firstTask: "Open the Budget tab and keep the build under the spending limit.",
    ability: {
      name: "Open Reserve",
      description: "Release 12 credits for an emergency repair.",
      cooldownSeconds: 50,
    },
    passive: "You always find a little extra value in a tight budget.",
    brief: "Keep the build affordable without leaving the crew short.",
  },
  {
    id: "designer",
    name: "Mission Planner",
    shortName: "PLANNER",
    characterId: "samir",
    color: "#344a67",
    accent: "#dfcfb0",
    tagline: "You decide what the rover should study first.",
    description:
      "Choose the team's science focus, watch the clock, and keep everyone working on the most important goal.",
    firstTask: "Open the Science tab and pick the team's science focus.",
    ability: {
      name: "Focus the Team",
      description: "Science actions finish faster for 20 seconds.",
      cooldownSeconds: 45,
    },
    passive: "A clear plan makes every science action slightly quicker.",
    brief: "Pick the science focus and help the crew use its time well.",
  },
] as const;

export const COMPONENT_SLOTS: readonly ComponentSlotDefinition[] = [
  { id: "body", name: "Body", question: "How much protection does the rover need?" },
  { id: "wheels", name: "Wheels", question: "What kind of ground will it drive on?" },
  { id: "suspension", name: "Suspension", question: "How steady should the ride be?" },
  { id: "arm", name: "Robotic arm", question: "How will it pick up samples?" },
  { id: "camera", name: "Camera", question: "How closely should it study rocks?" },
  { id: "instruments", name: "Mini lab", question: "How fast can it test soil?" },
  { id: "power", name: "Power", question: "How long should the battery last?" },
  { id: "antenna", name: "Antenna", question: "How strong should the signal be?" },
] as const;

export const COMPONENTS: readonly ComponentDefinition[] = [
  {
    id: "body_light",
    slot: "body",
    name: "Light Body",
    shortName: "Light",
    description: "A simple frame that keeps the rover easy to launch.",
    benefit: "Uses less battery",
    tradeoff: "Less protection in a dust storm",
    cost: 6,
    mass: 8,
    level: 0,
    file: "equipment/chassis.png",
    slotIcon: "equipment/chassis.png",
  },
  {
    id: "body_armored",
    slot: "body",
    name: "Armored Body",
    shortName: "Armored",
    description: "A stronger shell that shields the equipment inside.",
    benefit: "Storm damage is reduced",
    tradeoff: "Heavier and more expensive",
    cost: 12,
    mass: 14,
    level: 1,
    file: "equipment/chassis.png",
    slotIcon: "equipment/chassis.png",
  },
  {
    id: "wheels_standard",
    slot: "wheels",
    name: "Standard Wheels",
    shortName: "Standard",
    description: "Reliable wheels for gentle, sandy ground.",
    benefit: "Light and cheap",
    tradeoff: "Slow on rocky ground",
    cost: 4,
    mass: 4,
    level: 0,
    file: "equipment/drive.png",
    slotIcon: "equipment/drive.png",
  },
  {
    id: "wheels_allterrain",
    slot: "wheels",
    name: "All-Terrain Wheels",
    shortName: "All-terrain",
    description: "Wide, grippy wheels that climb over rocks.",
    benefit: "Move faster over rough ground",
    tradeoff: "Costs more and adds weight",
    cost: 9,
    mass: 6,
    level: 1,
    file: "equipment/drive.png",
    slotIcon: "equipment/drive.png",
  },
  {
    id: "suspension_basic",
    slot: "suspension",
    name: "Basic Suspension",
    shortName: "Basic",
    description: "A simple spring system for a smooth, light rover.",
    benefit: "Fewer parts to carry",
    tradeoff: "A bumpier ride on rocks",
    cost: 3,
    mass: 2,
    level: 0,
    file: "equipment/suspension.png",
    slotIcon: "equipment/suspension.png",
  },
  {
    id: "suspension_rocker",
    slot: "suspension",
    name: "Rocker Suspension",
    shortName: "Rocker",
    description: "Linked arms that keep all six wheels on the ground.",
    benefit: "Steadier on rough ground",
    tradeoff: "More weight and cost",
    cost: 7,
    mass: 4,
    level: 1,
    file: "equipment/suspension.png",
    slotIcon: "equipment/suspension.png",
  },
  {
    id: "arm_basic",
    slot: "arm",
    name: "Simple Scoop",
    shortName: "Scoop",
    description: "A small scoop for basic soil samples.",
    benefit: "Light and reliable",
    tradeoff: "Samples take longer",
    cost: 2,
    mass: 1,
    level: 0,
    file: "equipment/arm.png",
    slotIcon: "equipment/arm.png",
  },
  {
    id: "arm_sample",
    slot: "arm",
    name: "Sample Arm",
    shortName: "Sample arm",
    description: "A drill and scoop that collect samples quickly.",
    benefit: "Rock and soil samples are faster",
    tradeoff: "Adds a little weight and cost",
    cost: 6,
    mass: 2,
    level: 1,
    file: "equipment/arm.png",
    slotIcon: "equipment/arm.png",
  },
  {
    id: "camera_basic",
    slot: "camera",
    name: "Basic Camera",
    shortName: "Basic",
    description: "A small camera for simple pictures of the ground.",
    benefit: "Light and cheap",
    tradeoff: "Rock studies take longer",
    cost: 2,
    mass: 1,
    level: 0,
    file: "ui/marker_scan.png",
    slotIcon: "ui/marker_scan.png",
  },
  {
    id: "camera_research",
    slot: "camera",
    name: "Research Camera",
    shortName: "Research",
    description: "A sharp camera that can study rock layers up close.",
    benefit: "Rock studies are faster",
    tradeoff: "Uses a little more money",
    cost: 5,
    mass: 2,
    level: 1,
    file: "ui/marker_scan.png",
    slotIcon: "ui/marker_scan.png",
  },
  {
    id: "instruments_basic",
    slot: "instruments",
    name: "Soil Test Kit",
    shortName: "Test kit",
    description: "A basic kit for checking whether soil could support plants.",
    benefit: "Can run soil tests",
    tradeoff: "Soil tests take longer",
    cost: 4,
    mass: 2,
    level: 0,
    file: "equipment/spectrometer.png",
    slotIcon: "equipment/spectrometer.png",
  },
  {
    id: "instruments_lab",
    slot: "instruments",
    name: "Mini Science Lab",
    shortName: "Mini lab",
    description: "A compact lab that studies soil much faster.",
    benefit: "Soil tests finish quickly",
    tradeoff: "Heavier and more expensive",
    cost: 9,
    mass: 4,
    level: 1,
    file: "equipment/spectrometer.png",
    slotIcon: "equipment/spectrometer.png",
  },
  {
    id: "power_standard",
    slot: "power",
    name: "Standard Battery",
    shortName: "Standard",
    description: "A dependable battery for a normal day on Mars.",
    benefit: "Light and affordable",
    tradeoff: "Runs out sooner",
    cost: 5,
    mass: 4,
    level: 0,
    file: "equipment/power.png",
    slotIcon: "equipment/power.png",
  },
  {
    id: "power_longlife",
    slot: "power",
    name: "Long-Life Battery",
    shortName: "Long-life",
    description: "A bigger battery that keeps the rover working for longer.",
    benefit: "Battery drains more slowly",
    tradeoff: "Adds weight and cost",
    cost: 10,
    mass: 6,
    level: 1,
    file: "equipment/power.png",
    slotIcon: "equipment/power.png",
  },
  {
    id: "antenna_basic",
    slot: "antenna",
    name: "Simple Antenna",
    shortName: "Simple",
    description: "A small antenna for staying in touch with home.",
    benefit: "Light and easy to fit",
    tradeoff: "Signal fades faster",
    cost: 2,
    mass: 1,
    level: 0,
    file: "equipment/antenna.png",
    slotIcon: "equipment/antenna.png",
  },
  {
    id: "antenna_longrange",
    slot: "antenna",
    name: "Long-Range Antenna",
    shortName: "Long-range",
    description: "A taller dish that holds the signal across the basin.",
    benefit: "Signal lasts longer",
    tradeoff: "Uses more money and weight",
    cost: 6,
    mass: 2,
    level: 1,
    file: "equipment/antenna.png",
    slotIcon: "equipment/antenna.png",
  },
] as const;

export const DEFAULT_BUILD: RoverBuild = {
  body: "body_light",
  wheels: "wheels_standard",
  suspension: "suspension_basic",
  arm: "arm_basic",
  camera: "camera_basic",
  instruments: "instruments_basic",
  power: "power_standard",
  antenna: "antenna_basic",
};

export const SCIENCE_GOALS: readonly {
  id: ScienceCategory;
  name: string;
  shortName: string;
  question: string;
  action: string;
  icon: string;
}[] = [
  {
    id: "rocks",
    name: "Study rocks",
    shortName: "Rocks",
    question: "What are the rocks on Mars made of?",
    action: "Scan two rock formations",
    icon: "props/mars/sample_rock.png",
  },
  {
    id: "soil",
    name: "Study soil",
    shortName: "Soil",
    question: "What is the soil like?",
    action: "Collect two soil samples",
    icon: "equipment/arm.png",
  },
  {
    id: "soilResearch",
    name: "Test the soil",
    shortName: "Soil test",
    question: "Could the soil ever help grow food?",
    action: "Run two soil tests in the mini lab",
    icon: "equipment/spectrometer.png",
  },
  {
    id: "weather",
    name: "Study the weather",
    shortName: "Weather",
    question: "How strong are the winds and dust storms?",
    action: "Take two weather readings",
    icon: "equipment/weather.png",
  },
] as const;

export const LANDING_SITES: readonly LandingSiteDefinition[] = [
  {
    id: "sunny",
    name: "Sunny Flats",
    shortName: "Sunny Flats",
    description: "Wide, flat ground. The safest place to put the rover down.",
    pros: ["Safest landing", "Easy driving", "Full starting battery"],
    cons: ["No science bonus"],
    scienceNote: "A calm place to start exploring.",
    risk: "Low",
    x: 146,
    y: 386,
  },
  {
    id: "rocky",
    name: "Rocky Basin",
    shortName: "Rocky Basin",
    description: "Lots of interesting rocks, but the ground is bumpy.",
    pros: ["Rock studies are faster", "Plenty of samples"],
    cons: ["Rough ground", "Slightly less starting battery"],
    scienceNote: "Best for the rock goal.",
    risk: "Medium",
    x: 302,
    y: 300,
  },
  {
    id: "dunes",
    name: "Dusty Dunes",
    shortName: "Dusty Dunes",
    description: "Open sand and strong winds. Great for weather science.",
    pros: ["Weather readings are faster", "Open sky for the antenna"],
    cons: ["Dust storms hit harder", "Slightly less starting battery"],
    scienceNote: "Best for the weather goal.",
    risk: "High",
    x: 430,
    y: 224,
  },
] as const;

export const DESIGN_BUDGET = 58;
export const MIN_UPGRADES = 2;
export const MAX_LAUNCH_MASS = 54;
export const BASE_SYSTEM_MASS = 20;
export const STARTING_BUDGET = 100;
export const MISSION_TIME_SECONDS = 360;
export const STARTING_POWER = 100;
export const STARTING_COMMS = 100;
export const EVENT_DISCUSSION_MS = 60_000;
export const EVENT_RESOLVE_DELAY_MS = 1_500;

export interface FieldObjectiveDefinition {
  id: string;
  kind: ScienceCategory;
  name: string;
  shortName: string;
  description: string;
  x: number;
  y: number;
  duration: number;
  powerCost: number;
  unlockHint: string;
}

export const LANDER_POSITION = { x: 178, y: 474 } as const;
export const ROVER_POSITION = { x: 250, y: 505 } as const;
export const TRANSMIT_POSITION = { x: 196, y: 512 } as const;
export const SCIENTIST_POSITION = { x: 214, y: 500 } as const;

export const FIELD_OBJECTIVES: readonly FieldObjectiveDefinition[] = [
  {
    id: "rock_crater",
    kind: "rocks",
    name: "Crater Rim Rocks",
    shortName: "Crater rocks",
    description: "Layered rocks at the edge of an old crater. Scan them with the camera.",
    x: 176,
    y: 158,
    duration: 3.2,
    powerCost: 3,
    unlockHint: "",
  },
  {
    id: "rock_shelf",
    kind: "rocks",
    name: "Split Rock Shelf",
    shortName: "Split rocks",
    description: "A broken shelf that shows two different rock layers.",
    x: 800,
    y: 492,
    duration: 3.2,
    powerCost: 3,
    unlockHint: "",
  },
  {
    id: "soil_dune",
    kind: "soil",
    name: "Dune Soil",
    shortName: "Dune soil",
    description: "Soft sand and dust near the dune crest. Scoop a sample.",
    x: 832,
    y: 178,
    duration: 3,
    powerCost: 2,
    unlockHint: "",
  },
  {
    id: "soil_cache",
    kind: "soil",
    name: "Old Supply Soil",
    shortName: "Old soil",
    description: "Soil beside an old supply cache. Collect a second sample.",
    x: 96,
    y: 366,
    duration: 3,
    powerCost: 2,
    unlockHint: "",
  },
  {
    id: "soil_lab_a",
    kind: "soilResearch",
    name: "Mini Lab: First Test",
    shortName: "Lab test 1",
    description: "Test the first soil sample for minerals and nutrients.",
    x: 216,
    y: 548,
    duration: 4,
    powerCost: 4,
    unlockHint: "Collect both soil samples first.",
  },
  {
    id: "soil_lab_b",
    kind: "soilResearch",
    name: "Mini Lab: Second Test",
    shortName: "Lab test 2",
    description: "Run a second test to see whether the soil could ever support plants.",
    x: 368,
    y: 548,
    duration: 4,
    powerCost: 4,
    unlockHint: "Collect both soil samples first.",
  },
  {
    id: "weather_ridge",
    kind: "weather",
    name: "Ridge Weather Station",
    shortName: "Ridge weather",
    description: "A weather mast on the ridge. Record the wind and dust.",
    x: 472,
    y: 110,
    duration: 2.6,
    powerCost: 2,
    unlockHint: "",
  },
  {
    id: "weather_dune",
    kind: "weather",
    name: "Dune Weather Station",
    shortName: "Dune weather",
    description: "A second mast in the open dunes. Compare the wind here.",
    x: 912,
    y: 320,
    duration: 2.6,
    powerCost: 2,
    unlockHint: "",
  },
] as const;

export const SPAWN_POINTS = [
  { x: 296, y: 520 },
  { x: 318, y: 500 },
  { x: 274, y: 544 },
  { x: 338, y: 532 },
] as const;

export const EVENTS: readonly MissionEventDefinition[] = [
  {
    id: "dust_storm",
    order: 1,
    title: "Dust Storm!",
    question: "The wind is getting stronger. What should we do?",
    body: "A wall of dust is moving across the basin. It is getting hard to see.",
    visual: "dust",
    roleAdvisory: {
      role: "satellite",
      text: "The weather team says the storm should ease after a short wait.",
    },
    roleInsights: [
      { role: "engineer", text: "Our body panels can keep the dust out, but the camera will struggle." },
      { role: "satellite", text: "The wind should ease soon. Waiting is the safer choice." },
      { role: "finance", text: "Waiting costs a little battery, but repairs cost much more." },
      { role: "designer", text: "We have enough time for a short delay." },
    ],
    recommendedChoiceId: "shelter",
    choices: [
      {
        id: "shelter",
        label: "Wait it out",
        detail: "Seal the rover and let the worst of the dust pass.",
        bullets: ["Keeps the rover safe", "Takes about half a minute", "Uses a little battery"],
        effects: { time: -25, power: -2, comms: 5 },
      },
      {
        id: "push",
        label: "Keep driving",
        detail: "Drive slowly through the dust and keep the mission moving.",
        bullets: ["No time lost", "Uses a lot of battery", "The signal gets weaker"],
        effects: { power: -12, comms: -10 },
      },
      {
        id: "scan_sky",
        label: "Check the weather",
        detail: "Ask the weather station how long the storm will last.",
        bullets: ["Costs some signal", "Gives the team useful information", "Uses a little battery"],
        effects: { comms: -8, time: -12, power: -1 },
      },
    ],
    learnMore:
      "Mars has dust storms that can cover the whole planet. They are not like Earth hurricanes: the wind is thin, but the dust can still block sunlight and cameras.",
  },
  {
    id: "rocky_slope",
    order: 2,
    title: "Rocky Path",
    question: "The path ahead is rough. How should we get across?",
    body: "A rocky slope blocks the shortest route to the next science site.",
    visual: "terrain",
    roleAdvisory: {
      role: "engineer",
      text: "The arm can clear the worst rocks if we take it slowly.",
    },
    roleInsights: [
      { role: "engineer", text: "The arm can push the loose rocks aside." },
      { role: "satellite", text: "I can see a flatter route to the north." },
      { role: "finance", text: "A broken wheel would cost more than a short detour." },
      { role: "designer", text: "We can still reach every science site today." },
    ],
    recommendedChoiceId: "clear",
    choices: [
      {
        id: "detour",
        label: "Take the safer route",
        detail: "Drive around the slope on flatter ground.",
        bullets: ["Very low risk", "Takes an extra half-minute", "Uses a little battery"],
        effects: { time: -30, power: -3 },
      },
      {
        id: "cross",
        label: "Drive over the rocks",
        detail: "Trust the wheels and cross the slope carefully.",
        bullets: ["Fast", "Risks the wheels", "Uses battery"],
        effects: { power: -10, comms: -4, time: -5 },
      },
      {
        id: "clear",
        label: "Clear a path",
        detail: "Use the robotic arm to move the loose rocks.",
        bullets: ["Makes the crossing safer", "Uses the arm", "Costs time and a few credits"],
        effects: { time: -18, power: -6, budget: -4 },
      },
    ],
    learnMore:
      "Mars rovers use six wheels and a rocker-bogie suspension to keep moving over uneven ground. Driving around a hazard is often faster than repairing a broken wheel.",
  },
  {
    id: "scanner_fault",
    order: 3,
    title: "Equipment Problem",
    question: "The soil scanner has stopped working. What should we do?",
    body: "A warning light is blinking on the mini lab. The next soil test will not start.",
    visual: "equipment",
    roleAdvisory: {
      role: "engineer",
      text: "A quick repair should work, but the spare parts are not free.",
    },
    roleInsights: [
      { role: "engineer", text: "I can open the case and reset the scanner." },
      { role: "satellite", text: "The backup scanner is ready, but it is expensive to use." },
      { role: "finance", text: "We have enough reserve for one repair or one backup unit." },
      { role: "designer", text: "Skipping the test would leave one science goal unfinished." },
    ],
    recommendedChoiceId: "repair",
    choices: [
      {
        id: "repair",
        label: "Repair the scanner",
        detail: "Open the case and try to fix it with the spare parts.",
        bullets: ["Cheapest fix", "Takes a little time", "Could work perfectly"],
        effects: { budget: -6, power: -5, time: -8 },
      },
      {
        id: "backup",
        label: "Use the backup scanner",
        detail: "Swap in the spare unit and keep testing.",
        bullets: ["Works right away", "Costs more money", "No repair time"],
        effects: { budget: -10, power: -2 },
      },
      {
        id: "skip",
        label: "Skip this test",
        detail: "Move on and try to find another way to finish the science goal.",
        bullets: ["No repair cost", "Takes time to move on", "The soil goal may be delayed"],
        effects: { time: -12, power: -2 },
      },
    ],
    learnMore:
      "Scientific instruments can fail in harsh conditions. Real rover teams often use backups and careful testing instead of trying risky repairs far from home.",
  },
  {
    id: "weak_signal",
    order: 4,
    title: "Weak Signal",
    question: "Sending results home is getting difficult. What should we do?",
    body: "The rover is collecting information, but the link to Earth is fading.",
    visual: "signal",
    roleAdvisory: {
      role: "designer",
      text: "Waiting for a clear pass is slow, but it gets the most results home.",
    },
    roleInsights: [
      { role: "engineer", text: "The antenna is fine. This is about where we are, not the hardware." },
      { role: "satellite", text: "A hill to the east should give us a cleaner view of the sky." },
      { role: "finance", text: "Sending the most important results first protects our science." },
      { role: "designer", text: "We have time to wait for one clear pass." },
    ],
    recommendedChoiceId: "wait",
    choices: [
      {
        id: "priority",
        label: "Send the best results first",
        detail: "Choose the most important pictures and measurements.",
        bullets: ["Protects the science", "Uses less signal", "Takes some time"],
        effects: { comms: 22, time: -15 },
      },
      {
        id: "hill",
        label: "Drive to higher ground",
        detail: "Move the rover to a place with a clearer view of the sky.",
        bullets: ["Improves the signal", "Uses battery", "Takes a little time"],
        effects: { comms: 18, time: -25, power: -4 },
      },
      {
        id: "wait",
        label: "Wait for a clear pass",
        detail: "Pause and send everything when the link is strong.",
        bullets: ["Best signal", "Takes the most time", "Uses very little battery"],
        effects: { comms: 30, time: -30, power: 4 },
      },
    ],
    learnMore:
      "Mars and Earth are far apart, so messages take minutes to arrive. Rovers often wait for a clear line to an orbiting relay before sending their results.",
  },
  {
    id: "low_battery",
    order: 5,
    title: "Battery Warning",
    question: "The rover is low on power. What should we keep running?",
    body: "The battery light is flashing. There is enough power for one more push, or a careful recharge.",
    visual: "battery",
    roleAdvisory: {
      role: "finance",
      text: "Spending a little time to recharge is cheaper than losing the rover.",
    },
    roleInsights: [
      { role: "engineer", text: "The battery is low, but a short rest will help it recover." },
      { role: "satellite", text: "The sun should be strong for the next few minutes." },
      { role: "finance", text: "A dead rover costs us everything. A short rest costs only time." },
      { role: "designer", text: "We still have time for one careful stop." },
    ],
    recommendedChoiceId: "rest",
    choices: [
      {
        id: "rest",
        label: "Stop and recharge",
        detail: "Power down the tools and let the battery recover.",
        bullets: ["Battery recovers", "Science work pauses", "Takes about half a minute"],
        effects: { power: 20, time: -30 },
      },
      {
        id: "push",
        label: "Keep working",
        detail: "Leave the tools on and finish the next task before stopping.",
        bullets: ["No time lost", "Battery keeps falling", "The signal gets weaker"],
        effects: { power: -10, comms: -5 },
      },
      {
        id: "return",
        label: "Return to the lander",
        detail: "Drive back to the lander for a full recharge.",
        bullets: ["Largest battery recovery", "Takes the most time", "Safe choice"],
        effects: { power: 32, time: -38 },
      },
    ],
    learnMore:
      "Solar panels do not work as well when dust covers them. Rover teams balance science work against the power they need to stay warm, drive, and send messages home.",
  },
] as const;

export const QUICK_COMMS = [
  "On my way.",
  "I found something!",
  "Battery is getting low.",
  "Let's finish the science goals.",
] as const;

export const WORLD = { width: WORLD_WIDTH, height: WORLD_HEIGHT } as const;

export function roleById(id: string | null): RoleDefinition | undefined {
  return ROLES.find((role) => role.id === id);
}

export function componentById(id: string): ComponentDefinition | undefined {
  return COMPONENTS.find((component) => component.id === id);
}

export function componentsForSlot(slot: ComponentSlot): ComponentDefinition[] {
  return COMPONENTS.filter((component) => component.slot === slot);
}

export function landingSiteById(id: string | null): LandingSiteDefinition | undefined {
  return LANDING_SITES.find((site) => site.id === id);
}

export function scienceGoalById(id: ScienceCategory) {
  return SCIENCE_GOALS.find((goal) => goal.id === id);
}

export const RESOURCE_META = [
  {
    id: "budget",
    label: "Money",
    short: "Money",
    unit: "credits",
    icon: "ui/resource_budget.png",
    explanation: "Used to buy parts and pay for repairs.",
  },
  {
    id: "mass",
    label: "Weight",
    short: "Weight",
    unit: "kg",
    icon: "ui/resource_mass.png",
    explanation: "A heavy rover is harder to launch.",
  },
  {
    id: "power",
    label: "Battery",
    short: "Battery",
    unit: "%",
    icon: "ui/resource_power.png",
    explanation: "Driving and science tools use battery.",
  },
  {
    id: "data",
    label: "Science results",
    short: "Science",
    unit: "results",
    icon: "ui/resource_data.png",
    explanation: "The four science goals add up to eight results.",
  },
  {
    id: "comms",
    label: "Signal",
    short: "Signal",
    unit: "%",
    icon: "ui/resource_comms.png",
    explanation: "A strong signal keeps the crew in touch with home.",
  },
  {
    id: "time",
    label: "Time",
    short: "Time",
    unit: "clock",
    icon: "ui/resource_time.png",
    explanation: "The mission ends when the clock reaches zero.",
  },
] as const;

export const REFERENCES = [
  {
    title: "NASA — Mars Facts",
    note: "Basic facts about Mars, its weather, and its distance from Earth.",
    url: "https://science.nasa.gov/mars/facts/",
  },
  {
    title: "NASA — Mars Exploration Program",
    note: "How robot explorers study the Red Planet.",
    url: "https://science.nasa.gov/mission/mars-exploration-program/",
  },
  {
    title: "NASA/JPL — Curiosity rover",
    note: "A real six-wheeled rover and the science it does.",
    url: "https://science.nasa.gov/mission/mars-science-laboratory-curiosity-rover/",
  },
  {
    title: "NASA — InSight mission",
    note: "A mission that listened to Mars and studied its weather.",
    url: "https://science.nasa.gov/mission/insight/",
  },
] as const;

export const DISCLAIMER =
  "RED FRONTIER is an original fictional game. It is not affiliated with, endorsed by, sponsored by, or produced by NASA. No NASA logo, photograph, patch, facility or employee likeness is used. All characters and hardware are fictional. Every resource, cost and mission value is a simplified educational gameplay value, not an operational specification.";
