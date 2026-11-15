import {
  DISCLAIMER,
  REFERENCES,
  RESOURCE_META,
  ROLES,
  SCIENCE_GOALS,
} from "../../shared/content";
import { formatClock } from "../../shared/rules";
import type {
  Ack,
  ComponentId,
  ComponentSlot,
  LandingSiteId,
  Phase,
  PlayerPublic,
  RoleId,
  RoomPublic,
  ScienceCategory,
} from "../../shared/types";
import { audio } from "./audio";
import { clearTouchState, setActionHeld, setDirection, type Direction } from "./controls";
import { gameDirector } from "./game";
import { net } from "./net";
import { appBus, store, toast, type GameState, type ToastDetail } from "./store";
import {
  ROLE_TAB,
  asset,
  designSummary,
  esc,
  nextAction,
  rolePortrait,
  roleTask,
} from "./ui-format";
import { renderDebrief, renderEvent } from "./ui-event";
import { renderLobby } from "./ui-lobby";
import { renderHud, renderOverlay, renderPanel, type PanelTab } from "./ui-panel";
import { renderWorkshop, type WorkshopTab } from "./ui-workshop";

const COACH_KEY = "red-frontier-coach-step-v3";

interface CoachStep {
  kicker: string;
  title: string;
  body: string;
  hint: string;
}

const COACH_STEPS: CoachStep[] = [
  {
    kicker: "START A CREW",
    title: "Host a game, or join one.",
    body: "Hosting creates a 4-letter room code you can share. One player is a complete crew, so you can also play alone.",
    hint: "There is no install and no sign-up.",
  },
  {
    kicker: "PICK A JOB",
    title: "Choose the job that sounds fun.",
    body: "Every job has one important task and one tool. The job card tells you exactly what to do first.",
    hint: "You can change jobs until the rover workshop opens.",
  },
  {
    kicker: "GET READY",
    title: "Press Ready when you know your job.",
    body: "The host can open the rover workshop when every connected player is ready.",
    hint: "You can re-read a job by tapping its card.",
  },
  {
    kicker: "BUILD THE ROVER",
    title: "Every upgrade helps somewhere and costs somewhere.",
    body: "Tap a glowing part of the rover, then choose one of two options. Watch the money and weight meters at the top.",
    hint: "You need at least two upgrades before launch.",
  },
  {
    kicker: "PLAN THE MISSION",
    title: "Choose a landing place and a science focus.",
    body: "The landing place changes your starting battery. The focus makes one kind of science finish faster.",
    hint: "Any crew member can choose. Compare the trade-offs.",
  },
  {
    kicker: "FOUR SCIENCE GOALS",
    title: "Explore the basin and study Mars.",
    body: "Study rocks, collect soil, test the soil, and read the weather. The science bar at the top of the screen tracks all four.",
    hint: "Walk to a glowing marker to begin.",
  },
  {
    kicker: "PRESS E TO STUDY",
    title: "Stay close until the ring fills.",
    body: "Stand by a marker and press E, or tap Action on a touch screen. A nearby crew member helps the task finish faster.",
    hint: "The NEXT line under the world always tells you what to do.",
  },
];

type ModalKind = "none" | "access" | "notes" | "leave";
type AccessMode = "host" | "join";

