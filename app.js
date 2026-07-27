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
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const cookieParser = require("cookie-parser");

const auth = require("./src/routes/auth");
const challenges = require("./src/routes/challenges");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SESSION_DIR = path.join(__dirname, "sessions");
const PUBLIC_DIR = path.join(__dirname, "public");

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
if (!fs.existsSync(path.join(__dirname, "data"))) {
  fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
}

app.set("trust proxy", 1);

app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(
  session({
    name: "ouija.sid",
    secret: process.env.SESSION_SECRET || "ouija-blackmoor-change-me-in-production",
    resave: false,
    saveUninitialized: false,
    store: new FileStore({
      path: SESSION_DIR,
      ttl: 60 * 60 * 24,
      retries: 1,
      logFn: () => {},
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "ouija-ctf", port: PORT });
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
  console.log(`Open http://localhost:${PORT}`);
});

module.exports = app;
