"use strict";

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const TEAMS_FILE = path.join(DATA_DIR, "teams.json");
const SOLVES_FILE = path.join(DATA_DIR, "solves.json");

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

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  ensureDir();
  try {
    if (!fs.existsSync(file)) {
      writeJson(file, fallback);
      return structuredClone(fallback);
    }
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return structuredClone(fallback);
  }
}

function writeJson(file, value) {
  ensureDir();
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

function seedTeams() {
  const teams = readJson(TEAMS_FILE, []);
  if (teams.length) return teams;
  const seeded = SEED_CIRCLES.map((c) => ({
    id: "circle_" + randomUUID().replace(/-/g, "").slice(0, 12),
    name: c.name,
    nameKey: c.name.trim().toLowerCase(),
    sigil: c.sigil,
    createdAt: Date.now(),
    founderId: null,
    seeded: true,
  }));
  writeJson(TEAMS_FILE, seeded);
  return seeded;
}

const store = {
  listUsers() {
    return readJson(USERS_FILE, []);
  },

  saveUsers(users) {
    writeJson(USERS_FILE, users);
  },

  findUserById(id) {
    return this.listUsers().find((u) => u.id === id) || null;
  },

  findUserByLogin(identifier) {
    const key = String(identifier || "").trim().toLowerCase();
    return (
      this.listUsers().find((u) => u.usernameKey === key || u.emailKey === key) || null
    );
  },

  listTeams() {
    return seedTeams();
  },

  saveTeams(teams) {
    writeJson(TEAMS_FILE, teams);
  },

  findTeam(id) {
    return this.listTeams().find((t) => t.id === id) || null;
  },

  createTeam(rawName, founderId) {
    const name = String(rawName || "").trim().replace(/\s+/g, " ");
    const nameKey = name.toLowerCase();
    const teams = this.listTeams();
    if (teams.some((t) => t.nameKey === nameKey)) {
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
    teams.push(team);
    this.saveTeams(teams);
    return team;
  },

  publicUser(user) {
    if (!user) return null;
    const team = this.findTeam(user.teamId);
    const solves = this.listSolves().filter((s) => s.userId === user.id);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      teamId: user.teamId,
      teamName: team ? team.name : "Unaffiliated",
      teamSigil: team ? team.sigil : "○",
      score: user.score || 0,
      solved: solves.map((s) => s.challengeId),
      createdAt: user.createdAt,
      role: user.role || "medium",
    };
  },

  listSolves() {
    return readJson(SOLVES_FILE, []);
  },

  saveSolves(solves) {
    writeJson(SOLVES_FILE, solves);
  },

  teamsWithCounts() {
    const users = this.listUsers();
    return this.listTeams()
      .map((t) => ({
        id: t.id,
        name: t.name,
        sigil: t.sigil,
        seeded: !!t.seeded,
        memberCount: users.filter((u) => u.teamId === t.id).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  leaderboard() {
    const users = this.listUsers();
    return this.listTeams()
      .map((t) => {
        const members = users.filter((u) => u.teamId === t.id);
        return {
          id: t.id,
          name: t.name,
          sigil: t.sigil,
          members: members.length,
          score: members.reduce((sum, u) => sum + (u.score || 0), 0),
          solved: members.reduce((sum, u) => sum + (u.solvedCount || 0), 0),
        };
      })
      .filter((t) => t.members > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  },
};

module.exports = store;
