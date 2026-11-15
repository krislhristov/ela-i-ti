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

  window.UI = { MONTHS: MONTHS, node: node, dayText: dayText, clock: clock,
                isoDay: isoDay, sofiaParts: sofiaParts, money: money,
                withWebp: withWebp, bySlug: bySlug };
})();
