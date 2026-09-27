// GET /sitemap.xml — static landing pages plus up to MAX_DECKS public community decks
// (/community/{short_id}, lastmod = folders.updated_at). Replaces the old hand-written static
// sitemap.xml. Deck rows come from fetchPublicFolderIndex (Supabase REST, anon key, RLS-scoped —
// same mechanism as the community page). If that lookup fails the response is still a valid
// 200 sitemap with just the static pages (or the decks fetched before a later page failed),
// cached briefly so it recovers on its own.

import { SITE_ORIGIN, fetchPublicFolderIndex } from "./_lib/community.js";

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

function buildSitemap(decks) {
  const entries = STATIC_PAGES.map((p) => urlEntry(SITE_ORIGIN + p.path, { alternates: p.alternates }));
  const seen = new Set();
  for (const deck of decks) {
    const shortId = String(deck.short_id || "").trim();
    const key = shortId.toUpperCase();
    if (!shortId || seen.has(key)) continue;
    seen.add(key);
    entries.push(urlEntry(`${SITE_ORIGIN}/community/${encodeURIComponent(shortId)}`, {
      lastmod: toW3cDate(deck.updated_at),
    }));
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
  let degraded = false;
  try {
    const index = await fetchPublicFolderIndex(MAX_DECKS);
    decks = index.rows;
    degraded = !index.complete;
  } catch {
    degraded = true;
  }

  return new Response(buildSitemap(decks), {
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
