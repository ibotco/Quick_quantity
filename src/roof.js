/* Quick Quantity — the roof, cut four ways.
   Every roof type covers the same plan: the building plus the eaves overhang.
   What changes is how that plan is cut up — the ridge, the hips, the barges,
   the high edge of a mono-pitch — and how much sheet it takes: a pitched roof
   covers its plan divided by the cosine of its pitch, a flat roof covers the
   plan itself. One module, used by both engines and by the roof plan panel, so
   the bill, the take-off and the drawing always agree. */
(function (root) {
  'use strict';

  const D2R = Math.PI / 180;

  /* the four types, in the order the panel offers them */
  const TYPES = [
    ['gable', 'Gabled — two slopes to a ridge'],
    ['hip', 'Hipped — four slopes, no gable ends'],
    ['cross', 'Cross-hipped — wings, valleys, more than one ridge'],
    ['mono', 'Mono-pitch — one slope to a high wall'],
    ['flat', 'Flat — roof slab and parapet']
  ];

  /* what each type brings with it when it is chosen */
  const DEFAULT_PITCH = { gable: 22, hip: 22, cross: 10, mono: 10, flat: 0 };
  const DEFAULT_OVERHANG = { gable: 0.6, hip: 0.6, cross: 0.6, mono: 0.45, flat: 0.45 };
  const DEFAULT_PARAPET = { gable: 0.9, hip: 0.9, cross: 0.9, mono: 0.9, flat: 0.9 };
  /* members at centres, in millimetres — trussed roofs at 1,200 mm, purlins at
     900 mm, which is what the bills have always assumed; a drawing that says
     otherwise is typed in */
  const DEFAULT_RAFTER = 1200, DEFAULT_PURLIN = 900;

  /* 'pitched' is what the first releases called a gable roof */
  function norm(t) {
    if (t === 'pitched' || t === 'gabled') return 'gable';
    if (t === 'hipped') return 'hip';
    if (t === 'crosshipped' || t === 'multihip' || t === 'cross-gable' || t === 'crossgable') return 'cross';
    if (t === 'monopitch' || t === 'lean-to' || t === 'shed') return 'mono';
    return TYPES.some(x => x[0] === t) ? t : 'gable';
  }
  const isPitched = t => norm(t) !== 'flat';
  const label = t => (TYPES.find(x => x[0] === norm(t)) || TYPES[0])[1];
  const short = t => ({ gable: 'Gabled', hip: 'Hipped', cross: 'Cross-hipped', mono: 'Mono-pitch', flat: 'Flat' })[norm(t)];

  function measure(o) {
    o = o || {};
    const type = norm(o.type);
    const flat = type === 'flat';
    const pitch = flat ? 0 : Math.max(0, Math.min(60, +o.pitch || 0));
    const rad = pitch * D2R, cos = Math.cos(rad) || 1, tan = Math.tan(rad);
    const W = Math.max(0, +o.W || 0), D = Math.max(0, +o.D || 0);
    const ov = Math.max(0, +o.overhang || 0);

    /* the plan the roof covers, overhang included. An L-shaped building passes
       its own plan area in: the ridge and the barges still come off the main
       rectangle, but the sheets are measured over the plan that is really there */
    const planW = W + 2 * ov, planD = D + 2 * ov;
    const planArea = (o.planArea != null && +o.planArea > 0) ? +o.planArea : planW * planD;
    /* which way the roof falls: the ridge runs along the length by default,
       and a mono-pitch falls away from the high wall the user has chosen */
    const ridgeDir = o.ridge === 'width' ? 'width' : 'length';
    const high = ['front', 'back', 'left', 'right'].indexOf(o.high) >= 0 ? o.high : 'front';
    let span, long;
    if (type === 'mono') {
      const acrossDepth = (high === 'front' || high === 'back');
      span = acrossDepth ? planD : planW;
      long = acrossDepth ? planW : planD;
    } else if (ridgeDir === 'width') {
      span = planW; long = planD;
    } else {
      span = planD; long = planW;
    }
    const perimeter = 2 * (planW + planD);
    const ps = ['all', 'frontBack', 'sides', 'none'].indexOf(o.parapetSides) >= 0 ? o.parapetSides : 'all';
    const parapetL = ps === 'none' ? 0 : ps === 'frontBack' ? 2 * planW : ps === 'sides' ? 2 * planD : perimeter;

    /* the height the roof rises: half the span for a ridge, all of it for a slope */
    const rise = flat ? 0 : (type === 'mono' ? span * tan : (span / 2) * tan);
    const slopeArea = flat ? planArea : planArea / cos;

    /* the members at centres, from the drawing where it says */
    const rafterC = Math.max(300, +o.rafterC || DEFAULT_RAFTER);
    const purlinC = Math.max(200, +o.purlinC || DEFAULT_PURLIN);

    /* the lines that are priced by the metre */
    let ridge = 0, hips = 0, barges = 0, eaves = 0, highEdge = 0, valleys = 0;
    if (type === 'gable') {
      ridge = long;                       // the full length, verge to verge
      eaves = 2 * long;                   // the two long eaves
      barges = 2 * span / cos;            // two sloping edges at each gable end
    } else if (type === 'hip' || type === 'cross') {
      ridge = Math.max(0, long - span);   // the ridge shortens by the span
      hips = 2 * span / cos;              // one hip line at each corner
      eaves = perimeter;                  // fascia runs all the way round
      if (type === 'cross') {
        /* a roof that turns a corner has more ridge, more hips and a valley at
           every re-entrant angle. The three lengths are the user's: measured on
           their own roof plan and typed in, or left as the plain-hip figure */
        hips = hips * 2;                             // both ends of every wing
        ridge = Math.max(0, long - span) + span;     // the cross ridges run out to the wings
        valleys = 2 * span / cos;                    // re-entrant angles come in pairs
        if (+o.ridgeL > 0) ridge = +o.ridgeL;
        if (+o.hipL > 0) hips = +o.hipL;
        if (o.valleyL != null && o.valleyL !== '' && +o.valleyL >= 0) valleys = +o.valleyL;
      }
    } else if (type === 'mono') {
      ridge = 0;
      highEdge = long;                    // the top edge sits against the high wall
      eaves = long;                       // one eaves line, at the low side
      barges = 2 * span / cos;            // one sloping edge at each end
    } else {
      eaves = perimeter;                  // flat: trim round the slab
    }

    const trusses = flat ? 0 : Math.ceil(long / (rafterC / 1000)) + 1;
    const covering = slopeArea * (flat ? 1.05 : 1.10);   // laps / upstands
    const purlins = flat ? 0 : slopeArea / (purlinC / 1000);

    return {
      type, flat, pitch, planW, planD, planArea, slopeArea, span, long,
      perimeter, parapetL, parapetSides: ps, ridgeDir, high, rafterC, purlinC,
      rise, ridge, hips, valleys, barges, eaves, highEdge,
      trusses, covering, purlins
    };
  }

  const api = { TYPES, DEFAULT_PITCH, DEFAULT_OVERHANG, DEFAULT_PARAPET, norm, isPitched, label, short, measure };
  root.RoofGeom = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
