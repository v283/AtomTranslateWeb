// One template for every deck page:
//   * variant "main"   — https://atomtranslate.com/decks/{CODE}/{slug}: the indexable page.
//   * variant "mobile" — https://mobile.atomtranslate.com/community/{CODE}: the deep-link landing
//     the app shares (Universal Links / App Links open the app before this ever renders). Same
//     content, but its canonical points at the main page and it has no "Open in the app" button
//     (this URL IS the app link).
// Plus the /decks catalog shell and the 404/503 pages. No onRequest* export: a plain module.
//
// Everything a crawler needs is in the HTML: every word and translation, readable without JS.
// /assets/deck.js only adds the extras on top: theme switch, mini-quiz, leaderboard teaser,
// Android app banner, sticky mobile CTA, the word list's "show more" paging and pronunciation.

import {
  PLAY_STORE_URL, APP_STORE_URL, SITE_ORIGIN, WEB_APP_ORIGIN, SUPABASE_URL, WORD_IMAGE_ORIGIN, escapeHtml, breakableHtml,
} from "./community.js";
import { sectionSlug } from "./slug.js";
import {
  strings, fmt, plural, countLabel, wordsPhrase, languageName, categoryName, modeName,
  LANGUAGE_CODES, catalogPath, textDirection, ogLocale,
} from "./deck-i18n.js";
import { isIndexableDeck, isIndexableSection } from "./indexing.js";

export const MOBILE_ORIGIN = "https://mobile.atomtranslate.com";
export const APP_STORE_ID = "6792120675";
export const ANDROID_PACKAGE = "com.valentineos.atomtranslate";

export { MIN_INDEXABLE_WORDS } from "./indexing.js";

const MAX_JSON_LD_TERMS = 200;
const QUIZ_POOL_SIZE = 60;
// Words shown (and marked up) on the deck page of a multi-section deck; section pages list them all.
const DECK_SAMPLE_SHOWN = 20;

// Runs before first paint so the page never flashes the wrong theme. Inline on purpose (an
// external file would load too late); the CSP allows exactly this text by its hash.
const THEME_SCRIPT =
  "(function(){try{var t=localStorage.getItem('atl-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();";

let themeHashPromise;
function themeScriptHash() {
  themeHashPromise ??= crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(THEME_SCRIPT))
    .then((buf) => `'sha256-${btoa(String.fromCharCode(...new Uint8Array(buf)))}'`);
  return themeHashPromise;
}

/**
 * Security headers for these Function-rendered pages (Pages does not apply _headers to Function
 * responses). Mirrors PAGE_SECURITY_HEADERS plus the theme script's hash; connect-src 'self'
 * covers the leaderboard teaser (/api/decks/…), which is proxied same-origin.
 */
export async function pageHeaders(extra = {}) {
  const hash = await themeScriptHash();
  return {
    "Content-Security-Policy": `default-src 'self'; script-src 'self' ${hash} https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: ${SUPABASE_URL} ${WORD_IMAGE_ORIGIN}; connect-src 'self' https://cloudflareinsights.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`,
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Content-Type": "text/html; charset=UTF-8",
    ...extra,
  };
}

// JSON inside <script>: escaping "<" means neither "</script>" nor "<!--" can appear.
function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function truncate(text, max) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,;:.\-–—\s]+$/, "")}…`;
}

const SCRIPTS = {
  latin: /\p{Script=Latin}/gu,
  cyrillic: /\p{Script=Cyrillic}/gu,
  arabic: /\p{Script=Arabic}/gu,
  cjk: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu,
};

/** The script most of a text's letters are written in ("latin", "cyrillic", …), or null without letters. */
export function dominantScript(text) {
  let best = null;
  let bestCount = 0;
  for (const [name, re] of Object.entries(SCRIPTS)) {
    const count = (String(text ?? "").match(re) || []).length;
    if (count > bestCount) { best = name; bestCount = count; }
  }
  return best;
}

/**
 * An author's description is written in whatever language they chose, but the meta description is
 * the snippet people read in search results in the page's language. A description in another
 * script (an English one on a Ukrainian page) is left out of the meta tags — the page still shows
 * it — in favour of the generated, localized one.
 */
export function descriptionFitsPage(text, localizedSample) {
  const written = dominantScript(text);
  const expected = dominantScript(localizedSample);
  return !written || !expected || written === expected;
}

/* ------------------------------------------------------------------------------- icons */

const ICONS = {
  search: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></g></svg>`,
  play: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/></g></svg>`,
  moon: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.7 14.6A8.6 8.6 0 0 1 9.4 3.3a.8.8 0 0 0-1-1A10 10 0 1 0 21.7 15.6a.8.8 0 0 0-1-1Z"/></svg>`,
  chevron: `<svg class="chev" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="9 6 15 12 9 18"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></g></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>`,
  googlePlay: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 3.6c0-.5.3-.9.7-1.1L14.3 12 3.7 21.5c-.4-.2-.7-.6-.7-1.1V3.6Zm12.5 9.5 2.6-2.6 3.4 2c.7.4.7 1.5 0 1.9l-3.4 2-2.6-2.6ZM4.8 2.2 16 8.6l-2.3 2.3-8.9-8.7Zm0 19.6 8.9-8.7L16 15.4 4.8 21.8Z"/></svg>`,
  browser: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="16" rx="2.5"/><path d="M2.5 8.5h19"/><path d="M6 6.25h.01M8.5 6.25h.01"/></g></svg>`,
  apple: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.05 12.5c-.03-2.8 2.28-4.15 2.39-4.22-1.3-1.9-3.32-2.16-4.04-2.19-1.72-.17-3.35 1.02-4.22 1.02-.87 0-2.2-1-3.63-.97-1.87.03-3.6 1.09-4.56 2.76-1.95 3.38-.5 8.38 1.4 11.12.93 1.34 2.03 2.85 3.48 2.8 1.4-.06 1.93-.9 3.62-.9 1.68 0 2.17.9 3.65.87 1.51-.03 2.46-1.37 3.38-2.72 1.07-1.55 1.5-3.06 1.53-3.13-.03-.01-2.94-1.13-2.97-4.44Zm-2.8-8.16c.77-.94 1.29-2.24 1.15-3.54-1.11.05-2.46.74-3.26 1.67-.71.82-1.34 2.15-1.17 3.42 1.24.1 2.5-.63 3.28-1.55Z"/></svg>`,
};

