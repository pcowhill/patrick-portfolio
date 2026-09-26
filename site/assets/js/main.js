/*
 * Site behavior: theme toggle, mobile navigation, current-section highlighting,
 * and the footer year. No dependencies.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var KEY = 'pc-theme';
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  function currentTheme() {
    var explicit = root.getAttribute('data-theme');
    if (explicit === 'light' || explicit === 'dark') return explicit;
    return systemDark.matches ? 'dark' : 'light';
  }

  /* ---- Theme toggle ---------------------------------------------------- */
  var toggle = document.querySelector('[data-theme-toggle]');

  function updateToggleLabel() {
    if (!toggle) return;
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    toggle.setAttribute('aria-label', 'Switch to ' + next + ' theme');
  }

  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch (e) { /* ignore */ }
    updateToggleLabel();
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
    updateToggleLabel();
  }

  systemDark.addEventListener('change', function () {
    // Only matters when no manual override is stored.
    if (!root.hasAttribute('data-theme')) {
      updateToggleLabel();
      document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: currentTheme() } }));
    }
  });

  /* ---- Mobile navigation ---------------------------------------------- */
  var navToggle = document.querySelector('.nav-toggle');
  var navMenu = document.getElementById('nav-menu');

  function closeNav() {
    if (!navToggle || !navMenu) return;
    navMenu.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      var open = navMenu.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    navMenu.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeNav();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navMenu.classList.contains('is-open')) {
        closeNav();
        navToggle.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.site-nav') && navMenu.classList.contains('is-open')) closeNav();
    });
  }

  /* ---- Current section highlighting ------------------------------------ */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-menu a[href^="#"]'));
  var sections = navLinks
    .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var active = null;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) active = entry.target.id;
      });
      navLinks.forEach(function (a) {
        var match = a.getAttribute('href') === '#' + active;
        if (match) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(function (s) { observer.observe(s); });
  }

  /* ---- Footer year ----------------------------------------------------- */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
