window.__cgxFx=true;
(function () {
  "use strict";

  // Bail out gracefully if any core dependency failed to load.
  if (!window.gsap || !window.ScrollTrigger) { return; }

  gsap.registerPlugin(ScrollTrigger);

  var REDUCE = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  // Safe querySelector that won't throw on invalid selectors (e.g. "#a:b", "#/").
  function safeSelect(sel, ctx) {
    try { return (ctx || document).querySelector(sel); }
    catch (e) { return null; }
  }

  // Guarantee a 3D rendering context on a PARENT element WITHOUT ever
  // touching the tweened element itself. CSS `perspective` must live on the
  // parent; `transform-style: preserve-3d` lets descendants share that 3D
  // space. If the parent already declares a perspective (e.g. via a Webflow
  // class) we leave it; we only ever set our own when none exists.
  function ensurePerspective(parent, px) {
    if (!parent || parent.nodeType !== 1) { return; }
    var cs = window.getComputedStyle ? window.getComputedStyle(parent) : null;
    var hasPersp = cs && cs.perspective && cs.perspective !== "none";
    if (!hasPersp) { parent.style.perspective = (px || 1200) + "px"; }
    parent.style.transformStyle = "preserve-3d";
  }

  // ----------------------------------------------------------
  // 1) LENIS smooth scroll, synced to ScrollTrigger (single RAF).
  //    autoRaf defaults to FALSE -> GSAP ticker is the only loop.
  //    Skipped entirely under reduced-motion (native scroll).
  // ----------------------------------------------------------
  var lenis = null;
  if (!REDUCE && window.Lenis) {
    lenis = new Lenis({
      lerp: 0.085,
      wheelMultiplier: 0.9,
      smoothWheel: true,
      anchors: false // we handle in-page anchors manually below
    });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // ----------------------------------------------------------
  // 2) Smooth-scroll for nav anchors via lenis.scrollTo.
  //    Ignore bare "#". safeSelect avoids SyntaxError on odd hrefs.
  //    Falls back to native if Lenis absent.
  // ----------------------------------------------------------
  $$("a[href^='#']").forEach(function (a) {
    a.addEventListener("click", function (e) {
      var href = a.getAttribute("href");
      if (!href || href === "#") { return; }
      var target = document.getElementById(href.slice(1)) || safeSelect(href);
      if (!target) { return; }
      e.preventDefault();
      if (lenis) {
        lenis.scrollTo(target, { offset: 0 });
      } else {
        target.scrollIntoView(REDUCE ? { behavior: "auto" } : { behavior: "smooth" });
      }
    });
  });

  // ==========================================================
  //  EXISTING EFFECTS (preserved). Each is null-safe and, under
  //  reduced motion, jumps straight to its end / revealed state.
  // ==========================================================

  // --- (E1) Scroll progress bar [data-progress] ---
  (function () {
    var bar = $("[data-progress]");
    if (!bar) { return; }
    if (REDUCE) { gsap.set(bar, { scaleX: 1, transformOrigin: "left center" }); return; }
    gsap.set(bar, { scaleX: 0, transformOrigin: "left center" });
    gsap.to(bar, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: {
        trigger: document.documentElement,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.3,
        invalidateOnRefresh: true
      }
    });
  })();

  // --- (E2) Generic reveals [data-animate] ---
  (function () {
    var els = $$("[data-animate]");
    if (!els.length) { return; }
    if (REDUCE) { gsap.set(els, { y: 0, autoAlpha: 1 }); return; }
    els.forEach(function (el) {
      gsap.fromTo(el,
        { y: 28, autoAlpha: 0 },
        {
          y: 0, autoAlpha: 1, duration: 0.7, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%", invalidateOnRefresh: true }
        }
      );
    });
  })();

  // --- (E3) Staggered children reveals [data-stagger] ---
  (function () {
    var groups = $$("[data-stagger]");
    if (!groups.length) { return; }
    groups.forEach(function (group) {
      var sel = group.getAttribute("data-stagger");
      var kids = (sel && sel.length) ? $$(sel, group)
                 : Array.prototype.slice.call(group.children);
      if (!kids.length) { return; }
      if (REDUCE) { gsap.set(kids, { y: 0, autoAlpha: 1 }); return; }
      gsap.fromTo(kids,
        { y: 24, autoAlpha: 0 },
        {
          y: 0, autoAlpha: 1, duration: 0.6, ease: "power3.out", stagger: 0.06,
          scrollTrigger: { trigger: group, start: "top 80%", invalidateOnRefresh: true }
        }
      );
    });
  })();

  // --- (E4) Text scramble reveal [data-scramble] ---
  //     Guard: skip elements that contain child markup so we never
  //     flatten spans / <br> / icons by overwriting textContent.
  (function () {
    var els = $$("[data-scramble]");
    if (!els.length) { return; }
    var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@%&$*+=-_/\\<>[]{}";
    els.forEach(function (el) {
      if (el.children && el.children.length > 0) { return; }
      var finalText = el.getAttribute("data-scramble-text") || el.textContent || "";
      if (REDUCE) { el.textContent = finalText; return; }
      var state = { p: 0 };
      function render() {
        var revealed = Math.floor(state.p * finalText.length);
        var out = "";
        for (var i = 0; i < finalText.length; i++) {
          var ch = finalText.charAt(i);
          if (i < revealed || ch === " " || ch === "\n") {
            out += ch;
          } else {
            out += GLYPHS.charAt((Math.random() * GLYPHS.length) | 0);
          }
        }
        el.textContent = out;
      }
      gsap.to(state, {
        p: 1,
        duration: Math.min(2.2, 0.4 + finalText.length * 0.03),
        ease: "power1.inOut",
        onUpdate: render,
        onComplete: function () { el.textContent = finalText; },
        scrollTrigger: { trigger: el, start: "top 85%", once: true }
      });
    });
  })();

  // --- (E5) Divider scaleX draw-in [data-divider] ---
  (function () {
    var els = $$("[data-divider]");
    if (!els.length) { return; }
    if (REDUCE) { gsap.set(els, { scaleX: 1, transformOrigin: "left center" }); return; }
    els.forEach(function (el) {
      gsap.fromTo(el,
        { scaleX: 0, transformOrigin: "left center" },
        {
          scaleX: 1, duration: 0.9, ease: "expo.out",
          scrollTrigger: { trigger: el, start: "top 88%", invalidateOnRefresh: true }
        }
      );
    });
  })();

  // --- (E6) Infinite marquee loop [data-marquee-track] ---
  //     Distance recomputed on resize + after fonts load so the
  //     repeat seam stays invisible after late layout shifts.
  (function () {
    var tracks = $$("[data-marquee-track]");
    if (!tracks.length || REDUCE) { return; }
    var tweens = [];
    function build() {
      tweens.forEach(function (tw) { tw.kill(); });
      tweens = [];
      tracks.forEach(function (track) {
        var speed = parseFloat(track.getAttribute("data-marquee-track")) || 20; // seconds
        var dir = track.getAttribute("data-marquee-dir") === "right" ? 1 : -1;
        var distance = track.scrollWidth / 2; // assumes duplicated content
        if (!distance) { return; }
        gsap.set(track, { x: dir < 0 ? 0 : -distance });
        var tw = gsap.to(track, {
          x: dir < 0 ? -distance : 0,
          duration: speed,
          ease: "none",
          repeat: -1,
          modifiers: {
            x: function (x) {
              var v = parseFloat(x);
              return (dir < 0 ? -(Math.abs(v) % distance) : -(distance - (Math.abs(v) % distance))) + "px";
            }
          }
        });
        tweens.push(tw);
      });
    }
    build();
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(build, 200);
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(build);
    }
  })();

  // --- (E7) Count-up numbers [data-count] ---
  //     Strips commas from input; optional thousands grouping on
  //     output via data-count-group="true".
  (function () {
    var els = $$("[data-count]");
    if (!els.length) { return; }
    els.forEach(function (n) {
      var raw = (n.getAttribute("data-count") || "").replace(/,/g, "");
      var end = parseFloat(raw) || 0;
      var pad = parseInt(n.getAttribute("data-count-pad"), 10) || 0;
      var group = n.getAttribute("data-count-group") === "true";
      var suffix = n.getAttribute("data-count-suffix") || "";
      var prefix = n.getAttribute("data-count-prefix") || "";
      function write(val) {
        var s = String(Math.round(val));
        if (pad > 0) { while (s.length < pad) { s = "0" + s; } }
        if (group) { s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
        n.textContent = prefix + s + suffix;
      }
      if (REDUCE) { write(end); return; }
      var o = { v: 0 };
      gsap.to(o, {
        v: end, duration: 1.4, ease: "power1.out", snap: { v: 1 },
        onUpdate: function () { write(o.v); },
        scrollTrigger: { trigger: n, start: "top 85%", once: true }
      });
    });
  })();

  // --- (E8) Wordmark parallax [data-wordmark] ---
  (function () {
    var els = $$("[data-wordmark]");
    if (!els.length || REDUCE) {
      if (els.length) { gsap.set(els, { yPercent: 0 }); }
      return;
    }
    els.forEach(function (el) {
      var amt = parseFloat(el.getAttribute("data-wordmark")) || 12; // % of travel
      gsap.fromTo(el,
        { yPercent: amt },
        {
          yPercent: -amt, ease: "none",
          scrollTrigger: {
            trigger: el, start: "top bottom", end: "bottom top",
            scrub: true, invalidateOnRefresh: true
          }
        }
      );
    });
  })();

  // --- (E9) Load-fill bars [data-load] ---
  (function () {
    var els = $$("[data-load]");
    if (!els.length) { return; }
    els.forEach(function (el) {
      var pct = parseFloat(el.getAttribute("data-load"));
      if (isNaN(pct)) { pct = 100; }
      if (REDUCE) { gsap.set(el, { width: pct + "%" }); return; }
      gsap.fromTo(el,
        { width: "0%" },
        {
          width: pct + "%", duration: 1.2, ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true }
        }
      );
    });
  })();

  // --- (E10) Accordion [data-accordion] / [data-accordion-trigger] ---
  //     overwrite:true kills competing panel tweens (spam-click safe);
  //     a single debounced ScrollTrigger.refresh() per interaction
  //     avoids layout thrash.
  (function () {
    var roots = $$("[data-accordion]");
    if (!roots.length) { return; }
    var refreshPending = false;
    function scheduleRefresh() {
      if (refreshPending) { return; }
      refreshPending = true;
      requestAnimationFrame(function () {
        refreshPending = false;
        ScrollTrigger.refresh();
      });
    }
    roots.forEach(function (root) {
      var items = $$("[data-accordion-item]", root);
      if (!items.length) { items = [root]; }
      items.forEach(function (item) {
        var trigger = $("[data-accordion-trigger]", item);
        var panel = $("[data-accordion-panel]", item);
        if (!trigger || !panel) { return; }
        gsap.set(panel, { height: 0, overflow: "hidden", autoAlpha: 0 });
        item.setAttribute("data-open", "false");
        trigger.setAttribute("aria-expanded", "false");
        trigger.style.cursor = "pointer";
        trigger.addEventListener("click", function () {
          var isOpen = item.getAttribute("data-open") === "true";
          if (root.getAttribute("data-accordion") !== "multi") {
            items.forEach(function (other) {
              if (other === item) { return; }
              var op = $("[data-accordion-panel]", other);
              var ot = $("[data-accordion-trigger]", other);
              if (op && other.getAttribute("data-open") === "true") {
                other.setAttribute("data-open", "false");
                if (ot) { ot.setAttribute("aria-expanded", "false"); }
                if (REDUCE) { gsap.set(op, { height: 0, autoAlpha: 0 }); }
                else { gsap.to(op, { height: 0, autoAlpha: 0, duration: 0.35, ease: "power2.inOut",
                  overwrite: true, onComplete: scheduleRefresh }); }
              }
            });
          }
          if (isOpen) {
            item.setAttribute("data-open", "false");
            trigger.setAttribute("aria-expanded", "false");
            if (REDUCE) { gsap.set(panel, { height: 0, autoAlpha: 0 }); scheduleRefresh(); }
            else { gsap.to(panel, { height: 0, autoAlpha: 0, duration: 0.35, ease: "power2.inOut",
              overwrite: true, onComplete: scheduleRefresh }); }
          } else {
            item.setAttribute("data-open", "true");
            trigger.setAttribute("aria-expanded", "true");
            if (REDUCE) { gsap.set(panel, { height: "auto", autoAlpha: 1 }); scheduleRefresh(); }
            else { gsap.to(panel, { height: "auto", autoAlpha: 1, duration: 0.4, ease: "power2.inOut",
              overwrite: true, onComplete: scheduleRefresh }); }
          }
        });
      });
    });
  })();

  // ==========================================================
  //  NEW EFFECTS. All scrub/3D/pin gated behind reduced-motion
  //  -> static reveal fallback.
  // ==========================================================

  // --- (N1) HERO 3D depth: [data-depth] layers + hero content ---
  //     FIX: perspective + preserve-3d are guaranteed on the PARENT
  //     of every depth layer and of the hero content (never on the
  //     tweened element) so z/rotationX render with real depth even
  //     if the Webflow CSS omits it.
  (function () {
    var hero = $("[data-hero]") || $(".cgx-hero") || $(".hero");
    var layers = $$("[data-depth]");
    var content = $("[data-hero-content]");
    if (!hero && !layers.length) { return; }

    if (REDUCE) {
      if (layers.length) { gsap.set(layers, { z: 0, y: 0, autoAlpha: 1 }); }
      if (content) { gsap.set(content, { rotationX: 0, z: 0, autoAlpha: 1 }); }
      return;
    }

    if (hero) { ensurePerspective(hero, 1200); }
    layers.forEach(function (layer) { ensurePerspective(layer.parentNode, 1200); });
    if (content && content.parentNode) { ensurePerspective(content.parentNode, 1200); }

    if (layers.length) {
      layers.forEach(function (layer) {
        var depth = parseFloat(layer.getAttribute("data-depth")) || 1;
        gsap.to(layer, {
          z: 220 * depth,          // translateZ: deeper layers rush forward
          yPercent: -28 * depth,   // parallax: deeper layers travel more
          ease: "none",
          scrollTrigger: {
            trigger: hero || layer,
            start: "top top",
            end: "bottom top",
            scrub: 0.6,
            invalidateOnRefresh: true
          }
        });
      });
    }

    if (content) {
      gsap.to(content, {
        rotationX: 14, z: -240, autoAlpha: 0, transformOrigin: "50% 0%",
        ease: "none",
        scrollTrigger: {
          trigger: hero || content,
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
          invalidateOnRefresh: true
        }
      });
    }
  })();

  // --- (N2) [data-tilt3d] scrubbed 3D reveal ---
  //     FIX: establish perspective on each element's PARENT and
  //     preserve-3d on the element so the tilt is never flat.
  (function () {
    var els = $$("[data-tilt3d]");
    if (!els.length) { return; }
    if (REDUCE) { gsap.set(els, { rotationX: 0, z: 0, autoAlpha: 1 }); return; }
    els.forEach(function (el) {
      ensurePerspective(el.parentNode, 1200);
      el.style.transformStyle = "preserve-3d";
      gsap.fromTo(el,
        { rotationX: 35, z: -300, autoAlpha: 0, transformOrigin: "50% 100%" },
        {
          rotationX: 0, z: 0, autoAlpha: 1, ease: "none",
          scrollTrigger: {
            trigger: el, start: "top 85%", end: "top 40%",
            scrub: true, invalidateOnRefresh: true
          }
        }
      );
    });
  })();

  // --- (N3) Horizontal pinned showcase [data-hpin] + [data-htrack] ---
  //     FIX: guard against a track that is NOT wider than the viewport.
  //     amount() is computed fresh inside the x/end functions (so
  //     invalidateOnRefresh re-evaluates it) and clamped to >= 0. If the
  //     track does not overflow at build time we skip creating the pin
  //     entirely (no zero/negative-travel trap) and lazily build it later
  //     if fonts/images/resize make it overflow.
  (function () {
    var section = $("[data-hpin]");
    if (!section) { return; }
    var track = $("[data-htrack]", section) || $("[data-htrack]");
    if (!track) { return; }

    if (REDUCE) {
      // Static, readable, non-pinned block (no inline display override:
      // leave Webflow's stylesheet layout intact).
      gsap.set(track, { x: 0 });
      return;
    }

    function amount() { return track.scrollWidth - window.innerWidth; }

    function buildPin() {
      gsap.to(track, {
        x: function () { var a = amount(); return a > 0 ? -a : 0; },
        ease: "none",
        scrollTrigger: {
          trigger: section,
          pin: true,
          scrub: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          end: function () { var a = amount(); return "+=" + (a > 0 ? a : 0); }
        }
      });
      ScrollTrigger.refresh();
    }

    if (amount() > 0) {
      buildPin();
    } else {
      // Track does not overflow yet — wait for late layout, then build once.
      var built = false;
      var tryBuild = function () {
        if (built) { return; }
        if (amount() > 0) { built = true; buildPin(); }
      };
      window.addEventListener("load", tryBuild);
      if (document.fonts && document.fonts.ready) { document.fonts.ready.then(tryBuild); }
      window.addEventListener("resize", tryBuild);
    }
  })();

  // --- (N4) Background invert via SHARED active-count ---
  //     FIX: color derives from a single shared counter instead of
  //     per-trigger toggles, so the final target never depends on the
  //     order in which adjacent [data-invert] triggers fire. GOLD while
  //     one or more invert sections are active; DARK only when none are.
  (function () {
    var bg = $("[data-bg]");
    var sections = $$("[data-invert]");
    if (!bg || !sections.length) { return; }

    var DARK = "#0B0B0B";
    var GOLD = "#FFD400";
    gsap.set(bg, { backgroundColor: DARK });

    if (REDUCE) { return; } // keep dark default; no scroll-driven swap

    var active = 0;
    function apply() {
      gsap.to(bg, {
        backgroundColor: active > 0 ? GOLD : DARK,
        duration: 0.5,
        ease: "power2.out",
        overwrite: "auto"
      });
    }
    sections.forEach(function (sec) {
      ScrollTrigger.create({
        trigger: sec,
        start: "top center",
        end: "bottom center",
        invalidateOnRefresh: true,
        onEnter:     function () { active++; apply(); },
        onLeave:     function () { active = Math.max(0, active - 1); apply(); },
        onEnterBack: function () { active++; apply(); },
        onLeaveBack: function () { active = Math.max(0, active - 1); apply(); }
      });
    });
  })();

  // ----------------------------------------------------------
  //  Refresh after async layout settles (fonts/images/Webflow).
  // ----------------------------------------------------------
  
  /* ===== SON DAVEN EFFECT MODULES (M1-M8) ===== */
/* ============================================================================
   BASELINE NOTE (re: "ES5-safe" checklist item)
   These modules are authored for modern EVERGREEN browsers. They hard-depend on
   runtime APIs that DO NOT EXIST on a true ES5 engine (IE11) and cannot be
   polyfilled away by transpilation: Promise, ResizeObserver, IntersectionObserver,
   getContext('2d',{willReadFrequently}), gsap.matchMedia, ScrollTrigger.
   Down-leveling const/let/arrows to ES5 syntax would NOT make this run on ES5,
   it would only hide the real (runtime-API) incompatibility. We therefore keep
   ES2017+ syntax. If a literal ES5 target is mandated, this whole feature must be
   re-scoped (no canvas/observers/gsap), not merely transpiled.
   In-scope helpers consumed (never redeclared): REDUCE, $, $$, safeSelect, lenis,
   gsap, ScrollTrigger. gsap+ScrollTrigger assumed already registered; lenis synced.
   ========================================================================== */

/* ============================================================================
   MODULE 1 — TEXT-FILL ON SCROLL  (per-word color scrub; never background-clip)
   Targets: [data-textfill]. Splits into .tf-word spans (XSS-safe via textContent),
   scrubs muted->bright. REDUCE => final bright color, no scrub.
   ========================================================================== */
(function () {
  const heads = $$('[data-textfill]');
  if (!heads || !heads.length) return;
  const MUTED = '#555049', BRIGHT = '#ECECEC';
  const mm = gsap.matchMedia();
  heads.forEach((heading) => {
    if (!heading || heading.dataset.tfReady === '1') return;
    heading.dataset.tfReady = '1';
    const words = (heading.textContent || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;
    // Build spans with createElement + textContent so '<', '>', '&' in the
    // heading's plain text are NOT interpreted as markup (no innerHTML injection).
    const frag = document.createDocumentFragment();
    words.forEach((w, idx) => {
      if (idx > 0) frag.appendChild(document.createTextNode(' '));
      const span = document.createElement('span');
      span.className = 'tf-word';
      span.textContent = w;
      frag.appendChild(span);
    });
    heading.textContent = '';
    heading.appendChild(frag);
    const wordEls = heading.querySelectorAll('.tf-word');
    if (!wordEls.length) return;
    if (REDUCE) { gsap.set(wordEls, { color: BRIGHT }); return; }
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tw = gsap.fromTo(wordEls,
        { color: MUTED },
        { color: BRIGHT, ease: 'none', stagger: { each: 0.05, from: 'start' },
          scrollTrigger: { trigger: heading, start: 'top 80%', end: 'bottom 55%',
            scrub: true, invalidateOnRefresh: true } });
      return () => { if (tw && tw.scrollTrigger) tw.scrollTrigger.kill(); if (tw) tw.kill(); };
    });
  });
})();

