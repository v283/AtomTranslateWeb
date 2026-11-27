/* Light / dark theme for the static pages (style.css).
   Loaded as a blocking <script> in <head>, so data-theme is on <html> before first paint and the
   page never flashes the wrong colours. It is a file, not an inline script, because the static
   pages' CSP (_headers) has no 'unsafe-inline' for scripts.

   The choice is stored under the same key as the deck pages (assets/deck.js), so it carries over
   between the landing page and /decks. With nothing stored, the system setting decides and keeps
   deciding when it changes. */
(function () {
  var KEY = "atl-theme";
  var COLORS = { dark: "#121316", light: "#f8f9fb" };
  var root = document.documentElement;

  function stored() {
    try {
      var t = localStorage.getItem(KEY);
      return t === "light" || t === "dark" ? t : null;
    } catch (e) {
      return null;
    }
  }

  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

  function system() {
    return media && media.matches ? "light" : "dark";
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", COLORS[theme]);
  }

  apply(stored() || system());

  if (media) {
    var follow = function () { if (!stored()) apply(system()); refresh(); };
    if (media.addEventListener) media.addEventListener("change", follow);
    else if (media.addListener) media.addListener(follow);
  }

  var buttons = [];

  function refresh() {
    var dark = root.getAttribute("data-theme") !== "light";
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var label = dark ? b.getAttribute("data-label-light") : b.getAttribute("data-label-dark");
      b.setAttribute("aria-label", label);
      b.setAttribute("title", label);
    }
  }

  function init() {
    // <head> ran before <meta name="theme-color"> may have been parsed; set it again now.
    apply(root.getAttribute("data-theme") || "dark");
    buttons = Array.prototype.slice.call(document.querySelectorAll("[data-theme-toggle]"));
    buttons.forEach(function (b) {
      b.hidden = false;
      b.addEventListener("click", function () {
        var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
        apply(next);
        try { localStorage.setItem(KEY, next); } catch (e) { /* private mode: this page only */ }
        refresh();
      });
    });
    refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

/* The language menu (<details data-lang-menu>) closes on an outside click, on Escape, and when focus leaves. */
(function () {
  function menus() { return document.querySelectorAll("details[data-lang-menu][open]"); }
  document.addEventListener("click", function (e) {
    Array.prototype.forEach.call(menus(), function (m) { if (!m.contains(e.target)) m.removeAttribute("open"); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    Array.prototype.forEach.call(menus(), function (m) {
      m.removeAttribute("open");
      var s = m.querySelector("summary");
      if (s) s.focus();
    });
  });
  document.addEventListener("focusin", function (e) {
    Array.prototype.forEach.call(menus(), function (m) { if (!m.contains(e.target)) m.removeAttribute("open"); });
  });
})();
