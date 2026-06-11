'use strict';
/**
 * Tenant branding loader.
 *
 * On startup, fetches /api/v1/tenants/config from the server.
 * The server resolves the config by subdomain (e.g. ttu.idu.uz → TTU branding).
 * Applies primary/secondary colors as CSS variables and sets the page title.
 *
 * Falls back gracefully if the endpoint is unreachable.
 */
(function() {
  var API = (typeof API_BASE !== 'undefined' ? API_BASE : '/api/v1');

  function applyBranding(cfg) {
    if (!cfg) return;

    // CSS custom properties — used throughout style.css
    if (cfg.primary_color) {
      document.documentElement.style.setProperty('--color-primary',   cfg.primary_color);
      document.documentElement.style.setProperty('--color-brand',     cfg.primary_color);
    }
    if (cfg.secondary_color) {
      document.documentElement.style.setProperty('--color-secondary', cfg.secondary_color);
    }

    // Page title
    if (cfg.name) {
      document.title = cfg.name;
      var titleEls = document.querySelectorAll('.app-name, .sidebar-title, .brand-name');
      titleEls.forEach(function(el) { el.textContent = cfg.name; });
    }

    // Logo
    if (cfg.logo_url) {
      var logos = document.querySelectorAll('.sidebar-logo img, .navbar-logo img, .login-logo img');
      logos.forEach(function(el) { el.src = cfg.logo_url; el.alt = cfg.name || 'Logo'; });
    }

    // Store globally for other modules
    window.IDU_TENANT = cfg;
  }

  // Load tenant config as early as possible
  fetch(API + '/tenants/config', { credentials: 'include' })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(applyBranding)
    .catch(function() {}); // silent fail — default IDU branding stays
})();
