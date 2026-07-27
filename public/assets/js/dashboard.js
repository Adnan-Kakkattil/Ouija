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
    await Promise.all([loadNext(user), loadLadder()]);
  }

  function paintUser(user) {
    document.getElementById("userName").textContent = user.username;
    document.getElementById("userTeam").textContent =
      user.teamSigil + "  " + user.teamName + " — rest your hands on the planchette.";
    document.getElementById("userScore").textContent = String(user.score || 0);
    document.getElementById("userSolved").textContent = String(
      (user.solved && user.solved.length) || user.solvedCount || 0
    );
    document.getElementById("userCircle").textContent = user.teamName;
    const logins = document.getElementById("userLogins");
    if (logins) logins.textContent = String(user.loginCount || 0);
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
      if (!next) {
        document.getElementById("nextTitle").textContent = "All quiet";
        document.getElementById("nextDesc").textContent = "No trials are open.";
        return;
      }
      const remaining = list.filter((c) => !c.solved).length;
      document.getElementById("nextTitle").textContent = next.solved
        ? "All flags claimed"
        : next.title;
      document.getElementById("nextDesc").textContent = next.solved
        ? "Your circle has finished every open trial."
        : next.trial +
          " · " +
          next.points +
          " pts · " +
          next.difficulty +
          " · " +
          remaining +
          " left";
      document.getElementById("nextLink").href = "challenges.html#" + next.id;
      document.getElementById("nextLink").textContent = next.solved ? "Review trials" : "Begin";
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
