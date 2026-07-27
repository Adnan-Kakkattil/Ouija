/* =========================================================
   OUIJA CTF — Client vault (API-backed)
   Talks to /api/auth and /api/challenges. Sessions use
   httpOnly cookies set by Express — no passwords in localStorage.
   ========================================================= */

(function () {
  "use strict";

  const RULES = {
    username: /^[a-z0-9](?:[a-z0-9_.-]{1,22})[a-z0-9]$/i,
    email: /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i,
    teamName: /^[\p{L}\p{N}][\p{L}\p{N} '&.:_-]{2,30}$/u,
  };

  async function api(path, options) {
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
      const err = new Error("Could not reach the board. Is the server running?");
      err.status = 0;
      throw err;
    }

    let data = null;
    try {
      data = await res.json();
    } catch {
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
