// Wording for the deck pages (/decks/…, /community/…) and the /decks catalog, in Ukrainian and
// English. The site has no shared i18n runtime — the landing pages are plain HTML per locale — so
// the strings live here. Plain wording on purpose: no marketing phrases, no comparisons with other
// apps, nothing that promises use without an account (saving words needs one).

// Which UI language a deck page renders in. One URL, one language — what a crawler sees is what
// a visitor sees. Ukrainian unless the deck says its learners speak something else: most public
// decks are English for Ukrainian speakers, and half of them leave native_language empty.
export function deckLang(folder) {
  const native = String(folder?.native_language || "").trim();
  if (!native || native === "Ukrainian") return "uk";
  return "en";
}

// Ukrainian plural: 1 слово, 2–4 слова, 5+ слів (11–14 always "many").
export function ukPlural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function plural(lang, n, forms) {
  if (lang === "uk") return ukPlural(n, forms.one, forms.few, forms.many);
  return n === 1 ? forms.one : forms.many;
}

// folders.language / native_language hold canonical English names (the app's
// CommunityVocabulary.LanguageOptions). BCP 47 codes for <html lang>/JSON-LD inLanguage.
export const LANGUAGE_CODES = {
  Arabic: "ar", Azerbaijani: "az", Chinese: "zh", Czech: "cs", Danish: "da", Dutch: "nl",
  English: "en", Esperanto: "eo", Finnish: "fi", French: "fr", German: "de", Greek: "el",
  Hebrew: "he", Hindi: "hi", Hungarian: "hu", Indonesian: "id", Irish: "ga", Italian: "it",
  Japanese: "ja", Korean: "ko", Persian: "fa", Polish: "pl", Portuguese: "pt", Russian: "ru",
  Slovak: "sk", Spanish: "es", Swedish: "sv", Thai: "th", Turkish: "tr", Ukrainian: "uk",
  Vietnamese: "vi",
};

// Ukrainian language names: `name` for labels ("Англійська"), `stem` for the agreeing adjective
// in "63 англійські слова" (stem + е/і/их). Esperanto, Hebrew and Hindi do not decline that way,
// so they go after the noun instead: "12 слів гінді".
const UK_LANGUAGES = {
  Arabic: { name: "Арабська", stem: "арабськ" },
  Azerbaijani: { name: "Азербайджанська", stem: "азербайджанськ" },
  Chinese: { name: "Китайська", stem: "китайськ" },
  Czech: { name: "Чеська", stem: "чеськ" },
  Danish: { name: "Данська", stem: "данськ" },
  Dutch: { name: "Нідерландська", stem: "нідерландськ" },
  English: { name: "Англійська", stem: "англійськ" },
  Esperanto: { name: "Есперанто", after: "есперанто" },
  Finnish: { name: "Фінська", stem: "фінськ" },
  French: { name: "Французька", stem: "французьк" },
  German: { name: "Німецька", stem: "німецьк" },
  Greek: { name: "Грецька", stem: "грецьк" },
  Hebrew: { name: "Іврит", after: "івриту" },
  Hindi: { name: "Гінді", after: "гінді" },
  Hungarian: { name: "Угорська", stem: "угорськ" },
  Indonesian: { name: "Індонезійська", stem: "індонезійськ" },
  Irish: { name: "Ірландська", stem: "ірландськ" },
  Italian: { name: "Італійська", stem: "італійськ" },
  Japanese: { name: "Японська", stem: "японськ" },
  Korean: { name: "Корейська", stem: "корейськ" },
  Persian: { name: "Перська", stem: "перськ" },
  Polish: { name: "Польська", stem: "польськ" },
  Portuguese: { name: "Португальська", stem: "португальськ" },
  Russian: { name: "Російська", stem: "російськ" },
  Slovak: { name: "Словацька", stem: "словацьк" },
  Spanish: { name: "Іспанська", stem: "іспанськ" },
  Swedish: { name: "Шведська", stem: "шведськ" },
  Thai: { name: "Тайська", stem: "тайськ" },
  Turkish: { name: "Турецька", stem: "турецьк" },
  Ukrainian: { name: "Українська", stem: "українськ" },
  Vietnamese: { name: "В'єтнамська", stem: "в'єтнамськ" },
};

