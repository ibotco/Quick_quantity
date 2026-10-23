/* =====================================================================
   Quick Quantity — the structural check screen
   A form for the column and the beam, the check worked out beside it,
   and a button that puts the bars the check asks for straight onto the
   bending schedule.
   ===================================================================== */
(function (root) {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d) => (n == null || n === '' || !isFinite(n)) ? '—'
    : Number(n).toLocaleString('en-US', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const S = () => (typeof STRUCT !== 'undefined' ? STRUCT : null);

  let O = { params: {}, result: null, currency: 'GH¢', project: 'Project', canEdit: () => true,
            toast: () => {}, save: () => {}, after: () => {} };
  const st = { d: null, res: null, open: false, touched: false };

  const FIELDS = [
    ['storeys', 'Storeys', 'No.'],
    ['H', 'Floor height', 'm'],
    ['fcu', 'Concrete', 'N/mm²'],
    ['fy', 'Steel', 'N/mm²'],
    ['cover', 'Cover', 'mm']
  ];
  const COLF = [
    ['colCount', 'Columns', 'No.'],
    ['colB', 'Width b', 'mm'],
    ['colH', 'Depth h', 'mm'],
    ['colLoad', 'Design load N', 'kN'],
    ['colDia', 'Main bars', 'Ø mm'],
    ['colLink', 'Links', 'Ø mm']
  ];
  const BEAMF = [
    ['beamCount', 'Beams', 'No.'],
    ['beamSpan', 'Span', 'm'],
    ['beamB', 'Width b', 'mm'],
    ['beamH', 'Depth h', 'mm'],
    ['beamUDL', 'Design load w', 'kN/m'],
    ['beamDia', 'Bottom bars', 'Ø mm'],
    ['beamTop', 'Top bars', 'Ø mm'],
    ['beamLink', 'Links', 'Ø mm']
  ];

  const field = (k, label, unit, wide) => `<label class="str-f${wide ? ' wide' : ''}" title="${esc(label)}">
      <span>${esc(label)}${unit ? ` <i>${esc(unit)}</i>` : ''}</span>
      <input type="number" name="${k}" value="${esc(st.d ? st.d[k] : '')}" step="any" inputmode="decimal">
    </label>`;

  function readForm() {
    const f = document.getElementById('struct-form');
    if (!f) return null;
    const d = {};
    [...f.querySelectorAll('input[name]')].forEach(i => { d[i.name] = num(i.value); });
    return d;
  }

  function compute() {
    const d = readForm();
    if (!d) return;
    st.d = Object.assign({}, st.d, d);
    st.res = S().check(st.d);
  }

  function chip(status) {
    if (status === 'pass') return '<span class="str-chip ok">passes</span>';
    if (status === 'warn') return '<span class="str-chip near">passes, with a note</span>';
    return '<span class="str-chip off">does not pass</span>';
  }

  /* ------------------------------------------------------------ results */
  function resultView() {
    const r = st.res;
    if (!r) return '<p class="hint">Fill the frame in and the check follows.</p>';
    const c = r.col, b = r.beam;
    const kg = S().weigh(S().rows(st.d, r));
    const rows = S().rows(st.d, r);

    const card = (kind, title, x, lines, note) => `
      <div class="str-card ${x.status}">
        <h5>${esc(title)} ${chip(x.status)}</h5>
        <dl>${lines.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>
        ${note ? `<p class="str-note">${esc(note)}</p>` : ''}
        ${x.notes.map(nn => `<p class="str-note">${esc(nn)}</p>`).join('')}
      </div>`;

    return `
      <div class="str-res">
        ${card('col', 'Column', c, [
          ['Section', `${c.b} × ${c.h} mm · ${c.H} m`],
          ['Design load', `${fmt(c.N, 0)} kN axial`],
          ['Steel required', `${fmt(c.AsReq, 0)} mm² <em>(0.4 % minimum is ${fmt(c.AsMin, 0)} mm²)</em>`],
          ['Steel provided', `<b>${c.main}</b> — ${fmt(c.AsProv, 0)} mm², ${fmt(c.ratio, 2)} %`],
          ['Capacity', `${fmt(c.cap, 0)} kN — ${fmt(c.util * 100, 0)} % used`],
          ['Slenderness', `le/h ${fmt(c.slim, 1)} <em>(short column limit 15)</em>`],
          ['Links', c.links]
        ])}
        ${card('beam', 'Beam', b, [
          ['Section', `${b.b} × ${b.h} mm · ${b.L} m span`],
          ['Design', `${fmt(b.M, 1)} kNm · ${fmt(b.V, 1)} kN shear`],
          ['K', `${fmt(b.K, 3)} <em>(limit ${b.Kp} — under it, singly reinforced)</em>`],
          ['Steel required', `${fmt(b.AsReq, 0)} mm² <em>(minimum ${fmt(b.AsMin, 0)} mm²)</em>`],
          ['Bottom / top', `<b>${b.main}</b> / ${b.topBars} — ${fmt(b.AsProv, 0)} mm²`],
          ['Shear', `v ${fmt(b.v, 2)} vs vc ${fmt(b.vc, 2)} N/mm²`],
          ['Span / depth', `${fmt(b.spanDepth, 1)} <em>(limit 20)</em>`],
          ['Links', b.links]
        ])}
      </div>

      <div class="str-rods">
        <h4>What this puts on the bending schedule
          <span>${rows.length} bar marks · ${fmt(kg.bars, 0)} bars · ${fmt(kg.metres, 0)} m · <b>${fmt(kg.kg, 1)} kg</b>
          · <b>${fmt(kg.rods, 0)} rods</b> of 12 m</span></h4>
        <table class="str-table">
          <thead><tr><th>Mark</th><th>Member</th><th>Description</th><th>Bar</th>
            <th class="num">No.</th><th class="num">Members</th><th class="num">Bars</th>
            <th class="num">Cut (mm)</th><th class="num">Weight (kg)</th></tr></thead>
          <tbody>${rows.map(x => {
            const per = Math.max(0, Math.round(num(x.no))), mem = Math.max(1, Math.round(num(x.members) || 1));
            const bars = per * mem;
            const cut = x.shape === 'stirrup' ? Math.round(2 * (num(x.a) + num(x.b)) + 20 * num(x.dia))
                                              : Math.round(num(x.a) + num(x.lap));
            return `<tr><td class="str-mark">${esc(x.mark)}</td><td>${esc(x.member)}</td>
              <td>${esc(x.loc)}</td><td>Y${esc(x.dia)}</td>
              <td class="num">${fmt(per, 0)}</td><td class="num">${fmt(mem, 0)}</td>
              <td class="num">${fmt(bars, 0)}</td><td class="num">${fmt(cut, 0)}</td>
              <td class="num">${fmt((bars * cut / 1000) * S().KGM(num(x.dia)), 1)}</td></tr>`;
          }).join('')}</tbody>
        </table>
        <div class="str-buy">
          <h5>Rods to buy — 12 m stock lengths, cut longest first</h5>
          <table class="str-table">
            <thead><tr><th>Bar</th><th class="num">Bars</th><th class="num">Length (m)</th>
              <th class="num">Weight (kg)</th><th class="num">12 m rods</th><th class="num">Offcuts (m)</th></tr></thead>
            <tbody>${kg.byDia.map(d => `<tr><td><b>${esc(d.label)}</b></td>
              <td class="num">${fmt(d.bars, 0)}</td><td class="num">${fmt(d.metres, 0)}</td>
              <td class="num">${fmt(d.kg, 1)}</td><td class="num"><b>${fmt(d.rods, 0)}</b></td>
              <td class="num">${fmt(d.rods * 12 - d.metres, 1)}</td></tr>`).join('')}
            </tbody>
            <tfoot><tr><td>Total</td><td class="num">${fmt(kg.bars, 0)}</td><td class="num">${fmt(kg.metres, 0)}</td>
              <td class="num">${fmt(kg.kg, 1)}</td><td class="num"><b>${fmt(kg.rods, 0)}</b></td>
              <td class="num">${fmt(kg.rods * 12 - kg.metres, 1)}</td></tr></tfoot>
          </table>
        </div>
        <p class="hint">Generating replaces the column and beam lines on the schedule with these — the foundation,
          slab, lintel and fabric lines are left alone. The bill is re-priced from the schedule afterwards with
          <b>Use this schedule for the bill</b>.</p>
      </div>`;
  }

  /* -------------------------------------------------------------- paint */
  function paint() {
    const ov = document.getElementById('struct-overlay');
    if (!ov) return;
    const r = st.res;
    const sub = ov.querySelector('#str-sub');
    if (sub) {
      if (!r) sub.textContent = 'Columns and beams, checked to BS 8110, then turned into bar marks';
      else {
        const c = r.col, b = r.beam;
        sub.innerHTML = `${c.b}\u00d7${c.h} columns with ${c.main} · ${b.b}\u00d7${b.h} beams over ${b.L} m · `
          + (r.status === 'pass' ? '<b class="ok">the frame checks out</b>'
            : r.status === 'warn' ? '<b class="near">passes, with a note</b>'
            : '<b class="off">the design does not pass</b>');
      }
    }
    const out = ov.querySelector('#str-out');
    if (out) out.innerHTML = resultView();
    const gen = ov.querySelector("[data-str='gen']");
    if (gen) {
      const ro = O.canEdit() === false;
      gen.disabled = ro || !r || r.status === 'fail';
      gen.textContent = ro ? 'Read-only' : 'Generate the rods';
    }
  }

  /* --------------------------------------------------------------- open */
  function open(opts) {
    O = Object.assign({}, O, opts || {});
    const old = document.getElementById('struct-overlay');
    if (old) old.remove();
    st.d = S().defaults(O.result || {});
    st.res = S().check(st.d);
    st.touched = false;

    const ov = document.createElement('div');
    ov.id = 'struct-overlay';
    ov.className = 'overlay-modal';
    ov.innerHTML = `<div class="modal str-modal" role="dialog" aria-modal="true" aria-label="Structural check">
      <header class="modal-head">
        <div>
          <h2>Structural check</h2>
          <p class="hint" id="str-sub"></p>
        </div>
        <button class="icon-x" data-str="close" aria-label="Close">✕</button>
      </header>
      <div class="modal-body" id="str-body">
        <form id="struct-form" class="str-form" onsubmit="return false">
          <div class="str-sect">
            <h4>The frame</h4>
            <div class="str-row">
              ${FIELDS.map(([k, l, u]) => field(k, l, u)).join('')}
            </div>
          </div>
          <div class="str-two">
            <fieldset class="str-fs">
              <legend>Columns</legend>
              <div class="str-row">
                ${COLF.map(([k, l, u]) => field(k, l, u)).join('')}
              </div>
            </fieldset>
            <fieldset class="str-fs">
              <legend>Beams</legend>
              <div class="str-row">
                ${BEAMF.map(([k, l, u]) => field(k, l, u)).join('')}
              </div>
            </fieldset>
          </div>
          <div class="str-act no-print">
            <span class="hint">Prefilled from the plan and the bill — change any figure and the check follows.</span>
            <span style="flex:1"></span>
            <button type="button" class="btn sm" data-str="reset" title="Put the figures back to what the plan gives">Reset to the plan</button>
            <button type="button" class="btn sm" data-str="check">Check the design</button>
            <button type="button" class="btn sm primary" data-str="gen">Generate the rods</button>
          </div>
        </form>
        <div id="str-out"></div>
      </div>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('input', e => {
      if (e.target.closest('#struct-form')) { st.touched = true; compute(); paint(); }
    });
    ov.addEventListener('click', onClick);
    const onEsc = e => { if (e.key === 'Escape') close(); };
    ov._onEsc = onEsc;
    document.addEventListener('keydown', onEsc);
    st.open = true;
    paint();
  }

  function close() {
    const ov = document.getElementById('struct-overlay');
    if (!ov) return;
    if (ov._onEsc) document.removeEventListener('keydown', ov._onEsc);
    ov.remove();
    st.open = false;
  }

  /* ------------------------------------------------------------- actions */
  function onClick(e) {
    const btn = e.target.closest('[data-str]');
    if (!btn) return;
    const act = btn.getAttribute('data-str');
    if (act === 'close') return close();

    if (act === 'reset') {
      st.d = S().defaults(O.result || {});
      const f = document.getElementById('struct-form');
      if (f) Object.keys(st.d).forEach(k => {
        const i = f.querySelector(`[name="${k}"]`);
        if (i) i.value = st.d[k];
      });
      st.res = S().check(st.d);
      O.toast('Back to the figures the plan gives');
      return paint();
    }

    if (act === 'check') {
      compute();
      paint();
      const r = st.res;
      return O.toast(r.status === 'fail' ? 'The design does not pass — see the notes'
        : r.status === 'warn' ? 'The design passes, with a note' : 'The design checks out');
    }

    if (act === 'gen') {
      if (!O.canEdit()) return O.toast('A reviewer can read the schedule, not change it');
      compute(); paint();
      const r = st.res;
      if (!r || r.status === 'fail') return O.toast('The check has to pass before the rods can be generated');
      if (typeof BBS === 'undefined') return O.toast('The bending schedule is not loaded');
      const rows = S().rows(st.d, r);
      const p = O.params;
      const existing = BBS.rowsOf(p).filter(x => x.member === 'Columns' || x.member === 'Beams');
      if (existing.length && !window.confirm('Replace the ' + existing.length
          + ' column and beam line(s) already on the bending schedule with the designed rods?')) return;
      const keep = BBS.rowsOf(p).filter(x => x.member !== 'Columns' && x.member !== 'Beams');
      const total = BBS.replaceAll(p, keep.concat(rows));
      const w = S().weigh(rows);
      O.save();
      close();
      O.toast(rows.length + ' bar marks designed — ' + fmt(w.bars, 0) + ' bars, ' + fmt(w.kg, 1) + ' kg of steel, '
        + fmt(w.rods, 0) + ' rods of 12 m');
      O.after();
      return total;
    }
  }

  root.StructUI = { open: open, close: close, _state: st };
})(typeof window !== 'undefined' ? window : globalThis);
