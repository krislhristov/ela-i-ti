/* Кампании: списък (campaigns.html) и страница на кампания (campaign.html?campaign=).
 *
 * Живите числа идват от campaign-live.js (обновява се от cron-а през Платформата.бг).
 * Ако ги няма или са по-стари от 48 часа, прогресът се скрива и се показва само
 * целта — никога не се показват нули.
 */
(function () {
  var MONTHS = ["януари", "февруари", "март", "април", "май", "юни",
                "юли", "август", "септември", "октомври", "ноември", "декември"];
  var STALE_HOURS = 48;

  var CAMPAIGNS = Array.isArray(window.ELAITI_CAMPAIGNS) ? window.ELAITI_CAMPAIGNS : [];
  var LIVE = window.ELAITI_CAMPAIGN_LIVE || {};
  var EVENTS = (Array.isArray(window.ELAITI_EVENTS) ? window.ELAITI_EVENTS : [])
    .concat(Array.isArray(window.ELAITI_ARCHIVE) ? window.ELAITI_ARCHIVE : []);
  var PROJECTS = Array.isArray(window.ELAITI_PROJECTS) ? window.ELAITI_PROJECTS : [];

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function money(n) {
    var v = Math.round(Number(n) || 0);
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " €";
  }

  function dayText(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  /* "14.11.2026 23:00" или ISO → „14 ноември 2026“ */
  function deadlineText(raw) {
    if (!raw) return "";
    var m = String(raw).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m) return Number(m[1]) + " " + MONTHS[Number(m[2]) - 1] + " " + m[3];
    return dayText(raw);
  }

  function liveFor(slug) {
    var d = LIVE[slug];
    if (!d) return null;
    if (d.donated == null || d.target == null) return null;
    var t = Date.parse(d.updated || "");
    if (!isNaN(t) && (Date.now() - t) / 36e5 > STALE_HOURS) return { stale: true, data: d };
    return { stale: false, data: d };
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

  function bySlug(list, slug) {
    for (var i = 0; i < list.length; i++) if (list[i].slug === slug) return list[i];
    return null;
  }

  function urlFor(slug) { return "campaign.html?campaign=" + encodeURIComponent(slug); }

  /* блок с числата */
  function buildProgress(camp) {
    var box = node("div", "campaign-progress");
    var live = liveFor(camp.slug);

    if (!live) {
      box.appendChild(node("p", "campaign-progress-row", "Цел: " + money(camp.goal)));
      box.appendChild(node("p", "campaign-note",
        "Към момента не разполагаме с актуалните числа от Платформата.бг — виж ги на страницата на кампанията."));
      return box;
    }

    if (live.stale) {
      box.appendChild(node("p", "campaign-progress-row", "Цел: " + money(camp.goal)));
      box.appendChild(node("p", "campaign-note",
        "Числата от Платформата.бг не са обновени от " + dayText(live.data.updated) + " — виж актуалните на страницата на кампанията."));
      return box;
    }

    var d = live.data;
    var pct = Math.max(0, Math.min(100, (d.donated / d.target) * 100));

    var head = node("p", "campaign-progress-row");
    head.appendChild(node("b", null, money(d.donated)));
    head.appendChild(document.createTextNode(" от " + money(d.target)));
    box.appendChild(head);

    var bar = node("div", "campaign-bar");
    var fill = node("span", "campaign-bar-fill");
    fill.style.width = pct.toFixed(1) + "%";
    bar.appendChild(fill);
    box.appendChild(bar);

    var metaBits = [];
    if (d.donors != null) metaBits.push(d.donors + " дарители");
    var dl = deadlineText(d.deadline);
    if (dl) metaBits.push("до " + dl);
    if (metaBits.length) box.appendChild(node("p", "campaign-meta", metaBits.join(" · ")));

    var stamp = node("p", "campaign-stamp", "към " + dayText(d.updated));
    box.appendChild(stamp);
    return box;
  }

  /* ── списък ───────────────────────────────────────────────────────────── */
  var listBox = document.querySelector("[data-campaigns-list]");
  if (listBox) {
    listBox.innerHTML = "";
    CAMPAIGNS.forEach(function (camp, i) {
      var li = node("li", "projects-list-item");
      var card = node("article", "project-card");

      var body = node("div", "project-card-body");
      var meta = node("p", "project-meta");
      meta.appendChild(node("span", "project-kind", camp.status === "closed" ? "Приключила" : "Активна"));
      body.appendChild(meta);
      body.appendChild(node("h2", "project-card-title", camp.title));
      if (camp.summary) body.appendChild(node("p", "project-card-text", camp.summary));
      body.appendChild(buildProgress(camp));

      var link = node("a", "btn btn-outline", "Към кампанията");
      link.href = urlFor(camp.slug);
      link.setAttribute("aria-label", "Отвори кампанията „" + camp.title + "“");
      body.appendChild(link);
      card.appendChild(body);

      if (camp.image) {
        var wrap = node("span", "event-media-wrap");
        var img = node("img", "event-media");
        img.src = camp.image;
        img.alt = camp.title;
        img.loading = i === 0 ? "eager" : "lazy";
        img.decoding = "async";
        wrap.appendChild(withWebp(img));
        card.appendChild(wrap);
      }

      var hit = node("a", "event-hit");
      hit.href = urlFor(camp.slug);
      hit.setAttribute("aria-label", "Отвори кампанията „" + camp.title + "“");
      card.appendChild(hit);

      li.appendChild(card);
      listBox.appendChild(li);
    });
  }

  /* ── страница на кампания ─────────────────────────────────────────────── */
  var page = document.querySelector("[data-campaign-page]");
  if (page) {
    var slug = "";
    try { slug = new URLSearchParams(window.location.search).get("campaign") || ""; } catch (e) {}
    var camp = bySlug(CAMPAIGNS, slug);
    page.innerHTML = "";

    var backWrap = node("div", "wrap event-page-back");
    var back = node("a", "back-link", "← Кампании");
    back.href = "campaigns.html";
    backWrap.appendChild(back);
    page.appendChild(backWrap);

    if (!camp) {
      var miss = node("div", "wrap event-missing");
      miss.appendChild(node("h1", "event-page-title", "Кампанията не е намерена"));
      var back2 = node("a", "btn btn-outline", "← Всички кампании");
      back2.href = "campaigns.html";
      miss.appendChild(back2);
      page.appendChild(miss);
      document.title = "Кампанията не е намерена — Фондация „Ела и ти“";
      return;
    }

    var layout = node("div", "wrap event-page-layout");
    var main = node("div", "event-page-main");

    var head = node("div", "event-page-head");
    head.appendChild(node("h1", "event-page-title", camp.title));
    main.appendChild(head);

    if (camp.summary) main.appendChild(node("p", "project-lead", camp.summary));

    main.appendChild(buildProgress(camp));

    var actions = node("div", "campaign-actions");
    var give = node("a", "btn btn-donate", "Дари през Платформата.бг");
    give.href = camp.platformata;
    give.target = "_blank";
    give.rel = "noopener";
    actions.appendChild(give);

    var other = node("a", "btn btn-outline", "Други начини за дарение");
    other.href = "donate.html";
    actions.appendChild(other);
    main.appendChild(actions);

    if (camp.body && camp.body.length) {
      var text = node("div", "event-page-text");
      camp.body.forEach(function (p) {
        var para = document.createElement("p");
        para.textContent = p;
        text.appendChild(para);
      });
      main.appendChild(text);
    }

    /* което събитие я подкрепя */
    var related = (camp.events || []).map(function (s) { return bySlug(EVENTS, s); }).filter(Boolean);
    if (related.length) {
      var block = node("section", "project-block");
      block.appendChild(node("h2", "project-block-title", "Събития, които я подкрепят"));
      var ul = node("ul", "event-editions-list");
      related.forEach(function (ev) {
        var li = node("li");
        var a = node("a", null, dayText(ev.start) + " — " + ev.title);
        a.href = "event.html?event=" + encodeURIComponent(ev.slug);
        li.appendChild(a);
        ul.appendChild(li);
      });
      block.appendChild(ul);
      main.appendChild(block);
    }

    var proj = camp.project ? bySlug(PROJECTS, camp.project) : null;
    if (proj) {
      var pb = node("section", "project-block");
      pb.appendChild(node("h2", "project-block-title", "Част от програма"));
      var pa = node("a", null, proj.title);
      pa.href = "projects/" + encodeURIComponent(proj.slug) + ".html";
      pb.appendChild(pa);
      main.appendChild(pb);
    }

    layout.appendChild(main);

    var side = node("div", "event-page-side");
    if (camp.image) {
      var cover = node("figure", "event-cover");
      var cimg = node("img");
      cimg.src = camp.image;
      cimg.alt = camp.title;
      cimg.decoding = "async";
      cover.appendChild(withWebp(cimg));
      side.appendChild(cover);
    }
    if (side.childNodes.length) layout.appendChild(side);

    page.appendChild(layout);
    document.title = camp.title + " — Фондация „Ела и ти“";
  }
})();
