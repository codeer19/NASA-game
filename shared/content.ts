import type {
  MissionEventDefinition,
  ModuleDefinition,
  ObjectiveKind,
  RoleDefinition,
} from "./types";
import { WORLD_HEIGHT, WORLD_WIDTH } from "./types";

export const ROLES: readonly RoleDefinition[] = [
  {
    id: "engineer",
    name: "Aerospace Engineer",
    shortName: "ENGINEER",
    characterId: "nia",
    color: "#c76537",
    accent: "#f0b64b",
    ability: {
      name: "Field Repair",
      description: "Patch the rover bus and recover 20 power.",
      cooldownSeconds: 45,
    },
    passive: "Life-support load: rover power drain reduced 15%.",
    brief:
      "Keep the rover alive. Field repairs restore power; hard use costs less on your watch.",
  },
  {
    id: "satellite",
    name: "Mars Satellite Controller",
    shortName: "SATELLITE",
    characterId: "ren",
    color: "#2e8c80",
    accent: "#6adbe0",
    ability: {
      name: "Uplink Sweep",
      description: "Reacquire the orbital relay and recover 28 comms.",
      cooldownSeconds: 50,
    },
    passive: "Signal discipline: comms decay reduced 25%.",
    brief:
      "Own the link between the surface crew and orbit. Call uplinks before the signal gutter.",
  },
  {
    id: "finance",
    name: "Finance Administrator",
    shortName: "FINANCE",
    characterId: "val",
    color: "#6f3344",
    accent: "#e7b34b",
    ability: {
      name: "Requisition",
      description: "Release an emergency reserve of 15 credits.",
      cooldownSeconds: 55,
    },
    passive: "Fiscal control: negative event budget effects reduced 20%.",
    brief:
      "Protect the mission reserve. Every credit spent on a workaround is a credit not spent on science.",
  },
  {
    id: "designer",
    name: "Mission Designer",
    shortName: "DESIGNER",
    characterId: "samir",
    color: "#344a67",
    accent: "#dfcfb0",
    ability: {
      name: "Route Pulse",
      description: "Push a route plan to the crew: +25% speed for 15 seconds.",
      cooldownSeconds: 45,
    },
    passive: "Schedule control: negative event time effects reduced 20%.",
    brief:
      "Read the terrain and the clock together. Share a route pulse when the team needs to move.",
  },
] as const;

export const MODULES: readonly ModuleDefinition[] = [
  {
    id: "suspension",
    name: "Terrain Bogie",
    category: "MOBILITY",
    description: "Wide rocker-bogie linkages and torque-balanced wheels.",
    effect: "+18% traverse speed across regolith and rock shelves.",
    cost: 9,
    mass: 12,
    file: "equipment/suspension.png",
  },
  {
    id: "arm",
    name: "Sample Arm",
    category: "FIELD SCIENCE",
    description: "A compact drill, scoop and close-up imaging turret.",
    effect: "Field samples complete 35% faster. +2 data per sample.",
    cost: 11,
    mass: 9,
    file: "equipment/arm.png",
  },
  {
    id: "spectrometer",
    name: "Spectrometer",
    category: "FIELD SCIENCE",
    description: "A simplified mineral-composition instrument package.",
    effect: "+4 data from each sample. Better final science grade.",
    cost: 8,
    mass: 8,
    file: "equipment/spectrometer.png",
  },
  {
    id: "weather",
    name: "Weather Mast",
    category: "SURVIVABILITY",
    description: "Wind, pressure and opacity sensors on a folding mast.",
    effect: "Comms decay reduced 25%. Dust and flare penalties softened.",
    cost: 7,
    mass: 6,
    file: "equipment/weather.png",
  },
] as const;

export const DESIGN_BUDGET = 30;
export const MIN_MODULES = 2;
export const MAX_MODULES = 3;
export const BASE_SYSTEM_MASS = 42;
export const MISSION_TIME_SECONDS = 360;
export const DATA_TARGET = 30;
export const STARTING_POWER = 100;
export const STARTING_COMMS = 100;

export interface FieldObjectiveDefinition {
  id: string;
  kind: ObjectiveKind;
  name: string;
  shortName: string;
  description: string;
  x: number;
  y: number;
  duration: number;
  dataReward: number;
  powerCost: number;
  commsGain?: number;
  budgetGain?: number;
  timeGain?: number;
}

export const LANDER_POSITION = { x: 178, y: 474 } as const;
export const ROVER_POSITION = { x: 250, y: 505 } as const;
export const TRANSMIT_POSITION = { x: 196, y: 512 } as const;

