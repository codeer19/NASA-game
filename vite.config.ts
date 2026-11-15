import { defineConfig } from "vite";

export default defineConfig({
  root: "client",
  publicDir: "public",
  base: "/",
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/socket.io": {
        target: "http://127.0.0.1:3001",
        ws: true,
      },
    },
  },
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
  },
});
