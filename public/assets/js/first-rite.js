/* =========================================================
   OUIJA CTF — The Story (first video / CTF prologue)
   Fullscreen video with sound. Triggered after first sitting.
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
      <video class="rite__video" id="riteVideo" playsinline preload="auto">
        <source src="${SRC}" type="video/mp4">
      </video>
      <div class="rite__veil" id="riteVeil">
        <p class="eyebrow">Prologue · The Story</p>
        <h2 class="rite__title">How this house woke</h2>
        <p class="rite__lede">Before the trials, the story. Sound on. Do not look away.</p>
        <button class="btn btn--primary btn--lg" type="button" id="riteBegin">
          Begin the story
        </button>
      </div>
      <div class="rite__chrome" hidden id="riteChrome">
        <p class="rite__label">The story unfolds…</p>
      </div>
      <div class="rite__end" hidden id="riteEnd">
        <p class="eyebrow">Story complete</p>
        <h2 class="rite__title">The board is waiting</h2>
        <p class="rite__lede">Many trials lie ahead. Track your progress — and your circle’s. Hints cost points.</p>
        <div class="rite__end-actions">
          <button class="btn btn--spectral btn--lg" type="button" id="riteReplay">
            Replay the story
          </button>
          <button class="btn btn--primary btn--lg" type="button" id="riteContinue">
            Continue to the table
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    return root;
  }

  function requestDomFullscreen(el) {
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!req) return Promise.resolve(false);
    return req
      .call(el)
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

  /**
   * Play the CTF story fullscreen with sound.
   * Browsers may block unmuted autoplay after an await — the Begin
   * button always works because it is a fresh user gesture.
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
      const replayBtn = root.querySelector("#riteReplay");
      const continueBtn = root.querySelector("#riteContinue");

      let finished = false;

      function finish() {
        if (finished) return;
        finished = true;
        sessionStorage.setItem(SEEN_KEY, "1");
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
      }

      async function startPlayback() {
        video.muted = false;
        video.volume = 1;
        video.currentTime = 0;
        showPlaying();
        await requestDomFullscreen(root);
        try {
          await video.play();
        } catch (err) {
          chrome.hidden = true;
          veil.hidden = false;
          root.classList.remove("is-playing");
          beginBtn.textContent = "Click to play with sound";
          console.warn("[rite] autoplay blocked — waiting for click", err);
        }
      }

      async function replay() {
        end.hidden = true;
        root.classList.remove("is-ended");
        await startPlayback();
      }

      beginBtn.addEventListener("click", () => {
        startPlayback();
      });
      replayBtn.addEventListener("click", () => {
        replay();
      });
      continueBtn.addEventListener("click", () => finish());

      video.addEventListener("ended", () => {
        chrome.hidden = true;
        end.hidden = false;
        root.classList.remove("is-playing");
        root.classList.add("is-ended");
        exitDomFullscreen();
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
