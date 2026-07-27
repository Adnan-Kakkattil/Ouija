"use strict";

/**
 * OUIJA CTF — Hostinger Business / Cloud Node entry point.
 *
 * Hostinger Node Web Apps (Business plan):
 *  - Framework: Express.js (or Other)
 *  - Entry file: app.js
 *  - Build command: npm run build   (no-op)
 *  - Start command: npm start
 *  - Must listen on process.env.PORT (injected by Hostinger)
 *  - Bind 0.0.0.0 so the reverse proxy can reach the process
 *  - Set env vars in hPanel (do not rely on committed .env)
 */

const path = require("path");

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

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const IS_PROD = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

function cookieSecure() {
  if (process.env.COOKIE_SECURE === "1") return true;
  if (process.env.COOKIE_SECURE === "0") return false;
  return IS_PROD;
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

  app.use(
    express.static(PUBLIC_DIR, {
      extensions: ["html"],
      maxAge: IS_PROD ? "7d" : 0,
      etag: true,
      lastModified: true,
      index: false,
    })
  );

  app.get("/", (_req, res) => {
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

async function boot() {
  if (!process.env.SESSION_SECRET && IS_PROD) {
    console.warn("[ouija] WARNING: SESSION_SECRET is not set in production.");
  }

  const sessionStore = await createSessionStore();
  mountApp(sessionStore);

  app.listen(PORT, HOST, () => {
    console.log(`Ouija CTF listening on http://${HOST}:${PORT}`);
    console.log(`Static root: ${PUBLIC_DIR}`);
  });
}

boot().catch((err) => {
  console.error("[ouija] fatal boot error:", err);
  /* Last resort: still try to serve static files so the site is not a blank 503 */
  try {
    mountApp(new session.MemoryStore());
    app.listen(PORT, HOST, () => {
      console.error("[ouija] booted in emergency static mode");
    });
  } catch (err2) {
    console.error("[ouija] emergency boot failed:", err2);
    process.exit(1);
  }
});

module.exports = app;
