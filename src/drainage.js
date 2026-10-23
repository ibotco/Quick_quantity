/* =====================================================================
   Quick Quantity — manhole works and drainage works
   ---------------------------------------------------------------------
   One measurement serves three places: the bill (both engines), the
   take-off sheet, and the reading of the plan on step 2. It lives here so
   the drawing that is read, the quantities that are taken off and the
   figures that are priced can never disagree.

   The plan gives the building, not the site. The run out of the building
   to the tank is half the outer perimeter — the average distance from the
   middle of the building to its face — plus 8 m to clear the building.
   A manhole sits at the building, one every 15 m of the run, and one at
   the tank. Everything is typed over when the site layout says otherwise.
   ===================================================================== */
(function (root) {
  'use strict';

  const r1 = x => Math.round(x * 10) / 10;
  const r2 = x => Math.round(x * 100) / 100;

  /* one chamber: 600 x 600 clear inside, 225 mm walls, 1.20 m deep, with
     150 mm of working space round the outside and a 150 mm RC base on a
     50 mm blinding */
  const CHAMBER = { clear: 0.6, wall: 0.225, deep: 1.2, work: 0.15, base: 0.15, blind: 0.05 };

  /* the trench: 450 mm wide, 900 mm deep, a 100 mm sand bed under the pipe */
  const TRENCH = { wide: 0.45, deep: 0.9, bed: 0.1 };

  const DEFAULTS = {
    tight: 8,        // metres of run to clear the building to the tank
    every: 15,       // metres between chambers
    main: 6,         // 160 mm from the last manhole into the tank
    chamber: CHAMBER,
    trench: TRENCH
  };

  /* how many chambers a run of this length needs — the rule everywhere */
  function chambersFor(run) {
    return Math.max(2, Math.ceil((+run || 0) / 15) + 1);
  }

  function measure(o) {
    const opt = o || {};
    const C = Object.assign({}, CHAMBER, opt.chamber || {});
    const T = Object.assign({}, TRENCH, opt.trench || {});

    /* the length of the run */
    const run = opt.run != null && isFinite(+opt.run)
      ? r1(+opt.run)
      : r1((+opt.perimeter || 0) * 0.5 + (opt.tight != null ? +opt.tight : 8));

    /* how many chambers stand on it — typed over when the site says so */
    const chambers = opt.chambers != null && isFinite(+opt.chambers) && +opt.chambers > 0
      ? Math.round(+opt.chambers)
      : chambersFor(run);

    /* one chamber, measured over the walls and over the working space */
    const outer = r2(C.clear + 2 * C.wall);                       // 1.05 m over the walls
    const side = r2(outer + 2 * C.work);                          // 1.35 m with working space
    const deep = r2(C.deep + C.base + C.blind);                   // 1.40 m bottom to cover
    const mhExc = r2(side * side * deep);                         // m3, one chamber
    const mhBlind = r2(outer * outer * C.blind);
    const mhBase = r2(outer * outer * C.base);
    const mhWall = r2(4 * (C.clear + C.wall) * C.deep);           // wall centre line x depth
    const mhRender = r2(4 * C.clear * C.deep);                    // 15 mm to the inside face
    const mhBench = 0.05;                                         // channels and benching
    const mhBack = Math.max(0, r2(mhExc - mhBlind - mhBase - mhWall * C.wall - mhBench));

    /* the trench and what stays in it */
    const trench = r2(run * T.wide * T.deep);
    const bed = r2(run * T.wide * T.bed);
    const pipeVol = r2(run * Math.PI * 0.055 * 0.055);            // 110 mm pipe displaces its own volume
    const back = Math.max(0, r2(trench - bed - pipeVol));

    const main = opt.main != null && +opt.main >= 0 ? +opt.main : 6;
    const n = chambers;
    const basis = opt.basis || 'half the outer perimeter';

    return {
      run: run, chambers: n, main: main, outer: outer, side: side, deep: deep,
      trench: trench, bed: bed, back: back,
      mh: { exc: mhExc, blind: mhBlind, base: mhBase, wall: mhWall, render: mhRender, bench: mhBench, back: mhBack },
      /* every figure the two bills carry, in the order they are measured */
      rows: [
        { key: 'pipe110',  name: 'Foul drain run', note: r1(run) + ' m — ' + basis + ' + 8 m to the tank', count: r1(run) + ' m', qty: run, unit: 'm' },
        { key: 'drainExc', name: 'Drain trench', note: r1(run) + ' m × ' + T.wide.toFixed(2) + ' × ' + T.deep.toFixed(2) + ' m deep', count: '', qty: trench, unit: 'm3' },
        { key: 'drainBed', name: 'Bedding to the drain', note: Math.round(T.bed * 1000) + ' mm sand bed under the pipe', count: '', qty: bed, unit: 'm3' },
        { key: 'drainBack', name: 'Backfill to the drain trench', note: 'trench less bedding and pipe', count: '', qty: back, unit: 'm3' },
        { key: 'mhCover',  name: 'Manholes on the run', note: 'one at the building, one every 15 m and one at the tank', count: n + ' No.', qty: n, unit: 'nr' },
        { key: 'excManhole', name: 'Manhole excavation', note: side.toFixed(2) + ' × ' + side.toFixed(2) + ' × ' + deep.toFixed(2) + ' m each', count: n + ' No.', qty: r2(mhExc * n), unit: 'm3' },
        { key: 'mhBlind',  name: 'Manhole blinding', note: Math.round(C.blind * 1000) + ' mm under the base, ' + outer.toFixed(2) + ' × ' + outer.toFixed(2) + ' m', count: n + ' No.', qty: r2(mhBlind * n), unit: 'm3' },
        { key: 'mhBase',   name: 'Manhole concrete base', note: Math.round(C.base * 1000) + ' mm thick, ' + outer.toFixed(2) + ' × ' + outer.toFixed(2) + ' m', count: n + ' No.', qty: r2(mhBase * n), unit: 'm3' },
        { key: 'mhWall',   name: 'Manhole block walls', note: Math.round(C.wall * 1000) + ' mm blocks, ' + r2(4 * (C.clear + C.wall)).toFixed(2) + ' m round × ' + C.deep.toFixed(2) + ' m high', count: n + ' No.', qty: r2(mhWall * n), unit: 'm2' },
        { key: 'mhRender', name: 'Manhole render', note: '15 mm to the inside face, ' + r2(4 * C.clear).toFixed(2) + ' m round × ' + C.deep.toFixed(2) + ' m high', count: n + ' No.', qty: r2(mhRender * n), unit: 'm2' },
        { key: 'mhBench',  name: 'Manhole benching', note: 'channels and benching to the invert, to falls', count: n + ' No.', qty: r2(mhBench * n), unit: 'm3' },
        { key: 'mhBack',   name: 'Backfill round the manholes', note: 'excavation less base, walls and benching', count: n + ' No.', qty: r2(mhBack * n), unit: 'm3' },
        { key: 'pipe160',  name: 'Pipe from the last manhole', note: '160 mm uPVC, ' + main + ' m into the septic tank', count: main + ' m', qty: main, unit: 'm' },
        { key: 'drainTest', name: 'Testing the drain', note: 'flushing, ball tests and making good', count: r1(run) + ' m', qty: run, unit: 'm' }
      ]
    };
  }

  /* the money at the rates the bill carries */
  function price(m, rateOf) {
    let total = 0;
    const rows = (m.rows || []).map(x => {
      const rate = +((rateOf && rateOf(x.key)) || 0);
      const amount = Math.round(x.qty * rate * 100) / 100;
      total += amount;
      return Object.assign({}, x, { rate: rate, amount: amount });
    });
    return { rows: rows, total: Math.round(total * 100) / 100 };
  }

  root.Drainage = { DEFAULTS, CHAMBER, TRENCH, chambersFor, measure, price };
})(typeof window !== 'undefined' ? window : globalThis);
