/* Търсачката на сайта — полето, резултатите и празният екран.
 *
 * Работи на две места с един и същ код: в панела от шапката (на всяка страница)
 * и на самата страница search.html. Логиката е в search-core.js, тук е само
 * рисуването.
 *
 * Индексът се тегли само когато някой отвори търсенето — началната страница не
 * плаща за него. Заявката до сървъра е с no-cache: файлът е малък и е по-добре
 * да се презареди, отколкото да покаже стар списък без последното събитие.
 */
(function () {
  "use strict";

  var core = window.SearchCore;
  if (!core) return;

  /* Месеците са написани на ръка, както в ui.js — оттам идват и датите в
     списъците. Тук са повторени, защото търсенето работи и на страници, където
     ui.js не се зарежда (началната например). */
  var MONTHS = ["януари", "февруари", "март", "април", "май", "юни", "юли",
                "август", "септември", "октомври", "ноември", "декември"];

  var KIND = {
    event: { one: "Събитие", many: "Събития", chip: "Събития" },
    campaign: { one: "Кампания", many: "Кампании", chip: "Кампании" },
    project: { one: "Проект", many: "Проекти и инициативи", chip: "Проекти" },
    media: { one: "Публикация", many: "Медии", chip: "Медии" },
    page: { one: "Страница", many: "Страници", chip: "Страници" }
  };
  var KIND_ORDER = ["event", "campaign", "project", "media", "page"];

  var indexes = {};   // адрес → приготвен индекс (приготвя се веднъж)

  function loadIndex(url) {
    if (indexes[url]) return indexes[url];
    indexes[url] = fetch(url, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("индексът не се зареди: " + r.status);
        return r.json();
      })
      .then(function (items) { return core.prepare(items); });
    return indexes[url];
  }

  function dayText(iso) {
    if (!iso) return "";
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return iso;
    var month = MONTHS[parseInt(m[2], 10) - 1];
    return parseInt(m[3], 10) + " " + month + " " + m[1];
  }

  /* Подчертаване: същата дума с до три букви окончание, за да светне и
     „езерата“, когато човек е писал „езера“. */
  function matcher(words) {
    var parts = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (w.length >= 3) parts.push(w + "[а-яa-z]{0,3}");
    }
    if (!parts.length) return null;
    try { return new RegExp("(" + parts.join("|") + ")", "giu"); } catch (e) { return null; }
  }

  function paintText(el, text, re) {
    if (!re) { el.textContent = text; return; }
    re.lastIndex = 0;
    var last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (!m[0]) { re.lastIndex++; continue; }
      if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
      var mk = document.createElement("mark");
      mk.textContent = m[0];
      el.appendChild(mk);
      last = m.index + m[0].length;
    }
    if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
  }

  /* Откъс около първото съвпадение — иначе дългият текст започва от началото
     и човек не вижда защо е излязъл резултатът. */
  function excerpt(text, re) {
    if (!text) return "";
    if (!re) return text.slice(0, 150) + (text.length > 150 ? "…" : "");
    re.lastIndex = 0;
    var m = re.exec(text);
    if (!m) return text.slice(0, 150) + (text.length > 150 ? "…" : "");
    var from = Math.max(0, m.index - 45);
    if (from > 0) {
      var space = text.indexOf(" ", from);
      if (space !== -1 && space < m.index) from = space + 1;
    }
    var to = Math.min(text.length, from + 170);
    if (to < text.length) {
      var cut = text.lastIndexOf(" ", to);
      if (cut > from + 60) to = cut;
    }
    return (from > 0 ? "…" : "") + text.slice(from, to).trim() + (to < text.length ? "…" : "");
  }

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function resultItem(hit, words, re) {
    var it = hit.it;
    var a = node("a", "search-hit");
    a.href = it.u;

    var meta = node("span", "search-meta");
    var kind = KIND[it.k] ? KIND[it.k].one : "";
    var when = dayText(it.d);
    /* Мястото на събитието не се показва — редът е само вид и дата, за да е
       тих. Мястото пак се търси, просто не заема място в резултата. */
    var bits = [kind, when].filter(Boolean);
    if (it.k !== "event" && it.p) bits.push(it.p);
    meta.textContent = bits.join(" · ");
    a.appendChild(meta);

    var title = node("span", "search-title");
    paintText(title, it.t, re);
    a.appendChild(title);

    var text = excerpt(it.x || "", re);
    if (text) {
      var p = node("span", "search-text");
      paintText(p, text, re);
      a.appendChild(p);
    }
    return a;
  }

  /* ── рисуване ───────────────────────────────────────────────────────────── */

  function render(mount, state) {
    var box = mount.results;
    var countBox = mount.count;
    var filters = mount.filters;
    box.textContent = "";

    if (!state.q) {
      if (countBox) countBox.textContent = "";
      if (filters) filters.hidden = true;
      renderIdle(mount);
      return;
    }

    var res = state.res;
    if (countBox) {
      if (res.corrected) {
        countBox.textContent = "Показани са резултати за „" + res.corrected + "“ (вместо „" + res.asked + "“).";
      } else if (res.total) {
        var n = state.filter ? (res.counts[state.filter] || 0) : res.total;
        var where = state.filter && KIND[state.filter] ? " в „" + KIND[state.filter].many + "“" : "";
        countBox.textContent = n + " " + (n === 1 ? "резултат" : "резултата") + where + " за „" + res.q.trim() + "“";
      } else {
        countBox.textContent = "Няма резултат за „" + res.q.trim() + "“.";
      }
    }
    if (filters) paintFilters(filters, mount, state);

    if (!res.total) { renderEmpty(mount, res); return; }

    var words = core.tokens(res.q).map(function (t) { return t.w; });
    if (res.corrected) words = core.tokens(res.corrected).map(function (t) { return t.w; });
    var re = matcher(words);

    /* Един списък по сила на съвпадението, не по вид: кампанията за буса трябва
       да излезе първа при „бус“, а не под заглавие „Събития“. Видът се вижда в
       първия ред на всеки резултат, филтрите горе го стесняват. */
    var list = node("ol", "search-list");
    var shown = 0, matching = 0, cap = mount.cap || 0;
    for (var i = 0; i < res.items.length; i++) {
      var hit = res.items[i];
      if (state.filter && hit.it.k !== state.filter) continue;
      matching++;
      if (cap && shown >= cap) continue;
      var li = node("li", "search-item");
      li.appendChild(resultItem(hit, words, re));
      list.appendChild(li);
      shown++;
    }
    box.appendChild(list);

    if (cap && matching > shown) {
      var more = node("a", "search-more", "Всички " + matching + " резултата за „" + res.q.trim() + "“");
      more.href = mount.page + "?q=" + encodeURIComponent(res.q.trim());
      box.appendChild(more);
    }
  }

  function paintFilters(box, mount, state) {
    box.textContent = "";
    /* Филтърът има смисъл само когато резултатите са от повече от един вид —
       иначе е ред с две еднакви числа. */
    var kinds = 0;
    for (var i = 0; i < KIND_ORDER.length; i++) if (state.res.counts[KIND_ORDER[i]]) kinds++;
    if (state.res.total < 2 || kinds < 2) { box.hidden = true; return; }
    box.hidden = false;

    function chip(kind, label, count) {
      var b = node("button", "search-chip", label + " " + count);
      b.type = "button";
      b.setAttribute("aria-pressed", state.filter === kind ? "true" : "false");
      if (state.filter === kind) b.classList.add("is-active");
      b.addEventListener("click", function () {
        state.filter = state.filter === kind ? "" : kind;
        mount.run(true);
      });
      return b;
    }

    if (state.res.counts) {
      box.appendChild(chip("", "Всички", state.res.total));
      for (var k = 0; k < KIND_ORDER.length; k++) {
        var kind = KIND_ORDER[k];
        var n = state.res.counts[kind] || 0;
        if (n) box.appendChild(chip(kind, KIND[kind].chip, n));
      }
    }
  }

  /* Празна заявка: страницата остава само със заглавието и полето — без
     подсказки и без карти, както е поискано. */
  function renderIdle(mount) {
    mount.results.textContent = "";
  }

  /* Няма резултат: остава само редът с броя — без списъци и подсказки. */
  function renderEmpty() {}

  function stateIndex(mount) { return mount.index; }

  /* ── едно място за търсене (панел или страница) ─────────────────────────── */

  function mountSearch(root, opts) {
    opts = opts || {};
    var input = root.querySelector("[data-search-input]");
    var results = root.querySelector("[data-search-results]");
    if (!input || !results) return null;

    var mount = {
      root: opts.prefix || "",
      page: (opts.prefix || "") + "search.html",
      input: input,
      results: results,
      count: root.querySelector("[data-search-count]"),
      filters: root.querySelector("[data-search-filters]"),
      cap: opts.cap || 0,
      index: null,
      state: { q: "", res: null, filter: "" }
    };

    var timer = null;
    var lastQ = "";

    /* Смяната на адреса е само на страницата — в панела тя би объркала
       историята на браузъра и „назад“ щеше да връща към търсения. */
    function syncUrl(q) {
      if (!opts.syncUrl || !window.history || !window.history.replaceState) return;
      var u = new URL(window.location.href);
      if (q) u.searchParams.set("q", q); else u.searchParams.delete("q");
      if (mount.state.filter) u.searchParams.set("kind", mount.state.filter);
      else u.searchParams.delete("kind");
      window.history.replaceState(null, "", u.toString());
    }

    function show() {
      var q = input.value.trim();
      lastQ = q;
      if (!q) {
        mount.state = { q: "", res: null, filter: "" };
        render(mount, mount.state);
        if (opts.onEmpty) opts.onEmpty();
        syncUrl("");
        return;
      }
      loadIndex(opts.index).then(function (index) {
        if (input.value.trim() !== q) return;      // междувременно е дописал
        mount.index = index;
        var res = core.search(index, q);
        if (mount.state.filter && !(res.counts[mount.state.filter] > 0)) mount.state.filter = "";
        mount.state = { q: q, res: res, filter: mount.state.filter };
        render(mount, mount.state);
        syncUrl(q);
        if (opts.onResults) opts.onResults(res);
      }).catch(function () {
        mount.results.textContent = "";
        mount.results.appendChild(node("p", "search-empty-lead",
          "Търсенето не се зареди. Провери връзката и опитай пак."));
      });
    }
    mount.run = show;
    mount.ask = function (q) { input.value = q; show(); };

    input.addEventListener("input", function () {
      var q = input.value.trim();
      if (timer) clearTimeout(timer);
      if (!q) { show(); return; }
      if (q.length < 2 && lastQ.length > q.length) { show(); return; }
      timer = setTimeout(show, q.length < 3 ? 260 : 120);
    });

    var form = root.querySelector("[data-search-form]");
    if (form) {
      form.addEventListener("submit", function (e) {
        if (!opts.preventSubmit) return;   // на страницата формата работи и без JS
        e.preventDefault();
        show();
      });
    }

    return mount;
  }

  /* ── полето в шапката ──────────────────────────────────────────────────── */

  var box = document.querySelector("[data-header-search]");
  if (box) {
    var toggle = box.querySelector("[data-search-toggle]");
    var field = box.querySelector("[data-header-search-input]");
    var headerForm = box.querySelector("form");

    var header = document.querySelector("[data-header]");
    var keyboard = false;
    document.addEventListener("keydown", function () { keyboard = true; }, true);
    document.addEventListener("pointerdown", function () { keyboard = false; }, true);

    /* Колко широко да се отвори полето: от бутона до края на менюто, за да не
       застъпва надписите. На тесен екран (под 1025) менюто го няма и полето
       взима пълната си ширина. */
    var fitWidth = function () {
      var nav = document.querySelector(".nav");
      var room = 340;
      var overlay = false;
      if (nav && nav.getBoundingClientRect().width > 0) {
        room = Math.floor(box.getBoundingClientRect().left - nav.getBoundingClientRect().right - 16);
        /* Ако между менюто и лупата няма място за цялото поле (под ~1440),
           то не слиза на втори ред и не свива до 200px, а ляга отгоре на
           последните менюта — „За нас“ и „Контакти“. */
        overlay = room < 340;
      }
      box.classList.toggle("is-over", overlay);
      box.style.setProperty("--search-w", "340px");
    };

    /* iOS връща страницата в началото, когато фокусът влезе в поле в лепкавата
       шапка: браузърът scrollва към мястото на шапката в документа. preventScroll
       сам не стига (и не се поддържа навсякъде), затова след отваряне пазим
       позицията ~0.8 сек — докато клавиатурата се вдигне — и я връщаме, ако
       скочи. Ако човекът сам плъзне, пазачът спира веднага. */
    var holdScroll = function () {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var stopped = false;
      var stop = function () { stopped = true; };
      window.addEventListener("touchmove", stop, { passive: true, once: true });
      window.addEventListener("wheel", stop, { passive: true, once: true });
      var restore = function () {
        if (stopped) return;
        var here = window.pageYOffset || document.documentElement.scrollTop || 0;
        if (Math.abs(here - y) > 2) window.scrollTo(0, y);
      };
      /* Няколко проверки вместо безкраен кадър: скокът идва с вдигането на
         клавиатурата, тоест в първите няколкостотин милисекунди. */
      [0, 60, 140, 260, 420, 650].forEach(function (ms) { setTimeout(restore, ms); });
    };

    /* На телефон (без истински hover) не даваме автофокус: iOS връща страницата
       нагоре, когато фокус влезе в поле в лепкавата шапка. Полето се отваря и
       човекът го докосва сам — тогава клавиатурата идва без скок. */
    var touchOnly = window.matchMedia && window.matchMedia("(hover: none)").matches;

    /* Прозрачен слой под полето: поема докосването извън него, за да не
       „светва“ картата отдолу. */
    var scrim = document.createElement("div");
    scrim.className = "search-scrim";
    scrim.setAttribute("aria-hidden", "true");
    document.body.appendChild(scrim);

    /* Затварящото докосване остава „глухо“ само за себе си. Страницата се
       отваря веднага щом пръстът се вдигне; изяжда се само click-ът на това
       едно докосване — той може да дойде и по-късно от вдигането. Следващото
       докосване започва на чисто, затова проблясъкът работи нормално. */
    var tapGuard = null;
    var endGuard = function (keepState) {
      if (!keepState) {
        document.body.classList.remove("search-frozen");
        document.body.classList.remove("search-hold");
      }
      if (!tapGuard) return;
      document.removeEventListener("click", tapGuard, true);
      tapGuard = null;
    };
    /* Ново докосване = чист лист: каквото е останало от предишното, пада
       още преди то да стигне до страницата. */
    document.addEventListener("pointerdown", function () {
      endGuard(box.classList.contains("is-open"));
    }, true);

    var holdThroughTap = function () {
      scrim.classList.add("is-on");
      document.body.classList.add("search-frozen");
      document.body.classList.add("search-hold");
      var swallow = function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        endGuard();
      };
      if (tapGuard) document.removeEventListener("click", tapGuard, true);
      tapGuard = swallow;
      document.addEventListener("click", swallow, true);
      /* Слоят пада при вдигане на пръста — иначе следващото докосване
         улучва него и не прави нищо. */
      var releasePage = function () {
        scrim.classList.remove("is-on");
        document.body.classList.remove("search-hold");
      };
      window.addEventListener("pointerup", releasePage, { once: true });
      window.setTimeout(releasePage, 400);
    };

    scrim.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      closeSearch();
      holdThroughTap();
    }, { capture: true });

    var openSearch = function () {
      fitWidth();
      box.classList.add("is-open");
      if (header) header.classList.add("is-searching");
      toggle.setAttribute("aria-expanded", "true");
      field.tabIndex = 0;
      scrim.classList.add("is-on");
      document.body.classList.add("search-frozen");
      document.body.classList.add("search-hold");
      if (touchOnly) return;
      holdScroll();

      /* Фокусът се дава чак след като „хапчето“ се е разтворило. Докато полето
         е с ширина 46px и е изрязано (overflow: hidden), iOS scrollва към него,
         за да го „покаже“ — и това е скокът към началото на страницата. */
      var focused = false;
      var focusField = function () {
        if (focused) return;
        focused = true;
        try { field.focus({ preventScroll: true }); } catch (err) { field.focus(); }
      };
      headerForm.addEventListener("transitionend", focusField, { once: true });
      setTimeout(focusField, 340);
    };

    var closeSearch = function (returnFocus) {
      box.classList.remove("is-open");
      if (header) header.classList.remove("is-searching");
      toggle.setAttribute("aria-expanded", "false");
      field.tabIndex = -1;
      scrim.classList.remove("is-on");
      document.body.classList.remove("search-frozen");
      document.body.classList.remove("search-hold");
      /* Всеки фокус в полето/лупата се маха, иначе след докосване остава
         подсветка (кант на полето, син кант на бутона). */
      var active = document.activeElement;
      if (active && box.contains(active) && active.blur) active.blur();
      if (returnFocus && keyboard) toggle.focus();
      else if (toggle.blur) toggle.blur();
    };

    /* Първото натискане отваря полето, второто праща. Празно поле се затваря —
       иначе лупата изглежда счупена. */
    toggle.addEventListener("click", function (e) {
      if (!box.classList.contains("is-open")) {
        e.preventDefault();
        openSearch();
        return;
      }
      if (!field.value.trim()) {
        e.preventDefault();
        closeSearch(true);
      }
    });

    field.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSearch(true);
      }
    });

    headerForm.addEventListener("submit", function (e) {
      if (!field.value.trim()) {
        e.preventDefault();
        closeSearch(true);
      }
    });

    document.addEventListener("pointerdown", function (e) {
      /* Докосването върху слоя се обработва от самия слой: иначе този
         манипулатор затваря полето пръв и слоят изчезва преди своя ход. */
      if (e.target === scrim) return;
      if (!box.classList.contains("is-open") || box.contains(e.target)) return;
      closeSearch();
      /* Това докосване само затваря полето — не натиска картата отдолу:
         нито клик, нито фокус, нито подсветка. */
      e.preventDefault();
      e.stopPropagation();
      holdThroughTap();
    }, true);

    window.addEventListener("resize", function () {
      if (box.classList.contains("is-open")) fitWidth();
    });
  }

  /* ── страницата search.html ─────────────────────────────────────────────── */

  var pageRoot = document.querySelector("[data-search-page]");
  if (pageRoot) {
    var pageMount = mountSearch(pageRoot, {
      index: pageRoot.getAttribute("data-index"),
      prefix: pageRoot.getAttribute("data-root") || "",
      syncUrl: true,
      cap: 0
    });

    if (pageMount) {
      var params = new URLSearchParams(window.location.search);
      var q = params.get("q") || "";
      var kind = params.get("kind") || "";
      if (kind) pageMount.state.filter = kind;
      if (q) {
        pageMount.input.value = q;
        pageMount.run();
      } else {
        render(pageMount, pageMount.state);
        /* Същото като при лупата в шапката: на телефон автофокусът вдига
           клавиатурата и дърпа страницата, затова там не пипаме фокуса. */
        var touchPage = window.matchMedia && window.matchMedia("(hover: none)").matches;
        if (!touchPage && pageMount.input && document.activeElement !== pageMount.input) {
          try { pageMount.input.focus({ preventScroll: true }); } catch (err) { pageMount.input.focus(); }
        }
      }
    }
  }
})();
