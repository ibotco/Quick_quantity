/* =====================================================================
   GENERAL ENGINE — domestic & commercial buildings.
   Works from a room schedule + storey/height data taken from the
   sections and elevations, and produces the same result shape as the
   school engine so every exporter keeps working.
   ===================================================================== */
(function (root) {
  'use strict';

  const DEFAULTS = {
    template: 'general',
    buildingType: 'domestic',        // domestic | commercial | educational | health
    projectName: 'Proposed Residential Building',
    projectSub: 'Three-bedroom bungalow with porch',
    location: 'Accra, Greater Accra Region, Ghana',
    client: '',
    clientAddr: '',
    contractor: '',
    contractorAddr: '',
    contractorClass: '',
    consultant: '',
    consultantAddr: '',
    tenderRef: '',
    billDate: '',
    contractPeriod: '',
    preparedBy: '',
    drawingRef: 'Architectural set — ground floor plan, sections A-A/B-B, elevations',

    /* ---- geometry (from the plan) ---- */
    bW: 12.0, bD: 9.0,              // overall width / depth
    extWallCL: 0, intWallCL: 0,      // 0 = derive from overall dims
    wallT: 0.15, wallH: 2.9,         // floor-to-ceiling
    storeys: 1, floorH: 3.0,         // floor-to-floor
    bearingMm: 150, bulkheadNos: 4,  // lintel bearing each side, external bulkhead lights
    plinth: 0.45, colSpacingM: 3.5,  // plinth and the column grid the frame plan sets
    siteClearFactor: 1.25, apronW: 1.2,
    ironmongeryBasis: 'lump', joineryPaint: 'both', septicOn: true,

    /* ---- verticals (from the sections / elevations) ---- */
    foundDepth: 1.2, foundType: 'strip',      // strip | raft
    foundW: 0.6, foundT: 0.2,                  // footing width and thickness
    hcThk: 0.15, overThk: 0.10,                // hardcore and oversite, metres
    eavesH: 0, ridgeExtra: 0, roofPitch: 22,
    roofType: 'gable',                          // gable | hip | mono | flat
    roofRidge: 'length', roofHigh: 'front', parapetSides: 'all',
    overhang: 0.6, parapet: 0.9,
    storeyHeight: 0,

    /* ---- specification ---- */
    floorMain: 'terrazzo',           // terrazzo | tiles | wood | screed
    floorWet: 'tiles',
    wallFinish: 'plaster',
    ceilingType: 'pvc',              // pvc | plasterboard | pop | none
    windowType: 'aluminium',         // aluminium | louvre | upvc | timber
    externalFinish: 'render',        // render | fairface | cladding
    doors: [], windows: [],

    /* ---- services ---- */
    svcElectrical: true, svcPlumbing: true, svcHVAC: false, svcSolar: false,
    svcFire: false, svcGenerator: false, svcBorehole: false,
    boundaryOn: false,

    /* ---- pricing ---- */
    region: 'Greater Accra',
    country: 'Ghana', curCode: 'GHS', curSymbol: 'GH¢', curLabel: 'Ghana Cedi',
    curName: 'Cedis', curSub: 'Pesewas',
    aiProvider: 'gemini', aiKey: '', aiModel: 'gemini-2.0-flash', aiBaseUrl: '',
    prelimPct: 8, opProfitPct: 12, wastagePct: 5,
    contingency: 5, vatPct: 0,
    ratesBasisDate: '2026-10-01', fxApplied: 1,
    rates: {}
  };

  const RATES = {
    siteClear: 45, tempWorks: 12000, waterElec: 10000, supervision: 18000, ppe: 6500, insurance: 12000,
    excTrench: 85, excPit: 95, blinding: 430, fdnConc: 1180, fdnWall: 205, backfill: 55,
    hardcore: 395, dpm: 22, oversite: 1380, termite: 18, raftConc: 1450, mesh: 42,
    colConc: 1980, beamConc: 1980, slabConc: 1880, stairConc: 2100, lintel: 1980, rebar: 13.5, formwork: 95,
    block: 195, block225: 265, parapet: 205,
    truss: 1150, purlin: 48, roofSheet: 168, ridge: 98, hip: 98, valley: 130, fascia: 88, barge: 75, roofSundries: 6500,
    flatScreed: 120, waterproof: 145, outlet: 420,
    ceiling: 155, ceilingPB: 125, cornice: 24, hatch: 480,
    ironmongery: 5500,
    screed: 68, terrazzo: 235, tiles: 245, wood: 320, skirting: 42,
    porcelain: 340, laminate: 285, epoxy: 165, granite: 560, vinyl: 230, carpet: 195,
    ceilingPOP: 235, ceilingGrid: 205, ceilingFC: 180, ceilingTimber: 300,
    plaster: 65, render: 75, wallTile: 275, cladding: 420,
    paintInt: 30, paintExt: 40, gloss: 48,
    db: 6500, submain: 4500, lightPoint: 550, socket: 420, wiring: 8000, earthing: 4500, bulkhead: 950, acPoint: 3200,
    wc: 3800, basin: 2000, sink: 2200, shower: 2400, floorDrain: 850, soil: 3800, water: 5500, tank: 7500, septic: 28000, borehole: 28000,
    apron: 330, steps: 5200, drain: 395, levelling: 28, landscaping: 12000, boundary: 240, gate: 9500,
    /* manhole works and drainage works */
    excManhole: 153.04, mhBlind: 1090.48, mhBase: 1682.10, mhWall: 208.99, mhRender: 99.01,
    mhBench: 1859.22, mhCover: 921.67, mhBack: 31.97,
    drainExc: 46.01, drainBed: 302.18, pipe110: 52.81, pipe160: 69.44, drainBack: 25.92, drainTest: 18.36,
    solar: 26000, generator: 45000, fire: 18000, hvac: 12000
  };

  /* The finishes a bill can carry. Each one names the rate that prices it and
     the wording that prints in the bill, so a new type is one line here and
     one option in the menus — never a change in the measuring code. */
  const FLOOR_FINISH = {
    terrazzo:   { label: 'Terrazzo',            rate: 'terrazzo',  desc: '25 mm terrazzo floor finish, white cement and granite chippings, polished' },
    tiles:      { label: 'Ceramic tiles',       rate: 'tiles',     desc: 'Ceramic floor tiles 300 x 300 mm on 20 mm mortar bed, white cement grout' },
    porcelain:  { label: 'Porcelain tiles',     rate: 'porcelain', desc: 'Porcelain floor tiles 600 x 600 mm on 20 mm mortar bed, epoxy grout' },
    granite:    { label: 'Granite tiles',       rate: 'granite',   desc: 'Polished granite floor tiles 600 x 600 mm on 20 mm mortar bed' },
    wood:       { label: 'Timber strip',        rate: 'wood',      desc: 'Timber strip flooring on treated battens, sanded and sealed' },
    laminate:   { label: 'Laminate',            rate: 'laminate',  desc: '8 mm laminate flooring on foam underlay, with matching skirting' },
    vinyl:      { label: 'Vinyl sheet',         rate: 'vinyl',     desc: 'Vinyl sheet flooring on smoothing screed, heat-welded joints' },
    epoxy:      { label: 'Epoxy resin',         rate: 'epoxy',     desc: 'Epoxy resin floor coating, three coats, on prepared screed' },
    carpet:     { label: 'Carpet tiles',        rate: 'carpet',    desc: 'Carpet tiles laid on tackless underlay, edge trims' },
    screed:     { label: 'Screed only',         rate: 'screed',    desc: 'Power-float cement and sand screed finish to floors' }
  };
  const CEILING_FINISH = {
    pvc:          { label: 'PVC boards',              rate: 'ceiling',      cornice: true,  desc: '6 mm PVC ceiling boards fixed to 50 x 50 mm timber brandering at 600 mm centres' },
    plasterboard: { label: 'Plasterboard',            rate: 'ceilingPB',    cornice: true,  desc: '9 mm plasterboard ceiling fixed to timber brandering, joints taped and skimmed' },
    pop:          { label: 'POP with cornice',        rate: 'ceilingPOP',   cornice: true,  desc: 'Plaster of Paris (POP) ceiling with cornice moulding, to timber soffit' },
    grid:         { label: 'Mineral fibre T-grid',    rate: 'ceilingGrid',  cornice: false, desc: '600 x 600 mm mineral fibre ceiling tiles in exposed T-grid, hangers at 1,200 mm centres' },
    fibre:        { label: 'Fibre cement board',      rate: 'ceilingFC',    cornice: true,  desc: '6 mm fibre cement ceiling boards fixed to timber brandering, joints filled' },
    timber:       { label: 'Timber tongue & groove',  rate: 'ceilingTimber',cornice: false, desc: '25 x 150 mm tongue-and-groove timber ceiling on treated brandering' },
    none:         { label: 'None — exposed soffit',   rate: null,           cornice: false, desc: '' }
  };

  const clone = o => JSON.parse(JSON.stringify(o));
  function merge(base, patch) {
    const out = clone(base);
    Object.keys(patch || {}).forEach(k => {
      const v = patch[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = merge(out[k] || {}, v);
      else if (v !== undefined) out[k] = v;
    });
    return out;
  }

  // countries the app can price for; symbols are kept WinAnsi-safe so the
  // hand-written PDF and the Office writers can render them
  const COUNTRIES = [
    { name: 'Ghana', code: 'GH', cur: 'GHS', symbol: 'GH¢', label: 'Ghana Cedi', unit: 'Cedis', sub: 'Pesewas' },
    { name: 'Nigeria', code: 'NG', cur: 'NGN', symbol: 'NGN ', label: 'Nigerian Naira', unit: 'Naira', sub: 'Kobo' },
    { name: 'Kenya', code: 'KE', cur: 'KES', symbol: 'KES ', label: 'Kenyan Shilling', unit: 'Shillings', sub: 'Cents' },
    { name: 'South Africa', code: 'ZA', cur: 'ZAR', symbol: 'R ', label: 'South African Rand', unit: 'Rand', sub: 'Cents' },
    { name: "Côte d'Ivoire", code: 'CI', cur: 'XOF', symbol: 'CFA ', label: 'West African CFA Franc', unit: 'Francs', sub: 'Centimes' },
    { name: 'Togo', code: 'TG', cur: 'XOF', symbol: 'CFA ', label: 'West African CFA Franc', unit: 'Francs', sub: 'Centimes' },
    { name: 'Benin', code: 'BJ', cur: 'XOF', symbol: 'CFA ', label: 'West African CFA Franc', unit: 'Francs', sub: 'Centimes' },
    { name: 'Burkina Faso', code: 'BF', cur: 'XOF', symbol: 'CFA ', label: 'West African CFA Franc', unit: 'Francs', sub: 'Centimes' },
    { name: 'Senegal', code: 'SN', cur: 'XOF', symbol: 'CFA ', label: 'West African CFA Franc', unit: 'Francs', sub: 'Centimes' },
    { name: 'Cameroon', code: 'CM', cur: 'XAF', symbol: 'FCFA ', label: 'Central African CFA Franc', unit: 'Francs', sub: 'Centimes' },
    { name: 'Liberia', code: 'LR', cur: 'LRD', symbol: 'L$ ', label: 'Liberian Dollar', unit: 'Dollars', sub: 'Cents' },
    { name: 'Sierra Leone', code: 'SL', cur: 'SLE', symbol: 'SLE ', label: 'Sierra Leonean Leone', unit: 'Leones', sub: 'Cents' },
    { name: 'The Gambia', code: 'GM', cur: 'GMD', symbol: 'GMD ', label: 'Gambian Dalasi', unit: 'Dalasis', sub: 'Bututs' },
    { name: 'United Kingdom', code: 'GB', cur: 'GBP', symbol: '£', label: 'Pound Sterling', unit: 'Pounds', sub: 'Pence' },
    { name: 'United States', code: 'US', cur: 'USD', symbol: '$', label: 'US Dollar', unit: 'Dollars', sub: 'Cents' },
    { name: 'Canada', code: 'CA', cur: 'CAD', symbol: 'C$ ', label: 'Canadian Dollar', unit: 'Dollars', sub: 'Cents' },
    { name: 'United Arab Emirates', code: 'AE', cur: 'AED', symbol: 'AED ', label: 'UAE Dirham', unit: 'Dirhams', sub: 'Fils' }
  ];
  const byCountry = n => COUNTRIES.find(c => c.name === n) || COUNTRIES[0];

  const ROOM_TYPES = {
    bedroom: { floor: 'main', wet: false, lights: 2, sockets: 2 },
    living: { floor: 'main', wet: false, lights: 3, sockets: 3 },
    hall: { floor: 'main', wet: false, lights: 3, sockets: 2 },
    dining: { floor: 'main', wet: false, lights: 2, sockets: 2 },
    kitchen: { floor: 'tiles', wet: true, lights: 2, sockets: 4 },
    bath: { floor: 'tiles', wet: true, lights: 1, sockets: 1 },
    wc: { floor: 'tiles', wet: true, lights: 1, sockets: 1 },
    store: { floor: 'main', wet: false, lights: 1, sockets: 1 },
    corridor: { floor: 'main', wet: false, lights: 2, sockets: 1 },
    porch: { floor: 'tiles', wet: false, lights: 1, sockets: 0 },
    garage: { floor: 'main', wet: false, lights: 2, sockets: 1 },
    office: { floor: 'main', wet: false, lights: 3, sockets: 4 },
    shop: { floor: 'main', wet: false, lights: 4, sockets: 4 },
    classroom: { floor: 'main', wet: false, lights: 6, sockets: 2 },
    ward: { floor: 'main', wet: false, lights: 4, sockets: 3 },
    reception: { floor: 'main', wet: false, lights: 3, sockets: 3 },
    stair: { floor: 'main', wet: false, lights: 1, sockets: 0 },
    auditorium: { floor: 'main', wet: false, lights: 10, sockets: 4 },
    sanctuary: { floor: 'tiles', wet: false, lights: 4, sockets: 2 },
    vestry: { floor: 'main', wet: false, lights: 2, sockets: 2 },
    choir: { floor: 'main', wet: false, lights: 3, sockets: 2 },
    foyer: { floor: 'tiles', wet: false, lights: 4, sockets: 2 }
  };

  /* millimetres, as the drawings give them, and a short metre figure */
  const mm = x => Math.round(x * 1000).toLocaleString('en-US');
  const fmt1 = x => (Math.round(x * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });

  function geometry(p) {
    const T = p.wallT;
    const ext = p.extWallCL > 0 ? p.extWallCL : 2 * (p.bW + p.bD) - 4 * T;
    const int = p.intWallCL > 0 ? p.intWallCL : Math.max(0, (p.rooms || []).length * 3.2);
    const footprint = p.bW * p.bD;
    const wallHeightGround = p.wallH;
    const totalWallH = p.storeys * p.wallH + p.plinth;
    const eaves = p.eavesH > 0 ? p.eavesH : p.plinth + p.storeys * p.floorH;
    /* the roof: one plan, cut the way the chosen type cuts it */
    const roof = RoofGeom.measure({ type: p.roofType, pitch: p.roofPitch, W: p.bW, D: p.bD, overhang: p.overhang,
      ridge: p.roofRidge, high: p.roofHigh, parapetSides: p.parapetSides,
      rafterC: p.roofRafterC, purlinC: p.roofPurlinC,
      ridgeL: p.roofRidgeL, hipL: p.roofHipL, valleyL: p.roofValleyL });
    const ridge = p.ridgeExtra > 0 ? p.ridgeExtra : (roof.flat ? (p.parapet || 0.9) : roof.rise);
    const roofPlan = roof.planArea;
    const roofArea = roof.slopeArea;
    const framePerimeter = 2 * (p.bW + p.bD);
    return { ext, int, footprint, totalWallH, eaves, ridge, roofPlan, roofArea, roof, framePerimeter,
      mainW: p.bW, totalD: p.bD, GFA: (p.rooms || []).reduce((s, r) => s + r.L * r.W * (r.n || 1), 0),
      wingW: 0, wingD: 0, perimOuter: framePerimeter };
  }

  function measure(p0) {
    const p = merge(DEFAULTS, p0);
    p.rates = merge(RATES, p.rates || {});
    const g = geometry(p);
    const T = p.wallT, R = p.rates, S = Math.max(1, p.storeys | 0);
    const rooms = p.rooms || [];

    const allOpen = [...(p.doors || []), ...(p.windows || [])];
    // an opening is a hole in the wall whether it takes a door or a window;
    // lintels carry 150 mm bearing each side
    const opExt = allOpen.filter(o => o.wall === 'ext').reduce((s, o) => s + o.w * o.h * o.n, 0);
    const opInt = allOpen.filter(o => o.wall === 'int').reduce((s, o) => s + o.w * o.h * o.n, 0);
    const bearing = ((+p.bearingMm || 150) * 2) / 1000;
    const lintelLen = allOpen.reduce((s, o) => s + (o.w + bearing) * o.n, 0);
    const joineryArea = allOpen.reduce((s, o) => s + o.w * o.h * o.n, 0);

    const extGross = g.ext * p.wallH * S;
    const intGross = g.int * p.wallH * S;
    const extNet = Math.max(0, extGross - opExt);
    const intNet = Math.max(0, intGross - opInt);
    const roof = g.roof;
    const parapetM2 = roof.flat ? roof.parapetL * (p.parapet || 0.9) : 0;
    const blockTotal = extNet + intNet + parapetM2;
    /* 450 × 225 mm block, 10 mm joints = 9.25 to the m², plus the wastage
       allowed in the specification (5 % by default) */
    const blocks = blockTotal * 9.25 * (1 + (p.wastagePct != null ? p.wastagePct : 5) / 100);

    // substructure
    const fdnL = g.ext + g.int * S;
    const fdnExc = fdnL * 0.8 * p.foundDepth;
    const fdnBlind = fdnL * 0.8 * 0.05;
    const fdnConc = p.foundType === 'raft' ? g.footprint * 0.25
      : fdnL * (p.foundW || 0.6) * (p.foundT || 0.2);
    const fdnWallM2 = p.foundType === 'raft' ? 0 : fdnL * 1.05;
    const backfill = Math.max(0, fdnExc - fdnConc - fdnBlind - (fdnWallM2 * 0.225 * 0.9));
    const hcThk = +p.hcThk > 0 ? +p.hcThk : 0.15;
    const overThk = +p.overThk > 0 ? +p.overThk : 0.10;
    const hardcore = g.footprint * hcThk;
    const oversite = g.footprint * overThk;

    // frame
    const colB = (+p.colBMm || 225) / 1000, colD = (+p.colDMm || 225) / 1000;
    const lintelD = (+p.lintelDmm || 225) / 1000;
    const cols = Math.round(g.framePerimeter / (+p.colSpacingM || 3.5)) + 1;
    const colConc = cols * colB * colD * (p.plinth + S * p.floorH) * 0.8;
    const beams = S * g.framePerimeter * 0.225 * 0.45;
    const slabs = Math.max(0, S - 1) * g.footprint * 0.15;
    const stairs = Math.max(0, S - 1);
    const stairConc = stairs * 3.2;
    const lintels = lintelLen * T * lintelD;
    const concTotal = fdnConc + oversite + colConc + beams + slabs + stairConc + lintels;
    // reinforcement by element (kg/m3) — oversite is mesh, priced in its own rate
    const rebarFdn = fdnConc * (p.foundType === 'raft' ? 95 : 45);
    const rebar = colConc * 145 + beams * 165 + lintels * 105 + slabs * 115 + stairConc * 120;
    const formwork = (beams * 4) + (cols * 4 * colB * 3.0) + lintelLen * 0.45 + (slabs > 0 ? g.footprint * 0.15 : 0);

    // roof
    const trusses = roof.trusses;
    const purlinL = roof.purlins;
    const roofSheet = roof.covering;
    const flatScreed = roof.flat ? roof.planArea : 0;
    const ridgeL = roof.ridge, hipL = roof.hips, valleyL = roof.valleys, bargeL = roof.barges, eavesL = roof.eaves;

    // finishes
    const roomArea = t => rooms.filter(r => (r.type || '') === t).reduce((s, r) => s + r.L * r.W * (r.n || 1), 0);
    const wetArea = rooms.filter(r => (ROOM_TYPES[r.type] || {}).wet).reduce((s, r) => s + r.L * r.W * (r.n || 1), 0);
    const GFA = g.GFA;                    // net internal (rooms)
    const grossArea = g.footprint * S;    // external footprint x storeys
    const dryArea = Math.max(0, GFA - wetArea);
    const perim = rooms.reduce((s, r) => s + 2 * (r.L + r.W) * (r.n || 1), 0) * S;
    const doorW = (p.doors || []).reduce((s, d) => s + d.w * d.n, 0);
    const skirting = Math.max(0, perim - doorW);

    const innerFace = extNet + 2 * intNet;
    const outerFace = extNet + parapetM2 * 2;
    const wetWall = rooms.reduce((s, r) => {
      const t = ROOM_TYPES[r.type] || {};
      if (!t.wet) return s;
      const h = r.type === 'kitchen' ? 0.6 : 1.8;      // splashback at the counter
      return s + 2 * (r.L + r.W) * h * (r.n || 1);
    }, 0);

    /* ----------------------------------------------------------------
       THE COMPONENTS
       The same schedule the school template writes for the take-off, for
       any other building: what the element is, how big, how many, how much.
       buildBill gives each one the bill row that prices it.
       ---------------------------------------------------------------- */
    const r1 = x => Math.round(x * 10) / 10;
    const r2 = x => Math.round(x * 100) / 100;
    const C = [];
    const row = (group, name, size, count, qty, unit, key) =>
      C.push({ group: group, name: name, size: size, count: count, qty: qty, unit: unit, key: key, bill: '' });
    const openN = allOpen.reduce((t, o) => t + (+o.n || 0), 0);
    const raft = p.foundType === 'raft';

    row('Substructure', 'Site clearance', 'footprint ' + r1(g.footprint) + ' m² × ' + r1(+p.siteClearFactor || 1.25),
      '', g.footprint * (+p.siteClearFactor || 1.25), 'm2', 'siteClear');
    row('Substructure', 'Trench excavation', r1(fdnL) + ' m run × 0.8 × ' + r2(p.foundDepth) + ' m deep', r1(fdnL) + ' m', fdnExc, 'm3', 'excTrench');
    row('Substructure', 'Blinding to trenches', r1(fdnL) + ' m × 0.8 × 50 mm', '', fdnBlind, 'm3', 'blinding');
    row('Substructure', raft ? 'Raft foundation' : 'Strip foundation',
      raft ? 'footprint ' + r1(g.footprint) + ' m² × 0.25 m' : r1(fdnL) + ' m × ' + r2(p.foundW || 0.6) + ' × ' + r2(p.foundT || 0.2) + ' m',
      '', fdnConc, 'm3', raft ? 'raftConc' : 'fdnConc');
    if (!raft) row('Substructure', 'Foundation wall', r1(fdnL) + ' m × 1.05 m high', '', fdnWallM2, 'm2', 'fdnWall');
    row('Substructure', 'Backfill to trenches', 'excavation less concrete and wall', '', backfill, 'm3', 'backfill');
    row('Substructure', 'Hardcore bed', 'footprint × ' + mm(hcThk) + ' mm', '', hardcore, 'm3', 'hardcore');
    row('Substructure', 'Damp-proof membrane', 'footprint ' + r1(g.footprint) + ' m²', '', g.footprint, 'm2', 'dpm');
    row('Substructure', 'Oversite concrete', 'footprint × ' + mm(overThk) + ' mm', '', oversite, 'm3', 'oversite');

    row('Frame', 'Columns', mm(colB) + ' × ' + mm(colD) + ' mm × ' + r1(p.plinth + S * p.floorH) + ' m high', cols + ' No.', colConc, 'm3', 'colConc');
    row('Frame', 'Beams', '225 × 450 mm, ' + r1(g.framePerimeter) + ' m ring per floor', (S * 1) + ' ring' + (S === 1 ? '' : 's'), beams, 'm3', 'beamConc');
    row('Frame', 'Lintels', Math.round(T * 1000) + ' × 225 mm over every opening', openN + ' No.', lintels, 'm3', 'lintel');
    if (slabs > 0) row('Frame', 'Suspended floor slab', '150 mm thick over ' + r1(g.footprint) + ' m²', (S - 1) + ' floor' + (S - 1 === 1 ? '' : 's'), slabs, 'm3', 'slabConc');
    if (stairs > 0) row('Frame', 'Staircase', 'one flight per upper floor', stairs + ' No.', stairConc, 'm3', 'stairConc');
    row('Frame', 'Formwork', 'sides of columns, beams, slab and lintels', '', formwork, 'm2', 'formwork');
    row('Frame', 'Reinforcement', r1(concTotal) + ' m³ of concrete, cut and fixed', '', Math.round(rebar), 'kg', 'rebar');

    row('Walling', 'External walls', r1(g.ext) + ' m × ' + r1(p.wallH) + ' m × ' + S + ' storey(s), less openings', '', extNet, 'm2', 'block');
    row('Walling', 'Internal walls', r1(g.int) + ' m × ' + r1(p.wallH) + ' m × ' + S + ' storey(s), less openings', '', intNet, 'm2', 'block');
    row('Walling', 'Blocks', r1(blockTotal) + ' m² × 9.7 blocks (450 × 225 mm, joints and wastage)', '', Math.round(blocks), 'nr', 'block');

    if (!roof.flat) {
      row('Roof', roof.type === 'mono' ? 'Roof rafters' : 'Roof trusses',
        r1(roof.long) + ' m at 1.2 m centres', trusses + ' No.', trusses, 'nr', 'truss');
      row('Roof', 'Purlins', '100 × 50 mm at 900 mm centres', r1(purlinL) + ' m', purlinL, 'm', 'purlin');
      row('Roof', 'Roof covering', r1(g.roofArea) + ' m² of roof, 10 % laps', '', roofSheet, 'm2', 'roofSheet');
      if (ridgeL > 0) row('Roof', 'Ridge capping', r1(ridgeL) + ' m ridge', r1(ridgeL) + ' m', ridgeL, 'm', 'ridge');
      if (hipL > 0) row('Roof', 'Hip capping', r1(hipL) + ' m of hip', r1(hipL) + ' m', hipL, 'm', 'hip');
      if (valleyL > 0) row('Roof', 'Valley flashing', 'to the re-entrant angles', r1(valleyL) + ' m', valleyL, 'm', 'valley');
      row('Roof', 'Fascia boards', 'to the eaves line', r1(eavesL) + ' m', eavesL, 'm', 'fascia');
      if (bargeL > 0) row('Roof', 'Barge boards', 'to the verges', r1(bargeL) + ' m', bargeL, 'm', 'barge');
    } else {
      row('Roof', 'Flat roof screed', 'to falls, over ' + r1(g.roofPlan) + ' m²', '', flatScreed, 'm2', 'flatScreed');
      row('Roof', 'Parapet wall', r1(roof.parapetL) + ' m × ' + r1(p.parapet || 0.9) + ' m high', '', parapetM2, 'm2', 'parapet');
    }

    row('Finishes', 'Plaster to internal walls', 'both faces of every wall', '', innerFace, 'm2', 'plaster');
    row('Finishes', 'Render to external walls', 'outer face', '', outerFace, 'm2', 'render');
    row('Finishes', 'Skirting', '100 mm high round every room', r1(skirting) + ' m', skirting, 'm', 'skirting');
    if (wetWall > 0) row('Finishes', 'Wall tiling', 'to wet areas', '', wetWall, 'm2', 'wallTile');
    row('Finishes', 'Paint internal', 'plastered walls and ceilings', '', innerFace + GFA, 'm2', 'paintInt');
    row('Finishes', 'Paint external', 'rendered surfaces', '', outerFace, 'm2', 'paintExt');

    row('External works', 'Concrete apron', fmt1(+p.apronW || 1.2) + ' m wide round the building', r1(g.framePerimeter) + ' m', g.framePerimeter * (+p.apronW || 1.2), 'm2', 'apron');

    /* ----------------------------------------------------------------
       THE DRAINAGE RUN AND THE MANHOLES ON IT
       The plan gives the building, not the site: where the tank sits is
       the surveyor's to say. So the run out of the building is taken as
       half the frame perimeter — the average distance from the middle of
       the building to its face — plus 8 m to clear the building to the
       tank. A manhole sits at the building, one every 15 m of the run,
       and one at the tank. Every figure here is typed over on the
       take-off sheet the moment the site layout says otherwise.
       ---------------------------------------------------------------- */
    /* measured in src/drainage.js, so step 2, the take-off and this bill agree */
    const DR = root.Drainage.measure({
      perimeter: g.framePerimeter, basis: 'half the frame perimeter'
    });
    const drainRun = DR.run, manholes = DR.chambers, drainMain = DR.main;
    const mhExc = DR.mh.exc, mhBlindM3 = DR.mh.blind, mhBaseM3 = DR.mh.base;
    const mhWallM2 = DR.mh.wall, mhRenderM2 = DR.mh.render, mhBenchM3 = DR.mh.bench, mhBackM3 = DR.mh.back;
    const drainExcM3 = DR.trench, drainBedM3 = DR.bed, drainBackM3 = DR.back;
    DR.rows.forEach(x => row('Drainage', x.name, x.note, x.count, x.qty, x.unit, x.key));

    return {
      p, g, rooms, grossArea, components: C,
      extGross, intGross, extNet, intNet, parapetM2, blockTotal, blocks,
      fdnL, fdnExc, fdnBlind, fdnConc, fdnWallM2, backfill, hardcore, oversite, hcThk, overThk,
      cols, colConc, beams, slabs, stairs, stairConc, lintels, concTotal, rebar, rebarFdn, formwork, lintelLen, joineryArea,
      trusses, purlinL, roofSheet, flatScreed, ridgeL, hipL, valleyL, bargeL, eavesL, roof,
      GFA, wetArea, dryArea, skirting, innerFace, outerFace, wetWall,
      plasterInt: innerFace, renderExt: outerFace,
      siteClear: g.footprint * (+p.siteClearFactor || 1.25),
      apron: g.framePerimeter * (+p.apronW || 1.2),
      drainRun: drainRun, manholes: manholes, drainMain: drainMain,
      mhExc: mhExc, mhBlindM3: mhBlindM3, mhBaseM3: mhBaseM3, mhWallM2: mhWallM2,
      mhRenderM2: mhRenderM2, mhBenchM3: mhBenchM3, mhBackM3: mhBackM3,
      drainExcM3: drainExcM3, drainBedM3: drainBedM3, drainBackM3: drainBackM3
    };
  }

  function buildBill(p0) {
    const m = measure(p0);
    const p = m.p, R = p.rates, g = m.g;
    const S = Math.max(1, p.storeys | 0);
    const q = x => Math.round(x * 100) / 100;
    const f = 1 + (p.opProfitPct / 100);
    // preliminaries scale with the size of the job (150 m2 = factor 1.0)
    const sizeFactor = Math.max(0.35, Math.min(1.8, (m.GFA || 120) / 150));

    const bills = [];
    const works = [];

    bills.push({
      code: 'BILL No. 1', title: 'PRELIMINARIES AND GENERAL ITEMS',
      items: [
        { desc: 'Site clearance, levelling, setting out and general preparation of the site, including removal of vegetable soil and debris', unit: 'm2', qty: q(m.siteClear), rate: R.siteClear, key: 'siteClear' },
        { desc: 'Provision, maintenance and removal of temporary site office, store and hoarding', unit: 'Item', qty: 1, rate: Math.round(R.tempWorks * sizeFactor), key: 'tempWorks' },
        { desc: 'Water and electricity for the works, temporary connections and site distribution', unit: 'Item', qty: 1, rate: Math.round(R.waterElec * sizeFactor), key: 'waterElec' },
        { desc: "Contractor's supervision, plant, small tools and consumables for the duration of the works", unit: 'Item', qty: 1, rate: Math.round(R.supervision * sizeFactor), key: 'supervision' },
        { desc: 'Temporary sanitary accommodation, personal protective equipment and site safety provisions', unit: 'Item', qty: 1, rate: Math.round(R.ppe * sizeFactor), key: 'ppe' },
        { desc: "Contractor's all-risk insurance, workmen's compensation, permits and statutory fees", unit: 'Item', qty: 1, rate: Math.round(R.insurance * sizeFactor), key: 'insurance' }
      ]
    });

    bills.push({
      code: 'BILL No. 2', title: 'SUBSTRUCTURE',
      items: [
        { desc: 'Excavate trenches for strip foundations, depth not exceeding 1.50 m, and cart away surplus', unit: 'm3', qty: q(m.fdnExc), rate: R.excTrench, key: 'excTrench' },
        { desc: '50 mm thick hardcore blinding to trench bottoms, well compacted', unit: 'm3', qty: q(m.fdnBlind), rate: R.blinding, key: 'blinding' },
        p.foundType === 'raft'
          ? { desc: 'Reinforced concrete raft foundation 250 mm thick in 1:2:4 mix, including edge thickenings', unit: 'm3', qty: q(m.fdnConc), rate: R.raftConc, key: 'raftConc' }
          : { desc: 'Strip foundation concrete 1:3:6, ' + Math.round((p.foundW || 0.6) * 1000) + ' mm wide x '
              + Math.round((p.foundT || 0.2) * 1000) + ' mm thick, to walls', unit: 'm3', qty: q(m.fdnConc), rate: R.fdnConc, key: 'fdnConc' },
        ...(p.foundType === 'raft'
          ? [{ desc: 'A142 fabric reinforcement mesh to raft, lapped and tied', unit: 'm2', qty: q(g.footprint), rate: R.mesh, key: 'mesh' }]
          : [{ desc: '225 mm thick foundation walls in sandcrete blocks laid in cement mortar (1:4), to damp-proof course', unit: 'm2', qty: q(m.fdnWallM2), rate: R.fdnWall, key: 'fdnWall' }]),
        { desc: 'High-yield deformed reinforcement bars to foundations, cut, bent and fixed', unit: 'kg', qty: Math.round(m.rebarFdn), rate: R.rebar, key: 'rebar' },
        { desc: 'Backfilling to trenches with selected excavated material, in 150 mm layers, compacted', unit: 'm3', qty: q(m.backfill), rate: R.backfill, key: 'backfill' },
        { desc: 'Hardcore filling under floors, ' + mm(m.hcThk) + ' mm thick, selected hardcore well rammed', unit: 'm3', qty: q(m.hardcore), rate: R.hardcore, key: 'hardcore' },
        { desc: 'Damp-proof membrane, 1,000 gauge polythene sheeting, laid with 150 mm laps', unit: 'm2', qty: q(g.footprint), rate: R.dpm, key: 'dpm' },
        { desc: 'Ground floor slab, ' + mm(m.overThk) + ' mm thick 1:3:6 concrete reinforced with A142 mesh, finished level', unit: 'm3', qty: q(m.oversite), rate: R.oversite, key: 'oversite' },
        { desc: 'Anti-termite treatment to floor bed and foundation perimeter', unit: 'm2', qty: q(g.footprint), rate: R.termite, key: 'termite' }
      ]
    });

    works.push({
      code: 'BILL No. 3', title: 'REINFORCED CONCRETE FRAME, FLOORS AND STAIRCASE',
      items: [
        { desc: 'Reinforced concrete columns 225 x 225 mm in 1:2:4 mix, including starter bars', unit: 'm3', qty: q(m.colConc), rate: R.colConc, key: 'colConc' },
        { desc: 'Reinforced concrete beams 225 x 450 mm in 1:2:4 mix, including ring beams at each floor', unit: 'm3', qty: q(m.beams), rate: R.beamConc, key: 'beamConc' },
        ...(m.slabs > 0 ? [{ desc: 'Reinforced concrete suspended floor slab 150 mm thick in 1:2:4 mix, including soffit finish', unit: 'm3', qty: q(m.slabs), rate: R.slabConc, key: 'slabConc' }] : []),
        ...(m.stairs > 0 ? [{ desc: 'Reinforced concrete staircase, waist 150 mm, treads and risers formed, including landings', unit: 'm3', qty: q(m.stairConc), rate: R.stairConc, key: 'stairConc' }] : []),
        { desc: 'Reinforced concrete lintels ' + Math.round(p.wallT * 1000) + ' x 225 mm over openings in 1:2:4 mix', unit: 'm3', qty: q(m.lintels), rate: R.lintel, key: 'lintel' },
        { desc: 'High-yield deformed reinforcement bars 10-20 mm, cut, bent and fixed', unit: 'kg', qty: Math.round(m.rebar), rate: R.rebar, key: 'rebar' },
        { desc: 'Sawn formwork to sides and soffits of columns, beams, slabs and lintels, including struts and removal', unit: 'm2', qty: q(m.formwork), rate: R.formwork, key: 'formwork' }
      ]
    });

    works.push({
      code: 'BILL No. 4', title: 'WALLING',
      items: [
        { desc: Math.round(p.wallT * 1000) + ' mm thick sandcrete block walls in cement mortar (1:4), external and internal, in panels, including fair face', unit: 'm2', qty: q(m.extNet + m.intNet), rate: R.block, key: 'block' },
        ...((m.g.roof && m.g.roof.flat) ? [{ desc: Math.round((p.parapet || 0.9) * 1000) + ' mm high parapet wall in sandcrete blocks with coping', unit: 'm2', qty: q(m.parapetM2), rate: R.parapet, key: 'parapet' }] : [])
      ]
    });

    const roofItems = [];
    const roof = m.g.roof;
    const RT = roof.type;
    if (!roof.flat) {
      roofItems.push(
        { desc: (RT === 'mono' ? 'Timber roof rafters' : 'Timber roof trusses') + ' 150 x 50 mm sawn hardwood at 1,200 mm centres, including plates and bolts', unit: 'No.', qty: m.trusses, rate: R.truss, key: 'truss' },
        { desc: 'Roof purlins 100 x 50 mm at 900 mm centres, including noggings and bracing', unit: 'm', qty: q(m.purlinL), rate: R.purlin, key: 'purlin' },
        { desc: 'Aluminium long-span roofing sheets 0.50 mm, stucco embossed, laid to ' + p.roofPitch + ' degree ' + (RT === 'hip' ? 'hipped' : RT === 'cross' ? 'cross-hipped' : RT === 'mono' ? 'mono-pitch' : 'gable') + ' roof, including fastenings', unit: 'm2', qty: q(m.roofSheet), rate: R.roofSheet, key: 'roofSheet' }
      );
      if (m.ridgeL > 0) roofItems.push(
        { desc: 'Ridge capping to match the roofing sheets', unit: 'm', qty: q(m.ridgeL), rate: R.ridge, key: 'ridge' });
      if (m.hipL > 0) roofItems.push(
        { desc: 'Hip capping to match the roofing sheets, one run to each corner', unit: 'm', qty: q(m.hipL), rate: R.hip, key: 'hip' });
      if (m.valleyL > 0) roofItems.push(
        { desc: 'Valley flashing and lining to the re-entrant angles, to match the roofing sheets', unit: 'm', qty: q(m.valleyL), rate: R.valley, key: 'valley' });
      roofItems.push(
        { desc: 'Fascia boards 200 x 25 mm sawn hardwood, primed and fixed to eaves', unit: 'm', qty: q(m.eavesL), rate: R.fascia, key: 'fascia' });
      if (m.bargeL > 0) roofItems.push(
        { desc: 'Barge boards 200 x 25 mm to the gable verges, primed and fixed', unit: 'm', qty: q(m.bargeL), rate: R.barge, key: 'barge' });
      roofItems.push(
        { desc: 'Roofing sundries - umbrella nails, screws, washers, sealing mastic and flashings', unit: 'Item', qty: 1, rate: R.roofSundries, key: 'roofSundries' }
      );
    } else {
      roofItems.push(
        { desc: 'Cement and sand screed to falls on roof slab, average 60 mm thick, finished fair', unit: 'm2', qty: q(m.flatScreed), rate: R.flatScreed, key: 'flatScreed' },
        { desc: 'Torch-on bituminous waterproof membrane, 4 mm, laid with 100 mm laps and mineral finish', unit: 'm2', qty: q(m.flatScreed), rate: R.waterproof, key: 'waterproof' },
        { desc: 'Cast iron rainwater outlets with gratings and downpipes', unit: 'No.', qty: 6, rate: R.outlet, key: 'outlet' },
        { desc: 'Roofing sundries - sealants, flashings and trims', unit: 'Item', qty: 1, rate: R.roofSundries, key: 'roofSundries' }
      );
    }
    works.push({ code: 'BILL No. 5', title: 'ROOFING', items: roofItems });

    const ceil = CEILING_FINISH[p.ceilingType] || CEILING_FINISH.pvc;
    if (p.ceilingType !== 'none' && ceil.rate) {
      const ceilItems = [
        { desc: ceil.desc, unit: 'm2', qty: q(m.GFA), rate: R[ceil.rate] != null ? R[ceil.rate] : R.ceiling, key: ceil.rate }
      ];
      if (ceil.cornice) ceilItems.push({ desc: '65 mm cornice to ceiling/wall junction', unit: 'm', qty: q(m.skirting), rate: R.cornice, key: 'cornice' });
      ceilItems.push({ desc: '600 x 600 mm ceiling access hatch with frame', unit: 'No.', qty: 2, rate: R.hatch, key: 'hatch' });
      works.push({ code: 'BILL No. 6', title: 'CEILING', items: ceilItems });
    }

    const joinery = [];
    (p.doors || []).forEach(d => { if (d.n > 0) joinery.push({ desc: d.ref + ' - ' + d.desc, unit: 'No.', qty: d.n, rate: d.rate, key: 'door:' + d.ref }); });
    (p.windows || []).forEach(w => { if (w.n > 0) joinery.push({ desc: w.ref + ' - ' + w.desc, unit: 'No.', qty: w.n, rate: w.rate, key: 'window:' + w.ref }); });
    const doorNos = (p.doors || []).reduce((s, d) => s + (+d.n || 0), 0);
    const paintF = p.joineryPaint === 'one' ? 1.15 : p.joineryPaint === 'none' ? 0 : 2.3;
    joinery.push({ desc: 'Ironmongery and door furniture - locks, handles, hinges, tower bolts and stays',
      unit: p.ironmongeryBasis === 'perDoor' ? 'No.' : 'Item',
      qty: p.ironmongeryBasis === 'perDoor' ? doorNos : 1, rate: R.ironmongery, key: 'ironmongery' });
    works.push({ code: 'BILL No. 7', title: 'DOORS, WINDOWS AND IRONMONGERY', items: joinery });

    const ff = FLOOR_FINISH[p.floorMain] || FLOOR_FINISH.tiles;
    const fw = FLOOR_FINISH[p.floorWet] || FLOOR_FINISH.tiles;
    const floorItems = [];
    // a 40 mm bed is needed under every finish except a power-float screed,
    // which is its own finished surface
    if (ff.rate !== 'screed') floorItems.push({ desc: '40 mm thick cement and sand (1:4) screed to floors, finished and cured', unit: 'm2', qty: q(m.GFA), rate: R.screed, key: 'screed' });
    floorItems.push(
      { desc: ff.desc + ', to dry rooms', unit: 'm2', qty: q(m.dryArea), rate: R[ff.rate] != null ? R[ff.rate] : R.tiles, key: ff.rate },
      { desc: fw.desc + ', to wet areas', unit: 'm2', qty: q(m.wetArea), rate: R[fw.rate] != null ? R[fw.rate] : R.tiles, key: fw.rate },
      { desc: '100 mm high skirting with rounded top edge, to match floor finish', unit: 'm', qty: q(m.skirting), rate: R.skirting, key: 'skirting' }
    );
    works.push({ code: 'BILL No. 8', title: 'FLOOR FINISHES', items: floorItems });

    works.push({
      code: 'BILL No. 9', title: 'WALL FINISHES',
      items: [
        { desc: '12 mm thick cement and sand (1:4) plaster to internal wall surfaces, two coats, steel trowelled', unit: 'm2', qty: q(m.plasterInt), rate: R.plaster, key: 'plaster' },
        { desc: p.externalFinish === 'cladding' ? 'External wall cladding panels on proprietary rails' : '15 mm thick cement and sand (1:4) render to external wall surfaces, two coats, wood float finish', unit: 'm2', qty: q(m.renderExt), rate: p.externalFinish === 'cladding' ? R.cladding : R.render, key: p.externalFinish === 'cladding' ? 'cladding' : 'render' },
        { desc: 'Glazed wall tiles 200 x 300 mm to wet areas, 1,800 mm high, with white cement grout', unit: 'm2', qty: q(m.wetWall), rate: R.wallTile, key: 'wallTile' }
      ]
    });

    works.push({
      code: 'BILL No. 10', title: 'PAINTING AND DECORATION',
      items: [
        { desc: 'Prepare and apply two coats of vinyl emulsion paint to internal plastered walls and ceilings', unit: 'm2', qty: q(m.plasterInt + m.GFA), rate: R.paintInt, key: 'paintInt' },
        { desc: 'Prepare and apply two coats of weather-guard acrylic paint to external rendered surfaces', unit: 'm2', qty: q(m.renderExt), rate: R.paintExt, key: 'paintExt' },
        { desc: 'Prepare and apply undercoat and two coats of gloss paint to doors, windows, fascia and rails', unit: 'm2', qty: q(m.joineryArea * paintF), rate: R.gloss, key: 'gloss' }
      ]
    });

    if (p.svcElectrical) {
      const lights = (m.rooms || []).reduce((s, r) => s + (ROOM_TYPES[r.type] || { lights: 2 }).lights * (r.n || 1), 0) * S + 4;
      const sockets = (m.rooms || []).reduce((s, r) => s + (ROOM_TYPES[r.type] || { sockets: 2 }).sockets * (r.n || 1), 0) * S;
      works.push({
        code: 'BILL No. 11', title: 'ELECTRICAL INSTALLATION',
        items: [
          { desc: 'Supply and install distribution board with MCBs and earth leakage protection', unit: 'No.', qty: 1, rate: R.db, key: 'db' },
          { desc: 'Sub-main armoured cable from point of supply to distribution board, in PVC conduit', unit: 'Item', qty: 1, rate: R.submain, key: 'submain' },
          { desc: 'Lighting points complete with LED fittings, including switches', unit: 'No.', qty: lights, rate: R.lightPoint, key: 'lightPoint' },
          { desc: 'Twin 13 A switched socket outlets with conduit drops', unit: 'No.', qty: sockets, rate: R.socket, key: 'socket' },
          { desc: 'PVC conduit, trunking, junction boxes and copper wiring to all points', unit: 'Item', qty: 1, rate: R.wiring, key: 'wiring' },
          { desc: 'Earthing system and lightning protection installation', unit: 'Item', qty: 1, rate: R.earthing, key: 'earthing' },
          { desc: 'External bulkhead security lights with photocell control', unit: 'No.', qty: (p.bulkheadNos != null ? +p.bulkheadNos : 4), rate: R.bulkhead, key: 'bulkhead' },
          ...(p.svcGenerator ? [{ desc: 'Standby generator 10 kVA with changeover switch and enclosure', unit: 'No.', qty: 1, rate: R.generator, key: 'generator' }] : []),
          ...(p.svcSolar ? [{ desc: 'Solar PV system 3 kWp with inverter, batteries and mounting', unit: 'Item', qty: 1, rate: R.solar, key: 'solar' }] : [])
        ]
      });
    }

    if (p.svcPlumbing) {
      const wcs = Math.max(1, (m.rooms || []).filter(r => r.type === 'wc' || r.type === 'bath').length);
      const basins = Math.max(1, (m.rooms || []).filter(r => ['bath', 'wc', 'kitchen'].includes(r.type)).length);
      works.push({
        code: 'BILL No. 12', title: 'PLUMBING AND SANITARY INSTALLATION',
        items: [
          { desc: 'White vitreous china WC suite with dual-flush cistern, seat and cover', unit: 'No.', qty: wcs, rate: R.wc, key: 'wc' },
          { desc: 'White glazed wash hand basin with pedestal, tap, bottle trap and mirror', unit: 'No.', qty: basins, rate: R.basin, key: 'basin' },
          { desc: 'Stainless steel kitchen sink unit with mixer tap and waste', unit: 'No.', qty: (m.rooms || []).some(r => r.type === 'kitchen') ? 1 : 0, rate: R.sink, key: 'sink' },
          { desc: 'Shower mixer and rose with screen to bathrooms', unit: 'No.', qty: (m.rooms || []).filter(r => r.type === 'bath').length, rate: R.shower, key: 'shower' },
          { desc: '110 mm PVC soil, waste and vent pipework with fittings, laid to falls', unit: 'Item', qty: 1, rate: R.soil, key: 'soil' },
          { desc: 'PPR water supply pipework 20/25 mm with fittings, valves and insulation', unit: 'Item', qty: 1, rate: R.water, key: 'water' },
          { desc: '1,000 litre polyethylene overhead storage tank on galvanised steel stand', unit: 'No.', qty: Math.max(1, Math.ceil(S / 2)), rate: R.tank, key: 'tank' },
          ...(p.septicOn !== false ? [{ desc: 'Septic tank with soakaway pit, including excavation, concrete, blockwork and covers', unit: 'No.', qty: 1, rate: R.septic, key: 'septic' }] : []),
          ...(p.svcBorehole ? [{ desc: 'Borehole with submersible pump, control panel and storage', unit: 'Item', qty: 1, rate: R.borehole, key: 'borehole' }] : [])
        ]
      });
    }

    if (p.svcHVAC || p.svcFire) {
      const mech = [];
      if (p.svcHVAC) mech.push({ desc: 'Split air-conditioning units with trunking, drainage and electrical connection', unit: 'No.', qty: Math.max(2, ((m.rooms || []).filter(r => ['office', 'shop', 'living', 'reception'].includes(r.type)).length || 2)), rate: R.hvac, key: 'hvac' });
      if (p.svcFire) mech.push({ desc: 'Fire detection and alarm system, including smoke detectors, call points and panel', unit: 'Item', qty: 1, rate: R.fire, key: 'fire' });
      works.push({ code: 'BILL No. 13', title: 'MECHANICAL SERVICES', items: mech });
    }

    works.push({
      code: 'BILL No. 14', title: 'EXTERNAL WORKS AND ANCILLARIES',
      items: [
        { desc: 'Concrete apron ' + mm(+p.apronW || 1.2) + ' mm wide x 100 mm thick, A142 mesh, brushed finish, to building perimeter', unit: 'm2', qty: q(m.apron), rate: R.apron, key: 'apron' },
        { desc: 'Concrete entrance steps, 4 risers, with handrail', unit: 'No.', qty: p.storeys > 1 ? 2 : 1, rate: R.steps, key: 'steps' },
        { desc: 'Precast concrete drainage channel with grating along front of building', unit: 'm', qty: q(p.bW + 2), rate: R.drain, key: 'drain' },
        { desc: 'Site levelling, filling and grassing around the building', unit: 'm2', qty: q(g.footprint * 2.2), rate: R.levelling, key: 'levelling' },
        ...(p.boundaryOn ? [
          { desc: 'Boundary wall in sandcrete blocks with coping, 2.4 m high', unit: 'm', qty: 60, rate: R.boundary, key: 'boundary' },
          { desc: 'Steel entrance gate with posts and ironmongery', unit: 'No.', qty: 1, rate: R.gate, key: 'gate' }
        ] : []),
        { desc: 'Landscaping, driveway and site reinstatement', unit: 'Item', qty: 1,
          rate: p.buildingType === 'domestic' ? Math.round(R.landscaping * 0.6) : R.landscaping, key: 'landscaping' }
      ]
    });

    /* ----------------------------------------------------------------
       BILLS 15 AND 16 — THE MANHOLES AND THE DRAIN
       The drain comes out of Bill 12: without sanitary fittings there is
       no foul run to take off, so the two bills travel with the plumbing.
       ---------------------------------------------------------------- */
    if (p.svcPlumbing) {
      works.push({
        code: 'BILL No. 15', title: 'MANHOLE WORKS',
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
      works.push({
        code: 'BILL No. 16', title: 'DRAINAGE WORKS',
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
    }

    // apply overheads & profit uplift to measured works
    const billed = bills.concat(works);
    billed.forEach(b => {
      if (b.code === 'BILL No. 1') {
        b.items.forEach(it => { it.amount = Math.round(it.qty * it.rate * 100) / 100; });
      } else {
        b.items.forEach(it => {
          const r = Math.round(it.rate * f * 100) / 100;
          it.baseRate = it.rate;
          it.rate = r;
          it.amount = Math.round(it.qty * r * 100) / 100;
        });
      }
      b.total = Math.round(b.items.reduce((s, it) => s + it.amount, 0) * 100) / 100;
    });

    // preliminaries are a target percentage of the measured works: the fixed
    // site-establishment items count towards it, the balance is added
    const worksSum = billed.filter(b => b.code !== 'BILL No. 1').reduce((s, b) => s + b.total, 0);
    const fixedPrelim = billed[0].items.reduce((s, it) => s + it.amount, 0);
    const target = worksSum * p.prelimPct / 100;
    if (target > fixedPrelim) {
      const add = Math.round((target - fixedPrelim) * 100) / 100;
      billed[0].items.push({
        desc: 'Additional preliminaries, site establishment and attendance, to bring preliminaries to '
          + p.prelimPct + '% of the measured works',
        unit: 'Item', qty: 1, rate: add, amount: add
      });
    }
    billed[0].total = Math.round(billed[0].items.reduce((s, it) => s + it.amount, 0) * 100) / 100;

    /* the component schedule points at the bill row that prices it, and takes
       that row's measured quantity, so the two always agree */
    const byKey = {};
    billed.forEach(b => b.items.forEach(it => {
      if (it.key && !byKey[it.key]) byKey[it.key] = { bill: b.code, item: it };
    }));
    (m.components || []).forEach(c => {
      const hit = byKey[c.key];
      if (!hit) return;
      c.bill = hit.bill;
      if (String(c.unit).toLowerCase() === String(hit.item.unit).toLowerCase()) {
        c.qty = hit.item.qty;
        c.unit = hit.item.unit;
      }
    });

    const subtotal = Math.round(billed.reduce((s, b) => s + b.total, 0) * 100) / 100;
    const contingency = Math.round(subtotal * p.contingency) / 100;
    const vat = Math.round((subtotal + contingency) * (p.vatPct || 0) / 100 * 100) / 100;
    const grand = Math.round((subtotal + contingency + vat) * 100) / 100;

    m.g.GFA = m.GFA;
    m.p.blockTotal = m.blockTotal; m.p.blocks = m.blocks;
    m.p.concTotal = m.concTotal; m.p.rebar = m.rebar;

    return {
      params: p, model: m, bills: billed, subtotal, contingency, vat: vat, grand,
      perM2: Math.round(grand / Math.max(1, m.grossArea) * 100) / 100,
      rooms: (p.rooms || []).map(r => ({ name: (r.name || r.type) + ((r.n || 1) > 1 ? ' ×' + r.n : ''), type: r.type, L: r.L, W: r.W })),
      GFA: m.grossArea,
      netArea: m.GFA,
      basis: [
        ['Building type', p.buildingType],
        ['Storeys', p.storeys],
        ['Floor to floor height', p.floorH + ' m'],
        ['Eaves height (from sections)', m.g.eaves.toFixed(2) + ' m'],
        ['Ridge height above eaves', m.g.ridge.toFixed(2) + ' m'],
        ['Foundation depth', p.foundDepth + ' m'],
        ['Roof', RoofGeom.label(p.roofType) + (RoofGeom.norm(p.roofType) === 'flat' ? '' : ' at ' + p.roofPitch + '°')],
        ['Wall thickness', Math.round(p.wallT * 1000) + ' mm'],
        ['Overheads and profit', p.opProfitPct + '%'],
        ['Preliminaries', p.prelimPct + '% of measured works'],
        ['Contingency', p.contingency + '%']
      ]
    };
  }

  root.GenEngine = { DEFAULTS, RATES, ROOM_TYPES, COUNTRIES, FLOOR_FINISH, CEILING_FINISH,
                     currency: byCountry, merge, measure, buildBill, geometry };
})(typeof window !== 'undefined' ? window : globalThis);
