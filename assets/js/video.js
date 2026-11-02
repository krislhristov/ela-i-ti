/* Видео блок: пуска се, когато е видим, със звук (ако браузърът позволи).
   Пауза при излизане от изгледа (дори частично), пускане при връщане.
   Бутонът за пауза/пусни и заглушаване работят винаги. */
(function () {
  var frame = document.querySelector('[data-video-frame]');
  if (!frame) return;
  var video = frame.querySelector('[data-video]');
  var playBtn = frame.querySelector('[data-video-play]');
  var muteBtn = frame.querySelector('[data-video-mute]');
  if (!video || !playBtn || !muteBtn) return;

  var icons = {
    pause: playBtn.querySelector('.ico-pause'),
    play: playBtn.querySelector('.ico-play'),
    sound: muteBtn.querySelector('.ico-sound'),
    muted: muteBtn.querySelector('.ico-muted')
  };

  var started = false;        // пускано ли е вече поне веднъж
  var pausedByUser = false;   // посетителят е натиснал пауза
  var pausedByScroll = false; // паузата е от скролването

  function syncPlay() {
    var playing = !video.paused && !video.ended;
    playBtn.setAttribute('aria-label', playing ? 'Пауза' : 'Пусни');
    icons.pause.style.display = playing ? '' : 'none';
    icons.play.style.display = playing ? 'none' : '';
  }
  function syncMute() {
    var m = video.muted || video.volume === 0;
    muteBtn.setAttribute('aria-label', m ? 'Включи звука' : 'Заглуши');
    icons.sound.style.display = m ? 'none' : '';
    icons.muted.style.display = m ? '' : 'none';
  }

  function playWithFallback() {
    var p = video.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function () {
        // Браузърът не позволява звук без взаимодействие: пускаме беззвучно
        // и включваме звука при първото докосване или клавиш.
        video.muted = true;
        video.play().catch(function () {});
        armUnmute();
      });
    }
  }

  var unmuteEvents = ['pointerdown', 'keydown', 'touchstart'];
  function unmuteOnGesture() {
    if (video.muted && !video.paused) { video.muted = false; }
    unmuteEvents.forEach(function (ev) { document.removeEventListener(ev, unmuteOnGesture, true); });
  }
  var armed = false;
  function armUnmute() {
    if (armed) return;
    armed = true;
    unmuteEvents.forEach(function (ev) { document.addEventListener(ev, unmuteOnGesture, true); });
  }

  playBtn.addEventListener('click', function () {
    if (video.paused) {
      pausedByUser = false;
      pausedByScroll = false;
      video.play().catch(function () {});
    } else {
      pausedByUser = true;
      video.pause();
    }
  });
  muteBtn.addEventListener('click', function () {
    video.muted = !video.muted;
    syncMute();
  });
  video.addEventListener('play', syncPlay);
  video.addEventListener('pause', syncPlay);
  video.addEventListener('ended', syncPlay);
  video.addEventListener('volumechange', syncMute);

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var ratio = entry.intersectionRatio;
        if (ratio < 1) {
          // Излязло е поне частично от изгледа → пауза
          if (!video.paused) { video.pause(); pausedByScroll = true; }
        } else if (!pausedByUser) {
          // Видимо е → пускаме (първи път или след скролване)
          if (!started || pausedByScroll) {
            started = true;
            pausedByScroll = false;
            if (video.paused) { video.muted = false; playWithFallback(); }
          }
        }
      });
    }, { threshold: [1] });
    io.observe(frame);
  } else {
    playWithFallback();
  }

  syncPlay();
  syncMute();
})();
