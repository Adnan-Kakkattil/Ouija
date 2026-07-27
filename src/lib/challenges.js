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
    title: "Servant's Entrance",
    points: 100,
    difficulty: "easy",
    description:
      "The house has a servant's door that was never locked. Look at the page source of the landing séance — something stencilled in the comments still listens.",
    hint: "View the HTML of the home page. The dead leave notes in <!-- comments -->.",
    correctFlag: "ouija{first_knock_answered}",
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

function publicChallenge(c, solvedIds) {
  return {
    id: c.id,
    category: c.category,
    trial: c.trial,
    roman: c.roman,
    title: c.title,
    points: c.points,
    difficulty: c.difficulty,
    description: c.description,
    hint: c.hint,
    solved: solvedIds.includes(c.id),
  };
}

function findChallenge(id) {
  return challenges.find((c) => c.id === id) || null;
}

module.exports = { challenges, publicChallenge, findChallenge };