/* ============================================================================
   MODULE 2 — SCATTERED SCROLL GALLERY  (parallax y + de-rotate to upright)
   Targets: .gallery containing .gallery-card[data-rot][data-speed].
   Never pins .gallery (parallax-only). Desktop drift >= 768px.
   ========================================================================== */
(function () {
  const cards = $$('.gallery-card');
  if (!cards || !cards.length) return;
  if (REDUCE) {
    cards.forEach((c) => { if (c) gsap.set(c, { rotation: 0, y: 0, clearProps: 'transform' }); });
    return;
  }
  const mm = gsap.matchMedia();
  mm.add({ isDesktop: '(min-width: 768px)', noRM: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
    const isDesktop = !!(ctx.conditions && ctx.conditions.isDesktop);
    const tweens = [];
    cards.forEach((card) => {
      if (!card) return;
      const gallery = card.closest('.gallery');
      if (!gallery) return;
      const startRot = parseFloat(card.dataset.rot || '0') || 0;
      const speed = parseFloat(card.dataset.speed || '1') || 1;
      gsap.set(card, { rotation: startRot });
      const drift = (isDesktop ? -120 : -50) * speed;
      tweens.push(gsap.to(card, { y: drift, rotation: 0, ease: 'none',
        scrollTrigger: { trigger: gallery, start: 'top bottom', end: 'bottom top',
          scrub: 1, invalidateOnRefresh: true } }));
    });
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener('load', onLoad);
    return () => {
      window.removeEventListener('load', onLoad);
      tweens.forEach((t) => { if (t && t.scrollTrigger) t.scrollTrigger.kill(); if (t) t.kill(); });
    };
  });
})();

