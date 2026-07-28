/* =========================================================
   OUIJA CTF — Room transition gate (video → story reveal)
   Used when entering a newly unlocked chamber for the first time.
   ========================================================= */

(function () {
  "use strict";

  const ROOM_INTROS = {
    "room-2": {
      video: "assets/video/challenge2Precredit.mp4",
      eyebrow: "Room II · The trail downstairs",
      title: "Olivia's investigation room",
      veilLede: "The house opens another door. Watch closely.",
      veilCta: "Continue downstairs",
      cta: "Enter Room 2 Challenges",
      next: "room.html#room-2",
      prose: [
        "After uncovering the clues in the living room, the investigators notice a trail of torn notebook pages leading downstairs. They follow the trail to a room whose door has been forced open.",
        "Unlike the rest of the mansion, this room doesn't belong to the original house.",
        "Someone had been living and working here.",
        "A desk is covered with newspaper clippings, maps of the mansion, handwritten notes, and photographs connected with pieces of red string. An old camera lies shattered on the floor beside a broken flashlight. A laptop sits open with a damaged hard drive, while an audio recorder remains beside an overturned chair. The room looks as if someone searched it in a hurry, leaving papers scattered everywhere.",
        "As they carefully examine the room, they discover:",
      ],
      finds: [
        { glyph: "📰", text: "A missing newspaper article about the mansion — publication name torn off." },
        { glyph: "📖", text: "Olivia's encrypted investigation journal." },
        { glyph: "🎙️", text: "A voice recorder with Olivia's damaged audio — something hidden inside the WAV." },
        { glyph: "📦", text: "Olivia's password-locked final report — a web archive pointing beneath the house." },
        { glyph: "💻", text: "An old investigation website stored on Olivia's laptop, containing restricted case files." },
      ],
      closing: [
        "Every clue reveals another piece of Olivia's final investigation.",
        "She had uncovered something important.",
      ],
    },
    "room-3": {
      video: null,
      eyebrow: "Room III · The Basement",
      title: "The Basement",
      veilLede: "The key from Olivia's room turns in the lock. Cold air waits below.",
      veilCta: "Open the basement door",
      cta: "Continue to the circle",
      next: "room.html#room-3",
      requiresKey: true,
      keyChallengeId: "basement-key",
      keyTitle: "What is the key?",
      keyLede:
        "The ritual circle will not yield its trials until the forgotten word is spoken.",
      keyPlaceholder: "············",
      keySubmit: "Offer the key",
      keyHintPrompt: "Ask for a hint (−10 pts)",
      prose: [
        "Using the key recovered from Olivia's investigation room, the investigators unlock the heavy basement door. As it slowly opens, a freezing gust of air rushes past them. The silence is overwhelming.",
        "The basement has remained untouched for decades.",
        "Ancient ritual symbols are carved into the stone walls. Melted candles surround a large ritual circle drawn on the floor, as if the ceremony had been abandoned in the middle of its final step. In the centre rests an old Ouija board, covered in dust but strangely untouched by time.",
        "Near the ritual circle lies Olivia's backpack. Its contents are scattered across the floor, suggesting she searched desperately for something before her final moments. Beneath a loose stone, the investigators discover the missing ritual paper that Olivia had lost. Beside it are several ancient manuscripts, a faded family photograph, and a pendant engraved with the name of the girl whose spirit has remained trapped in the mansion for years.",
        "As they carefully search the basement, they discover:",
      ],
      finds: [
        {
          glyph: "📜",
          text: "Olivia's missing ritual paper containing the forgotten chant.",
        },
        {
          glyph: "📓",
          text: "An encrypted spirit journal backup hidden among Olivia's scattered belongings.",
        },
      ],
      closing: [
        "Gather around the Ouija board. Recite the forgotten chant. Speak the spirit's true name.",
        "Guide the planchette to GOODBYE — and finish what Olivia could not.",
      ],
    },
  };

  function hardenVideo(video) {
    if (!video) return;
    video.controls = false;
    video.disablePictureInPicture = true;
    video.disableRemotePlayback = true;
    video.setAttribute("disablepictureinpicture", "");
    video.setAttribute("disableremoteplayback", "");
    video.setAttribute("controlslist", "nodownload nofullscreen noremoteplayback");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    try {
      video.removeAttribute("controls");
    } catch (_) {
      /* ignore */
    }
  }

  function requestDomFullscreen(el) {
    const target = el || document.documentElement;
    const req =
      target.requestFullscreen ||
      target.webkitRequestFullscreen ||
      target.msRequestFullscreen;
    if (!req) return Promise.resolve(false);
    return req
      .call(target)
      .then(() => true)
      .catch(() => false);
  }

  function exitDomFullscreen() {
    const doc = document;
    if (!doc.fullscreenElement && !doc.webkitFullscreenElement) return;
    const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
    if (exit) {
      try {
        exit.call(doc);
      } catch (_) {
        /* ignore */
      }
    }
  }

  function buildRoot(cfg) {
    const root = document.createElement("div");
    root.className = "gate";
    root.id = "roomGate";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", cfg.title);

    const finds = (cfg.finds || [])
      .map(
        (f) =>
          `<li><span class="gate-reveal__glyph" aria-hidden="true">${f.glyph}</span> ${f.text}</li>`
      )
      .join("");
    const prose = (cfg.prose || [])
      .map((p) => `<p class="gate-reveal__prose">${p}</p>`)
      .join("");
    const closing = (cfg.closing || [])
      .map((p) => `<p class="gate-reveal__prose">${p}</p>`)
      .join("");

    root.innerHTML = `
      <video class="gate__video" id="roomGateVideo" playsinline webkit-playsinline
             preload="auto" disablepictureinpicture disableremoteplayback
             controlslist="nodownload nofullscreen noremoteplayback"></video>
      <div class="gate__veil" id="roomGateVeil">
        <p class="eyebrow">${cfg.eyebrow}</p>
        <h2 class="gate__title">${cfg.title}</h2>
        <p class="gate__lede">${cfg.veilLede || "The house opens another door. Watch closely."}</p>
        <button class="btn btn--primary btn--lg" type="button" id="roomGateBegin">
          ${cfg.veilCta || "Continue"}
        </button>
      </div>
      <div class="gate__chrome" hidden id="roomGateChrome">
        <button class="gate__pause" type="button" id="roomGatePause" aria-label="Pause">Pause</button>
      </div>
      <div class="gate__reveal" hidden id="roomGateReveal">
        <div class="gate-reveal" role="document">
          <p class="gate-reveal__eyebrow">${cfg.eyebrow}</p>
          <h2 class="gate-reveal__title">${cfg.title}</h2>
          <div class="gate-reveal__scroll">
            ${prose}
            <ul class="gate-reveal__finds">${finds}</ul>
            ${closing}
          </div>
          <div class="gate-reveal__actions">
            <button class="btn btn--primary btn--lg" type="button" id="roomGateEnter">
              ${cfg.cta}
            </button>
          </div>
        </div>
      </div>
      <div class="gate__modal" hidden id="roomGateKeyModal">
        <div class="gate__blur" aria-hidden="true"></div>
        <div class="burn-sheet" role="document">
          <p class="burn-sheet__eyebrow">${cfg.eyebrow}</p>
          <h2 class="burn-sheet__title">${cfg.keyTitle || "What is the key?"}</h2>
          <p class="burn-sheet__lede">
            ${cfg.keyLede || "Speak the word the basement still remembers."}
          </p>
          <form class="burn-sheet__form" id="roomGateKeyForm" autocomplete="off">
            <label class="burn-sheet__label" for="roomGateKey">The key</label>
            <input class="burn-sheet__input" id="roomGateKey" name="key" type="text"
                   spellcheck="false" autocomplete="off"
                   placeholder="${cfg.keyPlaceholder || "············"}"
                   maxlength="120" required>
            <p class="burn-sheet__error" id="roomGateKeyError" role="alert"></p>
            <button class="btn btn--primary btn--lg burn-sheet__submit" type="submit" id="roomGateKeySubmit">
              ${cfg.keySubmit || "Offer the key"}
            </button>
          </form>
          <button class="btn btn--ghost" type="button" id="roomGateKeyHint" hidden>
            ${cfg.keyHintPrompt || "Ask for a hint"}
          </button>
          <p class="burn-sheet__note" id="roomGateKeyHintText" hidden></p>
        </div>
      </div>
    `;

    const video = root.querySelector("#roomGateVideo");
    hardenVideo(video);
    if (cfg.video) {
      const source = document.createElement("source");
      source.src = cfg.video;
      source.type = "video/mp4";
      video.appendChild(source);
    } else {
      video.hidden = true;
      root.classList.add("is-story-only");
    }
    if (!cfg.requiresKey) {
      const keyModal = root.querySelector("#roomGateKeyModal");
      if (keyModal) keyModal.remove();
    }
    document.body.appendChild(root);
    return root;
  }

  function wireKeyModal(root, cfg, finish) {
    const keyModal = root.querySelector("#roomGateKeyModal");
    if (!keyModal || !cfg.requiresKey) return null;

    const form = root.querySelector("#roomGateKeyForm");
    const input = root.querySelector("#roomGateKey");
    const err = root.querySelector("#roomGateKeyError");
    const submitBtn = root.querySelector("#roomGateKeySubmit");
    const hintBtn = root.querySelector("#roomGateKeyHint");
    const hintText = root.querySelector("#roomGateKeyHintText");
    const challengeId = cfg.keyChallengeId || "basement-key";

    function show() {
      root.querySelector("#roomGateReveal").hidden = true;
      root.querySelector("#roomGateVeil").hidden = true;
      const chrome = root.querySelector("#roomGateChrome");
      if (chrome) chrome.hidden = true;
      keyModal.hidden = false;
      root.classList.add("is-key");
      root.classList.remove("is-reveal", "is-playing");
      if (hintBtn) hintBtn.hidden = false;
      setTimeout(() => input && input.focus(), 80);
    }

    async function unlockHint() {
      if (!window.Vault || !hintBtn) return;
      hintBtn.disabled = true;
      hintBtn.classList.add("is-loading");
      try {
        const data = await Vault.unlockHint(challengeId);
        if (hintText) {
          hintText.hidden = false;
          hintText.textContent = data.hint || data.message || "Answer is in the basement";
        }
        if (window.Atmosphere) Atmosphere.toast(data.message || "Hint unlocked.", "success");
        hintBtn.hidden = true;
      } catch (e) {
        if (err) err.textContent = e.message || "The house withheld the whisper.";
        hintBtn.disabled = false;
      } finally {
        hintBtn.classList.remove("is-loading");
      }
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (err) err.textContent = "";
      const key = (input.value || "").trim();
      if (!key) {
        if (err) err.textContent = "Offer the key.";
        return;
      }
      submitBtn.classList.add("is-loading");
      submitBtn.disabled = true;
      try {
        const data = await Vault.submitFlag(challengeId, key);
        if (window.Atmosphere) Atmosphere.toast(data.message || "The circle accepts the word.", "success");
        finish({ entered: true, keyAccepted: true, user: data.user || null });
      } catch (ex) {
        if (err) err.textContent = ex.message || "The spirits reject that offering.";
        submitBtn.disabled = false;
      } finally {
        submitBtn.classList.remove("is-loading");
      }
    });

    if (hintBtn) hintBtn.addEventListener("click", unlockHint);
    return { show };
  }

  function play(options) {
    const opts = Object.assign({ roomId: "room-2", onDone: null, skipStory: false }, options || {});
    const cfg = ROOM_INTROS[opts.roomId];
    if (!cfg) {
      return Promise.resolve({ skipped: true });
    }

    const hasVideo = !!cfg.video;

    return new Promise((resolve) => {
      const root = buildRoot(cfg);
      const video = root.querySelector("#roomGateVideo");
      const veil = root.querySelector("#roomGateVeil");
      const chrome = root.querySelector("#roomGateChrome");
      const reveal = root.querySelector("#roomGateReveal");
      const beginBtn = root.querySelector("#roomGateBegin");
      const pauseBtn = root.querySelector("#roomGatePause");
      const enterBtn = root.querySelector("#roomGateEnter");
      let finished = false;

      function finish(payload) {
        if (finished) return;
        finished = true;
        exitDomFullscreen();
        root.classList.add("is-leaving");
        setTimeout(() => {
          try {
            root.remove();
          } catch (_) {
            /* ignore */
          }
          const result = Object.assign({ roomId: opts.roomId, next: cfg.next }, payload || {});
          if (typeof opts.onDone === "function") opts.onDone(result);
          resolve(result);
        }, 420);
      }

      const keyUi = wireKeyModal(root, cfg, finish);

      function syncPauseLabel() {
        if (!hasVideo) return;
        const paused = video.paused;
        pauseBtn.textContent = paused ? "Play" : "Pause";
        pauseBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
        root.classList.toggle("is-paused", paused);
      }

      function showPlaying() {
        veil.hidden = true;
        reveal.hidden = true;
        chrome.hidden = false;
        root.classList.add("is-playing");
        root.classList.remove("is-ended", "is-reveal", "is-paused", "is-key");
      }

      function showReveal() {
        if (hasVideo) {
          try {
            video.pause();
          } catch (_) {
            /* ignore */
          }
        }
        chrome.hidden = true;
        veil.hidden = true;
        reveal.hidden = false;
        const keyModal = root.querySelector("#roomGateKeyModal");
        if (keyModal) keyModal.hidden = true;
        root.classList.remove("is-playing", "is-paused", "is-key");
        root.classList.add("is-ended", "is-reveal");
        exitDomFullscreen();
        const scroll = reveal.querySelector(".gate-reveal__scroll");
        if (scroll) scroll.scrollTop = 0;
        setTimeout(() => enterBtn.focus(), 80);
      }

      async function enterFullscreen() {
        const ok = await requestDomFullscreen(root);
        if (!ok) await requestDomFullscreen(document.documentElement);
      }

      async function startPlayback() {
        if (!hasVideo) {
          showReveal();
          return;
        }
        hardenVideo(video);
        video.muted = false;
        video.volume = 1;
        video.controls = false;
        if (video.ended || video.currentTime === 0) video.currentTime = 0;
        showPlaying();
        await enterFullscreen();
        try {
          await video.play();
          syncPauseLabel();
        } catch (err) {
          chrome.hidden = true;
          veil.hidden = false;
          root.classList.remove("is-playing");
          beginBtn.textContent = "Click to play with sound";
          console.warn("[room-gate] autoplay blocked", err);
        }
      }

      async function togglePause() {
        if (!hasVideo || !root.classList.contains("is-playing")) return;
        try {
          if (video.paused) {
            await enterFullscreen();
            await video.play();
          } else {
            video.pause();
          }
        } catch (_) {
          /* ignore */
        }
        syncPauseLabel();
      }

      beginBtn.addEventListener("click", () => startPlayback());
      pauseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePause();
      });
      video.addEventListener("click", (e) => {
        e.preventDefault();
        togglePause();
      });
      video.addEventListener("play", syncPauseLabel);
      video.addEventListener("pause", syncPauseLabel);
      video.addEventListener("ended", () => showReveal());
      video.addEventListener("error", () => {
        if (finished || !hasVideo) return;
        if (window.Atmosphere) Atmosphere.toast("The downstairs vision could not be shown.", "error");
        showReveal();
      });
      enterBtn.addEventListener("click", () => {
        if (cfg.requiresKey && keyUi) {
          keyUi.show();
          return;
        }
        finish({ entered: true });
      });

      root.classList.add("is-open");
      if (opts.skipStory && cfg.requiresKey && keyUi) {
        veil.hidden = true;
        reveal.hidden = true;
        chrome.hidden = true;
        keyUi.show();
      } else if (hasVideo) {
        startPlayback();
      } else {
        veil.hidden = false;
        reveal.hidden = true;
        chrome.hidden = true;
      }
    });
  }

  function needsIntro(user, roomId) {
    if (!user || !roomId) return false;
    const seen = user.roomIntrosSeen || [];
    return seen.indexOf(roomId) === -1;
  }

  function needsKey(user, roomId) {
    if (!user || !roomId) return false;
    const cfg = ROOM_INTROS[roomId];
    if (!cfg || !cfg.requiresKey) return false;
    const keyId = cfg.keyChallengeId || "basement-key";
    const solved = user.solved || [];
    return solved.indexOf(keyId) === -1;
  }

  function askKey(options) {
    const opts = Object.assign({ roomId: "room-3", onDone: null }, options || {});
    return play(Object.assign({}, opts, { skipStory: true }));
  }

  window.RoomGate = {
    INTROS: ROOM_INTROS,
    play,
    askKey,
    needsIntro,
    needsKey,
  };
})();