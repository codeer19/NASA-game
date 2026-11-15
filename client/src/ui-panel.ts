import {
  QUICK_COMMS,
  SCIENCE_GOALS,
  landingSiteById,
  roleById,
  scienceGoalById,
} from "../../shared/content";
import { formatClock } from "../../shared/rules";
import type { MissionState, ObjectiveState, PlayerPublic } from "../../shared/types";
import type { GameState } from "./store";
import {
  actionVerb,
  asset,
  designSummary,
  esc,
  launchChecks,
  localPosition,
  nextAction,
  resourceRows,
  roleName,
  rolePortrait,
  scienceGoalRows,
  scienceTotal,
  storeMe,
} from "./ui-format";

export type PanelTab = "now" | "science" | "crew" | "log";

export interface HudRender {
  pips: string;
  action: string;
  resources: string;
}

export interface OverlayRender {
  kicker: string;
  promptHidden: boolean;
  promptTitle: string;
  promptSub: string;
  promptIcon: string;
  progressHidden: boolean;
  progressTitle: string;
  progressPct: string;
  progressFill: string;
  progressHint: string;
  coords: string;
}

export interface PanelRender {
  kicker: string;
  title: string;
  tabs: string;
  body: string;
  foot: string;
}

const OBJECTIVE_ICON: Record<string, string> = {
  rocks: "ui/marker_scan.png",
  soil: "equipment/arm.png",
  soilResearch: "equipment/spectrometer.png",
  weather: "equipment/weather.png",
  transmit: "equipment/antenna.png",
};

function sciencePips(mission: MissionState): string {
  const pips = scienceGoalRows(mission)
    .map(
      (goal) => `
      <span class="science-pip ${goal.done ? "is-done" : ""}" title="${esc(goal.name)}: ${goal.complete} of ${goal.target}">
        <img src="${asset(goal.icon)}" alt="" width="24" height="24" />
        <b>${goal.complete}/${goal.target}</b>
      </span>`,
    )
    .join("");
  return `${pips}<span class="science-total"><small>RESULTS</small><b>${scienceTotal(mission)}</b></span>`;
}

function resourceStrip(mission: MissionState): string {
  return resourceRows(mission)
    .map(
      (row) => `
      <span class="resource-pill tone-${row.tone}" title="${esc(row.label)}: ${esc(row.detail)}">
        <img src="${asset(row.icon)}" alt="" width="16" height="16" />
        <span class="resource-copy">
          <b>${esc(row.value)}</b>
          <small>${esc(row.short)}</small>
        </span>
      </span>`,
    )
    .join("");
}

function actionMarkup(state: GameState): string {
  const action = nextAction(state);
  return `
    <span class="next-kicker">NEXT</span>
    <span class="next-copy">
      <strong id="next-action-text">${esc(action.text)}</strong>
      <small id="next-action-hint">${esc(action.hint)}</small>
    </span>`;
}

export function renderHud(state: GameState): HudRender {
  const mission = state.mission;
  if (!mission) return { pips: "", action: "", resources: "" };
  return {
    pips: sciencePips(mission),
    action: actionMarkup(state),
    resources: resourceStrip(mission),
  };
}

function nearestObjectiveInRange(
  mission: MissionState,
  pos: { x: number; y: number } | null,
  range: number,
): ObjectiveState | null {
  if (!pos) return null;
  let best: ObjectiveState | null = null;
  let bestDistance = range;
  for (const objective of mission.objectives) {
    if (!objective.unlocked || objective.completed) continue;
    const distance = Math.hypot(pos.x - objective.x, pos.y - objective.y);
    if (distance <= bestDistance) {
      best = objective;
      bestDistance = distance;
    }
  }
  return best;
}