/* ------------------------------------------------------------------------------- chrome */

/**
 * Site header, after the pattern of public set pages elsewhere (logo left; the way into the web
 * app and the theme switch right): compact store links on wide screens, "Web app" everywhere.
 * `webLink` is the same deck or section in app.atomtranslate.com's public Community, which opens
 * without signing in; pages that are not about one deck pass nothing and get Community itself.
 * On phones the store links live in the footer; the iOS Smart App Banner and the Android bar
 * handle "open in the app" there.
 */
function headerHtml(s, { homeHref, webLink, wide = false }) {
  const web = webLink || `${WEB_APP_ORIGIN}/community`;
  return `
<header class="top${wide ? " top--wide" : ""}">
  <a class="brand" href="${escapeHtml(homeHref)}">
    <img src="/apple-touch-icon.png" width="32" height="32" alt="">
    <span>Atom Translate</span>
  </a>
  <div class="top__actions">
    <a class="top-store" href="${PLAY_STORE_URL}">${ICONS.googlePlay}<span class="sr-only">${escapeHtml(s.getItOn)} </span><span>Google Play</span></a>
    <a class="top-store" href="${APP_STORE_URL}">${ICONS.apple}<span class="sr-only">${escapeHtml(s.downloadOn)} </span><span>App Store</span></a>
    <a class="top-web" href="${escapeHtml(web)}">${ICONS.browser}<span>${escapeHtml(s.webVersion)}</span></a>
    <button class="theme-toggle" type="button" hidden data-theme-toggle
      data-label-light="${escapeHtml(s.themeToLight)}" data-label-dark="${escapeHtml(s.themeToDark)}">
      <span class="icon-sun">${ICONS.sun}</span><span class="icon-moon">${ICONS.moon}</span>
    </button>
  </div>
</header>`;
}

function footerHtml(s, lang, { wide = false, extraHtml = "" } = {}) {
  const home = lang === "uk" ? "/uk/" : "/";
  return `
<footer class="foot${wide ? " foot--wide" : ""}">
  <div class="foot__stores">${storeBadgesHtml(s)}</div>
  <nav aria-label="Atom Translate">
    <a href="${catalogPath(lang)}">${escapeHtml(s.allDecks)}</a>
    <a href="${SITE_ORIGIN}${home}">Atom Translate</a>
    <a href="${SITE_ORIGIN}/support.html">${escapeHtml(s.support)}</a>
    <a href="${SITE_ORIGIN}/privacy-policy.html">${escapeHtml(s.privacy)}</a>
  </nav>${extraHtml}
</footer>`;
}

function storeBadgesHtml(s) {
  return `
<div class="stores">
  <a class="store" href="${PLAY_STORE_URL}">
    ${ICONS.googlePlay}<span><small>${escapeHtml(s.getItOn)}</small>Google Play</span>
  </a>
  <a class="store" href="${APP_STORE_URL}">
    ${ICONS.apple}<span><small>${escapeHtml(s.downloadOn)}</small>App Store</span>
  </a>
</div>`;
}

/** Android only, shown by deck.js; a small bar, never a full-screen interstitial. */
function androidBannerHtml(s, intentUrl) {
  return `
<div class="app-banner" hidden data-app-banner>
  <img src="/apple-touch-icon.png" width="36" height="36" alt="">
  <p>${escapeHtml(s.bannerText)}</p>
  <a class="app-banner__open" href="${escapeHtml(intentUrl)}">${escapeHtml(s.bannerOpen)}</a>
  <button class="app-banner__close" type="button" data-app-banner-close aria-label="${escapeHtml(s.bannerClose)}">${ICONS.close}</button>
</div>`;
}

