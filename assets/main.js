/* ═══════════════════════════════════════════════════════════
   AgentLens — etkileşim ve arka plan animasyonu
   Arka plan: sayfanın tamamı boyunca uzanan bir ajan konuşma izi.
   Sayfa kaydırıldıkça tarama başlığı iz üzerinde ilerler; taranan
   mesajlar sönükleşir, şüpheli olanlar kehribar renginde işaretlenir.
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. Arka plan tuvali ─────────────────────────────── */
  var cv = document.getElementById('trace');
  var ctx = cv.getContext('2d');
  var W = 0, H = 0, dpr = 1;
  var nodes = [], docH = 0;
  var scrollY = window.scrollY || 0;

  function rand(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function build() {
    docH = Math.max(document.body.scrollHeight, window.innerHeight + 1);
    var r = rand(20260806);
    var gap = W < 700 ? 210 : 160;
    var count = Math.max(20, Math.round((docH - 400) / gap));
    nodes = [];
    for (var i = 0; i < count; i++) {
      nodes.push({
        y: 260 + i * gap + r() * 40,
        dir: i % 2 === 0 ? 1 : -1,      // 1: sol → sağ
        flag: r() < 0.15,               // şüpheli pencere
        slope: 26 + r() * 26,
        len: 0.55 + r() * 0.4
      });
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    cv.width = Math.floor(W * dpr);
    cv.height = Math.floor(H * dpr);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function arrow(x1, y1, x2, y2, alpha, color, width) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    var a = Math.atan2(y2 - y1, x2 - x1), s = 7;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - s * Math.cos(a - 0.42), y2 - s * Math.sin(a - 0.42));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - s * Math.cos(a + 0.42), y2 - s * Math.sin(a + 0.42));
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    var narrow = W < 760;
    var lx = narrow ? W * 0.10 : W * 0.14;
    var rx = narrow ? W * 0.90 : W * 0.86;
    var scanY = scrollY + H * 0.52;

    /* ajan yaşam çizgileri */
    ctx.save();
    ctx.setLineDash([2, 10]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#EFEBE3';
    ctx.globalAlpha = 0.055;
    [lx, rx].forEach(function (x) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    });
    ctx.restore();

    /* mesajlar */
    ctx.save();
    ctx.lineCap = 'round';
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var y = n.y - scrollY;
      if (y < -120 || y > H + 120) continue;

      var from = n.dir === 1 ? lx : rx;
      var to = n.dir === 1 ? rx : lx;
      var x2 = from + (to - from) * n.len;
      var y2 = y + n.slope;

      /* tarama başlığına uzaklık → parlaklık */
      var d = Math.abs(n.y - scanY);
      var near = Math.max(0, 1 - d / 260);
      var scanned = n.y < scanY;

      var base = scanned ? 0.10 : 0.055;
      var alpha = base + near * (n.flag ? 0.5 : 0.22);
      var color = n.flag && (scanned || near > 0.25) ? '#F0A93E' : '#EFEBE3';

      arrow(from, y, x2, y2, alpha, color, n.flag ? 1.2 : 1);

      /* uç düğümü */
      ctx.globalAlpha = alpha + 0.1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(from, y, n.flag ? 2.6 : 1.8, 0, 6.2832);
      ctx.fill();

      /* işaretli mesajın halesi */
      if (n.flag && near > 0.02) {
        ctx.globalAlpha = near * 0.16;
        var g = ctx.createRadialGradient(x2, y2, 0, x2, y2, 90);
        g.addColorStop(0, 'rgba(240,169,62,.9)');
        g.addColorStop(1, 'rgba(240,169,62,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x2, y2, 90, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.restore();

    /* tarama çizgisi */
    var sy = H * 0.52;
    var lg = ctx.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, 'rgba(240,169,62,0)');
    lg.addColorStop(0.5, 'rgba(240,169,62,.30)');
    lg.addColorStop(1, 'rgba(240,169,62,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = lg;
    ctx.fillRect(0, sy, W, 1);
    ctx.globalAlpha = 1;
  }

  var ticking = false;
  function onScroll() {
    scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function () {
        draw();
        progress();
        stickyNav();
        ticking = false;
      });
    }
  }

  /* ── 2. İlerleme çubuğu ──────────────────────────────── */
  var bar = document.getElementById('progressBar');
  function progress() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, scrollY / max) : 0;
    bar.style.width = (p * 100).toFixed(2) + '%';
  }

  /* ── 3. Yapışkan üst çubuk ───────────────────────────── */
  var nav = document.getElementById('nav');
  function stickyNav() {
    nav.classList.toggle('is-stuck', scrollY > 24);
  }

  /* ── 4. Görünürlük animasyonu ────────────────────────── */
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ── 5. Mobil menü ───────────────────────────────────── */
  var burger = document.getElementById('burger');
  var menu = document.getElementById('mobileMenu');
  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
    menu.hidden = !open;
  });
  menu.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      nav.classList.remove('is-open');
      menu.hidden = true;
      burger.setAttribute('aria-expanded', 'false');
    }
  });

  /* ── 6. Demo ekranları ───────────────────────────────── */
  var tabs = document.querySelectorAll('.dtab');
  var screens = document.querySelectorAll('.scr');

  function go(id) {
    screens.forEach(function (s) { s.classList.toggle('is-on', s.id === 's' + '-' + id); });
    tabs.forEach(function (t) {
      var on = t.dataset.s === id;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', String(on));
    });
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () { go(t.dataset.s); });
  });

  document.querySelectorAll('[data-go]').forEach(function (el) {
    el.addEventListener('click', function () { go(el.dataset.go); });
  });

  document.querySelectorAll('.utab[data-t]').forEach(function (t) {
    t.addEventListener('click', function () {
      var host = t.closest('.scr__main');
      host.querySelectorAll('.utab[data-t]').forEach(function (o) { o.classList.remove('is-on'); });
      t.classList.add('is-on');
      host.querySelectorAll('.upane').forEach(function (p) {
        p.classList.toggle('is-on', p.id === 't-' + t.dataset.t);
      });
    });
  });

  /* ── 7. Başlat ───────────────────────────────────────── */
  resize();
  scrollY = window.scrollY || 0;
  draw();
  progress();
  stickyNav();

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { resize(); draw(); progress(); });

  /* içerik yüksekliği değişince izi yeniden kur */
  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(function () {
      if (Math.abs(document.body.scrollHeight - docH) > 60) { build(); draw(); }
    });
    ro.observe(document.body);
  }
  window.addEventListener('load', function () { build(); draw(); progress(); });
})();
