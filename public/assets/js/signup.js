/* =========================================================
   OUIJA CTF — Enrolment (username + password + team + terms)
   ========================================================= */

(function () {
  "use strict";

  const form = document.getElementById("form");
  if (!form) return;

  const els = {
    username: document.getElementById("username"),
    password: document.getElementById("password"),
    teamId: document.getElementById("teamId"),
    agree: document.getElementById("agree"),
    submit: document.getElementById("submit"),
  };

  const rules = {
    username() {
      const v = els.username.value.trim();
      if (!v) return "Every medium needs a name.";
      if (v.length < 3) return "At least 3 characters.";
      if (!Vault.RULES.username.test(v))
        return "Letters, numbers and . _ - only; start and end with a letter or number.";
      return "";
    },
    password() {
      if (!els.password.value) return "Choose a password.";
      return "";
    },
    teamId() {
      if (!els.teamId || !els.teamId.value) return "Choose your team.";
      return "";
    },
    agree() {
      if (!els.agree.checked) return "You must accept the terms & conditions.";
      return "";
    },
  };

  async function paintTeams() {
    if (!els.teamId) return;
    try {
      const teams = await Vault.listTeams();
      if (!teams.length) return;
      const current = els.teamId.value;
      els.teamId.innerHTML =
        '<option value="" disabled ' +
        (current ? "" : "selected") +
        ">Select your team…</option>" +
        teams
          .map(function (t) {
            const selected = current && current === t.id ? " selected" : "";
            const count =
              typeof t.memberCount === "number" ? " · " + t.memberCount + " seated" : "";
            return (
              '<option value="' +
              escapeAttr(t.id) +
              '"' +
              selected +
              ">" +
              escapeHtml(t.sigil ? t.sigil + " " : "") +
              escapeHtml(t.name) +
              escapeHtml(count) +
              "</option>"
            );
          })
          .join("");
    } catch (err) {
      console.warn("[signup] teams", err);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function escapeAttr(s) {
    return String(s).replace(/[&"<>]/g, function (c) {
      return ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[c];
    });
  }

  async function paintTally() {
    try {
      const stats = await Vault.stats();
      const circles = document.querySelector("[data-tally-circles]");
      const mediums = document.querySelector("[data-tally-mediums]");
      if (circles) circles.textContent = String(stats.circles || 0);
      if (mediums) mediums.textContent = String(stats.mediums || 0);
    } catch {
      /* ignore */
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    AuthUI.clearAll(["username", "password", "teamId", "agree"]);
    if (!AuthUI.validate(rules)) return;

    AuthUI.busy(els.submit, true);
    try {
      const user = await Vault.signup({
        username: els.username.value.trim(),
        password: els.password.value,
        teamId: els.teamId.value,
        agree: true,
      });
      await welcome(user);
    } catch (err) {
      AuthUI.busy(els.submit, false);
      els.submit.textContent = "Take my seat";
      if (err && err.field) {
        AuthUI.setError(err.field, err.message);
        if (document.querySelector(`[data-field="${err.field}"]`)) {
          AuthUI.focusField(err.field);
        }
      } else {
        AuthUI.banner((err && err.message) || "The board refused. Try once more.");
      }
    }
  }

  function welcome(user) {
    const screen = document.getElementById("welcome");
    const stage = document.getElementById("welcomeBoard");
    const title = document.getElementById("welcomeTitle");
    const note = document.getElementById("welcomeNote");

    const displayName = (user && user.username) || "medium";
    if (title) title.textContent = displayName;
    if (note) {
      const teamLabel = user && user.teamName ? " · " + user.teamName : "";
      note.textContent = "Seated" + teamLabel + ". The board is spelling your welcome…";
    }

    const finish = async () => {
      if (screen) {
        screen.classList.remove("is-open");
        screen.setAttribute("aria-hidden", "true");
      }
      if (stage && stage.ouija) {
        try {
          stage.ouija.stop();
        } catch (_) {
          /* ignore */
        }
      }
      try {
        const played = await Vault.playIntro(user, () => {
          Vault.go("dashboard.html", { instant: true });
        });
        if (played) return;
      } catch (err) {
        console.error("[signup] intro failed", err);
      }
      Vault.go("dashboard.html", { instant: true });
    };

    if (!screen || !stage || !stage.ouija) {
      return finish();
    }

    screen.classList.add("is-open");
    screen.setAttribute("aria-hidden", "false");
    const name = displayName.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const phrase = ("WELCOME " + (name || "MEDIUM")).slice(0, 22);

    return new Promise((resolve) => {
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        if (note) note.textContent = "Taking you to the table…";
        finish().then(resolve).catch(resolve);
      };

      stage.addEventListener("ouija:spell-end", () => setTimeout(go, 500), { once: true });
      stage.ouija.spell(phrase, { dwell: 260 });
      setTimeout(go, 4500);
    });
  }

  async function boot() {
    if (await Vault.redirectIfAuthed("dashboard.html")) return;
    await Promise.all([paintTally(), paintTeams()]);
    AuthUI.wireLiveValidation(rules);
    form.addEventListener("submit", onSubmit);
    els.username.focus();
  }

  boot().catch((err) => {
    console.error(err);
    AuthUI.banner("Could not reach the board. Is the server running?");
  });
})();