const UK_CATEGORIES = {
  Travel: "Подорожі", Study: "Навчання", Sport: "Спорт", Business: "Бізнес", Food: "Їжа",
  Health: "Здоров'я", Technology: "Технології", Nature: "Природа", "Home & Family": "Дім і сім'я",
  Shopping: "Покупки", Emotions: "Емоції", "Art & Culture": "Мистецтво й культура",
  Entertainment: "Розваги", Weather: "Погода", Transportation: "Транспорт", Science: "Наука",
  "Daily Life": "Повсякдення", Animals: "Тварини", Fashion: "Мода", Relationships: "Стосунки",
  Other: "Інше",
};

export function languageName(lang, language) {
  if (!language) return "";
  return lang === "uk" ? UK_LANGUAGES[language]?.name || language : language;
}

export function categoryName(lang, category) {
  if (!category) return "";
  return lang === "uk" ? UK_CATEGORIES[category] || category : category;
}

/** "63 англійські слова" / "63 English words" / "63 слова" when the language is unknown. */
export function wordsPhrase(lang, count, language) {
  if (lang === "uk") {
    const noun = ukPlural(count, "слово", "слова", "слів");
    const info = UK_LANGUAGES[language];
    if (info?.stem) {
      const adjective = info.stem + ukPlural(count, "е", "і", "их");
      return `${count} ${adjective} ${noun}`;
    }
    if (info?.after) return `${count} ${noun} ${info.after}`;
    return `${count} ${noun}`;
  }
  const noun = count === 1 ? "word" : "words";
  return language ? `${count} ${language} ${noun}` : `${count} ${noun}`;
}

/** "7 клас" / "grade 7"; free-form values are shown as entered. */
export function gradeLabel(lang, grade) {
  const value = String(grade ?? "").trim();
  if (!value) return "";
  if (/^\d{1,2}$/.test(value)) return lang === "uk" ? `${value} клас` : `Grade ${value}`;
  return value;
}

// Leaderboard modes (the API's wire names), as the app calls them.
const MODE_NAMES = {
  // As the app names them (Section_* resx keys).
  uk: { flashcards: "Картки", quiz: "Вікторина", writing: "Письмо", matching: "Зіставлення", true_false: "Правда/Хиба", truefalse: "Правда/Хиба", listening: "Аудіювання" },
  en: { flashcards: "Flashcards", quiz: "Quiz", writing: "Writing", matching: "Matching", true_false: "True/False", truefalse: "True/False", listening: "Listening" },
};

