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

  /* Приема дата или ISO низ; връща „14 ноември 2026“. */
  function dayText(value) {
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "";
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
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

  window.UI = { MONTHS: MONTHS, node: node, dayText: dayText, money: money,
                withWebp: withWebp, bySlug: bySlug };
})();