/**
 * The whole document. `appLink` (the mobile.atomtranslate.com URL of a deck) adds the iOS Smart
 * App Banner pointing at it.
 */
export function documentShell({
  lang, title, description, robots, canonical, ogUrl, jsonLd, appLink, bodyHtml, pageData, ogType = "website", alternates,
}) {
  return `<!doctype html>
<html lang="${escapeHtml(lang)}" dir="${textDirection(lang)}" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>${THEME_SCRIPT}</script>
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="${escapeHtml(robots)}">
${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">\n` : ""}<meta name="color-scheme" content="dark light">
${(alternates || []).map((a) => `<link rel="alternate" hreflang="${escapeHtml(a.hreflang)}" href="${escapeHtml(a.href)}">`).join("\n")}
<meta name="theme-color" content="#121316" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#F8F9FB" media="(prefers-color-scheme: light)">
${appLink ? `<meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}, app-argument=${escapeHtml(appLink)}">\n` : ""}<meta property="og:type" content="${escapeHtml(ogType)}">
<meta property="og:site_name" content="Atom Translate">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(ogUrl)}">
<meta property="og:image" content="${SITE_ORIGIN}/og-image.png?v=2">
<meta property="og:locale" content="${ogLocale(lang)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${SITE_ORIGIN}/og-image.png?v=2">
<link rel="icon" href="/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/assets/deck.css?v=13">
${jsonLd ? `<script type="application/ld+json">${safeJson(jsonLd)}</script>\n` : ""}</head>
<body>
${bodyHtml}
${pageData ? `<script type="application/json" id="deck-data">${safeJson(pageData)}</script>\n<script src="/assets/deck.js?v=5" defer></script>` : `<script src="/assets/deck.js?v=5" defer></script>`}
</body>
</html>`;
}

/* ---------------------------------------------------------------------------- deck page */

export function mobileDeckUrl(shortId) {
  return `${MOBILE_ORIGIN}/community/${encodeURIComponent(shortId)}`;
}

export function deckPath(shortId, slug) {
  return `/decks/${encodeURIComponent(shortId)}/${slug}`;
}

/** Things title, H1, description and JSON-LD share. */
export function deckFacts(folder, sections, lang) {
  const s = strings(lang);
  const publicWordCount = sections.reduce((sum, sec) => sum + sec.wordCount, 0);
  const wordCount = publicWordCount || Number(folder.word_count) || 0;
  const language = folder.language || "";
  const phrase = wordsPhrase(lang, wordCount, lang === "uk" ? language : languageName(lang, language));
  const qualifiers = [folder.level || ""].filter(Boolean);
  const subtitle = `${phrase} ${s.withTranslation}`;
  const title = `${folder.name} — ${subtitle}${qualifiers.length ? ` (${qualifiers.join(", ")})` : ""} | Atom Translate`;
  return { wordCount, subtitle, title, qualifiers };
}

function deckDescription(folder, facts, authorName, lang) {
  const s = strings(lang);
  if (folder.description && folder.description.trim()) return truncate(folder.description, 160);
  const extra = facts.qualifiers.length ? `, ${facts.qualifiers.join(", ")}` : "";
  return truncate(fmt(s.fallbackDescription,
    capitalize(wordsPhrase(lang, facts.wordCount, lang === "uk" ? folder.language : languageName(lang, folder.language))),
    folder.name,
    (authorName ? fmt(s.fallbackBy, authorName) : "") + extra), 200);
}

function capitalize(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/**
 * Photo (or the initial on a tinted disc when there is none) + name, linking to the author's
 * profile in the web app. That route is behind sign-in: a visitor without an account is sent to
 * the login screen first and lands on the profile after it.
 */
function authorHtml(author, s) {
  const name = author.name || s.unknownAuthor;
  const initial = Array.from(name.trim())[0]?.toUpperCase() || "?";
  const picture = author.avatarUrl
    ? `<img class="author__photo" src="${escapeHtml(author.avatarUrl)}" width="32" height="32" alt="" referrerpolicy="no-referrer">`
    : `<span class="author__photo author__photo--initial" aria-hidden="true">${escapeHtml(initial)}</span>`;
  const href = `${WEB_APP_ORIGIN}/community/author/${encodeURIComponent(author.id)}`;
  return `<a class="author" href="${escapeHtml(href)}">
        ${picture}<span class="author__text"><small>${escapeHtml(s.by)}</small><span class="author__name">${escapeHtml(name)}</span><span class="sr-only">, ${escapeHtml(s.authorProfile)}</span></span>
      </a>`;
}

function intentUrl(shortId) {
  const target = `mobile.atomtranslate.com/community/${encodeURIComponent(shortId)}`;
  return `intent://${target}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;
}

