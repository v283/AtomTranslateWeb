// GET /decks — the public deck catalog: search, filters (language pair, level, category) and
// pagination, all server-rendered with plain <a> links and a GET <form>, so
// a crawler can walk from here to every deck. Ukrainian, like most public decks' audience.
//
// Search and ranking are public.search_public_folders (cloud migration 0029) — the same function
// the app and the web app search with. Filter options come from public_folder_facets, so a select
// only offers values some deck actually has.
//
// Indexing: the plain list (and its further pages) is indexable with a self-canonical; any search
// or filter makes the page noindex,follow — the decks it links to are what should rank, not every
// combination of filters.

import { SITE_ORIGIN, escapeHtml, breakableHtml, searchDecks, fetchDeckFacets } from "../_lib/community.js";
import { strings, fmt, plural, countLabel, languageName, categoryName, wordsPhrase, deckLang } from "../_lib/deck-i18n.js";
import { deckSlug } from "../_lib/slug.js";
import { documentShell, headerHtml, footerHtml, pageHeaders, deckPath, truncate, ICONS } from "../_lib/deck-page.js";
import { cacheKeyFor, fromCache, toCache, messageResponse, headFrom } from "../_lib/deck-route.js";

const LANG = "uk";
const PAGE_SIZE = 24;
const MIN_WORDS = 1;
const FILTERS = ["language", "native", "level", "category"];

// Filter options are the same for every search, filter and page: cached once at the edge for ten
// minutes rather than read again for each new combination the catalog renders.
const FACETS_TTL = 600;

async function cachedFacets(context, url) {
  // A path no route serves, so the entry can never be mistaken for a page.
  const key = new Request(`${url.origin}/__cache/deck-facets?min=${MIN_WORDS}`, { method: "GET" });
  const hit = await fromCache(key);
  if (hit) {
    try {
      return await hit.json();
    } catch {
      // A damaged entry: read the facets again below.
    }
  }
  const facets = await fetchDeckFacets(MIN_WORDS);
  if (facets.length) {
    toCache(context, key, Response.json(facets, { headers: { "Cache-Control": `public, max-age=${FACETS_TTL}, s-maxage=${FACETS_TTL}` } }));
  }
  return facets;
}

