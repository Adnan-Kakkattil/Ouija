/* =========================================================
   OUIJA CTF — Board engine
   Builds an authentic talking board as SVG and drives a
   planchette across it with spring physics.

   Layout follows US Patent 446,054 (Bond, 1891):
     - alphabet in two semicircular rows
     - numerals in a straight line beneath
     - full moon + YES upper left, crescent + star + NO upper right
     - stars in the lower corners, GOOD BYE at bottom centre
   ========================================================= */

(function () {
  "use strict";

  const VB_W = 1000;
  const VB_H = 682;

  /* Arc definitions. Angles are degrees from the positive x-axis,
     swept right-to-left so letters read left-to-right on screen. */
  const ARC = {
    cx: 500,
    cy: 486,
    row1: { letters: "ABCDEFGHIJKLM", r: 320, from: 166, to: 14 },
    row2: { letters: "NOPQRSTUVWXYZ", r: 228, from: 157, to: 23 },
  };

  const NUMERALS = { chars: "1234567890", y: 552, x1: 296, x2: 704 };

  const SVG_NS = "http://www.w3.org/2000/svg";

  let uidCounter = 0;

  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const isLiteDevice = () =>
    window.matchMedia("(pointer: coarse)").matches ||
    Math.min(window.innerWidth, window.innerHeight) < 700;

  function el(name, attrs, text) {
    const node = document.createElementNS(SVG_NS, name);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    if (text != null) node.textContent = text;
    return node;
  }

  function polar(cx, cy, r, deg) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  }

  class OuijaBoard {
    constructor(stage, options) {
      this.stage = stage;
      this.opts = Object.assign(
        {
          interactive: true,
          tilt: true,
          idleWander: true,
          onStrike: null,
        },
        options || {}
      );

      this.uid = "ob" + ++uidCounter;
      this.targets = new Map();
      this.letterNodes = new Map();

      /* Planchette state in viewBox units */
      this.pos = { x: ARC.cx, y: 300 };
      this.vel = { x: 0, y: 0 };
      this.goal = { x: ARC.cx, y: 300 };
      this.stiffness = 0.055;
      this.damping = 0.82;

      this.queue = [];
      this.dwellUntil = 0;
      this.isSpelling = false;
      this.isFollowing = false;
      this.idlePhase = Math.random() * 1000;

      this._build();
      this._bind();
      this._loop = this._loop.bind(this);
      this._paused = false;
      this._idlePainted = false;
      this._onVisibility = () => {
        if (document.hidden) {
          this._paused = true;
        } else {
          this._resume();
        }
      };
      document.addEventListener("visibilitychange", this._onVisibility);
      this._raf = requestAnimationFrame(this._loop);
    }

    /* ---------------------------------------------------------
       Construction
       --------------------------------------------------------- */
    _build() {
      const tilt = document.createElement("div");
      tilt.className = "board-stage__tilt";

      const svg = el("svg", {
        class: "board-svg",
        viewBox: `0 0 ${VB_W} ${VB_H}`,
        role: "img",
        "aria-label":
          "An antique talking board: the alphabet in two arcs, numerals beneath, YES and NO in the upper corners, GOOD BYE at the bottom.",
      });

      svg.appendChild(this._defs());
      this._face(svg);
      this._corners(svg);
      this._masthead(svg);
      this._alphabet(svg);
      this._numerals(svg);
      this._footer(svg);
      this._wear(svg);

      tilt.appendChild(svg);
      tilt.appendChild(this._planchette());
      this.stage.appendChild(tilt);

      this.tiltEl = tilt;
      this.svg = svg;
    }

    _defs() {
      const u = this.uid;
      const defs = el("defs");
      defs.innerHTML = `
        <linearGradient id="${u}-wood" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%"   stop-color="#b8823c"/>
          <stop offset="22%"  stop-color="#a46f30"/>
          <stop offset="52%"  stop-color="#8a5a26"/>
          <stop offset="78%"  stop-color="#6f4520"/>
          <stop offset="100%" stop-color="#57341a"/>
        </linearGradient>

        <radialGradient id="${u}-sheen" cx="0.38" cy="0.24" r="0.86">
          <stop offset="0%"   stop-color="#ffd9a0" stop-opacity="0.34"/>
          <stop offset="42%"  stop-color="#e8a24a" stop-opacity="0"/>
          <stop offset="100%" stop-color="#1a0e04" stop-opacity="0.62"/>
        </radialGradient>

        <radialGradient id="${u}-edge" cx="0.5" cy="0.5" r="0.72">
          <stop offset="58%"  stop-color="#000000" stop-opacity="0"/>
          <stop offset="100%" stop-color="#0d0702" stop-opacity="0.75"/>
        </radialGradient>

        <linearGradient id="${u}-plank" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%"   stop-color="#c9a05a"/>
          <stop offset="30%"  stop-color="#a87c3e"/>
          <stop offset="65%"  stop-color="#7d5527"/>
          <stop offset="100%" stop-color="#4f3116"/>
        </linearGradient>

        <pattern id="${u}-grain" patternUnits="userSpaceOnUse" width="6" height="48" patternTransform="rotate(12)">
          <rect width="6" height="48" fill="transparent"/>
          <rect x="0" width="1.2" height="48" fill="#2a1707" opacity="0.18"/>
          <rect x="3" width="0.6" height="48" fill="#fff0c8" opacity="0.06"/>
        </pattern>

      `;

      /* The planchette's glows are referenced by stylesheet, so their
         ids must stay stable — define them once per document. */
      if (!document.getElementById("lensGlow")) {
        defs.innerHTML += `
          <radialGradient id="lensGlow">
            <stop offset="0%"   stop-color="#d6f7ef" stop-opacity="0.5"/>
            <stop offset="60%"  stop-color="#7fd4c1" stop-opacity="0.12"/>
            <stop offset="100%" stop-color="#7fd4c1" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="auraGlow">
            <stop offset="0%"   stop-color="#a9ecdd" stop-opacity="0.55"/>
            <stop offset="45%"  stop-color="#7fd4c1" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#7fd4c1" stop-opacity="0"/>
          </radialGradient>
        `;
      }
      return defs;
    }

    _face(svg) {
      const u = this.uid;
      const g = el("g");

      g.appendChild(
        el("rect", {
          class: "board-face",
          x: 16,
          y: 16,
          width: VB_W - 32,
          height: VB_H - 32,
          rx: 28,
          fill: `url(#${u}-wood)`,
        })
      );

      /* Soft grain via repeating stripe pattern — avoids feTurbulence */
      g.appendChild(
        el("rect", {
          class: "board-grain",
          x: 16,
          y: 16,
          width: VB_W - 32,
          height: VB_H - 32,
          rx: 28,
          fill: `url(#${u}-grain)`,
        })
      );

      g.appendChild(
        el("rect", {
          x: 16,
          y: 16,
          width: VB_W - 32,
          height: VB_H - 32,
          rx: 28,
          fill: `url(#${u}-sheen)`,
        })
      );

      g.appendChild(
        el("rect", {
          class: "board-edge-shade",
          x: 16,
          y: 16,
          width: VB_W - 32,
          height: VB_H - 32,
          rx: 28,
          fill: `url(#${u}-edge)`,
        })
      );

      /* Bevel + inlaid border line */
      g.appendChild(
        el("rect", { class: "board-bevel", x: 21, y: 21, width: VB_W - 42, height: VB_H - 42, rx: 24 })
      );
      g.appendChild(
        el("rect", { class: "board-inlay", x: 38, y: 38, width: VB_W - 76, height: VB_H - 76, rx: 16 })
      );

      svg.appendChild(g);
    }

    _corners(svg) {
      const g = el("g");

      /* Upper left: full moon over YES */
      g.appendChild(el("circle", { class: "board-figure", cx: 128, cy: 100, r: 34 }));
      g.appendChild(
        el("circle", { cx: 128, cy: 100, r: 44, fill: "none", stroke: "#150d05", "stroke-width": 1.6, opacity: 0.45 })
      );
      const yes = el("text", { class: "board-ink board-word", x: 128, y: 164 }, "YES");
      g.appendChild(yes);
      this.targets.set("YES", { x: 128, y: 130 });

      /* Upper right: crescent moon with a star, over NO */
      g.appendChild(
        el("path", {
          class: "board-figure",
          d: "M886 66 a34 34 0 1 0 0 68 a27 27 0 1 1 0 -68 Z",
        })
      );
      g.appendChild(
        el("path", {
          class: "board-figure",
          d: this._starPath(922, 62, 13, 6, 5),
        })
      );
      const no = el("text", { class: "board-ink board-word", x: 872, y: 164 }, "NO");
      g.appendChild(no);
      this.targets.set("NO", { x: 872, y: 130 });

      /* Lower corners: stars */
      g.appendChild(el("path", { class: "board-figure", d: this._starPath(96, 594, 24, 10, 5) }));
      g.appendChild(el("path", { class: "board-figure", d: this._starPath(904, 594, 24, 10, 5) }));

      svg.appendChild(g);
    }

    _masthead(svg) {
      const g = el("g");

      g.appendChild(el("text", { class: "board-ink board-brand", x: 500, y: 82 }, "OUIJA"));
      g.appendChild(
        el("text", { class: "board-ink board-mark", x: 500, y: 124 }, "TRADE MARK REGISTERED")
      );

      /* Scroll flourishes flanking the wordmark */
      g.appendChild(
        el("path", { class: "board-scroll", d: "M292 82 c26 -22 54 -22 74 0 c-20 18 -46 18 -74 0 Z" })
      );
      g.appendChild(
        el("path", { class: "board-scroll", d: "M708 82 c-26 -22 -54 -22 -74 0 c20 18 46 18 74 0 Z" })
      );

      svg.appendChild(g);
    }

    _alphabet(svg) {
      const g = el("g");
      [ARC.row1, ARC.row2].forEach((row) => {
        const n = row.letters.length;
        const step = (row.from - row.to) / (n - 1);
        for (let i = 0; i < n; i++) {
          const ch = row.letters[i];
          const p = polar(ARC.cx, ARC.cy, row.r, row.from - step * i);
          const t = el(
            "text",
            {
              class: "board-ink board-letter",
              x: p.x.toFixed(2),
              y: p.y.toFixed(2),
              "data-char": ch,
              tabindex: this.opts.interactive ? "0" : null,
              role: this.opts.interactive ? "button" : null,
              "aria-label": this.opts.interactive ? `Letter ${ch}` : null,
            },
            ch
          );
          g.appendChild(t);
          this.targets.set(ch, { x: p.x, y: p.y });
          this.letterNodes.set(ch, t);
        }
      });
      svg.appendChild(g);
    }

    _numerals(svg) {
      const g = el("g");
      const { chars, y, x1, x2 } = NUMERALS;
      const step = (x2 - x1) / (chars.length - 1);
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        const x = x1 + step * i;
        const t = el(
          "text",
          {
            class: "board-ink board-letter board-number",
            x: x.toFixed(2),
            y: y,
            "data-char": ch,
            tabindex: this.opts.interactive ? "0" : null,
            role: this.opts.interactive ? "button" : null,
            "aria-label": this.opts.interactive ? `Number ${ch}` : null,
          },
          ch
        );
        g.appendChild(t);
        this.targets.set(ch, { x, y });
        this.letterNodes.set(ch, t);
      }
      svg.appendChild(g);
    }

    _footer(svg) {
      const g = el("g");

      /* The two figures bidding each other good-bye, per the patent */
      g.appendChild(el("path", { class: "board-figure", d: this._figurePath(286, 636, 1) }));
      g.appendChild(el("path", { class: "board-figure", d: this._figurePath(714, 636, -1) }));

      g.appendChild(el("text", { class: "board-ink board-goodbye", x: 500, y: 628 }, "GOOD BYE"));
      this.targets.set("GOODBYE", { x: 500, y: 628 });
      this.targets.set(" ", { x: 500, y: 628 });

      svg.appendChild(g);
    }

    /* Age the board: a few stains and hairline scratches (no SVG filters) */
    _wear(svg) {
      const g = el("g", { class: "board-stain" });
      const blots = [
        [214, 236, 46, 30],
        [770, 430, 62, 38],
        [430, 604, 38, 22],
        [620, 190, 30, 20],
      ];
      blots.forEach(([cx, cy, rx, ry]) => {
        g.appendChild(el("ellipse", { cx, cy, rx, ry, fill: "#3a2109", opacity: 0.22 }));
      });

      const scratches = [
        "M120 320 q140 -26 300 -8",
        "M560 96 q120 30 250 12",
        "M240 512 q180 22 340 -6",
      ];
      scratches.forEach((d) => {
        g.appendChild(
          el("path", { d, fill: "none", stroke: "#2a1707", "stroke-width": 1.2, opacity: 0.28 })
        );
      });

      svg.appendChild(g);
    }

    _planchette() {
      const wrap = document.createElement("div");
      wrap.className = "planchette";
      wrap.innerHTML = `
        <svg viewBox="0 0 200 212" aria-hidden="true">
          <g class="planchette__drift">
            <circle class="planchette__aura" cx="100" cy="106" r="96"/>
            <ellipse class="planchette__foot" cx="100" cy="40" rx="11" ry="7"/>
            <ellipse class="planchette__foot" cx="34" cy="178" rx="11" ry="7"/>
            <ellipse class="planchette__foot" cx="166" cy="178" rx="11" ry="7"/>
            <path class="planchette__body"
                  d="M100 6 C126 34 166 58 182 106 C198 156 156 206 100 206 C44 206 2 156 18 106 C34 58 74 34 100 6 Z"
                  fill="url(#${this.uid}-plank)"/>
            <path class="planchette__bevel"
                  d="M100 16 C124 42 158 64 172 107 C186 150 148 196 100 196 C52 196 14 150 28 107 C42 64 76 42 100 16 Z"/>
            <circle class="planchette__window" cx="100" cy="106" r="34"/>
            <circle class="planchette__lens" cx="100" cy="106" r="34"/>
            <circle class="planchette__ring" cx="100" cy="106" r="42"/>
            <path d="M100 6 L100 30" stroke="#2d1c0b" stroke-width="2" opacity="0.5" fill="none"/>
          </g>
        </svg>
      `;
      this.planchetteEl = wrap;
      return wrap;
    }

    /* ---------------------------------------------------------
       Geometry helpers
       --------------------------------------------------------- */
    _starPath(cx, cy, outer, inner, points) {
      let d = "";
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (Math.PI / points) * i - Math.PI / 2;
        d += (i === 0 ? "M" : "L") + (cx + r * Math.cos(a)).toFixed(2) + " " + (cy + r * Math.sin(a)).toFixed(2);
      }
      return d + "Z";
    }

    /* A small silhouette of a person waving farewell */
    _figurePath(x, y, dir) {
      const d = dir;
      return (
        `M${x} ${y} ` +
        `m-7 0 l0 -22 l-6 -3 l1 -14 l5 -4 ` +
        `l${d * 6} ${-8} l3 3 l${d * -4} 7 l6 2 l0 16 l-5 3 l0 22 Z ` +
        `M${x - 1} ${y - 50} a7 7 0 1 0 0.1 0 Z`
      );
    }

    /* ---------------------------------------------------------
       Interaction
       --------------------------------------------------------- */
    _bind() {
      if (this.opts.tilt) this._bindTilt();
      if (!this.opts.interactive) return;

      this.stage.addEventListener("pointermove", (e) => {
        if (this.isSpelling) return;
        const p = this._toViewBox(e.clientX, e.clientY);
        this.goal.x = p.x;
        this.goal.y = p.y;
        this.isFollowing = true;
        this._resume();
      }, { passive: true });

      this.stage.addEventListener("pointerleave", () => {
        this.isFollowing = false;
      });

      /* Clicking a glyph draws the planchette to it and reports it */
      this.svg.addEventListener("click", (e) => {
        const node = e.target.closest(".board-letter");
        if (!node) return;
        this._pick(node.getAttribute("data-char"));
      });

      this.svg.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const node = e.target.closest(".board-letter");
        if (!node) return;
        e.preventDefault();
        this._pick(node.getAttribute("data-char"));
      });
    }

    _pick(ch) {
      const t = this.targets.get(ch);
      if (!t) return;
      this.isSpelling = false;
      this.isFollowing = false;
      this.goal.x = t.x;
      this.goal.y = t.y;
      this._resume();
      this.strike(ch);
    }

    _bindTilt() {
      let pending = null;
      const onMove = (e) => {
        pending = e;
        if (this._tiltRaf) return;
        this._tiltRaf = requestAnimationFrame(() => {
          this._tiltRaf = 0;
          if (!pending) return;
          const ev = pending;
          pending = null;
          const r = this.stage.getBoundingClientRect();
          const nx = (ev.clientX - r.left) / r.width - 0.5;
          const ny = (ev.clientY - r.top) / r.height - 0.5;
          this.stage.classList.add("is-tracking");
          this.tiltEl.style.setProperty("--tilt-y", (nx * 9).toFixed(2) + "deg");
          this.tiltEl.style.setProperty("--tilt-x", (7 - ny * 7).toFixed(2) + "deg");
        });
      };
      const onLeave = () => {
        pending = null;
        this.stage.classList.remove("is-tracking");
        this.tiltEl.style.setProperty("--tilt-y", "0deg");
        this.tiltEl.style.setProperty("--tilt-x", "7deg");
      };
      this.stage.addEventListener("pointermove", onMove, { passive: true });
      this.stage.addEventListener("pointerleave", onLeave);
    }

    _toViewBox(clientX, clientY) {
      const r = this.stage.getBoundingClientRect();
      return {
        x: ((clientX - r.left) / r.width) * VB_W,
        y: ((clientY - r.top) / r.height) * VB_H,
      };
    }

    /* ---------------------------------------------------------
       Public API
       --------------------------------------------------------- */

    /* Flash a glyph and notify listeners. */
    strike(ch) {
      const node = this.letterNodes.get(ch);
      if (node) {
        node.classList.remove("is-struck");
        void node.getBBox();
        node.classList.add("is-struck");
        setTimeout(() => node.classList.remove("is-struck"), 900);
      }
      if (typeof this.opts.onStrike === "function") this.opts.onStrike(ch);
      this.stage.dispatchEvent(new CustomEvent("ouija:strike", { detail: { char: ch } }));
    }

    /* Move the planchette across a phrase, one glyph at a time. */
    spell(text, options) {
      const o = Object.assign({ dwell: 460, glide: 1.0, loop: false }, options || {});
      const chars = String(text)
        .toUpperCase()
        .split("")
        .filter((c) => this.targets.has(c));

      this.queue = chars.map((c) => ({ char: c, dwell: o.dwell }));
      this.isSpelling = true;
      this.isFollowing = false;
      this.loopText = o.loop ? text : null;
      this.loopOpts = o;
      this.stiffness = 0.055 * o.glide;
      this.planchetteEl.classList.add("is-channeling");
      this._idlePainted = false;
      this._resume();
      this.stage.dispatchEvent(new CustomEvent("ouija:spell-start", { detail: { text } }));
      return this;
    }

    stop() {
      this.queue = [];
      this.isSpelling = false;
      this.loopText = null;
      this.planchetteEl.classList.remove("is-channeling");
    }

    _resume() {
      if (!this._paused) return;
      this._paused = false;
      this._raf = requestAnimationFrame(this._loop);
    }

    /* ---------------------------------------------------------
       Animation loop: critically-damped spring toward the goal
       --------------------------------------------------------- */
    _loop(now) {
      if (document.hidden) {
        this._paused = true;
        return;
      }

      if (this.isSpelling) this._advanceQueue(now);
      else if (!this.isFollowing && this.opts.idleWander) this._wander(now);

      const dx = this.goal.x - this.pos.x;
      const dy = this.goal.y - this.pos.y;
      const speed = Math.abs(this.vel.x) + Math.abs(this.vel.y);
      const settled = Math.abs(dx) < 0.4 && Math.abs(dy) < 0.4 && speed < 0.05;
      const needsMotion = this.isSpelling || this.isFollowing || this.opts.idleWander;

      if (prefersReducedMotion()) {
        this.pos.x = this.goal.x;
        this.pos.y = this.goal.y;
      } else {
        this.vel.x = (this.vel.x + dx * this.stiffness) * this.damping;
        this.vel.y = (this.vel.y + dy * this.stiffness) * this.damping;
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;
      }

      /* Fully pause when parked — no perpetual rAF tax on auth/ambient boards */
      if (settled && !needsMotion) {
        if (!this._idlePainted) {
          this._paintPlanchette(now, false);
          this._idlePainted = true;
        }
        this._paused = true;
        return;
      }

      this._idlePainted = false;
      this._paintPlanchette(now, true);
      this._raf = requestAnimationFrame(this._loop);
    }

    _paintPlanchette(now, moving) {
      const t = now / 1000 + this.idlePhase;
      const jx = moving ? Math.sin(t * 2.3) * 1.1 + Math.sin(t * 5.7) * 0.5 : 0;
      const jy = moving ? Math.cos(t * 1.9) * 1.1 + Math.cos(t * 6.3) * 0.4 : 0;
      const px = ((this.pos.x + jx) / VB_W) * 100;
      const py = ((this.pos.y + jy) / VB_H) * 100;
      const lean = Math.max(-14, Math.min(14, this.vel.x * 1.6));
      /* left/top % are relative to the board; transform % is relative to the planchette */
      this.planchetteEl.style.left = px.toFixed(2) + "%";
      this.planchetteEl.style.top = py.toFixed(2) + "%";
      this.planchetteEl.style.transform = `translate3d(-50%, -50%, 40px) rotate(${lean.toFixed(2)}deg)`;
    }

    _advanceQueue(now) {
      if (now < this.dwellUntil) return;

      const settled =
        Math.abs(this.goal.x - this.pos.x) < 6 && Math.abs(this.goal.y - this.pos.y) < 6;

      if (this.currentStep && settled) {
        this.strike(this.currentStep.char);
        this.dwellUntil = now + this.currentStep.dwell;
        this.currentStep = null;
        return;
      }
      if (this.currentStep) return;

      const next = this.queue.shift();
      if (!next) {
        this.isSpelling = false;
        this.planchetteEl.classList.remove("is-channeling");
        this.stage.dispatchEvent(new CustomEvent("ouija:spell-end"));
        if (this.loopText) {
          const text = this.loopText;
          const opts = this.loopOpts;
          setTimeout(() => this.spell(text, opts), 2600);
        }
        return;
      }

      const t = this.targets.get(next.char);
      this.goal.x = t.x;
      this.goal.y = t.y;
      this.currentStep = next;
    }

    /* Between questions the planchette drifts around the board's heart. */
    _wander(now) {
      const t = now / 1000 + this.idlePhase;
      this.goal.x = ARC.cx + Math.sin(t * 0.21) * 150 + Math.sin(t * 0.09) * 60;
      this.goal.y = 330 + Math.cos(t * 0.17) * 90;
    }
  }

  /* ---------------------------------------------------------
     Auto-mount every [data-board] on the page
     --------------------------------------------------------- */
  function mountAll() {
    const lite = isLiteDevice();

    document.querySelectorAll("[data-board]").forEach((stage) => {
      if (stage.dataset.mounted) return;
      stage.dataset.mounted = "1";

      const interactive = stage.dataset.boardInteractive !== "false";
      const board = new OuijaBoard(stage, {
        interactive,
        tilt: !lite && stage.dataset.boardTilt !== "false",
        /* Ambient/decorative boards shouldn't keep a physics loop busy forever */
        idleWander:
          !lite &&
          (stage.dataset.boardWander === "true" ||
            (interactive && stage.dataset.boardWander !== "false")),
      });

      stage.ouija = board;

      /* Mirror struck glyphs into a linked readout slate */
      const slateId = stage.dataset.boardSlate;
      if (slateId) {
        const slate = document.getElementById(slateId);
        if (slate) wireSlate(stage, slate);
      }

      if (stage.dataset.boardSpell) {
        board.spell(stage.dataset.boardSpell, {
          loop: !lite && stage.dataset.boardLoop === "true",
        });
      }
    });
  }

  function wireSlate(stage, slate) {
    const caret = document.createElement("i");
    caret.className = "seance__caret";
    slate.appendChild(caret);

    stage.addEventListener("ouija:spell-start", () => {
      slate.querySelectorAll("span").forEach((s) => s.remove());
    });

    stage.addEventListener("ouija:strike", (e) => {
      const ch = e.detail.char;
      const span = document.createElement("span");
      span.textContent = ch === "GOODBYE" || ch === " " ? " " : ch;
      slate.insertBefore(span, caret);

      /* Keep the slate from overflowing on long transmissions */
      const spans = slate.querySelectorAll("span");
      if (spans.length > 26) spans[0].remove();
    });
  }

  window.OuijaBoard = OuijaBoard;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAll);
  } else {
    mountAll();
  }
})();
