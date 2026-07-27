/* =========================================================
   OUIJA CTF — The Story (first login prologue)
   Auto fullscreen. Only control while playing: pause / unpause.
   ========================================================= */

(function () {
  "use strict";

  const SRC = "assets/video/first-video.mp4";
  const SEEN_KEY = "ouija:firstRiteSeen";
  const ARM_KEY = "ouija:playFirstRite";

  function buildOverlay() {
    const root = document.createElement("div");
    root.className = "rite";
    root.id = "firstRite";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "The Story — OUIJA CTF");
    root.innerHTML = `
      <video class="rite__video" id="riteVideo" playsinline preload="auto"></video>
      <div class="rite__veil" id="riteVeil">
        <p class="eyebrow">Prologue · The Story</p>
        <h2 class="rite__title">How this house woke</h2>
        <p class="rite__lede">Before the trials, the story. Sound on.</p>
        <button class="btn btn--primary btn--lg" type="button" id="riteBegin">
          Begin the story
        </button>
      </div>
      <div class="rite__chrome" hidden id="riteChrome">
        <button class="rite__pause" type="button" id="ritePause" aria-label="Pause">
          Pause
        </button>
      </div>
      <div class="rite__end" hidden id="riteEnd">
        <p class="eyebrow">Story complete</p>
        <h2 class="rite__title">The board is waiting</h2>
        <p class="rite__lede">Many trials lie ahead. Your circle’s progress is already being kept.</p>
        <div class="rite__end-actions">
          <button class="btn btn--primary btn--lg" type="button" id="riteContinue">
            Continue to the table
          </button>
        </div>
      </div>
    `;
    const video = root.querySelector("#riteVideo");
    const source = document.createElement("source");
    source.src = SRC;
    source.type = "video/mp4";
    video.appendChild(source);
    document.body.appendChild(root);
    return root;
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

  function markSeenServer() {
    if (!window.Vault || typeof Vault.markStorySeen !== "function") return Promise.resolve();
    return Vault.markStorySeen().catch(() => {});
  }

  /**
   * Play the CTF story in fullscreen with sound.
   * While playing, only pause / unpause is available.
   */
  function play(options) {
    const opts = Object.assign({ force: false, onDone: null }, options || {});
    if (!opts.force && sessionStorage.getItem(SEEN_KEY) === "1") {
      if (typeof opts.onDone === "function") opts.onDone({ skipped: true, alreadySeen: true });
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      const root = buildOverlay();
      const video = root.querySelector("#riteVideo");
      const veil = root.querySelector("#riteVeil");
      const chrome = root.querySelector("#riteChrome");
      const end = root.querySelector("#riteEnd");
      const beginBtn = root.querySelector("#riteBegin");
      const pauseBtn = root.querySelector("#ritePause");
      const continueBtn = root.querySelector("#riteContinue");

      let finished = false;

      function syncPauseLabel() {
        const paused = video.paused;
        pauseBtn.textContent = paused ? "Play" : "Pause";
        pauseBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
        root.classList.toggle("is-paused", paused);
      }

      function finish() {
        if (finished) return;
        finished = true;
        sessionStorage.setItem(SEEN_KEY, "1");
        markSeenServer();
        exitDomFullscreen();
        try {
          video.pause();
        } catch (_) {
          /* ignore */
        }
        root.classList.add("is-leaving");
        setTimeout(() => {
          root.remove();
          if (typeof opts.onDone === "function") opts.onDone({ skipped: false });
          resolve(true);
        }, 420);
      }

      function showPlaying() {
        veil.hidden = true;
        end.hidden = true;
        chrome.hidden = false;
        root.classList.add("is-playing");
        root.classList.remove("is-ended");
        syncPauseLabel();
      }

      async function enterFullscreen() {
        /* Prefer the story overlay, then the whole document (F11-like). */
        const ok = await requestDomFullscreen(root);
        if (!ok) await requestDomFullscreen(document.documentElement);
      }

      async function startPlayback() {
        video.muted = false;
        video.volume = 1;
        video.controls = false;
        if (video.currentTime > 0.2 && !video.paused) {
          /* already playing */
        } else if (video.ended || video.currentTime === 0) {
          video.currentTime = 0;
        }
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
          console.warn("[rite] autoplay blocked — waiting for click", err);
        }
      }

      async function togglePause() {
        if (!root.classList.contains("is-playing") || end.hidden === false) return;
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

      beginBtn.addEventListener("click", () => {
        startPlayback();
      });
      pauseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePause();
      });
      continueBtn.addEventListener("click", () => finish());

      /* Click the video itself to pause / unpause — no other controls */
      video.addEventListener("click", (e) => {
        e.preventDefault();
        togglePause();
      });

      video.addEventListener("play", syncPauseLabel);
      video.addEventListener("pause", syncPauseLabel);

      video.addEventListener("ended", () => {
        chrome.hidden = true;
        end.hidden = false;
        root.classList.remove("is-playing", "is-paused");
        root.classList.add("is-ended");
        exitDomFullscreen();
        markSeenServer();
        sessionStorage.setItem(SEEN_KEY, "1");
      });

      video.addEventListener("error", () => {
        if (window.Atmosphere) Atmosphere.toast("The story could not be received.", "error");
        finish();
      });

      root.classList.add("is-open");
      startPlayback();
    });
  }

  function armForNextPage() {
    sessionStorage.setItem(ARM_KEY, "1");
  }

  function consumeArmed() {
    if (sessionStorage.getItem(ARM_KEY) !== "1") return false;
    sessionStorage.removeItem(ARM_KEY);
    return true;
  }

  window.FirstRite = {
    SRC,
    play,
    armForNextPage,
    consumeArmed,
    reset() {
      sessionStorage.removeItem(SEEN_KEY);
      sessionStorage.removeItem(ARM_KEY);
    },
  };
})();