/* ============================================================================
   MODULE 3 — ASCII-COMB REVEAL  (canvas vertical bars retract over an <img>)
   Targets: figure.comb > img + canvas.comb__cv. DPR-aware, capped, debounced.
   ========================================================================== */
(function () {
  const figs = $$('.comb');
  if (!figs || !figs.length) return;

  function setup(fig) {
    if (!fig) return null;
    const cv = (typeof safeSelect === 'function') ? safeSelect(fig, '.comb__cv') : fig.querySelector('.comb__cv');
    if (!cv || !cv.getContext) return null;
    const c = cv.getContext('2d');
    if (!c) return null;
    let W = 0, H = 0, dpr = 1, bars = [], lastP = 1;
    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = fig.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const colW = 14, cols = Math.max(1, Math.ceil(W / colW));
      bars = Array.from({ length: cols }, (_, i) => ({ x: i * colW, len: H * (0.35 + Math.random() * 0.65) }));
    }
    function draw(p) {
      lastP = p;
      c.clearRect(0, 0, W, H);
      c.fillStyle = '#0B0B0B';
      const toothW = 10;
      for (let k = 0; k < bars.length; k++) {
        const b = bars[k], h = b.len * p;
        if (h <= 0) continue;
        c.fillRect(Math.round(b.x), 0, toothW, Math.round(h));
      }
    }
    return { build, draw, fig, cv, get p() { return lastP; } };
  }

  const instances = figs.map(setup).filter(Boolean);
  if (!instances.length) return;
  instances.forEach((i) => i.build());

  if (REDUCE) { instances.forEach((i) => i.draw(0)); return; }

  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const tweens = [];
    instances.forEach((c) => {
      c.draw(1);
      const proxy = { p: 1 };
      tweens.push(gsap.to(proxy, { p: 0, ease: 'none', onUpdate: () => c.draw(proxy.p),
        scrollTrigger: { trigger: c.fig, start: 'top 75%', end: 'bottom 40%',
          scrub: true, invalidateOnRefresh: true } }));
    });
    let rt;
    const onResize = () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        instances.forEach((c) => { c.build(); c.draw(c.p); });
        ScrollTrigger.refresh();
      }, 150);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(rt);
      window.removeEventListener('resize', onResize);
      tweens.forEach((t) => { if (t && t.scrollTrigger) t.scrollTrigger.kill(); if (t) t.kill(); });
    };
  });
})();

