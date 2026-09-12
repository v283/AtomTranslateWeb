// GET /community/{short_id} — the page a browser (or an unverified-domain context, e.g. some
// in-app browsers) actually renders. On a device with the app installed and the domain verified,
// Universal Links (iOS) / App Links (Android) intercept this request before it ever reaches here
// — see IDeepLinkService in the TranslateLearn repo. No redirect is issued from this page itself.
//
// Sections render collapsed with just their word count (fetched cheaply — see
// fetchSectionsWithCounts); the actual words for a section are lazy-loaded client-side, on first
// expand, from /api/community/{short_id}/sections/{sectionId} — a page never pulls a deck's full
// word list up front.

import {
  PLAY_STORE_URL, APP_STORE_URL,
  escapeHtml, wordCountLabel,
  fetchFolderByShortId, fetchSectionsWithCounts,
} from "../_lib/community.js";

function pageShell({ title, description, ogUrl, bodyHtml, includeScript }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(ogUrl)}">
<meta property="og:image" content="https://atomtranslate.com/og-image.png">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<link rel="icon" href="https://atomtranslate.com/favicon-32.png">
<style>
  :root {
    --bg: #121316; --bg-elevated: #1c1d22; --bg-row: #202127; --border: rgba(255,255,255,0.10);
    --text: #f0f0ec; --text-muted: #a8a79e; --text-faint: #7c7a70;
    --accent: #378add; --accent-dim: #185fa5; --accent-soft: #1b3349;
    --radius-lg: 22px; --radius-md: 14px; --radius-sm: 8px;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
    display: flex; justify-content: center; padding: 24px 16px 48px;
  }
  .card {
    width: 100%; max-width: 560px; background: var(--bg-elevated); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 32px 28px; text-align: center;
  }
  .avatar {
    width: 56px; height: 56px; border-radius: 50%; background: var(--accent-dim);
    color: #fff; font-size: 22px; font-weight: 700; display: flex; align-items: center;
    justify-content: center; margin: 0 auto 16px;
  }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: var(--text-muted); font-size: 14px; margin: 0 0 4px; }
  .badges { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 14px 0 22px; }
  .badge {
    background: rgba(255,255,255,0.06); border: 1px solid var(--border); color: var(--text-muted);
    font-size: 12px; padding: 4px 10px; border-radius: 999px;
  }
  .stores { display: flex; flex-direction: column; gap: 10px; }
  .btn {
    display: block; padding: 13px 16px; border-radius: var(--radius-sm); text-decoration: none;
    font-weight: 600; font-size: 15px;
  }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-secondary { background: transparent; border: 1px solid var(--border); color: var(--text); }
  .hint { color: var(--text-faint); font-size: 12px; margin-top: 18px; }

  /* Sections accordion */
  .sections { margin-top: 24px; text-align: left; }
  .sections-title {
    display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700;
    color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 10px;
  }
  .sections-title img { width: 16px; height: 16px; }
  .section {
    border: 1px solid var(--border); border-radius: var(--radius-md); margin-bottom: 8px;
    background: var(--bg-row); overflow: hidden;
  }
  .section-head {
    display: flex; align-items: center; gap: 10px; width: 100%; padding: 13px 14px;
    background: none; border: none; color: var(--text); font-size: 15px; font-weight: 600;
    text-align: left; cursor: pointer; font-family: inherit;
  }
  .section-head img.book { width: 18px; height: 18px; flex-shrink: 0; }
  .section-head .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .section-head .count { color: var(--text-muted); font-size: 12px; font-weight: 500; flex-shrink: 0; }
  .chevron { width: 14px; height: 14px; flex-shrink: 0; transition: transform 0.2s ease; color: var(--text-faint); }
  .section.open .chevron { transform: rotate(90deg); }
  .section-body { display: none; border-top: 1px solid var(--border); }
  .section.open .section-body { display: block; }
  .word-row {
    display: flex; align-items: center; gap: 10px; padding: 10px 14px;
    border-bottom: 1px solid var(--border);
  }
  .word-row:last-child { border-bottom: none; }
  .word-thumb { width: 32px; height: 32px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: var(--bg-elevated); }
  .word-text { flex: 1; min-width: 0; display: flex; justify-content: space-between; gap: 10px; }
  .word-original { font-weight: 600; font-size: 14px; }
  .word-translation { color: var(--text-muted); font-size: 14px; text-align: right; }
  .section-state { padding: 16px 14px; color: var(--text-faint); font-size: 13px; }

  @media (min-width: 640px) {
    .card { padding: 40px 44px; }
    .stores { flex-direction: row; }
    .btn { flex: 1; }
  }
