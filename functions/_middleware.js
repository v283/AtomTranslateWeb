// Canonical-host redirect. The site moved from atomtranslate.valentineos.pp.ua
// to atomtranslate.com; the old hostname stays attached to this Pages project so
// existing links and search results keep working via a permanent redirect.
// *.pages.dev is deliberately left alone so preview deployments stay reachable.

const CANONICAL_HOST = "atomtranslate.com";
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

  return context.next();
}
