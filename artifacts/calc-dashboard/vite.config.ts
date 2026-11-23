import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { spawn } from "child_process";
import net from "net";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

function ensureApiServerRunning() {
  const check = () => {
    const sock = new net.Socket();
    sock.setTimeout(1000);
    sock.once("connect", () => {
      sock.destroy();
    });
    const startIt = () => {
      sock.destroy();
      const apiDir = path.resolve(import.meta.dirname, "..", "api-server");
      const child = spawn("node", ["--enable-source-maps", "./dist/index.mjs"], {
        cwd: apiDir,
        env: { ...process.env, PORT: "8080", NODE_ENV: "development" },
        stdio: "ignore",
        detached: true,
      });
      child.unref();
    };
    sock.once("error", startIt);
    sock.once("timeout", startIt);
    sock.connect(8080, "127.0.0.1");
  };
  check();
  setInterval(check, 5000).unref();
}

const isBuildCmd = process.argv.includes("build") || process.env.NODE_ENV === "production";
if (!isBuildCmd) {
  ensureApiServerRunning();
}

const rawPort = process.env.PORT || "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || "./";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    copyPublicDir: process.env.VITE_SKIP_PUBLIC_COPY !== "1",
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    watch: { ignored: ["**/public/fusion_*.json"] },
    proxy: {
      "/fusion-rpc": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/fusion-rpc/, "/api"),
      },
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    watch: { ignored: ["**/public/fusion_*.json"] },
  },
});
