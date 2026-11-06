/* Адреси на събитията — /events/<slug>.html
 *
 * Едно място, което решава как се казва страницата на всяко събитие.
 * Работи и в браузъра (window.ELAITI_EVENT_URLS), и в Node (module.exports),
 * без DOM и без други библиотеки — затова го ползват и страницата, и
 * генераторът на статични файлове, и пренасочването на старите ?event= адреси.
 *
 *   var map = ELAITI_EVENT_URLS.buildEventUrlMap(window.ELAITI_EVENTS);
 *   map.events[0].url          // "https://elaiti.com/events/nikola-run.html"
 *   map.resolve("nikola-run")  // записът за събитието (или null)
 *   map.pathFor("skakavitsa")  // "/events/skakavitsa.html"
 *
 * Подробно описание: docs/event-urls.md
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module && module.exports) { module.exports = api; }
  if (root) { root.ELAITI_EVENT_URLS = api; }
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function (root) {
  "use strict";

  /* Основният адрес на сайта. Може да се смени с ELAITI_SITE_BASE_URL
     (среда) или с window.ELAITI_SITE_BASE_URL (страница), или със
     зададения изрично baseUrl при buildEventUrlMap. */
  var DEFAULT_BASE_URL = "https://elaiti.com";
  var EVENT_PATH_PREFIX = "/events/";
  var EVENT_SUFFIX = ".html";
  var MAX_SLUG_LENGTH = 80;

  /* Официална опростена транслитерация на българската азбука.
     ѐ/ѝ се пишат и като е/и с ударение — взимаме ги изрично, преди
     нормализирането да ги разложи на две букви. */
  var CYR_SOURCE = "а=a б=b в=v г=g д=d е=e ж=zh з=z и=i й=y к=k л=l м=m н=n " +
                   "о=o п=p р=r с=s т=t у=u ф=f х=h ц=ts ч=ch ш=sh щ=sht ъ=a ь=y ю=yu я=ya " +
                   "ѐ=e ѝ=i ё=e";
  var CYR = (function () {
    var map = {}, pairs = CYR_SOURCE.split(" "), i, pair;
    for (i = 0; i < pairs.length; i++) {
      pair = pairs[i].split("=");
      map[pair[0]] = pair[1];
    }
    return map;
  })();

  function hasText(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
  }

  /* ── slug ─────────────────────────────────────────────────────────────── */

  /* Прави от произволен текст адрес: малки латински букви, цифри и тирета.
     „София и за мен“ → "sofiya-i-za-men", „Nikola's Run“ → "nikolas-run".
     Редът е важен: кирилицата се заменя ПРЕДИ нормализирането, иначе
     „й“ се разлага на „и“ + знак и се губи. */
  function slugify(value) {
    if (value === null || value === undefined) { return ""; }

    var text = String(value).toLowerCase();
    text = text.replace(/[\u0400-\u04ff]/g, function (ch) { return CYR[ch] || ""; });
    if (typeof text.normalize === "function") { text = text.normalize("NFKD"); }
    text = text.replace(/[\u0300-\u036f]/g, "");       // диакритика в латиница (Café, Über)
    text = text.replace(/['"’‘`´]/g, "");              // апострофи и кавички изчезват
    text = text.replace(/[^a-z0-9]+/g, "-");
    text = text.replace(/^-+|-+$/g, "");

    if (text.length > MAX_SLUG_LENGTH) {
      text = text.slice(0, MAX_SLUG_LENGTH);
      var cut = text.lastIndexOf("-");
      if (cut > 0) { text = text.slice(0, cut); }
      text = text.replace(/-+$/g, "");
    }
    return text;
  }

  function temporarySlug(record, index) {
    var day = typeof record.start === "string" ? record.start.slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { day = ""; }
    return "event-" + (day || String(index + 1));
  }

  /* ── базов адрес ──────────────────────────────────────────────────────── */

  function resolveBaseUrl(explicit) {
    var value = explicit;
    if (!hasText(value) && typeof process !== "undefined" && process && process.env) {
      value = process.env.ELAITI_SITE_BASE_URL;
    }
    if (!hasText(value) && root && typeof root.ELAITI_SITE_BASE_URL === "string") {
      value = root.ELAITI_SITE_BASE_URL;
    }
    value = hasText(value) ? String(value).trim() : DEFAULT_BASE_URL;
    value = value.replace(/\/+$/, "");
    if (!value) { value = DEFAULT_BASE_URL; }
    if (!/^https?:\/\//i.test(value)) { value = "https://" + value.replace(/^\/+/, ""); }
    return value;
  }

  /* ── карта на адресите ────────────────────────────────────────────────── */

  function addUntil(list, value) {
    if (!hasText(value)) { return; }
    var text = String(value).trim();
    if (list.indexOf(text) === -1) { list.push(text); }
  }

  /* Ключове, по които се разпознава един стар идентификатор:
     както е записан и във вида, в който го прави slugify. */
  function legacyKeys(value) {
    var keys = [];
    addUntil(keys, String(value).trim().toLowerCase());
    addUntil(keys, slugify(value));
    return keys;
  }

  /* events — масивът от events-data.js; options.baseUrl — основният адрес.
     Връща обект с по един запис на събитие и обратни карти. */
  function buildEventUrlMap(events, options) {
    options = options || {};
    var baseUrl = resolveBaseUrl(options.baseUrl);
    var list = Array.isArray(events) ? events : [];
    var entries = [];
    var bySlug = {};
    var byLegacyId = {};
    var warnings = [];
    var usedSlugs = {};
    var i, j;

    for (i = 0; i < list.length; i++) {
      if (!list[i] || typeof list[i] !== "object" || Array.isArray(list[i])) {
        warnings.push("Запис #" + (i + 1) + " не е обект — пропуснат");
        continue;
      }
      var record = list[i];
      var title = typeof record.title === "string" ? record.title.trim() : "";
      var rawId = typeof record.slug === "string" ? record.slug.trim() : "";

      var slug = slugify(rawId);
      var slugSource = slug ? "slug" : "";

      if (!slug) {
        slug = slugify(title);
        if (slug) { slugSource = "title"; }
      }

      if (!slug) {
        slug = temporarySlug(record, i);
        slugSource = "fallback";
        warnings.push("Запис #" + (i + 1) + " е без slug и без заглавие — даваме временен адрес " +
                      EVENT_PATH_PREFIX + slug + EVENT_SUFFIX);
      }

      /* Повторен адрес: първият запис го запазва, следващите получават -2, -3…
         Така един и същ вход винаги дава една и съща карта. */
      var wanted = slug;
      var n = 2;
      while (usedSlugs[slug]) {
        slug = wanted + "-" + n;
        n += 1;
      }
      var slugCollided = slug !== wanted;
      if (slugCollided) {
        warnings.push("Повторен адрес " + EVENT_PATH_PREFIX + wanted + EVENT_SUFFIX +
                      " при запис #" + (i + 1) + " — става " + EVENT_PATH_PREFIX + slug + EVENT_SUFFIX);
      }
      usedSlugs[slug] = true;

      var legacyIds = [];
      addUntil(legacyIds, rawId);
      if (Array.isArray(record.aliases)) {
        for (j = 0; j < record.aliases.length; j++) { addUntil(legacyIds, record.aliases[j]); }
      }

      entries.push({
        slug: slug,
        title: title,
        start: typeof record.start === "string" ? record.start : "",
        path: EVENT_PATH_PREFIX + slug + EVENT_SUFFIX,
        url: baseUrl + EVENT_PATH_PREFIX + slug + EVENT_SUFFIX,
        relativePath: "events/" + slug + EVENT_SUFFIX,
        slugSource: slugSource,
        legacyIds: legacyIds,
        index: i,
        record: record
      });
      bySlug[slug] = entries[entries.length - 1];

      /* Обратна карта: всеки стар идентификатор сочи към новия slug.
         Първият запис печели; вторият остава с предупреждение. */
      for (j = 0; j < legacyIds.length; j++) {
        var keys = legacyKeys(legacyIds[j]);
        for (var k = 0; k < keys.length; k++) {
          var key = keys[k];
          if (!key) { continue; }
          if (byLegacyId[key] && byLegacyId[key] !== slug) {
            /* Ако и адресът е бил повторен, разминаването вече е съобщено. */
            if (slugCollided && legacyIds[j] === rawId) { continue; }
            warnings.push("Идентификаторът \"" + legacyIds[j] + "\" вече сочи към " + byLegacyId[key] +
                          " — запис #" + (i + 1) + " не го презаписва");
            continue;
          }
          byLegacyId[key] = slug;
        }
      }
    }

    var map = {
      baseUrl: baseUrl,
      pattern: EVENT_PATH_PREFIX + "{slug}" + EVENT_SUFFIX,
      events: entries,
      bySlug: bySlug,
      byLegacyId: byLegacyId,
      warnings: warnings
    };

    /* Удобни методи върху самата карта (не влизат в JSON). */
    map.entry = function (id) { return resolveEvent(map, id); };
    map.resolve = map.entry;
    map.pathFor = function (id) { var found = map.entry(id); return found ? found.path : null; };
    map.urlFor = function (id) { var found = map.entry(id); return found ? found.url : null; };

    return map;
  }

  /* ── обратно търсене ──────────────────────────────────────────────────── */

  /* "/events/x.html", "events/x.html", "/ela-i-ti/events/x.html" → "x" */
  function slugFromPath(pathname) {
    if (!hasText(pathname)) { return ""; }
    var path = String(pathname).split("#")[0].split("?")[0].trim().toLowerCase();
    var found = path.match(/(?:^|\/)events\/([^\/]+?)\.html$/);
    return found ? found[1] : "";
  }

  /* Стар идентификатор (?event=<id>) или път → записът от картата, или null.
     Понеже пази и вече-статичния адрес, пренасочването не може да влезе в цикъл:
     ако входът вече е /events/<slug>.html, връщаме същия запис и се вижда,
     че path е същият като входа. */
  function resolveEvent(map, id) {
    if (!map || id === null || id === undefined) { return null; }

    var raw = String(id);
    try { raw = decodeURIComponent(raw); } catch (error) { /* оставяме както е */ }
    raw = raw.trim();
    if (!raw) { return null; }

    var candidates = [];
    addUntil(candidates, raw.toLowerCase());
    addUntil(candidates, slugFromPath(raw));
    var stripped = raw.replace(/^\.?\//, "").replace(/^events\//i, "")
                      .replace(/\.html?$/i, "").replace(/\/+$/, "");
    addUntil(candidates, stripped.toLowerCase());
    addUntil(candidates, slugify(stripped));
    addUntil(candidates, slugify(raw));

    for (var i = 0; i < candidates.length; i++) {
      var key = candidates[i];
      if (!key) { continue; }
      if (map.byLegacyId && map.byLegacyId[key] && map.bySlug[map.byLegacyId[key]]) {
        return map.bySlug[map.byLegacyId[key]];
      }
      if (map.bySlug && map.bySlug[key]) { return map.bySlug[key]; }
    }
    return null;
  }

  return {
    DEFAULT_BASE_URL: DEFAULT_BASE_URL,
    EVENT_PATH_PREFIX: EVENT_PATH_PREFIX,
    EVENT_SUFFIX: EVENT_SUFFIX,
    MAX_SLUG_LENGTH: MAX_SLUG_LENGTH,
    slugify: slugify,
    resolveBaseUrl: resolveBaseUrl,
    buildEventUrlMap: buildEventUrlMap,
    resolveEvent: resolveEvent,
    slugFromPath: slugFromPath
  };
});
