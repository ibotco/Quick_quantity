/* =====================================================================
   Quick Quantity — the structural check
   A small, deliberately conservative design of the frame the plan shows:
   a column under its axial load and a beam under its span, checked to
   BS 8110, then turned into the bars that go on the bending schedule.
   Everything here is pure arithmetic — no DOM, no storage.
   ===================================================================== */
(function (root) {
  'use strict';

  const DIA = [6, 8, 10, 12, 16, 20, 25, 32];
  const AREA = d => Math.PI * d * d / 4;          // mm² of one bar
  const KGM = d => d * d / 162.28;                // kg per metre
  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const r1 = n => Math.round(n * 10) / 10;
  const r2 = n => Math.round(n * 100) / 100;

  const FALLBACK = {
    storeys: 1, H: 3.0, fcu: 25, fy: 460, cover: 25,
    colB: 225, colH: 225, colCount: 4, colLoad: 250, colDia: 16, colLink: 8,
    beamB: 225, beamH: 450, beamSpan: 4.5, beamCount: 8, beamUDL: 38, beamDia: 16, beamTop: 12, beamLink: 8
  };

  /* ------------------------------------------------------------ defaults */
  /* Prefill the form from the plan the bill was measured from: the frame
     perimeter gives the number of bays, the concrete volumes give the
     number of columns, and the rooms give the span to check. */
  function defaults(result) {
    const p = (result && result.params) || {};
    const m = (result && result.model) || {};
    const g = m.g || {};
    const storeys = Math.max(1, Math.round(num(p.storeys) || 1));
    const H = num(p.floorH) > 0 ? num(p.floorH) : 3.0;

    /* the span to check is the longest side the rooms put between supports,
       averaged so one long room does not set the whole frame */
    let span = 0, n = 0;
    (p.rooms || []).forEach(rm => {
      const L = num(rm.L), W = num(rm.W);
      const side = Math.max(L, W);
      if (side > 1) { span += side; n++; }
    });
    span = n ? span / n : 4.5;
    span = r1(Math.max(2.5, Math.min(6.5, span)));

    // columns: the engine counts them, otherwise the concrete volume tells us
    let cols = Math.round(num(m.cols) || num(m.colNos) || 0);
    if (!cols) {
      let v = 0;
      ((result && result.bills) || []).forEach(b => (b.items || []).forEach(it => {
        if (it.key === 'colConc') v += num(it.qty);
      }));
      cols = v > 0 ? Math.max(2, Math.round(v / (0.225 * 0.225 * (H + 0.6)))) : 4;
    }

    // beams: one per bay around the frame, or the ring-beam length over a span
    const perim = num(g.framePerimeter) || num(m.perimOuter) || 0;
    const ringL = num(m.rbL) || 0;
    let beams = 0;
    if (perim && span) beams = Math.round(perim / span);
    if (!beams && ringL && span) beams = Math.round(ringL / span);
    if (!beams) {
      const v = num(m.beams) || 0;
      beams = v > 0 ? Math.max(2, Math.round(v / (0.225 * 0.45 * span))) : 8;
    }

    const GFA = num(m.GFA) || num(m.grossArea) || 150;
    const trib = GFA / Math.max(1, cols);
    // factored load: 8 kN/m² over the tributary area, plus the column's own weight
    const colLoad = Math.max(80, Math.round(trib * 8 * storeys + 0.225 * 0.225 * 24 * H * storeys));

    return Object.assign({}, FALLBACK, {
      storeys: storeys, H: H, span: span,
      colCount: Math.max(2, cols), colLoad: colLoad,
      beamSpan: span, beamCount: Math.max(2, beams),
      // a depth that suits the span: span/10, to the nearest 50 mm
      beamH: Math.max(350, Math.min(700, Math.round(span * 1000 / 10 / 50) * 50)),
      beamUDL: r1(8 * span + 0.225 * 0.45 * 24)
    });
  }

  /* --------------------------------------------------------------- bars */
  /* The fewest bars of the diameter asked for that give the steel required,
     then the next diameter up — four bars to a column, two to a beam. */
  function chooseBars(AsReq, opts) {
    const o = opts || {};
    const start = o.dia || 16;
    const counts = o.counts || [4, 6, 8];
    const dias = [start].concat(DIA.filter(d => d > start));
    for (let i = 0; i < dias.length; i++) {
      const dia = dias[i];
      for (let j = 0; j < counts.length; j++) {
        const n = counts[j];
        const As = n * AREA(dia);
        if (As >= AsReq) return { n: n, dia: dia, As: r1(As) };
      }
    }
    const dia = dias[dias.length - 1], n = counts[counts.length - 1];
    return { n: n, dia: dia, As: r1(n * AREA(dia)) };
  }

  /* ------------------------------------------------------------- column */
  function checkColumn(d) {
    const b = num(d.colB), h = num(d.colH), H = num(d.H) * 1000;
    const fcu = num(d.fcu) || 25, fy = num(d.fy) || 460, cover = num(d.cover) || 25;
    const N = num(d.colLoad);                       // kN
    const Ac = b * h;
    if (!(b > 0) || !(h > 0)) return { ok: false, status: 'fail', notes: ['The column has no size'], N: N };

    const concCap = 0.4 * fcu * Ac / 1000;          // kN, BS 8110 3.8.4.3
    const AsMin = 0.004 * Ac, AsMax = 0.06 * Ac;
    const AsReq = Math.max(AsMin, (N * 1000 - 0.4 * fcu * Ac) / (0.75 * fy));
    const bars = chooseBars(AsReq, { dia: num(d.colDia) || 16, counts: [4, 6, 8] });
    const AsProv = bars.n * AREA(bars.dia);
    const cap = (0.4 * fcu * Ac + 0.75 * fy * AsProv) / 1000;   // kN
    const util = cap > 0 ? N / cap : 9;
    const ratio = AsProv / Ac * 100;

    const le = 0.75 * H * (num(d.storeys) > 1 ? 1.0 : 1.0);      // braced, pinned ends
    const slim = le / Math.min(b, h);
    const linkDia = Math.max(6, Math.ceil((bars.dia / 4) / 2) * 2, num(d.colLink) || 0);
    const linkSpace = Math.min(12 * bars.dia, Math.min(b, h), 300);

    const notes = [];
    let status = 'pass';
    if (N > cap) { status = 'fail'; notes.push('The load is beyond what this column can carry — enlarge it or add steel.'); }
    if (ratio > 6) { status = 'fail'; notes.push('The steel is over 6 % of the section — enlarge the column.'); }
    if (slim > 15) { status = status === 'fail' ? 'fail' : 'warn'; notes.push('Slender (le/h ' + r1(slim) + ' > 15) — the check assumes a short column, so enlarge it or brace it.'); }
    if (status !== 'fail' && util > 0.9) { status = 'warn'; notes.push('Working at ' + Math.round(util * 100) + ' % of capacity — little room left.'); }
    if (!notes.length) notes.push('A short, axially loaded column: the steel is what the load needs above the concrete.');

    return {
      ok: true, status: status, notes: notes,
      b: b, h: h, H: r1(H / 1000), Ac: Ac,
      N: N, concCap: r1(concCap), AsReq: Math.ceil(AsReq), AsMin: Math.ceil(AsMin),
      bars: bars, AsProv: r1(AsProv), ratio: r1(ratio), cap: r1(cap), util: r2(util), slim: r1(slim),
      linkDia: linkDia, linkSpace: Math.round(linkSpace / 10) * 10,
      main: bars.n + 'T' + bars.dia, links: 'Y' + linkDia + ' @ ' + (Math.round(linkSpace / 10) * 10) + ' c/c'
    };
  }

  /* --------------------------------------------------------------- beam */
  function checkBeam(d) {
    const b = num(d.beamB), h = num(d.beamH), L = num(d.beamSpan);
    const fcu = num(d.fcu) || 25, fy = num(d.fy) || 460, cover = num(d.cover) || 25;
    const w = num(d.beamUDL);                        // kN/m, already factored
    if (!(b > 0) || !(h > 0) || !(L > 0)) return { ok: false, status: 'fail', notes: ['The beam has no span or size'], w: w };

    const mainDia = num(d.beamDia) || 16, topDia = num(d.beamTop) || 12, linkDia = num(d.beamLink) || 8;
    const dd = h - cover - linkDia - mainDia / 2;    // effective depth, mm
    const M = w * L * L / 8;                         // kNm
    const V = w * L / 2;                             // kN

    const Mn = M * 1e6;                              // Nmm
    const K = Mn / (fcu * b * dd * dd);
    const Kp = 0.156;
    const z = Math.min(0.95 * dd, dd * (0.5 + Math.sqrt(Math.max(0, 0.25 - K / 0.9))));
    const AsReq = Mn / (0.87 * fy * z);
    const AsMin = 0.0013 * b * h;
    const bars = chooseBars(Math.max(AsReq, AsMin), { dia: mainDia, counts: [2, 3, 4] });
    const AsProv = bars.n * AREA(bars.dia);

    const top = chooseBars(Math.max(AsMin * 0.5, AsProv * 0.35), { dia: Math.min(topDia, bars.dia) || 12, counts: [2, 3] });

    const v = V * 1000 / (b * dd);                   // N/mm²
    const vc = Math.min(0.8 * Math.sqrt(fcu), Math.max(0.35,
      0.79 * Math.pow(100 * AsProv / (b * dd), 1 / 3) * Math.pow(400 / dd, 0.25) / 1.25));
    const Asv = 2 * AREA(linkDia);                   // two legs
    const svCalc = v > vc ? (0.87 * fy * Asv) / ((v - vc) * b) : 9999;
    const sv = Math.min(0.75 * dd, 300, svCalc);
    const linkSpace = Math.max(75, Math.floor(sv / 25) * 25);

    const spanDepth = L * 1000 / dd;
    const notes = [];
    let status = 'pass';
    if (K > Kp) { status = 'fail'; notes.push('The section is too shallow for the moment (K ' + r2(K) + ' > 0.156) — deepen the beam or add compression steel.'); }
    if (v > 0.8 * Math.sqrt(fcu)) { status = 'fail'; notes.push('The shear stress is over 0.8√fcu — enlarge the section.'); }
    if (spanDepth > 20 && status !== 'fail') { status = 'warn'; notes.push('Span/depth ' + r1(spanDepth) + ' > 20 — deflection may govern; deepen the beam.'); }
    if (v > vc && status === 'fail') notes.push('Shear links at ' + linkSpace + ' c/c would be needed.');
    if (!notes.length) notes.push(v > vc
      ? 'Shear links are needed beyond the concrete: Y' + linkDia + ' @ ' + linkSpace + ' c/c.'
      : 'The concrete alone carries the shear — nominal links at ' + linkSpace + ' c/c.');

    return {
      ok: true, status: status, notes: notes,
      b: b, h: h, L: L, d: r1(dd), w: w,
      M: r1(M), V: r1(V), K: Math.round(K * 1000) / 1000, Kp: Kp, z: r1(z),
      AsReq: Math.ceil(AsReq), AsMin: Math.ceil(AsMin), AsProv: r1(AsProv),
      bars: bars, top: top, topAs: r1(top.n * AREA(top.dia)),
      v: r2(v), vc: r2(vc), linkDia: linkDia, linkSpace: linkSpace, spanDepth: r1(spanDepth),
      main: bars.n + 'T' + bars.dia, topBars: top.n + 'T' + top.dia, links: 'Y' + linkDia + ' @ ' + linkSpace + ' c/c'
    };
  }

  function check(d) {
    const col = checkColumn(d), beam = checkBeam(d);
    const rank = { pass: 0, warn: 1, fail: 2 };
    const status = rank[col.status] >= rank[beam.status] ? col.status : beam.status;
    return { col: col, beam: beam, status: status, d: d };
  }

  /* --------------------------------------------------------------- rows */
  /* The bars the check asks for, as bar marks: main bars and links to the
     columns, bottom bars, top bars and links to the beams. */
  function rows(d, res) {
    const c = (res && res.col) || checkColumn(d);
    const bm = (res && res.beam) || checkBeam(d);
    if (!c.ok || !bm.ok) return [];

    const cover = num(d.cover) || 25;
    const Hmm = num(d.H) * 1000;
    const lap = dia => Math.ceil((40 * dia) / 50) * 50;
    const colLinks = Math.max(3, Math.floor(Hmm / Math.max(75, c.linkSpace)) + 1);
    const beamLinks = Math.max(3, Math.floor((num(d.beamSpan) * 1000) / Math.max(75, bm.linkSpace)) + 1);
    const nCols = Math.max(1, Math.round(num(d.colCount)));
    const nBeams = Math.max(1, Math.round(num(d.beamCount)));
    const out = [];

    out.push({
      mark: 'C1', member: 'Columns', type: 'bar', src: 'design',
      loc: nCols + ' columns — main bars (' + c.main + ')',
      dia: c.bars.dia, shape: 'straight', a: Math.round(Hmm), lap: lap(c.bars.dia),
      no: c.bars.n, members: nCols,
      note: 'Designed: ' + c.main + ', ' + c.ratio + ' % of the section, N = ' + c.N + ' kN',
      spec: '', kgm2: 0
    });
    out.push({
      mark: 'C2', member: 'Columns', type: 'bar', src: 'design',
      loc: nCols + ' columns — links (' + c.links + ')',
      dia: c.linkDia, shape: 'stirrup',
      a: Math.max(50, Math.round(c.b - 2 * cover)), b: Math.max(50, Math.round(c.h - 2 * cover)),
      no: colLinks, members: nCols,
      note: c.links + ' over ' + c.H + ' m', spec: '', kgm2: 0
    });
    out.push({
      mark: 'B1', member: 'Beams', type: 'bar', src: 'design',
      loc: nBeams + ' beams — bottom bars (' + bm.main + ')',
      dia: bm.bars.dia, shape: 'straight',
      a: Math.round(num(d.beamSpan) * 1000 + 300 - 2 * cover), lap: lap(bm.bars.dia),
      no: bm.bars.n, members: nBeams,
      note: 'Designed: ' + bm.main + ', M = ' + bm.M + ' kNm, ' + bm.L + ' m span', spec: '', kgm2: 0
    });
    out.push({
      mark: 'B2', member: 'Beams', type: 'bar', src: 'design',
      loc: nBeams + ' beams — top bars (' + bm.topBars + ')',
      dia: bm.top.dia, shape: 'straight',
      a: Math.round(num(d.beamSpan) * 1000 + 300 - 2 * cover), lap: lap(bm.top.dia),
      no: bm.top.n, members: nBeams,
      note: 'Top steel over the supports: ' + bm.topBars, spec: '', kgm2: 0
    });
    out.push({
      mark: 'B3', member: 'Beams', type: 'bar', src: 'design',
      loc: nBeams + ' beams — links (' + bm.links + ')',
      dia: bm.linkDia, shape: 'stirrup',
      a: Math.max(50, Math.round(bm.b - 2 * cover)), b: Math.max(50, Math.round(bm.h - 2 * cover)),
      no: beamLinks, members: nBeams,
      note: bm.links, spec: '', kgm2: 0
    });
    return out;
  }

  /* how many 12 m rods it takes to cut a list of bars: first fit, longest
     first — the way a yard actually cuts, and enough to order against */
  function pack(cuts, stock) {
    const s = stock || 12000;
    const bins = [];
    cuts.slice().sort((a, b) => b - a).forEach(c => {
      if (c > s) { bins.push(s); return; }              // longer than a rod: count what it needs
      for (let i = 0; i < bins.length; i++) {
        if (bins[i] + c <= s) { bins[i] += c; return; }
      }
      bins.push(c);
    });
    return bins.length;
  }

  /* the weight, the bar count and the rods to buy, for the summary line */
  function weigh(list, stock) {
    const s = stock || 12000;
    let kg = 0, bars = 0, metres = 0;
    const by = {};
    (list || []).forEach(r => {
      const dia = num(r.dia);
      const per = Math.max(0, Math.round(num(r.no)));
      const mem = Math.max(1, Math.round(num(r.members) || 1));
      const n = per * mem;
      let cut = 0;
      if (r.shape === 'stirrup') cut = 2 * (num(r.a) + num(r.b)) + 20 * dia;
      else cut = num(r.a) + num(r.lap);
      cut = Math.round(cut);
      const m = n * cut / 1000;
      bars += n; metres += m; kg += m * KGM(dia);
      const b = by['Y' + dia] = by['Y' + dia] || { dia: dia, bars: 0, metres: 0, kg: 0, cuts: [] };
      b.bars += n; b.metres += m; b.kg += m * KGM(dia);
      for (let i = 0; i < n; i++) b.cuts.push(cut);
    });
    const byDia = Object.keys(by).map(k => {
      const b = by[k];
      return { label: k, dia: b.dia, bars: b.bars, metres: r2(b.metres), kg: r2(b.kg), rods: pack(b.cuts, s) };
    }).sort((a, b) => a.dia - b.dia);
    return { kg: r2(kg), bars: bars, metres: r2(metres), byDia: byDia, rods: byDia.reduce((n, d) => n + d.rods, 0) };
  }

  root.STRUCT = {
    DEFAULTS: FALLBACK, DIA: DIA, AREA: AREA, KGM: KGM, chooseBars: chooseBars,
    defaults: defaults, checkColumn: checkColumn, checkBeam: checkBeam, check: check,
    rows: rows, weigh: weigh
  };
})(typeof window !== 'undefined' ? window : globalThis);
