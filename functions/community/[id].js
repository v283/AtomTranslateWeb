// GET /community/{short_id} — the page a browser (or an unverified-domain context, e.g. some
// in-app browsers) actually renders. On a device with the app installed and the domain verified,
// Universal Links (iOS) / App Links (Android) intercept this request before it ever reaches here
// — see IDeepLinkService in the TranslateLearn repo. No redirect is issued from this page itself.
//
// Sections render collapsed with just their word count (fetched cheaply — see
// fetchSectionsWithCounts); the actual words for a section are lazy-loaded client-side, on first
// expand, from /api/community/{short_id}/sections/{sectionId} — a page never pulls a deck's full
// word list up front. The one exception is a short text-only preview (first PREVIEW_WORDS words
// of the first non-empty section) rendered server-side so crawlers and no-JS visitors see real
// deck content; that section starts expanded.
//
// SEO: a found deck is indexable, with a canonical URL on the stored short id and schema.org
// LearningResource JSON-LD. Not-found (404) and upstream-failure (503) variants stay noindex and
// uncacheable. functions/sitemap.xml.js lists the same /community/{short_id} URLs.

import {
  PLAY_STORE_URL, APP_STORE_URL, SITE_ORIGIN, WEB_APP_ORIGIN,
  escapeHtml, wordCountLabel,
  fetchFolderByShortId, fetchSectionsWithCounts, fetchWordPreview,
} from "../_lib/community.js";

const PREVIEW_WORDS = 20;

// Short ids come from generate_short_id() (8 chars, A-Z/2-9) or the app's identical client-side
// generator; anything far outside that shape can't match, so it 404s without an upstream call.
const SHORT_ID_RE = /^[A-Za-z0-9]{1,32}$/;

// folders.language / native_language hold the canonical English names from the app's
// CommunityVocabulary.LanguageOptions; JSON-LD inLanguage wants BCP 47 codes.
const LANGUAGE_CODES = {
  Arabic: "ar", Azerbaijani: "az", Chinese: "zh", Czech: "cs", Danish: "da", Dutch: "nl",
  English: "en", Esperanto: "eo", Finnish: "fi", French: "fr", German: "de", Greek: "el",
  Hebrew: "he", Hindi: "hi", Hungarian: "hu", Indonesian: "id", Irish: "ga", Italian: "it",
  Japanese: "ja", Korean: "ko", Persian: "fa", Polish: "pl", Portuguese: "pt", Russian: "ru",
  Slovak: "sk", Spanish: "es", Swedish: "sv", Thai: "th", Turkish: "tr", Ukrainian: "uk",
  Vietnamese: "vi",
};

