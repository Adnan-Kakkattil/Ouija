/* =========================================================
   OUIJA CTF — Entry (API)
   ========================================================= */

(function () {
  "use strict";

  const form = document.getElementById("form");
  if (!form) return;

  const els = {
    identifier: document.getElementById("identifier"),
    password: document.getElementById("password"),
    remember: document.getElementById("remember"),
    submit: document.getElementById("submit"),
  };

  const next = (function () {
    const raw = new URLSearchParams(location.search).get("next") || "";
    return /^[a-z0-9._-]+\.html$/i.test(raw) ? raw : "dashboard.html";
  })();

  const rules = {
    identifier() {
      const v = els.identifier.value.trim();
      if (!v) return "Name yourself, or give your address.";
      const looksLikeEmail = v.includes("@");
      if (looksLikeEmail && !Vault.RULES.email.test(v)) return "That address does not resolve.";
      if (!looksLikeEmail && v.length < 3) return "At least 3 characters.";
      return "";
    },
    password() {
      if (!els.password.value) return "The passphrase is missing.";
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
    AuthUI.clearAll(["identifier", "password"]);
    if (!AuthUI.validate(rules)) return;

    AuthUI.busy(els.submit, true);
    try {
      const user = await Vault.login({
        identifier: els.identifier.value.trim(),
        password: els.password.value,
        remember: els.remember.checked,
      });
      Atmosphere.toast(`The board opens for ${user.username}.`, "success", 2000);
      setTimeout(() => Atmosphere.leaveTo(next), 420);
    } catch (err) {
      AuthUI.busy(els.submit, false, "Open the board");
      els.password.value = "";
      if (err && err.field) {
        AuthUI.setError(err.field, err.message);
        AuthUI.focusField(err.field);
      } else {
        AuthUI.banner((err && err.message) || "The board stayed shut.");
      }
      const aside = document.querySelector(".auth__aside .board-stage");
      if (aside && aside.ouija) aside.ouija.spell("NO", { dwell: 700 });
    }
  }

  document.querySelector("[data-forgot]").addEventListener("click", (e) => {
    e.preventDefault();
    Atmosphere.toast(
      "The dead keep no recovery records. Ask an organiser to reseat you.",
      "error",
      5000
    );
  });

  async function boot() {
    if (await Vault.redirectIfAuthed(next)) return;
    await paintTally();
    AuthUI.wireLiveValidation(rules);
    form.addEventListener("submit", onSubmit);
    els.identifier.focus();
  }

  boot().catch((err) => {
    console.error(err);
    AuthUI.banner("Could not reach the board. Is the server running?");
  });
})();
