"use strict";

const { randomUUID } = require("crypto");
const { getDb } = require("./db");

const REGISTRATION_TEAMS = [
  { id: "team_1", name: "Team 1", sigil: "Ⅰ" },
  { id: "team_2", name: "Team 2", sigil: "Ⅱ" },
  { id: "team_3", name: "Team 3", sigil: "Ⅲ" },
  { id: "team_4", name: "Team 4", sigil: "Ⅳ" },
  { id: "team_5", name: "Team 5", sigil: "Ⅴ" },
  { id: "team_6", name: "Team 6", sigil: "Ⅵ" },
  { id: "team_7", name: "Team 7", sigil: "Ⅶ" },
  { id: "team_8", name: "Team 8", sigil: "Ⅷ" },
  { id: "team_9", name: "Team 9", sigil: "Ⅸ" },
];

const REGISTRATION_TEAM_IDS = REGISTRATION_TEAMS.map((t) => t.id);

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
function points() {
  return getDb().collection("points");
}

const store = {
  async seedTeams() {
    for (const t of REGISTRATION_TEAMS) {
      const nameKey = t.name.toLowerCase();
      const clash = await teams().findOne({ nameKey, id: { $ne: t.id } });
      if (clash) {
        await teams().updateOne(
          { id: clash.id },
          {
            $set: {
              name: String(clash.name || "Circle") + " (legacy)",
              nameKey: nameKey + "_legacy_" + String(clash.id).slice(-6),
            },
          }
        );
      }
      await teams().updateOne(
        { id: t.id },
        {
          $set: {
            name: t.name,
            nameKey,
            sigil: t.sigil,
            seeded: true,
            registration: true,
          },
          $setOnInsert: {
            id: t.id,
            createdAt: Date.now(),
            founderId: null,
          },
        },
        { upsert: true }
      );
    }
  },

  isRegistrationTeamId(teamId) {
    return REGISTRATION_TEAM_IDS.includes(String(teamId || ""));
  },

  async resolveRegistrationTeam(teamId) {
    await this.seedTeams();
    const id = String(teamId || "").trim();
    if (!this.isRegistrationTeamId(id)) return null;
    return this.findTeam(id);
  },

  /* Fallback only — signup should always send an explicit teamId */
  async defaultTeamId() {
    await this.seedTeams();
    return REGISTRATION_TEAM_IDS[0];
  },

  async markStorySeen(userId) {
    if (!userId) return null;
    await users().updateOne(
      { id: userId },
      { $set: { storySeenAt: Date.now() } }
    );
    return this.findUserById(userId);
  },

  async markRoomIntroSeen(userId, roomId) {
    if (!userId || !roomId) return null;
    await users().updateOne(
      { id: userId },
      {
        $addToSet: { roomIntrosSeen: roomId },
        $set: { ["roomIntroAt." + roomId]: Date.now() },
      }
    );
    return this.findUserById(userId);
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
    return teams()
      .find({ id: { $in: REGISTRATION_TEAM_IDS } }, { projection: { _id: 0 } })
      .sort({ name: 1 })
      .toArray();
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

  async addSolve({ userId, challengeId, points: award }) {
    const user = await this.findUserById(userId);
    if (!user) {
      const err = new Error("Chair gone cold.");
      err.status = 401;
      throw err;
    }

    const row = {
      id: "solve_" + randomUUID().replace(/-/g, "").slice(0, 12),
      userId,
      challengeId,
      points: award,
      at: Date.now(),
    };
    await solves().insertOne(row);

    const balanceBefore = user.score || 0;
    const balanceAfter = balanceBefore + award;
    await users().updateOne(
      { id: userId },
      {
        $set: { score: balanceAfter },
        $inc: { solvedCount: 1, pointsEarned: award },
      }
    );
    await this.recordPoint({
      userId,
      teamId: user.teamId || null,
      kind: "solve",
      challengeId,
      delta: award,
      balanceBefore,
      balanceAfter,
      note: "Flag claimed",
    });
    await this.advanceProgress(userId, challengeId);
    return row;
  },

  /**
   * Immutable ledger of every score change (+solve / −hint).
   * Unique per user+kind+challenge so solve/hint each log once.
   */
  async recordPoint({ userId, teamId, kind, challengeId, delta, balanceBefore, balanceAfter, note }) {
    const entry = {
      id: "pt_" + randomUUID().replace(/-/g, "").slice(0, 12),
      userId,
      teamId: teamId || null,
      kind,
      challengeId: challengeId || null,
      delta,
      balanceBefore: balanceBefore != null ? balanceBefore : null,
      balanceAfter: balanceAfter != null ? balanceAfter : null,
      note: note || null,
      at: Date.now(),
    };
    try {
      await points().insertOne(entry);
    } catch (err) {
      if (err && err.code === 11000) return null;
      throw err;
    }
    return entry;
  },

  async listPointsForUser(userId, limit) {
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return points()
      .find({ userId }, { projection: { _id: 0 } })
      .sort({ at: -1 })
      .limit(lim)
      .toArray();
  },

  async pointTotals(userId) {
    const rows = await points()
      .aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            earned: {
              $sum: { $cond: [{ $gt: ["$delta", 0] }, "$delta", 0] },
            },
            spent: {
              $sum: { $cond: [{ $lt: ["$delta", 0] }, { $abs: "$delta" }, 0] },
            },
            entries: { $sum: 1 },
          },
        },
      ])
      .toArray();
    const row = rows[0] || { earned: 0, spent: 0, entries: 0 };
    return { earned: row.earned || 0, spent: row.spent || 0, entries: row.entries || 0 };
  },

  /* One-time: copy existing solves/hints into the points ledger if missing */
  async backfillPointsLedger() {
    const existing = await points().countDocuments();
    if (existing > 0) return { skipped: true };

    const [allSolves, allHints, allUsers] = await Promise.all([
      solves().find({}, { projection: { _id: 0 } }).toArray(),
      hints().find({}, { projection: { _id: 0 } }).toArray(),
      users().find({}, { projection: { _id: 0, id: 1, teamId: 1 } }).toArray(),
    ]);
    const teamByUser = new Map(allUsers.map((u) => [u.id, u.teamId || null]));
    const docs = [];

    for (const s of allSolves) {
      docs.push({
        id: "pt_" + randomUUID().replace(/-/g, "").slice(0, 12),
        userId: s.userId,
        teamId: teamByUser.get(s.userId) || null,
        kind: "solve",
        challengeId: s.challengeId,
        delta: s.points || 0,
        balanceBefore: null,
        balanceAfter: null,
        note: "Flag claimed (backfill)",
        at: s.at || Date.now(),
      });
    }
    for (const h of allHints) {
      const spent = h.deducted != null ? h.deducted : h.cost || 0;
      docs.push({
        id: "pt_" + randomUUID().replace(/-/g, "").slice(0, 12),
        userId: h.userId,
        teamId: teamByUser.get(h.userId) || null,
        kind: "hint",
        challengeId: h.challengeId,
        delta: -Math.abs(spent),
        balanceBefore: null,
        balanceAfter: null,
        note: "Hint unlocked (backfill)",
        at: h.at || Date.now(),
      });
    }
    if (docs.length) await points().insertMany(docs, { ordered: false }).catch(() => {});
    return { skipped: false, inserted: docs.length };
  },

  /* Remember which trial the medium last opened (survives logout/relogin) */
  async setLastChallenge(userId, challengeId) {
    if (!userId || !challengeId) return null;
    const { findChallenge } = require("./challenges");
    const c = findChallenge(challengeId);
    const patch = { lastChallengeId: challengeId, lastChallengeAt: Date.now() };
    if (c && c.roomId) patch.lastRoomId = c.roomId;
    await users().updateOne({ id: userId }, { $set: patch });
    return this.findUserById(userId);
  },

  async setLastRoom(userId, roomId) {
    if (!userId || !roomId) return null;
    await users().updateOne(
      { id: userId },
      { $set: { lastRoomId: roomId, lastRoomAt: Date.now() } }
    );
    return this.findUserById(userId);
  },

  /* After a solve, park on the next unsolved trial (prefer same room) */
  async advanceProgress(userId, justSolvedId) {
    const { nextChallengeAfter } = require("./challenges");
    const userSolves = await this.listSolvesForUser(userId);
    const done = new Set(userSolves.map((s) => s.challengeId));
    if (justSolvedId) done.add(justSolvedId);
    const next = nextChallengeAfter(justSolvedId, done);
    const lastChallengeId = next ? next.id : justSolvedId || null;
    if (!lastChallengeId) return null;
    return this.setLastChallenge(userId, lastChallengeId);
  },

  resumePath(user) {
    if (user && user.lastRoomId) {
      return "room.html#" + user.lastRoomId;
    }
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

    const balanceBefore = user.score || 0;
    const deducted = Math.min(cost, Math.max(0, balanceBefore));
    const balanceAfter = Math.max(0, balanceBefore - cost);

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
        $set: { score: balanceAfter },
        $inc: { hintsUsed: 1, hintPointsSpent: deducted, pointsSpent: deducted },
      }
    );

    if (deducted > 0 || cost > 0) {
      await this.recordPoint({
        userId,
        teamId: user.teamId || null,
        kind: "hint",
        challengeId,
        delta: -deducted,
        balanceBefore,
        balanceAfter,
        note: "Hint unlocked (−" + cost + " listed)",
      });
    }

    return { alreadyUnlocked: false, cost, deducted, score: balanceAfter };
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
    const [team, userSolves, hintIds, teamProg, totals, recentPoints] = await Promise.all([
      this.findTeam(user.teamId),
      this.listSolvesForUser(user.id),
      this.listHintIdsForUser(user.id),
      this.teamProgress(user.teamId),
      this.pointTotals(user.id),
      this.listPointsForUser(user.id, 12),
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
      hintPointsSpent: user.hintPointsSpent || totals.spent || 0,
      unlockedHints: hintIds,
      pointsEarned: user.pointsEarned != null ? user.pointsEarned : totals.earned,
      pointsSpent: user.pointsSpent != null ? user.pointsSpent : totals.spent,
      pointLedger: recentPoints,
      loginCount: user.loginCount || 0,
      lastLoginAt: user.lastLoginAt || null,
      lastChallengeId: user.lastChallengeId || null,
      lastChallengeAt: user.lastChallengeAt || null,
      lastRoomId: user.lastRoomId || null,
      lastRoomAt: user.lastRoomAt || null,
      storySeen: !!user.storySeenAt,
      storySeenAt: user.storySeenAt || null,
      roomIntrosSeen: Array.isArray(user.roomIntrosSeen) ? user.roomIntrosSeen : [],
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
