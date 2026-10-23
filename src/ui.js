/* =====================================================================
   Quick Quantity — application UI
   ===================================================================== */
(function () {
  'use strict';

  const LS_KEY = 'plan2boq.v1';
  let ACTIVE_UID = '';                       // whose working bill this session holds
  const lsKey = () => LS_KEY + (ACTIVE_UID ? '.' + ACTIVE_UID : '');

  const state = {
    step: 1,
    image: null,        // {dataUrl, name, size}
    analysis: null,
    scaleMM: null,      // real length (mm) of the reference span
    refPx: null,        // reference span in image pixels
    scaleSource: 'building',
    scaleMode: 'assumed', // auto | ratio | known | assumed
    ratio: 100,           // 1:n when the scale is set from paper size
    paperMM: 420,         // long edge of the sheet in mm when the scale is set
    pickMode: false,
    picked: [],
    drain: null,          // the run, chambers and tank pipe read on step 2
    plans: [],            // every plan uploaded for this building
    planId: null,         // the one being measured
    drainTrace: false,    // tracing the drain route on the plan
    drainPts: [],
    params: paramsFor('school'),
    verticals: { files: [], levels: [] },
    roof: null,         // {name, dataUrl, size, page, pages, text} — the roof plan
    roofRead: null,     // what was read off it: outline, pitch, covering
    sheets: null,        // sheets found inside a multi-page PDF
    sheetInfo: null,
    sheetsKey: null,
    result: null,
    savedAt: null,
    libraryId: null,      // row in the saved-bills database, once the bill exists
    libraryCreatedAt: null,
    boqTab: 'bill',       // the Bill of Quantities module: 'bill' or 'materials'
    digital: null,        // digital take-off: scales and the marks measured on the plan
    matQ: '', matCat: 'all', matSort: 'cat', matSrc: null,
    matEdit: null, matAdd: false
  };

  /* ---------------------------------------------------------------- utils */
  // General-engine keys fill the gaps in a school param set (and vice versa)
  // without ever overwriting the values that belong to that engine.
  // the symbol this project prints (Ghana cedi unless the country changes)
  const SYM = p => (p && p.curSymbol) || 'GH¢';

  function syncCurrency(p) {
    if (typeof GenEngine === 'undefined' || !GenEngine.currency) return p;
    const c = GenEngine.currency(p.country);
    p.curCode = c.cur; p.curSymbol = c.symbol; p.curLabel = c.label;
    p.curName = c.unit; p.curSub = c.sub;
    // the built-in card is Ghanaian; say so whenever another country prints it
    if (p.country === 'Ghana') {
      if (p.priceNoteAuto) { p.priceNote = ''; p.priceNoteAuto = false; }
    } else if (!p.priceNote || p.priceNoteAuto) {
      p.priceNote = 'Ghana rate card (Greater Accra, Q4 2026) shown in ' + c.cur +
        ' — not localised for ' + p.country + '. Use a price feed or an AI price check, or edit the rates.';
      p.priceNoteAuto = true;
    }
    return p;
  }

  function fillDefaults(p, base) {
    Object.keys(base).forEach(k => { if (p[k] === undefined) p[k] = BOQ.clone(base[k]); });
    return p;
  }
  function paramsFor(tpl, src) {
    src = src || {};
    if (tpl === 'school') {
      const p = fillDefaults(BOQ.merge(BOQ.clone(BOQ.DEFAULT_PARAMS), src), GenEngine.DEFAULTS);
      p.template = 'school';
      p.buildingType = 'educational';
      return syncCurrency(p);
    }
    const p = fillDefaults(GenEngine.merge(BOQ.clone(GenEngine.DEFAULTS), src), BOQ.DEFAULT_PARAMS);
    p.template = 'general';
    return syncCurrency(p);
  }
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n, d = 2) => (isFinite(n) ? Number(n) : 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtQty = (n, unit) => unit === 'm3' ? fmt(n, 3) : fmt(n, 2);

  /* ------------------------------------------------------------- the user
     Who is signed in decides what this session may touch: a reviewer gets
     the whole bill to read and print, and nothing to change. */
  const user = () => (typeof Users !== 'undefined' && Users.current()) || null;
  const can = what => (typeof Users === 'undefined' ? true : Users.can(what));
  function guard(what) {
    if (can(what)) return true;
    toast(user()
      ? 'Signed in as ' + user().name + ' — a reviewer can read and print, not change'
      : 'Sign in to change the bill');
    return false;
  }

  /* ------------------------------------------------------------- the scale
     A drawing is only as accurate as its scale. Four ways to know it, in
     order of how much they are worth:
       auto    — the sheet prints its own scale (1:100) and the page size
                 tells us the paper, so every pixel converts exactly
       ratio   — the user says "A3 at 1:100"; same arithmetic, their paper
       known   — a dimension is printed on the plan and is measured against
                 the reference span
       assumed — nothing is known: the plan is taken to be the standard
                 building wide, and every screen says so until it is set
     mmPerPx is the single number the rest of the app works from. */
  const PAPERS = [[297, 'A4'], [420, 'A3'], [594, 'A2'], [841, 'A1'], [1189, 'A0']];
  const paperName = mm => {
    const hit = PAPERS.filter(x => Math.abs(x[0] - mm) < 12)[0];
    return hit ? hit[1] : Math.round(mm) + ' mm';
  };
  const currentSheet = () => (state.sheets || []).filter(s => state.pdf && s.page === state.pdf.page)[0] || null;

  function scaleBasis(a) {
    a = a || state.analysis || {};
    const refPx = state.refPx || a.refPx || 1;
    const longPx = Math.max(a.width || 1, a.height || 1);
    const mode = state.scaleMode || 'assumed';
    const sh = currentSheet();
    const printed = sh && sh.scale ? +sh.scale : 0;
    const out = { mode: mode, mmPerPx: null, basis: '', known: false, refPx: refPx, printed: printed };
    if (mode === 'auto' && printed && sh.longestPt && longPx) {
      const paper = sh.longestPt * 0.352778;
      out.mmPerPx = paper * printed / longPx;
      out.basis = '1:' + printed + ' printed on the sheet (' + paperName(paper) + ' paper)';
      out.known = true;
    } else if (mode === 'ratio') {
      const r = +state.ratio || 100, paper = +state.paperMM || 420;
      out.mmPerPx = paper * r / longPx;
      out.basis = '1:' + r + ' on ' + paperName(paper) + ' paper — set by you';
      out.known = true;
    } else if (mode === 'known' && +state.scaleMM > 0) {
      out.mmPerPx = +state.scaleMM / refPx;
      out.basis = 'a known dimension of ' + fmt(+state.scaleMM / 1000, 2) + ' m across ' + Math.round(refPx) + ' px';
      out.known = true;
    }
    if (!out.mmPerPx) {
      const p = state.params || {};
      const baseMM = ((isSchool() ? +p.overallW : +p.bW) || 0) * 1000;
      out.mmPerPx = baseMM / refPx;
      out.basis = 'not shown — the plan is taken as ' + fmt(baseMM / 1000, 2) + ' m wide until you set a scale';
      out.known = false;
    }
    return out;
  }
  // keep state.scaleMM/refPx in step with the chosen basis: every other part
  // of the app reads those two numbers
  function syncScale() {
    const s = scaleBasis(state.analysis);
    if (state.analysis) {
      state.refPx = state.refPx || state.analysis.refPx;
      if (state.scaleMode === 'known') {
        // the typed dimension is the authority
      } else {
        state.scaleMM = Math.round(s.mmPerPx * s.refPx);
      }
    }
    /* the scale belongs to the drawing: keep it on the plan being measured,
       so switching to another plan and back finds the same scale again */
    if (typeof storePlanScale === 'function' && state.planId) storePlanScale();
    return s;
  }
  window.__toast = toast;

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function words(amount, pp) {
    const S = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven',
      'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const T = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const h = n => {
      const out = [];
      if (n >= 100) { out.push(S[Math.floor(n / 100)] + ' Hundred'); n %= 100; }
      if (n >= 20) { let t = T[Math.floor(n / 10)]; if (n % 10) t += '-' + S[n % 10]; out.push(t); }
      else if (n > 0) out.push(S[n]);
      return out.join(' ');
    };
    let c = Math.floor(Math.round(amount * 100) / 100);
    const p = Math.round((Math.round(amount * 100) / 100 - c) * 100);
    const parts = [];
    [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand']].forEach(([d, name]) => {
      if (c >= d) { parts.push(h(Math.floor(c / d)) + ' ' + name); c %= d; }
    });
    if (c) parts.push(h(c));
    let out = (parts.join(' ') || 'Zero') + ' ' + ((pp && pp.curName) || 'Cedis');
    if (p) out += ' and ' + h(p) + ' ' + ((pp && pp.curSub) || 'Pesewas');
    return out;
  }

  const save = () => {
    try {
      const payload = {
        step: state.step, image: state.image, scaleMM: state.scaleMM, refPx: state.refPx,
        digital: state.digital || null,
        scaleSource: state.scaleSource, scaleMode: state.scaleMode, ratio: state.ratio, paperMM: state.paperMM,
        params: state.params, verticals: state.verticals,
        roof: state.roof || null, roofRead: state.roofRead || null,
        buildingRead: state.buildingRead || null, sheets: state.sheets || null,
        roomRead: state.roomRead || null, roomPreset: state.roomPreset,
        drain: state.drain || null,
        genRead: state.genRead || null,
        plans: plansOf().map(pp => { const { file, ...rest } = pp; return rest; }),
        planId: state.planId || null,
        floorShow: state.floorShow == null ? null : state.floorShow,
        libraryId: state.libraryId || null, libraryCreatedAt: state.libraryCreatedAt || null,
        boqTab: state.boqTab === 'materials' ? 'materials' : 'bill',
        sideOpen: state.sideOpen === true || state.sideOpen === false ? state.sideOpen : null,
        labWeeks: state.labWeeks || null,
        savedAt: new Date().toISOString()
      };
      let saved = false;
      try {
        localStorage.setItem(lsKey(), JSON.stringify(payload));
        saved = true;
      } catch (e) {
        // out of room: first let go of the pictures of the plans that are not
        // being measured, then of the roof plan's, rather than lose the project
        if (!saved && payload.plans && payload.plans.length > 1) {
          payload.plans = payload.plans.map(pp => pp.id === payload.planId ? pp
            : Object.assign({}, pp, { dataUrl: '' }));
          try { localStorage.setItem(lsKey(), JSON.stringify(payload)); saved = true; } catch (e0) { /* still full */ }
        }
        // and then drop the roof plan's pixels
        if (!saved && payload.roof && payload.roof.dataUrl) {
          payload.roof = Object.assign({}, payload.roof, { dataUrl: '' });
          try { localStorage.setItem(lsKey(), JSON.stringify(payload)); saved = true; } catch (e2) { /* still full */ }
        }
        if (!saved && !save._warned) {
          /* silence here means the plan and the take-off are gone at the next
             reload, which reads as "it lost my work" — say so instead */
          save._warned = true;
          setTimeout(() => toast('This browser is out of room for the plan picture — export a project file to keep it'), 60);
        }
      }
    } catch (e) { /* storage may be blocked entirely */ }
    scheduleLibrarySave();
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(lsKey());
      if (!raw) return false;
      const p = JSON.parse(raw);
      state.image = p.image || null;
      state.digital = p.digital || null;
      state.scaleMM = p.scaleMM || null;
      state.refPx = p.refPx || null;
      state.scaleSource = p.scaleSource || 'overall';
      state.scaleMode = p.scaleMode || 'assumed';
      state.ratio = +p.ratio || 100;
      state.paperMM = +p.paperMM || 420;
      state.params = paramsFor((p.params && p.params.template) || 'school', p.params);
      state.verticals = p.verticals || { files: [], levels: [] };
      state.roof = p.roof || null;
      state.roofRead = p.roofRead || null;
      state.buildingRead = p.buildingRead || null;
      state.sheets = p.sheets || null;
      state.roomRead = p.roomRead || null;
      state.roomPreset = (p.roomPreset === undefined ? null : p.roomPreset);
      state.drain = p.drain || null;
      state.genRead = p.genRead || null;
      state.plans = Array.isArray(p.plans) ? p.plans : [];
      state.planId = p.planId || null;
      state.floorShow = p.floorShow == null ? null : Math.max(0, +p.floorShow);
      state.libraryId = p.libraryId || null;
      state.libraryCreatedAt = p.libraryCreatedAt || null;
      state.boqTab = p.boqTab === 'materials' ? 'materials' : 'bill';
      state.sideOpen = undefined;            // opening a file never pops the summary open
      state.labWeeks = +p.labWeeks > 0 ? +p.labWeeks : null;
      /* files saved before the digital take-off step carry the old numbering */
      const oldFile = p.digital === undefined;
      state.step = Math.min(10, (p.step || 1) + (oldFile && (p.step || 1) >= 3 ? 1 : 0));
      /* a project saved on the old material tab opens on the schedule step */
      if (state.step === 6 && state.boqTab === 'materials') state.step = 7;
      state.savedAt = p.savedAt;
      repairRoomRead();
      return true;
    } catch (e) { return false; }
  };

  /* --------------------------------------------------------- saved bills */
  /* Every bill the app generates is written to a small local database
     (IndexedDB; localStorage where the browser forbids it) so it can be
     re-opened, exported or printed in a later session, offline. */
  let libTimer = null, lastLibSig = '', thumbCache = { key: '', data: null };

  const whenText = iso => {
    const d = new Date(iso || Date.now());
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  function recordBuildingLabel(p) {
    if (state.buildingRead && state.buildingRead.label) return state.buildingRead.label;
    const t = p.template === 'school' ? 'educational' : (p.buildingType || 'domestic');
    const preset = (Settings.PRESETS || []).find(x => (x.params.template === 'school'
      ? t === 'educational' : x.params.buildingType === t));
    return preset ? preset.label : (t.charAt(0).toUpperCase() + t.slice(1) + ' building');
  }

  // exactly what save() keeps, so a record can be re-opened without the screen
  function snapshotOf() {
    return {
      image: state.image, scaleMM: state.scaleMM, refPx: state.refPx,
      scaleSource: state.scaleSource, scaleMode: state.scaleMode,
      ratio: state.ratio, paperMM: state.paperMM,
      params: BOQ.clone(state.params), verticals: state.verticals,
      digital: state.digital ? BOQ.clone(state.digital) : null,
      roof: state.roof || null, roofRead: state.roofRead || null,
      buildingRead: state.buildingRead || null, sheets: state.sheets || null,
      roomRead: state.roomRead || null, roomPreset: state.roomPreset,
      drain: state.drain || null,
      genRead: state.genRead || null,
      plans: plansOf().map(pp => { const { file, ...rest } = pp; return rest; }),
      planId: state.planId || null,
      floorShow: state.floorShow == null ? null : state.floorShow,
      savedAt: new Date().toISOString()
    };
  }

  function applySnapshot(snap) {
    snap = snap || {};
    state.image = snap.image || null;
    state.scaleMM = snap.scaleMM || null;
    state.refPx = snap.refPx || null;
    state.scaleSource = snap.scaleSource || 'assumed';
    state.scaleMode = snap.scaleMode || 'assumed';
    state.ratio = +snap.ratio || 100;
    state.paperMM = +snap.paperMM || 420;
    state.params = paramsFor((snap.params && snap.params.template) || 'school', snap.params);
    state.verticals = snap.verticals || { files: [], levels: [] };
    state.digital = snap.digital || null;
    state.roof = snap.roof || null;
    state.roofRead = snap.roofRead || null;
    state.buildingRead = snap.buildingRead || null;
    state.sheets = snap.sheets || null;
    state.roomRead = snap.roomRead || null;
    state.roomPreset = snap.roomPreset === undefined ? null : snap.roomPreset;
    state.drain = snap.drain || null;
    state.genRead = snap.genRead || null;
    state.plans = Array.isArray(snap.plans) ? snap.plans : [];
    state.planId = snap.planId || null;
    state.analysis = null;
    state.result = recompute();
    repairRoomRead();
  }

  function thumbFor(dataUrl) {
    if (!dataUrl) return Promise.resolve(null);
    if (thumbCache.key === dataUrl) return Promise.resolve(thumbCache.data);
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        try {
          const w = 128, h = Math.max(1, Math.round(img.height * (w / img.width)));
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          const out = c.toDataURL('image/jpeg', 0.6);
          thumbCache = { key: dataUrl, data: out };
          resolve(out);
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  async function recordFromState() {
    const r = state.result || recompute();
    const p = state.params;
    if (!state.libraryId) {
      state.libraryId = Library.uid();
      state.libraryCreatedAt = new Date().toISOString();
    }
    const thumb = (state.image && state.image.dataUrl) ? await thumbFor(state.image.dataUrl) : null;
    const u = user();
    const meta = {
      id: state.libraryId,
      ownerId: (u && u.id) || '',
      ownerName: (u && u.name) || '',
      name: p.projectName || 'Untitled bill',
      sub: p.projectSub || '',
      building: recordBuildingLabel(p),
      buildingType: p.template === 'school' ? 'educational' : (p.buildingType || 'domestic'),
      template: p.template || 'school',
      curCode: p.curCode || 'GHS', symbol: p.curSymbol || 'GH¢',
      country: p.country || 'Ghana',
      grand: r.grand, subtotal: r.subtotal, perM2: r.perM2, gfa: r.GFA,
      bills: r.bills.length,
      items: r.bills.reduce((n, b) => n + b.items.length, 0),
      rates: p.priceNote || '', ratesDate: p.ratesBasisDate || '2026-10-01',
      thumb: thumb,
      createdAt: state.libraryCreatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return { meta: meta, snapshot: snapshotOf() };
  }

  function scheduleLibrarySave() {
    if (!can('edit')) return;
    if (state.libBusy || state.libNoStore) return;
    if (state.libDeletedId && state.libraryId === state.libDeletedId) return;
    clearTimeout(libTimer);
    libTimer = setTimeout(flushLibrarySave, 1200);
  }

  async function flushLibrarySave() {
    if (state.libBusy || typeof Library === 'undefined') return;
    if (!state.result || !(state.result.grand > 0)) return;
    // a project nobody has touched is not worth keeping
    if (!(state.step >= 3 || state.image || state.libraryId)) return;
    try {
      const rec = await recordFromState();
      const sig = rec.meta.id + '|' + rec.meta.grand + '|' + JSON.stringify(rec.snapshot.params);
      if (sig === lastLibSig) return;
      const res = await Library.put(rec);
      if (res.blocked) {
        state.libNoStore = true;
        toast('This window cannot keep a saved-bills database — download the file and open it directly to keep a history');
        return;
      }
      lastLibSig = sig;
      if (!res.ok) { toast('Browser storage is full — back up the saved bills and delete some old ones'); return; }
      updateProjectsBadge();
    } catch (e) { /* storage blocked — the bill is still generated, it just is not kept */ }
  }

  async function saveToLibrary() {
    if (!guard('edit')) return;
    try {
      const rec = await recordFromState();
      const res = await Library.put(rec);
      if (res.blocked) { state.libNoStore = true; toast('This window cannot keep a saved-bills database — open the downloaded file directly to keep a history'); return; }
      if (!res.ok) { toast('Browser storage is full — export a backup and delete old bills'); return; }
      state.libDeletedId = null;
      lastLibSig = rec.meta.id + '|' + rec.meta.grand + '|' + JSON.stringify(rec.snapshot.params);
      updateProjectsBadge(); paintRecent(); paintLibrary();
      toast('Kept in Saved bills — ' + (rec.meta.symbol || 'GH¢') + ' ' + fmt(rec.meta.grand));
    } catch (e) { toast('Could not save this bill in the browser'); }
  }

  async function updateProjectsBadge() {
    const btn = document.getElementById('btn-projects');
    if (!btn || typeof Library === 'undefined') return;
    try {
      const n = visibleBills(await Library.list()).length;
      const badge = btn.querySelector('.count');
      if (badge) { badge.textContent = n; badge.hidden = !n; }
      btn.title = n ? n + ' saved bill' + (n === 1 ? '' : 's') + ' — re-open, export or print one'
                    : 'Bills you generate are kept on this device';
    } catch (e) { /* no library available */ }
  }

  /* a reviewer and an administrator see every bill on the device; a
     quantity surveyor and a contractor see the bills they made */
  function visibleBills(rows) {
    const list = rows || [];
    if (can('seeAll')) return list;
    const me = (user() || {}).id;
    return list.filter(r => !r.ownerId || r.ownerId === me);
  }

  function libRows(rows) {
    const q = (state.libQuery || '').trim().toLowerCase();
    let out = rows || [];
    if (q) out = out.filter(r => ((r.name || '') + ' ' + (r.building || '') + ' ' + (r.buildingType || '') + ' ' + (r.country || '')).toLowerCase().indexOf(q) >= 0);
    const sort = state.libSort || 'new';
    return out.slice().sort((a, b) => {
      if (sort === 'old') return String(a.updatedAt || '').localeCompare(String(b.updatedAt || ''));
      if (sort === 'value') return (+b.grand || 0) - (+a.grand || 0);
      if (sort === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
  }

  function libraryRow(m) {
    const cur = m.id === state.libraryId;
    const del = state.libDeleteId === m.id;
    const ren = state.libRenameId === m.id;
    const sym = m.symbol || 'GH¢';
    const picked = !!(state.libSel && state.libSel[m.id]);
    return `<article class="lib-row${cur ? ' current' : ''}${picked ? ' chosen' : ''}" data-row="${esc(m.id)}">
      <label class="lib-check" title="Select this bill">
        <input type="checkbox" data-lib-check="${esc(m.id)}"${picked ? ' checked' : ''}
          aria-label="Select ${esc(m.name)}">
      </label>
      <div class="lib-thumb">${m.thumb
        ? `<img src="${m.thumb}" alt="">`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 20V6l8-3 8 3v14H4Z"/><path d="M9 20v-6h6v6"/></svg>`}</div>
      <div class="lib-main">
        <div class="lib-name">${ren
          ? `<input class="lib-rename" id="lib-rename-input" value="${esc(m.name)}" maxlength="80">`
          : `<b>${esc(m.name)}</b>`}${cur ? ' <span class="tag">open now</span>' : ''}</div>
        <div class="lib-meta">${esc(m.building || m.buildingType || '')}${can('seeAll') && m.ownerName && m.ownerId !== (user() || {}).id
          ? ' · <span class="tag">' + esc(m.ownerName) + '</span>' : ''}</div>
        <div class="lib-meta">${esc(whenText(m.updatedAt))} · ${m.bills || 0} bills · ${m.items || 0} items${m.gfa ? ' · ' + fmt(m.gfa) + ' m²' : ''}${m.country && m.country !== 'Ghana' ? ' · ' + esc(m.country) : ''}</div>
        <div class="lib-rates" title="${esc(m.rates || '')}">${esc(m.rates || 'Rates as issued: Q4 2026 Greater Accra market')}</div>
      </div>
      <div class="lib-amount">
        <b>${esc(sym)} ${fmt(m.grand)}</b>
        <span>${m.gfa ? esc(sym) + ' ' + fmt(m.perM2) + ' / m²' : ''}</span>
      </div>
      <div class="lib-actions${del ? ' confirming' : ''}">
        ${del ? `<span class="lib-confirm-txt">Delete <b>${esc(m.name)}</b> and its plan from this device? This cannot be undone.</span>
          <button class="btn sm danger" data-lib-act="delete-yes" data-id="${esc(m.id)}">Delete this bill</button>
          <button class="btn sm" data-lib-act="delete-no" data-id="${esc(m.id)}">Keep it</button>`
        : `<button class="btn sm" data-lib-act="open" data-id="${esc(m.id)}">Open</button>
          <button class="btn sm" data-lib-act="xlsx" data-id="${esc(m.id)}">Excel</button>
          <button class="btn sm" data-lib-act="docx" data-id="${esc(m.id)}">Word</button>
          <button class="btn sm" data-lib-act="pdf" data-id="${esc(m.id)}">PDF</button>
          <button class="btn sm" data-lib-act="print" data-id="${esc(m.id)}">Print</button>
          ${can('deleteBills') ? `<button class="btn sm" data-lib-act="rename" data-id="${esc(m.id)}">Rename</button>
          <button class="btn sm" data-lib-act="copy" data-id="${esc(m.id)}">Duplicate</button>
          <button class="btn sm danger-ghost" data-lib-act="delete" data-id="${esc(m.id)}">Delete</button>` : ''}`}
      </div>
    </article>`;
  }

  async function storageNote() {
    if (typeof Library === 'undefined') return '';
    if (Library.blocked()) return 'This window cannot keep a history — open the file directly to save bills';
    const where = Library.backend() === 'localStorage' ? 'Browser storage (compact mode)' : 'Browser database (IndexedDB)';
    const e = await Library.estimate();
    if (!e || !e.usage) return where + ' · stays on this device';
    const mb = b => (b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1) + ' MB');
    return where + ' · ' + mb(e.usage) + ' used' + (e.quota ? ' of ' + (e.quota / 1073741824).toFixed(1) + ' GB' : '') + ' · stays on this device';
  }


  /* the strip above the list: Select all, how many are ticked, and the
     delete that acts on the ticks rather than on one bill */
  function libSelBarHTML(n, total) {
    const all = total > 0 && n >= total;
    return `<div class="lib-selbar" id="lib-selbar">
      <label class="lib-all"><input type="checkbox" id="lib-check-all"${all ? ' checked' : ''}> Select all</label>
      <span class="lib-selcount">${n ? n + ' selected' : 'Tick a bill to delete it with others'}</span>
      ${n ? `<button class="btn sm danger" data-lib-act="delete-selected">Delete selected${n > 1 ? ' (' + n + ')' : ''}</button>
        <button class="btn sm" data-lib-act="clear-selection">Clear</button>` : ''}
    </div>`;
  }

  /* repaint the strip alone, so ticking a box does not rebuild the list */
  function paintSelBar() {
    const bar = document.getElementById('lib-selbar');
    if (!bar) return;
    const total = document.querySelectorAll('#lib-list .lib-row').length;
    const n = Object.keys(state.libSel || {}).length;
    bar.outerHTML = libSelBarHTML(n, total);
    const box = document.getElementById('lib-check-all');
    if (box) box.indeterminate = n > 0 && n < total;
  }

  function selectAllVisible(on) {
    state.libSel = state.libSel || {};
    Array.prototype.forEach.call(document.querySelectorAll('#lib-list .lib-row'), row => {
      const id = row.dataset.row;
      if (on) state.libSel[id] = true; else delete state.libSel[id];
      row.classList.toggle('chosen', !!on);
      const cb = row.querySelector('[data-lib-check]');
      if (cb) cb.checked = !!on;
    });
    paintSelBar();
  }

  function togglePick(id, on) {
    state.libSel = state.libSel || {};
    if (on) state.libSel[id] = true; else delete state.libSel[id];
    const row = document.querySelector('#lib-list .lib-row[data-row="' + id + '"]');
    if (row) row.classList.toggle('chosen', !!on);
    paintSelBar();
  }

  function openLibrary() {
    if (typeof Library === 'undefined') { toast('Saved bills are not available in this browser'); return; }
    const ex = document.getElementById('library-overlay');
    if (ex) ex.remove();
    const ov = document.createElement('div');
    ov.id = 'library-overlay';
    ov.className = 'overlay-modal';
    ov.innerHTML = `
      <div class="modal lib-modal" role="dialog" aria-modal="true" aria-label="Saved bills">
        <header class="modal-head">
          <div>
            <h2>Saved bills</h2>
            <p class="hint">Every bill you generate is kept on this device. Open one to carry on editing, or export and print it again — nothing is sent anywhere.</p>
          </div>
          <button class="icon-x" data-lib-close aria-label="Close">✕</button>
        </header>
        <div class="lib-bar">
          <input id="lib-search" type="search" placeholder="Search name, building, country…" value="${esc(state.libQuery || '')}">
          <select id="lib-sort" aria-label="Sort">
            <option value="new">Newest first</option>
            <option value="old">Oldest first</option>
            <option value="value">Highest value</option>
            <option value="name">Name A–Z</option>
          </select>
          <span style="flex:1"></span>
          <button class="btn sm primary" id="btn-lib-save">Save this bill</button>
          <button class="btn sm" id="btn-lib-backup" title="Download every saved bill as one JSON file">Back up all</button>
          <button class="btn sm" id="btn-lib-restore" title="Restore bills from a backup file">Restore</button>
          <button class="btn sm danger-ghost" id="btn-lib-clear" data-lib-act="clear-all" title="Delete every saved bill on this device">Delete all</button>
        </div>
        <div class="modal-body" id="lib-list"><p class="hint">Reading the library…</p></div>
        <div class="modal-foot">
          <span class="hint" id="lib-store-note" style="margin-right:auto"></span>
          <button class="btn" data-lib-close>Close</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', ev => { if (ev.target === ov) closeLibrary(); });
    const onEsc = ev => {
      if (ev.key !== 'Escape' || !document.getElementById('library-overlay')) return;
      // Escape drops the ticks before it closes the window
      if (Object.keys(state.libSel || {}).length) {
        ev.preventDefault(); ev.stopPropagation();
        state.libSel = {}; state.libDelSel = false; paintLibrary();
        return;
      }
      closeLibrary(); document.removeEventListener('keydown', onEsc);
    };
    document.addEventListener('keydown', onEsc);
    Array.from(ov.querySelectorAll('[data-lib-close]')).forEach(b => b.addEventListener('click', closeLibrary));
    ov.querySelector('#lib-search').addEventListener('input', e => { state.libQuery = e.target.value; paintLibrary(); });
    ov.addEventListener('change', e => {
      const t = e.target;
      if (!t) return;
      if (t.id === 'lib-check-all') { selectAllVisible(t.checked); return; }
      const id = t.dataset && t.dataset.libCheck;
      if (id) togglePick(id, t.checked);
    });
    const sort = ov.querySelector('#lib-sort');
    sort.value = state.libSort || 'new';
    sort.addEventListener('change', e => { state.libSort = e.target.value; paintLibrary(); });
    ov.querySelector('#btn-lib-save').addEventListener('click', saveToLibrary);
    ov.querySelector('#btn-lib-backup').addEventListener('click', backupLibrary);
    ov.querySelector('#btn-lib-restore').addEventListener('click', () => {
      if (!guard('edit')) return;
      const i = document.getElementById('lib-input'); if (i) i.click();
    });
    paintLibrary();
    setTimeout(() => { const s = document.getElementById('lib-search'); if (s) s.focus(); }, 40);
  }

  function closeLibrary() {
    const ov = document.getElementById('library-overlay');
    if (ov) ov.remove();
    state.libRenameId = null; state.libDeleteId = null;
    state.libSel = {}; state.libDelSel = false;
  }

  async function paintLibrary() {
    const host = document.getElementById('lib-list');
    if (!host || typeof Library === 'undefined') return;
    let rows = [];
    try { rows = libRows(visibleBills(await Library.list())); } catch (e) { rows = []; }
    // only what is on screen can be deleted from the screen
    if (state.libSel) {
      const visible = {};
      rows.forEach(r => { if (state.libSel[r.id]) visible[r.id] = true; });
      state.libSel = visible;
    }
    const clearBar = rows.length && state.libClearAll
      ? `<div class="lib-clear-bar">
           <span><b>Delete all ${rows.length} saved bill${rows.length === 1 ? '' : 's'}?</b>
           Every plan, quantity and rate stored on this device goes with them. Back up first if you may need them.</span>
           <button class="btn sm danger" data-lib-act="clear-yes">Delete all</button>
           <button class="btn sm" data-lib-act="clear-no">Cancel</button>
         </div>` : '';
    const sel = Object.keys(state.libSel || {});
    const selBar = rows.length ? libSelBarHTML(sel.length, rows.length) : '';
    const selConfirm = sel.length && state.libDelSel
      ? `<div class="lib-clear-bar">
           <span><b>Delete ${sel.length} saved bill${sel.length === 1 ? '' : 's'}?</b>
           ${sel.length === 1 ? 'Its plan, quantities and rates' : 'Their plans, quantities and rates'} go with ${sel.length === 1 ? 'it' : 'them'}. This cannot be undone.</span>
           <button class="btn sm danger" data-lib-act="delete-selected-yes">Delete ${sel.length}</button>
           <button class="btn sm" data-lib-act="delete-selected-no">Keep ${sel.length === 1 ? 'it' : 'them'}</button>
         </div>` : '';
    host.innerHTML = rows.length
      ? clearBar + selConfirm + selBar + `<p class="hint" style="margin:0 0 10px">${rows.length} saved bill${rows.length === 1 ? '' : 's'} · newest first unless you sort</p>` + rows.map(libraryRow).join('')
      : `<div class="lib-empty"><b>No saved bills yet</b><p class="hint">Generate a bill and it is kept here by itself. From this window you can re-open it, export it to Excel, Word or PDF, or print it — in this session or months from now, still offline.</p></div>`;
    const note = document.getElementById('lib-store-note');
    if (note) note.textContent = await storageNote();

    const input = document.getElementById('lib-rename-input');
    if (input) {
      const commit = async () => {
        const name = input.value.trim();
        const id = state.libRenameId;
        if (!id) return;
        state.libRenameId = null;
        if (name) {
          try {
            const rec = await Library.get(id);
            if (rec.meta) {
              rec.meta.name = name;
              rec.meta.updatedAt = new Date().toISOString();
              if (rec.snapshot && rec.snapshot.params) rec.snapshot.params.projectName = name;
              await Library.put(rec);
              if (state.libraryId === id) { state.params.projectName = name; save(); }
            }
          } catch (e) { /* ignore */ }
        }
        paintLibrary(); paintRecent(); render();
      };
      input.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
        else if (ev.key === 'Escape') { state.libRenameId = null; paintLibrary(); }
      });
      input.addEventListener('blur', commit);
      setTimeout(() => { try { input.focus(); input.select(); } catch (e) {} }, 20);
    }
  }

  async function paintRecent() {
    const host = document.getElementById('lib-recent');
    if (!host || typeof Library === 'undefined') return;
    let rows = [];
    try { rows = visibleBills(await Library.list()).slice(0, 4); } catch (e) { rows = []; }
    if (!rows.length) {
      host.innerHTML = `<p class="hint">Nothing saved yet — every bill you generate is kept here automatically, so you can export or print it again in a later session.</p>`;
      return;
    }
    host.innerHTML = rows.map(m => `<div class="lib-mini">
        <div><b>${esc(m.name)}</b><span>${esc(m.building || '')} · ${esc(whenText(m.updatedAt))}</span></div>
        <b class="lib-mini-amt">${esc(m.symbol || 'GH¢')} ${fmt(m.grand)}</b>
        <button class="btn sm" data-lib-act="open" data-id="${esc(m.id)}">Open</button>
        <button class="lib-mini-x" data-lib-act="ask-delete" data-id="${esc(m.id)}" title="Delete this saved bill" aria-label="Delete this saved bill">✕</button>
      </div>`).join('') +
      `<button class="btn sm" id="btn-projects3" style="margin-top:4px">All saved bills →</button>`;
  }

  async function libraryClick(e) {
    const btn = e.target.closest('[data-lib-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.libAct;
    if (act === 'open') return loadRecord(id, false);
    if (act === 'print') return loadRecord(id, true);
    if (act === 'xlsx' || act === 'docx' || act === 'pdf') return exportRecord(id, act);
    if (act === 'rename' || act === 'copy') { if (!guard('edit')) return; }
    if (/^(ask-delete|delete|delete-yes|clear-all|clear-yes|delete-selected|delete-selected-yes|restore)$/.test(act)
        && !guard('deleteBills')) return;
    if (act === 'rename') {
      state.libRenameId = id;
      paintLibrary();
      return;
    }
    if (act === 'copy') return duplicateRecord(id);
    if (act === 'ask-delete') {
      state.libDeleteId = id; state.libClearAll = false;
      openLibrary();
      return;
    }
    if (act === 'delete') {          // ask
      state.libDeleteId = id; state.libClearAll = false;
      paintLibrary();
      return;
    }
    if (act === 'delete-no') { state.libDeleteId = null; paintLibrary(); return; }
    if (act === 'delete-yes') {
      state.libDeleteId = null;
      try { await Library.remove(id); } catch (err) { toast('Could not delete that bill'); return; }
      if (state.libraryId === id) {
        // the bill stays on screen, but it is no longer a saved record
        state.libDeletedId = id;
        state.libraryCreatedAt = null;
        lastLibSig = '';
        save();
      }
      paintLibrary(); paintRecent(); updateProjectsBadge();
      toast('Saved bill deleted');
      return;
    }
    if (act === 'clear-selection') { state.libSel = {}; state.libDelSel = false; paintLibrary(); return; }
    if (act === 'delete-selected') { state.libDelSel = true; state.libClearAll = false; paintLibrary(); return; }
    if (act === 'delete-selected-no') { state.libDelSel = false; paintLibrary(); return; }
    if (act === 'delete-selected-yes') {
      const ids = Object.keys(state.libSel || {});
      state.libDelSel = false;
      state.libSel = {};
      let gone = 0, failed = 0;
      for (const one of ids) {
        try { await Library.remove(one); gone++; } catch (err) { failed++; }
      }
      if (state.libraryId && ids.indexOf(state.libraryId) >= 0) {
        // the bill on screen stays open, but it is no longer a saved record
        state.libDeletedId = state.libraryId;
        state.libraryCreatedAt = null;
        lastLibSig = '';
        save();
      }
      paintLibrary(); paintRecent(); updateProjectsBadge();
      toast(gone + ' saved bill' + (gone === 1 ? '' : 's') + ' deleted' + (failed ? ' — ' + failed + ' could not be removed' : ''));
      return;
    }
    if (act === 'clear-all') { state.libClearAll = true; state.libDeleteId = null; state.libDelSel = false; paintLibrary(); return; }
    if (act === 'clear-no') { state.libClearAll = false; paintLibrary(); return; }
    if (act === 'clear-yes') {
      try { await Library.clear(); } catch (err) { toast('Could not delete the saved bills'); return; }
      if (state.libraryId) { state.libDeletedId = state.libraryId; state.libraryCreatedAt = null; }
      state.libClearAll = false; state.libDeleteId = null; state.libSel = {}; lastLibSig = '';
      save();
      paintLibrary(); paintRecent(); updateProjectsBadge();
      toast('All saved bills deleted');
    }
  }

  async function loadRecord(id, thenPrint) {
    try {
      const rec = await Library.get(id);
      if (!rec.meta || !rec.snapshot) { toast('That saved bill could not be opened'); return; }
      applySnapshot(rec.snapshot);
      state.libraryId = rec.meta.id;
      state.libDeletedId = null;
      state.libraryCreatedAt = rec.meta.createdAt || null;
      lastLibSig = rec.meta.id + '|' + rec.meta.grand + '|' + JSON.stringify(state.params);
      if (state.image && state.image.dataUrl) {
        try {
          const img = await PlanAnalyser.loadDataUrl(state.image.dataUrl);
          state.analysis = PlanAnalyser.analyse(img);
        } catch (e) { /* the bill does not need the picture */ }
      }
      closeLibrary();
      state.result = recompute();
      setStep(thenPrint ? 5 : 3);
      updateProjectsBadge();
      if (thenPrint) {
        toast('Saved bill opened — sending it to print');
        setTimeout(() => printBill(), 400);
      } else {
        toast('Saved bill opened — ' + SYM(state.params) + ' ' + fmt(state.result.grand));
      }
    } catch (e) { toast('That saved bill could not be opened'); }
  }

  async function withRecord(id, fn) {
    const rec = await Library.get(id);
    if (!rec.meta || !rec.snapshot) { toast('That saved bill could not be opened'); return false; }
    const keep = snapshotOf();
    const keepStep = state.step;
    state.libBusy = true;
    try {
      applySnapshot(rec.snapshot);
      fn(rec);
      return true;
    } finally {
      applySnapshot(keep);
      state.step = keepStep;
      state.libBusy = false;
      render();
    }
  }

  function exportRecord(id, kind) {
    return withRecord(id, () => {
      const r = recompute();
      const p = state.params;
      const base = 'BOQ_' + slug(p.projectName);
      if (kind === 'xlsx') download(XlsxWriter.build(r), base + '.xlsx');
      else if (kind === 'docx') download(DocxWriter.build(r), base + '.docx');
      else download(PdfWriter.build(r), base + '.pdf');
      toast('Exported ' + base + '.' + kind + ' from the saved bill');
    }).catch(() => toast('Could not export that saved bill'));
  }

  async function duplicateRecord(id) {
    try {
      const rec = await Library.get(id);
      if (!rec.meta || !rec.snapshot) return;
      const name = rec.meta.name + ' (copy)';
      const meta = Object.assign({}, rec.meta, {
        id: Library.uid(), name: name,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      if (rec.snapshot.params) rec.snapshot.params.projectName = name;
      const res = await Library.put({ meta: meta, snapshot: rec.snapshot });
      if (!res.ok) { toast('Browser storage is full'); return; }
      paintLibrary(); paintRecent(); updateProjectsBadge();
      toast('Duplicated — “' + name + '”');
    } catch (e) { toast('Could not duplicate that bill'); }
  }

  async function backupLibrary() {
    try {
      const data = await Library.exportAll();
      if (!data.records.length) { toast('Nothing to back up yet'); return; }
      download(new Blob([JSON.stringify(data)], { type: 'application/json' }),
        'Quick_Quantity_saved_bills_' + new Date().toISOString().slice(0, 10) + '.json');
      toast(data.records.length + ' saved bill' + (data.records.length === 1 ? '' : 's') + ' backed up');
    } catch (e) { toast('Could not build the backup'); }
  }

  async function restoreLibrary(file) {
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      if (!obj || (obj.app !== 'Quick Quantity' && obj.app !== 'Estimate Quick' && obj.app !== 'Quick Estimate' && obj.app !== 'Plan2BOQ') || !Array.isArray(obj.records)) throw new Error('not a library backup');
      const res = await Library.importAll(obj);
      paintLibrary(); paintRecent(); updateProjectsBadge();
      toast(res.added + ' added, ' + res.replaced + ' replaced — ' + (res.added + res.replaced) + ' in this backup');
    } catch (e) { toast('That is not a Quick Quantity saved-bills backup'); }
  }

  // the school template is the default: a missing flag must never silently
  // route an educational project through the school engine
  const tplOf = p => (p && p.template) || 'school';
  const isSchool = () => tplOf(state.params) === 'school';

  const recompute = () => {
    stampPrepared();
    const build = () => isSchool()
      ? BOQ.buildBill(state.params)
      : GenEngine.buildBill(state.params);
    let r = build();
    // an adopted build-up changes a rate, so the bill is measured again
    if (typeof RateBuild !== 'undefined' && RateBuild.adoptedCount(state.params)) {
      RateBuild.apply(state.params, r);
      r = build();
    }
    // how the drawing was scaled — the number every measured dimension hangs on
    if (state.analysis && (state.image || state.sheets)) {
      const b = scaleBasis(state.analysis);
      const what = b.known
        ? b.basis + (state.sizeAdopted ? ' — the building is sized from the plan'
                                       : ' — the size is set by you or by the standard layout')
        : b.basis + ' — the bill is priced on the standard layout';
      r.basis = (r.basis || []).concat([['Scale of the drawing', what]]);
    }
    // the roof plan, when one was read and applied
    if (state.params.roofPlan && state.params.roofPlan.planArea) {
      const rp = state.params.roofPlan;
      const bits = [];
      if (rp.W && rp.D) bits.push(fmt(rp.W) + ' x ' + fmt(rp.D) + ' m outline');
      if (rp.pitch != null) bits.push(fmt(rp.pitch, 1) + ' deg pitch');
      if (rp.cover) bits.push(rp.cover);
      bits.push(fmt(rp.planArea) + ' m2 on plan, ' + fmt(rp.slope) + ' m2 at pitch');
      r.basis = [['Roof plan', bits.join(' · ') + ' — read from ' + rp.file]].concat(r.basis || []);
    }
    // what the drawing said it was, printed with the basis of the bill
    if (state.buildingRead && state.buildingRead.label) {
      const ev = (state.buildingRead.evidence || []).join(', ');
      r.basis = [['Identified from the drawing', state.buildingRead.label + (ev ? ' — ' + ev : '')]]
        .concat(r.basis || []);
    }
    state.result = applyTakeoff(r);
    syncComponents(state.result);
    return state.result;
  };

  /* -------------------------------------------------- component quantities
     The schedule on the building model offers a figure on every row, the way
     the door and window schedule does. An opening is a model input: the count
     itself changes, and the joinery, the lintels and the wall area follow. A
     measured element has no single model number behind it any more, so its
     new figure is kept as a take-off correction — the same store the take-off
     sheet writes — and shows there, marked, ready to be put back. */
  function syncComponents(r) {
    const list = (r && r.model && r.model.components) || [];
    if (!list.length) return;
    const rows = {};
    r.bills.forEach(b => (b.items || []).forEach(it => {
      const k = b.code + '|' + (it.key || '');
      if (!rows[k]) rows[k] = { bill: b, it: it };
    }));
    const share = {};
    list.forEach(c => { if (c.bill) { const k = c.bill + '|' + c.key; share[k] = (share[k] || 0) + 1; } });
    list.forEach(c => {
      const k = c.bill + '|' + c.key;
      c.shared = share[k] > 1;
      c.measured = c.measured != null ? c.measured : c.qty;
      const hit = rows[k];
      if (!hit) { c.corrected = false; return; }
      const it = hit.it;
      c.desc = it.desc;
      c.billQty = it.qty;
      c.billUnit = it.unit;
      c.rate = it.rate;
      c.rateEdited = !!it.rateEdited;
      c.baseRate = it.measuredRate != null ? it.measuredRate : it.rate;
      c.amount = it.amount;
      /* a row three lines share keeps each line's own figure: the bill row is
         the total of them, and no single one of them owns it */
      if (c.shared) { c.corrected = false; return; }
      if (it.measured != null) c.measured = it.measured;
      if (String(c.unit).toLowerCase() === String(it.unit).toLowerCase()) {
        c.qty = it.qty;
        c.unit = it.unit;
        c.corrected = !!it.corrected;
      }
    });
  }

  /* the opening behind a door or window component, so its count can be typed
     on the schedule and the model keeps it */
  function componentOpening(c) {
    const p = state.params;
    const m = /^(door|window):(.+)$/.exec(String(c.key || ''));
    if (!m) return null;
    const list = m[1] === 'door' ? (p.doors || []) : (p.windows || []);
    const i = list.findIndex(x => x.ref === m[2]);
    return i < 0 ? null : { list: list, i: i, item: list[i] };
  }

  /* ---------------------------------------------------------------- shell */
  const STEPS = [
    { n: 1, title: 'Upload plan', sub: 'Picture of the drawing' },
    { n: 2, title: 'Read & scale', sub: 'Detect walls, set scale' },
    { n: 3, title: 'Digital Take-off', sub: 'Measure on the plan' },
    { n: 4, title: 'Building model', sub: 'Rooms, openings, spec' },
    { n: 5, title: 'Take-off', sub: 'Measure, check, correct' },
    { n: 6, title: 'Bill of Quantities', sub: 'Priced, editable' },
    { n: 7, title: 'Material Schedule', sub: 'Quantities, cost, export' },
    { n: 8, title: 'Labour Schedule', sub: 'Trades, days, crew' },
    { n: 9, title: 'Cost Breakdown', sub: 'Where the money goes' },
    { n: 10, title: 'Export', sub: 'Excel, Word, PDF, print' }
  ];

  function renderSteps() {
    const maxStep = state.result || state.step;
    $('#steps').innerHTML = STEPS.map(s => {
      const done = state.step > s.n;
      const cls = state.step === s.n ? 'active' : (done ? 'done' : '');
      return `<button class="step-item ${cls}" data-step="${s.n}"
        data-tip-title="${esc(s.title)}" data-tip-sub="${esc(s.sub)}"
        aria-label="${esc(s.title)} \u2014 ${esc(s.sub)}">
        <span class="num">${done && state.step !== s.n ? '✓' : s.n}</span>
        <span><b>${s.title}</b><span>${s.sub}</span></span>
      </button>`;
    }).join('');
  }

  /* ------------------------------------------------------------ step tooltips
     Every step answers a hover — and a keyboard focus — with its own name, in
     the tooltip Bootstrap draws: near-black, white text at .875rem, a .375rem
     corner, a small arrow, fading in at .15s linear and sitting at .9 opacity.
     It is drawn here rather than loaded, so the app keeps working offline. */
  let stepTipEl = null, stepTipTimer = null, stepTipOn = null;

  function stepTipNode() {
    if (stepTipEl && document.body.contains(stepTipEl)) return stepTipEl;
    stepTipEl = document.createElement('div');
    stepTipEl.id = 'step-tip';
    stepTipEl.className = 'tip-pop';
    stepTipEl.setAttribute('role', 'tooltip');
    stepTipEl.innerHTML = '<span class="tip-inner"></span><span class="tip-arrow"></span>';
    document.body.appendChild(stepTipEl);
    return stepTipEl;
  }

  function stepTipHide() {
    if (!stepTipEl) return;
    stepTipEl.classList.remove('in');
    if (stepTipOn) { stepTipOn.removeAttribute('aria-describedby'); stepTipOn = null; }
    clearTimeout(stepTipTimer);
    stepTipTimer = setTimeout(() => {
      if (stepTipEl && !stepTipEl.classList.contains('in')) stepTipEl.classList.remove('show');
    }, 160);
  }

  function stepTipShow(btn) {
    if (!btn || !btn.getAttribute) return;
    const title = btn.getAttribute('data-tip-title');
    if (!title) return;
    const sub = btn.getAttribute('data-tip-sub') || '';
    const el = stepTipNode();
    el.querySelector('.tip-inner').innerHTML = '<b>' + esc(title) + '</b>' +
      (sub ? '<span>' + esc(sub) + '</span>' : '');
    stepTipOn = btn;
    btn.setAttribute('aria-describedby', 'step-tip');
    /* laid out first, then placed: the sidebar answers to the right of the
       step, the bar over the page answers underneath it */
    el.className = 'tip-pop show';
    el.style.left = '-9999px'; el.style.top = '0px';
    const r = btn.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    let place, left, top;
    if (vw > 900 && vw - r.right > w + 16) {
      place = 'right';
      left = r.right + 12;
      top = r.top + r.height / 2 - h / 2;
    } else if (r.bottom + h + 12 <= vh) {
      place = 'bottom';
      left = r.left + r.width / 2 - w / 2;
      top = r.bottom + 10;
    } else {
      place = 'top';
      left = r.left + r.width / 2 - w / 2;
      top = r.top - h - 10;
    }
    left = Math.max(8, Math.min(vw - w - 8, left));
    top = Math.max(8, Math.min(vh - h - 8, top));
    el.className = 'tip-pop show tip-' + place;
    el.style.left = Math.round(left) + 'px';
    el.style.top = Math.round(top) + 'px';
    /* the arrow points at the middle of the button, not the middle of the tip */
    const arrow = el.querySelector('.tip-arrow');
    if (place === 'top' || place === 'bottom') {
      const at = Math.max(10, Math.min(w - 10, r.left + r.width / 2 - left));
      arrow.style.left = Math.round(at) + 'px';
      arrow.style.marginLeft = '-.4rem';
    } else {
      arrow.style.top = Math.round(Math.max(10, Math.min(h - 10, r.top + r.height / 2 - top))) + 'px';
      arrow.style.marginTop = '-.4rem';
    }
    void el.offsetWidth;                       // the fade has a start to run from
    el.classList.add('in');
  }

  /* a hover, a focus, and away again — one listener for the whole shell */
  function stepTipWatch() {
    document.addEventListener('mouseover', e => {
      const btn = e.target.closest ? e.target.closest('.step-item') : null;
      if (btn && btn !== stepTipOn) stepTipShow(btn);
    });
    document.addEventListener('mouseout', e => {
      const btn = e.target.closest ? e.target.closest('.step-item') : null;
      if (!btn) return;
      const to = e.relatedTarget;
      if (to && btn.contains(to)) return;
      stepTipHide();
    });
    document.addEventListener('focusin', e => {
      const btn = e.target.closest ? e.target.closest('.step-item') : null;
      if (btn && btn !== stepTipOn) stepTipShow(btn);
    });
    document.addEventListener('focusout', e => {
      if (e.target.closest && e.target.closest('.step-item')) stepTipHide();
    });
    document.addEventListener('click', e => {
      const btn = e.target.closest ? e.target.closest('.step-item') : null;
      if (!btn) return;
      /* the step redraws itself under the pointer: the tip goes with it */
      stepTipHide();
      stepTipEl && stepTipEl.classList.remove('show');
    }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') stepTipHide(); });
    /* the page moving under it takes it away, rather than leave it behind */
    window.addEventListener('scroll', stepTipHide, true);
    window.addEventListener('resize', stepTipHide);
  }

  function summaryOpen() {
    /* closed until the header button asks for it — never opened on its own */
    return state.sideOpen === true;
  }

  function paintSide() {
    ['side', 'side-backdrop', 'side-pill'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    /* the header rides above the dimming only while the summary is open */
    document.body.classList.toggle('sum-open', summaryOpen());
    /* the summary lives in the header: the button there opens and closes it,
       so closing the card leaves no floating button behind */
    const head = document.getElementById('btn-summary');
    const has = !(state.step < 3 || !state.result);
    if (head) {
      head.hidden = !has;
      head.classList.toggle('on', has && summaryOpen());
      head.setAttribute('aria-pressed', has && summaryOpen() ? 'true' : 'false');
    }
    if (!has) return;
    if (!summaryOpen()) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'side-backdrop';
    backdrop.className = 'side-backdrop no-print';
    backdrop.addEventListener('click', () => {
      state.sideOpen = false;
      save();
      paintSide();
    });
    document.body.appendChild(backdrop);
    const card = document.createElement('aside');
    card.className = 'side-card no-print';
    card.id = 'side';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Building summary');
    document.body.appendChild(card);
    renderSide();
    if (window.SearchSelect) window.SearchSelect.enhance(card);
  }

  function renderSide() {
    const host = $('#side');
    if (!host) return;
    const r = state.result;
    if (!r) { host.innerHTML = ''; return; }
    const g = r.model.g;
    host.innerHTML = `
      <div class="side-head">
        <h4>Building summary</h4>
        <button type="button" class="side-x no-print" id="side-close" aria-label="Close the building summary" title="Close">✕</button>
      </div>
      <div class="kv"><span>Gross floor area</span><b>${fmt(r.GFA)} m²</b></div>
      <div class="kv"><span>Net internal area</span><b>${fmt(r.netArea || g.GFA)} m²</b></div>
      <div class="kv"><span>Footprint</span><b>${fmt(g.footprint)} m²</b></div>
      <div class="kv"><span>Overall size</span><b>${fmt(g.mainW)} × ${fmt(g.totalD)} m</b></div>
      <div class="kv"><span>Roof area</span><b>${fmt(g.roofArea)} m²</b></div>
      <div class="kv"><span>Blockwork</span><b>${fmt(r.model.blockTotal)} m²</b></div>
      <div class="kv"><span>Blocks</span><b>${Math.round(r.model.blocks).toLocaleString()}</b></div>
      <div class="kv"><span>Concrete</span><b>${fmt(r.model.concTotal, 2)} m³</b></div>
      <h4 style="margin-top:14px">Cost</h4>
      <div class="kv"><span>Sub-total</span><b>${SYM(r.params)} ${fmt(r.subtotal)}</b></div>
      <div class="kv"><span>Contingency</span><b>${SYM(r.params)} ${fmt(r.contingency)}</b></div>
      <div class="kv"><span><b>Grand total</b></span><b>${SYM(r.params)} ${fmt(r.grand)}</b></div>
      <div class="kv"><span>Rate / m²</span><b>${SYM(r.params)} ${fmt(r.perM2)}</b></div>`;
  }

  function setStep(n) {
    state.step = n;
    /* the search over the set belongs to the upload step: leaving it puts the
       eleven cards back, so the step always opens whole */
    if (n !== 1) state.grpSearch = '';
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------------------------------------------------------- step 1 */
  /* ---------------------------------------------------------------- roof plan */
  /* A roof plan carries what a floor plan cannot: the pitch, the covering
     named in its title block, and the roof outline — so the eaves overhang and
     the sloping area come off the drawing instead of an assumption. A PDF
     gives its text (and the scale printed on the sheet); a picture gives the
     outline once its width is known. */
  const ROOF_COVERS = [
    ['long-span aluminium', /long.?span|aluminium|aluminum|alu.?zinc|\bibr\b/],
    ['stone-coated tiles', /stone.?coat|roof(?:ing)? tiles?|tiles?/],
    ['concrete or asbestos sheet', /asbestos|fibre.?cement sheet|concrete sheet/],
    ['polycarbonate', /polycarbonate|perspex/],
    ['shingles', /shingles?/]
  ];

  function roofFromText(text) {
    const s = String(text || '').toLowerCase();
    const out = { hasText: s.trim().length > 0 };
    const pm = s.match(/(\d{1,2}(?:[.,]\d)?)\s*(?:°|deg(?:rees)?\b)/)
      || s.match(/(?:roof\s*)?pitch\s*(?:angle)?\s*[:=]?\s*(\d{1,2}(?:[.,]\d)?)/)
      || s.match(/\bslope\s*(?:angle)?\s*[:=]?\s*(\d{1,2}(?:[.,]\d)?)/);
    if (pm) {
      const v = Number(pm[1].replace(',', '.'));
      if (v >= 0 && v <= 60) out.pitch = v;
    }
    const am = s.match(/(?:roof\s*area|area\s*of\s*(?:the\s*)?roof)\s*[:=]?\s*([\d,]+(?:\.\d+)?)\s*(?:m2|m²|sqm|sq\.? ?m|square\s*met)/);
    if (am) out.stated = Number(am[1].replace(/,/g, ''));
    const sm = s.match(/\b1\s*[:\u2236]\s*(20|25|50|75|100|125|150|200|250|500)\b/);
    if (sm) out.den = Number(sm[1]);
    const om = s.match(/(?:eaves?\s*)?over\s*hang\s*[:=]?\s*(\d(?:[.,]\d{1,2})?)\s*m?\b/)
      || s.match(/eaves?\s*[:=]?\s*(\d(?:[.,]\d{1,2})?)\s*m\b/);
    if (om) {
      const v = Number(om[1].replace(',', '.'));
      if (v > 0.15 && v < 2) out.over = v;
    }
    if (/flat\s*roof|parapet|roof\s*slab/.test(s)) out.kind = 'flat';
    else if (/mono.?pitch|lean.?to|single\s*(?:slope|pitch)|\bshed\s*roof\b/.test(s)) out.kind = 'mono';
    else if (/hip\s*roof|hipped|\bhipped\b/.test(s)) out.kind = 'hip';
    else if (/gable|pitched|truss|rafter\b/.test(s)) out.kind = 'gable';
    const c = ROOF_COVERS.find(x => x[1].test(s));
    if (c) out.cover = c[0];
    out.named = /roof\s*(?:plan|layout|framing|structure)/.test(s);
    return out;
  }

  /* The roof outline, in millimetres per pixel. The roof plan is its own
     sheet at its own scale: take the scale printed on it, else the width the
     user types for it — never the floor plan's scale. */
  function roofMMPerPx(a) {
    if (!a) return { mm: null, basis: '' };
    const longPx = Math.max(a.width || 1, a.height || 1);
    const den = (state.roof && state.roof.den) || roofFromText(state.roof && state.roof.text).den;
    if (den && state.roof && state.roof.paperMM) {
      return { mm: state.roof.paperMM * den / longPx,
               basis: 'the 1:' + den + ' printed on the roof sheet' };
    }
    const wmm = state.roof && +state.roof.widthMM;
    if (wmm > 0) return { mm: wmm / (a.bbox.w || 1), basis: 'the roof width you typed' };
    return { mm: null, basis: '' };
  }

  /* the roof outline: between the outermost strong lines inside the sheet,
     so a border or title block does not become the roof */
  function roofOutline(a) {
    if (!a) return null;
    const xs = (a.insideV || []).map(l => l.pos), ys = (a.insideH || []).map(l => l.pos);
    const x0 = xs.length >= 2 ? Math.min(...xs) : a.bbox.x0;
    const x1 = xs.length >= 2 ? Math.max(...xs) : a.bbox.x1;
    const y0 = ys.length >= 2 ? Math.min(...ys) : a.bbox.y0;
    const y1 = ys.length >= 2 ? Math.max(...ys) : a.bbox.y1;
    const w = x1 - x0, h = y1 - y0;
    if (!(w > 40 && h > 40)) return null;
    return { w: w, h: h, x0: x0, y0: y0, lines: xs.length + ys.length };
  }

  /* what the drawing says, against what the model has already measured */
  function roofInfo(analysis, text) {
    const p = state.params;
    const r = state.result || null;
    const g = (r && r.model && r.model.g) || {};
    const a = analysis || null;
    const t = roofFromText(text);
    const sc = a ? roofMMPerPx(a) : { mm: null };
    const o = a ? roofOutline(a) : null;
    let W = null, D = null, planArea = null;
    if (sc.mm && o) {
      W = o.w * sc.mm / 1000;
      D = o.h * sc.mm / 1000;
      planArea = W * D;
    }
    const pitch = (t.pitch != null) ? t.pitch : (+p.roofPitch || 0);
    const kind = t.kind || (p.roofType || 'pitched');
    const slope = planArea == null ? null : RoofGeom.measure({ type: kind, pitch: pitch, W: 0, D: 0 }).flat
      ? planArea : planArea / Math.cos(pitch * Math.PI / 180);
    const mainW = +g.mainW || +p.overallW || +p.bW || 0;
    let over = t.over != null ? t.over : null;
    let overFrom = t.over != null ? 'drawing' : '';
    let widthDiff = null;
    if (W && mainW) {
      const v = Math.round(((W - mainW) / 2) * 100) / 100;
      widthDiff = v;
      if (over == null && v >= 0.2 && v <= 1.2) { over = v; overFrom = 'difference'; }
    }
    return {
      named: !!t.named, hasText: !!t.hasText, den: t.den || null,
      scaleBasis: sc.basis || '', hasScale: !!sc.mm,
      W: W, D: D, planArea: planArea, slope: slope, outline: o,
      pitch: pitch, pitchFrom: t.pitch != null ? 'drawing' : 'model',
      kind: kind, cover: t.cover || null, stated: t.stated || null,
      over: over, overFrom: overFrom, widthDiff: widthDiff, mainW: mainW || null,
      modelPlan: g.roofPlan || null, modelArea: g.roofArea || null,
      measured: planArea != null, applied: !!(p.roofPlan && p.roofPlan.file === (state.roof && state.roof.name))
    };
  }

  /* a roof plan is a big picture: keep the stored copy light enough for the
     browser to keep the whole project in one saved file */
  function roofStore(img, dataUrl) {
    const maxDim = 1700;
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h) return dataUrl;
    if (Math.max(w, h) <= maxDim && dataUrl.length < 700000) return dataUrl;
    const k = Math.min(1, maxDim / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    try { return c.toDataURL('image/jpeg', 0.82); } catch (e) { return dataUrl; }
  }

  /* read a roof plan: a PDF gives its text as well as its picture */
  async function readRoofFile(file) {
    if (!file) return;
    if (!guard('edit')) return;
    try {
      toast('Reading the roof plan…');
      const isPdf = typeof PdfImport !== 'undefined' && PdfImport.isPdf(file);
      let page = 1, pages = 0, text = '', paperMM = null;
      if (isPdf) {
        try {
          const info = await PdfImport.sheets(file);
          pages = (info.pages || []).length;
          const hit = (info.pages || []).find(s => /roof/i.test(String(s.title || '')))
            || (info.pages || []).find(s => /roof/i.test(String(s.text || '')));
          const pick = hit || (info.pages || [])[0];
          if (pick) {
            page = pick.page || 1; text = pick.text || '';
            if (pick.longestPt) paperMM = pick.longestPt * 0.352778;
          }
        } catch (e) { /* a scanned PDF has no text layer: the picture still measures */ }
      }
      const out = await imageFromFile(file, page);
      const stored = roofStore(out.img, out.dataUrl);
      let img = out.img;
      if (stored !== out.dataUrl) {
        try { img = await PlanAnalyser.loadDataUrl(stored); } catch (e) { img = out.img; }
      }
      const t = roofFromText(text);
      state.roof = {
        name: out.name || file.name, dataUrl: stored, size: (stored.length * 3 / 4) | 0,
        page: page, pages: pages, text: String(text || '').slice(0, 4000),
        paperMM: paperMM, den: t.den || null,
        widthMM: (state.roof && state.roof.widthMM) || null
      };
      state.roofAnalysis = PlanAnalyser.analyse(img, 1400);
      state.roofRead = roofInfo(state.roofAnalysis, state.roof.text);
      render(); save();
      const rr = state.roofRead;
      toast(rr.measured
        ? 'Roof plan read — ' + fmt(rr.W) + ' × ' + fmt(rr.D) + ' m roof, ' +
          (rr.pitchFrom === 'drawing' ? fmt(rr.pitch, 1) + '° pitch' : fmt(rr.pitch, 1) + '° from the model')
        : (rr.hasText ? 'Roof plan read — ' + (rr.den ? 'at 1:' + rr.den + '; no roof outline found' : 'no roof outline found')
           : 'Roof plan added — type its width to measure the outline'));
    } catch (err) {
      console.error('roof plan read failed', err);
      toast('Could not read that roof plan');
    }
  }

  /* re-read the stored picture (after the scale changes, say) */
  function rereadRoof() {
    if (!state.roof) return;
    if (!state.roof.dataUrl) { toast('The roof plan is not saved in this project'); return; }
    PlanAnalyser.loadDataUrl(state.roof.dataUrl).then(img => {
      state.roofAnalysis = PlanAnalyser.analyse(img, 1400);
      state.roofRead = roofInfo(state.roofAnalysis, state.roof.text || '');
      render(); save();
      const rr = state.roofRead;
      toast(rr.measured ? 'Roof outline read again — ' + fmt(rr.W) + ' × ' + fmt(rr.D) + ' m'
        : 'Read again — still no roof outline on the sheet');
    }).catch(() => toast('Could not read that roof plan'));
  }

  /* put what the drawing says into the model: pitch, roof type, eaves overhang */
  function applyRoofPlan() {
    const done = roofApplyFacts();
    if (!done) { toast('Add a roof plan first'); return; }
    render(); save();
    const g = state.result.model.g;
    toast(done.length
      ? 'Roof plan applied — ' + done.join(', ') + ' · roof now ' + fmt(g.roofArea) + ' m²'
      : 'The model already agrees with the roof plan — roof ' + fmt(g.roofArea) + ' m²');
  }

  /* the figures the roof plan puts into the model, with nothing drawn: the
     generator runs this and reports what moved */
  function roofApplyFacts() {
    const p = state.params, rd = state.roofRead;
    if (!rd || !state.roof) return null;
    const done = [];
    if (rd.pitchFrom === 'drawing' && Math.abs((+p.roofPitch || 0) - rd.pitch) > 0.01) {
      p.roofPitch = rd.pitch; done.push('pitch ' + fmt(rd.pitch, 1) + '°');
    }
    if (rd.kind && RoofGeom.norm(rd.kind) !== RoofGeom.norm(p.roofType)) {
      const k = RoofGeom.norm(rd.kind);
      p.roofType = k;
      const pBy = p.roofPitchByType || {}, oBy = p.overhangByType || {};
      if (rd.pitchFrom !== 'drawing') p.roofPitch = pBy[k] != null ? pBy[k] : RoofGeom.DEFAULT_PITCH[k];
      p.overhang = oBy[k] != null ? oBy[k] : RoofGeom.DEFAULT_OVERHANG[k];
      if (p.parapet == null) p.parapet = RoofGeom.DEFAULT_PARAPET[k];
      done.push(RoofGeom.short(k).toLowerCase() + ' roof');
    }
    if (rd.over != null && Math.abs((+p.overhang || 0) - rd.over) > 0.005) {
      p.overhang = rd.over; done.push('eaves ' + fmt(rd.over, 2) + ' m');
    }
    p.roofPlan = {
      file: state.roof.name,
      W: rd.W, D: rd.D, planArea: rd.planArea, slope: rd.slope,
      pitch: p.roofType === 'flat' ? 0 : (+p.roofPitch || 0), cover: rd.cover, kind: p.roofType || 'pitched',
      scaleBasis: rd.scaleBasis || '', at: new Date().toISOString()
    };
    state.result = recompute();
    state.roofRead = Object.assign({}, rd, { applied: true });
    return done;
  }

  /* the stored facts with the model's figures taken live from the bill */
  function roofNow() {
    if (!state.roof) return null;
    if (state.roofAnalysis) return roofInfo(state.roofAnalysis, state.roof.text || '');
    const rd = state.roofRead;
    if (!rd) return roofInfo(null, state.roof.text || '');
    const g = (state.result && state.result.model && state.result.model.g) || {};
    return Object.assign({}, rd, { modelPlan: g.roofPlan || rd.modelPlan, modelArea: g.roofArea || rd.modelArea });
  }

  function clearRoof() {
    state.roof = null; state.roofRead = null; state.roofAnalysis = null;
    if (state.params.roofPlan) delete state.params.roofPlan;
    state.result = recompute();
    render(); save();
    toast('Roof plan removed');
  }

  /* the figures the drawing gave, and how they sit against the model */
  function roofFacts(rd) {
    const p = state.params;
    if (!rd) return '';
    const rows = [];
    rows.push(['Roof plan', esc(state.roof.name) + (state.roof.pages > 1 ? ' · sheet ' + state.roof.page + ' of ' + state.roof.pages : '')]);
    if (rd.measured) rows.push(['Roof outline', fmt(rd.W) + ' × ' + fmt(rd.D) + ' m' + (rd.scaleBasis ? ' <span class="hint">(' + esc(rd.scaleBasis) + ')</span>' : '')]);
    else if (rd.hasScale) rows.push(['Roof outline', '<span class="hint">no roof rectangle found on the sheet</span>']);
    else if (rd.outline) rows.push(['Roof outline', '<span class="hint">not measured — the roof sheet carries no scale; type the roof width below</span>']);
    if (rd.kind === 'flat') rows.push(['Roof', '<b>flat</b> according to the plan']);
    else rows.push(['Pitch', (rd.pitchFrom === 'drawing'
      ? '<b>' + fmt(rd.pitch, 1) + '°</b> written on the drawing' +
        (Math.abs((+p.roofPitch || 0) - rd.pitch) > 0.01
          ? ' <span class="hint">· the model is at ' + fmt(p.roofPitch, 1) + '° — apply to take the drawing</span>' : '')
      : fmt(p.roofPitch, 1) + '° in the model <span class="hint">(no pitch written on the drawing)</span>')]);
    if (rd.cover) rows.push(['Covering', esc(rd.cover) + ' named on the plan']);
    if (rd.stated) rows.push(['Roof area stated', fmt(rd.stated) + ' m²']);
    if (rd.planArea != null) rows.push(['Roof area measured', rd.kind === 'flat'
      ? '<b>' + fmt(rd.planArea) + ' m²</b> flat'
      : fmt(rd.planArea) + ' m² on plan · <b>' + fmt(rd.slope) + ' m² at pitch</b>']);
    if (rd.over != null) rows.push(['Eaves overhang', fmt(rd.over, 2) + ' m a side <span class="hint">(' +
      (rd.overFrom === 'drawing' ? 'written on the drawing'
        : 'the roof ' + fmt(rd.W) + ' m less the ' + fmt(rd.mainW) + ' m building, halved') + ')</span>']);
    if (rd.widthDiff != null && rd.widthDiff > 1.2) rows.push(['Roof against the model',
      '<span class="hint">the roof is ' + fmt(rd.W) + ' m wide and the building model ' + fmt(rd.mainW) +
      ' m — check the building width or the roof scale</span>']);
    const live = (state.result && state.result.model && state.result.model.g) || {};
    const flatNow = (state.params.roofType === 'flat');
    if (live.roofArea != null) rows.push(['The bill carries', fmt(live.roofArea) + ' m²' + (flatNow ? '' : ' sloping') + ' (' + fmt(live.roofPlan) + ' m² on plan)']);
    else if (rd.modelArea != null) rows.push(['The bill carries', fmt(rd.modelArea) + ' m²' + (flatNow ? '' : ' sloping') + ' (' + fmt(rd.modelPlan) + ' m² on plan)']);
    const needWidth = !rd.hasScale && rd.outline && !rd.measured;
    return `<table class="roof-facts"><tbody>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody></table>
      ${needWidth ? `<div class="field" style="margin-top:10px;max-width:260px">
        <label>Overall roof width on the drawing (m)</label>
        <div class="row" style="gap:6px">
          <input type="number" step="0.1" min="2" max="200" id="roof-width" value="${state.roof.widthMM ? fmt(state.roof.widthMM / 1000) : ''}" placeholder="e.g. 22.5">
          <button class="btn sm" id="set-roof-width">Measure</button>
        </div>
        <span class="hint">Type the width the roof plan dimensions, and the outline is measured from it.</span>
      </div>` : ''}`;
  }

  /* the upload panel, on the first step */
  /* what the chosen type makes of the plan, in one line under the settings */
  function roofCalc(rg, p, rt) {
    if (!rg) return '';
    const par = p.parapet != null ? +p.parapet : 0.9;
    const bits = [];
    if (rt === 'flat') {
      const runs = { all: 'all round', frontBack: 'front and back', sides: 'to the two sides', none: 'none' }[rg.parapetSides || 'all'];
      bits.push('slab ' + fmt(rg.planArea) + ' m² on plan');
      bits.push(rg.parapetL > 0
        ? fmt(rg.parapetL) + ' m of parapet ' + runs + ' at ' + fmt(par) + ' m high = ' + fmt(rg.parapetL * par) + ' m² of wall'
        : 'no parapet');
    } else {
      if (rt === 'mono') {
        bits.push('high side at the ' + (rg.high || 'front'));
      } else {
        bits.push(rg.ridge > 0
          ? fmt(rg.ridge) + ' m ridge ' + (rg.ridgeDir === 'width' ? 'across the width' : 'along the length')
          : 'no ridge');
      }
      if (rg.hips > 0) bits.push(fmt(rg.hips) + ' m of hips');
      if (rg.valleys > 0) bits.push(fmt(rg.valleys) + ' m of valleys');
      bits.push((rg.type === 'mono' ? 'high edge ' : 'eaves ') + fmt(rg.type === 'mono' ? rg.highEdge : rg.eaves) + ' m');
      if (rg.barges > 0) bits.push(fmt(rg.barges) + ' m of barge');
      bits.push('rise ' + fmt(rg.rise) + ' m');
      bits.push('covering ' + fmt(rg.covering) + ' m²');
      bits.push(rg.trusses + ' ' + (rt === 'mono' ? 'rafter' : 'truss') + ' lines at ' + rg.rafterC + ' mm · purlins at ' + rg.purlinC + ' mm');
    }
    return '<b>' + esc(RoofGeom.short(rt)) + '</b> · ' + bits.join(' · ');
  }

  function roofUploadPanel() {
    const rd = roofNow();
    const p = state.params;
    const rt = RoofGeom.norm(p.roofType);
    const r = state.result || null;
    const modelArea = r && r.model && r.model.g ? r.model.g.roofArea : null;
    const diff = (rd && rd.slope && modelArea) ? (rd.slope - modelArea) : null;
    const agree = diff != null && Math.abs(diff) <= Math.max(2, modelArea * 0.02);
    const rg = (r && r.model && r.model.g && r.model.g.roof) || null;
    return `
    <section class="panel grp-card" id="grp-roof" data-roof-drop="1"
             data-grp-label="Roof Plan" data-grp-search="${esc(groupSearchText(groupDef('roof')))}">
      <div class="row grp-head" style="align-items:baseline;gap:10px;flex-wrap:wrap">
        <span class="grp-no">7</span>
        <h2 style="margin:0">Roof Plan</h2>
        <span class="chip${state.roof ? ' ok' : ''}">${state.roof ? 'on file' : 'optional'}</span>
        <span style="flex:1"></span>
        <button class="btn sm" id="pick-roof">${state.roof ? '+ Replace the roof plan' : '+ Add the roof plan'}</button>
      </div>
      <p class="lede">Add the roof plan if the set has one. Its pitch, its covering and its outline are read here and carried
        into the roofing bill — without one the roof is measured from the floor plan with the pitch set in Settings.</p>
      ${state.roof ? '' : `<p class="grp-empty">Nothing filed here yet — <b>+ Add the roof plan</b> takes a sheet,
        or drop one here. JPG, PNG, WEBP or PDF; a PDF sheet is found by its text.</p>`}
      <div class="grid2"${state.roof ? '' : ' style="display:none"'}>
        <div>
          ${state.roof ? `<div class="filemeta">
            <span class="chip ok">Roof plan</span>
            <b>${esc(state.roof.name)}</b>
            <span>${state.roof.size ? (state.roof.size / 1024).toFixed(0) + ' KB' : ''}</span>
            <span style="flex:1"></span>
            <label class="hint" style="margin:0">As
              <select data-roof-kind="1">${PLAN_KINDS.map(k =>
                `<option value="${k[0]}"${k[0] === 'roof' ? ' selected' : ''}>${k[1]}</option>`).join('')}</select></label>
            <button class="btn sm" id="reread-roof">Read again</button>
            <button class="btn sm" id="clear-roof">Remove</button>
          </div>
          <div class="roof-thumb"><img src="${state.roof.dataUrl}" alt="The roof plan"></div>` : ''}
          ${planRowsOf(groupDef('roof'))}
        </div>
        <div>
          ${rd ? `${roofFacts(rd)}
            <div class="row" style="margin-top:10px">
              <button class="btn primary sm" id="use-roof">${rd.applied ? 'Apply the roof plan again' : 'Use the roof plan'}</button>
            </div>
            ${diff != null ? `<p class="hint" style="margin-top:8px">${rd.applied
              ? 'Applied to the bill — ' + (agree
                ? 'the outline agrees with the model within 2 %.'
                : 'the drawing measures ' + fmt(Math.abs(diff)) + ' m² ' + (diff > 0 ? 'more' : 'less') + ' of roof than the model (' + fmt(modelArea) + ' m²).')
              : (agree
                ? 'The outline agrees with the model within 2 % — apply it to put the drawing on record.'
                : 'The drawing measures ' + fmt(Math.abs(diff)) + ' m² ' + (diff > 0 ? 'more' : 'less') + ' of roof than the model (' + fmt(modelArea) + ' m²).')}</p>` : ''}
            ${rd.cover && /tiles|asbestos|shingle|polycarbonate/.test(rd.cover) ? `<p class="note" style="margin-top:10px;background:#fff6e0;border-color:#f0d9a8">The roof plan names <b>${esc(rd.cover)}</b>, but the bill prices long-span aluminium. Adjust the roofing rate in <b>Settings → Pricing</b> if the tiles are specified.</p>` : ''}`
          : `<p class="hint">No roof plan yet. The bill measures the roof from the floor plan: the footprint plus the eaves
             overhang, divided by the cosine of the pitch set in Settings.</p>`}
        </div>
      </div>

      <div class="divider"></div>
      <h4 class="hint" style="margin:0 0 8px">ROOF TYPE AND SETTINGS</h4>
      <div class="grid2" id="roof-settings">
        <div class="field"><label>Roof type</label>
          <select data-p="roofType">${RoofGeom.TYPES.map(([k, t]) =>
            `<option value="${k}"${k === rt ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
        ${rt === 'flat' ? '' : `<div class="field"><label>Pitch (°)</label>
          <input type="number" data-p="roofPitch" min="0" max="60" step="1" value="${p.roofPitch}"></div>`}
        <div class="field"><label>Eaves overhang (m)</label>
          <input type="number" data-p="overhang" min="0" max="2" step="0.05" value="${p.overhang}"></div>
        ${rt === 'gable' || rt === 'hip' || rt === 'cross' ? `<div class="field"><label>Ridge runs</label>
          <select data-p="roofRidge">
            <option value="length"${p.roofRidge !== 'width' ? ' selected' : ''}>Along the length</option>
            <option value="width"${p.roofRidge === 'width' ? ' selected' : ''}>Across the width</option>
          </select></div>` : ''}
        ${rt === 'mono' ? `<div class="field"><label>High side — the wall it rises to</label>
          <select data-p="roofHigh">${[['front', 'Front'], ['back', 'Back'], ['left', 'Left'], ['right', 'Right']].map(([k, t]) =>
            `<option value="${k}"${(p.roofHigh || 'front') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></div>` : ''}
        ${rt === 'flat' ? `<div class="field"><label>Parapet height (m)</label>
          <input type="number" data-p="parapet" min="0" max="2" step="0.05" value="${p.parapet != null ? p.parapet : 0.9}"></div>
        <div class="field"><label>Parapet runs</label>
          <select data-p="parapetSides">${[['all', 'All round'], ['frontBack', 'Front and back'], ['sides', 'The two sides'], ['none', 'None']].map(([k, t]) =>
            `<option value="${k}"${(p.parapetSides || 'all') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></div>` : ''}
        ${rt === 'flat' ? '' : `<div class="field"><label>${rt === 'mono' ? 'Rafters' : 'Trusses'} at centres (mm)</label>
          <input type="number" data-p="roofRafterC" min="300" max="2400" step="50" value="${p.roofRafterC != null ? p.roofRafterC : 1200}"></div>
        <div class="field"><label>Purlins at centres (mm)</label>
          <input type="number" data-p="roofPurlinC" min="200" max="1500" step="50" value="${p.roofPurlinC != null ? p.roofPurlinC : 900}"></div>`}
        ${rt === 'cross' ? `<div class="field"><label>Ridge runs the drawing shows (m)</label>
          <input type="number" data-p="roofRidgeL" min="0" step="0.1" value="${p.roofRidgeL != null ? p.roofRidgeL : ''}" placeholder="${rg ? fmt(rg.ridge) : 'auto'}"></div>
        <div class="field"><label>Hip lines the drawing shows (m)</label>
          <input type="number" data-p="roofHipL" min="0" step="0.1" value="${p.roofHipL != null ? p.roofHipL : ''}" placeholder="${rg ? fmt(rg.hips) : 'auto'}"></div>
        <div class="field"><label>Valley lines the drawing shows (m)</label>
          <input type="number" data-p="roofValleyL" min="0" step="0.1" value="${p.roofValleyL != null ? p.roofValleyL : ''}" placeholder="${rg ? fmt(rg.valleys) : 'auto'}"></div>` : ''}
      </div>
      <p class="hint roof-calc" style="margin-top:10px">${roofCalc(rg, p, rt)}</p>
      <p class="hint" style="margin-top:6px">${rt === 'flat'
        ? 'A flat roof is measured as the plan area with a parapet wall round the edge; the pitch is not used.'
        : 'A pitched roof covers its plan — footprint plus the eaves overhang each side — divided by cos(pitch).'}
        ${rd ? ' The roof plan is compared with these figures; only <b>Use the roof plan</b> writes its figures into the model.'
             : ' These are the figures the bill uses until a roof plan is uploaded.'}</p>
      ${genReadLine('roof')}
    </section>`;
  }

  /* the card on the building model, where the roof figures are confirmed */
  function roofModelPanel() {
    if (!state.roof) return '';
    const rd = roofNow();
    if (!rd) return '';
    return `
    <section class="panel roof-panel">
      <div class="row" style="align-items:baseline;gap:10px;flex-wrap:wrap">
        <h2 style="margin:0">Roof plan</h2>
        <span class="chip ok">read from the drawing</span>
        <span style="flex:1"></span>
        <button class="btn sm" id="reread-roof">Read again</button>
        <button class="btn sm primary" id="use-roof">${rd.applied ? 'Apply again' : 'Use the roof plan'}</button>
        <button class="btn sm" id="clear-roof">Remove</button>
      </div>
      <div class="grid2" style="margin-top:12px">
        <div>${roofFacts(rd)}</div>
        <div class="roof-thumb"><img src="${state.roof.dataUrl}" alt="The roof plan"></div>
      </div>
      ${rd.cover && /tiles|asbestos|shingle|polycarbonate/.test(rd.cover) ? `<p class="note" style="margin-top:10px;background:#fff6e0;border-color:#f0d9a8">The roof plan names <b>${esc(rd.cover)}</b>; the bill prices long-span aluminium — change the roofing rate in Settings → Pricing if the tiles are specified.</p>` : ''}
    </section>`;
  }


  function step1() {
    const img = state.image;
    return `
    <section class="panel">
      <h2><span class="stepno">1 · </span>Upload the drawing set</h2>
      <p class="lede">Drop in each sheet of the set — the floor plans, the site plan, the elevations, the sections,
      the schedules, the layouts. Everything is read on this device: nothing is uploaded anywhere, and the app
      keeps working with no connection.</p>

      <div class="drop" id="drop">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4 16.5V19a1.5 1.5 0 001.5 1.5h13A1.5 1.5 0 0020 19v-2.5" stroke-linecap="round"/>
        </svg>
        <b>Drop the whole set here — one file or several</b>
        <span>JPG, PNG, WEBP or PDF · each file is read by its name and filed in the right card below · a clear, straight-on drawing works best</span>
        <div class="row" style="justify-content:center;margin-top:14px">
          <button class="btn primary" id="pick-file">Browse files</button>
          <button class="btn" id="use-sample">Use the PS 1 sample plan</button>
        </div>
      </div>

      ${state.pdf && state.pdf.pages > 1 ? `<div class="field" style="max-width:260px;margin-top:10px">
          <label>Page of this PDF — ${state.pdf.pages} sheets</label>
          <select id="pdf-page">${Array.from({ length: state.pdf.pages }, (_, i) =>
            `<option value="${i + 1}"${i + 1 === state.pdf.page ? ' selected' : ''}>Page ${i + 1}</option>`).join('')}</select>
        </div>` : ''}
    </section>

    ${drawingSet()}

    <section class="panel">
      <h2>What are you building?</h2>
      <p class="lede">Pick a starting point — each brings a typical room schedule, specification and geometry you can
      edit on the next steps. Or upload a plan first and let the app measure the walls.</p>
      <div class="row" style="flex-wrap:wrap;gap:8px">
        ${Settings.PRESETS.map((x, i) => `<button class="btn sm ${state.params.template === undefined ? '' : ''}${(x.params.template === 'school' ? isSchool() : (!isSchool() && state.params.buildingType === x.params.buildingType && i === Settings.presetFor(x.params.buildingType, 'general'))) ? ' primary' : ''}" data-start-preset="${i}">${esc(x.label.replace(' · ', ' — '))}</button>`).join('')}
      </div>
      <p class="hint" style="margin-top:12px">Currently loading: <b>${esc(state.params.projectName)}</b>
        · ${state.params.template === 'school' ? state.params.nClassrooms + ' rooms' : (state.params.rooms || []).reduce((s, r) => s + (r.n || 1), 0) + ' rooms'}
        · ${SYM(state.params)} ${fmt((state.result && state.result.perM2) || 0)} /m²</p>
    </section>

    <section class="panel">
      <div class="row" style="align-items:center;gap:10px">
        <h2 style="margin:0">Saved bills</h2>
        <span style="flex:1"></span>
        <button class="btn sm" id="btn-projects2">All saved bills</button>
      </div>
      <p class="lede">Bills you have already generated are kept on this device. Open one to carry on from where you
      left it, or export and print it again — no file to hunt for, and it works with no connection.</p>
      <div id="lib-recent" class="lib-recent"><p class="hint">Reading the library…</p></div>
    </section>

    <section class="panel" style="margin-top:0">
      <h2>How it works</h2>
      <div class="grid3">
        <div><span class="chip">1</span><p><b>Read the drawing.</b> The app finds the ink in your picture and picks out the long straight lines — the walls — then estimates the bays.</p></div>
        <div><span class="chip">2</span><p><b>Set the scale.</b> Type one known dimension (for example the overall length, 18,600 mm) or click two points on a dimension line.</p></div>
        <div><span class="chip">3</span><p><b>Get the bill.</b> Quantities are measured and priced into 13–14 bills, editable, ready to print or export as Excel, Word, PDF or CSV.</p></div>
      </div>
      <div class="note" style="margin-top:16px"><b>Honest limitation:</b> a browser cannot reliably read dimension text off an arbitrary drawing without an OCR model.
      Quick Quantity therefore measures from the drawing's line-work and asks you to confirm one dimension. Everything after that — measuring, applying
      Ghanaian construction practice, pricing — is automatic.</div>
    </section>`;
  }

  /* ---------------------------------------------------------------- building type
     What is the app looking at? Read the room labels on the measured sheet
     (falling back to the whole set), then name the building from those words. */
  const BUILDINGS = [
    { type: 'educational', label: 'Educational block', words: ['class room', 'classroom', 'head master', 'headmaster', 'staff room', 'library', 'laboratory', 'assembly', 'pupils', 'kindergarten', 'kg'] },
    { type: 'domestic', label: 'Domestic house', words: ['bedroom', 'living room', 'living area', 'dining', 'kitchen', 'bathroom', 'shower', 'laundry', 'garage', 'sitting room', 'master bed', 'balcony', 'porch', 'store'] },
    { type: 'commercial', label: 'Commercial building', words: ['office', 'reception', 'conference', 'boardroom', 'shop', 'retail', 'showroom', 'warehouse', 'banking hall', 'meeting room', 'server room', 'open plan'] },
    { type: 'health', label: 'Health facility', words: ['ward', 'clinic', 'consulting', 'treatment', 'dispensary', 'theatre', 'pharmacy', 'triage', 'maternity', 'nurse', 'patient'] },
    { type: 'religious', label: 'Place of worship', words: ['nave', 'sanctuary', 'altar', 'vestry', 'pew', 'chapel', 'mosque', 'minaret', 'pulpit', 'choir'] }
  ];

  function countWord(hay, w) {
    let n = 0, i = 0;
    while ((i = hay.indexOf(w, i)) !== -1) { n++; i += w.length; }
    return n;
  }

  function identifyBuilding(sheets, planPage) {
    const pages = sheets || [];
    if (!pages.length) return null;
    const plan = pages.find(s => s.page === planPage);
    let text = (plan && plan.text) || '';
    if (text.replace(/\s/g, '').length < 12) text = pages.map(s => s.text || '').join(' ');
    if (!text) return null;
    const t = ' ' + text.toLowerCase().replace(/\s+/g, ' ') + ' ';
    let best = null;
    BUILDINGS.forEach(b => {
      const hits = [];
      let score = 0;
      b.words.forEach(w => {
        const n = countWord(t, w);
        if (n) { score += n; hits.push(w.replace('class room', 'classroom').replace('headmaster', 'head master')); }
      });
      if (score >= 2 && (!best || score > best.score)) {
        best = { type: b.type, label: b.label, score: score,
                 evidence: hits.slice(0, 4), pages: pages.length };
      }
    });
    return best;
  }

  /* Every room family the reader knows, with the type the engine prices and
     the size to assume when the drawing does not give one. Order matters:
     the first match wins, so "BATHROOM" is a bath before it is a room. */
  const ROOM_KINDS = [
    [/bed\s*room|bed\s*rm|b\/room|^bed\b|master\s+bed/i, 'bedroom', 3.6, 3.2],
    [/living|sitting|lounge/i, 'living', 5.0, 4.2],
    [/dining/i, 'dining', 3.6, 3.0],
    [/kitchen|pantry/i, 'kitchen', 3.0, 2.6],
    [/bath\s*room|^bath|shower|wash\s*room/i, 'bath', 2.2, 1.8],
    [/toilet|w\.?\s?c/i, 'wc', 1.8, 1.5],
    [/store|utility|laundry/i, 'store', 2.2, 1.8],
    [/garage|car\s*port/i, 'garage', 4.0, 3.0],
    [/porch|veranda|balcony|terrace/i, 'porch', 3.0, 1.8],
    [/stair|landing/i, 'stair', 2.4, 2.4],
    [/corridor|passage|lobby|hallway/i, 'corridor', 3.0, 1.5],
    [/hall/i, 'hall', 4.5, 3.6],
    [/office|study|consult|treatment|head\s*master|head\s*teacher|principal|reception|dispensar/i, 'office', 3.4, 3.0],
    [/shop|showroom|warehouse/i, 'shop', 5.0, 4.0],
    [/class|laborator|^lab\b|library|kindergarten|^kg\b/i, 'classroom', 6.0, 5.4],
    [/ward|pharmacy|maternity|theatre|triage/i, 'ward', 4.0, 3.4],
    [/nave|sanctuary|altar|chapel|choir|pulpit|crypt/i, 'sanctuary', 6.0, 5.0],
    [/vestry/i, 'vestry', 3.0, 2.6],
    [/room/i, 'living', 3.4, 3.0]
  ];
  const roomKindOf = name => {
    for (let i = 0; i < ROOM_KINDS.length; i++) if (ROOM_KINDS[i][0].test(name)) return ROOM_KINDS[i];
    return [/./, 'living', 3.4, 3.0];
  };

  // the walls that bound the building on the drawing, in image pixels


  /* One sheet often carries the ground floor and the first floor side by
     side. Their rooms belong to different floors and must never be added
     together: the labels are grouped under the floor title printed above
     them, and the schedule is read from one group. */
  function floorGroups(sheet) {
    const labels = (sheet && sheet.labels) || [];
    const titles = (sheet && sheet.floorTitles) || [];
    if (titles.length < 2 || labels.length < 6) return null;
    const storeyOfTitle = t => {
      const s = String(t.text || '').toLowerCase();
      if (/third/.test(s)) return 4;
      if (/second/.test(s)) return 3;
      if (/first|upper/.test(s)) return 2;
      if (/ground|lower/.test(s)) return 1;
      return 1;
    };
    const groups = titles.map(t => ({ title: t.text, storey: storeyOfTitle(t), u: t.u, v: t.v, labels: [] }));
    labels.forEach(l => {
      let best = groups[0], bd = Infinity;
      groups.forEach(g => {
        const d = Math.abs(l.v - g.v) + 1.5 * Math.abs(l.u - g.u);
        if (d < bd) { bd = d; best = g; }
      });
      best.labels.push(l);
    });
    const usable = groups.filter(g => g.labels.length >= 3);
    return usable.length >= 2 ? usable : null;
  }

  function chosenFloorGroup(sheet, wantStorey) {
    const groups = floorGroups(sheet);
    if (!groups) return null;
    // the ground floor is the reference unless another plan is asked for
    const want = wantStorey != null ? +wantStorey : 1;
    return groups.filter(g => g.storey === want)[0]
      || groups.slice().sort((a, b) => a.storey - b.storey)[0];
  }

  /* Rooms as printed on the measured sheet: the name exactly as it appears,
     and the size to the nearest walls either side of the label. */
  function roomsOfSheet(sheet, wantStorey) {
    if (!sheet || !sheet.labels || !sheet.labels.length) return [];
    const grp = chosenFloorGroup(sheet, wantStorey);
    const labels = grp ? grp.labels : sheet.labels;
    const seenName = {};
    return labels.map(l => {
      // the name is what is printed, without the size that often follows it
      const m = l.text.match(/(\d+(?:[.,]\d+)?)\s*(?:mm|m)?\s*[x\u00d7]\s*(\d+(?:[.,]\d+)?)\s*(mm|m)?\s*$/i);
      // the size printed after the name is a dimension, not part of the name
      const name = (m ? l.text.slice(0, m.index) : l.text).replace(/[\s\-\u2013:\/(]+$/, '').trim() || l.text;
      const k = roomKindOf(name);
      let L = 0, W = 0, printed = false;
      if (m) {
        L = +m[1].replace(',', '.'); W = +m[2].replace(',', '.');
        const unit = (m[3] || '').toLowerCase();
        if (unit === 'mm' || L > 30 || W > 30) { L = L / 1000; W = W / 1000; }
        printed = L >= 1 && L <= 30 && W >= 1 && W <= 30;
      }
      // "BEDROOM 1" printed twice at the same spot is one room
      const key = name + '@' + Math.round(l.u * 100) + ',' + Math.round(l.v * 100);
      if (seenName[key]) return null;
      seenName[key] = 1;
      return { name: name, type: k[1],
               L: printed ? Math.round(L * 100) / 100 : k[2],
               W: printed ? Math.round(W * 100) / 100 : k[3],
               n: 1, printed: printed };
    }).filter(Boolean).slice(0, 30);
  }

  /* The floor plans the file actually contains, one entry per drawn sheet.
     A set often holds the ground floor, the first floor and a furniture
     layout of the same floor: reading every one of them would list the same
     bedroom three times, so the schedule is read from one sheet — the one
     being measured — and the card offers the others. */
  function planSheets() {
    return (state.sheets || [])
      .filter(s => s.kind === 'floor' && s.labels && s.labels.length)
      .sort((a, b) => ((a.storey || 1) - (b.storey || 1)) || (a.page - b.page));
  }

  function readRoomsFrom(sheet, wantStorey) {
    if (!sheet) return null;
    const grp = chosenFloorGroup(sheet, wantStorey);
    const groups = floorGroups(sheet) || [];
    const floor = (grp && grp.storey) || sheet.storey || 1;
    return {
      page: sheet.page,
      title: (grp && grp.title) || sheet.title || '',
      storey: floor,
      plansOnSheet: groups.length || 1,
      floorPlans: groups.map(g => ({ storey: g.storey, title: g.title, rooms: g.labels.length })),
      rooms: roomsOfSheet(sheet, wantStorey).map(r => Object.assign({}, r, { floor: floor }))
    };
  }

  /* A project saved by an older build can hold the rooms of every floor plan
     in one list — sixty rooms adding up to four times the floor area. When
     the saved list no longer matches the sheet it came from, read the sheet
     again: one floor plan, one set of rooms. */
  function repairRoomRead() {
    const rd = state.roomRead;
    if (!rd || !rd.rooms || !rd.rooms.length) return false;
    const sheets = (state.sheets || []).filter(s => s.labels && s.labels.length);
    const sheet = sheets.filter(s => s.page === rd.page)[0]
      || planSheets().filter(s => (s.storey || 1) === (rd.storey || 1))[0]
      || planSheets()[0];
    if (!sheet) return false;
    const fresh = roomsOfSheet(sheet);
    if (fresh.length < 2) return false;
    const floors = {};
    rd.rooms.forEach(r => { floors[+r.floor || 1] = 1; });
    const manyFloors = Object.keys(floors).length > 1;
    const stale = rd.rooms.length > fresh.length + 1 || manyFloors;
    if (!stale) return false;
    state.roomRead = readRoomsFrom(sheet);
    const rooms = state.roomRead.rooms;
    if (isSchool()) {
      const n = rooms.filter(r => r.type === 'classroom').length;
      if (n) state.params.nClassrooms = Math.min(8, Math.max(1, n));
    } else {
      state.params.rooms = rooms.map(r => ({ name: r.name, type: r.type, L: r.L, W: r.W, n: 1, floor: r.floor || 1 }));
    }
    state.result = recompute();
    return true;
  }

  /* Put one sheet's rooms into the schedule (the model is a typical floor). */
  function useRoomSheet(page, wantStorey) {
    const sheet = planSheets().filter(s => s.page === page)[0];
    if (!sheet) return;
    const read = readRoomsFrom(sheet, wantStorey);
    if (!read || read.rooms.length < 2) { toast('No room labels on sheet ' + page); return; }
    state.roomRead = read;
    if (isSchool()) {
      const n = read.rooms.filter(r => r.type === 'classroom').length;
      if (n) state.params.nClassrooms = Math.min(8, Math.max(1, n));
    } else {
      state.params.rooms = read.rooms.map(r => ({
        name: r.name, type: r.type, L: r.L, W: r.W, n: 1, floor: r.floor || 1
      }));
    }
    state.result = recompute();
    render(); save();
    toast('Rooms read from sheet ' + page + (read.title ? ' — ' + read.title : '') +
      ' · ' + read.rooms.length + ' rooms');
  }

  /* ------------------------------------------------- doors and windows */
  /* A plan carries its openings as tags — D1, W2, SD3 — and the schedule,
     often on the same sheet or the one beside it, carries their sizes. Read
     both: the size comes from wherever the drawing prints it, the number from
     the schedule when it says "6 No." and otherwise from how often the tag is
     drawn on the floor plans. */
  const OPEN_TAG = /\b(WD|WN|SD|FD|GD|BD|DR|D|W)\s*[.\-\/]?\s*(\d{1,2})(?!\d)/gi;
  const OPEN_KIND = { D: 'door', SD: 'door', FD: 'door', GD: 'door', BD: 'door', DR: 'door', W: 'window', WD: 'window', WN: 'window' };

  /* A size as printed on a drawing: 900 x 2100, 0.9 x 2.1, 90 x 210,
     1200mm x 1200mm, 900X2100.  Work out the unit from the number itself
     when the drawing does not say. */
  const OPEN_SIZE = /(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)\s*(mm|cm|m)?\s*[x\u00d7X]\s*(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)\s*(mm|cm|m)?/gi;
  function openMM(raw, unit) {
    const v = parseFloat(String(raw).replace(/,/g, ''));
    if (!isFinite(v)) return 0;
    const u = (unit || '').toLowerCase();
    if (u === 'mm') return v;
    if (u === 'cm') return v * 10;
    if (u === 'm') return v * 1000;
    if (/\./.test(raw)) return v < 30 ? v * 1000 : v;   // 0.9 is metres
    if (v < 30) return v * 1000;                        // 3 is metres
    if (v < 300) return v * 10;                         // 90 is centimetres
    return v;                                           // 900 is millimetres
  }

  /* Read the openings from the sheets.  A tag is paired with the size
     printed beside it in the same row — schedules put the description
     between the two ("D1  Flush door  900 x 2100  3 No."), so the search
     runs to the next tag rather than a short fixed window.  The printed
     quantity wins over counting how often the tag is drawn; when there is
     no schedule the count falls back to the floor plans. */
  function openingsFromDrawing(sheetsArg) {
    const sheets = (Array.isArray(sheetsArg) ? sheetsArg : (state.sheets || [])).filter(s => s.text);
    if (!sheets.length) return null;

    const refsIn = (text, step) => {
      const out = []; OPEN_TAG.lastIndex = 0; let m;
      while ((m = OPEN_TAG.exec(text))) {
        const letter = m[1].toUpperCase(), num = String(parseInt(m[2], 10));
        out.push({ tag: letter + m[2], letter: letter, num: num, key: letter + num,
          kind: OPEN_KIND[letter] || 'door', at: m.index, end: OPEN_TAG.lastIndex, page: null });
      }
      return out;
    };
    const sizesIn = (text) => {
      const out = []; OPEN_SIZE.lastIndex = 0; let m;
      while ((m = OPEN_SIZE.exec(text))) {
        const w = openMM(m[1], m[2]) / 1000;
        const h = openMM(m[3], m[4] || m[2]) / 1000;
        if (!(w >= 0.4 && w <= 6.5 && h >= 0.4 && h <= 3.6)) continue;
        out.push({ w: Math.round(w * 1000) / 1000, h: Math.round(h * 1000) / 1000, at: m.index, end: OPEN_SIZE.lastIndex });
      }
      return out;
    };

    const found = {};
    // D01 on the plan and D1 in the schedule are the same door
    const at = (r) => found[r.key] || (found[r.key] = { tag: r.tag, key: r.key, letter: r.letter, num: r.num,
      kind: r.kind, w: 0, h: 0, wall: '', page: r.page, count: 0, from: '' });

    /* pass 1 — each tag and the size printed with it */
    sheets.forEach(sh => {
      const sizes = sizesIn(sh.text);
      const refs = refsIn(sh.text).map(r => (r.page = sh.page, r));
      refs.forEach((r, i) => {
        const stop = Math.min(i + 1 < refs.length ? refs[i + 1].at : sh.text.length, r.end + 110);
        const seg = sh.text.slice(r.end, stop);
        // the size must be printed in this row, after the tag: a size that
        // belongs to the row above is never borrowed
        let sz = sizes.filter(z => z.at >= r.end && z.at < stop)[0];
        if (!sz) {
          // some schedules give width and height as two columns and no "x"
          const mm = /\b(\d{3,4})\s+(?:mm\s+)?(\d{3,4})\b/.exec(seg);
          if (mm) {
            const w0 = +mm[1], h0 = +mm[2];
            if (w0 >= 400 && w0 <= 6500 && h0 >= 400 && h0 <= 3600) {
              sz = { w: w0 / 1000, h: h0 / 1000, at: r.end + mm.index, end: r.end + mm.index + mm[0].length };
            }
          }
        }
        if (!sz) return;
        const o = at(r);
        const better = !o.w || (sh.kind === 'schedule' && o.from !== 'schedule');
        if (better) { o.w = sz.w; o.h = sz.h; o.from = sh.kind === 'schedule' ? 'schedule' : 'plan'; o.page = sh.page; }
        // only the description printed after the tag belongs to this row: the
        // row above must not colour it
        const near = seg.toLowerCase();
        const wall = /external|ext\.|outside|entrance|front door|back door|rear door|main door|service door/.test(near) ? 'ext'
          : (/internal|int\.|bathroom|toilet|w\.?\s?c\.?|wardrobe|ensuite/.test(near) ? 'int' : '');
        if (wall && !o.wall) o.wall = wall;
      });
    });

    /* pass 2 — a printed quantity on the same row */
    sheets.forEach(sh => {
      const refs = refsIn(sh.text).map(r => (r.page = sh.page, r));
      refs.forEach((r, i) => {
        const stop = Math.min(i + 1 < refs.length ? refs[i + 1].at : sh.text.length, r.end + 110);
        const seg = sh.text.slice(r.end, stop);
        const cm = /(\d{1,2})\s*(?:no|nos|nr|units?|pcs?)\b/i.exec(seg) || /\b(?:qty|quantity|no\.?)\s*[:.]?\s*(\d{1,2})\b/i.exec(seg);
        const o = found[r.key];
        if (!cm || !o) return;
        if (!o.count || sh.kind === 'schedule') o.count = Math.max(1, Math.min(40, +cm[1] || 0));
      });
    });

    /* a tag with no size anywhere cannot be priced — drop it, but keep a
       tag whose size sits in a legend on another sheet */
    Object.keys(found).forEach(k => {
      const o = found[k];
      if (!o.w && found[k].kind === 'door') { /* leave for the fallback below */ }
    });
    const items0 = Object.keys(found).map(k => found[k]).filter(o => o.w > 0);
    const items = items0.length ? items0 : [];
    if (items.length < 2) return null;

    /* pass 3 — how often each tag is drawn on a floor plan */
    const planPages = (state.sheets || []).filter(s => s.text && s.kind === 'floor').map(s => s.page);
    const countPages = planPages.length ? planPages
      : (state.sheets || []).filter(s => s.text && s.kind !== 'schedule').map(s => s.page);
    items.forEach(o => {
      if (o.count) return;
      let n = 0;
      sheets.filter(s => countPages.indexOf(s.page) >= 0).forEach(s => {
        const re = new RegExp('\\b' + o.letter + '0*' + o.num + '\\b', 'gi');
        const hits = s.text.match(re);
        if (hits) n += hits.length;
      });
      o.count = Math.max(1, Math.min(40, n));
    });

    // first door and first window sit in an external wall
    const firstDoor = items.filter(i => i.kind === 'door')[0];
    const firstWin = items.filter(i => i.kind === 'window')[0];
    if (firstDoor && !firstDoor.wall) firstDoor.wall = 'ext';
    if (firstWin && !firstWin.wall) firstWin.wall = 'ext';

    const rateFor = (o) => {
      const same = [...(state.params.doors || []), ...(state.params.windows || [])]
        .filter(x => (x.ref || '').toUpperCase() === o.tag)[0];
      if (same && same.rate) return same.rate;
      const area = o.w * o.h;
      return o.kind === 'door'
        ? Math.round((1500 + 850 * area) / 10) * 10
        : Math.round(Math.max(950, 1150 * area) / 10) * 10;
    };
    const descFor = (o) => {
      const mm = Math.round(o.w * 1000) + ' x ' + Math.round(o.h * 1000) + ' mm ';
      if (o.kind === 'door') {
        if (o.w >= 1.2) return mm + 'double-leaf hardwood panel door with frame, architraves and ironmongery';
        if (/^SD/.test(o.tag)) return mm + 'steel security door with frame and ironmongery';
        return mm + 'solid core flush door with hardwood frame, architrave and ironmongery';
      }
      return mm + 'aluminium sliding window with glazing and burglar bars';
    };
    const toEntry = o => ({
      ref: o.tag, desc: descFor(o), w: o.w, h: o.h, n: o.count,
      wall: o.wall || (o.kind === 'door' ? 'int' : 'ext'), rate: rateFor(o)
    });
    return {
      doors: items.filter(i => i.kind === 'door').map(toEntry),
      windows: items.filter(i => i.kind === 'window').map(toEntry),
      pages: Array.from(new Set(items.map(i => i.page)))
    };
  }

  /* Put the drawing's own schedule into the model. The standard schedule is
     kept so it can be put back. */
  function useOpeningsFromDrawing(quiet, sheetsArg) {
    const got = openingsFromDrawing(sheetsArg);
    if (!got) return false;
    const p = state.params;
    if (!p.openStd) p.openStd = { doors: BOQ.clone(p.doors || []), windows: BOQ.clone(p.windows || []) };
    p.doors = got.doors;
    p.windows = got.windows;
    p.openSource = 'drawing';
    p.openPages = got.pages;
    state.result = recompute();
    if (!quiet) {
      toast('Doors and windows read from the drawing — ' + got.doors.length + ' door' +
        (got.doors.length === 1 ? '' : 's') + ', ' + got.windows.length + ' window' +
        (got.windows.length === 1 ? '' : 's'));
    }
    return true;
  }

  function useStandardOpenings(quiet) {
    const p = state.params;
    if (p.openStd) { p.doors = BOQ.clone(p.openStd.doors); p.windows = BOQ.clone(p.openStd.windows); }
    p.openSource = 'standard';
    state.result = recompute();
    if (quiet) { save(); return; }
    render(); save();
    toast('The standard door and window schedule is back');
  }

  function roomsReadCard() {
    const rd = state.roomRead;
    if (!rd || !rd.rooms || !rd.rooms.length) {
      /* the section stays on the page even when the sheet printed no room
         names, so it never looks as if the step has lost it */
      return `<div class="idcard rooms" id="room-read-none">
        <div>
          <span class="hint">Rooms read from the drawing — none yet: this sheet prints no room names${
            state.sheets && state.sheets.length ? ' (the text layer was read; no labels were found)' : ''}.
            Room names come from the text on a PDF sheet — a photograph or a scan carries none, so the
            schedule is typed on <b>Building model</b> or loaded from a typical layout there.</span>
        </div>
      </div>`;
    }
    // a big plan can print thirty rooms: show the first dozen and a count,
    // not a wall of chips
    const shown = rd.rooms.slice(0, 12);
    const chips = shown.map(r =>
      `<span class="rm-chip"><b>${esc(r.name)}</b>` +
      `<span class="hint">${fmt(r.L, 2)} × ${fmt(r.W, 2)} m${r.printed ? ' on the plan' : ' typical'}${r.floor > 1 ? ' · upper' : ''}</span></span>`).join('') +
      (rd.rooms.length > shown.length
        ? `<span class="rm-more">+ ${rd.rooms.length - shown.length} more — every room is listed in the room schedule</span>` : '');
    const n = rd.rooms.length;
    const plans = planSheets();
    const where = 'sheet ' + rd.page + (rd.title ? ' — ' + esc(rd.title) : '');
    const picker = plans.length > 1
      ? `<div class="row" style="gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">
           <span class="hint">Read the rooms from</span>
           <select id="room-sheet" style="max-width:360px">
             ${plans.map(s => `<option value="${s.page}"${s.page === rd.page ? ' selected' : ''}>Sheet ${s.page} — ${esc(s.title || 'floor plan')} (${roomsOfSheet(s).length} rooms)</option>`).join('')}
           </select>
         </div>` : '';
    // a sheet can carry two plans, one above the other: each is read on its own
    const floorPlans = rd.floorPlans || [];
    const floorPicker = floorPlans.length > 1
      ? `<div class="row" style="gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">
           <span class="hint">This sheet draws ${floorPlans.length} floor plans — reading</span>
           <select id="room-floor" style="max-width:340px">
             ${floorPlans.map(g => `<option value="${g.storey}"${g.storey === rd.storey ? ' selected' : ''}>${esc(g.title)} (${g.rooms} rooms)</option>`).join('')}
           </select>
           <span class="hint">— one plan's rooms, never two added together</span>
         </div>` : '';
    let warn = '';
    const storeys = Math.max(1, +state.params.storeys || 1);
    if (!isSchool() && state.params.bW && state.params.bD) {
      const total = rd.rooms.reduce((s, r) => s + r.L * r.W * (r.n || 1), 0);
      // a schedule covering several floors is checked floor by floor, not
      // against a single storey's footprint
      const floors = Math.max(1, new Set(rd.rooms.map(r => +r.floor || 1)).size);
      const foot = state.params.bW * state.params.bD;
      const perFloor = total / floors;
      if (foot > 0 && (perFloor < foot * 0.62 || perFloor > foot * 1.02)) {
        warn = `<div class="hint" style="margin-top:8px">The rooms add up to ${fmt(total, 2)} m²${floors > 1 ? ' over ' + floors + ' floors' : ''}
          on a ${fmt(foot, 2)} m² footprint per floor — check the room sizes and the overall width on this page.</div>`;
      }
      if (storeys > 1) {
        warn += `<div class="hint" style="margin-top:8px">The bill repeats this schedule on ${storeys} storeys.
          ${plans.length > 1 ? 'Read another floor above to price a different upper layout.' : ''}</div>`;
      }
    }
    return `<div class="idcard rooms">
      <div>
        <span class="hint">Rooms read from the drawing — ${where} · ${n} room${n === 1 ? '' : 's'}; names exactly as printed, sizes from the label or typical for the room. Change them on Building model.</span><br>
        <div class="rm-list">${chips}</div>
        ${picker}
        ${floorPicker}
        ${warn}
      </div>
    </div>`;
  }

  /* The floor plan cannot show the substructure or the heights. When the same
     file carries a foundation plan and sections, read the numbers printed on
     them — footing sizes and depth, plinth, ceiling and eaves — and put them
     into the model. Only runs on upload or when a sheet's role is changed, so
     a figure typed by hand is never overwritten by a re-render. */
  function applySheetNumbers(sheetsArg) {
    const sheets = Array.isArray(sheetsArg) ? sheetsArg : (state.sheets || []);
    const p = state.params;
    const notes = {}, done = [];

    const f = sheets.filter(s => s.kind === 'foundation' && s.text)[0];
    if (f) {
      const t = f.text;
      const bits = [];
      let type = p.foundType || 'strip';
      if (/raft/i.test(t)) type = 'raft';
      else if (/pad\s*(?:foot|found)|isolated\s*foot/i.test(t)) type = 'pad';
      else if (/pile/i.test(t)) type = 'pile';
      else if (/strip|footing|foundation/i.test(t)) type = 'strip';
      if (type !== p.foundType) { p.foundType = type; bits.push(type + ' foundation'); }
      const m = t.match(/(\d{2,4})\s*(?:mm)?\s*[x\u00d7]\s*(\d{2,4})\s*(?:mm)?/);
      if (m) {
        let w = +m[1], th = +m[2];
        if (w < th) { const sw = w; w = th; th = sw; }
        if (w >= 200 && w <= 2000 && th >= 100 && th <= 600) {
          p.foundW = Math.round(w / 10) / 100;
          p.foundT = Math.round(th / 10) / 100;
          bits.push('footings ' + w + ' × ' + th + ' mm');
        }
      }
      const d = t.match(/(?:depth|deep)[^\d]{0,10}(\d(?:[.,]\d+)?)\s*m/i) ||
                t.match(/(\d[.,]\d+)\s*m\s*(?:deep|depth)/i);
      if (d) {
        const v = +String(d[1]).replace(',', '.');
        if (v >= 0.5 && v <= 3.5) { p.foundDepth = v; bits.push('founded ' + v.toFixed(2) + ' m deep'); }
      }
      notes[f.page] = bits.join(' · ') || 'read — nothing to change';
      bits.forEach(b => done.push(b));
    }

    sheets.filter(s => s.kind === 'section' && s.text).slice(0, 2).forEach(sec => {
      const t = sec.text;
      const num = re => { const m = t.match(re); return m ? +String(m[1]).replace(',', '.') : null; };
      const eaves = num(/eaves?\s*(?:level|height|rl)?[^0-9+\-]{0,12}[+]?\s*(\d+(?:[.,]\d+)?)/i);
      const ceil  = num(/ceiling\s*(?:level|height|rl)?[^0-9+\-]{0,12}[+]?\s*(\d+(?:[.,]\d+)?)/i);
      const ffl   = num(/floor\s*(?:floor\s*)?level[^0-9+\-]{0,12}([+-]?\d+(?:[.,]\d+)?)/i);
      const ridge = num(/ridge\s*(?:level|height|rl)?[^0-9+\-]{0,12}[+]?\s*(\d+(?:[.,]\d+)?)/i);
      const bits = [];
      if (ffl !== null && ffl >= 0 && ffl <= 1.2) {
        p.plinth = Math.round(ffl * 100) / 100;
        bits.push('floor level ' + p.plinth.toFixed(2) + ' m');
      }
      // levels are measured from the floor level when the section gives one
      const base = (ffl !== null && ffl >= -0.2 && ffl <= 1.2) ? ffl : (+p.plinth || 0);
      if (ceil !== null && ceil >= 2.0 && ceil <= 5.5) {
        p.wallH = Math.round((ceil - base) * 100) / 100;
        bits.push('ceiling ' + ceil.toFixed(2) + ' m');
      } else if (eaves !== null && eaves >= 2.2 && eaves <= 7) {
        p.wallH = Math.round((eaves - base) * 100) / 100;
        bits.push('eaves ' + eaves.toFixed(2) + ' m');
      }
      if (eaves !== null && eaves >= 2.2 && eaves <= 7) {
        p.eavesH = eaves;
        if (bits.indexOf('eaves ' + eaves.toFixed(2) + ' m') < 0) bits.push('eaves ' + eaves.toFixed(2) + ' m');
      }
      if (ridge !== null && eaves !== null && ridge > eaves && ridge <= 15) {
        p.ridgeExtra = ridge;
        bits.push('ridge ' + ridge.toFixed(2) + ' m');
      }
      notes[sec.page] = bits.join(' · ') || 'read — nothing to change';
      bits.forEach(b => done.push(b));
    });

    sheets.forEach(s => {
      s.note = notes[s.page] || (s.kind === 'floor' && s.page === (state.pdf && state.pdf.page) ? 'measured' : '');
    });
    return done;
  }

  function currentBuildingType() {
    return (state.params.template || 'school') === 'school' ? 'educational' : (state.params.buildingType || 'domestic');
  }

  /* load the model that belongs to that building type — this is what the
     quantities, rates and bill descriptions are then built from */
  function applyBuildingType(type, evidence) {
    const tpl = type === 'educational' ? 'school' : 'general';
    // how many storeys the sheets actually show — a single-storey shop must
    // not be priced from the two-storey office layout
    const storeys = (state.sheetInfo && +state.sheetInfo.storeys > 0) ? +state.sheetInfo.storeys : 0;
    const i = (typeof Settings.presetFor === 'function') ? Settings.presetFor(type, tpl, storeys) : -1;
    if (i >= 0 && Settings.PRESETS[i]) {
      state.params = paramsFor(tpl, Settings.PRESETS[i].params);
    } else {
      const p = paramsFor(tpl, state.params);
      p.template = tpl;
      p.buildingType = type;
      state.params = p;
    }
    if (storeys && tpl === 'general') state.params.storeys = storeys;
    state.buildingRead = evidence && evidence.length
      ? { type: type, label: (BUILDINGS.find(b => b.type === type) || {}).label || type,
          evidence: evidence, score: evidence.length }
      : null;
    syncCurrency(state.params);
  }

  const buildingLabel = t => ({
    domestic: 'Domestic house', commercial: 'Commercial building', educational: 'Educational block',
    health: 'Health facility', religious: 'Place of worship'
  }[t] || 'Building');

  /* The plan library follows the building type set under "Read the drawing":
     that type's layouts come first, and the rest stay reachable at the foot
     rather than disappearing, so a layout loaded by mistake is still fixable
     without changing the type first. */
  function planLibrary() {
    const type = currentBuildingType();
    const all = (Settings.PRESETS || []).map((x, i) => ({ x: x, i: i }));
    const mine = (typeof Settings.presetsForType === 'function') ? Settings.presetsForType(type) : [];
    const mineIdx = mine.map(o => o.i);
    const rest = all.filter(o => mineIdx.indexOf(o.i) < 0);
    const opt = o => `<option value="${o.i}">${esc(o.x.label)}</option>`;
    return mine.map(opt).join('')
      + (rest.length ? `<optgroup label="Other building types">${rest.map(opt).join('')}</optgroup>` : '');
  }

  function buildingCard() {
    const read = state.buildingRead;
    /* the drawing's own reading wins over the template the session started
       from, so the line above and the dropdown below always say the same */
    const cur = (read && read.type) ? read.type : currentBuildingType();
    const opts = [['domestic', 'Domestic house'], ['commercial', 'Commercial building'],
                  ['educational', 'Educational block (GES)', ], ['health', 'Health facility'],
                  ['religious', 'Place of worship']];
    const ev = read && read.evidence && read.evidence.length
      ? ' — ' + read.evidence.join(', ') + (read.score ? '' : '') : '';
    return `<div class="idcard">
      <div>
        <span class="hint">${read ? 'Building identified from the drawing' : 'Building type'}</span><br>
        <b>${esc(read ? read.label : buildingLabel(cur))}</b>
        <span class="hint">${read ? ev : (state.sheets ? ' — set by you; the drawing does not settle it' : ' — no drawing text, so it stays as you set it')}</span>
      </div>
      <label class="hint">Change
        <select id="building-type">${opts.map(o =>
          `<option value="${o[0]}"${o[0] === cur ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></label>
    </div>`;
  }

  const SHEET_ROLES = [
    ['floor', 'Floor plan'], ['foundation', 'Foundation plan'], ['section', 'Section'],
    ['elevation', 'Elevation'], ['roof', 'Roof plan'], ['site', 'Site plan'],
    ['schedule', 'Schedule'], ['detail', 'Detail'], ['unknown', 'Ignore']
  ];
  const sheetLabel = k => (SHEET_ROLES.find(r => r[0] === k) || ['', 'Sheet'])[1];

  function sheetSummary() {
    const s = state.sheets || [];
    const n = k => s.filter(x => x.kind === k).length;
    const bits = [];
    if (n('floor')) bits.push(n('floor') + ' floor plan' + (n('floor') > 1 ? 's' : ''));
    if (n('foundation')) bits.push(n('foundation') + ' foundation');
    if (n('section')) bits.push(n('section') + ' section' + (n('section') > 1 ? 's' : ''));
    if (n('elevation')) bits.push(n('elevation') + ' elevation' + (n('elevation') > 1 ? 's' : ''));
    if (n('roof')) bits.push('roof plan');
    if (n('site')) bits.push('site plan');
    return bits.join(' · ');
  }

  // one PDF, many sheets: show what was found and which one is measured
  function pdfBar() {
    const f = state.pdf;
    if (!f) return '';
    const anyText = (state.sheets || []).some(s => s.chars > 0);
    if (!state.sheets || state.sheets.length < 2 || !anyText) {
      return f.pages <= 1
        ? `<p class="hint" style="margin:0 0 10px">Read from <b>${esc(f.name)}</b> — single-page PDF, rendered at print resolution.</p>`
        : `<div class="row" style="align-items:flex-end;gap:10px;margin:0 0 12px">
            <div class="field" style="max-width:240px;margin:0">
              <label>PDF page — ${esc(f.name)} has ${f.pages}</label>
              <select id="pdf-page">${Array.from({ length: f.pages }, (_, i) =>
                `<option value="${i + 1}"${i + 1 === f.page ? ' selected' : ''}>Page ${i + 1}</option>`).join('')}</select>
            </div>
            <span class="hint">${anyText ? 'Pick the sheet you want measured.' : 'No text layer in this PDF, so the sheets could not be identified — pick the floor plan by eye.'}</span>
          </div>`;
    }
    const rows = state.sheets.map(s => {
      const measured = s.page === f.page;
      return `<tr${measured ? ' class="on"' : ''}>
        <td class="num" style="width:44px">${s.page}</td>
        <td><b>${esc(s.title || (s.chars ? 'Untitled drawing' : 'Scanned sheet'))}</b>
          ${s.chars ? '' : ' <span class="hint">scanned</span>'}
          ${s.kind === 'floor' && s.storey > 1 ? '<span class="hint"> · upper floor</span>' : ''}
          ${s.note ? `<div class="hint" style="margin-top:2px">${esc(s.note)}</div>` : ''}</td>
        <td style="width:170px">
          <select data-sheet-role="${s.page}">${SHEET_ROLES.map(r =>
            `<option value="${r[0]}"${r[0] === s.kind ? ' selected' : ''}>${r[1]}</option>`).join('')}</select></td>
        <td class="num" style="width:110px">${measured
          ? '<span class="chip ok">measured</span>'
          : `<button class="btn sm" data-sheet-measure="${s.page}">Measure</button>`}</td>
      </tr>`;
    }).join('');
    const levels = (state.verticals && state.verticals.levels || []).length;
    return `<div class="sheet-box">
      <div class="row" style="align-items:baseline;gap:10px;margin-bottom:6px">
        <b>One file, ${state.sheets.length} sheets</b>
        <span class="hint">${esc(sheetSummary())}</span>
      </div>
      <div class="tbl-scroll" style="max-height:280px"><table class="rooms-table sheet-table">
        <thead><tr><th class="num">Sheet</th><th>Drawing</th><th>Read as</th><th class="num">Used for the bill</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      ${(state.sheetInfo && state.sheetInfo.storeys > 1 && (state.params.template || 'school') === 'school') ? `<p class="note" style="margin:8px 0 0">This set has an upper-floor plan. The GES school template is a single-storey block — switch the building type to General on the Building tab if the bill should carry the first floor.</p>` : ''}
      <p class="hint" style="margin:8px 0 0">The floor plan is measured. The foundation plan sets the footing sizes, the
        depth and the foundation type; the sections set the plinth, ceiling, eaves and ridge${
        levels ? ' and give <b>' + levels + '</b> level lines' : ''}. Change <i>Read as</i> if a title block was misread —
        the sheet is read again — then press <i>Measure</i> on the floor plan you want priced.</p>
    </div>`;
  }


  /* ---------------------------------------------------------------- step 2 */
  /* ------------------------------------------------------- digital take-off */
  /* The measuring engine lives in digital.js; it only needs a handful of
     things from here — the state, a way to save and repaint, the bill it is
     allowed to write into, and the scale the drawing was read at. */
  function digitalApi() {
    return {
      state: state,
      touch: () => save(),
      rerender: () => render(),
      toast: m => toast(m),
      result: () => state.result || recompute(),
      scaleBasis: () => scaleBasis(state.analysis),
      overrides: () => takeoffOf(),
      refresh: () => { state.result = recompute(); },
      confirm: m => window.confirm(m)
    };
  }
  function digitalStep() {
    return (window.Digital ? window.Digital.html(state, digitalApi())
      : '<section class="panel"><h2>3 · Digital take-off</h2><p class="lede">The take-off engine did not load.</p></section>');
  }
  function mountDigital() {
    const host = document.querySelector('.dt');
    if (!host || !window.Digital) return;
    try {
      window.Digital.mount(host, digitalApi());
      host.setAttribute('data-dt-mounted', '1');
    } catch (e) {
      host.setAttribute('data-dt-error', String(e && e.message || e));
      if (window.console) console.error('digital take-off:', e);
    }
  }

  /* ------------------------------------------- manhole works and drainage
     Read on step 2, under the roof plan and before the building model is
     taken off, so the run out to the tank and the chambers standing on it are
     measured off the drawing rather than assumed at the end of the bill. Both figures are typed over
     when the site says otherwise, and the route can be traced on the plan
     itself. What is applied here lands on the take-off and flows into
     Bills 14 and 15 — and every row measured off the run follows it. */
  function drainState() {
    if (!state.drain || typeof state.drain !== 'object') {
      state.drain = { run: null, chambers: null, main: 6, source: 'plan' };
    }
    if (state.drain.main == null) state.drain.main = 6;
    return state.drain;
  }

  /* the footprint the drawing is drawn at, in metres — the same numbers the
     "Plan measures" stat carries */
  function planFootprint() {
    const a = state.analysis;
    if (!a || !a.bbox) return null;
    const b = scaleBasis(a);
    if (!b.mmPerPx) return null;
    return { w: a.bbox.w * b.mmPerPx / 1000, d: a.bbox.h * b.mmPerPx / 1000, known: b.known };
  }

  /* the perimeter every drainage figure hangs on — the building the plan
     produced, measured by the same geometry the bill uses, so the run read
     here and the run priced in the bill are one number */
  function drainPerimeter() {
    try {
      const g = isSchool() ? BOQ.geometry(state.params) : GenEngine.geometry(state.params);
      const perim = isSchool() ? g.perimOuter : g.framePerimeter;
      if (+perim > 0) return { perim: +perim, from: 'model' };
    } catch (e) { /* fall through to the size on the sheet */ }
    const fp = planFootprint();
    if (fp) return { perim: 2 * (fp.w + fp.d), from: 'plan' };
    const p = state.params;
    return { perim: 2 * ((+p.overallW || +p.bW || 12) + (+p.mainD || +p.bD || 8)), from: 'size' };
  }

  /* what the card measures, and what it would cost at the bill's own rates */
  function drainRead() {
    const D = window.Drainage;
    const d = drainState();
    const fp = planFootprint();
    const P = drainPerimeter();
    const basis = d.source === 'traced' ? 'traced on the plan'
      : (P.from === 'model' ? 'half the outer perimeter' : 'half the perimeter on the sheet');
    const opt = { perimeter: P.perim, basis: basis, main: d.main };
    if (d.run != null) opt.run = d.run;
    if (d.chambers != null) opt.chambers = d.chambers;
    const m = D.measure(opt);
    const p = state.params;
    const card = (window.GenEngine && GenEngine.RATES) || {};
    /* the rate the bill carries for that row — which is the card rate after
       the overheads and profit the engine adds, an adopted build-up, or a
       rate typed over on the take-off. Falling back to the card only when
       there is no bill yet, so this table and the bill are one set of figures. */
    const inBill = k => {
      const bills = (state.result && state.result.bills) || [];
      for (let i = 0; i < bills.length; i++) {
        const it = (bills[i].items || []).find(x => x.key === k);
        if (it && it.rate) return it.rate;
      }
      return null;
    };
    const rateOf = k => {
      const b = inBill(k);
      if (b != null) return b;
      return (p.rates && p.rates[k] != null && p.rates[k] !== '') ? +p.rates[k] : (+card[k] || 0);
    };
    return { m: m, priced: D.price(m, rateOf), fp: fp, perim: P.perim, basis: basis };
  }

  /* apply the reading to the take-off: the run, the chambers and the pipe
     into the tank are corrected; everything else is measured off them */
  function applyDrainReading() {
    const D = window.Drainage;
    const r = state.result || recompute();
    const mh = (r.bills || []).find(b => /MANHOLE WORKS/i.test(b.title));
    const dr = (r.bills || []).find(b => /DRAINAGE WORKS/i.test(b.title));
    if (!mh || !dr) {
      toast('This bill carries no manhole or drainage works — switch plumbing on in Settings');
      return;
    }
    const R = drainRead();
    const TO = takeoffOf();
    const put = (bill, key, qty) => {
      const it = (bill.items || []).find(x => x.key === key);
      if (!it) return;
      const k = takeoffKey(bill, it);
      const rec = TO[k] || (TO[k] = {});
      rec.d = String(it.desc).slice(0, 40);
      rec.q = qty;
    };
    put(dr, 'pipe110', R.m.run);
    put(dr, 'pipe160', R.m.main);
    put(mh, 'mhCover', R.m.chambers);
    state.drainApplied = { run: R.m.run, chambers: R.m.chambers };
    state.result = recompute();
    render(); save();
    toast('Drainage read: ' + fmt(R.m.run, 1) + ' m run, ' + R.m.chambers + ' chambers — priced at ' +
      SYM(state.params) + ' ' + fmt(R.priced.total));
  }

  /* while the route is being clicked out on the plan: the one strip that
     carries Finish and Cancel. The reading itself lives on the Plumbing
     Layout card, so that is where the trace hands back to. */
  function drainTraceBar() {
    if (!state.drainTrace) return '';
    const n = (state.drainPts || []).length;
    return `<div class="drain-trace-bar" id="drain-trace-bar" role="status" aria-live="polite">
      <span class="drain-trace-dot" aria-hidden="true"></span>
      <div class="drain-trace-copy">
        <b>Tracing the route to the tank</b>
        <span class="hint" style="display:block">Click each corner of the drain on the plan${
          n ? ' — ' + n + ' point' + (n === 1 ? '' : 's') + ' so far' : ''}, then press Finish.
          The length is scaled off the drawing.</span>
      </div>
      <button type="button" class="btn sm primary" id="dr-finish"${n < 2 ? ' disabled' : ''}>Finish the route${
        n ? ' (' + n + ' point' + (n === 1 ? '' : 's') + ')' : ''}</button>
      <button type="button" class="btn sm" id="dr-cancel">Cancel</button>
    </div>`;
  }

  /* the traced route, measured against the scale the drawing was set at */
  function finishDrainTrace() {
    const pts = state.drainPts || [];
    const a = state.analysis;
    if (!a || pts.length < 2) { toast('Click at least two points along the drain'); return; }
    const mmPerPx = scaleBasis(a).mmPerPx;
    let px = 0;
    for (let i = 1; i < pts.length; i++) px += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const run = Math.max(0.1, Math.round(px * mmPerPx / 100) / 10);
    const d = drainState();
    d.run = run; d.chambers = null; d.source = 'traced';
    state.drainTrace = false; state.drainPts = [];
    /* the figures are read on the Plumbing Layout card: go back to it */
    const back = state.step === 2;
    if (back) { state.step = 1; render(); }
    else render();
    if (back) {
      const card = document.getElementById('grp-plumbing');
      if (card) card.scrollIntoView({ block: 'center' });
    }
    toast('Drain traced off the plan: ' + fmt(run, 1) + ' m — the run and the chambers are on the Plumbing Layout card');
  }

  function step2() {
    const a = state.analysis;
    /* What was read off the sheet's own text — the building type and the rooms —
       does not depend on the picture being there. A project whose plan image was
       lost (a browser out of storage, a sheet that would not draw) still keeps
       its rooms, so they are shown rather than hidden with the picture. */
    const readCards = `${plansSwitch()}${buildingCard()}${roomsReadCard()}${pdfBar()}`;
    const roomCount = (state.roomRead && state.roomRead.rooms) ? state.roomRead.rooms.length : 0;
    if (!state.image) {
      return `<section class="panel"><h2>2 · Read &amp; scale</h2>
        <p class="lede">Upload a plan picture first to read the walls and set the scale. The sections and
        elevations go in their own cards on <b>Upload plan</b> — they set the heights, roof pitch and
        foundation depth for the bill.${
          roomCount ? ' The ' + roomCount + ' room' + (roomCount === 1 ? '' : 's') + ' already read from the drawing are kept below.'
                    : ''}</p>
        <div class="row" style="margin:4px 0 16px">
          <button class="btn primary" data-step="1">Go to upload</button>
        </div>
        ${readCards}</section>`;
    }
    if (!a) {
      return `<section class="panel"><h2>2 · Read &amp; scale</h2>
        <p class="lede">The picture is in, but the walls could not be read from it — the sheet may be a
        tracing, a photograph taken at an angle, or a scan with no line work. Set the size and the scale
        below, or upload a clearer sheet.</p>
        <div class="row" style="gap:8px;margin:4px 0 16px">
          <button class="btn sm" id="btn-redetect">Re-read drawing</button>
          <button class="btn sm primary" data-step="1">Upload a clearer sheet</button>
        </div>
        ${readCards}</section>`;
    }
    const basis = scaleBasis(a);
    const refPx = basis.refPx;
    const mmPerPx = basis.mmPerPx;
    const baseMM = (isSchool() ? (+state.params.overallW || 0) : (+state.params.bW || 0)) * 1000;
    const widthMM = state.scaleMM || baseMM;
    const moduleMM = a.modulePx && mmPerPx ? a.modulePx * mmPerPx : null;
    const openW = state.params.overallW * 1000;
    const mode = state.scaleMode || 'assumed';
    const sh = currentSheet();
    const ratioLabel = basis.printed && mode === 'auto' ? basis.printed : (+state.ratio || 100);

    return `
    <section class="panel">
      <h2><span class="stepno">2 · </span>Read the drawing and set the scale</h2>
      <p class="lede">Detected <b>${a.hStrong.length} long horizontal lines</b> and <b>${a.vStrong.length} vertical lines</b>
      (the walls, shown in orange/yellow). Grey lines are dimension lines and other marks.</p>
      ${readCards}

      ${drainTraceBar()}

      <div class="viewer">
        <div>
          <div class="canvas-wrap ${state.pickMode ? 'picking' : ''}" id="viewer">
            <img id="plan-img" src="${state.image.dataUrl}" alt="Uploaded plan">
            <svg class="overlay" id="overlay"></svg>
            <span class="badge-corner">${a.width} × ${a.height} px</span>
          </div>
          <div class="toolbar">
            <button class="btn sm ${state.pickMode ? 'primary' : ''}" id="btn-pick">
              ${state.pickMode ? (state.picked.length === 0 ? 'Click the first point…' : 'Click the second point…') : 'Measure the reference span (2 clicks)'}</button>
            <button class="btn sm" id="btn-redetect">Re-read drawing</button>
            <span class="hint" id="pick-hint">${state.refPx && state.scaleSource === 'points' ? 'Reference measured on the plan: ' + Math.round(state.refPx) + ' px = ' + fmt(state.scaleMM, 0) + ' mm' : 'Or accept the reference span detected automatically'}</span>
          </div>
        </div>

        <div>
          <div class="field" style="margin-bottom:10px">
            <label>Scale</label>
            <select id="scale-mode">
              <option value="auto"${mode === 'auto' ? ' selected' : ''}>Printed on the drawing${basis.printed ? ' — 1:' + basis.printed : ' — none found'}</option>
              <option value="ratio"${mode === 'ratio' ? ' selected' : ''}>I will set it — paper size and ratio</option>
              <option value="known"${mode === 'known' ? ' selected' : ''}>Known dimension on the plan</option>
              <option value="assumed"${mode === 'assumed' ? ' selected' : ''}>Not shown — use the standard size</option>
            </select>
            <span class="hint">${esc(basis.basis)}</span>
          </div>

          ${mode === 'ratio' ? `<div class="grid2" style="margin-bottom:8px">
            <div class="field"><label>Sheet size</label>
              <select id="scale-paper">${PAPERS.map(pp => `<option value="${pp[0]}"${Math.abs(pp[0] - (+state.paperMM || 420)) < 2 ? ' selected' : ''}>${pp[1]} — ${pp[0]} mm</option>`).join('')}</select></div>
            <div class="field"><label>Scale 1 :</label>
              <input type="number" id="scale-ratio" min="10" max="1000" step="5" value="${+state.ratio || 100}"></div>
          </div>
          <p class="hint" style="margin:-2px 0 8px">The sheet is taken as the paper you choose: 1:${+state.ratio || 100} across ${paperName(+state.paperMM || 420)} gives the real size without any dimension being printed.</p>` : ''}

          ${mode === 'known' ? `<div class="field" style="margin-bottom:8px">
            <label>Known dimension — ${isSchool() ? 'overall length' : 'overall width'}</label>
            <div class="row" style="gap:6px">
              <input type="number" id="scale-mm" value="${Math.round(widthMM)}" min="1000" step="100" style="flex:1">
              <span class="hint">mm</span>
            </div>
            <span class="hint">The real ${isSchool() ? 'length of the whole building across the drawing (PS 1 is 18,600 mm)' : 'width of the building across the drawing'} — measure it against the reference span shown.</span>
          </div>` : ''}

          <div class="stat"><span>${basis.known ? 'Plan measures' : 'Assumed width'}</span><b>${mmPerPx
            ? (basis.known ? fmt(a.bbox.w * mmPerPx / 1000) + ' × ' + fmt(a.bbox.h * mmPerPx / 1000) + ' m'
                           : fmt(widthMM / 1000) + ' m') : '—'}</b></div>
          <div class="stat"><span>Scale</span><b>${basis.known ? '1:' + ratioLabel : 'not shown'}</b></div>
          <div class="stat"><span>Resolution</span><b>${mmPerPx ? fmt(mmPerPx, 2) + ' mm/px' : '—'}</b></div>
          <div class="stat"><span>Reference span</span><b>${Math.round(refPx)} px</b></div>
          ${isSchool() ? `<div class="stat"><span>Detected bays</span><b>${a.bays || '—'}</b></div>
          <div class="stat"><span>Bay module</span><b>${moduleMM ? fmt(moduleMM / 1000, 2) + ' m' : '—'}</b></div>` : ''}
          <div class="stat"><span>Aspect (w : h)</span><b>${fmt(a.aspect, 2)}</b></div>

          <div class="divider"></div>
          ${isSchool() ? `
          <div class="field">
            <label>Number of rooms</label>
            <input type="number" id="n-class" min="1" max="8" value="${state.params.nClassrooms}">
            <span class="hint">${a.bays ? 'The drawing suggests ' + a.bays + ' bay(s); confirm against the plan.' : 'Confirm against the drawing.'}</span>
          </div>` : `
          <div class="grid2">
            <div class="field"><label>Overall width (m)</label>
              <input type="number" data-p="bW" step="0.05" value="${fmt(state.params.bW, 2)}"></div>
            <div class="field"><label>Overall depth (m)</label>
              <input type="number" data-p="bD" step="0.05" value="${fmt(state.params.bD, 2)}"></div>
          </div>
          <span class="hint">The room schedule on the next step sets what the rooms are; these two set the size of the building round them.</span>`}
          <div class="row" style="margin-top:12px">
            <button class="btn primary" id="apply-detected">${isSchool() ? 'Apply detected layout' : 'Apply the measured size'}</button>
          </div>
          <p class="hint" style="margin-top:10px">${isSchool() ? 'Applying sets the overall sizes and room count from the picture; you can fine-tune every number on the next step.' : 'Applying sets the overall width and depth from the picture and keeps your room schedule; everything can be fine-tuned on the next step.'}</p>
        </div>
      </div>
    </section>
`;
  }

  function drawOverlay() {
    const a = state.analysis, svg = $('#overlay'), im = $('#plan-img');
    if (!a || !svg || !im) return;
    const r = im.getBoundingClientRect();
    const sx = r.width / a.width, sy = r.height / a.height;
    const parts = [];
    a.hLines.forEach(l => {
      const strong = l.coverage > 0.55;
      parts.push(`<line x1="${l.x0 != null ? l.x0 : 0}" y1="${l.pos}" x2="${a.width}" y2="${l.pos}"
        stroke="${strong ? '#f0a020' : '#b9c6bd'}" stroke-width="${strong ? 1.4 : 1}" opacity="${strong ? 0.95 : 0.5}"/>`);
    });
    a.vLines.forEach(l => {
      const strong = l.coverage > 0.45;
      parts.push(`<line x1="${l.pos}" y1="0" x2="${l.pos}" y2="${a.height}"
        stroke="${strong ? '#f0a020' : '#b9c6bd'}" stroke-width="${strong ? 1.4 : 1}" opacity="${strong ? 0.95 : 0.5}"/>`);
    });
    // bbox
    const b = a.bbox;
    parts.push(`<rect x="${b.x0}" y="${b.y0}" width="${b.w}" height="${b.h}" fill="none" stroke="#1f4e3d" stroke-dasharray="6 4" stroke-width="1.5"/>`);
    state.picked.forEach(p => {
      parts.push(`<circle cx="${p.x}" cy="${p.y}" r="5" fill="#1f4e3d" stroke="#fff" stroke-width="2"/>`);
    });
    if (state.picked.length === 2) {
      parts.push(`<line x1="${state.picked[0].x}" y1="${state.picked[0].y}" x2="${state.picked[1].x}" y2="${state.picked[1].y}" stroke="#1f4e3d" stroke-width="2" stroke-dasharray="5 3"/>`);
    }
    // the drain route traced on the plan
    const dp = state.drainPts || [];
    if (dp.length) {
      if (dp.length > 1) {
        parts.push(`<polyline points="${dp.map(q => q.x + ',' + q.y).join(' ')}" fill="none"
          stroke="#1f6fb8" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`);
      }
      dp.forEach((q, i) => {
        parts.push(`<circle cx="${q.x}" cy="${q.y}" r="${i === 0 ? 5.5 : 4}" fill="#1f6fb8" stroke="#fff" stroke-width="2"/>`);
      });
    }
    svg.setAttribute('viewBox', `0 0 ${a.width} ${a.height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.innerHTML = parts.join('');
    svg.style.width = r.width + 'px';
    svg.style.height = r.height + 'px';
    svg.style.left = (im.offsetLeft) + 'px';
    svg.style.top = (im.offsetTop) + 'px';
  }

  /* ---------------------------------------------------------------- step 3 */
  /* ---------------------------------------------------- building components
     The take-off starts here. Every element the model generates is written
     out with its size, how many and how much, beside the bill row that
     prices it — so the drawing, the model and the bill are one chain. */
  /* the name alone. The quantity box carries an aria-label, and its text is
     read out at the end of the cell — so the cell's text is cut back to the
     name the reader sees. */
  const compName = c => String(c.name).replace(/\s+qty$/, '');
  const compChips = c => [c.corrected ? 'qty' : '', c.rateEdited ? 'rate' : ''].filter(Boolean).join(' + ');

  function componentUnit(u) {
    return ({ m3: 'm³', m2: 'm²', nr: 'nr', m: 'm', kg: 'kg' }[u] || u);
  }

  const componentQtyCell = (c, opts) => {
    const live = opts && opts.live;          // an opening is a model count, not a correction
    if (!c.bill) return `<span class="c-fixed" title="No bill row of its own">${fmtQty(c.qty, c.unit)}</span>`;
    if (c.shared) {
      return `<span class="c-fixed" title="This figure is measured together with the other lines that price the same bill row — correct the row itself on the take-off sheet">${fmtQty(c.qty, c.unit)}</span>`
        + ` <span class="c-share" title="Measured together with the other lines that price ${esc(c.bill)}">with others</span>`;
    }
    const op = componentOpening(c);
    const meas = c.measured != null ? c.measured : c.qty;
    const reset = c.corrected
      ? `<button class="c-reset" type="button" data-compreset="${esc(c.bill + '|' + c.key)}" title="Put ${fmtQty(meas, c.unit)} back" aria-label="Put the measured figure back" aria-hidden="true">↺</button>`
      : `<button class="c-reset" type="button" data-compreset="${esc(c.bill + '|' + c.key)}" title="Put the measured figure back" aria-label="Put the measured figure back" hidden>↺</button>`;
    if (op) {
      return `<input class="num c-q${live ? ' live' : ''}" type="number" step="1" min="0" max="99"
          data-compopen="${op.i}" value="${op.item.n}" aria-label="Quantity of ${esc(c.name)}">
        <span class="c-unit">${componentUnit(c.unit)}</span>`;
    }
    return `<input class="num c-q${c.corrected ? ' on' : ''}" type="number" step="any" min="0"
        data-compq="${esc(c.bill + '|' + c.key)}" data-desc="${esc(String(c.desc || '').slice(0, 40))}"
        value="${c.corrected ? c.qty : ''}" placeholder="${fmtQty(meas, c.unit)}"
        aria-label="Quantity of ${esc(c.name)}">
      <span class="c-unit">${componentUnit(c.unit)}</span>${reset}`;
  };

  /* the rate, written the way the rate column of the take-off sheet is: the
     measured rate shows as the placeholder, a rate typed over it is kept in
     the same place the take-off keeps it, and it outranks the rate the
     description would otherwise have priced. */
  const componentRateCell = c => {
    if (!c.bill || c.amount == null) return `<span class="c-fixed">${c.rate != null ? fmt(c.rate) : ''}</span>`;
    const key = esc(c.bill + '|' + c.key);
    const base = c.baseRate != null ? c.baseRate : c.rate;
    return `<input class="num c-r${c.rateEdited ? ' on' : ''}" type="number" step="any" min="0"
        data-comprate="${key}" data-desc="${esc(String(c.desc || '').slice(0, 40))}"
        value="${c.rateEdited ? c.rate : ''}" placeholder="${fmt(base)}"
        aria-label="Rate for ${esc(compName(c))}">
      <button class="c-reset" type="button" data-compratereset="${key}"
        title="Put the measured rate back" aria-label="Put the measured rate back"
        aria-hidden="true"${c.rateEdited ? '' : ' hidden'}>↺</button>`;
  };

  /* the row as it stands now, without rebuilding the box being typed in */
  function refreshComponentRow(billCode, key) {
    const r = state.result;
    const list = (r && r.model && r.model.components) || [];
    const c = list.find(x => x.bill === billCode && x.key === key);
    if (!c) return;
    const tr = [...document.querySelectorAll('#components tr[data-comprow]')]
      .find(t => t.dataset.comprow === billCode + '|' + key);
    if (tr) {
      tr.classList.toggle('c-corr', !!c.corrected);
      tr.classList.toggle('c-rated', !!c.rateEdited);
      const inp = tr.querySelector('.c-q');
      if (inp) inp.classList.toggle('on', !!c.corrected);
      const chip = tr.querySelector('.c-chip');
      if (chip) { chip.hidden = !c.corrected && !c.rateEdited; chip.textContent = compChips(c); }
      const reset = tr.querySelector('[data-compreset]');
      if (reset) {
        reset.hidden = !c.corrected;
        if (reset.title) reset.title = 'Put ' + fmtQty(c.measured != null ? c.measured : c.qty, c.unit) + ' back';
      }
      const rin = tr.querySelector('.c-r');
      if (rin) {
        const base = c.baseRate != null ? c.baseRate : c.rate;
        rin.classList.toggle('on', !!c.rateEdited);
        rin.placeholder = c.amount == null ? '' : fmt(base);
        if (document.activeElement !== rin) rin.value = c.rateEdited ? c.rate : '';
      }
      const rreset = tr.querySelector('[data-compratereset]');
      if (rreset) rreset.hidden = !c.rateEdited;
      const amt = tr.querySelector('.c-amount');
      if (amt) amt.textContent = c.amount != null ? fmt(c.amount) : '';
    }
    const tot = document.getElementById('comp-totals');
    if (tot) {
      tot.innerHTML = 'Priced works <b>' + fmt(pricedAmount(r)) + '</b> '
        + '<span class="c-sep">·</span> Grand total <b>' + fmt(r.grand) + '</b>';
    }
    const pill = document.querySelector('#components .c-pill');
    if (pill) {
      const nCorr = list.filter(x => x.corrected).length;
      const nRate = list.filter(x => x.rateEdited).length;
      const noBill = list.filter(x => !x.bill || x.shared).length;
      pill.innerHTML = list.length + ' components · ' + (list.length - noBill)
        + ' with a figure you can change' + (nCorr ? ' · <b>' + nCorr + ' corrected</b>' : '')
        + (nRate ? ' · <b>' + nRate + ' re-rated</b>' : '');
    }
  }

  /* ------------------------------------------------ the size of a component
     The size column is not a caption: where the model has a dimension behind
     it, the schedule carries the box that dimension lives in, and the measure
     above reads the very same field. */
  function dimValue(id, scale) {
    let raw;
    const m = /^open:(door|window):(\d+):(w|h)$/.exec(id);
    if (m) {
      const list = m[1] === 'door' ? (state.params.doors || []) : (state.params.windows || []);
      raw = list[+m[2]] ? list[+m[2]][m[3]] : null;
    } else {
      raw = state.params[id];
      if (raw == null && typeof BOQ !== 'undefined' && BOQ.DEFAULT_PARAMS) raw = BOQ.DEFAULT_PARAMS[id];
    }
    if (raw == null || raw === '') return '';
    return String(Math.round((+raw) * (scale || 1) * 1000) / 1000);
  }

  const componentDim = d => `<input class="num c-dim" type="number"
      data-compdim="${esc(d.dim)}" data-scale="${d.scale || 1}"
      min="${d.min}" max="${d.max}" step="${d.step}"
      value="${dimValue(d.dim, d.scale)}" aria-label="${esc(d.label || d.dim)}">`;

  const componentSizeHtml = c => Array.isArray(c.size)
    ? c.size.map(x => (typeof x === 'string' ? `<span class="c-txt">${esc(x)}</span>` : componentDim(x))).join('')
    : esc(c.size);

  const componentSizeText = c => Array.isArray(c.size)
    ? c.size.map(x => (typeof x === 'string' ? x : dimValue(x.dim, x.scale))).join('')
    : String(c.size);

  /* the count column: a number of things where the model owns one */
  function countValue(id) {
    const m = /^open:(door|window):(\d+)$/.exec(id);
    if (m) {
      const list = m[1] === 'door' ? (state.params.doors || []) : (state.params.windows || []);
      return list[+m[2]] ? String(+list[+m[2]].n || 0) : '';
    }
    const v = state.params[id];
    return v == null || +v <= 0 ? '' : String(Math.round(+v));
  }

  const componentCountHtml = c => {
    if (!c.countParam) return esc(c.count || '');
    return `<input class="num c-c" type="number" min="0" max="999" step="1"
        data-compcount="${esc(c.countParam)}" value="${countValue(c.countParam)}"
        placeholder="${c.countAuto != null ? c.countAuto : ''}"
        aria-label="How many — ${esc(compName(c))}"> <span class="c-unit">No.</span>`;
  };

  /* every dimension or count typed on the schedule re-measures the whole
     model — the bill, the take-off and the totals follow it */
  function rerenderModel() {
    const y = window.scrollY;
    state.result = recompute();
    renderSide();
    render();
    window.scrollTo(0, y);
    save();
  }

  /* ------------------------------------------------ searching the components
     A filter over the rows already drawn: the trade headings come with a row,
     the headings that lose every row go away, and the count says how much of
     the schedule is left. Typing in a size box re-draws the step, so the
     search is kept in the app's own state and put back on every draw. */
  function filterComponents(q) {
    const host = document.getElementById('components');
    if (!host) return;
    const term = String(q == null ? '' : q).trim().toLowerCase();
    const rows = Array.from(host.querySelectorAll('tr[data-comprow]'));
    let shown = 0;
    rows.forEach(tr => {
      /* what a reader would search by: the name, the size, how many, the bill.
         The rate and the amount are money, not identity — they stay out, so a
         search for a size does not answer with a total. */
      const cell = n => (tr.children[n] ? tr.children[n].textContent || '' : '');
      const typed = tr.children[1] ? Array.from(tr.children[1].querySelectorAll('input')).map(i => i.value).join(' ') : '';
      let group = '';
      let up = tr.previousElementSibling;
      while (up && !up.classList.contains('c-group')) up = up.previousElementSibling;
      if (up) group = up.textContent || '';
      const text = [cell(0), cell(1), typed, cell(2), cell(3), cell(7), group, tr.dataset.comprow || ''].join(' ');
      const ok = !term || text.toLowerCase().indexOf(term) >= 0;
      tr.hidden = !ok;
      if (ok) shown++;
    });
    host.querySelectorAll('tr.c-group').forEach(g => {
      let sib = g.nextElementSibling, any = false;
      while (sib && !sib.classList.contains('c-group')) {
        if (sib.hasAttribute('data-comprow') && !sib.hidden) { any = true; break; }
        sib = sib.nextElementSibling;
      }
      g.hidden = !any;
    });
    const out = document.getElementById('comp-shown');
    if (out) {
      out.textContent = !term ? '' : (shown
        ? shown + ' of ' + rows.length + ' component' + (rows.length === 1 ? '' : 's')
        : 'Nothing matches “' + String(q).trim() + '”');
      out.classList.toggle('none', !!term && !shown);
    }
    const clear = document.getElementById('comp-search-clear');
    if (clear) clear.hidden = !term;
  }

  /* ---- which wall a component is measured in ---------------------------
     The doors and windows schedule asks the question of every opening, and
     the answer moves the wall it is deducted from. The component list asks
     the same question of every element: for an opening the answer is a
     decision, and the select here writes the very same field as the schedule
     below it; for the walls, the plaster and the render it is what the model
     measures, and it is said plainly rather than left to be guessed. */
  const WALL_OF = {
    'External walls': 'ext',
    'Internal walls': 'int',
    'Balustrade wall': 'ext',
    'Blocks': 'both',
    'Foundation wall': 'both',
    'Ring beam': 'both',
    'Lintels': 'both',
    'Plaster to internal walls': 'int',
    'Render to external walls': 'ext',
    'Wall tiling': 'int',
    'Paint internal': 'int',
    'Paint external': 'ext'
  };

  function compWallHtml(c, p) {
    const m = /^(door|window):(.+)$/.exec(String(c.key || ''));
    if (m) {
      const list = [].concat(p.doors || [], p.windows || []);
      const i = list.findIndex(o => o && o.ref === m[2]);
      if (i >= 0) {
        const w = list[i].wall === 'int' ? 'int' : 'ext';
        return `<select class="c-wallsel" data-open-wall="${i}" aria-label="The wall ${esc(c.name)} sits in">
            <option value="ext"${w === 'ext' ? ' selected' : ''}>external</option>
            <option value="int"${w === 'int' ? ' selected' : ''}>internal</option>
          </select>`;
      }
    }
    const w = WALL_OF[c.name];
    if (!w) return `<span class="c-wall none" title="Not wall work">\u2014</span>`;
    const label = w === 'both' ? 'both walls' : (w === 'ext' ? 'external' : 'internal');
    return `<span class="c-wall ${w}" title="${w === 'both' ? 'measured in the external and the internal walls' : 'measured in the ' + label + ' wall'}">${label}</span>`;
  }

  function componentsPanel(r) {
    const list = (r.model && r.model.components) || [];
    if (!list.length) return '';
    const p = state.params;
    const order = ['Substructure', 'Frame', 'Walling', 'Roof', 'Doors & windows', 'Finishes', 'External works', 'Drainage'];
    const unit = u => ({ m3: 'm³', m2: 'm²', nr: 'nr', m: 'm', kg: 'kg' }[u] || u);
    const groups = order.filter(g => list.some(c => c.group === g))
      .concat(list.map(c => c.group).filter((g, i, a) => a.indexOf(g) === i && order.indexOf(g) < 0));
    const priced = list.filter(c => c.bill).length;
    const corrected = list.filter(c => c.corrected).length;
    const rerated = list.filter(c => c.rateEdited).length;
    const editable = list.filter(c => c.bill && !c.shared).length;

    const rows = groups.map(g => {
      const items = list.filter(c => c.group === g);
      const head = `<tr class="c-group"><td colspan="8">${esc(g)}
        <span>· ${items.length} component${items.length === 1 ? '' : 's'} · ${items.filter(c => c.bill).length} priced</span></td></tr>`;
      return head + items.map(c => `
        <tr data-comprow="${esc(c.bill + '|' + c.key)}"${c.corrected ? ' class="c-corr"' : ''}>
          <td><b>${compName(c)}</b> <span class="to-mark c-chip"${(c.corrected || c.rateEdited) ? '' : ' hidden'}>${compChips(c)}</span></td>
          <td class="c-how">${componentSizeHtml(c)}</td>
          <td class="c-wallcell">${compWallHtml(c, p)}</td>
          <td class="num c-count">${componentCountHtml(c)}</td>
          <td class="num c-qcell${c.shared ? ' c-shared' : ''}">${componentQtyCell(c, { live: true })}</td>
          <td class="num c-rate">${componentRateCell(c)}</td>
          <td class="num c-amount">${c.amount != null ? fmt(c.amount) : ''}</td>
          <td>${c.bill ? `<span class="c-bill">${esc(c.bill)}</span>` : '<span class="c-bill none">not priced</span>'}</td>
        </tr>`).join('');
    }).join('');

    return `
    <section class="panel" id="components">
      <div class="row" style="justify-content:space-between;align-items:center;gap:12px">
        <h2 style="margin:0">Building components</h2>
        <span class="c-pill">${list.length} components · ${editable} with a figure you can change${corrected ? ' · <b>' + corrected + ' corrected</b>' : ''}${rerated ? ' · <b>' + rerated + ' re-rated</b>' : ''}</span>
      </div>
      <p class="lede">Every element the model makes, written out for the take-off — its size, how many,
        how much, and the bill row that prices it. <b>The size boxes and the counts are the model's own
        dimensions:</b> change one and the measure, the bill and every total follow. <b>A quantity or a
        rate typed on any row</b> re-prices it too, and ↺ puts the measured figure back.
        <b>In wall</b> says where the work sits — on a door or window the cell is a dropdown, and
        switching it moves the opening, its walling and its plaster with it.</p>

      <div class="c-tools">
        <label class="c-search">
          <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="8.6" cy="8.6" r="5.4" fill="none" stroke="currentColor" stroke-width="1.7"/>
            <path d="M12.8 12.8 L17 17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
          </svg>
          <input type="text" id="comp-search" autocomplete="off" spellcheck="false"
            placeholder="Search the components — a name, a size, a bill"
            value="${esc(state.compSearch || '')}" aria-label="Search the building components">
          <button type="button" class="c-search-clear" id="comp-search-clear"
            aria-label="Clear the search"${state.compSearch ? '' : ' hidden'}>×</button>
        </label>
        <span class="c-shown" id="comp-shown" role="status" aria-live="polite"></span>
      </div>

      ${(p.template || 'school') === 'school' ? '' : `
      <p class="hint" style="margin:14px 0 4px">The frame is measured from the storeys, the wall height and the plan
        size set above — a column at every 3.5 m of the frame, a ring beam at each floor.</p>`}

      <div class="tbl-scroll" style="max-height:560px"><table class="comp-tbl">
        <thead><tr><th>Component</th><th>Size and how it is measured</th>
          <th style="width:96px">In wall</th><th class="num">Count</th>
          <th class="num" style="width:132px">Quantity</th><th class="num" style="width:78px">Rate</th>
          <th class="num" style="width:104px">Amount</th><th>Prices into</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>

      <div class="row" style="justify-content:space-between;align-items:center;margin-top:12px;gap:12px;flex-wrap:wrap">
        <span class="hint">Electrical and plumbing are lump sums in Bills 11–12, so they are not broken into components.</span>
        <span class="c-totals" id="comp-totals">Priced works <b>${fmt(pricedAmount(r))}</b>
          <span class="c-sep">·</span> Grand total <b>${fmt(r.grand)}</b></span>
        <button class="btn primary" data-step="5">Take these to the take-off →</button>
      </div>
    </section>`;
  }

  /* what the component rows themselves add up to, before preliminaries and
     contingency — the number that moves as a figure is typed */
  function pricedAmount(r) {
    const list = (r.model && r.model.components) || [];
    const seen = {};
    return list.reduce((t, c) => {
      if (!c.bill || c.amount == null) return t;
      const k = c.bill + '|' + c.key;
      if (seen[k]) return t;                       // a row shared by several lines counts once
      seen[k] = 1;
      return t + (+c.amount || 0);
    }, 0);
  }

  function step3() {
    const p = state.params;
    const r = recompute();
    const g = r.model.g;

    if (!isSchool()) {
      return `
      ${roofModelPanel()}
      ${Settings.roomsPanel(state, r)}
      ${Settings.finishesPanel ? Settings.finishesPanel(state) : ''}
      ${componentsPanel(r)}
      ${step3Joinery(r)}
      ${step3Basis(r)}
      <section class="panel">
        <div class="row" style="justify-content:space-between">
          <span class="hint">Gross floor area ${fmt(r.GFA)} m² · ${g.footprint.toFixed(2)} m² footprint · ${p.storeys || 1} storey(s)</span>
          <button class="btn primary" data-step="5">Take off the quantities →</button>
        </div>
      </section>`;
    }
    // the same finish lists the general engine and the settings use
    const FT = (typeof GenEngine !== 'undefined' && GenEngine.FLOOR_FINISH) || {};
    const CT = (typeof GenEngine !== 'undefined' && GenEngine.CEILING_FINISH) || {};
    const opt = (table, val, keys) => (keys || Object.keys(table)).filter(k => table[k])
      .map(k => `<option value="${k}"${k === val ? ' selected' : ''}>${esc(table[k].label)}</option>`).join('');
    const rooms = g.rooms.map(room => `
      <tr>
        <td>${esc(room.name)}</td>
        <td class="num">${fmt(room.L)}</td>
        <td class="num">${fmt(room.W)}</td>
        <td class="num">${fmt(room.L * room.W)}</td>
        <td>${room.type}</td>
      </tr>`).join('');

    const openRows = [...p.doors, ...p.windows].map((o, i) => `
      <tr>
        <td><b>${esc(o.ref)}</b></td>
        <td>${esc(o.desc.replace(/^[A-Z]\d - /, ''))}</td>
        <td class="num">${fmt(o.w * 1000, 0)} × ${fmt(o.h * 1000, 0)}</td>
        <td><input class="num" data-open="${i}" type="number" min="0" max="40" value="${o.n}" style="width:64px;text-align:right;border:1px solid var(--line);border-radius:6px;padding:3px 6px"></td>
        <td class="num">${esc(o.wall)}</td>
      </tr>`).join('');

    return `
    <section class="panel">
      <h2><span class="stepno">4 · </span>Building model</h2>
      <p class="lede">Everything below drives the quantities. Change a number and the bill re-measures instantly.</p>

      <div class="grid3">
        <div class="field"><label>Rooms</label><input type="number" data-p="nClassrooms" min="1" max="8" value="${p.nClassrooms}"></div>
        <div class="field"><label>Room width (m)</label><input type="number" data-p="crW" step="0.1" value="${p.crW}"></div>
        <div class="field"><label>Room depth (m)</label><input type="number" data-p="crD" step="0.1" value="${p.crD}"></div>
        <div class="field"><label>Verandah depth (m)</label><input type="number" data-p="verD" step="0.1" value="${p.verD}"></div>
        <div class="field"><label>Office width (m)</label><input type="number" data-p="officeW" step="0.1" value="${p.officeW}"></div>
        <div class="field"><label>Office depth (m)</label><input type="number" data-p="officeD" step="0.1" value="${p.officeD}"></div>
        <div class="field"><label>WC depth (m)</label><input type="number" data-p="wcD" step="0.1" value="${p.wcD}"></div>
        <div class="field"><label>Office verandah width (m)</label><input type="number" data-p="offVerW" step="0.1" value="${p.offVerW}"></div>
        <div class="field"><label>Wall thickness (m)</label><input type="number" data-p="wallT" step="0.025" value="${p.wallT}"></div>
        <div class="field"><label>Wall height (m)</label><input type="number" data-p="wallH" step="0.1" value="${p.wallH}"></div>
        <div class="field"><label>Roof pitch (degrees)</label><input type="number" data-p="roofPitch" step="1" value="${p.roofPitch}"></div>
        <div class="field"><label>Eaves overhang (m)</label><input type="number" data-p="overhang" step="0.1" value="${p.overhang}"></div>
      </div>

      <div class="divider"></div>
      <div class="grid3">
        <div class="field"><label>Overall width override</label>
          <input type="number" data-p="overallW" step="0.05" value="${p.overallW}" ${p.autoFit ? 'disabled' : ''}></div>
        <div class="field"><label>Main block depth</label>
          <input type="number" data-p="mainD" step="0.05" value="${p.mainD}" ${p.autoFit ? 'disabled' : ''}></div>
        <div class="field"><label>Wing width</label>
          <input type="number" data-p="wingW" step="0.05" value="${p.wingW}" ${p.autoFit ? 'disabled' : ''}></div>
        <div class="field"><label>Wing depth</label>
          <input type="number" data-p="wingD" step="0.05" value="${p.wingD}" ${p.autoFit ? 'disabled' : ''}></div>
        <div class="field"><label>Fit overall to rooms</label>
          <select data-p="autoFit"><option value="false" ${!p.autoFit ? 'selected' : ''}>No — use the values above</option>
          <option value="true" ${p.autoFit ? 'selected' : ''}>Yes — derive from room sizes</option></select></div>
        <div class="field"><label>Office wing</label>
          <select data-p="officeOn"><option value="true" ${p.officeOn ? 'selected' : ''}>Included</option>
          <option value="false" ${!p.officeOn ? 'selected' : ''}>Not included</option></select></div>
      </div>

      <div class="divider"></div>
      <div class="row" style="align-items:flex-end;gap:10px;flex-wrap:wrap">
        <div class="field" style="min-width:260px"><label>Standard plan library</label>
          <select id="preset">${planLibrary()}</select>
        </div>
        <button class="btn" id="btn-preset">Load this plan</button>
        <span class="hint">${esc(buildingLabel(currentBuildingType()))} layouts first — the other building types are at
          the foot of the list. A layout brings the room sizes and openings with it.</span>
      </div>

      <div class="divider"></div>
      <div class="grid3">
        <div class="field"><label>Floor finish — rooms and office</label>
          <select data-p="floorFinish">${opt(FT, p.floorFinish || 'terrazzo')}</select></div>
        <div class="field"><label>Floor finish — wet areas</label>
          <select data-p="floorWet">${opt(FT, p.floorWet || 'tiles', ['tiles', 'porcelain', 'terrazzo', 'granite', 'epoxy'])}</select></div>
        <div class="field"><label>Ceiling</label>
          <select data-p="ceilingType">${opt(CT, p.ceilingType || 'pvc')}</select></div>
        <div class="field"><label>Contingency (%)</label><input type="number" data-p="contingency" step="0.5" min="0" max="25" value="${p.contingency}"></div>
      </div>
    </section>

    ${roofModelPanel()}

    <section class="panel">
      <h2>Accommodation schedule</h2>
      <p class="lede">Derived from the model above · gross floor area <b>${fmt(g.GFA)} m²</b></p>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Room</th><th class="num">Length (m)</th><th class="num">Width (m)</th><th class="num">Area (m²)</th><th>Type</th></tr></thead>
        <tbody>${rooms}</tbody>
        <tfoot><tr><td colspan="3">Gross floor area</td><td class="num">${fmt(g.GFA)}</td><td></td></tr></tfoot>
      </table></div>
      <div class="grid3" style="margin-top:12px">
        <div class="stat"><span>Footprint</span><b>${fmt(g.footprint)} m²</b></div>
        <div class="stat"><span>Perimeter (outer)</span><b>${fmt(g.perimOuter)} m</b></div>
        <div class="stat"><span>Roof area</span><b>${fmt(g.roofArea)} m²</b></div>
      </div>
    </section>

    ${componentsPanel(r)}

    ${step3Joinery(r)}
    <section class="panel">
      <div class="row" style="justify-content:space-between">
        <span class="hint">Gross floor area ${fmt(r.GFA)} m² · ${g.footprint.toFixed(2)} m² footprint</span>
        <button class="btn primary" data-step="5">Take off the quantities →</button>
      </div>
    </section>`;
  }

  function step3Joinery(r) {
    const p = state.params;
    const list = [...p.doors, ...p.windows];
    const openArea = list.reduce((s, o) => s + o.w * o.h * o.n, 0);
    const fromDrawing = p.openSource === 'drawing';
    const tall = list.length && state.analysis
      ? (2 * (+p.bW + +p.bD) * (+p.wallH || 2.85) * Math.max(1, +p.storeys || 1)) : 0;
    const heavy = tall > 0 && openArea > tall * 0.45;
    const openRows = list.map((o, i) => `
      <tr>
        <td><b>${esc(o.ref)}</b></td>
        <td>${esc(String(o.desc || '').replace(/^[A-Z]{1,2}\d+ - /, ''))}</td>
        <td class="num">${fmt(o.w * 1000, 0)} × ${fmt(o.h * 1000, 0)}</td>
        <td><input class="num" data-open="${i}" type="number" min="0" max="60" value="${o.n}" style="width:64px;text-align:right;border:1px solid var(--line);border-radius:6px;padding:3px 6px"></td>
        <td>
          <select data-open-wall="${i}" style="border:1px solid var(--line);border-radius:6px;padding:3px 6px">
            <option value="ext"${o.wall === 'ext' ? ' selected' : ''}>external</option>
            <option value="int"${o.wall === 'int' ? ' selected' : ''}>internal</option>
          </select>
        </td>
      </tr>`).join('');
    return `
    <section class="panel">
      <h2>Doors &amp; windows</h2>
      <p class="lede">The schedule is read from the drawing where the drawing prints one: the size from any
      <b>D1 / W2</b> tag with its dimensions, the number from “6 No.” in a schedule or from how often the tag
      is drawn on the floor plans. Every figure here can be typed over.</p>
      <div class="grid3" style="margin-bottom:10px">
        <div class="stat"><span>Openings</span><b>${list.length}</b></div>
        <div class="stat"><span>Wall area deducted</span><b>${fmt(openArea, 2)} m²</b></div>
        <div class="stat"><span>Source</span><b>${fromDrawing ? 'read from the drawing' : 'standard schedule'}</b>${
          fromDrawing && p.openPages && p.openPages.length
            ? `<span class="hint">from sheet ${p.openPages.join(', ')}</span>` : ''}</div>
      </div>
      ${heavy ? `<div class="note" style="background:#fff6e0;border-color:#f0d9a8;padding:8px 12px;border-radius:8px;margin-bottom:10px">
          ${fmt(openArea, 2)} m² of openings against ${fmt(tall, 2)} m² of wall is a lot — check that
          window and door tags are not being counted twice (a schedule table on the same sheet as the plan).
        </div>` : ''}
      <div class="row no-print" style="gap:8px;margin-bottom:10px">
        <button class="btn sm" id="btn-open-read"${state.sheets ? '' : ' disabled'}>Read from the drawing</button>
        <button class="btn sm" id="btn-open-standard"${p.openStd ? '' : ' disabled'}>Standard schedule</button>
        <span class="hint">${state.sheets ? 'Sizes and tags come from the sheet text; the drawing steps read it again.' : 'Upload a PDF with a text layer to read a schedule, or edit the rows below.'}</span>
      </div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Ref</th><th>Description</th><th class="num">Size (mm)</th><th class="num">No.</th><th>In wall</th></tr></thead>
        <tbody>${openRows}</tbody>
        <tfoot><tr><td colspan="3">Total openings</td><td class="num" colspan="2">${list.length} items · ${fmt(openArea, 2)} m²</td></tr></tfoot>
      </table></div>
    </section>`;
  }

  function step3Basis(r) {
    const p = state.params;
    const rows = (r.basis || []).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${esc(v)}</td></tr>`).join('');
    return `
    <section class="panel">
      <h2>Basis of the bill</h2>
      <p class="lede">Taken from the plan, the sections and the settings.</p>
      <div class="grid2">
        <table><tbody>${rows || '<tr><td class="hint">Set the building type in Settings.</td></tr>'}</tbody></table>
        <div>
          <div class="stat"><span>Gross floor area</span><b>${fmt(r.GFA)} m²</b></div>
          <div class="stat"><span>Footprint</span><b>${r.model.g.footprint.toFixed(2)} m²</b></div>
          <div class="stat"><span>Roof area</span><b>${r.model.g.roofArea.toFixed(2)} m²</b></div>
          <div class="stat"><span>Blockwork</span><b>${r.model.blockTotal.toFixed(2)} m²</b></div>
          <div class="stat"><span>Concrete</span><b>${r.model.concTotal.toFixed(2)} m³</b></div>
          <div class="stat"><span>Reinforcement</span><b>${Math.round(r.model.rebar).toLocaleString()} kg</b></div>
        </div>
      </div>
    </section>`;
  }

  /* ---------------------------------------------------------------- step 4 */
  function boqTable(bill) {
    const rows = bill.items.map((it, i) => `
      <tr data-bill="${bill.code}" data-item="${i}">
        <td style="width:38px">${String(i + 1).padStart(2, '0')}</td>
        <td>${esc(it.desc)}${(it.corrected || it.rateEdited || it.rateFromDesc) ? ' <span class="to-mark">take-off</span>' : ''}</td>
        <td style="width:52px;text-align:center">${esc(it.unit)}</td>
        <td class="num" style="width:92px">${fmtQty(it.qty, it.unit)}</td>
        <td class="num" style="width:112px">
          <input class="rate-input" data-bill="${bill.code}" data-item="${i}" type="number" step="10" min="0" value="${it.rate}">
          <span class="rate-text">${fmt(it.rate)}</span>
        </td>
        <td class="num" style="width:112px" data-amount>${fmt(it.amount)}</td>
      </tr>`).join('');
    return `
      <div class="bill-block">
        <div class="bill-head">${esc(bill.code)}: ${esc(bill.title)}</div>
        <table class="bill-table">
          <thead><tr><th>Item</th><th>Description of work</th><th style="text-align:center">Unit</th><th class="num">Qty</th><th class="num">Rate (${SYM(state.params)})</th><th class="num">Amount (${SYM(state.params)})</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="5" style="text-align:right">Total carried to Summary — ${esc(bill.code)}</td>
            <td class="num" data-bill-total="${esc(bill.code)}">${fmt(bill.total)}</td></tr></tfoot>
        </table>
      </div>`;
  }

  /* ---------------------------------------------------------------- step 4 */
  /* The take-off sheet. It lists what the model measured, bill by bill, and
     takes a corrected figure where the drawing says otherwise. */
  /* the six work sections a bill is measured and priced in */
  const TO_SECTIONS = [
    { name: 'Preliminaries and General Items', test: /PRELIMINAR|GENERAL ITEMS/i },
    { name: 'Substructure', test: /SUBSTRUCTURE|FOUNDATION|GROUND FLOOR SLAB|EXCAVAT|HARDCORE/i },
    { name: 'Superstructure', test: /SUPERSTRUCTURE|FRAME|WALLING|BLOCKWORK|ROOF|CEILING|DOOR|WINDOW|JOINERY|STAIRCASE|STEEL|CONCRETE/i },
    { name: 'Finishes', test: /FINISH|PAINT|DECORAT|SCREED|TERRAZZO|TILING|SKIRTING/i },
    { name: 'Services', test: /SERVICES|ELECTRIC|PLUMB|SANITARY|MECHANICAL|WATER/i },
    { name: 'External Works', test: /EXTERNAL|ANCILLAR|BOUNDARY|LANDSCAP|APRON|DRAIN CHANNEL/i },
    /* the chambers and the run out to the tank are their own section, so the
       two bills sit together and keep their bill order after the external works */
    { name: 'Drainage', test: /MANHOLE|DRAINAGE WORKS|SEWER|SOAKAWAY/i }
  ];

  function takeoffSection(title) {
    const t = String(title || '');
    for (const sec of TO_SECTIONS) if (sec.test.test(t)) return sec.name;
    return 'Other works';
  }

  /* a row whose figure the model works out for itself — the preliminaries
     balancing item — is shown but not typed over */
  const takeoffDerived = it => /^Additional preliminaries/i.test(String(it.desc));

  /* the units a measured item can be billed in; a rarer unit the model used
     is kept in the list so the row shows what it was measured in */
  const TO_UNITS = ['m2', 'm3', 'm', 'kg', 't', 'No.', 'Item', 'L', 'day', 'bag', 'sheet', 'drum', 'box', 'set'];
  const TO_UNIT_LABEL = { m2: 'm²', m3: 'm³', m: 'm', kg: 'kg', t: 't', 'No.': 'No.', Item: 'Item',
    L: 'L', day: 'day', bag: 'bag', sheet: 'sheet', drum: 'drum', box: 'box', set: 'set' };
  function toUnitOptions(cur) {
    const list = TO_UNITS.slice();
    if (cur && list.indexOf(cur) < 0) list.push(cur);
    return list.map(u => '<option value="' + esc(u) + '"' + (u === cur ? ' selected' : '') + '>' +
      esc(TO_UNIT_LABEL[u] || u) + '</option>').join('');
  }

  function step4Takeoff() {
    const r = recompute();
    const p = state.params;
    const bills = r.bills || [];
    const m = r.model || {};
    const g = m.g || {};

    let nItems = 0, nCorr = 0, nRate = 0, nText = 0, nZero = 0;
    bills.forEach(b => b.items.forEach(it => {
      nItems++;
      if (it.corrected) nCorr++;
      if (it.rateEdited) nRate++;
      if (it.descEdited || it.unitEdited) nText++;
      if (!(it.qty > 0)) nZero++;
    }));
    const nTouched = bills.reduce((n, b) => n + b.items.filter(it => it.corrected || it.rateEdited || it.descEdited || it.unitEdited).length, 0);
    const addsAll = p.takeoffAdd || {}, delsAll = p.takeoffDel || {};
    const nAdded = Object.keys(addsAll).reduce((n, k) => n + (addsAll[k] || []).length, 0);
    const nRemoved = Object.keys(delsAll).reduce((n, k) => n + (delsAll[k] || []).length, 0);

    /* checks the sheet makes on its own — ok, worth a look, or wrong */
    const checks = [];
    const add = (level, label, value, note) => checks.push({ level: level, label: label, value: value, note: note });
    const openings = [...(p.doors || []), ...(p.windows || [])]
      .reduce((t, o) => t + (+o.w || 0) * (+o.h || 0) * (+o.n || 0), 0);
    const walls = (+m.extGross || 0) + (+m.intGross || 0);
    if (walls > 0) {
      const share = openings / walls;
      add(share <= 0.45 ? 'ok' : 'bad', 'Openings taken out of the walls',
        fmt(openings) + ' m² in ' + fmt(walls) + ' m² wall',
        share <= 0.45
          ? 'every door and window is deducted from the wall it sits in, and its own area is priced again in the joinery'
          : 'openings are ' + Math.round(share * 100) + ' % of the wall — check the door and window schedule for a double count');
    }
    if (p.rooms && p.rooms.length && g.footprint > 0) {
      const roomArea = p.rooms.reduce((t, x) => t + (+x.L || 0) * (+x.W || 0) * (+x.n || 1), 0);
      const limit = g.footprint * Math.max(1, +p.storeys || 1);
      const share = roomArea / limit;
      add(share > 1.05 ? 'bad' : (share < 0.45 ? 'warn' : 'ok'), 'Rooms inside the building',
        fmt(roomArea) + ' m² of rooms in ' + fmt(limit) + ' m² of building',
        share > 1.05
          ? 'the rooms add up to more than the building — check the room sizes and the number of floors'
          : (share < 0.45
            ? 'the schedule names ' + Math.round(share * 100) + ' % of the floor area: finishes are measured from the rooms, so add the rooms that are missing'
            : 'the room schedule fills the building, and its finishes are measured from it'));
    }
    if (m.blockTotal > 0 && m.blocks > 0) {
      const per = m.blocks / m.blockTotal;
      add(per > 8 && per < 13 ? 'ok' : 'bad', 'Blocks per m² of wall', fmt(per, 2) + ' blocks/m²',
        per > 8 && per < 13
          ? 'a 450 × 225 mm block with 10 mm joints takes 9.25 to the square metre; 9.71 is bought, the rest is wastage'
          : 'the block count and the wall area disagree — check the wall height and thickness');
    }
    if (m.concTotal > 0 && r.GFA > 0) {
      const per = m.concTotal / r.GFA;
      add(per > 0.08 && per < 0.75 ? 'ok' : 'warn', 'Concrete per m² of floor', fmt(per, 3) + ' m³/m²',
        per > 0.08 && per < 0.75
          ? 'foundations, columns, beams, lintels and slabs add up to a normal frame'
          : 'an unusual amount of concrete for the floor area — check the foundation depth and the frame');
    }
    if (m.concTotal > 0 && m.rebar > 0) {
      const per = m.rebar / m.concTotal;
      add(per > 30 && per < 220 ? 'ok' : 'warn', 'Reinforcement per m³ of concrete', fmt(per, 0) + ' kg/m³',
        per > 30 && per < 220 ? 'normal for a framed building'
                              : 'the steel and the concrete disagree — check the sizes on the structural drawings');
    }
    if (m.roofSheet > 0 && g.footprint > 0) {
      add(m.roofSheet >= g.footprint * 0.9 ? 'ok' : 'bad', 'Roof covers the building',
        fmt(m.roofSheet) + ' m² of sheeting over ' + fmt(g.footprint) + ' m²',
        m.roofSheet >= g.footprint * 0.9 ? 'the roof area allows for the eaves and the pitch'
                                         : 'the roof is smaller than the floor it covers — check the plan dimensions');
    }
    if (nZero) add('warn', 'Items measuring zero', nZero + ' item' + (nZero === 1 ? '' : 's'),
      'these price at nothing — enter the measure on the row, or leave the work out of the specification');

    const checksHtml = checks.map(c => `
      <div class="to-check ${c.level}">
        <span class="to-dot" aria-hidden="true">${c.level === 'ok' ? '✓' : '!'}</span>
        <div><b>${esc(c.label)}</b><span>${esc(c.value)}</span><em>${esc(c.note)}</em></div>
      </div>`).join('');

    /* one block per bill, with the quantity and the rate of every row open to
       correction; the section totals run alongside */
    const billHtml = (b, open) => {
      const adds = (p.takeoffAdd || {})[b.code] || [];
      const removed = ((p.takeoffDel || {})[b.code] || []).length;
      const touched = b.items.some(it => it.corrected || it.rateEdited || it.added) || removed > 0;
      const body = b.items.map((it, i) => {
        const derived = takeoffDerived(it);
        const key = takeoffKey(b, it);
        const measured = it.measured != null ? it.measured : it.qty;
        const baseRate = it.measuredRate != null ? it.measuredRate : it.rate;
        const num = v => String(Math.round((+v || 0) * 1000) / 1000);
        let qtyCell, rateCell;
        if (derived) {
          qtyCell = `<span class="to-fixed">${fmtQty(it.qty, it.unit)}</span>`;
          rateCell = `<span class="to-fixed">${fmt(it.rate)}</span>`;
        } else if (it.added) {
          qtyCell = `<input class="to-in" type="number" step="any" min="0" data-addqty="${esc(b.code + '|' + it.addId)}" value="${num(it.qty)}">`;
          rateCell = `<input class="to-rate" type="number" step="any" min="0" data-addrate="${esc(b.code + '|' + it.addId)}" value="${num(it.rate)}">`;
        } else {
          qtyCell = `<input class="to-in" type="number" step="any" min="0" data-to="${esc(key)}"
              data-desc="${esc(String(it.desc).slice(0, 40))}"
              value="${it.corrected ? it.qty : ''}" placeholder="${fmtQty(it.followed ? it.qty : measured, it.unit)}">`;
          rateCell = `<input class="to-rate" type="number" step="any" min="0" data-torate="${esc(key)}"
              data-desc="${esc(String(it.desc).slice(0, 40))}"
              value="${it.rateEdited ? it.rate : ''}" placeholder="${fmt(it.rateFromDesc ? it.rate : baseRate)}">`;
        }
        const chips = (it.corrected ? ' <span class="to-mark">qty</span>' : '')
          + (it.rateEdited ? ' <span class="to-mark rate">rate</span>' : '')
          + (it.rateFromDesc ? ` <span class="to-mark spec" title="${esc(it.specNote || 'the rate follows the specification in the description')}">rate from description</span>` : '')
          + (it.descEdited ? ' <span class="to-mark desc">description</span>' : '')
          + (it.unitEdited ? ' <span class="to-mark desc">unit</span>' : '')
          + (it.added ? ' <span class="to-mark add">added</span>' : '')
          + (it.followed && !it.corrected ? ' <span class="to-mark">follows the run</span>' : '')
          + (derived ? ' <span class="to-mark calc">calculated</span>' : '');
        const editKey = it.added ? b.code + '|add:' + it.addId : key;
        const specLine = it.rateFromDesc && it.specNote
          ? `<div class="to-spec" title="The rate is built from the specification in the description">${esc(it.specNote)}</div>` : '';
        const descCell = derived
          ? `<td>${esc(it.desc)}${chips}</td>`
          : `<td class="to-dcell"><textarea class="to-desc" rows="1" spellcheck="false" data-todesc="${esc(editKey)}"
              title="Change the description — mix, thickness and depth drive the rate; the bill and the exports follow it" aria-label="Description">${esc(it.desc)}</textarea>${chips}${specLine}</td>`;
        const unitCell = derived
          ? `<td class="num" style="width:42px">${esc(it.unit)}</td>`
          : `<td class="num to-ucell"><select class="to-unit" data-plain="1" data-tounit="${esc(editKey)}" title="Change the unit" aria-label="Unit">${toUnitOptions(it.unit)}</select></td>`;
        const edited = it.corrected || it.rateEdited || it.descEdited || it.unitEdited;
        return `
        <tr data-key="${esc(key)}" class="${it.corrected || it.rateEdited || it.followed ? 'to-corr' : ''}${derived ? ' to-derived' : ''}${it.added ? ' to-added' : ''}">
          <td class="hint" style="width:26px">${i + 1}</td>
          ${descCell}
          ${unitCell}
          <td class="num" style="width:76px" data-l="Measured">${it.added ? '—' : fmtQty(measured, it.unit)}</td>
          <td class="num" style="width:104px" data-l="Corrected">${qtyCell}</td>
          <td class="num" style="width:96px" data-l="Rate">${rateCell}</td>
          <td class="num" style="width:100px" data-l="Amount">${fmt(it.qty * it.rate)}</td>
          <td class="to-act">${derived ? '' : `<button class="to-grip" type="button" title="Drag to move this item" aria-label="Drag to move this item">\u28ff</button>`
            + (edited && !it.added ? `<button class="to-reset" data-toreset="${esc(key)}" type="button" title="Undo the edits on this row" aria-label="Undo the edits on this row">\u21ba</button>` : '')
            + (it.added
            ? `<button class="to-del" data-todeladd="${esc(b.code + '|' + it.addId)}" title="Remove this added item" aria-label="Remove this added item">\u2715</button>`
            : `<button class="to-del" data-todel="${esc(key)}" title="Remove this item from the bill" aria-label="Remove this item from the bill">\u2715</button>`)}</td>
        </tr>`;
      }).join('');
      return `<details class="to-bill"${touched || open ? ' open' : ''}>
        <summary>
          <span class="to-code">${esc(b.code.replace('BILL No. ', 'Bill '))}</span>
          <b>${esc(b.title)}</b>
          <span class="to-sum">${SYM(p)} ${fmt(b.total)}</span>
        </summary>
        <div class="tbl-scroll"><table class="to-table">
          <thead><tr><th></th><th>Description</th><th class="num">Unit</th><th class="num">Measured</th>
            <th class="num">Corrected qty</th><th class="num">Rate</th><th class="num">Amount</th><th></th></tr></thead>
          <tbody data-bill="${esc(b.code)}">${body}</tbody>
          <tfoot><tr><td colspan="6">${esc(b.code)} — total</td><td class="num">${fmt(b.total)}</td><td></td></tr></tfoot>
        </table></div>
        <div class="to-add no-print" data-addbox="${esc(b.code)}">
          <button class="btn sm" data-to-add="${esc(b.code)}">+ Add an item to this bill</button>
          ${removed ? `<button class="btn sm ghost" data-to-restore="${esc(b.code)}">Restore ${removed} removed item${removed === 1 ? '' : 's'}</button>` : ''}
        </div>
      </details>`;
    };

    const names = [];
    bills.forEach(b => { const n = takeoffSection(b.title); if (names.indexOf(n) < 0) names.push(n); });
    const ordered = TO_SECTIONS.map(x => x.name).filter(n => names.indexOf(n) >= 0)
      .concat(names.filter(n => !TO_SECTIONS.some(x => x.name === n)));
    const sectionsHtml = ordered.map(name => {
      const group = bills.filter(b => takeoffSection(b.title) === name);
      const total = group.reduce((t, b) => t + b.total, 0);
      const fixed = group.reduce((n, b) => n + b.items.filter(it => it.corrected || it.rateEdited).length, 0);
      const items = group.reduce((n, b) => n + b.items.length, 0);
      return `<section class="to-sec">
        <div class="to-sec-head">
          <h3>${esc(name)}</h3>
          <span class="to-sec-meta">${group.length} bill${group.length === 1 ? '' : 's'} · ${items} items${fixed ? ' · <b>' + fixed + ' corrected</b>' : ''}</span>
          <span class="to-sec-sum">${SYM(p)} ${fmt(total)}</span>
        </div>
        ${group.map((b, gi) => billHtml(b, gi === 0)).join('')}
      </section>`;
    }).join('');

    return `
    <div class="print-only" style="padding:10px 0">
      <h1 style="font-size:16pt">${esc(p.projectName)} — take-off sheet</h1>
      <p style="font-size:9pt;color:#555">Measured quantities and rates, section by section. Corrections entered in the app are carried into these figures.</p>
    </div>
    <section class="panel">
      <h2><span class="stepno">5 · </span>Measurement / take-off sheet</h2>
      <p class="lede">Every quantity and rate the bill will carry, section by section — preliminaries, substructure,
        superstructure, finishes, services and external works. Check the figures against the dimensions on the
        drawing. Every word and every figure is editable in place — description, unit, quantity, rate — and
        the bill, the exports and the saved record all follow. The description is the specification: rewrite the
        mix (1:2:4), the thickness (12 mm) or the depth and the rate is built again to suit, unless you type a
        rate of your own on the row.</p>

      <div class="grid4" style="margin-bottom:12px">
        <div class="stat to-stat"><span>Items</span><b>${nItems}</b></div>
        <div class="stat to-stat"><span>Corrected</span><b>${nTouched}</b><span class="to-stat-sub">${nCorr} qty · ${nRate} rate${nText ? ' · ' + nText + ' text' : ''}${nAdded ? ' · ' + nAdded + ' added' : ''}${nRemoved ? ' · ' + nRemoved + ' removed' : ''}</span></div>
        <div class="stat to-stat"><span>Bills</span><b>${bills.length}</b></div>
        <div class="stat to-stat"><span>Grand total</span><b>${SYM(p)} ${fmt(r.grand)}</b></div>
      </div>

      <div class="to-checks">${checksHtml}</div>

      <div class="row no-print" style="justify-content:space-between;align-items:center;margin:16px 0 8px;gap:10px">
        <span class="hint">${(nTouched || nAdded || nRemoved)
          ? [nTouched ? nTouched + ' figure' + (nTouched === 1 ? '' : 's') + ' corrected' : '',
             nAdded ? nAdded + ' item' + (nAdded === 1 ? '' : 's') + ' added' : '',
             nRemoved ? nRemoved + ' removed' : ''].filter(Boolean).join(' · ') + ' — the bill is priced on these'
          : 'Nothing changed yet: correct a quantity or a rate, add an item, or take one off where the drawing says so'}</span>
        <span class="row" style="gap:8px">
          <button class="btn sm" id="btn-to-open">Expand all</button>
          <button class="btn sm" id="btn-to-close">Collapse all</button>
          ${nTouched ? '<button class="btn sm" id="btn-to-reset">Clear every correction</button>' : ''}
          <button class="btn primary" data-step="6">Continue to the Bill of Quantities →</button>
        </span>
      </div>

      ${sectionsHtml}
    </section>`;
  }

  function matUtil() { return (typeof window !== 'undefined' && window.Materials) ? window.Materials : null; }

  function matModelNow(result) {
    const M = matUtil();
    if (!M) return null;
    const r = result || state.result || recompute();
    return M.model(state.params, r);
  }

  /* Where a material line comes from: the bill items whose rates carry it,
     biggest contribution first. This is the trace from the schedule back to
     the bill — press the chip on any line. */
  function matProvRow(l) {
    const p = state.params;
    const rows = (l.src || []).filter(x => x && x.desc)
      .slice().sort((a, b) => (+b.mat || 0) - (+a.mat || 0));
    if (!rows.length) return '';
    const total = rows.reduce((t, x) => t + (+x.mat || 0), 0);
    const shortBill = c => String(c || '').replace(/BILL\s*No\.?\s*/i, 'B');
    const body = rows.map(x => `<tr>
        <td class="mp-b" title="${esc(x.billTitle || x.bill)}">${esc(shortBill(x.bill))}</td>
        <td class="mp-i">${String(x.no || 0).padStart(2, '0')}</td>
        <td class="mp-d">${esc(x.desc)}</td>
        <td class="num">${fmtQty(x.qty, x.unit)} <span class="mp-u">${esc(x.unit || '')}</span></td>
        <td class="num">${fmt(x.amount)}</td>
        <td class="num">${fmt(x.mat)}</td>
      </tr>`).join('');
    return `<tr class="mat-prov-row"><td colspan="10">
      <div class="mat-prov">
        <div class="mat-prov-head"><b>From the bill of quantities</b>
          <span>${rows.length} priced bill item${rows.length === 1 ? '' : 's'} carr${rows.length === 1 ? 'ies' : 'y'} this material.
            The quantity in the schedule is the bill quantity multiplied by the amount the rate build-up uses per unit.</span></div>
        <div class="mat-prov-wrap"><table class="mat-prov-tbl">
          <colgroup><col style="width:44px"><col style="width:44px"><col><col style="width:104px"><col style="width:96px"><col style="width:104px"></colgroup>
          <thead><tr><th>Bill</th><th>Item</th><th>Bill description</th>
            <th class="num">Bill qty</th><th class="num">Item amount</th><th class="num">Material carried</th></tr></thead>
          <tbody>${body}</tbody>
          <tfoot><tr><td colspan="3">${rows.length} bill item${rows.length === 1 ? '' : 's'}</td>
            <td colspan="2"></td><td class="num">${SYM(p)} ${fmt(total)}</td></tr></tfoot>
        </table></div>
      </div></td></tr>`;
  }

  /* The schedule sits under the bill it was worked out from: subtotal, the
     part of it that is material, the part that is not, and the schedule's own
     total with the two compared. */
  function matBillFrom(m) {
    const p = state.params;
    const b = (m && m.totals && m.totals.bill) || null;
    if (!b) return '';
    const sym = SYM(p);
    const share = b.share;
    /* short, readable names for the priced work that carries no material */
    const NO_MAT = {
      siteClear: 'site clearance', excTrench: 'trench excavation', excPit: 'pit excavation',
      backfill: 'backfilling', hardcore: 'hardcore filling', blinding: 'blinding', trim: 'trimming'
    };
    const noMat = (b.noMat || []).slice(0, 3)
      .map(x => esc(NO_MAT[x.key] || String(x.desc || '').split(/[,.(]/)[0].toLowerCase().split(/\s+/).slice(0, 5).join(' ')))
      .join(', ');
    return `<div class="mat-bill-from" data-mat-from>
      <div class="mbf-main">
        <div class="mbf-kick">From the bill of quantities <span>${b.nBills} bills \u00b7 ${b.nItems} items</span></div>
        <dl class="mbf-rows">
          <div><dt>Bill of quantities \u2014 subtotal</dt><dd>${sym} ${fmt(b.subtotal)}</dd></div>
          <div class="on"><dt>Carried by materials</dt><dd>${sym} ${fmt(b.materials)}</dd><em>${share}%</em></div>
          <div><dt>Labour, plant and preliminaries</dt><dd>${sym} ${fmt(b.other)}</dd><em>${Math.round((100 - share) * 10) / 10}%</em></div>
          <div class="tot"><dt>Material schedule \u2014 this page</dt><dd>${sym} ${fmt(b.schedule)}</dd></div>
        </dl>
      </div>
      <div class="mbf-side">
        <div class="mbf-bar"><span class="mbf-mat" style="width:${share}%"></span><span class="mbf-lab"></span></div>
        <div class="mbf-tie ${b.tied ? 'ok' : 'off'}">${b.tied
          ? '<b>\u2713 ties to the bill</b><span>' + (Math.abs(b.diff) >= 0.01 ? sym + ' ' + fmt(Math.abs(b.diff)) + ' of line rounding' : 'to the cent') + '</span>'
          : '<b>\u00b1 ' + sym + ' ' + fmt(Math.abs(b.diff)) + '</b><span>' + (b.diff < 0 ? 'less' : 'more')
            + ' than the bill after changes made on this page</span>'}</div>
        <button class="btn sm" data-step="6" title="Open the priced bill">See the bill \u2192</button>
      </div>
      <p class="mbf-note">Every line below is multiplied out of a priced bill item \u2014 press
        <i>\u201cN bill items\u201d</i> on a line to see which bills and items it comes from.
        ${b.noMat && b.noMat.length ? b.noMat.length + ' priced item' + (b.noMat.length === 1 ? '' : 's') + ' carry no material (' + noMat
          + (b.noMat.length > 3 ? ' \u2026' : '') + ') \u2014 ' + sym + ' ' + fmt(b.noMatValue) + ' of excavation, clearance and carting away: labour and plant only.'
          : ''}</p>
    </div>`;
  }

  function matTable(v, m) {
    const p = state.params;
    if (!m || !m.shown.length) {
      return `<div class="mat-empty">
        <b>No materials yet</b>
        <span>Put a quantity and a rate on the bill and the materials behind it appear here — or add one by hand.</span>
      </div>`;
    }
    const rowHtml = l => {
      const chips = (l.touched ? '<span class="mat-mark">edited</span>' : '')
        + (l.manual ? '<span class="mat-mark add">added</span>' : '');
      const from = (l.src || []).filter(x => x && x.desc);
      const n = from.length;
      const tip = from.slice(0, 4).map(x => x.bill + ' · ' + x.desc).join(' \u00b7 ')
        + (from.length > 4 ? ' \u2026' : '');
      const open = state.matSrc === l.id;
      const src = n ? `<button type="button" class="mat-src${open ? ' on' : ''}" data-mat-src="${esc(l.id)}"
          title="${esc(tip)}" aria-expanded="${open ? 'true' : 'false'}">${n} bill item${n === 1 ? '' : 's'} ${open ? '\u25b4' : '\u25be'}</button>` : '';
      const main = `<tr class="mat-row${l.touched ? ' touched' : ''}${l.manual ? ' manual' : ''}" data-mid="${esc(l.id)}">
        <td class="mat-code">${esc(l.code)}</td>
        <td class="mat-name"><b>${esc(l.name)}</b>${chips}${src}</td>
        <td class="mat-cat">${esc(l.cat)}</td>
        <td class="mat-unit">${esc(l.unit)}</td>
        <td class="num" data-l="Qty">${fmtQty(l.qty, l.unit)}</td>
        <td class="num" data-l="Rate">${fmt(l.rate)}</td>
        <td class="num" data-l="Total">${fmt(l.amount)}</td>
        <td class="mat-sup" data-l="Supplier">${esc(l.sup || '—')}</td>
        <td class="mat-note" data-l="Remarks"${l.recipe && !l.note ? ` title="from the rate build-up"` : ''}>${l.note
          ? esc(l.note) : (l.recipe ? `<i class="mat-recipe">${esc(l.recipe)}</i>` : '—')}</td>
        <td class="mat-act no-print">
          <button class="mat-ib" data-mat-edit="${esc(l.id)}" title="Change this material" aria-label="Change this material">✎</button>
          <button class="mat-ib del" data-mat-del="${esc(l.id)}" title="Take this material off the schedule" aria-label="Take this material off the schedule">✕</button>
        </td>
      </tr>`;
      let out = main;
      if (open) out += matProvRow(l);
      if (state.matEdit === l.id) out += matEditor(l);
      return out;
    };

    let body = '';
    if (v.grouped) {
      v.groups.forEach(g => {
        body += `<tr class="mat-grp"><td colspan="7"><b>${esc(g.cat)}</b>
          <span>${g.lines.length} material${g.lines.length === 1 ? '' : 's'}</span></td>
          <td colspan="3" class="num"><b>${SYM(p)} ${fmt(g.cost)}</b></td></tr>`;
        g.lines.forEach(l => { body += rowHtml(l); });
      });
    } else {
      v.rows.forEach(l => { body += rowHtml(l); });
    }

    const shownN = v.grouped ? v.groups.reduce((n, g) => n + g.lines.length, 0) : v.rows.length;
    return `<div class="tbl-scroll"><table class="mat-table">
      <colgroup>
        <col style="width:58px"><col><col style="width:72px"><col style="width:38px">
        <col style="width:66px"><col style="width:64px"><col style="width:80px">
        <col style="width:74px"><col style="width:90px"><col style="width:56px" class="no-print">
      </colgroup>
      <thead><tr>
        <th>Code</th><th>Material</th><th>Category</th><th>Unit</th>
        <th class="num">Qty<br>required</th><th class="num">Unit<br>rate</th><th class="num">Total<br>cost</th>
        <th>Supplier</th><th>Remarks</th><th class="no-print"></th>
      </tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr>
        <td colspan="3">${shownN === m.totals.types ? 'Total — ' + m.totals.types + ' materials' : 'Showing ' + shownN + ' of ' + m.totals.types + ' materials'}</td>
        <td class="mat-foot-q" colspan="2">${fmtQty(v.qty, 'm3')}${v.units > 1 ? ' <span class="hint">in ' + v.units + ' units</span>' : ''}</td>
        <td></td>
        <td class="num">${SYM(p)} ${fmt(v.cost)}</td>
        <td colspan="3"></td>
      </tr></tfoot>
    </table></div>`;
  }

  function matEditor(l) {
    const manual = l.manual;
    const input = (name, label, value, extra) => `<label class="mat-f"><span>${label}</span>
      <input name="${name}" type="${(name === 'qty' || name === 'rate') ? 'number' : 'text'}"
        ${name === 'qty' || name === 'rate' ? 'step="any" min="0"' : ''} value="${esc(value == null ? '' : value)}" ${extra || ''}></label>`;
    return `<tr class="mat-edit-row"><td colspan="10">
      <form class="mat-form" data-mid="${esc(l.id)}" onsubmit="return false">
        <div class="mat-form-grid">
          ${manual ? `<label class="mat-f wide"><span>Material</span><input name="name" type="text" value="${esc(l.name)}"></label>` : ''}
          ${manual ? `<label class="mat-f"><span>Code</span><input name="code" type="text" value="${esc(l.code)}"></label>` : ''}
          ${manual ? `<label class="mat-f"><span>Category</span><select name="cat" data-plain="1">${MAT_CAT_OPTS(l.cat)}</select></label>` : ''}
          ${manual ? `<label class="mat-f"><span>Unit</span><select name="unit" data-plain="1">${MAT_UNIT_OPTS(l.unit)}</select></label>` : ''}
          ${input('qty', 'Quantity required', String(l.qty))}
          ${input('rate', 'Unit rate', String(l.rate))}
          ${input('sup', 'Supplier', l.sup || '')}
          ${input('note', 'Remarks', l.note || '', 'class="wide"')}
        </div>
        <div class="mat-form-btns">
          ${manual ? '' : `<span class="hint">${l.uses > 1 ? 'This line adds up ' + l.uses + ' bill items.' : 'This line comes from one bill item.'} Changing it here does not change the bill.</span>`}
          <button type="button" class="btn sm primary" data-mat-save="${esc(l.id)}">Save</button>
          <button type="button" class="btn sm" data-mat-cancel>Cancel</button>
        </div>
      </form></td></tr>`;
  }

  /* ------------------------------------------------------- the material book
     The same rule as the plan library: the building type chosen under
     "Read the drawing and set the scale" builds the model, the model builds
     the bill, and the bill is what fills the material schedule. So the groups
     and units this building actually spends on are put first, in the order its
     own schedule shows them, and the rest of the book follows under a heading.
     Every dropdown on the material side is cut from these two lists. */
  function matBookOrder() {
    const pick = (pairs) => {
      const out = [], seen = {};
      pairs.forEach(c => {
        if (!c) return;
        const k = String(c).toLowerCase();
        if (seen[k]) return;
        seen[k] = 1; out.push(String(c));
      });
      return out;
    };
    const usedC = [], usedU = [];
    const m = matModelNow();
    if (m && m.lines) m.lines.forEach(l => { usedC.push(l.cat); usedU.push(l.unit); });
    const M = matUtil();
    // a shelf is an app category: the price book's own headings are mapped onto
    // them by the material engine, so the schedule never shows both spellings
    const restC = (M ? M.CATS.slice() : ['Other materials']);
    const restU = ['m2', 'm3', 'm', 'kg', 't', 'No.', 'Item', 'L', 'day', 'bag', 'sheet', 'drum', 'box', 'set', 'trip', 'coil'];
    const used = pick(usedC.filter(Boolean));
    const usedLc = used.map(c => c.toLowerCase());
    const catRest = pick(restC.filter(c => usedLc.indexOf(String(c).toLowerCase()) < 0));
    const unitUsed = pick(usedU.filter(Boolean));
    const unitLc = unitUsed.map(u => u.toLowerCase());
    const unitRest = pick(restU.filter(u => unitLc.indexOf(String(u).toLowerCase()) < 0));
    /* the database keeps its own, coarser headings (CEMENTS, TILES …). Put the
       ones that feed a shelf this building buys from first, the rest after. */
    const dbAll = (typeof MatDB !== 'undefined' && MatDB.groups) ? MatDB.groups().map(g => g.cat) : [];
    const feedsUsed = c => {
      const t = String(c).toLowerCase();
      return usedLc.some(u => t.indexOf(u) >= 0 || u.indexOf(t) >= 0);
    };
    const dbCats = dbAll.filter(feedsUsed).concat(dbAll.filter(c => !feedsUsed(c)));
    return { cats: used.concat(catRest), used: used, catRest: catRest,
             units: unitUsed.concat(unitRest), unitsUsed: unitUsed, unitRest: unitRest,
             dbCats: dbCats, dbUsed: dbCats.filter(feedsUsed) };
  }

  function MAT_CAT_OPTS(cur) {
    const B = matBookOrder();
    const has = v => B.used.concat(B.catRest).some(c => c === v);
    const first = (cur && !has(cur)) ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : '';
    const head = B.used.map(c => `<option value="${esc(c)}"${c === cur ? ' selected' : ''}>${esc(c)}</option>`).join('');
    const tail = B.catRest.map(c => `<option value="${esc(c)}"${c === cur ? ' selected' : ''}>${esc(c)}</option>`).join('');
    return first + head + (tail ? `<optgroup label="Other groups — not used by this building">${tail}</optgroup>` : '');
  }
  function MAT_UNIT_OPTS(cur) {
    const B = matBookOrder();
    const all = B.units;
    const list = (cur && all.indexOf(cur) < 0) ? [cur].concat(all) : all;
    return list.map(u => `<option value="${esc(u)}"${u === cur ? ' selected' : ''}>${esc(u)}</option>`).join('');
  }

  // what the database knows, offered as the material is typed
  function matDbNames() {
    if (typeof MatDB === 'undefined') return '';
    return MatDB.all().slice(0, 1200).map(r =>
      `<option value="${esc(r.name)}">${esc(r.code + ' · ' + r.cat + (r.rate != null ? ' · ' + SYM(state.params) + ' ' + fmt(r.rate) : ''))}</option>`).join('');
  }

  /* --------------------------------------------------- structural check */
  /* The frame the plan shows, checked to BS 8110, and the bars it asks for. */
  function structOpen() {
    if (typeof StructUI === 'undefined' || typeof STRUCT === 'undefined') { toast('The structural check is not loaded'); return; }
    StructUI.open({
      params: state.params,
      result: recompute(),
      currency: SYM(state.params),
      project: state.params.projectName,
      canEdit: () => can('edit'),
      toast: toast,
      save: () => { state.result = recompute(); if (state.step === 6) render(); save(); },
      after: () => bbsOpen()
    });
  }

  /* ------------------------------------------------------ bender schedule */
  /* The steel the bill prices, opened up into bar marks. Adopting it puts
     the schedule's weight onto the reinforcement items, so the bill, the
     material schedule and every export agree with the cutting list. */
  function bbsOpen() {
    if (typeof BBSUI === 'undefined' || typeof BBS === 'undefined') { toast('The bending schedule is not loaded'); return; }
    BBSUI.open({
      params: state.params,
      result: recompute(),
      currency: SYM(state.params),
      project: state.params.projectName,
      canEdit: () => can('edit'),
      toast: toast,
      recompute: recompute,
      save: () => { state.result = recompute(); if (state.step === 6) render(); save(); },
      adopt: kg => bbsAdopt(kg),
      onStruct: () => structOpen()
    });
  }

  function bbsAdopt(kg) {
    if (!guard('edit')) return false;
    const r = recompute();
    const items = [];
    r.bills.forEach(b => (b.items || []).forEach(it => {
      if (String(it.unit).toLowerCase() === 'kg' && /reinforc|rebar|steel bar|fabric/i.test(String(it.desc))) items.push({ b: b, it: it });
    }));
    if (!items.length) { toast('The bill has no reinforcement item to price'); return false; }
    const sum = items.reduce((n, x) => n + (+x.it.qty || 0), 0);
    const tk = takeoffOf();
    items.forEach(x => {
      const key = takeoffKey(x.b, x.it);
      const q = sum > 0 ? Math.round(kg * (+x.it.qty || 0) / sum) : Math.round(kg / items.length);
      const e = tk[key] || { d: String(x.it.desc) };
      e.q = q; e.d = String(x.it.desc);
      tk[key] = e;
    });
    state.result = recompute();
    if (state.step === 6) render();
    save();
    toast('Reinforcement priced at ' + fmt(kg, 0) + ' kg from the bending schedule');
    return true;
  }

  function matDbOpen(onPick) {
    if (typeof MatUI === 'undefined' || typeof MatDB === 'undefined') { toast('The materials database is not loaded'); return; }
    const book = matBookOrder();
    MatUI.open({
      canEdit: () => can('edit'),
      toast: toast,
      currency: SYM(state.params),
      cats: book.dbCats, units: book.units,
      onChange: () => { if (state.step === 7) matRepaint(); },
      onPick: onPick || null
    });
  }

  // filling the add form from a database record
  function matFillFromDb(rec) {
    const form = document.getElementById('mat-new-form');
    if (!form) return;
    const set = (n, v) => {
      const el = form.querySelector('[name="' + n + '"]');
      if (!el) return;
      if (el.tagName === 'SELECT' && v != null && !Array.from(el.options).some(o => o.value === v)) {
        const o = document.createElement('option'); o.value = v; o.textContent = v; el.appendChild(o);
      }
      el.value = v == null ? '' : v;
    };
    set('name', rec.name);
    set('code', rec.code);
    set('cat', rec.cat);
    set('unit', rec.unit);
    set('rate', rec.rate == null ? '' : rec.rate);
    set('sup', rec.sup || '');
    set('note', rec.note || '');
    const q = form.querySelector('[name="qty"]');
    if (q) { q.focus(); q.select(); }
    toast('Taken from the database — ' + rec.code + '. Add the quantity required.');
  }

  function matAddForm() {
    return `<form class="mat-form mat-new no-print" id="mat-new-form" onsubmit="return false">
      <div class="mat-form-grid">
        <label class="mat-f wide"><span>Material</span>
          <span class="mat-pick-wrap">
            <input name="name" type="text" list="mat-db-names" placeholder="What is it? e.g. 150 mm sandcrete blocks" autofocus>
            <button type="button" class="btn sm" data-mat-pick title="Choose from the materials database">From the database</button>
          </span>
        </label>
        <datalist id="mat-db-names">${matDbNames()}</datalist>
        <label class="mat-f"><span>Code</span><input name="code" type="text" placeholder="auto"></label>
        <label class="mat-f"><span>Category</span><select name="cat" data-plain="1">${MAT_CAT_OPTS('Other materials')}</select></label>
        <label class="mat-f"><span>Unit</span><select name="unit" data-plain="1">${MAT_UNIT_OPTS('No.')}</select></label>
        <label class="mat-f"><span>Quantity required</span><input name="qty" type="number" step="any" min="0" placeholder="0"></label>
        <label class="mat-f"><span>Unit rate</span><input name="rate" type="number" step="any" min="0" placeholder="0"></label>
        <label class="mat-f"><span>Supplier</span><input name="sup" type="text" placeholder="optional"></label>
        <label class="mat-f wide"><span>Remarks</span><input name="note" type="text" placeholder="optional"></label>
      </div>
      <div class="mat-form-btns">
        <span class="hint">A material added by hand sits in the schedule beside the ones the bill produces.</span>
        <button type="button" class="btn sm primary" data-mat-add-save>Add the material</button>
        <button type="button" class="btn sm" data-mat-cancel>Cancel</button>
      </div>
    </form>`;
  }

  /* ---------------------------------------------------------------- print */
  /* An A4 list of the schedule, built for paper rather than for the screen:
     the same nine columns, one material to a line, category bands that repeat
     their heading on every page, and a total at the foot. It follows the
     search, the category filter and the sort on screen, and says so when a
     filter is on. */
  const MP_BOILER = 'supply share of an assessed rate';
  function mpRemark(l) {
    if (l.note && l.note !== MP_BOILER) return esc(l.note);
    if (l.recipe) return `<i>${esc(l.recipe)}</i>`;
    return '\u2014';
  }

  function matPrintSheet(v, m) {
    const p = state.params;
    const sym = SYM(p);
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const all = m.totals.types;
    const shownN = v.grouped ? v.groups.reduce((n, g) => n + g.lines.length, 0) : v.rows.length;
    const filters = [];
    if (state.matQ) filters.push('search \u201c' + state.matQ + '\u201d');
    if (state.matCat && state.matCat !== 'all') filters.push('category ' + state.matCat);
    if ((state.matSort || 'cat') !== 'cat') {
      const nm = { name: 'name A\u2013Z', code: 'code', qty: 'quantity', cost: 'cost' }[state.matSort] || state.matSort;
      filters.push('sorted by ' + nm);
    }
    const filterNote = (filters.length || shownN !== all)
      ? `<div class="mp-filter">Showing ${shownN} of ${all} materials${filters.length ? ' \u00b7 ' + filters.join(' \u00b7 ') : ''}. The full schedule totals ${sym} ${fmt(m.totals.cost)}.</div>`
      : '';

    const rowOf = l => `<tr class="mp-row">
        <td class="mp-code">${esc(l.code)}</td>
        <td class="mp-name">${esc(l.name)}${l.manual ? ' <span class="mp-tag">added</span>' : (l.touched ? ' <span class="mp-tag">edited</span>' : '')}</td>
        <td>${esc(l.cat)}</td>
        <td class="mp-unit">${esc(l.unit)}</td>
        <td class="num">${fmtQty(l.qty, l.unit)}</td>
        <td class="num">${fmt(l.rate)}</td>
        <td class="num mp-amt">${fmt(l.amount)}</td>
        <td class="mp-sup">${esc(l.sup || '\u2014')}</td>
        <td class="mp-note">${mpRemark(l)}</td>
      </tr>`;

    let body = '';
    if (v.grouped) {
      v.groups.forEach(g => {
        body += `<tr class="mp-grp"><td colspan="6"><b>${esc(g.cat.toUpperCase())}</b>
          <span>${g.lines.length} material${g.lines.length === 1 ? '' : 's'}</span></td>
          <td class="num"><b>${fmt(g.cost)}</b></td><td colspan="2"></td></tr>`;
        g.lines.forEach(l => { body += rowOf(l); });
      });
    } else {
      v.rows.forEach(l => { body += rowOf(l); });
    }

    return `<div class="mat-print-sheet" aria-hidden="true">
      <div class="mp-head">
        <div class="mp-kick">Material schedule</div>
        <h1>${esc(p.projectName || 'Project')}</h1>
        ${p.projectSub ? `<div class="mp-sub">${esc(p.projectSub)}</div>` : ''}
        ${p.location ? `<div class="mp-loc">${esc(p.location)}</div>` : ''}
        <div class="mp-meta">All figures in ${sym} \u00b7 ${dateStr} \u00b7 ${all} materials in ${m.totals.categories} categories \u00b7 total material cost ${sym} ${fmt(m.totals.cost)}</div>
        ${filterNote}
        ${m.totals.bill ? `<div class="mp-bill">
          <div class="mp-bill-h">DERIVED FROM THE BILL OF QUANTITIES</div>
          <div class="mp-bill-r"><span>Bill subtotal \u2014 ${m.totals.bill.nBills} bills, ${m.totals.bill.nItems} items</span><b>${sym} ${fmt(m.totals.bill.subtotal)}</b></div>
          <div class="mp-bill-r on"><span>Carried by materials</span><b>${sym} ${fmt(m.totals.bill.materials)} \u00b7 ${m.totals.bill.share}%</b></div>
          <div class="mp-bill-r"><span>Labour, plant and preliminaries</span><b>${sym} ${fmt(m.totals.bill.other)}</b></div>
          <div class="mp-bill-r tot"><span>Material schedule</span><b>${sym} ${fmt(m.totals.bill.schedule)}${m.totals.bill.tied ? ' \u2713 ties' : ''}</b></div>
        </div>` : ''}
      </div>
      <table class="mp-table">
        <colgroup><col style="width:7%"><col style="width:26%"><col style="width:13%"><col style="width:5%">
          <col style="width:8%"><col style="width:8%"><col style="width:10%"><col style="width:9%"><col style="width:14%"></colgroup>
        <thead><tr>
          <th>Code</th><th>Material</th><th>Category</th><th class="num">Unit</th>
          <th class="num">Qty</th><th class="num">Rate</th><th class="num">Total (${esc(sym)})</th>
          <th>Supplier</th><th>Remarks</th>
        </tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr class="mp-total">
          <td colspan="6">TOTAL MATERIAL COST</td>
          <td class="num">${esc(sym)} ${fmt(v.cost)}</td><td colspan="2"></td>
        </tr></tfoot>
      </table>
      <div class="mp-endnote">The schedule multiplies the quantity of every priced bill item by the materials its rate is
        built from, adds the same material up across the bills and prices it at the rate in the rate build-up. Items priced
        as an assessment carry a supply line at the material share of their rate. Derive it again whenever the bill changes:
        on screen, press Print.</div>
      <div class="mp-sign"><span>Prepared by ____________________</span><span>Checked by ____________________</span><span>Date ____________</span></div>
    </div>`;
  }

  function matSchedule(r) {
    const p = state.params;
    const m = matModelNow(r);
    if (!m) return `<section class="panel"><h2>Material schedule</h2><p class="lede">The material engine did not load.</p></section>`;
    const v = matUtil().view(m, state.matQ, state.matCat, state.matSort);
    const share = r.grand > 0 ? Math.round(m.totals.cost / r.grand * 100) : 0;
    const cats = m.groups.map(g => g.cat);
    return `
    <section class="panel mat-panel">
      <div class="print-only" style="margin-bottom:12px">
        <div style="border-bottom:2.5pt solid #1f4e3d;padding-bottom:5px;margin-bottom:6px">
          <div style="font-size:10pt;font-weight:700;letter-spacing:.08em;color:#1f4e3d">MATERIAL SCHEDULE</div>
          <div style="font-size:16pt;font-weight:750;margin-top:2px">${esc(p.projectName)}</div>
          <div style="font-size:10pt;color:#2e6b55">${esc(p.projectSub)}${p.location ? ' · ' + esc(p.location) : ''}</div>
        </div>
        <div style="font-size:8.5pt;color:#555">${m.totals.types} materials in ${m.totals.categories} categories · total material cost ${SYM(p)} ${fmt(m.totals.cost)}</div>
      </div>
      <h2><span class="stepno">7 · </span>Material schedule</h2>
      <p class="lede">Every material the bill is built from, added up across the bills: the cement, sand and aggregate in
        the concrete, the blocks in the walls, the steel, the tiles, the pipe and the cable. It follows the bill — correct a
        quantity on the take-off sheet and the material moves with it.</p>

      ${matBillFrom(m)}

      <div class="mat-kpis">
        <div class="mat-kpi"><span>Material types</span><b>${m.totals.types}</b><em>in ${m.totals.categories} categories</em></div>
        <div class="mat-kpi"><span>Total quantity</span><b>${fmtQty(m.totals.qty, 'm3')}</b><em>across ${m.totals.units} units of measure</em></div>
        <div class="mat-kpi"><span>Total material cost</span><b>${SYM(p)} ${fmt(m.totals.cost)}</b><em>${m.totals.bill ? m.totals.bill.share + "% of the bill's subtotal" : share + "% of the bill's grand total"}</em></div>
        <div class="mat-kpi quiet"><span>Materials with low stock</span><b>—</b><em>no inventory linked to this project</em></div>
      </div>

      <div class="mat-tools no-print">
        <input id="mat-q" class="mat-search" type="search" placeholder="Search code, material, supplier…"
          value="${esc(state.matQ || '')}" aria-label="Search the material schedule">
        <select id="mat-cat" class="mat-sel" data-plain="1" aria-label="Filter by category">
          <option value="all">All categories</option>
          ${m.cats.map(c => `<option value="${esc(c)}"${state.matCat === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
        <select id="mat-sort" class="mat-sel" data-plain="1" aria-label="Sort the schedule">
          ${[['cat', 'Group by category'], ['name', 'Name A–Z'], ['code', 'Code'], ['qty', 'Quantity, high to low'], ['cost', 'Cost, high to low']]
            .map(([k, t]) => `<option value="${k}"${(state.matSort || 'cat') === k ? ' selected' : ''}>${t}</option>`).join('')}
        </select>
        <span class="mat-break"></span>
        <button class="btn sm" data-mat-new>+ Add a material</button>
        <button class="btn sm" data-mat-db title="The catalogue of materials kept on this device">Materials database</button>
        <span class="mat-grow"></span>
        <span class="mat-exports">
          <button class="btn sm" id="btn-mat-xlsx" title="Export the schedule as an Excel workbook">Excel</button>
          <button class="btn sm" id="btn-mat-pdf" title="Export the schedule as a PDF">PDF</button>
          <button class="btn sm" id="btn-mat-print" title="Print the schedule">Print</button>
        </span>
      </div>

      ${state.matAdd ? matAddForm() : ''}
      <div id="mat-host">${matTable(v, m)}</div>
      ${matPrintSheet(v, m)}

      <div class="mat-foot no-print">
        <span class="hint">${m.totals.adjusted ? m.totals.adjusted + ' line' + (m.totals.adjusted === 1 ? '' : 's') + ' changed by hand · ' : ''}${m.totals.manual ? m.totals.manual + ' added by hand · ' : ''}${m.totals.hidden ? m.totals.hidden + ' taken off · ' : ''}quantities and rates follow the bill</span>
        ${m.totals.hidden ? `<button class="btn sm ghost" data-mat-restore>Restore ${m.totals.hidden} removed material${m.totals.hidden === 1 ? '' : 's'}</button>` : ''}
        ${(m.totals.adjusted || m.totals.manual || m.totals.hidden) ? `<button class="btn sm ghost" data-mat-reset>Clear every material change</button>` : ''}
      </div>

      <div class="row no-print mat-nav">
        <button class="btn" data-step="6">← Back to the bill</button>
        <span class="hint">The schedule is worked out from the bill — issue it with the bill and the exports.</span>
        <span style="flex:1"></span>
        <button class="btn primary" data-step="8">Continue to the Labour Schedule →</button>
      </div>
    </section>`;
  }

  /* ------------------------------------------------------------ the labour
     The schedule the site can work from. Every figure on it is read out of
     the priced bill: the rate build-up says how much of each trade a unit of
     work takes, the bill says how many units there are, and the rate card
     says what a day of that trade costs. Nothing is typed here, so a
     corrected quantity, a changed rate or a changed day rate moves it. */

  const LAB_PROG = [4, 6, 8, 10, 13, 16, 20, 26, 39, 52];

  function labWeeks() {
    const w = +state.labWeeks;
    return w > 0 ? w : 13;
  }

  function labModelNow() {
    const L = window.Labour;
    if (!L || typeof L.model !== 'function') return null;
    const p = Object.assign({}, state.params, { _labourWeeks: labWeeks() });
    return L.model(p, recompute());
  }

  function labBillCode(code) {
    return String(code || '').replace(/BILL\s*No\.?\s*/i, 'B');
  }

  /* the items one trade's days are made of — the same trace the material
     schedule gives, so a day can always be pointed back at the bill */
  function labItemsFor(m, id) {
    const items = m.rows.filter(x => x.trade === id);
    if (!items.length) return '';
    const tr = m.trades.find(x => x.id === id) || { label: id, days: 0, cost: 0 };
    return `<div class="lab-items">
      <div class="lab-items-h"><b>What the ${esc(tr.label.toLowerCase())} days are made of</b>
        <span>${items.length} priced ${items.length === 1 ? 'line' : 'lines'} · man-days = quantity × the time the
        rate build-up allows for a unit</span></div>
      <div class="mat-prov-wrap"><table class="mat-prov-tbl">
        <thead><tr><th>Bill</th><th>Item</th><th class="num">Quantity</th><th class="num">Man-days</th>
          <th class="num">Day rate</th><th class="num">Cost (${SYM(state.params)})</th></tr></thead>
        <tbody>${items.map(x => `<tr>
          <td class="mp-b">${esc(labBillCode(x.bill))}</td>
          <td class="mp-d">${esc(x.desc)}</td>
          <td class="num mp-u">${fmt(x.qty)} ${esc(x.unit)}</td>
          <td class="num">${fmt(x.days)}</td>
          <td class="num">${fmt(x.rate)}</td>
          <td class="num">${fmt(x.cost)}</td></tr>`).join('')}
        </tbody>
        <tfoot><tr><td colspan="3">${esc(tr.label)}</td>
          <td class="num">${fmt(tr.days)}</td><td></td><td class="num">${fmt(tr.cost)}</td></tr></tfoot>
      </table></div>
    </div>`;
  }

  function labTradeTable(m, print) {
    const sym = SYM(state.params);
    const t = m.totals;
    const open = print ? null : state.labTrade;
    const row = tr => {
      const share = t.days > 0 ? tr.days / t.days * 100 : 0;
      const isOpen = open === tr.id;
      return `<tr class="mat-row lab-row${isOpen ? ' on' : ''}"${print ? '' : ` data-lab-trade="${esc(tr.id)}"`}>
        <td class="lab-trade">
          ${print ? '' : `<button class="lab-toggle" data-lab-trade="${esc(tr.id)}"
            aria-expanded="${isOpen ? 'true' : 'false'}"
            title="${isOpen ? 'Hide' : 'Show'} the bill items behind the ${esc(tr.label.toLowerCase())}">${isOpen ? '\u2212' : '+'}</button>`}
          <b>${esc(tr.label)}</b>
          <span class="lab-blurb">${esc(tr.blurb)}${print ? '' : ' \u00b7 ' + tr.items + (tr.items === 1 ? ' bill line' : ' bill lines')}</span>
        </td>
        <td class="num" data-l="Man-days">${fmt(tr.days)}</td>
        <td class="num" data-l="Hours">${fmt(tr.hours, 0)}</td>
        <td class="num" data-l="Day rate">${fmt(tr.rate)}</td>
        <td class="num lab-cost" data-l="Labour cost">${fmt(tr.cost)}</td>
        <td class="num" data-l="Crew">${fmt(tr.men, 1)}</td>
        <td class="num lab-share" data-l="Share"><span class="lab-bar"><i style="width:${share.toFixed(1)}%"></i></span>${fmt(share, 0)}%</td>
      </tr>${isOpen ? `<tr class="lab-prov-row"><td colspan="7">${labItemsFor(m, tr.id)}</td></tr>` : ''}`;
    };
    return `<table class="${print ? 'mp-table' : 'mat-table lab-table'}">
      <thead><tr>
        <th style="width:30%">Trade</th>
        <th class="num" style="width:11%">Man-days</th>
        <th class="num" style="width:9%">Hours</th>
        <th class="num" style="width:12%">Day rate (${sym})</th>
        <th class="num" style="width:15%">Labour cost (${sym})</th>
        <th class="num" style="width:8%">Crew</th>
        <th class="num" style="width:15%">Share</th>
      </tr></thead>
      <tbody>${m.trades.map(row).join('')}</tbody>
      <tfoot><tr>
        <td>TOTAL LABOUR COST</td>
        <td class="num">${fmt(t.days)}</td>
        <td class="num">${fmt(t.hours, 0)}</td>
        <td class="num">${fmt(t.avgDay)}</td>
        <td class="num">${fmt(t.cost)}</td>
        <td class="num">${fmt(t.crew, 1)}</td>
        <td class="num">100%</td>
      </tr></tfoot>
    </table>`;
  }

  function labBillTable(m, print) {
    const sym = SYM(state.params);
    const t = m.totals;
    return `<table class="${print ? 'mp-table' : 'mat-table lab-bt'}">
      <thead><tr>
        <th style="width:6%">Bill</th>
        <th style="width:23%">Description</th>
        <th style="width:29%">Trades used</th>
        <th class="num" style="width:11%">Man-days</th>
        <th class="num" style="width:15%">Labour (${sym})</th>
        <th class="num" style="width:16%">Assessed (${sym})</th>
      </tr></thead>
      <tbody>${m.bills.map(b => `<tr${print ? '' : ' class="mat-row lab-brow"'}>
        <td class="lab-billno">${esc(labBillCode(b.code))}</td>
        <td class="lab-bt-title">${esc(b.title || '')}</td>
        <td class="lab-bt-trades">${b.trades.length
          ? b.trades.map(x => `<span class="lab-chip">${esc(x.label)} <b>${fmt(x.days)}</b></span>`).join(' ')
          : '<span class="hint">no measured labour</span>'}</td>
        <td class="num" data-l="Man-days">${fmt(b.days)}</td>
        <td class="num" data-l="Labour cost">${fmt(b.cost)}</td>
        <td class="num" data-l="Assessed">${b.assessed ? fmt(b.assessed) : '\u2014'}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr>
        <td colspan="3">TOTAL &nbsp;·&nbsp; ${m.bills.length} ${m.bills.length === 1 ? 'bill' : 'bills'}</td>
        <td class="num">${fmt(t.days)}</td>
        <td class="num">${fmt(t.cost)}</td>
        <td class="num">${t.assessedCost ? fmt(t.assessedCost) : '\u2014'}</td>
      </tr></tfoot>
    </table>`;
  }

  function labAssessed(m) {
    const sym = SYM(state.params);
    const t = m.totals;
    if (!t.assessedCost) return '';
    const rows = m.rows.filter(x => x.trade === 'assessed');
    return `<div class="lab-assessed">
      <div class="lab-assessed-h">
        <div><b>Assessed labour</b>
          <span>${t.assessedOnly} ${t.assessedOnly === 1 ? 'item' : 'items'} priced as an assessment carry
          a labour-and-plant share of their rate</span></div>
        <div class="lab-assessed-tot">${sym} ${fmt(t.assessedCost)}</div>
      </div>
      <p>Doors, fittings, services and the like are priced as a whole, so their labour names no trade and no time.
        It is real money in the bill and it is reported here as money: the schedule does not divide it by a day rate
        to invent days nobody measured.</p>
      <details class="lab-ass-detail">
        <summary>Show the ${rows.length} ${rows.length === 1 ? 'item' : 'items'} it sits inside</summary>
        <div class="mat-prov-wrap"><table class="mat-prov-tbl">
          <thead><tr><th>Bill</th><th>Item</th><th class="num">Quantity</th><th class="num">Labour share</th></tr></thead>
          <tbody>${rows.map(x => `<tr>
            <td class="mp-b">${esc(labBillCode(x.bill))}</td>
            <td class="mp-d">${esc(x.desc)}</td>
            <td class="num mp-u">${fmt(x.qty)} ${esc(x.unit)}</td>
            <td class="num">${sym} ${fmt(x.cost)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="3">Assessed labour</td><td class="num">${sym} ${fmt(t.assessedCost)}</td></tr></tfoot>
        </table></div>
      </details>
      ${t.assessedCost ? `<div class="lab-value">Labour value carried by the bill
        <b>${sym} ${fmt(t.labourValue)}</b> = measured ${sym} ${fmt(t.cost)} + assessed ${sym} ${fmt(t.assessedCost)}</div>` : ''}
    </div>`;
  }

  function labEmpty() {
    return `<div class="mat-empty lab-empty">
      <b>No labour in this bill yet</b>
      Every line is priced as a supply, or there are no measured quantities to price. Measure the work on the
      take-off sheet and set the rates in the rate build-up — the trades, the days and the crew appear here as
      soon as the bill carries labour.
      <div class="row" style="justify-content:center;margin-top:10px">
        <button class="btn sm" data-step="6">Open the bill of quantities</button>
        <button class="btn sm" data-step="5">Back to the take-off sheet</button>
      </div>
    </div>`;
  }

  function labPrintSheet(m) {
    const p = state.params;
    const sym = SYM(p);
    const t = m.totals;
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return `
    <div class="mat-print-sheet lab-print-sheet">
      <div class="mp-head">
        <div class="mp-kick">Labour schedule</div>
        <h1>${esc(p.projectName)}</h1>
        <div class="mp-sub">${esc(p.projectSub)}</div>
        ${p.location ? `<div class="mp-loc">${esc(p.location)}</div>` : ''}
        <div class="mp-meta">Currency ${esc(sym)} · Date ${esc(dateStr)} · ${t.hoursADay}-hour day, 5-day week
          · programme ${t.period} weeks (${t.workDays} working days)</div>
      </div>
      <div class="mp-bill">
        <div class="mp-bill-h">LABOUR READ OUT OF THE PRICED BILL</div>
        <div class="mp-bill-r"><span>Priced items carrying labour</span><b>${t.rows} lines in ${t.bills} bills</b></div>
        <div class="mp-bill-r"><span>Man-days</span><b>${fmt(t.days)} at ${t.hoursADay} hours = ${fmt(t.hours, 0)} hours</b></div>
        <div class="mp-bill-r on"><span>Measured labour cost</span><b>${sym} ${fmt(t.cost)}</b></div>
        ${t.assessedCost ? `<div class="mp-bill-r"><span>Assessed labour (no measured time)</span><b>${sym} ${fmt(t.assessedCost)}</b></div>` : ''}
        <div class="mp-bill-r tot"><span>Labour value carried by the bill</span><b>${sym} ${fmt(t.labourValue)}</b></div>
        <div class="mp-bill-r"><span>Crew over ${t.period} weeks</span><b>${fmt(t.crew, 1)} men on site</b></div>
      </div>
      <div class="lab-p-block"><div class="lab-p-h">Days and cost by trade</div>
        <div class="lab-scroll">${labTradeTable(m, true)}</div></div>
      ${t.assessedCost ? `<div class="mp-endnote" style="margin-top:5pt">Assessed labour of ${sym} ${fmt(t.assessedCost)}
        sits inside ${t.assessedOnly} rates priced as an assessment (doors, fittings, services). It names no trade and no
        time, so it is reported as money and is not turned into days.</div>` : ''}
      <div class="lab-p-block"><div class="lab-p-h">The same labour, bill by bill</div>
        <div class="lab-scroll">${labBillTable(m, true)}</div></div>
      <div class="mp-endnote">Every line is multiplied out of a priced bill item: the rate build-up gives the time a
        trade takes for a unit of work, the bill gives the quantity, and the rate card gives the day rate. A corrected
        quantity, a changed rate or a changed day rate moves the schedule. Crew is the man-days divided by the working
        days in the programme, so a trade needed for a few days reads as a fraction of a man.</div>
      <div class="mp-sign"><span>Prepared by ____________________</span><span>Checked by ____________________</span><span>Date ____________</span></div>
    </div>`;
  }

  function labourSchedule(r) {
    const p = state.params;
    const sym = SYM(p);
    const m = labModelNow();
    if (!m) {
      return `<section class="panel"><h2>Labour schedule</h2>
        <p class="lede">The labour engine did not load.</p></section>`;
    }
    const t = m.totals;
    const weeks = labWeeks();
    const has = m.trades.length > 0 || t.assessedCost > 0;
    const shareOfBill = r && r.subtotal > 0 ? t.labourValue / r.subtotal * 100 : 0;
    const biggest = m.trades.length ? m.trades[0] : null;

    return `
    <section class="panel mat-panel lab-panel">
      ${labPrintSheet(m)}
      <h2><span class="stepno">8 · </span>Labour schedule</h2>
      <p class="lede">Who the bill needs on site and for how long: every trade its rates call for, the days and hours
        each one takes, what those days cost at the day rates in the rate card, and the crew a
        ${weeks}-week programme asks for. It follows the bill — change a quantity, a rate or a day rate and the
        schedule moves with it.</p>

      ${has ? `
      <div class="lab-from">
        <div class="lab-from-main">
          <div class="mbf-kick">Labour read out of the bill <span>${t.bills} bills · ${t.items} priced items</span></div>
          <dl class="mbf-rows">
            <div><dt>Trades the rates call for</dt><dd>${t.trades}</dd><em>${t.rows} labour lines</em></div>
            <div><dt>Man-days measured</dt><dd>${fmt(t.days)} days</dd><em>${fmt(t.hours, 0)} h</em></div>
            <div class="on"><dt>Measured labour cost</dt><dd>${sym} ${fmt(t.cost)}</dd><em>${fmt(t.avgDay)} a day</em></div>
            ${t.assessedCost ? `<div><dt>Assessed labour — money, no measured time</dt><dd>${sym} ${fmt(t.assessedCost)}</dd><em>${t.assessedOnly} items</em></div>` : ''}
            <div class="tot"><dt>Labour value carried by the bill</dt><dd>${sym} ${fmt(t.labourValue)}</dd><em>${fmt(shareOfBill, 1)}% of the bills</em></div>
          </dl>
        </div>
        <div class="mbf-side">
          <div class="mbf-bar"><span class="mbf-mat" style="width:${t.labourValue ? (t.cost / t.labourValue * 100).toFixed(1) : 0}%"></span></div>
          <div class="lab-bar-key"><span class="lab-k1">measured ${fmt(t.labourValue ? t.cost / t.labourValue * 100 : 0, 0)}%</span>
            <span class="lab-k2">assessed ${fmt(t.labourValue ? t.assessedCost / t.labourValue * 100 : 0, 0)}%</span></div>
          <div class="mbf-tie ${t.trades ? 'ok' : ''}"><b>${fmt(t.days)} man-days</b>
            <span>${biggest ? esc(biggest.label) + ' carry the most — ' + fmt(biggest.days / (t.days || 1) * 100, 0) + '%' : ''}</span></div>
        </div>
        <p class="mbf-note">Nothing on this schedule is typed. The rate build-up gives the time each trade takes for a
          unit of work, the bill gives the quantity, the rate card gives the day rate — the days, the hours and the
          money are all multiplied out of the three.</p>
      </div>

      <div class="mat-kpis lab-kpis">
        <div class="mat-kpi"><span>Trades on the job</span><b>${t.trades}</b><em>from ${t.items} priced items</em></div>
        <div class="mat-kpi"><span>Man-days</span><b>${fmt(t.days)}</b><em>${fmt(t.hours, 0)} hours at ${t.hoursADay} a day</em></div>
        <div class="mat-kpi"><span>Labour cost</span><b>${sym} ${fmt(t.cost)}</b><em>average ${sym} ${fmt(t.avgDay)} a man-day</em></div>
        <div class="mat-kpi"><span>Crew on site</span><b>${fmt(t.crew, 1)} men</b><em>over ${weeks} weeks · ${t.workDays} working days</em></div>
      </div>

      <div class="mat-tools no-print">
        <label class="lab-prog" for="lab-weeks">Programme
          <select id="lab-weeks" class="mat-sel" data-plain="1" aria-label="How many weeks the job runs">
            ${LAB_PROG.map(w => `<option value="${w}"${w === weeks ? ' selected' : ''}>${w} weeks</option>`).join('')}
          </select>
        </label>
        <span class="hint lab-prog-hint">sets the crew, not the days — the days come from the bill</span>
        <span class="mat-grow"></span>
        <span class="mat-exports">
          <button class="btn sm" id="btn-lab-xlsx" title="Export the labour schedule as an Excel workbook">Excel</button>
          <button class="btn sm" id="btn-lab-pdf" title="Export the labour schedule as a PDF">PDF</button>
          <button class="btn sm" id="btn-lab-print" title="Print the labour schedule on A4">Print</button>
        </span>
      </div>

      <div id="lab-host">
        <div class="lab-sec-h"><h3>Days and cost by trade</h3>
          <span class="hint">press a trade to see the bill items its days are made of</span></div>
        <div class="lab-scroll">${labTradeTable(m, false)}</div>
        ${labAssessed(m)}

        <div class="lab-sec-h"><h3>The same labour, bill by bill</h3>
          <span class="hint">${m.bills.length} bills carry labour; the days are the same days in another order</span></div>
        <div class="lab-scroll">${labBillTable(m, false)}</div>
      </div>

      <div class="mat-foot no-print">
        <span class="hint">${t.trades} trades · ${fmt(t.days)} man-days · ${sym} ${fmt(t.cost)} of measured labour
          ${t.assessedCost ? '· ' + sym + ' ' + fmt(t.assessedCost) + ' assessed' : ''} · follows the bill and the rate card</span>
      </div>
      ` : labEmpty()}

      <div class="row no-print lab-nav">
        <button class="btn" data-step="7">← Back to the material schedule</button>
        <span class="hint">Issue this with the bill: it is the labour half of what the rates were built from.</span>
        <span style="flex:1"></span>
        <button class="btn primary" data-step="9">Continue to the Cost Breakdown →</button>
      </div>
    </section>`;
  }

  /* -------------------------------------------------------- cost breakdown
     The bill says what the job costs; this says where the money goes. The
     shares come from the rate build-up, the money comes from the bill, so
     the heads always add up to the contract sum. */

  function cbModelNow() {
    const C = window.CostBreak;
    if (!C || typeof C.model !== 'function') return null;
    return C.model(state.params, recompute());
  }

  /* a stacked bar of the heads. `amounts` is an object of head → money and
     `total` the money the bar represents (the contract sum, or one bill). */
  function cbStack(amounts, total, opts) {
    const sym = SYM(state.params);
    const o = opts || {};
    const heads = (window.CostBreak.HEADS || []);
    const parts = heads.map(h => ({ id: h.id, label: h.label, v: +amounts[h.id] || 0 }))
      .filter(p => p.v > 0);
    const sum = parts.reduce((s, p) => s + p.v, 0) || 1;
    const denom = total || sum;
    return `<div class="cb-bar${o.small ? ' cb-bar-sm' : ''}"${o.title ? ` title="${esc(o.title)}"` : ''}>${
      parts.map(p => {
        const w = p.v / denom * 100;
        const pct = sum ? p.v / sum * 100 : 0;
        return `<span class="cb-seg cb-${p.id}" style="width:${w.toFixed(3)}%"
          title="${esc(p.label)} — ${sym} ${fmt(p.v)} (${fmt(pct, 1)}%)"></span>`;
      }).join('')
    }</div>`;
  }

  function cbHeadsTable(m) {
    const sym = SYM(state.params);
    const t = m.totals;
    return `<table class="mat-table cb-table">
      <thead><tr>
        <th style="width:26%">Cost head</th>
        <th style="width:26%">What it covers</th>
        <th class="num" style="width:16%">Amount (${sym})</th>
        <th class="num" style="width:10%">% of sum</th>
        <th class="num" style="width:10%">${sym}/m²</th>
        <th style="width:12%">Share</th>
      </tr></thead>
      <tbody>${m.heads.map(h => `<tr class="cb-row${h.id === 'contingency' ? ' cb-cont' : ''}">
        <td class="cb-head"><i class="cb-dot cb-${h.id}"></i><b>${esc(h.label)}</b></td>
        <td class="cb-blurb">${esc(h.blurb)}</td>
        <td class="num cb-money cb-amt" data-l="Amount">${fmt(h.amount)}</td>
        <td class="num cb-pct" data-l="% of sum">${fmt(h.pct, 1)}%</td>
        <td class="num cb-m2" data-l="${sym} per m\u00b2">${t.GFA > 0 ? fmt(h.perM2) : '\u2014'}</td>
        <td class="cb-share" data-l="Share"><span class="cb-mini"><i class="cb-${h.id}" style="width:${Math.min(100, h.pct).toFixed(1)}%"></i></span></td>
      </tr>`).join('')}</tbody>
      <tfoot><tr>
        <td>CONTRACT SUM</td>
        <td class="hint">${t.bills} bills${t.contingency > 0 ? ' + contingency' : ''}</td>
        <td class="num cb-amt" data-l="Amount">${fmt(t.grand)}</td>
        <td class="num cb-pct" data-l="% of sum">100%</td>
        <td class="num cb-m2" data-l="${sym} per m\u00b2">${t.GFA > 0 ? fmt(t.perM2) : '\u2014'}</td>
        <td></td>
      </tr></tfoot>
    </table>`;
  }

  function cbBillTable(m, print) {
    const sym = SYM(state.params);
    const t = m.totals;
    const billOf = code => String(code || '');
    return `<table class="${print ? 'mp-table' : 'mat-table cb-bt'}">
      <thead><tr>
        <th style="width:7%">Bill</th>
        <th style="width:33%">Description</th>
        <th class="num" style="width:14%">Amount (${sym})</th>
        <th class="num" style="width:8%">% of sum</th>
        <th class="num" style="width:10%">${sym}/m²</th>
        <th style="width:28%">Where the bill’s money goes</th>
      </tr></thead>
      <tbody>${m.bills.map(b => `<tr${print ? '' : ' class="mat-row cb-brow"'}>
        <td class="cb-billno">${esc(billOf(b.code).replace(/BILL\s*No\.?\s*/i, 'B'))}</td>
        <td class="cb-bt-title">${esc(b.title || '')}</td>
        <td class="num cb-money cb-amt" data-l="Amount">${fmt(b.amount)}</td>
        <td class="num cb-pct" data-l="% of sum">${fmt(b.pct, 1)}%</td>
        <td class="num cb-m2" data-l="${sym} per m\u00b2">${t.GFA > 0 ? fmt(b.perM2) : '\u2014'}</td>
        <td class="cb-bt-bar" data-l="Where the bill\u2019s money goes">${cbStack(b.heads, b.amount, {
          small: true,
          title: 'Materials ' + fmt(b.heads.materials / (b.amount || 1) * 100, 0) + '% \u00b7 Labour '
            + fmt(b.heads.labour / (b.amount || 1) * 100, 0) + '% \u00b7 Plant '
            + fmt(b.heads.plant / (b.amount || 1) * 100, 0) + '% \u00b7 Sundries '
            + fmt(b.heads.sundry / (b.amount || 1) * 100, 0) + '% \u00b7 O&P '
            + fmt(b.heads.overheads / (b.amount || 1) * 100, 0) + '%'
        })}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr>
        <td colspan="2">TOTAL &nbsp;·&nbsp; ${t.bills} ${t.bills === 1 ? 'bill' : 'bills'}</td>
        <td class="num cb-amt" data-l="Amount">${fmt(t.subtotal)}</td>
        <td class="num cb-pct" data-l="% of sum">${fmt(t.subtotal / (t.grand || 1) * 100, 1)}%</td>
        <td class="num cb-m2" data-l="${sym} per m\u00b2">${t.GFA > 0 ? fmt(t.subtotal / t.GFA) : '\u2014'}</td>
        <td class="cb-bt-bar">${cbStack(t, t.subtotal, { small: true })}</td>
      </tr></tfoot>
    </table>`;
  }

  function cbNote(m) {
    const sym = SYM(state.params);
    const t = m.totals;
    let labourLine = '';
    const L = window.Labour;
    if (L && typeof L.model === 'function') {
      const lm = L.model(state.params, recompute());
      if (lm && lm.totals && lm.totals.labourValue > 0) {
        const diff = t.labour - lm.totals.labourValue;
        labourLine = Math.abs(diff) < 1
          ? ` The Labour Schedule values the same days at ${sym} ${fmt(lm.totals.labourValue)} — the two agree to the cent.`
          : ` The Labour Schedule prices the measured days at the day rates in the card: ${sym} ${fmt(lm.totals.labourValue)}.`
            + ` The ${sym} ${fmt(Math.abs(diff))} between them is where the rates the bill carries sit above or below their build-ups;`
            + ` this page follows the bill's money so that the heads add up to the contract sum.`;
      }
    }
    return `<div class="cb-note">
      <p><b>Every figure ties to the bill.</b> ${t.bills} bills carry ${sym} ${fmt(t.subtotal)}${t.contingency > 0
        ? `, contingency adds ${sym} ${fmt(t.contingency)} at ${fmt(t.contingencyPct, 1)}% of the sum` : ''},
        and the heads add up to the contract sum of <b>${sym} ${fmt(t.grand)}</b> — to the cent.</p>
      <p>The split is read out of the rate build-up: each rate is made of the materials its recipe lists, the trades it
        allows for, the plant and the sundries, plus the overheads-and-profit uplift. An assessed rate is split into its
        supply and fix shares.${labourLine}</p>
      ${m.totals.unclassified > 0 ? `<p><b>${sym} ${fmt(m.totals.unclassified)}</b> sits on rates with no build-up at all
        (lump sums typed by hand) — the money is counted, the split is not guessed, so it is carried under overheads and profit.</p>` : ''}
    </div>`;
  }

  function cbPrintSheet(m) {
    const p = state.params;
    const sym = SYM(p);
    const t = m.totals;
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return `
    <div class="mat-print-sheet lab-print-sheet cb-print-sheet">
      <div class="mp-head">
        <div class="mp-kick">Cost breakdown</div>
        <h1>${esc(p.projectName)}</h1>
        <div class="mp-sub">${esc(p.projectSub)}</div>
        ${p.location ? `<div class="mp-loc">${esc(p.location)}</div>` : ''}
        <div class="mp-meta">Currency ${esc(sym)} · Date ${esc(dateStr)} · ${t.bills} bills ·
          ${fmt(t.GFA)} m² · ${sym} ${fmt(t.perM2)} per m²</div>
      </div>
      <div class="cb-p-sum">
        <div><span>CONTRACT SUM</span><b>${sym} ${fmt(t.grand)}</b></div>
        <div><span>BILLS</span><b>${sym} ${fmt(t.subtotal)}</b></div>
        <div><span>CONTINGENCY</span><b>${sym} ${fmt(t.contingency)}</b></div>
        <div><span>PER M²</span><b>${sym} ${fmt(t.perM2)}</b></div>
      </div>
      ${cbStack(m.heads.reduce((o, h) => { o[h.id] = h.amount; return o; }, {}), t.grand, { title: 'the contract sum' })}
      <div class="cb-p-legend">${m.heads.map(h => `<span><i class="cb-dot cb-${h.id}"></i>${esc(h.label)}
        <b>${fmt(h.pct, 1)}%</b></span>`).join('')}</div>

      <div class="lab-p-block"><div class="lab-p-h">Where the money goes</div>
        <div class="lab-scroll">${cbHeadsTable(m)}</div></div>

      <div class="lab-p-block"><div class="lab-p-h">Every bill, broken down</div>
        <div class="lab-scroll">${cbBillTable(m, true)}</div></div>

      <div class="mp-endnote">Each rate in the build-up is made of materials, labour, plant, sundries and an overheads-and-profit
        uplift; each assessed rate of a supply share and a fix share. Multiplying those shares by the money the bill
        charges gives this page, and the heads add up to the contract sum to the cent. A corrected quantity, a changed rate
        or a changed day rate moves it.</div>
      <div class="mp-sign"><span>Prepared by ____________________</span><span>Checked by ____________________</span><span>Date ____________</span></div>
    </div>`;
  }

  function costBreakScreen(r) {
    const p = state.params;
    const sym = SYM(p);
    const m = cbModelNow();
    if (!m) {
      return `<section class="panel"><h2>Cost breakdown</h2>
        <p class="lede">The cost engine did not load.</p></section>`;
    }
    const t = m.totals;
    const has = t.grand > 0;
    const headsById = {};
    m.heads.forEach(h => { headsById[h.id] = h; });

    return `
    <section class="panel mat-panel cb-panel">
      ${cbPrintSheet(m)}
      <h2><span class="stepno">9 · </span>Cost breakdown</h2>
      <p class="lede">The same bill read as money: what goes on materials, what goes on labour, what on plant and
        sundries, what the contractor keeps for overheads and profit, and what is held as contingency — for the job
        as a whole and bill by bill. Every figure is multiplied out of the priced bill, so it changes when the
        measurement or the rates do.</p>

      ${has ? `
      <div class="cb-top">
        <div class="cb-top-main">
          <div class="mbf-kick">The contract sum, split by what pays for it
            <span>${t.bills} bills · ${t.items} priced items</span></div>
          ${cbStack(m.heads.reduce((o, h) => { o[h.id] = h.amount; return o; }, {}), t.grand)}
          <div class="cb-legend">${m.heads.map(h => `<span class="cb-key"><i class="cb-dot cb-${h.id}"></i>${esc(h.label)}
            <b>${fmt(h.pct, 1)}%</b></span>`).join('')}</div>
        </div>
        <div class="cb-top-side">
          <span class="cb-sum-label">Contract sum</span>
          <b class="cb-sum-val">${sym} ${fmt(t.grand)}</b>
          <span class="cb-sum-sub">${sym} ${fmt(t.perM2)} a square metre over ${fmt(t.GFA)} m²</span>
        </div>
      </div>

      <div class="mat-kpis cb-kpis">
        <div class="mat-kpi"><span>Materials and components</span><b>${sym} ${fmt(t.materials)}</b>
          <em>${fmt(t.materialsPct, 1)}% of the sum · ${sym} ${fmt(t.GFA > 0 ? t.materials / t.GFA : 0)}/m²</em></div>
        <div class="mat-kpi"><span>Labour</span><b>${sym} ${fmt(t.labour)}</b>
          <em>${fmt(t.labourPct, 1)}% of the sum · ${sym} ${fmt(t.GFA > 0 ? t.labour / t.GFA : 0)}/m²</em></div>
        <div class="mat-kpi"><span>Plant, plant hire and sundries</span><b>${sym} ${fmt(t.plant + t.sundry)}</b>
          <em>${fmt(t.plantPct + t.sundryPct, 1)}% of the sum · ${sym} ${fmt(t.GFA > 0 ? (t.plant + t.sundry) / t.GFA : 0)}/m²</em></div>
        <div class="mat-kpi"><span>Overheads, profit and contingency</span><b>${sym} ${fmt(t.overheads + t.contingency)}</b>
          <em>${fmt(t.overheadsPct + t.contingencyPct, 1)}% of the sum · ${sym} ${fmt(t.GFA > 0 ? (t.overheads + t.contingency) / t.GFA : 0)}/m²</em></div>
      </div>

      <div class="mat-tools no-print">
        <span class="hint">Read it by cost head, or by bill — the same money both ways.</span>
        <span class="mat-grow"></span>
        <span class="mat-exports">
          <button class="btn sm" id="btn-cb-xlsx" title="Export the cost breakdown as an Excel workbook">Excel</button>
          <button class="btn sm" id="btn-cb-pdf" title="Export the cost breakdown as a PDF">PDF</button>
          <button class="btn sm" id="btn-cb-print" title="Print the cost breakdown on A4">Print</button>
        </span>
      </div>

      <div class="lab-sec-h"><h3>Where the money goes</h3>
        <span class="hint">a rate is made of these; the contingency is added on top of the bills</span></div>
      <div class="lab-scroll">${cbHeadsTable(m)}</div>

      <div class="lab-sec-h"><h3>Every bill, broken down</h3>
        <span class="hint">${t.bills} bills in bill order · the bar shows each bill's own mix</span></div>
      <div class="lab-scroll">${cbBillTable(m, false)}</div>

      ${cbNote(m)}

      <div class="mat-foot no-print">
        <span class="hint">${t.bills} bills · ${t.items} priced items · ${sym} ${fmt(t.subtotal)} + contingency
          ${sym} ${fmt(t.contingency)} = ${sym} ${fmt(t.grand)} · follows the bill and the rate card</span>
      </div>
      ` : `<div class="mat-empty lab-empty cb-empty">
        <b>Nothing to break down yet</b>
        The bill carries no priced work, so there is no money to split. Measure the work on the take-off sheet and
        price it on the bill — the cost heads appear here as soon as the bill carries money.
        <div class="row" style="justify-content:center;margin-top:10px">
          <button class="btn sm" data-step="6">Open the bill of quantities</button>
          <button class="btn sm" data-step="5">Back to the take-off sheet</button>
        </div>
      </div>`}

      <div class="row no-print lab-nav">
        <button class="btn" data-step="8">← Back to the labour schedule</button>
        <span class="hint">Issue this with the bill: it is the money behind the schedules.</span>
        <span style="flex:1"></span>
        <button class="btn primary" data-step="10">Continue to export →</button>
      </div>
    </section>`;
  }

  function step4() {
    const r = recompute();
    const p = state.params;
    return `
    <section class="panel boq-panel">
      <div class="print-only" style="margin-bottom:14px">
        <div style="border-bottom:2.5pt solid #1f4e3d;padding-bottom:6px;margin-bottom:8px">
          <div style="font-size:10pt;font-weight:700;letter-spacing:.08em;color:#1f4e3d">REPUBLIC OF GHANA</div>
          <div style="font-size:17pt;font-weight:750;margin-top:2px">${esc(p.projectName)}</div>
          <div style="font-size:11pt;color:#2e6b55">${esc(p.projectSub)}</div>
          <div style="font-size:9.5pt;color:#555;margin-top:2px">${esc(p.location)}</div>
        </div>
        <div style="background:#1f4e3d;color:#fff;padding:5px 10px;font-weight:700;font-size:11pt;letter-spacing:.06em">BILL OF QUANTITIES</div>
        <table class="head-table" style="margin-top:8px;font-size:9pt">
          <tr><td style="width:110px;color:#555">Client</td><td><b>${esc(p.client || '________________________________')}</b>${p.clientAddr ? '<br><span style="color:#555">' + esc(p.clientAddr) + '</span>' : ''}</td>
              <td style="width:110px;color:#555">Date of bill</td><td style="width:130px">${esc(p.billDate || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))}</td></tr>
          <tr><td style="color:#555">Consultant</td><td>${esc(p.consultant || '')}${p.consultantAddr ? '<br><span style="color:#555">' + esc(p.consultantAddr) + '</span>' : ''}</td>
              <td style="color:#555">Tender ref.</td><td>${esc(p.tenderRef || '—')}</td></tr>
          <tr><td style="color:#555">Contractor</td><td>${esc(p.contractor || '')}${p.contractorClass ? '<br><span style="color:#555">' + esc(p.contractorClass) + '</span>' : ''}</td>
              <td style="color:#555">Contract period</td><td>${esc(p.contractPeriod || '—')}</td></tr>
          <tr><td style="color:#555">Gross floor area</td><td>${fmt(r.GFA)} m²</td>
              <td style="color:#555">Currency</td><td>${esc(p.curLabel || "Ghana Cedi")} (${esc(SYM(p))})</td></tr>
          <tr><td style="color:#555">Basis</td><td colspan="3">Ghana Standard Method of Measurement · rates at Q4 2026 Greater Accra market</td></tr>
          ${p.priceNote ? `<tr><td style="color:#555">Prices</td><td colspan="3">${esc(p.priceNote)}</td></tr>` : ''}
        </table>
        <div style="font-size:8pt;color:#666;margin-top:6px">Produced with Quick Quantity from drawing image${state.image ? ' “' + esc(state.image.name) + '”' : ''}. Quantities measured from the model; verify before tender.</div>
      </div>
      <h2><span class="stepno">6 · </span>Bill of Quantities</h2>
      <p class="lede">Measured and priced from your plan. Rates are editable — type over any figure and the totals follow.</p>

      <div class="row no-print" style="gap:18px;flex-wrap:wrap;background:var(--card-2);border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:9.5pt">
        <div><span style="color:var(--muted)">Client</span><br><b>${esc(p.client || '— not set —')}</b></div>
        <div><span style="color:var(--muted)">Consultant</span><br><b>${esc(p.consultant || '— not set —')}</b></div>
        <div><span style="color:var(--muted)">Contractor</span><br><b>${esc(p.contractor || '— not set —')}</b></div>
        <div><span style="color:var(--muted)">Tender ref.</span><br><b>${esc(p.tenderRef || '—')}</b></div>
        <div style="flex:1"></div>
        <button class="btn sm" data-step="5" title="Back to the measured quantities">← Take-off sheet</button>
        <button class="btn sm" id="btn-struct" title="Check the columns and beams of this plan, then turn the bars into a schedule">Structural check</button>
        <button class="btn sm" id="btn-bbs" title="The steel behind the reinforcement item: bar marks, shapes, cut lengths and weights">Bending schedule</button>
        <button class="btn sm" id="btn-edit-parties">Edit particulars</button>
      </div>

      <div class="sum-card">
        <div>
          <div class="row">
            <div class="field no-print" style="max-width:180px"><label>Contingency %</label>
              <input type="number" data-p="contingency" step="0.5" min="0" max="25" value="${p.contingency}"></div>
            <div style="flex:1"></div>
            <button class="btn sm no-print" id="btn-live-prices" title="Fetch current prices when online">Update prices online</button>
            <button class="btn sm no-print" id="btn-reset-rates">Reset rates to Q4 2026 market</button>
            <button class="btn primary sm no-print" id="btn-excel-bill" title="Download the final Bill of Quantities as an Excel workbook">Export final BoQ as Excel</button>
            <button class="btn sm no-print" id="btn-pdf2">Download PDF</button>
            <button class="btn sm no-print" id="btn-print">Print</button>
          </div>
          <div class="hint" id="bill-price-note" style="margin-top:8px">${esc(p.priceNote || 'Rates as issued: Q4 2026 Greater Accra market rates')}</div>
          <div class="hint no-print" style="margin-top:4px">This bill is kept automatically in
            <button class="linkbtn" id="btn-projects4">Saved bills</button> — press
            <button class="linkbtn" id="btn-save-lib">Save now</button> for a copy you can name.</div>
          ${(p.country && p.country !== 'Ghana') ? `<div class="hint" style="margin-top:4px;color:#8a5a00">Rates are the Ghana market card shown in ${esc(p.curCode)}. Press <b>Update prices online</b> with a price feed or AI key to price for ${esc(p.country)}, or edit the rates directly.</div>` : ''}
        </div>
        <div class="grand">
          <div class="label">Grand total</div>
          <div class="amount">${SYM(p)} ${fmt(r.grand)}</div>
          <div class="words">${esc(words(r.grand, r.params))} Only</div>
        </div>
      </div>

      ${r.bills.map(boqTable).join('')}

      <div class="bill-block">
        <div class="bill-head">SUMMARY OF BILLS</div>
        <table class="bill-table">
          <thead><tr><th>Bill</th><th>Description</th><th class="num">Amount (${SYM(p)})</th></tr></thead>
          <tbody>
            ${r.bills.map(b => `<tr><td style="width:46px">${esc(b.code.replace('BILL No. ', ''))}</td><td>${esc(b.title)}</td>
              <td class="num" style="width:130px">${fmt(b.total)}</td></tr>`).join('')}
          </tbody>
          <tfoot>
            <tr><td colspan="2" style="text-align:right">Sub-total of bills</td><td class="num">${fmt(r.subtotal)}</td></tr>
            <tr><td colspan="2" style="text-align:right">Contingency at ${p.contingency}%</td><td class="num">${fmt(r.contingency)}</td></tr>
            <tr><td colspan="2" style="text-align:right">GRAND TOTAL</td><td class="num">${fmt(r.grand)}</td></tr>
          </tfoot>
        </table>
        <div class="row" style="margin-top:12px;justify-content:space-between">
          <span class="hint no-print">Gross floor area ${fmt(r.GFA)} m² · ${SYM(p)} ${fmt(r.perM2)} per m²${p.priceNote ? ' · ' + esc(p.priceNote) : ''}</span>
          <button class="btn primary no-print" data-step="7">Continue to the Material Schedule →</button>
        </div>
        <div class="print-only" style="margin-top:10px;font-size:8.5pt;color:#555">
          Gross floor area ${fmt(r.GFA)} m² · average ${SYM(p)} ${fmt(r.perM2)} per m² · ${esc(p.priceNote || 'rates are Q4 2026 Greater Accra market rates')}.
        </div>
        <div class="print-only" style="margin-top:18px">
          <div style="font-weight:700;color:#1f4e3d;font-size:9.5pt;letter-spacing:.04em;margin-bottom:6px">SIGNATURES</div>
          <table class="head-table" style="font-size:8.5pt">
            <tr>
              <td style="width:33%;vertical-align:top;padding-right:14px">
                <b>For the Client / Employer</b><br>
                ${esc(p.client || '')}<br><br>
                Name: ................................................<br>
                Signature &amp; stamp: ..............................<br>
                Date: ..................................................
              </td>
              <td style="width:33%;vertical-align:top;padding:0 14px">
                <b>For the Consultant</b><br>
                ${esc(p.consultant || '')}<br><br>
                Name: ................................................<br>
                Signature &amp; stamp: ..............................<br>
                Date: ..................................................
              </td>
              <td style="width:33%;vertical-align:top;padding-left:14px">
                <b>For the Contractor</b><br>
                ${esc(p.contractor || '')}<br><br>
                Name: ................................................<br>
                Signature &amp; stamp: ..............................<br>
                Date: ..................................................
              </td>
            </tr>
          </table>
        </div>

      </div>
    </section>`;
  }

  /* ---------------------------------------------------------------- step 5 */
  function step5() {
    const r = recompute(), p = state.params;
    return `
    <section class="panel">
      <h2><span class="stepno">10 · </span>Export</h2>
      <p class="lede">Everything below happens on your device. Choose what you need.</p>

      <div class="grid3">
        <div class="side-card" style="margin:0">
          <h4>PDF</h4>
          <p class="hint">A finished PDF bill — cover, preambles, all ${r.bills.length} bills, summary and signatures.</p>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="btn-pdf">PDF (.pdf)</button>
            <button class="btn" id="btn-print2">Print</button>
          </div>
        </div>
        <div class="side-card" style="margin:0">
          <h4>Spreadsheet</h4>
          <p class="hint">Excel workbook with the priced bill plus a summary and basis sheet, or a plain CSV.</p>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="btn-xlsx">Export final BoQ as Excel (.xlsx)</button>
            <button class="btn" id="btn-csv">CSV</button>
          </div>
        </div>
        <div class="side-card" style="margin:0">
          <h4>Word document</h4>
          <p class="hint">Editable bill with cover, preambles, all ${r.bills.length} bills, summary and signature blocks.</p>
          <button class="btn primary" id="btn-docx" style="margin-top:10px">Word (.docx)</button>
        </div>
        <div class="side-card" style="margin:0">
          <h4>Saved bills</h4>
          <p class="hint">Every bill is kept in this browser's database — open it again to export or print it later,
          even after a restart, with no connection.</p>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="btn-projects5">Saved bills</button>
            <button class="btn" id="btn-save-lib2">Save a copy</button>
          </div>
        </div>
        <div class="side-card" style="margin:0">
          <h4>Project file</h4>
          <p class="hint">JSON you can re-open later to continue editing, including the uploaded image.</p>
          <div class="row" style="margin-top:10px">
            <button class="btn" id="btn-save-json">Save</button>
            <button class="btn" id="btn-load-json">Open</button>
          </div>
        </div>
      </div>

      <div class="divider"></div>
      <h3 style="font-size:15px;margin-bottom:8px">Project details on the bill</h3>
      <div class="grid2">
        <div class="field"><label>Project name</label><input data-p="projectName" value="${esc(state.params.projectName)}"></div>
        <div class="field"><label>Sub-title</label><input data-p="projectSub" value="${esc(state.params.projectSub)}"></div>
        <div class="field"><label>Client</label><input data-p="client" value="${esc(state.params.client || '')}" placeholder="Name of school / client"></div>
        <div class="field"><label>Location</label><input data-p="location" value="${esc(state.params.location)}"></div>
      </div>

      <div class="divider"></div>
      <div class="note">
        <b>Grand total: ${SYM(state.params)} ${fmt(r.grand)}</b> for ${fmt(r.GFA)} m² (${SYM(state.params)} ${fmt(r.perM2)}/m²), ${r.bills.length} bills,
        ${r.bills.reduce((s, b) => s + b.items.length, 0)} measured items.
        ${state.savedAt ? 'Autosaved on this device.' : ''}
      </div>
    </section>

    <section class="panel">
      <h2>Where the prices come from</h2>
      <p class="lede">Every figure in the bill is priced from the rate card below. This is the record to keep with the tender.</p>
      <table class="basis-table">
        <tbody>
          <tr><td>Source of the rates</td><td>${esc(priceSource(p))}</td></tr>
          <tr><td>Country and currency</td><td>${esc(p.country || 'Ghana')} · ${esc(SYM(p))} (${esc((p.curName || 'Cedis') + ' / ' + (p.curSub || 'Pesewas'))})</td></tr>
          <tr><td>Rate card dated</td><td>${esc(rateDateText(p))}</td></tr>
          <tr><td>Cedi index applied</td><td>${indexText(p)}</td></tr>
          <tr><td>Rates carried in this bill</td><td>${Object.keys(seededRates()).length} priced rates${p.priceNote ? ' — ' + esc(p.priceNote) : ''}</td></tr>
        </tbody>
      </table>
      <p class="hint" style="margin-top:8px">Any rate can be edited: <b>Settings → Rates</b> lists every item with its bill, unit and
        quantity, and <b>Build-up</b> shows how each rate is made up from materials and labour.</p>
      <div class="row no-print" style="margin-top:10px">
        <button class="btn sm" id="btn-live-prices4">Update prices online</button>
        <button class="btn sm" id="btn-settings-rates">Change rates…</button>
      </div>
    </section>

    <section class="panel">
      <h2>Before you issue the bill</h2>
      <p class="lede">Standard checks a quantity surveyor would make.</p>
      <table>
        <tbody>
          <tr><td>Confirm the scale</td><td class="hint">One known dimension on the drawing must match the model (${fmt(isSchool() ? state.params.overallW : state.params.bW)} m overall width).</td></tr>
          <tr><td>Confirm foundation depth</td><td class="hint">Taken as ${fmt(state.params.foundDepth, 2)} m; laterite/gravel assumed. Measure on site before tendering.</td></tr>
          <tr><td>Verify rates</td><td class="hint">${esc(p.priceNote || 'Rates are Q4 2026 Greater Accra market rates')} — replace with current supplier quotations.</td></tr>
          <tr><td>Check exclusions</td><td class="hint">Furniture, external electrical reticulation, access roads, boundary wall and land are excluded.</td></tr>
        </tbody>
      </table>
      <div class="row" style="margin-top:16px">
        <button class="btn" data-step="6">← Back to the bill</button>
        <button class="btn" id="btn-print3">Print</button>
      </div>
    </section>`;
  }

  /* ---------------------------------------------------------- price basis */
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  function priceSource(p) {
    const n = String(p.priceNote || '');
    if (/^AI price check/.test(n)) {
      return 'AI price check' + (p.aiModel ? ' (' + p.aiModel + ')' : '') +
        (p.pricesUpdated ? ' — ' + p.pricesUpdated : '');
    }
    if (/^Rates updated from/.test(n)) {
      return 'Price feed' + (p.ratesFeedUrl ? ' — ' + p.ratesFeedUrl : '') +
        (p.pricesUpdated ? ' (' + p.pricesUpdated + ')' : '');
    }
    if (/^Prices indexed|^Prices confirmed/.test(n)) return 'Cedi index on the built-in card';
    if (/^Baseline set/.test(n)) return 'Cedi baseline on the built-in card';
    return 'Built-in card — Q4 2026, Greater Accra market rates';
  }
  function rateDateText(p) {
    const d = String(p.ratesBasisDate || '2026-10-01');
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    if (!m || +m[2] < 1 || +m[2] > 12) return d;
    return MONTHS[+m[2] - 1] + ' ' + m[1] + ' (' + d + ')';
  }
  function indexText(p) {
    const f = Number(p.fxApplied) || 1;
    const pct = (f - 1) * 100;
    if (Math.abs(pct) < 0.05) return 'none — rates as compiled';
    return (pct > 0 ? '+' : '') + pct.toFixed(1) + '% on the built-in card';
  }

  /* ------------------------------------------------------- the take-off */
  /* Every quantity the bill will price carries the item's own key; a figure
     typed on the take-off sheet is kept against that key, with the
     description it was entered against, so a correction can never land on a
     different item after the building model changes. */
  function takeoffKey(bill, item) {
    return bill.code + '|' + (item.key || String(item.desc).slice(0, 28));
  }

  function takeoffOf() {
    if (!state.params.takeoff || typeof state.params.takeoff !== 'object') state.params.takeoff = {};
    return state.params.takeoff;
  }

  /* Put the corrected quantities into a freshly measured bill and re-add the
     totals, so the bill page, the exports and the saved record all agree. */
  /* ---------------------------------------------------------------- the drain
     A drain is one measurement and a train of consequences: the trench, the
     bed, the backfill and the test all follow the length of the run, and the
     chambers on it follow it too — a longer run needs another manhole, and
     every chamber brings its excavation, base, walls, render and benching.
     So when the run is corrected on the take-off sheet the rows measured
     off it move with it — unless that row carries a figure of its own, in
     which case the figure typed is the one that stays. The same works from
     the other end: correct the number of manholes and the per-chamber rows
     follow the new count. */

  /* how many chambers a run of this length needs — the rule the model uses */
  const chambersFor = run => Math.max(2, Math.ceil((+run || 0) / 15) + 1);

  function followDrainage(r) {
    const bills = (r && r.bills) || [];
    const D = window.Drainage;
    if (!D) return;
    const drain = bills.find(b => /DRAINAGE WORKS/i.test(b.title));
    if (!drain) return;
    const item = (b, key) => (b && b.items || []).find(x => x.key === key);

    /* the length: a corrected run carries the trench, the bed, the backfill
       and the test with it */
    const run = item(drain, 'pipe110');
    const runFixed = !!(run && run.corrected && run.measured > 0);
    const runNow = runFixed ? run.qty : (run ? run.measured : null);
    if (runFixed) {
      /* re-measured from the new length, not scaled from the old one: a run of
         80 m is 80 x 0.45 x 0.90 m3 of trench, whatever the old figure was */
      const len = D.measure({ run: runNow, chambers: 1 });
      ['drainExc', 'drainBed', 'drainBack', 'drainTest'].forEach(k => {
        const it = item(drain, k);
        if (!it || it.corrected) return;
        const row = len.rows.find(x => x.key === k);
        if (!row) return;
        const q = row.qty;
        if (Math.abs(q - it.qty) < 1e-9) return;
        it.qty = q;
        it.followed = true;
        it.amount = Math.round(q * it.rate * 100) / 100;
      });
    }

    /* the chambers: a typed count wins, otherwise the rule follows the run —
       and either way every row measured per chamber is re-measured for the
       count that stands, so the schedule and the bill carry the same figures */
    const mh = bills.find(b => /MANHOLE WORKS/i.test(b.title));
    if (!mh) return;
    const cover = item(mh, 'mhCover');
    if (!cover || !(cover.measured > 0)) return;
    const n = cover.corrected ? Math.round(cover.qty)
      : (runNow != null ? D.chambersFor(runNow) : Math.round(cover.measured));
    if (!(n > 0)) return;

    const per = D.measure({ run: runNow != null ? runNow : 0, chambers: n });
    if (!cover.corrected && n !== cover.qty) {
      cover.qty = n;
      cover.followed = true;
      cover.amount = Math.round(n * cover.rate * 100) / 100;
    }
    per.rows.forEach(x => {
      if (['excManhole', 'mhBlind', 'mhBase', 'mhWall', 'mhRender', 'mhBench', 'mhBack'].indexOf(x.key) < 0) return;
      const it = item(mh, x.key);
      if (!it || it.corrected) return;
      if (Math.abs(x.qty - it.qty) < 1e-9) { return; }
      it.qty = x.qty;
      it.followed = true;
      it.amount = Math.round(x.qty * it.rate * 100) / 100;
    });
    mh.total = Math.round((mh.items || []).reduce((t, x) => t + x.amount, 0) * 100) / 100;
  }

  function applyTakeoff(r) {
    if (!r || !r.bills) return r;
    const p = state.params;
    const ov = p.takeoff || {};
    const dels = p.takeoffDel || {};
    const adds = p.takeoffAdd || {};

    r.bills.forEach(b => {
      // items taken off the bill
      const drop = dels[b.code] || [];
      if (drop.length) {
        b.items = b.items.filter(it => drop.indexOf(takeoffKey(b, it)) < 0);
      }
      // corrected quantities and rates
      b.items.forEach(it => {
        it.measured = it.qty;
        it.measuredRate = it.rate;
        const o = ov[takeoffKey(b, it)];
        if (!o) return;
        const ownText = typeof o.desc === 'string' && o.desc.trim() !== '';
        if (!ownText && o.d && String(it.desc).indexOf(o.d) !== 0) return;   // the item moved on
        let touched = false;
        if (ownText && o.desc !== it.desc) { it.desc = o.desc; it.descEdited = true; touched = true; }
        if (o.u && o.u !== it.unit) { it.unit = o.u; it.unitEdited = true; touched = true; }
        if (typeof o.q === 'number' && isFinite(o.q) && Math.abs(o.q - it.qty) >= 1e-9) {
          it.qty = o.q; it.corrected = true; touched = true;
        }
        if (typeof o.r === 'number' && isFinite(o.r) && o.r >= 0 && Math.abs(o.r - it.rate) >= 1e-9) {
          it.rate = o.r; it.rateEdited = true; touched = true;
        }
        /* a description that carries a specification — the mix, the thickness,
           the depth — prices its own row, unless a rate was typed over it */
        if (ownText && !it.rateEdited && typeof RateBuild !== 'undefined' && RateBuild.rateFromDesc) {
          const d = RateBuild.rateFromDesc(p, it.key, it.desc, it.unit, it.rate);
          if (d) {
            it.specNote = d.note || '';
            if (d.changed && d.rate > 0 && Math.abs(d.rate - it.rate) >= 0.005) {
              it.rate = d.rate; it.rateFromDesc = true; touched = true;
            }
          }
        }
        if (touched) it.amount = Math.round(it.qty * it.rate * 100) / 100;
      });
      // items added by hand, carried at the end of their own bill
      (adds[b.code] || []).forEach(x => {
        const qty = +x.qty || 0, rate = +x.rate || 0;
        b.items.push({
          desc: x.desc, unit: x.unit || 'Item', qty: qty, rate: rate,
          amount: Math.round(qty * rate * 100) / 100,
          key: 'add:' + x.id, addId: x.id, added: true
        });
      });
      // an order set by dragging rows on the take-off sheet
      const order = (p.takeoffOrder || {})[b.code];
      if (order && order.length) {
        const pos = {};
        order.forEach((k, i) => { pos[k] = i; });
        b.items = b.items.map((it, i) => ({ it: it, i: i })).sort((a, c) => {
          const da = /^Additional preliminaries/i.test(String(a.it.desc)) ? 1 : 0;
          const dc = /^Additional preliminaries/i.test(String(c.it.desc)) ? 1 : 0;
          if (da !== dc) return da - dc;               // the calculated line stays last
          const pa = pos.hasOwnProperty(takeoffKey(b, a.it)) ? pos[takeoffKey(b, a.it)] : 1e6 + a.i;
          const pc = pos.hasOwnProperty(takeoffKey(b, c.it)) ? pos[takeoffKey(b, c.it)] : 1e6 + c.i;
          return pa - pc;
        }).map(x => x.it);
      }
      b.total = Math.round(b.items.reduce((t, x) => t + x.amount, 0) * 100) / 100;
    });

    // the drainage run carries everything measured off it — and the two bills
    // that carry it are re-added, or their pages and their totals disagree
    followDrainage(r);
    r.bills.forEach(b => {
      b.total = Math.round((b.items || []).reduce((t, x) => t + x.amount, 0) * 100) / 100;
    });

    // the preliminaries balancing item is a percentage of the measured works,
    // so it moves with every correction, addition and removal on the sheet
    const pre = r.bills[0];
    if (pre && /PRELIMINAR/i.test(pre.title) && +p.prelimPct > 0) {
      const bal = pre.items.find(it => /^Additional preliminaries/i.test(String(it.desc)));
      if (bal) {
        const works = r.bills.slice(1).reduce((t, b) => t + b.total, 0);
        const fixed = pre.items.reduce((t, x) => t + (x === bal ? 0 : x.amount), 0);
        const amount = Math.round(Math.max(0, works * (+p.prelimPct) / 100 - fixed) * 100) / 100;
        if (Math.abs(amount - bal.amount) > 0.004) {
          bal.qty = 1; bal.rate = amount; bal.amount = amount;
        }
      }
      pre.total = Math.round(pre.items.reduce((t, x) => t + x.amount, 0) * 100) / 100;
    }

    r.subtotal = Math.round(r.bills.reduce((t, b) => t + b.total, 0) * 100) / 100;
    r.contingency = Math.round(r.subtotal * (+p.contingency || 0)) / 100;
    r.vat = Math.round((r.subtotal + r.contingency) * (+p.vatPct || 0)) / 100;
    r.grand = Math.round((r.subtotal + r.contingency + r.vat) * 100) / 100;
    r.perM2 = Math.round(r.grand / Math.max(1, r.GFA || 1) * 100) / 100;
    return r;
  }

  /* ---- descriptions from the database ------------------------------------
     Every description the app already knows can be used again: the price
     book (materials, labour and plant) and the items the measurement has
     produced, bill by bill. Typing in the description field offers them; a
     pick fills the description in, plus the unit and — for a measured item —
     the rate. The text stays a text field, so a picked description can be
     worded differently before the item is added. */
  let acList = [], acAt = -1;

  function descDb() {
    const out = [], seen = {};
    const push = (d, u, r, src, bill, cat) => {
      d = String(d || '').replace(/\s+/g, ' ').trim();
      if (!d) return;
      const k = d.toLowerCase() + '|' + String(u || '');
      if (seen[k]) return;
      seen[k] = 1;
      out.push({ d: d, u: u || '', r: +r || 0, src: src, bill: bill || '', cat: cat || '' });
    };
    if (typeof RateBuild !== 'undefined' && RateBuild.INPUTS) {
      RateBuild.INPUTS.forEach(i => push(i.label, i.unit, i.price, 'Price book', '', i.cat));
    }
    ((state.result && state.result.bills) || []).forEach(b => {
      (b.items || []).forEach(it => push(it.desc, it.unit, it.rate, b.code.replace('BILL No. ', 'Bill '), b.code, b.title));
    });
    return out;
  }

  // how well a description answers what has been typed; -1 means "not at all"
  function acScore(it, q, code) {
    const d = it.d.toLowerCase();
    let s = it.bill && it.bill === code ? 8 : 0;
    const at = d.indexOf(q);
    if (at >= 0) {
      const isStart = at === 0 || d.charAt(at - 1) === ' ';
      const after = d.charAt(at + q.length);
      const isEnd = !after || !/[a-z0-9]/.test(after);
      s += isStart && isEnd ? 65 : isStart ? 50 : isEnd ? 40 : 22;
      if (at === 0) s += 6;
    } else {
      const words = q.split(/\s+/).filter(Boolean);
      if (words.some(w => d.indexOf(w) < 0)) return -1;
      s += words.length * 10;
    }
    return s - Math.min(20, d.length / 25);
  }

  /* The list is drawn at the top of the page, not inside the bill: a bill
     clips what sticks out of it, and a clipped list is an invisible list. */
  let acPop = null;
  function acPopEl() {
    if (!acPop) {
      acPop = document.createElement('div');
      acPop.className = 'ac-pop';
      acPop.setAttribute('role', 'listbox');
      acPop.hidden = true;
      document.body.appendChild(acPop);
    }
    return acPop;
  }

  function acInput() {
    return document.querySelector('.to-add-desc');
  }

  // under the field, or above it when the floor is near
  function acPlace() {
    const input = acInput(), pop = acPop;
    if (!input || !pop || pop.hidden) return;
    const r = input.getBoundingClientRect();
    const m = 10, gap = 6, vw = window.innerWidth, vh = window.innerHeight;
    const width = Math.max(260, Math.min(560, vw - m * 2));
    pop.style.width = Math.round(width) + 'px';
    pop.style.left = Math.round(Math.max(m, Math.min(r.left, vw - width - m))) + 'px';
    const h = pop.offsetHeight || 0;
    let top = r.bottom + gap;
    if (top + h > vh - m) {
      const above = r.top - h - gap;
      top = above >= m ? above : Math.max(m, vh - m - h);
    }
    pop.style.top = Math.round(top) + 'px';
  }

  function acClose() {
    if (acPop) { acPop.hidden = true; acPop.innerHTML = ''; }
    const input = acInput();
    if (input) input.setAttribute('aria-expanded', 'false');
    acList = []; acAt = -1;
  }

  function acPaint() {
    document.querySelectorAll('.ac-pop .ac-row').forEach((r, i) => r.classList.toggle('on', i === acAt));
    const on = document.querySelector('.ac-pop .ac-row.on');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }

  function acOpen(input, q) {
    const form = input.closest('.to-add-form');
    if (!form) return;
    const pop = acPopEl();
    const box = form.closest('.to-add');
    const code = box ? box.dataset.addbox : '';
    const all = descDb();
    let list;
    if (!q) {
      // a spread, not four cements: this bill first, then one example of
      // each price-book category, then the rest of the bills
      const here = all.filter(it => it.bill === code);
      const book = all.filter(it => it.src === 'Price book' && !/labour|plant/i.test(it.cat || ''));
      const seenCat = {};
      const spread = [];
      book.forEach(it => {
        const c = it.cat || '';
        if (seenCat[c]) return;
        seenCat[c] = 1;
        spread.push(it);
      });
      const other = all.filter(it => it.bill && it.bill !== code);
      list = here.slice(0, 4).concat(spread.slice(0, 4), other.slice(0, 2)).slice(0, 8);
    } else {
      const scored = [];
      all.forEach(it => { const s = acScore(it, q, code); if (s >= 0) scored.push([s, it]); });
      scored.sort((a, b) => b[0] - a[0]);
      list = scored.slice(0, 8).map(x => x[1]);
    }
    acList = list;
    acAt = -1;
    if (!list.length) {
      pop.innerHTML = `<div class="ac-foot">Nothing in the database matches “${esc(input.value.trim())}” — the description will be used as typed.</div>`;
      pop.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      acPlace();
      return;
    }
    pop.innerHTML = list.map((it, i) => `
      <button type="button" class="ac-row" data-ac="${i}" role="option">
        <span class="ac-d">${esc(it.d)}</span>
        <span class="ac-m">${it.src === 'Price book'
          ? esc(it.u || '') + (it.cat ? ' · ' + esc(it.cat) : '')
          : esc(it.u || '') + (it.r ? ' · ' + SYM(state.params) + ' ' + fmt(it.r) : '')}</span>
        <span class="ac-src">${esc(it.src)}</span>
      </button>`).join('') +
      `<div class="ac-foot">${all.length} descriptions in the database · pick one, then change it if you need to</div>`;
    pop.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    acPlace();
  }

  function acPick(i) {
    const it = acList[i];
    const input = acInput();
    const form = input && input.closest('.to-add-form');
    if (!it || !form) return;
    input.value = it.d;
    const unit = form.querySelector('.to-add-unit');
    if (unit && it.u) {
      const want = it.u.toLowerCase();
      const opt = Array.from(unit.options).find(o => o.value.toLowerCase() === want || o.textContent.trim().toLowerCase() === want);
      if (opt) unit.value = opt.value;
      else { const o2 = document.createElement('option'); o2.value = it.u; o2.textContent = it.u; unit.appendChild(o2); unit.value = it.u; }
    }
    const rate = form.querySelector('.to-add-rate');
    if (rate && it.bill && it.r && !String(rate.value).trim()) rate.value = Math.round(it.r * 100) / 100;
    acClose();
    const qty = form.querySelector('.to-add-qty');
    (qty || input).focus();
  }

  /* ---- adding and removing items on the sheet ---------------------------- */
  function openAddForm(code) {
    const box = Array.from(document.querySelectorAll('.to-add')).find(b => b.dataset.addbox === code);
    if (!box) return;
    box.innerHTML = `<div class="to-add-form">
      <div class="ac-wrap">
        <input class="to-add-desc" type="text" maxlength="160" autocomplete="off"
          placeholder="Description — type, or pick from the database" aria-label="Description of the new item"
          role="combobox" aria-expanded="false" aria-autocomplete="list">
        <button type="button" class="ac-btn" id="to-ac-btn" tabindex="-1"
          title="Show the descriptions in the database" aria-label="Show the descriptions in the database">▾</button>
      </div>
      <select class="to-add-unit" aria-label="Unit">
        <option value="m2">m²</option><option value="m3">m³</option><option value="m">m</option>
        <option value="kg">kg</option><option value="No.">No.</option><option value="Item" selected>Item</option>
        <option value="t">t</option><option value="L">L</option>
      </select>
      <input class="to-add-qty" type="number" min="0" step="any" placeholder="Qty" aria-label="Quantity">
      <input class="to-add-rate" type="number" min="0" step="any" placeholder="Rate" aria-label="Rate">
      <button class="btn sm primary" id="to-add-save">Add the item</button>
      <button class="btn sm" id="to-add-cancel">Cancel</button>
    </div>`;
    const d = box.querySelector('.to-add-desc');
    if (d) d.focus();
  }

  function saveAddedItem() {
    const form = document.querySelector('.to-add-form');
    const box = form && form.closest('.to-add');
    if (!form || !box) return;
    const code = box.dataset.addbox;
    const desc = String(form.querySelector('.to-add-desc').value || '').trim();
    const unit = form.querySelector('.to-add-unit').value || 'Item';
    const qty = parseFloat(form.querySelector('.to-add-qty').value);
    const rate = parseFloat(form.querySelector('.to-add-rate').value);
    if (!desc) { toast('Give the new item a description'); form.querySelector('.to-add-desc').focus(); return; }
    if (!isFinite(qty) || qty < 0) { toast('The quantity has to be a number'); form.querySelector('.to-add-qty').focus(); return; }
    if (!isFinite(rate) || rate < 0) { toast('The rate has to be a number'); form.querySelector('.to-add-rate').focus(); return; }
    state.params.takeoffAdd = state.params.takeoffAdd || {};
    const list = state.params.takeoffAdd[code] = state.params.takeoffAdd[code] || [];
    list.push({ id: 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1000), desc: desc, unit: unit, qty: qty, rate: rate });
    state.params.takeoffDel = state.params.takeoffDel || {};
    delete state.params.takeoffDel[code];
    rerenderTakeoff(null);
    toast('Added to ' + code.replace('BILL No. ', 'bill ') + ' — ' + fmt(qty, 2) + ' ' + unit + ' at ' + fmt(rate, 2));
  }

  function removeTakeoffItem(key) {
    const i = key.indexOf('|');
    const code = i < 0 ? key : key.slice(0, i);
    state.params.takeoffDel = state.params.takeoffDel || {};
    const list = state.params.takeoffDel[code] = state.params.takeoffDel[code] || [];
    if (list.indexOf(key) < 0) list.push(key);
    if (state.params.takeoff) delete state.params.takeoff[key];
    rerenderTakeoff(null);
    toast('Item taken off the bill — “Restore removed” puts it back');
  }

  function removeAddedItem(k) {
    const i = k.indexOf('|');
    const code = k.slice(0, i), id = k.slice(i + 1);
    const list = ((state.params.takeoffAdd || {})[code] || []).filter(x => x.id !== id);
    if (list.length) state.params.takeoffAdd[code] = list;
    else delete state.params.takeoffAdd[code];
    rerenderTakeoff(null);
    toast('Added item removed');
  }

  function restoreTakeoffItems(code) {
    if (state.params.takeoffDel) delete state.params.takeoffDel[code];
    rerenderTakeoff(null);
    toast('Every removed item is back on the bill');
  }

  /* the sheet is long: come back to the row that was just edited, with the
     bills that were open still open */
  function rerenderTakeoff(selector) {
    const y = window.scrollY;
    const openBills = [...document.querySelectorAll('details.to-bill[open] > summary b')].map(b => b.textContent);
    state.result = recompute();
    render();
    [...document.querySelectorAll('details.to-bill')].forEach(d => {
      const name = d.querySelector('summary b');
      d.open = !!name && openBills.indexOf(name.textContent) >= 0;
    });
    const again = selector ? document.querySelector(selector) : null;
    if (again) {
      try { again.focus(); again.setSelectionRange(again.value.length, again.value.length); } catch (e) {}
    }
    window.scrollTo(0, y);
    save();
  }

  /* ---------------------------------------------------------------- render */
  function render() {
    renderSteps();
    paintUserChip();
    if (window.SearchSelect) window.SearchSelect.close();
    const host = $('#main');
    let html = '';
    if (state.step === 1) html = step1();
    else if (state.step === 2) html = step2();
    else if (state.step === 3) html = digitalStep();
    else if (state.step === 4) html = step3();
    else if (state.step === 5) html = step4Takeoff();
    else if (state.step === 6) html = step4();
    else if (state.step === 7) html = matSchedule(recompute());
    else if (state.step === 8) html = labourSchedule(recompute());
    else if (state.step === 9) html = costBreakScreen(recompute());
    else html = step5();
    host.innerHTML = (can('edit') ? '' : roBanner()) + html + stepFoot();
    /* the digital take-off borrows the room the summary card reserves; the card
       floats over the sheet when it is opened */
    document.body.classList.toggle('dt-step', state.step === 3);
    if (window.SearchSelect) window.SearchSelect.enhance(host);
    applyRole();

    // the building summary: a card on a wide screen, a modal on a phone,
    // closed by its ✕ and opened again from the button it leaves behind
    paintSide();

    if (state.step === 4) setTimeout(() => filterComponents(state.compSearch || ''), 0);
    if (state.step === 2) setTimeout(drawOverlay, 30);
    if (state.step === 1) { filterGroupCards(state.grpSearch || ''); setTimeout(paintRecent, 0); }
    if (state.step === 3) setTimeout(mountDigital, 20);
    if (state.step === 5) requestAnimationFrame(() => document.querySelectorAll('.to-desc').forEach(sizeTakeoffDesc));
    save();
  }

  /* ---------------------------------------------------------------- the foot
     The way back to the plan, at the bottom of every step. It only moves the
     screen: the measurement, the rates and the bill are left exactly as they
     are, so stepping back to look at the drawing or load a better sheet costs
     nothing. */
  function stepFoot() {
    if (state.step === 1) return '';
    return `<div class="step-foot no-print">
      <button class="btn primary" data-step="1" title="Step 1 — the plan, its sheets and the scale">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        Go to upload</button>
      <p class="sf-note">Step 1 — the plan picture, the sheets inside it and the scale.
        <b>Everything you have typed stays</b>: the rooms, the take-off, the rates and the bill.</p>
    </div>`;
  }

  /* ---------------------------------------------------------------- users */
  function roBanner() {
    const u = user();
    return `<div class="ro-banner" role="status">
      <span class="role role-reviewer">Read-only</span>
      <span>Signed in as <b>${esc(u ? u.name : 'a reviewer')}</b>. Every bill can be read, printed and exported —
        rates and quantities cannot be changed. An administrator can give this account another role.</span>
    </div>`;
  }

  function paintUserChip() {
    const slot = document.getElementById('user-slot');
    const u = user();
    if (!slot) return;
    if (!u) { slot.innerHTML = ''; return; }
    slot.innerHTML = `<button class="btn ghost sm user-chip" id="btn-user"
        title="${esc(u.name)} · ${esc(Users.roleLabel(u.role))} — profile, switch user, sign out">
        <span class="avatar" style="background:${esc(u.colour)}">${esc(u.initials)}</span>
        <span class="uname">${esc(u.name.split(' ')[0])}</span>
      </button>`;
    const b = document.getElementById('btn-user');
    if (b) b.addEventListener('click', e => Users.menu(e.currentTarget));
  }

  /* a reviewer's screen: everything that changes the bill is turned off.
     Deny by default — a control added later is off unless it is named here. */
  const RO_KEEP = /export|print|download|pdf|excel|word|csv|open|view|back|continue|next|previous|search|sign in/i;
  function applyRole() {
    const ro = !can('edit');
    document.body.classList.toggle('ro', ro);
    if (!ro) return;
    const main = $('#main');
    if (!main) return;
    main.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.type === 'search' || el.id === 'mat-q' || el.id === 'lib-search') return;
      el.disabled = true;
    });
    main.querySelectorAll('button').forEach(b => {
      if (b.dataset.step !== undefined) return;               // moving between steps is reading
      if (/^btn-(print|pdf|xlsx|excel-bill|docx|csv|save-json|pdf2)/.test(b.id || '')) return;
      if (RO_KEEP.test((b.textContent || '').trim())) return;
      b.disabled = true;
    });
  }

  /* ---------------------------------------------------------------- actions */
  // images go straight to the analyser; PDFs are rasterised first (pdf.js
  // is bundled in this file, so this works offline)
  async function imageFromFile(file, page) {
    if (typeof PdfImport !== 'undefined' && PdfImport.isPdf(file)) {
      const r = await PdfImport.toImage(file, page || 1, 2300);
      const img = await PlanAnalyser.loadDataUrl(r.dataUrl);
      return { img, dataUrl: r.dataUrl, name: file.name, size: file.size,
               pdf: { name: file.name, pages: r.pages, page: r.page } };
    }
    const out = await PlanAnalyser.readFile(file);
    return { img: out.img, dataUrl: out.dataUrl, name: out.name, size: out.size, pdf: null };
  }

  /* Take the size of the building from the plan when the scale is real and
     the room schedule agrees with what is measured. When the two disagree,
     say so and leave the decision to the user. Returns a note for the toast. */
  function adoptMeasuredSize(quiet) {
    const a = state.analysis;
    if (!a || isSchool()) return '';
    const b = scaleBasis(a);
    if (!b.known) return '';
    const w = +(a.bbox.w * b.mmPerPx / 1000).toFixed(2);
    const dd = +(a.bbox.h * b.mmPerPx / 1000).toFixed(2);
    if (!(w > 2 && dd > 2)) return '';
    const p = state.params;
    const net = (p.rooms || []).reduce((t, r) => t + (+r.L || 0) * (+r.W || 0) * (+r.n || 1), 0);
    const storeys = Math.max(1, +p.storeys || 1);
    const expected = net ? net / storeys / 0.75 : 0;   // per floor
    const note = ' · plan measures ' + fmt(w) + ' × ' + fmt(dd) + ' m';
    if (expected && Math.abs(w * dd - expected) / expected <= 0.25) {
      const k = Math.max(0.8, Math.min(1.25, Math.sqrt((w * dd) / Math.max(1, p.bW * p.bD))));
      p.bW = w; p.bD = dd;
      state.sizeAdopted = true;
      // the rooms keep filling the building they sit in — unless the drawing
      // itself gave the room sizes, which are not ours to change
      if (!state.roomRead) (p.rooms || []).forEach(r => {
        r.L = +(r.L * k).toFixed(2); r.W = +(r.W * k).toFixed(2);
      });
      state.result = recompute();
      if (!quiet) setTimeout(() => toast('Plan measured at ' + (b.printed ? '1:' + b.printed : 'the scale you set')
        + ' — ' + fmt(w) + ' × ' + fmt(dd) + ' m. The bill follows the drawing.'), 3200);
    } else if (Math.abs(w - p.bW) / Math.max(1, p.bW) > 0.1 && !quiet) {
      setTimeout(() => toast('The plan measures ' + fmt(w) + ' × ' + fmt(dd) + ' m but the rooms add up to '
        + fmt(net) + ' m². Check the scale, or press “Apply the measured size”.'), 3200);
    }
    return note;
  }

  let lastFileKey = null;   // is this a new file, or another page of the same one?

  /* ------------------------------------------------------------- many plans
     A building is rarely one sheet: a ground floor, an upper floor, a
     foundation plan, the roof, a site layout. Each file uploaded is kept as a
     plan with its own picture and its own scale, and one of them is the plan
     being measured — the one Read & scale and the digital take-off draw on and
     the one the bill is taken off. The others keep their pixels and their
     names, and can be measured instead by one click. */
  const PLAN_KINDS = [
    ['floor', 'Ground floor'], ['upper', 'Upper floor'],
    ['elevation', 'Elevation'], ['section', 'Section'], ['foundation', 'Foundation'],
    ['structural', 'Structural framing'], ['roof', 'Roof plan'], ['site', 'Site plan'],
    ['schedule-doors', 'Door & window schedule'], ['schedule-finishes', 'Finishes schedule'],
    ['electrical', 'Electrical layout'], ['plumbing', 'Plumbing layout'],
    ['other', 'Other']
  ];
  const planKindLabel = k => (PLAN_KINDS.find(x => x[0] === k) || ['', 'Plan'])[1];

  /* ------------------------------------------------------------ the floors
     A set has one floor plan per storey, and which storey a sheet belongs to
     is the thing a user needs to say — it decides which plan Read & scale
     draws, and how many storeys the bill is measured over. Every floor plan
     carries a level: 0 is the ground floor, 1 the first floor, and so on. */
  const FLOOR_NAMES = ['Ground floor', 'First floor', 'Second floor', 'Third floor',
                       'Fourth floor', 'Fifth floor', 'Sixth floor', 'Seventh floor'];
  const FLOOR_LIMIT = FLOOR_NAMES.length;
  const floorName = n => {
    const i = Math.max(0, Math.round(+n || 0));
    return FLOOR_NAMES[i] || ((i + 1) + 'th floor');
  };
  const isFloorPlan = p => !!p && (p.kind === 'floor' || p.kind === 'upper' ||
    (p.group ? p.group === 'floor' : (KIND_GROUP[p.kind] || 'floor') === 'floor'));
  /* what the file name says about the storey — "ground floor", "first floor",
     "1st floor", "upper floor", "ff", "gf" */
  function levelFromName(name) {
    const n = String(name || '').toLowerCase().replace(/[-_.]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!n) return null;
    if (/\b(ground|gf|g f|ground floor|lower)\b/.test(n)) return 0;
    if (/\b(first|1st|upper|uf|ff|1)\b/.test(n)) return 1;
    if (/\b(second|2nd|2)\b/.test(n)) return 2;
    if (/\b(third|3rd|3)\b/.test(n)) return 3;
    if (/\b(fourth|4th|4)\b/.test(n)) return 4;
    if (/\b(fifth|5th|5)\b/.test(n)) return 5;
    if (/\b(sixth|6th|6)\b/.test(n)) return 6;
    if (/\b(seventh|7th|7)\b/.test(n)) return 7;
    return null;
  }
  /* the lowest floor no other drawing has taken */
  function firstFreeLevel(except) {
    const used = new Set(plansOf().filter(p => p !== except && isFloorPlan(p) && p.level != null)
      .map(p => +p.level));
    let i = 0;
    while (used.has(i) && i < 40) i++;
    return i;
  }
  /* every floor that has a drawing, lowest first */
  function floorLevels() {
    const lv = plansOf().filter(isFloorPlan).map(p => Math.max(0, Math.round(+p.level || 0)));
    return Array.from(new Set(lv)).sort((a, b) => a - b);
  }
  const floorPlanAt = lv => plansOf().find(p => isFloorPlan(p) && Math.max(0, Math.round(+p.level || 0)) === lv) || null;
  /* the plan a user points at when they say "the first floor" */
  const floorLabelOf = p => (isFloorPlan(p) && p.level != null ? floorName(p.level) : planKindLabel(p.kind));

  /* ------------------------------------------------------ the drawing set
     A building is issued as a set, not a sheet: site plan, floor plans,
     elevations, sections, foundation, framing, roof, schedules, services.
     Every file the app is given goes into one of these eleven places — the
     file name says which, and can be changed in the row. The order is the
     order the set is bound in and the order the cards are drawn. */
  const DRAW_GROUPS = [
    { id: 'site', no: 1, label: 'Site Plan', short: 'a site plan',
      hint: 'Boundaries, levels, the septic tank and the ground the drain crosses. Trace the drain route on it in Read & scale.' },
    { id: 'floor', no: 2, label: 'Floor Plans', short: 'a floor plan',
      hint: 'The plan the building is measured from — ground floor, first floor, and any other. One of them is measured at a time.' },
    { id: 'elevation', no: 3, label: 'Elevations', short: 'an elevation',
      hint: 'Front, rear and side elevations — the roof line, the heights and the external finishes.' },
    { id: 'section', no: 4, label: 'Sections', short: 'a section',
      hint: 'The levels the bill uses: foundation depth, floor level, eaves and ridge.' },
    { id: 'foundation', no: 5, label: 'Foundation Plan', short: 'a foundation plan',
      hint: 'Footings, column bases and the substructure.' },
    { id: 'structural', no: 6, label: 'Structural Framing Plan', short: 'a framing plan',
      hint: 'Columns, beams, slabs and the reinforcement that runs in them.' },
    { id: 'roof', no: 7, label: 'Roof Plan', short: 'a roof plan', panel: 'roof',
      hint: 'The roof outline, pitch and covering, carried into the roofing bill.' },
    { id: 'schedule-doors', no: 8, label: 'Door & Window Schedule', short: 'a door and window schedule',
      hint: 'The marks, sizes and counts of every opening — read into the door and window schedule.' },
    { id: 'schedule-finishes', no: 9, label: 'Finishes Schedule', short: 'a finishes schedule',
      hint: 'Floor, wall and ceiling finishes, room by room.' },
    { id: 'electrical', no: 10, label: 'Electrical Layout', short: 'an electrical layout',
      hint: 'Points, fittings, the distribution board and the sub-main.' },
    { id: 'plumbing', no: 11, label: 'Plumbing Layout', short: 'a plumbing layout',
      hint: 'Sanitary fittings, water and soil runs, and the tank.' }
  ];

  /* which card a kind belongs in */
  const KIND_GROUP = {
    floor: 'floor', upper: 'floor', elevation: 'elevation', section: 'section',
    foundation: 'foundation', structural: 'structural', roof: 'roof', site: 'site',
    'schedule-doors': 'schedule-doors', 'schedule-finishes': 'schedule-finishes',
    electrical: 'electrical', plumbing: 'plumbing', other: 'floor'
  };
  const groupOfPlan = p => p.group || KIND_GROUP[p.kind] || 'floor';
  const plansIn = g => plansOf().filter(p => groupOfPlan(p) === g);
  const groupDef = g => DRAW_GROUPS.find(x => x.id === g) || DRAW_GROUPS[1];

  /* what a card answers to in the search over the set — its own name, the
     name a sheet of that kind carries, and the words printed on one */
  const GROUP_WORDS = {
    site: 'site plan plot location setting out boundaries boundary levels septic tank drain route',
    floor: 'floor plan plans ground first second third upper storey storeys levels rooms room',
    elevation: 'elevation elevations front rear side facade faces',
    section: 'section sections cross detail details levels foundation depth eaves ridge',
    foundation: 'foundation plan footings footing bases base raft substructure',
    structural: 'structural framing frame plan beams beam columns column slabs slab reinforcement',
    roof: 'roof plan roofing pitch covering eaves ridge',
    'schedule-doors': 'door window schedule doors windows openings opening joinery marks sizes',
    'schedule-finishes': 'finishes finish schedule floor wall ceiling painting tiling screed',
    electrical: 'electrical electric layout lighting light power socket sockets points board distribution sub main',
    plumbing: 'plumbing layout sanitary water soil waste tank manhole drainage drain pipes pipe'
  };
  const groupSearchText = g => (g.label + ' ' + (g.short || '') + ' ' + (GROUP_WORDS[g.id] || '')).toLowerCase();

  /* the kind a file takes when it is dropped straight into a card. It goes to
     the card it was dropped in — unless the name plainly says it belongs to
     another one, and the card is Floor Plans, where several sheets a set of
     elevations land by mistake. */
  function kindFromGroup(g, name) {
    if (g === 'floor') {
      const guess = planKindGuess(name);
      if (guess !== 'floor' && guess !== 'upper') return guess;
      return /(first|upper|second|1st|2nd|3rd)\b/i.test(String(name || '')) ? 'upper' : 'floor';
    }
    return g;
  }

  /* what the file's own name says it is — most specific first */
  function planKindGuess(name) {
    const n = String(name || '').toLowerCase().replace(/[-_]+/g, ' ');
    if (/(door|window|opening|joinery)[^a-z]{0,20}(sched|schedule|list)/.test(n) || /\b(door|window)s?\s+(and\s+\w+\s+)?schedule/.test(n)) return 'schedule-doors';
    if (/finish(es)?\s*(sched|schedule)|room\s+finish/.test(n)) return 'schedule-finishes';
    if (/electric|lighting|power layout|socket|light point/.test(n)) return 'electrical';
    if (/plumb|sanitary|water layout|soil\s*(and|&)\s*waste/.test(n)) return 'plumbing';
    if (/structur|framing|frame plan|\bbeams?\b|\bcolumns?\b|\bslabs?\b/.test(n)) return 'structural';
    if (/elevation/.test(n)) return 'elevation';
    if (/section/.test(n)) return 'section';
    if (/foundation|footing|sub ?struct|raft/.test(n)) return 'foundation';
    if (/roof/.test(n)) return 'roof';
    if (/site|setting ?out|location plan|boundary/.test(n)) return 'site';
    if (/\b(first|upper|second|1st|2nd|3rd)\b/.test(n)) return 'upper';
    if (/\b(ground|floor|plan|g\.?f\.?)\b/.test(n)) return 'floor';
    return 'floor';
  }

  /* a picture kept for the record is downsampled: eleven cards of full-size
     drawings would fill the browser's store on their own */
  function planStore(img, dataUrl) {
    const maxDim = 1400;
    const w = (img && (img.naturalWidth || img.width)) || 0;
    const h = (img && (img.naturalHeight || img.height)) || 0;
    if (!w || !h) return dataUrl;
    if (Math.max(w, h) <= maxDim && dataUrl.length < 480000) return dataUrl;
    const k = Math.min(1, maxDim / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    try { return c.toDataURL('image/jpeg', 0.8); } catch (e) { return dataUrl; }
  }

  function plansOf() {
    if (!Array.isArray(state.plans)) state.plans = [];
    /* a project saved before floors existed: a ground floor and an upper
       floor, named from the file, are given their storeys once */
    if (state.plans.some(x => isFloorPlan(x) && x.level == null)) {
      const used = new Set();
      state.plans.filter(x => isFloorPlan(x) && x.level != null)
        .forEach(x => used.add(Math.max(0, Math.round(+x.level || 0))));
      state.plans.filter(isFloorPlan).forEach(x => {
        if (x.level != null) return;
        let lv = levelFromName(x.name);
        if (lv == null) lv = x.kind === 'upper' ? 1 : 0;
        while (used.has(lv) && lv < FLOOR_LIMIT - 1) lv++;
        if (used.has(lv)) { lv = 0; while (used.has(lv)) lv++; }
        x.level = Math.min(FLOOR_LIMIT - 1, lv);
        used.add(x.level);
      });
    }
    return state.plans;
  }

  function planById(id) {
    return plansOf().find(p => p.id === id) || null;
  }

  function currentPlan() {
    return planById(state.planId) || plansOf()[0] || null;
  }

  /* a project opened from an older file has pixels but no plan list yet */
  function ensurePlanRecord() {
    if (plansOf().length || !state.image || !state.image.dataUrl) return;
    const rec = registerPlan({ name: state.image.name, size: state.image.size,
                               dataUrl: state.image.dataUrl, pdf: state.pdf, kind: planKindGuess(state.image.name) });
    state.planId = rec.id;
  }

  function planFileKey(file) {
    return file ? [file.name, file.size, file.lastModified || 0].join('|') : '';
  }

  function registerPlan(o) {
    const list = plansOf();
    /* one PDF can hold the ground floor and the first floor: each page that is
       measured becomes a drawing of its own, with its own floor */
    let key = planFileKey(o.file) || (String(o.name || 'plan') + '|' + (o.size || 0));
    const pg = o.pdf && o.pdf.page ? +o.pdf.page : 1;
    if (pg > 1) key += '|page ' + pg;
    let rec = list.find(p => p.key === key);
    if (!rec) {
      rec = {
        id: 'plan-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
        addedAt: new Date().toISOString()
      };
      list.push(rec);
    }
    rec.key = key;
    rec.name = o.name || rec.name || 'Plan';
    rec.size = o.size || rec.size || 0;
    if (o.dataUrl) rec.dataUrl = o.dataUrl;
    if (o.pdf) rec.pdf = { pages: o.pdf.pages || 1, page: o.pdf.page || 1 };
    if (o.sheets) rec.sheets = o.sheets;
    if (o.file) rec.file = o.file;                 // kept in memory only
    if (!rec.kind) rec.kind = o.kind || planKindGuess(rec.name);
    /* a floor plan is given a storey: the one its name says, or the lowest
       floor still free, so a set of three plans reads Ground / First / Second */
    if (isFloorPlan(rec) && rec.level == null && o.level != null) rec.level = Math.min(FLOOR_LIMIT - 1, Math.max(0, Math.round(+o.level)));
    if (isFloorPlan(rec) && rec.level == null) {
      const guess = levelFromName(rec.name);
      const taken = guess != null && plansOf().some(x => x !== rec && isFloorPlan(x) &&
        Math.max(0, Math.round(+x.level || 0)) === guess && x.level != null);
      rec.level = Math.min(FLOOR_LIMIT - 1, (guess != null && !taken) ? guess : firstFreeLevel(rec));
    }
    return rec;
  }

  /* the scale belongs to the drawing it was set on: a site plan at 1:500 is
     not the floor plan at 1:100, so each plan remembers its own */
  function planScaleNow() {
    return { mm: state.scaleMM, refPx: state.refPx, mode: state.scaleMode,
             ratio: state.ratio, paperMM: state.paperMM, source: state.scaleSource };
  }

  function storePlanScale() {
    const p = planById(state.planId);
    if (p) p.scale = planScaleNow();
  }

  /* I want this drawing to be the one that is measured */
  async function activatePlan(id) {
    const rec = planById(id);
    if (!rec || rec.id === state.planId) return;
    if (!rec.dataUrl) {
      toast('That plan\u2019s picture was not kept \u2014 add the file again to measure it');
      return;
    }
    storePlanScale();
    state.planId = rec.id;
    state.image = { dataUrl: rec.dataUrl, name: rec.name, size: rec.size };
    state.pdf = rec.pdf || null;
    state.pdfFile = rec.file || null;
    state.sheets = rec.sheets || null;
    state.sheetInfo = null;
    state.picked = [];
    state.drainPts = [];
    state.drainTrace = false;
    if (rec.scale && rec.scale.mode) {
      state.scaleMode = rec.scale.mode;
      state.ratio = +rec.scale.ratio || 100;
      state.paperMM = +rec.scale.paperMM || 420;
      if (rec.scale.mm) state.scaleMM = rec.scale.mm;
      if (rec.scale.source) state.scaleSource = rec.scale.source;
    }
    try {
      const img = await PlanAnalyser.loadDataUrl(rec.dataUrl);
      state.analysis = PlanAnalyser.analyse(img);
      state.refPx = state.analysis.refPx;
    } catch (e) { state.analysis = null; }
    syncScale();
    state.result = recompute();
    render(); save();
    toast('Measuring ' + rec.name);
  }

  /* Files into the set. A file dropped in a card goes to that card; a file
     dropped in the box above is read by its name and filed where it belongs.
     The first floor plan of an empty project is the one measured; a roof plan
     goes to the roof card, which reads its pitch and covering. */
  async function addPlanFiles(files, group) {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    if (!guard('edit')) return;
    const ok = list.filter(f => /^image\//.test(f.type) || (typeof PdfImport !== 'undefined' && PdfImport.isPdf(f)));
    if (!ok.length) { toast('Please choose image or PDF files'); return; }
    const typed = ok.map(f => ({ f: f, kind: group ? kindFromGroup(group, f.name) : planKindGuess(f.name) }));
    /* the drawing measured is the ground floor when the set has one, then an
       upper floor — never a schedule or a layout that sorts first */
    const measurePick = typed.find(x => x.kind === 'floor') || typed.find(x => x.kind === 'upper') || null;
    let measured = !!state.image;
    let firstReadable = null;
    const filed = [];
    for (let i = 0; i < typed.length; i++) {
      const x = typed[i];
      try {
        if (x.kind === 'roof') {
          await readRoofFile(x.f);
          filed.push(groupDef('roof').label);
          continue;
        }
        if (!firstReadable) firstReadable = x;
        /* the floor plan is the drawing the bill is taken off, so it is the
           one measured — never a schedule or a layout that happens to come
           first in the folder */
        if (!measured && measurePick && x === measurePick) {
          await handleFile(x.f, undefined, undefined, x.kind);
          measured = true;
          filed.push(x.f.name);
          continue;
        }
        const out = await imageFromFile(x.f);
        const stored = planStore(out.img, out.dataUrl);
        registerPlan({ file: x.f, name: out.name, size: out.size, dataUrl: stored,
                       pdf: out.pdf, kind: x.kind });
        /* a section or elevation filed here sets the levels the bill uses,
           the same way the section upload beside Read & scale does */
        if (x.kind === 'section' || x.kind === 'elevation') applyVerticalImage(out.img, out.name, out.dataUrl);
        filed.push(x.f.name);
      } catch (e) {
        if (window.console && console.warn) console.warn('Quick Quantity — could not file that drawing:', e && (e.message || e));
        toast('Could not read ' + x.f.name);
      }
    }
    /* nothing a bill can be measured from in the batch (a set of schedules,
       say): measure the first drawing, so Read & scale has something to show */
    if (!state.image && firstReadable) {
      try { await handleFile(firstReadable.f, undefined, undefined, firstReadable.kind); measured = true; } catch (e) { /* filed anyway */ }
    }
    render(); save();
    const g = group ? groupDef(group) : null;
    setTimeout(() => toast(filed.length + ' drawing' + (filed.length === 1 ? '' : 's') +
      (g ? ' filed under ' + g.label : ' filed in the set') +
      (measured && filed.length > 1 ? ' — the floor plan is measuring' : '')), 600);
  }

  function removePlan(id) {
    const list = plansOf();
    const i = list.findIndex(p => p.id === id);
    if (i < 0) return;
    const rec = list[i];
    if (list.length === 1 || rec.id === state.planId) {
      const others = list.filter(p => p.id !== id);
      if (!others.length) {
        if (!confirm('Remove ' + rec.name + '? The plan and its reading will be cleared.')) return;
      }
    }
    list.splice(i, 1);
    /* the floor on show has just lost its only drawing: show the rest again
       rather than leave the card looking empty */
    if (state.floorShow != null && !floorPlanAt(state.floorShow)) state.floorShow = null;
    if (rec.id === state.planId) {
      const next = list[0] || null;
      state.planId = null;
      if (next) { activatePlan(next.id); }
      else {
        state.image = null; state.analysis = null; state.pdf = null; state.pdfFile = null;
        state.sheets = null; state.sheetInfo = null; state.scaleMM = null; state.refPx = null;
        state.planId = null;
        state.result = recompute(); render(); save();
        toast('Plan removed');
        return;
      }
    }
    render(); save();
    toast(rec.name + ' removed');
  }

  /* one file in a card: its picture, its name, what it is, and what can be
     done with it — measure it (the drawing Read & scale works on) or lose it */
  function planRow(p) {
    const cur = currentPlan();
    const on = cur && p.id === cur.id;
    const lost = !p.dataUrl;
    const floor = isFloorPlan(p);
    const lv = Math.max(0, Math.round(+p.level || 0));
    return `<li class="plan-row${on ? ' on' : ''}" data-plan-row="${esc(p.id)}"${floor ? ` data-plan-floor="${lv}"` : ''}>
      <div class="plan-thumb">${p.dataUrl ? `<img src="${p.dataUrl}" alt="">` : '<span class="hint">no picture</span>'}</div>
      <div class="plan-main">
        <div class="plan-head">
          ${floor ? `<span class="floor-tag">${esc(floorName(lv))}</span>` : ''}
          <b>${esc(p.name)}</b>
          <button class="btn sm plan-x" data-plan-remove="${esc(p.id)}" title="Remove this drawing" aria-label="Remove ${esc(p.name)}">✕</button>
        </div>
        <div class="hint">${floor ? 'Floor plan' : planKindLabel(p.kind)}${p.size ? ' · ' + (p.size / 1024).toFixed(0) + ' KB' : ''}${
          p.pdf && p.pdf.pages > 1 ? ' · ' + p.pdf.pages + ' pages, page ' + p.pdf.page : ''}${
          lost ? ' · picture not kept' : ''}</div>
        <div class="plan-acts">
          ${floor ? `<label class="hint" style="margin:0">Floor
            <select data-plan-level="${esc(p.id)}" aria-label="Which floor this drawing is">${FLOOR_NAMES.map((n, i) =>
              `<option value="${i}"${i === lv ? ' selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
          <label class="hint" style="margin:0">As
            <select data-plan-kind="${esc(p.id)}">${(floor
              ? [['floor', 'Floor plan']].concat(PLAN_KINDS.filter(k => k[0] !== 'floor' && k[0] !== 'upper'))
              : PLAN_KINDS).map(k =>
              `<option value="${k[0]}"${(floor ? k[0] === 'floor' : k[0] === p.kind) ? ' selected' : ''}>${k[1]}</option>`).join('')}</select></label>
          ${on ? '<span class="chip ok">measuring</span>'
               : `<button class="btn sm" data-plan-measure="${esc(p.id)}"${lost ? ' disabled' : ''}>${floor ? 'Measure this floor' : 'Measure this'}</button>`}
        </div>
      </div>
    </li>`;
  }

  /* the filter over the floor plan card: one chip per floor that has a
     drawing, so a set of five sheets is read one storey at a time */
  function floorFilterBar(all) {
    if (!all.length) return '';
    const show = state.floorShow == null ? null : Math.round(+state.floorShow);
    const counts = new Map();
    all.forEach(p => {
      const lv = Math.max(0, Math.round(+p.level || 0));
      counts.set(lv, (counts.get(lv) || 0) + 1);
    });
    const levels = Array.from(counts.keys()).sort((a, b) => a - b);
    if (levels.length < 2) return '';
    const chip = (val, label, n, on) => `<button type="button" class="fchip${on ? ' on' : ''}"
      data-floor-show="${val}" aria-pressed="${on ? 'true' : 'false'}">${esc(label)}${n != null ? ' <span class="fchip-n">' + n + '</span>' : ''}</button>`;
    return `<div class="floor-bar" role="group" aria-label="Show one floor">
      <span class="hint">Show</span>
      ${chip('all', 'All floors', all.length, show == null)}
      ${levels.map(lv => chip(lv, floorName(lv), counts.get(lv), show === lv)).join('')}
      <span class="hint floor-bar-note">· ${levels.length} floors on file — each keeps its own scale</span>
    </div>`;
  }

  /* the files filed in a card, one row each — and, in the roof card, the
     reading of the roof plan beside them */
  function planRowsOf(g) {
    const list = plansIn(g.id);
    if (!list.length) return '';
    return `<ul class="plan-list">${list.map(planRow).join('')}</ul>`;
  }

  /* ------------------------------------------------------------------
     WHAT EACH DRAWING SETS
     Eleven cards, and every sheet carries the figures the bill takes
     from it: the apron off the site plan, the footings off the
     foundation plan, the column grid off the framing plan, the finishes
     off the schedule. A field is shown only on the template that prices
     it, so nothing on a card is a switch that does nothing.
     ------------------------------------------------------------------ */
  const finishOptions = () => Object.keys((typeof GenEngine !== 'undefined' && GenEngine.FLOOR_FINISH) || {})
    .map(k => [k, GenEngine.FLOOR_FINISH[k].label]);
  const ceilingOptions = () => Object.keys((typeof GenEngine !== 'undefined' && GenEngine.CEILING_FINISH) || {})
    .map(k => [k, GenEngine.CEILING_FINISH[k].label]);

  const SET_FIELDS = {
    site: {
      title: 'SITE PLAN',
      note: 'The apron, the boundary and the clearance are all measured off the site plan. A width of 0.5 m or more is drawn round the building; the boundary wall is priced only if the site has one.',
      fields: [
        { p: 'apronW', label: 'Apron width round the building (m)', type: 'num', min: 0.5, max: 3, step: 0.1 },
        { p: 'boundaryOn', label: 'Boundary wall and gate', type: 'bool', on: 'Priced in this bill', off: 'Not in this bill' },
        { p: 'siteClearFactor', label: 'Site clearance — times the footprint', type: 'num', min: 1, max: 3, step: 0.05 }
      ]
    },
    floor: {
      title: 'FLOOR PLAN',
      note: 'The walls the plan draws, and the size of the building behind them: the blockwork, the plaster and the floor finishes all follow these figures.',
      fields: [
        { p: 'wallT', label: 'Wall thickness (m)', type: 'num', min: 0.1, max: 0.3, step: 0.025 },
        { p: 'wallH', label: 'Wall height — floor to ceiling (m)', type: 'num', min: 2.2, max: 4.5, step: 0.05 },
        { p: 'storeys', label: 'Storeys on the plan', type: 'num', min: 1, max: 4, step: 1, onlyIf: 'general' },
        { p: 'floorH', label: 'Floor to floor (m)', type: 'num', min: 2.4, max: 4.5, step: 0.05, onlyIf: 'general' },
        { p: 'nClassrooms', label: 'Classrooms on the plan', type: 'num', min: 1, max: 8, step: 1, onlyIf: 'school' },
        { p: 'officeOn', label: "Head teacher's office", type: 'bool', on: 'On the plan', off: 'Not on the plan', onlyIf: 'school' }
      ]
    },
    elevation: {
      title: 'ELEVATION',
      note: 'The heights the elevations fix — the ground line, the wall height and the eaves — and how the outside of the wall is finished.',
      fields: [
        { p: 'plinth', label: 'Plinth above ground (m)', type: 'num', min: 0, max: 1.5, step: 0.05, onlyIf: 'general' },
        { p: 'eavesH', label: 'Eaves height (m — 0 works it out)', type: 'num', min: 0, max: 8, step: 0.1, onlyIf: 'general' },
        { p: 'externalFinish', label: 'External walls', type: 'sel', onlyIf: 'general',
          options: [['render', 'Cement render'], ['fairface', 'Fair-faced blockwork'], ['cladding', 'Cladding']] },
        { p: 'wallH', label: 'Height to eaves — wall height (m)', type: 'num', min: 2.2, max: 4.5, step: 0.05, onlyIf: 'school' },
        { p: 'balH', label: 'Verandah balustrade (m)', type: 'num', min: 0.6, max: 1.2, step: 0.05, onlyIf: 'school' }
      ]
    },
    section: {
      title: 'SECTION',
      note: 'The section cuts through the floor build-up: how deep the trench goes and how thick the hardcore and the oversite are under the slab.',
      fields: [
        { p: 'foundDepth', label: 'Foundation depth (m)', type: 'num', min: 0.3, max: 3, step: 0.1 },
        { p: 'hcThk', label: 'Hardcore bed (mm)', type: 'num', min: 50, max: 400, step: 10, scale: 1000 },
        { p: 'overThk', label: 'Oversite concrete (mm)', type: 'num', min: 50, max: 300, step: 10, scale: 1000 }
      ]
    },
    foundation: {
      title: 'FOUNDATION PLAN',
      note: 'The footings the foundation plan details: their type, their width and thickness, and the trench that takes them.',
      fields: [
        { p: 'foundType', label: 'Foundation type', type: 'sel', onlyIf: 'general',
          options: [['strip', 'Strip footing'], ['raft', 'Raft']] },
        { p: 'foundW', label: 'Footing width (m)', type: 'num', min: 0.3, max: 1.5, step: 0.05 },
        { p: 'foundT', label: 'Footing thickness (m)', type: 'num', min: 0.1, max: 0.6, step: 0.025 },
        { p: 'trenchW', label: 'Trench width (m)', type: 'num', min: 0.3, max: 2, step: 0.05, onlyIf: 'school' },
        { p: 'fdnWallH', label: 'Foundation wall height (m)', type: 'num', min: 0.3, max: 2.5, step: 0.05, onlyIf: 'school' }
      ]
    },
    structural: {
      title: 'STRUCTURAL FRAMING',
      note: 'The frame the framing plan sets out: the columns, the ring beam, the lintels over the openings and the bearing each one gets on the wall.',
      fields: [
        { p: 'colNos', label: 'Columns (No.)', type: 'num', min: 2, max: 24, step: 1, onlyIf: 'school' },
        { p: 'colBMm', label: 'Column width (mm)', type: 'num', min: 150, max: 600, step: 25 },
        { p: 'colDMm', label: 'Column depth (mm)', type: 'num', min: 150, max: 600, step: 25 },
        { p: 'rbDmm', label: 'Ring beam depth (mm)', type: 'num', min: 150, max: 600, step: 25, onlyIf: 'school' },
        { p: 'lintelDmm', label: 'Lintel depth (mm)', type: 'num', min: 150, max: 450, step: 25 },
        { p: 'bearingMm', label: 'Lintel bearing each side (mm)', type: 'num', min: 50, max: 400, step: 25 },
        { p: 'colSpacingM', label: 'Column grid (m centres)', type: 'num', min: 2, max: 8, step: 0.1, onlyIf: 'general' },
        { p: 'trussNos', label: 'Trusses (0 = as measured)', type: 'num', min: 0, max: 80, step: 1, onlyIf: 'school' }
      ]
    },
    'schedule-doors': {
      title: 'DOOR AND WINDOW SCHEDULE',
      note: 'The schedule itself is the take-off — its sizes and counts are edited there. These are the two things the schedule sets for the joinery bill: how the ironmongery is priced, and how much of the joinery is painted.',
      fields: [
        { p: 'ironmongeryBasis', label: 'Ironmongery', type: 'sel',
          options: [['lump', 'One item for the job'], ['perDoor', 'A set to every door']] },
        { p: 'joineryPaint', label: 'Gloss paint to joinery', type: 'sel',
          options: [['both', 'Both faces'], ['one', 'One face'], ['none', 'Not painted']] }
      ]
    },
    'schedule-finishes': {
      title: 'FINISHES SCHEDULE',
      note: 'The finishes the schedule names — the floor in the dry and the wet rooms, the ceiling, and the height of the tiles to the WC walls.',
      fields: [
        { p: 'floorFinish', label: 'Main floor finish', type: 'sel', onlyIf: 'school', options: finishOptions },
        { p: 'floorMain', label: 'Main floor finish', type: 'sel', onlyIf: 'general', options: finishOptions },
        { p: 'floorWet', label: 'Wet room floor', type: 'sel', options: finishOptions },
        { p: 'ceilingType', label: 'Ceiling', type: 'sel', options: ceilingOptions },
        { p: 'tileWallH', label: 'Tiling to WC walls (m high)', type: 'num', min: 0, max: 3, step: 0.1, onlyIf: 'school' }
      ]
    },
    electrical: {
      title: 'ELECTRICAL LAYOUT',
      note: 'The points and the fittings the electrical layout marks, and the services it has to feed.',
      fields: [
        { p: 'lightPointsPerRoom', label: 'Light points per classroom', type: 'num', min: 2, max: 12, step: 1, onlyIf: 'school' },
        { p: 'socketsPerRoom', label: 'Sockets per classroom', type: 'num', min: 0, max: 8, step: 1, onlyIf: 'school' },
        { p: 'svcElectrical', label: 'Electrical installation', type: 'bool', on: 'Priced in this bill', off: 'Not in this bill', onlyIf: 'general' },
        { p: 'svcGenerator', label: 'Standby generator', type: 'bool', on: 'Included', off: 'Not included', onlyIf: 'general' },
        { p: 'svcSolar', label: 'Solar PV system', type: 'bool', on: 'Included', off: 'Not included', onlyIf: 'general' },
        { p: 'svcHVAC', label: 'Air conditioning', type: 'bool', on: 'Included', off: 'Not included', onlyIf: 'general' },
        { p: 'svcFire', label: 'Fire detection and alarm', type: 'bool', on: 'Included', off: 'Not included', onlyIf: 'general' },
        { p: 'bulkheadNos', label: 'External bulkhead lights (No.)', type: 'num', min: 0, max: 20, step: 1 }
      ]
    },
    plumbing: {
      title: 'PLUMBING LAYOUT',
      note: 'The fittings the plumbing layout shows and where the waste goes — to a septic tank and soakaway, or to a sewer on the boundary.',
      fields: [
        { p: 'wcOn', label: 'WC and its fittings', type: 'bool', on: 'On the plan', off: 'Not on the plan', onlyIf: 'school' },
        { p: 'wcNos', label: 'WC suites (No.)', type: 'num', min: 1, max: 10, step: 1, onlyIf: 'school' },
        { p: 'svcPlumbing', label: 'Plumbing installation', type: 'bool', on: 'Priced in this bill', off: 'Not in this bill', onlyIf: 'general' },
        { p: 'svcBorehole', label: 'Borehole and storage', type: 'bool', on: 'Included', off: 'Not included', onlyIf: 'general' },
        { p: 'septicOn', label: 'Septic tank and soakaway', type: 'bool', on: 'Included', off: 'Not in this bill' }
      ]
    }
  };

  /* The manhole works and the drain, on the Plumbing Layout card: the run out
     of the building to the septic tank, the chambers on it and the pipe into
     the tank — the figures Bill 14 and Bill 15 are measured from. The full
     priced reading stays on Read & scale, where the plan can be traced. */
  function drainSettingsBlock() {
    if (typeof window.Drainage === 'undefined') return '';
    const d = drainState();
    const R = drainRead();
    const m = R.m, pr = R.priced;
    const cur = SYM(state.params);
    const traced = d.source === 'traced';
    const applied = !!(state.params.takeoff && Object.keys(state.params.takeoff).some(k => /\|(pipe110|mhCover)$/.test(k)));
    return `<div class="divider"></div>
      <h4 class="hint" style="margin:0 0 8px">MANHOLE WORKS AND DRAINAGE</h4>
      <div class="grid3">
        <div class="field"><label for="dr-run">Run to the tank (m)</label>
          <input id="dr-run" type="number" min="1" max="500" step="0.1" value="${fmt(m.run, 1)}">
          <span class="hint">${esc(R.basis)}</span></div>
        <div class="field"><label for="dr-chambers">Chambers on the run (No.)</label>
          <input id="dr-chambers" type="number" min="1" max="40" step="1" value="${m.chambers}">
          <span class="hint">one at the building, one every 15 m, one at the tank</span></div>
        <div class="field"><label for="dr-main">Pipe into the tank (m)</label>
          <input id="dr-main" type="number" min="0" max="60" step="1" value="${m.main}">
          <span class="hint">160 mm uPVC from the last chamber</span></div>
      </div>
      <p class="hint" style="margin-top:8px">Bill 14, manhole works, and Bill 15, drainage works, come to
        <b>${esc(cur)} ${fmt(pr.total)}</b> on these figures — ${m.chambers} chamber${m.chambers === 1 ? '' : 's'},
        ${fmt(m.trench)} m³ of trench and ${fmt(m.rows[5].qty)} m³ of chamber excavation${traced ? '; the route was traced on the plan' : ''}.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
        <button type="button" class="btn sm" data-drain-go="trace">${traced ? 'Trace the route again on the plan' : 'Measure the route on the plan'}</button>
        <button type="button" class="btn sm ${applied ? '' : 'primary'}" data-drain-apply="1">${applied ? 'Taken into the take-off' : 'Take these into the take-off'}</button>
        ${d.source && d.source !== 'plan' ? '<button type="button" class="btn sm" data-drain-plan="1">Back to the run the plan gives</button>' : ''}
        <span class="hint">${applied
          ? 'Held on the take-off sheet — the trench, bed, backfill and every chamber row follow these figures.'
          : 'Writes the run and the chamber count into the take-off; every row measured off them follows into Bills 14 and 15.'}</span>
      </div>`;
  }

  /* one labelled control, drawn like the roof type panel */
  function settingsControl(f) {
    const v = state.params[f.p];
    const id = 'set-' + f.p;
    let body;
    if (f.type === 'bool') {
      const on = v !== false && v != null;
      body = `<select id="${id}" data-p="${esc(f.p)}">
          <option value="true"${on ? ' selected' : ''}>${esc(f.on || 'Yes')}</option>
          <option value="false"${on ? '' : ' selected'}>${esc(f.off || 'No')}</option>
        </select>`;
    } else if (f.type === 'sel') {
      const opts = typeof f.options === 'function' ? f.options() : f.options;
      const cur = v == null ? '' : String(v);
      body = `<select id="${id}" data-p="${esc(f.p)}">${opts.map(([k, t]) =>
        `<option value="${esc(k)}"${String(k) === cur ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    } else {
      const sc = f.scale || 1;
      const shown = v == null || v === '' || !isFinite(+v) ? '' : Math.round((+v) * sc * 1000) / 1000;
      body = `<input id="${id}" type="number" data-p="${esc(f.p)}"${sc !== 1 ? ` data-scale="${sc}"` : ''}
          min="${f.min}" max="${f.max}" step="${f.step}" value="${shown}">`;
    }
    return `<div class="field"><label for="${id}">${esc(f.label)}</label>${body}</div>`;
  }

  /* the settings block of one card — the same shape as ROOF TYPE AND
     SETTINGS, so every sheet reads the same way */
  function settingsBlock(g) {
    const def = SET_FIELDS[g.id];
    if (!def) return '';
    const tpl = isSchool() ? 'school' : 'general';
    const fields = def.fields.filter(f => !f.onlyIf || f.onlyIf === tpl);
    if (!fields.length) return '';
    return `<div class="divider"></div>
      <h4 class="hint" style="margin:0 0 8px">${esc(def.title)} SETTINGS</h4>
      <div class="grid2" data-settings="${esc(g.id)}">${fields.map(settingsControl).join('')}</div>
      <p class="hint" style="margin-top:8px">${esc(def.note)}</p>`;
  }

  /* one card of the set — a title, what belongs in it, the files filed in it
     and a way to add another without leaving the card */
  function groupCard(g) {
    const all = plansIn(g.id);
    const n = all.length;
    const isFloor = g.id === 'floor';
    const show = isFloor && state.floorShow != null ? Math.round(+state.floorShow) : null;
    const list = show == null ? all : all.filter(p => Math.max(0, Math.round(+p.level || 0)) === show);
    const levels = isFloor ? floorLevels() : [];
    const floors = levels.length;
    const cur = currentPlan();
    return `<section class="panel grp-card" id="grp-${esc(g.id)}"
      data-grp-label="${esc(g.label)}" data-grp-search="${esc(groupSearchText(g))}">
      <div class="row grp-head">
        <span class="grp-no">${g.no}</span>
        <h2>${esc(g.label)}</h2>
        <span class="chip${n ? ' ok' : ''}">${n ? n + ' drawing' + (n === 1 ? '' : 's') : 'empty'}</span>
        <span style="flex:1"></span>
        <button class="btn sm" data-grp-add="${esc(g.id)}">+ Add ${esc(g.short)}</button>
      </div>
      <p class="hint grp-hint">${esc(g.hint)}</p>
      ${isFloor ? floorFilterBar(all) : ''}
      ${n ? '' : `<p class="grp-empty">Nothing filed here yet — add a file, or drop the whole set in the box above and the
             app reads each name and files it here.</p>`}
      ${n && show != null && !list.length
        ? `<p class="grp-empty">No drawing filed for ${esc(floorName(show))} yet — <b>+ Add a floor plan</b> above takes one,
             or set a drawing's <b>Floor</b> to ${esc(floorName(show))}. <button type="button" class="linkish" data-floor-show="all">Show all floors</button></p>`
        : `<ul class="plan-list">${list.map(planRow).join('')}</ul>`}
      ${isFloor && n ? `<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px">
        <span class="hint">Measuring <b>${esc(cur && isFloorPlan(cur) ? floorName(cur.level) + ' — ' + cur.name : (cur || {}).name || '—')}</b>
          — Read &amp; scale draws the one marked. Each floor keeps its own scale.</span>
        ${floors > 1 && !isSchool() ? `<button class="btn sm" id="plans-storeys">${floors} floors \u2014 set ${Math.max.apply(null, levels) + 1} storeys</button>` : ''}
      </div>` : ''}
      ${settingsBlock(g)}
      ${genReadLine(g.id)}
      ${g.id === 'plumbing' ? drainSettingsBlock() : ''}
      <input type="file" class="grp-input" data-grp="${esc(g.id)}" accept="image/*,application/pdf,.pdf" multiple hidden>
    </section>`;
  }

  /* the eleven cards, in the order a set is bound */
  function drawingSet() {
    const list = plansOf();
    const n = list.length;
    const filed = DRAW_GROUPS.filter(g => plansIn(g.id).length).length;
    return `<div class="set-head">
        <div class="set-tools">
          <label class="set-search" for="grp-search">
            <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="8.6" cy="8.6" r="5.4" fill="none" stroke="currentColor" stroke-width="1.7"/>
              <path d="M12.8 12.8 L17 17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            </svg>
            <input type="text" id="grp-search" autocomplete="off" spellcheck="false"
              placeholder="Search a card — roof plan, floor plan, plumbing layout…"
              value="${esc(state.grpSearch || '')}" aria-label="Search the drawing set cards">
            <button type="button" class="c-search-clear" id="grp-search-clear"
              aria-label="Clear the search"${state.grpSearch ? '' : ' hidden'}>×</button>
          </label>
          <button type="button" class="btn primary gen-go" id="gen-readings"
            title="Read every sheet on file and update the cards">
            <svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true" fill="none"
              stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11.2 2.2 4.4 11.1h3.9L8.5 17.8 15.6 8.6h-4.1z"/></svg>
            <span>Generate the readings</span>
          </button>
          <button type="button" class="btn sm" id="grp-search-all"${state.grpSearch ? '' : ' hidden'}>Show all 11</button>
          <span class="c-shown" id="grp-shown" role="status" aria-live="polite"></span>
        </div>
        <p class="set-search-note" id="grp-search-empty" hidden></p>
        <div class="row" style="align-items:baseline;gap:10px;flex-wrap:wrap">
          <h2 style="margin:0">The drawing set</h2>
          <span class="chip${n ? ' ok' : ''}">${n ? n + ' drawing' + (n === 1 ? '' : 's') + ' filed' : 'nothing filed yet'}</span>
          <span style="flex:1"></span>
          <span class="hint">${n ? filed + ' of 11 places in use' : 'eleven places — a file lands in its own'}</span>
        </div>
        <p class="lede" style="margin:8px 0 0">Put each sheet where it belongs. Drop a file in any card, or drop the whole
          set in the box above: the app reads the name — and the text of a PDF sheet — and files it in the right place.
          Change the <b>As</b> menu in any row to move a drawing.</p>
      </div>
      ${DRAW_GROUPS.map(g => g.panel === 'roof' ? roofUploadPanel() : groupCard(g)).join('')}
      ${generateReadingsPanel()}`;
  }

  /* the search over the set: type the name of a card and the eleven narrow to
     the one — a name, the name a sheet carries, or a word printed on it. One
     card left, and Enter opens its own + Add so the file goes straight in. */
  function filterGroupCards(q) {
    const term = String(q == null ? '' : q).trim();
    const tokens = term.toLowerCase().split(/\s+/).filter(Boolean);
    const cards = Array.prototype.slice.call(document.querySelectorAll('.grp-card[data-grp-search]'));
    let shown = 0, only = null;
    cards.forEach(card => {
      const text = card.getAttribute('data-grp-search') || '';
      const ok = !tokens.length || tokens.every(t => text.indexOf(t) >= 0);
      card.hidden = !ok;
      if (ok) { shown++; only = card; }
    });
    /* the generate card is not one of the eleven: a search over the set puts
       it away with them, and the whole set brings it back */
    const genCard = document.getElementById('gen-card');
    if (genCard) genCard.hidden = tokens.length > 0;
    const status = document.getElementById('grp-shown');
    if (status) {
      let txt = '';
      if (tokens.length) {
        txt = shown + ' of ' + cards.length + ' card' + (cards.length === 1 ? '' : 's');
        if (shown === 1 && only) txt += ' · Enter adds a file to ' + (only.getAttribute('data-grp-label') || 'it');
      }
      status.textContent = txt;
      status.classList.toggle('none', !!tokens.length && !shown);
    }
    const clear = document.getElementById('grp-search-clear');
    if (clear) clear.hidden = !tokens.length;
    const all = document.getElementById('grp-search-all');
    if (all) all.hidden = !tokens.length;
    const empty = document.getElementById('grp-search-empty');
    if (empty) {
      empty.hidden = !tokens.length || shown > 0;
      if (!empty.hidden) {
        empty.innerHTML = 'No card in the set is called “' + esc(term) + '” — try <b>floor</b>, ' +
          '<b>roof</b>, <b>section</b>, <b>drainage</b> or <b>electrical</b>. ' +
          '<b>Show all 11</b> above puts the whole set back.';
      }
    }
    return shown;
  }

  /* back to the whole set */
  function clearGroupSearch() {
    state.grpSearch = '';
    const box = document.getElementById('grp-search');
    if (box) box.value = '';
    filterGroupCards('');
    if (box) box.focus();
  }

  /* Enter when one card is left: its own + Add */
  function openSearchedCard() {
    const cards = Array.prototype.slice.call(document.querySelectorAll('.grp-card[data-grp-search]'))
      .filter(c => !c.hidden);
    if (cards.length !== 1) return false;
    const add = cards[0].querySelector('[data-grp-add], #pick-roof');
    if (!add) return false;
    add.click();
    return true;
  }

  /* the same list, one line, on the step where the plan is read */
  function plansSwitch() {
    const list = plansOf();
    if (list.length < 2) return '';
    const cur = currentPlan();
    /* the floors first, in the order they are built, then the rest of the set */
    const floors = list.filter(isFloorPlan).sort((a, b) =>
      Math.max(0, Math.round(+a.level || 0)) - Math.max(0, Math.round(+b.level || 0)));
    const others = list.filter(p => !isFloorPlan(p));
    const btn = p => `<button class="btn sm${cur && p.id === cur.id ? ' primary' : ''}" data-plan-measure="${esc(p.id)}"${
      !p.dataUrl ? ' disabled' : ''} title="${esc(p.name)}">${esc(isFloorPlan(p) ? floorName(p.level) : p.name)}</button>`;
    return `<div class="row plans-switch" style="gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 12px">
      <span class="hint">${floors.length > 1 ? 'Floor' : 'Measuring'}</span>
      ${floors.map(btn).join('')}
      ${others.length ? `<span class="hint plans-switch-sep">·</span>${others.map(btn).join('')}` : ''}
      <span class="hint">· every plan keeps its own scale</span>
    </div>`;
  }

  /* ----------------------------------------------------- generate the readings
     A drawing set is read as a set. The floor plans give the size, the walls
     and the rooms; the sections the levels and the footings; the elevations the
     plinth and the finish; the schedules the openings and the finishes; the
     layouts the points, the fittings and the drain. The button under the eleven
     cards runs every reader over every sheet on file, writes what it finds into
     the settings on the cards, and opens Read & scale on the drawing. */

  /* a label, a type and a size for every figure the cards carry */
  const GEN_META = {};
  Object.keys(SET_FIELDS).forEach(id => SET_FIELDS[id].fields.forEach(f => {
    const m = GEN_META[f.p] || (GEN_META[f.p] = { label: f.label, type: f.type,
      on: f.on, off: f.off, scale: f.scale, groups: [] });
    if (m.groups.indexOf(id) < 0) m.groups.push(id);
    if (f.scale && !m.scale) m.scale = f.scale;
  }));
  const GEN_WORDS = {
    terrazzo: 'terrazzo', tiles: 'tiles', wood: 'timber', screed: 'screed',
    pvc: 'PVC panels', plasterboard: 'plasterboard', pop: 'POP', none: 'no ceiling',
    render: 'cement render', fairface: 'fair-faced blockwork', cladding: 'cladding',
    strip: 'strip footing', raft: 'raft', lump: 'one item for the job',
    perDoor: 'a set to every door', both: 'both faces', one: 'one face'
  };

  /* what a sheet of each trade looks like, in the words it prints */
  const GEN_SHEET_RE = {
    site: /site\s*(?:plan|layout)|location\s*plan|block\s*plan/i,
    floor: /floor\s*plan|building\s*plan/i,
    elevation: /elevation/i,
    section: /section\s*[A-Z0-9]|longitudinal\s*section|cross\s*section/i,
    foundation: /foundation|footing|substructure|\braft\b/i,
    structural: /structur|framing|frame\s*plan|\bcolumns?\b|\bbeams?\b/i,
    roof: /roof\s*(?:plan|layout|framing)|pitch|covering/i,
    'schedule-doors': /doors?|windows?|joinery|ironmongery/i,
    'schedule-finishes': /finish(?:es)?\s*schedule|room\s*finish|terrazzo|screed|ceiling/i,
    electrical: /electric|lighting|power\s*layout|sockets?|light\s*points?/i,
    plumbing: /plumb|sanitary|soil\s*(?:and|&)\s*waste|water\s*layout|septic|manhole/i
  };

  /* a sheet belongs to a card by its own title; a sheet with no title is read
     by the first words it prints, so a section mentioning the foundations is
     never counted as a foundation plan */
  function genSheetMatches(gid, s) {
    const re = GEN_SHEET_RE[gid];
    if (!re || !s) return false;
    if (re.test(s.title || '')) return true;
    if (s.title) return false;
    return re.test(String(s.text || '').slice(0, 700));
  }
  function genSheetPool(list, gid) {
    const re = GEN_SHEET_RE[gid];
    if (!re) return [];
    const hit = (list || []).filter(s => s.text && genSheetMatches(gid, s));
    /* a sheet whose title names the trade comes first */
    return hit.filter(s => re.test(s.title || '')).concat(hit.filter(s => !re.test(s.title || '')));
  }

  /* the figure a card holds, written out the way the card says it */
  function genUnit(label) {
    const m = String(label || '').match(/\(([^)]*)\)/);
    if (!m) return '';
    const u = m[1].split('—')[0].trim();
    return /^(?:m|m high|mm|No\.|m centres)$/.test(u) ? u.replace('m high', 'm').replace('m centres', 'm') : '';
  }
  function genText(p, v) {
    const m = GEN_META[p] || {};
    if (m.type === 'bool') return v === false ? (m.off || 'No') : (m.on || 'Yes');
    if (m.type === 'sel') return GEN_WORDS[String(v)] || String(v);
    if (v == null || v === '' || !isFinite(+v)) return '';
    const mm = m.scale && +m.scale !== 1;
    const num = mm ? Math.round(+v * +m.scale) : Math.round(+v * 100) / 100;
    const u = mm ? 'mm' : genUnit(m.label);
    return num + (u ? ' ' + u : '');
  }
  function genFact(p, v) {
    const m = GEN_META[p] || {};
    const label = String(m.label || p).replace(/\s*\([^)]*\)\s*$/, '');
    const t = genText(p, v);
    if (!t) return '';
    return m.type === 'sel' ? label + ': ' + t : label + ' ' + t;
  }
  function genSnapshot() {
    const o = {};
    Object.keys(GEN_META).forEach(p => { o[p] = state.params[p]; });
    return o;
  }
  /* every figure a reader moved, said in the words of the card it sits on */
  function genChanged(before) {
    const out = {};
    Object.keys(GEN_META).forEach(p => {
      const a = before[p], b = state.params[p];
      if (a === b || (typeof a === 'number' && typeof b === 'number' && isFinite(a) && isFinite(b) && Math.abs(a - b) < 1e-9)) return;
      const f = genFact(p, b);
      if (!f) return;
      GEN_META[p].groups.forEach(gid => {
        const g = out[gid] || (out[gid] = []);
        if (g.indexOf(f) < 0) g.push(f);
      });
    });
    return out;
  }

  /* every sheet record on file, from every plan in the set */
  function genSheets() {
    const out = [], seen = {};
    const put = s => {
      if (!s) return;
      /* the same sheet is held by the plan it came in and by the file being
         measured: it is still one sheet */
      const k = [s.page, s.kind || '', s.title || '', s.chars || 0, (s.text || '').length].join('|');
      if (seen[k]) return;
      seen[k] = 1; out.push(s);
    };
    plansOf().forEach(p => (p.sheets || []).forEach(put));
    (state.sheets || []).forEach(put);
    return out;
  }

  /* a number printed on a sheet, inside the range the card allows */
  function genNum(t, re, lo, hi) {
    const m = String(t || '').match(re);
    if (!m) return null;
    const v = +String(m[1]).replace(',', '.');
    return isFinite(v) && v >= lo && v <= hi ? v : null;
  }

  function genReadSite(t, p) {
    if (/no\s+(?:boundary\s*(?:wall|fence))|boundary\s*(?:wall|fence)\s*(?:not|excluded|none)|without\s+(?:a\s+)?boundary/i.test(t)) p.boundaryOn = false;
    else if (/boundary\s*(?:wall|fence)|perimeter\s*(?:wall|fence)/i.test(t)) p.boundaryOn = true;
    const ap = genNum(t, /apron[^0-9\n]{0,24}(\d(?:[.,]\d{1,2})?)\s*m\b/i, 0.5, 3);
    if (ap != null) p.apronW = ap;
  }

  function genReadElevation(t, p, tpl) {
    const pl = genNum(t, /plinth[^0-9\n]{0,24}(\d(?:[.,]\d{1,2})?)\s*m\b/i, 0, 1.5);
    if (pl != null) p.plinth = pl;
    const ev = genNum(t, /(?:eaves|eave)\s*(?:height|level|line)?[^0-9\n]{0,20}(\d(?:[.,]\d{1,2})?)\s*m\b/i, 2.2, 8);
    if (ev != null) { p.eavesH = ev; if (tpl === 'school' && ev <= 4.5) p.wallH = Math.round((ev - (pl != null ? pl : (+p.plinth || 0))) * 100) / 100; }
    const wh = genNum(t, /wall\s*height[^0-9\n]{0,20}(\d(?:[.,]\d{1,2})?)\s*m\b/i, 2.2, 4.5);
    if (wh != null) p.wallH = wh;
    const bal = genNum(t, /balustrade[^0-9\n]{0,24}(\d(?:[.,]\d{1,2})?)\s*m\b/i, 0.6, 1.2);
    if (bal != null) p.balH = bal;
    if (/fair[\s-]*face/i.test(t)) p.externalFinish = 'fairface';
    else if (/cladding|timber\s*clad|stone\s*clad/i.test(t)) p.externalFinish = 'cladding';
    else if (/render|plaster(?:ed)?\s*(?:wall|finish)|screed\s*finish/i.test(t)) p.externalFinish = 'render';
  }

  function genReadSection(t, p) {
    const hc = genNum(t, /hard\s*core[^0-9\n]{0,24}(\d{2,3})\s*mm/i, 50, 400);
    if (hc != null) p.hcThk = hc / 1000;
    const ov = genNum(t, /oversite[^0-9\n]{0,26}(\d{2,3})\s*mm/i, 50, 300);
    if (ov != null) p.overThk = ov / 1000;
    const fd = genNum(t, /(?:foundation|trench|footing)\s*depth[^0-9\n]{0,14}(\d(?:[.,]\d{1,2})?)\s*m\b/i, 0.3, 3)
      || genNum(t, /(\d(?:[.,]\d{1,2})?)\s*m\s*(?:deep|depth)/i, 0.3, 3);
    if (fd != null) p.foundDepth = fd;
    const pl = genNum(t, /plinth[^0-9\n]{0,24}(\d(?:[.,]\d{1,2})?)\s*m\b/i, 0, 1.5);
    if (pl != null) p.plinth = pl;
  }

  function genReadFoundation(t, p) {
    const tw = genNum(t, /trench[^0-9\n]{0,24}(\d(?:[.,]\d{1,2})?)\s*m\b/i, 0.3, 2);
    if (tw != null) p.trenchW = tw;
    const fw = genNum(t, /foundation\s*wall[^0-9\n]{0,24}(\d(?:[.,]\d{1,2})?)\s*m\b/i, 0.3, 2.5);
    if (fw != null) p.fdnWallH = fw;
  }

  function genReadStructural(t, p) {
    let m = t.match(/(?:columns?|col\.?s?)[^0-9\n]{0,20}(\d{3})\s*(?:mm)?\s*[x\u00d7]\s*(\d{3})\s*(?:mm)?/i)
      || t.match(/(\d{3})\s*(?:mm)?\s*[x\u00d7]\s*(\d{3})\s*(?:mm)?\s*(?:rc\s*)?(?:columns?|col\.?s?)/i);
    if (m) {
      const a = +m[1], b = +m[2];
      if (a >= 150 && a <= 600) p.colBMm = a;
      if (b >= 150 && b <= 600) p.colDMm = b;
    }
    const rb = genNum(t, /ring\s*beam[^0-9\n]{0,24}(\d{3})\s*(?:mm)?/i, 150, 600);
    if (rb != null) p.rbDmm = rb;
    const li = genNum(t, /lintels?[^0-9\n]{0,24}(\d{3})\s*(?:mm)?/i, 150, 450);
    if (li != null) p.lintelDmm = li;
    const be = genNum(t, /bearing[^0-9\n]{0,24}(\d{2,3})\s*(?:mm)?/i, 50, 400);
    if (be != null) p.bearingMm = be;
    const gr = genNum(t, /(?:columns?|grid)[^0-9\n]{0,24}(\d(?:[.,]\d{1,2})?)\s*m\s*(?:c\/c|centres|centers|spacing|apart)/i, 2, 8);
    if (gr != null) p.colSpacingM = gr;
    const cn = genNum(t, /\b(\d{1,2})\s*(?:no\.?\s*)?(?:rc\s*)?columns?\b/i, 2, 24);
    if (cn != null) p.colNos = cn;
  }

  function genReadFinishes(t, p, tpl) {
    const floor = /terrazzo/i.test(t) ? 'terrazzo'
      : /(?:ceramic|porcelain|floor\s*tiles?|tiles?\s*to\s*(?:the\s*)?floor|tiled\s*floor)/i.test(t) ? 'tiles'
        : /(?:timber\s*floor|wood\s*floor|laminate)/i.test(t) ? 'wood'
          : /screed/i.test(t) ? 'screed' : null;
    if (floor) { if (tpl === 'school') p.floorFinish = floor; else p.floorMain = floor; }
    if (/(?:toilet|bathroom|\bwc\b)[^.\n]{0,40}tiles?|tiles?[^.\n]{0,40}(?:toilet|bathroom|\bwc\b)/i.test(t)) p.floorWet = 'tiles';
    const ceil = /\bpop\b|plaster\s*of\s*paris/i.test(t) ? 'pop'
      : /plaster\s*board|gypsum/i.test(t) ? 'plasterboard'
        : /pvc\s*(?:ceiling|panel|strip)/i.test(t) ? 'pvc'
          : /no\s*ceiling|exposed\s*(?:soffit|slab)/i.test(t) ? 'none' : null;
    if (ceil) p.ceilingType = ceil;
    const th = genNum(t, /(?:tiles?|tiling)[^.\n]{0,30}(\d(?:[.,]\d{1,2})?)\s*m\s*(?:high|above|up)/i, 0, 3)
      || genNum(t, /(?:splashback|dado)[^0-9\n]{0,24}(\d(?:[.,]\d{1,2})?)\s*m\b/i, 0, 3);
    if (th != null) p.tileWallH = th;
  }

  function genReadElectrical(t, p, tpl) {
    const lp = genNum(t, /light\s*(?:points?|fittings?)[^0-9\n]{0,24}(\d{1,2})/i, 2, 12);
    if (lp != null) p.lightPointsPerRoom = lp;
    const so = genNum(t, /sockets?[^0-9\n]{0,24}(\d{1,2})/i, 0, 8);
    if (so != null) p.socketsPerRoom = so;
    const bh = genNum(t, /bulkheads?[^0-9\n]{0,24}(\d{1,2})/i, 0, 20);
    if (bh != null) p.bulkheadNos = bh;
    if (tpl !== 'school') {
      if (/generator|genset/i.test(t)) p.svcGenerator = true;
      if (/solar|\bpv\b|photovoltaic/i.test(t)) p.svcSolar = true;
      if (/air\s*cond|hvac|\ba\/c\b/i.test(t)) p.svcHVAC = true;
      if (/fire\s*(?:alarm|detection)|smoke\s*detector/i.test(t)) p.svcFire = true;
    }
  }

  function genReadRoof(t, p) {
    const r = roofFromText(t);
    const bits = [];
    if (r.kind) {
      const k = RoofGeom.norm(r.kind);
      if (RoofGeom.norm(p.roofType) !== k) { p.roofType = k; bits.push(RoofGeom.short(k).toLowerCase() + ' roof'); }
    }
    if (r.pitch != null && (p.roofType || '') !== 'flat' && Math.abs((+p.roofPitch || 0) - r.pitch) > 0.01) {
      p.roofPitch = r.pitch;
      bits.push('pitch ' + fmt(r.pitch, 1) + '\u00b0');
    }
    if (r.over != null && Math.abs((+p.overhang || 0) - r.over) > 0.005) {
      p.overhang = r.over;
      bits.push('eaves ' + fmt(r.over, 2) + ' m');
    }
    if (r.cover) bits.push('covering: ' + r.cover);
    return bits;
  }

  function genReadPlumbing(t, p, tpl) {
    const wc = genNum(t, /\b(\d{1,2})\s*(?:no\.?\s*)?wc(?:\s*suites?)?\b/i, 1, 10)
      || genNum(t, /wc[^0-9\n]{0,16}(\d{1,2})\b/i, 1, 10);
    if (wc != null && tpl === 'school') p.wcNos = wc;
    if (/septic\s*tank|soak\s*(?:away|pit)/i.test(t)) p.septicOn = true;
    else if (/public\s*sewer|main\s*sewer|sewer\s*line|connected\s*to\s*(?:the\s*)?sewer/i.test(t)) p.septicOn = false;
    if (tpl !== 'school' && /borehole|bore\s*hole/i.test(t)) p.svcBorehole = true;
  }

  /* the card under the drawing set: what is on file, what the last reading
     found, and the one button that runs it */
  function generateReadingsPanel() {
    const n = plansOf().length;
    const setSheets = genSheets();
    const sheetN = gid => genSheetPool(setSheets, gid).length;
    const filed = DRAW_GROUPS.filter(g => plansIn(g.id).length || sheetN(g.id)).length;
    const gen = state.genRead || null;
    const rows = DRAW_GROUPS.map(g => {
      const mine = plansIn(g.id).length;
      const sheets = sheetN(g.id);
      const rec = gen && gen.groups ? gen.groups[g.id] : null;
      let note, cls = '';
      if (rec && rec.facts && rec.facts.length) {
        const f = rec.facts.slice(0, 3);
        note = (rec.from ? 'from ' + rec.from + ' · ' : '') + f.join(' · ') +
          (rec.facts.length > f.length ? ' · +' + (rec.facts.length - f.length) + ' more' : '');
        cls = ' ok';
      } else if (rec) {
        note = rec.filed ? (rec.sheets ? 'read \u2014 the model already agrees' : 'a picture only \u2014 nothing printed to read')
                         : 'no drawing filed';
      } else if (mine) {
        note = mine + ' drawing' + (mine === 1 ? '' : 's') + ' filed';
      } else if (sheets) {
        note = sheets + ' sheet' + (sheets === 1 ? '' : 's') + ' in the set \u2014 read when generated';
      } else {
        note = 'no drawing filed';
      }
      return `<div class="gen-row${cls}" data-gen-row="${esc(g.id)}">
        <span class="gen-no">${g.no}</span>
        <b>${esc(g.label)}</b>
        <span class="gen-note">${esc(note)}</span>
      </div>`;
    }).join('');
    const total = gen ? Object.keys(gen.groups || {}).reduce((k, id) => k + ((gen.groups[id] || {}).facts || []).length, 0) : 0;
    return `<section class="panel gen-card" id="gen-card">
      <div class="row" style="align-items:baseline;gap:10px;flex-wrap:wrap">
        <h2 style="margin:0">${gen ? 'What the reading found' : 'What the reading will read'}</h2>
        <span class="chip${n || gen ? ' ok' : ''}">${gen
          ? total + ' figure' + (total === 1 ? '' : 's') + ' read'
          : (n ? n + ' drawing' + (n === 1 ? '' : 's') + ' on file' : 'nothing on file yet')}</span>
        <span style="flex:1"></span>
        <span class="hint">${gen ? 'read ' + (gen.cards || 0) + ' of 11 cards' : filed + ' of 11 cards filed'}</span>
      </div>
      <p class="lede" style="margin:8px 0 12px">The <b>Generate the readings</b> button on the search line above reads the whole set: the floor plans give the size,
        the walls and the rooms, the sections the levels and the footings, the elevations the plinth and the
        finish, the schedules the openings, the layouts the points and the drain. What it finds is written into
        the settings on the cards above, and <b>Read &amp; scale</b> opens on the drawing.</p>
      <div class="gen-list">${rows}</div>
      <p class="gen-go-hint">The <b>Generate the readings</b> button sits on the search line above the cards — ${gen
        ? 'press it again after a drawing is added, replaced or moved to another one.'
        : 'nothing leaves this device, every sheet is read here.'}</p>
    </section>`;
  }

  /* the one line a card carries after a reading */
  function genReadLine(id) {
    const gen = state.genRead;
    if (!gen || !gen.groups || !gen.groups[id]) return '';
    const g = gen.groups[id];
    if (!g.filed) return '';
    const from = g.from ? `<span class="gen-from">${esc(g.from)}</span> ` : '';
    if (g.facts && g.facts.length) {
      return `<p class="gen-read ok" data-gen-read="${esc(id)}">\u2713 ${from}${g.facts.slice(0, 6).map(esc).join(' \u00b7 ')}${
        g.facts.length > 6 ? ' \u00b7 +' + (g.facts.length - 6) + ' more' : ''}</p>`;
    }
    return `<p class="gen-read" data-gen-read="${esc(id)}">Read \u2014 ${from}${from ? '\u00b7 ' : ''}${g.sheets
      ? 'the model already agrees with the sheet'
      : 'a picture only, with nothing printed to read'}</p>`;
  }

  async function generateReadings() {
    if (!guard('edit')) return;
    const plans = plansOf();
    if (!plans.length && !state.image) {
      toast('Upload the drawing set first \u2014 the button reads what is on file');
      return;
    }
    const btn = document.getElementById('gen-readings');
    if (btn) {
      btn.disabled = true;
      btn.classList.add('busy');
      const label = btn.querySelector('span') || btn;
      label.textContent = 'Reading the set\u2026';
    }
    const tpl = isSchool() ? 'school' : 'general';
    const p = state.params;
    const list = genSheets();
    const before = genSnapshot();
    const G = {};
    const hasSheet = id => genSheetPool(list, id).length > 0;
    const grp = id => (G[id] || (G[id] = { facts: [], filed: plansIn(id).length || (hasSheet(id) ? 1 : 0), sheets: 0 }));
    const add = (id, s) => {
      if (!s) return;
      const g = grp(id);
      if (g.facts.indexOf(s) < 0) g.facts.push(s);
    };
    const poolOf = gid => genSheetPool(list, gid);

    try {
      /* ------------------------------------------------ the floor plans */
      const floors = plans.filter(isFloorPlan);
      if (floors.length) {
        grp('floor').sheets = floors.length;
        /* the number of floors drawn, not the highest level on the card: one
           plan filed as the first floor is one storey, not two */
        const lv = floors.map(x => Math.max(0, Math.round(+x.level || 0)));
        const nFloors = lv.filter((v, i) => lv.indexOf(v) === i).length;
        if (!isSchool() && nFloors > 1) {
          const want = Math.min(4, nFloors);
          if (+p.storeys !== want) p.storeys = want;
          add('floor', nFloors + ' floor plans filed');
        } else if (isSchool() && nFloors > 1) {
          add('floor', nFloors + ' floor plans filed');
        }
        const roomSheets = list.filter(s => s.labels && s.labels.length >= 2 &&
          (s.kind === 'floor' || s.kind === 'upper' || GEN_SHEET_RE.floor.test(s.title || '')));
        if (roomSheets.length) {
          try {
            const read = readRoomsFrom(roomSheets[0]);
            if (read && read.rooms && read.rooms.length >= 2) {
              state.roomRead = read;
              if (isSchool()) {
                const k = read.rooms.filter(r => r.type === 'classroom').length;
                if (k) p.nClassrooms = Math.min(8, Math.max(1, k));
              } else {
                p.rooms = read.rooms.map(r => ({ name: r.name, type: r.type, L: r.L, W: r.W,
                  n: 1, floor: r.floor || 1 }));
              }
              add('floor', read.rooms.length + ' rooms read from sheet ' + read.page);
            }
          } catch (e) { /* a sheet whose names will not resolve is left alone */ }
        }
        if (state.analysis) {
          const b = scaleBasis(state.analysis);
          if (b.known) {
            if (isSchool()) {
              const w = +(state.scaleMM / 1000).toFixed(2);
              if (w > 3 && Math.abs(w - (+p.overallW || 0)) > 0.01) p.overallW = w;
              add('floor', 'the plan measures ' + fmt(w) + ' m wide');
            } else {
              /* the size the drawing gives, but only where the rooms fill it —
                 the same guard the Read & scale button uses, so a sheet whose
                 border is not the building never sets the bill */
              const a = state.analysis;
              const w = +(a.bbox.w * b.mmPerPx / 1000).toFixed(2);
              const d = +(a.bbox.h * b.mmPerPx / 1000).toFixed(2);
              state.sizeAdopted = false;
              adoptMeasuredSize(true);
              add('floor', state.sizeAdopted
                ? 'the plan measures ' + fmt(w) + ' \u00d7 ' + fmt(d) + ' m'
                : 'the plan measures ' + fmt(w) + ' \u00d7 ' + fmt(d) + ' m \u2014 the rooms do not fill it, so the size stays as typed');
            }
          } else if (floors.length) {
            add('floor', 'the sheet prints no scale \u2014 set it on Read & scale');
          }
          add('floor', state.analysis.hStrong.length + ' long and ' + state.analysis.vStrong.length + ' vertical wall lines');
        }
      }

      /* ------------------------------------------------ the rest of the set */
      const textOf = gid => {
        const sh = poolOf(gid);
        grp(gid).sheets = Math.max(grp(gid).sheets, sh.length);
        if (sh.length && !plansIn(gid).length) {
          grp(gid).from = 'sheet ' + sh[0].page + (sh[0].title ? ' \u2014 ' + sh[0].title : '');
        }
        return sh.map(s => s.text).join(' \n ');
      };
      const site = textOf('site'); if (site) genReadSite(site, p);
      const elev = textOf('elevation'); if (elev) genReadElevation(elev, p, tpl);
      const sec = textOf('section'); if (sec) genReadSection(sec, p);
      const fnd = textOf('foundation'); if (fnd) genReadFoundation(fnd, p);
      const str = textOf('structural'); if (str) genReadStructural(str, p);
      const fin = textOf('schedule-finishes'); if (fin) genReadFinishes(fin, p, tpl);
      const ele = textOf('electrical'); if (ele) genReadElectrical(ele, p, tpl);
      const plm = textOf('plumbing'); if (plm) genReadPlumbing(plm, p, tpl);

      /* the numbers the sheet text carries, in the reader the upload uses */
      if (list.some(s => s.text)) {
        try { applySheetNumbers(list); } catch (e) { /* one bad sheet must not stop the rest */ }
      }

      /* the level lines off the section sheets of the file being measured */
      if (state.pdfFile && list.some(s => s.kind === 'section')) {
        try { await readSheetSections(state.pdfFile); } catch (e) { /* its printed figures still count */ }
        const nLv = ((state.verticals || {}).levels || []).length;
        if (nLv) { grp('section').sheets++; add('section', nLv + ' level lines read from the sections'); }
      }

      /* the roof plan, when one is on file */
      if (state.roof) {
        try {
          if (!state.roofRead) state.roofRead = roofInfo(state.roofAnalysis || null, state.roof.text || '');
          const done = roofApplyFacts();
          (done || []).forEach(x => add('roof', x));
          if (!done || !done.length) add('roof', 'the model already agrees with the roof plan');
          grp('roof').sheets = Math.max(grp('roof').sheets, 1);
        } catch (e) { /* the roof card keeps whatever it had */ }
      }

      /* a roof sheet in the set that was not filed as the roof plan */
      if (!state.roof) {
        const rtxt = textOf('roof');
        if (rtxt) genReadRoof(rtxt, p).forEach(x => add('roof', x));
      }

      /* the drawing's own door and window schedule */
      try {
        const got = openingsFromDrawing(list);
        if (got && got.doors.length + got.windows.length) {
          useOpeningsFromDrawing(true, list);
          grp('schedule-doors').sheets++;
          add('schedule-doors', got.doors.length + ' door' + (got.doors.length === 1 ? '' : 's') +
            ' and ' + got.windows.length + ' window' + (got.windows.length === 1 ? '' : 's') + ' read from the schedule');
        }
      } catch (e) { /* no schedule printed: the standard one stays */ }

      /* the drain, measured off the plan the app has */
      if (window.Drainage) {
        try {
          const R = drainRead();
          grp('plumbing').sheets = Math.max(grp('plumbing').sheets, 1);
          add('plumbing', 'Bill 14 and 15: ' + fmt(R.m.run, 1) + ' m run, ' + R.m.chambers + ' chambers');
        } catch (e) { /* the Plumbing Layout card keeps its figures */ }
      }

      /* every figure a reader moved, written against the card it belongs to */
      const changed = genChanged(before);
      Object.keys(changed).forEach(id => changed[id].forEach(f => add(id, f)));

      state.result = recompute();
      const cards = Object.keys(G).filter(id => G[id].facts.length || G[id].sheets).length;
      const total = Object.keys(G).reduce((k, id) => k + G[id].facts.length, 0);
      state.genRead = { at: new Date().toISOString(), sheets: list.filter(s => s.text).length,
        cards: cards, groups: G };
      save();
      setStep(2);
      setTimeout(() => toast(total
        ? 'Read ' + total + ' figure' + (total === 1 ? '' : 's') + ' from the set \u2014 Read & scale is open'
        : 'The set is read \u2014 Read & scale is open'), 400);
    } catch (err) {
      if (window.console && console.warn) console.warn('Quick Quantity \u2014 could not read the set:', err);
      toast('Could not read the whole set \u2014 ' + (err && err.message ? err.message : 'try again'));
      render();
    }
  }

  async function handleFile(file, page, pre, kindIn) {
    if (!file) return;
    if (!guard('edit')) return;
    try {
      const isPdf = typeof PdfImport !== 'undefined' && PdfImport.isPdf(file);
      const fileKey = file.name + '|' + file.size + '|' + (file.lastModified || 0);
      const freshAll = lastFileKey !== fileKey;
      let freshSet = false;          // a new PDF, whose sheets have not been indexed yet
      lastFileKey = fileKey;
      if (freshAll) { state.sizeManual = false; state.sizeAdopted = false; }
      if (isPdf) {
        toast('Reading the PDF…');
        // one file usually holds the floor plan, foundation plan, sections and
        // elevations: index every sheet before choosing which one to measure
        const key = [file.name, file.size, file.lastModified || 0].join('|');
        freshSet = state.sheetsKey !== key;
        if (freshSet) {
          try {
            state.sheetInfo = await PdfImport.sheets(file);
            state.sheets = state.sheetInfo.pages;
            state.sheetsKey = key;
            state.sectionsKey = null;
          } catch (e) { state.sheetInfo = null; state.sheets = null; }
        }
        if (!page && state.sheetInfo && state.sheetInfo.planPage) page = state.sheetInfo.planPage;
        const id = identifyBuilding(state.sheets, page);
        if (id && id.type) {
          const changed = id.type !== currentBuildingType();
          if (changed) applyBuildingType(id.type, id.evidence);
          else state.buildingRead = id;
          setTimeout(() => toast('Read as ' + (/^[aeiou]/i.test(id.label) ? 'an ' : 'a ') +
            id.label.toLowerCase() + ' — ' + id.evidence.join(', ')), 900);
        }
        // after the building type is settled, take the numbers off the other
        // sheets — once per file, so a figure typed by hand is not overwritten
        // every time another page is measured
        if (freshSet) {
          const sheetNumbers = applySheetNumbers();
          if (sheetNumbers.length) {
            setTimeout(() => toast('Drawing set read — ' + sheetNumbers.slice(0, 3).join(', ')), 2400);
          }
        }
      }
      const { img, dataUrl, name, size, pdf } = pre || await imageFromFile(file, page);
      state.image = { dataUrl, name, size };
      state.pdf = pdf;
      /* this file is a plan of the building: it joins the set, and it is the
         one being measured until another is chosen */
      /* a PDF page that the set read as a floor carries its storey, so the
         first floor drawn on page 2 is filed as the first floor */
      const sheet = isPdf ? (state.sheets || []).filter(sh => sh.page === (pdf && pdf.page))[0] : null;
      const sheetFloor = sheet && (sheet.kind === 'floor' || sheet.kind === 'upper')
        ? Math.max(0, Math.round(+sheet.storey || 1) - 1) : null;
      const planRec = registerPlan({ file, name, size, dataUrl, pdf: pdf || null,
                                     kind: kindIn || planKindGuess(name), sheets: isPdf ? state.sheets : null,
                                     level: sheetFloor });
      state.planId = planRec.id;
      state.pdfFile = isPdf ? file : null;   // kept in memory for page switching
      state.analysis = PlanAnalyser.analyse(img);
      state.refPx = state.analysis.refPx;
      state.picked = [];
      if (state.analysis.bays >= 1) {
        state.params.nClassrooms = Math.max(1, Math.min(8, state.analysis.bays));
      }
      // If the sheet prints its own scale, use it; if not, say plainly that the
      // plan is being taken as the standard building wide until a scale is set.
      const sh0 = currentSheet();
      if (state.analysis && sh0 && sh0.scale) {
        state.scaleMode = 'auto';
        if (sh0.longestPt) state.paperMM = Math.round(sh0.longestPt * 0.352778);
      } else if (!state.scaleMM || state.scaleMode === 'auto') {
        state.scaleMode = 'assumed';
      }
      if (state.scaleMode === 'ratio' && sh0 && sh0.longestPt) state.paperMM = Math.round(sh0.longestPt * 0.352778);
      syncScale();
      storePlanScale();
      // a set of floor plans means a multi-storey building
      let storeyNote = '';
      if (isPdf && state.sheetInfo && state.sheetInfo.storeys > 1) {
        // the GES school template is a single-storey standard block: only the
        // general engine measures an upper floor
        if ((state.params.template || 'school') !== 'school') {
          state.params.storeys = Math.min(4, state.sheetInfo.storeys);
          storeyNote = ' · ' + state.params.storeys + ' storeys from ' + state.sheetInfo.storeys + ' floor plans';
        } else {
          storeyNote = ' · ' + state.sheetInfo.storeys + ' floor plans found';
        }
      }
      // the room names printed on the measured sheet drive the room schedule
      let roomNote = '';
      const sheetNow = (state.sheets || []).filter(s => pdf && s.page === pdf.page)[0];
      let roomSheet = (isPdf && sheetNow && sheetNow.kind === 'floor' &&
                       sheetNow.labels && sheetNow.labels.length) ? sheetNow : null;
      if (isPdf && !roomSheet) {
        // measuring a section, an elevation or a site plan: fall back to the
        // floor plan the app picked for the building
        const plans = planSheets();
        roomSheet = (state.sheetInfo ? plans.filter(s => s.page === state.sheetInfo.planPage)[0] : null)
          || plans[0] || null;
      }
      if (isPdf && !roomSheet) {
        /* the sheet being measured prints room names but was not typed as a
           floor plan — a title block the reader did not recognise. The names on
           it are still the rooms of the building: read them rather than leave
           the room card empty. */
        roomSheet = (sheetNow && sheetNow.labels && sheetNow.labels.length >= 2) ? sheetNow : null;
      }
      if (isPdf && !roomSheet) {
        roomSheet = (state.sheets || []).filter(s => s.labels && s.labels.length >= 2)[0] || null;
      }
      const readRooms = roomSheet ? readRoomsFrom(roomSheet) : null;
      const roomsRead = readRooms ? readRooms.rooms : [];
      if (roomsRead.length >= 2) {
        state.roomRead = readRooms;
        if (isSchool()) {
          const n = roomsRead.filter(r => r.type === 'classroom').length;
          if (n) state.params.nClassrooms = Math.min(8, Math.max(1, n));
        } else {
          state.params.rooms = roomsRead.map(r => ({ name: r.name, type: r.type, L: r.L, W: r.W, n: 1, floor: r.floor || 1 }));
        }
        roomNote = ' · ' + roomsRead.length + ' rooms';
        setTimeout(() => toast(roomsRead.length + ' room' + (roomsRead.length === 1 ? '' : 's') +
          ' read from the drawing — ' + roomsRead.slice(0, 3).map(r => r.name).join(', ') +
          (roomsRead.length > 3 ? '…' : '')), 1600);
      }
      // the drawing's own door and window schedule, when it prints sizes
      let openNote = '';
      if (isPdf && freshSet) {
        if (useOpeningsFromDrawing(true)) {
          openNote = ' · ' + (state.params.doors.length + state.params.windows.length) + ' openings from the drawing';
        } else if (state.params.openSource === 'drawing') {
          // a new drawing with no readable schedule must not keep the last
          // drawing's doors and windows
          useStandardOpenings(true);
          openNote = ' · standard door and window schedule (none printed on this drawing)';
        }
      }
      /* A plan whose scale is known is measured, and the building takes that
         size: the bill is then priced on what the drawing shows, not on the
         standard layout. Never on a second page of the same file, so a figure
         typed by hand survives switching sheets. */
      let sizeNote = '';
      if (freshAll && !isSchool() && state.analysis) {
        sizeNote = adoptMeasuredSize();
      }
      /* the reading has just moved the model — the room count from the bays,
         the size from the plan, the openings from the schedule — so the bill
         is worked out again before anything is drawn or saved */
      state.result = recompute();
      toast((isPdf ? 'PDF page ' + pdf.page + (pdf.pages > 1 ? ' of ' + pdf.pages : '') + ' read — '
                    : 'Plan read — ') + state.analysis.hStrong.length + ' wall lines found'
            + (state.sheets ? ' · ' + state.sheets.length + ' sheets' : '') + storeyNote + roomNote + openNote + sizeNote);
      setStep(2);
      if (isPdf && state.sheets) setTimeout(() => readSheetSections(file), 500);
    } catch (e) {
      if (window.console && console.warn) console.warn('Quick Quantity — could not read that file:', e && (e.stack || e.message || e));
      toast('Could not read that file');
    }
  }

  /* the section sheets in the same PDF give the level lines: run the same
     reader the standalone section upload uses, once per file */
  /* The heights the bill uses, expressed as levels above the lowest line —
     the section's own figures, not a scaled guess at the image. */
  function printedLevels(p) {
    const d = +p.foundDepth || 0;
    if (!(p.eavesH > 0)) return null;
    const ffl = d + (+p.plinth || 0);
    const out = [{ label: 'Footing bottom', m: 0 }, { label: 'Floor level', m: ffl }];
    if (p.wallH > 0) out.push({ label: 'Ceiling', m: ffl + p.wallH });
    out.push({ label: 'Eaves', m: d + p.eavesH });
    if (p.ridgeExtra > p.eavesH) out.push({ label: 'Ridge', m: d + p.ridgeExtra });
    return out;
  }

  async function readSheetSections(file) {
    const secs = (state.sheets || []).filter(s => s.kind === 'section').slice(0, 2);
    if (!secs.length || !file) return;
    const key = state.sheetsKey + '|' + secs.map(s => s.page).join(',');
    if (state.sectionsKey === key) return;
    state.sectionsKey = key;
    toast('Reading ' + secs.length + ' section sheet' + (secs.length > 1 ? 's' : '') + '…');
    const levels = [], files = [];
    for (const s of secs) {
      try {
        const r = await PdfImport.toImage(file, s.page, 1500);
        const img = await PlanAnalyser.loadDataUrl(r.dataUrl);
        const a = PlanAnalyser.analyse(img, 1500);
        // a sheet printed at a known scale gives real heights: one point of
        // paper is 0.3528 mm, so at 1:D one rendered pixel is 0.3528·D·pt/px mm
        const longPx = Math.max(r.width || a.width || 0, r.height || a.height || 0);
        let mmPerPx = null;
        if (s.scale && s.longestPt && longPx) {
          mmPerPx = 0.352778 * s.scale * (s.longestPt / longPx);
        } else {
          const ref = state.refPx || (state.analysis && state.analysis.refPx) || 0;
          mmPerPx = (state.scaleMM && ref) ? state.scaleMM / ref : null;
        }
        // the sheet border and full-width rules are not levels
        const H = a.height || (img && img.height) || 0;
        const rows = a.hStrong.filter(l =>
          (l.coverage == null || l.coverage < 0.9) &&
          (!H || (l.pos > H * 0.03 && l.pos < H * 0.97))
        ).slice(0, 12);
        const basePx = rows.length ? Math.max.apply(null, rows.map(l => l.pos)) : 1;
        rows.forEach(l => levels.push({
          pos: Math.round(l.pos),
          m: mmPerPx ? Math.abs(basePx - l.pos) * mmPerPx / 1000 : null,
          use: 'Sheet ' + s.page + (s.title ? ' — ' + s.title : '')
        }));
        files.push({ name: 'Sheet ' + s.page + (s.title ? ' — ' + s.title : '') });
      } catch (e) { /* a sheet that will not rasterise is simply left out */ }
    }
    if (!levels.length) { toast('Section sheets found, but no level lines could be read'); return; }
    const printed = printedLevels(state.params);
    let rows = levels;
    if (printed) {
      const pos = levels.map(l => l.pos).filter(v => v != null).sort((a, b) => a - b);
      const asc = printed.slice().sort((a, b) => a.m - b.m);
      rows = asc.map((lv, i) => ({
        pos: pos.length === asc.length ? pos[pos.length - 1 - i] : null,
        m: lv.m,
        use: lv.label + ' — from the section'
      }));
    }
    state.verticals = { files: files, levels: rows, printed: !!printed };
    toast('Section sheets read — ' + levels.length + ' level lines');
    if (state.step === 2) render();
    save();
  }

  // the rates a project actually prices with, before any live update
  function seededRates() {
    const base = isSchool() ? BOQ.DEFAULT_PARAMS.rates : (GenEngine.RATES || {});
    return Object.assign({}, base, state.params.rates || {});
  }

  // a rate template the user (or their QS) can fill in and host as a feed
  function downloadRateTemplate() {
    const rates = seededRates();
    const body = {
      source: 'Your firm or supplier name',
      date: new Date().toISOString().slice(0, 10),
      currency: 'GHS',
      note: 'Rates in the same units as the bill: block/plaster/paint per m2, rebar per kg, concrete per m3, item rates per item.',
      rates: Object.keys(rates).sort().reduce((o, k) => { o[k] = rates[k]; return o; }, {})
    };
    download(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }),
      'quick-quantity_rates_template.json');
  }

  async function updatePricesOnline() {
    if (!guard('edit')) return;
    if (typeof LivePrices === 'undefined') return;
    const topBtn = document.getElementById('btn-prices-top');
    if (topBtn) topBtn.classList.add('busy');
    // values typed in the Settings dialog count, even before Apply
    const modal = document.querySelector('#settings-overlay');
    if (modal) {
      const f = modal.querySelector('[data-set="ratesFeedUrl"]');
      if (f) state.params.ratesFeedUrl = f.value.trim();
      const b = modal.querySelector('[data-set="fxBasis"]');
      if (b && b.value !== '') state.params.fxBasis = parseFloat(b.value) || 0;
    }
    if (!LivePrices.online()) {
      if (topBtn) topBtn.classList.remove('busy');
      toast('You are offline — connect to the internet to update prices');
      return;
    }
    // the built-in card is Ghanaian: another country needs its own prices
    if ((state.params.country || 'Ghana') !== 'Ghana' && !state.params.aiKey && !state.params.ratesFeedUrl) {
      if (topBtn) topBtn.classList.remove('busy');
      toast('The built-in rates are Ghanaian. Set a price feed or an AI key in Settings → Pricing to price for '
        + state.params.country + '.');
      return;
    }
    toast('Checking prices online…');
    try {
      const keys = Object.keys(seededRates());
      const plan = await LivePrices.plan(state.params, keys, seededRates());
      const all = seededRates();
      let changed = 0;

      if (plan.mode === 'ai') {
        Object.keys(plan.rates).forEach(k => { all[k] = plan.rates[k]; changed++; });
        state.params.rates = all;
        // if the model priced in another currency, print in that currency
        if (plan.currency && plan.currency !== state.params.curCode) {
          const hit = GenEngine.COUNTRIES.find(c => c.cur === plan.currency);
          if (hit) { state.params.country = hit.name; syncCurrency(state.params); }
        }
      } else if (plan.mode === 'feed') {
        Object.keys(plan.rates).forEach(k => {
          if (all[k] !== undefined) { all[k] = plan.rates[k]; changed++; }
        });
        if (!changed) { toast('That feed has no rates this bill uses'); return; }
        state.params.rates = all;
      } else {
        // the index is cumulative: prices = card × factor, so clicking twice
        // applies the move since the basis once, not twice
        if (plan.basis) state.params.fxBasis = plan.basis;
        if (plan.basisDate) state.params.ratesBasisDate = plan.basisDate;
        const prev = Number(state.params.fxApplied) || 1;
        const delta = plan.factor / prev;
        if (Math.abs(delta - 1) > 1e-6) {
          Object.keys(all).forEach(k => {
            all[k] = Math.round(all[k] * delta * 100) / 100;
          });
          state.params.rates = all;
          changed = Object.keys(all).length;
        }
        state.params.fxApplied = plan.factor;
        if (plan.mode === 'fx-baseline') state.params.fxApplied = 1;
      }

      state.params.priceNote = plan.note;
      state.params.priceNoteAuto = false;
      state.params.pricesUpdated = plan.date;
      state.result = recompute();
      const status = document.getElementById('price-status');
      if (status) status.textContent = plan.note;
      render(); save();
      ['bill-price-note', 'price-status2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = plan.note;
      });
      if (topBtn) topBtn.classList.remove('busy');
      const ov = document.querySelector('#settings-overlay');
      if (ov && typeof ov._refreshRates === 'function') ov._refreshRates();
      toast(plan.note + (changed ? ' — ' + changed + ' rates updated' : ' — nothing to change'));
    } catch (e) {
      if (topBtn) topBtn.classList.remove('busy');
      const off = !LivePrices.online() || /fetch|network|abort|Failed/i.test(e && e.message || '');
      const msg = off
        ? 'No connection — try again when you are online'
        : 'Could not update prices — ' + (e && e.message ? e.message : 'unexpected reply');
      const status = document.getElementById('price-status');
      if (status) status.textContent = msg;
      toast(msg);
    }
  }

  function applyDetected() {
    const a = state.analysis;
    if (!a) return;
    if (!state.scaleMM) { toast('Set a known dimension first'); return; }
    if (!isSchool()) {
      const b = scaleBasis(a);
      const w = +(a.bbox.w * b.mmPerPx / 1000).toFixed(2);
      const d = +(a.bbox.h * b.mmPerPx / 1000).toFixed(2);
      state.params.bW = w;
      state.params.bD = d;
      state.sizeAdopted = true;
      state.result = recompute();
      toast('Overall size taken from the drawing — ' + fmt(w) + ' × ' + fmt(d) + ' m');
      setStep(3);
      return;
    }
    const n = Math.max(1, Math.min(8, parseInt($('#n-class').value, 10) || state.params.nClassrooms));
    const T = state.params.wallT;

    state.params.nClassrooms = n;
    state.params.autoFit = false;
    state.params.overallW = +(state.scaleMM / 1000).toFixed(3);

    // Room width follows exactly from the measured overall width and the
    // (n+1) wall thicknesses — far more reliable than a pixel bay module.
    const crW = (state.params.overallW - (n + 1) * T) / n;
    if (crW > 2 && crW < 15) state.params.crW = +crW.toFixed(2);

    // Wing sizes are left on the template values — the drawing's own chain of
    // dimensions for the wing does not resolve exactly, and the user can type
    // the true figures on the model step.

    toast('Width and bays taken from the drawing — confirm the depths');
    setStep(3);
  }

  function exportCsv() {
    const r = recompute();
    const rows = [['Bill', 'Item', 'Description', 'Unit', 'Quantity', 'Rate (GHS)', 'Amount (GHS)']];
    r.bills.forEach(b => b.items.forEach((it, i) => {
      rows.push([b.code, String(i + 1).padStart(2, '0'), it.desc, it.unit, it.qty, it.rate, it.amount]);
    }));
    rows.push([], ['', '', 'Sub-total', '', '', '', r.subtotal]);
    rows.push(['', '', 'Contingency at ' + state.params.contingency + '%', '', '', '', r.contingency]);
    rows.push(['', '', 'GRAND TOTAL', '', '', '', r.grand]);
    const csv = rows.map(row => row.map(c => {
      const s = String(c == null ? '' : c);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\r\n');
    download(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }),
      'BOQ_' + slug(state.params.projectName) + '.csv');
    toast('CSV downloaded');
  }

  function exportXlsx() {
    try {
      const r = recompute();
      const file = 'BOQ_' + slug(state.params.projectName) + '.xlsx';
      download(XlsxWriter.build(r), file);
      toast('Final BoQ exported — ' + file);
    } catch (e) { console.error(e); toast('Could not build the workbook'); }
  }

  function exportPdf() {
    try {
      const r = recompute();
      download(PdfWriter.build(r), 'BOQ_' + slug(state.params.projectName) + '.pdf');
      toast('PDF bill downloaded');
    } catch (e) { console.error(e); toast('Could not build the PDF'); }
  }

  function exportDocx() {
    try {
      const r = recompute();
      download(DocxWriter.build(r), 'BOQ_' + slug(state.params.projectName) + '.docx');
      toast('Word document downloaded');
    } catch (e) { console.error(e); toast('Could not build the document'); }
  }

  function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  const slug = s => String(s || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

  function saveJson() {
    const payload = {
      app: 'Quick Quantity', version: 1, savedAt: new Date().toISOString(),
      params: state.params, scaleMM: state.scaleMM, image: state.image,
      digital: state.digital || null, verticals: state.verticals
    };
    download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      'quick-quantity_' + slug(state.params.projectName) + '.json');
    toast('Project file saved');
  }

  async function loadJson(file) {
    try {
      const text = await file.text();
      const p = JSON.parse(text);
      if (!p || (p.app !== 'Quick Quantity' && p.app !== 'Estimate Quick' && p.app !== 'Quick Estimate' && p.app !== 'Plan2BOQ')) throw new Error('not a Quick Quantity file');
      state.params = paramsFor((p.params && p.params.template) || 'school', p.params);
      state.libraryId = null; state.libraryCreatedAt = null; lastLibSig = '';
      state.verticals = p.verticals || { files: [], levels: [] };
      state.scaleMM = p.scaleMM || null;
      state.refPx = p.refPx || null;
      state.image = p.image || null;
      state.digital = p.digital || null;
      if (state.image) {
        const img = await PlanAnalyser.loadDataUrl(state.image.dataUrl);
        state.analysis = PlanAnalyser.analyse(img);
      }
      toast('Project opened');
      setStep(4);
    } catch (e) {
      toast('That file could not be opened');
    }
  }

  /* ---------------------------------------------------------------- events */
  /* ---- the material schedule: search, filter, sort ---- */
  document.addEventListener('input', e => {
    const t = e.target;
    if (t && t.id === 'mat-q') { state.matQ = t.value; matRepaint(); }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t && t.id === 'mat-cat') { state.matCat = t.value; matRepaint(); }
    else if (t && t.id === 'mat-sort') { state.matSort = t.value; matRepaint(); }
    else if (t && t.id === 'lab-weeks') {
      state.labWeeks = +t.value > 0 ? +t.value : null;
      const y = window.scrollY; render(); window.scrollTo(0, y); save();
    }
  });

  /* ---- description suggestions: typing, arrows, Enter, Escape, click ---- */
  document.addEventListener('input', e => {
    const el = e.target;
    if (el && el.classList && el.classList.contains('to-add-desc')) acOpen(el, el.value.trim().toLowerCase());
  });
  document.addEventListener('focusin', e => {
    const el = e.target;
    if (el && el.classList && el.classList.contains('to-add-desc')) acOpen(el, el.value.trim().toLowerCase());
  });
  document.addEventListener('keydown', e => {
    const el = e.target;
    if (!el || !el.classList || !el.classList.contains('to-add-desc')) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!acList.length) acOpen(el, el.value.trim().toLowerCase());
      if (!acList.length) return;
      e.preventDefault();
      acAt = e.key === 'ArrowDown' ? Math.min(acList.length - 1, acAt + 1) : Math.max(0, acAt - 1);
      acPaint();
    } else if (e.key === 'Enter' && acAt >= 0 && acList.length) {
      e.preventDefault();
      acPick(acAt);
    } else if (e.key === 'Escape') {
      const pop = document.querySelector('.ac-pop:not([hidden])');
      if (!pop) return;
      e.preventDefault();
      e.stopPropagation();
      acClose();
    }
  }, true);
  document.addEventListener('mousedown', e => {
    const row = e.target.closest && e.target.closest('.ac-row');
    if (row) { e.preventDefault(); e.stopPropagation(); acPick(+row.dataset.ac); return; }
    const btn = e.target.closest && e.target.closest('#to-ac-btn');
    if (btn) {
      e.preventDefault();
      const input = acInput();
      if (input && input.closest('.to-add-form')) {
        input.focus();
        acOpen(input, input.value.trim().toLowerCase());
      }
    }
  }, true);
  document.addEventListener('pointerdown', e => {
    const t = e.target;
    if (t.closest && (t.closest('.ac-wrap') || t.closest('.ac-pop') || t.closest('.ac-row'))) return;
    acClose();
  }, true);
  // the list is fixed to the page: keep it under the field as the page moves
  const acFollow = () => { if (acPop && !acPop.hidden) acPlace(); };
  window.addEventListener('scroll', acFollow, true);
  window.addEventListener('resize', acFollow);

  /* ------------------------------------------- the material schedule edits */
  function matRerender(focusSel) {
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
    if (focusSel) { const el = document.querySelector(focusSel); if (el) el.focus(); }
    save();
  }

  // only the table is redrawn — the search box keeps the caret
  function matRepaint() {
    const host = document.getElementById('mat-host');
    if (!host) return;
    const m = matModelNow();
    const v = matUtil().view(m, state.matQ, state.matCat, state.matSort);
    host.innerHTML = matTable(v, m);
    /* the paper copy follows the screen: search, filter and sort included */
    const sheet = document.querySelector('.mat-print-sheet');
    if (sheet) sheet.outerHTML = matPrintSheet(v, m);
  }

  function matAdjFor(id) {
    state.params.matAdj = state.params.matAdj || {};
    return state.params.matAdj[id] = state.params.matAdj[id] || {};
  }

  function matSaveLine(id) {
    const form = document.querySelector('.mat-form[data-mid="' + String(id).replace(/"/g, '\\"') + '"]');
    if (!form) return;
    const val = n => { const el = form.querySelector('[name="' + n + '"]'); return el ? String(el.value || '').trim() : ''; };
    const num = n => { const v = parseFloat(val(n)); return isFinite(v) ? v : null; };
    if (id.indexOf('m:') === 0) {
      const rec = (state.params.matAdd || []).find(x => 'm:' + x.id === id);
      if (!rec) return;
      if (!val('name')) { toast('A material needs a name'); return; }
      rec.name = val('name');
      rec.code = val('code') || rec.code;
      rec.cat = val('cat') || rec.cat;
      rec.unit = val('unit') || rec.unit;
      if (num('qty') != null) rec.qty = num('qty');
      if (num('rate') != null) rec.rate = num('rate');
      rec.sup = val('sup');
      rec.note = val('note');
    } else {
      const a = matAdjFor(id);
      const q = num('qty'), r = num('rate');
      if (q === null || r === null) { toast('Quantity and rate have to be numbers'); return; }
      a.q = q; a.r = r;
      a.sup = val('sup'); a.note = val('note');
      delete a.del;
    }
    state.matEdit = null;
    matRerender();
    toast('Material saved');
  }

  function matAddSave() {
    const form = document.getElementById('mat-new-form');
    if (!form) return;
    const val = n => { const el = form.querySelector('[name="' + n + '"]'); return el ? String(el.value || '').trim() : ''; };
    const num = n => { const v = parseFloat(val(n)); return isFinite(v) ? v : 0; };
    if (!val('name')) { toast('Give the material a name'); form.querySelector('[name="name"]').focus(); return; }
    state.params.matAdd = state.params.matAdd || [];
    const n = state.params.matAdd.length + 1;
    state.params.matAdd.push({
      id: 'm' + Date.now().toString(36) + Math.floor(Math.random() * 100),
      code: val('code') || ('MAN-' + String(n).padStart(2, '0')),
      name: val('name'),
      cat: val('cat') || 'Other materials',
      unit: val('unit') || 'No.',
      qty: num('qty'),
      rate: num('rate'),
      sup: val('sup'),
      note: val('note')
    });
    state.matAdd = false;
    matRerender();
    toast('Material added to the schedule');
  }

  function matDelete(id) {
    if (id.indexOf('m:') === 0) {
      const rec = (state.params.matAdd || []).find(x => 'm:' + x.id === id);
      if (rec) {
        state.params.matAdd = state.params.matAdd.filter(x => x !== rec);
        if (!state.params.matAdd.length) delete state.params.matAdd;
      }
    } else {
      matAdjFor(id).del = true;
    }
    if (state.matEdit === id) state.matEdit = null;
    matRerender();
    toast('Material taken off the schedule — “Restore removed” puts it back');
  }

  /* ---------------------------------------------------------------- exports */
  function exportCostBreak(kind) {
    try {
      const C = window.CostBreak;
      const model = C.forExport(state.params, recompute());
      if (!model) { toast('The cost engine did not load'); return; }
      const base = 'Cost_breakdown_' + slug(state.params.projectName || 'project');
      if (kind === 'xlsx') {
        download(XlsxWriter.buildCostBreak(model), base + '.xlsx');
        toast('Cost breakdown exported \u2014 ' + base + '.xlsx');
      } else {
        download(PdfWriter.buildCostBreak(model), base + '.pdf');
        toast('Cost breakdown exported \u2014 ' + base + '.pdf');
      }
    } catch (err) {
      console.error(err);
      toast('Could not build the cost breakdown file');
    }
  }

  function exportLabour(kind) {
    try {
      const L = window.Labour;
      const model = L.forExport(Object.assign({}, state.params, { _labourWeeks: labWeeks() }), recompute());
      if (!model) { toast('The labour engine did not load'); return; }
      const base = 'Labour_schedule_' + slug(state.params.projectName || 'project');
      if (kind === 'xlsx') {
        download(XlsxWriter.buildLabour(model), base + '.xlsx');
        toast('Labour schedule exported \u2014 ' + base + '.xlsx');
      } else {
        download(PdfWriter.buildLabour(model), base + '.pdf');
        toast('Labour schedule exported \u2014 ' + base + '.pdf');
      }
    } catch (err) {
      console.error(err);
      toast('Could not build the labour schedule file');
    }
  }

  function exportMaterials(kind) {
    try {
      const M = matUtil();
      const r = recompute();
      const model = M.forExport(state.params, r);
      const base = 'Material_schedule_' + slug(state.params.projectName || 'project');
      if (kind === 'xlsx') {
        download(XlsxWriter.buildMaterials(model), base + '.xlsx');
        toast('Material schedule exported — ' + base + '.xlsx');
      } else {
        download(PdfWriter.buildMaterials(model), base + '.pdf');
        toast('Material schedule exported — ' + base + '.pdf');
      }
    } catch (err) {
      console.error(err);
      toast('Could not build the material schedule file');
    }
  }

  document.addEventListener('click', e => {
    const libBtn = e.target.closest('[data-lib-act]');
    if (libBtn) { libraryClick(e); return; }

    /* the drainage block on the Plumbing Layout card: trace it on the plan,
       or write the figures into the take-off */
    const drainGo = e.target.closest('[data-drain-go]');
    if (drainGo) {
      if (!state.image) { toast('Upload the plan first — the route is traced on it'); return; }
      if (!state.analysis) { toast('This sheet could not be read as a drawing — the route needs a plan the app can see'); return; }
      state.drainTrace = true;
      state.drainPts = [];
      if (state.step !== 2) setStep(2);
      else render();
      toast('Click each corner of the drain route on the plan, then press Finish');
      return;
    }
    const drainApply = e.target.closest('[data-drain-apply]');
    if (drainApply) {
      if (!guard('edit')) return;
      applyDrainReading();
      return;
    }
    /* back to the run the plan itself gives */
    const drainPlan = e.target.closest('[data-drain-plan]');
    if (drainPlan) {
      const d = drainState(); d.run = null; d.chambers = null; d.source = 'plan';
      state.drainTrace = false; state.drainPts = [];
      const y = window.scrollY; render(); window.scrollTo(0, y);
      save();
      toast('Back to the run the plan gives');
      return;
    }

    /* the filter over the floor plan card: one floor at a time */
    const floorShow = e.target.closest('[data-floor-show]');
    if (floorShow) {
      const v = floorShow.getAttribute('data-floor-show');
      state.floorShow = v === 'all' ? null : Math.max(0, parseInt(v, 10) || 0);
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
      return;
    }

    /* generate the readings: every sheet read, every card updated */
    if (e.target.closest('#gen-readings')) { generateReadings(); return; }

    /* a card's own + Add: open its file picker */
    const grpAdd = e.target.closest('[data-grp-add]');
    if (grpAdd) {
      const g = grpAdd.getAttribute('data-grp-add');
      const input = document.querySelector('.grp-input[data-grp="' + g + '"]');
      if (input) input.click();
      return;
    }

    /* the set of plans: measure one, take one away */
    const measureBtn = e.target.closest('[data-plan-measure]');
    if (measureBtn) { if (guard('edit')) activatePlan(measureBtn.getAttribute('data-plan-measure')); return; }
    const removeBtn = e.target.closest('[data-plan-remove]');
    if (removeBtn) { if (guard('edit')) removePlan(removeBtn.getAttribute('data-plan-remove')); return; }

    if (e.target.closest('#btn-struct')) { structOpen(); return; }
    if (e.target.closest('#btn-bbs')) { bbsOpen(); return; }
    if (e.target.closest('[data-mat-db]')) {
      matDbOpen(null);
      return;
    }
    if (e.target.closest('[data-mat-pick]')) {
      if (!guard('edit')) return;
      matDbOpen(rec => {
        if (!state.matAdd) {
          state.matAdd = true; state.matEdit = null;
          const y = window.scrollY; render(); window.scrollTo(0, y);
        }
        matFillFromDb(rec);
      });
      return;
    }
    if (e.target.closest('[data-mat-new]')) {
      state.matAdd = true; state.matEdit = null;
      const y = window.scrollY; render(); window.scrollTo(0, y);
      const f = document.querySelector('#mat-new-form [name="name"]');
      if (f) f.focus();
      return;
    }
    const matSrcBtn = e.target.closest('[data-mat-src]');
    if (matSrcBtn) {
      const id = matSrcBtn.dataset.matSrc;
      state.matSrc = state.matSrc === id ? null : id;
      matRepaint();
      return;
    }
    const matEdit = e.target.closest('[data-mat-edit]');
    if (matEdit) {
      state.matEdit = state.matEdit === matEdit.dataset.matEdit ? null : matEdit.dataset.matEdit;
      const y = window.scrollY; render(); window.scrollTo(0, y);
      const f = document.querySelector('.mat-form[data-mid] input[name="qty"]');
      if (f) { f.focus(); f.select(); }
      return;
    }
    const matDel = e.target.closest('[data-mat-del]');
    if (matDel) { if (!guard('edit')) return; matDelete(matDel.dataset.matDel); return; }
    const matSave = e.target.closest('[data-mat-save]');
    if (matSave) { if (!guard('edit')) return; matSaveLine(matSave.dataset.matSave); return; }
    if (e.target.closest('[data-mat-add-save]')) { if (!guard('edit')) return; matAddSave(); return; }
    if (e.target.closest('[data-mat-cancel]')) {
      state.matEdit = null; state.matAdd = false;
      const y = window.scrollY; render(); window.scrollTo(0, y);
      return;
    }
    if (e.target.closest('[data-mat-reset]')) {
      delete state.params.matAdj;
      delete state.params.matAdd;
      state.matEdit = null; state.matAdd = false;
      matRerender();
      toast('Every material change cleared — the schedule is back to what the bill gives');
      return;
    }
    if (e.target.closest('[data-mat-restore]')) {
      Object.keys(state.params.matAdj || {}).forEach(k => { delete state.params.matAdj[k].del; });
      matRerender();
      toast('Removed materials are back on the schedule');
      return;
    }
    if (e.target.closest('#btn-mat-xlsx')) { exportMaterials('xlsx'); return; }
    if (e.target.closest('#btn-mat-pdf')) { exportMaterials('pdf'); return; }
    if (e.target.closest('#btn-mat-print')) {
      setTimeout(() => window.print(), 60);
      return;
    }
    if (e.target.closest('#btn-lab-xlsx')) { exportLabour('xlsx'); return; }
    if (e.target.closest('#btn-lab-pdf')) { exportLabour('pdf'); return; }
    if (e.target.closest('#btn-lab-print')) {
      setTimeout(() => window.print(), 60);
      return;
    }
    if (e.target.closest('#btn-cb-xlsx')) { exportCostBreak('xlsx'); return; }
    if (e.target.closest('#btn-cb-pdf')) { exportCostBreak('pdf'); return; }
    if (e.target.closest('#btn-cb-print')) {
      setTimeout(() => window.print(), 60);
      return;
    }
    const labT = e.target.closest('[data-lab-trade]');
    if (labT) {
      const id = labT.getAttribute('data-lab-trade');
      state.labTrade = state.labTrade === id ? null : id;
      const y = window.scrollY; render(); window.scrollTo(0, y);
      return;
    }

    const toAdd = e.target.closest('[data-to-add]');
    if (toAdd) { if (!guard('edit')) return; openAddForm(toAdd.dataset.toAdd); return; }

    const toDelAdd = e.target.closest('[data-todeladd]');
    if (toDelAdd) { if (!guard('edit')) return; removeAddedItem(toDelAdd.dataset.todeladd); return; }

    const toReset = e.target.closest('[data-toreset]');
    if (toReset) {
      if (!guard('edit')) return;
      if (state.params.takeoff) delete state.params.takeoff[toReset.dataset.toreset];
      rerenderTakeoff(null);
      toast('Row put back to what the model measured');
      return;
    }

    const toDel = e.target.closest('[data-todel]');
    if (toDel) { if (!guard('edit')) return; removeTakeoffItem(toDel.dataset.todel); return; }

    const toRestore = e.target.closest('[data-to-restore]');
    if (toRestore) { if (!guard('edit')) return; restoreTakeoffItems(toRestore.dataset.toRestore); return; }

    const startBtn = e.target.closest('[data-start-preset]');
    if (startBtn) {
      state.libraryId = null; state.libraryCreatedAt = null; lastLibSig = '';
      applyGenPreset(parseInt(startBtn.dataset.startPreset, 10));
      setStep(3);
      return;
    }

    const measBtn = e.target.closest('[data-sheet-measure]');
    if (measBtn && state.pdfFile) {
      handleFile(state.pdfFile, parseInt(measBtn.dataset.sheetMeasure, 10));
      return;
    }

    const delBtn = e.target.closest('[data-room-del]');
    if (delBtn) {
      const i = parseInt(delBtn.dataset.roomDel, 10);
      state.params.rooms.splice(i, 1);
      state.result = recompute();
      render(); save();
      return;
    }

    const stepBtn = e.target.closest('[data-step]');
    if (stepBtn) { setStep(parseInt(stepBtn.dataset.step, 10)); return; }

    const id = e.target.id;
    if (id === 'pick-file' || id === 'replace-file') $('#file-input').click();
    else if (id === 'use-sample') loadSample();
    else if (id === 'btn-pick') {
      state.pickMode = !state.pickMode; state.picked = []; render();
    }
    else if (id === 'btn-redetect') {
      if (!state.image) return;
      PlanAnalyser.loadDataUrl(state.image.dataUrl).then(img => {
        state.analysis = PlanAnalyser.analyse(img, 1800);
        toast('Re-read at higher resolution');
        render();
      });
    }
    else if (id === 'apply-detected') applyDetected();
    else if (id === 'add-plans') { $('#file-input').click(); }
    else if (id === 'plans-storeys') {
      const lv = floorLevels();
      const n = lv.length ? Math.max.apply(null, lv) + 1 : 0;
      if (n > 1) {
        state.params.storeys = Math.min(4, n);
        state.result = recompute(); render(); save();
        toast(lv.length + ' floors on file — the bill is now measured over ' + Math.min(4, n) + ' storeys');
      }
    }
    else if (id === 'dr-finish') finishDrainTrace();
    else if (id === 'dr-cancel') { state.drainTrace = false; state.drainPts = []; render(); }
    else if (id === 'btn-open-read') {
      if (useOpeningsFromDrawing()) { render(); save(); }
      else toast('No door or window sizes could be read from these sheets');
    }
    else if (id === 'btn-open-standard') useStandardOpenings();
    else if (id === 'side-close' || id === 'side-backdrop') {
      state.sideOpen = false;
      save();
      paintSide();
    }
    else if (id === 'side-pill' || id === 'btn-summary') {
      state.sideOpen = !summaryOpen();
      save();
      paintSide();
    }
    else if (id === 'to-add-save') saveAddedItem();
    else if (id === 'to-add-cancel') {
      const form = document.querySelector('.to-add-form');
      const box = form && form.closest('.to-add');
      if (box) {
        const code = box.dataset.addbox;
        box.innerHTML = `<button class="btn sm" data-to-add="${esc(code)}">+ Add an item to this bill</button>`;
      }
    }
    else if (id === 'btn-to-open') document.querySelectorAll('details.to-bill').forEach(d => { d.open = true; });
    else if (id === 'btn-to-close') document.querySelectorAll('details.to-bill').forEach(d => { d.open = false; });
    else if (id === 'btn-to-reset') {
      state.params.takeoff = {};
      state.result = recompute();
      render(); save();
      toast('Corrections cleared — the bill is back to the measured figures');
    }
    else if (id === 'btn-preset') {
      const i = parseInt($('#preset').value, 10) || 0;
      if (Settings.PRESETS[i]) { applyGenPreset(i); return; }
      state.params = paramsFor('school', PRESETS[i].params);
      state.result = recompute();
      toast(PRESETS[i].label + ' loaded');
      render();
    }
    else if (id === 'btn-print' || id === 'btn-print2' || id === 'btn-print3') printBill();
    else if (id === 'btn-pdf2') exportPdf();
    else if (id === 'btn-csv') exportCsv();
    else if (id === 'btn-xlsx' || id === 'btn-excel-bill') exportXlsx();
    else if (id === 'btn-docx') exportDocx();
    else if (id === 'btn-pdf') exportPdf();
    else if (id === 'btn-save-json') saveJson();
    else if (id === 'btn-load-json') $('#json-input').click();
    else if (id === 'btn-live-prices' || id === 'btn-prices-top') updatePricesOnline();
    else if (id === 'btn-live-prices2' || id === 'btn-live-prices3' || id === 'btn-live-prices4') updatePricesOnline();
    else if (id === 'btn-settings-rates') {
      if (!guard('edit')) return;
      Settings.open(state, (patch) => {
        Object.assign(state.params, patch);
        syncCurrency(state.params);
        state.result = recompute(); render(); save();
      });
      setTimeout(() => {
        const tab = document.querySelector('.tab[data-tab="rates"]');
        if (tab) tab.click();
      }, 30);
    }
    else if (id === 'btn-rate-template') downloadRateTemplate();
    else if (id === 'btn-reset-rates') {
      if (typeof RateBuild !== 'undefined') RateBuild.reset(state.params);
      state.params.rates = isSchool() ? BOQ.clone(BOQ.DEFAULT_PARAMS.rates) : BOQ.clone(GenEngine.RATES || {});
      delete state.params.rb;
      state.params.priceNote = '';
      state.params.pricesUpdated = '';
      state.params.fxApplied = 1;
      state.params.fxBasis = 0;
      state.params.priceNoteAuto = false;
      syncCurrency(state.params);
      toast('Rates reset'); render(); save();
    }
    else if (id === 'btn-settings') {
      if (!can('edit')) {
        // a reviewer may look at the rates, not rewrite them
        Settings.open(state, () => toast('Your account is read-only — the settings are shown, not applied'), () => {});
        return;
      }
      Settings.open(state, (patch, presetIndex) => {
        const tpl = patch.template || state.params.template || 'school';
        if (presetIndex != null && presetIndex >= 0) {
          // a new building type / template brings its own geometry, rooms and
          // rates; only the fields the user actually edited are kept on top
          const before = state.params, edits = {};
          Object.keys(patch).forEach(k => {
            if (JSON.stringify(patch[k]) !== JSON.stringify(before[k])) edits[k] = patch[k];
          });
          const preset = Settings.PRESETS[presetIndex];
          state.params = paramsFor(tpl, preset.params);
          Object.assign(state.params, edits);
          state.params.template = tpl;
          syncCurrency(state.params);
          toast(Settings.PRESETS[presetIndex].label);
        } else {
          // choosing a building type picks the matching model unless the user
          // changed the template in the same breath
          const wasTpl = state.params.template || 'school';
          const shownBefore = (wasTpl === 'school') ? 'educational' : (state.params.buildingType || 'domestic');
          const btChanged = patch.buildingType && patch.buildingType !== shownBefore;
          const tplChanged = patch.template && patch.template !== wasTpl;
          const targetTpl = (btChanged && !tplChanged)
            ? (patch.buildingType === 'educational' ? 'school' : 'general')
            : (patch.template || wasTpl);
          const merged = Object.assign({}, state.params, patch, { template: targetTpl });
          state.params = paramsFor(targetTpl, merged);
          syncCurrency(state.params);
          if (btChanged || tplChanged) {
            state.buildingRead = null;
            toast('Pricing model set to ' + (targetTpl === 'school'
              ? 'the Ghana school block' : 'the general building'));
          } else {
            toast('Settings applied');
          }
        }
        state.result = recompute();
        if (state.step === 1) setStep(4);
        render(); save();
      }, () => { state.result = recompute(); renderSide(); save(); });
    }
    else if (id === 'btn-edit-parties') {
      if (!guard('edit')) return;
      Settings.open(state, (patch, presetIndex) => {
        Object.assign(state.params, patch);
        state.result = recompute(); render(); save();
      });
      setTimeout(() => {
        const tab = document.querySelector('.tab[data-tab="parties"]');
        if (tab) tab.click();
      }, 30);
    }
    else if (id === 'btn-sample') { if (guard('edit')) loadSample(); }
    else if (id === 'pick-roof' || id === 'replace-roof') $('#roof-input').click();
    else if (id === 'use-roof') applyRoofPlan();
    else if (id === 'clear-roof') clearRoof();
    else if (id === 'reread-roof') rereadRoof();
    else if (id === 'set-roof-width') {
      const el = $('#roof-width');
      const w = el ? parseFloat(el.value) : NaN;
      if (!(w > 1 && w < 300)) { toast('Type the roof width in metres'); }
      else { state.roof.widthMM = Math.round(w * 1000); rereadRoof(); }
    }
    else if (id === 'clear-verticals') { state.verticals = { files: [], levels: [] }; render(); save(); }
    else if (id === 'btn-preset2') {
      loadRoomLayout(parseInt($('#preset2').value, 10) || 0);
    }
    else if (id === 'btn-add-room') {
      state.params.rooms = state.params.rooms || [];
      state.params.rooms.push({ name: 'New room', type: 'bedroom', L: 3.5, W: 3.0, n: 1 });
      render(); save();
    }
    else if (id === 'btn-new') {
      if (!guard('newBill')) return;
      if (!confirm('Start a new bill? The current work will be cleared.')) return;
      state.image = null; state.analysis = null; state.scaleMM = null;
      state.plans = []; state.planId = null; state.floorShow = null;
      state.roof = null; state.roofRead = null;
      state.buildingRead = null; state.sheets = null; state.sheetInfo = null; state.sheetsKey = null;
      state.roomRead = null;
      state.params = paramsFor('school');
      state.result = null;
      state.libraryId = null; state.libraryCreatedAt = null; lastLibSig = '';
      setStep(1); save(); updateProjectsBadge();
    }
    else if (id === 'btn-projects' || id === 'btn-projects2' || id === 'btn-projects3' ||
             id === 'btn-projects4' || id === 'btn-projects5') openLibrary();
    else if (id === 'btn-save-lib' || id === 'btn-save-lib2') saveToLibrary();
  });

  /* One place that writes a model field. Both listeners below need it: a
     native control fires input and then change, but the searchable select is
     drawn by hand over the native one and fires change only — with the write
     on input alone, picking a new finish looked as if it had done nothing. */
  function applyParamControl(t) {
    if (!t || !t.dataset || !t.dataset.p) return false;
    if (!guard('edit')) { render(); return false; }
    const key = t.dataset.p;
    let v = t.value;
    /* an emptied length box goes back to the figure the model works out */
    if (t.type === 'number' && String(t.value).trim() === '' &&
        (key === 'roofRidgeL' || key === 'roofHipL' || key === 'roofValleyL')) {
      delete state.params[key];
      state.result = recompute(); renderSide(); save(); return true;
    }
    if (t.type === 'number') v = parseFloat(v);
    else if (v === 'true' || v === 'false') v = (v === 'true');
    /* half-typed or cleared: keep the figure the model has */
    if (t.type === 'number' && !isFinite(v)) return true;
    /* a sheet gives its thicknesses in millimetres; the model keeps metres */
    if (t.type === 'number' && t.dataset.scale) v = Math.round((v / (+t.dataset.scale || 1)) * 100000) / 100000;
    // a size typed by hand outranks anything measured from the plan
    if (key === 'bW' || key === 'bD' || key === 'overallW' || key === 'overallD') {
      state.sizeManual = true; state.sizeAdopted = false;
    }
    const prev = state.params[key];
    const same = (typeof prev === 'number' && typeof v === 'number') ? prev === v : String(prev) === String(v);
    if (same) return true;
    state.params[key] = v;
    if (key === 'nClassrooms') {
      const n = Math.max(1, Math.min(8, v || 1));
      state.params.doors[0].n = n;
      state.params.windows[0].n = 2 * n;
      state.params.windows[1].n = n;
    }
    state.result = recompute();
    renderSide();
    save();
    return true;
  }

  document.addEventListener('input', e => {
    const t = e.target;

    /* the search over the drawing set cards */
    if (t.id === 'grp-search') {
      state.grpSearch = t.value;
      filterGroupCards(t.value);
      return;
    }

    /* the search over the building components */
    if (t.id === 'comp-search') {
      state.compSearch = t.value;
      filterComponents(t.value);
      return;
    }

    /* the drainage reading — the run, the chambers, the pipe into the tank */
    if (t.id === 'dr-run' || t.id === 'dr-chambers' || t.id === 'dr-main') {
      if (!guard('edit')) { render(); return; }
      const d = drainState();
      const v = parseFloat(t.value);
      if (!isFinite(v) || v < 0) { render(); return; }
      if (t.id === 'dr-run') {
        d.run = Math.max(0.1, v); d.source = 'typed';
        d.chambers = null;                        // the chambers follow the run again
      } else if (t.id === 'dr-chambers') {
        d.chambers = Math.max(1, Math.round(v));
      } else {
        d.main = Math.max(0, v);
      }
      /* the card is redrawn with the figures the run now gives — the field
         keeps the caret so a second digit can be typed straight in */
      const fid = t.id, caret = t.selectionStart;
      render();
      const again = document.getElementById(fid);
      if (again) { again.focus(); try { again.setSelectionRange(caret, caret); } catch (e) { /* number fields in some browsers */ } }
      save(); return;
    }

    if (t.id === 'scale-mm') {
      if (!guard('edit')) { render(); return; }
      const v = parseFloat(t.value);
      state.scaleMM = isFinite(v) && v > 0 ? v : null;
      state.scaleMode = 'known';
      const a = state.analysis;
      if (a && state.scaleMM) {
        const refPx = state.refPx || a.refPx || a.bbox.w || 1;
        const mmPerPx = state.scaleMM / refPx;
        $$('.stat').forEach(el => {
          const label = el.querySelector('span');
          if (!label) return;
          const b = el.querySelector('b');
          if (label.textContent === 'Plan measures')
            b.textContent = fmt(a.bbox.w * mmPerPx / 1000) + ' × ' + fmt(a.bbox.h * mmPerPx / 1000) + ' m';
          if (label.textContent === 'Resolution') b.textContent = fmt(mmPerPx, 2) + ' mm/px';
          if (label.textContent === 'Scale') b.textContent = 'known dimension';
          if (label.textContent === 'Bay module' && a.modulePx)
            b.textContent = fmt(a.modulePx * mmPerPx / 1000, 2) + ' m';
        });
      }
      save();
      return;
    }

    if (t.classList.contains('rate-input')) {
      if (!guard('edit')) { render(); return; }
      const billCode = t.dataset.bill, idx = parseInt(t.dataset.item, 10);
      const rate = parseFloat(t.value) || 0;
      // persist into the schedule or rates object
      const r = recompute();
      const bill = r.bills.find(b => b.code === billCode);
      const item = bill.items[idx];
      // a rate typed here is the last word: it replaces any take-off correction
      if (state.params.takeoff) {
        const tk = takeoffKey(bill, item);
        const o = state.params.takeoff[tk];
        if (o) {
          delete o.r;
          if (o.q === undefined) delete state.params.takeoff[tk];
        }
      }
      const match = [...state.params.doors, ...state.params.windows].find(o => item.desc.startsWith(o.ref + ' - '));
      if (match) match.rate = rate;
      else if (item.addId) {
        // an item added on the take-off sheet: its own record carries the rate
        const rec = ((state.params.takeoffAdd || {})[billCode] || []).find(x => x.id === item.addId);
        if (rec) rec.rate = rate;
      }
      else if (item.key && item.key.indexOf('add:') !== 0) state.params.rates[item.key] = rate;
      else {
        // last resort: map by position in the generated bill back to the rate key
        const key = RATE_MAP[billCode] && RATE_MAP[billCode][idx];
        if (key) state.params.rates[key] = rate;
      }
      state.result = recompute();
      updateBoqDom();
      save();
      return;
    }

    if (t.dataset.room != null) {
      const i = parseInt(t.dataset.room, 10);
      const k = t.dataset.k;
      const room = state.params.rooms[i];
      room[k] = (k === 'name' || k === 'type') ? t.value : (parseFloat(t.value) || 0);
      state.result = recompute();
      const areaCell = t.closest('tr') ? t.closest('tr').children[5] : null;
      if (areaCell) areaCell.textContent = (room.L * room.W * (room.n || 1)).toFixed(2);
      renderSide(); save();
      return;
    }

    if (t.dataset.openWall != null) {
      const i = parseInt(t.dataset.openWall, 10);
      const p = state.params;
      const list = [...p.doors, ...p.windows];
      if (list[i]) {
        list[i].wall = t.value;
        state.result = recompute();
        render(); save();
      }
      return;
    }

    if (t.dataset.open != null) {
      const i = parseInt(t.dataset.open, 10);
      const nD = state.params.doors.length;
      const target = i < nD ? state.params.doors[i] : state.params.windows[i - nD];
      target.n = Math.max(0, parseInt(t.value, 10) || 0);
      state.result = recompute();
      renderSide();
      save();
      return;
    }

    /* a figure typed against a building component. It is kept as a take-off
       correction, so the take-off sheet shows the same number, marked, and
       the ↺ here and the ↺ there both put the measured figure back. */
    if (t.dataset && t.dataset.compq) {
      if (!guard('edit')) { render(); return; }
      const key = t.dataset.compq;
      const raw = String(t.value == null ? '' : t.value).trim();
      state.params.takeoff = state.params.takeoff || {};
      const entry = state.params.takeoff[key];
      if (raw === '') {
        if (entry) {
          delete entry.q;
          if (entry.r === undefined && entry.desc === undefined && entry.u === undefined) delete state.params.takeoff[key];
        }
      } else {
        const v = parseFloat(raw);
        if (!isFinite(v) || v < 0) { toast('A quantity has to be a number'); t.value = ''; return; }
        const o = entry || {};
        o.q = v;
        if (!o.d) o.d = t.dataset.desc || '';
        state.params.takeoff[key] = o;
      }
      state.result = recompute();
      renderSide();
      const bar = key.indexOf('|');
      refreshComponentRow(key.slice(0, bar), key.slice(bar + 1));
      save();
      return;
    }

    /* a rate typed against a building component. It is kept as the take-off
       sheet keeps one, so the rate column on step 5 shows the same figure,
       typed over the measured one, and ↺ on either side puts it back. */
    if (t.dataset && t.dataset.comprate) {
      if (!guard('edit')) { render(); return; }
      const key = t.dataset.comprate;
      const raw = String(t.value == null ? '' : t.value).trim();
      state.params.takeoff = state.params.takeoff || {};
      const entry = state.params.takeoff[key];
      if (raw === '') {
        if (entry) {
          delete entry.r;
          if (entry.q === undefined && entry.desc === undefined && entry.u === undefined) delete state.params.takeoff[key];
        }
      } else {
        const v = parseFloat(raw);
        if (!isFinite(v) || v < 0) { toast('A rate has to be a number'); t.value = ''; return; }
        const o = entry || {};
        o.r = v;
        if (!o.d) o.d = t.dataset.desc || '';
        state.params.takeoff[key] = o;
      }
      state.result = recompute();
      renderSide();
      const bar = key.indexOf('|');
      refreshComponentRow(key.slice(0, bar), key.slice(bar + 1));
      save();
      return;
    }

    if (t.dataset.p) {
      const ok = applyParamControl(t);
      if (ok && state.step === 4 && ['autoFit', 'officeOn'].includes(t.dataset.p)) render();
      if (ok && state.step === 6) updateBoqDom();
      return;
    }
  });

  /* the end of a typed figure: the row is redrawn in full, keeping the caret
     out of it — the box was not rebuilt while it was being typed in */
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset && t.dataset.compq) {
      const key = t.dataset.compq, bar = key.indexOf('|');
      state.result = recompute();
      refreshComponentRow(key.slice(0, bar), key.slice(bar + 1));
      return;
    }
    /* a dimension typed on the schedule: the model re-measures from it */
    if (t.dataset && t.dataset.compdim) {
      if (!guard('edit')) { render(); return; }
      const id = t.dataset.compdim;
      const scale = +t.dataset.scale || 1;
      let v = parseFloat(t.value);
      if (!isFinite(v)) { toast('A dimension has to be a number'); render(); return; }
      const lo = parseFloat(t.min), hi = parseFloat(t.max);
      if (isFinite(lo)) v = Math.max(lo, v);
      if (isFinite(hi)) v = Math.min(hi, v);
      const metres = Math.round((v / scale) * 10000) / 10000;
      const m = /^open:(door|window):(\d+):(w|h)$/.exec(id);
      if (m) {
        const list = m[1] === 'door' ? state.params.doors : state.params.windows;
        if (!list || !list[+m[2]]) return;
        list[+m[2]][m[3]] = metres;
      } else {
        state.params[id] = metres;
      }
      rerenderModel();
      return;
    }

    /* a count typed on the schedule. Columns, lintels and trusses are counts
       the model keeps; a door or window count is that opening's number. */
    if (t.dataset && t.dataset.compcount) {
      if (!guard('edit')) { render(); return; }
      const id = t.dataset.compcount;
      const raw = String(t.value == null ? '' : t.value).trim();
      const m = /^open:(door|window):(\d+)$/.exec(id);
      if (m) {
        const list = m[1] === 'door' ? state.params.doors : state.params.windows;
        const item = list && list[+m[2]];
        if (!item) return;
        item.n = Math.max(0, Math.min(99, parseInt(raw, 10) || 0));
        state.result = recompute();
        renderSide();
        render();
        save();
        return;
      }
      if (raw === '') delete state.params[id];
      else state.params[id] = Math.max(0, Math.min(999, Math.round(parseFloat(raw) || 0)));
      rerenderModel();
      return;
    }

    if (t.dataset && t.dataset.comprate) {
      const key = t.dataset.comprate, bar = key.indexOf('|');
      state.result = recompute();
      const c = (state.result.model.components || []).find(x => x.bill === key.slice(0, bar) && x.key === key.slice(bar + 1));
      /* one rate prices every line that points at the same bill row */
      if (c && c.shared) render();
      else refreshComponentRow(key.slice(0, bar), key.slice(bar + 1));
      return;
    }
    /* a door or window count typed on the component schedule is a model input:
       the joinery, the lintels and the wall area all follow from it */
    if (t.dataset && t.dataset.compopen != null) {
      if (!guard('edit')) { render(); return; }
      const i = parseInt(t.dataset.compopen, 10);
      const nD = state.params.doors.length;
      const target = i < nD ? state.params.doors[i] : state.params.windows[i - nD];
      if (!target) return;
      let v = parseInt(t.value, 10);
      if (!isFinite(v) || v < 0) v = 0;
      if (v > 99) v = 99;
      const changed = target.n !== v;
      target.n = v;
      t.value = v;
      state.result = recompute();
      renderSide();
      save();
      /* the door schedule, the joinery area and the lintels all move with the
         count, so the whole step is drawn again — the caret has left the box */
      if (changed) { render(); return; }
      refreshComponentRow(
        ((state.result.model.components || []).find(x => x.key === (i < nD ? 'door:' : 'window:') + target.ref) || {}).bill || '',
        (i < nD ? 'door:' : 'window:') + target.ref);
      return;
    }
  });

  /* ↺ against a corrected figure: the measured one comes back */
  /* Enter on the search over the set: a single card left, file straight into it */
  document.addEventListener('keydown', e => {
    if (!e.target || e.target.id !== 'grp-search') return;
    if (e.key === 'Escape') { e.preventDefault(); clearGroupSearch(); return; }
    if (e.key === 'Enter') { e.preventDefault(); openSearchedCard(); }
  });

  document.addEventListener('click', e => {
    const gAll = e.target.closest ? e.target.closest('#grp-search-all, #grp-search-clear') : null;
    if (gAll) { e.preventDefault(); clearGroupSearch(); return; }
    const clear = e.target.closest ? e.target.closest('#comp-search-clear') : null;
    if (clear) {
      e.preventDefault();
      const box = document.getElementById('comp-search');
      state.compSearch = '';
      if (box) { box.value = ''; box.focus(); }
      filterComponents('');
      return;
    }
    const rate = e.target.closest ? e.target.closest('[data-compratereset]') : null;
    if (rate) {
      e.preventDefault();
      if (!guard('edit')) return;
      const key = rate.dataset.compratereset;
      const entry = state.params.takeoff && state.params.takeoff[key];
      if (entry && key.indexOf('|') > 0) {
        delete entry.r;
        if (entry.q === undefined && entry.desc === undefined && entry.u === undefined) delete state.params.takeoff[key];
        state.result = recompute();
        render();
        toast('Back to the measured rate');
      }
      return;
    }
    const b = e.target.closest ? e.target.closest('[data-compreset]') : null;
    if (!b) return;
    e.preventDefault();
    if (!guard('edit')) return;
    const key = b.dataset.compreset;
    if (state.params.takeoff && key.indexOf('|') > 0) {
      delete state.params.takeoff[key];
      state.result = recompute();
      render();
      toast('Back to the measured quantity');
    }
  });

  /* a description box grows with what is in it, and Enter finishes the edit */
  function sizeTakeoffDesc(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(180, el.scrollHeight || 0) + 'px';
  }
  document.addEventListener('input', e => {
    const t = e.target;
    if (t && t.classList && t.classList.contains('to-desc')) sizeTakeoffDesc(t);
  });
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (t && t.classList && t.classList.contains('to-desc') && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      t.blur();
    }
  });

  document.addEventListener('change', e => {
    const t = e.target;

    /* a rewritten description or a changed unit on the take-off sheet */
    if (t.dataset && (t.dataset.todesc !== undefined || t.dataset.tounit !== undefined)) {
      if (!guard('edit')) { rerenderTakeoff(null); return; }
      const isDesc = t.dataset.todesc !== undefined;
      const key = isDesc ? t.dataset.todesc : t.dataset.tounit;
      const val = String(t.value == null ? '' : t.value).replace(/\s+/g, ' ').trim();
      const ai = key.indexOf('|add:');
      const sel = '.' + (isDesc ? 'to-desc[data-todesc' : 'to-unit[data-tounit') + '="' + String(key).replace(/"/g, '\\"') + '"]';
      if (ai >= 0) {
        const code = key.slice(0, ai), id = key.slice(ai + 5);
        const rec = ((state.params.takeoffAdd || {})[code] || []).find(x => x.id === id);
        if (!rec) return;
        if (isDesc) {
          if (!val) { toast('An item needs a description'); rerenderTakeoff(sel); return; }
          rec.desc = val;
        } else if (val) rec.unit = val;
      } else {
        state.params.takeoff = state.params.takeoff || {};
        const entry = state.params.takeoff[key] || { d: t.dataset.desc || '' };
        if (isDesc) {
          if (!val) { toast('An item needs a description'); rerenderTakeoff(sel); return; }
          entry.desc = val;
        } else if (val) entry.u = val;
        else delete entry.u;
        if (entry.q === undefined && entry.r === undefined && entry.desc === undefined && entry.u === undefined) delete state.params.takeoff[key];
        else state.params.takeoff[key] = entry;
      }
      rerenderTakeoff(sel);
      return;
    }

    if (t.id === 'room-sheet') { useRoomSheet(parseInt(t.value, 10)); return; }
    if (t.id === 'room-floor') {
      const rd = state.roomRead;
      useRoomSheet(rd ? rd.page : (state.pdf && state.pdf.page), parseInt(t.value, 10));
      return;
    }

    if (t.id === 'scale-mode') {
      state.scaleMode = t.value;
      const sh = currentSheet();
      if (state.scaleMode === 'ratio') {
        if (!state.paperMM) state.paperMM = sh && sh.longestPt ? Math.round(sh.longestPt * 0.352778) : 420;
      }
      if (state.scaleMode === 'known' && !state.scaleMM) {
        state.scaleMM = Math.round(((isSchool() ? +state.params.overallW : +state.params.bW) || 0) * 1000) || null;
      }
      syncScale();
      if (!state.sizeManual && state.analysis) adoptMeasuredSize(true);
      render(); save();
      return;
    }
    if (t.id === 'scale-paper') {
      state.paperMM = +t.value || 420; syncScale();
      if (!state.sizeManual && state.analysis) adoptMeasuredSize(true);
      render(); save(); return;
    }
    if (t.id === 'scale-ratio') {
      state.ratio = Math.max(10, Math.min(1000, +t.value || 100)); syncScale();
      if (!state.sizeManual && state.analysis) adoptMeasuredSize(true);
      render(); save(); return;
    }

    if (t.dataset && (t.dataset.addqty || t.dataset.addrate)) {
      if (!guard('edit')) { rerenderTakeoff(null); return; }
      const isRate = !!t.dataset.addrate;
      const rawKey = isRate ? t.dataset.addrate : t.dataset.addqty;
      const i = rawKey.indexOf('|');
      const code = rawKey.slice(0, i), id = rawKey.slice(i + 1);
      const rec = ((state.params.takeoffAdd || {})[code] || []).find(x => x.id === id);
      if (!rec) return;
      const v = parseFloat(t.value);
      if (!isFinite(v) || v < 0) { toast(isRate ? 'A rate has to be a number' : 'A quantity has to be a number'); t.value = ''; return; }
      rec[isRate ? 'rate' : 'qty'] = v;
      rerenderTakeoff('.' + (isRate ? 'to-rate' : 'to-in') + '[' + (isRate ? 'data-addrate' : 'data-addqty') + '="' + String(rawKey).replace(/"/g, '\\"') + '"]');
      return;
    }

    if (t.dataset && (t.dataset.to || t.dataset.torate)) {
      if (!guard('edit')) { rerenderTakeoff(null); return; }
      const isRate = !!t.dataset.torate;
      const key = isRate ? t.dataset.torate : t.dataset.to;
      const raw = String(t.value == null ? '' : t.value).trim();
      state.params.takeoff = state.params.takeoff || {};
      const entry = state.params.takeoff[key];
      if (raw === '') {
        if (entry) {
          delete entry[isRate ? 'r' : 'q'];
          if (entry.q === undefined && entry.r === undefined) delete state.params.takeoff[key];
        }
      } else {
        const v = parseFloat(raw);
        if (!isFinite(v) || v < 0) { toast(isRate ? 'A rate has to be a number' : 'A quantity has to be a number'); t.value = ''; return; }
        const o = entry || { d: t.dataset.desc || '' };
        o[isRate ? 'r' : 'q'] = v;
        o.d = o.d || t.dataset.desc || '';
        state.params.takeoff[key] = o;
      }
      rerenderTakeoff('.' + (isRate ? 'to-rate' : 'to-in') + '[' + (isRate ? 'data-torate' : 'data-to') + '="' + String(key).replace(/"/g, '\\"') + '"]');
      return;
    }

    /* a model field changed. Written here as well as on input, because the
       searchable select fires change only (see applyParamControl). */
    if (t.dataset && t.dataset.p) {
      const key = t.dataset.p;
      const prevType = RoofGeom.norm(state.params.roofType);
      /* a pitch or an overhang is remembered by the type it was given to, so
         bringing a type back brings its own figures back with it */
      if (key === 'roofPitch' || key === 'overhang') {
        const v0 = parseFloat(t.value);
        if (isFinite(v0)) {
          const by = state.params[key + 'ByType'] = state.params[key + 'ByType'] || {};
          by[prevType] = v0;
        }
      }
      const ok = applyParamControl(t);
      if (!ok) return;
      /* a new type arrives with the figures that suit it — and only a type that
         has actually changed brings them: re-picking the same one leaves the
         project's own pitch alone */
      if (key === 'roofType' && prevType !== RoofGeom.norm(t.value)) {
        const k = RoofGeom.norm(t.value);
        const pBy = state.params.roofPitchByType = state.params.roofPitchByType || {};
        const oBy = state.params.overhangByType = state.params.overhangByType || {};
        if (pBy[prevType] == null) pBy[prevType] = +state.params.roofPitch;
        if (oBy[prevType] == null) oBy[prevType] = +state.params.overhang;
        state.params.roofPitch = pBy[k] != null ? pBy[k] : RoofGeom.DEFAULT_PITCH[k];
        state.params.overhang = oBy[k] != null ? oBy[k] : RoofGeom.DEFAULT_OVERHANG[k];
        if (state.params.parapet == null) state.params.parapet = RoofGeom.DEFAULT_PARAPET[k];
        state.result = recompute();
        renderSide();
        save();
      }
      if (state.step >= 3) { render(); return; }
      // on Read & scale the roof type and settings rewrite the facts beside them;
      // a drawing-set card's settings rewrite the rest of that card the same way
      if (t.closest && (t.closest('#roof-settings') || t.closest('[data-settings]'))) {
        const y = window.scrollY;
        render();
        window.scrollTo(0, y);
      }
    }
  });

  // update amounts/totals in the BOQ without re-rendering the DOM
  function updateBoqDom() {
    const r = recompute();
    r.bills.forEach(b => {
      b.items.forEach((it, i) => {
        const row = document.querySelector(`tr[data-bill="${b.code}"][data-item="${i}"]`);
        if (!row) return;
        const amt = row.querySelector('[data-amount]');
        if (amt) amt.textContent = fmt(it.amount);
        const qtyCell = row.children[3];
        if (qtyCell) qtyCell.textContent = fmtQty(it.qty, it.unit);
        const inp = row.querySelector('.rate-input');
        if (inp && document.activeElement !== inp) inp.value = it.rate;
      });
      const bt = document.querySelector(`[data-bill-total="${b.code}"]`);
      if (bt) bt.textContent = fmt(b.total);
    });
    const grand = document.querySelector('.grand .amount');
    if (grand) grand.textContent = SYM(state.params) + ' ' + fmt(r.grand);
    const wordsEl = document.querySelector('.grand .words');
    if (wordsEl) wordsEl.textContent = words(r.grand, r.params) + ' Only';
    document.querySelectorAll('tfoot tr').forEach(tr => {
      const tds = tr.querySelectorAll('td');
      if (tds.length === 3 && /Contingency at/.test(tds[0].textContent)) {
        tds[0].textContent = 'Contingency at ' + state.params.contingency + '%';
        tds[1].textContent = fmt(r.contingency);
        tds[2].textContent = fmt(r.grand);
      }
      if (tds.length === 3 && /Sub-total of bills/.test(tds[0].textContent)) {
        tds[1].textContent = fmt(r.subtotal);
      }
    });
    const noteGrand = document.querySelector('.note b');
    if (noteGrand && /Grand total/.test(noteGrand.textContent)) noteGrand.textContent = 'Grand total: ' + SYM(state.params) + ' ' + fmt(r.grand);
    renderSide();
    save();
  }

  const PRESETS = [
    {
      label: '2-room GES block with office',
      params: { nClassrooms: 2, autoFit: false, overallW: 12.45, mainD: 7.65, wingW: 4.65, wingD: 5.1,
        doors: [{ ref: 'D1', desc: '1,500 x 2,100 mm double-leaf hardwood panel doors, complete with frames, architraves and 100 mm butt hinges, to rooms', w: 1.5, h: 2.1, n: 2, wall: 'int', rate: 3650 },
                { ref: 'D2', desc: "900 x 2,100 mm solid core flush door with hardwood frame and architrave, to Head Master's Office", w: 0.9, h: 2.1, n: 1, wall: 'int', rate: 2150 },
                { ref: 'D3', desc: '750 x 2,100 mm solid core flush door with hardwood frame and architrave, to WC', w: 0.75, h: 2.1, n: 1, wall: 'int', rate: 1850 },
                { ref: 'D4', desc: '1,200 x 2,100 mm opening between front verandah and office verandah', w: 1.2, h: 2.1, n: 1, wall: 'int', rate: 0 }],
        windows: [{ ref: 'W1', desc: '1,830 x 1,200 mm steel-framed louvre windows with aluminium louvre blades, glazing and 12 mm burglar bars, to external walls of rooms', w: 1.83, h: 1.2, n: 4, wall: 'ext', rate: 2750 },
                  { ref: 'W2', desc: '1,830 x 1,200 mm steel-framed louvre windows with blades and burglar bars, to room/verandah wall', w: 1.83, h: 1.2, n: 2, wall: 'int', rate: 2650 },
                  { ref: 'W3', desc: '1,200 x 1,200 mm steel-framed louvre windows with blades and burglar bars, to office', w: 1.2, h: 1.2, n: 2, wall: 'ext', rate: 2050 },
                  { ref: 'W4', desc: '600 x 600 mm louvre window with glass blades, to WC', w: 0.6, h: 0.6, n: 1, wall: 'ext', rate: 980 }] }
    },
    {
      label: '3-room GES block, Head Master\'s office + WC (PS 1)',
      params: { nClassrooms: 3, autoFit: false, overallW: 18.6, mainD: 7.65, wingW: 4.65, wingD: 5.1 }
    },
    {
      label: '3-room GES block, no office wing',
      params: { nClassrooms: 3, officeOn: false, autoFit: true }
    },
    {
      label: '6-room GES block with two offices',
      params: { nClassrooms: 6, autoFit: false, overallW: 37.2, mainD: 7.65, wingW: 4.65, wingD: 5.1,
        doors: [{ ref: 'D1', desc: '1,500 x 2,100 mm double-leaf hardwood panel doors, complete with frames, architraves and 100 mm butt hinges, to rooms', w: 1.5, h: 2.1, n: 6, wall: 'int', rate: 3650 },
                { ref: 'D2', desc: "900 x 2,100 mm solid core flush door with hardwood frame and architrave, to Head Master's Office", w: 0.9, h: 2.1, n: 1, wall: 'int', rate: 2150 },
                { ref: 'D3', desc: '750 x 2,100 mm solid core flush door with hardwood frame and architrave, to WC', w: 0.75, h: 2.1, n: 1, wall: 'int', rate: 1850 },
                { ref: 'D4', desc: '1,200 x 2,100 mm opening between front verandah and office verandah', w: 1.2, h: 2.1, n: 1, wall: 'int', rate: 0 }],
        windows: [{ ref: 'W1', desc: '1,830 x 1,200 mm steel-framed louvre windows with aluminium louvre blades, glazing and 12 mm burglar bars, to external walls of rooms', w: 1.83, h: 1.2, n: 12, wall: 'ext', rate: 2750 },
                  { ref: 'W2', desc: '1,830 x 1,200 mm steel-framed louvre windows with blades and burglar bars, to room/verandah wall', w: 1.83, h: 1.2, n: 6, wall: 'int', rate: 2650 },
                  { ref: 'W3', desc: '1,200 x 1,200 mm steel-framed louvre windows with blades and burglar bars, to office', w: 1.2, h: 1.2, n: 2, wall: 'ext', rate: 2050 },
                  { ref: 'W4', desc: '600 x 600 mm louvre window with glass blades, to WC', w: 0.6, h: 0.6, n: 1, wall: 'ext', rate: 980 }] }
    },
    {
      label: 'KG block — one large room, store and WC',
      params: { nClassrooms: 1, crW: 8.0, crD: 6.0, verD: 2.4, autoFit: true, officeOn: true,
        officeW: 3.0, officeD: 3.6, wcD: 1.2, offVerW: 1.2,
        doors: [{ ref: 'D1', desc: '1,500 x 2,100 mm double-leaf hardwood panel doors, complete with frames, architraves and 100 mm butt hinges, to rooms', w: 1.5, h: 2.1, n: 1, wall: 'int', rate: 3650 },
                { ref: 'D2', desc: "900 x 2,100 mm solid core flush door with hardwood frame and architrave, to store/office", w: 0.9, h: 2.1, n: 1, wall: 'int', rate: 2150 },
                { ref: 'D3', desc: '750 x 2,100 mm solid core flush door with hardwood frame and architrave, to WC', w: 0.75, h: 2.1, n: 1, wall: 'int', rate: 1850 },
                { ref: 'D4', desc: '1,200 x 2,100 mm opening between front verandah and office verandah', w: 1.2, h: 2.1, n: 1, wall: 'int', rate: 0 }],
        windows: [{ ref: 'W1', desc: '1,830 x 1,200 mm steel-framed louvre windows with aluminium louvre blades, glazing and 12 mm burglar bars, to external walls of rooms', w: 1.83, h: 1.2, n: 3, wall: 'ext', rate: 2750 },
                  { ref: 'W2', desc: '1,830 x 1,200 mm steel-framed louvre windows with blades and burglar bars, to room/verandah wall', w: 1.83, h: 1.2, n: 1, wall: 'int', rate: 2650 },
                  { ref: 'W3', desc: '1,200 x 1,200 mm steel-framed louvre windows with blades and burglar bars, to office', w: 1.2, h: 1.2, n: 1, wall: 'ext', rate: 2050 },
                  { ref: 'W4', desc: '600 x 600 mm louvre window with glass blades, to WC', w: 0.6, h: 0.6, n: 1, wall: 'ext', rate: 980 }] }
    }
  ];

  /* "Load a typical layout" sits in the room schedule, so it loads rooms and
     nothing else: the building size, storeys, openings, services and rates
     stay exactly as they are. */
  function loadRoomLayout(i) {
    const preset = Settings.PRESETS[i];
    if (!preset) return;
    const rooms = (preset.params.rooms || []).map(r => ({
      name: r.name || r.type || 'Room', type: r.type || 'living',
      L: +r.L || 3.5, W: +r.W || 3.0, n: Math.max(1, Math.round(+r.n || 1))
    }));
    if (!rooms.length) { toast('That layout has no room schedule'); return; }
    const cur = state.params.rooms || [];
    if (cur.length && !confirm('Replace the ' + cur.length + ' room' + (cur.length === 1 ? '' : 's') +
        ' in the schedule with the ' + rooms.length + ' rooms of the ' + preset.label + '?\n\n' +
        'The building size, storeys, openings and rates are not changed.')) return;
    state.params.rooms = rooms;
    state.roomRead = null;          // the schedule no longer comes from the drawing
    state.roomPreset = i;           // keep the chosen layout in the dropdown
    state.result = recompute();
    render(); save();
    let msg = rooms.length + ' rooms loaded — the building size and openings are unchanged';
    if ((+preset.params.storeys || 1) > (+state.params.storeys || 1)) {
      msg += ' · that layout is a ' + preset.params.storeys + '-storey building, set the storeys in Settings';
    }
    toast(msg);
  }

  function applyGenPreset(i) {
    const preset = Settings.PRESETS[i];
    if (!preset) return;
    state.params = paramsFor(preset.params.template === 'school' ? 'school' : 'general', preset.params);
    state.result = recompute();
    toast(preset.label);
    render();
  }

  const RATE_MAP = {
    'BILL No. 1': ['siteClear', 'tempWorks', 'waterElec', 'supervision', 'ppe', 'insurance'],
    'BILL No. 2': ['excTrench', 'excPit', 'blinding', 'fdnConc', 'colBase', 'fdnWall', 'backfill', 'hardcore', 'dpm', 'oversite', 'termite'],
    'BILL No. 3': ['colConc', 'ringBeam', 'lintel', 'rebar', 'formwork'],
    'BILL No. 4': ['block', 'balustrade'],
    'BILL No. 5': ['truss', 'purlin', 'roofSheet', 'ridge', 'fascia', 'barge', 'roofSundries'],
    'BILL No. 6': ['ceiling', 'cornice', 'hatch'],
    'BILL No. 8': ['screed', 'terrazzo', 'tiles', 'skirting'],
    'BILL No. 9': ['plaster', 'render', 'wallTile'],
    'BILL No. 10': ['paintInt', 'paintExt', 'gloss'],
    'BILL No. 11': ['db', 'submain', 'lightPoint', 'socket', 'wiring', 'earthing', 'bulkhead'],
    'BILL No. 12': ['wc', 'basin', 'floorDrain', 'soil', 'water', 'tank', 'septic'],
    'BILL No. 13': ['apron', 'steps', 'drain', 'levelling', 'landscaping']
  };

  // tracing the drain route on the plan
  document.addEventListener('click', e => {
    if (!state.drainTrace) return;
    const im = e.target.closest('#plan-img');
    if (!im) return;
    const rect = im.getBoundingClientRect();
    const a = state.analysis;
    state.drainPts.push({
      x: (e.clientX - rect.left) / rect.width * a.width,
      y: (e.clientY - rect.top) / rect.height * a.height
    });
    render();
  });

  // click-to-calibrate on the plan image
  document.addEventListener('click', e => {
    if (!state.pickMode) return;
    const im = e.target.closest('#plan-img');
    if (!im) return;
    const rect = im.getBoundingClientRect();
    const a = state.analysis;
    const x = (e.clientX - rect.left) / rect.width * a.width;
    const y = (e.clientY - rect.top) / rect.height * a.height;
    state.picked.push({ x, y });
    if (state.picked.length === 2) {
      const [p1, p2] = state.picked;
      const px = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const current = state.scaleMM || Math.round(state.params.overallW * 1000);
      const input = prompt('Real distance between the two points, in millimetres:', Math.round(current));
      if (input) {
        const mm = parseFloat(input);
        if (mm > 0) {
          state.refPx = Math.max(1, px);
          state.scaleMM = mm;
          state.scaleSource = 'points';
          toast('Reference measured: ' + Math.round(px) + ' px = ' + fmt(mm, 0) + ' mm');
        }
      }
      state.pickMode = false;
      state.picked = [];
    }
    render();
  });

  document.addEventListener('dragover', e => {
    const d = e.target.closest('#drop') || e.target.closest('#drop-roof') || e.target.closest('[data-roof-drop]');
    if (d) { e.preventDefault(); d.classList.add('over'); }
  });
  document.addEventListener('dragleave', e => {
    const d = e.target.closest('#drop') || e.target.closest('#drop-roof') || e.target.closest('[data-roof-drop]');
    if (d) d.classList.remove('over');
  });
  document.addEventListener('drop', e => {
    const roofDrop = e.target.closest('#drop-roof') || e.target.closest('[data-roof-drop]');
    if (roofDrop) {
      e.preventDefault(); roofDrop.classList.remove('over');
      const rf = e.dataTransfer.files && e.dataTransfer.files[0];
      const okr = rf && (/^image\//.test(rf.type) || (typeof PdfImport !== 'undefined' && PdfImport.isPdf(rf)));
      if (okr) readRoofFile(rf);
      else toast('Please drop an image or PDF file');
      return;
    }
    const d = e.target.closest('#drop');
    if (!d) return;
    e.preventDefault(); d.classList.remove('over');
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    const ok = files.filter(f => /^image\//.test(f.type) || (typeof PdfImport !== 'undefined' && PdfImport.isPdf(f)));
    if (ok.length) addPlanFiles(ok);
    else toast('Please drop image or PDF files');
  });

  document.addEventListener('change', e => {
    if (e.target.hasAttribute && e.target.hasAttribute('data-roof-kind')) {
      const k = e.target.value;
      if (k !== 'roof' && state.roof && state.roof.dataUrl) {
        const rec = registerPlan({ name: state.roof.name, size: state.roof.size,
                                   dataUrl: state.roof.dataUrl, kind: k });
        rec.group = KIND_GROUP[k] || 'floor';
        state.roof = null; state.roofRead = null;
        if (state.params && state.params.roofPlan) state.params.roofPlan = null;
        state.result = recompute(); render(); save();
        toast(rec.name + ' filed under ' + groupDef(rec.group).label);
      }
      return;
    }
    if (e.target.hasAttribute && e.target.hasAttribute('data-plan-level')) {
      if (!guard('edit')) { render(); return; }
      const rec = planById(e.target.getAttribute('data-plan-level'));
      if (rec) {
        const lv = Math.max(0, Math.min(FLOOR_LIMIT - 1, parseInt(e.target.value, 10) || 0));
        const was = rec.level == null ? null : Math.max(0, Math.round(+rec.level));
        /* a floor takes one drawing: if that storey already has a sheet, the
           two swap places rather than share a floor */
        const other = plansOf().find(p => p !== rec && isFloorPlan(p) &&
          Math.max(0, Math.round(+p.level || 0)) === lv);
        rec.level = lv;
        if (other) other.level = was != null ? was : firstFreeLevel(rec);
        /* stay on the floor that was just set, so the row cannot vanish */
        if (state.floorShow != null) state.floorShow = lv;
        render(); save();
        toast(rec.name + ' set to ' + floorName(lv).toLowerCase() +
          (other ? ' \u2014 ' + other.name + ' takes ' + floorName(other.level).toLowerCase() : ''));
      }
      return;
    }
    if (e.target.hasAttribute && e.target.hasAttribute('data-plan-kind')) {
      const rec = planById(e.target.getAttribute('data-plan-kind'));
      if (rec) {
        rec.kind = e.target.value;
        rec.group = KIND_GROUP[rec.kind] || 'floor';     // and it moves to that card
        if (rec.group === 'floor' && rec.level == null) {
          const guess = levelFromName(rec.name);
          rec.level = guess != null && !floorPlanAt(guess) ? guess : firstFreeLevel(rec);
        }
        render(); save();
        toast(rec.name + ' filed under ' + groupDef(rec.group).label);
      }
      return;
    }
    if (e.target.id === 'roof-input' && e.target.files && e.target.files[0]) {
      const f = e.target.files[0]; e.target.value = '';
      readRoofFile(f);
      return;
    }
    if (e.target.id === 'pdf-page' && state.pdfFile) {
      handleFile(state.pdfFile, parseInt(e.target.value, 10) || 1);
    }
    if (e.target.id === 'building-type') {
      state.buildingRead = null;
      applyBuildingType(e.target.value, []);
      state.result = recompute();
      render(); save();
      /* the type is the one control every other list reads from, so say so
         rather than leaving the change to be discovered on another step */
      const n = (Settings.presetsForType ? Settings.presetsForType(e.target.value).length : 0);
      toast(buildingLabel(e.target.value) + ' \u2014 ' + (n ? n + ' typical layout' + (n === 1 ? '' : 's') : 'no library layout')
        + ', the measurement template and the room types now follow it');
      return;
    }
    if (e.target.dataset && e.target.dataset.sheetRole && state.sheets) {
      if (!guard('edit')) { render(); return; }
      const pg = parseInt(e.target.dataset.sheetRole, 10);
      const s = state.sheets.find(x => x.page === pg);
      if (s) s.kind = e.target.value;
      const got = applySheetNumbers();
      state.result = recompute();
      if (got.length) toast('Drawing set read — ' + got.slice(0, 3).join(', '));
      if (e.target.value === 'section' && state.pdfFile) readSheetSections(state.pdfFile);
      render(); save();
    }
  });

  $('#file-input').addEventListener('change', e => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length) addPlanFiles(files);
  });

  /* the eleven cards each take files straight into their own place */
  document.addEventListener('change', e => {
    const t = e.target;
    if (!t || !t.classList || !t.classList.contains('grp-input')) return;
    const files = t.files ? Array.from(t.files) : [];
    t.value = '';
    if (files.length) addPlanFiles(files, t.getAttribute('data-grp'));
  });
  /* a section or an elevation gives the levels the bill uses: the long
     horizontal lines in it, measured from the lowest one. Used both by the
     section upload and by a section filed in the drawing set. */
  function applyVerticalImage(img, name, dataUrl) {
    try {
      const a = PlanAnalyser.analyse(img, 1400);
      const levels = a.hStrong.slice(0, 14).map(l => ({ pos: l.pos }));
      if (!levels.length) return null;
      const ref = state.refPx || (state.analysis && state.analysis.refPx) || 1;
      const mmPerPx = state.scaleMM ? state.scaleMM / ref : null;
      const basePx = Math.max.apply(null, levels.map(l => l.pos));
      levels.forEach(l => {
        l.m = mmPerPx ? Math.abs(basePx - l.pos) * mmPerPx / 1000 : null;
      });
      state.verticals = state.verticals || { files: [], levels: [] };
      if (dataUrl && !(state.verticals.files || []).some(f => f.name === name)) {
        state.verticals.files.push({ name: name, dataUrl: dataUrl });
      }
      state.verticals.levels = levels;
      state.verticals.printed = false;
      return levels;
    } catch (e) { return null; }
  }

  $('#vertical-input').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const { img, dataUrl, name } = await imageFromFile(f);
      const levels = applyVerticalImage(img, name, dataUrl);
      if (!levels) { toast('No level lines found on that drawing'); return; }
      toast('Section read — ' + levels.length + ' level lines found');
      render(); save();
    } catch (err) {
      toast('Could not read that drawing');
    }
  });

  $('#json-input').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) loadJson(f);
    e.target.value = '';
  });

  $('#lib-input').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) restoreLibrary(f);
    e.target.value = '';
  });

  /* ------------------------------------------------- dragging a take-off row */
  /* the grip at the end of a row lifts it: the row follows the pointer and
     lands wherever it is dropped, and the order is kept per bill */
  let toDrag = null;

  document.addEventListener('pointerdown', e => {
    const grip = e.target.closest && e.target.closest('.to-grip');
    if (!grip) return;
    const row = grip.closest('tr');
    const body = row && row.parentElement;
    if (!row || !body || body.tagName !== 'TBODY') return;
    e.preventDefault();
    toDrag = { row: row, body: body, moved: false };
    row.classList.add('dragging');
    document.body.classList.add('to-dragging');
    try { if (grip.setPointerCapture) grip.setPointerCapture(e.pointerId); } catch (err) { /* not fatal */ }
  });

  document.addEventListener('pointermove', e => {
    if (!toDrag) return;
    const rows = Array.from(toDrag.body.children).filter(r => r !== toDrag.row);
    let before = null;
    for (const r of rows) {
      const b = r.getBoundingClientRect();
      if (e.clientY < b.top + b.height / 2) { before = r; break; }
    }
    if (before) toDrag.body.insertBefore(toDrag.row, before);
    else toDrag.body.appendChild(toDrag.row);
    toDrag.moved = true;
  });

  function commitTakeoffOrder(body, focusKey) {
    const code = body.dataset.bill;
    const keys = Array.from(body.children).map(tr => tr.dataset.key).filter(Boolean);
    state.params.takeoffOrder = state.params.takeoffOrder || {};
    state.params.takeoffOrder[code] = keys;
    rerenderTakeoff(null);
    if (focusKey) {
      const again = document.querySelector('tr[data-key="' + String(focusKey).replace(/"/g, '\\"') + '"] .to-grip');
      if (again) again.focus();
    }
    toast('Order changed — the bill and the exports follow it');
  }

  function endTakeoffDrag() {
    if (!toDrag) return;
    const d = toDrag;
    toDrag = null;
    d.row.classList.remove('dragging');
    document.body.classList.remove('to-dragging');
    if (!d.moved) return;
    commitTakeoffOrder(d.body, null);
  }

  document.addEventListener('pointerup', endTakeoffDrag);
  document.addEventListener('pointercancel', endTakeoffDrag);

  // the grip also moves a row with the arrow keys, for anyone without a mouse
  document.addEventListener('keydown', e => {
    const grip = e.target.closest && e.target.closest('.to-grip');
    if (!grip) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const row = grip.closest('tr');
    const body = row && row.parentElement;
    if (!row || !body) return;
    const other = e.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling;
    if (!other) return;
    e.preventDefault();
    if (e.key === 'ArrowUp') body.insertBefore(row, other);
    else body.insertBefore(other, row);
    commitTakeoffOrder(body, row.dataset.key);
  });

  // Escape closes the description list wherever the caret happens to be
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (acPop && !acPop.hidden) {
      e.preventDefault();
      e.stopPropagation();
      acClose();
      const input = acInput();
      if (input) input.focus();
    }
  }, true);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('side')) {
      state.sideOpen = false;
      save();
      paintSide();
    }
  });

  window.addEventListener('beforeprint', () => {
    // the take-off sheet prints as it stands, every bill unfolded
    if (state.step === 5) {
      document.querySelectorAll('details.to-bill').forEach(d => { d.open = true; });
      return;
    }
    // otherwise make sure the bill is the visible step when printing
    if (![6, 7, 8, 9].includes(state.step)) { state.step = 6; render(); }
  });

  /* ---------------------------------------------------------------- sample */
  function printBill() {
    const back = state.step;
    state.step = 6;
    render();
    setTimeout(() => { window.print(); state.step = back; }, 200);
  }

  async function loadSample() {
    state.params = paramsFor('school');
    state.libraryId = null; state.libraryCreatedAt = null; lastLibSig = '';
    state.scaleMM = 18600;
    state.refPx = null;
    if (typeof SAMPLE_PLAN !== 'undefined' && SAMPLE_PLAN) {
      const img = await PlanAnalyser.loadDataUrl(SAMPLE_PLAN);
      state.image = { dataUrl: SAMPLE_PLAN, name: 'PS 1 — 3-room GES block', size: 0 };
      state.analysis = PlanAnalyser.analyse(img);
      state.refPx = state.analysis.refPx;
      state.plans = [];                       // the sample is a fresh project
      const rec = registerPlan({ name: 'PS 1 — 3-room GES block', size: 0, dataUrl: SAMPLE_PLAN, kind: 'floor' });
      state.planId = rec.id;
      storePlanScale();
    }
    toast('PS 1 sample loaded');
    setStep(2);
  }

  /* ---------------------------------------------------------------- boot
     The app opens on the lock screen: who is using it decides whose bills
     are on the shelf and what this session may change. */
  let started = false;

  /* the person preparing the bill is the person signed in — stamped on the
     parameters at every measure, so a template change cannot lose it */
  function stampPrepared() {
    const u = user();
    if (!u) return;
    state.params.preparedBy = u.name + (u.firm ? ' · ' + u.firm : '');
    state.params.preparedByRole = Users.roleLabel(u.role);
    state.params.preparedById = u.id;
    if (!state.params.consultant && u.firm) state.params.consultant = u.firm;
  }

  /* When the browser gives this page no storage — a preview pane that runs
     it in a sandboxed frame is the usual case — every figure still works and
     the session keeps it, but a reload starts again. Say so once, plainly,
     instead of letting a correction seem to vanish. */
  function storageNotice() {
    if (typeof Store === 'undefined' || !Store.blocked) return;
    if (document.getElementById('storage-note')) return;
    const bar = document.createElement('div');
    bar.id = 'storage-note';
    bar.innerHTML = `<span><b>Preview mode</b> — this window gives the app no storage, so a change lasts the
      session but not a reload. Everything else works; open <code>index.html</code> in a browser to save.</span>
      <button type="button" id="storage-note-x" aria-label="Dismiss">✕</button>`;
    document.body.appendChild(bar);
    bar.querySelector('#storage-note-x').addEventListener('click', () => bar.remove());
    setTimeout(() => { if (bar.parentNode) bar.remove(); }, 15000);
  }

  /* Kept for the next visit with no signal. A file opened from the desktop
     cannot register a worker (the scheme has no origin to scope it), so this
     only runs when the app is served; there the worker holds the whole app in
     the cache and answers even with the network cut. */
  function registerWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (!/^https?:$/.test(location.protocol)) return;
    try {
      navigator.serviceWorker.register('sw.js').catch(() => { /* blocked, or not served */ });
    } catch (e) { /* a sandboxed frame throws outright */ }
  }

  /* ---------------------------------------------------------------- theme
     Light or dark, remembered on this device. Until the user picks one the
     app follows the system, and keeps following it if the system changes. */
  const THEME_KEY = 'plan2boq.theme';
  const systemDark = () => !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const chosenTheme = () => { try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; } };
  function currentTheme() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }

  function paintTheme() {
    const dark = currentTheme() === 'dark';
    const btn = $('#btn-theme');
    if (btn) {
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      btn.title = dark ? 'Switch to the light theme' : 'Switch to the dark theme';
      const lab = btn.querySelector('#theme-label');
      if (lab) lab.textContent = dark ? 'Light' : 'Dark';
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0d1512' : '#1f4e3d');
  }

  function setTheme(t, remember) {
    const dark = t === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (remember !== false) { try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (e) {} }
    paintTheme();
    save();
  }

  function toggleTheme() {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    toast(currentTheme() === 'dark' ? 'Dark theme — easier on the eyes at night' : 'Light theme');
  }

  function bindTheme() {
    const btn = $('#btn-theme');
    if (btn) btn.addEventListener('click', toggleTheme);
    paintTheme();
    /* the system can turn over while the app is open */
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const follow = () => { if (!chosenTheme()) { document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light'); paintTheme(); } };
      if (mq.addEventListener) mq.addEventListener('change', follow);
      else if (mq.addListener) mq.addListener(follow);
    }
  }

  function startApp() {
    if (started) return;
    started = true;
    bindTheme();
    stepTipWatch();          // a hover over a step names the step
    const restored = load();
    if (restored) {
      state.result = recompute();
      if (state.image && !state.analysis) {
        /* the plan comes back as pixels, and the reading is asynchronous: the
           step the file was closed on has to be drawn again once it lands,
           otherwise a reload leaves the take-off saying there is no plan */
        PlanAnalyser.loadDataUrl(state.image.dataUrl).then(img => {
          state.analysis = PlanAnalyser.analyse(img);
          state.result = recompute();
          if (state.step === 2 || state.step === 3 || state.step === 4) render();
        }).catch(() => {
          if (state.step === 3) render();
        });
      }
    }
    state.result = recompute();
    render();
    updateProjectsBadge();
    storageNotice();
    // bills saved before accounts existed belong to the first administrator
    if (can('manageUsers') && typeof Library !== 'undefined') {
      Users.adoptOrphans().then(n => { if (n) updateProjectsBadge(); }).catch(() => {});
    }
  }

  /* A read-only window on the working bill for the test harness
     (test_ui.py, test_bbs.py). It exposes the state; it changes nothing. */
  window.__plan2boq = {
    params: () => state.params,
    result: () => state.result || recompute(),
    step: () => state.step,
    digital: () => state.digital,
    rooms: () => state.roomRead,
    plans: () => (state.plans || []).map(p => ({ id: p.id, name: p.name, kind: p.kind,
      level: p.level == null ? null : +p.level,
      floor: isFloorPlan(p) ? floorName(p.level) : null,
      measured: p.id === state.planId, hasPicture: !!p.dataUrl, scale: p.scale || null })),
    floorShow: () => state.floorShow == null ? null : +state.floorShow,
    scale: () => ({ mode: state.scaleMode, ratio: state.ratio, paperMM: state.paperMM,
      mm: state.scaleMM, plan: state.planId }),
    verticals: () => ({ files: ((state.verticals || {}).files || []).length,
      levels: ((state.verticals || {}).levels || []).length }),
    roofName: () => (state.roof ? state.roof.name : null),
    groups: () => DRAW_GROUPS.map(g => ({ no: g.no, id: g.id, label: g.label,
      files: plansIn(g.id).map(p => ({ name: p.name, kind: p.kind })),
      panel: g.panel || null })),
    image: () => (state.image ? { name: state.image.name, size: state.image.size } : null),
    analysis: () => (state.analysis ? { w: state.analysis.width, h: state.analysis.height, hStrong: state.analysis.hStrong.length, vStrong: state.analysis.vStrong.length } : null)
  };

  async function boot() {
    registerWorker();
    if (typeof Users === 'undefined') { startApp(); return; }
    await Users.boot({
      toast: toast,
      onChange: () => { if (started) { paintUserChip(); applyRole(); } },
      bills: { list: Library.list, patch: Library.patch, remove: Library.remove }
    });
    // a device with no accounts opens as the shipped administrator (PIN 1234)
    await Users.ensureDefault();
    const resumed = await Users.resume();
    if (resumed) {
      ACTIVE_UID = resumed.id;
      adoptLegacyState(resumed.id);
      startApp();
      return;
    }
    Users.lock(u => {
      ACTIVE_UID = u.id;
      adoptLegacyState(u.id);
      startApp();
    });
  }

  /* the working bill saved before accounts existed moves to the first user */
  function adoptLegacyState(uid) {
    try {
      if (localStorage.getItem(LS_KEY) && !localStorage.getItem(lsKey())) {
        localStorage.setItem(lsKey(), localStorage.getItem(LS_KEY));
        localStorage.removeItem(LS_KEY);
      }
    } catch (e) { /* storage blocked: nothing to move */ }
  }

  boot();
})();
