/* Пренасочване на старите ?event= адреси към /events/<slug>.html
 *
 * Старият адрес на събитие е event.html?event=<id>. Новият е статична страница
 * /events/<slug>.html. Този файл сменя адреса веднага, още в <head>, преди
 * страницата да се покаже — затова няма трепване на старото съдържание.
 *
 * Скокът е точно един: ?event=<id> → /events/<slug>.html. Ако страницата вече е
 * на новия адрес, не се прави нищо (така няма цикъл). Фрагментът (#…) се запазва.
 * Непознат или празен идентификатор не се пренасочва — остава сегашното
 * съобщение „Събитието не е намерено“ и страницата се маркира noindex.
 *
 * Таблицата идва от генерирания assets/js/event-redirects.js:
 *   window.ELAITI_EVENT_REDIRECTS = { "skakavitsa": "/events/skakavitsa.html", … }
 * Прави се с: node tools/build-event-redirects.js --env test
 *
 * Работи и в браузъра, и в Node (за проверките) — без DOM, освен при самото
 * пренасочване.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module && module.exports) { module.exports = api; }
  if (root) { root.ELAITI_EVENT_REDIRECTS_API = api; }
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function (root) {
  "use strict";

  var TABLE_NAME = "ELAITI_EVENT_REDIRECTS";
  var PARAM = "event";

  /* ── четене на входа ──────────────────────────────────────────────────── */

  /* Стар идентификатор във всякакъв вид → ключът от таблицата.
     " Skakavitsa " , "skakavitsa.html", "/events/skakavitsa.html",
     "https://elaiti.com/events/skakavitsa.html" → "skakavitsa". */
  function normalizeId(value) {
    if (value === null || value === undefined) { return ""; }

    var text = String(value);
    try { text = decodeURIComponent(text); } catch (error) { /* оставяме както е */ }
    text = text.trim().toLowerCase();
    if (!text) { return ""; }

    text = text.replace(/^https?:\/\/[^\/]+/i, "");   // пълен адрес → само пътя
    text = text.replace(/[?#].*$/, "");                // ? и # откъм края

    var fromPath = text.match(/(?:^|\/)events\/([^\/]+?)(?:\.html?)?$/);
    if (fromPath) { text = fromPath[1]; }

    text = text.replace(/^\.?\//, "");
    text = text.replace(/^events\//, "");
    text = text.replace(/\.html?$/, "");
    text = text.replace(/\/+$/, "");
    return text;
  }

  /* location.search → стойността на ?event= (първата, ако е повторен).
     Връща null, ако параметърът изобщо липсва, и "" ако е празен (?event=). */
  function eventIdFromSearch(search) {
    var text = String(search === null || search === undefined ? "" : search);
    if (text.charAt(0) === "?") { text = text.slice(1); }
    if (!text) { return null; }

    var parts = text.split("&");
    for (var i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf("=");
      var name = eq < 0 ? parts[i] : parts[i].slice(0, eq);
      /* „amp;event“ идва от &amp;event= в стар HTML — приемаме и него */
      if (name !== PARAM && name !== "amp;" + PARAM) { continue; }
      if (eq < 0) { return ""; }
      return parts[i].slice(eq + 1).replace(/\+/g, " ");
    }
    return null;
  }

  /* ── адреси ───────────────────────────────────────────────────────────── */

  /* Коренът на сайта, за да работи и на elaiti.com, и в подпапка
     (krislhristov.github.io/ela-i-ti/). За event.html това е „/“ или
     „/ela-i-ti/“; за страница в /events/ — пак коренът на сайта. */
  function siteRoot(pathname) {
    var path = String(pathname === null || pathname === undefined ? "/" : pathname);
    var at = path.toLowerCase().indexOf("/events/");
    if (at >= 0) { return path.slice(0, at + 1); }
    var cut = path.lastIndexOf("/");
    return cut < 0 ? "/" : path.slice(0, cut + 1);
  }

  /* Пътят от таблицата ("/events/x.html") → адрес, който работи навсякъде. */
  function targetPath(path, pathname) {
    var value = String(path === null || path === undefined ? "" : path);
    if (!value) { return ""; }
    if (/^https?:\/\//i.test(value)) { return value; }
    return siteRoot(pathname) + value.replace(/^\/+/, "");
  }

  function sameAddress(a, b) {
    function norm(value) {
      var text = String(value === null || value === undefined ? "" : value);
      try { text = decodeURIComponent(text); } catch (error) { /* както е */ }
      text = text.toLowerCase().replace(/\/+$/, "");
      return text.replace(/\/index\.html?$/, "");
    }
    return norm(a) === norm(b);
  }

  function lookup(table, id) {
    var key = normalizeId(id);
    if (!key) { return ""; }
    if (!Object.prototype.hasOwnProperty.call(table, key)) { return ""; }
    var path = table[key];
    return typeof path === "string" ? path : "";
  }

  /* ── решението ────────────────────────────────────────────────────────── */

  /* Вход: { table, pathname, search, hash }
     Изход:
       { action: "redirect", id, target }   — един скок към target
       { action: "already",  id, target }   — вече сме на новия адрес
       { action: "unknown",  id }           — непознат/празен идентификатор
       { action: "none" }                   — няма ?event= или няма таблица */
  function plan(input) {
    input = input || {};
    var table = input.table;
    if (!table || typeof table !== "object" || !Object.keys(table).length) {
      return { action: "none" };
    }

    var id = eventIdFromSearch(input.search);
    if (id === null) { return { action: "none" }; }

    var path = lookup(table, id);
    if (!path) { return { action: "unknown", id: String(id) }; }

    var target = targetPath(path, input.pathname);
    if (!target) { return { action: "unknown", id: String(id) }; }
    if (sameAddress(target, input.pathname)) {
      return { action: "already", id: String(id), target: target };
    }
    return { action: "redirect", id: String(id), target: target };
  }

  /* ── прилагане в браузъра ─────────────────────────────────────────────── */

  function markUnknown(win) {
    try {
      var doc = win.document;
      if (!doc) { return; }
      var meta = doc.createElement("meta");
      meta.setAttribute("name", "robots");
      meta.setAttribute("content", "noindex");
      (doc.head || doc.documentElement).appendChild(meta);
      if (doc.documentElement) {
        doc.documentElement.setAttribute("data-event-missing", "");
      }
    } catch (error) { /* страницата пак остава с ясното съобщение */ }
  }

  /* Извиква се веднага при зареждане на скрипта. Връща решението — за проверки. */
  function run(win) {
    win = win || root;
    if (!win || !win.location) { return null; }

    var result = plan({
      table: win[TABLE_NAME],
      pathname: win.location.pathname,
      search: win.location.search,
      hash: win.location.hash
    });

    if (result.action === "redirect") {
      var target = result.target + (win.location.hash || "");
      result.applied = target;
      try { win.location.replace(target); } catch (error) { /* остава старата страница */ }
      return result;
    }
    if (result.action === "unknown") { markUnknown(win); }
    return result;
  }

  var api = {
    TABLE_NAME: TABLE_NAME,
    PARAM: PARAM,
    normalizeId: normalizeId,
    eventIdFromSearch: eventIdFromSearch,
    siteRoot: siteRoot,
    targetPath: targetPath,
    sameAddress: sameAddress,
    plan: plan,
    run: run
  };

  if (root && root.location && root.document && typeof root.document.createElement === "function") {
    run(root);
  }
  return api;
});