/**
 * The words the deck page shows: every word when one section holds them all (its section page
 * points here as canonical), otherwise a short sample — the full lists live on section pages.
 */
function deckShownWords(sections) {
  const withWords = sections.filter((sec) => sec.wordCount > 0);
  const all = sections.flatMap((sec) => sec.words);
  return withWords.length === 1 ? { words: all, complete: true } : { words: all.slice(0, DECK_SAMPLE_SHOWN), complete: false };
}

/** Structured data may describe only what the page shows: the full description, not the meta cut. */
function fullDescription(text, fallback) {
  const t = String(text || "").trim();
  return t || fallback;
}

function deckJsonLd({ folder, sections, facts, description, canonical, lang, authorName }) {
  const s = strings(lang);
  const inLanguage = [folder.language, folder.native_language].filter(Boolean).map((l) => LANGUAGE_CODES[l] || l);
  // Only the words visible on this page are marked up; each section page carries its own
  // DefinedTermSet with its full list, and the deck's set points at those parts.
  const terms = deckShownWords(sections).words.slice(0, MAX_JSON_LD_TERMS)
    .map((w) => ({ "@type": "DefinedTerm", name: w.original, description: w.translation }));
  const parts = sections.filter((sec) => sec.wordCount > 0).map((sec) => ({
    "@type": "DefinedTermSet",
    name: sec.name,
    url: `${canonical}/${sectionSlug(sec)}`,
  }));
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Atom Translate", item: `${SITE_ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: s.decks, item: `${SITE_ORIGIN}${catalogPath(lang)}` },
          { "@type": "ListItem", position: 3, name: folder.name, item: canonical },
        ],
      },
      {
        "@type": "DefinedTermSet",
        "@id": `${canonical}#words`,
        name: `${folder.name} — ${facts.subtitle}`,
        description: fullDescription(folder.description, description),
        url: canonical,
        ...(inLanguage.length ? { inLanguage: inLanguage.length === 1 ? inLanguage[0] : inLanguage } : {}),
        ...(folder.updated_at ? { dateModified: folder.updated_at } : {}),
        ...(authorName ? { creator: { "@type": "Person", name: authorName } } : {}),
        ...(folder.level ? { educationalLevel: folder.level } : {}),
        ...(terms.length ? { hasDefinedTerm: terms } : {}),
        ...(parts.length > 1 ? { hasPart: parts } : {}),
        publisher: { "@type": "Organization", name: "Atom Translate", url: `${SITE_ORIGIN}/` },
      },
    ],
  };
}

function quizPool(sections) {
  const all = sections.flatMap((sec) => sec.words);
  if (all.length <= QUIZ_POOL_SIZE) return all.map((w) => [w.original, w.translation]);
  // Spread across the whole deck, deterministic so the page HTML stays cacheable.
  const step = all.length / QUIZ_POOL_SIZE;
  return Array.from({ length: QUIZ_POOL_SIZE }, (_, i) => all[Math.floor(i * step)]).map((w) => [w.original, w.translation]);
}

// The six practice modes, as the app's section screen shows them (SectionHeaderContent): same
// order, pictograms and tints. The `mode` is the web app's /study/:mode segment.
const MODES = [
  { mode: "flashcards", icon: "joker", tone: "accent" },
  { mode: "quiz", icon: "fountain_pen", tone: "info" },
  { mode: "writing", icon: "memo", tone: "success" },
  { mode: "matching", icon: "link", tone: "muted" },
  { mode: "truefalse", icon: "approved", tone: "danger" },
  { mode: "listening", icon: "headphone", tone: "warning" },
];

const LOCK_ICON = `<svg class="mode__lock" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></g></svg>`;

/**
 * The real exercises, in the web app. They need an account: /study/* there sits behind sign-in,
 * so a visitor without one goes through the login screen and lands on the exercise after it.
 */
function modesHtml(s, lang, scope, id, heading) {
  const tiles = MODES.map((m) => {
    const name = modeName(lang, m.mode);
    const href = `${WEB_APP_ORIGIN}/study/${m.mode}/${scope}/${encodeURIComponent(id)}`;
    return `<li><a class="mode mode--${m.tone}" href="${escapeHtml(href)}" aria-label="${escapeHtml(fmt(s.modeLockedLabel, name))}">
          <img src="/assets/icons/${m.icon}.png" width="32" height="32" alt="" loading="lazy">
          <span>${escapeHtml(name)}</span>${LOCK_ICON}
        </a></li>`;
  }).join("");
  return `
  <section class="panel modes" aria-labelledby="modes-title">
    <h2 id="modes-title">${escapeHtml(heading)}</h2>
    <p class="modes__note">${LOCK_ICON}<span>${escapeHtml(s.modesLocked)}</span></p>
    <ul class="modes__grid">${tiles}</ul>
  </section>`;
}

