import { landingSiteById, roleById, scienceGoalById } from "../../shared/content";
import { formatClock } from "../../shared/rules";
import type {
  ActiveEventPublic,
  MissionResult,
  RoomPublic,
} from "../../shared/types";
import {
  asset,
  effectChips,
  esc,
  eventIcon,
  roleName,
  rolePortrait,
  scienceGoalRows,
  voteSummary,
} from "./ui-format";

function eventVisual(event: ActiveEventPublic): string {
  return `
    <div class="event-visual visual-${event.visual}" aria-hidden="true">
      <div class="event-sky"></div>
      <div class="visual-streaks"><i></i><i></i><i></i><i></i><i></i></div>
      <img class="event-visual-icon" src="${eventIcon(event.visual)}" alt="" width="96" height="96" />
      <div class="visual-ground"></div>
    </div>`;
}

function voterList(event: ActiveEventPublic, room: RoomPublic): string {
  return room.players
    .map((player) => {
      const role = roleById(player.role);
      const vote = event.votes[player.id];
      const choice = vote ? event.choices.find((entry) => entry.id === vote) : null;
      return `
        <div class="voter ${player.connected ? "" : "is-offline"} ${choice ? "has-voted" : ""}">
          <img src="${rolePortrait(player.role)}" alt="" width="48" height="48" />
          <div>
            <strong>${esc(player.name)}</strong>
            <span>${esc(role?.name ?? "No job")}</span>
            <small>${!player.connected ? "Offline — not counted" : choice ? `Voted: ${esc(choice.label)}` : "Still deciding"}</small>
          </div>
          <span class="vote-tick" aria-hidden="true">${choice ? "✓" : "…"}</span>
        </div>`;
    })
    .join("");
}

function choiceCard(event: ActiveEventPublic, playerId: string | null): string {
  const myVote = playerId ? event.votes[playerId] : undefined;
  const locked = event.resolution !== "open";
  return event.choices
    .map((choice) => {
      const selected = myVote === choice.id;
      return `
        <button class="choice-card ${selected ? "is-selected" : ""}" type="button"
          data-choice="${choice.id}" aria-pressed="${selected}" ${locked ? "disabled" : ""}>
          <span class="choice-topline">
            <strong>${esc(choice.label)}</strong>
            ${selected ? `<span class="your-vote">Your vote</span>` : ""}
          </span>
          <span class="choice-detail">${esc(choice.detail)}</span>
          <span class="choice-bullets">${choice.bullets.map((bullet) => `<span>${esc(bullet)}</span>`).join("")}</span>
          <span class="choice-effects">${effectChips(choice.effects)}</span>
          <span class="choice-action">${selected ? "Vote recorded — tap another to change" : "Vote for this"}</span>
        </button>`;
    })
    .join("");
}

export function renderEvent(
  event: ActiveEventPublic,
  room: RoomPublic,
  playerId: string | null,
  now = room.serverNow,
): string {
  const me = room.players.find((player) => player.id === playerId);
  const isHost = me?.host ?? false;
  const myInsight = me?.role
    ? event.roleInsights.find((insight) => insight.role === me.role)
    : undefined;
  const advisoryRole = roleById(event.roleAdvisory.role);
  const resolving = event.resolution !== "open";
  const secondsLeft = Math.max(0, Math.ceil((event.deadline - now) / 1000));
  const finalizeText = resolving
    ? "Decision locked. The outcome is coming…"
    : isHost
      ? "You can lock in the crew's choice before the timer ends."
      : "The host can lock it in. Otherwise it resolves when the timer ends.";
  return `
    <div class="event-card visual-${event.visual}">
      <header class="event-hero">
        ${eventVisual(event)}
        <div class="event-head-copy">
          <span class="eyebrow">CREW DECISION · ${resolving ? "LOCKED" : `<span id="event-countdown">${formatClock(secondsLeft)}</span> LEFT`}</span>
          <h1>${esc(event.title)}</h1>
          <p class="event-body">${esc(event.body)}</p>
          <p class="event-question">${esc(event.question)}</p>
        </div>
      </header>
      <div class="event-main">
        <aside class="event-side">
          <div class="advisory-card" style="--role-color:${advisoryRole?.color ?? "#667687"}">
            <div class="advisory-head">
              <img src="${rolePortrait(event.roleAdvisory.role)}" alt="" width="48" height="48" />
              <div>
                <span class="soft-label">CREW ADVICE</span>
                <strong>${esc(advisoryRole?.name ?? "A crew member")}</strong>
              </div>
            </div>
            <p>${esc(event.roleAdvisory.text)}</p>
          </div>
          ${
            myInsight
              ? `<div class="insight-card">
                  <span class="soft-label">YOUR JOB SAYS</span>
                  <strong>${esc(roleName(me?.role ?? null))}</strong>
                  <p>${esc(myInsight.text)}</p>
                </div>`
              : ""
          }
          <div class="vote-panel">
            <div class="section-head">
              <h2>Crew vote</h2>
              <span class="soft-label">${voteSummary(event.votes, room.players)}</span>
            </div>
            <div class="voter-list">${voterList(event, room)}</div>
            <p class="vote-note">Offline players are not counted and never block the decision.</p>
          </div>
          <div class="finalize-panel">
            <span class="soft-label">HOST CONTROL</span>
            ${
              isHost
                ? `<button class="primary-button full" type="button" data-action="finalize-event" ${resolving ? "disabled" : ""}>
                    ${resolving ? "Locking in…" : "Lock in the choice"}
                  </button>`
                : `<div class="finalize-wait">${esc(finalizeText)}</div>`
            }
            <p>${esc(finalizeText)}</p>
          </div>
        </aside>
        <div class="choice-list">${choiceCard(event, playerId)}</div>
      </div>
      <footer class="event-foot">
        <details>
          <summary>Why does this happen on Mars?</summary>
          <p>${esc(event.learnMore)}</p>
        </details>
        <span>Every choice has a trade-off. Read the effects before you vote.</span>
      </footer>
    </div>`;
}

