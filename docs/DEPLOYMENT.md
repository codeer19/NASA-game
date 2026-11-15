# RED FRONTIER — DEPLOYMENT

This guide covers the supported deployment paths for **RED FRONTIER — MISSION MARS**:
a single Node.js instance serving the built client and the Socket.IO surface link, Docker,
Render, and Railway.

## 1. Runtime model

The game is one Node process:

- Express serves the production client from `dist/client`.
- Socket.IO shares the same HTTP server for WebSocket upgrades.
- Room and mission state live **in memory** inside that process.
- There is no database, object storage, or external queue.

This means the supported topology is **exactly one application instance**. Do not enable
multiple replicas or autoscaling. Two instances would each have their own rooms, so a
crew could not join or recover a session reliably. To scale beyond one instance you would
need shared room state (for example Redis) plus sticky Socket.IO sessions; neither is
included.

A restart clears every lobby and in-flight mission. A redeploy therefore ends active
crews; players can create a new room after the process is healthy again.

## 2. Requirements

- Node.js **20 or newer** (see `package.json` → `engines`).
- A host that supports long-lived WebSocket connections.
- HTTPS in front of the app. Browsers restrict fullscreen, audio, and some input APIs on
  insecure origins, and HTTPS is required for a good experience on phones.
- No API keys, secrets, or environment-specific build flags.

Building does **not** require Python. The Python/Pillow art pipeline is only needed if you
intentionally regenerate `client/public/assets`; the approved art is committed and copied
by Vite.

## 3. Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | HTTP port the Node server binds to (`0.0.0.0`). |
| `NODE_ENV` | unset | Set to `production` to force serving the built client. The server also serves the client automatically when `dist/client/index.html` exists. |

No other variables are read. Do not add a `.env` file to the image; none is needed.

## 4. Build and run locally

```bash
npm ci
npm run build
NODE_ENV=production PORT=3001 npm start
```

Open <http://127.0.0.1:3001>. Verify:

```bash
curl -fsS http://127.0.0.1:3001/healthz
```

Expected response:

```json
{"ok":true,"service":"red-frontier-mission-mars","rooms":0,"players":0,"now":"..."}
```

`npm run build` runs the TypeScript check, builds the client into `dist/client`, and
bundles the server into `dist/server/index.js`. The server bundle keeps `express` and
`socket.io` external, so production installs must include runtime dependencies.

## 5. Docker

The repository includes a multi-stage `Dockerfile` that builds the app, prunes development
dependencies, and runs as the unprivileged `node` user.

```bash
docker build -t red-frontier-mission-mars .
docker run --rm -p 3001:3001 -e PORT=3001 red-frontier-mission-mars
```

The image exposes `3001` and defines a health check against `/healthz`. Container files
are disposable, and room state is intentionally ephemeral: a container restart clears all
rooms and missions.

If you deploy behind a reverse proxy, forward WebSocket upgrade headers for
`/socket.io/`. A minimal nginx location looks like this:

```nginx
location /socket.io/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;
}

location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
}
```

## 6. Render

The included `render.yaml` blueprint declares one Node web service:

1. Push the repository to a Git provider.
2. In Render, choose **New → Blueprint** and select the repository.
3. Apply the blueprint. It runs `npm ci && npm run build`, starts `npm start`, and checks
   `/healthz`.
4. Keep the service at **one instance**. Render's free plan sleeps after inactivity, which
   disconnects crews and clears in-memory rooms; use a paid instance for a demo or judging
   window.

If you configure the service manually instead of using the blueprint:

- Environment: Node 20+.
- Build command: `npm ci && npm run build`.
- Start command: `npm start`.
- Health check path: `/healthz`.
- Instances: `1`.

## 7. Railway

1. Create a project from the repository.
2. Railway detects the Node app. Set the build command to `npm ci && npm run build` and the
   start command to `npm start`.
3. Add `NODE_ENV=production`; leave `PORT` unset so Railway can inject its assigned port.
   The server reads `process.env.PORT`.
4. Set the health check path to `/healthz`.
5. Deploy **one replica**. Do not add horizontal scaling.

## 8. Health, logs, and operations

- **Health check:** `GET /healthz` returns service name, current room count, connected
  player count, and a timestamp. Use it for platform health checks and uptime probes.
- **Logs:** the process logs the listening URL on boot and lifecycle messages on
  `SIGINT`/`SIGTERM`. Socket handler failures are logged with a `[red-frontier]` prefix.
- **Shutdown:** the server closes Socket.IO and the HTTP server on `SIGINT`/`SIGTERM`.
  Give the platform a short termination grace period; active missions are lost either way.
- **Capacity:** the server admits at most 250 concurrent rooms, with up to four players per
  room (`MAX_PLAYERS`). Mission broadcasts are about 5 Hz per room. A small 1 vCPU / 512 MB
  instance is ample for a demo or judging deployment.
- **Abuse limits:** Socket.IO messages are capped at 64 KB and JSON bodies at 32 KB. No
  authentication or rate limiting beyond room/phase validation is included; do not expose
  the game as a public high-traffic service without adding both.

## 9. Deployment checklist

- [ ] `npm ci && npm run typecheck && npm test && npm run build` passes.
- [ ] `PORT` and `NODE_ENV=production` are set as intended.
- [ ] Exactly one instance/replica is running.
- [ ] HTTPS terminates in front of the app.
- [ ] The platform forwards WebSocket upgrades for `/socket.io/`.
- [ ] `/healthz` returns `ok: true` after deploy.
- [ ] Two browser tabs can create/join a room, launch, and complete a mission.
- [ ] A redeploy is scheduled outside any active demo or judging window.

## 10. Known limitations

- Rooms and missions are not persisted; restarts and idle cleanup remove them.
- Late joins after the lobby are rejected by design.
- There is no account system, moderation system, or cross-region state replication.
- All resources, costs, and timings are simplified educational gameplay values, not
  operational data. NASA does not endorse this project.
