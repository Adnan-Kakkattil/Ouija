/* =========================================================
   OUIJA CTF — Landing page behaviour (live API data)
   ========================================================= */

(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let challengeCount = 8;

  const ANSWERS = {
    "WHO IS THERE": () => "I HAVE " + challengeCount + " NAMES",
    "WHERE IS THE FLAG": "OPEN THE TRIALS",
    "AM I ALONE": "NO",
    GOODBYE: "GOODBYE",
  };

  function wireQuestions() {
    const stage = document.querySelector("[data-board]");
    if (!stage) return;

    document.querySelectorAll("[data-ask]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const board = stage.ouija;
        if (!board) return;
        const raw = ANSWERS[btn.dataset.ask];
        const answer = typeof raw === "function" ? raw() : raw || btn.dataset.ask;
        board.stop();
        board.spell(answer, { dwell: 420 });
        if (window.innerWidth < 760) {
          const slate = document.getElementById("slate");
          if (slate) slate.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      });
    });
  }

  function countUp(node, target) {
    const duration = 1200;
    const start = performance.now();
    const from = 0;
    (function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      node.textContent = Math.round(from + (target - from) * eased);
      if (t < 1) requestAnimationFrame(tick);
    })(start);
  }

  function paintStat(name, value) {
    const nodes = document.querySelectorAll('[data-stat="' + name + '"]');
    nodes.forEach((node) => {
      const n = Number(value) || 0;
      if (reduced) node.textContent = String(n);
      else countUp(node, n);
    });
  }

  async function loadStats() {
    try {
      const stats = await Vault.stats();
      challengeCount = stats.challenges || challengeCount;
      paintStat("challenges", stats.challenges);
      paintStat("categories", stats.categories);
      paintStat("mediums", stats.mediums);
      paintStat("circles", stats.circles);
      paintStat("solves", stats.solves);

      const eyebrow = document.querySelector("[data-trials-eyebrow]");
      const lead = document.querySelector("[data-trials-lead]");
      if (eyebrow) {
        eyebrow.textContent =
          (stats.categories || 0) + " trials · " + (stats.challenges || 0) + " flags open";
      }
      if (lead) {
        lead.textContent =
          (stats.challenges || 0) +
          " flags across " +
          (stats.categories || 0) +
          " disciplines. Points rise as the room gets colder.";
      }
      return stats;
    } catch (err) {
      console.warn("[stats]", err);
      return null;
    }
  }

  async function renderTrials() {
    const grid = document.getElementById("trialsGrid");
    if (!grid) return;
    try {
      const data = await Vault.catalogue();
      const trials = data.trials || [];
      challengeCount = (data.challenges || []).length || challengeCount;
      if (!trials.length) {
        grid.innerHTML = '<p class="typewriter-note">The trials have not opened yet.</p>';
        return;
      }
      grid.innerHTML = trials
        .map((t, i) => {
          const badge =
            t.category === "misc"
              ? "badge--ember"
              : t.category === "pwn" || t.category === "reversing"
                ? "badge--brass"
                : "badge--spectre";
          return `
        <article class="card trial" data-reveal style="--reveal-delay:${i * 90}ms">
          <header class="trial__head">
            <span class="trial__num">${escapeHtml(t.roman)}</span>
            <span class="badge ${badge}"><i class="badge__dot"></i>${t.flags} flag${
            t.flags === 1 ? "" : "s"
          }</span>
          </header>
          <h3 class="card__title">${escapeHtml(t.trial)}</h3>
          <p class="card__text">${escapeHtml(categoryBlurb(t.category))}</p>
          <footer class="trial__foot">
            <span>${escapeHtml(labelCategory(t.category))}</span>
            <span>${t.minPoints === t.maxPoints ? t.minPoints : t.minPoints + "–" + t.maxPoints} pts</span>
          </footer>
        </article>`;
        })
        .join("");

      /* Re-observe new reveal nodes */
      if (window.Atmosphere || true) {
        grid.querySelectorAll("[data-reveal]").forEach((n) => n.classList.add("is-revealed"));
      }
    } catch (err) {
      grid.innerHTML =
        '<p class="typewriter-note">Could not load the trials. Is the server running?</p>';
      console.warn("[trials]", err);
    }
  }

  function labelCategory(cat) {
    const map = {
      web: "Web",
      crypto: "Crypto",
      forensics: "Forensics",
      reversing: "Reversing",
      pwn: "Pwn",
      misc: "Misc",
    };
    return map[cat] || cat;
  }

  function categoryBlurb(cat) {
    const map = {
      web: "The house has a servant's entrance and nobody remembered to lock it.",
      crypto: "Their letters still arrive, and still refuse to be read.",
      forensics: "Every plate in the album has something behind the emulsion.",
      reversing: "Someone carved instructions into the wood. Follow them backwards.",
      pwn: "Something is leaking out of the medium, writing past the end of her.",
      misc: "The last trial has no hints, and no record of who set it.",
    };
    return map[cat] || "A trial waiting beyond the veil.";
  }

  async function renderLadder() {
    const list = document.getElementById("ladder");
    if (!list || !window.Vault) return;
    try {
      const data = await Vault.leaderboard();
      paintStat("circles", data.circles);
      const rows = data.rows || [];
      if (!rows.length) {
        list.innerHTML =
          '<li class="ladder__empty"><p class="typewriter-note">No circle has scored yet. The board is cold.</p></li>';
        return;
      }
      list.innerHTML = rows
        .slice(0, 10)
        .map(
          (t, i) => `
        <li>
          <span class="ladder__rank">${String(i + 1).padStart(2, "0")}</span>
          <span class="ladder__sigil" aria-hidden="true">${t.sigil}</span>
          <span>
            <span class="ladder__name">${escapeHtml(t.name)}</span>
            <span class="ladder__meta">${t.members} medium${t.members === 1 ? "" : "s"} &middot; ${
            t.solved
          } flag${t.solved === 1 ? "" : "s"}</span>
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
      const user = await Vault.currentUser(true);
      if (!user) return;
      slot.innerHTML = `
      <span class="whoami">
        <span class="whoami__chip"><span aria-hidden="true">${user.teamSigil}</span> ${escapeHtml(
        user.username
      )}</span>
        <a class="btn btn--primary btn--sm" href="dashboard.html">The Table</a>
      </span>`;

      const cta = document.querySelector(".hero__cta");
      if (cta) {
        cta.innerHTML = `
          <a class="btn btn--primary btn--lg" href="dashboard.html">Return to the table</a>
          <a class="btn btn--lg" href="challenges.html">Open the trials</a>`;
      }
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

  async function init() {
    wireQuestions();
    wireAnchors();
    await Promise.all([loadStats(), renderTrials(), renderLadder(), reflectAuth()]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init().catch((err) => console.error(err));
    });
  } else {
    init().catch((err) => console.error(err));
  }
})();
