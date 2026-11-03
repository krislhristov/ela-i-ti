/* Слайдерът „Предстоящи събития“ се строи от assets/js/events-data.js.
 * Тук няма данни — само филтърът „днес или по-късно“ и рисунката на слайдовете.
 */
(function () {
  var slider = document.querySelector("[data-upcoming-slider]");
  var track = document.querySelector("[data-upcoming-track]");
  var empty = document.querySelector("[data-upcoming-empty]");
  if (!slider || !track || !empty) return;

  var MONTHS = ["януари", "февруари", "март", "април", "май", "юни",
                "юли", "август", "септември", "октомври", "ноември", "декември"];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function toDate(value) {
    if (!value) return null;
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  function clock(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function dayText(d) { return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear(); }
  function isoDay(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  function node(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text) n.textContent = text;
    return n;
  }

  var data = Array.isArray(window.ELAITI_EVENTS) ? window.ELAITI_EVENTS : [];
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  var events = data.map(function (ev) {
    var start = toDate(ev.start);
    if (!start) return null;
    var end = toDate(ev.end) || start;
    return { ev: ev, start: start, end: end };
  }).filter(function (item) {
    /* предстоящо = още не е приключило: днес или на бъдеща дата */
    return item && item.end >= today;
  }).sort(function (a, b) {
    return a.start - b.start;
  });

  if (!events.length) return; /* остава състоянието „Очаквайте скоро“ */

  events.forEach(function (item, i) {
    var ev = item.ev;

    var slide = node("li", "slide");
    slide.setAttribute("aria-roledescription", "слайд");
    slide.setAttribute("aria-label", (i + 1) + " от " + events.length);

    var card = node("article", "slide-card slide-card--event");
    var body = node("div", "slide-body");

    body.appendChild(node("h4", "slide-title", ev.title));

    var when = dayText(item.start) + ", " + clock(item.start);
    if (item.end > item.start) when += " – " + clock(item.end);
    var dateLine = node("p", "event-when");
    var timeEl = node("time", null, when);
    timeEl.setAttribute("datetime", isoDay(item.start));
    dateLine.appendChild(timeEl);
    body.appendChild(dateLine);

    if (ev.location) body.appendChild(node("p", "event-place", ev.location));
    if (ev.short) body.appendChild(node("p", "slide-text", ev.short));

    var actions = node("div", "event-actions");
    if (ev.signup) {
      var signup = node("a", "btn", "Запиши се");
      signup.href = ev.signup;
      signup.target = "_blank";
      signup.rel = "noopener";
      actions.appendChild(signup);
    }
    var more = node("a", "btn btn-outline", "Научи повече");
    more.href = "event.html?event=" + encodeURIComponent(ev.slug);
    actions.appendChild(more);
    body.appendChild(actions);

    card.appendChild(body);

    var first = ev.images && ev.images[0];
    if (first) {
      var media = node("span", "slide-media-wrap");
      var img = node("img", "slide-media");
      img.src = first.src;
      img.alt = first.alt || ev.title;
      img.loading = "lazy";
      img.decoding = "async";
      media.appendChild(img);
      card.appendChild(media);
    }

    var hit = node("a", "event-hit");
    hit.href = "event.html?event=" + encodeURIComponent(ev.slug);
    hit.setAttribute("aria-label", "Отвори „" + ev.title + "“");
    card.appendChild(hit);

    slide.appendChild(card);
    track.appendChild(slide);
  });

  empty.hidden = true;
  slider.hidden = false;
})();
