// GET /decks — the public deck catalog: search, filters (language pair, level, category,
// textbook, grade) and pagination, all server-rendered with plain <a> links and a GET <form>, so
// a crawler can walk from here to every deck. Ukrainian, like most public decks' audience.
//
// Search and ranking are public.search_public_folders (cloud migration 0029) — the same function
// the app and the web app search with. Filter options come from public_folder_facets, so a select
// only offers values some deck actually has.
//
// Indexing: the plain list (and its further pages) is indexable with a self-canonical; any search
// or filter makes the page noindex,follow — the decks it links to are what should rank, not every
// combination of filters.

import { SITE_ORIGIN, escapeHtml, searchDecks, fetchDeckFacets } from "../_lib/community.js";
import { strings, fmt, countLabel, languageName, categoryName, gradeLabel, wordsPhrase, deckLang } from "../_lib/deck-i18n.js";
import { deckSlug } from "../_lib/slug.js";
import { documentShell, headerHtml, footerHtml, pageHeaders, deckPath } from "../_lib/deck-page.js";
import { cacheKeyFor, fromCache, toCache, messageResponse, headFrom } from "../_lib/deck-route.js";

const LANG = "uk";
const PAGE_SIZE = 24;
const MIN_WORDS = 1;
const FILTERS = ["language", "native", "level", "category", "textbook", "grade"];

function readQuery(url) {
  const get = (name, max) => String(url.searchParams.get(name) || "").trim().slice(0, max);
  const page = Math.max(1, Math.min(500, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
  return {
    q: get("q", 100),
    language: get("language", 64),
    native: get("native", 64),
    level: get("level", 16),
    category: get("category", 64),
    textbook: get("textbook", 120),
    grade: get("grade", 20),
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
    <div class="field">
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

function deckCardHtml(folder, s) {
  const lang = deckLang(folder);
  const href = `${SITE_ORIGIN}${deckPath(folder.short_id, deckSlug(folder, lang))}`;
  const pair = [languageName(LANG, folder.language), languageName(LANG, folder.native_language)].filter(Boolean).join(" → ");
  const book = [folder.textbook, gradeLabel(LANG, folder.grade), folder.unit].filter((v) => v && String(v).trim()).join(" · ");
  const chips = [pair, folder.level, categoryName(LANG, folder.category)].filter(Boolean);
  const count = Number(folder.word_count) || 0;
  return `
      <li class="deck-card">
        <a href="${escapeHtml(href)}">
          <h2 class="deck-card__name">${escapeHtml(folder.name)}</h2>
          <span class="deck-card__count">${escapeHtml(wordsPhrase(LANG, count, folder.language))}</span>
          ${book ? `<span class="deck-card__book">${escapeHtml(book)}</span>` : ""}
          ${folder.description ? `<span class="deck-card__desc">${escapeHtml(String(folder.description).trim().slice(0, 140))}</span>` : ""}
          ${chips.length ? `<span class="deck-card__chips">${chips.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join("")}</span>` : ""}
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
        textbook: state.textbook,
        grade: state.grade,
        minWords: MIN_WORDS,
        limit: PAGE_SIZE,
        offset: (state.page - 1) * PAGE_SIZE,
      }),
      fetchDeckFacets(MIN_WORDS),
    ]);
  } catch {
    return messageResponse("unavailable", url, LANG);
  }

  const filtered = Boolean(state.q) || FILTERS.some((name) => state[name]);
  const canonical = `${SITE_ORIGIN}/decks${state.page > 1 && !filtered ? `?page=${state.page}` : ""}`;
  const title = `${s.catalogTitle}${state.page > 1 ? ` — ${fmt(s.page, state.page)}` : ""} | Atom Translate`;

  const form = `
  <form class="filters" method="get" action="/decks" role="search">
    <div class="field field--search">
      <label for="f-q">${escapeHtml(s.search)}</label>
      <input id="f-q" name="q" type="search" value="${escapeHtml(state.q)}" placeholder="${escapeHtml(s.searchPlaceholder)}" maxlength="100" autocomplete="off">
    </div>
    ${selectHtml("language", s.filterLanguage, state.language, facetOptions(facets, "language", (v) => languageName(LANG, v)), s)}
    ${selectHtml("native", s.filterNative, state.native, facetOptions(facets, "native_language", (v) => languageName(LANG, v)), s)}
    ${selectHtml("level", s.filterLevel, state.level, facetOptions(facets, "level", (v) => v), s)}
    ${selectHtml("category", s.filterCategory, state.category, facetOptions(facets, "category", (v) => categoryName(LANG, v)), s)}
    ${selectHtml("textbook", s.filterTextbook, state.textbook, facetOptions(facets, "textbook", (v) => v), s)}
    ${selectHtml("grade", s.filterGrade, state.grade, facetOptions(facets, "grade", (v) => gradeLabel(LANG, v)), s)}
    <div class="filters__actions">
      <button class="btn btn--primary" type="submit">${escapeHtml(s.apply)}</button>
      ${filtered ? `<a class="btn btn--secondary" href="/decks">${escapeHtml(s.reset)}</a>` : ""}
    </div>
  </form>`;

  const list = result.rows.length
    ? `<p class="found" role="status">${escapeHtml(countLabel(LANG, result.total, s.found))}</p>
  <ul class="deck-list">${result.rows.map((f) => deckCardHtml(f, s)).join("")}
  </ul>
  ${paginationHtml(state, result.total, s)}`
    : `<p class="found" role="status">${escapeHtml(s.noResults)}</p>`;

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
${headerHtml(s, { homeHref: `${SITE_ORIGIN}/uk/` })}
<main class="page page--wide">
  <section class="catalog-head">
    <h1>${escapeHtml(s.catalogH1)}</h1>
    <p class="hero__desc">${escapeHtml(s.catalogIntro)}</p>
  </section>
  ${form}
  ${list}
</main>
${footerHtml(s, LANG)}`,
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