</style>
</head>
<body>
${bodyHtml}
${includeScript ? `<script>${ACCORDION_SCRIPT}</script>` : ""}
</body>
</html>`;
}

// Vanilla JS, no framework/CDN dependency. One fetch per section, cached in memory so
// collapsing and re-expanding the same section never re-fetches it.
const ACCORDION_SCRIPT = `
(function () {
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
      if (isOpen || cache[id]) return;

      var body = section.querySelector(".section-body");
      body.innerHTML = '<div class="section-state">Loading…</div>';
      fetch("/api/community/" + window.__shortId + "/sections/" + id)
        .then(function (r) { if (!r.ok) throw new Error("bad response"); return r.json(); })
        .then(function (data) {
          cache[id] = true;
          if (!data.words || data.words.length === 0) {
            body.innerHTML = '<div class="section-state">No words in this section.</div>';
            return;
          }
          body.innerHTML = data.words.map(function (w) {
            var img = w.imageUrl
              ? '<img class="word-thumb" src="' + w.imageUrl + '" alt="">'
              : "";
            return '<div class="word-row">' + img +
              '<div class="word-text"><span class="word-original">' + escapeHtml(w.original) +
              '</span><span class="word-translation">' + escapeHtml(w.translation) + '</span></div></div>';
          }).join("");
        })
        .catch(function () {
          delete cache[id];
          body.innerHTML = '<div class="section-state">Couldn\\'t load this section.</div>';
        });
    });
  });

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
`;

function chevronSvg() {
  return `<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>`;
}

function storesHtml() {
  return `
    <div class="stores">
      <a class="btn btn-primary" href="${PLAY_STORE_URL}">Get it on Google Play</a>
      <a class="btn btn-secondary" href="${APP_STORE_URL}">Download on the App Store</a>
    </div>`;
}

function notFoundPage(shortId, url) {
  const html = pageShell({
    title: "Deck not found — Atom Translate",
    description: "This deck link is no longer available.",
    ogUrl: url,
    bodyHtml: `
    <div class="card">
      <h1>This deck link is no longer available</h1>
      <p class="meta">The folder for "${escapeHtml(shortId)}" is private or doesn't exist.</p>
      ${storesHtml()}
    </div>`,
    includeScript: false,
  });
  return new Response(html, { status: 404, headers: { "Content-Type": "text/html; charset=UTF-8" } });
}

export async function onRequestGet({ params, request }) {
  const shortId = String(params.id || "").trim();
  const url = request.url;

  if (!shortId) return notFoundPage(shortId, url);

  let folder;
  try {
    folder = await fetchFolderByShortId(shortId);
  } catch {
    folder = undefined;
  }
  if (!folder) return notFoundPage(shortId, url);

  let sections = [];
  try {
    sections = await fetchSectionsWithCounts(folder.id);
  } catch {
    sections = [];
  }

  const authorName = folder.author_name || "";
  const initial = authorName ? authorName[0].toUpperCase() : "?";
  const description = `${wordCountLabel(folder.word_count)} · ${folder.section_count} section${folder.section_count === 1 ? "" : "s"}${authorName ? ` · by ${authorName}` : ""}`;
  const badges = [folder.language, folder.category, folder.level].filter(Boolean);

  const sectionsHtml = sections.length
    ? `
    <div class="sections">
      <div class="sections-title"><img src="/assets/books.png" alt="">Sections</div>
      ${sections.map((s) => `
        <div class="section" data-id="${escapeHtml(s.id)}">
          <button class="section-head" type="button">
            <img class="book" src="/assets/books.png" alt="">
            <span class="name">${escapeHtml(s.name)}</span>
            <span class="count">${escapeHtml(wordCountLabel(s.wordCount))}</span>
            ${chevronSvg()}
          </button>
          <div class="section-body"></div>
        </div>`).join("")}
    </div>`
    : "";

  const html = pageShell({
    title: `${folder.name} — Atom Translate`,
    description,
    ogUrl: url,
    includeScript: sections.length > 0,
    bodyHtml: `
    <div class="card">
      <div class="avatar">${escapeHtml(initial)}</div>
      <h1>${escapeHtml(folder.name)}</h1>
      <p class="meta">${authorName ? `by ${escapeHtml(authorName)} · ` : ""}${escapeHtml(wordCountLabel(folder.word_count))}</p>
      ${badges.length ? `<div class="badges">${badges.map((b) => `<span class="badge">${escapeHtml(b)}</span>`).join("")}</div>` : ""}
      ${storesHtml()}
      <p class="hint">Already have Atom Translate? Opening this link on your phone opens the deck directly.</p>
      ${sectionsHtml}
    </div>
    <script>window.__shortId = ${JSON.stringify(folder.short_id)};</script>`,
  });

  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=UTF-8" } });
}
