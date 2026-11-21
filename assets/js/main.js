/* Фондация „Ела и ти“ — interactions
   Vanilla JS, no dependencies. Everything degrades gracefully. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp = function (v, min, max) { return Math.min(max, Math.max(min, v)); };

  /* ── Header state ─────────────────────────────────────────────────────── */
  var header = document.querySelector("[data-header]");

  function onScrollFrame() {
    var y = window.scrollY || window.pageYOffset;

    if (header) header.classList.toggle("is-stuck", y > 8);
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
  /* Дали последното действие е било с клавиатура. Само тогава местим
     фокуса в менюто — иначе при докосване около „Начало“ светва
     оранжевият focus ring, който не значи нищо за потребителя. */
  var keyboardNav = false;
  document.addEventListener("keydown", function () { keyboardNav = true; }, true);
  document.addEventListener("pointerdown", function () { keyboardNav = false; }, true);

  function setMenu(open) {
    if (!toggle || !menu) return;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    menu.hidden = !open;
    document.body.classList.toggle("menu-open", open);

    if (open) {
      lastFocused = document.activeElement;
      if (keyboardNav) {
        var first = menu.querySelector("a, button");
        if (first) first.focus();
      }
    } else if (lastFocused && keyboardNav) {
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

    /* „Дари сега“ в хедъра: при отворено меню то покрива екрана и скокът
       към секцията остава невидим — затова първо затваряме. */
    document.addEventListener("click", function (event) {
      if (!event.target.closest(".header-actions .btn")) return;
      if (toggle.getAttribute("aria-expanded") === "true") setMenu(false);
    });

    /* Докосване извън менюто го затваря. Иначе то остава отворено и
       следващото докосване, прицелено в страницата под него (например
       бутона „Дари сега“ в началото), попада върху меню-връзка — на
       телефон „Медии“ лежи точно на мястото на този бутон. */
    document.addEventListener("pointerdown", function (event) {
      if (toggle.getAttribute("aria-expanded") !== "true") return;
      if (menu.contains(event.target) || toggle.contains(event.target)) return;
      setMenu(false);
    }, true);

    /* iOS връща страницата от кеша със запазено състояние: менюто може да
       се върне отворено и скролът заключен. Затова го затваряме. */
    window.addEventListener("pageshow", function (event) {
      if (event.persisted) setMenu(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        toggle.focus();
        return;
      }
      if (event.key !== "Tab" || menu.hidden) return;

      var focusable = [toggle].concat(Array.prototype.slice.call(menu.querySelectorAll("a, button")));
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

  /* ── Няма залепнала подсветка след докосване ──────────────────────────── */
  /* На телефон браузърът оставя :focus/:focus-within върху натиснатия бутон,
     докато човек не натисне другаде — синият/оранжев кант изглежда като бъг.
     След докосване махаме фокуса, освен ако целта не е поле за писане. */
  if (window.matchMedia && window.matchMedia("(hover: none)").matches) {
    document.addEventListener("pointerup", function (event) {
      var el = event.target && event.target.closest
        ? event.target.closest("button, a, [role='button'], .filter, .project-chip, .slider-dot, .slider-btn, .story-close, .copy-btn, .email-chip, .nav-toggle")
        : null;
      if (!el || !el.blur) return;
      window.setTimeout(function () {
        if (document.activeElement === el) el.blur();
      }, 0);
    }, true);
  }

  /* ── Current section in the navigation ────────────────────────────────── */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav a"))
    /* „Контакти“ води към секция на същата страница — не искаме оранжевата
       черта под нея, докато се скролва надолу */
    .filter(function (link) { return link.hash !== "#contact"; });
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

    var TICK = '<svg class="copy-tick" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">'
      + '<path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="currentColor" '
      + 'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    Array.prototype.forEach.call(buttons, function (button) {
      button.insertAdjacentHTML("beforeend", TICK);
      button.addEventListener("click", function () {
        var row = button.closest(".copy-row");
        var valueNode = row ? row.querySelector("[data-copy-value]") : null;
        if (!valueNode) return;
        var value = valueNode.textContent.trim();

        function done() {
          button.classList.add("is-done");
          window.clearTimeout(button.__copyTimer);
          button.__copyTimer = window.setTimeout(function () {
            button.classList.remove("is-done");
          }, 3000);
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
      short: "Името е твърде кратко.",
      invalid: "Името съдържа невалиден знак."
    },
    email: {
      empty: "Нужен ни е имейл, за да можем да отговорим.",
      invalid: "Невалиден/непълен имейл адрес."
    },
    message: {
      empty: "Напиши няколко думи за това, което те интересува.",
      short: "Съобщението е твърде кратко."
    }
  };

  // Правилата са същите и в tools/contact.php — клиентските се заобикалят.
  var limits = {
    name: { min: 2, max: 50 },
    email: { max: 100 },
    message: { min: 10, max: 2000 }
  };

  // Букви (всяка азбука), комбиниращи знаци, интервал, апостроф, тире, точка.
  var NAME_HAS_LETTER = /\p{L}/u;
  var FORBIDDEN_CHAR = /[^\p{L}\p{M}\s'\u2019.\-·]/u;
  var EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function charLength(value) {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      if (!charLength.segmenter) {
        charLength.segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
      }
      var count = 0;
      var iterator = charLength.segmenter.segment(value)[Symbol.iterator]();
      while (!iterator.next().done) count++;
      return count;
    }
    return Array.from(value).length;
  }

  function emailIsValid(value) {
    if (charLength(value) > limits.email.max) return false;
    if (!EMAIL_SHAPE.test(value)) return false;
    if (value.indexOf("..") > -1) return false;
    var parts = value.split("@");
    if (parts[0].length > 64) return false;
    if (parts[0].charAt(0) === "." || parts[0].slice(-1) === ".") return false;
    var domain = parts[1];
    if (domain.charAt(0) === "." || domain.slice(-1) === "." || domain.charAt(0) === "-") return false;
    return domain.split(".").every(function (label) {
      return label.length > 0 && label.length <= 63 && !/^-|-$/.test(label);
    });
  }

  function fieldError(input) {
    return document.getElementById(input.id + "-error");
  }

  function validateField(input) {
    var value = input.value.replace(/\s+/gu, " ").trim();
    var type = input.getAttribute("data-type");
    var rule = limits[input.name] || {};
    var error = fieldError(input);
    var message = "";

    if (!value) {
      message = messages[input.name] ? messages[input.name].empty : "Попълни полето.";
    } else if (type === "email") {
      if (!emailIsValid(value)) message = messages.email.invalid;
    } else if (input.name === "name") {
      var bad = value.match(FORBIDDEN_CHAR);
      if (bad) {
        message = "Знакът \u201E" + bad[0] + "\u201C е невалиден.";
      } else if (!NAME_HAS_LETTER.test(value) || charLength(value) < rule.min) {
        message = messages.name.short;
      }
    } else if (input.name === "message") {
      if (charLength(value) < rule.min) message = messages.message.short;
    }

    if (error) {
      error.textContent = message;
      error.hidden = !message;
    }
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");

    return !message;
  }

  function updateCounter(input) {
    var el = document.getElementById(input.id + "-counter");
    if (!el) return;
    var max = parseInt(el.getAttribute("data-counter-max") || "0", 10);
    var near = parseInt(el.getAttribute("data-counter-remaining") || "0", 10);
    var used = charLength(input.value);
    var left = max - used;

    if (!max) return;

    if (near) {
      // Показва се само в последните няколко знака — например за името.
      el.textContent = left > 0 && left <= near ? "остават " + left + " знака" : "";
      el.hidden = !(left > 0 && left <= near);
    } else {
      el.textContent = used + " / " + max;
      el.hidden = used === 0;
      el.classList.toggle("is-near", left <= Math.max(50, max * 0.05));
    }
  }

  function setFormStatus(message, isError) {
    if (!formStatus) return;
    formStatus.textContent = message;
    formStatus.classList.toggle("is-error", !!isError);
    window.clearTimeout(formStatus.__statusTimer);
    if (!isError) {
      formStatus.__statusTimer = window.setTimeout(function () {
        if (formStatus.textContent === message) formStatus.textContent = "";
      }, 6000);
    }
  }

  if (form) {
    var required = Array.prototype.slice.call(form.querySelectorAll("[data-required]"));

    var formLoadedAt = Date.now();

    function resetForm() {
      form.reset();
      required.forEach(function (input) {
        updateCounter(input);
        input.removeAttribute("aria-invalid");
        var error = fieldError(input);
        if (error) {
          error.textContent = "";
          error.hidden = true;
        }
      });
      if (chipsWrap) chipsWrap.hidden = true;
      formLoadedAt = Date.now();
    }

    required.forEach(function (input) {
      input.addEventListener("blur", function () {
        if (input.value.trim() || input.getAttribute("aria-invalid") === "true") validateField(input);
      });
      input.addEventListener("input", function () {
        updateCounter(input);
        if (input.getAttribute("data-type") === "email") syncChips();
        if (input.getAttribute("aria-invalid") === "true") validateField(input);
      });
      updateCounter(input);
    });

    // Пълни домейна само когато полето е точно „нещо@“ — не пречи при писане.
    var chipsWrap = document.querySelector("[data-email-chips]");
    var CHIP_DOMAINS = ["gmail.com", "abv.bg"];

    function syncChips() {
      if (!chipsWrap) return;
      chipsWrap.hidden = !/^[^\s@]+@$/.test(form.elements.email.value);
    }

    if (chipsWrap) {
      CHIP_DOMAINS.forEach(function (domain) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "email-chip";
        chip.textContent = "@" + domain;
        chip.addEventListener("click", function () {
          var field = form.elements.email;
          field.value = field.value.replace(/\s+$/, "") + domain;
          chipsWrap.hidden = true;
          validateField(field);
          field.focus();
        });
        chipsWrap.appendChild(chip);
      });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      // Ботовете попълват за части от секундата. Не казваме „изпратено“, защото
      // нищо не е изпратено — човек с autofill може да опита отново.
      if (Date.now() - formLoadedAt < 3000) {
        setFormStatus("Изчакай секунда и опитай отново.", true);
        return;
      }

      var firstInvalid = null;
      required.forEach(function (input) {
        var valid = validateField(input);
        if (!valid && !firstInvalid) firstInvalid = input;
      });

      if (firstInvalid) {
        firstInvalid.focus();
        setFormStatus("Провери отбелязаните полета и опитай отново.", true);
        return;
      }

      if (form.elements["_honey"] && form.elements["_honey"].value) {
        setFormStatus("Благодарим! Съобщението е изпратено.");
        resetForm();
        return;
      }

      // Адресът идва от action на формата — едно място за смяна при миграция.
      // formsubmit.co приема AJAX заявки на /ajax/ адрес; contact.php отговаря сам.
      var action = form.getAttribute("action") || "";
      if (!action) {
        setFormStatus("Формата не е настроена. Пиши ни на info@elaiti.com.", true);
        return;
      }
      var endpoint = action.replace("formsubmit.co/", "formsubmit.co/ajax/");
      var button = form.querySelector('button[type="submit"]');
      var label = button ? button.textContent : "";
      var data = new FormData(form);
      data.delete("_honey");

      if (button) {
        button.disabled = true;
        button.textContent = "Изпращаме…";
      }
      setFormStatus("Изпращаме съобщението…");

      var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = controller ? window.setTimeout(function () { controller.abort(); }, 15000) : 0;
      var options = { method: "POST", body: data, headers: { Accept: "application/json" } };
      if (controller) options.signal = controller.signal;

      fetch(endpoint, options)
        .then(function (response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
          // Релеят отговаря с JSON, но с Content-Type text/html — затова се разчита на
          // съдържанието, не на заглавката.
          return response.text().then(function (text) {
            try {
              return JSON.parse(text);
            } catch (error) {
              throw new Error("unexpected response");
            }
          });
        })
        .then(function (result) {
          var ok = result && (result.success === true || result.success === "true" || result.ok === true);
          if (!ok) throw new Error((result && result.message) || "not accepted");
          resetForm();
          setFormStatus("Благодарим! Съобщението е изпратено — ще отговорим на посочения имейл.");
        })
        .catch(function (error) {
          setFormStatus(error && error.name === "AbortError"
            ? "Изпращането се забави. Провери връзката и опитай отново."
            : "Съобщението не тръгна. Опитай отново или ни пиши на info@elaiti.com.", true);
        })
        .then(function () {
          if (timer) window.clearTimeout(timer);
          if (button) {
            button.disabled = false;
            button.textContent = label;
          }
        });
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
      prev.disabled = false;
      next.disabled = false;
      prev.setAttribute("aria-disabled", i <= 0 ? "true" : "false");
      next.setAttribute("aria-disabled", i >= slides.length - 1 ? "true" : "false");
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

    prev.addEventListener("click", function () {
      if (index() <= 0) return;
      go(index() - 1);
    });
    next.addEventListener("click", function () {
      if (index() >= slides.length - 1) return;
      go(index() + 1);
    });
    if (dotsWrap) {
      dotsWrap.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        var n = Math.max(0, Math.min(slides.length - 1,
          index() + (event.key === "ArrowRight" ? 1 : -1)));
        go(n);
        if (dots[n]) dots[n].focus();
      });
    }
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
      // Броят до всеки филтър се смята от самите карти, за да не се разминава
      // с това, което страницата наистина съдържа.
      var counts = { all: 0, article: 0, video: 0, audio: 0 };
      Array.prototype.forEach.call(storyList.querySelectorAll(".story"), function (card) {
        counts.all += 1;
        var kindName = card.dataset.kind;
        if (kindName && counts[kindName] !== undefined) counts[kindName] += 1;
      });
      Array.prototype.forEach.call(filters.querySelectorAll(".filter"), function (b) {
        var span = b.querySelector("span");
        var value = counts[b.dataset.filter];
        if (span && value !== undefined) span.textContent = String(value);
      });

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

  /* Слайдерът „Предстоящи събития“ се строи в assets/js/upcoming.js. */

  /* ── Клавиатура срещу докосване ────────────────────────────────────────
     Слагаме клас „kbd“ на <html>, когато човекът работи с клавиатура, за да
     показваме focus ring само тогава. Иначе при докосване остават видими
     състояния, които не значат нищо. */
  (function () {
    var root = document.documentElement;
    document.addEventListener("keydown", function () { root.classList.add("kbd"); }, true);
    document.addEventListener("pointerdown", function () { root.classList.remove("kbd"); }, true);
  })();

  /* ── Дарение с карта ────────────────────────────────────────────────────
     Формата се праща към /pay/create.php, който прави Checkout сесия в Stripe.
     Тук само държим полето, бутоните за сума и надписа на бутона в синхрон.
     Без JavaScript формата пак работи: полето има стойност, а „Еднократно“ е
     избрано по подразбиране. */
  (function () {
    var form = document.querySelector("[data-donate]");
    if (!form) return;

    var field = form.querySelector(".sum-input");
    var chips = form.querySelectorAll("[data-amount]");
    var cta = form.querySelector(".pay-cta");
    var period = form.querySelector("[data-period]");
    var error = form.querySelector(".pay-error");
    var modes = form.querySelectorAll('input[name="mode"]');
    if (!field || !cta) return;

    var MAX = 100000;

    function monthly() {
      var on = form.querySelector('input[name="mode"]:checked');
      return !!on && on.value === "monthly";
    }

    /* В полето влизат само цифри, най-много шест; хилядите се пишат със запетая. */
    function digits() {
      return field.value.replace(/\D+/g, "").slice(0, 6);
    }

    function withCommas(value) {
      return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function sync() {
      var sum = digits();
      var shown = withCommas(sum);
      if (field.value !== shown) {
        var before = field.value.slice(0, field.selectionStart || 0).replace(/\D/g, "").length;
        field.value = shown;
        var pos = 0;
        var seen = 0;
        while (pos < shown.length && seen < before) {
          if (shown.charAt(pos) >= "0" && shown.charAt(pos) <= "9") seen++;
          pos++;
        }
        try { field.setSelectionRange(pos, pos); } catch (e) {}
      }
      var over = Number(sum) > MAX;
      if (error) error.hidden = !over;
      cta.disabled = over || !sum;
      cta.textContent = sum && !over
        ? "Дари " + shown + " €" + (monthly() ? " месечно" : "")
        : "Дари";
      if (period) period.hidden = !monthly();
      Array.prototype.forEach.call(chips, function (chip) {
        var on = chip.dataset.amount === sum;
        chip.classList.toggle("is-on", on);
        chip.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    Array.prototype.forEach.call(chips, function (chip) {
      chip.addEventListener("click", function () {
        field.value = chip.dataset.amount;
        sync();
      });
    });

    field.addEventListener("input", sync);
    field.addEventListener("keydown", function (event) {
      if (event.key.length === 1 && !/[0-9]/.test(event.key) && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
      }
    });
    Array.prototype.forEach.call(modes, function (radio) {
      radio.addEventListener("change", sync);
    });

    sync();
  })();

  /* ── Wire up scrolling ────────────────────────────────────────────────── */
  window.addEventListener("scroll", requestScroll, { passive: true });
  window.addEventListener("resize", requestScroll);
  onScrollFrame();
})();

/* Влизане в страница с #hash (например events.html#past):
   списъците се строят с JavaScript, затова браузърът често scrollва
   преди да са готови. Тук scrollваме отново и слагаме фокуса върху
   секцията, за да е ясно къде е човек — и с клавиатура, и с екранен четец. */
(function () {
  var id = (window.location.hash || "").slice(1);
  if (!id) return;
  var el = document.getElementById(id);
  if (!el) return;
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  var go = function () {
    el.scrollIntoView({ block: "start" });
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  };
  requestAnimationFrame(go);
})();

/* Скок към секция по #връзка в същата страница — изцяло наш.

   Преди оставяхме браузъра да скролира (scroll-behavior: smooth) и после
   коригирахме. На iOS Safari това даваше две-три движения: до „Новини и
   истории“, после до даренията, а през тунела — долу, горе, пак долу,
   защото анимацията на браузъра и нашата корекция се биеха.

   Сега има само едно движение и то е наше: рисуваме го кадър по кадър с
   requestAnimationFrame, като за целия скок изключваме плавността от CSS.
   Накрая слагаме точната позиция, изчислена по живото положение на
   секцията. Докосване, колелце или клавиш го спират веднага. */
(function () {
  var SELECTOR = 'a[href^="#"]';
  if (!document.querySelector(SELECTOR)) return;

  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var frame = null;
  var restore = null;
  var watchdog = 0;

  var pad = function () {
    return parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
  };
  var topOf = function (el) {
    return Math.max(0, Math.round(el.getBoundingClientRect().top + window.pageYOffset - pad()));
  };
  var stop = function () {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
    if (watchdog) { window.clearTimeout(watchdog); watchdog = 0; }
    if (restore) { root.style.scrollBehavior = restore; restore = null; }
  };

  var glideTo = function (el) {
    stop();
    var from = window.pageYOffset;
    var to = topOf(el);
    var distance = to - from;

    /* Плавността от CSS се изключва за времето на нашия скок — иначе
       всяко ние scrollTo() само стартира втора, браузърна анимация. */
    restore = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";

    if (reduce || Math.abs(distance) < 4) {
      window.scrollTo(0, to);
      stop();
      return;
    }

    var duration = Math.max(320, Math.min(700, Math.abs(distance) * 0.11));
    var started = 0;
    var step = function (now) {
      if (!started) started = now;
      var p = Math.min(1, (now - started) / duration);
      var eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      window.scrollTo(0, Math.round(from + distance * eased));
      if (p < 1) {
        frame = window.requestAnimationFrame(step);
        return;
      }
      /* Последна дума: точното място по живото положение на секцията. */
      window.scrollTo(0, topOf(el));
      stop();
    };
    frame = window.requestAnimationFrame(step);

    /* Ако браузърът не рисува кадри (скрит таб, пестене на батерия),
       анимацията няма да тръгне — тогава скачаме направо на мястото. */
    watchdog = window.setTimeout(function () {
      watchdog = 0;
      if (!frame) return;
      if (Math.abs(window.pageYOffset - from) < 2) {
        window.scrollTo(0, topOf(el));
        stop();
      }
    }, 250);
  };

  /* Човекът поема контрола — спираме, без да се борим с пръста му. */
  window.addEventListener("touchstart", stop, { passive: true });
  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("keydown", stop);

  document.addEventListener("click", function (event) {
    if (event.defaultPrevented) return;
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest ? event.target.closest(SELECTOR) : null;
    if (!link) return;
    var href = link.getAttribute("href") || "";
    /* „Към съдържанието“ (skip link) остава на браузъра — той мести и фокуса. */
    if (href.length < 2 || href === "#main") return;
    var target = document.getElementById(href.slice(1));
    if (!target) return;

    event.preventDefault();
    glideTo(target);
    if (history.pushState) history.pushState(null, "", href);
  });

  /* ── „Запиши се“: панел с две форми ─────────────────────────────────────
     Слушателят е един за цялата страница: картите в списъка идват готови от
     build-а и нямат свои слушатели, а страниците на събитията са статични. */
  var floatingMenu = null;
  var floatingHome = null;

  /* Слайдерът на началната страница е с contain: paint, тоест всичко извън
     него се реже. Затова там панелът се мести в слой накрая на body и се
     позиционира под бутона — изглежда като в списъка, без да разтяга картата. */
  function floatMenuInSlider(wrap, trigger) {
    var menu = wrap.querySelector(".event-signup-menu");
    if (!menu || !wrap.closest || !wrap.closest(".slider-viewport")) return;

    floatingHome = menu.parentNode;
    floatingMenu = menu;
    document.body.appendChild(menu);
    menu.classList.add("event-signup-menu--floating");

    var w = menu.offsetWidth;
    var h = menu.offsetHeight;
    var r = trigger.getBoundingClientRect();
    var left = Math.min(Math.max(12, r.left), window.innerWidth - w - 12);
    var top = r.bottom + 8;
    if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 8);
    menu.style.left = Math.round(left) + "px";
    menu.style.top = Math.round(top) + "px";
  }

  /* Панелът трябва да се вижда целият: щом под бутона няма място, отваря се
     над него. Така при дълъг списък „Запиши се“ не изчезва под екрана. */
  function fitSignupMenu(wrap) {
    var menu = wrap.querySelector(".event-signup-menu");
    if (!menu) return;
    var rect = menu.getBoundingClientRect();
    if (!rect.height) return;
    if (rect.bottom <= window.innerHeight - 12) return;
    wrap.classList.add("event-signup--up");
  }

  function restoreFloatingMenu() {
    if (!floatingMenu || !floatingHome) return;
    floatingMenu.classList.remove("event-signup-menu--floating");
    floatingMenu.style.left = "";
    floatingMenu.style.top = "";
    floatingHome.appendChild(floatingMenu);
    floatingMenu = null;
    floatingHome = null;
  }

  function closeSignupPanel(wrap) {
    wrap.classList.remove("is-open");
    wrap.classList.remove("event-signup--up");
    var trigger = wrap.querySelector(".event-signup-trigger");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    var card = wrap.parentNode;
    while (card && !(card.classList && card.classList.contains("event-card"))) card = card.parentNode;
    if (card) card.classList.remove("is-signup-open");
    restoreFloatingMenu();
  }

  function closeSignupPanels() {
    var opened = document.querySelectorAll(".event-signup.is-open");
    for (var i = 0; i < opened.length; i++) closeSignupPanel(opened[i]);
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    var trigger = target && target.closest ? target.closest(".event-signup-trigger") : null;

    if (trigger && trigger.getAttribute("aria-haspopup") === "true") {
      event.preventDefault();
      var wrap = trigger.parentNode;
      var willOpen = !wrap.classList.contains("is-open");
      /* един отворен панел на страница: новият затваря стария */
      closeSignupPanels();
      if (willOpen) {
        wrap.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
        var card = wrap.parentNode;
        while (card && !(card.classList && card.classList.contains("event-card"))) card = card.parentNode;
        if (card) card.classList.add("is-signup-open");
        floatMenuInSlider(wrap, trigger);
        fitSignupMenu(wrap);
      }
      return;
    }

    var opened = document.querySelectorAll(".event-signup.is-open");
    for (var i = 0; i < opened.length; i++) {
      if (!opened[i].contains(event.target)) closeSignupPanel(opened[i]);
    }
  });

  /* Скролът отмества панела от погледа — затваряме го, вместо да остане
     отворен някъде из страницата. */
  window.addEventListener("scroll", function () {
    if (document.querySelector(".event-signup.is-open")) closeSignupPanels();
  }, { passive: true });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    closeSignupPanels();
  });
})();
