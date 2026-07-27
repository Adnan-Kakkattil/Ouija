/* =========================================================
   OUIJA CTF — Atmosphere engine
   Injects the fog, motes, grain and vignette layers, then
   wires the spirit cursor, scroll reveals, header state,
   veil page transitions and toast deck.

   Everything here degrades to nothing under
   prefers-reduced-motion, and nothing here is required for
   the site to function.
   ========================================================= */

(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const saveData =
    (navigator.connection && navigator.connection.saveData) ||
    window.matchMedia("(prefers-reduced-data: reduce)").matches;
  /* Fewer layers on small / low-power screens */
  const lite = saveData || coarse || Math.min(innerWidth, innerHeight) < 700;

  /* ---------------------------------------------------------
     Layer injection
     --------------------------------------------------------- */
  function buildLayers() {
    const frag = document.createDocumentFragment();

    const fogBack = document.createElement("div");
    fogBack.className = "fog";
    fogBack.setAttribute("aria-hidden", "true");
    fogBack.innerHTML = lite
      ? '<div class="fog__layer fog__layer--1"></div><div class="fog__layer fog__layer--ground"></div>'
      : '<div class="fog__layer fog__layer--1"></div>' +
        '<div class="fog__layer fog__layer--2"></div>' +
        '<div class="fog__layer fog__layer--ground"></div>';
    frag.appendChild(fogBack);

    if (!lite) {
      const fogFront = document.createElement("div");
      fogFront.className = "fog fog--front";
      fogFront.setAttribute("aria-hidden", "true");
      fogFront.innerHTML = '<div class="fog__layer fog__layer--3"></div>';
      frag.appendChild(fogFront);
    }

    const motes = document.createElement("div");
    motes.className = "motes";
    motes.setAttribute("aria-hidden", "true");
    frag.appendChild(motes);

    if (!lite) {
      const grain = document.createElement("div");
      grain.className = "grain";
      grain.setAttribute("aria-hidden", "true");
      frag.appendChild(grain);
    }

    const vignette = document.createElement("div");
    vignette.className = lite ? "vignette" : "vignette vignette--flicker";
    vignette.setAttribute("aria-hidden", "true");
    frag.appendChild(vignette);

    document.body.appendChild(frag);
    return { motes };
  }

  /* ---------------------------------------------------------
     Motes: embers, spirit dust, ordinary dust
     --------------------------------------------------------- */
  function seedMotes(host) {
    if (reduced) return;

    const count = lite ? 10 : 18;
    const kinds = ["ember", "spirit", "dust", "dust", "dust"];
    const frag = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const kind = kinds[(Math.random() * kinds.length) | 0];
      const size = kind === "dust" ? rand(1.5, 3.5) : rand(2.5, 6);
      const m = document.createElement("i");
      m.className = "mote mote--" + kind;
      m.style.left = rand(-2, 102) + "%";
      m.style.width = size.toFixed(2) + "px";
      m.style.height = size.toFixed(2) + "px";
      m.style.setProperty("--drift", rand(-90, 90).toFixed(0) + "px");
      m.style.setProperty("--peak", rand(0.3, 0.95).toFixed(2));
      m.style.animationDuration = rand(15, 46).toFixed(1) + "s";
      m.style.animationDelay = (-rand(0, 46)).toFixed(1) + "s";
      frag.appendChild(m);
    }
    host.appendChild(frag);
  }

  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------------------------------------------------------
     Spirit cursor: a wisp plus a lagging trail
     Only paints while the pointer is moving; pauses when idle.
     --------------------------------------------------------- */
  function spiritCursor() {
    if (reduced || coarse || lite) return;

    const TRAIL = 5;
    const wisp = document.createElement("div");
    wisp.className = "wisp";
    wisp.setAttribute("aria-hidden", "true");
    document.body.appendChild(wisp);

    const trail = [];
    for (let i = 0; i < TRAIL; i++) {
      const t = document.createElement("div");
      t.className = "wisp__trail";
      t.setAttribute("aria-hidden", "true");
      t.style.opacity = (0.34 * (1 - i / TRAIL)).toFixed(3);
      t.style.width = t.style.height = (7 - (i * 5) / TRAIL).toFixed(1) + "px";
      document.body.appendChild(t);
      trail.push({ node: t, x: 0, y: 0 });
    }

    let mx = innerWidth / 2;
    let my = innerHeight / 2;
    let wx = mx;
    let wy = my;
    let running = false;
    let idleTimer = 0;

    function frame() {
      if (document.hidden) {
        running = false;
        return;
      }

      wx += (mx - wx) * 0.18;
      wy += (my - wy) * 0.18;
      wisp.style.transform = `translate3d(${wx}px, ${wy}px, 0)`;

      let px = wx;
      let py = wy;
      for (let i = 0; i < trail.length; i++) {
        const t = trail[i];
        t.x += (px - t.x) * 0.32;
        t.y += (py - t.y) * 0.32;
        t.node.style.transform = `translate3d(${t.x}px, ${t.y}px, 0)`;
        px = t.x;
        py = t.y;
      }

      const dx = Math.abs(mx - wx) + Math.abs(my - wy);
      if (dx < 0.4) {
        running = false;
        return;
      }
      requestAnimationFrame(frame);
    }

    function kick() {
      if (running || document.hidden) return;
      running = true;
      requestAnimationFrame(frame);
    }

    addEventListener(
      "pointermove",
      (e) => {
        mx = e.clientX;
        my = e.clientY;
        wisp.classList.add("is-awake");
        const hot = e.target.closest("a, button, .card, .board-letter, input, select");
        wisp.classList.toggle("is-hot", !!hot);
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => wisp.classList.remove("is-awake"), 1400);
        kick();
      },
      { passive: true }
    );

    addEventListener("pointerleave", () => wisp.classList.remove("is-awake"));
  }

  /* ---------------------------------------------------------
     Scroll reveals
     --------------------------------------------------------- */
  function scrollReveals() {
    const items = document.querySelectorAll("[data-reveal]");
    if (!items.length) return;

    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach((n) => n.classList.add("is-revealed"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );

    items.forEach((n) => {
      if (!n.style.getPropertyValue("--reveal-delay")) {
        const sibIndex = Array.prototype.indexOf.call(n.parentElement.children, n);
        n.style.setProperty("--reveal-delay", Math.min(sibIndex, 6) * 90 + "ms");
      }
      io.observe(n);
    });
  }

  /* ---------------------------------------------------------
     Header condenses once you leave the hero
     --------------------------------------------------------- */
  function stickyHeader() {
    const header = document.querySelector(".site-header");
    if (!header) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        header.classList.toggle("is-stuck", scrollY > 40);
        ticking = false;
      });
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------------------------------------------------------
     Mobile nav
     --------------------------------------------------------- */
  function navToggle() {
    const btn = document.querySelector(".nav-toggle");
    const nav = document.querySelector(".nav");
    if (!btn || !nav) return;

    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
    });

    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) {
        nav.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------------------------------------------------------
     Veil: fade the room to black between pages
     --------------------------------------------------------- */
  function veil() {
    const el = document.createElement("div");
    el.className = "veil is-lifting";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    setTimeout(() => el.classList.remove("is-lifting"), reduced ? 0 : 950);

    document.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;

      const href = a.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("http") ||
        a.target === "_blank" ||
        a.hasAttribute("download") ||
        e.metaKey ||
        e.ctrlKey
      )
        return;

      e.preventDefault();
      Atmosphere.leaveTo(href);
    });

    return el;
  }

  /* ---------------------------------------------------------
     Cards catch the light where the pointer sits
     --------------------------------------------------------- */
  function cardSheen() {
    if (coarse || lite) return;
    let pending = null;
    let raf = 0;
    document.addEventListener(
      "pointermove",
      (e) => {
        const card = e.target.closest(".card");
        if (!card) return;
        pending = { card, x: e.clientX, y: e.clientY };
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (!pending) return;
          const { card: c, x, y } = pending;
          pending = null;
          const r = c.getBoundingClientRect();
          c.style.setProperty("--mx", ((x - r.left) / r.width) * 100 + "%");
          c.style.setProperty("--my", ((y - r.top) / r.height) * 100 + "%");
        });
      },
      { passive: true }
    );
  }

  /* ---------------------------------------------------------
     Letter-by-letter reveal for [data-spell]
     --------------------------------------------------------- */
  function spellHeadings() {
    document.querySelectorAll("[data-spell]").forEach((node) => {
      const text = node.textContent;
      const step = Number(node.dataset.spellStep || 46);
      const offset = Number(node.dataset.spellDelay || 0);
      node.textContent = "";
      node.classList.add("spell-in");
      node.setAttribute("aria-label", text);

      [...text].forEach((ch, i) => {
        const span = document.createElement("span");
        span.textContent = ch === " " ? "\u00a0" : ch;
        span.style.setProperty("--d", offset + i * step + "ms");
        span.setAttribute("aria-hidden", "true");
        node.appendChild(span);
      });
    });
  }

  /* ---------------------------------------------------------
     Toasts
     --------------------------------------------------------- */
  let deck = null;

  function toast(message, kind, ms) {
    if (!deck) {
      deck = document.createElement("div");
      deck.className = "toast-deck";
      deck.setAttribute("role", "status");
      deck.setAttribute("aria-live", "polite");
      document.body.appendChild(deck);
    }

    const node = document.createElement("div");
    node.className = "toast" + (kind ? " toast--" + kind : "");
    node.textContent = message;
    deck.appendChild(node);

    setTimeout(() => {
      node.classList.add("is-leaving");
      setTimeout(() => node.remove(), 400);
    }, ms || 3400);
  }

  /* ---------------------------------------------------------
     Public surface
     --------------------------------------------------------- */
  const Atmosphere = {
    veilEl: null,
    toast,
    leaveTo(href) {
      if (reduced || !this.veilEl) {
        location.href = href;
        return;
      }
      this.veilEl.classList.add("is-closing");
      setTimeout(() => (location.href = href), 620);
    },
  };

  window.Atmosphere = Atmosphere;

  function init() {
    const { motes } = buildLayers();
    seedMotes(motes);
    spiritCursor();
    scrollReveals();
    stickyHeader();
    navToggle();
    cardSheen();
    spellHeadings();
    Atmosphere.veilEl = veil();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
