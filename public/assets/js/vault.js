/* =========================================================
   OUIJA CTF — Client vault (API-backed)
   Talks to /api/auth and /api/challenges. Sessions use
   httpOnly cookies set by Express — no passwords in localStorage.
   ========================================================= */

(function () {
  "use strict";

  const RULES = {
    username: /^[a-z0-9](?:[a-z0-9_.-]{1,22})[a-z0-9]$/i,
  };

  const HOSTINGER_DOWN =
    "The house is restarting (Hostinger Node). Wait a few seconds, then try again — or Restart the app in hPanel.";

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isTransientStatus(status) {
    return status === 0 || status === 408 || status === 425 || status === 429 || status === 502 || status === 503 || status === 504;
  }

  function looksLikeHtml(text) {
    const t = String(text || "").trim().slice(0, 200).toLowerCase();
    return t.startsWith("<!DOCTYPE") || t.startsWith("<html") || t.includes("cannot get /api");
  }

  async function apiOnce(path, options) {
    const opts = Object.assign({ credentials: "same-origin" }, options || {});
    opts.headers = Object.assign({ Accept: "application/json" }, opts.headers || {});
    if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }

    let res;
    try {
      res = await fetch(path, opts);
    } catch {
      const err = new Error(HOSTINGER_DOWN);
      err.status = 0;
      err.hostingerDown = true;
      throw err;
    }

    const ct = String(res.headers.get("content-type") || "").toLowerCase();
    const raw = await res.text();
    let data = null;

    if (ct.includes("application/json") || (raw && raw.trim().charAt(0) === "{")) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
    }

    if (!data) {
      if (looksLikeHtml(raw) || !ct.includes("json")) {
        const err = new Error(HOSTINGER_DOWN);
        err.status = res.status || 503;
        err.hostingerDown = true;
        throw err;
      }
      data = { ok: false, message: "The veil returned silence." };
    }

    if (!res.ok) {
      const err = new Error((data && data.message) || "The board refused.");
      err.field = data && data.field;
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function api(path, options) {
    const opts = options || {};
    const retries = opts.retries != null ? Number(opts.retries) : 2;
    const callOpts = Object.assign({}, opts);
    delete callOpts.retries;

    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await apiOnce(path, callOpts);
      } catch (err) {
        lastErr = err;
        const transient = err && (err.hostingerDown || isTransientStatus(err.status));
        if (!transient || attempt === retries) throw err;
        await sleep(450 * (attempt + 1));
      }
    }
    throw lastErr;
  }

  let cachedUser = undefined;

  const Vault = {
    RULES,

    go(url, opts) {
      const href = url || "dashboard.html";
      const useVeil = !(opts && opts.instant) && window.Atmosphere && typeof Atmosphere.leaveTo === "function";
      if (useVeil) {
        try {
          Atmosphere.leaveTo(href);
          return;
        } catch (_) {
          /* fall through */
        }
      }
      location.assign(href);
    },

    async listTeams() {
      const data = await api("/api/auth/teams");
      return data.teams || [];
    },

    async currentUser(force) {
      if (!force && cachedUser !== undefined) return cachedUser;
      const data = await api("/api/auth/me");
      cachedUser = data.user || null;
      return cachedUser;
    },

    async signup(input) {
      const data = await api("/api/auth/signup", { method: "POST", body: input });
      cachedUser = data.user;
      return data.user;
    },

    async login(input) {
      const data = await api("/api/auth/login", { method: "POST", body: input });
      cachedUser = data.user;
      return data.user;
    },

    async logout() {
      await api("/api/auth/logout", { method: "POST", body: {} });
      cachedUser = null;
    },

    async leaderboard() {
      return api("/api/auth/leaderboard");
    },

    async pointLedger(limit) {
      const q = limit ? "?limit=" + encodeURIComponent(limit) : "";
      return api("/api/auth/points" + q);
    },

    async stats() {
      return api("/api/auth/stats");
    },

    async challenges() {
      const data = await api("/api/challenges");
      return data.challenges || [];
    },

    async catalogue() {
      const data = await api("/api/challenges");
      return {
        challenges: data.challenges || [],
        trials: data.trials || [],
      };
    },

    async rooms() {
      const data = await api("/api/rooms");
      return data;
    },

    async room(id) {
      return api("/api/rooms/" + encodeURIComponent(id));
    },

    async focusRoom(id, mode) {
      const data = await api("/api/rooms/" + encodeURIComponent(id) + "/focus", {
        method: "POST",
        body: { mode: mode || "continue" },
      });
      if (data.user) cachedUser = data.user;
      return data;
    },

    async markRoomIntro(id) {
      const data = await api("/api/rooms/" + encodeURIComponent(id) + "/intro", {
        method: "POST",
        body: {},
      });
      if (data.user) cachedUser = data.user;
      return data;
    },

    async submitFlag(id, flag) {
      return api("/api/challenges/" + encodeURIComponent(id) + "/submit", {
        method: "POST",
        body: { flag },
      });
    },

    async focusChallenge(id) {
      const data = await api("/api/challenges/" + encodeURIComponent(id) + "/focus", {
        method: "POST",
        body: {},
      });
      if (data.user) cachedUser = data.user;
      return data;
    },

    async markStorySeen() {
      const data = await api("/api/auth/story-seen", { method: "POST", body: {} });
      if (data.user) cachedUser = data.user;
      return data;
    },

    needsStory(user) {
      if (!user) return false;
      if (user.storySeen) return false;
      if (this.hasProgress(user)) return false;
      return true;
    },

    needsFirstGate(user) {
      if (!user) return false;
      if (user.solved && user.solved.indexOf("whisper-1") !== -1) return false;
      return true;
    },

    async playIntro(user, onDone) {
      const go = typeof onDone === "function" ? onDone : function () {};
      const wrapped = (result) => {
        if (result && result.next) {
          this.go(result.next, { instant: true });
          return;
        }
        go(result);
      };
      if (this.needsStory(user) && window.FirstRite) {
        FirstRite.reset();
        await FirstRite.play({ force: true, chainGate: true, onDone: wrapped });
        return true;
      }
      if (this.needsFirstGate(user) && window.FirstGate) {
        await FirstGate.play({ onDone: wrapped });
        return true;
      }
      return false;
    },

    async unlockHint(id) {
      const data = await api("/api/challenges/" + encodeURIComponent(id) + "/hint", {
        method: "POST",
        body: {},
      });
      if (data.user) cachedUser = data.user;
      return data;
    },

    resumeUrl(user, fallback) {
      if (user && user.resumePath) return user.resumePath;
      if (user && user.lastChallengeId) return "challenges.html#" + user.lastChallengeId;
      return fallback || "dashboard.html";
    },

    hasProgress(user) {
      if (!user) return false;
      if (user.lastChallengeId) return true;
      if (user.solvedCount > 0) return true;
      if (user.solved && user.solved.length) return true;
      return false;
    },

    async requireAuth(redirectTo) {
      const user = await this.currentUser(true);
      if (!user) {
        const page = location.pathname.split("/").pop() || "dashboard.html";
        const back = encodeURIComponent(page);
        location.replace((redirectTo || "login.html") + "?next=" + back);
        return null;
      }
      return user;
    },

    async redirectIfAuthed(to) {
      const user = await this.currentUser(true);
      if (user) {
        location.replace(to || "dashboard.html");
        return true;
      }
      return false;
    },

    strength(password) {
      const pw = String(password || "");
      if (!pw) return { score: 0, label: "—" };
      let score = 0;
      if (pw.length >= 8) score += 1;
      if (pw.length >= 12) score += 1;
      if (pw.length >= 18) score += 1;
      if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
      if (/\d/.test(pw)) score += 1;
      if (/[^A-Za-z0-9]/.test(pw)) score += 1;
      if (/(.)\1{2,}/.test(pw)) score -= 1;
      if (/^(?:password|qwerty|letmein|ouija|123456)/i.test(pw)) score = Math.min(score, 1);
      score = Math.max(0, Math.min(6, score));
      const labels = ["Silent", "Faint", "Whispering", "Stirring", "Speaking", "Resonant", "Unbroken"];
      return { score, label: labels[score] };
    },
  };

  window.Vault = Vault;
})();
