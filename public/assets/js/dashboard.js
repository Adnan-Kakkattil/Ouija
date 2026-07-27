/* Dashboard behaviour */

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

    document.getElementById("userName").textContent = user.username;
    document.getElementById("userTeam").textContent =
      user.teamSigil + "  " + user.teamName + " — rest your hands on the planchette.";
    document.getElementById("userScore").textContent = String(user.score || 0);
    document.getElementById("userSolved").textContent = String((user.solved || []).length);
    document.getElementById("userCircle").textContent = user.teamName;

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await Vault.logout();
      Atmosphere.leaveTo("index.html");
    });

    wireBoard();
    await loadNext(user);
    await loadLadder();
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
      const next = list.find((c) => !c.solved) || list[0];
      if (!next) return;
      document.getElementById("nextTitle").textContent = next.title;
      document.getElementById("nextDesc").textContent =
        next.trial + " · " + next.points + " pts · " + next.difficulty;
      document.getElementById("nextLink").href = "challenges.html#" + next.id;
    } catch (err) {
      document.getElementById("nextTitle").textContent = "The trials are sealed";
      document.getElementById("nextDesc").textContent = err.message || "Could not load challenges.";
    }
  }

  async function loadLadder() {
    const list = document.getElementById("dashLadder");
    try {
      const data = await Vault.leaderboard();
      const rows = data.rows || [];
      if (!rows.length) return;
      list.innerHTML = rows
        .slice(0, 5)
        .map(
          (t, i) => `
        <li>
          <span class="ladder__rank">${String(i + 1).padStart(2, "0")}</span>
          <span>
            <span class="ladder__name">${escapeHtml(t.name)}</span>
            <span class="ladder__meta">${t.score} pts</span>
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
    Atmosphere.toast("Could not open the table.", "error");
  });
})();