function outcomeTitle(result: MissionResult): string {
  if (result.outcome === "success") return "The science is home.";
  if (result.outcome === "partial") return "Part of the science made it home.";
  return "The mission ended early.";
}

function outcomeBadge(result: MissionResult): string {
  if (result.outcome === "success") return "Full success";
  if (result.outcome === "partial") return "Partial success";
  return "Mission failed";
}

function outcomeExplanation(result: MissionResult): string {
  if (result.outcome === "success") {
    return "Every science goal is complete, and the results are safely on their way home. That is a full success.";
  }
  if (result.outcome === "partial") {
    if (result.stats.scienceCollected >= result.stats.scienceTarget) {
      return "The crew finished every science goal, but the mission ended before the results were sent home. The last step is the Send Results marker at the lander.";
    }
    return `The mission ended early, but the crew saved ${result.stats.scienceCollected} of ${result.stats.scienceTarget} science results. Four or more results is a partial success. Next time, watch the battery and clock, and send results as soon as all four goals are done.`;
  }
  return `The mission ended with ${result.stats.scienceCollected} of ${result.stats.scienceTarget} science results. Four results would have counted as a partial success. Try protecting the battery, choosing nearer goals first, and using every job tool.`;
}

function nextTimeTips(result: MissionResult): string[] {
  if (result.outcome === "success") {
    return [
      "Try a harder landing place for a higher score.",
      "See if you can finish with more battery and time left.",
      "Split the crew between distant weather masts to finish sooner.",
    ];
  }
  const tips: string[] = [];
  if (result.stats.rocks < 2) tips.push("Scan both rock sites early. The research camera makes them faster.");
  if (result.stats.soil < 2) tips.push("Collect both soil samples before the clock gets short.");
  if (result.stats.soilResearch < 2) tips.push("Soil tests unlock only after both soil samples. Leave time for the mini lab.");
  if (result.stats.weather < 2) tips.push("The weather masts are far apart. Send crew members to both.");
  if (result.stats.scienceCollected >= result.stats.scienceTarget) {
    tips.push("All four goals were done. Next time, send the results home immediately.");
  }
  if (result.stats.powerRemaining <= 0) {
    tips.push("The battery ran out. A long-life battery or the Rover Builder's repair tool can help.");
  }
  if (result.stats.timeRemaining <= 0) {
    tips.push("The clock ran out. The Mission Planner's focus tool speeds up science actions.");
  }
  if (tips.length === 0) tips.push("Walk to the nearest marker first and keep the crew together.");
  return tips.slice(0, 3);
}

function decisionList(result: MissionResult): string {
  if (result.decisions.length === 0) {
    return `<p class="empty-note">No crew decisions were resolved before the mission ended.</p>`;
  }
  return result.decisions
    .map(
      (decision) => `
      <div class="decision-row">
        <div class="decision-head">
          <strong>${esc(decision.title)}</strong>
          <span>${esc(decision.choiceLabel)}</span>
        </div>
        <div class="decision-effects">${effectChips(decision.effects)}</div>
        <p>${esc(decision.modifiers.join(" ") || "The crew handled it together.")}</p>
      </div>`,
    )
    .join("");
}

