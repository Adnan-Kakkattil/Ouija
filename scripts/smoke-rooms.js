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
    agree: true,
  });
  assert(signup.status === 201, "signup");
  const ck = cookie(signup.cookies);
  assert(!!ck, "session");

  let rooms = JSON.parse((await req("GET", "/api/rooms", null, ck)).body).rooms;
  assert(rooms.length === 3, "3 rooms");
  assert(rooms[0].status === "locked", "room1 locked before key");
  assert(rooms[1].status === "sealed" || rooms[1].status === "locked", "room2 locked");
  assert(rooms[2].status === "sealed" || rooms[2].status === "locked", "room3 locked");

  await req("POST", "/api/challenges/whisper-1/submit", { flag: "intothevictorianmansion" }, ck);
  rooms = JSON.parse((await req("GET", "/api/rooms", null, ck)).body).rooms;
  assert(rooms[0].unlocked === true, "room1 unlocked after key");
  assert(rooms[0].action === "start" || rooms[0].action === "continue", "room1 start/continue");
  assert(rooms[0].pointsPerChallenge === 100, "room1 100 pts");
  assert(rooms[1].unlocked === false, "room2 still locked");

  const locked = await req("GET", "/api/rooms/room-2", null, ck);
  assert(locked.status === 403, "room2 api forbidden");

  const r1 = await req("GET", "/api/rooms/room-1", null, ck);
  assert(r1.status === 200, "room1 open");
  const r1body = JSON.parse(r1.body);
  assert(r1body.challenges.length === 6, "room1 has 6 challenges");
  assert(r1body.challenges.every((c) => c.points === 100), "room1 challenges 100 pts");

  const focus = await req("POST", "/api/rooms/room-1/focus", { mode: "start" }, ck);
  assert(focus.status === 200, "focus start");
  assert(JSON.parse(focus.body).focusChallengeId === "room1-1", "starts at diary");

  await req("POST", "/api/challenges/room1-1/submit", { flag: "flag{her_name_was_olivia}" }, ck);
  await req("POST", "/api/challenges/room1-2/submit", { flag: "flag{she_feared_the_basement}" }, ck);
  await req("POST", "/api/challenges/room1-3/submit", { flag: "flag{first_victim_found}" }, ck);
  await req("POST", "/api/challenges/room1-4/submit", { flag: "flag{mother_left_me}" }, ck);
  await req("POST", "/api/challenges/room1-5/submit", { flag: "flag{the_ghost_is_trapped}" }, ck);
  await req("POST", "/api/challenges/room1-6/submit", { flag: "flag{listen_to_the_whispers}" }, ck);

  rooms = JSON.parse((await req("GET", "/api/rooms", null, ck)).body).rooms;
  assert(rooms[0].complete === true, "room1 cleared");
  assert(rooms[0].action === "restart", "room1 restart action");
  assert(rooms[1].unlocked === false, "room2 still sealed (no challenges)");

  const pages = ["/", "/dashboard.html", "/room.html", "/challenges.html"];
  for (const p of pages) {
    const r = await req("GET", p);
    assert(r.status === 200, "page " + p);
  }

  console.log("SMOKE PASS");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
