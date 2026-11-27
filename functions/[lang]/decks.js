// GET /{lang}/decks — the deck catalog in one of the app's interface languages (Ukrainian at /uk/decks,
// German at /de/decks, …). English lives at /decks, so /en/decks redirects there. A first segment that
// is not a catalog language gets a real 404 (the static fallback would answer 200 with the landing page).

import { renderCatalog } from "../_lib/catalog.js";
import { headFrom, messageResponse } from "../_lib/deck-route.js";
import { isCatalogLang, catalogPath } from "../_lib/deck-i18n.js";

export function onRequestGet(context) {
  const lang = String(context.params.lang || "");
  const url = new URL(context.request.url);
  if (!isCatalogLang(lang)) return messageResponse("notFound", url, "en");
  if (lang === "en") return Response.redirect(`${url.origin}${catalogPath("en")}${url.search}`, 301);
  return renderCatalog(context, lang);
}

export function onRequestHead(context) {
  return headFrom(onRequestGet, context);
}
