/* Dashboard behaviour — rooms + live progress from MongoDB */

(function () {
  "use strict";

  const ANSWERS = {
    GOODBYE: "GOODBYE",
    "WHERE IS THE FLAG": "OPEN THE ROOMS",
  };

  let goodbyeCount = 0;
  let goodbyeWindow = 0;

  async function boot() {
    const user = await Vault.requireAuth("login.html");
    if (!user) return;

    const gated = await Vault.playIntro(user, () => {
      location.reload();
    });
    if (gated) return;

    paintUser(user);

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      try {
        await Vault.logout();
      } catch (_) {
        /* still leave */
      }
      Vault.go("index.html");
    });

    wireBoard();
    document.getElementById("replayRite").addEventListener("click", () => {
      if (!window.FirstRite) return;
      FirstRite.play({ force: true });
    });
    await Promise.all([loadRooms(user), loadLadder(), loadLedger(user)]);
  }

  function paintUser(user) {
    document.getElementById("userName").textContent = user.username;
    document.getElementById("userTeam").textContent =
      user.teamSigil + "  " + user.teamName + " — rest your hands on the planchette.";
    document.getElementById("userScore").textContent = String(user.score || 0);
    document.getElementById("userSolved").textContent = String(
      (user.solved && user.solved.length) || user.solvedCount || 0
    );
    const tp = user.teamProgress || {};
    const teamScore = document.getElementById("teamScore");
    const teamSolved = document.getElementById("teamSolved");
    if (teamScore) teamScore.textContent = String(tp.score != null ? tp.score : user.score || 0);
    if (teamSolved)
      teamSolved.textContent = String(
        tp.solvedCount != null
          ? tp.solvedCount
          : (user.solved && user.solved.length) || user.solvedCount || 0
      );
  }

  function wireBoard() {
    const stage = document.getElementById("dashBoard");
    document.querySelectorAll("[data-ask]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!stage || !stage.ouija) return;
        const key = btn.dataset.ask;
        if (key === "GOODBYE") {
          const now = Date.now();
          if (now - goodbyeWindow > 60000) {
            goodbyeCount = 0;
            goodbyeWindow = now;
          }
          goodbyeCount += 1;
          if (goodbyeCount >= 3) {
            stage.ouija.spell("NEVERLEAVETHEBOARDOPEN", { dwell: 280 });
            Atmosphere.toast("Something spelled a longer farewell…", "success", 4000);
            goodbyeCount = 0;
            return;
          }
        }
        stage.ouija.stop();
        stage.ouija.spell(ANSWERS[key] || key, { dwell: 400 });
      });
    });
  }

  function statusLabel(room) {
    if (room.status === "sealed") return "Sealed";
    if (room.status === "locked") return "Locked";
    if (room.status === "cleared") return "Cleared";
    if (room.status === "in_progress") return "In progress";
    return "Open";
  }

  function actionLabel(room) {
    if (room.action === "start") return "Start room";
    if (room.action === "continue") return "Continue";
    if (room.action === "restart") return "Enter again";
    if (room.action === "sealed") return "Not yet open";
    return "Locked";
  }

  function paintRooms(rooms) {
    const grid = document.getElementById("roomsGrid");
    if (!grid) return;
    if (!rooms.length) {
      grid.innerHTML = '<p class="typewriter-note">No chambers answer.</p>';
      return;
    }

    grid.innerHTML = rooms
      .map((r) => {
        const locked = r.status === "locked" || r.status === "sealed";
        const pct = r.totalChallenges
          ? Math.round((r.solvedChallenges / r.totalChallenges) * 100)
          : 0;
        const body = `
          <div class="room-card__top">
            <span class="badge ${
              locked
                ? "badge--ember"
                : r.status === "cleared"
                  ? "badge--spectre"
                  : "badge--brass"
            }">${statusLabel(r)}</span>
            <span class="room-card__pts">${r.pointsPerChallenge} pts / flag</span>
          </div>
          <p class="room-card__num">Room ${r.number}</p>
          <h3 class="room-card__title">${escapeHtml(r.title)}</h3>
          <p class="room-card__lede">${escapeHtml(r.lede)}</p>
          <div class="room-card__progress" aria-hidden="true">
            <span style="width:${pct}%"></span>
          </div>
          <p class="room-card__meta">
            ${
              r.sealed
                ? "Awaiting the house"
                : r.solvedChallenges + " / " + r.totalChallenges + " challenges"
            }
            · ${r.earnedPoints} / ${r.totalPoints} pts
          </p>
          <span class="btn ${locked ? "btn--ghost" : "btn--primary"} btn--block room-card__cta">${actionLabel(
            r
          )}</span>`;

        if (locked) {
          return `<article class="room-card is-locked" aria-disabled="true">${body}</article>`;
        }
        return `<a class="room-card ${r.status === "cleared" ? "is-cleared" : ""} ${
          r.isCurrent ? "is-current" : ""
        }" href="${escapeHtml(r.href)}">${body}</a>`;
      })
      .join("");

    const focus =
      rooms.find((r) => r.isCurrent && r.unlocked && !r.sealed) ||
      rooms.find((r) => r.unlocked && r.status === "in_progress") ||
      rooms.find((r) => r.unlocked && r.status === "open") ||
      rooms.find((r) => r.unlocked && !r.sealed) ||
      null;

    const nextTitle = document.getElementById("nextTitle");
    const nextDesc = document.getElementById("nextDesc");
    const nextLink = document.getElementById("nextLink");
    if (!focus) {
      nextTitle.textContent = "Doors sealed";
      nextDesc.textContent = "Offer the first key, or wait for the house to open deeper chambers.";
      nextLink.href = "dashboard.html";
      nextLink.textContent = "Stay at the table";
      return;
    }
    nextTitle.textContent = "Room " + focus.number + " · " + focus.title;
    nextDesc.textContent =
      focus.solvedChallenges +
      "/" +
      focus.totalChallenges +
      " cleared · " +
      focus.pointsPerChallenge +
      " pts each";
    nextLink.href = focus.href;
    nextLink.textContent = actionLabel(focus);
  }

  async function loadRooms() {
    try {
      const data = await Vault.rooms();
      paintRooms(data.rooms || []);
      if (data.user) paintUser(data.user);
    } catch (err) {
      const grid = document.getElementById("roomsGrid");
      if (grid) {
        grid.innerHTML =
          '<p class="typewriter-note">' +
          escapeHtml(err.message || "Could not read the doors.") +
          ' <button type="button" class="btn btn--ghost btn--sm" id="retryRooms">Try again</button></p>';
        const retry = document.getElementById("retryRooms");
        if (retry) retry.addEventListener("click", () => loadRooms());
      }
      if (window.Atmosphere) {
        Atmosphere.toast(err.message || "Rooms could not be loaded.", "error", 4000);
      }
    }
  }

  function paintLedger(entries, totals) {
    const list = document.getElementById("dashLedger");
    const totalsEl = document.getElementById("ledgerTotals");
    if (!list) return;

    if (totalsEl) {
      totalsEl.textContent =
        "Gained +" + (totals.earned || 0) + " · Spent −" + (totals.spent || 0);
    }

    const rows = entries || [];
    if (!rows.length) {
      list.innerHTML =
        '<li class="ladder__empty"><p class="typewriter-note">No movements yet.</p></li>';
      return;
    }

    list.innerHTML = rows
      .slice(0, 8)
      .map((e) => {
        const plus = e.delta >= 0;
        const label =
          e.kind === "hint" ? "Hint" : e.kind === "solve" ? "Solve" : e.kind || "Move";
        const challenge = e.challengeId ? " · " + e.challengeId : "";
        return `
        <li>
          <span class="ladder__rank">${plus ? "+" : "−"}</span>
          <span>
            <span class="ladder__name">${escapeHtml(label)}${escapeHtml(challenge)}</span>
            <span class="ladder__meta">${escapeHtml(e.note || "")}</span>
          </span>
          <span class="ladder__score ${plus ? "is-gain" : "is-loss"}">${
            plus ? "+" : ""
          }${e.delta}</span>
        </li>`;
      })
      .join("");
  }

  async function loadLedger(user) {
    try {
      if (user && user.pointLedger) {
        paintLedger(user.pointLedger, {
          earned: user.pointsEarned || 0,
          spent: user.pointsSpent || user.hintPointsSpent || 0,
        });
      }
      const data = await Vault.pointLedger(50);
      paintLedger(data.entries || [], data.totals || {});
    } catch {
      /* ignore */
    }
  }

  async function loadLadder() {
    const list = document.getElementById("dashLadder");
    try {
      const data = await Vault.leaderboard();
      const rows = data.rows || [];
      if (!rows.length) {
        list.innerHTML =
          '<li class="ladder__empty"><p class="typewriter-note">The board is cold.</p></li>';
        return;
      }
      list.innerHTML = rows
        .slice(0, 5)
        .map(
          (t, i) => `
        <li>
          <span class="ladder__rank">${String(i + 1).padStart(2, "0")}</span>
          <span>
            <span class="ladder__name">${escapeHtml(t.name)}</span>
            <span class="ladder__meta">${t.members} medium${t.members === 1 ? "" : "s"} · ${
            t.solved
          } flags</span>
          </span>
          <span class="ladder__score">${t.score}</span>
        </li>`
        )
        .join("");
    } catch {
      /* ignore */
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
  }

  boot().catch((err) => {
    console.error(err);
    if (window.Atmosphere) Atmosphere.toast("Could not open the table.", "error");
  });
})();
