// URL slugs for /decks/{CODE}/{slug}. No onRequest* export: a plain module, not a route.
//
// Ukrainian → Latin follows the official KMU 2010 table (the one on passports and road signs):
// є/ї/й/ю/я become ye/yi/y/yu/ya at the start of a word and ie/i/i/iu/ia elsewhere, "зг" → "zgh",
// and the soft sign and apostrophes disappear. Russian-only letters get their usual equivalents,
// so a deck named in Russian still gets a readable slug. Anything else that is not [a-z0-9]
// (Chinese, Arabic, emoji…) is dropped; if nothing readable is left the slug is "words".
//
// The slug is decorative: the deck is found by its CODE alone, and a stale or hand-edited slug
// 301s to the current one (functions/decks/[code]/[[slug]].js). Keep this deterministic — the
// same deck must always produce the same slug, or every render would redirect.

const UK_START = { "є": "ye", "ї": "yi", "й": "y", "ю": "yu", "я": "ya" };

const UK = {
  "а": "a", "б": "b", "в": "v", "г": "h", "ґ": "g", "д": "d", "е": "e", "є": "ie", "ж": "zh",
  "з": "z", "и": "y", "і": "i", "ї": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n",
  "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts",
  "ч": "ch", "ш": "sh", "щ": "shch", "ь": "", "ю": "iu", "я": "ia",
  // Russian-only
  "ё": "e", "ъ": "", "ы": "y", "э": "e",
  // apostrophes inside words (м'ясо, бур’ян)
  "'": "", "’": "", "ʼ": "", "`": "",
};

const MAX_SLUG_LENGTH = 80;

// Built from code points so no invisible combining characters sit in this source file.
const fromCodes = (...codes) => String.fromCharCode(...codes);
const SPLIT_SHORT_I = new RegExp(fromCodes(0x438, 0x306), "g"); // и + breve
const SPLIT_YI = new RegExp(fromCodes(0x456, 0x308), "g");      // і + diaeresis
const SPLIT_YO = new RegExp(fromCodes(0x435, 0x308), "g");      // е + diaeresis
const COMBINING_MARKS = new RegExp(`[${fromCodes(0x300)}-${fromCodes(0x36f)}]`, "g");

export function transliterate(text) {
  const lower = String(text ?? "").toLowerCase().normalize("NFKD")
    // NFKD splits "й"/"ї"/"ё" into base + combining mark; put them back first, then drop the
    // remaining marks (Latin accents: é → e).
    .replace(SPLIT_SHORT_I, "й").replace(SPLIT_YI, "ї").replace(SPLIT_YO, "ё")
    .replace(COMBINING_MARKS, "");
  let out = "";
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    const prev = i > 0 ? lower[i - 1] : "";
    const atWordStart = i === 0 || !/[\p{L}'’ʼ`]/u.test(prev);
    if (ch === "г" && prev === "з") { out += "gh"; continue; }
    if (atWordStart && UK_START[ch]) { out += UK_START[ch]; continue; }
    if (ch in UK) { out += UK[ch]; continue; }
    out += ch;
  }
  return out;
}

export function slugify(...parts) {
  const text = parts.filter((p) => p !== null && p !== undefined && String(p).trim() !== "").join(" ");
  let slug = transliterate(text).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (slug.length > MAX_SLUG_LENGTH) {
    slug = slug.slice(0, MAX_SLUG_LENGTH);
    const cut = slug.lastIndexOf("-");
    if (cut > MAX_SLUG_LENGTH / 2) slug = slug.slice(0, cut);
    slug = slug.replace(/-+$/g, "");
  }
  return slug || "words";
}

// The grade is stored free-form ("7", "7 клас", "Grade 7"); a bare number reads better in a
// slug with the word added: "7-klas".
function gradePart(grade, lang) {
  const value = String(grade ?? "").trim();
  if (!value) return "";
  if (/^\d{1,2}$/.test(value)) return lang === "uk" ? `${value} клас` : `grade ${value}`;
  return value;
}

/** Slug of a deck row: name + textbook + grade + unit, in that order, without repeats. */
export function deckSlug(folder, lang) {
  const parts = [folder.name, folder.textbook, gradePart(folder.grade, lang), folder.unit];
  // Drop a part that the name already contains ("Karpiuk 7 Unit 3" + textbook "Karpiuk").
  const name = transliterate(folder.name);
  const unique = parts.filter((part, i) => i === 0 || !part || !name.includes(transliterate(part).trim()));
  return slugify(...unique);
}

// Section pages: /decks/{CODE}/{deck-slug}/{section-slug}-{first 6 hex of the section id}. The id
// part keeps the URL stable and unique (two sections may share a name) and is what the page is
// looked up by; the readable part follows renames via a 301.
export const SECTION_ID_PART = 6;

export function sectionSlug(section) {
  const id = String(section.id || "").replace(/-/g, "").slice(0, SECTION_ID_PART).toLowerCase();
  return `${slugify(section.name).slice(0, 60).replace(/-+$/, "")}-${id}`;
}

/** The id prefix at the end of a section slug, or null. */
export function sectionIdPart(slug) {
  const match = /-([0-9a-f]{6})$/.exec(String(slug || "").toLowerCase());
  return match ? match[1] : null;
}
