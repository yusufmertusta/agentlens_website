/* =============================================================
   AgentLens — etkileşim katmanı
   Harici kütüphane yok. Hepsi rAF + IntersectionObserver.
   ============================================================= */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = matchMedia('(hover: none)').matches;
  var MOBILE = function () { return innerWidth <= 820; };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ---------------------------------------------------------
     1 — Arka plan nokta ızgarası (imlece tepki veren yarım ton)
  --------------------------------------------------------- */
  (function dotGrid() {
    var cv = document.getElementById('dots');
    if (!cv || reduce) { if (cv) cv.style.display = 'none'; return; }
    var ctx = cv.getContext('2d');
    var dpr = Math.min(devicePixelRatio || 1, 2);
    var gap = 26, w = 0, h = 0, cols = 0, rows = 0;
    var mx = -9999, my = -9999, tx = -9999, ty = -9999;
    var R = 190;

    function size() {
      w = innerWidth; h = innerHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / gap) + 1; rows = Math.ceil(h / gap) + 1;
    }

    function draw() {
      if (document.hidden) { requestAnimationFrame(draw); return; }
      mx = lerp(mx, tx, 0.12); my = lerp(my, ty, 0.12);
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < cols; i++) {
        for (var j = 0; j < rows; j++) {
          var x = i * gap, y = j * gap;
          var dx = x - mx, dy = y - my;
          var d = Math.sqrt(dx * dx + dy * dy);
          var t = d < R ? 1 - d / R : 0;
          var r = 0.85 + t * 2.2;
          if (t > 0.02) {
            ctx.fillStyle = 'rgba(255,59,107,' + (0.12 + t * 0.55).toFixed(3) + ')';
          } else {
            ctx.fillStyle = 'rgba(22,22,26,0.09)';
          }
          ctx.beginPath();
          ctx.arc(x, y, r, 0, 6.2832);
          ctx.fill();
        }
      }
      requestAnimationFrame(draw);
    }

    function still() {   // dokunmatikte tek kare: sürekli repaint yok
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(22,22,26,0.09)';
      for (var i = 0; i < cols; i++) for (var j = 0; j < rows; j++) {
        ctx.beginPath(); ctx.arc(i * gap, j * gap, 0.85, 0, 6.2832); ctx.fill();
      }
    }

    if (matchMedia('(hover: none)').matches) {
      addEventListener('resize', function () { size(); still(); }, { passive: true });
      size(); still();
      return;
    }
    addEventListener('resize', size, { passive: true });
    addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
    addEventListener('pointerleave', function () { tx = -9999; ty = -9999; }, { passive: true });
    size(); draw();
  })();

  /* ---------------------------------------------------------
     2 — Mercek: imleci takip eden kromatik sapma + pembe leke
  --------------------------------------------------------- */
  (function lens() {
    var blob = document.getElementById('lensBlob');
    var texts = [].slice.call(document.querySelectorAll('.lens-text'));
    if (reduce) { if (blob) blob.remove(); return; }

    var bx = -999, by = -999, tx = -999, ty = -999, on = false;

    function apply() {
      bx = lerp(bx, tx, 0.16); by = lerp(by, ty, 0.16);
      if (blob) blob.style.transform = 'translate3d(' + bx + 'px,' + by + 'px,0) translate(-50%,-50%)';
      for (var i = 0; i < texts.length; i++) {
        var el = texts[i], r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > innerHeight + 200) continue;
        el.style.setProperty('--lx', (bx - r.left) + 'px');
        el.style.setProperty('--ly', (by - r.top) + 'px');
      }
      requestAnimationFrame(apply);
    }

    if (coarse) {
      // dokunmatikte mercek otomatik gezinsin
      var t0 = performance.now();
      (function auto() {
        var t = (performance.now() - t0) / 1000;
        tx = innerWidth * (0.5 + 0.34 * Math.sin(t * 0.55));
        ty = innerHeight * (0.42 + 0.16 * Math.sin(t * 0.83));
        requestAnimationFrame(auto);
      })();
      if (blob) blob.classList.add('on');
    } else {
      addEventListener('pointermove', function (e) {
        tx = e.clientX; ty = e.clientY;
        if (!on && blob) { blob.classList.add('on'); on = true; }
      }, { passive: true });
      addEventListener('pointerleave', function () { if (blob) blob.classList.remove('on'); on = false; });
    }
    apply();
  })();

  /* ---------------------------------------------------------
     3 — Nav: kaydırınca gizlen / arka plan / aktif bölüm / çekmece
  --------------------------------------------------------- */
  (function nav() {
    var nav = document.getElementById('nav');
    var burger = document.getElementById('burger');
    var drawer = document.getElementById('drawer');
    var last = 0;

    addEventListener('scroll', function () {
      var y = scrollY;
      nav.classList.toggle('solid', y > 40);
      if (!drawer.classList.contains('open')) {
        nav.classList.toggle('hide', y > last && y > 420);
      }
      last = y;
    }, { passive: true });

    burger.addEventListener('click', function () {
      var open = drawer.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    drawer.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        drawer.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });

    var map = {};
    [].forEach.call(document.querySelectorAll('.nav-mid a'), function (a) {
      map[a.getAttribute('href').slice(1)] = a;
    });
    if ('IntersectionObserver' in window) {
      var spy = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          var a = map[en.target.id];
          if (a && en.isIntersecting) {
            for (var k in map) map[k].classList.remove('on');
            a.classList.add('on');
          }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      Object.keys(map).forEach(function (id) {
        var s = document.getElementById(id);
        if (s) spy.observe(s);
      });
    }
  })();

  /* ---------------------------------------------------------
     4 — Başlıkları satırlara bölüp maskeyle açma
  --------------------------------------------------------- */
  (function splitLines() {
    var heads = [].slice.call(document.querySelectorAll('[data-anim="lines"]'));
    heads.forEach(function (el) {
      if (reduce) return;
      var words = el.textContent.trim().split(/\s+/);
      el.textContent = '';
      var spans = words.map(function (w, i) {
        var s = document.createElement('span');
        s.className = 'w';
        s.textContent = w + (i < words.length - 1 ? ' ' : '');
        s.style.display = 'inline-block';
        el.appendChild(s);
        return s;
      });
      // aynı satırdaki kelimeleri grupla
      var lines = [], cur = null, top = null;
      spans.forEach(function (s) {
        var t = s.offsetTop;
        if (top === null || Math.abs(t - top) > 4) { cur = []; lines.push(cur); top = t; }
        cur.push(s);
      });
      el.textContent = '';
      lines.forEach(function (line, i) {
        var mask = document.createElement('span');
        mask.className = 'line-mask';
        var inner = document.createElement('span');
        line.forEach(function (s) { inner.appendChild(s); });
        mask.appendChild(inner);
        inner.style.transitionDelay = (i * 90) + 'ms';
        el.appendChild(mask);
      });
    });
  })();

  /* ---------------------------------------------------------
     5 — Görünüme girince açılan bloklar + sayaçlar + barlar
  --------------------------------------------------------- */
  (function reveals() {
    function countUp(el) {
      var target = parseFloat(el.dataset.count);
      var dec = parseInt(el.dataset.dec || '0', 10);
      var pre = el.dataset.prefix || '';
      var suf = el.dataset.suffix || '';
      var dur = 1200, t0 = performance.now();
      (function step(now) {
        var p = clamp((now - t0) / dur, 0, 1);
        var e = 1 - Math.pow(1 - p, 3);
        var v = target * e;
        el.textContent = pre + (dec ? v.toFixed(dec) : Math.round(v).toLocaleString('tr-TR')) + suf;
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }

    if (!('IntersectionObserver' in window)) {
      [].forEach.call(document.querySelectorAll('[data-anim],.line-mask'), function (e) { e.classList.add('in'); });
      return;
    }

    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var d = parseInt(el.dataset.delay || '0', 10);
        setTimeout(function () { el.classList.add('in'); }, d);

        // sayaç
        var nums = el.matches('[data-count]') ? [el] : [].slice.call(el.querySelectorAll('[data-count]'));
        if (!reduce) nums.forEach(function (n) { setTimeout(function () { countUp(n); }, d + 120); });
        else nums.forEach(function (n) {
          n.textContent = (n.dataset.prefix || '') + n.dataset.count + (n.dataset.suffix || '');
        });

        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    [].forEach.call(document.querySelectorAll('[data-anim], .line-mask'), function (e) { io.observe(e); });

    // FC barları
    var fc = document.querySelector('.fc');
    if (fc) {
      var io2 = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          [].forEach.call(fc.querySelectorAll('li'), function (li, i) {
            setTimeout(function () {
              li.querySelector('.fc-track i').style.width = li.dataset.w + '%';
            }, 180 + i * 130);
          });
          io2.disconnect();
        });
      }, { threshold: 0.3 });
      io2.observe(fc);
    }

    // dashboard satırları
    var rows = [].slice.call(document.querySelectorAll('.sessions tbody tr'));
    if (rows.length) {
      var io3 = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          rows.forEach(function (r, i) { setTimeout(function () { r.classList.add('in'); }, i * 90); });
          io3.disconnect();
        });
      }, { threshold: 0.2 });
      io3.observe(rows[0].closest('.panel'));
    }

    // rapor satırları
    var reps = [].slice.call(document.querySelectorAll('.reports li'));
    if (reps.length) {
      var io4 = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          reps.forEach(function (r, i) { setTimeout(function () { r.classList.add('in'); }, i * 80); });
          io4.disconnect();
        });
      }, { threshold: 0.12 });
      io4.observe(reps[0].parentNode);
    }
  })();

  /* ---------------------------------------------------------
     6 — Sonsuz kayan şeritler
  --------------------------------------------------------- */
  (function marquees() {
    [].forEach.call(document.querySelectorAll('.marquee'), function (m) {
      var row = m.querySelector('.marquee-row');
      if (!row) return;
      var speed = parseFloat(m.dataset.speed || '35');
      var dir = m.classList.contains('rev') ? 1 : -1;
      if (reduce) return;
      var half = 0, x = 0, prev = performance.now();
      function measure() { half = row.scrollWidth / 2; }
      measure();
      addEventListener('resize', measure, { passive: true });
      (function tick(now) {
        var dt = Math.min((now - prev) / 1000, 0.05); prev = now;
        x += dir * speed * dt;
        if (half > 0) { if (x <= -half) x += half; if (x >= 0 && dir > 0) x -= half; }
        row.style.transform = 'translate3d(' + x + 'px,0,0)';
        requestAnimationFrame(tick);
      })(prev);
    });
  })();

  /* ---------------------------------------------------------
     7 — Kaydırmaya bağlı sahneler (sticky scrub)
  --------------------------------------------------------- */
  (function scrubScenes() {
    var scenes = [].slice.call(document.querySelectorAll('.scrub'));
    if (!scenes.length) return;

    /* --- trace sahnesi --- */
    var traceEl = document.querySelector('[data-scrub="trace"]');
    var turns = [].slice.call(document.querySelectorAll('#turns .turn'));
    var verdict = document.querySelector('#trace .verdict');
    var traceNote = document.getElementById('traceNote');
    var traceStage = document.getElementById('traceStage');
    var traceRail = document.getElementById('traceRail');
    var traceNotes = [
      'Konuşma yakalanıyor…',
      'Ham kayıt standart JSON şemasına çevriliyor',
      'Bağlam penceresi oluşturuluyor',
      'Stage 1 her adıma anomali skoru veriyor',
      'T-04 şüpheli işaretlendi — Stage 2 devrede',
      'Rapor üretildi: FM-3.2 · Eksik doğrulama'
    ];
    var lastTraceStep = -1;

    /* --- mimari sahnesi --- */
    var archEl = document.querySelector('[data-scrub="arch"]');
    var archRail = document.getElementById('archRail');
    var archNote = document.getElementById('archNote');
    var seq = [];
    if (archEl) {
      var byN = function (sel, n) { return archEl.querySelector(sel + '[data-n="' + n + '"]'); };
      var order = [
        ['.nd', 0], ['.ln', 1], ['.nd', 1], ['.ln', 2], ['.nd', 2], ['.ln', 3], ['.nd', 3],
        ['.ln', 4], ['.nd', 4], ['.ln', 5], ['.nd', 5], ['.ln', 6], ['.nd', 6],
        ['.ln', 7], ['.tg', 7], ['.nd', 7], ['.ln', 8], ['.tg', 8], ['.nd', 8],
        ['.ln', 9], ['.nd', 9], ['.ln', 10], ['.nd', 10], ['.ln', 11]
      ];
      order.forEach(function (o) { var el = byN(o[0], o[1]); if (el) seq.push(el); });
      // çizgileri çizime hazırla
      [].forEach.call(archEl.querySelectorAll('.ln'), function (p) {
        var L = p.getTotalLength();
        p.style.strokeDasharray = L;
        p.style.strokeDashoffset = L;
        p.style.transition = 'stroke-dashoffset .55s cubic-bezier(.22,.68,.24,1)';
        p.dataset.len = L;
      });
    }
    var archNotes = [
      'Ajanlar arası mesajlar dışarıdan yakalanıyor',
      'Ham kayıt saklanıyor, sonra standart şemaya çevriliyor',
      'Bağlam penceresi Stage 1 ön kontrolüne gidiyor',
      'Normal pencereler doğrudan panele düşüyor',
      'Şüpheli pencereler MAST örnekleriyle derin analize giriyor',
      'Yapılandırılmış rapor panele iletiliyor'
    ];
    var lastArchStep = -1;

    /* --- yatay şerit --- */
    var hsEl = document.querySelector('.hscroll');
    var hsRow = document.getElementById('hsRow');

    var cache = [];
    function measure() {
      cache = scenes.map(function (s) {
        var r = s.getBoundingClientRect();
        return { el: s, top: r.top + scrollY, h: s.offsetHeight };
      });
    }

    function setArch(step) {
      if (step === lastArchStep) return;
      lastArchStep = step;
      seq.forEach(function (el, i) {
        var on = i < step;
        if (el.classList.contains('ln')) {
          el.style.strokeDashoffset = on ? 0 : el.dataset.len;
        } else {
          el.classList.toggle('on', on);
        }
      });
      if (archNote) {
        var idx = clamp(Math.floor(step / seq.length * archNotes.length), 0, archNotes.length - 1);
        archNote.textContent = archNotes[idx];
      }
    }

    function setTrace(step) {
      if (step === lastTraceStep) return;
      lastTraceStep = step;
      turns.forEach(function (t, i) { t.classList.toggle('on', i < step); });
      if (verdict) verdict.classList.toggle('on', step >= 6);
      if (traceNote) traceNote.textContent = traceNotes[clamp(step - 1, 0, traceNotes.length - 1)];
      if (traceStage) traceStage.textContent = step >= 5 ? 'STAGE 2' : 'STAGE 1';
    }

    function frame() {
      if (MOBILE()) { requestAnimationFrame(frame); return; }
      var y = scrollY, vh = innerHeight;
      for (var i = 0; i < cache.length; i++) {
        var c = cache[i];
        var p = clamp((y - c.top) / Math.max(c.h - vh, 1), 0, 1);

        if (c.el === traceEl) {
          if (traceRail) traceRail.style.width = (p * 100) + '%';
          setTrace(Math.floor(clamp(p / 0.86, 0, 0.999) * 7));
        } else if (c.el === archEl) {
          if (archRail) archRail.style.width = (p * 100) + '%';
          setArch(Math.round(clamp(p / 0.9, 0, 1) * seq.length));
        } else if (c.el === hsEl && hsRow) {
          var max = hsRow.scrollWidth - innerWidth + 40;
          hsRow.style.transform = 'translate3d(' + (-p * Math.max(max, 0)) + 'px,0,0)';
        }
      }
      requestAnimationFrame(frame);
    }

    function mobileReset() {
      if (!MOBILE()) return;
      turns.forEach(function (t) { t.classList.add('on'); });
      if (verdict) verdict.classList.add('on');
      setArch(seq.length);
      if (hsRow) hsRow.style.transform = '';
    }

    measure();
    addEventListener('resize', function () { measure(); mobileReset(); }, { passive: true });
    addEventListener('load', measure);
    mobileReset();
    if (reduce) { turns.forEach(function (t) { t.classList.add('on'); }); if (verdict) verdict.classList.add('on'); setArch(seq.length); }
    requestAnimationFrame(frame);
  })();

  /* ---------------------------------------------------------
     8 — Mıknatıs düğmeler
  --------------------------------------------------------- */
  (function magnetic() {
    if (reduce || coarse) return;
    [].forEach.call(document.querySelectorAll('.magnetic'), function (el) {
      var rx = 0, ry = 0, tx = 0, ty = 0, raf = null;
      function loop() {
        rx = lerp(rx, tx, 0.18); ry = lerp(ry, ty, 0.18);
        el.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
        if (Math.abs(rx - tx) > 0.1 || Math.abs(ry - ty) > 0.1) raf = requestAnimationFrame(loop);
        else raf = null;
      }
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        tx = (e.clientX - r.left - r.width / 2) * 0.28;
        ty = (e.clientY - r.top - r.height / 2) * 0.34;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      el.addEventListener('pointerleave', function () {
        tx = 0; ty = 0;
        if (!raf) raf = requestAnimationFrame(loop);
      });
    });
  })();

})();
