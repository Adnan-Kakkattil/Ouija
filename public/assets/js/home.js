/* =========================================================
   OUIJA CTF — Landing page behaviour (API)
   ========================================================= */

(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function wireQuestions() {
    const stage = document.querySelector("[data-board]");
    if (!stage) return;

    document.querySelectorAll("[data-ask]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const board = stage.ouija;
        if (!board) return;
        const answer = ANSWERS[btn.dataset.ask] || btn.dataset.ask;
        board.stop();
        board.spell(answer, { dwell: 420 });
        if (window.innerWidth < 760) {
          document.getElementById("slate").scrollIntoView({ block: "center", behavior: "smooth" });
        }
      });
    });
  }

  const ANSWERS = {
    "WHO IS THERE": "I HAVE 24 NAMES",
    "WHERE IS THE FLAG": "UNDER THE 9TH FLOORBOARD",
    "AM I ALONE": "NO",
    GOODBYE: "GOODBYE",
  };

  function wireCounters() {
    const nodes = document.querySelectorAll("[data-count-to]");
    if (!nodes.length) return;
    if (reduced || !("IntersectionObserver" in window)) {
      nodes.forEach((n) => (n.textContent = n.dataset.countTo));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          countUp(entry.target, Number(entry.target.dataset.countTo));
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.5 }
    );
    nodes.forEach((n) => io.observe(n));
  }

  function countUp(node, target) {
    const duration = 1400;
    const start = performance.now();
    (function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      node.textContent = Math.round(target * eased);
      if (t < 1) requestAnimationFrame(tick);
    })(start);
  }

  async function renderLadder() {
    const list = document.getElementById("ladder");
    if (!list || !window.Vault) return;
    try {
      const data = await Vault.leaderboard();
      const circleCount = document.querySelector("[data-circles]");
      if (circleCount) circleCount.textContent = String(data.circles || 0);
      const rows = data.rows || [];
      if (!rows.length) return;
      list.innerHTML = rows
        .slice(0, 10)
        .map(
          (t, i) => `
        <li>
          <span class="ladder__rank">${String(i + 1).padStart(2, "0")}</span>
          <span class="ladder__sigil" aria-hidden="true">${t.sigil}</span>
          <span>
            <span class="ladder__name">${escapeHtml(t.name)}</span>
            <span class="ladder__meta">${t.members} medium${t.members === 1 ? "" : "s"} &middot; ${t.solved} flag${
            t.solved === 1 ? "" : "s"
          }</span>
          </span>
          <span class="ladder__score">${t.score}</span>
        </li>`
        )
        .join("");
    } catch (err) {
      console.warn("[ladder]", err);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
  }

  async function reflectAuth() {
    const slot = document.querySelector("[data-auth-actions]");
    if (!slot || !window.Vault) return;
    try {
      const user = await Vault.currentUser();
      if (!user) return;
      slot.innerHTML = `
      <span class="whoami">
        <span class="whoami__chip"><span aria-hidden="true">${user.teamSigil}</span> ${escapeHtml(
        user.username
      )}</span>
        <a class="btn btn--primary btn--sm" href="dashboard.html">The Table</a>
      </span>`;
    } catch {
      /* ignore */
    }
  }

  function wireAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href").slice(1);
        if (!id) return;
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        history.replaceState(null, "", "#" + id);
      });
    });
  }

  function init() {
    wireQuestions();
    wireCounters();
    renderLadder();
    reflectAuth();
    wireAnchors();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
