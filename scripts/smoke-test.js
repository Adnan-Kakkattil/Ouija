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
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            body: raw,
            cookies: res.headers["set-cookie"] || [],
          });
        });
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

function pickCookie(setCookieHeaders) {
  for (const line of setCookieHeaders) {
    if (line.startsWith("ouija.sid=")) return line.split(";")[0];
  }
  return "";
}

(async () => {
  const stamp = Date.now().toString(36);
  const teams = await req("GET", "/api/auth/teams");
  const teamId = JSON.parse(teams.body).teams[0].id;

  const signup = await req("POST", "/api/auth/signup", {
    username: "sitter_" + stamp,
    email: `sitter_${stamp}@blackmoor.row`,
    password: "SpiritPass9!",
    teamId,
  });
  console.log("signup", signup.status, pickCookie(signup.cookies) ? "cookie=yes" : "cookie=NO", signup.body.slice(0, 160));
  console.log("set-cookie", signup.cookies);

  let cookie = pickCookie(signup.cookies);

  const me = await req("GET", "/api/auth/me", null, cookie);
  console.log("me", me.status, me.body);

  const challenges = await req("GET", "/api/challenges", null, cookie);
  const parsed = JSON.parse(challenges.body);
  console.log("challenges", challenges.status, "count=", (parsed.challenges || []).length);

  const submit = await req(
    "POST",
    "/api/challenges/whisper-1/submit",
    { flag: "ouija{first_knock_answered}" },
    cookie
  );
  console.log("submit", submit.status, submit.body);

  await req("POST", "/api/auth/logout", {}, cookie);

  const loginEmail = await req("POST", "/api/auth/login", {
    identifier: `sitter_${stamp}@blackmoor.row`,
    password: "SpiritPass9!",
  });
  cookie = pickCookie(loginEmail.cookies);
  console.log("loginEmail", loginEmail.status, cookie ? "cookie=yes" : "cookie=NO");

  const loginUser = await req("POST", "/api/auth/login", {
    identifier: "sitter_" + stamp,
    password: "SpiritPass9!",
  });
  cookie = pickCookie(loginUser.cookies) || cookie;
  console.log("loginUser", loginUser.status, cookie ? "cookie=yes" : "cookie=NO");

  const me2 = await req("GET", "/api/auth/me", null, cookie);
  console.log("me2", me2.status, me2.body.slice(0, 200));

  const pages = ["/", "/signup.html", "/login.html", "/dashboard.html", "/challenges.html"];
  for (const p of pages) {
    const r = await req("GET", p);
    console.log("page", p, r.status);
  }

  console.log("DONE");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
