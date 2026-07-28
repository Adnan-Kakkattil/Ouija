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
  const username = "sitter_" + stamp;
  const password = "SpiritPass9!";

  const signup = await req("POST", "/api/auth/signup", {
    username,
    password,
    teamId: "team_2",
    agree: true,
  });
  console.log(
    "signup",
    signup.status,
    pickCookie(signup.cookies) ? "cookie=yes" : "cookie=NO",
    signup.body.slice(0, 180)
  );

  let cookie = pickCookie(signup.cookies);
  if (signup.status !== 201 || !cookie) {
    console.error("FAIL: signup must return 201 + session cookie");
    process.exit(1);
  }

  const me = await req("GET", "/api/auth/me", null, cookie);
  const meUser = JSON.parse(me.body).user;
  console.log("me", me.status, meUser && meUser.username);

  const challenges = await req("GET", "/api/challenges", null, cookie);
  const parsed = JSON.parse(challenges.body);
  console.log("challenges", challenges.status, "count=", (parsed.challenges || []).length);

  const submit = await req(
    "POST",
    "/api/challenges/whisper-1/submit",
    { flag: "intothevictorianmansion" },
    cookie
  );
  console.log("submit", submit.status, submit.body.slice(0, 120));

  await req("POST", "/api/auth/logout", {}, cookie);

  const loginUser = await req("POST", "/api/auth/login", {
    identifier: username,
    password,
  });
  cookie = pickCookie(loginUser.cookies);
  console.log("loginUser", loginUser.status, cookie ? "cookie=yes" : "cookie=NO");

  const me2 = await req("GET", "/api/auth/me", null, cookie);
  console.log("me2", me2.status, me2.body.slice(0, 200));

  const pages = ["/", "/signup.html", "/login.html", "/dashboard.html", "/challenges.html"];
  for (const p of pages) {
    const r = await req("GET", p);
    const html = r.body || "";
    if (p === "/signup.html") {
      const hasEmail = /id=["']email["']/.test(html);
      const hasWelcome = /id=["']welcome["']/.test(html);
      const hasWelcomeTitle = /id=["']welcomeTitle["']/.test(html);
      const hasTeam = /id=["']teamId["']/.test(html);
      console.log(
        "page",
        p,
        r.status,
        "emailField=" + hasEmail,
        "teamField=" + hasTeam,
        "welcome=" + hasWelcome,
        "welcomeTitle=" + hasWelcomeTitle
      );
      if (hasEmail) {
        console.error("FAIL: signup.html should not ask for email");
        process.exit(1);
      }
      if (!hasTeam) {
        console.error("FAIL: signup.html must include team dropdown");
        process.exit(1);
      }
      if (!hasWelcome || !hasWelcomeTitle) {
        console.error("FAIL: signup welcome UI incomplete");
        process.exit(1);
      }
    } else {
      console.log("page", p, r.status);
    }
  }

  console.log("DONE");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