export const FIELD_OBJECTIVES: readonly FieldObjectiveDefinition[] = [
  {
    id: "crater_core",
    kind: "sample",
    name: "Crater Rim Core",
    shortName: "CRATER CORE",
    description:
      "A layered rim outcrop at the edge of an old impact crater. Drill a shallow core.",
    x: 176,
    y: 158,
    duration: 5,
    dataReward: 10,
    powerCost: 7,
  },
  {
    id: "ridge_relay",
    kind: "relay",
    name: "Ridge Relay",
    shortName: "RIDGE RELAY",
    description:
      "A dust-buried relay mast with a degraded alignment. Re-establish the surface link.",
    x: 472,
    y: 94,
    duration: 4.5,
    dataReward: 5,
    powerCost: 8,
    commsGain: 30,
  },
  {
    id: "dune_spectral",
    kind: "sample",
    name: "Dune Spectral Patch",
    shortName: "DUNE PATCH",
    description:
      "Freshly exposed dune sand above a buried ridge. Characterise the mineral bands.",
    x: 832,
    y: 178,
    duration: 5,
    dataReward: 10,
    powerCost: 7,
  },
  {
    id: "supply_cache",
    kind: "cache",
    name: "Supply Cache",
    shortName: "SUPPLY CACHE",
    description:
      "An unlogged cargo drop with usable cells and a mission clock beacon.",
    x: 96,
    y: 366,
    duration: 3.2,
    dataReward: 3,
    powerCost: 4,
    budgetGain: 14,
    timeGain: 30,
  },
  {
    id: "basalt_sample",
    kind: "sample",
    name: "Basalt Shelf Sample",
    shortName: "BASALT SHELF",
    description:
      "Fractured volcanic shelf with a clean contact between two rock units.",
    x: 800,
    y: 492,
    duration: 5,
    dataReward: 10,
    powerCost: 7,
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
    id: "dust_front",
    order: 1,
    title: "Dust Front",
    code: "MET-01",
    body:
      "A fast-moving dust front crosses the basin. Opacity is climbing and the horizon is disappearing. The crew can button up and lose clock time, or push through the degraded visibility.",
    fieldNote:
      "Local and global dust storms are a regular Mars weather hazard. Their duration can range from hours to weeks.",
    source: "NASA — Mars Facts",
    roleAdvisory: {
      role: "satellite",
      text: "The weather mast can read the front and trim the safe-shelter delay.",
    },
    choices: [
      {
        id: "shelter",
        label: "Button up",
        detail: "Stop, seal the rover and wait out the worst of the front.",
        effects: { time: -40, power: -4 },
      },
      {
        id: "push",
        label: "Push through",
        detail: "Keep the traverse moving at reduced visibility.",
        effects: { power: -13, comms: -12, data: 4 },
      },
    ],
  },
  {
    id: "comm_shadow",
    order: 2,
    title: "Uplink Shadow",
    code: "COM-02",
    body:
      "A ridge line blocks the orbital relay. The next pass is twenty minutes away. A burst transmission can force a link, but it will draw heavily from the rover bus.",
    fieldNote:
      "Mars–Earth one-way light time varies roughly between 3 and 22 minutes as the planets move in their orbits.",
    source: "NASA — Mars Facts",
    roleAdvisory: {
      role: "satellite",
      text: "Uplink Sweep can restore the link without spending the full power reserve.",
    },
    choices: [
      {
        id: "burst",
        label: "Force burst",
        detail: "Burn power to align the array and push a compressed packet to orbit.",
        effects: { power: -15, comms: 30 },
      },
      {
        id: "window",
        label: "Wait for pass",
        detail: "Power down the transmitter and preserve the bus.",
        effects: { time: -45, data: 6, power: 6 },
      },
    ],
  },
  {
    id: "wheel_fault",
    order: 3,
    title: "Bogie Fault",
    code: "MOB-03",
    body:
      "A drive actuator on the rear bogie is reporting an overload. Repair is possible in the field, but the spare seals are part of a limited reserve.",
    fieldNote:
      "Rocker-bogie suspensions are designed to keep wheels in contact over rough terrain while distributing loads across the chassis.",
    source: "NASA/JPL — Mars rover mobility",
    roleAdvisory: {
      role: "engineer",
      text: "The engineer can strip the overload and preserve mobility at a lower reserve cost.",
    },
    choices: [
      {
        id: "repair",
        label: "Field repair",
        detail: "Open the actuator housing and replace the worn seal.",
        effects: { budget: -18, power: -8 },
      },
      {
        id: "limp",
        label: "Limp mode",
        detail: "Isolate the actuator and accept a slower, cautious traverse.",
        effects: { time: -35, power: -3, comms: -4 },
      },
    ],
  },
  {
    id: "regolith_cache",
    order: 4,
    title: "Buried Cache",
    code: "SCI-04",
    body:
      "The spectrometer sees a concentration of hydrated minerals beneath a shallow dust layer. Excavating will take time and fill the sample bay; leaving it for a later mission protects the schedule.",
    fieldNote:
      "Hydrated minerals preserve evidence of ancient water on Mars and are a major target for surface spectroscopy.",
    source: "NASA — Mars science",
    roleAdvisory: {
      role: "designer",
      text: "A route pulse can buy back enough time to excavate without abandoning the schedule.",
    },
    choices: [
      {
        id: "excavate",
        label: "Excavate",
        detail: "Hold position, trench the deposit and seal a science sample.",
        effects: { time: -28, power: -7, data: 12, mass: -3 },
      },
      {
        id: "mark",
        label: "Mark for orbit",
        detail: "Geo-tag the cache and protect the remaining traverse clock.",
        effects: { budget: 8, comms: 8, data: 3 },
      },
    ],
  },
  {
    id: "solar_flare",
    order: 5,
    title: "Solar Flare",
    code: "RAD-05",
    body:
      "A radiation event is building on the solar monitors. The crew can power down under the shielded bus and lose mission time, or sustain the traverse and accept elevated exposure.",
    fieldNote:
      "Mars has a thin atmosphere and no global magnetic field, so surface radiation is a significant constraint for future crewed missions.",
    source: "NASA — Mars radiation environment",
    roleAdvisory: {
      role: "engineer",
      text: "A controlled power-down leaves the bus with more reserve after the event.",
    },
    choices: [
      {
        id: "shelter",
        label: "Power down",
        detail: "Shut systems into safe mode and wait for the particle count to fall.",
        effects: { time: -45, power: 12, comms: -5 },
      },
      {
        id: "ride",
        label: "Ride it out",
        detail: "Keep working behind the shielded bulkhead and accept the risk.",
        effects: { power: -12, comms: -20, data: 8 },
      },
    ],
  },
] as const;

