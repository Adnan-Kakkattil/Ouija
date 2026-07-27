"use strict";

const express = require("express");
const store = require("../lib/store");
const {
  findRoom,
  roomsForUser,
  challengesForRoom,
  publicChallenge,
  isRoomUnlocked,
} = require("../lib/challenges");
const { requireAuth } = require("./auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const user = await store.publicUser(req.user);
    const rooms = roomsForUser(user.solved || [], user.lastChallengeId, user.lastRoomId);
    res.json({ ok: true, rooms, user });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const room = findRoom(req.params.id);
    if (!room) return res.status(404).json({ ok: false, message: "That chamber does not answer." });

    const user = await store.publicUser(req.user);
    const unlocked = isRoomUnlocked(room, user.solved || []);
    if (!unlocked) {
      return res.status(403).json({
        ok: false,
        message:
          room.number === 1
            ? "Offer the burned-paper key before entering the first chamber."
            : "Clear the previous chamber before this door will open.",
      });
    }

    await store.setLastRoom(req.user.id, room.id);
    const fresh = await store.publicUser(await store.findUserById(req.user.id));
    const rooms = roomsForUser(fresh.solved || [], fresh.lastChallengeId, fresh.lastRoomId);
    const summary = rooms.find((r) => r.id === room.id);
    const challenges = challengesForRoom(room.id).map((c) =>
      publicChallenge(c, fresh.solved || [], fresh.unlockedHints || [])
    );

    res.json({
      ok: true,
      room: summary,
      challenges,
      user: fresh,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/intro", requireAuth, async (req, res, next) => {
  try {
    const room = findRoom(req.params.id);
    if (!room) return res.status(404).json({ ok: false, message: "That chamber does not answer." });

    const user = await store.publicUser(req.user);
    if (!isRoomUnlocked(room, user.solved || [])) {
      return res.status(403).json({ ok: false, message: "That door is still sealed." });
    }

    await store.markRoomIntroSeen(req.user.id, room.id);
    await store.setLastRoom(req.user.id, room.id);
    const fresh = await store.publicUser(await store.findUserById(req.user.id));
    res.json({ ok: true, roomId: room.id, user: fresh });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/focus", requireAuth, async (req, res, next) => {
  try {
    const room = findRoom(req.params.id);
    if (!room) return res.status(404).json({ ok: false, message: "That chamber does not answer." });

    const user = await store.publicUser(req.user);
    if (!isRoomUnlocked(room, user.solved || [])) {
      return res.status(403).json({ ok: false, message: "That door is still sealed." });
    }

    await store.setLastRoom(req.user.id, room.id);
    const mode = String((req.body && req.body.mode) || "continue");
    const rooms = roomsForUser(user.solved || [], user.lastChallengeId, room.id);
    const summary = rooms.find((r) => r.id === room.id);
    let focusId = null;
    if (mode === "start" || mode === "restart") {
      focusId = room.challengeIds[0] || null;
    } else {
      focusId = summary.resumeChallengeId || summary.nextChallengeId || room.challengeIds[0] || null;
    }
    if (focusId) await store.setLastChallenge(req.user.id, focusId);

    const fresh = await store.publicUser(await store.findUserById(req.user.id));
    res.json({
      ok: true,
      roomId: room.id,
      focusChallengeId: focusId,
      user: fresh,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
