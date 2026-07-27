/* =========================================================
   OUIJA CTF — Shared form plumbing
   Field-level errors, passphrase peeking, caps-lock warning,
   strength meter, and a small validation runner.
   ========================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     Errors are addressed to a field, not shouted at the page
     --------------------------------------------------------- */
  function fieldEl(name) {
    return document.querySelector(`[data-field="${name}"]`);
  }

  function setError(name, message) {
    const field = fieldEl(name);
    /* If the page no longer has that field (e.g. legacy API error), surface it. */
    if (!field) {
      banner(message || "The board refused.");
      return false;
    }
    const slot = field.querySelector(".field__error");
    field.classList.add("has-error");
    field.classList.remove("is-valid");
    if (slot) slot.textContent = message;
    return true;
  }

  function clearError(name) {
    const field = fieldEl(name);
    if (!field) return;
    field.classList.remove("has-error");
    const slot = field.querySelector(".field__error");
    if (slot) slot.textContent = "";
  }

  function markValid(name) {
    const field = fieldEl(name);
    if (!field) return;
    field.classList.remove("has-error");
    field.classList.add("is-valid");
    const slot = field.querySelector(".field__error");
    if (slot) slot.textContent = "";
  }

  function clearAll(names) {
    names.forEach(clearError);
    const banner = document.getElementById("formError");
    if (banner) banner.hidden = true;
  }

  function banner(message) {
    const box = document.getElementById("formError");
    const text = document.getElementById("formErrorText");
    if (!box || !text) return;
    text.textContent = message;
    box.hidden = false;
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /* Put the caret where the trouble is. */
  function focusField(name) {
    const field = fieldEl(name);
    if (!field) return;
    const input = field.querySelector("input, select");
    if (input) input.focus();
  }

  /* ---------------------------------------------------------
     Show / hide passphrase
     --------------------------------------------------------- */
  function wirePeek() {
    document.querySelectorAll("[data-peek]").forEach((btn) => {
      const input = document.getElementById(btn.dataset.peek);
      if (!input) return;

      btn.addEventListener("click", () => {
        const shown = input.type === "text";
        input.type = shown ? "password" : "text";
        btn.setAttribute("aria-pressed", String(!shown));
        btn.setAttribute("aria-label", shown ? "Show passphrase" : "Hide passphrase");
        input.focus();
        /* Keep the caret at the end rather than jumping to the start */
        const end = input.value.length;
        try {
          input.setSelectionRange(end, end);
        } catch (_) {}
      });
    });
  }

  /* ---------------------------------------------------------
     Caps lock: silently ruins more logins than anything else
     --------------------------------------------------------- */
  function wireCapsWarning() {
    const hint = document.getElementById("capsHint");
    if (!hint) return;

    const check = (e) => {
      if (typeof e.getModifierState !== "function") return;
      hint.classList.toggle("is-shown", e.getModifierState("CapsLock"));
    };

    document.querySelectorAll('input[type="password"]').forEach((input) => {
      input.addEventListener("keydown", check);
      input.addEventListener("keyup", check);
      input.addEventListener("blur", () => hint.classList.remove("is-shown"));
    });
  }

  /* ---------------------------------------------------------
     Strength meter
     --------------------------------------------------------- */
  function wireStrength(inputId) {
    const input = document.getElementById(inputId);
    const fill = document.getElementById("strengthFill");
    const label = document.getElementById("strengthLabel");
    if (!input || !fill || !label) return;

    const colours = [
      "var(--ember-600)",
      "var(--ember-500)",
      "var(--ember-400)",
      "var(--brass-500)",
      "var(--brass-400)",
      "var(--spectre-500)",
      "var(--spectre-400)",
    ];

    input.addEventListener("input", () => {
      const { score, label: word } = Vault.strength(input.value);
      fill.style.width = (score / 6) * 100 + "%";
      fill.style.background = colours[score];
      label.textContent = word;
    });
  }

  /* ---------------------------------------------------------
     A tiny validation runner
     Each rule returns a message when it fails, nothing when it passes.
     --------------------------------------------------------- */
  function validate(rules) {
    let firstBad = null;
    for (const name in rules) {
      const message = rules[name]();
      if (message) {
        setError(name, message);
        if (!firstBad) firstBad = name;
      } else {
        clearError(name);
      }
    }
    if (firstBad) focusField(firstBad);
    return !firstBad;
  }

  /* Validate one field as soon as the medium leaves it. */
  function wireLiveValidation(rules) {
    for (const name in rules) {
      const field = fieldEl(name);
      if (!field) continue;
      const input = field.querySelector("input, select");
      if (!input) continue;

      input.addEventListener("blur", () => {
        if (!input.value && input.type !== "checkbox") return;
        const message = rules[name]();
        if (message) setError(name, message);
        else markValid(name);
      });

      input.addEventListener("input", () => {
        if (field.classList.contains("has-error")) clearError(name);
      });
    }
  }

  function busy(button, on, label) {
    if (!button) return;
    button.classList.toggle("is-loading", on);
    button.disabled = on;
    if (label && !on) button.textContent = label;
  }

  window.AuthUI = {
    setError,
    clearError,
    clearAll,
    markValid,
    banner,
    focusField,
    validate,
    wireLiveValidation,
    busy,
    init() {
      wirePeek();
      wireCapsWarning();
      wireStrength("password");
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => AuthUI.init());
  } else {
    AuthUI.init();
  }
})();
