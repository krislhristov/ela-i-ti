/* Строи страницата „Събития“ и страницата на отделно събитие от events-data.js */
(function () {
  var MONTHS = ["януари", "февруари", "март", "април", "май", "юни",
                "юли", "август", "септември", "октомври", "ноември", "декември"];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function toDate(v) { if (!v) return null; var d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  function clock(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function dayText(d) { return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear(); }
  function isoDay(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function whenText(item) {
    if (item.ev && item.ev.allDay) return dayText(item.start);
    var t = dayText(item.start);
    if (item.end && item.end > item.start) t += ", " + clock(item.start) + " – " + clock(item.end);
    else t += ", " + clock(item.start);
    return t;
  }

  function collect() {
    var list = Array.isArray(window.ELAITI_EVENTS) ? window.ELAITI_EVENTS : [];
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return list.map(function (ev) {
      var start = toDate(ev.start);
      if (!start) return null;
      var end = toDate(ev.end) || start;
      return { ev: ev, start: start, end: end, future: end >= today };
    }).filter(Boolean).sort(function (a, b) {
      /* предстоящите най-отгоре, после по дата в обратен ред */
      if (a.future !== b.future) return a.future ? -1 : 1;
      return a.future ? a.start - b.start : b.start - a.start;
    });
  }

  var ITEMS = collect();

  /* ── Списък със събития ───────────────────────────────────────────────── */
  function buildCard(item, eager) {
    var ev = item.ev;
    var url = "event.html?event=" + encodeURIComponent(ev.slug);

    var card = node("article", "event-card" + (item.future ? " is-future" : ""));

    var body = node("div", "event-card-body");
    body.appendChild(node("h2", "event-card-title", ev.title));

    var when = node("p", "event-when");
    var time = node("time", null, whenText(item));
    time.setAttribute("datetime", isoDay(item.start));
    when.appendChild(time);
    body.appendChild(when);

    if (ev.location) body.appendChild(node("p", "event-place", ev.location));
    if (ev.short) body.appendChild(node("p", "event-card-text", ev.short));

    var actions = node("div", "event-actions");
    if (item.future && ev.signup) {
      var signup = node("a", "btn", "Запиши се");
      signup.href = ev.signup;
      signup.target = "_blank";
      signup.rel = "noopener";
      signup.setAttribute("aria-label", "Запиши се за „" + ev.title + "“");
      actions.appendChild(signup);
    }
    var more = node("a", "btn btn-outline", "Научи повече");
    more.href = url;
    more.setAttribute("aria-label", "Научи повече за „" + ev.title + "“");
    actions.appendChild(more);
    body.appendChild(actions);
    card.appendChild(body);

    if (ev.images && ev.images.length) {
      var wrap = node("span", "event-media-wrap");
      var img = node("img", "event-media");
      img.src = ev.images[0].src;
      img.alt = ev.images[0].alt || ev.title;
      img.loading = eager ? "eager" : "lazy";
      img.decoding = "async";
      wrap.appendChild(img);
      card.appendChild(wrap);
    }

    /* цялата карта е кликаема; бутоните са отгоре и работят сами */
    var hit = node("a", "event-hit");
    hit.href = url;
    hit.setAttribute("aria-label", "Отвори „" + ev.title + "“");
    card.appendChild(hit);

    var li = node("li", "events-list-item");
    li.appendChild(card);
    return li;
  }

  /* Два отделни списъка в страницата — предстоящи и минали.
     Кое събитие в кой списък влиза се решава от датата, не се отбелязва ръчно. */
  Array.prototype.forEach.call(document.querySelectorAll("[data-events-list]"), function (box) {
    var kind = box.getAttribute("data-events-list");
    var items = ITEMS.filter(function (it) { return kind === "past" ? !it.future : it.future; });

    items.forEach(function (item, i) {
      box.appendChild(buildCard(item, kind !== "past" && i === 0));
    });

    var empty = document.querySelector('[data-events-empty="' + kind + '"]');
    if (empty) empty.hidden = items.length > 0;
    if (!items.length) box.hidden = true;
  });

  /* ── Страница на едно събитие ─────────────────────────────────────────── */
  var page = document.querySelector("[data-event-page]");
  if (page) {
    var slug = "";
    try { slug = new URLSearchParams(window.location.search).get("event") || ""; } catch (e) { slug = ""; }

    var item = null;
    ITEMS.forEach(function (it) { if (it.ev.slug === slug) item = it; });

    if (!item) {
      page.innerHTML = "";
      var miss = node("div", "wrap event-missing");
      miss.appendChild(node("h1", "event-page-title", "Събитието не е намерено"));
      var back = node("a", "btn btn-outline", "← Всички събития");
      back.href = "events.html";
      miss.appendChild(back);
      page.appendChild(miss);
      document.title = "Събитието не е намерено — Фондация „Ела и ти“";
      return;
    }

    var ev = item.ev;
    var images = ev.images || [];

    page.innerHTML = "";

    /* „← Всички събития“ стои над двете колони */
    var backWrap = node("div", "wrap event-page-back");
    var backLink = node("a", "back-link", "← Всички събития");
    backLink.href = "events.html";
    backWrap.appendChild(backLink);
    page.appendChild(backWrap);

    var layout = node("div", "wrap event-page-layout");
    var mainCol = node("div", "event-page-main");
    var hero = node("div", "event-page-head");

    hero.appendChild(node("h1", "event-page-title", ev.title));
    mainCol.appendChild(hero);

    var text = node("div", "event-page-text");
    (ev.body || []).forEach(function (p) {
      /* пренасянето на нов ред в текста се запазва като <br> в абзаца */
      var para = document.createElement("p");
      String(p).split("\n").forEach(function (line, i) {
        if (i) para.appendChild(document.createElement("br"));
        para.appendChild(document.createTextNode(line));
      });
      text.appendChild(para);
    });
    mainCol.appendChild(text);

    /* дясна колона: снимка, под нея картичка с данните, накрая „Запиши се“ */
    var sideCol = node("div", "event-page-side");

    if (images.length) {
      var cover = node("figure", "event-cover");
      var cimg = node("img", null);
      cimg.src = images[0].src;
      cimg.alt = images[0].alt || ev.title;
      cimg.decoding = "async";
      cover.appendChild(cimg);
      sideCol.appendChild(cover);
    }

    var info = node("aside", "event-info");
    var infoList = node("ul");

    function infoRow(ico, label, value) {
      if (!value) return;
      var li = node("li");
      li.appendChild(node("span", "event-info-ico", ico));
      var line = node("span", "event-info-line");
      line.appendChild(node("b", "event-info-label", label + ":"));
      line.appendChild(document.createTextNode(" " + value));
      li.appendChild(line);
      infoList.appendChild(li);
    }

    infoRow("📍", "Локация", ev.location);
    infoRow("📅", "Дата", dayText(item.start));
    infoRow("👋", "Начало", item.ev.allDay ? "" : clock(item.start));
    infoRow("🎫", "Билети", ev.tickets || "—");

    if (infoList.childNodes.length) {
      info.appendChild(infoList);
      sideCol.appendChild(info);
    }

    var side = node("aside", "event-page-aside");
    if (item.future && ev.signup) {
      var cta = node("a", "btn", "Запиши се");
      cta.href = ev.signup;
      cta.target = "_blank";
      cta.rel = "noopener";
      side.appendChild(cta);
    }
    if (side.childNodes.length) sideCol.appendChild(side);

    layout.appendChild(mainCol);
    if (sideCol.childNodes.length) layout.appendChild(sideCol);
    page.appendChild(layout);

    if (images.length > 1) {
      var gallery = node("div", "wrap event-gallery");
      images.slice(1).forEach(function (im) {
        var fig = node("figure", null);
        var gimg = node("img", null);
        gimg.src = im.src;
        gimg.alt = im.alt || ev.title;
        gimg.loading = "lazy";
        gimg.decoding = "async";
        fig.appendChild(gimg);
        gallery.appendChild(fig);
      });
      page.appendChild(gallery);
    }

    document.title = ev.title + " — Фондация „Ела и ти“";
  }
})();
