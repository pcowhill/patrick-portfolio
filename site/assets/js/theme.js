/*
 * Theme bootstrap. Runs synchronously in <head> so the saved theme is applied
 * before first paint. With no saved preference, the OS setting wins via
 * prefers-color-scheme in the stylesheet.
 */
(function () {
  var KEY = 'pc-theme';
  try {
    var saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (e) { /* storage unavailable: fall back to system preference */ }
})();
