"use strict";

const http = require("http");

function req(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        hostname: "localhost",
        port: 3000,
        path,
        method,
        headers: {
          Accept: "application/json",
          ...(data
            ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
            : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            body: raw,
            cookies: res.headers["set-cookie"] || [],
          })
        );
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

function cookie(set) {
  for (const line of set || []) {
    if (line.startsWith("ouija.sid=")) return line.split(";")[0];
  }
  return "";
}

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("OK:", msg);
}

(async () => {
  const stamp = Date.now().toString(36);
  const signup = await req("POST", "/api/auth/signup", {
    username: "rooms_" + stamp,
    password: "x",
    teamId: "team_1",
    agree: true,
  });
  assert(signup.status === 201, "signup");
  const ck = cookie(signup.cookies);
  assert(!!ck, "session");

  let rooms = JSON.parse((await req("GET", "/api/rooms", null, ck)).body).rooms;
  assert(rooms.length === 3, "3 rooms");
  assert(rooms[0].status === "locked", "room1 locked before key");
  assert(rooms[1].unlocked === false, "room2 locked before room1 progress");
  assert(rooms[2].unlocked === false, "room3 locked before room2 progress");

  await req("POST", "/api/challenges/whisper-1/submit", { flag: "intothevictorianmansion" }, ck);
  rooms = JSON.parse((await req("GET", "/api/rooms", null, ck)).body).rooms;
  assert(rooms[0].unlocked === true, "room1 unlocked after key");
  assert(rooms[1].unlocked === false, "room2 still locked after key only");

  const locked = await req("GET", "/api/rooms/room-2", null, ck);
  assert(locked.status === 403, "room2 api forbidden before 3 solves");

  const r1 = await req("GET", "/api/rooms/room-1", null, ck);
  assert(r1.status === 200, "room1 open");
  assert(JSON.parse(r1.body).challenges.length === 8, "room1 has 8 challenges");

  await req("POST", "/api/challenges/room1-1/submit", { flag: "flag{her_name_was_olivia}" }, ck);
  await req("POST", "/api/challenges/room1-2/submit", { flag: "flag{she_feared_the_basement}" }, ck);
  rooms = JSON.parse((await req("GET", "/api/rooms", null, ck)).body).rooms;
  assert(rooms[1].unlocked === false, "room2 locked after only 2 room1 flags");
  assert((await req("GET", "/api/rooms/room-2", null, ck)).status === 403, "room2 still 403 after 2");

  await req("POST", "/api/challenges/room1-3/submit", { flag: "flag{first_victim_found}" }, ck);
  rooms = JSON.parse((await req("GET", "/api/rooms", null, ck)).body).rooms;
  assert(rooms[0].solvedChallenges === 3, "room1 shows 3 personal solves");
  assert(rooms[0].complete === false, "room1 not fully cleared yet");
  assert(rooms[1].unlocked === true, "room2 unlocked after 3 room1 flags");
  assert(rooms[0].nextRoomHref === "room.html#room-2", "room1 offers move to room2");

  const r2 = await req("GET", "/api/rooms/room-2", null, ck);
  assert(r2.status === 200, "room2 open after 3 room1 solves");
  assert(JSON.parse(r2.body).challenges.length === 5, "room2 lists 5");

  /* Teammate share: second user on same team inherits room2 unlock without personal room1 solves */
  const mate = await req("POST", "/api/auth/signup", {
    username: "mate_" + stamp,
    password: "x",
    teamId: "team_1",
    agree: true,
  });
  assert(mate.status === 201, "teammate signup");
  const ck2 = cookie(mate.cookies);
  await req("POST", "/api/challenges/whisper-1/submit", { flag: "intothevictorianmansion" }, ck2);
  const mateRooms = JSON.parse((await req("GET", "/api/rooms", null, ck2)).body).rooms;
  assert(mateRooms[1].unlocked === true, "teammate gets room2 from shared team solves");
  assert((await req("GET", "/api/rooms/room-2", null, ck2)).status === 200, "teammate can open room2");

  await req("POST", "/api/challenges/room2-1/submit", { flag: "ouija{olivia_investigated}" }, ck);
  await req("POST", "/api/challenges/room2-2/submit", { flag: "flag{she_found_evidence}" }, ck);
  rooms = JSON.parse((await req("GET", "/api/rooms", null, ck)).body).rooms;
  assert(rooms[2].unlocked === false, "room3 locked after only 2 room2 flags");

  await req("POST", "/api/challenges/room2-3/submit", { flag: "flag{footsteps_at_midnight}" }, ck);
  rooms = JSON.parse((await req("GET", "/api/rooms", null, ck)).body).rooms;
  assert(rooms[2].unlocked === true, "room3 unlocked after 3 room2 flags");

  const r3 = await req("GET", "/api/rooms/room-3", null, ck);
  assert(r3.status === 200, "room3 open");
  const r3body = JSON.parse(r3.body);
  assert(r3body.needsRoomKey === true || (r3body.challenges && r3body.challenges.length === 0), "room3 waits for basement key");

  await req("POST", "/api/challenges/basement-key/submit", { flag: "FORGOTTEN" }, ck);
  const r3b = JSON.parse((await req("GET", "/api/rooms/room-3", null, ck)).body);
  assert(r3b.needsRoomKey === false, "basement key accepted");
  assert(r3b.challenges.length === 1, "room3 lists challenges after key");

  console.log("SMOKE PASS");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