export function renderDebrief(
  result: MissionResult,
  room: RoomPublic,
  playerId: string | null,
): string {
  const me = room.players.find((player) => player.id === playerId);
  const isHost = me?.host ?? false;
  const mission = room.mission;
  const goals = mission ? scienceGoalRows(mission) : [];
  const transmit = mission?.objectives.find((objective) => objective.id === "transmit");
  const tips = nextTimeTips(result);
  const site = result.stats.landingSite
    ? landingSiteById(result.stats.landingSite)?.name ?? "Not chosen"
    : "Not chosen";
  const focus = result.stats.scienceFocus
    ? scienceGoalById(result.stats.scienceFocus)?.shortName ?? "Chosen"
    : "Not chosen";
  return `
    <div class="debrief-card outcome-${result.outcome}">
      <header class="debrief-hero">
        <div class="outcome-medal" aria-hidden="true">
          <span>${result.outcome === "success" ? "✓" : result.outcome === "partial" ? "!" : "×"}</span>
        </div>
        <div class="debrief-head-copy">
          <span class="eyebrow">MISSION DEBRIEF</span>
          <h1>${esc(result.headline)}</h1>
          <p class="debrief-subtitle">${esc(outcomeTitle(result))}</p>
          <p class="debrief-reason">${esc(result.reason)}</p>
          <span class="outcome-badge">${outcomeBadge(result)}</span>
        </div>
        <div class="debrief-score">
          <span>MISSION SCORE</span>
          <strong>${result.score}</strong>
          <small>Grade ${result.grade}</small>
        </div>
      </header>
      <div class="debrief-body">
        <section class="debrief-goals">
          <div class="section-head"><h2>What the crew learned</h2><span class="soft-label">${result.stats.scienceCollected} of ${result.stats.scienceTarget} results</span></div>
          <div class="debrief-goal-list">
            ${
              goals.length
                ? goals
                    .map(
                      (goal) => `
                        <div class="debrief-goal ${goal.done ? "is-done" : ""}">
                          <img src="${asset(goal.icon)}" alt="" width="32" height="32" />
                          <span><strong>${esc(goal.name)}</strong><small>${esc(goal.question)}</small></span>
                          <b>${goal.complete}/${goal.target}</b>
                        </div>`,
                    )
                    .join("")
                : ""
            }
            <div class="debrief-goal ${transmit?.completed ? "is-done" : ""}">
              <img src="${asset("equipment/antenna.png")}" alt="" width="32" height="32" />
              <span><strong>Send the results home</strong><small>The final step after all four goals.</small></span>
              <b>${transmit?.completed ? "Done" : "Not sent"}</b>
            </div>
          </div>
        </section>
        <section class="debrief-side">
          <div class="why-card">
            <h2>Why this ending?</h2>
            <p>${esc(outcomeExplanation(result))}</p>
          </div>
          <div class="stat-grid">
            <div><span>Science results</span><strong>${result.stats.scienceCollected}/${result.stats.scienceTarget}</strong></div>
            <div><span>Decisions handled</span><strong>${result.stats.eventsResolved}/${result.stats.eventsTotal}</strong></div>
            <div><span>Battery left</span><strong>${result.stats.powerRemaining}%</strong></div>
            <div><span>Time left</span><strong>${formatClock(result.stats.timeRemaining)}</strong></div>
            <div><span>Money left</span><strong>${result.stats.budgetRemaining}</strong></div>
            <div><span>Landing place</span><strong>${esc(site)}</strong></div>
            <div><span>Science focus</span><strong>${esc(focus)}</strong></div>
            <div><span>Rover weight</span><strong>${result.stats.weight} kg</strong></div>
          </div>
          <div class="tips-card">
            <h2>What to try next</h2>
            <ul>${tips.map((tip) => `<li>${esc(tip)}</li>`).join("")}</ul>
          </div>
        </section>
        <section class="debrief-decisions">
          <div class="section-head"><h2>Your decisions</h2><span class="soft-label">${result.decisions.length} crew choice${result.decisions.length === 1 ? "" : "s"}</span></div>
          ${decisionList(result)}
        </section>
      </div>
      <footer class="debrief-actions">
        <div class="debrief-room">Room <b>${esc(room.code)}</b> · ${isHost ? "You are the host" : `${esc(room.players.find((player) => player.host)?.name ?? "The host")} is the host`}</div>
        ${
          isHost
            ? `<div class="debrief-buttons">
                <span class="debrief-choice-note">Fly again keeps this rover. Back to lobby picks a new crew plan.</span>
                <button class="secondary-button" type="button" data-action="back-lobby">Back to lobby</button>
                <button class="primary-button" type="button" data-action="retry-mission">Fly again</button>
              </div>`
            : `<span class="waiting-note">Waiting for the host to choose the next step…</span>`
        }
      </footer>
    </div>`;
}
