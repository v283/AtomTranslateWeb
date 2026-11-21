// Shared helpers for the Community deep-link landing page (functions/community/[id].js), its
// lazy-load JSON endpoint (functions/api/community/[shortId]/sections/[sectionId].js) and the
// sitemap (functions/sitemap.xml.js). No onRequest* export here, so Cloudflare Pages doesn't
// register this file as a route — it's a plain module they import.

export const SUPABASE_URL = "https://gfuhaoanbgnvkqozrhxs.supabase.co";
// Same anon key already shipped in the mobile app (TranslateLearn/Constants/AppConfig.cs) —
// access is enforced server-side via RLS (the public/private folder→section→word chain), not by
// keeping this key secret.
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdWhhb2FuYmdudmtxb3pyaHhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDg2MzQsImV4cCI6MjA5OTAyNDYzNH0.WS75W-Nn0oAlhwkeMp93Y3Lla2tIMJhRi5eOXNXM_UE";

export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.valentineos.atomtranslate";
export const APP_STORE_URL = "https://apps.apple.com/ua/app/atom-translate-learn-words/id6792120675";
export const SITE_ORIGIN = "https://atomtranslate.com";
export const WEB_APP_ORIGIN = "https://app.atomtranslate.com";

// Security headers for HTML rendered by Functions. Cloudflare Pages does NOT apply _headers to
// Function responses, so these mirror the site-wide rules there and must be kept in sync.
// script-src 'self' only: the page's own JS lives in /assets/community.js; the JSON-LD block is
// type="application/ld+json", which is data and never executed. style-src needs 'unsafe-inline'
// for the page's <style> block — that grants no script execution. img-src allows Supabase for
// the signed word thumbnails loaded by the accordion.
export const PAGE_SECURITY_HEADERS = {
  "Content-Security-Policy": `default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: ${SUPABASE_URL}; connect-src 'self' https://cloudflareinsights.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`,
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

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

// Resolves to the folder row, or undefined when no public folder has this short id. Throws on an
// upstream failure so the page can answer 503 (retry later) instead of a 404 that would tell
// crawlers the deck is gone.
export async function fetchFolderByShortId(shortId) {
  const query = new URLSearchParams({
    short_id: `eq.${shortId.toUpperCase()}`,
    is_public: "eq.true",
    select: "id,name,short_id,category,level,language,native_language,author_name,word_count,section_count,updated_at",
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/folders?${query}`, { headers: supabaseHeaders() });
  if (!res.ok) throw new Error(`folders lookup failed: ${res.status}`);
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

// Server-rendered preview for crawlers and no-JS visitors: the first `limit` words of one section,
// text only. Deliberately no image URLs — signed URLs expire after an hour, and the page HTML is
// cacheable, so an embedded one could outlive its signature. The full list (with thumbnails) is
// still lazy-loaded client-side through /api/community/{short_id}/sections/{sectionId}.
export async function fetchWordPreview(sectionId, limit = 20) {
  const query = new URLSearchParams({
    section_id: `eq.${sectionId}`,
    select: "original,translation",
    order: "created_at.asc",
    limit: String(limit),
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/words?${query}`, { headers: supabaseHeaders() });
  if (!res.ok) return [];
  return res.json();
}

// Public deck index for functions/sitemap.xml.js: short_id + updated_at of up to `max` public,
// non-deleted folders, most recently updated first. Paged in chunks of 1000 because Supabase's
// PostgREST caps a single response at 1000 rows by default (a bare limit=5000 would silently
// return 1000). Resolves to { rows, complete }. Throws only if the very first page fails; a later
// failure resolves with what was already fetched and complete = false, so the sitemap degrades
// instead of losing every deck.
export async function fetchPublicFolderIndex(max = 5000) {
  // name/textbook/grade/unit/native_language build each deck's canonical /decks URL (slug);
  // word_count decides whether it is indexable at all.
  const pageSize = 1000;
  const rows = [];
  let complete = true;
  let withInfo = true;
  for (let offset = 0; offset < max; offset += pageSize) {
    const limit = Math.min(pageSize, max - offset);
    const query = new URLSearchParams({
      is_public: "eq.true",
      deleted_at: "is.null",
      short_id: "not.is.null",
      select: `short_id,updated_at,name,native_language,word_count${withInfo ? `,${DECK_INFO_COLUMNS}` : ""}`,
      order: "updated_at.desc,id.desc",
      limit: String(limit),
      offset: String(offset),
    });
    let page;
    try {
      let res = await fetch(`${SUPABASE_URL}/rest/v1/folders?${query}`, { headers: supabaseHeaders() });
      if (withInfo && await isSchemaMismatch(res)) {
        withInfo = false;
        offset -= pageSize;
        continue;
      }
      if (!res.ok) throw new Error(`folders index failed: ${res.status}`);
      page = (await res.json()).map(withEmptyDeckInfo);
    } catch (err) {
      if (rows.length === 0) throw err;
      complete = false;
      break;
    }
    rows.push(...page);
    if (page.length < limit) break;
  }
  return { rows, complete };
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

/* ======================================================================================
 * Deck pages (/decks/{CODE}/{slug}, /community/{CODE}) and the /decks catalog.
 * Everything below reads through the anon key under RLS, like the rest of this module.
 * Columns and RPCs from cloud migration 0029 (description/textbook/grade/unit,
 * search_public_folders, …) are used when present; until that migration is applied the
 * fallbacks below keep the pages working without them instead of failing.
 * ====================================================================================== */

const BASE_DECK_COLUMNS = "id,user_id,author_id,name,short_id,category,level,language,native_language,author_name,word_count,section_count,clone_count,created_at,updated_at";
const DECK_INFO_COLUMNS = "description,textbook,grade,unit";
const MAX_DECK_WORDS = 2000;

async function restGet(path, params, extraHeaders = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}?${new URLSearchParams(params)}`, {
    headers: { ...supabaseHeaders(), ...extraHeaders },
  });
  return res;
}

async function rpc(name, body, extraHeaders = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { ...supabaseHeaders(), "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
}

// PostgREST answers 400 (42703 undefined column) or 404 (PGRST202 unknown function) when the
// schema is older than this code. Only those mean "fall back"; anything else is a real failure.
async function isSchemaMismatch(res) {
  if (res.status !== 400 && res.status !== 404) return false;
  try {
    const body = await res.clone().json();
    return ["42703", "PGRST202", "PGRST204", "42883"].includes(body?.code);
  } catch {
    return false;
  }
}

function withEmptyDeckInfo(row) {
  return { description: null, textbook: null, grade: null, unit: null, ...row };
}

/**
 * The public deck with this short id, or undefined. Throws on an upstream failure so the page
 * answers 503 rather than a 404 that would tell crawlers the deck is gone.
 */
export async function fetchDeckByShortId(shortId) {
  const params = (columns) => ({
    short_id: `eq.${shortId.toUpperCase()}`,
    is_public: "eq.true",
    deleted_at: "is.null",
    select: columns,
  });
  let res = await restGet("folders", params(`${BASE_DECK_COLUMNS},${DECK_INFO_COLUMNS}`));
  if (await isSchemaMismatch(res)) res = await restGet("folders", params(BASE_DECK_COLUMNS));
  if (!res.ok) throw new Error(`deck lookup failed: ${res.status}`);
  const rows = await res.json();
  return rows[0] ? withEmptyDeckInfo(rows[0]) : undefined;
}

// Only avatars from the app's own public bucket are shown: the page's CSP allows that host, and a
// stored URL pointing anywhere else is not something to put in front of visitors.
const AVATAR_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/avatars/`;

/**
 * The deck's author for the page: { id, name, avatarUrl }. The author is author_id when set (a
 * clone not yet published keeps its source's author), else the owner. Name and photo are read
 * live from profiles — RLS (migration 0023) shows anon the authors of public decks. A missing
 * profile still yields the id, so the profile link works; name falls back to the stored one.
 */
export async function fetchDeckAuthor(folder) {
  const id = folder.author_id || folder.user_id;
  const author = { id, name: String(folder.author_name || "").trim(), avatarUrl: null };
  try {
    const res = await restGet("profiles", { id: `eq.${id}`, select: "username,avatar_url" });
    if (!res.ok) return author;
    const row = (await res.json())[0];
    if (!row) return author;
    const name = String(row.username || "").trim();
    const avatar = String(row.avatar_url || "");
    return {
      id,
      name: name || author.name,
      avatarUrl: avatar.startsWith(AVATAR_PREFIX) ? avatar : null,
    };
  } catch {
    return author;
  }
}

/**
 * Public sections of the deck with ALL their words (text only), in app order. Words are paged
 * because PostgREST caps a response at 1000 rows; the whole deck is capped at MAX_DECK_WORDS.
 * Throws on an upstream failure.
 */
export async function fetchDeckContent(folderId) {
  const sectionParams = (columns) => ({
    folder_id: `eq.${folderId}`,
    is_public: "eq.true",
    deleted_at: "is.null",
    select: columns,
    order: "created_at.asc,id.asc",
  });
  let sectionsRes = await restGet("sections", sectionParams("id,name,description,updated_at"));
  if (await isSchemaMismatch(sectionsRes)) sectionsRes = await restGet("sections", sectionParams("id,name,updated_at"));
  if (!sectionsRes.ok) throw new Error(`sections lookup failed: ${sectionsRes.status}`);
  const sections = (await sectionsRes.json()).map((s) => ({
    id: s.id, name: s.name, description: s.description ?? null, updatedAt: s.updated_at ?? null, words: [],
  }));
  if (sections.length === 0) return { sections, truncated: false };

  const byId = new Map(sections.map((s) => [s.id, s]));
  const ids = sections.map((s) => s.id).join(",");
  const pageSize = 1000;
  let fetched = 0;
  let truncated = false;
  for (let offset = 0; ; offset += pageSize) {
    const limit = Math.min(pageSize, MAX_DECK_WORDS - fetched);
    if (limit <= 0) { truncated = true; break; }
    const res = await restGet("words", {
      section_id: `in.(${ids})`,
      deleted_at: "is.null",
      select: "section_id,original,translation",
      order: "created_at.asc,id.asc",
      limit: String(limit),
      offset: String(offset),
    });
    if (!res.ok) throw new Error(`words lookup failed: ${res.status}`);
    const page = await res.json();
    for (const w of page) byId.get(w.section_id)?.words.push({ original: w.original, translation: w.translation });
    fetched += page.length;
    if (page.length < limit) break;
  }
  return { sections, truncated };
}

/** Clones + subscriptions of a public deck (migration 0029), or null when not available. */
export async function fetchDeckLearners(folderId) {
  try {
    const res = await rpc("public_folder_learners", { p_ids: [folderId] });
    if (!res.ok) return null;
    const rows = await res.json();
    return Number.isFinite(rows[0]?.learners) ? rows[0].learners : null;
  } catch {
    return null;
  }
}

/**
 * One catalog page: { rows, total }. Search/filters/ranking are search_public_folders
 * (migration 0029); without it, a plain newest-first list with the filters it can still apply.
 */
export async function searchDecks({ search, language, nativeLanguage, category, level, minWords = 0, limit, offset }) {
  const args = {
    p_search: search || null,
    p_language: language || null,
    p_native_language: nativeLanguage || null,
    p_category: category || null,
    p_level: level || null,
    p_textbook: null,
    p_grade: null,
    p_min_words: minWords,
  };
  const [listRes, countRes] = await Promise.all([
    rpc("search_public_folders", { ...args, p_sort: "downloads", p_limit: limit, p_offset: offset }),
    rpc("count_public_folders", args),
  ]);
  if (await isSchemaMismatch(listRes)) return searchDecksFallback({ search, language, nativeLanguage, category, level, minWords, limit, offset });
  if (!listRes.ok) throw new Error(`deck search failed: ${listRes.status}`);
  const rows = (await listRes.json()).map(withEmptyDeckInfo);
  const total = countRes.ok ? Number(await countRes.json()) : rows.length + offset;
  return { rows, total: Number.isFinite(total) ? total : rows.length + offset };
}

async function searchDecksFallback({ search, language, nativeLanguage, category, level, minWords, limit, offset }) {
  const params = {
    is_public: "eq.true",
    deleted_at: "is.null",
    short_id: "not.is.null",
    word_count: `gte.${minWords}`,
    select: BASE_DECK_COLUMNS,
    order: "clone_count.desc,updated_at.desc,id.desc",
    limit: String(limit),
    offset: String(offset),
  };
  if (language) params.language = `eq.${language}`;
  if (nativeLanguage) params.native_language = `eq.${nativeLanguage}`;
  if (category) params.category = `eq.${category}`;
  if (level) params.level = `eq.${level}`;
  // Name only, the whole query as one phrase — the multi-word search needs migration 0029.
  // PostgREST's ilike wildcard is "*"; strip characters that would change the filter syntax.
  const phrase = String(search || "").replace(/[*,()%\\]/g, " ").trim();
  if (phrase) params.name = `ilike.*${phrase}*`;
  const res = await restGet("folders", params, { Prefer: "count=exact" });
  if (!res.ok) throw new Error(`deck list failed: ${res.status}`);
  const rows = (await res.json()).map(withEmptyDeckInfo);
  const range = res.headers.get("Content-Range") || "";
  const total = Number(range.split("/")[1]);
  return { rows, total: Number.isFinite(total) ? total : rows.length + offset };
}

/** Filter values with deck counts: [{ kind, value, decks }]; [] when unavailable. */
export async function fetchDeckFacets(minWords = 0) {
  try {
    const res = await rpc("public_folder_facets", { p_min_words: minWords });
    if (res.ok) return await res.json();
    if (!(await isSchemaMismatch(res))) return [];
    return await facetsFallback(minWords);
  } catch {
    return [];
  }
}

// Before migration 0029: count the four columns that exist over the public decks themselves.
async function facetsFallback(minWords) {
  const res = await restGet("folders", {
    is_public: "eq.true",
    deleted_at: "is.null",
    word_count: `gte.${minWords}`,
    select: "language,native_language,category,level",
    limit: "1000",
  });
  if (!res.ok) return [];
  const counts = new Map();
  for (const row of await res.json()) {
    for (const kind of ["language", "native_language", "category", "level"]) {
      const value = String(row[kind] || "").trim();
      if (!value) continue;
      const key = `${kind}\u0000${value}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts].map(([key, decks]) => {
    const [kind, value] = key.split("\u0000");
    return { kind, value, decks };
  }).sort((a, b) => a.kind.localeCompare(b.kind) || b.decks - a.decks || a.value.localeCompare(b.value));
}

/**
 * Public sections of public decks with word counts (migration 0029's public_section_index), for
 * the sitemap's section pages. [] before that migration — the section pages are still linked from
 * their deck pages, crawlers just find them that way instead.
 */
export async function fetchPublicSectionIndex(max = 20000) {
  try {
    const res = await rpc("public_section_index", { p_limit: max });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
