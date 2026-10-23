/* =====================================================================
   BOQ ENGINE  —  parametric take-off for Ghanaian basic school blocks
   Mirrors the measurement logic of the delivered Bill of Quantities
   (drawing PS 1). Pure functions, no DOM, no network.
   Units: metres.
   ===================================================================== */
(function (root) {
  'use strict';

  const DEFAULT_PARAMS = {
    projectName: 'Proposed 3-Room Educational Block',
    projectSub: "with Head Master's Office, WC and Verandah",
    location: 'Accra, Greater Accra Region, Ghana',
    client: '',
    nClassrooms: 3,
    crW: 6.0, crD: 5.4, verD: 1.8,
    /* Overall dimensions, in metres. `autoFit` derives them from the room
       sizes; `autoFit:false` uses the values below exactly (PS 1 defaults). */
    autoFit: false,
    overallW: 18.6, mainD: 7.65, wingW: 4.65, wingD: 5.1,
    officeOn: true, officeW: 3.0, officeD: 3.6,
    wcOn: true, wcD: 1.2, offVerW: 1.2,
    wallT: 0.15, wallH: 3.0, balH: 0.9,
    /* the frame — generated as components on the building model and priced
       on the take-off. The sizes are in millimetres, as they are drawn. */
    colNos: 4, colBMm: 225, colDMm: 225, rbDmm: 225, lintelDmm: 225,
    /* 0 means "as the drawing measures it" — counting the openings for the
       lintels, spacing the trusses off the width for the roof */
    lintelNos: 0, trussNos: 0, tileWallH: 1.8, apronW: 1.2,
    /* bearings and fittings the drawings set */
    bearingMm: 150, bulkheadNos: 4,
    /* the site plan and the services schedules */
    siteClearFactor: 1.25, boundaryOn: false,
    lightPointsPerRoom: 6, socketsPerRoom: 3, wcNos: 1,
    ironmongeryBasis: 'lump', joineryPaint: 'both', septicOn: true,
    roofPitch: 20, overhang: 0.6, parapet: 0.9,
    roofRidge: 'length', roofHigh: 'front', parapetSides: 'all',
    foundDepth: 1.0, trenchW: 0.8, foundW: 0.6, foundT: 0.2, fdnWallH: 1.05,
    hcThk: 0.15, overThk: 0.10,
    floorFinish: 'terrazzo',      // terrazzo | tiles | screed
    ceilingType: 'pvc',           // pvc | plasterboard | none
    windowType: 'louvre',         // louvre | sliding
    contingency: 5,
    prelimScale: 1.0,
    ratesBasisDate: '2026-10-01',   // the day the rate card was compiled
    fxApplied: 1,                    // index already applied to the card
    doors: [
      { ref: 'D1', desc: '1,500 x 2,100 mm double-leaf hardwood panel doors, complete with frames, architraves and 100 mm butt hinges, to rooms', w: 1.5, h: 2.1, n: 3, wall: 'int', rate: 3650 },
      { ref: 'D2', desc: "900 x 2,100 mm solid core flush door with hardwood frame and architrave, to Head Master's Office", w: 0.9, h: 2.1, n: 1, wall: 'int', rate: 2150 },
      { ref: 'D3', desc: '750 x 2,100 mm solid core flush door with hardwood frame and architrave, to WC', w: 0.75, h: 2.1, n: 1, wall: 'int', rate: 1850 },
      { ref: 'D4', desc: '1,200 x 2,100 mm opening between front verandah and office verandah', w: 1.2, h: 2.1, n: 1, wall: 'int', rate: 0 }
    ],
    windows: [
      { ref: 'W1', desc: '1,830 x 1,200 mm steel-framed louvre windows with aluminium louvre blades, glazing and 12 mm burglar bars, to external walls of rooms', w: 1.83, h: 1.2, n: 6, wall: 'ext', rate: 2750 },
      { ref: 'W2', desc: '1,830 x 1,200 mm steel-framed louvre windows with blades and burglar bars, to room/verandah wall', w: 1.83, h: 1.2, n: 3, wall: 'int', rate: 2650 },
      { ref: 'W3', desc: '1,200 x 1,200 mm steel-framed louvre windows with blades and burglar bars, to office', w: 1.2, h: 1.2, n: 2, wall: 'ext', rate: 2050 },
      { ref: 'W4', desc: '600 x 600 mm louvre window with glass blades, to WC', w: 0.6, h: 0.6, n: 1, wall: 'ext', rate: 980 }
    ],
    rates: {
      siteClear: 45, tempWorks: 12000, waterElec: 10000, supervision: 18000,
      ppe: 6500, insurance: 12000,
      excTrench: 85, excPit: 95, blinding: 430, fdnConc: 1180, colBase: 1320,
      fdnWall: 205, backfill: 55, hardcore: 395, dpm: 22, oversite: 1380, termite: 18,
      colConc: 1980, ringBeam: 1980, lintel: 1980, rebar: 13.5, formwork: 95,
      block: 195, balustrade: 195,
      truss: 1150, purlin: 48, roofSheet: 168, ridge: 98, hip: 98, valley: 130, fascia: 88, barge: 75, roofSundries: 6500,
      flatScreed: 120, parapet: 205,
      ceiling: 155, cornice: 24, hatch: 480,
      ironmongery: 5500,
      screed: 68, terrazzo: 235, tiles: 245, skirting: 42,
      plaster: 65, render: 75, wallTile: 275,
      paintInt: 30, paintExt: 40, gloss: 48,
      db: 11500, submain: 7500, lightPoint: 880, socket: 650, wiring: 15000, earthing: 7500, bulkhead: 1550,
      wc: 4800, basin: 2600, floorDrain: 950, soil: 5200, water: 7500, tank: 11500, septic: 32000,
      apron: 330, steps: 5200, drain: 395, levelling: 28, landscaping: 12000,
      boundary: 240, gate: 9500,
      excManhole: 153.04, mhBlind: 1090.48, mhBase: 1682.10, mhWall: 208.99, mhRender: 99.01,
      mhBench: 1859.22, mhCover: 921.67, mhBack: 31.97,
      drainExc: 46.01, drainBed: 302.18, pipe110: 52.81, pipe160: 69.44, drainBack: 25.92, drainTest: 18.36,
    }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function merge(base, patch) {
    const out = clone(base);
    if (!patch) return out;
    Object.keys(patch).forEach(k => {
      if (patch[k] && typeof patch[k] === 'object' && !Array.isArray(patch[k])) {
        out[k] = merge(out[k] || {}, patch[k]);
      } else if (patch[k] !== undefined) {
        out[k] = patch[k];
      }
    });
    return out;
  }

  /* ------------------------------------------------------------------
     GEOMETRY
     Layout: main block (rooms + verandah) with an office wing
     projecting forward at one end, exactly as drawing PS 1.
     ------------------------------------------------------------------ */
  function geometry(p) {
    const T = p.wallT;
    const n = Math.max(1, p.nClassrooms);

    const auto = p.autoFit === true;
    const BW = auto ? (n * p.crW + (n - 1) * T + 2 * T) : (p.overallW || (n * p.crW + (n - 1) * T + 2 * T));
    const BD = auto ? (p.crD + T + p.verD + T) : (p.mainD || (p.crD + T + p.verD + T));
    const WW = p.officeOn ? (auto ? (p.officeW + T + (p.offVerW || 0) + T) : (p.wingW || 0)) : 0;
    const WD = p.officeOn ? (auto ? ((p.officeD || 0) + T + (p.wcOn ? p.wcD : 0) + T) : (p.wingD || 0)) : 0;
    const totalD = BD + (p.officeOn ? WD : 0);

    const footprint = BW * BD + (p.officeOn ? WW * WD : 0);

    let perimOuter, perimCL, balustrade, extFullCL, intCL;
    if (p.officeOn) {
      perimOuter = BW + BD + (BW - WW) + WD + WW + (BD + WD);
      perimCL = perimOuter - 5 * T + T;
      balustrade = (BW - WW) - T;
    } else {
      perimOuter = 2 * (BW + BD);
      perimCL = perimOuter - 4 * T;
      balustrade = BW - 2 * T;
    }
    extFullCL = perimCL - balustrade;

    intCL = (BW - T)                                    // room / verandah wall
      + (n - 1) * (p.crD + T / 2)                       // room partitions
      + (p.officeOn ? (2 * (WW - T) + WD) : 0);         // office & WC walls

    const o = p.overhang;
    let roofPlan;
    if (p.officeOn) {
      const fullW = BW + 2 * o, fullD = totalD + 2 * o;
      roofPlan = fullW * fullD - (BW - WW) * WD;
    } else {
      roofPlan = (BW + 2 * o) * (BD + 2 * o);
    }
    /* the roof plan is the L this building makes; the lines that are priced by
       the metre — ridge, hips, barges, eaves — come from the shared module */
    /* the L-shaped plan is the roof that is really there; the ridge and the
       barges are measured off the main block */
    const roof = RoofGeom.measure({ type: p.roofType, pitch: p.roofPitch, W: BW, D: BD, overhang: o, planArea: roofPlan,
      ridge: p.roofRidge, high: p.roofHigh, parapetSides: p.parapetSides,
      rafterC: p.roofRafterC, purlinC: p.roofPurlinC,
      ridgeL: p.roofRidgeL, hipL: p.roofHipL, valleyL: p.roofValleyL });
    const roofArea = roof.flat ? roofPlan : roofPlan / Math.cos(roof.pitch * Math.PI / 180);

    const rooms = [];
    for (let i = 1; i <= n; i++) rooms.push({ name: 'Room ' + i, type: 'classroom', L: p.crW, W: p.crD });
    rooms.push({ name: 'Front verandah' + (n > 1 ? ' (' + n + ' bays)' : ''), type: 'verandah', L: n * p.crW, W: p.verD });
    if (p.officeOn) {
      rooms.push({ name: "Head Master's Office", type: 'office', L: p.officeW, W: p.officeD });
      if (p.wcOn) rooms.push({ name: 'WC', type: 'wc', L: p.officeW, W: p.wcD });
      if (p.offVerW) rooms.push({ name: 'Office verandah', type: 'verandah', L: p.offVerW, W: p.officeD });
    }
    const GFA = rooms.reduce((s, r) => s + r.L * r.W, 0);

    return {
      mainW: BW, mainD: BD, wingW: WW, wingD: WD, totalD, footprint,
      perimOuter, perimCL, balustrade, extFullCL, intCL, roofPlan, roofArea, roof,
      rooms, GFA, n
    };
  }

  /* Every opening in an external wall is deducted — doors as well as windows:
     an entrance door is a hole in the blockwork exactly like a window is. The
     lintel runs the width of the opening plus 150 mm bearing on each side. */
  function openings(p) {
    const all = [...p.doors, ...p.windows];
    const extArea = all.filter(o => o.wall === 'ext').reduce((s, o) => s + o.w * o.h * o.n, 0);
    const intArea = all.filter(o => o.wall === 'int').reduce((s, o) => s + o.w * o.h * o.n, 0);
    /* a lintel carries 150 mm on each side of the opening unless the
       drawing says otherwise */
    const bearing = ((+((p && p.bearingMm) || DEFAULT_PARAMS.bearingMm) || 150) * 2) / 1000;
    const lintelLen = all.reduce((s, o) => s + (o.w + bearing) * o.n, 0);
    const joineryArea = all.reduce((s, o) => s + o.w * o.h * o.n, 0);
    return { extArea, intArea, lintelLen, joineryArea };
  }

  /* ------------------------------------------------------------------
     MEASUREMENT
     ------------------------------------------------------------------ */
  function measure(p0) {
    const p = merge(DEFAULT_PARAMS, p0);
    const g = geometry(p);
    const T = p.wallT, H = p.wallH;
    const op = openings(p);
    // the school template has its own rate book; finish types it does not
    // price fall back to the general engine's rates
    const R = Object.assign({}, (root.GenEngine && GenEngine.RATES) || {}, p.rates);

    const extGross = g.extFullCL * H;
    const intGross = g.intCL * H;
    const extNet = Math.max(0, extGross - op.extArea);
    const intNet = Math.max(0, intGross - op.intArea);
    const balGross = g.balustrade * p.balH;
    const blockFull = extNet + intNet;
    const blockTotal = blockFull + balGross;
    /* 450 × 225 mm block, 10 mm joints (9.25 to the m²), 5 % wastage */
    const blockPerM2 = (root.RateBuild && root.RateBuild.BLOCKS_PER_M2) || 9.71;
    const blocks = blockTotal * blockPerM2;

    const fdnCL = g.extFullCL + g.intCL;
    const fdnExc = fdnCL * p.trenchW * p.foundDepth;
    const fdnBlind = fdnCL * p.trenchW * 0.05;
    const fdnConc = fdnCL * p.foundW * p.foundT;
    const fdnWallM2 = fdnCL * p.fdnWallH;
    const colNos = Math.max(0, Math.round(p.colNos == null ? 4 : +p.colNos));
    const colB = (+p.colBMm > 0 ? +p.colBMm : 225) / 1000;
    const colD = (+p.colDMm > 0 ? +p.colDMm : 225) / 1000;
    const colPitExc = colNos * 1.0 * 1.0 * 1.0;
    const colBase = colNos * 0.7 * 0.7 * 0.2;
    const colConc = colNos * colB * colD * 3.3;
    const backfill = Math.max(0, fdnExc - fdnConc - fdnBlind - fdnWallM2 * 0.225 * 0.9 - colPitExc + colBase);
    const hardcore = g.footprint * p.hcThk;
    const overSite = g.footprint * p.overThk;

    const rbL = fdnCL;
    const rbD = (+p.rbDmm > 0 ? +p.rbDmm : 225) / 1000;
    const rb = rbL * T * rbD;
    /* a lintel per opening unless the schedule says otherwise: the openings
       give the total length, so a changed number keeps their average span */
    const lintelD = (+p.lintelDmm > 0 ? +p.lintelDmm : 225) / 1000;
    const openCount = (p.doors || []).reduce((t, o) => t + (+o.n || 0), 0)
      + (p.windows || []).reduce((t, o) => t + (+o.n || 0), 0);
    const lintelN = (+p.lintelNos > 0 ? Math.round(+p.lintelNos) : openCount);
    const lintelLen = openCount > 0 ? (op.lintelLen / openCount) * lintelN : op.lintelLen;
    const lintel = lintelLen * T * lintelD;
    const concTotal = fdnConc + colBase + overSite + colConc + rb + lintel;
    const rebar = concTotal * 90;
    const formwork = rbL * 2 * rbD + colNos * 2 * (colB + colD) * 3.3 + lintelLen * 2 * lintelD;

    const roof = g.roof;
    const trussNos = roof.flat ? 0 : (+p.trussNos > 0 ? Math.round(+p.trussNos) : roof.trusses);
    const purlinL = roof.purlins;
    const roofSheet = roof.covering;
    const fasciaL = roof.eaves;
    const ridgeL = roof.ridge;
    const hipL = roof.hips;
    const valleyL = roof.valleys;
    const bargeL = roof.barges;
    const flatScreed = roof.flat ? roof.planArea : 0;
    const parapetM2 = roof.flat ? roof.parapetL * (p.parapet || 0.9) : 0;

    const screed = g.GFA;
    const classroomsArea = Math.min(p.nClassrooms, g.n) * p.crW * p.crD;
    const terrazzo = classroomsArea + (p.officeOn ? p.officeW * p.officeD : 0);
    const tiled = (p.wcOn ? p.officeW * p.wcD : 0) + (p.officeOn && p.offVerW ? p.offVerW * p.officeD : 0) + 0.6;

    const nCl = g.n;
    const skirting =
      nCl * 2 * (p.crW + p.crD)
      + (p.officeOn ? 2 * (p.officeW + p.officeD) : 0)
      + (p.officeOn && p.wcOn ? 2 * (p.officeW + p.wcD) : 0)
      + (nCl * p.crW + nCl * p.verD)
      + (p.officeOn && p.offVerW ? 2 * (p.offVerW + p.officeD) : 0);

    const innerFace = (g.extFullCL * H - op.extArea) + 2 * (g.intCL * H - op.intArea);
    const outerFace = g.extFullCL * H - op.extArea;
    const plasterInt = innerFace;
    const renderExt = outerFace + balGross;
    const tileH = (+p.tileWallH > 0 ? +p.tileWallH : 1.8);
    const tileWall = p.wcOn ? Math.max(0, 2 * (p.officeW + p.wcD) * tileH - 0.75 * 2.1) : 0;
    const paintInt = plasterInt + screed;
    const paintExt = renderExt;

    const apronW = (+p.apronW > 0 ? +p.apronW : 1.2);
    const apron = g.perimOuter * apronW;
    const drain = 65;

    /* ----------------------------------------------------------------
       THE COMPONENTS
       Every element the take-off has to price, written out of the model
       above: what it is, how big, how many, how much. buildBill then fills
       in the bill number and adopts the measured quantity, so this schedule
       and the bill can never drift apart.
       ---------------------------------------------------------------- */
    const r1 = x => Math.round(x * 10) / 10;
    const r2 = x => Math.round(x * 100) / 100;
    const mm = x => Math.round(x * 1000);
    const C = [];
    /* a size may be a string or a run of strings and dimensions: { dim: 'wallH' }
       is a number the schedule lets the user change, and the measure above
       reads the very same field, so the drawing and the bill stay together */
    const D = (param, opts) => Object.assign({ dim: param }, opts || {});
    const row = (group, name, size, count, qty, unit, key, opts) =>
      C.push(Object.assign({ group: group, name: name, size: size, count: count, qty: qty, unit: unit, key: key, bill: '' }, opts || {}));
    const openN = (p.doors || []).reduce((s, d) => s + (+d.n || 0), 0)
      + (p.windows || []).reduce((s, w) => s + (+w.n || 0), 0);

    row('Substructure', 'Site clearance', 'footprint ' + r1(g.footprint) + ' m² × ' + r1(+p.siteClearFactor || 1.25),
      '', g.footprint * (+p.siteClearFactor || 1.25), 'm2', 'siteClear');
    row('Substructure', 'Trench excavation', [r1(fdnCL) + ' m run × ', D('trenchW', { min: 0.3, max: 2, step: 0.05, label: 'trench width, metres' }), ' × ', D('foundDepth', { min: 0.3, max: 3, step: 0.1, label: 'foundation depth, metres' }), ' m deep'], r1(fdnCL) + ' m', fdnExc, 'm3', 'excTrench');
    row('Substructure', 'Blinding to trenches', [r1(fdnCL) + ' m × ', D('trenchW', { min: 0.3, max: 2, step: 0.05, label: 'trench width, metres' }), ' × 50 mm'], '', fdnBlind, 'm3', 'blinding');
    row('Substructure', 'Strip foundation', [r1(fdnCL) + ' m × ', D('foundW', { min: 0.3, max: 1.5, step: 0.05, label: 'foundation width, metres' }), ' × ', D('foundT', { min: 0.1, max: 0.6, step: 0.025, label: 'foundation thickness, metres' }), ' m'], '', fdnConc, 'm3', 'fdnConc');
    row('Substructure', 'Foundation wall', [r1(fdnCL) + ' m × ', D('fdnWallH', { min: 0.3, max: 2.5, step: 0.05, label: 'foundation wall height, metres' }), ' m high'], '', fdnWallM2, 'm2', 'fdnWall');
    row('Substructure', 'Column pits', colNos + ' pits 1.00 × 1.00 × 1.00 m', colNos + ' No.', colPitExc, 'm3', 'excPit');
    row('Substructure', 'Column bases', colNos + ' bases 700 × 700 × 200 mm', colNos + ' No.', colBase, 'm3', 'colBase');
    row('Substructure', 'Backfill to trenches', 'excavation less concrete and wall', '', backfill, 'm3', 'backfill');
    row('Substructure', 'Damp-proof membrane', 'footprint ' + r1(g.footprint) + ' m², 1,000 gauge', '', g.footprint, 'm2', 'dpm');
    row('Substructure', 'Hardcore bed', ['footprint × ', D('hcThk', { scale: 1000, min: 50, max: 400, step: 10, label: 'hardcore thickness, millimetres' }), ' mm'], '', hardcore, 'm3', 'hardcore');
    row('Substructure', 'Oversite concrete', ['footprint × ', D('overThk', { scale: 1000, min: 50, max: 300, step: 10, label: 'oversite thickness, millimetres' }), ' mm'], '', overSite, 'm3', 'oversite');
    row('Substructure', 'Anti-termite treatment', 'footprint ' + r1(g.footprint) + ' m²', '', g.footprint, 'm2', 'termite');

    row('Frame', 'Columns', [D('colBMm', { min: 100, max: 600, step: 25, label: 'column breadth, millimetres' }), ' × ', D('colDMm', { min: 100, max: 600, step: 25, label: 'column depth, millimetres' }), ' mm × 3.30 m high'], colNos + ' No.', colConc, 'm3', 'colConc', { countParam: 'colNos', countAuto: colNos });
    row('Frame', 'Ring beam', [mm(T) + ' × ', D('rbDmm', { min: 150, max: 900, step: 25, label: 'ring beam depth, millimetres' }), ' mm, ' + r1(rbL) + ' m run'], '1 ring', rb, 'm3', 'ringBeam');
    row('Frame', 'Lintels', [mm(T) + ' × ', D('lintelDmm', { min: 100, max: 450, step: 25, label: 'lintel depth, millimetres' }), ' mm over every opening'], lintelN + ' No.', lintel, 'm3', 'lintel', { countParam: 'lintelNos', countAuto: lintelN });
    row('Frame', 'Reinforcement', r1(concTotal) + ' m³ of concrete at 90 kg/m³', '', Math.round(rebar), 'kg', 'rebar');
    row('Frame', 'Formwork', 'sides of columns, ring beam and lintels', '', formwork, 'm2', 'formwork');

    row('Walling', 'External walls', [r1(g.extFullCL) + ' m × ', D('wallH', { min: 2, max: 6, step: 0.1, label: 'wall height, metres' }), ' m less openings'], '', extNet, 'm2', 'block');
    row('Walling', 'Internal walls', [r1(g.intCL) + ' m × ', D('wallH', { min: 2, max: 6, step: 0.1, label: 'wall height, metres' }), ' m less openings'], '', intNet, 'm2', 'block');
    row('Walling', 'Balustrade wall', [r1(g.balustrade) + ' m × ', D('balH', { min: 0.5, max: 1.5, step: 0.05, label: 'balustrade height, metres' }), ' m high'], '', balGross, 'm2', 'balustrade');
    row('Walling', 'Blocks', r1(blockTotal) + ' m² × 9.7 blocks (450 × 225 mm, joints and wastage)', '', Math.round(blocks), 'nr', 'block');

    if (roof.flat) {
      row('Roof', 'Flat roof screed', 'to falls, over ' + r1(roof.planArea) + ' m²', '', flatScreed, 'm2', 'flatScreed');
      row('Roof', 'Parapet wall', r1(roof.parapetL) + ' m × ' + r1(p.parapet || 0.9) + ' m high', '', parapetM2, 'm2', 'parapet');
    } else {
      row('Roof', roof.type === 'mono' ? 'Roof rafters' : 'Roof trusses', r1(roof.long) + ' m at 1.2 m centres', trussNos + ' No.', trussNos, 'nr', 'truss', { countParam: 'trussNos', countAuto: trussNos });
      row('Roof', 'Purlins', '100 × 50 mm at 900 mm centres', r1(purlinL) + ' m', purlinL, 'm', 'purlin');
      row('Roof', 'Roof covering', 'sheeting to ' + r1(g.roofArea) + ' m² of roof, 10 % laps', '', roofSheet, 'm2', 'roofSheet');
      if (ridgeL > 0) row('Roof', 'Ridge capping', 'to the ridge line', r1(ridgeL) + ' m', ridgeL, 'm', 'ridge');
      if (hipL > 0) row('Roof', 'Hip capping', 'one run to each corner', r1(hipL) + ' m', hipL, 'm', 'hip');
      if (valleyL > 0) row('Roof', 'Valley flashing', 'to the re-entrant angles', r1(valleyL) + ' m', valleyL, 'm', 'valley');
      row('Roof', 'Fascia boards', '200 × 25 mm to the eaves line', r1(fasciaL) + ' m', fasciaL, 'm', 'fascia');
      if (bargeL > 0) row('Roof', 'Barge boards', '200 × 25 mm to the verges', r1(bargeL) + ' m', bargeL, 'm', 'barge');
    }

    (p.doors || []).forEach((d, i) => row('Doors & windows', 'Door ' + d.ref,
      [D('open:door:' + i + ':w', { scale: 1000, min: 600, max: 3000, step: 50, label: 'door width, millimetres' }),
       ' × ',
       D('open:door:' + i + ':h', { scale: 1000, min: 1500, max: 3000, step: 50, label: 'door height, millimetres' }),
       ' mm'],
      (+d.n || 0) + ' No.', +d.n || 0, 'nr', 'door:' + d.ref, { countParam: 'open:door:' + i }));
    (p.windows || []).forEach((w, i) => row('Doors & windows', 'Window ' + w.ref,
      [D('open:window:' + i + ':w', { scale: 1000, min: 300, max: 3000, step: 50, label: 'window width, millimetres' }),
       ' × ',
       D('open:window:' + i + ':h', { scale: 1000, min: 300, max: 2400, step: 50, label: 'window height, millimetres' }),
       ' mm'],
      (+w.n || 0) + ' No.', +w.n || 0, 'nr', 'window:' + w.ref, { countParam: 'open:window:' + i }));

    row('Finishes', 'Floor screed', 'to every room', '', screed, 'm2', 'screed');
    row('Finishes', 'Floor finish to rooms', 'largest rooms and office', '', terrazzo, 'm2', 'floorRooms');
    row('Finishes', 'Floor finish to wet areas', 'WC and office verandah', '', tiled, 'm2', 'floorWet');
    row('Finishes', 'Skirting', '100 mm high round every room', r1(skirting) + ' m', skirting, 'm', 'skirting');
    row('Finishes', 'Plaster to internal walls', 'both faces of every wall', '', plasterInt, 'm2', 'plaster');
    row('Finishes', 'Render to external walls', 'outer face and balustrade', '', renderExt, 'm2', 'render');
    row('Finishes', 'Wall tiling', ['WC walls ', D('tileWallH', { scale: 1000, min: 600, max: 3000, step: 100, label: 'tiling height, millimetres' }), ' mm high'], '', tileWall, 'm2', 'wallTile');
    row('Finishes', 'Paint internal', 'plastered walls and ceilings', '', paintInt, 'm2', 'paintInt');
    row('Finishes', 'Paint external', 'rendered surfaces', '', paintExt, 'm2', 'paintExt');

    row('External works', 'Concrete apron', [D('apronW', { min: 0.5, max: 3, step: 0.1, label: 'apron width, metres' }), ' m wide round the building'], r1(g.perimOuter) + ' m', apron, 'm2', 'apron');
    row('External works', 'Drainage channel', 'along the front of the building', r1(drain) + ' m', drain, 'm', 'drain');

    /* ----------------------------------------------------------------
       THE DRAINAGE RUN AND THE MANHOLES ON IT
       Measured in src/drainage.js, so the plan read on step 2, the
       take-off sheet and this bill all carry the same figures.
       ---------------------------------------------------------------- */
    const DR = root.Drainage.measure({
      perimeter: g.perimOuter, basis: 'half the outer perimeter'
    });
    const drainRun = DR.run, manholes = DR.chambers, drainMain = DR.main;
    const mhExc = DR.mh.exc, mhBlindM3 = DR.mh.blind, mhBaseM3 = DR.mh.base;
    const mhWallM2 = DR.mh.wall, mhRenderM2 = DR.mh.render, mhBenchM3 = DR.mh.bench, mhBackM3 = DR.mh.back;
    const drainExcM3 = DR.trench, drainBedM3 = DR.bed, drainBackM3 = DR.back;
    DR.rows.forEach(x => row('Drainage', x.name, x.note, x.count, x.qty, x.unit, x.key));

    return {
      p, g, op, components: C,
      extGross, intGross, extNet, intNet, balGross, blockFull, blockTotal, blocks,
      fdnCL, fdnExc, fdnBlind, fdnConc, fdnWallM2, colNos, colPitExc, colBase, colConc,
      backfill, hardcore, overSite, rbL, rb, lintel, concTotal, rebar, formwork,
      trussNos, purlinL, roofSheet, fasciaL, ridgeL, hipL, valleyL, bargeL, flatScreed, parapetM2, roof,
      screed, terrazzo, tiled, skirting, plasterInt, renderExt, tileWall, paintInt, paintExt, joineryArea: op.joineryArea,
      apron, drain,
      drainRun: drainRun, manholes: manholes, drainMain: drainMain,
      mhExc: mhExc, mhBlindM3: mhBlindM3, mhBaseM3: mhBaseM3, mhWallM2: mhWallM2,
      mhRenderM2: mhRenderM2, mhBenchM3: mhBenchM3, mhBackM3: mhBackM3,
      drainExcM3: drainExcM3, drainBedM3: drainBedM3, drainBackM3: drainBackM3,
      siteClear: g.footprint * (+p.siteClearFactor || 1.25),
    };
  }

  /* ------------------------------------------------------------------
     BILL OF QUANTITIES
     ------------------------------------------------------------------ */
  function buildBill(p0) {
    const m = measure(p0);
    const p = m.p, g = m.g;
    // its own rate book first; new finish types come from the general engine
    const R = Object.assign({}, (root.GenEngine && GenEngine.RATES) || {}, p.rates);
    const f = (p.prelimScale || 1);
    const q = (x) => Math.round(x * 100) / 100;
    /* the door and window schedule's own figures: how much of the joinery is
       painted, and how many WC fittings the plumbing layout shows */
    const paintF = p.joineryPaint === 'one' ? 1.15 : p.joineryPaint === 'none' ? 0 : 2.3;
    const wcNos = Math.max(0, +p.wcNos || 1);

    const bills = [];

    bills.push({
      code: 'BILL No. 1', title: 'PRELIMINARIES AND GENERAL ITEMS',
      items: [
        { desc: 'Site clearance, levelling, setting out and general preparation of the site including removal of vegetable soil and debris', unit: 'm2', qty: q(m.siteClear), rate: R.siteClear * f, key: 'siteClear' },
        { desc: 'Provision, maintenance and subsequent removal of temporary site office, store and site hoarding', unit: 'Item', qty: 1, rate: R.tempWorks * f, key: 'tempWorks' },
        { desc: 'Water and electricity for the works, including temporary connections and distribution on site', unit: 'Item', qty: 1, rate: R.waterElec * f, key: 'waterElec' },
        { desc: "Contractor's supervision, plant, small tools and consumables for the duration of the works", unit: 'Item', qty: 1, rate: R.supervision * f, key: 'supervision' },
        { desc: "Workmen's temporary sanitary accommodation, personal protective equipment and site safety provisions", unit: 'Item', qty: 1, rate: R.ppe * f, key: 'ppe' },
        { desc: "Contractor's all-risk insurance, workmen's compensation, permits and statutory fees", unit: 'Item', qty: 1, rate: R.insurance * f, key: 'insurance' }
      ]
    });

    bills.push({
      code: 'BILL No. 2', title: 'SUBSTRUCTURE (FOUNDATIONS AND GROUND FLOOR SLAB)',
      items: [
        { desc: 'Excavate trenches for strip foundations, depth not exceeding 1.50 m, and cart away surplus', unit: 'm3', qty: q(m.fdnExc), rate: R.excTrench, key: 'excTrench' },
        { desc: 'Excavate pits for isolated column bases, depth not exceeding 1.50 m', unit: 'm3', qty: q(m.colPitExc), rate: R.excPit, key: 'excPit' },
        { desc: '50 mm thick hardcore blinding to trench bottoms, well compacted', unit: 'm3', qty: q(m.fdnBlind), rate: R.blinding, key: 'blinding' },
        { desc: 'Strip foundation concrete 1:3:6 (' + Math.round(p.foundW * 1000) + ' mm wide x ' + Math.round(p.foundT * 1000) + ' mm thick) to walls', unit: 'm3', qty: q(m.fdnConc), rate: R.fdnConc, key: 'fdnConc' },
        { desc: 'Column base concrete 1:2:4 (700 x 700 x 200 mm) to verandah columns', unit: 'm3', qty: q(m.colBase), rate: R.colBase, key: 'colBase' },
        { desc: '225 mm thick foundation walls in sandcrete blocks laid in cement mortar (1:4), up to damp-proof course', unit: 'm2', qty: q(m.fdnWallM2), rate: R.fdnWall, key: 'fdnWall' },
        { desc: 'Backfilling to trenches with selected excavated material, in 150 mm layers, compacted', unit: 'm3', qty: q(m.backfill), rate: R.backfill, key: 'backfill' },
        { desc: 'Hardcore filling under floors, ' + Math.round(p.hcThk * 1000) + ' mm thick, in selected hardcore well rammed and compacted', unit: 'm3', qty: q(m.hardcore), rate: R.hardcore, key: 'hardcore' },
        { desc: 'Damp-proof membrane, 1,000 gauge polythene sheeting, laid with 150 mm laps', unit: 'm2', qty: q(g.footprint), rate: R.dpm, key: 'dpm' },
        { desc: 'Oversite concrete 1:3:6, ' + Math.round(p.overThk * 1000) + ' mm thick, reinforced with A142 fabric mesh, finished level', unit: 'm3', qty: q(m.overSite), rate: R.oversite, key: 'oversite' },
        { desc: 'Anti-termite treatment to floor bed and foundation perimeter', unit: 'm2', qty: q(g.footprint), rate: R.termite, key: 'termite' }
      ]
    });

    bills.push({
      code: 'BILL No. 3', title: 'REINFORCED CONCRETE FRAME AND LINTELS',
      items: [
        { desc: 'Reinforced concrete columns ' + Math.round((+p.colBMm || 225)) + ' x ' + Math.round((+p.colDMm || 225)) + ' mm to verandah, in 1:2:4 mix', unit: 'm3', qty: q(m.colConc), rate: R.colConc, key: 'colConc' },
        { desc: 'Reinforced concrete ring beam ' + Math.round(p.wallT * 1000) + ' x ' + Math.round((+p.rbDmm || 225)) + ' mm at wall plate level, in 1:2:4 mix', unit: 'm3', qty: q(m.rb), rate: R.ringBeam, key: 'ringBeam' },
        { desc: 'Reinforced concrete lintels ' + Math.round(p.wallT * 1000) + ' x ' + Math.round((+p.lintelDmm || 225)) + ' mm over door and window openings, in 1:2:4 mix', unit: 'm3', qty: q(m.lintel), rate: R.lintel, key: 'lintel' },
        { desc: 'High-yield deformed reinforcement bars, 10 mm to 16 mm, cut, bent and fixed', unit: 'kg', qty: Math.round(m.rebar), rate: R.rebar, key: 'rebar' },
        { desc: 'Sawn formwork to sides of columns, beams and lintels, including struts and removal', unit: 'm2', qty: q(m.formwork), rate: R.formwork, key: 'formwork' }
      ]
    });

    bills.push({
      code: 'BILL No. 4', title: 'WALLING',
      items: [
        { desc: Math.round(p.wallT * 1000) + ' mm thick sandcrete block walls in cement mortar (1:4) to external and internal walls, in panels, including fair face', unit: 'm2', qty: q(m.blockFull), rate: R.block, key: 'block' },
        { desc: Math.round(p.balH * 1000) + ' mm high balustrade wall in ' + Math.round(p.wallT * 1000) + ' mm sandcrete blocks to front verandah, with fair face both sides', unit: 'm2', qty: q(m.balGross), rate: R.balustrade, key: 'balustrade' }
      ]
    });

    bills.push({
      code: 'BILL No. 5', title: 'ROOFING',
      items: (g.roof && g.roof.flat) ? [
        { desc: 'Cement and sand screed to falls on the roof slab, average 60 mm thick, wood floated and finished fair', unit: 'm2', qty: q(m.flatScreed), rate: R.flatScreed, key: 'flatScreed' },
        { desc: Math.round((+p.parapet || 0.9) * 1000) + ' mm high parapet wall in ' + Math.round(p.wallT * 1000) + ' mm sandcrete blocks, with coping and fair face', unit: 'm2', qty: q(m.parapetM2), rate: R.parapet, key: 'parapet' },
        { desc: 'Roofing sundries - outlets, flashings, sealing mastic and rainwater goods to the slab', unit: 'Item', qty: 1, rate: R.roofSundries, key: 'roofSundries' }
      ] : [
        { desc: 'Timber roof ' + (g.roof && g.roof.type === 'mono' ? 'rafters' : 'trusses') + ' fabricated from 150 x 50 mm sawn hardwood, span as drawing, at 1,200 mm centres, including all gang-nail plates and bolts', unit: 'No.', qty: m.trussNos, rate: R.truss, key: 'truss' },
        { desc: 'Roof purlins 100 x 50 mm sawn hardwood at 900 mm centres, including noggings', unit: 'm', qty: q(m.purlinL), rate: R.purlin, key: 'purlin' },
        { desc: 'Aluminium long-span roofing sheets 0.50 mm thick, stucco embossed, laid to ' + p.roofPitch + ' degree ' + (g.roof && g.roof.type === 'hip' ? 'hipped' : g.roof && g.roof.type === 'cross' ? 'cross-hipped' : g.roof && g.roof.type === 'mono' ? 'mono-pitch' : 'gable') + ' roof with 150 mm side laps, including all fastenings', unit: 'm2', qty: q(m.roofSheet), rate: R.roofSheet, key: 'roofSheet' },
        ...(m.ridgeL > 0 ? [{ desc: 'Ridge capping pieces to match the roofing sheets', unit: 'm', qty: q(m.ridgeL), rate: R.ridge, key: 'ridge' }] : []),
        ...(m.hipL > 0 ? [{ desc: 'Hip capping pieces to match the roofing sheets, one run to each corner', unit: 'm', qty: q(m.hipL), rate: R.hip, key: 'hip' }] : []),
        ...(m.valleyL > 0 ? [{ desc: 'Valley flashing and lining to the re-entrant angles, to match the roofing sheets', unit: 'm', qty: q(m.valleyL), rate: R.valley, key: 'valley' }] : []),
        { desc: 'Fascia boards 200 x 25 mm sawn hardwood, primed and fixed to eaves', unit: 'm', qty: q(m.fasciaL), rate: R.fascia, key: 'fascia' },
        ...(m.bargeL > 0 ? [{ desc: 'Barge boards 200 x 25 mm sawn hardwood to the verges, primed and fixed', unit: 'm', qty: q(m.bargeL), rate: R.barge, key: 'barge' }] : []),
        { desc: 'Roofing sundries - umbrella nails, screws, washers, sealing mastic and flashings', unit: 'Item', qty: 1, rate: R.roofSundries, key: 'roofSundries' }
      ]
    });

    const CL = (root.GenEngine && GenEngine.CEILING_FINISH) || {};
    const cl = CL[p.ceilingType] || CL.pvc || { desc: '6 mm PVC ceiling boards', rate: 'ceiling', cornice: true };
    if (p.ceilingType !== 'none' && cl.rate) {
      const items = [{ desc: cl.desc + ', including framing to perimeter', unit: 'm2', qty: q(m.screed), rate: R[cl.rate] != null ? R[cl.rate] : R.ceiling, key: cl.rate }];
      if (cl.cornice !== false) items.push({ desc: '65 mm cornice to ceiling/wall junction', unit: 'm', qty: q(m.skirting + 6), rate: R.cornice, key: 'cornice' });
      items.push({ desc: '600 x 600 mm ceiling access hatch with frame', unit: 'No.', qty: 2, rate: R.hatch, key: 'hatch' });
      bills.push({ code: 'BILL No. 6', title: 'CEILING', items: items });
    }

    const joinery = [];
    p.doors.forEach(d => {
      if (d.n > 0) joinery.push({ desc: d.ref + ' - ' + d.desc, unit: 'No.', qty: d.n, rate: d.rate, key: 'door:' + d.ref });
    });
    p.windows.forEach(w => {
      if (w.n > 0) joinery.push({ desc: w.ref + ' - ' + w.desc, unit: 'No.', qty: w.n, rate: w.rate, key: 'window:' + w.ref });
    });
    const doorNos = (p.doors || []).reduce((s, d) => s + (+d.n || 0), 0);
    joinery.push({ desc: 'Ironmongery and door furniture - mortice locks, handles, tower bolts, door closers and stays',
      unit: p.ironmongeryBasis === 'perDoor' ? 'No.' : 'Item',
      qty: p.ironmongeryBasis === 'perDoor' ? doorNos : 1, rate: R.ironmongery, key: 'ironmongery' });
    bills.push({ code: 'BILL No. 7', title: 'DOORS, WINDOWS AND IRONMONGERY', items: joinery });

    const FL = (root.GenEngine && GenEngine.FLOOR_FINISH) || {};
    const ff0 = FL[p.floorFinish] || FL.terrazzo || { desc: '25 mm terrazzo floor finish, polished', rate: 'terrazzo' };
    const fw0 = FL[p.floorWet] || FL.tiles || { desc: 'Ceramic floor tiles 300 x 300 mm', rate: 'tiles' };
    bills.push({
      code: 'BILL No. 8', title: 'FLOOR FINISHES',
      items: [
        ...(ff0.rate === 'screed' ? [] : [{ desc: '40 mm thick cement and sand (1:4) screed to floors, finished and cured', unit: 'm2', qty: q(m.screed), rate: R.screed, key: 'screed' }]),
        { desc: ff0.desc + ', to rooms and office', unit: 'm2', qty: q(m.terrazzo), rate: R[ff0.rate] != null ? R[ff0.rate] : R.terrazzo, key: ff0.rate },
        { desc: fw0.desc + ', to WC and office verandah', unit: 'm2', qty: q(m.tiled), rate: R[fw0.rate] != null ? R[fw0.rate] : R.tiles, key: fw0.rate },
        { desc: '100 mm high skirting, ' + String(ff0.label || 'terrazzo').toLowerCase() + ' to rooms and office and '
            + String(fw0.label || 'tiles').toLowerCase() + ' to wet areas, with rounded top edge', unit: 'm', qty: q(m.skirting), rate: R.skirting, key: 'skirting' }
      ]
    });

    bills.push({
      code: 'BILL No. 9', title: 'WALL FINISHES',
      items: [
        { desc: '12 mm thick cement and sand (1:4) plaster to internal wall surfaces, in two coats, steel trowelled', unit: 'm2', qty: q(m.plasterInt), rate: R.plaster, key: 'plaster' },
        { desc: '15 mm thick cement and sand (1:4) render to external wall surfaces, in two coats, wood float finish', unit: 'm2', qty: q(m.renderExt), rate: R.render, key: 'render' },
        { desc: 'Glazed wall tiles 200 x 300 mm to WC walls, ' + Math.round((+p.tileWallH || 1.8) * 1000).toLocaleString('en-US') + ' mm high, with white cement grout', unit: 'm2', qty: q(m.tileWall), rate: R.wallTile, key: 'wallTile' }
      ]
    });

    bills.push({
      code: 'BILL No. 10', title: 'PAINTING AND DECORATION',
      items: [
        { desc: 'Prepare and apply two coats of vinyl emulsion paint to internal plastered walls and ceilings', unit: 'm2', qty: q(m.paintInt), rate: R.paintInt, key: 'paintInt' },
        { desc: 'Prepare and apply two coats of weather-guard acrylic paint to external rendered surfaces', unit: 'm2', qty: q(m.paintExt), rate: R.paintExt, key: 'paintExt' },
        { desc: 'Prepare and apply undercoat and two coats of gloss paint to doors, windows, fascia and rails', unit: 'm2', qty: q(m.joineryArea * paintF), rate: R.gloss, key: 'gloss' }
      ]
    });

    const lightPoints = p.nClassrooms * (+p.lightPointsPerRoom || 6) + 8;
    const socketPoints = p.nClassrooms * (+p.socketsPerRoom || 3) + 3;
    bills.push({
      code: 'BILL No. 11', title: 'ELECTRICAL INSTALLATION',
      items: [
        { desc: 'Supply and install three-phase distribution board with miniature circuit breakers and earth leakage protection', unit: 'No.', qty: 1, rate: R.db, key: 'db' },
        { desc: 'Sub-main armoured cable from point of supply to distribution board, in PVC conduit', unit: 'Item', qty: 1, rate: R.submain, key: 'submain' },
        { desc: 'Lighting points complete with 1.2 m LED batten fittings, to rooms, verandah, office and WC', unit: 'No.', qty: lightPoints, rate: R.lightPoint, key: 'lightPoint' },
        { desc: 'Twin 13 A switched socket outlets with PVC conduit drops', unit: 'No.', qty: socketPoints, rate: R.socket, key: 'socket' },
        { desc: 'PVC conduit, trunking, junction boxes and 2.5 mm2/1.5 mm2 copper wiring to all points', unit: 'Item', qty: 1, rate: R.wiring, key: 'wiring' },
        { desc: 'Earthing system and lightning protection installation', unit: 'Item', qty: 1, rate: R.earthing, key: 'earthing' },
        { desc: 'External bulkhead security lights with photocell control', unit: 'No.', qty: (p.bulkheadNos != null ? +p.bulkheadNos : 4), rate: R.bulkhead, key: 'bulkhead' }
      ]
    });

    bills.push({
      code: 'BILL No. 12', title: 'PLUMBING AND SANITARY INSTALLATION',
      items: [
        { desc: 'White vitreous china water closet suite with dual-flush cistern, seat and cover', unit: 'No.', qty: wcNos, rate: R.wc, key: 'wc' },
        { desc: 'White glazed wash hand basin with pedestal, tap, bottle trap and mirror', unit: 'No.', qty: wcNos, rate: R.basin, key: 'basin' },
        { desc: 'Cast iron/PVC floor drain with stainless steel grating', unit: 'No.', qty: wcNos, rate: R.floorDrain, key: 'floorDrain' },
        { desc: '110 mm PVC soil, waste and vent pipework, with fittings, laid to falls', unit: 'Item', qty: 1, rate: R.soil, key: 'soil' },
        { desc: 'PPR water supply pipework 20 mm/25 mm with fittings, valves and insulation', unit: 'Item', qty: 1, rate: R.water, key: 'water' },
        { desc: '1,000 litre polyethylene overhead storage tank on 2.0 m galvanised steel stand', unit: 'No.', qty: 1, rate: R.tank, key: 'tank' },
        ...(p.septicOn !== false ? [{ desc: 'Septic tank with soakaway pit, including excavation, concrete, blockwork and covers', unit: 'No.', qty: 1, rate: R.septic, key: 'septic' }] : [])
      ]
    });

    bills.push({
      code: 'BILL No. 13', title: 'EXTERNAL WORKS AND ANCILLARIES',
      items: [
        { desc: 'Concrete apron ' + Math.round((+p.apronW || 1.2) * 1000).toLocaleString('en-US') + ' mm wide x 100 mm thick, in 1:3:6 mix with A142 mesh, brushed finish, to building perimeter', unit: 'm2', qty: q(m.apron), rate: R.apron, key: 'apron' },
        { desc: 'Concrete steps to verandah entrances - 4 risers, with handrail, to each bay', unit: 'No.', qty: p.nClassrooms, rate: R.steps, key: 'steps' },
        { desc: 'Precast concrete drainage channel with grating along front of building', unit: 'm', qty: m.drain, rate: R.drain, key: 'drain' },
        { desc: 'Site levelling, filling and grassing to compound immediately around the building', unit: 'm2', qty: 350, rate: R.levelling, key: 'levelling' },
        { desc: 'Boundary demarcation, landscaping and site reinstatement', unit: 'Item', qty: 1, rate: R.landscaping, key: 'landscaping' },
        ...(p.boundaryOn ? [
          { desc: 'Boundary wall in sandcrete blocks with coping, 2.4 m high', unit: 'm', qty: 60, rate: R.boundary, key: 'boundary' },
          { desc: 'Steel entrance gate with posts and ironmongery', unit: 'No.', qty: 1, rate: R.gate, key: 'gate' }
        ] : [])
      ]
    });

    /* ----------------------------------------------------------------
       BILLS 14 AND 15 — THE MANHOLES AND THE DRAIN
       Taken off with the external works: the run out of the building to
       the septic tank in Bill 12, the chambers on it, and the trench, bed
       and backfill that carry the pipe.
       ---------------------------------------------------------------- */
    bills.push({
      code: 'BILL No. 14', title: 'MANHOLE WORKS',
      items: [
        { desc: 'Excavate for manholes, 1.35 × 1.35 m in plan, depth not exceeding 1.40 m, including working space, trimming and carting away',
          unit: 'm3', qty: q(m.mhExc * m.manholes), rate: R.excManhole, key: 'excManhole' },
        { desc: '50 mm thick blinding concrete grade 15 to manhole bases',
          unit: 'm3', qty: q(m.mhBlindM3 * m.manholes), rate: R.mhBlind, key: 'mhBlind' },
        { desc: '150 mm thick reinforced concrete base, 1:2:4 mix, to manholes',
          unit: 'm3', qty: q(m.mhBaseM3 * m.manholes), rate: R.mhBase, key: 'mhBase' },
        { desc: '225 mm thick sandcrete block walls in cement mortar (1:4) to manholes, fair face internally',
          unit: 'm2', qty: q(m.mhWallM2 * m.manholes), rate: R.mhWall, key: 'mhWall' },
        { desc: '15 mm thick cement and sand (1:3) render to the inside of manholes, steel float finish',
          unit: 'm2', qty: q(m.mhRenderM2 * m.manholes), rate: R.mhRender, key: 'mhRender' },
        { desc: 'Concrete benching and channel to manhole inverts, 1:2:4 mix, laid to falls',
          unit: 'm3', qty: q(m.mhBenchM3 * m.manholes), rate: R.mhBench, key: 'mhBench' },
        { desc: 'Heavy duty cast iron manhole cover and frame, 600 × 600 mm, bedded in mortar and sealed',
          unit: 'No.', qty: m.manholes, rate: R.mhCover, key: 'mhCover' },
        { desc: 'Backfill around manholes with selected material, in 150 mm layers, compacted, and cart away the surplus',
          unit: 'm3', qty: q(m.mhBackM3 * m.manholes), rate: R.mhBack, key: 'mhBack' }
      ]
    });
    bills.push({
      code: 'BILL No. 15', title: 'DRAINAGE WORKS',
      items: [
        { desc: 'Excavate trench for drain pipes, 0.45 m wide, depth not exceeding 0.90 m, including trimming and carting away',
          unit: 'm3', qty: q(m.drainExcM3), rate: R.drainExc, key: 'drainExc' },
        { desc: '100 mm thick sand bedding to drain pipes, levelled and compacted to the required fall',
          unit: 'm3', qty: q(m.drainBedM3), rate: R.drainBed, key: 'drainBed' },
        { desc: '110 mm uPVC soil and waste pipe laid to falls, with couplings, bends, junctions and solvent cement joints',
          unit: 'm', qty: q(m.drainRun), rate: R.pipe110, key: 'pipe110' },
        { desc: '160 mm uPVC pipe from the last manhole to the septic tank, laid to falls, with fittings',
          unit: 'm', qty: q(m.drainMain), rate: R.pipe160, key: 'pipe160' },
        { desc: 'Backfill to drain trenches with selected material, in 150 mm layers, compacted and made good',
          unit: 'm3', qty: q(m.drainBackM3), rate: R.drainBack, key: 'drainBack' },
        { desc: 'Testing and commissioning of the drainage, including flushing, ball tests and making good',
          unit: 'm', qty: q(m.drainRun), rate: R.drainTest, key: 'drainTest' }
      ]
    });

    bills.forEach(b => {
      b.items.forEach(it => {
        it.amount = Math.round(it.qty * it.rate * 100) / 100;
      });
      b.total = Math.round(b.items.reduce((s, it) => s + it.amount, 0) * 100) / 100;
    });

    /* the components the building model generated are priced on this bill:
       give each one the row that prices it, and take that row's measured
       quantity, so the schedule and the bill always agree */
    const byKey = {};
    bills.forEach(b => b.items.forEach(it => {
      if (it.key && !byKey[it.key]) byKey[it.key] = { bill: b.code, item: it };
    }));
    (m.components || []).forEach(c => {
      if (c.key === 'floorRooms') c.key = (FL[p.floorFinish] || FL.terrazzo || { rate: 'terrazzo' }).rate;
      if (c.key === 'floorWet') c.key = (FL[p.floorWet] || FL.tiles || { rate: 'tiles' }).rate;
      const hit = byKey[c.key];
      if (!hit) return;
      c.bill = hit.bill;
      if (String(c.unit).toLowerCase() === String(hit.item.unit).toLowerCase()) {
        c.qty = hit.item.qty;
        c.unit = hit.item.unit;
      }
    });

    const subtotal = Math.round(bills.reduce((s, b) => s + b.total, 0) * 100) / 100;
    const contingency = Math.round(subtotal * p.contingency) / 100;
    const grand = Math.round((subtotal + contingency) * 100) / 100;

    return {
      params: p, model: m, bills, subtotal, contingency, grand,
      perM2: Math.round(grand / m.g.GFA * 100) / 100,
      rooms: m.g.rooms, GFA: m.g.GFA
    };
  }

  /* ------------------------------------------------------------------ */
  root.BOQ = { DEFAULT_PARAMS, merge, clone, geometry, openings, measure, buildBill };
})(typeof window !== 'undefined' ? window : globalThis);