interface UiRefs {
  app: HTMLElement;
  titleScreen: HTMLElement;
  lobbyScreen: HTMLElement;
  lobbyCode: HTMLElement;
  lobbyCount: HTMLElement;
  lobbyCrew: HTMLElement;
  roleGrid: HTMLElement;
  lobbyFooter: HTMLElement;
  workshopScreen: HTMLElement;
  workshopStats: HTMLElement;
  workshopBody: HTMLElement;
  workshopTabs: HTMLElement;
  workshopActions: HTMLElement;
  eventScreen: HTMLElement;
  debriefScreen: HTMLElement;
  missionOverlay: HTMLElement;
  worldKicker: HTMLElement;
  nearbyPrompt: HTMLElement;
  nearbyIcon: HTMLElement;
  nearbyTitle: HTMLElement;
  nearbySub: HTMLElement;
  nearbyProgress: HTMLElement;
  progressTitle: HTMLElement;
  progressPct: HTMLElement;
  progressFill: HTMLElement;
  localCoord: HTMLElement;
  designDock: HTMLElement;
  designDockTitle: HTMLElement;
  designDockStats: HTMLElement;
  stageToast: HTMLElement;
  waitingOverlay: HTMLElement;
  waitingText: HTMLElement;
  hudBar: HTMLElement;
  sciencePips: HTMLElement;
  nextAction: HTMLElement;
  resourceStrip: HTMLElement;
  touchControls: HTMLElement;
  missionPanel: HTMLElement;
  panelKicker: HTMLElement;
  panelTitle: HTMLElement;
  panelTabs: HTMLElement;
  panelBody: HTMLElement;
  panelFoot: HTMLElement;
  panelScrim: HTMLElement;
  panelButton: HTMLButtonElement;
  roomChip: HTMLElement;
  roomCode: HTMLElement;
  netBadge: HTMLElement;
  netLabel: HTMLElement;
  soundButton: HTMLButtonElement;
  soundLabel: HTMLElement;
  coach: HTMLElement;
  coachKicker: HTMLElement;
  coachBody: HTMLElement;
  coachCount: HTMLElement;
  coachNext: HTMLButtonElement;
  toastStack: HTMLElement;
  modalRoot: HTMLElement;
  bootOverlay: HTMLElement;
  bootFill: HTMLElement;
  bootStatus: HTMLElement;
  bootRetry: HTMLButtonElement;
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}`);
  return element as T;
}

function refsFromDocument(): UiRefs {
  return {
    app: byId("app"),
    titleScreen: byId("title-screen"),
    lobbyScreen: byId("lobby-screen"),
    lobbyCode: byId("lobby-code"),
    lobbyCount: byId("lobby-count"),
    lobbyCrew: byId("lobby-crew"),
    roleGrid: byId("role-grid"),
    lobbyFooter: byId("lobby-footer"),
    workshopScreen: byId("workshop-screen"),
    workshopStats: byId("workshop-stats"),
    workshopBody: byId("workshop-body"),
    workshopTabs: byId("workshop-tabs"),
    workshopActions: byId("workshop-actions"),
    eventScreen: byId("event-screen"),
    debriefScreen: byId("debrief-screen"),
    missionOverlay: byId("mission-overlay"),
    worldKicker: byId("world-kicker-text"),
    nearbyPrompt: byId("nearby-prompt"),
    nearbyIcon: byId("nearby-icon"),
    nearbyTitle: byId("nearby-title"),
    nearbySub: byId("nearby-sub"),
    nearbyProgress: byId("nearby-progress"),
    progressTitle: byId("progress-title"),
    progressPct: byId("progress-pct"),
    progressFill: byId("progress-fill"),
    localCoord: byId("local-coord"),
    designDock: byId("design-dock"),
    designDockTitle: byId("design-dock-title"),
    designDockStats: byId("design-dock-stats"),
    stageToast: byId("stage-toast"),
    waitingOverlay: byId("waiting-overlay"),
    waitingText: byId("waiting-text"),
    hudBar: byId("hud-bar"),
    sciencePips: byId("science-pips"),
    nextAction: byId("next-action"),
    resourceStrip: byId("resource-strip"),
    touchControls: byId("touch-controls"),
    missionPanel: byId("mission-panel"),
    panelKicker: byId("panel-kicker"),
    panelTitle: byId("panel-title"),
    panelTabs: byId("panel-tabs"),
    panelBody: byId("panel-body"),
    panelFoot: byId("panel-foot"),
    panelScrim: byId("panel-scrim"),
    panelButton: byId<HTMLButtonElement>("panel-button"),
    roomChip: byId("room-chip"),
    roomCode: byId("room-code"),
    netBadge: byId("net-badge"),
    netLabel: byId("net-label"),
    soundButton: byId<HTMLButtonElement>("sound-button"),
    soundLabel: byId("sound-label"),
    coach: byId("coach"),
    coachKicker: byId("coach-kicker"),
    coachBody: byId("coach-body"),
    coachCount: byId("coach-count"),
    coachNext: byId<HTMLButtonElement>("coach-next"),
    toastStack: byId("toast-stack"),
    modalRoot: byId("modal-root"),
    bootOverlay: byId("boot-overlay"),
    bootFill: byId("boot-fill"),
    bootStatus: byId("boot-status"),
    bootRetry: byId<HTMLButtonElement>("boot-retry"),
  };
}

class UiController {
  private initialized = false;
  private refs: UiRefs | null = null;
  private unsubscribe: (() => void) | null = null;
  private tickTimer: number | null = null;
  private panelOpen = false;
  private panelTab: PanelTab = "now";
  private workshopOpen = false;
  private workshopTab: WorkshopTab = "build";
  private selectedSlot: ComponentSlot = "body";
  private modal: ModalKind = "none";
  private accessMode: AccessMode = "host";
  private accessName = "";
  private coachStep = 0;
  private lastPhase: Phase | "title" = "title";
  private lastLobbySignature = "";
  private lastWorkshopSignature = "";
  private lastEventSignature = "";
  private lastDebriefSignature = "";
  private lastHudSignature = "";
  private lastHudPaint = 0;
  private lastPanelPaint = 0;
  private stageToastTimer: number | null = null;
  private lastMissionId = "";
  private completedObjectives = new Set<string>();
  private lastEventId = "";
  private lastOutcomeAt = 0;
  private lastResultKey = "";
  private lastCommId = "";
  private audioScene = "";
  private touch = false;
  private resumingToastShown = false;
  private sessionToastShown = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.refs = refsFromDocument();
    this.touch =
      window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    this.refs.app.dataset.touch = String(this.touch);
    try {
      const saved = Number.parseInt(localStorage.getItem(COACH_KEY) ?? "0", 10);
      this.coachStep = Number.isFinite(saved) ? Math.max(0, Math.min(saved, COACH_STEPS.length)) : 0;
    } catch {
      this.coachStep = 0;
    }

    document.addEventListener("click", (event) => this.onClick(event));
    document.addEventListener("submit", (event) => this.onSubmit(event));
    document.addEventListener("keydown", (event) => this.onKeyDown(event));
    this.bindTouchControls();
    document.addEventListener("pointerdown", () => void audio.unlock(), { once: true });
    document.addEventListener("pointerup", () => this.releaseTouches());
    document.addEventListener("pointercancel", () => this.releaseTouches());

    appBus.addEventListener("toast", (event) => {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      this.pushToast(detail.message, detail.tone ?? "info", detail.ttl ?? 5200);
    });
    appBus.addEventListener("session-message", (event) => {
      if (this.sessionToastShown) return;
      this.sessionToastShown = true;
      this.pushToast((event as CustomEvent<string>).detail, "warning", 7000);
    });

    this.syncSound();
    this.unsubscribe = store.subscribe((state) => this.render(state));
    this.tickTimer = window.setInterval(() => this.tick(), 250);
  }

  setBootProgress(value: number, label: string): void {
    if (!this.refs) return;
    const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
    this.refs.bootFill.style.width = `${pct}%`;
    this.refs.bootStatus.textContent = label;
  }

  finishBoot(): void {
    if (!this.refs) return;
    this.refs.bootFill.style.width = "100%";
    this.refs.bootStatus.textContent = "READY";
    this.refs.bootOverlay.classList.add("is-done");
    window.setTimeout(() => {
      if (this.refs) this.refs.bootOverlay.classList.add("hidden");
    }, 620);
  }

  showBootError(message: string): void {
    if (!this.refs) return;
    this.refs.bootOverlay.classList.add("is-error");
    this.refs.bootStatus.textContent = message;
    this.refs.bootRetry.classList.remove("hidden");
  }

  private render(state: GameState): void {
    const refs = this.refs;
    if (!refs) return;
    const room = state.room;
    const phase: Phase | "title" = room?.phase ?? "title";
    const mission = state.mission;
    const result = mission?.result ?? null;
    const activeEvent = mission?.activeEvent ?? null;
    refs.app.dataset.phase = phase;

    if (phase !== this.lastPhase) {
      if (phase === "design") {
        const me = room?.players.find((player) => player.id === state.playerId);
        this.workshopOpen = true;
        this.workshopTab = me?.role ? ROLE_TAB[me.role] : "build";
        this.lastWorkshopSignature = "";
      }
      if (phase !== "design") this.workshopOpen = false;
      if (phase === "debrief") this.panelOpen = false;
      this.lastPhase = phase;
    }

    gameDirector.syncRoom(room);
    const sceneName = this.audioSceneFor(phase);
    if (sceneName !== this.audioScene) {
      this.audioScene = sceneName;
      audio.setScene(sceneName);
    }

    this.syncTopbar(state);
    refs.titleScreen.classList.toggle("hidden", Boolean(room));
    refs.lobbyScreen.classList.toggle("hidden", phase !== "lobby");
    refs.workshopScreen.classList.toggle(
      "hidden",
      phase !== "design" || !this.workshopOpen,
    );
    refs.designDock.classList.toggle(
      "hidden",
      phase !== "design" || this.workshopOpen,
    );
    refs.eventScreen.classList.toggle("hidden", !activeEvent || phase !== "mission");
    refs.debriefScreen.classList.toggle("hidden", phase !== "debrief" || !result);
    refs.missionOverlay.classList.toggle(
      "hidden",
      phase !== "mission" || Boolean(result) || Boolean(activeEvent),
    );
    refs.hudBar.classList.toggle("hidden", phase !== "mission" || Boolean(result));
    refs.touchControls.classList.toggle(
      "hidden",
      !this.touch || phase !== "mission" || Boolean(result) || Boolean(activeEvent),
    );
    refs.panelButton.classList.toggle(
      "hidden",
      !room || phase === "lobby" || phase === "debrief",
    );
    refs.panelButton.setAttribute("aria-expanded", String(this.panelOpen));

    const waiting = state.resuming || (Boolean(room) && state.connection !== "online");
    refs.waitingOverlay.classList.toggle("hidden", !waiting);
    if (waiting) {
      refs.waitingText.textContent = state.resuming
        ? "Reconnecting you to the crew…"
        : state.connection === "offline"
          ? "Connection lost. Trying to reconnect…"
          : "Connecting to the crew…";
    }

    if (phase === "lobby" && room) this.renderLobby(state, room);
    if (phase === "design" && room) {
      this.renderDesignDock(state, room);
      if (this.workshopOpen) this.renderWorkshop(state, room);
    }
    if (phase === "launch" && room) this.renderLaunchDock(state, room);
    if (phase === "mission" && mission) {
      this.renderHudIfNeeded(state);
      this.renderWorldOverlay(state);
      this.detectMissionFeedback(state);
    }
    if (activeEvent && room && mission) this.renderEventIfNeeded(state, room, activeEvent);
    if (phase === "debrief" && room && result) this.renderDebriefIfNeeded(state, room);
    this.renderPanelIfNeeded(state);
    this.renderCoach(state);
    this.tick();
    if (state.resuming && !this.resumingToastShown) {
      this.resumingToastShown = true;
      this.pushToast("Trying to rejoin your last crew…", "info", 4000);
    }
    if (!state.resuming) this.resumingToastShown = false;
  }

  private audioSceneFor(phase: Phase | "title"): "title" | "lobby" | "design" | "launch" | "mission" | "debrief" {
    if (phase === "title") return "title";
    return phase;
  }

  private syncTopbar(state: GameState): void {
    const refs = this.refs;
    if (!refs) return;
    const room = state.room;
    refs.roomChip.classList.toggle("hidden", !room);
    if (room) {
      refs.roomCode.textContent = room.code;
      refs.lobbyCode.textContent = room.code;
    }
    refs.netBadge.dataset.state = state.connection;
    refs.netLabel.textContent =
      state.connection === "online" ? "Online" : state.connection === "connecting" ? "Connecting" : "Offline";
    if (room) {
      const connected = room.players.filter((player) => player.connected).length;
      refs.lobbyCount.textContent = `${connected} of 4 players`;
    }
  }

  private renderLobby(state: GameState, room: RoomPublic): void {
    const refs = this.refs;
    if (!refs) return;
    const signature = JSON.stringify({
      code: room.code,
      hostId: room.hostId,
      playerId: state.playerId,
      players: room.players.map((player) => ({
        id: player.id,
        name: player.name,
        role: player.role,
        ready: player.ready,
        connected: player.connected,
      })),
    });
    if (signature === this.lastLobbySignature) return;
    this.lastLobbySignature = signature;
    const view = renderLobby(room, state.playerId);
    refs.lobbyCrew.innerHTML = view.crew;
    refs.roleGrid.innerHTML = view.roles;
    refs.lobbyFooter.innerHTML = view.footer;
    refs.lobbyCount.textContent = view.players;
  }

  private renderDesignDock(state: GameState, room: RoomPublic): void {
    const refs = this.refs;
    if (!refs) return;
    refs.designDockTitle.textContent = nextAction(state).text;
    refs.designDockStats.textContent = designSummary(room.design);
  }

  private renderLaunchDock(state: GameState, room: RoomPublic): void {
    const refs = this.refs;
    if (!refs) return;
    refs.designDock.classList.add("hidden");
    const remaining = room.launchAt ? Math.max(0, Math.ceil((room.launchAt - store.serverNow) / 1000)) : 0;
    refs.designDockTitle.textContent = `Launching in ${Math.floor(remaining)} seconds`;
  }

  private renderWorkshop(state: GameState, room: RoomPublic): void {
    const refs = this.refs;
    if (!refs) return;
    const signature = JSON.stringify({
      design: room.design,
      hostId: room.hostId,
      playerId: state.playerId,
      tab: this.workshopTab,
      slot: this.selectedSlot,
      players: room.players.map((player) => ({
        id: player.id,
        role: player.role,
        ready: player.ready,
        connected: player.connected,
      })),
    });
    if (signature === this.lastWorkshopSignature) return;
    this.lastWorkshopSignature = signature;
    const view = renderWorkshop(room, state.playerId, this.workshopTab, this.selectedSlot);
    refs.workshopStats.innerHTML = view.stats;
    refs.workshopTabs.innerHTML = view.tabs;
    refs.workshopBody.innerHTML = view.body;
    refs.workshopActions.innerHTML = view.actions;
  }

  private renderHudIfNeeded(state: GameState): void {
    const refs = this.refs;
    if (!refs) return;
    const mission = state.mission;
    if (!mission) return;
    const now = performance.now();
    if (now - this.lastHudPaint < 220) return;
    const signature = JSON.stringify({
      id: mission.missionId,
      resources: mission.resources,
      science: mission.science,
      event: mission.activeEvent?.id ?? null,
      data: Math.round(mission.resources.data * 2),
      positions: Object.fromEntries(
        Object.entries(state.positions).map(([id, pos]) => [
          id,
          [Math.round(pos.x / 8), Math.round(pos.y / 8), pos.interacting],
        ]),
      ),
      objectives: mission.objectives.map((objective) => [
        objective.id,
        objective.completed,
        objective.unlocked,
        Math.round(objective.progress * 20),
      ]),
    });
    if (signature === this.lastHudSignature) return;
    this.lastHudSignature = signature;
    this.lastHudPaint = now;
    const hud = renderHud(state);
    refs.sciencePips.innerHTML = hud.pips;
    refs.nextAction.innerHTML = hud.action;
    refs.resourceStrip.innerHTML = hud.resources;
  }

  private renderWorldOverlay(state: GameState): void {
    const refs = this.refs;
    if (!refs) return;
    const overlay = renderOverlay(state);
    refs.worldKicker.textContent = overlay.kicker;
    refs.nearbyPrompt.classList.toggle("hidden", overlay.promptHidden);
    if (!overlay.promptHidden) {
      refs.nearbyIcon.innerHTML = `<img src="${overlay.promptIcon}" alt="" width="24" height="24" />`;
      refs.nearbyTitle.textContent = overlay.promptTitle;
      refs.nearbySub.textContent = overlay.promptSub;
    }
    refs.nearbyProgress.classList.toggle("hidden", overlay.progressHidden);
    if (!overlay.progressHidden) {
      refs.progressTitle.textContent = overlay.progressTitle;
      refs.progressPct.textContent = overlay.progressPct;
      refs.progressFill.style.width = overlay.progressFill;
    }
    refs.localCoord.textContent = overlay.coords;
  }

  private renderEventIfNeeded(
    state: GameState,
    room: RoomPublic,
    event: NonNullable<GameState["mission"]>["activeEvent"],
  ): void {
    if (!event) return;
    const refs = this.refs;
    if (!refs) return;
    const signature = JSON.stringify({
      id: event.id,
      resolution: event.resolution,
      votes: event.votes,
      finalizedBy: event.finalizedBy,
      playerId: state.playerId,
      players: room.players.map((player) => [
        player.id,
        player.name,
        player.role,
        player.connected,
        player.host,
      ]),
    });
    if (signature === this.lastEventSignature) return;
    this.lastEventSignature = signature;
    refs.eventScreen.innerHTML = renderEvent(event, room, state.playerId, store.serverNow);
  }

  private renderDebriefIfNeeded(state: GameState, room: RoomPublic): void {
    const refs = this.refs;
    if (!refs) return;
    const result = state.mission?.result;
    if (!result) return;
    const signature = JSON.stringify({
      result,
      playerId: state.playerId,
      hostId: room.hostId,
      players: room.players.map((player) => [player.id, player.name, player.connected, player.host]),
      science: state.mission?.science,
      transmit: state.mission?.objectives.find((objective) => objective.id === "transmit")?.completed,
    });
    if (signature === this.lastDebriefSignature) return;
    this.lastDebriefSignature = signature;
    refs.debriefScreen.innerHTML = renderDebrief(result, room, state.playerId);
  }

  private renderPanelIfNeeded(state: GameState): void {
    const refs = this.refs;
    if (!refs || !state.room) return;
    const visible =
      this.panelOpen &&
      state.room.phase !== "lobby" &&
      state.room.phase !== "debrief" &&
      !state.mission?.activeEvent &&
      !state.mission?.result;
    refs.missionPanel.classList.toggle("hidden", !visible);
    refs.panelScrim.classList.toggle("hidden", !visible || !this.touch);
    refs.missionPanel.setAttribute("aria-hidden", String(!visible));
    if (!visible) return;
    const now = performance.now();
    if (now - this.lastPanelPaint < 400) return;
    this.lastPanelPaint = now;
    const view = renderPanel(state, this.panelTab);
    refs.panelKicker.textContent = view.kicker;
    refs.panelTitle.textContent = view.title;
    refs.panelTabs.innerHTML = view.tabs;
    refs.panelBody.innerHTML = view.body;
    refs.panelFoot.innerHTML = view.foot;
  }

  private renderCoach(state: GameState): void {
    const refs = this.refs;
    if (!refs) return;
    const phase = state.room?.phase ?? "title";
    const minimum =
      phase === "title" ? 0 : phase === "lobby" ? 1 : phase === "design" ? 3 : phase === "launch" || phase === "mission" ? 5 : COACH_STEPS.length;
    if (this.coachStep < minimum && this.coachStep < COACH_STEPS.length) {
      this.coachStep = minimum;
      this.storeCoach();
    }
    const available = this.coachStep >= minimum && this.coachStep < COACH_STEPS.length;
    const blocked =
      this.modal !== "none" ||
      Boolean(state.mission?.activeEvent) ||
      Boolean(state.mission?.result) ||
      phase === "debrief" ||
      phase === "launch";
    const visible = available && !blocked;
    refs.coach.classList.toggle("hidden", !visible);
    if (!visible) return;
    const step = COACH_STEPS[this.coachStep];
    if (!step) return;
    refs.coachKicker.textContent = `${step.kicker} · TIP ${this.coachStep + 1} OF ${COACH_STEPS.length}`;
    refs.coachBody.innerHTML = `<strong>${esc(step.title)}</strong><p>${esc(step.body)}</p><small>${esc(step.hint)}</small>`;
    refs.coachCount.textContent = `${this.coachStep + 1} of ${COACH_STEPS.length}`;
    refs.coachNext.textContent = this.coachStep === COACH_STEPS.length - 1 ? "Finish tips" : "Got it";
  }

  private detectMissionFeedback(state: GameState): void {
    const mission = state.mission;
    if (!mission) return;
    if (mission.missionId !== this.lastMissionId) {
      this.lastMissionId = mission.missionId;
      this.completedObjectives.clear();
      this.lastEventId = "";
      this.lastOutcomeAt = 0;
      this.lastResultKey = "";
    }
    for (const objective of mission.objectives) {
      if (!objective.completed || objective.kind === "transmit") continue;
      if (this.completedObjectives.has(objective.id)) continue;
      this.completedObjectives.add(objective.id);
      audio.complete();
      this.showStageToast(
        `${objective.shortName}: ${objective.name} complete. Science ${Math.round(mission.resources.data)} of ${mission.dataTarget}.`,
        "success",
      );
    }
    if (mission.activeEvent && mission.activeEvent.id !== this.lastEventId) {
      this.lastEventId = mission.activeEvent.id;
      this.panelOpen = false;
      audio.eventAlert();
      this.pushToast(`Crew decision: ${mission.activeEvent.title}. Vote together, then the host can lock it in.`, "warning", 6500);
    }
    if (!mission.activeEvent) this.lastEventId = "";
    const outcome = mission.eventOutcome;
    if (outcome && outcome.at !== this.lastOutcomeAt) {
      this.lastOutcomeAt = outcome.at;
      this.pushToast(
        `${outcome.title}: ${outcome.choiceLabel}. ${outcome.modifiers.join(" ")}`,
        "info",
        5600,
      );
    }
    const comm = state.latestComm;
    if (comm && comm.id !== this.lastCommId) {
      this.lastCommId = comm.id;
      this.showStageToast(`${comm.name}: ${comm.text}`, "crew");
    }
    const result = mission.result;
    if (result) {
      const key = `${result.completedAt}:${result.outcome}`;
      if (key !== this.lastResultKey) {
        this.lastResultKey = key;
        if (result.outcome === "success") audio.success();
        else if (result.outcome === "failure") audio.failure();
        else audio.complete();
      }
    }
  }

  private tick(): void {
    const refs = this.refs;
    if (!refs) return;
    const state = store.current;
    const room = state.room;
    const mission = state.mission;
    const now = store.serverNow;

    if (room?.phase === "launch" && room.launchAt) {
      const countdown = refs.missionPanel.querySelector<HTMLElement>("#panel-launch-countdown");
      if (countdown) {
        const seconds = Math.max(0, Math.ceil((room.launchAt - now) / 1000));
        countdown.textContent = `Launching in ${Math.floor(seconds)} seconds`;
      }
    }
    const event = mission?.activeEvent;
    if (event) {
      const countdown = document.getElementById("event-countdown");
      if (countdown) {
        countdown.textContent = formatClock(Math.max(0, (event.deadline - now) / 1000));
      }
      const inline = refs.missionPanel.querySelector<HTMLElement>("[data-event-inline-timer]");
      if (inline) {
        inline.textContent = `${formatClock(Math.max(0, (event.deadline - now) / 1000))} to decide`;
      }
    }
    if (mission && !mission.result) {
      const labels = refs.missionPanel.querySelectorAll<HTMLElement>("[data-ability-label]");
      for (const label of labels) {
        const button = label.closest("button");
        const readyAt = state.playerId ? mission.abilityReadyAt[state.playerId] ?? 0 : 0;
        const remaining = Math.max(0, Math.ceil((readyAt - now) / 1000));
        label.textContent = remaining > 0 ? `${remaining}s` : "Use tool";
        if (button) button.disabled = remaining > 0;
      }
    }

    if (state.connection === "offline" && room && !this.sessionToastShown) {
      this.sessionToastShown = false;
    }
  }

  private showStageToast(message: string, tone: "success" | "crew" | "warning" | "info"): void {
    const refs = this.refs;
    if (!refs) return;
    refs.stageToast.textContent = message;
    refs.stageToast.dataset.tone = tone;
    refs.stageToast.classList.remove("hidden");
    if (this.stageToastTimer !== null) window.clearTimeout(this.stageToastTimer);
    this.stageToastTimer = window.setTimeout(() => {
      refs.stageToast.classList.add("hidden");
      this.stageToastTimer = null;
    }, 3600);
  }

  private pushToast(message: string, tone: ToastDetail["tone"], ttl: number): void {
    const refs = this.refs;
    if (!refs) return;
    const item = document.createElement("div");
    item.className = `toast toast-${tone ?? "info"}`;
    item.innerHTML = `<span>${esc(message)}</span><button type="button" aria-label="Dismiss">×</button>`;
    item.querySelector("button")?.addEventListener("click", () => item.remove());
    refs.toastStack.append(item);
    while (refs.toastStack.children.length > 4) refs.toastStack.firstElementChild?.remove();
    window.setTimeout(() => item.remove(), ttl);
  }

  private async onClick(event: MouseEvent): Promise<void> {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const backdrop = target.closest<HTMLElement>("[data-modal-backdrop]");
    if (backdrop && target === backdrop) {
      this.closeModal();
      return;
    }
    const actionEl = target.closest<HTMLElement>("[data-action]");
    if (actionEl) {
      event.preventDefault();
      await this.handleAction(actionEl.dataset.action ?? "", actionEl);
      return;
    }
    const workTab = target.closest<HTMLElement>("[data-worktab]");
    if (workTab) {
      event.preventDefault();
      this.workshopTab = (workTab.dataset.worktab ?? "build") as WorkshopTab;
      this.lastWorkshopSignature = "";
      this.render(store.current);
      audio.select();
      return;
    }
    const slot = target.closest<HTMLElement>("[data-slot]");
    if (slot) {
      event.preventDefault();
      this.selectedSlot = (slot.dataset.slot ?? "body") as ComponentSlot;
      this.workshopTab = "build";
      this.lastWorkshopSignature = "";
      this.render(store.current);
      audio.select();
      return;
    }
    const component = target.closest<HTMLElement>("[data-component]");
    if (component) {
      event.preventDefault();
      const slotId = (component.dataset.componentSlot ?? this.selectedSlot) as ComponentSlot;
      const componentId = (component.dataset.component ?? "") as ComponentId;
      if (!componentId) return;
      const result = await net.setComponent(slotId, componentId);
      if (result.ok) {
        audio.confirm();
        this.lastWorkshopSignature = "";
        this.render(store.current);
      } else {
        toast(result.error, "error");
        audio.denied();
      }
      return;
    }
    const site = target.closest<HTMLElement>("[data-site]");
    if (site) {
      event.preventDefault();
      const siteId = (site.dataset.site ?? "") as LandingSiteId;
      const result = await net.setLandingSite(siteId);
      if (result.ok) {
        audio.select();
        this.lastWorkshopSignature = "";
        this.render(store.current);
      } else {
        toast(result.error, "error");
      }
      return;
    }
    const focus = target.closest<HTMLElement>("[data-focus]");
    if (focus) {
      event.preventDefault();
      const category = (focus.dataset.focus ?? "") as ScienceCategory;
      const result = await net.setScienceFocus(category);
      if (result.ok) {
        audio.select();
        this.lastWorkshopSignature = "";
        this.render(store.current);
      } else {
        toast(result.error, "error");
      }
      return;
    }
    const choice = target.closest<HTMLElement>("[data-choice]");
    if (choice) {
      event.preventDefault();
      const choiceId = choice.dataset.choice ?? "";
      const result = await net.vote(choiceId);
      if (result.ok) {
        audio.select();
        this.lastEventSignature = "";
        this.render(store.current);
      } else {
        toast(result.error, "warning");
      }
      return;
    }
    const panelTab = target.closest<HTMLElement>("[data-panel-tab]");
    if (panelTab) {
      event.preventDefault();
      this.panelTab = (panelTab.dataset.panelTab ?? "now") as PanelTab;
      this.lastPanelPaint = 0;
      this.render(store.current);
      audio.select();
    }
  }

  private async handleAction(action: string, element: HTMLElement): Promise<void> {
    switch (action) {
      case "host-room":
        this.openAccess("host");
        return;
      case "join-room":
        this.openAccess("join");
        return;
      case "switch-access": {
        const input = this.refs?.modalRoot.querySelector<HTMLInputElement>("#access-name");
        if (input) this.accessName = input.value;
        this.openAccess(element.dataset.mode === "join" ? "join" : "host");
        return;
      }
      case "modal-close":
      case "close-modal":
        this.closeModal();
        return;
      case "copy-room": {
        const code = store.current.room?.code;
        if (!code) return;
        try {
          await navigator.clipboard.writeText(code);
          toast(`Room code ${code} copied.`, "success", 3200);
        } catch {
          toast(`Room code: ${code}`, "info", 4200);
        }
        return;
      }
      case "toggle-sound": {
        await audio.unlock();
        audio.toggleMuted();
        this.syncSound();
        return;
      }
      case "fullscreen": {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await document.documentElement.requestFullscreen();
        } catch {
          toast("Full screen is not available in this browser.", "warning");
        }
        return;
      }
      case "open-notes":
        this.openModal("notes");
        return;
      case "go-home":
        if (store.current.room) this.openModal("leave");
        return;
      case "toggle-panel": {
        if (!store.current.room) return;
        this.panelOpen = !this.panelOpen;
        if (this.panelOpen) {
          this.panelTab = "now";
          this.lastPanelPaint = 0;
        }
        this.render(store.current);
        audio.click();
        return;
      }
      case "close-panel":
        this.panelOpen = false;
        this.render(store.current);
        return;
      case "select-role": {
        const role = element.dataset.role as RoleId | undefined;
        if (!role) return;
        const result = await net.setRole(role);
        if (result.ok) audio.select();
        else {
          toast(result.error, "warning");
          audio.denied();
        }
        return;
      }
      case "toggle-ready": {
        const me = store.me;
        if (!me) return;
        const result = await net.setReady(!me.ready);
        if (result.ok) audio.confirm();
        else toast(result.error, "warning");
        this.lastLobbySignature = "";
        this.lastWorkshopSignature = "";
        this.render(store.current);
        return;
      }
      case "open-design": {
        const result = await net.toDesign();
        if (!result.ok) toast(result.error, "warning");
        else audio.confirm();
        return;
      }
      case "open-workshop": {
        this.workshopOpen = true;
        this.lastWorkshopSignature = "";
        const me = store.me;
        if (me?.role) this.workshopTab = ROLE_TAB[me.role];
        this.render(store.current);
        audio.select();
        return;
      }
      case "close-workshop":
        this.workshopOpen = false;
        this.render(store.current);
        audio.click();
        return;
      case "start-mission": {
        const result = await net.startMission();
        if (result.ok) audio.confirm();
        else {
          toast(result.error, "warning");
          audio.denied();
        }
        return;
      }
      case "use-ability": {
        const result = await net.ability();
        if (result.ok) audio.ability();
        else toast(result.error, "warning");
        this.lastPanelPaint = 0;
        this.render(store.current);
        return;
      }
      case "quick-comm": {
        const text = element.dataset.text ?? "";
        if (!text) return;
        const result = await net.quickComm(text);
        if (!result.ok) toast(result.error, "warning");
        else audio.click();
        return;
      }
      case "finalize-event": {
        const result = await net.finalizeEvent();
        if (result.ok) audio.confirm();
        else toast(result.error, "warning");
        this.lastEventSignature = "";
        this.render(store.current);
        return;
      }
      case "retry-mission": {
        const result = await net.retryMission();
        if (!result.ok) toast(result.error, "warning");
        else audio.confirm();
        return;
      }
      case "back-lobby": {
        const result = await net.returnToLobby();
        if (!result.ok) toast(result.error, "warning");
        else audio.confirm();
        return;
      }
      case "leave-room":
        this.openModal("leave");
        return;
      case "leave-confirm": {
        this.closeModal();
        const result = await net.leaveRoom();
        this.panelOpen = false;
        this.workshopOpen = false;
        this.lastLobbySignature = "";
        this.lastWorkshopSignature = "";
        this.lastEventSignature = "";
        this.lastDebriefSignature = "";
        this.lastHudSignature = "";
        this.lastMissionId = "";
        this.lastResultKey = "";
        clearTouchState();
        if (!result.ok) toast(result.error, "warning");
        this.render(store.current);
        return;
      }
      case "coach-next":
        this.coachStep = Math.min(COACH_STEPS.length, this.coachStep + 1);
        this.storeCoach();
        this.render(store.current);
        audio.click();
        return;
      case "coach-skip":
        this.coachStep = COACH_STEPS.length;
        this.storeCoach();
        this.render(store.current);
        audio.click();
        return;
      case "retry-boot":
        window.location.reload();
        return;
      default:
        return;
    }
  }

  private onSubmit(event: Event): void {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.matches("[data-access-form]")) return;
    event.preventDefault();
    void this.submitAccess(form);
  }

  private async submitAccess(form: HTMLFormElement): Promise<void> {
    const mode = (form.dataset.mode ?? "host") as AccessMode;
    const nameInput = form.querySelector<HTMLInputElement>("#access-name");
    const codeInput = form.querySelector<HTMLInputElement>("#access-code");
    const errorBox = form.querySelector<HTMLElement>("#access-error");
    const submit = form.querySelector<HTMLButtonElement>("[data-access-submit]");
    const name = nameInput?.value.trim() ?? "";
    const code = codeInput?.value.trim().toUpperCase() ?? "";
    const fail = (message: string): void => {
      if (errorBox) {
        errorBox.textContent = message;
        errorBox.classList.remove("hidden");
      }
      if (submit) {
        submit.disabled = false;
        submit.textContent = mode === "host" ? "Create room" : "Join room";
      }
      audio.denied();
    };
    if (name.length < 2) {
      fail("Use a name between 2 and 18 characters.");
      nameInput?.focus();
      return;
    }
    if (mode === "join" && code.length < 4) {
      fail("Type the 4-letter room code from your friend.");
      codeInput?.focus();
      return;
    }
    if (errorBox) errorBox.classList.add("hidden");
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Connecting…";
    }
    const result =
      mode === "host" ? await net.createRoom(name) : await net.joinRoom(code, name);
    if (!result.ok) {
      fail(result.error);
      return;
    }
    net.rememberCallsign(name);
    this.accessName = name;
    this.closeModal();
    audio.confirm();
    this.pushToast(
      mode === "host" ? `Room ${result.value.room.code} is open. Share the code.` : "You joined the crew.",
      "success",
      5200,
    );
  }

  private openAccess(mode: AccessMode): void {
    this.accessMode = mode;
    const callsign = this.accessName || net.savedCallsign();
    const params = new URLSearchParams(window.location.search);
    const code = params.get("room") ?? "";
    const content = `
      <div class="modal-card access-card" role="dialog" aria-modal="true" aria-labelledby="access-title">
        <button class="modal-close" type="button" data-action="modal-close" aria-label="Close">×</button>
        <span class="eyebrow">${mode === "host" ? "NEW CREW" : "JOIN A CREW"}</span>
        <h2 id="access-title">${mode === "host" ? "Open a room for your crew." : "Join your crew on Mars."}</h2>
        <p class="modal-lead">${
          mode === "host"
            ? "You become the host. Share the 4-letter code after the room opens."
            : "Type the code your host shared. You can join from this browser."
        }</p>
        <form data-access-form data-mode="${mode}">
          ${
            mode === "join"
              ? `<label class="field"><span>Room code</span><input id="access-code" name="code" inputmode="text" maxlength="4" minlength="4" autocomplete="off" spellcheck="false" placeholder="ABCD" value="${esc(code)}" required /></label>`
              : ""
          }
          <label class="field"><span>Your name</span><input id="access-name" name="name" maxlength="18" minlength="2" autocomplete="nickname" placeholder="Callsign" value="${esc(callsign)}" required /></label>
          <p id="access-error" class="form-error hidden" role="alert"></p>
          <button class="primary-button large full" type="submit" data-access-submit>${mode === "host" ? "Create room" : "Join room"}</button>
        </form>
        <div class="modal-foot">
          <button class="text-button" type="button" data-action="switch-access" data-mode="${mode === "host" ? "join" : "host"}">
            ${mode === "host" ? "I have a room code instead" : "Host a new game instead"}
          </button>
          <button class="text-button" type="button" data-action="open-notes">How to play</button>
        </div>
      </div>`;
    this.showModal("access", content);
    window.setTimeout(() => {
      this.refs?.modalRoot.querySelector<HTMLInputElement>(
        mode === "join" ? "#access-code" : "#access-name",
      )?.focus();
    }, 40);
  }

  private openModal(kind: ModalKind): void {
    if (kind === "notes") {
      this.showModal(
        "notes",
        `<div class="modal-card notes-card" role="dialog" aria-modal="true" aria-labelledby="notes-title">
          <button class="modal-close" type="button" data-action="modal-close" aria-label="Close">×</button>
          <span class="eyebrow">HOW TO PLAY</span>
          <h2 id="notes-title">Build. Explore. Decide together.</h2>
          <p class="modal-lead">RED FRONTIER is a 1–4 player co-op Mars adventure. Everyone moves at the same time, and every job matters.</p>
          <div class="notes-grid">
            <section><h3>1. Build the rover</h3><p>Pick one part for each of eight slots. Parts trade money, weight, battery, speed, and science speed.</p></section>
            <section><h3>2. Explore the basin</h3><p>Walk to glowing markers and hold your ground while the ring fills. Nearby crew members help.</p></section>
            <section><h3>3. Decide together</h3><p>Five surprises pause the world. Read the plain-language choices, vote, and let the host lock it in.</p></section>
          </div>
          <h3 class="notes-heading">The four jobs</h3>
          <div class="notes-roles">
            ${ROLES.map(
              (role) => `<div class="notes-role" style="--role-color:${role.color}">
                <img src="${rolePortrait(role.id)}" alt="" width="48" height="48" />
                <span><strong>${esc(role.name)}</strong><small>${esc(role.firstTask)}</small></span>
              </div>`,
            ).join("")}
          </div>
          <h3 class="notes-heading">Six resources, in everyday words</h3>
          <div class="notes-resources">
            ${RESOURCE_META.map((meta) => `<div><img src="${asset(meta.icon)}" alt="" width="18" height="18" /><span><b>${esc(meta.label)}</b><small>${esc(meta.explanation)}</small></span></div>`).join("")}
          </div>
          <h3 class="notes-heading">The science goals</h3>
          <div class="notes-goals">
            ${SCIENCE_GOALS.map((goal) => `<div><img src="${asset(goal.icon)}" alt="" width="24" height="24" /><span><b>${esc(goal.name)}</b><small>${esc(goal.action)}</small></span></div>`).join("")}
          </div>
          <div class="notes-controls"><kbd>WASD</kbd> / arrows move · <kbd>E</kbd> action · <kbd>Q</kbd> job tool · <kbd>P</kbd> mission panel</div>
          <p class="fine-print">${esc(DISCLAIMER)}</p>
          <h3 class="notes-heading">Learn more</h3>
          <ul class="reference-list">${REFERENCES.map((reference) => `<li><a href="${esc(reference.url)}" target="_blank" rel="noreferrer">${esc(reference.title)}</a><span>${esc(reference.note)}</span></li>`).join("")}</ul>
          <div class="modal-actions"><button class="primary-button" type="button" data-action="modal-close">Got it</button></div>
        </div>`,
      );
      return;
    }
    if (kind === "leave") {
      const room = store.current.room;
      if (!room) return;
      const isHost = room.hostId === store.current.playerId;
      this.showModal(
        "leave",
        `<div class="modal-card confirm-card" role="dialog" aria-modal="true" aria-labelledby="leave-title">
          <button class="modal-close" type="button" data-action="modal-close" aria-label="Close">×</button>
          <span class="eyebrow">LEAVE GAME</span>
          <h2 id="leave-title">Leave room ${esc(room.code)}?</h2>
          <p class="modal-lead">${
            isHost
              ? "Another connected player becomes host. If you are alone, the room closes."
              : "Your crew can keep playing. You can rejoin later with the room code if the game is still open."
          }</p>
          <div class="modal-actions">
            <button class="secondary-button" type="button" data-action="modal-close">Stay</button>
            <button class="danger-button" type="button" data-action="leave-confirm">Leave game</button>
          </div>
        </div>`,
      );
    }
  }

  private showModal(kind: ModalKind, content: string): void {
    const refs = this.refs;
    if (!refs) return;
    this.modal = kind;
    refs.modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop>${content}</div>`;
    refs.modalRoot.classList.remove("hidden");
    refs.modalRoot.setAttribute("aria-hidden", "false");
  }

  private closeModal(): void {
    const refs = this.refs;
    if (!refs) return;
    this.modal = "none";
    refs.modalRoot.classList.add("hidden");
    refs.modalRoot.setAttribute("aria-hidden", "true");
    refs.modalRoot.innerHTML = "";
    this.render(store.current);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      if (this.modal !== "none") {
        this.closeModal();
        return;
      }
      if (this.panelOpen) {
        this.panelOpen = false;
        this.render(store.current);
        return;
      }
      if (this.workshopOpen && store.current.room?.phase === "design") {
        this.workshopOpen = false;
        this.render(store.current);
      }
      return;
    }
    if (event.key.toLowerCase() === "p" && !event.repeat) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      const phase = store.current.room?.phase;
      if (!phase || phase === "lobby" || phase === "debrief") return;
      event.preventDefault();
      this.panelOpen = !this.panelOpen;
      this.lastPanelPaint = 0;
      this.render(store.current);
    }
  }

  private bindTouchControls(): void {
    const refs = this.refs;
    if (!refs) return;
    refs.touchControls.addEventListener("pointerdown", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLElement>("[data-dir]");
      if (button) {
        event.preventDefault();
        const dir = button.dataset.dir as Direction | undefined;
        if (!dir) return;
        setDirection(dir, true);
        button.classList.add("is-active");
        button.setPointerCapture?.(event.pointerId);
        return;
      }
      if (target.closest("#touch-interact")) {
        event.preventDefault();
        setActionHeld(true);
        refs.touchControls.querySelector("#touch-interact")?.classList.add("is-active");
        return;
      }
      if (target.closest("#touch-ability")) {
        event.preventDefault();
        void audio.unlock();
        void net.ability().then((result) => {
          if (result.ok) audio.ability();
          else toast(result.error, "warning");
        });
      }
    });
    refs.touchControls.addEventListener("pointerup", () => this.releaseTouches());
    refs.touchControls.addEventListener("pointerleave", () => this.releaseTouches());
    refs.touchControls.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  private releaseTouches(): void {
    const refs = this.refs;
    if (!refs) return;
    clearTouchState();
    for (const button of refs.touchControls.querySelectorAll(".is-active")) {
      button.classList.remove("is-active");
    }
  }

  private syncSound(): void {
    const refs = this.refs;
    if (!refs) return;
    refs.soundLabel.textContent = audio.isMuted ? "Muted" : "Sound on";
    refs.soundButton.setAttribute("aria-pressed", String(!audio.isMuted));
    refs.soundButton.title = audio.isMuted ? "Turn sound on" : "Turn sound off";
  }

  private storeCoach(): void {
    try {
      localStorage.setItem(COACH_KEY, String(this.coachStep));
    } catch {
      // Onboarding progress is optional.
    }
  }
}

const controller = new UiController();

export function initUI(): void {
  controller.init();
}

export function setBootProgress(value: number, label: string): void {
  controller.setBootProgress(value, label);
}

export function finishBoot(): void {
  controller.finishBoot();
}

export function showBootError(message: string): void {
  controller.showBootError(message);
}
