"use strict";

const { randomUUID } = require("crypto");
const { getDb } = require("./db");

const SEED_CIRCLES = [
  { name: "The Hollow Choir", sigil: "☾" },
  { name: "Candlewick Circle", sigil: "🕯" },
  { name: "Order of the Pale Lantern", sigil: "✦" },
  { name: "Sisters of the Thin Veil", sigil: "◈" },
  { name: "The Ninth Knock", sigil: "❾" },
  { name: "Mourners of Blackmoor", sigil: "†" },
  { name: "The Ashen Seance", sigil: "☗" },
  { name: "Keepers of the Broken Planchette", sigil: "⚵" },
];

const SIGILS = ["☾", "✦", "◈", "†", "☗", "⚵", "✧", "⁂", "☥", "⚕", "❈", "⌘"];

function users() {
  return getDb().collection("users");
}
function teams() {
  return getDb().collection("teams");
}
function solves() {
  return getDb().collection("solves");
}
function logins() {
  return getDb().collection("logins");
}
function hints() {
  return getDb().collection("hints");
}

const store = {
  async seedTeams() {
    const count = await teams().countDocuments();
    if (count > 0) return;
    const seeded = SEED_CIRCLES.map((c) => ({
      id: "circle_" + randomUUID().replace(/-/g, "").slice(0, 12),
      name: c.name,
      nameKey: c.name.trim().toLowerCase(),
      sigil: c.sigil,
      createdAt: Date.now(),
      founderId: null,
      seeded: true,
    }));
    await teams().insertMany(seeded);
  },

  async listUsers() {
    return users().find({}, { projection: { _id: 0 } }).toArray();
  },

  async findUserById(id) {
    return users().findOne({ id }, { projection: { _id: 0 } });
  },

  async findUserByLogin(identifier) {
    const key = String(identifier || "").trim().toLowerCase();
    return users().findOne(
      { $or: [{ usernameKey: key }, { emailKey: key }] },
      { projection: { _id: 0 } }
    );
  },

  async createUser(user) {
    await users().insertOne({ ...user });
    return user;
  },

  async updateUser(id, patch) {
    await users().updateOne({ id }, { $set: patch });
    return this.findUserById(id);
  },

  async listTeams() {
    await this.seedTeams();
    return teams().find({}, { projection: { _id: 0 } }).sort({ name: 1 }).toArray();
  },

  async findTeam(id) {
    return teams().findOne({ id }, { projection: { _id: 0 } });
  },

  async createTeam(rawName, founderId) {
    const name = String(rawName || "").trim().replace(/\s+/g, " ");
    const nameKey = name.toLowerCase();
    const existing = await teams().findOne({ nameKey });
    if (existing) {
      const err = new Error("That circle already gathers. Choose it from the list instead.");
      err.field = "teamName";
      err.status = 409;
      throw err;
    }
    const team = {
      id: "circle_" + randomUUID().replace(/-/g, "").slice(0, 12),
      name,
      nameKey,
      sigil: SIGILS[(Math.random() * SIGILS.length) | 0],
      createdAt: Date.now(),
      founderId: founderId || null,
      seeded: false,
    };
    try {
      await teams().insertOne(team);
    } catch (err) {
      if (err && err.code === 11000) {
        const e = new Error("That circle already gathers. Choose it from the list instead.");
        e.field = "teamName";
        e.status = 409;
        throw e;
      }
      throw err;
    }
    return team;
  },

  async setTeamFounder(teamId, founderId) {
    await teams().updateOne(
      { id: teamId, $or: [{ founderId: null }, { founderId: { $exists: false } }] },
      { $set: { founderId } }
    );
  },

  async listSolvesForUser(userId) {
    return solves().find({ userId }, { projection: { _id: 0 } }).toArray();
  },

  async hasSolve(userId, challengeId) {
    const row = await solves().findOne({ userId, challengeId }, { projection: { _id: 1 } });
    return !!row;
  },

  async addSolve({ userId, challengeId, points }) {
    const row = {
      id: "solve_" + randomUUID().replace(/-/g, "").slice(0, 12),
      userId,
      challengeId,
      points,
      at: Date.now(),
    };
    await solves().insertOne(row);
    await users().updateOne(
      { id: userId },
      { $inc: { score: points, solvedCount: 1 } }
    );
    await this.advanceProgress(userId, challengeId);
    return row;
  },

  /* Remember which trial the medium last opened (survives logout/relogin) */
  async setLastChallenge(userId, challengeId) {
    if (!userId || !challengeId) return null;
    await users().updateOne(
      { id: userId },
      { $set: { lastChallengeId: challengeId, lastChallengeAt: Date.now() } }
    );
    return this.findUserById(userId);
  },

  /* After a solve, park on the next unsolved trial (or the one just claimed) */
  async advanceProgress(userId, justSolvedId) {
    const { challenges } = require("./challenges");
    const userSolves = await this.listSolvesForUser(userId);
    const done = new Set(userSolves.map((s) => s.challengeId));
    if (justSolvedId) done.add(justSolvedId);
    const next = challenges.find((c) => !done.has(c.id));
    const lastChallengeId = next ? next.id : justSolvedId || null;
    if (!lastChallengeId) return null;
    return this.setLastChallenge(userId, lastChallengeId);
  },

  resumePath(user) {
    if (user && user.lastChallengeId) {
      return "challenges.html#" + user.lastChallengeId;
    }
    return "dashboard.html";
  },

  async recordLogin(userId, meta = {}) {
    const at = Date.now();
    await logins().insertOne({
      id: "login_" + randomUUID().replace(/-/g, "").slice(0, 12),
      userId,
      at,
      ip: meta.ip || null,
      userAgent: meta.userAgent || null,
      remember: !!meta.remember,
    });
    await users().updateOne(
      { id: userId },
      {
        $set: { lastLoginAt: at, lastLoginIp: meta.ip || null },
        $inc: { loginCount: 1 },
      }
    );
  },

  async listHintIdsForUser(userId) {
    const rows = await hints().find({ userId }, { projection: { challengeId: 1, _id: 0 } }).toArray();
    return rows.map((r) => r.challengeId);
  },

  async hasHint(userId, challengeId) {
    const row = await hints().findOne({ userId, challengeId }, { projection: { _id: 1 } });
    return !!row;
  },

  /**
   * Unlock a hint: deduct points by difficulty (easy 10 / medium 20 / hard 30).
   * One purchase per user per challenge. Team score drops because it sums member scores.
   */
  async unlockHint(userId, challengeId, cost) {
    if (await this.hasHint(userId, challengeId)) {
      return { alreadyUnlocked: true, cost: 0, deducted: 0 };
    }

    const user = await this.findUserById(userId);
    if (!user) {
      const err = new Error("Chair gone cold.");
      err.status = 401;
      throw err;
    }

    const current = user.score || 0;
    const deducted = Math.min(cost, Math.max(0, current));
    const nextScore = Math.max(0, current - cost);

    try {
      await hints().insertOne({
        id: "hint_" + randomUUID().replace(/-/g, "").slice(0, 12),
        userId,
        challengeId,
        cost,
        deducted,
        at: Date.now(),
      });
    } catch (err) {
      if (err && err.code === 11000) {
        return { alreadyUnlocked: true, cost: 0, deducted: 0 };
      }
      throw err;
    }

    await users().updateOne(
      { id: userId },
      {
        $set: { score: nextScore },
        $inc: { hintsUsed: 1, hintPointsSpent: deducted },
      }
    );

    return { alreadyUnlocked: false, cost, deducted, score: nextScore };
  },

  async teamProgress(teamId) {
    if (!teamId) return null;
    const team = await this.findTeam(teamId);
    if (!team) return null;

    const members = await users()
      .find({ teamId }, { projection: { _id: 0, id: 1, username: 1, score: 1, solvedCount: 1, lastChallengeId: 1 } })
      .toArray();
    const memberIds = members.map((m) => m.id);
    const allSolves =
      memberIds.length === 0
        ? []
        : await solves()
            .find({ userId: { $in: memberIds } }, { projection: { _id: 0, challengeId: 1, userId: 1, points: 1, at: 1 } })
            .toArray();

    const solvedSet = [...new Set(allSolves.map((s) => s.challengeId))];
    const score = members.reduce((sum, m) => sum + (m.score || 0), 0);

    return {
      id: team.id,
      name: team.name,
      sigil: team.sigil,
      members: members.map((m) => ({
        id: m.id,
        username: m.username,
        score: m.score || 0,
        solvedCount: m.solvedCount || 0,
        lastChallengeId: m.lastChallengeId || null,
      })),
      memberCount: members.length,
      score,
      solvedChallengeIds: solvedSet,
      solvedCount: solvedSet.length,
    };
  },

  async publicUser(user) {
    if (!user) return null;
    const [team, userSolves, hintIds, teamProg] = await Promise.all([
      this.findTeam(user.teamId),
      this.listSolvesForUser(user.id),
      this.listHintIdsForUser(user.id),
      this.teamProgress(user.teamId),
    ]);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      teamId: user.teamId,
      teamName: team ? team.name : "Unaffiliated",
      teamSigil: team ? team.sigil : "○",
      score: user.score || 0,
      solved: userSolves.map((s) => s.challengeId),
      solvedCount: user.solvedCount || userSolves.length,
      hintsUsed: user.hintsUsed || hintIds.length,
      hintPointsSpent: user.hintPointsSpent || 0,
      unlockedHints: hintIds,
      loginCount: user.loginCount || 0,
      lastLoginAt: user.lastLoginAt || null,
      lastChallengeId: user.lastChallengeId || null,
      lastChallengeAt: user.lastChallengeAt || null,
      resumePath: this.resumePath(user),
      teamProgress: teamProg
        ? {
            score: teamProg.score,
            solvedCount: teamProg.solvedCount,
            solvedChallengeIds: teamProg.solvedChallengeIds,
            memberCount: teamProg.memberCount,
          }
        : null,
      createdAt: user.createdAt,
      role: user.role || "medium",
    };
  },

  async teamsWithCounts() {
    const [teamList, memberCounts] = await Promise.all([
      this.listTeams(),
      users()
        .aggregate([{ $group: { _id: "$teamId", count: { $sum: 1 } } }])
        .toArray(),
    ]);
    const byTeam = new Map(memberCounts.map((r) => [r._id, r.count]));
    return teamList
      .map((t) => ({
        id: t.id,
        name: t.name,
        sigil: t.sigil,
        seeded: !!t.seeded,
        memberCount: byTeam.get(t.id) || 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async leaderboard() {
    const [teamList, memberStats] = await Promise.all([
      this.listTeams(),
      users()
        .aggregate([
          {
            $group: {
              _id: "$teamId",
              members: { $sum: 1 },
              score: { $sum: { $ifNull: ["$score", 0] } },
              solved: { $sum: { $ifNull: ["$solvedCount", 0] } },
            },
          },
        ])
        .toArray(),
    ]);
    const byTeam = new Map(memberStats.map((r) => [r._id, r]));
    return teamList
      .map((t) => {
        const stats = byTeam.get(t.id) || { members: 0, score: 0, solved: 0 };
        return {
          id: t.id,
          name: t.name,
          sigil: t.sigil,
          members: stats.members,
          score: stats.score,
          solved: stats.solved,
        };
      })
      .filter((t) => t.members > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  },

  async stats() {
    const [circles, mediums, solveCount] = await Promise.all([
      teams().countDocuments(),
      users().countDocuments(),
      solves().countDocuments(),
    ]);
    return { circles, mediums, solveCount };
  },
};

module.exports = store;
