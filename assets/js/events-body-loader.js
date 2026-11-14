/* Зарежда описанията на миналите събития само когато са нужни.
 *
 * events-archive-body.js е 242 KB — всички текстове на 99 минали събития.
 * Страницата event.html се ползва само за стари адреси (?event=…), които
 * обикновено веднага се пренасочват към готовата страница на събитието.
 * Затова файлът се тегли едва след като стане ясно, че наистина ще рисуваме
 * на място — иначе всеки стар линк би теглил 242 KB излишно.
 */
(function () {
  if (window.ELAITI_ARCHIVE_BODY) return;

  var loading = false;
  var waiting = [];

  function load() {
    if (loading || window.ELAITI_ARCHIVE_BODY) return;
    loading = true;
    var s = document.createElement("script");
    s.src = "assets/js/events-archive-body.js";
    s.onload = function () {
      waiting.splice(0).forEach(function (fn) { try { fn(); } catch (e) {} });
      document.dispatchEvent(new Event("ela:bodies"));
    };
    document.head.appendChild(s);
  }

  /* events.js вика това, преди да покаже текста; ако файлът вече е тук —
     вика веднага, ако не — тегли го и продължава след зареждането. */
  window.elaBodies = function (fn) {
    if (window.ELAITI_ARCHIVE_BODY) { fn(); return; }
    waiting.push(fn);
    load();
  };

  /* Ако някой отвори event.html?event=… и пренасочването не проработи,
     файлът се тегли веднага — това е случаят, в който текстът трябва да се
     покаже на място. */
  if (window.location.search.indexOf("event=") > -1) load();
})();