/* ============================================================================
   MODULE 4 — FULLSCREEN MENU  (clip-path open/close, Lenis lock, Esc, close,
   [data-menu-close], focus trap + restore). EXACT spec hooks:
   #overlay.menu, #menuOpen[aria-expanded], #menuClose, <a> inside #overlay.
   ========================================================================== */
(function () {
  const overlay = $('#overlay');
  const openBtn = $('#menuOpen');
  if (!overlay || !openBtn) return;
  const closeBtn = $('#menuClose');
  const links = overlay.querySelectorAll('a');
  let lastFocused = null, isOpen = false;

  const dur = REDUCE ? 0 : 0.6;
  const menuTL = gsap.timeline({
    paused: true,
    defaults: { ease: 'power3.inOut', duration: dur },
    onReverseComplete: () => {
      gsap.set(overlay, { visibility: 'hidden' });
      overlay.setAttribute('aria-hidden', 'true');
    },
  })
    .set(overlay, { visibility: 'visible' })
    .to(overlay, { clipPath: 'inset(0 0 0% 0)' })
    .from(links, { yPercent: REDUCE ? 0 : 120, opacity: REDUCE ? 1 : 0,
      duration: REDUCE ? 0 : 0.4, stagger: REDUCE ? 0 : 0.06 }, '-=0.25');

  function focusables() {
    return overlay.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea');
  }
  function trap(e) {
    if (e.key !== 'Tab') return;
    const f = focusables();
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function onKey(e) { if (e.key === 'Escape') closeMenu(); else trap(e); }

  function focusFirst() {
    const target = closeBtn || focusables()[0] || overlay;
    if (target && target.focus) target.focus();
  }

  function openMenu() {
    if (isOpen) return; isOpen = true;
    lastFocused = document.activeElement;
    openBtn.setAttribute('aria-expanded', 'true');
    overlay.setAttribute('aria-hidden', 'false');
    if (typeof lenis !== 'undefined' && lenis && lenis.stop) lenis.stop();
    menuTL.timeScale(1).play();
    // Defer focus one frame so the timeline's visibility:visible set has flushed.
    requestAnimationFrame(focusFirst);
    document.addEventListener('keydown', onKey);
  }
  function closeMenu() {
    if (!isOpen) return; isOpen = false;
    openBtn.setAttribute('aria-expanded', 'false');
    menuTL.timeScale(1.4).reverse();
    if (typeof lenis !== 'undefined' && lenis && lenis.start) lenis.start();
    document.removeEventListener('keydown', onKey);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  openBtn.addEventListener('click', openMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);
  overlay.querySelectorAll('[data-menu-close]').forEach((b) => { if (b) b.addEventListener('click', closeMenu); });
})();

/* ============================================================================
   MODULE 5 — PHOTO -> ASCII  (render ONCE; reveal on scroll; procedural
   fallback on load error OR canvas taint). Targets: canvas.ascii-photo[data-src].
   crossOrigin set BEFORE src; getImageData in try/catch; never blank.
   ========================================================================== */
(function () {
  const tiles = $$('canvas.ascii-photo');
  if (!tiles || !tiles.length) return;
  const RAMP = ' .:-=+*#%@';

  function rampOf(b) { return RAMP[Math.min(RAMP.length - 1, (b / 255 * (RAMP.length - 1)) | 0)]; }

  function proceduralAscii(cols, rows) {
    rows = rows || Math.round(cols * 0.3);
    const lines = [];
    for (let y = 0; y < rows; y++) {
      let line = '';
      for (let x = 0; x < cols; x++) {
        const v = (Math.sin(x * 0.18) + Math.cos(y * 0.27) + 2) / 4;
        line += RAMP[Math.min(RAMP.length - 1, (v * (RAMP.length - 1)) | 0)];
      }
      lines.push(line);
    }
    return { lines: lines, cols: cols, rows: rows };
  }

  function imageToAscii(img, cols, charAspect) {
    charAspect = charAspect || 0.5;
    const ratio = (img.naturalHeight / img.naturalWidth) || 0.66;
    const rows = Math.max(1, Math.round(cols * ratio * charAspect));
    const off = document.createElement('canvas');
    off.width = cols; off.height = rows;
    const octx = off.getContext('2d', { willReadFrequently: true });
    if (!octx) return null;
    octx.imageSmoothingEnabled = true;
    octx.drawImage(img, 0, 0, cols, rows);
    let data;
    try { data = octx.getImageData(0, 0, cols, rows).data; }
    catch (e) { return null; }
    const lines = new Array(rows);
    for (let y = 0; y < rows; y++) {
      let line = '';
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const a = data[i + 3] / 255;
        const b = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * a;
        line += rampOf(b);
      }
      lines[y] = line;
    }
    return { lines: lines, cols: cols, rows: rows };
  }

  function renderAscii(canvas, ascii, ink, bg, cellW) {
    if (!ascii || !canvas || !canvas.getContext) return;
    cellW = cellW || 8;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cellH = Math.round(cellW / 0.5);
    const wCss = ascii.cols * cellW, hCss = ascii.rows * cellH;
    canvas.style.width = wCss + 'px'; canvas.style.height = hCss + 'px';
    canvas.width = Math.round(wCss * dpr); canvas.height = Math.round(hCss * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = bg || '#0B0B0B'; ctx.fillRect(0, 0, wCss, hCss);
    ctx.fillStyle = ink || '#FFD400';
    ctx.font = cellH + 'px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    ctx.textBaseline = 'top';
    for (let y = 0; y < ascii.rows; y++) ctx.fillText(ascii.lines[y], 0, y * cellH);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('img load failed'));
      img.src = src;
    });
  }

  function reveal(canvas) {
    if (REDUCE) { gsap.set(canvas, { opacity: 1, clearProps: 'transform' }); return; }
    gsap.fromTo(canvas, { opacity: 0, y: 24 },
      { opacity: 1, y: 0, ease: 'power2.out', duration: 0.8,
        scrollTrigger: { trigger: canvas, start: 'top 85%', once: true } });
  }

  tiles.forEach((canvas) => {
    if (!canvas || canvas.dataset.asciiReady === '1') return;
    canvas.dataset.asciiReady = '1';
    const src = canvas.dataset.src || '';
    const cols = parseInt(canvas.dataset.cols || '120', 10) || 120;
    const ink = canvas.dataset.ink || '#FFD400';
    const cellW = parseInt(canvas.dataset.cell || '8', 10) || 8;
    if (!REDUCE) gsap.set(canvas, { opacity: 0 });

    const renderProc = () => { renderAscii(canvas, proceduralAscii(cols), ink, '#0B0B0B', cellW); reveal(canvas); };
    if (!src) { renderProc(); return; }
    loadImage(src).then((img) => {
      let ascii = null;
      try { ascii = imageToAscii(img, cols); } catch (e) { ascii = null; }
      renderAscii(canvas, ascii || proceduralAscii(cols), ink, '#0B0B0B', cellW);
      reveal(canvas);
    }).catch(renderProc);
  });
})();