// The word list, as cards like the app's section screen: picture (when the word has one),
// word, translation, and a pronounce button. Every word is in the HTML — crawlers and no-JS
// visitors get the whole list; deck.js then shows WORDS_PAGE at a time behind a "show more"
// button and reveals the pronounce buttons where the browser can speak.
const WORDS_PAGE = 60;

function wordListHtml(words, folder, s) {
  const code = LANGUAGE_CODES[folder.language] || "";
  const langAttr = code ? ` lang="${escapeHtml(code)}"` : "";
  const items = words.map((w) => `<li class="wcard">${w.imageUrl
    ? `<img class="wcard__img" src="${escapeHtml(w.imageUrl)}" alt="" width="56" height="56" loading="lazy" decoding="async">`
    : ""}<span class="wcard__text"><span class="wcard__orig"${langAttr}>${escapeHtml(w.original)}</span><span class="wcard__tr">${escapeHtml(w.translation)}</span></span><button type="button" class="wcard__speak" data-speak hidden aria-label="${escapeHtml(fmt(s.pronounce, w.original))}"><img src="/assets/icons/speaker.png" width="20" height="20" alt=""></button></li>`).join("");
  const more = words.length > WORDS_PAGE
    ? `<button type="button" class="btn words-more" data-words-more hidden data-label="${escapeHtml(s.showMoreWords)}"></button>`
    : "";
  return `<ul class="wcards" data-words data-page="${WORDS_PAGE}" data-lang="${escapeHtml(code)}">${items}</ul>${more}`;
}

function quizPanelHtml(s) {
  return `
  <section class="panel quiz" id="quiz" hidden aria-labelledby="quiz-title">
    <h2 id="quiz-title">${escapeHtml(s.quizTitle)}</h2>
    <div data-quiz-body></div>
  </section>`;
}

function chipsHtml(folder, s, lang) {
  const languagePair = [languageName(lang, folder.language), languageName(lang, folder.native_language)]
    .filter(Boolean).join(" → ");
  const chips = [
    { text: languagePair, kind: "language" },
    { text: categoryName(lang, folder.category), kind: "category" },
    { text: folder.level ? `${s.level} ${folder.level}` : "", kind: "level" },
  ].filter((c) => c.text);
  return chips.length
    ? `<ul class="chips">${chips.map((c) => `<li class="chip chip--${c.kind}">${escapeHtml(c.text)}</li>`).join("")}</ul>`
    : "";
}

/** Data for /assets/deck.js: quiz pool, links and the strings it needs. */
function pageDataFor({ lang, s, shortId, variant, quizSections, fullTestUrl, firstRanked, appLink, isMain, withBoard }) {
  return {
    lang,
    code: shortId,
    variant,
    board: withBoard,
    quiz: quizPool(quizSections),
    webFolderQuiz: fullTestUrl,
    firstRankedQuiz: firstRanked ? `${WEB_APP_ORIGIN}/study/quiz/section/${encodeURIComponent(firstRanked.id)}` : null,
    sectionQuizBase: `${WEB_APP_ORIGIN}/study/quiz/section/`,
    appLink,
    isMain,
    s: {
      quizIntro: s.quizIntro,
      questions: s.questions, quizQuestion: s.quizQuestion, quizCorrect: s.quizCorrect, quizWrong: s.quizWrong,
      quizNext: s.quizNext, quizStart: s.quizStart, quizResult: s.quizResult, quizResultHint: s.quizResultHint,
      quizContinueWeb: s.signInFullTest, quizAgain: s.quizAgain, openInApp: s.openInApp,
      boardIn: s.boardIn, boardEmpty: s.boardEmpty, boardBeFirst: s.boardBeFirst, boardTry: s.boardTry, boardPlayers: s.boardPlayers,
      seconds: s.seconds, minutes: s.minutes,
      modes: Object.fromEntries(["writing", "quiz", "matching", "true_false", "listening"].map((m) => [m, modeName(lang, m)])),
    },
  };
}

function heroCtaHtml(s, { isMain, appLink, hasQuiz }) {
  return `<div class="cta" data-hero-cta>
      ${hasQuiz ? `<a class="btn btn--primary" href="#quiz" data-start-quiz hidden>${escapeHtml(s.demoTest)}</a>` : ""}
      ${isMain ? `<a class="btn btn--secondary only-touch" href="${escapeHtml(appLink)}">${ICONS.phone}<span>${escapeHtml(s.openInApp)}</span></a>` : ""}
    </div>`;
}

/**
 * The web app's Community page of a deck, or of one of its sections (app.atomtranslate.com, no
 * sign-in needed): there people browse it and, once signed in, add it to their library. That page
 * is noindex with its canonical pointing back here.
 */
