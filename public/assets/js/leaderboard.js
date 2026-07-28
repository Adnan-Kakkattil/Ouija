/* =========================================================
   OUIJA CTF — Public team leaderboard (silent live refresh)
   ========================================================= */

(function () {
  "use strict";

  const POLL_MS = 5000;
  const FLIP_MS = 380;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let fingerprint = "";
  let rowsById = new Map();
  let pollTimer = null;
  let fetching = false;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
  }

  function rowHtml(t) {
    const top = t.rank === 1 ? " is-top" : "";
    const podium = t.rank <= 3 ? " is-podium" : "";
    return `
      <li class="lb__row${top}${podium}" data-team-id="${escapeHtml(t.id)}" data-rank="${t.rank}">
        <span class="lb__rank">${String(t.rank).padStart(2, "0")}</span>
        <span class="lb__circle">
          <span class="lb__sigil" aria-hidden="true">${escapeHtml(t.sigil || "")}</span>
          <span class="lb__name">${escapeHtml(t.name)}</span>
        </span>
        <span class="lb__meta lb__meta--members" data-field="members">${t.members}</span>
        <span class="lb__meta lb__meta--flags" data-field="solved">${t.solved}</span>
        <span class="lb__score" data-field="score">${t.score}</span>
      </li>`;
  }

  function setStatus(text, mode) {
    const el = document.getElementById("lbStatus");
    const pulse = document.getElementById("lbPulse");
    if (el) el.textContent = text;
    if (pulse) {
      pulse.classList.toggle("is-stale", mode === "stale");
      pulse.classList.toggle("is-error", mode === "error");
    }
  }

  function paintStats(rows, circles) {
    const top = rows[0];
    const flags = rows.reduce((n, r) => n + (r.solved || 0), 0);
    const cEl = document.getElementById("lbCircles");
    const sEl = document.getElementById("lbTopScore");
    const fEl = document.getElementById("lbFlags");
    if (cEl) cEl.textContent = String(circles != null ? circles : rows.length);
    if (sEl) sEl.textContent = top ? String(top.score) : "0";
    if (fEl) fEl.textContent = String(flags);
  }

  function snapshot(rows) {
    return rows.map((r) => [r.id, r.rank, r.score, r.solved, r.members].join(":")).join("|");
  }

  function measureTops(list) {
    const map = new Map();
    list.querySelectorAll(".lb__row").forEach((el) => {
      map.set(el.getAttribute("data-team-id"), el.getBoundingClientRect().top);
    });
    return map;
  }

  function playFlip(list, before) {
    if (reduced || !before.size) return;
    list.querySelectorAll(".lb__row").forEach((el) => {
      const id = el.getAttribute("data-team-id");
      const prev = before.get(id);
      if (prev == null) return;
      const next = el.getBoundingClientRect().top;
      const dy = prev - next;
      if (Math.abs(dy) < 1) return;
      el.style.transition = "none";
      el.style.transform = "translateY(" + dy + "px)";
      el.classList.add("is-moving");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = "transform " + FLIP_MS + "ms cubic-bezier(.2,.7,.2,1)";
          el.style.transform = "";
          setTimeout(() => {
            el.style.transition = "";
            el.classList.remove("is-moving");
          }, FLIP_MS + 40);
        });
      });
    });
  }

  function bump(el) {
    if (!el || reduced) return;
    el.classList.remove("is-bump");
    void el.offsetWidth;
    el.classList.add("is-bump");
    setTimeout(() => el.classList.remove("is-bump"), 420);
  }

  function patchRow(el, t) {
    const rankEl = el.querySelector(".lb__rank");
    const scoreEl = el.querySelector('[data-field="score"]');
    const solvedEl = el.querySelector('[data-field="solved"]');
    const membersEl = el.querySelector('[data-field="members"]');
    const prevScore = rowsById.get(t.id) ? rowsById.get(t.id).score : null;

    if (rankEl) rankEl.textContent = String(t.rank).padStart(2, "0");
    if (membersEl) membersEl.textContent = String(t.members);
    if (solvedEl) solvedEl.textContent = String(t.solved);
    if (scoreEl) {
      if (prevScore != null && prevScore !== t.score) bump(scoreEl);
      scoreEl.textContent = String(t.score);
    }

    el.setAttribute("data-rank", String(t.rank));
    el.classList.toggle("is-top", t.rank === 1);
    el.classList.toggle("is-podium", t.rank <= 3);
  }

  function render(rows, circles) {
    const list = document.getElementById("lbList");
    const empty = document.getElementById("lbEmpty");
    if (!list) return;

    paintStats(rows, circles);

    if (!rows.length) {
      list.innerHTML = "";
      if (empty) empty.hidden = false;
      rowsById = new Map();
      fingerprint = "";
      return;
    }
    if (empty) empty.hidden = true;

    const nextFp = snapshot(rows);
    if (nextFp === fingerprint && list.children.length === rows.length) {
      return;
    }

    const before = measureTops(list);
    const existing = new Map();
    list.querySelectorAll(".lb__row").forEach((el) => {
      existing.set(el.getAttribute("data-team-id"), el);
    });

    const frag = document.createDocumentFragment();
    const seen = new Set();

    rows.forEach((t) => {
      seen.add(t.id);
      let el = existing.get(t.id);
      if (el) {
        patchRow(el, t);
      } else {
        const wrap = document.createElement("div");
        wrap.innerHTML = rowHtml(t).trim();
        el = wrap.firstElementChild;
      }
      frag.appendChild(el);
    });

    existing.forEach((el, id) => {
      if (!seen.has(id)) el.remove();
    });

    list.appendChild(frag);
    playFlip(list, before);

    rowsById = new Map(rows.map((r) => [r.id, r]));
    fingerprint = nextFp;
  }

  async function fetchBoard() {
    if (fetching || !window.Vault) return;
    fetching = true;
    try {
      const data = await Vault.leaderboard({ all: true });
      const rows = data.rows || [];
      render(rows, data.circles);
      setStatus("Live · ranks update as flags are claimed", "ok");
    } catch (err) {
      console.warn("[leaderboard]", err);
      setStatus("Board whisper interrupted — retrying…", "error");
    } finally {
      fetching = false;
    }
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(fetchBoard, POLL_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") fetchBoard();
    });
  }

  async function reflectAuth() {
    const slot = document.querySelector("[data-auth-actions]");
    if (!slot || !window.Vault) return;
    try {
      const user = await Vault.currentUser(true);
      if (!user) return;
      slot.innerHTML =
        '<span class="whoami"><span class="whoami__chip"><span aria-hidden="true">' +
        escapeHtml(user.teamSigil || "") +
        "</span> " +
        escapeHtml(user.username) +
        '</span><a class="btn btn--primary btn--sm" href="dashboard.html">The Table</a></span>';
    } catch (_) {
      /* public page — ignore */
    }
  }

  function wireNav() {
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.getElementById("nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  async function boot() {
    wireNav();
    reflectAuth();
    setStatus("Listening to the board…", "stale");
    await fetchBoard();
    startPolling();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
