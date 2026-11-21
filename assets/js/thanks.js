/* Страницата „Благодарим“: сумата се пита Stripe по номера на сесията,
   не се взима от адреса — там може да се напише каквото и да е. */
(function () {
  var out = document.querySelector("[data-thanks-text]");
  if (!out) return;

  var id = new URLSearchParams(window.location.search).get("session_id") || "";
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return;

  fetch("/pay/session.php?id=" + encodeURIComponent(id), { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data || !data.ok || !data.amount) return;
      var sum = (data.amount / 100).toFixed(2).replace(/\.00$/, "").replace(".", ",");
      if (data.status === "paid") {
        out.textContent = data.mode === "subscription"
          ? "Месечното дарение от " + sum + " € е активно. Благодарим ти, че си с нас."
          : "Дарението от " + sum + " € пристигна. Благодарим ти.";
      } else {
        out.textContent = "Плащането не е завършено. Ако сумата е излязла от картата, пиши ни.";
      }
    })
    .catch(function () {});
})();
