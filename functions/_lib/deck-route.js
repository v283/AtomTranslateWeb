// Shared request handling for the deck pages: host rules, edge caching, and the one function
// that loads + renders a deck for either variant. No onRequest* export: a plain module.

import { SITE_ORIGIN, fetchDeckByShortId, isDeckUnderReview, fetchDeckContent, fetchDeckAuthor, fetchDeckLearners } from "./community.js";
import { deckLang } from "./deck-i18n.js";
import { deckSlug, sectionSlug } from "./slug.js";
import { renderDeckPage, renderSectionPage, renderMessagePage, pageHeaders, deckPath } from "./deck-page.js";

// Short ids come from generate_short_id() (8 chars, A-Z/2-9) or the app's identical generator;
// anything far outside that shape can't match, so it 404s without an upstream call.
export const SHORT_ID_RE = /^[A-Za-z0-9]{1,32}$/;

const PRODUCTION_MAIN_HOST = "atomtranslate.com";

/** atomtranslate.com, or a preview/local host asked to act as it with ?host=main. */
export function isMainHost(url) {
  if (url.hostname === PRODUCTION_MAIN_HOST) return true;
  return !isProductionHost(url) && url.searchParams.get("host") === "main";
}

export function isMobileHost(url) {
  return url.hostname.startsWith("mobile.");
}

function isProductionHost(url) {
  return url.hostname === PRODUCTION_MAIN_HOST || url.hostname.endsWith(".atomtranslate.com");
}

/**
 * Deck HTML is the same for everyone (theme and banners are client-side), so it is cached at the
 * edge: a crawler walking the sitemap must not cost a Supabase round trip per page. Ten minutes
 * at the edge, five in the browser — an author's edit shows up within that.
 */
export const DECK_CACHE_CONTROL = "public, max-age=300, s-maxage=600";
const NO_STORE = { "Cache-Control": "no-store" };

/** caches.default keyed on origin + path only: query strings must not fan the cache out. */
export function cacheKeyFor(url, extra = "") {
  return new Request(`${url.origin}${url.pathname}${extra}`, { method: "GET" });
}

// Local `wrangler pages dev` keeps the cache between runs: never cache there, so a code change
// shows up on the next reload.
function isLocal(request) {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export async function fromCache(key) {
  if (isLocal(key)) return undefined;
  try {
    return await caches.default.match(key);
  } catch {
    return undefined;
  }
}

export function toCache(context, key, response) {
  if (response.status !== 200 || isLocal(key)) return;
  try {
    context.waitUntil(caches.default.put(key, response.clone()));
  } catch {
    // No cache in local dev (or quota): serve uncached.
  }
}

export async function messageResponse(kind, url, lang = "uk") {
  const status = kind === "unavailable" ? 503 : 404;
  const extra = kind === "unavailable" ? { ...NO_STORE, "Retry-After": "300" } : NO_STORE;
  return new Response(renderMessagePage({ lang, kind, url: url.toString() }), {
    status,
    headers: await pageHeaders(extra),
  });
}

/**
 * The answer for a code with no visible deck: "in review" while its first check runs, otherwise
 * "not found". Both 404, noindex and uncached, so the deck shows up as soon as it is approved.
 */
export async function missingDeckResponse(code, url) {
  return messageResponse((await isDeckUnderReview(code)) ? "reviewing" : "notFound", url);
}

/** Canonical /decks path of a deck row. */
export function canonicalDeckPath(folder) {
  return deckPath(folder.short_id, deckSlug(folder, deckLang(folder)));
}

/**
 * Loads a public deck and renders it. Resolves to { response } or { folder } when the caller
 * only needed the row (redirects). `variant` "main" or "mobile".
 */
export async function renderDeck({ code, url, variant, folder: preloaded }) {
  let folder = preloaded;
  if (!folder) {
    try {
      folder = await fetchDeckByShortId(code);
    } catch {
      return messageResponse("unavailable", url);
    }
  }
  if (!folder) return missingDeckResponse(code, url);

  const lang = deckLang(folder);
  let content;
  try {
    content = await fetchDeckContent(folder.id);
  } catch {
    return messageResponse("unavailable", url, lang);
  }
  const [author, learners] = await Promise.all([fetchDeckAuthor(folder), fetchDeckLearners(folder.id)]);

  const html = renderDeckPage({
    variant,
    folder,
    sections: content.sections,
    author,
    learners,
    lang,
    canonical: `${SITE_ORIGIN}${canonicalDeckPath(folder)}`,
  });
  return new Response(html, {
    status: 200,
    headers: await pageHeaders({ "Cache-Control": DECK_CACHE_CONTROL }),
  });
}

/**
 * A section page. `idPart` is the hex id prefix from the URL; the caller has the deck row already.
 * Resolves to { response } for a 200/404/503, or { redirect } with the canonical path when the
 * URL's readable parts are stale.
 */
export async function renderSection({ url, folder, idPart, requestedPath }) {
  const lang = deckLang(folder);
  let content;
  try {
    content = await fetchDeckContent(folder.id, {
      pickSection: (sections) => sections.find((sec) => sec.id.replace(/-/g, "").toLowerCase().startsWith(idPart)),
    });
  } catch {
    return { response: await messageResponse("unavailable", url, lang) };
  }
  const section = content.sections.find((sec) => sec.id.replace(/-/g, "").toLowerCase().startsWith(idPart));
  if (!section) return { response: await messageResponse("notFound", url, lang) };

  const deckCanonicalPath = canonicalDeckPath(folder);
  const path = `${deckCanonicalPath}/${sectionSlug(section)}`;
  if (requestedPath !== path) return { redirect: path };

  const author = await fetchDeckAuthor(folder);
  const html = renderSectionPage({
    folder,
    sections: content.sections,
    section,
    author,
    lang,
    deckUrl: `${SITE_ORIGIN}${deckCanonicalPath}`,
    canonical: `${SITE_ORIGIN}${path}`,
  });
  return {
    response: new Response(html, {
      status: 200,
      headers: await pageHeaders({ "Cache-Control": DECK_CACHE_CONTROL }),
    }),
  };
}

/** HEAD answered from the GET handler, without the body. */
export async function headFrom(getHandler, context) {
  const res = await getHandler(context);
  return new Response(null, { status: res.status, headers: res.headers });
}
