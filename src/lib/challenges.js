"use strict";

/**
 * Challenge catalogue for OUIJA CTF.
 * Flags are checked server-side only — never send correctFlag to the client.
 *
 * Rooms gate mansion exploration. Room N unlocks when Room N-1 is fully cleared
 * (Room 1 unlocks after the burned-paper key / whisper-1).
 */

const rooms = [
  {
    id: "room-1",
    number: 1,
    title: "The First Chamber",
    lede: "Dust, moonlight, and eight objects that remember Olivia.",
    pointsPerChallenge: 100,
    challengeIds: ["room1-1", "room1-2", "room1-3", "room1-4", "room1-5", "room1-6"],
  },
  {
    id: "room-2",
    number: 2,
    title: "The Second Chamber",
    lede: "Deeper into the house. The air grows colder.",
    pointsPerChallenge: 200,
    challengeIds: [],
    sealed: true,
  },
  {
    id: "room-3",
    number: 3,
    title: "The Third Chamber",
    lede: "The basement she feared. Not yet opened.",
    pointsPerChallenge: 300,
    challengeIds: [],
    sealed: true,
  },
];

const challenges = [
  {
    id: "whisper-1",
    category: "web",
    trial: "The Whispering Wall",
    roman: "I",
    title: "Burned Paper",
    points: 100,
    difficulty: "easy",
    description:
      "After the story, the house showed you a burned leaf. The key is written in the ash — offer it to open the first door.",
    hint: null,
    noHint: true,
    correctFlag: "intothevictorianmansion",
  },
  {
    id: "room1-1",
    roomId: "room-1",
    category: "crypto",
    trial: "Room I · The First Chamber",
    roman: "I",
    title: "Torn Diary Page",
    points: 100,
    difficulty: "easy",
    description:
      "An old diary page is found under a rocking chair. Download Olivia’s paper, read what she left behind, and recover the hidden flag.",
    hint: "The alphabet has shifted...",
    correctFlag: "flag{her_name_was_olivia}",
    artifactUrl: "assets/files/ooo.html",
    artifactLabel: "Download the diary paper",
  },
  {
    id: "room1-2",
    roomId: "room-1",
    category: "crypto",
    trial: "Room I · The First Chamber",
    roman: "I",
    title: "Hidden Prayer",
    points: 100,
    difficulty: "easy",
    description:
      "A prayer written on the wall using strange symbols. Download the wall inscription and recover what it conceals.",
    hint: "Everything has an opposite.",
    correctFlag: "flag{she_feared_the_basement}",
    artifactUrl: "assets/files/oooi.html",
    artifactLabel: "Download the prayer wall",
  },
  {
    id: "room1-3",
    roomId: "room-1",
    category: "forensics",
    trial: "Room I · The First Chamber",
    roman: "I",
    title: "Locked Wooden Box",
    points: 100,
    difficulty: "easy",
    description:
      "A small wooden box with an old ZIP archive inside. Crack the easy ZIP password and recover what was sealed away.",
    hint: "Old boxes keep weak locks. Try a short, common passphrase.",
    correctFlag: "flag{first_victim_found}",
    artifactUrl: "assets/files/evidence.zip",
    artifactLabel: "Download the locked archive",
  },
  {
    id: "room1-4",
    roomId: "room-1",
    category: "forensics",
    trial: "Room I · The First Chamber",
    roman: "I",
    title: "Family Portrait",
    points: 100,
    difficulty: "medium",
    description:
      "A family photograph hanging crooked on the wall. Something is hidden inside the image — recover the concealed text.",
    hint: "Not everything in a photograph is meant to be seen. Look beneath the emulsion.",
    correctFlag: "flag{mother_left_me}",
    artifactUrl: "assets/files/family.png",
    artifactLabel: "Download the family portrait",
  },
  {
    id: "room1-5",
    roomId: "room-1",
    category: "crypto",
    trial: "Room I · The First Chamber",
    roman: "I",
    title: "Ghost's Journal",
    points: 100,
    difficulty: "easy",
    description:
      "A journal on the nightstand is sealed with an old clasp. The lock is not a word you can read — only this MD5 digest: `158cbad378bdf31d6ec670161a7b6fbf`. Crack the hash, open the archive, and read what the ghost wrote.",
    hint: "MD5 of a short English word. A common wordlist will do.",
    correctFlag: "flag{the_ghost_is_trapped}",
    artifactUrl: "assets/files/ghost-journal.zip",
    artifactLabel: "Download the sealed journal",
  },
  {
    id: "room1-6",
    roomId: "room-1",
    category: "forensics",
    trial: "Room I · The First Chamber",
    roman: "I",
    title: "Haunted Music Box",
    points: 100,
    difficulty: "medium",
    description:
      "An old music box still turns on the dresser. Download the recording — the melody is not all it carries. Recover the whisper buried in the audio.",
    hint: "The tune is a distraction. Read the least significant bit of each sample.",
    correctFlag: "flag{listen_to_the_whispers}",
    artifactUrl: "assets/files/haunted-musicbox.wav",
    artifactLabel: "Download the music box recording",
  },
  {
    id: "whisper-2",
    category: "web",
    trial: "The Whispering Wall",
    roman: "I",
    title: "Cookie Crumbs",
    points: 200,
    difficulty: "easy",
    description:
      "After you sit at the table, your browser keeps a token. Inspect cookies carefully — one of them is not what it claims.",
    hint: "Check DevTools → Application → Cookies for a spirit-marked crumb.",
    correctFlag: "ouija{session_of_the_living}",
  },
  {
    id: "cipher-1",
    category: "crypto",
    trial: "Cipher of the Silent Choir",
    roman: "II",
    title: "Thirteen Vowels",
    points: 150,
    difficulty: "easy",
    description:
      "A nun left this cipher on the board: `rxlmd{fdhvdu_vkliw_yl}`. She always shifted by three.",
    hint: "Caesar cipher, shift 3 (each letter +3).",
    correctFlag: "ouija{caesar_shift_vi}",
  },
  {
    id: "cipher-2",
    category: "crypto",
    trial: "Cipher of the Silent Choir",
    roman: "II",
    title: "Base of the Veil",
    points: 250,
    difficulty: "medium",
    description:
      "The planchette traced: `b3VpamF7YmFzZTY0X2lzX25vdF9lbmNyeXB0aW9ufQ==`",
    hint: "Decode Base64.",
    correctFlag: "ouija{base64_is_not_encryption}",
  },
  {
    id: "photo-1",
    category: "forensics",
    trial: "Photographs of the Deceased",
    roman: "III",
    title: "Behind the Emulsion",
    points: 100,
    difficulty: "easy",
    description:
      "A faded plate is stored at `/api/challenges/photo-1/artifact`. Fetch it and read the metadata — something is written in the Description field.",
    hint: "GET the artifact endpoint and inspect the JSON description.",
    correctFlag: "ouija{exif_of_the_dead}",
  },
  {
    id: "grain-1",
    category: "reversing",
    trial: "The Planchette's Grain",
    roman: "IV",
    title: "Carved Backwards",
    points: 200,
    difficulty: "medium",
    description:
      "Someone carved `}niarG_eht_ni_deirub{aijuo` into the underside of the planchette.",
    hint: "Reverse the string.",
    correctFlag: "ouija{buried_in_the_Grain}",
  },
  {
    id: "ecto-1",
    category: "pwn",
    trial: "Ectoplasm",
    roman: "V",
    title: "Leak in the Medium",
    points: 250,
    difficulty: "medium",
    description:
      "POST a JSON body `{ \"message\": \"...\" }` to `/api/challenges/ecto-1/channel`. Messages longer than 64 characters spill past the buffer — watch the response.",
    hint: "Send a message longer than 64 characters.",
    correctFlag: "ouija{buffer_overflow_of_souls}",
  },
  {
    id: "unnamed-1",
    category: "misc",
    trial: "Do Not Say Its Name",
    roman: "VI",
    title: "The Unspoken",
    points: 300,
    difficulty: "hard",
    description:
      "Ask the board on the dashboard to spell GOODBYE three times in a row within one minute, then submit whatever it leaves in the transmission slate — formatted as a flag.",
    hint: "The dashboard board remembers. Watch the slate after three goodbyes.",
    correctFlag: "ouija{never_leave_the_board_open}",
  },
];

