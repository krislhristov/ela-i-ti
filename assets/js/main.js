/* Фондация „Ела и ти“ — interactions
   Vanilla JS, no dependencies. Everything degrades gracefully. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp = function (v, min, max) { return Math.min(max, Math.max(min, v)); };

  /* ── Header state + scroll progress ───────────────────────────────────── */
  var header = document.querySelector("[data-header]");
  var progressBar = document.querySelector("[data-progress]");

  function onScrollFrame() {
    var y = window.scrollY || window.pageYOffset;
    var max = document.documentElement.scrollHeight - window.innerHeight;

    if (header) header.classList.toggle("is-stuck", y > 8);
    if (progressBar) {
      progressBar.style.transform = "scaleX(" + clamp(max > 0 ? y / max : 0, 0, 1) + ")";
    }
    drawProfile();
  }

  var ticking = false;
  function requestScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      onScrollFrame();
      ticking = false;
    });
  }

  /* ── Mobile menu ──────────────────────────────────────────────────────── */
  var toggle = document.querySelector("[data-nav-toggle]");
  var menu = document.querySelector("[data-mobile-menu]");
  var lastFocused = null;

  function setMenu(open) {
    if (!toggle || !menu) return;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    menu.hidden = !open;
    document.body.classList.toggle("menu-open", open);

    if (open) {
      lastFocused = document.activeElement;
      var first = menu.querySelector("a, button");
      if (first) first.focus();
    } else if (lastFocused) {
      lastFocused.focus();
    }
  }

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });

    menu.addEventListener("click", function (event) {
      if (event.target.closest("a")) setMenu(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        toggle.focus();
        return;
      }
      if (event.key !== "Tab" || menu.hidden) return;

      var focusable = menu.querySelectorAll("a, button");
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 980 && toggle.getAttribute("aria-expanded") === "true") setMenu(false);
    });
  }

  /* ── Current section in the navigation ────────────────────────────────── */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav a"));
  var sections = navLinks
    .map(function (link) { return document.getElementById(link.hash.slice(1)); })
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          navLinks.forEach(function (link) {
            if (link.hash === "#" + entry.target.id) link.setAttribute("aria-current", "true");
            else link.removeAttribute("aria-current");
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach(function (section) { spy.observe(section); });
  }

  /* ── Elevation profile: the line draws as the section arrives ─────────── */
  var profilePath = document.querySelector("[data-profile]");
  var profileNodes = document.querySelectorAll(".profile-nodes circle");
  var profileLength = 0;

  if (profilePath && profilePath.getTotalLength) {
    profileLength = profilePath.getTotalLength();
    profilePath.style.strokeDasharray = profileLength;

    if (reduceMotion) {
      profilePath.style.strokeDashoffset = 0;
    } else {
      profilePath.style.strokeDashoffset = profileLength;
      Array.prototype.forEach.call(profileNodes, function (node) {
        node.style.opacity = "0.35";
        node.style.transition = "opacity .5s ease";
      });
    }
  }

  function drawProfile() {
    if (!profilePath || !profileLength || reduceMotion) return;

    var rect = profilePath.getBoundingClientRect();
    var span = window.innerHeight * 0.45;
    var t = clamp((window.innerHeight * 1.02 - rect.top) / span, 0, 1);

    profilePath.style.strokeDashoffset = profileLength * (1 - t);
    Array.prototype.forEach.call(profileNodes, function (node, index) {
      node.classList.toggle("is-reached", t > (index + 0.85) / 4.2);
    });
  }

  /* ── Копиране на банковите данни ──────────────────────────────────────── */
  (function () {
    var buttons = document.querySelectorAll("[data-copy]");
    if (!buttons.length) return;
    var status = document.querySelector("[data-copy-status]");

    function announce(message) {
      if (!status) return;
      status.textContent = message;
      window.setTimeout(function () {
        if (status.textContent === message) status.textContent = "";
      }, 3200);
    }

    function selectValue(node) {
      if (!window.getSelection) return;
      var range = document.createRange();
      range.selectNodeContents(node);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    function fallbackCopy(value) {
      var area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(area);
      return ok;
    }

    Array.prototype.forEach.call(buttons, function (button) {
      button.addEventListener("click", function () {
        var row = button.closest(".copy-row");
        var valueNode = row ? row.querySelector("[data-copy-value]") : null;
        if (!valueNode) return;
        var value = valueNode.textContent.trim();

        function done() {
          button.classList.add("is-done");
          window.setTimeout(function () { button.classList.remove("is-done"); }, 1800);
          announce("Копирано: " + value);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(value).then(done, function () {
            if (fallbackCopy(value)) {
              done();
              return;
            }
            selectValue(valueNode);
            announce("Маркирах стойността — натисни Ctrl+C.");
          });
        } else if (fallbackCopy(value)) {
          done();
        } else {
          selectValue(valueNode);
          announce("Маркирах стойността — натисни Ctrl+C.");
        }
      });
    });
  })();

  /* ── Contact form ─────────────────────────────────────────────────────── */
  var form = document.querySelector("[data-form]");
  var formStatus = document.querySelector("[data-form-status]");

  var messages = {
    name: {
      empty: "Напиши името си, за да знаем как да те наричаме.",
      invalid: "Напиши името си, за да знаем как да те наричаме."
    },
    email: {
      empty: "Нужен ни е имейл, за да можем да отговорим.",
      invalid: "Провери имейла — изглежда непълен."
    },
    message: {
      empty: "Напиши няколко думи за това, което те интересува.",
      invalid: "Напиши няколко думи за това, което те интересува."
    }
  };

  function fieldError(input) {
    return document.getElementById(input.id + "-error");
  }

  function validateField(input) {
    var value = input.value.trim();
    var type = input.getAttribute("data-type");
    var error = fieldError(input);
    var message = "";

    if (!value) {
      message = messages[input.name] ? messages[input.name].empty : "Попълни полето.";
    } else if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      message = messages.email.invalid;
    }

    if (error) {
      error.textContent = message;
      error.hidden = !message;
    }
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");

    return !message;
  }

  if (form) {
    var required = Array.prototype.slice.call(form.querySelectorAll("[data-required]"));

    required.forEach(function (input) {
      input.addEventListener("blur", function () {
        if (input.value.trim() || input.getAttribute("aria-invalid") === "true") validateField(input);
      });
      input.addEventListener("input", function () {
        if (input.getAttribute("aria-invalid") === "true") validateField(input);
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var firstInvalid = null;
      required.forEach(function (input) {
        var valid = validateField(input);
        if (!valid && !firstInvalid) firstInvalid = input;
      });

      if (firstInvalid) {
        firstInvalid.focus();
        announce(formStatus, "Провери отбелязаните полета и опитай отново.");
        return;
      }

      var name = form.elements.name.value.trim();
      var email = form.elements.email.value.trim();
      var message = form.elements.message.value.trim();

      var subject = "Запитване от сайта — " + name;
      var body = message + "\n\n—\n" + name + "\n" + email;
      var href = "mailto:info@elaiti.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);

      announce(formStatus, "Отваряме твоята пощенска програма с готово съобщение до info@elaiti.com.");
      window.location.href = href;
    });
  }

  /* ── Horizontal sliders (previous events) ─────────────────────────────── */
  Array.prototype.forEach.call(document.querySelectorAll("[data-slider]"), function (root) {
    var viewport = root.querySelector("[data-slider-viewport]");
    var track = root.querySelector("[data-slider-track]");
    var dotsWrap = root.querySelector("[data-slider-dots]");
    var prev = root.querySelector("[data-slider-prev]");
    var next = root.querySelector("[data-slider-next]");
    if (!viewport || !track || !prev || !next) return;

    var slides = Array.prototype.slice.call(track.children);
    if (slides.length < 2) {
      prev.hidden = true;
      next.hidden = true;
      if (dotsWrap) dotsWrap.hidden = true;
      return;
    }

    var dots = [];

    function gap() {
      var cs = getComputedStyle(track);
      var g = parseFloat(cs.columnGap || cs.gap);
      return isNaN(g) ? 0 : g;
    }
    function step() {
      return slides[0].getBoundingClientRect().width + gap();
    }
    function index() {
      var s = step();
      return s ? Math.round(viewport.scrollLeft / s) : 0;
    }
    function go(i) {
      var n = Math.max(0, Math.min(slides.length - 1, i));
      viewport.scrollTo({ left: n * step(), behavior: reduceMotion ? "auto" : "smooth" });
    }
    function sync() {
      var i = index();
      dots.forEach(function (dot, k) {
        if (k === i) dot.setAttribute("aria-current", "true");
        else dot.removeAttribute("aria-current");
        dot.tabIndex = k === i ? 0 : -1;
      });
      prev.disabled = i <= 0;
      next.disabled = i >= slides.length - 1;
    }

    slides.forEach(function (slide, i) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "slider-dot";
      dot.setAttribute("aria-label", "Слайд " + (i + 1) + " от " + slides.length);
      dot.addEventListener("click", function () { go(i); });
      if (dotsWrap) dotsWrap.appendChild(dot);
      dots.push(dot);
    });

    prev.addEventListener("click", function () { go(index() - 1); });
    next.addEventListener("click", function () { go(index() + 1); });
    viewport.addEventListener("scroll", function () {
      window.requestAnimationFrame(sync);
    }, { passive: true });
    viewport.addEventListener("keydown", function (event) {
      if (event.key === "ArrowRight") { event.preventDefault(); go(index() + 1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); go(index() - 1); }
    });
    window.addEventListener("resize", sync);

    sync();
  });

  /* ── Year ─────────────────────────────────────────────────────────────── */
  var year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ── Media page: filters + inline players ─────────────────────────────── */
  var storyList = document.querySelector("[data-stories]");
  if (storyList) {
    var filters = document.querySelector("[data-filters]");
    if (filters) {
      filters.addEventListener("click", function (event) {
        var btn = event.target.closest(".filter");
        if (!btn) return;
        var kind = btn.dataset.filter;
        Array.prototype.forEach.call(filters.querySelectorAll(".filter"), function (b) {
          var on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        Array.prototype.forEach.call(storyList.querySelectorAll(".story"), function (card) {
          card.hidden = kind !== "all" && card.dataset.kind !== kind;
          if (card.hidden && card.classList.contains("is-playing")) resetCard(card);
        });
      });
    }

    var focusPlay = function (card) {
      var play = card.querySelector(".story-play");
      if (play) play.focus();
    };

    var resetCard = function (card) {
      if (card._original !== undefined) {
        card.querySelector(".story-media").innerHTML = card._original;
        card._original = undefined;
      }
      card.classList.remove("is-playing");
    };

    var addCloseButton = function (card, media) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "story-close";
      btn.setAttribute("aria-label", card.dataset.video ? "Затвори видеото" : "Затвори записа");
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
                      '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" ' +
                      'stroke-width="2" stroke-linecap="round"/></svg>';
      btn.addEventListener("click", function () {
        resetCard(card);
        focusPlay(card);
      });
      media.appendChild(btn);
    };

    var playVideo = function (card) {
      var media = card.querySelector(".story-media");
      var title = card.querySelector(".story-title");
      card._original = media.innerHTML;
      card.classList.add("is-playing");
      media.textContent = "";

      var frame = document.createElement("iframe");
      frame.src = "https://www.youtube-nocookie.com/embed/" + card.dataset.video +
                  "?autoplay=1&rel=0&modestbranding=1&playsinline=1";
      frame.title = title ? title.textContent.trim() : "Видео";
      frame.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
      frame.setAttribute("allowfullscreen", "");
      frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      media.appendChild(frame);
      addCloseButton(card, media);
      frame.focus();
    };

    var playAudio = function (card) {
      var media = card.querySelector(".story-media");
      card._original = media.innerHTML;
      card.classList.add("is-playing");
      media.textContent = "";

      var panel = document.createElement("div");
      panel.className = "story-audio";

      var label = document.createElement("span");
      label.className = "story-audio-label";
      label.textContent = card.dataset.label || "Аудиозапис";

      var audio = document.createElement("audio");
      audio.controls = true;
      audio.preload = "metadata";
      audio.src = card.dataset.audio;
      audio.setAttribute("aria-label", label.textContent);

      panel.appendChild(label);
      panel.appendChild(audio);
      media.appendChild(panel);
      addCloseButton(card, media);

      var playing = audio.play();
      if (playing && playing.catch) playing.catch(function () {});
      audio.focus();
    };

    storyList.addEventListener("click", function (event) {
      var card = event.target.closest(".story");
      if (!card) return;

      /* затварянето се обработва от самия бутон */
      if (event.target.closest(".story-close")) return;

      /* статиите се държат като обикновени линкове */
      if (!card.dataset.video && !card.dataset.audio) return;

      /* докато играе, кликовете отиват към плейъра */
      if (card.classList.contains("is-playing")) return;

      var inMedia = event.target.closest(".story-media");
      var isControl = event.target.closest(".story-play, button.story-arrow");
      if (!inMedia && !isControl) return;

      event.preventDefault();
      Array.prototype.forEach.call(storyList.querySelectorAll(".story.is-playing"), resetCard);

      if (card.dataset.video) playVideo(card);
      else playAudio(card);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" && event.key !== "Esc") return;
      var open = storyList.querySelectorAll(".story.is-playing");
      if (!open.length) return;
      Array.prototype.forEach.call(open, resetCard);
      focusPlay(open[0]);
    });
  }

  /* ── Events page: scroll story ────────────────────────────────────────── */
  var journey = document.querySelector("[data-journey]");
  if (journey && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var stage = journey.querySelector("[data-stage]");
    var photos = Array.prototype.slice.call(journey.querySelectorAll("[data-photo]"));
    var copies = Array.prototype.slice.call(journey.querySelectorAll("[data-copy]"));
    var counter = journey.querySelector("[data-count]");
    var trail = journey.querySelector("[data-trail]");
    var trailFill = journey.querySelector("[data-trail-fill]");
    var rider = journey.querySelector("[data-rider]");
    var marks = journey.querySelector("[data-marks]");
    var total = copies.length;

    if (total && trailFill && rider) {
      journey.style.setProperty("--steps", total);
      journey.classList.add("is-enhanced");

      var pathLen = trailFill.getTotalLength();
      trailFill.style.strokeDasharray = pathLen + "px";
      trailFill.style.strokeDashoffset = pathLen + "px";

      var dots = [];
      for (var d = 0; d < total; d++) {
        var dotPt = trailFill.getPointAtLength(((d + 0.5) / total) * pathLen);
        var dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", dotPt.x);
        dot.setAttribute("cy", dotPt.y);
        dot.setAttribute("r", 5);
        marks.appendChild(dot);
        dots.push(dot);
      }

      var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
      var activeIdx = -1;
      var queued = false;

      var riderScale = function () {
        var w = trail.getBoundingClientRect().width || 1200;
        return clamp(1200 / w, 0.95, 2.4);
      };

      var render = function () {
        queued = false;

        var head = parseFloat(window.getComputedStyle(stage).top) || 0;
        var rect = journey.getBoundingClientRect();
        var span = journey.offsetHeight - stage.offsetHeight;
        var progress = span > 0 ? clamp((head - rect.top) / span, 0, 1) : 0;
        var step = progress * total;

        var idx = Math.min(total - 1, Math.floor(step));
        if (idx !== activeIdx) {
          activeIdx = idx;
          copies.forEach(function (c, i) { c.classList.toggle("is-active", i === idx); });
          if (counter) counter.textContent = ("0" + (idx + 1)).slice(-2);
        }

        for (var i = 0; i < photos.length; i++) {
          /* всяка снимка „пада“ върху купчината точно когато текстът се сменя */
          var t = clamp((step - (i - 0.45)) / 0.45, 0, 1);
          var eased = 1 - Math.pow(1 - t, 3);
          var behind = Math.min(2, Math.max(0, step - i)) * 5;
          var rot = (-7 + i * 3.5) * eased - behind * 0.4;
          var tx = (1 - eased) * (i % 2 ? 26 : -20) - behind;
          var ty = (1 - eased) * 64 - behind;
          var sc = (0.94 + 0.06 * eased) - behind * 0.005;

          photos[i].style.transform =
            "translate(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px) rotate(" + rot.toFixed(2) +
            "deg) scale(" + sc.toFixed(3) + ")";
          photos[i].style.opacity = t > 0.002 ? "1" : "0";
          photos[i].style.zIndex = String(i + 1);
        }

        trailFill.style.strokeDashoffset = (pathLen * (1 - progress)) + "px";

        var dist = pathLen * progress;
        var pt = trailFill.getPointAtLength(dist);
        var ahead = trailFill.getPointAtLength(Math.min(pathLen, dist + 14));
        var angle = clamp(Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180 / Math.PI, -22, 22);

        rider.setAttribute("transform",
          "translate(" + pt.x.toFixed(1) + " " + pt.y.toFixed(1) + ") rotate(" +
          angle.toFixed(1) + ") scale(" + (riderScale() * 1.05).toFixed(2) + ")");

        dots.forEach(function (dot, i) {
          dot.classList.toggle("is-past", progress >= (i + 0.5) / total - 0.01);
        });
      };

      var onScroll = function () {
        if (!queued) { queued = true; window.requestAnimationFrame(render); }
      };

      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      render();
    }
  }

  /* ── Hero banner: сменящи се снимки ───────────────────────────────────── */
  (function () {
    var banner = document.querySelector("[data-banner]");
    if (!banner) return;
    var slides = Array.prototype.slice.call(banner.querySelectorAll("[data-slide]"));
    var texts = Array.prototype.slice.call(banner.querySelectorAll("[data-text]"));
    if (slides.length < 2) return;

    var DURATION = 4000;
    var index = 0;
    var timer = null;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    slides.forEach(function (slide, i) {
      slide.setAttribute("aria-hidden", i === 0 ? "false" : "true");
    });

    function sync() {
      slides.forEach(function (slide, i) {
        slide.classList.toggle("is-active", i === index);
        slide.setAttribute("aria-hidden", i === index ? "false" : "true");
      });
      texts.forEach(function (text, i) {
        text.classList.toggle("is-active", i === index);
        text.setAttribute("aria-hidden", i === index ? "false" : "true");
      });
    }

    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    function start() {
      stop();
      if (reduce.matches || document.hidden) return;
      timer = window.setInterval(function () {
        index = (index + 1) % slides.length;
        sync();
      }, DURATION);
    }

    banner.addEventListener("mouseenter", stop);
    banner.addEventListener("mouseleave", start);
    banner.addEventListener("focusin", stop);
    banner.addEventListener("focusout", start);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) start(); else stop();
        });
      }, { threshold: 0.15 }).observe(banner);
    } else {
      start();
    }

    sync();
  })();

  /* ── Избор на сума за дарение ─────────────────────────────────────────── */
  (function () {
    var box = document.querySelector("[data-amounts]");
    if (!box) return;
    var select = box.querySelector("[data-amount-select]");
    var cta = box.querySelector("[data-amount-cta]");
    if (!select || !cta) return;

    var base = "Дари";
    /* Подписаният линк на ePay: сменя се само total, checksum-ът е общ за всички суми. */
    var EPAY = "https://www.epay.bg/v3main/paylogin?min=1801952452&total={sum}"
      + "&checksum=7fa7e69cd0aae19b07aab606a5fef6bb577c4028"
      + "&descr=%D0%94%D0%B0%D1%80%D0%B5%D0%BD%D0%B8%D0%B5&encoding=utf8"
      + "&url_ok=https%3A%2F%2Fwww.epay.bg%2Fv3main%2Ffront%3Fp%3Dthanks"
      + "&url_cancel=https%3A%2F%2Fwww.epay.bg%2Fv3main%2Ffront%3Fp%3Dcancel";

    function sync() {
      var sum = select.value;
      if (sum) {
        cta.textContent = base + " " + sum + " €";
        cta.href = EPAY.replace("{sum}", encodeURIComponent(sum));
        cta.removeAttribute("aria-disabled");
      } else {
        cta.textContent = base;
        cta.setAttribute("aria-disabled", "true");
      }
    }

    select.addEventListener("change", sync);

    cta.addEventListener("click", function (event) {
      if (cta.getAttribute("aria-disabled") === "true") {
        event.preventDefault();
        select.focus();
      }
    });

    sync();
  })();

  /* ── Wire up scrolling ────────────────────────────────────────────────── */
  window.addEventListener("scroll", requestScroll, { passive: true });
  window.addEventListener("resize", requestScroll);
  onScrollFrame();
})();
