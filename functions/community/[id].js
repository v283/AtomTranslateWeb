// GET /community/{short_id}
//
// On mobile.atomtranslate.com this is the deep-link landing the app shares. With the app
// installed and the domain verified, Universal Links (iOS) / App Links (Android) open the app
// before the request ever gets here (see IDeepLinkService in the TranslateLearn repo); only a
// browser without the app — or an in-app browser that ignores app links — renders this page.
// It is the same page as atomtranslate.com/decks/{CODE}/{slug} (functions/_lib/deck-page.js,
// variant "mobile"), with rel=canonical pointing there: one design to maintain, and search
// engines credit the main domain. Nothing is redirected on this host — a redirect away from the
// app-link URL would break the hand-off to the app on some browsers.
//
// On atomtranslate.com the old /community/{CODE} URLs (indexed and in the sitemap until the
// /decks pages existed) answer 301 to /decks/{CODE}/{slug}.

import { SITE_ORIGIN, fetchDeckByShortId } from "../_lib/community.js";
import {
  SHORT_ID_RE, isMainHost, cacheKeyFor, fromCache, toCache, messageResponse,
  canonicalDeckPath, renderDeck, headFrom,
} from "../_lib/deck-route.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = String(context.params.id || "").trim();
  if (!SHORT_ID_RE.test(code)) return messageResponse("notFound", url);

  if (isMainHost(url)) {
    let folder;
    try {
      folder = await fetchDeckByShortId(code);
    } catch {
      return messageResponse("unavailable", url);
    }
    if (!folder) return messageResponse("notFound", url);
    const target = url.hostname === "atomtranslate.com"
      ? `${SITE_ORIGIN}${canonicalDeckPath(folder)}`
      : `${url.origin}${canonicalDeckPath(folder)}?host=main`;
    return Response.redirect(target, 301);
  }

  // Keyed on the code as typed: the app shares upper-case codes, and a lower-case one simply
  // gets its own cache entry rather than a redirect (see the header).
  const key = cacheKeyFor(url);
  const cached = await fromCache(key);
  if (cached) return cached;

  const response = await renderDeck({ code, url, variant: "mobile" });
  toCache(context, key, response);
  return response;
}

export function onRequestHead(context) {
  return headFrom(onRequestGet, context);
}
