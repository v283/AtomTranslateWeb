// Client extras for the deck and section pages and the /decks catalog (functions/_lib/deck-page.js). The
// server-rendered HTML is complete without this file — every word is already in it. This adds:
//   * the light/dark switch (the initial theme is set by the inline script in <head>),
//   * the mini-quiz (3–5 questions from the deck, on the page),
//   * the leaderboard teaser (fetched from /api/decks/{CODE}/leaderboard),
//   * the small Android "open in the app" banner (dismissible, remembered),
//   * the sticky "Learn these words" bar on phones once the main button has scrolled away,
//   * the word list's paging ("show more", a page at a time) and pronounce buttons.
// No popups or interstitials: nothing here covers the content.
(function () {
  "use strict";

  var THEME_KEY = "atl-theme";
  var BANNER_KEY = "atl-app-banner-dismissed";
  var QUIZ_LENGTH = 5;

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* storage off: the choice just isn't remembered */ }
    return null;
  }

  function fmt(template) {
    var args = Array.prototype.slice.call(arguments, 1);
    return String(template).replace(/\{(\d+)\}/g, function (_, i) {
      return args[Number(i)] === undefined ? "" : String(args[Number(i)]);
    });
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (name) {
        if (name === "text") node.textContent = attrs[name];
        else if (name === "className") node.className = attrs[name];
        else node.setAttribute(name, attrs[name]);
      });
    }
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  /* ---------------------------------------------------------------- theme */

  function initTheme() {
    var button = document.querySelector("[data-theme-toggle]");
    if (!button) return;
    var root = document.documentElement;
    function label() {
      var dark = root.getAttribute("data-theme") !== "light";
      button.setAttribute("aria-label", dark ? button.dataset.labelLight : button.dataset.labelDark);
    }
    label();
    button.hidden = false;
    button.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      store(THEME_KEY, next);
      label();
    });
  }

  var data = null;
  var node = document.getElementById("deck-data");
  if (node) {
    try { data = JSON.parse(node.textContent || "null"); } catch (e) { data = null; }
  }

  initTheme();
  if (!data) return;
  var s = data.s;

  function plural(n, forms) {
    if (data.lang === "uk") {
      var m10 = n % 10, m100 = n % 100;
      if (m10 === 1 && m100 !== 11) return forms.one;
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms.few || forms.many;
      return forms.many;
    }
    return n === 1 ? forms.one : forms.many;
  }

  function shuffle(items) {
    var out = items.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  /* ---------------------------------------------------------------- Android banner */

  function initBanner() {
    var banner = document.querySelector("[data-app-banner]");
    if (!banner) return;
    var isAndroid = /Android/i.test(navigator.userAgent);
    if (!isAndroid || store(BANNER_KEY) === "1") return;
    banner.hidden = false;
    var close = banner.querySelector("[data-app-banner-close]");
    if (close) {
      close.addEventListener("click", function () {
        banner.hidden = true;
        store(BANNER_KEY, "1");
      });
    }
  }

  /* ---------------------------------------------------------------- mini-quiz */

  function initQuiz() {
    var section = document.getElementById("quiz");
    var body = section && section.querySelector("[data-quiz-body]");
    if (!body || !Array.isArray(data.quiz)) return;

    // Distinct translations are the answer options; a deck needs at least four of them.
    var pool = data.quiz.filter(function (pair) { return pair && pair[0] && pair[1]; });
    var translations = [];
    pool.forEach(function (pair) { if (translations.indexOf(pair[1]) === -1) translations.push(pair[1]); });
    if (translations.length < 4) return;

    var questions, index, score;

    function start() {
      var seen = {};
      var picked = [];
      shuffle(pool).forEach(function (pair) {
        if (picked.length < QUIZ_LENGTH && !seen[pair[0]]) { seen[pair[0]] = true; picked.push(pair); }
      });
      questions = picked;
      index = 0;
      score = 0;
      showQuestion();
    }

    function intro() {
      body.textContent = "";
      var startButton = el("button", { type: "button", className: "btn btn--primary", text: s.quizStart });
      startButton.addEventListener("click", start);
      var count = Math.min(QUIZ_LENGTH, pool.length);
      body.appendChild(el("p", { text: fmt(s.quizIntro, count + " " + plural(count, s.questions)) }));
      body.appendChild(startButton);
    }

    function showQuestion() {
      var pair = questions[index];
      var wrong = shuffle(translations.filter(function (t) { return t !== pair[1]; })).slice(0, 3);
      var options = shuffle(wrong.concat([pair[1]]));

      body.textContent = "";
      body.appendChild(el("p", { className: "quiz__progress", text: (index + 1) + " / " + questions.length }));
      var question = el("p", { className: "quiz__question", id: "quiz-q" });
      question.textContent = fmt(s.quizQuestion, pair[0]);
      body.appendChild(question);

      var list = el("ul", { className: "quiz__options", "aria-labelledby": "quiz-q" });
      var feedback = el("p", { className: "quiz__feedback", role: "status" });
      var buttons = [];
      options.forEach(function (option) {
        var button = el("button", { type: "button", className: "quiz__option", text: option });
        button.addEventListener("click", function () {
          var right = option === pair[1];
          if (right) score++;
          buttons.forEach(function (b) {
            b.disabled = true;
            if (b.textContent === pair[1]) b.classList.add("is-correct");
          });
          if (!right) button.classList.add("is-wrong");
          feedback.className = "quiz__feedback " + (right ? "is-correct" : "is-wrong");
          feedback.textContent = right ? s.quizCorrect : fmt(s.quizWrong, pair[1]);
          var next = el("button", { type: "button", className: "btn btn--primary", text: s.quizNext });
          next.addEventListener("click", function () {
            index++;
            if (index < questions.length) showQuestion(); else showResult();
          });
          body.appendChild(next);
          next.focus();
        });
        buttons.push(button);
        list.appendChild(el("li", null, [button]));
      });
      body.appendChild(list);
      body.appendChild(feedback);
    }

    function showResult() {
      body.textContent = "";
      body.appendChild(el("p", { className: "quiz__score", role: "status", text: fmt(s.quizResult, score, questions.length) }));
      body.appendChild(el("p", { text: s.quizResultHint }));
      var actions = el("div", { className: "quiz__actions" });
      actions.appendChild(el("a", { className: "btn btn--primary", href: data.webFolderQuiz, text: s.quizContinueWeb }));
      var again = el("button", { type: "button", className: "btn btn--secondary", text: s.quizAgain });
      again.addEventListener("click", start);
      actions.appendChild(again);
      if (data.isMain && matchMedia("(hover: none), (pointer: coarse)").matches) {
        actions.appendChild(el("a", { className: "btn btn--secondary", href: data.appLink, text: s.openInApp }));
      }
      body.appendChild(actions);
      var heading = document.getElementById("quiz-title");
      if (heading) heading.scrollIntoView({ block: "nearest" });
    }

    section.hidden = false;
    intro();

    // "Try a demo test" (hero and sticky bar): start straight away and bring the quiz into view.
    // Hidden in the HTML, since without this script there is no quiz to go to.
    Array.prototype.forEach.call(document.querySelectorAll("[data-start-quiz]"), function (link) {
      link.hidden = false;
      link.addEventListener("click", function (event) {
        event.preventDefault();
        start();
        section.scrollIntoView({ behavior: "smooth", block: "start" });
        var first = section.querySelector(".quiz__option");
        if (first) first.focus({ preventScroll: true });
      });
    });
  }

  /* ---------------------------------------------------------------- leaderboard teaser */

  function formatTime(ms) {
    var total = Math.floor((ms + 500) / 1000);
    if (total < 60) return fmt(s.seconds, total);
    var seconds = total % 60;
    return fmt(s.minutes, Math.floor(total / 60), seconds < 10 ? "0" + seconds : seconds);
  }

  function initBoard() {
    var section = document.getElementById("board");
    var body = section && section.querySelector("[data-board-body]");
    if (!body || !window.fetch || !data.board) return;

    fetch("/api/decks/" + encodeURIComponent(data.code) + "/leaderboard", { headers: { Accept: "application/json" } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (teaser) {
        if (!teaser || teaser.unavailable) return;
        body.textContent = "";
        if (!teaser.entries || teaser.entries.length === 0) {
          // Nobody has played yet. Only worth saying if there is a section to play.
          if (!data.firstRankedQuiz) return;
          body.appendChild(el("p", { text: s.boardEmpty }));
          body.appendChild(el("a", { className: "btn btn--secondary", href: data.firstRankedQuiz, text: s.boardBeFirst }));
        } else {
          var mode = (s.modes && s.modes[teaser.mode]) || teaser.mode || "";
          body.appendChild(el("p", {
            className: "board__in",
            text: fmt(s.boardIn, teaser.sectionName || "", mode) + " · " + teaser.players + " " + plural(teaser.players, s.boardPlayers),
          }));
          var list = el("ol", { className: "board__list" });
          teaser.entries.forEach(function (entry) {
            list.appendChild(el("li", { className: "board__row" }, [
              el("span", { className: "board__rank", text: String(entry.rank) }),
              el("span", { className: "board__name", text: entry.displayName }),
              el("span", { className: "board__result", text: formatTime(entry.durationMs) + " · " + entry.score + "/" + teaser.totalWords }),
            ]));
          });
          body.appendChild(list);
          if (teaser.sectionId) {
            body.appendChild(el("a", {
              className: "btn btn--secondary",
              href: data.sectionQuizBase + encodeURIComponent(teaser.sectionId),
              text: s.boardTry,
            }));
          }
        }
        section.hidden = false;
      })
      .catch(function () { /* the teaser is optional */ });
  }

  /* ---------------------------------------------------------------- word list */

  // The server sends every word (crawlers and no-JS visitors read them all). Here only the first
  // page is left showing — a long section then costs a short page to lay out, and its lazy
  // pictures load only as their rows come into view — with a button for the next page.
  function initWords() {
    var canSpeak = "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function";
    Array.prototype.forEach.call(document.querySelectorAll("[data-words]"), function (list) {
      var page = Number(list.getAttribute("data-page")) || 60;
      var lang = list.getAttribute("data-lang") || "";
      var rows = list.querySelectorAll(".wcard");
      var shown = 0;
      var more = list.nextElementSibling && list.nextElementSibling.hasAttribute("data-words-more")
        ? list.nextElementSibling : null;

      function showNext() {
        var until = Math.min(rows.length, shown + page);
        for (var i = 0; i < rows.length; i++) rows[i].hidden = i >= until;
        shown = until;
        if (!more) return;
        var left = rows.length - shown;
        more.hidden = left <= 0;
        more.textContent = fmt(more.getAttribute("data-label"), Math.min(page, left));
      }

      if (more) more.addEventListener("click", showNext);
      showNext();

      if (!canSpeak) return;
      Array.prototype.forEach.call(list.querySelectorAll("[data-speak]"), function (b) { b.hidden = false; });
      list.addEventListener("click", function (event) {
        var button = event.target.closest && event.target.closest("[data-speak]");
        if (!button) return;
        var word = button.parentNode.querySelector(".wcard__orig");
        if (!word) return;
        var utterance = new SpeechSynthesisUtterance(word.textContent || "");
        if (lang) utterance.lang = lang;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      });
    });
  }

  /* ---------------------------------------------------------------- sticky CTA */

  function initSticky() {
    var bar = document.querySelector("[data-sticky-cta]");
    var hero = document.querySelector("[data-hero-cta]");
    if (!bar || !hero || !("IntersectionObserver" in window)) return;
    bar.hidden = false;
    document.body.classList.add("has-sticky-cta");
    // Only while the hero button is off screen: one main call to action on screen at a time.
    new IntersectionObserver(function (entries) {
      var visible = entries[0] && entries[0].isIntersecting;
      bar.classList.toggle("is-shown", !visible);
      bar.setAttribute("aria-hidden", visible ? "true" : "false");
      Array.prototype.forEach.call(bar.querySelectorAll("a"), function (a) { a.tabIndex = visible ? -1 : 0; });
    }, { threshold: 0 }).observe(hero);
  }

  initBanner();
  initQuiz();
  initBoard();
  initSticky();
  initWords();
})();
