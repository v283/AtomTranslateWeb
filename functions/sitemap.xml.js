// GET /sitemap.xml — static landing pages, the /decks catalog, and up to MAX_DECKS public decks
// at their canonical /decks/{short_id}/{slug} URL (lastmod = folders.updated_at). Decks below
// MIN_INDEXABLE_WORDS are left out: their pages are noindex. The old /community/{short_id} URLs
// are gone from here — on atomtranslate.com they 301 to /decks. Replaces the old hand-written static
// sitemap.xml. Deck rows come from fetchPublicFolderIndex (Supabase REST, anon key, RLS-scoped —
// same mechanism as the community page). If that lookup fails the response is still a valid
// 200 sitemap with just the static pages (or the decks fetched before a later page failed),
// cached briefly so it recovers on its own.

import { SITE_ORIGIN, fetchPublicFolderIndex, fetchPublicSectionIndex } from "./_lib/community.js";
import { deckLang } from "./_lib/deck-i18n.js";
import { deckSlug, sectionSlug } from "./_lib/slug.js";
import { deckPath, MIN_INDEXABLE_WORDS } from "./_lib/deck-page.js";

const MAX_DECKS = 5000;

// The landing locales are alternates of each other (mirrors the <link rel="alternate">
// tags in index.html and uk/index.html).
const LANDING_ALTERNATES = [
  { hreflang: "en", path: "/" },
  { hreflang: "uk", path: "/uk/" },
  { hreflang: "x-default", path: "/" },
];

// The Quizlet import tutorial exists in the same locales as the landing page.
const TUTORIAL_ALTERNATES = [
  { hreflang: "en", path: "/tutorial-quizlet-import.html" },
  { hreflang: "uk", path: "/uk/tutorial-quizlet-import.html" },
  { hreflang: "x-default", path: "/tutorial-quizlet-import.html" },
];

const STATIC_PAGES = [
  { path: "/", alternates: LANDING_ALTERNATES },
  { path: "/uk/", alternates: LANDING_ALTERNATES },
  { path: "/support.html" },
  { path: "/tutorial-quizlet-import.html", alternates: TUTORIAL_ALTERNATES },
  { path: "/uk/tutorial-quizlet-import.html", alternates: TUTORIAL_ALTERNATES },
  { path: "/report.html" },
  { path: "/privacy-policy.html" },
  { path: "/decks" },
];

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  }[c]));
}

function urlEntry(loc, { lastmod, alternates } = {}) {
  const parts = [`  <url>\n    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  for (const alt of alternates || []) {
    parts.push(`    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(SITE_ORIGIN + alt.path)}" />`);
  }
  parts.push("  </url>");
  return parts.join("\n");
}

function toW3cDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function buildSitemap(decks, sections = []) {
  const entries = STATIC_PAGES.map((p) => urlEntry(SITE_ORIGIN + p.path, { alternates: p.alternates }));
  const seen = new Set();
  for (const deck of decks) {
    const shortId = String(deck.short_id || "").trim();
    const key = shortId.toUpperCase();
    if (!shortId || seen.has(key)) continue;
    if ((Number(deck.word_count) || 0) < MIN_INDEXABLE_WORDS) continue;
    seen.add(key);
    entries.push(urlEntry(`${SITE_ORIGIN}${deckPath(shortId, deckSlug(deck, deckLang(deck)))}`, {
      lastmod: toW3cDate(deck.updated_at),
    }));
  }
  // Section pages (/decks/{CODE}/{slug}/{section}), same 10-word bar as the deck pages.
  for (const sec of sections) {
    const code = String(sec.folder_short_id || "").trim();
    if (!code || (Number(sec.word_count) || 0) < MIN_INDEXABLE_WORDS) continue;
    const folder = { name: sec.folder_name, native_language: sec.folder_native_language };
    const path = `${deckPath(code, deckSlug(folder, deckLang(folder)))}/${sectionSlug({ id: sec.section_id, name: sec.section_name })}`;
    entries.push(urlEntry(`${SITE_ORIGIN}${path}`, { lastmod: toW3cDate(sec.section_updated_at) }));
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>
`;
}

export async function onRequestGet() {
  let decks = [];
  let sections = [];
  let degraded = false;
  try {
    const [index, sectionRows] = await Promise.all([fetchPublicFolderIndex(MAX_DECKS), fetchPublicSectionIndex()]);
    decks = index.rows;
    sections = sectionRows;
    degraded = !index.complete;
  } catch {
    degraded = true;
  }

  return new Response(buildSitemap(decks, sections), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": degraded ? "public, max-age=300" : "public, max-age=3600, s-maxage=21600",
    },
  });
}

export async function onRequestHead(context) {
  const res = await onRequestGet(context);
  return new Response(null, { status: res.status, headers: res.headers });
}
