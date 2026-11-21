// One template for every deck page:
//   * variant "main"   — https://atomtranslate.com/decks/{CODE}/{slug}: the indexable page.
//   * variant "mobile" — https://mobile.atomtranslate.com/community/{CODE}: the deep-link landing
//     the app shares (Universal Links / App Links open the app before this ever renders). Same
//     content, but its canonical points at the main page and it has no "Open in the app" button
//     (this URL IS the app link).
// Plus the /decks catalog shell and the 404/503 pages. No onRequest* export: a plain module.
//
// Everything a crawler needs is in the HTML: every word and translation, in <details> per
// section, readable without JS. /assets/deck.js only adds the extras on top: theme switch,
// mini-quiz, leaderboard teaser, Android app banner, sticky mobile CTA.

import {
  PLAY_STORE_URL, APP_STORE_URL, SITE_ORIGIN, WEB_APP_ORIGIN, SUPABASE_URL, escapeHtml,
} from "./community.js";
import {
  strings, fmt, plural, countLabel, wordsPhrase, languageName, categoryName, gradeLabel, modeName,
  LANGUAGE_CODES,
} from "./deck-i18n.js";

export const MOBILE_ORIGIN = "https://mobile.atomtranslate.com";
export const APP_STORE_ID = "6792120675";
export const ANDROID_PACKAGE = "com.valentineos.atomtranslate";

/** Below this many words a deck page is noindex (thin content), and stays out of the sitemap. */
export const MIN_INDEXABLE_WORDS = 10;

const MAX_JSON_LD_TERMS = 200;
const QUIZ_POOL_SIZE = 60;

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
    "Content-Security-Policy": `default-src 'self'; script-src 'self' ${hash} https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: ${SUPABASE_URL}; connect-src 'self' https://cloudflareinsights.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`,
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

function truncate(text, max) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,;:.\-–—\s]+$/, "")}…`;
}

/* ------------------------------------------------------------------------------- icons */

const ICONS = {
  play: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/></g></svg>`,
  moon: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.7 14.6A8.6 8.6 0 0 1 9.4 3.3a.8.8 0 0 0-1-1A10 10 0 1 0 21.7 15.6a.8.8 0 0 0-1-1Z"/></svg>`,
  chevron: `<svg class="chev" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="9 6 15 12 9 18"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></g></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>`,
  googlePlay: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 3.6c0-.5.3-.9.7-1.1L14.3 12 3.7 21.5c-.4-.2-.7-.6-.7-1.1V3.6Zm12.5 9.5 2.6-2.6 3.4 2c.7.4.7 1.5 0 1.9l-3.4 2-2.6-2.6ZM4.8 2.2 16 8.6l-2.3 2.3-8.9-8.7Zm0 19.6 8.9-8.7L16 15.4 4.8 21.8Z"/></svg>`,
  apple: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.05 12.5c-.03-2.8 2.28-4.15 2.39-4.22-1.3-1.9-3.32-2.16-4.04-2.19-1.72-.17-3.35 1.02-4.22 1.02-.87 0-2.2-1-3.63-.97-1.87.03-3.6 1.09-4.56 2.76-1.95 3.38-.5 8.38 1.4 11.12.93 1.34 2.03 2.85 3.48 2.8 1.4-.06 1.93-.9 3.62-.9 1.68 0 2.17.9 3.65.87 1.51-.03 2.46-1.37 3.38-2.72 1.07-1.55 1.5-3.06 1.53-3.13-.03-.01-2.94-1.13-2.97-4.44Zm-2.8-8.16c.77-.94 1.29-2.24 1.15-3.54-1.11.05-2.46.74-3.26 1.67-.71.82-1.34 2.15-1.17 3.42 1.24.1 2.5-.63 3.28-1.55Z"/></svg>`,
};

/* ------------------------------------------------------------------------------- chrome */

