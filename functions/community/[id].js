// GET /community/{short_id} — the page a browser (or an unverified-domain context, e.g. some
// in-app browsers) actually renders. On a device with the app installed and the domain verified,
// Universal Links (iOS) / App Links (Android) intercept this request before it ever reaches here
// — see IDeepLinkService in the TranslateLearn repo. No redirect is issued from this page itself.

const SUPABASE_URL = "https://gfuhaoanbgnvkqozrhxs.supabase.co";
// Same anon key already shipped in the mobile app (TranslateLearn/Constants/AppConfig.cs) —
// access is enforced server-side via RLS, not by keeping this key secret.
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdWhhb2FuYmdudmtxb3pyaHhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDg2MzQsImV4cCI6MjA5OTAyNDYzNH0.WS75W-Nn0oAlhwkeMp93Y3Lla2tIMJhRi5eOXNXM_UE";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.valentineos.atomtranslate";
const APP_STORE_URL = "https://apps.apple.com/ua/app/atom-translate-learn-words/id6792120675";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function wordCountLabel(count) {
  return count === 1 ? "1 word" : `${count} words`;
}

function pageShell({ title, description, ogUrl, bodyHtml }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(ogUrl)}">
<meta property="og:image" content="https://atomtranslate.com/og-image.png">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<link rel="icon" href="https://atomtranslate.com/favicon-32.png">
<style>
  :root {
    --bg: #121316; --bg-elevated: #1c1d22; --border: rgba(255,255,255,0.10);
    --text: #f0f0ec; --text-muted: #a8a79e; --text-faint: #7c7a70;
    --accent: #378add; --accent-dim: #185fa5; --radius-lg: 22px; --radius-sm: 8px;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
    display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .card {
    width: 100%; max-width: 420px; background: var(--bg-elevated); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 32px 28px; text-align: center;
  }
  .avatar {
    width: 56px; height: 56px; border-radius: 50%; background: var(--accent-dim);
    color: #fff; font-size: 22px; font-weight: 700; display: flex; align-items: center;
    justify-content: center; margin: 0 auto 16px;
  }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: var(--text-muted); font-size: 14px; margin: 0 0 4px; }
  .badges { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 14px 0 22px; }
  .badge {
    background: rgba(255,255,255,0.06); border: 1px solid var(--border); color: var(--text-muted);
    font-size: 12px; padding: 4px 10px; border-radius: 999px;
  }
  .stores { display: flex; flex-direction: column; gap: 10px; }
  .btn {
    display: block; padding: 13px 16px; border-radius: var(--radius-sm); text-decoration: none;
    font-weight: 600; font-size: 15px;
  }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-secondary { background: transparent; border: 1px solid var(--border); color: var(--text); }
  .hint { color: var(--text-faint); font-size: 12px; margin-top: 18px; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function notFoundPage(shortId, url) {
  const html = pageShell({
    title: "Deck not found — Atom Translate",
    description: "This deck link is no longer available.",
    ogUrl: url,
    bodyHtml: `
    <div class="card">
      <h1>This deck link is no longer available</h1>
      <p class="meta">The folder for "${escapeHtml(shortId)}" is private or doesn't exist.</p>
      <div class="stores">
        <a class="btn btn-primary" href="${PLAY_STORE_URL}">Get it on Google Play</a>
        <a class="btn btn-secondary" href="${APP_STORE_URL}">Download on the App Store</a>
      </div>
    </div>`,
  });
  return new Response(html, { status: 404, headers: { "Content-Type": "text/html; charset=UTF-8" } });
}

export async function onRequestGet({ params, request }) {
  const shortId = String(params.id || "").trim();
  const url = request.url;

  if (!shortId) return notFoundPage(shortId, url);

  const query = new URLSearchParams({
    short_id: `eq.${shortId.toUpperCase()}`,
    is_public: "eq.true",
    select: "name,short_id,category,level,language,author_name,word_count,section_count",
  });

  let folder;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/folders?${query}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    const rows = res.ok ? await res.json() : [];
    folder = rows[0];
  } catch {
    folder = undefined;
  }

  if (!folder) return notFoundPage(shortId, url);

  const authorName = folder.author_name || "";
  const initial = authorName ? authorName[0].toUpperCase() : "?";
  const description = `${wordCountLabel(folder.word_count)} · ${folder.section_count} section${folder.section_count === 1 ? "" : "s"}${authorName ? ` · by ${authorName}` : ""}`;

  const badges = [folder.language, folder.category, folder.level].filter(Boolean);

  const html = pageShell({
    title: `${folder.name} — Atom Translate`,
    description,
    ogUrl: url,
    bodyHtml: `
    <div class="card">
      <div class="avatar">${escapeHtml(initial)}</div>
      <h1>${escapeHtml(folder.name)}</h1>
      <p class="meta">${authorName ? `by ${escapeHtml(authorName)} · ` : ""}${escapeHtml(wordCountLabel(folder.word_count))}</p>
      ${badges.length ? `<div class="badges">${badges.map((b) => `<span class="badge">${escapeHtml(b)}</span>`).join("")}</div>` : ""}
      <div class="stores">
        <a class="btn btn-primary" href="${PLAY_STORE_URL}">Get it on Google Play</a>
        <a class="btn btn-secondary" href="${APP_STORE_URL}">Download on the App Store</a>
      </div>
      <p class="hint">Already have Atom Translate? Opening this link on your phone opens the deck directly.</p>
    </div>`,
  });

  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=UTF-8" } });
}
