// Shared request handling for the deck pages: host rules, edge caching, and the one function
// that loads + renders a deck for either variant. No onRequest* export: a plain module.

import { SITE_ORIGIN, fetchDeckByShortId, fetchDeckContent, fetchDeckAuthorName, fetchDeckLearners } from "./community.js";
import { deckLang } from "./deck-i18n.js";
import { deckSlug } from "./slug.js";
import { renderDeckPage, renderMessagePage, pageHeaders, deckPath } from "./deck-page.js";

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

export async function fromCache(key) {
  try {
    return await caches.default.match(key);
  } catch {
    return undefined;
  }
}

export function toCache(context, key, response) {
  if (response.status !== 200) return;
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
  if (!folder) return messageResponse("notFound", url);

  const lang = deckLang(folder);
  let content;
  try {
    content = await fetchDeckContent(folder.id);
  } catch {
    return messageResponse("unavailable", url, lang);
  }
  const [authorName, learners] = await Promise.all([fetchDeckAuthorName(folder), fetchDeckLearners(folder.id)]);

  const html = renderDeckPage({
    variant,
    folder,
    sections: content.sections,
    authorName,
    learners,
    lang,
    canonical: `${SITE_ORIGIN}${canonicalDeckPath(folder)}`,
  });
  return new Response(html, {
    status: 200,
    headers: await pageHeaders({ "Cache-Control": DECK_CACHE_CONTROL }),
  });
}

/** HEAD answered from the GET handler, without the body. */
export async function headFrom(getHandler, context) {
  const res = await getHandler(context);
  return new Response(null, { status: res.status, headers: res.headers });
}
