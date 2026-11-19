/* Малките общи неща за страниците: възел, дата на български, пари, WebP, търсене по slug.
 *
 * Живее на едно място, за да не се разминават трите скрипта (събития, проекти,
 * кампании). Месеците са написани на ръка — така звучат правилно на български
 * („14 ноември 2026“), вместо да разчитаме на форматиране от браузъра.
 */
(function () {
  var MONTHS = ["януари", "февруари", "март", "април", "май", "юни",
                "юли", "август", "септември", "октомври", "ноември", "декември"];

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* Приема дата или ISO низ; връща „14 ноември 2026“.
     Датата се смята в София, а не в часовата зона на посетителя — иначе
     събитие в 00:00 може да покаже предния ден в Лондон или Ню Йорк. */
  var SOFIA_FORMAT = null;

  function sofiaParts(value) {
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return null;
    try {
      if (!SOFIA_FORMAT) {
        SOFIA_FORMAT = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Sofia",
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", hour12: false
        });
      }
      var parts = {};
      SOFIA_FORMAT.formatToParts(d).forEach(function (part) {
        if (part.type !== "literal") parts[part.type] = part.value;
      });
      return {
        year: Number(parts.year),
        month: Number(parts.month) - 1,
        day: Number(parts.day),
        hour: Number(parts.hour) % 24,
        minute: Number(parts.minute)
      };
    } catch (error) {
      return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate(),
               hour: d.getHours(), minute: d.getMinutes() };
    }
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function dayText(value) {
    var p = sofiaParts(value);
    return p ? p.day + " " + MONTHS[p.month] + " " + p.year : "";
  }

  function clock(value) {
    var p = sofiaParts(value);
    return p ? pad(p.hour) + ":" + pad(p.minute) : "";
  }

  function isoDay(value) {
    var p = sofiaParts(value);
    return p ? p.year + "-" + pad(p.month + 1) + "-" + pad(p.day) : "";
  }

  /* „3 674 €“ — интервал за хилядите, без стотинки. */
  function money(n) {
    return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " €";
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

  /* Една стрелка за целия сайт. Рисува се като SVG, защото буквата „→“ зависи
     от шрифта и на всяка система изглежда различно, а тук щрихът е един. */
  var SVG_NS = "http://www.w3.org/2000/svg";

  function arrow(back) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "ico-arrow" + (back ? " ico-arrow--back" : ""));
    svg.setAttribute("width", "17");
    svg.setAttribute("height", "13");
    svg.setAttribute("viewBox", "0 0 17 13");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", "M1 6.5h14M10 1.5l5 5-5 5");
    svg.appendChild(path);
    return svg;
  }

  function backLink(cls, text, href) {
    var a = node("a", cls);
    a.href = href;
    a.appendChild(arrow(true));
    a.appendChild(document.createTextNode(text));
    return a;
  }

  /* „Запиши се“ с две форми: бутон, който отваря панел с участник и доброволец.
     Живее тук, за да го ползват и списъкът, и слайдерът на началната страница.
     Без JavaScript същата връзка води към формата за участници. */
  function signupOption(href, ico, label) {
    var a = node("a", "event-signup-option");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.appendChild(node("span", "event-signup-ico", ico));
    a.appendChild(node("span", "event-signup-label", label));
    var go = node("span", "event-signup-go");
    go.appendChild(arrow());
    a.appendChild(go);
    return a;
  }

  function signup(ev, title) {
    var wrap = node("span", "event-signup");
    var trigger = node("a", "btn event-signup-trigger", "Запиши се");
    trigger.href = ev.signup || ev.signupVolunteer;
    trigger.target = "_blank";
    trigger.rel = "noopener";
    if (title) trigger.setAttribute("aria-label", "Запиши се за „" + title + "“");
    wrap.appendChild(trigger);

    if (!ev.signup || !ev.signupVolunteer) return wrap;

    trigger.setAttribute("aria-haspopup", "true");
    trigger.setAttribute("aria-expanded", "false");
    trigger.appendChild(node("span", "event-signup-chev"));

    var menu = node("span", "event-signup-menu");
    menu.appendChild(signupOption(ev.signup, "🏃", "Участник"));
    menu.appendChild(signupOption(ev.signupVolunteer, "🤝", "Доброволец"));
    wrap.appendChild(menu);
    return wrap;
  }

  window.UI = { MONTHS: MONTHS, node: node, dayText: dayText, clock: clock,
                isoDay: isoDay, sofiaParts: sofiaParts, money: money,
                withWebp: withWebp, bySlug: bySlug, arrow: arrow, backLink: backLink,
                signup: signup };
})();
