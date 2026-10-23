/* =====================================================================
   SETTINGS MENU · VERTICALS (sections & elevations) · ROOM SCHEDULE
   ===================================================================== */
(function (root) {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  const ROOM_PRESETS = {
    domestic: ['living', 'bedroom', 'kitchen', 'bath', 'wc', 'corridor', 'porch', 'store', 'dining', 'hall', 'garage', 'stair'],
    commercial: ['office', 'shop', 'reception', 'store', 'wc', 'corridor', 'stair', 'garage'],
    educational: ['classroom', 'office', 'store', 'wc', 'corridor', 'porch'],
    health: ['ward', 'office', 'reception', 'wc', 'store', 'corridor'],
    religious: ['auditorium', 'sanctuary', 'vestry', 'choir', 'foyer', 'office', 'wc', 'store', 'corridor']
  };

  const PRESETS = [
    {
      label: 'Domestic · 3-bedroom bungalow (Accra standard)',
      params: {
        buildingType: 'domestic', projectName: 'Proposed 3-Bedroom Bungalow', projectSub: 'with porch, kitchen and 2 bathrooms',
        bW: 13.2, bD: 9.6, storeys: 1, floorH: 3.0, wallH: 2.9, plinth: 0.45, foundDepth: 1.2,
        wallT: 0.15, foundType: 'strip', roofType: 'pitched', roofPitch: 22, overhang: 0.6,
        floorMain: 'tiles', ceilingType: 'pvc', externalFinish: 'render',
        svcElectrical: true, svcPlumbing: true, svcHVAC: false, svcSolar: false,
        rooms: [
          { name: 'Living room', type: 'living', L: 5.4, W: 4.2, n: 1 },
          { name: 'Dining', type: 'dining', L: 3.6, W: 3.0, n: 1 },
          { name: 'Kitchen', type: 'kitchen', L: 3.2, W: 2.8, n: 1 },
          { name: 'Master bedroom', type: 'bedroom', L: 4.2, W: 3.6, n: 1 },
          { name: 'Bedroom 2', type: 'bedroom', L: 3.6, W: 3.3, n: 1 },
          { name: 'Bedroom 3', type: 'bedroom', L: 3.3, W: 3.0, n: 1 },
          { name: 'Bathroom', type: 'bath', L: 2.4, W: 2.0, n: 2 },
          { name: 'Corridor', type: 'corridor', L: 7.2, W: 1.5, n: 1 },
          { name: 'Entrance hall', type: 'hall', L: 2.4, W: 1.8, n: 1 },
          { name: 'Store / laundry', type: 'store', L: 2.2, W: 1.8, n: 1 },
          { name: 'Porch', type: 'porch', L: 3.6, W: 1.8, n: 1 }
        ],
        doors: [
          { ref: 'D1', desc: '900 x 2,100 mm hardwood panel door with frame, architrave and lockset, to entrance', w: 0.9, h: 2.1, n: 1, wall: 'ext', rate: 2400 },
          { ref: 'D2', desc: '900 x 2,100 mm flush door with hardwood frame, to bedrooms', w: 0.9, h: 2.1, n: 4, wall: 'int', rate: 1850 },
          { ref: 'D3', desc: '750 x 2,100 mm waterproof flush door, to bathrooms', w: 0.75, h: 2.1, n: 2, wall: 'int', rate: 1650 }
        ],
        windows: [
          { ref: 'W1', desc: '1,800 x 1,200 mm aluminium sliding window with glazing and burglar bars', w: 1.8, h: 1.2, n: 6, wall: 'ext', rate: 2650 },
          { ref: 'W2', desc: '1,200 x 1,200 mm aluminium sliding window with glazing and burglar bars', w: 1.2, h: 1.2, n: 3, wall: 'ext', rate: 1950 },
          { ref: 'W3', desc: '600 x 600 mm louvre window with glass blades, to bathrooms', w: 0.6, h: 0.6, n: 2, wall: 'ext', rate: 980 }
        ]
      }
    },
    {
      label: 'Domestic · 4-bedroom two-storey house',
      params: {
        buildingType: 'domestic', projectName: 'Proposed 4-Bedroom Two-Storey House', projectSub: 'with double garage and balcony',
        bW: 13.5, bD: 10.5, storeys: 2, floorH: 3.1, wallH: 3.0, plinth: 0.45, foundDepth: 1.5,
        wallT: 0.225, foundType: 'strip', roofType: 'pitched', roofPitch: 24, overhang: 0.6,
        floorMain: 'tiles', ceilingType: 'plasterboard',
        rooms: [
          { name: 'Living room', type: 'living', L: 5.4, W: 4.5, n: 1 },
          { name: 'Dining', type: 'dining', L: 4.2, W: 3.6, n: 1 },
          { name: 'Kitchen', type: 'kitchen', L: 3.6, W: 3.0, n: 1 },
          { name: 'Study', type: 'study', L: 3.0, W: 2.7, n: 1 },
          { name: 'Bedroom 4', type: 'bedroom', L: 4.2, W: 3.6, n: 1 },
          { name: 'Bathroom (ground)', type: 'bath', L: 2.6, W: 2.0, n: 1 },
          { name: 'Double garage', type: 'garage', L: 5.4, W: 3.6, n: 1 },
          { name: 'Corridor (ground)', type: 'corridor', L: 8.4, W: 1.8, n: 1 },
          { name: 'Staircase', type: 'stair', L: 3.0, W: 2.4, n: 1 },
          { name: 'Store', type: 'store', L: 2.4, W: 1.8, n: 1 },
          { name: 'Laundry', type: 'laundry', L: 2.4, W: 2.0, n: 1 },
          { name: 'Porch', type: 'porch', L: 3.0, W: 1.8, n: 1 },
          { name: 'Master bedroom', type: 'bedroom', L: 4.8, W: 4.2, n: 1 },
          { name: 'Bedroom 2', type: 'bedroom', L: 4.2, W: 3.9, n: 1 },
          { name: 'Bedroom 3', type: 'bedroom', L: 3.9, W: 3.6, n: 1 },
          { name: 'Family room', type: 'living', L: 4.2, W: 3.6, n: 1 },
          { name: 'Bathroom (upper)', type: 'bath', L: 2.8, W: 2.2, n: 2 },
          { name: 'Corridor (upper)', type: 'corridor', L: 8.4, W: 1.8, n: 1 },
          { name: 'Staircase (upper)', type: 'stair', L: 3.0, W: 2.4, n: 1 },
          { name: 'Balcony', type: 'balcony', L: 4.8, W: 1.8, n: 1 }
        ],
        doors: [], windows: []
      }
    },
    {
      label: 'Commercial · two-storey office / shop building',
      params: {
        buildingType: 'commercial', boundaryOn: true, projectName: 'Proposed Two-Storey Office and Shop Building', projectSub: 'with lettable retail on ground floor',
        bW: 18.0, bD: 12.0, storeys: 2, floorH: 3.6, wallH: 3.2, plinth: 0.6, foundDepth: 1.6,
        wallT: 0.225, foundType: 'raft', roofType: 'flat', roofPitch: 0, overhang: 0.6, parapet: 0.9,
        floorMain: 'tiles', ceilingType: 'plasterboard', externalFinish: 'cladding',
        svcElectrical: true, svcPlumbing: true, svcHVAC: true, svcFire: true,
        rooms: [
          { name: 'Reception', type: 'reception', L: 5.4, W: 4.2, n: 1 },
          { name: 'Open office (ground)', type: 'office', L: 8.4, W: 6.0, n: 1 },
          { name: 'Shop / retail', type: 'shop', L: 6.0, W: 4.8, n: 1 },
          { name: 'Manager office', type: 'office', L: 4.2, W: 3.6, n: 1 },
          { name: 'Meeting room', type: 'office', L: 4.8, W: 3.6, n: 1 },
          { name: 'Store', type: 'store', L: 3.0, W: 2.4, n: 1 },
          { name: 'WC', type: 'wc', L: 2.4, W: 2.0, n: 2 },
          { name: 'Corridor (ground)', type: 'corridor', L: 12.0, W: 2.0, n: 1 },
          { name: 'Staircase', type: 'stair', L: 3.0, W: 2.4, n: 1 },
          { name: 'Lobby', type: 'hall', L: 4.2, W: 3.0, n: 1 },
          { name: 'Open office (upper)', type: 'office', L: 9.0, W: 6.0, n: 1 },
          { name: 'Office 2', type: 'office', L: 4.2, W: 3.6, n: 1 },
          { name: 'Office 3', type: 'office', L: 4.2, W: 3.6, n: 1 },
          { name: 'Boardroom', type: 'office', L: 5.4, W: 4.2, n: 1 },
          { name: 'Kitchenette', type: 'kitchen', L: 3.0, W: 2.4, n: 1 },
          { name: 'WC (upper)', type: 'wc', L: 2.4, W: 2.0, n: 2 },
          { name: 'Server room', type: 'store', L: 2.4, W: 2.0, n: 1 },
          { name: 'Corridor (upper)', type: 'corridor', L: 12.0, W: 2.0, n: 1 },
          { name: 'Staircase (upper)', type: 'stair', L: 3.0, W: 2.4, n: 1 },
          { name: 'Balcony', type: 'balcony', L: 4.8, W: 1.8, n: 1 }
        ],
        doors: [
          { ref: 'D1', desc: '1,800 x 2,400 mm double-leaf aluminium framed glass entrance door with closers', w: 1.8, h: 2.4, n: 1, wall: 'ext', rate: 6800 },
          { ref: 'D2', desc: '900 x 2,100 mm solid core flush door with hardwood frame and architrave', w: 0.9, h: 2.1, n: 6, wall: 'int', rate: 1950 },
          { ref: 'D3', desc: '750 x 2,100 mm waterproof flush door to washrooms', w: 0.75, h: 2.1, n: 4, wall: 'int', rate: 1750 },
          { ref: 'D4', desc: '3,000 x 2,400 mm galvanised roller shutter to shop front', w: 3.0, h: 2.4, n: 1, wall: 'ext', rate: 7500 }
        ],
        windows: [
          { ref: 'W1', desc: '1,800 x 1,500 mm aluminium sliding window, 6 mm glazing and burglar bars', w: 1.8, h: 1.5, n: 12, wall: 'ext', rate: 2950 },
          { ref: 'W2', desc: '1,200 x 1,500 mm aluminium sliding window with glazing', w: 1.2, h: 1.5, n: 6, wall: 'ext', rate: 2250 },
          { ref: 'W3', desc: '600 x 600 mm louvre window with glass blades to washrooms', w: 0.6, h: 0.6, n: 4, wall: 'ext', rate: 980 },
          { ref: 'W4', desc: '2,400 x 2,400 mm aluminium curtain wall to entrance elevation', w: 2.4, h: 2.4, n: 2, wall: 'ext', rate: 12500 }
        ]
      }
    },
    {
      label: 'Commercial · single-storey shop / clinic shell',
      params: {
        buildingType: 'commercial', boundaryOn: true, projectName: 'Proposed Single-Storey Commercial Building', projectSub: 'shop, offices and washrooms',
        bW: 15.0, bD: 10.0, storeys: 1, floorH: 3.2, wallH: 3.0, plinth: 0.45, foundDepth: 1.2,
        wallT: 0.225, foundType: 'strip', roofType: 'pitched', roofPitch: 18, overhang: 0.6,
        floorMain: 'tiles', ceilingType: 'pvc', externalFinish: 'render',
        svcElectrical: true, svcPlumbing: true, svcHVAC: false, svcFire: true,
        rooms: [
          { name: 'Shop / sales floor', type: 'shop', L: 6.0, W: 7.5, n: 1 },
          { name: 'Office / rear room', type: 'office', L: 4.5, W: 3.6, n: 1 },
          { name: 'Store', type: 'store', L: 3.0, W: 2.4, n: 1 },
          { name: 'Staff room', type: 'office', L: 4.2, W: 3.3, n: 1 },
          { name: 'WC', type: 'wc', L: 2.4, W: 2.0, n: 2 },
          { name: 'Kitchenette', type: 'kitchen', L: 2.7, W: 2.4, n: 1 },
          { name: 'Corridor', type: 'corridor', L: 7.5, W: 1.8, n: 1 }
        ],
        doors: [
          { ref: 'D1', desc: '3,600 x 2,400 mm galvanised roller shutter to shop front', w: 3.6, h: 2.4, n: 1, wall: 'ext', rate: 8600 },
          { ref: 'D2', desc: '1,800 x 2,400 mm double-leaf aluminium framed glass entrance door', w: 1.8, h: 2.4, n: 1, wall: 'ext', rate: 6800 },
          { ref: 'D3', desc: '900 x 2,100 mm solid core flush door with hardwood frame', w: 0.9, h: 2.1, n: 4, wall: 'int', rate: 1950 },
          { ref: 'D4', desc: '750 x 2,100 mm waterproof flush door to washrooms', w: 0.75, h: 2.1, n: 2, wall: 'int', rate: 1750 }
        ],
        windows: [
          { ref: 'W1', desc: '1,800 x 1,500 mm aluminium sliding window with glazing and burglar bars', w: 1.8, h: 1.5, n: 6, wall: 'ext', rate: 2950 },
          { ref: 'W2', desc: '1,200 x 1,500 mm aluminium sliding window with glazing', w: 1.2, h: 1.5, n: 3, wall: 'ext', rate: 2250 },
          { ref: 'W3', desc: '600 x 600 mm louvre window to washrooms', w: 0.6, h: 0.6, n: 2, wall: 'ext', rate: 980 }
        ]
      }
    },
    {
      label: 'Health · single-storey CHPS compound / clinic',
      params: {
        buildingType: 'health', projectName: 'Proposed CHPS Compound', projectSub: 'with consulting rooms, ward, treatment room and washrooms',
        bW: 16.5, bD: 8.4, storeys: 1, floorH: 3.1, wallH: 2.95, plinth: 0.45,
        foundDepth: 1.1, wallT: 0.15, foundType: 'strip',
        roofType: 'pitched', roofPitch: 20, overhang: 0.75,
        floorMain: 'tiles', ceilingType: 'pvc', externalFinish: 'render',
        svcElectrical: true, svcPlumbing: true, svcHVAC: false, svcSolar: true,
        rooms: [
          { name: 'Ward', type: 'ward', L: 6.0, W: 4.2, n: 1 },
          { name: 'Consulting room 1', type: 'office', L: 3.6, W: 3.3, n: 1 },
          { name: 'Consulting room 2', type: 'office', L: 3.6, W: 3.3, n: 1 },
          { name: 'Treatment room', type: 'office', L: 3.3, W: 3.0, n: 1 },
          { name: 'Reception / waiting', type: 'reception', L: 5.0, W: 3.6, n: 1 },
          { name: 'Drug store', type: 'store', L: 2.4, W: 2.0, n: 1 },
          { name: 'WC (staff)', type: 'wc', L: 2.0, W: 1.6, n: 1 },
          { name: 'WC (patients)', type: 'wc', L: 2.2, W: 1.8, n: 1 },
          { name: 'Utility', type: 'store', L: 2.4, W: 2.0, n: 1 },
          { name: 'Corridor / verandah', type: 'corridor', L: 12.0, W: 1.8, n: 1 }
        ],
        doors: [
          { ref: 'D1', desc: '1,200 x 2,100 mm double-leaf hardwood door to main entrance', w: 1.2, h: 2.1, n: 1, wall: 'ext', rate: 3800 },
          { ref: 'D2', desc: '900 x 2,100 mm flush door with hardwood frame, to rooms', w: 0.9, h: 2.1, n: 8, wall: 'int', rate: 1950 },
          { ref: 'D3', desc: '750 x 2,100 mm waterproof flush door to washrooms', w: 0.75, h: 2.1, n: 2, wall: 'int', rate: 1750 }
        ],
        windows: [
          { ref: 'W1', desc: '1,800 x 1,200 mm aluminium sliding window with glazing and burglar bars', w: 1.8, h: 1.2, n: 10, wall: 'ext', rate: 2650 },
          { ref: 'W2', desc: '600 x 600 mm louvre window with glass blades to washrooms', w: 0.6, h: 0.6, n: 3, wall: 'ext', rate: 980 }
        ]
      }
    },
    {
      label: 'Religious · church auditorium, vestry and offices',
      params: {
        buildingType: 'religious', boundaryOn: true,
        projectName: 'Proposed Church Building', projectSub: 'auditorium, sanctuary, vestry, choir room and offices',
        bW: 24.0, bD: 15.0, storeys: 1, floorH: 5.6, wallH: 5.3, plinth: 0.6, foundDepth: 1.3,
        wallT: 0.225, foundType: 'strip', roofType: 'pitched', roofPitch: 25, overhang: 0.75,
        floorMain: 'terrazzo', ceilingType: 'pop', externalFinish: 'render',
        svcElectrical: true, svcPlumbing: true, svcHVAC: true, svcSolar: false,
        rooms: [
          { name: 'Auditorium', type: 'auditorium', L: 16.0, W: 12.0, n: 1 },
          { name: 'Sanctuary / platform', type: 'sanctuary', L: 8.0, W: 4.0, n: 1 },
          { name: 'Foyer / entrance porch', type: 'foyer', L: 6.0, W: 4.0, n: 1 },
          { name: 'Vestry', type: 'vestry', L: 4.0, W: 3.5, n: 1 },
          { name: 'Choir room', type: 'choir', L: 4.0, W: 3.5, n: 1 },
          { name: "Pastor's office", type: 'office', L: 4.0, W: 3.3, n: 1 },
          { name: "Ushers' room", type: 'store', L: 3.0, W: 3.0, n: 1 },
          { name: 'Store', type: 'store', L: 2.5, W: 2.0, n: 1 },
          { name: 'WC (men)', type: 'wc', L: 4.0, W: 2.2, n: 1 },
          { name: 'WC (women)', type: 'wc', L: 3.0, W: 2.2, n: 1 },
          { name: 'Corridor / link', type: 'corridor', L: 6.0, W: 2.0, n: 1 }
        ],
        doors: [
          { ref: 'D1', desc: '1,800 x 2,400 mm double-leaf hardwood panelled door to main entrance', w: 1.8, h: 2.4, n: 2, wall: 'ext', rate: 7200 },
          { ref: 'D2', desc: '1,500 x 2,400 mm double-leaf hardwood door to side entrances', w: 1.5, h: 2.4, n: 2, wall: 'ext', rate: 5800 },
          { ref: 'D3', desc: '900 x 2,100 mm flush door with hardwood frame, to vestry, office and store', w: 0.9, h: 2.1, n: 8, wall: 'int', rate: 1950 },
          { ref: 'D4', desc: '750 x 2,100 mm waterproof flush door to washrooms', w: 0.75, h: 2.1, n: 2, wall: 'int', rate: 1750 }
        ],
        windows: [
          { ref: 'W1', desc: '1,800 x 1,500 mm aluminium sliding window with glazing and burglar bars', w: 1.8, h: 1.5, n: 12, wall: 'ext', rate: 2950 },
          { ref: 'W2', desc: '1,200 x 1,500 mm aluminium sliding window with glazing and burglar bars', w: 1.2, h: 1.5, n: 6, wall: 'ext', rate: 2250 },
          { ref: 'W3', desc: '600 x 600 mm louvre window with glass blades to washrooms', w: 0.6, h: 0.6, n: 4, wall: 'ext', rate: 980 }
        ]
      }
    },
    {
      label: 'Educational · 3-room GES block (PS 1)',
      params: { template: 'school' }
    }
  ];

  /* The layouts that belong to one building type. The plan library on the
     Building model step, the room schedule here and the measurement template
     all read from this, so the building type chosen under "Read the drawing"
     re-cuts every one of those lists rather than leaving a school layout
     sitting in a commercial bill. */
  function presetsForType(type) {
    const t = type || 'domestic';
    const all = PRESETS.map((x, i) => ({ x: x, i: i }));
    return t === 'educational'
      ? all.filter(o => o.x.params.template === 'school')
      : all.filter(o => o.x.params.template !== 'school' && (o.x.params.buildingType || 'domestic') === t);
  }

  // index of the typical layout for a building type (school = last)
  function presetFor(type, tpl, storeys) {
    if (tpl === 'school' || type === 'educational')
      return PRESETS.findIndex(x => x.params.template === 'school');
    const cands = PRESETS.map((x, i) => ({ x: x, i: i }))
      .filter(o => o.x.params.template !== 'school' && o.x.params.buildingType === type);
    if (!cands.length) return -1;
    if (storeys) {
      const hit = cands.find(o => (+o.x.params.storeys || 1) === +storeys);
      if (hit) return hit.i;
    }
    return cands[0].i;
  }

  /* ================================================================
     SETTINGS MODAL
     ================================================================ */
  /* The finish menus are built from the engine's own tables, so a type that
     can be picked is always a type that can be priced and described. */
  const finOpts = () => (root.GenEngine && GenEngine.FLOOR_FINISH)
    ? Object.keys(GenEngine.FLOOR_FINISH).map(k => [k, GenEngine.FLOOR_FINISH[k].label]) : [['tiles', 'Ceramic tiles']];
  const wetOpts = () => ['tiles', 'porcelain', 'terrazzo', 'granite', 'epoxy']
    .filter(k => !GenEngine.FLOOR_FINISH || GenEngine.FLOOR_FINISH[k])
    .map(k => [k, GenEngine.FLOOR_FINISH ? GenEngine.FLOOR_FINISH[k].label : k]);
  const ceilOpts = () => (root.GenEngine && GenEngine.CEILING_FINISH)
    ? Object.keys(GenEngine.CEILING_FINISH).map(k => [k, GenEngine.CEILING_FINISH[k].label]) : [['pvc', 'PVC boards']];

  /* the template is decided by the building type — a school block is measured
     with the GES template and everything else with the general one — so the
     menu offers the one that applies and keeps the other visible but shut */
  function templateOptions(p) {
    const school = (p.template || 'school') === 'school' || p.buildingType === 'educational';
    const row = (on, v, label) => [v, label + (on ? '' : ' \u2014 not used for this building type'), on ? '' : 'off'];
    return school
      ? [row(false, 'general', 'General building (rooms, storeys, sections)'),
         row(true, 'school', 'Ghana school block (rooms & verandah)')]
      : [row(true, 'general', 'General building (rooms, storeys, sections)'),
         row(false, 'school', 'Ghana school block (rooms & verandah)')];
  }

  function field(label, key, type, opts) {
    opts = opts || {};
    const v = opts.value;
    const A = opts.attr || 'data-set';
    if (type === 'select') {
      return `<div class="field"><label>${esc(label)}</label>
        <select ${A}="${esc(key)}">${opts.options.map(o => {
          const [val, text] = Array.isArray(o) ? o : [o, o];
          const off = Array.isArray(o) && o[2] === 'off';
          return `<option value="${esc(val)}"${String(v) === String(val) ? ' selected' : ''}${off ? ' disabled' : ''}>${esc(text)}</option>`;
        }).join('')}</select></div>`;
    }
    if (type === 'check') {
      return `<label class="check"><input type="checkbox" ${A}="${esc(key)}" ${v ? 'checked' : ''}>
        <span>${esc(label)}</span></label>`;
    }
    if (type === 'password') {
      return `<div class="field"><label>${esc(label)}</label>
        <input type="password" ${A}="${esc(key)}" value="${esc(v == null ? '' : v)}" placeholder="${esc(opts.placeholder || '')}" autocomplete="off"></div>`;
    }
    if (type === 'text') {
      return `<div class="field"><label>${esc(label)}</label>
        <input type="text" ${A}="${esc(key)}" value="${esc(v == null ? '' : v)}" placeholder="${esc(opts.placeholder || '')}"></div>`;
    }
    return `<div class="field"><label>${esc(label)}</label>
      <input type="number" ${A}="${esc(key)}" step="${opts.step || '0.1'}" min="${opts.min || 0}" value="${v == null ? '' : v}"></div>`;
  }


  /* ================================================================
     RATE BUILD-UP / PRICE ANALYSIS — generated from the drawing
     ================================================================ */
  let rbMk = 1;   // grand total / measured subtotal — contingency and VAT
  const rbShort = (s, n) => {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1).replace(/[,;:\s]+$/, '') + '…' : s;
  };
  const rbMoney = (p, v) => (p.curSymbol || '\u00a2') === '\u00a2'
    ? 'GH\u00a2 ' + Number(v).toFixed(2) : (p.curSymbol || '') + Number(v).toFixed(2);

  function rbStatus(p, entries) {
    const n = (entries || []).filter(e => p && p.rb && p.rb.adopted && p.rb.adopted[e.key]).length;
    return n ? n + ' of ' + entries.length + ' build-ups adopted into the bill'
             : 'No build-up has been adopted — the bill still carries its own rates';
  }

  const rbNum = v => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function rbSummary(p, entries) {
    if (!entries.length) return 'No priced items — measure a drawing first.';
    const measured = entries.reduce((s, e) => s + e.amount, 0);
    let works = 0;
    entries.forEach(e => { const c = RateBuild.compute(p, e); if (c) works += (c.computed - e.rate) * e.qty; });
    const impact = works * rbMk;
    const pct = measured ? works / measured * 100 : 0;
    const sign = impact >= 0 ? '+' : '\u2212';
    const built = entries.filter(e => RateBuild.recipe(e.key));
    const builtAmt = built.reduce((s, e) => s + e.amount, 0);
    const cover = measured ? Math.round(builtAmt / measured * 100) : 0;
    return '<b>' + entries.length + '</b> priced rates generated from this drawing · measured ' +
      'GH\u00a2 ' + rbNum(measured) + ' · adopting every computed cost would move the bill by ' +
      '<b>' + sign + 'GH\u00a2 ' + rbNum(Math.abs(impact)) + ' (' + sign + Math.abs(pct).toFixed(2) + ' %)</b>' +
      ' · <b>' + built.length + ' of ' + entries.length + '</b> built from first principles' +
      (built.length !== entries.length ? ' (' + cover + ' % of the value); the rest are assessed splits' : '');
  }

  function rbCard(p, e) {
    const c = RateBuild.compute(p, e);
    const cur = p.curSymbol || 'GH\u00a2';
    const rows = c.lines.concat(c.labour).map(l => `<tr>
        <td>${esc(l.label)}${l.note ? ' <span class="hint">' + esc(l.note) + '</span>' : ''}</td>
        <td class="num" style="width:78px">${l.qty}</td>
        <td class="num" style="width:104px">${cur} ${Number(l.rate).toFixed(2)}</td>
        <td class="num" style="width:104px">${cur} ${l.amount.toFixed(2)}</td></tr>`).join('')
      + c.fixed.map(f => `<tr><td>${esc(f.label)}</td><td class="num">—</td><td class="num">—</td>
        <td class="num">${cur} ${f.amount.toFixed(2)}</td></tr>`).join('');

    const d = e.rate ? (c.computed - e.rate) / e.rate * 100 : 0;
    const ds = (d >= 0 ? '+' : '\u2212') + Math.abs(d).toFixed(1) + ' %';
    return `<details class="rb-card" data-rbcard="${esc(e.key)}" ${c.adopted ? 'open' : ''}>
      <summary class="rb-head">
        <span class="rb-bill">${esc(e.bill.replace('BILL No. ', 'Bill '))}</span>
        <b>${esc(rbShort(e.desc, 92))}</b>
        <span class="hint rb-q">${e.qty.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${esc(e.unit)}${e.items > 1 ? ' · ' + e.items + ' items' : ''}</span>
        <span class="rb-amt">${cur} ${rbNum(e.amount)}</span>
        ${c.adopted ? '<span class="rb-chip">adopted</span>' : ''}
        <span class="rb-compare"><span class="hint" data-rbrate0>${e.rate.toFixed(2)}</span> →
          <b data-rbhead="${esc(e.key)}">${c.computed.toFixed(2)}</b>
          <i class="${d >= 0 ? 'up' : 'down'}">${ds}</i></span>
      </summary>
      <div class="rb-body">
        ${c.spec ? `<p class="rb-spec"><b>Specification from the bill:</b> ${esc(c.spec.note)}</p>` : ''}
        ${c.assessed ? '<p class="hint rb-note">Proprietary item — the issued rate is split into supply and fix. Overwrite either amount with your own quotation.</p>' : ''}
        <table class="rb-table">
          <tbody>${rows}</tbody>
          <tfoot>
            <tr><td>Sub-total</td><td class="num"></td><td class="num"></td>
                <td class="num">${cur} <span data-rbsub="${esc(e.key)}">${c.subtotal.toFixed(2)}</span></td></tr>
            <tr><td>Overheads and profit
                <input type="number" step="0.5" min="0" data-rboh="${esc(e.key)}" value="${c.overheads}" style="width:58px;text-align:right"> %</td>
                <td class="num"></td><td class="num"></td>
                <td class="num">${cur} <span data-rbohamt="${esc(e.key)}">${c.uplift.toFixed(2)}</span></td></tr>
            <tr class="rb-total"><td>Computed cost</td><td class="num"></td><td class="num"></td>
                <td class="num">${cur} <span data-rbcomp="${esc(e.key)}">${c.computed.toFixed(2)}</span></td></tr>
            <tr><td>Rate in bill
                <input type="number" step="0.01" min="0" data-rbrate="${esc(e.key)}" value="${e.rate}" style="width:96px;text-align:right"></td>
                <td class="num"></td>
                <td class="num hint">${e.qty.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${esc(e.unit)}</td>
                <td class="num"><button class="btn sm ${c.adopted ? 'primary' : ''}" data-rbadopt="${esc(e.key)}">${c.adopted ? 'Adopted' : 'Adopt computed'}</button></td></tr>
          </tfoot>
        </table>
      </div>
    </details>`;
  }

  function rateCards(p, entries) {
    if (!entries.length) return '';
    return entries.map(e => rbCard(p, e)).join('');
  }

  function ratePanel(p, entries, filter) {
    const cur = p.curSymbol || 'GH\u00a2';
    entries = entries || [];
    filter = filter || 'principal';
    const shown = filter === 'all'
      ? entries
      : entries.filter((e, i) => i < 20 || (p.rb && p.rb.adopted && p.rb.adopted[e.key]));
    const groups = [];
    RateBuild.INPUTS.forEach(i => {
      let g = groups.find(x => x.cat === (i.cat || 'Other'));
      if (!g) { g = { cat: i.cat || 'Other', items: [] }; groups.push(g); }
      g.items.push(i);
    });
    const inputs = groups.map(g => `<tr class="rb-cat"><td colspan="3">${esc(g.cat)} <span class="hint">· ${g.items.length}</span></td></tr>` +
      g.items.map(i => `<tr>
        <td>${esc(i.label)}</td>
        <td class="num" style="width:64px">${esc(i.unit)}</td>
        <td class="num" style="width:120px"><input type="number" step="0.01" min="0" data-rb="${i.id}" value="${RateBuild.inputPrice(p, i.id)}" style="width:100%;text-align:right"></td>
      </tr>`).join('')).join('');

    return `<p class="lede">Every priced item the drawing produces becomes a build-up, largest value first. Rates with a known
      make-up are built from the market prices below — materials, labour, plant and sundries, plus overheads and profit.
      Proprietary items are split into supply and fix. Change any figure and the computed cost follows; <b>Adopt</b> copies it
      into the bill. Rates you do not adopt keep their issued value.</p>

      <div class="row" style="flex-wrap:wrap;gap:8px;margin:6px 0">
        <button class="btn sm" id="rb-adopt-all">Adopt every computed rate</button>
        <button class="btn sm" id="rb-use-bill">Use bill rates</button>
        <button class="btn sm" id="rb-reset">Reset build-ups</button>
        <button class="btn sm" id="rb-from-db" title="Take the material prices from the materials database kept on this device">Prices from the database</button>
        <label class="hint" style="margin-left:auto">Show
          <select id="rb-filter" style="margin-left:6px">
            <option value="principal"${filter === 'principal' ? ' selected' : ''}>principal items (${Math.min(20, entries.length)} of ${entries.length})</option>
            <option value="all"${filter === 'all' ? ' selected' : ''}>every item (${entries.length})</option>
          </select></label>
      </div>
      <p class="hint" id="rb-status" style="margin:0 0 4px">${esc(rbStatus(p, entries))}</p>
      <p class="hint" id="rb-summary" style="margin:0 0 6px">${rbSummary(p, entries)}</p>

      <details class="rb-prices">
        <summary><b>Market prices adopted — ${esc(p.country || 'Ghana')}</b>
          <span class="hint"> (${RateBuild.INPUTS.length} inputs · Greater Accra, Q4 2026 · type over any figure)</span></summary>
        <div class="tbl-scroll" style="max-height:none;margin-top:8px"><table class="rooms-table">
          <thead><tr><th>Input</th><th class="num">Unit</th><th class="num">Price (${esc(cur)})</th></tr></thead>
          <tbody>${inputs}</tbody></table></div>
      </details>

      <h4 style="margin:16px 0 8px;color:var(--green-ink)">Build-ups from the measured bill${filter === 'all' ? '' : ' — principal items'}</h4>
      <div id="rb-builds">${rateCards(p, shown)}</div>`;
  }


  function open(state, onApply, onLive) {
    const p = state.params;
    const existing = $('#settings-overlay');
    if (existing) existing.remove();

    const ov = document.createElement('div');
    ov.id = 'settings-overlay';
    ov.className = 'overlay-modal';
    ov.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="Settings">
        <header class="modal-head">
          <div>
            <h2>Settings</h2>
            <p class="hint">Everything here changes how the bill is measured, specified and priced.</p>
          </div>
          <button class="icon-x" id="set-close" aria-label="Close">✕</button>
        </header>

        <div class="tabs" id="set-tabs">
          <button class="tab active" data-tab="project">Project</button>
          <button class="tab" data-tab="parties">Parties</button>
          <button class="tab" data-tab="structure">Structure &amp; roof</button>
          <button class="tab" data-tab="finishes">Finishes</button>
          <button class="tab" data-tab="services">Services</button>
          <button class="tab" data-tab="pricing">Pricing</button>
          <button class="tab" data-tab="rates">Rate build-up</button>
        </div>

        <div class="modal-body">
          <section data-panel="project">
            <div class="grid2">
              ${field('Project name', 'projectName', 'text', { value: p.projectName })}
              ${field('Sub-title', 'projectSub', 'text', { value: p.projectSub })}
              ${field('Client', 'client', 'text', { value: p.client || '' })}
              ${field('Location', 'location', 'text', { value: p.location })}
              ${field('Building type', 'buildingType', 'select', { value: p.template === 'school' ? 'educational' : p.buildingType, options: [['domestic', 'Domestic (house / apartment)'], ['commercial', 'Commercial (office, shop, mixed-use)'], ['educational', 'Educational (school block)'], ['health', 'Health (clinic / CHPS)'], ['religious', 'Religious (church / chapel)']] })}
              ${field('Measurement template', 'template', 'select', { value: p.template || 'general', options: templateOptions(p) })}
              ${field('Country', 'country', 'select', { value: p.country || 'Ghana', options: GenEngine.COUNTRIES.map(c => [c.name, c.name + ' — ' + c.label]) })}
              ${(p.country || 'Ghana') === 'Ghana'
                ? field('Region for rates', 'region', 'select', { value: p.region || 'Greater Accra', options: ['Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern', 'Northern', 'Volta', 'Upper East', 'Upper West'] })
                : `<div class="field"><label>Region for rates</label><input disabled value="Ghana card — not localised"></div>`}
              ${field('Drawing reference', 'drawingRef', 'text', { value: p.drawingRef || '' })}
            </div>
            <div class="note" style="margin-top:14px">
              <b>Building type</b> sets the room list, services and typical specification used by the pricing model.
              You can override everything else on the other tabs.
            </div>
          </section>

          <section data-panel="structure" hidden>
            <div class="grid3">
              ${field('Storeys', 'storeys', 'number', { value: p.storeys || 1, step: 1, min: 1 })}
              ${field('Floor to floor (m)', 'floorH', 'number', { value: p.floorH || 3 })}
              ${field('Floor to ceiling (m)', 'wallH', 'number', { value: p.wallH || 2.9 })}
              ${field('Plinth height (m)', 'plinth', 'number', { value: p.plinth || 0.45 })}
              ${field('Foundation depth (m)', 'foundDepth', 'number', { value: p.foundDepth || 1.2 })}
              ${field('Foundation type', 'foundType', 'select', { value: p.foundType || 'strip', options: [['strip', 'Strip footing'], ['raft', 'Raft foundation']] })}
              ${field('Wall thickness (mm)', 'wallTmm', 'select', { value: Math.round((p.wallT || 0.15) * 1000), options: [['150', '150 mm (6 in)'], ['225', '225 mm (9 in)'], ['125', '125 mm (5 in)']] })}
              ${field('Overall width (m)', 'bW', 'number', { value: p.bW || 12 })}
              ${field('Overall depth (m)', 'bD', 'number', { value: p.bD || 9 })}
              ${field('Roof type', 'roofType', 'select', { value: p.roofType || 'pitched', options: [['pitched', 'Pitched, timber trusses'], ['flat', 'Flat with parapet']] })}
              ${field('Roof pitch (degrees)', 'roofPitch', 'number', { value: p.roofPitch || 22, step: 1 })}
              ${field('Eaves overhang (m)', 'overhang', 'number', { value: p.overhang || 0.6 })}
              ${field('Parapet height (m)', 'parapet', 'number', { value: p.parapet || 0.9 })}
              ${field('Eaves height from sections (m, 0 = auto)', 'eavesH', 'number', { value: p.eavesH || 0 })}
            </div>
            <div class="note" style="margin-top:14px"><b>From the sections:</b> enter the floor-to-floor, plinth and foundation depths.
              Leave eaves height at 0 and it is calculated as plinth + storeys × floor height.</div>
          </section>

          <section data-panel="finishes" hidden>
            <div class="grid3">
              ${field('Floor finish — dry rooms', 'floorMain', 'select', { value: p.floorMain || 'tiles', options: finOpts() })}
              ${field('Floor finish — wet areas', 'floorWet', 'select', { value: p.floorWet || 'tiles', options: wetOpts() })}
              ${field('Ceiling', 'ceilingType', 'select', { value: p.ceilingType || 'pvc', options: ceilOpts() })}
              ${field('Window type', 'windowType', 'select', { value: p.windowType || 'aluminium', options: [['aluminium', 'Aluminium sliding'], ['louvre', 'Steel louvre + bars'], ['upvc', 'uPVC'], ['timber', 'Timber casement']] })}
              ${field('External finish', 'externalFinish', 'select', { value: p.externalFinish || 'render', options: [['render', 'Cement render + paint'], ['fairface', 'Fair-face block + paint'], ['cladding', 'Cladding panels']] })}
            </div>
          </section>

          <section data-panel="services" hidden>
            <div class="checks">
              ${field('Electrical installation', 'svcElectrical', 'check', { value: p.svcElectrical })}
              ${field('Plumbing and sanitary ware', 'svcPlumbing', 'check', { value: p.svcPlumbing })}
              ${field('Air-conditioning / ventilation', 'svcHVAC', 'check', { value: p.svcHVAC })}
              ${field('Fire detection and alarm', 'svcFire', 'check', { value: p.svcFire })}
              ${field('Standby generator', 'svcGenerator', 'check', { value: p.svcGenerator })}
              ${field('Solar PV system', 'svcSolar', 'check', { value: p.svcSolar })}
              ${field('Borehole and pump', 'svcBorehole', 'check', { value: p.svcBorehole })}
              ${field('Boundary wall and gate', 'boundaryOn', 'check', { value: p.boundaryOn })}
            </div>
            <div class="note" style="margin-top:14px">Unticked services are left out of the bill entirely, together with their bills.</div>
          </section>

          <section data-panel="pricing" hidden>
            <div class="grid3">
              ${field('Overheads and profit (%)', 'opProfitPct', 'number', { value: p.opProfitPct || 12, step: 0.5 })}
              ${field('Preliminaries (% of works)', 'prelimPct', 'number', { value: p.prelimPct || 8, step: 0.5 })}
              ${field('Material wastage (%)', 'wastagePct', 'number', { value: p.wastagePct || 5, step: 0.5 })}
              ${field('Contingency (%)', 'contingency', 'number', { value: p.contingency || 5, step: 0.5 })}
              ${field('VAT / levies (%)', 'vatPct', 'number', { value: p.vatPct || 0, step: 0.5 })}
            </div>
            <div class="note" style="margin-top:14px">
              <b>Current prices.</b> With an internet connection, the app can refresh the rates. Either point it at a
              <b>price feed</b> — a JSON file with the current rates — or leave the feed blank and it will index the
              built-in rates to the cedi (65% of the movement, the imported share). Nothing about the project is sent.
              <div class="grid3" style="margin-top:10px">
                ${field('Price feed URL (optional)', 'ratesFeedUrl', 'text', { value: p.ratesFeedUrl || '', placeholder: 'https://…/rates.json' })}
                ${field('Rates compiled on', 'ratesBasisDate', 'text', { value: p.ratesBasisDate || '2026-10-01', placeholder: 'YYYY-MM-DD' })}
                ${field('Cedi basis (GH¢ per US$)', 'fxBasis', 'number', { value: p.fxBasis || '', step: 0.01, min: 0 })}
              </div>
              <div class="hint" style="margin-top:6px">The cedi index uses the rate on the day the rates were compiled — leave
                the basis blank and the app looks it up from that date.</div>
              <div class="row" style="margin-top:10px;align-items:center;gap:10px">
                <button class="btn sm" id="btn-live-prices2">Update prices online</button>
                <button class="btn sm" id="btn-rate-template">Download rate template</button>
                <span class="hint" id="price-status">${esc(p.priceNote || 'Rates as issued: Q4 2026 Greater Accra market rates')}</span>
              </div>
              <div class="hint" style="margin-top:8px">Feed format: <code>{ "source": "Ampofo &amp; Partners", "date": "2026-10-01", "rates": { "block": 8.5, "rebar": 14.2 } }</code></div>

              <div class="note" style="margin-top:16px">
                <b>AI price lookup.</b> With a model key, <b>Update prices online</b> asks the model for today's rates in the
                country set on the Project tab and applies them. Without a key the app falls back to the price feed, then to
                the cedi index. The key is kept only in this browser; nothing about the project or the drawing is sent —
                just the list of rate names.
                <div class="grid2" style="margin-top:10px">
                  ${field('Provider', 'aiProvider', 'select', { value: p.aiProvider || 'gemini', options: [
                    ['gemini', 'Google Gemini'], ['anthropic', 'Anthropic Claude'],
                    ['openai', 'OpenAI'], ['custom', 'OpenAI-compatible (local / other)']] })}
                  ${field('API key', 'aiKey', 'password', { value: p.aiKey || '', placeholder: 'paste key — stored on this device' })}
                  ${field('Model', 'aiModel', 'text', { value: p.aiModel || '', placeholder: 'e.g. gemini-2.0-flash' })}
                  ${field('Base URL (OpenAI-compatible only)', 'aiBaseUrl', 'text', { value: p.aiBaseUrl || '', placeholder: 'https://api.openai.com/v1' })}
                </div>
                <div class="hint" style="margin-top:8px">Gemini keys are free at aistudio.google.com. Anthropic keys work from the
                browser directly; OpenAI keys are usually blocked by the provider for browser use — use a local
                OpenAI-compatible server or a proxy in that case.</div>
              </div>
            </div>
          </section>

          <section data-panel="parties" hidden>
            <p class="lede">Who the bill is for and who prices it. These names and addresses are printed on the
            cover and on the signature page of the PDF, Word and Excel bill, and on the printed copy.</p>

            <h4 style="margin:6px 0 8px;color:var(--green-ink)">Client / Employer</h4>
            <div class="grid2">
              ${field('Client name', 'client', 'text', { value: p.client || '', placeholder: 'e.g. Grace Chapel International' })}
              ${field('Client address', 'clientAddr', 'text', { value: p.clientAddr || '', placeholder: 'P.O. Box, town, region' })}
            </div>

            <h4 style="margin:16px 0 8px;color:var(--green-ink)">Contractor (the tenderer)</h4>
            <div class="grid2">
              ${field('Contractor name', 'contractor', 'text', { value: p.contractor || '', placeholder: 'Name of building contractor' })}
              ${field('Contractor address', 'contractorAddr', 'text', { value: p.contractorAddr || '', placeholder: 'Registered office' })}
              ${field('Class / registration', 'contractorClass', 'text', { value: p.contractorClass || '', placeholder: 'e.g. Ministry of Works Class 1' })}
            </div>

            <h4 style="margin:16px 0 8px;color:var(--green-ink)">Consultant</h4>
            <div class="grid2">
              ${field('Consultant / Quantity Surveyor', 'consultant', 'text', { value: p.consultant || '', placeholder: 'Firm preparing the bill' })}
              ${field('Consultant address', 'consultantAddr', 'text', { value: p.consultantAddr || '', placeholder: 'Office address' })}
            </div>

            <h4 style="margin:16px 0 8px;color:var(--green-ink)">Bill details</h4>
            <div class="grid2">
              ${field('Tender / contract reference', 'tenderRef', 'text', { value: p.tenderRef || '', placeholder: 'e.g. GCI/2026/04' })}
              ${field('Date of bill', 'billDate', 'text', { value: p.billDate || '', placeholder: 'leave blank for today' })}
              ${field('Contract period', 'contractPeriod', 'text', { value: p.contractPeriod || '', placeholder: 'e.g. 32 weeks' })}
              ${field('Prepared by', 'preparedBy', 'text', { value: p.preparedBy || '', placeholder: 'Name of quantity surveyor' })}
            </div>
          </section>

          <section data-panel="rates" hidden>
            ${ratePanel(p, RateBuild.list(state.result))}
          </section>
        </div>

        <footer class="modal-foot">
          <button class="btn" id="set-cancel">Cancel</button>
          <button class="btn primary" id="set-apply">Apply settings</button>
        </footer>
      </div>`;
    document.body.appendChild(ov);
    if (window.SearchSelect) window.SearchSelect.enhance(ov);

    const setTab = name => {
      $$('.tab', ov).forEach(t => t.classList.toggle('active', t.dataset.tab === name));
      $$('section[data-panel]', ov).forEach(s => { s.hidden = s.dataset.panel !== name; });
    };
    $$('.tab', ov).forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));

    const close = () => ov.remove();
    $('#set-close', ov).onclick = close;
    $('#set-cancel', ov).onclick = close;
    ov.addEventListener('click', e => { if (e.target === ov) close(); });

    /* ---------------- rate build-up wiring ---------------- */
    const pLive = state.params;
    const note = m => { if (typeof window.__toast === 'function') window.__toast(m); };
    let rbEntries = RateBuild.list(state.result);
    rbMk = (state.result && state.result.subtotal) ? state.result.grand / state.result.subtotal : 1;
    let rbFilter = 'principal';
    const numOr = (el, fallback) => {
      const v = parseFloat(el.value);
      return isFinite(v) ? v : fallback;
    };
    const cssEsc = s => String(s).replace(/["\\]/g, '\\$&');

    /* the bill rate a card shows is the all-in rate; the engine keeps the
       pre-overheads rate, so convert when writing back */
    const writeBillRate = (p, key, v) => {
      const f = RateBuild.uplift(p);
      if (key.indexOf('door:') === 0 || key.indexOf('window:') === 0) {
        const i = key.indexOf(':');
        const arr = key.slice(0, i) === 'door' ? (p.doors || []) : (p.windows || []);
        const it = arr.find(x => x.ref === key.slice(i + 1));
        if (it) it.rate = v;
        return;
      }
      p.rates = p.rates || {};
      p.rates[key] = Math.round(v / f * 100) / 100;
    };

    const setNum = (host, sel, v) => {
      const el = host.querySelector(sel);
      if (el && document.activeElement !== el) el.textContent = v;
    };

    /* numbers only — never re-write the cards while a field has focus */
    const refreshNums = () => {
      rbEntries.forEach(e => {
        const host = ov.querySelector('[data-rbcard="' + cssEsc(e.key) + '"]');
        if (!host) return;
        const c = RateBuild.compute(pLive, e);
        if (!c) return;
        setNum(host, '[data-rbsub]', c.subtotal.toFixed(2));
        setNum(host, '[data-rbohamt]', c.uplift.toFixed(2));
        setNum(host, '[data-rbcomp]', c.computed.toFixed(2));
        setNum(host, '[data-rbhead]', c.computed.toFixed(2));
        const oh = host.querySelector('[data-rboh]');
        if (oh && document.activeElement !== oh) oh.value = c.overheads;
        const cmp = host.querySelector('.rb-compare');
        if (cmp) {
          const d = e.rate ? (c.computed - e.rate) / e.rate * 100 : 0;
          const i = cmp.querySelector('i');
          if (i) {
            i.className = d >= 0 ? 'up' : 'down';
            i.textContent = (d >= 0 ? '+' : '\u2212') + Math.abs(d).toFixed(1) + ' %';
          }
        }
      });
      const st = $('#rb-status', ov); if (st) st.textContent = rbStatus(pLive, rbEntries);
      const sm = $('#rb-summary', ov); if (sm) sm.innerHTML = rbSummary(pLive, rbEntries);
      if (typeof onLive === 'function') onLive();
    };

    /* re-draw the whole tab (only after a click, never on a field change) */
    const renderRates = () => {
      rbEntries = RateBuild.list(state.result);
      rbMk = (state.result && state.result.subtotal) ? state.result.grand / state.result.subtotal : 1;
      const sec = ov.querySelector('section[data-panel="rates"]');
      if (!sec) return;
      const openKeys = Array.from(ov.querySelectorAll('[data-rbcard][open]')).map(x => x.dataset.rbcard);
      sec.innerHTML = ratePanel(pLive, rbEntries, rbFilter);
      openKeys.forEach(k => {
        const el = ov.querySelector('[data-rbcard="' + cssEsc(k) + '"]');
        if (el) el.open = true;
      });
      if (typeof onLive === 'function') onLive();
    };
    // let the price refresh re-draw this tab in place
    ov._refreshRates = renderRates;

    ov.addEventListener('change', ev => {
      const t = ev.target;
      if (t.id === 'rb-filter') {
        rbFilter = t.value;
        renderRates();
      } else if (t.dataset.rb) {
        pLive.rb = pLive.rb || {}; pLive.rb.inputs = pLive.rb.inputs || {};
        pLive.rb.inputs[t.dataset.rb] = numOr(t, RateBuild.inputPrice(pLive, t.dataset.rb));
        refreshNums();
      } else if (t.dataset.rboh) {
        pLive.rb = pLive.rb || {}; pLive.rb.oh = pLive.rb.oh || {};
        pLive.rb.oh[t.dataset.rboh] = numOr(t, 0);
        refreshNums();
      } else if (t.dataset.rbrate) {
        const e = rbEntries.find(x => x.key === t.dataset.rbrate);
        const v = numOr(t, e ? e.rate : 0);
        writeBillRate(pLive, t.dataset.rbrate, v);
        if (pLive.rb && pLive.rb.adopted) pLive.rb.adopted[t.dataset.rbrate] = false;
        renderRates();
      }
    });

    ov.addEventListener('click', ev => {
      const b = ev.target.closest('[data-rbadopt]');
      if (b) {
        const key = b.dataset.rbadopt;
        const e = rbEntries.find(x => x.key === key);
        const c = e ? RateBuild.compute(pLive, e) : null;
        RateBuild.adopt(pLive, key, c ? !c.adopted : true);
        if (typeof onLive === 'function') onLive();
        renderRates();
        return;
      }
      if (ev.target.id === 'rb-adopt-all') {
        rbEntries.forEach(e => RateBuild.adopt(pLive, e.key, true));
        if (typeof onLive === 'function') onLive();
        renderRates();
        note('All ' + rbEntries.length + ' computed rates adopted into the bill');
        return;
      }
      if (ev.target.id === 'rb-use-bill') {
        RateBuild.useBill(pLive);
        if (typeof onLive === 'function') onLive();
        renderRates();
        note('Bill rates restored');
        return;
      }
      if (ev.target.id === 'rb-from-db') {
        if (typeof MatDB === 'undefined') { note('The materials database is not loaded'); return; }
        if (typeof Users !== 'undefined' && Users.can && !Users.can('edit')) { note('A reviewer cannot change the prices'); return; }
        const prices = MatDB.linkPrices();
        pLive.rb = pLive.rb || {}; pLive.rb.inputs = pLive.rb.inputs || {};
        let n = 0;
        Object.keys(prices).forEach(k => { pLive.rb.inputs[k] = prices[k]; n++; });
        if (typeof onLive === 'function') onLive();
        renderRates();
        note(n + ' market prices taken from the materials database (' + MatDB.stats().total + ' materials)');
        return;
      }
      if (ev.target.id === 'rb-reset') {
        RateBuild.reset(pLive);
        if (typeof onLive === 'function') onLive();
        renderRates();
        note('Market prices and build-ups reset to the 2026 defaults');
        return;
      }
    });

    $('#set-apply', ov).onclick = () => {
      const patch = {};
      $$('[data-set]', ov).forEach(el => {
        const key = el.dataset.set;
        let v;
        if (el.type === 'checkbox') v = el.checked;
        else if (el.tagName === 'SELECT' && el.dataset.set === 'wallTmm') {
          patch.wallT = parseFloat(el.value) / 1000;
          return;
        } else if (el.type === 'number') {
          v = parseFloat(el.value);
          if (!isFinite(v)) return;          // leave blank fields alone
        } else v = el.value;
        if (key === 'wallTmm') return;
        patch[key] = v;
      });
      // a change of building type or measurement template carries a typical
      // layout with it, so the geometry and the room schedule stay coherent
      const currentType = p.template === 'school' ? 'educational' : p.buildingType;
      const typeChanged = patch.buildingType && patch.buildingType !== currentType;
      const tplChanged = patch.template && patch.template !== (p.template || 'school');
      let presetIndex = null;
      if (typeChanged || tplChanged) {
        // the building type wins: educational -> school template, everything
        // else -> the general engine (a template change on its own is honoured)
        const tpl = typeChanged
          ? (patch.buildingType === 'educational' ? 'school' : 'general')
          : patch.template;
        patch.template = tpl;
        const i = presetFor(patch.buildingType || p.buildingType, tpl, patch.storeys || p.storeys);
        const hasRooms = (p.rooms || []).length > 0 && p.template !== 'school';
        const ok = !hasRooms ||
          confirm('Replace the current room schedule with the typical ' +
            (PRESETS[i] ? PRESETS[i].label : 'layout') + '?');
        if (ok && i >= 0) presetIndex = i;
      }
      onApply(patch, presetIndex);
      close();
    };
  }

  /* ================================================================
     VERTICALS — sections & elevations
     ================================================================ */
  /* ================================================================
     FINISHES — shown on the Building model step
     ================================================================ */
  function finishesPanel(state) {
    const p = state.params || {};
    const school = (p.template || 'school') === 'school';
    const floorKey = school ? 'floorFinish' : 'floorMain';
    const floorVal = school ? (p.floorFinish || 'terrazzo') : (p.floorMain || 'tiles');
    const ceil = p.ceilingType || 'pvc';
    const ceilNote = (root.GenEngine && GenEngine.CEILING_FINISH[ceil]) ? GenEngine.CEILING_FINISH[ceil] : null;
    return `
    <section class="panel">
      <h2>Finishes</h2>
      <p class="lede">The floor and ceiling the bill carries. Every type below has its own description and rate;
      the rate can still be changed line by line on the bill.</p>
      <div class="grid3">
        ${field('Floor — dry rooms', floorKey, 'select', { attr: 'data-p', value: floorVal, options: finOpts() })}
        ${field('Floor — wet areas', 'floorWet', 'select', { attr: 'data-p', value: p.floorWet || 'tiles', options: wetOpts() })}
        ${field('Ceiling', 'ceilingType', 'select', { attr: 'data-p', value: ceil, options: ceilOpts() })}
      </div>
      <p class="hint" style="margin-top:8px">${ceilNote && ceil !== 'none'
        ? 'Ceiling: ' + esc(ceilNote.desc) + (ceilNote.cornice ? ', with 65 mm cornice' : ', no cornice')
        : 'No ceiling: the soffit is left exposed and no ceiling bill is produced.'}</p>
    </section>`;
  }

  /* ================================================================
     ROOM SCHEDULE
     ================================================================ */
  /* The room schedule has to add up to something like the building: too few
     square metres and the finishes are under-measured, too many and rooms are
     being priced outside the walls. Say so here, where it can be fixed. */
  function fitWarning(result, p, g) {
    if (!result || !g || !g.footprint) return '';
    const net = result.netArea || 0;
    const gross = g.footprint * Math.max(1, p.storeys || 1);
    if (!net || !gross) return '';
    const ratio = net / gross;
    if (ratio >= 0.62 && ratio <= 1.02) return '';
    return `<p class="fit-warn">The rooms add up to ${net.toFixed(2)} m² net on ${gross.toFixed(2)} m² of floor —
      ${ratio < 0.62 ? 'less than the building can hold, so finishes and fittings are under-measured.'
                     : 'more than the building can hold, so rooms are being priced outside the walls.'}
      Check the room sizes, or change the overall width and depth in Settings → Structure.</p>`;
  }

  function roomsPanel(state, result) {
    const p = state.params;
    const rooms = p.rooms || [];
    // every type offered for this building, plus any type the drawing brought
    // in (a house with a shop, a school with a store) so nothing is lost
    const offered = ROOM_PRESETS[p.buildingType] || ROOM_PRESETS.domestic;
    const types = offered.concat(rooms.map(r => r.type).filter(t => t && offered.indexOf(t) < 0))
      .filter((t, i, a) => a.indexOf(t) === i);
    const ROOM_LABEL = {
      bedroom: 'Bedroom', living: 'Living room', hall: 'Hall', dining: 'Dining', kitchen: 'Kitchen',
      bath: 'Bathroom', wc: 'WC / toilet', store: 'Store', corridor: 'Corridor / lobby',
      porch: 'Porch / veranda', garage: 'Garage', office: 'Office', shop: 'Shop / retail',
      classroom: 'Classroom', ward: 'Ward', reception: 'Reception', stair: 'Staircase',
      auditorium: 'Auditorium', sanctuary: 'Sanctuary', vestry: 'Vestry', choir: 'Choir', foyer: 'Foyer',
      study: 'Study', laundry: 'Laundry', utility: 'Utility', balcony: 'Balcony / terrace',
      verandah: 'Verandah', pantry: 'Pantry', dining2: 'Dining'
    };
    const g = result && result.model && result.model.g;
    const rows = rooms.map((r, i) => `
      <tr>
        <td><input data-room="${i}" data-k="name" value="${esc(r.name)}"></td>
        <td>
          <select data-room="${i}" data-k="type">${types.map(t =>
            `<option value="${t}"${r.type === t ? ' selected' : ''}>${ROOM_LABEL[t] || t}</option>`).join('')}</select>
        </td>
        <td><input type="number" step="0.1" data-room="${i}" data-k="L" value="${r.L}"></td>
        <td><input type="number" step="0.1" data-room="${i}" data-k="W" value="${r.W}"></td>
        <td><input type="number" step="1" min="1" data-room="${i}" data-k="n" value="${r.n || 1}"></td>
        <td class="num">${(r.L * r.W * (r.n || 1)).toFixed(2)}</td>
        <td><button class="icon-btn" data-room-del="${i}" title="Remove">✕</button></td>
      </tr>`).join('');

    return `
    <section class="panel">
      <h2>Room schedule</h2>
      <p class="lede">The schedule drives the floor, wall and ceiling finishes and the electrical points.
      Add rooms to match the plan; the totals update as you type.</p>

      <div class="row" style="align-items:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <div class="field" style="min-width:280px"><label>Load a typical room layout</label>
          <select id="preset2">${(presetsForType(p.buildingType).length ? presetsForType(p.buildingType)
              : PRESETS.map((x, i) => ({ x: x, i: i })).filter(o => o.x.params.template !== 'school'))
            .map(o => `<option value="${o.i}"${state.roomPreset === o.i ? ' selected' : ''}>${esc(o.x.label)}</option>`).join('')}</select>
        </div>
        <button class="btn" id="btn-preset2">Load rooms</button>
        <button class="btn" id="btn-add-room">+ Add room</button>
      </div>

      <div class="tbl-scroll" style="max-height:none"><table class="rooms-table">
        <thead><tr><th style="width:170px">Room</th><th style="width:120px">Type</th><th style="width:80px">Length (m)</th>
          <th style="width:80px">Width (m)</th><th style="width:60px">No.</th><th class="num" style="width:90px">Area (m²)</th><th style="width:34px"></th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="5">Net internal area (sum of rooms)</td>
          <td class="num">${result ? (result.netArea || result.GFA).toFixed(2) : '0.00'}</td><td></td></tr></tfoot>
      </table></div>

      <div class="grid4" style="margin-top:12px">
        <div class="stat"><span>Storeys</span><b>${p.storeys || 1}</b></div>
        <div class="stat"><span>Footprint</span><b>${g ? g.footprint.toFixed(2) + ' m²' : '—'}</b></div>
        <div class="stat"><span>Gross floor area</span><b>${result ? result.GFA.toFixed(2) + ' m²' : '—'}</b></div>
        <div class="stat"><span>External wall run</span><b>${g ? g.ext.toFixed(2) + ' m' : '—'}</b></div>
      </div>
      ${fitWarning(result, p, g)}
    </section>`;
  }

  root.Settings = { open, roomsPanel, finishesPanel, PRESETS, ROOM_PRESETS, presetFor, presetsForType };
})(typeof window !== 'undefined' ? window : globalThis);
