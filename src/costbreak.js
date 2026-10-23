/* =====================================================================
   THE COST BREAKDOWN
   The bill says what the job costs; this says where the money goes. Every
   rate in the build-up is made of materials, labour, plant, sundries and
   an uplift for overheads and profit, and an assessed rate is made of a
   supply share and a fix share. The breakdown multiplies those shares out
   of the priced bill and adds them up by cost head and by bill, so the
   same money can be read two ways — and it always ties to the contract
   sum, contingency included.

   Nothing here is stored: it is read out of the bill every time it is
   drawn, so a corrected quantity, a changed rate or a changed day rate
   moves it.
   ===================================================================== */
(function (root) {
  'use strict';

  const HEADS = [
    { id: 'materials', label: 'Materials and components',
      blurb: 'Cement, sand, blocks, steel, timber, roofing, tiles, pipe, cable, fittings and the supply side of every assessed item' },
    { id: 'labour', label: 'Labour',
      blurb: 'The trades in the rate build-up and the fix side of every assessed item — the days the labour schedule counts' },
    { id: 'plant', label: 'Plant and equipment',
      blurb: 'Mixers, vibrators, compactors, hoists, excavators and the water that goes with them' },
    { id: 'sundry', label: 'Sundries and fixings',
      blurb: 'Scaffolding, tools, nails, screws, sealant, binding wire and the small things a rate carries' },
    { id: 'overheads', label: 'Overheads and profit',
      blurb: 'The percentage uplift every rate carries for the contractor’s site overheads, head office and profit' },
    { id: 'contingency', label: 'Contingency',
      blurb: 'The allowance added on top of the bills, at the percentage set on the bill' }
  ];
  const HEAD_OF = {};
  HEADS.forEach(h => { HEAD_OF[h.id] = h; });

  const r2 = n => Math.round((+n || 0) * 100) / 100;
  const toNum = n => { const v = +n; return isFinite(v) ? v : 0; };

  /* which head a fixed allowance belongs to: a lump sum of mesh or binding
     wire is material, a mixer is plant, everything else is sundries */
  const FIXED_HEAD = { plant: 'plant', materials: 'materials', mesh: 'materials',
                       wire: 'materials', labour: 'labour',
                       /* couplings, bends and solvent cement are goods, not a
                          lump of site sundries — the drainage build-ups carry them */
                       fittings: 'materials', benching: 'materials', sealant: 'materials' };

  function model(params, result) {
    const RB = root.RateBuild;
    if (!RB || typeof RB.list !== 'function' || typeof RB.compute !== 'function') return null;
    if (!result) return null;

    const entries = RB.list(result);
    const p = params || {};
    const bills = {};
    const items = [];

    const blank = (code, title) => ({
      code: code, title: title || '', amount: 0, materials: 0, labour: 0,
      plant: 0, sundry: 0, overheads: 0, items: 0, raw: { materials: 0, labour: 0, plant: 0, sundry: 0, overheads: 0 }
    });
    const billRec = (code, title) => {
      const k = String(code || '');
      bills[k] = bills[k] || blank(k, title);
      return bills[k];
    };

    let unclassified = 0, splitItems = 0;

    entries.forEach(e => {
      const c = RB.compute(p, e);
      if (!c) return;

      /* the build-up, per unit of work */
      let m = 0, l = 0, pl = 0, sd = 0;
      (c.lines || []).forEach(x => {
        const inp = RB.byId ? RB.byId(x.input) : null;
        if (inp && /Plant and equipment/.test(inp.cat || '')) pl += toNum(x.amount);
        else m += toNum(x.amount);
      });
      (c.labour || []).forEach(x => { l += toNum(x.amount); });
      (c.fixed || []).forEach(f => {
        const head = FIXED_HEAD[f.id] || 'sundry';
        if (head === 'materials') m += toNum(f.amount);
        else if (head === 'labour') l += toNum(f.amount);
        else if (head === 'plant') pl += toNum(f.amount);
        else sd += toNum(f.amount);
      });
      const oh = toNum(c.uplift);
      const computed = toNum(c.computed);
      const parts = (e.parts && e.parts.length) ? e.parts
        : [{ bill: e.bill, title: e.billTitle, qty: e.qty, rate: e.rate, amount: e.amount }];

      parts.forEach(pt => {
        const amt = toNum(pt.amount != null ? pt.amount : (pt.qty * pt.rate));
        const br = billRec(pt.bill, pt.title || e.billTitle);
        br.amount += amt;
        br.items += 1;
        if (computed > 0 && amt > 0) {
          const k = amt / computed;          // money per unit of computed rate
          br.raw.materials += m * k;
          br.raw.labour += l * k;
          br.raw.plant += pl * k;
          br.raw.sundry += sd * k;
          br.raw.overheads += oh * k;
          br.materials += m * k;
          br.labour += l * k;
          br.plant += pl * k;
          br.sundry += sd * k;
          br.overheads += oh * k;
        } else if (amt > 0) {
          /* a rate with no build-up at all (a lump sum typed by hand): the
             money is real, the split is unknown — it is named, not guessed */
          unclassified += amt;
          br.overheads += amt;
        }
        items.push({ bill: pt.bill, desc: pt.desc || e.desc, unit: pt.unit || e.unit,
                     qty: pt.qty, amount: amt, key: e.key });
      });
      if (computed > 0) splitItems += 1;
    });

    /* round the money to the cent and let the last cent fall where it must,
       so every bill's row adds up to the bill exactly */
    const list = Object.keys(bills).map(k => bills[k])
      .filter(b => b.amount > 0)
      .map(b => {
        const o = {};
        ['materials', 'labour', 'plant', 'sundry', 'overheads'].forEach(h => { o[h] = r2(b[h]); });
        const sum = o.materials + o.labour + o.plant + o.sundry + o.overheads;
        o.overheads = r2(o.overheads + (r2(b.amount) - sum));
        const heads = o.materials + o.labour + o.plant + o.sundry + o.overheads;
        return { code: b.code, title: b.title, amount: r2(b.amount), items: b.items,
                 heads: o, rounded: r2(heads - b.amount) };
      });

    const sum = (f) => r2(list.reduce((s, b) => s + b.heads[f], 0));
    const totals = {
      materials: sum('materials'), labour: sum('labour'), plant: sum('plant'),
      sundry: sum('sundry'), overheads: sum('overheads')
    };
    const subtotal = r2(result.subtotal != null ? result.subtotal
      : list.reduce((s, b) => s + b.amount, 0));
    const contingency = r2(result.contingency || 0);
    const grand = r2(result.grand != null ? result.grand : subtotal + contingency);
    const GFA = toNum(result.GFA);
    const perM2 = GFA > 0 ? grand / GFA : 0;

    const heads = HEADS.map(h => {
      const amount = h.id === 'contingency' ? contingency : totals[h.id];
      return {
        id: h.id, label: h.label, blurb: h.blurb, amount: r2(amount),
        pct: grand > 0 ? amount / grand * 100 : 0,
        perM2: GFA > 0 ? amount / GFA : 0,
        perBillPct: subtotal > 0 ? amount / subtotal * 100 : 0
      };
    });

    const billRows = list.map(b => ({
      code: b.code, title: b.title, amount: b.amount, items: b.items, heads: b.heads,
      pct: grand > 0 ? b.amount / grand * 100 : 0,
      perM2: GFA > 0 ? b.amount / GFA : 0
    })).sort((a, b) => {
      const na = +(String(a.code).match(/(\d+)/) || [0, 0])[1];
      const nb = +(String(b.code).match(/(\d+)/) || [0, 0])[1];
      return na - nb || String(a.code).localeCompare(String(b.code));
    });

    return {
      heads: heads, bills: billRows, items: items,
      totals: {
        materials: totals.materials, labour: totals.labour, plant: totals.plant,
        sundry: totals.sundry, overheads: totals.overheads,
        unclassified: r2(unclassified),
        subtotal: subtotal, contingency: contingency, grand: grand,
        GFA: r2(GFA), perM2: r2(perM2),
        bills: billRows.length, items: items.length, splitItems: splitItems,
        headsSum: r2(heads.reduce((s, h) => s + h.amount, 0)),
        materialsPct: grand > 0 ? totals.materials / grand * 100 : 0,
        labourPct: grand > 0 ? totals.labour / grand * 100 : 0,
        plantPct: grand > 0 ? totals.plant / grand * 100 : 0,
        sundryPct: grand > 0 ? totals.sundry / grand * 100 : 0,
        overheadsPct: grand > 0 ? totals.overheads / grand * 100 : 0,
        contingencyPct: grand > 0 ? contingency / grand * 100 : 0
      }
    };
  }

  function forExport(params, result) {
    const m = model(params, result);
    if (!m) return null;
    const p = params || {};
    return Object.assign({
      projectName: p.projectName || 'Project',
      projectSub: p.projectSub || '',
      location: p.location || '',
      currency: p.curSymbol || 'GH\u00a2',
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    }, m);
  }

  root.CostBreak = { HEADS, model, forExport };
})(typeof window !== 'undefined' ? window : globalThis);
