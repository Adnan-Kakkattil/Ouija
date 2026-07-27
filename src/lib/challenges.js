"use strict";

/**
 * Challenge catalogue for OUIJA CTF.
 * Flags are checked server-side only — never send correctFlag to the client.
 */
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
    category: "crypto",
    trial: "Room I · The First Chamber",
    roman: "I",
    title: "Torn Diary Page",
    points: 150,
    difficulty: "easy",
    description:
      "An old diary page is found under a rocking chair. Download Olivia’s paper, read what she left behind, and recover the hidden flag. Caesar Cipher.",
    hint: "The alphabet has shifted...",
    correctFlag: "flag{her_name_was_olivia}",
    artifactUrl: "assets/files/ooo.html",
    artifactLabel: "Download the diary paper",
  },
  {
    id: "room1-2",
    category: "crypto",
    trial: "Room I · The First Chamber",
    roman: "I",
    title: "Hidden Prayer",
    points: 150,
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
    category: "forensics",
    trial: "Room I · The First Chamber",
    roman: "I",
    title: "Locked Wooden Box",
    points: 200,
    difficulty: "easy",
    description:
      "A small wooden box with an old ZIP archive inside. Crack the easy ZIP password and recover what was sealed away.",
    hint: "Old boxes keep weak locks. Try a short, common passphrase.",
    correctFlag: "flag{first_victim_found}",
    artifactUrl: "assets/files/evidence.zip",
    artifactLabel: "Download the locked archive",
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

function publicChallenge(c, solvedIds, unlockedHintIds) {
  const unlocked = Array.isArray(unlockedHintIds) && unlockedHintIds.includes(c.id);
  const cost = hintCost(c.difficulty);
  const noHint = !!c.noHint;
  return {
    id: c.id,
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
    /* Hint text only after the medium pays — never for no-hint trials */
    hint: noHint ? null : unlocked ? c.hint : null,
    solved: (solvedIds || []).includes(c.id),
    artifactUrl: c.artifactUrl || null,
    artifactLabel: c.artifactLabel || null,
  };
}

function hintCost(difficulty) {
  const d = String(difficulty || "easy").toLowerCase();
  if (d === "hard") return 30;
  if (d === "medium") return 20;
  return 10; /* easy */
}

function findChallenge(id) {
  return challenges.find((c) => c.id === id) || null;
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

module.exports = { challenges, publicChallenge, findChallenge, trialSummary, hintCost };
