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
    return row;
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

  async publicUser(user) {
    if (!user) return null;
    const [team, userSolves] = await Promise.all([
      this.findTeam(user.teamId),
      this.listSolvesForUser(user.id),
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
      loginCount: user.loginCount || 0,
      lastLoginAt: user.lastLoginAt || null,
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
