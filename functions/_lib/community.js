// Shared helpers for the Community deep-link landing page (functions/community/[id].js) and its
// lazy-load JSON endpoint (functions/api/community/[shortId]/sections/[sectionId].js). No
// onRequest* export here, so Cloudflare Pages doesn't register this file as a route — it's a
// plain module the two of them import.

export const SUPABASE_URL = "https://gfuhaoanbgnvkqozrhxs.supabase.co";
// Same anon key already shipped in the mobile app (TranslateLearn/Constants/AppConfig.cs) —
// access is enforced server-side via RLS (the public/private folder→section→word chain), not by
// keeping this key secret.
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdWhhb2FuYmdudmtxb3pyaHhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDg2MzQsImV4cCI6MjA5OTAyNDYzNH0.WS75W-Nn0oAlhwkeMp93Y3Lla2tIMJhRi5eOXNXM_UE";

export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.valentineos.atomtranslate";
export const APP_STORE_URL = "https://apps.apple.com/ua/app/atom-translate-learn-words/id6792120675";

function supabaseHeaders() {
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export function wordCountLabel(count) {
  return count === 1 ? "1 word" : `${count} words`;
}

export async function fetchFolderByShortId(shortId) {
  const query = new URLSearchParams({
    short_id: `eq.${shortId.toUpperCase()}`,
    is_public: "eq.true",
    select: "id,name,short_id,category,level,language,author_name,word_count,section_count",
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/folders?${query}`, { headers: supabaseHeaders() });
  if (!res.ok) return undefined;
  const rows = await res.json();
  return rows[0];
}

// Section list + a per-section word count, in two cheap requests (id/name only, then just the
// section_id column of every word) — deliberately not the words themselves, so a page load never
// pulls the actual deck content; that only happens once a section is expanded client-side.
export async function fetchSectionsWithCounts(folderId) {
  const sectionsQuery = new URLSearchParams({
    folder_id: `eq.${folderId}`,
    is_public: "eq.true",
    select: "id,name",
    order: "created_at.asc",
  });
  const sectionsRes = await fetch(`${SUPABASE_URL}/rest/v1/sections?${sectionsQuery}`, { headers: supabaseHeaders() });
  const sections = sectionsRes.ok ? await sectionsRes.json() : [];
  if (sections.length === 0) return [];

  const idsList = sections.map((s) => s.id).join(",");
  const wordsQuery = new URLSearchParams({
    section_id: `in.(${idsList})`,
    select: "section_id",
  });
  const wordsRes = await fetch(`${SUPABASE_URL}/rest/v1/words?${wordsQuery}`, { headers: supabaseHeaders() });
  const wordRows = wordsRes.ok ? await wordsRes.json() : [];

  const counts = new Map();
  for (const w of wordRows) counts.set(w.section_id, (counts.get(w.section_id) || 0) + 1);

  return sections.map((s) => ({ id: s.id, name: s.name, wordCount: counts.get(s.id) || 0 }));
}

export async function fetchWordsForSection(sectionId) {
  const query = new URLSearchParams({
    section_id: `eq.${sectionId}`,
    select: "original,translation,image_path",
    order: "created_at.asc",
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/words?${query}`, { headers: supabaseHeaders() });
  const words = res.ok ? await res.json() : [];

  const paths = [...new Set(words.map((w) => w.image_path).filter(Boolean))];
  const signedUrls = paths.length ? await createSignedImageUrls(paths) : new Map();

  return words.map((w) => ({
    original: w.original,
    translation: w.translation,
    imageUrl: w.image_path ? signedUrls.get(w.image_path) || null : null,
  }));
}

// Mirrors SyncService.GetSignedImageUrlsAsync's batched CreateSignedUrls call — one request for
// every image in the section instead of one round trip per word.
async function createSignedImageUrls(paths) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/word-images`, {
    method: "POST",
    headers: { ...supabaseHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 3600, paths }),
  });
  const map = new Map();
  if (!res.ok) return map;
  const results = await res.json();
  for (const r of results) {
    if (r.signedURL) map.set(r.path, `${SUPABASE_URL}/storage/v1${r.signedURL}`);
  }
  return map;
}
