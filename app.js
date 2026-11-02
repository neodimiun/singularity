/* Singularity Tracker page script.
 * Draws observed data only (no fitted curves) with the vendored uPlot 1.6.32 (MIT).
 * Every time axis supports drag-select, wheel / pinch zoom, swipe pan, buttons and
 * keyboard, with a minimum visible span of 7 days. All dates are UTC. */
(function () {
  'use strict';

  var DAY = 86400;
  var MIN_SPAN = 7 * DAY;
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var THEME_KEY = 'st-theme';
  var FONT = '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  var HINT = 'Hover or tap for details.';
  var PAD_R = 26; // right padding of every chart, in CSS px: room for half a day label at the edge
  // Legend swatches use the CSS tokens, so they follow the theme without a rebuild.
  var SW = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];
  var SW_FLAG = 'var(--ink-2)';
  var groups = [];
  var uid = 0;

  /* ------------------------------------------------------------ helpers */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    if (text != null) e.textContent = text;
    return e;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dayTs(s) { return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 1000; }
  function monthTs(s) { return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, 1) / 1000; }
  function asDate(t) { return new Date(t * 1000); }
  function fmtDay(t) {
    var d = asDate(t);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }
  function fmtInt(n) { return n == null ? '–' : Number(n).toLocaleString('en-US'); }
  function fmtCompact(v) {
    if (v == null) return '';
    var a = Math.abs(v);
    if (a >= 1e6) return +(v / 1e6).toFixed(1) + 'M';
    if (a >= 1e4) return +(v / 1e3).toFixed(0) + 'k';
    if (a >= 1e3) return +(v / 1e3).toFixed(1) + 'k';
    return String(+v.toFixed(2));
  }
  function fmtLinear(v) { return Math.abs(v) >= 1e4 ? fmtCompact(v) : fmtInt(v); }
  function fmtExp(v) {
    if (v == null) return '';
    return v.toExponential(2).replace(/\.?0+e/, 'e').replace('e+', 'e');
  }
  function weekdayIdx(t) { return (((Math.floor(t / DAY) % 7) + 7) + 3) % 7; } // Monday = 0
  function isoWeek(t) {
    var day = Math.floor(t / DAY);
    var thu = day - weekdayIdx(t) + 3; // Thursday of this ISO week, in days since epoch
    var y = asDate(thu * DAY).getUTCFullYear();
    var jan1 = Date.UTC(y, 0, 1) / 1000 / DAY;
    return { year: y, week: Math.floor((thu - jan1) / 7) + 1 };
  }
  function dayLabel(t) { return WDAY[weekdayIdx(t)] + ' ' + fmtDay(t); }
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function pxr() { return (window.uPlot && window.uPlot.pxRatio) || window.devicePixelRatio || 1; }
  // uPlot scales line widths by the pixel ratio but not dash lengths, so scale them here: without
  // this the gaps shrink to one device pixel on high-density screens and dashed lines look solid.
  function dashPattern() { return [5 * pxr(), 4 * pxr()]; }
  function palette() {
    return {
      ink: cssVar('--ink'), ink2: cssVar('--ink-2'), grid: cssVar('--grid'), axis: cssVar('--axis'),
      surface: cssVar('--surface'),
      s: [cssVar('--series-1'), cssVar('--series-2'), cssVar('--series-3'), cssVar('--series-4')]
    };
  }

  /* ------------------------------------------------------------ theme */

  function storedTheme() {
    try { return window.localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function storeTheme(v) {
    try { window.localStorage.setItem(THEME_KEY, v); } catch (e) { /* storage unavailable */ }
  }
  function currentTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function initTheme() {
    var t = storedTheme();
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.hidden = false;
    function sync() { btn.setAttribute('aria-pressed', currentTheme() === 'dark' ? 'true' : 'false'); }
    btn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      storeTheme(next);
      sync();
      rebuildAll();
    });
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () {
        if (!document.documentElement.hasAttribute('data-theme')) { sync(); rebuildAll(); }
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
    sync();
  }
  function rebuildAll() { groups.forEach(function (g) { g.rebuild(); }); }

  /* ------------------------------------------------------------ time ticks
   * Granularity adapts to the visible span and plot width:
   * years -> months -> ISO weeks (Mondays) -> days. */

  var STEPS = [
    { unit: 'day', n: 1, approx: DAY, space: 50 },
    // Compact day ticks for narrow plots (phones at the 7-day zoom): "5", with "W41" on Mondays.
    { unit: 'day', n: 1, approx: DAY, space: 22, compact: true },
    { unit: 'week', n: 1, approx: 7 * DAY, space: 64 },
    { unit: 'week', n: 2, approx: 14 * DAY, space: 64 },
    { unit: 'month', n: 1, approx: 30.44 * DAY, space: 44 },
    { unit: 'month', n: 2, approx: 60.9 * DAY, space: 44 },
    { unit: 'month', n: 3, approx: 91.3 * DAY, space: 44 },
    { unit: 'month', n: 6, approx: 182.6 * DAY, space: 44 },
    { unit: 'year', n: 1, approx: 365.25 * DAY, space: 40 },
    { unit: 'year', n: 2, approx: 730.5 * DAY, space: 40 },
    { unit: 'year', n: 5, approx: 1826 * DAY, space: 40 },
    { unit: 'year', n: 10, approx: 3652 * DAY, space: 40 },
    { unit: 'year', n: 20, approx: 7305 * DAY, space: 40 },
    { unit: 'year', n: 50, approx: 18262 * DAY, space: 40 }
  ];
  function pickStep(span, width) {
    for (var i = 0; i < STEPS.length; i++) {
      if (STEPS[i].approx / span * width >= STEPS[i].space) return STEPS[i];
    }
    return STEPS[STEPS.length - 1];
  }
  function genSplits(min, max, s) {
    var out = [], t, y, m;
    if (s.unit === 'day' || s.unit === 'week') {
      t = Math.ceil(min / DAY) * DAY;
      if (s.unit === 'week') {
        t += ((7 - weekdayIdx(t)) % 7) * DAY;
        if (s.n === 2 && isoWeek(t).week % 2 === 0) t += 7 * DAY;
      }
      var step = (s.unit === 'week' ? 7 : 1) * s.n * DAY;
      for (; t <= max; t += step) out.push(t);
    } else if (s.unit === 'month') {
      var d = asDate(min);
      y = d.getUTCFullYear(); m = d.getUTCMonth();
      if (Date.UTC(y, m, 1) / 1000 < min) m += 1;
      m = Math.ceil(m / s.n) * s.n;
      for (;;) {
        t = Date.UTC(y, m, 1) / 1000;
        if (t > max) break;
        out.push(t);
        m += s.n;
      }
    } else {
      y = asDate(min).getUTCFullYear();
      if (Date.UTC(y, 0, 1) / 1000 < min) y += 1;
      y = Math.ceil(y / s.n) * s.n;
      for (; (t = Date.UTC(y, 0, 1) / 1000) <= max; y += s.n) out.push(t);
    }
    return out;
  }
  var measureCtx = null;
  function textW(str) {
    if (!str) return 0;
    if (!measureCtx) { measureCtx = document.createElement('canvas').getContext('2d'); measureCtx.font = FONT; }
    return measureCtx.measureText(str).width;
  }
  function joinLine2(w, m) { return w && m ? w + ' · ' + m : (w || m || ''); }
  function monthYear(t) { var d = asDate(t); return MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }

  /* Two-line tick labels. Day ticks: "Mon 5" (or "5" when compact); the second line names the ISO
   * week on Mondays and the month on the first tick and on the 1st. Second lines that would run into
   * each other are resolved left to right, and any line that would be cut off at the canvas edge is
   * dropped (labels are centred on their tick). */
  function tickLabels(u, splits, s) {
    var n = splits.length, l1 = [], l2 = [];
    var pos = splits.map(function (t) { return u.valToPos(t, 'x'); });
    if (s.unit === 'day') {
      var wk = [], mon = [], kept = [];
      splits.forEach(function (t, i) {
        var dd = asDate(t).getUTCDate(), wd = weekdayIdx(t);
        l1.push(s.compact ? String(dd) : WDAY[wd] + ' ' + dd);
        wk.push(wd === 0 ? 'W' + pad2(isoWeek(t).week) : '');
        mon.push(i === 0 || dd === 1 ? monthYear(t) : '');
      });
      for (var i = 0; i < n; i++) {
        var w = wk[i], m = mon[i];
        if (!w && !m) { l2.push(''); continue; }
        while (kept.length) {
          var j = kept[kept.length - 1];
          var gap = (pos[i] - textW(joinLine2(w, m)) / 2) - (pos[j] + textW(l2[j]) / 2);
          if (!(gap < 6)) break;
          if (mon[j]) {
            // The earlier tick gives up its month; this tick names its own month instead.
            if (!m) { m = monthYear(splits[i]); mon[i] = m; }
            mon[j] = '';
            l2[j] = wk[j];
          } else {
            l2[j] = '';
          }
          if (!l2[j]) kept.pop();
        }
        l2.push(joinLine2(w, m));
        kept.push(i);
      }
    } else if (s.unit === 'week') {
      splits.forEach(function (t, i) {
        var w = isoWeek(t), d = asDate(t);
        l1.push((i === 0 || w.week === 1) ? w.year + '-W' + pad2(w.week) : 'W' + pad2(w.week));
        l2.push(MON[d.getUTCMonth()] + ' ' + d.getUTCDate());
      });
    } else if (s.unit === 'month') {
      splits.forEach(function (t, i) {
        var d = asDate(t), mo = d.getUTCMonth();
        l1.push(MON[mo]);
        l2.push(i === 0 || mo === 0 ? String(d.getUTCFullYear()) : '');
      });
    } else {
      splits.forEach(function (t) { l1.push(String(asDate(t).getUTCFullYear())); l2.push(''); });
    }
    var left = u.bbox.left / pxr(), right = u.bbox.width / pxr() + PAD_R;
    if (right > PAD_R + 1) {
      for (var k = 0; k < n; k++) {
        if (!isFinite(pos[k])) continue;
        var h1 = textW(l1[k]) / 2, h2 = textW(l2[k]) / 2;
        if (pos[k] + h2 > right - 1 || pos[k] - h2 < 1 - left) l2[k] = '';
        if (pos[k] + h1 > right - 1 || pos[k] - h1 < 1 - left) { l1[k] = ''; l2[k] = ''; }
      }
    }
    return l1.map(function (a, k) { return l2[k] ? a + '\n' + l2[k] : a; });
  }
  function xAxis(P) {
    return {
      scale: 'x', stroke: P.ink2, font: FONT, size: 48, gap: 5,
      grid: { stroke: P.grid, width: 1 }, ticks: { stroke: P.axis, width: 1, size: 5 },
      splits: function (u, ai, mn, mx) {
        var w = Math.max(60, u.bbox.width / pxr());
        u._stStep = pickStep(Math.max(mx - mn, 1), w);
        return genSplits(mn, mx, u._stStep);
      },
      values: function (u, splits) { return tickLabels(u, splits, u._stStep || STEPS[0]); }
    };
  }
  function logSplits(u, ai, mn, mx) {
    if (!(mn > 0) || !(mx > mn)) return [];
    var lo = Math.floor(Math.log10(mn) + 1e-9), hi = Math.ceil(Math.log10(mx) - 1e-9);
    var maxLabels = Math.max(2, Math.floor(u.bbox.height / pxr() / 26));
    var stepDec = Math.max(1, Math.ceil((hi - lo + 1) / maxLabels));
    var mults = (hi - lo <= 2 && stepDec === 1) ? [1, 2, 5] : [1];
    var out = [];
    for (var e = lo; e <= hi; e++) {
      if ((e - lo) % stepDec) continue;
      for (var j = 0; j < mults.length; j++) {
        var v = mults[j] * Math.pow(10, e);
        if (v >= mn * (1 - 1e-9) && v <= mx * (1 + 1e-9)) out.push(v);
      }
    }
    return out;
  }
  function yAxis(P, kind) {
    var a = {
      scale: 'y', stroke: P.ink2, font: FONT, size: kind === 'exp' ? 50 : 54, gap: 5,
      grid: { stroke: P.grid, width: 1 }, ticks: { stroke: P.axis, width: 1, size: 5 }
    };
    if (kind === 'log' || kind === 'exp') {
      a.splits = logSplits;
      a.filter = function (u, s) { return s; }; // logSplits already thins the labels
      a.values = function (u, s) { return s.map(kind === 'exp' ? fmtExp : fmtCompact); };
    } else {
      a.values = function (u, s) { return s.map(fmtLinear); };
    }
    return a;
  }
  function zeroRange(u, mn, mx) {
    var r = window.uPlot.rangeNum(0, Math.max(1, mx || 0), 0.1, true);
    return [0, r[1]];
  }

  /* ------------------------------------------------------------ zoom group
   * One group per panel. All charts in a group share the x range. */

  function Group(id, mount, fullMin, fullMax, build) {
    this.id = id;
    this.mount = mount;
    this.fullMax = fullMax;
    this.fullMin = Math.min(fullMin, fullMax - MIN_SPAN);
    this.min = this.fullMin;
    this.max = this.fullMax;
    this.charts = [];
    this.buildFn = build;
    this._t = null;
    mount.__stGroup = this;
    groups.push(this);
    watchAutoZoom(this);
  }
  // Scroll-triggered zoom (owner's request, #31): once per page load, when a chart is mostly on screen, glide from the
  // full range to its recent end (the last quarter of the range, at least two years); a reader's own zoom first, or
  // during the glide, stops it. Reduced motion jumps.
  var REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function watchAutoZoom(g) {
    if (!window.IntersectionObserver) return;
    var io = new IntersectionObserver(function (es) {
      var seen = es.some(function (e) { return e.isIntersecting && e.intersectionRatio >= 0.55; });
      if (!seen || !g.charts.length) return;
      io.disconnect();
      if (g.min !== g.fullMin || g.max !== g.fullMax) return;   // the reader zoomed already
      var full = g.fullMax - g.fullMin, span = Math.min(full, Math.max(full * 0.25, 730 * DAY));
      if (span >= full * 0.98) return;
      var a0 = g.min, b0 = g.max, a1 = g.fullMax - span, b1 = g.fullMax;
      if (REDUCED_MOTION) { g.setRange(a1, b1); return; }
      setTimeout(function () {
        if (g.min !== a0 || g.max !== b0) return;
        var t0 = null, last = [a0, b0], dur = 1750;
        function step(t) {
          if (g.min !== last[0] || g.max !== last[1]) return;   // the reader took over
          if (t0 == null) t0 = t;
          var k = Math.min(1, (t - t0) / dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          g.setRange(a0 + (a1 - a0) * e, b0 + (b1 - b0) * e); last = [g.min, g.max];
          if (k < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }, 500);
    }, { threshold: [0.3, 0.55, 0.8] });
    io.observe(g.mount);
  }
  Group.prototype.clamp = function (min, max) {
    var full = this.fullMax - this.fullMin, span = max - min;
    if (!(span > 0) || !isFinite(span)) { min = this.min; max = this.max; span = max - min; }
    if (span < MIN_SPAN) {
      var c = (min + max) / 2;
      min = c - MIN_SPAN / 2; max = c + MIN_SPAN / 2; span = MIN_SPAN;
    }
    if (span >= full) return [this.fullMin, this.fullMax];
    if (min < this.fullMin) { max += this.fullMin - min; min = this.fullMin; }
    if (max > this.fullMax) { min -= max - this.fullMax; max = this.fullMax; }
    return [min, max];
  };
  Group.prototype.setRange = function (min, max) {
    var r = this.clamp(min, max);
    this.min = r[0]; this.max = r[1];
    this.charts.forEach(function (u) { u.setScale('x', { min: r[0], max: r[1] }); });
    this.updateUi();
  };
  Group.prototype.zoom = function (factor, frac) {
    if (frac == null || !isFinite(frac)) frac = 0.5;
    frac = Math.min(1, Math.max(0, frac));
    var span = this.max - this.min, anchor = this.min + frac * span, next = span * factor;
    this.setRange(anchor - frac * next, anchor - frac * next + next);
  };
  Group.prototype.pan = function (frac) {
    var shift = (this.max - this.min) * frac;
    this.setRange(this.min + shift, this.max + shift);
  };
  Group.prototype.reset = function () { this.setRange(this.fullMin, this.fullMax); };
  Group.prototype.isFull = function () {
    return this.min <= this.fullMin + 1 && this.max >= this.fullMax - 1;
  };
  Group.prototype.updateUi = function () {
    var self = this;
    if (!this.ui) return;
    var span = this.max - this.min;
    var minned = span <= MIN_SPAN + 1, full = this.isFull();
    this.ui.zin.setAttribute('aria-disabled', minned ? 'true' : 'false');
    this.ui.zout.setAttribute('aria-disabled', full ? 'true' : 'false');
    this.ui.reset.setAttribute('aria-disabled', full ? 'true' : 'false');
    this.ui.left.setAttribute('aria-disabled', this.min <= this.fullMin + 1 ? 'true' : 'false');
    this.ui.right.setAttribute('aria-disabled', this.max >= this.fullMax - 1 ? 'true' : 'false');
    clearTimeout(this._t);
    this._t = setTimeout(function () {
      var days = Math.round(span / DAY);
      self.ui.range.textContent = 'Showing ' + fmtDay(self.min) + ' to ' + fmtDay(self.max) + ' (' +
        fmtInt(days) + ' day' + (days === 1 ? '' : 's') + (full ? ', full range' : '') + ')';
    }, 120);
  };
  Group.prototype.rebuild = function () {
    var min = this.min, max = this.max;
    this.charts.forEach(function (u) { u.destroy(); });
    this.charts = [];
    this.buildFn(this);
    this.setRange(min, max);
  };

  function makeToolbar(group, title) {
    var bar = el('div', { 'class': 'chart-toolbar', role: 'group', 'aria-label': 'Zoom controls: ' + title });
    function btn(label, aria, fn) {
      var b = el('button', { type: 'button', 'class': 'btn', 'aria-label': aria }, label);
      b.addEventListener('click', function () { if (b.getAttribute('aria-disabled') !== 'true') fn(); });
      bar.appendChild(b);
      return b;
    }
    group.ui = {
      zin: btn('Zoom in', 'Zoom in', function () { group.zoom(0.5); }),
      zout: btn('Zoom out', 'Zoom out', function () { group.zoom(2); }),
      left: btn('◀', 'Pan earlier', function () { group.pan(-0.25); }),
      right: btn('▶', 'Pan later', function () { group.pan(0.25); }),
      reset: btn('Reset', 'Reset zoom to the full range', function () { group.reset(); }),
      range: el('span', { 'class': 'range-text', 'aria-live': 'polite' })
    };
    bar.appendChild(group.ui.range);
    return bar;
  }

  function makeLegend(items) {
    var ul = el('ul', { 'class': 'chart-legend', 'aria-label': 'Legend' });
    items.forEach(function (it) {
      var li = el('li');
      var sw = el('span', { 'class': 'swatch ' + (it.style || ''), 'aria-hidden': 'true' });
      sw.style.color = it.color;
      li.appendChild(sw);
      li.appendChild(document.createTextNode(it.label));
      ul.appendChild(li);
    });
    return ul;
  }

  function makeFrame(group, label, readout) {
    var hid = 'kbd-' + (++uid);
    var frame = el('div', { 'class': 'chart-frame', tabindex: '0', role: 'group', 'aria-label': label,
      'aria-describedby': hid });
    // read by screen readers through aria-describedby (a hidden element still describes its chart); not on the page
    var hint = el('span', { id: hid, hidden: 'hidden' },
      'Keyboard: plus and minus zoom, left and right arrows pan, 0 resets. The data table below lists every value.');
    frame.appendChild(hint);
    frame.addEventListener('keydown', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var k = e.key;
      if (k === '+' || k === '=' || k === 'Add') group.zoom(0.5);
      else if (k === '-' || k === '_' || k === 'Subtract') group.zoom(2);
      else if (k === '0') group.reset();
      else if (k === 'ArrowLeft') group.pan(e.shiftKey ? -0.5 : -0.2);
      else if (k === 'ArrowRight') group.pan(e.shiftKey ? 0.5 : 0.2);
      else if (k === 'Escape') { readout.innerHTML = esc(HINT); return; }
      else return;
      e.preventDefault();
    });
    frame.addEventListener('mousedown', function () {
      if (document.activeElement !== frame) frame.focus({ preventScroll: true });
    });
    return frame;
  }

  /* Attach wheel and touch interaction to one uPlot instance. */
  function attachInteractions(u, group, frame) {
    var over = u.over;
    over.addEventListener('wheel', function (e) {
      var focused = frame.contains(document.activeElement);
      if (!(e.ctrlKey || e.metaKey || focused)) return; // let the page scroll
      e.preventDefault();
      var r = over.getBoundingClientRect();
      var dx = e.deltaX, dy = e.deltaY;
      if (e.deltaMode === 1) { dx *= 16; dy *= 16; } else if (e.deltaMode === 2) { dx *= r.width; dy *= r.height; }
      if (!e.ctrlKey && Math.abs(dx) > Math.abs(dy)) { group.pan(dx / Math.max(1, r.width)); return; }
      var k = e.ctrlKey ? 0.01 : 0.0025;
      group.zoom(Math.exp(Math.max(-1, Math.min(1, dy * k))), (e.clientX - r.left) / Math.max(1, r.width));
    }, { passive: false });

    var st = null;
    over.addEventListener('touchstart', function (e) {
      var r = over.getBoundingClientRect();
      if (e.touches.length === 1) {
        var t = e.touches[0];
        st = { mode: 'one', x0: t.clientX, y0: t.clientY, t0: Date.now(), min: group.min, max: group.max,
          w: Math.max(1, r.width), moved: false };
      } else if (e.touches.length === 2) {
        var a = e.touches[0], b = e.touches[1];
        st = { mode: 'pinch', d0: Math.max(20, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)),
          cx: (a.clientX + b.clientX) / 2 - r.left, min: group.min, max: group.max, w: Math.max(1, r.width) };
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });
    over.addEventListener('touchmove', function (e) {
      if (!st) return;
      if (st.mode === 'one' && e.touches.length === 1) {
        var t = e.touches[0], dx = t.clientX - st.x0, dy = t.clientY - st.y0;
        if (!st.moved) {
          if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) st.moved = 'pan';
          else if (Math.abs(dy) > 8) { st = null; return; } // vertical: the page scrolls
        }
        if (st.moved === 'pan') {
          if (e.cancelable) e.preventDefault();
          var shift = -dx / st.w * (st.max - st.min);
          group.setRange(st.min + shift, st.max + shift);
        }
      } else if (st.mode === 'pinch' && e.touches.length === 2) {
        if (e.cancelable) e.preventDefault();
        var a = e.touches[0], b = e.touches[1];
        var d = Math.max(20, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY));
        var span0 = st.max - st.min, span = span0 * st.d0 / d, frac = st.cx / st.w;
        var anchor = st.min + frac * span0;
        group.setRange(anchor - frac * span, anchor - frac * span + span);
      }
    }, { passive: false });
    over.addEventListener('touchend', function (e) {
      if (!st) return;
      if (st.mode === 'one' && !st.moved && Date.now() - st.t0 < 500 && e.changedTouches.length) {
        var t = e.changedTouches[0], r = over.getBoundingClientRect();
        u.setCursor({ left: t.clientX - r.left, top: t.clientY - r.top });
        if (e.cancelable) e.preventDefault();
      } else if (st.moved && e.cancelable) {
        e.preventDefault();
      }
      if (e.touches.length === 0 || st.mode === 'pinch') st = null;
    }, { passive: false });
    over.addEventListener('touchcancel', function () { st = null; });
  }

  /* Create one uPlot in a group. cfg: {data, series, y, height, readout(u) -> html|null} */
  function addPlot(group, host, readoutEl, cfg) {
    var P = cfg.P;
    var width = Math.max(200, host.clientWidth || host.parentNode.clientWidth || 300);
    var opts = {
      width: width,
      height: cfg.height,
      legend: { show: false },
      padding: [10, PAD_R, 0, 0],
      cursor: {
        drag: { x: true, y: false, setScale: false },
        points: { size: 9, width: 2 },
        bind: {
          dblclick: function () { return function () { group.reset(); return null; }; }
        }
      },
      select: { show: true },
      scales: {
        x: { time: false, range: function () { return [group.min, group.max]; } },
        y: cfg.yScale
      },
      axes: [xAxis(P), cfg.yAxis],
      series: [{}].concat(cfg.series),
      hooks: {
        setSelect: [function (u) {
          var s = u.select;
          if (s.width > 4) {
            group.setRange(u.posToVal(s.left, 'x'), u.posToVal(s.left + s.width, 'x'));
          }
          u.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
        }],
        setCursor: [function (u) {
          var html = (u.cursor.left != null && u.cursor.left >= 0) ? cfg.readout(u) : null;
          if (html) readoutEl.innerHTML = html;
          else if (u.cursor.left == null || u.cursor.left < 0) readoutEl.innerHTML = esc(HINT);
        }]
      }
    };
    // Only override uPlot's own cursor.dataIdx (hover skip/proximity rules) where a chart asks to.
    if (cfg.dataIdx) opts.cursor.dataIdx = cfg.dataIdx;
    var u = new window.uPlot(opts, cfg.data, host);
    u.root.setAttribute('aria-hidden', 'true');
    attachInteractions(u, group, cfg.frame);
    group.charts.push(u);
    return u;
  }

  function observeSize(group, frame) {
    if (!window.ResizeObserver) return;
    var last = 0;
    new ResizeObserver(function () {
      var w = Math.floor(frame.clientWidth);
      if (!w || w === last) return;
      last = w;
      group.charts.forEach(function (u) { u.setSize({ width: Math.max(200, w), height: u.height }); });
    }).observe(frame);
  }

  /* Data table fallback, built on first open. */
  function makeTable(summary, jsonPath, columns, rows) {
    var det = el('details', { 'class': 'data-table' });
    var sum = el('summary', null, summary + ' (' + fmtInt(rows.length) + ' rows)');
    det.appendChild(sum);
    var built = false;
    det.addEventListener('toggle', function () {
      if (!det.open || built) return;
      built = true;
      var wrap = el('div', { 'class': 'table-wrap', role: 'region', tabindex: '0', 'aria-label': summary });
      var html = '<table><thead><tr>' + columns.map(function (c) {
        return '<th scope="col">' + esc(c.label) + '</th>';
      }).join('') + '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr>' + columns.map(function (c, i) {
          var v = c.get(r);
          return i === 0 ? '<th scope="row">' + esc(v) + '</th>' : '<td>' + esc(v) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
      wrap.innerHTML = html;
      det.appendChild(wrap);
      det.appendChild(el('p', { 'class': 'note', html: 'Source data: <a href="' + esc(jsonPath) + '">' +
        esc(jsonPath) + '</a>' }));
    });
    return det;
  }

  function panelShell(mount, title, ariaLabel, legendItems) {
    var readout = el('p', { 'class': 'chart-readout' });
    readout.innerHTML = esc(HINT);
    var group = mount.__pendingGroup;
    // Chart first: legend, plot and readout, then the zoom controls under the plot.
    if (legendItems) mount.appendChild(makeLegend(legendItems));
    var frame = makeFrame(group, ariaLabel, readout);
    mount.appendChild(frame);
    mount.appendChild(readout);
    mount.appendChild(makeToolbar(group, title));
    return { frame: frame, readout: readout };
  }

  function nearest(u, xs, idx, maxPx) {
    if (idx == null) return null;
    var px = u.valToPos(xs[idx], 'x');
    return Math.abs(px - u.cursor.left) <= maxPx ? xs[idx] : null;
  }

  /* ------------------------------------------------------------ monthly series with a flagged last month */

  function monthlyChart(mount, data, spec) {
    var src = data.rows;
    if (!src.length) return;
    // Calendar-complete months: a month with no row in the source file is a gap (null), never a zero.
    var byMonth = {}, rows = [];
    src.forEach(function (r) { byMonth[r.month] = r; });
    var yy = +src[0].month.slice(0, 4), mm = +src[0].month.slice(5, 7), lastMonth = src[src.length - 1].month;
    for (var guard = 0; guard < 12000; guard++) {
      var key = yy + '-' + pad2(mm);
      rows.push(byMonth[key] || { month: key, missing: true });
      if (key >= lastMonth) break;
      mm += 1;
      if (mm > 12) { mm = 1; yy += 1; }
    }
    var xs = rows.map(function (r) { return monthTs(r.month); });
    var flagIdx = -1;
    rows.forEach(function (r, i) { if (r[spec.flag]) flagIdx = i; });
    var fullMin = xs[0], fullMax = xs[xs.length - 1];
    var mountKey = spec.key;
    var shell = null;

    function build(group) {
      var P = palette();
      var series = [], cols = [xs];
      spec.cols.forEach(function (c, j) {
        series.push({ label: c.label, stroke: P.s[j], width: 2, points: { size: 6, fill: P.s[j], stroke: P.s[j] } });
        cols.push(rows.map(function (r, i) { return i === flagIdx || !(r[c.key] > 0) ? null : r[c.key]; }));
      });
      if (flagIdx > 0) {
        spec.cols.forEach(function (c, j) {
          series.push({
            label: c.label + ' (' + spec.flagWord + ')', stroke: P.s[j], width: 2, dash: dashPattern(),
            points: { show: true, size: 9, width: 2, fill: P.surface, stroke: P.s[j],
              filter: function () { return [flagIdx]; } }
          });
          cols.push(rows.map(function (r, i) {
            return (i === flagIdx || i === flagIdx - 1) && r[c.key] > 0 ? r[c.key] : null;
          }));
        });
      }
      addPlot(group, shell.host, shell.readout, {
        P: P, frame: shell.frame, data: cols, series: series, height: spec.height,
        yScale: { distr: 3, log: 10 }, yAxis: yAxis(P, 'log'),
        readout: function (u) {
          var i = u.cursor.idx;
          if (i == null) return null;
          var r = rows[i];
          if (r.missing) return '<strong>' + esc(r.month) + '</strong> · no row in the source file (gap)';
          var parts = spec.cols.map(function (c) {
            return '<span class="k">' + esc(c.short) + '</span> ' + esc(fmtInt(r[c.key]));
          });
          return '<strong>' + esc(r.month) + '</strong>' + (r[spec.flag] ? ' (' + esc(spec.flagWord) + '*)' : '') +
            ' · ' + parts.join(' · ');
        }
      });
    }

    var group = new Group(mountKey, mount, fullMin, fullMax, build);
    mount.__pendingGroup = group;
    var legend = spec.cols.map(function (c, j) { return { label: c.label, color: SW[j] }; });
    if (flagIdx > 0) legend.push({ label: '* ' + spec.flagLegend, color: SW_FLAG, style: 'dashed' });
    shell = panelShell(mount, spec.title, spec.aria(rows, flagIdx), legend);
    shell.host = el('div', { 'class': 'chart-canvas' });
    shell.frame.appendChild(shell.host);
    build(group);
    observeSize(group, shell.frame);
    group.setRange(fullMin, fullMax);
    mount.appendChild(makeTable(spec.title + ': data table', spec.json,
      [{ label: 'Month', get: function (r) { return r.month; } }].concat(spec.cols.map(function (c) {
        return { label: c.label, get: function (r) { return fmtInt(r[c.key]); } };
      })).concat([{ label: 'Note', get: function (r) {
        return r.missing ? 'no row in the source file' : (r[spec.flag] ? spec.flagWord : '');
      } }]), rows));
  }

  /* ------------------------------------------------------------ daily series */

  function dailyChart(mount, data, spec) {
    var rows = data.rows;
    if (!rows.length) return;
    var xs = rows.map(function (r) { return dayTs(r.date); });
    // Partial days (flagged by the build) are drawn dashed with hollow points, like the monthly charts.
    var flagged = [];
    rows.forEach(function (r, i) { if (r.partial) flagged.push(i); });
    var isFlag = rows.map(function (r) { return !!r.partial; });
    var shell = null;
    function build(group) {
      var P = palette();
      var series = [], cols = [xs];
      spec.cols.forEach(function (c, j) {
        series.push({ label: c.label, stroke: P.s[j], width: 1.5, points: { size: 6, fill: P.s[j], stroke: P.s[j] } });
        cols.push(rows.map(function (r, i) { return isFlag[i] ? null : r[c.key]; }));
      });
      if (flagged.length) {
        spec.cols.forEach(function (c, j) {
          series.push({
            label: c.label + ' (partial day)', stroke: P.s[j], width: 1.5, dash: dashPattern(),
            points: { show: true, size: 8, width: 2, fill: P.surface, stroke: P.s[j],
              filter: function () { return flagged; } }
          });
          cols.push(rows.map(function (r, i) { return isFlag[i] || isFlag[i + 1] ? r[c.key] : null; }));
        });
      }
      addPlot(group, shell.host, shell.readout, {
        P: P, frame: shell.frame, data: cols, series: series, height: spec.height,
        yScale: { range: zeroRange }, yAxis: yAxis(P, 'linear'),
        readout: function (u) {
          var i = u.cursor.idx;
          if (i == null) return null;
          var r = rows[i];
          return '<strong>' + esc(dayLabel(xs[i])) + '</strong>' + (isFlag[i] ? ' (partial day*)' : '') + ' · ' +
            spec.cols.map(function (c) {
              return '<span class="k">' + esc(c.short) + '</span> ' + esc(fmtInt(r[c.key]));
            }).join(' · ');
        }
      });
    }
    var group = new Group(spec.key, mount, xs[0], xs[xs.length - 1], build);
    mount.__pendingGroup = group;
    var legend = null;
    if (spec.cols.length > 1 || flagged.length) {
      legend = spec.cols.map(function (c, j) { return { label: c.label, color: SW[j] }; });
      if (flagged.length) legend.push({ label: '* partial day (dashed line, hollow point)', color: SW_FLAG, style: 'dashed' });
    }
    shell = panelShell(mount, spec.title, spec.aria(rows, flagged), legend);
    shell.host = el('div', { 'class': 'chart-canvas' });
    shell.frame.appendChild(shell.host);
    build(group);
    observeSize(group, shell.frame);
    group.setRange(group.fullMin, group.fullMax);
    var tcols = [{ label: 'Date', get: function (r) { return r.date; } }].concat(spec.cols.map(function (c) {
      return { label: c.label, get: function (r) { return fmtInt(r[c.key]); } };
    }));
    if (flagged.length) tcols.push({ label: 'Note', get: function (r) { return r.partial ? 'partial day' : ''; } });
    mount.appendChild(makeTable(spec.title + ': data table', spec.json, tcols, rows));
  }

  /* ------------------------------------------------------------ releases: quarterly counts + event lanes */

  function releasesChart(mount, data) {
    var events = data.events, quarters = data.quarters, labs = data.labs;
    if (!events.length || !quarters.length) return;
    var latest = dayTs(data.latest_entry);
    var qx = quarters.map(function (q) { return dayTs(q.start); });
    var endX = Math.max(latest, qx[qx.length - 1] + DAY);
    var partial = !!quarters[quarters.length - 1].partial;
    var lastQ = quarters.length - 1;

    var byDate = {};
    events.forEach(function (e) { (byDate[e.date] = byDate[e.date] || []).push(e); });
    var dates = Object.keys(byDate).sort();
    var ex = dates.map(dayTs);
    var nLabs = labs.length;
    var laneOf = {};
    labs.forEach(function (l, i) { laneOf[l] = nLabs - 1 - i; });

    var fullMin = Math.min(qx[0], ex[0]), fullMax = Math.max(endX, ex[ex.length - 1]);
    var shell = null;

    function quarterAt(xv) {
      if (xv < qx[0] || xv > endX) return null;
      for (var i = qx.length - 1; i >= 0; i--) if (xv >= qx[i]) return quarters[i];
      return null;
    }

    function build(group) {
      var P = palette();
      // Quarterly counts as steps. The last point closes the final quarter at the latest entry.
      var x1 = qx.concat([endX]);
      var keys = [['models', 'Models'], ['release_days', 'Release days']];
      var series = [], cols = [x1];
      keys.forEach(function (k, j) {
        series.push({ label: k[1], stroke: P.s[j], width: 2, paths: window.uPlot.paths.stepped({ align: 1 }),
          points: { show: false } });
        // With an incomplete last quarter the solid line ends level at that quarter's start (no drop),
        // and the dashed series below draws only the incomplete quarter itself, as the legend says.
        cols.push(quarters.map(function (q, i) {
          if (partial && i === lastQ) return lastQ > 0 ? quarters[lastQ - 1][k[0]] : null;
          return q[k[0]];
        }).concat([partial ? null : quarters[lastQ][k[0]]]));
      });
      if (partial) {
        keys.forEach(function (k, j) {
          // A hollow point marks the incomplete quarter at any zoom (its segment is a few px wide at full
          // range), as the monthly charts mark a flagged month; two sizes keep equal values apart.
          series.push({ label: k[1] + ' (incomplete quarter)', stroke: P.s[j], width: 2, dash: dashPattern(),
            paths: window.uPlot.paths.stepped({ align: 1 }),
            points: { show: true, size: j === 0 ? 11 : 6, width: 2, fill: P.surface, stroke: P.s[j],
              filter: function () { return [lastQ]; } } });
          cols.push(x1.map(function (x, i) { return i >= lastQ ? quarters[lastQ][k[0]] : null; }));
        });
      }
      // Both charts share one y-axis width so their x positions line up.
      var ctx = document.createElement('canvas').getContext('2d');
      ctx.font = FONT;
      // On narrow screens the lane labels use each lab's last word (the readout keeps full names).
      var narrow = (mount.clientWidth || 600) < 520;
      var laneLabels = labs.map(function (l) { return narrow ? l.split(/\s+/).pop() : l; });
      var labelW = laneLabels.reduce(function (m, l) { return Math.max(m, ctx.measureText(l).width); }, 0);
      var axisW = Math.max(54, Math.ceil(labelW + 16));
      var qAxis = yAxis(P, 'linear');
      qAxis.size = axisW;
      // Fixed y range (all quarters), so a zoomed window inside one quarter still shows its step.
      var qMax = quarters.reduce(function (m, q) { return Math.max(m, q.models, q.release_days); }, 1);
      addPlot(group, shell.hostQ, shell.readout, {
        P: P, frame: shell.frame, data: cols, series: series, height: shell.small ? 190 : 220,
        yScale: { auto: false, range: function () { return zeroRange(null, 0, qMax); } }, yAxis: qAxis,
        // Hover dots follow the quarter under the cursor (as the readout does), not the nearest quarter
        // start; the solid series has no dot in the incomplete quarter, where it only ends its line.
        dataIdx: function (u, si, idx, xVal) {
          if (si === 0 || xVal == null) return idx;
          var xs = u.data[0], i = 0;
          while (i + 1 < xs.length && xs[i + 1] <= xVal) i++;
          return partial && si <= keys.length && i >= lastQ ? null : i;
        },
        readout: function (u) {
          var q = quarterAt(u.posToVal(u.cursor.left, 'x'));
          if (!q) return null;
          return '<strong>' + esc(q.quarter.replace('Q', ' Q')) + '</strong>' + (q.partial ? ' (incomplete*)' : '') +
            ' · <span class="k">models</span> ' + esc(fmtInt(q.models)) +
            ' · <span class="k">release days</span> ' + esc(fmtInt(q.release_days));
        }
      });

      // Event lanes: one row per lab, one marker per release day.
      var lanes = labs.map(function (lab) {
        return dates.map(function (d) {
          return byDate[d].some(function (e) { return e.lab === lab; }) ? laneOf[lab] : null;
        });
      });
      var laneSeries = labs.map(function (lab) {
        return { label: lab, stroke: P.s[0], width: 0, paths: function () { return null; },
          points: { show: true, size: 10, width: 1.5, stroke: P.surface, fill: P.s[0] } };
      });
      addPlot(group, shell.hostE, shell.readout, {
        P: P, frame: shell.frame, data: [ex].concat(lanes), series: laneSeries, height: 60 + nLabs * 21,
        yScale: { auto: false, range: [-0.7, nLabs - 0.3] },
        yAxis: {
          scale: 'y', stroke: P.ink2, font: FONT, size: axisW, gap: 6,
          grid: { stroke: P.grid, width: 1 }, ticks: { show: false },
          splits: function () { return labs.map(function (l, i) { return i; }); },
          values: function (u, s) {
            return s.map(function (v) { var i = nLabs - 1 - v; return laneLabels[i] || ''; });
          }
        },
        readout: function (u) {
          var x = nearest(u, ex, u.cursor.idx, 24);
          if (x == null) return null;
          var d = fmtDay(x);
          var list = (byDate[d] || []).slice().sort(function (a, b) { return a.lab.localeCompare(b.lab); });
          return '<strong>' + esc(list.length) + ' release' + (list.length === 1 ? '' : 's') + ' on ' +
            esc(dayLabel(x)) + '</strong><ul>' + list.map(function (e) {
              return '<li>' + esc(e.model) + ' · ' + esc(e.lab) + ' · ' + esc(e.date) + '</li>';
            }).join('') + '</ul>';
        }
      });
    }

    var group = new Group('releases', mount, fullMin, fullMax, build);
    mount.__pendingGroup = group;
    var legend = [{ label: 'Models per quarter', color: SW[0] }, { label: 'Release days per quarter', color: SW[1] }];
    if (partial) legend.push({ label: '* incomplete quarter (dashed line, hollow point)', color: SW_FLAG, style: 'dashed' });
    legend.push({ label: 'A release day (one marker per lab per day)', color: SW[0], style: 'dot' });
    shell = panelShell(mount, 'Model releases from 11 labs',
      'Two linked charts. Top: step chart of non-minor releases per quarter, ' + quarters[0].quarter + ' to ' +
      quarters[lastQ].quarter + ', by models and by release days. Bottom: one marker per release day, one row per lab, ' +
      fmtInt(events.length) + ' releases. Data tables below.', legend);
    shell.small = (mount.clientWidth || 600) < 480;
    shell.frame.appendChild(el('p', { 'class': 'chart-sub', 'aria-hidden': 'true' }, 'Per quarter'));
    shell.hostQ = el('div', { 'class': 'chart-canvas' });
    shell.frame.appendChild(shell.hostQ);
    shell.frame.appendChild(el('p', { 'class': 'chart-sub', 'aria-hidden': 'true' }, 'Each release, by lab'));
    shell.hostE = el('div', { 'class': 'chart-canvas' });
    shell.frame.appendChild(shell.hostE);
    build(group);
    observeSize(group, shell.frame);
    group.setRange(fullMin, fullMax);
    mount.appendChild(makeTable('Releases per quarter: data table', 'data/releases.json', [
      { label: 'Quarter', get: function (q) { return q.quarter; } },
      { label: 'Models', get: function (q) { return fmtInt(q.models); } },
      { label: 'Release days', get: function (q) { return fmtInt(q.release_days); } },
      { label: 'Note', get: function (q) { return q.partial ? 'incomplete quarter' : ''; } }
    ], quarters));
    mount.appendChild(makeTable('Every non-minor release: data table', 'data/releases.json', [
      { label: 'Date', get: function (e) { return e.date; } },
      { label: 'Lab', get: function (e) { return e.lab; } },
      { label: 'Model', get: function (e) { return e.model; } }
    ], events));
  }

  /* ------------------------------------------------------------ compute records */

  function computeChart(mount, data) {
    var rows = data.rows;
    if (!rows.length) return;
    var xs = rows.map(function (r) { return dayTs(r.date); });
    var shell = null;
    function build(group) {
      var P = palette();
      var series = [
        { label: 'Record-setting model', stroke: P.s[0], width: 0, paths: function () { return null; },
          points: { show: true, size: 9, width: 1.5, stroke: P.surface, fill: P.s[0] } },
        { label: 'Lag-affected record', stroke: P.s[1], width: 0, paths: function () { return null; },
          points: { show: true, size: 10, width: 2.5, stroke: P.s[1], fill: P.surface } }
      ];
      var cols = [xs,
        rows.map(function (r) { return r.lag_affected ? null : r.flop; }),
        rows.map(function (r) { return r.lag_affected ? r.flop : null; })];
      addPlot(group, shell.host, shell.readout, {
        P: P, frame: shell.frame, data: cols, series: series, height: shell.small ? 260 : 320,
        yScale: { distr: 3, log: 10 }, yAxis: yAxis(P, 'exp'),
        readout: function (u) {
          var x = nearest(u, xs, u.cursor.idx, 24);
          if (x == null) return null;
          var list = rows.filter(function (r, i) { return xs[i] === x; });
          return '<ul>' + list.map(function (r) {
            return '<li><strong>' + esc(r.model) + '</strong> · ' + esc(r.organization) + ' · ' + esc(r.date) +
              ' · ' + esc(fmtExp(r.flop)) + ' FLOP · <span class="k">confidence</span> ' +
              esc(r.confidence || 'not given') + (r.lag_affected ? ' · lag-affected (lower bound)' : '') + '</li>';
          }).join('') + '</ul>';
        }
      });
    }
    var group = new Group('compute', mount, xs[0], xs[xs.length - 1], build);
    mount.__pendingGroup = group;
    var nLag = rows.filter(function (r) { return r.lag_affected; }).length;
    shell = panelShell(mount, 'Training compute of record-setting models',
      'Scatter chart, log scale: training compute in FLOP of ' + rows.length + ' record-setting models, ' + rows[0].date +
      ' to ' + rows[rows.length - 1].date + '; ' + nLag + ' lag-affected. Data table below.',
      [{ label: 'Record-setting model', color: SW[0], style: 'dot' },
       { label: 'Lag-affected record (lower bound)', color: SW[1], style: 'ring' }]);
    shell.small = (mount.clientWidth || 600) < 480;
    shell.host = el('div', { 'class': 'chart-canvas' });
    shell.frame.appendChild(shell.host);
    build(group);
    observeSize(group, shell.frame);
    group.setRange(group.fullMin, group.fullMax);
    mount.appendChild(makeTable('Record-setting models: data table', 'data/compute_records.json', [
      { label: 'Date', get: function (r) { return r.date; } },
      { label: 'Model', get: function (r) { return r.model; } },
      { label: 'Organization', get: function (r) { return r.organization; } },
      { label: 'Training compute (FLOP)', get: function (r) { return fmtExp(r.flop); } },
      { label: 'Confidence', get: function (r) { return r.confidence; } },
      { label: 'Epoch frontier flag', get: function (r) { return r.frontier_model ? 'yes' : 'no'; } },
      { label: 'Lag-affected', get: function (r) { return r.lag_affected ? 'yes' : 'no'; } }
    ], rows));
  }

  /* ------------------------------------------------------------ wiring */

  var CVE_COLS = [
    { key: 'total', label: 'All published', short: 'all' },
    { key: 'ex_bulk7', label: 'Excluding 7 bulk assigners', short: 'excl. 7 bulk' },
    { key: 'ex_top10', label: 'Excluding top 10 assigners', short: 'excl. top 10' }
  ];
  var ARXIV_COLS = [
    { key: 'union_primary', label: 'cs.AI or cs.LG, primary', short: 'AI/LG primary' },
    { key: 'union_any', label: 'cs.AI or cs.LG, any listing', short: 'AI/LG any' },
    { key: 'ai_any', label: 'cs.AI, any listing', short: 'cs.AI any' },
    { key: 'cs_all', label: 'All CS (control)', short: 'all CS' }
  ];

  var CHARTS = {
    cve_monthly: { json: 'data/cve_monthly.json', render: function (m, d) {
      monthlyChart(m, d, {
        key: 'cve_monthly', json: 'data/cve_monthly.json', title: 'Security flaws per month (CVE)', cols: CVE_COLS,
        flag: 'estimate', flagWord: 'pace estimate', flagLegend: 'pace estimate (dashed line, hollow point)', height: 300,
        aria: function (rows, fi) {
          return 'Line chart, log scale: CVE records published per month, ' + rows[0].month + ' to ' +
            rows[rows.length - 1].month + ', three series.' + (fi >= 0 ? ' ' + rows[fi].month + ' is a pace estimate.' : '') +
            ' Data table below.';
        }
      });
    } },
    cve_daily: { json: 'data/cve_daily.json', render: function (m, d) {
      dailyChart(m, d, {
        key: 'cve_daily', json: 'data/cve_daily.json', title: 'Security flaws per day (CVE)', height: 240,
        cols: [{ key: 'count', label: 'Published CVE records', short: 'records' }],
        aria: function (rows, flagged) {
          return 'Line chart: CVE records published per day, ' + rows[0].date + ' to ' + rows[rows.length - 1].date +
            '.' + (flagged.length ? ' ' + rows[flagged[0]].date + (flagged.length > 1 ? ' onwards are partial days.' :
            ' is a partial day.') : '') + ' Data table below.';
        }
      });
    } },
    arxiv_monthly: { json: 'data/arxiv_monthly.json', render: function (m, d) {
      monthlyChart(m, d, {
        key: 'arxiv_monthly', json: 'data/arxiv_monthly.json', title: 'AI and computer-science papers per month (arXiv)', cols: ARXIV_COLS,
        flag: 'partial', flagWord: 'partial, raw', flagLegend: 'partial month, raw and unscaled (dashed line, hollow point)',
        height: 300,
        aria: function (rows, fi) {
          return 'Line chart, log scale: arXiv submissions per month, ' + rows[0].month + ' to ' +
            rows[rows.length - 1].month + ', four series.' + (fi >= 0 ? ' ' + rows[fi].month + ' is partial.' : '') +
            ' Data table below.';
        }
      });
    } },
    arxiv_daily: { json: 'data/arxiv_daily.json', render: function (m, d) {
      dailyChart(m, d, {
        key: 'arxiv_daily', json: 'data/arxiv_daily.json', title: 'AI and computer-science papers per day (arXiv)', height: 260,
        cols: ARXIV_COLS,
        aria: function (rows, flagged) {
          return 'Line chart: arXiv submissions per day, ' + rows[0].date + ' to ' + rows[rows.length - 1].date +
            ', four series.' + (flagged.length ? ' ' + rows[flagged[0]].date + ' onwards are incomplete.' : '') +
            ' Data table below.';
        }
      });
    } },
    releases: { json: 'data/releases.json', render: releasesChart },
    compute: { json: 'data/compute_records.json', render: computeChart }
  };

  function showError(mount, msg) {
    mount.hidden = false;
    mount.appendChild(el('p', { 'class': 'pending', role: 'status' }, msg));
  }

  function init() {
    initTheme();
    var mounts = document.querySelectorAll('.chart-mount[data-chart]');
    if (!window.uPlot) {
      Array.prototype.forEach.call(mounts, function (m) { showError(m, 'Charts could not load (uPlot missing).'); });
      return;
    }
    Array.prototype.forEach.call(mounts, function (mount) {
      var def = CHARTS[mount.getAttribute('data-chart')];
      if (!def) return;
      fetch(def.json, { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (data) {
        if (data.status !== 'ok') {
          mount.hidden = true;
          var panel = mount.closest('.panel');
          if (panel && !panel.querySelector('.pending')) {
            mount.parentNode.insertBefore(el('p', { 'class': 'pending', role: 'status' }, data.message || 'Data pending.'), mount);
          }
          return;
        }
        def.render(mount, data);
      }).catch(function (err) {
        showError(mount, 'Chart data could not be loaded (' + (err && err.message ? err.message : 'error') + ').');
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
