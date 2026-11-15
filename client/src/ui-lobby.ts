import { MAX_PLAYERS } from "../../shared/types";
import type { PlayerPublic, RoleId, RoomPublic } from "../../shared/types";
import { roleById, ROLES } from "../../shared/content";
import { esc, roleName, rolePortrait, roomPlayersLabel } from "./ui-format";

export interface LobbyRender {
  crew: string;
  roles: string;
  footer: string;
  players: string;
}

function playerCard(player: PlayerPublic, playerId: string | null): string {
  const role = roleById(player.role);
  const isMe = player.id === playerId;
  const color = role?.color ?? "#667687";
  return `
    <article class="crew-card ${isMe ? "is-me" : ""} ${player.connected ? "" : "is-offline"}" style="--role-color:${color}">
      <div class="crew-portrait">
        <img src="${rolePortrait(player.role)}" alt="" width="48" height="48" />
        ${player.host ? `<span class="host-mark" title="Host">Host</span>` : ""}
        ${isMe ? `<span class="you-mark">You</span>` : ""}
      </div>
      <div class="crew-copy">
        <strong>${esc(player.name)}</strong>
        <span>${esc(role?.name ?? "Choosing a job")}</span>
        <small>${player.connected ? (player.ready ? "Ready for launch" : "Getting ready") : "Offline — reconnecting"}</small>
      </div>
    </article>`;
}

function emptyCard(index: number): string {
  return `
    <article class="crew-card is-empty">
      <div class="crew-portrait empty-portrait" aria-hidden="true">+</div>
      <div class="crew-copy">
        <strong>Open seat ${index + 1}</strong>
        <span>Share the room code</span>
        <small>Up to four players</small>
      </div>
    </article>`;
}

function roleCard(role: (typeof ROLES)[number], room: RoomPublic, playerId: string | null): string {
  const me = room.players.find((player) => player.id === playerId);
  const selected = me?.role === role.id;
  const takenBy = room.players.find((player) => player.id !== playerId && player.role === role.id);
  const disabled = Boolean(takenBy);
  return `
    <button class="role-card ${selected ? "is-selected" : ""} ${disabled ? "is-taken" : ""}"
      type="button"
      data-action="select-role"
      data-role="${role.id}"
      aria-pressed="${selected}"
      ${disabled ? "disabled" : ""}
      style="--role-color:${role.color};--role-accent:${role.accent}">
      <span class="role-topline">
        <img src="${rolePortrait(role.id)}" alt="" width="48" height="48" />
        <span>
          <strong>${esc(role.name)}</strong>
          <small>${esc(role.shortName)}</small>
        </span>
        ${selected ? `<span class="role-check">Your job</span>` : ""}
        ${takenBy ? `<span class="role-taken">Taken by ${esc(takenBy.name)}</span>` : ""}
      </span>
      <span class="role-tagline">${esc(role.tagline)}</span>
      <span class="role-task"><b>Your task:</b> ${esc(role.firstTask)}</span>
      <span class="role-ability"><b>Job tool:</b> ${esc(role.ability.name)} — ${esc(role.ability.description)}</span>
    </button>`;
}

export function renderLobby(room: RoomPublic, playerId: string | null): LobbyRender {
  const me = room.players.find((player) => player.id === playerId) ?? null;
  const connected = room.players.filter((player) => player.connected);
  const allReady = connected.length > 0 && connected.every((player) => player.ready);
  const allRoles = room.players.some((player) => player.role === null) === false;
  const emptyCount = Math.max(0, MAX_PLAYERS - room.players.length);
  const crew = [
    ...room.players.map((player) => playerCard(player, playerId)),
    ...Array.from({ length: emptyCount }, (_, index) => emptyCard(index)),
  ].join("");

  const roles = ROLES.map((role) => roleCard(role, room, playerId)).join("");
  const readyCount = connected.filter((player) => player.ready).length;
  const canOpen = allReady && allRoles;
  const host = room.players.find((player) => player.id === room.hostId);
  const footer = `
    <div class="lobby-status">
      <span class="status-line ${allReady ? "good" : ""}">
        <b>${readyCount}/${connected.length}</b> ready
      </span>
      <span class="status-copy">
        ${
          allReady
            ? allRoles
              ? "Everyone is ready. The host can open the workshop."
              : "Everyone is ready, but each crew member still needs a job."
            : "Read your job card, then press Ready. You can change jobs until the workshop opens."
        }
      </span>
    </div>
    <div class="lobby-buttons">
      <button class="secondary-button" type="button" data-action="toggle-ready">
        ${me?.ready ? "Ready — tap to undo" : "I'm ready"}
      </button>
      ${
        me?.host
          ? `<button class="primary-button" type="button" data-action="open-design" ${canOpen ? "" : "disabled"}>
              Open rover workshop
            </button>`
          : `<span class="waiting-note">${host ? `${esc(host.name)} will open the workshop when the crew is ready.` : "Waiting for the host…"}</span>`
      }
    </div>`;

  return {
    crew,
    roles,
    footer,
    players: roomPlayersLabel(room.players),
  };
}

export function roleTabFor(role: RoleId | null | undefined): "build" | "landing" | "budget" | "science" {
  if (role === "satellite") return "landing";
  if (role === "finance") return "budget";
  if (role === "designer") return "science";
  return "build";
}

export function roleNameFor(role: RoleId | null | undefined): string {
  return roleName(role);
}
