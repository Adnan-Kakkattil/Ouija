/* =========================================================
   OUIJA CTF — First transmission (login rite / challenge I)
   Fullscreen video with sound. Triggered after login.
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
    root.setAttribute("aria-label", "First transmission — Trial I");
    root.innerHTML = `
      <video class="rite__video" id="riteVideo" playsinline preload="auto">
        <source src="${SRC}" type="video/mp4">
      </video>
      <div class="rite__veil" id="riteVeil">
        <p class="eyebrow">Trial I · The Whispering Wall</p>
        <h2 class="rite__title">The first transmission</h2>
        <p class="rite__lede">The house has something to show you. Sound on. Do not look away.</p>
        <button class="btn btn--primary btn--lg" type="button" id="riteBegin">
          Open the transmission
        </button>
      </div>
      <div class="rite__chrome" hidden id="riteChrome">
        <p class="rite__label">First knock · fullscreen</p>
        <div class="rite__actions">
          <button class="btn btn--ghost btn--sm" type="button" id="riteMute" aria-pressed="false">Mute</button>
          <button class="btn btn--ghost btn--sm" type="button" id="riteSkip">Skip</button>
        </div>
      </div>
      <div class="rite__end" hidden id="riteEnd">
        <p class="eyebrow">Transmission complete</p>
        <h2 class="rite__title">The first knock has been answered</h2>
        <p class="rite__lede">Your first trial waits at the table. Look for what the living hid badly.</p>
        <button class="btn btn--primary btn--lg" type="button" id="riteContinue">
          Continue to the table
        </button>
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
   * Play the first-challenge transmission fullscreen with sound.
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
      const skipBtn = root.querySelector("#riteSkip");
      const muteBtn = root.querySelector("#riteMute");
      const continueBtn = root.querySelector("#riteContinue");

      let finished = false;
      let keyHandler = null;

      function cleanup() {
        if (keyHandler) document.removeEventListener("keydown", keyHandler);
      }

      function finish(skipped) {
        if (finished) return;
        finished = true;
        cleanup();
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
          const result = { skipped: !!skipped };
          if (typeof opts.onDone === "function") opts.onDone(result);
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

      beginBtn.addEventListener("click", () => {
        startPlayback();
      });
      skipBtn.addEventListener("click", () => finish(true));
      continueBtn.addEventListener("click", () => finish(false));

      muteBtn.addEventListener("click", () => {
        video.muted = !video.muted;
        muteBtn.setAttribute("aria-pressed", String(video.muted));
        muteBtn.textContent = video.muted ? "Unmute" : "Mute";
      });

      video.addEventListener("ended", () => {
        chrome.hidden = true;
        end.hidden = false;
        root.classList.remove("is-playing");
        root.classList.add("is-ended");
        exitDomFullscreen();
      });

      video.addEventListener("error", () => {
        if (window.Atmosphere) Atmosphere.toast("The transmission could not be received.", "error");
        finish(true);
      });

      keyHandler = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          finish(true);
        }
      };
      document.addEventListener("keydown", keyHandler);

      root.classList.add("is-open");
      /* Attempt immediate play while we may still have user activation */
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
