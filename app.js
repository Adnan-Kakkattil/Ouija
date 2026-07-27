"use strict";

/**
 * OUIJA CTF — Hostinger Business Web Hosting (Node.js Web App).
 *
 * hPanel → Websites → Node.js Web App:
 *  - Framework: Express.js (or Other)
 *  - Entry file: app.js
 *  - Build command: npm run build   (no-op)
 *  - Start command: npm start
 *  - Node version: 20.x preferred (18 / 22 / 24 also supported)
 *  - Must listen on process.env.PORT (Hostinger injects this)
 *  - Bind 0.0.0.0 so the managed reverse proxy can reach the process
 *  - Env vars in hPanel (MONGODB_URI, SESSION_SECRET, COOKIE_SECURE=1, NODE_ENV=production)
 *
 * After GitHub auto-deploy the Node process restarts for ~30–90s. During that
 * window /api/* may 404 HTML while static HTML still loads — clients retry.
 * If /api/health stays dead: hPanel → website → Running → Restart.
 */

const path = require("path");

/*
 * Hostinger shared Node often runs 18.x. MongoDB driver 7+ needs Node 20.19+
 * (globalThis.crypto). We pin mongodb@6 and polyfill crypto for safety.
 */
(() => {
  try {
    const { webcrypto } = require("crypto");
    if (!globalThis.crypto && webcrypto) globalThis.crypto = webcrypto;
  } catch (_) {
    /* ignore */
  }
})();

/* Load local secrets if present; hPanel env vars always win */
require("dotenv").config({ path: path.join(__dirname, "atlas-credentials.env"), quiet: true });
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });

const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");

const { connect, mongoUrl, isConnected } = require("./src/lib/db");
const store = require("./src/lib/store");
const auth = require("./src/routes/auth");
const challenges = require("./src/routes/challenges");
const rooms = require("./src/routes/rooms");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const IS_PROD = process.env.NODE_ENV === "production";

/* Hostinger terminates TLS at the proxy — honour X-Forwarded-* */
app.set("trust proxy", 1);

app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

function cookieSecure() {
  if (process.env.COOKIE_SECURE === "1") return true;
  if (process.env.COOKIE_SECURE === "0") return false;
  /* Business Node is always behind HTTPS at the edge */
  return IS_PROD;
}

function isHostinger() {
  return Boolean(
    process.env.HOSTINGER ||
      process.env.HOSTINGER_SITE_ID ||
      process.env.HS_SERVER ||
      /hostinger/i.test(String(process.env.HOSTNAME || ""))
  );
}

function mountApp(sessionStore) {
  app.use(
    session({
      name: "ouija.sid",
      secret: process.env.SESSION_SECRET || "ouija-blackmoor-change-me-in-production",
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: cookieSecure(),
        maxAge: 12 * 60 * 60 * 1000,
      },
    })
  );

  /* Easter-egg cookie for the web challenge */
  app.use((req, res, next) => {
    if (!req.cookies["spirit_crumb"]) {
      res.cookie("spirit_crumb", "ouija{session_of_the_living}", {
        httpOnly: false,
        sameSite: "lax",
        secure: cookieSecure(),
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    next();
  });

  app.get("/api/health", async (_req, res) => {
    const payload = {
      ok: true,
      service: "ouija-ctf",
      build: "rooms-v2",
      rooms: true,
      hostinger: isHostinger() || IS_PROD,
      port: PORT,
      host: HOST,
      db: isConnected() ? "mongodb" : "memory-degraded",
    };
    if (!isConnected()) {
      return res.status(200).json({
        ...payload,
        ok: true,
        warning: "MongoDB not connected — set MONGODB_URI in hPanel and allow Atlas 0.0.0.0/0.",
      });
    }
    try {
      const stats = await store.stats();
      res.json({ ...payload, circles: stats.circles, mediums: stats.mediums });
    } catch (err) {
      res.status(200).json({ ...payload, warning: String(err.message || err) });
    }
  });

  app.use("/api/auth", auth.router);
  app.use("/api/challenges", challenges);
  app.use("/api/rooms", rooms);

  app.use(
    express.static(PUBLIC_DIR, {
      extensions: ["html"],
      etag: true,
      lastModified: true,
      index: false,
      /* Avoid week-long stale signup/login JS after Hostinger auto-deploys */
      setHeaders(res, filePath) {
        const lower = String(filePath || "").toLowerCase();
        if (lower.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          return;
        }
        if (lower.endsWith(".js") || lower.endsWith(".css")) {
          res.setHeader("Cache-Control", "public, max-age=120, must-revalidate");
          return;
        }
        if (/\.(mp4|webm)$/i.test(lower)) {
          /* Large rite/gate videos — long cache; Express streams with Range support */
          res.setHeader("Cache-Control", IS_PROD ? "public, max-age=86400, immutable" : "no-cache");
          res.setHeader("Accept-Ranges", "bytes");
          return;
        }
        if (/\.(png|jpe?g|gif|svg|webp|woff2?)$/i.test(lower)) {
          res.setHeader("Cache-Control", IS_PROD ? "public, max-age=86400" : "no-cache");
          return;
        }
        res.setHeader("Cache-Control", IS_PROD ? "public, max-age=3600" : "no-cache");
      },
    })
  );

  app.get("/", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });

  app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ ok: false, message: "Nothing answers on that channel." });
    }
    res.status(404).sendFile(path.join(PUBLIC_DIR, "index.html"));
  });

  app.use((err, _req, res, _next) => {
    if (err && err.type === "entity.parse.failed") {
      return res.status(400).json({ ok: false, message: "Malformed offering (invalid JSON)." });
    }
    console.error("[ouija]", err);
    res.status(500).json({ ok: false, message: "The veil tore unexpectedly." });
  });
}