export function renderOverlay(state: GameState): OverlayRender {
  const mission = state.mission;
  const empty: OverlayRender = {
    kicker: "EXPLORING THE BASIN",
    promptHidden: true,
    promptTitle: "",
    promptSub: "",
    promptIcon: asset("ui/marker_objective.png"),
    progressHidden: true,
    progressTitle: "",
    progressPct: "0%",
    progressFill: "0%",
    progressHint: "",
    coords: "",
  };
  if (!mission) return empty;
  const pos = localPosition(state);
  const activeId = state.playerId ? state.positions[state.playerId]?.interacting ?? null : null;
  const active = activeId
    ? mission.objectives.find((objective) => objective.id === activeId && !objective.completed)
    : null;
  const near = active ?? nearestObjectiveInRange(mission, pos, 76);
  const working = near ? near.interactingCount > 0 : false;
  const showProgress = Boolean(near && (active || working));
  const pct = near ? Math.round(near.progress * 100) : 0;
  const action = near ? actionVerb(near.kind) : "Keep exploring";
  const collected = mission.science.reduce((sum, goal) => sum + goal.complete, 0);
  const allScience = mission.science.every((goal) => goal.done);
  const remaining = pos && near ? Math.max(1, Math.round(Math.hypot(pos.x - near.x, pos.y - near.y) / 2)) : null;
  const kicker = mission.result
    ? "MISSION COMPLETE"
    : mission.activeEvent
      ? "CREW DECISION IN PROGRESS"
      : allScience
        ? "FINAL STEP: SEND THE RESULTS HOME"
        : `SCIENCE ${collected} OF ${mission.dataTarget} · ${landingSiteById(mission.landingSite)?.shortName ?? "ARES BASIN"}`;

  return {
    kicker,
    promptHidden: !near || Boolean(active),
    promptTitle: near ? action : "",
    promptSub:
      near && remaining !== null
        ? `${near.shortName} · ${remaining} m away · press E`
        : near
          ? `${near.shortName} · press E`
          : "",
    promptIcon: near
      ? asset(OBJECTIVE_ICON[near.kind] ?? "ui/marker_objective.png")
      : empty.promptIcon,
    progressHidden: !showProgress,
    progressTitle: near ? `${near.shortName} · ${action}` : "",
    progressPct: `${pct}%`,
    progressFill: `${pct}%`,
    progressHint:
      showProgress && !active
        ? "A crew member is working here. Stand close and press E to help."
        : "Stay close to keep working. A nearby crew member helps it finish faster.",
    coords: pos ? `X ${Math.round(pos.x)} · Y ${Math.round(pos.y)}` : "Finding your crew marker…",
  };
}

function missionResources(mission: MissionState): string {
  return resourceRows(mission)
    .map(
      (row) => `
      <div class="resource-detail tone-${row.tone}">
        <img src="${asset(row.icon)}" alt="" width="18" height="18" />
        <span><b>${esc(row.label)}</b><small>${esc(row.detail)}</small></span>
        <strong>${esc(row.value)} <small>${esc(row.unit)}</small></strong>
      </div>`,
    )
    .join("");
}

function goalRows(mission: MissionState, compact = false): string {
  const rows = scienceGoalRows(mission)
    .map((goal) => {
      const pct = goal.target > 0 ? Math.round((goal.complete / goal.target) * 100) : 0;
      return `
        <div class="goal-row ${goal.done ? "is-done" : ""} ${compact ? "is-compact" : ""}">
          <img src="${asset(goal.icon)}" alt="" width="32" height="32" />
          <div class="goal-copy">
            <strong>${esc(goal.name)} ${goal.done ? `<span class="done-tag">Done</span>` : ""}</strong>
            <span>${esc(goal.question)}</span>
            <small>${esc(goal.action)}</small>
            <div class="goal-bar"><b style="width:${pct}%"></b></div>
          </div>
          <span class="goal-count">${goal.complete}<small>/${goal.target}</small></span>
        </div>`;
    })
    .join("");
  const transmit = mission.objectives.find((objective) => objective.id === "transmit");
  if (!transmit) return rows;
  return `${rows}
    <div class="goal-row transmit-row ${transmit.completed ? "is-done" : ""} ${transmit.unlocked ? "" : "is-locked"}">
      <img src="${asset("equipment/antenna.png")}" alt="" width="32" height="32" />
      <div class="goal-copy">
        <strong>Send the results home ${transmit.completed ? `<span class="done-tag">Done</span>` : ""}</strong>
        <span>${transmit.unlocked ? "All four science goals are finished. Return to the lander." : "Unlocks after all four science goals."}</span>
        <small>${esc(transmit.unlocked ? "Use the Send Results marker at the lander." : transmit.unlockHint)}</small>
        <div class="goal-bar"><b style="width:${transmit.completed ? 100 : 0}%"></b></div>
      </div>
      <span class="goal-count">${transmit.completed ? "1" : "0"}<small>/1</small></span>
    </div>`;
}

