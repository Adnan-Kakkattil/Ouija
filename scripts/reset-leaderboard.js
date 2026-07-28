"use strict";

/**
 * One-shot: wipe CTF progress so the public team leaderboard starts at zero.
 * Keeps accounts and teams. Clears solves, hints, points, and per-user scores.
 *
 * Usage: node scripts/reset-leaderboard.js
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { connect, getDb, close } = require("../src/lib/db");

async function main() {
  await connect();
  const db = getDb();
  const users = db.collection("users");
  const solves = db.collection("solves");
  const hints = db.collection("hints");
  const points = db.collection("points");

  const before = {
    users: await users.countDocuments(),
    solves: await solves.countDocuments(),
    hints: await hints.countDocuments(),
    points: await points.countDocuments(),
  };

  const delSolves = await solves.deleteMany({});
  const delHints = await hints.deleteMany({});
  const delPoints = await points.deleteMany({});
  const resetUsers = await users.updateMany(
    {},
    {
      $set: {
        score: 0,
        solvedCount: 0,
        pointsEarned: 0,
        pointsSpent: 0,
        hintsUsed: 0,
        hintPointsSpent: 0,
        lastChallengeId: null,
        lastChallengeAt: null,
        lastRoomId: null,
        lastRoomAt: null,
        roomIntrosSeen: [],
        storySeenAt: null,
      },
    }
  );

  const afterScores = await users
    .aggregate([{ $group: { _id: null, score: { $sum: { $ifNull: ["$score", 0] } } } }])
    .toArray();

  console.log(
    JSON.stringify(
      {
        ok: true,
        before,
        deleted: {
          solves: delSolves.deletedCount,
          hints: delHints.deletedCount,
          points: delPoints.deletedCount,
        },
        usersReset: resetUsers.modifiedCount,
        scoreSumAfter: (afterScores[0] && afterScores[0].score) || 0,
      },
      null,
      2
    )
  );

  await close();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await close();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
