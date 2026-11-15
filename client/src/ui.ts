import {
  BASE_SYSTEM_MASS,
  DESIGN_BUDGET,
  DISCLAIMER,
  MAX_MODULES,
  MIN_MODULES,
  MODULES,
  QUICK_COMMS,
  REFERENCES,
  RESOURCE_META,
  ROLES,
  roleById,
} from "../../shared/content";
import { formatClock } from "../../shared/rules";
import type {
  Ack,
  ActiveEventPublic,
  MissionLogEntry,
  MissionState,
  ModuleId,
  ObjectiveState,
  PlayerPublic,
  ResourceId,
  RoleId,
  RoomPublic,
} from "../../shared/types";
import { MAX_PLAYERS } from "../../shared/types";
import { PORTRAIT_FILES } from "./assets";
import { audio } from "./audio";
import { clearTouchState, setActionHeld, setDirection, type Direction } from "./controls";
import { net } from "./net";
import { localPresence } from "./presence";
import { appBus, store, toast, type GameState, type ToastDetail, type ToastTone } from "./store";

type ModalKind = "none" | "access" | "notes" | "confirm" | "event";

interface UiRefs {
  app: HTMLElement;
  netDot: HTMLElement;
  netLabel: HTMLElement;
  topRoom: HTMLElement;
  soundLabel: HTMLElement;
  missionHud: HTMLElement;
  resourceStrip: HTMLElement;
  goalText: HTMLElement;
  titleOverlay: HTMLElement;
  lobbyOverlay: HTMLElement;
  lobbyPhase: HTMLElement;
  lobbyCode: HTMLElement;
  lobbyCaption: HTMLElement;
  missionOverlay: HTMLElement;
  sectorLine: HTMLElement;
  eventChipLabel: HTMLElement;
  missionToast: HTMLElement;
  objectiveChip: HTMLElement;
  objectiveIcon: HTMLElement;
  objectiveName: HTMLElement;
  objectiveDistance: HTMLElement;
  nearbyPrompt: HTMLElement;
  nearbyIcon: HTMLElement;
  nearbyTitle: HTMLElement;
  nearbySub: HTMLElement;
  nearbyProgress: HTMLElement;
  progressTitle: HTMLElement;
  progressPct: HTMLElement;
  progressFill: HTMLElement;
  localCoord: HTMLElement;
  linkQuality: HTMLElement;
  debriefOverlay: HTMLElement;
  debriefKicker: HTMLElement;
  debriefTitle: HTMLElement;
  debriefReason: HTMLElement;
  debriefBanner: HTMLElement;
  waitingOverlay: HTMLElement;
  waitingText: HTMLElement;
  touchControls: HTMLElement;
  railContent: HTMLElement;
  underStatus: HTMLElement;
  toastStack: HTMLElement;
  modalRoot: HTMLElement;
  bootOverlay: HTMLElement;
  bootFill: HTMLElement;
  bootStatus: HTMLElement;
  bootRetry: HTMLElement;
  soundButton: HTMLElement;
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}`);
  return element as T;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resourceValue(resources: MissionState["resources"], id: ResourceId): string {
  if (id === "budget") return String(Math.round(resources.budget));
  if (id === "mass") return `${Math.round(resources.mass)}%`;
  if (id === "power") return `${Math.round(resources.power)}%`;
  if (id === "data") return String(Math.round(resources.data));
  if (id === "comms") return `${Math.round(resources.comms)}%`;
  return formatClock(resources.time);
}

function resourceUnit(id: ResourceId): string {
  if (id === "budget") return "CR";
  if (id === "data") return "TB";
  if (id === "time") return "CLOCK";
  if (id === "mass") return "MARGIN";
  return "%";
}

function effectLabel(key: string): string {
  if (key === "budget") return "budget";
  if (key === "mass") return "mass";
  if (key === "power") return "power";
  if (key === "data") return "data";
  if (key === "comms") return "comms";
  return "time";
}

function effectTags(effects: Partial<MissionState["resources"]>): string {
  return (Object.entries(effects) as [ResourceId, number][])
    .filter(([, value]) => value !== 0)
    .map(([key, value]) => {
      const suffix = key === "time" ? "s" : "";
      return `<span class="effect-tag ${value > 0 ? "good" : "bad"}">${value > 0 ? "+" : ""}${value}${suffix} ${effectLabel(key)}</span>`;
    })
    .join("");
}

function objectiveKindLabel(kind: ObjectiveState["kind"]): string {
  if (kind === "sample") return "FIELD SAMPLE";
  if (kind === "relay") return "RELAY REPAIR";
  if (kind === "cache") return "SUPPLY RECOVERY";
  return "LANDER DOWNLINK";
}

function interactionAction(kind: ObjectiveState["kind"]): string {
  if (kind === "sample") return "HOLD E / ACTION TO DRILL";
  if (kind === "relay") return "HOLD E / ACTION TO ALIGN";
  if (kind === "cache") return "HOLD E / ACTION TO RECOVER";
  return "HOLD E / ACTION TO DOWNLINK";
}

function interactionIcon(kind: ObjectiveState["kind"]): string {
  if (kind === "sample") return "◇";
  if (kind === "relay") return "⌁";
  if (kind === "cache") return "▣";
  return "▲";
}

function phaseLabel(phase: string): string {
  if (phase === "lobby") return "CREW LINK";
  if (phase === "design") return "ROVER BAY";
  if (phase === "launch") return "LAUNCH";
  if (phase === "mission") return "SURFACE";
  return "DEBRIEF";
}

class UiController {
  private initialized = false;
  private refs = {} as UiRefs;
  private storeUnsubscribe: (() => void) | null = null;
  private railSignature = "";
  private tickTimer = 0;
  private modalKind: ModalKind = "none";
  private eventSignature = "";
  private booted = false;
  private bootHideTimer: number | null = null;
  private missionToastTimer: number | null = null;
  private lastMissionId = "";
  private lastEventAlertId = "";
  private lastOutcomeAt = 0;
  private lastResultKey = "";
  private lastLogSignature = "";
  private audioScene = "";

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.refs = {
      app: byId("app"),
      netDot: byId("net-dot"),
      netLabel: byId("net-label"),
      topRoom: byId("top-room"),
      soundLabel: byId("sound-label"),
      missionHud: byId("mission-hud"),
      resourceStrip: byId("resource-strip"),
      goalText: byId("goal-text"),
      titleOverlay: byId("title-overlay"),
      lobbyOverlay: byId("lobby-overlay"),
      lobbyPhase: byId("lobby-tag-phase"),
      lobbyCode: byId("lobby-tag-code"),
      lobbyCaption: byId("lobby-caption-text"),
      missionOverlay: byId("mission-overlay"),
      sectorLine: byId("sector-line"),
      eventChipLabel: byId("event-chip-label"),
      missionToast: byId("mission-toast"),
      objectiveChip: byId("objective-chip"),
      objectiveIcon: byId("objective-chip").querySelector(".objective-icon") as HTMLElement,
      objectiveName: byId("objective-chip-name"),
      objectiveDistance: byId("objective-chip-distance"),
      nearbyPrompt: byId("nearby-prompt"),
      nearbyIcon: byId("nearby-icon"),
      nearbyTitle: byId("nearby-title"),
      nearbySub: byId("nearby-sub"),
      nearbyProgress: byId("nearby-progress"),
      progressTitle: byId("progress-title"),
      progressPct: byId("progress-pct"),
      progressFill: byId("progress-fill"),
      localCoord: byId("local-coord"),
      linkQuality: byId("link-quality"),
      debriefOverlay: byId("debrief-overlay"),
      debriefKicker: byId("debrief-kicker"),
      debriefTitle: byId("debrief-title"),
      debriefReason: byId("debrief-reason"),
      debriefBanner: byId("debrief-overlay").querySelector(".debrief-banner") as HTMLElement,
      waitingOverlay: byId("waiting-overlay"),
      waitingText: byId("waiting-text"),
      touchControls: byId("touch-controls"),
      railContent: byId("rail-content"),
      underStatus: byId("under-status"),
      toastStack: byId("toast-stack"),
      modalRoot: byId("modal-root"),
      bootOverlay: byId("boot-overlay"),
      bootFill: byId("boot-fill"),
      bootStatus: byId("boot-status"),
      bootRetry: byId("boot-retry"),
      soundButton: byId("sound-button"),
    };

    this.bindEvents();
    this.syncSoundLabel();
    this.updateStageScale();
    this.storeUnsubscribe = store.subscribe((state) => this.render(state));
    this.render(store.current);
    this.tickTimer = window.setInterval(() => this.tick(), 200);
  }

  setBootProgress(value: number, label: string): void {
    if (!this.initialized) return;
    const bounded = clamp(value, 0, 1);
    this.refs.bootFill.style.width = `${Math.round(bounded * 100)}%`;
    this.refs.bootStatus.textContent = label;
    this.refs.bootRetry.classList.add("hidden");
    this.refs.bootFill.style.background = "";
  }

  finishBoot(): void {
    if (!this.initialized || this.booted) return;
    this.booted = true;
    this.refs.bootFill.style.width = "100%";
    this.refs.bootStatus.textContent = "SURFACE LINK READY";
    this.refs.bootOverlay.classList.add("is-hiding");
    this.refs.bootOverlay.setAttribute("aria-hidden", "true");
    if (this.bootHideTimer !== null) window.clearTimeout(this.bootHideTimer);
    this.bootHideTimer = window.setTimeout(() => {
      this.refs.bootOverlay.classList.add("hidden");
    }, 320);
  }

  showBootError(message: string): void {
    if (!this.initialized) return;
    this.refs.bootStatus.textContent = message;
    this.refs.bootFill.style.background = "var(--danger)";
    this.refs.bootRetry.classList.remove("hidden");
  }

  private bindEvents(): void {
    const unlock = (): void => {
      void audio.unlock();
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });

    document.addEventListener("click", (event) => {
      void audio.unlock();
      const target = event.target as HTMLElement | null;
      const actionElement = target?.closest<HTMLElement>("[data-action]");
      if (actionElement) {
        event.preventDefault();
        audio.click();
        this.handleAction(actionElement);
        return;
      }
      const closeElement = target?.closest<HTMLElement>("[data-modal-close]");
      if (closeElement) {
        event.preventDefault();
        this.closeModal();
        return;
      }
      if (target === this.refs.modalRoot && this.modalKind !== "event") {
        this.closeModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.modalKind !== "none" && this.modalKind !== "event") {
        this.closeModal();
      }
    });

    this.refs.modalRoot.addEventListener("submit", (event) => {
      const form = event.target as HTMLFormElement;
      if (form.dataset.form !== "access") return;
      event.preventDefault();
      void this.submitAccess(form);
    });

    appBus.addEventListener("toast", (event) => {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      this.pushToast(detail.message, detail.tone ?? "info", detail.ttl ?? 5_200);
    });
    appBus.addEventListener("session-message", (event) => {
      const message = (event as CustomEvent<string>).detail;
      toast(message, "warning", 6_500);
    });
    appBus.addEventListener("comm", (event) => {
      const detail = (event as CustomEvent<{ name: string; text: string }>).detail;
      this.flashMissionToast(`${detail.name}: ${detail.text}`, 4_800);
    });

    window.addEventListener("resize", () => this.updateStageScale());

    for (const button of document.querySelectorAll<HTMLElement>("[data-dir]")) {
      const direction = button.dataset.dir as Direction | undefined;
      if (!direction) continue;
      const press = (event: PointerEvent): void => {
        event.preventDefault();
        button.classList.add("active");
        setDirection(direction, true);
      };
      const release = (event: PointerEvent): void => {
        event.preventDefault();
        button.classList.remove("active");
        setDirection(direction, false);
      };
      button.addEventListener("pointerdown", press);
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("pointerleave", release);
    }

    const interactButton = byId("touch-interact");
    const interactPress = (event: PointerEvent): void => {
      event.preventDefault();
      interactButton.classList.add("active");
      setActionHeld(true);
    };
    const interactRelease = (event: PointerEvent): void => {
      event.preventDefault();
      interactButton.classList.remove("active");
      setActionHeld(false);
    };
    interactButton.addEventListener("pointerdown", interactPress);
    interactButton.addEventListener("pointerup", interactRelease);
    interactButton.addEventListener("pointercancel", interactRelease);
    interactButton.addEventListener("pointerleave", interactRelease);

    byId("touch-ability").addEventListener("click", (event) => {
      event.preventDefault();
      if (store.current.room?.phase === "mission") void this.performAbility();
    });
  }

  private render(state: GameState): void {
    if (!this.initialized) return;
    this.updateChrome(state);
    this.updateOverlays(state);
    this.updateRail(state);
    this.syncEventModal(state);
    this.updateResult(state);
    this.updateOutcome(state);
    this.updateAudioScene(state);
    this.updateMissionHud(state);
    this.updateLaunchTimer();
    this.updateEventTimer();
  }

  private updateChrome(state: GameState): void {
    const labels: Record<GameState["connection"], string> = {
      connecting: "SURFACE LINK: CONNECTING",
      online: "SURFACE LINK: ONLINE",
      offline: "SURFACE LINK: OFFLINE",
    };
    this.refs.netDot.dataset.state = state.connection;
    this.refs.netLabel.textContent = labels[state.connection];
    const room = state.room;
    if (room) {
      this.refs.topRoom.classList.remove("hidden");
      this.refs.topRoom.textContent = `ROOM ${room.code}`;
    } else {
      this.refs.topRoom.classList.add("hidden");
    }

    const phase = room?.phase;
    if (!phase) {
      this.refs.underStatus.textContent =
        state.connection === "online" ? "SURFACE LINK STANDBY" : "SURFACE LINK CONNECTING";
    } else if (phase === "lobby") {
      this.refs.underStatus.textContent = "CREW LINK OPEN · WAITING FOR READY";
    } else if (phase === "design") {
      this.refs.underStatus.textContent = "ROVER BAY OPEN · CONFIGURE PAYLOAD";
    } else if (phase === "launch") {
      this.refs.underStatus.textContent = "LAUNCH SEQUENCE SYNCED · ALL CREW";
    } else if (phase === "mission") {
      this.refs.underStatus.textContent = "SURFACE LINK ACTIVE · REAL-TIME CO-OP";
    } else {
      this.refs.underStatus.textContent = "MISSION COMPLETE · DEBRIEF";
    }
    this.refs.app.dataset.phase = phase ?? "title";
    this.syncSoundLabel();
  }

  private updateOverlays(state: GameState): void {
    const room = state.room;
    const phase = room?.phase ?? null;
    this.show(this.refs.titleOverlay, !room && !state.resuming);
    this.show(this.refs.lobbyOverlay, phase === "lobby" || phase === "design");
    this.show(this.refs.missionOverlay, phase === "mission");
    this.show(this.refs.missionHud, phase === "mission");
    this.show(this.refs.debriefOverlay, phase === "debrief");
    this.show(this.refs.waitingOverlay, phase === "launch" || (!room && state.resuming));
    this.show(this.refs.touchControls, phase === "mission");

    if (phase !== "mission") clearTouchState();

    if (room) {
      this.refs.lobbyCode.textContent = room.code;
      this.refs.lobbyPhase.textContent = phaseLabel(room.phase);
      this.refs.lobbyCaption.textContent =
        phase === "design"
          ? "The crew is configuring the MERIDIAN rover. Payload choices are shared by everyone."
          : "Share the mission code. Every crew member must take a station and mark ready before the rover bay opens.";
    }

    if (phase === "launch" || (!room && state.resuming)) {
      if (!room) this.refs.waitingText.textContent = "RESTORING CREW LINK";
    }

    if (room?.mission?.result) {
      const result = room.mission.result;
      this.refs.debriefKicker.textContent = result.success
        ? "MISSION DEBRIEF / SCIENCE RECEIVED"
        : "MISSION DEBRIEF / WINDOW CLOSED";
      this.refs.debriefTitle.textContent = result.headline;
      this.refs.debriefReason.textContent = result.reason;
      this.refs.debriefBanner.classList.toggle("is-failure", !result.success);
    }
  }

  private updateRail(state: GameState): void {
    const signature = this.railSignatureFor(state);
    if (signature === this.railSignature) {
      if (state.room?.phase === "mission") this.updateMissionLive(state);
      return;
    }
    this.railSignature = signature;
    const scrollTop = this.refs.railContent.scrollTop;
    const room = state.room;
    this.refs.railContent.dataset.phase = room?.phase ?? "title";

    if (!room) {
      this.refs.railContent.innerHTML = this.titleRailHtml(state);
    } else if (room.phase === "lobby") {
      this.refs.railContent.innerHTML = this.lobbyRailHtml(state, room);
    } else if (room.phase === "design") {
      this.refs.railContent.innerHTML = this.designRailHtml(state, room);
    } else if (room.phase === "launch") {
      this.refs.railContent.innerHTML = this.launchRailHtml(state, room);
    } else if (room.phase === "mission") {
      this.refs.railContent.innerHTML = this.missionRailHtml(state, room);
    } else {
      this.refs.railContent.innerHTML = this.debriefRailHtml(state, room);
    }
    this.refs.railContent.scrollTop = scrollTop;
    if (room?.phase === "mission") this.updateMissionLive(state);
  }

  private railSignatureFor(state: GameState): string {
    const room = state.room;
    if (!room) return `title:${state.connection}`;
    const players = room.players.map(
      (player) =>
        `${player.id}:${player.name}:${player.role ?? "none"}:${player.ready ? 1 : 0}:${player.connected ? 1 : 0}:${player.host ? 1 : 0}`,
    );
    const objectives = room.mission?.objectives.map(
      (objective) => `${objective.id}:${objective.unlocked ? 1 : 0}:${objective.completed ? 1 : 0}`,
    );
    return JSON.stringify({
      phase: room.phase,
      host: room.hostId,
      me: state.playerId,
      players,
      design: room.design,
      attempt: room.attempt,
      mission: room.mission?.missionId ?? null,
      events: room.mission?.eventsResolved ?? 0,
      event: room.mission?.activeEvent
        ? `${room.mission.activeEvent.id}:${room.mission.activeEvent.resolution}`
        : null,
      objectives,
      result: room.mission?.result ? `${room.mission.result.grade}:${room.mission.result.score}` : null,
    });
  }

  private titleRailHtml(state: GameState): string {
    return `
      <div class="dossier-hero">
        <div class="rail-kicker"><span class="status-tick"></span> ARES SURVEY PROGRAM / DOSSIER 01</div>
        <h2>Red Frontier:<br />Mission Mars</h2>
        <p>A cooperative field-science mission for one to four crew. Design a rover, cross Ares Basin, and return the science before the window closes.</p>
      </div>
      <div class="dossier-stats">
        <div class="dossier-stat"><span>CREW</span><strong>1–4 PLAYERS</strong></div>
        <div class="dossier-stat"><span>SURFACE CLOCK</span><strong>6:00</strong></div>
        <div class="dossier-stat"><span>FIELD SITES</span><strong>5 + LANDER</strong></div>
        <div class="dossier-stat"><span>NETWORK</span><strong>${state.connection === "online" ? "REAL-TIME" : "LINK OFFLINE"}</strong></div>
      </div>
      <div class="rail-section">
        <div class="section-head"><h3>MISSION BRIEF</h3><span>ARES BASIN</span></div>
        <ul class="brief-list">
          <li><span><strong>Assemble the crew.</strong> Take one of four flight stations and share the four-character mission code.</span></li>
          <li><span><strong>Design the rover.</strong> Two or three payload modules, thirty payload credits, one shared machine.</span></li>
          <li><span><strong>Work the surface.</strong> Complete five field objectives, survive five crew dilemmas, then transmit from the lander.</span></li>
          <li><span><strong>Bring the science home.</strong> Watch power, comms and the mission clock. Every choice is shared.</span></li>
        </ul>
      </div>
      <div class="rail-section">
        <div class="section-head"><h3>FLIGHT STATIONS</h3><span>UNIQUE ROLES</span></div>
        <div class="rail-list">
          ${ROLES.map(
            (role) => `
              <div class="crew-row">
                <div class="crew-avatar"><img class="crew-avatar-portrait" src="/assets/ui/role_${role.id}.png" alt="" /></div>
                <div class="crew-info"><div class="crew-name">${esc(role.name)}</div><div class="crew-role">${esc(role.ability.name)} · ${esc(role.passive)}</div></div>
              </div>`,
          ).join("")}
        </div>
      </div>
      <div class="rail-actions">
        <button class="primary-button" type="button" data-action="host-room"><span class="button-index">01</span> HOST MISSION</button>
        <button class="secondary-button" type="button" data-action="join-room"><span class="button-index">02</span> JOIN CREW</button>
        <button class="ghost-button" type="button" data-action="open-notes">FIELD NOTES &amp; REFERENCES</button>
      </div>
      <p class="hint-line">Original fictional project. NASA does not endorse this game. All mission values are simplified educational gameplay values.</p>
    `;
  }

  private lobbyRailHtml(state: GameState, room: RoomPublic): string {
    const me = room.players.find((player) => player.id === state.playerId) ?? null;
    const connected = room.players.filter((player) => player.connected);
    const allReady = connected.length > 0 && connected.every((player) => player.ready);
    const allStations = room.players.every((player) => player.role !== null);
    const isHost = room.hostId === state.playerId;
    const emptySlots = Math.max(0, MAX_PLAYERS - room.players.length);

    return `
      <div class="rail-head">
        <div class="rail-kicker"><span class="status-tick"></span> CREW LINK / ${room.code}</div>
        <h2>Crew Assembly</h2>
        <p>Share the code with your crew. Every connected member needs a flight station and a ready check before the rover bay opens.</p>
        <div class="room-code-box">
          <div><span>MISSION CODE</span><strong>${room.code}</strong></div>
          <button class="mini-button" type="button" data-action="copy-code">COPY</button>
        </div>
      </div>
      <div class="rail-section">
        <div class="section-head"><h3>CREW MANIFEST</h3><span>${room.players.length}/${MAX_PLAYERS}</span></div>
        <div class="rail-list">
          ${room.players.map((player) => this.crewRowHtml(player, state.playerId, false)).join("")}
          ${Array.from({ length: emptySlots })
            .map(() => `<div class="empty-slot">OPEN STATION · SHARE ${room.code}</div>`)
            .join("")}
        </div>
      </div>
      <div class="rail-section">
        <div class="section-head"><h3>SELECT STATION</h3><span>UNIQUE ROLES</span></div>
        <div class="role-grid">
          ${ROLES.map((role) => {
            const selected = me?.role === role.id;
            const takenBy = room.players.find(
              (player) => player.role === role.id && player.id !== state.playerId,
            );
            return `
              <button class="role-option ${selected ? "selected" : ""} ${takenBy ? "taken" : ""}" type="button"
                data-action="select-role" data-role="${role.id}" ${takenBy ? "disabled" : ""}
                title="${takenBy ? `Crewed by ${esc(takenBy.name)}` : esc(role.brief)}">
                <img src="/assets/ui/role_${role.id}.png" alt="" />
                <span>
                  <span class="role-option-name">${esc(role.name)}</span>
                  <span class="role-option-tag">${selected ? "YOUR STATION" : takenBy ? `CREWED BY ${esc(takenBy.name.toUpperCase())}` : esc(role.ability.name.toUpperCase())}</span>
                </span>
              </button>`;
          }).join("")}
        </div>
        ${me?.role ? `<p class="hint-line"><strong>${esc(roleById(me.role)?.ability.name ?? "")}:</strong> ${esc(roleById(me.role)?.ability.description ?? "")}</p>` : ""}
      </div>
      <div class="rail-section">
        <div class="section-head"><h3>FLIGHT DIRECTOR</h3><span>${esc(room.players.find((player) => player.id === room.hostId)?.name ?? "—")}</span></div>
        <div class="ready-pips">
          ${connected.map((player) => `<span class="ready-pip ${player.ready ? "on" : ""}" title="${esc(player.name)}"></span>`).join("")}
          <span class="hint-line">${connected.filter((player) => player.ready).length}/${connected.length} READY</span>
        </div>
        <p class="hint-line">${allReady ? "All connected crew are ready. The flight director can open the rover bay." : "All connected crew must mark ready. Changing station clears your ready check."}</p>
      </div>
      <div class="rail-actions">
        <button class="${me?.ready ? "secondary-button" : "primary-button"}" type="button" data-action="toggle-ready" ${me?.role ? "" : "disabled"}>
          ${me?.ready ? "STAND BY · READY" : "MARK READY"}
        </button>
        ${
          isHost
            ? `<button class="secondary-button" type="button" data-action="open-bay" ${allReady && allStations ? "" : "disabled"}>OPEN ROVER BAY</button>`
            : `<p class="hint-line">Waiting for the flight director to open the rover bay.</p>`
        }
        <button class="ghost-button" type="button" data-action="open-notes">FIELD NOTES</button>
        <button class="danger-button" type="button" data-action="leave-room">LEAVE CREW</button>
      </div>
      <p class="hint-line">Mission code is case-insensitive. Session recovery keeps your station after a page refresh.</p>
    `;
  }

  private designRailHtml(state: GameState, room: RoomPublic): string {
    const me = room.players.find((player) => player.id === state.playerId) ?? null;
    const connected = room.players.filter((player) => player.connected);
    const allReady = connected.length > 0 && connected.every((player) => player.ready);
    const isHost = room.hostId === state.playerId;
    const selected = new Set(room.design.modules);
    const massMargin = clamp(100 - BASE_SYSTEM_MASS - room.design.mass, 0, 100);
    const creditsPct = clamp((room.design.cost / DESIGN_BUDGET) * 100, 0, 100);

    return `
      <div class="rail-head">
        <div class="rail-kicker"><span class="status-tick"></span> ROVER BAY / ${room.code}</div>
        <h2>MERIDIAN<br />Payload Design</h2>
        <p>The design is shared. Choose two or three payload modules under the thirty-credit cap, then every crew member certifies the build.</p>
        <div class="design-meter">
          <div class="meter-row"><span>PAYLOAD CREDITS</span><strong>${room.design.cost} / ${DESIGN_BUDGET}</strong></div>
          <div class="meter-track"><div class="meter-fill" style="width:${creditsPct}%"></div></div>
          <div class="meter-row" style="margin-top:6px"><span>MASS MARGIN</span><strong>${Math.round(massMargin)}%</strong></div>
          <div class="meter-track"><div class="meter-fill teal" style="width:${massMargin}%"></div></div>
        </div>
      </div>
      <div class="rail-section">
        <div class="section-head">
          <h3>PAYLOAD BAY</h3>
          <span class="module-slots">${[0, 1, 2]
            .map((index) => `<span class="module-slot ${index < room.design.modules.length ? "on" : ""}"></span>`)
            .join("")} ${room.design.modules.length}/${MAX_MODULES}</span>
        </div>
        <div class="design-grid">
          ${MODULES.map((module) => {
            const isSelected = selected.has(module.id);
            const disabled = !isSelected && room.design.modules.length >= MAX_MODULES;
            return `
              <button class="module-card ${isSelected ? "selected" : ""}" type="button"
                data-action="toggle-module" data-module="${module.id}" ${disabled ? "disabled" : ""}>
                <img src="/assets/${module.file}" alt="" />
                <span class="module-info">
                  <span class="module-name">${esc(module.name)}</span>
                  <span class="module-effect">${esc(module.effect)}</span>
                </span>
                <span class="module-stats"><span>${module.cost} CR</span><span>${module.mass} KG</span></span>
              </button>`;
          }).join("")}
        </div>
        <p class="hint-line">${room.design.modules.length < MIN_MODULES ? `Install at least ${MIN_MODULES} modules before launch.` : "Payload configuration is within launch limits."} Every value is a simplified gameplay value.</p>
      </div>
      <div class="rail-section">
        <div class="section-head"><h3>DESIGN CERTIFICATION</h3><span>${connected.filter((player) => player.ready).length}/${connected.length} READY</span></div>
        <div class="rail-list">
          ${room.players.map((player) => this.crewRowHtml(player, state.playerId, false)).join("")}
        </div>
      </div>
      <div class="rail-actions">
        <button class="${me?.ready ? "secondary-button" : "primary-button"}" type="button" data-action="toggle-ready">
          ${me?.ready ? "DESIGN CERTIFIED · WITHDRAW" : "CERTIFY DESIGN"}
        </button>
        ${
          isHost
            ? `<button class="primary-button" type="button" data-action="start-launch" ${allReady && room.design.modules.length >= MIN_MODULES ? "" : "disabled"}>BEGIN LAUNCH</button>`
            : `<p class="hint-line">Waiting for the flight director to begin launch.</p>`
        }
        <button class="ghost-button" type="button" data-action="open-notes">FIELD NOTES</button>
        <button class="danger-button" type="button" data-action="leave-room">LEAVE CREW</button>
      </div>
      <p class="hint-line">Changing the shared design clears every ready check. The flight director launches for the whole crew.</p>
    `;
  }

  private launchRailHtml(_state: GameState, room: RoomPublic): string {
    const designNames = room.design.modules
      .map((id) => MODULES.find((module) => module.id === id)?.name ?? id)
      .join(" · ");
    return `
      <div class="rail-head">
        <div class="rail-kicker"><span class="status-tick"></span> LAUNCH SEQUENCE / ATTEMPT ${String(room.attempt).padStart(2, "0")}</div>
        <h2>Meridian<br />Ascent</h2>
        <p>The launch is synchronised for the entire crew. The surface link will hand over automatically at touchdown.</p>
        <div class="room-code-box">
          <div><span>LAUNCH CLOCK</span><strong id="launch-countdown">T-00:14</strong></div>
          <span class="mini-button">SYNCED</span>
        </div>
      </div>
      <div class="rail-section">
        <div class="section-head"><h3>FLIGHT CONFIGURATION</h3><span>${room.design.modules.length} MODULES</span></div>
        <p class="rail-copy">${esc(designNames)}</p>
        <p class="hint-line">Payload cost ${room.design.cost}/${DESIGN_BUDGET} credits · payload mass ${room.design.mass} kg.</p>
      </div>
      <div class="rail-section">
        <div class="section-head"><h3>CREW ABOARD</h3><span>${room.players.length}/${MAX_PLAYERS}</span></div>
        <div class="rail-list">${room.players.map((player) => this.crewRowHtml(player, _state.playerId, true)).join("")}</div>
      </div>
      <div class="rail-actions">
        <button class="ghost-button" type="button" data-action="open-notes">FIELD NOTES</button>
      </div>
      <p class="hint-line">Do not close the tab. A dropped surface link reconnects automatically during the mission.</p>
    `;
  }

  private missionRailHtml(state: GameState, room: RoomPublic): string {
    const mission = room.mission;
    if (!mission) return "";
    const me = room.players.find((player) => player.id === state.playerId) ?? null;
    const role = roleById(me?.role ?? null);
    const completedFields = mission.objectives.filter(
      (objective) => objective.completed && objective.kind !== "transmit",
    ).length;
    const ability = this.abilityState(mission, state.playerId);

    return `
      <div class="rail-head">
        <div class="rail-kicker"><span class="status-tick"></span> SURFACE OPERATIONS / ${room.code}</div>
        <h2>Ares Basin</h2>
        <p>Complete five field objectives, then return to the lander for the science downlink. Keep the rover bus alive.</p>
        <div class="room-code-box">
          <div><span>MISSION CLOCK</span><strong id="mission-clock-rail">${formatClock(mission.resources.time)}</strong></div>
          <div><span>DATA</span><strong id="mission-data-rail">${Math.round(mission.resources.data)} / ${mission.dataTarget}</strong></div>
        </div>
      </div>
      <div class="rail-section">
        <div class="section-head"><h3>FIELD OBJECTIVES</h3><span id="mission-objective-count">${completedFields}/${mission.objectives.length - 1}</span></div>
        <div class="objectives-list">
          ${mission.objectives.map((objective) => this.objectiveRowHtml(objective, state)).join("")}
        </div>
      </div>
      <div class="rail-section">
        <div class="section-head"><h3>YOUR STATION</h3><span>${esc(role?.shortName ?? "NO STATION")}</span></div>
        <div class="ability-panel">
          <div class="ability-panel-top">
            <span class="ability-name">${esc(role?.ability.name ?? "No station tool")}</span>
            <span class="ability-cooldown" id="mission-ability-state">${ability.label}</span>
          </div>
          <p>${esc(role?.ability.description ?? "The flight director has not assigned a station tool.")}</p>
          <button class="ability-inline-button" id="mission-ability" type="button" data-action="ability" ${ability.disabled ? "disabled" : ""}>USE STATION TOOL [Q]</button>
          ${role ? `<p>${esc(role.passive)}</p>` : ""}
        </div>
        <div class="rail-list" style="margin-top:8px">
          ${room.players.map((player) => this.crewRowHtml(player, state.playerId, true)).join("")}
        </div>
      </div>
      <div class="rail-section">
        <div class="section-head"><h3>CREW COMMS</h3><span>QUICK TEXT</span></div>
        <div class="quick-comms">
          ${QUICK_COMMS.map(
            (message) =>
              `<button class="quick-comm" type="button" data-action="quick-comm" data-text="${esc(message)}" ${mission.activeEvent || mission.result ? "disabled" : ""}>${esc(message)}</button>`,
          ).join("")}
        </div>
      </div>
      <div class="rail-section">
        <div class="section-head"><h3>EVENT STATUS</h3><span id="mission-events-count">${mission.eventsResolved}/${mission.eventsTotal}</span></div>
        <div id="mission-event-status">${this.eventStatusHtml(mission)}</div>
      </div>
      <div class="rail-section">
        <div class="section-head"><h3>MISSION LOG</h3><span>LIVE</span></div>
        <div class="log-list" id="mission-log">${this.logHtml(mission.log, mission.startedAt)}</div>
      </div>
      <p class="hint-line">All resources, costs and timings are simplified educational gameplay values — not operational specifications.</p>
    `;
  }

  private debriefRailHtml(state: GameState, room: RoomPublic): string {
    const mission = room.mission;
    const result = mission?.result;
    const isHost = room.hostId === state.playerId;
    if (!mission || !result) {
      return `<div class="rail-section"><p class="rail-copy">Closing the surface link…</p></div>`;
    }
    return `
      <div class="grade-block">
        <div class="grade-letter">${result.grade}</div>
        <div class="grade-copy">
          <strong>${esc(result.headline)}</strong>
          <span>SCORE ${result.score.toLocaleString("en-US")} · ATTEMPT ${String(room.attempt).padStart(2, "0")}</span>
        </div>
      </div>
      <div class="rail-section">
        <div class="section-head"><h3>MISSION DEBRIEF</h3><span>${result.success ? "SUCCESS" : "FAILED"}</span></div>
        <p class="rail-copy">${esc(result.reason)}</p>
        <div class="stat-grid" style="margin-top:9px">
          <div class="stat-cell"><span>FIELD OBJECTIVES</span><strong>${result.stats.objectivesComplete}/${result.stats.objectivesTotal}</strong></div>
          <div class="stat-cell"><span>SCIENCE DATA</span><strong>${result.stats.dataCollected} TB</strong></div>
          <div class="stat-cell"><span>SAMPLES</span><strong>${result.stats.samples}</strong></div>
          <div class="stat-cell"><span>EVENTS RESOLVED</span><strong>${result.stats.eventsResolved}/5</strong></div>
          <div class="stat-cell"><span>POWER LEFT</span><strong>${result.stats.powerRemaining}%</strong></div>
          <div class="stat-cell"><span>TIME LEFT</span><strong>${formatClock(result.stats.timeRemaining)}</strong></div>
          <div class="stat-cell"><span>BUDGET LEFT</span><strong>${result.stats.budgetRemaining} CR</strong></div>
          <div class="stat-cell"><span>MASS MARGIN</span><strong>${result.stats.massMargin}%</strong></div>
        </div>
      </div>
      <div class="rail-section">
        <div class="section-head"><h3>FLIGHT RECORD</h3><span>CREW</span></div>
        <div class="rail-list">${room.players.map((player) => this.crewRowHtml(player, state.playerId, true)).join("")}</div>
        <p class="hint-line" style="margin-top:8px">Design: ${esc(
          room.design.modules
            .map((id) => MODULES.find((module) => module.id === id)?.name ?? id)
            .join(" · "),
        )}</p>
      </div>
      <div class="rail-actions">
        ${
          isHost
            ? `<button class="primary-button" type="button" data-action="retry-mission">RETRY MISSION</button>
               <button class="secondary-button" type="button" data-action="return-lobby">RETURN TO CREW LINK</button>`
            : `<p class="hint-line">The flight director can retry the launch with the same rover design, or recall the crew to the lobby.</p>`
        }
        <button class="ghost-button" type="button" data-action="open-notes">FIELD NOTES &amp; REFERENCES</button>
        <button class="danger-button" type="button" data-action="leave-room">LEAVE CREW</button>
      </div>
      <p class="hint-line">Red Frontier is an original fictional game. NASA does not endorse it. All statistics are simplified educational gameplay values.</p>
    `;
  }

  private crewRowHtml(player: PlayerPublic, playerId: string | null, compact: boolean): string {
    const role = roleById(player.role);
    const isYou = player.id === playerId;
    const avatar = player.character ? PORTRAIT_FILES[player.character] : null;
    const flags = compact
      ? `${player.host ? '<span class="host-chip">FD</span>' : ""}${player.connected ? "" : '<span class="ready-chip">LINK LOST</span>'}`
      : `${player.host ? '<span class="host-chip">FD</span>' : ""}${player.ready ? '<span class="ready-chip">READY</span>' : ""}${player.connected ? "" : '<span class="ready-chip">LINK LOST</span>'}`;
    return `
      <div class="crew-row ${isYou ? "is-you" : ""} ${player.connected ? "" : "offline"}">
        <div class="crew-avatar">
          ${avatar ? `<img class="crew-avatar-portrait" src="/assets/${avatar}" alt="" />` : `<img class="crew-avatar-portrait" src="/assets/branding/patch_ares_survey.png" alt="" />`}
        </div>
        <div class="crew-info">
          <div class="crew-name">${esc(player.name)}${isYou ? " · YOU" : ""}</div>
          <div class="crew-role">${esc(role?.shortName ?? "NO STATION")}${compact ? "" : ` · ${esc(role?.ability.name ?? "WAITING")}`}</div>
        </div>
        <div class="crew-flags">${flags}</div>
      </div>`;
  }

  private objectiveRowHtml(objective: ObjectiveState, state: GameState): string {
    const position = this.localPosition(state);
    const distance = position
      ? Math.round(Math.hypot(position.x - objective.x, position.y - objective.y))
      : null;
    const className = objective.completed
      ? "completed"
      : !objective.unlocked
        ? "locked"
        : "";
    return `
      <div class="objective-row ${className}" data-objective-row="${objective.id}">
        <div class="objective-row-top">
          <span class="objective-row-name">${esc(objective.shortName)}</span>
          <span class="objective-row-dist" data-objective-distance="${objective.id}">${distance === null ? "—" : `${distance} M`}</span>
        </div>
        <div class="objective-row-meta">
          <span>${objectiveKindLabel(objective.kind)}${objective.completed ? " · COMPLETE" : objective.unlocked ? "" : " · LOCKED"}</span>
          <span class="objective-mini-track"><span class="objective-mini-fill" data-objective-progress="${objective.id}" style="width:${Math.round(objective.progress * 100)}%"></span></span>
        </div>
      </div>`;
  }

  private eventStatusHtml(mission: MissionState): string {
    const event = mission.activeEvent;
    if (!event) {
      return `<p class="rail-copy">No active anomaly. ${mission.eventsResolved}/${mission.eventsTotal} events resolved. Crew dilemmas open at mission start and between field objectives.</p>`;
    }
    const room = store.current.room;
    const votes = event.votes;
    return `
      <div class="event-banner">
        <h4>${esc(event.title)} · ${esc(event.code)}</h4>
        <p>${event.resolution === "resolving" ? "Crew decision locked. Resolving the outcome…" : "Vote open. Choose a response in the event brief."}</p>
        <div class="event-vote">
          ${(room?.players ?? [])
            .map((player) => {
              const voted = votes[player.id] !== undefined;
              return `<span class="vote-pip ${voted ? "voted" : ""}" title="${esc(player.name)}${voted ? " voted" : " is deciding"}">${esc(player.name.slice(0, 1).toUpperCase())}</span>`;
            })
            .join("")}
        </div>
      </div>`;
  }

  private logHtml(log: MissionLogEntry[], startedAt: number): string {
    if (log.length === 0) return `<p class="rail-copy">No log entries yet.</p>`;
    return log
      .slice(-9)
      .map((entry) => {
        const seconds = Math.max(0, (entry.at - startedAt) / 1000);
        return `<div class="log-entry" data-tone="${entry.tone}"><span class="log-time">${formatClock(seconds)}</span><span class="log-text">${esc(entry.text)}</span></div>`;
      })
      .join("");
  }

  private abilityState(
    mission: MissionState,
    playerId: string | null,
  ): { disabled: boolean; label: string; remaining: number } {
    if (!playerId) return { disabled: true, label: "OFFLINE", remaining: 0 };
    if (mission.activeEvent || mission.result) {
      return { disabled: true, label: "MISSION HOLD", remaining: 0 };
    }
    const readyAt = mission.abilityReadyAt[playerId] ?? 0;
    const remaining = Math.max(0, Math.ceil((readyAt - store.serverNow) / 1000));
    if (remaining > 0) return { disabled: true, label: `RECHARGE ${remaining}s`, remaining };
    return { disabled: false, label: "READY", remaining: 0 };
  }

  private updateMissionHud(state: GameState): void {
    const mission = state.mission;
    if (!mission) {
      this.refs.resourceStrip.innerHTML = "";
      return;
    }
    this.refs.resourceStrip.innerHTML = RESOURCE_META.map((meta) => {
      const value = resourceValue(mission.resources, meta.id);
      const isLow =
        (meta.id === "power" && mission.resources.power <= 25) ||
        (meta.id === "comms" && mission.resources.comms <= 25) ||
        (meta.id === "time" && mission.resources.time <= 60);
      const suffix =
        meta.id === "data" ? `<small>/${mission.dataTarget}</small>` : `<small>${resourceUnit(meta.id)}</small>`;
      return `
        <div class="resource-pill icon-${meta.id} ${isLow ? "low" : ""}" title="${esc(meta.label)}">
          <img src="/assets/${meta.icon}" alt="" />
          <span class="resource-values"><span class="resource-label">${esc(meta.label.toUpperCase())}</span><span class="resource-number">${value} ${suffix}</span></span>
        </div>`;
    }).join("");

    const completedFields = mission.objectives.filter(
      (objective) => objective.completed && objective.kind !== "transmit",
    ).length;
    if (mission.result) {
      this.refs.goalText.textContent = "MISSION DEBRIEF";
    } else if (mission.activeEvent) {
      this.refs.goalText.textContent = "CREW DECISION REQUIRED";
    } else if (completedFields >= 5) {
      this.refs.goalText.textContent =
        mission.resources.data >= mission.dataTarget
          ? "RETURN TO LANDER · TRANSMIT"
          : `COLLECT MORE DATA ${Math.round(mission.resources.data)}/${mission.dataTarget}`;
    } else {
      this.refs.goalText.textContent = `FIELD OBJECTIVES ${completedFields}/5 · DATA ${Math.round(mission.resources.data)}/${mission.dataTarget}`;
    }
  }

  private updateMissionLive(state: GameState): void {
    const mission = state.mission;
    const room = state.room;
    if (!mission || !room || room.phase !== "mission") return;
    this.updateMissionHud(state);

    const me = room.players.find((player) => player.id === state.playerId) ?? null;
    const position = this.localPosition(state);
    const objectives = mission.objectives;
    const available = objectives.filter((objective) => objective.unlocked && !objective.completed);
    let nearest: ObjectiveState | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    if (position) {
      for (const objective of available) {
        const distance = Math.hypot(position.x - objective.x, position.y - objective.y);
        if (distance < nearestDistance) {
          nearest = objective;
          nearestDistance = distance;
        }
      }
    }

    this.refs.sectorLine.textContent = `LANDING ZONE / MET ${formatClock(mission.elapsed)}`;
    this.refs.eventChipLabel.textContent = mission.activeEvent
      ? "EVENT ACTIVE · VOTE NOW"
      : `EVENTS ${mission.eventsResolved}/${mission.eventsTotal}`;

    if (nearest) {
      this.refs.objectiveIcon.textContent = interactionIcon(nearest.kind);
      this.refs.objectiveName.textContent = nearest.shortName;
      this.refs.objectiveDistance.textContent = `${Math.round(nearestDistance)} M`;
    } else {
      this.refs.objectiveIcon.textContent = "✓";
      this.refs.objectiveName.textContent = "ALL FIELD SITES COMPLETE";
      this.refs.objectiveDistance.textContent = "LANDER";
    }

    const interactingId = localPresence.interacting;
    const interactingObjective = interactingId
      ? objectives.find((objective) => objective.id === interactingId) ?? null
      : null;

    if (interactingObjective && !mission.activeEvent && !mission.result) {
      this.show(this.refs.nearbyProgress, true);
      this.show(this.refs.nearbyPrompt, false);
      this.refs.progressTitle.textContent = `${interactingObjective.shortName} / ${objectiveKindLabel(interactingObjective.kind)}`;
      const percent = Math.round(interactingObjective.progress * 100);
      this.refs.progressPct.textContent = `${percent}%`;
      this.refs.progressFill.style.width = `${percent}%`;
    } else {
      this.show(this.refs.nearbyProgress, false);
      const near =
        !mission.activeEvent &&
        !mission.result &&
        nearest &&
        nearestDistance <= 64
          ? nearest
          : null;
      if (near) {
        const target = near;
        this.refs.nearbyIcon.textContent = interactionIcon(target.kind);
        this.refs.nearbyTitle.textContent = target.shortName;
        this.refs.nearbySub.textContent = interactionAction(target.kind);
        this.show(this.refs.nearbyPrompt, true);
      } else {
        this.show(this.refs.nearbyPrompt, false);
      }
    }

    this.refs.localCoord.textContent = position
      ? `X ${String(Math.round(position.x)).padStart(4, "0")} / Y ${String(Math.round(position.y)).padStart(4, "0")}`
      : "X ---- / Y ----";
    this.refs.linkQuality.textContent = `LINK ${Math.round(mission.resources.comms)}%`;

    const missionClock = document.getElementById("mission-clock-rail");
    if (missionClock) missionClock.textContent = formatClock(mission.resources.time);
    const missionData = document.getElementById("mission-data-rail");
    if (missionData) {
      missionData.textContent = `${Math.round(mission.resources.data)} / ${mission.dataTarget}`;
    }
    const objectiveCount = document.getElementById("mission-objective-count");
    if (objectiveCount) {
      objectiveCount.textContent = `${objectives.filter((objective) => objective.completed && objective.kind !== "transmit").length}/5`;
    }
    const eventsCount = document.getElementById("mission-events-count");
    if (eventsCount) eventsCount.textContent = `${mission.eventsResolved}/${mission.eventsTotal}`;

    for (const objective of objectives) {
      const row = document.querySelector<HTMLElement>(`[data-objective-row="${objective.id}"]`);
      if (!row) continue;
      row.classList.toggle("completed", objective.completed);
      row.classList.toggle("locked", !objective.unlocked);
      row.classList.toggle("current", Boolean(nearest && nearest.id === objective.id));
      const distanceElement = document.querySelector<HTMLElement>(
        `[data-objective-distance="${objective.id}"]`,
      );
      if (distanceElement) {
        const distance = position
          ? Math.round(Math.hypot(position.x - objective.x, position.y - objective.y))
          : null;
        distanceElement.textContent = objective.completed
          ? "DONE"
          : distance === null
            ? "—"
            : `${distance} M`;
      }
      const progressElement = document.querySelector<HTMLElement>(
        `[data-objective-progress="${objective.id}"]`,
      );
      if (progressElement) {
        progressElement.style.width = `${Math.round(objective.progress * 100)}%`;
      }
    }

    const ability = this.abilityState(mission, state.playerId);
    const abilityState = document.getElementById("mission-ability-state");
    if (abilityState) abilityState.textContent = ability.label;
    const abilityButton = document.getElementById("mission-ability") as HTMLButtonElement | null;
    if (abilityButton) {
      abilityButton.disabled = ability.disabled || !me?.role;
      abilityButton.textContent = ability.remaining > 0
        ? `RECHARGE ${ability.remaining}s`
        : "USE STATION TOOL [Q]";
    }

    const eventStatus = document.getElementById("mission-event-status");
    if (eventStatus) {
      const next = this.eventStatusHtml(mission);
      if (eventStatus.innerHTML !== next) eventStatus.innerHTML = next;
    }
    const log = document.getElementById("mission-log");
    if (log) {
      const logSignature = `${mission.log.length}:${mission.log[mission.log.length - 1]?.id ?? ""}`;
      if (logSignature !== this.lastLogSignature) {
        this.lastLogSignature = logSignature;
        log.innerHTML = this.logHtml(mission.log, mission.startedAt);
      }
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      '[data-action="quick-comm"]',
    )) {
      button.disabled = Boolean(mission.activeEvent || mission.result);
    }
    void me;
  }

  private localPosition(state: GameState): { x: number; y: number } | null {
    if (
      localPresence.active &&
      (!state.playerId || localPresence.id === state.playerId)
    ) {
      return { x: localPresence.x, y: localPresence.y };
    }
    if (!state.playerId) return null;
    return state.positions[state.playerId] ?? null;
  }

  private syncEventModal(state: GameState): void {
    const event = state.mission?.activeEvent ?? null;
    if (!event) {
      if (this.modalKind === "event") this.closeModal(true);
      return;
    }
    const signature = `${event.id}:${event.resolution}:${JSON.stringify(event.votes)}`;
    if (this.modalKind === "event" && signature === this.eventSignature) return;

    if (event.id !== this.lastEventAlertId) {
      this.lastEventAlertId = event.id;
      audio.eventAlert();
    }
    this.eventSignature = signature;
    this.openEventModal(event, state);
  }

  private openEventModal(event: ActiveEventPublic, state: GameState): void {
    const room = state.room;
    const mission = state.mission;
    if (!room || !mission) return;
    const myVote = state.playerId ? event.votes[state.playerId] : undefined;
    const voteEntries = Object.values(event.votes);
    const connectedPlayers = room.players.filter((player) => player.connected);
    const waitingFor = connectedPlayers.filter((player) => event.votes[player.id] === undefined);

    const choices = event.choices
      .map((choice) => {
        const votes = voteEntries.filter((vote) => vote === choice.id).length;
        const selected = myVote === choice.id;
        return `
          <button class="event-choice ${selected ? "selected" : ""}" type="button"
            data-action="vote" data-choice="${choice.id}" ${event.resolution !== "open" ? "disabled" : ""}>
            <div class="choice-votes">${Array.from({ length: votes })
              .map(() => '<span class="choice-vote-pip"></span>')
              .join("")}</div>
            <h3>${esc(choice.label)}${selected ? " · YOUR VOTE" : ""}</h3>
            <p>${esc(choice.detail)}</p>
            <div class="effect-tags">${effectTags(choice.effects)}</div>
          </button>`;
      })
      .join("");

    const voters = connectedPlayers
      .filter((player) => event.votes[player.id] !== undefined)
      .map((player) => `<span class="voter-tag">${esc(player.name)}</span>`)
      .join("");
    const advisoryRole = roleById(event.roleAdvisory.role);

    const html = `
      <div class="event-modal-card" role="dialog" aria-modal="true" aria-labelledby="event-title">
        <div class="event-kicker">
          <span>CREW DECISION · EVENT ${event.code}</span>
          <span class="countdown" id="event-countdown">VOTE OPEN</span>
        </div>
        <h1 id="event-title">${esc(event.title)}</h1>
        <div class="event-code">${esc(event.code)} / ARES BASIN / MISSION HOLD</div>
        <p class="event-body">${esc(event.body)}</p>
        <div class="event-field-note"><strong>FIELD NOTE · ${esc(event.source)}</strong>${esc(event.fieldNote)}</div>
        <div class="event-advisory"><span>${esc((advisoryRole?.shortName ?? event.roleAdvisory.role).toUpperCase())} ADVISORY</span><span>${esc(event.roleAdvisory.text)}</span></div>
        <div class="event-choices">${choices}</div>
        <div class="event-footer">
          <div class="event-voters">${voters || "<span class='voter-tag'>NO VOTES YET</span>"}</div>
          <span>${event.resolution === "resolving" ? "DECISION LOCKED · RESOLVING" : waitingFor.length > 0 ? `WAITING ON ${waitingFor.length}` : "ALL CREW VOTED"}</span>
        </div>
      </div>`;

    const scrollTop = this.modalKind === "event" ? this.refs.modalRoot.scrollTop : 0;
    this.modalKind = "event";
    this.refs.modalRoot.innerHTML = html;
    this.refs.modalRoot.classList.remove("hidden");
    this.refs.modalRoot.scrollTop = scrollTop;
    this.refs.modalRoot.setAttribute("aria-hidden", "false");
    this.updateEventTimer();
  }

  private updateResult(state: GameState): void {
    const mission = state.mission;
    const result = mission?.result;
    if (!mission || !result) return;
    const key = `${mission.missionId}:${result.completedAt}`;
    if (key === this.lastResultKey) return;
    this.lastResultKey = key;
    if (this.modalKind === "event") this.closeModal(true);
    audio.setScene("debrief");
    if (result.success) {
      audio.success();
      toast("Science package received in orbit.", "success", 7_000);
    } else {
      audio.failure();
      toast(result.reason, "error", 7_000);
    }
  }

  private updateOutcome(state: GameState): void {
    const mission = state.mission;
    if (!mission) return;
    if (mission.missionId !== this.lastMissionId) {
      this.lastMissionId = mission.missionId;
      this.lastEventAlertId = "";
      this.lastOutcomeAt = 0;
      this.lastResultKey = "";
      this.lastLogSignature = "";
    }
    const outcome = mission.eventOutcome;
    if (outcome && outcome.at !== this.lastOutcomeAt) {
      this.lastOutcomeAt = outcome.at;
      toast(`${outcome.title}: ${outcome.choiceLabel}.`, "warning", 6_000);
    }
  }

  private updateAudioScene(state: GameState): void {
    const phase = state.room?.phase;
    const scene: string = !phase
      ? "title"
      : phase === "lobby"
        ? "lobby"
        : phase === "design"
          ? "design"
          : phase === "launch"
            ? "launch"
            : phase === "mission"
              ? "mission"
              : "debrief";
    if (scene !== this.audioScene) {
      this.audioScene = scene;
      audio.setScene(scene as "title" | "lobby" | "design" | "launch" | "mission" | "debrief");
    }
  }

  private tick(): void {
    if (!this.initialized) return;
    this.updateLaunchTimer();
    this.updateEventTimer();
    const state = store.current;
    if (state.room?.phase === "mission") {
      this.updateMissionLive(state);
    }
  }

  private updateLaunchTimer(): void {
    const state = store.current;
    const room = state.room;
    if (room?.phase === "launch" && room.launchAt) {
      const remaining = Math.max(0, Math.ceil((room.launchAt - store.serverNow) / 1000));
      const label = `T-${formatClock(remaining)}`;
      const countdown = document.getElementById("launch-countdown");
      if (countdown) countdown.textContent = label;
      this.refs.waitingText.textContent =
        remaining > 0
          ? `MERIDIAN ASCENT · ${label} · ALL CREW SYNCED`
          : "TOUCHDOWN · ESTABLISHING SURFACE LINK";
    } else if (!room && state.resuming) {
      this.refs.waitingText.textContent = "RESTORING CREW LINK";
    }
  }

  private updateEventTimer(): void {
    if (this.modalKind !== "event") return;
    const countdown = document.getElementById("event-countdown");
    if (!countdown) return;
    const event = store.current.mission?.activeEvent;
    if (!event) {
      countdown.textContent = "CLOSING";
      return;
    }
    if (event.resolution === "resolving") {
      countdown.textContent = "DECISION LOCKED";
      return;
    }
    const seconds = Math.max(0, Math.ceil((event.deadline - store.serverNow) / 1000));
    countdown.textContent = seconds > 0 ? `VOTE ${formatClock(seconds)}` : "TIME UP";
  }

  private flashMissionToast(text: string, ttl = 4_200): void {
    if (!this.refs.missionOverlay.classList.contains("hidden")) {
      this.refs.missionToast.textContent = text;
      this.show(this.refs.missionToast, true);
      if (this.missionToastTimer !== null) window.clearTimeout(this.missionToastTimer);
      this.missionToastTimer = window.setTimeout(() => {
        this.show(this.refs.missionToast, false);
        this.missionToastTimer = null;
      }, ttl);
    }
  }

  private pushToast(message: string, tone: ToastTone, ttl: number): void {
    const element = document.createElement("div");
    element.className = `toast ${tone === "info" ? "" : tone}`.trim();
    element.textContent = message;
    this.refs.toastStack.appendChild(element);
    while (this.refs.toastStack.children.length > 4) {
      this.refs.toastStack.firstElementChild?.remove();
    }
    window.setTimeout(() => {
      element.style.opacity = "0";
      element.style.transition = "opacity 140ms steps(2, end)";
      window.setTimeout(() => element.remove(), 160);
    }, ttl);
  }

  private handleAction(element: HTMLElement): void {
    const action = element.dataset.action;
    if (!action) return;
    switch (action) {
      case "host-room":
        this.openAccessModal("host");
        break;
      case "join-room":
        this.openAccessModal("join");
        break;
      case "open-notes":
        this.openNotesModal();
        break;
      case "toggle-sound":
        this.toggleSound();
        break;
      case "fullscreen":
        void this.toggleFullscreen();
        break;
      case "retry-boot":
        window.location.reload();
        break;
      case "copy-code":
        void this.copyRoomCode();
        break;
      case "leave-room":
        this.openLeaveConfirm();
        break;
      case "confirm-leave":
        void this.leaveRoom();
        break;
      case "select-role":
        if (element.dataset.role) void this.selectRole(element.dataset.role as RoleId);
        break;
      case "toggle-ready":
        void this.toggleReady();
        break;
      case "open-bay":
        void this.openBay();
        break;
      case "toggle-module":
        if (element.dataset.module) void this.toggleModule(element.dataset.module as ModuleId);
        break;
      case "start-launch":
        void this.startLaunch();
        break;
      case "ability":
        if (store.current.room?.phase === "mission") void this.performAbility();
        break;
      case "quick-comm":
        if (element.dataset.text) void this.quickComm(element.dataset.text);
        break;
      case "vote":
        if (element.dataset.choice) void this.vote(element.dataset.choice);
        break;
      case "retry-mission":
        void this.retryMission();
        break;
      case "return-lobby":
        void this.returnToLobby();
        break;
      default:
        break;
    }
  }

  private openAccessModal(mode: "host" | "join"): void {
    if (store.current.room) return;
    if (store.current.connection !== "online") {
      toast("Surface link is not online yet. Reconnecting…", "warning", 4_000);
      net.reconnect();
    }
    const savedName = net.savedCallsign();
    const html = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="access-title">
        <button class="modal-close" type="button" data-modal-close aria-label="Close">×</button>
        <div class="modal-eyebrow">${mode === "host" ? "NEW CREW LINK" : "JOIN EXISTING CREW"}</div>
        <h1 id="access-title">${mode === "host" ? "Host Mission" : "Join Crew"}</h1>
        <p class="modal-lead">${
          mode === "host"
            ? "Open a real-time crew link. A four-character mission code is generated for your crew."
            : "Enter the four-character code shared by your flight director. Your station is saved for session recovery."
        }</p>
        <form data-form="access" data-mode="${mode}" novalidate>
          <label class="field-label" for="callsign-input">CREW CALLSIGN</label>
          <input id="callsign-input" class="text-input" name="callsign" type="text" maxlength="18"
            autocomplete="nickname" placeholder="e.g. VEGA-7" value="${esc(savedName)}" required />
          ${
            mode === "join"
              ? `<label class="field-label" for="code-input">MISSION CODE</label>
                 <input id="code-input" class="text-input code-input" name="code" type="text" maxlength="4"
                   autocomplete="off" autocapitalize="characters" placeholder="----" required />`
              : ""
          }
          <p class="modal-error hidden" data-modal-error></p>
          <div class="modal-form-actions">
            <button class="primary-button" type="submit">${mode === "host" ? "OPEN CREW LINK" : "ESTABLISH LINK"}</button>
            <button class="ghost-button" type="button" data-modal-close>CANCEL</button>
          </div>
        </form>
        <div class="modal-divider"></div>
        <p class="hint-line">Original fictional project. NASA does not endorse this game. All values are simplified educational gameplay values.</p>
      </div>`;
    this.modalKind = "access";
    this.refs.modalRoot.innerHTML = html;
    this.refs.modalRoot.classList.remove("hidden");
    this.refs.modalRoot.setAttribute("aria-hidden", "false");
    const firstInput = this.refs.modalRoot.querySelector<HTMLInputElement>("input");
    window.setTimeout(() => firstInput?.focus(), 30);
  }

  private async submitAccess(form: HTMLFormElement): Promise<void> {
    const mode = form.dataset.mode === "join" ? "join" : "host";
    const data = new FormData(form);
    const callsign = String(data.get("callsign") ?? "").trim();
    const code = String(data.get("code") ?? "").trim().toUpperCase();
    const errorElement = form.querySelector<HTMLElement>("[data-modal-error]");
    const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const showError = (message: string): void => {
      if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove("hidden");
      }
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = mode === "host" ? "OPEN CREW LINK" : "ESTABLISH LINK";
      }
    };

    if (callsign.length < 2 || callsign.length > 18) {
      showError("Use a crew callsign between 2 and 18 characters.");
      return;
    }
    if (mode === "join" && code.length !== 4) {
      showError("Enter the four-character mission code.");
      return;
    }
    if (errorElement) errorElement.classList.add("hidden");
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "LINKING…";
    }

    const result =
      mode === "host"
        ? await net.createRoom(callsign)
        : await net.joinRoom(code, callsign);
    if (!result.ok) {
      showError(result.error);
      audio.denied();
      return;
    }
    net.rememberCallsign(callsign);
    audio.confirm();
    this.closeModal(true);
    toast(mode === "host" ? `Mission ${result.value.room.code} opened.` : `Linked to mission ${result.value.room.code}.`, "success");
  }

  private openNotesModal(): void {
    if (store.current.mission?.activeEvent) {
      toast("Resolve the active crew decision before opening field notes.", "warning");
      return;
    }
    const referenceHtml = REFERENCES.map(
      (reference) => `
        <div class="reference-item">
          <a href="${reference.url}" target="_blank" rel="noreferrer">${esc(reference.title)}</a>
          <p>${esc(reference.note)}</p>
        </div>`,
    ).join("");
    const html = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="notes-title">
        <button class="modal-close" type="button" data-modal-close aria-label="Close">×</button>
        <div class="modal-eyebrow">SURFACE OPERATIONS MANUAL</div>
        <h1 id="notes-title">Field Notes</h1>
        <p class="modal-lead">A cooperative run lasts one six-minute surface window. The crew shares one rover, one design and one mission clock.</p>
        <div class="help-grid">
          <div class="help-block">
            <h3>MISSION LOOP</h3>
            <p>Complete five field objectives across Ares Basin, then return to the lander to transmit. Data must reach the downlink target before the clock or power runs out.</p>
          </div>
          <div class="help-block">
            <h3>CONTROLS</h3>
            <ul>
              <li><strong>WASD / arrows:</strong> move your field specialist.</li>
              <li><strong>E:</strong> start or stop a field interaction.</li>
              <li><strong>Q:</strong> use your station tool.</li>
              <li>Touch controls appear on coarse-pointer devices.</li>
            </ul>
          </div>
          <div class="help-block">
            <h3>SHARED RESOURCES</h3>
            <p>Budget, mass margin, power, data, comms and time. Power depletion or clock expiry ends the mission. Crew tools and payload modules modify simplified costs.</p>
          </div>
          <div class="help-block">
            <h3>CREW EVENTS</h3>
            <p>Five field dilemmas pause the mission for a vote. When the crew is tied, the advisory station's vote breaks the tie. Events resolve automatically at the deadline.</p>
          </div>
        </div>
        <div class="modal-divider"></div>
        <h2>REFERENCES &amp; FURTHER READING</h2>
        <div class="reference-list">${referenceHtml}</div>
        <div class="modal-divider"></div>
        <div class="disclaimer-box">${esc(DISCLAIMER)}</div>
      </div>`;
    this.modalKind = "notes";
    this.refs.modalRoot.innerHTML = html;
    this.refs.modalRoot.classList.remove("hidden");
    this.refs.modalRoot.setAttribute("aria-hidden", "false");
  }

  private openLeaveConfirm(): void {
    if (store.current.mission?.activeEvent) {
      toast("Resolve the active crew decision first.", "warning");
      return;
    }
    const html = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="leave-title">
        <button class="modal-close" type="button" data-modal-close aria-label="Close">×</button>
        <div class="modal-eyebrow">CREW LINK / DISCONNECT</div>
        <h1 id="leave-title">Leave Crew?</h1>
        <p class="modal-lead">You will lose this station and the current mission session. Other crew members stay connected. Your flight director can reopen the crew link after the debrief.</p>
        <div class="modal-form-actions">
          <button class="danger-button" type="button" data-action="confirm-leave">LEAVE CREW</button>
          <button class="ghost-button" type="button" data-modal-close>STAY</button>
        </div>
      </div>`;
    this.modalKind = "confirm";
    this.refs.modalRoot.innerHTML = html;
    this.refs.modalRoot.classList.remove("hidden");
    this.refs.modalRoot.setAttribute("aria-hidden", "false");
  }

  private closeModal(force = false): void {
    if (!this.initialized) return;
    if (this.modalKind === "event" && !force) return;
    this.modalKind = "none";
    this.eventSignature = "";
    this.refs.modalRoot.classList.add("hidden");
    this.refs.modalRoot.setAttribute("aria-hidden", "true");
    this.refs.modalRoot.innerHTML = "";
  }

  private async copyRoomCode(): Promise<void> {
    const code = store.current.room?.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast(`Mission code ${code} copied.`, "success", 3_000);
    } catch {
      toast(`Mission code: ${code}`, "info", 5_000);
    }
  }

  private toggleSound(): void {
    void audio.unlock().then(() => {
      const muted = audio.toggleMuted();
      this.syncSoundLabel();
      audio.click();
      toast(muted ? "Sound muted." : "Sound on.", "info", 2_400);
    });
  }

  private syncSoundLabel(): void {
    if (!this.initialized) return;
    const muted = audio.isMuted;
    this.refs.soundLabel.textContent = muted ? "SOUND OFF" : "SOUND ON";
    this.refs.soundButton.setAttribute("aria-pressed", String(!muted));
    this.refs.soundButton.title = muted ? "Enable sound" : "Mute sound";
  }

  private async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast("Fullscreen is not available in this browser.", "warning", 3_500);
    }
  }

  private async selectRole(role: RoleId): Promise<void> {
    const me = store.current.room?.players.find((player) => player.id === store.current.playerId);
    if (!me || me.role === role) return;
    const result = await net.setRole(role);
    if (!result.ok) {
      toast(result.error, "warning");
      audio.denied();
      return;
    }
    audio.select();
  }

  private async toggleReady(): Promise<void> {
    const room = store.current.room;
    if (!room || (room.phase !== "lobby" && room.phase !== "design")) return;
    const me = room.players.find((player) => player.id === store.current.playerId);
    if (!me) return;
    const result = await net.setReady(!me.ready);
    if (!result.ok) {
      toast(result.error, "warning");
      audio.denied();
      return;
    }
    audio.confirm();
  }

  private async openBay(): Promise<void> {
    const result = await net.toDesign();
    if (!result.ok) {
      toast(result.error, "warning");
      audio.denied();
      return;
    }
    audio.confirm();
  }

  private async toggleModule(moduleId: ModuleId): Promise<void> {
    const result = await net.toggleModule(moduleId);
    if (!result.ok) {
      toast(result.error, "warning");
      audio.denied();
      return;
    }
    audio.select();
  }

  private async startLaunch(): Promise<void> {
    const result = await net.startMission();
    if (!result.ok) {
      toast(result.error, "warning");
      audio.denied();
      return;
    }
    audio.confirm();
  }

  private async performAbility(): Promise<void> {
    if (this.modalKind === "event") return;
    const result = await net.ability();
    if (!result.ok) {
      toast(result.error, "warning", 3_500);
      audio.denied();
      return;
    }
    audio.ability();
  }

  private async quickComm(text: string): Promise<void> {
    const result = await net.quickComm(text);
    if (!result.ok) {
      toast(result.error, "warning");
      audio.denied();
    }
  }

  private async vote(choiceId: string): Promise<void> {
    const result = await net.vote(choiceId);
    if (!result.ok) {
      toast(result.error, "warning");
      audio.denied();
      return;
    }
    audio.select();
  }

  private async retryMission(): Promise<void> {
    const result = await net.retryMission();
    if (!result.ok) {
      toast(result.error, "warning");
      audio.denied();
      return;
    }
    audio.confirm();
  }

  private async returnToLobby(): Promise<void> {
    const result = await net.returnToLobby();
    if (!result.ok) {
      toast(result.error, "warning");
      audio.denied();
      return;
    }
    audio.confirm();
  }

  private async leaveRoom(): Promise<void> {
    this.closeModal(true);
    const result = await net.leaveRoom();
    if (!result.ok) {
      toast(result.error, "warning");
      return;
    }
    audio.denied();
    toast("Crew link closed.", "info", 3_000);
  }

  private show(element: HTMLElement, visible: boolean): void {
    element.classList.toggle("hidden", !visible);
    element.setAttribute("aria-hidden", String(!visible));
  }

  private updateStageScale(): void {
    if (!this.initialized) return;
    const column = document.querySelector<HTMLElement>(".stage-column");
    if (!column) return;
    const width = column.clientWidth;
    if (width <= 0) return;
    const widthScale = Math.floor(width / 384);
    const heightScale = Math.floor((window.innerHeight - 240) / 224);
    let scale = Math.max(1, Math.min(widthScale, heightScale, 3));
    if (width < 384) scale = Math.max(0.82, width / 384);
    document.documentElement.style.setProperty("--stage-scale", scale.toFixed(3));
  }
}

export const ui = new UiController();

export function initUI(): void {
  ui.init();
}

export function setBootProgress(value: number, label: string): void {
  ui.setBootProgress(value, label);
}

export function finishBoot(): void {
  ui.finishBoot();
}

export function showBootError(message: string): void {
  ui.showBootError(message);
}

export type { Ack };
