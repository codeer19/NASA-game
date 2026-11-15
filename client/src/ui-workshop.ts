import {
  BASE_SYSTEM_MASS,
  COMPONENT_SLOTS,
  DESIGN_BUDGET,
  LANDING_SITES,
  MAX_LAUNCH_MASS,
  MIN_UPGRADES,
  SCIENCE_GOALS,
  STARTING_BUDGET,
  componentById,
  componentsForSlot,
  landingSiteById,
  roleById,
  scienceGoalById,
} from "../../shared/content";
import { canLaunch } from "../../shared/rules";
import type {
  ComponentDefinition,
  ComponentSlot,
  RoomPublic,
  ScienceCategory,
} from "../../shared/types";
import {
  SLOT_LABEL,
  SLOT_ORDER,
  asset,
  buildHighlights,
  componentCount,
  esc,
  launchChecks,
  rolePortrait,
} from "./ui-format";

export type WorkshopTab = "build" | "landing" | "budget" | "science";

export interface WorkshopRender {
  stats: string;
  tabs: string;
  body: string;
  actions: string;
}

const TABS: Array<{ id: WorkshopTab; label: string; roleId: keyof typeof ROLE_TAB_LABELS; blurb: string }> = [
  { id: "build", label: "Build", roleId: "engineer", blurb: "Rover Builder" },
  { id: "landing", label: "Landing", roleId: "satellite", blurb: "Mars Explorer" },
  { id: "budget", label: "Budget", roleId: "finance", blurb: "Budget Manager" },
  { id: "science", label: "Science", roleId: "designer", blurb: "Mission Planner" },
];

const ROLE_TAB_LABELS = {
  engineer: "Rover Builder",
  satellite: "Mars Explorer",
  finance: "Budget Manager",
  designer: "Mission Planner",
} as const;

const ROLE_TO_TAB: Record<keyof typeof ROLE_TAB_LABELS, WorkshopTab> = {
  engineer: "build",
  satellite: "landing",
  finance: "budget",
  designer: "science",
};

const SITE_ICON: Record<string, string> = {
  sunny: "ui/marker_objective.png",
  rocky: "props/mars/rock_cluster.png",
  dunes: "equipment/weather.png",
};

const SITE_RISK: Record<string, string> = {
  Low: "risk-low",
  Medium: "risk-medium",
  High: "risk-high",
};

function statsHtml(room: RoomPublic): string {
  const design = room.design;
  const costPct = Math.min(100, Math.round((design.cost / DESIGN_BUDGET) * 100));
  const weightPct = Math.min(100, Math.round((design.weight / MAX_LAUNCH_MASS) * 100));
  const upgradePct = Math.min(100, Math.round((design.upgrades / MIN_UPGRADES) * 100));
  return `
    <div class="work-stat ${design.cost > DESIGN_BUDGET ? "is-over" : ""}">
      <span>Money used</span>
      <strong>${design.cost}<small> / ${DESIGN_BUDGET}</small></strong>
      <i class="work-meter"><b style="width:${costPct}%"></b></i>
    </div>
    <div class="work-stat ${design.weight > MAX_LAUNCH_MASS ? "is-over" : ""}">
      <span>Launch weight</span>
      <strong>${design.weight}<small> / ${MAX_LAUNCH_MASS} kg</small></strong>
      <i class="work-meter"><b style="width:${weightPct}%"></b></i>
    </div>
    <div class="work-stat ${design.upgrades < MIN_UPGRADES ? "is-warn" : ""}">
      <span>Upgrades</span>
      <strong>${design.upgrades}<small> / ${MIN_UPGRADES} min</small></strong>
      <i class="work-meter"><b style="width:${upgradePct}%"></b></i>
    </div>
    <div class="work-stat">
      <span>Slots fitted</span>
      <strong>8<small> / 8</small></strong>
      <i class="work-meter"><b style="width:100%"></b></i>
    </div>`;
}

function tabsHtml(room: RoomPublic, playerId: string | null, tab: WorkshopTab): string {
  const me = room.players.find((player) => player.id === playerId);
  const myTab = me?.role ? ROLE_TO_TAB[me.role] : null;
  return TABS.map((entry, index) => `
    <button class="worktab ${entry.id === tab ? "is-active" : ""} ${entry.id === myTab ? "is-your-job" : ""}"
      type="button" data-worktab="${entry.id}" aria-pressed="${entry.id === tab}">
      <span class="worktab-index">${index + 1}</span>
      <span class="worktab-copy">
        <b>${entry.label}</b>
        <small>${entry.blurb}</small>
      </span>
      ${entry.id === myTab ? `<span class="your-job">Your job</span>` : ""}
    </button>`).join("");
}

