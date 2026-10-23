/* =====================================================================
   Quick Quantity — the bar bending schedule screens
   A list of bar marks with their shape drawn, an input form that works
   the cut length and the weight out as it is typed, the steel added up by
   diameter and by member, and the whole thing reconciled with the
   reinforcement the bill is carrying.
   ===================================================================== */
(function (root) {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d) => (n == null || n === '' || !isFinite(n)) ? '—'
    : Number(n).toLocaleString('en-US', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const nowDate = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const db = () => (typeof BBS !== 'undefined' ? BBS : null);

  let O = { params: {}, result: null, currency: 'GH¢', project: 'Project', canEdit: () => true, toast: () => {},
            save: () => {}, adopt: () => false, onStruct: null };

  const st = { q: '', member: 'all', sort: 'member', form: null, isNew: false, err: '', confirm: '', open: false };

  /* ------------------------------------------------------------- the shape */
  /* A small drawing of the bar in its form, so a length can be checked at a
     glance rather than trusted. */
  function shapeSvg(r) {
    const shape = (db().SHAPES[r.shape] || db().SHAPES.straight);
    const t = Math.max(1.4, Math.min(3, (+r.dia || 8) / 8));
    const stroke = '#2e6b55';
    let g = '';
    if (shape.mesh || r.type === 'mesh') {
      g = `<rect x="7" y="11" width="30" height="22" rx="1.5" fill="none" stroke="${stroke}" stroke-width="1.2"/>
           <path d="M7 18h30M7 25h30M16 11v22M25 11v22" stroke="${stroke}" stroke-width=".7" opacity=".55"/>`;
    } else if (r.shape === 'straight' || r.shape === 'hooks') {
      g = `<path d="M6 22h32${r.shape === 'hooks' ? 'M6 22v6M38 22v6' : ''}" stroke="${stroke}" stroke-width="${t}" stroke-linecap="round"/>`;
    } else if (r.shape === 'L') {
      g = `<path d="M8 12v20h28" fill="none" stroke="${stroke}" stroke-width="${t}" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (r.shape === 'U') {
      g = `<path d="M8 10v22h28V10" fill="none" stroke="${stroke}" stroke-width="${t}" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (r.shape === 'Z') {
      g = `<path d="M6 30h12V14h20" fill="none" stroke="${stroke}" stroke-width="${t}" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (r.shape === 'stirrup') {
      g = `<rect x="10" y="11" width="24" height="22" rx="2.5" fill="none" stroke="${stroke}" stroke-width="${t}"/>
           <path d="M10 15l-4 4M34 15l4 4" stroke="${stroke}" stroke-width="${t}" stroke-linecap="round"/>`;
    } else if (r.shape === 'crank') {
      g = `<path d="M5 28h10l6-12h10l6 12h6" fill="none" stroke="${stroke}" stroke-width="${t}" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (r.shape === 'circle') {
      g = `<circle cx="22" cy="22" r="12" fill="none" stroke="${stroke}" stroke-width="${t}"/>`;
    }
    // the drawing only occupies the middle band of the 44-unit box, so the
    // viewBox is cropped to it — otherwise the bar is a thumbnail on a tray
    return `<svg class="bbs-shape" viewBox="3 8 40 28" aria-hidden="true">${g}</svg>`;
  }

  /* ------------------------------------------------------------- the shell */
  function open(opts) {
    Object.assign(O, opts || {});
    const old = document.getElementById('bbs-overlay');
    if (old) old.remove();
    st.form = null; st.err = ''; st.confirm = ''; st.q = ''; st.member = 'all';
    const ov = document.createElement('div');
    ov.id = 'bbs-overlay';
    ov.className = 'overlay-modal';
    ov.innerHTML = `<div class="modal bbs-modal" role="dialog" aria-modal="true" aria-label="Bar bending schedule">
      <header class="modal-head">
        <div>
          <h2>Bar bending schedule</h2>
          <p class="hint" id="bbs-sub"></p>
        </div>
        <button class="icon-x" data-bbs="close" aria-label="Close">✕</button>
      </header>
      <div class="modal-body" id="bbs-body"></div>
    </div>`;
    document.body.appendChild(ov);
    st.open = true;
    const onEsc = ev => { if (ev.key === 'Escape') close(); };
    document.addEventListener('keydown', onEsc);
    ov._onEsc = onEsc;
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.addEventListener('click', onClick);
    ov.addEventListener('input', onInput);
    ov.addEventListener('change', onChange);
    paint();
    if (!db().rowsOf(O.params).length && db().billSteel(O.result).kg > 0) {
      // nothing scheduled yet: offer the starter, but never write it behind the user's back
      const bar = document.getElementById('bbs-empty-start');
      if (bar) bar.focus();
    }
  }

  function close() {
    const ov = document.getElementById('bbs-overlay');
    if (!ov) return;
    if (ov._onEsc) document.removeEventListener('keydown', ov._onEsc);
    ov.remove();
    st.open = false;
    O.save();
  }

  function paint() {
    const ov = document.getElementById('bbs-overlay');
    if (!ov) return;
    const m = db().model(O.params, O.result);
    const sub = ov.querySelector('#bbs-sub');
    if (sub) {
      const ro = O.canEdit() === false;
      sub.innerHTML = `${m.totals.marks} bar mark${m.totals.marks === 1 ? '' : 's'} · `
        + `${fmt(m.totals.kg, 0)} kg of steel (${fmt(m.totals.tonnes, 2)} t) · `
        + `the bill carries ${fmt(m.bill.kg, 0)} kg${ro ? ' · read-only' : ''}`;
    }
    const body = ov.querySelector('#bbs-body');
    if (!body) return;
    // an empty schedule has nothing to fill a tall dialog with — let it sit compact
    const card = ov.querySelector('.modal');
    if (card) card.classList.toggle('bbs-modal-empty', !!m.empty);
    body.innerHTML = m.empty ? emptyView(m) : listView(m);
  }

  /* ------------------------------------------------------------- empty state */
  function emptyView(m) {
    const ro = O.canEdit() === false;
    return `<div class="bbs-empty">
      <h3>No bar marks yet</h3>
      <p class="hint">A bending schedule lists the steel behind the reinforcement item: one line per bar mark, with its
        shape, how many, the cut length and the weight. Start from what the bill has measured and edit the lines to
        match the details, or add your own.</p>
      <div class="row" style="justify-content:center;gap:8px;margin-top:12px">
        ${ro ? '' : `<button class="btn primary" id="bbs-empty-start" data-bbs="start">Start from the bill${m.bill.kg ? ' (' + fmt(m.bill.kg, 0) + ' kg)' : ''}</button>
        <button class="btn" data-bbs="new">Add the first bar mark</button>
        ${O.onStruct ? '<button class="btn" data-bbs="struct" title="Check the columns and beams, then generate the rods">Check the structure</button>' : ''}`}
      </div>
      ${m.bill.kg ? '' : `<p class="hint" style="margin-top:10px">The bill has no reinforcement item yet — measure the
        building first, then come back.</p>`}
    </div>`;
  }

  /* ------------------------------------------------------------- list */
  function listView(m) {
    const ro = O.canEdit() === false;
    const q = st.q.trim().toLowerCase();
    let rows = m.rows.filter(r =>
      (st.member === 'all' || r.member === st.member) &&
      (!q || [r.mark, r.member, r.loc, r.note, r.spec, 'y' + r.dia].join(' ').toLowerCase().indexOf(q) >= 0));

    const key = {
      mark: (a, b) => String(a.mark).localeCompare(String(b.mark), undefined, { numeric: true }),
      // member rank, then mark — the order the model already keeps
      member: null,
      dia: (a, b) => (num(a.dia) - num(b.dia)) || String(a.mark).localeCompare(String(b.mark), undefined, { numeric: true }),
      weight: (a, b) => b.kg - a.kg
    }[st.sort] || null;
    if (key) rows.sort(key);
    // 'by member' keeps the model's member-then-mark order, so it is not re-sorted

    const members = [...new Set(m.rows.map(r => r.member))];
    const shownKg = rows.reduce((n, r) => n + r.kg, 0);

    /* bands only when the list is grouped by member: a flat by-mark list would
       otherwise repeat a member's band every time a mark sorts out of place */
    const bands = (st.sort === 'member');
    let body = '';
    const rowHtml = r => {
      const shape = (db().SHAPES[r.shape] || db().SHAPES.straight);
      const asking = st.confirm === r.id;
      return `<tr class="bbs-row" data-id="${esc(r.id)}">
        <td class="bbs-mark">${esc(r.mark)}</td>
        <td class="bbs-loc"><b>${esc(r.loc || r.member)}</b>
          ${r.note ? `<span class="bbs-note">${esc(r.note)}</span>` : ''}</td>
        <td class="bbs-bar">${r.type === 'mesh' ? esc(r.spec) + ' mesh' : 'Y' + r.dia}</td>
        <td class="bbs-shapecell">${shapeSvg(r)}<span>${esc(shape.short)}</span></td>
        <td class="num">${r.type === 'mesh' ? '—' : fmt(r.no, 0)}</td>
        <td class="num">${r.type === 'mesh' ? '—' : fmt(r.members, 0)}</td>
        <td class="num">${r.type === 'mesh' ? '—' : fmt(r.bars, 0)}</td>
        <td class="num">${r.type === 'mesh' ? '—' : fmt(r.cut, 0)}</td>
        <td class="num">${r.type === 'mesh' ? fmt(r.area, 1) + ' m²' : fmt(r.metres, 2)}</td>
        <td class="num">${fmt(r.kgm, 3)}</td>
        <td class="num bbs-kg">${fmt(r.kg, 1)}</td>
        <td class="bbs-act no-print">
          ${asking ? `<span class="bbs-confirm">Delete?
            <button class="btn xs danger" data-bbs="del-yes" data-id="${esc(r.id)}">Yes</button>
            <button class="btn xs" data-bbs="del-no">No</button></span>`
          : `<button class="mat-ib" data-bbs="edit" data-id="${esc(r.id)}" title="${ro ? 'Open this bar mark' : 'Change this bar mark'}" aria-label="Change">✎</button>
             ${ro ? '' : `<button class="mat-ib" data-bbs="dup" data-id="${esc(r.id)}" title="Duplicate" aria-label="Duplicate">⧉</button>
             <button class="mat-ib del" data-bbs="del" data-id="${esc(r.id)}" title="Delete" aria-label="Delete">✕</button>`}`}
        </td>
      </tr>`;
    };

    if (bands) {
      members.forEach(mb => {
        const list = rows.filter(r => r.member === mb);
        if (!list.length) return;
        const kg = list.reduce((n, r) => n + r.kg, 0);
        body += `<tr class="bbs-band"><td colspan="10"><b>${esc(mb)}</b>
            <span>${list.length} bar mark${list.length === 1 ? '' : 's'}</span></td>
          <td class="num"><b>${fmt(kg, 1)}</b></td><td class="no-print"></td></tr>`;
        list.forEach(r => { body += rowHtml(r); });
      });
    } else {
      rows.forEach(r => { body += rowHtml(r); });
    }

    return `
      <div class="bbs-stats">
        <div class="bbs-kpi"><span>Bar marks</span><b>${m.totals.marks}</b></div>
        <div class="bbs-kpi"><span>Bars</span><b>${fmt(m.totals.bars, 0)}</b></div>
        <div class="bbs-kpi"><span>Total length</span><b>${fmt(m.totals.metres, 0)} m</b></div>
        <div class="bbs-kpi"><span>Steel</span><b>${fmt(m.totals.kg, 0)} kg</b><em>${fmt(m.totals.tonnes, 2)} t</em></div>
        <div class="bbs-kpi"><span>In the bill</span><b>${fmt(m.bill.kg, 0)} kg</b><em>reinforcement item</em></div>
        <div class="bbs-kpi ${Math.abs(m.variance) < 1 ? 'ok' : (m.variancePct != null && Math.abs(m.variancePct) > 5 ? 'off' : 'near')}">
          <span>Difference</span><b>${m.variance > 0 ? '+' : ''}${fmt(m.variance, 0)} kg</b>
          <em>${m.variancePct == null ? 'no bill figure' : (m.variancePct > 0 ? '+' : '') + fmt(m.variancePct, 1) + '%'}</em></div>
      </div>

      <div class="bbs-tools no-print">
        <input id="bbs-q" class="mat-search" type="search" placeholder="Search mark, member, note…" value="${esc(st.q)}" aria-label="Search the schedule">
        <select id="bbs-member" class="mat-sel" data-plain="1" aria-label="Member">
          <option value="all">All members</option>
          ${[...new Set(db().MEMBERS.concat(members))].map(x => `<option value="${esc(x)}"${st.member === x ? ' selected' : ''}>${esc(x)}</option>`).join('')}
        </select>
        <select id="bbs-sort" class="mat-sel" data-plain="1" aria-label="Sort">
          ${[['mark', 'By bar mark'], ['member', 'By member'], ['dia', 'By diameter'], ['weight', 'Heaviest first']]
            .map(([k, t]) => `<option value="${k}"${st.sort === k ? ' selected' : ''}>${t}</option>`).join('')}
        </select>
        <span style="flex:1"></span>
        ${ro ? '<span class="mdb-ro">read-only</span>'
          : `<button class="btn sm" data-bbs="new">+ Add a bar mark</button>
             <button class="btn sm" data-bbs="start" title="Rebuild the starter lines from the bill's measured concrete and steel">Start from the bill</button>`}
        ${(ro || !O.onStruct) ? '' : '<button class="btn sm" data-bbs="struct" title="Check the columns and beams, then generate the rods onto this schedule">Structural check</button>'}
        <button class="btn sm" data-bbs="xlsx">Excel</button>
        <button class="btn sm" data-bbs="pdf">PDF</button>
        <button class="btn sm" data-bbs="print">Print</button>
      </div>

      ${st.form ? formView(m) : ''}

      <div class="bbs-scroll"><table class="bbs-table">
        <colgroup><col style="width:58px"><col><col style="width:74px"><col style="width:64px">
          <col style="width:44px"><col style="width:52px"><col style="width:56px"><col style="width:64px">
          <col style="width:70px"><col style="width:56px"><col style="width:72px"><col style="width:76px" class="no-print"></colgroup>
        <thead><tr>
          <th>Mark</th><th>Member and description</th><th>Bar</th><th>Shape</th>
          <th class="num">No. per member</th><th class="num">Members</th><th class="num">Bars</th>
          <th class="num">Cut (mm)</th><th class="num">Length (m)</th><th class="num">kg/m</th>
          <th class="num">Weight (kg)</th><th class="no-print"></th>
        </tr></thead>
        <tbody>${body || `<tr><td colspan="12" class="bbs-none">Nothing matches “${esc(st.q)}”.</td></tr>`}</tbody>
        <tfoot><tr>
          <td colspan="3">${rows.length === m.rows.length ? m.totals.marks + ' bar marks' : rows.length + ' of ' + m.totals.marks + ' bar marks'}</td>
          <td colspan="4"></td>
          <td class="num">${fmt(rows.reduce((n, r) => n + r.metres, 0), 1)} m</td>
          <td></td>
          <td class="num"><b>${fmt(shownKg, 1)}</b></td>
          <td class="no-print"></td>
        </tr></tfoot>
      </table></div>

      <div class="bbs-foot">
        <div class="bbs-side">
          <h4>By diameter</h4>
          <table class="bbs-mini">
            <thead><tr><th>Bar</th><th class="num">Marks</th><th class="num">Bars</th><th class="num">Length</th><th class="num">kg</th><th class="num">%</th></tr></thead>
            <tbody>${m.byDia.map(d => `<tr><td>${esc(d.label)}</td><td class="num">${d.marks}</td>
              <td class="num">${d.dia ? fmt(d.bars, 0) : '—'}</td><td class="num">${d.dia ? fmt(d.metres, 0) + ' m' : '—'}</td>
              <td class="num">${fmt(d.kg, 1)}</td><td class="num">${m.totals.kg ? fmt(d.kg / m.totals.kg * 100, 1) : '—'}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="bbs-side">
          <h4>By member</h4>
          <table class="bbs-mini">
            <thead><tr><th>Member</th><th class="num">Marks</th><th class="num">Bars</th><th class="num">kg</th></tr></thead>
            <tbody>${m.byMember.map(d => `<tr><td>${esc(d.member)}</td><td class="num">${d.marks}</td>
              <td class="num">${fmt(d.bars, 0)}</td><td class="num">${fmt(d.kg, 1)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="bbs-side bbs-recon">
          <h4>The bill</h4>
          <p class="hint">The bill prices <b>${fmt(m.bill.kg, 0)} kg</b> of reinforcement at
            ${esc(O.currency)} ${fmt(m.bill.items.reduce((n, i) => n + i.qty * i.rate, 0), 2)}.
            ${Math.abs(m.variance) < 1 ? 'The schedule agrees with it.'
              : `The schedule is <b>${m.variance > 0 ? '+' : ''}${fmt(m.variance, 0)} kg</b> against it (${fmt(m.variancePct, 1)}%).`}</p>
          ${ro ? '' : `<button class="btn sm ${Math.abs(m.variance) < 1 ? '' : 'primary'}" data-bbs="adopt"
            title="Price the reinforcement in the bill at this schedule's weight">Use this schedule for the bill</button>`}
        </div>
      </div>

      <p class="bbs-note">Cut length is the developed length: the legs of the shape added up, less 2d for every bend,
        plus 9d hooks where the bar has them, plus any lap typed against the mark. Weight is length × d²/162.28 kg/m.
        The bill's reinforcement, the material schedule and every export follow the figure adopted here.</p>`;
  }

  /* ------------------------------------------------------------- the form */
  function formView(m) {
    const D = db();
    const f = st.form || {};
    const isNew = !f.id;
    const shapeKey = f.shape || 'L';
    const shape = D.SHAPES[shapeKey] || D.SHAPES.L;
    const isMesh = f.type === 'mesh';
    const live = D.calc(f);
    const ro = O.canEdit() === false;
    const field = (name, label, value, attrs, cls) => `<label class="mat-f ${cls || ''}"><span>${label}</span>
      <input name="${name}" type="text" value="${esc(value == null ? '' : value)}" ${attrs || ''} ${ro ? 'disabled' : ''}></label>`;
    const numeric = (name, label, value, attrs, cls) => field(name, label, value == null ? '' : value,
      'type="number" step="any" min="0" ' + (attrs || ''), cls);

    return `<form class="bbs-form" id="bbs-form" onsubmit="return false">
      <div class="bbs-form-head">
        <b>${isNew ? 'New bar mark' : 'Bar mark ' + esc(f.mark || '')}</b>
        <span class="hint">${isNew ? 'The cut length and weight are worked out as you type.' : esc(f.member || '')}</span>
        <span style="flex:1"></span>
        <button type="button" class="icon-x" data-bbs="cancel" aria-label="Close the form">✕</button>
      </div>
      <div class="mat-form-grid">
        ${field('mark', 'Mark', f.mark, 'placeholder="' + esc(D.nextMark(O.params, f.member || 'Beams')) + '"', 'sp1')}
        <label class="mat-f sp2"><span>Member</span>
          <select name="member" data-plain="1" ${ro ? 'disabled' : ''}>
            ${D.MEMBERS.map(x => `<option value="${esc(x)}"${(f.member || 'Beams') === x ? ' selected' : ''}>${esc(x)}</option>`).join('')}
          </select></label>
        ${field('loc', 'Description / location', f.loc, 'placeholder="e.g. ring beam B2, top bars over supports"', 'sp3')}

        <label class="mat-f sp2"><span>Bar type</span>
          <select name="type" data-plain="1" ${ro ? 'disabled' : ''}>
            <option value="bar"${!isMesh ? ' selected' : ''}>Deformed bar</option>
            <option value="mesh"${isMesh ? ' selected' : ''}>Fabric / mesh</option>
          </select></label>

        ${isMesh ? `
          <label class="mat-f sp1"><span>Fabric</span>
            <select name="spec" data-plain="1" ${ro ? 'disabled' : ''}>
              ${Object.keys(D.MESHES).map(k => `<option value="${esc(k)}"${(f.spec || 'A142') === k ? ' selected' : ''}>${esc(k)} — ${D.MESHES[k]} kg/m²</option>`).join('')}
            </select></label>
          ${numeric('a', 'Area covered (m²)', f.a, '', 'sp1')}
          ${numeric('kgm2', 'kg per m²', f.kgm2 || D.MESHES[f.spec || 'A142'], 'step="0.01"', 'sp2')}
        ` : `
          <label class="mat-f sp1"><span>Diameter</span>
            <select name="dia" data-plain="1" ${ro ? 'disabled' : ''}>
              ${D.SIZES.map(d => `<option value="${d}"${num(f.dia) === d ? ' selected' : ''}>Y${d} — ${D.KGM(d).toFixed(3)} kg/m</option>`).join('')}
            </select></label>
          <label class="mat-f sp2"><span>Shape</span>
            <select name="shape" data-plain="1" ${ro ? 'disabled' : ''}>
              ${D.SHAPE_ORDER.filter(k => !D.SHAPES[k].mesh).map(k => `<option value="${k}"${shapeKey === k ? ' selected' : ''}>${esc(D.SHAPES[k].label)}</option>`).join('')}
            </select></label>
          ${(D.DIMS[shapeKey] || []).map(([fld, label]) =>
            numeric(fld, label + ' (mm)', f[fld], 'placeholder="0"', 'sp1')).join('')}
          ${numeric('no', 'No. per member', f.no, 'step="1"', 'sp1')}
          ${numeric('members', 'Members', f.members, 'step="1" placeholder="1"', 'sp1')}
          ${numeric('lap', 'Lap (mm)', f.lap, 'placeholder="0"', 'sp1')}
        `}
        ${field('note', 'Note', f.note, 'placeholder="e.g. 9d hooks, laps at 300 mm"', 'sp2')}
      </div>

      <div class="bbs-preview">
        ${isMesh
          ? `Area ${fmt(live.area, 1)} m² × ${fmt(live.kgm, 2)} kg/m² = <b>${fmt(live.kg, 1)} kg</b>`
          : `${shape.formula} → cut <b>${fmt(live.cut, 0)} mm</b> · ${fmt(live.bars, 0)} bars × ${fmt(live.cut, 0)} mm
             = ${fmt(live.metres, 2)} m · ${fmt(live.kgm, 3)} kg/m = <b>${fmt(live.kg, 1)} kg</b>`}
      </div>
      ${st.err ? `<p class="form-err">${esc(st.err)}</p>` : ''}
      <div class="mat-form-btns">
        <span class="hint">${isNew ? 'A mark of its own keeps each line traceable on the bending drawing.' : 'Changing a line changes the schedule, the bill and every export.'}</span>
        ${ro ? '' : `<button type="button" class="btn sm primary" data-bbs="save">${isNew ? 'Add the bar mark' : 'Save changes'}</button>
          ${isNew ? '<button type="button" class="btn sm" data-bbs="save-new">Save and add another</button>' : ''}`}
        <button type="button" class="btn sm" data-bbs="cancel">Cancel</button>
      </div>
    </form>`;
  }

  function readForm() {
    const el = document.getElementById('bbs-form');
    if (!el) return null;
    const v = n => { const i = el.querySelector('[name="' + n + '"]'); return i ? String(i.value || '').trim() : ''; };
    const base = Object.assign({}, st.form || {});
    const type = v('type') || base.type || 'bar';
    const out = Object.assign(base, {
      mark: v('mark'), member: v('member'), loc: v('loc'), type: type, note: v('note')
    });
    if (type === 'mesh') {
      out.spec = v('spec') || 'A142';
      out.kgm2 = num(v('kgm2')) || 2.22;
      out.a = num(v('a'));
      out.dia = 0; out.shape = 'mesh';
    } else {
      out.dia = num(v('dia')) || 16;
      out.shape = v('shape') || 'L';
      out.a = num(v('a')); out.b = num(v('b')); out.c = num(v('c')); out.h = num(v('h'));
      out.no = num(v('no')); out.members = Math.max(1, num(v('members')) || 1);
      out.lap = num(v('lap'));
    }
    return out;
  }

  function saveForm(again) {
    if (!O.canEdit()) return;
    const rec = readForm();
    if (!rec) return;
    if (!rec.mark) rec.mark = db().nextMark(O.params, rec.member);
    if (rec.type !== 'mesh') {
      if (!(rec.a > 0)) { st.err = 'The bar needs its length: type the ' + (db().DIMS[rec.shape] || [['a', 'length']]).map(x => x[1].toLowerCase()).join(' and ') + ' in millimetres.'; paint(); return; }
      if (!(rec.no > 0)) { st.err = 'How many bars are there? Put the number per member.'; paint(); return; }
    } else if (!(rec.a > 0)) {
      st.err = 'The fabric needs the area it covers, in square metres.'; paint(); return;
    }
    st.err = '';
    if (st.isNew) db().add(O.params, rec);
    else db().update(O.params, rec.id, rec);
    O.toast(st.isNew ? 'Bar mark ' + rec.mark + ' added' : 'Bar mark ' + rec.mark + ' saved');
    O.save();
    if (again) {
      const keep = { member: rec.member, type: rec.type, dia: rec.dia, shape: rec.shape, members: rec.members };
      st.form = Object.assign(db().blank(), keep);
      st.isNew = true;
      paint();
      const n = document.querySelector('#bbs-form [name="mark"]');
      if (n) n.focus();
    } else {
      st.form = null; st.isNew = false;
      paint();
    }
  }

  /* ------------------------------------------------------------- exports */
  function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
  }

  const slug = s => String(s || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

  function meta(m) {
    return {
      project: O.project || 'Project', currency: O.currency, date: nowDate(),
      totals: m.totals, bill: m.bill, variance: m.variance, variancePct: m.variancePct,
      byDia: m.byDia, byMember: m.byMember,
      note: 'Cut length = legs less 2d per bend, plus hooks and laps. Weight = length × d²/162.28 kg/m.'
    };
  }

  function exportXlsx() {
    try {
      const m = db().model(O.params, O.result);
      if (!m.rows.length) { O.toast('The schedule is empty'); return; }
      const name = 'Bar_bending_schedule_' + slug(O.project) + '.xlsx';
      download(root.XlsxWriter.buildBBS(m.rows, meta(m)), name);
      O.toast('Bending schedule exported — ' + name);
    } catch (err) { console.error(err); O.toast('Could not build the workbook'); }
  }

  function exportPdf() {
    try {
      const m = db().model(O.params, O.result);
      if (!m.rows.length) { O.toast('The schedule is empty'); return; }
      const name = 'Bar_bending_schedule_' + slug(O.project) + '.pdf';
      download(root.PdfWriter.buildBBS(m.rows, meta(m)), name);
      O.toast('Bending schedule exported — ' + name);
    } catch (err) { console.error(err); O.toast('Could not build the PDF'); }
  }

  function printSheet() {
    const m = db().model(O.params, O.result);
    if (!m.rows.length) { O.toast('The schedule is empty'); return; }
    let host = document.getElementById('bbs-print');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'bbs-print';
    let last = null;
    const body = m.rows.map(r => {
      let band = '';
      if (r.member !== last) {
        last = r.member;
        const list = m.rows.filter(x => x.member === r.member);
        band = `<tr class="bbs-band-p"><td colspan="9">${esc(r.member)}
          <span>${list.length} mark${list.length === 1 ? '' : 's'} · ${fmt(list.reduce((n, x) => n + x.kg, 0), 1)} kg</span></td></tr>`;
      }
      const shape = (db().SHAPES[r.shape] || db().SHAPES.straight);
      return band + `<tr><td class="bbs-p-mark">${esc(r.mark)}</td>
        <td>${esc(r.loc || '')}${r.note ? '<div class="bbs-p-note">' + esc(r.note) + '</div>' : ''}</td>
        <td>${r.type === 'mesh' ? esc(r.spec) : 'Y' + r.dia}</td>
        <td>${esc(shape.short)}</td>
        <td class="num">${r.type === 'mesh' ? '—' : fmt(r.no, 0)}</td>
        <td class="num">${r.type === 'mesh' ? '—' : fmt(r.bars, 0)}</td>
        <td class="num">${r.type === 'mesh' ? '—' : fmt(r.cut, 0)}</td>
        <td class="num">${r.type === 'mesh' ? fmt(r.area, 1) + ' m²' : fmt(r.metres, 2)}</td>
        <td class="num">${fmt(r.kg, 1)}</td></tr>`;
    }).join('');
    host.innerHTML = `<div class="bbs-p-head">
        <div class="bbs-p-kicker">BAR BENDING SCHEDULE</div>
        <h1>${esc(O.project || 'Project')}</h1>
        <div class="bbs-p-meta">${m.totals.marks} bar marks · ${fmt(m.totals.bars, 0)} bars · ${fmt(m.totals.metres, 0)} m ·
          ${fmt(m.totals.kg, 0)} kg (${fmt(m.totals.tonnes, 2)} t) · ${nowDate()}</div>
      </div>
      <table class="bbs-p-table">
        <thead><tr><th>Mark</th><th>Member and description</th><th>Bar</th><th>Shape</th>
          <th class="num">No./member</th><th class="num">Bars</th><th class="num">Cut (mm)</th>
          <th class="num">Length (m)</th><th class="num">Weight (kg)</th></tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr><td colspan="8">Total steel</td><td class="num">${fmt(m.totals.kg, 1)}</td></tr></tfoot>
      </table>
      <div class="bbs-p-tot">
        ${m.byDia.map(d => `<span>${esc(d.label)}: <b>${fmt(d.kg, 1)} kg</b></span>`).join('')}
      </div>
      <div class="bbs-p-foot">Cut length = legs less 2d per bend, plus hooks and laps. Weight = length × d²/162.28 kg/m.
        The bill carries ${fmt(m.bill.kg, 0)} kg of reinforcement. Quick Quantity · computed on this device.</div>`;
    document.body.appendChild(host);
    document.body.classList.add('bbs-printing');
    const clean = () => {
      document.body.classList.remove('bbs-printing');
      const h = document.getElementById('bbs-print');
      if (h) h.remove();
      window.removeEventListener('afterprint', clean);
    };
    window.addEventListener('afterprint', clean);
    setTimeout(() => { window.print(); setTimeout(clean, 800); }, 60);
  }

  /* ------------------------------------------------------------- events */
  function onClick(e) {
    const t = e.target.closest('[data-bbs]');
    if (!t) {
      const row = e.target.closest('.bbs-row');
      if (row && !e.target.closest('button') && !e.target.closest('input')) openRow(row.dataset.id);
      return;
    }
    const act = t.dataset.bbs, id = t.dataset.id || '';
    if (act === 'close') return close();
    if (act === 'new') {
      if (!O.canEdit()) return O.toast('A reviewer cannot change the schedule');
      st.form = db().blank({ member: st.member !== 'all' ? st.member : 'Beams', mark: db().nextMark(O.params, st.member !== 'all' ? st.member : 'Beams') });
      st.isNew = true; st.err = ''; st.confirm = '';
      paint();
      const n = document.querySelector('#bbs-form [name="loc"]');
      if (n) n.focus();
      return;
    }
    if (act === 'edit') return openRow(id);
    if (act === 'cancel') { st.form = null; st.isNew = false; st.err = ''; return paint(); }
    if (act === 'save') return saveForm(false);
    if (act === 'save-new') return saveForm(true);
    if (act === 'dup') {
      if (!O.canEdit()) return O.toast('A reviewer cannot change the schedule');
      const c = db().duplicate(O.params, id);
      if (c) { O.toast('Duplicated as ' + c.mark); O.save(); st.form = Object.assign({}, c); st.isNew = false; }
      return paint();
    }
    if (act === 'del') { st.confirm = id; return paint(); }
    if (act === 'del-no') { st.confirm = ''; return paint(); }
    if (act === 'del-yes') {
      if (!O.canEdit()) return O.toast('A reviewer cannot change the schedule');
      db().remove(O.params, id);
      st.confirm = ''; st.form = null;
      O.toast('Bar mark deleted'); O.save();
      return paint();
    }
    if (act === 'start') {
      if (!O.canEdit()) return O.toast('A reviewer cannot change the schedule');
      const out = db().starter(O.params, O.result);
      if (!out.ok) return O.toast(out.note);
      if (db().rowsOf(O.params).length && !window.confirm('Replace the ' + db().rowsOf(O.params).length + ' bar marks on the schedule with lines started from the bill?')) return;
      db().replaceAll(O.params, out.rows);
      O.toast(out.note + ' — edit the lengths, numbers and sizes to suit the details');
      O.save(); return paint();
    }
    if (act === 'adopt') {
      if (!O.canEdit()) return O.toast('A reviewer cannot change the bill');
      const m = db().model(O.params, O.result);
      if (!m.totals.kg) return O.toast('The schedule is empty');
      const done = O.adopt(m.totals.kg);
      if (done) { O.result = (typeof O.recompute === 'function' ? O.recompute() : O.result); paint(); }
      return;
    }
    if (act === 'struct') {
      if (!O.canEdit()) return O.toast('A reviewer cannot change the schedule');
      if (typeof O.onStruct !== 'function') return O.toast('The structural check is not loaded');
      close();
      return O.onStruct();
    }
    if (act === 'xlsx') return exportXlsx();
    if (act === 'pdf') return exportPdf();
    if (act === 'print') return printSheet();
  }

  function openRow(id) {
    const row = db().rowsOf(O.params).find(r => r.id === id);
    if (!row) return O.toast('That bar mark is no longer on the schedule');
    st.form = Object.assign({}, row);
    st.isNew = false; st.err = ''; st.confirm = '';
    paint();
    const body = document.getElementById('bbs-body');
    if (body) body.scrollTop = 0;
    const n = document.querySelector('#bbs-form [name="loc"]');
    if (n) n.select();
  }

  function onInput(e) {
    const t = e.target;
    if (t.id === 'bbs-q') { st.q = t.value; paint(); const box = document.getElementById('bbs-q'); if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); } return; }
    if (t.closest && t.closest('#bbs-form')) {
      // keep the preview honest as the numbers are typed
      const rec = readForm();
      if (!rec) return;
      const live = db().calc(rec);
      const pre = document.querySelector('.bbs-preview');
      if (pre) {
        const shape = db().SHAPES[rec.shape] || db().SHAPES.straight;
        pre.innerHTML = rec.type === 'mesh'
          ? `Area ${fmt(live.area, 1)} m² × ${fmt(live.kgm, 2)} kg/m² = <b>${fmt(live.kg, 1)} kg</b>`
          : `${shape.formula} → cut <b>${fmt(live.cut, 0)} mm</b> · ${fmt(live.bars, 0)} bars × ${fmt(live.cut, 0)} mm = ${fmt(live.metres, 2)} m · ${fmt(live.kgm, 3)} kg/m = <b>${fmt(live.kg, 1)} kg</b>`;
      }
    }
  }

  function onChange(e) {
    const t = e.target;
    if (t.id === 'bbs-member') { st.member = t.value; return paint(); }
    if (t.id === 'bbs-sort') { st.sort = t.value; return paint(); }
    if (t.closest && t.closest('#bbs-form') && (t.name === 'shape' || t.name === 'type' || t.name === 'spec')) {
      // the shape decides which dimensions the form draws — but a mark the
      // surveyor has typed must survive the repaint, not fall back to the
      // suggested one
      const typed = document.querySelector('#bbs-form [name="mark"]');
      const keepMark = (typed && typed.value.trim()) || (st.form && st.form.mark) || '';
      const rec = readForm();
      if (rec) { st.form = Object.assign({}, rec, { id: st.form && st.form.id, mark: keepMark }); paint(); }
    }
  }

  root.BBSUI = { open, close };
})(typeof window !== 'undefined' ? window : globalThis);