function readQuery(url) {
  const get = (name, max) => String(url.searchParams.get(name) || "").trim().slice(0, max);
  const page = Math.max(1, Math.min(500, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
  return {
    q: get("q", 100),
    language: get("language", 64),
    native: get("native", 64),
    level: get("level", 16),
    category: get("category", 64),
    page,
  };
}

/** The query string for a state, keys in a fixed order (also the cache key). */
function queryString(state, overrides = {}) {
  const merged = { ...state, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  for (const name of FILTERS) if (merged[name]) params.set(name, merged[name]);
  if (merged.page > 1) params.set("page", String(merged.page));
  const text = params.toString();
  return text ? `?${text}` : "";
}

function selectHtml(name, label, current, options, s) {
  const id = `f-${name}`;
  const known = options.some((o) => o.value === current);
  const all = known || !current ? options : [{ value: current, label: current }, ...options];
  return `
    <div class="field${current ? " is-set" : ""}">
      <label for="${id}">${escapeHtml(label)}</label>
      <select id="${id}" name="${name}">
        <option value="">${escapeHtml(s.filterAny)}</option>
        ${all.map((o) => `<option value="${escapeHtml(o.value)}"${o.value === current ? " selected" : ""}>${escapeHtml(o.label)}</option>`).join("")}
      </select>
    </div>`;
}

function facetOptions(facets, kind, labelFor) {
  return facets
    .filter((f) => f.kind === kind)
    .map((f) => ({ value: f.value, label: `${labelFor(f.value)} (${f.decks})` }));
}

// A deck as the app's library shows a folder: the folder pictogram on an AccentLight tile, name,
// word and section count; then a two-line description, the pills (pinned to the bottom so a row
// of cards lines up) and the author.
function deckCardHtml(folder, s) {
  const lang = deckLang(folder);
  const href = `${SITE_ORIGIN}${deckPath(folder.short_id, deckSlug(folder, lang))}`;
  const pair = [languageName(LANG, folder.language), languageName(LANG, folder.native_language)].filter(Boolean).join(" → ");
  const chips = [
    { text: pair, kind: "language" },
    { text: folder.level, kind: "level" },
    { text: categoryName(LANG, folder.category), kind: "category" },
  ].filter((c) => c.text);
  const count = Number(folder.word_count) || 0;
  const sections = Number(folder.section_count) || 0;
  const meta = [wordsPhrase(LANG, count, folder.language)];
  if (sections > 1) meta.push(`${sections} ${plural(LANG, sections, s.sections)}`);
  const description = folder.description ? truncate(folder.description, 160) : "";
  const author = String(folder.author_name || "").trim();
  return `
      <li class="deck-card">
        <a href="${escapeHtml(href)}">
          <span class="deck-card__head">
            <span class="deck-card__icon"><img src="/assets/icons/open_file_folder.png" width="30" height="30" alt="" loading="lazy"></span>
            <span class="deck-card__title">
              <h2 class="deck-card__name">${breakableHtml(folder.name)}</h2>
              <span class="deck-card__count">${escapeHtml(meta.join(" · "))}</span>
            </span>
          </span>
          ${description ? `<span class="deck-card__desc">${escapeHtml(description)}</span>` : ""}
          ${chips.length ? `<span class="deck-card__chips">${chips.map((c) => `<span class="chip chip--${c.kind}">${escapeHtml(c.text)}</span>`).join("")}</span>` : ""}
          ${author ? `<span class="deck-card__author"><span class="deck-card__avatar" aria-hidden="true">${escapeHtml(Array.from(author)[0].toUpperCase())}</span><span><span class="sr-only">${escapeHtml(s.by)}: </span>${escapeHtml(author)}</span></span>` : ""}
        </a>
      </li>`;
}

function paginationHtml(state, total, s) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return "";
  const link = (page, label, rel) =>
    `<a href="/decks${escapeHtml(queryString(state, { page }))}"${rel ? ` rel="${rel}"` : ""}>${escapeHtml(label)}</a>`;
  const items = [];
  if (state.page > 1) items.push(link(state.page - 1, s.prev, "prev"));
  const from = Math.max(1, state.page - 2);
  const to = Math.min(pages, state.page + 2);
  for (let p = from; p <= to; p++) {
    items.push(p === state.page
      ? `<span aria-current="page">${p}</span>`
      : link(p, String(p)));
  }
  if (state.page < pages) items.push(link(state.page + 1, s.next, "next"));
  return `<nav class="pager" aria-label="${escapeHtml(s.pagination)}">${items.join("")}</nav>`;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const state = readQuery(url);
  const s = strings(LANG);

  // Normalised query as the cache key: unknown params and their order don't fan the cache out.
  const key = cacheKeyFor(url, queryString(state));
  const cached = await fromCache(key);
  if (cached) return cached;

  let result;
  let facets;
  try {
    [result, facets] = await Promise.all([
      searchDecks({
        search: state.q,
        language: state.language,
        nativeLanguage: state.native,
        category: state.category,
        level: state.level,
        minWords: MIN_WORDS,
        limit: PAGE_SIZE,
        offset: (state.page - 1) * PAGE_SIZE,
      }),
      cachedFacets(context, url),
    ]);
  } catch {
    return messageResponse("unavailable", url, LANG);
  }

  // A page number past the end is not an empty page but no page at all: 404, not a soft-404 200.
  if (state.page > 1 && result.rows.length === 0) return messageResponse("notFound", url, LANG);

  const filtered = Boolean(state.q) || FILTERS.some((name) => state[name]);
  const canonical = `${SITE_ORIGIN}/decks${state.page > 1 && !filtered ? `?page=${state.page}` : ""}`;
  const title = `${s.catalogTitle}${state.page > 1 ? ` — ${fmt(s.page, state.page)}` : ""} | Atom Translate`;

  // One search row (query + button), then the four filters in a row. deck.js submits the form
  // as soon as a filter changes; the button is there for the query and for no-JS visitors.
  const form = `
  <form class="filters" method="get" action="/decks" role="search">
    <div class="filters__search">
      <label class="sr-only" for="f-q">${escapeHtml(s.search)}</label>
      <span class="filters__search-box">
        ${ICONS.search}
        <input id="f-q" name="q" type="search" value="${escapeHtml(state.q)}" placeholder="${escapeHtml(s.searchPlaceholder)}" maxlength="100" autocomplete="off" enterkeyhint="search">
      </span>
      <button class="btn btn--primary filters__submit" type="submit">${escapeHtml(s.searchButton)}</button>
    </div>
    <div class="filters__grid">
      ${selectHtml("language", s.filterLanguage, state.language, facetOptions(facets, "language", (v) => languageName(LANG, v)), s)}
      ${selectHtml("native", s.filterNative, state.native, facetOptions(facets, "native_language", (v) => languageName(LANG, v)), s)}
      ${selectHtml("level", s.filterLevel, state.level, facetOptions(facets, "level", (v) => v), s)}
      ${selectHtml("category", s.filterCategory, state.category, facetOptions(facets, "category", (v) => categoryName(LANG, v)), s)}
    </div>
  </form>`;

  const resetLink = filtered ? `<a class="results__reset" href="/decks">${escapeHtml(s.reset)}</a>` : "";
  const list = result.rows.length
    ? `<div class="results__bar"><p class="found" role="status">${escapeHtml(countLabel(LANG, result.total, s.found))}</p>${resetLink}</div>
  <ul class="deck-list">${result.rows.map((f) => deckCardHtml(f, s)).join("")}
  </ul>
  ${paginationHtml(state, result.total, s)}`
    : `<div class="empty"><img src="/assets/icons/open_file_folder.png" width="48" height="48" alt=""><p class="found" role="status">${escapeHtml(s.noResults)}</p>${resetLink}</div>`;

  const html = documentShell({
    lang: LANG,
    title,
    description: s.catalogDescription,
    robots: filtered ? "noindex,follow" : "index,follow",
    canonical,
    ogUrl: canonical,
    jsonLd: filtered ? null : {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: s.catalogTitle,
      description: s.catalogDescription,
      url: canonical,
      inLanguage: LANG,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: result.total,
        itemListElement: result.rows.map((f, i) => ({
          "@type": "ListItem",
          position: (state.page - 1) * PAGE_SIZE + i + 1,
          url: `${SITE_ORIGIN}${deckPath(f.short_id, deckSlug(f, deckLang(f)))}`,
          name: f.name,
        })),
      },
    },
    bodyHtml: `
${headerHtml(s, { homeHref: `${SITE_ORIGIN}/uk/`, wide: true })}
<main class="page page--wide">
  <section class="catalog-head">
    <h1>${escapeHtml(s.catalogH1)}</h1>
    <p class="catalog-head__intro">${escapeHtml(s.catalogIntro)}</p>
  </section>
  ${form}
  ${list}
</main>
${footerHtml(s, LANG, { wide: true })}`,
  });

  const response = new Response(html, {
    status: 200,
    headers: await pageHeaders({ "Cache-Control": "public, max-age=300, s-maxage=600" }),
  });
  toCache(context, key, response);
  return response;
}

export function onRequestHead(context) {
  return headFrom(onRequestGet, context);
}
