/* Challenges page */

(function () {
  "use strict";

  let challenges = [];
  let activeId = null;
  let filter = "all";

  async function boot() {
    const user = await Vault.requireAuth("login.html");
    if (!user) return;

    document.getElementById("headerChip").textContent =
      (user.teamSigil || "") + " " + user.username + " · " + (user.score || 0) + " pts";

    challenges = await Vault.challenges();
    const solved = challenges.filter((c) => c.solved).length;
    const eyebrow = document.getElementById("trialsEyebrow");
    if (eyebrow) {
      eyebrow.textContent =
        challenges.length +
        " flags open · " +
        solved +
        " claimed by you · " +
        new Set(challenges.map((c) => c.category)).size +
        " disciplines";
    }
    paint();

    document.getElementById("filters").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-filter]");
      if (!btn) return;
      filter = btn.dataset.filter;
      document.querySelectorAll("#filters .btn").forEach((b) => b.classList.toggle("is-active", b === btn));
      paint();
    });

    document.getElementById("submitFlag").addEventListener("click", submitFlag);

    const hash = location.hash.replace("#", "");
    if (hash && challenges.some((c) => c.id === hash)) openModal(hash);
  }

  function paint() {
    const grid = document.getElementById("challengeGrid");
    const list = challenges.filter((c) => filter === "all" || c.category === filter);
    if (!list.length) {
      grid.innerHTML = '<p class="typewriter-note">No trials in this corridor.</p>';
      return;
    }
    grid.innerHTML = list
      .map(
        (c) => `
      <button type="button" class="card challenge-card ${c.solved ? "is-solved" : ""}" data-open="${c.id}">
        <div class="challenge-card__top">
          <span class="badge ${c.solved ? "badge--spectre" : "badge--brass"}">${c.solved ? "Claimed" : c.roman}</span>
          <span class="challenge-card__points">${c.points}</span>
        </div>
        <h3 class="card__title">${escapeHtml(c.title)}</h3>
        <p class="card__text">${escapeHtml(c.trial)} · ${escapeHtml(c.category)} · ${escapeHtml(c.difficulty)}</p>
      </button>`
      )
      .join("");

    grid.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => openModal(btn.dataset.open));
    });
  }

  function openModal(id) {
    const c = challenges.find((x) => x.id === id);
    if (!c) return;
    activeId = id;
    document.getElementById("modalTrial").textContent = c.trial + " · " + c.roman;
    document.getElementById("modalTitle").textContent = c.title;
    document.getElementById("modalMeta").textContent =
      c.points + " pts · " + c.category + " · " + c.difficulty + (c.solved ? " · already claimed" : "");
    document.getElementById("modalDesc").textContent = c.description;
    document.getElementById("modalHint").textContent = c.hint || "The dead stay silent.";
    document.getElementById("flagInput").value = "";
    document.getElementById("flagError").textContent = "";
    document.querySelector('[data-field="flag"]').classList.remove("has-error");
    document.getElementById("challengeModal").showModal();
    history.replaceState(null, "", "#" + id);
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
      paint();
      document.getElementById("challengeModal").close();
      const user = await Vault.currentUser(true);
      if (user) {
        document.getElementById("headerChip").textContent =
          (user.teamSigil || "") + " " + user.username + " · " + (user.score || 0) + " pts";
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
