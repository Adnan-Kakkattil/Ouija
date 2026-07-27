"use strict";

/**
 * OUIJA CTF — Hostinger-ready Express entry point.
 *
 * Hostinger Node apps:
 *  - Entry file: app.js (this file)
 *  - Start: npm start  →  node app.js
 *  - Must listen on process.env.PORT
 *  - Node 18 / 20 / 22 / 24 supported (see package.json engines)
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "atlas-credentials.env"), quiet: true });
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });

const express = require("express");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const cookieParser = require("cookie-parser");

const { connect, mongoUrl } = require("./src/lib/db");
const store = require("./src/lib/store");
const auth = require("./src/routes/auth");
const challenges = require("./src/routes/challenges");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

app.set("trust proxy", 1);

app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

async function boot() {
  await connect();
  await store.seedTeams();

  app.use(
    session({
      name: "ouija.sid",
      secret: process.env.SESSION_SECRET || "ouija-blackmoor-change-me-in-production",
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: mongoUrl(),
        dbName: process.env.MONGODB_DB || "ouija",
        collectionName: "sessions",
        ttl: 60 * 60 * 24 * 30,
        autoRemove: "native",
      }),
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        /* Hostinger terminates TLS; set COOKIE_SECURE=1 in production HTTPS */
        secure: process.env.COOKIE_SECURE === "1",
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
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    next();
  });

  app.get("/api/health", async (_req, res) => {
    try {
      const stats = await store.stats();
      res.json({
        ok: true,
        service: "ouija-ctf",
        port: PORT,
        db: "mongodb",
        circles: stats.circles,
        mediums: stats.mediums,
      });
    } catch {
      res.status(503).json({ ok: false, service: "ouija-ctf", message: "Database veil is closed." });
    }
  });

  app.use("/api/auth", auth.router);
  app.use("/api/challenges", challenges);

  app.use(
    express.static(PUBLIC_DIR, {
      extensions: ["html"],
      maxAge: process.env.NODE_ENV === "production" ? "7d" : 0,
      etag: true,
      lastModified: true,
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

  app.listen(PORT, () => {
    console.log(`Ouija CTF listening on port ${PORT}`);
    console.log(`MongoDB connected (${process.env.MONGODB_DB || "ouija"})`);
    console.log(`Open http://localhost:${PORT}`);
  });
}

boot().catch((err) => {
  console.error("[ouija] failed to start:", err);
  process.exit(1);
});

module.exports = app;
