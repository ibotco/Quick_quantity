/* =====================================================================
   MATERIAL SCHEDULE
   Every priced item in the bill is built from materials the rate build-up
   already knows: so many bags of cement to a cubic metre of concrete, so
   many blocks to a square metre of wall, so many metres of pipe to a
   sanitary fitting. This module reads those recipes, multiplies them by
   the quantities the bill carries, and adds the result up material by
   material — one line per material, whatever the number of bill items
   behind it. Items whose rate is an assessment (doors, fittings, services)
   contribute a supply line at the material share of their rate.

   Nothing here is stored: the schedule is derived from the bill every time
   it is drawn, so a corrected quantity or a changed rate on the take-off
   sheet moves the materials in the same breath. What IS stored is what the
   user changes — a material's own quantity, rate, supplier or remark, a
   material taken off the schedule, and the materials added by hand.
   ===================================================================== */
(function (root) {
  'use strict';

  /* the categories the schedule groups by, in the order a store is walked */
  const CATS = [
    'Cement', 'Sand & aggregate', 'Blocks & masonry', 'Steel', 'Timber', 'Roofing',
    'Waterproofing', 'Ceilings', 'Finishes', 'Doors & windows', 'Plumbing',
    'Electrical', 'Mechanical & fire', 'External works', 'Proprietary supply', 'Other materials'
  ];

  const PREFIX = {
    'Cement': 'CEM', 'Sand & aggregate': 'AGG', 'Blocks & masonry': 'BLK', 'Steel': 'STL',
    'Timber': 'TMB', 'Roofing': 'ROF', 'Waterproofing': 'WPF', 'Ceilings': 'CEI', 'Finishes': 'FIN',
    'Doors & windows': 'DNW', 'Plumbing': 'PLB', 'Electrical': 'ELE', 'Mechanical & fire': 'MEC',
    'External works': 'EXT', 'Proprietary supply': 'PRO', 'Other materials': 'OTH'
  };

  /* price-book category -> schedule category. Cement, sand and aggregate
     are one heading in the price book and three shelves in a store. */
  const CAT_MAP = {
    'Cement, sand and aggregate': null,          // split by the input itself
    'Blocks and masonry': 'Blocks & masonry',
    'Steel and reinforcement': 'Steel',
    'Timber and boards': 'Timber',
    'Roofing': 'Roofing',
    'Waterproofing and ground treatment': 'Waterproofing',
    'Ceilings': 'Ceilings',
    'Floor and wall finishes': 'Finishes',
    'Paint': 'Finishes',
    'Doors and windows': 'Doors & windows',
    'Plumbing and drainage': 'Plumbing',
    'Electrical': 'Electrical',
    'Mechanical, fire and energy': 'Mechanical & fire',
    'External works': 'External works',
    'Labour': 'Labour',
    'Plant and equipment': 'Plant'
  };

  const CEMENT_IDS = /^(cement|whiteCement|lime)/;
  const AGG_IDS = /^(sand|plasterSand|aggregate|laterite|hardcoreMat|terrazzoChip|topsoil)/;

  const r3 = n => Math.round((+n || 0) * 1000) / 1000;
  const r2 = n => Math.round((+n || 0) * 100) / 100;

  /* ---------------------------------------------------------------- codes */
  /* a code per price-book material, given once, in the order the price book
     lists them: CEM-01, CEM-02 … AGG-01 … so it never moves about */
  const CODE = {};
  function assignCodes() {
    const n = {};
    ((root.RateBuild && root.RateBuild.INPUTS) || []).forEach(inp => {
      const cat = catForInput(inp.id);
      if (cat === 'Labour' || cat === 'Plant') return;
      n[cat] = (n[cat] || 0) + 1;
      CODE[inp.id] = PREFIX[cat] + '-' + String(n[cat]).padStart(2, '0');
    });
  }
  function catForInput(id) {
    const inp = root.RateBuild && root.RateBuild.byId(id);
    const cat = inp ? inp.cat : '';
    if (cat === 'Cement, sand and aggregate') {
      if (CEMENT_IDS.test(id)) return 'Cement';
      if (AGG_IDS.test(id)) return 'Sand & aggregate';
      return 'Cement';
    }
    return CAT_MAP[cat] || 'Other materials';
  }
  const slug = s => String(s || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase();

  /* ------------------------------------------------------------- the model */
  /* p: the saved parameters (which carry the user's material changes)
     result: the priced bill, as recompute() returns it */
  function model(p, result) {
    p = p || {};
    const adj = p.matAdj || {};
    const added = Array.isArray(p.matAdd) ? p.matAdd : [];
    const map = new Map();

    const put = l => {
      const key = l.id;
      const prev = map.get(key);
      if (prev) {
        prev.qty = r3(prev.qty + l.qty);
        if (l.src) prev.src.push(l.src);
        prev.uses = prev.src.length;
        if (!prev.recipe && l.recipe) prev.recipe = l.recipe;
        return;
      }
      l.uses = 1;
      l.src = l.src ? [l.src] : [];
      map.set(key, l);
    };

    const entries = (root.RateBuild && root.RateBuild.list) ? root.RateBuild.list(result) : [];
    let propNo = 0;

    /* Reconciliation with the bill. Every line put() above is multiplied out
       of one priced bill row, so the material value the bill carries can be
       added up the same way and the two totals compared. What is left of the
       subtotal is labour, plant and preliminaries. */
    const bills = (result && result.bills) || [];
    const bill = {
      subtotal: r2(result && result.subtotal != null ? result.subtotal : 0),
      materials: 0, other: 0,
      nBills: bills.length,
      nItems: bills.reduce((n, b) => n + (b.items || []).length, 0),
      nPriced: 0,
      noMat: [], noMatValue: 0
    };

    /* one source row per bill item: which bill, which item, how much of the
       material it carries */
    const srcOf = (pt, e, mat) => ({
      id: e.key, bill: pt.bill, billTitle: pt.title || e.billTitle || '',
      no: pt.no, desc: pt.desc || e.desc, unit: pt.unit || e.unit,
      qty: +pt.qty || 0, amount: +pt.amount || 0, mat: r2(mat)
    });

    entries.forEach(e => {
      const c = root.RateBuild.compute(p, e);
      if (!c) return;
      const parts = (e.parts && e.parts.length)
        ? e.parts
        : [{ bill: e.bill, title: e.billTitle, no: 1, desc: e.desc, unit: e.unit, qty: e.qty, amount: e.amount }];
      const derived = !c.assessed && c.lines && c.lines.length;
      const share = derived ? null : (c.fixed || []).find(f => f.id === 'materials');
      const per = share ? +share.amount || 0 : 0;
      /* an assessed rate is one supply line per entry, whichever bill rows
         it covers — number it once */
      const propCode = (!derived && per > 0) ? 'PRO-' + String(++propNo).padStart(2, '0') : null;

      parts.forEach(pt => {
        bill.nPriced++;
        let partMat = 0;
        if (derived) {
          c.lines.forEach(l => {
            const cat = catForInput(l.input);
            if (cat === 'Labour' || cat === 'Plant') return;
            const unitQty = +l.qty || 0;
            if (!(unitQty > 0) || !(pt.qty > 0)) return;
            const q = unitQty * pt.qty;
            const rate = +l.rate || 0;
            const mat = q * rate;
            partMat += mat;
            put({
              id: 'i:' + l.input,
              kind: 'derived',
              code: CODE[l.input] || (PREFIX[cat] || 'OTH') + '-00',
              name: l.label || l.input,
              cat: cat,
              unit: l.unit || '',
              qty: q,
              rate: rate,
              note: '',
              recipe: l.note || '',
              src: srcOf(pt, e, mat)
            });
          });
        } else if (propCode && pt.qty > 0) {
          partMat = per * pt.qty;
          put({
            id: 'p:' + e.key,
            kind: 'derived',
            code: propCode,
            name: e.desc,
            cat: 'Proprietary supply',
            unit: e.unit || 'Item',
            qty: pt.qty,
            rate: per,
            note: 'supply share of an assessed rate',
            src: srcOf(pt, e, partMat)
          });
        }
        bill.materials += partMat;
        /* priced work with no material behind it — excavation, clearance,
           carting away. It is listed and said so, rather than dropped. */
        if (!(partMat > 0)) {
          bill.noMatValue += +pt.amount || 0;
          bill.noMat.push({
            key: pt.key || e.key, bill: pt.bill, no: pt.no, desc: pt.desc || e.desc,
            unit: pt.unit || e.unit, qty: +pt.qty || 0, amount: +pt.amount || 0
          });
        }
      });
    });

    bill.materials = r2(bill.materials);
    if (!bill.subtotal) {
      /* no subtotal on the result: fall back on what the priced rows add to */
      bill.subtotal = r2(entries.reduce((t, e) => t + (e.amount || 0), 0));
    }
    bill.other = r2(Math.max(0, bill.subtotal - bill.materials));

    /* what the user changed on a derived material */
    map.forEach(l => {
      const a = adj[l.id];
      if (!a) return;
      if (a.del) { l.del = true; return; }
      if (a.q !== undefined && a.q !== null && a.q !== '' && isFinite(+a.q)) { l.qty = +a.q; l.qtyEdited = true; }
      if (a.r !== undefined && a.r !== null && a.r !== '' && isFinite(+a.r)) { l.rate = +a.r; l.rateEdited = true; }
      if (a.sup) l.sup = String(a.sup);
      if (a.note) l.note = String(a.note);
      if (l.qtyEdited || l.rateEdited || a.sup || a.note) l.touched = true;
    });

    /* materials added by hand */
    added.forEach(m => {
      map.set('m:' + m.id, {
        id: 'm:' + m.id, kind: 'manual', code: m.code || 'MAN-01', name: m.name || 'Material',
        cat: CATS.indexOf(m.cat) >= 0 ? m.cat : 'Other materials', unit: m.unit || 'No.',
        qty: +m.qty || 0, rate: +m.rate || 0, sup: m.sup || '', note: m.note || '',
        uses: 1, src: [], manual: true
      });
    });

    const lines = Array.from(map.values());
    lines.forEach(l => {
      l.qty = r3(l.qty);
      l.rate = r2(l.rate);
      l.amount = r2(l.qty * l.rate);
      l.uses = l.uses || 1;
    });

    const shown = lines.filter(l => !l.del);
    const groups = CATS.map(cat => {
      const rows = shown.filter(l => l.cat === cat);
      return {
        cat: cat,
        lines: rows,
        cost: r2(rows.reduce((t, l) => t + l.amount, 0)),
        qty: r3(rows.reduce((t, l) => t + l.qty, 0)),
        units: new Set(rows.map(l => l.unit)).size
      };
    }).filter(g => g.lines.length);

    const cost = r2(shown.reduce((t, l) => t + l.amount, 0));
    const totals = {
      types: shown.length,
      all: lines.length,
      hidden: lines.filter(l => l.del).length,
      cost: cost,
      qty: r3(shown.reduce((t, l) => t + l.qty, 0)),
      units: new Set(shown.map(l => l.unit)).size,
      adjusted: shown.filter(l => l.touched).length,
      manual: shown.filter(l => l.manual).length,
      categories: groups.length,
      /* how the schedule sits against the bill it came out of */
      bill: Object.assign(bill, {
        schedule: cost,
        diff: r2(cost - bill.materials),
        tied: Math.abs(cost - bill.materials) <= Math.max(5, bill.materials * 0.0001),
        hand: r2(lines.reduce((t, l) => t + l.amount, 0) - bill.materials),
        lines: shown.filter(l => !l.manual).length,
        manualLines: shown.filter(l => l.manual).length,
        share: bill.subtotal > 0 ? Math.round(bill.materials / bill.subtotal * 1000) / 10 : 0
      })
    };

    return { lines, shown, groups, totals, cats: CATS.slice() };
  }

  /* ------------------------------------------------------- filter and sort
     q   — free text over code, name, category, supplier and remark
     cat — a single category, or 'all'
     sort— 'cat' (grouped), 'name', 'code', 'qty', 'cost'                      */
  function view(m, q, cat, sort) {
    const needle = String(q || '').trim().toLowerCase();
    const keep = l => {
      if (cat && cat !== 'all' && l.cat !== cat) return false;
      if (!needle) return true;
      // a word is matched from its start, so "cement" finds the cement and
      // not the rein-for-CEMENT bars
      const words = [l.code, l.name, l.cat, l.unit, l.sup, l.note, l.recipe]
        .join(' ').toLowerCase().split(/[^a-z0-9.]+/).filter(Boolean);
      return needle.split(/\s+/).every(q => words.some(w => w.indexOf(q) === 0));
    };
    const rows = m.shown.filter(keep);
    if (sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'code') rows.sort((a, b) => String(a.code).localeCompare(String(b.code)));
    else if (sort === 'qty') rows.sort((a, b) => b.qty - a.qty);
    else if (sort === 'cost') rows.sort((a, b) => b.amount - a.amount);
    else rows.sort((a, b) => (CATS.indexOf(a.cat) - CATS.indexOf(b.cat)) || a.name.localeCompare(b.name));

    if (sort !== 'cat') {
      return {
        grouped: false, rows: rows,
        cost: r2(rows.reduce((t, l) => t + l.amount, 0)),
        qty: r3(rows.reduce((t, l) => t + l.qty, 0)),
        units: new Set(rows.map(l => l.unit)).size,
        total: m.totals.types
      };
    }
    const groups = [];
    rows.forEach(l => {
      let g = groups.length ? groups[groups.length - 1] : null;
      if (!g || g.cat !== l.cat) { g = { cat: l.cat, lines: [], cost: 0, qty: 0, units: new Set() }; groups.push(g); }
      g.lines.push(l);
      g.cost = r2(g.cost + l.amount);
      g.qty = r3(g.qty + l.qty);
      g.units.add(l.unit);
    });
    groups.forEach(g => { g.units = g.units.size; });
    return {
      grouped: true, groups: groups,
      cost: r2(rows.reduce((t, l) => t + l.amount, 0)),
      qty: r3(rows.reduce((t, l) => t + l.qty, 0)),
      units: new Set(rows.map(l => l.unit)).size,
      total: m.totals.types
    };
  }

  /* a plain model for the exports: every category, the order of the sheet */
  function forExport(p, result) {
    const m = model(p, result);
    return {
      projectName: (p && p.projectName) || 'Project',
      projectSub: (p && p.projectSub) || '',
      location: (p && p.location) || '',
      currency: (p && p.curSymbol) || 'GH\u00a2',
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      groups: m.groups,
      totals: m.totals
    };
  }

  if (root.RateBuild && root.RateBuild.INPUTS) assignCodes();

  root.Materials = {
    CATS, model, view, forExport, catForInput, CODE: () => CODE,
    refreshCodes: () => { if (root.RateBuild && root.RateBuild.INPUTS) assignCodes(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