// JSON for embedding inside <script>: escaping "<" means neither "</script>" nor "<!--" can
// appear in the output, whatever the deck name or author contains.
function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function pluralize(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

function pageShell({ title, description, robots, canonical, ogUrl, jsonLd, bodyHtml, includeScript }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="${escapeHtml(robots)}">
${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">\n` : ""}<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(ogUrl)}">
<meta property="og:image" content="https://atomtranslate.com/og-image.png">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<link rel="icon" href="https://atomtranslate.com/favicon-32.png">
${jsonLd ? `<script type="application/ld+json">${safeJson(jsonLd)}</script>\n` : ""}<style>
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
  .summary { color: var(--text-muted); font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
  .stores { display: flex; flex-direction: column; gap: 10px; }
  .btn {
    display: flex; align-items: center; justify-content: center; min-height: 44px;
    padding: 12px 16px; border-radius: var(--radius-sm); text-decoration: none;
    font-weight: 600; font-size: 15px;
  }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-secondary { background: transparent; border: 1px solid var(--border); color: var(--text); }
  .btn-web { margin-top: 10px; background: var(--accent-soft); border: 1px solid var(--accent-dim); color: var(--text); }
  .hint { color: var(--text-faint); font-size: 12px; margin-top: 18px; }

  /* Sections accordion */
  .sections { margin-top: 24px; text-align: left; }
  .sections-title {
    display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700;
    color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 10px;
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
  .section-more {
    display: block; width: 100%; min-height: 44px; padding: 12px 14px; background: none; border: none;
    border-top: 1px solid var(--border); color: var(--accent); font: inherit; font-size: 14px;
    font-weight: 600; cursor: pointer;
  }

  @media (min-width: 640px) {
    .card { padding: 40px 44px; }
    .stores { flex-direction: row; }
    .stores .btn { flex: 1; }
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
            ? '<img class="word-thumb" src="' + escapeHtml(w.imageUrl) + '" alt="">'
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
  }

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

function storesHtml(webAppUrl) {
  return `
    <div class="stores">
      <a class="btn btn-primary" href="${PLAY_STORE_URL}">Get it on Google Play</a>
      <a class="btn btn-secondary" href="${APP_STORE_URL}">Download on the App Store</a>
    </div>${webAppUrl ? `
    <a class="btn btn-web" href="${escapeHtml(webAppUrl)}">Open in web app</a>` : ""}`;
}

const NO_STORE_HTML = { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store" };

function notFoundPage(shortId, url) {
  const html = pageShell({
    title: "Deck not found — Atom Translate",
    description: "This deck link is no longer available.",
    robots: "noindex",
    ogUrl: url,
    bodyHtml: `
    <div class="card">
      <h1>This deck link is no longer available</h1>
      <p class="meta">The folder for "${escapeHtml(shortId)}" is private or doesn't exist.</p>
      ${storesHtml()}
    </div>`,
    includeScript: false,
  });
  return new Response(html, { status: 404, headers: NO_STORE_HTML });
}

// Upstream (Supabase) failure: 503 + Retry-After rather than 404, so a transient outage doesn't
// read to crawlers as "this deck is gone".
function unavailablePage(url) {
  const html = pageShell({
    title: "Deck temporarily unavailable — Atom Translate",
    description: "This deck couldn't be loaded right now. Please try again in a few minutes.",
    robots: "noindex",
    ogUrl: url,
    bodyHtml: `
    <div class="card">
      <h1>This deck couldn't be loaded right now</h1>
      <p class="meta">Please try again in a few minutes.</p>
      ${storesHtml()}
    </div>`,
    includeScript: false,
  });
  return new Response(html, { status: 503, headers: { ...NO_STORE_HTML, "Retry-After": "300" } });
}

function wordRowsHtml(words) {
  return words.map((w) => `
            <div class="word-row"><div class="word-text"><span class="word-original">${escapeHtml(w.original)}</span><span class="word-translation">${escapeHtml(w.translation)}</span></div></div>`).join("");
}

export async function onRequestGet({ params, request }) {
  const shortId = String(params.id || "").trim();
  const url = request.url;

  if (!SHORT_ID_RE.test(shortId)) return notFoundPage(shortId, url);

  let folder;
  try {
    folder = await fetchFolderByShortId(shortId);
  } catch {
    return unavailablePage(url);
  }
  if (!folder) return notFoundPage(shortId, url);

  let sections = [];
  try {
    sections = await fetchSectionsWithCounts(folder.id);
  } catch {
    sections = [];
  }

  // Text-only preview of the first non-empty section, for crawlers / no-JS visitors.
  const previewSection = sections.find((s) => s.wordCount > 0);
  let previewWords = [];
  if (previewSection) {
    try {
      previewWords = await fetchWordPreview(previewSection.id, PREVIEW_WORDS);
    } catch {
      previewWords = [];
    }
  }

  const canonicalShortId = folder.short_id || shortId;
  const canonicalUrl = `${SITE_ORIGIN}/community/${encodeURIComponent(canonicalShortId)}`;
  const webAppUrl = `${WEB_APP_ORIGIN}/community/folder/${encodeURIComponent(canonicalShortId)}`;

  const authorName = folder.author_name || "";
  const initial = authorName ? authorName[0].toUpperCase() : "?";
  const wordCount = Number(folder.word_count) || 0;
  const sectionCount = Number(folder.section_count) || sections.length;
  const language = folder.language || "";
  const nativeLanguage = folder.native_language && folder.native_language !== language ? folder.native_language : "";
  const languagePair = language && nativeLanguage ? `${language}–${nativeLanguage}` : language;

  const title = `${folder.name} — ${languagePair ? `${languagePair} ` : ""}vocabulary flashcards (${wordCountLabel(wordCount)}) | Atom Translate`;

  const sectionNames = sections.slice(0, 3).map((s) => s.name).filter(Boolean);
  const description = [
    `Learn ${wordCountLabel(wordCount)}${language ? ` of ${language}` : ""}${nativeLanguage ? ` with ${nativeLanguage} translations` : ""}`
      + ` in the "${folder.name}" deck${authorName ? ` by ${authorName}` : ""}`
      + `${folder.level ? ` (level ${folder.level})` : ""}.`,
    sectionNames.length ? `${pluralize(sectionCount, "section", "sections")}: ${sectionNames.join(", ")}${sections.length > 3 ? "…" : "."}` : "",
    "Study free with flashcards, quizzes, writing and matching in Atom Translate.",
  ].filter(Boolean).join(" ");

  const summary = `${languagePair ? `${languagePair} v` : "V"}ocabulary deck with ${wordCountLabel(wordCount)} in ${pluralize(sectionCount, "section", "sections")}`
    + `${authorName ? `, shared by ${authorName}` : ""} on Atom Translate.`
    + " Study it free with flashcards, quizzes, writing and matching modes.";

  const badges = [languagePair ? languagePair.replace("–", " → ") : "", folder.category, folder.level].filter(Boolean);

  const inLanguage = [language, nativeLanguage].filter(Boolean).map((l) => LANGUAGE_CODES[l] || l);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: folder.name,
    description,
    url: canonicalUrl,
    learningResourceType: "Flashcards",
    isAccessibleForFree: true,
    ...(inLanguage.length ? { inLanguage: inLanguage.length === 1 ? inLanguage[0] : inLanguage } : {}),
    ...(language ? { teaches: `${language} vocabulary` } : {}),
    ...(folder.level ? { educationalLevel: folder.level } : {}),
    ...(folder.category ? { about: folder.category } : {}),
    ...(folder.updated_at ? { dateModified: folder.updated_at } : {}),
    ...(authorName ? { author: { "@type": "Person", name: authorName } } : {}),
    ...(sections.length ? {
      hasPart: sections.slice(0, 50).map((s) => ({
        "@type": "LearningResource",
        name: s.name,
        learningResourceType: "Flashcards",
        description: wordCountLabel(s.wordCount),
      })),
    } : {}),
    publisher: { "@type": "Organization", name: "Atom Translate", url: `${SITE_ORIGIN}/` },
  };

  const sectionsHtml = sections.length
    ? `
    <div class="sections">
      <h2 class="sections-title"><img src="/assets/books.png" alt="">Sections</h2>
      ${sections.map((s) => {
        const isPreview = previewSection && s.id === previewSection.id && previewWords.length > 0;
        const more = isPreview && s.wordCount > previewWords.length
          ? `<button class="section-more" type="button">Show all ${escapeHtml(wordCountLabel(s.wordCount))}</button>`
          : "";
        return `
        <div class="section${isPreview ? " open" : ""}" data-id="${escapeHtml(s.id)}">
          <button class="section-head" type="button" aria-expanded="${isPreview ? "true" : "false"}">
            <img class="book" src="/assets/books.png" alt="">
            <span class="name">${escapeHtml(s.name)}</span>
            <span class="count">${escapeHtml(wordCountLabel(s.wordCount))}</span>
            ${chevronSvg()}
          </button>
          <div class="section-body">${isPreview ? `${wordRowsHtml(previewWords)}
            ${more}` : ""}</div>
        </div>`;
      }).join("")}
    </div>`
    : "";

  const html = pageShell({
    title,
    description,
    robots: "index,follow",
    canonical: canonicalUrl,
    ogUrl: canonicalUrl,
    jsonLd,
    includeScript: sections.length > 0,
    bodyHtml: `
    <main class="card">
      <div class="avatar" aria-hidden="true">${escapeHtml(initial)}</div>
      <h1>${escapeHtml(folder.name)}</h1>
      <p class="meta">${authorName ? `by ${escapeHtml(authorName)} · ` : ""}${escapeHtml(wordCountLabel(wordCount))}</p>
      ${badges.length ? `<div class="badges">${badges.map((b) => `<span class="badge">${escapeHtml(b)}</span>`).join("")}</div>` : ""}
      <p class="summary">${escapeHtml(summary)}</p>
      ${storesHtml(webAppUrl)}
      <p class="hint">Already have Atom Translate? Opening this link on your phone opens the deck directly.</p>
      ${sectionsHtml}
    </main>
    <script>window.__shortId = ${safeJson(folder.short_id)};</script>`,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
