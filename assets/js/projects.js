/* Строи „Проекти и инициативи“ и страницата на един проект от projects-data.js.
 *
 * Заглавията на свързаните събития се взимат от данните за събитията
 * (events-data.js + events-archive-data.js), за да не се въвеждат два пъти.
 */
(function () {
  var MONTHS = ["януари", "февруари", "март", "април", "май", "юни",
                "юли", "август", "септември", "октомври", "ноември", "декември"];

  var PROJECTS = Array.isArray(window.ELAITI_PROJECTS) ? window.ELAITI_PROJECTS : [];

  /* всички събития на сайта, за да намерим заглавие и дата по slug */
  var EVENTS = (Array.isArray(window.ELAITI_EVENTS) ? window.ELAITI_EVENTS : [])
    .concat(Array.isArray(window.ELAITI_ARCHIVE) ? window.ELAITI_ARCHIVE : []);

  var KIND_LABEL = { proekt: "Проект", iniciativa: "Инициатива" };

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function dayText(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  function eventBySlug(slug) {
    for (var i = 0; i < EVENTS.length; i++) {
      if (EVENTS[i].slug === slug) return EVENTS[i];
    }
    return null;
  }

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

  function urlFor(slug) { return "projects/" + encodeURIComponent(slug) + ".html"; }

  /* ── списък ───────────────────────────────────────────────────────────── */
  function buildCard(item, eager) {
    var card = node("article", "project-card");

    var body = node("div", "project-card-body");
    var meta = node("p", "project-meta");
    meta.appendChild(node("span", "project-kind", KIND_LABEL[item.kind] || "Проект"));
    if (item.period) meta.appendChild(node("span", "project-period", item.period));
    body.appendChild(meta);
    body.appendChild(node("h2", "project-card-title", item.title));
    if (item.summary) body.appendChild(node("p", "project-card-text", item.summary));

    var link = node("a", "btn btn-outline", "Научи повече");
    link.href = urlFor(item.slug);
    link.setAttribute("aria-label", "Научи повече за „" + item.title + "“");
    body.appendChild(link);
    card.appendChild(body);

    if (item.image) {
      var wrap = node("span", "event-media-wrap");
      var img = node("img", "event-media");
      img.src = item.image;
      img.alt = item.title;
      img.loading = eager ? "eager" : "lazy";
      img.decoding = "async";
      wrap.appendChild(withWebp(img));
      card.appendChild(wrap);
    }

    var hit = node("a", "event-hit");
    hit.href = urlFor(item.slug);
    hit.setAttribute("aria-label", "Отвори „" + item.title + "“");
    card.appendChild(hit);

    var li = node("li", "projects-list-item");
    li.appendChild(card);
    return li;
  }

  var listBox = document.querySelector("[data-projects-list]");
  if (listBox) {
    var chips = document.querySelectorAll("[data-kind-filter]");
    var state = { kind: "" };

    try {
      state.kind = new URLSearchParams(window.location.search).get("vid") || "";
    } catch (e) {}

    function paint() {
      Array.prototype.forEach.call(chips, function (chip) {
        var value = chip.getAttribute("data-kind-filter");
        var on = value === state.kind;
        chip.classList.toggle("is-active", on);
        chip.setAttribute("aria-pressed", on ? "true" : "false");
      });

      listBox.innerHTML = "";
      var items = PROJECTS.filter(function (item) {
        return !state.kind || item.kind === state.kind;
      });
      items.forEach(function (item, i) { listBox.appendChild(buildCard(item, i === 0)); });

      try {
        var u = new URL(window.location.href);
        if (state.kind) u.searchParams.set("vid", state.kind); else u.searchParams.delete("vid");
        window.history.replaceState(null, "", u);
      } catch (e) {}
    }

    Array.prototype.forEach.call(chips, function (chip) {
      chip.addEventListener("click", function () {
        state.kind = chip.getAttribute("data-kind-filter");
        paint();
      });
    });

    paint();
  }

  /* ── страница на един проект ──────────────────────────────────────────── */
  var page = document.querySelector("[data-project-page]");
  if (page) {
    var slug = "";
    try { slug = new URLSearchParams(window.location.search).get("project") || ""; } catch (e) {}

    var item = null;
    PROJECTS.forEach(function (p) { if (p.slug === slug) item = p; });

    /* Има ли статична страница, направо там — тя е каноничният адрес. */
    if (item) {
      try { window.location.replace(urlFor(item.slug)); return; } catch (e) {}
    }

    page.innerHTML = "";

    var backWrap = node("div", "wrap event-page-back");
    var back = node("a", "back-link", "← Проекти и инициативи");
    back.href = "projects.html";
    backWrap.appendChild(back);
    page.appendChild(backWrap);

    if (!item) {
      var miss = node("div", "wrap event-missing");
      miss.appendChild(node("h1", "event-page-title", "Проектът не е намерен"));
      var back2 = node("a", "btn btn-outline", "← Всички проекти");
      back2.href = "projects.html";
      miss.appendChild(back2);
      page.appendChild(miss);
      document.title = "Проектът не е намерен — Фондация „Ела и ти“";
      return;
    }

    var layout = node("div", "wrap event-page-layout");
    var main = node("div", "event-page-main");

    var head = node("div", "event-page-head");
    head.appendChild(node("h1", "event-page-title", item.title));
    main.appendChild(head);

    var meta = node("p", "project-meta project-meta--lead");
    meta.appendChild(node("span", "project-kind", KIND_LABEL[item.kind] || "Проект"));
    if (item.period) meta.appendChild(node("span", "project-period", item.period));
    main.appendChild(meta);

    if (item.summary) {
      var lead = node("p", "project-lead", item.summary);
      main.appendChild(lead);
    }

    if (item.body && item.body.length) {
      var text = node("div", "event-page-text");
      item.body.forEach(function (p) {
        var para = document.createElement("p");
        para.textContent = p;
        text.appendChild(para);
      });
      main.appendChild(text);
    }

    /* кой подкрепя */
    if (item.supporters && item.supporters.length) {
      var sup = node("section", "project-block");
      sup.appendChild(node("h2", "project-block-title", "Кой го подкрепя"));
      var supList = node("ul", "project-supporters");
      item.supporters.forEach(function (s) {
        var li = node("li");
        li.appendChild(node("b", null, s.name));
        if (s.role) li.appendChild(document.createTextNode(" — " + s.role));
        supList.appendChild(li);
      });
      sup.appendChild(supList);
      main.appendChild(sup);
    }

    /* какво е произвело */
    var related = (item.events || []).map(eventBySlug).filter(Boolean);
    if (related.length) {
      var produced = node("section", "project-block");
      produced.appendChild(node("h2", "project-block-title", "Събития по проекта"));
      var evList = node("ul", "event-editions-list");
      related
        .slice()
        .sort(function (a, b) { return new Date(b.start) - new Date(a.start); })
        .forEach(function (ev) {
          var li = node("li");
          var link = node("a", null, dayText(ev.start) + " — " + ev.title);
          link.href = "event.html?event=" + encodeURIComponent(ev.slug);
          li.appendChild(link);
          evList.appendChild(li);
        });
      produced.appendChild(evList);
      main.appendChild(produced);
    }

    if (item.join) {
      var join = node("section", "project-block");
      join.appendChild(node("h2", "project-block-title", "Как да се включиш"));
      join.appendChild(node("p", null, item.join));
      main.appendChild(join);
    }

    layout.appendChild(main);

    var side = node("div", "event-page-side");
    if (item.image) {
      var cover = node("figure", "event-cover");
      var cimg = node("img");
      cimg.src = item.image;
      cimg.alt = item.title;
      cimg.decoding = "async";
      cover.appendChild(withWebp(cimg));
      side.appendChild(cover);
    }
    if (side.childNodes.length) layout.appendChild(side);

    page.appendChild(layout);
    document.title = item.title + " — Фондация „Ела и ти“";
  }
})();
