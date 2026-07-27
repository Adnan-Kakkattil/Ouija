"use strict";

const express = require("express");
const store = require("../lib/store");
const { challenges, publicChallenge, findChallenge } = require("../lib/challenges");
const { requireAuth } = require("./auth");

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  const user = store.publicUser(req.user);
  const solved = user.solved || [];
  res.json({
    ok: true,
    challenges: challenges.map((c) => publicChallenge(c, solved)),
  });
});

/* Specific challenge helpers before /:id */
router.get("/photo-1/artifact", requireAuth, (_req, res) => {
  res.json({
    ok: true,
    plate: "Blackmoor Sitting No. 9",
    emulsion: "silver gelatin",
    description: "ouija{exif_of_the_dead}",
    note: "Do not hang this plate in sunlight.",
  });
});

router.post("/ecto-1/channel", requireAuth, (req, res) => {
  const message = String((req.body && req.body.message) || "");
  if (message.length > 64) {
    return res.json({
      ok: true,
      overflow: true,
      leak: "ouija{buffer_overflow_of_souls}",
      echo: message.slice(0, 64) + "…[ECTOPLASM]",
    });
  }
  res.json({ ok: true, overflow: false, echo: message });
});

router.get("/:id", requireAuth, (req, res) => {
  const c = findChallenge(req.params.id);
  if (!c) return res.status(404).json({ ok: false, message: "That trial has dissolved." });
  const user = store.publicUser(req.user);
  res.json({ ok: true, challenge: publicChallenge(c, user.solved || []) });
});

router.post("/:id/submit", requireAuth, (req, res) => {
  const c = findChallenge(req.params.id);
  if (!c) return res.status(404).json({ ok: false, message: "That trial has dissolved." });

  const flag = String(req.body.flag || "").trim();
  if (!flag) return res.status(400).json({ ok: false, message: "Offer a flag." });

  const users = store.listUsers();
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(401).json({ ok: false, message: "Chair gone cold." });

  const solves = store.listSolves();
  if (solves.some((s) => s.userId === user.id && s.challengeId === c.id)) {
    return res.json({ ok: true, alreadySolved: true, message: "This flag is already claimed by your circle." });
  }

  if (flag !== c.correctFlag) {
    return res.status(400).json({ ok: false, message: "The spirits reject that offering." });
  }

  solves.push({
    id: "solve_" + Date.now(),
    userId: user.id,
    challengeId: c.id,
    points: c.points,
    at: Date.now(),
  });
  store.saveSolves(solves);

  user.score = (user.score || 0) + c.points;
  user.solvedCount = (user.solvedCount || 0) + 1;
  store.saveUsers(users);

  res.json({
    ok: true,
    message: "The board accepts your offering.",
    points: c.points,
    user: store.publicUser(user),
  });
});

module.exports = router;