function abilityMarkup(mission: MissionState, me: PlayerPublic | null): string {
  const role = roleById(me?.role ?? null);
  if (!role) return "";
  const remaining = Math.max(
    0,
    Math.ceil(((mission.abilityReadyAt[me?.id ?? ""] ?? 0) - mission.serverNow) / 1000),
  );
  return `
    <div class="ability-card">
      <div>
        <span class="soft-label">YOUR JOB TOOL</span>
        <strong>${esc(role.ability.name)}</strong>
        <p>${esc(role.ability.description)}</p>
      </div>
      <button class="secondary-button compact" type="button" data-action="use-ability" ${remaining > 0 ? "disabled" : ""}>
        <span data-ability-label>${remaining > 0 ? `${remaining}s` : "Use tool"}</span>
      </button>
    </div>`;
}

function quickCommsMarkup(mission: MissionState): string {
  const latest = mission.log.slice(-1)[0];
  return `
    <div class="quick-comms">
      <span class="soft-label">QUICK MESSAGES</span>
      <div class="quick-buttons">
        ${QUICK_COMMS.map(
          (text) =>
            `<button class="quick-comm" type="button" data-action="quick-comm" data-text="${esc(text)}">${esc(text)}</button>`,
        ).join("")}
      </div>
      <p class="latest-comm">${latest ? esc(latest.text) : "The crew log will appear here."}</p>
    </div>`;
}

function playerRow(player: PlayerPublic, mission: MissionState | null, playerId: string | null): string {
  const role = roleById(player.role);
  const vote = mission?.activeEvent?.votes[player.id];
  const choice = vote
    ? mission?.activeEvent?.choices.find((entry) => entry.id === vote)
    : null;
  const isMe = player.id === playerId;
  return `
    <div class="panel-player ${player.connected ? "" : "is-offline"}">
      <img src="${rolePortrait(player.role)}" alt="" width="48" height="48" />
      <div>
        <strong>${esc(player.name)} ${isMe ? `<span class="you-mark">You</span>` : ""} ${player.host ? `<span class="host-mark">Host</span>` : ""}</strong>
        <span>${esc(role?.name ?? "No job yet")}</span>
        <small>${player.connected ? (choice ? `Voted: ${esc(choice.label)}` : mission?.activeEvent ? "Still deciding" : role?.tagline ?? "") : "Offline — not counted in votes"}</small>
      </div>
    </div>`;
}

function panelNext(state: GameState): string {
  const action = nextAction(state);
  return `<div class="panel-next"><span class="eyebrow">NEXT</span><strong>${esc(action.text)}</strong><p>${esc(action.hint)}</p></div>`;
}

