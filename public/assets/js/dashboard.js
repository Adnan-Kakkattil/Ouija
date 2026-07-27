/* Dashboard behaviour — live user progress from MongoDB */

(function () {
  "use strict";

  const ANSWERS = {
    GOODBYE: "GOODBYE",
    "WHERE IS THE FLAG": "OPEN THE TRIALS",
  };

  let goodbyeCount = 0;
  let goodbyeWindow = 0;

  async function boot() {
    const user = await Vault.requireAuth("login.html");
    if (!user) return;

    /* Resume unfinished Trial I gate if the first key is still unclaimed */
    const gated = await Vault.playIntro(user, () => {
      /* stay on the table after offering the key */
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
    await Promise.all([loadNext(user), loadLadder(), loadLedger(user)]);
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

  async function loadNext(user) {
    try {
      const list = await Vault.challenges();
      const resumeId = user.lastChallengeId;
      const resume = resumeId && list.find((c) => c.id === resumeId);
      const nextUnsolved = list.find((c) => !c.solved);
      const focus = (resume && !resume.solved ? resume : null) || nextUnsolved || resume || list[0];

      if (!focus) {
        document.getElementById("nextTitle").textContent = "All quiet";
        document.getElementById("nextDesc").textContent = "No trials are open.";
        return;
      }

      const remaining = list.filter((c) => !c.solved).length;
      const isResume = !!(resume && focus.id === resume.id);

      document.getElementById("nextTitle").textContent = focus.solved
        ? "All flags claimed"
        : focus.title;
      document.getElementById("nextDesc").textContent = focus.solved
        ? "Your circle has finished every open trial."
        : (isResume ? "Resume · " : "") +
          focus.trial +
          " · " +
          focus.points +
          " pts · " +
          focus.difficulty +
          " · " +
          remaining +
          " left";
      document.getElementById("nextLink").href = "challenges.html#" + focus.id;
      document.getElementById("nextLink").textContent = focus.solved
        ? "Review trials"
        : isResume
          ? "Resume trial"
          : "Begin";
    } catch (err) {
      document.getElementById("nextTitle").textContent = "The trials are sealed";
      document.getElementById("nextDesc").textContent = err.message || "Could not load challenges.";
    }
  }

  function paintLedger(entries, totals) {
    const list = document.getElementById("dashLedger");
    const totalsEl = document.getElementById("ledgerTotals");
    if (!list) return;

    if (totalsEl) {
      totalsEl.textContent =
        "Gained +" +
        (totals.earned || 0) +
        " · Spent −" +
        (totals.spent || 0);
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
          e.kind === "hint"
            ? "Hint"
            : e.kind === "solve"
              ? "Solve"
              : e.kind || "Move";
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