function headerHtml(s, { homeHref }) {
  return `
<header class="top">
  <a class="brand" href="${escapeHtml(homeHref)}">
    <img src="/apple-touch-icon.png" width="32" height="32" alt="">
    <span>Atom Translate</span>
  </a>
  <button class="theme-toggle" type="button" hidden data-theme-toggle
    data-label-light="${escapeHtml(s.themeToLight)}" data-label-dark="${escapeHtml(s.themeToDark)}">
    <span class="icon-sun">${ICONS.sun}</span><span class="icon-moon">${ICONS.moon}</span>
  </button>
</header>`;
}

function footerHtml(s, lang) {
  const home = lang === "uk" ? "/uk/" : "/";
  return `
<footer class="foot">
  <nav aria-label="Atom Translate">
    <a href="${SITE_ORIGIN}/decks">${escapeHtml(s.allDecks)}</a>
    <a href="${SITE_ORIGIN}${home}">Atom Translate</a>
    <a href="${SITE_ORIGIN}/support.html">${escapeHtml(s.support)}</a>
    <a href="${SITE_ORIGIN}/privacy-policy.html">${escapeHtml(s.privacy)}</a>
  </nav>
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
  lang, title, description, robots, canonical, ogUrl, jsonLd, appLink, bodyHtml, pageData, ogType = "website",
}) {
  return `<!doctype html>
<html lang="${escapeHtml(lang)}" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>${THEME_SCRIPT}</script>
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="${escapeHtml(robots)}">
${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">\n` : ""}<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#121316" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#F8F9FB" media="(prefers-color-scheme: light)">
${appLink ? `<meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}, app-argument=${escapeHtml(appLink)}">\n` : ""}<meta property="og:type" content="${escapeHtml(ogType)}">
<meta property="og:site_name" content="Atom Translate">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(ogUrl)}">
<meta property="og:image" content="${SITE_ORIGIN}/og-image.png?v=2">
<meta property="og:locale" content="${lang === "uk" ? "uk_UA" : "en_US"}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${SITE_ORIGIN}/og-image.png?v=2">
<link rel="icon" href="/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/deck.css?v=4">
${jsonLd ? `<script type="application/ld+json">${safeJson(jsonLd)}</script>\n` : ""}</head>
<body>
${bodyHtml}
${pageData ? `<script type="application/json" id="deck-data">${safeJson(pageData)}</script>\n<script src="/assets/deck.js?v=2" defer></script>` : `<script src="/assets/deck.js?v=2" defer></script>`}
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
  const publicWordCount = sections.reduce((sum, sec) => sum + sec.words.length, 0);
  const wordCount = publicWordCount || Number(folder.word_count) || 0;
  const language = folder.language || "";
  const phrase = wordsPhrase(lang, wordCount, lang === "uk" ? language : languageName(lang, language));
  const nameLower = String(folder.name || "").toLowerCase();
  const notInName = (v) => v && !nameLower.includes(String(v).toLowerCase());
  const qualifiers = [
    notInName(folder.textbook) ? folder.textbook.trim() : "",
    gradeLabel(lang, folder.grade),
    notInName(folder.unit) ? folder.unit.trim() : "",
    folder.level || "",
  ].filter(Boolean);
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

function deckJsonLd({ folder, sections, facts, description, canonical, lang, authorName }) {
  const s = strings(lang);
  const inLanguage = [folder.language, folder.native_language].filter(Boolean).map((l) => LANGUAGE_CODES[l] || l);
  const terms = [];
  for (const sec of sections) {
    for (const w of sec.words) {
      if (terms.length >= MAX_JSON_LD_TERMS) break;
      terms.push({ "@type": "DefinedTerm", name: w.original, description: w.translation });
    }
  }
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Atom Translate", item: `${SITE_ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: s.decks, item: `${SITE_ORIGIN}/decks` },
          { "@type": "ListItem", position: 3, name: folder.name, item: canonical },
        ],
      },
      {
        "@type": "DefinedTermSet",
        "@id": `${canonical}#words`,
        name: `${folder.name} — ${facts.subtitle}`,
        description,
        url: canonical,
        ...(inLanguage.length ? { inLanguage: inLanguage.length === 1 ? inLanguage[0] : inLanguage } : {}),
        ...(folder.updated_at ? { dateModified: folder.updated_at } : {}),
        ...(authorName ? { creator: { "@type": "Person", name: authorName } } : {}),
        ...(folder.level ? { educationalLevel: folder.level } : {}),
        ...(terms.length ? { hasDefinedTerm: terms } : {}),
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

/**
 * @param {object} p
 * @param {"main"|"mobile"} p.variant
 * @param {object} p.folder     deck row (fetchDeckByShortId)
 * @param {Array}  p.sections   [{ id, name, words: [{original, translation}] }]
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
  const webFolderQuiz = `${WEB_APP_ORIGIN}/study/quiz/folder/${encodeURIComponent(folder.id)}`;
  const sectionQuiz = (sec) => `${WEB_APP_ORIGIN}/study/quiz/section/${encodeURIComponent(sec.id)}`;
  const isMain = variant === "main";
  const indexable = facts.wordCount >= MIN_INDEXABLE_WORDS;

  const languagePair = [languageName(lang, folder.language), languageName(lang, folder.native_language)]
    .filter(Boolean).join(" → ");
  const chips = [
    { text: languagePair, kind: "language" },
    { text: categoryName(lang, folder.category), kind: "category" },
    { text: folder.level ? `${s.level} ${folder.level}` : "", kind: "level" },
  ].filter((c) => c.text);
  const bookChips = [
    folder.textbook ? `${s.textbook}: ${folder.textbook.trim()}` : "",
    gradeLabel(lang, folder.grade),
    folder.unit ? folder.unit.trim() : "",
  ].filter(Boolean);

  const sectionsWithWords = sections.filter((sec) => sec.words.length > 0);
  const firstRanked = sections.find((sec) => sec.words.length >= 4);

  const sectionsHtml = sectionsWithWords.map((sec, i) => `
    <details class="sec"${i === 0 ? " open" : ""}>
      <summary>
        <span class="sec__name">${escapeHtml(sec.name)}</span>
        <span class="sec__count">${escapeHtml(countLabel(lang, sec.words.length, s.words))}</span>
        ${ICONS.chevron}
      </summary>
      <div class="sec__body">
        <a class="btn btn--train" href="${escapeHtml(sectionQuiz(sec))}" aria-label="${escapeHtml(fmt(s.trainSection, sec.name))}">${ICONS.play}<span>${escapeHtml(s.train)}</span></a>
        <table class="words">
          <thead class="sr-only"><tr><th scope="col">${escapeHtml(s.original)}</th><th scope="col">${escapeHtml(s.translation)}</th></tr></thead>
          <tbody>${sec.words.map((w) => `<tr><td lang="${escapeHtml(LANGUAGE_CODES[folder.language] || "")}">${escapeHtml(w.original)}</td><td>${escapeHtml(w.translation)}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    </details>`).join("");

  const learnersHtml = Number.isFinite(learners) && learners >= 2
    ? `<p class="learners">${escapeHtml(`${learners} ${plural(lang, learners, s.learners)}`)}</p>`
    : "";

  const bodyHtml = `
${androidBannerHtml(s, intentUrl(shortId))}
${headerHtml(s, { homeHref: `${SITE_ORIGIN}${lang === "uk" ? "/uk/" : "/"}` })}
<main class="page">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="${SITE_ORIGIN}/decks">${escapeHtml(s.decks)}</a>
  </nav>
  <section class="hero" aria-labelledby="deck-title">
    <h1 id="deck-title"><span class="hero__name">${escapeHtml(folder.name)}</span><span class="hero__sub">${escapeHtml(facts.subtitle)}</span></h1>
    <div class="hero__meta">
      ${author?.id ? authorHtml(author, s) : ""}
      <span class="hero__sections">${escapeHtml(countLabel(lang, sectionsWithWords.length || Number(folder.section_count) || 0, s.sections))}</span>
    </div>
    ${chips.length || bookChips.length ? `<ul class="chips">${[...bookChips.map((c) => `<li class="chip chip--book">${escapeHtml(c)}</li>`), ...chips.map((c) => `<li class="chip chip--${c.kind}">${escapeHtml(c.text)}</li>`)].join("")}</ul>` : ""}
    ${folder.description && folder.description.trim() ? `<p class="hero__desc">${escapeHtml(folder.description.trim())}</p>` : ""}
    ${learnersHtml}
    <div class="cta" data-hero-cta>
      ${facts.wordCount > 0 ? `<a class="btn btn--primary" href="${escapeHtml(webFolderQuiz)}">${escapeHtml(s.takeTest)}</a>` : ""}
      ${isMain ? `<a class="btn btn--secondary only-touch" href="${escapeHtml(appLink)}">${ICONS.phone}<span>${escapeHtml(s.openInApp)}</span></a>` : ""}
    </div>
    ${storeBadgesHtml(s)}
    <p class="hint">${escapeHtml(s.alreadyHaveApp)}</p>
  </section>

  <section class="panel quiz" id="quiz" hidden aria-labelledby="quiz-title">
    <h2 id="quiz-title">${escapeHtml(s.quizTitle)}</h2>
    <div data-quiz-body></div>
  </section>

  <section class="panel board" id="board" hidden aria-labelledby="board-title">
    <h2 id="board-title">${escapeHtml(s.boardTitle)}</h2>
    <div data-board-body aria-live="polite"></div>
  </section>

  ${sectionsWithWords.length ? `<section class="sections" aria-labelledby="sections-title">
    <h2 id="sections-title">${escapeHtml(s.sectionsTitle)}</h2>
    ${sectionsHtml}
  </section>` : ""}
</main>
${footerHtml(s, lang)}
${facts.wordCount > 0 ? `<div class="sticky-cta" hidden data-sticky-cta><a class="btn btn--primary" href="${escapeHtml(webFolderQuiz)}">${escapeHtml(s.learnThese)}</a></div>` : ""}`;

  const pageData = {
    lang,
    code: shortId,
    variant,
    quiz: quizPool(sections),
    webFolderQuiz,
    firstRankedQuiz: firstRanked ? sectionQuiz(firstRanked) : null,
    sectionQuizBase: `${WEB_APP_ORIGIN}/study/quiz/section/`,
    appLink,
    isMain,
    s: {
      quizIntro: s.quizIntro,
      questions: s.questions, quizQuestion: s.quizQuestion, quizCorrect: s.quizCorrect, quizWrong: s.quizWrong,
      quizNext: s.quizNext, quizStart: s.quizStart, quizResult: s.quizResult, quizResultHint: s.quizResultHint,
      quizContinueWeb: s.quizContinueWeb, quizAgain: s.quizAgain, openInApp: s.openInApp,
      boardIn: s.boardIn, boardEmpty: s.boardEmpty, boardBeFirst: s.boardBeFirst, boardTry: s.boardTry, boardPlayers: s.boardPlayers,
      seconds: s.seconds, minutes: s.minutes,
      modes: Object.fromEntries(["writing", "quiz", "matching", "true_false", "listening"].map((m) => [m, modeName(lang, m)])),
    },
  };

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
    pageData,
  });
}


/* ------------------------------------------------------------------------ 404 / 503 */

export function renderMessagePage({ lang, kind, url }) {
  const s = strings(lang);
  const title = kind === "unavailable" ? s.unavailableTitle : s.notFoundTitle;
  const body = kind === "unavailable" ? s.unavailableBody : s.notFoundBody;
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
    <div class="cta"><a class="btn btn--primary" href="${SITE_ORIGIN}/decks">${escapeHtml(s.allDecks)}</a></div>
    ${storeBadgesHtml(s)}
  </section>
</main>
${footerHtml(s, lang)}`,
  });
}

export { headerHtml, footerHtml, ICONS };
