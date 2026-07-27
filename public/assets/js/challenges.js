/* Challenges page — progress persists in MongoDB across logins */

(function () {
  "use strict";

  let challenges = [];
  let activeId = null;
  let filter = "all";
  let lastChallengeId = null;

  async function boot() {
    const user = await Vault.requireAuth("login.html");
    if (!user) return;

    lastChallengeId = user.lastChallengeId || null;

    paintHeader(user);

    challenges = await Vault.challenges();
    const solved = challenges.filter((c) => c.solved).length;
    const eyebrow = document.getElementById("trialsEyebrow");
    if (eyebrow) {
      const teamSolved =
        user.teamProgress && typeof user.teamProgress.solvedCount === "number"
          ? user.teamProgress.solvedCount
          : null;
      eyebrow.textContent =
        challenges.length +
        " flags open · " +
        solved +
        " claimed by you" +
        (teamSolved != null ? " · " + teamSolved + " by your circle" : "") +
        " · " +
        new Set(challenges.map((c) => c.category)).size +
        " disciplines";
    }

    document.getElementById("filters").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-filter]");
      if (!btn) return;
      filter = btn.dataset.filter;
      document.querySelectorAll("#filters .btn").forEach((b) => b.classList.toggle("is-active", b === btn));
      paint();
    });

    document.getElementById("submitFlag").addEventListener("click", submitFlag);
    document.getElementById("unlockHintBtn").addEventListener("click", unlockHint);

    paint();

    /* Resume: URL hash wins, else last challenge from MongoDB */
    const hash = location.hash.replace("#", "");
    const resumeId =
      (hash && challenges.some((c) => c.id === hash) && hash) ||
      (lastChallengeId && challenges.some((c) => c.id === lastChallengeId) && lastChallengeId) ||
      null;

    if (resumeId) {
      openModal(resumeId);
      if (resumeId === lastChallengeId && !hash && window.Atmosphere) {
        Atmosphere.toast("Resuming your last trial.", "success", 2800);
      }
    }
  }

  function paintHeader(user) {
    document.getElementById("headerChip").textContent =
      (user.teamSigil || "") + " " + user.username + " · " + (user.score || 0) + " pts";
  }

  function paint() {
    const grid = document.getElementById("challengeGrid");
    const list = challenges.filter((c) => filter === "all" || c.category === filter);
    if (!list.length) {
      grid.innerHTML = '<p class="typewriter-note">No trials in this corridor.</p>';
      return;
    }
    grid.innerHTML = list
      .map((c) => {
        const isLast = c.id === lastChallengeId;
        return `
      <button type="button" class="card challenge-card ${c.solved ? "is-solved" : ""} ${
          isLast ? "is-current" : ""
        }" data-open="${c.id}">
        <div class="challenge-card__top">
          <span class="badge ${c.solved ? "badge--spectre" : isLast ? "badge--ember" : "badge--brass"}">${
            c.solved ? "Claimed" : isLast ? "In progress" : c.roman
          }</span>
          <span class="challenge-card__points">${c.points}</span>
        </div>
        <h3 class="card__title">${escapeHtml(c.title)}</h3>
        <p class="card__text">${escapeHtml(c.trial)} · ${escapeHtml(c.category)} · ${escapeHtml(
          c.difficulty
        )}</p>
      </button>`;
      })
      .join("");

    grid.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => openModal(btn.dataset.open));
    });
  }

  function paintHint(c) {
    const btn = document.getElementById("unlockHintBtn");
    const text = document.getElementById("modalHint");
    const note = document.getElementById("hintCostNote");
    const box = document.getElementById("hintBox");
    const cost = c.hintCost != null ? c.hintCost : 10;

    if (c.noHint) {
      if (box) box.hidden = true;
      return;
    }
    if (box) box.hidden = false;

    if (c.hintUnlocked && c.hint) {
      btn.hidden = true;
      text.hidden = false;
      text.textContent = c.hint;
      note.textContent = "Hint unlocked (−" + cost + " pts already paid).";
      return;
    }

    btn.hidden = false;
    btn.disabled = !!c.solved;
    btn.textContent = "Ask for a hint (−" + cost + " pts)";
    text.hidden = true;
    text.textContent = "";
    note.textContent = c.solved
      ? "This trial is already claimed."
      : "Easy −10 · Medium −20 · Hard −30. Points leave your score when you listen.";
  }

  function openModal(id) {
    const c = challenges.find((x) => x.id === id);
    if (!c) return;
    activeId = id;
    lastChallengeId = id;
    document.getElementById("modalTrial").textContent = c.trial + " · " + c.roman;
    document.getElementById("modalTitle").textContent = c.title;
    document.getElementById("modalMeta").textContent =
      c.points + " pts · " + c.category + " · " + c.difficulty + (c.solved ? " · already claimed" : "");
    document.getElementById("modalDesc").textContent = c.description;
    paintHint(c);
    document.getElementById("flagInput").value = "";
    document.getElementById("flagError").textContent = "";
    document.querySelector('[data-field="flag"]').classList.remove("has-error");
    document.getElementById("challengeModal").showModal();
    history.replaceState(null, "", "#" + id);
    paint();

    /* Persist focus so re-login returns here */
    Vault.focusChallenge(id).catch(() => {});
  }

  async function unlockHint() {
    if (!activeId) return;
    const btn = document.getElementById("unlockHintBtn");
    btn.classList.add("is-loading");
    btn.disabled = true;
    try {
      const data = await Vault.unlockHint(activeId);
      const cost = data.cost || 0;
      if (data.alreadyUnlocked) {
        Atmosphere.toast(data.message || "Hint already unlocked.", "success");
      } else {
        Atmosphere.toast(
          data.message || "Hint unlocked. −" + cost + " pts.",
          "success",
          4200
        );
      }

      challenges = await Vault.challenges();
      const user = data.user || (await Vault.currentUser(true));
      if (user) paintHeader(user);

      const c = challenges.find((x) => x.id === activeId);
      if (c) paintHint(c);
    } catch (e) {
      Atmosphere.toast(e.message || "The house withheld the whisper.", "error");
    } finally {
      btn.classList.remove("is-loading");
      const c = challenges.find((x) => x.id === activeId);
      if (c && !c.hintUnlocked) btn.disabled = !!c.solved;
    }
  }

  async function submitFlag() {
    const input = document.getElementById("flagInput");
    const field = document.querySelector('[data-field="flag"]');
    const err = document.getElementById("flagError");
    field.classList.remove("has-error");
    err.textContent = "";

    const flag = input.value.trim();
    if (!flag) {
      field.classList.add("has-error");
      err.textContent = "Offer a flag.";
      return;
    }

    const btn = document.getElementById("submitFlag");
    btn.classList.add("is-loading");
    btn.disabled = true;
    try {
      const data = await Vault.submitFlag(activeId, flag);
      Atmosphere.toast(data.message || "Accepted.", "success");
      challenges = await Vault.challenges();
      const user = data.user || (await Vault.currentUser(true));
      if (user) {
        lastChallengeId = user.lastChallengeId || activeId;
        paintHeader(user);
      }
      paint();
      document.getElementById("challengeModal").close();

      if (user && user.lastChallengeId && user.lastChallengeId !== activeId) {
        setTimeout(() => openModal(user.lastChallengeId), 450);
      }
    } catch (e) {
      field.classList.add("has-error");
      err.textContent = e.message || "Rejected.";
    } finally {
      btn.classList.remove("is-loading");
      btn.disabled = false;
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
  }

  boot().catch((err) => {
    console.error(err);
    Atmosphere.toast("Could not load the trials.", "error");
  });
})();
