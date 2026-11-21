// GET /api/decks/{CODE}/leaderboard — the leaderboard teaser on a deck page, fetched by
// /assets/deck.js after the page has loaded (never part of the server-rendered HTML).
//
// Proxies AtomTranslateApi's GET /v1/leaderboard/decks/{folderId}/top?limit=3: the top of the
// deck's most active section — display names, scores and times only, no ids or avatars. Players'
// names stay out of the indexed HTML on purpose (X-Robots-Tag: noindex here too): they are shown
// to visitors, not published to search engines. Same-origin so the page's CSP connect-src 'self'
// covers it, and cached at the edge so crawlers and visitors don't each hit the API.
//
// An upstream failure answers 200 { unavailable: true } (not 502, which the browser would log as
// a console error on every page view); the page then leaves the teaser out.

import { fetchDeckByShortId } from "../../../_lib/community.js";
import { SHORT_ID_RE, cacheKeyFor, fromCache, toCache } from "../../../_lib/deck-route.js";

const API_ORIGIN = "https://api.atomtranslate.com";
const TIMEOUT_MS = 3000;

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=UTF-8",
  "X-Robots-Tag": "noindex",
  "X-Content-Type-Options": "nosniff",
};

function unavailable() {
  return json({ unavailable: true, entries: [] }, 200, "public, max-age=60");
}

function json(body, status, cacheControl) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, "Cache-Control": cacheControl },
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = String(context.params.code || "");
  if (!SHORT_ID_RE.test(code)) return json({ error: "not_found" }, 404, "no-store");

  const key = cacheKeyFor(url);
  const cached = await fromCache(key);
  if (cached) return cached;

  let folder;
  try {
    folder = await fetchDeckByShortId(code);
  } catch {
    return unavailable();
  }
  if (!folder) return json({ error: "not_found" }, 404, "no-store");

  let teaser;
  try {
    const res = await fetch(`${API_ORIGIN}/v1/leaderboard/decks/${encodeURIComponent(folder.id)}/top?limit=3`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return unavailable();
    teaser = await res.json();
  } catch {
    return unavailable();
  }

  const body = {
    sectionId: typeof teaser.sectionId === "string" ? teaser.sectionId : null,
    sectionName: typeof teaser.sectionName === "string" ? teaser.sectionName : null,
    mode: typeof teaser.mode === "string" ? teaser.mode : null,
    totalWords: Number(teaser.totalWords) || 0,
    players: Number(teaser.players) || 0,
    entries: Array.isArray(teaser.entries)
      ? teaser.entries.slice(0, 3).map((e) => ({
        rank: Number(e.rank) || 0,
        displayName: String(e.displayName ?? ""),
        score: Number(e.score) || 0,
        durationMs: Number(e.durationMs) || 0,
      }))
      : [],
  };
  const response = json(body, 200, "public, max-age=120, s-maxage=300");
  toCache(context, key, response);
  return response;
}
