/* Atom Translate — phone demo (hero).
   Змонтований запис екрана справжнього застосунку в рамці телефона + підписи й крапки-розділи.
   Атрибути на #atom-demo: data-lang="en|uk", data-src (mp4), data-poster, data-bare="true" (без підпису/крапок),
   data-autoplay="false" (не запускати само), data-frames="шлях/f" (режим рендеру відео: кадри замість <video>). */
(function () {
  'use strict';
  var root = document.getElementById('atom-demo');
  if (!root) return;

  var REQ_LANG = root.getAttribute('data-lang');
  var BARE = root.getAttribute('data-bare') === 'true';
  var AUTO = root.getAttribute('data-autoplay') !== 'false';
  var FRAMES = root.getAttribute('data-frames');
  var SRC = root.getAttribute('data-src') || 'assets/demo/atom-demo.mp4';
  var POSTER = root.getAttribute('data-poster') || SRC.replace(/\.mp4$/, '.jpg');
  var FPS = 60, TOTAL = /*TOTAL*/111.5;

  /* розділи: [ключ, початок, кінець] у секундах змонтованого відео */
  var CH = /*CH*/[["translate",0.0,18.533],["library",18.533,26.65],["flashcards",26.65,34.65],["quiz",34.65,41.6],["writing",41.6,52.017],["matching",52.017,60.433],["truefalse",60.433,68.216],["listening",68.217,77.717],["leaderboard",77.717,82.684],["progress",82.683,87.65],["import",87.65,101.6],["quizlet",101.6,111.5]];

  var TXT = {
    en: {
      ch: {
        translate: ['Translate & save', 'Pick a translation, save it to a folder'],
        library: ['Your library', 'Folders and sections with your words'],
        flashcards: ['Flashcards', 'Flip the card, mark what you knew'],
        quiz: ['Quiz', 'Pick the right translation'],
        writing: ['Writing', 'Type the word, use hints if stuck'],
        matching: ['Matching', 'Pair every word with its translation'],
        truefalse: ['True / False', 'Is the translation correct?'],
        listening: ['Listening', 'Listen, then choose or write it'],
        leaderboard: ['Leaderboard', 'Beat the best time in every mode'],
        progress: ['Progress', 'Streaks, activity and daily goal'],
        import: ['Words from a picture', 'Snap a word list, review and import'],
        quizlet: ['Import from Quizlet', 'Bring your sets over as a PDF']
      },
      modes: ['Flashcards', 'Quiz', 'Writing', 'Matching', 'True / False', 'Listening'],
      play: 'Play demo'
    },
    uk: {
      ch: {
        translate: ['Переклад і збереження', 'Обери переклад і збережи в папку'],
        library: ['Бібліотека', 'Папки й секції з твоїми словами'],
        flashcards: ['Картки', 'Переверни картку й познач, чи знав'],
        quiz: ['Тест', 'Обери правильний переклад'],
        writing: ['Письмо', 'Введи слово, а підказка — якщо застряг'],
        matching: ['Пари', 'З’єднай кожне слово з перекладом'],
        truefalse: ['Правда чи ні', 'Чи правильний переклад?'],
        listening: ['Аудіювання', 'Слухай, а тоді обирай чи пиши'],
        leaderboard: ['Рейтинг', 'Побий найкращий час у кожному режимі'],
        progress: ['Прогрес', 'Серія днів, активність і щоденна ціль'],
        import: ['Слова з фото', 'Сфотографуй список, перевір і імпортуй'],
        quizlet: ['Імпорт із Quizlet', 'Перенеси свої набори через PDF']
      },
      modes: ['Картки', 'Тест', 'Письмо', 'Пари', 'Правда чи ні', 'Аудіювання'],
      play: 'Відтворити демо'
    },
    de: {
      ch: {
        translate: ['Übersetzen & speichern', 'Übersetzung wählen und in einem Ordner speichern'],
        library: ['Deine Bibliothek', 'Ordner und Abschnitte mit deinen Wörtern'],
        flashcards: ['Karteikarten', 'Karte umdrehen, markieren, was du wusstest'],
        quiz: ['Quiz', 'Die richtige Übersetzung wählen'],
        writing: ['Schreiben', 'Wort tippen, bei Bedarf Hinweise nutzen'],
        matching: ['Zuordnen', 'Jedes Wort seiner Übersetzung zuordnen'],
        truefalse: ['Richtig / Falsch', 'Stimmt die Übersetzung?'],
        listening: ['Hören', 'Zuhören, dann wählen oder schreiben'],
        leaderboard: ['Bestenliste', 'Schlage die Bestzeit in jedem Modus'],
        progress: ['Fortschritt', 'Serien, Aktivität und Tagesziel'],
        import: ['Wörter aus einem Foto', 'Wortliste fotografieren, prüfen und importieren'],
        quizlet: ['Import aus Quizlet', 'Deine Sets als PDF übernehmen']
      },
      modes: ['Karteikarten', 'Quiz', 'Schreiben', 'Zuordnen', 'Richtig / Falsch', 'Hören'],
      play: 'Demo abspielen'
    },
    pl: {
      ch: {
        translate: ['Tłumacz i zapisz', 'Wybierz tłumaczenie i zapisz je w folderze'],
        library: ['Twoja biblioteka', 'Foldery i sekcje z Twoimi słowami'],
        flashcards: ['Fiszki', 'Odwróć kartę i zaznacz, co już znasz'],
        quiz: ['Quiz', 'Wybierz poprawne tłumaczenie'],
        writing: ['Pisanie', 'Wpisz słowo, a w razie potrzeby użyj podpowiedzi'],
        matching: ['Dopasowywanie', 'Połącz każde słowo z jego tłumaczeniem'],
        truefalse: ['Prawda / fałsz', 'Czy tłumaczenie jest poprawne?'],
        listening: ['Słuchanie', 'Posłuchaj, potem wybierz lub napisz'],
        leaderboard: ['Ranking', 'Pobij najlepszy czas w każdym trybie'],
        progress: ['Postępy', 'Serie dni, aktywność i dzienny cel'],
        import: ['Słowa ze zdjęcia', 'Sfotografuj listę słów, sprawdź i zaimportuj'],
        quizlet: ['Import z Quizleta', 'Przenieś swoje zestawy jako PDF']
      },
      modes: ['Fiszki', 'Quiz', 'Pisanie', 'Dopasowywanie', 'Prawda / fałsz', 'Słuchanie'],
      play: 'Odtwórz demo'
    },
    ja: {
      ch: {
        translate: ['翻訳して保存', '訳を選んでフォルダに保存'],
        library: ['ライブラリ', 'あなたの単語が入ったフォルダとセクション'],
        flashcards: ['単語カード', 'カードをめくって、わかったかどうかを記録'],
        quiz: ['クイズ', '正しい訳を選ぶ'],
        writing: ['書き取り', '単語を入力、困ったらヒントも'],
        matching: ['マッチング', '単語と訳をペアにする'],
        truefalse: ['○×', 'この訳は合っている？'],
        listening: ['リスニング', '聞いてから選ぶか入力する'],
        leaderboard: ['ランキング', '各モードでベストタイムを更新'],
        progress: ['進捗', '連続日数、アクティビティ、毎日の目標'],
        import: ['写真から単語を取り込む', '単語リストを撮影して、確認してインポート'],
        quizlet: ['Quizletからインポート', 'セットをPDFで移行']
      },
      modes: ['単語カード', 'クイズ', '書き取り', 'マッチング', '○×', 'リスニング'],
      play: 'デモを再生'
    },
    ar: {
      ch: {
        translate: ['ترجم واحفظ', 'اختر ترجمة واحفظها في مجلد'],
        library: ['مكتبتك', 'مجلدات وأقسام تضم كلماتك'],
        flashcards: ['البطاقات التعليمية', 'اقلب البطاقة وحدّد ما كنت تعرفه'],
        quiz: ['الاختبار', 'اختر الترجمة الصحيحة'],
        writing: ['الكتابة', 'اكتب الكلمة واستعن بالتلميحات عند الحاجة'],
        matching: ['المطابقة', 'اربط كل كلمة بترجمتها'],
        truefalse: ['صح / خطأ', 'هل الترجمة صحيحة؟'],
        listening: ['الاستماع', 'استمع ثم اختر أو اكتب'],
        leaderboard: ['لوحة المتصدرين', 'حطّم أفضل وقت في كل وضع'],
        progress: ['التقدّم', 'السلاسل والنشاط والهدف اليومي'],
        import: ['كلمات من صورة', 'صوّر قائمة كلمات وراجعها ثم استوردها'],
        quizlet: ['الاستيراد من Quizlet', 'انقل مجموعاتك كملف PDF']
      },
      modes: ['البطاقات التعليمية', 'الاختبار', 'الكتابة', 'المطابقة', 'صح / خطأ', 'الاستماع'],
      play: 'تشغيل العرض التجريبي'
    }
  };
  var LANG = TXT[REQ_LANG] ? REQ_LANG : 'en';
  var L = TXT[LANG];

  /* ---------- розмітка ---------- */
  var SYS = '<svg width="52" height="12" viewBox="0 0 52 12" fill="currentColor" aria-hidden="true">' +
    '<path d="M1 9h2v2H1zM5 7h2v4H5zM9 5h2v6H9zM13 3h2v8h-2z"/>' +
    '<path d="M23 4.2a8 8 0 0 1 11 0l-1.3 1.4a6 6 0 0 0-8.4 0zm2.4 2.5a4.6 4.6 0 0 1 6.2 0l-1.3 1.4a2.7 2.7 0 0 0-3.6 0zM28.5 9a1.3 1.3 0 1 1 0 .01z"/>' +
    '<rect x="38" y="2" width="12" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="39.6" y="3.6" width="8" height="4.8" rx="1" /></svg>';

  var h = '<div class="ad-stage"><div class="ad-phone"><div class="ad-screen">' +
    '<div class="ad-status"><span>9:41</span><span class="ad-sys">' + SYS + '</span></div><i class="ad-hole"></i>' +
    (FRAMES ? '<img class="ad-vid" alt="" decoding="sync">' :
      '<video class="ad-vid" muted playsinline loop preload="auto" poster="' + POSTER + '" aria-label="Atom Translate demo"><source src="' + SRC.replace(/\.mp4$/, '.webm') + '" type="video/webm"><source src="' + SRC + '" type="video/mp4"></video>' +
      '<button class="ad-play" type="button" aria-label="' + L.play + '"><svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z"/></svg></button>') +
    '</div></div></div>';
  if (!BARE) {
    h += '<div class="ad-cap">' + CH.map(function (c) {
      var t = L.ch[c[0]];
      return '<div class="ad-cap-item"><b>' + t[0] + '</b><span>' + t[1] + '</span></div>';
    }).join('') + '<div class="ad-dots">' + CH.map(function (c) {
      return '<button class="ad-dot" type="button" aria-label="' + L.ch[c[0]][0] + '"><i></i></button>';
    }).join('') + '</div></div>';
  } else root.classList.add('is-bare');
  root.innerHTML = h; // замінює статичний скриншот-запасний варіант (він лишається, якщо JS вимкнено)

  var stage = root.querySelector('.ad-stage'), phone = root.querySelector('.ad-phone'), vid = root.querySelector('.ad-vid');
  var caps = root.querySelectorAll('.ad-cap-item'), dots = root.querySelectorAll('.ad-dot');

  function fit() { phone.style.setProperty('--s', (stage.clientWidth / 414).toFixed(4)); }
  fit();
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(stage); else window.addEventListener('resize', fit);

  /* ---------- розділи ---------- */
  function chapterAt(t) {
    for (var i = CH.length - 1; i >= 0; i--) if (t >= CH[i][1] - 0.001) return i;
    return 0;
  }
  var cur = -1;
  function paint(t) {
    if (BARE) return;
    var i = chapterAt(t);
    if (i !== cur) {
      cur = i;
      for (var k = 0; k < caps.length; k++) caps[k].classList.toggle('is-on', k === i);
      for (k = 0; k < dots.length; k++) dots[k].firstChild.style.transform = k < i ? 'scaleX(1)' : 'scaleX(0)';
    }
    var c = CH[i], p = Math.max(0, Math.min(1, (t - c[1]) / (c[2] - c[1])));
    dots[i].firstChild.style.transform = 'scaleX(' + p.toFixed(3) + ')';
  }

  /* ---------- режим рендеру відео: кадри за часом ---------- */
  if (FRAMES) {
    var n0 = Math.floor(TOTAL * FPS);
    window.AtomDemo = {
      root: root, lang: LANG, chapters: CH, total: TOTAL, text: L,
      seek: function (t) {
        var i = Math.max(1, Math.min(n0, Math.floor(t * FPS) + 1));
        var src = FRAMES + ('00000' + i).slice(-5) + '.jpg';
        if (vid.getAttribute('src') !== src) vid.setAttribute('src', src);
      },
      ready: function () {
        var d = vid.decode ? vid.decode().catch(function () {}) : Promise.resolve();
        return d.then(function () { return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); }); });
      }
    };
    root.dispatchEvent(new CustomEvent('atomdemo:ready'));
    return;
  }

  /* ---------- відтворення ---------- */
  /* reduced motion (на Windows — вимкнені «Ефекти анімації») лише вимикає автозапуск:
     показуємо кнопку відтворення, а не застиглий постер без жодного способу запустити */
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var visible = true, userPaused = !AUTO || reduce, raf = 0;
  var playBtn = root.querySelector('.ad-play');

  function showPlay(on) { root.classList.toggle('is-paused', on); }
  function loop() { paint(vid.currentTime); raf = requestAnimationFrame(loop); }
  function sync() {
    var want = visible && !document.hidden && !userPaused;
    if (want && vid.paused) {
      var p = vid.play();
      // автозапуск заблоковано (енергозбереження, політика браузера) — лишаємо кнопку
      if (p && p.catch) p.catch(function () { showPlay(true); });
    }
    else if (!want && !vid.paused) vid.pause();
    cancelAnimationFrame(raf);
    if (!vid.paused || !BARE) raf = requestAnimationFrame(loop);
  }
  function toggle() { userPaused = !vid.paused; sync(); }
  vid.addEventListener('playing', function () { showPlay(false); sync(); });
  vid.addEventListener('pause', function () { showPlay(true); });
  vid.addEventListener('seeked', function () { paint(vid.currentTime); });
  document.addEventListener('visibilitychange', sync);
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; sync(); }, { threshold: 0.15 }).observe(root);

  for (var i = 0; i < dots.length; i++) (function (i) {
    dots[i].addEventListener('click', function () {
      vid.currentTime = CH[i][1] + 0.05; paint(vid.currentTime);
      userPaused = false; sync();
    });
  })(i);
  vid.addEventListener('click', toggle);
  playBtn.addEventListener('click', toggle);

  paint(0);
  if (userPaused) showPlay(true);
  sync();

  window.AtomDemo = {
    root: root, lang: LANG, chapters: CH, total: TOTAL, text: L, video: vid,
    seek: function (t) { vid.currentTime = t; paint(t); }
  };
  root.dispatchEvent(new CustomEvent('atomdemo:ready'));
})();