/* ============================================================================
   MODULE 6 — FLYING ASCII BIRDS  (rAF flock, DPR-aware, IO-paused offscreen)
   Targets: canvas[data-birds]. Capped 12-20. REDUCE => single static frame.
   ========================================================================== */
(function () {
  const canvases = $$('canvas[data-birds]');
  if (!canvases || !canvases.length) return;
  const COL = { bg: '#0B0B0B', accent: '#FFD400', dim: '#ECECEC' };
  const GLYPH = ['^', 'v', '~', '-', 'M'];

  function fit(canvas, ctx) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: w, h: h };
  }

  canvases.forEach((canvas) => {
    const ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!canvas || !ctx) return;
    let size = fit(canvas, ctx);
    const N = Math.max(12, Math.min(20, parseInt(canvas.dataset.birds || '16', 10) || 16));
    const FS = parseInt(canvas.dataset.fontSize || '16', 10) || 16;
    let birds = [], raf = 0, last = 0, running = false;

    function init(w, h) {
      birds = Array.from({ length: N }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: 18 + Math.random() * 34, amp: 4 + Math.random() * 10,
        freq: 1.4 + Math.random() * 1.8, phase: Math.random() * Math.PI * 2,
        gi: (Math.random() * GLYPH.length) | 0, flap: 6 + Math.random() * 6,
        hot: Math.random() < 0.3,
      }));
    }
    init(size.w, size.h);

    function paintStatic() {
      ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, size.w, size.h);
      ctx.font = FS + 'px ui-monospace, monospace'; ctx.textBaseline = 'middle';
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass === 0 ? COL.dim : COL.accent;
        for (const b of birds) {
          if (b.hot !== (pass === 1)) continue;
          ctx.fillText(GLYPH[b.gi], Math.round(b.x), Math.round(b.y));
        }
      }
    }

    function frame(t) {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      const w = size.w, h = size.h, time = t / 1000;
      ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, w, h);
      ctx.font = FS + 'px ui-monospace, monospace'; ctx.textBaseline = 'middle';
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass === 0 ? COL.dim : COL.accent;
        for (const b of birds) {
          if (b.hot !== (pass === 1)) continue;
          b.x += b.vx * dt;
          if (b.x > w + FS) { b.x = -FS; b.y = Math.random() * h; }
          const yy = b.y + Math.sin(time * b.freq + b.phase) * b.amp;
          const gi = (b.gi + Math.floor(time * b.flap)) % GLYPH.length;
          ctx.fillText(GLYPH[gi], Math.round(b.x), Math.round(yy));
        }
      }
      raf = requestAnimationFrame(frame);
    }
    const start = () => { if (running || REDUCE) return; running = true; last = 0; raf = requestAnimationFrame(frame); };
    const stop = () => { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; };

    if (REDUCE) { paintStatic(); }

    const ro = new ResizeObserver(() => { size = fit(canvas, ctx); init(size.w, size.h); if (REDUCE) paintStatic(); });
    ro.observe(canvas);
    const io = new IntersectionObserver((e) => {
      const vis = !!(e[0] && e[0].isIntersecting);
      if (REDUCE) { if (vis) paintStatic(); return; }
      if (vis) start(); else stop();
    }, { threshold: 0 });
    io.observe(canvas);
  });
})();

