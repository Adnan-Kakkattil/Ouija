/* =========================================================
   OUIJA CTF — Challenge I gate (burned paper key)
   Fullscreen prevideo → blurred Ouija modal asking for the key.
   ========================================================= */

(function () {
  "use strict";

  const SRC = "assets/video/challenge1Prevideo.mp4";
  const CHALLENGE_ID = "whisper-1";

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

  function buildRoot() {
    const root = document.createElement("div");
    root.className = "gate";
    root.id = "firstGate";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Challenge I — Burned Paper");
    root.innerHTML = `
      <video class="gate__video" id="gateVideo" playsinline preload="auto"></video>
      <div class="gate__veil" id="gateVeil">
        <p class="eyebrow">Trial I · The game begins</p>
        <h2 class="gate__title">The burned leaf</h2>
        <p class="gate__lede">Watch closely. The ash still remembers the key.</p>
        <button class="btn btn--primary btn--lg" type="button" id="gateBegin">
          Begin Trial I
        </button>
      </div>
      <div class="gate__chrome" hidden id="gateChrome">
        <button class="gate__pause" type="button" id="gatePause" aria-label="Pause">Pause</button>
      </div>
      <div class="gate__modal" hidden id="gateModal">
        <div class="gate__blur" aria-hidden="true"></div>
        <div class="burn-sheet" role="document">
          <p class="burn-sheet__eyebrow">Trial I · Burned paper</p>
          <h2 class="burn-sheet__title">Find the key</h2>
          <p class="burn-sheet__lede">
            The leaf was scorched, but not silent. Read what the fire failed to erase,
            then offer the key to the board.
          </p>
          <form class="burn-sheet__form" id="gateForm" autocomplete="off">
            <label class="burn-sheet__label" for="gateKey">The key</label>
            <input class="burn-sheet__input" id="gateKey" name="key" type="text"
                   spellcheck="false" autocomplete="off" placeholder="············"
                   maxlength="120" required>
            <p class="burn-sheet__error" id="gateError" role="alert"></p>
            <button class="btn btn--primary btn--lg burn-sheet__submit" type="submit" id="gateSubmit">
              Offer the key
            </button>
          </form>
          <p class="burn-sheet__note">No hints. The ash keeps its own counsel.</p>
        </div>
      </div>
    `;
    const video = root.querySelector("#gateVideo");
    const source = document.createElement("source");
    source.src = SRC;
    source.type = "video/mp4";
    video.appendChild(source);
    document.body.appendChild(root);
    return root;
  }

  function play(options) {
    const opts = Object.assign({ onDone: null }, options || {});

    return new Promise((resolve) => {
      const root = buildRoot();
      const video = root.querySelector("#gateVideo");
      const veil = root.querySelector("#gateVeil");
      const chrome = root.querySelector("#gateChrome");
      const modal = root.querySelector("#gateModal");
      const beginBtn = root.querySelector("#gateBegin");
      const pauseBtn = root.querySelector("#gatePause");
      const form = root.querySelector("#gateForm");
      const keyInput = root.querySelector("#gateKey");
      const errEl = root.querySelector("#gateError");
      const submitBtn = root.querySelector("#gateSubmit");

      let finished = false;

      function syncPauseLabel() {
        const paused = video.paused;
        pauseBtn.textContent = paused ? "Play" : "Pause";
        pauseBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
        root.classList.toggle("is-paused", paused);
      }

      function finish(payload) {
        if (finished) return;
        finished = true;
        exitDomFullscreen();
        try {
          video.pause();
        } catch (_) {
          /* ignore */
        }
        root.classList.add("is-leaving");
        setTimeout(() => {
          root.remove();
          if (typeof opts.onDone === "function") opts.onDone(payload || { solved: false });
          resolve(true);
        }, 420);
      }

      function showPlaying() {
        veil.hidden = true;
        modal.hidden = true;
        chrome.hidden = false;
        root.classList.add("is-playing");
        root.classList.remove("is-ended", "is-asking");
        syncPauseLabel();
      }

      function showKeyModal() {
        chrome.hidden = true;
        veil.hidden = true;
        modal.hidden = false;
        root.classList.remove("is-playing", "is-paused");
        root.classList.add("is-ended", "is-asking");
        exitDomFullscreen();
        setTimeout(() => keyInput.focus(), 80);
      }

      async function enterFullscreen() {
        const ok = await requestDomFullscreen(root);
        if (!ok) await requestDomFullscreen(document.documentElement);
      }

      async function startPlayback() {
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
          console.warn("[gate] autoplay blocked", err);
        }
      }

      async function togglePause() {
        if (!root.classList.contains("is-playing") || root.classList.contains("is-asking")) return;
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

      video.addEventListener("ended", () => {
        showKeyModal();
      });

      video.addEventListener("error", () => {
        if (window.Atmosphere) Atmosphere.toast("The burned leaf could not be shown.", "error");
        showKeyModal();
      });

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        errEl.textContent = "";
        const key = keyInput.value.trim();
        if (!key) {
          errEl.textContent = "Offer the key from the burned paper.";
          return;
        }

        submitBtn.classList.add("is-loading");
        submitBtn.disabled = true;
        try {
          const data = await Vault.submitFlag(CHALLENGE_ID, key);
          if (window.Atmosphere) {
            Atmosphere.toast(data.message || "The first door opens.", "success", 3200);
          }
          finish({ solved: true, user: data.user || null });
        } catch (err) {
          errEl.textContent = (err && err.message) || "The spirits reject that key.";
          keyInput.select();
        } finally {
          submitBtn.classList.remove("is-loading");
          submitBtn.disabled = false;
        }
      });

      root.classList.add("is-open");
      startPlayback();
    });
  }

  window.FirstGate = {
    SRC,
    CHALLENGE_ID,
    play,
  };
})();