function hintCost(difficulty) {
  const d = String(difficulty || "easy").toLowerCase();
  if (d === "hard") return 30;
  if (d === "medium") return 20;
  return 10;
}

function findChallenge(id) {
  return challenges.find((c) => c.id === id) || null;
}

function findRoom(id) {
  return rooms.find((r) => r.id === id || String(r.number) === String(id)) || null;
}

function challengesForRoom(roomId) {
  const room = findRoom(roomId);
  if (!room) return [];
  return room.challengeIds.map((id) => findChallenge(id)).filter(Boolean);
}

function roomComplete(room, solvedSet) {
  if (!room || !room.challengeIds.length) return false;
  return room.challengeIds.every((id) => solvedSet.has(id));
}

function isRoomUnlocked(room, solvedIds) {
  const solved = new Set(solvedIds || []);
  if (!room) return false;
  if (room.sealed && (!room.challengeIds || !room.challengeIds.length)) return false;
  if (room.number === 1) return solved.has("whisper-1");
  const prev = rooms.find((r) => r.number === room.number - 1);
  if (!prev) return false;
  return roomComplete(prev, solved);
}

function publicChallenge(c, solvedIds, unlockedHintIds) {
  const unlocked = Array.isArray(unlockedHintIds) && unlockedHintIds.includes(c.id);
  const cost = hintCost(c.difficulty);
  const noHint = !!c.noHint;
  return {
    id: c.id,
    roomId: c.roomId || null,
    category: c.category,
    trial: c.trial,
    roman: c.roman,
    title: c.title,
    points: c.points,
    difficulty: c.difficulty,
    description: c.description,
    noHint,
    hintCost: noHint ? 0 : cost,
    hintUnlocked: noHint ? false : unlocked,
    hint: noHint ? null : unlocked ? c.hint : null,
    solved: (solvedIds || []).includes(c.id),
    artifactUrl: c.artifactUrl || null,
    artifactLabel: c.artifactLabel || null,
  };
}

