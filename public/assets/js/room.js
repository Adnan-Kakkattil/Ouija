/* Room chamber page — challenges for one mansion room */

(function () {
  "use strict";

  let roomId = null;
  let room = null;
  let challenges = [];
  let activeId = null;
  let currentUser = null;

  function roomIdFromLocation() {
    const hash = location.hash.replace("#", "").trim();
    if (hash.indexOf("room-") === 0) return hash;
    const q = new URLSearchParams(location.search).get("room");
    return q || "room-1";
  }

  async function boot() {
    const user = await Vault.requireAuth("login.html");
    if (!user) return;
    currentUser = user;
    document.getElementById("headerChip").textContent =
      (user.teamSigil || "") + " " + user.username + " · " + (user.score || 0) + " pts";

    roomId = roomIdFromLocation();
    await loadRoom(roomId);

    document.getElementById("submitFlag").addEventListener("click", submitFlag);
    document.getElementById("unlockHintBtn").addEventListener("click", unlockHint);
    window.addEventListener("hashchange", async () => {
      roomId = roomIdFromLocation();
      await loadRoom(roomId);
    });
  }

  async function maybePlayRoomIntro(data) {
    if (!window.RoomGate || !data.room || !data.user) return false;
    if (!RoomGate.needsIntro(data.user, data.room.id)) return false;
    if (!RoomGate.INTROS[data.room.id]) return false;

    const grid = document.getElementById("roomChallengeGrid");
    if (grid) {
      grid.innerHTML = '<p class="typewriter-note">The downstairs trail opens…</p>';
    }

    await RoomGate.play({ roomId: data.room.id });
    try {
      const marked = await Vault.markRoomIntro(data.room.id);
      if (marked.user) currentUser = marked.user;
    } catch (err) {
      console.warn("[room] intro mark failed", err);
    }
    return true;
  }

  async function loadRoom(id) {
    try {
      const data = await Vault.room(id);
      room = data.room;
      challenges = data.challenges || [];
      if (data.user) {
        currentUser = data.user;
        document.getElementById("headerChip").textContent =
          (data.user.teamSigil || "") +
          " " +
          data.user.username +
          " · " +
          (data.user.score || 0) +
          " pts";
      }

      await maybePlayRoomIntro(data);

      paintRoom();
      paintChallenges();

      const challengeId = new URLSearchParams(location.search).get("c");
      if (challengeId && challenges.some((c) => c.id === challengeId && !c.pending)) {
        openModal(challengeId);
      }
    } catch (err) {
      document.getElementById("roomTitle").textContent = "Door sealed";
      document.getElementById("roomLede").textContent =
        err.message || "This chamber will not open yet.";
      document.getElementById("roomChallengeGrid").innerHTML =
        '<p class="typewriter-note"><a href="dashboard.html">Return to the table</a></p>';
      document.getElementById("roomActions").innerHTML = "";
      if (window.Atmosphere) Atmosphere.toast(err.message || "Room locked.", "error");
    }
  }

  function paintRoom() {
    if (!room) return;
    document.title = "Room " + room.number + " — OUIJA CTF";
    document.getElementById("roomEyebrow").textContent =
      "Room " + room.number + " · " + room.pointsPerChallenge + " pts per flag";
    document.getElementById("roomTitle").textContent = room.title;
    document.getElementById("roomLede").textContent = room.lede;
    document.getElementById("roomMeta").textContent =
      room.solvedChallenges +
      " / " +
      room.totalChallenges +
      " challenges · " +
      room.earnedPoints +
      " / " +
      room.totalPoints +
      " pts";

    const actions = document.getElementById("roomActions");
    const startLabel =
      room.action === "continue"
        ? "Continue"
        : room.action === "restart"
          ? "Restart from first"
          : "Start room";

    let nextBtn = "";
    if (room.complete && room.nextRoomHref) {
      nextBtn =
        '<button class="btn btn--primary btn--lg" type="button" id="moveNextRoom">Move to Room ' +
        room.nextRoomNumber +
        "</button>";
    }

    actions.innerHTML =
      nextBtn +
      `
      <button class="btn ${room.complete ? "btn--ghost" : "btn--primary"}" type="button" data-mode="${
        room.action === "restart" ? "restart" : room.action === "continue" ? "continue" : "start"
      }" id="roomPrimary">${startLabel}</button>
      <button class="btn btn--ghost" type="button" data-mode="restart" id="roomRestart">Restart</button>
      <a class="btn btn--ghost" href="dashboard.html">Back to rooms</a>
    `;
    actions.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => enterRoom(btn.dataset.mode));
    });
    const move = document.getElementById("moveNextRoom");
    if (move) {
      move.addEventListener("click", () => {
        Vault.go(room.nextRoomHref, { instant: true });
      });
    }
  }

  async function enterRoom(mode) {
    try {
      const data = await Vault.focusRoom(room.id, mode);
      const focusId = data.focusChallengeId;
      const focus = challenges.find((c) => c.id === focusId);
      if (focus && focus.pending) {
        Atmosphere.toast("That clue is not yet restored.", "error");
        return;
      }
      if (focusId) openModal(focusId);
      else Atmosphere.toast("No challenges in this chamber yet.", "error");
    } catch (err) {
      Atmosphere.toast(err.message || "Could not enter the room.", "error");
    }
  }

  function paintChallenges() {
    const grid = document.getElementById("roomChallengeGrid");
    if (!challenges.length) {
      grid.innerHTML =
        '<p class="typewriter-note">This chamber holds no open trials yet. Return when the house shifts.</p>';
      return;
    }
    grid.innerHTML = challenges
      .map((c, i) => {
        const badge = c.solved
          ? "Claimed"
          : c.pending
            ? "Sealed"
            : String(i + 1).padStart(2, "0");
        const badgeClass = c.solved
          ? "badge--spectre"
          : c.pending
            ? "badge--ember"
            : "badge--brass";
        return `
      <button type="button" class="card challenge-card ${c.solved ? "is-solved" : ""} ${
          c.pending ? "is-pending" : ""
        }" data-open="${c.id}">
        <div class="challenge-card__top">
          <span class="badge ${badgeClass}">${badge}</span>
          <span class="challenge-card__points">${c.points}</span>
        </div>
        <h3 class="card__title">${escapeHtml(c.title)}</h3>
        <p class="card__text">${escapeHtml(c.category)} · ${escapeHtml(c.difficulty)}${
          c.pending ? " · evidence pending" : ""
        }</p>
      </button>`;
      })
      .join("");

    grid.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => openModal(btn.dataset.open));
    });
  }

  function paintArtifact(c) {
    const box = document.getElementById("artifactBox");
    const link = document.getElementById("artifactLink");
    const note = document.getElementById("artifactNote");
    if (!box || !link) return;
    if (!c.artifactUrl) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    link.href = c.artifactUrl;
    link.textContent = c.artifactLabel || "Download evidence";
    if (/\.(zip|wav|txt|png|jpe?g|gif|webp)$/i.test(c.artifactUrl)) {
      link.setAttribute("download", c.artifactUrl.split("/").pop());
    } else {
      link.removeAttribute("download");
    }
    if (note) {
      if (c.id === "room3-1") {
        note.textContent = "No download — dig through Heizal's public GitHub history for what she deleted.";
      } else if (c.id === "room2-5") {
        note.textContent = "Open the portal. Public IDs are listed — try neighbouring record numbers.";
      } else if (c.id === "room2-4") {
        note.textContent = "Download the WAV. Carve or binwalk — a file is appended after the audio.";
      } else if (c.id === "room2-3") {
        note.textContent = "Unlock the ZIP with clues from Room 2 challenges 1 and 2.";
      } else if (c.id === "room2-2") {
        note.textContent = "Download the notebook page. A small Caesar shift unlocks her words.";
      } else if (c.id === "room2-1") {
        note.textContent = "Download the torn clipping. Identify the paper, then find its archive.";
      } else if (c.id === "room1-8") {
        note.textContent = "Open the archive. Base64 is only the first veil — XOR waits beneath.";
      } else if (c.id === "room1-7") {
        note.textContent = "Dictionary-attack the ZIP password on the USB archive.";
      } else if (c.id === "room1-6") {
        note.textContent = "Download the WAV. The whisper is hidden inside the audio itself.";
      } else if (c.id === "room1-5") {
        note.textContent = "Crack the MD5 clasp, then unlock this ZIP with the recovered word.";
      } else {
        note.textContent = "Save a copy of the evidence for your circle.";
      }
    }
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
      : "Easy −10 · Medium −20 · Hard −30.";
  }

  function openModal(id) {
    const c = challenges.find((x) => x.id === id);
    if (!c) return;
    activeId = id;
    document.getElementById("modalTrial").textContent = c.trial + " · " + c.roman;
    document.getElementById("modalTitle").textContent = c.title;
    document.getElementById("modalMeta").textContent =
      c.points +
      " pts · " +
      c.category +
      " · " +
      c.difficulty +
      (c.solved ? " · claimed" : c.pending ? " · evidence pending" : "");
    document.getElementById("modalDesc").textContent = c.description;
    paintArtifact(c);
    paintHint(c);

    const flagField = document.querySelector('[data-field="flag"]');
    const flagInput = document.getElementById("flagInput");
    const submitBtn = document.getElementById("submitFlag");
    const err = document.getElementById("flagError");
    flagInput.value = "";
    err.textContent = "";
    flagField.classList.remove("has-error");

    if (c.pending) {
      flagInput.disabled = true;
      submitBtn.disabled = true;
      err.textContent = "This clue is catalogued, but the evidence is not yet restored.";
      if (document.getElementById("hintBox")) document.getElementById("hintBox").hidden = true;
    } else {
      flagInput.disabled = !!c.solved;
      submitBtn.disabled = !!c.solved;
    }

    document.getElementById("challengeModal").showModal();
    if (!c.pending) Vault.focusChallenge(id).catch(() => {});
  }

  async function unlockHint() {
    if (!activeId) return;
    const btn = document.getElementById("unlockHintBtn");
    btn.classList.add("is-loading");
    btn.disabled = true;
    try {
      const data = await Vault.unlockHint(activeId);
      Atmosphere.toast(data.message || "Hint unlocked.", "success");
      await loadRoom(roomId);
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
      document.getElementById("challengeModal").close();
      await loadRoom(roomId);

      const user = data.user || (await Vault.currentUser(true));
      if (user && user.lastChallengeId && challenges.some((c) => c.id === user.lastChallengeId)) {
        const next = challenges.find((c) => c.id === user.lastChallengeId);
        if (next && !next.solved) {
          setTimeout(() => openModal(next.id), 450);
        }
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
    if (window.Atmosphere) Atmosphere.toast("Could not open the chamber.", "error");
  });
})();