/* ============================================================================
   MODULE 7 — Z-TUNNEL  (scroll-driven ASCII bars, center clearing for text)
   Targets: canvas[data-tunnel] (+ optional data-tunnel-trigger selector).
   Scroll-driven (no rAF); IO gates repaints; REDUCE => static mid-progress.
   ========================================================================== */
(function () {
  const canvases = $$('canvas[data-tunnel]');
  if (!canvases || !canvases.length) return;
  const COL = { bg: '#0B0B0B', accent: '#FFD400', dim: '#ECECEC' };

  function fit(canvas, ctx) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: w, h: h };
  }

  canvases.forEach((canvas) => {
    const ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!canvas || !ctx) return;
    const RINGS = parseInt(canvas.dataset.rings || '26', 10) || 26;
    const PER = parseInt(canvas.dataset.perRing || '36', 10) || 36;
    const CLEAR = parseFloat(canvas.dataset.clear || '0.18') || 0.18;
    let size = fit(canvas, ctx), progress = 0, visible = true;

    function render() {
      const w = size.w, h = size.h, cx = w / 2, cy = h / 2;
      const clearR = Math.min(w, h) * CLEAR;
      ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, w, h);
      for (let r = 0; r < RINGS; r++) {
        const z = ((r / RINGS) + progress) % 1;
        const persp = 1 / (0.15 + z * 1.85);
        const radius = clearR + persp * Math.min(w, h) * 0.55;
        const barH = 6 + persp * 70, near = persp > 1;
        ctx.fillStyle = near ? COL.accent : COL.dim;
        ctx.globalAlpha = Math.min(1, 0.12 + persp * 0.55);
        const rot = progress * Math.PI * 2 + r * 0.05;
        for (let i = 0; i < PER; i++) {
          const ang = (i / PER) * Math.PI * 2 + rot;
          const x = cx + Math.cos(ang) * radius, y = cy + Math.sin(ang) * radius;
          if (radius < clearR) continue;
          const bw = Math.max(1, persp * 2.2);
          ctx.fillRect(Math.round(x), Math.round(y - barH / 2), bw, barH);
        }
      }
      ctx.globalAlpha = 1;
    }
    function setProgress(p) { progress = Math.max(0, Math.min(1, p || 0)); if (visible) render(); }

    const ro = new ResizeObserver(() => { size = fit(canvas, ctx); render(); });
    ro.observe(canvas);
    const io = new IntersectionObserver((e) => {
      visible = !!(e[0] && e[0].isIntersecting); if (visible) render();
    }, { threshold: 0 });
    io.observe(canvas);
    render();

    if (REDUCE) { setProgress(0.5); return; }

    const sel = canvas.dataset.tunnelTrigger;
    let trigger = canvas;
    if (sel) {
      const found = (typeof safeSelect === 'function') ? safeSelect(document, sel) : (function () {
        try { return document.querySelector(sel); } catch (e) { return null; }
      })();
      if (found) trigger = found;
    }
    ScrollTrigger.create({
      trigger: trigger, start: 'top bottom', end: 'bottom top',
      scrub: true, invalidateOnRefresh: true,
      onUpdate: (self) => setProgress(self.progress),
    });
  });
})();

