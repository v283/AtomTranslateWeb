// GET /decks — the public deck catalog in English (the default and x-default). The other interface
// languages are served at /{lang}/decks by functions/[lang]/decks.js; the page itself is built in
// functions/_lib/catalog.js.

import { renderCatalog } from "../_lib/catalog.js";
import { headFrom } from "../_lib/deck-route.js";

export function onRequestGet(context) {
  return renderCatalog(context, "en");
}

export function onRequestHead(context) {
  return headFrom(onRequestGet, context);
}
