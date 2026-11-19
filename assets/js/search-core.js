/* Търсачката на сайта — самото търсене, без страница и без бутони.
 *
 * Отделено е от search.js нарочно: тази част не пипа DOM и затова се пуска
 * и в Node (tools/test-search.js), където проверяваме с истински български
 * думи — „езера“, „панти“, „пловдив“, сгрешени и с главни букви.
 *
 * Как търси, без да иска точно съвпадение:
 *   · сгъва текста — малки букви, без кавички, тирета и ударения;
 *   · реже българските окончания („планината“ → „планин“), за да намира
 *     „планина“ и обратно;
 *   · приема начало на дума от 3 букви („рил“ → „Рилските“);
 *   · прощава една сгрешена буква при думи от 5, две при думи от 9;
 *   · разбира синоними — „бус“ намира кампанията, „планина“ — събитията
 *     в природата;
 *   · при равни резултати по-новото излиза отгоре, за да е първото издание
 *     на „Панти“ от 2026, а не това от 2019.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SearchCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Окончания, които българският слага отгоре на корена. Режем само при думи
     над 5 букви — иначе „дни“ става „дн“, а „море“ — „мор“. */
  var ENDINGS = ["ията", "ята", "ата", "ите", "ето", "ото", "ове", "еве", "ът", "ят",
                 "та", "то", "те", "ия", "а", "я", "е", "и", "о", "ъ", "й"];

  /* Синоними: какво още може да значи думата. Първата е самата дума. */
  var SYNONYMS = {
    "бус": ["микробус", "транспорт"],
    "кола": ["бус", "транспорт"],
    "кемпер": ["бус"],
    "микробус": ["бус"],
    "дарение": ["дари", "подкрепа", "дарения"],
    "дарения": ["дари", "подкрепа"],
    "дари": ["дарение", "подкрепа"],
    "помощ": ["подкрепа", "доброволец"],
    "доброволец": ["доброволци", "помощ"],
    "доброволци": ["доброволчество", "помощ"],
    "планина": ["природа", "връх"],
    "планината": ["природа", "връх"],
    "природа": ["планина"],
    "езеро": ["езера"],
    "езера": ["езеро"],
    "пещера": ["пещери"],
    "водопад": ["водопади"],
    "поход": ["преход", "разходка"],
    "преход": ["поход"],
    "разходка": ["пикник", "поход"],
    "събитие": ["събития"],
    "събития": ["събитие"],
    "проект": ["проекти"],
    "проекти": ["проект"],
    "новини": ["медии", "публикации"],
    "публикация": ["медии", "новини"],
    "контакт": ["контакти", "телефон"]
  };

  /* Думи, които сочат към категория на събитие, дори да не са в текста му */
  var CATEGORY_HINTS = {
    priroda: ["планина", "планината", "природа", "връх", "езеро", "езера", "пещера",
              "пещери", "водопад", "водопади", "пътека", "поход", "преход", "рила",
              "пирин", "витоша", "сняг"],
    grad: ["град", "града", "софия", "пловдив", "парк", "разходка", "музей"],
    sotsialni: ["социални", "приятели", "общност", "помощ"],
    izkustvo: ["изкуство", "изложба", "рисуване", "музика", "театър"]
  };

  function fold(s) {
    s = String(s == null ? "" : s).toLowerCase();
    s = s.replace(/[\u2018\u2019\u201a\u201b`\u00b4]/g, "'");
    s = s.replace(/[\u201c\u201d\u201e\u00ab\u00bb]/g, '"');
    s = s.replace(/[\u2013\u2014\u2212]/g, "-");
    if (s.normalize) s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    s = s.replace(/[^0-9a-z\u0400-\u04ff\s-]/g, " ");
    return s.replace(/-+/g, " ").replace(/\s+/g, " ").trim();
  }

  function stem(w) {
    if (w.length <= 5) return w;
    for (var i = 0; i < ENDINGS.length; i++) {
      var e = ENDINGS[i];
      if (w.length - e.length >= 4 && w.slice(-e.length) === e) return w.slice(0, -e.length);
    }
    return w;
  }

  function tokens(text) {
    var words = fold(text).split(" ").filter(Boolean);
    var out = [];
    for (var i = 0; i < words.length; i++) out.push({ w: words[i], s: stem(words[i]) });
    return out;
  }

  /* Разстояние с прекъсване: щом мине границата, спираме — не ни трябва точното */
  function edit(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      var rowMin = cur[0];
      for (j = 1; j <= b.length; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > limit) return limit + 1;
      var t = prev; prev = cur; cur = t;
    }
    return prev[b.length];
  }

  /* Колко струва едно съвпадение на дума от заявката в едно поле */
  function wordScore(q, list) {
    var best = 0;
    for (var i = 0; i < list.length; i++) {
      var d = list[i], s = 0;
      if (d.w === q.w) s = 12;
      else if (q.s && d.s === q.s) s = 10;
      else if (q.w.length >= 3 && d.w.lastIndexOf(q.w, 0) === 0) s = 8 + Math.min(2, (d.w.length - q.w.length) * 0.25);
      else if (q.s.length >= 3 && d.s.lastIndexOf(q.s, 0) === 0) s = 6;
      else if (q.w.length >= 4 && d.w.indexOf(q.w) !== -1) s = 4;
      else if (q.w.length >= 5) {
        var limit = q.w.length >= 9 ? 2 : 1;
        if (edit(d.w, q.w, limit) <= limit) s = 3;
      }
      if (s > best) best = s;
      if (best === 12) break;
    }
    return best;
  }

  /* Индексът се приготвя веднъж при зареждане на страницата */
  function prepare(items) {
    var docs = [], vocab = Object.create(null);
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var doc = {
        it: it,
        t: tokens(it.t || ""),
        p: tokens(it.p || ""),
        x: tokens(it.x || ""),
        d: tokens(String(it.d || "").slice(0, 4)),   // само годината
        key: fold(it.t || "")
      };
      docs.push(doc);
      var all = doc.t.concat(doc.p, doc.x);
      for (var j = 0; j < all.length; j++) vocab[all[j].w] = (vocab[all[j].w] || 0) + 1;
    }
    return { docs: docs, vocab: vocab };
  }

  var WEIGHT = { t: 3, p: 1.6, d: 2.2, x: 1 };

  /* Кампанията и проектите са места, на които човек отива — при равно
     съвпадение с обикновено събитие те стоят по-горе („бус“ → кампанията). */
  var KIND_BOOST = { campaign: 4, project: 2, page: 1 };

  function groupFor(w) {
    var syn = SYNONYMS[w];
    if (!syn || !syn.length) return null;
    var group = [{ w: w, s: stem(w) }];
    for (var i = 0; i < syn.length; i++) {
      if (syn[i] !== w) group.push({ w: syn[i], s: stem(syn[i]) });
    }
    return group;
  }

  function scoreDoc(doc, groups, whole, hints) {
    var total = 0;
    for (var g = 0; g < groups.length; g++) {
      var group = groups[g], best = 0;
      for (var a = 0; a < group.length; a++) {
        var q = group[a];
        var s = WEIGHT.t * wordScore(q, doc.t) + WEIGHT.p * wordScore(q, doc.p) +
                WEIGHT.d * wordScore(q, doc.d) + WEIGHT.x * wordScore(q, doc.x);
        if (a > 0) s *= 0.8;                  // синонимът тежи по-малко от точната дума
        if (s > best) best = s;
      }
      if (!best) return 0;                    // всички думи на заявката трябва да намерят нещо
      total += best;
    }
    if (whole) {
      if (doc.key === whole) total += 60;
      else if (doc.key.lastIndexOf(whole, 0) === 0) total += 20;
      else if (doc.key.indexOf(whole) !== -1) total += 8;
    }
    var hint = 0;
    var hintsFor = CATEGORY_HINTS[doc.it.g];
    if (hintsFor) {
      for (var k = 0; k < hints.length; k++) {
        if (hintsFor.indexOf(hints[k].w) !== -1) hint = 5;
      }
    }
    return total + hint + (KIND_BOOST[doc.it.k] || 0);
  }

  function rank(a, b) {
    /* При близки резултати (до 2.5 точки) решава датата, най-новото първо —
       така „панти“ дава изданието от 2026, а не от 2019. */
    if (Math.abs(a.score - b.score) > 2.5) return b.score - a.score;
    if (a.it.d && b.it.d && a.it.d !== b.it.d) return a.it.d < b.it.d ? 1 : -1;
    if (a.it.d && !b.it.d) return -1;
    if (!a.it.d && b.it.d) return 1;
    return a.it.t < b.it.t ? -1 : a.it.t > b.it.t ? 1 : 0;
  }

  function query(index, raw) {
    var started = Date.now();
    var folded = fold(raw);
    var words = tokens(raw);
    if (!folded || !words.length) {
      return { q: String(raw || ""), items: [], total: 0, took: 0, counts: {} };
    }
    var groups = [], hints = [];
    for (var i = 0; i < words.length; i++) {
      var grp = groupFor(words[i].w);
      groups.push(grp || [words[i]]);
      hints.push(words[i]);
    }
    var hits = [];
    var counts = {};
    for (var d = 0; d < index.docs.length; d++) {
      var doc = index.docs[d];
      var score = scoreDoc(doc, groups, folded, hints);
      if (!score) continue;
      hits.push({ it: doc.it, score: Math.round(score * 10) / 10 });
      counts[doc.it.k] = (counts[doc.it.k] || 0) + 1;
    }
    hits.sort(rank);
    return { q: String(raw), items: hits, total: hits.length, counts: counts, took: Date.now() - started };
  }

  /* Търсене с прошка: ако точната заявка не намери нищо, пробваме с поправена
     дума и казваме, че резултатите са за нея. Така „езра“ стига до езерата,
     без търсачката да подменя тихо това, което човек е написал. */
  function search(index, raw) {
    var first = query(index, raw);
    if (first.total || !String(raw || "").trim()) return first;
    var fixed = suggest(index, raw);
    if (!fixed || fixed === fold(raw)) return first;
    var second = query(index, fixed);
    /* Поправката се приема само ако наистина намери нещо — иначе човек вижда
       „няма резултат“ за дума, която не е писал. */
    if (!second.total) return first;
    second.corrected = fixed;
    second.asked = String(raw);
    return second;
  }

  /* „Имаше предвид …?“ — най-близката дума от сайта до сгрешената */
  function suggest(index, raw) {
    var words = tokens(raw);
    if (!words.length) return "";
    var changed = false, out = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i].w;
      var best = "", bestDist = 3;
      if (w.length >= 4 && !index.vocab[w]) {
        for (var v in index.vocab) {
          if (Math.abs(v.length - w.length) > 2) continue;
          if (v[0] !== w[0]) continue;
          var dist = edit(v, w, 2);
          if (dist < bestDist) { bestDist = dist; best = v; }
        }
      }
      if (best) { out.push(best); changed = true; } else out.push(w);
    }
    return changed ? out.join(" ") : "";
  }

  return {
    fold: fold,
    stem: stem,
    tokens: tokens,
    prepare: prepare,
    query: query,
    search: search,
    suggest: suggest,
    SYNONYMS: SYNONYMS
  };
});