async function createSessionStore() {
  try {
    await connect();
    await store.seedTeams();
    await store.backfillPointsLedger().catch((err) => {
      console.warn("[ouija] points ledger backfill skipped:", err.message || err);
    });
    const { MongoStore } = require("connect-mongo");
    console.log(`[ouija] MongoDB connected (${process.env.MONGODB_DB || "ouija"})`);
    return MongoStore.create({
      mongoUrl: mongoUrl(),
      dbName: process.env.MONGODB_DB || "ouija",
      collectionName: "sessions",
      ttl: 60 * 60 * 24 * 30,
      autoRemove: "native",
    });
  } catch (err) {
    console.error("[ouija] MongoDB unavailable — using MemoryStore (sessions reset on restart).");
    console.error("[ouija] Fix: set MONGODB_URI + MONGODB_DB in hPanel, Atlas Network Access 0.0.0.0/0");
    console.error("[ouija]", err && err.message ? err.message : err);
    return new session.MemoryStore();
  }
}

let server = null;

function listen() {
  return new Promise((resolve, reject) => {
    server = app.listen(PORT, HOST, () => {
      console.log(`[ouija] listening on http://${HOST}:${PORT}`);
      console.log(`[ouija] static root: ${PUBLIC_DIR}`);
      console.log(`[ouija] env: NODE_ENV=${process.env.NODE_ENV || "unset"} PORT=${PORT}`);
      resolve(server);
    });
    server.on("error", reject);
    /* Shared hosting: avoid hanging sockets after Hostinger recycle */
    server.keepAliveTimeout = 65_000;
    server.headersTimeout = 70_000;
  });
}

function wireSignals() {
  const shutdown = (signal) => {
    console.log(`[ouija] ${signal} — closing (Hostinger recycle/redeploy)`);
    if (!server) {
      process.exit(0);
      return;
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 8000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (err) => {
    console.error("[ouija] unhandledRejection", err && err.message ? err.message : err);
  });
}

async function boot() {
  if (!process.env.SESSION_SECRET && IS_PROD) {
    console.warn("[ouija] WARNING: SESSION_SECRET is not set in hPanel Environment Variables.");
  }
  if (IS_PROD && process.env.COOKIE_SECURE !== "0" && process.env.COOKIE_SECURE !== "1") {
    console.warn("[ouija] TIP: set COOKIE_SECURE=1 in hPanel for HTTPS session cookies.");
  }

  const sessionStore = await createSessionStore();
  mountApp(sessionStore);
  wireSignals();
  await listen();
}

boot().catch((err) => {
  console.error("[ouija] fatal boot error:", err);
  /* Last resort: still try to serve so Hostinger health checks are not blank 503 */
  try {
    mountApp(new session.MemoryStore());
    wireSignals();
    listen()
      .then(() => console.error("[ouija] booted in emergency memory-session mode"))
      .catch((err2) => {
        console.error("[ouija] emergency boot failed:", err2);
        process.exit(1);
      });
  } catch (err2) {
    console.error("[ouija] emergency boot failed:", err2);
    process.exit(1);
  }
});

module.exports = app;
