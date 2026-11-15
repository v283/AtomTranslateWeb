// Canonical-host redirect. The site moved from atomtranslate.valentineos.pp.ua
// to atomtranslate.com; the old hostname stays attached to this Pages project so
// existing links and search results keep working via a permanent redirect.
// *.pages.dev is deliberately left alone so preview deployments stay reachable.

import { fetchLatestVideos, renderVideoCards } from "./_lib/videos.js";

const CANONICAL_HOST ="atomtranslate.com";
const REDIRECT_HOSTS = new Set([
  "atomtranslate.valentineos.pp.ua",
  "www.atomtranslate.com",
]);

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (REDIRECT_HOSTS.has(url.hostname)) {
    url.protocol = "https:";
    url.hostname = CANONICAL_HOST;
    url.port = "";
    return Response.redirect(url.toString(), 301);
  }

  if (VIDEO_PAGES.has(url.pathname) && context.request.method === "GET") {
    return withVideoFeed(context);
  }

  return context.next();
}

// Pages whose #video-feed placeholder gets the latest YouTube Shorts filled in server-side.
const VIDEO_PAGES = new Set(["/uk/", "/uk/index.html"]);

async function withVideoFeed(context) {
  // Drop conditional headers: a 304 for the static file would let the browser keep a copy
  // with an older video list, since the file's ETag doesn't change when the feed does.
  const headers = new Headers(context.request.headers);
  headers.delete("If-None-Match");
  headers.delete("If-Modified-Since");
  const [response, videos] = await Promise.all([
    context.next(new Request(context.request, { headers })),
    fetchLatestVideos(),
  ]);

  const isHtml = (response.headers.get("Content-Type") || "").includes("text/html");
  if (response.status !== 200 || !isHtml || videos.length === 0) return response;

  const rewritten = new HTMLRewriter()
    .on("#video-feed", {
      element(el) {
        el.setInnerContent(renderVideoCards(videos), { html: true });
      },
    })
    .transform(response);

  const out = new Response(rewritten.body, rewritten);
  out.headers.delete("ETag");
  out.headers.delete("Last-Modified");
  out.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  // _headers is not guaranteed to apply to Function-modified responses, so the page's security
  // headers are set here too. Keep in sync with the /* block in _headers.
  for (const [name, value] of Object.entries(VIDEO_PAGE_SECURITY_HEADERS)) out.headers.set(name, value);
  return out;
}

const VIDEO_PAGE_SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://i.ytimg.com; connect-src 'self' https://cloudflareinsights.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};
