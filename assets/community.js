// Sections accordion for the Community deck page (functions/community/[id].js). A separate file,
// not an inline <script>, so the page's Content-Security-Policy can stay at script-src 'self'.
// Vanilla JS, no framework/CDN dependency. One fetch per section, cached in memory so collapsing
// and re-expanding the same section never re-fetches it.
(function () {
  var main = document.querySelector("main[data-short-id]");
  if (!main) return;
  var shortId = main.getAttribute("data-short-id");
  var cache = {};

  document.querySelectorAll(".section-head").forEach(function (head) {
    head.addEventListener("click", function () {
      var section = head.closest(".section");
      var id = section.getAttribute("data-id");
      var isOpen = section.classList.contains("open");
      document.querySelectorAll(".section.open").forEach(function (other) {
        if (other !== section) other.classList.remove("open");
      });
      section.classList.toggle("open", !isOpen);
      head.setAttribute("aria-expanded", String(!isOpen));
      if (isOpen || cache[id]) return;
      load(section);
    });
  });

  // The server-rendered preview section offers "Show all N words", which swaps the text-only
  // preview for the full list (with thumbnails) from the same endpoint.
  document.querySelectorAll(".section-more").forEach(function (button) {
    button.addEventListener("click", function () {
      load(button.closest(".section"));
    });
  });

  function load(section) {
    var id = section.getAttribute("data-id");
    var body = section.querySelector(".section-body");
    body.innerHTML = '<div class="section-state">Loading…</div>';
    fetch("/api/community/" + encodeURIComponent(shortId) + "/sections/" + encodeURIComponent(id))
      .then(function (r) { if (!r.ok) throw new Error("bad response"); return r.json(); })
      .then(function (data) {
        cache[id] = true;
        if (!data.words || data.words.length === 0) {
          body.innerHTML = '<div class="section-state">No words in this section.</div>';
          return;
        }
        body.innerHTML = data.words.map(function (w) {
          var img = isHttpsUrl(w.imageUrl)
            ? '<img class="word-thumb" src="' + escapeHtml(w.imageUrl) + '" alt="">'
            : "";
          return '<div class="word-row">' + img +
            '<div class="word-text"><span class="word-original">' + escapeHtml(w.original) +
            '</span><span class="word-translation">' + escapeHtml(w.translation) + '</span></div></div>';
        }).join("");
      })
      .catch(function () {
        delete cache[id];
        body.innerHTML = '<div class="section-state">Couldn\'t load this section.</div>';
      });
  }

  function isHttpsUrl(value) {
    return typeof value === "string" && value.indexOf("https://") === 0;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
