import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRealtimeServer } from "./realtime";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3001);
const builtClient = path.resolve(__dirname, "../client");
const serveClient =
  process.env.NODE_ENV === "production" || existsSync(path.join(builtClient, "index.html"));

const realtime = createRealtimeServer({
  clientDir: builtClient,
  serveClient,
});

realtime.httpServer.listen(port, "0.0.0.0", () => {
  console.log(`[red-frontier] surface link listening on http://127.0.0.1:${port}`);
  if (!serveClient) {
    console.log("[red-frontier] client dev server: http://127.0.0.1:5173");
  }
});

const shutdown = (signal: string): void => {
  console.log(`[red-frontier] ${signal} received, closing surface link.`);
  void realtime.close().finally(() => process.exit(0));
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
