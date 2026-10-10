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
  PLAY_STORE_URL, APP_STORE_URL, SITE_ORIGIN, WEB_APP_ORIGIN, PAGE_SECURITY_HEADERS,
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
    --accent-soft-strong: rgba(55, 138, 221, 0.35); --border-strong: #33353b;
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
  /* App icon in the .logo-mark style of the main site, until decks get their own picture. */
  .avatar {
    display: block; width: 56px; height: 56px; border-radius: 21%; margin: 0 auto 16px;
    box-shadow: 0 0 0 1px rgba(55, 138, 221, 0.3), 0 10px 22px -8px rgba(55, 138, 221, 0.7);
  }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: var(--text-muted); font-size: 14px; margin: 0 0 4px; }
  .badges { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 14px 0 22px; }
  .badge {
    background: rgba(255,255,255,0.06); border: 1px solid var(--border); color: var(--text-muted);
    font-size: 12px; padding: 4px 10px; border-radius: 999px;
  }
  .summary { color: var(--text-muted); font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
  /* Store buttons: the same shape as .btn-store on the main site (style.css), so the
     landing and atomtranslate.com read as one product. */
  .stores { display: flex; flex-direction: column; gap: 10px; }
  .btn-store {
    display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 52px;
    padding: 10px 18px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong);
    background: var(--bg-row); color: var(--text); text-decoration: none;
    transition: border-color 0.15s ease, transform 0.15s ease;
  }
  .btn-store:hover { border-color: var(--accent); }
  .btn-store:active { transform: translateY(1px); }
  .btn-store:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .btn-store svg { width: 22px; height: 22px; flex-shrink: 0; }
  .store-copy { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.25; text-align: left; }
  .store-copy small {
    font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-faint);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .store-copy strong { font-size: 15px; font-weight: 600; }
  /* The no-install option: accent-tinted so it doesn't read as a third store. */
  .btn-store.is-web { margin-top: 10px; background: var(--accent-soft); border-color: var(--accent-soft-strong); }
  .btn-store.is-web svg { color: var(--accent); }
  .btn-store.is-web:hover { border-color: var(--accent); }
  .beta-tag {
    padding: 2px 7px; border-radius: 999px; border: 1px solid var(--accent-soft-strong);
    background: var(--accent-soft); color: var(--accent); font-size: 10px; font-weight: 700;
    letter-spacing: 0.04em; text-transform: uppercase;
  }
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
    .stores .btn-store { flex: 1; }
  }
</style>
</head>
<body>
${bodyHtml}
${includeScript ? `<script src="/assets/community.js" defer></script>` : ""}
</body>
</html>`;
}

function chevronSvg() {
  return `<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>`;
}

// Icons and wording match the .hero-ctas buttons in index.html.
const PLAY_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 3.6c0-.5.3-.9.7-1.1L14.3 12 3.7 21.5c-.4-.2-.7-.6-.7-1.1V3.6Zm12.5 9.5 2.6-2.6 3.4 2c.7.4.7 1.5 0 1.9l-3.4 2-2.6-2.6ZM4.8 2.2 16 8.6l-2.3 2.3-8.9-8.7Zm0 19.6 8.9-8.7L16 15.4 4.8 21.8Z"/></svg>`;
const APPLE_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 12.5c-.03-2.8 2.28-4.15 2.39-4.22-1.3-1.9-3.32-2.16-4.04-2.19-1.72-.17-3.35 1.02-4.22 1.02-.87 0-2.2-1-3.63-.97-1.87.03-3.6 1.09-4.56 2.76-1.95 3.38-.5 8.38 1.4 11.12.93 1.34 2.03 2.85 3.48 2.8 1.4-.06 1.93-.9 3.62-.9 1.68 0 2.17.9 3.65.87 1.51-.03 2.46-1.37 3.38-2.72 1.07-1.55 1.5-3.06 1.53-3.13-.03-.01-2.94-1.13-2.97-4.44Zm-2.8-8.16c.77-.94 1.29-2.24 1.15-3.54-1.11.05-2.46.74-3.26 1.67-.71.82-1.34 2.15-1.17 3.42 1.24.1 2.5-.63 3.28-1.55Z"/></svg>`;
const GLOBE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9s1.3-6.3 3.8-9Z"/></svg>`;

function storesHtml(webAppUrl) {
  return `
    <div class="stores">
      <a class="btn-store" href="${PLAY_STORE_URL}">
        ${PLAY_ICON}
        <span class="store-copy"><small>Get it on</small><strong>Google Play</strong></span>
      </a>
      <a class="btn-store" href="${APP_STORE_URL}">
        ${APPLE_ICON}
        <span class="store-copy"><small>Download on the</small><strong>App Store</strong></span>
      </a>
    </div>${webAppUrl ? `
    <a class="btn-store is-web" href="${escapeHtml(webAppUrl)}">
      ${GLOBE_ICON}
      <span class="store-copy"><small>In your browser</small><strong>Open in web app</strong></span>
      <span class="beta-tag">Beta</span>
    </a>` : ""}`;
}

const NO_STORE_HTML = { ...PAGE_SECURITY_HEADERS, "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store" };

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
    <main class="card" data-short-id="${escapeHtml(folder.short_id)}">
      <img class="avatar" src="/appicon.png" width="56" height="56" alt="" aria-hidden="true">
      <h1>${escapeHtml(folder.name)}</h1>
      <p class="meta">${authorName ? `by ${escapeHtml(authorName)} · ` : ""}${escapeHtml(wordCountLabel(wordCount))}</p>
      ${badges.length ? `<div class="badges">${badges.map((b) => `<span class="badge">${escapeHtml(b)}</span>`).join("")}</div>` : ""}
      <p class="summary">${escapeHtml(summary)}</p>
      ${storesHtml(webAppUrl)}
      <p class="hint">Already have Atom Translate? Opening this link on your phone opens the deck directly.</p>
      ${sectionsHtml}
    </main>`,
  });

  return new Response(html, {
    status: 200,
    headers: {
      ...PAGE_SECURITY_HEADERS,
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
