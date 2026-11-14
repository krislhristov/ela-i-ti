/* Подновява числата на статичната страница на кампанията.
 *
 * Страницата идва с числата, записани при сглобяването (за търсачки и за хора
 * без JavaScript). Този файл чете campaign-live.js — същата бройка, която cron-ът
 * обновява два пъти дневно — и ако тя е по-нова, подменя текста.
 * Ако числата са по-стари от 48 часа, прогресът се скрива и остава само целта.
 */
(function () {
  var UI = window.UI || {};
  var MONTHS = UI.MONTHS || ["януари", "февруари", "март", "април", "май", "юни",
                             "юли", "август", "септември", "октомври", "ноември", "декември"];
  var STALE_HOURS = 48;

  var box = document.querySelector("[data-live-campaign]");
  var live = window.ELAITI_CAMPAIGN_LIVE || {};
  if (!box) return;

  var slug = box.getAttribute("data-live-campaign");
  var d = live[slug];
  if (!d || d.donated == null || d.target == null) return;

  function money(n) {
    return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " €";
  }

  function dayText(v) {
    var t = new Date(v);
    if (isNaN(t.getTime())) return "";
    return t.getDate() + " " + MONTHS[t.getMonth()] + " " + t.getFullYear();
  }

  function deadlineText(raw) {
    if (!raw) return "";
    var m = String(raw).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m) return Number(m[1]) + " " + MONTHS[Number(m[2]) - 1] + " " + m[3];
    return dayText(raw);
  }

  var age = (Date.now() - Date.parse(d.updated || "")) / 36e5;
  if (!isNaN(age) && age > STALE_HOURS) {
    box.innerHTML = '<p class="campaign-progress-row">Цел: ' + money(d.target) + "</p>" +
      '<p class="campaign-note">Числата не са обновени от ' + dayText(d.updated) +
      " — виж актуалните на страницата на кампанията.</p>";
    return;
  }

  var donated = box.querySelector("[data-live-donated]");
  var of = box.querySelector("[data-live-of]");
  var bar = box.querySelector("[data-live-bar]");
  var meta = box.querySelector("[data-live-meta]");
  var stamp = box.querySelector("[data-live-stamp]");

  if (donated) donated.textContent = money(d.donated);
  if (of) of.textContent = " от " + money(d.target);
  if (bar) bar.style.width = Math.max(0, Math.min(100, (d.donated / d.target) * 100)).toFixed(1) + "%";
  if (meta) {
    var bits = [];
    if (d.donors != null) bits.push(d.donors + " дарители");
    var dl = deadlineText(d.deadline);
    if (dl) bits.push("до " + dl);
    meta.textContent = bits.join(" · ");
  }
  if (stamp) stamp.textContent = "към " + dayText(d.updated);
})();