function webCommunityLink(shortId, sectionId) {
  const deck = `${WEB_APP_ORIGIN}/community/folder/${encodeURIComponent(shortId)}`;
  return sectionId ? `${deck}/section/${encodeURIComponent(sectionId)}` : deck;
}

/** Path part of an absolute URL: links between our own pages stay on the current host. */
function pathOf(url) {
  return new URL(url).pathname;
}

function hasQuizWords(sections) {
  const translations = new Set(sections.flatMap((sec) => sec.words.map((w) => w.translation)));
  return translations.size >= 4;
}

/**
 * The deck page.
 * @param {object} p
 * @param {"main"|"mobile"} p.variant
 * @param {object} p.folder     deck row (fetchDeckByShortId)
 * @param {Array}  p.sections   [{ id, name, description, words: [{original, translation}] }]
 * @param {{id: string, name: string, avatarUrl: string|null}} p.author
 * @param {number|null} p.learners
 * @param {string} p.lang       "uk" | "en"
 * @param {string} p.canonical  absolute /decks URL
 */
export function renderDeckPage({ variant, folder, sections, author, learners, lang, canonical }) {
  const s = strings(lang);
  const authorName = author?.name || "";
  const shortId = folder.short_id;
  const facts = deckFacts(folder, sections, lang);
  const description = deckDescription(folder, facts, authorName, lang);
  const appLink = mobileDeckUrl(shortId);
  const isMain = variant === "main";
  const indexable = isIndexableDeck({ name: folder.name, wordCount: facts.wordCount, sectionNames: sections.map((sec) => sec.name) });
  const sectionsWithWords = sections.filter((sec) => sec.wordCount > 0);
  const firstRanked = sections.find((sec) => sec.wordCount >= 4);
  const hasQuiz = hasQuizWords(sections);

  const learnersHtml = Number.isFinite(learners) && learners >= 2
    ? `<span class="stat stat--learners">${escapeHtml(`${learners} ${plural(lang, learners, s.learners)}`)}</span>`
    : "";

  const sectionCards = sectionsWithWords.map((sec) => `
      <li><a class="sec-card" href="${escapeHtml(`${pathOf(canonical)}/${sectionSlug(sec)}`)}">
        <span class="sec-card__icon"><img src="/assets/icons/books.png" width="36" height="36" alt=""></span>
        <span class="sec-card__body">
          <span class="sec-card__name">${breakableHtml(sec.name)}</span>
          <span class="sec-card__count">${escapeHtml(countLabel(lang, sec.wordCount, s.words))}</span>
          ${sec.description ? `<span class="sec-card__desc">${escapeHtml(truncate(sec.description, 120))}</span>` : ""}
        </span>
        ${ICONS.chevron}
      </a></li>`).join("");


  const shown = deckShownWords(sections);
  const shownWordsHtml = shown.words.length ? `<section class="panel words-panel" aria-labelledby="words-title">
    <h2 id="words-title">${escapeHtml(shown.complete ? s.wordsTitle : s.sampleWordsTitle)}${shown.complete ? ` <span class="all-words__count">${escapeHtml(String(shown.words.length))}</span>` : ""}</h2>
    ${wordListHtml(shown.words, folder, s)}
    ${shown.complete ? "" : `<p class="words-panel__hint">${escapeHtml(s.sampleWordsHint)}</p>`}
  </section>` : "";

  const bodyHtml = `
${androidBannerHtml(s, intentUrl(shortId))}
${headerHtml(s, { homeHref: `${SITE_ORIGIN}${lang === "uk" ? "/uk/" : "/"}`, webLink: webCommunityLink(folder.short_id) })}
<main class="page">
  <nav class="crumbs" aria-label="Breadcrumb">
    <ol><li><a href="${catalogPath(lang)}">${escapeHtml(s.decks)}</a></li><li aria-current="page">${escapeHtml(folder.name)}</li></ol>
  </nav>
  <section class="hero" aria-labelledby="deck-title">
    <div class="hero__head">
      <span class="hero__icon"><img src="/assets/icons/open_file_folder.png" width="44" height="44" alt=""></span>
      <h1 id="deck-title"><span class="hero__name">${breakableHtml(folder.name)}</span><span class="hero__sub">${escapeHtml(facts.subtitle)}</span></h1>
    </div>
    <div class="hero__meta">
      ${author?.id ? authorHtml(author, s) : ""}
      <span class="hero__sections">${escapeHtml(countLabel(lang, sectionsWithWords.length || Number(folder.section_count) || 0, s.sections))}</span>
    </div>
    ${chipsHtml(folder, s, lang)}
    ${folder.description && folder.description.trim() ? `<p class="hero__desc">${escapeHtml(folder.description.trim())}</p>` : ""}
    ${learnersHtml ? `<p class="stats">${learnersHtml}</p>` : ""}
    ${heroCtaHtml(s, { isMain, appLink, hasQuiz })}
  </section>

  ${hasQuiz ? quizPanelHtml(s) : ""}

  ${sectionsWithWords.length ? `<section class="sections" aria-labelledby="sections-title">
    <h2 id="sections-title">${escapeHtml(s.sectionsHeading)}</h2>
    <ul class="sec-list">${sectionCards}
    </ul>
  </section>` : ""}

  ${shownWordsHtml}

  ${facts.wordCount > 0 ? modesHtml(s, lang, "folder", folder.id, s.modesDeck) : ""}

  <section class="panel board" id="board" hidden aria-labelledby="board-title">
    <h2 id="board-title">${escapeHtml(s.boardTitle)}</h2>
    <div data-board-body aria-live="polite"></div>
  </section>

</main>
${footerHtml(s, lang)}
${hasQuiz ? `<div class="sticky-cta" hidden data-sticky-cta><a class="btn btn--primary" href="#quiz" data-start-quiz>${escapeHtml(s.demoTest)}</a></div>` : ""}`;

  return documentShell({
    lang,
    title: facts.title,
    description,
    robots: indexable ? "index,follow,max-image-preview:large" : "noindex,follow",
    canonical,
    ogUrl: canonical,
    ogType: "article",
    // JSON-LD only on the canonical page: the deep-link twin points at it.
    jsonLd: isMain ? deckJsonLd({ folder, sections, facts, description, canonical, lang, authorName }) : null,
    appLink,
    bodyHtml,
    pageData: pageDataFor({
      lang, s, shortId, variant, quizSections: sections,
      fullTestUrl: `${WEB_APP_ORIGIN}/study/quiz/folder/${encodeURIComponent(folder.id)}`,
      firstRanked, appLink, isMain, withBoard: true,
    }),
  });
}

