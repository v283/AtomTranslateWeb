// GET /api/community/{short_id}/sections/{sectionId} — lazy-load JSON for one section, fetched
// client-side by the accordion in functions/community/[id].js on first expand. short_id isn't
// used to scope the query below: Supabase RLS already requires the word's section AND that
// section's parent folder to both be public before an anon request can read it (same chain the
// mobile app's SyncService.GetPublicWordsAsync relies on), so a section id from a different
// public folder just returns that folder's words, not a security issue — this endpoint only ever
// serves already-public data.

import { fetchWordsForSection } from "../../../../_lib/community.js";
import { cacheKeyFor, fromCache, toCache } from "../../../../_lib/deck-route.js";

export async function onRequestGet(context) {
  const { params } = context;
  const sectionId = String(params.sectionId || "").trim();
  if (!sectionId) {
    return Response.json({ words: [] }, { status: 400 });
  }

  // Same edge cache as the deck pages: repeated expands (or a script hammering the URL) don't
  // reach Supabase more than once per ten minutes per section.
  const key = cacheKeyFor(new URL(context.request.url));
  const cached = await fromCache(key);
  if (cached) return cached;

  let words = [];
  try {
    words = await fetchWordsForSection(sectionId);
  } catch {
    return Response.json({ words: [] }, { status: 502 });
  }

  const response = Response.json({ words }, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=600" },
  });
  toCache(context, key, response);
  return response;
}
