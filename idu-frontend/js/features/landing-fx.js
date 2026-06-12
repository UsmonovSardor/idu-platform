'use strict';
/* ============================================================================
 * IDU — Landing cinematic FX
 *  • Canvas particle constellation behind the hero (brand blue/cyan network)
 *  • Animated count-up for .lp-stat-num (uses data-target / data-suffix)
 *  • Staggered entrance reveal + scroll-reveal for landing sections
 * Self-contained, perf-aware (pauses off-screen / on hidden tab), and
 * respects prefers-reduced-motion. No external deps.
 * ========================================================================== */

(function () {
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── 1. CANVAS PARTICLE CONSTELLATION ──────────────────────────────────────
  function initConstellation() {
    var hero = document.querySelector('.lp-hero');
    if (!hero || document.getElementById('lpFxCanvas')) return;

    var canvas = document.createElement('canvas');
    canvas.id = 'lpFxCanvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;opacity:0;transition:opacity 1.2s ease';
    // Put it behind the hero content but above the base background
    if (getComputedStyle(hero).position === 'static') hero.style.position = 'relative';
    hero.insertBefore(canvas, hero.firstChild);

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, parts = [], mouse = { x: -9999, y: -9999 };
    var raf = null, running = false;

    function size() {
      var r = hero.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // particle count scales with area, capped for perf
      var count = Math.min(40, Math.max(14, Math.floor((W * H) / 42000)));
      parts = [];
      for (var i = 0; i < count; i++) {
        parts.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          r: Math.random() * 1.8 + 0.6,
        });
      }
    }

    var LINK = 85; // px distance to draw a connecting line
    var _lastFrame = 0;
    var FPS_INTERVAL = 1000 / 30; // cap at 30fps — plenty for a background effect
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var elapsed = now - _lastFrame;
      if (elapsed < FPS_INTERVAL) return; // skip frame, not time yet
      _lastFrame = now - (elapsed % FPS_INTERVAL);

      ctx.clearRect(0, 0, W, H);

      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;

        // gentle attraction toward mouse
        var mdx = mouse.x - p.x, mdy = mouse.y - p.y;
        var md2 = mdx * mdx + mdy * mdy;
        if (md2 < 14000) { p.x += mdx * 0.0008; p.y += mdy * 0.0008; }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(37,99,235,0.55)';
        ctx.fill();
      }

      // links — O(n²) but n is now max 40
      ctx.lineWidth = 1;
      for (var a = 0; a < parts.length; a++) {
        for (var b = a + 1; b < parts.length; b++) {
          var dx = parts[a].x - parts[b].x, dy = parts[a].y - parts[b].y;
          var d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            var al = (1 - Math.sqrt(d2) / LINK) * 0.38;
            ctx.strokeStyle = 'rgba(59,130,246,' + al.toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(parts[a].x, parts[a].y);
            ctx.lineTo(parts[b].x, parts[b].y);
            ctx.stroke();
          }
        }
      }
    }

    function start() { if (!running) { running = true; _lastFrame = 0; raf = requestAnimationFrame(frame); } }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

    size();
    requestAnimationFrame(function () { canvas.style.opacity = '1'; });

    // Static single frame for reduced-motion users
    if (REDUCED) { running = true; frame(performance.now()); stop(); return; }

    start();

    // Interactions & lifecycle
    hero.addEventListener('mousemove', function (e) {
      var r = hero.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    hero.addEventListener('mouseleave', function () { mouse.x = mouse.y = -9999; });

    var rz;
    window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(size, 200); });
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });

    // Pause when hero scrolls fully out of view
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (ents) {
        ents.forEach(function (en) { en.isIntersecting ? start() : stop(); });
      }, { threshold: 0.02 }).observe(hero);
    }

    // Pause during active scroll — canvas O(n²) work competes with scroll budget
    var _scrollTimer;
    window.addEventListener('scroll', function () {
      if (running) stop();
      clearTimeout(_scrollTimer);
      _scrollTimer = setTimeout(function () { if (!REDUCED) start(); }, 400);
    }, { passive: true });
  }

  // ── 2. ANIMATED COUNT-UP for landing stats ────────────────────────────────
  function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

  function countTo(el) {
    if (el._lpCounted) return;
    el._lpCounted = true;
    var target = parseFloat(el.getAttribute('data-target'));
    if (isNaN(target)) return;
    var suffix = el.getAttribute('data-suffix') || '';
    // 4200 → "4.2K" for nicer big numbers; smaller stay as-is
    var big = target >= 1000;
    var dur = 1600, t0 = null;
    function fmt(v) {
      if (big) {
        var k = v / 1000;
        return (k >= 10 ? Math.round(k) : k.toFixed(1)).replace(/\.0$/, '') + 'K' + suffix;
      }
      return Math.round(v) + suffix;
    }
    function step(now) {
      if (!t0) t0 = now;
      var p = Math.min((now - t0) / dur, 1);
      el.textContent = fmt(target * easeOutExpo(p));
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = fmt(target);
    }
    requestAnimationFrame(step);
  }

  function initCounters() {
    var nums = document.querySelectorAll('.lp-stat-num[data-target]');
    if (!nums.length) return;
    if (REDUCED || !('IntersectionObserver' in window)) {
      nums.forEach(countTo);
      return;
    }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting) { countTo(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.4 });
    nums.forEach(function (n) { io.observe(n); });
  }

  // ── 3. ENTRANCE + SCROLL REVEAL ───────────────────────────────────────────
  function injectRevealStyles() {
    if (document.getElementById('lpFxStyles')) return;
    var css = ''
      // Hero content: Apple spring easing (fast out, slight overshoot feel)
      + '.lp-hero-content > *{opacity:0;transform:translateY(28px);animation:lpRise .75s cubic-bezier(.22,1,.36,1) forwards;will-change:transform,opacity}'
      + '.lp-hero-content > *:nth-child(1){animation-delay:.04s}'
      + '.lp-hero-content > *:nth-child(2){animation-delay:.14s}'
      + '.lp-hero-content > *:nth-child(3){animation-delay:.24s}'
      + '.lp-hero-content > *:nth-child(4){animation-delay:.34s}'
      + '.lp-hero-content > *:nth-child(5){animation-delay:.44s}'
      + '@keyframes lpRise{to{opacity:1;transform:translateY(0)}}'
      // Scroll reveal — spring easing, compositor-friendly
      + '.lp-reveal{opacity:0;transform:translateY(36px);transition:opacity .65s cubic-bezier(.22,1,.36,1),transform .65s cubic-bezier(.22,1,.36,1);will-change:transform,opacity}'
      + '.lp-reveal.in{opacity:1;transform:none;will-change:auto}'
      // Per-card stagger when parent section becomes visible
      + '.lp-reveal.in .lp-feat-card:nth-child(1),.lp-reveal.in .lp-stat-card:nth-child(1){transition-delay:.04s}'
      + '.lp-reveal.in .lp-feat-card:nth-child(2),.lp-reveal.in .lp-stat-card:nth-child(2){transition-delay:.10s}'
      + '.lp-reveal.in .lp-feat-card:nth-child(3),.lp-reveal.in .lp-stat-card:nth-child(3){transition-delay:.16s}'
      + '.lp-reveal.in .lp-feat-card:nth-child(4),.lp-reveal.in .lp-stat-card:nth-child(4){transition-delay:.22s}'
      + '.lp-reveal.in .lp-feat-card:nth-child(5),.lp-reveal.in .lp-stat-card:nth-child(5){transition-delay:.28s}'
      + '.lp-reveal.in .lp-feat-card:nth-child(6),.lp-reveal.in .lp-stat-card:nth-child(6){transition-delay:.34s}'
      + '@media(prefers-reduced-motion:reduce){.lp-hero-content > *{opacity:1 !important;transform:none !important;animation:none !important}.lp-reveal{opacity:1 !important;transform:none !important;transition:none !important}}';
    var s = document.createElement('style');
    s.id = 'lpFxStyles'; s.textContent = css;
    document.head.appendChild(s);
  }

  function initReveal() {
    if (REDUCED || !('IntersectionObserver' in window)) return;
    var targets = document.querySelectorAll('.lp-stats, .lp-features, .lp-cta, [data-lp-reveal]');
    if (!targets.length) return;
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    targets.forEach(function (t) { t.classList.add('lp-reveal'); io.observe(t); });
  }

  // ── boot ──────────────────────────────────────────────────────────────────
  function boot() {
    // Only run when the landing hero is present & visible (not logged-in view)
    var hero = document.querySelector('.lp-hero');
    if (!hero) return;
    injectRevealStyles();
    initConstellation();
    initCounters();
    initReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  // Re-run if the landing becomes visible after JWT check resolves to "no session"
  window.IDU_initLandingFX = boot;
})();