/**
 * One section's page: /decks/{CODE}/{deck-slug}/{section-slug}. Only on the main host (the app
 * link is per deck). Same chrome as the deck page; its own title, description and words, the
 * exercises for just this section, and navigation to the neighbouring sections.
 */
export function renderSectionPage({ folder, sections, section, author, lang, deckUrl, canonical }) {
  const s = strings(lang);
  const shortId = folder.short_id;
  const appLink = mobileDeckUrl(shortId);
  const visible = sections.filter((sec) => sec.wordCount > 0);
  const index = visible.findIndex((sec) => sec.id === section.id);
  const prev = index > 0 ? visible[index - 1] : null;
  const next = index >= 0 && index < visible.length - 1 ? visible[index + 1] : null;
  const count = section.wordCount;
  // The only section with words shows exactly the deck page's words: point search engines at the
  // deck page instead of keeping two URLs with the same content (the sitemap leaves it out too).
  const onlySection = visible.length === 1 && visible[0].id === section.id;
  const pageCanonical = onlySection ? deckUrl : canonical;
  const deckIndexable = isIndexableDeck({
    name: folder.name,
    wordCount: deckFacts(folder, sections, lang).wordCount,
    sectionNames: sections.map((sec) => sec.name),
  });
  const phrase = wordsPhrase(lang, count, lang === "uk" ? folder.language : languageName(lang, folder.language));
  const subtitle = `${phrase} ${s.withTranslation}`;
  const qualifiers = [folder.level || ""].filter(Boolean);
  const title = `${section.name} — ${folder.name}: ${subtitle}${qualifiers.length ? ` (${qualifiers.join(", ")})` : ""} | Atom Translate`;
  const description = section.description && section.description.trim() && descriptionFitsPage(section.description, s.sectionFallbackDescription)
    ? truncate(section.description, 160)
    : truncate(fmt(s.sectionFallbackDescription, capitalize(phrase), section.name, folder.name), 200);
  const hasQuiz = hasQuizWords([section]);

  const navLink = (sec, label, rel) => sec
    ? `<a class="sec-nav__link sec-nav__link--${rel}" rel="${rel}" href="${escapeHtml(`${pathOf(deckUrl)}/${sectionSlug(sec)}`)}"><small>${escapeHtml(label)}</small><span>${escapeHtml(sec.name)}</span></a>`
    : `<span></span>`;

  const bodyHtml = `
${androidBannerHtml(s, intentUrl(shortId))}
${headerHtml(s, { homeHref: `${SITE_ORIGIN}${lang === "uk" ? "/uk/" : "/"}`, webLink: webCommunityLink(folder.short_id, section.id) })}
<main class="page">
  <nav class="crumbs" aria-label="Breadcrumb">
    <ol>
      <li><a href="${catalogPath(lang)}">${escapeHtml(s.decks)}</a></li>
      <li><a href="${escapeHtml(pathOf(deckUrl))}">${escapeHtml(folder.name)}</a></li>
      <li aria-current="page">${escapeHtml(section.name)}</li>
    </ol>
  </nav>
  <section class="hero" aria-labelledby="section-title">
    <div class="hero__head">
      <span class="hero__icon"><img src="/assets/icons/books.png" width="44" height="44" alt=""></span>
      <h1 id="section-title"><span class="hero__name">${breakableHtml(section.name)}</span><span class="hero__sub">${escapeHtml(`${folder.name} · ${subtitle}`)}</span></h1>
    </div>
    <div class="hero__meta">${author?.id ? authorHtml(author, s) : ""}</div>
    ${chipsHtml(folder, s, lang)}
    ${section.description && section.description.trim() ? `<p class="hero__desc">${escapeHtml(section.description.trim())}</p>` : ""}
    ${heroCtaHtml(s, { isMain: true, appLink, hasQuiz })}
  </section>

  ${hasQuiz ? quizPanelHtml(s) : ""}

  ${count > 0 ? modesHtml(s, lang, "section", section.id, s.modesSection) : ""}

  <section class="panel words-panel" aria-labelledby="words-title">
    <h2 id="words-title">${escapeHtml(s.wordsTitle)} <span class="all-words__count">${escapeHtml(String(count))}</span></h2>
    ${wordListHtml(section.words, folder, s)}
  </section>

  <nav class="sec-nav" aria-label="${escapeHtml(s.sectionsHeading)}">
    ${navLink(prev, s.prevSection, "prev")}
    ${navLink(next, s.nextSection, "next")}
  </nav>
  <p class="back-to-deck"><a href="${escapeHtml(pathOf(deckUrl))}">${escapeHtml(s.backToDeck)}</a></p>
</main>
${footerHtml(s, lang)}
${hasQuiz ? `<div class="sticky-cta" hidden data-sticky-cta><a class="btn btn--primary" href="#quiz" data-start-quiz>${escapeHtml(s.demoTest)}</a></div>` : ""}`;

  const inLanguage = [folder.language, folder.native_language].filter(Boolean).map((l) => LANGUAGE_CODES[l] || l);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Atom Translate", item: `${SITE_ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: s.decks, item: `${SITE_ORIGIN}${catalogPath(lang)}` },
          { "@type": "ListItem", position: 3, name: folder.name, item: deckUrl },
          { "@type": "ListItem", position: 4, name: section.name, item: canonical },
        ],
      },
      {
        "@type": "DefinedTermSet",
        "@id": `${canonical}#words`,
        name: `${section.name} — ${folder.name}`,
        description: fullDescription(section.description, description),
        url: canonical,
        isPartOf: { "@id": `${deckUrl}#words` },
        ...(inLanguage.length ? { inLanguage: inLanguage.length === 1 ? inLanguage[0] : inLanguage } : {}),
        ...(section.updatedAt || folder.updated_at ? { dateModified: section.updatedAt || folder.updated_at } : {}),
        ...(author?.name ? { creator: { "@type": "Person", name: author.name } } : {}),
        ...(folder.level ? { educationalLevel: folder.level } : {}),
        publisher: { "@type": "Organization", name: "Atom Translate", url: `${SITE_ORIGIN}/` },
        hasDefinedTerm: section.words.slice(0, MAX_JSON_LD_TERMS)
          .map((w) => ({ "@type": "DefinedTerm", name: w.original, description: w.translation })),
      },
    ],
  };

  return documentShell({
    lang,
    title,
    description,
    robots: isIndexableSection({ deckIndexable, name: section.name, wordCount: count }) ? "index,follow,max-image-preview:large" : "noindex,follow",
    canonical: pageCanonical,
    ogUrl: pageCanonical,
    ogType: "article",
    jsonLd,
    appLink,
    bodyHtml,
    pageData: pageDataFor({
      lang, s, shortId, variant: "main", quizSections: [section],
      fullTestUrl: `${WEB_APP_ORIGIN}/study/quiz/section/${encodeURIComponent(section.id)}`,
      firstRanked: null, appLink, isMain: true, withBoard: false,
    }),
  });
}

/* ------------------------------------------------------------------------ 404 / 503 */

export function renderMessagePage({ lang, kind, url }) {
  const s = strings(lang);
  const [title, body] = kind === "unavailable" ? [s.unavailableTitle, s.unavailableBody]
    : kind === "reviewing" ? [s.reviewingTitle, s.reviewingBody]
    : [s.notFoundTitle, s.notFoundBody];
  return documentShell({
    lang,
    title: `${title} — Atom Translate`,
    description: body,
    robots: "noindex",
    ogUrl: url,
    bodyHtml: `
${headerHtml(s, { homeHref: `${SITE_ORIGIN}${lang === "uk" ? "/uk/" : "/"}` })}
<main class="page">
  <section class="hero hero--message">
    <h1>${escapeHtml(title)}</h1>
    <p class="hero__desc">${escapeHtml(body)}</p>
    <div class="cta"><a class="btn btn--primary" href="${SITE_ORIGIN}${catalogPath(lang)}">${escapeHtml(s.allDecks)}</a></div>
  </section>
</main>
${footerHtml(s, lang)}`,
  });
}

export { headerHtml, footerHtml, ICONS };