function slotPin(slot: ComponentSlot, room: RoomPublic, selectedSlot: ComponentSlot): string {
  const component = componentById(room.design.components[slot]);
  return `
    <button class="slot-pin pin-${slot} ${slot === selectedSlot ? "is-active" : ""}"
      type="button" data-slot="${slot}" title="Change ${SLOT_LABEL[slot]}">
      <img src="${asset(component?.slotIcon ?? "equipment/chassis.png")}" alt="" width="32" height="32" />
      <span>${SLOT_LABEL[slot]}</span>
    </button>`;
}

function partOption(
  option: ComponentDefinition,
  current: ComponentDefinition | undefined,
  design: RoomPublic["design"],
  slot: ComponentSlot,
): string {
  const selected = current?.id === option.id;
  const currentCost = current?.cost ?? 0;
  const currentMass = current?.mass ?? 0;
  const nextCost = design.cost - currentCost + option.cost;
  const nextWeight = design.weight - currentMass + option.mass;
  const overBudget = nextCost > DESIGN_BUDGET;
  const overWeight = nextWeight > MAX_LAUNCH_MASS;
  const blocked = overBudget || overWeight;
  const deltaCost = option.cost - currentCost;
  const deltaMass = option.mass - currentMass;
  const deltaLabel = `${deltaCost === 0 ? "same cost" : `${deltaCost > 0 ? "+" : ""}${deltaCost} credits`} · ${
    deltaMass === 0 ? "same weight" : `${deltaMass > 0 ? "+" : ""}${deltaMass} kg`
  }`;
  const blockNote = overBudget
    ? `This would use ${nextCost} credits. The limit is ${DESIGN_BUDGET}. Choose a cheaper part somewhere else first.`
    : overWeight
      ? `This would make the rover ${nextWeight} kg. The launch limit is ${MAX_LAUNCH_MASS} kg.`
      : "";
  return `
    <article class="part-option ${selected ? "is-selected" : ""} ${blocked && !selected ? "is-blocked" : ""}">
      <header>
        <img src="${asset(option.slotIcon)}" alt="" width="32" height="32" />
        <div>
          <h3>${esc(option.name)}</h3>
          <span class="part-level">${option.level === 0 ? "Starter part" : "Upgrade part"}</span>
        </div>
        <span class="part-price">${option.cost}<small> credits</small></span>
      </header>
      <p>${esc(option.description)}</p>
      <div class="tradeoff-grid">
        <span class="tradeoff good"><b>Good:</b> ${esc(option.benefit)}</span>
        <span class="tradeoff cost"><b>Trade-off:</b> ${esc(option.tradeoff)}</span>
      </div>
      <footer>
        <span class="delta-label">${esc(deltaLabel)} · ${option.mass} kg part</span>
        ${
          selected
            ? `<span class="selected-label">Fitted now</span>`
            : `<button class="secondary-button compact" type="button"
                data-component="${option.id}" data-component-slot="${slot}"
                ${blocked ? "disabled" : ""}>
                Fit this part
              </button>`
        }
      </footer>
      ${blockNote && !selected ? `<p class="block-note">${esc(blockNote)}</p>` : ""}
    </article>`;
}

