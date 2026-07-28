"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const store = require("../lib/store");

const router = express.Router();

const RULES = {
  username: /^[a-z0-9](?:[a-z0-9_.-]{1,22})[a-z0-9]$/i,
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

async function optionalAuth(req, res, next) {
  try {
    req.user = null;
    if (req.session && req.session.userId) {
      req.user = await store.findUserById(req.session.userId);
    }
    next();
  } catch (err) {
    next(err);
  }
}

function saveSession(req, userId, maxAge) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenErr) => {
      if (regenErr) return reject(regenErr);
      req.session.userId = userId;
      req.session.cookie.maxAge = maxAge;
      req.session.save((saveErr) => {
        if (saveErr) return reject(saveErr);
        resolve();
      });
    });
  });
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

/* Full point ledger: every +solve and −hint for the seated medium */
router.get("/points", requireAuth, async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const [entries, totals] = await Promise.all([
      store.listPointsForUser(req.user.id, limit),
      store.pointTotals(req.user.id),
    ]);
    res.json({
      ok: true,
      entries,
      totals,
      score: req.user.score || 0,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/leaderboard", async (req, res, next) => {
  try {
    const all = String(req.query.all || "") === "1" || String(req.query.all || "") === "true";
    const [rows, teams] = await Promise.all([
      store.leaderboard({ includeEmpty: all }),
      store.listTeams(),
    ]);
    res.json({
      ok: true,
      rows,
      circles: teams.length,
      updatedAt: Date.now(),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/signup", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    const agree = !!req.body.agree;

    if (!username) return fail(res, 400, "username", "Every medium needs a name.");
    if (!RULES.username.test(username)) {
      return fail(
        res,
        400,
        "username",
        "3–24 characters: letters, numbers, and . _ - (must start and end with a letter or number)."
      );
    }
    if (!password) return fail(res, 400, "password", "Choose a password.");
    if (password.length > 512) return fail(res, 400, "password", "That password is too long.");
    if (!agree) return fail(res, 400, "agree", "You must accept the terms & conditions.");

    const team = await store.resolveRegistrationTeam(req.body.teamId);
    if (!team) {
      return fail(res, 400, "teamId", "Choose your team from the list.");
    }

    const nameKey = username.toLowerCase();
    if (await store.findUserByLogin(username)) {
      return fail(res, 409, "username", "Another medium already answers to that name.");
    }

    const teamId = team.id;
    const email = nameKey + "@local.ouija";
    const mailKey = email;

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
      pointsEarned: 0,
      pointsSpent: 0,
      hintsUsed: 0,
      hintPointsSpent: 0,
      loginCount: 0,
      lastLoginAt: null,
      lastChallengeId: null,
      lastChallengeAt: null,
      storySeenAt: null,
      createdAt: Date.now(),
      passwordHash: hash,
    };

    try {
      await store.createUser(user);
    } catch (err) {
      if (err && err.code === 11000) {
        return fail(res, 409, "username", "Another medium already answers to that name.");
      }
      throw err;
    }

    await store.recordLogin(user.id, clientMeta(req, false));

    await saveSession(req, user.id, 12 * 60 * 60 * 1000);
    res.status(201).json({ ok: true, user: await store.publicUser(user) });
  } catch (err) {
    if (err.field) return fail(res, err.status || 400, err.field, err.message);
    console.error("[signup]", err);
    res.status(500).json({ ok: false, message: "The board refused. Try once more." });
  }
});

router.post("/story-seen", requireAuth, async (req, res, next) => {
  try {
    await store.markStorySeen(req.user.id);
    const fresh = await store.findUserById(req.user.id);
    res.json({ ok: true, user: await store.publicUser(fresh) });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res) => {
  try {
    const identifier = String(req.body.identifier || "").trim();
    const password = String(req.body.password || "");
    const remember = !!req.body.remember;

    if (!identifier) return fail(res, 400, "identifier", "Enter your username.");
    if (!password) return fail(res, 400, "password", "The password is missing.");

    const user = await store.findUserByLogin(identifier);
    const rejection = "The spirits do not recognise that pairing.";

    if (!user) {
      await bcrypt.hash(password, 12);
      return fail(res, 401, "password", rejection);
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return fail(res, 401, "password", rejection);

    await store.recordLogin(user.id, clientMeta(req, remember));

    const maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
    await saveSession(req, user.id, maxAge);

    const fresh = await store.findUserById(user.id);
    res.json({ ok: true, user: await store.publicUser(fresh || user) });
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
    const { challenges, trialSummary } = require("../lib/challenges");
    const stats = await store.stats();
    const trials = trialSummary(challenges);
    res.json({
      ok: true,
      circles: stats.circles,
      mediums: stats.mediums,
      solves: stats.solveCount,
      challenges: challenges.length,
      categories: trials.length,
      trials,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = { router, requireAuth, optionalAuth };