export const QUICK_COMMS = [
  "Moving to the next site.",
  "Hold position — scanning.",
  "Power is getting low.",
  "Returning to the lander.",
] as const;

export const WORLD = { width: WORLD_WIDTH, height: WORLD_HEIGHT } as const;

export function roleById(id: string | null): RoleDefinition | undefined {
  return ROLES.find((role) => role.id === id);
}

export function moduleById(id: string): ModuleDefinition | undefined {
  return MODULES.find((module) => module.id === id);
}

export const RESOURCE_META = [
  { id: "budget", label: "Budget", unit: "cr", icon: "ui/resource_budget.png" },
  { id: "mass", label: "Mass margin", unit: "%", icon: "ui/resource_mass.png" },
  { id: "power", label: "Power", unit: "%", icon: "ui/resource_power.png" },
  { id: "data", label: "Data", unit: "TB", icon: "ui/resource_data.png" },
  { id: "comms", label: "Comms", unit: "%", icon: "ui/resource_comms.png" },
  { id: "time", label: "Time", unit: "clock", icon: "ui/resource_time.png" },
] as const;

export const REFERENCES = [
  {
    title: "NASA — Mars Facts",
    note: "Planetary facts including distance, light time, atmosphere and dust activity. Used as background for simplified field events.",
    url: "https://science.nasa.gov/mars/facts/",
  },
  {
    title: "NASA — Mars Exploration Program",
    note: "Overview of robotic Mars exploration and the science questions driving surface missions.",
    url: "https://science.nasa.gov/mission/mars-exploration-program/",
  },
  {
    title: "NASA/JPL — Curiosity rover",
    note: "Reference for rocker-bogie mobility, remote science operations and rover instrument families.",
    url: "https://science.nasa.gov/mission/mars-science-laboratory-curiosity-rover/",
  },
  {
    title: "NASA — InSight mission",
    note: "Reference for Mars weather, seismology and surface environment monitoring.",
    url: "https://science.nasa.gov/mission/insight/",
  },
  {
    title: "NASA — Artemis",
    note: "Background on crewed exploration planning and the operational discipline behind cooperative mission teams.",
    url: "https://www.nasa.gov/humans-in-space/artemis/",
  },
] as const;

export const DISCLAIMER =
  "RED FRONTIER is an original fictional game. It is not affiliated with, endorsed by, sponsored by, or produced by NASA. No NASA logo, photograph, mission patch, facility reconstruction, employee likeness, or mission data is used. All characters, organisations and hardware are fictional. Every resource, cost and mission value shown is a simplified educational gameplay value, not an operational specification.";
