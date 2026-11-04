/* Брояч за числата в „Заедно постигнахме“.
   Числата се виждат веднага в HTML; скриптът ги връща на 0 и ги брои до
   крайната стойност, когато блокът влезе в екрана. Зачита
   prefers-reduced-motion и работи само веднъж. */
(function () {
  var els = [].slice.call(document.querySelectorAll("[data-count]"));
  if (!els.length) return;

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canObserve = "IntersectionObserver" in window;
  if (reduce || !canObserve) return;

  var items = [];
  els.forEach(function (el) {
    var raw = el.getAttribute("data-count") || el.textContent;
    var m = String(raw).match(/^(\d+)(\D*)$/);
    if (!m) return;
    items.push({ el: el, to: parseInt(m[1], 10), suffix: m[2] || "" });
  });
  if (!items.length) return;

  var DURATION = 2600;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function render(item, value) {
    item.el.textContent = value + item.suffix;
  }

  function run() {
    window.__countUpRan = true;
    items.forEach(function (item) { render(item, 0); });

    var start = null;
    function frame(now) {
      if (start === null) start = now;
      var t = Math.min((now - start) / DURATION, 1);
      var k = easeOutCubic(t);
      items.forEach(function (item) {
        render(item, Math.round(item.to * k));
      });
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        items.forEach(function (item) { render(item, item.to); });
      }
    }
    requestAnimationFrame(frame);
  }

  var observer = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (!entries[i].isIntersecting) continue;
      observer.disconnect();
      run();
      return;
    }
  }, { threshold: 0, rootMargin: "0px 0px -12% 0px" });

  observer.observe(els[0]);

  /* предпазна мрежа: ако нещо попречи на броенето, числата се връщат истински */
  setTimeout(function () {
    if (!window.__countUpRan) {
      items.forEach(function (item) { render(item, item.to); });
    }
  }, 6000);
})();
