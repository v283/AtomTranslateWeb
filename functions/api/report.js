// POST /api/report — stores bug/feedback reports from report.html into the
// REPORTS KV namespace (binding configured in wrangler.toml). No third-party
// form service is used, so nothing leaves the Cloudflare account.

const ALLOWED_TYPES = new Set(["bug", "translation", "feature", "other"]);
const ALLOWED_PLATFORMS = new Set(["android", "ios", "macos", "windows", "web"]);
const MAX_FIELD_LENGTH = 4000;

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  // Honeypot: bots that fill hidden fields are silently accepted and dropped.
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
  const now = new Date().toISOString();
  const record = {
    id,
    type,
    platform,
    email: email || null,
    version: version || null,
    description,
    createdAt: now,
    userAgent: request.headers.get("User-Agent") || null,
    country: request.cf?.country || null,
  };

  await env.REPORTS.put(`report:${now}:${id}`, JSON.stringify(record));

  return jsonResponse({ ok: true, id }, 200);
}

export async function onRequestGet() {
  return jsonResponse({ error: "Method not allowed." }, 405);
}