/* ============================================================================
   MODULE 8 — VERTICAL-LINE FIELD  (slow ripple for footers/section bases)
   Targets: canvas[data-linefield]. rAF, DPR-aware, IO-paused offscreen.
   REDUCE => single static frame.
   ========================================================================== */
(function () {
  const canvases = $$('canvas[data-linefield]');
  if (!canvases || !canvases.length) return;
  const COL = { bg: '#0B0B0B', accent: '#FFD400', dim: '#ECECEC' };

  function fit(canvas, ctx) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: w, h: h };
  }

  canvases.forEach((canvas) => {
    const ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!canvas || !ctx) return;
    const GAP = parseInt(canvas.dataset.gap || '10', 10) || 10;
    let size = fit(canvas, ctx), raf = 0, last = 0, running = false;

    function paint(time) {
      const w = size.w, h = size.h, base = h - 4, n = Math.ceil(w / GAP);
      ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, w, h);
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass === 0 ? COL.dim : COL.accent;
        for (let i = 0; i < n; i++) {
          const accent = i % 7 === 0;
          if (accent !== (pass === 1)) continue;
          const x = i * GAP, t = time * 0.6;
          const hgt = 8 + (Math.sin(i * 0.25 + t) * 0.5 + 0.5) * 26
                        + (Math.sin(i * 0.07 - t * 0.7) * 0.5 + 0.5) * 18;
          ctx.fillRect(Math.round(x), Math.round(base - hgt), 2, Math.round(hgt));
        }
      }
    }
    function frame(t) {
      last = t;
      paint(t / 1000);
      raf = requestAnimationFrame(frame);
    }
    const start = () => { if (running || REDUCE) return; running = true; last = 0; raf = requestAnimationFrame(frame); };
    const stop = () => { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; };

    if (REDUCE) paint(0);

    const ro = new ResizeObserver(() => { size = fit(canvas, ctx); if (REDUCE) paint(0); });
    ro.observe(canvas);
    const io = new IntersectionObserver((e) => {
      const vis = !!(e[0] && e[0].isIntersecting);
      if (REDUCE) { if (vis) paint(0); return; }
      if (vis) start(); else stop();
    }, { threshold: 0 });
    io.observe(canvas);
  });
})();

  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
})();