function nowBody(state: GameState, mission: MissionState): string {
  const me = storeMe(state);
  const room = state.room;
  return `
    ${panelNext(state)}
    ${
      mission.activeEvent
        ? `<div class="panel-alert"><b>Decision open: ${esc(mission.activeEvent.title)}</b><span data-event-inline-timer>${formatClock(Math.max(0, (mission.activeEvent.deadline - mission.serverNow) / 1000))} to decide</span><p>Vote in the decision window. The host can lock it in.</p></div>`
        : ""
    }
    <div class="panel-section">
      <div class="section-head"><h3>Resources</h3><span class="soft-label">${esc(room?.players.filter((player) => player.connected).length ?? 1)} connected</span></div>
      <div class="resource-details">${missionResources(mission)}</div>
    </div>
    <div class="panel-section">
      <div class="section-head"><h3>Science goals</h3><span class="soft-label">${scienceTotal(mission)}</span></div>
      ${goalRows(mission, true)}
    </div>
    <div class="panel-section">
      <div class="section-head"><h3>Mission plan</h3></div>
      <div class="plan-grid">
        <span><small>Landing</small><b>${esc(landingSiteById(mission.landingSite)?.name ?? "Not chosen")}</b></span>
        <span><small>Science focus</small><b>${esc(mission.scienceFocus ? scienceGoalById(mission.scienceFocus)?.name ?? "Chosen" : "Not chosen")}</b></span>
        <span><small>Decisions handled</small><b>${mission.eventsResolved} of ${mission.eventsTotal}</b></span>
        <span><small>Rover weight</small><b>${Math.round(mission.resources.mass)} kg</b></span>
      </div>
    </div>
    ${abilityMarkup(mission, me)}
    ${quickCommsMarkup(mission)}`;
}

function scienceBody(mission: MissionState): string {
  return `
    <div class="panel-note">
      Walk to each glowing marker. Press <kbd>E</kbd> or tap <b>Action</b> to start.
      Finish all four goals, then send the results home from the lander.
    </div>
    <div class="goal-list">${goalRows(mission)}</div>
    <div class="panel-note">
      Soil tests unlock after both soil samples. Sending results unlocks after all four goals.
    </div>`;
}

function crewBody(state: GameState, mission: MissionState): string {
  const room = state.room;
  if (!room) return "";
  const me = room.players.find((player) => player.id === state.playerId) ?? null;
  const role = roleById(me?.role ?? null);
  return `
    ${
      role
        ? `<div class="job-card">
            <img src="${rolePortrait(role.id)}" alt="" width="48" height="48" />
            <div>
              <span class="eyebrow">YOUR JOB</span>
              <strong>${esc(role.name)}</strong>
              <p>${esc(role.description)}</p>
              <small><b>Your task:</b> ${esc(role.firstTask)}</small>
            </div>
          </div>`
        : ""
    }
    <div class="player-list">${room.players.map((player) => playerRow(player, mission, state.playerId)).join("")}</div>
    ${abilityMarkup(mission, me)}
    ${quickCommsMarkup(mission)}
    <div class="panel-note">Everyone plays at the same time. Offline players are not counted in votes and never block a decision.</div>`;
}

function logBody(mission: MissionState): string {
  if (mission.log.length === 0) {
    return `<div class="panel-note">The crew log is empty. Walk to a science marker to start making history.</div>`;
  }
  return `
    <div class="log-list">
      ${mission.log
        .slice(-30)
        .reverse()
        .map((entry) => {
          const seconds = Math.max(0, Math.floor((entry.at - mission.startedAt) / 1000));
          return `<div class="log-row tone-${entry.tone}"><span>${formatClock(seconds)}</span><p>${esc(entry.text)}</p></div>`;
        })
        .join("")}
    </div>`;
}

function designPanel(state: GameState): string {
  const room = state.room;
  if (!room) return "";
  const checks = launchChecks(room.design);
  const focus = room.design.scienceFocus
    ? scienceGoalById(room.design.scienceFocus)?.name ?? "Chosen"
    : "Not chosen";
  return `
    <div class="panel-next"><span class="eyebrow">ROVER WORKSHOP</span><strong>${esc(nextAction(state).text)}</strong><p>${esc(designSummary(room.design))}</p></div>
    <button class="primary-button full" type="button" data-action="open-workshop">Open the workshop</button>
    <div class="panel-section">
      <div class="section-head"><h3>Launch check</h3></div>
      <div class="check-list">${checks.map((check) => `<span class="check-row ${check.ok ? "ok" : ""}"><b>${check.ok ? "✓" : "•"}</b> ${esc(check.label)}</span>`).join("")}</div>
    </div>
    <div class="panel-section">
      <div class="section-head"><h3>Science plan</h3></div>
      <div class="plan-grid">
        <span><small>Landing</small><b>${esc(landingSiteById(room.design.landingSite)?.name ?? "Not chosen")}</b></span>
        <span><small>Focus</small><b>${esc(focus)}</b></span>
      </div>
    </div>
    <div class="panel-note">Every connected player needs to press Ready. The host starts the launch.</div>`;
}

