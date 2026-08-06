/* ═══════════════════════════════════════════════════════════════════
   AgentLens — site runtime.

   The reference build shipped a Nuxt bundle whose code-split chunks were
   not part of the exported static site, so on a real HTTP server it failed
   to hydrate and wiped the DOM. This file replaces that runtime with plain
   JavaScript and rebuilds the effects the design depends on:

     · momentum ("smooth") scrolling
     · the hero / final-CTA fluid field: halftone dot sheet + pink dye,
       with the headline displaced through the velocity field and split
       into RGB channels (the .is-fluid-ready contract in the stylesheet)
     · the drifting card stack behind the final CTA (.s__cards-canvas)
     · the scroll-pinned USP card stack (--fade, position:fixed)
     · scroll-scrubbed architecture diagram
     · accordion, modal, demo tabs, line reveals

   No stylesheet rule was modified. Everything reads the existing markup.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = !window.matchMedia('(pointer: fine)').matches;

  doc.classList.toggle('is-mouse', !coarse);
  doc.classList.toggle('is-touch', coarse);

  var vh = window.innerHeight;
  var ACCENT = [0.988, 0.278, 0.471];   // --color-accent  #fc4778
  var PAGE = '#f1f1f1';                 // --color-white-darker

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function smoothstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  /* ═══════════════════════════════════════════ 1. momentum scrolling
     Native scroll stays the source of truth, so position:fixed, sticky
     and anchors keep working; we only interpolate towards the wheel
     target each frame. Touch keeps its own momentum. */
  var Scroller = (function () {
    var target = window.scrollY;
    var current = target;
    var base = !coarse && !reduced;
    var enabled = base;
    var selfScroll = false;

    function maxScroll() {
      return Math.max(0, doc.scrollHeight - window.innerHeight);
    }

    function onWheel(e) {
      if (!enabled || e.ctrlKey) return;
      if (e.target.closest && e.target.closest('[data-lenis-prevent]')) return;
      e.preventDefault();
      var d = e.deltaY;
      if (e.deltaMode === 1) d *= 24;
      else if (e.deltaMode === 2) d *= window.innerHeight;
      target = clamp(target + d, 0, maxScroll());
    }

    function onScroll() {
      if (selfScroll) { selfScroll = false; return; }
      target = current = window.scrollY;
    }

    function update() {
      if (!enabled) { current = target = window.scrollY; return; }
      target = clamp(target, 0, maxScroll());
      var d = target - current;
      if (Math.abs(d) < 0.08) { current = target; return; }
      current += d * 0.12;
      selfScroll = true;
      window.scrollTo(0, current);
    }

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', onScroll, { passive: true });

    return {
      update: update,
      to: function (y) {
        y = clamp(y, 0, maxScroll());
        if (enabled) target = y;
        else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
      },
      lock: function (on) {
        enabled = on ? false : base;
        target = current = window.scrollY;
      }
    };
  })();

  /* ═══════════════════════════════════════════ 2. fluid velocity field
     A coarse semi-Lagrangian sim on the CPU. Only the small RGBA texture
     it produces goes to the GPU each frame, so the cost stays flat. */
  function Field(nx, ny) {
    var n = nx * ny;
    var vx = new Float32Array(n), vy = new Float32Array(n), dye = new Float32Array(n);
    var tx = new Float32Array(n), ty = new Float32Array(n), td = new Float32Array(n);
    var bytes = new Uint8Array(n * 4);

    function sample(f, x, y) {
      x = clamp(x, 0, nx - 1.001); y = clamp(y, 0, ny - 1.001);
      var x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
      var x1 = x0 + 1 < nx ? x0 + 1 : x0, y1 = y0 + 1 < ny ? y0 + 1 : y0;
      var a = y0 * nx, b = y1 * nx;
      return f[a + x0] * (1 - fx) * (1 - fy) + f[a + x1] * fx * (1 - fy) +
        f[b + x0] * (1 - fx) * fy + f[b + x1] * fx * fy;
    }

    function splat(u, v, dx, dy, radius, amount) {
      var cx = u * nx, cy = v * ny;
      var r = radius * nx, r2 = r * r;
      var x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(nx - 1, Math.ceil(cx + r));
      var y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(ny - 1, Math.ceil(cy + r));
      for (var y = y0; y <= y1; y++) {
        for (var x = x0; x <= x1; x++) {
          var ddx = x - cx, ddy = y - cy, d2 = ddx * ddx + ddy * ddy;
          if (d2 > r2) continue;
          var w = Math.exp(-d2 / (r2 * 0.34));
          var i = y * nx + x;
          vx[i] += dx * w;
          vy[i] += dy * w;
          dye[i] = Math.min(1.5, dye[i] + amount * w);
        }
      }
    }

    function step(dt) {
      var d = clamp(dt, 0, 0.05) * 60;
      for (var y = 0; y < ny; y++) {
        for (var x = 0; x < nx; x++) {
          var i = y * nx + x;
          var px = x - vx[i] * d * 0.9, py = y - vy[i] * d * 0.9;
          tx[i] = sample(vx, px, py);
          ty[i] = sample(vy, px, py);
          td[i] = sample(dye, px, py);
        }
      }
      for (var yy = 0; yy < ny; yy++) {
        var up = yy > 0 ? -nx : 0, dn = yy < ny - 1 ? nx : 0;
        for (var xx = 0; xx < nx; xx++) {
          var j = yy * nx + xx;
          var lf = xx > 0 ? -1 : 0, rt = xx < nx - 1 ? 1 : 0;
          var sx = tx[j] + tx[j + lf] + tx[j + rt] + tx[j + up] + tx[j + dn];
          var sy = ty[j] + ty[j + lf] + ty[j + rt] + ty[j + up] + ty[j + dn];
          var sd = td[j] + td[j + lf] + td[j + rt] + td[j + up] + td[j + dn];
          vx[j] = sx * 0.2 * 0.974;
          vy[j] = sy * 0.2 * 0.974;
          dye[j] = sd * 0.2 * 0.973;
        }
      }
    }

    function pack() {
      for (var i = 0; i < n; i++) {
        var o = i * 4;
        bytes[o] = clamp(vx[i] * 0.5 + 0.5, 0, 1) * 255;
        bytes[o + 1] = clamp(vy[i] * 0.5 + 0.5, 0, 1) * 255;
        bytes[o + 2] = clamp(dye[i], 0, 1) * 255;
        bytes[o + 3] = 255;
      }
      return bytes;
    }

    return { nx: nx, ny: ny, splat: splat, step: step, pack: pack };
  }

  /* ═══════════════════════════════════════════ 3. WebGL displacement
     Samples the static "content" sheet three times at slightly different
     offsets driven by the velocity field. That R/G/B split is what smears
     the headline into pink and cyan ghosts where the cursor passed. */
  var VERT =
    'attribute vec2 aPos;varying vec2 vUv;' +
    'void main(){vUv=aPos*0.5+0.5;vUv.y=1.0-vUv.y;gl_Position=vec4(aPos,0.0,1.0);}';

  var FRAG =
    'precision mediump float;varying vec2 vUv;' +
    'uniform sampler2D uContent;uniform sampler2D uField;' +
    'uniform float uStrength;uniform vec3 uTint;' +
    'void main(){' +
    'vec3 f=texture2D(uField,vUv).rgb;' +
    'vec2 d=(f.xy-0.5)*2.0*uStrength;' +
    'float r=texture2D(uContent,vUv+d*1.00).r;' +
    'float g=texture2D(uContent,vUv+d*0.42).g;' +
    'float b=texture2D(uContent,vUv+d*0.42).b;' +
    'vec3 col=vec3(r,g,b);' +
    'float dye=clamp(f.z*1.05,0.0,1.0);' +
    'col=mix(col,col*uTint,dye*0.62);' +
    'gl_FragColor=vec4(col,1.0);}';

  function makeGL(canvas) {
    var opts = { alpha: false, antialias: false, depth: false, stencil: false };
    var gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) return null;

    function shader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    var vs = shader(gl.VERTEX_SHADER, VERT), fs = shader(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;

    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    function tex(unit) {
      var t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    }

    return {
      gl: gl,
      contentTex: tex(0),
      fieldTex: tex(1),
      uContent: gl.getUniformLocation(prog, 'uContent'),
      uField: gl.getUniformLocation(prog, 'uField'),
      uStrength: gl.getUniformLocation(prog, 'uStrength'),
      uTint: gl.getUniformLocation(prog, 'uTint')
    };
  }

  /* ═══════════════════════════════════════════ 4. the sheet the shader eats
     Halftone grid plus the section headline, painted once at the exact
     position its (invisible) DOM node occupies. A zero-width marker after
     each word gives us the true baseline the browser used. */
  function buildWordSpans(el) {
    if (el.dataset.words === 'done') return;
    var parts = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = parts.map(function (part) {
      return part.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().split(' ')
        .map(function (w) {
          return '<span class="al-w">' + w +
            '<i class="al-b" style="display:inline-block;width:0;height:0;vertical-align:baseline"></i></span>';
        }).join(' ');
    }).join('<br>');
    el.dataset.words = 'done';
  }

  function paintSheet(sheet, root, titleEl, dpr) {
    var rect = root.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
    sheet.width = Math.round(w * dpr);
    sheet.height = Math.round(h * dpr);

    var c = sheet.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = PAGE;
    c.fillRect(0, 0, w, h);

    // The dot sheet fades out near the bottom edge so the section does not
    // end on a hard tonal step against the page background.
    var gap = 5;
    var fadeFrom = h * 0.68;
    for (var y = gap * 0.5; y < h; y += gap) {
      var a = 0.14;
      if (y > fadeFrom) a *= 1 - Math.pow((y - fadeFrom) / (h - fadeFrom), 1.6);
      if (a < 0.004) continue;
      c.fillStyle = 'rgba(43,43,43,' + a.toFixed(4) + ')';
      for (var x = gap * 0.5; x < w; x += gap) c.fillRect(x, y, 1.2, 1.2);
    }

    if (titleEl) {
      var cs = getComputedStyle(titleEl);
      c.fillStyle = cs.color || '#2b2b2b';
      c.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      try { c.letterSpacing = cs.letterSpacing; } catch (e) { /* older browsers */ }
      c.textBaseline = 'alphabetic';
      Array.prototype.forEach.call(titleEl.querySelectorAll('.al-w'), function (span) {
        var sr = span.getBoundingClientRect();
        var m = span.querySelector('.al-b');
        var base = m ? m.getBoundingClientRect().top : sr.bottom;
        c.fillText(span.textContent, sr.left - rect.left, base - rect.top);
      });
    }
    return { w: w, h: h };
  }

  /* ═══════════════════════════════════════════ 5. fluid section */
  function FluidSection(opts) {
    var root = opts.root;
    if (!root) return null;
    var canvas = root.querySelector('.b-fluid__canvas');
    var cursor = root.querySelector('.b-cursor');
    if (!canvas) return null;

    var ctxGL = makeGL(canvas);
    if (!ctxGL) return null;

    var sheet = document.createElement('canvas');
    var dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    var field = Field(opts.nx || 116, opts.ny || 66);
    var pointer = { px: 0, py: 0, has: false };
    var idle = Math.random() * 100;
    var titleEl = (opts.title && !coarse) ? opts.title : null;

    if (titleEl) buildWordSpans(titleEl);

    function repaint() {
      var s = paintSheet(sheet, root, titleEl, dpr);
      canvas.width = Math.round(s.w * dpr);
      canvas.height = Math.round(s.h * dpr);
      var gl = ctxGL.gl;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, ctxGL.contentTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, sheet);
      if (opts.onPaint) opts.onPaint();
    }

    (opts.host || root).addEventListener('pointermove', function (e) {
      var r = root.getBoundingClientRect();
      if (!r.width) return;
      var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      if (pointer.has) {
        var dx = (x - pointer.px) * 17, dy = (y - pointer.py) * 17;
        field.splat(x, y, dx, dy, 0.042, Math.min(0.55, Math.hypot(dx, dy) * 0.4 + 0.035));
      }
      pointer.px = x; pointer.py = y; pointer.has = true;
      if (cursor) cursor.style.transform = 'translate(' + (x * r.width) + 'px,' + (y * r.height) + 'px)';
    }, { passive: true });

    (opts.host || root).addEventListener('pointerleave', function () {
      pointer.has = false;
    }, { passive: true });

    function frame(dt) {
      idle += dt;
      var ax = 0.5 + Math.sin(idle * 0.29) * 0.36 + Math.sin(idle * 0.16) * 0.11;
      var ay = 0.5 + Math.cos(idle * 0.23) * 0.31;
      field.splat(ax, ay, Math.cos(idle * 0.29) * 1.1, -Math.sin(idle * 0.23) * 0.95,
        0.055, pointer.has ? 0.02 : 0.055);
      field.step(dt);

      var gl = ctxGL.gl;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, ctxGL.fieldTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, field.nx, field.ny, 0, gl.RGBA,
        gl.UNSIGNED_BYTE, field.pack());
      gl.uniform1i(ctxGL.uContent, 0);
      gl.uniform1i(ctxGL.uField, 1);
      gl.uniform1f(ctxGL.uStrength, opts.strength || 0.05);
      gl.uniform3f(ctxGL.uTint, ACCENT[0], ACCENT[1], ACCENT[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    return { root: root, repaint: repaint, frame: frame };
  }

  /* ═══════════════════════════════════════════ 6. small ambient fields
     The USP cards and the quote keep a lightweight 2D version; they are
     thumbnail-sized and a full sim there would be wasted work. */
  function MiniFluid(root) {
    var canvas = root.querySelector('.b-fluid__canvas');
    var cursor = root.querySelector('.b-cursor');
    if (!canvas) return null;
    var c = canvas.getContext('2d');
    var dpr = 1;                       // soft gradients gain nothing from DPR
    var w = 1, h = 1, blobs = [];
    var p = { x: -999, y: -999, on: false };

    function resize() {
      var r = root.getBoundingClientRect();
      w = Math.max(r.width, 1); h = Math.max(r.height, 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!blobs.length) {
        for (var i = 0; i < 3; i++) {
          blobs.push({
            x: Math.random(), y: Math.random(), ph: Math.random() * 6.28,
            r: 0.3 + Math.random() * 0.18,
            t: i % 2 ? [252, 71, 120, 0.22] : [255, 255, 255, 0.4]
          });
        }
      }
    }

    function step(time) {
      c.clearRect(0, 0, w, h);
      var big = Math.max(w, h);
      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i];
        var px = (b.x + Math.sin(time * 0.00015 + b.ph) * 0.28) * w;
        var py = (b.y + Math.cos(time * 0.00012 + b.ph) * 0.24) * h;
        if (p.on) {
          var dx = px - p.x, dy = py - p.y, d = Math.hypot(dx, dy) || 1;
          if (d < big * 0.6) { var k = (1 - d / (big * 0.6)) * 30; px += dx / d * k; py += dy / d * k; }
        }
        var rad = b.r * big;
        var g = c.createRadialGradient(px, py, 0, px, py, rad);
        var t = b.t;
        g.addColorStop(0, 'rgba(' + t[0] + ',' + t[1] + ',' + t[2] + ',' + t[3] + ')');
        g.addColorStop(1, 'rgba(' + t[0] + ',' + t[1] + ',' + t[2] + ',0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(px, py, rad, 0, 6.2832); c.fill();
      }
    }

    root.parentElement.addEventListener('pointermove', function (e) {
      var r = root.getBoundingClientRect();
      p.x = e.clientX - r.left; p.y = e.clientY - r.top; p.on = true;
      if (cursor) cursor.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)';
    }, { passive: true });
    root.parentElement.addEventListener('pointerleave', function () { p.on = false; }, { passive: true });

    resize();
    return {
      resize: resize, step: step, root: root,
      // the fixed USP cards are all 'in viewport' at once; only the one the
      // stack is actually showing should be painted
      gate: root.closest('.s__usp-wrapper') || root
    };
  }

  /* ═══════════════════════════════════════════ 7. drifting card stack
     Pink cards in loose columns, each trailing offset copies — the shape
     behind the closing headline. Sized from the .s__ruler the stylesheet
     already provides at each breakpoint. */
  function Cards(section) {
    var canvas = section.querySelector('.s__cards-canvas');
    var ruler = section.querySelector('.s__ruler');
    if (!canvas) return null;
    var c = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = 1, h = 1, cw = 120, ch = 160, cols = [], dots = null;

    function resize() {
      var r = section.getBoundingClientRect();
      w = Math.max(r.width, 1); h = Math.max(r.height, 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (ruler) {
        var rr = ruler.getBoundingClientRect();
        if (rr.width) { cw = rr.width; ch = rr.height; }
      }
      var d = document.createElement('canvas');
      d.width = d.height = 5;
      var dc = d.getContext('2d');
      dc.fillStyle = 'rgba(255,255,255,0.55)';
      dc.fillRect(0, 0, 1.2, 1.2);
      dots = c.createPattern(d, 'repeat');
      // fewer, wider-spaced columns on narrow screens, or they merge into
      // one solid block
      var count = w < 700 ? 2 : 4;
      if (cols.length !== count) {
        cols = [];
        for (var i = 0; i < count; i++) {
          cols.push({
            x: 0.03 + i * (w < 700 ? 0.34 : 0.15) + Math.random() * 0.02,
            y: -0.02 + Math.random() * 0.12,
            ph: Math.random() * 6.28,
            spd: 0.05 + Math.random() * 0.05,
            depth: (w < 700 ? 5 : 7) + ((Math.random() * 4) | 0)
          });
        }
      }
    }

    function step(time) {
      c.clearRect(0, 0, w, h);
      var t = time * 0.001;
      for (var i = 0; i < cols.length; i++) {
        var col = cols[i];
        var bx = (col.x + Math.sin(t * col.spd + col.ph) * 0.03) * w;
        var by = (col.y + (Math.sin(t * col.spd * 0.7 + col.ph) * 0.5 + 0.5) * 0.3) * h;
        var sx = Math.cos(t * 0.13 + col.ph) * 15 + 18;
        var sy = Math.sin(t * 0.11 + col.ph) * 16 - 24;
        for (var k = col.depth; k >= 0; k--) {
          var a = 0.08 + (1 - k / col.depth) * 0.38;
          c.fillStyle = 'rgba(252,71,120,' + a.toFixed(3) + ')';
          c.fillRect(Math.round(bx + sx * k), Math.round(by + sy * k), cw, ch);
        }
      }
      if (dots) {
        c.globalCompositeOperation = 'source-atop';
        c.fillStyle = dots;
        c.fillRect(0, 0, w, h);
        c.globalCompositeOperation = 'source-over';
      }
    }

    resize();
    return { resize: resize, step: step };
  }

  /* ═══════════════════════════════════════════ 8. wiring the sections */
  var hero = document.querySelector('.s-hero');
  var cta = document.querySelector('.s-final-cta');

  var heroFluid = hero ? FluidSection({
    root: hero.querySelector('.s__fluid .b-fluid'),
    host: hero,
    title: hero.querySelector('.s__title'),
    strength: 0.03,
    onPaint: function () { if (!coarse) hero.classList.add('is-fluid-ready'); }
  }) : null;

  var ctaFluid = cta ? FluidSection({
    root: cta.querySelector('.s__background'),
    host: cta,
    title: cta.querySelector('.s__title'),
    strength: 0.028,
    onPaint: function () { if (!coarse) cta.classList.add('is-cta-ready'); }
  }) : null;

  var ctaCards = cta ? Cards(cta) : null;

  // If WebGL is unavailable the headline must stay a normal DOM element.
  if (!heroFluid && hero) hero.classList.remove('is-fluid-ready');
  if (!ctaFluid && cta) cta.classList.add('is-cta-fallback');

  var minis = [];
  Array.prototype.forEach.call(document.querySelectorAll('.b-fluid'), function (el) {
    if (heroFluid && el === heroFluid.root) return;
    if (ctaFluid && el === ctaFluid.root) return;
    if (!el.parentElement) return;
    var m = MiniFluid(el);
    if (m) minis.push(m);
  });

  /* ═══════════════════════════════════════════ 9. USP card artwork */
  var ART = {
    'b-usp-asset-continuity': function () {
      var msgs = '';
      for (var i = 0; i < 4; i++) {
        var up = i % 2 === 0, y = 34 + i * 24;
        msgs += '<rect class="u-dot" x="' + (up ? 52 : 92) + '" y="' + y + '" width="56" height="10" rx="5" opacity="0">' +
          '<animate attributeName="opacity" values="0;.9;.9;0" dur="4s" begin="' + (i * 0.45) + 's" repeatCount="indefinite"/>' +
          '<animate attributeName="x" values="' + (up ? '46;52' : '98;92') + '" dur="4s" begin="' + (i * 0.45) + 's" repeatCount="indefinite"/></rect>';
      }
      return '<svg class="b-usp-art" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid meet">' +
        '<circle class="u-node" cx="32" cy="75" r="15"/><circle class="u-node" cx="168" cy="75" r="15"/>' +
        '<text class="u-label" x="32" y="110" text-anchor="middle">AJAN A</text>' +
        '<text class="u-label" x="168" y="110" text-anchor="middle">AJAN B</text>' + msgs + '</svg>';
    },
    'b-usp-asset-capacity': function () {
      var s = '';
      for (var i = 0; i < 7; i++) {
        var hot = (i === 2 || i === 5);
        s += '<rect class="' + (hot ? 'u-hot' : 'u-dot') + '" x="-14" y="' + (24 + i * 15) + '" width="12" height="9" rx="2">' +
          '<animate attributeName="x" values="-14;196" dur="3.6s" begin="' + (i * 0.42) + 's" repeatCount="indefinite"/>' +
          '<animate attributeName="opacity" values="0;1;1;0" dur="3.6s" begin="' + (i * 0.42) + 's" repeatCount="indefinite"/></rect>';
      }
      return '<svg class="b-usp-art" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid meet">' +
        '<line class="u-line" x1="100" y1="8" x2="100" y2="132" stroke-dasharray="4 5"/>' +
        '<text class="u-label" x="100" y="145" text-anchor="middle">STAGE 1</text>' + s + '</svg>';
    },
    'b-usp-asset-collaboration': function () {
      var g = '', k = 0;
      for (var r = 0; r < 4; r++) {
        for (var col = 0; col < 3; col++) {
          var hit = (r === 1 && col === 2) || (r === 3 && col === 0);
          g += '<rect class="' + (hit ? 'u-hot' : 'u-bar') + '" x="' + (28 + col * 52) + '" y="' + (18 + r * 28) + '" width="44" height="21" rx="4">' +
            (hit ? '<animate attributeName="opacity" values=".15;1;1;.15" dur="4s" begin="' + (k * 1.6) + 's" repeatCount="indefinite"/>' : '') + '</rect>';
          if (hit) k++;
        }
      }
      return '<svg class="b-usp-art" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid meet">' +
        g + '<text class="u-label" x="100" y="143" text-anchor="middle">MAST · 14 HATA MODU</text></svg>';
    },
    'b-usp-asset-experience': function () {
      var l = '', widths = [96, 132, 118, 74, 132, 104];
      for (var i = 0; i < widths.length; i++) {
        l += '<rect class="' + (i === 3 ? 'u-hot' : 'u-dot') + '" x="42" y="' + (40 + i * 15) + '" width="0" height="7" rx="3.5">' +
          '<animate attributeName="width" values="0;' + widths[i] + ';' + widths[i] + ';0" dur="5s" begin="' + (i * 0.28) + 's" repeatCount="indefinite"/></rect>';
      }
      return '<svg class="b-usp-art" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid meet">' +
        '<rect class="u-line" x="34" y="18" width="132" height="114" rx="6" fill="none"/>' +
        '<text class="u-label" x="42" y="32">RAPOR</text>' + l + '</svg>';
    }
  };
  Object.keys(ART).forEach(function (cls) {
    var el = document.querySelector('.' + cls);
    if (el) el.innerHTML = ART[cls]();
  });

  /* ═══════════════════════════════════════════ 10. line reveals */
  function splitLines(el) {
    if (!el || el.dataset.split === 'done') return;

    if (/<br\s*\/?>/i.test(el.innerHTML)) {
      el.innerHTML = el.innerHTML.split(/<br\s*\/?>/i).map(function (part) {
        return '<span class="line"><span class="line__inner">' + part.trim() + '</span></span>';
      }).join('');
      el.dataset.split = 'done';
      return;
    }

    var text = el.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return;
    var words = text.split(' ');
    el.textContent = '';
    var probes = words.map(function (w, i) {
      var s = document.createElement('span');
      s.textContent = w + (i < words.length - 1 ? ' ' : '');
      s.style.display = 'inline-block';
      el.appendChild(s);
      return s;
    });
    var lines = [], top = null;
    probes.forEach(function (s) {
      var t = Math.round(s.offsetTop);
      if (top === null || t !== top) { lines.push([]); top = t; }
      lines[lines.length - 1].push(s.textContent);
    });
    el.innerHTML = lines.map(function (ws) {
      return '<span class="line"><span class="line__inner">' + ws.join('') + '</span></span>';
    }).join('');
    el.dataset.split = 'done';
  }

  var revealTargets = [];
  function registerReveal(el) { if (el) { splitLines(el); revealTargets.push(el); } }

  registerReveal(document.querySelector('.b-quote .b__text'));
  registerReveal(document.querySelector('.s-catchphrase .s__title'));
  if (!ctaFluid) registerReveal(document.querySelector('.s-final-cta .s__title'));

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-revealed'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('is-revealed'); });
  }

  /* ═══════════════════════════════════════════ 11. FAQ accordion */
  Array.prototype.forEach.call(document.querySelectorAll('.b-faq'), function (faq) {
    var btn = faq.querySelector('.b__toggle'), wrap = faq.querySelector('.b__wrapper');
    if (!btn || !wrap) return;
    wrap.style.height = '0px';
    wrap.style.transition = reduced ? 'none' : 'height .6s cubic-bezier(.23,1,.32,1)';

    function close(f) {
      var b = f.querySelector('.b__toggle'), w = f.querySelector('.b__wrapper');
      w.style.height = w.scrollHeight + 'px';
      requestAnimationFrame(function () { w.style.height = '0px'; });
      b.setAttribute('aria-expanded', 'false');
      f.classList.remove('is-open');
    }

    btn.addEventListener('click', function () {
      if (btn.getAttribute('aria-expanded') === 'true') { close(faq); return; }
      Array.prototype.forEach.call(document.querySelectorAll('.b-faq.is-open'), function (o) {
        if (o !== faq) close(o);
      });
      wrap.style.height = wrap.scrollHeight + 'px';
      btn.setAttribute('aria-expanded', 'true');
      faq.classList.add('is-open');
      var done = function () {
        if (btn.getAttribute('aria-expanded') === 'true') wrap.style.height = 'auto';
        wrap.removeEventListener('transitionend', done);
      };
      wrap.addEventListener('transitionend', done);
    });
  });

  /* ═══════════════════════════════════════════ 12. demo tabs */
  (function () {
    var demo = document.querySelector('.b-demo');
    if (!demo) return;
    var tabs = Array.prototype.slice.call(demo.querySelectorAll('.b-demo__tab'));
    var panes = Array.prototype.slice.call(demo.querySelectorAll('.b-demo__screen'));
    if (!tabs.length) return;

    function show(i) {
      tabs.forEach(function (t, k) {
        t.classList.toggle('is-active', k === i);
        t.setAttribute('aria-selected', k === i ? 'true' : 'false');
        t.tabIndex = k === i ? 0 : -1;
      });
      panes.forEach(function (p, k) { p.classList.toggle('is-active', k === i); });
    }

    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { show(i); });
      t.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = (i + d + tabs.length) % tabs.length;
        show(n); tabs[n].focus();
      });
    });
    show(0);
  })();

  /* ═══════════════════════════════════════════ 13. team photo fallback */
  Array.prototype.forEach.call(document.querySelectorAll('.b-team__photo img'), function (img) {
    img.addEventListener('error', function () {
      img.parentElement.classList.add('is-empty');
      img.remove();
    });
  });

  /* ═══════════════════════════════════════════ 14. contact modal */
  var modal = document.querySelector('.s-modal');
  var lastFocus = null;

  function openModal() {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.removeAttribute('inert');
    modal.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
    Scroller.lock(true);
    var f = modal.querySelector('a,button');
    if (f) f.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-visible');
    modal.setAttribute('inert', '');
    document.body.style.overflow = '';
    Scroller.lock(false);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-modal-open], a[href="#triggerSiteContact"]')) {
      e.preventDefault(); openModal(); return;
    }
    if (e.target.closest('.s-modal .s__close') || e.target.closest('.s-modal .s__overlay')) {
      e.preventDefault(); closeModal(); return;
    }
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (id === '#' || id === '#triggerSiteContact') return;
    var t = document.querySelector(id);
    if (!t) return;
    e.preventDefault();
    Scroller.to(window.scrollY + t.getBoundingClientRect().top - 90);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal && modal.classList.contains('is-visible')) closeModal();
  });

  /* ═══════════════════════════════════════════ 15. USP card stack */
  var usps = document.querySelector('.s-usps');
  var uspHeader = usps && usps.querySelector('.s__header');
  var uspWrappers = usps ? Array.prototype.slice.call(usps.querySelectorAll('.s__usp-wrapper')) : [];
  var uspCards = uspWrappers.map(function (w) { return w.querySelector('.b-usp-card'); });

  function updateStack() {
    if (!usps || !uspWrappers.length) return;
    var rect = usps.getBoundingClientRect();
    var scrolled = -rect.top;
    var height = rect.height;

    var inView = rect.top < vh * 1.1 && rect.top + height > -vh * 0.4;
    usps.style.visibility = inView ? '' : 'hidden';
    if (!inView) return;

    // The section opens with 75svh of padding so the intro gets the screen
    // to itself; it only gives way once the first card is genuinely close.
    if (uspHeader) {
      var hp = smoothstep(0.44, 0.98, scrolled / vh);
      uspHeader.style.opacity = String(1 - hp);
      uspHeader.style.transform = 'translate(-50%,0) scale(' + (1 - hp * 0.12) + ')';
      uspHeader.style.visibility = hp >= 1 ? 'hidden' : '';
    }

    var exit = clamp((scrolled - (height - vh * 1.1)) / (vh * 0.5), 0, 1);

    uspWrappers.forEach(function (wrap, i) {
      var card = uspCards[i];
      var t = (scrolled - (vh * 0.82 + i * vh)) / vh;

      if (t < -1.2 || t > 3.4 || exit >= 1) { wrap.style.visibility = 'hidden'; return; }
      wrap.style.visibility = '';

      var y, scale = 1, rot = 0, fade = 0, opacity = 1;
      if (t < 0) {
        var e = easeOut(clamp(t + 1, 0, 1));
        y = (1 - e) * vh * 0.68;
        opacity = clamp(e * 1.9, 0, 1);
      } else {
        var r = clamp(t, 0, 3);
        y = -r * 14;
        scale = 1 - r * 0.055;
        rot = -r * 3.2;
        fade = Math.min(r * 0.24, 0.72);
      }
      if (exit > 0) { y += exit * vh * 0.35; opacity *= 1 - exit; }

      wrap.style.opacity = String(opacity);
      if (card) {
        card.style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0) rotateX(' +
          rot.toFixed(2) + 'deg) scale(' + scale.toFixed(3) + ')';
        card.style.setProperty('--fade', fade.toFixed(3));
      }
    });
  }

  /* ═══════════════════════════════════════════ 16. diagram scrub
     The pipeline draws itself as the card crosses the viewport; once the
     flow has arrived the page carries on scrolling as normal. */
  var diagram = document.querySelector('.b__diagram svg');
  var dSteps = diagram ? Array.prototype.slice.call(diagram.querySelectorAll('[data-step]')) : [];
  var dMax = 0;

  dSteps.forEach(function (el) {
    dMax = Math.max(dMax, parseFloat(el.getAttribute('data-step')) || 0);
    if (el.tagName === 'path' || el.tagName === 'line') {
      var len = 0;
      try { len = el.getTotalLength(); } catch (err) { len = 0; }
      if (len) {
        el.style.strokeDasharray = len + ' ' + len;
        el.style.strokeDashoffset = len;
        el.dataset.len = len;
      }
    }
  });

  var dTrack = diagram ? diagram.closest('.s__execution') : null;
  var dCard = diagram ? diagram.closest('.b-execution') : null;
  var dStickyTop = 0;

  function measureDiagram() {
    if (!dCard) return;
    var t = parseFloat(getComputedStyle(dCard).top);
    dStickyTop = isNaN(t) ? 0 : t;
  }

  function updateDiagram() {
    if (!diagram || !dSteps.length || !dTrack || !dCard) return;

    var track = dTrack.getBoundingClientRect();
    var card = dCard.getBoundingClientRect();
    if (!card.height || track.bottom < -200 || track.top > vh + 200) return;

    var p;
    var pin = track.height - card.height;

    if (pin > 60 && getComputedStyle(dCard).position === 'sticky') {
      // pinned: scrub straight against how far we are through the track
      p = clamp((dStickyTop - track.top) / pin, 0, 1);
    } else {
      // narrow screens keep the layout flowing, so fall back to a plain
      // "while it crosses the viewport" scrub
      var start = vh * 0.9;
      var end = Math.max(vh * 0.1, vh * 0.5 - card.height * 0.4);
      p = clamp((start - card.top) / (start - end), 0, 1);
    }

    var headPos = p * (dMax + 1.15);

    dSteps.forEach(function (el) {
      var st = parseFloat(el.getAttribute('data-step')) || 0;
      var local = clamp(headPos - st, 0, 1);
      var eased = easeOut(local);

      if (el.dataset.len) {
        el.style.strokeDashoffset = ((1 - eased) * parseFloat(el.dataset.len)).toFixed(1);
        el.style.opacity = local > 0.001 ? '1' : '0';
      } else {
        el.style.opacity = (0.06 + eased * 0.94).toFixed(3);
      }

      // the step the flow is passing through lights up in accent, then
      // settles back once it has arrived
      var hot = local > 0.001 && local < 0.92;
      if (hot !== (el.dataset.hot === '1')) {
        el.dataset.hot = hot ? '1' : '0';
        el.classList.toggle('dg-hot', hot);
      }
    });
  }

  /* ═══════════════════════════════════════════ 17. header + loop */
  var head = document.querySelector('.site-head');
  var lastY = window.scrollY;

  function measure() {
    vh = window.innerHeight;
    var cp = document.querySelector('.s-catchphrase');
    var cc = cp && cp.querySelector('.s__content');
    if (cp && cc) cp.style.setProperty('--content-height', cc.offsetHeight + 'px');
    if (heroFluid) heroFluid.repaint();
    if (ctaFluid) ctaFluid.repaint();
    if (ctaCards) ctaCards.resize();
    measureDiagram();
    minis.forEach(function (m) { m.resize(); });
  }

  function inViewport(el, margin) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.bottom > -(margin || 0) && r.top < vh + (margin || 0);
  }

  var running = true;
  var prev = performance.now();
  var miniTick = 0;

  // Adaptive quality: if the device cannot keep up, shed the ambient work
  // rather than let the page stutter. Scrolling smoothly matters more than
  // the decoration does.
  var slowFrames = 0, degraded = false;

  function loop(now) {
    requestAnimationFrame(loop);
    if (!running) { prev = now; return; }
    var raw = now - prev;
    var dt = Math.min(raw / 1000, 0.05);
    prev = now;

    if (!degraded) {
      slowFrames = raw > 34 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 90) { degraded = true; doc.classList.add('is-degraded'); }
    }

    Scroller.update();
    updateStack();
    updateDiagram();

    var y = window.scrollY;
    if (head) {
      head.style.transition = 'transform .45s cubic-bezier(.23,1,.32,1)';
      head.style.transform = (y > 260 && y > lastY + 1) ? 'translateY(-160%)' : 'translateY(0)';
    }
    if (Math.abs(y - lastY) > 0.5) lastY = y;

    var half = degraded && (now % 32 < 16);
    if (heroFluid && !half && inViewport(hero, 200)) heroFluid.frame(dt);
    if (ctaFluid && !half && inViewport(cta, 200)) ctaFluid.frame(dt);
    if (ctaCards && !half && inViewport(cta, 200)) ctaCards.step(now);
    if (!degraded && now - miniTick > 32) {
      miniTick = now;
      minis.forEach(function (m) {
        if (m.gate.style.visibility === 'hidden') return;
        if (inViewport(m.root, 120)) m.step(now);
      });
    }
  }

  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    prev = performance.now();
  });

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { measure(); updateStack(); updateDiagram(); }, 140);
  });

  measure();
  updateStack();
  updateDiagram();
  requestAnimationFrame(loop);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { measure(); });
  }
  window.addEventListener('load', function () { measure(); updateStack(); });
})();
