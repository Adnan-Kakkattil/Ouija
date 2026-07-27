"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const store = require("../lib/store");

const router = express.Router();

const RULES = {
  username: /^[a-z0-9](?:[a-z0-9_.-]{1,22})[a-z0-9]$/i,
  email: /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i,
  teamName: /^[\p{L}\p{N}][\p{L}\p{N} '&.:_-]{2,30}$/u,
};

function fail(res, status, field, message) {
  return res.status(status).json({ ok: false, field, message });
}

function clientMeta(req, remember) {
  return {
    ip: req.headers["x-forwarded-for"]
      ? String(req.headers["x-forwarded-for"]).split(",")[0].trim()
      : req.socket.remoteAddress || null,
    userAgent: req.get("user-agent") || null,
    remember: !!remember,
  };
}

async function requireAuth(req, res, next) {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ ok: false, message: "The board does not recognise you. Enter first." });
    }
    const user = await store.findUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ ok: false, message: "Your chair has gone cold. Enter again." });
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

router.get("/teams", async (_req, res, next) => {
  try {
    res.json({ ok: true, teams: await store.teamsWithCounts() });
  } catch (err) {
    next(err);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.json({ ok: true, user: null });
    }
    const user = await store.findUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.json({ ok: true, user: null });
    }
    res.json({ ok: true, user: await store.publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get("/leaderboard", async (_req, res, next) => {
  try {
    const [rows, teams] = await Promise.all([store.leaderboard(), store.listTeams()]);
    res.json({ ok: true, rows, circles: teams.length });
  } catch (err) {
    next(err);
  }
});

router.post("/signup", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim();
    const password = String(req.body.password || "");
    let teamId = String(req.body.teamId || "");
    const newTeamName = String(req.body.newTeamName || "").trim();

    if (!username) return fail(res, 400, "username", "Every medium needs a name.");
    if (!RULES.username.test(username)) {
      return fail(
        res,
        400,
        "username",
        "3–24 characters: letters, numbers, and . _ - (must start and end with a letter or number)."
      );
    }
    if (!email) return fail(res, 400, "email", "We need somewhere to send the summons.");
    if (!RULES.email.test(email)) return fail(res, 400, "email", "That address does not resolve.");
    if (password.length < 8) {
      return fail(res, 400, "password", "At least 8 characters — the veil is thin, but not that thin.");
    }
    if (password.length > 200) return fail(res, 400, "password", "That incantation is too long.");

    const nameKey = username.toLowerCase();
    const mailKey = email.toLowerCase();

    if (await store.findUserByLogin(username)) {
      return fail(res, 409, "username", "Another medium already answers to that name.");
    }
    if (await store.findUserByLogin(email)) {
      return fail(res, 409, "email", "That address is already bound to a medium.");
    }

    if (teamId === "__new__" || (!teamId && newTeamName)) {
      if (!RULES.teamName.test(newTeamName)) {
        return fail(
          res,
          400,
          "teamName",
          "3–32 characters. Letters, numbers, spaces and ' & . : _ - only."
        );
      }
      const team = await store.createTeam(newTeamName);
      teamId = team.id;
    } else if (!teamId) {
      return fail(res, 400, "team", "Choose the circle you sit with.");
    } else if (!(await store.findTeam(teamId))) {
      return fail(res, 400, "team", "That circle has dissolved. Pick another.");
    }

    const hash = await bcrypt.hash(password, 12);
    const user = {
      id: "medium_" + randomUUID().replace(/-/g, "").slice(0, 12),
      username,
      usernameKey: nameKey,
      email,
      emailKey: mailKey,
      teamId,
      role: "medium",
      score: 0,
      solvedCount: 0,
      loginCount: 0,
      lastLoginAt: null,
      createdAt: Date.now(),
      passwordHash: hash,
    };

    try {
      await store.createUser(user);
    } catch (err) {
      if (err && err.code === 11000) {
        const field = String(err.message || "").includes("emailKey") ? "email" : "username";
        return fail(
          res,
          409,
          field,
          field === "email"
            ? "That address is already bound to a medium."
            : "Another medium already answers to that name."
        );
      }
      throw err;
    }

    await store.setTeamFounder(teamId, user.id);
    await store.recordLogin(user.id, clientMeta(req, false));

    req.session.userId = user.id;
    req.session.cookie.maxAge = 12 * 60 * 60 * 1000;

    req.session.save(async (err) => {
      if (err) {
        console.error("[signup] session save", err);
        return res.status(500).json({ ok: false, message: "The board refused. Try once more." });
      }
      res.status(201).json({ ok: true, user: await store.publicUser(user) });
    });
  } catch (err) {
    if (err.field) return fail(res, err.status || 400, err.field, err.message);
    console.error("[signup]", err);
    res.status(500).json({ ok: false, message: "The board refused. Try once more." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const identifier = String(req.body.identifier || "").trim();
    const password = String(req.body.password || "");
    const remember = !!req.body.remember;

    if (!identifier) return fail(res, 400, "identifier", "Name yourself, or give your address.");
    if (!password) return fail(res, 400, "password", "The passphrase is missing.");

    const user = await store.findUserByLogin(identifier);
    const rejection = "The spirits do not recognise that pairing.";

    if (!user) {
      await bcrypt.hash(password, 12);
      return fail(res, 401, "password", rejection);
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return fail(res, 401, "password", rejection);

    await store.recordLogin(user.id, clientMeta(req, remember));

    req.session.userId = user.id;
    req.session.cookie.maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;

    req.session.save(async (err) => {
      if (err) {
        console.error("[login] session save", err);
        return res.status(500).json({ ok: false, message: "The board stayed shut." });
      }
      const fresh = await store.findUserById(user.id);
      res.json({ ok: true, user: await store.publicUser(fresh || user) });
    });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ ok: false, message: "The board stayed shut." });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("ouija.sid");
    res.json({ ok: true });
  });
});

router.get("/stats", async (_req, res, next) => {
  try {
    const stats = await store.stats();
    res.json({
      ok: true,
      circles: stats.circles,
      mediums: stats.mediums,
      solves: stats.solveCount,
      challenges: 8,
      categories: 6,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = { router, requireAuth };
