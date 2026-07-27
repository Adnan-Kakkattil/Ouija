/* =========================================================
   OUIJA CTF — Enrolment (username + password + terms)
   ========================================================= */

(function () {
  "use strict";

  const form = document.getElementById("form");
  if (!form) return;

  const els = {
    username: document.getElementById("username"),
    password: document.getElementById("password"),
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
    agree() {
      if (!els.agree.checked) return "You must accept the terms & conditions.";
      return "";
    },
  };

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
    AuthUI.clearAll(["username", "password", "agree"]);
    if (!AuthUI.validate(rules)) return;

    AuthUI.busy(els.submit, true);
    try {
      const user = await Vault.signup({
        username: els.username.value.trim(),
        password: els.password.value,
        agree: true,
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
    await paintTally();
    AuthUI.wireLiveValidation(rules);
    form.addEventListener("submit", onSubmit);
    els.username.focus();
  }

  boot().catch((err) => {
    console.error(err);
    AuthUI.banner("Could not reach the board. Is the server running?");
  });
})();
