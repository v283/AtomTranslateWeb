/* Відео-обгортка для phone demo (стиль за ATOM-STYLE.md): теми paper → navy → mint → sand, hero-градієнт на початку й у CTA.
   В екрані телефона — кадри змонтованого запису справжнього застосунку (assets/demo/…, режим data-frames).
   Керується одним master-таймлайном; кадри рендеряться покадровим seek (render.mjs). */
(function () {
  var qs = new URLSearchParams(location.search);
  var FMT = qs.get('fmt') === '9x16' ? '9x16' : '16x9';
  var LANG = qs.get('lang') === 'en' ? 'en' : 'uk';
  var W = FMT === '16x9' ? 1920 : 1080, H = FMT === '16x9' ? 1080 : 1920;
  var stage = document.getElementById('stage');
  stage.style.width = W + 'px'; stage.style.height = H + 'px';
  stage.className = FMT === '16x9' ? 'f169' : 'f916';

  function start() {
    var D = window.AtomDemo;
    var T0 = 2.6, DUR = D.total;
    var at = function (d) { return T0 + d; };
    var C = {}; D.chapters.forEach(function (c) { C[c[0]] = { s: c[1], e: c[2] }; });
    var MODES = ['flashcards', 'quiz', 'writing', 'matching', 'truefalse', 'listening'];
    var MS = MODES.map(function (k) { return C[k].s; }), MEND = C.listening.e;
    var CTA_FRAME = C.library.e - 1.6; // сторінка секції з плитками режимів

    var TXT = {
      uk: { intro: ['Atom Translate', 'Безкоштовно вивчай слова'], A: ['Переклад', 'Перекладай слова'], B: ['Бібліотека', 'Зберігай у папки'], mode: 'Режим', D: ['Рейтинг', 'Змагайся в рейтингу'], E: ['Прогрес', 'Стеж за прогресом'], F: ['Фото', 'Слова зі світлини'], G: ['Quizlet', 'Імпорт із Quizlet'], out: ['Безкоштовно вивчай слова', 'Спробуйте безкоштовно'] },
      en: { intro: ['Atom Translate', 'Learn words for free'], A: ['Translate', 'Translate any word'], B: ['Library', 'Save to folders'], mode: 'Mode', D: ['Leaderboard', 'Race the leaderboard'], E: ['Progress', 'Track your progress'], F: ['Photo', 'Words from a picture'], G: ['Quizlet', 'Import from Quizlet'], out: ['Learn words for free', 'Try it free'] }
    }[LANG];
    var modes = D.text.modes;

    /* геометрія телефона */
    var k = FMT === '16x9' ? 1.1 : 1.5;
    var cy = FMT === '16x9' ? 540 : 1267;
    var cxR = FMT === '16x9' ? 1400 : 540, cxL = FMT === '16x9' ? 520 : 540;
    var pw = document.querySelector('.pw');
    var pos = function (cx, c, dy) { return { x: cx - 207, y: (c || cy) - 418 + (dy || 0) }; };
    gsap.set(pw, { transformOrigin: '50% 50%', scale: k, rotation: -8 });
    gsap.set(pw, { x: pos(cxR).x, y: pos(cxR).y + H });

    /* фони */
    var bgDefs = [['hero', 0], ['paper', at(0)], ['navy', at(C.library.s)], ['mint', at(C.flashcards.s)], ['sand', at(C.leaderboard.s)], ['paper', at(C.progress.s)], ['navy', at(C.import.s)], ['sand', at(C.quizlet.s)], ['hero', at(DUR) - 0.2]];
    var bgsEl = document.getElementById('bgs');
    var bgs = bgDefs.map(function (d, i) { var e = document.createElement('div'); e.className = 'bg'; e.setAttribute('data-theme', d[0]); bgsEl.appendChild(e); if (i) gsap.set(e, { autoAlpha: 0 }); return e; });

    /* тексти */
    var scs = document.getElementById('scs');
    function mk(theme, html, phoneSide, cls) {
      var e = document.createElement('div');
      e.className = 'sc' + (cls ? ' ' + cls : ''); e.setAttribute('data-theme', theme); e.innerHTML = html;
      if (FMT === '16x9') e.style.left = (phoneSide === 'R' ? 150 : 1000) + 'px';
      scs.appendChild(e); return e;
    }
    var kk = function (a, b) { return '<div class="kick"><span>' + a + '</span></div><div class="ttl">' + b + '</div>'; };
    var scIntro = mk('hero', '<img class="logo" src="../appicon.png" alt=""><div class="ttl">' + TXT.intro[0] + '</div><div class="sub">' + TXT.intro[1] + '</div>', 'R');
    var scA = mk('paper', kk(TXT.A[0] + ' · 30+ ' + (LANG === 'uk' ? 'мов' : 'languages'), TXT.A[1]), 'R');
    var scB = mk('navy', kk(TXT.B[0], TXT.B[1]), 'L');
    var kickSp = modes.map(function (m, i) { return '<span>' + TXT.mode + ' ' + (i + 1) + ' / 6</span>'; }).join('');
    var ttlSp = modes.map(function (m) { return '<span>' + m + '</span>'; }).join('');
    var chips = modes.map(function (m) { return '<span class="chip">' + m + '</span>'; }).join('');
    var scC = mk('mint', '<div class="kick">' + kickSp + '</div><div class="ttl stack">' + ttlSp + '</div><div class="chips">' + chips + '</div>', 'R');
    var scD = mk('sand', kk(TXT.D[0], TXT.D[1]), 'L');
    var scE = mk('paper', kk(TXT.E[0], TXT.E[1]), 'R');
    var scF = mk('navy', kk(TXT.F[0], TXT.F[1]), 'L');
    var scG = mk('sand', kk(TXT.G[0], TXT.G[1]), 'R');
    var scOut = mk('hero', '<div class="ttl">' + TXT.out[0] + '</div><div class="sub">' + TXT.out[1] + '</div><div class="url">atomtranslate.com</div><div class="pills"><span class="pill">iOS</span><span class="pill">Android</span><span class="pill">Web</span></div>', 'R', 'out');

    var M = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });

    /* фони */
    bgDefs.forEach(function (d, i) { if (i) M.fromTo(bgs[i], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'power1.inOut', immediateRender: false }, d[1] - 0.25); });

    /* текст in/out */
    var offY = FMT === '16x9' ? 0 : 46;
    function showSc(el, tin, tout, side) {
      var dx = FMT === '16x9' ? (side === 'R' ? -70 : 70) : 0;
      M.fromTo(el, { autoAlpha: 0, x: dx, y: offY }, { autoAlpha: 1, x: 0, y: 0, duration: 0.6, immediateRender: false }, tin);
      if (tout) M.to(el, { autoAlpha: 0, x: -dx * 0.6, y: -offY * 0.5, duration: 0.4, ease: 'power2.in' }, tout);
    }
    gsap.set([scIntro, scA, scB, scC, scD, scE, scF, scG, scOut], { autoAlpha: 0 });
    showSc(scIntro, 0.25, T0 - 0.3, 'R');
    showSc(scA, at(0.2), at(C.translate.e) - 0.35, 'R');
    showSc(scB, at(C.library.s) + 0.1, at(C.library.e) - 0.35, 'L');
    showSc(scC, at(C.flashcards.s) + 0.1, at(MEND) - 0.35, 'R');
    showSc(scD, at(C.leaderboard.s) + 0.1, at(C.leaderboard.e) - 0.35, 'L');
    showSc(scE, at(C.progress.s) + 0.1, at(C.progress.e) - 0.35, 'R');
    showSc(scF, at(C.import.s) + 0.1, at(C.import.e) - 0.35, 'L');
    showSc(scG, at(C.quizlet.s) + 0.1, at(DUR) - 0.45, 'R');
    showSc(scOut, at(DUR) + 0.45, null, 'R');

    /* режими: заголовок, кікер, чіпси */
    var kSp = scC.querySelectorAll('.kick > span'), tSp = scC.querySelectorAll('.ttl > span'), cEl = scC.querySelectorAll('.chip');
    gsap.set([kSp, tSp], { autoAlpha: 0 });
    gsap.set(cEl, { backgroundColor: 'var(--chip)' });
    MS.forEach(function (t0, i) {
      var tin = i === 0 ? at(t0) + 0.2 : at(t0) - 0.15;
      var tout = i < 5 ? at(MS[i + 1]) - 0.4 : null;
      [kSp[i], tSp[i]].forEach(function (s) {
        M.fromTo(s, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.35, immediateRender: false }, tin);
        if (tout) M.to(s, { autoAlpha: 0, y: -26, duration: 0.25, ease: 'power2.in' }, tout);
      });
      M.to(cEl[i], { backgroundColor: '#0f2347', color: '#ffffff', duration: 0.25 }, tin);
      if (i < 5) M.to(cEl[i], { backgroundColor: '#c6e8cd', color: '#27466e', duration: 0.25 }, tout + 0.1);
    });

    /* телефон: виїзд, зміна сторін, відліт/повернення */
    M.to(pw, { y: pos(cxR).y, rotation: 0, duration: 1.3, ease: 'power3.out' }, 0.45);
    var sides = [[0, 'R'], [C.library.s, 'L'], [C.flashcards.s, 'R'], [C.leaderboard.s, 'L'], [C.progress.s, 'R'], [C.import.s, 'L'], [C.quizlet.s, 'R']];
    if (FMT === '16x9') sides.forEach(function (s, i) { if (i) M.to(pw, { x: pos(s[1] === 'R' ? cxR : cxL).x, duration: 0.85, ease: 'power3.inOut' }, at(s[0]) - 0.2); });
    else sides.forEach(function (s, i) { if (i) { M.to(pw, { rotation: (i % 2 ? 1 : -1) * 1.6, y: pos(cxR).y - 12, duration: 0.8, ease: 'sine.inOut' }, at(s[0]) - 0.2); } });
    // відліт перед CTA; повернення під кутом на кадрі з плитками режимів
    M.to(pw, { y: pos(cxR).y + H, rotation: 6, duration: 0.55, ease: 'power2.in' }, at(DUR) - 0.25);
    // час у змонтованому записі за часом master-таймлайна (детерміновано для будь-якого seek)
    var demoTime = function (t) { return t < T0 ? 0.13 : t < at(DUR) ? Math.min(DUR - 0.001, t - T0) : t < at(DUR) + 0.1 ? DUR - 0.001 : CTA_FRAME; };
    M.eventCallback('onUpdate', function () { D.seek(demoTime(M.time())); });
    M.set(pw, { x: pos(cxR).x, rotation: 8 }, at(DUR) + 0.1);
    var oy = FMT === '16x9' ? -28 : 36, ok = FMT === '16x9' ? 1 : 0.96;
    M.set(pw, { scale: k * ok }, at(DUR) + 0.1);
    M.to(pw, { y: pos(cxR, cy + oy).y, x: pos(cxR).x, rotation: FMT === '16x9' ? -7 : -3, duration: 1.0, ease: 'power3.out' }, at(DUR) + 0.4);
    M.to(pw, { rotation: FMT === '16x9' ? -4 : -1.5, scale: k * ok * 1.05, duration: 2.6, ease: 'sine.inOut' }, at(DUR) + 1.4); // повільний push-in

    var TOTAL = at(DUR) + 4.2;
    M.to({}, { duration: 0.001 }, TOTAL - 0.001);
    window.VID = { M: M, total: M.duration(), W: W, H: H, fmt: FMT, lang: LANG };
    M.time(0, false);
    document.body.setAttribute('data-ready', '1');
  }

  function wait() {
    if (window.AtomDemo) { D0(); } else document.getElementById('atom-demo').addEventListener('atomdemo:ready', D0, { once: true });
    function D0() { requestAnimationFrame(start); }
  }
  wait();
})();
