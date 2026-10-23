/* =====================================================================
   THE LABOUR SCHEDULE
   The rate build-up already knows who does what and for how long: every
   recipe carries a labour list (a mason for 0.16 day per square metre of
   wall, a labourer for 0.05) and an assessed item carries a labour-and-
   plant share of its rate. This module turns that into a schedule a site
   can work from — days by trade, hours, the cost at the day rates in the
   rate card, and who is needed when — without inventing a single figure
   the bill does not already carry.

   Nothing here is stored. It is read from the bill every time it is drawn,
   so a corrected quantity, a changed rate or a changed day rate moves the
   labour with it.
   ===================================================================== */
(function (root) {
  'use strict';

  const TRADES = [
    { id: 'mason',       label: 'Masons',            blurb: 'Concrete, blockwork, plaster, screed' },
    { id: 'carpenter',   label: 'Carpenters / joiners', blurb: 'Formwork, timber, doors and frames' },
    { id: 'steelFixer',  label: 'Steel fixers',      blurb: 'Reinforcement and fabric' },
    { id: 'roofer',      label: 'Roofers',           blurb: 'Sheets, purlins, ridges, fascia' },
    { id: 'plumber',     label: 'Plumbers',          blurb: 'Pipework, sanitary, drainage' },
    { id: 'electrician', label: 'Electricians',      blurb: 'Conduit, cable, fittings' },
    { id: 'tiler',       label: 'Tilers',            blurb: 'Floor and wall tiles' },
    { id: 'painter',     label: 'Painters',          blurb: 'Emulsion, gloss, undercoat' },
    { id: 'glazier',     label: 'Glaziers',          blurb: 'Glass and glazing' },
    { id: 'labourer',    label: 'Labourers',         blurb: 'General, mixing, loading, curing' },
    { id: 'foreman',     label: 'Foremen / supervisors', blurb: 'Setting out and supervision' },
    { id: 'plantOp',     label: 'Plant operators',   blurb: 'Mixer, vibrator, hoist' }
  ];
  const TRADE_OF = {};
  TRADES.forEach(t => { TRADE_OF[t.id] = t; });

  const HOURS_A_DAY = 8;          // a Ghanaian site day
  const r2 = n => Math.round((+n || 0) * 100) / 100;

  const toNum = n => {
    if (n == null || n === '') return 0;
    const v = +n;
    return isFinite(v) ? v : 0;
  };

  /* ------------------------------------------------------------- the model
     result: the priced bill as recompute() returns it
     params: the saved parameters (for the day rates the user has changed) */
  function model(params, result) {
    const RB = root.RateBuild;
    if (!RB || typeof RB.list !== 'function' || typeof RB.compute !== 'function') return null;

    const entries = RB.list(result);
    const p = params || {};
    const byTrade = {};
    const byBill = {};
    const rows = [];
    let unnamed = 0, assessedCost = 0;

    /* one record per bill, so the schedule can be read the way the bill is */
    function billRec(code, title) {
      const k = String(code || '');
      byBill[k] = byBill[k] || { code: k, title: title || '', days: 0, cost: 0,
                                 assessed: 0, items: 0, trades: {} };
      return byBill[k];
    }

    entries.forEach(e => {
      const c = RB.compute(p, e);
      if (!c) return;
      const bill = e.bill, desc = e.desc || (c.title || '');
      const br = billRec(bill, e.billTitle);
      // the trades the recipe names
      (c.labour || []).forEach(l => {
        const days = toNum(l.qty) * toNum(e.qty);
        const rate = toNum(l.rate);
        if (days <= 0) return;
        const t = TRADE_OF[l.input] ? l.input : 'labourer';
        byTrade[t] = byTrade[t] || { id: t, label: TRADE_OF[t].label, blurb: TRADE_OF[t].blurb,
                                     days: 0, cost: 0, rate: null, items: 0, bills: {} };
        const b = byTrade[t];
        b.days += days;
        b.cost += days * rate;
        b.items += 1;
        b.bills[bill] = (b.bills[bill] || 0) + days;
        if (rate) b.rate = rate;           // the day rate the card carries now
        br.days += days;
        br.cost += days * rate;
        br.items += 1;
        const bt = br.trades[t] = br.trades[t] || { id: t, label: TRADE_OF[t].label, days: 0, cost: 0 };
        bt.days += days;
        bt.cost += days * rate;
        rows.push({ bill: bill, billTitle: e.billTitle || '', desc: desc, trade: t,
                    tradeLabel: TRADE_OF[t].label, unit: e.unit, qty: e.qty,
                    days: days, rate: rate, cost: days * rate,
                    basis: 'recipe', note: l.note || '' });
      });
      // an assessed rate carries labour as a share of the money, with no days named
      if (c.assessed) {
        (c.fixed || []).forEach(f => {
          const amt = toNum(f.amount) * toNum(e.qty);
          if (f.id === 'labour' && amt > 0) {
            /* a share of an assessed rate names no trade and no time: it is
               money for labour and plant, and the schedule says so rather
               than dividing it by a day rate it cannot know */
            assessedCost += amt;
            br.assessed += amt;
            rows.push({ bill: bill, billTitle: e.billTitle || '', desc: desc, trade: 'assessed',
                        tradeLabel: 'Assessed labour', unit: e.unit, qty: e.qty,
                        days: null, rate: null, cost: amt,
                        basis: 'assessed', note: 'a share of the assessed rate — no measured time' });
            unnamed += 1;
          }
        });
      }
    });

    /* the programme: how many working weeks the job is expected to run. The
       crew is the days divided by the days a man works in that time, so a
       trade needed for three days reads as a fraction of a man, not a man. */
    const weeks = toNum(p._labourWeeks) || 0;
    const period = weeks > 0 ? weeks : 13;
    const workDays = period * 5;

    const trades = Object.keys(byTrade).map(k => byTrade[k])
      .map(b => {
        const dayRate = b.rate || (RB.byId && RB.byId(b.id) ? RB.byId(b.id).price : 0) || 0;
        return { id: b.id, label: b.label, blurb: b.blurb, days: r2(b.days),
                 hours: r2(b.days * HOURS_A_DAY), rate: dayRate, cost: r2(b.cost),
                 items: b.items, bills: b.bills, men: r2(b.days / workDays) };
      })
      .sort((a, b) => b.days - a.days || b.cost - a.cost);

    const totalDays = trades.reduce((s, t) => s + t.days, 0);
    const totalCost = trades.reduce((s, t) => s + t.cost, 0);
    const crewMen = trades.reduce((s, t) => s + t.men, 0);

    const crew = trades.map(t => ({ id: t.id, label: t.label, days: t.days, men: t.men }));

    /* the bill-by-bill view: every bill keeps the trades it uses and the days
       each of them takes, so the schedule can be handed out bill by bill */
    const bills = Object.keys(byBill).map(k => {
      const b = byBill[k];
      return {
        code: b.code, title: b.title, days: r2(b.days), cost: r2(b.cost),
        assessed: r2(b.assessed), items: b.items,
        trades: Object.keys(b.trades).map(t => b.trades[t])
          .map(t => ({ id: t.id, label: t.label, days: r2(t.days), cost: r2(t.cost) }))
          .sort((a, c) => c.days - a.days)
      };
    }).filter(b => b.days > 0 || b.assessed > 0)
      .sort((a, b) => {
        const na = +(String(a.code).match(/(\d+)/) || [0, 0])[1];
        const nb = +(String(b.code).match(/(\d+)/) || [0, 0])[1];
        return na - nb || String(a.code).localeCompare(String(b.code));
      });

    return {
      trades: trades, rows: rows, crew: crew, bills: bills,
      daysByTrade: trades.map(t => [t.id, t.days]),
      totals: {
        trades: trades.length, days: r2(totalDays), hours: r2(totalDays * HOURS_A_DAY),
        cost: r2(totalCost), rows: rows.length,
        items: entries.length, bills: bills.length,
        assessedOnly: unnamed, assessedCost: r2(assessedCost),
        labourValue: r2(totalCost + assessedCost),
        avgDay: r2(totalDays ? totalCost / totalDays : 0),
        hoursADay: HOURS_A_DAY, period: period, workDays: workDays,
        crew: r2(crewMen), crewWhole: Math.round(crewMen)
      }
    };
  }

  function forExport(params, result) {
    const m = model(params, result);
    if (!m) return null;
    const p = params || {};
    return {
      projectName: p.projectName || 'Project',
      projectSub: p.projectSub || '',
      location: p.location || '',
      currency: p.curSymbol || 'GH\u00a2',
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      trades: m.trades, bills: m.bills, rows: m.rows, crew: m.crew, totals: m.totals
    };
  }

  root.Labour = { TRADES, HOURS_A_DAY, model, forExport };
})(typeof window !== 'undefined' ? window : globalThis);
