// Which public decks and sections search engines should index. Every public deck still opens for
// people; these rules only decide `robots` and the sitemap.
//
// Thin or junk pages hurt the whole site in search, so a page is indexed only when it has at least
// MIN_INDEXABLE_WORDS words and a meaningful name. Moderation (obscene words) is a different
// question and happens server-side: a rejected deck is not public at all.

/** Below this many words a deck or section page is noindex (thin content) and stays out of the sitemap. */
export const MIN_INDEXABLE_WORDS = 10;

// Names that say nothing about the words: test decks, keyboard runs, placeholders. Compared after
// lower-casing and dropping everything but letters, so "Test 1", "test_2" and "ТЕСТ!" all match.
const JUNK_NAMES = new Set([
  "test", "tests", "testing", "tst", "testdeck", "testfolder", "testsection",
  "тест", "тести", "тестова", "тестовий", "тестування", "тестик",
  "asd", "asdf", "asdfg", "qwe", "qwer", "qwerty", "йцу", "йцук", "йцукен", "фыва",
  "sample", "example", "demo", "draft", "untitled", "newfolder", "newsection", "folder", "section",
  "новапапка", "новасекція", "безназви", "папка", "секція", "чернетка",
  "xxx", "aaa", "zzz", "abc", "xyz", "lol",
]);

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/**
 * A name too short or too generic to tell anyone what the deck is about: fewer than 3 letters
 * (2 for Chinese, Japanese and Korean, where one or two characters are a whole word), or a known
 * test/placeholder name.
 */
export function isJunkName(name) {
  const letters = String(name ?? "").toLowerCase().replace(/[^\p{L}]+/gu, "");
  const minLetters = CJK.test(letters) ? 2 : 3;
  return letters.length < minLetters || JUNK_NAMES.has(letters);
}

/**
 * A deck page is indexed when it has enough words, a meaningful name, and at most half of its
 * sections carry junk names (a deck of "v", "fg", "test1" sections is a test deck whatever it is
 * called).
 */
export function isIndexableDeck({ name, wordCount, sectionNames = [] }) {
  if ((Number(wordCount) || 0) < MIN_INDEXABLE_WORDS || isJunkName(name)) return false;
  const named = sectionNames.filter((n) => String(n ?? "").trim() !== "");
  const junk = named.filter(isJunkName).length;
  return junk * 2 <= named.length;
}

/** A section page is indexed only inside an indexable deck, with enough words and a meaningful name. */
export function isIndexableSection({ deckIndexable, name, wordCount }) {
  return Boolean(deckIndexable) && (Number(wordCount) || 0) >= MIN_INDEXABLE_WORDS && !isJunkName(name);
}
