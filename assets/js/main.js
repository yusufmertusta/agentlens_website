/* =============================================================
   AgentLens — etkileşim katmanı (harici kütüphane yok)
   ============================================================= */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = matchMedia('(hover: none)').matches;
  var MOBILE = function () { return innerWidth <= 820; };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* =========================================================
     1 — ALAN: prosedürel dalga manzarası
     Konuşma uzayı bir ızgara; anomali onu bozan tek tepe.
  ========================================================= */
  (function fieldScene() {
    var cv = document.getElementById('field');
    if (!cv || reduce) { if (cv) cv.style.display = 'none'; return; }
    var ctx = cv.getContext('2d');

    var COLS = 74, ROWS = 44;
    var DX = 0.94, DZ = 1.15, NEAR = 3.6, FOCAL = 640, CAMY = 5.4;
    var w = 0, h = 0, dpr = 1;
    var travel = 0, tTravel = 0;
    var anom = 0, tAnom = 0;
    var px = 0, tpx = 0;
    var t0 = performance.now();

    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = innerWidth; h = innerHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (innerWidth < 720) { COLS = 46; ROWS = 32; } else { COLS = 74; ROWS = 44; }
    }

    function height(x, z, t) {
      return Math.sin(x * 0.27 + t * 0.55) * 1.05
           + Math.sin(z * 0.21 - t * 0.42) * 0.85
           + Math.sin((x + z) * 0.13 + t * 0.28) * 0.6;
    }

    function draw(now) {
      var t = (now - t0) / 1000;
      travel = lerp(travel, tTravel, 0.07);
      anom = lerp(anom, tAnom, 0.06);
      px = lerp(px, tpx, 0.05);

      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;

      var frac = travel % DZ;
      var base = Math.floor(travel / DZ) * DZ;
      var halfX = (COLS - 1) * DX / 2;
      var horizon = h * 0.56;
      var ax = 5.4, az = 14 + Math.sin(t * 0.25) * 2;

      for (var j = ROWS - 1; j >= 0; j--) {
        var zp = j * DZ + frac + NEAR;
        var zc = zp + base;
        var depth = 1 - j / ROWS;
        var a = Math.pow(depth, 1.9) * 0.55;
        if (a < 0.004) continue;

        ctx.beginPath();
        var hot = false;
        for (var i = 0; i < COLS; i++) {
          var x = i * DX - halfX + px;
          var y = height(x, zc, t);

          // anomali tepesi
          var d2 = (x - ax) * (x - ax) + (zc - base - az) * (zc - base - az);
          var bump = Math.exp(-d2 / 11) * anom * 3.4;
          if (bump > 0.35) hot = true;
          y += bump;

          var sx = w / 2 + (x * FOCAL) / zp;
          var sy = horizon - ((y - CAMY) * FOCAL) / zp - FOCAL * 0.0;
          if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.strokeStyle = hot
          ? 'rgba(217,108,44,' + (a * 1.5).toFixed(3) + ')'
          : 'rgba(237,237,234,' + a.toFixed(3) + ')';
        ctx.stroke();
      }
      requestAnimationFrame(draw);
    }

    // kaydırma: alanın içinde ilerleme + anomali bölümünde tepe yükselir
    function onScroll() {
      tTravel = scrollY * 0.013;
      var an = document.getElementById('anomali');
      if (an) {
        var r = an.getBoundingClientRect();
        var vis = 1 - clamp(Math.abs(r.top + r.height / 2 - innerHeight / 2) / (innerHeight * 1.6), 0, 1);
        tAnom = vis;
      }
      cv.style.opacity = scrollY < innerHeight * 0.7 ? '1' : '0.42';
    }

    addEventListener('resize', function () { size(); }, { passive: true });
    addEventListener('scroll', onScroll, { passive: true });
    if (!coarse) addEventListener('pointermove', function (e) {
      tpx = (e.clientX / innerWidth - 0.5) * -5;
    }, { passive: true });

    size(); onScroll(); requestAnimationFrame(draw);
  })();

  /* =========================================================
     2 — Metin çözümleme (decode)
  ========================================================= */
  var GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>{}[]';
  function scramble(el, done) {
    var final = el.dataset.scramble || el.textContent;
    el.classList.add('ready');
    if (reduce) { el.textContent = final; if (done) done(); return; }
    var chars = final.split('');
    var n = chars.length;
    var start = performance.now();
    var dur = clamp(360 + n * 26, 500, 1500);
    (function step(now) {
      var p = clamp((now - start) / dur, 0, 1);
      var solved = Math.floor(p * n * 1.25);
      var out = '', dimOpen = false;
      for (var i = 0; i < n; i++) {
        var c = chars[i];
        if (c === ' ' || c === '\n') { if (dimOpen) { out += '</span>'; dimOpen = false; } out += c; continue; }
        if (i < solved) {
          if (dimOpen) { out += '</span>'; dimOpen = false; }
          out += c;
        } else {
          if (!dimOpen) { out += '<span class="scr-dim">'; dimOpen = true; }
          out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
      }
      if (dimOpen) out += '</span>';
      el.innerHTML = out;
      if (p < 1) requestAnimationFrame(step);
      else { el.textContent = final; if (done) done(); }
    })(start);
  }

  /* =========================================================
     3 — Açılış ekranı
  ========================================================= */
  (function boot() {
    var el = document.getElementById('boot');
    var pct = document.getElementById('bootPct');
    var bar = document.getElementById('bootBar');
    var word = el && el.querySelector('.boot-word');
    var hero = document.querySelector('.hero [data-scramble]');

    function finish() {
      if (el) { el.classList.add('done'); setTimeout(function () { el.remove(); }, 800); }
      if (hero) scramble(hero);
      document.body.style.overflow = '';
    }
    if (!el || reduce) { if (el) el.remove(); if (hero) scramble(hero); return; }

    document.body.style.overflow = 'hidden';
    if (word) scramble(word);
    var t0 = performance.now(), dur = 1500;
    (function tick(now) {
      var p = clamp((now - t0) / dur, 0, 1);
      var e = 1 - Math.pow(1 - p, 2.2);
      if (pct) pct.textContent = String(Math.round(e * 100)).padStart(3, '0');
      if (bar) bar.style.width = (e * 100) + '%';
      if (p < 1) requestAnimationFrame(tick); else setTimeout(finish, 240);
    })(t0);
  })();

  /* =========================================================
     4 — Nav
  ========================================================= */
  (function nav() {
    var nav = document.getElementById('nav');
    var burger = document.getElementById('burger');
    var drawer = document.getElementById('drawer');
    var last = 0;

    addEventListener('scroll', function () {
      var y = scrollY;
      nav.classList.toggle('solid', y > 40);
      if (!drawer.classList.contains('open')) nav.classList.toggle('hide', y > last && y > 440);
      last = y;
    }, { passive: true });

    burger.addEventListener('click', function () {
      var open = drawer.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    drawer.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        drawer.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });

    var map = {};
    [].forEach.call(document.querySelectorAll('.nav-mid a'), function (a) { map[a.getAttribute('href').slice(1)] = a; });
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
      Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });
    }
  })();

  /* =========================================================
     5 — Görünüme girenler: fade, scramble, sayaç, bar
  ========================================================= */
  (function reveals() {
    function countUp(el) {
      var target = parseFloat(el.dataset.count);
      var dec = parseInt(el.dataset.dec || '0', 10);
      var pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
      if (reduce) { el.textContent = pre + target + suf; return; }
      var dur = 1250, t0 = performance.now();
      (function step(now) {
        var p = clamp((now - t0) / dur, 0, 1);
        var v = target * (1 - Math.pow(1 - p, 3));
        el.textContent = pre + (dec ? v.toFixed(dec) : Math.round(v).toLocaleString('tr-TR')) + suf;
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }

    var all = [].slice.call(document.querySelectorAll('[data-anim],[data-scramble],[data-count]'));
    if (!('IntersectionObserver' in window)) {
      all.forEach(function (e) {
        e.classList.add('in', 'ready');
        if (e.dataset.count) countUp(e);
      });
      return;
    }

    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var d = parseInt(el.dataset.delay || '0', 10);
        setTimeout(function () {
          el.classList.add('in');
          if (el.dataset.scramble && !el.closest('.hero') && !el.closest('.boot')) scramble(el);
          if (el.dataset.count) countUp(el);
        }, d);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });

    all.forEach(function (e) { if (!e.closest('.hero') && !e.closest('.boot')) io.observe(e); });

    function batch(sel, container, gap) {
      var items = [].slice.call(document.querySelectorAll(sel));
      if (!items.length) return;
      var host = container ? items[0].closest(container) : items[0].parentNode;
      var o = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          items.forEach(function (it, i) { setTimeout(function () { it.classList.add('in'); }, i * gap); });
          o.disconnect();
        });
      }, { threshold: 0.15 });
      o.observe(host);
    }
    batch('.sessions tbody tr', '.panel', 85);
    batch('.reports li', null, 75);

    var fc = document.querySelector('.fc');
    if (fc) {
      var o2 = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          [].forEach.call(fc.querySelectorAll('li'), function (li, i) {
            setTimeout(function () { li.querySelector('.tr i').style.width = li.dataset.w + '%'; }, 170 + i * 130);
          });
          o2.disconnect();
        });
      }, { threshold: 0.3 });
      o2.observe(fc);
    }
  })();

  /* =========================================================
     6 — Kayan şeritler
  ========================================================= */
  (function marquees() {
    if (reduce) return;
    [].forEach.call(document.querySelectorAll('.marquee'), function (m) {
      var row = m.querySelector('.row');
      if (!row) return;
      var speed = parseFloat(m.dataset.speed || '38');
      var dir = m.classList.contains('rev') ? 1 : -1;
      var half = 0, x = dir > 0 ? -row.scrollWidth / 2 : 0, prev = performance.now();
      function measure() { half = row.scrollWidth / 2; }
      measure();
      addEventListener('resize', measure, { passive: true });
      (function tick(now) {
        var dt = Math.min((now - prev) / 1000, 0.05); prev = now;
        x += dir * speed * dt;
        if (half > 0) { if (x <= -half) x += half; if (x >= 0) x -= half; }
        row.style.transform = 'translate3d(' + x + 'px,0,0)';
        requestAnimationFrame(tick);
      })(prev);
    });
  })();

  /* =========================================================
     7 — Kaydırmaya kilitli sahneler
  ========================================================= */
  (function scenes() {
    var list = [].slice.call(document.querySelectorAll('.scrub'));
    if (!list.length) return;

    var traceEl = document.querySelector('[data-scrub="trace"]');
    var turns = [].slice.call(document.querySelectorAll('#turns .turn'));
    var verdict = document.querySelector('#anomali .verdict');
    var tNote = document.getElementById('traceNote');
    var tStage = document.getElementById('traceStage');
    var tRail = document.getElementById('traceRail');
    var traceNotes = [
      'KONUŞMA YAKALANIYOR',
      'HAM KAYIT STANDART ŞEMAYA ÇEVRİLİYOR',
      'BAĞLAM PENCERESİ OLUŞTURULUYOR',
      'STAGE 1 HER ADIMA SKOR VERİYOR',
      'T-04 ŞÜPHELİ — STAGE 2 DEVREDE',
      'RAPOR ÜRETİLDİ: FM-3.2 EKSİK DOĞRULAMA'
    ];
    var lastT = -1;

    var archEl = document.querySelector('[data-scrub="arch"]');
    var aRail = document.getElementById('archRail');
    var aNote = document.getElementById('archNote');
    var seq = [];
    if (archEl) {
      var order = [['.nd',0],['.ln',1],['.nd',1],['.ln',2],['.nd',2],['.ln',3],['.nd',3],['.ln',4],['.nd',4],
                   ['.ln',5],['.nd',5],['.ln',6],['.nd',6],['.ln',7],['.tg',7],['.nd',7],['.ln',8],['.tg',8],
                   ['.nd',8],['.ln',9],['.nd',9],['.ln',10],['.nd',10],['.ln',11]];
      order.forEach(function (o) {
        var el = archEl.querySelector(o[0] + '[data-n="' + o[1] + '"]');
        if (el) seq.push(el);
      });
      [].forEach.call(archEl.querySelectorAll('.ln'), function (p) {
        var L = p.getTotalLength();
        p.style.strokeDasharray = L;
        p.style.strokeDashoffset = L;
        p.style.transition = 'stroke-dashoffset .5s cubic-bezier(.22,.68,.24,1)';
        p.dataset.len = L;
      });
    }
    var archNotes = [
      'MESAJLAR DIŞARIDAN YAKALANIYOR',
      'HAM KAYIT STANDART ŞEMAYA ÇEVRİLİYOR',
      'BAĞLAM PENCERESİ STAGE 1 ÖN KONTROLÜNE GİDİYOR',
      'NORMAL PENCERELER DOĞRUDAN PANELE DÜŞÜYOR',
      'ŞÜPHELİ PENCERELER MAST ÖRNEKLERİYLE ANALİZE GİRİYOR',
      'YAPILANDIRILMIŞ RAPOR PANELE İLETİLİYOR'
    ];
    var lastA = -1;

    var hsEl = document.querySelector('.hs');
    var hsRow = document.getElementById('hsRow');
    var cache = [];

    function measure() {
      cache = list.map(function (s) {
        return { el: s, top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight };
      });
    }
    function setTrace(step) {
      if (step === lastT) return;
      lastT = step;
      turns.forEach(function (t, i) { t.classList.toggle('on', i < step); });
      if (verdict) verdict.classList.toggle('on', step >= 6);
      if (tNote) tNote.textContent = traceNotes[clamp(step - 1, 0, traceNotes.length - 1)];
      if (tStage) tStage.textContent = step >= 5 ? 'STAGE 2' : 'STAGE 1';
    }
    function setArch(step) {
      if (step === lastA) return;
      lastA = step;
      seq.forEach(function (el, i) {
        var on = i < step;
        if (el.classList.contains('ln')) el.style.strokeDashoffset = on ? 0 : el.dataset.len;
        else el.classList.toggle('on', on);
      });
      if (aNote && seq.length) {
        var idx = clamp(Math.floor(step / seq.length * archNotes.length), 0, archNotes.length - 1);
        aNote.textContent = archNotes[idx];
      }
    }
    function frame() {
      if (!MOBILE()) {
        var y = scrollY, vh = innerHeight;
        for (var i = 0; i < cache.length; i++) {
          var c = cache[i];
          var p = clamp((y - c.top) / Math.max(c.h - vh, 1), 0, 1);
          if (c.el === traceEl) {
            if (tRail) tRail.style.width = (p * 100) + '%';
            setTrace(Math.floor(clamp(p / 0.86, 0, 0.999) * 7));
          } else if (c.el === archEl) {
            if (aRail) aRail.style.width = (p * 100) + '%';
            setArch(Math.round(clamp(p / 0.9, 0, 1) * seq.length));
          } else if (c.el === hsEl && hsRow) {
            var max = Math.max(hsRow.scrollWidth - innerWidth + 40, 0);
            hsRow.style.transform = 'translate3d(' + (-p * max) + 'px,0,0)';
          }
        }
      }
      requestAnimationFrame(frame);
    }
    function mobileReset() {
      if (!MOBILE() && !reduce) return;
      turns.forEach(function (t) { t.classList.add('on'); });
      if (verdict) verdict.classList.add('on');
      setArch(seq.length);
      if (hsRow) hsRow.style.transform = '';
    }

    measure();
    addEventListener('resize', function () { measure(); mobileReset(); }, { passive: true });
    addEventListener('load', measure);
    setTimeout(measure, 1800);   // açılış ekranı kapandıktan sonra yeniden ölç
    mobileReset();
    requestAnimationFrame(frame);
  })();

  /* =========================================================
     8 — Mıknatıs düğmeler
  ========================================================= */
  (function magnetic() {
    if (reduce || coarse) return;
    [].forEach.call(document.querySelectorAll('.magnetic'), function (el) {
      var rx = 0, ry = 0, tx = 0, ty = 0, raf = null;
      function loop() {
        rx = lerp(rx, tx, 0.18); ry = lerp(ry, ty, 0.18);
        el.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
        if (Math.abs(rx - tx) > 0.1 || Math.abs(ry - ty) > 0.1) raf = requestAnimationFrame(loop); else raf = null;
      }
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        tx = (e.clientX - r.left - r.width / 2) * 0.3;
        ty = (e.clientY - r.top - r.height / 2) * 0.36;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      el.addEventListener('pointerleave', function () { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); });
    });
  })();

})();