function buildBody(room: RoomPublic, playerId: string | null, selectedSlot: ComponentSlot): string {
  const design = room.design;
  const current = componentById(design.components[selectedSlot]);
  const options = componentsForSlot(selectedSlot);
  const slotDef = COMPONENT_SLOTS.find((slot) => slot.id === selectedSlot);
  const me = room.players.find((player) => player.id === playerId);
  const isBuilder = me?.role === "engineer";
  const highlight = buildHighlights(design);
  return `
    <div class="build-layout">
      <section class="rover-preview">
        <div class="rover-board">
          <div class="rover-halo" aria-hidden="true"></div>
          <img class="rover-base" src="${asset("rover/rover_assembled.png")}" alt="The crew's rover" width="96" height="64" />
          ${SLOT_ORDER.map((slot) => slotPin(slot, room, selectedSlot)).join("")}
        </div>
        <p class="preview-hint">Tap a glowing part to change it. The rover picture updates with your choices.</p>
        <div class="build-highlights">
          <span class="soft-label">What this build is good at</span>
          ${highlight.map((entry) => `<span class="highlight-chip">${esc(entry)}</span>`).join("")}
        </div>
        <p class="build-count">${esc(componentCount(design))} · ${BASE_SYSTEM_MASS} kg of base systems</p>
        ${isBuilder ? `<div class="job-callout"><b>Rover Builder:</b> You don't have to pick everything yourself, but keep an eye on the weight and the two-upgrade minimum.</div>` : ""}
      </section>
      <section class="part-picker">
        <div class="picker-heading">
          <span class="eyebrow">CHOOSING</span>
          <h2>${esc(slotDef?.name ?? SLOT_LABEL[selectedSlot])}</h2>
          <p>${esc(slotDef?.question ?? "Which part should the rover carry?")}</p>
        </div>
        <div class="option-grid">
          ${options.map((option) => partOption(option, current, design, selectedSlot)).join("")}
        </div>
      </section>
    </div>`;
}

function landingBody(room: RoomPublic, playerId: string | null): string {
  const me = room.players.find((player) => player.id === playerId);
  const isExplorer = me?.role === "satellite";
  return `
    <div class="work-section-head">
      <div>
        <span class="eyebrow">LANDING PLACE</span>
        <h2>Where should the rover touch down?</h2>
        <p>Each place changes your starting battery and what is easier to study. Any crew member can choose.</p>
      </div>
      ${isExplorer ? `<div class="job-callout"><b>Mars Explorer:</b> Compare all three. Your pick is the crew's best guess at a safe, useful landing.</div>` : `<span class="soft-label">The Mars Explorer compares the weather and ground.</span>`}
    </div>
    <div class="site-grid">
      ${LANDING_SITES.map((site) => {
        const selected = room.design.landingSite === site.id;
        return `
          <button class="site-card ${selected ? "is-selected" : ""}" type="button" data-site="${site.id}" aria-pressed="${selected}">
            <span class="site-art site-${site.id}">
              <img src="${asset(SITE_ICON[site.id] ?? "ui/marker_objective.png")}" alt="" width="32" height="32" />
              <i></i><i></i><i></i>
            </span>
            <span class="site-card-head">
              <span><strong>${esc(site.name)}</strong><small>${esc(site.scienceNote)}</small></span>
              <span class="risk-badge ${SITE_RISK[site.risk] ?? ""}">${site.risk} risk</span>
            </span>
            <span class="site-description">${esc(site.description)}</span>
            <span class="site-pros-cons">
              ${site.pros.map((pro) => `<span class="pro">+ ${esc(pro)}</span>`).join("")}
              ${site.cons.map((con) => `<span class="con">− ${esc(con)}</span>`).join("")}
            </span>
            <span class="site-select">${selected ? "Landing here" : "Choose this place"}</span>
          </button>`;
      }).join("")}
    </div>`;
}

function budgetBody(room: RoomPublic, playerId: string | null): string {
  const design = room.design;
  const me = room.players.find((player) => player.id === playerId);
  const isBudget = me?.role === "finance";
  const moneyLeft = Math.max(0, STARTING_BUDGET - design.cost);
  return `
    <div class="work-section-head">
      <div>
        <span class="eyebrow">BUDGET</span>
        <h2>Every part has a price.</h2>
        <p>The crew starts with ${STARTING_BUDGET} credits. Parts come out of that money, and repairs during the mission cost more.</p>
      </div>
      ${isBudget ? `<div class="job-callout"><b>Budget Manager:</b> Keep a little money in reserve. A cheap fix now can save the mission later.</div>` : `<span class="soft-label">The Budget Manager watches the reserve.</span>`}
    </div>
    <div class="budget-layout">
      <div class="budget-ledger">
        <div class="ledger-head"><span>Part</span><span>Cost</span><span>Weight</span></div>
        ${SLOT_ORDER.map((slot) => {
          const component = componentById(design.components[slot]);
          return `<div class="ledger-row">
            <span><img src="${asset(component?.slotIcon ?? "equipment/chassis.png")}" alt="" width="16" height="16" /> ${esc(component?.name ?? SLOT_LABEL[slot])}</span>
            <span>${component?.cost ?? 0} cr</span>
            <span>${component?.mass ?? 0} kg</span>
          </div>`;
        }).join("")}
        <div class="ledger-row ledger-total"><span>Rover parts</span><span>${design.cost} cr</span><span>${design.weight - BASE_SYSTEM_MASS} kg</span></div>
        <div class="ledger-row ledger-base"><span>Base systems</span><span>—</span><span>${BASE_SYSTEM_MASS} kg</span></div>
      </div>
      <div class="budget-cards">
        <div class="money-card">
          <span>Money left after launch</span>
          <strong>${moneyLeft}<small> credits</small></strong>
          <p>Repairs and emergency choices use this reserve. The mission can still succeed with an empty reserve, but it is safer to keep some.</p>
        </div>
        <div class="money-card">
          <span>Launch weight</span>
          <strong>${design.weight}<small> / ${MAX_LAUNCH_MASS} kg</small></strong>
          <p>Samples add a little weight during the mission. Staying under the limit keeps the launch safe.</p>
        </div>
        <div class="money-card">
          <span>Upgrades</span>
          <strong>${design.upgrades}<small> / ${MIN_UPGRADES} min</small></strong>
          <p>An upgrade is any part marked "Upgrade part." You need at least two before launch.</p>
        </div>
      </div>
    </div>`;
}

function scienceBody(room: RoomPublic, playerId: string | null): string {
  const design = room.design;
  const me = room.players.find((player) => player.id === playerId);
  const isPlanner = me?.role === "designer";
  return `
    <div class="work-section-head">
      <div>
        <span class="eyebrow">SCIENCE GOALS</span>
        <h2>Four questions for the crew to answer.</h2>
        <p>You complete these by walking to markers on Mars. The focus only makes one kind of science finish faster.</p>
      </div>
      ${isPlanner ? `<div class="job-callout"><b>Mission Planner:</b> Pick the focus that matches the crew's plan. Every goal still needs to be finished.</div>` : `<span class="soft-label">The Mission Planner keeps the crew on time.</span>`}
    </div>
    <div class="focus-grid">
      ${SCIENCE_GOALS.map((goal) => {
        const selected = design.scienceFocus === goal.id;
        return `
          <button class="focus-card ${selected ? "is-selected" : ""}" type="button" data-focus="${goal.id}" aria-pressed="${selected}">
            <img src="${asset(goal.icon)}" alt="" width="48" height="48" />
            <span class="focus-copy">
              <strong>${esc(goal.name)}</strong>
              <small>${esc(goal.question)}</small>
              <span>${esc(goal.action)}</span>
            </span>
            <span class="focus-pick">${selected ? "Focus chosen" : "Focus on this"}</span>
          </button>`;
      }).join("")}
    </div>
    <div class="focus-note">
      <b>Why focus?</b> The chosen kind of science finishes about 18% faster. The other three goals are still required.
    </div>`;
}

function actionsHtml(room: RoomPublic, playerId: string | null): string {
  const me = room.players.find((player) => player.id === playerId) ?? null;
  const connected = room.players.filter((player) => player.connected);
  const allReady = connected.length > 0 && connected.every((player) => player.ready);
  const error = canLaunch(room.design);
  const isHost = me?.host ?? false;
  const disabled = !isHost || !allReady || Boolean(error);
  const checks = launchChecks(room.design).slice(0, 3);
  const readinessText = error
    ? error
    : !allReady
      ? `${connected.filter((player) => player.ready).length} of ${connected.length} crew ready`
      : "All crew ready";
  return `
    <div class="launch-readiness">
      ${checks.map((check) => `<span class="ready-check ${check.ok ? "ok" : ""}">${check.ok ? "✓" : "•"} ${esc(check.label)}</span>`).join("")}
      <span class="ready-state ${allReady && !error ? "good" : ""}">${esc(readinessText)}</span>
    </div>
    <div class="launch-buttons">
      <button class="secondary-button" type="button" data-action="toggle-ready">
        ${me?.ready ? "Ready — undo" : "I'm ready"}
      </button>
      ${
        isHost
          ? `<button class="primary-button" type="button" data-action="start-mission" ${disabled ? "disabled" : ""}>Launch to Mars</button>`
          : `<span class="waiting-note">${esc(room.players.find((player) => player.host)?.name ?? "The host")} starts the launch.</span>`
      }
    </div>`;
}

export function renderWorkshop(
  room: RoomPublic,
  playerId: string | null,
  tab: WorkshopTab,
  selectedSlot: ComponentSlot,
): WorkshopRender {
  let body = "";
  if (tab === "build") body = buildBody(room, playerId, selectedSlot);
  else if (tab === "landing") body = landingBody(room, playerId);
  else if (tab === "budget") body = budgetBody(room, playerId);
  else body = scienceBody(room, playerId);

  return {
    stats: statsHtml(room),
    tabs: tabsHtml(room, playerId, tab),
    body,
    actions: actionsHtml(room, playerId),
  };
}

export function rolePortraitForWorkshop(roleId: string): string {
  return rolePortrait(roleId as never);
}

export function focusLabel(category: ScienceCategory | null): string {
  return category ? scienceGoalById(category)?.shortName ?? "Chosen" : "Not chosen";
}

export function siteLabel(siteId: string | null): string {
  return landingSiteById(siteId)?.shortName ?? "Not chosen";
}

export function roleTaskLine(roleId: string | null): string {
  return roleById(roleId)?.firstTask ?? "Pick a job in the lobby.";
}