function launchPanel(room: GameState["room"]): string {
  if (!room) return "";
  const checks = launchChecks(room.design);
  return `
    <div class="panel-next"><span class="eyebrow">LAUNCH</span><strong id="panel-launch-countdown">Launching…</strong><p>The rover is on its way to Mars. Get ready to walk the basin.</p></div>
    <div class="panel-section">
      <div class="section-head"><h3>Rover</h3></div>
      <div class="check-list">${checks.slice(0, 5).map((check) => `<span class="check-row ${check.ok ? "ok" : ""}"><b>${check.ok ? "✓" : "•"}</b> ${esc(check.label)}</span>`).join("")}</div>
    </div>
    <div class="panel-section">
      <div class="section-head"><h3>Crew</h3></div>
      <div class="player-list">${room.players.map((player) => playerRow(player, null, null)).join("")}</div>
    </div>
    <div class="panel-note">Controls: <kbd>WASD</kbd> or arrow keys to move, <kbd>E</kbd> to act, <kbd>Q</kbd> to use your job tool.</div>`;
}

export function renderPanel(state: GameState, tab: PanelTab): PanelRender {
  const room = state.room;
  if (!room) {
    return { kicker: "MISSION PANEL", title: "Waiting", tabs: "", body: "", foot: "" };
  }
  const mission = state.mission;
  if (room.phase === "design") {
    return {
      kicker: "MISSION PANEL",
      title: "Rover workshop",
      tabs: "",
      body: designPanel(state),
      foot: `<span>Room <b>${esc(room.code)}</b></span><button class="text-button" type="button" data-action="leave-room">Leave game</button>`,
    };
  }
  if (room.phase === "launch") {
    return {
      kicker: "MISSION PANEL",
      title: "Launching to Mars",
      tabs: "",
      body: launchPanel(room),
      foot: `<span>Room <b>${esc(room.code)}</b></span><button class="text-button" type="button" data-action="leave-room">Leave game</button>`,
    };
  }
  if (!mission || room.phase === "debrief") {
    return {
      kicker: "MISSION PANEL",
      title: room.phase === "debrief" ? "Mission debrief" : "Preparing",
      tabs: "",
      body: `<div class="panel-note">${room.phase === "debrief" ? "Read the debrief on the mission screen." : "The mission is getting ready."}</div>`,
      foot: `<span>Room <b>${esc(room.code)}</b></span><button class="text-button" type="button" data-action="leave-room">Leave game</button>`,
    };
  }
  const tabs: Array<{ id: PanelTab; label: string }> = [
    { id: "now", label: "Now" },
    { id: "science", label: "Science" },
    { id: "crew", label: "Crew" },
    { id: "log", label: "Log" },
  ];
  let body = "";
  if (tab === "science") body = scienceBody(mission);
  else if (tab === "crew") body = crewBody(state, mission);
  else if (tab === "log") body = logBody(mission);
  else body = nowBody(state, mission);
  return {
    kicker: mission.result ? "MISSION DEBRIEF" : "MISSION PANEL",
    title: mission.result
      ? "Mission complete"
      : tab === "now"
        ? "What to do now"
        : tab === "science"
          ? "Science goals"
          : tab === "crew"
            ? "Your crew"
            : "Crew log",
    tabs: tabs
      .map(
        (entry) =>
          `<button class="panel-tab ${entry.id === tab ? "is-active" : ""}" type="button" data-panel-tab="${entry.id}" aria-pressed="${entry.id === tab}">${entry.label}</button>`,
      )
      .join(""),
    body,
    foot: `<span>Room <b>${esc(room.code)}</b> · ${room.players.filter((player) => player.connected).length} of 4 connected</span><button class="text-button" type="button" data-action="leave-room">Leave game</button>`,
  };
}