const STRINGS = {
  uk: {
    withTranslation: "з перекладом",
    by: "Автор",
    authorProfile: "профіль автора",
    unknownAuthor: "Автор",
    decks: "Колоди",
    home: "Atom Translate",
    sectionsTitle: "Слова за секціями",
    words: { one: "слово", few: "слова", many: "слів" },
    sections: { one: "секція", few: "секції", many: "секцій" },
    learners: { one: "людина вчить цю колоду", few: "людини вчать цю колоду", many: "людей вчать цю колоду" },
    takeTest: "Пройти тест за цими словами",
    demoTest: "Пройти демо-тест",
    modesDeck: "Вчити всю колоду",
    modesSection: "Вправи",
    modesLocked: "Доступно після входу в акаунт: прогрес зберігається, є таблиця лідерів.",
    modeLockedLabel: "{0} — після входу",
    sectionsHeading: "Секції",
    openSection: "Відкрити секцію",
    allWords: "Усі слова колоди",
    wordsTitle: "Слова",
    prevSection: "Попередня секція",
    nextSection: "Наступна секція",
    backToDeck: "Усі секції колоди",
    sectionFallbackDescription: "{0} з перекладом із секції «{1}» колоди «{2}». Вчи їх у Atom Translate.",
    signInFullTest: "Увійти й пройти повний тест",
    learnThese: "Вчити ці слова",
    openInApp: "Відкрити в застосунку",
    openInWeb: "Відкрити у веб-версії",
    train: "Тренувати",
    trainSection: "Тренувати секцію «{0}»",
    getItOn: "Завантажити з",
    downloadOn: "Завантажити в",
    storesNote: "Застосунок для iPhone та Android",
    alreadyHaveApp: "Якщо застосунок уже встановлено, посилання на колоду відкриє її одразу в ньому.",
    textbook: "Підручник",
    grade: "Клас",
    unit: "Юніт",
    level: "Рівень",
    original: "Слово",
    translation: "Переклад",
    quizTitle: "Перевір себе",
    quizIntro: "{0} з цих слів, прямо тут.",
    questions: { one: "питання", few: "питання", many: "питань" },
    quizQuestion: "Як перекласти «{0}»?",
    quizCorrect: "Правильно",
    quizWrong: "Правильна відповідь: {0}",
    quizNext: "Далі",
    quizStart: "Почати",
    quizResult: "{0} з {1}",
    quizResultHint: "Повний тест і всі вправи — після входу в акаунт. Там зберігається прогрес і є таблиця лідерів.",
    quizContinueWeb: "Продовжити у вебі",
    quizAgain: "Ще раз",
    boardTitle: "Таблиця лідерів",
    boardIn: "«{0}» · {1}",
    boardEmpty: "Тут ще нікого немає. Стань першим — пройди вправу на цій колоді.",
    boardBeFirst: "Стати першим",
    boardTry: "Спробувати свої сили",
    boardPlayers: { one: "учасник", few: "учасники", many: "учасників" },
    seconds: "{0} с",
    minutes: "{0} хв {1} с",
    themeToLight: "Увімкнути світлу тему",
    themeToDark: "Увімкнути темну тему",
    bannerText: "Відкрий цю колоду в застосунку Atom Translate",
    bannerOpen: "Відкрити",
    bannerClose: "Закрити",
    notFoundTitle: "Цієї колоди немає",
    notFoundBody: "Колода приватна або її видалили.",
    unavailableTitle: "Колоду зараз не вдалося завантажити",
    unavailableBody: "Спробуй ще раз за кілька хвилин.",
    allDecks: "Усі колоди",
    privacy: "Конфіденційність",
    support: "Підтримка",
    fallbackDescription: "{0} з перекладом у колоді «{1}»{2}. Вчи їх із картками, тестом, письмом і грою на пари в Atom Translate.",
    fallbackBy: " (автор — {0})",
    // catalog
    catalogTitle: "Колоди слів з перекладом",
    catalogDescription: "Публічні колоди слів у Atom Translate: за підручниками, класами, рівнями й темами. Відкрий будь-яку й пройди тест одразу в браузері.",
    catalogH1: "Колоди слів",
    catalogIntro: "Колоди, якими поділились користувачі Atom Translate. Шукай за назвою, підручником, класом чи темою.",
    search: "Пошук",
    searchPlaceholder: "Наприклад: Карпюк 7 клас unit 3",
    filterLanguage: "Мова",
    filterNative: "Мова перекладу",
    filterLevel: "Рівень",
    filterCategory: "Категорія",
    filterTextbook: "Підручник",
    filterGrade: "Клас",
    filterAny: "Усі",
    apply: "Показати",
    reset: "Скинути",
    noResults: "Нічого не знайшлось. Спробуй інші слова або прибери фільтри.",
    page: "Сторінка {0}",
    prev: "Назад",
    next: "Далі",
    pagination: "Сторінки",
    found: { one: "колода", few: "колоди", many: "колод" },
  },
  en: {
    withTranslation: "with translations",
    by: "By",
    authorProfile: "author's profile",
    unknownAuthor: "Author",
    decks: "Decks",
    home: "Atom Translate",
    sectionsTitle: "Words by section",
    words: { one: "word", many: "words" },
    sections: { one: "section", many: "sections" },
    learners: { one: "person is learning this deck", many: "people are learning this deck" },
    takeTest: "Take a test on these words",
    demoTest: "Try a demo test",
    modesDeck: "Learn the whole deck",
    modesSection: "Exercises",
    modesLocked: "Available once you sign in: your progress is saved and there is a leaderboard.",
    modeLockedLabel: "{0} — after signing in",
    sectionsHeading: "Sections",
    openSection: "Open section",
    allWords: "All words in this deck",
    wordsTitle: "Words",
    prevSection: "Previous section",
    nextSection: "Next section",
    backToDeck: "All sections of the deck",
    sectionFallbackDescription: "{0} with translations from the “{1}” section of the “{2}” deck. Learn them in Atom Translate.",
    signInFullTest: "Sign in for the full test",
    learnThese: "Learn these words",
    openInApp: "Open in the app",
    openInWeb: "Open in the web app",
    train: "Practise",
    trainSection: "Practise the “{0}” section",
    getItOn: "Get it on",
    downloadOn: "Download on the",
    storesNote: "The app for iPhone and Android",
    alreadyHaveApp: "If you have the app, a link to this deck opens it there directly.",
    textbook: "Textbook",
    grade: "Grade",
    unit: "Unit",
    level: "Level",
    original: "Word",
    translation: "Translation",
    quizTitle: "Test yourself",
    quizIntro: "{0} from these words, right here.",
    questions: { one: "question", many: "questions" },
    quizQuestion: "How do you translate “{0}”?",
    quizCorrect: "Correct",
    quizWrong: "The answer is: {0}",
    quizNext: "Next",
    quizStart: "Start",
    quizResult: "{0} of {1}",
    quizResultHint: "The full test and all exercises are there once you sign in, with your progress saved and a leaderboard.",
    quizContinueWeb: "Continue on the web",
    quizAgain: "Again",
    boardTitle: "Leaderboard",
    boardIn: "“{0}” · {1}",
    boardEmpty: "Nobody here yet. Be the first — do an exercise on this deck.",
    boardBeFirst: "Be the first",
    boardTry: "Try it yourself",
    boardPlayers: { one: "player", many: "players" },
    seconds: "{0} s",
    minutes: "{0} min {1} s",
    themeToLight: "Switch to light theme",
    themeToDark: "Switch to dark theme",
    bannerText: "Open this deck in the Atom Translate app",
    bannerOpen: "Open",
    bannerClose: "Close",
    notFoundTitle: "This deck isn't available",
    notFoundBody: "It is private or has been deleted.",
    unavailableTitle: "This deck couldn't be loaded right now",
    unavailableBody: "Please try again in a few minutes.",
    allDecks: "All decks",
    privacy: "Privacy",
    support: "Support",
    fallbackDescription: "{0} with translations in the “{1}” deck{2}. Learn them with flashcards, a quiz, writing and matching in Atom Translate.",
    fallbackBy: " by {0}",
    catalogTitle: "Vocabulary decks with translations",
    catalogDescription: "Public vocabulary decks on Atom Translate by textbook, grade, level and topic. Open any of them and take a test right in your browser.",
    catalogH1: "Vocabulary decks",
    catalogIntro: "Decks shared by Atom Translate users. Search by name, textbook, grade or topic.",
    search: "Search",
    searchPlaceholder: "For example: Headway unit 3",
    filterLanguage: "Language",
    filterNative: "Translation language",
    filterLevel: "Level",
    filterCategory: "Category",
    filterTextbook: "Textbook",
    filterGrade: "Grade",
    filterAny: "Any",
    apply: "Show",
    reset: "Reset",
    noResults: "Nothing found. Try other words or remove the filters.",
    page: "Page {0}",
    prev: "Previous",
    next: "Next",
    pagination: "Pages",
    found: { one: "deck", many: "decks" },
  },
};

export function strings(lang) {
  return STRINGS[lang] || STRINGS.en;
}

export function modeName(lang, mode) {
  return (MODE_NAMES[lang] || MODE_NAMES.en)[mode] || mode;
}

/** "{0} …{1}" placeholders. */
export function fmt(template, ...args) {
  return String(template).replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ""));
}

export function countLabel(lang, n, forms) {
  return `${n} ${plural(lang, n, forms)}`;
}
