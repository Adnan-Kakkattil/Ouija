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
        { glyph: "📷", text: "A damaged camera containing one surviving photograph." },
        { glyph: "🎙️", text: "A voice recorder with Olivia's final audio recording." },
        { glyph: "💻", text: "An old investigation website stored on Olivia's laptop, containing restricted case files." },
      ],
      closing: [
        "Every clue reveals another piece of Olivia's final investigation.",
        "She had uncovered something important.",
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
        <p class="gate__lede">The house opens another door. Watch closely.</p>
        <button class="btn btn--primary btn--lg" type="button" id="roomGateBegin">
          Continue downstairs
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
    `;

    const video = root.querySelector("#roomGateVideo");
    hardenVideo(video);
    const source = document.createElement("source");
    source.src = cfg.video;
    source.type = "video/mp4";
    video.appendChild(source);
    document.body.appendChild(root);
    return root;
  }

  function play(options) {
    const opts = Object.assign({ roomId: "room-2", onDone: null }, options || {});
    const cfg = ROOM_INTROS[opts.roomId];
    if (!cfg) {
      return Promise.resolve({ skipped: true });
    }

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

      function syncPauseLabel() {
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
        root.classList.remove("is-ended", "is-reveal", "is-paused");
      }

      function showReveal() {
        try {
          video.pause();
        } catch (_) {
          /* ignore */
        }
        chrome.hidden = true;
        veil.hidden = true;
        reveal.hidden = false;
        root.classList.remove("is-playing", "is-paused");
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
        if (!root.classList.contains("is-playing")) return;
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
        if (finished) return;
        if (window.Atmosphere) Atmosphere.toast("The downstairs vision could not be shown.", "error");
        showReveal();
      });
      enterBtn.addEventListener("click", () => finish({ entered: true }));

      root.classList.add("is-open");
      startPlayback();
    });
  }

  function needsIntro(user, roomId) {
    if (!user || !roomId) return false;
    const seen = user.roomIntrosSeen || [];
    return seen.indexOf(roomId) === -1;
  }

  window.RoomGate = {
    INTROS: ROOM_INTROS,
    play,
    needsIntro,
  };
})();
