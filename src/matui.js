/* =====================================================================
   Quick Quantity — the materials database screens
   A list form, an input form, an edit form, a group manager and an
   import/export page over MatDB. It is opened from the material
   schedule (or from the menu) and it is where a practice keeps what it
   buys: 757 materials from the project schedule, plus whatever the user
   adds, with the rate, the supplier and the specification line.
   ===================================================================== */
(function (root) {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d) => (n == null || n === '' || !isFinite(n)) ? '—'
    : Number(n).toLocaleString('en-US', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
  const nowDate = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const slug = s => String(s || 'materials').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

  const db = () => (typeof MatDB !== 'undefined' ? MatDB : null);

  /* the host application supplies these: who may write, how to toast,
     how to redraw the schedule behind the overlay, the currency symbol */
  let O = {
    canEdit: () => true,
    toast: () => {},
    onChange: () => {},
    currency: 'GH¢'
  };

  const st = {
    open: false, tab: 'list',
    q: '', cat: 'all', unit: 'all', sort: 'group', page: 1, size: 20,
    sel: {},
    form: null, formErr: '', formNew: false,
    confirm: '',
    gNew: '', gErr: '', gRename: '', gRenameVal: '', gRemove: '', gMove: '',
    impText: '', impMode: 'merge', impMsg: '', impErr: '',
    want: ''
  };

  const money = n => n == null ? '<span class="mdb-none">no rate</span>' : O.currency + ' ' + fmt(n);

  function resetFilters() {
    st.q = ''; st.cat = 'all'; st.unit = 'all'; st.sort = 'group'; st.page = 1; st.sel = {};
  }

  /* ------------------------------------------------------------- the shell */
  function open(options) {
    Object.assign(O, options || {});
    O.onPick = (options && options.onPick) || null;
    if (!st.open) { resetFilters(); st.tab = 'list'; st.form = null; st.confirm = ''; }
    const old = document.getElementById('mdb-overlay');
    if (old) old.remove();
    const ov = document.createElement('div');
    ov.id = 'mdb-overlay';
    ov.className = 'overlay-modal';
    ov.innerHTML = `<div class="modal mdb-modal" role="dialog" aria-modal="true" aria-label="Materials database">
      <header class="modal-head">
        <div>
          <h2>Materials database</h2>
          <p class="hint" id="mdb-head-hint"></p>
        </div>
        <button class="icon-x" data-mdb="close" aria-label="Close">✕</button>
      </header>
      <div class="mdb-tabs" role="tablist">
        <button class="tab" data-mdb="tab" data-tab="list" role="tab">Materials</button>
        <button class="tab" data-mdb="tab" data-tab="groups" role="tab">Groups</button>
        <button class="tab" data-mdb="tab" data-tab="io" role="tab">Import &amp; export</button>
      </div>
      <div class="modal-body" id="mdb-body"></div>
    </div>`;
    document.body.appendChild(ov);
    st.open = true;

    const onEsc = ev => { if (ev.key === 'Escape') close(); };
    document.addEventListener('keydown', onEsc);
    ov._onEsc = onEsc;
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.addEventListener('click', onClick);
    ov.addEventListener('change', onChange);
    ov.addEventListener('input', onInput);
    ov.addEventListener('keydown', onKey);

    if (!st.form) st.page = 1;
    paint();
    const q = document.getElementById('mdb-q');
    if (q && st.want === 'q') { q.focus(); q.select(); st.want = ''; }
  }

  function close() {
    const ov = document.getElementById('mdb-overlay');
    if (!ov) return;
    if (ov._onEsc) document.removeEventListener('keydown', ov._onEsc);
    ov.remove();
    st.open = false;
    st.form = null; st.confirm = ''; st.sel = {};
    O.onChange();
  }

  function paint() {
    const ov = document.getElementById('mdb-overlay');
    if (!ov || !db()) return;
    ov.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === st.tab));
    const hint = ov.querySelector('#mdb-head-hint');
    if (hint) {
      const s = db().stats();
      hint.innerHTML = O.onPick
        ? 'Choose a material for the schedule — click a row, or close and add one by hand'
        : O.canEdit() === false
        ? `${s.total} materials on this device · a reviewer can read, print and export them, not change them`
        : `${s.total} materials on this device · ${s.priced} with a rate · ${s.groups} groups`;
    }
    const body = ov.querySelector('#mdb-body');
    if (!body) return;
    body.innerHTML = st.tab === 'list' ? listView() : st.tab === 'groups' ? groupsView() : ioView();
    const q = document.getElementById('mdb-q');
    if (q && st.want === 'q') { q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch (e) {} st.want = ''; }
  }

  /* ------------------------------------------------------------- list view */
  function listView() {
    const D = db();
    const s = D.stats();
    const cats = D.groups();
    const units = D.units();
    const res = D.search(st.q, { cat: st.cat, unit: st.unit, sort: st.sort, page: st.page, pageSize: st.size });
    if (st.page !== res.page) st.page = res.page;
    const selIds = Object.keys(st.sel).filter(k => st.sel[k]);
    const allOnPage = res.rows.length > 0 && res.rows.every(r => st.sel[r.id]);
    const ro = O.canEdit() === false;

    const rows = res.rows.map(r => {
      const on = !!st.sel[r.id];
      const asking = st.confirm === r.id;
      return `<tr class="mdb-row${on ? ' sel' : ''}" data-id="${esc(r.id)}">
        <td class="mdb-ck"><input type="checkbox" data-mdb="sel" data-id="${esc(r.id)}" ${on ? 'checked' : ''} aria-label="Select ${esc(r.name)}"></td>
        <td class="mdb-code">${esc(r.code || '—')}</td>
        <td class="mdb-name"><b>${esc(r.name)}</b>
          ${r.desc ? `<span class="mdb-desc" title="${esc(r.desc)}">${esc(r.desc)}</span>` : ''}
          ${r.src === 'user' ? '<span class="mat-mark add">yours</span>' : ''}
          ${r.note ? `<span class="mdb-note">${esc(r.note)}</span>` : ''}</td>
        <td class="mdb-grp">${esc(r.cat)}</td>
        <td class="mdb-unit">${esc(r.unit)}</td>
        <td class="num mdb-rate">${money(r.rate)}</td>
        <td class="mdb-sup">${r.sup ? esc(r.sup) : '<span class="mdb-none">—</span>'}</td>
        <td class="mdb-act no-print">
          ${asking ? `<span class="mdb-confirm">Delete?
              <button class="btn xs danger" data-mdb="del-yes" data-id="${esc(r.id)}">Yes</button>
              <button class="btn xs" data-mdb="del-no">No</button></span>`
            : `${O.onPick ? `<button class="btn xs primary" data-mdb="pick" data-id="${esc(r.id)}">Use</button> ` : ''}<button class="mat-ib" data-mdb="edit" data-id="${esc(r.id)}" title="${ro ? 'Open this material' : 'Change this material'}" aria-label="${ro ? 'Open' : 'Change'}">✎</button>
               ${ro ? '' : `<button class="mat-ib" data-mdb="dup" data-id="${esc(r.id)}" title="Duplicate this material" aria-label="Duplicate">⧉</button>
               <button class="mat-ib del" data-mdb="del" data-id="${esc(r.id)}" title="Delete this material" aria-label="Delete">✕</button>`}`}
        </td>
      </tr>`;
    }).join('');

    const pager = res.pages > 1 ? `<div class="mdb-pager no-print">
        <button class="btn sm" data-mdb="page" data-page="${res.page - 1}" ${res.page <= 1 ? 'disabled' : ''}>← Previous</button>
        <span class="hint">Page ${res.page} of ${res.pages} · ${res.total} material${res.total === 1 ? '' : 's'}</span>
        <button class="btn sm" data-mdb="page" data-page="${res.page + 1}" ${res.page >= res.pages ? 'disabled' : ''}>Next →</button>
      </div>` : '<div class="mdb-pager"><span class="hint">' + res.total + ' material' + (res.total === 1 ? '' : 's') + '</span></div>';

    const table = res.rows.length ? `<div class="mdb-scroll"><table class="mdb-table">
      <colgroup><col style="width:26px"><col style="width:82px"><col><col style="width:132px">
        <col style="width:46px"><col style="width:96px"><col style="width:104px"><col style="width:86px" class="no-print"></colgroup>
      <thead><tr>
        <th class="mdb-ck"><input type="checkbox" data-mdb="sel-all" ${allOnPage ? 'checked' : ''} aria-label="Select the page"></th>
        <th>Code</th><th>Material</th><th>Group</th><th>Unit</th>
        <th class="num">Rate</th><th>Supplier</th><th class="no-print"></th>
      </tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="mat-empty"><b>No material matches</b>
          <span>${st.q ? 'Nothing carries “' + esc(st.q) + '”' : 'This group has no materials yet'} — clear the search or add one.</span></div>`;

    return `
      <div class="mdb-stats">
        <span><b>${s.total}</b> materials</span><span><b>${s.priced}</b> with a rate</span>
        <span><b>${s.groups}</b> groups</span><span><b>${s.user}</b> added here</span>
        <span class="mdb-stats-sp"></span>
        ${ro ? '<span class="mdb-ro">read-only</span>'
          : `<button class="btn sm" data-mdb="new">+ New material</button>`}
      </div>

      <div class="mdb-tools no-print">
        <input id="mdb-q" class="mat-search" type="search" placeholder="Search code, material, specification, supplier…"
          value="${esc(st.q)}" aria-label="Search the materials database">
        <select id="mdb-cat" class="mat-sel" data-plain="1" aria-label="Group">
          <option value="all">All groups</option>
          ${cats.map(g => `<option value="${esc(g.cat)}"${st.cat === g.cat ? ' selected' : ''}>${esc(g.cat)} (${g.count})</option>`).join('')}
        </select>
        <select id="mdb-unit" class="mat-sel" data-plain="1" aria-label="Unit">
          <option value="all">All units</option>
          ${units.map(u => `<option value="${esc(u)}"${st.unit === u ? ' selected' : ''}>${esc(u)}</option>`).join('')}
        </select>
        <select id="mdb-sort" class="mat-sel" data-plain="1" aria-label="Sort">
          ${[['group', 'Group, then code'], ['code', 'Code'], ['name', 'Name A–Z'], ['rate', 'Rate, high to low'], ['priced', 'Unpriced first'], ['recent', 'Recently changed']]
            .map(([k, t]) => `<option value="${k}"${st.sort === k ? ' selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>

      ${selIds.length ? `<div class="mdb-bulk no-print">
        <b>${selIds.length} selected</b>
        <span class="hint">Move them to</span>
        <select id="mdb-bulk-cat" class="mat-sel" data-plain="1">
          <option value="">Choose a group…</option>
          ${cats.map(g => `<option value="${esc(g.cat)}">${esc(g.cat)}</option>`).join('')}
        </select>
        <button class="btn sm" data-mdb="bulk-move">Move</button>
        <span class="mdb-stats-sp"></span>
        <button class="btn sm" data-mdb="bulk-export">Export these</button>
        <button class="btn sm danger" data-mdb="bulk-del">Delete ${selIds.length}</button>
        <button class="btn sm ghost" data-mdb="sel-clear">Clear</button>
      </div>` : ''}

      ${st.form ? formView() : ''}

      ${table}
      ${pager}

      <p class="mdb-foot hint">Rates are indicative Greater Accra prices kept on this device — change them here and the
        schedule, the rate build-up and every export follow. Codes are the schedule's own; a code may repeat, so each
        material carries an internal id.</p>`;
  }

  /* ------------------------------------------------------------- the form */
  function formView() {
    const D = db();
    const f = st.form || {};
    const isNew = !f.id;
    /* the order the app hands over: the groups and units this building's bill
       actually uses first, the rest after. Rebuilt every time the form opens,
       so a change of building type is felt here too. */
    const ownCats = D.groups().map(g => g.cat);
    const cats = (O.cats && O.cats.length)
      ? O.cats.filter(c => ownCats.indexOf(c) >= 0).concat(ownCats.filter(c => O.cats.indexOf(c) < 0))
      : ownCats;
    if (f.cat && cats.indexOf(f.cat) < 0) cats.unshift(f.cat);
    const suppliers = Object.keys(D.all().reduce((m, r) => { if (r.sup) m[r.sup] = 1; return m; }, {}));
    const ownUnits = D.units();
    const units = (O.units && O.units.length)
      ? O.units.filter(u => ownUnits.indexOf(u) >= 0).concat(ownUnits.filter(u => O.units.indexOf(u) < 0))
      : ownUnits;
    if (f.unit && units.indexOf(f.unit) < 0) units.unshift(f.unit);
    const ro = O.canEdit() === false;
    const field = (name, label, value, attrs, span) => `<label class="mat-f ${span || ''}"><span>${label}</span>
      <input name="${name}" type="text" value="${esc(value == null ? '' : value)}" ${attrs || ''} ${ro ? 'disabled' : ''}></label>`;
    return `<form class="mdb-form" id="mdb-form" onsubmit="return false">
      <div class="mdb-form-head">
        <b>${isNew ? 'New material' : 'Edit material'}</b>
        ${isNew ? '' : `<span class="hint">${esc(f.code || '')} · ${esc(f.name || '')}</span>`}
        <span class="mdb-stats-sp"></span>
        <button type="button" class="icon-x" data-mdb="cancel" aria-label="Close the form">✕</button>
      </div>
      <div class="mat-form-grid">
        ${field('code', 'Code', f.code, 'placeholder="M.4.6 or your own" list="mdb-codes"', 'sp2')}
        ${field('name', 'Material name', f.name, 'placeholder="What is it?"', 'sp4')}
        <label class="mat-f sp2"><span>Group</span>
          <select name="cat" ${ro ? 'disabled' : ''} data-group-pick="1">
            ${cats.map(c => `<option value="${esc(c)}"${c === (f.cat || '') ? ' selected' : ''}>${esc(c)}</option>`).join('')}
            ${ro ? '' : '<option value="__new">+ A new group…</option>'}
          </select>
          <input name="catNew" type="text" placeholder="Name the new group" style="display:none;margin-top:6px">
        </label>
        ${field('sub', 'Sub-group', f.sub, 'list="mdb-subs" placeholder="optional"', 'sp2')}
        <label class="mat-f sp1"><span>Unit</span>
          <select name="unit" ${ro ? 'disabled' : ''}>
            ${units.map(u => `<option value="${esc(u)}"${u === (f.unit || '') ? ' selected' : ''}>${esc(u)}</option>`).join('')}
          </select>
        </label>
        ${field('rate', 'Rate (' + O.currency + ')', f.rate == null ? '' : f.rate, 'type="number" step="any" min="0" placeholder="0.00"', 'sp1')}
        ${field('sup', 'Supplier', f.sup, 'list="mdb-sups" placeholder="optional"', 'sp2')}
        <label class="mat-f sp4"><span>Description</span>
          <textarea name="desc" rows="2" placeholder="Size, grade, standard, pack — what the buyer needs to know" ${ro ? 'disabled' : ''}>${esc(f.desc || '')}</textarea></label>
        <label class="mat-f wide"><span>Notes</span>
          <textarea name="note" rows="2" placeholder="Where it is used, a tested brand, a price date…" ${ro ? 'disabled' : ''}>${esc(f.note || '')}</textarea></label>
      </div>
      <datalist id="mdb-cats">${cats.map(c => `<option value="${esc(c)}"></option>`).join('')}</datalist>
      <datalist id="mdb-units">${units.map(u => `<option value="${esc(u)}"></option>`).join('')}</datalist>
      <datalist id="mdb-sups">${suppliers.map(s => `<option value="${esc(s)}"></option>`).join('')}</datalist>
      <datalist id="mdb-subs">${[...new Set(D.all().map(r => r.sub).filter(Boolean))].map(s => `<option value="${esc(s)}"></option>`).join('')}</datalist>
      <datalist id="mdb-codes">${[...new Set(D.all().map(r => r.code).filter(Boolean))].slice(0, 200).map(s => `<option value="${esc(s)}"></option>`).join('')}</datalist>
      ${st.formErr ? `<p class="form-err">${esc(st.formErr)}</p>` : ''}
      <div class="mat-form-btns">
        <span class="hint">${isNew
          ? 'It is saved on this device and offered everywhere a material is chosen.'
          : 'Changing a material here does not change any bill already made from it.'}</span>
        ${ro ? '' : `<button type="button" class="btn sm primary" data-mdb="save">${isNew ? 'Add the material' : 'Save changes'}</button>
        ${isNew ? '<button type="button" class="btn sm" data-mdb="save-new">Save and add another</button>' : ''}`}
        <button type="button" class="btn sm" data-mdb="cancel">Cancel</button>
      </div>
    </form>`;
  }

  function readForm() {
    const el = document.getElementById('mdb-form');
    if (!el) return null;
    const v = n => { const i = el.querySelector('[name="' + n + '"]'); return i ? String(i.value || '').trim() : ''; };
    // "A new group…" opens a text box; the box's word is the group
    const cat = v('cat') === '__new' ? v('catNew') : v('cat');
    return {
      id: st.form && st.form.id || '',
      code: v('code'), name: v('name'), cat: cat, sub: v('sub'),
      unit: v('unit'), rate: v('rate') === '' ? null : +v('rate'),
      sup: v('sup'), desc: v('desc'), note: v('note'),
      src: (st.form && st.form.src) || 'user'
    };
  }

  function saveForm(again) {
    if (!O.canEdit()) return;
    const rec = readForm();
    if (!rec) return;
    if (!rec.name) { st.formErr = 'The material needs a name.'; paint(); return; }
    if (rec.rate !== null && (!isFinite(rec.rate) || rec.rate < 0)) { st.formErr = 'The rate has to be a number, 0 or more.'; paint(); return; }
    const out = db().save(rec);
    if (!out.ok) { st.formErr = out.error || 'Could not save the material.'; paint(); return; }
    st.formErr = '';
    O.toast(rec.id ? 'Material saved' : 'Material added to the database');
    O.onChange();
    if (again) {
      st.form = { cat: rec.cat, unit: rec.unit, sub: rec.sub, sup: rec.sup, src: 'user' };
      paint();
      const n = document.querySelector('#mdb-form [name="name"]');
      if (n) n.focus();
    } else {
      st.form = null; st.confirm = '';
      paint();
    }
  }

  /* ------------------------------------------------------------- groups */
  function groupsView() {
    const D = db();
    const gs = D.groups();
    const ro = O.canEdit() === false;
    const total = gs.reduce((n, g) => n + g.count, 0);
    return `
      <div class="mdb-stats"><span><b>${gs.length}</b> groups</span><span><b>${total}</b> materials</span></div>
      ${ro ? '' : `<form class="mdb-group-add" onsubmit="return false">
        <label class="mat-f"><span>New group</span>
          <input name="gnew" type="text" value="${esc(st.gNew)}" placeholder="e.g. Electrical works, Site prices"></label>
        <button type="button" class="btn sm primary" data-mdb="g-add">Add the group</button>
      </form>`}
      ${st.gErr ? `<p class="form-err">${esc(st.gErr)}</p>` : ''}
      <div class="mdb-groups">
        ${gs.map(g => {
          const renaming = st.gRename === g.cat;
          const removing = st.gRemove === g.cat;
          return `<div class="mdb-group">
            <div class="mdb-group-main">
              ${renaming
                ? `<input class="mdb-inline" name="grename" type="text" value="${esc(st.gRenameVal)}" aria-label="New name for ${esc(g.cat)}">
                   <button class="btn xs primary" data-mdb="g-rename-save" data-cat="${esc(g.cat)}">Rename</button>
                   <button class="btn xs" data-mdb="g-cancel">Cancel</button>`
                : `<b>${esc(g.cat)}</b>
                   <span class="hint">${g.count} material${g.count === 1 ? '' : 's'} · ${g.priced} priced</span>`}
            </div>
            <div class="mdb-group-act no-print">
              ${removing
                ? `${g.count ? `<span class="hint">Move them to</span>
                   <select id="mdb-gmove" class="mat-sel" data-plain="1">
                     ${gs.filter(x => x.cat !== g.cat).map(x => `<option value="${esc(x.cat)}">${esc(x.cat)}</option>`).join('')}
                     <option value="Miscellaneous">Miscellaneous</option>
                   </select>` : '<span class="hint">The group is empty — nothing to move</span>'}
                   <button class="btn xs danger" data-mdb="g-remove-do" data-cat="${esc(g.cat)}">Remove</button>
                   <button class="btn xs" data-mdb="g-cancel">Cancel</button>`
                : `<button class="btn xs" data-mdb="g-filter" data-cat="${esc(g.cat)}">Show these</button>
                   ${ro ? '' : `<button class="btn xs" data-mdb="g-rename" data-cat="${esc(g.cat)}">Rename</button>
                   <button class="btn xs danger" data-mdb="g-remove" data-cat="${esc(g.cat)}">Remove</button>`}`}
            </div>
          </div>`;
        }).join('')}
      </div>
      <p class="mdb-foot hint">A group is the heading a material is filed under — the same groups the material schedule
        prints in. Removing a group does not delete its materials: they move to the group you choose.</p>`;
  }

  /* ------------------------------------------------------------- import / export */
  function ioView() {
    const D = db();
    const s = D.stats();
    const ro = O.canEdit() === false;
    const shown = filtered();
    const narrowed = shown.length !== D.all().length;
    return `
      <section class="mdb-io">
        <h3>Export</h3>
        <p class="hint">The whole database, or just the rows a search is showing. The workbook carries a column for every
          field, so it reads straight back in.</p>
        <div class="mdb-io-row">
          <button class="btn primary" data-mdb="export-xlsx">Export Excel (.xlsx)</button>
          <button class="btn" data-mdb="export-csv">Export CSV</button>
          <button class="btn" data-mdb="print">Print / PDF the list</button>
        </div>
        <p class="hint" id="mdb-io-note">The whole database: ${s.total} materials · ${s.priced} priced · ${s.groups} groups.</p>
        ${narrowed ? `<div class="mdb-io-row">
          <span class="hint">${shown.length} of ${s.total} ${st.q ? 'match “' + esc(st.q) + '”' : 'are in ' + esc(st.cat)}:</span>
          <button class="btn sm" data-mdb="export-xlsx-filtered">Excel, filtered</button>
          <button class="btn sm" data-mdb="export-csv-filtered">CSV, filtered</button>
          <button class="btn sm" data-mdb="print-filtered">Print, filtered</button>
        </div>` : ''}
      </section>

      <section class="mdb-io">
        <h3>Import</h3>
        <p class="hint">A supplier's price list, a schedule of rates, or a spreadsheet of your own. CSV or tab-separated
          text, with a first line naming the columns: <code>Code, Name, Group, Unit, Rate, Supplier, Description, Notes</code>.
          Excel: <em>File → Save as → CSV</em>, or copy the cells and paste them below.</p>
        <div class="mdb-io-row">
          <label class="btn sm file-btn">Choose a file…
            <input type="file" id="mdb-file" accept=".csv,.tsv,.txt" ${ro ? 'disabled' : ''}>
          </label>
          <span class="hint" id="mdb-file-name">${st.impName ? esc(st.impName) : 'no file chosen'}</span>
        </div>
        <textarea id="mdb-imp-text" rows="7" placeholder="Code,Name,Group,Unit,Rate&#10;M.1.1,Cement 32.5R,CEMENTS,bag,101" ${ro ? 'disabled' : ''}>${esc(st.impText)}</textarea>
        <div class="mdb-io-row">
          <label class="chk"><input type="radio" name="mdb-mode" value="merge" ${st.impMode === 'merge' ? 'checked' : ''} ${ro ? 'disabled' : ''}>
            <span>Update a material that already has the same code and name, add the rest</span></label>
          <label class="chk"><input type="radio" name="mdb-mode" value="append" ${st.impMode === 'append' ? 'checked' : ''} ${ro ? 'disabled' : ''}>
            <span>Add everything as new lines</span></label>
          <label class="chk"><input type="radio" name="mdb-mode" value="replace" ${st.impMode === 'replace' ? 'checked' : ''} ${ro ? 'disabled' : ''}>
            <span>Replace the whole database</span></label>
        </div>
        <div class="mdb-io-row">
          <button class="btn primary" data-mdb="import-run" ${ro ? 'disabled' : ''}>Import the rows</button>
          <button class="btn sm ghost" data-mdb="import-clear">Clear the box</button>
        </div>
        ${st.impErr ? `<p class="form-err">${esc(st.impErr)}</p>` : ''}
        ${st.impMsg ? `<p class="mdb-ok">${esc(st.impMsg)}</p>` : ''}
      </section>

      <section class="mdb-io danger-zone">
        <h3>The shipped catalogue</h3>
        <p class="hint">The app opens with 757 materials read off the project materials schedule. Restoring brings back
          any line you have deleted and keeps your edits; emptying removes everything on this device.</p>
        <div class="mdb-io-row">
          <button class="btn" data-mdb="restore" ${ro ? 'disabled' : ''}>Restore the shipped materials</button>
          <button class="btn danger" data-mdb="wipe" ${ro ? 'disabled' : ''}>${st.confirm === 'wipe' ? 'Really empty the database?' : 'Empty the database'}</button>
          ${st.confirm === 'wipe' ? '<button class="btn danger" data-mdb="wipe-yes">Yes, empty it</button><button class="btn" data-mdb="g-cancel">No</button>' : ''}
        </div>
      </section>`;
  }

  /* ------------------------------------------------------------- downloads */
  function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
  }

  function filtered() {
    return db().search(st.q, { cat: st.cat, unit: st.unit, sort: st.sort }).rows;
  }

  function listFor(ids) {
    const all = db().all();
    return (ids && ids.length) ? all.filter(r => ids.indexOf(r.id) >= 0) : all;
  }

  function exportXlsx(ids, list) {
    try {
      list = list || listFor(ids);
      if (!list.length) { O.toast('Nothing to export'); return; }
      const blob = root.XlsxWriter.buildCatalogue(list, {
        currency: O.currency, date: nowDate(),
        title: st.cat === 'all' ? 'The whole database' : st.cat,
        priced: list.filter(r => r.rate != null).length,
        note: 'Kept on this device by Quick Quantity. Edit the rate and the supplier columns; import the file back to update the database.'
      });
      const name = 'Materials_database_' + (st.cat === 'all' ? 'all' : slug(st.cat)) + '.xlsx';
      download(blob, name);
      O.toast('Exported ' + list.length + ' materials — ' + name);
    } catch (err) {
      console.error(err); O.toast('Could not build the workbook');
    }
  }

  function exportCsv(ids, list) {
    list = list || listFor(ids);
    if (!list.length) { O.toast('Nothing to export'); return; }
    const csv = db().toCSV(list.map(r => r.id));
    const name = 'Materials_database_' + (st.cat === 'all' ? 'all' : slug(st.cat)) + '.csv';
    download(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), name);
    O.toast('Exported ' + list.length + ' materials — ' + name);
  }

  function printList(list) {
    list = list || db().all();
    if (!list.length) { O.toast('Nothing to print'); return; }
    let host = document.getElementById('mdb-print');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'mdb-print';
    let lastCat = null;
    const body = list.map(r => {
      let band = '';
      if (r.cat !== lastCat) {
        lastCat = r.cat;
        const n = list.filter(x => x.cat === r.cat).length;
        band = `<tr class="mb-band"><td colspan="6">${esc(r.cat)} <span>${n} material${n === 1 ? '' : 's'}</span></td></tr>`;
      }
      return band + `<tr><td class="mb-code">${esc(r.code)}</td><td><b>${esc(r.name)}</b>${r.desc ? '<div class="mb-d">' + esc(r.desc) + '</div>' : ''}</td>
        <td class="mb-u">${esc(r.unit)}</td><td class="mb-r">${r.rate == null ? '—' : fmt(r.rate)}</td>
        <td class="mb-s">${esc(r.sup || '')}</td><td class="mb-n">${esc(r.note || '')}</td></tr>`;
    }).join('');
    host.innerHTML = `<div class="mb-head">
        <div class="mb-kicker">MATERIALS DATABASE</div>
        <h1>${esc(st.cat === 'all' ? 'All materials' : st.cat)}</h1>
        <div class="mb-meta">${list.length} materials · rates in ${esc(O.currency)} · ${nowDate()}${st.q ? ' · search “' + esc(st.q) + '”' : ''}</div>
      </div>
      <table class="mb-table">
        <thead><tr><th>Code</th><th>Material and specification</th><th>Unit</th><th class="mb-r">Rate (${esc(O.currency)})</th><th>Supplier</th><th>Notes</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <div class="mb-foot">Quick Quantity · materials database kept on this device · rates are indicative and editable</div>`;
    document.body.appendChild(host);
    document.body.classList.add('mdb-printing');
    const clean = () => {
      document.body.classList.remove('mdb-printing');
      const h = document.getElementById('mdb-print');
      if (h) h.remove();
      window.removeEventListener('afterprint', clean);
    };
    window.addEventListener('afterprint', clean);
    setTimeout(() => { window.print(); setTimeout(clean, 800); }, 60);
  }

  /* ------------------------------------------------------------- events */
  function onClick(e) {
    const t = e.target.closest('[data-mdb]');
    if (e.target.closest('[data-mdb="sel-all"]')) return;
    if (!t) {
      // a click on a row opens it for reading or editing
      const row = e.target.closest('.mdb-row');
      if (row && !e.target.closest('input') && !e.target.closest('button')) {
        if (O.onPick) { const rec = db().get(row.dataset.id); if (rec) { const done = O.onPick; close(); done(rec); } return; }
        return edit(row.dataset.id);
      }
      return;
    }
    const act = t.dataset.mdb, id = t.dataset.id || '', cat = t.dataset.cat || '';

    if (act === 'close') return close();
    if (act === 'pick' || (O.onPick && e.target.closest('.mdb-row') && !e.target.closest('button') && !e.target.closest('input'))) {
      const rec = db().get(id || (e.target.closest('.mdb-row') || {}).dataset.id);
      if (!rec) return;
      const done = O.onPick;
      close();
      if (done) done(rec);
      return;
    }
    if (act === 'tab') { st.tab = t.dataset.tab; st.form = null; st.confirm = ''; st.gErr = ''; return paint(); }

    if (act === 'new') { if (!O.canEdit()) return O.toast('A reviewer cannot change the database'); st.form = { src: 'user', cat: st.cat !== 'all' ? st.cat : '' }; st.formErr = ''; st.confirm = ''; paint(); const n = document.querySelector('#mdb-form [name="name"]'); if (n) n.focus(); return; }
    if (act === 'cancel') { st.form = null; st.formErr = ''; st.confirm = ''; st.gRename = ''; st.gRemove = ''; st.gErr = ''; return paint(); }
    if (act === 'save') return saveForm(false);
    if (act === 'save-new') return saveForm(true);

    if (act === 'edit') return edit(id);
    if (act === 'dup') {
      if (!O.canEdit()) return O.toast('A reviewer cannot change the database');
      const out = db().duplicate(id);
      if (!out.ok) return O.toast(out.error || 'Could not duplicate');
      O.toast('Duplicated — the copy is open for you to change');
      st.form = Object.assign({}, out.rec); st.formErr = ''; st.tab = 'list';
      O.onChange(); paint(); return;
    }
    if (act === 'del') { st.confirm = id; return paint(); }
    if (act === 'del-no') { st.confirm = ''; return paint(); }
    if (act === 'del-yes') {
      if (!O.canEdit()) return O.toast('A reviewer cannot change the database');
      const out = db().remove(id);
      if (!out.ok) return O.toast(out.error || 'Could not delete');
      delete st.sel[id]; st.confirm = '';
      O.toast('Material deleted'); O.onChange(); return paint();
    }

    if (act === 'sel-clear') { st.sel = {}; return paint(); }
    if (act === 'bulk-move') {
      if (!O.canEdit()) return O.toast('A reviewer cannot change the database');
      const sel = document.getElementById('mdb-bulk-cat');
      const to = sel ? sel.value : '';
      if (!to) return O.toast('Choose the group to move them to');
      const out = db().setGroupMany(Object.keys(st.sel).filter(k => st.sel[k]), to, undefined);
      if (!out.ok) return O.toast(out.error || 'Could not move');
      O.toast(out.changed + ' moved to ' + to); st.sel = {}; O.onChange(); return paint();
    }
    if (act === 'bulk-export') return exportXlsx(Object.keys(st.sel).filter(k => st.sel[k]));
    if (act === 'bulk-del') {
      if (!O.canEdit()) return O.toast('A reviewer cannot change the database');
      const ids = Object.keys(st.sel).filter(k => st.sel[k]);
      const out = db().removeMany(ids);
      if (!out.ok) return O.toast(out.error || 'Could not delete');
      O.toast(out.removed + ' materials deleted'); st.sel = {}; O.onChange(); return paint();
    }

    if (act === 'page') { st.page = Math.max(1, +t.dataset.page || 1); return paint(); }

    if (act === 'g-add') {
      if (!O.canEdit()) return O.toast('A reviewer cannot change the database');
      const out = db().groupAdd(st.gNew);
      if (!out.ok) { st.gErr = out.error; return paint(); }
      st.gErr = ''; st.gNew = ''; O.toast('Group added'); O.onChange(); return paint();
    }
    if (act === 'g-rename') { st.gRename = cat; st.gRenameVal = cat; st.gRemove = ''; return paint(); }
    if (act === 'g-rename-save') {
      const inp = document.querySelector('[name="grename"]');
      const out = db().groupRename(cat, inp ? inp.value : st.gRenameVal);
      if (!out.ok) { st.gErr = out.error; return paint(); }
      st.gRename = ''; st.gErr = ''; O.toast(out.moved + ' materials moved to the new name'); O.onChange(); return paint();
    }
    if (act === 'g-remove') { st.gRemove = cat; st.gRename = ''; return paint(); }
    if (act === 'g-remove-do') {
      const sel = document.getElementById('mdb-gmove');
      const to = sel ? sel.value : 'Miscellaneous';
      const out = db().groupRemove(cat, to);
      if (!out.ok) { st.gErr = out.error; return paint(); }
      st.gRemove = ''; O.toast(out.moved + ' materials moved to ' + out.into); O.onChange(); return paint();
    }
    if (act === 'g-cancel') { st.gRename = ''; st.gRemove = ''; st.gErr = ''; st.confirm = ''; return paint(); }
    if (act === 'g-filter') { st.tab = 'list'; st.cat = cat; st.page = 1; st.sel = {}; return paint(); }

    if (act === 'export-xlsx') return exportXlsx();
    if (act === 'export-csv') return exportCsv();
    if (act === 'print') return printList();
    if (act === 'export-xlsx-filtered') return exportXlsx(null, filtered());
    if (act === 'export-csv-filtered') return exportCsv(null, filtered());
    if (act === 'print-filtered') return printList(filtered());
    if (act === 'import-clear') { st.impText = ''; st.impMsg = ''; st.impErr = ''; return paint(); }
    if (act === 'import-run') {
      if (!O.canEdit()) return O.toast('A reviewer cannot change the database');
      const txt = st.impText;
      if (!text0(txt)) { st.impErr = 'Paste the rows, or choose a CSV file, first.'; st.impMsg = ''; return paint(); }
      const out = db().importRows(txt, { mode: st.impMode });
      st.impErr = '';
      st.impMsg = 'Read ' + out.read + ' rows — ' + out.added + ' added, ' + out.updated + ' updated'
        + (out.skipped ? ', ' + out.skipped + ' skipped' : '') + '.';
      st.impText = '';
      O.onChange(); return paint();
    }
    if (act === 'restore') {
      if (!O.canEdit()) return O.toast('A reviewer cannot change the database');
      const out = db().seed(true);
      O.toast(out.added ? out.added + ' shipped materials restored' : 'Nothing was missing');
      O.onChange(); return paint();
    }
    if (act === 'wipe') { st.confirm = 'wipe'; return paint(); }
    if (act === 'wipe-yes') {
      if (!O.canEdit()) return O.toast('A reviewer cannot change the database');
      db().clearAll(); db().seed(true);
      st.confirm = ''; st.sel = {}; st.form = null;
      O.toast('Database emptied and returned to the shipped catalogue'); O.onChange(); return paint();
    }
  }

  const text0 = s => String(s || '').trim().length > 0;

  function edit(id) {
    const rec = db().get(id);
    if (!rec) return O.toast('That material is no longer in the database');
    st.form = Object.assign({}, rec);
    st.formErr = ''; st.confirm = ''; st.tab = 'list';
    paint();
    const body = document.getElementById('mdb-body');
    if (body) body.scrollTop = 0;
    const n = document.querySelector('#mdb-form [name="name"]');
    if (n) { n.focus(); n.select(); }
  }

  function onChange(e) {
    const t = e.target;
    /* the Group menu ends in "A new group…": choosing it opens the text box
       without redrawing the form (the other fields must keep what is typed) */
    if (t.dataset && t.dataset.groupPick) {
      const box = t.parentNode.querySelector('[name="catNew"]');
      if (box) {
        const isNew = t.value === '__new';
        box.style.display = isNew ? '' : 'none';
        if (isNew) box.focus();
      }
      return;
    }
    if (t.id === 'mdb-cat') { st.cat = t.value; st.page = 1; st.sel = {}; return paint(); }
    if (t.id === 'mdb-unit') { st.unit = t.value; st.page = 1; st.sel = {}; return paint(); }
    if (t.id === 'mdb-sort') { st.sort = t.value; st.page = 1; return paint(); }
    if (t.dataset && t.dataset.mdb === 'sel') { st.sel[t.dataset.id] = !!t.checked; return paint(); }
    if (t.dataset && t.dataset.mdb === 'sel-all') {
      const page = db().search(st.q, { cat: st.cat, unit: st.unit, sort: st.sort, page: st.page, pageSize: st.size }).rows;
      page.forEach(r => { st.sel[r.id] = t.checked; });
      return paint();
    }
    if (t.name === 'mdb-mode') { st.impMode = t.value; return; }
  }

  function onInput(e) {
    const t = e.target;
    if (t.id === 'mdb-q') {
      st.q = t.value; st.page = 1; st.sel = {}; st.want = 'q'; return paint();
    }
    if (t.name === 'gnew') { st.gNew = t.value; return; }
    if (t.id === 'mdb-imp-text') { st.impText = t.value; return; }
    if (t.name === 'grename') { st.gRenameVal = t.value; return; }
    if (t.id === 'mdb-file') return;
  }

  function onKey(e) {
    if (!document.getElementById('mdb-overlay')) return;
    if (e.key === 'Enter' && e.target.closest && e.target.closest('#mdb-form')) {
      if (e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      if (O.canEdit()) saveForm(false);
    }
    if (e.key === 'Enter' && e.target.name === 'gnew' && O.canEdit()) {
      e.preventDefault();
      const out = db().groupAdd(st.gNew);
      if (!out.ok) { st.gErr = out.error; } else { st.gNew = ''; st.gErr = ''; O.toast('Group added'); O.onChange(); }
      paint();
    }
  }

  /* the file picker posts a CSV into the textarea so the user can see it first */
  document.addEventListener('change', e => {
    if (!e.target || e.target.id !== 'mdb-file') return;
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      st.impText = String(rd.result || '');
      st.impName = f.name;
      st.impMsg = ''; st.impErr = '';
      if (st.tab !== 'io') st.tab = 'io';
      paint();
      O.toast('Read ' + f.name + ' — check the rows, then import them');
    };
    rd.readAsText(f);
  });

  root.MatUI = { open: open, close: close, refresh: () => { if (st.open) paint(); } };
})(typeof window !== 'undefined' ? window : globalThis);
