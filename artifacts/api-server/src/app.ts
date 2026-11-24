import express, { type Express } from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_PUBLIC_DIR = path.resolve(__dirname, "../../calc-dashboard/dist/public");
const PUBLIC_DIR = path.resolve(__dirname, "../../calc-dashboard/public");

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors());
app.use((_req, res, next) => {
  res.removeHeader("X-Frame-Options");
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/healthz", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "TENNIS-FUSION-SIGNAL",
    tours: ["ATP", "WTA"],
    defaultDeg3Option: "opt3",
    birthdateUsed: false,
    sheetsWriteEnabled: false,
  });
});

app.use("/api", router);
app.use("/fusion-rpc", router);

// Bounded LRU-style gzip cache for built frontend assets (dist/public) and 3-season ATP/WTA data shards (public)
const MAX_GZIP_CACHE_ENTRIES = 32;
const gzipCache = new Map<string, { mtimeMs: number; buf: Buffer }>();

function getMimeType(p: string): string {
  if (p.endsWith(".html")) return "text/html; charset=utf-8";
  if (p.endsWith(".svg")) return "image/svg+xml";
  if (p.endsWith(".json")) return "application/json; charset=utf-8";
  if (p.endsWith(".js") || p.endsWith(".mjs")) return "application/javascript; charset=utf-8";
  if (p.endsWith(".css")) return "text/css; charset=utf-8";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    next();
    return;
  }
  const rawPath = (req.path || "/").split("?")[0];
  if (rawPath.startsWith("/api/") || rawPath.startsWith("/fusion-rpc/")) {
    next();
    return;
  }

  const cleanRel = rawPath === "/" || rawPath === "" ? "index.html" : rawPath.replace(/^\/+/, "");
  const relCandidates = cleanRel.startsWith("data/")
    ? [cleanRel, cleanRel.slice(5)]
    : [cleanRel];
  const acceptEncoding = String(req.headers["accept-encoding"] || "");

  for (const relPath of relCandidates) {
    for (const baseDir of [DIST_PUBLIC_DIR, PUBLIC_DIR]) {
      const candidate = path.resolve(baseDir, relPath);
      if (!candidate.startsWith(baseDir) || !fs.existsSync(candidate)) continue;
      try {
        const st = fs.statSync(candidate);
        if (!st.isFile()) continue;

        const compressible =
          candidate.endsWith(".json") ||
          candidate.endsWith(".js") ||
          candidate.endsWith(".mjs") ||
          candidate.endsWith(".css") ||
          candidate.endsWith(".html");

        res.status(200);
        res.setHeader("Content-Type", getMimeType(candidate));
        if (candidate.endsWith(".json") || candidate.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        } else if (relPath.startsWith("assets/")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }

        if (compressible && acceptEncoding.includes("gzip")) {
          let cached = gzipCache.get(candidate);
          if (!cached || cached.mtimeMs !== st.mtimeMs) {
            const rawBuf = fs.readFileSync(candidate);
            cached = { mtimeMs: st.mtimeMs, buf: zlib.gzipSync(rawBuf, { level: 1 }) };
            if (gzipCache.size >= MAX_GZIP_CACHE_ENTRIES) {
              const oldestKey = gzipCache.keys().next().value;
              if (oldestKey) gzipCache.delete(oldestKey);
            }
            gzipCache.set(candidate, cached);
          }
          res.setHeader("Content-Encoding", "gzip");
          res.setHeader("Vary", "Accept-Encoding");
          res.setHeader("Content-Length", String(cached.buf.length));
          if (req.method === "HEAD") res.end();
          else res.end(cached.buf);
        } else {
          const rawBuf = fs.readFileSync(candidate);
          res.setHeader("Content-Length", String(rawBuf.length));
          if (req.method === "HEAD") res.end();
          else res.end(rawBuf);
        }
        return;
      } catch {
        // fall through
      }
    }
  }

  // SPA fallback to index.html for client-side routes
  const indexHtml = path.join(DIST_PUBLIC_DIR, "index.html");
  if (!path.extname(cleanRel) && fs.existsSync(indexHtml)) {
    res.status(200);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    res.sendFile(indexHtml);
    return;
  }

  next();
});

export default app;
