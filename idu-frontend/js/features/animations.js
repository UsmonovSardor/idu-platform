'use strict';
/* ══════════════════════════════════════════════════════════════
   IDU Animations — UI/UX Pro Max
   · Scroll reveal (IntersectionObserver)
   · Counter animation for stats
   · Card 3D tilt
   · Stagger reveals
══════════════════════════════════════════════════════════════ */

(function () {

  /* ── 1. SCROLL REVEAL ──────────────────────────────────────── */
  function initScrollReveal() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    // Landing stat cards
    document.querySelectorAll('.lp-stat-card').forEach(function (el, i) {
      el.classList.add('sr-fade-up', 'sr-stagger');
      io.observe(el);
    });

    // Feature cards
    document.querySelectorAll('.lp-feat-card').forEach(function (el, i) {
      el.classList.add('sr-fade-up', 'sr-stagger');
      io.observe(el);
    });

    // Security cards
    document.querySelectorAll('.lp-sec-card').forEach(function (el) {
      el.classList.add('sr-scale', 'sr-stagger');
      io.observe(el);
    });

    // Testimonial cards
    document.querySelectorAll('.lp-test-card').forEach(function (el) {
      el.classList.add('sr-fade-up', 'sr-stagger');
      io.observe(el);
    });

    // Trust stats
    document.querySelectorAll('.lp-trust-stat').forEach(function (el) {
      el.classList.add('sr-scale', 'sr-stagger');
      io.observe(el);
    });

    // How-it-works steps
    document.querySelectorAll('.lp-how-step').forEach(function (el) {
      el.classList.add('sr-fade-up', 'sr-stagger');
      io.observe(el);
    });

    // Section headers
    document.querySelectorAll('.lp-feat-header, .lp-trust h2, .lp-how h2, .lp-sec h2').forEach(function (el) {
      el.classList.add('sr-fade-up');
      io.observe(el);
    });
  }

  /* ── 2. COUNTER ANIMATION ──────────────────────────────────── */
  function animateCounter(el, target, suffix) {
    var start = 0;
    var duration = 1800;
    var startTime = null;

    // Parse target: "4.2K" → 4200, "98%" → 98
    var num = parseFloat(target.replace(/[^0-9.]/g, ''));
    var isK = target.includes('K');
    var isPlus = target.includes('+');
    var isPct = target.includes('%');

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = eased * num;

      var display;
      if (isK) {
        display = (current >= 1 ? current.toFixed(current < 10 ? 1 : 0) : current.toFixed(1)) + 'K';
      } else if (isPct) {
        display = Math.round(current) + '%';
      } else {
        display = Math.round(current) + (isPlus ? '+' : '');
      }
      el.textContent = display;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target; // exact final value
      }
    }
    requestAnimationFrame(step);
  }

  function initCounters() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);

        var el = e.target;
        var original = el.getAttribute('data-count') || el.textContent.trim();
        if (!el.getAttribute('data-count')) {
          el.setAttribute('data-count', original);
        }
        el.classList.add('stat-num-animated');
        animateCounter(el, original);
      });
    }, { threshold: 0.5 });

    // Landing stat numbers
    document.querySelectorAll('.lp-stat-num').forEach(function (el) {
      io.observe(el);
    });

    // App stat card values
    document.querySelectorAll('.stat-card-val').forEach(function (el) {
      io.observe(el);
    });

    // Hero stat numbers
    document.querySelectorAll('.h-stat-val').forEach(function (el) {
      io.observe(el);
    });
  }

  /* ── 3. CARD 3D TILT ───────────────────────────────────────── */
  function initCardTilt() {
    // Only on desktop (no tilt on touch devices)
    if (window.matchMedia('(hover: none)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var cards = document.querySelectorAll('.lp-feat-card, .lp-stat-card, .lp-hero-card');

    cards.forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var cx = rect.width / 2;
        var cy = rect.height / 2;
        var rotateX = ((y - cy) / cy) * -5;
        var rotateY = ((x - cx) / cx) * 5;
        card.style.transform = 'perspective(600px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) translateY(-4px)';
      });

      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
        card.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
      });

      card.addEventListener('mouseenter', function () {
        card.style.transition = 'transform 0.1s ease';
      });
    });
  }

  /* ── 4. SMOOTH SCROLL for anchor links ─────────────────────── */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var target = document.querySelector(a.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  /* ── 5. NAV SCROLL EFFECT ──────────────────────────────────── */
  function initNavScroll() {
    var nav = document.querySelector('.lp-nav');
    if (!nav) return;
    var scrolled = false;

    window.addEventListener('scroll', function () {
      var shouldScroll = window.scrollY > 20;
      if (shouldScroll !== scrolled) {
        scrolled = shouldScroll;
        nav.classList.toggle('scrolled', scrolled);
      }
    }, { passive: true });
  }

  /* ── 6. RIPPLE EFFECT for buttons ──────────────────────────── */
  function initRipple() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var style = document.createElement('style');
    style.textContent = [
      '@keyframes rippleOut{to{transform:scale(4);opacity:0}}',
      '.ripple-wrap{position:relative;overflow:hidden;}',
      '.ripple-dot{position:absolute;border-radius:50%;background:rgba(255,255,255,0.25);',
      'transform:scale(0);animation:rippleOut 0.5s linear;pointer-events:none;}'
    ].join('');
    document.head.appendChild(style);

    function addRipple(el) {
      el.classList.add('ripple-wrap');
      el.addEventListener('click', function (e) {
        var rect = el.getBoundingClientRect();
        var size = Math.max(rect.width, rect.height);
        var dot = document.createElement('span');
        dot.className = 'ripple-dot';
        dot.style.cssText = [
          'width:' + size + 'px',
          'height:' + size + 'px',
          'left:' + (e.clientX - rect.left - size / 2) + 'px',
          'top:' + (e.clientY - rect.top - size / 2) + 'px'
        ].join(';');
        el.appendChild(dot);
        setTimeout(function () { dot.remove(); }, 500);
      });
    }

    document.querySelectorAll('.lp-primary-btn, .login-submit, .btn-primary, .lp-cta-main-btn').forEach(addRipple);
  }

  /* ── INIT ───────────────────────────────────────────────────── */
  function init() {
    // Only run on landing page
    if (!document.getElementById('authScreen')) return;

    // Check reduced motion
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reducedMotion) {
      initScrollReveal();
      initCardTilt();
      initRipple();
    }

    initCounters();
    initSmoothScroll();
    initNavScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

console.log('✅ Animations loaded');
