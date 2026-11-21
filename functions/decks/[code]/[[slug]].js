// GET /decks/{CODE} and /decks/{CODE}/{slug} — the indexable deck page on atomtranslate.com.
//
// The deck is found by its CODE (folders.short_id) alone; the slug only makes the URL readable.
// Anything but the canonical form — no slug, an old slug after a rename, a lowercase code, a
// trailing slash — answers 301 to /decks/{CODE}/{slug}. The same page on the mobile host
// redirects here too: mobile.atomtranslate.com keeps only /community/{CODE} (the app link).
//
// Rendering is functions/_lib/deck-page.js (variant "main"); data, 404/503 and caching are
// functions/_lib/deck-route.js. Private, deleted and unknown decks are 404 + noindex.

import { SITE_ORIGIN, fetchDeckByShortId } from "../../_lib/community.js";
import {
  SHORT_ID_RE, isMobileHost, cacheKeyFor, fromCache, toCache, messageResponse,
  canonicalDeckPath, renderDeck, headFrom,
} from "../../_lib/deck-route.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = String(context.params.code || "");
  if (!SHORT_ID_RE.test(code)) return messageResponse("notFound", url);

  // Canonical URLs are cached; a cache hit is by definition already canonical.
  const key = cacheKeyFor(url);
  const cached = await fromCache(key);
  if (cached) return cached;

  let folder;
  try {
    folder = await fetchDeckByShortId(code);
  } catch {
    return messageResponse("unavailable", url);
  }
  if (!folder) return messageResponse("notFound", url);

  const canonicalPath = canonicalDeckPath(folder);
  if (isMobileHost(url)) return Response.redirect(`${SITE_ORIGIN}${canonicalPath}`, 301);
  if (url.pathname !== canonicalPath) {
    return Response.redirect(`${url.origin}${canonicalPath}${preservedQuery(url)}`, 301);
  }

  const response = await renderDeck({ code, url, variant: "main", folder });
  toCache(context, key, response);
  return response;
}

export function onRequestHead(context) {
  return headFrom(onRequestGet, context);
}

// ?host=main is how local/preview runs pretend to be the main host; keep it across the redirect.
function preservedQuery(url) {
  return url.searchParams.get("host") === "main" ? "?host=main" : "";
}