function publicRoom(room, solvedIds, lastChallengeId, lastRoomId) {
  const solved = new Set(solvedIds || []);
  const list = challengesForRoom(room.id);
  const solvedCount = list.filter((c) => solved.has(c.id)).length;
  const total = list.length;
  const unlocked = isRoomUnlocked(room, solvedIds);
  const complete = roomComplete(room, solved);
  const firstUnsolved = list.find((c) => !solved.has(c.id));
  const resume =
    lastChallengeId && list.some((c) => c.id === lastChallengeId) ? lastChallengeId : null;

  let status = "locked";
  let action = "locked";
  if (room.sealed && !total) {
    status = "sealed";
    action = "sealed";
  } else if (!unlocked) {
    status = "locked";
    action = "locked";
  } else if (complete) {
    status = "cleared";
    action = "restart";
  } else if (solvedCount > 0 || resume) {
    status = "in_progress";
    action = "continue";
  } else {
    status = "open";
    action = "start";
  }

  return {
    id: room.id,
    number: room.number,
    title: room.title,
    lede: room.lede,
    pointsPerChallenge: room.pointsPerChallenge,
    totalChallenges: total,
    solvedChallenges: solvedCount,
    totalPoints: total * room.pointsPerChallenge,
    earnedPoints: solvedCount * room.pointsPerChallenge,
    unlocked,
    complete,
    sealed: !!(room.sealed && !total),
    status,
    action,
    isCurrent: lastRoomId === room.id || (!!resume && list.some((c) => c.id === resume)),
    nextChallengeId: firstUnsolved ? firstUnsolved.id : list[0] ? list[0].id : null,
    resumeChallengeId: resume && !solved.has(resume) ? resume : firstUnsolved ? firstUnsolved.id : null,
    href: "room.html#" + room.id,
  };
}

function roomsForUser(solvedIds, lastChallengeId, lastRoomId) {
  return rooms.map((r) => publicRoom(r, solvedIds, lastChallengeId, lastRoomId));
}

function nextChallengeAfter(justSolvedId, solvedSet) {
  const done = solvedSet instanceof Set ? solvedSet : new Set(solvedSet || []);
  if (justSolvedId) done.add(justSolvedId);

  const current = findChallenge(justSolvedId);
  if (current && current.roomId) {
    const room = findRoom(current.roomId);
    if (room) {
      for (const id of room.challengeIds) {
        if (!done.has(id)) return findChallenge(id);
      }
      const nextRoom = rooms.find((r) => r.number === room.number + 1);
      if (nextRoom && isRoomUnlocked(nextRoom, [...done]) && nextRoom.challengeIds[0]) {
        return findChallenge(nextRoom.challengeIds[0]);
      }
    }
  }

  return challenges.find((c) => !done.has(c.id)) || null;
}

function trialSummary(list) {
  const map = new Map();
  for (const c of list) {
    if (!map.has(c.trial)) {
      map.set(c.trial, {
        trial: c.trial,
        roman: c.roman,
        category: c.category,
        flags: 0,
        minPoints: c.points,
        maxPoints: c.points,
      });
    }
    const row = map.get(c.trial);
    row.flags += 1;
    row.minPoints = Math.min(row.minPoints, c.points);
    row.maxPoints = Math.max(row.maxPoints, c.points);
  }
  return [...map.values()];
}

module.exports = {
  challenges,
  rooms,
  publicChallenge,
  publicRoom,
  roomsForUser,
  findChallenge,
  findRoom,
  challengesForRoom,
  isRoomUnlocked,
  roomComplete,
  nextChallengeAfter,
  trialSummary,
  hintCost,
};
