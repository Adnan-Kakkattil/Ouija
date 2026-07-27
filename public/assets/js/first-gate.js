/* =========================================================
   OUIJA CTF — Challenge I gate (burned paper key)
   Fullscreen prevideo → key modal → post video → room reveal.
   ========================================================= */

(function () {
  "use strict";

  const SRC = "assets/video/challenge1Prevideo.mp4";
  const POST_SRC = "assets/video/challenge1videopost2.mp4";
  const CHALLENGE_ID = "whisper-1";
  const ROOM_ONE_URL = "challenges.html";

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
      <div class="gate__reveal" hidden id="gateReveal">
        <div class="gate-reveal" role="document">
          <p class="gate-reveal__eyebrow">Trial I · The first room</p>
          <h2 class="gate-reveal__title">Inside the mansion</h2>
          <div class="gate-reveal__scroll">
            <p class="gate-reveal__prose">
              A thick layer of dust fills the air as moonlight shines through broken windows.
              The room appears untouched for years. An old rocking chair sways gently on its own,
              though there is no wind. Family portraits hang crooked on the walls, their faces
              faded with time. A music box plays a soft melody before suddenly stopping.
            </p>
            <p class="gate-reveal__prose">
              Scattered around the room are signs that someone had been here recently.
            </p>
            <p class="gate-reveal__lead">As they search, they discover:</p>
            <ul class="gate-reveal__finds">
              <li><span class="gate-reveal__glyph" aria-hidden="true">📖</span> A torn diary page hidden beneath the rocking chair.</li>
              <li><span class="gate-reveal__glyph" aria-hidden="true">✝️</span> A strange prayer written across the wall in an unfamiliar script.</li>
              <li><span class="gate-reveal__glyph" aria-hidden="true">📦</span> A small locked wooden box tucked inside an old cabinet.</li>
              <li><span class="gate-reveal__glyph" aria-hidden="true">📓</span> A password-protected journal lying on the table.</li>
              <li><span class="gate-reveal__glyph" aria-hidden="true">🖼️</span> A family portrait hanging slightly crooked.</li>
              <li><span class="gate-reveal__glyph" aria-hidden="true">🎵</span> An old music box still capable of playing a haunting melody.</li>
              <li><span class="gate-reveal__glyph" aria-hidden="true">💾</span> A dusty USB drive labelled &ldquo;DO NOT OPEN&rdquo; hidden inside a drawer.</li>
              <li><span class="gate-reveal__glyph" aria-hidden="true">📜</span> A mysterious ritual paper placed beside an extinguished candle.</li>
            </ul>
            <p class="gate-reveal__prose">
              Every object seems to hold a piece of the mansion&rsquo;s past.
            </p>
            <p class="gate-reveal__prose">
              Some reveal the story of Olivia.
            </p>
            <p class="gate-reveal__prose">
              Others hint at a far older secret hidden somewhere within the house.
            </p>
            <p class="gate-reveal__closing">
              Perhaps the answers lie in the basement she feared so much&hellip;
            </p>
          </div>
          <div class="gate-reveal__actions">
            <button class="btn btn--primary btn--lg" type="button" id="gateRoomOne">
              Start Room 1 Challenge
            </button>
          </div>
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
      const reveal = root.querySelector("#gateReveal");
      const beginBtn = root.querySelector("#gateBegin");
      const pauseBtn = root.querySelector("#gatePause");
      const form = root.querySelector("#gateForm");
      const keyInput = root.querySelector("#gateKey");
      const errEl = root.querySelector("#gateError");
      const submitBtn = root.querySelector("#gateSubmit");
      const roomOneBtn = root.querySelector("#gateRoomOne");

      let finished = false;
      let phase = "pre"; /* pre | post | reveal */
      let solvedPayload = { solved: true, user: null, next: ROOM_ONE_URL };

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
        reveal.hidden = true;
        chrome.hidden = false;
        root.classList.add("is-playing");
        root.classList.remove("is-ended", "is-asking", "is-reveal");
        syncPauseLabel();
      }

      function showKeyModal() {
        phase = "pre";
        chrome.hidden = true;
        veil.hidden = true;
        reveal.hidden = true;
        modal.hidden = false;
        root.classList.remove("is-playing", "is-paused", "is-reveal");
        root.classList.add("is-ended", "is-asking");
        exitDomFullscreen();
        setTimeout(() => keyInput.focus(), 80);
      }

      function showReveal() {
        phase = "reveal";
        try {
          video.pause();
        } catch (_) {
          /* ignore */
        }
        chrome.hidden = true;
        veil.hidden = true;
        modal.hidden = true;
        reveal.hidden = false;
        root.classList.remove("is-playing", "is-paused", "is-asking");
        root.classList.add("is-ended", "is-reveal");
        exitDomFullscreen();
        const scroll = reveal.querySelector(".gate-reveal__scroll");
        if (scroll) scroll.scrollTop = 0;
        setTimeout(() => roomOneBtn.focus(), 80);
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

      async function playPostVideo() {
        phase = "post";
        modal.hidden = true;
        reveal.hidden = true;
        veil.hidden = true;
        while (video.firstChild) video.removeChild(video.firstChild);
        const source = document.createElement("source");
        source.src = POST_SRC;
        source.type = "video/mp4";
        video.appendChild(source);
        try {
          video.load();
        } catch (_) {
          /* ignore */
        }
        video.muted = false;
        video.volume = 1;
        video.controls = false;
        video.currentTime = 0;
        showPlaying();
        await enterFullscreen();
        try {
          await video.play();
          syncPauseLabel();
        } catch (err) {
          console.warn("[gate] post video autoplay blocked", err);
          chrome.hidden = true;
          root.classList.remove("is-playing");
          veil.hidden = false;
          beginBtn.textContent = "Continue";
        }
      }

      async function startPostFromVeil() {
        showPlaying();
        await enterFullscreen();
        try {
          await video.play();
          syncPauseLabel();
        } catch (_) {
          showReveal();
        }
      }

      async function togglePause() {
        if (!root.classList.contains("is-playing") || root.classList.contains("is-asking")) return;
        if (phase === "reveal") return;
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
        if (phase === "post") {
          startPostFromVeil();
          return;
        }
        startPlayback();
      });
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
        if (phase === "post") {
          showReveal();
          return;
        }
        showKeyModal();
      });

      video.addEventListener("error", () => {
        if (finished || phase === "reveal") return;
        if (phase === "post") {
          if (window.Atmosphere) Atmosphere.toast("The next vision could not be shown.", "error");
          showReveal();
          return;
        }
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
          solvedPayload = {
            solved: true,
            user: data.user || null,
            next: ROOM_ONE_URL,
          };
          if (window.Atmosphere) {
            Atmosphere.toast(data.message || "The first door opens.", "success", 2200);
          }
          await playPostVideo();
        } catch (err) {
          errEl.textContent = (err && err.message) || "The spirits reject that key.";
          keyInput.select();
        } finally {
          submitBtn.classList.remove("is-loading");
          submitBtn.disabled = false;
        }
      });

      roomOneBtn.addEventListener("click", () => {
        finish(solvedPayload);
      });

      root.classList.add("is-open");
      startPlayback();
    });
  }

  window.FirstGate = {
    SRC,
    POST_SRC,
    CHALLENGE_ID,
    play,
  };
})();
