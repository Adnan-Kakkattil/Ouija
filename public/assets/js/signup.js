/* =========================================================
   OUIJA CTF — Enrolment (API)
   ========================================================= */

(function () {
  "use strict";

  const NEW_CIRCLE = "__new__";
  const form = document.getElementById("form");
  if (!form) return;

  const els = {
    username: document.getElementById("username"),
    email: document.getElementById("email"),
    team: document.getElementById("team"),
    teamName: document.getElementById("teamName"),
    newTeamWrap: document.getElementById("newTeamWrap"),
    password: document.getElementById("password"),
    confirm: document.getElementById("confirm"),
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
    email() {
      const v = els.email.value.trim();
      if (!v) return "We need somewhere to send the summons.";
      if (!Vault.RULES.email.test(v)) return "That address does not resolve.";
      return "";
    },
    team() {
      if (!els.team.value) return "Choose the circle you sit with.";
      return "";
    },
    teamName() {
      if (els.team.value !== NEW_CIRCLE) return "";
      const v = els.teamName.value.trim();
      if (!v) return "Give your circle a name.";
      if (!Vault.RULES.teamName.test(v))
        return "3–32 characters. Letters, numbers, spaces and ' & . : _ - only.";
      return "";
    },
    password() {
      const v = els.password.value;
      if (!v) return "Choose a passphrase.";
      if (v.length < 8) return "At least 8 characters — the veil is thin, but not that thin.";
      if (Vault.strength(v).score < 2) return "Too easily guessed. Add length, or a symbol.";
      return "";
    },
    confirm() {
      if (!els.confirm.value) return "Repeat the passphrase.";
      if (els.confirm.value !== els.password.value) return "These two do not match.";
      return "";
    },
    agree() {
      if (!els.agree.checked) return "The courtesies are not optional.";
      return "";
    },
  };

  async function paintTeams() {
    const teams = await Vault.listTeams();
    const select = els.team;
    while (select.options.length > 1) select.remove(1);

    if (teams.length) {
      const group = document.createElement("optgroup");
      group.label = "Circles already gathered";
      teams.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent =
          t.sigil +
          "  " +
          t.name +
          (t.memberCount ? `  ·  ${t.memberCount} seated` : "  ·  empty");
        group.appendChild(opt);
      });
      select.appendChild(group);
    }

    const own = document.createElement("optgroup");
    own.label = "Or start your own";
    const opt = document.createElement("option");
    opt.value = NEW_CIRCLE;
    opt.textContent = "✦  Found a new circle…";
    own.appendChild(opt);
    select.appendChild(own);

    try {
      const stats = await Vault.stats();
      const circles = document.querySelector("[data-tally-circles]");
      const mediums = document.querySelector("[data-tally-mediums]");
      if (circles) circles.textContent = String(stats.circles || teams.length);
      if (mediums) mediums.textContent = String(stats.mediums || 0);
    } catch {
      const circles = document.querySelector("[data-tally-circles]");
      const mediums = document.querySelector("[data-tally-mediums]");
      if (circles) circles.textContent = String(teams.length);
      if (mediums) mediums.textContent = String(teams.reduce((n, t) => n + t.memberCount, 0));
    }

    const wanted = new URLSearchParams(location.search).get("circle");
    if (wanted && [...els.team.options].some((o) => o.value === wanted)) {
      els.team.value = wanted;
    }
  }

  function wireTeamChoice() {
    els.team.addEventListener("change", () => {
      const founding = els.team.value === NEW_CIRCLE;
      els.newTeamWrap.classList.toggle("is-open", founding);
      els.teamName.required = founding;
      AuthUI.clearError("team");
      if (founding) setTimeout(() => els.teamName.focus(), 340);
      else {
        els.teamName.value = "";
        AuthUI.clearError("teamName");
      }
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    AuthUI.clearAll(["username", "email", "team", "teamName", "password", "confirm", "agree"]);
    if (!AuthUI.validate(rules)) return;

    AuthUI.busy(els.submit, true);
    try {
      const user = await Vault.signup({
        username: els.username.value.trim(),
        email: els.email.value.trim(),
        password: els.password.value,
        teamId: els.team.value,
        newTeamName: els.teamName.value.trim(),
      });
      await welcome(user);
    } catch (err) {
      AuthUI.busy(els.submit, false);
      els.submit.textContent = "Take my seat";
      if (err && err.field) {
        AuthUI.setError(err.field, err.message);
        AuthUI.focusField(err.field);
      } else {
        AuthUI.banner((err && err.message) || "The board refused. Try once more.");
      }
    }
  }

  function welcome(user) {
    const screen = document.getElementById("welcome");
    const stage = document.getElementById("welcomeBoard");

    const finish = async () => {
      /* After enrolment, play the CTF story then open the table */
      if (window.FirstRite) {
        FirstRite.reset();
        await FirstRite.play({
          force: true,
          onDone() {
            Vault.go("dashboard.html", { instant: true });
          },
        });
        return;
      }
      Vault.go("dashboard.html", { instant: true });
    };

    if (!screen || !stage || !stage.ouija) {
      return finish();
    }

    screen.classList.add("is-open");
    screen.setAttribute("aria-hidden", "false");
    const name = user.username.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const phrase = ("WELCOME " + (name || "MEDIUM")).slice(0, 22);

    return new Promise((resolve) => {
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        finish().then(resolve);
      };

      stage.addEventListener("ouija:spell-end", () => setTimeout(go, 500), { once: true });
      stage.ouija.spell(phrase, { dwell: 260 });
      setTimeout(go, 4500);
    });
  }

  async function boot() {
    if (await Vault.redirectIfAuthed("dashboard.html")) return;
    await paintTeams();
    wireTeamChoice();
    AuthUI.wireLiveValidation(rules);
    form.addEventListener("submit", onSubmit);
    els.username.focus();
  }

  boot().catch((err) => {
    console.error(err);
    AuthUI.banner("Could not reach the board. Is the server running?");
  });
})();
