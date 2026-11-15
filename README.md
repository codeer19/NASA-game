# RED FRONTIER — MISSION MARS

A cooperative, 1–4 player pixel-art Mars field-science game for the browser. Assemble a
crew, design a rover, cross Ares Basin, survive five mission dilemmas, and downlink the
science package before the surface window closes.

Red Frontier is an original fictional game. **NASA does not endorse or sponsor it.** No
NASA logos, photographs, patches, facility reconstructions, employee likenesses, or
third-party game assets are used. All characters, organisations, hardware, and values are
fictional. Every resource, cost, and timing is a **simplified educational gameplay
value**, not an operational specification.

## What is in the box

- Real-time 1–4 player crews with four-character room codes and session recovery.
- Four distinct flight stations, each with an active tool and a passive specialty.
- A shared rover payload phase: two or three modules under a 30-credit cap.
- A server-synchronised launch and landing sequence.
- A 384×224 integer-scaled Mars surface with five field objectives and a lander downlink.
- Six live resources: budget, mass margin, power, data, comms, and mission clock.
- Five crew-voted mission events with role, module, and choice interactions.
- Success and failure debriefs, mission retry, and return-to-lobby flow.
- Original 16-bit art, a deterministic art pipeline, and procedural WebAudio sound.
- Desktop keyboard, mouse, and touch controls.

## Quick start

Requirements: **Node.js 20 or newer**.

```bash
npm install
npm run dev
```

- Client (Vite): http://127.0.0.1:5173
- Server (Socket.IO): http://127.0.0.1:3001
- Health check: http://127.0.0.1:3001/healthz

Open a second browser tab or a second device on the same network to test a crew. The Vite
dev server proxies Socket.IO to port 3001.

### Production build

```bash
npm run build
npm start
```

The production server serves the built client and Socket.IO from a single process at
`http://127.0.0.1:3001` (override with `PORT`). The build output lives in `dist/client` and
`dist/server`.

## How to play

1. **Crew link.** One player hosts a mission and shares the four-character code. Each
   connected player selects one of the four stations and marks ready. Joining is only
   possible while the crew is in the lobby.
2. **Rover bay.** The flight director opens the payload bay once everyone is ready. The
   crew shares one design: choose 2–3 modules within 30 payload credits. Changing the
   design clears every certification. Every crew member certifies, then the flight
   director begins the launch.
3. **Launch.** Ascent and touchdown are synchronised for the whole crew. The surface link
   hands over automatically.
4. **Surface operations.** Walk to a field site, hold the action key, and work the
   objective. Crew members standing at the same site contribute together and finish it
   faster. Power, comms, and the mission clock drain continuously.
5. **Crew decisions.** Five dilemmas open across the mission. Each connected player votes;
   the crew's choice applies to everyone. Ties are broken by the station named in the
   event brief. A vote that times out is resolved by the crew's current position.
6. **Downlink.** Complete all five field objectives, return to the lander, and transmit.
   The debrief grades the science package. Failure ends the attempt; the flight director
   can retry with the same crew and design.

### Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | `WASD` or arrow keys | On-screen directional pad |
| Interact / hold to work | `E` | Action button |
| Use station tool | `Q` | Tool button |
| Select interface controls | Mouse / keyboard | Tap |

Sound, fullscreen, field notes, and references are available from the top bar. The mission
rail includes quick crew comms messages.

## Stations

| Station | Active tool | Passive |
|---|---|---|
| Aerospace Engineer | **Field Repair** — recover 20 power | Rover power drain reduced 15% |
| Mars Satellite Controller | **Uplink Sweep** — recover 28 comms | Comms decay reduced 25% |
| Finance Administrator | **Requisition** — release 15 credits | Negative event budget effects reduced 20% |
| Mission Designer | **Route Pulse** — +25% crew speed for 15 s | Negative event time effects reduced 20% |

## Payload modules

| Module | Cost | Effect |
|---|---|---|
| Terrain Bogie | 9 cr | +18% traverse speed |
| Sample Arm | 11 cr | Field samples 35% faster; +2 data per sample |
| Spectrometer | 8 cr | +4 data per sample |
| Weather Mast | 7 cr | Comms decay reduced 25%; storm penalties softened |

## Architecture

- `shared/` — state contracts, content, and pure mission rules used by both sides.
- `server/src/realtime.ts` — authoritative Express/Socket.IO server: rooms, roles,
  readiness, shared design, launch, mission ticking, interactions, events, scoring,
  disconnects, retry, and lobby return.
- `client/src/` — Phaser 3 title, lobby/rover bay, launch, and Mars scenes plus the DOM
  console, typed store, Socket.IO client, WebAudio director, and responsive styling.
- `client/public/assets/` — approved, original pixel art and the generated manifest.
- `scripts/` — deterministic Pillow art generation and validation.
- `tests/` — Vitest unit tests and real multi-client Socket.IO integration tests.

The server is authoritative for room and mission state. Clients send movement, interaction,
station-tool, and vote intents; the server validates range, phase, cooldowns, and targets.
Rooms live in memory and are not persisted across server restarts.

## Testing

```bash
npm run typecheck
npm test
npm run build
```

The test suite covers design validation, mission setup, event modifiers, resource clamps,
scoring, room creation, station uniqueness, shared payload changes, readiness, launch
synchronisation, late-join rejection, and token-based session recovery over a real
Socket.IO connection.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Render, Railway, and Docker instructions.
The short version:

```bash
npm ci
npm run build
NODE_ENV=production PORT=3001 npm start
```

Deploy a **single instance** unless you add shared room state (for example Redis) and
sticky Socket.IO sessions. Use HTTPS so browsers permit fullscreen and audio reliably.
A production image is included:

```bash
docker build -t red-frontier-mission-mars .
docker run --rm -p 3001:3001 red-frontier-mission-mars
```

## Art and references

The art direction and technical constraints are documented in
[docs/ART_BIBLE.md](docs/ART_BIBLE.md). The in-game field notes cite NASA public
educational topics (Mars dust storms, light time, rover mobility, hydrated minerals, and
surface radiation) as background reading. Those citations are references, not NASA
endorsement, and the game does not reproduce NASA imagery.

## Credits

Design, code, and art pipeline: the Red Frontier team. Built with Phaser 3, Vite,
Socket.IO, Express, and Pillow. No third-party sprites, tilesets, music, or franchise
assets are included.
