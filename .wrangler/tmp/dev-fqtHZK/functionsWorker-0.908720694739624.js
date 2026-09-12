var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/pages-5fHukI/functionsWorker-0.908720694739624.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var SUPABASE_URL = "https://gfuhaoanbgnvkqozrhxs.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdWhhb2FuYmdudmtxb3pyaHhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDg2MzQsImV4cCI6MjA5OTAyNDYzNH0.WS75W-Nn0oAlhwkeMp93Y3Lla2tIMJhRi5eOXNXM_UE";
var PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.valentineos.atomtranslate";
var APP_STORE_URL = "https://apps.apple.com/ua/app/atom-translate-learn-words/id6792120675";
function supabaseHeaders() {
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
}
__name(supabaseHeaders, "supabaseHeaders");
__name2(supabaseHeaders, "supabaseHeaders");
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}
__name(escapeHtml, "escapeHtml");
__name2(escapeHtml, "escapeHtml");
function wordCountLabel(count) {
  return count === 1 ? "1 word" : `${count} words`;
}
__name(wordCountLabel, "wordCountLabel");
__name2(wordCountLabel, "wordCountLabel");
async function fetchFolderByShortId(shortId) {
  const query = new URLSearchParams({
    short_id: `eq.${shortId.toUpperCase()}`,
    is_public: "eq.true",
    select: "id,name,short_id,category,level,language,author_name,word_count,section_count"
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/folders?${query}`, { headers: supabaseHeaders() });
  if (!res.ok) return void 0;
  const rows = await res.json();
  return rows[0];
}
__name(fetchFolderByShortId, "fetchFolderByShortId");
__name2(fetchFolderByShortId, "fetchFolderByShortId");
async function fetchSectionsWithCounts(folderId) {
  const sectionsQuery = new URLSearchParams({
    folder_id: `eq.${folderId}`,
    is_public: "eq.true",
    select: "id,name",
    order: "created_at.asc"
  });
  const sectionsRes = await fetch(`${SUPABASE_URL}/rest/v1/sections?${sectionsQuery}`, { headers: supabaseHeaders() });
  const sections = sectionsRes.ok ? await sectionsRes.json() : [];
  if (sections.length === 0) return [];
  const idsList = sections.map((s) => s.id).join(",");
  const wordsQuery = new URLSearchParams({
    section_id: `in.(${idsList})`,
    select: "section_id"
  });
  const wordsRes = await fetch(`${SUPABASE_URL}/rest/v1/words?${wordsQuery}`, { headers: supabaseHeaders() });
  const wordRows = wordsRes.ok ? await wordsRes.json() : [];
  const counts = /* @__PURE__ */ new Map();
  for (const w of wordRows) counts.set(w.section_id, (counts.get(w.section_id) || 0) + 1);
  return sections.map((s) => ({ id: s.id, name: s.name, wordCount: counts.get(s.id) || 0 }));
}
__name(fetchSectionsWithCounts, "fetchSectionsWithCounts");
__name2(fetchSectionsWithCounts, "fetchSectionsWithCounts");
async function fetchWordsForSection(sectionId) {
  const query = new URLSearchParams({
    section_id: `eq.${sectionId}`,
    select: "original,translation,image_path",
    order: "created_at.asc"
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/words?${query}`, { headers: supabaseHeaders() });
  const words = res.ok ? await res.json() : [];
  const paths = [...new Set(words.map((w) => w.image_path).filter(Boolean))];
  const signedUrls = paths.length ? await createSignedImageUrls(paths) : /* @__PURE__ */ new Map();
  return words.map((w) => ({
    original: w.original,
    translation: w.translation,
    imageUrl: w.image_path ? signedUrls.get(w.image_path) || null : null
  }));
}
__name(fetchWordsForSection, "fetchWordsForSection");
__name2(fetchWordsForSection, "fetchWordsForSection");
async function createSignedImageUrls(paths) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/word-images`, {
    method: "POST",
    headers: { ...supabaseHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 3600, paths })
  });
  const map = /* @__PURE__ */ new Map();
  if (!res.ok) return map;
  const results = await res.json();
  for (const r of results) {
    if (r.signedURL) map.set(r.path, `${SUPABASE_URL}/storage/v1${r.signedURL}`);
  }
  return map;
}
__name(createSignedImageUrls, "createSignedImageUrls");
__name2(createSignedImageUrls, "createSignedImageUrls");
async function onRequestGet({ params }) {
  const sectionId = String(params.sectionId || "").trim();
  if (!sectionId) {
    return Response.json({ words: [] }, { status: 400 });
  }
  let words = [];
  try {
    words = await fetchWordsForSection(sectionId);
  } catch {
    return Response.json({ words: [] }, { status: 502 });
  }
  return Response.json({ words }, {
    headers: { "Cache-Control": "public, max-age=60" }
  });
}
__name(onRequestGet, "onRequestGet");
__name2(onRequestGet, "onRequestGet");
var ALLOWED_TYPES = /* @__PURE__ */ new Set(["bug", "translation", "feature", "other"]);
var ALLOWED_PLATFORMS = /* @__PURE__ */ new Set(["android", "ios", "macos", "windows", "web"]);
var MAX_FIELD_LENGTH = 4e3;
function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse, "jsonResponse");
__name2(jsonResponse, "jsonResponse");
async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }
  if (typeof payload.company === "string" && payload.company.trim() !== "") {
    return jsonResponse({ ok: true }, 200);
  }
  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const version = typeof payload.version === "string" ? payload.version.trim() : "";
  const type = ALLOWED_TYPES.has(payload.type) ? payload.type : "other";
  const platform = ALLOWED_PLATFORMS.has(payload.platform) ? payload.platform : "web";
  if (!description) {
    return jsonResponse({ error: "Description is required." }, 400);
  }
  if (description.length > MAX_FIELD_LENGTH || email.length > 320 || version.length > 100) {
    return jsonResponse({ error: "One or more fields are too long." }, 400);
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: "Invalid email address." }, 400);
  }
  if (!env.REPORTS) {
    return jsonResponse({ error: "Report storage is not configured." }, 500);
  }
  const id = crypto.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const record = {
    id,
    type,
    platform,
    email: email || null,
    version: version || null,
    description,
    createdAt: now,
    userAgent: request.headers.get("User-Agent") || null,
    country: request.cf?.country || null
  };
  await env.REPORTS.put(`report:${now}:${id}`, JSON.stringify(record));
  return jsonResponse({ ok: true, id }, 200);
}
__name(onRequestPost, "onRequestPost");
__name2(onRequestPost, "onRequestPost");
async function onRequestGet2() {
  return jsonResponse({ error: "Method not allowed." }, 405);
}
__name(onRequestGet2, "onRequestGet2");
__name2(onRequestGet2, "onRequestGet");
function pageShell({ title, description, ogUrl, bodyHtml, includeScript }) {
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
    --bg: #121316; --bg-elevated: #1c1d22; --bg-row: #202127; --border: rgba(255,255,255,0.10);
    --text: #f0f0ec; --text-muted: #a8a79e; --text-faint: #7c7a70;
    --accent: #378add; --accent-dim: #185fa5; --accent-soft: #1b3349;
    --radius-lg: 22px; --radius-md: 14px; --radius-sm: 8px;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
    display: flex; justify-content: center; padding: 24px 16px 48px;
  }
  .card {
    width: 100%; max-width: 560px; background: var(--bg-elevated); border: 1px solid var(--border);
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

  /* Sections accordion */
  .sections { margin-top: 24px; text-align: left; }
  .sections-title {
    display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700;
    color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 10px;
  }
  .sections-title img { width: 16px; height: 16px; }
  .section {
    border: 1px solid var(--border); border-radius: var(--radius-md); margin-bottom: 8px;
    background: var(--bg-row); overflow: hidden;
  }
  .section-head {
    display: flex; align-items: center; gap: 10px; width: 100%; padding: 13px 14px;
    background: none; border: none; color: var(--text); font-size: 15px; font-weight: 600;
    text-align: left; cursor: pointer; font-family: inherit;
  }
  .section-head img.book { width: 18px; height: 18px; flex-shrink: 0; }
  .section-head .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .section-head .count { color: var(--text-muted); font-size: 12px; font-weight: 500; flex-shrink: 0; }
  .chevron { width: 14px; height: 14px; flex-shrink: 0; transition: transform 0.2s ease; color: var(--text-faint); }
  .section.open .chevron { transform: rotate(90deg); }
  .section-body { display: none; border-top: 1px solid var(--border); }
  .section.open .section-body { display: block; }
  .word-row {
    display: flex; align-items: center; gap: 10px; padding: 10px 14px;
    border-bottom: 1px solid var(--border);
  }
  .word-row:last-child { border-bottom: none; }
  .word-thumb { width: 32px; height: 32px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: var(--bg-elevated); }
  .word-text { flex: 1; min-width: 0; display: flex; justify-content: space-between; gap: 10px; }
  .word-original { font-weight: 600; font-size: 14px; }
  .word-translation { color: var(--text-muted); font-size: 14px; text-align: right; }
  .section-state { padding: 16px 14px; color: var(--text-faint); font-size: 13px; }

  @media (min-width: 640px) {
    .card { padding: 40px 44px; }
    .stores { flex-direction: row; }
    .btn { flex: 1; }
  }
</style>
</head>
<body>
${bodyHtml}
${includeScript ? `<script>${ACCORDION_SCRIPT}<\/script>` : ""}
</body>
</html>`;
}
__name(pageShell, "pageShell");
__name2(pageShell, "pageShell");
var ACCORDION_SCRIPT = `
(function () {
  var cache = {};
  document.querySelectorAll(".section-head").forEach(function (head) {
    head.addEventListener("click", function () {
      var section = head.closest(".section");
      var id = section.getAttribute("data-id");
      var isOpen = section.classList.contains("open");
      document.querySelectorAll(".section.open").forEach(function (other) {
        if (other !== section) other.classList.remove("open");
      });
      section.classList.toggle("open", !isOpen);
      if (isOpen || cache[id]) return;

      var body = section.querySelector(".section-body");
      body.innerHTML = '<div class="section-state">Loading\u2026</div>';
      fetch("/api/community/" + window.__shortId + "/sections/" + id)
        .then(function (r) { if (!r.ok) throw new Error("bad response"); return r.json(); })
        .then(function (data) {
          cache[id] = true;
          if (!data.words || data.words.length === 0) {
            body.innerHTML = '<div class="section-state">No words in this section.</div>';
            return;
          }
          body.innerHTML = data.words.map(function (w) {
            var img = w.imageUrl
              ? '<img class="word-thumb" src="' + w.imageUrl + '" alt="">'
              : "";
            return '<div class="word-row">' + img +
              '<div class="word-text"><span class="word-original">' + escapeHtml(w.original) +
              '</span><span class="word-translation">' + escapeHtml(w.translation) + '</span></div></div>';
          }).join("");
        })
        .catch(function () {
          delete cache[id];
          body.innerHTML = '<div class="section-state">Couldn\\'t load this section.</div>';
        });
    });
  });

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
`;
function chevronSvg() {
  return `<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>`;
}
__name(chevronSvg, "chevronSvg");
__name2(chevronSvg, "chevronSvg");
function storesHtml() {
  return `
    <div class="stores">
      <a class="btn btn-primary" href="${PLAY_STORE_URL}">Get it on Google Play</a>
      <a class="btn btn-secondary" href="${APP_STORE_URL}">Download on the App Store</a>
    </div>`;
}
__name(storesHtml, "storesHtml");
__name2(storesHtml, "storesHtml");
function notFoundPage(shortId, url) {
  const html = pageShell({
    title: "Deck not found \u2014 Atom Translate",
    description: "This deck link is no longer available.",
    ogUrl: url,
    bodyHtml: `
    <div class="card">
      <h1>This deck link is no longer available</h1>
      <p class="meta">The folder for "${escapeHtml(shortId)}" is private or doesn't exist.</p>
      ${storesHtml()}
    </div>`,
    includeScript: false
  });
  return new Response(html, { status: 404, headers: { "Content-Type": "text/html; charset=UTF-8" } });
}
__name(notFoundPage, "notFoundPage");
__name2(notFoundPage, "notFoundPage");
async function onRequestGet3({ params, request }) {
  const shortId = String(params.id || "").trim();
  const url = request.url;
  if (!shortId) return notFoundPage(shortId, url);
  let folder;
  try {
    folder = await fetchFolderByShortId(shortId);
  } catch {
    folder = void 0;
  }
  if (!folder) return notFoundPage(shortId, url);
  let sections = [];
  try {
    sections = await fetchSectionsWithCounts(folder.id);
  } catch {
    sections = [];
  }
  const authorName = folder.author_name || "";
  const initial = authorName ? authorName[0].toUpperCase() : "?";
  const description = `${wordCountLabel(folder.word_count)} \xB7 ${folder.section_count} section${folder.section_count === 1 ? "" : "s"}${authorName ? ` \xB7 by ${authorName}` : ""}`;
  const badges = [folder.language, folder.category, folder.level].filter(Boolean);
  const sectionsHtml = sections.length ? `
    <div class="sections">
      <div class="sections-title"><img src="/assets/books.png" alt="">Sections</div>
      ${sections.map((s) => `
        <div class="section" data-id="${escapeHtml(s.id)}">
          <button class="section-head" type="button">
            <img class="book" src="/assets/books.png" alt="">
            <span class="name">${escapeHtml(s.name)}</span>
            <span class="count">${escapeHtml(wordCountLabel(s.wordCount))}</span>
            ${chevronSvg()}
          </button>
          <div class="section-body"></div>
        </div>`).join("")}
    </div>` : "";
  const html = pageShell({
    title: `${folder.name} \u2014 Atom Translate`,
    description,
    ogUrl: url,
    includeScript: sections.length > 0,
    bodyHtml: `
    <div class="card">
      <div class="avatar">${escapeHtml(initial)}</div>
      <h1>${escapeHtml(folder.name)}</h1>
      <p class="meta">${authorName ? `by ${escapeHtml(authorName)} \xB7 ` : ""}${escapeHtml(wordCountLabel(folder.word_count))}</p>
      ${badges.length ? `<div class="badges">${badges.map((b) => `<span class="badge">${escapeHtml(b)}</span>`).join("")}</div>` : ""}
      ${storesHtml()}
      <p class="hint">Already have Atom Translate? Opening this link on your phone opens the deck directly.</p>
      ${sectionsHtml}
    </div>
    <script>window.__shortId = ${JSON.stringify(folder.short_id)};<\/script>`
  });
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=UTF-8" } });
}
__name(onRequestGet3, "onRequestGet3");
__name2(onRequestGet3, "onRequestGet");
var CANONICAL_HOST = "atomtranslate.com";
var REDIRECT_HOSTS = /* @__PURE__ */ new Set([
  "atomtranslate.valentineos.pp.ua",
  "www.atomtranslate.com"
]);
async function onRequest(context) {
  const url = new URL(context.request.url);
  if (REDIRECT_HOSTS.has(url.hostname)) {
    url.protocol = "https:";
    url.hostname = CANONICAL_HOST;
    url.port = "";
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
__name(onRequest, "onRequest");
__name2(onRequest, "onRequest");
var routes = [
  {
    routePath: "/api/community/:shortId/sections/:sectionId",
    mountPath: "/api/community/:shortId/sections",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/report",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/report",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/community/:id",
    mountPath: "/community",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/",
    mountPath: "/",
    method: "",
    middlewares: [onRequest],
    modules: []
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name2(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-qOyxVm/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-qOyxVm/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.908720694739624.js.map
