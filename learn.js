/* Singularity Tracker: learn.html's definitions, held-out test and tables (moved off the main page).
 *
 * Reads data/main_chart.json and nothing else (no other request, no vendor library) and writes plain HTML into
 * #learn-heldout and #learn-notes-body. Every value shown comes from that file, which site/build.py builds from
 * whitelisted repo files; the numbers typed here are formatting only. No dates are typed here.
 */
(function () {
  'use strict';
  const body = document.getElementById('learn-notes-body'), held = document.getElementById('learn-heldout');
  if (!body || !window.fetch) return;

  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const YRD = 365.2425;
  const nf = (n) => Number(n).toLocaleString('en-US');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtISO = (s) => { const d = new Date(Date.parse(s + 'T00:00:00Z')); return MON[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear(); };
  function sig(n, s) { if (n === 0) return 0; const p = Math.pow(10, s - 1 - Math.floor(Math.log10(Math.abs(n)))); return Math.round(n * p) / p; }
  function fmtYears(y) {
    if (y >= 1e9) return sig(y / 1e9, 3) + ' billion years';
    if (y >= 1e6) return sig(y / 1e6, 3) + ' million years';
    if (y >= 1e4) return nf(sig(y, 3)) + ' years';
    if (y >= 2) return nf(Math.round(y)) + ' years';
    return sig(y, 2) + ' years';
  }
  const ok = (b) => !!b && b.status === 'ok';

  function fail(msg) {
    body.textContent = msg;
    if (held) held.textContent = msg;
  }

  fetch('data/main_chart.json', { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(run).catch((e) => {
    fail('The definitions and tables could not be loaded (' + (e && e.message ? e.message : 'error') + ').');
    if (window.console) console.warn('learn:', e);
  });

  function run(D) {
    const li = (a) => '<ul>' + a.filter(Boolean).map((s) => '<li>' + s + '</li>').join('') + '</ul>';
    const code = (s) => '<code>' + esc(s) + '</code>';
    const tbl = (head, rows) => '<div class="tblwrap"><table><thead><tr>' + head.map((x) => '<th scope="col">' + x + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
    const VIEWS = D.views || {}, GLIDE = VIEWS.auto_glide || null;
    const PACE = ok(D.pace) ? D.pace : null, TW = ok(D.timewave) ? D.timewave : null, RT = ok(D.registered_tests) ? D.registered_tests : null;
    const OPEN = ok(D.releases) ? D.releases.open_gap : null;
    const TRK = D.track_record && D.track_record.status === 'ok' && Array.isArray(D.track_record.rows) && D.track_record.rows.length ? D.track_record : null;

    // ---- the held-out test (was the card in the hero)
    if (held) {
      const H = D.heldout;
      if (!ok(H)) held.innerHTML = '<p>Pending.</p>';
      else {
        const rowFor = (k) => {
          const L = D.lists && D.lists[k], h = H[k];
          if (!L || !h) return '';
          return '<tr><td>' + esc(L.label) + '</td><td class="n">' + h.n + '</td><td class="n">' + (h.quadratic != null ? h.quadratic : '&ndash;') + '</td><td class="n">' + h.power_law + '</td><td class="n">' + h.plain_exponential + '</td><td>' + (h.better === 'plain_exponential' ? 'Plain exponential (power law: about ' + h.error_ratio_rounded + '&times; the error)' : 'Power law (plain exponential: about ' + h.error_ratio_rounded + '&times; the error)') + '</td><td class="m">' + esc(h.source) + '</td></tr>';
        };
        held.innerHTML = '<p><b>' + esc(H.question) + '</b> Mean error = ' + esc(H.measure.replace(/^mean error = /, '')) + ' (' + esc(H.measure_src) + ').</p>' +
          tbl(['List', 'Next gaps', 'Quadratic curve (the card&rsquo;s fit)', 'Straight line (the viral chart&rsquo;s fit)', 'Plain exponential', 'Better', 'Source'], [rowFor('v1'), rowFor('v3')]) +
          '<p>' + (ok(D.releases) ? esc(D.releases.label) : 'Rule-defined releases') + ': ' + esc(H.rule.status) + '. ' + esc(H.copied) + '</p>';
      }
    }

    // ---- definitions and sources
    let h = '<h3>What the main chart shows</h3>' + li([
      '<b>Main chart:</b> the familiar log-log chart (wait until the next event against time before today), redrawn from repo data. It plots Kurzweil\'s milestones (purple) and the selected list of AI models (cyan). <span data-awaiting-skeptic="true">A best-fit curve runs up to today and continues, dashed, to the omega point, with the 50% range (provisional) shaded around it; the date it points to, given in the legend, is a fitted estimate, updated weekly.</span>',
      '<b>Steps chart:</b> <span data-awaiting-skeptic="true">the same waits drawn as stairs, showing Kurzweil\'s milestones, every model release (by rule) and the selected hand-picked models at once on the main chart\'s time axis. After today it shows the registered test windows, the 50% range (provisional) and the omega point (a fitted estimate), without a best-fit curve.</span>',
      ok(D.verdict) ? '<b>Verdict line:</b> the approved status label of ' + esc(D.verdict.series) + ', verbatim (' + esc(D.verdict.source) + '; approved in ' + esc(D.verdict.approved_by_pr) + ').' : null,
      GLIDE ? '<b>Auto-glide:</b> on the first visit the main chart holds the full view, then glides into the AI era. ' + esc(GLIDE.src) + '. The caption &ldquo;' + esc(GLIDE.caption || '') + '&rdquo; is ' + esc(D.verdict.glide_caption_rule) + '.' : null,
      '<b>Calendar view:</b> how often the labs release a new model' + (PACE ? ' over a ' + PACE.window_days + '-day window' : '') + ', with placeholder names on the biggest drops. ' + (PACE ? esc(PACE.last_day_rule.charAt(0).toUpperCase() + PACE.last_day_rule.slice(1).replace(/\.?$/, '.')) : ''),
      TW ? '<b>McKenna panel:</b> ' + esc(TW.label) + ', on its own fixed scale, <span data-awaiting-skeptic="true">with its end date given in the panel\'s note.</span>' : null,
      TRK ? '<b>Omega date card, the omega band on the calendar view and the track record:</b> fitted estimates; see the omega-point section above.'
        : '<b>Track record:</b> where the fit put the date at each refit is logged in the predictions registry as unapproved dates; it is shown only after skeptic-red-team approves the presentation.',
      '<b>Release rules:</b> ' + (D.rules || []).map(esc).join(' '),
    ]);
    h += '<h3>Hero chart sources</h3>' + li([
      '<b>Purple:</b> ' + esc(D.kurzweil.attribution_long) + ' ' + esc(D.kurzweil.placement) + ' <span class="w">' + esc(D.kurzweil.placement_approval) + '.</span> ' + esc(D.kurzweil.estimate_note),
      ok(D.lists) ? '<b>' + esc(D.lists.v1.label) + ':</b> ' + esc(D.lists.v1.name) + ' (' + esc(D.lists.v1.defined_at) + '). <b>' + esc(D.lists.v3.label) + ':</b> ' + esc(D.lists.v3.name) + ' (' + esc(D.lists.v3.defined_at) + '). ' + esc(D.lists.note) + ' ' + esc(D.lists.gap_rule) + ' ' + esc(D.lists.epoch_note) : null,
      ok(D.releases) ? '<b>' + esc(D.releases.label) + ':</b> ' + esc(D.releases.definition) + ' ' + esc(D.releases.event_rule) + ' ' + esc(D.releases.gap_rule) : null,
      D.credit ? '<b>Credit:</b> ' + esc(D.credit.text) + (D.credit.link ? '' : ' (link pending)') + '. ' + esc(D.credit.src) : null,
    ]);
    if (PACE) h += '<h3>Calendar view definitions</h3>' + li([
      '<b>Per active lab (default):</b> ' + esc(PACE.definition.per_lab),
      '<b>All labs pooled (raw):</b> ' + esc(PACE.definition.pooled),
      '<b>Dim line:</b> ' + esc(PACE.sparse_note) + '. <b>Gaps:</b> ' + esc(PACE.none_spans.definition) + '.',
      '<b>Lab entry (' + esc(D.lab_entry.label_note) + '):</b> ' + esc(D.lab_entry.definition) + ' ' + esc(D.lab_entry.caveat),
      '<b>Drops:</b> ' + esc(D.drops.definition) + ' ' + esc(D.drops.name_rule) + ' <span class="w">Status: ' + esc(D.drops.names_status) + '.</span> ' + esc(D.drops.label_rule) + ' ' + esc(D.drops.missing_note),
      '<b>Bounds:</b> ' + esc(D.releases.lag_note) + ' (' + esc(D.releases.lag_note_src) + '); zone drawn from ' + fmtISO(D.releases.lag_zone_from) + ' (' + esc(D.releases.lag_zone_rule) + '). ' + esc(OPEN.reads),
      '<b>Fixed scales:</b> ' + esc(PACE.scales.note) + '.',
      RT ? '<b>After today:</b> the registered tests and, when the track record is shown, the omega band and the best-fit curve carried dashed to the omega point (on the main chart and the calendar view; the steps chart shows the band and the omega point only). ' + esc(RT.two_sided) + ' ' + esc(RT.why_here) + ' ' + esc(RT.left_out) + ' Rule texts: ' + esc(RT.rule_texts) + '. Captions: ' + esc(RT.caption_status) + '. Test 1 rule, as registered: &ldquo;' + esc(RT.test1.rule_below) + '&rdquo;; &ldquo;' + esc(RT.test1.rule_at_or_above) + '&rdquo;. Test 2 rule: &ldquo;' + esc(RT.test2.rule) + '&rdquo;. Source: ' + code(RT.source) + ' (sha256 ' + code(RT.source_sha256.slice(0, 12)) + '&hellip;), approved in ' + esc(RT.approval) + '.' : null,
    ]);
    if (TW) h += '<h3>McKenna panel</h3>' + li([esc(TW.caption_src), esc(TW.credit_lines_src), esc(TW.code) + '. ' + esc(TW.number_set) + ' ' + esc(TW.anchor_rule), esc(TW.sampling), esc(TW.no_claim)]);

    // ---- tables
    h += '<h3>Table: Kurzweil\'s milestones (estimates)</h3>' + tbl(['Milestone', 'Years before ' + esc((String(D.kurzweil.attribution).match(/\b(\d{4})\b/) || [])[1] || 'publication') + ' (published)', 'Approx. date', 'Wait to next', 'Source'], D.kurzweil.rows.map((r) => '<tr><td>' + esc(r.label) + '</td><td class="n">' + nf(r.years_before_present) + '</td><td>' + esc(r.approx_when) + '</td><td class="n">' + esc(fmtYears(r.time_to_next_event_years)) + '</td><td class="m">' + esc(r.source) + '</td></tr>'));
    if (ok(D.lab_entry)) h += '<h3>Table: labs entering the list (' + esc(D.lab_entry.label_note) + ')</h3>' + tbl(['#', 'Lab', 'Entry date', 'First model', 'Source'], D.lab_entry.rows.map((e, i) => '<tr><td class="n">' + (i + 1) + '</td><td>' + esc(e.lab) + '</td><td>' + esc(e.date) + '</td><td>' + esc(e.model) + '</td><td class="m">' + esc(e.source) + '</td></tr>'));
    if (ok(D.drops)) [['per_lab', 'per active lab'], ['pooled', 'pooled']].forEach((m) => {
      h += '<h3>Table: labelled drops (' + m[1] + ')</h3>' + tbl(['Rank', 'Ends', 'Wait (days)', 'Named by', 'Releases'], D.drops[m[0]].map((d) => '<tr><td class="n">' + d.rank + '</td><td>' + esc(d.day) + '</td><td class="n">' + Math.round(d.wait_before) + ' &rarr; ' + Math.round(d.wait_after) + '</td><td>' + (d.entering.length ? esc(d.entering.join(', ')) + ' enter' + (d.entering.length > 1 ? '' : 's') : esc(d.names.slice(0, 3).join(', '))) + '</td><td class="n">' + d.releases.length + '</td></tr>'));
    });
    if (ok(D.lists)) ['v1', 'v3'].forEach((k) => {
      const L = D.lists[k];
      h += '<h3>Table: ' + esc(L.label) + '</h3>' + tbl(['Date', 'Model', 'Gap to next', 'Flag', 'Source'], L.rows.map((r, i) => '<tr><td>' + esc(r.date) + '</td><td>' + esc(r.model) + '</td><td class="n">' + (r.gap_to_next_days != null ? r.gap_to_next_days + ' d' : (i === L.rows.length - 1 ? '&ge; ' + L.open_days_at_today + ' d (open, a lower bound)' : '')) + '</td><td>' + (r.estimate ? 'estimate' : '') + (r.epoch_date ? ' &middot; Epoch: ' + esc(r.epoch_date) : '') + '</td><td class="m">' + esc(r.source) + '</td></tr>'));
    });
    if (TRK) h += '<h3>Table: track record (display-approved refits)</h3>' + tbl(['List', 'Method', 'Refit', 'Named date', '95% range <span data-awaiting-skeptic="true">(claimed at that refit; a past claim)</span>', 'Passed', '&plusmn; claimed <span data-awaiting-skeptic="true">(claimed at that refit; a past claim)</span>', 'Moved by next', 'AI only', 'Registry row'], TRK.rows.map((r) => '<tr><td>' + esc(r.list) + '</td><td>' + esc(r.method.replace('_', ' ')) + '</td><td>' + esc(r.refit_date) + '</td><td>' + (r.pinned === 'upper' ? 'grid edge' : esc(r.point)) + '</td><td>' + esc(r.lo95) + ' &ndash; ' + esc(r.hi95) + '</td><td>' + (r.passed ? 'yes (failed forecast)' : 'no') + '</td><td class="n">' + (r.claimed_halfwidth_pct == null ? '' : r.claimed_halfwidth_pct + '%') + '</td><td class="n">' + (r.moved_next_pct == null ? '' : r.moved_next_pct + '%') + '</td><td>' + (r.ai_only ? (r.ai_only.pinned !== 'none' ? 'pinned ' + esc(r.ai_only.pinned) : r.ai_only.bounded ? 'bounded' : 'unbounded') : '') + '</td><td class="m">' + esc(r.pred_id) + ' (' + esc(r.display_approved_pr) + ')</td></tr>'));
    h += '<h3>File</h3><p>' + code('data/main_chart.json') + ' (schema ' + esc(D.schema) + '), built by ' + code('site/build.py') + ' from whitelisted repo files; data as of ' + fmtISO(D.today) + '. ' + (TRK ? 'The only fitted dates are the track record\'s display-approved refits.' : 'No fitted dates anywhere.') + '</p>';
    body.innerHTML = h;
  }
})();
