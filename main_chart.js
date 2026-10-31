/* Singularity Tracker: the main chart (issue #31, Release 1).
 *
 * Canvases drawn from data/main_chart.json and nothing else (no network beyond that file, no vendor library):
 *   hero      "the singularity chart, tested": log-log, wait until the next event against time before today; after
 *             today, the best-fit curve (quadratic on the log-log axes, #80) goes on dashed to the omega point, with the card's 50% range as a band;
 *   steps     the same waits as stairs, every list at once (Prototype A's chart type), with the same after-today marks;
 *   calendar  the 11-lab release pace on a linear calendar, with the two registered CVE test windows after today and,
 *             when the track record is shown, the omega band (the latest refit's calibrated 50% range) with a ghost trail;
 *   McKenna   McKenna's timewave in its own panel, on its own scale, ending at its own anchor (McKenna's zero date).
 * Every value shown comes from main_chart.json, which site/build.py builds from whitelisted repo files. The numbers
 * typed here are layout only (pixels, colours, durations of zoom animations, tick candidates). Nothing here fits or
 * extrapolates beyond one line. The only fitted dates it names are the display-approved track-record refits (the omega
 * card, its range, the best-fit curve's legend date, the timewave's omega-point end), each read from track_record; no
 * data curve is drawn after the last observed release. The one extrapolation (owner's request, #31) is the best-fit
 * line itself, aimed at the card's date: solid up to today, dashed after it down to that date.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------------------------------------------
  // AUTO-GLIDE (Jose, issue #31): on first load the hero holds the full familiar chart, then glides into the AI era,
  // once per visit. Hold and glide times and the caption text come from main_chart.json (views.auto_glide).
  // Set this to false to switch the glide off: the hero then opens on the full chart.
  const AUTO_GLIDE = true;
  // ---------------------------------------------------------------------------------------------------------------

  const root = document.getElementById('main-chart');
  if (!root || !window.fetch || !window.requestAnimationFrame || !window.Map) return;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  function fail(msg) {
    $$('.mc-box', root).forEach((box) => {
      $$('canvas', box).forEach((c) => { c.hidden = true; });
      const p = document.createElement('p'); p.className = 'pending'; p.setAttribute('role', 'status'); p.textContent = msg;
      box.appendChild(p);
    });
    $$('.mc-controls, .mc-listnote', root).forEach((el) => { el.hidden = true; });
    const od = $('#mc-omega-date'), orr = $('#mc-omega-range');
    if (od) { od.textContent = '\u2014'; if (orr) orr.textContent = msg; }
  }

  fetch('data/main_chart.json', { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(run).catch((e) => {
    fail('The main chart could not be loaded (' + (e && e.message ? e.message : 'error') + ').');
    if (window.console) console.warn('main chart:', e);
  });

  function run(D) {
    const ok = (b) => !!b && b.status === 'ok';
    root.classList.add('mc-ready');   // controls are shown only once the script runs (style.css)

    // ============================================================ shared helpers
    const DAY = 864e5, YRD = 365.2425, YEAR = YRD * DAY;
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace';
    const COL = { kurz: '#a08fff', kurzL: '#cfc6ff', ai: '#38d9f5', mck: '#ff5fd2', ice: '#dfeaff', ink: '#eaf2ff', ink2: '#a9b6cc', ink3: '#8693ab', bg: '#050810', warn: '#ffd27a', omega: '#ffc861' };
    const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const NARROW_MQ = window.matchMedia ? window.matchMedia('(max-width: 700px)') : null;
    const isNarrow = () => !!(NARROW_MQ && NARROW_MQ.matches);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const isoMs = (s) => Date.parse(s + 'T00:00:00Z');
    const TODAY_ISO = D.today;
    const T0 = isoMs(TODAY_ISO);                 // today 00:00 UTC
    const TODAY_MS = T0 + DAY / 2;               // today's mark sits mid-day
    const nf = (n) => Number(n).toLocaleString('en-US');
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmtMs = (t) => { const d = new Date(t); return MON[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear(); };
    const fmtISO = (s) => fmtMs(isoMs(s));
    const fmtMD = (t) => { const d = new Date(t); return MON[d.getUTCMonth()] + ' ' + d.getUTCDate(); };
    const fmtMY = (t) => { const d = new Date(t); return MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
    // a year written with AD or BC (astronomical year 0 is 1 BC), as on McKenna's graphs
    const adbc = (t) => { const y = new Date(t).getUTCFullYear(); return y > 0 ? y + ' AD' : (1 - y).toLocaleString('en-US') + ' BC'; };
    const easeOut = (p) => 1 - Math.pow(1 - p, 3);
    // a caveat the canvas had no room for, as a line of text under its chart (hidden when empty); written only on change
    const capLine = (sel, t) => { const e = document.querySelector(sel); if (e && e.textContent !== t) { e.textContent = t; e.hidden = !t; } };
    const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
    function sig(n, s) { if (n === 0) return 0; const p = Math.pow(10, s - 1 - Math.floor(Math.log10(Math.abs(n)))); return Math.round(n * p) / p; }
    function fmtYears(y) {
      if (y >= 1e9) return sig(y / 1e9, 3) + ' billion years';
      if (y >= 1e6) return sig(y / 1e6, 3) + ' million years';
      if (y >= 1e4) return nf(sig(y, 3)) + ' years';
      if (y >= 2) return nf(Math.round(y)) + ' years';
      return sig(y, 2) + ' years';
    }
    function fmtDays(d) {
      if (d < 1.5) return '1 day';
      if (d < 10) return (Math.round(d * 10) / 10) + ' days';
      if (d < 120) return Math.round(d) + ' days';
      if (d < 730) return (Math.round(d / 30.44 * 10) / 10) + ' months';
      return fmtYears(d / YRD);
    }
    function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
    // no canvas text under 12 px (the site's floor for all text): tw() measures through here too, so label placement sees the
    // same size it draws
    const MIN_TEXT_PX = 12;
    function font(c, size, weight, mono) { c.font = (weight || 500) + ' ' + Math.max(size, MIN_TEXT_PX) + 'px ' + (mono ? MONO : SANS); }
    function tw(c, s, size, weight, mono) { font(c, size, weight, mono); return c.measureText(s).width; }
    function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    function txt(c, s, x, y, o) {
      o = o || {};
      font(c, o.size || 11, o.weight || 500, o.mono);
      c.textAlign = o.align || 'left'; c.textBaseline = 'alphabetic';
      if (o.alpha != null) c.globalAlpha = o.alpha;
      if (o.plate) {
        const w = c.measureText(s).width, h = (o.size || 11) + 7;
        const x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
        c.fillStyle = o.plate; rr(c, x0 - 4, y - h + 4.5, w + 8, h, 3); c.fill();
      }
      if (o.halo) { c.lineWidth = 4; c.strokeStyle = 'rgba(4,7,14,0.92)'; c.lineJoin = 'round'; c.strokeText(s, x, y); }
      if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = o.glowB || 10; }
      c.fillStyle = o.color || COL.ink2; c.fillText(s, x, y);
      c.shadowBlur = 0; c.globalAlpha = 1;
      return c.measureText(s).width;
    }
    function ring(c, x, y, r, color, lw, fillBg) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); if (fillBg) { c.fillStyle = COL.bg; c.fill(); } c.lineWidth = lw; c.strokeStyle = color; c.stroke(); }
    function dot(c, x, y, r, color) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = color; c.fill(); }
    const hitBox = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
    function wrap(c, s, maxW, size, weight, mono) {
      font(c, size, weight, mono); const words = s.split(' '), out = []; let cur = '';
      for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width <= maxW || !cur) cur = t; else { out.push(cur); cur = w; } }
      if (cur) out.push(cur); return out;
    }
    let hatchPat = null, dotPat = null;
    function dots(c) {
      if (dotPat) return dotPat;
      const p = document.createElement('canvas'); p.width = p.height = 6; const g = p.getContext('2d');
      g.fillStyle = 'rgba(201,214,238,0.3)'; g.fillRect(0, 0, 1.4, 1.4);
      dotPat = c.createPattern(p, 'repeat'); return dotPat;
    }
    function hatch(c) {
      if (hatchPat) return hatchPat;
      const p = document.createElement('canvas'); p.width = p.height = 8; const g = p.getContext('2d');
      g.strokeStyle = 'rgba(201,214,238,0.16)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-2, 10); g.lineTo(10, -2); g.moveTo(-2, 2); g.lineTo(2, -2); g.moveTo(6, 10); g.lineTo(10, 6); g.stroke();
      hatchPat = c.createPattern(p, 'repeat'); return hatchPat;
    }
    // src (file and script references) is not shown on hover cards (owner's request, #31): sources are on learn.html
    // and in the data files
    function card(kind, color, title, date, ps, src) {   // eslint-disable-line no-unused-vars
      return '<div class="k">' + (color ? '<i style="background:' + color + '"></i>' : '') + kind + '</div>' +
        '<div class="t">' + esc(title) + '</div>' + (date ? '<div class="d">' + esc(date) + '</div>' : '') +
        ps.filter(Boolean).map((p) => '<p>' + p + '</p>').join('');
    }
    const badge = (s, cls) => '<span class="mc-badge' + (cls ? ' ' + cls : '') + '">' + esc(s) + '</span>';
    const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

    function makeTip(box) {
      const el = $('.mc-tip', box);
      return {
        show(html, px, py, touch) {
          if (!html) { el.hidden = true; return; }
          el.innerHTML = html; el.hidden = false;
          const bw = box.clientWidth, bh = box.clientHeight, w = el.offsetWidth, h = el.offsetHeight;
          let x, y;
          if (touch || isNarrow()) { x = clamp(px - w / 2, 6, bw - w - 6); y = py - h - 16; if (y < 4) y = Math.min(py + 18, bh - h - 4); }
          else { x = px + 16; y = py + 14; if (x + w > bw - 8) x = px - w - 16; if (y + h > bh - 6) y = py - h - 12; if (y < 6) y = 6; x = Math.max(6, x); }
          el.style.left = x + 'px'; el.style.top = y + 'px';
        },
        hide() { el.hidden = true; },
      };
    }
    function makeToast(box) {
      const el = $('.mc-toast', box); let tm = null, last = 0;
      return (msg) => { const now = performance.now(); if (now - last < 600 && el.classList.contains('on')) return; last = now; el.textContent = msg; el.classList.add('on'); clearTimeout(tm); tm = setTimeout(() => el.classList.remove('on'), 1700); };
    }
    function pendingIn(box, msg) {
      $$('canvas', box).forEach((c) => { c.hidden = true; });
      const p = document.createElement('p'); p.className = 'pending'; p.setAttribute('role', 'status'); p.textContent = msg; box.appendChild(p);
    }

    // ============================================================ zoom controller (shared by all three charts)
    // api: plot(), toT(x), toX(t), today() (t or null), span(), view(), place(span, tRef, f, view0), range(ta, tb),
    //      reset(), step(span) = ln zoom per wheel notch, pinchGain, hover, tap, leave, toast, onUser, select, zoomBtn
    function attachZoom(cv, api) {
      let armed = false, wa = null;
      const SNAP = 22;
      cv.addEventListener('focus', () => { armed = true; });
      cv.addEventListener('blur', () => { armed = false; });
      const loc = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      function anchor(x) {
        const P = api.plot(), tt = api.today();
        if (tt != null) {
          const xt = api.toX(tt);
          if (xt >= P.x - 1 && xt <= P.x + P.w + 1 && Math.abs(x - xt) <= SNAP) return { t: tt, f: clamp((xt - P.x) / P.w, 0, 1), snapped: true };
        }
        const xc = clamp(x, P.x, P.x + P.w);
        return { t: api.toT(xc), f: (xc - P.x) / P.w, snapped: false };
      }
      // a pinch anchors at TODAY when TODAY lies between the two fingers, or (touch) within 48 px of their midpoint
      function pinchAnchor(xa, xb, touch) {
        const P = api.plot(), tt = api.today(), mid = (xa + xb) / 2;
        if (tt != null) {
          const xt = api.toX(tt), lo = Math.min(xa, xb) - 6, hi = Math.max(xa, xb) + 6;
          if (xt >= P.x - 1 && xt <= P.x + P.w + 1 && ((xt >= lo && xt <= hi) || Math.abs(mid - xt) <= (touch ? 48 : SNAP))) return { t: tt, f: clamp((xt - P.x) / P.w, 0, 1), snapped: true };
        }
        return anchor(mid);
      }
      // Zoom-in converges on TODAY (issue #31, Jose: "the 7-day zoom must zoom toward today"): while today is inside the view,
      // a zoom-in step (wheel or pinch) keeps today where it is on screen and shrinks the window around it, instead of around
      // the pointer, so the road down to the 7-day view ends at today and not in an empty stretch of the past. api.pull()
      // is the weight 0..1 of that pull. Zoom-out is untouched; so is a view that does not contain today (looking at the
      // past stays pointer-anchored), and so is Alt+wheel (pointer-anchored on request).
      function toward(a, ft, w) { return w > 0 && ft != null ? { t: a.t + (api.today() - a.t) * w, f: a.f + (ft - a.f) * w, snapped: a.snapped } : a; }
      const todayFrac = () => { const tt = api.today(); if (tt == null) return null; const P = api.plot(), xt = api.toX(tt); return xt >= P.x - 1 && xt <= P.x + P.w + 1 ? clamp((xt - P.x) / P.w, 0, 1) : null; };
      cv.addEventListener('wheel', (e) => {
        // no scroll-jacking: the wheel zooms only once the chart has focus, or with Ctrl/Cmd (trackpad pinch)
        if (!armed && !e.ctrlKey && !e.metaKey) { api.toast(isNarrow() ? 'Tap the chart first to zoom with the wheel' : 'Click the chart first to zoom with the wheel (or hold Ctrl)'); return; }
        e.preventDefault();
        const k = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
        const dy = e.deltaY * k, dx = e.deltaX * k;
        const p = loc(e);
        if (Math.abs(dx) > Math.abs(dy) * 1.5 && !e.ctrlKey) { // sideways trackpad swipe: pan
          const P = api.plot(), v0 = api.view(), a = { t: api.toT(P.x + P.w / 2), f: 0.5 };
          api.place(api.span(), a.t, a.f - dx / P.w, v0); api.onUser(); return;
        }
        // one anchor per wheel gesture: keep the time first found under the pointer while nothing else moved the view
        const vNow = JSON.stringify(api.view());
        const a = wa && Math.abs(wa.x - p.x) < 0.5 && wa.view === vNow ? wa.a : anchor(p.x);
        const ln = clamp(dy / 100 * api.step(api.span()), -1.4, 1.4);
        const span1 = api.span() * Math.exp(ln), a1 = ln < 0 && api.pull && !e.altKey ? toward(a, todayFrac(), api.pull(span1)) : a;
        api.place(span1, a1.t, a1.f); api.onUser();
        wa = { x: p.x, a, view: JSON.stringify(api.view()) };
      }, { passive: false });
      const ptrs = new Map(); let g = null;
      cv.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const p = loc(e); ptrs.set(e.pointerId, p);
        try { cv.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer: ignore */ }
        if (document.activeElement !== cv) cv.focus({ preventScroll: true });
        if (ptrs.size === 1) g = { mode: 'pending', x0: p.x, y0: p.y, type: e.pointerType, shift: e.shiftKey, view0: api.view(), a0: anchor(p.x) };
        else if (ptrs.size === 2) {
          const [a, b] = [...ptrs.values()];
          g = { mode: 'pinch', dist0: Math.max(12, Math.hypot(a.x - b.x, a.y - b.y)), mid0: (a.x + b.x) / 2, span0: api.span(), a0: pinchAnchor(a.x, b.x, e.pointerType !== 'mouse'), ft0: todayFrac(), tt0: api.today() };
          api.select(null);
        }
      });
      cv.addEventListener('pointermove', (e) => {
        const p = loc(e);
        if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, p);
        if (!g) { if (e.pointerType === 'mouse') api.hover(p.x, p.y); return; }
        const P = api.plot();
        if (g.mode === 'pending') {
          const moved = Math.hypot(p.x - g.x0, p.y - g.y0);
          // a finger pans the chart only when it moves clearly sideways (owner's report, #31: a thumb scrolling the page
          // slides a few pixels sideways before the browser takes the swipe as a scroll, and that slide panned the chart
          // and cancelled its scroll-triggered zoom); anything more upright is left to the page
          if (g.type === 'mouse' && moved > 5) g.mode = g.shift ? 'pan' : 'select';
          else if (g.type !== 'mouse' && Math.abs(p.x - g.x0) > 10 && Math.abs(p.x - g.x0) > 1.5 * Math.abs(p.y - g.y0)) g.mode = 'pan';
          if (g.mode !== 'pending') api.leave();
        }
        if (g.mode === 'select') api.select({ x0: clamp(g.x0, P.x, P.x + P.w), x1: clamp(p.x, P.x, P.x + P.w) });
        else if (g.mode === 'pan') { api.place(api.spanOf(g.view0), g.a0.snapped ? g.a0.t : api.toTIn(g.view0, g.x0), (p.x - P.x) / P.w, g.view0); api.onUser(); }
        else if (g.mode === 'pinch' && ptrs.size >= 2) {
          const [a, b] = [...ptrs.values()];
          const dist = Math.max(12, Math.hypot(a.x - b.x, a.y - b.y)), mid = (a.x + b.x) / 2;
          const f = g.a0.snapped ? g.a0.f : clamp(g.a0.f + (mid - g.mid0) / P.w, 0, 1);
          const span1 = g.span0 * Math.pow(g.dist0 / dist, api.pinchGain), w = dist > g.dist0 && api.pull && g.ft0 != null ? api.pull(span1) : 0;
          // toward today: blend the held time and its screen fraction with today's (both fixed at the start of the pinch)
          api.place(span1, w > 0 ? g.a0.t + (g.tt0 - g.a0.t) * w : g.a0.t, w > 0 ? f + (g.ft0 - f) * w : f); api.onUser();
        }
      });
      function end(e) {
        const p = loc(e); ptrs.delete(e.pointerId);
        if (!g) return;
        if (g.mode === 'select') {
          const s = api.select(null);
          if (s && Math.abs(s.x1 - s.x0) > 8) { api.range(api.toT(Math.min(s.x0, s.x1)), api.toT(Math.max(s.x0, s.x1))); api.onUser(); }
        } else if (g.mode === 'pending' && e.type === 'pointerup' && Math.hypot(p.x - g.x0, p.y - g.y0) < 12) {   // a tap, not an upright drag
          const now = performance.now();
          if (g.type !== 'mouse' && api._lastTap && now - api._lastTap < 320) { api.reset(); api._lastTap = 0; }
          else { api._lastTap = now; api.tap(p.x, p.y, g.type !== 'mouse'); }
        }
        if (ptrs.size === 0) g = null;
        else if (ptrs.size === 1 && g.mode === 'pinch') { const q = [...ptrs.values()][0]; g = { mode: 'pan', x0: q.x, y0: q.y, type: 'touch', view0: api.view(), a0: anchor(q.x) }; }
      }
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); if (!ptrs.size) { g = null; api.select(null); } });
      cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !g) api.leave(); });
      cv.addEventListener('dblclick', (e) => { e.preventDefault(); api.reset(); });
      cv.addEventListener('keydown', (e) => {
        const P = api.plot();
        if (e.key === '+' || e.key === '=') { api.zoomBtn(-1); e.preventDefault(); }
        else if (e.key === '-' || e.key === '_') { api.zoomBtn(1); e.preventDefault(); }
        else if (e.key === '0') { api.reset(); e.preventDefault(); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          const v0 = api.view(), dir = e.key === 'ArrowLeft' ? 1 : -1;
          api.place(api.span(), api.toT(P.x + P.w / 2), 0.5 + dir * 0.15, v0); api.onUser(); e.preventDefault();
        } else if (e.key === 'Escape') { api.leave(); }
      });
    }

    let DPR = Math.min(2, window.devicePixelRatio || 1);
    const charts = [];
    const listHooks = [];   // called with the list key whenever the hero's list switch changes (the omega card, the calendar)

    // ============================================================ data shared by the hero and the calendar
    const REL = ok(D.releases) ? D.releases.rows : [];
    const relMs = REL.map((r) => isoMs(r.date) + DAY / 2);
    const LAG_MS = ok(D.releases) ? isoMs(D.releases.lag_zone_from) : Infinity;
    const LAST_REL_MS = ok(D.releases) ? isoMs(D.releases.last_release) : null;
    const OPEN = ok(D.releases) ? D.releases.open_gap : null;
    const shortLab = (l) => l.replace(/^Alibaba /, '').replace(/ DeepMind$/, '');
    const RT = ok(D.registered_tests) ? D.registered_tests : null;
    const TESTS = RT ? ['test1', 'test2'].map((k, i) => {
      const o = RT[k], t0 = isoMs(o.window_first_day), t1 = isoMs(o.window_last_day) + DAY;
      const d0 = new Date(t0), d1 = new Date(t1 - DAY);
      const when = o.window_month ? MONL[d0.getUTCMonth()] : (d0.getUTCMonth() === d1.getUTCMonth() ? fmtMD(t0) + '–' + d1.getUTCDate() : fmtMD(t0) + ' – ' + fmtMD(t1 - DAY));
      return { id: i + 1, key: k, t0, t1, o, when, text: o.caption + ' ' + o.caption_otherwise };
    }) : [];
    const VIEWS = D.views || {};
    const GLIDE = VIEWS.auto_glide || null;
    const AI_FIRST = VIEWS.ai_era_first_day || (ok(D.lists) ? D.lists.v1.rows[0].date : TODAY_ISO);

    function testCard(T) {
      const o = T.o, R = RT;
      const ps = [esc(o.caption), esc(o.caption_otherwise)];
      if (o.always_refuted) ps.push(esc(o.always_refuted));
      ps.push(badge('two-sided') + ' ' + esc(R.two_sided));
      ps.push(esc(R.what_cve_is) + ' Observed: ' + (o.observed == null ? 'not yet' : nf(o.observed)) + '. ' + esc(R.scoring_plain));
      ps.push('<span style="color:#8693ab">Question as registered: ' + esc(o.question) + '.</span>');
      return card('Registered test ' + T.id + ' · CVE count ' + badge(o.observed == null ? 'not yet observed' : 'observed'), COL.ice, 'Test ' + T.id + ' · ' + T.when, o.window_month ? MONL[new Date(T.t0).getUTCMonth()] + ' ' + new Date(T.t0).getUTCFullYear() : fmtISO(o.window_first_day) + ' – ' + fmtISO(o.window_last_day), ps,
        R.source + ' (approved in ' + R.approval + ')');
    }

    const TRK = D.track_record && D.track_record.status === 'ok' && Array.isArray(D.track_record.rows) && D.track_record.rows.length ? D.track_record : null;
    // ============================================================ OMEGA POINT: the card and the helper the calendar view shares
    // For one hand-picked list: its calendar refits (oldest first), the LATEST one (the live refit: its named date and
    // claimed 95% range), r from the recession summary for that list's calendar refits (null when NA), and the share of
    // the displayed calendar refits whose named date is before today. Nothing is typed here: every value is read from
    // track_record, which the build copies only from display-approved registry rows (the owner's waiver, #33).
    // The omega date (`date`, `tm`): the latest calendar refit's own named date. Since the owner's decision on #80 the
    // refits are the quadratic fit (scripts/predictions/quadfit.py: the log of the wait is a quadratic in the log of the
    // time left; the date is where it fits best, the least squared error), so the date moves at every weekly refit. The
    // 50% band is symmetric about it in log remaining time. Every chart shows this one date.
    const OMEGA = (function () {
      const by = {};
      if (TRK) TRK.rows.forEach((r) => { if (r.method === 'calendar') (by[r.list] = by[r.list] || []).push(r); });
      Object.keys(by).forEach((k) => by[k].sort((a, b) => (a.refit_date < b.refit_date ? -1 : a.refit_date > b.refit_date ? 1 : 0)));
      const mid = (iso) => isoMs(iso) + DAY / 2;
      // the card's range (owner's decision, #31): the calibrated 50% band from the rolling backtest's held-out
      // errors (results/predictions/calibrated_range.json, via card_range): the list's last release on or before the refit
      // day plus the time the fit said remained, times card_range.bands['50'].lower_mult / upper_mult. Null (no range is
      // shown and no band is drawn: there is no fallback to the fit's own claimed 95% range) when card_range is missing,
      // the fit is pinned, or the list has no rows.
      const CAL = ok(D.card_range) ? D.card_range : null;
      function calBand(list, last) {
        const L = D.lists && D.lists[list], b = CAL && CAL.bands && CAL.bands['50'], b8 = CAL && CAL.bands && CAL.bands['80'];
        if (!b || !L || !L.rows || last.pinned !== 'none') return null;
        let tl = null;
        L.rows.forEach((r) => { if (r.frozen === true && r.date <= last.refit_date && (tl == null || r.date > tl)) tl = r.date; });   // frozen rows only: a post-freeze row is display-only
        if (!tl) return null;
        const t0 = mid(tl), R = mid(last.point) - t0;
        if (!(R > 0)) return null;
        const at = (m) => t0 + Math.round(R * m / DAY) * DAY;
        return { lo: at(b.lower_mult), hi: at(b.upper_mult), lo80: b8 ? at(b8.lower_mult) : null, hi80: b8 ? at(b8.upper_mult) : null, tl };
      }
      function of(list) {
        const rows = by[list]; if (!rows || !rows.length) return null;
        const last = rows[rows.length - 1];
        const sm = (TRK.summaries || []).find((s) => s.list === list && s.method === 'calendar');
        const passed = rows.filter((r) => r.point < TODAY_ISO).length, cal = calBand(list, last);
        return {
          list, rows, last, passed, share: passed / rows.length, pinned: last.pinned,
          tp: mid(last.point), tr: mid(last.refit_date), cal,
          tm: mid(last.point), date: last.point,   // the omega date (see above)
          tlo: cal ? Math.max(cal.lo, TODAY_MS) : null,   // a calibrated band never starts before today ('now'); no band without one
          thi: cal ? cal.hi : null,
          r: sm && typeof sm.r === 'number' && isFinite(sm.r) ? sm.r : null,
          trail: rows.map((r) => ({ r, tr: mid(r.refit_date), tp: mid(r.point), tm: mid(r.point), date: r.point, passed: r.point < TODAY_ISO, up: r.pinned === 'upper', low: r.pinned === 'lower' })),
        };
      }
      // the latest right edge any list's band reaches (an unbounded range counts the time the fit said remained again)
      function end() {
        let m = 0;
        Object.keys(by).forEach((k) => { const o = of(k); if (!o || o.pinned === 'upper') return; m = Math.max(m, o.cal ? o.thi : o.tp); });
        return m || null;
      }
      return { of, end, lists: () => Object.keys(by) };
    })();
    // ============================================================ the log time axis (the hero and the steps chart)
    // x = log of time from today in days, near-linear within tau of today (tau grows as the view zooms in). FULL = {d0, d1},
    // the widest view, in days from today. FUT > 0 is room after today (owner's request, #31): it opens only as the view
    // zooms in (none at 5,000 years and wider, all of it at 50 years and closer), so the full view still ends at today.
    const slog = (d) => Math.sign(d) * Math.log10(1 + Math.abs(d));
    const slogInv = (s) => Math.sign(s) * (Math.pow(10, Math.abs(s)) - 1);
    function timeAxis(FULL, MIN_SPAN, FUT) {
      const FULL_SPAN = FULL.d1 - FULL.d0;
      const LW0 = Math.log10(50 * YRD), LW1 = Math.log10(5000 * YRD), SHARE = 0.12;
      const open = (span) => { if (!(FUT > 0)) return 0; const t = clamp((LW1 - Math.log10(span)) / (LW1 - LW0), 0, 1); return t * t * (3 - 2 * t); };
      const edge = (span) => Math.max(FULL.d1, FUT * open(span));                      // the farthest right edge at this span
      const home = (span) => Math.max(FULL.d1, Math.min(FUT, SHARE * span) * open(span));   // where a view zoomed on today ends
      const L1 = Math.log10(3 * YRD), L2 = Math.log10(FULL_SPAN), LT1 = L1 + 1, LT2 = Math.log10(7);
      function tauFor(span) { const L = Math.log10(span); if (L <= L1) return 10 * span; const f = Math.min(1, (L - L1) / (L2 - L1)); return Math.pow(10, LT1 + (LT2 - LT1) * f); }
      const U = (d, tau) => Math.sign(d) * Math.log10(1 + Math.abs(d) / tau);
      const Uinv = (u, tau) => Math.sign(u) * (Math.pow(10, Math.abs(u)) - 1) * tau;
      const fracIn = (d, d0, d1, tau) => { const u0 = U(d0, tau); return (U(d, tau) - u0) / (U(d1, tau) - u0); };
      function solveD0(span, dRef, f, tau) { let lo = dRef - span, hi = dRef; for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (fracIn(dRef, m, m + span, tau) > f) lo = m; else hi = m; } return (lo + hi) / 2; }
      function clampView(v) {
        const span = clamp(v.d1 - v.d0, MIN_SPAN, FULL_SPAN);
        if (span >= FULL_SPAN * 0.999) return { d0: FULL.d0, d1: FULL.d1, tau: tauFor(FULL_SPAN) };
        let d0 = v.d0, d1 = v.d0 + span;
        if (d0 < FULL.d0) { d0 = FULL.d0; d1 = d0 + span; }
        const e = edge(span);
        if (d1 > e) { d1 = e; d0 = d1 - span; }
        return { d0, d1, tau: v.tau || tauFor(span) };
      }
      // Zoom about a point, in the axis' own coordinate: keep dRef at fraction f of the plot width. Anchored on TODAY,
      // today stays where it is, or moves left to make the room after today that this span opens. If a window would run
      // past the right edge, pin the edge and (for an anchor before today) solve tau instead.
      function zoomView(span, dRef, f) {
        span = clamp(span, MIN_SPAN, FULL_SPAN); f = clamp(f, 0, 1);
        if (span >= FULL_SPAN * 0.999) return clampView({ d0: FULL.d0, d1: FULL.d1 });
        let tau = tauFor(span);
        if (Math.abs(dRef) < 1e-9) { const h = home(span); f = Math.min(f, fracIn(0, h - span, h, tau)); }
        let d0 = solveD0(span, dRef, f, tau);
        const e = edge(span);
        if (d0 + span > e) {
          d0 = e - span;
          if (dRef <= 0 && e - dRef < span) {   // after today the fraction is not monotone in tau: keep tau, let the anchor slip
            const fr = (lt) => fracIn(dRef, d0, e, Math.exp(lt));
            let lo = Math.log(1e-9), hi = Math.log(tau); const up = fr(hi) > fr(lo);   // the direction depends on the side of today dRef is on
            for (let i = 0; i < 90; i++) { const m = (lo + hi) / 2; if ((fr(m) > f) === up) hi = m; else lo = m; }
            tau = Math.exp((lo + hi) / 2);
          }
        }
        return clampView({ d0, d1: d0 + span, tau });
      }
      function panView(v0, dRef, f) { const span = v0.d1 - v0.d0, d0 = solveD0(span, dRef, clamp(f, 0, 1), v0.tau); return clampView({ d0, d1: d0 + span, tau: v0.tau }); }
      function scale(v, P) {
        const tau = v.tau || tauFor(v.d1 - v.d0), u0 = U(v.d0, tau), u1 = U(v.d1, tau), k = P.w / (u1 - u0);
        return { v, P, tau, u0, u1, k, x: (d) => P.x + (U(d, tau) - u0) * k, inv: (x) => Uinv(u0 + (x - P.x) / k, tau), inView: (d) => d >= v.d0 - 1e-9 && d <= v.d1 + 1e-9 };
      }
      return { FULL_SPAN, tauFor, U, Uinv, fracIn, solveD0, clampView, zoomView, panView, scale };
    }
    // the wait axis (log days) and the time axis' ticks, shared by the hero and the steps chart
    const dateOfD = (d) => T0 + Math.round(d) * DAY;
    function waitTicks(yv, P, N) {
      const C = [[1, '1 day', '1 d', 1], [2, '2 days', '2 d', 4], [3, '3 days', '3 d', 5], [7, '1 week', '1 wk', 2], [14, '2 weeks', '2 wk', 4],
        [30.44, '1 month', '1 mo', 1], [91.31, '3 months', '3 mo', 3], [182.6, '6 months', '6 mo', 3], [YRD, '1 year', '1 yr', 1], [2 * YRD, '2 years', '2 yr', 4],
        [5 * YRD, '5 years', '5 yr', 4], [10 * YRD, '10 years', '10 yr', 2], [100 * YRD, '100 years', '100 yr', 2], [1e3 * YRD, '1,000 yrs', '1k yr', 1],
        [1e4 * YRD, '10,000 yrs', '10k yr', 2], [1e5 * YRD, '100,000 yrs', '100k yr', 2], [1e6 * YRD, '1 mn yrs', '1M yr', 1],
        [1e7 * YRD, '10 mn yrs', '10M yr', 2], [1e8 * YRD, '100 mn yrs', '100M yr', 2], [1e9 * YRD, '1 bn yrs', '1B yr', 1]];
      const out = [], yOf = (g) => P.y + P.h - (Math.log10(g) - yv.lo) / (yv.hi - yv.lo) * P.h;
      C.slice().sort((a, b) => a[3] - b[3]).forEach(([g, l, s]) => {
        const y = yOf(g); if (y < P.y + 6 || y > P.y + P.h - 4) return;
        if (out.some((o) => Math.abs(o.y - y) < (N ? 17 : 20))) return;
        out.push({ g, y, label: N ? s : l });
      });
      return out;
    }
    function timeTicks(Sx, c, xT, W, N) {
      const v = Sx.v, cands = [];
      if (-v.d0 / YRD > 250) {
        const Lb = N ? { 9: '1B yrs ago', 8: '100M', 7: '10M', 6: '1M yrs', 5: '100k', 4: '10k', 3: '1,000 yrs', 2: '100 yrs', 1: '10 yrs', 0: '1 yr ago' }
          : { 9: '1 billion years ago', 8: '100 million', 7: '10 million', 6: '1 million years ago', 5: '100,000', 4: '10,000', 3: '1,000 years ago', 2: '100 years ago', 1: '10 years ago', 0: '1 year ago' };
        for (let k = 9; k >= 0; k--) cands.push({ d: -Math.pow(10, k) * YRD, label: Lb[k], pri: k % 3 === 0 ? 1 : 2 });
        cands.push({ d: -30.44, label: N ? '1 mo' : '1 month ago', pri: 3 });
        cands.push({ d: -7, label: N ? '1 wk' : '1 week ago', pri: 3.5 });
        if (v.d1 > 30) cands.push({ d: 30.44, label: N ? '+1 mo' : '1 month ahead', pri: 3.2 });
        if (v.d1 > 183) cands.push({ d: 182.6, label: N ? '+6 mo' : '6 months ahead', pri: 3.4 });
      } else {
        const t0 = new Date(dateOfD(v.d0)), t1 = new Date(dateOfD(v.d1)), y0 = t0.getUTCFullYear(), y1 = t1.getUTCFullYear(), spanD = v.d1 - v.d0;
        for (let y = y0; y <= y1 + 1; y++) {
          const d = (Date.UTC(y, 0, 1) - T0) / DAY;
          cands.push({ d, label: String(y), pri: y % 100 === 0 ? 1 : y % 50 === 0 ? 1.4 : y % 10 === 0 ? 2 : y % 5 === 0 ? 2.5 : 3, year: true });
        }
        if (spanD < 8 * YRD) for (let y = y0; y <= y1; y++) for (let m = 1; m < 12; m++) cands.push({ d: (Date.UTC(y, m, 1) - T0) / DAY, label: MON[m], pri: m === 6 ? 3.5 : m % 3 === 0 ? 4 : 4.5, month: true, y });
        if (spanD < 120) for (let d = Math.ceil(v.d0); d <= Math.floor(v.d1); d++) {
          const t = new Date(dateOfD(d)), dd = t.getUTCDate(); if (dd === 1 || d === 0) continue;
          cands.push({ d, label: (spanD <= 10 ? WD[t.getUTCDay()] + ' ' : '') + MON[t.getUTCMonth()] + ' ' + dd, pri: spanD <= 10 ? 5 : dd === 15 ? 5 : t.getUTCDay() === 1 ? 5.5 : 6 });
        }
      }
      cands.sort((a, b) => a.pri - b.pri);
      const placed = []; font(c, N ? 10 : 11, 550, true);
      const keepOut = xT != null ? { a: xT - (N ? 12 : 14), b: xT + 40 } : null;   // the TODAY line meets the axis here
      for (const t of cands) {
        if (t.d < v.d0 || t.d > v.d1) continue;
        const x = Sx.x(t.d), w = c.measureText(t.label).width;
        const a = x - w / 2, b = x + w / 2;
        if (a < 2 || b > W - 2) continue;
        if (keepOut && a < keepOut.b && b > keepOut.a) continue;
        if (placed.some((p) => a < p.b + 20 && b > p.a - 20)) continue;   // wide gaps: neighbouring labels never read as one
        placed.push({ ...t, x, a, b });
      }
      if (!placed.some((p) => p.year) && placed.some((p) => p.month)) { const m = placed.filter((p) => p.month).sort((a, b) => a.x - b.x)[0]; m.label += ' ' + m.y; }
      return placed;
    }

    // ============================================================ HERO: the singularity chart, tested
    const B = (function () {
      const box = $('#mc-box-hero'), cv = $('#mc-cv-hero'), cvd = $('#mc-cv-hero-dyn');
      if (!box || !cv) return null;
      if (!ok(D.kurzweil) || !ok(D.lists)) { pendingIn(box, 'Main chart data pending: ' + ((!ok(D.kurzweil) ? D.kurzweil : D.lists) || {}).message); return null; }
      const ctx = cv.getContext('2d'), dctx = cvd.getContext('2d');
      const tip = makeTip(box), toast = makeToast(box);
      const dOf = (iso) => (isoMs(iso) - T0) / DAY;           // days relative to today (negative = past)
      const KZ = D.kurzweil.rows.map((r) => ({ kind: 'kurz', d: -r.years_before_today * YRD, g: r.time_to_next_event_years * YRD, est: !!r.estimate, row: r }));
      const KZ_MAX_D = Math.max.apply(null, KZ.map((p) => p.d));          // the most recent milestone
      const KZ_KEY = KZ.filter((p) => p.row.key).length;
      const KZ_YEAR = (String(D.kurzweil.attribution).match(/\b(\d{4})\b/) || [])[1] || 'his book';
      const PLACEMENT = (String(D.kurzweil.placement).match(/: (the repo.*)$/) || [])[1] || D.kurzweil.placement;
      function picks(key) {
        const L = D.lists[key]; const pts = []; let open = null;
        L.rows.forEach((r, i) => {
          const o = { kind: 'ai', d: dOf(r.date), date: r.date, rows: [r], est: !!r.estimate, g: r.gap_to_next_days };
          if (r.gap_to_next_days != null) { if (o.g > 0) pts.push(o); }
          else if (i === L.rows.length - 1 && L.open_days_at_today > 0) { o.kind = 'open'; o.g = L.open_days_at_today; o.lower = !!L.open_gap_is_lower_bound; open = o; }
        });
        return { pts, open };
      }
      function ruleList() {
        const by = new Map();
        REL.forEach((r, i) => { if (!by.has(r.date)) by.set(r.date, []); by.get(r.date).push(i); });
        const pts = []; let open = null;
        for (const [date, idx] of by) {
          const g = REL[idx[0]].gap_any_lab_next_days;
          const o = { kind: 'rule', d: dOf(date), date, idx, g, est: false };
          if (g == null) { if (OPEN && OPEN.days_at_today > 0) { o.kind = 'open'; o.g = OPEN.days_at_today; o.lower = !!OPEN.is_lower_bound; open = o; } continue; }
          o.upper = isoMs(date) + g * DAY > LAG_MS;   // the gap runs into the Epoch-lag zone: an upper bound
          o.est = o.upper; pts.push(o);
        }
        return { pts, open };
      }
      const LISTS = {};
      (D.lists.order || ['v1', 'v3', 'rule']).forEach((k) => {
        if (k === 'rule') { if (ok(D.releases)) LISTS.rule = { key: 'rule', label: D.releases.label, data: ruleList(), ho: null, hand: false, n: D.releases.n_rows }; }
        else if (D.lists[k]) LISTS[k] = { key: k, label: D.lists[k].label, data: picks(k), ho: ok(D.heldout) ? D.heldout[k] : null, hand: true, n: D.lists[k].rows.length };
      });
      Object.keys(LISTS).forEach((k) => { LISTS[k].short = lowerFirst(LISTS[k].label); });

      // ---- x transform: log of time before today, near-linear within tau of today (tau grows as you zoom in)
      // after today (owner's request, #31): room for the best-fit curve's dashed continuation to the omega point and the
      // card's 50% range, out to the latest band end any list reaches (OMEGA.end(), read from track_record) plus a margin;
      // none without a track record. It opens as the view zooms in (timeAxis): the full view still ends at today.
      const OM_END = OMEGA.end(), FUT = OM_END && OM_END > TODAY_MS ? Math.ceil((OM_END - TODAY_MS) / DAY * 1.1 + 6) : 0;
      const FULL = { d0: Math.min.apply(null, KZ.map((p) => p.d)) * 1.5, d1: 0 }, FULL_SPAN = FULL.d1 - FULL.d0, MIN_SPAN = 7;
      const AX = timeAxis(FULL, MIN_SPAN, FUT), { tauFor, fracIn, clampView, zoomView, panView } = AX;
      const dAI = dOf(AI_FIRST);
      const PRESETS = { all: { d0: FULL.d0, d1: 0 }, ai: { d0: dAI * 1.1, d1: FUT }, y2: { d0: -2 * YRD, d1: FUT }, d7: { d0: -7, d1: 0 } };
      const isAiOnly = (v) => v.d0 > KZ_MAX_D;   // every Kurzweil milestone lies off the left edge
      const hasToday = (v) => v.d0 <= 1e-9 && v.d1 >= -1e-9;

      const st = { list: LISTS[D.lists.default] ? D.lists.default : LISTS.v1 ? 'v1' : Object.keys(LISTS)[0], view: clampView(PRESETS.all), yv: null, anim: null, hover: null, sel: null, dirty: true, fade0: -1e9, cap0: null, capInstant: false, preset: 'all' };
      let W = 0, H = 0, N = false, P = null, S = null, HT = null;
      const HN = { w: -1, h: 430 };
      // best-fit curve (owner's request, #31; quadratic since #80): least squares of ln(wait) on u = ln(time left to the
      // omega card's date) and u^2, as the registered fit (quadfit.fitq: c <= 0, else the straight line), for the
      // list on show (Kurzweil's rows and the picks; the open gap is a lower bound and left out). One date everywhere:
      // the line aims at the card's date. None for the rule-defined list or a fit pinned to its grid edge.
      let FIT = null;
      // least squares of ys on 1, x (and x^2 when deg is 2), x centred for conditioning; [a, b, c] in uncentred x (c = 0
      // for deg 1), or null when the normal equations are singular
      function lsq(xs, ys, deg) {
        const n = xs.length, k = deg + 1, m = xs.reduce((q, v) => q + v, 0) / n;
        const A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
        for (let i = 0; i < n; i++) {
          const x = xs[i] - m, pw = [1, x, x * x];
          for (let r = 0; r < k; r++) { for (let q = 0; q < k; q++) A[r][q] += pw[r] * pw[q]; A[r][k] += pw[r] * ys[i]; }
        }
        for (let q = 0; q < k; q++) {   // Gauss-Jordan with partial pivoting
          let pv = q; for (let r = q + 1; r < k; r++) if (Math.abs(A[r][q]) > Math.abs(A[pv][q])) pv = r;
          if (Math.abs(A[pv][q]) < 1e-12) return null;
          [A[q], A[pv]] = [A[pv], A[q]];
          for (let r = 0; r < k; r++) if (r !== q) { const f = A[r][q] / A[q][q]; for (let w = q; w <= k; w++) A[r][w] -= f * A[q][w]; }
        }
        const v = A.map((row, r) => row[k] / row[r]), b = v[1], c = deg === 2 ? v[2] : 0;
        return [v[0] - b * m + c * m * m, b - 2 * c * m, c];
      }
      function fitFor(list) {
        let o;
        try { o = OMEGA.of(list); } catch (e) { return undefined; }   // unreadable: try again on the next frame
        if (!o || o.pinned === 'upper' || !LISTS[list]) return { list, none: true };
        const tsD = dOf(o.date);
        // the fit reads the frozen rows only: a row with an `added` date is display-only (data/curated/README.md), so its
        // point is drawn but the line, like the registered fits, is fitted to the waits between the frozen rows
        const ds = [...new Set(D.lists[list].rows.filter((r) => r.frozen !== false).map((r) => r.date))].sort();
        const fpts = ds.slice(0, -1).map((day, i) => ({ d: dOf(day), g: dOf(ds[i + 1]) - dOf(day) }));
        const xs = [], ys = [];
        for (const p of KZ.concat(fpts)) {
          const u = tsD - p.d; if (!(u > 0) || !(p.g > 0)) continue;
          xs.push(Math.log(u)); ys.push(Math.log(p.g));
        }
        const n = xs.length;
        if (n < 5) return { list, none: true };
        // the curve bends down to zero wait at the date (c <= 0); a curve that would turn back up is the straight line
        const q2 = lsq(xs, ys, 2), cf = q2 && q2[2] <= 0 ? q2 : lsq(xs, ys, 1);
        if (!cf) return { list, none: true };
        const [a, b, c] = cf;
        return { list, tsD, a, b, c, n, point: o.date, g: (d) => { const u = Math.log(tsD - d); return Math.exp(a + b * u + c * u * u); } };
      }
      // the card's omega point and 50% range for the list on show, in this chart's days (null for the rule-defined list
      // and for a fit pinned to its grid edge; no band without card_range)
      function omegaNow() {
        const L = Lcur(); if (!L || !L.hand) return null;
        const o = OMEGA.of(st.list); if (!o || o.pinned === 'upper') return null;
        return { o, band: o.cal ? { d0: (o.tlo - T0) / DAY, d1: (o.thi - T0) / DAY } : null };
      }
      const stat = document.createElement('canvas'), sctx = stat.getContext('2d');

      function measure() {
        N = isNarrow(); W = box.clientWidth;
        // tall enough to read, short enough that the whole chart (with its time axis) fits on the first screen where it can
        const top = box.getBoundingClientRect().top + (window.scrollY || 0);
        // phones: as tall as fits under the controls (330..430), fixed for a given width so the browser bar sliding away never moves the page
        if (N && HN.w !== W) { HN.w = W; HN.h = clamp(Math.round(window.innerHeight - 360), 330, 430); }
        H = N ? HN.h : clamp(Math.round(window.innerHeight - top - 28), 400, 590);
        if (heroFsOn()) { let other = 0; [...$('#mc-hero').children].forEach((e) => { if (e !== box) other += e.offsetHeight; }); H = Math.max(H, Math.round(window.innerHeight - other - 40)); }
        const padL = N ? 54 : 92, padR = N ? 32 : 36, padT = N ? 30 : 34, axisH = N ? 42 : 46;   // room after TODAY for a pinch around it
        P = { x: padL, y: padT, w: W - padL - padR, h: H - padT - axisH };
        for (const c of [cv, cvd, stat]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
        cv.style.height = H + 'px'; cvd.style.height = H + 'px'; cvd.style.width = W + 'px';
        S = null; st.dirty = true;
      }
      const makeScale = (v) => AX.scale(v, P), yTicks = (yv) => waitTicks(yv, P, N), xTicks = (Sx, c, xT) => timeTicks(Sx, c, xT, W, N);
      const SCnow = () => { if (!S || S.v !== st.view || S.P !== P) S = makeScale(st.view); return S; };
      const Lcur = () => LISTS[st.list];
      function openSeg(Sx) { // the dotted open gap: from the last model to today
        const O = Lcur().data.open; if (!O) return null;
        const v = st.view; if (v.d1 < O.d || v.d0 > 0) return null;
        return { O, xa: Sx.x(Math.max(O.d, v.d0)), xb: Sx.x(Math.min(0, v.d1)), ringIn: Sx.inView(O.d) };
      }
      function yTarget(Sx) {
        let lo = Infinity, hi = -Infinity;
        const add = (g) => { const l = Math.log10(g); if (l < lo) lo = l; if (l > hi) hi = l; };
        for (const p of KZ) if (Sx.inView(p.d)) add(p.g);
        for (const p of Lcur().data.pts) if (Sx.inView(p.d)) add(p.g);
        const os = openSeg(Sx); if (os) { add(os.O.g); add(os.O.g * (os.O.lower ? 2.2 : 1.4)); }
        // after today, the dashed line enters the view from its left edge: keep its value there on the axis
        if (FIT && !FIT.none && FIT.list === st.list && Sx.v.d1 > 0) { const da = Math.max(Sx.v.d0, 0); if (da < FIT.tsD) add(Math.max(0.4, FIT.g(da))); }
        // no point in view (the strip moved the window between Kurzweil's milestones and the AI era): follow the best-fit
        // curve across the window, so the chart never goes blank while the curve runs through it
        if (!isFinite(lo) && FIT && !FIT.none && FIT.list === st.list) {
          const b = Math.min(Sx.v.d1, FIT.tsD - 1);
          for (let i = 0; i <= 8 && b > Sx.v.d0; i++) { const g = FIT.g(Sx.v.d0 + (b - Sx.v.d0) * i / 8); if (isFinite(g)) add(Math.max(0.4, g)); }
        }
        if (!isFinite(lo)) { lo = Math.log10(3); hi = Math.log10(200); }
        let span = hi - lo; const MINS = 1.25;
        if (span < MINS) { const m = (lo + hi) / 2; lo = m - MINS / 2; hi = m + MINS / 2; span = MINS; }
        lo -= 0.06 * span + 0.14; hi += 0.05 * span + 0.16;
        lo = Math.max(lo, Math.log10(0.4));
        return { lo, hi };
      }
      function render(now) {
        const c = sctx, L = Lcur(), v = st.view;
        SCnow();
        if (!st.yv) st.yv = yTarget(S);
        const yv = st.yv, yOf = (g) => P.y + P.h - (Math.log10(g) - yv.lo) / (yv.hi - yv.lo) * P.h;
        const H2 = { pts: [], open: null, lag: null, today: null, yOf, kzLabels: [], edge: null, aiLink: null, caption: null };
        const occ = [];
        const inPlot = (b) => b.x0 >= P.x + 2 && b.x1 <= P.x + P.w - 2 && b.y0 >= P.y + 2 && b.y1 <= P.y + P.h - 2;
        c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
        const todayIn = hasToday(v), xT = todayIn ? S.x(0) : null;
        const fadeA = REDUCED ? 1 : clamp((now - st.fade0) / 420, 0, 1);
        const labels = !st.anim;   // labels reflow only when the view rests (no flicker while it glides)

        // Epoch-lag zone (rule-defined list only)
        if (st.list === 'rule') {
          const dl = (LAG_MS - T0) / DAY;
          if (dl < v.d1 && v.d0 < 0) {
            const xa = Math.max(P.x, S.x(Math.max(dl, v.d0))), xb = Math.min(P.x + P.w, S.x(Math.min(0, v.d1)));
            if (xb - xa > 0.5) { c.fillStyle = hatch(c); c.fillRect(xa, P.y, xb - xa, P.h); c.fillStyle = 'rgba(201,214,238,0.035)'; c.fillRect(xa, P.y, xb - xa, P.h); H2.lag = { x0: xa, x1: xb }; }
          }
        }
        // grid + ticks
        const yt = yTicks(yv);
        c.lineWidth = 1;
        yt.forEach((t) => {
          c.strokeStyle = 'rgba(150,190,255,0.075)'; c.beginPath(); c.moveTo(P.x, Math.round(t.y) + 0.5); c.lineTo(P.x + P.w, Math.round(t.y) + 0.5); c.stroke();
          txt(c, t.label, P.x - 8, t.y + 4, { align: 'right', size: N ? 10 : 11, weight: 500, color: COL.ink3, mono: true });
        });
        const xt = xTicks(S, c, xT);
        xt.forEach((t) => { c.strokeStyle = 'rgba(150,190,255,0.065)'; c.beginPath(); c.moveTo(Math.round(t.x) + 0.5, P.y); c.lineTo(Math.round(t.x) + 0.5, P.y + P.h); c.stroke(); });
        c.strokeStyle = 'rgba(150,190,255,0.3)'; c.beginPath(); c.moveTo(P.x, P.y + P.h + 0.5); c.lineTo(P.x + P.w, P.y + P.h + 0.5); c.stroke();
        xt.forEach((t) => txt(c, t.label, t.x, P.y + P.h + 18, { align: 'center', size: N ? 10 : 11, weight: 500, color: COL.ink2, mono: true }));
        txt(c, N ? '↑ WAIT UNTIL NEXT EVENT (LOG)' : '↑ WAIT UNTIL THE NEXT EVENT (LOG)', N ? 8 : 12, P.y - 14, { size: N ? 9.5 : 10.5, weight: 600, color: COL.ink3, mono: true });
        const linear = (v.d1 - v.d0) / S.tau < 2.5;   // the axis is near-linear when the span is small next to tau
        const yr0 = new Date(dateOfD(v.d0)).getUTCFullYear(), yr1 = new Date(dateOfD(v.d1)).getUTCFullYear();
        const yrTag = -v.d0 / YRD <= 250 && !xt.some((t) => /\d{4}/.test(t.label)) ? (yr0 === yr1 ? yr0 : yr0 + '–' + yr1) + ' · ' : '';
        const yw = yrTag ? txt(c, yrTag, P.x, H - 7, { size: N ? 10 : 11, weight: 700, color: COL.ink, mono: true }) : 0;
        txt(c, (linear ? (N ? 'CALENDAR (ZOOMED IN)' : 'CALENDAR TIME (ZOOMED IN)') : (N ? '← TIME BEFORE TODAY (LOG)' : '← TIME BEFORE TODAY (LOG SCALE)')), P.x + yw, H - 7, { size: N ? 9 : 10, weight: 600, color: COL.ink3, mono: true });

        // ---- plot contents, clipped
        c.save(); c.beginPath(); c.rect(P.x, P.y - 1, P.w, P.h + 2); c.clip();
        if (!FIT || FIT.list !== st.list) { const f = fitFor(st.list); if (f) { FIT = f; renderLegend(); } }
        // after today (owner's request, #31): the card's 50% range for the list on show as a band, under everything
        const OMv = omegaNow();
        if (OMv && OMv.band) {
          const xa = clamp(S.x(OMv.band.d0), P.x, P.x + P.w), xb = clamp(S.x(OMv.band.d1), P.x, P.x + P.w);
          if (xb - xa > 0.5) {
            const g = c.createLinearGradient(0, P.y, 0, P.y + P.h);
            g.addColorStop(0, 'rgba(255,200,97,0.05)'); g.addColorStop(1, 'rgba(255,200,97,0.15)');
            c.fillStyle = g; c.fillRect(xa, P.y, xb - xa, P.h);
            c.save(); c.strokeStyle = 'rgba(255,200,97,0.45)'; c.lineWidth = 1; c.setLineDash([3, 4]);
            [[OMv.band.d0, xa], [OMv.band.d1, xb]].forEach(([d, x]) => { if (S.inView(d)) { c.beginPath(); c.moveTo(Math.round(x) + 0.5, P.y); c.lineTo(Math.round(x) + 0.5, P.y + P.h); c.stroke(); } });
            c.restore();
            H2.band = { x0: xa, x1: xb };
          }
        }
        // the best-fit curve: solid amber up to today, then dashed (owner's request, #31) from today down to the omega point,
        // where the fitted wait reaches zero. The line aims at the card's date by construction (fitFor), so the dashes
        // continue the same curve; nothing else is drawn after today.
        if (FIT && !FIT.none) {
          const xToday = S.x(0), xOm = S.x(FIT.tsD);
          const path = (xa, xb, dash) => {
            if (xb <= xa) return;
            c.save(); c.strokeStyle = dash ? 'rgba(255,200,97,0.95)' : 'rgba(255,200,97,0.75)'; c.lineWidth = dash ? (N ? 2 : 2.4) : (N ? 1.6 : 2);
            c.setLineDash(dash ? [7, 5] : []); c.shadowColor = COL.omega; c.shadowBlur = dash ? 10 : 8;
            c.beginPath(); let on = false;
            for (let x = xa; x < xb + 1; x += 1.5) {
              const xx = Math.min(x, xb), d = S.inv(xx), y = d >= FIT.tsD ? P.y + P.h + 4 : Math.min(P.y + P.h + 4, yOf(FIT.g(d)));
              if (!isFinite(y)) continue;
              if (on) c.lineTo(xx, y); else { c.moveTo(xx, y); on = true; }
            }
            if (dash && xb === xOm) c.lineTo(xOm, P.y + P.h + 4);
            c.stroke(); c.restore();
          };
          if (v.d0 < 0) path(P.x, Math.min(xToday, xOm, P.x + P.w), false);
          if (v.d1 > 0 && FIT.tsD > 0 && v.d0 < FIT.tsD) {
            const xa = Math.max(P.x, xToday), xb = Math.min(P.x + P.w, xOm);
            path(xa, xb, true);
            H2.proj = { x0: xa, x1: xb };
          }
          if (FIT.tsD > 0 && S.inView(FIT.tsD)) H2.omega = { x: xOm, y: P.y + P.h, point: FIT.point };
        }
        const pr = N ? 3.6 : 4.5;
        const series = (arr, color, kind, r) => {
          c.save(); c.shadowColor = rgba(color, 0.9); c.shadowBlur = N ? 6 : 9;
          for (const p of arr) {
            if (!S.inView(p.d)) continue;
            const x = S.x(p.d), y = yOf(p.g);
            if (y < P.y - 12 || y > P.y + P.h + 12) continue;
            c.globalAlpha = kind === 'kurz' ? 1 : fadeA;
            if (p.est) ring(c, x, y, r, color, N ? 1.6 : 1.9, true); else { dot(c, x, y, r + 1.4, COL.bg); dot(c, x, y, r - 0.3, color); }
            if (p.upper) { c.strokeStyle = color; c.lineWidth = 1.3; c.beginPath(); c.moveTo(x - 3, y + r + 3); c.lineTo(x, y + r + 6); c.lineTo(x + 3, y + r + 3); c.stroke(); }
            H2.pts.push({ x, y, p, kind }); occ.push({ x0: x - r - 3, y0: y - r - 3, x1: x + r + 3, y1: y + r + (p.upper ? 8 : 3) });
          }
          c.globalAlpha = 1; c.restore();
        };
        series(KZ, COL.kurz, 'kurz', pr + 0.5);
        series(L.data.pts, COL.ai, st.list === 'rule' ? 'rule' : 'ai', st.list === 'rule' ? pr - 1.4 : pr);
        const os = openSeg(S);
        if (os) {
          const y = yOf(os.O.g);
          H2.open = { ...os, y };
          occ.push({ x0: os.xa - 6, y0: y - 6, x1: os.xb + 2, y1: y + 6 });
          if (os.ringIn) {
            const x = os.xa;
            c.save(); c.shadowColor = rgba(COL.ai, 0.9); c.shadowBlur = 8; c.setLineDash([2.5, 2.5]); ring(c, x, y, pr + 0.8, COL.ai, 1.6, true); c.setLineDash([]);
            if (os.O.lower) {   // a lower bound: the arrow points up, the gap can only grow
              c.strokeStyle = COL.ai; c.lineWidth = 1.6; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(x, y - pr - 2); c.lineTo(x, y - pr - 20); c.stroke(); c.setLineDash([]);
              c.beginPath(); c.moveTo(x - 4.5, y - pr - 14); c.lineTo(x, y - pr - 21); c.lineTo(x + 4.5, y - pr - 14); c.stroke();
              occ.push({ x0: x - 8, y0: y - pr - 24, x1: x + 8, y1: y });
            }
            c.restore();
            H2.pts.push({ x, y, p: os.O, kind: 'open' });
          }
        }
        c.restore();

        // ---- the omega point: where the dashed line reaches zero wait, on the time axis
        if (H2.omega) {
          const o = H2.omega;
          c.save(); c.strokeStyle = 'rgba(255,200,97,0.35)'; c.lineWidth = 1; c.setLineDash([2, 4]);
          c.beginPath(); c.moveTo(Math.round(o.x) + 0.5, P.y); c.lineTo(Math.round(o.x) + 0.5, o.y); c.stroke(); c.restore();
          c.save(); c.shadowColor = COL.omega; c.shadowBlur = 16; dot(c, o.x, o.y, N ? 5 : 6, COL.omega); c.restore();
          dot(c, o.x, o.y, N ? 2.2 : 2.6, '#fff6e0');
          occ.push({ x0: o.x - 10, y0: o.y - 12, x1: o.x + 10, y1: o.y + 10 });
        }

        // ---- TODAY line and label. The pulse sits at the tip of the open-gap arrow (the live, still-growing wait).
        if (xT != null) {
          const py = H2.open ? clamp(H2.open.y, P.y, P.y + P.h) : P.y + P.h * 0.5, pf = clamp((py - P.y) / P.h, 0.02, 0.98);
          const g = c.createLinearGradient(0, P.y, 0, P.y + P.h);
          g.addColorStop(0, 'rgba(234,242,255,0.14)'); g.addColorStop(pf, 'rgba(234,242,255,0.7)'); g.addColorStop(1, 'rgba(234,242,255,0.14)');
          H2.pulse = { x: xT, y: py };
          occ.push({ x0: xT - 20, y0: py - 20, x1: xT + 20, y1: py + 20 });
          c.save(); c.shadowColor = 'rgba(56,217,245,0.9)'; c.shadowBlur = 10; c.strokeStyle = g; c.lineWidth = 1.4;
          c.beginPath(); c.moveTo(xT, P.y - 4); c.lineTo(xT, P.y + P.h); c.stroke(); c.restore();
          const lab = 'TODAY · ' + (N ? fmtMD(TODAY_MS) : fmtMs(TODAY_MS)).toUpperCase();
          const lw = tw(c, lab, N ? 10.5 : 11.5, 700, true);
          const lx = clamp(xT, P.x + lw / 2, W - 4 - lw / 2);
          txt(c, lab, lx, P.y - 14, { align: 'center', size: N ? 10.5 : 11.5, weight: 700, mono: true, color: '#ffffff', glow: 'rgba(56,217,245,0.9)', glowB: 12 });
          occ.push({ x0: xT - 8, y0: P.y, x1: xT + 8, y1: P.y + P.h });
          H2.today = { x: xT };
        } else {
          const right = v.d1 < 0;
          const tw0 = txt(c, right ? 'TODAY →' : '← TODAY', right ? P.x + P.w - 4 : P.x + 6, right ? P.y - 14 : P.y + 16, { align: right ? 'right' : 'left', size: N ? 10.5 : 11.5, weight: 700, mono: true, color: COL.ink, halo: !right });
          if (!right) occ.push({ x0: P.x + 2, y0: P.y + 2, x1: P.x + 10 + tw0, y1: P.y + 21 });
        }

        // ---- annotations: placed in priority order, never on data, never on each other
        const tryLabel = (cands, lines, opt) => {
          const sizes = lines.map((_, i) => (opt.sizes && opt.sizes[i]) || (i ? (opt.size || 12) - 1.5 : (opt.size || 12)));
          const weights = lines.map((_, i) => (opt.weights && opt.weights[i]) || (i ? 500 : 650));
          const lhs = sizes.map((s) => s + 4);
          let w = 0; lines.forEach((s, i) => { w = Math.max(w, tw(c, s, sizes[i], weights[i])); });
          const h = lhs.reduce((a, b) => a + b, 0);
          for (const [x, y, al] of cands) {
            const x0 = al === 'right' ? x - w : al === 'center' ? x - w / 2 : x;
            const b = { x0: x0 - 4, y0: y - sizes[0] - 2, x1: x0 + w + 4, y1: y - sizes[0] - 2 + h + 4 };
            if (!inPlot(b) || occ.some((o) => hitBox(b, o))) continue;
            if (opt.plate) { c.globalAlpha = opt.alpha == null ? 1 : opt.alpha; c.fillStyle = opt.plate; rr(c, b.x0 - 3, b.y0 - 1, b.x1 - b.x0 + 6, b.y1 - b.y0 + 2, 6); c.fill(); if (opt.plateEdge) { c.strokeStyle = opt.plateEdge; c.lineWidth = 1; c.stroke(); } c.globalAlpha = 1; }
            let yy = y;
            lines.forEach((s, i) => { txt(c, s, x0, yy, { size: sizes[i], weight: weights[i], color: (opt.colors && opt.colors[i]) || (i ? COL.ink2 : (opt.color || COL.ink)), halo: !opt.plate, alpha: opt.alpha }); yy += lhs[i]; });
            occ.push(b); return b;
          }
          return null;
        };
        const stem = (b, x, y, col) => { // a faint dotted stem from a label back to what it names
          const sx = clamp(x, b.x0 + 6, b.x1 - 6), sy = b.y1 < y ? b.y1 + 2 : b.y0 - 2;
          c.save(); c.strokeStyle = col; c.setLineDash([2, 3]); c.lineWidth = 1; c.beginPath(); c.moveTo(sx, sy); c.lineTo(x, y); c.stroke(); c.restore();
        };
        const kzVis = H2.pts.filter((h) => h.kind === 'kurz'), aiVis = H2.pts.filter((h) => h.kind === 'ai' || h.kind === 'rule');
        const aiOnly = isAiOnly(v);
        const capText = aiOnly && L.hand && GLIDE && GLIDE.caption ? GLIDE.caption : null;
        let capMiss = false;   // the caption found no room on the canvas (phones): it goes under the chart instead
        const capA = capText ? (REDUCED || st.capInstant || st.cap0 == null ? 1 : clamp((now - st.cap0) / 700, 0, 1)) : 1;

        // Kurzweil's milestones by name: the key ones first (they must sit next to their points), more as zoom makes room
        const zoomIn = Math.max(0, Math.log10(FULL_SPAN / (v.d1 - v.d0)));
        const allow = KZ_KEY + Math.ceil(zoomIn / 2 * (KZ.length - KZ_KEY));   // all of them two decades of zoom in
        const fs = N ? 10 : 11;
        const nameKz = (lo, hi) => kzVis.slice().sort((a, b) => a.p.row.label_rank - b.p.row.label_rank).forEach((h) => {
          const rk = h.p.row.label_rank; if (rk < lo || rk > hi || rk > allow) return;
          const s = h.p.row.label, w = tw(c, s, fs, 600), r = pr + 0.5;
          // every slot clears the point's own ring: beside it, then above-right / below-left (the diagonal runs down to the
          // right, so those corners are usually free), then the other corners, then straight above / below
          const up = h.y - r - 6, dn = h.y + r + 3 + fs, mid = h.y + fs / 2 - 1;
          const cands = [[h.x + r + 5, mid, 'left'], [h.x - r - 5, mid, 'right'], [h.x + 2, up, 'left'], [h.x - 2, dn, 'right'],
            [h.x - 2, up, 'right'], [h.x + 2, dn, 'left'], [h.x, up, 'center'], [h.x, dn, 'center'],
            [h.x + r + 5, h.y - 4, 'left'], [h.x - r - 5, h.y + fs + 2, 'right'], [h.x + r + 5, h.y + fs + 2, 'left'], [h.x - r - 5, h.y - 4, 'right']];
          for (const [x, y, al] of cands) {
            const x0 = al === 'right' ? x - w : al === 'center' ? x - w / 2 : x;
            const b = { x0: x0 - 2, y0: y - fs, x1: x0 + w + 2, y1: y + 3 };
            if (!inPlot(b) || occ.some((o) => hitBox(b, o))) continue;
            txt(c, s, x0, y, { size: fs, weight: 600, color: COL.kurzL, halo: true });
            occ.push(b); H2.kzLabels.push({ ...b, h }); break;
          }
        });
        if (labels) {
          nameKz(1, KZ_KEY);
          // 1. the live point: on the rule list only, its data-lag note (owner's request: no "days since <model>" label on the
          //    hand-picked lists; the pulsing point and its hover card say it)
          if (H2.open && !H2.open.O.lower) {
            const o = H2.open, O = o.O, y = o.y;
            let l1, l2, x; const ca = [];
            if (H2.pulse) {
              x = H2.pulse.x;
              l1 = N ? 'Today: ' + O.g + ' days since the last' : 'Today: ' + O.g + ' days since the last recorded release';
              l2 = N ? 'data lag: may be shorter' : 'recent data lag: may be shorter';
              const lh = (N ? 11 : 12) + 4;
              for (let dy = -14 - lh; dy >= -330; dy -= 16) ca.push([x - 16, y + dy, 'right']);
              ca.splice(1, 0, [x - 16, y + 26, 'right']);
            } else {
              x = o.ringIn ? o.xa : (o.xa + o.xb) / 2;
              l1 = O.g + ' days since the last recorded release';
              l2 = 'recent data lag: may be shorter';
              for (let dy = -30; dy >= -320; dy -= 18) ca.push([x - 12, y + dy, 'right'], [x + 12, y + dy, 'left']);
            }
            const b = tryLabel(ca, [l1, l2], { size: N ? 11 : 12, color: '#ffffff' });
            if (b && (b.y1 < y - 30 || b.y0 > y + 30)) stem(b, x, y + (b.y1 < y ? -12 : 12), rgba(COL.ai, 0.45));
          }
          // 1b. after today: the omega point where the dashed line meets the axis, and the band's name
          if (H2.omega) {
            const o = H2.omega, ca = [];
            const l1 = N ? 'Omega point' : 'Omega point: ' + fmtISO(o.point) + ' (est.)', l2 = N ? fmtISO(o.point) + ' (est.)' : 'the curve hits zero wait';
            const xl = H2.today ? Math.min(o.x, H2.today.x) - 14 : o.x - 12;   // else left of the TODAY line
            for (let dy = 12; dy <= 150; dy += 14) ca.push([o.x + 12, o.y - dy, 'left'], [o.x - 12, o.y - dy, 'right']);
            for (let dy = 12; dy <= 220; dy += 14) ca.push([xl, o.y - dy, 'right']);
            const b = tryLabel(ca, [l1, l2], { sizes: N ? [11, 10.5] : [12.5, 11.5], weights: [700, 500], colors: [COL.omega, '#ffe6b8'] });
            if (b) { H2.omegaLabel = b; if (b.x1 < o.x - 16) stem(b, o.x, o.y - 8, 'rgba(255,200,97,0.5)'); }
          }
          if (H2.band && H2.band.x1 - H2.band.x0 > (N ? 30 : 44)) {
            const xm = (H2.band.x0 + H2.band.x1) / 2, ca = [];
            for (let yy = P.y + 16; yy < P.y + P.h * 0.5; yy += 14) ca.push([xm, yy, 'center'], [H2.band.x1 - 4, yy, 'right']);
            const b = tryLabel(ca, N ? ['50%', 'range'] : ['50% range', '(provisional)'], { sizes: N ? [10, 9.5] : [11, 10.5], weights: [650, 500], colors: ['#ffd27a', 'rgba(255,214,140,0.8)'] });
            if (b) H2.bandLabel = b;
          }
          // 2. the AI cloud. Zoomed out: a bracket names it and offers the AI-era zoom. AI models alone (every Kurzweil
          //    milestone off to the left): the glide caption, derived from the approved label, leads.
          if (aiVis.length >= 2) {
            const xs = aiVis.map((h) => h.x), ys = aiVis.map((h) => h.y);
            if (H2.open && H2.open.ringIn) { xs.push(H2.open.xa); ys.push(H2.open.y); }
            const bx = { x0: Math.min(...xs) - 11, x1: Math.max(...xs) + 11, y0: Math.min(...ys) - 11, y1: Math.max(...ys) + 11 };
            const compact = !aiOnly && bx.x1 - bx.x0 < P.w * 0.45 && bx.y1 - bx.y0 < P.h * 0.45;
            const l1 = st.list === 'rule' ? (N ? 'AI: all ' + nf(L.n) + ' releases (rule)' : 'AI releases: all ' + nf(L.n) + ' from ' + D.releases.labs.length + ' labs (by rule)') : (N ? 'AI: ' + L.short : 'AI models: ' + L.short + ' (hand-picked)');
            const l2 = st.list === 'rule' ? (N ? 'held-out test not run (#13)' : 'no held-out test on these yet (#13)') : 'AI-only fit gives no near-term date';
            const cands = [];
            let lines, opt;
            if (capText) {
              lines = [capText, l1, N ? 'the omega point also uses Kurzweil\u2019s milestones' : 'the omega point comes from adding Kurzweil\u2019s milestones'];
              opt = { sizes: N ? [14, 11, 11] : [17, 12.5, 12.5], weights: [700, 550, 500], colors: ['#ffffff', '#bff4ff', '#ffd9a0'], alpha: capA, plate: 'rgba(4,8,16,0.82)', plateEdge: 'rgba(56,217,245,0.35)' };
              for (let yy = P.y + (N ? 24 : 30); yy < P.y + P.h * 0.62; yy += 14) cands.push([P.x + 16, yy, 'left'], [P.x + P.w * 0.5, yy, 'center'], [P.x + P.w * 0.3, yy, 'left']);
            } else {
              lines = compact ? [l1, l2, N ? 'tap: see them alone ↗' : 'click: see them alone (AI era) ↗'] : [l1, l2];
              opt = { size: N ? 11 : 12.5, colors: ['#bff4ff', '#ffffff', COL.ai], weights: [650, 650, 500] };
              if (compact) {
                const r = bx;
                for (let dy = 0; dy <= 120; dy += 14) cands.push([r.x0 - 10, r.y0 + 14 - dy, 'right'], [r.x1, r.y0 - 10 - 2 * 15 - dy, 'right'], [r.x0, r.y0 - 10 - 2 * 15 - dy, 'left']);
                c.save(); c.setLineDash([4, 4]); c.strokeStyle = rgba(COL.ai, 0.5); c.lineWidth = 1.2; rr(c, Math.max(P.x + 1, r.x0), r.y0, Math.min(P.x + P.w - 1, r.x1) - Math.max(P.x + 1, r.x0), r.y1 - r.y0, 10); c.stroke(); c.restore();
              } else {
                const sorted = aiVis.slice().sort((a, b) => a.y - b.y), minX = Math.min(...xs);
                sorted.slice(0, 8).forEach((h) => { cands.push([h.x - 12, h.y - 12, 'right'], [h.x + 12, h.y - 12, 'left'], [h.x, h.y - 16, 'center'], [minX - 14, h.y + 4, 'right'], [h.x - 12, h.y - 30, 'right'], [h.x, h.y - 34, 'center']); });
                for (let yy = P.y + 22; yy < P.y + P.h * 0.5; yy += 16) cands.push([P.x + 14, yy, 'left'], [P.x + P.w * 0.5, yy, 'center']);
              }
            }
            let b = tryLabel(cands, lines, opt);
            if (!b && capText) b = tryLabel(cands, lines.slice(0, 2), opt);   // no room for the third line: the two-line caption
            if (b && compact) { H2.aiLink = b; if (b.y1 < bx.y0 - 12) stem(b, clamp((b.x0 + b.x1) / 2, bx.x0 + 10, bx.x1 - 10), bx.y0, rgba(COL.ai, 0.4)); }
            if (b && capText) H2.caption = b;
            capMiss = !!capText && !b;
          }
          // 3. the edge hint: Kurzweil's milestones are off to the left
          if (aiOnly && GLIDE && GLIDE.edge_hint) {
            const cands = [];
            for (let yy = P.y + 20; yy <= P.y + P.h - 10; yy += 14) cands.push([P.x + 10, yy, 'left']);
            const b = tryLabel(cands, [GLIDE.edge_hint], { sizes: [N ? 11 : 12], weights: [650], colors: [COL.kurzL], alpha: capA, plate: 'rgba(12,10,30,0.88)', plateEdge: 'rgba(160,143,255,0.55)' });
            if (b) H2.edge = b;
          }
          // 4. the group label, then the other milestones by name
          if (kzVis.length >= 3) {
            const mid = kzVis.slice().sort((a, b) => a.x - b.x), order = [], m = Math.floor(mid.length / 2);
            for (let i = 0; i < mid.length; i++) { const j = m + (i % 2 ? -1 : 1) * Math.ceil(i / 2); if (mid[j]) order.push(mid[j]); }
            const cands = [];
            order.slice(0, 10).forEach((h) => { cands.push([h.x + 14, h.y + 26, 'left'], [h.x - 14, h.y + 26, 'right'], [h.x + 40, h.y + 40, 'left']); });
            tryLabel(cands, N ? ['Kurzweil ' + KZ_YEAR + ' (published table)', 'all estimates · they make the line'] : [D.kurzweil.attribution, 'all estimates · they make the straight line'], { size: N ? 11 : 12, color: '#d3caff' });
          }
          nameKz(KZ_KEY + 1, KZ.length);
          if (H2.lag && H2.lag.x1 - H2.lag.x0 > (N ? 64 : 84)) {
            const xm = (H2.lag.x0 + H2.lag.x1) / 2;
            tryLabel([[xm, P.y + P.h - 26, 'center'], [xm, P.y + 30, 'center'], [H2.lag.x0 + 6, P.y + P.h - 26, 'left']], N ? ['data lag', 'may be shorter'] : ['Recent data lag', 'waits may be shorter'], { size: N ? 10.5 : 11.5, color: COL.ice });
          }
          if (!aiVis.length && !kzVis.length) {
            const O = L.data.open; const cx = xT != null ? P.x + (xT - P.x) * 0.42 : P.x + P.w / 2;
            const msg = st.list === 'rule' ? 'No recorded release in this window' : 'No listed model in this window';
            let sub = O ? (O.lower ? 'the last one: ' + fmtISO(O.date) + ', ' + O.g + ' days ago' : 'the last recorded: ' + fmtISO(O.date) + ', ' + O.g + ' days ago') : '';
            if (xT == null) {   // a past window: name the neighbours on either side instead
              const all = L.data.pts.concat(O ? [O] : []).slice().sort((a, b) => a.d - b.d);
              const prev = all.filter((p) => p.d < v.d0).pop(), next = all.find((p) => p.d > v.d1);
              const nm = (p) => (p.rows ? p.rows[0].model : REL[p.idx[0]].model + (p.idx.length > 1 ? ' +' + (p.idx.length - 1) : ''));
              sub = [prev ? 'before: ' + nm(prev) + ', ' + fmtISO(prev.date) : null, next ? 'after: ' + nm(next) + ', ' + fmtISO(next.date) : null].filter(Boolean).join(' · ');
            }
            tryLabel([[cx, P.y + P.h * 0.32, 'center'], [cx, P.y + P.h * 0.6, 'center'], [P.x + 12, P.y + 40, 'left']], [msg, sub], { size: N ? 12 : 14 });
          }
        }
        H2.capFading = capText && capA < 1;
        capLine('#mc-hero-cap', capMiss ? capText + '. The omega point comes from adding Kurzweil\u2019s milestones.' : '');
        HT = H2; st.dirty = false;
      }

      // ---- animated layer: TODAY pulse, open-gap motion, hover, selection
      function drawDyn(t) {
        const c = dctx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
        if (!HT) return;
        if (HT.open) {
          const o = HT.open; c.save(); c.beginPath(); c.rect(P.x, P.y - 2, P.w + 1, P.h + 4); c.clip();
          c.strokeStyle = rgba(COL.ai, 0.85); c.lineWidth = 1.6; c.setLineDash([3, 4]); c.lineDashOffset = REDUCED ? 0 : -((t / 70) % 7);
          c.shadowColor = rgba(COL.ai, 0.8); c.shadowBlur = 6;
          const xe = HT.pulse ? o.xb - 9 : o.xb;   // the arrow ends at the pulse: the pulse is its tip
          c.beginPath(); c.moveTo(o.xa + (o.ringIn ? 6 : 0), o.y); c.lineTo(xe, o.y); c.stroke(); c.setLineDash([]);
          if (HT.today) { c.fillStyle = COL.ai; c.beginPath(); c.moveTo(xe, o.y); c.lineTo(xe - 6, o.y - 3.5); c.lineTo(xe - 6, o.y + 3.5); c.fill(); }
          c.restore();
        }
        // list switch: each point of the new list pings once, sweeping left to right, so the change shows at any zoom
        if (!REDUCED && HT.pts.length) {
          const age = t - st.fade0;
          if (age >= 0 && age < 1300) {
            c.save(); c.beginPath(); c.rect(P.x, P.y, P.w, P.h); c.clip();
            for (const h of HT.pts) {
              if (h.kind === 'kurz') continue;
              const q = clamp((age - (h.x - P.x) / P.w * 380) / 820, 0, 1); if (q <= 0 || q >= 1) continue;
              c.strokeStyle = 'rgba(120,235,255,' + (0.75 * (1 - q)).toFixed(3) + ')'; c.lineWidth = 1.5;
              c.beginPath(); c.arc(h.x, h.y, 4 + q * (N ? 12 : 16), 0, Math.PI * 2); c.stroke();
            }
            c.restore();
          }
        }
        if (HT.today) {
          const x = HT.today.x, y = HT.pulse ? HT.pulse.y : P.y + P.h * 0.5;
          const ph = REDUCED ? 0.35 : (t % 2000) / 2000;
          for (let k = 0; k < 2; k++) {
            const q = (ph + k * 0.5) % 1;
            c.beginPath(); c.arc(x, y, 5 + q * (N ? 11 : 14), 0, Math.PI * 2);
            c.strokeStyle = 'rgba(120,235,255,' + (0.8 * (1 - q)).toFixed(3) + ')'; c.lineWidth = 1.7; c.stroke();
          }
          c.save(); c.shadowColor = 'rgba(56,217,245,1)'; c.shadowBlur = 16; dot(c, x, y, N ? 4.6 : 5.4, '#ffffff'); c.restore();
          dot(c, x, y, 2.3, COL.ai);
        }
        const h = st.hover;
        if (h && h.type === 'pt') { c.save(); c.shadowColor = 'rgba(255,255,255,0.9)'; c.shadowBlur = 12; ring(c, h.x, h.y, (N ? 3.6 : 4.5) + 5, '#ffffff', 1.5, false); c.restore(); }
        if (st.sel) {
          const a = Math.min(st.sel.x0, st.sel.x1), b = Math.max(st.sel.x0, st.sel.x1);
          c.fillStyle = 'rgba(56,217,245,0.12)'; c.fillRect(a, P.y, b - a, P.h);
          c.strokeStyle = 'rgba(56,217,245,0.8)'; c.lineWidth = 1; c.strokeRect(a + 0.5, P.y + 0.5, b - a - 1, P.h - 1);
        }
      }

      // ---- hit testing and readouts
      const inB = (b, x, y) => b && x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
      function hit(x, y, touch) {
        if (!HT) return null;
        const R = touch ? 22 : 13; let best = null, bd = R * R;
        for (const h of HT.pts) { const dd = (h.x - x) ** 2 + (h.y - y) ** 2; if (dd < bd) { bd = dd; best = { type: 'pt', x: h.x, y: h.y, p: h.p, kind: h.kind }; } }
        if (best) return best;
        for (const lb of HT.kzLabels) if (inB(lb, x, y)) return { type: 'pt', x: lb.h.x, y: lb.h.y, p: lb.h.p, kind: 'kurz' };
        if (HT.pulse && Math.hypot(x - HT.pulse.x, y - HT.pulse.y) < (touch ? 22 : 14)) return { type: 'today' };
        if ((HT.omega && Math.hypot(x - HT.omega.x, y - HT.omega.y) < (touch ? 22 : 14)) || inB(HT.omegaLabel, x, y)) return { type: 'omega' };
        if (inB(HT.aiLink, x, y)) return { type: 'aiLink' };
        if (inB(HT.edge, x, y)) return { type: 'edge' };
        if (inB(HT.caption, x, y)) return { type: 'caption' };
        if (HT.open && x >= HT.open.xa - 4 && x <= HT.open.xb + 4 && Math.abs(y - HT.open.y) < (touch ? 14 : 8)) return { type: 'pt', x: HT.open.ringIn ? HT.open.xa : x, y: HT.open.y, p: HT.open.O, kind: 'open' };
        if (HT.today && Math.abs(x - HT.today.x) < (touch ? 16 : 10) && y >= P.y - 24 && y <= P.y + P.h + 20) return { type: 'today' };
        if (HT.lag && x >= HT.lag.x0 && x <= HT.lag.x1 && y >= P.y && y <= P.y + P.h) return { type: 'lag' };
        if (HT.proj && x >= HT.proj.x0 && x <= HT.proj.x1 && FIT && !FIT.none) { const d = SCnow().inv(x), gy = d < FIT.tsD ? HT.yOf(FIT.g(d)) : P.y + P.h; if (Math.abs(y - Math.min(gy, P.y + P.h)) < (touch ? 16 : 9)) return { type: 'omega' }; }
        if (inB(HT.bandLabel, x, y) || (HT.band && x >= HT.band.x0 && x <= HT.band.x1 && y >= P.y && y <= P.y + P.h)) return { type: 'band' };
        return null;
      }
      function readout(h) {
        const L = Lcur();
        if (h.type === 'today') {
          const O = L.data.open;
          const live = O ? (O.lower ? 'The pulsing point marks the wait so far: no model on this list for <b>≥ ' + O.g + ' days</b> as of today. It rises each day until the next model; it is a lower bound, not a completed gap, and no line is drawn past it.'
            : 'The pulsing point marks the wait so far: <b>' + O.g + ' days</b> since the last recorded release. ' + esc(OPEN.reads)) : null;
          return card('Today', COL.ice, 'Today', fmtMs(TODAY_MS), [live, (() => {
            const Ov = omegaNow(), dash = FIT && !FIT.none && FIT.tsD > 0 && Ov, band = Ov && Ov.band;
            if (!dash && !band) return 'Nothing is drawn after today for this list. The registered tests appear in the calendar view below.';
            return 'Zoomed in, after today: ' + (dash ? 'the best-fit curve goes on (dashed) to the omega point' : '') + (dash && band ? ', with ' : '') + (band ? 'the card\u2019s 50% range as a band' : '') + ': a fitted estimate, not a forecast. The registered tests appear in the calendar view below.';
          })()], 'data/main_chart.json today; ' + (st.list === 'rule' ? 'releases.open_gap' : 'lists.' + st.list + '.open_days_at_today'));
        }
        if (h.type === 'omega' || h.type === 'band') {
          const Ov = omegaNow(), o = Ov && Ov.o;
          if (!o || !FIT || FIT.none) return null;
          const LL = Lcur(), LR = (D.lists[LL.key] || {}).rows || [], nf = LR.filter((r) => r.frozen !== false).length;
          const who = 'Kurzweil\u2019s ' + KZ.length + ' milestones and the ' + LL.short + (nf < LR.length ? ' (' + nf + ' of them; the ' + (LR.length - nf) + ' added after the list was frozen are shown but not fitted)' : '');
          if (h.type === 'band') return card('50% range ' + badge('provisional'), COL.omega, rangeSpan(o), null, [esc(rangeNote(o)), 'The omega point inside it: ' + esc(fmtISO(o.date)) + '. A fitted estimate, not a forecast; updated weekly.'], 'track_record + card_range');
          return card('Omega point ' + badge('fitted estimate'), COL.omega, fmtISO(o.date), 'refit ' + fmtISO(o.last.refit_date), [
            'If the speed-up continues, the best-fit curve through ' + esc(who) + ' reaches zero wait here. The dashed line carries that same curve past today.',
            'The curve is quadratic on these log axes; its date is where it fits the points best (least squared error).',
            o.cal ? '50% range (provisional): ' + esc(rangeSpan(o)) + '.' : null,
            'A fitted estimate, not a forecast. It is refit every week and has kept moving.',
          ], 'track_record');
        }
        if (h.type === 'aiLink') return card('AI models alone', COL.ai, 'Zoom to the AI era', null, [
          st.list === 'rule' ? 'The held-out test has not been run on the rule-defined releases yet (#13).' : 'The approved status label for the hand-picked lists ends: <b>“' + esc(D.verdict && D.verdict.verdict_label ? D.verdict.verdict_label.split('; ').pop() : '') + '.”</b>',
          'Click (or tap) to zoom in until only the AI models are on screen.'], D.verdict ? D.verdict.source : null);
        if (h.type === 'edge') return card("Kurzweil's milestones", COL.kurz, 'Off the left edge of this view', null, ['His ' + KZ.length + ' published milestones lie further back in time. Click (or tap) to zoom out to all time.'], D.kurzweil.input);
        if (h.type === 'caption') return card('AI models alone', COL.ai, GLIDE.caption, null, [
          'Derived from the approved status label of the hand-picked lists: <b>“' + esc(D.verdict.verdict_label) + '”</b> (' + esc(D.verdict.approved_by_pr) + ').',
          'With Kurzweil\u2019s milestones off screen, nothing here points to a near-term date: the hand-picked models alone give no bounded date, and on held-out gaps the plain exponential scored better.'], D.verdict.glide_caption_rule);
        if (h.type === 'lag') return card('Recent data lag', COL.ice, 'Waits here may be shorter', 'from ' + fmtISO(D.releases.lag_zone_from) + ' to today', [esc(D.releases.lag_note) + ' ' + esc(D.releases.lag_zone_rule)], D.releases.lag_note_src);
        const p = h.p;
        if (h.kind === 'kurz') {
          const r = p.row;
          return card("Kurzweil's milestone " + badge('estimate'), COL.kurz, r.label, 'approx. ' + r.approx_when.replace(/^about /, '') + ' · ≈ ' + fmtYears(r.years_before_today) + ' before today', [
            'Published value: <b>' + fmtYears(r.years_before_present) + ' before ' + KZ_YEAR + '</b>, an estimate in his table.',
            'Placed by ' + esc(PLACEMENT),
            r.next_label ? 'Wait until his next milestone (' + esc(r.next_label) + '): ' + fmtYears(r.time_to_next_event_years) + '.' : 'Wait to next: ' + fmtYears(r.time_to_next_event_years) + '. ' + esc(r.next_note || ''),
            esc(D.kurzweil.estimate_note),
          ], r.source);
        }
        if (st.list !== 'rule') {
          const r = p.rows[0], Ld = D.lists[L.key];
          if (h.kind === 'open') return card('Last model on this list · ' + esc(L.short) + (r.estimate ? ' ' + badge('estimate') : ''), COL.ai, r.model, fmtISO(r.date), [
            'No newer model on this list yet: <b>' + Ld.open_days_at_today + ' days and counting</b> as of today. A lower bound on this gap, not a completed gap: the arrow stops at today.',
            r.date_note ? esc(r.date_note) : null,
          ], r.source);
          return card('AI model · ' + esc(L.short) + (r.estimate ? ' ' + badge('estimate') : ''), COL.ai, r.model, fmtISO(r.date), [
            'Next model on this list: ' + fmtDays(p.g) + ' later.',
            r.frozen === false ? 'Shown only: added after the list was frozen (Oct 22), so the best-fit curve and the omega point do not use it.' : null,
            r.date_note ? esc(r.date_note) : null,
            r.epoch_date ? 'Epoch lists ' + fmtISO(r.epoch_date) + ' for this model (' + esc(r.epoch_source) + '); reported, not corrected.' : null,
          ], r.source + ' (' + Ld.defined_at + ')');
        }
        const rows = p.idx.map((i) => REL[i]);
        const names = rows.slice(0, 5).map((r) => esc(r.model) + ' <span style="color:#8693ab">(' + esc(r.lab) + ')</span>').join(', ') + (rows.length > 5 ? ', +' + (rows.length - 5) + ' more' : '');
        if (h.kind === 'open') return card('Last recorded release · ' + D.releases.labs.length + ' labs', COL.ai, rows.map((r) => r.model).join(' + '), fmtISO(p.date), [
          '<b>' + OPEN.days_at_today + ' days</b> since this release. ' + esc(OPEN.reads),
        ], rows.map((r) => r.source).join('; '));
        return card('AI release · ' + D.releases.labs.length + ' labs, rule-defined' + (p.upper ? ' ' + badge('upper bound', 'b') : ''), COL.ai, rows.length > 1 ? rows.length + ' releases this day' : rows[0].model, fmtISO(p.date), [
          rows.length > 1 ? names : esc(rows[0].lab) + (rows[0].open_weight ? ' · open weights' : ''),
          'Next release from any of the labs: ' + fmtDays(p.g) + ' later.',
          p.upper ? esc(D.releases.lag_note) : null,
        ], rows.map((r) => r.source).join('; ') + ' (non-minor rows)');
      }

      // ---- view control
      function setView(v) { st.anim = null; st.view = clampView(v); st.dirty = true; markPreset(null); }
      function animateTo(to, key, dur, ease, done) {
        st.anim = { from: { ...st.view }, to: clampView({ d0: to.d0, d1: to.d1, tau: to.tau }), t0: performance.now(), dur: REDUCED ? 1 : (dur || 620), ease: ease || easeOut, done };
        st.capInstant = false; markPreset(key); st.hover = null; tip.hide(); st.dirty = true;
      }
      function markPreset(key) { st.preset = key; $$('#mc-preset-hero button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === key))); }
      function stepLn(span) { const L = Math.log10(span), a = Math.log10(3 * YRD), b = Math.log10(3e4 * YRD); return 0.3 + 0.45 * clamp((L - a) / (b - a), 0, 1); }
      const api = {
        plot: () => P, toT: (x) => SCnow().inv(x), toX: (d) => SCnow().x(d), today: () => (hasToday(st.view) ? 0 : null),
        view: () => ({ ...st.view }), span: () => st.view.d1 - st.view.d0, spanOf: (v) => v.d1 - v.d0,
        toTIn: (v, x) => makeScale(v).inv(x),
        // zoom (no view0): about the anchor, in the axis' own coordinate; pan (view0 given): same span and warp, slid under the pointer
        place(span, dRef, f, view0) { st.capInstant = false; if (view0) setView(panView(view0, dRef, f)); else setView(zoomView(span, dRef, f)); },
        range(a, b) { let d0 = a, d1 = b; if (d1 - d0 < MIN_SPAN) { const m = (d0 + d1) / 2; d0 = m - MIN_SPAN / 2; d1 = m + MIN_SPAN / 2; } animateTo({ d0, d1 }, null); },
        reset() { st.yv = null; animateTo(PRESETS.all, 'all'); },
        step: stepLn, pinchGain: 2.2, pull: () => 1,
        zoomBtn(dir) { const v = st.view, inView = hasToday(v); const dRef = inView ? 0 : SCnow().inv(P.x + P.w / 2), f = inView ? clamp((SCnow().x(0) - P.x) / P.w, 0, 1) : 0.5; const sp = clamp((v.d1 - v.d0) * Math.exp(dir * 3 * stepLn(v.d1 - v.d0)), MIN_SPAN, FULL_SPAN); if (sp >= FULL_SPAN * 0.999) { animateTo(PRESETS.all, 'all'); return; } animateTo(zoomView(sp, dRef, f), null); },
        select(s) { const old = st.sel; st.sel = s; return old; },
        hover(x, y) { const h = hit(x, y, false); st.hover = h; if (h) tip.show(readout(h), x, y, false); else tip.hide(); cv.style.cursor = h ? 'pointer' : 'crosshair'; },
        tap(x, y, touch) {
          const h = hit(x, y, touch);
          if (h && h.type === 'aiLink') { st.hover = null; tip.hide(); animateTo(PRESETS.ai, 'ai'); return; }
          if (h && h.type === 'edge') { st.hover = null; tip.hide(); animateTo(PRESETS.all, 'all'); return; }
          st.hover = h; if (h) tip.show(readout(h), x, y, touch); else tip.hide();
        },
        leave() { st.hover = null; tip.hide(); },
        toast, onUser() { st.hover = null; tip.hide(); },
      };
      attachZoom(cv, api);
      $$('#mc-preset-hero button').forEach((b) => b.addEventListener('click', () => animateTo(PRESETS[b.dataset.preset], b.dataset.preset)));
      $('#mc-hero-in').addEventListener('click', () => api.zoomBtn(-1));
      $('#mc-hero-out').addEventListener('click', () => api.zoomBtn(1));
      $('#mc-hero-reset').addEventListener('click', () => api.reset());
      // full screen (owner, Oct 31): the browser's own full screen where it exists, else a fixed overlay; the plot grows to fill it
      function heroFsOn() { const sec = $('#mc-hero'); return !!sec && (document.fullscreenElement === sec || sec.classList.contains('mc-fs')); }
      { const sec = $('#mc-hero'), fb = $('#mc-hero-fs');
        const label = () => { const on = heroFsOn(); fb.textContent = on ? 'Exit full screen' : 'Full screen'; fb.setAttribute('aria-pressed', String(on)); };
        const overlay = (on) => { sec.classList.toggle('mc-fs', on); document.documentElement.classList.toggle('mc-fs-lock', on); measure(); label(); };
        if (sec && fb) {
          fb.hidden = false;
          fb.addEventListener('click', () => {
            if (heroFsOn()) { if (document.fullscreenElement === sec) document.exitFullscreen(); else overlay(false); return; }
            if (sec.requestFullscreen && document.fullscreenEnabled) sec.requestFullscreen().catch(() => overlay(true)); else overlay(true);
          });
          document.addEventListener('fullscreenchange', () => { measure(); label(); });
          document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sec.classList.contains('mc-fs')) overlay(false); });
        }
      }

      const live = $('#mc-hero-live');
      let wasAiOnly = false;
      function frame(t) {
        if (st.anim) {
          const a = st.anim, p = clamp((t - a.t0) / a.dur, 0, 1), e = a.ease(p);
          st.view = clampView({ d0: slogInv(slog(a.from.d0) + (slog(a.to.d0) - slog(a.from.d0)) * e), d1: slogInv(slog(a.from.d1) + (slog(a.to.d1) - slog(a.from.d1)) * e), tau: Math.exp(Math.log(a.from.tau) + (Math.log(a.to.tau) - Math.log(a.from.tau)) * e) });
          if (p >= 1) { st.view = { ...a.to }; st.anim = null; if (a.done) a.done(); }
          st.dirty = true;
        }
        // the caption fades in once the view rests with every Kurzweil milestone off to the left
        const aiNow = isAiOnly(st.view) && !st.anim;
        if (aiNow && !wasAiOnly) {
          st.cap0 = t; st.dirty = true;
          if (live) live.textContent = (Lcur().hand && GLIDE && GLIDE.caption ? GLIDE.caption + '. ' : '') + "Kurzweil's milestones are off the left edge; All time zooms out.";
        }
        wasAiOnly = aiNow;
        if (st.yv && S) {
          const yt = yTarget(SCnow()), dl = yt.lo - st.yv.lo, dh = yt.hi - st.yv.hi;
          if (Math.abs(dl) > 0.002 || Math.abs(dh) > 0.002) { const k = REDUCED ? 1 : 0.22; st.yv.lo += dl * k; st.yv.hi += dh * k; st.dirty = true; }
        }
        if (!REDUCED && t - st.fade0 < 460) st.dirty = true;
        if (HT && HT.capFading) st.dirty = true;
        if (st.dirty) render(t);
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(stat, 0, 0);
        drawDyn(t);
      }
      function setList(k) {
        if (!LISTS[k]) return;
        st.list = k; st.hover = null; tip.hide(); st.fade0 = performance.now(); st.dirty = true;
        $$('#mc-list button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.list === k)));
        renderLegend(); renderListNote();
        listHooks.forEach((f) => f(k));
      }
      // phones (CSS shows the button under 700px): the list and view pickers fold into one button whose label is the
      // current pick, built from the pickers' own labels; picking one closes it again so the plot stays on screen
      (() => {
        const tog = $('#mc-opts-btn'); if (!tog) return;
        const ctl = tog.parentNode, tx = tog.querySelector('.mc-opts-t');
        const lab = (b) => { const s = b.querySelector('.mc-sm'); return (s || b).textContent.trim(); };
        const upd = () => {
          const a = $('#mc-list button[aria-pressed="true"]'), p = $('#mc-preset-hero button[aria-pressed="true"]');
          const t = [a && lab(a), p && lab(p)].filter(Boolean).join(' \u00b7 ');
          if (t) tx.textContent = t;
        };
        const mo = new MutationObserver(upd), o = { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed'] };
        mo.observe($('#mc-list'), o); mo.observe($('#mc-preset-hero'), o);
        const setOpen = (v) => { ctl.classList.toggle('mc-open', v); tog.setAttribute('aria-expanded', String(v)); };
        tog.addEventListener('click', () => setOpen(!ctl.classList.contains('mc-open')));
        ctl.addEventListener('click', (e) => { if (e.target.closest('#mc-list button, #mc-preset-hero button')) setOpen(false); });
        upd();
      })();
      $$('#mc-list button').forEach((b) => {
        const L = LISTS[b.dataset.list];
        if (!L) { b.hidden = true; return; }
        const lab = L.hand ? L.n + ' picks' : 'All \u00b7 ' + D.releases.labs.length + ' labs';
        b.title = L.label;
        b.innerHTML = '<span class="mc-lg">' + esc(lab) + '</span><span class="mc-sm">' + esc(lab) + '</span>';
        b.addEventListener('click', () => setList(b.dataset.list));
      });
      function renderListNote() {
        const n = $('#mc-listnote'), L = Lcur();
        if (st.list === 'v1') n.textContent = L.n + ' hand-picked models build the old chart. Switch lists to see how the choice of models shapes the curve.';
        else if (L.hand && st.list === D.lists.default) n.innerHTML = '<b>' + L.n + ' hand-picked models</b>: the old chart\u2019s 11 plus later and open-weight flagships. Switch lists to see how the choice of models shapes the curve.';
        else if (L.hand) n.innerHTML = '<b>' + L.n + ' hand-picked models</b>, chosen with hindsight. Same chart, a different list, a different cloud.';
        else n.innerHTML = '<b>All ' + nf(L.n) + ' non-minor releases from ' + D.releases.labs.length + ' labs</b>, by a written rule. Nobody picks.';
      }
      function svgKey(kind) {
        const ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg');
        s.setAttribute('width', '24'); s.setAttribute('height', '14'); s.setAttribute('aria-hidden', 'true');
        const add = (tag, at) => { const n = document.createElementNS(ns, tag); for (const k in at) n.setAttribute(k, at[k]); s.append(n); };
        if (kind === 'kurz') add('circle', { cx: 12, cy: 7, r: 4.3, fill: 'none', stroke: COL.kurz, 'stroke-width': 1.9 });
        if (kind === 'ai') { add('circle', { cx: 6, cy: 7, r: 4, fill: COL.ai }); add('circle', { cx: 17.5, cy: 7, r: 3.7, fill: 'none', stroke: COL.ai, 'stroke-width': 1.7 }); }
        if (kind === 'open') { add('line', { x1: 2, y1: 9, x2: 19, y2: 9, stroke: COL.ai, 'stroke-width': 1.6, 'stroke-dasharray': '3 3' }); add('path', { d: 'M19 6 L23 9 L19 12 Z', fill: COL.ai }); add('path', { d: 'M3 8 V2 M1 4 L3 1.5 L5 4', fill: 'none', stroke: COL.ai, 'stroke-width': 1.3 }); }
        if (kind === 'lag') { add('rect', { x: 1, y: 2, width: 22, height: 10, rx: 2, fill: 'rgba(201,214,238,0.12)', stroke: 'rgba(201,214,238,0.35)' }); add('path', { d: 'M4 12 L12 2 M10 12 L18 2 M16 12 L22 4.5', stroke: 'rgba(201,214,238,0.45)' }); }
        if (kind === 'fit') { add('line', { x1: 1, y1: 7, x2: 11, y2: 7, stroke: 'rgba(255,200,97,0.8)', 'stroke-width': 2 }); add('line', { x1: 13, y1: 7, x2: 23, y2: 7, stroke: 'rgba(255,200,97,0.95)', 'stroke-width': 2, 'stroke-dasharray': '4 2' }); }
        if (kind === 'band') add('rect', { x: 3, y: 1, width: 18, height: 12, rx: 2, fill: 'rgba(255,200,97,0.18)', stroke: 'rgba(255,200,97,0.5)', 'stroke-dasharray': '2 2' });
        if (kind === 'today') { add('circle', { cx: 12, cy: 7, r: 3.6, fill: '#fff' }); add('circle', { cx: 12, cy: 7, r: 6, fill: 'none', stroke: 'rgba(120,235,255,0.75)' }); }
        return s;
      }
      function renderLegend() {
        const lg = $('#mc-legend-hero'); lg.replaceChildren();
        const item = (k, html) => { const sp = document.createElement('span'); sp.append(svgKey(k)); const t = document.createElement('span'); t.innerHTML = html; sp.append(t); if (k === 'fit' || k === 'band') sp.dataset.awaitingSkeptic = 'true'; lg.append(sp); };
        item('kurz', 'Kurzweil\u2019s milestones in history (his estimates)');
        if (st.list === 'rule') item('ai', 'AI releases, ' + D.releases.labs.length + ' labs');
        else item('ai', esc(Lcur().label.replace(/ picks$/, ' hand-picked AI models')));
        item('open', st.list === 'rule' ? 'wait so far since the last release' : 'wait so far since the last pick');
        if (st.list === 'rule') item('lag', 'recent data lag');
        if (FIT && !FIT.none && FIT.list === st.list) item('fit', (FIT.tsD > 0 ? 'best-fit curve, dashed after today \u2192 ' : 'best-fit curve \u2192 ') + esc(fmtISO(FIT.point)) + ' (fitted estimate, updated weekly)');
        { const Ov = omegaNow(); if (Ov && Ov.band) item('band', '50% range (provisional)'); }
        item('today', 'today');
      }
      window.addEventListener('resize', () => { DPR = Math.min(2, window.devicePixelRatio || 1); measure(); });
      if (window.ResizeObserver) new ResizeObserver(() => { if (box.clientWidth !== W) measure(); }).observe(box);
      setList(st.list); measure();
      // go(key, animate): jump to a preset. Used for the first view, the URL hash and reduced motion.
      function go(key, animate) {
        if (animate) { animateTo(PRESETS[key], key); return; }
        st.anim = null; st.view = clampView(PRESETS[key]); st.yv = null; st.capInstant = true; markPreset(key); st.dirty = true;
      }
      function glideTo(dur, done) { animateTo(PRESETS.ai, 'ai', dur, easeInOut, done); }
      return { frame, st, api, setList, go, glideTo, box, fut: FUT, fitOf: (list) => { const f = fitFor(list); return f && !f.none ? f : null; }, fit: () => (FIT && !FIT.none ? { a: FIT.a, b: FIT.b, c: FIT.c, n: FIT.n, tsD: FIT.tsD, point: FIT.point } : null), full: FULL, show: (d0, d1) => setView({ d0, d1 }), animate: (d0, d1) => animateTo({ d0, d1 }, null), P: () => P, xOf: (d) => SCnow().x(d), dOf: (x) => SCnow().inv(x), ht: () => HT, isAiOnly: () => isAiOnly(st.view), lists: () => Object.keys(LISTS) };
    })();
    if (B) charts.push(B);

    // ============================================================ AUTO-GLIDE: once per visit, full chart -> AI era
    const glide = (function () {
      let state = 'off', timer = null, io = null;
      const KEY = 'st-main-chart-glided';
      const seen = () => { try { return window.sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
      const markSeen = () => { try { window.sessionStorage.setItem(KEY, '1'); } catch (e) { /* storage unavailable */ } };
      function stopWatching() { clearTimeout(timer); if (io) { io.disconnect(); io = null; } }
      function cancel() { if (state === 'waiting' || state === 'holding') { state = 'cancelled'; stopWatching(); } }
      function begin() {
        if (state !== 'holding') return;
        state = 'gliding'; stopWatching(); markSeen();
        B.glideTo(GLIDE.glide_seconds * 1000, () => { state = 'done'; });
      }
      function arm() {
        state = 'waiting';
        const hold = () => { if (state !== 'waiting') return; state = 'holding'; timer = setTimeout(begin, Math.min(GLIDE.hold_seconds, 1.5) * 1000); };
        const pause = () => { if (state !== 'holding') return; clearTimeout(timer); state = 'waiting'; };
        if (window.IntersectionObserver) {   // the hold starts when most of the hero is on screen (the reader has scrolled to it)
          const need = () => Math.min(0.6, 0.9 * window.innerHeight / Math.max(1, B.box.getBoundingClientRect().height));
          io = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting && e.intersectionRatio >= need() - 0.02 ? hold() : pause())); }, { threshold: [0, 0.2, 0.4, 0.5, 0.6] });
          io.observe(B.box);
        } else hold();
        // any touch, scroll, click or key on the chart (or a view button) before the glide starts cancels it
        // only a real interaction cancels it (owner's report, #31: on phones, the swipe that scrolls the page down over
        // the chart, or a wheel scrolling past it on desktop, cancelled the glide before it could be seen): a mouse press,
        // a key, or a zoom or pan the reader makes (api.onUser)
        B.box.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') cancel(); }, { passive: true });
        B.box.addEventListener('keydown', cancel);
        { const ou = B.api.onUser; B.api.onUser = function () { cancel(); return ou.apply(this, arguments); }; }
        $$('#mc-preset-hero button, #mc-hero-in, #mc-hero-out, #mc-hero-reset').forEach((b) => b.addEventListener('click', cancel));
      }
      return { arm, cancel, seen, state: () => state };
    })();
    const hashView = () => { const m = /(?:^#|&)view=(all|ai)(?:&|$)/.exec(window.location.hash || ''); return m ? m[1] : null; };
    if (B) {
      const hv = hashView();
      if (hv) B.go(hv, false);                                               // #view=all / #view=ai override
      else if (!AUTO_GLIDE || !GLIDE || !GLIDE.hold_seconds) B.go('all', false);
      else if (REDUCED) B.go('ai', false);                                    // no motion: land on the AI era directly (every load glides otherwise)
      else { B.go('all', false); glide.arm(); }
      window.addEventListener('hashchange', () => { const h = hashView(); if (h) { glide.cancel(); B.go(h, true); } });
    }

    // ============================================================ DEEP TIME STRIP (issue #31, Release 1: the deep-time staircase)
    // A thin log-scale strip under the hero: Kurzweil's milestones at their true dates (his published estimates, hollow
    // rings) on a "time before today" axis from the oldest milestone to today, and a box showing the range the hero
    // chart is showing now. Click or drag on the strip to move the hero chart (same zoom level, new place). It draws
    // nothing fitted and no date: every position is a value of kurzweil.rows (years_before_today) and the hero's view.
    // Text strings of this strip are awaiting Skeptic review (no approved_by).
    const DEEP = (function () {
      const box = $('#mc-box-deep'), cv = $('#mc-cv-deep');
      if (!box || !cv || !B) return null;
      const ctx = cv.getContext('2d'), tip = makeTip(box), toast = makeToast(box);
      const MS = D.kurzweil.rows.map((r) => ({ d: -r.years_before_today * YRD, row: r })).sort((a, b) => a.d - b.d);
      const FULL = B.full, UMIN = Math.sign(FULL.d0) * Math.log10(1 + Math.abs(FULL.d0));
      const slog = (d) => Math.sign(d) * Math.log10(1 + Math.abs(d));
      const slogInv = (u) => Math.sign(u) * (Math.pow(10, Math.abs(u)) - 1);
      const TICKS = [[1e9 * YRD, '1 billion years ago', '1 bn yr'], [1e6 * YRD, '1 million', '1 m yr'], [1e3 * YRD, '1,000 years', '1,000 yr'], [10 * YRD, '10 years', '10 yr'], [YRD, '1 year', '1 yr'], [30.44, '1 month', '1 mo'], [7, '1 week', '1 wk']];
      let W = 0, H = 0, N = false, P = null, HT = null, drawn = '', dirty = true, drag = null;
      function measure() {
        N = isNarrow(); W = box.clientWidth; H = N ? 112 : 104;
        P = { x: N ? 16 : 24, y: 8, w: W - (N ? 16 : 24) - (N ? 20 : 26), axisY: Math.round(H * 0.56) };
        cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.height = H + 'px'; dirty = true;
      }
      const xOf = (d) => P.x + (slog(d) - UMIN) / (0 - UMIN) * P.w;
      const dAt = (x) => slogInv(UMIN + clamp((x - P.x) / P.w, 0, 1) * (0 - UMIN));
      const viewNow = () => ({ d0: B.st.view.d0, d1: B.st.view.d1 });
      const boxX = () => { const v = viewNow(), lo = P.x - 6, hi = P.x + P.w + 6; let a = clamp(xOf(v.d0), lo, hi - 8), b = clamp(xOf(v.d1), lo, hi); if (b - a < 8) { const m = clamp((a + b) / 2, lo + 4, hi - 4); a = m - 4; b = m + 4; } return { a, b }; };
      function render() {
        const c = ctx, v = viewNow(); HT = { dots: [], box: null };
        c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
        const ay = P.axisY;
        // the hero's range, behind the milestones
        const bx = boxX(); HT.box = { x0: bx.a, x1: bx.b, y0: 6, y1: H - 24 };
        c.fillStyle = 'rgba(56,217,245,0.09)'; rr(c, bx.a, 6, bx.b - bx.a, H - 30, 5); c.fill();
        c.strokeStyle = 'rgba(56,217,245,0.75)'; c.lineWidth = 1.2; rr(c, bx.a + 0.5, 6.5, bx.b - bx.a - 1, H - 31, 5); c.stroke();
        // the axis, thick inside the hero's range
        c.strokeStyle = 'rgba(150,190,255,0.32)'; c.lineWidth = 1; c.beginPath(); c.moveTo(P.x, ay + 0.5); c.lineTo(P.x + P.w, ay + 0.5); c.stroke();
        c.save(); c.strokeStyle = COL.ai; c.lineWidth = 3; c.shadowColor = COL.ai; c.shadowBlur = 6; c.beginPath(); c.moveTo(Math.max(P.x, bx.a + 3), ay + 0.5); c.lineTo(Math.min(P.x + P.w, bx.b - 3), ay + 0.5); c.stroke(); c.restore();
        // time ticks under the axis (as many as fit)
        // "today" is drawn last but its place is reserved first, so no tick label runs into it
        let lastR = -1e9;
        const todayL = P.x + P.w - tw(c, 'today', N ? 9 : 10, 500, true);
        TICKS.concat([[0, 'today', 'today']]).forEach((tk) => {
          const x = tk[0] ? xOf(-tk[0]) : P.x + P.w, lab = N ? tk[2] : tk[1];
          if (tk[0] && (x < P.x + 4 || x > P.x + P.w - 30)) return;
          const w = tw(c, lab, N ? 9 : 10, 500, true), al = tk[0] ? 'center' : 'right', x0 = al === 'right' ? x - w : x - w / 2;
          c.strokeStyle = 'rgba(150,190,255,0.4)'; c.beginPath(); c.moveTo(Math.round(x) + 0.5, ay); c.lineTo(Math.round(x) + 0.5, ay + 5); c.stroke();
          if (tk[0] && (x0 < lastR + 8 || x0 + w > todayL - 8) || x0 < 2) return;
          txt(c, lab, al === 'right' ? x : x, H - 8, { mono: true, size: N ? 9 : 10, color: COL.ink3, align: al });
          lastR = x0 + w;
        });
        // Kurzweil's milestones: hollow rings (estimates); the labelled ones are the key milestones that fit
        let lr = -1e9;
        MS.forEach((m) => {
          const x = xOf(m.d); HT.dots.push({ x, y: ay, m });
          ring(c, x, ay, 4, COL.kurz, 1.7, true);
          if (m.row.key) {
            const lab = m.row.label, w = tw(c, lab, N ? 10 : 11, 600, false), x0 = clamp(x - w / 2, 2, W - w - 2);
            if (x0 > lr + 8) { txt(c, lab, x0, ay - 14, { size: N ? 10 : 11, weight: 600, color: COL.kurzL }); lr = x0 + w; }
          }
        });
        // today
        c.save(); c.shadowColor = COL.ai; c.shadowBlur = 8; dot(c, P.x + P.w, ay, 4.2, '#ffffff'); c.restore();
        drawn = JSON.stringify(v) + '|' + W + '|' + DPR; dirty = false;
      }
      function frame() { if (!P) return; const key = JSON.stringify(viewNow()) + '|' + W + '|' + DPR; if (dirty || key !== drawn) render(); }
      // moving the hero: the same span, centred on the pointer (the hero's clamp keeps it within its own right edge)
      function centreOn(x, animate) {
        const sp = B.st.view.d1 - B.st.view.d0; let d = dAt(x);
        if (sp >= (FULL.d1 - FULL.d0) * 0.999) return;    // the hero already shows everything: nothing to move
        let d0 = d - sp / 2, d1 = d + sp / 2;
        if (animate && !REDUCED) B.animate(d0, d1); else B.show(d0, d1);
      }
      const loc = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      function dotAt(p, touch) { let best = null, bd = touch ? 16 : 9; (HT ? HT.dots : []).forEach((q) => { const dd = Math.hypot(p.x - q.x, p.y - q.y); if (dd < bd) { bd = dd; best = q; } }); return best; }
      function cardOf(q) {
        const r = q.m.row;
        return card("Kurzweil's milestone " + badge('estimate'), COL.kurz, r.label, 'approx. ' + r.approx_when.replace(/^about /, '') + ' \u00b7 \u2248 ' + fmtYears(r.years_before_today) + ' before today', [
          'Placed on this strip by its published estimate (' + fmtYears(r.years_before_present) + ' before ' + (String(D.kurzweil.attribution).match(/\b(\d{4})\b/) || [])[1] + ').', esc(D.kurzweil.estimate_note)], r.source);
      }
      function boxCard() {
        const v = viewNow(), sp = v.d1 - v.d0;
        return card('The main chart\u2019s range', COL.ai, 'Showing ' + fmtDays(sp), v.d1 > 1 ? 'up to ' + fmtDays(v.d1) + ' after today' : v.d1 >= -1e-9 ? 'ending today' : 'ending ' + fmtDays(-v.d1) + ' before today', ['Click or drag this strip to pan the main chart across time (same zoom).']);
      }
      cv.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const p = loc(e); try { cv.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer: ignore */ }
        tip.hide();
        drag = { id: e.pointerId, x0: p.x, y0: p.y, moved: false, live: e.pointerType === 'mouse' };
        // a finger acts on lift (a tap) or once it moves clearly sideways: touching the strip to scroll the page past it
        // must not move the chart above or cancel its glide (owner's report, #31)
        if (drag.live) { glide.cancel(); centreOn(p.x, true); }
      });
      cv.addEventListener('pointermove', (e) => {
        const p = loc(e);
        if (drag && drag.id === e.pointerId) {
          if (!drag.live && Math.abs(p.x - drag.x0) > 10 && Math.abs(p.x - drag.x0) > 1.5 * Math.abs(p.y - drag.y0)) { drag.live = true; glide.cancel(); }
          if (drag.live && Math.abs(p.x - drag.x0) > 3) { drag.moved = true; centreOn(p.x, false); }
          return;
        }
        if (e.pointerType !== 'mouse') return;
        const q = dotAt(p, false);
        if (q) { tip.show(cardOf(q), p.x, p.y, false); cv.style.cursor = 'pointer'; }
        else if (HT && p.x >= HT.box.x0 && p.x <= HT.box.x1) { tip.show(boxCard(), p.x, p.y, false); cv.style.cursor = 'grab'; }
        else { tip.hide(); cv.style.cursor = 'crosshair'; }
      });
      const endDrag = (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        const p = loc(e), d = drag; drag = null;
        if (e.type !== 'pointerup' || d.live || Math.hypot(p.x - d.x0, p.y - d.y0) >= 12) return;
        glide.cancel(); centreOn(p.x, true);   // a finger's tap: the same jump a click makes
        const q = dotAt(p, true); if (q) tip.show(cardOf(q), p.x, p.y, true);
      };
      cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
      cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !drag) tip.hide(); });
      cv.addEventListener('keydown', (e) => {
        const v = viewNow(), sp = v.d1 - v.d0, mid = (v.d0 + v.d1) / 2;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const x = xOf(mid) + (e.key === 'ArrowLeft' ? -1 : 1) * P.w * 0.08; centreOn(x, false); e.preventDefault(); }
        else if (e.key === '0') { B.api.reset(); e.preventDefault(); }
        else if (e.key === '+' || e.key === '=') { B.api.zoomBtn(-1); e.preventDefault(); }
        else if (e.key === '-' || e.key === '_') { B.api.zoomBtn(1); e.preventDefault(); }
      });
      window.addEventListener('resize', () => { DPR = Math.min(2, window.devicePixelRatio || 1); measure(); });
      if (window.ResizeObserver) new ResizeObserver(() => { if (box.clientWidth !== W) measure(); }).observe(box);
      measure();
      return { frame, st: { get dirty() { return dirty; }, anim: null }, box, P: () => P, xOf, dAt, boxX, centreOn, dots: () => (HT ? HT.dots.map((q) => ({ x: q.x, y: q.y, label: q.m.row.label, key: !!q.m.row.key })) : []) };
    })();
    if (DEEP) charts.push(DEEP);

    // ============================================================ TRACK RECORD (Release 2): the fit's date, refit by refit
    // Drawn only when main_chart.json carries display-approved registry rows (track_record.status 'ok'); otherwise
    // the page shows the build's one-line note and this panel does not exist. Every date drawn here is a value of
    // track_record.rows, which the build copies only from registry rows a reviewed PR approved for display, and the
    // gate checks each against the registry. Demoted on purpose: faint amber, below the hero, never the headline.
    const DEFAULT_LIST = (D.lists && D.lists.default) || 'v1';
    // scroll-triggered zoom (owner's request, #31): fn() once, when the element is mostly on screen (at once without
    // IntersectionObserver), so readers see each chart's zoom instead of it running before they reach it
    function whenSeen(el, fn) {
      if (!el) return;
      if (!window.IntersectionObserver) { fn(); return; }
      const need = () => Math.min(0.6, 0.9 * window.innerHeight / Math.max(1, el.getBoundingClientRect().height));
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting && e.intersectionRatio >= need() - 0.02)) { io.disconnect(); fn(); } }, { threshold: [0.2, 0.4, 0.5, 0.6] });
      io.observe(el);
    }
    const curList = () => (B ? B.st.list : DEFAULT_LIST);
    const calFrom = (t) => (t <= TODAY_MS ? 'now' : fmtMs(t));   // a calibrated lower end already gone by reads 'now'
    const rangeSpan = (o) => (o.cal ? calFrom(o.cal.lo) + ' – ' + fmtMs(o.cal.hi) : '');
    // the bands were calibrated on one reference list only (card_range.reference_list, read from the data): on any other list
    // the range is labelled with that list's name (awaiting Skeptic: data-awaiting-skeptic on #mc-omega-range)
    const offRef = (o) => !!(o.cal && o.list !== D.card_range.reference_list);
    const refLabel = () => { const L = D.lists && D.lists[D.card_range.reference_list]; return L ? L.label : D.card_range.reference_list; };
    const CARD_LIST = (ok(D.card_range) && D.card_range.reference_list) || (D.lists && D.lists.default);
    const rangeText = (o) => !o.cal ? '' : '50% range (provisional) ' + rangeSpan(o) + (offRef(o) ? ' (calibrated on ' + refLabel() + ' only)' : '');
    const rangeNote = (o) => (o.cal
      ? 'Provisional, in-sample 50% range' + (offRef(o) ? ' (calibrated on ' + refLabel() + ' only, not on this list)' : '') + ': half of the rolling backtest\u2019s ' + D.card_range.bands['50'].n + ' held-out errors (list ' + D.card_range.reference_list + ') fell inside it. 80% range (provisional, in-sample; not calibrated): ' + calFrom(o.cal.lo80) + ' – ' + fmtMs(o.cal.hi80) + '.'
        + (D.card_range.bias ? ' In ' + D.card_range.bias.longer + ' of ' + D.card_range.bias.n + ' held-out tests the real wait was longer than the curve said: this method tends to name dates too early.' : '')
      : '');
    const CARD = (function () {
      const el = $('#mc-omega'), dEl = $('#mc-omega-date');
      if (!el || !dEl) return null;
      const rEl = $('#mc-omega-range'), sEl = $('#mc-omega-slide'), fEl = $('#mc-omega-for'), cEl = $('#mc-omega-recede');
      // The receding line (owner's exception, #31): days from today to the card's date for the latest calendar refit, and
      // the same count at the previous calendar refit (its date minus its own refit day). Both are row arithmetic on
      // display-approved track_record rows; nothing is typed. Nothing is shown when the latest fit is pinned (no finite
      // date) or its date has already gone by. The strings are awaiting Skeptic approval (data-awaiting-skeptic).
      function recede(o) {
        if (!cEl) return;
        cEl.hidden = true; cEl.textContent = ''; cEl.title = ''; delete cEl.dataset.now; delete cEl.dataset.then;
        if (!o || o.pinned !== 'none') return;
        const dd = (a, b) => Math.round((isoMs(a) - isoMs(b)) / DAY);
        const n = dd(o.date, TODAY_ISO);
        if (!(n >= 1)) return;
        const days = (k) => k + (k === 1 ? ' day' : ' days');
        let h = '<b>' + n + '</b> ' + (n === 1 ? 'day' : 'days') + ' to the omega point', tip = 'Latest refit ' + o.last.refit_date + ': ' + o.date + ' minus today = ' + days(n) + '.';
        const pq = o.trail.length > 1 ? o.trail[o.trail.length - 2] : null, pv = pq && pq.r;
        const m = pv && pv.pinned === 'none' ? dd(pq.date, pv.refit_date) : null;
        if (m != null && m >= 1) {
          // compare like with like: each refit's own count on its own refit day (n0 vs m), so a rebuild days after the last
          // refit cannot flip the verdict while the fitted date has not moved
          const gap = dd(TODAY_ISO, pv.refit_date), n0 = dd(o.date, o.last.refit_date), re = pv.kind === 'backtest';
          h += ' \u00b7 ' + (gap >= 6 && gap <= 8 ? 'a week ago' : gap + ' days ago') + (re ? ' (recomputed)' : '') + ': ' + m;
          h += ' \u00b7 ' + (n0 >= m ? 'it keeps moving away' : 'it moved closer by ' + days(m - n0));
          tip += ' Previous refit ' + pv.refit_date + ': ' + pq.date + ' minus ' + pv.refit_date + ' = ' + days(m) + '.'
            + ' Latest refit: ' + o.date + ' minus ' + o.last.refit_date + ' = ' + days(n0) + '.'
            + (re ? ' The earlier number is a backtest: the current method and list, rerun on the data up to that day. It is not what the site showed then.' : '');
          cEl.dataset.then = String(m);
        }
        cEl.dataset.now = String(n); cEl.innerHTML = h; cEl.title = tip; cEl.hidden = false;
      }
      function paint(list) {
        const o = OMEGA.of(list);
        const L = D.lists && D.lists[list];
        if (fEl) fEl.textContent = L ? L.label : (list === 'rule' && ok(D.releases) ? D.releases.label : '');
        // the fit reads the frozen rows only: say so when the list also shows rows added after the freeze
        const nEl = $('#mc-omega-fitn'), nf = L && L.rows ? L.rows.filter((r) => r.frozen !== false).length : 0, extra = !!(L && L.rows && nf < L.rows.length);
        if (nEl) { nEl.textContent = extra ? '\u00b7 ' + nf + ' in the fit' : ''; nEl.hidden = !extra; }
        sEl.textContent = ''; dEl.title = ''; sEl.title = ''; rEl.title = '';
        recede(o);
        if (!o) {   // no refits for this list (the rule-defined list): say so, show no date
          el.dataset.state = 'none'; dEl.textContent = 'Not computed for this list'; rEl.textContent = 'The method has only been refit on the hand-picked lists.'; rEl.hidden = false;
          return;
        }
        dEl.title = 'Latest refit: ' + fmtISO(o.last.refit_date) + ' (' + o.last.kind.replace('_', ' ') + '); the quadratic fit, where it fits best';
        if (o.pinned === 'upper') {   // the fit ran to the far edge of its search grid: no date to name
          el.dataset.state = 'edge'; dEl.textContent = 'No finite date'; rEl.textContent = 'The latest fit ran into the edge of its search grid.'; rEl.hidden = false;
        } else {
          el.dataset.state = 'ok'; dEl.textContent = fmtISO(o.date); rEl.textContent = rangeText(o); rEl.title = rangeNote(o); rEl.hidden = !o.cal;
        }
        // the share of past estimates already gone by is on learn.html#omega (owner's request, #31), not on the card
        sEl.innerHTML = ''; sEl.hidden = true;   // the receding line says it moves; the rate is on learn.html#omega (owner, #31)
        sEl.title = o.passed + ' of ' + o.rows.length + ' calendar refits of this list named a date before today' + (o.r != null ? '; r = ' + o.r.toFixed(2) + ' days later per day that passed' : '');
      }
      // one omega date everywhere (owner, #80 design pass): the card always shows the reference list's refit (the list its
      // 50% range was calibrated on); other lists' dates appear only on the charts, marked (est.)
      paint(CARD_LIST);
      return { paint };
    })();

    const T = (function () {
      const box = $('#mc-box-track'), cv = $('#mc-cv-track'), cvd = $('#mc-cv-track-dyn');
      if (!box || !cv) return null;
      if (!TRK) { pendingIn(box, 'Track record pending.'); return null; }
      const ctx = cv.getContext('2d'), dctx = cvd.getContext('2d');
      const tip = makeTip(box), toast = makeToast(box);
      const stat = document.createElement('canvas'), sctx = stat.getContext('2d');
      const AMB = '#d9b878', INK = 'rgba(234,242,255,0.72)';
      const key = (l, m) => l + '|' + m;
      const GROUPS = {}, ORDER = [];
      TRK.groups.forEach((g) => { GROUPS[key(g.list, g.method)] = { g, rows: [] }; ORDER.push(key(g.list, g.method)); });
      TRK.rows.forEach((r) => {
        const G = GROUPS[key(r.list, r.method)]; if (!G) return;
        G.rows.push({ r, tr: isoMs(r.refit_date) + DAY / 2, tp: isoMs(r.point) + DAY / 2, tlo: isoMs(r.lo95) + DAY / 2,
          thi: r.hi95 === 'unbounded' ? Infinity : isoMs(r.hi95) + DAY / 2, up: r.pinned === 'upper' });
      });
      ORDER.forEach((k) => GROUPS[k].rows.sort((a, b) => a.tr - b.tr));
      // views: the default ends a little after the last named date that is not pinned to the far grid edge (or today)
      function extent(G) {
        const t0 = G.rows[0].tr; let t1 = TODAY_MS, tFar = TODAY_MS;
        G.rows.forEach((o) => { if (!o.up) t1 = Math.max(t1, o.tp); if (isFinite(o.thi) && !o.up) tFar = Math.max(tFar, o.thi); });
        const span = Math.max(t1 - t0, 30 * DAY);
        const def = [t0 - 0.04 * span, t1 + 0.1 * span];
        const lim = [def[0] - YEAR, Math.min(Math.max(tFar, def[1]) + 0.1 * span, TODAY_MS + 50 * YEAR)];
        return { def, lim };
      }
      const st = { key: ORDER.find((k) => k === key(DEFAULT_LIST, 'calendar')) || ORDER[0], v0: 0, v1: 1, anim: null, hover: null, sel: null, dirty: true, hero: null };
      let W = 0, H = 0, N = false, P = null, HT = null, EX = null;
      const cur = () => GROUPS[st.key];

      function measure() {
        N = isNarrow(); W = box.clientWidth; H = N ? 330 : 360;
        const padL = N ? 44 : 78, padR = N ? 44 : 64, padT = N ? 30 : 32, strip = N ? 66 : 74, axis = N ? 24 : 26;
        P = { x: padL, y: padT, w: W - padL - padR, lane0: padT, lane1: H - strip - axis - 8, s0: H - strip, s1: H - 10, padR };
        P.h = P.s1 - P.y;
        for (const c of [cv, cvd, stat]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
        cv.style.height = H + 'px'; cvd.style.height = H + 'px'; cvd.style.width = W + 'px';
        st.dirty = true;
      }
      const X = (t) => P.x + (t - st.v0) / (st.v1 - st.v0) * P.w;
      const Tx = (x) => st.v0 + (x - P.x) / P.w * (st.v1 - st.v0);
      const SY = (v) => P.s1 - (Math.log10(clamp(v, 1, 1000))) / 3 * (P.s1 - P.s0);   // strip: 1% .. 1000%, log
      function ticks(minPx) {
        const span = st.v1 - st.v0, ppm = P.w / span;
        const Cs = [['day', 1, DAY], ['week', 1, 7 * DAY], ['month', 1, 30.44 * DAY], ['month', 3, 91.3 * DAY], ['month', 6, 182.6 * DAY], ['year', 1, YEAR], ['year', 2, 2 * YEAR], ['year', 5, 5 * YEAR], ['year', 10, 10 * YEAR]];
        const c = Cs.find((q) => q[2] * ppm >= minPx) || Cs[Cs.length - 1], out = [], d0 = new Date(st.v0);
        if (c[0] === 'day' || c[0] === 'week') { let t = Math.floor(st.v0 / DAY) * DAY; if (c[0] === 'week') while (new Date(t).getUTCDay() !== 1) t -= DAY; for (; t <= st.v1; t += c[2]) out.push({ t, u: c[0] }); }
        else if (c[0] === 'month') { let y = d0.getUTCFullYear(), m = d0.getUTCMonth(); m -= m % c[1]; for (;;) { const t = Date.UTC(y, m, 1); if (t > st.v1) break; out.push({ t, u: 'month' }); m += c[1]; if (m >= 12) { m -= 12; y++; } } }
        else { let y = d0.getUTCFullYear(); y -= ((y % c[1]) + c[1]) % c[1]; for (;;) { const t = Date.UTC(y, 0, 1); if (t > st.v1) break; out.push({ t, u: 'year' }); y += c[1]; } }
        return out.filter((o) => o.t >= st.v0 && o.t <= st.v1);
      }
      function arrow(c, x, y, s, color) { c.fillStyle = color; c.beginPath(); c.moveTo(x, y); c.lineTo(x - s, y - s * 0.6); c.lineTo(x - s, y + s * 0.6); c.closePath(); c.fill(); }

      function render() {
        const c = sctx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
        const G = cur(), rows = G.rows, n = rows.length, HH = { rows: [], strip: [], today: null, rowH: 0 };
        const xR = P.x + P.w, xT = X(TODAY_MS), todayIn = xT >= P.x - 1 && xT <= xR + 1;
        txt(c, N ? 'THE DATE EACH UPDATE NAMED' : 'THE DATE EACH UPDATE NAMED · ONE ROW PER UPDATE, OLDEST AT THE BOTTOM', 8, 18, { mono: true, size: N ? 9.5 : 10.5, weight: 600, color: COL.ink3 });
        txt(c, 'AI ONLY', xR + P.padR / 2, 18, { mono: true, size: N ? 9 : 10, weight: 600, align: 'center', color: COL.ink3 });
        // grid and time axis (between the lanes and the strip); the TODAY label keeps its place on the axis
        const TL = todayIn ? (() => {
          const lab = 'TODAY · ' + fmtMD(TODAY_MS).toUpperCase(), w = tw(c, lab, N ? 9.5 : 10.5, 700, true);
          const right = xT + w / 2 > xR, left = xT - w / 2 < P.x, x0 = right ? xT - 4 - w : left ? xT + 4 : xT - w / 2;
          return { lab, x0, x1: x0 + w, right, left };
        })() : null;
        const TK = ticks(N ? 64 : 88); let first = true;
        TK.forEach((tk) => {
          const x = Math.round(X(tk.t)) + 0.5, d = new Date(tk.t);
          c.strokeStyle = 'rgba(150,190,255,0.05)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, P.lane0); c.lineTo(x, P.s1); c.stroke();
          const lab = tk.u === 'year' ? String(d.getUTCFullYear()) : tk.u === 'month' ? (d.getUTCMonth() === 0 || first ? MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear() : MON[d.getUTCMonth()]) : MON[d.getUTCMonth()] + ' ' + d.getUTCDate();
          first = false;
          const lw = tw(c, lab, N ? 9.5 : 10.5, 500, true); if (x - lw / 2 < 2 || x + lw / 2 > xR + 4) return;
          if (TL && x + lw / 2 > TL.x0 - 10 && x - lw / 2 < TL.x1 + 10) return;
          txt(c, lab, x, P.lane1 + 18, { mono: true, size: N ? 9.5 : 10.5, align: 'center', color: COL.ink3 });
        });
        c.strokeStyle = 'rgba(150,190,255,0.18)'; c.beginPath(); c.moveTo(P.x, P.lane1 + 4.5); c.lineTo(xR, P.lane1 + 4.5); c.stroke();
        // lanes: one row per refit, from the refit day (tick) to the date the fit named (point), with its claimed 95% range
        const laneH = P.lane1 - P.lane0, rowH = laneH / n; HH.rowH = rowH;
        c.save(); c.beginPath(); c.rect(P.x, P.lane0 - 2, P.w, laneH + 4); c.clip();
        const lw = clamp(rowH * 0.42, 0.8, 3), rad = clamp(rowH * 0.42, 1.3, 4.2);
        rows.forEach((o, j) => {
          const y = P.lane1 - (j + 0.5) * rowH, xr = X(o.tr), xp = o.up ? xR - 2 : X(o.tp);
          c.strokeStyle = 'rgba(217,184,120,0.16)'; c.lineWidth = Math.max(0.8, lw * 0.6); c.beginPath(); c.moveTo(xr, y); c.lineTo(xp, y); c.stroke();
          const xl = X(o.tlo), xh = isFinite(o.thi) && !o.up ? X(o.thi) : xR - 1;
          c.strokeStyle = 'rgba(217,184,120,0.34)'; c.lineWidth = lw; c.beginPath(); c.moveTo(xl, y); c.lineTo(xh, y); c.stroke();
          if (!isFinite(o.thi) || o.up) arrow(c, xR, y, Math.max(3, rad + 1), 'rgba(217,184,120,0.55)');
          c.strokeStyle = 'rgba(234,242,255,0.42)'; c.lineWidth = 1; c.beginPath(); c.moveTo(xr, y - Math.min(rowH * 0.5, 5)); c.lineTo(xr, y + Math.min(rowH * 0.5, 5)); c.stroke();
          if (!o.up) {
            if (o.r.passed) ring(c, xp, y, rad, 'rgba(217,184,120,0.8)', Math.min(1.3, rad * 0.5), true);
            else dot(c, xp, y, rad, 'rgba(217,184,120,0.85)');
          }
          HH.rows.push({ j, y, o, xp, xr });
        });
        c.restore();
        // AI-only fit at the same cut: flags only, never its date
        const xa = xR + P.padR / 2;
        rows.forEach((o, j) => {
          const a = o.r.ai_only, y = P.lane1 - (j + 0.5) * rowH, s = clamp(rowH * 0.4, 1, 3.6);
          if (!a) return;
          if (a.pinned === 'upper') { c.strokeStyle = 'rgba(169,182,204,0.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(xa - 9, y); c.lineTo(xa + 5, y); c.stroke(); arrow(c, xa + 9, y, Math.max(3, s + 1), 'rgba(169,182,204,0.7)'); }
          else if (a.pinned === 'lower') { c.strokeStyle = 'rgba(169,182,204,0.7)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(xa, y - Math.max(1.5, s)); c.lineTo(xa, y + Math.max(1.5, s)); c.stroke(); }
          else if (a.bounded) dot(c, xa, y, s, 'rgba(169,182,204,0.75)');
          else ring(c, xa, y, s, 'rgba(169,182,204,0.7)', 1, false);
        });
        // strip: the claimed half-width against how far the date moved by the next refit, % of the time the fit said remained
        c.strokeStyle = 'rgba(150,190,255,0.12)'; c.lineWidth = 1;
        [[1, '1%'], [10, '10%'], [100, '100%'], [1000, '1000%']].forEach(([v, s]) => {
          const y = Math.round(SY(v)) + 0.5; c.beginPath(); c.moveTo(P.x, y); c.lineTo(xR, y); c.stroke();
          if (!N || v === 100 || v === 10) txt(c, s, P.x - 6, y + 3.5, { mono: true, size: N ? 9 : 10, align: 'right', color: COL.ink3 });
        });
        txt(c, N ? 'MOVED (SOLID) VS CLAIMED MARGIN (DASHED) · % OF TIME LEFT' : 'HOW FAR THE DATE MOVED AT THE NEXT UPDATE (SOLID) VS ITS CLAIMED MARGIN (DASHED) · % OF TIME LEFT · LOG',
          P.x + 4, P.s0 - 3, { mono: true, size: N ? 8.5 : 9.5, weight: 600, color: COL.ink3 });
        c.save(); c.beginPath(); c.rect(P.x, P.s0 - 2, P.w, P.s1 - P.s0 + 4); c.clip();
        const line = (field, dash, color, width, mark) => {
          c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash); c.beginPath(); let on = false;
          rows.forEach((o) => { const v = o.r[field]; if (v == null) { on = false; return; } const x = X(o.tr), y = SY(v); if (on) c.lineTo(x, y); else c.moveTo(x, y); on = true; HH.strip.push({ x, y, o, field }); });
          c.stroke(); c.setLineDash([]);
          if (mark) rows.forEach((o) => { const v = o.r[field]; if (v != null) mark(X(o.tr), SY(v)); });
        };
        line('claimed_halfwidth_pct', [3, 3], 'rgba(217,184,120,0.6)', 1.2, null);
        line('moved_next_pct', [], INK, 1.2, rows.length <= 60 ? (x, y) => dot(c, x, y, 1.8, INK) : null);
        c.restore();
        // today
        if (todayIn) {
          c.save(); c.strokeStyle = 'rgba(234,242,255,0.45)'; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(Math.round(xT) + 0.5, P.lane0 - 4); c.lineTo(Math.round(xT) + 0.5, P.s1); c.stroke(); c.restore();
          txt(c, TL.lab, TL.right ? xT - 4 : TL.left ? xT + 4 : xT, P.lane1 + 18, { mono: true, size: N ? 9.5 : 10.5, weight: 700, align: TL.right ? 'right' : TL.left ? 'left' : 'center', color: COL.ink, plate: 'rgba(4,6,12,0.9)' });
          HH.today = { x: xT };
        }
        if (xR < X(TODAY_MS + 1) && st.v1 < TODAY_MS) txt(c, 'today →', xR - 4, P.lane0 + 10, { mono: true, size: 10, align: 'right', color: COL.ink3 });
        HT = HH; st.dirty = false;
      }
      function drawDyn() {
        const c = dctx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
        const h = st.hover;
        if (h && h.row) {
          c.fillStyle = 'rgba(217,184,120,0.07)'; c.fillRect(P.x, h.row.y - Math.max(HT.rowH, 4) / 2, P.w + P.padR, Math.max(HT.rowH, 4));
          if (!h.row.o.up) ring(c, h.row.xp, h.row.y, 6, 'rgba(255,255,255,0.85)', 1.3, false);
        }
        if (h && h.pt) ring(c, h.pt.x, h.pt.y, 5, 'rgba(255,255,255,0.85)', 1.3, false);
        if (st.sel) { const a = Math.min(st.sel.x0, st.sel.x1), b = Math.max(st.sel.x0, st.sel.x1); c.fillStyle = 'rgba(217,184,120,0.08)'; c.fillRect(a, P.y, b - a, P.h); c.strokeStyle = 'rgba(217,184,120,0.5)'; c.strokeRect(a + 0.5, P.y + 0.5, b - a - 1, P.h - 1); }
      }
      function hit(px, py, touch) {
        if (!HT) return null;
        if (py >= P.s0 - 4 && py <= P.s1 + 4) {
          const R = touch ? 18 : 10; let best = null, bd = R * R;
          for (const q of HT.strip) { const d = (q.x - px) ** 2 + (q.y - py) ** 2; if (d < bd) { bd = d; best = q; } }
          return best ? { pt: best, row: HT.rows.find((r) => r.o === best.o) } : null;
        }
        if (py < P.lane0 - 4 || py > P.lane1 + 4 || px < P.x - 6) return null;
        const j = clamp(Math.floor((P.lane1 - py) / HT.rowH), 0, HT.rows.length - 1), row = HT.rows[j];
        if (!row) return null;
        if (px > P.x + P.w + 2) return { row, ai: true };
        if (HT.today && Math.abs(px - HT.today.x) < (touch ? 10 : 5) && Math.abs(py - row.y) > HT.rowH) return { today: true };
        return { row };
      }
      const pctTxt = (v) => (v == null ? null : (v >= 100 ? Math.round(v) : v) + '%');
      function aiText(a) {
        if (!a) return 'No AI-only fit at this cut in the registry.';
        const s = a.pinned === 'upper' ? 'gives no date: its best fit runs to the far edge of the search grid'
          : a.pinned === 'lower' ? 'is pinned at the refit day (the start of the search grid)'
            : a.bounded ? 'has a bounded 95% range (its date is not display-approved, so it is not shown)' : 'has a range unbounded above';
        return '<b>AI-only fit</b> (no Kurzweil points) at the same cut ' + s + '.';
      }
      // true only for the one row the card itself is built from: the card's list, the calendar method, its last refit (OMEGA's
      // last row), with a band actually shown (a fit that is pinned, or a missing card_range, shows no band: nothing to point at)
      function isCardRow(r, G) {
        const oc = OMEGA.of(CARD_LIST);
        return !!(oc && oc.cal && oc.pinned === 'none' && G.g.list === oc.list && G.g.method === 'calendar' && r.list === oc.list && r.method === 'calendar' && r.refit_date === oc.last.refit_date);
      }
      function readout(h) {
        if (h.today) return card('Today', COL.ice, 'Today', fmtMs(TODAY_MS), ['A named date left of this line has passed: a failed forecast (R-b.1), drawn hollow.'], 'data/main_chart.json today');
        const o = h.row.o, r = o.r, G = cur();
        if (h.ai) return card('AI-only fit · ' + esc(G.g.label), '#a9b6cc', 'Refit ' + fmtISO(r.refit_date), null, [aiText(r.ai_only), esc(TRK.ai_only_rule)], 'results/predictions/registry.csv ' + (r.ai_only ? r.ai_only.pred_id : ''));
        const rem = Math.round((o.tp - o.tr) / DAY);
        const ps = [
          'Claimed at this refit (' + fmtISO(r.refit_date) + ', a past claim, not the card\'s range): 95% range ' + fmtISO(r.lo95) + ' to ' + (r.hi95 === 'unbounded' ? 'unbounded' : fmtISO(r.hi95)) + (r.claimed_halfwidth_pct != null ? ' (± ' + pctTxt(r.claimed_halfwidth_pct) + ' of the time the fit said remained)' : '') + '.' + (isCardRow(r, G) ? ' This is the latest refit: the card shows the 50% range (provisional, in-sample), not this claim.' : ''),
          r.pinned === 'none' ? 'Named date minus refit day: ' + fmtDays(rem) + '.' : 'Pinned to the ' + (r.pinned === 'lower' ? 'start' : 'far end') + ' of the search grid: the fit has no interior best date here.',
          r.passed ? '<b>Passed: a failed forecast</b> (R-b.1).' : 'Has not passed yet.',
          r.moved_next_pct != null ? 'By the next refit shown (' + r.moved_next_refit_days + ' days later) the date moved <b>' + pctTxt(r.moved_next_pct) + '</b> of the time the fit said remained.' : null,
          r.moved_latest_pct != null ? 'By the latest refit shown: ' + pctTxt(r.moved_latest_pct) + '.' : null,
          aiText(r.ai_only),
          r.estimate ? 'Inputs include estimated dates.' : null,
        ];
        return card('Refit · ' + esc(G.g.label) + ' ' + badge(r.kind === 'live_refit' ? 'live refit' : 'backtest') + (r.passed ? ' ' + badge('passed', 'b') : ''), AMB,
          'Refit ' + fmtISO(r.refit_date) + (r.pinned === 'upper' ? ': no date (grid edge)' : ': named ' + fmtISO(r.point)), null, ps,
          'results/predictions/registry.csv ' + r.pred_id + ' (display approved in ' + r.display_approved_pr + ')');
      }
      function clampView(a, b) { const L = EX.lim, span = clamp(b - a, 7 * DAY, L[1] - L[0]); if (a < L[0]) a = L[0]; b = a + span; if (b > L[1]) { b = L[1]; a = b - span; } return [a, b]; }
      function setView(a, b) { [st.v0, st.v1] = clampView(a, b); st.anim = null; st.dirty = true; }
      function animateTo(a, b) { const [x, y] = clampView(a, b); st.anim = { a0: st.v0, b0: st.v1, a1: x, b1: y, s: performance.now(), dur: REDUCED ? 1 : 520 }; st.dirty = true; st.hover = null; tip.hide(); }
      const api = {
        plot: () => P, toT: Tx, toX: X, today: () => (TODAY_MS >= st.v0 && TODAY_MS <= st.v1 ? TODAY_MS : null),
        view: () => [st.v0, st.v1], span: () => st.v1 - st.v0, spanOf: (v) => v[1] - v[0], toTIn: (v, x) => v[0] + (x - P.x) / P.w * (v[1] - v[0]),
        place(span, tRef, f) { span = clamp(span, 7 * DAY, EX.lim[1] - EX.lim[0]); const a = tRef - f * span; setView(a, a + span); },
        range(a, b) { if (b - a < 7 * DAY) { const m = (a + b) / 2; a = m - 3.5 * DAY; b = m + 3.5 * DAY; } animateTo(a, b); },
        reset() { animateTo(EX.def[0], EX.def[1]); },
        step: () => 0.3, pinchGain: 1.15,
        zoomBtn(dir) { const tt = api.today(), f = tt != null ? (tt - st.v0) / (st.v1 - st.v0) : 0.5, ref = tt != null ? tt : (st.v0 + st.v1) / 2, span = clamp((st.v1 - st.v0) * (dir < 0 ? 0.5 : 2), 7 * DAY, EX.lim[1] - EX.lim[0]); animateTo(ref - f * span, ref - f * span + span); },
        select(s) { const old = st.sel; st.sel = s; return old; },
        hover(x, y) { const h = hit(x, y, false); st.hover = h; if (h) tip.show(readout(h), x, y, false); else tip.hide(); cv.style.cursor = h ? 'pointer' : 'crosshair'; },
        tap(x, y, touch) { const h = hit(x, y, touch); st.hover = h; if (h) tip.show(readout(h), x, y, touch); else tip.hide(); },
        leave() { st.hover = null; tip.hide(); },
        toast, onUser() { st.hover = null; tip.hide(); },
      };
      attachZoom(cv, api);
      $('#mc-track-in').addEventListener('click', () => api.zoomBtn(-1));
      $('#mc-track-out').addEventListener('click', () => api.zoomBtn(1));
      $('#mc-track-reset').addEventListener('click', () => api.reset());
      function setGroup(k, animate) {
        if (!GROUPS[k]) return;
        st.key = k; st.hover = null; tip.hide(); EX = extent(GROUPS[k]);
        if (animate) animateTo(EX.def[0], EX.def[1]); else setView(EX.def[0], EX.def[1]);
        $$('#mc-track-group button').forEach((b) => b.setAttribute('aria-pressed', String(key(b.dataset.list, b.dataset.method) === k)));
        $$('#mc-track-sum li').forEach((li) => li.classList.toggle('on', key(li.dataset.list, li.dataset.method) === k));
        const G = GROUPS[k];
        cv.setAttribute('aria-label', 'Track record, ' + G.g.label + ': ' + G.rows.length + ' refits of the same fixed method, one row each, from the refit day to the date the fit named then, with the 95% range it claimed at that refit (a past claim); ' + G.rows.filter((o) => o.r.passed).length + ' named dates have passed (failed forecasts, hollow); ' + G.rows.filter((o) => o.r.kind === 'backtest').length + ' of the rows are backtests: today\u2019s method and list rerun on the data up to each refit day, not dates the site showed at the time. Right column: the AI-only fit at the same cut, flags only. Bottom strip: claimed half-width against how far the date moved by the next refit, as a share of the time the fit said remained.');
        st.dirty = true;
      }
      $$('#mc-track-group button').forEach((b) => b.addEventListener('click', () => setGroup(key(b.dataset.list, b.dataset.method), true)));
      // follow the hero's list switch: same method if that list has it, else its first group
      function followHero() {
        if (!B || st.hero === B.st.list) return;
        st.hero = B.st.list;
        const G = cur(); if (G.g.list === st.hero) return;
        const k = GROUPS[key(st.hero, G.g.method)] ? key(st.hero, G.g.method) : ORDER.find((q) => GROUPS[q].g.list === st.hero);
        if (k) setGroup(k, true);
      }
      function renderLegend() {
        const sv = (inner, w) => '<svg width="' + (w || 24) + '" height="14" aria-hidden="true">' + inner + '</svg>';
        $('#mc-legend-track').innerHTML = [
          sv('<line x1="3" y1="3" x2="3" y2="11" stroke="rgba(234,242,255,0.6)"/><line x1="3" y1="7" x2="17" y2="7" stroke="rgba(217,184,120,0.4)"/><circle cx="18" cy="7" r="3.4" fill="' + AMB + '"/>') + 'update day / date it named (still ahead)',
          sv('<circle cx="12" cy="7" r="3.6" fill="none" stroke="' + AMB + '" stroke-width="1.3"/>') + 'date already passed',
          sv('<line x1="2" y1="7" x2="22" y2="7" stroke="rgba(217,184,120,0.55)" stroke-width="2.5"/>') + '95% range it claimed then',
          sv('<line x1="2" y1="7" x2="16" y2="7" stroke="rgba(217,184,120,0.55)" stroke-width="2.5"/><path d="M22 7 L16 3.5 L16 10.5 Z" fill="rgba(217,184,120,0.7)"/>') + 'no date (the fit hit its limit)',
          sv('<circle cx="6" cy="7" r="2.6" fill="rgba(169,182,204,0.8)"/><circle cx="17" cy="7" r="2.6" fill="none" stroke="rgba(169,182,204,0.8)"/>', 24) + 'AI models alone: range, no date',
          sv('<line x1="2" y1="7" x2="15" y2="7" stroke="rgba(169,182,204,0.6)"/><path d="M22 7 L16 3.5 L16 10.5 Z" fill="rgba(169,182,204,0.8)"/>') + 'AI models alone: no date',
          sv('<line x1="2" y1="7" x2="22" y2="7" stroke="rgba(217,184,120,0.7)" stroke-dasharray="3 3" stroke-width="1.3"/>') + 'margin it claimed then',
          sv('<line x1="2" y1="7" x2="22" y2="7" stroke="' + INK + '" stroke-width="1.3"/>') + 'how far it moved at the next update',
        ].map((q) => '<span>' + q + '</span>').join('');
      }
      function frame(t) {
        followHero();
        if (st.anim) { const a = st.anim, k = clamp((t - a.s) / a.dur, 0, 1), e = easeOut(k); st.v0 = a.a0 + (a.a1 - a.a0) * e; st.v1 = a.b0 + (a.b1 - a.b0) * e; if (k >= 1) st.anim = null; st.dirty = true; }
        if (st.dirty) render();
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(stat, 0, 0);
        drawDyn();
      }
      window.addEventListener('resize', () => { DPR = Math.min(2, window.devicePixelRatio || 1); measure(); });
      if (window.ResizeObserver) new ResizeObserver(() => { if (box.clientWidth !== W) measure(); }).observe(box);
      measure(); renderLegend();
      const k0 = B && ORDER.find((q) => GROUPS[q].g.list === B.st.list && GROUPS[q].g.method === 'calendar') || (B && ORDER.find((q) => GROUPS[q].g.list === B.st.list)) || ORDER[0];
      st.hero = B ? B.st.list : null; setGroup(k0, false);
      // scroll-triggered zoom (owner's request, #31): opens on the wider range, settles on its default view once mostly on
      // screen; any touch of the chart or its buttons first cancels it
      { let off = false; const stop = () => { off = true; };
        cv.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') stop(); }, { passive: true });
        cv.addEventListener('keydown', stop);
        { const ou = api.onUser; api.onUser = function () { stop(); return ou.apply(this, arguments); }; }
        $$('#mc-track-group button, #mc-track-in, #mc-track-out, #mc-track-reset').forEach((b) => b.addEventListener('click', stop));
        if (!REDUCED && EX) setView(EX.lim[0], EX.lim[1]);
        whenSeen(box, () => setTimeout(() => {
          if (off || !EX) return;
          const [x, y] = clampView(EX.def[0], EX.def[1]);
          if (REDUCED) { setView(x, y); return; }
          st.anim = { a0: st.v0, b0: st.v1, a1: x, b1: y, s: performance.now(), dur: 1750 }; st.dirty = true;
        }, 600)); }
      return { frame, st, api, box, setGroup, groups: () => ORDER.slice(), P: () => P, ht: () => HT };
    })();
    if (T) charts.push(T);

    // ============================================================ CALENDAR view
    const PACE = ok(D.pace) ? D.pace : null;
    const TW = ok(D.timewave) ? D.timewave : null;
    const ZERO_MS = TW ? Date.parse(TW.anchor_utc) : null;
    // the right limit: a little room after the last test window and, when the track record is shown, after the right edge
    // of the omega band of any list (about two months), so the band is on the first view
    const OMEGA_END = OMEGA.end();
    const TESTS_END = TESTS.length ? TESTS[TESTS.length - 1].t1 : TODAY_MS + DAY;
    const LIM1 = Math.max(TESTS_END + 7 * DAY, OMEGA_END ? OMEGA_END + 60 * DAY : 0);
    const LABEL_END = Math.max(TESTS_END, OMEGA_END || 0);   // calendar labels on the time axis stop here
    const LIM0 = TW ? isoMs(TW.daily.first_day) : Math.min(isoMs(AI_FIRST), ok(D.releases) ? isoMs(D.releases.coverage_from) : TODAY_MS) - YEAR;
    const C = (function () {
      const box = $('#mc-box-cal'), cv = $('#mc-cv-cal'), cvd = $('#mc-cv-cal-dyn');
      if (!box || !cv) return null;
      if (!PACE || !ok(D.releases) || !ok(D.drops) || !ok(D.lab_entry)) { pendingIn(box, 'Calendar data pending: ' + ([D.releases, D.pace, D.drops, D.lab_entry].find((b) => !ok(b)) || {}).message); return null; }
      const ctx = cv.getContext('2d'), dctx = cvd.getContext('2d');
      const tip = makeTip(box), toast = makeToast(box);
      const stat = document.createElement('canvas'), sctx = stat.getContext('2d');
      const PACE0 = isoMs(PACE.first_day), NPACE = PACE.wait_per_lab.length;
      const NLABS = D.releases.labs.length;
      // the default view starts in January of the year after the pace line begins and runs to just past the
      // right edge of the omega band
      const CAL_START = Math.max(isoMs(AI_FIRST), Date.UTC(new Date(PACE0).getUTCFullYear() + 1, 0, 1));
      const VIEWS_C = {
        d7: [TODAY_MS - 3.5 * DAY, TODAY_MS + 3.5 * DAY],
        y2: [TODAY_MS - 2 * YEAR, LIM1],
        ai: [CAL_START, LIM1],
        all: [LIM0, LIM1],
      };
      const st = { mode: 'per_lab', v0: VIEWS_C.ai[0], v1: VIEWS_C.ai[1], anim: null, hover: null, sel: null, dirty: true, changed: true };
      let W = 0, H = 0, N = false, P = null, HT = null, OCC = [];
      const ENTRY = D.lab_entry.rows.map((e, i) => ({ ...e, t: isoMs(e.date) + DAY / 2, n: i + 1 }));
      const DROPS = { per_lab: D.drops.per_lab, pooled: D.drops.pooled };
      const NONE = PACE.none_spans;

      function measure() {
        N = isNarrow(); W = box.clientWidth;
        const gh = TRK ? (N ? 60 : 66) : 0;   // the ghost-trail lane under the lab-entry lane (only with a track record)
        H = (N ? 470 : clamp(Math.round(window.innerHeight * 0.6), 400, 560)) + gh;
        const padL = N ? 44 : 78, padR = N ? 28 : 22, padT = N ? 30 : 32, axisLab = N ? 24 : 26, lane = N ? 50 : 52;
        P = { x: padL, y: padT, w: W - padL - padR, h: H - padT - axisLab - lane - gh };
        P.rug0 = P.y + P.h - 15; P.rug1 = P.y + P.h - 4; P.cTop = P.y + 8; P.cBot = P.y + P.h - 24; P.laneY = P.y + P.h + axisLab + 4;
        P.ghostY = P.laneY + lane - 2; P.ghostH = gh;
        for (const c of [cv, cvd, stat]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
        cv.style.height = H + 'px'; cvd.style.height = H + 'px'; cvd.style.width = W + 'px';
        st.dirty = true;
      }
      const X = (t) => P.x + (t - st.v0) / (st.v1 - st.v0) * P.w;
      const Tx = (x) => st.v0 + (x - P.x) / P.w * (st.v1 - st.v0);
      const inX = (t) => t >= st.v0 && t <= st.v1;
      const SC = () => PACE.scales[st.mode];
      const waits = () => (st.mode === 'per_lab' ? PACE.wait_per_lab : PACE.wait_pooled);
      const counts = () => (st.mode === 'per_lab' ? PACE.n_lab : PACE.n_all);
      function YW(w) { const s = SC(); return P.cTop + (Math.log(s.max_days) - Math.log(w)) / (Math.log(s.max_days) - Math.log(s.min_days)) * (P.cBot - P.cTop); }
      const dayT = (i) => PACE0 + i * DAY;
      const idxAt = (t) => Math.floor((t - PACE0) / DAY);
      function curveMinY(x0, x1) {
        if (Tx(x1) < PACE0 || Tx(x0) > dayT(NPACE)) return Infinity;
        const a = clamp(idxAt(Tx(x0)) - 1, 0, NPACE - 1), b = clamp(idxAt(Tx(x1)) + 1, 0, NPACE - 1), w = waits(); let m = Infinity;
        for (let i = a; i <= b; i++) if (w[i] != null) m = Math.min(m, YW(w[i]));
        return m;
      }
      function timeTicks(minPx) {
        const span = st.v1 - st.v0, ppm = P.w / span;
        const Cs = [['day', 1, DAY], ['day', 2, 2 * DAY], ['week', 1, 7 * DAY], ['month', 1, 30.44 * DAY], ['month', 3, 91.3 * DAY], ['month', 6, 182.6 * DAY],
          ['year', 1, YEAR], ['year', 2, 2 * YEAR], ['year', 5, 5 * YEAR], ['year', 10, 10 * YEAR], ['year', 20, 20 * YEAR], ['year', 25, 25 * YEAR], ['year', 50, 50 * YEAR]];
        const c = Cs.find((q) => q[2] * ppm >= minPx) || Cs[Cs.length - 1];
        const u = c[0], n = c[1], out = [], d0 = new Date(st.v0);
        if (u === 'day') { let t = Math.floor(st.v0 / DAY) * DAY; for (; t <= st.v1 + DAY; t += n * DAY) out.push({ t: t + DAY / 2, u }); }
        else if (u === 'week') { let t = Math.floor(st.v0 / DAY) * DAY; while (new Date(t).getUTCDay() !== 1) t -= DAY; for (; t <= st.v1; t += 7 * DAY) out.push({ t, u }); }
        else if (u === 'month') { let y = d0.getUTCFullYear(), m = d0.getUTCMonth(); m -= m % n; for (;;) { const t = Date.UTC(y, m, 1); if (t > st.v1) break; out.push({ t, u }); m += n; if (m >= 12) { m -= 12; y++; } } }
        else { let y = d0.getUTCFullYear(); y -= ((y % n) + n) % n; for (;;) { const t = Date.UTC(y, 0, 1); if (t > st.v1) break; out.push({ t, u }); y += n; } }
        return { ticks: out.filter((o) => o.t >= st.v0 && o.t <= st.v1), u, span };
      }
      function tickLabel(tk, first, span) {
        const d = new Date(tk.t);
        if (tk.u === 'day') return (span <= 10 * DAY ? WD[d.getUTCDay()] + ' ' : '') + MON[d.getUTCMonth()] + ' ' + d.getUTCDate();
        if (tk.u === 'week') return MON[d.getUTCMonth()] + ' ' + d.getUTCDate();
        if (tk.u === 'month') return d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : (first ? MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear() : MON[d.getUTCMonth()]);
        return String(d.getUTCFullYear());
      }
      // drop labels, longest first; shortened deterministically (D.drops.label_rule)
      function dropVariants(dr) {
        const s2 = (narrow) => { const d = new Date(isoMs(dr.day)); return (narrow ? MON[d.getUTCMonth()] + ' ’' + String(d.getUTCFullYear()).slice(2) : fmtMY(isoMs(dr.day))) + ' · wait ' + Math.round(dr.wait_before) + ' → ' + Math.round(dr.wait_after) + ' days'; };
        if (dr.entering.length) {
          const labs = dr.entering.map(shortLab);
          const full = labs.length === 1 ? labs[0] + ' enters the list' : labs.slice(0, -1).join(', ') + ' and ' + labs[labs.length - 1] + ' enter the list';
          return [[full, s2(false)], [full, s2(true)], [labs[0] + (labs.length > 1 ? ' +' + (labs.length - 1) : '') + ' enter' + (labs.length > 1 ? '' : 's'), s2(true)],
            [labs[0] + (labs.length > 1 ? ' +' + (labs.length - 1) : ''), (labs.length > 1 ? 'enter' : 'enters') + ' the list'], [labs[0] + ' enters', null]];   // narrow phones: keep "the list" on a second line
        }
        // names are never cut mid-word: a name that does not fit gives way to the count of releases
        const names = dr.name_order.map((j) => REL[j].model), n = names.length, R = dr.releases.length;
        const more = (k) => (R > k ? '  +' + (R - k) : '');
        const v = [];
        if (n >= 2) v.push([names[0] + ' · ' + names[1] + more(2), s2(false)]);
        v.push([names[0] + more(1), s2(false)]);
        v.push([names[0] + more(1), s2(true)]);
        v.push([names[0] + (R > 1 ? ' +' + (R - 1) : ''), null]);
        v.push([R + ' releases', s2(true)]);
        v.push([R + ' releases', null]);
        return v;
      }

      function render() {
        const c = sctx;
        c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
        const HH = { drops: [], tests: [], entries: [], today: null, lag: null, none: [], pre: null, gap: null, noPace: null, laneTag: null, testLabels: {}, omega: null, omegaLabel: null, ghost: [] };
        const occ = [];
        const xT = X(TODAY_MS), todayIn = xT >= P.x - 1 && xT <= P.x + P.w + 1;
        const w = waits(), n = counts(), MINF = PACE.full_min_count;

        // --- background regions (clipped to the plot)
        c.save(); c.beginPath(); c.rect(P.x, P.y, P.w, P.h); c.clip();
        if (st.v0 < PACE0) { const xb = Math.min(P.x + P.w, X(PACE0)); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(P.x, P.y, xb - P.x, P.h); HH.pre = { x0: P.x, x1: xb }; }
        if (todayIn || st.v0 > TODAY_MS) { const xa = Math.max(P.x, xT); const g = c.createLinearGradient(xa, 0, P.x + P.w, 0); g.addColorStop(0, 'rgba(223,234,255,0.04)'); g.addColorStop(1, 'rgba(223,234,255,0.012)'); c.fillStyle = g; c.fillRect(xa, P.y, P.x + P.w - xa, P.h); }
        NONE[st.mode].forEach((s) => {   // no counted release in the 90-day window: the line breaks
          const a = isoMs(s.from), b = isoMs(s.to) + DAY; if (b < st.v0 || a > st.v1) return;
          const xa = Math.max(P.x, X(a)), xb = Math.min(P.x + P.w, X(b)); if (xb - xa < 0.5) return;
          c.fillStyle = dots(c); c.fillRect(xa, P.cTop - 4, xb - xa, P.rug0 - P.cTop); HH.none.push({ x0: xa, x1: xb, s });
        });
        { const a = LAG_MS, b = Math.min(TODAY_MS, st.v1);   // Epoch-lag zone: from its start to today (past only)
          if (b > st.v0 && a < st.v1) { const xa = Math.max(P.x, X(a)), xb = Math.min(P.x + P.w, X(b)); if (xb - xa > 0.5) { c.fillStyle = hatch(c); c.fillRect(xa, P.y, xb - xa, P.h); c.fillStyle = 'rgba(201,214,238,0.03)'; c.fillRect(xa, P.y, xb - xa, P.h); HH.lag = { x0: xa, x1: xb }; } } }
        c.restore();

        // --- grid + ticks
        const TK = timeTicks(N ? 64 : 88);
        c.lineWidth = 1;
        const keep = todayIn ? { a: xT - (N ? 22 : 26), b: xT + (N ? 22 : 26) } : null;   // the TODAY pulse sits in the tick row
        let yearShown = false;
        const lastT = LABEL_END;
        TK.ticks.forEach((tk, i) => {
          if (tk.t >= lastT) return;   // no calendar labels after the last registered test window or the omega band
          const x = Math.round(X(tk.t)) + 0.5, major = tk.u === 'month' && new Date(tk.t).getUTCMonth() === 0;
          c.strokeStyle = major ? 'rgba(150,190,255,0.12)' : 'rgba(150,190,255,0.06)'; c.beginPath(); c.moveTo(x, P.y); c.lineTo(x, P.y + P.h); c.stroke();
          c.strokeStyle = 'rgba(150,190,255,0.35)'; c.beginPath(); c.moveTo(x, P.y + P.h); c.lineTo(x, P.y + P.h + 4); c.stroke();
          const lab = tickLabel(tk, i === 0, TK.span), lw = tw(c, lab, N ? 10 : 11, major ? 650 : 500, true);
          if (x - lw / 2 < 2 || x + lw / 2 > W - 2) return;
          if (keep && x - lw / 2 < keep.b && x + lw / 2 > keep.a) return;
          txt(c, lab, x, P.y + P.h + 17, { mono: true, size: N ? 10 : 11, align: 'center', color: major ? COL.ink : COL.ink2, weight: major ? 650 : 500 });
          if (/\d{4}/.test(lab)) yearShown = true;
        });
        if (!yearShown) txt(c, String(new Date(st.v0).getUTCFullYear()), P.x - 7, P.y + P.h + 17, { mono: true, size: N ? 10 : 11, align: 'right', color: COL.ink, weight: 650 });   // a zoomed window still names its year
        const s = SC();
        const YT = st.mode === 'per_lab'
          ? [[30.44, '1 month', '1 mo'], [61, '2 months', '2 mo'], [91.31, '3 months', '3 mo'], [182.6, '6 months', '6 mo'], [YRD, '1 year', '1 yr']]
          : [[3, '3 days', '3 d'], [7, '1 week', '1 wk'], [14, '2 weeks', '2 wk'], [30.44, '1 month', '1 mo'], [91.31, '3 months', '3 mo']];
        YT.forEach(([v, l, sl]) => {
          if (v < s.min_days || v > s.max_days) return;
          const y = Math.round(YW(v)) + 0.5;
          c.strokeStyle = 'rgba(150,190,255,0.07)'; c.beginPath(); c.moveTo(P.x, y); c.lineTo(P.x + P.w, y); c.stroke();
          txt(c, N ? sl : l, P.x - 7, y + 4, { mono: true, size: N ? 10 : 11, align: 'right', color: COL.ink2 });
        });

        // --- registered test bands (after today: the only things drawn)
        TESTS.forEach((T) => {
          const x0 = X(T.t0), x1 = X(T.t1);
          if (x1 < P.x || x0 > P.x + P.w) return;
          const a = Math.max(P.x, x0), b = Math.min(P.x + P.w, x1), bw = Math.max(2, b - a);
          const g = c.createLinearGradient(0, P.y, 0, P.y + P.h);
          g.addColorStop(0, 'rgba(223,234,255,0.17)'); g.addColorStop(0.6, 'rgba(223,234,255,0.06)'); g.addColorStop(1, 'rgba(223,234,255,0.1)');
          c.fillStyle = g; c.fillRect(a, P.y, bw, P.h);
          c.save(); c.shadowColor = COL.ice; c.shadowBlur = bw > 18 ? 6 : 3; c.strokeStyle = bw > 18 ? 'rgba(223,234,255,0.5)' : 'rgba(223,234,255,0.4)'; c.lineWidth = 1; if (bw > 18) c.setLineDash([4, 3]); c.beginPath();   // band edges dashed: only TODAY is a solid line
          if (x0 >= P.x) { c.moveTo(Math.round(x0) + 0.5, P.y); c.lineTo(Math.round(x0) + 0.5, P.y + P.h); }
          if (x1 <= P.x + P.w) { c.moveTo(Math.round(x1) - 0.5, P.y); c.lineTo(Math.round(x1) - 0.5, P.y + P.h); }
          c.stroke(); c.restore();
          HH.tests.push({ x0: a, x1: a + bw, T });
        });

        // --- omega band (track record only): the card's range (calibrated 50% when card_range is ok) for the card's list (one omega point whatever the list on show), a glowing band on
        //     the time axis; a fitted estimate, drawn after today next to the two registered windows
        const OM = TRK ? OMEGA.of(CARD_LIST) : null, omOn = !!OM && OM.pinned !== 'upper', omBand = omOn && !!OM.cal;
        if (omBand) {
          const xlo = X(OM.tlo), xhi = isFinite(OM.thi) ? X(OM.thi) : P.x + P.w + 40;
          if (xhi >= P.x && xlo <= P.x + P.w) {
            const a = Math.max(P.x, xlo), b = Math.min(P.x + P.w, xhi), bw = Math.max(3, b - a);
            c.save(); c.beginPath(); c.rect(P.x, P.y, P.w, P.h); c.clip();
            const g = c.createLinearGradient(0, P.y, 0, P.y + P.h);
            g.addColorStop(0, 'rgba(255,200,97,0.06)'); g.addColorStop(0.7, 'rgba(255,200,97,0.16)'); g.addColorStop(1, 'rgba(255,200,97,0.34)');
            c.fillStyle = g; c.fillRect(a, P.y, bw, P.h);
            c.shadowColor = COL.omega; c.shadowBlur = 12; c.strokeStyle = 'rgba(255,214,140,0.85)'; c.lineWidth = 1; c.beginPath();
            if (xlo >= P.x) { c.moveTo(Math.round(xlo) + 0.5, P.y); c.lineTo(Math.round(xlo) + 0.5, P.y + P.h); }
            if (isFinite(OM.thi) && xhi <= P.x + P.w) { c.moveTo(Math.round(xhi) - 0.5, P.y); c.lineTo(Math.round(xhi) - 0.5, P.y + P.h); }
            c.stroke(); c.restore();
            c.save(); c.shadowColor = COL.omega; c.shadowBlur = 14; c.fillStyle = 'rgba(255,206,120,0.95)'; c.fillRect(a, P.y + P.h - 3, bw, 6);
            if (!isFinite(OM.thi)) { c.beginPath(); c.moveTo(P.x + P.w, P.y + P.h); c.lineTo(P.x + P.w - 9, P.y + P.h - 6); c.lineTo(P.x + P.w - 9, P.y + P.h + 6); c.closePath(); c.fill(); }
            c.restore();
            HH.omega = { x0: a, x1: a + bw };
          }
        }

        // --- lab entry lines (faint)
        c.save(); c.beginPath(); c.rect(P.x, P.y, P.w, P.h); c.clip();
        ENTRY.forEach((e) => { if (!inX(e.t)) return; const x = Math.round(X(e.t)) + 0.5; c.strokeStyle = 'rgba(160,143,255,0.28)'; c.setLineDash([2, 4]); c.beginPath(); c.moveTo(x, P.cTop - 4); c.lineTo(x, P.y + P.h); c.stroke(); c.setLineDash([]); });
        c.restore();

        // --- pace line (clipped; ends at the last listed release)
        c.save(); c.beginPath(); c.rect(P.x, P.y, P.w, P.h); c.clip();
        const i0 = clamp(idxAt(st.v0) - 1, 0, NPACE - 1), i1 = clamp(idxAt(st.v1) + 1, 0, NPACE - 1);
        if (dayT(NPACE) > st.v0 && PACE0 < st.v1) {
          const segs = []; let cur = null;
          for (let i = i0; i <= i1; i++) {
            if (w[i] == null) { if (cur) { segs.push(cur); cur = null; } continue; }
            const cls = dayT(i) >= LAG_MS ? 'lag' : n[i] < MINF ? 'dim' : 'full';
            const xs = X(dayT(i)), xe = X(dayT(i + 1)), y = YW(w[i]);
            if (!cur || cur.cls !== cls) { const prev = cur; if (prev) { prev.pts.push([xs, prev.ly]); segs.push(prev); } cur = { cls, pts: prev ? [[xs, prev.ly], [xs, y]] : [[xs, y]] }; }
            else if (cur.ly !== y) { cur.pts.push([xs, cur.ly]); cur.pts.push([xs, y]); }
            cur.ly = y; cur.lx = xe;
          }
          if (cur) segs.push(cur);
          const g = c.createLinearGradient(0, P.cTop, 0, P.rug0);
          g.addColorStop(0, 'rgba(56,217,245,0)'); g.addColorStop(0.55, 'rgba(56,217,245,0.05)'); g.addColorStop(1, 'rgba(56,217,245,0.15)');
          segs.forEach((sg) => {
            c.beginPath(); c.moveTo(sg.pts[0][0], P.rug0 - 2); sg.pts.forEach((p) => c.lineTo(p[0], p[1])); c.lineTo(sg.lx, sg.ly); c.lineTo(sg.lx, P.rug0 - 2); c.closePath();
            c.fillStyle = sg.cls === 'full' ? g : 'rgba(56,217,245,0.04)'; c.fill();
          });
          const stroke = (sg, lw, a, blur) => {
            c.save(); c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = 'rgba(56,217,245,' + a + ')';
            if (blur) { c.shadowColor = COL.ai; c.shadowBlur = blur; }
            if (sg.cls === 'lag') c.setLineDash([5, 3]);
            c.beginPath(); c.moveTo(sg.pts[0][0], sg.pts[0][1]); sg.pts.forEach((p) => c.lineTo(p[0], p[1])); c.lineTo(sg.lx, sg.ly); c.stroke(); c.restore();
          };
          segs.forEach((sg) => { if (sg.cls !== 'dim') stroke(sg, 5, 0.16, 16); });
          segs.forEach((sg) => stroke(sg, sg.cls === 'dim' ? 1.2 : 2.1, sg.cls === 'dim' ? 0.42 : 0.98, sg.cls === 'dim' ? 0 : 6));
          const tEnd = dayT(NPACE);   // end cap at the last listed release: nothing after it
          if (inX(tEnd) && w[NPACE - 1] != null) { const x = X(tEnd), y = YW(w[NPACE - 1]); c.save(); c.shadowColor = COL.ai; c.shadowBlur = 8; dot(c, x, y, 3.2, COL.ai); c.restore(); }
        }
        // release rug
        c.strokeStyle = 'rgba(56,217,245,0.6)'; c.lineWidth = 1; c.beginPath(); let lastX = -9;
        for (let i = 0; i < REL.length; i++) { const t = relMs[i]; if (!inX(t)) continue; const x = Math.round(X(t)) + 0.5; if (x === lastX) continue; lastX = x; c.moveTo(x, P.rug0); c.lineTo(x, P.rug1); }
        c.stroke();
        c.strokeStyle = 'rgba(150,190,255,0.09)'; c.lineWidth = 1; c.beginPath(); c.moveTo(P.x, P.rug0 - 3.5); c.lineTo(P.x + P.w, P.rug0 - 3.5); c.stroke();
        // open stretch since the last recorded release: a neutral dotted bracket IN THE RELEASE LANE (no curve, no value)
        { const a = LAST_REL_MS + DAY / 2, b = TODAY_MS;
          if (b > st.v0 && a < st.v1) {
            const xa = Math.max(P.x, X(a)), xb = Math.min(P.x + P.w, X(b)), y = Math.round((P.rug0 + P.rug1) / 2) + 0.5;
            c.strokeStyle = 'rgba(201,214,238,0.62)'; c.setLineDash([2, 3]); c.lineWidth = 1.2; c.beginPath(); c.moveTo(xa, y); c.lineTo(xb, y); c.stroke(); c.setLineDash([]);
            c.beginPath(); if (X(a) >= P.x) { c.moveTo(xa, P.rug0); c.lineTo(xa, P.rug1); } if (X(b) <= P.x + P.w) { c.moveTo(xb, P.rug0); c.lineTo(xb, P.rug1); } c.stroke();
            HH.gap = { x0: xa, x1: xb, y };
          } }
        c.restore();
        c.strokeStyle = 'rgba(150,190,255,0.38)'; c.beginPath(); c.moveTo(P.x, P.y + P.h + 0.5); c.lineTo(P.x + P.w, P.y + P.h + 0.5); c.stroke();

        // --- the lane under the axis: lab entries (provisional) and, when a band is too narrow to name, the test tag
        { const y = P.laneY + 10, placed = [];
          c.strokeStyle = 'rgba(160,143,255,0.25)'; c.beginPath(); c.moveTo(P.x, y + 0.5); c.lineTo(P.x + P.w, y + 0.5); c.stroke();
          txt(c, 'LABS', P.x - 7, y + (N ? 4 : -1), { mono: true, size: N ? 9 : 9.5, align: 'right', color: '#c9bfff', weight: 600 });
          if (!N) txt(c, 'TRACKED', P.x - 7, y + 10, { mono: true, size: 9.5, align: 'right', color: '#c9bfff', weight: 600 });
          placed.push({ x0: 0, x1: P.x - 1, y0: y - 14, y1: y + 40 });   // the lane title's own box: no entry label may enter it
          const narrowTests = HH.tests.filter((v) => v.x1 - v.x0 < 40);
          if (narrowTests.length) {
            const lab = (N ? '↑ TEST ' : '↑ PLANNED TEST ') + narrowTests.map((v) => v.T.id).join(' · ') + (N ? '' : ' (LEARN MORE)');
            const lw = tw(c, lab, N ? 9.5 : 10, 700, true);
            const xr = Math.min(W - 4, Math.max(...narrowTests.map((v) => v.x1)) + 2);
            const diamonds = ENTRY.filter((e) => inX(e.t)).map((e) => X(e.t));
            const rowY = diamonds.some((x) => x > xr - lw - 8 && x < xr + 8) ? y + 30 : y + 4;
            txt(c, lab, xr, rowY, { mono: true, size: N ? 9.5 : 10, weight: 700, align: 'right', color: COL.ice });
            const b = { x0: xr - lw - 4, x1: xr + 4, y0: rowY - 11, y1: rowY + 3 };
            b.T = narrowTests[0].T; placed.push(b); HH.laneTag = b; narrowTests.forEach((v) => { HH.testLabels[v.T.id] = 'lane'; });
          }
          ENTRY.forEach((e) => {
            if (!inX(e.t)) return;
            const x = X(e.t);
            c.save(); c.shadowColor = COL.kurz; c.shadowBlur = 6; c.fillStyle = '#c9bfff';
            c.beginPath(); c.moveTo(x, y - 4.5); c.lineTo(x + 4.5, y); c.lineTo(x, y + 4.5); c.lineTo(x - 4.5, y); c.closePath(); c.fill(); c.restore();
            HH.entries.push({ x, y, e });
            const lab = shortLab(e.lab) + ' (' + e.n + ')', lw = tw(c, lab, N ? 9.5 : 10.5, 500, false);
            for (const row of [0, 1]) {
              const yy = y + 17 + row * 13, x0 = clamp(x - lw / 2, P.x + 4, Math.min(W - 2, P.x + P.w + 18) - lw), b = { x0: x0 - 3, x1: x0 + lw + 3, y0: yy - 10, y1: yy + 2 };
              if (placed.some((p) => hitBox(b, p))) continue;
              placed.push(b); txt(c, lab, x0, yy, { size: N ? 9.5 : 10.5, color: '#c9bfff' }); break;
            }
          });
          if (!ENTRY.some((e) => inX(e.t))) {
            const act = ENTRY.filter((e) => e.t <= st.v0).length;
            const s0 = act ? act + ' of ' + NLABS + ' labs tracked by this point' : 'no lab tracked yet';
            const s1 = act ? act + ' of ' + NLABS + ' labs in the list' : s0;
            const lim = HH.laneTag ? HH.laneTag.x0 - 10 : P.x + P.w;
            const sOut = [s0, s1].find((q) => P.x + 6 + tw(c, q, N ? 9.5 : 10.5, 500) < lim);
            if (sOut) txt(c, sOut, P.x + 6, y + 17, { size: N ? 9.5 : 10.5, color: '#9d93d6' });
          }
        }

        // --- the ghost-trail lane (track record only): where the fit pointed at each refit. x = the date it named, y = the
        //     refit's own day (oldest at the bottom, the latest on top); a faint line runs from the refit day to the
        //     named date. Hollow = the named date has passed (a failed forecast). It keeps moving later.
        if (TRK && P.ghostH) {
          const gy0 = P.ghostY, gh = P.ghostH, top = gy0 + 20, bot = gy0 + gh - 8;
          c.strokeStyle = 'rgba(255,200,97,0.22)'; c.beginPath(); c.moveTo(P.x, gy0 + 0.5); c.lineTo(P.x + P.w, gy0 + 0.5); c.stroke();
          if (!OM) {
            txt(c, 'no omega-point refits for this list', P.x + 6, gy0 + 22, { size: N ? 9.5 : 10.5, color: COL.ink3 });
          } else {
            const t0 = OM.trail[0].tr, t1 = OM.trail[OM.trail.length - 1].tr, yR = (tr) => (t1 > t0 ? bot - (tr - t0) / (t1 - t0) * (bot - top) : bot);
            c.save(); c.beginPath(); c.rect(P.x, gy0 + 1, P.w, gh - 2); c.clip();
            if (todayIn) { c.strokeStyle = 'rgba(234,242,255,0.22)'; c.beginPath(); c.moveTo(Math.round(xT) + 0.5, gy0 + 1); c.lineTo(Math.round(xT) + 0.5, gy0 + gh - 2); c.stroke(); }
            OM.trail.forEach((q) => {
              if (q.up) return;
              const xa = X(q.tr), xb = X(q.tm);
              if (Math.max(xa, xb) < P.x - 4 || Math.min(xa, xb) > P.x + P.w + 4) return;
              const y = yR(q.tr);
              c.strokeStyle = 'rgba(255,200,97,' + (q.low ? 0.05 : 0.12) + ')'; c.lineWidth = 1; c.beginPath(); c.moveTo(xa, y); c.lineTo(xb, y); c.stroke();
            });
            OM.trail.forEach((q, i) => {
              if (q.up) return;
              const x = X(q.tm), y = yR(q.tr), latest = i === OM.trail.length - 1;
              if (x < P.x - 4 || x > P.x + P.w + 4) return;
              if (latest) { c.save(); c.shadowColor = COL.omega; c.shadowBlur = 10; dot(c, x, y, 3.8, '#fff3d0'); c.restore(); }
              else if (q.passed) { c.strokeStyle = 'rgba(255,200,97,' + (q.low ? 0.3 : 0.62) + ')'; c.lineWidth = 1.1; c.beginPath(); c.arc(x, y, 2, 0, 7); c.stroke(); }
              else dot(c, x, y, 2.4, 'rgba(255,200,97,0.9)');
              HH.ghost.push({ x, y, q });
            });
            c.restore();
            const caps = N ? ['where the date pointed · it keeps moving later', 'it keeps moving later'] : ['where the date pointed at each update · it keeps moving later', 'where the date pointed · it keeps moving later', 'it keeps moving later'];
            const capW = P.w * (N ? 0.7 : 0.6), cap = caps.find((q) => tw(c, q, N ? 9.5 : 10.5, 500, true) < capW);
            if (cap) txt(c, cap, P.x + 6, gy0 + 14, { mono: true, size: N ? 9.5 : 10.5, color: '#ffd9a0', plate: 'rgba(5,8,16,0.82)' });
            txt(c, 'newest', P.x - 7, top + 4, { mono: true, size: 9, align: 'right', color: COL.ink3 });
            txt(c, 'oldest', P.x - 7, bot + 3, { mono: true, size: 9, align: 'right', color: COL.ink3 });
          }
        }

        // --- TODAY line + label
        if (todayIn) {
          c.save(); c.shadowColor = '#bfefff'; c.shadowBlur = 10; c.strokeStyle = 'rgba(234,242,255,0.85)'; c.lineWidth = 1.4;
          c.beginPath(); c.moveTo(Math.round(xT) + 0.5, P.y - 4); c.lineTo(Math.round(xT) + 0.5, P.y + P.h + 6); c.stroke(); c.restore();
          const lab = 'TODAY · ' + (N ? fmtMD(TODAY_MS) : fmtMs(TODAY_MS)).toUpperCase();
          const lw = tw(c, lab, N ? 10.5 : 11.5, 700, true);
          let lx = xT, al = 'center';
          if (xT + lw / 2 > W - 4) { lx = xT - 6; al = 'right'; } else if (xT - lw / 2 < 4) { lx = xT + 6; al = 'left'; }
          txt(c, lab, lx, P.y - 12, { mono: true, size: N ? 10.5 : 11.5, weight: 700, align: al, color: '#ffffff', glow: 'rgba(56,217,245,0.9)', glowB: 12 });
          occ.push({ x0: xT - 8, x1: xT + 8, y0: P.y, y1: P.y + P.h, today: true });
          HH.today = { x: xT, y: P.y + P.h + 12 };   // the pulse: in the tick row, on the time axis
          HH.todayLab = al === 'right' ? { x0: lx - lw, x1: lx } : al === 'left' ? { x0: lx, x1: lx + lw } : { x0: lx - lw / 2, x1: lx + lw / 2 };
        } else {
          const right = st.v1 < TODAY_MS, lw = tw(c, right ? 'TODAY →' : '← TODAY', N ? 10.5 : 11.5, 700, true);
          txt(c, right ? 'TODAY →' : '← TODAY', right ? P.x + P.w - 4 : P.x + 4, P.y - 12, { mono: true, size: N ? 10.5 : 11.5, weight: 700, align: right ? 'right' : 'left', color: COL.ink });
          HH.todayLab = right ? { x0: P.x + P.w - 4 - lw, x1: P.x + P.w - 4 } : { x0: P.x + 4, x1: P.x + 4 + lw };
        }
        // y-axis title: what the value is, per mode
        { const yt = st.mode === 'per_lab'
            ? (N ? ['↑ WAIT PER LAB (LOG)'] : ['↑ WAIT BETWEEN NEW MODELS, PER LAB (LOG)', '↑ WAIT PER LAB (LOG)'])
            : (N ? ['↑ WAIT, ANY LAB (LOG)'] : ['↑ WAIT BETWEEN NEW MODELS, ANY OF ' + NLABS + ' LABS (LOG)', '↑ WAIT, ANY LAB (LOG)']);
          const x0 = N ? 8 : 12;
          for (const q of yt) { const w0 = tw(c, q, N ? 9.5 : 10.5, 600, true); if (HH.todayLab && x0 + w0 + 12 > HH.todayLab.x0 && x0 < HH.todayLab.x1) continue; txt(c, q, x0, P.y - 12, { mono: true, size: N ? 9.5 : 10.5, weight: 600, color: COL.ink3 }); break; } }

        // --- annotations: tests first (labelled at every zoom), then drops, then notes
        const inPlot = (b) => b.x0 >= P.x + 2 && b.x1 <= P.x + P.w - 2 && b.y0 >= P.y + 2 && b.y1 <= P.y + P.h - 2;
        const clearOfData = (b) => b.y1 + 6 < curveMinY(b.x0 - 4, b.x1 + 4);
        HH.tests.forEach((v) => {
          const bw = v.x1 - v.x0;
          const lx0 = todayIn && xT >= v.x0 - 1 && xT < v.x1 - 40 ? Math.max(v.x0, xT + 10) : v.x0 + 8;   // keep clear of the TODAY line
          if (v.x1 - lx0 >= (N ? 142 : 182)) {   // wide: the caption sits inside its band, where no data is drawn
            const maxW = v.x1 - lx0 - 8, sz = N ? 11 : 12, lh = N ? 14 : 15.5;
            const head = 'TEST ' + v.T.id + ' · ' + v.T.when.toUpperCase() + ' · REGISTERED, TWO-SIDED';
            const headFit = [head, 'TEST ' + v.T.id + ' · ' + v.T.when.toUpperCase(), 'TEST ' + v.T.id].find((q) => tw(c, q, N ? 9.5 : 10, 700, true) <= maxW);
            txt(c, headFit, lx0, P.y + 16, { mono: true, size: N ? 9.5 : 10, weight: 700, color: COL.ice });
            const lines = wrap(c, 'CVE count. ' + v.T.text, maxW, sz, 550);
            const maxLines = Math.max(1, Math.floor((P.rug0 - 20 - (P.y + 32)) / lh));
            const shown = lines.slice(0, maxLines);
            if (lines.length > maxLines) shown[maxLines - 1] = shown[maxLines - 1].replace(/\s*\S*$/, ' …');
            shown.forEach((q, i) => txt(c, q, lx0, P.y + 32 + i * lh, { size: sz, weight: i ? 500 : 600, color: COL.ink, halo: true }));
            occ.push({ x0: v.x0, x1: v.x1, y0: P.y, y1: P.y + 36 + shown.length * lh }); HH.testLabels[v.T.id] = 'caption';
          } else if (bw >= 40) {
            txt(c, 'TEST ' + v.T.id, (v.x0 + v.x1) / 2, P.y + 14, { mono: true, size: 9.5, weight: 700, align: 'center', color: COL.ice });
            occ.push({ x0: v.x0, x1: v.x1, y0: P.y, y1: P.y + 18 }); HH.testLabels[v.T.id] = 'tag';
          }
        });
        // omega label and marker: the latest refit's named date and calibrated 50% range (date alone when there is no range), top right (it may cross TODAY's line,
        // never data or another label); the shortest wording that fits wins, down to the date range alone
        if (omOn) {
          const xp = X(OM.tm), inV = xp >= P.x + 2 && xp <= P.x + P.w - 2, yAx = P.y + P.h;
          const pt = fmtISO(OM.date), rg = rangeSpan(OM), rw = '50% range ';
          const NA = 'a fitted estimate';
          const vars = OM.cal ? [['Omega point: ' + pt + ' · ' + rw + rg, NA], ['Omega ' + pt + ' · ' + rg, NA], [rw + rg, NA], [rg, null], [pt + ' (est.)', null]] : [['Omega point: ' + pt, NA], [pt + ' (est.)', null]];
          const s1 = N ? 10.5 : 12, s2 = N ? 9.5 : 10.5, others = occ.filter((o) => !o.today);
          let placed = null;
          if (OM.cal ? OM.thi >= st.v0 && OM.tlo <= st.v1 : OM.tm >= st.v0 && OM.tm <= st.v1) {
            for (const [l1, l2] of vars) {
              const w1 = tw(c, l1, s1, 650), w2 = l2 ? tw(c, l2, s2, 500, true) : 0, bw2 = Math.max(w1, w2) + 14, bh = l2 ? 36 : 22;
              for (let top = P.y + 6; top <= P.y + 6 + 40; top += 8) {
                const b = { x0: P.x + P.w - 6 - bw2, x1: P.x + P.w - 6, y0: top, y1: top + bh };
                if (b.x0 < P.x + 4 || others.some((o) => hitBox(b, o)) || !clearOfData(b)) continue;
                placed = { b, l1, l2 }; break;
              }
              if (placed) break;
            }
          }
          c.save();
          c.strokeStyle = 'rgba(255,222,160,0.9)'; c.lineWidth = 1; c.setLineDash([2, 3]); c.shadowColor = COL.omega; c.shadowBlur = 6;
          if (inV) {
            c.beginPath(); c.moveTo(xp, yAx - 5); c.lineTo(xp, placed ? placed.b.y1 : P.y + 14);
            if (placed) c.lineTo(clamp(xp, placed.b.x0 + 4, placed.b.x1 - 4), placed.b.y1);
            c.stroke();
          }
          c.restore();
          if (inV) {   // the bright marker on the axis
            c.save(); c.shadowColor = COL.omega; c.shadowBlur = 14; c.fillStyle = '#fff3d0'; c.strokeStyle = COL.omega; c.lineWidth = 1.6;
            c.beginPath(); c.moveTo(xp, yAx - 7); c.lineTo(xp + 6, yAx); c.lineTo(xp, yAx + 7); c.lineTo(xp - 6, yAx); c.closePath(); c.fill(); c.stroke(); c.restore();
            HH.omegaMark = { x: xp, y: yAx };
          }
          if (placed) {
            const b = placed.b;
            c.fillStyle = 'rgba(4,8,16,0.88)'; rr(c, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, 6); c.fill();
            c.strokeStyle = 'rgba(255,200,97,0.6)'; c.lineWidth = 1; rr(c, b.x0 + 0.5, b.y0 + 0.5, b.x1 - b.x0 - 1, b.y1 - b.y0 - 1, 6); c.stroke();
            txt(c, placed.l1, b.x0 + 7, b.y0 + 15, { size: s1, weight: 650, color: '#ffe2a8' });
            if (placed.l2) txt(c, placed.l2, b.x0 + 7, b.y0 + 29, { size: s2, mono: true, color: COL.ink2 });
            occ.push(b); HH.omegaLabel = b;
          }
          if (HH.omega && inV) occ.push({ x0: xp - 8, x1: xp + 8, y0: P.y, y1: P.y + P.h });
        }
        // drops: rank order, shorten to fit, stop at the first that does not fit
        const maxDrops = N ? 2 : 5, sz1 = N ? 11.5 : 12.5, sz2 = N ? 10 : 10.5;
        for (const dr of DROPS[st.mode]) {
          if (HH.drops.length >= maxDrops) break;
          const t = isoMs(dr.day) + DAY / 2;
          if (!inX(t)) continue;
          const x = X(t), y = YW(dr.wait_after);
          if (x < P.x + 4 || x > P.x + P.w - 4) continue;
          let placedB = null, used = null;
          for (const [l1, l2] of dropVariants(dr)) {
            const w1 = tw(c, l1, sz1, 650), w2 = l2 ? tw(c, l2, sz2, 500, true) : 0, bw = Math.max(w1, w2) + 14, bh = l2 ? 36 : 22;
            // hang the label as high as it fits above the data (lanes from the top down), a stem down to the drop
            for (let top = P.y + 20; top + bh <= y - 22; top += 8) {
              for (const bx of [x - bw / 2, x - bw + 18, x - 18, x + 6, x - bw - 6]) {
                const b = { x0: bx, x1: bx + bw, y0: top, y1: top + bh }, stem = { x0: x - 2, x1: x + 2, y0: b.y1, y1: y - 5 };
                if (!inPlot(b) || occ.some((o) => hitBox(b, o) || hitBox(stem, o)) || !clearOfData(b)) continue;
                placedB = b; break;
              }
              if (placedB) break;
            }
            if (placedB) { used = [l1, l2]; break; }
          }
          if (!placedB) break;   // never label a lower-ranked drop in its place
          const b = placedB;
          c.save(); c.strokeStyle = 'rgba(56,217,245,0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x, b.y1); c.lineTo(clamp(x, b.x0 + 4, b.x1 - 4), b.y1); c.stroke(); c.restore();
          c.save(); c.shadowColor = COL.ai; c.shadowBlur = 10; dot(c, x, y, 3.4, '#ffffff'); c.restore(); dot(c, x, y, 1.8, COL.ai);
          c.fillStyle = 'rgba(4,8,16,0.86)'; rr(c, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, 6); c.fill();
          c.save(); if (!dr.entering.length) c.setLineDash([3, 3]);   // dashed = placeholder names, pending release-tracker #4
          c.strokeStyle = dr.entering.length ? 'rgba(201,191,255,0.45)' : 'rgba(255,210,122,0.5)'; rr(c, b.x0 + 0.5, b.y0 + 0.5, b.x1 - b.x0 - 1, b.y1 - b.y0 - 1, 6); c.stroke(); c.restore();
          txt(c, used[0], b.x0 + 7, b.y0 + 15, { size: sz1, weight: 650, color: dr.entering.length ? '#ddd6ff' : COL.ink });
          if (used[1]) txt(c, used[1], b.x0 + 7, b.y0 + 30, { size: sz2, mono: true, color: COL.ink2 });
          occ.push(b); occ.push({ x0: x - 4, x1: x + 4, y0: b.y1, y1: y });
          HH.drops.push({ ...b, dr, used });
        }
        // notes for what is off screen or not drawn
        const note = (ss, x, y, al, col) => {
          for (const q of [].concat(ss)) {
            const w0 = tw(c, q, 10.5, 500, true); const b = { x0: (al === 'right' ? x - w0 : x) - 4, x1: (al === 'right' ? x : x + w0) + 4, y0: y - 12, y1: y + 4 };
            if (b.x0 < P.x || b.x1 > P.x + P.w || occ.some((o) => hitBox(b, o))) continue;
            txt(c, q, x, y, { mono: true, size: 10.5, color: col || COL.ai, align: al, plate: 'rgba(5,8,16,0.82)' }); occ.push(b); return;
          }
        };
        // a window wholly after the last pace day has no line to show (the line ends at the last recorded release): say so
        // in a plate in the middle of the plot, with the open stretch, so a 7-day view is never an unexplained blank
        if (OPEN && dayT(NPACE) <= st.v0) {
          const msg = 'No pace line in this window. The last recorded release was ' + fmtISO(D.releases.last_release) + ' (' + OPEN.days_at_today + ' days ago), where the ' + PACE.window_days + '-day pace line ends.' + (N ? '' : ' Zoom out to see the line.');
          const sz = N ? 11 : 12.5, lh = sz + 5, ls = wrap(c, msg, Math.min(P.w - 32, N ? 250 : 430), sz, 500, false);
          const bw = Math.max.apply(null, ls.map((q) => c.measureText(q).width)) + 24, bh = ls.length * lh + 14;
          const bx = P.x + (P.w - bw) / 2, by = P.y + P.h * (N ? 0.36 : 0.4);
          c.save(); c.fillStyle = 'rgba(5,8,16,0.9)'; rr(c, bx, by, bw, bh, 8); c.fill();
          c.strokeStyle = 'rgba(56,217,245,0.45)'; c.lineWidth = 1; rr(c, bx + 0.5, by + 0.5, bw - 1, bh - 1, 8); c.stroke(); c.restore();
          ls.forEach((q, i) => txt(c, q, P.x + P.w / 2, by + 18 + i * lh, { size: sz, align: 'center', color: i === 0 ? COL.ink : COL.ink2, weight: i === 0 ? 600 : 500 }));
          HH.noPace = { x0: bx, x1: bx + bw, y0: by, y1: by + bh, text: ls.join(' ') }; occ.push(HH.noPace);
        }
        if (dayT(NPACE) < st.v0) note((N ? '← line ends ' : '← pace line ends ') + fmtISO(D.releases.last_release) + (N ? '' : ' (last recorded release)'), P.x + 8, P.cBot - 6, 'left');
        if (PACE0 > st.v1) note(N ? 'pace starts ' + fmtMY(PACE0) + ' →' : 'release series starts ' + fmtISO(D.releases.coverage_from) + '; pace from ' + fmtISO(PACE.first_day) + ' →', P.x + P.w - 8, P.cBot - 6, 'right');
        if (HH.pre && HH.pre.x1 - HH.pre.x0 > 150) note(N ? 'no release data' : 'no release data before ' + fmtMY(isoMs(D.releases.coverage_from)), (HH.pre.x0 + HH.pre.x1) / 2 - (N ? 40 : 80), P.y + P.h * 0.55, 'left', COL.ink3);
        if (HH.gap && HH.gap.x1 - HH.gap.x0 > (N ? 60 : 80)) note([OPEN.days_at_today + ' days since the last recorded release (no value drawn)', OPEN.days_at_today + ' days since the last recorded release', OPEN.days_at_today + ' days since the last release'], HH.gap.x1 - 14, P.rug0 - 9, 'right', COL.ice);
        if (HH.lag && HH.lag.x1 - HH.lag.x0 > 60) note(N ? ['data lag'] : ['Recent data lag: waits may be shorter', 'Recent data lag: may be shorter', 'Recent data lag'], HH.lag.x0 + 6, P.y + P.h - 40, 'left', COL.ice);
        if (OM && OM.pinned === 'upper') note(N ? 'omega: no finite date' : 'omega point: the latest fit ran to the edge of its search grid (no date)', P.x + P.w - 8, P.y + 16, 'right', COL.omega);
        else if (omBand && OM.tlo > st.v1) note(N ? 'omega band →' : 'omega band starts ' + fmtMs(OM.tlo) + ' →', P.x + P.w - 8, P.y + 16, 'right', COL.omega);
        HH.none.forEach((nb) => { if (nb.x1 - nb.x0 > 130) note('no release in the ' + PACE.window_days + '-day window', (nb.x0 + nb.x1) / 2 - 96, P.cTop + 10, 'left', COL.ink3); });

        HT = HH; OCC = occ; st.dirty = false;
      }

      function drawDyn(t) {
        const c = dctx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
        if (!HT) return;
        const h = st.hover;
        if (h) {
          c.save();
          if (h.kind === 'pace' && h.i != null && waits()[h.i] != null) { const x = X(dayT(h.i) + DAY / 2), y = YW(waits()[h.i]); c.shadowColor = COL.ai; c.shadowBlur = 14; dot(c, x, y, 4.2, '#ffffff'); }
          else if (h.kind === 'release') { const x = X(relMs[h.i]); c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.shadowColor = COL.ai; c.shadowBlur = 10; c.beginPath(); c.moveTo(x, P.rug0 - 5); c.lineTo(x, P.rug1 + 3); c.stroke(); }
          else if (h.kind === 'entry') { c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.beginPath(); c.arc(h.x, h.y, 8, 0, 7); c.stroke(); }
          else if (h.kind === 'test') { const a = Math.max(P.x, X(h.T.t0)), b = Math.min(P.x + P.w, X(h.T.t1)); c.fillStyle = 'rgba(223,234,255,0.08)'; c.fillRect(a, P.y, Math.max(2, b - a), P.h); }
          else if (h.kind === 'omega' && HT.omega) { c.fillStyle = 'rgba(255,200,97,0.10)'; c.fillRect(HT.omega.x0, P.y, HT.omega.x1 - HT.omega.x0, P.h); }
          else if (h.kind === 'ghost') { c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.beginPath(); c.arc(h.x, h.y, 6, 0, 7); c.stroke(); }
          c.restore();
        }
        if (st.sel) {
          const a = Math.min(st.sel.x0, st.sel.x1), b = Math.max(st.sel.x0, st.sel.x1);
          c.fillStyle = 'rgba(56,217,245,0.1)'; c.fillRect(a, P.y, b - a, P.h);
          c.strokeStyle = 'rgba(56,217,245,0.7)'; c.strokeRect(a + 0.5, P.y + 0.5, b - a - 1, P.h - 1);
          const t0 = Tx(a), t1 = Tx(b);
          txt(c, fmtMs(t0) + ' → ' + fmtMs(t1) + (t1 - t0 < 7 * DAY ? '  (min 7 days)' : ''), (a + b) / 2, P.y + 18, { mono: true, size: 11, align: 'center', color: COL.ink, plate: 'rgba(5,8,16,0.88)' });
        }
        if (HT.today) {   // the pulse sits in the tick row, on the time axis, not on the value scale
          const x = HT.today.x, y = HT.today.y, per = 2200;
          if (!REDUCED) for (let k = 0; k < 2; k++) {
            const ph = ((t + k * per / 2) % per) / per, r = 5 + ph * (N ? 9 : 11);
            c.strokeStyle = 'rgba(56,217,245,' + (0.8 * (1 - ph)).toFixed(3) + ')'; c.lineWidth = 2 * (1 - ph) + 0.6; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
          } else { c.strokeStyle = 'rgba(56,217,245,0.6)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 11, 0, 7); c.stroke(); }
          c.save(); c.shadowColor = COL.ai; c.shadowBlur = 20; dot(c, x, y, N ? 4.8 : 5.6, '#ffffff'); c.restore(); dot(c, x, y, 2.4, COL.ai);
        }
      }

      function hit(px, py, touch) {
        if (!HT) return null;
        const R = touch ? 14 : 7, t = Tx(px);
        if (HT.today && Math.hypot(px - HT.today.x, py - HT.today.y) < (touch ? 20 : 12)) return { kind: 'today' };
        if (HT.laneTag && px >= HT.laneTag.x0 && px <= HT.laneTag.x1 && py >= HT.laneTag.y0 - 4 && py <= HT.laneTag.y1 + 4) return { kind: 'test', T: HT.laneTag.T };
        for (const e of HT.entries) if (Math.abs(px - e.x) < R + 2 && Math.abs(py - e.y) < 22) return { kind: 'entry', x: e.x, y: e.y, e: e.e, n: e.e.n };
        { let best = null, bd = R + 3;   // the nearest ghost-trail point
          for (const g of HT.ghost) { const d = Math.hypot(px - g.x, py - g.y); if (d < bd) { bd = d; best = g; } }
          if (best) return { kind: 'ghost', q: best.q, x: best.x, y: best.y }; }
        if (HT.omegaMark && Math.hypot(px - HT.omegaMark.x, py - HT.omegaMark.y) < (touch ? 18 : 11)) return { kind: 'omega' };
        if (HT.omegaLabel && px >= HT.omegaLabel.x0 && px <= HT.omegaLabel.x1 && py >= HT.omegaLabel.y0 && py <= HT.omegaLabel.y1) return { kind: 'omega' };
        if (py > P.y + P.h + 2) return null;
        for (const b of HT.drops) if (px >= b.x0 && px <= b.x1 && py >= b.y0 && py <= b.y1) return { kind: 'drop', dr: b.dr };
        if (py >= P.rug0 - 8 && py <= P.y + P.h + 2) {
          let best = -1, bd = R;
          for (let i = 0; i < REL.length; i++) { if (!inX(relMs[i])) continue; const d = Math.abs(X(relMs[i]) - px); if (d < bd) { bd = d; best = i; } }
          if (best >= 0) return { kind: 'release', i: best };
          if (HT.gap && px >= HT.gap.x0 && px <= HT.gap.x1) return { kind: 'gap' };
        }
        if (HT.omega && px >= HT.omega.x0 - 2 && px <= HT.omega.x1 + 2) return { kind: 'omega' };
        for (const T of HT.tests) if (px >= T.x0 - 2 && px <= T.x1 + 2) return { kind: 'test', T: T.T };
        const i = idxAt(t);
        if (i >= 0 && i < NPACE) {
          if (waits()[i] == null) { const sp = HT.none.find((nb) => px >= nb.x0 && px <= nb.x1); return { kind: 'none', i, s: sp ? sp.s : null }; }
          return { kind: 'pace', i };
        }
        if (t > TODAY_MS) return { kind: 'future' };
        if (t < PACE0) return { kind: 'pre' };
        if (HT.gap && px >= HT.gap.x0 && px <= HT.gap.x1) return { kind: 'gap' };
        return null;
      }
      function readout(h) {
        const src = 'computed from ' + D.releases.input + ' (non-minor rows); definitions in data/main_chart.json';
        if (h.kind === 'today') return card('Today', COL.ice, 'Today · ' + WD[new Date(TODAY_MS).getUTCDay()] + ' ' + fmtMs(TODAY_MS), null, [
          'Last recorded release: ' + esc(OPEN.models.join(', ')) + ', ' + fmtISO(OPEN.last_release) + ' (' + OPEN.days_at_today + ' days ago). ' + esc(D.releases.lag_note),
          'After today only the two registered test windows and the omega band (a fitted estimate) are drawn: no pace, no drops, no extrapolation.'], 'data/main_chart.json today; releases.open_gap');
        if (h.kind === 'future') return card('After today', COL.ice, 'Nothing after today is data', null, ['Only the two registered CVE test windows and the omega band (a fitted estimate) are drawn here.'], 'issue #31, Release 1 rules');
        if (h.kind === 'omega') {
          const o = OMEGA.of(CARD_LIST), L = D.lists && D.lists[o.list];
          return card('Omega point ' + badge('fitted estimate', 'b'), COL.omega, 'Omega point', fmtISO(o.date), [
            (o.cal ? esc(rangeText(o)) + ' ' : '') + '(latest refit ' + fmtISO(o.last.refit_date) + ', ' + esc(L ? L.label : o.list) + '). ' + esc(rangeNote(o)),
            'It keeps moving later' + (o.r != null && o.r > 0 ? ': the fit\u2019s named date moves about ' + (Math.round(o.r * 10) / 10) + ' days later per day that passes. ' : '. ') + o.passed + ' of ' + o.rows.length + ' earlier named dates have already gone by.',
            'A fitted estimate, not a forecast; updated weekly.'], o.last.pred_id + ' (' + o.last.display_approved_pr + ')');
        }
        if (h.kind === 'ghost') {
          const r = h.q.r;
          return card('Refit ' + (h.q.passed ? badge('passed', 'b') : badge('not passed')), COL.omega, 'Refit ' + fmtISO(r.refit_date) + ' named ' + fmtISO(h.q.date) + ' (est.)', null, [
            h.q.passed ? 'That date has passed: a failed forecast.' : 'That date has not passed yet.',
            r.pinned === 'lower' ? 'Pinned to the start of the search grid: the fit had no interior best date.' : null], r.pred_id + ' (' + r.display_approved_pr + ')');
        }
        if (h.kind === 'pre') return card('Before the series', COL.ice, 'No release data', 'before ' + fmtISO(D.releases.coverage_from), ['The rule-defined series starts ' + fmtISO(D.releases.coverage_from) + '; the 90-day pace starts ' + fmtISO(PACE.first_day) + ', its first fully covered window.'], D.releases.coverage_rule_src);
        if (h.kind === 'gap') return card('Open: since the last recorded release', COL.ai, OPEN.days_at_today + ' days', fmtISO(OPEN.last_release) + ' → today', [esc(OPEN.reads), 'No line is drawn here: the pace line ends at the last recorded release.'], D.releases.input);
        if (h.kind === 'entry') return card('Lab enters the list ' + badge('provisional'), COL.kurz, h.e.lab + ' (lab ' + h.n + ' of ' + NLABS + ')', fmtISO(h.e.date), [
          'First non-minor release in the series: ' + esc(h.e.model) + '.', esc(D.lab_entry.definition), esc(D.lab_entry.caveat), '<span style="color:#ffd27a">' + esc(D.lab_entry.label_note) + '.</span>'], h.e.source);
        if (h.kind === 'test') return testCard(h.T);
        if (h.kind === 'release') {
          const r = REL[h.i], same = REL.filter((q) => q.date === r.date && q !== r);
          return card('AI release · ' + NLABS + ' labs, rule-defined' + (relMs[h.i] >= LAG_MS ? ' ' + badge('data lag', 'b') : ''), COL.ai, r.model, fmtISO(r.date) + ' · ' + r.lab, [
            r.open_weight ? 'Open weights.' : null, same.length ? 'Same day: ' + same.slice(0, 6).map((q) => esc(q.model) + ' (' + esc(q.lab) + ')').join(', ') + (same.length > 6 ? ', …' : '') : null,
            relMs[h.i] >= LAG_MS ? esc(D.releases.lag_note) : null], r.source + ' (minor == False)');
        }
        if (h.kind === 'none') return card('No release in the window', COL.ai, 'No counted release in the 90-day window', 'window to ' + fmtMs(dayT(h.i)), ['The wait is undefined here, so the line breaks.' + (h.s ? ' This gap runs ' + fmtISO(h.s.from) + ' to ' + fmtISO(h.s.to) + ' (' + h.s.days + ' days).' : '')], src);
        if (h.kind === 'pace' || h.kind === 'drop') {
          const i = h.kind === 'drop' ? idxAt(isoMs(h.dr.day)) : h.i, wv = waits()[i], nn = counts()[i];
          const lag = dayT(i) >= LAG_MS, dim = nn < PACE.full_min_count;
          const dayRel = REL.filter((r) => isoMs(r.date) === dayT(i));
          const ps = [
            st.mode === 'per_lab'
              ? nn + ' release events in the 90-day window, ' + PACE.active_labs[i] + ' labs active, ' + nf(PACE.lab_days[i]) + ' lab-days (entry events not counted).'
              : nn + ' release events from the ' + NLABS + ' labs in the 90-day window (same-day releases from one lab count once; raw, roster not corrected).',
            dayRel.length ? 'Released this day: <b>' + dayRel.map((r) => esc(r.model) + ' <span style="color:#8693ab">(' + esc(r.lab) + ')</span>').join(', ') + '</b>' : null,
            dim ? badge('few releases') + ' fewer than ' + PACE.full_min_count + ' events: the wait swings with each one (drawn dim).' : null,
            lag ? badge('upper bound', 'b') + ' ' + esc(D.releases.lag_note) : null,
          ];
          if (h.kind === 'drop') {
            const dr = h.dr, rel = dr.releases.map((j) => REL[j]);
            ps.unshift('<b>Drop #' + dr.rank + '</b>: the wait fell from ' + fmtDays(dr.wait_before) + ' to ' + fmtDays(dr.wait_after) + ' between ' + fmtISO(dr.from_day) + ' and ' + fmtISO(dr.day) + '.' +
              (dr.entering.length ? ' <b style="color:#ddd6ff">' + esc(dr.entering.join(', ')) + (dr.entering.length > 1 ? ' enter' : ' enters') + ' the list here</b> (provisional entry date).' : '') +
              ' Releases in that span: ' + rel.slice(0, 10).map((r) => esc(r.model)).join(', ') + (rel.length > 10 ? ', +' + (rel.length - 10) + ' more' : '') + '.');
            if (!dr.entering.length) ps.splice(1, 0, badge('placeholder', 'b') + ' ' + esc(D.drops.names_status) + '. The names follow a written rule (closed weights first; see Learn more).');
          }
          const ttl = wv == null ? 'No counted release' : (st.mode === 'per_lab' ? 'Each active lab: one new model every ' + fmtDays(wv) : 'One new model every ' + fmtDays(wv));
          return card((h.kind === 'drop' ? 'Labelled drop · ' : 'Pace · ') + (st.mode === 'per_lab' ? 'per active lab' : 'all labs pooled (raw)'), COL.ai, ttl, '90-day window to ' + fmtMs(dayT(i)), ps, src + (h.kind === 'drop' ? '; drop rule: drops.definition' : ''));
        }
        return '';
      }

      // ---- view control
      function clampView(a, b) {
        const span = clamp(b - a, 7 * DAY, LIM1 - LIM0);
        if (a < LIM0) a = LIM0;
        b = a + span; if (b > LIM1) { b = LIM1; a = b - span; }
        return [a, b];
      }
      function setView(a, b) { [st.v0, st.v1] = clampView(a, b); st.anim = null; st.dirty = true; st.changed = true; markPreset(); }
      function animateTo(a, b) { const [x, y] = clampView(a, b); st.anim = { a0: st.v0, b0: st.v1, a1: x, b1: y, s: performance.now(), dur: REDUCED ? 1 : 560 }; st.dirty = true; st.hover = null; tip.hide(); markPreset([x, y]); }
      function markPreset(tg) {
        const tgt = tg || (st.anim ? [st.anim.a1, st.anim.b1] : [st.v0, st.v1]);
        $$('#mc-preset-cal button').forEach((b) => { const v = clampView(VIEWS_C[b.dataset.preset][0], VIEWS_C[b.dataset.preset][1]); b.setAttribute('aria-pressed', String(Math.abs(v[0] - tgt[0]) < DAY && Math.abs(v[1] - tgt[1]) < DAY)); });
      }
      const api = {
        plot: () => P, toT: (x) => Tx(x), toX: (t) => X(t), today: () => (TODAY_MS >= st.v0 && TODAY_MS <= st.v1 ? TODAY_MS : null),
        view: () => [st.v0, st.v1], span: () => st.v1 - st.v0, spanOf: (v) => v[1] - v[0], toTIn: (v, x) => v[0] + (x - P.x) / P.w * (v[1] - v[0]),
        place(span, tRef, f) { span = clamp(span, 7 * DAY, LIM1 - LIM0); const a = tRef - f * span; setView(a, a + span); },
        range(a, b) { if (b - a < 7 * DAY) { const m = (a + b) / 2; a = m - 3.5 * DAY; b = m + 3.5 * DAY; } animateTo(a, b); },
        reset() { animateTo(VIEWS_C.ai[0], VIEWS_C.ai[1]); },
        step: () => 0.3, pinchGain: 1.15, pull: () => 1,
        zoomBtn(dir) { const tt = api.today(), f = tt != null ? (tt - st.v0) / (st.v1 - st.v0) : 0.5, ref = tt != null ? tt : (st.v0 + st.v1) / 2, span = clamp((st.v1 - st.v0) * (dir < 0 ? 0.5 : 2), 7 * DAY, LIM1 - LIM0); animateTo(ref - f * span, ref - f * span + span); },
        select(s) { const old = st.sel; st.sel = s; return old; },
        hover(x, y) { const h = hit(x, y, false); st.hover = h; const html = h ? readout(h) : ''; if (html) tip.show(html, x, y, false); else tip.hide(); cv.style.cursor = h && h.kind !== 'pace' && h.kind !== 'future' ? 'pointer' : 'crosshair'; },
        tap(x, y, touch) { const h = hit(x, y, touch); st.hover = h; const html = h ? readout(h) : ''; if (html) tip.show(html, x, y, touch); else tip.hide(); },
        leave() { st.hover = null; tip.hide(); },
        toast, onUser() { st.hover = null; tip.hide(); },
      };
      attachZoom(cv, api);
      $$('#mc-preset-cal button').forEach((b) => b.addEventListener('click', () => { const v = VIEWS_C[b.dataset.preset]; animateTo(v[0], v[1]); }));
      // scroll-triggered zoom (owner's request, #31): once mostly on screen, glide from the AI era to the 2-year view;
      // any touch of the chart or its buttons first cancels it
      { let off = false; const stop = () => { off = true; };
        cv.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') stop(); }, { passive: true });
        cv.addEventListener('keydown', stop);
        { const ou = api.onUser; api.onUser = function () { stop(); return ou.apply(this, arguments); }; }
        $$('#mc-preset-cal button, #mc-cal-in, #mc-cal-out, #mc-cal-reset, #mc-mode button').forEach((b) => b.addEventListener('click', stop));
        whenSeen(box, () => setTimeout(() => {
          if (off) return;
          const [x, y] = clampView(VIEWS_C.y2[0], VIEWS_C.y2[1]);
          if (REDUCED) { setView(x, y); return; }
          st.anim = { a0: st.v0, b0: st.v1, a1: x, b1: y, s: performance.now(), dur: 2000 }; st.dirty = true; markPreset([x, y]);
        }, 600)); }
      $('#mc-cal-in').addEventListener('click', () => api.zoomBtn(-1));
      $('#mc-cal-out').addEventListener('click', () => api.zoomBtn(1));
      $('#mc-cal-reset').addEventListener('click', () => api.reset());
      const lastEntry = ENTRY[ENTRY.length - 1];
      listHooks.push(() => { st.dirty = true; st.hover = null; tip.hide(); });
      function setMode(m) {
        st.mode = m; st.dirty = true; st.hover = null; tip.hide();
        $$('#mc-mode button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
        $('#mc-cal-title-s').textContent = m === 'per_lab' ? 'Time between a lab’s new models' : 'Time between new models, any of ' + NLABS + ' labs';
        $('#mc-cal-lede').innerHTML = m === 'per_lab'
          ? 'Lower = new models arriving faster.'
          : 'All ' + NLABS + ' labs pooled. Lower = new models arriving faster.';
        $('#mc-cal-axisnote').textContent = m === 'per_lab'
          ? PACE.window_days + '-day window · log scale'
          : 'Any of ' + NLABS + ' labs, pooled (raw) · ' + PACE.window_days + '-day window · log scale';
        cv.setAttribute('aria-label', 'Calendar view: ' + (m === 'per_lab' ? 'the wait between one lab’s new AI models, per active lab' : 'the wait between new AI models from any of ' + NLABS + ' labs, pooled') + ', over a ' + PACE.window_days + '-day window, with placeholder names on the biggest drops, lab entries under the axis, today pulsing on the time axis, and after today the two registered CVE test windows' + (TRK ? ' and the omega band: the latest refit\'s calibrated 50% range (provisional, in-sample), a fitted estimate, with a ghost trail of earlier refits under the chart showing where the date pointed at each update: it keeps moving later' : '') + '.');
        renderLegend();
      }
      $$('#mc-mode button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
      function renderLegend() {
        const sv = (inner, w) => '<svg width="' + (w || 24) + '" height="14" aria-hidden="true">' + inner + '</svg>';
        $('#mc-legend-cal').innerHTML = [
          sv('<path d="M1 4 H8 V9 H15 V7 H23" fill="none" stroke="#38d9f5" stroke-width="2"/>') + (st.mode === 'per_lab' ? 'pace per active lab' : 'pace, all labs pooled (raw)'),
          sv('<path d="M1 4 H8 V9 H15 V7 H23" fill="none" stroke="rgba(56,217,245,0.5)" stroke-width="1.3"/>') + 'dim: fewer than ' + PACE.full_min_count + ' releases in the window',
          sv('<rect x="1" y="2" width="22" height="10" rx="2" fill="rgba(201,214,238,0.12)" stroke="rgba(201,214,238,0.35)"/><path d="M4 7 H20" stroke="#38d9f5" stroke-dasharray="4 2" stroke-width="1.6"/>') + 'Epoch lag: waits are upper bounds',
          sv('<rect x="1" y="2" width="22" height="10" rx="2" fill="none" stroke="rgba(201,214,238,0.35)" stroke-dasharray="1.5 2"/>') + 'no release in the ' + PACE.window_days + '-day window (line breaks)',
          sv('<line x1="6" y1="2" x2="6" y2="12" stroke="rgba(56,217,245,0.7)"/><line x1="12" y1="2" x2="12" y2="12" stroke="rgba(56,217,245,0.7)"/><line x1="15" y1="2" x2="15" y2="12" stroke="rgba(56,217,245,0.7)"/>', 20) + 'each release (lane under the line)',
          sv('<path d="M2 7 H22" stroke="rgba(201,214,238,0.7)" stroke-dasharray="2 3" stroke-width="1.2"/><path d="M2 3 V11 M22 3 V11" stroke="rgba(201,214,238,0.7)"/>') + 'days since the last recorded release (no value)',
          sv('<rect x="1.5" y="2.5" width="21" height="9" rx="2.5" fill="rgba(4,8,16,0.86)" stroke="rgba(255,210,122,0.6)" stroke-dasharray="3 3"/>') + 'dashed label: placeholder names, still being checked',
          sv('<path d="M12 2.5 L16.5 7 L12 11.5 L7.5 7 Z" fill="#c9bfff"/>') + 'lab enters the list: ' + esc(D.lab_entry.label_note),
          sv('<rect x="2" y="1" width="20" height="12" rx="2" fill="rgba(223,234,255,0.16)" stroke="rgba(223,234,255,0.6)"/>') + 'registered CVE test window (two-sided)',
          sv('<circle cx="12" cy="7" r="3.6" fill="#fff"/><circle cx="12" cy="7" r="6" fill="none" stroke="rgba(56,217,245,0.75)"/>') + 'today (on the time axis)',
        ].map((q) => '<span>' + q + '</span>').join('');
      }
      function frame(t) {
        if (st.anim) {
          const a = st.anim, k = clamp((t - a.s) / a.dur, 0, 1), e = easeOut(k);
          st.v0 = a.a0 + (a.a1 - a.a0) * e; st.v1 = a.b0 + (a.b1 - a.b0) * e;
          if (k >= 1) st.anim = null;
          st.dirty = true; st.changed = true;
        }
        if (st.dirty) render();
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(stat, 0, 0);
        drawDyn(t);
      }
      window.addEventListener('resize', () => { DPR = Math.min(2, window.devicePixelRatio || 1); measure(); });
      if (window.ResizeObserver) new ResizeObserver(() => { if (box.clientWidth !== W) measure(); }).observe(box);
      measure(); setMode('per_lab'); markPreset();
      return { frame, st, api, setMode, preset: (k) => { const v = VIEWS_C[k]; setView(v[0], v[1]); }, show: (a, b) => setView(a, b), P: () => P, X, occ: () => OCC, ht: () => HT };
    })();
    if (C) charts.push(C);

    // ============================================================ McKenna's timewave, own panel
    const M = (function () {
      const box = $('#mc-box-mck'), cv = $('#mc-cv-mck'), cvd = $('#mc-cv-mck-dyn');
      if (!box || !cv) return null;
      if (!TW) { pendingIn(box, 'Timewave data pending: ' + ((D.timewave || {}).message || '')); $$('#mc-mck .mc-controls').forEach((e) => { e.hidden = true; }); return null; }
      const ctx = cv.getContext('2d'), dctx = cvd.getContext('2d');
      const tip = makeTip(box), toast = makeToast(box);
      const stat = document.createElement('canvas'), sctx = stat.getContext('2d');
      // The samples (about 140 KB gzipped, the biggest part of the old main_chart.json) are a separate file, fetched when
      // this panel is about to scroll into view. Until they arrive nothing is drawn but a loading line: no placeholder curve.
      const S0 = isoMs(TW.daily.first_day);
      // dates from year 0 to 99 and before: Date.UTC maps 0..99 to 1900..1999, so build them with setUTCFullYear
      const evMs = (y, m, d) => { const q = new Date(NaN); q.setTime(-0); q.setUTCFullYear(y, m, d); q.setUTCHours(0, 0, 0, 0); return q.getTime(); };
      // McKenna's picks (issue #31): his own, chosen after the fact; drawn at their real dates under either end date, never
      // scored. A BCE year is written with a minus sign (no year 0), so -44 is 44 BCE: astronomical year = y + 1 when y < 0.
      const EVC = '#9fe6a0';
      const histY = (y) => (y < 0 ? y + 1 : y);
      function evOf(r) {
        try {
          let a, b; const ds = String(r.date), p = r.precision;
          if (p === 'range') { const q = ds.split('/').map(Number); a = evMs(histY(q[0]), 0, 1); b = evMs(histY(q[1]) + 1, 0, 1); }
          else {
            const m = /^(-?\d+)(?:-(\d\d))?(?:-(\d\d))?$/.exec(ds), y = histY(+m[1]);
            if (p === 'day') { a = evMs(y, +m[2] - 1, +m[3]); b = a + DAY; }
            else if (p === 'month') { a = evMs(y, +m[2] - 1, 1); b = evMs(y, +m[2], 1); }
            else { a = evMs(y, 0, 1); b = evMs(y + 1, 0, 1); }
          }
          if (!isFinite(a) || !isFinite(b) || b <= a) return null;
          return { name: String(r.name), date: ds, precision: p, text: String(r.date_text), quote: String(r.quote), source: String(r.source), a, b, t: (a + b) / 2 };
        } catch (e) { return null; }
      }
      const EVS = TW.events && TW.events.status === 'ok' && Array.isArray(TW.events.rows) ? TW.events.rows.map(evOf).filter(Boolean).sort((p, q) => p.t - q.t) : [];
      let EVH = 0;     // height of the strip under the axis that holds the events (0 when there are none)
      // full screen (owner's request, #31): the browser's own full screen on the panel where allowed, else a fixed overlay
      const sec = $('#mc-mck'), fsBtn = $('#mc-mck-fs');
      const fsOn = () => !!sec && (document.fullscreenElement === sec || sec.classList.contains('mc-fs'));
      let TT = new Float64Array(0), VV = new Float64Array(0), YLO = 0, YHI = 1, LSTEP = 1, LMAX = 1, NEAR = 0;
      // Zero date (owner's request, #31): 'omega' moves the wave's zero to the omega card's named date for the hero's list
      // (the shape is the formula's, the date is the fit's: a fitted estimate); 'mckenna' keeps McKenna's own zero date.
      // The samples keep their own times in TT0; TT is TT0 shifted by SH = Z - ZERO_MS.
      let MODE = 'omega', Z = ZERO_MS, SH = 0, ZO = null, TT0 = new Float64Array(0), scaleUser = false;
      // auto zoom (owner's request, #31): with the omega zero the panel opens on the last years before it, then glides once
      // to a near view (today to just after the zero); any touch of the panel first cancels it, reduced motion jumps
      let autoDone = false, autoTimer = null;
      const nearView = () => [TODAY_MS - 45 * DAY, Z + 30 * DAY], wideView = () => [Z - 6 * YEAR, Z + 0.4 * YEAR];
      function autoOff() { autoDone = true; if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; } }
      let seenM = false;
      function startAuto() {
        if (autoDone || !ZO || !ready || !seenM) return;
        autoDone = true;
        const [a, b] = clampView(...nearView());
        if (REDUCED) { st.v0 = a; st.v1 = b; st.dirty = true; return; }
        autoTimer = setTimeout(() => { autoTimer = null; if (!ZO) return; st.anim = { a0: st.v0, b0: st.v1, a1: a, b1: b, s: performance.now(), dur: 2600, ease: easeInOut }; st.dirty = true; }, 900);
      }
      let ready = false, loading = false, loadErr = null;
      function ingest(S) {
        const dv = S.daily_values, lx = S.near_anchor.days_before_anchor, lv = S.near_anchor.values;
        if (!Array.isArray(dv) || dv.length !== TW.daily.n || !Array.isArray(lx) || lx.length !== TW.near_anchor.n || lv.length !== lx.length) throw new Error('timewave samples do not match their description');
        NEAR = Math.max.apply(null, lx);   // daily samples up to here, then the log-spaced ones
        // before the daily samples: the log-spaced history (oldest first, days before the anchor only)
        const hx = S.history && Array.isArray(S.history.days_before_anchor) ? S.history.days_before_anchor : [], hv = hx.length ? S.history.values : [];
        if ((TW.history && hx.length !== TW.history.n) || !Array.isArray(hv) || hv.length !== hx.length) throw new Error('timewave history samples do not match their description');
        const tt = [], vv = [];
        for (let i = 0; i < hx.length; i++) { const t = ZERO_MS - hx[i] * DAY; if (t >= S0) break; tt.push(t); vv.push(Math.log10(hv[i])); }
        for (let i = 0; i < dv.length; i++) { const t = S0 + i * DAY; if (t >= ZERO_MS - NEAR * DAY) break; tt.push(t); vv.push(Math.log10(dv[i])); }
        const ord = lx.map((x, i) => i).sort((a, b) => lx[b] - lx[a]);
        for (const i of ord) { tt.push(ZERO_MS - lx[i] * DAY); vv.push(Math.log10(lv[i])); }
        tt.push(ZERO_MS); vv.push(Math.log10(TW.anchor_value));
        TT0 = Float64Array.from(tt); VV = Float64Array.from(vv); shiftSamples();
        // fixed scales from the samples themselves: never rescale with the view
        let lmin = Infinity, lmax = -Infinity; for (let i = 0; i < VV.length; i++) if (isFinite(VV[i])) { if (VV[i] < lmin) lmin = VV[i]; if (VV[i] > lmax) lmax = VV[i]; }
        YLO = Math.floor(lmin * 2) / 2; YHI = Math.ceil(lmax * 2) / 2;
        const vmax = Math.pow(10, lmax);
        LSTEP = (() => { const raw = vmax / 5, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; })();
        LMAX = Math.ceil(vmax * 1.06 / LSTEP) * LSTEP;
        ready = true;
      }
      function loadSamples() {
        if (ready || loading) return; loading = true; loadErr = null; st.dirty = true;
        fetch(TW.samples_file, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then((S) => { ingest(S); loading = false; st.dirty = true; startAuto(); })
          .catch((e) => { loading = false; loadErr = e && e.message ? e.message : 'error'; st.dirty = true; if (window.console) console.warn('timewave samples:', e); });
      }
      let OWN = [S0, ZERO_MS + (ZERO_MS - S0) * 0.02];
      // view limits: the default view above, widened to the last 5,000 years back and to a year past today (the "Last 100 years"
      // and "Last 5,000 years" views; the curve itself is drawn only where it has samples)
      const FAR0 = TODAY_MS - 5000 * YEAR - 30 * DAY;
      let LIM = [Math.min(OWN[0], FAR0), Math.max(OWN[1], TODAY_MS + YEAR)];
      const st = { v0: OWN[0], v1: OWN[1], linked: false, own: false, anim: null, hover: null, sel: null, dirty: true, scale: 'lin' };
      let W = 0, H = 0, N = false, P = null, HT = null;
      function shiftSamples() { const a = new Float64Array(TT0.length); for (let i = 0; i < a.length; i++) a[i] = TT0[i] + SH; TT = a; }
      function zeroFor() {
        if (MODE !== 'omega') return null;
        const o = OMEGA.of(CARD_LIST);
        return o && o.pinned !== 'upper' ? { z: isoMs(o.date) + (ZERO_MS - Math.floor(ZERO_MS / DAY) * DAY), o } : null;
      }
      function applyZero() {
        ZO = zeroFor(); Z = ZO ? ZO.z : ZERO_MS; SH = Z - ZERO_MS; shiftSamples();
        OWN = [S0 + SH, Z + (ZERO_MS - S0) * 0.02]; LIM = [Math.min(OWN[0], FAR0), Math.max(OWN[1], TODAY_MS + YEAR)];
        { const nb = $('#mc-mck-views [data-view=next]'); if (nb) { nb.disabled = !ZO; nb.title = ZO ? '' : 'Needs an end date that is still ahead'; } }
        $$('#mc-anchor button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.anchor === MODE)));
        // the last years before the zero sit near 0 on the linear scale: the omega view opens on the log scale (until the reader picks one)
        if (!scaleUser) { st.scale = ZO ? 'log' : 'lin'; $$('#mc-scale button').forEach((q) => q.setAttribute('aria-pressed', String(q.dataset.scale === st.scale))); }
        const L = D.lists && D.lists[curList()], z12 = fmtISO(TW.anchor_utc.slice(0, 10)), nt = $('#mc-mck-anchor');
        if (nt) nt.innerHTML = ZO
          ? 'Ends on the <b>omega point, ' + fmtISO(ZO.o.date) + '</b> (fitted estimate, updated weekly).'
          : MODE === 'omega' ? 'No omega point for this list, so the wave keeps McKenna\u2019s own zero date, ' + z12 + '.' : 'McKenna\u2019s own zero date, ' + z12 + ' (passed).';
        cv.setAttribute('aria-label', 'The timewave curve (a formula, not data), on its own fixed scale, ending at ' + (ZO ? 'the omega point, ' + fmtISO(ZO.o.date) + ' (a fitted estimate), with today marked.' : "McKenna's own end date, " + new Date(isoMs(TW.anchor_utc.slice(0, 10))).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) + '. No today marker.'));
        st.hover = null; tip.hide();
        if (ZO) { st.own = false; st.anim = null; [st.v0, st.v1] = clampView(...(autoDone ? nearView() : wideView())); setLink(false); }
        else if (C && C.st.v0 < Z) follow(C.st.v0, C.st.v1); else { st.own = false; st.anim = null; st.v0 = OWN[0]; st.v1 = OWN[1]; setLink(false); }
        st.dirty = true;
      }
      // the deepest novelty dips in view: local lows of the drawn curve, R px apart, rising at least 0.25 decades on both
      // sides (0.1 after today); not the final plunge into the zero (labelled on its own); dips after today first (the dates of high
      // expected novelty), then the deepest
      function dipsOf(cols, zx) {
        const R = N ? 18 : 26, K = N ? 4 : 7, cand = [];
        for (let i = R; i < cols.length - R; i++) {
          const x = cols[i][0], lo = cols[i][1];
          if (!isFinite(lo) || (zx != null && x > zx - 12)) continue;
          let ok2 = true, lm = -Infinity, rm = -Infinity;
          for (let j = i - R; j <= i + R; j++) {
            if (cols[j][1] < lo || (cols[j][1] === lo && j < i)) { ok2 = false; break; }
            if (j < i) lm = Math.max(lm, cols[j][2]); else if (j > i) rm = Math.max(rm, cols[j][2]);
          }
          const prom = Math.min(lm, rm) - lo;
          const t = Tx(x + 0.5);
          // upcoming lows, and past lows with the same zero, so a reader can hold them against history (owner, Oct 31)
          if (ok2 && prom >= 0.1) cand.push({ x, lo, prom, t, past: t <= TODAY_MS });
        }
        cand.sort((a, b) => (a.past - b.past) || b.prom - a.prom);   // upcoming first, then the deepest
        const out = [];
        for (const d of cand) { if (out.length >= K) break; if (out.every((o) => Math.abs(o.x - d.x) >= R)) out.push(d); }
        return out.sort((a, b) => a.x - b.x);
      }
      // the span in view, written the way McKenna titled his graphs ("135 years, from 1425 AD to 1560 AD")
      const spanEl = $('#mc-mck-span');
      function spanText(a, b) {
        const yrs = (b - a) / YEAR;
        if (yrs >= 2000) return (Math.round(yrs / 10) / 100).toLocaleString('en-US') + ' millennia, from ' + adbc(a) + ' to ' + adbc(b);
        if (yrs >= 2) return Math.round(yrs).toLocaleString('en-US') + ' years, from ' + adbc(a) + ' to ' + adbc(b);
        return Math.round((b - a) / DAY) + ' days, from ' + fmtMs(a) + ' to ' + fmtMs(b);
      }
      function bs(t) { let lo = 0, hi = TT.length; while (lo < hi) { const m = (lo + hi) >> 1; if (TT[m] < t) lo = m + 1; else hi = m; } return lo; }
      function measure() {
        N = isNarrow(); W = box.clientWidth; let Hp = N ? 230 : 250;
        EVH = EVS.length ? (N ? 52 : 58) : 0;
        if (fsOn()) { let other = 0; [...sec.children].forEach((e) => { if (e !== box) other += e.offsetHeight; }); Hp = Math.max(Hp, Math.round(window.innerHeight - other - 72 - EVH)); }
        H = Hp + EVH;
        const padL = N ? 44 : 78, padR = N ? 28 : 22;          // same gutters as the calendar view, so linked dates line up
        P = { x: padL, y: 30, w: W - padL - padR, h: Hp - 30 - 30 };
        for (const c of [cv, cvd, stat]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
        cv.style.height = H + 'px'; cvd.style.height = H + 'px'; cvd.style.width = W + 'px';
        st.dirty = true;
      }
      const X = (t) => P.x + (t - st.v0) / (st.v1 - st.v0) * P.w;
      const Tx = (x) => st.v0 + (x - P.x) / P.w * (st.v1 - st.v0);
      const Y = (lv) => (st.scale === 'log' ? P.y + (YHI - clamp(isFinite(lv) ? lv : YLO - 0.3, YLO - 0.3, YHI)) / (YHI - YLO) * P.h : P.y + (LMAX - Math.pow(10, lv)) / LMAX * P.h);
      function ticks(minPx) {
        const span = st.v1 - st.v0, ppm = P.w / span;
        const Cs = [['day', 1, DAY], ['week', 1, 7 * DAY], ['month', 1, 30.44 * DAY], ['month', 3, 91.3 * DAY], ['year', 1, YEAR], ['year', 2, 2 * YEAR], ['year', 5, 5 * YEAR], ['year', 10, 10 * YEAR], ['year', 20, 20 * YEAR], ['year', 25, 25 * YEAR], ['year', 50, 50 * YEAR], ['year', 100, 100 * YEAR], ['year', 250, 250 * YEAR], ['year', 500, 500 * YEAR], ['year', 1000, 1000 * YEAR]];
        const c = Cs.find((q) => q[2] * ppm >= minPx) || Cs[Cs.length - 1], out = [], d0 = new Date(st.v0);
        if (c[0] === 'day' || c[0] === 'week') { let t = Math.floor(st.v0 / DAY) * DAY; if (c[0] === 'week') while (new Date(t).getUTCDay() !== 1) t -= DAY; for (; t <= st.v1; t += c[2]) out.push({ t, u: c[0] }); }
        else if (c[0] === 'month') { let y = d0.getUTCFullYear(), m = d0.getUTCMonth(); m -= m % c[1]; for (;;) { const t = evMs(y, m, 1); if (t > st.v1) break; out.push({ t, u: 'month' }); m += c[1]; if (m >= 12) { m -= 12; y++; } } }
        else { let y = d0.getUTCFullYear(); y -= ((y % c[1]) + c[1]) % c[1]; for (;;) { const t = evMs(y, 0, 1); if (t > st.v1) break; out.push({ t, u: 'year' }); y += c[1]; } }
        return out.filter((o) => o.t >= st.v0 && o.t <= st.v1);
      }
      const sup = (k) => String(k).replace(/-/g, '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
      function render() {
        const c = sctx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
        if (!ready) {
          txt(c, loadErr ? 'The timewave samples could not be loaded (' + loadErr + '). Tap the chart to try again.' : 'Loading the timewave samples\u2026', P.x + P.w / 2, P.y + P.h / 2, { size: N ? 12 : 13, align: 'center', color: COL.ink2 });
          HT = { cols: null, zx: null }; st.dirty = false; return;
        }
        const H2 = { cols: null, zx: null, dips: [] };
        if (spanEl) { const t = 'In view: ' + spanText(st.v0, st.v1) + '.'; if (spanEl.textContent !== t) spanEl.textContent = t; spanEl.hidden = false; }
        const yl = [];
        if (st.scale === 'log') { for (let k = Math.ceil(YHI); k >= Math.floor(YLO); k--) if (k >= YLO && k <= YHI) yl.push([k, k >= -3 ? String(Math.pow(10, k)) : '10' + sup(k)]); }
        else for (let i = 0; i * LSTEP <= LMAX * (1 + 1e-9); i++) { const v = Number((i * LSTEP).toPrecision(6)); yl.push([v > 0 ? Math.log10(v) : -Infinity, String(v)]); }
        yl.forEach(([lv, s]) => { const y = Math.round(Y(lv)) + 0.5; c.strokeStyle = 'rgba(255,95,210,0.07)'; c.beginPath(); c.moveTo(P.x, y); c.lineTo(P.x + P.w, y); c.stroke(); txt(c, s, P.x - 7, y + 4, { mono: true, size: N ? 9.5 : 10.5, align: 'right', color: '#c99bbd' }); });
        txt(c, N ? '↑ FORMULA VALUE · LOWER = MORE NOVELTY' : '↑ FORMULA VALUE' + (st.scale === 'log' ? ' (LOG)' : '') + ' · LOWER = MORE NOVELTY', N ? 8 : 12, 17, { mono: true, size: N ? 9 : 10.5, weight: 600, color: '#c99bbd' });
        const TK = ticks(N ? 62 : 86); let first = true;
        TK.forEach((tk) => {
          // year ticks fall on round astronomical years; before year 1 that is one off (astronomical -2500 is 2501 BCE),
          // so a BCE tick moves one year later to land on the round historical year (2500 BCE; year 0 becomes 1 CE)
          let tt0 = tk.t; const y0 = new Date(tt0).getUTCFullYear();
          if (tk.u === 'year' && y0 <= 0) { const dd = new Date(tt0); dd.setUTCFullYear(y0 + 1); tt0 = dd.getTime(); }
          const x = Math.round(X(tt0)) + 0.5, d = new Date(tt0);
          c.strokeStyle = 'rgba(150,190,255,0.06)'; c.beginPath(); c.moveTo(x, P.y); c.lineTo(x, P.y + P.h); c.stroke();
          const lab = tk.u === 'year' ? (y0 <= 0 ? (y0 === 0 ? '1 CE' : (-y0) + ' BCE') : String(y0)) : tk.u === 'month' ? (d.getUTCMonth() === 0 || first ? MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear() : MON[d.getUTCMonth()]) : MON[d.getUTCMonth()] + ' ' + d.getUTCDate();
          first = false;
          const lw = tw(c, lab, N ? 10 : 11, 500, true); if (x - lw / 2 < 2 || x + lw / 2 > W - 2) return;
          txt(c, lab, x, P.y + P.h + 17, { mono: true, size: N ? 10 : 11, align: 'center', color: COL.ink2 });
        });
        c.strokeStyle = 'rgba(150,190,255,0.3)'; c.beginPath(); c.moveTo(P.x, P.y + P.h + 0.5); c.lineTo(P.x + P.w, P.y + P.h + 0.5); c.stroke();
        // the curve: per-pixel min/max of the samples, clipped; nothing after its anchor
        const tA = Math.max(st.v0, TT[0]), tB = Math.min(st.v1, Z);
        c.save(); c.beginPath(); c.rect(P.x, P.y, P.w, P.h); c.clip();
        if (tB > tA) {
          const xa = Math.floor(X(tA)), xb = Math.ceil(X(tB)), cols = [];
          for (let x = xa; x <= xb; x++) {
            const t0 = Math.max(Tx(x), tA), t1 = Math.min(Tx(x + 1), tB); if (t1 < t0) continue;
            const i0 = bs(t0), i1 = bs(t1); let lo = Infinity, hi = -Infinity;
            if (i1 <= i0) {
              const j = clamp(i0 - 1, 0, TT.length - 1), j2 = clamp(i0, 0, TT.length - 1), tm = (t0 + t1) / 2;
              let v = VV[j];
              if (TT[j2] > TT[j] && isFinite(VV[j]) && isFinite(VV[j2])) v = VV[j] + (VV[j2] - VV[j]) * (tm - TT[j]) / (TT[j2] - TT[j]);
              lo = hi = v;
            } else for (let i = i0; i < i1; i++) { const v = VV[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
            cols.push([x, lo, hi]);
          }
          H2.cols = cols;
          if (cols.length) {
            const path = () => { c.beginPath(); cols.forEach((p, i) => { const y1 = Y(p[2]), y2 = Y(p[1]); if (i === 0) c.moveTo(p[0], y1); else c.lineTo(p[0], y1); if (y2 - y1 > 0.5) c.lineTo(p[0], y2); }); };
            const g = c.createLinearGradient(0, P.y, 0, P.y + P.h); g.addColorStop(0, 'rgba(255,95,210,0.0)'); g.addColorStop(1, 'rgba(255,95,210,0.10)');
            c.beginPath(); c.moveTo(cols[0][0], P.y + P.h); cols.forEach((p) => c.lineTo(p[0], Y(p[1]))); c.lineTo(cols[cols.length - 1][0], P.y + P.h); c.closePath(); c.fillStyle = g; c.fill();
            c.lineJoin = 'round'; c.strokeStyle = 'rgba(255,95,210,0.2)'; c.lineWidth = 5; c.shadowColor = COL.mck; c.shadowBlur = 14; path(); c.stroke();
            c.shadowBlur = 4; c.strokeStyle = 'rgba(255,120,220,0.95)'; c.lineWidth = 1.4; path(); c.stroke();
          }
        }
        c.restore();
        // the deepest novelty dips in view: a marker on the curve and the date (a formula's lows, not a forecast of events)
        H2.dips = H2.cols ? dipsOf(H2.cols, Z >= st.v0 && Z <= st.v1 ? X(Z) : null) : [];
        // label boxes already placed in this panel: TODAY's label and line first, so a dip label never lands on them
        const occ = [], todayOn = !!(ZO && TODAY_MS >= st.v0 && TODAY_MS <= st.v1), todayX = todayOn ? Math.round(X(TODAY_MS)) + 0.5 : null;
        H2.boxes = { today: null, line: null, dips: [], down: null, zero: null };
        if (todayOn) {
          const w = tw(c, 'TODAY', N ? 9.5 : 10.5, 600, true);
          H2.boxes.today = { x0: todayX - 5 - w - 4, x1: todayX - 1, y0: P.y + P.h - 22, y1: P.y + P.h - 6 };
          H2.boxes.line = { x0: todayX - 2, x1: todayX + 2, y0: P.y - 4, y1: P.y + P.h };
          occ.push(H2.boxes.today, H2.boxes.line);
        }
        { const span = st.v1 - st.v0;
          H2.dips.forEach((d) => {
            // dates as McKenna wrote them on his graphs: a year with AD or BC on long views
            const y = Y(d.lo), lab = span >= 30 * YEAR ? adbc(d.t) : span < 400 * DAY ? fmtMD(d.t) : fmtMY(d.t);
            c.save(); c.shadowColor = COL.mck; c.shadowBlur = 10; c.fillStyle = '#ffd6f4'; c.strokeStyle = '#ffd6f4'; c.lineWidth = 1.5;
            c.beginPath(); c.moveTo(d.x, y + 2); c.lineTo(d.x - 5, y - 7); c.lineTo(d.x + 5, y - 7); c.closePath(); if (d.past) c.stroke(); else c.fill(); c.restore();   // hollow = past
            const lw = tw(c, lab, N ? 10 : 11, 600, true), ly = y + 18 <= P.y + P.h - 4 ? y + 18 : y - 12;
            const box = { x0: d.x - lw / 2 - 4, x1: d.x + lw / 2 + 4, y0: ly - 12, y1: ly + 4 };
            d.hx = d.x; d.hy = y;
            if (box.x0 < P.x || box.x1 > P.x + P.w || occ.some((o) => o.x0 < box.x1 && box.x0 < o.x1 && o.y0 < box.y1 && box.y0 < o.y1)) return;
            occ.push(box); H2.boxes.dips.push(box); txt(c, lab, d.x, ly, { mono: true, size: N ? 10 : 11, weight: 600, align: 'center', color: '#ffd6f4', plate: 'rgba(5,8,16,0.85)' });
          }); }
        // the anchor: the curve ends here, and nothing is drawn after it
        const ownISO = TW.anchor_utc.slice(0, 10), zISO = ZO ? ZO.o.date : ownISO;   // zISO: the end date, the omega point when there is one; ownISO: the formula's own end date
        // omega zero: today's line and the card's range under the zero
        if (todayOn) {
          const tx = todayX;
          c.save(); c.strokeStyle = 'rgba(234,242,255,0.55)'; c.beginPath(); c.moveTo(tx, P.y - 4); c.lineTo(tx, P.y + P.h); c.stroke(); c.restore();
          txt(c, 'TODAY', tx - 5, P.y + P.h - 10, { mono: true, size: N ? 9.5 : 10.5, weight: 600, align: 'right', color: COL.ink, plate: 'rgba(5,8,16,0.85)' });
        }
        if (ZO && ZO.o.cal && isFinite(ZO.o.thi) && ZO.o.thi >= st.v0 && ZO.o.tlo <= st.v1) {
          const a = Math.max(P.x, X(ZO.o.tlo)), b = Math.min(P.x + P.w, X(ZO.o.thi));
          c.save(); c.shadowColor = COL.omega; c.shadowBlur = 10; c.fillStyle = 'rgba(255,206,120,0.75)'; c.fillRect(a, P.y + P.h - 2, Math.max(1, b - a), 4); c.restore();
        }
        if (Z >= st.v0 && Z <= st.v1) {
          const zx = X(Z); H2.zx = zx;
          c.save(); c.strokeStyle = 'rgba(255,95,210,0.65)'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(zx, P.y - 4); c.lineTo(zx, P.y + P.h); c.stroke(); c.restore();
          c.fillStyle = COL.mck; c.beginPath(); c.moveTo(zx, P.y + P.h - 1); c.lineTo(zx - 4, P.y + P.h - 8); c.lineTo(zx + 4, P.y + P.h - 8); c.fill();
          const l1 = ZO ? (N ? 'ends: omega ' + fmtISO(zISO) + ' (est.)' : 'ends on the omega point, ' + fmtISO(zISO) + ' (fitted estimate, updated weekly)') : N ? 'ends ' + fmtISO(ownISO) : 'ends on McKenna\u2019s own date, ' + fmtISO(ownISO) + ' (passed)';
          const lw = tw(c, l1, N ? 10.5 : 11.5, 600, true);
          const right = zx + 8 + lw < P.x + P.w - 4, bx0 = right ? zx + 4 : zx - 12 - lw, bx1 = bx0 + lw + 8;
          // the first height where the label clears the curve (top, middle, bottom); the top if none does
          const clear = (y) => !(H2.cols || []).some((p) => p[0] >= bx0 - 2 && p[0] <= bx1 + 2 && Y(p[2]) <= y + 7 && Y(p[1]) >= y - 15);
          // the "to 0" note sits under the zero line's left side: reserve its box so the label does not land on it
          const downOn = !!(H2.cols && H2.cols.length && st.scale === 'log' && H2.cols.some((p) => p[1] < YLO));
          if (downOn) { const dw = tw(c, '\u2193 to 0 at the zero date', 10, 400, true); H2.boxes.down = { x0: zx - 8 - dw - 4, x1: zx - 4, y0: P.y + P.h - 24, y1: P.y + P.h - 6 }; occ.push(H2.boxes.down); }
          const cands = [P.y + 14, P.y + P.h * 0.5, P.y + P.h - 8];
          const free = (y) => !occ.some((o) => o !== H2.boxes.line && o.x0 < bx1 && bx0 < o.x1 && o.y0 < y + 4 && y - 14 < o.y1);
          const ly = cands.find((y) => clear(y) && free(y)) || cands.find(clear) || P.y + 14;
          H2.boxes.zero = { x0: bx0, x1: bx1, y0: ly - 14, y1: ly + 4 };
          txt(c, l1, right ? zx + 8 : zx - 8, ly, { mono: true, size: N ? 10.5 : 11.5, weight: 600, align: right ? 'left' : 'right', color: '#ffc4ef', plate: 'rgba(5,8,16,0.85)' });
          const after = P.x + P.w - zx;
          if (after > (N ? 130 : 220)) txt(c, 'nothing drawn after its zero date', zx + after / 2, P.y + P.h * 0.55, { mono: true, size: N ? 10 : 11, align: 'center', color: COL.ink3 });
        } else if (Z < st.v0) {
          txt(c, ZO ? (Z > TODAY_MS ? '← the curve ends ' : '← the curve ended ') + fmtISO(zISO) + ' (est.)' : '← the curve ended ' + fmtISO(ownISO), P.x + 8, P.y + P.h * 0.5, { mono: true, size: 11, color: '#ffc4ef', plate: 'rgba(5,8,16,0.85)' });
        }
        if (H2.cols && H2.cols.length && st.scale === 'log' && H2.zx != null && H2.cols.some((p) => p[1] < YLO)) txt(c, '↓ to 0 at the zero date', H2.zx - 8, P.y + P.h - 10, { mono: true, size: 10, align: 'right', color: '#ffc4ef', plate: 'rgba(5,8,16,0.85)' });
        if (TT.length && st.v0 < TT[0] - 30 * DAY) {   // before the first sample the formula is not drawn
          const y0s = new Date(TT[0]).getUTCFullYear(), note = 'the formula is sampled from ' + (y0s <= 0 ? (1 - y0s) + ' BCE' : String(y0s)) + ' only', nx = X(TT[0]) - 10, nw = tw(c, note, N ? 10 : 11, 500, true);
          if (nx - nw > P.x + 4) txt(c, note, nx, P.y + P.h * 0.55, { mono: true, size: N ? 10 : 11, align: 'right', color: COL.ink3 });
        }
        H2.events = drawEvents(c);
        HT = H2; st.dirty = false; markViews();
      }
      // McKenna's picks: a marker per event on a strip under the axis, a short label under it when the view spans a year or more.
      // Labels sit in two rows; one that would touch another is left off (the marker stays, and its hover card has everything).
      // Returns what was drawn, for the hover hit-test and the phone checks.
      function drawEvents(c) {
        const out = { shown: false, items: [], y0: P.y + P.h + 30 };
        if (!EVS.length) return out;
        const y0 = out.y0, my = y0 + 9, size = N ? 10 : 11, span = st.v1 - st.v0;
        c.save(); c.strokeStyle = 'rgba(159,230,160,0.22)'; c.beginPath(); c.moveTo(P.x, my + 0.5); c.lineTo(P.x + P.w, my + 0.5); c.stroke(); c.restore();
        if (span < 360 * DAY) {
          txt(c, N ? 'events show at a year or more' : 'events show when the view spans a year or more', P.x + 4, y0 + 30, { mono: true, size, color: COL.ink3 });
          return out;
        }
        out.shown = true;
        const lanes = [[], []], maxC = N ? 16 : 24;
        EVS.forEach((e, i) => {
          const x = X(e.t); if (x < P.x - 1 || x > P.x + P.w + 1) return;
          // an exact day is a filled marker. Anything coarser (a year, a month, "c.", a range) is hollow, or a bar spanning the whole
          // period when the period is wide enough to draw: a filled point at its midpoint would claim more than the date does.
          const xa = clamp(X(e.a), P.x, P.x + P.w), xb = clamp(X(e.b), P.x, P.x + P.w), exact = e.precision === 'day';
          const kind = exact ? 'filled' : (xb - xa >= 10 ? 'bar' : 'hollow');
          c.save();
          if (kind === 'bar') {
            c.strokeStyle = EVC; c.lineWidth = 1.5; c.beginPath(); c.rect(xa + 0.75, my - 4.25, xb - xa - 1.5, 8.5); c.stroke();
          } else if (kind === 'hollow') {
            c.strokeStyle = EVC; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, my - 6); c.lineTo(x + 5, my); c.lineTo(x, my + 6); c.lineTo(x - 5, my); c.closePath(); c.stroke();
          } else {
            c.shadowColor = EVC; c.shadowBlur = 8; c.fillStyle = EVC; c.beginPath(); c.moveTo(x, my - 6); c.lineTo(x + 5, my); c.lineTo(x, my + 6); c.lineTo(x - 5, my); c.closePath(); c.fill();
          }
          c.restore();
          const lab = e.name.length > maxC ? e.name.slice(0, maxC - 1) + '\u2026' : e.name, lw = tw(c, lab, size, 600, true);
          let lx = clamp(x, 6 + lw / 2, W - 6 - lw / 2);
          const item = { i, name: e.name, label: null, x, y: my, rect: null, kind, x0: kind === 'bar' ? xa : x - 5, x1: kind === 'bar' ? xb : x + 5 };
          for (let k = 0; k < lanes.length; k++) {
            const ly = y0 + 28 + k * 15, r = { x0: lx - lw / 2 - 4, x1: lx + lw / 2 + 4, y0: ly - 11, y1: ly + 3 };
            if (lanes[k].some((o) => hitBox(o, r))) continue;
            lanes[k].push(r); item.label = lab; item.rect = r;
            txt(c, lab, lx, ly, { mono: true, size, weight: 600, align: 'center', color: '#d7f7d8' });
            break;
          }
          out.items.push(item);
        });
        return out;
      }
      function markViews() {
        const bs = $$('#mc-mck-views button'); if (!bs.length) return;
        const span = st.v1 - st.v0;
        bs.forEach((b) => { const v = viewFor(b.dataset.view); b.setAttribute('aria-pressed', String(!!v && Math.abs(st.v0 - v[0]) < 0.02 * span && Math.abs(st.v1 - v[1]) < 0.02 * span)); });
      }
      function viewFor(k) {
        if (k === 'next') return ZO ? clampView(...nearView()) : null;
        const L = k === '100' ? 100 : 5000;
        return clampView(TODAY_MS - L * YEAR, (ZO ? Z : TODAY_MS) + 0.4 * YEAR);
      }
      function drawDyn() {
        const c = dctx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
        const h = st.hover;
        if (h && h.y != null) { c.save(); c.strokeStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.moveTo(h.x, P.y); c.lineTo(h.x, P.y + P.h); c.stroke(); c.shadowColor = COL.mck; c.shadowBlur = 12; dot(c, h.x, h.y, 4, '#ffffff'); c.restore(); }
        if (st.sel) { const a = Math.min(st.sel.x0, st.sel.x1), b = Math.max(st.sel.x0, st.sel.x1); c.fillStyle = 'rgba(255,95,210,0.1)'; c.fillRect(a, P.y, b - a, P.h); c.strokeStyle = 'rgba(255,95,210,0.6)'; c.strokeRect(a + 0.5, P.y + 0.5, b - a - 1, P.h - 1); }
      }
      function hit(px, py) {
        if (!ready) return null;
        const t = Tx(px);
        if (HT && HT.events && HT.events.shown && py >= HT.events.y0 - 4) {
          let best = null, bd = 14;
          HT.events.items.forEach((q) => { const inLab = q.rect && px >= q.rect.x0 && px <= q.rect.x1 && py >= q.rect.y0 && py <= q.rect.y1, inBar = q.kind === 'bar' && px >= q.x0 - 4 && px <= q.x1 + 4 && Math.abs(py - q.y) <= 12, dd = inBar ? 0 : Math.abs(px - q.x) + (inLab ? 0 : Math.abs(py - q.y) * 0.5); if ((inLab || inBar || Math.abs(px - q.x) <= 14) && dd < bd + (inLab || inBar ? 14 : 0)) { bd = dd; best = q; } });
          if (best) return { kind: 'event', ev: EVS[best.i], x: best.x, y: best.y };
        }
        if (px < P.x || px > P.x + P.w || py < P.y - 10 || py > P.y + P.h + 4) return null;
        const dp = (HT && HT.dips || []).find((d) => Math.abs(px - d.hx) <= 9 && Math.abs(py - d.hy) <= 14);
        if (dp) return { kind: 'dip', t: dp.t, lv: dp.lo, x: dp.hx, y: dp.hy, past: dp.past };
        if (t > Z) return { kind: 'after' };
        if (t < TT[0]) return null;
        const i = clamp(bs(t), 0, TT.length - 1), j = i > 0 && Math.abs(TT[i - 1] - t) < Math.abs(TT[i] - t) ? i - 1 : i;
        return { kind: 'tw', t: TT[j], lv: VV[j], x: X(TT[j]), y: Y(VV[j]) };
      }
      function readout(h) {
        if (h.kind === 'event') {
          const e = h.ev;
          return card('One of McKenna\u2019s picks', EVC, e.name, e.text, ['McKenna: \u201c' + esc(e.quote) + '\u201d', 'Source: ' + esc(e.source),
            '<span style="color:#8693ab">' + esc(TW.events.rule) + '</span>']);
        }
        if (h.kind === 'dip') return card("McKenna's timewave " + badge('formula, not data', 'f'), COL.mck, 'Low point (a \u201cnovelty dip\u201d)', fmtMs(h.t), [
          'One of the deepest local lows in view (lower = more novel), value ' + Math.pow(10, h.lv).toPrecision(3) + '.',
          h.past ? 'A past low: compare it with what happened then. Lining lows up with events by eye is not a test: with enough events, some always line up.' : 'An upcoming low of the formula, not a predicted event.',
          ZO ? 'With its zero moved to the omega point, ' + fmtISO(ZO.o.date) + ': a formula placed by a fitted estimate.' : 'With McKenna\u2019s own zero date.',
          '<span style="color:#8693ab">' + esc(TW.no_claim) + '</span>'], TW.code);
        if (h.kind === 'after') return card("McKenna's timewave " + badge('formula, not data', 'f'), COL.mck, 'No curve after its zero date', null, ZO ? ['Its zero is moved to the omega point, ' + fmtISO(ZO.o.date) + ' (a fitted estimate).', esc(TW.anchor_rule)] : [esc(TW.anchor_rule)], TW.anchor_src);
        const v = Math.pow(10, h.lv);
        const daily = h.t < Z - NEAR * DAY;
        return card("McKenna's timewave " + badge('formula, not data', 'f'), COL.mck, TW.label, daily ? fmtMs(h.t) : new Date(h.t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC', [
          'Value ' + (v === 0 ? '0' : v < 1e-3 ? v.toExponential(2) : v.toPrecision(3)) + ' (unitless; lower = more novel). Drawn on its own fixed scale.',
          daily ? 'Daily sample (00:00 UTC).' : 'Log-spaced sample near the zero date.',
          ZO ? 'Zero moved to the omega point (' + fmtISO(ZO.o.date) + ', a fitted estimate); with McKenna\u2019s own zero date this sample falls on ' + fmtMs(h.t - SH) + '.' : '',
          '<span style="color:#8693ab">' + esc(TW.no_claim) + '</span>'], TW.code + '; number set: ' + TW.number_set.split(';')[0]);
      }
      function clampView(a, b) {
        const span = clamp(b - a, 7 * DAY, LIM[1] - LIM[0]); if (a < LIM[0]) a = LIM[0]; b = a + span; if (b > LIM[1]) { b = LIM[1]; a = b - span; } return [a, b];
      }
      function setLink(linked) {
        st.linked = linked;
        const el = $('#mc-mck-link');
        el.className = 'mc-chip' + (linked ? ' on' : '');
        el.textContent = linked ? 'Linked: same dates as the calendar view' : ZO ? '\u25bc the formula\u2019s upcoming lows \u00b7 \u25bd its past lows, same end date (lows, not events)' : 'Own range';
      }
      function userView(a, b) { autoOff(); st.own = true; [st.v0, st.v1] = clampView(a, b); st.anim = null; st.dirty = true; setLink(false); }
      function animateTo(a, b) { autoOff(); st.own = true; const [x, y] = clampView(a, b); st.anim = { a0: st.v0, b0: st.v1, a1: x, b1: y, s: performance.now(), dur: REDUCED ? 1 : 520 }; setLink(false); st.dirty = true; }
      function follow(c0, c1) {   // called when the calendar view changes: link while the calendar starts before the zero date
        if (c0 < Z) { const [a, b] = clampView(c0, c1); st.own = false; st.anim = null; st.v0 = a; st.v1 = b; setLink(true); st.dirty = true; }
        else if (st.linked) { st.own = false; st.v0 = OWN[0]; st.v1 = OWN[1]; setLink(false); st.dirty = true; }
      }
      const api = {
        plot: () => P, toT: Tx, toX: X, today: () => (ZO ? TODAY_MS : null),
        view: () => [st.v0, st.v1], span: () => st.v1 - st.v0, spanOf: (v) => v[1] - v[0], toTIn: (v, x) => v[0] + (x - P.x) / P.w * (v[1] - v[0]),
        place(span, tRef, f) { span = clamp(span, 7 * DAY, LIM[1] - LIM[0]); const a = tRef - f * span; userView(a, a + span); },
        range(a, b) { if (b - a < 7 * DAY) { const m = (a + b) / 2; a = m - 3.5 * DAY; b = m + 3.5 * DAY; } animateTo(a, b); },
        reset() { st.own = false; if (ZO) { animateTo(...nearView()); return; } if (C && C.st.v0 < Z) follow(C.st.v0, C.st.v1); else { st.anim = { a0: st.v0, b0: st.v1, a1: OWN[0], b1: OWN[1], s: performance.now(), dur: REDUCED ? 1 : 520 }; setLink(false); } st.dirty = true; },
        step: () => 0.3, pinchGain: 1.15,
        zoomBtn(dir) { const m = (st.v0 + st.v1) / 2, span = (st.v1 - st.v0) * (dir < 0 ? 0.5 : 2); animateTo(m - span / 2, m + span / 2); },
        select(s) { const old = st.sel; st.sel = s; return old; },
        hover(x, y) { const h = hit(x, y); st.hover = h; if (h) tip.show(readout(h), x, y, false); else tip.hide(); },
        tap(x, y, touch) { if (!ready && loadErr) { loadSamples(); return; } const h = hit(x, y); st.hover = h; if (h) tip.show(readout(h), x, y, touch); else tip.hide(); },
        leave() { st.hover = null; tip.hide(); },
        toast, onUser() { autoOff(); st.hover = null; tip.hide(); },
      };
      attachZoom(cv, api);
      cv.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') autoOff(); });   // a finger may just be scrolling
      $$('#mc-scale button').forEach((b) => b.addEventListener('click', () => {
        st.scale = b.dataset.scale; scaleUser = true; st.dirty = true; st.hover = null; tip.hide();
        $$('#mc-scale button').forEach((q) => q.setAttribute('aria-pressed', String(q === b)));
      }));
      $$('#mc-anchor button').forEach((b) => b.addEventListener('click', () => { MODE = b.dataset.anchor; applyZero(); }));
      $$('#mc-mck-views button').forEach((b) => b.addEventListener('click', () => { const v = viewFor(b.dataset.view); if (v) { st.hover = null; tip.hide(); animateTo(v[0], v[1]); } }));
      { const lg = $('#mc-legend-mck');
        if (lg && EVS.length && TW.events.legend) {
          lg.innerHTML = '<span><svg width="24" height="14" aria-hidden="true"><path d="M12 1 L18 7 L12 13 L6 7 Z" fill="' + EVC + '"/></svg>' + esc(TW.events.legend) + '</span>';
          lg.hidden = false;
        } }
      listHooks.push(() => { if (MODE === 'omega') applyZero(); });
      applyZero();
      whenSeen(box, () => { seenM = true; startAuto(); });
      $('#mc-mck-in').addEventListener('click', () => api.zoomBtn(-1));
      $('#mc-mck-out').addEventListener('click', () => api.zoomBtn(1));
      $('#mc-mck-reset').addEventListener('click', () => api.reset());
      function setFsLabel() { if (fsBtn) { const on = fsOn(); fsBtn.textContent = on ? 'Exit full screen' : 'Full screen'; fsBtn.setAttribute('aria-pressed', String(on)); } }
      function overlay(on) { sec.classList.toggle('mc-fs', on); document.documentElement.classList.toggle('mc-fs-lock', on); measure(); setFsLabel(); }
      function toggleFs() {
        if (fsOn()) { if (document.fullscreenElement === sec) document.exitFullscreen(); else overlay(false); return; }
        if (sec.requestFullscreen && document.fullscreenEnabled) sec.requestFullscreen().catch(() => overlay(true)); else overlay(true);
      }
      if (fsBtn) fsBtn.addEventListener('click', toggleFs);
      document.addEventListener('fullscreenchange', () => { measure(); setFsLabel(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sec.classList.contains('mc-fs')) overlay(false); });
      function frame(t) {
        if (C && C.st.changed) { C.st.changed = false; if (!ZO) follow(C.st.v0, C.st.v1); }
        if (st.anim) { const a = st.anim, k = clamp((t - a.s) / a.dur, 0, 1), e = (a.ease || easeOut)(k); st.v0 = a.a0 + (a.a1 - a.a0) * e; st.v1 = a.b0 + (a.b1 - a.b0) * e; if (k >= 1) st.anim = null; st.dirty = true; }
        if (st.dirty) render();
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(stat, 0, 0);
        drawDyn(t);
      }
      window.addEventListener('resize', () => { DPR = Math.min(2, window.devicePixelRatio || 1); measure(); });
      if (window.ResizeObserver) new ResizeObserver(() => { if (box.clientWidth !== W) measure(); }).observe(box);
      measure(); setLink(false);
      if (window.IntersectionObserver) { const lio = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { lio.disconnect(); loadSamples(); } }, { rootMargin: '600px 0px' }); lio.observe(box); }
      else loadSamples();
      return { frame, st, api, P: () => P, redrawDyn: () => drawDyn(), ready: () => ready, load: loadSamples, error: () => loadErr, dips: () => (HT && HT.dips ? HT.dips.map((d) => fmtMs(d.t)) : []), boxes: () => (HT && HT.boxes ? JSON.parse(JSON.stringify(HT.boxes)) : null), events: () => (HT && HT.events ? { shown: HT.events.shown, y0: HT.events.y0, n: EVS.length, items: HT.events.items.map((q) => ({ name: q.name, label: q.label, x: q.x, y: q.y, rect: q.rect, kind: q.kind, x0: q.x0, x1: q.x1 })) } : { shown: false, n: EVS.length, items: [] }), eventMs: () => EVS.map((e) => ({ name: e.name, t: e.t })), zeroX: () => (HT ? HT.zx : null), zero: () => ({ mode: MODE, omega: !!ZO, point: ZO ? ZO.o.date : null, z: Z }) };
    })();
    if (M) { charts.push(M); }

    // ============================================================ STEPS (owner's request, #31): the wait between events, as stairs
    // Prototype A's chart type: every list at once, on the hero's log time axis. Each event starts a step whose height is the
    // wait until the next event on its list and which runs until that event, so a falling staircase means shorter waits.
    // Kurzweil's milestones (his published estimates), every non-minor release from the labs (by rule) and the hero's
    // hand-picked list; after today, the registered test windows, the card's 50% range and the omega point (the card's
    // date). No best-fit curve here (owner's request, #80): the stairs alone; the curve is on the hero. Every value is read
    // from main_chart.json; nothing is fitted here. Text strings of this panel are awaiting Skeptic review (no approved_by).
    const STEPS = (function () {
      const box = $('#mc-box-steps'), cv = $('#mc-cv-steps'), cvd = $('#mc-cv-steps-dyn');
      if (!box || !cv || !cvd) return null;
      if (!B || !ok(D.kurzweil) || !ok(D.lists)) {   // nothing to draw: say so, and hide the dead controls (as the timewave panel does)
        pendingIn(box, 'Steps chart data pending: ' + ((!ok(D.kurzweil) ? D.kurzweil : D.lists) || {}).message);
        $$('#mc-steps .mc-controls, #mc-steps .mc-hint').forEach((el) => { el.hidden = true; });
        return null;
      }
      const ctx = cv.getContext('2d'), dctx = cvd.getContext('2d'), tip = makeTip(box), toast = makeToast(box);
      const dOf = (iso) => (isoMs(iso) - T0) / DAY;
      const COLP = '#ff8f6b', COLPL = '#ffc9b5', COLRL = '#bff4ff';
      // Kurzweil: each milestone's step runs to the next one (his table's own wait); the last one's next event is not in his table
      const KS = D.kurzweil.rows.map((r) => ({ kind: 'kurz', d: -r.years_before_today * YRD, g: r.time_to_next_event_years * YRD, row: r })).sort((a, b) => a.d - b.d);
      KS.forEach((e) => { e.end = e.d + e.g; });
      // every release (by rule): one step per release day, to the next release day from any lab; the last one is still open
      const RS = [];
      { const by = new Map(); REL.forEach((r, i) => { if (!by.has(r.date)) by.set(r.date, []); by.get(r.date).push(i); });
        [...by.keys()].sort().forEach((date) => RS.push({ kind: 'rule', d: dOf(date), date, idx: by.get(date) })); }
      RS.forEach((e, i) => { e.end = i < RS.length - 1 ? RS[i + 1].d : null; e.g = e.end != null ? e.end - e.d : null; e.upper = e.end != null && isoMs(e.date) + e.g * DAY > LAG_MS; });
      const RL = RS[RS.length - 1], RSG = RS.filter((e) => e.g > 0);
      const R_OPEN = RL && OPEN && OPEN.days_at_today > 0 ? { kind: 'open', ser: 'rule', d: RL.d, g: OPEN.days_at_today, lower: !!OPEN.is_lower_bound, e: RL } : null;
      // the hand-picked list on show in the hero (its default list while the hero shows the rule-defined one)
      const pickKey = () => { const k = curList(); return D.lists && D.lists[k] ? k : DEFAULT_LIST; };
      const PK = {};
      function picks(list) {
        if (PK[list]) return PK[list];
        const L = D.lists[list], out = [];
        L.rows.forEach((r) => { const d = dOf(r.date), q = out[out.length - 1]; if (q && q.d === d) q.rows.push(r); else out.push({ kind: 'pick', d, date: r.date, rows: [r] }); });
        out.forEach((e, i) => { e.end = i < out.length - 1 ? out[i + 1].d : null; e.g = e.end != null ? e.end - e.d : null; });
        const q = out[out.length - 1];
        const open = q && L.open_days_at_today > 0 ? { kind: 'open', ser: 'pick', d: q.d, g: L.open_days_at_today, lower: !!L.open_gap_is_lower_bound, e: q } : null;
        return (PK[list] = { list, label: L.label, n: L.rows.length, steps: out.filter((e) => e.g > 0), open });
      }

      // room after today: the hero's (to the latest omega band end), or at least to the end of the registered test windows
      const T_END = TESTS.length ? Math.max.apply(null, TESTS.map((T) => T.t1)) : 0;
      const FUTS = Math.max(B.fut, T_END > TODAY_MS ? Math.ceil((T_END - TODAY_MS) / DAY * 1.1 + 6) : 0);
      const FULL = B.full, MIN_SPAN = 7, AX = timeAxis(FULL, MIN_SPAN, FUTS), FULL_SPAN = AX.FULL_SPAN;
      // the s1900 preset starts where the calendar's widest view starts: the timewave's first daily sample (no date typed here)
      const D1900 = D.timewave && D.timewave.daily && D.timewave.daily.first_day ? dOf(D.timewave.daily.first_day) : null;
      const PRESETS = { all: { d0: FULL.d0, d1: 0 }, s1900: D1900 != null ? { d0: D1900, d1: FUTS } : null, y2: { d0: -2 * YRD, d1: FUTS }, d7: { d0: -7, d1: 0 } };
      const hasToday = (v) => v.d0 <= 1e-9 && v.d1 >= -1e-9;
      const st = { view: AX.clampView(PRESETS.all), yv: null, anim: null, hover: null, sel: null, dirty: true, on: { kurz: true, rule: ok(D.releases), pick: true }, preset: 'all' };
      if (!TRK) {   // no track record: no band, line or omega point to promise
        const af = $('#mc-steps-after'); if (af) af.hidden = true;
      }
      let W = 0, H = 0, N = false, P = null, S = null, HT = null;
      const stat = document.createElement('canvas'), sctx = stat.getContext('2d');
      function measure() {
        N = isNarrow(); W = box.clientWidth; H = N ? 380 : clamp(Math.round(window.innerHeight * 0.62), 420, 520);
        const padL = N ? 54 : 92, padR = N ? 30 : 36, padT = N ? 30 : 34, axisH = N ? 42 : 46;
        P = { x: padL, y: padT, w: W - padL - padR, h: H - padT - axisH };
        for (const c of [cv, cvd, stat]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
        cv.style.height = H + 'px'; cvd.style.height = H + 'px'; cvd.style.width = W + 'px';
        S = null; st.dirty = true;
      }
      const SCnow = () => { if (!S || S.v !== st.view || S.P !== P) S = AX.scale(st.view, P); return S; };
      const series = () => {
        const pk = picks(pickKey()), out = [];
        if (st.on.kurz) out.push({ key: 'kurz', steps: KS, open: null });
        if (st.on.rule && ok(D.releases)) out.push({ key: 'rule', steps: RSG, open: R_OPEN });
        if (st.on.pick) out.push({ key: 'pick', steps: pk.steps, open: pk.open, pk });
        return out;
      };
      function yTarget(Sx) {
        const v = Sx.v; let lo = Infinity, hi = -Infinity;
        const add = (g) => { if (!(g > 0)) return; const l = Math.log10(g); if (l < lo) lo = l; if (l > hi) hi = l; };
        for (const s of series()) {
          for (const e of s.steps) if (e.end >= v.d0 && e.d <= v.d1) add(e.g);
          if (s.open && s.open.d <= v.d1 && v.d0 <= 0) { add(s.open.g); add(s.open.g * 1.4); }
        }
        if (!isFinite(lo)) { lo = Math.log10(3); hi = Math.log10(200); }
        let span = hi - lo; const MINS = 1.25;
        if (span < MINS) { const m = (lo + hi) / 2; lo = m - MINS / 2; hi = m + MINS / 2; span = MINS; }
        lo -= 0.06 * span + 0.14; hi += 0.05 * span + 0.16;
        return { lo: Math.max(lo, Math.log10(0.4)), hi };
      }
      // the hero's fit and the card's omega point for the list shown here
      function omegaHere() {
        const k = pickKey(), o = OMEGA.of(k), f = B.fitOf(k);
        if (!o || o.pinned === 'upper') return null;
        return { o, f, band: o.cal ? { d0: (o.tlo - T0) / DAY, d1: (o.thi - T0) / DAY } : null };
      }

      function glow(c, build, color, core, w, blur) {
        c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
        c.strokeStyle = color; c.globalAlpha = 0.33; c.lineWidth = w * 3; c.shadowColor = color; c.shadowBlur = blur; build(); c.stroke();
        c.globalAlpha = 1; c.shadowBlur = blur * 0.5; c.lineWidth = w; c.strokeStyle = core; build(); c.stroke(); c.restore();
      }
      function render() {
        const c = sctx, v = st.view; SCnow();
        if (!st.yv) st.yv = yTarget(S);
        const yv = st.yv, yOf = (g) => P.y + P.h - (Math.log10(g) - yv.lo) / (yv.hi - yv.lo) * P.h;
        const X = (d) => clamp(S.x(d), P.x - 80, P.x + P.w + 80);
        const H2 = { marks: [], segs: [], tests: [], yOf, omega: null, band: null, proj: null, today: null, pulse: null };
        const occ = [], inPlot = (b) => b.x0 >= P.x + 2 && b.x1 <= P.x + P.w - 2 && b.y0 >= P.y + 2 && b.y1 <= P.y + P.h - 2;
        c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
        const todayIn = hasToday(v), xT = todayIn ? S.x(0) : null;
        // grid + ticks
        const yt = waitTicks(yv, P, N);
        c.lineWidth = 1;
        yt.forEach((t) => {
          c.strokeStyle = 'rgba(150,190,255,0.075)'; c.beginPath(); c.moveTo(P.x, Math.round(t.y) + 0.5); c.lineTo(P.x + P.w, Math.round(t.y) + 0.5); c.stroke();
          txt(c, t.label, P.x - 8, t.y + 4, { align: 'right', size: N ? 10 : 11, weight: 500, color: COL.ink3, mono: true });
        });
        const xt = timeTicks(S, c, xT, W, N);
        xt.forEach((t) => { c.strokeStyle = 'rgba(150,190,255,0.065)'; c.beginPath(); c.moveTo(Math.round(t.x) + 0.5, P.y); c.lineTo(Math.round(t.x) + 0.5, P.y + P.h); c.stroke(); });
        c.strokeStyle = 'rgba(150,190,255,0.3)'; c.beginPath(); c.moveTo(P.x, P.y + P.h + 0.5); c.lineTo(P.x + P.w, P.y + P.h + 0.5); c.stroke();
        xt.forEach((t) => txt(c, t.label, t.x, P.y + P.h + 18, { align: 'center', size: N ? 10 : 11, weight: 500, color: COL.ink2, mono: true }));
        txt(c, N ? '↑ WAIT UNTIL NEXT EVENT (LOG)' : '↑ WAIT UNTIL THE NEXT EVENT (LOG) · LOWER = SOONER', N ? 8 : 12, P.y - 14, { size: N ? 9.5 : 10.5, weight: 600, color: COL.ink3, mono: true });
        const linear = (v.d1 - v.d0) / S.tau < 2.5;
        txt(c, linear ? (N ? 'CALENDAR (ZOOMED IN)' : 'CALENDAR TIME (ZOOMED IN)') : (N ? '← TIME BEFORE TODAY (LOG)' : '← TIME BEFORE TODAY (LOG SCALE)'), P.x, H - 7, { size: N ? 9 : 10, weight: 600, color: COL.ink3, mono: true });

        c.save(); c.beginPath(); c.rect(P.x, P.y - 1, P.w, P.h + 2); c.clip();
        // after today: the registered test windows, then the card's 50% range
        TESTS.forEach((T) => {
          const da = (T.t0 - T0) / DAY, db = (T.t1 - T0) / DAY; if (db < v.d0 || da > v.d1) return;
          const xa = clamp(S.x(da), P.x, P.x + P.w), xb = clamp(S.x(db), P.x, P.x + P.w); if (xb - xa < 0.5) return;
          c.fillStyle = 'rgba(201,230,255,0.06)'; c.fillRect(xa, P.y, xb - xa, P.h);
          c.strokeStyle = 'rgba(201,230,255,0.28)'; c.lineWidth = 1; c.beginPath(); c.moveTo(Math.round(xa) + 0.5, P.y); c.lineTo(Math.round(xa) + 0.5, P.y + P.h); c.stroke();
          H2.tests.push({ T, x0: xa, x1: xb });
        });
        const OM = omegaHere();
        if (OM && OM.band) {
          const xa = clamp(S.x(OM.band.d0), P.x, P.x + P.w), xb = clamp(S.x(OM.band.d1), P.x, P.x + P.w);
          if (xb - xa > 0.5) {
            const g = c.createLinearGradient(0, P.y, 0, P.y + P.h); g.addColorStop(0, 'rgba(255,200,97,0.05)'); g.addColorStop(1, 'rgba(255,200,97,0.15)');
            c.fillStyle = g; c.fillRect(xa, P.y, xb - xa, P.h);
            c.save(); c.strokeStyle = 'rgba(255,200,97,0.45)'; c.lineWidth = 1; c.setLineDash([3, 4]);
            [[OM.band.d0, xa], [OM.band.d1, xb]].forEach(([d, x]) => { if (S.inView(d)) { c.beginPath(); c.moveTo(Math.round(x) + 0.5, P.y); c.lineTo(Math.round(x) + 0.5, P.y + P.h); c.stroke(); } });
            c.restore(); H2.band = { x0: xa, x1: xb };
          }
        }
        // the Epoch-lag zone while every release is shown: a release gap that ends inside it is an upper bound (hollow mark)
        if (st.on.rule && ok(D.releases)) {
          const dl = (LAG_MS - T0) / DAY;
          if (dl < v.d1 && v.d0 < 0) {
            const xa = Math.max(P.x, S.x(Math.max(dl, v.d0))), xb = Math.min(P.x + P.w, S.x(Math.min(0, v.d1)));
            if (xb - xa > 0.5) { c.fillStyle = hatch(c); c.fillRect(xa, P.y, xb - xa, P.h); c.fillStyle = 'rgba(201,214,238,0.035)'; c.fillRect(xa, P.y, xb - xa, P.h); }
          }
        }
        // the steps
        const path = (arr) => {
          const sg = [];
          for (const e of arr) {
            if (e.end < v.d0) continue;
            if (e.d > v.d1) break;
            sg.push({ x0: X(e.d), x1: X(e.end), y: yOf(e.g), e });
          }
          H2.segs.push(...sg);
          return () => { c.beginPath(); sg.forEach((q, i) => { if (i) c.lineTo(q.x0, q.y); else c.moveTo(q.x0, q.y); c.lineTo(q.x1, q.y); }); };
        };
        const SR = series();
        for (const s of SR) {
          if (s.key === 'kurz') glow(c, path(s.steps), COL.kurz, COL.kurzL, N ? 1.4 : 1.7, 12);
          if (s.key === 'rule') glow(c, path(s.steps), COL.ai, COLRL, N ? 1.1 : 1.35, 9);
          if (s.key === 'pick') glow(c, path(s.steps), COLP, COLPL, N ? 1.2 : 1.5, 8);
        }
        // open gaps: dotted, from the last event of the list to today (a lower bound when the list says so)
        for (const s of SR) {
          const O = s.open; if (!O || O.d > v.d1 || v.d0 > 0) continue;
          const col = s.key === 'rule' ? COLRL : COLPL, last = s.steps[s.steps.length - 1];
          const xa = X(O.d), xb = X(0), y = yOf(O.g);
          c.save(); c.strokeStyle = col; c.lineWidth = 1.4; c.setLineDash([2, 4]); c.beginPath();
          if (last && last.end === O.d) c.moveTo(xa, yOf(last.g)), c.lineTo(xa, y); else c.moveTo(xa, y);
          c.lineTo(xb, y); c.stroke(); c.restore();
          if (O.lower) { c.save(); c.strokeStyle = col; c.lineWidth = 1.4; c.beginPath(); c.moveTo(xb - 4, y + 1); c.lineTo(xb, y - 5); c.lineTo(xb + 4, y + 1); c.stroke(); c.restore(); }
          H2.segs.push({ x0: xa, x1: xb, y, e: O });
          occ.push({ x0: xa - 4, y0: y - 6, x1: xb + 4, y1: y + 6 });
          if (!H2.pulse || s.key === 'rule') H2.pulse = { x: xb, y };
        }
        // markers: Kurzweil's milestones and the picks (rings); release days as small dots while they are far enough apart
        const nVisR = SR.some((s) => s.key === 'rule') ? RS.filter((e) => e.d >= v.d0 && e.d <= v.d1).length : 0;
        for (const s of SR) {
          for (const it of s.steps.map((e) => ({ e, g: e.g })).concat(s.open ? [{ e: s.open, g: s.open.g }] : [])) {
            const e = it.e, g = it.g;
            if (e.d < v.d0 || e.d > v.d1 || !(g > 0)) continue;
            const x = S.x(e.d), y = yOf(g);
            if (s.key === 'rule') {
              if (nVisR <= P.w / 6) { if (e.upper) ring(c, x, y, N ? 2.6 : 3, COLRL, 1.3, true); else dot(c, x, y, N ? 1.8 : 2.2, COLRL); }
              H2.marks.push({ x, y, e, ser: 'rule', r: 4 }); continue;
            }
            const r = s.key === 'kurz' ? (N ? 3.4 : 4) : (N ? 3.6 : 4.4), col = s.key === 'kurz' ? COL.kurzL : COLPL;
            // Kurzweil's milestones are all estimates; a pick is hollow when its date is an estimate, filled when exact
            if (s.key === 'kurz' || e.kind === 'open' || (e.rows && e.rows.some((q) => q.estimate))) ring(c, x, y, r, col, s.key === 'kurz' ? 1.6 : 1.8, true);
            else { dot(c, x, y, r + 1.4, COL.bg); dot(c, x, y, r - 0.3, col); }
            H2.marks.push({ x, y, e, ser: s.key, r: r + 2 }); occ.push({ x0: x - r - 3, y0: y - r - 3, x1: x + r + 3, y1: y + r + 3 });
          }
        }
        // the omega point (the card's date) on the time axis; no best-fit curve on this chart (owner's request, #80)
        if (OM && OM.f && OM.f.tsD > 0 && S.inView(OM.f.tsD)) H2.omega = { x: S.x(OM.f.tsD), y: P.y + P.h, point: OM.f.point };
        c.restore();
        if (H2.omega) {
          const o = H2.omega;
          c.save(); c.strokeStyle = 'rgba(255,200,97,0.35)'; c.lineWidth = 1; c.setLineDash([2, 4]); c.beginPath(); c.moveTo(Math.round(o.x) + 0.5, P.y); c.lineTo(Math.round(o.x) + 0.5, o.y); c.stroke(); c.restore();
          c.save(); c.shadowColor = COL.omega; c.shadowBlur = 16; dot(c, o.x, o.y, N ? 5 : 6, COL.omega); c.restore();
          dot(c, o.x, o.y, N ? 2.2 : 2.6, '#fff6e0');
          occ.push({ x0: o.x - 10, y0: o.y - 12, x1: o.x + 10, y1: o.y + 10 });
        }
        // TODAY
        if (xT != null) {
          c.save(); c.strokeStyle = 'rgba(234,242,255,0.55)'; c.lineWidth = 1.2; c.shadowColor = 'rgba(56,217,245,0.9)'; c.shadowBlur = 8;
          c.beginPath(); c.moveTo(xT, P.y - 4); c.lineTo(xT, P.y + P.h); c.stroke(); c.restore();
          const lab = 'TODAY · ' + (N ? fmtMD(TODAY_MS) : fmtMs(TODAY_MS)).toUpperCase(), lw = tw(c, lab, N ? 10.5 : 11.5, 700, true);
          txt(c, lab, clamp(xT, P.x + lw / 2, W - 4 - lw / 2), P.y - 14, { align: 'center', size: N ? 10.5 : 11.5, weight: 700, mono: true, color: '#ffffff', glow: 'rgba(56,217,245,0.9)', glowB: 12 });
          occ.push({ x0: xT - 8, y0: P.y, x1: xT + 8, y1: P.y + P.h }); H2.today = { x: xT };
          if (!H2.pulse) H2.pulse = { x: xT, y: P.y + P.h * 0.5 };
        } else {
          const right = v.d1 < 0; H2.pulse = null;
          const tw0 = txt(c, right ? 'TODAY →' : '← TODAY', right ? P.x + P.w - 4 : P.x + 6, right ? P.y - 14 : P.y + 16, { align: right ? 'right' : 'left', size: N ? 10.5 : 11.5, weight: 700, mono: true, color: COL.ink, halo: !right });
          if (!right) occ.push({ x0: P.x + 2, y0: P.y + 2, x1: P.x + 10 + tw0, y1: P.y + 21 });
        }
        if (H2.pulse) occ.push({ x0: H2.pulse.x - 16, y0: H2.pulse.y - 16, x1: H2.pulse.x + 16, y1: H2.pulse.y + 16 });

        // ---- labels, in priority order, never on data or on each other
        const place = (cands, lines, opt) => {
          const sizes = lines.map((_, i) => (opt.sizes && opt.sizes[i]) || (i ? (opt.size || 12) - 1.5 : (opt.size || 12)));
          const weights = lines.map((_, i) => (opt.weights && opt.weights[i]) || (i ? 500 : 650)), lhs = sizes.map((z) => z + 4);
          let w = 0; lines.forEach((s, i) => { w = Math.max(w, tw(c, s, sizes[i], weights[i])); });
          const h = lhs.reduce((a, b) => a + b, 0);
          for (const [x, y, al] of cands) {
            const x0 = al === 'right' ? x - w : al === 'center' ? x - w / 2 : x;
            const b = { x0: x0 - 4, y0: y - sizes[0] - 2, x1: x0 + w + 4, y1: y - sizes[0] - 2 + h + 4 };
            if (!inPlot(b) || occ.some((o) => hitBox(b, o))) continue;
            let yy = y; lines.forEach((s, i) => { txt(c, s, x0, yy, { size: sizes[i], weight: weights[i], color: (opt.colors && opt.colors[i]) || (i ? COL.ink2 : COL.ink), halo: true }); yy += lhs[i]; });
            occ.push(b); return b;
          }
          return null;
        };
        // test tags at the top of their windows
        H2.tests.forEach((t) => {
          const lab = 'TEST ' + t.T.id, w = tw(c, lab, N ? 9 : 10, 700, true), xm = (t.x0 + t.x1) / 2;
          if (t.x1 - t.x0 < 6 || xm - w / 2 - 5 < P.x || xm + w / 2 + 5 > P.x + P.w) return;
          const b = { x0: xm - w / 2 - 5, y0: P.y + 4, x1: xm + w / 2 + 5, y1: P.y + 20 };
          if (occ.some((o) => hitBox(b, o))) return;
          c.fillStyle = 'rgba(10,20,36,0.92)'; rr(c, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, 3); c.fill(); c.strokeStyle = 'rgba(201,230,255,0.45)'; c.lineWidth = 1; c.stroke();
          txt(c, lab, xm, b.y1 - 4.5, { align: 'center', size: N ? 9 : 10, weight: 700, mono: true, color: '#dcefff' }); occ.push(b); t.tag = b;
        });
        if (H2.omega) {
          const o = H2.omega, ca = [], xl = H2.today ? Math.min(o.x, H2.today.x) - 14 : o.x - 12;
          for (let dy = 12; dy <= 150; dy += 14) ca.push([o.x + 12, o.y - dy, 'left'], [o.x - 12, o.y - dy, 'right']);
          for (let dy = 12; dy <= 220; dy += 14) ca.push([xl, o.y - dy, 'right']);
          const other = curList() !== pickKey(), pn = picks(pickKey()).n;   // the hero shows every release: this is the default list's date
          const b = place(ca, [N ? 'Omega point' : 'Omega point: ' + fmtISO(o.point) + ' (est.)', N ? fmtISO(o.point) + ' (est.)' : other ? 'of the ' + pn + ' picks shown here' : 'a fitted estimate, from the main chart'], { sizes: N ? [11, 10.5] : [12.5, 11.5], weights: [700, 500], colors: [COL.omega, '#ffe6b8'] });
          if (b) {
            H2.omegaLabel = b;
            if (b.x1 < o.x - 16) { c.save(); c.strokeStyle = 'rgba(255,200,97,0.5)'; c.setLineDash([2, 3]); c.lineWidth = 1; c.beginPath(); c.moveTo(b.x1 - 6, b.y1 + 2); c.lineTo(o.x, o.y - 8); c.stroke(); c.restore(); }
          }
        }
        if (H2.band && H2.band.x1 - H2.band.x0 > (N ? 30 : 44)) {
          const xm = (H2.band.x0 + H2.band.x1) / 2, ca = [];
          for (let yy = P.y + 34; yy < P.y + P.h * 0.5; yy += 14) ca.push([xm, yy, 'center'], [H2.band.x1 - 4, yy, 'right']);
          H2.bandLabel = place(ca, N ? ['50%', 'range'] : ['50% range', '(provisional)'], { sizes: N ? [10, 9.5] : [11, 10.5], weights: [650, 500], colors: ['#ffd27a', 'rgba(255,214,140,0.8)'] });
        }
        // Kurzweil's key milestones by name
        const fs = N ? 10 : 11;
        H2.marks.filter((m) => m.ser === 'kurz' && m.e.row.key).sort((a, b) => a.e.row.label_rank - b.e.row.label_rank).forEach((m) => {
          const s = m.e.row.label, w = tw(c, s, fs, 600);
          const r = m.r + 2, up = m.y - r - 4, dn = m.y + r + 2 + fs;
          for (const [x, y, al] of [[m.x + r + 3, m.y + fs / 2 - 1, 'left'], [m.x + 2, up, 'left'], [m.x - 2, dn, 'right'], [m.x - 2, up, 'right'], [m.x + 2, dn, 'left'], [m.x, up, 'center'], [m.x, dn, 'center'], [m.x - r - 3, m.y + fs / 2 - 1, 'right']]) {
            const x0 = al === 'right' ? x - w : al === 'center' ? x - w / 2 : x, b = { x0: x0 - 2, y0: y - fs, x1: x0 + w + 2, y1: y + 3 };
            if (!inPlot(b) || occ.some((o) => hitBox(b, o))) continue;
            txt(c, s, x0, y, { size: fs, weight: 600, color: COL.kurzL, halo: true }); occ.push(b); break;
          }
        });
        // two notes from the prototype: what makes the straight line, and what makes the plunge
        const kVis = H2.marks.filter((m) => m.ser === 'kurz'), rVis = H2.marks.filter((m) => m.ser === 'rule');
        if (kVis.length >= 4) {
          const ca = [], mid = kVis.slice().sort((a, b) => a.x - b.x);
          mid.slice(Math.floor(mid.length * 0.3), Math.floor(mid.length * 0.8)).forEach((m) => ca.push([m.x + 16, m.y + 34, 'left'], [m.x - 16, m.y + 40, 'right']));
          for (let yy = P.y + P.h * 0.55; yy < P.y + P.h - 30; yy += 16) ca.push([P.x + 14, yy, 'left']);
          place(ca, N ? ['Kurzweil chose these milestones:', 'his list makes the straight line'] : ['Kurzweil chose these milestones;', 'his list is what makes the straight line'], { size: N ? 11 : 12, colors: ['#d3caff', COL.ink2] });
        }
        let dropMiss = false;
        if (kVis.length && rVis.length) {
          const kLast = kVis.reduce((a, b) => (b.x > a.x ? b : a)), rFirst = rVis.reduce((a, b) => (b.x < a.x ? b : a)), ca = [];
          const xm = (kLast.x + rFirst.x) / 2, ym = (kLast.y + rFirst.y) / 2;
          for (let dy = 0; dy <= 120; dy += 14) ca.push([rFirst.x - 14, rFirst.y - 26 - dy, 'right'], [xm, ym + 40 + dy, 'center'], [xm, ym - 30 - dy, 'center']);
          dropMiss = !place(ca, N ? ['The drop is a list switch:', 'milestones → every release'] : ['This drop comes from switching lists:', 'milestones → every release from ' + (ok(D.releases) ? D.releases.labs.length + ' labs' : 'the labs')], { size: N ? 11 : 12, colors: ['#ffffff', COL.ink2] });
        }
        capLine('#mc-steps-cap', dropMiss ? 'The big drop where Kurzweil\u2019s milestones meet the AI releases comes from switching lists, not from a measured speed-up.' : '');
        HT = H2; st.dirty = false;
      }

      // ---- animated layer: TODAY pulse, hover, selection
      function drawDyn(t) {
        const c = dctx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
        if (!HT) return;
        if (HT.pulse && HT.today) {
          const { x, y } = HT.pulse, ph = REDUCED ? 0.35 : (t % 2000) / 2000;
          for (let k = 0; k < 2; k++) { const q = (ph + k * 0.5) % 1; c.beginPath(); c.arc(x, y, 5 + q * (N ? 11 : 14), 0, Math.PI * 2); c.strokeStyle = 'rgba(120,235,255,' + (0.8 * (1 - q)).toFixed(3) + ')'; c.lineWidth = 1.7; c.stroke(); }
          c.save(); c.shadowColor = 'rgba(56,217,245,1)'; c.shadowBlur = 16; dot(c, x, y, N ? 4.6 : 5.4, '#ffffff'); c.restore();
        }
        const h = st.hover;
        if (h && h.x != null) { c.save(); c.shadowColor = 'rgba(255,255,255,0.9)'; c.shadowBlur = 12; ring(c, h.x, h.y, 9, '#ffffff', 1.5, false); c.restore(); }
        if (st.sel) {
          const a = Math.min(st.sel.x0, st.sel.x1), b = Math.max(st.sel.x0, st.sel.x1);
          c.fillStyle = 'rgba(56,217,245,0.12)'; c.fillRect(a, P.y, b - a, P.h);
          c.strokeStyle = 'rgba(56,217,245,0.8)'; c.lineWidth = 1; c.strokeRect(a + 0.5, P.y + 0.5, b - a - 1, P.h - 1);
        }
      }

      // ---- hit testing and readouts
      const inB = (b, x, y) => b && x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
      function hit(x, y, touch) {
        if (!HT) return null;
        const R = touch ? 20 : 11; let best = null, bd = R * R;
        for (const m of HT.marks) { const dd = (m.x - x) ** 2 + (m.y - y) ** 2; if (dd < bd) { bd = dd; best = { x: m.x, y: m.y, e: m.e, ser: m.ser }; } }
        if (best) return best;
        if ((HT.omega && Math.hypot(x - HT.omega.x, y - HT.omega.y) < (touch ? 22 : 14)) || inB(HT.omegaLabel, x, y)) return { type: 'omega' };
        let seg = null, sd = touch ? 12 : 6;
        for (const s of HT.segs) if (x >= s.x0 - 1 && x <= s.x1 + 1 && Math.abs(y - s.y) < sd) { sd = Math.abs(y - s.y); seg = s; }
        if (seg) return { x: null, e: seg.e, ser: seg.e.ser || seg.e.kind };
        for (const t of HT.tests) if (inB(t.tag, x, y) || (x >= t.x0 && x <= t.x1 && y >= P.y && y <= P.y + 40)) return { type: 'test', T: t.T };
        if (inB(HT.bandLabel, x, y) || (HT.band && x >= HT.band.x0 && x <= HT.band.x1 && y >= P.y && y <= P.y + P.h)) return { type: 'band' };
        return null;
      }
      function readout(h) {
        if (h.type === 'test') return testCard(h.T);
        if (h.type === 'omega' || h.type === 'band') {
          const OM = omegaHere(); if (!OM) return null;
          const o = OM.o;
          if (h.type === 'band') return card('50% range ' + badge('provisional'), COL.omega, rangeSpan(o), null, [esc(rangeNote(o)), 'The omega point inside it: ' + esc(fmtISO(o.date)) + '. A fitted estimate, not a forecast; updated weekly.'], 'track_record + card_range');
          return card('Omega point ' + badge('fitted estimate'), COL.omega, fmtISO(o.date), 'refit ' + fmtISO(o.last.refit_date), [
            'If the speed-up continues: the main chart’s best-fit curve (Kurzweil’s milestones and the ' + esc(picks(pickKey()).label) + ') reaches zero wait here. The curve itself is drawn on the main chart only.',
            curList() !== pickKey() ? 'The main chart shows every release, which has no fitted date; this is the date of the ' + esc(picks(pickKey()).label) + ' shown here.' : null,
            o.cal ? '50% range (provisional): ' + esc(rangeSpan(o)) + '.' : null,
            'A fitted estimate, not a forecast. It is refit every week and has kept moving.'], 'track_record');
        }
        const e = h.e;
        if (e.kind === 'kurz') {
          const r = e.row;
          return card("Kurzweil's milestone " + badge('estimate'), COL.kurz, r.label, 'approx. ' + r.approx_when.replace(/^about /, '') + ' · ≈ ' + fmtYears(r.years_before_today) + ' before today', [
            r.next_label ? 'Wait until his next milestone (' + esc(r.next_label) + '): ' + fmtYears(r.time_to_next_event_years) + '.' : 'Wait to his next event: ' + fmtYears(r.time_to_next_event_years) + ' (not in his table).',
            esc(D.kurzweil.estimate_note)], r.source);
        }
        if (e.kind === 'open') {
          const q = e.e;
          if (e.ser === 'rule') return card('Last recorded release · ' + D.releases.labs.length + ' labs', COL.ai, q.idx.map((i) => REL[i].model).join(' + '), fmtISO(q.date), ['<b>' + e.g + ' days</b> since this release. ' + esc(OPEN.reads)]);
          return card('Last model on this list · ' + esc(lowerFirst(picks(pickKey()).label)), COLP, q.rows[0].model, fmtISO(q.date), ['No newer model on this list yet: <b>' + e.g + ' days and counting</b> as of today. A lower bound on this wait, not a completed wait: the dots stop at today.']);
        }
        if (e.kind === 'rule') {
          const rows = e.idx.map((i) => REL[i]);
          const names = rows.slice(0, 5).map((r) => esc(r.model) + ' <span style="color:#8693ab">(' + esc(r.lab) + ')</span>').join(', ') + (rows.length > 5 ? ', +' + (rows.length - 5) + ' more' : '');
          return card('AI release · ' + D.releases.labs.length + ' labs, rule-defined' + (e.upper ? ' ' + badge('upper bound', 'b') : ''), COL.ai, rows.length > 1 ? rows.length + ' releases this day' : rows[0].model, fmtISO(e.date), [
            rows.length > 1 ? names : esc(rows[0].lab), 'Next release from any of the labs: ' + fmtDays(e.g) + ' later.', e.upper ? esc(D.releases.lag_note) : null]);
        }
        const r = e.rows[0];
        return card('Hand-picked model · ' + esc(lowerFirst(picks(pickKey()).label)) + (r.estimate ? ' ' + badge('estimate') : ''), COLP, e.rows.map((q) => q.model).join(' + '), fmtISO(e.date), [
          'Next model on this list: ' + fmtDays(e.g) + ' later.', e.rows.some((q) => q.frozen === false) ? 'Shown only: added after the list was frozen (Oct 22), so the best-fit curve and the omega point do not use it.' : null, r.date_note ? esc(r.date_note) : null]);
      }

      // ---- view control
      function markPreset(key) { st.preset = key; $$('#mc-preset-steps button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === key))); }
      function setView(v) { st.anim = null; st.view = AX.clampView(v); st.dirty = true; markPreset(null); }
      function animateTo(to, key) {
        st.anim = { from: { ...st.view }, to: AX.clampView({ d0: to.d0, d1: to.d1, tau: to.tau }), t0: performance.now(), dur: REDUCED ? 1 : 620 };
        markPreset(key); st.hover = null; tip.hide(); st.dirty = true;
      }
      function stepLn(span) { const L = Math.log10(span), a = Math.log10(3 * YRD), b = Math.log10(3e4 * YRD); return 0.3 + 0.45 * clamp((L - a) / (b - a), 0, 1); }
      const api = {
        plot: () => P, toT: (x) => SCnow().inv(x), toX: (d) => SCnow().x(d), today: () => (hasToday(st.view) ? 0 : null),
        view: () => ({ ...st.view }), span: () => st.view.d1 - st.view.d0, spanOf: (v) => v.d1 - v.d0,
        toTIn: (v, x) => AX.scale(v, P).inv(x),
        place(span, dRef, f, view0) { if (view0) setView(AX.panView(view0, dRef, f)); else setView(AX.zoomView(span, dRef, f)); },
        range(a, b) { let d0 = a, d1 = b; if (d1 - d0 < MIN_SPAN) { const m = (d0 + d1) / 2; d0 = m - MIN_SPAN / 2; d1 = m + MIN_SPAN / 2; } animateTo({ d0, d1 }, null); },
        reset() { st.yv = null; animateTo(PRESETS.all, 'all'); },
        step: stepLn, pinchGain: 2.2, pull: () => 1,
        zoomBtn(dir) {
          const v = st.view, inView = hasToday(v), dRef = inView ? 0 : SCnow().inv(P.x + P.w / 2), f = inView ? clamp((SCnow().x(0) - P.x) / P.w, 0, 1) : 0.5;
          const sp = clamp((v.d1 - v.d0) * Math.exp(dir * 3 * stepLn(v.d1 - v.d0)), MIN_SPAN, FULL_SPAN);
          if (sp >= FULL_SPAN * 0.999) { animateTo(PRESETS.all, 'all'); return; } animateTo(AX.zoomView(sp, dRef, f), null);
        },
        select(s) { const old = st.sel; st.sel = s; return old; },
        hover(x, y) { const h = hit(x, y, false); st.hover = h; const html = h && readout(h); if (html) tip.show(html, x, y, false); else tip.hide(); cv.style.cursor = h ? 'pointer' : 'crosshair'; },
        tap(x, y, touch) { const h = hit(x, y, touch); st.hover = h; const html = h && readout(h); if (html) tip.show(html, x, y, touch); else tip.hide(); },
        leave() { st.hover = null; tip.hide(); },
        toast, onUser() { st.hover = null; tip.hide(); },
      };
      attachZoom(cv, api);
      $$('#mc-preset-steps button').forEach((b) => { if (!PRESETS[b.dataset.preset]) { b.hidden = true; return; } b.addEventListener('click', () => animateTo(PRESETS[b.dataset.preset], b.dataset.preset)); });
      $('#mc-steps-in').addEventListener('click', () => api.zoomBtn(-1));
      $('#mc-steps-out').addEventListener('click', () => api.zoomBtn(1));
      $('#mc-steps-reset').addEventListener('click', () => api.reset());
      function paintSeries() {
        const pk = picks(pickKey());
        $$('#mc-steps-series button').forEach((b) => {
          const k = b.dataset.ser; b.setAttribute('aria-pressed', String(!!st.on[k]));
          if (k === 'pick') b.querySelector('.t').textContent = pk.n + ' hand-picked models';
          if (k === 'rule') b.hidden = !ok(D.releases);
        });
      }
      $$('#mc-steps-series button').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.ser; st.on[k] = !st.on[k];
        if (!st.on.kurz && !st.on.rule && !st.on.pick) st.on[k] = true;   // one list always stays on
        st.hover = null; tip.hide(); st.dirty = true; paintSeries();
      }));
      listHooks.push(() => { st.dirty = true; st.hover = null; tip.hide(); paintSeries(); });
      function frame(t) {
        if (st.anim) {
          const a = st.anim, p = clamp((t - a.t0) / a.dur, 0, 1), e = easeOut(p);
          st.view = AX.clampView({ d0: slogInv(slog(a.from.d0) + (slog(a.to.d0) - slog(a.from.d0)) * e), d1: slogInv(slog(a.from.d1) + (slog(a.to.d1) - slog(a.from.d1)) * e), tau: Math.exp(Math.log(a.from.tau) + (Math.log(a.to.tau) - Math.log(a.from.tau)) * e) });
          if (p >= 1) { st.view = { ...a.to }; st.anim = null; }
          st.dirty = true;
        }
        if (st.yv && S) {
          const yt = yTarget(SCnow()), dl = yt.lo - st.yv.lo, dh = yt.hi - st.yv.hi;
          if (Math.abs(dl) > 0.002 || Math.abs(dh) > 0.002) { const k = REDUCED ? 1 : 0.22; st.yv.lo += dl * k; st.yv.hi += dh * k; st.dirty = true; }
        }
        if (st.dirty) render(t);
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(stat, 0, 0);
        drawDyn(t);
      }
      window.addEventListener('resize', () => { DPR = Math.min(2, window.devicePixelRatio || 1); measure(); });
      if (window.ResizeObserver) new ResizeObserver(() => { if (box.clientWidth !== W) measure(); }).observe(box);
      paintSeries(); measure();
      return { frame, st, api, box, P: () => P, ht: () => HT, xOf: (d) => SCnow().x(d), go: (k) => animateTo(PRESETS[k], k), show: (d0, d1) => setView({ d0, d1 }) };
    })();
    if (STEPS) charts.push(STEPS);

    // ============================================================ frame loop (charts off screen are skipped)
    const onScreen = new Map();
    if (window.IntersectionObserver) {
      const io = new IntersectionObserver((es) => es.forEach((e) => onScreen.set(e.target, e.isIntersecting)), { rootMargin: '120px' });
      charts.forEach((ch) => { const b = ch.box || (ch === C ? $('#mc-box-cal') : $('#mc-box-mck')); ch._box = b; onScreen.set(b, true); io.observe(b); });
    }
    function loop(t) {
      for (const ch of charts) if (!ch._box || onScreen.get(ch._box) !== false || (ch.st && (ch.st.anim || ch.st.dirty))) ch.frame(t);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // read-only hooks for the screenshot and interaction checks
    window.__mainChart = {
      B: B && { fit: B.fit, hoverAt: (x, y) => { B.api.hover(x, y); const el = B.box.querySelector('.mc-tip'); return el && !el.hidden ? el.textContent : ''; }, setList: B.setList, go: B.go, show: B.show, view: () => ({ ...B.st.view }), preset: () => B.st.preset, plot: B.P, xOf: B.xOf, dOf: B.dOf, aiOnly: B.isAiOnly, anim: () => !!B.st.anim, lists: B.lists,
        ht: () => { const h = B.ht(); return h ? { pulse: h.pulse, today: h.today, caption: h.caption, edge: h.edge, aiLink: h.aiLink, omega: h.omega || null, omegaLabel: h.omegaLabel || null, band: h.band || null, bandLabel: h.bandLabel || null, proj: h.proj || null, kzLabels: h.kzLabels.map((l) => ({ x0: l.x0, x1: l.x1, y0: l.y0, y1: l.y1, label: l.h.p.row.label })), pts: h.pts.map((q) => ({ x: q.x, y: q.y, kind: q.kind, label: q.p.row ? q.p.row.label : null })) } : null; } },
      C: C && { preset: C.preset, setMode: C.setMode, show: C.show, testLabels: () => C.ht().testLabels, testsInView: () => C.ht().tests.map((v) => v.T.id), view: () => ({ v0: C.st.v0, v1: C.st.v1 }), plot: C.P, X: C.X, drops: () => C.ht().drops.map((d) => ({ rank: d.dr.rank, x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1, text: d.used.filter(Boolean).join(' | ') })), laneTag: () => C.ht().laneTag, noPace: () => C.ht().noPace, occ: C.occ, omega: () => { const h = C.ht(); return { band: h.omega, label: h.omegaLabel, mark: h.omegaMark, ghost: h.ghost.length }; } },
      STEPS: STEPS && { view: () => ({ ...STEPS.st.view }), preset: () => STEPS.st.preset, plot: STEPS.P, go: STEPS.go, show: STEPS.show, xOf: STEPS.xOf, anim: () => !!STEPS.st.anim, on: () => ({ ...STEPS.st.on }),
        ht: () => { const h = STEPS.ht(); return h ? { marks: h.marks.length, kurz: h.marks.filter((m) => m.ser === 'kurz').length, rule: h.marks.filter((m) => m.ser === 'rule').length, pick: h.marks.filter((m) => m.ser === 'pick').length, segs: h.segs.length, omega: h.omega, band: h.band, proj: h.proj, today: h.today, tests: h.tests.map((t) => t.T.id) } : null; },
        hoverAt: (x, y) => { STEPS.api.hover(x, y); const el = STEPS.box.querySelector('.mc-tip'); return el && !el.hidden ? el.textContent : ''; },
        kurz0: () => { const h = STEPS.ht(), m = h && h.marks.find((q) => q.ser === 'kurz'); return m ? { x: m.x, y: m.y, label: m.e.row.label } : null; } },
      DEEP: DEEP && { P: DEEP.P, xOf: DEEP.xOf, dAt: DEEP.dAt, boxX: DEEP.boxX, centreOn: DEEP.centreOn, dots: DEEP.dots },
      M: M && { view: () => ({ v0: M.st.v0, v1: M.st.v1, linked: M.st.linked }), zero: M.zero, dips: M.dips, boxes: M.boxes, events: M.events, eventMs: M.eventMs, zeroX: M.zeroX, plot: M.P, ready: M.ready, load: M.load, error: M.error },
      T: T && { group: () => T.st.key, groups: T.groups, setGroup: T.setGroup, view: () => ({ v0: T.st.v0, v1: T.st.v1 }), plot: T.P, rows: () => (T.ht() ? T.ht().rows.map((q) => ({ y: q.y, xp: q.xp, xr: q.xr, passed: q.o.r.passed })) : []),
        leave: () => T.api.leave(),
        hoverRow: (j) => { const h = T.ht(), P = T.P(); if (!h || !h.rows[j]) return null; T.api.hover(P.x + P.w / 2, h.rows[j].y); const el = T.box.querySelector('.mc-tip'); return { text: el ? el.textContent : '', ref: h.rows[j].o.r.refit_date, list: h.rows[j].o.r.list, method: h.rows[j].o.r.method }; } },
      track: D.track_record ? D.track_record.status : null, today: TODAY_ISO,
      omega: (list) => OMEGA.of(list || curList()),
      glide: { state: glide.state, enabled: AUTO_GLIDE },
      today: TODAY_MS,
    };
  }
})();
