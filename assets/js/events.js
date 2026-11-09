/* Строи страницата „Събития“ и страницата на отделно събитие от events-data.js */
(function () {
  var MONTHS = ["януари", "февруари", "март", "април", "май", "юни",
                "юли", "август", "септември", "октомври", "ноември", "декември"];

  // WebP вариантът е значително по-малък; ако файлът липсва, браузърът
  // просто ползва <img> вътре в <picture>.
  function withWebp(img) {
    var raw = img.getAttribute("src") || "";
    if (!/\.jpe?g$/i.test(raw)) return img;
    var pic = document.createElement("picture");
    var src = document.createElement("source");
    src.type = "image/webp";
    src.srcset = raw.replace(/\.jpe?g$/i, ".webp");
    pic.appendChild(src);
    pic.appendChild(img);
    return pic;
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function toDate(v) { if (!v) return null; var d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  function clock(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function dayText(d) { return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear(); }
  function isoDay(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  /* връзки към програма и кампания — по slug на събитието */
  var PROJECTS = Array.isArray(window.ELAITI_PROJECTS) ? window.ELAITI_PROJECTS : [];
  var CAMPAIGNS = Array.isArray(window.ELAITI_CAMPAIGNS) ? window.ELAITI_CAMPAIGNS : [];

  function projectFor(slug) {
    for (var i = 0; i < PROJECTS.length; i++) {
      if ((PROJECTS[i].events || []).indexOf(slug) > -1) return PROJECTS[i];
    }
    return null;
  }

  function campaignFor(slug) {
    for (var i = 0; i < CAMPAIGNS.length; i++) {
      if ((CAMPAIGNS[i].events || []).indexOf(slug) > -1) return CAMPAIGNS[i];
    }
    return null;
  }

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
    /* Ръкописните събития (events-data.js) и архивът от Facebook
       (events-archive-data.js) се показват в един общ списък. */
    var list = (Array.isArray(window.ELAITI_EVENTS) ? window.ELAITI_EVENTS : [])
      .concat(Array.isArray(window.ELAITI_ARCHIVE) ? window.ELAITI_ARCHIVE : []);
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

    if (item.future) {
      /* цвят + етикет: цвят сам по себе си не е достатъчен знак */
      body.appendChild(node("span", "event-badge", "Предстоящо"));
    }
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
      wrap.appendChild(withWebp(img));
      card.appendChild(wrap);
    } else {
      /* без снимка от Facebook: място със знака на фондацията, докато
         не дойде истинска снимка */
      var phWrap = node("span", "event-media-wrap event-media-wrap--empty");
      var ph = node("img", "event-media event-media--placeholder");
      ph.src = "assets/img/logo.png";
      ph.alt = "";
      ph.loading = "lazy";
      ph.decoding = "async";
      phWrap.appendChild(ph);
      card.appendChild(phWrap);
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

  /* Списъци в страницата. „all“ е общият списък с филтри и зареждане на
     порции; „future“/„past“ остават за други страници, ако потрябват. */
  var BATCH = 12;

  function renderSimple(box, kind) {
    var items = ITEMS.filter(function (it) { return kind === "past" ? !it.future : it.future; });

    items.forEach(function (item, i) {
      box.appendChild(buildCard(item, kind !== "past" && i === 0));
    });

    var empty = document.querySelector('[data-events-empty="' + kind + '"]');
    if (empty) empty.hidden = items.length > 0;
    if (!items.length) box.hidden = true;
  }

  function renderAll(box) {
    var section = document.getElementById("all-events");
    var controls = document.querySelectorAll("[data-filter]");
    var counter = document.querySelector("[data-events-count]");
    var moreBtn = document.querySelector("[data-events-more]");
    var empty = document.querySelector('[data-events-empty="all"]');
    var state = { category: "", year: "", shown: BATCH };

    try {
      var q = new URLSearchParams(window.location.search);
      state.category = q.get("kat") || "";
      state.year = q.get("god") || "";
    } catch (e) { /* стар браузър — филтрите просто започват празни */ }

    function matches(it) {
      if (state.category && it.ev.category !== state.category) return false;
      if (state.year && String(it.start.getFullYear()) !== state.year) return false;
      return true;
    }

    function paint(scroll) {
      Array.prototype.forEach.call(controls, function (sel) {
        var key = sel.getAttribute("data-filter");
        if (sel.value !== state[key]) sel.value = state[key];
      });

      var list = ITEMS.filter(matches);
      box.innerHTML = "";
      list.slice(0, state.shown).forEach(function (it, i) {
        box.appendChild(buildCard(it, i === 0));
      });

      if (empty) empty.hidden = list.length > 0;
      box.hidden = list.length === 0;

      if (counter) {
        counter.textContent = !list.length
          ? ""
          : list.length > state.shown
            ? state.shown + " от " + list.length + " събития"
            : list.length + (list.length === 1 ? " събитие" : " събития");
      }
      if (moreBtn) moreBtn.hidden = list.length <= state.shown;

      /* филтрите се запазват в адреса, за да може линкът да се споделя */
      try {
        var u = new URL(window.location.href);
        if (state.category) u.searchParams.set("kat", state.category); else u.searchParams.delete("kat");
        if (state.year) u.searchParams.set("god", state.year); else u.searchParams.delete("god");
        window.history.replaceState(null, "", u);
      } catch (e) {}

      if (scroll && section && section.getBoundingClientRect().top < 0) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    Array.prototype.forEach.call(controls, function (sel) {
      sel.addEventListener("change", function () {
        state[sel.getAttribute("data-filter")] = sel.value;
        state.shown = BATCH;
        paint(true);
      });
    });

    if (moreBtn) {
      moreBtn.addEventListener("click", function () {
        state.shown += BATCH;
        paint();
      });
    }

    /* Зареждане при скролване. Бутонът остава — за клавиатура и за
       браузъри без IntersectionObserver. */
    if ("IntersectionObserver" in window) {
      var sentinel = document.createElement("div");
      sentinel.className = "events-sentinel";
      sentinel.setAttribute("aria-hidden", "true");
      if (moreBtn && moreBtn.parentNode) moreBtn.parentNode.parentNode.insertBefore(sentinel, moreBtn.parentNode);
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && moreBtn && !moreBtn.hidden) {
          state.shown += BATCH;
          paint();
        }
      }, { rootMargin: "600px" }).observe(sentinel);
    }

    paint();
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-events-list]"), function (box) {
    var kind = box.getAttribute("data-events-list");
    if (kind === "all") renderAll(box);
    else renderSimple(box, kind);
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
    /* Текстът идва от ръкописния запис, а за архивните — от отделния
       файл с текстове, който се тегли само на тази страница. */
    var paragraphs = (ev.body && ev.body.length)
      ? ev.body
      : ((window.ELAITI_ARCHIVE_BODY || {})[ev.slug] || []);
    paragraphs.forEach(function (p) {
      /* пренасянето на нов ред в текста се запазва като <br> в абзаца */
      var para = document.createElement("p");
      String(p).split("\n").forEach(function (line, i) {
        if (i) para.appendChild(document.createElement("br"));
        para.appendChild(document.createTextNode(line));
      });
      text.appendChild(para);
    });
    mainCol.appendChild(text);

    /* Поредици: „Панти, шейни, усмивки“ има 11 издания — показваме ги
       само на страницата на самото събитие, не в картите. */
    if (ev.series) {
      var others = ITEMS.filter(function (it) {
        return it.ev.series === ev.series && it.ev.slug !== ev.slug;
      }).sort(function (a, b) { return b.start - a.start; });

      if (others.length) {
        var editions = node("section", "event-editions");
        editions.appendChild(node("h2", "event-editions-title", "Други издания"));
        var edList = node("ul", "event-editions-list");
        others.forEach(function (it) {
          var li = node("li");
          var link = node("a", null, dayText(it.start) + " — " + it.ev.title);
          link.href = "event.html?event=" + encodeURIComponent(it.ev.slug);
          li.appendChild(link);
          edList.appendChild(li);
        });
        editions.appendChild(edList);
        mainCol.appendChild(editions);
      }
    }

    /* дясна колона: снимка, под нея картичка с данните, накрая „Запиши се“ */
    var sideCol = node("div", "event-page-side");

    if (images.length) {
      var cover = node("figure", "event-cover");
      var cimg = node("img", null);
      cimg.src = images[0].src;
      cimg.alt = images[0].alt || ev.title;
      cimg.decoding = "async";
      cover.appendChild(withWebp(cimg));
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
    infoRow("🎫", "Билети", ev.tickets);

    /* Към коя програма принадлежи събитието (ако принадлежи) */
    var proj = projectFor(ev.slug);
    if (proj) {
      var pli = node("li");
      pli.appendChild(node("span", "event-info-ico", "🎯"));
      var pline = node("span", "event-info-line");
      pline.appendChild(node("b", "event-info-label", "Програма:"));
      var plink = node("a", null, " " + proj.title);
      plink.href = "projects/" + encodeURIComponent(proj.slug) + ".html";
      pline.appendChild(plink);
      pli.appendChild(pline);
      infoList.appendChild(pli);
    }

    if (infoList.childNodes.length) {
      info.appendChild(infoList);
      sideCol.appendChild(info);
    }

    var side = node("aside", "event-page-aside");

    var camp = campaignFor(ev.slug);
    if (camp) {
      var clink = node("a", "btn btn-outline", "Кампанията зад това събитие");
      clink.href = "campaign.html?campaign=" + encodeURIComponent(camp.slug);
      side.appendChild(clink);
    }

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
        fig.appendChild(withWebp(gimg));
        gallery.appendChild(fig);
      });
      page.appendChild(gallery);
    }

    document.title = ev.title + " — Фондация „Ела и ти“";
  }
})();
